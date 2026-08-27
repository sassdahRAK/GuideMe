import { FiMousePointer } from 'react-icons/fi';

export function Spotlight({
  targetBoundingBox,
  padding = 6,
  borderRadius = 8,
  actionText = 'ចុចទីនេះ / CLICK',
  showPointer = true,
}) {
  // Full-screen dim when no target is specified (modal mode)
  if (!targetBoundingBox) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-black/60 z-[999990] pointer-events-auto transition-all duration-300 backdrop-blur-[1px]" />
    );
  }

  const x = Math.max(0, targetBoundingBox.left - padding);
  const y = Math.max(0, targetBoundingBox.top - padding);
  const width = targetBoundingBox.width + padding * 2;
  const height = targetBoundingBox.height + padding * 2;
  const centerX = x + width / 2;

  // Calculate pointer line direction based on viewport position
  const isNearBottom = typeof window !== 'undefined' && y + height + 90 > window.innerHeight;
  const lineLength = 26;
  const lineStartY = isNearBottom ? y : y + height;
  const lineEndY = isNearBottom ? y - lineLength : y + height + lineLength;
  const pillTop = isNearBottom ? lineEndY - 34 : lineEndY;

  return (
    <>
      {/* ── SVG Backdrop Mask with Cutout ── */}
      <svg className="fixed inset-0 w-screen h-screen z-[999990] pointer-events-none transition-all duration-200">
        <defs>
          <mask id="guideme-spotlight-mask">
            {/* White = dimmed area */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black = transparent spotlight cutout */}
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

        {/* Semi-transparent overlay with spotlight cutout */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.62)"
          mask="url(#guideme-spotlight-mask)"
        />

        {/* Purple dotted connector line */}
        {showPointer && (
          <line
            x1={centerX}
            y1={lineStartY}
            x2={centerX}
            y2={lineEndY}
            stroke="#9333ea"
            strokeWidth="2.5"
            strokeDasharray="4 3"
            strokeLinecap="round"
            className="transition-all duration-200"
          />
        )}
      </svg>

      {/* ── Purple Focus Border & Glow Ring around target element ── */}
      <div
        className="fixed z-[999991] pointer-events-none transition-all duration-200 border-[2.5px] border-purple-600 shadow-[0_0_0_4px_rgba(147,51,234,0.20),0_0_20px_rgba(147,51,234,0.35)] animate-[guideme-pulse_2s_infinite]"
        style={{
          top: `${y}px`,
          left: `${x}px`,
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: `${borderRadius + 2}px`,
        }}
      />

      {/* ── Purple Action Indicator Pill (CLICK HERE) ── */}
      {showPointer && (
        <div
          className="fixed z-[999992] pointer-events-none -translate-x-1/2 inline-flex items-center gap-1.5 bg-purple-600 text-white px-4 py-1.5 rounded-full text-xs font-extrabold tracking-wide shadow-[0_8px_20px_-3px_rgba(147,51,234,0.45),0_4px_10px_rgba(0,0,0,0.2)] whitespace-nowrap transition-all duration-200 font-kantumruy"
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
