import { BaseTtsProvider } from './audio-engine.ts';
import type { TtsSpeakOptions } from './audio-engine.ts';
import { TtsRegistry } from './tts-registry.ts';

export interface AiTtsProviderOptions {
  apiKey?: string;
  apiUrl?: string;
  endpoint?: string;
  provider?: string;
  model?: string;
  voice?: string;
  headers?: Record<string, string>;
  bodyTemplate?: any;
  responseType?: string;
  jsonField?: string;
  [key: string]: any;
}

/**
 * Universal AI Text-to-Speech (TTS) Provider Facade.
 * Powered by GenericHttpTtsProvider & TtsRegistry for full plug-and-play capability.
 */
export class AiTtsProvider extends BaseTtsProvider {
  public apiKey: string;
  public provider: string;
  public model: string;
  public voice: string;
  public driver: BaseTtsProvider;

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
  }: AiTtsProviderOptions = {}) {
    super();
    this.apiKey = apiKey;
    this.provider = provider.toLowerCase();
    this.model = model;
    this.voice = voice;

    const targetEndpoint = endpoint || apiUrl;

    // Use TtsRegistry to instantiate the underlying generic provider
    const overrides: Record<string, any> = {
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
  async speak(options: TtsSpeakOptions): Promise<void> {
    return this.driver.speak(options);
  }

  override stop(): void {
    this.driver.stop();
  }

  override pause(): void {
    this.driver.pause();
  }

  override resume(): void {
    this.driver.resume();
  }

  override setVolume(volume: number): void {
    if (this.driver && typeof this.driver.setVolume === 'function') {
      this.driver.setVolume(volume);
    }
  }

  override setMuted(muted: boolean): void {
    if (this.driver && typeof this.driver.setMuted === 'function') {
      this.driver.setMuted(muted);
    }
  }
}
