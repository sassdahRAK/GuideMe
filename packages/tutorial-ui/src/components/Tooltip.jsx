import React, { useMemo, useState, useRef, useEffect } from 'react';
import { StepCard } from './StepCard.jsx';

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
  const cardWidth = 430;
  const cardEstimatedHeight = 240;
  const margin = 16;

  const [customPosition, setCustomPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialLeft: 0, initialTop: 0 });
  const containerRef = useRef(null);

  const defaultPositionStyle = useMemo(() => {
    // Unanchored Center Modal Fallback or explicit center placement
    if (!targetBoundingBox || placement === 'center' || typeof window === 'undefined') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { top, left, bottom, right, width, height } = targetBoundingBox;

    let computedPlacement = placement;
    const pointerOffset = 45;

    if (computedPlacement === 'auto' || computedPlacement === 'bottom') {
      if (bottom + pointerOffset + cardEstimatedHeight + margin > vh && top - cardEstimatedHeight - margin > 0) {
        computedPlacement = 'top';
      } else {
        computedPlacement = 'bottom';
      }
    }

    let calculatedTop = 0;
    let calculatedLeft = 0;

    switch (computedPlacement) {
      case 'top':
        calculatedTop = top - cardEstimatedHeight - margin;
        calculatedLeft = left + width / 2 - cardWidth / 2;
        break;

      case 'left':
        calculatedTop = top + height / 2 - cardEstimatedHeight / 2;
        calculatedLeft = left - cardWidth - margin;
        break;

      case 'right':
        calculatedTop = top + height / 2 - cardEstimatedHeight / 2;
        calculatedLeft = right + margin;
        break;

      case 'bottom':
      default:
        calculatedTop = bottom + pointerOffset + margin;
        calculatedLeft = left + width / 2 - cardWidth / 2;
        break;
    }

    // Keep within horizontal viewport bounds
    calculatedLeft = Math.max(16, Math.min(calculatedLeft, vw - cardWidth - 16));
    // Keep within vertical viewport bounds
    calculatedTop = Math.max(16, Math.min(calculatedTop, vh - cardEstimatedHeight - 16));

    return {
      top: `${calculatedTop}px`,
      left: `${calculatedLeft}px`,
      transform: 'none',
    };
  }, [targetBoundingBox, placement]);

  const handlePointerDown = (e) => {
    // Only primary mouse button or touch/pen
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('button, input, select, textarea, a, [role="radio"], [role="radiogroup"]')) return;

    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialLeft: rect.left,
      initialTop: rect.top,
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
    const { startX, startY, initialLeft, initialTop } = dragStartRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    const cardEl = containerRef.current;
    const w = cardEl?.offsetWidth || cardWidth;
    const h = cardEl?.offsetHeight || cardEstimatedHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const newLeft = Math.max(12, Math.min(initialLeft + deltaX, vw - w - 12));
    const newTop = Math.max(12, Math.min(initialTop + deltaY, vh - h - 12));

    setCustomPosition({ top: newTop, left: newLeft });
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

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

