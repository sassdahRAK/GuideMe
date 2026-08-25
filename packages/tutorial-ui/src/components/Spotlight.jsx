import React from 'react';

/**
 * Fullscreen SVG Spotlight with cutout mask around target element.
 */
export function Spotlight({ targetBoundingBox, padding = 6, borderRadius = 6 }) {
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
          border: '2px solid #f59e0b',
          boxShadow: '0 0 0 4px rgba(245, 158, 11, 0.25), 0 0 24px rgba(245, 158, 11, 0.38)',
          zIndex: 999991,
          pointerEvents: 'none',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
    </>
  );
}
