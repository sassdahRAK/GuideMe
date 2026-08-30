import React, { useEffect, useState } from 'react';
import { GuideMeLogo, getUIString } from '@guideme/tutorial-ui';
import { FiMic, FiSend, FiPlus } from 'react-icons/fi';

/**
 * FloatingApp — A sleek, borderless floating card that lives in a
 * standalone desktop popup window (chrome.windows.create).
 * Features a draggable header and pill-shaped input prompt.
 */
export default function FloatingApp() {
  const [language, setLanguage] = useState('km');
  const [theme, setTheme] = useState('light');
  const [promptText, setPromptText] = useState('');
  const [isListening, setIsListening] = useState(false);

  const hasText = promptText.trim().length > 0;
  const isKhmer = language === 'km';

  // Load preferences on mount
  useEffect(() => {
    try {
      chrome.storage?.local?.get(['guideme_theme', 'guideme_lang'], (result) => {
        if (result?.guideme_theme) setTheme(result.guideme_theme);
        if (result?.guideme_lang) setLanguage(result.guideme_lang);
      });

      const storageListener = (changes, areaName) => {
        if (areaName === 'local') {
          if (changes.guideme_theme) setTheme(changes.guideme_theme.newValue);
          if (changes.guideme_lang) setLanguage(changes.guideme_lang.newValue);
        }
      };
      chrome.storage?.onChanged?.addListener(storageListener);
      return () => chrome.storage?.onChanged?.removeListener(storageListener);
    } catch { /* storage unavailable */ }
  }, []);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!promptText.trim()) return;
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'START_DYNAMIC_GUIDE',
          payload: { prompt: promptText },
        });
      }
    });
    setPromptText('');
  };

  return (
    <div className={`floating-card ${isKhmer ? 'font-kantumruy' : 'font-sans'} ${theme === 'dark' ? 'dark' : ''}`}>
      {/* ── Draggable Header ── */}
      <header className="floating-header">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md overflow-hidden flex items-center justify-center">
            <GuideMeLogo size={24} />
          </div>
          <span className="text-xs font-semibold text-gray-900 dark:text-white">
            Guide Me
          </span>
        </div>
        <button
          type="button"
          onClick={() => window.close()}
          aria-label="Close"
          className="text-gray-400 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#252538] transition-colors cursor-pointer flex items-center justify-center border-0 bg-transparent"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      {/* ── Input Bar ── */}
      <main className="floating-body">
        <form onSubmit={handleSubmit} className="w-full m-0">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-[#2d2d44] bg-gray-50/60 dark:bg-[#101018] focus-within:bg-white dark:focus-within:bg-[#101018] focus-within:border-[#8b5cf6] dark:focus-within:border-[#a855f7] focus-within:ring-2 focus-within:ring-[#8b5cf6]/20 transition-all">
            {/* Left '+' icon */}
            <FiPlus className="w-4 h-4 text-[#8b5cf6] dark:text-[#a855f7] flex-shrink-0" />

            {/* Input */}
            <input
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder={getUIString('askAnything', language)}
              className="flex-1 bg-transparent border-0 outline-none text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 font-normal min-w-0"
              style={{ border: 'none', outline: 'none' }}
            />

            {/* Mic / Send Button */}
            {hasText ? (
              <button
                type="submit"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 cursor-pointer border-0 transition-all bg-[#8b5cf6] dark:bg-[#a855f7] shadow-sm hover:brightness-110"
                title={getUIString('send', language)}
              >
                <FiSend className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsListening(!isListening)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border-0 transition-all cursor-pointer ${
                  isListening
                    ? 'text-white bg-[#8b5cf6] dark:bg-[#a855f7] animate-pulse'
                    : 'bg-transparent text-[#8b5cf6] dark:text-[#a855f7] hover:bg-purple-50 dark:hover:bg-purple-950/40'
                }`}
                title={isListening ? getUIString('stopListening', language) : getUIString('voiceInput', language)}
              >
                <FiMic className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
