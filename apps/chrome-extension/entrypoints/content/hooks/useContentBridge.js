import { useEffect, useState, useRef } from 'react';
import { TutorialEngine, DynamicPageAnalyzer, TtsRegistry } from '@guideme/engine';
import { ChromeAdapter } from '@guideme/chrome-adapter';
import { ExtensionMessageAction, Language, EngineEvent } from '@guideme/core-types';
import { TUTORIAL_CATALOG, getTutorialsForUrl } from '../../../src/catalog.js';

/**
 * CSP-safe fetch wrapper: Routes HTTP requests through background service worker
 * to bypass host-page CSP (e.g. Google Docs connect-src).
 */
async function proxyFetchFn(url, options = {}) {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'GUIDEME_PROXY_FETCH_JSON',
            payload: {
              url,
              method: options.method || 'GET',
              headers: options.headers || {},
              body: options.body,
            },
          },
          (res) => {
            if (chrome.runtime?.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (!res || !res.success) {
              reject(new Error(res?.error || `HTTP proxy error ${res?.status || 'unknown'}`));
            } else {
              resolve(res.data);
            }
          }
        );
      });

      return {
        ok: true,
        status: 200,
        json: async () => response,
        text: async () => (typeof response === 'string' ? response : JSON.stringify(response)),
      };
    } catch (err) {
      console.warn('[GuideMe Content Bridge] Background proxy fetch failed, falling back to direct fetch:', err);
    }
  }

  return fetch(url, options);
}

/**
 * Resolves AI provider credentials and options dynamically from storage or environment variables.
 */
async function resolveAiOptions(engineInstance) {
  let provider = import.meta.env?.WXT_AI_PROVIDER || 'nvidia';
  let nvidiaApiKey = import.meta.env?.WXT_NVIDIA_API_KEY || '';
  let nvidiaModel = import.meta.env?.WXT_NVIDIA_MODEL || 'moonshotai/kimi-k3';
  let geminiKey = import.meta.env?.WXT_GEMINI_API_KEY || import.meta.env?.VITE_GEMINI_API_KEY || '';
  let geminiModel = import.meta.env?.WXT_GEMINI_MODEL || 'gemini-3.6-flash';
  let aiPreset = import.meta.env?.WXT_AI_PRESET || '';
  let aiEndpoint = import.meta.env?.WXT_AI_ENDPOINT || '';
  let aiApiKey = import.meta.env?.WXT_AI_API_KEY || '';
  let aiModel = import.meta.env?.WXT_AI_MODEL || '';
  const isDev = import.meta.env?.DEV || process.env?.NODE_ENV === 'development';
  const defaultProdUrl = 'https://guideme-lac.vercel.app';
  let backendUrl = import.meta.env?.WXT_API_URL || (isDev ? 'http://localhost:4000' : defaultProdUrl);

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const stored = await chrome.storage.local.get([
      'guideme_ai_provider',
      'guideme_nvidia_api_key',
      'guideme_nvidia_model',
      'guideme_gemini_api_key',
      'guideme_gemini_model',
      'guideme_ai_preset',
      'guideme_ai_endpoint',
      'guideme_ai_api_key',
      'guideme_ai_model',
      'guideme_backend_url',
    ]);
    if (stored?.guideme_ai_provider) provider = stored.guideme_ai_provider;
    if (stored?.guideme_nvidia_api_key) nvidiaApiKey = stored.guideme_nvidia_api_key;
    if (stored?.guideme_nvidia_model) nvidiaModel = stored.guideme_nvidia_model;
    if (stored?.guideme_gemini_api_key) geminiKey = stored.guideme_gemini_api_key;
    if (stored?.guideme_gemini_model) geminiModel = stored.guideme_gemini_model;
    if (stored?.guideme_ai_preset) aiPreset = stored.guideme_ai_preset;
    if (stored?.guideme_ai_endpoint) aiEndpoint = stored.guideme_ai_endpoint;
    if (stored?.guideme_ai_api_key) aiApiKey = stored.guideme_ai_api_key;
    if (stored?.guideme_ai_model) aiModel = stored.guideme_ai_model;
    if (stored?.guideme_backend_url) backendUrl = stored.guideme_backend_url;
  }

  return {
    provider,
    nvidiaApiKey,
    nvidiaModel,
    geminiApiKey: geminiKey,
    geminiModel,
    preset: aiPreset,
    endpoint: aiEndpoint,
    apiKey: aiApiKey || nvidiaApiKey || geminiKey,
    model: aiModel || nvidiaModel || geminiModel,
    backendUrl,
    language: engineInstance?.getLanguage ? engineInstance.getLanguage() : 'km',
    fetchFn: proxyFetchFn,
  };
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

  useEffect(() => {
    const adapter = new ChromeAdapter();
    const ttsProvider = TtsRegistry.fromEnv(import.meta.env);

    const engine = new TutorialEngine({
      adapter,
      ttsProvider,
    });
    engineRef.current = engine;

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
    };

    const onTutorialStop = () => {
      try {
        chrome.storage?.local?.remove(['guideme_active_guide_state', 'guideme_active_tutorial_session']);
        chrome.storage?.session?.remove(['guideme_active_guide_state', 'guideme_active_tutorial_session']).catch?.(() => {});
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

        case 'GUIDEME_TOGGLE_CHAT_OVERLAY':
        case ExtensionMessageAction.OPEN_FLOATING_PROMPT: {
          setIsDismissed(false);
          const nextState = message.payload?.open !== undefined ? Boolean(message.payload.open) : true;
          setIsPromptOpen(nextState);
          try {
            chrome.storage?.local?.set({ guideme_is_chat_open: nextState });
          } catch { }
          sendResponse({ success: true, isOpen: nextState });
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

        case 'GUIDEME_START_DYNAMIC_GUIDE':
        case ExtensionMessageAction.START_DYNAMIC_GUIDE: {
          (async () => {
            try {
              const prompt = message.payload?.prompt || message.payload?.userPrompt || '';
              const intent = message.payload?.intent || null;

              setIsDismissed(false);
              setIsPromptOpen(false);
              setIsFullPopupOpen(false);

              // 1. Check if an available curated tutorial on this page matches the intent or prompt
              const rawQuery = (intent?.targetQuery || intent?.category || prompt || '').toLowerCase();
              const isShare = /\b(share|collaborat|permission|invite|ចែករំលែក|អញ្ជើញ)\b/i.test(rawQuery);

              const matchedCurated = availableTutorials.find((tut) => {
                const id = (tut.id || '').toLowerCase();
                const enName = (typeof tut.name === 'object' ? tut.name.en : tut.name || '').toLowerCase();
                const kmName = (typeof tut.name === 'object' ? tut.name.km : '').toLowerCase();

                if (isShare && (id.includes('share') || enName.includes('share') || kmName.includes('ចែករំលែក'))) {
                  return true;
                }
                if (intent?.targetQuery) {
                  const tq = intent.targetQuery.toLowerCase();
                  if (enName.includes(tq) || id.includes(tq) || kmName.includes(tq)) return true;
                }
                return false;
              });

              if (matchedCurated) {
                console.log('[GuideMe] Found matching curated tutorial for message request:', matchedCurated.id);
                const fullTutorial = TUTORIAL_CATALOG.find((t) => t.id === matchedCurated.id) || matchedCurated;
                engine.start(fullTutorial, 0);
                sendResponse({ success: true, tutorialId: matchedCurated.id, curated: true });
                return;
              }

              // 2. Dynamic zero-hallucination scan
              const aiOptions = await resolveAiOptions(engine);
              const dynamicTutorial = await DynamicPageAnalyzer.generateDynamicTutorialAsync(
                document,
                window.location.href,
                prompt,
                { ...aiOptions, intent }
              );
              if (dynamicTutorial && Array.isArray(dynamicTutorial.steps) && dynamicTutorial.steps.length > 0) {
                engine.start(dynamicTutorial, 0);
                sendResponse({ success: true, tutorialId: dynamicTutorial.id, dynamic: true });
              } else {
                sendResponse({ success: false, error: 'No matching interactive elements found' });
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

        default:
          break;
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
      });
    } catch {
      // Storage is optional.
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

  const handleStartDynamicGuide = async (prompt, imageToSend, intent) => {
    try {
      // 1. Immediately dismiss chat prompt so user sees page and spotlight
      setIsPromptOpen(false);
      setIsFullPopupOpen(false);
      try {
        chrome.storage?.local?.set({ guideme_is_chat_open: false });
      } catch {}

      // 2. Check if an available curated tutorial on this page matches the intent or prompt
      const rawQuery = (intent?.targetQuery || intent?.category || prompt || '').toLowerCase();
      const isShare = /\b(share|collaborat|permission|invite|ចែករំលែក|អញ្ជើញ)\b/i.test(rawQuery);

      const matchedCurated = availableTutorials.find((tut) => {
        const id = (tut.id || '').toLowerCase();
        const enName = (typeof tut.name === 'object' ? tut.name.en : tut.name || '').toLowerCase();
        const kmName = (typeof tut.name === 'object' ? tut.name.km : '').toLowerCase();

        if (isShare && (id.includes('share') || enName.includes('share') || kmName.includes('ចែករំលែក'))) {
          return true;
        }
        if (intent?.targetQuery) {
          const tq = intent.targetQuery.toLowerCase();
          if (enName.includes(tq) || id.includes(tq) || kmName.includes(tq)) return true;
        }
        return false;
      });

      if (matchedCurated) {
        console.log('[GuideMe] Found matching curated tutorial for intent:', matchedCurated.id);
        const fullTutorial = TUTORIAL_CATALOG.find((t) => t.id === matchedCurated.id) || matchedCurated;
        engineRef.current?.start(fullTutorial, 0);
        return;
      }

      // 3. Fallback: Dynamic Zero-Hallucination Fuse.js DOM Scanner
      const aiOptions = await resolveAiOptions(engineRef.current);
      const dynamicTutorial = await DynamicPageAnalyzer.generateDynamicTutorialAsync(
        document,
        window.location.href,
        prompt,
        { ...aiOptions, intent }
      );
      if (dynamicTutorial && Array.isArray(dynamicTutorial.steps) && dynamicTutorial.steps.length > 0) {
        engineRef.current?.start(dynamicTutorial, 0);
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
