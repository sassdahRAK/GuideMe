import React, { useState } from 'react';
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
} from 'react-icons/fi';
import { getUIString } from '@guideme/tutorial-ui';
import { SPEAKER_OPTIONS } from '../constants.js';

/** All supported languages with flags */
const LANGUAGES_FULL = [
  { code: 'km', label: 'Khmer',   flag: '🇰🇭' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
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
 * SettingsOverlay — Slide-over settings drawer.
 */
export function SettingsOverlay({
  open,
  currentLanguage,
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
}) {
  // Exclusive accordion: only one section open at a time
  const [openSection, setOpenSection] = useState(null);

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
        <span className="font-semibold text-sm text-gray-900 dark:text-white">Settings</span>
      </div>

      {/* Scrollable accordion body with full height and comfortable padding */}
      <div className="flex-1 overflow-y-auto p-3 pb-8 flex flex-col gap-2 bg-white dark:bg-[#101018] overscroll-contain">

        {/* ── 1. Language ── */}
        <AccordionSection
          icon={<TranslateIcon className="w-3.5 h-3.5" />}
          label="Language"
          isOpen={openSection === 'Language'}
          onToggle={() => toggle('Language')}
        >
          {LANGUAGES_FULL.map((lang) => (
            <OptionRow
              key={lang.code}
              leftIcon={<span>{lang.flag}</span>}
              label={lang.label}
              active={currentLanguage === lang.code}
              showRadio={true}
              onClick={() => onLanguageChange(lang.code)}
            />
          ))}
        </AccordionSection>

        {/* ── 2. Theme ── */}
        <AccordionSection
          icon={<FiSun size={15} />}
          label="Theme"
          isOpen={openSection === 'Theme'}
          onToggle={() => toggle('Theme')}
        >
          <OptionRow
            leftIcon={<FiSun size={14} />}
            label="Light"
            active={theme === 'light'}
            showRadio={true}
            onClick={() => onThemeChange('light')}
          />
          <OptionRow
            leftIcon={<FiMoon size={14} />}
            label="Dark"
            active={theme === 'dark'}
            showRadio={true}
            onClick={() => onThemeChange('dark')}
          />
        </AccordionSection>

        {/* ── 3. History ── */}
        <AccordionSection
          icon={<FiClock size={15} />}
          label="History"
          isOpen={openSection === 'History'}
          onToggle={() => toggle('History')}
        >
          {history.length === 0 ? (
            <div className="px-3.5 py-3 border-t border-[#ede4ff]/80 dark:border-[#2d2d44]">
              <span className="text-xs text-gray-400 dark:text-zinc-500 italic">
                {getUIString('noHistory', currentLanguage) || 'No history yet'}
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
                  <span>{getUIString('clearAll', currentLanguage) || 'Clear all'}</span>
                </button>
                <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                  {history.length} {history.length === 1 ? 'item' : 'items'}
                </span>
              </div>
            </div>
          )}
        </AccordionSection>

        {/* ── 4. Speaker Assistant ── */}
        <AccordionSection
          icon={<FiMic size={15} />}
          label="Speaker Assistant"
          isOpen={openSection === 'Speaker'}
          onToggle={() => toggle('Speaker')}
        >
          {SPEAKER_OPTIONS.map((s) => (
            <OptionRow
              key={s.id}
              leftIcon={<FiMic size={13} />}
              label={s.label}
              active={currentSpeaker === s.id}
              showRadio={true}
              onClick={() => onSpeakerChange(s.id)}
            />
          ))}
        </AccordionSection>

        {/* ── 5. Get Help ── */}
        <AccordionSection
          icon={<FiInfo size={15} />}
          label="Get Help"
          isOpen={openSection === 'Help'}
          onToggle={() => toggle('Help')}
        >
          <OptionRow
            leftIcon={<FiPhone size={13} />}
            label="Contact Us"
            active={false}
            showRadio={false}
            rightIcon={<FiExternalLink size={12} />}
            onClick={() => openLink('https://guideme.app/contact')}
          />
          <OptionRow
            leftIcon={<FiFileText size={13} />}
            label="Survey"
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
