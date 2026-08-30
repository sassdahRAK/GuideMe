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
const INITIAL_GREETINGS = {
  km: "សួស្ដី! ខ្ញុំជាជំនួយការ AI របស់ GuideMe។ ខ្ញុំអាចជួយអ្នកបង្កើតការណែនាំ ពន្យល់ពីប៊ូតុងនានា ឬឆ្លើយសំណួរអំពីទំព័រវេបសាយនេះ។ តើអ្នកចង់ឱ្យខ្ញុំជួយអ្វីដែរ?",
  en: "Hi! I'm your GuideMe AI assistant. I can help you create guides, explain page elements, or answer questions about any webpage. What would you like to do?",
};

/** A simple timestamp like "Just now" or "ឥឡូវនេះ" */
function nowTime(lang = 'km') {
  return getUIString('justNow', lang);
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
  const [messages,      setMessages]      = useState(() => [
    {
      role: 'assistant',
      content: INITIAL_GREETINGS.km,
      time: nowTime('km'),
    },
  ]);
  const [customPrompt,  setCustomPrompt]  = useState('');

  // Update initial greeting if chat is still untouched when language changes
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === 'assistant') {
        return [
          {
            role: 'assistant',
            content: INITIAL_GREETINGS[currentLanguage] || INITIAL_GREETINGS.km,
            time: nowTime(currentLanguage),
          },
        ];
      }
      return prev;
    });
  }, [currentLanguage]);

  const isChromeInternalUrl =
    (currentTab?.url || '').startsWith('chrome://') ||
    (currentTab?.url || '').startsWith('edge://')   ||
    (currentTab?.url || '').startsWith('about:');

  // Sync dark class on <html> for Tailwind dark: support
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // ── Load preferences on mount & listen to live changes ─────────────────────
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
        // NOTE: We do NOT close the popup here — the popup should stay open so
        // the user can interact with the chat UI. The onboarding overlay renders
        // on the page *alongside* the popup, not instead of it.
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
                  // Retry after injection — but do NOT close the popup
                  setTimeout(() => chrome.tabs.sendMessage(tab.id, payload, () => {}), 300);
                } catch (err) {
                  console.warn('[GuideMe Popup] Could not inject content script for onboarding:', err);
                }
              }
            });
          }
        }

        if (stored[STORAGE_KEY_LANG]) setCurrentLanguage(stored[STORAGE_KEY_LANG]);
        if (stored[STORAGE_KEY_THEME]) {
          setTheme(stored[STORAGE_KEY_THEME]);
        } else if (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches) {
          setTheme('dark');
        }
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

    // Listen for storage changes from in-page overlays
    const storageListener = (changes, areaName) => {
      if (areaName === 'local') {
        if (changes[STORAGE_KEY_THEME]) {
          setTheme(changes[STORAGE_KEY_THEME].newValue);
        }
        if (changes[STORAGE_KEY_LANG]) {
          setCurrentLanguage(changes[STORAGE_KEY_LANG].newValue);
        }
      }
    };
    chrome.storage?.onChanged?.addListener(storageListener);
    return () => chrome.storage?.onChanged?.removeListener(storageListener);
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

  // ── Extract UI — Open floating always-on-top popup window ────────────────────
  const handleExtractUI = () => {
    if (isChromeInternalUrl) return;
    // Tell background to create the floating window
    chrome.runtime.sendMessage({ action: 'GUIDEME_POPOUT_LAUNCHER' }, (res) => {
      if (chrome.runtime.lastError) {
        console.error('[GuideMe Popup] Failed to open floating window:', chrome.runtime.lastError);
        return;
      }
      // Only close the popup if the PiP window was actually created successfully
      if (res?.success !== true) {
        console.error('[GuideMe Popup] PiP window creation failed:', res?.error || 'Unknown error');
        return;
      }
      // Close the popup — the floating window now holds the UI
      window.close();
    });
  };

  // ── Open Dashboard as standalone window (outside Chrome) ──
  const handleOpenDashboard = () => {
    chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD_STANDALONE' }, (res) => {
      if (chrome.runtime.lastError) {
        console.error('[GuideMe Popup] Failed to open dashboard window:', chrome.runtime.lastError);
        return;
      }
      // Only close the popup if the dashboard window was created successfully
      if (res?.success !== true) {
        console.error('[GuideMe Popup] Dashboard window creation failed:', res?.error || 'Unknown error');
        return;
      }
      // Close the popup — the dashboard now lives in its own window
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
    const userMsg = { role: 'user', content: prompt, time: nowTime(currentLanguage) };
    setMessages((prev) => [...prev, userMsg]);
    setCustomPrompt('');

    // AI dynamic reply
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      const contextualReplies = {
        km: [
          "ខ្ញុំអាចជួយអ្នកបាន! ចុច 'បំបែក UI ចេញពីផ្ទាំងនេះ' ដើម្បីចាប់ផ្ដើមការណែនាំជាជំហានៗលើទំព័រនេះ។",
          "សំណួរល្អណាស់! ខ្ញុំកំពុងវិភាគទំព័រវេបសាយនេះដើម្បីផ្ដល់ការណែនាំដ៏ល្អបំផុតសម្រាប់អ្នក។",
          "យល់ហើយ! អ្នកអាចចាប់ផ្ដើមមេរៀន ឬសួរខ្ញុំឱ្យពន្យល់ពីប៊ូតុង ឬទម្រង់ណាមួយលើអេក្រង់នេះ។",
        ],
        en: [
          "I can help you with that! Click 'Extract Separate UI' to start interactive step-by-step guidance on this page.",
          "Great question! I'm analyzing this webpage to provide the best walkthrough for you.",
          "Got it! You can start a tutorial or ask me to explain any specific button or form on this screen.",
        ],
      };
      const list = contextualReplies[currentLanguage] || contextualReplies.km;
      const reply = list[Math.floor(Math.random() * list.length)];
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply, time: nowTime(currentLanguage) },
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
    <div className={`popup-window slide-in ${currentLanguage === 'km' ? 'font-kantumruy' : 'font-sans'}`}>
      {/* Settings slide-in overlay (absolute, covers the popup) */}
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
            {getUIString('openDashboard', currentLanguage)}
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
