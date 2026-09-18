import Fuse from 'fuse.js';
import { safeIdSelector } from './dom-harvester.ts';
import type { HarvestedElementCandidate } from './dom-harvester.ts';
import type { TutorialDefinition } from '../types/index.ts';

/**
 * Default Fuse.js weights for element matching.
 */
const DEFAULT_FUSE_OPTIONS = {
  keys: [
    { name: 'ariaLabel', weight: 0.40 },
    { name: 'text', weight: 0.35 },
    { name: 'placeholder', weight: 0.15 },
    { name: 'testId', weight: 0.05 },
    { name: 'id', weight: 0.05 },
    { name: 'name', weight: 0.05 },
  ],
  threshold: 0.45,
  ignoreLocation: true,
  minMatchCharLength: 2,
  includeScore: true,
};

/**
 * Derives a concrete, verified, non-hallucinated CSS selector from a physical DOM candidate.
 */
export function deriveConcreteSelector(matchedItem: Partial<HarvestedElementCandidate>): string {
  if (!matchedItem) return '';
  const { id, testId, ariaLabel, name, tag, element } = matchedItem;

  // Priority 1: Safe ID selector
  if (id) {
    return safeIdSelector(id);
  }

  // Priority 2: Stable test identifier
  if (testId) {
    return `[data-testid="${testId}"]`;
  }

  // Priority 3: Specific name attribute for form inputs
  if (name && ['input', 'select', 'textarea'].includes(tag || '')) {
    return `${tag}[name="${name}"]`;
  }

  // Priority 4: Exact aria-label and resilient partial fallback
  if (ariaLabel) {
    const escaped = ariaLabel.replace(/["\\]/g, '\\$&');
    const exactSel = `${tag || '*'}[aria-label="${escaped}"]`;
    if (matchedItem.text && matchedItem.text.length >= 3 && ariaLabel.toLowerCase().includes(matchedItem.text.toLowerCase())) {
      const escapedText = matchedItem.text.replace(/["\\]/g, '\\$&');
      return `${exactSel}, ${tag || '*'}[aria-label*="${escapedText}" i]`;
    }
    return exactSel;
  }

  // Priority 5: Safe class-based selector, but ONLY when it actually resolves
  // to a single element. On utility-class-framework pages (Tailwind,
  // Bootstrap) the first class token is frequently shared by dozens of
  // elements, so an unverified `.classes[0]` selector can silently point at
  // the wrong one once re-queried later (GM-023).
  if (element && element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/).filter((c: string) => c && !c.includes(':') && !c.includes('/'));
    if (classes.length > 0) {
      const candidate = `${tag || ''}.${classes[0]}`.trim();
      if (isSelectorUniqueForElement(candidate, element)) {
        return candidate;
      }
      // Not unique — scope it to the element's position among same-tag
      // siblings under its parent instead of returning an ambiguous selector.
      const scoped = buildNthOfTypeSelector(element, tag);
      if (scoped) return scoped;
      return candidate;
    }
  }

  return tag || 'button';
}

/** True if `selector` resolves to exactly one element and that element is `el`. */
function isSelectorUniqueForElement(selector: string, el: any): boolean {
  if (typeof document === 'undefined' || !selector) return false;
  try {
    const matches = document.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === el;
  } catch {
    return false;
  }
}

/** Builds a `parentSelector > tag:nth-of-type(n)` selector scoped to el's own parent. */
function buildNthOfTypeSelector(el: any, tag?: string): string | null {
  if (typeof document === 'undefined' || !el?.parentElement) return null;
  try {
    const parent = el.parentElement;
    const tagName = (tag || el.tagName || '').toLowerCase();
    const siblings = Array.from(parent.children).filter(
      (c: any) => c.tagName?.toLowerCase() === tagName
    );
    const index = siblings.indexOf(el);
    if (index === -1) return null;
    const parentSelector = parent.id ? safeIdSelector(parent.id) : parent.tagName?.toLowerCase();
    if (!parentSelector) return null;
    return `${parentSelector} > ${tagName}:nth-of-type(${index + 1})`;
  } catch {
    return null;
  }
}

export interface MatchDomIntent {
  targetQuery?: string;
  prompt?: string;
  action?: string;
  role?: string;
  category?: string;
  expectedInput?: string;
  [key: string]: any;
}

export interface MatchedDomElementResult extends HarvestedElementCandidate {
  derivedSelector: string;
  matchScore: number;
}

/**
 * Matches harvested DOM element candidates against an AI intent specification using Fuse.js.
 * Enforces spatial layout primacy, modal prioritization, and action-role affinities.
 */
export function matchDomElementWithFuse(
  candidates: HarvestedElementCandidate[],
  intent: MatchDomIntent = {},
  options: { fuseOptions?: any; [key: string]: any } = {}
): MatchedDomElementResult | null {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const targetQuery = (intent.targetQuery || intent.prompt || '').trim();
  if (!targetQuery) {
    // If no query, return first interactive candidate
    const first = candidates[0];
    return {
      ...first,
      derivedSelector: deriveConcreteSelector(first),
      matchScore: 100,
    };
  }

  const cleanTarget = targetQuery.toLowerCase();
  const normalizedTarget = cleanTarget.replace(/\s+/g, ' ');

  // 1. Exact Match Fast-Path (with modal prioritization for disambiguation)
  const exactMatches = candidates.filter((c) => {
    const t = (c.text || '').toLowerCase().trim();
    const a = (c.ariaLabel || '').toLowerCase().trim();
    const p = (c.placeholder || '').toLowerCase().trim();
    const n = (c.name || '').toLowerCase().trim();
    const i = (c.id || '').toLowerCase().trim();
    return t === normalizedTarget || a === normalizedTarget || p === normalizedTarget || n === normalizedTarget || i === normalizedTarget;
  });

  if (exactMatches.length === 1) {
    const exact = exactMatches[0];
    return {
      ...exact,
      derivedSelector: deriveConcreteSelector(exact),
      matchScore: 200,
    };
  } else if (exactMatches.length > 1) {
    const modalMatch = exactMatches.find((c) => c.isInModal);
    const exact = modalMatch || exactMatches[0];
    return {
      ...exact,
      derivedSelector: deriveConcreteSelector(exact),
      matchScore: 200,
    };
  }

  // 2. Fuse.js Fuzzy Indexing
  const fuseOptions = { ...DEFAULT_FUSE_OPTIONS, ...options.fuseOptions };
  const fuse = new Fuse(candidates, fuseOptions);
  let searchResults = fuse.search(targetQuery);

  // Fallback: search individual keywords if multi-word phrase returned 0 matches
  if (searchResults.length === 0) {
    const keywords = targetQuery.split(/\s+/).filter((w) => w.length >= 2);
    const seenMap = new Map<any, any>();
    for (const kw of keywords) {
      const subResults = fuse.search(kw);
      for (const res of subResults) {
        if (!seenMap.has(res.item.element)) {
          seenMap.set(res.item.element, res);
          searchResults.push(res);
        }
      }
    }
  }

  if (searchResults.length === 0) {
    return null;
  }

  // 3. Spatial & Context-Aware Scoring (Tie-Breaker)
  const isInputIntent = intent.action === 'input' || intent.role === 'input' || intent.category === 'search';
  const isClickIntent = intent.action === 'click' || intent.role === 'button' || intent.role === 'link';

  const scored = searchResults.map(({ item, score: rawFuseScore }) => {
    const fuseScore = rawFuseScore ?? 0.5;
    let score = Math.max(0, 1 - fuseScore) * 100;

    // A. Modal / Dialog Primacy (+40)
    if (item.isInModal) {
      score += 40;
    }

    // B. Viewport Visibility (+25)
    if (typeof window !== 'undefined') {
      const vh = window.innerHeight || 800;
      const vw = window.innerWidth || 1200;
      const r = item.rect;
      if (r.top >= 0 && r.left >= 0 && r.bottom <= vh && r.right <= vw) {
        score += 25;
      }
    }

    // C. Action-Role Affinity (+30)
    if (isInputIntent && item.isInput) {
      score += 30;
    } else if (isClickIntent && !item.isInput) {
      score += 30;
    }

    // D. Partial Prefix or Substring Bonus
    const lowerText = (item.text || '').toLowerCase();
    const lowerAria = (item.ariaLabel || '').toLowerCase();
    if (lowerText.startsWith(cleanTarget) || lowerAria.startsWith(cleanTarget)) {
      score += 35;
    } else if (lowerText.includes(cleanTarget) || lowerAria.includes(cleanTarget)) {
      score += 20;
    }

    // E. Penalty for long container text walls
    if ((item.text || '').length > 60) {
      score -= 25;
    }

    return {
      candidate: item,
      score,
      fuseScore: rawFuseScore,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return null;

  // Never match brand/home logo navigation icons when looking for in-app commands.
  // Checks `.id` (not `.selector` — raw harvested candidates never have that field,
  // it's only derived later via deriveConcreteSelector()), which is where product
  // branding links like "docs-branding-logo-link" actually carry the "brand" marker.
  const isNavLogo = /docs-homescreen|\b(docs|sheets|slides|forms|drive)\s*home\b|brand|logo/i.test(
    `${best.candidate.ariaLabel || ''} ${(best.candidate as any).id || ''} ${best.candidate.text || ''}`
  );
  if (isNavLogo && !/home|logo|ទំព័រដើម/i.test(cleanTarget)) {
    return null;
  }

  // Minimum confidence requirement: score must be at least 60
  if (best.score < 60) {
    return null;
  }

  const winner = best.candidate;
  if (!winner) return null;

  return {
    ...winner,
    derivedSelector: deriveConcreteSelector(winner),
    matchScore: best.score,
  };
}

/**
 * Synthesizes a valid, fully formed declarative GuideMe tutorial from a matched DOM candidate.
 */
export function synthesizeGroundedTutorial(
  matched: MatchedDomElementResult,
  intent: MatchDomIntent = {},
  _options: Record<string, any> = {}
): TutorialDefinition {
  const targetLabel = matched.text || matched.ariaLabel || matched.placeholder || intent.targetQuery || 'Element';
  const isInput = matched.isInput || intent.action === 'input';
  const actionType = isInput ? 'input' : 'click';
  const selector = matched.derivedSelector || deriveConcreteSelector(matched);

  const tutorialId = `grounded-guide-${Date.now()}`;
  const titleKm = isInput ? `វាយបញ្ចូលក្នុង ${targetLabel}` : `ចុចលើ ${targetLabel}`;
  const titleEn = isInput ? `Type into ${targetLabel}` : `Click ${targetLabel}`;

  const descKm = isInput
    ? `វាយបញ្ចូល "${intent.expectedInput || ''}" នៅក្នុងប្រអប់នេះដើម្បីបន្ត។`
    : `ចុចលើប៊ូតុង "${targetLabel}" ដើម្បីអនុវត្តសកម្មភាពនេះ។`;
  const descEn = isInput
    ? `Type "${intent.expectedInput || ''}" into this field to continue.`
    : `Click the "${targetLabel}" button to proceed.`;

  const hasValidParentMenu = Boolean(
    matched.parentMenu &&
    !/docs-homescreen|\b(docs|sheets|slides|forms|drive)\s*home\b|brand|logo/i.test(matched.parentMenu)
  );

  return {
    id: tutorialId,
    version: '1.0.0',
    name: {
      km: `ការណែនាំ៖ ${targetLabel}`,
      en: `Walkthrough: ${targetLabel}`,
    },
    description: {
      km: descKm,
      en: descEn,
    },
    matchUrls: ['<all_urls>'],
    steps: hasValidParentMenu ? [
      {
        id: `step-1`,
        title: {
          km: `ចុចលើ ${matched.parentMenu}`,
          en: `Click ${matched.parentMenu}`,
        },
        description: {
          km: `ចុចលើម៉ឺនុយ "${matched.parentMenu}" ដើម្បីបើកជម្រើស។`,
          en: `Click "${matched.parentMenu}" to open the options.`,
        },
        target: {
          css: `[aria-label*="${matched.parentMenu}" i], [title*="${matched.parentMenu}" i]`,
          text: matched.parentMenu,
          ariaLabel: matched.parentMenu,
        },
        action: {
          type: 'spotlight',
          title: {
            km: `ចុចលើ ${matched.parentMenu}`,
            en: `Click ${matched.parentMenu}`,
          },
          content: {
            km: `ចុចលើម៉ឺនុយ "${matched.parentMenu}" ដើម្បីបើកជម្រើស។`,
            en: `Click "${matched.parentMenu}" to open the options.`,
          },
          placement: 'bottom',
        },
        validation: {
          type: 'click',
        },
      },
      {
        id: `step-2`,
        title: {
          km: titleKm,
          en: titleEn,
        },
        description: {
          km: descKm,
          en: descEn,
        },
        target: {
          css: selector,
          text: matched.text || undefined,
          ariaLabel: matched.ariaLabel || undefined,
          testId: matched.testId || undefined,
        },
        action: {
          type: 'spotlight',
          title: {
            km: titleKm,
            en: titleEn,
          },
          content: {
            km: descKm,
            en: descEn,
          },
          placement: 'bottom',
        },
        validation: {
          type: actionType,
          expectedValue: isInput ? (intent.expectedInput || undefined) : undefined,
        },
      },
    ] : [
      {
        id: `step-1`,
        title: {
          km: titleKm,
          en: titleEn,
        },
        description: {
          km: descKm,
          en: descEn,
        },
        target: {
          css: selector,
          text: matched.text || undefined,
          ariaLabel: matched.ariaLabel || undefined,
          testId: matched.testId || undefined,
        },
        action: {
          type: 'spotlight',
          title: {
            km: titleKm,
            en: titleEn,
          },
          content: {
            km: descKm,
            en: descEn,
          },
          placement: 'bottom',
        },
        validation: {
          type: actionType,
          expectedValue: isInput ? (intent.expectedInput || undefined) : undefined,
        },
      },
    ],
  };
}
