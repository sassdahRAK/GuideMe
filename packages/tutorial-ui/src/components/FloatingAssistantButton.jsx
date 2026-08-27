import React, { useState, useRef, useEffect } from 'react';
import { GuideMeLogo } from './GuideMeLogo.jsx';
import { getUIString } from '../i18n/ui-strings.js';

/* ─────────────────────────────────────────────────────────────────
   Context Menu — shown on right-click on the GuideMe button.
   Options: Close | Go to Extension
───────────────────────────────────────────────────────────────── */
function ContextMenu({ position, onClose, onGoToExtension, language = 'km' }) {
  return (
    <div
      className="fixed z-[1000000] bg-white dark:bg-[#1e1e2e] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.15),0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.6)] border border-gray-100 dark:border-[#2a2a3c] overflow-hidden min-w-[160px]"
      style={{ top: position.y, left: position.x }}
    >
      <button
        type="button"
        onClick={onClose}
        className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer font-medium"
      >
        {getUIString('close', language)}
      </button>
      <button
        type="button"
        onClick={onGoToExtension}
        className="w-full text-left px-4 py-2.5 text-sm text-white bg-purple-600 hover:bg-purple-700 transition-colors cursor-pointer font-semibold"
      >
        {getUIString('goToExtension', language)}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   FloatingAssistantButton — the "Ask GuideMe" fixed button.
   Behavior (matching prototype):
   - Left-click: toggles the floating prompt widget open/close
   - Right-click: shows context menu with Close / Go to Extension
   - Draggable to any screen position
───────────────────────────────────────────────────────────────── */
export function FloatingAssistantButton({
  onClick,
  isActive = true,
  isOpen = false,
  language = 'km',
  tooltipText = 'Ask GuideMe • Drag to move',
}) {
  const [customPosition, setCustomPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const dragRef = useRef({ startX: 0, startY: 0, initialLeft: 0, initialTop: 0, hasMoved: false });
  const buttonContainerRef = useRef(null);

  // Close context menu when clicking elsewhere
  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside, { once: true });
    return () => window.removeEventListener('click', handleClickOutside);
  }, [contextMenu]);

  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const el = buttonContainerRef.current;
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

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const { startX, startY, initialLeft, initialTop } = dragRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      dragRef.current.hasMoved = true;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const size = 52;

    const newLeft = Math.max(12, Math.min(initialLeft + deltaX, vw - size - 12));
    const newTop = Math.max(12, Math.min(initialTop + deltaY, vh - size - 12));

    setCustomPosition({ top: newTop, left: newLeft });
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    const hadMoved = dragRef.current.hasMoved;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (!hadMoved && onClick) {
      onClick();
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuWidth = 160;
    const menuHeight = 90;
    const x = Math.min(e.clientX, vw - menuWidth - 8);
    const y = Math.min(e.clientY, vh - menuHeight - 8);
    setContextMenu({ x, y });
  };

  const positionStyle = customPosition
    ? { top: `${customPosition.top}px`, left: `${customPosition.left}px`, bottom: 'auto', right: 'auto' }
    : { bottom: '24px', right: '24px' };

  return (
    <>
      <div
        ref={buttonContainerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={handleContextMenu}
        style={positionStyle}
        className={`fixed z-[999998] flex flex-col items-center gap-1 pointer-events-auto select-none ${
          isDragging ? 'transition-none cursor-grabbing' : 'transition-all duration-200 cursor-grab'
        }`}
      >
        {/* Black rounded-square button with white hand icon */}
        <button
          type="button"
          title={tooltipText}
          aria-label="Toggle AI Live Coach"
          className={`w-[52px] h-[52px] rounded-[14px] flex items-center justify-center relative p-0 overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.35),0_2px_8px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.45),0_4px_12px_rgba(0,0,0,0.25)] transition-all duration-200 ${
            isDragging
              ? 'scale-110 cursor-grabbing'
              : 'hover:scale-105 cursor-grab'
          }`}
        >
          <GuideMeLogo size={52} />

          {/* Online status dot */}
          {isActive && (
            <span className="absolute top-[3px] right-[3px] w-2.5 h-2.5 rounded-full bg-emerald-500 border-[2px] border-white shadow-sm" />
          )}
        </button>

        {/* "Ask GuideMe" label below button */}
        <div className="text-center pointer-events-none">
          <div className="text-[10px] font-bold text-gray-800 dark:text-zinc-200 leading-tight">
            {getUIString('ask', language)}
          </div>
          <div className="text-[10px] font-bold text-gray-800 dark:text-zinc-200 leading-tight">
            {getUIString('appName', language)}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          position={contextMenu}
          language={language}
          onClose={() => {
            setContextMenu(null);
          }}
          onGoToExtension={() => {
            setContextMenu(null);
            try {
              chrome?.runtime?.sendMessage({ action: 'OPEN_POPUP' });
            } catch {
              // fallback
            }
          }}
        />
      )}
    </>
  );
}
