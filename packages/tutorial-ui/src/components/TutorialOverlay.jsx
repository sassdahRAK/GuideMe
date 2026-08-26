import React, { useState } from 'react';
import { FiAward, FiThumbsUp, FiThumbsDown, FiCheckCircle } from 'react-icons/fi';
import { Spotlight } from './Spotlight.jsx';
import { Tooltip } from './Tooltip.jsx';
import { FloatingAssistantButton } from './FloatingAssistantButton.jsx';
import { FloatingPromptWidget } from './FloatingPromptWidget.jsx';

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

  const isKhmer = (state?.language || 'km') === 'km';

  if (!state || !state.isActive) {
    if (state?.isCompleted) {
      return (
        <div
          className={`fixed inset-0 w-screen h-screen bg-black/85 backdrop-blur-sm flex items-center justify-center z-[999999] pointer-events-auto ${
            isKhmer ? 'font-kantumruy' : 'font-sans'
          }`}
        >
          <div className="bg-[#12141a] border border-[#2a2f3b] rounded-2xl p-7 sm:p-8 max-w-[430px] w-[90%] text-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85),0_0_30px_rgba(245,158,11,0.15)] animate-[guideme-card-pop_0.25s_ease-out]">
            {/* Completion Badge (Zero Emojis, uses React Icons) */}
            <div className="w-16 h-16 rounded-full bg-amber-500/15 border-2 border-amber-500 flex items-center justify-center mx-auto mb-4 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              <FiAward className="w-8 h-8 stroke-[2.2]" />
            </div>

            <h3 className="m-0 mb-2 text-white text-xl font-extrabold">
              {isKhmer ? 'មេរៀនត្រូវបានបញ្ចប់!' : 'Walkthrough Complete!'}
            </h3>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed m-0 mb-5">
              {isKhmer ? (
                <>
                  អ្នកបានបញ្ចប់ការណែនាំ <strong className="text-amber-400">{state?.tutorial?.name || 'GuideMe Walkthrough'}</strong> ដោយជោគជ័យ។
                </>
              ) : (
                <>
                  You have successfully completed <strong className="text-amber-400">{state?.tutorial?.name || 'this walkthrough'}</strong>.
                </>
              )}
            </p>

            {/* Survey / Feedback Widget */}
            <div className="bg-[#181b22] border border-[#2a2f3b] rounded-xl p-3.5 mb-5">
              {!feedbackSubmitted ? (
                <>
                  <div className="text-xs font-semibold text-slate-100 mb-2.5">
                    {isKhmer
                      ? 'តើការណែនាំនេះមានប្រយោជន៍ដែរឬទេ?'
                      : 'Was this guidance helpful?'}
                  </div>
                  <div className="flex justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setRating('helpful');
                        setFeedbackSubmitted(true);
                      }}
                      className="bg-[#262b35] border border-[#3e4556] text-white hover:border-amber-500 hover:text-amber-400 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors duration-150"
                    >
                      <FiThumbsUp className="w-3.5 h-3.5" />
                      <span>{isKhmer ? 'មានប្រយោជន៍' : 'Helpful'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRating('not_helpful');
                        setFeedbackSubmitted(true);
                      }}
                      className="bg-[#262b35] border border-[#3e4556] text-white hover:border-slate-400 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors duration-150"
                    >
                      <FiThumbsDown className="w-3.5 h-3.5" />
                      <span>{isKhmer ? 'ត្រូវការកែលម្អ' : 'Needs Work'}</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-xs text-emerald-400 font-semibold flex items-center justify-center gap-1.5">
                  <FiCheckCircle className="w-4 h-4" />
                  <span>{isKhmer ? 'អរគុណសម្រាប់ការផ្ដល់មតិយោបល់!' : 'Thank you for your feedback!'}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-extrabold py-3 px-6 rounded-xl text-sm cursor-pointer shadow-[0_4px_14px_rgba(245,158,11,0.35)] hover:-translate-y-0.5 transition-all duration-150"
            >
              {isKhmer ? 'រួចរាល់ / Done' : 'Done'}
            </button>
          </div>
        </div>
      );
    }

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

  const { actionPayload, boundingBox, currentStepIndex, totalSteps, isFirstStep, isLastStep, language, stepBadgeText, isPlayingAudio } = state;

  return (
    <div className="guideme-root-overlay pointer-events-none">
      {/* 1. Target Element Spotlight & Pointer Indicator Pill */}
      <Spotlight
        targetBoundingBox={boundingBox}
        actionText={actionPayload?.actionText || (isKhmer ? 'ចុចទីនេះ' : 'CLICK HERE')}
        showPointer={actionPayload?.type !== 'modal' && Boolean(boundingBox)}
      />

      {/* 2. Floating AI Live Coach Card */}
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

      {/* 3. Floating Assistant Launcher Bubble */}
      <FloatingAssistantButton
        onClick={onToggleLauncher || onClose}
        isActive={true}
        isOpen={true}
      />
    </div>
  );
}
