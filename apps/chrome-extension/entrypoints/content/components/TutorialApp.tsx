import React, { useState, useEffect, type ReactNode } from 'react';
import { TutorialOverlay } from '@guideme/tutorial-ui';
import { useContentBridge } from '../hooks/useContentBridge.ts';

interface TutorialErrorBoundaryProps {
  children: ReactNode;
}

interface TutorialErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class TutorialErrorBoundary extends React.Component<TutorialErrorBoundaryProps, TutorialErrorBoundaryState> {
  constructor(props: TutorialErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): TutorialErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[GuideMe Content Script] ErrorBoundary caught tutorial UI error:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export interface TutorialAppProps {
  uiContainer?: HTMLElement | null;
}

export function TutorialApp({ uiContainer }: TutorialAppProps): React.ReactElement {
  const [theme, setTheme] = useState<'light' | 'dark' | string>('light');
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isFullPopupOpen, setIsFullPopupOpen] = useState(false);
  const [_isDismissed, setIsDismissed] = useState(false);

  // Synchronize dark class on uiContainer for Tailwind dark: variants inside Shadow DOM
  useEffect(() => {
    if (uiContainer) {
      uiContainer.classList.toggle('dark', theme === 'dark');
    }
  }, [theme, uiContainer]);

  // Load preferences from storage on mount & listen to live changes
  useEffect(() => {
    try {
      chrome.storage?.local?.get(['guideme_theme', 'guideme_is_chat_open', 'guideme_popup_open'], (result: Record<string, any>) => {
        if (result?.guideme_theme) {
          setTheme(String(result.guideme_theme));
        } else if (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches) {
          setTheme('dark');
        }
        if (typeof result?.guideme_is_chat_open === 'boolean') {
          setIsPromptOpen(result.guideme_is_chat_open);
        }
        if (result?.guideme_popup_open === true) {
          setIsFullPopupOpen(true);
        }
      });

      const storageListener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
        if (areaName === 'local') {
          if (changes.guideme_theme) {
            setTheme(String(changes.guideme_theme.newValue));
          }
          if (changes.guideme_is_chat_open !== undefined) {
            setIsPromptOpen(Boolean(changes.guideme_is_chat_open.newValue));
          }
          if (changes.guideme_popup_open !== undefined) {
            setIsFullPopupOpen(Boolean(changes.guideme_popup_open.newValue));
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

  const lang = engineState?.language || 'km';

  const OverlayComponent = TutorialOverlay as React.ComponentType<any>;

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''} ${lang === 'km' ? 'font-kantumruy' : 'font-sans'}`}>
      <TutorialErrorBoundary>
        <OverlayComponent
          state={engineState}
          isPromptOpen={isPromptOpen}
          onTogglePrompt={(isOpen: boolean) => {
            setIsPromptOpen(isOpen);
            try {
              chrome.storage?.local?.set({ guideme_is_chat_open: isOpen });
            } catch { }
          }}
          isOnboardingOpen={isOnboardingOpen}
          onToggleOnboarding={(isOpen: boolean) => {
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
          onToggleDashboard={(isOpen: boolean) => setIsDashboardOpen(isOpen)}
          isFullPopupOpen={isFullPopupOpen}
          onToggleFullPopup={(isOpen: boolean) => setIsFullPopupOpen(isOpen)}
          onDismiss={() => {
            setIsPromptOpen(false);
            setIsOnboardingOpen(false);
            setIsDashboardOpen(false);
            setIsFullPopupOpen(false);
            engineRef.current?.stop();
          }}
          availableTutorials={availableTutorials as any}
          onStartDynamicGuide={handleStartDynamicGuide}
          onStartTutorial={handleStartTutorial}
          onLanguageChange={(newLang: any) => engineRef.current?.setLanguage(newLang)}
          onReplayAudio={() => engineRef.current?.getAudioEngine()?.replay()}
          onToggleMute={() => engineRef.current?.toggleMute()}
          onVolumeChange={(vol: number) => engineRef.current?.setVolume(vol)}
          onNext={() => engineRef.current?.nextStep(true)}
          onPrev={() => engineRef.current?.prevStep()}
          onSkip={() => engineRef.current?.skipStep()}
          onClose={() => engineRef.current?.stop()}
          onRetryLocateTarget={() => engineRef.current?.retryLocateTarget()}
          theme={theme}
          onThemeChange={(newTheme: any) => {
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
