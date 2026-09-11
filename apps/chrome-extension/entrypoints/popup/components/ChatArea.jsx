import React, { useEffect, useRef } from 'react';
import { GuideMeLogo, formatMessageTime } from '@guideme/tutorial-ui';

const LOGIN_URL = `${(typeof import.meta !== 'undefined' && import.meta.env?.WXT_SITE_URL) || 'http://localhost:3005'}/login?source=extension`;

/**
 * AuthPromptMessage — Inline card shown when the user tries to chat without being logged in.
 */
function AuthPromptMessage({ msg, language = 'km' }) {
  const isKhmer = language === 'km';
  const displayTime = formatMessageTime(msg, language);
  return (
    <div className="flex justify-start items-start gap-2">
      <div className="w-6 h-6 rounded-lg overflow-hidden shrink-0 mt-0.5 shadow-sm flex items-center justify-center">
        <GuideMeLogo size={24} />
      </div>
      <div className="max-w-[82%] flex flex-col gap-2">
        <div className="px-3.5 py-3 rounded-2xl rounded-tl-sm bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 shadow-sm">
          <p className={`text-[12.5px] text-amber-900 dark:text-amber-200 leading-relaxed m-0 ${isKhmer ? 'font-kantumruy' : 'font-sans'}`}>
            {msg.content}
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof chrome !== 'undefined' && chrome.tabs) {
                chrome.tabs.create({ url: LOGIN_URL });
                window.close();
              }
            }}
            className="mt-2.5 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-[11.5px] font-semibold cursor-pointer border-0 transition-colors shadow-sm shadow-purple-500/30"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
            </svg>
            <span>{isKhmer ? 'ចូលគណនី' : 'Log In'}</span>
          </button>
        </div>
        {displayTime && (
          <div className="text-[9.5px] text-gray-400 dark:text-zinc-500 px-1">{displayTime}</div>
        )}
      </div>
    </div>
  );
}

/**
 * ChatMessage — Sharp, contrasty chat bubbles for both light and dark mode.
 */
function ChatMessage({ msg, language = 'km' }) {
  if (msg.role === 'auth-prompt') return <AuthPromptMessage msg={msg} language={language} />;

  const isUser = msg.role === 'user';
  const displayTime = formatMessageTime(msg, language);
  const isKhmer = language === 'km';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-start gap-2`}>
      {/* Assistant avatar */}
      {!isUser && (
        <div className="w-6 h-6 rounded-lg overflow-hidden shrink-0 mt-0.5 shadow-sm flex items-center justify-center">
          <GuideMeLogo size={24} />
        </div>
      )}

      <div
        className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[12.5px] leading-relaxed shadow-sm transition-colors ${
          isUser
            ? 'bg-gradient-to-r from-[#9333ea] to-[#7c3aed] text-white rounded-br-sm shadow-purple-900/30'
            : 'bg-[#f5f0fc] dark:bg-[#1e1e2f] text-gray-800 dark:text-[#f3f4f6] dark:border dark:border-[#2d2d44] rounded-tl-sm'
        } ${isKhmer ? 'font-kantumruy' : 'font-sans'}`}
      >
        {msg.image && (
          <div className="mb-2 overflow-hidden rounded-lg border border-white/20">
            <img
              src={msg.image}
              alt="Attached screenshot"
              className="w-full max-h-[140px] object-cover rounded-lg"
            />
          </div>
        )}
        <p className="break-words font-normal">{msg.content}</p>
        {displayTime && (
          <div
            className={`text-right mt-1 text-[9.5px] ${
              isUser ? 'text-white/80' : 'text-gray-400 dark:text-purple-300/60'
            }`}
          >
            {displayTime}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ChatArea — Scrollable list of chat messages.
 */
export function ChatArea({ messages = [], language = 'km' }) {
  const bottomRef = useRef(null);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3.5 flex flex-col gap-3 bg-white dark:bg-[#101018] transition-colors">
      {messages.map((msg, i) => (
        <ChatMessage
          key={i}
          msg={msg}
          language={language}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
