import React, { useState } from 'react';
import { FiAward, FiThumbsUp, FiThumbsDown, FiCheckCircle } from 'react-icons/fi';
import { Spotlight } from './Spotlight.jsx';
import { Tooltip } from './Tooltip.jsx';
import { FloatingAssistantButton } from './FloatingAssistantButton.jsx';
import { FloatingPromptWidget } from './FloatingPromptWidget.jsx';
import { getUIString } from '../i18n/ui-strings.js';

export function TutorialOverlay({
  state,
  onNext,
  onPrev,
  onSkip,
  onClose,
  onLanguageChange,
  onReplayAudio,
  onToggleLauncher,
  onStartDynamicGuide,
  onStartTutorial,
  isPromptOpen,
  onTogglePrompt,
  availableTutorials = [],
}) {
  const [rating, setRating] = useState(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const lang = state?.language || 'km';
  const isKhmer = lang === 'km';

  if (!state || !state.isActive) {
    // ── Completion Screen ──
    if (state?.isCompleted) {
      return (
        <div
          className={`fixed inset-0 w-screen h-screen bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-[999999] pointer-events-auto ${
            isKhmer ? 'font-kantumruy' : 'font-sans'
          }`}
        >
          <div className="bg-white dark:bg-[#1e1e2e] border border-gray-200 dark:border-[#3f3f5a] rounded-2xl p-7 sm:p-8 max-w-[430px] w-[90%] text-center shadow-[0_24px_48px_rgba(0,0,0,0.15),0_4px_16px_rgba(147,51,234,0.08)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-[guideme-card-pop_0.25s_ease-out]">
            {/* Completion Badge */}
            <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-[#3b2d6e] border-2 border-purple-500 flex items-center justify-center mx-auto mb-4 text-purple-600 dark:text-purple-300 shadow-[0_0_20px_rgba(147,51,234,0.20)]">
              <FiAward className="w-8 h-8 stroke-[2.2]" />
            </div>

            <h3 className="m-0 mb-2 text-gray-900 dark:text-white text-xl font-extrabold">
              {getUIString('walkthroughComplete', lang)}
            </h3>

            <p className="text-gray-500 dark:text-zinc-400 text-xs sm:text-sm leading-relaxed m-0 mb-5">
              {isKhmer ? (
                <>
                  អ្នកបានបញ្ចប់ការណែនាំ{' '}
                  <strong className="text-purple-600 dark:text-purple-400">
                    {state?.tutorial?.name || 'GuideMe Walkthrough'}
                  </strong>{' '}
                  ដោយជោគជ័យ។
                </>
              ) : (
                <>
                  You have successfully completed{' '}
                  <strong className="text-purple-600 dark:text-purple-400">
                    {state?.tutorial?.name || 'this walkthrough'}
                  </strong>
                  .
                </>
              )}
            </p>

            {/* Feedback Widget */}
            <div className="bg-gray-50 dark:bg-[#252538] border border-gray-200 dark:border-[#3f3f5a] rounded-xl p-3.5 mb-5">
              {!feedbackSubmitted ? (
                <>
                  <div className="text-xs font-semibold text-gray-800 dark:text-zinc-200 mb-2.5">
                    {getUIString('wasHelpful', lang)}
                  </div>
                  <div className="flex justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => { setRating('helpful'); setFeedbackSubmitted(true); }}
                      className="bg-white dark:bg-[#1e1e2e] border border-gray-200 dark:border-[#3f3f5a] text-gray-700 dark:text-zinc-300 hover:border-purple-400 dark:hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-300 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors duration-150"
                    >
                      <FiThumbsUp className="w-3.5 h-3.5" />
                      <span>{getUIString('helpful', lang)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRating('not_helpful'); setFeedbackSubmitted(true); }}
                      className="bg-white dark:bg-[#1e1e2e] border border-gray-200 dark:border-[#3f3f5a] text-gray-700 dark:text-zinc-300 hover:border-gray-400 dark:hover:border-zinc-500 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors duration-150"
                    >
                      <FiThumbsDown className="w-3.5 h-3.5" />
                      <span>{getUIString('needsWork', lang)}</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1.5">
                  <FiCheckCircle className="w-4 h-4" />
                  <span>{getUIString('thankFeedback', lang)}</span>
                </div>
              )}
            </div>

            {/* Done CTA — purple */}
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-extrabold py-3 px-6 rounded-xl text-sm cursor-pointer shadow-[0_4px_14px_rgba(147,51,234,0.30)] hover:-translate-y-0.5 transition-all duration-150"
            >
              {getUIString('done', lang)}
            </button>
          </div>
        </div>
      );
    }

    // ── Idle: show floating prompt widget ──
    return (
      <FloatingPromptWidget
        isOpen={isPromptOpen}
        onToggleOpen={onTogglePrompt}
        onStartDynamicGuide={onStartDynamicGuide}
        onStartTutorial={onStartTutorial}
        availableTutorials={availableTutorials}
        language={state?.language || 'km'}
        onLanguageChange={onLanguageChange}
      />
    );
  }

  const {
    actionPayload,
    boundingBox,
    currentStepIndex,
    totalSteps,
    isFirstStep,
    isLastStep,
    language,
    stepBadgeText,
    isPlayingAudio,
  } = state;

  return (
    <div className="guideme-root-overlay pointer-events-none">
      {/* 1. Target Spotlight */}
      <Spotlight
        targetBoundingBox={boundingBox}
        actionText={actionPayload?.actionText || (isKhmer ? 'ចុចទីនេះ' : 'CLICK HERE')}
        showPointer={actionPayload?.type !== 'modal' && Boolean(boundingBox)}
      />

      {/* 2. Floating StepCard */}
      <Tooltip
        targetBoundingBox={boundingBox}
        placement={actionPayload?.placement || 'bottom'}
        title={actionPayload?.title || 'Step'}
        content={actionPayload?.content || ''}
        subtitle={actionPayload?.subtitle || ''}
        coachTitle={actionPayload?.coachTitle || 'GuideMe - AI Live Coach'}
        audioStatusText={actionPayload?.audioStatusText}
        language={language || 'km'}
        stepBadgeText={stepBadgeText}
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        canSkip={actionPayload?.canSkip ?? true}
        isPlayingAudio={isPlayingAudio}
        onLanguageChange={onLanguageChange}
        onNext={onNext}
        onPrev={onPrev}
        onSkip={onSkip}
        onClose={onClose}
        onReplayAudio={onReplayAudio}
      />

      {/* 3. Floating "Ask GuideMe" button */}
      <FloatingAssistantButton
        onClick={onToggleLauncher || onClose}
        isActive={true}
        isOpen={true}
      />
    </div>
  );
}
