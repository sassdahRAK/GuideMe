import React from 'react';
import { Spotlight } from './Spotlight.jsx';
import { Tooltip } from './Tooltip.jsx';

/**
 * Root React Tutorial Overlay rendering engine state snapshot.
 */
export function TutorialOverlay({
  state,
  onNext,
  onPrev,
  onSkip,
  onClose,
}) {
  const [rating, setRating] = React.useState(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = React.useState(false);

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
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <div
            style={{
              backgroundColor: '#12141a',
              border: '1px solid #2a2f3b',
              borderRadius: '16px',
              padding: '32px 28px',
              maxWidth: '400px',
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 30px rgba(245, 158, 11, 0.15)',
              animation: 'guideme-fade-in 0.25s ease-out',
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
              Walkthrough Complete!
            </h3>
            <p style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              You've successfully completed <strong style={{ color: '#f59e0b' }}>{state?.tutorial?.name || 'this walkthrough'}</strong>.
            </p>

            {/* UC11: Survey / Feedback Widget */}
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
                    Was this guide helpful?
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    <button
                      onClick={() => {
                        setRating('helpful');
                        setFeedbackSubmitted(true);
                      }}
                      style={{
                        backgroundColor: '#262b35',
                        border: '1px solid #3e4556',
                        color: '#ffffff',
                        padding: '6px 16px',
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
                      👍 Helpful
                    </button>
                    <button
                      onClick={() => {
                        setRating('not_helpful');
                        setFeedbackSubmitted(true);
                      }}
                      style={{
                        backgroundColor: '#262b35',
                        border: '1px solid #3e4556',
                        color: '#ffffff',
                        padding: '6px 16px',
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
                      👎 Needs Work
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>
                  ✨ Thank you for your feedback!
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              style={{
                width: '100%',
                backgroundColor: '#f59e0b',
                border: 'none',
                color: '#000000',
                padding: '11px 24px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#d97706')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f59e0b')}
            >
              Done & Dismiss
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

  const { actionPayload, boundingBox, currentStepIndex, totalSteps, isFirstStep, isLastStep } = state;

  return (
    <div className="guideme-root-overlay">
      {/* 1. Backdrop & Spotlight Cutout */}
      <Spotlight targetBoundingBox={boundingBox} />

      {/* 2. Floating Anchored Tooltip */}
      <Tooltip
        targetBoundingBox={boundingBox}
        placement={actionPayload?.placement || 'bottom'}
        title={actionPayload?.title || 'Step'}
        content={actionPayload?.content || ''}
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        canSkip={actionPayload?.canSkip}
        onNext={onNext}
        onPrev={onPrev}
        onSkip={onSkip}
        onClose={onClose}
      />
    </div>
  );
}
