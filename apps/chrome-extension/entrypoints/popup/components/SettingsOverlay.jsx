import React, { useState, useEffect } from 'react';
import {
  FiClock,
  FiMic,
  FiInfo,
  FiSun,
  FiMoon,
  FiChevronDown,
  FiPhone,
  FiFileText,
  FiTrash2,
  FiExternalLink,
  FiUser,
  FiLogIn,
  FiLogOut,
  FiCpu,
} from 'react-icons/fi';
import { getUIString } from '@guideme/tutorial-ui';
import { SPEAKER_OPTIONS } from '../constants.js';

/** All supported languages with flags */
const LANGUAGES_FULL = [
  { code: 'km', label: { km: 'ភាសាខ្មែរ', en: 'Khmer' }, flag: '🇰🇭' },
  { code: 'en', label: { km: 'អង់គ្លេស (English)', en: 'English' }, flag: '🇬🇧' },
];

/** Translate Icon (Character + Letter A) */
function TranslateIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
    </svg>
  );
}

/**
 * RadioDot — Sharp radio circle indicator with neon glow in dark mode.
 */
function RadioDot({ active }) {
  if (active) {
    return (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="shrink-0">
        <circle cx="8" cy="8" r="7" stroke="#a855f7" strokeWidth="1.5" />
        <circle cx="8" cy="8" r="4" fill="#a855f7" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <circle cx="8" cy="8" r="7" stroke="#d1d5db" className="dark:stroke-[#4b4b66]" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * SectionIcon — Soft purple / neon glow container for icons.
 */
function SectionIcon({ children }) {
  return (
    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[#8b5cf6] bg-[#f5efff] dark:bg-[#a855f7]/20 dark:text-[#c084fc] transition-colors">
      {children}
    </div>
  );
}

/**
 * AccordionSection — Collapsible settings section.
 */
function AccordionSection({ icon, label, isOpen, onToggle, children }) {
  return (
    <div className="rounded-xl overflow-hidden border border-[#ede4ff] dark:border-[#2d2d44] bg-white dark:bg-[#181826] transition-all shrink-0">
      {/* Section header */}
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2.5 w-full px-3 py-2.5 border-0 bg-white dark:bg-[#181826] hover:bg-purple-50/40 dark:hover:bg-[#222236] cursor-pointer text-left transition-colors"
      >
        <SectionIcon>{icon}</SectionIcon>
        <span className="flex-1 text-[13px] font-semibold text-gray-900 dark:text-white">{label}</span>
        <FiChevronDown
          size={14}
          className="text-gray-400 dark:text-zinc-500 shrink-0 transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {/* Collapsible body */}
      {isOpen && (
        <div className="bg-[#fcfaff] dark:bg-[#1e1e2f] transition-colors">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * OptionRow — Single selectable/clickable row inside an accordion section.
 */
function OptionRow({ leftIcon, label, active, onClick, disabled, showRadio = true, rightIcon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 border-0 border-t border-[#ede4ff]/80 dark:border-[#2d2d44] cursor-pointer text-left transition-colors ${
        active
          ? 'bg-purple-50/60 dark:bg-[#a855f7]/18'
          : 'bg-transparent hover:bg-purple-50/60 dark:hover:bg-[#a855f7]/10'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {/* Left icon / emoji */}
      {leftIcon && (
        <span
          className="flex items-center justify-center shrink-0 text-gray-500 dark:text-zinc-400"
          style={{ width: 18, fontSize: 14, lineHeight: 1 }}
        >
          {leftIcon}
        </span>
      )}

      {/* Label */}
      <span
        className={`flex-1 text-[12.5px] font-medium truncate ${
          active ? 'text-[#8b5cf6] dark:text-[#c084fc] font-semibold' : 'text-gray-700 dark:text-zinc-200'
        }`}
      >
        {label}
      </span>

      {/* Radio indicator or optional right icon */}
      {showRadio && <RadioDot active={active} />}
      {rightIcon && <span className="text-gray-400 dark:text-zinc-500 shrink-0">{rightIcon}</span>}
    </button>
  );
}

/**
 * SettingsOverlay — Slide-over settings drawer with full bilingual (Khmer / English) support.
 */
export function SettingsOverlay({
  open,
  currentLanguage = 'km',
  onLanguageChange,
  theme,
  onThemeChange,
  currentSpeaker,
  onSpeakerChange,
  history,
  onLoadHistory,
  onClearHistory,
  onClose,
  onExtractUI,
  isChromeInternalUrl,
  isAuthenticated,
  userProfile,
  onOpenLogin,
  onLogout,
}) {
  const isKhmer = currentLanguage === 'km';
  // Exclusive accordion: only one section open at a time
  const [openSection, setOpenSection] = useState(null);
  const [aiProvider, setAiProvider] = useState('nvidia');
  const [nvidiaApiKeyInput, setNvidiaApiKeyInput] = useState('');
  const [nvidiaModelInput, setNvidiaModelInput] = useState('moonshotai/kimi-k3');
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('');
  const [isKeySaved, setIsKeySaved] = useState(false);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(
        [
          'guideme_ai_provider',
          'guideme_nvidia_api_key',
          'guideme_nvidia_model',
          'guideme_gemini_api_key',
        ],
        (res) => {
          if (res?.guideme_ai_provider) setAiProvider(res.guideme_ai_provider);
          if (res?.guideme_nvidia_api_key) setNvidiaApiKeyInput(res.guideme_nvidia_api_key);
          if (res?.guideme_nvidia_model) setNvidiaModelInput(res.guideme_nvidia_model);
          if (res?.guideme_gemini_api_key) setGeminiApiKeyInput(res.guideme_gemini_api_key);
        }
      );
    }
  }, []);

  const handleSaveAiSettings = () => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set(
        {
          guideme_ai_provider: aiProvider,
          guideme_nvidia_api_key: nvidiaApiKeyInput.trim(),
          guideme_nvidia_model: nvidiaModelInput.trim() || 'moonshotai/kimi-k3',
          guideme_gemini_api_key: geminiApiKeyInput.trim(),
        },
        () => {
          setIsKeySaved(true);
          setTimeout(() => setIsKeySaved(false), 2500);
        }
      );
    }
  };

  const toggle = (sectionKey) => {
    setOpenSection((prev) => (prev === sectionKey ? null : sectionKey));
  };

  const openLink = (url) => {
    chrome.tabs.create({ url });
    window.close();
  };

  return (
    <div
      className={`absolute inset-0 bg-white dark:bg-[#101018] text-gray-900 dark:text-zinc-100 z-50 flex flex-col rounded-2xl overflow-hidden transition-transform duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isKhmer ? 'font-kantumruy' : 'font-sans'
      } ${
        open ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
      }`}
    >
      {/* Settings header */}
      <div
        className="flex items-center gap-3 px-3.5 border-b border-gray-100 dark:border-[#2d2d44] shrink-0 bg-white dark:bg-[#181826]"
        style={{ height: 50, minHeight: 50 }}
      >
        {/* Back arrow */}
        <button
          type="button"
          onClick={onClose}
          aria-label={getUIString('close', currentLanguage)}
          className="w-[28px] h-[28px] rounded-lg flex items-center justify-center bg-transparent border-0 text-gray-500 dark:text-zinc-400 hover:bg-purple-50 dark:hover:bg-[#252538] hover:text-purple-600 dark:hover:text-[#a855f7] transition-colors cursor-pointer"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="font-semibold text-sm text-gray-900 dark:text-white">
          {getUIString('settings', currentLanguage)}
        </span>
      </div>

      {/* Scrollable accordion body with full height and comfortable padding */}
      <div className="flex-1 overflow-y-auto p-3 pb-8 flex flex-col gap-2 bg-white dark:bg-[#101018] overscroll-contain">

        {/* ── 0. Account ── */}
        <AccordionSection
          icon={<FiUser size={15} />}
          label={isKhmer ? 'គណនី' : 'Account'}
          isOpen={openSection === 'Account'}
          onToggle={() => toggle('Account')}
        >
          {isAuthenticated && userProfile ? (
            <div className="p-3.5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold text-sm shrink-0 border border-purple-200 dark:border-purple-800 overflow-hidden">
                  {userProfile.avatar ? (
                    <img src={userProfile.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (userProfile.name?.[0] || userProfile.email?.[0] || 'U').toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">
                    {userProfile.name || 'GuideMe User'}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-zinc-400 truncate">
                    {userProfile.email}
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 uppercase tracking-wider">
                  {userProfile.plan || 'Free'}
                </span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="w-full mt-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors border border-red-200/60 dark:border-red-900/40 cursor-pointer"
              >
                <FiLogOut size={13} />
                <span>{isKhmer ? 'ចាកចេញ' : 'Log Out'}</span>
              </button>
            </div>
          ) : (
            <div className="p-3.5 flex flex-col gap-2.5">
              <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed m-0">
                {isKhmer
                  ? 'ចូលគណនីដើម្បីធ្វើសមកាលកម្មមេរៀន និងទទួលបានមុខងារ AI កម្រិតខ្ពស់។'
                  : 'Sign in to sync your personalized guides and access full AI capabilities.'}
              </p>
              <button
                type="button"
                onClick={onOpenLogin}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-sm transition-all cursor-pointer border-0"
              >
                <FiLogIn size={14} />
                <span>{isKhmer ? 'ចូលគណនីតាមរយៈ Web' : 'Login with Web'}</span>
              </button>
            </div>
          )}
        </AccordionSection>

        {/* ── 1. Language ── */}
        <AccordionSection
          icon={<TranslateIcon className="w-3.5 h-3.5" />}
          label={getUIString('language', currentLanguage)}
          isOpen={openSection === 'Language'}
          onToggle={() => toggle('Language')}
        >
          {LANGUAGES_FULL.map((lang) => (
            <OptionRow
              key={lang.code}
              leftIcon={<span>{lang.flag}</span>}
              label={typeof lang.label === 'object' ? (lang.label[currentLanguage] || lang.label.en) : lang.label}
              active={currentLanguage === lang.code}
              showRadio={true}
              onClick={() => onLanguageChange(lang.code)}
            />
          ))}
        </AccordionSection>

        {/* ── 2. AI & DOM Intelligence ── */}
        <AccordionSection
          icon={<FiCpu size={15} />}
          label={getUIString('aiDomSettings', currentLanguage)}
          isOpen={openSection === 'AiDom'}
          onToggle={() => toggle('AiDom')}
        >
          <div className="p-3.5 flex flex-col gap-3 text-xs">
            <p className="text-gray-500 dark:text-zinc-400 leading-relaxed m-0">
              {getUIString('aiDomDescription', currentLanguage)}
            </p>

            {/* Provider Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-gray-800 dark:text-zinc-200">
                {getUIString('aiProvider', currentLanguage)}
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-gray-100 dark:bg-[#12121e] border border-gray-200/60 dark:border-[#2d2d44]">
                <button
                  type="button"
                  onClick={() => setAiProvider('nvidia')}
                  className={`py-1 px-2 rounded-md text-[11px] font-medium border-0 cursor-pointer transition-all ${
                    aiProvider === 'nvidia'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-transparent text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  NVIDIA NIM (Kimi-K3)
                </button>
                <button
                  type="button"
                  onClick={() => setAiProvider('gemini')}
                  className={`py-1 px-2 rounded-md text-[11px] font-medium border-0 cursor-pointer transition-all ${
                    aiProvider === 'gemini'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-transparent text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Google Gemini
                </button>
              </div>
            </div>

            {/* Active Mode Badge */}
            <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
              <span className="font-medium text-gray-700 dark:text-zinc-300">
                {isKhmer ? 'មុខងារសកម្ម' : 'Active Mode'}:
              </span>
              <span className="font-semibold text-purple-700 dark:text-purple-300">
                {aiProvider === 'nvidia'
                  ? (nvidiaApiKeyInput.trim() ? getUIString('aiActiveNvidia', currentLanguage) : getUIString('aiActiveBackend', currentLanguage))
                  : (geminiApiKeyInput.trim() ? getUIString('aiActiveGemini', currentLanguage) : getUIString('aiLocal', currentLanguage))}
              </span>
            </div>

            {/* NVIDIA Configuration */}
            {aiProvider === 'nvidia' && (
              <div className="flex flex-col gap-2.5">
                <div className="p-2 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100/60 dark:border-purple-900/30 text-[11px] text-purple-900 dark:text-purple-200">
                  {getUIString('nvidiaFreeNotice', currentLanguage)}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-gray-800 dark:text-zinc-200">
                    {getUIString('nvidiaApiKey', currentLanguage)}
                  </label>
                  <input
                    type="password"
                    value={nvidiaApiKeyInput}
                    onChange={(e) => setNvidiaApiKeyInput(e.target.value)}
                    placeholder={getUIString('nvidiaApiKeyPlaceholder', currentLanguage)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#38384f] bg-white dark:bg-[#101018] text-gray-900 dark:text-white outline-none focus:border-purple-500 text-xs box-border"
                  />
                  <span className="text-[10px] text-gray-500 dark:text-zinc-400">
                    {isKhmer
                      ? 'ទុកទទេដើម្បីប្រើ GuideMe Cloud Proxy ដោយស្វ័យប្រវត្តិ (Key រក្សាទុកលើ Server)'
                      : 'Leave empty to use GuideMe Cloud Proxy automatically (Key stored on Server)'}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-gray-800 dark:text-zinc-200">
                    {getUIString('nvidiaModel', currentLanguage)}
                  </label>
                  <input
                    type="text"
                    value={nvidiaModelInput}
                    onChange={(e) => setNvidiaModelInput(e.target.value)}
                    placeholder={getUIString('nvidiaModelPlaceholder', currentLanguage)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#38384f] bg-white dark:bg-[#101018] text-gray-900 dark:text-white outline-none focus:border-purple-500 text-xs box-border"
                  />
                </div>
              </div>
            )}

            {/* Gemini Configuration */}
            {aiProvider === 'gemini' && (
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-gray-800 dark:text-zinc-200">
                  {getUIString('geminiApiKey', currentLanguage)}
                </label>
                <input
                  type="password"
                  value={geminiApiKeyInput}
                  onChange={(e) => setGeminiApiKeyInput(e.target.value)}
                  placeholder={getUIString('geminiApiKeyPlaceholder', currentLanguage)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#38384f] bg-white dark:bg-[#101018] text-gray-900 dark:text-white outline-none focus:border-purple-500 text-xs box-border"
                />
              </div>
            )}

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSaveAiSettings}
              className="mt-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors border-0 cursor-pointer text-xs flex items-center justify-center gap-1.5"
            >
              {isKeySaved ? getUIString('keySaved', currentLanguage) : getUIString('saveKey', currentLanguage)}
            </button>

            {/* Hints */}
            <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-[#12121e] border border-gray-100 dark:border-[#2d2d44] text-[11px] text-gray-600 dark:text-zinc-400 flex flex-col gap-1">
              <div className="font-bold text-gray-800 dark:text-zinc-200">
                {isKhmer ? '💡 របៀបកំណត់ DOM targets តាមចិត្ត:' : '💡 How to define DOM targets:'}
              </div>
              <div>• <code>#id</code> / <code>.class</code> (ឧ. <code>#search-box</code>, <code>.btn-buy</code>)</div>
              <div>• {isKhmer ? 'លំដាប់ជំហាន:' : 'Chained steps:'} <code>#email, #password, #login-btn</code></div>
              <div>• {isKhmer ? 'ពាក្យបញ្ជា:' : 'Directives:'} <code>click #submit</code>, <code>type test in #input</code></div>
            </div>
          </div>
        </AccordionSection>

        {/* ── 2. Theme ── */}
        <AccordionSection
          icon={<FiSun size={15} />}
          label={getUIString('theme', currentLanguage)}
          isOpen={openSection === 'Theme'}
          onToggle={() => toggle('Theme')}
        >
          <OptionRow
            leftIcon={<FiSun size={14} />}
            label={getUIString('light', currentLanguage)}
            active={theme === 'light'}
            showRadio={true}
            onClick={() => onThemeChange('light')}
          />
          <OptionRow
            leftIcon={<FiMoon size={14} />}
            label={getUIString('dark', currentLanguage)}
            active={theme === 'dark'}
            showRadio={true}
            onClick={() => onThemeChange('dark')}
          />
        </AccordionSection>

        {/* ── 3. History ── */}
        <AccordionSection
          icon={<FiClock size={15} />}
          label={getUIString('history', currentLanguage)}
          isOpen={openSection === 'History'}
          onToggle={() => toggle('History')}
        >
          {history.length === 0 ? (
            <div className="px-3.5 py-3 border-t border-[#ede4ff]/80 dark:border-[#2d2d44]">
              <span className="text-xs text-gray-400 dark:text-zinc-500 italic">
                {getUIString('noHistory', currentLanguage)}
              </span>
            </div>
          ) : (
            <div className="flex flex-col">
              {history.map((item, i) => (
                <OptionRow
                  key={i}
                  leftIcon={<FiClock size={13} />}
                  label={item}
                  active={false}
                  showRadio={false}
                  onClick={() => {
                    onLoadHistory(item);
                    onClose();
                  }}
                />
              ))}

              {/* Clear all footer */}
              <div className="px-3.5 py-2.5 border-t border-[#ede4ff]/80 dark:border-[#2d2d44] bg-[#faf6ff] dark:bg-[#1b1b2a] flex items-center justify-between">
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="text-xs font-semibold text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 bg-transparent border-0 cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <FiTrash2 size={12} />
                  <span>{getUIString('clearAll', currentLanguage)}</span>
                </button>
                <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                  {history.length} {isKhmer ? 'ប្រវត្តិ' : (history.length === 1 ? 'item' : 'items')}
                </span>
              </div>
            </div>
          )}
        </AccordionSection>

        {/* ── 4. Speaker Assistant ── */}
        <AccordionSection
          icon={<FiMic size={15} />}
          label={getUIString('speakerAssistant', currentLanguage)}
          isOpen={openSection === 'Speaker'}
          onToggle={() => toggle('Speaker')}
        >
          {SPEAKER_OPTIONS.map((s) => (
            <OptionRow
              key={s.id}
              leftIcon={<FiMic size={13} />}
              label={typeof s.label === 'object' ? (s.label[currentLanguage] || s.label.en) : s.label}
              active={currentSpeaker === s.id}
              showRadio={true}
              onClick={() => onSpeakerChange(s.id)}
            />
          ))}
        </AccordionSection>

        {/* ── 5. Get Help ── */}
        <AccordionSection
          icon={<FiInfo size={15} />}
          label={getUIString('getHelp', currentLanguage)}
          isOpen={openSection === 'Help'}
          onToggle={() => toggle('Help')}
        >
          <OptionRow
            leftIcon={<FiPhone size={13} />}
            label={getUIString('contactUs', currentLanguage)}
            active={false}
            showRadio={false}
            rightIcon={<FiExternalLink size={12} />}
            onClick={() => openLink('https://guideme.app/contact')}
          />
          <OptionRow
            leftIcon={<FiFileText size={13} />}
            label={getUIString('survey', currentLanguage)}
            active={false}
            showRadio={false}
            rightIcon={<FiExternalLink size={12} />}
            onClick={() => openLink('https://guideme.app/survey')}
          />
        </AccordionSection>

      </div>
    </div>
  );
}
