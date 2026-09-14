import { AudioPlaybackStatus, Language } from '../types/index.ts';
import { globalAudioCache } from './audio-cache.ts';

export interface TtsSpeakOptions {
  text?: string;
  lang?: string;
  audioUrl?: string;
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
}

/**
 * Base interface for TTS & Audio Synthesis Providers.
 * The AI team can implement this class and inject their API client.
 */
export abstract class BaseTtsProvider {
  /**
   * Speak or synthesize text.
   */
  abstract speak(options: TtsSpeakOptions): Promise<void>;

  /**
   * Stop any current synthesis or playback.
   */
  stop(): void {}

  /**
   * Pause synthesis or playback.
   */
  pause(): void {}

  /**
   * Resume synthesis or playback.
   */
  resume(): void {}

  /**
   * Set playback volume (0.0 to 1.0).
   */
  setVolume(_volume: number): void {}

  /**
   * Set mute state.
   */
  setMuted(_muted: boolean): void {}
}

export interface PlaceholderTtsProviderOptions {
  backendUrl?: string;
}

/**
 * Default Placeholder TTS Provider.
 * Ready for the AI team's custom API endpoint.
 * Provides resilient fallback in browser environments.
 */
export class PlaceholderTtsProvider extends BaseTtsProvider {
  public backendUrl: string;
  private _currentTimeout: any = null;
  private _audioElement: HTMLAudioElement | null = null;
  private _isPaused: boolean = false;
  public volume: number = 1.0;
  public isMuted: boolean = false;
  private _abortController: AbortController | null = null;
  private _currentBlobUrl: string | null = null;
  private _currentSpeechId: number = 0;

  constructor({ backendUrl = 'http://localhost:4000' }: PlaceholderTtsProviderOptions = {}) {
    super();
    this.backendUrl = backendUrl;
  }

  override setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, typeof volume === 'number' ? volume : 1.0));
    if (this._audioElement) {
      this._audioElement.volume = this.isMuted ? 0 : this.volume;
    }
  }

  override setMuted(muted: boolean): void {
    this.isMuted = Boolean(muted);
    if (this._audioElement) {
      this._audioElement.muted = this.isMuted;
      this._audioElement.volume = this.isMuted ? 0 : this.volume;
    }
  }

  /**
   * Update the backend URL at runtime (e.g. after resolving from storage).
   */
  setBackendUrl(url: string): void {
    if (url) this.backendUrl = url;
  }

  async speak({ text, lang, audioUrl, rate = 1.0, onStart, onEnd, onError }: TtsSpeakOptions): Promise<void> {
    this.stop();
    const speechId = ++this._currentSpeechId;

    if (this.isMuted) {
      if (onStart) onStart();
      if (onEnd) onEnd();
      return;
    }

    // 1. If pre-recorded or explicit audio URL is provided, use HTML5 Audio
    if (audioUrl) {
      if ((audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) && typeof window !== 'undefined' && typeof URL !== 'undefined') {
        try {
          const blob = await this._fetchAudioBlob(audioUrl);
          if (this._currentSpeechId !== speechId) return;
          if (blob) {
            if (this._currentBlobUrl) {
              try { URL.revokeObjectURL(this._currentBlobUrl); } catch { }
            }
            this._currentBlobUrl = URL.createObjectURL(blob);
            return this._playAudioElement(this._currentBlobUrl, rate, onStart, onEnd, onError, speechId);
          }
        } catch { }
      }
      if (this._currentSpeechId !== speechId) return;
      return this._playAudioElement(audioUrl, rate, onStart, onEnd, onError, speechId);
    }

    const language = lang === Language.EN || lang === 'en' ? 'en' : 'km';
    const speed = rate < 0.9 ? 'slow' : rate > 1.1 ? 'fast' : 'normal';

    // 2. Check Client-Side Audio Cache (L1 Memory / L2 IndexedDB)
    if (text) {
      try {
        const cachedBlob = await globalAudioCache.get(text, { lang: language, rate: speed, voice: 'edge-tts' });
        if (this._currentSpeechId !== speechId) return;
        if (cachedBlob && typeof window !== 'undefined' && typeof URL !== 'undefined') {
          if (this._currentBlobUrl) {
            try { URL.revokeObjectURL(this._currentBlobUrl); } catch { }
          }
          this._currentBlobUrl = URL.createObjectURL(cachedBlob);
          return this._playAudioElement(this._currentBlobUrl, rate, onStart, onEnd, onError, speechId);
        }
      } catch (err) {
        // Cache read failure is non-blocking
      }
    }

    // 3. Synthesize audio dynamically via GuideMe Backend (Edge TTS Neural Voice)
    if (text && typeof fetch !== 'undefined' && this.backendUrl) {
      try {
        this._abortController = new AbortController();
        const base = this.backendUrl.replace(/\/+$/, '');
        const endpoints = [`${base}/api/tts/synthesize`];

        let data: any = null;
        for (const endpoint of endpoints) {
          try {
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, language, speed }),
              signal: this._abortController.signal,
            });
            if (this._currentSpeechId !== speechId) return;
            if (res.ok) {
              data = await res.json();
              if (data?.audioUrl) break;
            }
          } catch (e: any) {
            if (e.name === 'AbortError' || this._currentSpeechId !== speechId) return; // Cancelled cleanly
          }
        }

        if (this._currentSpeechId !== speechId) return;

        if (data?.audioUrl) {
          try {
            const blob = await this._fetchAudioBlob(data.audioUrl, this._abortController?.signal);
            if (this._currentSpeechId !== speechId) return;
            if (blob && typeof window !== 'undefined' && typeof URL !== 'undefined') {
              await globalAudioCache.set(text, { lang: language, rate: speed, voice: 'edge-tts' }, blob);
              if (this._currentSpeechId !== speechId) return;
              if (this._currentBlobUrl) {
                try { URL.revokeObjectURL(this._currentBlobUrl); } catch { }
              }
              this._currentBlobUrl = URL.createObjectURL(blob);
              return this._playAudioElement(this._currentBlobUrl, rate, onStart, onEnd, onError, speechId);
            }
          } catch (blobErr) {
            console.warn('[GuideMe Audio] Failed to prepare blob audio URL:', blobErr);
          }

          if (this._currentSpeechId !== speechId) return;
          return this._playAudioElement(data.audioUrl, rate, onStart, onEnd, onError, speechId);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || this._currentSpeechId !== speechId) return;
        console.warn('[GuideMe Audio] Backend TTS synthesis request failed, falling back:', err?.message || err);
      }
    }

    if (this._currentSpeechId !== speechId) return;

    // 4. Web Speech API fallback (if supported in browser for English)
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined' &&
      (lang === Language.EN || lang === 'en')
    ) {
      try {
        window.speechSynthesis.cancel();
        if (this._currentSpeechId !== speechId) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;
        utterance.lang = 'en-US';
        utterance.volume = this.isMuted ? 0 : this.volume;
        utterance.onstart = () => {
          if (this._currentSpeechId === speechId && onStart) onStart();
        };
        utterance.onend = () => {
          if (this._currentSpeechId === speechId && onEnd) onEnd();
        };
        utterance.onerror = (e) => {
          if (this._currentSpeechId !== speechId) return;
          console.warn('[GuideMe Audio] Web Speech error:', e);
          this._simulatePlayback({ text, rate, onStart, onEnd, speechId });
        };
        window.speechSynthesis.speak(utterance);
        return;
      } catch (err) {
        // Fall through to simulation
      }
    }

    // 5. Simulated placeholder playback (synchronizes UI equalizer waves without blocking)
    if (this._currentSpeechId === speechId) {
      this._simulatePlayback({ text, rate, onStart, onEnd, speechId });
    }
  }

  private _playAudioElement(
    url: string,
    rate: number,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (err: Error) => void,
    speechId?: number
  ): void {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      if (onStart) onStart();
      if (onEnd) onEnd();
      return;
    }

    // Ensure any existing audio element or web speech is immediately stopped
    if (this._audioElement) {
      try {
        this._audioElement.pause();
        this._audioElement.src = '';
        this._audioElement.onplay = null;
        this._audioElement.onended = null;
        this._audioElement.onerror = null;
      } catch {}
      this._audioElement = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }

    if (speechId !== undefined && this._currentSpeechId !== speechId) {
      return;
    }

    try {
      const audio = new Audio(url);
      audio.playbackRate = rate || 1.0;
      audio.volume = this.isMuted ? 0 : this.volume;
      audio.muted = this.isMuted;
      this._audioElement = audio;

      audio.onplay = () => {
        if (speechId === undefined || this._currentSpeechId === speechId) {
          if (onStart) onStart();
        }
      };
      audio.onended = () => {
        if (this._audioElement === audio) {
          this._audioElement = null;
        }
        if (speechId === undefined || this._currentSpeechId === speechId) {
          if (onEnd) onEnd();
        }
      };
      audio.onerror = (e) => {
        if (this._audioElement === audio) {
          this._audioElement = null;
        }
        if (speechId === undefined || this._currentSpeechId === speechId) {
          console.warn('[GuideMe Audio] Audio element playback failed:', e);
          if (onError) onError(new Error('Audio element playback error'));
          if (onEnd) onEnd();
        }
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (this._audioElement === audio) {
            this._audioElement = null;
          }
          if (speechId === undefined || this._currentSpeechId === speechId) {
            console.warn('[GuideMe Audio] Audio autoplay restricted by browser:', err);
            if (onStart) onStart();
            if (onEnd) onEnd();
          }
        });
      }
    } catch (err) {
      console.warn('[GuideMe Audio] HTML5 Audio initialization failed:', err);
      if (onStart) onStart();
      if (onEnd) onEnd();
    }
  }

  private async _fetchAudioBlob(url: string, signal: AbortSignal | null = null): Promise<Blob | null> {
    if (!url || typeof fetch === 'undefined') return null;
    if (url.startsWith('blob:') || url.startsWith('data:')) return null;

    try {
      const fetchOpts: RequestInit = signal ? { signal } : {};
      const res = await fetch(url, fetchOpts);
      if (res.ok) {
        return await res.blob();
      }
    } catch {
      // Direct fetch could be blocked by connect-src CSP on certain host pages
    }

    // Fallback: proxy fetch via extension background worker
    if (typeof chrome !== 'undefined' && (chrome.runtime as any)?.sendMessage) {
      try {
        const response = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage(
            { action: 'GUIDEME_PROXY_FETCH_AUDIO_BASE64', payload: { url } },
            (res) => resolve(res)
          );
        });
        if (response?.success && response?.base64 && typeof atob !== 'undefined') {
          const byteCharacters = atob(response.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          return new Blob([byteArray], { type: response.contentType || 'audio/mpeg' });
        }
      } catch {}
    }

    return null;
  }

  private _simulatePlayback({ text, rate, onStart, onEnd, speechId }: { text?: string; rate: number; onStart?: () => void; onEnd?: () => void; speechId?: number }): void {
    if (speechId !== undefined && this._currentSpeechId !== speechId) return;
    if (onStart) onStart();
    const wordCount = (text || '').split(/\s+/).length || 5;
    const estimatedDurationMs = Math.max(1200, Math.min(6000, (wordCount * 250) / rate));

    this._currentTimeout = setTimeout(() => {
      this._currentTimeout = null;
      if (speechId === undefined || this._currentSpeechId === speechId) {
        if (onEnd) onEnd();
      }
    }, estimatedDurationMs);
  }

  override stop(): void {
    this._currentSpeechId++;
    if (this._abortController) {
      try {
        this._abortController.abort();
      } catch {}
      this._abortController = null;
    }
    if (this._currentBlobUrl && typeof URL !== 'undefined') {
      try {
        URL.revokeObjectURL(this._currentBlobUrl);
      } catch {}
      this._currentBlobUrl = null;
    }
    if (this._currentTimeout) {
      clearTimeout(this._currentTimeout);
      this._currentTimeout = null;
    }
    if (this._audioElement) {
      try {
        this._audioElement.pause();
        this._audioElement.src = '';
        this._audioElement.onplay = null;
        this._audioElement.onended = null;
        this._audioElement.onerror = null;
      } catch {}
      this._audioElement = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
  }

  override pause(): void {
    this._isPaused = true;
    if (this._audioElement) {
      this._audioElement.pause();
    }
  }

  override resume(): void {
    this._isPaused = false;
    if (this._audioElement) {
      this._audioElement.play().catch(() => {});
    }
  }
}

export type AudioStatusListener = (status: string, details?: any) => void;

export interface AudioEngineOptions {
  ttsProvider?: BaseTtsProvider | null;
}

/**
 * Universal Audio & Voice Guidance Controller.
 * Dispatches voice prompts, manages playback states, and coordinates with UI equalizer animations.
 */
export class AudioEngine {
  public ttsProvider: BaseTtsProvider;
  public status: string;
  public speechRate: number;
  public volume: number;
  public muted: boolean;
  public lastPrompt: { audioConfig: any; fallbackText: string } | null;
  public lastLang: string;
  public listeners: Set<AudioStatusListener>;
  private _currentPlayId: number;

  constructor({ ttsProvider = null }: AudioEngineOptions = {}) {
    this.ttsProvider = ttsProvider || new PlaceholderTtsProvider();
    this.status = AudioPlaybackStatus.IDLE;
    this.speechRate = 1.0;
    this.volume = 1.0;
    this.muted = false;
    this.lastPrompt = null;
    this.lastLang = Language.KM;
    this.listeners = new Set();
    this._currentPlayId = 0;
  }

  /**
   * Set playback volume (0.0 to 1.0).
   */
  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, typeof vol === 'number' ? vol : 1.0));
    if (this.ttsProvider && typeof this.ttsProvider.setVolume === 'function') {
      this.ttsProvider.setVolume(this.volume);
    }
    this._setStatus(this.status, { volume: this.volume, isMuted: this.muted });
  }

  /**
   * Get current playback volume.
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Set mute state.
   */
  setMuted(muted: boolean): void {
    this.muted = Boolean(muted);
    if (this.ttsProvider && typeof this.ttsProvider.setMuted === 'function') {
      this.ttsProvider.setMuted(this.muted);
    }
    if (this.muted && this.isPlaying()) {
      this.stop();
    }
    this._setStatus(this.status, { volume: this.volume, isMuted: this.muted });
  }

  /**
   * Check if audio is currently muted.
   */
  isMuted(): boolean {
    return this.muted;
  }

  /**
   * Toggle mute state.
   */
  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Set custom TTS provider at runtime.
   */
  setTtsProvider(provider: BaseTtsProvider): void {
    if (provider && typeof provider.speak === 'function') {
      this.stop();
      this.ttsProvider = provider;
    }
  }

  /**
   * Play or synthesize voice prompt for a given step.
   */
  async play(audioConfig: any, lang: string = Language.KM, fallbackText: string = ''): Promise<void> {
    this.stop();
    const playId = ++this._currentPlayId;

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
          if (this._currentPlayId === playId) {
            this._setStatus(AudioPlaybackStatus.PLAYING);
          }
        },
        onEnd: () => {
          if (this._currentPlayId === playId) {
            this._setStatus(AudioPlaybackStatus.ENDED);
          }
        },
        onError: (err) => {
          if (this._currentPlayId === playId) {
            console.warn('[GuideMe AudioEngine] Playback error:', err);
            this._setStatus(AudioPlaybackStatus.ERROR, { error: err });
          }
        },
      });
    } catch (err) {
      if (this._currentPlayId === playId) {
        console.warn('[GuideMe AudioEngine] TTS dispatch failed:', err);
        this._setStatus(AudioPlaybackStatus.ERROR, { error: err });
      }
    }
  }

  /**
   * Replay the last spoken prompt.
   */
  async replay(): Promise<void> {
    if (this.lastPrompt) {
      return this.play(this.lastPrompt.audioConfig, this.lastLang, this.lastPrompt.fallbackText);
    }
  }

  /**
   * Stop active audio playback.
   */
  stop(): void {
    this._currentPlayId++;
    this.ttsProvider.stop();
    this._setStatus(AudioPlaybackStatus.IDLE);
  }

  /**
   * Pause active audio playback.
   */
  pause(): void {
    this.ttsProvider.pause();
    this._setStatus(AudioPlaybackStatus.PAUSED);
  }

  /**
   * Resume audio playback.
   */
  resume(): void {
    this.ttsProvider.resume();
    this._setStatus(AudioPlaybackStatus.PLAYING);
  }

  /**
   * Set playback speed rate (e.g. 0.85x for slow speech, 1.0x standard).
   */
  setRate(rate: number): void {
    this.speechRate = Math.max(0.5, Math.min(2.0, rate || 1.0));
  }

  /**
   * Get current playback status.
   */
  getStatus(): string {
    return this.status;
  }

  /**
   * Check if audio is actively playing.
   */
  isPlaying(): boolean {
    return this.status === AudioPlaybackStatus.PLAYING;
  }

  /**
   * Subscribe to playback status updates.
   */
  onStatusChange(listener: AudioStatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private _setStatus(status: string, details: any = {}): void {
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
