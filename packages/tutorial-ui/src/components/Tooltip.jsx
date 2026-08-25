import React, { useMemo } from 'react';
import { StepCard } from './StepCard.jsx';

/**
 * Floating Tooltip anchored to element coordinates with automatic viewport boundary detection.
 */
export function Tooltip({
  targetBoundingBox,
  placement = 'bottom',
  title,
  content,
  currentStepIndex,
  totalSteps,
  isFirstStep,
  isLastStep,
  canSkip,
  onNext,
  onPrev,
  onSkip,
  onClose,
}) {
  const cardWidth = 320;
  const cardEstimatedHeight = 180;
  const margin = 12;

  const style = useMemo(() => {
    // Unanchored Center Modal Fallback
    if (!targetBoundingBox || typeof window === 'undefined') {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 999995,
      };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { top, left, bottom, right, width, height } = targetBoundingBox;

    let computedPlacement = placement;

    // Auto-detect optimal placement
    if (computedPlacement === 'auto' || computedPlacement === 'bottom') {
      if (bottom + cardEstimatedHeight + margin > vh && top - cardEstimatedHeight - margin > 0) {
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
        calculatedTop = bottom + margin;
        calculatedLeft = left + width / 2 - cardWidth / 2;
        break;
    }

    // Keep within horizontal viewport bounds
    calculatedLeft = Math.max(12, Math.min(calculatedLeft, vw - cardWidth - 12));
    // Keep within vertical viewport bounds
    calculatedTop = Math.max(12, Math.min(calculatedTop, vh - cardEstimatedHeight - 12));

    return {
      position: 'fixed',
      top: `${calculatedTop}px`,
      left: `${calculatedLeft}px`,
      zIndex: 999995,
      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    };
  }, [targetBoundingBox, placement]);

  return (
    <div className="guideme-tooltip-wrapper" style={style}>
      <StepCard
        title={title}
        content={content}
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        canSkip={canSkip}
        onNext={onNext}
        onPrev={onPrev}
        onSkip={onSkip}
        onClose={onClose}
      />
    </div>
  );
}
