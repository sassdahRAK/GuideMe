import React, { useState, useEffect } from 'react';
import { TutorialOverlay } from '@guideme/tutorial-ui';
import { useCaptureMode } from '../hooks/useCaptureMode.js';
import { useContentBridge } from '../hooks/useContentBridge.js';

/**
 * Pure presentation component orchestrating GuideMe's in-page tutorial overlays.
 */
export function TutorialApp({ uiContainer }) {
  const [theme, setTheme] = useState('light');
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isFullPopupOpen, setIsFullPopupOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Synchronize dark class on uiContainer for Tailwind dark: variants inside Shadow DOM
  useEffect(() => {
    if (uiContainer) {
      uiContainer.classList.toggle('dark', theme === 'dark');
    }
  }, [theme, uiContainer]);

  // Load preferences from storage on mount & listen to live changes
  useEffect(() => {
    try {
      chrome.storage?.local?.get(['guideme_theme'], (result) => {
        if (result?.guideme_theme) {
          setTheme(result.guideme_theme);
        } else if (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches) {
          setTheme('dark');
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

  // ── 1. Content Script Messaging & Tutorial Engine Bridge ──
  const {
    engineRef,
    engineState,
    availableTutorials,
    handleStartDynamicGuide,
    handleStartTutorial,
  } = useContentBridge({
    setTheme,
    setIsPromptOpen,
    setIsOnboardingOpen,
    setIsDashboardOpen,
    setIsFullPopupOpen,
    setIsCaptureMode: (active) => {
      if (active) startCapture();
      else cancelCapture();
    },
    setIsDismissed,
  });

  // ── 2. Element Capture Mode Logic ──
  const {
    isCaptureMode,
    captureTargetBoundingBox,
    startCapture,
    cancelCapture,
  } = useCaptureMode(engineRef);

  // The Floating Assistant Button stays permanently visible on screen (never unmounts)
  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <TutorialOverlay
        state={engineState}
        isPromptOpen={isPromptOpen}
        onTogglePrompt={(isOpen) => {
          if (isOpen === false) {
            setIsPromptOpen(false);
            return;
          }
          // Launch / focus PiP companion window; if unavailable/fails, fallback to in-page prompt widget
          try {
            chrome.runtime?.sendMessage({ action: 'GUIDEME_POPOUT_LAUNCHER' }, (res) => {
              if (chrome.runtime?.lastError || !res?.success) {
                // Fallback to in-page floating prompt widget
                setIsPromptOpen(true);
              } else {
                // PiP opened successfully; in-page prompt stays closed, assistant button remains visible!
                setIsPromptOpen(false);
              }
            });
          } catch {
            setIsPromptOpen(true);
          }
        }}
        isOnboardingOpen={isOnboardingOpen}
        onToggleOnboarding={(isOpen) => {
          setIsOnboardingOpen(isOpen);
          if (!isOpen) {
            try { chrome.storage?.local?.set({ guideme_onboarding_done: true }); } catch { }
          }
        }}
        onCompleteOnboarding={() => {
          setIsOnboardingOpen(false);
          setIsDashboardOpen(true);
          try { chrome.storage?.local?.set({ guideme_onboarding_done: true }); } catch { }
        }}
        isDashboardOpen={isDashboardOpen}
        onToggleDashboard={(isOpen) => setIsDashboardOpen(isOpen)}
        isFullPopupOpen={isFullPopupOpen}
        onToggleFullPopup={(isOpen) => setIsFullPopupOpen(isOpen)}
        isCaptureMode={isCaptureMode}
        captureTargetBoundingBox={captureTargetBoundingBox}
        onStartCapture={() => {
          startCapture();
          setIsPromptOpen(false);
          setIsDashboardOpen(false);
        }}
        onCancelCapture={cancelCapture}
        onDismiss={() => {
          setIsPromptOpen(false);
          setIsOnboardingOpen(false);
          setIsDashboardOpen(false);
          setIsFullPopupOpen(false);
          engineRef.current?.stop();
        }}
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
