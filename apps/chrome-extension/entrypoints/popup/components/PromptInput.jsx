import React from 'react';
import { getUIString } from '@guideme/tutorial-ui';

/** Send arrow icon matching user screenshot */
function SendIcon() {
  return (
    <svg
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <g transform="rotate(90,12,12)">
        <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </g>
    </svg>
  );
}

/** Mic icon matching user screenshot */
function MicIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
    </svg>
  );
}

/**
 * PromptInput — Precision styled input row with sharp dark mode support.
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
    <div className="flex flex-col">
      <form onSubmit={onSubmit} className="m-0">
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#181826] transition-all ${
            isListening
              ? 'border border-[#ede4ff] dark:border-[#a855f7]/50 dark:shadow-[0_0_12px_rgba(168,85,247,0.2)]'
              : hasText
              ? 'border border-[#8b5cf6] dark:border-[#a855f7] ring-2 ring-[#8b5cf6]/20 dark:ring-[#a855f7]/30'
              : 'border border-[#ede4ff] dark:border-[#2d2d44] focus-within:border-[#8b5cf6] dark:focus-within:border-[#a855f7] focus-within:ring-2 focus-within:ring-[#8b5cf6]/20 dark:focus-within:ring-[#a855f7]/30'
          }`}
          id="prompt-input-row"
        >
          {/* Spinner while processing */}
          {isProcessing && (
            <div className="w-4 h-4 rounded-full border-2 border-gray-200 dark:border-zinc-700 border-t-[#8b5cf6] dark:border-t-[#a855f7] animate-spin shrink-0" />
          )}

          {/* Listening State vs Input Field */}
          {isListening ? (
            <span className="flex-1 text-[13px] font-normal text-[#8b5cf6] dark:text-[#c084fc] select-none animate-pulse">
              Listening...
            </span>
          ) : (
            <input
              id="chat-input"
              type="text"
              value={customPrompt}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder="Type to GuideMe..."
              className="flex-1 bg-transparent border-0 outline-none text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 font-normal"
              style={{ border: 'none', outline: 'none' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit(e);
                }
              }}
            />
          )}

          {/* Right Action Button */}
          {hasText ? (
            <button
              type="submit"
              id="send-btn"
              title={getUIString('sendPrompt', currentLanguage)}
              aria-label={getUIString('sendPrompt', currentLanguage)}
              className="w-[30px] h-[30px] rounded-[10px] flex items-center justify-center text-white shrink-0 cursor-pointer border-0 transition-all bg-[#8b5cf6] dark:bg-[#a855f7] shadow-sm hover:brightness-110 active:scale-95 dark:shadow-[0_2px_10px_rgba(168,85,247,0.4)]"
            >
              <SendIcon />
            </button>
          ) : (
            <button
              type="button"
              id="mic-btn"
              onClick={onMicToggle}
              disabled={!speechSupported}
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
              className={`w-[30px] h-[30px] rounded-[10px] flex items-center justify-center shrink-0 border-0 transition-all cursor-pointer ${
                !speechSupported
                  ? 'opacity-40 cursor-not-allowed text-gray-400 dark:text-zinc-600 bg-transparent'
                  : isListening
                  ? 'text-white bg-[#8b5cf6] dark:bg-[#a855f7] shadow-sm hover:brightness-110 dark:shadow-[0_2px_12px_rgba(168,85,247,0.5)]'
                  : 'bg-transparent text-[#8b5cf6] dark:text-[#a855f7] hover:bg-purple-50 dark:hover:bg-[#a855f7]/15'
              }`}
            >
              <MicIcon className={isListening ? "w-[15px] h-[15px]" : "w-[17px] h-[17px]"} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
