import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ExtensionMessageAction } from '@guideme/core-types';
import { getUIString } from '@guideme/tutorial-ui';
import { classifyPrompt } from '@guideme/engine';
import { FiPlus, FiX } from 'react-icons/fi';

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

  // ── Multi-Tab Chat state ──────────────────────────────────────────────────
  const [chatTabs, setChatTabs] = useState(() => [
    {
      id: 'tab-1',
      title: 'ការជជែក ១',
      messages: [
        {
          role: 'assistant',
          content: INITIAL_GREETINGS.km,
          timestamp: Date.now(),
        },
      ],
      isDefaultTitle: true,
      createdAt: Date.now(),
    },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [customPrompt, setCustomPrompt] = useState('');

  const tabsRef = useRef(chatTabs);
  const activeTabIdRef = useRef(activeTabId);

  useEffect(() => {
    tabsRef.current = chatTabs;
  }, [chatTabs]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  /**
   * Atomic tab updater that synchronizes state, refs, and storage
   */
  const updateTabs = useCallback((updater, newActiveId) => {
    setChatTabs((prevTabs) => {
      const nextTabs = typeof updater === 'function' ? updater(prevTabs) : updater;
      tabsRef.current = nextTabs;
      const targetActiveId = newActiveId || activeTabIdRef.current || nextTabs[0]?.id;
      if (newActiveId && newActiveId !== activeTabIdRef.current) {
        setActiveTabId(newActiveId);
        activeTabIdRef.current = newActiveId;
      }
      try {
        const active = nextTabs.find((t) => t.id === targetActiveId) || nextTabs[0];
        chrome.storage?.local?.set({
          guideme_chat_tabs: nextTabs,
          guideme_active_chat_tab_id: targetActiveId,
          guideme_chat_messages: active?.messages || [],
        });
      } catch { }
      return nextTabs;
    });
  }, []);

  const handleCreateNewTab = () => {
    const newId = 'tab-' + Date.now();
    updateTabs((prevTabs) => {
      const num = prevTabs.length + 1;
      const newTab = {
        id: newId,
        title: currentLanguage === 'km' ? `ការជជែក ${num}` : `Chat ${num}`,
        messages: [
          {
            role: 'assistant',
            content: INITIAL_GREETINGS[currentLanguage] || INITIAL_GREETINGS.km,
            timestamp: Date.now(),
          },
        ],
        isDefaultTitle: true,
        createdAt: Date.now(),
      };
      return [...prevTabs, newTab];
    }, newId);
  };

  const handleSwitchTab = (tabId) => {
    if (tabId === activeTabIdRef.current) return;
    updateTabs((prevTabs) => prevTabs, tabId);
  };

  const handleCloseTab = (tabId, e) => {
    e?.stopPropagation();
    updateTabs((prevTabs) => {
      if (prevTabs.length <= 1) {
        return [
          {
            ...prevTabs[0],
            title: currentLanguage === 'km' ? 'ការជជែក ១' : 'Chat 1',
            isDefaultTitle: true,
            messages: [
              {
                role: 'assistant',
                content: INITIAL_GREETINGS[currentLanguage] || INITIAL_GREETINGS.km,
                timestamp: Date.now(),
              },
            ],
          },
        ];
      }
      const idx = prevTabs.findIndex((t) => t.id === tabId);
      if (idx === -1) return prevTabs;
      const updated = prevTabs.filter((t) => t.id !== tabId);
      let nextActiveId = activeTabIdRef.current;
      if (activeTabIdRef.current === tabId) {
        nextActiveId = updated[Math.max(0, idx - 1)]?.id || updated[0]?.id;
        setActiveTabId(nextActiveId);
        activeTabIdRef.current = nextActiveId;
      }
      return updated;
    });
  };

  const appendUserMessage = (text) => {
    const tabIdToUse = activeTabIdRef.current || 'tab-1';
    const newMsg = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    updateTabs((prevTabs) => {
      return prevTabs.map((t) => {
        if (t.id === tabIdToUse) {
          let updatedTitle = t.title;
          let isDefault = t.isDefaultTitle;
          if (t.isDefaultTitle && text) {
            const clean = text.trim();
            updatedTitle = clean.length > 18 ? clean.slice(0, 16) + '...' : clean;
            isDefault = false;
          }
          return {
            ...t,
            title: updatedTitle,
            isDefaultTitle: isDefault,
            messages: [...t.messages, newMsg],
          };
        }
        return t;
      });
    });

    return tabIdToUse;
  };

  const appendAiMessage = (text, targetTabId) => {
    const tabIdToUse = targetTabId || activeTabIdRef.current || 'tab-1';
    const newMsg = {
      role: 'assistant',
      content: text,
      timestamp: Date.now(),
    };

    updateTabs((prevTabs) => {
      return prevTabs.map((t) => {
        if (t.id === tabIdToUse) {
          return {
            ...t,
            messages: [...t.messages, newMsg],
          };
        }
        return t;
      });
    });
  };

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
          STORAGE_KEY_AUTH_TOKEN,
          STORAGE_KEY_USER_PROFILE,
          'guideme_chat_tabs',
          'guideme_active_chat_tab_id',
          'guideme_chat_messages',
        ]);

        // First time open: Launch in-page onboarding overlay on active tab if not done
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
                  setTimeout(() => chrome.tabs.sendMessage(tab.id, payload, () => {}), 300);
                } catch { }
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
        if (stored[STORAGE_KEY_AUTH_TOKEN]) setAuthToken(stored[STORAGE_KEY_AUTH_TOKEN]);
        if (stored[STORAGE_KEY_USER_PROFILE]) setUserProfile(stored[STORAGE_KEY_USER_PROFILE]);

        // Restore unified multi-tab chat history or create default
        let initialTabs = stored.guideme_chat_tabs;
        let initialActiveId = stored.guideme_active_chat_tab_id;
        if (!Array.isArray(initialTabs) || initialTabs.length === 0) {
          const defaultTab = {
            id: 'tab-' + Date.now(),
            title: (stored[STORAGE_KEY_LANG] || 'km') === 'km' ? 'ការជជែក ១' : 'Chat 1',
            messages: stored.guideme_chat_messages && stored.guideme_chat_messages.length > 0
              ? stored.guideme_chat_messages
              : [
                  {
                    role: 'assistant',
                    content: INITIAL_GREETINGS[stored[STORAGE_KEY_LANG] || 'km'] || INITIAL_GREETINGS.km,
                    timestamp: Date.now(),
                  },
                ],
            isDefaultTitle: true,
            createdAt: Date.now(),
          };
          initialTabs = [defaultTab];
          initialActiveId = defaultTab.id;
          chrome.storage.local.set({
            guideme_chat_tabs: initialTabs,
            guideme_active_chat_tab_id: initialActiveId,
            guideme_chat_messages: defaultTab.messages,
          });
        }
        setChatTabs(initialTabs);
        tabsRef.current = initialTabs;
        const resolvedActiveId = initialActiveId || initialTabs[0]?.id;
        setActiveTabId(resolvedActiveId);
        activeTabIdRef.current = resolvedActiveId;

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

    // Listen for storage changes from in-page overlays and other contexts
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
        if (changes.guideme_chat_tabs && changes.guideme_chat_tabs.newValue) {
          const incomingTabs = changes.guideme_chat_tabs.newValue;
          if (Array.isArray(incomingTabs) && incomingTabs.length > 0) {
            setChatTabs(incomingTabs);
            tabsRef.current = incomingTabs;
          }
        }
        if (changes.guideme_active_chat_tab_id && changes.guideme_active_chat_tab_id.newValue) {
          const incomingActiveId = changes.guideme_active_chat_tab_id.newValue;
          setActiveTabId(incomingActiveId);
          activeTabIdRef.current = incomingActiveId;
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
    chrome.runtime.sendMessage(
      {
        action: 'GUIDEME_POPOUT_LAUNCHER',
        payload: {
          tabId: currentTab?.id,
          windowId: currentTab?.windowId,
        },
      },
      () => {
        window.close();
      }
    );
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
            });
          }, 300);
          return;
        } catch (err) {
          console.error('[GuideMe Popup] Failed to inject content script:', err);
        }
      }
      if (onComplete) onComplete(res);
    });
  };

  const handleOpenDashboard = () => {
    sendMessageToContentScript({ action: 'OPEN_DASHBOARD_OVERLAY' });
  };

  // ── Auth Handlers ─────────────────────────────────────────────────────────────
  const handleOpenLogin = () => {
    const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development';
    const defaultProdUrl = 'https://guideme-lac.vercel.app';
    const baseUrl = import.meta.env.WXT_SITE_URL || (isDev ? 'http://localhost:3000' : defaultProdUrl);
    const loginUrl = `${baseUrl}/login?source=extension`;

    const openTab = (originTabId, originWinId) => {
      chrome.storage?.local?.set({
        guideme_auth_origin_tab_id: originTabId || null,
        guideme_auth_origin_window_id: originWinId || null,
      }, () => {
        chrome.tabs.create({ url: loginUrl });
      });
    };

    if (currentTab?.id && !currentTab.url?.startsWith('chrome://') && !currentTab.url?.startsWith('chrome-extension://')) {
      openTab(currentTab.id, currentTab.windowId);
    } else {
      // If user opened popup while on chrome://extensions, locate normal web tab to return to
      chrome.windows?.getAll?.({ populate: true, windowTypes: ['normal'] }, (windows) => {
        const normalWin = (windows || []).find((w) => w.focused) || (windows || [])[0];
        const webTab = normalWin?.tabs?.find(
          (t) => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://')
        );
        openTab(webTab?.id, normalWin?.id);
      });
    }
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

    // Save to history
    const newHistory = [prompt, ...history.filter((h) => h !== prompt)].slice(0, 20);
    setHistory(newHistory);
    chrome.storage.local.set({ [STORAGE_KEY_HISTORY]: newHistory });

    const targetTabId = appendUserMessage(prompt);
    setCustomPrompt('');

    setIsProcessing(true);
    
    try {
      let reply;

      // Query Backend AI API (Provider-Agnostic Option 1 Architecture)
      let aiResponded = false;
      const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development';
      const defaultProdUrl = 'https://guideme-lac.vercel.app';
      const baseUrl = import.meta.env.WXT_API_URL || (isDev ? 'http://localhost:4000' : defaultProdUrl);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/ai/assistant-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: prompt, language: currentLanguage }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          reply = data.answer || data.message;
          if (reply) {
            appendAiMessage(reply, targetTabId);
            aiResponded = true;

            if (data.triggerGuide) {
              const intentPrompt = data.intentPrompt || prompt;
              sendMessageToContentScript({
                action: 'GUIDEME_START_DYNAMIC_GUIDE',
                payload: { prompt: intentPrompt, intent: data.intent || null },
              });
            }
          }
        }
      } catch (backendErr) {
        console.warn("[GuideMe Popup] Backend AI unreachable, executing on-page guide fallback:", backendErr);
      }

      // If backend was unreachable or offline, provide smart seamless fallback
      if (!aiResponded) {
        const classification = classifyPrompt(prompt);
        if (classification.type === 'actionable') {
          const startingMsg = currentLanguage === 'km'
            ? 'ខ្ញុំយល់ហើយ! កំពុងចាប់ផ្តើមការណែនាំជាជំហានៗលើទំព័រនេះ...'
            : "Got it! Starting a step-by-step walkthrough on this page...";
          appendAiMessage(startingMsg, targetTabId);

          sendMessageToContentScript({
            action: 'GUIDEME_START_DYNAMIC_GUIDE',
            payload: { prompt, intent: null },
          });
        } else {
          const fallbackReply = classification.responses?.[currentLanguage] || classification.responses?.en || "Hello! How can I help you on this page?";
          appendAiMessage(fallbackReply, targetTabId);
        }
      }
    } catch (err) {
      console.error("[GuideMe Popup] Error in handleCustomSubmit:", err);
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

  const activeTab = (chatTabs || []).find((t) => t.id === activeTabId) || chatTabs[0];
  const currentMessages = activeTab?.messages || [];

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

      {/* Multi-Tab AI Chat Bar */}
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1.5 bg-gray-50/70 dark:bg-[#151421]/70 border-b border-gray-200/60 dark:border-[#282541] overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto scrollbar-none">
          {chatTabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => handleSwitchTab(tab.id)}
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer select-none max-w-[130px] shrink-0 ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-sm font-semibold shadow-purple-500/30'
                    : 'bg-white/90 dark:bg-[#1f1d33] text-gray-600 dark:text-zinc-300 hover:bg-purple-50 dark:hover:bg-[#2a2745] border border-gray-200/70 dark:border-[#2f2c4b]'
                }`}
              >
                <span className="truncate">{tab.title}</span>
                {chatTabs.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border-0 bg-transparent cursor-pointer p-0 opacity-60 hover:opacity-100 transition-opacity ${
                      isActive ? 'text-white hover:bg-purple-700' : 'text-gray-400 hover:text-gray-700 dark:hover:text-white'
                    }`}
                  >
                    <FiX className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleCreateNewTab}
          title={getUIString('newChatTab', currentLanguage)}
          className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900 border border-purple-200/80 dark:border-purple-800/60 flex items-center justify-center shrink-0 cursor-pointer transition-all"
        >
          <FiPlus className="w-3 h-3" />
        </button>
      </div>

      {/* Body — chat messages */}
      <div className="popup-body">
        <ChatArea messages={currentMessages} language={currentLanguage} />

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
