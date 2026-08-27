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
import { PopupHeader } from './components/PopupHeader.jsx';
import { PromptInput } from './components/PromptInput.jsx';
import { SettingsOverlay } from './components/SettingsOverlay.jsx';

/**
 * App — Root coordinator component for GuideMe Chrome Extension popup.
 */
export default function App() {
  const [currentTab, setCurrentTab] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState('km');
  const [theme, setTheme] = useState('light');
  const [currentSpeaker, setCurrentSpeaker] = useState('default');
  const [history, setHistory] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const isKhmer = currentLanguage === 'km';
  const isChromeInternalUrl =
    (currentTab?.url || '').startsWith('chrome://') ||
    (currentTab?.url || '').startsWith('edge://') ||
    (currentTab?.url || '').startsWith('about:');

  // Sync dark class on documentElement for Tailwind dark: support
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Speech recognition hook
  const { isListening, supported: speechSupported, start: startSpeech, stop: stopSpeech } =
    useSpeechRecognition({
      onResult: (transcript) => setCustomPrompt(transcript),
      onEnd: () => {},
    });

  // Load preferences from chrome.storage on mount
  useEffect(() => {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        setCurrentTab(tab);

        const stored = await chrome.storage.local.get([
          STORAGE_KEY_LANG,
          STORAGE_KEY_THEME,
          STORAGE_KEY_SPEAKER,
          STORAGE_KEY_HISTORY,
        ]);
        if (stored[STORAGE_KEY_LANG]) setCurrentLanguage(stored[STORAGE_KEY_LANG]);
        if (stored[STORAGE_KEY_THEME]) setTheme(stored[STORAGE_KEY_THEME]);
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

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    chrome.storage.local.set({ [STORAGE_KEY_THEME]: newTheme });
    if (currentTab?.id && !isChromeInternalUrl) {
      chrome.tabs.sendMessage(currentTab.id, { action: 'GUIDEME_SET_THEME', payload: { theme: newTheme } }, () => {});
    }
  };

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

  const handleLoadHistory = (item) => {
    setCustomPrompt(item);
    setShowSettings(false);
  };

  const handleClearHistory = () => {
    setHistory([]);
    chrome.storage.local.set({ [STORAGE_KEY_HISTORY]: [] });
  };

  const handleExtractUI = () => {
    if (!currentTab?.id || isChromeInternalUrl) return;
    chrome.tabs.sendMessage(currentTab.id, { action: ExtensionMessageAction.OPEN_FLOATING_PROMPT }, () =>
      window.close()
    );
  };

  const handleSubmitPrompt = async (e) => {
    e?.preventDefault();
    const prompt = customPrompt.trim();
    if (!prompt || !currentTab?.id) return;

    const newHistory = [prompt, ...history.filter((h) => h !== prompt)].slice(0, 20);
    setHistory(newHistory);
    chrome.storage.local.set({ [STORAGE_KEY_HISTORY]: newHistory });

    setIsProcessing(true);
    const payload = {
      action: ExtensionMessageAction.START_DYNAMIC_GUIDE,
      payload: { prompt },
    };

    chrome.tabs.sendMessage(currentTab.id, payload, async (res) => {
      if (chrome.runtime.lastError || !res?.success) {
        try {
          await chrome.scripting?.executeScript({
            target: { tabId: currentTab.id },
            files: ['content-scripts/content.js'],
          });
          setTimeout(() => chrome.tabs.sendMessage(currentTab.id, payload, () => window.close()), 350);
          return;
        } catch (err) {
          console.error('[GuideMe Popup] Failed to inject content script:', err);
          setIsProcessing(false);
          return;
        }
      }
      window.close();
    });
  };

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

  return (
    <div
      className={`w-[360px] h-[380px] overflow-hidden relative flex flex-col ${
        theme === 'dark' ? 'dark bg-[#1e1e2e] text-zinc-200' : 'bg-white text-gray-900'
      } transition-colors duration-200 ${isKhmer ? 'font-kantumruy' : 'font-sans'}`}
    >
      {/* Slide-over Settings overlay */}
      <SettingsOverlay
        open={showSettings}
        currentLanguage={currentLanguage}
        onLanguageChange={handleLanguageChange}
        theme={theme}
        onThemeChange={handleThemeChange}
        currentSpeaker={currentSpeaker}
        onSpeakerChange={handleSpeakerChange}
        history={history}
        onLoadHistory={handleLoadHistory}
        onClearHistory={handleClearHistory}
        onClose={() => setShowSettings(false)}
        onExtractUI={handleExtractUI}
        isChromeInternalUrl={isChromeInternalUrl}
      />

      {/* ── Main View ── */}
      <PopupHeader
        currentLanguage={currentLanguage}
        onLanguageChange={handleLanguageChange}
        theme={theme}
        onThemeChange={handleThemeChange}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Primary Call to Action Button */}
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
          className={`w-full font-semibold text-[15px] py-3 rounded-xl transition-all shadow-md ${
            isChromeInternalUrl
              ? 'bg-purple-300 dark:bg-purple-900/50 text-white/70 cursor-not-allowed shadow-none'
              : 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-purple-500/25 cursor-pointer'
          }`}
        >
          {getUIString('extractUI', currentLanguage)}
        </button>

        {/* Prompt Input Form */}
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
  );
}
