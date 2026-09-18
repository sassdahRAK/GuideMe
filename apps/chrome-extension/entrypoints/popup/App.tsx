import React, { useEffect, useRef, useState } from 'react';
import { ExtensionMessageAction, classifyPrompt, isHardcodedDemoPrompt, DEMO_MODE_ONLY_HARDCODED, HARDCODED_DEMO_PROMPTS } from '@guideme/engine';
import { getUIString, loadOrInitTabs, updateTabMessages, loadDraft, saveDraft, CHAT_TABS_KEY, ACTIVE_TAB_ID_KEY } from '@guideme/tutorial-ui';
import { LoginOverlay } from './components/LoginOverlay.tsx';

import {
  STORAGE_KEY_LANG,
  STORAGE_KEY_THEME,
  STORAGE_KEY_SPEAKER,
  STORAGE_KEY_HISTORY,
  STORAGE_KEY_AUTH_TOKEN,
  STORAGE_KEY_USER_PROFILE,
} from './constants.ts';
import { useSpeechRecognition } from './hooks/useSpeechRecognition.ts';
import { PopupHeader }     from './components/PopupHeader.tsx';
import { PromptInput }     from './components/PromptInput.tsx';
import { SettingsOverlay } from './components/SettingsOverlay.tsx';
import { ChatArea, type ChatMessageItem } from './components/ChatArea.tsx';

/** A simple timestamp like "Just now" or "ឥឡូវនេះ" */
function nowTime(lang = 'km') {
  return getUIString('justNow', lang);
}

/**
 * App — Root coordinator for GuideMe Chrome Extension popup.
 */
export default function App(): React.ReactElement {
  // ── Preferences ─────────────────────────────────────────────────────────────
  const [currentTab,        setCurrentTab]        = useState<chrome.tabs.Tab | null>(null);
  // Whether the user has granted this extension "Allow access to file URLs"
  // in chrome://extensions — file:// is NOT an unconditional hard block like
  // chrome:// or the Web Store; it's actually usable once that permission is
  // granted, so we check the real API instead of assuming it's blocked.
  // Starts `true` (optimistic) so a normal page never flashes the notice
  // while this one-time async check resolves.
  const [fileAccessAllowed, setFileAccessAllowed] = useState<boolean>(true);
  const [currentLanguage,   setCurrentLanguage]   = useState<string>('km');
  const [theme,             setTheme]             = useState<string>('light');
  const [currentSpeaker,    setCurrentSpeaker]    = useState<string>('default');
  const [history,           setHistory]           = useState<string[]>([]);
  const [showSettings,      setShowSettings]      = useState(false);
  const [isProcessing,      setIsProcessing]      = useState(false);
  const [authToken,         setAuthToken]         = useState<string | null>(null);
  const [userProfile,       setUserProfile]       = useState<any>(null);
  const [showLogin,         setShowLogin]         = useState(false);

  // ── Chat state ──────────────────────────────────────────────────────────────
  // Tab-aware, shared with the in-page widget (ChatBoxWidgetOverlay.jsx) via
  // the same guideme_chat_tabs/guideme_active_chat_tab_id storage keys — the
  // popup always shows whichever tab is active, and follows it live if the
  // widget switches tabs. No tab-switcher UI here; that stays widget-only.
  const [messages,      setMessages]      = useState<ChatMessageItem[]>([]);
  const [customPrompt,  setCustomPrompt]  = useState('');
  const tabsRef = useRef<any[]>([]);
  const activeTabIdRef = useRef<string | null>(null);
  const currentLanguageRef = useRef('km');

  // Debounced draft save — mirrors the in-page widget's own draft
  // persistence so whichever surface (popup or widget) the user closes,
  // the other one picks up the same unsent text on next open.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTabIdRef.current) saveDraft(activeTabIdRef.current, customPrompt);
    }, 300);
    return () => clearTimeout(timer);
  }, [customPrompt]);

  // Accepts either a full array or a functional updater (matching
  // React's setState contract), applies it to the active tab's messages,
  // and persists the whole tab array atomically.
  const updateMessages = (
    next: ChatMessageItem[] | ((prev: ChatMessageItem[]) => ChatMessageItem[])
  ) => {
    setMessages((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: ChatMessageItem[]) => ChatMessageItem[])(prev) : next;
      const tabId = activeTabIdRef.current;
      if (tabId && tabsRef.current.length > 0) {
        const userText = resolved.length > prev.length
          ? [...resolved].reverse().find((m) => m.role === 'user')?.content
          : undefined;
        updateTabMessages(tabsRef.current, tabId, resolved, { deriveTitleFrom: userText }).then((nextTabs) => {
          tabsRef.current = nextTabs;
        });
      }
      return resolved;
    });
  };

  // Update initial greeting if chat is still untouched when language changes
  useEffect(() => {
    if (messages.length === 1 && messages[0].role === 'assistant') {
      updateMessages([
        {
          role: 'assistant',
          content: getUIString('chatGreeting', currentLanguage),
          timestamp: Date.now(),
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLanguage]);

  // Pages a content script CANNOT run on, per Chrome's own extension policy
  // — no permission or setting can ever change this, for any of these:
  // browser-internal pages, other extensions' pages (incl. Chrome's built-in
  // PDF viewer), and the extension galleries themselves.
  const isHardBlockedUrl = (() => {
    const url = currentTab?.url || '';
    return (
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('edge://') ||
      url.startsWith('about:') ||
      url.startsWith('devtools://') ||
      url.startsWith('view-source:') ||
      /^https:\/\/chrome\.google\.com\/webstore/.test(url) ||
      /^https:\/\/chromewebstore\.google\.com/.test(url)
    );
  })();

  // file:// is NOT a hard block — it's usable the moment the user grants
  // "Allow access to file URLs" for this extension, so we only treat it as
  // restricted when that permission has actually been checked and is off
  // (fileAccessAllowed), never assumed. When it IS off, we still let the
  // user get there instead of just refusing (see the notice + button below).
  const isFileUrlBlocked = (currentTab?.url || '').startsWith('file://') && !fileAccessAllowed;

  const isChromeInternalUrl = isHardBlockedUrl || isFileUrlBlocked;

  // Sync dark class on <html> for Tailwind dark: support
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => { currentLanguageRef.current = currentLanguage; }, [currentLanguage]);

  // ── Load preferences on mount & listen to live changes ─────────────────────
  useEffect(() => {
    // Signal to content script that popup window is open → hides FAB
    chrome.storage?.local?.set({ guideme_popup_open: true });
    window.addEventListener('beforeunload', () => {
      chrome.storage?.local?.set({ guideme_popup_open: false });
    });

    // Real permission check, not an assumption — only relevant when the
    // active tab actually is a file:// page, but cheap enough to just do it
    // unconditionally on popup open.
    try {
      chrome.extension?.isAllowedFileSchemeAccess?.((allowed) => setFileAccessAllowed(!!allowed));
    } catch { /* API unavailable in this context — stay optimistic */ }

    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) setCurrentTab(tab);

        const stored = (await chrome.storage.local.get([
          'guideme_onboarding_done',
          STORAGE_KEY_LANG,
          STORAGE_KEY_THEME,
          STORAGE_KEY_SPEAKER,
          STORAGE_KEY_HISTORY,
          STORAGE_KEY_AUTH_TOKEN,
          STORAGE_KEY_USER_PROFILE,
        ])) as Record<string, any>;

        // First time open: Launch in-page onboarding overlay on active tab
        if (!stored.guideme_onboarding_done) {
          if (tab?.id && !tab.url?.startsWith('chrome://') && !tab.url?.startsWith('chrome-extension://')) {
            const payload = { action: 'OPEN_ONBOARDING_OVERLAY' };
            chrome.tabs.sendMessage(tab.id, payload, async (res) => {
              if (chrome.runtime.lastError || !res?.success) {
                try {
                  if (chrome.scripting?.executeScript) {
                    await chrome.scripting.executeScript({
                      target: { tabId: tab.id! },
                      files: ['content-scripts/content.js'],
                    });
                  }
                  setTimeout(() => chrome.tabs.sendMessage(tab.id!, payload, () => window.close()), 300);
                  return;
                } catch { }
              }
              window.close();
            });
            return;
          }
        }

        if (stored[STORAGE_KEY_LANG]) setCurrentLanguage(String(stored[STORAGE_KEY_LANG]));
        if (stored[STORAGE_KEY_THEME]) {
          setTheme(String(stored[STORAGE_KEY_THEME]));
        } else if (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches) {
          setTheme('dark');
        }
        if (stored[STORAGE_KEY_SPEAKER]) setCurrentSpeaker(String(stored[STORAGE_KEY_SPEAKER]));
        if (stored[STORAGE_KEY_HISTORY] && Array.isArray(stored[STORAGE_KEY_HISTORY])) setHistory(stored[STORAGE_KEY_HISTORY]);
        if (stored[STORAGE_KEY_AUTH_TOKEN]) setAuthToken(String(stored[STORAGE_KEY_AUTH_TOKEN]));
        if (stored[STORAGE_KEY_USER_PROFILE]) setUserProfile(stored[STORAGE_KEY_USER_PROFILE]);

        // Restore the shared chat-tab model (same storage the in-page widget
        // uses) — creates a single default tab if none exists yet.
        const { tabs, activeTabId } = (await loadOrInitTabs(String(stored[STORAGE_KEY_LANG] || 'km'))) as { tabs: any[]; activeTabId: string };
        tabsRef.current = tabs;
        activeTabIdRef.current = activeTabId;
        const active = tabs.find((t: any) => t.id === activeTabId) || tabs[0];
        setMessages(active?.messages || []);

        // A real browser action popup destroys its whole React tree on
        // close/blur — restore whatever the user was mid-typing so an
        // accidental close doesn't silently lose it.
        loadDraft(activeTabId).then((draft: string) => {
          if (draft) setCustomPrompt(draft);
        });

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
    const storageListener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'local') {
        if (changes[STORAGE_KEY_THEME]) {
          setTheme(String(changes[STORAGE_KEY_THEME].newValue));
        }
        if (changes[STORAGE_KEY_LANG]) {
          setCurrentLanguage(String(changes[STORAGE_KEY_LANG].newValue));
        }
        if (changes[STORAGE_KEY_AUTH_TOKEN]) {
          setAuthToken(changes[STORAGE_KEY_AUTH_TOKEN].newValue ? String(changes[STORAGE_KEY_AUTH_TOKEN].newValue) : null);
        }
        if (changes[STORAGE_KEY_USER_PROFILE]) {
          setUserProfile(changes[STORAGE_KEY_USER_PROFILE].newValue || null);
        }
        if (changes[CHAT_TABS_KEY]) {
          const incomingTabs = changes[CHAT_TABS_KEY].newValue;
          if (Array.isArray(incomingTabs) && incomingTabs.length > 0) {
            tabsRef.current = incomingTabs;
            const curId = activeTabIdRef.current;
            const active = incomingTabs.find((t: any) => t.id === curId) || incomingTabs[0];
            setMessages(active?.messages || []);
          } else {
            // Keys removed entirely — e.g. the fresh-browser-launch chat
            // reset in background.ts — reinitialize to one fresh tab
            // instead of showing a stale/blank chat.
            loadOrInitTabs(currentLanguageRef.current).then((result: any) => {
              const { tabs, activeTabId } = result;
              tabsRef.current = tabs;
              activeTabIdRef.current = activeTabId;
              const active = tabs.find((t: any) => t.id === activeTabId) || tabs[0];
              setMessages(active?.messages || []);
            });
          }
        }
        if (changes[ACTIVE_TAB_ID_KEY]?.newValue) {
          const incomingActiveId = changes[ACTIVE_TAB_ID_KEY].newValue as string;
          activeTabIdRef.current = incomingActiveId;
          const active = tabsRef.current.find((t: any) => t.id === incomingActiveId);
          if (active) setMessages(active.messages || []);
        }
      }
    };
    chrome.storage?.onChanged?.addListener(storageListener);
    return () => chrome.storage?.onChanged?.removeListener(storageListener);
  }, []);

  // ── Language ─────────────────────────────────────────────────────────────────
  const handleLanguageChange = (lang: string) => {
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
  const handleThemeChange = (newTheme: string) => {
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
  const handleSpeakerChange = (speakerId: string) => {
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
  const handleLoadHistory = (item: string) => {
    setCustomPrompt(item);
    setShowSettings(false);
  };

  const handleClearHistory = () => {
    setHistory([]);
    chrome.storage.local.set({ [STORAGE_KEY_HISTORY]: [] });
  };

  // ── Send message to host webpage tab with auto-injection fallback ───────────
  const sendMessageToContentScript = (payload: any, onComplete?: (res?: any) => void) => {
    if (!currentTab?.id || isChromeInternalUrl) {
      if (onComplete) onComplete({ success: false, error: 'Internal URL' });
      return;
    }

    chrome.tabs.sendMessage(currentTab.id, payload, async (res: any) => {
      if (chrome.runtime?.lastError || !res?.success) {
        try {
          if (chrome.scripting?.executeScript) {
            await chrome.scripting.executeScript({
              target: { tabId: currentTab.id! },
              files: ['content-scripts/content.js'],
            });
          }
          // Retry immediately after injection — the content script initialises
          // synchronously on load so it is ready well under 50 ms.  Fall back
          // to a single 80 ms delayed retry only if the first attempt still
          // gets a lastError (e.g. the script hasn't finished evaluating yet).
          chrome.tabs.sendMessage(currentTab.id!, payload, (firstRetryRes: any) => {
            if (!chrome.runtime?.lastError && firstRetryRes) {
              if (onComplete) onComplete(firstRetryRes);
              if (firstRetryRes?.success !== false || !firstRetryRes?.error) window.close();
              return;
            }
            // One final 80 ms back-off before giving up
            setTimeout(() => {
              chrome.tabs.sendMessage(currentTab.id!, payload, (fallbackRes: any) => {
                if (onComplete) onComplete(fallbackRes);
                if (fallbackRes?.success !== false || !fallbackRes?.error) window.close();
              });
            }, 80);
          });
          return;
        } catch (err) {
          console.error('[GuideMe Popup] Failed to inject content script:', err);
        }
      }
      if (onComplete) onComplete(res);
      // Only close if the operation succeeded (no error to show)
      if (res?.success !== false || !res?.error) window.close();
    });
  };

  const handleOpenDashboard = () => {
    sendMessageToContentScript({ action: 'OPEN_DASHBOARD_OVERLAY' });
  };

  // ── Extract UI (PiP Launcher) ────────────────────────────────────────────────
  // Previously a plain one-shot sendMessage with no injection retry — on a
  // freshly-loaded tab (content script not ready yet), or after an
  // extension reload, this silently failed with only a console warning.
  // Reuses the same try → inject → retry-with-backoff path as every other
  // content-script action instead of giving up after one attempt.
  const handleExtractUI = () => {
    sendMessageToContentScript({
      action: 'GUIDEME_SHOW_FLOATING_PROMPT',
      payload: { language: currentLanguage },
    });
  };

  // ── Auth Handlers ─────────────────────────────────────────────────────────────
  const handleOpenLogin = () => {
    setShowLogin(true);
  };

  const handleLoginSuccess = ({ token, user }: { token: string; user: any }) => {
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
  const handleSubmitPrompt = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const prompt = customPrompt.trim();
    if (!prompt) return;

    // ── Hardcoded demo case — skip auth and every AI/backend call entirely ──
    // A small fixed set of prompts must always show the same pre-built guide
    // with zero network dependency, for a reliable offline demo.
    if (isHardcodedDemoPrompt(prompt)) {
      const userMsg = { role: 'user', content: prompt, timestamp: Date.now() };
      const startingMsg = currentLanguage === 'km'
        ? 'យល់ហើយ! កំពុងចាប់ផ្តើមការណែនាំជាជំហានៗលើទំព័រនេះ...'
        : "Got it! Starting step-by-step guidance on this page...";
      updateMessages([...messages, userMsg, { role: 'assistant', content: startingMsg, timestamp: Date.now() }]);
      setCustomPrompt('');
      sendMessageToContentScript(
        { action: 'GUIDEME_START_DYNAMIC_GUIDE', payload: { prompt } },
        (res) => {
          if (!res?.success && res?.error) {
            const errMsg = currentLanguage === 'km' ? `មានបញ្ហា: ${res.error}` : `Error: ${res.error}`;
            updateMessages((prev) => [...prev, { role: 'assistant', content: errMsg, timestamp: Date.now() }]);
          }
        }
      );
      return;
    }

    // ── Demo mode: AI is currently disabled for everything else ──
    if (DEMO_MODE_ONLY_HARDCODED) {
      const userMsg = { role: 'user', content: prompt, timestamp: Date.now() };
      const examples = HARDCODED_DEMO_PROMPTS.map((p) => `"${p}"`).join(', ');
      const disabledMsg = currentLanguage === 'km'
        ? `AI Assistant មិនទាន់អាចប្រើប្រាស់បានទេនៅក្នុងការសាកល្បងនេះ។ សូមសាកល្បងជាមួយសំណួរណាមួយ៖ ${examples}`
        : `The AI Assistant isn't available in this demo yet. Try one of these instead: ${examples}`;
      updateMessages([...messages, userMsg, { role: 'assistant', content: disabledMsg, timestamp: Date.now() }]);
      setCustomPrompt('');
      return;
    }

    // Require authentication before submitting — alert in chat then redirect
    if (!authToken) {
      const userMsg: ChatMessageItem = { role: 'user', content: prompt, time: nowTime(currentLanguage) };
      const authMsg: ChatMessageItem = {
        role: 'auth-prompt',
        content: currentLanguage === 'km'
          ? 'សូមចូលគណនីរបស់អ្នកមុនពេលប្រើ GuideMe AI Assistant។'
          : 'Please log in to your GuideMe account before using the AI Assistant.',
        timestamp: Date.now(),
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
    const userMsg: ChatMessageItem = { role: 'user', content: prompt, time: nowTime(currentLanguage) };
    const nextMessages = [...messages, userMsg];
    updateMessages(nextMessages);
    setCustomPrompt('');

    setIsProcessing(true);

    try {
      // ── Stage 1: Validate intent (backend first, local fallback) ──
      let validated: any = null;
      const configuredUrl = import.meta.env.WXT_API_URL;
      const hasApiUrl = configuredUrl && configuredUrl !== '';
      const baseUrl = hasApiUrl ? configuredUrl : '';

      // Pre-warm: fire DOM snapshot in the content script the moment intent
      // validation starts so both network round-trips happen in parallel.
      // The content script caches this snapshot and uses it when
      // START_DYNAMIC_GUIDE arrives — shaving the synchronous DOM extraction
      // off the hot path.
      if (currentTab?.id) {
        chrome.tabs.sendMessage(currentTab.id, { action: 'GUIDEME_PREWARM_DOM' }, () => {
          // Ignore errors — this is purely speculative; content script may not
          // be injected yet and that is fine.
          void chrome.runtime?.lastError;
        });
      }

      if (baseUrl) {
        try {
          const controller = new AbortController();
          // 4 s is enough for a healthy backend; gives the local fallback a
          // chance to run before the user loses patience.
          const timeoutId = setTimeout(() => controller.abort(), 4000);
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
        } catch (err: any) {
          console.warn('[GuideMe Popup] Backend validate-intent unreachable, using local classifier:', err?.message);
        }
      }

      // Local classifier fallback — runs instantly in-process when the backend
      // is slow, unreachable, or not configured. This is a lightweight,
      // deterministic greeting/actionable/unclear classification, not a
      // substitute AI guide — it only decides whether to proceed to actual
      // (backend-generated) guide generation, so it doesn't fall under the
      // "no silent fallback" rule that governs guide *generation* itself.
      if (!validated) {
        const classification = classifyPrompt(prompt);
        if (classification.type === 'greeting') {
          const reply = classification.responses?.[currentLanguage] || classification.responses?.en || '';
          updateMessages([...nextMessages, { role: 'assistant', content: reply, timestamp: Date.now() }]);
          return;
        }
        validated = {
          valid: classification.type === 'actionable',
          reason: classification.type === 'unclear'
            ? (classification.responses?.[currentLanguage] || classification.responses?.en || '')
            : '',
          pages: classification.type === 'actionable'
            ? [{ route: 'current', action: 'user_intent', target: '', description: prompt }]
            : [],
        };
      }

      // ── Handle invalid intent ──
      if (!validated.valid) {
        const msg = validated.reason || (currentLanguage === 'km'
          ? 'សូមបញ្ជាក់អ្វីដែលអ្នកចង់ធ្វើនៅលើទំព័រនេះ'
          : 'Please specify what you\'d like to do on this page');
        updateMessages([...nextMessages, { role: 'assistant', content: msg, timestamp: Date.now() }]);
        return;
      }

      // ── Valid intent: start the guide ──
      const startingMsg = currentLanguage === 'km'
        ? 'យល់ហើយ! កំពុងចាប់ផ្តើមការណែនាំជាជំហានៗលើទំព័រនេះ...'
        : "Got it! Starting step-by-step guidance on this page...";
      updateMessages([...nextMessages, { role: 'assistant', content: startingMsg, timestamp: Date.now() }]);

      // If multi-page plan, store it for the background/content to pick up
      const pages = validated.pages || [];
      if (pages.length > 1 || (pages.length === 1 && pages[0].route !== 'current')) {
        try {
          chrome.storage?.session?.set({ guideme_multi_page_plan: { prompt, pages, currentPageIndex: 0 } });
        } catch {}
      }

      // Send the guide to content script; surface any backend/CORS error back in chat
      sendMessageToContentScript(
        { action: 'GUIDEME_START_DYNAMIC_GUIDE', payload: { prompt } },
        (res) => {
          if (!res?.success && res?.error) {
            // Don't close — show the error in the chat so the user knows what went wrong
            const errMsg = currentLanguage === 'km'
              ? `មានបញ្ហា: ${res.error}`
              : `Error: ${res.error}`;
            updateMessages((prev) => [
              ...prev,
              { role: 'assistant', content: errMsg, timestamp: Date.now() },
            ]);
            setIsProcessing(false);
          }
          // On success the popup closes automatically via sendMessageToContentScript
        }
      );
    } catch (err) {
      console.error('[GuideMe Popup] Error in handleSubmitPrompt:', err);
      const errMsg = currentLanguage === 'km'
        ? `មានបញ្ហា: ${err.message || 'Unknown error'}`
        : `Error: ${err.message || 'Unknown error'}`;
      updateMessages((prev) => [
        ...prev,
        { role: 'assistant', content: errMsg, timestamp: Date.now() },
      ]);
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

      {/* Body — chat messages, or a formal notice when GuideMe structurally
          cannot run on this page (browser policy) instead of silently
          rendering a chat/prompt UI whose every action would no-op. */}
      {isChromeInternalUrl ? (
        <div className="popup-body">
          <div className="mx-4 my-6 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/40 p-4 text-center">
            <p className="font-semibold text-amber-900 dark:text-amber-200 text-[13px]">
              {getUIString('restrictedPageTitle', currentLanguage)}
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-amber-800 dark:text-amber-300/90">
              {getUIString('restrictedPageBody', currentLanguage)}
            </p>
          </div>
        </div>
      ) : (
        <div className="popup-body">
          <ChatArea messages={messages} language={currentLanguage} />

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
      )}
    </div>
  );
}
