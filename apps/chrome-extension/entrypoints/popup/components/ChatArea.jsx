import React, { useEffect, useRef } from 'react';
import { GuideMeLogo } from '@guideme/tutorial-ui';

/**
 * ChatMessage — Sharp, contrasty chat bubbles for both light and dark mode.
 */
function ChatMessage({ role, content, time }) {
  const isUser = role === 'user';

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
        }`}
      >
        <p className="break-words font-normal">{content}</p>
        {time && (
          <div
            className={`text-right mt-1 text-[9.5px] ${
              isUser ? 'text-white/80' : 'text-gray-400 dark:text-purple-300/60'
            }`}
          >
            {time}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ChatArea — Scrollable list of chat messages.
 */
export function ChatArea({ messages }) {
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
          role={msg.role}
          content={msg.content}
          time={msg.time}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
