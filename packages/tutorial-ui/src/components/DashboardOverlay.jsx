import React, { useState, useEffect, useRef } from 'react';
import {
  FiGrid,
  FiBookOpen,
  FiClock,
  FiMessageSquare,
  FiUsers,
  FiCreditCard,
  FiSettings,
  FiInfo,
  FiSearch,
  FiPlus,
  FiSun,
  FiMoon,
  FiPlay,
  FiCheckCircle,
  FiSend,
  FiStar,
  FiCheck,
  FiX,
  FiTrash2,
  FiZap,
  FiCompass,
  FiVolume2,
} from 'react-icons/fi';
import { GuideMeLogo } from './GuideMeLogo.jsx';
import { backendApiRequest, BackendApiError } from '../lib/backend-api.js';

const TABS = [
  { id: 'overview', label: { en: 'Overview', km: 'ទិដ្ឋភាពទូទៅ' }, icon: FiGrid },
  { id: 'guides', label: { en: 'Guides', km: 'មេរៀនទាំងអស់' }, icon: FiBookOpen },
  { id: 'history', label: { en: 'History', km: 'ប្រវត្តិ' }, icon: FiClock },
  { id: 'ask-ai', label: { en: 'Ask AI', km: 'សួរ AI' }, icon: FiMessageSquare },
  { id: 'community', label: { en: 'Community', km: 'សហគមន៍' }, icon: FiUsers },
  { id: 'payment', label: { en: 'Payment', km: 'កញ្ចប់សេវា' }, icon: FiCreditCard },
  { id: 'settings', label: { en: 'Settings', km: 'ការកំណត់' }, icon: FiSettings },
  { id: 'about', label: { en: 'About', km: 'អំពីយើង' }, icon: FiInfo },
];

export function DashboardOverlay({
  isOpen = false,
  onClose,
  availableTutorials = [],
  onStartTutorial,
  language = 'km',
  onLanguageChange,
  theme = 'light',
  onThemeChange,
}) {
  const windowWidth = 1320;
  const windowHeight = 860;
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [speakerVoice, setSpeakerVoice] = useState('default');
  const [position, setPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  // Read once from the real manifest instead of hardcoding a version string
  // that silently drifts from the actual build (was showing "2.1.0" while
  // the manifest reported "1.0.0").
  const [extensionVersion, setExtensionVersion] = useState(null);
  useEffect(() => {
    try {
      const v = typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.().version;
      if (v) setExtensionVersion(v);
    } catch {}
  }, []);

  const dragRef = useRef({ startX: 0, startY: 0, initialLeft: 0, initialTop: 0 });
  const windowRef = useRef(null);

  // AI Chat state
  const [aiMessages, setAiMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I'm your GuideMe AI assistant. How can I help you create or run interactive web walkthroughs today?",
      time: 'Just now',
    },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);

  // Overview stats (real, from backend)
  const [stats, setStats] = useState(null); // { totalGuides, completedGuides, rating }
  const [currentProgress, setCurrentProgress] = useState(null); // { guideName, currentStep, totalSteps, percentage }
  const [statsError, setStatsError] = useState(null);

  // History list (real, from backend)
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyHidden, setHistoryHidden] = useState(false);

  // Community (real, from backend)
  const [communityPosts, setCommunityPosts] = useState([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityError, setCommunityError] = useState(null);
  const [likedPostIds, setLikedPostIds] = useState(() => new Set());

  // Billing / Payment (real, from backend — read-only, checkout deferred)
  const [billingPlan, setBillingPlan] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState(null);

  // Settings (real, from backend)
  const [appSettings, setAppSettings] = useState(null); // { overlayEnabled, voiceEnabled, readingSpeed }
  const [notificationSettings, setNotificationSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState(null);

  const isKhmer = language === 'km';

  // ── Lazy per-tab data loading: fetch each tab's real data the first time
  // it's opened, not all up front — keeps dashboard-open snappy. ──
  const loadedTabsRef = useRef(new Set());

  useEffect(() => {
    if (!isOpen) return;

    if (activeTab === 'overview' && !loadedTabsRef.current.has('overview')) {
      loadedTabsRef.current.add('overview');
      setStatsError(null);
      Promise.all([
        backendApiRequest('/api/user/stats'),
        backendApiRequest('/api/user/progress'),
      ])
        .then(([statsRes, progressRes]) => {
          setStats(statsRes);
          setCurrentProgress(progressRes);
        })
        .catch((err) => setStatsError(err instanceof BackendApiError ? err.message : String(err)));
    }

    if (activeTab === 'history' && !loadedTabsRef.current.has('history')) {
      loadedTabsRef.current.add('history');
      setHistoryLoading(true);
      setHistoryError(null);
      backendApiRequest('/api/user/activity')
        .then((activities) => setHistoryList(Array.isArray(activities) ? activities : []))
        .catch((err) => setHistoryError(err instanceof BackendApiError ? err.message : String(err)))
        .finally(() => setHistoryLoading(false));
    }

    if (activeTab === 'community' && !loadedTabsRef.current.has('community')) {
      loadedTabsRef.current.add('community');
      setCommunityLoading(true);
      setCommunityError(null);
      backendApiRequest('/api/community/posts')
        .then((res) => setCommunityPosts(Array.isArray(res?.posts) ? res.posts : Array.isArray(res) ? res : []))
        .catch((err) => setCommunityError(err instanceof BackendApiError ? err.message : String(err)))
        .finally(() => setCommunityLoading(false));
    }

    if (activeTab === 'payment' && !loadedTabsRef.current.has('payment')) {
      loadedTabsRef.current.add('payment');
      setBillingLoading(true);
      setBillingError(null);
      backendApiRequest('/api/billing/current-plan')
        .then((res) => setBillingPlan(res))
        .catch((err) => setBillingError(err instanceof BackendApiError ? err.message : String(err)))
        .finally(() => setBillingLoading(false));
    }

    if (activeTab === 'settings' && !loadedTabsRef.current.has('settings')) {
      loadedTabsRef.current.add('settings');
      setSettingsLoading(true);
      setSettingsError(null);
      Promise.all([
        backendApiRequest('/api/user/app-settings'),
        backendApiRequest('/api/user/notification-settings'),
      ])
        .then(([app, notif]) => {
          setAppSettings(app);
          setNotificationSettings(notif);
        })
        .catch((err) => setSettingsError(err instanceof BackendApiError ? err.message : String(err)))
        .finally(() => setSettingsLoading(false));
    }
  }, [isOpen, activeTab]);

  // Reset the "already loaded" cache whenever the dashboard is closed and
  // reopened, so data reflects anything that changed while it was closed.
  useEffect(() => {
    if (!isOpen) loadedTabsRef.current = new Set();
  }, [isOpen]);

  const updateAppSetting = (patch) => {
    const next = { ...(appSettings || {}), ...patch };
    setAppSettings(next);
    backendApiRequest('/api/user/app-settings', { method: 'PUT', body: JSON.stringify(patch) }).catch((err) => {
      setSettingsError(err instanceof BackendApiError ? err.message : String(err));
    });
  };

  const updateNotificationSetting = (patch) => {
    const next = { ...(notificationSettings || {}), ...patch };
    setNotificationSettings(next);
    backendApiRequest('/api/user/notification-settings', { method: 'PUT', body: JSON.stringify(patch) }).catch((err) => {
      setSettingsError(err instanceof BackendApiError ? err.message : String(err));
    });
  };

  // Voice Speaker has no backend field (would need a schema change) — persist
  // it locally and feed it straight to the running TTS engine via
  // chrome.storage, same as any other locally-scoped preference.
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
    chrome.storage.local.get(['guideme_voice_speaker']).then((res) => {
      if (res?.guideme_voice_speaker) setSpeakerVoice(res.guideme_voice_speaker);
    }).catch(() => {});
  }, []);

  const handleVoiceChange = (value) => {
    setSpeakerVoice(value);
    try {
      chrome.storage?.local?.set({ guideme_voice_speaker: value });
    } catch {}
  };

  const toggleCommunityLike = (postId) => {
    const alreadyLiked = likedPostIds.has(postId);
    // Optimistic flip so the button responds instantly.
    setLikedPostIds((prev) => {
      const next = new Set(prev);
      if (alreadyLiked) next.delete(postId); else next.add(postId);
      return next;
    });
    backendApiRequest(`/api/community/posts/${postId}/like`, { method: 'POST' })
      .then((res) => {
        // Reconcile with the server's authoritative like count/state.
        setCommunityPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes: res.likes } : p)));
        setLikedPostIds((prev) => {
          const next = new Set(prev);
          if (res.liked) next.add(postId); else next.delete(postId);
          return next;
        });
      })
      .catch(() => {
        // Revert the optimistic flip on failure.
        setLikedPostIds((prev) => {
          const next = new Set(prev);
          if (alreadyLiked) next.add(postId); else next.delete(postId);
          return next;
        });
      });
  };

  // Center window on open
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setPosition({
        top: Math.max(16, Math.floor((vh - windowHeight) / 2)),
        left: Math.max(16, Math.floor((vw - windowWidth) / 2)),
      });
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  /* ── Drag Titlebar Handlers ── */
  const handleTitlebarPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('button, input, select, a')) return;
    const el = windowRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialLeft: rect.left,
      initialTop: rect.top,
    };
    setIsDragging(true);
    try { el.setPointerCapture(e.pointerId); } catch { }
  };

  const handleTitlebarPointerMove = (e) => {
    if (!isDragging) return;
    const { startX, startY, initialLeft, initialTop } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = windowRef.current?.offsetWidth || windowWidth;
    const h = windowRef.current?.offsetHeight || windowHeight;

    setPosition({
      top: Math.max(8, Math.min(initialTop + dy, vh - h - 8)),
      left: Math.max(8, Math.min(initialLeft + dx, vw - w - 8)),
    });
  };

  const handleTitlebarPointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    try { windowRef.current?.releasePointerCapture(e.pointerId); } catch { }
  };

  const handleSendAiMessage = async (e) => {
    e?.preventDefault();
    const text = aiInput.trim();
    if (!text) return;

    const userMsg = { role: 'user', content: text, time: 'Just now' };
    setAiMessages((prev) => [...prev, userMsg]);
    setAiInput('');
    setIsAiTyping(true);

    try {
      const res = await backendApiRequest('/api/ai/assistant-chat', {
        method: 'POST',
        body: JSON.stringify({ question: text, language }),
      });
      const reply = res?.answer || res?.reply || res?.message || (isKhmer ? 'សូមអភ័យទោស មិនអាចទទួលបានចម្លើយទេ។' : "Sorry, I couldn't generate a reply.");
      setAiMessages((prev) => [...prev, { role: 'assistant', content: reply, time: 'Just now' }]);
    } catch (err) {
      let reply;
      if (err instanceof BackendApiError && err.status === 403) {
        reply = isKhmer
          ? 'មុខងារនេះត្រូវការគម្រោង PRO ឬកំណែសាកល្បង។ សូមអាប់ហ្គ្រេតគម្រោងរបស់អ្នកនៅផ្ទាំង Payment ។'
          : 'Ask AI requires a PRO plan or an active trial. Upgrade from the Payment tab to unlock it.';
      } else if (err instanceof BackendApiError && err.status === 401) {
        reply = isKhmer ? 'សូមចូលគណនីម្តងទៀត។' : 'Please sign in again to use Ask AI.';
      } else {
        reply = isKhmer ? 'មានបញ្ហាក្នុងការភ្ជាប់ទៅម៉ាស៊ីនមេ។ សូមព្យាយាមម្តងទៀត។' : "Couldn't reach the backend. Please try again.";
      }
      setAiMessages((prev) => [...prev, { role: 'assistant', content: reply, time: 'Just now' }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleRunGuide = (tutorial) => {
    if (onStartTutorial) {
      onStartTutorial(tutorial.id);
      onClose?.();
    } else {
      const targetUrl = tutorial.matchUrls?.[0] || 'https://google.com';
      window.location.href = targetUrl.replace('*', '');
    }
  };

  const positionStyle = position
    ? { top: `${position.top}px`, left: `${position.left}px`, width: `${windowWidth}px` }
    : {};

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="GuideMe Dashboard Overlay"
      /* NO BACKDROP BLUR for Dashboard per user directive */
      className={`fixed inset-0 z-[999999] pointer-events-none bg-black/25 dark:bg-black/45 flex items-center justify-center p-3 sm:p-6 animate-[fadeIn_0.2s_ease-out] select-none ${
        isKhmer ? 'font-kantumruy' : 'font-sans'
      }`}
    >
      {/* ── Native Window Shell ── */}
      <div
        ref={windowRef}
        style={position ? { ...positionStyle, position: 'fixed' } : {}}
        onPointerMove={handleTitlebarPointerMove}
        onPointerUp={handleTitlebarPointerUp}
        onPointerCancel={handleTitlebarPointerUp}
        className={`pointer-events-auto w-[1320px] h-[860px] max-w-[96vw] max-h-[92vh] flex flex-col bg-white dark:bg-[#101018] text-gray-900 dark:text-zinc-100 rounded-2xl border border-gray-200/90 dark:border-[#2d2d44] shadow-[0_25px_80px_rgba(0,0,0,0.35),0_0_0_1px_rgba(147,51,234,0.25)] dark:shadow-[0_30px_90px_rgba(0,0,0,0.9),0_0_0_1px_rgba(168,85,247,0.35)] overflow-hidden animate-[guideme-card-pop_0.25s_cubic-bezier(0.16,1,0.3,1)] transition-shadow ${
          isDragging ? 'shadow-2xl scale-[1.005]' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Draggable Title Bar ── */}
        <div
          onPointerDown={handleTitlebarPointerDown}
          className={`h-10 px-4 bg-gray-50/95 dark:bg-[#13131f] border-b border-gray-200 dark:border-[#2d2d44] flex items-center justify-between shrink-0 select-none ${
            isDragging ? 'cursor-grabbing bg-purple-50/30 dark:bg-[#1c1c2e]' : 'cursor-grab'
          }`}
        >
          {/* Traffic Lights */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              title="Close Dashboard (Esc)"
              aria-label="Close Dashboard"
              className="w-3 h-3 rounded-full bg-[#ff5f57] hover:brightness-90 cursor-pointer border-0 p-0 transition-transform active:scale-90"
            />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>

          <span className="text-base font-semibold text-gray-500 dark:text-zinc-400 flex items-center gap-1.5">
            <span>GuideMe: Dashboard{extensionVersion ? ` v${extensionVersion}` : ''}</span>
            <span className="text-xs text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.2 rounded">
              DRAGGABLE
            </span>
          </span>

          {/* Close button on right */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-gray-200/60 dark:hover:bg-[#202032] cursor-pointer border-0 bg-transparent transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* ── Window Body (Sidebar + Main Content) ── */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-56 shrink-0 bg-white dark:bg-[#13131f] border-r border-gray-200 dark:border-[#2d2d44] flex flex-col justify-between p-3.5">
            <div>
              {/* Brand Logo */}
              <div className="flex items-center gap-2.5 px-2.5 py-2 mb-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                  <GuideMeLogo size={48} />
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-extrabold text-gray-900 dark:text-white leading-tight">
                    Guide Me
                  </div>
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider">
                    PRO OVERLAY
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <nav className="space-y-1">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-base font-semibold transition-all cursor-pointer border-0 ${
                        isActive
                          ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 shadow-sm'
                          : 'bg-transparent text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-[#181826] hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-zinc-500'}`} />
                      <span>{tab.label[language] || tab.label.en}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Content View */}
          <main className="flex-1 flex flex-col min-w-0 bg-[#fcfcfd] dark:bg-[#0f0f18] overflow-hidden">
            {/* Topbar */}
            <header className="h-14 px-6 bg-white dark:bg-[#13131f] border-b border-gray-200 dark:border-[#2d2d44] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white m-0">
                  {TABS.find((t) => t.id === activeTab)?.label[language] || 'Dashboard'}
                </h2>
              </div>

              <div className="flex items-center gap-3">
                {/* Language Switcher */}
                <button
                  type="button"
                  onClick={() => onLanguageChange?.(isKhmer ? 'en' : 'km')}
                  className="px-2.5 py-1 rounded-lg text-base font-bold bg-gray-100 dark:bg-[#181826] text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-[#2d2d44] hover:border-purple-500 cursor-pointer transition-colors"
                >
                  {isKhmer ? 'EN' : 'ខ្មែរ'}
                </button>

                {/* Theme Switcher */}
                <button
                  type="button"
                  onClick={() => onThemeChange?.(theme === 'dark' ? 'light' : 'dark')}
                  aria-label="Toggle theme"
                  className="w-12 h-12 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-[#181826] text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-[#2d2d44] hover:border-purple-500 cursor-pointer transition-colors"
                >
                  {theme === 'dark' ? <FiSun className="w-6 h-6 text-amber-400" /> : <FiMoon className="w-6 h-6" />}
                </button>

                {/* Create Guide */}
                <button
                  type="button"
                  onClick={() => setActiveTab('guides')}
                  style={{
                    background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
                    backgroundColor: '#9333ea',
                    color: '#ffffff',
                    boxShadow: '0 2px 10px rgba(147, 51, 234, 0.35)',
                    border: 'none',
                  }}
                  className="px-3.5 py-1.5 rounded-xl font-bold text-base text-white cursor-pointer flex items-center gap-1.5 border-0 shadow-sm transition-all hover:brightness-110"
                >
                  <FiPlus className="w-5 h-5 stroke-[2.5] text-white" />
                  <span className="text-white font-bold">{isKhmer ? 'បង្កើតការណែនាំ' : 'Create Guide'}</span>
                </button>
              </div>
            </header>

            {/* Scrollable Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* ── OVERVIEW TAB ── */}
              {activeTab === 'overview' && (
                <>
                  {/* Metric Cards */}
                  {statsError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 text-base">
                      {isKhmer ? 'មិនអាចផ្ទុកស្ថិតិបានទេ៖ ' : 'Could not load stats: '}{statsError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      {
                        label: isKhmer ? 'មេរៀនសរុប' : 'Total Guides',
                        value: stats ? stats.totalGuides : (availableTutorials.length || 0),
                      },
                      {
                        label: isKhmer ? 'មេរៀនបានបញ្ចប់' : 'Completed Guides',
                        value: stats ? stats.completedGuides : '—',
                      },
                      {
                        label: isKhmer ? 'កំពុងដំណើរការ' : 'Currently In Progress',
                        value: currentProgress?.guideName
                          ? `${currentProgress.percentage}%`
                          : (isKhmer ? 'គ្មាន' : 'None'),
                      },
                      {
                        label: isKhmer ? 'ការវាយតម្លៃ' : 'Rating',
                        value: stats ? `${stats.rating}★` : '—',
                      },
                    ].map((stat, i) => (
                      <div key={i} className="p-4 rounded-2xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-[#2d2d44] shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-base font-semibold text-gray-500 dark:text-zinc-400">{stat.label}</span>
                        </div>
                        <div className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {currentProgress?.guideName && (
                    <div className="p-4 rounded-2xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-[#2d2d44] shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-base font-bold text-gray-900 dark:text-white">{currentProgress.guideName}</span>
                        <span className="text-base font-semibold text-purple-600 dark:text-purple-400">
                          {currentProgress.currentStep}/{currentProgress.totalSteps} ({currentProgress.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-[#202032] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-purple-600 transition-all"
                          style={{ width: `${currentProgress.percentage}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Quick Actions Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('guides')}
                      className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 flex items-center gap-3 text-left hover:border-purple-400 transition-all cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
                        <FiPlus className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-base font-bold text-gray-900 dark:text-white">Create New Guide</div>
                        <div className="text-xs text-gray-500 dark:text-zinc-400">Build on-screen steps</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('ask-ai')}
                      className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 flex items-center gap-3 text-left hover:border-purple-400 transition-all cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <FiMessageSquare className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-base font-bold text-gray-900 dark:text-white">Ask AI Assistant</div>
                        <div className="text-xs text-gray-500 dark:text-zinc-400">Generate live workflows</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('community')}
                      className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 flex items-center gap-3 text-left hover:border-purple-400 transition-all cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0">
                        <FiCompass className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-base font-bold text-gray-900 dark:text-white">Explore Templates</div>
                        <div className="text-xs text-gray-500 dark:text-zinc-400">Community library</div>
                      </div>
                    </button>
                  </div>

                  {/* Recent Walkthroughs Table */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-[#2d2d44] shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white m-0">
                          {isKhmer ? 'មេរៀនណែនាំពេញនិយម' : 'Popular Walkthroughs'}
                        </h3>
                        <p className="text-base text-gray-500 dark:text-zinc-400 m-0 mt-0.5">
                          {isKhmer ? 'ចុច Run ដើម្បីចាប់ផ្ដើមការណែនាំលើទំព័រផ្ទាល់' : 'Click Run to launch the interactive overlay tutorial'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('guides')}
                        className="text-base font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer border-0 bg-transparent"
                      >
                        {isKhmer ? 'មើលទាំងអស់' : 'View All'}
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-base border-collapse">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-[#202032] text-gray-400 dark:text-zinc-500">
                            <th className="py-2.5 px-3 font-semibold">{isKhmer ? 'ឈ្មោះមេរៀន' : 'Guide Name'}</th>
                            <th className="py-2.5 px-3 font-semibold">{isKhmer ? 'ទំព័រគោលដៅ' : 'Target Site'}</th>
                            <th className="py-2.5 px-3 font-semibold">{isKhmer ? 'ចំនួនជំហាន' : 'Steps'}</th>
                            <th className="py-2.5 px-3 font-semibold">{isKhmer ? 'ស្ថានភាព' : 'Status'}</th>
                            <th className="py-2.5 px-3 text-right font-semibold">{isKhmer ? 'សកម្មភាព' : 'Action'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-[#202032]">
                          {availableTutorials.map((tut) => (
                            <tr key={tut.id} className="hover:bg-gray-50/50 dark:hover:bg-[#1f1f30] transition-colors">
                              <td className="py-3 px-3 font-bold text-gray-900 dark:text-zinc-100">
                                {typeof tut.name === 'object' ? tut.name[language] || tut.name.en : tut.name}
                              </td>
                              <td className="py-3 px-3 text-gray-500 dark:text-zinc-400 font-mono text-xs">
                                {tut.matchUrls?.[0]?.replace('*://', '')?.replace('/*', '') || 'Universal'}
                              </td>
                              <td className="py-3 px-3 text-gray-600 dark:text-zinc-300 font-semibold">
                                {tut.steps?.length || tut.totalSteps || 4} steps
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                                  Active
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRunGuide(tut)}
                                  style={{
                                    background: '#9333ea',
                                    backgroundColor: '#9333ea',
                                    color: '#ffffff',
                                    border: 'none',
                                    boxShadow: '0 2px 8px rgba(147, 51, 234, 0.35)',
                                  }}
                                  className="px-3.5 py-1 rounded-lg text-base font-bold text-white cursor-pointer transition-all inline-flex items-center gap-1 border-0 shadow-sm hover:brightness-110"
                                >
                                  <FiPlay className="w-4 h-4 text-white fill-current" />
                                  <span className="text-white font-bold">Run</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* ── GUIDES TAB ── */}
              {activeTab === 'guides' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-[#2d2d44]">
                    <FiSearch className="w-6 h-6 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={isKhmer ? 'ស្វែងរកមេរៀន...' : 'Search guides...'}
                      className={`bg-transparent border-0 outline-none text-base w-full text-gray-900 dark:text-white ${isKhmer ? 'font-kantumruy' : 'font-sans'}`}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableTutorials.filter((t) => {
                      const name = typeof t.name === 'object' ? t.name.en + t.name.km : t.name;
                      return name.toLowerCase().includes(searchQuery.toLowerCase());
                    }).map((tut) => (
                      <div key={tut.id} className="p-5 rounded-2xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-[#2d2d44] shadow-sm flex flex-col justify-between hover:border-purple-400 transition-all">
                        <div>
                          <div className="flex items-center justify-between mb-2.5">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300">
                              {tut.steps?.length || tut.totalSteps || 4} Steps
                            </span>
                            <span className="text-xs text-gray-400 font-mono">
                              {tut.matchUrls?.[0]?.replace('*://', '')?.replace('/*', '') || 'All sites'}
                            </span>
                          </div>
                          <h4 className="text-lg font-bold text-gray-900 dark:text-white m-0 mb-1.5">
                            {typeof tut.name === 'object' ? tut.name[language] || tut.name.en : tut.name}
                          </h4>
                          <p className="text-base text-gray-500 dark:text-zinc-400 m-0 leading-relaxed">
                            {typeof tut.description === 'object' ? tut.description[language] || tut.description.en : tut.description}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#202032] flex items-center justify-between">
                          <span className="text-base font-semibold text-emerald-600 dark:text-emerald-400">Verified</span>
                          <button
                            type="button"
                            onClick={() => handleRunGuide(tut)}
                            style={{
                              background: '#9333ea',
                              backgroundColor: '#9333ea',
                              color: '#ffffff',
                              border: 'none',
                              boxShadow: '0 2px 8px rgba(147, 51, 234, 0.35)',
                            }}
                            className="px-3.5 py-1.5 rounded-xl font-bold text-base text-white cursor-pointer transition-all inline-flex items-center gap-1.5 border-0 shadow-sm hover:brightness-110"
                          >
                            <FiPlay className="w-5 h-5 text-white fill-current" />
                            <span className="text-white font-bold">{isKhmer ? 'ចាប់ផ្ដើម' : 'Start Guide'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── HISTORY TAB ── */}
              {activeTab === 'history' && (
                <div className="p-5 rounded-2xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-[#2d2d44] shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white m-0">Recent Walkthrough Sessions</h3>
                      <p className="text-base text-gray-500 dark:text-zinc-400 m-0 mt-0.5">Logs of previously executed guided steps</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHistoryHidden(true)}
                      title="Hide this list (does not delete your activity history on the server)"
                      className="px-2.5 py-1 rounded-lg text-base font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 cursor-pointer border-0 flex items-center gap-1"
                    >
                      <FiTrash2 className="w-5 h-5" />
                      <span>Hide</span>
                    </button>
                  </div>

                  {historyError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 text-base">
                      Could not load activity: {historyError}
                    </div>
                  )}

                  {historyLoading && (
                    <div className="py-8 text-center text-base text-gray-400">Loading…</div>
                  )}

                  {!historyLoading && !historyHidden && (
                    <div className="divide-y divide-gray-100 dark:divide-[#202032]">
                      {historyList.map((item) => (
                        <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
                              <FiCheckCircle className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="text-base font-bold text-gray-900 dark:text-white">
                                {item.description || item.guide?.title || 'Activity'}
                              </div>
                              <div className="text-xs text-gray-400">
                                {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                              </div>
                            </div>
                          </div>
                          {item.guideId && (
                            <button
                              type="button"
                              onClick={() => {
                                const tut = availableTutorials.find((t) => t.id === item.guideId);
                                if (tut) handleRunGuide(tut);
                              }}
                              className="px-3 py-1 rounded-lg text-base font-bold bg-gray-100 dark:bg-[#202032] text-gray-700 dark:text-zinc-300 hover:bg-purple-600 hover:text-white transition-all cursor-pointer border-0"
                            >
                              Re-run
                            </button>
                          )}
                        </div>
                      ))}
                      {historyList.length === 0 && (
                        <div className="py-8 text-center text-base text-gray-400">No session history yet.</div>
                      )}
                    </div>
                  )}
                  {historyHidden && (
                    <div className="py-8 text-center text-base text-gray-400">
                      List hidden.{' '}
                      <button type="button" onClick={() => setHistoryHidden(false)} className="text-purple-600 dark:text-purple-400 font-semibold cursor-pointer border-0 bg-transparent">
                        Show again
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── ASK AI TAB ── */}
              {activeTab === 'ask-ai' && (
                <div className="h-[500px] flex flex-col bg-white dark:bg-[#181826] rounded-2xl border border-gray-200 dark:border-[#2d2d44] overflow-hidden">
                  <div className="flex-1 p-5 overflow-y-auto space-y-3.5">
                    {/* Quick suggestion chips */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {["How do I share a document?", "Explain this web page", "Create a new walkthrough", "Extract separate UI"].map((chip, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => { setAiInput(chip); }}
                          className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 hover:bg-purple-600 hover:text-white cursor-pointer transition-all"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>

                    {aiMessages.map((msg, i) => (
                      <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center shrink-0 mt-0.5">
                            <GuideMeLogo size={40} />
                          </div>
                        )}
                        <div
                          className={`max-w-[78%] px-4 py-3 rounded-2xl text-base leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-none'
                              : 'bg-purple-50/70 dark:bg-[#13131f] text-gray-800 dark:text-zinc-200 border border-purple-100 dark:border-[#2d2d44] rounded-tl-none'
                          }`}
                        >
                          <p className="m-0">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    {isAiTyping && (
                      <div className="flex gap-3 justify-start">
                        <div className="w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                          <GuideMeLogo size={40} />
                        </div>
                        <div className="px-4 py-2.5 rounded-2xl bg-purple-50 dark:bg-[#13131f] text-purple-600 dark:text-purple-400 text-base font-medium animate-pulse">
                          GuideMe AI is thinking...
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSendAiMessage} className="p-3 bg-gray-50/50 dark:bg-[#13131f] border-t border-gray-100 dark:border-[#2d2d44] m-0">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-[#2d2d44] focus-within:border-purple-500 transition-all">
                      <input
                        type="text"
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        placeholder={isKhmer ? 'សួរអ្វីមួយអំពីការណែនាំ...' : 'Ask anything about guides or workflows...'}
                        className={`flex-1 bg-transparent border-0 outline-none text-base text-gray-900 dark:text-white ${isKhmer ? 'font-kantumruy' : 'font-sans'}`}
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-base cursor-pointer border-0 transition-all flex items-center gap-1"
                      >
                        <FiSend className="w-5 h-5" />
                        <span>Send</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── COMMUNITY TAB ── */}
              {activeTab === 'community' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white m-0">Community Library</h3>
                      <p className="text-base text-gray-500 dark:text-zinc-400 m-0 mt-0.5">Discover public workflow templates</p>
                    </div>
                  </div>

                  {communityError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 text-base">
                      Could not load community posts: {communityError}
                    </div>
                  )}

                  {communityLoading && (
                    <div className="py-8 text-center text-base text-gray-400">Loading…</div>
                  )}

                  {!communityLoading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {communityPosts.map((item) => (
                        <div key={item.id} className="p-4 rounded-2xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-[#2d2d44] shadow-sm flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold uppercase tracking-wide text-purple-600 dark:text-purple-400">{item.category || 'General'}</span>
                              <button
                                type="button"
                                onClick={() => toggleCommunityLike(item.id)}
                                className={`text-base font-semibold flex items-center gap-1 cursor-pointer border-0 bg-transparent ${likedPostIds.has(item.id) ? 'text-amber-500' : 'text-gray-400'}`}
                              >
                                <FiStar className={`w-5 h-5 ${likedPostIds.has(item.id) ? 'fill-current' : ''}`} />
                                {item.likes ?? 0}
                              </button>
                            </div>
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white m-0 mb-1">{item.title}</h4>
                            <p className="text-base text-gray-500 dark:text-zinc-400 m-0 line-clamp-2">{item.description}</p>
                            <p className="text-xs text-gray-400 mt-1">by {item.user?.name || 'Unknown'}</p>
                          </div>
                          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#202032] flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => onClose?.()}
                              className="px-3 py-1 rounded-lg text-base font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-600 hover:text-white cursor-pointer border-0 transition-all"
                            >
                              Use Guide
                            </button>
                          </div>
                        </div>
                      ))}
                      {communityPosts.length === 0 && (
                        <div className="col-span-full py-8 text-center text-base text-gray-400">No community posts yet.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── PAYMENT TAB ── */}
              {activeTab === 'payment' && (
                <div className="space-y-5">
                  {billingError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 text-base">
                      Could not load billing info: {billingError}
                    </div>
                  )}
                  {billingLoading && (
                    <div className="py-8 text-center text-base text-gray-400">Loading…</div>
                  )}

                  {!billingLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {/* Kept in sync with GuideMe-Web's /pricing page (src/lib/i18n.ts
                          "pricing.*" keys) — this used to be an independently
                          hardcoded (and drifted: different names, prices, and
                          features) copy of the same three plans. */}
                      {[
                        {
                          name: { en: 'Free', km: 'ឥតគិតថ្លៃ' },
                          planKey: 'FREE',
                          price: '$0',
                          desc: { en: 'For casual exploration.', km: 'សម្រាប់ការសាកល្បងប្រើប្រាស់ធម្មតា។' },
                          features: [
                            { en: 'Basic app guides', km: 'ការណែនាំសម្រាប់កម្មវិធីមូលដ្ឋាន' },
                            { en: 'Khmer text explanations', km: 'ការពន្យល់ជាអក្សរខ្មែរ' },
                            { en: 'Standard click beacons', km: 'ចង្អុលបង្ហាញការចុចធម្មតា' },
                          ],
                        },
                        {
                          name: { en: 'Pro (Individual)', km: 'ពិសេស (ផ្ទាល់ខ្លួន)' },
                          planKey: 'PRO',
                          price: '$2.99',
                          popular: true,
                          desc: { en: 'For more usage.', km: 'សម្រាប់ការប្រើប្រាស់កម្រិតខ្ពស់ជាប្រចាំ។' },
                          features: [
                            { en: 'Everything in Free', km: 'អ្វីៗទាំងអស់ក្នុងកញ្ចប់ឥតគិតថ្លៃ' },
                            { en: 'Unlimited AI live overlays', km: 'ការណែនាំ AI ផ្ទាល់គ្មានដែនកំណត់' },
                            { en: 'Native Khmer Voice (TTS)', km: 'សំឡេងខ្មែរដើម (TTS)' },
                            { en: 'AI real-time error fix', km: 'ការកែកំហុសភ្លាមៗដោយ AI' },
                          ],
                        },
                        {
                          name: { en: 'Team / Enterprise', km: 'ក្រុម / ស្ថាប័ន' },
                          planKey: 'ENTERPRISE',
                          price: null,
                          desc: { en: 'For schools, NGOs & teams.', km: 'សម្រាប់សាលារៀន អង្គការ NGO ឬក្រុមការងារ។' },
                          features: [
                            { en: 'Everything in Pro', km: 'អ្វីៗទាំងអស់ក្នុងកញ្ចប់ពិសេស' },
                            { en: 'Central admin dashboard', km: 'ផ្ទាំងគ្រប់គ្រងសម្រាប់អ្នកគ្រប់គ្រង' },
                            { en: 'Team progress analytics', km: 'ការវិភាគវឌ្ឍនភាពក្រុម' },
                            { en: 'Dedicated SLA support', km: 'ការគាំទ្រតាមកិច្ចសន្យា SLA ផ្តាច់មុខ' },
                          ],
                        },
                      ].map((plan, i) => {
                        const isCurrent = billingPlan?.plan === plan.planKey;
                        return (
                          <div
                            key={i}
                            className={`p-6 rounded-3xl bg-white dark:bg-[#181826] border flex flex-col justify-between shadow-sm relative ${
                              isCurrent ? 'border-emerald-500 ring-2 ring-emerald-500/20' : plan.popular ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-gray-200 dark:border-[#2d2d44]'
                            }`}
                          >
                            {isCurrent ? (
                              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-extrabold bg-emerald-600 text-white shadow-sm">
                                {isKhmer ? 'គម្រោងរបស់អ្នក' : 'YOUR PLAN'}
                              </span>
                            ) : plan.popular && (
                              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-extrabold bg-purple-600 text-white shadow-sm">
                                {isKhmer ? 'ពេញនិយម' : 'MOST POPULAR'}
                              </span>
                            )}
                            <div>
                              <div className="text-lg font-bold text-gray-900 dark:text-white">{plan.name[language] || plan.name.en}</div>
                              <div className="text-base text-gray-500 dark:text-zinc-400 mt-0.5 mb-4">{plan.desc[language] || plan.desc.en}</div>
                              <div className="text-5xl font-extrabold text-gray-900 dark:text-white mb-5">
                                {plan.price ? (
                                  <>{plan.price}<span className="text-base font-normal text-gray-400">/mo</span></>
                                ) : (
                                  <span className="text-3xl">{isKhmer ? 'តាមតម្រូវការ' : 'Custom'}</span>
                                )}
                              </div>
                              <ul className="space-y-2 text-base text-gray-600 dark:text-zinc-300 p-0 m-0 list-none">
                                {plan.features.map((feat, fi) => (
                                  <li key={fi} className="flex items-center gap-2">
                                    <FiCheck className="w-5 h-5 text-purple-600 shrink-0" />
                                    <span>{feat[language] || feat.en}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <button
                              type="button"
                              disabled={isCurrent}
                              title={isCurrent ? undefined : (isKhmer ? 'ការទូទាត់មិនទាន់អាចប្រើបានទេ — មកដល់ឆាប់ៗនេះ' : 'Checkout is not available yet — coming soon')}
                              className={`w-full mt-6 py-2.5 rounded-xl font-bold text-base border-0 transition-all ${
                                isCurrent
                                  ? 'bg-gray-100 dark:bg-[#202032] text-gray-500 dark:text-zinc-400 cursor-default'
                                  : 'bg-gray-100 dark:bg-[#202032] text-gray-400 dark:text-zinc-500 cursor-not-allowed'
                              }`}
                            >
                              {isCurrent ? (isKhmer ? 'គម្រោងបច្ចុប្បន្ន' : 'Current Plan') : (isKhmer ? 'មកដល់ឆាប់ៗនេះ' : 'Coming Soon')}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── SETTINGS TAB ── */}
              {activeTab === 'settings' && (
                <div className="max-w-2xl space-y-5">
                  {settingsError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 text-base">
                      {settingsError}
                    </div>
                  )}
                  <div className="p-5 rounded-2xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-[#2d2d44] shadow-sm space-y-4">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white m-0">Voice & Overlay Preferences</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-base font-semibold text-gray-800 dark:text-zinc-200">Voice Speaker</div>
                          <div className="text-xs text-gray-400">Browser voice used for spoken guidance (English only)</div>
                        </div>
                        <select
                          value={speakerVoice}
                          onChange={(e) => handleVoiceChange(e.target.value)}
                          className="px-3 py-1.5 rounded-xl text-base font-bold bg-gray-100 dark:bg-[#202032] text-gray-800 dark:text-zinc-200 border border-gray-200 dark:border-[#2d2d44] outline-none"
                        >
                          <option value="default">Default</option>
                          <option value="samantha">Samantha</option>
                          <option value="daniel">Daniel</option>
                          <option value="karen">Karen</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-[#202032]">
                        <div>
                          <div className="text-base font-semibold text-gray-800 dark:text-zinc-200">Voice Guidance</div>
                          <div className="text-xs text-gray-400">Enable spoken step-by-step narration</div>
                        </div>
                        <button
                          type="button"
                          disabled={settingsLoading || !appSettings}
                          onClick={() => updateAppSetting({ voiceEnabled: !(appSettings?.voiceEnabled !== false) })}
                          className={`px-3 py-1.5 rounded-xl text-base font-bold border cursor-pointer transition-colors ${
                            appSettings?.voiceEnabled !== false
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-gray-100 dark:bg-[#202032] text-gray-600 dark:text-zinc-300 border-gray-200 dark:border-[#2d2d44]'
                          }`}
                        >
                          {appSettings?.voiceEnabled !== false ? 'On' : 'Off'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-[#202032]">
                        <div>
                          <div className="text-base font-semibold text-gray-800 dark:text-zinc-200">Overlay Highlighting</div>
                          <div className="text-xs text-gray-400">Show the spotlight/highlight box during guides</div>
                        </div>
                        <button
                          type="button"
                          disabled={settingsLoading || !appSettings}
                          onClick={() => updateAppSetting({ overlayEnabled: !(appSettings?.overlayEnabled !== false) })}
                          className={`px-3 py-1.5 rounded-xl text-base font-bold border cursor-pointer transition-colors ${
                            appSettings?.overlayEnabled !== false
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-gray-100 dark:bg-[#202032] text-gray-600 dark:text-zinc-300 border-gray-200 dark:border-[#2d2d44]'
                          }`}
                        >
                          {appSettings?.overlayEnabled !== false ? 'On' : 'Off'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-[#2d2d44] shadow-sm space-y-4">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white m-0">Notifications</h4>
                    <div className="space-y-3">
                      {[
                        { key: 'email', label: 'Email Updates' },
                        { key: 'push', label: 'Push Notifications' },
                        { key: 'newGuides', label: 'New Guide Alerts' },
                        { key: 'tips', label: 'Tips & Best Practices' },
                      ].map((row, idx) => (
                        <div key={row.key} className={`flex items-center justify-between ${idx > 0 ? 'pt-3 border-t border-gray-100 dark:border-[#202032]' : ''}`}>
                          <div className="text-base font-semibold text-gray-800 dark:text-zinc-200">{row.label}</div>
                          <button
                            type="button"
                            disabled={settingsLoading || !notificationSettings}
                            onClick={() => updateNotificationSetting({ [row.key]: !(notificationSettings?.[row.key] !== false) })}
                            className={`px-3 py-1.5 rounded-xl text-base font-bold border cursor-pointer transition-colors ${
                              notificationSettings?.[row.key] !== false
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-gray-100 dark:bg-[#202032] text-gray-600 dark:text-zinc-300 border-gray-200 dark:border-[#2d2d44]'
                            }`}
                          >
                            {notificationSettings?.[row.key] !== false ? 'On' : 'Off'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── ABOUT TAB ── */}
              {activeTab === 'about' && (
                <div className="max-w-2xl space-y-4">
                  <div className="p-6 rounded-2xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-[#2d2d44] shadow-sm text-center">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center mx-auto mb-3 shadow-md">
                      <GuideMeLogo size={80} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white m-0">
                      GuideMe Universal Tutorial Engine
                    </h3>
                    <p className="text-base text-gray-500 dark:text-zinc-400 mt-1 m-0">
                      {extensionVersion ? `Version ${extensionVersion} · ` : ''}Manifest V3 · Draggable In-Page Overlay
                    </p>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
