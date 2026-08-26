
export function ProgressBar({ currentStepIndex, totalSteps }) {
  if (!totalSteps || totalSteps <= 1) return null;

  const percentage = Math.round(((currentStepIndex + 1) / totalSteps) * 100);

  return (
    <div className="w-full mt-3">
      <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1.5 font-semibold">
        <span className="bg-amber-500/15 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] tracking-wider font-bold">
          STEP {currentStepIndex + 1} OF {totalSteps}
        </span>
        <span className="text-slate-300">{percentage}%</span>
      </div>
      <div className="w-full h-[5px] bg-[#262b35] rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(245,158,11,0.5)]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
