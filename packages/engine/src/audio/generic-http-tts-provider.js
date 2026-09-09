import { BaseTtsProvider, PlaceholderTtsProvider } from './audio-engine.js';
import { Language } from '@guideme/core-types';
import { globalAudioCache } from './audio-cache.js';

/**
 * Universal, Config-Driven HTTP TTS Provider.
 * Allows connecting ANY AI API endpoint (OpenAI, ElevenLabs, Google Cloud, Azure,
 * local Ollama/Whisper/Bark server, or custom AI team Khmer TTS endpoints)
 * purely through declarative configuration or template variables.
 */
export class GenericHttpTtsProvider extends BaseTtsProvider {
  /**
   * @param {Object} options
   * @param {string} options.endpoint Target API URL
   * @param {string} [options.method='POST'] HTTP method ('POST' | 'GET')
   * @param {string} [options.apiKey] Secret API key
   * @param {Record<string, string>} [options.headers] Custom HTTP headers
   * @param {Object|string} [options.bodyTemplate] JSON template or string body
   * @param {string} [options.responseType='binary'] 'binary' | 'json.base64' | 'json.url' | 'auto'
   * @param {string} [options.jsonField] Property path to audio data in JSON response (e.g. 'audioContent', 'audio_url', 'data.audio')
   * @param {string} [options.model] Default model name
   * @param {string} [options.voice] Default voice identifier
   * @param {(response: Response) => Promise<Blob|string>} [options.customResponseExtractor] Custom async parser
   */
  constructor({
    endpoint = '',
    method = 'POST',
    apiKey = '',
    headers = {},
    bodyTemplate = null,
    responseType = 'binary',
    jsonField = 'audioContent',
    model = '',
    voice = '',
    customResponseExtractor = null,
  } = {}) {
    super();
    this.endpoint = endpoint;
    this.method = method.toUpperCase();
    this.apiKey = apiKey;
    this.headers = headers;
    this.bodyTemplate = bodyTemplate;
    this.responseType = responseType;
    this.jsonField = jsonField;
    this.model = model;
    this.voice = voice;
    this.customResponseExtractor = customResponseExtractor;

    this.currentAudio = null;
    this.currentBlobUrl = null;
    this.volume = 1.0;
    this.isMuted = false;
    this._abortController = null;
    this._currentSpeechId = 0;
    this.fallbackProvider = new PlaceholderTtsProvider();
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, typeof volume === 'number' ? volume : 1.0));
    if (this.currentAudio) {
      this.currentAudio.volume = this.isMuted ? 0 : this.volume;
    }
    this.fallbackProvider.setVolume(this.volume);
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    if (this.currentAudio) {
      this.currentAudio.muted = this.isMuted;
      this.currentAudio.volume = this.isMuted ? 0 : this.volume;
    }
    this.fallbackProvider.setMuted(this.isMuted);
  }

  /**
   * Synthesize and play speech from text.
   */
  async speak({ text, lang = Language.KM, audioUrl, rate = 1.0, onStart, onEnd, onError }) {
    this.stop();
    const speechId = ++this._currentSpeechId;

    if (this.isMuted) {
      if (onStart) onStart();
      if (onEnd) onEnd();
      return;
    }

    // 1. Direct audio clip if provided
    if (audioUrl) {
      return this._playAudioUrl(audioUrl, rate, onStart, onEnd, onError, false, speechId);
    }

    // 2. Check Client-Side Audio Cache (L1 Memory / L2 IndexedDB)
    if (text) {
      try {
        const cachedBlob = await globalAudioCache.get(text, { voice: this.voice, lang, rate });
        if (this._currentSpeechId !== speechId) return;
        if (cachedBlob && typeof window !== 'undefined' && typeof URL !== 'undefined') {
          this.currentBlobUrl = URL.createObjectURL(cachedBlob);
          return this._playAudioUrl(this.currentBlobUrl, rate, onStart, onEnd, onError, true, speechId);
        }
      } catch {}
    }

    // 3. If endpoint or text is missing, or required API key is empty, fall back cleanly
    const requiresKey =
      Object.values(this.headers || {}).some((h) => String(h).includes('{{API_KEY}}')) ||
      (this.endpoint && (this.endpoint.includes('{{API_KEY}}') || this.endpoint.includes('api.openai.com') || this.endpoint.includes('api.elevenlabs.io')));

    if (!this.endpoint || !text || (requiresKey && !this.apiKey)) {
      if (this._currentSpeechId !== speechId) return;
      return this.fallbackProvider.speak({ text, lang, audioUrl, rate, onStart, onEnd, onError });
    }

    try {
      this._abortController = new AbortController();

      const { url, requestHeaders, requestBody } = this._buildRequest({ text, lang, rate });

      const fetchOptions = {
        method: this.method,
        headers: requestHeaders,
        signal: this._abortController.signal,
      };

      if (this.method !== 'GET' && this.method !== 'HEAD' && requestBody !== null) {
        fetchOptions.body = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
      }

      const response = await fetch(url, fetchOptions);
      if (this._currentSpeechId !== speechId) return;
      if (!response.ok) {
        throw new Error(`TTS HTTP ${response.status}: ${response.statusText}`);
      }

      // Extract playable audio (Blob or Audio URL)
      const audioSource = await this._extractAudio(response);
      if (this._currentSpeechId !== speechId) return;

      if (typeof audioSource === 'string') {
        return this._playAudioUrl(audioSource, rate, onStart, onEnd, onError, false, speechId);
      } else if (audioSource instanceof Blob && typeof window !== 'undefined' && typeof URL !== 'undefined') {
        await globalAudioCache.set(text, { voice: this.voice, lang, rate }, audioSource);
        if (this._currentSpeechId !== speechId) return;
        this.currentBlobUrl = URL.createObjectURL(audioSource);
        return this._playAudioUrl(this.currentBlobUrl, rate, onStart, onEnd, onError, true, speechId);
      } else {
        if (this._currentSpeechId === speechId) {
          if (onStart) onStart();
          if (onEnd) onEnd();
        }
      }
    } catch (err) {
      if (err?.name === 'AbortError' || this._currentSpeechId !== speechId) return;
      console.warn('[GuideMe GenericHttpTtsProvider] API synthesis failed, activating fallback:', err?.message || err);
      return this.fallbackProvider.speak({ text, lang, audioUrl, rate, onStart, onEnd, onError });
    }
  }

  /**
   * Interpolate template variables into endpoint, headers, and body.
   * Supports: {{TEXT}}, {{LANG}}, {{RATE}}, {{API_KEY}}, {{VOICE}}, {{MODEL}}
   * @private
   */
  _buildRequest({ text, lang, rate }) {
    const context = {
      TEXT: text,
      LANG: lang,
      RATE: rate,
      API_KEY: this.apiKey,
      VOICE: this.voice,
      MODEL: this.model,
    };

    // Interpolate URL
    const url = this._interpolate(this.endpoint, context);

    // Interpolate Headers
    const requestHeaders = {};
    for (const [key, val] of Object.entries(this.headers)) {
      requestHeaders[key] = this._interpolate(val, context);
    }

    // Default Content-Type if not provided
    if (this.method === 'POST' && !requestHeaders['Content-Type'] && !requestHeaders['content-type']) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    // Interpolate Body
    let requestBody = null;
    if (this.bodyTemplate) {
      if (typeof this.bodyTemplate === 'string') {
        requestBody = this._interpolate(this.bodyTemplate, context);
      } else {
        requestBody = this._interpolateObject(this.bodyTemplate, context);
      }
    }

    return { url, requestHeaders, requestBody };
  }

  /**
   * Extract playable audio from fetch Response.
   * @private
   */
  async _extractAudio(response) {
    if (typeof this.customResponseExtractor === 'function') {
      return await this.customResponseExtractor(response);
    }

    let contentType = '';
    if (response?.headers) {
      if (typeof response.headers.get === 'function') {
        contentType = response.headers.get('content-type') || '';
      } else if (typeof response.headers === 'object') {
        contentType = response.headers['content-type'] || response.headers['Content-Type'] || '';
      }
    }

    // Direct binary audio stream (e.g. audio/mpeg, audio/wav, audio/ogg, application/octet-stream)
    if (this.responseType === 'binary' || contentType.includes('audio/') || contentType.includes('octet-stream')) {
      return typeof response.blob === 'function' ? await response.blob() : response;
    }

    // JSON response containing Base64 audio or an audio URL
    if (contentType.includes('application/json') || this.responseType.startsWith('json')) {
      const json = await response.json();
      const rawValue = this._getNestedProperty(json, this.jsonField);

      if (!rawValue) {
        throw new Error(`JSON response missing field '${this.jsonField}'`);
      }

      // Check if it's a URL
      if (typeof rawValue === 'string' && (rawValue.startsWith('http://') || rawValue.startsWith('https://') || rawValue.startsWith('data:audio/'))) {
        return rawValue;
      }

      // Assume Base64 string -> convert to audio Blob
      return this._base64ToBlob(rawValue, 'audio/mpeg');
    }

    return await response.blob();
  }

  /**
   * Helper: Replace {{VAR}} tags in a string.
   * @private
   */
  _interpolate(templateStr, context) {
    if (typeof templateStr !== 'string') return templateStr;
    return templateStr.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, varName) => {
      return context[varName] !== undefined ? context[varName] : match;
    });
  }

  /**
   * Helper: Recursively replace {{VAR}} tags in an object or array.
   * @private
   */
  _interpolateObject(obj, context) {
    if (typeof obj === 'string') {
      // Check if the entire string is just a numeric variable like "{{RATE}}"
      const trimmed = obj.trim();
      const exactMatch = trimmed.match(/^\{\{\s*(\w+)\s*\}\}$/);
      if (exactMatch && typeof context[exactMatch[1]] === 'number') {
        return context[exactMatch[1]];
      }
      return this._interpolate(obj, context);
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this._interpolateObject(item, context));
    }
    if (obj !== null && typeof obj === 'object') {
      const result = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = this._interpolateObject(v, context);
      }
      return result;
    }
    return obj;
  }

  /**
   * Helper: Get value from nested JSON path (e.g., 'data.audio.url' or 'audioContent')
   * @private
   */
  _getNestedProperty(obj, path) {
    if (!obj || !path) return null;
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : null), obj);
  }

  /**
   * Helper: Convert Base64 string to audio Blob
   * @private
   */
  _base64ToBlob(base64Data, contentType = 'audio/mpeg') {
    if (typeof atob === 'undefined') {
      // Node.js fallback for tests
      return Buffer.from(base64Data, 'base64');
    }
    const byteCharacters = atob(base64Data.replace(/^data:audio\/\w+;base64,/, ''));
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  }

  /**
   * Play audio from an accessible URL or Object URL.
   * @private
   */
  _playAudioUrl(url, rate, onStart, onEnd, onError, isRevocable = false, speechId = undefined) {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      if (onStart) onStart();
      if (onEnd) onEnd();
      return;
    }

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.src = '';
        this.currentAudio.onplay = null;
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
      } catch {}
      this.currentAudio = null;
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
      this.currentAudio = audio;

      audio.onplay = () => {
        if (speechId === undefined || this._currentSpeechId === speechId) {
          if (onStart) onStart();
        }
      };

      const cleanup = () => {
        if (isRevocable && this.currentBlobUrl) {
          try { URL.revokeObjectURL(this.currentBlobUrl); } catch {}
          this.currentBlobUrl = null;
        }
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
      };

      audio.onended = () => {
        cleanup();
        if (speechId === undefined || this._currentSpeechId === speechId) {
          if (onEnd) onEnd();
        }
      };

      audio.onerror = (e) => {
        cleanup();
        if (speechId === undefined || this._currentSpeechId === speechId) {
          if (onError) onError(new Error(`Audio playback error: ${e?.message || 'unknown'}`));
          if (onEnd) onEnd();
        }
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[GuideMe GenericHttpTtsProvider] Autoplay blocked by browser policy:', err);
          cleanup();
          if (speechId === undefined || this._currentSpeechId === speechId) {
            if (onStart) onStart();
            if (onEnd) onEnd();
          }
        });
      }
    } catch (err) {
      if (speechId === undefined || this._currentSpeechId === speechId) {
        if (onError) onError(err);
        if (onEnd) onEnd();
      }
    }
  }

  stop() {
    this._currentSpeechId++;
    if (this._abortController) {
      try {
        this._abortController.abort();
      } catch {}
      this._abortController = null;
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.src = '';
        this.currentAudio.onplay = null;
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
      } catch {}
      this.currentAudio = null;
    }
    if (this.currentBlobUrl) {
      try {
        URL.revokeObjectURL(this.currentBlobUrl);
      } catch {}
      this.currentBlobUrl = null;
    }
    this.fallbackProvider.stop();
  }

  pause() {
    if (this.currentAudio) {
      this.currentAudio.pause();
    } else {
      this.fallbackProvider.pause();
    }
  }

  resume() {
    if (this.currentAudio) {
      this.currentAudio.play().catch(() => {});
    } else {
      this.fallbackProvider.resume();
    }
  }
}
