import React, { useState, useRef, useEffect } from 'react';
import { FiSettings, FiCheck, FiSun, FiMoon, FiLogIn, FiUser } from 'react-icons/fi';
import { GuideMeLogo, getUIString } from '@guideme/tutorial-ui';

/** All supported languages with flag emojis. */
const HEADER_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'km', label: 'Khmer',   flag: '🇰🇭' },
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
 * PopupHeader — Top bar with sharp dark theme support.
 */
export function PopupHeader({
  currentLanguage,
  onLanguageChange,
  theme,
  onThemeChange,
  onOpenSettings,
  isAuthenticated,
  userProfile,
  onOpenLogin,
}) {
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const langRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showLangDropdown) return;
    const handler = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setShowLangDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLangDropdown]);

  const handleSelectLang = (code) => {
    onLanguageChange(code);
    setShowLangDropdown(false);
  };

  return (
    <div
      className="flex items-center px-4 border-b border-gray-100 dark:border-[#2d2d44] bg-white dark:bg-[#181826] shrink-0 transition-colors"
      style={{ height: 52, minHeight: 52 }}
    >
      {/* Brand logo + name */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
          <GuideMeLogo size={28} />
        </div>
        <span className="font-semibold text-sm text-gray-900 dark:text-white tracking-tight">
          Guide Me
        </span>
      </div>

      {/* Center Spacer */}
      <div className="flex-1" />

      {/* Right controls */}
      <div className="flex items-center gap-1.5">
        {/* Auth status / Login button */}
        {isAuthenticated ? (
          <button
            type="button"
            onClick={onOpenSettings}
            title={userProfile?.name ? `${userProfile.name} (${userProfile.email})` : 'Account Profile'}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-50 dark:bg-[#252538] text-purple-600 dark:text-[#c084fc] hover:bg-purple-100 dark:hover:bg-[#2d2d44] transition-colors border border-purple-200/50 dark:border-purple-800/50 cursor-pointer"
          >
            <div className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[9px] font-bold">
              {(userProfile?.name?.[0] || userProfile?.email?.[0] || 'U').toUpperCase()}
            </div>
            <span className="text-[11px] font-semibold max-w-[60px] truncate hidden sm:inline">
              {userProfile?.name?.split(' ')[0] || 'User'}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenLogin}
            title={currentLanguage === 'km' ? 'ចូលគណនីតាមរយៈ Web' : 'Login with Web'}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold shadow-xs transition-colors cursor-pointer border-0"
          >
            <FiLogIn size={12} />
            <span>{currentLanguage === 'km' ? 'ចូល' : 'Login'}</span>
          </button>
        )}

        {/* Language dropdown */}
        <div ref={langRef} className="relative">
          <button
            type="button"
            id="translate-btn"
            onClick={() => setShowLangDropdown((v) => !v)}
            title={getUIString('language', currentLanguage)}
            aria-label={getUIString('selectLanguage', currentLanguage)}
            aria-expanded={showLangDropdown}
            className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center border-0 cursor-pointer transition-colors ${
              showLangDropdown
                ? 'bg-purple-100 dark:bg-[#a855f7]/25 text-purple-600 dark:text-[#c084fc]'
                : 'bg-transparent text-gray-500 dark:text-zinc-400 hover:bg-purple-50 dark:hover:bg-[#252538] hover:text-purple-600 dark:hover:text-[#a855f7]'
            }`}
          >
            <TranslateIcon className="w-[17px] h-[17px]" />
          </button>

          {/* Dropdown */}
          {showLangDropdown && (
            <div
              className="absolute top-full right-0 mt-1.5 bg-white dark:bg-[#181826] border border-gray-100 dark:border-[#2d2d44] rounded-xl shadow-xl overflow-hidden z-50 animate-dropdown"
              style={{ minWidth: 125 }}
            >
              {HEADER_LANGUAGES.map((lang) => {
                const active = currentLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelectLang(lang.code)}
                    className={`flex items-center gap-2 w-full px-3.5 py-2.5 text-xs font-medium border-0 cursor-pointer transition-colors text-left ${
                      active
                        ? 'text-purple-600 dark:text-[#c084fc] font-semibold bg-purple-50/70 dark:bg-[#a855f7]/20'
                        : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-[#222236]'
                    }`}
                  >
                    <span style={{ fontSize: 14, lineHeight: 1 }}>{lang.flag}</span>
                    <span className="flex-1">{lang.label}</span>
                    {active && <FiCheck size={12} className="text-purple-600 dark:text-[#a855f7] shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Dark mode toggle */}
        <button
          type="button"
          id="theme-btn"
          onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
          title={getUIString('toggleTheme', currentLanguage)}
          aria-label={getUIString('toggleTheme', currentLanguage)}
          className="w-[30px] h-[30px] rounded-lg flex items-center justify-center bg-transparent border-0 text-gray-500 dark:text-zinc-300 hover:bg-purple-50 dark:hover:bg-[#252538] hover:text-purple-600 dark:hover:text-[#a855f7] transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <FiSun size={16} className="text-[#fbbf24]" /> : <FiMoon size={16} />}
        </button>

        {/* Settings */}
        <button
          type="button"
          id="settings-btn"
          onClick={onOpenSettings}
          title={getUIString('openSettings', currentLanguage)}
          aria-label={getUIString('settings', currentLanguage)}
          className="w-[30px] h-[30px] rounded-lg flex items-center justify-center bg-transparent border-0 text-gray-500 dark:text-zinc-400 hover:bg-purple-50 dark:hover:bg-[#252538] hover:text-purple-600 dark:hover:text-[#a855f7] transition-colors cursor-pointer"
        >
          <FiSettings size={16} />
        </button>
      </div>
    </div>
  );
}
