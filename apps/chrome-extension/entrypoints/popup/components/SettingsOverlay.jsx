import React from 'react';
import {
  FiGlobe,
  FiSun,
  FiMoon,
  FiClock,
  FiVolume2,
  FiHelpCircle,
  FiX,
  FiExternalLink,
  FiTrash2,
  FiMic,
} from 'react-icons/fi';
import { GuideMeLogo, getUIString } from '@guideme/tutorial-ui';
import { SPEAKER_OPTIONS, LANGUAGES } from '../constants.js';

/**
 * SettingsCard — Reusable section card with icon + title.
 */
export function SettingsCard({ icon, title, children }) {
  return (
    <div className="bg-purple-50/70 dark:bg-[#252538] rounded-2xl p-3.5 shrink-0 transition-colors">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-[#3b2d6e] flex items-center justify-center shrink-0 text-purple-600 dark:text-purple-300">
          {icon}
        </div>
        <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100">{title}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * SettingsOverlay — Slide-over drawer for preferences, language, theme, and history.
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
  const openLink = (url) => {
    chrome.tabs.create({ url });
    window.close();
  };

  return (
    <div
      className={`absolute inset-0 bg-white dark:bg-[#1e1e2e] text-gray-900 dark:text-zinc-200 z-50 flex flex-col transition-transform duration-200 ease-out ${
        open ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#2a2a3c] shrink-0">
        <div className="flex items-center gap-2">
          <GuideMeLogo size={24} />
          <span className="font-semibold text-sm text-gray-900 dark:text-white">
            {getUIString('appName', currentLanguage)}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={getUIString('close', currentLanguage)}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2a2a3c] transition-colors cursor-pointer"
        >
          <FiX size={16} />
        </button>
      </div>

      {/* Extract CTA in settings */}
      <div className="px-4 pt-2.5 pb-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            onClose();
            onExtractUI();
          }}
          disabled={isChromeInternalUrl}
          className={`w-full font-semibold text-sm py-2.5 rounded-xl transition-all shadow-sm ${
            isChromeInternalUrl
              ? 'bg-purple-300 dark:bg-purple-900/50 text-white/70 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white cursor-pointer'
          }`}
          title={
            isChromeInternalUrl
              ? getUIString('extractUIDisabledTooltip', currentLanguage)
              : getUIString('extractUITooltip', currentLanguage)
          }
        >
          {getUIString('extractUI', currentLanguage)}
        </button>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-2.5">
        {/* Language */}
        <SettingsCard icon={<FiGlobe size={16} />} title={getUIString('language', currentLanguage)}>
          <div className="flex gap-1.5">
            {LANGUAGES.map((lang) => {
              const active = currentLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => onLanguageChange(lang.code)}
                  aria-pressed={active}
                  className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer border ${
                    active
                      ? 'bg-purple-600 border-purple-600 text-white'
                      : 'bg-white dark:bg-[#2a2a3c] border-gray-200 dark:border-[#3f3f5a] text-gray-700 dark:text-zinc-300 hover:border-purple-300 dark:hover:border-purple-500'
                  }`}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>
        </SettingsCard>

        {/* Theme */}
        <SettingsCard icon={<FiSun size={16} />} title={getUIString('theme', currentLanguage)}>
          <div className="flex gap-1.5">
            {[
              { key: 'light', label: getUIString('light', currentLanguage), Icon: FiSun },
              { key: 'dark', label: getUIString('dark', currentLanguage), Icon: FiMoon },
            ].map(({ key, label, Icon }) => {
              const active = theme === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onThemeChange(key)}
                  aria-pressed={active}
                  className={`flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer border ${
                    active
                      ? 'bg-purple-600 border-purple-600 text-white'
                      : 'bg-white dark:bg-[#2a2a3c] border-gray-200 dark:border-[#3f3f5a] text-gray-700 dark:text-zinc-300 hover:border-purple-300 dark:hover:border-purple-500'
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              );
            })}
          </div>
        </SettingsCard>

        {/* History */}
        <SettingsCard icon={<FiClock size={16} />} title={getUIString('history', currentLanguage)}>
          {history.length === 0 ? (
            <span className="text-xs text-gray-400 dark:text-zinc-500 italic">
              {getUIString('noHistory', currentLanguage)}
            </span>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {history.slice(0, 6).map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onLoadHistory(item)}
                    title={`Load: "${item}"`}
                    className="shrink-0 max-w-[110px] truncate px-3 py-1 rounded-full text-xs font-medium bg-white dark:bg-[#2a2a3c] border border-gray-200 dark:border-[#3f3f5a] text-gray-700 dark:text-zinc-300 hover:border-purple-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={onClearHistory}
                className="self-start flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border border-red-200 dark:border-red-900/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                title={getUIString('clearAll', currentLanguage)}
              >
                <FiTrash2 size={11} /> {getUIString('clearAll', currentLanguage)}
              </button>
            </div>
          )}
        </SettingsCard>

        {/* Speaker Assistant */}
        <SettingsCard icon={<FiVolume2 size={16} />} title={getUIString('speakerAssistant', currentLanguage)}>
          <div className="flex gap-1.5 flex-wrap">
            {SPEAKER_OPTIONS.map((s) => {
              const active = currentSpeaker === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSpeakerChange(s.id)}
                  aria-pressed={active}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                    active
                      ? 'bg-purple-600 border-purple-600 text-white'
                      : 'bg-white dark:bg-[#2a2a3c] border-gray-200 dark:border-[#3f3f5a] text-gray-700 dark:text-zinc-300 hover:border-purple-300 dark:hover:border-purple-500'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </SettingsCard>

        {/* Get Help */}
        <SettingsCard icon={<FiHelpCircle size={16} />} title={getUIString('getHelp', currentLanguage)}>
          <div className="flex gap-2">
            {['contactUs', 'survey'].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  openLink(key === 'contactUs' ? 'https://guideme.app/contact' : 'https://guideme.app/survey')
                }
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-[#2a2a3c] border border-gray-200 dark:border-[#3f3f5a] text-gray-700 dark:text-zinc-300 hover:border-purple-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
              >
                <FiExternalLink size={11} /> {getUIString(key, currentLanguage)}
              </button>
            ))}
          </div>
        </SettingsCard>
      </div>

      {/* Bottom prompt preview */}
      <div className="p-3 border-t border-gray-100 dark:border-[#2a2a3c] shrink-0">
        <div className="flex items-center gap-2.5 bg-gray-50 dark:bg-[#2a2a3c] border border-gray-200 dark:border-[#3f3f5a] rounded-xl px-3.5 py-2.5">
          <span className="flex-1 text-sm text-gray-400 dark:text-zinc-500">
            {getUIString('typePrompt', currentLanguage)}
          </span>
          <FiMic size={16} className="text-gray-400 dark:text-zinc-500" />
        </div>
      </div>
    </div>
  );
}
