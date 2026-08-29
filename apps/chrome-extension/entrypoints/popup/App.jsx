import React, { useEffect, useState } from 'react';
import { ExtensionMessageAction } from '@guideme/core-types';
import { getUIString } from '@guideme/tutorial-ui';

import {
  STORAGE_KEY_LANG,
  STORAGE_KEY_THEME,
  STORAGE_KEY_SPEAKER,
  STORAGE_KEY_HISTORY,
} from './constants.js';
import { useSpeechRecognition } from './hooks/useSpeechRecognition.js';
import { PopupHeader }     from './components/PopupHeader.jsx';
import { PromptInput }     from './components/PromptInput.jsx';
import { SettingsOverlay } from './components/SettingsOverlay.jsx';
import { ChatArea }        from './components/ChatArea.jsx';

/** Initial greeting from GuideMe AI assistant */
const INITIAL_ASSISTANT_MESSAGE = {
  role: 'assistant',
  content:
    "Hi! I'm your GuideMe AI assistant. I can help you create guides, explain page elements, or answer questions about any webpage. What would you like to do?",
  time: 'Now',
};

/** A simple timestamp like "Just now" or "10:32 AM" */
function nowTime() {
  return 'Just now';
}

/**
 * App — Root coordinator for GuideMe Chrome Extension popup.
 */
export default function App() {
  // ── Preferences ─────────────────────────────────────────────────────────────
  const [currentTab,        setCurrentTab]        = useState(null);
  const [currentLanguage,   setCurrentLanguage]   = useState('km');
  const [theme,             setTheme]             = useState('light');
  const [currentSpeaker,    setCurrentSpeaker]    = useState('default');
  const [history,           setHistory]           = useState([]);
  const [showSettings,      setShowSettings]      = useState(false);
  const [isProcessing,      setIsProcessing]      = useState(false);

  // ── Chat state ──────────────────────────────────────────────────────────────
  const [messages,      setMessages]      = useState([INITIAL_ASSISTANT_MESSAGE]);
  const [customPrompt,  setCustomPrompt]  = useState('');

  const isChromeInternalUrl =
    (currentTab?.url || '').startsWith('chrome://') ||
    (currentTab?.url || '').startsWith('edge://')   ||
    (currentTab?.url || '').startsWith('about:');

  // Sync dark class on <html> for Tailwind dark: support
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // ── Load preferences on mount ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        setCurrentTab(tab);

        const stored = await chrome.storage.local.get([
          'guideme_onboarding_done',
          STORAGE_KEY_LANG,
          STORAGE_KEY_THEME,
          STORAGE_KEY_SPEAKER,
          STORAGE_KEY_HISTORY,
        ]);

        // First time open: Launch in-page onboarding overlay on active tab
        if (!stored.guideme_onboarding_done) {
          if (tab?.id && !tab.url?.startsWith('chrome://') && !tab.url?.startsWith('chrome-extension://')) {
            const payload = { action: 'OPEN_ONBOARDING_OVERLAY' };
            chrome.tabs.sendMessage(tab.id, payload, async (res) => {
              if (chrome.runtime.lastError || !res?.success) {
                try {
                  await chrome.scripting?.executeScript({
                    target: { tabId: tab.id },
                    files: ['content-scripts/content.js'],
                  });
                  setTimeout(() => chrome.tabs.sendMessage(tab.id, payload, () => window.close()), 300);
                  return;
                } catch { }
              }
              window.close();
            });
            return;
          }
        }

        if (stored[STORAGE_KEY_LANG])    setCurrentLanguage(stored[STORAGE_KEY_LANG]);
        if (stored[STORAGE_KEY_THEME])   setTheme(stored[STORAGE_KEY_THEME]);
        if (stored[STORAGE_KEY_SPEAKER]) setCurrentSpeaker(stored[STORAGE_KEY_SPEAKER]);
        if (stored[STORAGE_KEY_HISTORY]) setHistory(stored[STORAGE_KEY_HISTORY]);

        if (tab?.id && !tab.url?.startsWith('chrome://')) {
          chrome.tabs.sendMessage(tab.id, { action: ExtensionMessageAction.GET_TUTORIAL_STATUS }, (res) => {
            if (!chrome.runtime.lastError && res?.state?.language) {
              setCurrentLanguage(res.state.language);
            }
          });
        }
      } catch (err) {
        console.warn('[GuideMe Popup] Init error:', err);
      }
    })();
  }, []);

  // ── Language ─────────────────────────────────────────────────────────────────
  const handleLanguageChange = (lang) => {
    setCurrentLanguage(lang);
    chrome.storage.local.set({ [STORAGE_KEY_LANG]: lang });
    if (currentTab?.id && !isChromeInternalUrl) {
      chrome.tabs.sendMessage(
        currentTab.id,
        { action: ExtensionMessageAction.SET_LANGUAGE, payload: { language: lang } },
        () => {}
      );
    }
  };

  // ── Theme ────────────────────────────────────────────────────────────────────
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    chrome.storage.local.set({ [STORAGE_KEY_THEME]: newTheme });
    if (currentTab?.id && !isChromeInternalUrl) {
      chrome.tabs.sendMessage(
        currentTab.id,
        { action: 'GUIDEME_SET_THEME', payload: { theme: newTheme } },
        () => {}
      );
    }
  };

  // ── Speaker ──────────────────────────────────────────────────────────────────
  const handleSpeakerChange = (speakerId) => {
    setCurrentSpeaker(speakerId);
    chrome.storage.local.set({ [STORAGE_KEY_SPEAKER]: speakerId });
    if (currentTab?.id && !isChromeInternalUrl) {
      chrome.tabs.sendMessage(
        currentTab.id,
        { action: 'GUIDEME_SET_SPEAKER', payload: { speaker: speakerId } },
        () => {}
      );
    }
  };

  // ── History ──────────────────────────────────────────────────────────────────
  const handleLoadHistory = (item) => {
    setCustomPrompt(item);
    setShowSettings(false);
  };

  const handleClearHistory = () => {
    setHistory([]);
    chrome.storage.local.set({ [STORAGE_KEY_HISTORY]: [] });
  };

  // ── Extract UI ───────────────────────────────────────────────────────────────
  const handleExtractUI = () => {
    if (!currentTab?.id || isChromeInternalUrl) return;
    const payload = { action: ExtensionMessageAction.OPEN_FLOATING_PROMPT };
    chrome.tabs.sendMessage(currentTab.id, payload, async (res) => {
      if (chrome.runtime.lastError || !res?.success) {
        try {
          await chrome.scripting?.executeScript({
            target: { tabId: currentTab.id },
            files: ['content-scripts/content.js'],
          });
          setTimeout(() => chrome.tabs.sendMessage(currentTab.id, payload, () => window.close()), 300);
          return;
        } catch (err) {
          console.error('[GuideMe Popup] Failed to inject content script:', err);
        }
      }
      window.close();
    });
  };

  // ── Open Dashboard ───────────────────────────────────────────────────────────
  const handleOpenDashboard = () => {
    if (!currentTab?.id || isChromeInternalUrl) {
      window.close();
      return;
    }

    const payload = { action: 'OPEN_DASHBOARD_OVERLAY' };
    chrome.tabs.sendMessage(currentTab.id, payload, async (res) => {
      if (chrome.runtime.lastError || !res?.success) {
        try {
          await chrome.scripting?.executeScript({
            target: { tabId: currentTab.id },
            files: ['content-scripts/content.js'],
          });
          setTimeout(() => chrome.tabs.sendMessage(currentTab.id, payload, () => window.close()), 300);
          return;
        } catch (err) {
          console.error('[GuideMe Popup] Failed to inject content script:', err);
        }
      }
      window.close();
    });
  };

  // ── Chat / Submit prompt ──────────────────────────────────────────────────────
  const handleSubmitPrompt = async (e) => {
    e?.preventDefault();
    const prompt = customPrompt.trim();
    if (!prompt) return;

    // Save to history
    const newHistory = [prompt, ...history.filter((h) => h !== prompt)].slice(0, 20);
    setHistory(newHistory);
    chrome.storage.local.set({ [STORAGE_KEY_HISTORY]: newHistory });

    // Add user message to chat immediately
    const userMsg = { role: 'user', content: prompt, time: nowTime() };
    setMessages((prev) => [...prev, userMsg]);
    setCustomPrompt('');

    // AI dynamic reply
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      const contextualReplies = [
        "I can help you with that! Click 'Extract Separate UI' to start interactive step-by-step guidance on this page.",
        "Great question! I'm analyzing this webpage to provide the best walkthrough for you.",
        "Got it! You can start a tutorial or ask me to explain any specific button or form on this screen.",
      ];
      const reply = contextualReplies[Math.floor(Math.random() * contextualReplies.length)];
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, time: 'Just now' },
      ]);
    }, 600);
  };

  // ── Speech recognition ────────────────────────────────────────────────────────
  const { isListening, supported: speechSupported, start: startSpeech, stop: stopSpeech } =
    useSpeechRecognition({
      onResult: (transcript) => setCustomPrompt(transcript),
      onEnd: () => {},
    });

  const handleMicToggle = () => {
    if (!speechSupported) {
      alert(getUIString('voiceNotSupported', currentLanguage));
      return;
    }
    if (isListening) {
      stopSpeech();
    } else {
      setCustomPrompt('');
      startSpeech(currentLanguage);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="popup-window slide-in">
      {/* Settings slide-in overlay (absolute, covers the popup) */}
      <SettingsOverlay
        open={showSettings}
        currentLanguage={currentLanguage}
        onLanguageChange={handleLanguageChange}
        currentSpeaker={currentSpeaker}
        onSpeakerChange={handleSpeakerChange}
        history={history}
        onLoadHistory={handleLoadHistory}
        onClearHistory={handleClearHistory}
        onClose={() => setShowSettings(false)}
        onExtractUI={handleExtractUI}
        isChromeInternalUrl={isChromeInternalUrl}
      />

      {/* Header */}
      <PopupHeader
        currentLanguage={currentLanguage}
        onLanguageChange={handleLanguageChange}
        theme={theme}
        onThemeChange={handleThemeChange}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Body — chat messages */}
      <div className="popup-body">
        <ChatArea messages={messages} />

        {/* Bottom action bar */}
        <div className="popup-bottom">
          {/* Extract Separate UI */}
          <button
            type="button"
            id="extract-ui-btn"
            onClick={handleExtractUI}
            disabled={isChromeInternalUrl}
            title={
              isChromeInternalUrl
                ? getUIString('extractUIDisabledTooltip', currentLanguage)
                : getUIString('extractUITooltip', currentLanguage)
            }
            className="btn-primary btn-extract"
          >
            {getUIString('extractUI', currentLanguage)}
          </button>

          {/* Open Dashboard */}
          <button
            type="button"
            id="open-dashboard-btn"
            onClick={handleOpenDashboard}
            className="btn-primary btn-dashboard"
          >
            Open Dashboard
          </button>

          {/* Prompt input row */}
          <div className="mt-2.5">
            <PromptInput
              customPrompt={customPrompt}
              onPromptChange={setCustomPrompt}
              onSubmit={handleSubmitPrompt}
              isProcessing={isProcessing}
              isListening={isListening}
              speechSupported={speechSupported}
              onMicToggle={handleMicToggle}
              currentLanguage={currentLanguage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
