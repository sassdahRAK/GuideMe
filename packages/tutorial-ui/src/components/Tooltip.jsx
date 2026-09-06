import React, { useState, useRef, useEffect, useCallback } from 'react';
import { computePosition, flip, shift, offset } from '@floating-ui/dom';
import { StepCard } from './StepCard.jsx';

/**
 * Tooltip — Collision-aware, auto-flipping step guidance overlay.
 * Uses @floating-ui/dom virtual reference positioning to guarantee tooltips
 * never clip the viewport or obscure the target element, even with multi-line Khmer text.
 */
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
  targetMissing = false,
  onRetry,
  onLanguageChange,
  onNext,
  onPrev,
  onSkip,
  onClose,
  onReplayAudio,
}) {
  const [coords, setCoords] = useState(null);
  const [customPosition, setCustomPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = useRef({ startX: 0, startY: 0, initialLeft: 0, initialTop: 0 });
  const containerRef = useRef(null);

  // Reset any manual drag position whenever navigating to a new step
  useEffect(() => {
    setCustomPosition(null);
  }, [currentStepIndex]);

  // Compute collision-free floating coordinates via Floating UI
  const hasValidBox =
    targetBoundingBox &&
    (targetBoundingBox.width > 0 || targetBoundingBox.height > 0) &&
    !(targetBoundingBox.left === 0 && targetBoundingBox.top === 0 && targetBoundingBox.width <= 1);

  const updatePosition = useCallback(() => {
    if (!hasValidBox || placement === 'center' || typeof window === 'undefined' || !containerRef.current) {
      return;
    }

    const virtualReference = {
      getBoundingClientRect() {
        return {
          x: targetBoundingBox.left,
          y: targetBoundingBox.top,
          top: targetBoundingBox.top,
          left: targetBoundingBox.left,
          bottom: targetBoundingBox.bottom,
          right: targetBoundingBox.right,
          width: targetBoundingBox.width,
          height: targetBoundingBox.height,
        };
      },
    };

    const requestedPlacement = placement === 'auto' ? 'bottom' : placement;

    computePosition(virtualReference, containerRef.current, {
      placement: requestedPlacement,
      middleware: [
        offset(({ placement: p }) => {
          // If placed below target, provide extra clearance for the spotlight pointer and callout pill
          return p.startsWith('bottom') ? 48 : 16;
        }),
        flip({
          fallbackPlacements: ['top', 'bottom', 'right', 'left'],
          padding: 16,
        }),
        shift({
          padding: 16,
        }),
      ],
    })
      .then(({ x, y }) => {
        setCoords({ x, y });
      })
      .catch(() => {
        // Suppress errors if element unmounted during async calculation
      });
  }, [targetBoundingBox, placement]);

  // Trigger position computation on target change, content change, and viewport resize/scroll
  useEffect(() => {
    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition, title, content, language]);

  // Pointer drag event handlers for user repositioning
  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('button, input, select, textarea, a, [role="radio"], [role="radiogroup"], [role="button"]')) return;

    const el = containerRef.current;
    if (!el) return;

    // Prevent default browser drag gestures or accidental text selection
    e.preventDefault();

    const rect = el.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialLeft = rect.left;
    const initialTop = rect.top;

    setIsDragging(true);

    const onPointerMove = (moveEvt) => {
      const deltaX = moveEvt.clientX - startX;
      const deltaY = moveEvt.clientY - startY;

      const cardEl = containerRef.current;
      const w = cardEl?.offsetWidth || 410;
      const h = cardEl?.offsetHeight || 240;
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 768;

      const newLeft = Math.max(12, Math.min(initialLeft + deltaX, vw - w - 12));
      const newTop = Math.max(12, Math.min(initialTop + deltaY, vh - h - 12));

      setCustomPosition({ top: newTop, left: newLeft });
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerUp, true);
    };

    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
  };

  const handleResetPosition = () => {
    setCustomPosition(null);
    updatePosition();
  };

  // Determine active styling coordinates
  const isCenter = !hasValidBox || placement === 'center' || typeof window === 'undefined';

  let positionStyle;
  // User manual drag takes absolute priority over automatic anchoring or centering
  if (customPosition) {
    positionStyle = {
      top: `${customPosition.top}px`,
      left: `${customPosition.left}px`,
      transform: 'none',
    };
  } else if (isCenter) {
    positionStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  } else if (coords) {
    positionStyle = {
      top: `${coords.y}px`,
      left: `${coords.x}px`,
      transform: 'none',
    };
  } else {
    // Initial deterministic synchronous position before first Floating UI cycle completes
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const initialLeft = Math.max(16, Math.min(targetBoundingBox.left + targetBoundingBox.width / 2 - 205, vw - 426));
    const initialTop = Math.max(16, targetBoundingBox.bottom + 48);
    positionStyle = {
      top: `${initialTop}px`,
      left: `${initialLeft}px`,
      transform: 'none',
    };
  }

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
        isGeneralStep={isCenter}
        targetMissing={targetMissing}
        onRetry={onRetry}
        onResetPosition={handleResetPosition}
        onDragStart={handlePointerDown}
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
