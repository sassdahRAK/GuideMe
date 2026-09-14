import { useCallback, useRef, useState } from 'react';

export interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string) => void;
  onEnd?: () => void;
}

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  supported: boolean;
  start: (lang?: string) => void;
  stop: () => void;
}

/**
 * Custom React hook wrapping the Web Speech API (SpeechRecognition).
 * Returns { isListening, supported, start, stop }.
 */
export function useSpeechRecognition({ onResult, onEnd }: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn {
  const recogRef = useRef<any>(null);
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
      const win = window as any;
      const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
      const recognition = new SR();
      recognition.lang = lang === 'km' ? 'km-KH' : 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recogRef.current = recognition;

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results as any[])
          .map((r: any) => r[0].transcript)
          .join('');
        if (onResult) onResult(transcript);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (onEnd) onEnd();
      };

      recognition.onerror = (e: any) => {
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
