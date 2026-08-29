import React from 'react';
import { FiX, FiVolume2, FiRotateCcw, FiSkipForward } from 'react-icons/fi';
import { GuideMeLogo } from './GuideMeLogo.jsx';
import { getUIString } from '../i18n/ui-strings.js';

/* ─── Khmer numeral converter ─── */
function toKhmerNumber(num) {
  const khmerDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(num).replace(/[0-9]/g, (d) => khmerDigits[d]);
}

/* ─── Language Toggle Pill ─── */
function LangPill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all duration-150 cursor-pointer border-0 ${
        active
          ? 'bg-purple-600 text-white shadow-sm'
          : 'bg-gray-100 dark:bg-[#2a2a3c] text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-[#32324a]'
      }`}
    >
      {label}
    </button>
  );
}

export function StepCard({
  title,
  content,
  subtitle,
  coachTitle = 'GuideMe - AI Live Coach',
  audioStatusText,
  language = 'km',
  currentStepIndex = 0,
  totalSteps = 1,
  isFirstStep = false,
  isLastStep = false,
  canSkip = true,
  isPlayingAudio = true,
  isDragging = false,
  isCustomPositioned = false,
  isGeneralStep = false,
  onDragStart,
  onDragMove,
  onDragEnd,
  onLanguageChange,
  onNext,
  onPrev,
  onSkip,
  onClose,
  onReplayAudio,
}) {
  const lang = language || 'km';
  const isKhmer = lang === 'km';
  const stepNumber = currentStepIndex + 1;

  // "STEP 1 OF 3" — always English label for scannability
  const stepLabel = `STEP ${stepNumber} OF ${totalSteps}`;
  // Right-side step badge in Khmer or English
  const stepBadge = isKhmer
    ? `ជំហានទី ${toKhmerNumber(stepNumber)}/${toKhmerNumber(totalSteps)}`
    : `Step ${stepNumber} / ${totalSteps}`;

  const percentage = totalSteps > 1 ? Math.round((stepNumber / totalSteps) * 100) : 100;

  const audioText = audioStatusText || (isKhmer ? 'ការណែនាំជាសំឡេង (Voice Guidance)' : 'Voice Guidance');

  // Wrap content in quotes if not already
  const displayContent = content
    ? content.startsWith('"') || content.startsWith('"')
      ? content
      : `"${content}"`
    : '';

  return (
    <div
      className={`pointer-events-auto bg-white dark:bg-[#1e1e2e] text-gray-900 dark:text-zinc-100 rounded-2xl border border-gray-200 dark:border-[#3f3f5a] w-[430px] max-w-[94vw] box-border overflow-hidden shadow-[0_20px_50px_-10px_rgba(0,0,0,0.22),0_0_0_1px_rgba(147,51,234,0.15),0_8px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.75),0_0_0_1px_rgba(147,51,234,0.3)] animate-[guideme-card-pop_0.25s_cubic-bezier(0.16,1,0.3,1)] ${
        isDragging ? 'scale-[1.01]' : ''
      } ${isKhmer ? 'font-kantumruy' : 'font-sans'}`}
    >
      {/* ── Header ── */}
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        className={`px-3.5 py-2.5 flex items-center gap-2 border-b border-gray-100 dark:border-[#2a2a3c] select-none cursor-grab active:cursor-grabbing ${
          isDragging ? 'cursor-grabbing bg-gray-50 dark:bg-[#252538]' : ''
        }`}
      >
        {/* Logo badge */}
        <div className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
          <GuideMeLogo size={28} />
        </div>

        {/* Title + subtitle */}
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-bold text-gray-900 dark:text-zinc-100 leading-tight truncate">
            {coachTitle}
          </div>
          {title && title !== coachTitle && (
            <div className="text-[10.5px] text-gray-400 dark:text-zinc-500 truncate">{title}</div>
          )}
        </div>

        {/* Online dot */}
        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] shrink-0 animate-pulse" />

        {/* Language pills */}
        <div className="flex gap-1 shrink-0">
          <LangPill label="KH" active={isKhmer} onClick={() => onLanguageChange?.('km')} />
          <LangPill label="EN" active={!isKhmer} onClick={() => onLanguageChange?.('en')} />
        </div>

        {/* Step badge */}
        <span className="bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 px-2 py-0.5 rounded-full text-[10.5px] font-bold whitespace-nowrap shrink-0">
          {stepBadge}
        </span>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tutorial"
          className="text-gray-400 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-[#2a2a3c] p-1 rounded-lg transition-colors duration-150 cursor-pointer flex items-center justify-center border-0 bg-transparent shrink-0"
        >
          <FiX className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="p-4">
        {/* Audio narration bar */}
        <div className="flex items-center gap-2.5 mb-3.5">
          <FiVolume2 className="w-4 h-4 text-purple-500 dark:text-purple-400 shrink-0" />
          <span className="flex-1 text-[12px] text-gray-600 dark:text-zinc-300 font-medium truncate">
            {audioText}
          </span>
          {/* Animated equalizer bars */}
          <div className="flex items-end gap-[2.5px] h-4 shrink-0">
            {[0.55, 1, 0.4, 0.75, 0.5, 0.85, 0.35].map((ratio, i) => (
              <span
                key={i}
                className="inline-block w-[2.5px] bg-purple-500 dark:bg-purple-400 rounded-full"
                style={{
                  height: isPlayingAudio ? '100%' : `${ratio * 100}%`,
                  animation: isPlayingAudio
                    ? `guideme-wave 0.7s ease-in-out infinite alternate ${i * 0.12}s`
                    : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* Main instruction content */}
        <p className="text-[14px] font-bold leading-snug text-gray-900 dark:text-zinc-100 mb-1 m-0">
          {displayContent}
        </p>
        {subtitle && (
          <p className="text-[11.5px] text-gray-500 dark:text-zinc-400 italic leading-normal m-0 mb-3">
            {subtitle.startsWith('(') ? subtitle : `(${subtitle})`}
          </p>
        )}

        {/* Progress section */}
        {totalSteps > 1 && (
          <div className="mt-4 mb-1">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-extrabold tracking-widest text-purple-600 dark:text-purple-400 uppercase">
                {stepLabel}
              </span>
              <span className="text-[11px] font-semibold text-gray-400 dark:text-zinc-500">
                {percentage}%
              </span>
            </div>
            <div className="w-full h-[5px] bg-gray-200 dark:bg-[#2a2a3c] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-500 dark:from-purple-600 dark:to-violet-500 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(147,51,234,0.5)]"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 mt-4 pt-3.5 border-t border-gray-100 dark:border-[#2a2a3c]">
          {/* Replay */}
          <button
            type="button"
            onClick={onReplayAudio}
            title={getUIString('replayVoiceTooltip', lang)}
            className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400 hover:text-purple-600 dark:hover:text-purple-300 text-[12px] font-semibold cursor-pointer border-0 bg-transparent transition-colors px-0 py-0"
          >
            <FiRotateCcw className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>{getUIString('replayVoice', lang)}</span>
          </button>

          {/* Right side controls */}
          <div className="flex items-center gap-2">
            {/* Back — only shown if not first step */}
            {!isFirstStep && (
              <button
                type="button"
                onClick={onPrev}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#3f3f5a] text-[12px] font-semibold text-gray-600 dark:text-zinc-300 hover:border-purple-400 dark:hover:border-purple-500 hover:text-purple-700 dark:hover:text-purple-300 cursor-pointer bg-transparent transition-all duration-150"
              >
                {getUIString('back', lang)}
              </button>
            )}

            {/* Skip — circle icon button */}
            {canSkip && !isLastStep && (
              <button
                type="button"
                onClick={onSkip}
                title={getUIString('skip', lang)}
                aria-label={getUIString('skip', lang)}
                className="w-7 h-7 rounded-full border border-gray-200 dark:border-[#3f3f5a] text-gray-400 dark:text-zinc-500 hover:border-purple-400 dark:hover:border-purple-500 hover:text-purple-500 dark:hover:text-purple-400 flex items-center justify-center cursor-pointer bg-transparent transition-all duration-150"
              >
                <FiSkipForward className="w-3.5 h-3.5 stroke-[2]" />
              </button>
            )}

            {/* Primary CTA — Next / Finish */}
            <button
              type="button"
              onClick={onNext}
              className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-extrabold px-5 py-1.5 rounded-lg text-[13px] cursor-pointer shadow-[0_3px_10px_rgba(147,51,234,0.35)] hover:-translate-y-0.5 hover:shadow-[0_5px_14px_rgba(147,51,234,0.45)] transition-all duration-150 border-0"
            >
              {isLastStep ? getUIString('finish', lang) : getUIString('next', lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
