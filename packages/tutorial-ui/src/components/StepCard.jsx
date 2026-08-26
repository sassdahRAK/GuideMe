import React from 'react';
import { FiX, FiVolume2, FiRotateCcw, FiCompass, FiRefreshCw } from 'react-icons/fi';
import { ProgressBar } from './ProgressBar.jsx';
import { LanguageToggle } from './LanguageToggle.jsx';

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
  const isKhmer = language === 'km';
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
    if (onReplayAudio) {
      onReplayAudio();
    }
  };

  return (
    <div
      className={`pointer-events-auto bg-[#12141a] text-slate-100 rounded-2xl border border-[#2a2f3b] w-[430px] max-w-[94vw] box-border overflow-hidden animate-[guideme-card-pop_0.25s_cubic-bezier(0.16,1,0.3,1)] transition-shadow duration-200 ${
        isDragging
          ? 'shadow-[0_32px_64px_-12px_rgba(0,0,0,0.95),0_0_35px_rgba(245,158,11,0.35)] scale-[1.01] border-amber-500/50'
          : 'shadow-[0_24px_48px_-12px_rgba(0,0,0,0.85),0_4px_16px_rgba(0,0,0,0.6)]'
      } ${
        isKhmer ? 'font-kantumruy' : 'font-sans'
      }`}
    >
      {/* 1. Header Layer: Drag Handle, Coach Avatar, Title, Language Toggle, Step Badge & Close */}
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        onDoubleClick={onResetPosition}
        title={
          isKhmer
            ? 'ចុចអូសដើម្បីផ្លាស់ប្តូរទីតាំង / ចុចពីរដងដើម្បីកំណត់ទីតាំងដើម'
            : 'Click and drag to move anywhere • Double-click to reset position'
        }
        className={`bg-gradient-to-br from-[#1a1e28] to-[#12141a] px-3.5 py-3 flex justify-between items-center border-b border-[#232734] gap-2 select-none cursor-grab active:cursor-grabbing transition-colors ${
          isDragging ? 'cursor-grabbing border-amber-500/50 bg-[#1e2330]' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Subtle 6-dot drag grip indicator */}
          <div
            className="flex flex-col gap-0.5 text-slate-500 hover:text-amber-400 p-0.5 cursor-grab active:cursor-grabbing shrink-0 transition-colors"
            aria-label="Drag Handle"
            title={isKhmer ? 'ទាញដើម្បីផ្លាស់ទី' : 'Drag to reposition'}
          >
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-current opacity-70" />
              <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            </div>
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-current opacity-70" />
              <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            </div>
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-current opacity-70" />
              <span className="w-1 h-1 rounded-full bg-current opacity-70" />
            </div>
          </div>

          <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <FiCompass className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>

          <div className="min-w-0">
            <div className="text-[12.5px] font-bold text-white leading-tight tracking-tight truncate flex items-center gap-1.5">
              <span>{coachTitle}</span>
              {isCustomPositioned && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onResetPosition) onResetPosition();
                  }}
                  title={isKhmer ? 'កំណត់ទីតាំងដើមឡើងវិញ' : 'Reset to auto position'}
                  className="text-[10px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded font-normal flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <FiRefreshCw className="w-2.5 h-2.5" />
                  <span>{isKhmer ? 'កំណត់ឡើងវិញ' : 'Snap'}</span>
                </button>
              )}
            </div>
            {title && title !== coachTitle && (
              <div className="text-[10.5px] text-slate-400 mt-0.5 truncate">
                {title}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Dual Language Switcher */}
          <LanguageToggle
            currentLanguage={language}
            onChange={onLanguageChange}
          />

          {/* Step Pill Badge */}
          <span className="bg-amber-500/15 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap">
            {badgeText}
          </span>

          {/* Close Button (React Icons FiX) */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tutorial"
            className="text-slate-400 hover:text-white p-1 rounded transition-colors duration-150 cursor-pointer flex items-center justify-center"
          >
            <FiX className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-[18px]">
        {/* 2. Audio Narration Layer with Animated Equalizer Bars */}
        <div className="bg-[#181c26] border border-[#2a3142] rounded-xl px-3 py-2 flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2 min-w-0">
            <FiVolume2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs text-slate-300 font-medium truncate">
              {displayAudioText}
            </span>
          </div>

          {/* Animated Audio Equalizer Waves */}
          <div className="flex items-end gap-0.5 h-3.5 pl-2 shrink-0">
            {[0.6, 1, 0.4, 0.8, 0.5].map((heightRatio, i) => (
              <span
                key={i}
                className="inline-block w-[3px] bg-amber-500 rounded-sm transition-all duration-200"
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

        {/* 3. Main Instruction Content */}
        <div className="mb-3.5">
          <div className={`text-sm leading-relaxed text-white font-semibold ${subtitle ? 'mb-1.5' : 'mb-0'}`}>
            {content ? (content.startsWith('"') ? content : `"${content}"`) : ''}
          </div>

          {subtitle && (
            <div className="text-xs leading-normal text-slate-400 italic">
              {subtitle.startsWith('(') ? subtitle : `(${subtitle})`}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-3.5">
          <ProgressBar currentStepIndex={currentStepIndex} totalSteps={totalSteps} />
        </div>

        {/* 4. Action Controls Footer */}
        <div className="flex justify-between items-center pt-3 border-t border-[#232734] gap-2">
          {/* Replay Audio / Listen Again Button */}
          <button
            type="button"
            onClick={handleReplay}
            title={isKhmer ? 'ស្តាប់ការណែនាំជាសំឡេងឡើងវិញ' : 'Replay Voice Guidance'}
            aria-label={isKhmer ? 'ស្តាប់ឡើងវិញ' : 'Listen Again'}
            className="bg-[#1e232d] border border-[#333a4a] text-slate-200 hover:bg-[#272e3b] hover:border-amber-500 hover:text-amber-400 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-all duration-150 whitespace-nowrap"
          >
            <FiRotateCcw className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>{isKhmer ? 'ស្តាប់ឡើងវិញ' : 'Listen Again'}</span>
          </button>

          {/* Step Navigation Controls */}
          <div className="flex gap-1.5 items-center">
            {!isFirstStep && (
              <button
                type="button"
                onClick={onPrev}
                className="bg-transparent border border-[#333a4a] text-slate-400 hover:border-slate-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150"
              >
                {isKhmer ? 'ថយក្រោយ' : 'Back'}
              </button>
            )}

            {canSkip && !isLastStep && (
              <button
                type="button"
                onClick={onSkip}
                className="bg-transparent border-0 text-slate-500 hover:text-slate-300 px-2 py-1.5 text-xs cursor-pointer transition-colors duration-150"
              >
                {isKhmer ? 'រំលង' : 'Skip'}
              </button>
            )}

            <button
              type="button"
              onClick={onNext}
              className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-extrabold px-4 py-1.5 rounded-lg text-xs cursor-pointer shadow-[0_2px_8px_rgba(245,158,11,0.35)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(245,158,11,0.45)] transition-all duration-150"
            >
              {isLastStep ? (isKhmer ? 'រួចរាល់' : 'Finish') : isKhmer ? 'បន្ទាប់' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
