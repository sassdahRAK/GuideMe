import Fuse from 'fuse.js';

/**
 * Stage 1: Local Candidate Reduction Filter using Fuse.js.
 * Rapidly filters hundreds of DOM element descriptors down to the top 10–15
 * candidates in <5ms locally with zero network calls.
 */
export class FuseFilter {
  /**
   * Default configuration for Fuse.js candidate filtering.
   */
  static DEFAULT_OPTIONS = {
    keys: [
      { name: 'label', weight: 0.4 },
      { name: 'text', weight: 0.3 },
      { name: 'ariaLabel', weight: 0.2 },
      { name: 'placeholder', weight: 0.15 },
      { name: 'title', weight: 0.1 },
      { name: 'name', weight: 0.05 },
      { name: 'id', weight: 0.05 },
      { name: 'href', weight: 0.05 },
    ],
    threshold: 0.5,
    ignoreLocation: true,
    minMatchCharLength: 2,
    includeScore: true,
  };

  /**
   * Filters and ranks candidate element descriptors based on user prompt.
   * @param {Array<Object>} candidates - List of element descriptors
   * @param {string} promptText - User's natural language goal or search query
   * @param {number} [limit=15] - Maximum number of candidates to return
   * @param {Object} [customOptions={}] - Fuse.js option overrides
   * @returns {Array<Object>} Filtered candidates with candidateId and score
   */
  static filterCandidates(candidates, promptText, limit = 15, customOptions = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return [];
    }

    // Clean and normalize prompt text
    const cleanPrompt = (promptText || '').trim();
    if (!cleanPrompt) {
      // If no prompt, return the first visible interactive candidates
      return candidates.slice(0, limit).map((desc, idx) => ({
        candidateId: `cand-${idx}`,
        desc,
        score: 1.0,
      }));
    }

    // Assign temporary indexing IDs for easy referencing
    const indexed = candidates.map((desc, idx) => ({
      candidateId: `cand-${idx}`,
      desc,
      label: desc.label || '',
      text: (desc.text || '').slice(0, 100),
      ariaLabel: desc.ariaLabel || '',
      placeholder: desc.placeholder || '',
      title: desc.title || '',
      name: desc.name || '',
      id: desc.id || '',
      href: desc.href || '',
      category: desc.category || 'element',
    }));

    const options = { ...this.DEFAULT_OPTIONS, ...customOptions };
    const fuse = new Fuse(indexed, options);

    // Search full prompt
    let searchResults = fuse.search(cleanPrompt);

    // If full prompt returned few results, search individual meaningful keywords
    if (searchResults.length < limit) {
      const keywords = cleanPrompt
        .toLowerCase()
        .split(/[\s,._-]+/)
        .filter((w) => w.length >= 2 && !['the', 'and', 'for', 'with', 'please', 'help', 'me', 'want', 'how', 'to'].includes(w));

      if (keywords.length > 0) {
        const seenIds = new Set(searchResults.map((r) => r.item.candidateId));
        for (const kw of keywords) {
          const kwResults = fuse.search(kw);
          for (const res of kwResults) {
            if (!seenIds.has(res.item.candidateId)) {
              seenIds.add(res.item.candidateId);
              searchResults.push(res);
            }
          }
          if (searchResults.length >= limit * 2) break;
        }
      }
    }

    // Deduplicate searchResults by candidateId, keeping the best (lowest) fuse score
    const bestResultsByCandidate = new Map();
    for (const res of searchResults) {
      const existing = bestResultsByCandidate.get(res.item.candidateId);
      if (!existing || (res.score ?? 0.5) < (existing.score ?? 0.5)) {
        bestResultsByCandidate.set(res.item.candidateId, res);
      }
    }

    // Also include candidates with strong domain heuristics
    if (typeof customOptions.heuristicScorer === 'function') {
      for (const item of indexed) {
        if (!bestResultsByCandidate.has(item.candidateId)) {
          const hScore = customOptions.heuristicScorer(item.desc);
          if (hScore > 20) {
            bestResultsByCandidate.set(item.candidateId, { item, score: 0.5 });
          }
        }
      }
    }

    // If still empty (e.g. unmatched domain terms), fallback to first interactive items
    if (bestResultsByCandidate.size === 0) {
      return indexed.slice(0, limit).map((item) => ({
        candidateId: item.candidateId,
        desc: item.desc,
        score: 1.0,
      }));
    }

    // Apply category intention bonus (inputs for search, actions for click, etc.)
    const lowerPrompt = cleanPrompt.toLowerCase();
    const isSearchIntent = /(find|search|query|look for|type|enter)\b/.test(lowerPrompt);
    const isActionIntent = /(click|press|submit|save|share|invite|buy|add)\b/.test(lowerPrompt);

    const reScored = Array.from(bestResultsByCandidate.values()).map((res) => {
      const fuseScore = res.score ?? 0.5;
      const fuseSimilarity = Math.max(0, 1 - fuseScore); // 0.0 to 1.0 (1.0 = exact)
      let matchScore = fuseSimilarity * 100; // Base score from fuzzy text matching

      if (isSearchIntent && res.item.category === 'input') {
        matchScore += 30;
      }
      if (isActionIntent && (res.item.category === 'action' || res.item.category === 'navigation')) {
        matchScore += 25;
      }

      if (typeof customOptions.heuristicScorer === 'function') {
        const hScore = customOptions.heuristicScorer(res.item.desc);
        if (hScore > 0) {
          matchScore += hScore;
        }
      }

      return {
        candidateId: res.item.candidateId,
        desc: res.item.desc,
        score: matchScore,
      };
    });

    // Sort descending by match score (highest semantic and fuzzy accuracy first)
    reScored.sort((a, b) => b.score - a.score);

    return reScored.slice(0, limit);
  }
}
