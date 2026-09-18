import { useEffect, useState, useRef } from 'react';
// NOTE: DynamicPageAnalyzer / IntentRegistry are deliberately NOT imported —
// the local heuristic fallback they powered was removed so AI generation
// failures surface a real error instead of a silent lower-quality guide.
import { TutorialEngine, GeminiDomAnalyzer, TtsRegistry, ExtensionMessageAction, Language, EngineEvent, DEMO_MODE_ONLY_HARDCODED } from '@guideme/engine';
import { ChromeAdapter } from '@guideme/chrome-adapter';
import { EventLog } from '@guideme/reporting';
import { TUTORIAL_CATALOG, getTutorialsForUrl } from '../../../src/catalog.ts';
import { matchHardcodedPromptGuide } from '../../../src/hardcoded-prompt-guides.js';
import { saveStepProgress } from '../../../src/lib/progress-sync.ts';
// import { getCapturedStepStorageKey, createCapturedTutorial } from './useCaptureMode.js';

/**
 * Returns a deterministic storage key for a captured step target on a given URL.
 */
function getCapturedStepStorageKey(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    const slug = (hostname + pathname).replace(/[^a-z0-9]/gi, '_').slice(0, 80);
    return `guideme_captured_step_${slug}`;
  } catch {
    return 'guideme_captured_step_default';
  }
}

/**
 * Wraps a captured DOM target into a minimal one-step tutorial object
 * that the engine can start directly.
 */
function createCapturedTutorial(target: any) {
  return {
    id: 'captured_' + Date.now(),
    name: { km: 'ជំហានដែលបានចាប់', en: 'Captured Step' },
    description: { km: '', en: '' },
    matchUrls: ['*'],
    steps: [
      {
        id: 'captured_step_1',
        action: {
          type: 'click',
          title: { km: 'ចុចទីនេះ', en: 'Click here' },
          content: { km: 'ចុចលើធាតុដែលបានចាប់', en: 'Click on the captured element' },
        },
        target,
      },
    ],
  };
}

/**
 * Module-level cache for AI options so the chrome.storage round-trip
 * (1-5 ms) is paid at most once per settings change, not on every prompt.
 * Invalidated via chrome.storage.onChanged whenever any relevant key changes.
 */
let _aiOptionsCache = null;
const _AI_OPTION_KEYS = [
  'guideme_ai_provider',
  'guideme_gemini_api_key',
  'guideme_gemini_model',
  'guideme_ai_preset',
  'guideme_ai_endpoint',
  'guideme_ai_api_key',
  'guideme_ai_model',
  'guideme_backend_url',
];
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes) => {
    if (_AI_OPTION_KEYS.some((k) => k in changes)) {
      _aiOptionsCache = null;
    }
  });
}

/**
 * Module-level pre-warmed DOM snapshot. The popup fires GUIDEME_PREWARM_DOM
 * the moment the user submits a prompt (in parallel with validate-intent),
 * so the synchronous DOM walk is already done by the time generate-steps runs.
 */
let _prewarmedDomElements = null;

/**
 * Resolves AI provider credentials and options dynamically from storage or
 * environment variables. Results are cached at module level and invalidated
 * automatically when storage changes.
 */
async function resolveAiOptions(engineInstance: any) {
  // Return cached options immediately — language is the only runtime-variable
  // field so we patch it in without re-reading storage.
  if (_aiOptionsCache) {
    return {
      ..._aiOptionsCache,
      language: engineInstance?.getLanguage ? engineInstance.getLanguage() : 'km',
    };
  }

  let provider = import.meta.env?.WXT_AI_PROVIDER || 'openai';
  let geminiKey = import.meta.env?.WXT_GEMINI_API_KEY || import.meta.env?.VITE_GEMINI_API_KEY || '';
  let geminiModel = '';
  let aiPreset = '';
  let aiEndpoint = '';
  let aiApiKey = '';
  let aiModel = '';
  let backendUrl = (import.meta.env?.WXT_API_URL) || '';

  if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
    try {
      const stored = (await chrome.storage.local.get(_AI_OPTION_KEYS)) as Record<string, any>;
      if (stored?.guideme_ai_provider) provider = String(stored.guideme_ai_provider);
      if (stored?.guideme_gemini_api_key) geminiKey = String(stored.guideme_gemini_api_key);
      if (stored?.guideme_gemini_model) geminiModel = String(stored.guideme_gemini_model);
      if (stored?.guideme_ai_preset) aiPreset = String(stored.guideme_ai_preset);
      if (stored?.guideme_ai_endpoint) aiEndpoint = String(stored.guideme_ai_endpoint);
      if (stored?.guideme_ai_api_key) aiApiKey = String(stored.guideme_ai_api_key);
      if (stored?.guideme_ai_model) aiModel = String(stored.guideme_ai_model);
      if (stored?.guideme_backend_url) backendUrl = String(stored.guideme_backend_url);
    } catch {
      // Extension context may be invalidated if extension was recently rebuilt/reloaded
      console.warn('[GuideMe] Could not read chrome.storage (extension context reloaded). Using environment fallback.');
    }
  }

  // Store everything except language (which varies per call)
  _aiOptionsCache = { provider, geminiApiKey: geminiKey, geminiModel, aiPreset, aiEndpoint, aiApiKey, aiModel, backendUrl };

  return {
    ..._aiOptionsCache,
    language: engineInstance?.getLanguage ? engineInstance.getLanguage() : 'km',
  };
}

function normalizeTargetHint(value: any): string {
  if (value && typeof value === 'object') {
    value = value.en || value.km || '';
  }
  return String(value || '')
    .replace(/^\s*(click|open|select|choose|press|tap)\s+/i, '')
    .replace(/\s+(menu|button|link|item|tab|option|control)\s*$/i, '')
    .replace(/^\s*(the|a|an)\s+/i, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Backend step generation can return a broad selector even when the DOM
 * candidate list contains a stable selector for the same visible control.
 * Re-bind those steps before passing them to the engine.
 */
function hydrateGeneratedTargets(tutorial: any, domElements: any[]) {
  if (!tutorial?.steps || !Array.isArray(domElements)) return tutorial;

  const isGenericSelector = (selector: string) => /^(button|div|a|input|span|select|textarea|p)$/i.test((selector || '').trim());

  for (const step of tutorial.steps) {
    const target = step?.target;
    if (!target) continue;

    const explicitTargetText = normalizeTargetHint(target.text);
    const actionHint = normalizeTargetHint(step.action?.title || step.title);
    const usableActionHint = /^(here|this|element|target|step)$/i.test(actionHint) ? '' : actionHint;
    const targetText = usableActionHint || explicitTargetText;
    const explicitTargetAria = normalizeTargetHint(target.ariaLabel);
    const targetAria = explicitTargetAria;
    const targetCss = target.css || '';
    const cssCandidate = targetCss && domElements.find((item) => (
      item.selector === targetCss &&
      (!targetText || normalizeTargetHint(item.text) === targetText) &&
      (!explicitTargetAria || normalizeTargetHint(item.ariaLabel) === explicitTargetAria)
    ));
    const findSemanticCandidate = (hint: string) => domElements.find((item) => (
      (target.testId && item.testId === target.testId) ||
      (targetAria && normalizeTargetHint(item.ariaLabel) === targetAria) ||
      (hint && normalizeTargetHint(item.text) === hint)
    ));
    let candidate = cssCandidate || findSemanticCandidate(targetText);
    if (!candidate && explicitTargetText && explicitTargetText !== targetText) {
      candidate = findSemanticCandidate(explicitTargetText);
    }

    if (!candidate && targetCss && !isGenericSelector(targetCss)) {
      candidate = domElements.find((item) => item.selector === targetCss);
    }

    if (!candidate) continue;
    if (candidate.selector && (
      !targetCss ||
      isGenericSelector(targetCss) ||
      (!isGenericSelector(candidate.selector) && candidate.selector !== targetCss)
    )) {
      target.css = candidate.selector;
    }
    if (!target.testId && candidate.testId) target.testId = candidate.testId;
    if (!target.ariaLabel && candidate.ariaLabel) target.ariaLabel = candidate.ariaLabel;
    if (candidate.text && (!target.text || usableActionHint)) target.text = candidate.text;
  }

  // Never allow a broad generated selector to spotlight an arbitrary visible
  // element when the model supplied a meaningful action label.
  for (const step of tutorial.steps) {
    const target = step?.target;
    if (!target || target.text) continue;
    const inferredText = normalizeTargetHint(step.action?.title || step.title);
    if (!inferredText || /^(this element|element|target|step)$/i.test(inferredText)) continue;
    if (isGenericSelector(target.css)) target.text = inferredText;
  }

  return tutorial;
}

/**
 * Click validation runs during capture phase, before the host application's
 * own click handler has opened menus or dialogs. Give the host a chance to
 * finish that state transition before scanning the DOM again.
 */
function waitForHostUiSettled(): Promise<void> {
  return new Promise((resolve) => {
    const nextFrame = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (callback: () => void) => setTimeout(callback, 16);
    let settled = false;
    let minimumDelayComplete = false;
    let quietTimer: ReturnType<typeof setTimeout> | null = null;
    const maxTimer = setTimeout(finish, 1200);

    const cleanup = () => {
      clearTimeout(maxTimer);
      if (quietTimer) clearTimeout(quietTimer);
      observer?.disconnect();
    };

    function finish() {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    }

    const scheduleQuietFinish = () => {
      if (!minimumDelayComplete) return;
      if (quietTimer) clearTimeout(quietTimer);
      // 250ms quiet window — long enough for CSS transitions (typically 200–300ms)
      // to finish painting before the DOM snapshot is taken for AI generation.
      quietTimer = setTimeout(finish, 250);
    };

    const observer = typeof MutationObserver !== 'undefined' && typeof document !== 'undefined'
      ? new MutationObserver(scheduleQuietFinish)
      : null;
    observer?.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    nextFrame(() => {
      nextFrame(() => {
        // 400ms minimum gives standard CSS dropdown/menu animations (200–350ms)
        // time to complete before we allow the quiet timer to schedule a finish.
        // Previously 180ms — too short for animated dropdowns, causing the DOM
        // snapshot to capture elements with opacity:0 or zero bounding boxes.
        setTimeout(() => {
          minimumDelayComplete = true;
          scheduleQuietFinish();
        }, 400);
      });
    });
  });
}

/**
 * Calls the backend Stage 2 LLM to generate guide steps. Throws a
 * user-facing error on any failure (no backend configured, network error,
 * timeout, empty response) instead of silently substituting a local
 * heuristic guide — a failure should be visible, not disguised as a result.
 */
async function generateGuideWithFallback(
  prompt: string,
  aiOptions: any,
  engineInstance: any,
  generationOptions: any = {}
) {
  const baseUrl = aiOptions.backendUrl;
  let tutorial: any = null;
  let backendError: any = null;
  const backendTimeoutMs = 15000;

  // Try backend Stage 2 LLM first
  if (baseUrl) {
    let timedOut = false;
    let timeoutId;
    try {
      // Use pre-warmed snapshot if available (populated by GUIDEME_PREWARM_DOM
      // which the popup fires in parallel with validate-intent), otherwise
      // extract synchronously now.
      const domElements = _prewarmedDomElements || GeminiDomAnalyzer.extractInteractiveDom(document, 400);
      _prewarmedDomElements = null; // consume — next call will re-extract fresh

      const requestBody = JSON.stringify({
        prompt,
        elements: domElements,
        language: engineInstance?.getLanguage ? engineInstance.getLanguage() : 'km',
        currentUrl: window.location.href,
        mode: generationOptions.mode || 'initial',
        completedActions: generationOptions.completedActions || [],
        // Structured intent resolved earlier by /api/ai/assistant-chat
        // (targetQuery/action/role/category) — forwarded as an optional
        // grounding hint instead of being silently dropped (GM-017).
        intent: generationOptions.intent || null,
      });

      timeoutId = setTimeout(() => { timedOut = true; }, backendTimeoutMs);

      // Route through the background service worker so Chrome's Private Network
      // Access policy doesn't block calls to loopback (localhost) from public
      // page origins. The background runs in the extension origin and is
      // allowed to reach loopback freely.
      const proxyRes = await new Promise((resolve, reject) => {
        try {
          chrome.runtime.sendMessage(
            {
              action: 'GUIDEME_PROXY_FETCH',
              payload: {
                url: `${baseUrl.replace(/\/$/, '')}/api/ai/generate-steps`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: requestBody,
              },
            },
            (res) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(res);
              }
            }
          );
        } catch (err) {
          reject(err);
        }
        // Mirror the timeout so the promise doesn't hang forever
        setTimeout(() => reject(Object.assign(new Error('timeout'), { _timeout: true })), backendTimeoutMs + 500);
      });

      if (timedOut || proxyRes?._timeout) {
        timedOut = true;
        throw new Error('timeout');
      }

      // Treat proxy errors (background unreachable, network error) as fetch failures
      if (!proxyRes || proxyRes.error) {
        throw new TypeError(proxyRes?.error || 'Failed to fetch');
      }

      /**
       * The generate-steps endpoint now responds with text/event-stream (SSE).
       * The body looks like:
       *   data: {"tutorial":{...}}\n\ndata: [DONE]\n\n
       * Parse the first non-[DONE] data: line as JSON.
       * Falls back to plain JSON.parse for non-SSE responses (Gemini path,
       * or any future change back to plain JSON).
       */
      const parseSseOrJson = (text) => {
        if (!text) throw new SyntaxError('Empty response body');
        // Try SSE first — find first data: line that is not [DONE]
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          return JSON.parse(payload);
        }
        // Fallback: plain JSON body (non-streaming response)
        return JSON.parse(text);
      };

      // Build a response-like object from the proxy's text body
      const res = {
        ok: proxyRes.ok,
        status: proxyRes.status,
        json: () => Promise.resolve(parseSseOrJson(proxyRes.body)),
        text: () => Promise.resolve(proxyRes.body),
      };

      if (res.ok) {
        const data = await res.json();
        if (data?.done) {
          tutorial = { id: `completed-${Date.now()}`, steps: [], done: true };
          console.log(`[GuideMe] Backend confirmed goal completion for "${prompt}".`);
        } else if (data?.tutorial?.steps?.length > 0) {
          tutorial = data.tutorial;
          hydrateGeneratedTargets(tutorial, domElements);
          // Backend may omit matchUrls — add default so SchemaValidator passes
          if (!tutorial.matchUrls) tutorial.matchUrls = ['<all_urls>'];
          // Stringified inline (title + target selector per step) so a plain
          // copy-paste always shows the actual selectors, not a collapsed
          // "Array(1)" — this is what makes a self-referential or mistargeted
          // selector (e.g. one that accidentally matches GuideMe's own overlay)
          // visible immediately, before the overlay even mounts.
          console.log(`[GuideMe] Backend generate-steps returned ${tutorial.steps.length} steps for "${prompt}": ${JSON.stringify(
            tutorial.steps.map((s: any) => ({ title: s.title, target: s.target }))
          )}`);
        } else {
          console.warn('[GuideMe] Backend generate-steps returned no/empty steps:', JSON.stringify(data).slice(0, 300));
          throw Object.assign(
            new Error(data?.error || 'The AI backend could not generate steps for this page. Please try rephrasing your request.'),
            { _guidemeUserFacing: true }
          );
        }
      } else {
        const body = (proxyRes.body || '').slice(0, 300);
        console.warn(`[GuideMe] Backend generate-steps HTTP ${res.status}:`, body);
        throw new Error(
          `The AI server returned an error (HTTP ${res.status}). Please check your backend and try again.`
        );
      }
    } catch (err: any) {
      // Build a specific, user-facing diagnostic — thrown below once we've
      // finished normalizing whichever failure this was (timeout, connection
      // lost, generic network error) into a clear message. No silent local
      // fallback: an AI failure must surface a real, specific error to the
      // user, never a quietly-substituted lower-quality guide.
      if (err._guidemeUserFacing) {
        backendError = err;
      } else {
        const msg = err?.message || '';
        if (timedOut || err._timeout || msg === 'timeout') {
          backendError = Object.assign(
            new Error(`The AI backend did not respond within ${backendTimeoutMs / 1000} seconds. Please check that your backend server is running and try again.`),
            { _guidemeUserFacing: true }
          );
        } else if (msg.includes('Could not establish connection') || msg.includes('Extension context')) {
          // Background service worker unreachable (extension context invalidated, etc.)
          backendError = Object.assign(
            new Error('The extension lost its connection to the background worker. Please reload the page and try again.'),
            { _guidemeUserFacing: true }
          );
        } else {
          backendError = Object.assign(
            new Error(`Failed to reach the AI backend: ${msg || 'unknown error'}. Please try again.`),
            { _guidemeUserFacing: true }
          );
        }
      }
      console.warn('[GuideMe] Backend generate-steps failed:', backendError.message);
    } finally {
      clearTimeout(timeoutId);
    }
  } else {
    backendError = Object.assign(
      new Error('No AI backend is configured. Please set a backend URL in settings and try again.'),
      { _guidemeUserFacing: true }
    );
  }

  // No silent substitute: if the AI backend didn't produce a tutorial, tell
  // the user exactly why instead of quietly swapping in the local heuristic
  // DynamicPageAnalyzer as if it were a real result.
  if ((!tutorial || !tutorial.steps?.length) && backendError) {
    throw backendError;
  }

  return tutorial;
}

export interface UseContentBridgeOptions {
  setTheme?: (theme: string) => void;
  setIsPromptOpen: (open: boolean) => void;
  setIsOnboardingOpen: (open: boolean) => void;
  setIsDashboardOpen: (open: boolean) => void;
  setIsFullPopupOpen: (open: boolean) => void;
  setIsCaptureMode?: (open: boolean) => void;
  setIsDismissed?: (dismissed: boolean) => void;
}

/**
 * Custom hook orchestrating TutorialEngine lifecycle,
 * runtime messaging with popup/background/PiP, and session persistence.
 */
export function useContentBridge({
  setTheme,
  setIsPromptOpen,
  setIsOnboardingOpen,
  setIsDashboardOpen,
  setIsFullPopupOpen,
  setIsCaptureMode,
  setIsDismissed,
}: UseContentBridgeOptions) {
  const [engineState, setEngineState] = useState<any>(() => ({
    isActive: false,
    isCompleted: false,
    language: Language.KM,
  }));

  const [availableTutorials, setAvailableTutorials] = useState<any[]>(() =>
    typeof window !== 'undefined' ? getTutorialsForUrl(window.location.href) : []
  );

  const engineRef = useRef<TutorialEngine | null>(null);
  const dynamicGuideRef = useRef<{ prompt: string; completed: string[]; loading: boolean; incremental?: boolean }>({ prompt: '', completed: [], loading: false });

  useEffect(() => {
    const adapter = new ChromeAdapter();
    const ttsProvider = TtsRegistry.fromEnv(import.meta.env);

    // Apply the user's Settings-tab voice preference (Web Speech fallback
    // only — the backend Edge-TTS path uses its own fixed neural voice).
    // Read once on mount, then track live edits made while a tutorial is
    // already running so the dashboard's Settings tab takes effect
    // immediately instead of requiring a reload.
    const ttsProviderAny = ttsProvider as any;
    if (typeof ttsProviderAny.setVoiceName === 'function' && typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['guideme_voice_speaker']).then((res) => {
        if (res?.guideme_voice_speaker) ttsProviderAny.setVoiceName(res.guideme_voice_speaker);
      }).catch(() => {});
    }
    const onVoiceSettingChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes.guideme_voice_speaker && typeof ttsProviderAny.setVoiceName === 'function') {
        ttsProviderAny.setVoiceName(changes.guideme_voice_speaker.newValue || '');
      }
    };
    chrome.storage?.onChanged?.addListener(onVoiceSettingChanged);

    const engine = new TutorialEngine({
      adapter,
      ttsProvider,
      beforeNextStep: async ({ step, stepIndex, tutorial }: any) => {
        const context = dynamicGuideRef.current;
        if (!context.prompt || context.loading || context.incremental === false) return;

        context.loading = true;
        const stepLabel = step?.action?.title || step?.title || `step ${stepIndex + 1}`;
        context.completed.push(typeof stepLabel === 'object' ? (stepLabel.en || stepLabel.km || `step ${stepIndex + 1}`) : stepLabel);
        try {
          await waitForHostUiSettled();
          const aiOptions = await resolveAiOptions(engineRef.current);
          const completedText = context.completed.map((item, index) => `${index + 1}. ${item}`).join('; ');
          const continuationPrompt = `${context.prompt}\n\nAlready completed: ${completedText}\nThe page has changed after the last action. Inspect the current DOM and generate ONLY the next remaining action. Do not repeat completed actions or plan future hidden actions.`;
          const continuation = await generateGuideWithFallback(
            continuationPrompt,
            aiOptions,
            engineRef.current,
            { mode: 'next_action', completedActions: context.completed }
          );
          const existingKeys = new Set(tutorial.steps.map((item: any) => `${item.title}|${item.target?.text || item.target?.css || ''}`));
          // The backend only ever sees a short free-text history ("Already
          // completed: 1. ...; 2. ..."), not real click state, so it can
          // re-propose an action carrying the same visible label as one
          // that's already done (e.g. the Share dialog still contains text
          // matching "Share" after the Share button itself was clicked).
          // existingKeys above only catches an exact title+target repeat —
          // this also rejects a same-labeled repeat regardless of target.
          const normalizeLabel = (val: any): string => {
            const text = typeof val === 'object' && val !== null ? (val.km || val.en || '') : val;
            return typeof text === 'string' ? text.trim().toLowerCase() : '';
          };
          const completedLabels = new Set(context.completed.map(normalizeLabel));
          const candidateSteps = (continuation?.steps || []).filter((item: any) => (
            item &&
            !existingKeys.has(`${item.title}|${item.target?.text || item.target?.css || ''}`) &&
            !completedLabels.has(normalizeLabel(item.title))
          )).slice(0, 1);

          // Ground the candidate against the live page before accepting it —
          // the backend can hallucinate a selector (a build-hashed class name
          // that was never in the DOM snapshot it was given) or drift onto an
          // action that has nothing to do with the current page state. Only
          // append a step that actually resolves to a real, visible element.
          const remainingSteps = candidateSteps.filter((item: any) => {
            if (!item.target) return true; // manual/no-target steps (e.g. modal) are always safe to append
            const resolved = engineRef.current?.adapter?.describeTarget?.(item.target);
            if (!resolved) {
              console.warn('[GuideMe] Discarding ungrounded continuation step (target not found on page):', JSON.stringify({ title: item.title, target: item.target }));
            }
            return Boolean(resolved);
          });

          if (remainingSteps.length > 0) {
            engineRef.current?.appendSteps(remainingSteps);
            console.log(`[GuideMe] Appended ${remainingSteps.length} continuation steps after step ${stepIndex + 1}.`);
            return true;
          }

          if (continuation?.done) return true;

          // No next step was generated (AI returned duplicates, empty steps, or
          // indicated completion). Allow the guide to advance naturally — this
          // is far better than leaving the user permanently stuck on the current
          // step with a frozen click listener. The guide will either move to the
          // next pre-baked step or complete if there are no more steps.
          console.warn('[GuideMe] No next action was generated; allowing guide to advance.');
          return undefined;
        } catch (err) {
          console.warn('[GuideMe] Continuation step generation failed:', (err as any)?.message);
          // Do not block on errors — let the engine advance so the guide doesn't
          // freeze. The user can always restart if the next step is wrong.
          return undefined;
        } finally {
          context.loading = false;
        }
      },
    });
    engineRef.current = engine;

    // Local-first reporting: one EventLog per engine lifecycle, tracking the
    // fields needed to distinguish a completed step from a skipped one and
    // to report the last successful step if the guide is abandoned.
    const eventLog = new EventLog();
    const reportingState = { tutorialId: null, lastSuccessfulStepId: null, lastSuccessfulStepIndex: null, lastStepIndex: null as number | null };

    // Sync TTS backend URL with the same dynamic resolution used by the popup's AI chat,
    // reading from chrome.storage.local or falling back to env/production URL.
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get('guideme_backend_url', (stored: Record<string, any>) => {
        const storedUrl = stored?.guideme_backend_url;
        if (storedUrl) {
          (ttsProvider as any).setBackendUrl?.(storedUrl);
        } else {
          const configuredUrl = import.meta.env.WXT_API_URL;
          const hasApiUrl = configuredUrl && configuredUrl !== '';
          if (hasApiUrl) (ttsProvider as any).setBackendUrl?.(configuredUrl);
        }
      });
    }

    const unsubscribe = engine.subscribe((state: any) => {
      setEngineState(state);

      const activeStepData = state.currentStep ? {
        id: state.currentStep.id,
        title: state.currentStep.action?.title || state.currentStep.title || '',
        description: state.currentStep.action?.content || state.currentStep.instruction || state.currentStep.description || '',
      } : null;

      const activeTutorialData = (state.isActive && engine.activeTutorial) ? {
        active: true,
        currentStepIndex: state.currentStepIndex || 0,
        totalSteps: state.totalSteps || engine.activeTutorial.steps?.length || 1,
        language: state.language,
        name: typeof engine.activeTutorial.name === 'object' ? engine.activeTutorial.name : { km: engine.activeTutorial.name, en: engine.activeTutorial.name },
        tutorial: {
          id: engine.activeTutorial.id,
          name: engine.activeTutorial.name,
          description: engine.activeTutorial.description,
        },
        step: activeStepData,
        stepTitle: activeStepData?.title || '',
        targetUrl: window.location.href,
        updatedAt: Date.now(),
      } : null;

      // 1. Notify background & PiP of state updates for badge indicators and active guide HUD
      try {
        chrome.runtime?.sendMessage({
          action: ExtensionMessageAction.TUTORIAL_STATE_UPDATED,
          payload: {
            active: state.isActive,
            isCompleted: state.isCompleted,
            currentStepIndex: state.currentStepIndex,
            totalSteps: state.totalSteps,
            language: state.language,
            tutorial: activeTutorialData?.tutorial || null,
            step: activeStepData,
          },
        });
      } catch {
        // Extension context may be reloading
      }

      // 2. Persist active state in storage (local & session) so PiP restores seamlessly on reopen
      try {
        if (activeTutorialData) {
          chrome.storage?.local?.set({
            guideme_active_guide_state: activeTutorialData,
          });
          chrome.storage?.session?.set({
            guideme_active_guide_state: activeTutorialData,
          }).catch?.(() => {});
        } else if (!state.isActive) {
          chrome.storage?.local?.remove('guideme_active_guide_state');
          chrome.storage?.session?.remove('guideme_active_guide_state').catch?.(() => {});
        }
      } catch {}

      // 3. Synchronize active tutorial session with background for cross-tab/reload durability
      try {
        chrome.runtime?.sendMessage({
          action: 'GUIDEME_UPDATE_SESSION',
          payload: {
            active: state.isActive,
            currentStepIndex: state.currentStepIndex,
            tutorial: engine.activeTutorial,
            url: window.location.href,
          },
        });
      } catch {
        // Extension context may be reloading
      }
    });

    // ── Realtime Step Progress Broadcasts (PiP and Background Sync) ──
    const onStepStart = ({ step, stepIndex }: { step: any; stepIndex: number }) => {
      reportingState.tutorialId = engine.activeTutorial?.id || reportingState.tutorialId;
      eventLog.guideStepStarted({ tutorialId: reportingState.tutorialId, stepId: step?.id, stepIndex });

      // Reaching step N means step N-1 was just completed, regardless of how
      // it validated (click/input/url_change/manual_next/skip all funnel
      // through nextStep() before the next STEP_START fires) — recording
      // progress here, rather than only on the click/input STEP_SUCCESS
      // event, is what makes manual_next/skip steps count toward the
      // dashboard's real stats instead of being silently invisible to it.
      if (stepIndex > 0 && reportingState.tutorialId) {
        saveStepProgress(reportingState.tutorialId, stepIndex - 1).catch(() => {});
      }
      reportingState.lastStepIndex = stepIndex;

      const resolvedTarget = engine.adapter?.describeTarget?.(step?.target);
      // Stringified inline (not passed as an object) so a plain copy-paste of
      // the console output always captures full detail — DevTools collapses
      // an un-expanded object/array argument to the literal text "Object" /
      // "Array(1)" when copied, which silently discards the very data needed
      // to diagnose a mistargeted overlay.
      console.info(`[GuideMe] Overlay target for step ${stepIndex + 1}/${engine.activeTutorial?.steps?.length || 0}: ${JSON.stringify({
        title: step?.title,
        target: step?.target,
        resolvedElement: resolvedTarget,
      })}`);

      const stepData = {
        id: step?.id,
        title: step?.action?.title || step?.title || '',
        description: step?.action?.content || step?.instruction || step?.description || '',
      };
      const payload = {
        active: true,
        currentStepIndex: stepIndex,
        totalSteps: engine.activeTutorial?.steps?.length || 1,
        tutorial: engine.activeTutorial ? {
          id: engine.activeTutorial.id,
          name: engine.activeTutorial.name,
        } : null,
        step: stepData,
      };

      try {
        chrome.runtime?.sendMessage({
          action: 'TUTORIAL_STEP_ADVANCED',
          payload,
        });
        chrome.runtime?.sendMessage({
          action: ExtensionMessageAction.TUTORIAL_STEP_ADVANCED,
          payload,
        });
      } catch {}
    };

    const onTutorialComplete = ({ tutorial }: { tutorial: any }) => {
      eventLog.guideCompleted({ tutorialId: tutorial?.id || reportingState.tutorialId, totalSteps: tutorial?.steps?.length || 0 });

      // The final step's own completion has no subsequent STEP_START to
      // trigger the "previous step done" recording above — record it
      // explicitly here so the backend sees the completed:true transition.
      const finalGuideId = tutorial?.id || reportingState.tutorialId;
      if (finalGuideId && reportingState.lastStepIndex !== null) {
        saveStepProgress(finalGuideId, reportingState.lastStepIndex).catch(() => {});
      }

      const payload = {
        active: false,
        isCompleted: true,
        tutorial: tutorial ? { id: tutorial.id, name: tutorial.name } : null,
      };

      try {
        chrome.runtime?.sendMessage({
          action: 'TUTORIAL_COMPLETED',
          payload,
        });
        chrome.runtime?.sendMessage({
          action: ExtensionMessageAction.TUTORIAL_COMPLETED,
          payload,
        });
      } catch {}

      try {
        chrome.storage?.local?.remove(['guideme_active_guide_state', 'guideme_active_tutorial_session']);
        chrome.storage?.session?.remove(['guideme_active_guide_state', 'guideme_active_tutorial_session']).catch?.(() => {});
      } catch {}

      // Check if there's a multi-page plan to advance
      try {
        chrome.runtime?.sendMessage({
          action: 'GUIDEME_MULTI_PAGE_COMPLETE',
        }, (res) => {
          if (res?.navigating && res?.url) {
            // Background will navigate the tab — nothing more to do here
          }
        });
      } catch {}
    };

    const onTutorialStop = () => {
      // engine.stop() clears activeTutorial before emitting TUTORIAL_STOP, so
      // this always represents an explicit abandon (complete() takes the
      // TUTORIAL_COMPLETE path instead and never emits TUTORIAL_STOP).
      if (reportingState.tutorialId) {
        eventLog.guideAbandoned({
          tutorialId: reportingState.tutorialId,
          lastSuccessfulStepId: reportingState.lastSuccessfulStepId,
          lastSuccessfulStepIndex: reportingState.lastSuccessfulStepIndex,
        });
      }
      reportingState.tutorialId = null;
      reportingState.lastSuccessfulStepId = null;
      reportingState.lastSuccessfulStepIndex = null;

      try {
        chrome.storage?.local?.remove(['guideme_active_guide_state', 'guideme_active_tutorial_session']);
        chrome.storage?.session?.remove(['guideme_active_guide_state', 'guideme_active_tutorial_session', 'guideme_multi_page_plan']).catch?.(() => {});
      } catch {}
    };

    const onStepSuccessReport = ({ step, eventData }) => {
      reportingState.lastSuccessfulStepId = step?.id ?? reportingState.lastSuccessfulStepId;
      reportingState.lastSuccessfulStepIndex = engine.currentStepIndex;
      eventLog.guideStepCompleted({ tutorialId: reportingState.tutorialId, stepId: step?.id, stepIndex: engine.currentStepIndex });
      // Surfaces exactly which listener validated the step (real target click/input
      // vs. the broader completion-button/dialog-menu heuristics), and for
      // click/input validation, HOW the clicked element matched the target
      // (direct = clicked the actual resolved element; css/closest = matched
      // via selector, which is where a too-broad AI selector can misfire) —
      // so an unexpected advance can be diagnosed from the console instead of
      // guessed at. Stringified inline — see the Overlay-target log above for why.
      console.info(`[GuideMe] Step ${engine.currentStepIndex + 1} validated: ${JSON.stringify({
        reason: eventData?.reason || 'target_interaction',
        matchType: eventData?.matchType || undefined,
        clickedElement: eventData?.originalEvent?.target?.outerHTML?.slice(0, 120),
        title: step?.title,
      })}`);
    };

    const onStepSkippedReport = ({ step, stepIndex }) => {
      eventLog.guideStepSkipped({ tutorialId: reportingState.tutorialId, stepId: step?.id, stepIndex });
    };

    const onTargetResolvedReport = ({ step, stepIndex, selector, tier, source, versionMismatch }) => {
      eventLog.targetResolved({ tutorialId: reportingState.tutorialId, stepId: step?.id, stepIndex, tier, source, selector });
      if (versionMismatch) {
        console.warn('[GuideMe] Canvas map version mismatch — falling back to Tier 2 container highlight:', versionMismatch);
      }
    };

    const onTargetResolutionFailedReport = ({ step, stepIndex, selector }) => {
      eventLog.targetResolutionFailed({ tutorialId: reportingState.tutorialId, stepId: step?.id, stepIndex, selector });
    };

    engine.events.on(EngineEvent.STEP_START, onStepStart);
    engine.events.on(EngineEvent.STEP_SUCCESS, onStepSuccessReport);
    engine.events.on(EngineEvent.STEP_SKIPPED, onStepSkippedReport);
    engine.events.on(EngineEvent.TARGET_RESOLVED, onTargetResolvedReport);
    engine.events.on(EngineEvent.TARGET_RESOLUTION_FAILED, onTargetResolutionFailedReport);
    engine.events.on(EngineEvent.TUTORIAL_COMPLETE, onTutorialComplete);
    engine.events.on(EngineEvent.TUTORIAL_STOP, onTutorialStop);

    // Listen for popup, PiP, and background runtime commands
    const messageHandler = (
      message: any,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      if (!message || !message.action) return false;

      switch (message.action) {
        case 'GUIDEME_SET_THEME': {
          if (message.payload?.theme) {
            setTheme?.(message.payload.theme);
            sendResponse({ success: true, theme: message.payload.theme });
          } else {
            sendResponse({ success: false, error: 'No theme provided' });
          }
          break;
        }

        case 'OPEN_ONBOARDING_OVERLAY': {
          setIsDismissed?.(false);
          setIsOnboardingOpen(true);
          sendResponse({ success: true });
          break;
        }

        case 'CLOSE_ONBOARDING_OVERLAY': {
          setIsOnboardingOpen(false);
          sendResponse({ success: true });
          break;
        }

        case 'OPEN_DASHBOARD_OVERLAY':
        case 'OPEN_DASHBOARD': {
          setIsDismissed?.(false);
          setIsDashboardOpen(true);
          sendResponse({ success: true });
          break;
        }

        case 'CLOSE_DASHBOARD_OVERLAY': {
          setIsDashboardOpen(false);
          sendResponse({ success: true });
          break;
        }

        case ExtensionMessageAction.OPEN_FLOATING_PROMPT: {
          // Previously tried a separate floating PiP launcher window first
          // (GUIDEME_POPOUT_LAUNCHER) and fell back to the in-page prompt on
          // failure. That PiP window was never actually implemented (no
          // pip.html existed — GM-016), so it always failed silently; opening
          // the in-page prompt directly is the real, working behavior.
          setIsDismissed?.(false);
          setIsPromptOpen(true);
          sendResponse({ success: true });
          break;
        }

        case 'OPEN_FULL_POPUP': {
          setIsDismissed?.(false);
          setIsFullPopupOpen(true);
          sendResponse({ success: true });
          break;
        }

        // ── Pre-warm DOM snapshot in parallel with popup's validate-intent call ──
        // The popup fires this speculatively the moment the user submits a prompt.
        // Storing the snapshot here means generateGuideWithFallback skips the
        // synchronous DOM walk entirely on the hot path.
        case 'GUIDEME_PREWARM_DOM': {
          try {
            _prewarmedDomElements = GeminiDomAnalyzer.extractInteractiveDom(document, 100);
          } catch {
            _prewarmedDomElements = null;
          }
          sendResponse({ success: true });
          break;
        }

        case ExtensionMessageAction.START_TUTORIAL: {
          const tutorial = TUTORIAL_CATALOG.find((t) => t.id === message.payload?.tutorialId) || TUTORIAL_CATALOG[0];
          if (tutorial) {
            setIsDismissed?.(false);
            setIsPromptOpen(false);
            setIsFullPopupOpen(false);
            engine.start(tutorial, message.payload?.startStepIndex);
            sendResponse({ success: true, tutorialId: tutorial.id });
          } else {
            sendResponse({ success: false, error: 'Tutorial not found' });
          }
          break;
        }

        case ExtensionMessageAction.START_DYNAMIC_GUIDE: {
          (async () => {
            try {
              const prompt = message.payload?.prompt || message.payload?.userPrompt || '';
              // Hardcoded case: a small set of known prompts always show the
              // same pre-built tutorial instead of generating one via AI.
              const hardcodedTutorial = matchHardcodedPromptGuide(prompt);
              if (hardcodedTutorial) {
                setIsDismissed(false);
                setIsPromptOpen(false);
                setIsFullPopupOpen(false);
                const started = await engine.start(hardcodedTutorial, 0);
                sendResponse(
                  started
                    ? { success: true, tutorialId: hardcodedTutorial.id, dynamic: false, hardcoded: true }
                    : { success: false, tutorialId: hardcodedTutorial.id, errors: ['Hardcoded tutorial rejected by schema validator'] }
                );
                return;
              }

              // Demo mode: AI-generated guides are disabled for anything else.
              if (DEMO_MODE_ONLY_HARDCODED) {
                sendResponse({ success: false, error: 'AI guide generation is disabled in this demo', demoModeBlocked: true });
                return;
              }

              // Resolve AI options and pre-warm DOM snapshot in parallel.
              // resolveAiOptions hits the module-level cache (no storage I/O on
              // repeat calls); DOM extraction is synchronous but moved here so
              // it runs concurrently with any remaining async setup.
              const [aiOptions] = await Promise.all([
                resolveAiOptions(engine),
                // Kick off DOM prewarm if the popup didn't do it already
                Promise.resolve(
                  !_prewarmedDomElements &&
                    (() => { try { _prewarmedDomElements = GeminiDomAnalyzer.extractInteractiveDom(document, 400); } catch {} })()
                ),
              ]);
              const tutorial = await generateGuideWithFallback(prompt, aiOptions, engine);
              if (tutorial) {
                dynamicGuideRef.current = {
                  prompt,
                  completed: [],
                  loading: false,
                  incremental: (tutorial.steps?.length || 0) <= 1,
                };
                setIsDismissed?.(false);
                setIsPromptOpen(false);
                setIsFullPopupOpen(false);
                const started = await engine.start(tutorial, 0);
                if (!started) {
                  console.error('[GuideMe] Tutorial validation failed. Tutorial received:', JSON.stringify(tutorial, null, 2).slice(0, 2000));
                  sendResponse({ success: false, tutorialId: tutorial.id, dynamic: true, errors: ['Tutorial rejected by schema validator - check host page console'] });
                } else {
                  sendResponse({ success: true, tutorialId: tutorial.id, dynamic: true });
                }
              } else {
                sendResponse({ success: false, error: 'No tutorial could be generated' });
              }
            } catch (err) {
              console.error('[GuideMe] Dynamic guide generation failed:', err);
              sendResponse({ success: false, error: (err as any)?.message || String(err) });
            }
          })();
          return true;
        }

        case ExtensionMessageAction.STOP_TUTORIAL:
          engine.stop();
          sendResponse({ success: true });
          break;

        case 'GUIDEME_START_CAPTURE_MODE':
          engine.stop();
          setIsPromptOpen(false);
          setIsDashboardOpen(false);
          setIsCaptureMode?.(true);
          sendResponse({ success: true });
          break;

        case ExtensionMessageAction.NEXT_STEP:
          engine.nextStep();
          sendResponse({ success: true });
          break;

        case ExtensionMessageAction.PREV_STEP:
          engine.prevStep();
          sendResponse({ success: true });
          break;

        case ExtensionMessageAction.SET_LANGUAGE:
          if (message.payload?.language) {
            engine.setLanguage(message.payload.language);
            sendResponse({ success: true, language: engine.getLanguage() });
          } else {
            sendResponse({ success: false, error: 'No language provided' });
          }
          break;

        case 'GUIDEME_SYNC_SESSION': {
          const session = message.payload;
          if (session?.tutorial) {
            setIsDismissed?.(false);
            setIsPromptOpen(false);
            setIsFullPopupOpen(false);
            engine.start(session.tutorial, session.currentStepIndex || 0);
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'No tutorial in session' });
          }
          break;
        }

        case ExtensionMessageAction.REPLAY_AUDIO:
          engine.getAudioEngine().replay();
          sendResponse({ success: true });
          break;

        case ExtensionMessageAction.TOGGLE_MUTE: {
          const isMuted = engine.toggleMute();
          sendResponse({ success: true, isMuted });
          break;
        }

        case ExtensionMessageAction.MUTE_AUDIO: {
          const isMuted = message.payload?.muted !== undefined ? message.payload.muted : true;
          engine.setMuted(isMuted);
          sendResponse({ success: true, isMuted: engine.isMuted() });
          break;
        }

        case ExtensionMessageAction.SET_VOLUME: {
          if (typeof message.payload?.volume === 'number') {
            engine.setVolume(message.payload.volume);
            sendResponse({ success: true, volume: engine.getVolume() });
          } else {
            sendResponse({ success: false, error: 'Invalid volume value' });
          }
          break;
        }

        case ExtensionMessageAction.GET_TUTORIAL_STATUS:
          sendResponse({
            success: true,
            state: engine.getStateSnapshot(),
            availableTutorials: TUTORIAL_CATALOG.map((t) => ({
              id: t.id,
              name: typeof t.name === 'object' ? t.name : { km: t.name, en: t.name },
              description: typeof t.description === 'object' ? t.description : { km: t.description, en: t.description },
              matchUrls: t.matchUrls,
              totalSteps: t.steps.length,
            })),
          });
          break;

        case ExtensionMessageAction.GET_AVAILABLE_TUTORIALS:
          sendResponse({
            success: true,
            tutorials: TUTORIAL_CATALOG,
          });
          break;

        case 'GUIDEME_MULTI_PAGE_NEXT': {
          const { prompt: mpPrompt } = (message.payload || {}) as { prompt?: string; page?: any };
          if (mpPrompt) {
            if (DEMO_MODE_ONLY_HARDCODED) {
              sendResponse({ success: false, error: 'AI guide generation is disabled in this demo', demoModeBlocked: true });
              break;
            }
            (async () => {
              try {
                const aiOptions = await resolveAiOptions(engine);
                const tutorial = await generateGuideWithFallback(mpPrompt, aiOptions, engine);
                if (tutorial) {
                  dynamicGuideRef.current = {
                    prompt: mpPrompt,
                    completed: [],
                    loading: false,
                    incremental: (tutorial.steps?.length || 0) <= 1,
                  };
                  setIsDismissed?.(false);
                  setIsPromptOpen(false);
                  setIsFullPopupOpen(false);
                  engine.start(tutorial, 0);
                  sendResponse({ success: true, tutorialId: tutorial.id });
                } else {
                  sendResponse({ success: false, error: 'No tutorial could be generated' });
                }
              } catch (err) {
                sendResponse({ success: false, error: (err as any)?.message || String(err) });
              }
            })();
            return true;
          }
          sendResponse({ success: false, error: 'No prompt' });
          break;
        }

        case 'GUIDEME_SHOW_FLOATING_PROMPT': {
          // Show the floating prompt widget on the page
          setIsPromptOpen(true);
          setIsDismissed?.(false);
          sendResponse({ success: true });
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unknown action' });
          return false;
      }
      return true;
    };

    chrome.runtime?.onMessage?.addListener(messageHandler);
    engine.init();

    // ── Auto-Restore Active Session on Page Reload / Navigation ──
    let isMounted = true;
    try {
      chrome.runtime?.sendMessage({ action: 'GUIDEME_GET_SESSION' }, (response) => {
        if (!isMounted) return;
        const session = response?.session;
        if (session?.tutorial) {
          try {
            const currentHost = new URL(window.location.href).hostname;
            const targetHost = session.targetUrl ? new URL(session.targetUrl).hostname : null;
            if (targetHost && currentHost === targetHost) {
              console.log('[GuideMe] Auto-restoring active session from background on step:', session.currentStepIndex);
              engine.start(session.tutorial, session.currentStepIndex || 0);
              return;
            }
          } catch { /* ignore */ }
        }

        // If no active session, check for captured target fallback
        const captureKey = getCapturedStepStorageKey(window.location.href);
        chrome.storage?.local?.get(captureKey, (stored: Record<string, any>) => {
          const target = stored?.[captureKey]?.target;
          if (isMounted && target) engine.start(createCapturedTutorial(target), 0);
        });
      });
    } catch {
      // Storage is optional; live capture remains available.
    }

    return () => {
      isMounted = false;
      unsubscribe();
      engine.events.off(EngineEvent.STEP_START, onStepStart);
      engine.events.off(EngineEvent.STEP_SUCCESS, onStepSuccessReport);
      engine.events.off(EngineEvent.STEP_SKIPPED, onStepSkippedReport);
      engine.events.off(EngineEvent.TARGET_RESOLVED, onTargetResolvedReport);
      engine.events.off(EngineEvent.TARGET_RESOLUTION_FAILED, onTargetResolutionFailedReport);
      engine.events.off(EngineEvent.TUTORIAL_COMPLETE, onTutorialComplete);
      engine.events.off(EngineEvent.TUTORIAL_STOP, onTutorialStop);
      chrome.runtime?.onMessage?.removeListener(messageHandler);
      chrome.storage?.onChanged?.removeListener(onVoiceSettingChanged);
      eventLog.flush();
      eventLog.destroy();
      engine.destroy();
    };
  }, []);

  // Returns true when a guide actually started, false otherwise — callers
  // (the chat widget) use this to surface a real error/retry message instead
  // of closing on an optimistic assumption of success (GM-015). Every early
  // return below used to be a silent no-op with only a console warning.
  //
  // `intent` is the structured {targetQuery, action, role, category} the
  // chat widget already resolved via /api/ai/assistant-chat — forwarded to
  // generate-steps as a grounding hint instead of being silently dropped
  // (GM-017). `image` is accepted for signature parity with existing call
  // sites but intentionally unused: /api/ai/generate-steps has no vision
  // support today (only the Q&A assistant-chat endpoint does), so wiring it
  // through would silently do nothing — a real fix needs backend vision
  // support first, tracked separately.
  const handleStartDynamicGuide = async (
    prompt: string,
    _image?: string | null,
    intent?: Record<string, unknown> | null
  ): Promise<boolean> => {
    try {
      // Guard: if the extension context was invalidated (e.g. after a hot-reload),
      // bail out cleanly instead of crashing with "Extension context invalidated".
      if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
        console.warn('[GuideMe] Extension context unavailable — reload the extension or the page.');
        return false;
      }

      // Hardcoded case: a small set of known prompts always show the same
      // pre-built tutorial instead of generating one via AI.
      const hardcodedTutorial = matchHardcodedPromptGuide(prompt);
      if (hardcodedTutorial) {
        setIsPromptOpen(false);
        setIsFullPopupOpen(false);
        engineRef.current?.start(hardcodedTutorial, 0);
        return true;
      }

      // Demo mode: AI-generated guides are disabled for anything else.
      if (DEMO_MODE_ONLY_HARDCODED) {
        console.warn('[GuideMe] AI guide generation is disabled in this demo.');
        return false;
      }

      const aiOptions = await resolveAiOptions(engineRef.current);
      const tutorial = await generateGuideWithFallback(prompt, aiOptions, engineRef.current, { intent });
      if (tutorial) {
        dynamicGuideRef.current = {
          prompt,
          completed: [],
          loading: false,
          incremental: (tutorial.steps?.length || 0) <= 1,
        };
        setIsPromptOpen(false);
        setIsFullPopupOpen(false);
        engineRef.current?.start(tutorial, 0);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[GuideMe] Dynamic guide generation failed:', err);
      return false;
    }
  };

  const handleStartTutorial = (tutorialId: string) => {
    const tutorial = TUTORIAL_CATALOG.find((t) => t.id === tutorialId) || TUTORIAL_CATALOG[0];
    if (tutorial) {
      setIsPromptOpen(false);
      setIsFullPopupOpen(false);
      engineRef.current?.start(tutorial, 0);
    }
  };

  return {
    engineRef,
    engineState,
    availableTutorials,
    handleStartDynamicGuide,
    handleStartTutorial,
  };
}
