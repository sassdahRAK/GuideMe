import React from 'react';

export function ProgressBar({ currentStepIndex, totalSteps }) {
  if (!totalSteps || totalSteps <= 1) return null;

  const percentage = Math.round(((currentStepIndex + 1) / totalSteps) * 100);

  return (
    <div className="w-full mt-3">
      <div className="flex justify-between items-center text-[11px] text-gray-500 dark:text-zinc-400 mb-1.5 font-semibold">
        {/* Step counter pill — purple accent */}
        <span className="bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 px-2 py-0.5 rounded text-[10px] tracking-wider font-bold">
          STEP {currentStepIndex + 1} OF {totalSteps}
        </span>
        <span className="text-gray-500 dark:text-zinc-400">{percentage}%</span>
      </div>

      {/* Progress track — gray background, purple fill */}
      <div className="w-full h-[5px] bg-gray-200 dark:bg-[#2a2a3c] rounded-full overflow-hidden">
        <div
          className="h-full bg-purple-600 transition-all duration-300 ease-out shadow-[0_0_6px_rgba(147,51,234,0.4)]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
