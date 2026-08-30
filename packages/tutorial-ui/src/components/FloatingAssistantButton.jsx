import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GuideMeLogo } from './GuideMeLogo.jsx';
import { getUIString } from '../i18n/ui-strings.js';

/* ─────────────────────────────────────────────────────────────────
   ContextMenu — right-click menu for the floating button.
   Includes:
     1. Open Dashboard — purple primary button
     2. Go to Extension— secondary button
     3. Close          — subtle red text button
───────────────────────────────────────────────────────────────── */
function ContextMenu({ menuRef, position, language, onDismiss, onOpenDashboard, onGoToExtension, onPopOut }) {
  return (
    <div
      ref={menuRef}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
      className="fixed z-[1000001] pointer-events-auto bg-white/98 dark:bg-[#181826]/98 backdrop-blur-md rounded-2xl p-2 min-w-[175px] border border-gray-200/90 dark:border-[#2d2d44] animate-[guideme-card-pop_0.15s_ease-out] flex flex-col gap-1.5"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
        boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.16), 0 3px 8px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.06)',
      }}
    >
      {/* ── Open Dashboard ── */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDashboard?.();
        }}
        className="w-full text-center py-2 px-3 text-[13px] font-semibold text-white bg-[#8b5cf6] hover:bg-[#7c3aed] active:bg-[#6d28d9] rounded-xl transition-all cursor-pointer border-0 shadow-[0_2px_8px_rgba(139,92,246,0.30)]"
      >
        {getUIString('openDashboard', language)}
      </button>

      {/* ── Pop out to Desktop (PiP) ── */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPopOut?.();
        }}
        className="w-full text-center py-2 px-3 text-[13px] font-medium text-gray-700 dark:text-zinc-200 bg-gray-100 hover:bg-gray-200/80 dark:bg-[#252538] dark:hover:bg-[#303046] rounded-xl transition-colors cursor-pointer border-0"
      >
        {getUIString('popOutDesktop', language)}
      </button>

      {/* ── Go to Extension ── */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onGoToExtension?.();
        }}
        className="w-full text-center py-2 px-3 text-[13px] font-medium text-gray-700 dark:text-zinc-200 bg-gray-100 hover:bg-gray-200/80 dark:bg-[#252538] dark:hover:bg-[#303046] rounded-xl transition-colors cursor-pointer border-0"
      >
        {getUIString('goToExtension', language)}
      </button>

      {/* ── Close ── */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss?.();
        }}
        className="w-full text-center py-1.5 text-[12.5px] font-medium text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer border-0 bg-transparent"
      >
        {getUIString('close', language)}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   FloatingAssistantButton — Floating launcher in bottom-right corner.
   - Compact rounded card with pulsing green active dot
   - Smooth hover expansion showing "Ask GuideMe"
   - Left-click  → toggle floating prompt widget
   - Right-click → context menu (Open Dashboard, Go to Extension, Close)
───────────────────────────────────────────────────────────────── */
export function FloatingAssistantButton({
  onClick,
  onDismiss,
  onOpenDashboard,
  onPopOut,
  isOpen = false,
  isActive = true,
  language = 'km',
}) {
  const [customPosition, setCustomPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  const dragRef = useRef({ startX: 0, startY: 0, initialLeft: 0, initialTop: 0, hasMoved: false });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  /* Outside-click dismiss */
  const handleOutsideClick = useCallback((e) => {
    if (!menuRef.current) return;
    const path = e.composedPath ? e.composedPath() : [];
    if (path.includes(menuRef.current)) return;
    setContextMenu(null);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    document.addEventListener('mousedown', handleOutsideClick, true);
    return () => document.removeEventListener('mousedown', handleOutsideClick, true);
  }, [contextMenu, handleOutsideClick]);

  /* ── Drag Handlers ── */
  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const el = buttonRef.current;
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
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { }
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const { startX, startY, initialLeft, initialTop } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.hasMoved = true;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = buttonRef.current?.offsetWidth || 56;
    const h = buttonRef.current?.offsetHeight || 56;

    setCustomPosition({
      top: Math.max(12, Math.min(initialTop + dy, vh - h - 12)),
      left: Math.max(12, Math.min(initialLeft + dx, vw - w - 12)),
    });
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    const hadMoved = dragRef.current.hasMoved;
    setIsDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { }

    if (!hadMoved && onClick) {
      onClick();
    }
  };

  /* ── Context Menu Trigger ── */
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuW = 180;
    const menuH = 135;
    const x = Math.min(e.clientX, vw - menuW - 12);
    const y = Math.min(e.clientY, vh - menuH - 12);
    setContextMenu({ x, y });
  };

  /* ── Actions ── */
  const handleDismiss = () => {
    setContextMenu(null);
    onDismiss?.();
  };

  const handleOpenDashboard = () => {
    setContextMenu(null);
    onOpenDashboard?.();
  };

  const handleGoToExtension = () => {
    setContextMenu(null);
    try {
      chrome.runtime?.sendMessage({ action: 'OPEN_POPUP' });
    } catch { }
  };

  const handlePopOut = () => {
    setContextMenu(null);
    onPopOut?.();
  };

  const positionStyle = customPosition
    ? { top: `${customPosition.top}px`, left: `${customPosition.left}px`, bottom: 'auto', right: 'auto' }
    : { bottom: '24px', right: '24px' };

  return (
    <>
      <div
        ref={buttonRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={handleContextMenu}
        style={positionStyle}
        className={`fixed z-[999998] pointer-events-auto select-none group ${
          isDragging
            ? 'transition-none cursor-grabbing scale-105'
            : 'transition-[top,left,bottom,right] duration-300 cursor-pointer'
        }`}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label="Ask GuideMe"
          title="Left-click to open · Right-click for options"
          className={`flex items-center bg-white dark:bg-[#181826] border p-1.5 rounded-[18px] shadow-[0_8px_28px_rgba(0,0,0,0.12),0_2px_8px_rgba(139,92,246,0.15)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.6)] transition-all duration-300 ease-out overflow-hidden group-hover:pr-3.5 hover:scale-105 ${
            isOpen
              ? 'border-[#8b5cf6] dark:border-[#a855f7] ring-2 ring-purple-500/20'
              : 'border-[#ede4ff] dark:border-[#2d2d44] hover:border-[#8b5cf6] dark:hover:border-[#a855f7]'
          }`}
        >
          {/* Logo container with Green Active Dot */}
          <div className="w-[38px] h-[38px] rounded-[12px] overflow-hidden flex items-center justify-center shrink-0 shadow-sm relative">
            <GuideMeLogo size={38} />
            {isActive && (
              <span className="absolute top-[2px] right-[2px] w-2.5 h-2.5 rounded-full bg-emerald-500 border-[1.5px] border-white dark:border-[#181826] shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            )}
          </div>

          {/* Smooth hover expand text */}
          <div className="max-w-0 opacity-0 overflow-hidden group-hover:max-w-[110px] group-hover:opacity-100 group-hover:ml-2.5 transition-all duration-300 ease-out whitespace-nowrap flex flex-col text-left leading-[1.15]">
            <span className="text-[11.5px] font-bold text-gray-900 dark:text-white">
              {getUIString('ask', language)}
            </span>
            <span className="text-[11.5px] font-bold text-[#7c3aed] dark:text-[#c084fc]">
              Guide Me
            </span>
          </div>
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          menuRef={menuRef}
          position={contextMenu}
          language={language}
          onDismiss={handleDismiss}
          onOpenDashboard={handleOpenDashboard}
          onGoToExtension={handleGoToExtension}
          onPopOut={handlePopOut}
        />
      )}
    </>
  );
}
