import React from 'react';
import { FiMousePointer } from 'react-icons/fi';

/**
 * Spotlight — Target element focus frame with vertical dotted connector line
 * and purple callout pill indicator ("ចុចទីនេះ" / "CLICK HERE").
 */
export function Spotlight({
  targetBoundingBox,
  padding = 6,
  borderRadius = 10,
  actionText = 'ចុចទីនេះ',
  showPointer = true,
}) {
  if (!targetBoundingBox) {
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

  return (
    <>
      {/* ── 1. Target Focus Border Glow (Brand Purple) ── */}
      <div
        className="guideme-target-glow"
        style={{
          position: 'fixed',
          top: `${y}px`,
          left: `${x}px`,
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: `${borderRadius}px`,
          border: '2.5px solid #8b5cf6',
          boxShadow: '0 0 0 4px rgba(139, 92, 246, 0.25), 0 0 24px rgba(139, 92, 246, 0.45)',
          zIndex: 999991,
          pointerEvents: 'none',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
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
            stroke="#8b5cf6"
            strokeWidth="2.5"
            strokeDasharray="4 3"
            strokeLinecap="round"
            style={{
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </svg>
      )}

      {/* ── 3. Target Callout Indicator Pill ("ចុចទីនេះ") ── */}
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
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            color: '#ffffff',
            padding: '7px 16px',
            borderRadius: '24px',
            fontSize: '12.5px',
            fontWeight: 800,
            letterSpacing: '0.02em',
            boxShadow: '0 8px 22px -3px rgba(139, 92, 246, 0.55), 0 4px 10px rgba(0, 0, 0, 0.3)',
            whiteSpace: 'nowrap',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Kantumruy Pro", "Inter", Roboto, sans-serif',
            animation: 'guideme-pulse 2s ease-in-out infinite',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <FiMousePointer className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{actionText || 'ចុចទីនេះ'}</span>
        </div>
      )}
    </>
  );
}
