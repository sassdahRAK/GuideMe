import { LlmReranker, LocalFallbackReranker, BackendIntentApiClient } from './llm-reranker.js';

/**
 * Built-in AI configuration presets for Stage 2 re-ranking.
 */
export const AI_PRESETS = {
  openai: {
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
  },
  gemini: {
    provider: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    model: 'gemini-1.5-flash',
  },
};

/**
 * Registry and factory for Intent Re-Rankers.
 * Mirrors the TtsRegistry pattern for consistent, zero-boilerplate configuration.
 */
export class IntentRegistry {
  static _customFactories = new Map();

  /**
   * Register a custom re-ranker factory.
   * @param {string} name
   * @param {(config: Object) => import('./llm-reranker.js').BaseIntentReranker} factory
   */
  static register(name, factory) {
    this._customFactories.set(name.toLowerCase(), factory);
  }

  /**
   * Creates an intent re-ranker instance from a preset name or configuration object.
   * @param {string|Object} presetOrConfig
   * @param {Object} [overrides={}]
   * @returns {import('./llm-reranker.js').BaseIntentReranker}
   */
  static create(presetOrConfig = 'openai', overrides = {}) {
    // 1. Custom factory
    if (typeof presetOrConfig === 'string' && this._customFactories.has(presetOrConfig.toLowerCase())) {
      const factory = this._customFactories.get(presetOrConfig.toLowerCase());
      return factory(overrides);
    }

    // 2. Built-in preset
    if (typeof presetOrConfig === 'string' && AI_PRESETS[presetOrConfig.toLowerCase()]) {
      const basePreset = AI_PRESETS[presetOrConfig.toLowerCase()];
      return new LlmReranker({
        ...basePreset,
        ...overrides,
        headers: { ...(basePreset.headers || {}), ...(overrides.headers || {}) },
      });
    }

    // 3. Custom config object
    if (typeof presetOrConfig === 'object' && presetOrConfig !== null) {
      if (presetOrConfig.backendUrl) {
        return new BackendIntentApiClient({
          ...presetOrConfig,
          ...overrides,
        });
      }
      return new LlmReranker({
        ...presetOrConfig,
        ...overrides,
      });
    }

    // Default local fallback
    return new LocalFallbackReranker();
  }

  /**
   * Dynamically instantiates an intent re-ranker from environment variables.
   * Prioritizes backend API client (where server secrets live), with direct
   * developer fallback or zero-latency local fallback.
   * @param {Object} env
   * @returns {import('./llm-reranker.js').BaseIntentReranker}
   */
  static fromEnv(env = {}) {
    const backendUrl = env.WXT_BACKEND_URL || env.VITE_BACKEND_URL || env.BACKEND_URL || '';
    const authToken = env.WXT_AUTH_TOKEN || env.VITE_AUTH_TOKEN || env.AUTH_TOKEN || '';
    const timeoutMs = Number(env.WXT_AI_TIMEOUT_MS || env.AI_TIMEOUT_MS) || 2500;

    // 1. Strict Client/Server: If backend URL is provided, extension acts purely as an API client
    if (backendUrl) {
      return new BackendIntentApiClient({
        backendUrl,
        authToken,
        timeoutMs,
      });
    }

    const apiKey = env.WXT_AI_API_KEY || env.VITE_AI_API_KEY || env.AI_API_KEY || '';
    const endpoint = env.WXT_AI_ENDPOINT || env.VITE_AI_ENDPOINT || env.AI_ENDPOINT || '';
    const preset = env.WXT_AI_PRESET || env.WXT_AI_PROVIDER || env.AI_PRESET || (apiKey ? 'openai' : '');

    // 2. Direct developer testing mode if API key or endpoint configured
    if (apiKey || endpoint) {
      const model = env.WXT_AI_MODEL || env.AI_MODEL || '';
      let customHeaders = {};
      if (env.WXT_AI_HEADERS || env.AI_HEADERS) {
        try {
          customHeaders = JSON.parse(env.WXT_AI_HEADERS || env.AI_HEADERS);
        } catch {}
      }

      const overrides = {
        apiKey,
        timeoutMs,
        headers: customHeaders,
      };
      if (endpoint) overrides.endpoint = endpoint;
      if (model) overrides.model = model;

      return this.create(preset || 'openai', overrides);
    }

    // 3. Offline / unconfigured fallback: use zero-latency local fallback
    return new LocalFallbackReranker();
  }
}
