/**
 * Base abstract class for intent re-rankers.
 */
export class BaseIntentReranker {
  /**
   * Re-ranks filtered candidate items to determine the optimal step sequence.
   * @param {string} promptText - User goal or natural language prompt
   * @param {Array<{ candidateId: string, desc: Object, score: number }>} candidates - Top Stage 1 candidate items
   * @returns {Promise<Array<string>>} Array of ordered candidate IDs (e.g. ['cand-0', 'cand-2'])
   */
  async rerank(promptText, candidates) {
    throw new Error('rerank() must be implemented by subclass');
  }
}

/**
 * Local Fallback Re-Ranker.
 * Uses Stage 1 Fuse.js scores and heuristics directly with zero network calls.
 */
export class LocalFallbackReranker extends BaseIntentReranker {
  async rerank(promptText, candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0) return [];
    // Return top candidate IDs up to 3
    return candidates.slice(0, 3).map((c) => c.candidateId);
  }
}

/**
 * Backend Intent API Client.
 * The extension acts purely as a thin API client sending candidates to the
 * GuideMe backend server, where secrets, rate limits, and LLM calls are managed.
 */
export class BackendIntentApiClient extends BaseIntentReranker {
  /**
   * @param {Object} config
   * @param {string} [config.backendUrl='http://localhost:5000']
   * @param {string} [config.authToken='']
   * @param {number} [config.timeoutMs=2500]
   * @param {Function} [config.fetchFn]
   */
  constructor(config = {}) {
    super();
    this.backendUrl = config.backendUrl || 'http://localhost:5000';
    this.authToken = config.authToken || '';
    this.timeoutMs = config.timeoutMs ?? 2500;
    this.fetchFn = config.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
  }

  /**
   * Sends candidate descriptors to GuideMe backend AI endpoint for re-ranking.
   * @param {string} promptText
   * @param {Array<{ candidateId: string, desc: Object, score: number }>} candidates
   * @returns {Promise<Array<string>>}
   */
  async rerank(promptText, candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0) return [];
    if (candidates.length === 1 || !promptText.trim()) return candidates.map((c) => c.candidateId);

    if (!this.fetchFn) {
      throw new Error('[BackendIntentApiClient] No fetch implementation available.');
    }

    const compactCandidates = candidates.map((c) => ({
      id: c.candidateId,
      category: c.desc.category || 'action',
      label: c.desc.label || '',
      text: (c.desc.text || '').slice(0, 40),
    }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const endpoint = `${this.backendUrl.replace(/\/$/, '')}/api/v1/ai/intent-rerank`;
      const headers = {
        'Content-Type': 'application/json',
      };
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const response = await this.fetchFn(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify({
          prompt: promptText,
          candidates: compactCandidates,
        }),
      });

      if (!response.ok) {
        throw new Error(`[BackendIntentApiClient] HTTP error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const stepIds = data?.stepIds;
      if (!Array.isArray(stepIds) || stepIds.length === 0) {
        throw new Error('[BackendIntentApiClient] Backend returned no stepIds.');
      }

      const validIdSet = new Set(candidates.map((c) => c.candidateId));
      return stepIds.filter((id) => validIdSet.has(id));
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Stage 2: Semantic Intent Re-Ranker via compact LLM prompt.
 * Sends only the lightweight 10-15 candidate descriptors (~250 tokens) to an LLM
 * to resolve synonyms (e.g. "invite" -> "Share") without DOM bloat.
 */
export class LlmReranker extends BaseIntentReranker {
  /**
   * @param {Object} config
   * @param {string} [config.endpoint] - API Endpoint URL
   * @param {string} [config.apiKey] - Authorization API Key
   * @param {string} [config.provider='openai'] - Provider preset ('openai' | 'gemini' | 'custom')
   * @param {string} [config.model] - Model name (e.g. 'gpt-4o-mini', 'gemini-1.5-flash')
   * @param {Object} [config.headers={}] - Extra HTTP headers
   * @param {number} [config.timeoutMs=2500] - Request timeout in milliseconds
   * @param {Function} [config.fetchFn] - Custom fetch implementation for testing
   */
  constructor(config = {}) {
    super();
    this.endpoint = config.endpoint || '';
    this.apiKey = config.apiKey || '';
    this.provider = (config.provider || 'openai').toLowerCase();
    this.model = config.model || (this.provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini');
    this.headers = config.headers || {};
    this.timeoutMs = config.timeoutMs ?? 2500;
    this.fetchFn = config.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
  }

  /**
   * Re-ranks Stage 1 candidates using semantic LLM evaluation.
   * @param {string} promptText
   * @param {Array<{ candidateId: string, desc: Object, score: number }>} candidates
   * @returns {Promise<Array<string>>}
   */
  async rerank(promptText, candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return [];
    }

    // If only 1 candidate or no prompt, no re-ranking needed
    if (candidates.length === 1 || !promptText.trim()) {
      return candidates.map((c) => c.candidateId);
    }

    if (!this.fetchFn) {
      throw new Error('[LlmReranker] No fetch implementation available.');
    }

    // Format compact candidate representation for token efficiency (<250 tokens)
    const compactCandidates = candidates.map((c) => ({
      id: c.candidateId,
      category: c.desc.category || 'action',
      label: c.desc.label || '',
      text: (c.desc.text || '').slice(0, 40),
    }));

    const systemPrompt =
      'You are an interactive tutorial engine. Given a user goal and UI candidates, return the 1 to 3 candidate IDs in order of interaction needed to fulfill the goal. Return ONLY JSON matching: {"stepIds": ["cand-0", ...]}';

    const userMessage = JSON.stringify({
      userGoal: promptText,
      candidates: compactCandidates,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      let requestUrl = this.endpoint;
      let requestOptions = {};

      if (this.provider === 'gemini') {
        // Gemini REST API format
        const endpointBase = this.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models';
        requestUrl = `${endpointBase}/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
        requestOptions = {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...this.headers,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userMessage }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          }),
        };
      } else {
        // OpenAI / Compatible standard format
        requestUrl = this.endpoint || 'https://api.openai.com/v1/chat/completions';
        requestOptions = {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            ...this.headers,
          },
          body: JSON.stringify({
            model: this.model,
            temperature: 0.1,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            response_format: { type: 'json_object' },
          }),
        };
      }

      const response = await this.fetchFn(requestUrl, requestOptions);

      if (!response.ok) {
        throw new Error(`[LlmReranker] HTTP error ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      const rawText = this._extractTextFromResponse(responseData);
      const stepIds = this._parseStepIds(rawText);

      // Validate returned candidate IDs against original candidates
      const validIdSet = new Set(candidates.map((c) => c.candidateId));
      const filteredStepIds = stepIds.filter((id) => validIdSet.has(id));

      if (filteredStepIds.length === 0) {
        throw new Error('[LlmReranker] LLM returned no valid candidate IDs matching input list.');
      }

      return filteredStepIds;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Extracts raw text from provider JSON responses.
   * @param {Object} data
   * @returns {string}
   * @private
   */
  _extractTextFromResponse(data) {
    if (!data) return '';
    // OpenAI format
    if (data.choices && data.choices[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    // Gemini format
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }
    // Custom format
    if (typeof data.text === 'string') return data.text;
    if (Array.isArray(data.stepIds)) return JSON.stringify(data);
    return JSON.stringify(data);
  }

  /**
   * Safely parses step IDs array from raw response text.
   * @param {string} rawText
   * @returns {Array<string>}
   * @private
   */
  _parseStepIds(rawText) {
    if (!rawText) return [];
    try {
      const parsed = JSON.parse(rawText.trim());
      if (Array.isArray(parsed.stepIds)) {
        return parsed.stepIds;
      }
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Regex fallback if LLM output wrapped with markdown or comments
      const match = rawText.match(/"stepIds"\s*:\s*\[([^\]]+)\]/);
      if (match) {
        try {
          const arr = JSON.parse(`[${match[1]}]`);
          if (Array.isArray(arr)) return arr;
        } catch {}
      }
    }
    return [];
  }
}
