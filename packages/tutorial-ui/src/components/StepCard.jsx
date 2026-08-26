import React, { useState } from 'react';
import { ProgressBar } from './ProgressBar.jsx';
import { LanguageToggle } from './LanguageToggle.jsx';

/**
 * Converts Western numerals to Khmer numerals for localized display.
 * @param {number|string} num
 */
function toKhmerNumber(num) {
  const khmerDigits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
  return String(num).replace(/[0-9]/g, (d) => khmerDigits[d]);
}

/**
 * GuideMe AI Live Coach Step Content Card (Dual-Language Khmer / English).
 */
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
      className="guideme-step-card guideme-coach-card"
      style={{
        pointerEvents: 'auto',
        backgroundColor: '#12141a',
        color: '#f8fafc',
        borderRadius: '16px',
        boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.85), 0 4px 16px rgba(0, 0, 0, 0.6)',
        border: '1px solid #2a2f3b',
        fontFamily: isKhmer
          ? "'Kantumruy Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        width: '430px',
        maxWidth: '94vw',
        boxSizing: 'border-box',
        overflow: 'hidden',
        animation: 'guideme-card-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* 1. Header Layer: Coach Avatar, Title, Language Toggle, Step Badge & Close */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1e28 0%, #12141a 100%)',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #232734',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              flexShrink: 0,
            }}
          >
            🤖
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {coachTitle}
            </div>
            {title && title !== coachTitle && (
              <div
                style={{
                  fontSize: '11px',
                  color: '#94a3b8',
                  marginTop: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {title}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Dual Language Switcher */}
          <LanguageToggle
            currentLanguage={language}
            onChange={onLanguageChange}
          />

          {/* Step Pill Badge */}
          <span
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              padding: '3px 8px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {badgeText}
          </span>

          {/* Close Button */}
          <button
            onClick={onClose}
            aria-label="Close tutorial"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '15px',
              lineHeight: 1,
              padding: '4px 6px',
              borderRadius: '4px',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
          >
            ✕
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 18px 18px 18px' }}>
        {/* 2. Audio Narration Layer with Animated Equalizer Bars */}
        <div
          style={{
            backgroundColor: '#181c26',
            border: '1px solid #2a3142',
            borderRadius: '10px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ fontSize: '14px' }}>🔊</span>
            <span
              style={{
                fontSize: '12px',
                color: '#cbd5e1',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {displayAudioText}
            </span>
          </div>

          {/* Animated Audio Equalizer Waves */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '3px',
              height: '14px',
              paddingLeft: '8px',
              flexShrink: 0,
            }}
          >
            {[0.6, 1, 0.4, 0.8, 0.5].map((heightRatio, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  width: '3px',
                  height: isPlayingAudio ? '100%' : `${heightRatio * 100}%`,
                  backgroundColor: '#f59e0b',
                  borderRadius: '2px',
                  animation: isPlayingAudio
                    ? `guideme-wave 0.8s ease-in-out infinite alternate ${i * 0.15}s`
                    : 'none',
                  transition: 'height 0.2s ease',
                }}
              />
            ))}
          </div>
        </div>

        {/* 3. Main Instruction Content */}
        <div style={{ marginBottom: '14px' }}>
          <div
            style={{
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#ffffff',
              fontWeight: 600,
              marginBottom: subtitle ? '6px' : '0px',
            }}
          >
            {content ? (content.startsWith('"') ? content : `"${content}"`) : ''}
          </div>

          {subtitle && (
            <div
              style={{
                fontSize: '12px',
                lineHeight: '1.4',
                color: '#94a3b8',
                fontStyle: 'italic',
              }}
            >
              {subtitle.startsWith('(') ? subtitle : `(${subtitle})`}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: '14px' }}>
          <ProgressBar currentStepIndex={currentStepIndex} totalSteps={totalSteps} />
        </div>

        {/* 4. Action Controls Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '12px',
            borderTop: '1px solid #232734',
            gap: '8px',
          }}
        >
          {/* Replay Audio / Listen Again Button */}
          <button
            type="button"
            onClick={handleReplay}
            title={isKhmer ? 'ស្តាប់ការណែនាំជាសំឡេងឡើងវិញ' : 'Replay Voice Guidance'}
            aria-label={isKhmer ? 'ស្តាប់ឡើងវិញ' : 'Listen Again'}
            style={{
              backgroundColor: '#1e232d',
              border: '1px solid #333a4a',
              color: '#e2e8f0',
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#272e3b';
              e.currentTarget.style.borderColor = '#f59e0b';
              e.currentTarget.style.color = '#f59e0b';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1e232d';
              e.currentTarget.style.borderColor = '#333a4a';
              e.currentTarget.style.color = '#e2e8f0';
            }}
          >
            <span>🔄</span>
            <span>{isKhmer ? 'ស្តាប់ឡើងវិញ' : 'Listen Again'}</span>
          </button>

          {/* Step Navigation Controls */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {!isFirstStep && (
              <button
                type="button"
                onClick={onPrev}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #333a4a',
                  color: '#94a3b8',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#64748b';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#333a4a';
                  e.currentTarget.style.color = '#94a3b8';
                }}
              >
                {isKhmer ? 'ថយក្រោយ' : 'Back'}
              </button>
            )}

            {canSkip && !isLastStep && (
              <button
                type="button"
                onClick={onSkip}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  padding: '7px 8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#94a3b8')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
              >
                {isKhmer ? 'រំលង' : 'Skip'}
              </button>
            )}

            <button
              type="button"
              onClick={onNext}
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                color: '#ffffff',
                padding: '7px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0px)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.35)';
              }}
            >
              {isLastStep ? (isKhmer ? 'រួចរាល់' : 'Finish') : isKhmer ? 'បន្ទាប់' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
