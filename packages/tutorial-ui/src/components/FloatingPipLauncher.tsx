import React from 'react';
import { GuideMeLogo } from './GuideMeLogo.jsx';

interface FloatingPipLauncherProps {
  onClick?: () => void;
  isOpen?: boolean;
}

/* ─────────────────────────────────────────────────────────────────
   FloatingPipLauncher — A compact, always-on-top launcher icon
   rendered inside a Document PiP window. Shows the GuideMe logo
   as a clickable button. When clicked, opens the full GuideMe
   interface (prompt widget / dashboard).
───────────────────────────────────────────────────────────────── */
export function FloatingPipLauncher({ onClick, isOpen = false }: FloatingPipLauncherProps) {
  return (
    <div className="w-full h-screen flex items-center justify-center bg-transparent">
      <button
        type="button"
        onClick={onClick}
        title="GuideMe — Click to open"
        aria-label="GuideMe — Click to open"
        className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1d1e22] border-0 cursor-pointer transition-all duration-200 hover:scale-110 hover:shadow-[0_0_20px_rgba(147,51,234,0.5)] active:scale-95 ${
          isOpen ? 'shadow-[0_0_20px_rgba(147,51,234,0.5)] scale-105' : 'shadow-[0_4px_15px_rgba(0,0,0,0.3)]'
        }`}
      >
        <GuideMeLogo size={32} />
        {/* Pulse ring when closed to attract attention */}
        {!isOpen && (
          <span className="absolute inset-0 rounded-2xl border-2 border-purple-500/40 animate-ping opacity-75" />
        )}
      </button>
    </div>
  );
}
