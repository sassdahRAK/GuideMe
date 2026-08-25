import React from 'react';
import { ProgressBar } from './ProgressBar.jsx';

/**
 * Step Content Card with controls.
 */
export function StepCard({
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
  return (
    <div
      className="guideme-step-card"
      style={{
        backgroundColor: '#12141a',
        color: '#f8fafc',
        borderRadius: '12px',
        padding: '18px',
        boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.7), 0 8px 16px -6px rgba(0, 0, 0, 0.6)',
        border: '1px solid #2a2f3b',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        width: '330px',
        maxWidth: '90vw',
        boxSizing: 'border-box',
      }}
    >
      {/* Header with Title & Close */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <h4
          style={{
            margin: 0,
            fontSize: '15px',
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h4>
        <button
          onClick={onClose}
          aria-label="Close tutorial"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: 1,
            padding: '2px 4px',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
        >
          ✕
        </button>
      </div>

      {/* Body Content */}
      <div
        style={{
          fontSize: '13px',
          lineHeight: '1.5',
          color: '#cbd5e1',
          marginBottom: '12px',
        }}
      >
        {content}
      </div>

      {/* Progress */}
      <ProgressBar currentStepIndex={currentStepIndex} totalSteps={totalSteps} />

      {/* Footer Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '14px',
          paddingTop: '12px',
          borderTop: '1px solid #2a2f3b',
        }}
      >
        <div>
          {!isFirstStep && (
            <button
              onClick={onPrev}
              style={{
                backgroundColor: '#262b35',
                border: '1px solid #3e4556',
                color: '#ffffff',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'background-color 0.15s ease',
              }}
            >
              Back
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {canSkip && !isLastStep && (
            <button
              onClick={onSkip}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#94a3b8',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Skip
            </button>
          )}

          <button
            onClick={onNext}
            style={{
              backgroundColor: '#f59e0b',
              border: 'none',
              color: '#000000',
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#d97706')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f59e0b')}
          >
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
