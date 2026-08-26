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

  const style = useMemo(() => {
    // Unanchored Center Modal Fallback or explicit center placement
    if (!targetBoundingBox || placement === 'center' || typeof window === 'undefined') {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 999995,
        pointerEvents: 'auto',
      };
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { top, left, bottom, right, width, height } = targetBoundingBox;

    let computedPlacement = placement;

    // Auto-detect optimal placement (allow space for target callout indicator pill)
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
      position: 'fixed',
      top: `${calculatedTop}px`,
      left: `${calculatedLeft}px`,
      zIndex: 999995,
      pointerEvents: 'auto',
      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    };
  }, [targetBoundingBox, placement]);

  return (
    <div className="guideme-tooltip-wrapper" style={style}>
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
