/**
 * GuideMe Bridge — Reads GuideMe's actual Shadow DOM output.
 *
 * Responsible for:
 *  1. Opening GuideMe chat (via service worker storage write)
 *  2. Typing + submitting the Khmer prompt into GuideMe's textarea
 *  3. Waiting for and collecting GuideMe's AI response + step card text
 *  4. Filtering out UI chrome noise so only real guidance reaches the interpreter
 */

// ── Noise: strings that are GuideMe UI chrome, NOT AI guidance ───────────
// Kept as a single source of truth — used both at module level and passed
// into page.evaluate so filtering happens at collection time.
const NOISE_EXACT = [
  'guideme ai', 'coach', 'ជជែកថ្មី', 'new chat', 'ឥឡូវនេះ', 'just now',
  'guide me', 'ask anything', 'សួរអ្វីមួយ', 'guideme feature walkthrough',
  'open dashboard', 'minimize', 'close', 'back', 'next', 'skip', 'previous',
  // Initial greeting — not a response to the user's prompt
  'សួស្តី! ខ្ញុំជា guideme ai assistant។ តើខ្ញុំអាចជួយអ្វីអ្នកនៅលើទំព័រនេះ?',
  "hi! i'm your guideme ai assistant. how can i help you on this page?",
  // Pre-loaded catalog tutorial names
  'ចែករំលែក និងកំណត់សិទ្ធិកែប្រែក្នុង google docs',
  'guideme - ការបញ្ចូលតារាងទិន្នន័យ',
  'welcome to guideme', 'google docs share guide',
];

function isNoise(t, noiseExact = NOISE_EXACT) {
  const tl = (t || '').trim().toLowerCase();
  if (tl.length <= 4) return true;
  if (noiseExact.includes(tl)) return true;
  if (/^\d+\s*(សារ|messages?)$/i.test(tl)) return true;  // "2 សារ", "6 messages"
  if (/^\d{1,2}:\d{2}/.test(tl)) return true;             // timestamps "04:45"
  if (/\.\.\.$/.test(tl) && tl.length < 30) return true;  // truncated "ខ្ញុំចង់..."
  if (/^guideme\s*[-–]/i.test(tl)) return true;            // "GuideMe - ..."
  if (/^guideme feature/i.test(tl)) return true;
  return false;
}

export function filterNoise(texts = []) {
  return (texts || []).filter(t => !isNoise(t));
}

// ── Open GuideMe chat ─────────────────────────────────────────────────────
export async function openGuideMeChat(page, timeoutMs = 12000) {
  try {
    // Write auth token + open flag via service worker (has real chrome.storage access)
    const context = page.context();
    const sw = context.serviceWorkers().find(w => w.url().includes('chrome-extension'));

    if (sw) {
      await sw.evaluate(() => {
        chrome.storage.local.set({
          authToken: 'test-token-simulator-2024',
          guideme_is_chat_open: true,
          guideme_onboarding_done: true,
        });
      });
      console.log('  [Bridge] Storage set via service worker');
    } else {
      console.log('  [Bridge] No service worker — skipping storage write');
    }

    // Wait for textarea to appear in Shadow DOM
    const ready = await page.evaluate((timeout) => {
      return new Promise((resolve) => {
        const deadline = Date.now() + timeout;
        const check = () => {
          const shadow = document.querySelector('guideme-tutorial-root')?.shadowRoot;
          if (shadow?.querySelector('textarea')) { resolve(true); return; }
          if (Date.now() > deadline) { resolve(false); return; }
          setTimeout(check, 400);
        };
        check();
      });
    }, timeoutMs);

    console.log(`  [Bridge] Chat textarea ready: ${ready}`);
    return ready;
  } catch (err) {
    console.log(`  [Bridge] openGuideMeChat error: ${err.message?.slice(0, 80)}`);
    return false;
  }
}

// ── Submit prompt into GuideMe's textarea ─────────────────────────────────
export async function submitPromptToGuideMe(page, promptText, timeoutMs = 5000) {
  try {
    const result = await page.evaluate(({ text, timeout }) => {
      return new Promise((resolve) => {
        const deadline = Date.now() + timeout;
        const trySubmit = () => {
          const shadow = document.querySelector('guideme-tutorial-root')?.shadowRoot;
          if (!shadow) { resolve({ ok: false }); return; }
          const textarea = shadow.querySelector('textarea');
          if (!textarea) {
            if (Date.now() > deadline) { resolve({ ok: false }); return; }
            setTimeout(trySubmit, 200);
            return;
          }
          textarea.focus();
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          setter ? setter.call(textarea, text) : (textarea.value = text);
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          setTimeout(() => {
            textarea.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'Enter', code: 'Enter', keyCode: 13,
              bubbles: true, cancelable: true, shiftKey: false,
            }));
            resolve({ ok: true });
          }, 300);
        };
        trySubmit();
      });
    }, { text: promptText, timeout: timeoutMs });

    console.log(`  [Bridge] Prompt submitted: ${result.ok} — "${promptText.slice(0, 50)}"`);
    return result.ok ? promptText : null;
  } catch (err) {
    console.log(`  [Bridge] submitPrompt error: ${err.message?.slice(0, 80)}`);
    return null;
  }
}

// ── Wait for GuideMe's AI response ────────────────────────────────────────
export async function waitForGuideResponse(page, waitMs = 12000, userPrompt = '') {
  console.log(`  [Bridge] Waiting up to ${waitMs / 1000}s for GuideMe response...`);

  const result = await page.evaluate(({ timeout, prompt, noiseExact }) => {
    // Inline noise check — runs inside the browser context
    const isNoiseInline = (t) => {
      const tl = (t || '').trim().toLowerCase();
      if (tl.length <= 4) return true;
      if (noiseExact.includes(tl)) return true;
      if (/^\d+\s*(សារ|messages?)$/i.test(tl)) return true;
      if (/^\d{1,2}:\d{2}/.test(tl)) return true;
      if (/\.\.\.$/.test(tl) && tl.length < 30) return true;
      if (/^guideme\s*[-–]/i.test(tl)) return true;
      if (/^guideme feature/i.test(tl)) return true;
      return false;
    };

    return new Promise((resolve) => {
      const deadline = Date.now() + timeout;
      let lastLen = 0;
      let stable = 0;

      const collect = () => {
        const shadow = document.querySelector('guideme-tutorial-root')?.shadowRoot;
        if (!shadow) {
          if (Date.now() > deadline) resolve({ replied: false, guidanceTexts: [], chatTexts: [], stepCardVisible: false });
          else setTimeout(collect, 500);
          return;
        }

        const stepCard = shadow.querySelector('[class*="step"], [class*="card"], [class*="tooltip"]');
        const stepCardVisible = Boolean(stepCard);

        // Single DOM traversal — collect unique non-noise leaf text nodes
        const texts = new Set();
        const longTexts = []; // potential AI reply sentences

        shadow.querySelectorAll('*').forEach(el => {
          const tag = el.tagName?.toLowerCase();
          if (tag === 'textarea' || tag === 'input' || tag === 'script' || tag === 'style') return;
          const t = (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3)
            ? el.textContent?.trim() : null;
          if (!t) return;
          if (isNoiseInline(t)) return;
          texts.add(t);
          if (t.length > 30 && t.length < 400 && t !== prompt) longTexts.push(t);
        });

        // Step card headings — most reliable per-task guidance signal
        const stepCardTexts = [];
        shadow.querySelectorAll('h2, h3, [class*="title"], [class*="content"]').forEach(el => {
          const t = el.textContent?.trim();
          if (t && t.length > 5 && t.length < 200 && !isNoiseInline(t)) stepCardTexts.push(t);
        });

        const chatTexts = [...new Set([...stepCardTexts, ...longTexts.slice(0, 3)])];
        const currentLen = texts.size;

        if (currentLen > lastLen + 2) { lastLen = currentLen; stable = 0; }
        else stable++;

        const hasContent = stepCardVisible || chatTexts.length > 0 || texts.size > 4;

        // Only resolve early if we have content BEYOND the initial greeting.
        // The greeting alone (texts.size == 2) means the AI hasn't responded yet.
        const hasRealResponse = texts.size > 2 || chatTexts.some(t =>
          t.includes('យល់ហើយ') ||   // "Got it!" — GuideMe starting guide
          t.includes('ចាប់ផ្តើម') ||  // "starting"
          t.includes('ជំហាន') ||       // "step"
          t.includes('ចុច') ||         // "click"
          t.includes('បញ្ចូល') ||      // "enter/fill"
          t.includes('ប្ដូរ') ||       // "change"
          t.includes('upload') ||
          t.includes('save')
        );

        if ((stable >= 3 && hasRealResponse) || Date.now() > deadline) {
          resolve({
            replied: hasContent,
            guidanceTexts: [...texts].slice(0, 25),
            chatTexts: chatTexts.slice(0, 6),
            stepCardVisible,
          });
        } else {
          setTimeout(collect, 500);
        }
      };
      collect();
    });
  }, { timeout: waitMs, prompt: userPrompt, noiseExact: NOISE_EXACT });

  // Second-pass noise filter at module level
  result.guidanceTexts = filterNoise(result.guidanceTexts);
  result.chatTexts     = filterNoise(result.chatTexts);

  console.log(`  [Bridge] Response received: ${result.replied} | StepCard: ${result.stepCardVisible} | Clean texts: ${result.guidanceTexts.length}`);
  if (result.chatTexts?.length) {
    console.log(`  [Bridge] Guidance: "${result.chatTexts[0]?.slice(0, 100)}"`);
  }
  return result;
}

// ── Read active step card text ────────────────────────────────────────────
export async function readActiveStepGuidance(page) {
  try {
    return await page.evaluate(() => {
      const shadow = document.querySelector('guideme-tutorial-root')?.shadowRoot;
      if (!shadow) return '';
      const texts = [];
      shadow.querySelectorAll('h2, h3, p, [class*="title"], [class*="content"]').forEach(el => {
        const t = el.textContent?.trim();
        if (t && t.length > 3 && t.length < 300) texts.push(t);
      });
      return [...new Set(texts)].slice(0, 8).join(' | ');
    });
  } catch {
    return '';
  }
}

// ── Score how well GuideMe's guidance matched expected keywords ───────────
export function scoreGuidanceAccuracy(guidanceTexts, expectedKeywords, chatTexts = []) {
  if (!expectedKeywords?.length) return { accurate: false, matched: [], total: 0, rate: 0 };
  const allTexts = filterNoise([...(guidanceTexts || []), ...(chatTexts || [])]);
  if (!allTexts.length) return { accurate: false, matched: [], total: expectedKeywords.length, rate: 0 };
  const combined = allTexts.join(' ').toLowerCase();
  const matched = expectedKeywords.filter(kw => combined.includes(kw.toLowerCase()));
  return {
    accurate: matched.length > 0,
    matched,
    total: expectedKeywords.length,
    rate: Math.round((matched.length / expectedKeywords.length) * 100),
  };
}
