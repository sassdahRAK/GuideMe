import React from 'react';
import { FiMousePointer, FiAlertCircle } from 'react-icons/fi';

/**
 * Spotlight — Target element focus frame with vertical connector line
 * and interactive status pill ("ចុចទីនេះ" / "CLICK HERE").
 * Reacts visually to learner hesitation (amber pulse) and misclicks (red shake warning).
 */
export function Spotlight({
  targetBoundingBox,
  padding = 6,
  borderRadius = 10,
  actionText = 'ចុចទីនេះ',
  showPointer = true,
  alertState = 'normal', // 'normal' | 'hesitation' | 'misclick'
}) {
  const hasValidBox =
    targetBoundingBox &&
    (targetBoundingBox.width > 0 || targetBoundingBox.height > 0) &&
    !(targetBoundingBox.left === 0 && targetBoundingBox.top === 0 && targetBoundingBox.width <= 1);

  if (!hasValidBox) {
    return null;
  }

  const x = Math.max(0, targetBoundingBox.left - padding);
  const y = Math.max(0, targetBoundingBox.top - padding);
  const width = targetBoundingBox.width + padding * 2;
  const height = targetBoundingBox.height + padding * 2;
  const centerX = x + width / 2;

  // Calculate pointer line orientation (default below target, or above if close to bottom)
  const isNearBottom = typeof window !== 'undefined' && y + height + 90 > window.innerHeight;
  const lineLength = 24;
  const lineStartY = isNearBottom ? y : y + height;
  const lineEndY = isNearBottom ? y - lineLength : y + height + lineLength;
  const pillTop = isNearBottom ? lineEndY - 34 : lineEndY;

  const isMisclick = alertState === 'misclick';
  const isHesitation = alertState === 'hesitation';

  // Dynamic visual tokens based on learner state
  let borderColor = '#8b5cf6';
  let boxShadow = '0 0 0 4px rgba(139, 92, 246, 0.25), 0 0 24px rgba(139, 92, 246, 0.45)';
  let pillGradient = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';
  let pillShadow = '0 8px 22px -3px rgba(139, 92, 246, 0.55), 0 4px 10px rgba(0, 0, 0, 0.3)';
  let animation = 'guideme-pulse 2s ease-in-out infinite';

  if (isMisclick) {
    borderColor = '#ef4444';
    boxShadow = '0 0 0 6px rgba(239, 68, 68, 0.45), 0 0 32px rgba(239, 68, 68, 0.70)';
    pillGradient = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    pillShadow = '0 8px 25px -2px rgba(239, 68, 68, 0.65), 0 4px 12px rgba(0, 0, 0, 0.4)';
    animation = 'guideme-shake 0.45s ease-in-out';
  } else if (isHesitation) {
    borderColor = '#f59e0b';
    boxShadow = '0 0 0 6px rgba(245, 158, 11, 0.45), 0 0 30px rgba(245, 158, 11, 0.65)';
    pillGradient = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    pillShadow = '0 8px 22px -3px rgba(245, 158, 11, 0.60), 0 4px 10px rgba(0, 0, 0, 0.3)';
    animation = 'guideme-pulse 1s ease-in-out infinite';
  }

  return (
    <>
      {/* ── 1. Target Focus Border Glow ── */}
      <div
        className="guideme-target-glow"
        style={{
          position: 'fixed',
          top: `${y}px`,
          left: `${x}px`,
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: `${borderRadius}px`,
          border: `2.5px solid ${borderColor}`,
          boxShadow,
          zIndex: 999991,
          pointerEvents: 'none',
          animation,
          transition: 'border 0.2s ease, box-shadow 0.2s ease, all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />

      {/* ── 2. SVG Dotted Vertical Connector Line ── */}
      {showPointer && (
        <svg
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 999991,
            pointerEvents: 'none',
          }}
        >
          <line
            x1={centerX}
            y1={lineStartY}
            x2={centerX}
            y2={lineEndY}
            stroke={borderColor}
            strokeWidth="2.5"
            strokeDasharray="4 3"
            strokeLinecap="round"
            style={{
              transition: 'stroke 0.2s ease, all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </svg>
      )}

      {/* ── 3. Target Callout Indicator Pill ── */}
      {showPointer && (
        <div
          className="guideme-target-pill"
          style={{
            position: 'fixed',
            top: `${pillTop}px`,
            left: `${centerX}px`,
            transform: 'translateX(-50%)',
            zIndex: 999992,
            pointerEvents: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: pillGradient,
            color: '#ffffff',
            padding: '7px 16px',
            borderRadius: '24px',
            fontSize: '12.5px',
            fontWeight: 800,
            letterSpacing: '0.02em',
            boxShadow: pillShadow,
            whiteSpace: 'nowrap',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Kantumruy Pro", "Inter", Roboto, sans-serif',
            animation,
            transition: 'background 0.2s ease, box-shadow 0.2s ease, all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {isMisclick ? (
            <FiAlertCircle className="w-4 h-4 stroke-[2.5] text-white shrink-0 animate-bounce" />
          ) : (
            <FiMousePointer className="w-3.5 h-3.5 stroke-[2.5]" />
          )}
          <span>{actionText || 'ចុចទីនេះ'}</span>
        </div>
      )}
    </>
  );
}
