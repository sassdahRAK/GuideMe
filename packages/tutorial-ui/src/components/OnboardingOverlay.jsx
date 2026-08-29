import React, { useState, useEffect, useRef } from 'react';
import {
  FiShield,
  FiCpu,
  FiMousePointer,
  FiCheckCircle,
  FiSun,
  FiMoon,
  FiArrowRight,
  FiArrowLeft,
  FiX,
} from 'react-icons/fi';
import { GuideMeLogo } from './GuideMeLogo.jsx';

const STEPS = [
  {
    id: 'welcome',
    title: {
      en: 'Welcome to GuideMe',
      km: 'សូមស្វាគមន៍មកកាន់ GuideMe',
    },
    desc: {
      en: 'Create step-by-step guides on any webpage with AI assistance',
      km: 'បង្កើតការណែនាំជាជំហានៗលើគ្រប់ទំព័រវេបសាយជាមួយជំនួយការ AI',
    },
    icon: 'logo',
  },
  {
    id: 'permissions',
    title: {
      en: 'Permissions',
      km: 'សិទ្ធិប្រើប្រាស់ទំព័រ',
    },
    desc: {
      en: 'GuideMe needs access to web pages to create and display interactive guides',
      km: 'GuideMe ត្រូវការសិទ្ធិលើទំព័រវេបសាយដើម្បីបង្ហាញការណែនាំ និង Spotlight',
    },
    icon: 'shield',
  },
  {
    id: 'ai-assistant',
    title: {
      en: 'AI Assistant',
      km: 'ជំនួយការ AI ឆ្លាតវៃ',
    },
    desc: {
      en: 'Ask questions, get help creating guides, or understand any page element',
      km: 'សួរសំណួរ បង្កើតការណែនាំស្វ័យប្រវត្ត និងស្វែងយល់គ្រប់ប៊ូតុងលើទំព័រ',
    },
    icon: 'ai',
  },
  {
    id: 'guide-creation',
    title: {
      en: 'Create Guides',
      km: 'បង្កើតការណែនាំ',
    },
    desc: {
      en: 'Click elements to build step-by-step walkthroughs and voice narrations',
      km: 'ចុចលើធាតុនានាដើម្បីបង្កើតការណែនាំជាជំហានៗ និងសំឡេងអាន',
    },
    icon: 'pointer',
  },
  {
    id: 'ready',
    title: {
      en: "You're Ready!",
      km: 'អ្នកបានត្រៀមរួចរាល់!',
    },
    desc: {
      en: 'Open the floating assistant on any page to start guiding or getting help',
      km: 'ចុចលើប៊ូតុង GuideMe លើគ្រប់ទំព័រដើម្បីចាប់ផ្ដើមការណែនាំភ្លាមៗ',
    },
    icon: 'ready',
  },
];

export function OnboardingOverlay({
  isOpen = false,
  onClose,
  onComplete,
  language = 'km',
  onLanguageChange,
  theme = 'light',
  onThemeChange,
}) {
  const cardWidth = 440;
  const cardHeight = 470;
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef({ startX: 0, startY: 0, initialLeft: 0, initialTop: 0 });
  const cardRef = useRef(null);

  const isKhmer = language === 'km';
  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  // Initialize centered position on open
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setPosition({
        top: Math.max(16, Math.floor((vh - cardHeight) / 2)),
        left: Math.max(16, Math.floor((vw - cardWidth) / 2)),
      });
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  /* ── Dragging logic ── */
  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('button, input, select, textarea, a')) return;
    const el = cardRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialLeft: rect.left,
      initialTop: rect.top,
    };
    setIsDragging(true);
    try { el.setPointerCapture(e.pointerId); } catch { }
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const { startX, startY, initialLeft, initialTop } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = cardRef.current?.offsetWidth || cardWidth;
    const h = cardRef.current?.offsetHeight || cardHeight;

    setPosition({
      top: Math.max(12, Math.min(initialTop + dy, vh - h - 12)),
      left: Math.max(12, Math.min(initialLeft + dx, vw - w - 12)),
    });
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    try { cardRef.current?.releasePointerCapture(e.pointerId); } catch { }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      try {
        chrome.storage?.local?.set({ guideme_onboarding_done: true });
      } catch { }
      onComplete ? onComplete() : onClose?.();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const renderIcon = () => {
    switch (step.icon) {
      case 'logo':
        return (
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden shadow-md">
            <GuideMeLogo size={64} />
          </div>
        );
      case 'shield':
        return (
          <div
            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-500/25"
          >
            <FiShield className="w-8 h-8 stroke-[2.2] text-white" />
          </div>
        );
      case 'ai':
        return (
          <div
            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-500/25"
          >
            <FiCpu className="w-8 h-8 stroke-[2.2] text-white" />
          </div>
        );
      case 'pointer':
        return (
          <div
            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-500/25"
          >
            <FiMousePointer className="w-8 h-8 stroke-[2.2] text-white" />
          </div>
        );
      case 'ready':
      default:
        return (
          <div
            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-500/25 animate-pulse"
          >
            <FiCheckCircle className="w-8 h-8 stroke-[2.2] text-white" />
          </div>
        );
    }
  };

  const positionStyle = position
    ? { top: `${position.top}px`, left: `${position.left}px`, width: `${cardWidth}px` }
    : {};

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="GuideMe Welcome Onboarding"
      /* BLURRED BACKGROUND FOR ONBOARDING PER USER DIRECTIVE */
      className={`fixed inset-0 z-[9999999] pointer-events-auto bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out] select-none ${
        isKhmer ? 'font-kantumruy' : 'font-sans'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={cardRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={position ? { ...positionStyle, position: 'fixed' } : {}}
        className={`w-full max-w-md bg-white dark:bg-[#181826] border border-purple-100 dark:border-[#2d2d44] rounded-3xl p-8 sm:p-9 shadow-[0_25px_80px_rgba(0,0,0,0.4),0_0_40px_rgba(139,92,246,0.25)] dark:shadow-[0_30px_90px_rgba(0,0,0,0.9),0_0_40px_rgba(168,85,247,0.35)] relative overflow-hidden animate-[guideme-card-pop_0.25s_cubic-bezier(0.16,1,0.3,1)] transition-shadow ${
          isDragging ? 'cursor-grabbing select-none scale-[1.01] shadow-2xl' : 'cursor-grab'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Controls */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider bg-purple-50 dark:bg-purple-950/60 px-2.5 py-1 rounded-lg">
            GuideMe Onboarding
          </span>

          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <button
              type="button"
              onClick={() => onLanguageChange?.(isKhmer ? 'en' : 'km')}
              className="px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 hover:border-purple-500 transition-colors cursor-pointer"
            >
              {isKhmer ? 'English' : 'ភាសាខ្មែរ'}
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => onThemeChange?.(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
              className="w-7 h-7 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-[#202032] text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-[#2d2d44] hover:border-purple-500 transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <FiSun className="w-3.5 h-3.5 text-amber-400" /> : <FiMoon className="w-3.5 h-3.5" />}
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-[#202032] transition-colors cursor-pointer border border-gray-200 dark:border-[#2d2d44]"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Icon & Heading */}
        <div className="text-center mt-3 mb-6">
          <div className="inline-flex items-center justify-center mb-4">
            {renderIcon()}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight m-0">
            {step.title[language] || step.title.en}
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-gray-600 dark:text-zinc-300 m-0">
            {step.desc[language] || step.desc.en}
          </p>
        </div>

        {/* Progress Dots */}
        <div className="flex items-center justify-center gap-2 mb-7">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? 'w-8 bg-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.5)]'
                  : 'w-2 bg-gray-200 dark:bg-[#2d2d44]'
              }`}
            />
          ))}
        </div>

        {/* Action Buttons — Guaranteed High Contrast & Full Visibility */}
        <div className="flex items-center gap-3">
          {currentStep > 0 ? (
            <button
              type="button"
              onClick={handlePrev}
              style={{ minHeight: '44px' }}
              className="flex-1 py-2.5 px-4 rounded-xl font-bold text-sm bg-gray-50 dark:bg-[#202032] hover:bg-purple-50 dark:hover:bg-purple-950/40 text-gray-800 dark:text-zinc-200 border border-gray-200 dark:border-[#2d2d44] hover:border-purple-400 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
            >
              <FiArrowLeft className="w-4 h-4 stroke-[2.2]" />
              <span>{isKhmer ? 'ថយក្រោយ' : 'Back'}</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleNext}
            style={{
              background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
              backgroundColor: '#9333ea',
              color: '#ffffff',
              boxShadow: '0 4px 16px rgba(147, 51, 234, 0.45)',
              minHeight: '44px',
            }}
            className="flex-1 py-2.5 px-6 rounded-xl font-extrabold text-sm text-white cursor-pointer flex items-center justify-center gap-2 border-0 transition-all hover:brightness-110 active:scale-95 shadow-md"
          >
            <span className="text-white font-extrabold">
              {isLast ? (isKhmer ? 'ចាប់ផ្ដើម' : 'Get Started') : (isKhmer ? 'បន្ទាប់' : 'Next')}
            </span>
            <FiArrowRight className="w-4 h-4 text-white stroke-[2.5] shrink-0" />
          </button>
        </div>

        <p className="text-center text-[11px] text-gray-400 dark:text-zinc-500 mt-5 font-medium">
          GuideMe — Universal AI Tutorial Engine (Draggable)
        </p>
      </div>
    </div>
  );
}
