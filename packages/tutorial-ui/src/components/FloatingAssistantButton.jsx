import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GuideMeLogo } from './GuideMeLogo.jsx';
import { getUIString } from '../i18n/ui-strings.js';

/* ─────────────────────────────────────────────────────────────────
   ContextMenu — right-click menu for the floating button.
   3 options:
     1. Close          — hides the floating button
     2. Open Dashboard — opens guideme.app/dashboard in a new tab
     3. Go to Extension— triggers the native Chrome extension toolbar popup
───────────────────────────────────────────────────────────────── */
function ContextMenu({ menuRef, position, language, onDismiss, onOpenDashboard, onGoToExtension }) {
  return (
    <div
      ref={menuRef}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
      className="fixed z-[1000001] pointer-events-auto bg-white dark:bg-[#181826] rounded-xl overflow-hidden min-w-[180px] border border-gray-200 dark:border-[#2d2d44] animate-[guideme-card-pop_0.15s_ease-out] shadow-[0_12px_40px_rgba(0,0,0,0.22),0_0_0_1px_rgba(147,51,234,0.2)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.8)]"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
      }}
    >
      {/* ── Close ── */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss?.();
        }}
        className="w-full text-center px-4 py-2.5 text-[13px] font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-[#252538] transition-colors cursor-pointer border-0 bg-transparent"
      >
        {getUIString('dismissFloating', language)}
      </button>

      <div className="h-px bg-gray-100 dark:bg-[#2a2a3c]" />

      {/* ── Open Dashboard ── */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDashboard?.();
        }}
        className="w-full text-center px-4 py-2.5 text-[13px] font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors cursor-pointer border-0 shadow-sm"
      >
        {getUIString('openDashboard', language)}
      </button>

      <div className="h-px bg-purple-700/30" />

      {/* ── Go to Extension ── */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onGoToExtension?.();
        }}
        className="w-full text-center px-4 py-2.5 text-[13px] font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-[#252538] transition-colors cursor-pointer border-0 bg-transparent"
      >
        {getUIString('goToExtension', language)}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   FloatingAssistantButton
   - Always visible in bottom-right corner
   - Left-click  → toggle floating prompt widget
   - Right-click → context menu (Close / Open Dashboard / Go to Extension)
───────────────────────────────────────────────────────────────── */
export function FloatingAssistantButton({
  onClick,
  onDismiss,
  onOpenDashboard,
  isActive = true,
  isOpen = false,
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
    const menuW = 185;
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
    if (onOpenDashboard) {
      onOpenDashboard();
      return;
    }
    try {
      chrome.runtime?.sendMessage({
        action: 'OPEN_DASHBOARD_OVERLAY',
      });
    } catch { }
  };

  const handleGoToExtension = () => {
    setContextMenu(null);
    try {
      chrome.runtime?.sendMessage({ action: 'OPEN_POPUP' });
    } catch { }
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
            : 'transition-[top,left,bottom,right] duration-300 cursor-grab'
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
          <div className="w-[38px] h-[38px] rounded-[12px] overflow-hidden flex items-center justify-center shrink-0 shadow-sm relative">
            <GuideMeLogo size={38} />
            {isActive && (
              <span className="absolute top-[2px] right-[2px] w-2 h-2 rounded-full bg-emerald-500 border-[1.5px] border-white dark:border-[#181826] shadow-[0_0_5px_rgba(52,211,153,0.6)]" />
            )}
          </div>

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
        />
      )}
    </>
  );
}
