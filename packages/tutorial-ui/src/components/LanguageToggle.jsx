import React from 'react';

export function LanguageToggle({
  currentLanguage = 'km',
  onChange,
  className = '',
}) {
  const isKhmer = currentLanguage === 'km';

  return (
    <div
      role="radiogroup"
      aria-label="ជ្រើសរើសភាសា / Select Language"
      className={`inline-flex items-center bg-[#181b22] border border-[#2e3545] rounded-full p-[2px] select-none gap-[2px] ${className}`}
    >
      {/* Khmer Option */}
      <button
        type="button"
        role="radio"
        aria-checked={isKhmer}
        aria-label="ភាសាខ្មែរ (Khmer)"
        onClick={() => onChange && onChange('km')}
        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] leading-tight rounded-full font-kantumruy transition-all duration-150 cursor-pointer ${
          isKhmer
            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold shadow-[0_2px_6px_rgba(245,158,11,0.35)]'
            : 'bg-transparent text-slate-400 font-medium hover:text-white'
        }`}
      >
        <span>🇰🇭</span>
        <span>ខ្មែរ</span>
      </button>

      {/* English Option */}
      <button
        type="button"
        role="radio"
        aria-checked={!isKhmer}
        aria-label="English"
        onClick={() => onChange && onChange('en')}
        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] leading-tight rounded-full font-sans transition-all duration-150 cursor-pointer ${
          !isKhmer
            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold shadow-[0_2px_6px_rgba(245,158,11,0.35)]'
            : 'bg-transparent text-slate-400 font-medium hover:text-white'
        }`}
      >
        <span>🇬🇧</span>
        <span>EN</span>
      </button>
    </div>
  );
}
