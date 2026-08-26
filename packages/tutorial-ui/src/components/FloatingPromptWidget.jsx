import React, { useState, useRef, useEffect } from 'react';
import {
  FiCompass,
  FiZap,
  FiMessageSquare,
  FiX,
  FiMinus,
  FiChevronLeft,
  FiChevronRight,
  FiPlay,
} from 'react-icons/fi';
import { LanguageToggle } from './LanguageToggle.jsx';

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
  const [dockSide, setDockSide] = useState('right'); // 'left' | 'right'
  const [position, setPosition] = useState(() => {
    if (initialPosition) return initialPosition;
    return { top: 180, left: typeof window !== 'undefined' ? window.innerWidth - 56 : 500 };
  });
  const [isDragging, setIsDragging] = useState(false);

  const isKhmer = language === 'km';
  const cardWidth = 380;
  const cardHeight = 320;
  const edgeDockThreshold = 60;

  const dragRef = useRef({
    startX: 0,
    startY: 0,
    initialLeft: 0,
    initialTop: 0,
    hasMoved: false,
  });
  const widgetRef = useRef(null);

  // Sync external open state
  useEffect(() => {
    if (isOpen !== undefined && isOpen !== open) {
      setOpen(isOpen);
      if (isOpen) {
        setIsDocked(false);
      }
    }
  }, [isOpen]);

  // 1. DRAG HANDLER FOR MINI LAUNCHER PILL & DOCKED TAB
  const handlePillPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const el = widgetRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialLeft: rect.left,
      initialTop: rect.top,
      hasMoved: false,
    };

    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePillPointerMove = (e) => {
    if (!isDragging) return;
    const { startX, startY, initialLeft, initialTop } = dragRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      dragRef.current.hasMoved = true;
    }

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
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const vw = window.innerWidth;
    const currentLeft = position.left;

    // Check if dropped near screen edges to trigger edge docking
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

    // Only toggle/open if it was a click (not a drag)
    if (!hadMoved) {
      toggleCardOpen();
    }
  };

  // 2. DRAG HANDLER FOR EXPANDED CARD HEADER BAR
  const handleCardHeaderPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('button, input, select, textarea, a, [role="radio"]')) return;

    const el = widgetRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialLeft: rect.left,
      initialTop: rect.top,
      hasMoved: false,
    };

    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleCardHeaderPointerMove = (e) => {
    if (!isDragging) return;
    const { startX, startY, initialLeft, initialTop } = dragRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = widgetRef.current?.offsetWidth || cardWidth;
    const h = widgetRef.current?.offsetHeight || cardHeight;

    const newLeft = Math.max(12, Math.min(initialLeft + deltaX, vw - w - 12));
    const newTop = Math.max(12, Math.min(initialTop + deltaY, vh - h - 12));

    setPosition({ top: newTop, left: newLeft });
  };

  const handleCardHeaderPointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const toggleCardOpen = () => {
    const nextState = !open;
    setOpen(nextState);
    if (onToggleOpen) {
      onToggleOpen(nextState);
    }

    if (nextState) {
      // When opening from docked state, ensure card is visible within screen bounds
      const vw = window.innerWidth;
      setIsDocked(false);
      if (dockSide === 'right' || position.left > vw - cardWidth - 20) {
        setPosition((prev) => ({ ...prev, left: Math.max(16, vw - cardWidth - 20) }));
      } else if (position.left < 20) {
        setPosition((prev) => ({ ...prev, left: 20 }));
      }
    }
  };

  const handleDockToEdge = (side = 'right') => {
    const vw = window.innerWidth;
    setOpen(false);
    setIsDocked(true);
    setDockSide(side);
    setPosition((prev) => ({
      ...prev,
      left: side === 'left' ? 0 : vw - 48,
    }));
    if (onToggleOpen) onToggleOpen(false);
  };

  const handleSubmitPrompt = (e) => {
    e?.preventDefault();
    if (onStartDynamicGuide) {
      onStartDynamicGuide(promptText);
      setOpen(false);
    }
  };

  const handleAutoGuide = () => {
    if (onStartDynamicGuide) {
      onStartDynamicGuide('');
      setOpen(false);
    }
  };

  // 1. DOCKED EDGE TAB (Grammarly / Screen Recorder style)
  if (isDocked && !open) {
    const isLeft = dockSide === 'left';
    return (
      <div
        ref={widgetRef}
        onPointerDown={handlePillPointerDown}
        onPointerMove={handlePillPointerMove}
        onPointerUp={handlePillPointerUp}
        onPointerCancel={handlePillPointerUp}
        style={{
          top: `${position.top}px`,
          left: isLeft ? '0px' : 'auto',
          right: isLeft ? 'auto' : '0px',
        }}
        className={`fixed z-[999998] pointer-events-auto select-none ${
          isDragging ? 'transition-none cursor-grabbing' : 'transition-all duration-300 ease-out cursor-grab'
        }`}
      >
        <div
          title={isKhmer ? 'ជំនួយការ GuideMe • ចុចដើម្បីបើក ឬអូសដើម្បីផ្លាស់ទី' : 'GuideMe AI Assistant • Click to open or drag to reposition'}
          className={`flex items-center gap-1 bg-[#12141a]/95 backdrop-blur-md border border-amber-500/50 py-2 text-amber-400 shadow-[0_4px_24px_rgba(0,0,0,0.8),0_0_16px_rgba(245,158,11,0.35)] hover:border-amber-400 hover:shadow-[0_6px_30px_rgba(0,0,0,0.9),0_0_24px_rgba(245,158,11,0.55)] group transition-all duration-200 ${
            isDragging ? 'scale-105 shadow-[0_8px_32px_rgba(245,158,11,0.6)] cursor-grabbing' : 'cursor-grab'
          } ${
            isLeft
              ? 'rounded-r-2xl border-l-0 pl-2.5 pr-3 translate-x-0 hover:translate-x-1'
              : 'rounded-l-2xl border-r-0 pl-3 pr-2.5 translate-x-0 hover:-translate-x-1'
          }`}
        >
          {isLeft ? (
            <>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-black flex items-center justify-center font-black text-xs shadow-[0_0_10px_rgba(245,158,11,0.5)] shrink-0">
                G
              </div>
              <FiChevronRight className="w-3.5 h-3.5 text-amber-400/80 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-transform" />
            </>
          ) : (
            <>
              <FiChevronLeft className="w-3.5 h-3.5 text-amber-400/80 group-hover:text-amber-300 group-hover:-translate-x-0.5 transition-transform" />
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-black flex items-center justify-center font-black text-xs shadow-[0_0_10px_rgba(245,158,11,0.5)] shrink-0">
                G
              </div>
            </>
          )}

          {/* Active status pulse indicator */}
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        </div>
      </div>
    );
  }

  // 2. FLOATING MINI LAUNCHER PILL (When closed and un-docked)
  if (!open) {
    return (
      <div
        ref={widgetRef}
        onPointerDown={handlePillPointerDown}
        onPointerMove={handlePillPointerMove}
        onPointerUp={handlePillPointerUp}
        onPointerCancel={handlePillPointerUp}
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
        title={isKhmer ? 'ជំនួយការ GuideMe • ចុចដើម្បីបើក ឬអូសដើម្បីផ្លាស់ទី' : 'GuideMe AI Assistant • Click to open or drag to move'}
        className={`fixed z-[999998] pointer-events-auto select-none ${
          isDragging ? 'transition-none cursor-grabbing' : 'transition-all duration-200 cursor-grab'
        }`}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Open GuideMe Prompt Box"
          className={`flex items-center gap-2 bg-[#12141a]/95 backdrop-blur-md border-2 border-amber-500/50 hover:border-amber-400 text-amber-400 px-3.5 py-2 rounded-full shadow-[0_12px_28px_-4px_rgba(0,0,0,0.8),0_0_20px_rgba(245,158,11,0.35)] hover:shadow-[0_16px_36px_-4px_rgba(0,0,0,0.9),0_0_28px_rgba(245,158,11,0.55)] transition-all duration-200 group ${
            isDragging
              ? 'scale-105 border-amber-400 shadow-[0_16px_36px_-4px_rgba(0,0,0,0.9),0_0_28px_rgba(245,158,11,0.6)] cursor-grabbing'
              : 'hover:scale-105 cursor-grab'
          }`}
        >
          <div className="w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center font-black text-xs shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.4)]">
            G
          </div>
          <span className="text-xs font-bold text-slate-100 group-hover:text-amber-300 transition-colors whitespace-nowrap">
            {isKhmer ? 'សួរ GuideMe' : 'Ask GuideMe'}
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        </div>
      </div>
    );
  }

  // 3. EXPANDED FLOATING PROMPT BOX CARD (Draggable on page)
  return (
    <div
      ref={widgetRef}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${cardWidth}px`,
      }}
      className={`fixed z-[999998] pointer-events-auto max-w-[94vw] bg-[#12141a]/95 backdrop-blur-md border border-[#2a2f3b] rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85),0_0_30px_rgba(245,158,11,0.2)] text-slate-100 overflow-hidden animate-[guideme-card-pop_0.25s_ease-out] ${
        isKhmer ? 'font-kantumruy' : 'font-sans'
      } ${isDragging ? 'transition-none select-none border-amber-500/50 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.95),0_0_35px_rgba(245,158,11,0.4)] scale-[1.01]' : 'transition-shadow duration-200'}`}
    >
      {/* Header / Drag Bar */}
      <div
        onPointerDown={handleCardHeaderPointerDown}
        onPointerMove={handleCardHeaderPointerMove}
        onPointerUp={handleCardHeaderPointerUp}
        onPointerCancel={handleCardHeaderPointerUp}
        onDoubleClick={() => handleDockToEdge('right')}
        title={isKhmer ? 'អូសដើម្បីផ្លាស់ទី • ចុចពីរដងដើម្បីបង្រួមទៅគែម' : 'Drag to reposition • Double-click to dock to edge'}
        className={`bg-gradient-to-br from-[#1a1e28] to-[#12141a] px-3.5 py-2.5 flex justify-between items-center border-b border-[#232734] gap-2 select-none cursor-grab active:cursor-grabbing ${
          isDragging ? 'cursor-grabbing border-amber-500/40 bg-[#1e2330]' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Drag grip handle */}
          <div className="flex flex-col gap-0.5 text-slate-500 hover:text-amber-400 p-0.5 cursor-grab active:cursor-grabbing shrink-0" aria-label="Drag Handle">
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-current opacity-70" />
              <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            </div>
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-current opacity-70" />
              <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            </div>
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-current opacity-70" />
              <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            </div>
          </div>

          <div className="w-6 h-6 rounded-lg bg-amber-500 flex items-center justify-center font-black text-xs text-black shadow-[0_2px_8px_rgba(245,158,11,0.4)] shrink-0">
            G
          </div>

          <div className="min-w-0">
            <h3 className="m-0 text-xs font-bold text-white tracking-tight truncate">
              GuideMe
            </h3>
            <span className="text-[10px] text-amber-400/90 font-medium truncate block">
              {isKhmer ? 'ប្រអប់សួរការណែនាំ' : 'Prompt-to-Guide Anywhere'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <LanguageToggle
            currentLanguage={language}
            onChange={onLanguageChange}
          />

          {/* Minimize / Dock to edge button */}
          <button
            type="button"
            onClick={() => handleDockToEdge('right')}
            title={isKhmer ? 'បង្រួមទៅគែមអេក្រង់' : 'Dock to screen edge'}
            className="text-slate-400 hover:text-amber-400 p-1 rounded hover:bg-slate-800/50 transition-colors cursor-pointer flex items-center justify-center"
          >
            <FiMinus className="w-3.5 h-3.5" />
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800/50 transition-colors cursor-pointer flex items-center justify-center"
          >
            <FiX className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body / Prompt Form */}
      <div className="p-3.5">
        <div className="text-[11px] text-slate-300 mb-2 leading-relaxed">
          {isKhmer
            ? 'វាយបញ្ចូលអ្វីដែលអ្នកចង់ធ្វើលើទំព័រនេះ៖'
            : 'Type what you want to do on this page:'}
        </div>

        <form onSubmit={handleSubmitPrompt} className="mb-2.5">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder={isKhmer ? 'ឧ. ស្វែងរក, បំពេញអ៊ីមែល, ចុច Share...' : 'e.g. search, fill email, click share...'}
              className="flex-1 bg-[#181b22] border border-[#3e4556] rounded-xl text-white px-3 py-2 text-xs outline-none focus:border-amber-500 placeholder:text-slate-500 transition-colors"
              autoFocus
            />
            <button
              type="submit"
              className="bg-gradient-to-r from-amber-500 to-amber-600 text-black px-3.5 py-2 rounded-xl text-xs font-extrabold cursor-pointer shadow-[0_2px_8px_rgba(245,158,11,0.35)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(245,158,11,0.45)] whitespace-nowrap transition-all duration-150"
            >
              Guide Me
            </button>
          </div>
        </form>

        {/* Auto-Guide Button */}
        <button
          type="button"
          onClick={handleAutoGuide}
          className="w-full bg-[#181c26] border border-[#2a3142] hover:border-amber-500 text-slate-200 hover:text-amber-400 py-2 px-3 rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-colors mb-2.5"
        >
          <FiZap className="w-3.5 h-3.5 text-amber-400" />
          <span>{isKhmer ? 'ចាប់ផ្តើមស្កេនទំព័រនេះដោយស្វ័យប្រវត្តិ' : 'Auto-Guide This Page'}</span>
        </button>

        {/* Quick Curated Guides if available */}
        {availableTutorials && availableTutorials.length > 0 && (
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1.5 tracking-wider">
              {isKhmer ? 'មេរៀនដែលត្រូវគ្នា (Curated Guides)' : 'MATCHED GUIDES'}
            </div>
            <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1">
              {availableTutorials.slice(0, 2).map((tut) => {
                const name = typeof tut.name === 'object' ? tut.name[language] || tut.name.km || tut.name.en : tut.name;
                return (
                  <button
                    key={tut.id}
                    type="button"
                    onClick={() => {
                      if (onStartTutorial) onStartTutorial(tut.id);
                      setOpen(false);
                    }}
                    className="w-full text-left bg-[#181b22] hover:bg-[#1f2430] border border-[#2a2f3b] hover:border-amber-500/60 rounded-lg p-2 transition-colors cursor-pointer flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{name}</div>
                      <div className="text-[10px] text-slate-400">{tut.totalSteps || tut.steps?.length || 4} Steps</div>
                    </div>
                    <div className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
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

