import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StepCard } from './StepCard.jsx';

const VIEWPORT_MARGIN = 16;
const DEFAULT_CARD_SIZE = Object.freeze({ width: 430, height: 240 });

function getPlacementPosition(placement, target, card, gap) {
  switch (placement) {
    case 'top':
      return { top: target.top - card.height - gap, left: target.left + target.width / 2 - card.width / 2 };
    case 'left':
      return { top: target.top + target.height / 2 - card.height / 2, left: target.left - card.width - gap };
    case 'right':
      return { top: target.top + target.height / 2 - card.height / 2, left: target.right + gap };
    case 'bottom':
    default:
      return { top: target.bottom + gap, left: target.left + target.width / 2 - card.width / 2 };
  }
}

function getOverflow(position, card, viewport) {
  return Math.max(0, VIEWPORT_MARGIN - position.left)
    + Math.max(0, position.left + card.width - (viewport.width - VIEWPORT_MARGIN))
    + Math.max(0, VIEWPORT_MARGIN - position.top)
    + Math.max(0, position.top + card.height - (viewport.height - VIEWPORT_MARGIN));
}

export function Tooltip({
  targetBoundingBox,
  placement = 'bottom',
  title,
  content,
  subtitle,
  coachTitle,
  audioStatusText,
  language = 'km',
  stepBadgeText,
  currentStepIndex,
  totalSteps,
  isFirstStep,
  isLastStep,
  canSkip,
  isPlayingAudio,
  onLanguageChange,
  onNext,
  onPrev,
  onSkip,
  onClose,
  onReplayAudio,
}) {
  const [cardSize, setCardSize] = useState(DEFAULT_CARD_SIZE);

  const [customPosition, setCustomPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  // Measure the rendered card instead of assuming a fixed height. Khmer copy,
  // browser zoom, and narrow viewports can all change its size.
  useEffect(() => {
    const card = containerRef.current;
    if (!card || typeof ResizeObserver === 'undefined') return undefined;

    const updateSize = () => {
      const { width, height } = card.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setCardSize((previous) => (
          previous.width === width && previous.height === height ? previous : { width, height }
        ));
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  const defaultPositionStyle = useMemo(() => {
    const viewport = typeof window !== 'undefined' ? { width: window.innerWidth, height: window.innerHeight } : { width: 1024, height: 768 };
    const cardW = cardSize.width || 410;
    const cardH = cardSize.height || 240;

    // Unanchored Floating Fallback (modal, missing target, or offscreen target)
    // Placed in the top-right corner where it remains visible and never blocked by centered PiP/companion windows.
    const fallbackLeft = Math.max(VIEWPORT_MARGIN, viewport.width - cardW - 32);
    const fallbackTop = 80;

    if (!targetBoundingBox || placement === 'center' || typeof window === 'undefined') {
      return {
        top: `${fallbackTop}px`,
        left: `${fallbackLeft}px`,
        transform: 'none',
      };
    }

    const { top, left, bottom, right, width, height } = targetBoundingBox;
    const target = { top, left, bottom, right, width, height };

    // Keep the card clear of the spotlight's connector and label while still
    // anchoring it to the target's real viewport rect.
    const targetGap = 61;
    const isOffscreen = bottom < 0 || top > viewport.height || right < 0 || left > viewport.width;
    if (isOffscreen) {
      return {
        top: `${fallbackTop}px`,
        left: `${fallbackLeft}px`,
        transform: 'none',
      };
    }

    const preferred = placement === 'auto' ? 'bottom' : placement;
    const candidates = [...new Set([preferred, 'bottom', 'top', 'right', 'left'])];
    const best = candidates
      .map((candidate) => {
        const position = getPlacementPosition(candidate, target, cardSize, targetGap);
        return { position, overflow: getOverflow(position, cardSize, viewport) };
      })
      .sort((a, b) => a.overflow - b.overflow)[0];

    // Clamp only after choosing the side with the least collision. This avoids
    // a card that is visible but no longer points near its highlighted target.
    const calculatedLeft = Math.max(
      VIEWPORT_MARGIN,
      Math.min(best.position.left, viewport.width - cardSize.width - VIEWPORT_MARGIN)
    );
    const calculatedTop = Math.max(
      VIEWPORT_MARGIN,
      Math.min(best.position.top, viewport.height - cardSize.height - VIEWPORT_MARGIN)
    );

    return {
      top: `${calculatedTop}px`,
      left: `${calculatedLeft}px`,
      transform: 'none',
    };
  }, [targetBoundingBox, placement, cardSize]);

  const dragStartRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    initialLeft: 0,
    initialTop: 0,
    pointerId: null,
    target: null,
  });

  // Reset custom manual position when moving to a different step
  useEffect(() => {
    setCustomPosition(null);
  }, [currentStepIndex]);

  const handlePointerDown = (e) => {
    // Only primary mouse button or touch/pen
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (dragStartRef.current.active) return;
    if (e.target.closest('button, input, select, textarea, a, [role="radio"], [role="radiogroup"], [data-no-drag]')) return;

    const el = containerRef.current;
    if (!el) return;

    e.preventDefault();

    const rect = el.getBoundingClientRect();
    dragStartRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      initialLeft: rect.left,
      initialTop: rect.top,
      pointerId: e.pointerId,
      target: e.currentTarget,
    };

    setIsDragging(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Fallback to window listeners if pointer capture not supported
    }
  };

  const handlePointerMove = (e) => {
    if (!dragStartRef.current.active) return;

    const { startX, startY, initialLeft, initialTop } = dragStartRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    const cardEl = containerRef.current;
    const w = cardEl?.offsetWidth || cardSize.width || 410;
    const h = cardEl?.offsetHeight || cardSize.height || 240;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;

    const newLeft = Math.round(Math.max(12, Math.min(initialLeft + deltaX, vw - w - 12)));
    const newTop = Math.round(Math.max(12, Math.min(initialTop + deltaY, vh - h - 12)));

    setCustomPosition({ top: newTop, left: newLeft });
  };

  const handlePointerUp = (e) => {
    if (!dragStartRef.current.active) return;
    dragStartRef.current.active = false;
    setIsDragging(false);

    try {
      if (dragStartRef.current.target && dragStartRef.current.pointerId != null) {
        dragStartRef.current.target.releasePointerCapture(dragStartRef.current.pointerId);
      }
    } catch {
      // ignore
    }
  };

  // Safety net: Window listeners during drag ensure smooth movement across iframes / fast gestures
  useEffect(() => {
    if (!isDragging) return;

    const onWindowMove = (e) => handlePointerMove(e);
    const onWindowUp = (e) => handlePointerUp(e);

    window.addEventListener('pointermove', onWindowMove, true);
    window.addEventListener('pointerup', onWindowUp, true);
    window.addEventListener('pointercancel', onWindowUp, true);

    return () => {
      window.removeEventListener('pointermove', onWindowMove, true);
      window.removeEventListener('pointerup', onWindowUp, true);
      window.removeEventListener('pointercancel', onWindowUp, true);
    };
  }, [isDragging]);

  const handleResetPosition = () => {
    setCustomPosition(null);
  };

  const positionStyle = customPosition
    ? {
        top: `${customPosition.top}px`,
        left: `${customPosition.left}px`,
        transform: 'none',
      }
    : defaultPositionStyle;

  return (
    <div
      ref={containerRef}
      className={`fixed z-[999995] pointer-events-none ${
        isDragging
          ? 'transition-none select-none cursor-grabbing'
          : 'transition-all duration-200 ease-out'
      }`}
      style={positionStyle}
    >
      <StepCard
        title={title}
        content={content}
        subtitle={subtitle}
        coachTitle={coachTitle}
        audioStatusText={audioStatusText}
        language={language}
        stepBadgeText={stepBadgeText}
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        canSkip={canSkip}
        isPlayingAudio={isPlayingAudio}
        isDragging={isDragging}
        isCustomPositioned={Boolean(customPosition)}
        isGeneralStep={!targetBoundingBox || placement === 'center'}
        onResetPosition={handleResetPosition}
        onDragStart={handlePointerDown}
        onDragMove={handlePointerMove}
        onDragEnd={handlePointerUp}
        onLanguageChange={onLanguageChange}
        onNext={onNext}
        onPrev={onPrev}
        onSkip={onSkip}
        onClose={onClose}
        onReplayAudio={onReplayAudio}
      />
    </div>
  );
}
