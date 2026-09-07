/**
 * Web Speech API Controller for GuideMe PiP.
 * Supports real-time speech transcription in Khmer (km-KH) and English (en-US).
 */
export function createSpeechController({ getLang, onTranscript, onStateChange, onError }) {
  let recognition = null;
  let listening = false;

  const SR = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  function start() {
    if (!SR) {
      console.warn('[GuideMe PiP Speech] Web Speech API not supported in this browser.');
      onError?.('Speech recognition not supported');
      return false;
    }

    try {
      recognition = new SR();
      const lang = getLang ? getLang() : 'km';
      recognition.lang = lang === 'km' ? 'km-KH' : 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((r) => r[0].transcript)
          .join('');
        onTranscript?.(transcript);
      };

      recognition.onend = () => {
        listening = false;
        onStateChange?.(false);
      };

      recognition.onerror = (e) => {
        console.warn('[GuideMe PiP Speech] Error:', e.error);
        listening = false;
        onStateChange?.(false);
        onError?.(e.error);
      };

      recognition.start();
      listening = true;
      onStateChange?.(true);
      return true;
    } catch (err) {
      console.error('[GuideMe PiP Speech] Start failed:', err);
      listening = false;
      onStateChange?.(false);
      onError?.(err.message);
      return false;
    }
  }

  function stop() {
    if (recognition) {
      try {
        recognition.stop();
      } catch { }
      recognition = null;
    }
    listening = false;
    onStateChange?.(false);
  }

  function toggle() {
    if (listening) {
      stop();
    } else {
      start();
    }
  }

  return {
    start,
    stop,
    toggle,
    isListening: () => listening,
  };
}
