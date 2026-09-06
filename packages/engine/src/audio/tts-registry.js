import { GenericHttpTtsProvider } from './generic-http-tts-provider.js';
import { PlaceholderTtsProvider } from './audio-engine.js';

/**
 * Built-in presets for common AI TTS providers.
 * All presets use GenericHttpTtsProvider under the hood, making them
 * fully customizable and non-hardcoded.
 */
export const TTS_PRESETS = {
  openai: {
    endpoint: 'https://api.openai.com/v1/audio/speech',
    method: 'POST',
    headers: {
      Authorization: 'Bearer {{API_KEY}}',
      'Content-Type': 'application/json',
    },
    bodyTemplate: {
      model: '{{MODEL}}',
      input: '{{TEXT}}',
      voice: '{{VOICE}}',
      speed: '{{RATE}}',
    },
    model: 'tts-1',
    voice: 'alloy',
    responseType: 'binary',
  },

  elevenlabs: {
    endpoint: 'https://api.elevenlabs.io/v1/text-to-speech/{{VOICE}}',
    method: 'POST',
    headers: {
      'xi-api-key': '{{API_KEY}}',
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    bodyTemplate: {
      text: '{{TEXT}}',
      model_id: '{{MODEL}}',
    },
    model: 'eleven_multilingual_v2',
    voice: '21m00Tcm4TlvDq8ikWAM',
    responseType: 'binary',
  },

  'google-cloud': {
    endpoint: 'https://texttospeech.googleapis.com/v1/text:synthesize?key={{API_KEY}}',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    bodyTemplate: {
      input: { text: '{{TEXT}}' },
      voice: { languageCode: '{{LANG}}', name: '{{VOICE}}' },
      audioConfig: { audioEncoding: 'MP3', speakingRate: '{{RATE}}' },
    },
    voice: 'en-US-Neural2-F',
    responseType: 'json.base64',
    jsonField: 'audioContent',
  },

  'azure-speech': {
    endpoint: 'https://{{MODEL}}.tts.speech.microsoft.com/cognitiveservices/v1',
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': '{{API_KEY}}',
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
    },
    bodyTemplate: "<speak version='1.0' xml:lang='{{LANG}}'><voice name='{{VOICE}}'>{{TEXT}}</voice></speak>",
    model: 'eastus',
    voice: 'en-US-JennyNeural',
    responseType: 'binary',
  },
};

/**
 * Universal TTS Registry & Factory.
 * Enables zero-boilerplate, plug-and-play AI audio drivers.
 */
export class TtsRegistry {
  static _customFactories = new Map();

  /**
   * Register a custom provider factory function or preset.
   * @param {string} name
   * @param {(config: Object) => import('./audio-engine.js').BaseTtsProvider} factory
   */
  static register(name, factory) {
    this._customFactories.set(name.toLowerCase(), factory);
  }

  /**
   * Create a TTS Provider instance dynamically from preset name or custom config object.
   * @param {string|Object} presetOrConfig
   * @param {Object} [overrides={}]
   * @returns {import('./audio-engine.js').BaseTtsProvider}
   */
  static create(presetOrConfig = 'openai', overrides = {}) {
    // 1. Custom registered factory
    if (typeof presetOrConfig === 'string' && this._customFactories.has(presetOrConfig.toLowerCase())) {
      const factory = this._customFactories.get(presetOrConfig.toLowerCase());
      return factory(overrides);
    }

    // 2. Built-in preset
    if (typeof presetOrConfig === 'string' && TTS_PRESETS[presetOrConfig.toLowerCase()]) {
      const basePreset = TTS_PRESETS[presetOrConfig.toLowerCase()];
      return new GenericHttpTtsProvider({
        ...basePreset,
        ...overrides,
        headers: { ...(basePreset.headers || {}), ...(overrides.headers || {}) },
        bodyTemplate: overrides.bodyTemplate || basePreset.bodyTemplate,
      });
    }

    // 3. Complete custom configuration object
    if (typeof presetOrConfig === 'object' && presetOrConfig !== null) {
      return new GenericHttpTtsProvider({
        ...presetOrConfig,
        ...overrides,
      });
    }

    // Default fallback
    return new PlaceholderTtsProvider();
  }

  /**
   * Build a TTS Provider automatically from environment variables or settings.
   * @param {Object} env
   * @returns {import('./audio-engine.js').BaseTtsProvider}
   */
  static fromEnv(env = {}) {
    const apiKey = env.WXT_TTS_API_KEY || env.VITE_TTS_API_KEY || env.TTS_API_KEY || '';
    const endpoint = env.WXT_TTS_ENDPOINT || env.WXT_TTS_API_URL || env.TTS_ENDPOINT || '';
    const preset = env.WXT_TTS_PRESET || env.WXT_TTS_PROVIDER || env.TTS_PRESET || (apiKey ? 'openai' : '');

    // If no external API key and no custom endpoint are configured, fall back to built-in speech provider
    if (!apiKey && !endpoint) {
      return new PlaceholderTtsProvider();
    }

    const model = env.WXT_TTS_MODEL || env.TTS_MODEL || '';
    const voice = env.WXT_TTS_VOICE || env.TTS_VOICE || '';
    const responseType = env.WXT_TTS_RESPONSE_TYPE || env.TTS_RESPONSE_TYPE || '';
    const jsonField = env.WXT_TTS_JSON_FIELD || env.TTS_JSON_FIELD || '';

    // Custom headers from env (if provided as JSON string)
    let customHeaders = {};
    if (env.WXT_TTS_HEADERS || env.TTS_HEADERS) {
      try {
        customHeaders = JSON.parse(env.WXT_TTS_HEADERS || env.TTS_HEADERS);
      } catch {}
    }

    // Custom body template from env (if provided as JSON string)
    let customBody = null;
    if (env.WXT_TTS_BODY_TEMPLATE || env.TTS_BODY_TEMPLATE) {
      try {
        customBody = JSON.parse(env.WXT_TTS_BODY_TEMPLATE || env.TTS_BODY_TEMPLATE);
      } catch {
        customBody = env.WXT_TTS_BODY_TEMPLATE || env.TTS_BODY_TEMPLATE;
      }
    }

    // If completely custom endpoint without preset
    if (endpoint && preset === 'custom') {
      return new GenericHttpTtsProvider({
        endpoint,
        apiKey,
        headers: customHeaders,
        bodyTemplate: customBody,
        model,
        voice,
        responseType: responseType || 'binary',
        jsonField: jsonField || 'audioContent',
      });
    }

    // If using preset with overrides
    const overrides = { apiKey };
    if (endpoint) overrides.endpoint = endpoint;
    if (model) overrides.model = model;
    if (voice) overrides.voice = voice;
    if (responseType) overrides.responseType = responseType;
    if (jsonField) overrides.jsonField = jsonField;
    if (Object.keys(customHeaders).length > 0) overrides.headers = customHeaders;
    if (customBody) overrides.bodyTemplate = customBody;

    return this.create(preset, overrides);
  }
}
