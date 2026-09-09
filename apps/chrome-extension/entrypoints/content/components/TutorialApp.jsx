import React, { useState, useEffect } from 'react';
import { TutorialOverlay } from '@guideme/tutorial-ui';
import { useContentBridge } from '../hooks/useContentBridge.js';

/**
 * Defensive ErrorBoundary to ensure any child component error never unmounts
 * or crashes the in-page Shadow DOM tutorial root.
 */
class TutorialErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[GuideMe Content Script] ErrorBoundary caught tutorial UI error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

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
      chrome.storage?.local?.get(['guideme_theme', 'guideme_is_chat_open'], (result) => {
        if (result?.guideme_theme) {
          setTheme(result.guideme_theme);
        } else if (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches) {
          setTheme('dark');
        }
        if (typeof result?.guideme_is_chat_open === 'boolean') {
          setIsPromptOpen(result.guideme_is_chat_open);
        }
      });

      const storageListener = (changes, areaName) => {
        if (areaName === 'local') {
          if (changes.guideme_theme) {
            setTheme(changes.guideme_theme.newValue);
          }
          if (changes.guideme_is_chat_open !== undefined) {
            setIsPromptOpen(Boolean(changes.guideme_is_chat_open.newValue));
          }
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
    setIsDismissed,
  });

  // The Floating Assistant Button stays permanently visible on screen (never unmounts)
  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <TutorialErrorBoundary>
        <TutorialOverlay
        state={engineState}
        isPromptOpen={isPromptOpen}
        onTogglePrompt={(isOpen) => {
          setIsPromptOpen(isOpen);
          try {
            chrome.storage?.local?.set({ guideme_is_chat_open: isOpen });
          } catch { }
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
        onToggleMute={() => engineRef.current?.toggleMute()}
        onVolumeChange={(vol) => engineRef.current?.setVolume(vol)}
        onNext={() => engineRef.current?.nextStep(true)}
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
      </TutorialErrorBoundary>
    </div>
  );
}
