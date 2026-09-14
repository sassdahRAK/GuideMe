import type { FilterCandidateResult } from './fuse-filter.ts';

/**
 * Base abstract class for intent re-rankers.
 */
export abstract class BaseIntentReranker {
  /**
   * Re-ranks filtered candidate items to determine the optimal step sequence.
   * @param promptText - User goal or natural language prompt
   * @param candidates - Top Stage 1 candidate items
   * @returns Array of ordered candidate IDs (e.g. ['cand-0', 'cand-2'])
   */
  abstract rerank(promptText: string, candidates: FilterCandidateResult[]): Promise<string[]>;
}

/**
 * Local Fallback Re-Ranker.
 * Uses Stage 1 Fuse.js scores and heuristics directly with zero network calls.
 */
export class LocalFallbackReranker extends BaseIntentReranker {
  async rerank(_promptText: string, candidates: FilterCandidateResult[]): Promise<string[]> {
    if (!Array.isArray(candidates) || candidates.length === 0) return [];
    // Return top candidate IDs up to 3
    return candidates.slice(0, 3).map((c) => c.candidateId);
  }
}

export interface BackendIntentApiClientConfig {
  backendUrl?: string;
  authToken?: string;
  timeoutMs?: number;
  fetchFn?: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;
}

/**
 * Backend Intent API Client.
 * The extension acts purely as a thin API client sending candidates to the
 * GuideMe backend server, where secrets, rate limits, and LLM calls are managed.
 */
export class BackendIntentApiClient extends BaseIntentReranker {
  public backendUrl: string;
  public authToken: string;
  public timeoutMs: number;
  public fetchFn: ((url: string | URL | Request, init?: RequestInit) => Promise<Response>) | null;

  constructor(config: BackendIntentApiClientConfig = {}) {
    super();
    this.backendUrl = config.backendUrl || 'http://localhost:4000';
    this.authToken = config.authToken || '';
    this.timeoutMs = config.timeoutMs ?? 2500;
    this.fetchFn = config.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
  }

  /**
   * Sends candidate descriptors to GuideMe backend AI endpoint for re-ranking.
   */
  async rerank(promptText: string, candidates: FilterCandidateResult[]): Promise<string[]> {
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
      const endpoint = `${this.backendUrl.replace(/\/$/, '')}/api/ai/intent-rerank`;
      const headers: Record<string, string> = {
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

export interface LlmRerankerConfig {
  endpoint?: string;
  apiKey?: string;
  provider?: string;
  model?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  fetchFn?: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;
}

/**
 * Stage 2: Semantic Intent Re-Ranker via compact LLM prompt.
 * Sends only the lightweight 10-15 candidate descriptors (~250 tokens) to an LLM
 * to resolve synonyms without DOM bloat.
 */
export class LlmReranker extends BaseIntentReranker {
  public endpoint: string;
  public apiKey: string;
  public provider: string;
  public model: string;
  public headers: Record<string, string>;
  public timeoutMs: number;
  public fetchFn: ((url: string | URL | Request, init?: RequestInit) => Promise<Response>) | null;

  constructor(config: LlmRerankerConfig = {}) {
    super();
    this.endpoint = config.endpoint || '';
    this.apiKey = config.apiKey || '';
    this.provider = (config.provider || 'openai').toLowerCase();
    if (this.provider === 'gemini') {
      this.endpoint = config.endpoint || '';
      this.model = config.model || 'gemini-1.5-flash';
    } else {
      this.endpoint = config.endpoint || '';
      this.model = config.model || 'gpt-4o-mini';
    }
    this.headers = config.headers || {};
    this.timeoutMs = config.timeoutMs ?? 2500;
    this.fetchFn = config.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
  }

  /**
   * Re-ranks Stage 1 candidates using semantic LLM evaluation.
   */
  async rerank(promptText: string, candidates: FilterCandidateResult[]): Promise<string[]> {
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
      let requestOptions: RequestInit = {};

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

  private _extractTextFromResponse(data: any): string {
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

  private _parseStepIds(rawText: string): string[] {
    if (!rawText) return [];
    const cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed.stepIds)) {
        return parsed.stepIds;
      }
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      const match = cleaned.match(/"stepIds"\s*:\s*\[([^\]]+)\]/);
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
