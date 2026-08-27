import React from 'react';
import { FiMic, FiMicOff, FiSend } from 'react-icons/fi';
import { getUIString } from '@guideme/tutorial-ui';

/**
 * PromptInput — Form container with input field, mic trigger, submit button, spinner, and soundwave indicator.
 */
export function PromptInput({
  customPrompt,
  onPromptChange,
  onSubmit,
  isProcessing,
  isListening,
  speechSupported,
  onMicToggle,
  currentLanguage,
}) {
  const hasText = customPrompt.trim().length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <form onSubmit={onSubmit} className="m-0">
        <div className="flex items-center gap-2.5 bg-gray-50 dark:bg-[#2a2a3c] border border-gray-200 dark:border-[#3f3f5a] focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 rounded-xl px-3.5 py-2.5 transition-all">
          {/* Loading Spinner */}
          {isProcessing && (
            <div className="w-5 h-5 rounded-full border-2 border-gray-200 dark:border-gray-700 border-t-purple-600 animate-spin shrink-0" />
          )}

          {/* Text Input */}
          <input
            type="text"
            id="prompt-input"
            value={customPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder={getUIString('typePrompt', currentLanguage)}
            disabled={isListening}
            title={isListening ? getUIString('listening', currentLanguage) : ''}
            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 disabled:opacity-70"
          />

          {/* Action: Send (has text) vs Mic (empty text) */}
          {hasText ? (
            <button
              type="submit"
              id="send-btn"
              title={getUIString('sendPrompt', currentLanguage)}
              aria-label={getUIString('sendPrompt', currentLanguage)}
              className="text-purple-600 dark:text-purple-400 hover:text-purple-700 p-0 border-0 bg-transparent cursor-pointer flex items-center shrink-0"
            >
              <FiSend size={17} />
            </button>
          ) : (
            <button
              type="button"
              id="mic-btn"
              onClick={onMicToggle}
              title={
                !speechSupported
                  ? getUIString('voiceNotSupported', currentLanguage)
                  : isListening
                  ? getUIString('stopListening', currentLanguage)
                  : getUIString('voiceInput', currentLanguage)
              }
              aria-label={
                isListening
                  ? getUIString('stopListening', currentLanguage)
                  : getUIString('voiceInput', currentLanguage)
              }
              aria-pressed={isListening}
              className={`flex items-center p-1 rounded-md transition-all shrink-0 border-0 bg-transparent ${
                !speechSupported
                  ? 'opacity-40 cursor-not-allowed text-gray-400'
                  : isListening
                  ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-600 animate-pulse cursor-pointer'
                  : 'text-gray-400 dark:text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer'
              }`}
            >
              {isListening ? <FiMicOff size={17} /> : <FiMic size={17} />}
            </button>
          )}
        </div>
      </form>

      {/* Listening Soundwave Animation */}
      {isListening && (
        <div className="flex items-center gap-1.5 text-xs text-purple-600 font-medium pt-1">
          <div className="flex gap-0.5 h-3.5 items-end">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-[3px] bg-purple-600 rounded-full animate-pulse h-full"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
          <span>{getUIString('listening', currentLanguage)}</span>
        </div>
      )}
    </div>
  );
}
