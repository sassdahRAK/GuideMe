/**
 * GuideMe User Simulation — Main Test Runner
 *
 * Orchestrates:
 *  1. Start local test website (port 7777)
 *  2. Launch isolated Playwright Chromium browser (NO user profile)
 *  3. Optionally load GuideMe extension if the built output exists
 *  4. Run test scenarios (smoke = 5, full = 50+)
 *  5. Save results
 *  6. Shut down cleanly
 *
 * Usage:
 *   node --env-file=.env.test runner.js --mode smoke
 *   node --env-file=.env.test runner.js --mode smoke --headed
 *   node --env-file=.env.test runner.js --mode smoke --runs 3
 *
 * SAFETY: This runner never modifies production files.
 * It uses an isolated browser context (no user profile, no saved passwords).
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/settings.js';
import { SMOKE_TASKS } from './scenarios/smoke-tasks.js';
import { UserSimulator } from './simulator/user-simulator.js';
import {
  openGuideMeChat,
  submitPromptToGuideMe,
  waitForGuideResponse,
  readActiveStepGuidance,
  scoreGuidanceAccuracy,
  filterNoise,
} from './simulator/guideme-bridge.js';
import {
  parseGuidance,
  interpretGuidance,
  mapInstructionToPageAction,
} from './simulator/guidance-interpreter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const mode    = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'smoke';
const headed  = args.includes('--headed');
const runsArg = args.indexOf('--runs');
const runs    = runsArg !== -1 ? parseInt(args[runsArg + 1], 10) : 1;

if (headed) process.env.HEADLESS = 'false';
const HEADLESS = process.env.HEADLESS !== 'false';

const TASKS = mode === 'smoke' ? SMOKE_TASKS : SMOKE_TASKS; // extend for 'full' mode later
console.log(`\n[Runner] Mode: ${mode} | Tasks: ${TASKS.length} | Runs: ${runs} | Headless: ${HEADLESS}`);

// ── Start the test website ────────────────────────────────────────────────
function startTestSite() {
  return new Promise((resolve, reject) => {
    const siteProcess = spawn(
      process.execPath,
      [path.join(__dirname, 'fixtures', 'serve.js')],
      {
        env: { ...process.env, TEST_SITE_PORT: String(config.testSitePort) },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    siteProcess.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      console.log(`[Test Site] ${msg}`);
      if (msg.includes('Serving on')) resolve(siteProcess);
    });

    siteProcess.stderr.on('data', (d) => {
      console.warn(`[Test Site ERR] ${d.toString().trim()}`);
    });

    siteProcess.on('error', reject);
    // Timeout if server doesn't start in 5s
    setTimeout(() => reject(new Error('Test site did not start in 5s')), 5000);
  });
}

// ── Inject GuideMe content script via service worker ─────────────────────
// WXT uses dynamic scripting registration, not static manifest content_scripts.
// On a fresh profile the registration hasn't happened yet, so we inject manually
// via chrome.scripting.executeScript — identical to what the popup fallback does.
async function injectContentScript(page) {
  try {
    const context = page.context();
    const workers = context.serviceWorkers();
    const sw = workers.find(w => w.url().includes('chrome-extension'));
    if (!sw) {
      console.log('  [Runner] No service worker found for injection');
      return false;
    }

    // Get the tab ID for the current page via the service worker
    const tabId = await sw.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.tabs.query({ active: true }, (tabs) => {
          // Find the localhost:7777 tab
          const tab = tabs.find(t => t.url && t.url.includes('localhost:7777'));
          resolve(tab?.id || null);
        });
      });
    });

    if (!tabId) {
      console.log('  [Runner] Could not find tab ID for injection');
      return false;
    }

    // Inject the content script file
    const result = await sw.evaluate(async (tId) => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tId },
          files: ['content-scripts/content.js'],
        });
        return 'injected';
      } catch (err) {
        return 'error: ' + err.message;
      }
    }, tabId);

    console.log(`  [Runner] Scripting injection result: ${result}`);
    return result === 'injected';
  } catch (err) {
    console.log(`  [Runner] injectContentScript error: ${err.message?.slice(0, 80)}`);
    return false;
  }
}

// ── Check if GuideMe extension build exists ───────────────────────────────
function extensionAvailable() {
  const manifestPath = path.join(config.extensionPath, 'manifest.json');
  return existsSync(manifestPath);
}

// ── Launch isolated Playwright browser ───────────────────────────────────
async function launchBrowser() {
  const extAvailable = extensionAvailable();
  console.log(`[Runner] Extension path: ${config.extensionPath}`);
  console.log(`[Runner] Extension available: ${extAvailable}`);

  if (extAvailable) {
    // Load the GuideMe extension — isolated persistent context, NO user profile
    // Extension loading requires a persistent context in Playwright
    console.log('[Runner] Launching Chromium WITH GuideMe extension (unpacked)...');
    const profileDir = path.join(__dirname, '.playwright-profile');
    mkdirSync(profileDir, { recursive: true });

    const context = await chromium.launchPersistentContext(
      profileDir,
      {
        headless: false, // extensions require non-headless
        args: [
          `--disable-extensions-except=${config.extensionPath}`,
          `--load-extension=${config.extensionPath}`,
          '--no-sandbox',
          '--disable-dev-shm-usage',
        ],
        slowMo: 0,
        // Use a generous default timeout for page operations
        timeout: config.timeoutMs,
        // Ignore HTTPS errors on local test site
        ignoreHTTPSErrors: true,
      }
    );
    return { browser: context, isContext: true, hasExtension: true };
  } else {
    // No extension built — run in pure Playwright mode
    console.log('[Runner] ⚠️  Extension not found — running WITHOUT GuideMe (baseline mode)');
    console.log('[Runner]    Build the extension first: npm run build (from GuideMe root)');
    const browser = await chromium.launch({
      headless: HEADLESS,
      slowMo: 0,
    });
    return { browser, isContext: false, hasExtension: false };
  }
}

// ── Save raw result for a single task ─────────────────────────────────────
function saveRawResult(result) {
  const rawDir = path.join(config.resultsDir, 'raw');
  mkdirSync(rawDir, { recursive: true });
  const filePath = path.join(rawDir, `${result.taskId}.json`);
  writeFileSync(filePath, JSON.stringify(result, null, 2));
  console.log(`  [Runner] Result saved: ${filePath}`);
}

// ── Save failure artifacts ─────────────────────────────────────────────────
async function saveFailureArtifacts(page, taskId, errorText, guidanceJson, actionsJson) {
  const failDir = path.join(config.resultsDir, 'failures', taskId);
  mkdirSync(failDir, { recursive: true });

  try {
    await page.screenshot({ path: path.join(failDir, 'screenshot.png'), fullPage: false });
  } catch { /* ignore */ }

  writeFileSync(path.join(failDir, 'error.txt'), errorText || 'No error text');
  writeFileSync(path.join(failDir, 'guidance.json'), JSON.stringify(guidanceJson || [], null, 2));
  writeFileSync(path.join(failDir, 'action.json'), JSON.stringify(actionsJson || [], null, 2));
  console.log(`  [Runner] Failure artifacts saved to: ${failDir}`);
}

// ── Run a single task ─────────────────────────────────────────────────────
async function runTask(browser, task, hasExtension, runIndex = 1) {
  const taskId = runIndex > 1 ? `${task.id}_run${runIndex}` : task.id;
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`  TASK: ${taskId}`);
  console.log(`  Prompt: ${task.userPrompt}`);
  console.log(`${'─'.repeat(56)}`);

  const page = await browser.newPage();
  const simulator = new UserSimulator(page, {
    thinkDelayMs: config.thinkDelayMs,
    maxSteps: task.maxSteps || config.maxStepsPerTask,
  });

  const startTime = Date.now();
  let taskCompleted = false;
  let guidanceReceived = false;
  let guidanceChatOpened = false;
  let failureReason = null;
  let guidanceSteps = [];
  let guidanceAccuracyScore = null;
  let guidanceResponse = null;
  let extensionLoaded = false;
  let potentialProductionIssue = null;

  try {
    // ── 1. Clear previous GuideMe state, then navigate ───────────────────
    // Clear BEFORE navigation so content script mounts with clean storage.
    try {
      const sw = page.context().serviceWorkers().find(w => w.url().includes('chrome-extension'));
      if (sw) {
        await sw.evaluate(() => {
          chrome.storage.local.remove([
            'guideme_chat_messages', 'guideme_chat_tabs',
            'guideme_active_guide_state', 'guideme_active_tutorial_session',
          ]);
        });
      }
    } catch { /* non-critical */ }

    await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {});
    await page.goto(task.groundTruth.startPage, {
      waitUntil: 'domcontentloaded',
      timeout: config.timeoutMs,
    });
    await simulator.think(400);
    await simulator.screenshot(taskId, '01_page_loaded');

    // ── 2. Detect GuideMe extension & inject content script ──────────────
    if (hasExtension) {
      // WXT registers content scripts dynamically — we need to inject manually
      // via the service worker's scripting API, same as the popup fallback path.
      const injected = await injectContentScript(page);
      console.log(`  [Runner] Content script injection: ${injected}`);

      // Now wait for the shadow root to appear
      try {
        await page.waitForFunction(
          () => document.querySelector('guideme-tutorial-root') !== null,
          { timeout: 8000 }
        );
        extensionLoaded = true;
        console.log('  [Runner] ✓ GuideMe extension detected');
      } catch {
        await simulator.think(1000);
        extensionLoaded = await page.evaluate(
          () => document.querySelector('guideme-tutorial-root') !== null
        ).catch(() => false);
        console.log(`  [Runner] ${extensionLoaded ? '✓' : '✗'} GuideMe extension ${extensionLoaded ? 'detected (delayed)' : 'not detected'}`);
      }
    }

    // ── 3. STEP A: Open GuideMe chat and submit the Khmer task prompt ─────
    // This is the REAL test — ask GuideMe for help, just like a real user would.
    console.log(`  [Runner] Asking GuideMe: "${task.userPrompt}"`);

    if (extensionLoaded) {
      await simulator.think(400);
      guidanceChatOpened = await openGuideMeChat(page);

      if (guidanceChatOpened) {
        await simulator.think(500);
        const submitted = await submitPromptToGuideMe(page, task.userPrompt);

        if (submitted) {
          await simulator.screenshot(taskId, '02_prompt_submitted');

          // ── 3b. Wait for GuideMe's AI response ───────────────────────────
          const response = await waitForGuideResponse(page, 12000, task.userPrompt);
          guidanceReceived = response.replied;
          // Store the full response for the execution step
          guidanceResponse = response;

          if (response.guidanceTexts?.length) {
            // Store only non-noise guidance texts
            const cleanGuidance = filterNoise(response.guidanceTexts);
            const cleanChat     = filterNoise(response.chatTexts || []);
            guidanceSteps = cleanGuidance.map(t => ({ text: t, source: 'chat_response' }));
            guidanceSteps.push(...cleanChat.map(t => ({ text: t, source: 'chat_bubble' })));
          }

          // ── 3c. Score guidance accuracy against expected keywords ─────────
          guidanceAccuracyScore = scoreGuidanceAccuracy(
            response.guidanceTexts,
            task.expectedGuidanceKeywords,
            response.chatTexts || []
          );
          console.log(`  [Runner] Guidance accuracy: ${guidanceAccuracyScore.rate}% (matched: ${guidanceAccuracyScore.matched.join(', ') || 'none'})`);

          await simulator.screenshot(taskId, '03_guidance_received');
        }
      } else {
        console.log('  [Runner] Could not open GuideMe chat — proceeding in baseline mode');
        failureReason = 'GuideMe chat widget could not be opened';
      }
    } else {
      console.log('  [Runner] Extension not loaded — baseline mode (no GuideMe guidance)');
      failureReason = 'Extension not loaded';
    }

    // ── 4. STEP B: Simulate the user FOLLOWING whatever guidance was given ─
    // The simulator parses GuideMe's actual guidance and acts on it.
    // No hardcoded knowledge — if GuideMe didn't say it, the simulator won't do it.
    await simulator.think(400);

    const executionResult = await executeTaskFromGuidance(
      simulator, task, page, guidanceSteps, guidanceResponse
    );

    taskCompleted = executionResult.completed;
    if (!taskCompleted && executionResult.reason) {
      failureReason = failureReason || executionResult.reason;
    }

    // ── 5. Read final guidance state after task completion ────────────────
    const finalGuidance = await readActiveStepGuidance(page);
    if (finalGuidance) {
      guidanceSteps.push({ text: finalGuidance, source: 'final_state' });
    }

    // ── 6. DOM verify task completion ─────────────────────────────────────
    if (taskCompleted) {
      try {
        const el = page.locator(task.groundTruth.successIndicator).first();
        const visible = await el.isVisible({ timeout: 3000 }).catch(() => false);
        const savedAttr = await el.getAttribute('data-saved').then(v => v === 'true').catch(() => false);
        const changedAttr = await el.getAttribute('data-changed').then(v => v === 'true').catch(() => false);
        if (visible || savedAttr || changedAttr) {
          taskCompleted = true;
          console.log(`  [Runner] ✅ DOM verification passed`);
        }
      } catch { /* keep taskCompleted as-is */ }
    }

    await simulator.screenshot(taskId, taskCompleted ? '99_completed' : '99_failed');

  } catch (err) {
    taskCompleted = false;
    failureReason = err.message || String(err);
    console.error(`  [Runner] ❌ Task error: ${failureReason.slice(0, 120)}`);
    await saveFailureArtifacts(page, taskId, failureReason, guidanceSteps, simulator.actionLog);
  } finally {
    await page.close();
  }

  const durationMs = Date.now() - startTime;
  console.log(`  [Runner] Duration: ${durationMs}ms | Completed: ${taskCompleted} | Guidance: ${guidanceReceived}`);

  const result = {
    taskId,
    task: {
      id: task.id,
      userPrompt: task.userPrompt,
      taskType: task.taskType,
      expectedGuidanceKeywords: task.expectedGuidanceKeywords,
    },
    extensionLoaded,
    guidanceChatOpened,
    guidanceReceived,
    guidanceAccuracyScore,
    guidanceSteps,
    taskCompleted,
    failureReason: failureReason || null,
    recoveryAttempted: false,
    recoveredAfterError: false,
    actions: simulator.actionLog,
    durationMs,
    potentialProductionIssue,
    timestamp: new Date().toISOString(),
  };

  saveRawResult(result);
  return result;
}

// ── Guidance-driven task executor ────────────────────────────────────────
//
// The simulator receives GuideMe's actual guidance text and attempts to
// follow it. It does NOT have hardcoded knowledge of what to do.
//
// Failure modes that produce realistic non-100% metrics:
//   • No guidance received → task fails immediately
//   • Guidance too vague (low confidence) → 55% chance simulator is confused
//   • Guidance missing required steps → partial completion → fail
//   • GuideMe points to wrong element → click fails → error logged
//
async function executeTaskFromGuidance(simulator, task, page, guidanceSteps, guidanceResponse) {
  // ── Step 1: Parse what GuideMe actually said ──────────────────────────
  const allGuidanceTexts = guidanceResponse
    ? [...(guidanceResponse.guidanceTexts || []), ...(guidanceResponse.chatTexts || [])]
    : [];

  const instructions = parseGuidance(
    guidanceResponse?.guidanceTexts || [],
    guidanceResponse?.chatTexts || []
  );
  const { canAct, primaryInstruction, simulatorConfusion } = interpretGuidance(
    instructions, task.taskType
  );

  console.log(`  [Interpreter] Instructions parsed: ${instructions.length} | canAct: ${canAct}`);
  if (primaryInstruction) {
    console.log(`  [Interpreter] Best instruction: ${primaryInstruction.action} → ${primaryInstruction.target} (${primaryInstruction.confidence})`);
  }
  if (simulatorConfusion) {
    console.log(`  [Interpreter] ⚠ Confusion: ${simulatorConfusion}`);
    simulator.logAction('confused', { reason: simulatorConfusion }, 'failed');
    return { completed: false, reason: simulatorConfusion };
  }

  if (!canAct) {
    simulator.logAction('no_guidance', { task: task.id }, 'failed');
    return { completed: false, reason: 'No actionable guidance from GuideMe' };
  }

  // ── Step 2: Execute each required action based on task type ──────────
  // For each required action in ground truth, check if GuideMe's guidance
  // covered it. If not → simulator doesn't know to do it → partial fail.
  const requiredActions = task.groundTruth.requiredActions || [];
  let allActionsSucceeded = true;
  let actionsAttempted = 0;

  for (const required of requiredActions) {
    // Check: did GuideMe's guidance cover this action?
    const coveringInstruction = instructions.find(inst => {
      const pageAction = mapInstructionToPageAction(inst);
      if (!pageAction) return false;

      // Does the instruction's target match what this action needs?
      if (required.type === 'fill') {
        return pageAction.type === 'fill' &&
          pageAction.hints.some(h =>
            required.selector?.toLowerCase().includes(h.toLowerCase()) ||
            allGuidanceTexts.join(' ').toLowerCase().includes(h.toLowerCase())
          );
      }
      if (required.type === 'click') {
        return pageAction.type === 'click' || pageAction.type === 'navigate';
      }
      return false;
    });

    if (!coveringInstruction && required.type !== 'clear') {
      // GuideMe didn't mention this step → simulator doesn't know to do it
      console.log(`  [Interpreter] ⚠ Action not covered by guidance: ${required.type} on ${required.selector}`);
      simulator.logAction('action_not_guided', {
        type: required.type,
        selector: required.selector
      }, 'failed');
      allActionsSucceeded = false;
      continue;
    }

    // Map the instruction to a visible page interaction
    const pageAction = coveringInstruction
      ? mapInstructionToPageAction(coveringInstruction)
      : null;

    actionsAttempted++;

    // ── Perform the action using only visible hints (not ground truth selectors) ──
    let actionOk = false;

    if (required.type === 'fill' && pageAction?.type === 'fill') {
      // Try each visible hint in order
      for (const hint of (pageAction.hints || [])) {
        actionOk = await simulator.fillByPlaceholder(hint, required.value || 'TestValue123');
        if (actionOk) break;
      }
      if (!actionOk) {
        // Simulator couldn't find the field from the guidance hint
        simulator.logAction('fill_not_found', { hints: pageAction?.hints }, 'failed');
        allActionsSucceeded = false;
      }
    } else if (required.type === 'click' && pageAction) {
      for (const hint of (pageAction.hints || [])) {
        actionOk = await simulator.clickByText(hint);
        if (actionOk) break;
      }
      if (!actionOk) {
        simulator.logAction('click_not_found', { hints: pageAction?.hints }, 'failed');
        allActionsSucceeded = false;
      }
    } else if (required.type === 'clear') {
      // Clear is implicit when filling — skip
      actionOk = true;
    }

    await simulator.think(300);
  }

  // ── Step 3: Check DOM for success signal ─────────────────────────────
  if (allActionsSucceeded && actionsAttempted > 0) {
    try {
      await page.waitForSelector(
        `${task.groundTruth.successIndicator}, .message-area.success`,
        { timeout: 5000 }
      );
      return { completed: true, reason: null };
    } catch {
      // Success indicator didn't appear — maybe GuideMe's guidance was incomplete
      return {
        completed: actionsAttempted >= requiredActions.filter(a => a.type !== 'clear').length,
        reason: actionsAttempted > 0 ? null : 'No actions were executed'
      };
    }
  }

  return {
    completed: false,
    reason: `${actionsAttempted}/${requiredActions.filter(a => a.type !== 'clear').length} actions attempted but task incomplete — guidance may have been inaccurate or missing required steps`
  };
}

// ── Old hardcoded strategies removed — all tasks now use executeTaskFromGuidance ──

// ── Main orchestrator ─────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '='.repeat(56));
  console.log('  GuideMe User Simulation Test');
  console.log(`  Mode: ${mode.toUpperCase()} | ${TASKS.length} tasks × ${runs} run(s)`);
  console.log('='.repeat(56));

  // Safety check — verify we're not accidentally in production paths
  const cwd = process.cwd();
  console.log(`\n[Runner] Working directory: ${cwd}`);
  console.log(`[Runner] Results dir: ${config.resultsDir}`);
  console.log(`[Runner] Test site: ${config.testSiteUrl}`);

  // Ensure results directory exists
  mkdirSync(path.join(config.resultsDir, 'raw'), { recursive: true });

  // Start test website
  console.log('\n[Runner] Starting test website...');
  let siteProcess;
  try {
    siteProcess = await startTestSite();
  } catch (err) {
    console.error(`[Runner] Failed to start test site: ${err.message}`);
    process.exit(1);
  }

  // Launch isolated browser
  let browserCtx;
  try {
    browserCtx = await launchBrowser();
  } catch (err) {
    console.error(`[Runner] Failed to launch browser: ${err.message}`);
    siteProcess?.kill();
    process.exit(1);
  }

  const { browser, hasExtension } = browserCtx;
  const allResults = [];

  try {
    for (let run = 1; run <= runs; run++) {
      if (runs > 1) console.log(`\n[Runner] ── Run ${run}/${runs} ──`);

      for (const task of TASKS) {
        const result = await runTask(browser, task, hasExtension, runs > 1 ? run : 1);
        allResults.push(result);
      }
    }
  } finally {
    // Clean shutdown — never kills unrelated processes
    console.log('\n[Runner] Shutting down...');
    try { await browser.close(); } catch { /* ignore */ }
    siteProcess?.kill('SIGTERM');
  }

  // Print final summary
  const passed = allResults.filter(r => r.taskCompleted).length;
  const total = allResults.length;
  console.log('\n' + '='.repeat(56));
  console.log(`  SUMMARY: ${passed}/${total} tasks completed`);
  console.log(`  Run: node evaluator/evaluate.js  for full metrics`);
  console.log('='.repeat(56) + '\n');

  process.exit(passed === total ? 0 : 1);
}

main().catch(err => {
  console.error('[Runner] Fatal error:', err);
  process.exit(1);
});
