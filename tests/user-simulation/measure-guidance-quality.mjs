/**
 * Lightweight, deterministic measurement — NO extension loading, NO chat UI,
 * NO persistent browser profile, NO shadow DOM, NO cross-tab shared state.
 *
 * Method:
 *  1. Launch a plain headless Chromium page (no extension) and load the real
 *     fixture HTML for each task — same pages, same ground truth as before.
 *  2. Extract a simple interactive-element list from the real rendered page.
 *  3. Call the backend's actual /api/ai/generate-steps endpoint directly
 *     over HTTP with that element list + the task prompt — the exact same
 *     request the extension itself makes, minus all extension plumbing.
 *  4. For each generated step's target.css, use Playwright's own selector
 *     engine (real browser, real CSS, no re-implementation of any resolver)
 *     to check whether it resolves to the correct ground-truth element.
 *  5. Execute only the steps verified correct, then check the ground-truth
 *     success indicator for Task Completion.
 *
 * This directly tests the real, currently-deployed AI pipeline (including
 * today's max_tokens / quick-pass fixes) with zero UI-automation flakiness.
 */
import { chromium } from 'playwright';
import path from 'path';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { SMOKE_TASKS } from './scenarios/smoke-tasks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_URL = 'http://localhost:4000';

// ── Minimal interactive-element extractor (mirrors what the real backend expects) ──
function extractElements() {
  const sel = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"]';
  return Array.from(document.querySelectorAll(sel)).slice(0, 100).map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      text: (el.textContent || el.value || '').trim().slice(0, 60),
      type: el.type || undefined,
      role: el.getAttribute('role') || undefined,
      ariaLabel: el.getAttribute('aria-label') || undefined,
      placeholder: el.placeholder || undefined,
      selector: el.id ? '#' + el.id : el.tagName.toLowerCase(),
      isVisible: rect.width > 0 && rect.height > 0,
    };
  }).filter((e) => e.isVisible);
}

async function getGeneratedSteps(prompt, elements, currentUrl) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(`${BACKEND_URL}/api/ai/generate-steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, elements, language: 'km', currentUrl, mode: 'initial' }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { steps: [], error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    const text = await res.text();
    let data = null;
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try { data = JSON.parse(payload); } catch { /* skip */ }
    }
    if (!data) { try { data = JSON.parse(text); } catch { return { steps: [], error: 'unparseable response' }; } }
    if (data.error) return { steps: [], error: data.error };
    return { steps: data.tutorial?.steps || [], error: data.tutorial?.steps?.length ? null : 'no steps returned' };
  } catch (err) {
    return { steps: [], error: err.message };
  }
}

async function runTask(browser, task) {
  const page = await browser.newPage();
  const result = {
    taskId: task.id,
    supported: false,
    matchedSteps: 0,
    totalSteps: task.groundTruth.requiredActions.length,
    completed: false,
    generateStepsError: null,
    generatedStepCount: 0,
    note: null,
  };

  try {
    await page.goto(task.groundTruth.startPage, { waitUntil: 'load', timeout: 10000 });
    const elements = await page.evaluate(extractElements);

    const { steps, error } = await getGeneratedSteps(task.userPrompt, elements, task.groundTruth.startPage);
    result.generateStepsError = error;
    result.generatedStepCount = steps.length;
    result.supported = steps.length > 0;

    if (steps.length === 0) {
      result.note = 'no AI-generated steps';
      return result;
    }

    // Walk ground-truth required actions in order. A step "counts" only if
    // some generated step's target.css resolves, via Playwright's real
    // selector engine, to exactly the ground-truth element for this action.
    for (const action of task.groundTruth.requiredActions) {
      let matchedCss = null;
      for (const step of steps) {
        const css = step.target?.css;
        if (!css) continue;
        try {
          const loc = page.locator(css).first();
          if (await loc.count() === 0) continue;
          const sameElement = await page.evaluate(
            ([css, groundTruthSelector]) => {
              const a = document.querySelector(css);
              const b = document.querySelector(groundTruthSelector);
              return !!a && !!b && a === b;
            },
            [css, action.selector]
          );
          if (sameElement) { matchedCss = css; break; }
        } catch { /* invalid selector from the model — not a match */ }
      }

      if (!matchedCss) break; // stop at the first correctly-guided step this task doesn't have

      result.matchedSteps++;
      try {
        if (action.type === 'fill') {
          await page.fill(action.selector, action.value, { timeout: 3000 });
          await page.locator(action.selector).press('Tab').catch(() => {});
        } else if (action.type === 'click') {
          await page.click(action.selector, { timeout: 3000 });
        } else if (action.type === 'clear') {
          await page.fill(action.selector, '', { timeout: 3000 });
        }
      } catch (err) {
        result.note = `action execution failed: ${err.message?.slice(0, 100)}`;
        break;
      }

      const done = await page.locator(task.groundTruth.successIndicator).count().catch(() => 0);
      if (done > 0) break;
    }

    const finalDone = await page.locator(task.groundTruth.successIndicator).count().catch(() => 0);
    result.completed = finalDone > 0;
  } catch (err) {
    result.note = `harness error: ${err.message?.slice(0, 150)}`;
  } finally {
    await page.close().catch(() => {});
  }
  return result;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const task of SMOKE_TASKS) {
    const r = await runTask(browser, task);
    console.log(
      `${task.id}: supported=${r.supported} (${r.generatedStepCount} steps${r.generateStepsError ? `, error: ${r.generateStepsError}` : ''}) ` +
      `matched=${r.matchedSteps}/${r.totalSteps} completed=${r.completed}${r.note ? ` — ${r.note}` : ''}`
    );
    results.push(r);
  }
  await browser.close();

  const n = results.length;
  const supported = results.filter((r) => r.supported).length;
  const completed = results.filter((r) => r.completed).length;
  const totalSteps = results.reduce((s, r) => s + r.totalSteps, 0);
  const matchedSteps = results.reduce((s, r) => s + r.matchedSteps, 0);

  const summary = {
    method: 'direct-backend-call + real-browser-selector-verification (no extension, no chat UI, headless)',
    generatedAt: new Date().toISOString(),
    taskSupportRate: `${Math.round((supported / n) * 100)}% (${supported}/${n})`,
    taskCompletionRate: `${Math.round((completed / n) * 100)}% (${completed}/${n})`,
    guidanceAccuracy: `${Math.round((matchedSteps / totalSteps) * 100)}% (${matchedSteps}/${totalSteps} required actions correctly targeted)`,
    perTask: results,
  };

  writeFileSync(path.join(__dirname, 'results', 'unbiased-measurement.json'), JSON.stringify(summary, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log('Task Support Rate   :', summary.taskSupportRate);
  console.log('Task Completion Rate:', summary.taskCompletionRate);
  console.log('Guidance Accuracy   :', summary.guidanceAccuracy);
}

main().catch((err) => { console.error(err); process.exit(1); });
