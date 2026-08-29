import React, { useState } from 'react';
import {
  FiVolume2,
  FiArrowRight,
  FiArrowLeft,
  FiCheck,
  FiX,
  FiInfo,
  FiRotateCcw,
} from 'react-icons/fi';
import { getUIString, toKhmerNumber } from '../i18n/ui-strings.js';

/**
 * StepCard — In-page step guidance card.
 * Full Light Mode (#ffffff base) and Dark Mode (#1a1b24 base) support.
 */
export function StepCard({
  title,
  content,
  subtitle,
  coachTitle,
  audioStatusText,
  language = 'km',
  stepBadgeText,
  currentStepIndex = 0,
  totalSteps = 1,
  isFirstStep = false,
  isLastStep = false,
  canSkip = true,
  isPlayingAudio = false,
  isDragging = false,
  onLanguageChange,
  onNext,
  onPrev,
  onSkip,
  onClose,
  onReplayAudio,
  onDragStart,
  onDragMove,
  onDragEnd,
}) {
  const [showDetails, setShowDetails] = useState(false);

  const lang = language || 'km';
  const isKhmer = lang === 'km';
  const stepNumber = (currentStepIndex ?? 0) + 1;

  const stepBadge = isKhmer
    ? `ជំហាន ${toKhmerNumber(stepNumber)}/${toKhmerNumber(totalSteps)}`
    : `Step ${stepNumber}/${totalSteps}`;

  // Progress percentage
  const percentage = totalSteps > 1 ? Math.max(5, Math.min(100, Math.round((stepNumber / totalSteps) * 100))) : 100;

  // Clean content text without extra quotes
  const cleanContent = content ? content.replace(/^["']|["']$/g, '') : '';

  return (
    <div
      style={{
        boxShadow: isDragging
          ? '0 30px 80px rgba(0, 0, 0, 0.38), 0 12px 28px rgba(0, 0, 0, 0.20), 0 0 0 1px rgba(0, 0, 0, 0.08)'
          : '0 20px 60px -8px rgba(0, 0, 0, 0.24), 0 8px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)',
      }}
      className={`pointer-events-auto bg-white/98 dark:bg-[#1a1b24]/98 backdrop-blur-xl border border-gray-200/90 dark:border-white/10 text-gray-900 dark:text-white rounded-2xl w-[410px] max-w-[94vw] box-border p-4 animate-[guideme-card-pop_0.25s_cubic-bezier(0.16,1,0.3,1)] select-none ${
        isDragging ? 'scale-[1.01] cursor-grabbing' : ''
      } ${isKhmer ? 'font-kantumruy' : 'font-sans'}`}
    >
      {/* ── Top Header Row ── */}
      <div
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        className="flex items-center justify-between gap-2 pb-2.5 border-b border-gray-100 dark:border-white/10 cursor-grab active:cursor-grabbing"
      >
        {/* Left: Speaker icon + Sound wave animation */}
        <button
          type="button"
          onClick={onReplayAudio}
          title={getUIString('replayVoiceTooltip', lang)}
          className="flex items-center gap-2 text-gray-800 hover:text-gray-900 dark:text-white/90 dark:hover:text-white cursor-pointer bg-transparent border-0 p-0 transition-opacity hover:opacity-100"
        >
          <FiVolume2 className="w-4 h-4 text-[#8b5cf6] dark:text-white shrink-0" />
          {/* Animated sound wave bars */}
          <div className="flex items-end gap-[2px] h-3.5 shrink-0">
            {[0.4, 0.9, 0.5, 1, 0.6, 0.8, 0.35].map((ratio, i) => (
              <span
                key={i}
                className="inline-block w-[2px] bg-gray-800 dark:bg-white rounded-full transition-all"
                style={{
                  height: isPlayingAudio ? '100%' : `${ratio * 100}%`,
                  animation: isPlayingAudio
                    ? `guideme-wave 0.7s ease-in-out infinite alternate ${i * 0.12}s`
                    : 'none',
                }}
              />
            ))}
          </div>
        </button>

        {/* Right controls: Step Badge + Language Toggle + Close Button */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[12.5px] font-semibold text-gray-600 dark:text-white/80 tracking-wide">
            {stepBadge}
          </span>

          {/* Language Toggle Pill */}
          <div className="flex items-center bg-gray-100 dark:bg-white/10 rounded-full p-0.5 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => onLanguageChange?.('km')}
              className={`px-1.5 py-0.5 rounded-full border-0 cursor-pointer transition-all ${
                isKhmer ? 'bg-[#8b5cf6] text-white shadow-sm' : 'bg-transparent text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              KH
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange?.('en')}
              className={`px-1.5 py-0.5 rounded-full border-0 cursor-pointer transition-all ${
                !isKhmer ? 'bg-[#8b5cf6] text-white shadow-sm' : 'bg-transparent text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              EN
            </button>
          </div>

          {/* Close X Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label={getUIString('close', lang)}
            className="text-gray-400 hover:text-gray-700 dark:text-white/60 dark:hover:text-white p-1 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 transition-colors border-0 bg-transparent cursor-pointer flex items-center justify-center shrink-0"
          >
            <FiX className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Main Instruction Text ── */}
      <div className="pt-3 pb-2.5">
        <p className="text-[14px] leading-relaxed text-gray-900 dark:text-white font-normal m-0 tracking-normal">
          {cleanContent}
        </p>

        {/* "Explain detail" Pill Button */}
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="inline-flex items-center gap-1.5 bg-[#8b5cf6] hover:bg-[#7c3aed] active:bg-[#6d28d9] text-white text-[11.5px] font-semibold px-3 py-1 rounded-lg border-0 cursor-pointer shadow-[0_2px_8px_rgba(139,92,246,0.35)] transition-all hover:scale-[1.02] active:scale-95"
          >
            <FiInfo className="w-3 h-3" />
            <span>{showDetails ? getUIString('hideDetail', lang) : getUIString('explainDetail', lang)}</span>
          </button>

          {/* Replay quick button */}
          <button
            type="button"
            onClick={onReplayAudio}
            title={getUIString('replayVoiceTooltip', lang)}
            className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800 dark:text-white/50 dark:hover:text-white/80 text-[11px] bg-transparent border-0 cursor-pointer transition-colors p-1"
          >
            <FiRotateCcw className="w-3 h-3" />
            <span>{getUIString('replayVoice', lang)}</span>
          </button>
        </div>

        {/* Expandable Explanation Details */}
        {showDetails && (
          <div className="mt-2.5 p-2.5 bg-purple-50/80 dark:bg-white/10 rounded-xl border border-purple-100 dark:border-white/10 text-[12px] text-gray-800 dark:text-white/90 leading-relaxed animate-[guideme-card-pop_0.2s_ease-out]">
            {subtitle ? (
              <p className="m-0">{subtitle}</p>
            ) : (
              <p className="m-0">
                {isKhmer
                  ? 'ចុចលើប៊ូតុងដែលបានចង្អុលបង្ហាញដើម្បីបន្តទៅមុខ ឬចុចប៊ូតុងបន្ទាប់ (Next) ប្រសិនបើអ្នកបានធ្វើរួចរាល់។'
                  : 'Click on the highlighted element to proceed, or click Next if you have completed the action.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom Footer: Progress Bar & Navigation Controls ── */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/10">
        {/* Progress Bar with Thumb Handle */}
        <div className="flex-1 relative h-1 bg-gray-200 dark:bg-white/20 rounded-full my-auto overflow-visible mr-4">
          <div
            className="absolute top-0 left-0 h-full bg-[#8b5cf6] rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(139,92,246,0.6)]"
            style={{ width: `${percentage}%` }}
          />
          {/* Thumb circle handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#8b5cf6] rounded-full ring-2 ring-white/90 dark:ring-white/50 shadow-[0_0_8px_#8b5cf6] transition-all duration-300"
            style={{ left: `${percentage}%` }}
          />
        </div>

        {/* Right Navigation Group: [←] [Skip] [→] */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Circular Back Arrow (←) */}
          {!isFirstStep && (
            <button
              type="button"
              onClick={onPrev}
              title={getUIString('back', lang)}
              aria-label={getUIString('back', lang)}
              className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white/80 dark:hover:text-white flex items-center justify-center border-0 cursor-pointer transition-all hover:scale-105 active:scale-95"
            >
              <FiArrowLeft className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
          )}

          {/* Skip Text Button */}
          {canSkip && !isLastStep && (
            <button
              type="button"
              onClick={onSkip}
              className="text-gray-600 hover:text-gray-900 dark:text-white/70 dark:hover:text-white text-[12.5px] font-medium px-2 py-1 bg-transparent border-0 cursor-pointer transition-colors"
            >
              {getUIString('skip', lang)}
            </button>
          )}

          {/* Next / Finish Circular Button (→) */}
          <button
            type="button"
            onClick={onNext}
            title={isLastStep ? getUIString('finish', lang) : getUIString('next', lang)}
            aria-label={isLastStep ? getUIString('finish', lang) : getUIString('next', lang)}
            className="w-8 h-8 rounded-full bg-[#8b5cf6] hover:bg-[#7c3aed] active:bg-[#6d28d9] text-white flex items-center justify-center border border-purple-400/40 shadow-[0_2px_12px_rgba(139,92,246,0.5)] cursor-pointer transition-all hover:scale-105 active:scale-95"
          >
            {isLastStep ? (
              <FiCheck className="w-4 h-4 stroke-[2.5]" />
            ) : (
              <FiArrowRight className="w-4 h-4 stroke-[2.5]" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
