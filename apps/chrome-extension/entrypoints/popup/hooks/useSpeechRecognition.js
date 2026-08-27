import { useCallback, useRef, useState } from 'react';

/**
 * Custom React hook wrapping the Web Speech API (SpeechRecognition).
 * Returns { isListening, supported, start, stop }.
 */
export function useSpeechRecognition({ onResult, onEnd }) {
  const recogRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const stop = useCallback(() => {
    recogRef.current?.stop();
    setIsListening(false);
  }, []);

  const start = useCallback(
    (lang = 'en-US') => {
      if (!supported) return;
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SR();
      recognition.lang = lang === 'km' ? 'km-KH' : 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recogRef.current = recognition;

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((r) => r[0].transcript)
          .join('');
        if (onResult) onResult(transcript);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (onEnd) onEnd();
      };

      recognition.onerror = (e) => {
        console.warn('[GuideMe Speech] Error:', e.error);
        setIsListening(false);
      };

      recognition.start();
      setIsListening(true);
    },
    [supported, onResult, onEnd]
  );

  return { isListening, supported, start, stop };
}
