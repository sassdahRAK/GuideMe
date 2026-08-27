import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import ReactDOM from 'react-dom/client';
import React, { useEffect, useState, useRef } from 'react';
import { TutorialEngine, DynamicPageAnalyzer } from '@guideme/engine';
import { ChromeAdapter } from '@guideme/chrome-adapter';
import { TutorialOverlay } from '@guideme/tutorial-ui';
import { ExtensionMessageAction, Language } from '@guideme/core-types';
import './style.css';

import { TUTORIAL_CATALOG, getTutorialsForUrl } from '../../src/catalog.js';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
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

          // Load theme preference from storage on mount
          useEffect(() => {
            try {
              chrome.storage?.local?.get(['guideme_theme'], (result) => {
                if (result?.guideme_theme) {
                  setTheme(result.guideme_theme);
                }
              });
            } catch {
              // Ignore if storage unavailable
            }
          }, []);

          useEffect(() => {
            const adapter = new ChromeAdapter();
            const engine = new TutorialEngine({ adapter });
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

                case ExtensionMessageAction.OPEN_FLOATING_PROMPT: {
                  setIsPromptOpen(true);
                  sendResponse({ success: true });
                  break;
                }

                case ExtensionMessageAction.START_TUTORIAL: {
                  const tutorial = TUTORIAL_CATALOG.find((t) => t.id === message.payload?.tutorialId) || TUTORIAL_CATALOG[0];
                  if (tutorial) {
                    setIsPromptOpen(false);
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
                    setIsPromptOpen(false);
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
              engineRef.current?.start(dynamicTutorial, 0);
            } catch (err) {
              console.error('[GuideMe] Dynamic guide generation failed:', err);
            }
          };

          const handleStartTutorial = (tutorialId) => {
            const tutorial = TUTORIAL_CATALOG.find((t) => t.id === tutorialId) || TUTORIAL_CATALOG[0];
            if (tutorial) {
              setIsPromptOpen(false);
              engineRef.current?.start(tutorial, 0);
            }
          };

          return (
            <div className={theme === 'dark' ? 'dark' : ''}>
              <TutorialOverlay
                state={engineState}
                isPromptOpen={isPromptOpen}
                onTogglePrompt={(isOpen) => setIsPromptOpen(isOpen)}
                availableTutorials={availableTutorials}
                onStartDynamicGuide={handleStartDynamicGuide}
                onStartTutorial={handleStartTutorial}
                onLanguageChange={(newLang) => engineRef.current?.setLanguage(newLang)}
                onReplayAudio={() => engineRef.current?.getAudioEngine()?.replay()}
                onNext={() => engineRef.current?.nextStep()}
                onPrev={() => engineRef.current?.prevStep()}
                onSkip={() => engineRef.current?.skipStep()}
                onClose={() => engineRef.current?.stop()}
              />
            </div>
          );
        }

        root.render(<TutorialApp />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
