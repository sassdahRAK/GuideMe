import { BaseTtsProvider, PlaceholderTtsProvider } from './audio-engine.js';
import { Language } from '@guideme/core-types';

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
    this.fallbackProvider = new PlaceholderTtsProvider();
  }

  /**
   * Synthesize and play speech from text.
   */
  async speak({ text, lang = Language.KM, audioUrl, rate = 1.0, onStart, onEnd, onError }) {
    this.stop();

    // 1. Direct audio clip if provided
    if (audioUrl) {
      return this._playAudioUrl(audioUrl, rate, onStart, onEnd, onError);
    }

    // 2. If endpoint or text is missing, fall back to browser synthesis
    if (!this.endpoint || !text) {
      return this.fallbackProvider.speak({ text, lang, audioUrl, rate, onStart, onEnd, onError });
    }

    try {
      if (onStart) onStart();

      const { url, requestHeaders, requestBody } = this._buildRequest({ text, lang, rate });

      const fetchOptions = {
        method: this.method,
        headers: requestHeaders,
      };

      if (this.method !== 'GET' && this.method !== 'HEAD' && requestBody !== null) {
        fetchOptions.body = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
      }

      const response = await fetch(url, fetchOptions);
      if (!response.ok) {
        throw new Error(`TTS HTTP ${response.status}: ${response.statusText}`);
      }

      // Extract playable audio (Blob or Audio URL)
      const audioSource = await this._extractAudio(response);

      if (typeof audioSource === 'string') {
        // Direct URL or Data URI
        return this._playAudioUrl(audioSource, rate, null, onEnd, onError, false);
      } else if (audioSource instanceof Blob && typeof window !== 'undefined' && typeof URL !== 'undefined') {
        this.currentBlobUrl = URL.createObjectURL(audioSource);
        return this._playAudioUrl(this.currentBlobUrl, rate, null, onEnd, onError, true);
      } else {
        if (onEnd) onEnd();
      }
    } catch (err) {
      console.warn('[GuideMe GenericHttpTtsProvider] API synthesis failed, activating fallback:', err);
      if (onError) onError(err);
      return this.fallbackProvider.speak({ text, lang, audioUrl, rate, onStart: null, onEnd, onError });
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
  _playAudioUrl(url, rate, onStart, onEnd, onError, isRevocable = false) {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      if (onEnd) onEnd();
      return;
    }

    try {
      const audio = new Audio(url);
      audio.playbackRate = rate || 1.0;
      this.currentAudio = audio;

      audio.onplay = () => {
        if (onStart) onStart();
      };

      const cleanup = () => {
        if (isRevocable && this.currentBlobUrl) {
          URL.revokeObjectURL(this.currentBlobUrl);
          this.currentBlobUrl = null;
        }
        this.currentAudio = null;
      };

      audio.onended = () => {
        cleanup();
        if (onEnd) onEnd();
      };

      audio.onerror = (e) => {
        cleanup();
        if (onError) onError(new Error(`Audio playback error: ${e?.message || 'unknown'}`));
        if (onEnd) onEnd();
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[GuideMe GenericHttpTtsProvider] Autoplay blocked by browser policy:', err);
          cleanup();
          if (onEnd) onEnd();
        });
      }
    } catch (err) {
      if (onError) onError(err);
      if (onEnd) onEnd();
    }
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
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
