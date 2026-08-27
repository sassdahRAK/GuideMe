import React from 'react';
import { FiX, FiVolume2, FiRotateCcw, FiRefreshCw } from 'react-icons/fi';
import { ProgressBar } from './ProgressBar.jsx';
import { LanguageToggle } from './LanguageToggle.jsx';
import { GuideMeLogo } from './GuideMeLogo.jsx';
import { getUIString } from '../i18n/ui-strings.js';

function toKhmerNumber(num) {
  const khmerDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(num).replace(/[0-9]/g, (d) => khmerDigits[d]);
}

export function StepCard({
  title,
  content,
  subtitle,
  coachTitle = 'GuideMe - AI Live Coach',
  audioStatusText,
  language = 'km',
  stepBadgeText,
  currentStepIndex = 0,
  totalSteps = 1,
  isFirstStep = false,
  isLastStep = false,
  canSkip = true,
  isPlayingAudio = true,
  isDragging = false,
  isCustomPositioned = false,
  onResetPosition,
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

  const defaultStepBadge = isKhmer
    ? `ជំហានទី ${toKhmerNumber(stepNumber)}/${toKhmerNumber(totalSteps)}`
    : `Step ${stepNumber}/${totalSteps}`;

  const badgeText = stepBadgeText || defaultStepBadge;

  const defaultAudioText = isKhmer
    ? 'កំពុងអានការណែនាំជាសំឡេង...'
    : 'Playing voice guidance...';

  const displayAudioText = audioStatusText || defaultAudioText;

  const handleReplay = () => {
    if (onReplayAudio) onReplayAudio();
  };

  return (
    <div
      className={`pointer-events-auto bg-white dark:bg-[#1e1e2e] text-gray-900 dark:text-zinc-100 rounded-2xl border border-gray-200 dark:border-[#3f3f5a] w-[430px] max-w-[94vw] box-border overflow-hidden animate-[guideme-card-pop_0.25s_cubic-bezier(0.16,1,0.3,1)] transition-all duration-200 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.4)] ${
        isDragging
          ? 'shadow-[0_24px_48px_-8px_rgba(147,51,234,0.25),0_0_20px_rgba(147,51,234,0.15)] scale-[1.01] border-purple-300 dark:border-purple-500'
          : ''
      } ${isKhmer ? 'font-kantumruy' : 'font-sans'}`}
    >
      {/* ── Header: Drag handle, Logo, Title, Language Toggle, Step Badge, Close ── */}
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        onDoubleClick={onResetPosition}
        title={getUIString('dragHandleTooltip', lang)}
        className={`bg-white dark:bg-[#1e1e2e] px-3.5 py-3 flex justify-between items-center border-b border-gray-100 dark:border-[#2a2a3c] gap-2 select-none cursor-grab active:cursor-grabbing transition-colors ${
          isDragging ? 'cursor-grabbing bg-gray-50 dark:bg-[#252538]' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* 6-dot drag grip */}
          <div
            className="flex flex-col gap-0.5 text-gray-300 dark:text-zinc-600 hover:text-purple-400 dark:hover:text-purple-400 p-0.5 cursor-grab active:cursor-grabbing shrink-0 transition-colors"
            aria-label="Drag Handle"
          >
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-current" />
              <span className="w-1 h-1 rounded-full bg-current" />
            </div>
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-current" />
              <span className="w-1 h-1 rounded-full bg-current" />
            </div>
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-current" />
              <span className="w-1 h-1 rounded-full bg-current" />
            </div>
          </div>

          {/* Logo */}
          <GuideMeLogo size={28} className="shrink-0" />

          <div className="min-w-0">
            <div className="text-[12.5px] font-bold text-gray-900 dark:text-zinc-100 leading-tight tracking-tight truncate flex items-center gap-1.5">
              <span>{coachTitle}</span>
              {isCustomPositioned && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onResetPosition) onResetPosition();
                  }}
                  title={getUIString('resetPosition', lang)}
                  className="text-[10px] text-purple-600 dark:text-purple-300 hover:text-purple-700 bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800/40 px-1.5 py-0.5 rounded font-normal flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <FiRefreshCw className="w-2.5 h-2.5" />
                  <span>{getUIString('snap', lang)}</span>
                </button>
              )}
            </div>
            {title && title !== coachTitle && (
              <div className="text-[10.5px] text-gray-400 dark:text-zinc-400 mt-0.5 truncate">{title}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <LanguageToggle currentLanguage={lang} onChange={onLanguageChange} />

          {/* Step badge pill */}
          <span className="bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap">
            {badgeText}
          </span>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tutorial"
            className="text-gray-400 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-[#2a2a3c] p-1 rounded-lg transition-colors duration-150 cursor-pointer flex items-center justify-center"
          >
            <FiX className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-[18px]">
        {/* ── Audio Narration Bar ── */}
        <div className="bg-gray-50 dark:bg-[#252538] border border-gray-200 dark:border-[#3f3f5a] rounded-xl px-3 py-2 flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <FiVolume2 className="w-4 h-4 text-purple-500 dark:text-purple-400 shrink-0" />
            <span className="text-xs text-gray-600 dark:text-zinc-300 font-medium truncate">
              {displayAudioText}
            </span>
          </div>

          {/* Animated equalizer bars — purple accent */}
          <div className="flex items-end gap-0.5 h-3.5 pl-2 shrink-0">
            {[0.6, 1, 0.4, 0.8, 0.5].map((heightRatio, i) => (
              <span
                key={i}
                className="inline-block w-[3px] bg-purple-500 dark:bg-purple-400 rounded-sm transition-all duration-200"
                style={{
                  height: isPlayingAudio ? '100%' : `${heightRatio * 100}%`,
                  animation: isPlayingAudio
                    ? `guideme-wave 0.8s ease-in-out infinite alternate ${i * 0.15}s`
                    : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* ── Main Instruction Content ── */}
        <div className="mb-3.5">
          <div className={`text-sm leading-relaxed text-gray-900 dark:text-zinc-100 font-semibold ${subtitle ? 'mb-1.5' : 'mb-0'}`}>
            {content ? (content.startsWith('"') ? content : `"${content}"`) : ''}
          </div>
          {subtitle && (
            <div className="text-xs leading-normal text-gray-500 dark:text-zinc-400 italic">
              {subtitle.startsWith('(') ? subtitle : `(${subtitle})`}
            </div>
          )}
        </div>

        {/* ── Progress Bar ── */}
        <div className="mb-3.5">
          <ProgressBar currentStepIndex={currentStepIndex} totalSteps={totalSteps} />
        </div>

        {/* ── Navigation Footer ── */}
        <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-[#2a2a3c] gap-2">
          {/* Listen Again */}
          <button
            type="button"
            onClick={handleReplay}
            title={getUIString('replayVoiceTooltip', lang)}
            aria-label={getUIString('replayVoice', lang)}
            className="bg-gray-100 dark:bg-[#252538] border border-gray-200 dark:border-[#3f3f5a] text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-[#2e2e42] hover:border-purple-300 dark:hover:border-purple-500 hover:text-purple-700 dark:hover:text-purple-300 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap"
          >
            <FiRotateCcw className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>{getUIString('replayVoice', lang)}</span>
          </button>

          {/* Step Navigation Controls */}
          <div className="flex gap-1.5 items-center">
            {!isFirstStep && (
              <button
                type="button"
                onClick={onPrev}
                className="bg-transparent border border-gray-200 dark:border-[#3f3f5a] text-gray-500 dark:text-zinc-400 hover:border-gray-400 dark:hover:border-zinc-500 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150"
              >
                {getUIString('back', lang)}
              </button>
            )}

            {canSkip && !isLastStep && (
              <button
                type="button"
                onClick={onSkip}
                className="bg-transparent border-0 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 px-2 py-1.5 text-xs cursor-pointer transition-colors duration-150"
              >
                {getUIString('skip', lang)}
              </button>
            )}

            {/* Primary CTA — purple */}
            <button
              type="button"
              onClick={onNext}
              className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-extrabold px-4 py-1.5 rounded-lg text-xs cursor-pointer shadow-[0_2px_8px_rgba(147,51,234,0.30)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(147,51,234,0.40)] transition-all duration-150"
            >
              {isLastStep ? getUIString('finish', lang) : getUIString('next', lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
