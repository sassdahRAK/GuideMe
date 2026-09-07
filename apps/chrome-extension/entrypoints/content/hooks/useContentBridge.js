import { useEffect, useState, useRef } from 'react';
import { TutorialEngine, DynamicPageAnalyzer, TtsRegistry } from '@guideme/engine';
import { ChromeAdapter } from '@guideme/chrome-adapter';
import { ExtensionMessageAction, Language } from '@guideme/core-types';
import { TUTORIAL_CATALOG, getTutorialsForUrl } from '../../../src/catalog.js';
import { getCapturedStepStorageKey, createCapturedTutorial } from './useCaptureMode.js';

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

      // 1. Notify background worker of state updates for badge indicators
      try {
        chrome.runtime?.sendMessage({
          action: ExtensionMessageAction.TUTORIAL_STATE_UPDATED,
          payload: {
            active: state.isActive,
            currentStepIndex: state.currentStepIndex,
            totalSteps: state.totalSteps,
            language: state.language,
          },
        });
      } catch {
        // Extension context may be reloading
      }

      // 2. Synchronize active tutorial session with background for cross-tab/reload durability
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
              let geminiKey = import.meta.env?.WXT_GEMINI_API_KEY || import.meta.env?.VITE_GEMINI_API_KEY || '';
              if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                const stored = await chrome.storage.local.get('guideme_gemini_api_key');
                if (stored?.guideme_gemini_api_key) {
                  geminiKey = stored.guideme_gemini_api_key;
                }
              }
              const dynamicTutorial = await DynamicPageAnalyzer.generateDynamicTutorialAsync(
                document,
                window.location.href,
                prompt,
                { geminiApiKey: geminiKey, language: engine.getLanguage() }
              );
              setIsDismissed(false);
              setIsPromptOpen(false);
              setIsFullPopupOpen(false);
              engine.start(dynamicTutorial, 0);
              sendResponse({ success: true, tutorialId: dynamicTutorial.id, dynamic: true });
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
      chrome.runtime?.onMessage?.removeListener(messageHandler);
      engine.destroy();
    };
  }, []);

  const handleStartDynamicGuide = async (prompt) => {
    try {
      let geminiKey = import.meta.env?.WXT_GEMINI_API_KEY || import.meta.env?.VITE_GEMINI_API_KEY || '';
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const stored = await chrome.storage.local.get('guideme_gemini_api_key');
        if (stored?.guideme_gemini_api_key) {
          geminiKey = stored.guideme_gemini_api_key;
        }
      }
      const dynamicTutorial = await DynamicPageAnalyzer.generateDynamicTutorialAsync(
        document,
        window.location.href,
        prompt,
        { geminiApiKey: geminiKey, language: engineRef.current?.getLanguage() || 'km' }
      );
      setIsPromptOpen(false);
      setIsFullPopupOpen(false);
      engineRef.current?.start(dynamicTutorial, 0);
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
