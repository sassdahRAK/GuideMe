import React from 'react';

/**
 * Fullscreen SVG Spotlight with cutout mask around target element
 * and vertical dotted connector to the amber target callout pill.
 */
export function Spotlight({
  targetBoundingBox,
  padding = 6,
  borderRadius = 8,
  actionText = 'ចុចទីនេះ / CLICK',
  showPointer = true,
}) {
  if (!targetBoundingBox) {
    // Dim entire screen if no target is active (modal mode)
    return (
      <div
        className="guideme-spotlight-backdrop"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 17, 23, 0.82)',
          zIndex: 999990,
          pointerEvents: 'auto',
          transition: 'all 0.3s ease',
        }}
      />
    );
  }

  const x = Math.max(0, targetBoundingBox.left - padding);
  const y = Math.max(0, targetBoundingBox.top - padding);
  const width = targetBoundingBox.width + padding * 2;
  const height = targetBoundingBox.height + padding * 2;
  const centerX = x + width / 2;

  // Calculate pointer line orientation (default below target, or above if close to bottom)
  const isNearBottom = typeof window !== 'undefined' && y + height + 90 > window.innerHeight;
  const lineLength = 26;
  const lineStartY = isNearBottom ? y : y + height;
  const lineEndY = isNearBottom ? y - lineLength : y + height + lineLength;
  const pillTop = isNearBottom ? lineEndY - 34 : lineEndY;

  return (
    <>
      {/* SVG Mask Overlay */}
      <svg
        className="guideme-spotlight-svg"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 999990,
          pointerEvents: 'none',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <defs>
          <mask id="guideme-spotlight-mask">
            {/* White covers entire viewport (dims it) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black cutout creates transparent hole */}
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              rx={borderRadius}
              ry={borderRadius}
              fill="black"
            />
          </mask>
        </defs>

        {/* Dimmed backdrop filled with SVG mask */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 17, 23, 0.82)"
          mask="url(#guideme-spotlight-mask)"
        />

        {/* Dotted Vertical Connector Line */}
        {showPointer && (
          <line
            x1={centerX}
            y1={lineStartY}
            x2={centerX}
            y2={lineEndY}
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeDasharray="4 3"
            strokeLinecap="round"
            style={{
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        )}
      </svg>

      {/* Target Focus Border Glow (10% Accent: Warm Amber-Orange) */}
      <div
        className="guideme-target-glow"
        style={{
          position: 'fixed',
          top: y,
          left: x,
          width,
          height,
          borderRadius: borderRadius + 2,
          border: '2.5px solid #f59e0b',
          boxShadow: '0 0 0 4px rgba(245, 158, 11, 0.25), 0 0 24px rgba(245, 158, 11, 0.45)',
          zIndex: 999991,
          pointerEvents: 'none',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />

      {/* Target Callout Indicator Pill */}
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
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#ffffff',
            padding: '7px 16px',
            borderRadius: '24px',
            fontSize: '12px',
            fontWeight: 800,
            letterSpacing: '0.02em',
            boxShadow: '0 8px 20px -3px rgba(245, 158, 11, 0.5), 0 4px 10px rgba(0, 0, 0, 0.4)',
            whiteSpace: 'nowrap',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Kantumruy Pro", Roboto, sans-serif',
            animation: 'guideme-pulse 2s ease-in-out infinite',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <span style={{ fontSize: '13px' }}>🕒</span>
          <span>{actionText}</span>
        </div>
      )}
    </>
  );
}
