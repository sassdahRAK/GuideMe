import { FiMousePointer } from 'react-icons/fi';

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
      <div className="fixed inset-0 w-screen h-screen bg-black/80 z-[999990] pointer-events-auto transition-all duration-300 backdrop-blur-[2px]" />
    );
  }

  const x = Math.max(0, targetBoundingBox.left - padding);
  const y = Math.max(0, targetBoundingBox.top - padding);
  const width = targetBoundingBox.width + padding * 2;
  const height = targetBoundingBox.height + padding * 2;
  const centerX = x + width / 2;

  // Calculate pointer line orientation
  const isNearBottom = typeof window !== 'undefined' && y + height + 90 > window.innerHeight;
  const lineLength = 26;
  const lineStartY = isNearBottom ? y : y + height;
  const lineEndY = isNearBottom ? y - lineLength : y + height + lineLength;
  const pillTop = isNearBottom ? lineEndY - 34 : lineEndY;

  return (
    <>
      {/* SVG Mask Overlay */}
      <svg className="fixed inset-0 w-screen h-screen z-[999990] pointer-events-none transition-all duration-200">
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
            className="transition-all duration-200"
          />
        )}
      </svg>

      {/* Target Focus Border Glow (10% Accent: Warm Amber-Orange) */}
      <div
        className="fixed z-[999991] pointer-events-none transition-all duration-200 border-[2.5px] border-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.25),0_0_24px_rgba(245,158,11,0.45)] animate-[guideme-pulse_2s_infinite]"
        style={{
          top: `${y}px`,
          left: `${x}px`,
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: `${borderRadius + 2}px`,
        }}
      />

      {/* Target Callout Indicator Pill (Zero Emojis, uses React Icons) */}
      {showPointer && (
        <div
          className="fixed z-[999992] pointer-events-none -translate-x-1/2 inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black px-4 py-1.5 rounded-full text-xs font-extrabold tracking-wide shadow-[0_8px_20px_-3px_rgba(245,158,11,0.5),0_4px_10px_rgba(0,0,0,0.4)] whitespace-nowrap transition-all duration-200 font-kantumruy"
          style={{
            top: `${pillTop}px`,
            left: `${centerX}px`,
          }}
        >
          <FiMousePointer className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{actionText}</span>
        </div>
      )}
    </>
  );
}
