import React, { useEffect, useState } from 'react';
import { ExtensionMessageAction } from '@guideme/core-types';
import { getUIString } from '@guideme/tutorial-ui';
import { classifyPrompt } from '@guideme/engine';
import { LoginOverlay } from './components/LoginOverlay.jsx';

import {
  STORAGE_KEY_LANG,
  STORAGE_KEY_THEME,
  STORAGE_KEY_SPEAKER,
  STORAGE_KEY_HISTORY,
  STORAGE_KEY_AUTH_TOKEN,
  STORAGE_KEY_USER_PROFILE,
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
  const [authToken,         setAuthToken]         = useState(null);
  const [userProfile,       setUserProfile]       = useState(null);
  const [showLogin,         setShowLogin]         = useState(false);

  // ── Chat state ──────────────────────────────────────────────────────────────
  const [messages,      setMessages]      = useState([]);
  const [customPrompt,  setCustomPrompt]  = useState('');

  // Helper to persist messages to storage and state
  const updateMessages = (newMessages) => {
    setMessages(newMessages);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ guideme_chat_messages: newMessages });
    }
  };

  // Update initial greeting if chat is still untouched when language changes
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === 'assistant') {
        const updated = [
          {
            role: 'assistant',
            content: INITIAL_GREETINGS[currentLanguage] || INITIAL_GREETINGS.km,
            time: nowTime(currentLanguage),
          },
        ];
        if (typeof chrome !== 'undefined' && chrome.storage) {
           chrome.storage.local.set({ guideme_chat_messages: updated });
        }
        return updated;
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
    // Signal to content script that popup window is open → hides FAB
    chrome.storage?.local?.set({ guideme_popup_open: true });
    window.addEventListener('beforeunload', () => {
      chrome.storage?.local?.set({ guideme_popup_open: false });
    });

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
          STORAGE_KEY_AUTH_TOKEN,
          STORAGE_KEY_USER_PROFILE,
          'guideme_chat_messages',
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

        if (stored[STORAGE_KEY_LANG]) setCurrentLanguage(stored[STORAGE_KEY_LANG]);
        if (stored[STORAGE_KEY_THEME]) {
          setTheme(stored[STORAGE_KEY_THEME]);
        } else if (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches) {
          setTheme('dark');
        }
        if (stored[STORAGE_KEY_SPEAKER]) setCurrentSpeaker(stored[STORAGE_KEY_SPEAKER]);
        if (stored[STORAGE_KEY_HISTORY]) setHistory(stored[STORAGE_KEY_HISTORY]);
        if (stored[STORAGE_KEY_AUTH_TOKEN]) setAuthToken(stored[STORAGE_KEY_AUTH_TOKEN]);
        if (stored[STORAGE_KEY_USER_PROFILE]) setUserProfile(stored[STORAGE_KEY_USER_PROFILE]);

        // Restore unified chat history or create default
        if (stored.guideme_chat_messages && stored.guideme_chat_messages.length > 0) {
          setMessages(stored.guideme_chat_messages);
        } else {
          const defaultGreeting = [
            {
              role: 'assistant',
              content: INITIAL_GREETINGS[stored[STORAGE_KEY_LANG] || 'km'] || INITIAL_GREETINGS.km,
              time: nowTime(stored[STORAGE_KEY_LANG] || 'km'),
            },
          ];
          updateMessages(defaultGreeting);
        }

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

    // Listen for storage changes from in-page overlays and PiP
    const storageListener = (changes, areaName) => {
      if (areaName === 'local') {
        if (changes[STORAGE_KEY_THEME]) {
          setTheme(changes[STORAGE_KEY_THEME].newValue);
        }
        if (changes[STORAGE_KEY_LANG]) {
          setCurrentLanguage(changes[STORAGE_KEY_LANG].newValue);
        }
        if (changes[STORAGE_KEY_AUTH_TOKEN]) {
          setAuthToken(changes[STORAGE_KEY_AUTH_TOKEN].newValue || null);
        }
        if (changes[STORAGE_KEY_USER_PROFILE]) {
          setUserProfile(changes[STORAGE_KEY_USER_PROFILE].newValue || null);
        }
        if (changes.guideme_chat_messages) {
          setMessages(changes.guideme_chat_messages.newValue || []);
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

  // ── Extract UI (PiP Launcher) ────────────────────────────────────────────────
  const handleExtractUI = () => {
    // Send message to content script to show floating prompt widget on the page
    if (currentTab?.id && !isChromeInternalUrl) {
      chrome.tabs.sendMessage(currentTab.id, { 
        action: 'GUIDEME_SHOW_FLOATING_PROMPT',
        payload: { language: currentLanguage }
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[GuideMe] Could not send message to content script:', chrome.runtime.lastError);
        } else {
          // Close the popup after sending message
          window.close();
        }
      });
    }
  };

  // ── Send message to host webpage tab with auto-injection fallback ───────────
  const sendMessageToContentScript = (payload, onComplete) => {
    if (!currentTab?.id || isChromeInternalUrl) {
      if (onComplete) onComplete({ success: false, error: 'Internal URL' });
      return;
    }

    chrome.tabs.sendMessage(currentTab.id, payload, async (res) => {
      if (chrome.runtime?.lastError || !res?.success) {
        try {
          if (chrome.scripting?.executeScript) {
            await chrome.scripting.executeScript({
              target: { tabId: currentTab.id },
              files: ['content-scripts/content.js'],
            });
          }
          setTimeout(() => {
            chrome.tabs.sendMessage(currentTab.id, payload, (fallbackRes) => {
              if (onComplete) onComplete(fallbackRes);
              window.close();
            });
          }, 300);
          return;
        } catch (err) {
          console.error('[GuideMe Popup] Failed to inject content script:', err);
        }
      }
      if (onComplete) onComplete(res);
      window.close();
    });
  };

  const handleOpenDashboard = () => {
    sendMessageToContentScript({ action: 'OPEN_DASHBOARD_OVERLAY' });
  };

  // ── Auth Handlers ─────────────────────────────────────────────────────────────
  const handleOpenLogin = () => {
    setShowLogin(true);
  };

  const handleLoginSuccess = ({ token, user }) => {
    setAuthToken(token);
    setUserProfile(user || null);
    setShowLogin(false);
  };

  const handleLogout = () => {
    chrome.storage.local.remove([STORAGE_KEY_AUTH_TOKEN, STORAGE_KEY_USER_PROFILE], () => {
      setAuthToken(null);
      setUserProfile(null);
    });
  };

  // ── Chat / Submit prompt ──────────────────────────────────────────────────────
  const handleSubmitPrompt = async (e) => {
    e?.preventDefault();
    const prompt = customPrompt.trim();
    if (!prompt) return;

    // Require authentication before submitting — alert in chat then redirect
    if (!authToken) {
      const userMsg = { role: 'user', content: prompt, time: nowTime(currentLanguage) };
      const authMsg = {
        role: 'auth-prompt',
        content: currentLanguage === 'km'
          ? 'សូមចូលគណនីរបស់អ្នកមុនពេលប្រើ GuideMe AI Assistant។'
          : 'Please log in to your GuideMe account before using the AI Assistant.',
        time: nowTime(currentLanguage),
      };
      updateMessages([...messages, userMsg, authMsg]);
      setCustomPrompt('');
      return;
    }

    // Save to history
    const newHistory = [prompt, ...history.filter((h) => h !== prompt)].slice(0, 20);
    setHistory(newHistory);
    chrome.storage.local.set({ [STORAGE_KEY_HISTORY]: newHistory });

    // Add user message to chat immediately
    const userMsg = { role: 'user', content: prompt, time: nowTime(currentLanguage) };
    const nextMessages = [...messages, userMsg];
    updateMessages(nextMessages);
    setCustomPrompt('');

    setIsProcessing(true);

    try {
      // ── Stage 1: Validate intent (backend first, local fallback) ──
      let validated = null;
      const configuredUrl = import.meta.env.WXT_API_URL;
      const hasApiUrl = configuredUrl && configuredUrl !== '';
      const baseUrl = hasApiUrl ? configuredUrl : '';

      if (baseUrl) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/ai/validate-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt,
              currentUrl: currentTab?.url || '',
              language: currentLanguage,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            validated = await res.json();
          }
        } catch (err) {
          console.warn('[GuideMe Popup] Backend validate-intent unreachable; local classifier fallback is temporarily disabled:', err?.message);
        }
      }

      // Fallback to local classifier if backend didn't respond
      if (!validated) {
        // <<< TEMPORARILY COMMENTED OUT LOCAL CLASSIFIER FALLBACK FOR DEBUGGING >>>
        // const classification = classifyPrompt(prompt);
        // if (classification.type === 'greeting') {
        //   const reply = classification.responses[currentLanguage] || classification.responses.en;
        //   updateMessages([...nextMessages, { role: 'assistant', content: reply, time: nowTime(currentLanguage) }]);
        //   return;
        // }
        // validated = {
        //   valid: classification.type === 'actionable',
        //   reason: classification.type === 'unclear'
        //     ? (classification.responses[currentLanguage] || classification.responses.en)
        //     : '',
        //   pages: classification.type === 'actionable'
        //     ? [{ route: 'current', action: 'user_intent', target: '', description: prompt }]
        //     : [],
        // };
        // <<< END TEMPORARY COMMENT >>>
        validated = { valid: false, reason: 'Backend validate-intent unreachable and local fallback disabled', pages: [] };
      }

      // ── Handle invalid intent ──
      if (!validated.valid) {
        const msg = validated.reason || (currentLanguage === 'km'
          ? 'សូមបញ្ជាក់អ្វីដែលអ្នកចង់ធ្វើនៅលើទំព័រនេះ'
          : 'Please specify what you\'d like to do on this page');
        updateMessages([...nextMessages, { role: 'assistant', content: msg, time: nowTime(currentLanguage) }]);
        return;
      }

      // ── Valid intent: start the guide ──
      const startingMsg = currentLanguage === 'km'
        ? 'យល់ហើយ! កំពុងចាប់ផ្តើមការណែនាំជាជំហានៗលើទំព័រនេះ...'
        : "Got it! Starting step-by-step guidance on this page...";
      updateMessages([...nextMessages, { role: 'assistant', content: startingMsg, time: nowTime(currentLanguage) }]);

      // If multi-page plan, store it for the background/content to pick up
      const pages = validated.pages || [];
      if (pages.length > 1 || (pages.length === 1 && pages[0].route !== 'current')) {
        try {
          chrome.storage?.session?.set({ guideme_multi_page_plan: { prompt, pages, currentPageIndex: 0 } });
        } catch {}
      }

      // Send the guide to content script
      sendMessageToContentScript({
        action: 'GUIDEME_START_DYNAMIC_GUIDE',
        payload: { prompt },
      });
    } catch (err) {
      console.error('[GuideMe Popup] Error in handleSubmitPrompt:', err);
      // Emergency fallback: try to start a guide anyway
      sendMessageToContentScript({
        action: 'GUIDEME_START_DYNAMIC_GUIDE',
        payload: { prompt },
      });
    } finally {
      setIsProcessing(false);
    }
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
      {/* Inline Login overlay — shown when user clicks Sign In */}
      {showLogin && (
        <LoginOverlay
          language={currentLanguage}
          onSuccess={handleLoginSuccess}
          onClose={() => setShowLogin(false)}
        />
      )}
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
        isAuthenticated={!!authToken}
        userProfile={userProfile}
        onOpenLogin={handleOpenLogin}
        onLogout={handleLogout}
      />

      {/* Header */}
      <PopupHeader
        currentLanguage={currentLanguage}
        onLanguageChange={handleLanguageChange}
        theme={theme}
        onThemeChange={handleThemeChange}
        onOpenSettings={() => setShowSettings(true)}
        isAuthenticated={!!authToken}
        userProfile={userProfile}
        onOpenLogin={handleOpenLogin}
      />

      {/* Body — chat messages */}
      <div className="popup-body">
        <ChatArea messages={messages} />

        {/* Bottom action bar */}
        <div className="popup-bottom">
          {/* Extract Separate UI (PiP Launcher) */}
          <button
            type="button"
            id="extract-ui-btn"
            onClick={handleExtractUI}
            title={getUIString('popoutLauncherTooltip', currentLanguage) || getUIString('extractUITooltip', currentLanguage)}
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
