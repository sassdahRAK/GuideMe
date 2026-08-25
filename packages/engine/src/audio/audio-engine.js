import { AudioPlaybackStatus, AudioEngineEvent, Language } from '@guideme/core-types';

/**
 * Base interface for TTS & Audio Synthesis Providers.
 * The AI team can implement this class and inject their API client.
 */
export class BaseTtsProvider {
  /**
   * Speak or synthesize text.
   * @param {Object} options
   * @param {string} options.text Text to synthesize
   * @param {string} options.lang Language code ('km' or 'en')
   * @param {string} [options.audioUrl] Optional pre-recorded audio clip
   * @param {number} [options.rate=1.0] Playback speed multiplier
   * @param {() => void} [options.onStart] Callback when audio playback starts
   * @param {() => void} [options.onEnd] Callback when audio playback finishes
   * @param {(err: Error) => void} [options.onError] Callback on error
   * @returns {Promise<void>}
   */
  async speak({ text, lang, audioUrl, rate, onStart, onEnd, onError }) {
    throw new Error('BaseTtsProvider.speak() must be implemented by a concrete provider.');
  }

  /**
   * Stop any current synthesis or playback.
   */
  stop() {}

  /**
   * Pause synthesis or playback.
   */
  pause() {}

  /**
   * Resume synthesis or playback.
   */
  resume() {}
}

/**
 * Default Placeholder TTS Provider.
 * Ready for the AI team's custom API endpoint.
 * Provides resilient fallback in browser environments.
 */
export class PlaceholderTtsProvider extends BaseTtsProvider {
  constructor() {
    super();
    this._currentTimeout = null;
    this._audioElement = null;
    this._isPaused = false;
  }

  async speak({ text, lang, audioUrl, rate = 1.0, onStart, onEnd, onError }) {
    this.stop();

    // 1. If pre-recorded audio URL is provided, use HTML5 Audio
    if (audioUrl && typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      try {
        const audio = new Audio(audioUrl);
        audio.playbackRate = rate;
        this._audioElement = audio;

        audio.onplay = () => {
          if (onStart) onStart();
        };
        audio.onended = () => {
          this._audioElement = null;
          if (onEnd) onEnd();
        };
        audio.onerror = (e) => {
          console.warn('[GuideMe Audio] Pre-recorded audio failed, falling back:', e);
          this._audioElement = null;
          this._simulatePlayback({ text, rate, onStart, onEnd });
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('[GuideMe Audio] Audio autoplay restricted by browser:', err);
            this._simulatePlayback({ text, rate, onStart, onEnd });
          });
        }
        return;
      } catch (err) {
        console.warn('[GuideMe Audio] HTML5 Audio initialization failed:', err);
      }
    }

    // 2. Web Speech API fallback (if supported in browser for en or basic synthesis)
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined' &&
      lang === Language.EN
    ) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;
        utterance.lang = 'en-US';
        utterance.onstart = () => {
          if (onStart) onStart();
        };
        utterance.onend = () => {
          if (onEnd) onEnd();
        };
        utterance.onerror = () => {
          this._simulatePlayback({ text, rate, onStart, onEnd });
        };
        window.speechSynthesis.speak(utterance);
        return;
      } catch (err) {
        // Fall through to simulation
      }
    }

    // 3. Simulated placeholder playback (synchronizes UI equalizer waves without blocking)
    this._simulatePlayback({ text, rate, onStart, onEnd });
  }

  _simulatePlayback({ text, rate, onStart, onEnd }) {
    if (onStart) onStart();
    const wordCount = (text || '').split(/\s+/).length || 5;
    // Calculate realistic duration: ~180ms per word adjusted by rate
    const estimatedDurationMs = Math.max(1200, Math.min(6000, (wordCount * 250) / rate));

    this._currentTimeout = setTimeout(() => {
      this._currentTimeout = null;
      if (onEnd) onEnd();
    }, estimatedDurationMs);
  }

  stop() {
    if (this._currentTimeout) {
      clearTimeout(this._currentTimeout);
      this._currentTimeout = null;
    }
    if (this._audioElement) {
      this._audioElement.pause();
      this._audioElement = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
  }

  pause() {
    this._isPaused = true;
    if (this._audioElement) {
      this._audioElement.pause();
    }
  }

  resume() {
    this._isPaused = false;
    if (this._audioElement) {
      this._audioElement.play().catch(() => {});
    }
  }
}

/**
 * Universal Audio & Voice Guidance Controller.
 * Dispatches voice prompts, manages playback states, and coordinates with UI equalizer animations.
 */
export class AudioEngine {
  /**
   * @param {Object} [options]
   * @param {BaseTtsProvider} [options.ttsProvider] Custom TTS provider (e.g. AI team client)
   */
  constructor({ ttsProvider = null } = {}) {
    this.ttsProvider = ttsProvider || new PlaceholderTtsProvider();
    this.status = AudioPlaybackStatus.IDLE;
    this.speechRate = 1.0;
    this.lastPrompt = null;
    this.lastLang = Language.KM;
    this.listeners = new Set();
  }

  /**
   * Set custom TTS provider at runtime (e.g., when the AI team's API endpoint is configured).
   * @param {BaseTtsProvider} provider
   */
  setTtsProvider(provider) {
    if (provider && typeof provider.speak === 'function') {
      this.stop();
      this.ttsProvider = provider;
    }
  }

  /**
   * Play or synthesize voice prompt for a given step.
   * @param {Object} audioConfig
   * @param {string} lang Language code ('km' or 'en')
   * @param {string} [fallbackText] Text if audioConfig is absent
   */
  async play(audioConfig, lang = Language.KM, fallbackText = '') {
    this.stop();

    const langConfig = audioConfig?.[lang] || audioConfig;
    const textToSpeak = langConfig?.ttsText || langConfig?.transcript || fallbackText;
    const audioUrl = langConfig?.audioUrl;

    if (!textToSpeak && !audioUrl) {
      this._setStatus(AudioPlaybackStatus.IDLE);
      return;
    }

    this.lastPrompt = { audioConfig, fallbackText };
    this.lastLang = lang;

    this._setStatus(AudioPlaybackStatus.PLAYING);

    try {
      await this.ttsProvider.speak({
        text: textToSpeak,
        lang,
        audioUrl,
        rate: this.speechRate,
        onStart: () => {
          this._setStatus(AudioPlaybackStatus.PLAYING);
        },
        onEnd: () => {
          this._setStatus(AudioPlaybackStatus.ENDED);
        },
        onError: (err) => {
          console.warn('[GuideMe AudioEngine] Playback error:', err);
          this._setStatus(AudioPlaybackStatus.ERROR, { error: err });
        },
      });
    } catch (err) {
      console.warn('[GuideMe AudioEngine] TTS dispatch failed:', err);
      this._setStatus(AudioPlaybackStatus.ERROR, { error: err });
    }
  }

  /**
   * Replay the last spoken prompt.
   */
  async replay() {
    if (this.lastPrompt) {
      return this.play(this.lastPrompt.audioConfig, this.lastLang, this.lastPrompt.fallbackText);
    }
  }

  /**
   * Stop active audio playback.
   */
  stop() {
    this.ttsProvider.stop();
    this._setStatus(AudioPlaybackStatus.IDLE);
  }

  /**
   * Pause active audio playback.
   */
  pause() {
    this.ttsProvider.pause();
    this._setStatus(AudioPlaybackStatus.PAUSED);
  }

  /**
   * Resume audio playback.
   */
  resume() {
    this.ttsProvider.resume();
    this._setStatus(AudioPlaybackStatus.PLAYING);
  }

  /**
   * Set playback speed rate (e.g. 0.85x for slow speech, 1.0x standard).
   * @param {number} rate
   */
  setRate(rate) {
    this.speechRate = Math.max(0.5, Math.min(2.0, rate || 1.0));
  }

  /**
   * Get current playback status.
   * @returns {string}
   */
  getStatus() {
    return this.status;
  }

  /**
   * Check if audio is actively playing.
   * @returns {boolean}
   */
  isPlaying() {
    return this.status === AudioPlaybackStatus.PLAYING;
  }

  /**
   * Subscribe to playback status updates.
   * @param {(status: string, details?: Object) => void} listener
   * @returns {() => void} Unsubscribe function
   */
  onStatusChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * @private
   */
  _setStatus(status, details = {}) {
    this.status = status;
    this.listeners.forEach((listener) => {
      try {
        listener(status, details);
      } catch (err) {
        console.error('[GuideMe AudioEngine] Listener callback failed:', err);
      }
    });
  }
}
