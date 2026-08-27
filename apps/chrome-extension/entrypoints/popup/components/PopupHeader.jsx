import React, { useState, useRef, useEffect } from 'react';
import { FiSun, FiMoon, FiSettings } from 'react-icons/fi';
import { GuideMeLogo, LanguagePill, getUIString } from '@guideme/tutorial-ui';

/**
 * PopupHeader — Top navigation bar with logo, language selector popover (click-to-toggle), theme toggle, and settings button.
 */
export function PopupHeader({
  currentLanguage,
  onLanguageChange,
  theme,
  onThemeChange,
  onOpenSettings,
}) {
  const [showLangPopover, setShowLangPopover] = useState(false);
  const popoverRef = useRef(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!showLangPopover) return;

    const handleOutsideClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowLangPopover(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showLangPopover]);

  const handleSelectLanguage = (lang) => {
    onLanguageChange(lang);
    setShowLangPopover(false);
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#2a2a3c] shrink-0">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-2">
        <GuideMeLogo size={28} />
        <span className="font-semibold text-sm text-gray-900 dark:text-white">
          {getUIString('appName', currentLanguage)}
        </span>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1.5 relative">
        {/* Language Translate Popover (Click to Toggle) */}
        <div ref={popoverRef} className="relative">
          <button
            type="button"
            id="translate-btn"
            onClick={() => setShowLangPopover((prev) => !prev)}
            title={getUIString('language', currentLanguage)}
            aria-label={getUIString('selectLanguage', currentLanguage)}
            aria-expanded={showLangPopover}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center ${
              showLangPopover
                ? 'bg-purple-100 dark:bg-[#3b2d6e] text-purple-600 dark:text-purple-300'
                : 'text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-[#2a2a3c]'
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 8l6 6" />
              <path d="M4 14l6-6 2-3" />
              <path d="M2 5h12" />
              <path d="M7 2h1" />
              <path d="M22 22l-5-10-5 10" />
              <path d="M14 18h6" />
            </svg>
          </button>

          {/* Floating Pill Popover */}
          <div
            className={`absolute top-full left-1/2 -translate-x-1/2 mt-1.5 p-1 bg-white dark:bg-[#1e1e2e] border border-gray-200 dark:border-[#3f3f5a] rounded-full shadow-lg transition-all duration-150 z-50 ${
              showLangPopover
                ? 'opacity-100 visible translate-y-0 pointer-events-auto'
                : 'opacity-0 invisible -translate-y-1 pointer-events-none'
            }`}
          >
            <LanguagePill currentLanguage={currentLanguage} onChange={handleSelectLanguage} />
          </div>
        </div>

        {/* Theme Toggle Button */}
        <button
          type="button"
          id="theme-btn"
          onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
          title={getUIString('toggleTheme', currentLanguage)}
          aria-label={getUIString('toggleTheme', currentLanguage)}
          className="p-1.5 rounded-lg text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-[#2a2a3c] transition-colors cursor-pointer flex items-center"
        >
          {theme === 'dark' ? <FiMoon size={16} /> : <FiSun size={16} />}
        </button>

        {/* Settings Gear Button */}
        <button
          type="button"
          id="settings-btn"
          onClick={onOpenSettings}
          title={getUIString('openSettings', currentLanguage)}
          aria-label={getUIString('settings', currentLanguage)}
          className="p-1.5 rounded-lg text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-[#2a2a3c] transition-colors cursor-pointer flex items-center"
        >
          <FiSettings size={16} />
        </button>
      </div>
    </div>
  );
}
