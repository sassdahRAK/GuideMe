import { BaseTtsProvider } from './audio-engine.js';
import { GenericHttpTtsProvider } from './generic-http-tts-provider.js';
import { TtsRegistry } from './tts-registry.js';
import { Language } from '@guideme/core-types';

/**
 * Universal AI Text-to-Speech (TTS) Provider Facade.
 * Powered by GenericHttpTtsProvider & TtsRegistry for full plug-and-play capability.
 */
export class AiTtsProvider extends BaseTtsProvider {
  /**
   * @param {Object} [options]
   * @param {string} [options.apiKey] API Key
   * @param {string} [options.apiUrl] Custom Endpoint URL
   * @param {string} [options.endpoint] Custom Endpoint URL
   * @param {string} [options.provider='openai'] Preset name ('openai' | 'elevenlabs' | 'google-cloud' | 'azure-speech' | 'custom')
   * @param {string} [options.model] Model ID
   * @param {string} [options.voice] Voice ID/Name
   * @param {Record<string, string>} [options.headers] Custom HTTP headers
   * @param {Object|string} [options.bodyTemplate] Custom body template
   * @param {string} [options.responseType='binary'] 'binary' | 'json.base64' | 'json.url'
   * @param {string} [options.jsonField] Path in JSON response containing audio
   */
  constructor({
    apiKey = '',
    apiUrl = '',
    endpoint = '',
    provider = 'openai',
    model = '',
    voice = '',
    headers = {},
    bodyTemplate = null,
    responseType = '',
    jsonField = '',
    ...rest
  } = {}) {
    super();
    this.apiKey = apiKey;
    this.provider = provider.toLowerCase();
    this.model = model;
    this.voice = voice;

    const targetEndpoint = endpoint || apiUrl;

    // Use TtsRegistry to instantiate the underlying generic provider
    const overrides = {
      apiKey,
      ...rest,
    };
    if (targetEndpoint) overrides.endpoint = targetEndpoint;
    if (model) overrides.model = model;
    if (voice) overrides.voice = voice;
    if (Object.keys(headers).length > 0) overrides.headers = headers;
    if (bodyTemplate) overrides.bodyTemplate = bodyTemplate;
    if (responseType) overrides.responseType = responseType;
    if (jsonField) overrides.jsonField = jsonField;

    this.driver = TtsRegistry.create(this.provider, overrides);
  }

  /**
   * Speak text via the configured AI driver.
   */
  async speak(options) {
    return this.driver.speak(options);
  }

  stop() {
    this.driver.stop();
  }

  pause() {
    this.driver.pause();
  }

  resume() {
    this.driver.resume();
  }
}
