import React, { useState, useRef } from 'react';
import { FiMessageSquare, FiCompass } from 'react-icons/fi';

export function FloatingAssistantButton({
  onClick,
  isActive = true,
  isOpen = false,
  tooltipText = 'AI Live Coach (រៀនចុច) • Drag to move',
}) {
  const [customPosition, setCustomPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialLeft: 0, initialTop: 0, hasMoved: false });
  const buttonContainerRef = useRef(null);

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
    const size = 54;

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

  const positionStyle = customPosition
    ? {
        top: `${customPosition.top}px`,
        left: `${customPosition.left}px`,
        bottom: 'auto',
        right: 'auto',
      }
    : {
        bottom: '24px',
        right: '24px',
      };

  return (
    <div
      ref={buttonContainerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={positionStyle}
      className={`fixed z-[999998] flex items-center gap-2.5 pointer-events-auto select-none ${
        isDragging ? 'transition-none cursor-grabbing' : 'transition-all duration-200 cursor-grab'
      }`}
    >
      <button
        type="button"
        title={tooltipText}
        aria-label="Toggle AI Live Coach"
        className={`w-[54px] h-[54px] rounded-full bg-gradient-to-br from-[#22293a] to-[#161a24] border-2 border-amber-500/45 shadow-[0_12px_28px_-4px_rgba(0,0,0,0.7),0_0_20px_rgba(245,158,11,0.3)] flex items-center justify-center relative p-0 text-amber-400 ${
          isDragging
            ? 'scale-110 border-amber-500 shadow-[0_16px_36px_-4px_rgba(0,0,0,0.9),0_0_32px_rgba(245,158,11,0.6)] cursor-grabbing'
            : 'transition-all duration-200 hover:scale-108 hover:border-amber-500 hover:shadow-[0_14px_32px_-4px_rgba(0,0,0,0.8),0_0_28px_rgba(245,158,11,0.5)] cursor-grab'
        }`}
      >
        {isOpen ? (
          <FiCompass className="w-6 h-6 stroke-[2.2]" />
        ) : (
          <FiMessageSquare className="w-6 h-6 stroke-[2.2]" />
        )}

        {isActive && (
          <span className="absolute top-[2px] right-[2px] w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#161a24] shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
        )}
      </button>
    </div>
  );
}

