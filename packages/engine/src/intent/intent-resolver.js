import { FuseFilter } from './fuse-filter.js';
import { LocalFallbackReranker } from './llm-reranker.js';

/**
 * Two-Stage Hybrid Intent Resolver (ADR-006).
 * Orchestrates Stage 1 (Fuse.js local candidate reduction) and
 * Stage 2 (Semantic LLM re-ranking) with automatic, zero-latency local fallback.
 */
export class IntentResolver {
  /**
   * @param {Object} [config]
   * @param {import('./llm-reranker.js').BaseIntentReranker} [config.reranker]
   * @param {number} [config.candidateLimit=15]
   */
  constructor(config = {}) {
    this.reranker = config.reranker || new LocalFallbackReranker();
    this.candidateLimit = config.candidateLimit || 15;
  }

  /**
   * Resolves natural language prompt to a cohesive sequence of candidate descriptors.
   * Runs Stage 1 (<5ms) followed by Stage 2 (with graceful fallback on failure).
   *
   * @param {Array<Object>} candidates - All extracted element descriptors from DOM
   * @param {string} promptText - User goal or prompt
   * @param {Object} [options={}]
   * @param {number} [options.maxSteps=3] - Maximum number of steps to return
   * @returns {Promise<Array<Object>>} Selected, ordered candidate descriptors
   */
  async resolve(candidates, promptText, options = {}) {
    const maxSteps = options.maxSteps || 3;
    const cleanPrompt = (promptText || '').trim();

    // 1. Stage 1: Local candidate reduction via Fuse.js (<5ms)
    const stage1Results = FuseFilter.filterCandidates(candidates, cleanPrompt, this.candidateLimit, {
      heuristicScorer: options.heuristicScorer,
    });

    if (stage1Results.length === 0) {
      return [];
    }

    // Fast path: if only 1 candidate, return it directly
    if (stage1Results.length === 1) {
      return [stage1Results[0].desc];
    }

    // Map candidateId to descriptor for fast lookup
    const idToDescMap = new Map();
    for (const item of stage1Results) {
      idToDescMap.set(item.candidateId, item.desc);
    }

    // 2. Stage 2: Semantic re-ranking via LLM (or fallback)
    let orderedCandidates = [];
    let rerankSucceeded = false;

    if (this.reranker && !(this.reranker instanceof LocalFallbackReranker)) {
      try {
        const selectedIds = await this.reranker.rerank(cleanPrompt, stage1Results);
        if (Array.isArray(selectedIds) && selectedIds.length > 0) {
          for (const id of selectedIds) {
            const desc = idToDescMap.get(id);
            if (desc) {
              orderedCandidates.push(desc);
            }
          }
          if (orderedCandidates.length > 0) {
            rerankSucceeded = true;
          }
        }
      } catch (err) {
        console.warn('[IntentResolver] Stage 2 LLM re-ranking failed or timed out. Falling back to Stage 1 Fuse.js:', err.message);
      }
    }

    // If Stage 2 was not used, failed, or returned empty, fallback to Stage 1 order
    if (!rerankSucceeded) {
      orderedCandidates = stage1Results.map((item) => item.desc);
    }

    // 3. Enforce Step Sequence Discipline (ADR-010 & ADR-011)
    return this._enforceSequenceDiscipline(orderedCandidates, cleanPrompt, maxSteps);
  }

  /**
   * Synchronous pure Stage 1 resolution (100% offline, 0ms latency).
   * @param {Array<Object>} candidates
   * @param {string} promptText
   * @param {Object} [options={}]
   * @returns {Array<Object>}
   */
  resolveSync(candidates, promptText, options = {}) {
    const maxSteps = options.maxSteps || 3;
    const cleanPrompt = (promptText || '').trim();
    const stage1Results = FuseFilter.filterCandidates(candidates, cleanPrompt, this.candidateLimit, {
      heuristicScorer: options.heuristicScorer,
    });

    if (stage1Results.length === 0) return [];

    const orderedCandidates = stage1Results.map((item) => item.desc);
    return this._enforceSequenceDiscipline(orderedCandidates, cleanPrompt, maxSteps);
  }

  /**
   * Enforces single-input discipline and synthesizes dynamic follow-up result clicks.
   * @param {Array<Object>} candidates
   * @param {string} promptText
   * @param {number} maxSteps
   * @returns {Array<Object>}
   * @private
   */
  _enforceSequenceDiscipline(candidates, promptText, maxSteps) {
    const selected = [];
    let hasInputStep = false;

    for (const desc of candidates) {
      if (!desc) continue;

      // ADR-011: Never have duplicate input steps for a single search action
      if (desc.category === 'input') {
        if (hasInputStep) continue;
        hasInputStep = true;
      }

      selected.push(desc);
      if (selected.length >= maxSteps) break;
    }

    // Extract any entity/query target mentioned in the prompt (e.g. named mytube, "mytube")
    let extractedQuery = '';
    const quotedMatch = promptText.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      extractedQuery = quotedMatch[1].trim();
    } else {
      // 1. Explicit named entity (e.g. "named mytube", "called mytube")
      const namedMatch = promptText.match(/(?:named\s+as|named|called)\s+([A-Za-z0-9_.-]+)/i);
      if (namedMatch) {
        extractedQuery = namedMatch[1].trim();
      } else {
        // 2. Direct search/find entity (e.g. "search mytube", "find mytube", "repo mytube")
        const actionMatch = promptText.match(/(?:search|find|for|repo|repository)\s+(?:for\s+)?([A-Za-z0-9_.-]+)/i);
        if (actionMatch && !['a', 'the', 'repository', 'repo', 'project', 'page'].includes(actionMatch[1].toLowerCase())) {
          extractedQuery = actionMatch[1].trim();
        }
      }
    }

    // If workflow involves typing a search query entity, append dynamic result step
    if (hasInputStep && extractedQuery) {
      const alreadyHasResult = selected.some(
        (s) => s.isDynamicResult || (s.label && s.label.toLowerCase().includes(extractedQuery.toLowerCase()))
      );
      if (!alreadyHasResult) {
        const resultItem = {
          category: 'navigation',
          label: extractedQuery,
          text: extractedQuery,
          isDynamicResult: true,
          extractedQuery,
        };
        if (selected.length >= maxSteps) {
          selected[selected.length - 1] = resultItem;
        } else {
          selected.push(resultItem);
        }
      }
    }

    return selected;
  }
}
