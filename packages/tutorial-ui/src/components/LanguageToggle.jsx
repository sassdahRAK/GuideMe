import React from 'react';

/**
 * LanguagePill / LanguageToggle — Segmented KH | EN pill toggle matching the popup design.
 */
export function LanguagePill({
  currentLanguage = 'km',
  onChange,
  className = '',
}) {
  const isKhmer = currentLanguage === 'km';

  return (
    <div
      role="radiogroup"
      aria-label="ជ្រើសរើសភាសា / Select Language"
      className={`inline-flex items-center rounded-full overflow-hidden border border-gray-200 dark:border-[#3f3f5a] bg-gray-100 dark:bg-[#2a2a3c] ${className}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        role="radio"
        aria-checked={isKhmer}
        title="Switch to Khmer"
        onClick={(e) => {
          e.stopPropagation();
          onChange && onChange('km');
        }}
        className={`px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer border-0 leading-tight ${
          isKhmer
            ? 'bg-purple-600 text-white shadow-sm'
            : 'bg-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        KH
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={!isKhmer}
        title="Switch to English"
        onClick={(e) => {
          e.stopPropagation();
          onChange && onChange('en');
        }}
        className={`px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer border-0 leading-tight ${
          !isKhmer
            ? 'bg-purple-600 text-white shadow-sm'
            : 'bg-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        EN
      </button>
    </div>
  );
}

export function LanguageToggle(props) {
  return <LanguagePill {...props} />;
}
