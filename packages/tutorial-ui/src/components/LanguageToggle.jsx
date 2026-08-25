import React from 'react';

/**
 * Accessible Dual-Language Switcher (Khmer / English).
 * Segmented control designed for high readability and easy single-tap switching.
 */
export function LanguageToggle({
  currentLanguage = 'km',
  onChange,
  style = {},
}) {
  const isKhmer = currentLanguage === 'km';

  return (
    <div
      role="radiogroup"
      aria-label="ជ្រើសរើសភាសា / Select Language"
      className="guideme-language-toggle"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: '#181b22',
        border: '1px solid #2e3545',
        borderRadius: '20px',
        padding: '2px',
        userSelect: 'none',
        gap: '2px',
        ...style,
      }}
    >
      {/* Khmer Option */}
      <button
        type="button"
        role="radio"
        aria-checked={isKhmer}
        aria-label="ភាសាខ្មែរ (Khmer)"
        onClick={() => onChange && onChange('km')}
        style={{
          background: isKhmer
            ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
            : 'transparent',
          color: isKhmer ? '#0f1117' : '#94a3b8',
          fontWeight: isKhmer ? 700 : 500,
          border: 'none',
          borderRadius: '16px',
          padding: '4px 10px',
          fontSize: '11px',
          lineHeight: '1.2',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'all 0.15s ease',
          boxShadow: isKhmer ? '0 2px 6px rgba(245, 158, 11, 0.35)' : 'none',
          fontFamily: "'Kantumruy Pro', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
        onMouseEnter={(e) => {
          if (!isKhmer) e.currentTarget.style.color = '#ffffff';
        }}
        onMouseLeave={(e) => {
          if (!isKhmer) e.currentTarget.style.color = '#94a3b8';
        }}
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
        style={{
          background: !isKhmer
            ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
            : 'transparent',
          color: !isKhmer ? '#0f1117' : '#94a3b8',
          fontWeight: !isKhmer ? 700 : 500,
          border: 'none',
          borderRadius: '16px',
          padding: '4px 10px',
          fontSize: '11px',
          lineHeight: '1.2',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'all 0.15s ease',
          boxShadow: !isKhmer ? '0 2px 6px rgba(245, 158, 11, 0.35)' : 'none',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
        onMouseEnter={(e) => {
          if (isKhmer) e.currentTarget.style.color = '#ffffff';
        }}
        onMouseLeave={(e) => {
          if (isKhmer) e.currentTarget.style.color = '#94a3b8';
        }}
      >
        <span>🇬🇧</span>
        <span>EN</span>
      </button>
    </div>
  );
}
