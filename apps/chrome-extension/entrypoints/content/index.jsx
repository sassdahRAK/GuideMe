import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import ReactDOM from 'react-dom/client';
import React, { useEffect, useState, useRef } from 'react';
import { TutorialEngine, DynamicPageAnalyzer, TtsRegistry } from '@guideme/engine';
import { ChromeAdapter } from '@guideme/chrome-adapter';
import { TutorialOverlay, GuideMeLogo, getUIString } from '@guideme/tutorial-ui';
import { ExtensionMessageAction, Language } from '@guideme/core-types';
import { FiPlus, FiMic } from 'react-icons/fi';
import './style.css';

import { TUTORIAL_CATALOG, getTutorialsForUrl } from '../../src/catalog.js';

export default defineContentScript({
  matches: ['*://*/*', '<all_urls>'],
  allFrames: false,
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx) {
    // 1. Guard against sub-iframes (e.g. Gemini voice widget, auth frames, sandboxed widgets)
    if (typeof window !== 'undefined' && window.self !== window.top) {
      return;
    }

    // 2. Singleton guard against duplicate content script execution
    if (typeof window !== 'undefined') {
      if (window.__GUIDEME_MOUNTED__) {
        console.warn('[GuideMe] Content script already mounted on this page. Skipping duplicate mount.');
        return;
      }
      window.__GUIDEME_MOUNTED__ = true;
    }

    // 3. Clean up any existing orphan shadow host element
    const existing = document.querySelector('guideme-tutorial-root, #guideme-tutorial-root');
    if (existing) {
      existing.remove();
    }

    console.log('[GuideMe Content Script] Mounting isolated Shadow DOM UI...');

    const ui = await createShadowRootUi(ctx, {
      name: 'guideme-tutorial-root',
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      zIndex: 2147483647,
      onMount(uiContainer) {
        const root = ReactDOM.createRoot(uiContainer);

        function TutorialApp() {
          const [engineState, setEngineState] = useState(() => ({
            isActive: false,
            isCompleted: false,
            language: Language.KM,
          }));
          const [isPromptOpen, setIsPromptOpen] = useState(false);
          const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
          const [isDashboardOpen, setIsDashboardOpen] = useState(false);
          const [isFullPopupOpen, setIsFullPopupOpen] = useState(false);
          const [isDismissed, setIsDismissed] = useState(false); // hidden via context menu "Close"
          const [isLauncherPoppedOut, setIsLauncherPoppedOut] = useState(false); // launcher icon lives in PiP
          const [launcherPipWindow, setLauncherPipWindow] = useState(null);
          const [theme, setTheme] = useState('light');
          const [availableTutorials, setAvailableTutorials] = useState(() =>
            typeof window !== 'undefined' ? getTutorialsForUrl(window.location.href) : []
          );
          const engineRef = useRef(null);

          // Synchronize dark class on uiContainer for Tailwind dark: variants inside Shadow DOM
          useEffect(() => {
            if (uiContainer) {
              uiContainer.classList.toggle('dark', theme === 'dark');
            }
          }, [theme]);

          // Load preferences from storage on mount & listen to live changes
          useEffect(() => {
            try {
              chrome.storage?.local?.get(['guideme_theme', 'guideme_onboarding_done'], (result) => {
                if (result?.guideme_theme) {
                  setTheme(result.guideme_theme);
                } else if (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches) {
                  setTheme('dark');
                }
                if (!result?.guideme_onboarding_done) {
                  setIsOnboardingOpen(true);
                }
              });

              const storageListener = (changes, areaName) => {
                if (areaName === 'local' && changes.guideme_theme) {
                  setTheme(changes.guideme_theme.newValue);
                }
              };
              chrome.storage?.onChanged?.addListener(storageListener);
              return () => chrome.storage?.onChanged?.removeListener(storageListener);
            } catch {
              // Ignore if storage unavailable
            }
          }, []);

          // ── Document PiP window management ──
          const pipRootRef = useRef(null);

          const openPipWindow = useCallback(async () => {
            if (!('documentPictureInPicture' in window)) {
              console.error('[GuideMe] Document PiP API not supported');
              return;
            }
            try {
              const dw = await window.documentPictureInPicture.requestWindow({
                width: 480,
                height: 110,
                disallowReturnToOpener: false,
              });

              // Copy styles from Shadow DOM
              const shadowHost = document.querySelector('guideme-tutorial-root, #guideme-tutorial-root');
              const shadowRoot = shadowHost?.shadowRoot;
              if (shadowRoot) {
                shadowRoot.querySelectorAll('style').forEach((s) => {
                  const c = dw.document.createElement('style');
                  c.textContent = s.textContent;
                  dw.document.head.appendChild(c);
                });
              }

              // Set up the PiP document
              dw.document.body.className = 'bg-transparent m-0 p-0 overflow-hidden';
              const mount = dw.document.createElement('div');
              mount.id = 'guideme-pip-root';
              dw.document.body.appendChild(mount);

              // Render the floating card into the PiP window
              const pipRoot = ReactDOM.createRoot(mount);
              pipRootRef.current = pipRoot;

              const themeClass = theme === 'dark' ? 'dark' : '';
              const langClass = (engineState?.language || 'km') === 'km' ? 'font-kantumruy' : 'font-sans';

              pipRoot.render(
                <div className={`floating-card ${langClass} ${themeClass}`}>
                  <header className="floating-header">
                    <div className="floating-header-title">
                      <div className="floating-header-logo">
                        <GuideMeLogo size={24} />
                      </div>
                      <span className="floating-header-text">Guide Me</span>
                    </div>
                    <button
                      type="button"
                      className="floating-close-btn"
                      onClick={() => dw.close()}
                      aria-label="Close"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </header>
                  <main className="floating-body">
                    <form className="floating-form" onSubmit={(e) => e.preventDefault()}>
                      <div className="floating-input-wrapper">
                        <FiPlus className="floating-input-icon" />
                        <input
                          type="text"
                          className="floating-input"
                          placeholder={getUIString('askAnything', engineState?.language || 'km')}
                          style={{ border: 'none', outline: 'none' }}
                        />
                        <button type="button" className="floating-mic-btn">
                          <FiMic className="w-4 h-4" />
                        </button>
                      </div>
                    </form>
                  </main>
                </div>
              );

              dw.addEventListener('pagehide', () => {
                pipRoot.unmount();
                pipRootRef.current = null;
                setIsLauncherPoppedOut(false);
              });

              setLauncherPipWindow(dw);
            } catch (err) {
              console.error('[GuideMe] PiP open failed:', err);
            }
          }, [theme, engineState?.language]);

          // Cleanup PiP root on unmount
          useEffect(() => {
            return () => {
              if (pipRootRef.current) {
                pipRootRef.current.unmount();
              }
            };
          }, []);

          useEffect(() => {
            const adapter = new ChromeAdapter();

            // Dynamically instantiate AI TTS provider from environment variables
            const ttsProvider = TtsRegistry.fromEnv(import.meta.env);

            const engine = new TutorialEngine({
              adapter,
              ttsProvider,
            });
            engineRef.current = engine;

            const unsubscribe = engine.subscribe((state) => {
              setEngineState(state);

              // Notify background worker of state updates for badge indicators
              try {
                chrome.runtime.sendMessage({
                  action: ExtensionMessageAction.TUTORIAL_STATE_UPDATED,
                  payload: {
                    active: state.isActive,
                    currentStepIndex: state.currentStepIndex,
                    totalSteps: state.totalSteps,
                    language: state.language,
                  },
                });
              } catch (e) {
                // Extension context may be reloading
              }
            });

            // Listen for popup and background runtime commands
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
                  setIsPromptOpen(true);
                  sendResponse({ success: true });
                  break;
                }

                case 'GUIDEME_OPEN_PIP_WINDOW': {
                  // Open the Document PiP window with the floating card
                  setIsDismissed(false);
                  setIsLauncherPoppedOut(true);
                  openPipWindow();
                  sendResponse({ success: true });
                  break;
                }

                case 'GUIDEME_LAUNCHER_DOCKED': {
                  // Floating window was closed — restore in-page UI
                  setIsLauncherPoppedOut(false);
                  setIsDismissed(false);
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
                  try {
                    const prompt = message.payload?.prompt || message.payload?.userPrompt || '';
                    const dynamicTutorial = DynamicPageAnalyzer.generateDynamicTutorial(document, window.location.href, prompt);
                    setIsDismissed(false);
                    setIsPromptOpen(false);
                    setIsFullPopupOpen(false);
                    engine.start(dynamicTutorial, 0);
                    sendResponse({ success: true, tutorialId: dynamicTutorial.id, dynamic: true });
                  } catch (err) {
                    console.error('[GuideMe] Dynamic guide generation failed:', err);
                    sendResponse({ success: false, error: err.message });
                  }
                  break;
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

            chrome.runtime.onMessage.addListener(messageHandler);
            engine.init();

            return () => {
              unsubscribe();
              chrome.runtime.onMessage.removeListener(messageHandler);
              engine.destroy();
            };
          }, []);

          const handleStartDynamicGuide = (prompt) => {
            try {
              const dynamicTutorial = DynamicPageAnalyzer.generateDynamicTutorial(
                document,
                window.location.href,
                prompt
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

          // Launcher popped out to PiP → hide in-page button; docked → show it again
          const handlePopOutLauncher = (action) => {
            if (action === 'pop') {
              setIsLauncherPoppedOut(true);
            } else if (action === 'dock') {
              setIsLauncherPoppedOut(false);
            }
          };

          // If the user dismissed the floating UI via context menu, render nothing
          if (isDismissed) return null;

          // When launcher is popped out to PiP, hide in-page overlays to avoid duplication
          const isInPageHidden = isLauncherPoppedOut;

          return (
            <div className={theme === 'dark' ? 'dark' : ''}>
              <TutorialOverlay
                state={engineState}
                isPromptOpen={isPromptOpen}
                onTogglePrompt={(isOpen) => setIsPromptOpen(isOpen)}
                isOnboardingOpen={isOnboardingOpen}
                onToggleOnboarding={(isOpen) => setIsOnboardingOpen(isOpen)}
                onCompleteOnboarding={() => {
                  setIsOnboardingOpen(false);
                  setIsDashboardOpen(true);
                }}
                isDashboardOpen={isDashboardOpen}
                onToggleDashboard={(isOpen) => setIsDashboardOpen(isOpen)}
                isFullPopupOpen={isFullPopupOpen}
                onToggleFullPopup={(isOpen) => setIsFullPopupOpen(isOpen)}
                onDismiss={() => {
                  setIsPromptOpen(false);
                  setIsOnboardingOpen(false);
                  setIsDashboardOpen(false);
                  setIsFullPopupOpen(false);
                  setIsDismissed(true);
                }}
                onPopOutLauncher={handlePopOutLauncher}
                availableTutorials={availableTutorials}
                onStartDynamicGuide={handleStartDynamicGuide}
                onStartTutorial={handleStartTutorial}
                onLanguageChange={(newLang) => engineRef.current?.setLanguage(newLang)}
                onReplayAudio={() => engineRef.current?.getAudioEngine()?.replay()}
                onNext={() => engineRef.current?.nextStep()}
                onPrev={() => engineRef.current?.prevStep()}
                onSkip={() => engineRef.current?.skipStep()}
                onClose={() => engineRef.current?.stop()}
                theme={theme}
                onThemeChange={(newTheme) => {
                  setTheme(newTheme);
                  try {
                    chrome.storage?.local?.set({ guideme_theme: newTheme });
                  } catch { }
                }}
              />
            </div>
          );
        }

        root.render(<TutorialApp />);
        return root;
      },
      onRemove(root) {
        if (typeof window !== 'undefined') {
          window.__GUIDEME_MOUNTED__ = false;
        }
        root?.unmount();
      },
    });

    ctx.onInvalidated(() => {
      if (typeof window !== 'undefined') {
        window.__GUIDEME_MOUNTED__ = false;
      }
      ui.remove();
    });

    ui.mount();
  },
});
