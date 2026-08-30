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
  FiExternalLink,
} from 'react-icons/fi';
import { GuideMeLogo } from './GuideMeLogo.jsx';

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
  onPopOut,
  availableTutorials = [],
  onStartTutorial,
  language = 'km',
  onLanguageChange,
  theme = 'light',
  onThemeChange,
}) {
  const windowWidth = 1120;
  const windowHeight = 740;
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [guideCategory, setGuideCategory] = useState('all');
  const [speakerVoice, setSpeakerVoice] = useState('default');
  const [position, setPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

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

  // History list
  const [historyList, setHistoryList] = useState([
    { id: 'h1', name: 'Google Docs Permission Sharing', time: '10 mins ago', steps: '4/4', status: 'Completed' },
    { id: 'h2', name: 'Facebook Post Creation & Privacy', time: '2 hours ago', steps: '5/5', status: 'Completed' },
    { id: 'h3', name: 'Spreadsheet Auto-Calculation', time: 'Yesterday', steps: '4/4', status: 'Completed' },
  ]);

  const isKhmer = language === 'km';

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

  const handleSendAiMessage = (e) => {
    e?.preventDefault();
    const text = aiInput.trim();
    if (!text) return;

    const userMsg = { role: 'user', content: text, time: 'Just now' };
    setAiMessages((prev) => [...prev, userMsg]);
    setAiInput('');

    setIsAiTyping(true);
    setTimeout(() => {
      setIsAiTyping(false);
      const responses = [
        "To start a guide, simply click the Run button on any guide card in the Overview or Guides tab!",
        "You can create custom interactive guides on any website by clicking 'Extract Separate UI' and asking GuideMe to highlight elements.",
        "I'm analyzing this webpage to suggest the most helpful step-by-step guidance for you.",
      ];
      const reply = responses[Math.floor(Math.random() * responses.length)];
      setAiMessages((prev) => [...prev, { role: 'assistant', content: reply, time: 'Just now' }]);
    }, 600);
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
        className={`pointer-events-auto w-[1120px] h-[740px] max-w-[96vw] max-h-[92vh] flex flex-col bg-white dark:bg-[#101018] text-gray-900 dark:text-zinc-100 rounded-2xl border border-gray-200/90 dark:border-[#2d2d44] shadow-[0_25px_80px_rgba(0,0,0,0.35),0_0_0_1px_rgba(147,51,234,0.25)] dark:shadow-[0_30px_90px_rgba(0,0,0,0.9),0_0_0_1px_rgba(168,85,247,0.35)] overflow-hidden animate-[guideme-card-pop_0.25s_cubic-bezier(0.16,1,0.3,1)] transition-shadow ${
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

          <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400 flex items-center gap-1.5">
            <span>GuideMe: Dashboard v2.1.0</span>
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.2 rounded">
              DRAGGABLE
            </span>
          </span>

          {/* Pop-out & Close buttons on right */}
          <div className="flex items-center gap-1">
            {onPopOut && (
              <button
                type="button"
                onClick={onPopOut}
                title="Pop out to floating window"
                aria-label="Pop out to floating window"
                className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-purple-600 dark:text-zinc-400 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 cursor-pointer border-0 bg-transparent transition-colors"
              >
                <FiExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-gray-200/60 dark:hover:bg-[#202032] cursor-pointer border-0 bg-transparent transition-colors"
            >
              <FiX className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Window Body (Sidebar + Main Content) ── */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-56 shrink-0 bg-white dark:bg-[#13131f] border-r border-gray-200 dark:border-[#2d2d44] flex flex-col justify-between p-3.5">
            <div>
              {/* Brand Logo */}
              <div className="flex items-center gap-2.5 px-2.5 py-2 mb-4">
                <div className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                  <GuideMeLogo size={32} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-gray-900 dark:text-white leading-tight">
                    Guide Me
                  </div>
                  <div className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider">
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
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border-0 ${
                        isActive
                          ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 shadow-sm'
                          : 'bg-transparent text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-[#181826] hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-zinc-500'}`} />
                      <span>{tab.label[language] || tab.label.en}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Bottom Status Card */}
            <div className="p-2.5 rounded-xl bg-purple-50/60 dark:bg-[#181826] border border-purple-100 dark:border-[#2d2d44] flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                GM
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  Active Tab Live
                </div>
                <div className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Overlay Ready
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content View */}
          <main className="flex-1 flex flex-col min-w-0 bg-[#fcfcfd] dark:bg-[#0f0f18] overflow-hidden">
            {/* Topbar */}
            <header className="h-14 px-6 bg-white dark:bg-[#13131f] border-b border-gray-200 dark:border-[#2d2d44] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-extrabold text-gray-900 dark:text-white m-0">
                  {TABS.find((t) => t.id === activeTab)?.label[language] || 'Dashboard'}
                </h2>
              </div>

              <div className="flex items-center gap-3">
                {/* Language Switcher */}
                <button
                  type="button"
                  onClick={() => onLanguageChange?.(isKhmer ? 'en' : 'km')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 dark:bg-[#181826] text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-[#2d2d44] hover:border-purple-500 cursor-pointer transition-colors"
                >
                  {isKhmer ? 'EN' : 'ខ្មែរ'}
                </button>

                {/* Theme Switcher */}
                <button
                  type="button"
                  onClick={() => onThemeChange?.(theme === 'dark' ? 'light' : 'dark')}
                  aria-label="Toggle theme"
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-[#181826] text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-[#2d2d44] hover:border-purple-500 cursor-pointer transition-colors"
                >
                  {theme === 'dark' ? <FiSun className="w-4 h-4 text-amber-400" /> : <FiMoon className="w-4 h-4" />}
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
                  className="px-3.5 py-1.5 rounded-xl font-bold text-xs text-white cursor-pointer flex items-center gap-1.5 border-0 shadow-sm transition-all hover:brightness-110"
                >
                  <FiPlus className="w-3.5 h-3.5 stroke-[2.5] text-white" />
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: isKhmer ? 'មេរៀនសរុប' : 'Total Guides', value: availableTutorials.length || '3', change: '+3 new' },
                      { label: isKhmer ? 'ជំហានសរុប' : 'Total Steps', value: '48', change: '+14%' },
                      { label: isKhmer ? 'ពេលវេលាសន្សំ' : 'Time Saved', value: '4.2 hrs', change: '89%' },
                      { label: isKhmer ? 'អត្រាជោគជ័យ' : 'Completion', value: '94%', change: '+5%' },
                    ].map((stat, i) => (
                      <div key={i} className="p-4 rounded-2xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-[#2d2d44] shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-500 dark:text-zinc-400">{stat.label}</span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                            {stat.change}
                          </span>
                        </div>
                        <div className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick Actions Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('guides')}
                      className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 flex items-center gap-3 text-left hover:border-purple-400 transition-all cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
                        <FiPlus className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">Create New Guide</div>
                        <div className="text-[10px] text-gray-500 dark:text-zinc-400">Build on-screen steps</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('ask-ai')}
                      className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 flex items-center gap-3 text-left hover:border-purple-400 transition-all cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <FiMessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">Ask AI Assistant</div>
                        <div className="text-[10px] text-gray-500 dark:text-zinc-400">Generate live workflows</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('community')}
                      className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 flex items-center gap-3 text-left hover:border-purple-400 transition-all cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0">
                        <FiCompass className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">Explore Templates</div>
                        <div className="text-[10px] text-gray-500 dark:text-zinc-400">Community library</div>
                      </div>
                    </button>
                  </div>

                  {/* Recent Walkthroughs Table */}
                  <div className="p-5 rounded-2xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-[#2d2d44] shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white m-0">
                          {isKhmer ? 'មេរៀនណែនាំពេញនិយម' : 'Popular Walkthroughs'}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 m-0 mt-0.5">
                          {isKhmer ? 'ចុច Run ដើម្បីចាប់ផ្ដើមការណែនាំលើទំព័រផ្ទាល់' : 'Click Run to launch the interactive overlay tutorial'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('guides')}
                        className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer border-0 bg-transparent"
                      >
                        {isKhmer ? 'មើលទាំងអស់' : 'View All'}
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
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
                              <td className="py-3 px-3 text-gray-500 dark:text-zinc-400 font-mono text-[11px]">
                                {tut.matchUrls?.[0]?.replace('*://', '')?.replace('/*', '') || 'Universal'}
                              </td>
                              <td className="py-3 px-3 text-gray-600 dark:text-zinc-300 font-semibold">
                                {tut.steps?.length || tut.totalSteps || 4} steps
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
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
                                  className="px-3.5 py-1 rounded-lg text-xs font-bold text-white cursor-pointer transition-all inline-flex items-center gap-1 border-0 shadow-sm hover:brightness-110"
                                >
                                  <FiPlay className="w-3 h-3 text-white fill-current" />
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
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="flex-1 w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-[#2d2d44]">
                      <FiSearch className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={isKhmer ? 'ស្វែងរកមេរៀន...' : 'Search guides...'}
                        className="bg-transparent border-0 outline-none text-xs w-full text-gray-900 dark:text-white"
                      />
                    </div>

                    {/* Filter category pills */}
                    <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                      {['all', 'tools', 'productivity', 'social'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setGuideCategory(cat)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer border-0 transition-all ${
                            guideCategory === cat
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'bg-white dark:bg-[#181826] text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-[#2d2d44]'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableTutorials.filter((t) => {
                      const name = typeof t.name === 'object' ? t.name.en + t.name.km : t.name;
                      return name.toLowerCase().includes(searchQuery.toLowerCase());
                    }).map((tut) => (
                      <div key={tut.id} className="p-5 rounded-2xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-[#2d2d44] shadow-sm flex flex-col justify-between hover:border-purple-400 transition-all">
                        <div>
                          <div className="flex items-center justify-between mb-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300">
                              {tut.steps?.length || tut.totalSteps || 4} Steps
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {tut.matchUrls?.[0]?.replace('*://', '')?.replace('/*', '') || 'All sites'}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white m-0 mb-1.5">
                            {typeof tut.name === 'object' ? tut.name[language] || tut.name.en : tut.name}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-zinc-400 m-0 leading-relaxed">
                            {typeof tut.description === 'object' ? tut.description[language] || tut.description.en : tut.description}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#202032] flex items-center justify-between">
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Verified</span>
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
                            className="px-3.5 py-1.5 rounded-xl font-bold text-xs text-white cursor-pointer transition-all inline-flex items-center gap-1.5 border-0 shadow-sm hover:brightness-110"
                          >
                            <FiPlay className="w-3.5 h-3.5 text-white fill-current" />
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
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white m-0">Recent Walkthrough Sessions</h3>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 m-0 mt-0.5">Logs of previously executed guided steps</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHistoryList([])}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 cursor-pointer border-0 flex items-center gap-1"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  </div>

                  <div className="divide-y divide-gray-100 dark:divide-[#202032]">
                    {historyList.map((item) => (
                      <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
                            <FiCheckCircle className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-gray-900 dark:text-white">{item.name}</div>
                            <div className="text-[10px] text-gray-400">{item.time} · {item.steps} steps</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('overview')}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-gray-100 dark:bg-[#202032] text-gray-700 dark:text-zinc-300 hover:bg-purple-600 hover:text-white transition-all cursor-pointer border-0"
                        >
                          Re-run
                        </button>
                      </div>
                    ))}
                    {historyList.length === 0 && (
                      <div className="py-8 text-center text-xs text-gray-400">No session history yet.</div>
                    )}
                  </div>
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
                          className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 hover:bg-purple-600 hover:text-white cursor-pointer transition-all"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>

                    {aiMessages.map((msg, i) => (
                      <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center shrink-0 mt-0.5">
                            <GuideMeLogo size={28} />
                          </div>
                        )}
                        <div
                          className={`max-w-[78%] px-4 py-3 rounded-2xl text-xs leading-relaxed ${
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
                        <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                          <GuideMeLogo size={28} />
                        </div>
                        <div className="px-4 py-2.5 rounded-2xl bg-purple-50 dark:bg-[#13131f] text-purple-600 dark:text-purple-400 text-xs font-medium animate-pulse">
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
                        className="flex-1 bg-transparent border-0 outline-none text-xs text-gray-900 dark:text-white"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs cursor-pointer border-0 transition-all flex items-center gap-1"
                      >
                        <FiSend className="w-3.5 h-3.5" />
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
                      <h3 className="text-base font-bold text-gray-900 dark:text-white m-0">Community Library</h3>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 m-0 mt-0.5">Discover public workflow templates</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { title: 'React Debugging Workflow', author: 'Sarah Chen', site: 'github.com', steps: 10, rating: 4.9 },
                      { title: 'Salesforce Lead Setup', author: 'Marcus J.', site: 'salesforce.com', steps: 8, rating: 4.7 },
                      { title: 'Notion Workspace Setup', author: 'Emily Park', site: 'notion.so', steps: 12, rating: 4.8 },
                      { title: 'Docker Container Deploy', author: 'Alex Rivera', site: 'docker.com', steps: 15, rating: 4.6 },
                      { title: 'Figma Design Tokens', author: 'Lisa Wang', site: 'figma.com', steps: 18, rating: 4.9 },
                      { title: 'Vercel Deployment Guide', author: 'Chris Lee', site: 'vercel.com', steps: 6, rating: 4.5 },
                    ].map((item, idx) => (
                      <div key={idx} className="p-4 rounded-2xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-[#2d2d44] shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{item.site}</span>
                            <span className="text-xs font-semibold text-amber-500 flex items-center gap-1">
                              <FiStar className="w-3.5 h-3.5 fill-current" />
                              {item.rating}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white m-0 mb-1">{item.title}</h4>
                          <p className="text-xs text-gray-500 dark:text-zinc-400 m-0">by {item.author}</p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#202032] flex items-center justify-between">
                          <span className="text-[11px] text-gray-400">{item.steps} steps</span>
                          <button
                            type="button"
                            onClick={() => onClose?.()}
                            className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-600 hover:text-white cursor-pointer border-0 transition-all"
                          >
                            Use Guide
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── PAYMENT TAB ── */}
              {activeTab === 'payment' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {[
                    { name: 'Starter', price: '$0', desc: 'Personal guides & walkthroughs', features: ['5 Active Guides', 'Standard Voice Engine', 'Community Access'] },
                    { name: 'Pro Creator', price: '$12', popular: true, desc: 'Advanced AI & unlimited guides', features: ['Unlimited Guides', 'Neural TTS Voices', 'Export HTML & Video', 'Priority Support'] },
                    { name: 'Team Enterprise', price: '$49', desc: 'Collaborative guide management', features: ['All Pro Features', 'Team Workspace', 'Custom Domain Branding', 'Role Permissions'] },
                  ].map((plan, i) => (
                    <div
                      key={i}
                      className={`p-6 rounded-3xl bg-white dark:bg-[#181826] border flex flex-col justify-between shadow-sm relative ${
                        plan.popular ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-gray-200 dark:border-[#2d2d44]'
                      }`}
                    >
                      {plan.popular && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-600 text-white shadow-sm">
                          MOST POPULAR
                        </span>
                      )}
                      <div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white">{plan.name}</div>
                        <div className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 mb-4">{plan.desc}</div>
                        <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-5">
                          {plan.price}<span className="text-xs font-normal text-gray-400">/mo</span>
                        </div>
                        <ul className="space-y-2 text-xs text-gray-600 dark:text-zinc-300 p-0 m-0 list-none">
                          {plan.features.map((feat, fi) => (
                            <li key={fi} className="flex items-center gap-2">
                              <FiCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button
                        type="button"
                        className={`w-full mt-6 py-2.5 rounded-xl font-bold text-xs cursor-pointer border-0 transition-all ${
                          plan.popular ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-100 dark:bg-[#202032] text-gray-800 dark:text-zinc-200 hover:bg-gray-200'
                        }`}
                      >
                        {plan.price === '$0' ? 'Current Plan' : 'Upgrade Plan'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ── SETTINGS TAB ── */}
              {activeTab === 'settings' && (
                <div className="max-w-2xl space-y-5">
                  <div className="p-5 rounded-2xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-[#2d2d44] shadow-sm space-y-4">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white m-0">General Preferences</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-gray-800 dark:text-zinc-200">Language / ភាសា</div>
                          <div className="text-[11px] text-gray-400">Select default interface language</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onLanguageChange?.(isKhmer ? 'en' : 'km')}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 cursor-pointer"
                        >
                          {isKhmer ? 'ភាសាខ្មែរ (Khmer)' : 'English'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-[#202032]">
                        <div>
                          <div className="text-xs font-semibold text-gray-800 dark:text-zinc-200">Theme / រូបរាង</div>
                          <div className="text-[11px] text-gray-400">Toggle light and obsidian dark mode</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onThemeChange?.(theme === 'dark' ? 'light' : 'dark')}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 cursor-pointer flex items-center gap-1.5"
                        >
                          {theme === 'dark' ? <FiSun className="w-3.5 h-3.5" /> : <FiMoon className="w-3.5 h-3.5" />}
                          <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-[#202032]">
                        <div>
                          <div className="text-xs font-semibold text-gray-800 dark:text-zinc-200">Voice Speaker</div>
                          <div className="text-[11px] text-gray-400">Select neural voice engine</div>
                        </div>
                        <select
                          value={speakerVoice}
                          onChange={(e) => setSpeakerVoice(e.target.value)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-[#202032] text-gray-800 dark:text-zinc-200 border border-gray-200 dark:border-[#2d2d44] outline-none"
                        >
                          <option value="default">Default</option>
                          <option value="samantha">Samantha</option>
                          <option value="daniel">Daniel</option>
                          <option value="karen">Karen</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── ABOUT TAB ── */}
              {activeTab === 'about' && (
                <div className="max-w-2xl space-y-4">
                  <div className="p-6 rounded-2xl bg-white dark:bg-[#181826] border border-gray-200 dark:border-[#2d2d44] shadow-sm text-center">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center mx-auto mb-3 shadow-md">
                      <GuideMeLogo size={64} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white m-0">
                      GuideMe Universal Tutorial Engine
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 m-0">
                      Version 2.1.0 · Manifest V3 · Draggable In-Page Overlay
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
