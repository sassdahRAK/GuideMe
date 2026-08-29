import React, { useState, useRef, useEffect } from 'react';
import {
  FiX,
  FiMic,
  FiSend,
  FiPlus,
} from 'react-icons/fi';
import { GuideMeLogo } from './GuideMeLogo.jsx';
import { getUIString } from '../i18n/ui-strings.js';

/* ─────────────────────────────────────────────────────────────────
   Circular Progress Spinner — shown during dynamic guide generation.
───────────────────────────────────────────────────────────────── */
function ProcessingSpinner({ percentage = 67 }) {
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-6 h-6 flex items-center justify-center flex-shrink-0">
      <svg width="24" height="24" viewBox="0 0 28 28" className="-rotate-90">
        <circle
          cx="14"
          cy="14"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="3"
        />
        <circle
          cx="14"
          cy="14"
          r={radius}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <span className="absolute text-[7px] font-bold text-purple-600 dark:text-purple-400">{percentage}%</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   FloatingPromptWidget — The "Extract Separate UI" floating bar.
   Matches the user's screenshot:
   - Header: Guide Me logo + "Guide Me" title + Close button
   - Input row: "+" icon + "Ask anything ..." + Mic / Send button
   - Centered horizontally at top by default, freely draggable
───────────────────────────────────────────────────────────────── */
export function FloatingPromptWidget({
  isOpen = false,
  onToggleOpen,
  onStartDynamicGuide,
  language = 'km',
  initialPosition = null,
}) {
  const cardWidth = 490;
  const [promptText, setPromptText] = useState('');
  const [position, setPosition] = useState(() => {
    if (initialPosition) return initialPosition;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1000;
    return { top: 40, left: Math.max(16, Math.floor((vw - cardWidth) / 2)) };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const hasText = promptText.trim().length > 0;

  const dragRef = useRef({ startX: 0, startY: 0, initialLeft: 0, initialTop: 0 });
  const widgetRef = useRef(null);
  const inputRef = useRef(null);

  // Auto focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleHeaderPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('button, input, select, textarea, a')) return;
    const el = widgetRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, initialLeft: rect.left, initialTop: rect.top };
    setIsDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { }
  };

  const handleHeaderPointerMove = (e) => {
    if (!isDragging) return;
    const { startX, startY, initialLeft, initialTop } = dragRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = widgetRef.current?.offsetWidth || cardWidth;
    const h = widgetRef.current?.offsetHeight || 120;
    const newLeft = Math.max(12, Math.min(initialLeft + deltaX, vw - w - 12));
    const newTop = Math.max(12, Math.min(initialTop + deltaY, vh - h - 12));
    setPosition({ top: newTop, left: newLeft });
  };

  const handleHeaderPointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { }
  };

  const handleClose = () => {
    if (onToggleOpen) onToggleOpen(false);
  };

  const handleSubmitPrompt = (e) => {
    e?.preventDefault();
    if (!promptText.trim()) return;
    setIsProcessing(true);
    if (onStartDynamicGuide) {
      onStartDynamicGuide(promptText);
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={widgetRef}
      style={{ top: `${position.top}px`, left: `${position.left}px`, width: `${cardWidth}px` }}
      className={`fixed z-[999998] pointer-events-auto max-w-[94vw] bg-white dark:bg-[#181826] border border-[#ede4ff] dark:border-[#2d2d44] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.14),0_2px_8px_rgba(139,92,246,0.18)] dark:shadow-[0_16px_50px_rgba(0,0,0,0.8)] text-gray-900 dark:text-zinc-100 overflow-hidden animate-[guideme-card-pop_0.25s_ease-out] transition-shadow duration-200 ${
        isDragging ? 'cursor-grabbing select-none scale-[1.01] shadow-2xl' : ''
      }`}
    >
      {/* ── Draggable Header ── */}
      <div
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        onPointerCancel={handleHeaderPointerUp}
        className={`flex items-center justify-between px-3.5 py-2.5 border-b border-gray-100 dark:border-[#2d2d44] select-none cursor-grab active:cursor-grabbing bg-white dark:bg-[#181826] ${
          isDragging ? 'cursor-grabbing bg-purple-50/20 dark:bg-[#222236]' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md overflow-hidden flex items-center justify-center">
            <GuideMeLogo size={20} />
          </div>
          <span className="text-xs font-semibold text-gray-900 dark:text-white">
            Guide Me
          </span>
        </div>

        <button
          type="button"
          onClick={handleClose}
          aria-label={getUIString('close', language)}
          className="text-gray-400 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#252538] transition-colors cursor-pointer flex items-center justify-center border-0 bg-transparent"
        >
          <FiX className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Body — Prompt Input ── */}
      <div className="px-3.5 py-3">
        <form onSubmit={handleSubmitPrompt} className="m-0">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-[#ede4ff] dark:border-[#2d2d44] bg-white dark:bg-[#101018] focus-within:border-[#8b5cf6] dark:focus-within:border-[#a855f7] focus-within:ring-2 focus-within:ring-[#8b5cf6]/20 transition-all">
            {/* Left '+' or processing spinner */}
            {isProcessing ? (
              <ProcessingSpinner percentage={67} />
            ) : (
              <FiPlus className="w-4 h-4 text-[#8b5cf6] dark:text-[#a855f7] flex-shrink-0" />
            )}

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Ask anything ..."
              className="flex-1 bg-transparent border-0 outline-none text-[13px] text-gray-900 dark:text-white placeholder:text-purple-400/80 dark:placeholder:text-zinc-500 font-normal min-w-0"
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
      </div>
    </div>
  );
}
