import React, { useState, useEffect, useCallback } from 'react';
import { GuideMeLogo, getUIString } from '@guideme/tutorial-ui';
import { ExtensionMessageAction } from '@guideme/core-types';
import { TUTORIAL_CATALOG } from '../../src/catalog.js';

// ── Icons (inline SVG to avoid extra dependencies) ──
const Icon = {
  Grid: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  Book: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  Clock: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Message: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Users: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Credit: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  Settings: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Info: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  Play: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  Plus: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Sun: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  Moon: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  Check: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Star: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Search: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Trash: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Zap: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Compass: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>,
  ExternalLink: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  X: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  ChevronRight: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  TrendUp: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
};

// ── Navigation Items ──
const NAV_ITEMS = [
  { id: 'overview', label: { en: 'Overview', km: 'ទិដ្ឋភាពទូទៅ' }, icon: Icon.Grid },
  { id: 'guides', label: { en: 'Guides', km: 'មេរៀន' }, icon: Icon.Book },
  { id: 'history', label: { en: 'History', km: 'ប្រវត្តិ' }, icon: Icon.Clock },
  { id: 'community', label: { en: 'Community', km: 'សហគមន៍' }, icon: Icon.Users },
  { id: 'settings', label: { en: 'Settings', km: 'ការកំណត់' }, icon: Icon.Settings },
  { id: 'about', label: { en: 'About', km: 'អំពីយើង' }, icon: Icon.Info },
];

// ── Stat Card Data ──
const STATS = (lang, tutorialCount) => [
  { label: lang === 'km' ? 'មេរៀនសរុប' : 'Total Guides', value: String(tutorialCount || 3), change: '+3 new', icon: Icon.Book, color: 'purple' },
  { label: lang === 'km' ? 'ជំហានសរុប' : 'Total Steps', value: '48', change: '+14%', icon: Icon.Zap, color: 'blue' },
  { label: lang === 'km' ? 'ពេលវេលាសន្សំ' : 'Time Saved', value: '4.2 hrs', change: '89%', icon: Icon.Clock, color: 'green' },
  { label: lang === 'km' ? 'អត្រាជោគជ័យ' : 'Completion', value: '94%', change: '+5%', icon: Icon.TrendUp, color: 'amber' },
];

// ── Quick Actions ──
const QUICK_ACTIONS = (lang) => [
  { title: lang === 'km' ? 'បង្កើតមេរៀនថ្មី' : 'Create New Guide', desc: lang === 'km' ? 'បង្កើតជំហានណែនាំលើទំព័រ' : 'Build on-screen steps', icon: Icon.Plus, color: 'purple', action: 'guides' },
  { title: lang === 'km' ? 'សួរ AI' : 'Ask AI Assistant', desc: lang === 'km' ? 'បង្កើតការណែនាំស្វ័យប្រវត្តិ' : 'Generate live workflows', icon: Icon.Message, color: 'indigo', action: 'ask-ai' },
  { title: lang === 'km' ? 'រកមើលពុម្ព' : 'Explore Templates', desc: lang === 'km' ? 'បណ្ណាល័យសហគមន៍' : 'Community library', icon: Icon.Compass, color: 'violet', action: 'community' },
];

// ── History Data ──
const HISTORY = [
  { id: 'h1', name: 'Google Docs Permission Sharing', time: '10 mins ago', steps: '4/4', status: 'Completed' },
  { id: 'h2', name: 'Facebook Post Creation & Privacy', time: '2 hours ago', steps: '5/5', status: 'Completed' },
  { id: 'h3', name: 'Spreadsheet Auto-Calculation', time: 'Yesterday', steps: '4/4', status: 'Completed' },
];

// ── Community Templates ──
const COMMUNITY = [
  { title: 'React Debugging Workflow', author: 'Sarah Chen', site: 'github.com', steps: 10, rating: 4.9 },
  { title: 'Salesforce Lead Setup', author: 'Marcus J.', site: 'salesforce.com', steps: 8, rating: 4.7 },
  { title: 'Notion Workspace Setup', author: 'Emily Park', site: 'notion.so', steps: 12, rating: 4.8 },
  { title: 'Docker Container Deploy', author: 'Alex Rivera', site: 'docker.com', steps: 15, rating: 4.6 },
  { title: 'Figma Design Tokens', author: 'Lisa Wang', site: 'figma.com', steps: 18, rating: 4.9 },
  { title: 'Vercel Deployment Guide', author: 'Chris Lee', site: 'vercel.com', steps: 6, rating: 4.5 },
];

/**
 * DashboardStandalone — Production dashboard UI rendered inside a
 * chrome.windows.create() popup window.
 */
export function DashboardStandalone() {
  const [theme, setTheme] = useState('light');
  const [language, setLanguage] = useState('km');
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [runStatus, setRunStatus] = useState({}); // { tutorialId: 'running' | 'success' | 'error' }

  const isKhmer = language === 'km';

  // ── Load preferences ──
  useEffect(() => {
    try {
      chrome.storage?.local?.get(['guideme_theme', 'guideme_lang'], (result) => {
        if (chrome.runtime?.lastError) return;
        if (result?.guideme_theme) setTheme(result.guideme_theme);
        if (result?.guideme_lang) setLanguage(result.guideme_lang);
      });

      const listener = (changes, areaName) => {
        if (areaName !== 'local') return;
        if (changes.guideme_theme) setTheme(changes.guideme_theme.newValue);
        if (changes.guideme_lang) setLanguage(changes.guideme_lang.newValue);
      };
      chrome.storage?.onChanged?.addListener(listener);
      return () => chrome.storage?.onChanged?.removeListener(listener);
    } catch { /* storage unavailable */ }
  }, []);

  // ── Sync dark class ──
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const handleThemeChange = useCallback((newTheme) => {
    setTheme(newTheme);
    try { chrome.storage?.local?.set({ guideme_theme: newTheme }); } catch { }
  }, []);

  const handleLanguageChange = useCallback((newLang) => {
    setLanguage(newLang);
    try { chrome.storage?.local?.set({ guideme_lang: newLang }); } catch { }
  }, []);

  // ── Run Tutorial — communicates with background.js → content script ──
  const handleRunTutorial = useCallback(async (tutorial) => {
    const tutId = tutorial.id;
    setRunStatus(prev => ({ ...prev, [tutId]: 'running' }));

    try {
      // 1. Find the target tab — either the tab that matches the tutorial's URL pattern,
      //    or fall back to the active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs?.[0];

      if (!activeTab?.id) {
        console.error('[GuideMe Dashboard] No active tab found');
        setRunStatus(prev => ({ ...prev, [tutId]: 'error' }));
        setTimeout(() => setRunStatus(prev => { const n = { ...prev }; delete n[tutId]; return n; }), 2000);
        return;
      }

      // 2. Ensure content script is injected on the active tab
      try {
        await chrome.scripting?.executeScript({
          target: { tabId: activeTab.id },
          files: ['content-scripts/content.js'],
        });
      } catch {
        // Content script may already be injected — that's fine
      }

      // 3. Send START_TUTORIAL to the content script via background
      //    The background forwards it to the active tab
      chrome.runtime.sendMessage({
        action: 'DASHBOARD_START_TUTORIAL',
        payload: {
          tutorialId: tutId,
          targetTabId: activeTab.id,
        },
      }, (res) => {
        if (chrome.runtime?.lastError) {
          console.warn('[GuideMe Dashboard] Failed to start tutorial:', chrome.runtime.lastError.message);
          setRunStatus(prev => ({ ...prev, [tutId]: 'error' }));
        } else {
          setRunStatus(prev => ({ ...prev, [tutId]: 'success' }));
        }
        setTimeout(() => setRunStatus(prev => { const n = { ...prev }; delete n[tutId]; return n; }), 2000);
      });
    } catch (err) {
      console.error('[GuideMe Dashboard] handleRunTutorial error:', err);
      setRunStatus(prev => ({ ...prev, [tutId]: 'error' }));
      setTimeout(() => setRunStatus(prev => { const n = { ...prev }; delete n[tutId]; return n; }), 2000);
    }
  }, []);

  // ── Filter tutorials by search ──
  const filteredTutorials = TUTORIAL_CATALOG.filter((t) => {
    const name = typeof t.name === 'object' ? (t.name[language] || t.name.en || '') : (t.name || '');
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${isKhmer ? 'font-kantumruy' : 'font-sans'}`} style={{ background: theme === 'dark' ? '#0f0f18' : '#f8f9fc' }}>
      {/* ── Left Sidebar ── */}
      <aside className="w-56 shrink-0 flex flex-col" style={{ background: theme === 'dark' ? '#13131f' : '#ffffff', borderRight: `1px solid ${theme === 'dark' ? '#2d2d44' : '#e5e7eb'}` }}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center" style={{ background: '#1d1e22' }}>
            <GuideMeLogo size={28} />
          </div>
          <div>
            <div className="text-sm font-extrabold leading-tight" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>GuideMe</div>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9333ea' }}>Dashboard</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0"
                style={{
                  background: isActive ? (theme === 'dark' ? 'rgba(147,51,234,0.15)' : 'rgba(147,51,234,0.08)') : 'transparent',
                  color: isActive ? (theme === 'dark' ? '#c084fc' : '#7c3aed') : (theme === 'dark' ? '#a1a1aa' : '#6b7280'),
                }}
              >
                <Icon className="w-4 h-4" style={{ color: isActive ? (theme === 'dark' ? '#a855f7' : '#9333ea') : (theme === 'dark' ? '#52525b' : '#9ca3af') }} />
                <span>{item.label[language] || item.label.en}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Status */}
        <div className="p-3 mx-3 mb-3 rounded-xl flex items-center gap-2.5" style={{ background: theme === 'dark' ? '#181826' : '#f3f4f6', border: `1px solid ${theme === 'dark' ? '#2d2d44' : '#e5e7eb'}` }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: 'linear-gradient(135deg, #9333ea, #6366f1)' }}>GM</div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold truncate" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>Active Tab Live</div>
            <div className="text-[10px] font-semibold flex items-center gap-1" style={{ color: '#22c55e' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
              Overlay Ready
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 px-6 flex items-center justify-between shrink-0" style={{ background: theme === 'dark' ? '#13131f' : '#ffffff', borderBottom: `1px solid ${theme === 'dark' ? '#2d2d44' : '#e5e7eb'}` }}>
          <h2 className="text-base font-extrabold m-0" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>
            {NAV_ITEMS.find(t => t.id === activeTab)?.[language] || NAV_ITEMS.find(t => t.id === activeTab)?.label?.en || 'Dashboard'}
          </h2>
          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <button
              onClick={() => handleLanguageChange(isKhmer ? 'en' : 'km')}
              className="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors"
              style={{ background: theme === 'dark' ? '#181826' : '#f3f4f6', color: theme === 'dark' ? '#d4d4d8' : '#374151', border: `1px solid ${theme === 'dark' ? '#2d2d44' : '#e5e7eb'}` }}
            >
              {isKhmer ? 'EN' : 'ខ្មែរ'}
            </button>
            {/* Theme Toggle */}
            <button
              onClick={() => handleThemeChange(theme === 'dark' ? 'light' : 'dark')}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              style={{ background: theme === 'dark' ? '#181826' : '#f3f4f6', color: theme === 'dark' ? '#d4d4d8' : '#374151', border: `1px solid ${theme === 'dark' ? '#2d2d44' : '#e5e7eb'}` }}
              title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
            >
              {theme === 'dark' ? <Icon.Sun className="w-4 h-4" style={{ color: '#fbbf24' }} /> : <Icon.Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6" style={{ background: theme === 'dark' ? '#0f0f18' : '#f8f9fc' }}>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {STATS(language, TUTORIAL_CATALOG.length).map((stat, i) => {
                  const Icon = stat.icon;
                  const colorMap = {
                    purple: { bg: theme === 'dark' ? 'rgba(147,51,234,0.1)' : '#f3e8ff', icon: '#9333ea' },
                    blue: { bg: theme === 'dark' ? 'rgba(59,130,246,0.1)' : '#dbeafe', icon: '#3b82f6' },
                    green: { bg: theme === 'dark' ? 'rgba(34,197,94,0.1)' : '#dcfce7', icon: '#22c55e' },
                    amber: { bg: theme === 'dark' ? 'rgba(245,158,11,0.1)' : '#fef3c7', icon: '#f59e0b' },
                  };
                  const c = colorMap[stat.color] || colorMap.purple;
                  return (
                    <div key={i} className="p-4 rounded-2xl" style={{ background: theme === 'dark' ? '#181826' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#2d2d44' : '#e5e7eb'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#a1a1aa' : '#6b7280' }}>{stat.label}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: c.bg, color: c.icon }}>{stat.change}</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: c.bg }}>
                          <Icon className="w-4.5 h-4.5" style={{ color: c.icon }} />
                        </div>
                        <span className="text-2xl font-extrabold tracking-tight" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>{stat.value}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {QUICK_ACTIONS(language).map((qa, i) => {
                  const Icon = qa.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => setActiveTab(qa.action)}
                      className="p-4 rounded-xl flex items-center gap-3 text-left cursor-pointer transition-all hover:scale-[1.02]"
                      style={{ background: theme === 'dark' ? '#181826' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#2d2d44' : '#e5e7eb'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${qa.color === 'purple' ? '#9333ea' : qa.color === 'indigo' ? '#6366f1' : '#8b5cf6'}, ${qa.color === 'purple' ? '#7c3aed' : qa.color === 'indigo' ? '#4f46e5' : '#7c3aed'})` }}>
                        <Icon className="w-5 h-5" style={{ color: '#ffffff' }} />
                      </div>
                      <div>
                        <div className="text-xs font-bold" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>{qa.title}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: theme === 'dark' ? '#71717a' : '#6b7280' }}>{qa.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Popular Guides Table */}
              <div className="rounded-2xl p-5 space-y-4" style={{ background: theme === 'dark' ? '#181826' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#2d2d44' : '#e5e7eb'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold m-0" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>
                      {isKhmer ? 'មេរៀនណែនាំពេញនិយម' : 'Popular Walkthroughs'}
                    </h3>
                    <p className="text-xs m-0 mt-0.5" style={{ color: theme === 'dark' ? '#71717a' : '#6b7280' }}>
                      {isKhmer ? 'ចុច Run ដើម្បីចាប់ផ្ដើមការណែនាំលើទំព័រផ្ទាល់' : 'Click Run to launch the interactive overlay tutorial'}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('guides')}
                    className="text-xs font-bold cursor-pointer border-0 bg-transparent"
                    style={{ color: '#9333ea' }}
                  >
                    {isKhmer ? 'មើលទាំងអស់' : 'View All'}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${theme === 'dark' ? '#202032' : '#f3f4f6'}` }}>
                        <th className="py-2.5 px-3 font-semibold" style={{ color: theme === 'dark' ? '#52525b' : '#9ca3af' }}>{isKhmer ? 'ឈ្មោះមេរៀន' : 'Guide Name'}</th>
                        <th className="py-2.5 px-3 font-semibold" style={{ color: theme === 'dark' ? '#52525b' : '#9ca3af' }}>{isKhmer ? 'ទំព័រគោលដៅ' : 'Target Site'}</th>
                        <th className="py-2.5 px-3 font-semibold" style={{ color: theme === 'dark' ? '#52525b' : '#9ca3af' }}>{isKhmer ? 'ចំនួនជំហាន' : 'Steps'}</th>
                        <th className="py-2.5 px-3 font-semibold" style={{ color: theme === 'dark' ? '#52525b' : '#9ca3af' }}>{isKhmer ? 'ស្ថានភាព' : 'Status'}</th>
                        <th className="py-2.5 px-3 text-right font-semibold" style={{ color: theme === 'dark' ? '#52525b' : '#9ca3af' }}>{isKhmer ? 'សកម្មភាព' : 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {TUTORIAL_CATALOG.map((tut) => {
                        const status = runStatus[tut.id];
                        return (
                          <tr key={tut.id} className="transition-colors" style={{ borderBottom: `1px solid ${theme === 'dark' ? '#1a1a28' : '#f9fafb'}` }}>
                            <td className="py-3 px-3 font-bold" style={{ color: theme === 'dark' ? '#f4f4f5' : '#111827' }}>
                              {typeof tut.name === 'object' ? (tut.name[language] || tut.name.en) : tut.name}
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px]" style={{ color: theme === 'dark' ? '#71717a' : '#6b7280' }}>
                              {tut.matchUrls?.[0]?.replace('*://', '')?.replace('/*', '') || 'Universal'}
                            </td>
                            <td className="py-3 px-3 font-semibold" style={{ color: theme === 'dark' ? '#d4d4d8' : '#374151' }}>
                              {tut.steps?.length || tut.totalSteps || 4} steps
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: theme === 'dark' ? 'rgba(34,197,94,0.15)' : '#dcfce7', color: '#22c55e', border: `1px solid ${theme === 'dark' ? 'rgba(34,197,94,0.3)' : '#bbf7d0'}` }}>
                                Active
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => handleRunTutorial(tut)}
                                disabled={status === 'running'}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white cursor-pointer transition-all inline-flex items-center gap-1.5 border-0"
                                style={{
                                  background: status === 'success' ? '#22c55e' : status === 'error' ? '#ef4444' : '#9333ea',
                                  opacity: status === 'running' ? 0.7 : 1,
                                  boxShadow: '0 2px 8px rgba(147,51,234,0.35)',
                                }}
                              >
                                {status === 'running' ? (
                                  <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Running...</>
                                ) : status === 'success' ? (
                                  <><Icon.Check className="w-3 h-3" /> Started!</>
                                ) : status === 'error' ? (
                                  <><Icon.X className="w-3 h-3" /> Failed</>
                                ) : (
                                  <><Icon.Play className="w-3 h-3" /> Run</>
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── GUIDES TAB ── */}
          {activeTab === 'guides' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: theme === 'dark' ? '#181826' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#2d2d44' : '#e5e7eb'}` }}>
                <Icon.Search className="w-4 h-4" style={{ color: '#9ca3af' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isKhmer ? 'ស្វែងរកមេរៀន...' : 'Search guides...'}
                  className="flex-1 bg-transparent border-0 outline-none text-xs"
                  style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTutorials.map((tut) => (
                  <div key={tut.id} className="p-5 rounded-2xl flex flex-col justify-between transition-all hover:scale-[1.02]" style={{ background: theme === 'dark' ? '#181826' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#2d2d44' : '#e5e7eb'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: theme === 'dark' ? 'rgba(147,51,234,0.15)' : '#f3e8ff', color: '#9333ea' }}>
                          {tut.steps?.length || tut.totalSteps || 4} Steps
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: '#9ca3af' }}>
                          {tut.matchUrls?.[0]?.replace('*://', '')?.replace('/*', '') || 'All sites'}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold m-0 mb-1.5" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>
                        {typeof tut.name === 'object' ? (tut.name[language] || tut.name.en) : tut.name}
                      </h4>
                      <p className="text-xs m-0 leading-relaxed" style={{ color: theme === 'dark' ? '#71717a' : '#6b7280' }}>
                        {typeof tut.description === 'object' ? (tut.description[language] || tut.description.en) : tut.description}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: `1px solid ${theme === 'dark' ? '#202032' : '#f3f4f6'}` }}>
                      <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>Verified</span>
                      <button
                        onClick={() => handleRunTutorial(tut)}
                        className="px-3.5 py-1.5 rounded-xl font-bold text-xs text-white cursor-pointer transition-all inline-flex items-center gap-1.5 border-0"
                        style={{ background: '#9333ea', boxShadow: '0 2px 8px rgba(147,51,234,0.35)' }}
                      >
                        <Icon.Play className="w-3.5 h-3.5" />
                        {isKhmer ? 'ចាប់ផ្ដើម' : 'Start Guide'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {activeTab === 'history' && (
            <div className="rounded-2xl p-5 space-y-4" style={{ background: theme === 'dark' ? '#181826' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#2d2d44' : '#e5e7eb'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold m-0" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>Recent Sessions</h3>
                <button className="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border-0 flex items-center gap-1" style={{ background: theme === 'dark' ? 'rgba(239,68,68,0.1)' : '#fef2f2', color: '#ef4444' }}>
                  <Icon.Trash className="w-3.5 h-3.5" /> Clear
                </button>
              </div>
              <div className="divide-y" style={{ borderColor: theme === 'dark' ? '#202032' : '#f3f4f6' }}>
                {HISTORY.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3" style={{ borderBottom: `1px solid ${theme === 'dark' ? '#202032' : '#f3f4f6'}` }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: theme === 'dark' ? 'rgba(147,51,234,0.15)' : '#f3e8ff', color: '#9333ea' }}>
                        <Icon.Check className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>{item.name}</div>
                        <div className="text-[10px]" style={{ color: '#9ca3af' }}>{item.time} · {item.steps} steps</div>
                      </div>
                    </div>
                    <button className="px-3 py-1 rounded-lg text-xs font-bold cursor-pointer border-0" style={{ background: theme === 'dark' ? '#202032' : '#f3f4f6', color: theme === 'dark' ? '#d4d4d8' : '#374151' }}>
                      Re-run
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── COMMUNITY TAB ── */}
          {activeTab === 'community' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {COMMUNITY.map((item, idx) => (
                <div key={idx} className="p-4 rounded-2xl flex flex-col justify-between" style={{ background: theme === 'dark' ? '#181826' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#2d2d44' : '#e5e7eb'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold" style={{ color: '#9333ea' }}>{item.site}</span>
                      <span className="text-xs font-semibold flex items-center gap-1" style={{ color: '#f59e0b' }}>
                        <Icon.Star className="w-3.5 h-3.5" /> {item.rating}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold m-0 mb-1" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>{item.title}</h4>
                    <p className="text-xs m-0" style={{ color: '#9ca3af' }}>by {item.author}</p>
                  </div>
                  <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: `1px solid ${theme === 'dark' ? '#202032' : '#f3f4f6'}` }}>
                    <span className="text-[11px]" style={{ color: '#9ca3af' }}>{item.steps} steps</span>
                    <button className="px-3 py-1 rounded-lg text-xs font-bold cursor-pointer border-0" style={{ background: theme === 'dark' ? 'rgba(147,51,234,0.1)' : '#f3e8ff', color: '#9333ea' }}>
                      Use Guide
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── SETTINGS TAB ── */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl space-y-5">
              <div className="p-5 rounded-2xl space-y-4" style={{ background: theme === 'dark' ? '#181826' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#2d2d44' : '#e5e7eb'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <h4 className="text-sm font-bold m-0" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>General Preferences</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#e4e4e7' : '#1f2937' }}>Language / ភាសា</div>
                      <div className="text-[11px]" style={{ color: '#9ca3af' }}>Select default interface language</div>
                    </div>
                    <button
                      onClick={() => handleLanguageChange(isKhmer ? 'en' : 'km')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                      style={{ background: theme === 'dark' ? 'rgba(147,51,234,0.1)' : '#f3e8ff', color: '#9333ea', border: `1px solid ${theme === 'dark' ? 'rgba(147,51,234,0.3)' : '#e9d5ff'}` }}
                    >
                      {isKhmer ? 'ភាសាខ្មែរ (Khmer)' : 'English'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${theme === 'dark' ? '#202032' : '#f3f4f6'}` }}>
                    <div>
                      <div className="text-xs font-semibold" style={{ color: theme === 'dark' ? '#e4e4e7' : '#1f2937' }}>Theme / រូបរាង</div>
                      <div className="text-[11px]" style={{ color: '#9ca3af' }}>Toggle light and dark mode</div>
                    </div>
                    <button
                      onClick={() => handleThemeChange(theme === 'dark' ? 'light' : 'dark')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                      style={{ background: theme === 'dark' ? 'rgba(147,51,234,0.1)' : '#f3e8ff', color: '#9333ea', border: `1px solid ${theme === 'dark' ? 'rgba(147,51,234,0.3)' : '#e9d5ff'}` }}
                    >
                      {theme === 'dark' ? <Icon.Sun className="w-3.5 h-3.5" /> : <Icon.Moon className="w-3.5 h-3.5" />}
                      {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ABOUT TAB ── */}
          {activeTab === 'about' && (
            <div className="max-w-2xl">
              <div className="p-6 rounded-2xl text-center" style={{ background: theme === 'dark' ? '#181826' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#2d2d44' : '#e5e7eb'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center mx-auto mb-3" style={{ background: '#1d1e22', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                  <GuideMeLogo size={56} />
                </div>
                <h3 className="text-lg font-bold m-0" style={{ color: theme === 'dark' ? '#ffffff' : '#111827' }}>GuideMe Universal Tutorial Engine</h3>
                <p className="text-xs mt-1 m-0" style={{ color: '#9ca3af' }}>Version 2.1.0 · Manifest V3 · Standalone Dashboard</p>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
