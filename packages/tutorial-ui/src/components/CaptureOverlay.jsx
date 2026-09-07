import React from 'react';
import { FiCrosshair, FiX } from 'react-icons/fi';
import { getUIString } from '../i18n/ui-strings.js';

/** Pure capture-mode view; host DOM event handling stays in the content script. */
export function CaptureOverlay({ isActive, targetBoundingBox, language = 'km', onCancel }) {
  if (!isActive) return null;

  return (
    <>
      {targetBoundingBox && (
        <div
          aria-hidden="true"
          className="fixed pointer-events-none border-2 border-purple-500 dark:border-purple-400 rounded-lg shadow-[0_0_0_4px_rgba(147,51,234,0.22),0_0_24px_rgba(147,51,234,0.45)]"
          style={{
            top: `${Math.max(0, targetBoundingBox.top - 4)}px`,
            left: `${Math.max(0, targetBoundingBox.left - 4)}px`,
            width: `${targetBoundingBox.width + 8}px`,
            height: `${targetBoundingBox.height + 8}px`,
            zIndex: 999991,
          }}
        />
      )}
      <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[999999] pointer-events-auto max-w-[calc(100vw-32px)] flex items-center gap-3 rounded-xl border border-purple-200 dark:border-purple-500/50 bg-white dark:bg-[#181826] px-4 py-3 shadow-xl ${language === 'km' ? 'font-kantumruy' : 'font-sans'}`}>
        <FiCrosshair className="w-5 h-5 shrink-0 text-purple-600 dark:text-purple-300" />
        <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{getUIString('captureStepInstruction', language)}</span>
        <button type="button" onClick={onCancel} aria-label={getUIString('cancelCapture', language)} className="rounded-lg border-0 bg-transparent p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-[#2d2d44] dark:hover:text-white cursor-pointer">
          <FiX className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}
