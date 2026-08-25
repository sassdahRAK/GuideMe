import React from 'react';

/**
 * Step progress bar indicator.
 */
export function ProgressBar({ currentStepIndex, totalSteps }) {
  if (!totalSteps || totalSteps <= 1) return null;

  const percentage = Math.round(((currentStepIndex + 1) / totalSteps) * 100);

  return (
    <div className="guideme-progress-container" style={{ width: '100%', marginTop: '12px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: '#94a3b8',
          marginBottom: '6px',
          fontWeight: 600,
        }}
      >
        <span
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            letterSpacing: '0.04em',
          }}
        >
          STEP {currentStepIndex + 1} OF {totalSteps}
        </span>
        <span style={{ color: '#cbd5e1' }}>{percentage}%</span>
      </div>
      <div
        style={{
          width: '100%',
          height: '5px',
          backgroundColor: '#262b35',
          borderRadius: '999px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: '#f59e0b',
            transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: '0 0 8px rgba(245, 158, 11, 0.5)',
          }}
        />
      </div>
    </div>
  );
}
