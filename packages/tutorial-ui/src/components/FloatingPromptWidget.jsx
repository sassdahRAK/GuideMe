import React, { useState, useRef, useEffect } from 'react';
import {
  FiX,
  FiMic,
  FiSend,
  FiChevronLeft,
  FiChevronRight,
  FiPlay,
  FiPlus,
} from 'react-icons/fi';
import { LanguageToggle } from './LanguageToggle.jsx';
import { GuideMeLogo } from './GuideMeLogo.jsx';
import { getUIString } from '../i18n/ui-strings.js';

/* ─────────────────────────────────────────────────────────────────
   Circular Progress Spinner — shown inside the input left side
   when the guide is processing (after user submits prompt).
   Matches prototype image 19.
───────────────────────────────────────────────────────────────── */
function ProcessingSpinner({ percentage = 67 }) {
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-7 h-7 flex items-center justify-center flex-shrink-0">
      <svg width="28" height="28" viewBox="0 0 28 28" className="-rotate-90">
        {/* Background track */}
        <circle
          cx="14"
          cy="14"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="3"
        />
        {/* Progress arc */}
        <circle
          cx="14"
          cy="14"
          r={radius}
          fill="none"
          stroke="#9333ea"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <span className="absolute text-[7px] font-bold text-purple-600">{percentage}%</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   FloatingPromptWidget — The "Extract Separate UI" floating bar.
   States:
   1. Expanded: Full prompt box card (prototype images 13–19)
   2. Docked right: Edge-peek tab (can be dragged)
   3. Mini pill: Undocked floating pill
───────────────────────────────────────────────────────────────── */
export function FloatingPromptWidget({
  isOpen = false,
  onToggleOpen,
  onStartDynamicGuide,
  onStartTutorial,
  availableTutorials = [],
  language = 'km',
  onLanguageChange,
  initialPosition = null,
}) {
  const [open, setOpen] = useState(isOpen);
  const [promptText, setPromptText] = useState('');
  const [isDocked, setIsDocked] = useState(true);
  const [dockSide, setDockSide] = useState('right');
  const [position, setPosition] = useState(() => {
    if (initialPosition) return initialPosition;
    return { top: 180, left: typeof window !== 'undefined' ? window.innerWidth - 56 : 500 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const isKhmer = language === 'km';
  const cardWidth = 480;
  const edgeDockThreshold = 60;
  const hasText = promptText.trim().length > 0;

  const dragRef = useRef({ startX: 0, startY: 0, initialLeft: 0, initialTop: 0, hasMoved: false });
  const widgetRef = useRef(null);
  const inputRef = useRef(null);

  // Sync external open state
  useEffect(() => {
    if (isOpen !== undefined && isOpen !== open) {
      setOpen(isOpen);
      if (isOpen) setIsDocked(false);
    }
  }, [isOpen]);

  // Focus input when expanded
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handlePillPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const el = widgetRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, initialLeft: rect.left, initialTop: rect.top, hasMoved: false };
    setIsDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { }
  };

  const handlePillPointerMove = (e) => {
    if (!isDragging) return;
    const { startX, startY, initialLeft, initialTop } = dragRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) dragRef.current.hasMoved = true;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const currentW = widgetRef.current?.offsetWidth || 130;
    const currentH = widgetRef.current?.offsetHeight || 44;
    const newLeft = Math.max(0, Math.min(initialLeft + deltaX, vw - currentW));
    const newTop = Math.max(12, Math.min(initialTop + deltaY, vh - currentH - 12));
    setPosition({ top: newTop, left: newLeft });
  };

  const handlePillPointerUp = (e) => {
    if (!isDragging) return;
    const hadMoved = dragRef.current.hasMoved;
    setIsDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { }
    const vw = window.innerWidth;
    const currentLeft = position.left;
    if (currentLeft < edgeDockThreshold) {
      setIsDocked(true);
      setDockSide('left');
      setPosition((prev) => ({ ...prev, left: 0 }));
    } else if (currentLeft > vw - edgeDockThreshold - 100) {
      setIsDocked(true);
      setDockSide('right');
      setPosition((prev) => ({ ...prev, left: vw - 48 }));
    } else {
      setIsDocked(false);
    }
    if (!hadMoved) toggleCardOpen();
  };

  const handleCardHeaderPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('button, input, select, textarea, a, [role="radio"]')) return;
    const el = widgetRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, initialLeft: rect.left, initialTop: rect.top, hasMoved: false };
    setIsDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { }
  };

  const handleCardHeaderPointerMove = (e) => {
    if (!isDragging) return;
    const { startX, startY, initialLeft, initialTop } = dragRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = widgetRef.current?.offsetWidth || cardWidth;
    const h = widgetRef.current?.offsetHeight || 200;
    const newLeft = Math.max(12, Math.min(initialLeft + deltaX, vw - w - 12));
    const newTop = Math.max(12, Math.min(initialTop + deltaY, vh - h - 12));
    setPosition({ top: newTop, left: newLeft });
  };

  const handleCardHeaderPointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { }
  };

  const toggleCardOpen = () => {
    const nextState = !open;
    setOpen(nextState);
    if (onToggleOpen) onToggleOpen(nextState);
    if (nextState) {
      const vw = window.innerWidth;
      setIsDocked(false);
      if (dockSide === 'right' || position.left > vw - cardWidth - 20) {
        setPosition((prev) => ({ ...prev, left: Math.max(16, vw - cardWidth - 20) }));
      } else if (position.left < 20) {
        setPosition((prev) => ({ ...prev, left: 20 }));
      }
    }
  };

  const handleClose = () => {
    setOpen(false);
    if (onToggleOpen) onToggleOpen(false);
  };

  const handleSubmitPrompt = (e) => {
    e?.preventDefault();
    if (!promptText.trim()) return;
    setIsProcessing(true);
    if (onStartDynamicGuide) {
      onStartDynamicGuide(promptText);
      setOpen(false);
      setIsProcessing(false);
    }
  };

  // ── 1. DOCKED EDGE TAB ──
  if (isDocked && !open) {
    const isLeft = dockSide === 'left';
    return (
      <div
        ref={widgetRef}
        onPointerDown={handlePillPointerDown}
        onPointerMove={handlePillPointerMove}
        onPointerUp={handlePillPointerUp}
        onPointerCancel={handlePillPointerUp}
        style={{ top: `${position.top}px`, left: isLeft ? '0px' : undefined, right: isLeft ? undefined : '0px' }}
        className={`fixed z-[999998] pointer-events-auto select-none ${
          isDragging ? 'transition-none cursor-grabbing' : 'transition-all duration-200 cursor-grab'
        }`}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Open GuideMe Prompt Box"
          className={`flex items-center gap-1.5 bg-white dark:bg-[#1e1e2e] border border-gray-200 dark:border-[#3f3f5a] py-2 shadow-[0_4px_20px_rgba(0,0,0,0.12),0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-all duration-200 group ${
            isDragging ? 'scale-105 cursor-grabbing' : 'cursor-grab'
          } ${isLeft
            ? 'rounded-r-2xl border-l-0 pl-2.5 pr-3 hover:translate-x-0.5'
            : 'rounded-l-2xl border-r-0 pl-3 pr-2.5 hover:-translate-x-0.5'
          }`}
        >
          {isLeft ? (
            <>
              <GuideMeLogo size={24} />
              <FiChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 group-hover:text-purple-500 transition-colors" />
            </>
          ) : (
            <>
              <FiChevronLeft className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 group-hover:text-purple-500 transition-colors" />
              <GuideMeLogo size={24} />
            </>
          )}
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
        </div>
      </div>
    );
  }

  // ── 2. MINI FLOATING PILL (undocked, closed) ──
  if (!open) {
    return (
      <div
        ref={widgetRef}
        onPointerDown={handlePillPointerDown}
        onPointerMove={handlePillPointerMove}
        onPointerUp={handlePillPointerUp}
        onPointerCancel={handlePillPointerUp}
        style={{ top: `${position.top}px`, left: `${position.left}px` }}
        className={`fixed z-[999998] pointer-events-auto select-none ${
          isDragging ? 'transition-none cursor-grabbing' : 'transition-all duration-200 cursor-grab'
        }`}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Open GuideMe Prompt Box"
          className={`flex items-center gap-2 bg-white dark:bg-[#1e1e2e] border border-gray-200 dark:border-[#3f3f5a] hover:border-purple-300 dark:hover:border-purple-500 px-3 py-1.5 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.10),0_1px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)] hover:shadow-[0_8px_24px_rgba(147,51,234,0.15)] transition-all duration-200 group ${
            isDragging ? 'scale-105 border-purple-300 cursor-grabbing' : 'hover:scale-105 cursor-grab'
          }`}
        >
          <GuideMeLogo size={22} />
          <span className="text-xs font-semibold text-gray-700 dark:text-zinc-200 group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors whitespace-nowrap">
            {getUIString('askGuideMe', language)}
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
        </div>
      </div>
    );
  }

  // ── 3. EXPANDED FLOATING PROMPT BOX (matches prototype 13–19) ──
  return (
    <div
      ref={widgetRef}
      style={{ top: `${position.top}px`, left: `${position.left}px`, width: `${cardWidth}px` }}
      className={`fixed z-[999998] pointer-events-auto max-w-[94vw] bg-white dark:bg-[#1e1e2e] border border-gray-200 dark:border-[#3f3f5a] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)] text-gray-900 dark:text-zinc-100 overflow-hidden animate-[guideme-card-pop_0.25s_ease-out] ${
        isKhmer ? 'font-kantumruy' : 'font-sans'
      } ${isDragging ? 'transition-none select-none border-purple-200 dark:border-purple-500 shadow-[0_16px_48px_rgba(147,51,234,0.15)] scale-[1.01]' : 'transition-shadow duration-200'}`}
    >
      {/* ── Header (draggable) ── */}
      <div
        onPointerDown={handleCardHeaderPointerDown}
        onPointerMove={handleCardHeaderPointerMove}
        onPointerUp={handleCardHeaderPointerUp}
        onPointerCancel={handleCardHeaderPointerUp}
        className={`flex items-center justify-between px-3.5 py-2.5 border-b border-gray-100 dark:border-[#2a2a3c] select-none cursor-grab active:cursor-grabbing bg-white dark:bg-[#1e1e2e] ${
          isDragging ? 'cursor-grabbing bg-gray-50 dark:bg-[#252538]' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GuideMeLogo size={22} />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {getUIString('appName', language)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <LanguageToggle currentLanguage={language} onChange={onLanguageChange} />
          <button
            type="button"
            onClick={handleClose}
            aria-label={getUIString('close', language)}
            className="text-gray-400 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2a2a3c] transition-colors cursor-pointer flex items-center justify-center"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Body — Prompt Input (matches prototype style) ── */}
      <div className="px-4 py-3">
        <form onSubmit={handleSubmitPrompt}>
          <div className="flex items-center gap-2.5 border border-gray-200 dark:border-[#3f3f5a] rounded-xl px-3.5 py-2.5 bg-gray-50 dark:bg-[#252538] focus-within:border-purple-400 focus-within:bg-white dark:focus-within:bg-[#1e1e2e] focus-within:shadow-[0_0_0_3px_rgba(147,51,234,0.08)] transition-all duration-150">
            {/* Left: processing spinner or FiPlus icon */}
            {isProcessing ? (
              <ProcessingSpinner percentage={67} />
            ) : (
              <FiPlus className="w-4 h-4 text-gray-400 dark:text-zinc-500 flex-shrink-0" />
            )}

            <input
              ref={inputRef}
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder={getUIString('askAnything', language)}
              className="flex-1 bg-transparent text-gray-900 dark:text-zinc-100 text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-zinc-500 min-w-0"
            />

            {/* Mic icon (empty) → Send icon (has text) */}
            {hasText ? (
              <button
                type="submit"
                className="text-purple-600 dark:text-purple-400 hover:text-purple-700 cursor-pointer transition-colors flex-shrink-0"
                title={getUIString('send', language)}
              >
                <FiSend className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsListening(!isListening)}
                className={`transition-colors cursor-pointer flex-shrink-0 ${
                  isListening ? 'text-purple-600 animate-pulse' : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300'
                }`}
                title={isListening ? getUIString('stopListening', language) : getUIString('voiceInput', language)}
              >
                <FiMic className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>

        {/* Quick curated guides */}
        {availableTutorials && availableTutorials.length > 0 && (
          <div className="mt-3">
            <div className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase mb-1.5 tracking-wider">
              {getUIString('matchedGuides', language)}
            </div>
            <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto">
              {availableTutorials.slice(0, 2).map((tut) => {
                const name = typeof tut.name === 'object'
                  ? tut.name[language] || tut.name.km || tut.name.en
                  : tut.name;
                return (
                  <button
                    key={tut.id}
                    type="button"
                    onClick={() => {
                      if (onStartTutorial) onStartTutorial(tut.id);
                      setOpen(false);
                    }}
                    className="w-full text-left bg-gray-50 dark:bg-[#252538] hover:bg-purple-50 dark:hover:bg-[#31255a] border border-gray-200 dark:border-[#3f3f5a] hover:border-purple-300 dark:hover:border-purple-500 rounded-lg p-2 transition-colors cursor-pointer flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-900 dark:text-zinc-100 truncate">{name}</div>
                      <div className="text-[10px] text-gray-400 dark:text-zinc-400">
                        {tut.totalSteps || tut.steps?.length || 4} {getUIString('stepsCount', language)}
                      </div>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center flex-shrink-0">
                      <FiPlay className="w-2.5 h-2.5 ml-0.5 fill-current" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
