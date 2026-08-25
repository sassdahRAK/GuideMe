import React from 'react';

/**
 * Floating AI Assistant Launcher Button with Active Status Badge.
 */
export function FloatingAssistantButton({
  onClick,
  isActive = true,
  isOpen = false,
  tooltipText = 'AI Live Coach (រៀនចុច)',
}) {
  return (
    <div
      className="guideme-floating-launcher"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 999998,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      <button
        onClick={onClick}
        title={tooltipText}
        aria-label="Toggle AI Live Coach"
        style={{
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          backgroundColor: '#1a1f2c',
          background: 'linear-gradient(135deg, #22293a 0%, #161a24 100%)',
          border: '2px solid rgba(245, 158, 11, 0.45)',
          boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.7), 0 0 20px rgba(245, 158, 11, 0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          padding: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.borderColor = '#f59e0b';
          e.currentTarget.style.boxShadow = '0 14px 32px -4px rgba(0, 0, 0, 0.8), 0 0 28px rgba(245, 158, 11, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.45)';
          e.currentTarget.style.boxShadow = '0 12px 28px -4px rgba(0, 0, 0, 0.7), 0 0 20px rgba(245, 158, 11, 0.3)';
        }}
      >
        {/* Chat / Assistant Icon */}
        <span style={{ fontSize: '24px', lineHeight: 1 }}>
          {isOpen ? '🤖' : '💬'}
        </span>

        {/* Active Online Status Dot */}
        {isActive && (
          <span
            style={{
              position: 'absolute',
              top: '1px',
              right: '1px',
              width: '13px',
              height: '13px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              border: '2.5px solid #161a24',
              boxShadow: '0 0 8px rgba(16, 185, 129, 0.8)',
            }}
          />
        )}
      </button>
    </div>
  );
}
