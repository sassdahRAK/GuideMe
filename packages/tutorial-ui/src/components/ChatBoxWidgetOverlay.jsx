import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FiX,
  FiMinus,
  FiPlus,
  FiSend,
  FiMic,
  FiImage,
  FiCamera,
  FiVolume2,
  FiVolumeX,
  FiRotateCcw,
  FiChevronLeft,
  FiChevronRight,
  FiTarget,
  FiExternalLink,
  FiAlertCircle,
  FiCheck,
} from 'react-icons/fi';
import { GuideMeLogo } from './GuideMeLogo.jsx';
import { getUIString } from '../i18n/ui-strings.js';
import { classifyPrompt } from '@guideme/engine';

/** Translate/globe icon — matches the popup header's language button. */
function TranslateIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
    </svg>
  );
}

const OVERLAY_LANGUAGES = [
  { code: 'km', label: 'KH', flag: '🇰🇭' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
];

/** Dropdown language picker — identical UX to the popup PopupHeader. */
function LanguageDropdown({ language, onLanguageChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    // composedPath() traverses Shadow DOM boundaries correctly; .contains() does not.
    const handler = (e) => {
      const path = e.composedPath ? e.composedPath() : [e.target];
      if (!path.some((el) => el === ref.current || ref.current?.contains(el))) {
        setOpen(false);
      }
    };
    // Attach on the shadow root (not document) so we get the real targets.
    const root = ref.current?.getRootNode() ?? document;
    root.addEventListener('pointerdown', handler, { capture: true });
    return () => root.removeEventListener('pointerdown', handler, { capture: true });
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setOpen((v) => !v)}
        title={getUIString('selectLanguage', language)}
        aria-label={getUIString('selectLanguage', language)}
        aria-expanded={open}
        className={`w-[28px] h-[28px] rounded-lg flex items-center justify-center border-0 cursor-pointer transition-colors ${
          open
            ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300'
            : 'bg-transparent text-gray-500 dark:text-zinc-400 hover:bg-purple-50 dark:hover:bg-[#252538] hover:text-purple-600 dark:hover:text-purple-400'
        }`}
      >
        <TranslateIcon className="w-[15px] h-[15px]" />
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-1.5 bg-white dark:bg-[#181826] border border-gray-100 dark:border-[#2d2d44] rounded-xl shadow-xl overflow-hidden z-[9999999] min-w-[120px]"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {OVERLAY_LANGUAGES.map((lang) => {
            const active = language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => { onLanguageChange?.(lang.code); setOpen(false); }}
                className={`flex items-center gap-2 w-full px-3.5 py-2.5 text-xs font-medium border-0 cursor-pointer transition-colors text-left ${
                  active
                    ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    : 'bg-transparent text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-[#252538]'
                }`}
              >
                <span className="text-sm">{lang.flag}</span>
                <span className="flex-1">{lang.label}</span>
                {active && <FiCheck className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Circular progress spinner shown during dynamic walkthrough synthesis.
 */
function ProcessingSpinner({ percentage = 67 }) {
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-6 h-6 flex items-center justify-center flex-shrink-0">
      <svg width="24" height="24" viewBox="0 0 28 28" className="-rotate-90">
        <circle cx="14" cy="14" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="3" />
        <circle
          cx="14"
          cy="14"
          r={radius}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300"
        />
      </svg>
      <span className="absolute text-[7px] font-bold text-purple-600 dark:text-purple-400">
        {percentage}%
      </span>
    </div>
  );
}

/**
 * Converts Western digits 0-9 to Khmer numerals ០-៩
 */
export function toKhmerNumerals(str) {
  const kmDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(str).replace(/[0-9]/g, (d) => kmDigits[Number(d)] || d);
}

/**
 * Formats a message timestamp dynamically based on locale.
 * - Within 60 seconds: "Just now" / "ឥឡូវនេះ"
 * - Past 60 seconds: Localized time (Khmer numerals + period for km, 12h AM/PM for en)
 * - Fallback to static msg.time for backward compatibility
 */
export function formatMessageTime(msg, language = 'km') {
  if (!msg) return '';
  const ts = msg.timestamp || msg.createdAt;
  if (typeof ts === 'number') {
    const diffMs = Date.now() - ts;
    if (diffMs >= 0 && diffMs < 60 * 1000) {
      return getUIString('justNow', language);
    }
    const date = new Date(ts);
    if (language === 'km') {
      const hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const isPm = hours >= 12;
      const formattedHours = String(hours % 12 || 12).padStart(2, '0');
      const period = isPm ? 'រសៀល' : 'ព្រឹក';
      return `${toKhmerNumerals(formattedHours)}:${toKhmerNumerals(minutes)} ${period}`;
    }
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  return msg.time || '';
}

/**
 * ChatBoxWidgetOverlay — Complete In-Page Chat Box Widget Overlay inside Shadow DOM.
 *
 * Capabilities:
 *  - Multi-tab AI chat synced across tabs (`guideme_chat_tabs`)
 *  - Conversational history with timestamps & embedded screenshots
 *  - Multimodal image attachments (file upload, screenshot capture, clipboard paste)
 *  - Real Web Speech API voice input (km-KH & en-US)
 *  - Active Walkthrough Controller HUD (Next, Prev, Audio Replay, Mute, Volume, End)
 *  - Cross-tab active guide notice: tells user to return to previous tab to continue step or click (X) to end
 *  - Suggested Quick Actions (catalog guides for the active URL)
 *  - Draggable & minimizable floating overlay
 */
export function ChatBoxWidgetOverlay({
  isOpen = false,
  onToggleOpen,
  onStartDynamicGuide,
  onStartTutorial,
  availableTutorials = [],
  language = 'km',
  onLanguageChange,
  theme = 'light',
  onThemeChange,
  engineState,
  onNext,
  onPrev,
  onReplayAudio,
  onToggleMute,
  onVolumeChange,
  onClose,
}) {
  const cardWidth = 520;
  const isKhmer = language === 'km';

  // ── Sidebar visibility state ──────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Drag & Position State ─────────────────────────────────────
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('guideme_chat_overlay_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.top === 'number' && typeof parsed?.left === 'number') {
          const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
          const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
          return {
            top: Math.max(12, Math.min(parsed.top, vh - 220)),
            left: Math.max(12, Math.min(parsed.left, vw - cardWidth - 12)),
          };
        }
      }
    } catch { }
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
    return {
      top: Math.max(20, Math.floor(vh - 540)),
      left: Math.max(16, Math.floor(vw - cardWidth - 24)),
    };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialLeft: 0, initialTop: 0 });
  const widgetRef = useRef(null);

  // ── Multi-Tab AI Chat State ───────────────────────────────────
  const [chatTabs, setChatTabs] = useState(() => [
    {
      id: 'tab-1',
      title: `${getUIString('defaultChatTitle', language)} 1`,
      messages: [
        {
          role: 'assistant',
          content: getUIString('chatGreeting', language),
          timestamp: Date.now(),
        },
      ],
      isDefaultTitle: true,
      createdAt: Date.now(),
    },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');

  // Synchronized refs to avoid stale closure races during async AI generation
  const tabsRef = useRef(chatTabs);
  const activeTabIdRef = useRef(activeTabId);

  useEffect(() => {
    tabsRef.current = chatTabs;
  }, [chatTabs]);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  // ── Prompt & Form State ───────────────────────────────────────
  const [promptText, setPromptText] = useState('');
  const [attachedImage, setAttachedImage] = useState(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPercent, setProcessingPercent] = useState(67);
  const [isListening, setIsListening] = useState(false);

  // ── Auth State (synced live from chrome.storage) ──────────────
  const [authToken, setAuthToken] = useState(null);

  // ── Active Walkthrough State (from storage/session) ───────────
  const [activeGuideState, setActiveGuideState] = useState(() => {
    if (engineState?.isActive && engineState?.tutorial) {
      return {
        active: true,
        currentStepIndex: engineState.currentStepIndex || 0,
        totalSteps: engineState.totalSteps || engineState.tutorial?.steps?.length || 1,
        name: engineState.tutorial?.name,
        stepTitle: engineState.currentStep?.action?.title || engineState.currentStep?.title || '',
        isMuted: engineState.isMuted,
        volume: engineState.volume,
        targetUrl: typeof window !== 'undefined' ? window.location.href : '',
      };
    }
    return null;
  });

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  // Always-current language ref — safe to read inside async callbacks and stale closures.
  const languageRef = useRef(language);
  useEffect(() => { languageRef.current = language; }, [language]);

  // ── Re-translate default tab titles & greeting when language switches ──
  // Tabs with user-typed titles (isDefaultTitle=false) are left untouched.
  useEffect(() => {
    setChatTabs((prevTabs) => {
      const defaultBase = getUIString('defaultChatTitle', language);
      const greeting = getUIString('chatGreetingShort', language);
      return prevTabs.map((tab, idx) => {
        if (!tab.isDefaultTitle) return tab;
        // Re-translate the title
        const newTitle = `${defaultBase} ${idx + 1}`;
        // Re-translate only the first assistant greeting message
        const messages = tab.messages.map((msg, mi) => {
          if (mi === 0 && msg.role === 'assistant') {
            return { ...msg, content: greeting };
          }
          return msg;
        });
        return { ...tab, title: newTitle, messages };
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // ── 1. Restore & Synchronize Storage Across Tabs ───────────────
  useEffect(() => {
    const initFromStorage = async () => {
      try {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
        const res = await chrome.storage.local.get([
          'guideme_chat_tabs',
          'guideme_active_chat_tab_id',
          'guideme_chat_messages',
          'guideme_active_guide_state',
          'guideme_active_tutorial_session',
          'authToken',
        ]);

        if (res?.authToken) setAuthToken(res.authToken);

        let initialTabs = res.guideme_chat_tabs;
        let initialActiveId = res.guideme_active_chat_tab_id;

        if (!Array.isArray(initialTabs) || initialTabs.length === 0) {
          const lang = languageRef.current;
          const defaultTab = {
            id: 'tab-' + Date.now(),
            title: `${getUIString('defaultChatTitle', lang)} 1`,
            messages: [
              {
                role: 'assistant',
                content: getUIString('chatGreeting', lang),
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

        const lang = languageRef.current;
        setChatTabs(initialTabs.map((tab, idx) => {
          if (!tab.isDefaultTitle) return tab;
          return {
            ...tab,
            title: `${getUIString('defaultChatTitle', lang)} ${idx + 1}`,
            messages: tab.messages.map((msg, mi) =>
              mi === 0 && msg.role === 'assistant'
                ? { ...msg, content: getUIString('chatGreeting', lang) }
                : msg
            ),
          };
        }));
        tabsRef.current = initialTabs;
        const resolvedActiveId = initialActiveId || initialTabs[0]?.id;
        setActiveTabId(resolvedActiveId);
        activeTabIdRef.current = resolvedActiveId;

        const activeGuide = res.guideme_active_guide_state || res.guideme_active_tutorial_session;
        if (activeGuide && (activeGuide.active || activeGuide.tutorial)) {
          setActiveGuideState(activeGuide);
        }
      } catch (err) {
        console.warn('[GuideMe ChatBox] Storage init error:', err);
      }
    };

    initFromStorage();

    // Listen to changes from other tabs
    const storageListener = (changes, areaName) => {
      if (areaName !== 'local' && areaName !== 'session') return;

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
      if (changes.guideme_active_guide_state || changes.guideme_active_tutorial_session) {
        const newState = (changes.guideme_active_guide_state || changes.guideme_active_tutorial_session)?.newValue;
        if (newState && (newState.active || newState.tutorial)) {
          setActiveGuideState(newState);
        } else {
          setActiveGuideState(null);
        }
      }

      // ── Auth token sync: popup login clears auth-prompt cards ──
      if (changes.authToken !== undefined) {
        const newToken = changes.authToken?.newValue || null;
        setAuthToken(newToken);
        if (newToken) {
          // Remove any auth-prompt messages that are no longer relevant
          setChatTabs((prevTabs) => {
            const cleaned = prevTabs.map((tab) => ({
              ...tab,
              messages: tab.messages.filter((m) => m.role !== 'auth-prompt'),
            }));
            tabsRef.current = cleaned;
            try {
              const active = cleaned.find((t) => t.id === activeTabIdRef.current) || cleaned[0];
              chrome.storage?.local?.set({
                guideme_chat_tabs: cleaned,
                guideme_chat_messages: active?.messages || [],
              });
            } catch { }
            return cleaned;
          });
        }
      }

      // ── Chat sync: popup wrote guideme_chat_messages → merge into active tab ──
      if (changes.guideme_chat_messages?.newValue && !changes.guideme_chat_tabs) {
        // Only react when popup (not us) wrote this key — we skip if guideme_chat_tabs
        // also changed because that means we wrote it ourselves via updateTabs().
        const incomingMsgs = changes.guideme_chat_messages.newValue;
        if (Array.isArray(incomingMsgs) && incomingMsgs.length > 0) {
          setChatTabs((prevTabs) => {
            const curId = activeTabIdRef.current || prevTabs[0]?.id;
            const updated = prevTabs.map((tab) =>
              tab.id === curId ? { ...tab, messages: incomingMsgs } : tab
            );
            tabsRef.current = updated;
            return updated;
          });
        }
      }
    };

    chrome.storage?.onChanged?.addListener(storageListener);
    return () => chrome.storage?.onChanged?.removeListener(storageListener);
  }, []);

  // Sync engineState prop to activeGuideState
  useEffect(() => {
    if (engineState?.isActive && engineState?.tutorial) {
      setActiveGuideState({
        active: true,
        currentStepIndex: engineState.currentStepIndex || 0,
        totalSteps: engineState.totalSteps || engineState.tutorial?.steps?.length || 1,
        name: engineState.tutorial?.name,
        stepTitle: engineState.currentStep?.action?.title || engineState.currentStep?.title || '',
        isMuted: engineState.isMuted,
        volume: engineState.volume,
        targetUrl: window.location.href,
      });
    } else if (engineState && !engineState.isActive && !engineState.isCompleted) {
      setActiveGuideState(null);
    }
  }, [engineState]);

  // ── 2. Tab Management Helpers ─────────────────────────────────
  const getActiveTab = useCallback(() => {
    const tabs = tabsRef.current || chatTabs;
    const curId = activeTabIdRef.current || activeTabId;
    return tabs.find((t) => t.id === curId) || tabs[0];
  }, [chatTabs, activeTabId]);

  /**
   * Atomic tab updater that uses React functional state update to prevent
   * stale closure overwrites and synchronously updates tabsRef and storage.
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
        title: `${getUIString('defaultChatTitle', language)} ${num}`,
        messages: [
          {
            role: 'assistant',
            content: getUIString('chatGreetingShort', language),
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
        // Reset the only tab
        const resetTab = {
          ...prevTabs[0],
          title: `${getUIString('defaultChatTitle', language)} 1`,
          isDefaultTitle: true,
          messages: [
            {
              role: 'assistant',
              content: getUIString('chatGreetingShort', language),
              timestamp: Date.now(),
            },
          ],
        };
        return [resetTab];
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

  // ── 3. Chat Message Appenders ─────────────────────────────────
  const appendUserMessage = (text, image, targetTabId) => {
    const tabIdToUse = targetTabId || activeTabIdRef.current || 'tab-1';
    const newMsg = {
      role: 'user',
      content: text,
      image: image || undefined,
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

  const appendAiMessage = (text, targetTabId, role = 'assistant') => {
    const tabIdToUse = targetTabId || activeTabIdRef.current || 'tab-1';
    const newMsg = {
      role,
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

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatTabs, activeTabId]);

  // ── 4. Multimodal Attachments (Upload, Screenshot, Paste) ──────
  const handleUploadImageClick = () => {
    setIsPlusMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = typeof window !== 'undefined' && window.FileReader ? new window.FileReader() : null;
    if (!reader) return;
    reader.onload = (evt) => {
      setAttachedImage(evt.target?.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCaptureTabScreenshot = () => {
    setIsPlusMenuOpen(false);
    try {
      chrome.runtime?.sendMessage({ action: 'GUIDEME_CAPTURE_TAB_SCREENSHOT' }, (response) => {
        if (response?.success && response.dataUrl) {
          setAttachedImage(response.dataUrl);
        } else {
          console.warn('[GuideMe ChatBox] Screenshot capture failed:', response?.error);
        }
      });
    } catch (err) {
      console.warn('[GuideMe ChatBox] Capture error:', err);
    }
  };

  // Clipboard paste listener (Ctrl+V / Cmd+V images)
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const reader = typeof window !== 'undefined' && window.FileReader ? new window.FileReader() : null;
          if (!reader) break;
          reader.onload = (evt) => {
            setAttachedImage(evt.target?.result);
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  };

  // ── 5. Real Web Speech API Controller ─────────────────────────
  const handleToggleSpeech = () => {
    const SR = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;

    if (!SR) {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(getUIString('voiceNotSupported', language));
      }
      return;
    }

    if (isListening && speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch { }
      setIsListening(false);
      return;
    }

    try {
      const rec = new SR();
      rec.lang = isKhmer ? 'km-KH' : 'en-US';
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (evt) => {
        const transcript = Array.from(evt.results)
          .map((r) => r[0].transcript)
          .join('');
        setPromptText(transcript);
      };

      rec.onend = () => setIsListening(false);
      rec.onerror = () => setIsListening(false);

      rec.start();
      speechRecognitionRef.current = rec;
      setIsListening(true);
    } catch (err) {
      console.warn('[GuideMe ChatBox] Speech error:', err);
      setIsListening(false);
    }
  };

  // ── 6. Prompt Submission & AI Routing ─────────────────────────
  const handleSendPrompt = async (e) => {
    e?.preventDefault();
    const text = promptText.trim();
    const imageToSend = attachedImage;

    if (!text && !imageToSend) return;

    const effectiveText = text || (isKhmer ? 'សូមពិនិត្យមើលរូបភាពនេះ និងជួយខ្ញុំ' : 'Please check this image and help me');

    // ── Auth gate — uses live-synced state token ─────────────────
    const earlyToken = authToken;

    if (!earlyToken) {
      // Show auth prompt card in chat — no auto-redirect, user decides
      const targetTabId = appendUserMessage(effectiveText, imageToSend);
      setPromptText('');
      setAttachedImage(null);
      appendAiMessage(
        isKhmer
          ? 'សូមចូលគណនីរបស់អ្នកមុនពេលប្រើ GuideMe AI Assistant។'
          : 'Please log in to your GuideMe account before using the AI Assistant.',
        targetTabId,
        'auth-prompt'
      );
      return;
    }

    const targetTabId = appendUserMessage(effectiveText, imageToSend);
    setPromptText('');
    setAttachedImage(null);
    setIsProcessing(true);
    setProcessingPercent(30);

    // Resolve backend URL
    const isDev = Boolean(import.meta.env?.DEV);
    const defaultProdUrl = 'https://guideme-lac.vercel.app';
    let baseUrl = import.meta.env?.WXT_API_URL || (isDev ? 'http://localhost:4000' : defaultProdUrl);
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const stored = await chrome.storage.local.get(['guideme_backend_url']).catch(() => ({}));
        if (stored?.guideme_backend_url) baseUrl = stored.guideme_backend_url;
      }
    } catch {}

    const token = earlyToken;
    const authHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    // ── Stage 1: validate-intent (mirrors popup exactly) ─────────
    let validated = null;
    if (baseUrl) {
      try {
        setProcessingPercent(50);
        const ctrl1 = new AbortController();
        const t1 = setTimeout(() => ctrl1.abort(), 8000);
        const res1 = await fetch(`${baseUrl.replace(/\/$/, '')}/api/ai/validate-intent`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            prompt: effectiveText,
            currentUrl: typeof window !== 'undefined' ? window.location.href : '',
            language,
          }),
          signal: ctrl1.signal,
        });
        clearTimeout(t1);
        if (res1.ok) validated = await res1.json();
      } catch {
        // Backend unreachable — fall through to local classifier
      }
    }

    // Local classifier fallback when backend is offline
    if (!validated) {
      const classification = classifyPrompt(effectiveText);
      validated = {
        valid: classification.type === 'actionable',
        reason: classification.type !== 'actionable'
          ? (classification.responses?.[language] || classification.responses?.en || '')
          : '',
        pages: classification.type === 'actionable'
          ? [{ route: 'current', action: 'user_intent', target: '', description: effectiveText }]
          : [],
      };
    }

    // ── Stage 2a: valid actionable intent → start guide ──────────
    if (validated.valid) {
      const startingMsg = isKhmer
        ? 'យល់ហើយ! កំពុងចាប់ផ្តើមការណែនាំជាជំហានៗលើទំព័រនេះ...'
        : 'Got it! Starting step-by-step guidance on this page...';
      appendAiMessage(startingMsg, targetTabId);
      setProcessingPercent(85);
      if (onStartDynamicGuide) {
        onStartDynamicGuide(effectiveText, imageToSend, null);
        onToggleOpen?.(false);
      }
      setIsProcessing(false);
      setProcessingPercent(100);
      return;
    }

    // ── Stage 2b: not actionable → send to chat assistant ────────
    let aiResponded = false;
    if (baseUrl && !imageToSend) {
      // Non-actionable text prompt (greeting, question) → chat assistant
      try {
        setProcessingPercent(65);
        const ctrl2 = new AbortController();
        const t2 = setTimeout(() => ctrl2.abort(), 12000);
        const res2 = await fetch(`${baseUrl.replace(/\/$/, '')}/api/ai/assistant-chat`, {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders,
          body: JSON.stringify({ question: effectiveText, language }),
          signal: ctrl2.signal,
        });
        clearTimeout(t2);

        if (res2.status === 401) {
          appendAiMessage(
            isKhmer ? 'វគ្គរបស់អ្នកផុតកំណត់ហើយ។ សូមចូលគណនីម្តងទៀត។'
                    : 'Your session has expired. Please log in again.',
            targetTabId
          );
          setIsProcessing(false);
          setProcessingPercent(100);
          return;
        }

        if (res2.status === 429) {
          const errData = await res2.json().catch(() => ({}));
          appendAiMessage(
            errData?.error?.message || (isKhmer
              ? 'អ្នកបានប្រើ AI ច្រើនពេក សម្រាប់ថ្ងៃនេះ។'
              : 'Daily AI limit reached. Upgrade to PRO for more requests.'),
            targetTabId
          );
          setIsProcessing(false);
          setProcessingPercent(100);
          return;
        }

        if (res2.ok) {
          const data = await res2.json();
          const reply = data.answer || data.message;
          if (reply) {
            appendAiMessage(reply, targetTabId);
            aiResponded = true;
            // Backend can still request a guide via triggerGuide flag
            if (data.triggerGuide && onStartDynamicGuide) {
              onStartDynamicGuide(data.intentPrompt || effectiveText, null, data.intent || null);
              onToggleOpen?.(false);
            }
          }
        }
      } catch {
        // Backend offline — fall through to local text fallback
      }
    }

    // ── Stage 2c: local text fallback (backend offline / image) ──
    if (!aiResponded) {
      const reason = validated.reason;
      const fallbackMsg = reason || (isKhmer
        ? 'សូមបញ្ជាក់អ្វីដែលអ្នកចង់ធ្វើនៅលើទំព័រនេះ ហើយខ្ញុំនឹងណែនាំជំហានៗ។'
        : 'Please describe what you\'d like to do on this page and I\'ll guide you step by step.');
      appendAiMessage(fallbackMsg, targetTabId);
    }

    setIsProcessing(false);
    setProcessingPercent(100);
  };

  // ── 7. Draggable Header Handlers ──────────────────────────────
  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('button, input, select, textarea, a')) return;
    const el = widgetRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, initialLeft: rect.left, initialTop: rect.top };
    setIsDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { }
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const { startX, startY, initialLeft, initialTop } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = widgetRef.current?.offsetWidth || cardWidth;
    const h = widgetRef.current?.offsetHeight || 400;
    const newLeft = Math.max(12, Math.min(initialLeft + dx, vw - w - 12));
    const newTop = Math.max(12, Math.min(initialTop + dy, vh - h - 12));
    setPosition({ top: newTop, left: newLeft });
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { }
    try {
      localStorage.setItem('guideme_chat_overlay_pos', JSON.stringify(position));
    } catch { }
  };

  // ── 8. Cross-Tab Guide Detection (User's Requirement!) ────────
  // Check if an active guide belongs to another tab / URL
  const currentHref = typeof window !== 'undefined' && window.location ? window.location.href || '' : '';
  const isGuideOnOtherTab = Boolean(
    activeGuideState?.active &&
    activeGuideState?.targetUrl &&
    currentHref &&
    !currentHref.startsWith(activeGuideState.targetUrl.split('#')[0]) &&
    !engineState?.isActive
  );

  const handleReturnToPreviousTab = () => {
    if (activeGuideState?.tabId && typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.update(activeGuideState.tabId, { active: true }, () => {
        if (chrome.runtime?.lastError) { /* ignore */ }
      });
    }
  };

  const handleEndActiveGuide = () => {
    try {
      chrome.runtime?.sendMessage({ action: 'GUIDEME_CLEAR_SESSION' });
      chrome.storage?.local?.remove(['guideme_active_guide_state', 'guideme_active_tutorial_session']);
    } catch { }
    setActiveGuideState(null);
    if (onClose) onClose();
    appendAiMessage(getUIString('walkthroughEnded', language));
  };

  if (!isOpen) return null;

  const activeTab = getActiveTab();
  const hasTextOrImage = promptText.trim().length > 0 || Boolean(attachedImage);

  return (
    <div
      ref={widgetRef}
      onPaste={handlePaste}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      onKeyPress={(e) => e.stopPropagation()}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${cardWidth}px`,
        height: '600px',
        fontFamily: isKhmer
          ? "'Kantumruy Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          : "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        boxShadow: isDragging
          ? '0 30px 80px rgba(0, 0, 0, 0.40), 0 12px 28px rgba(147, 51, 234, 0.25), 0 0 0 1px rgba(147, 51, 234, 0.3)'
          : '0 20px 55px -8px rgba(0, 0, 0, 0.30), 0 8px 24px rgba(147, 51, 234, 0.15), 0 0 0 1px rgba(147, 51, 234, 0.18)',
      }}
      className={`fixed z-[999998] pointer-events-auto max-w-[94vw] bg-white/95 dark:bg-[#151421]/95 backdrop-blur-xl border border-purple-200/60 dark:border-[#383359] rounded-2xl text-gray-900 dark:text-zinc-100 overflow-hidden animate-[guideme-card-pop_0.22s_ease-out] flex flex-col transition-shadow duration-200 ${
        isDragging ? 'cursor-grabbing select-none scale-[1.01]' : ''
      } ${isKhmer ? 'font-kantumruy' : 'font-sans'}`}
    >
      {/* ── 1. Draggable Window Header ── */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`flex items-center justify-between px-3.5 py-2.5 border-b border-purple-100/80 dark:border-[#2a2744] select-none cursor-grab active:cursor-grabbing bg-gradient-to-r from-purple-50/70 via-white/80 to-purple-50/70 dark:from-[#1b192e] dark:via-[#151421] dark:to-[#1b192e] shrink-0 ${
          isDragging ? 'cursor-grabbing bg-purple-100/40 dark:bg-[#25223e]' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Sidebar toggle */}
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? (isKhmer ? 'លាក់វគ្គ' : 'Hide sessions') : (isKhmer ? 'បង្ហាញវគ្គ' : 'Show sessions')}
            className="text-gray-400 hover:text-purple-600 dark:text-zinc-400 dark:hover:text-purple-300 p-1 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/40 transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center shrink-0"
          >
            <FiChevronLeft className={`w-3.5 h-3.5 transition-transform duration-200 ${sidebarOpen ? '' : 'rotate-180'}`} />
          </button>
          <div className="w-5 h-5 rounded-md overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
            <GuideMeLogo size={20} />
          </div>
          <span className="text-xs font-extrabold tracking-tight text-purple-950 dark:text-purple-100 truncate">
            GuideMe AI
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 whitespace-nowrap">
            Coach
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Language Toggle — popup-style dropdown */}
          <LanguageDropdown language={language} onLanguageChange={onLanguageChange} />
          <button
            type="button"
            onClick={() => onToggleOpen?.(false)}
            aria-label={getUIString('minimize', language)}
            title={getUIString('minimize', language)}
            className="text-gray-400 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-[#252538] transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
          >
            <FiMinus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onToggleOpen?.(false)}
            aria-label={getUIString('close', language)}
            title={getUIString('close', language)}
            className="text-gray-400 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 p-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
          >
            <FiX className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── 2. Two-Panel Body: Sessions Sidebar + Chat Area ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── 2a. Sessions Sidebar ── */}
        {sidebarOpen && (
        <div className="w-[130px] shrink-0 flex flex-col border-r border-purple-100/60 dark:border-[#2a2744] bg-gray-50/70 dark:bg-[#111020]/80 overflow-hidden">
          {/* New Chat Button */}
          <div className="p-2 shrink-0">
            <button
              type="button"
              onClick={handleCreateNewTab}
              title={getUIString('newChatTab', language)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-[10.5px] font-bold cursor-pointer border-0 transition-all shadow-sm shadow-purple-500/30"
            >
              <FiPlus className="w-3 h-3 shrink-0" />
              <span className="truncate">{isKhmer ? 'ជជែកថ្មី' : 'New Chat'}</span>
            </button>
          </div>

          {/* Session label */}
          <div className="px-2.5 pb-1 shrink-0">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
              {isKhmer ? 'វគ្គ' : 'Sessions'}
            </span>
          </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-0.5 px-1.5 pb-2 scrollbar-none">
            {chatTabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  onClick={() => handleSwitchTab(tab.id)}
                  className={`group relative flex items-start gap-1.5 px-2 py-2 rounded-lg cursor-pointer transition-all select-none ${
                    isActive
                      ? 'bg-purple-100/80 dark:bg-purple-900/40 text-purple-900 dark:text-purple-100'
                      : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-200/60 dark:hover:bg-[#1f1d33]'
                  }`}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-purple-600 dark:bg-purple-400" />
                  )}
                  <div className="flex-1 min-w-0 pl-1">
                    <p className={`text-[10.5px] font-medium leading-tight truncate ${isActive ? 'text-purple-900 dark:text-purple-100 font-semibold' : ''}`}>
                      {tab.title}
                    </p>
                    <p className="text-[9px] text-gray-400 dark:text-zinc-500 mt-0.5 truncate">
                      {tab.messages?.length > 0
                        ? `${tab.messages.length} ${isKhmer ? 'សារ' : 'msg'}`
                        : (isKhmer ? 'ទទេ' : 'Empty')}
                    </p>
                  </div>
                  {/* Delete button */}
                  {chatTabs.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => handleCloseTab(tab.id, e)}
                      className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded flex items-center justify-center border-0 bg-transparent cursor-pointer p-0 text-gray-400 hover:text-rose-500 dark:hover:text-rose-400 transition-all shrink-0 mt-0.5"
                    >
                      <FiX className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* ── 2b. Main Chat Panel ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Cross-Tab Active Guide Notice */}
          {isGuideOnOtherTab && (
            <div className="mx-2.5 mt-2.5 p-3 rounded-xl bg-amber-50/90 dark:bg-[#2b2416] border border-amber-200 dark:border-amber-700/60 shadow-sm animate-[guideme-card-pop_0.2s_ease-out] shrink-0">
              <div className="flex items-start gap-2.5">
                <FiAlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-amber-900 dark:text-amber-200 mb-1 break-words">
                    {getUIString('guideInProgressOnOtherTab', language)}
                  </div>
                  <p className="text-[10.5px] text-amber-800/90 dark:text-amber-300/80 m-0 leading-relaxed">
                    {getUIString('pleaseReturnToPreviousTab', language)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleReturnToPreviousTab}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] cursor-pointer border-0 shadow-sm transition-colors flex items-center gap-1 whitespace-nowrap"
                    >
                      <FiExternalLink className="w-3 h-3" />
                      <span>{getUIString('goToPreviousTab', language)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleEndActiveGuide}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#1a1728] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-[10px] cursor-pointer border border-rose-200 dark:border-rose-900/60 transition-colors whitespace-nowrap"
                    >
                      {getUIString('endAndStartNew', language)}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Walkthrough Controller HUD */}
          {!isGuideOnOtherTab && activeGuideState?.active && (
            <div className="mx-2.5 mt-2.5 p-2 rounded-xl bg-purple-50/90 dark:bg-[#201d36] border border-purple-200/80 dark:border-purple-800/60 shadow-sm flex items-center justify-between gap-2 animate-[guideme-card-pop_0.2s_ease-out] shrink-0">
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-[10.5px] font-bold text-purple-900 dark:text-purple-200 truncate">
                    {typeof activeGuideState.name === 'object'
                      ? (activeGuideState.name[language] || activeGuideState.name.en || 'GuideMe')
                      : (activeGuideState.name || 'GuideMe Walkthrough')}
                  </span>
                </div>
                <span className="text-[10px] text-gray-500 dark:text-zinc-400 truncate">
                  {activeGuideState.stepTitle
                    ? `${getUIString('step', language)} ${(activeGuideState.currentStepIndex || 0) + 1}: ${activeGuideState.stepTitle}`
                    : `${getUIString('guiding', language)}...`}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={onPrev} title={getUIString('prev', language)} className="w-6 h-6 rounded-md bg-white dark:bg-[#2b2746] text-purple-700 dark:text-purple-300 hover:bg-purple-100 border border-purple-200 dark:border-purple-700/60 flex items-center justify-center cursor-pointer p-0">
                  <FiChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-purple-200/70 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200">
                  {`${(activeGuideState.currentStepIndex || 0) + 1}/${activeGuideState.totalSteps || 1}`}
                </span>
                <button type="button" onClick={onNext} title={getUIString('next', language)} className="w-6 h-6 rounded-md bg-white dark:bg-[#2b2746] text-purple-700 dark:text-purple-300 hover:bg-purple-100 border border-purple-200 dark:border-purple-700/60 flex items-center justify-center cursor-pointer p-0">
                  <FiChevronRight className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={onReplayAudio} title={getUIString('replayAudio', language)} className="w-6 h-6 rounded-md bg-white dark:bg-[#2b2746] text-purple-700 dark:text-purple-300 hover:bg-purple-100 border border-purple-200 dark:border-purple-700/60 flex items-center justify-center cursor-pointer p-0">
                  <FiRotateCcw className="w-3 h-3" />
                </button>
                <button type="button" onClick={onToggleMute} title={activeGuideState.isMuted ? 'Unmute' : 'Mute'} className={`w-6 h-6 rounded-md flex items-center justify-center cursor-pointer p-0 border transition-colors ${activeGuideState.isMuted ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 border-rose-200 dark:border-rose-900' : 'bg-white dark:bg-[#2b2746] text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700/60'}`}>
                  {activeGuideState.isMuted ? <FiVolumeX className="w-3 h-3" /> : <FiVolume2 className="w-3 h-3" />}
                </button>
                <button type="button" onClick={handleEndActiveGuide} title={getUIString('close', language)} className="w-6 h-6 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-600 hover:bg-rose-100 border border-rose-200 dark:border-rose-900 flex items-center justify-center cursor-pointer p-0 ml-0.5">
                  <FiX className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ── Chat Message History ── */}
          <div className="flex-1 flex flex-col gap-3 p-3 overflow-y-auto scrollbar-thin text-xs">
            {activeTab?.messages?.map((msg, index) => {
              const isUser = msg.role === 'user';

              // ── Auth-prompt card ──
              if (msg.role === 'auth-prompt') {
                const siteUrl = import.meta.env?.WXT_SITE_URL || 'http://localhost:3005';
                return (
                  <div key={index} className="self-start items-start flex flex-col max-w-[88%]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-5 h-5 rounded-md bg-purple-600 flex items-center justify-center shrink-0">
                        <GuideMeLogo size={14} />
                      </div>
                      <span className="text-[9.5px] font-bold text-purple-700 dark:text-purple-400">GuideMe AI</span>
                    </div>
                    <div className="px-3 py-2.5 rounded-2xl rounded-bl-sm bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 shadow-sm flex flex-col gap-2">
                      <p className={`text-[12px] text-amber-900 dark:text-amber-200 leading-relaxed m-0 ${isKhmer ? 'font-kantumruy' : 'font-sans'}`}>
                        {msg.content}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          chrome.tabs?.create({ url: `${siteUrl.replace(/\/$/, '')}/login?source=extension` });
                        }}
                        className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-[11px] font-bold cursor-pointer border-0 transition-colors shadow-sm shadow-purple-500/30"
                      >
                        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
                        </svg>
                        <span>{isKhmer ? 'ចូលគណនី' : 'Log In'}</span>
                      </button>
                    </div>
                    {(() => {
                      const displayTime = formatMessageTime(msg, language);
                      if (!displayTime) return null;
                      return <span className="text-[9.5px] text-gray-400 dark:text-zinc-500 mt-1 px-1">{displayTime}</span>;
                    })()}
                  </div>
                );
              }

              return (
                <div
                  key={index}
                  className={`flex flex-col max-w-[88%] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}
                >
                  {/* Avatar row */}
                  {!isUser && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-5 h-5 rounded-md bg-purple-600 flex items-center justify-center shrink-0">
                        <GuideMeLogo size={14} />
                      </div>
                      <span className="text-[9.5px] font-bold text-purple-700 dark:text-purple-400">GuideMe AI</span>
                    </div>
                  )}
                  <div
                    className={`px-3 py-2 rounded-2xl shadow-sm text-[12px] leading-relaxed break-words ${
                      isUser
                        ? 'bg-purple-600 text-white rounded-br-sm'
                        : 'bg-gray-100 dark:bg-[#221f38] text-gray-800 dark:text-zinc-200 rounded-bl-sm border border-gray-200/50 dark:border-[#312c52]'
                    }`}
                  >
                    {msg.image && (
                      <div className="mb-2 overflow-hidden rounded-lg border border-white/20">
                        <img
                          src={msg.image}
                          alt="Attached screenshot"
                          className="w-full max-h-[120px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
                          onClick={() => {
                            const win = window.open('', '_blank');
                            if (win) {
                              win.document.write(
                                `<title>GuideMe Screenshot</title><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${msg.image}" style="max-width:95vw;max-height:95vh;border-radius:8px;"/></body>`
                              );
                            }
                          }}
                        />
                      </div>
                    )}
                    <div>{msg.content}</div>
                  </div>
                  {(() => {
                    const displayTime = formatMessageTime(msg, language);
                    if (!displayTime) return null;
                    return (
                      <span className="text-[9.5px] text-gray-400 dark:text-zinc-500 mt-1 px-1">
                        {displayTime}
                      </span>
                    );
                  })()}
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* ── Suggested Quick Actions ── */}
          {availableTutorials && availableTutorials.length > 0 && !activeGuideState?.active && (
            <div className="px-3 pb-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
              {availableTutorials.slice(0, 3).map((tut) => {
                const tutName = typeof tut.name === 'object'
                  ? (tut.name[language] || tut.name.en || 'Guide')
                  : tut.name;
                return (
                  <button
                    key={tut.id}
                    type="button"
                    onClick={() => {
                      const targetTabId = appendUserMessage(tutName);
                      appendAiMessage(`${getUIString('startingWalkthrough', language)} ${tutName}`, targetTabId);
                      onStartTutorial?.(tut.id);
                      onToggleOpen?.(false);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 hover:bg-purple-100 text-[10.5px] font-medium shrink-0 cursor-pointer transition-all"
                  >
                    <FiTarget className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                    <span className="truncate max-w-[100px]">{tutName}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Attachment Preview Tray ── */}
          {attachedImage && (
            <div className="px-3 py-1 flex items-center shrink-0">
              <div className="relative inline-flex items-center p-1 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 shadow-sm">
                <img src={attachedImage} alt="Attached thumbnail" className="w-11 h-11 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  title={getUIString('removeAttachment', language)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center cursor-pointer border-2 border-white dark:border-[#151421] shadow-sm hover:scale-110 transition-transform p-0"
                >
                  <FiX className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* ── Prompt Input Form ── */}
          <div className="p-2.5 border-t border-purple-100/70 dark:border-[#2a2744] shrink-0">
            <form onSubmit={handleSendPrompt} className="relative m-0">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileInputChange} style={{ display: 'none' }} />

              {/* Plus Menu Popover */}
              {isPlusMenuOpen && (
                <div className="absolute bottom-full mb-2 left-0 z-50 p-1.5 rounded-xl bg-white dark:bg-[#201d36] border border-purple-200 dark:border-purple-800 shadow-xl flex flex-col gap-1 min-w-[150px] animate-[guideme-card-pop_0.15s_ease-out]">
                  <button type="button" onClick={handleUploadImageClick} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[11px] font-medium text-gray-700 dark:text-zinc-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 border-0 bg-transparent cursor-pointer transition-colors">
                    <FiImage className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>{getUIString('uploadImage', language)}</span>
                  </button>
                  <button type="button" onClick={handleCaptureTabScreenshot} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[11px] font-medium text-gray-700 dark:text-zinc-200 hover:bg-purple-50 dark:hover:bg-purple-900/40 border-0 bg-transparent cursor-pointer transition-colors">
                    <FiCamera className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>{getUIString('captureTab', language)}</span>
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2 p-1.5 rounded-2xl bg-gray-100/80 dark:bg-[#1f1d33] border border-purple-200/80 dark:border-[#383359] focus-within:border-purple-500 dark:focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
                {isProcessing ? (
                  <div className="mb-0.5 ml-1">
                    <ProcessingSpinner percentage={processingPercent} />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                    className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800 flex items-center justify-center shrink-0 cursor-pointer border-0 transition-transform active:scale-95"
                    title={getUIString('uploadImage', language)}
                  >
                    <FiPlus className="w-4 h-4" />
                  </button>
                )}
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={promptText}
                  onChange={(e) => {
                    setPromptText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(120, Math.max(28, e.target.scrollHeight)) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendPrompt(e);
                    }
                  }}
                  placeholder={getUIString('askAnything', language)}
                  className={`flex-1 bg-transparent border-0 outline-none text-[12px] text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 font-normal resize-none py-1.5 px-1 max-h-[100px] min-h-[28px] overflow-y-auto leading-relaxed ${isKhmer ? 'font-kantumruy' : 'font-sans'}`}
                  style={{
                    border: 'none',
                    outline: 'none',
                    fontFamily: isKhmer
                      ? "'Kantumruy Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                      : "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  }}
                />
                {hasTextOrImage ? (
                  <button type="submit" className="w-7 h-7 rounded-full bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white flex items-center justify-center shrink-0 cursor-pointer border-0 shadow-md shadow-purple-500/30 transition-all hover:scale-105" title={getUIString('send', language)}>
                    <FiSend className="w-3 h-3" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleToggleSpeech}
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 cursor-pointer border-0 transition-all ${
                      isListening
                        ? 'bg-purple-600 text-white animate-pulse shadow-lg shadow-purple-500/50'
                        : 'bg-transparent text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50'
                    }`}
                    title={isListening ? getUIString('stopListening', language) : getUIString('voiceInput', language)}
                  >
                    <FiMic className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </form>
          </div>

        </div>{/* end main chat panel */}
      </div>{/* end two-panel body */}
    </div>
  );
}
