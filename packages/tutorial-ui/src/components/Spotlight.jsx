import { FiMousePointer } from 'react-icons/fi';

export function Spotlight({
  targetBoundingBox,
  padding = 6,
  borderRadius = 8,
  actionText = 'ចុចទីនេះ / CLICK',
  showPointer = true,
}) {
  // Zero-dim policy: Do not dim or block the screen when no target is specified
  if (!targetBoundingBox) {
    return null;
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
      {/* ── Non-blocking connector line (Zero Dim) ── */}
      {showPointer && (
        <svg className="fixed inset-0 w-screen h-screen z-[999990] pointer-events-none transition-all duration-200">
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
        </svg>
      )}

      {/* ── High-Contrast Focus Ring & Radiant Pulse Glow (Zero Dim) ── */}
      <div
        className="fixed z-[999991] pointer-events-none transition-all duration-200 border-[3px] border-purple-600 dark:border-purple-400 shadow-[0_0_0_4px_rgba(147,51,234,0.30),0_0_24px_rgba(147,51,234,0.50),0_0_48px_rgba(147,51,234,0.30)] animate-[guideme-pulse_2s_infinite]"
        style={{
          top: `${y}px`,
          left: `${x}px`,
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: `${borderRadius + 2}px`,
        }}
      />

      {/* ── High-Visibility Action Indicator Pill (CLICK HERE) ── */}
      {showPointer && (
        <div
          className="fixed z-[999992] pointer-events-none -translate-x-1/2 inline-flex items-center gap-1.5 bg-purple-600 text-white px-4 py-1.5 rounded-full text-xs font-extrabold tracking-wide shadow-[0_10px_25px_-3px_rgba(147,51,234,0.55),0_4px_12px_rgba(0,0,0,0.3)] whitespace-nowrap transition-all duration-200 font-kantumruy"
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
