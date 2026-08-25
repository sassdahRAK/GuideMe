import React, { useState } from 'react';
import { Spotlight } from './Spotlight.jsx';
import { Tooltip } from './Tooltip.jsx';
import { FloatingAssistantButton } from './FloatingAssistantButton.jsx';

/**
 * Root React Tutorial Overlay rendering engine state snapshot.
 */
export function TutorialOverlay({
  state,
  onNext,
  onPrev,
  onSkip,
  onClose,
  onLanguageChange,
  onReplayAudio,
  onToggleLauncher,
}) {
  const [rating, setRating] = useState(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const isKhmer = (state?.language || 'km') === 'km';

  if (!state || !state.isActive) {
    if (state?.isCompleted) {
      return (
        <div
          className="guideme-completion-modal"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 17, 23, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            fontFamily: isKhmer
              ? "'Kantumruy Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          <div
            style={{
              backgroundColor: '#12141a',
              border: '1px solid #2a2f3b',
              borderRadius: '16px',
              padding: '32px 28px',
              maxWidth: '430px',
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 30px rgba(245, 158, 11, 0.15)',
              animation: 'guideme-card-pop 0.25s ease-out',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                border: '2px solid #f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                margin: '0 auto 16px auto',
                boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)',
              }}
            >
              🎉
            </div>
            <h3 style={{ margin: '0 0 8px 0', color: '#ffffff', fontSize: '20px', fontWeight: 800 }}>
              {isKhmer ? 'មេរៀនត្រូវបានបញ្ចប់!' : 'Walkthrough Complete!'}
            </h3>
            <p style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              {isKhmer ? (
                <>
                  អ្នកបានបញ្ចប់ការណែនាំ <strong style={{ color: '#f59e0b' }}>{state?.tutorial?.name || 'GuideMe Walkthrough'}</strong> ដោយជោគជ័យ។
                </>
              ) : (
                <>
                  You have successfully completed <strong style={{ color: '#f59e0b' }}>{state?.tutorial?.name || 'this walkthrough'}</strong>.
                </>
              )}
            </p>

            {/* Survey / Feedback Widget */}
            <div
              style={{
                backgroundColor: '#181b22',
                border: '1px solid #2a2f3b',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '20px',
              }}
            >
              {!feedbackSubmitted ? (
                <>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', marginBottom: '10px' }}>
                    {isKhmer
                      ? 'តើការណែនាំនេះមានប្រយោជន៍ដែរឬទេ?'
                      : 'Was this guidance helpful?'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setRating('helpful');
                        setFeedbackSubmitted(true);
                      }}
                      style={{
                        backgroundColor: '#262b35',
                        border: '1px solid #3e4556',
                        color: '#ffffff',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#f59e0b';
                        e.currentTarget.style.color = '#f59e0b';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#3e4556';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                    >
                      👍 {isKhmer ? 'មានប្រយោជន៍' : 'Helpful'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRating('not_helpful');
                        setFeedbackSubmitted(true);
                      }}
                      style={{
                        backgroundColor: '#262b35',
                        border: '1px solid #3e4556',
                        color: '#ffffff',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#94a3b8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#3e4556';
                      }}
                    >
                      👎 {isKhmer ? 'ត្រូវការកែលម្អ' : 'Needs Work'}
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>
                  ✨ {isKhmer ? 'អរគុណសម្រាប់ការផ្ដល់មតិយោបល់!' : 'Thank you for your feedback!'}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                color: '#ffffff',
                padding: '11px 24px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0px)')}
            >
              {isKhmer ? 'រួចរាល់ / Done' : 'Done'}
            </button>
          </div>
        </div>
      );
    }
    return (
      <FloatingAssistantButton
        onClick={onToggleLauncher || onClose}
        isActive={true}
        isOpen={false}
      />
    );
  }

  const { actionPayload, boundingBox, currentStepIndex, totalSteps, isFirstStep, isLastStep, language, stepBadgeText, isPlayingAudio } = state;

  return (
    <div className="guideme-root-overlay">
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

      {/* 3. Floating Assistant Launcher Bubble (Fixed at bottom right) */}
      <FloatingAssistantButton
        onClick={onToggleLauncher || onClose}
        isActive={true}
        isOpen={true}
      />
    </div>
  );
}
