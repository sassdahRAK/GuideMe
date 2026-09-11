import { useEffect, useState, useRef } from 'react';
import { TutorialEngine, DynamicPageAnalyzer, GeminiDomAnalyzer, TtsRegistry, IntentRegistry } from '@guideme/engine';
import { ChromeAdapter } from '@guideme/chrome-adapter';
import { ExtensionMessageAction, Language, EngineEvent } from '@guideme/core-types';
import { TUTORIAL_CATALOG, getTutorialsForUrl } from '../../../src/catalog.js';
// import { getCapturedStepStorageKey, createCapturedTutorial } from './useCaptureMode.js';

/**
 * Returns a deterministic storage key for a captured step target on a given URL.
 */
function getCapturedStepStorageKey(url) {
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
function createCapturedTutorial(target) {
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
 * Resolves AI provider credentials and options dynamically from storage or environment variables.
 */
async function resolveAiOptions(engineInstance) {
  let provider = import.meta.env?.WXT_AI_PROVIDER || 'openai';
  let geminiKey = import.meta.env?.WXT_GEMINI_API_KEY || import.meta.env?.VITE_GEMINI_API_KEY || '';
  let backendUrl = (import.meta.env?.WXT_API_URL) || '';

  if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local) {
    try {
      const stored = await chrome.storage.local.get([
        'guideme_ai_provider',
        'guideme_gemini_api_key',
        'guideme_gemini_model',
        'guideme_ai_preset',
        'guideme_ai_endpoint',
        'guideme_ai_api_key',
        'guideme_ai_model',
        'guideme_backend_url',
      ]);
      if (stored?.guideme_ai_provider) provider = stored.guideme_ai_provider;
      if (stored?.guideme_gemini_api_key) geminiKey = stored.guideme_gemini_api_key;
      if (stored?.guideme_gemini_model) geminiModel = stored.guideme_gemini_model;
      if (stored?.guideme_ai_preset) aiPreset = stored.guideme_ai_preset;
      if (stored?.guideme_ai_endpoint) aiEndpoint = stored.guideme_ai_endpoint;
      if (stored?.guideme_ai_api_key) aiApiKey = stored.guideme_ai_api_key;
      if (stored?.guideme_ai_model) aiModel = stored.guideme_ai_model;
      if (stored?.guideme_backend_url) backendUrl = stored.guideme_backend_url;
    } catch (storageErr) {
      // Extension context may be invalidated if extension was recently rebuilt/reloaded
      console.warn('[GuideMe] Could not read chrome.storage (extension context reloaded). Using environment fallback.');
    }
  }

  return {
    provider,
    geminiApiKey: geminiKey,
    backendUrl,
    language: engineInstance?.getLanguage ? engineInstance.getLanguage() : 'km',
  };
}

function normalizeTargetHint(value) {
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
function hydrateGeneratedTargets(tutorial, domElements) {
  if (!tutorial?.steps || !Array.isArray(domElements)) return tutorial;

  const isGenericSelector = (selector) => /^(button|div|a|input|span|select|textarea|p)$/i.test((selector || '').trim());

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
    const findSemanticCandidate = (hint) => domElements.find((item) => (
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
function waitForHostUiSettled() {
  return new Promise((resolve) => {
    const nextFrame = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (callback) => setTimeout(callback, 16);
    let settled = false;
    let minimumDelayComplete = false;
    let quietTimer = null;
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
 * Tries backend Stage 2 LLM first, falls back to local DynamicPageAnalyzer.
 */
async function generateGuideWithFallback(prompt, aiOptions, engineInstance, generationOptions = {}) {
  const baseUrl = aiOptions.backendUrl;
  let tutorial = null;
  const backendTimeoutMs = 15000;

  // Try backend Stage 2 LLM first
  if (baseUrl) {
    let timedOut = false;
    let timeoutId;
    try {
      const domElements = GeminiDomAnalyzer.extractInteractiveDom(document, 100);
      const controller = new AbortController();
      timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, backendTimeoutMs);

      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/ai/generate-steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          elements: domElements,
          language: engineInstance?.getLanguage ? engineInstance.getLanguage() : 'km',
          currentUrl: window.location.href,
          mode: generationOptions.mode || 'initial',
          completedActions: generationOptions.completedActions || [],
        }),
        signal: controller.signal,
      });

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
          console.log(`[GuideMe] Backend generate-steps returned ${tutorial.steps.length} steps for "${prompt}":`, tutorial.steps.map((s) => s.title));
        } else {
          console.warn('[GuideMe] Backend generate-steps returned no/empty steps:', JSON.stringify(data).slice(0, 300));
        }
      } else {
        console.warn(`[GuideMe] Backend generate-steps HTTP ${res.status}:`, (await res.text().catch(() => '')).slice(0, 300));
      }
    } catch (err) {
      const reason = timedOut ? `timed out after ${backendTimeoutMs}ms` : (err?.message || 'unknown error');
      console.info('[GuideMe] Backend generate-steps failed, using local fallback:', reason);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Fall back to local DynamicPageAnalyzer
  if (!tutorial) {
    // Do not immediately issue a second network request after a backend timeout.
    // The local path must remain deterministic and available offline.
    const fallbackOptions = baseUrl
      ? {
          ...aiOptions,
          provider: 'local',
          backendUrl: '',
          apiKey: '',
          nvidiaApiKey: '',
          geminiApiKey: '',
          reranker: null,
        }
      : { ...aiOptions, reranker: IntentRegistry.fromEnv(import.meta.env) };
    tutorial = await DynamicPageAnalyzer.generateDynamicTutorialAsync(
      document,
      window.location.href,
      prompt,
      fallbackOptions
    );
    console.log(`[GuideMe] LOCAL DynamicPageAnalyzer returned ${tutorial?.steps?.length ?? 0} steps for "${prompt}"`);
  }

  return tutorial;
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
}) {
  const [engineState, setEngineState] = useState(() => ({
    isActive: false,
    isCompleted: false,
    language: Language.KM,
  }));

  const [availableTutorials, setAvailableTutorials] = useState(() =>
    typeof window !== 'undefined' ? getTutorialsForUrl(window.location.href) : []
  );

  const engineRef = useRef(null);
  const dynamicGuideRef = useRef({ prompt: '', completed: [], loading: false });

  useEffect(() => {
    const adapter = new ChromeAdapter();
    const ttsProvider = TtsRegistry.fromEnv(import.meta.env);

    const engine = new TutorialEngine({
      adapter,
      ttsProvider,
      beforeNextStep: async ({ step, stepIndex, tutorial }) => {
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
          const existingKeys = new Set(tutorial.steps.map((item) => `${item.title}|${item.target?.text || item.target?.css || ''}`));
          const remainingSteps = (continuation?.steps || []).filter((item) => (
            item && !existingKeys.has(`${item.title}|${item.target?.text || item.target?.css || ''}`)
          )).slice(0, 1);

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
          console.warn('[GuideMe] Continuation step generation failed:', err?.message);
          // Do not block on errors — let the engine advance so the guide doesn't
          // freeze. The user can always restart if the next step is wrong.
          return undefined;
        } finally {
          context.loading = false;
        }
      },
    });
    engineRef.current = engine;

    // Sync TTS backend URL with the same dynamic resolution used by the popup's AI chat,
    // reading from chrome.storage.local or falling back to env/production URL.
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get('guideme_backend_url', (stored) => {
        const storedUrl = stored?.guideme_backend_url;
        if (storedUrl) {
          ttsProvider.setBackendUrl(storedUrl);
        } else {
          const configuredUrl = import.meta.env.WXT_API_URL;
          const hasApiUrl = configuredUrl && configuredUrl !== '';
          if (hasApiUrl) ttsProvider.setBackendUrl(configuredUrl);
        }
      });
    }

    const unsubscribe = engine.subscribe((state) => {
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
    const onStepStart = ({ step, stepIndex }) => {
      const resolvedTarget = engine.adapter?.describeTarget?.(step?.target);
      console.info(`[GuideMe] Overlay target for step ${stepIndex + 1}/${engine.activeTutorial?.steps?.length || 0}:`, {
        title: step?.title,
        target: step?.target,
        resolvedElement: resolvedTarget,
      });

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

    const onTutorialComplete = ({ tutorial }) => {
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
      try {
        chrome.storage?.local?.remove(['guideme_active_guide_state', 'guideme_active_tutorial_session']);
        chrome.storage?.session?.remove(['guideme_active_guide_state', 'guideme_active_tutorial_session', 'guideme_multi_page_plan']).catch?.(() => {});
      } catch {}
    };

    engine.events.on(EngineEvent.STEP_START, onStepStart);
    engine.events.on(EngineEvent.TUTORIAL_COMPLETE, onTutorialComplete);
    engine.events.on(EngineEvent.TUTORIAL_STOP, onTutorialStop);

    // Listen for popup, PiP, and background runtime commands
    const messageHandler = (message, _sender, sendResponse) => {
      if (!message || !message.action) return false;

      switch (message.action) {
        case 'GUIDEME_SET_THEME': {
          if (message.payload?.theme) {
            setTheme(message.payload.theme);
            sendResponse({ success: true, theme: message.payload.theme });
          } else {
            sendResponse({ success: false, error: 'No theme provided' });
          }
          break;
        }

        case 'OPEN_ONBOARDING_OVERLAY': {
          setIsDismissed(false);
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
          setIsDismissed(false);
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
          setIsDismissed(false);
          try {
            chrome.runtime?.sendMessage({ action: 'GUIDEME_POPOUT_LAUNCHER' }, (res) => {
              if (chrome.runtime?.lastError || !res?.success) {
                setIsPromptOpen(true);
              } else {
                setIsPromptOpen(false);
              }
            });
          } catch {
            setIsPromptOpen(true);
          }
          sendResponse({ success: true });
          break;
        }

        case 'OPEN_FULL_POPUP': {
          setIsDismissed(false);
          setIsFullPopupOpen(true);
          sendResponse({ success: true });
          break;
        }

        case ExtensionMessageAction.START_TUTORIAL: {
          const tutorial = TUTORIAL_CATALOG.find((t) => t.id === message.payload?.tutorialId) || TUTORIAL_CATALOG[0];
          if (tutorial) {
            setIsDismissed(false);
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
              const aiOptions = await resolveAiOptions(engine);
               const tutorial = await generateGuideWithFallback(prompt, aiOptions, engine);
              if (tutorial) {
                 dynamicGuideRef.current = {
                   prompt,
                   completed: [],
                   loading: false,
                   incremental: tutorial.steps.length <= 1,
                 };
                setIsDismissed(false);
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
              sendResponse({ success: false, error: err.message });
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
          setIsCaptureMode(true);
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
            setIsDismissed(false);
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
          const { prompt: mpPrompt, page } = message.payload || {};
          if (mpPrompt) {
            (async () => {
              try {
                const aiOptions = await resolveAiOptions(engine);
                 const tutorial = await generateGuideWithFallback(mpPrompt, aiOptions, engine);
                if (tutorial) {
                   dynamicGuideRef.current = {
                     prompt: mpPrompt,
                     completed: [],
                     loading: false,
                     incremental: tutorial.steps.length <= 1,
                   };
                  setIsDismissed(false);
                  setIsPromptOpen(false);
                  setIsFullPopupOpen(false);
                  engine.start(tutorial, 0);
                  sendResponse({ success: true, tutorialId: tutorial.id });
                } else {
                  sendResponse({ success: false, error: 'No tutorial could be generated' });
                }
              } catch (err) {
                sendResponse({ success: false, error: err.message });
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
          setIsDismissed(false);
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
        chrome.storage?.local?.get(captureKey, (stored) => {
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
      engine.events.off(EngineEvent.TUTORIAL_COMPLETE, onTutorialComplete);
      engine.events.off(EngineEvent.TUTORIAL_STOP, onTutorialStop);
      chrome.runtime?.onMessage?.removeListener(messageHandler);
      engine.destroy();
    };
  }, []);

  const handleStartDynamicGuide = async (prompt) => {
    try {
      // Guard: if the extension context was invalidated (e.g. after a hot-reload),
      // bail out cleanly instead of crashing with "Extension context invalidated".
      if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
        console.warn('[GuideMe] Extension context unavailable — reload the extension or the page.');
        return;
      }
      const aiOptions = await resolveAiOptions(engineRef.current);
       const tutorial = await generateGuideWithFallback(prompt, aiOptions, engineRef.current);
      if (tutorial) {
         dynamicGuideRef.current = {
           prompt,
           completed: [],
           loading: false,
           incremental: tutorial.steps.length <= 1,
         };
        setIsPromptOpen(false);
        setIsFullPopupOpen(false);
        engineRef.current?.start(tutorial, 0);
      }
    } catch (err) {
      console.error('[GuideMe] Dynamic guide generation failed:', err);
    }
  };

  const handleStartTutorial = (tutorialId) => {
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
