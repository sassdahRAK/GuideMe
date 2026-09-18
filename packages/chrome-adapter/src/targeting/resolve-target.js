import { TargetTier } from '@guideme/engine';
import { DomObserver } from '../dom-observer.js';
import { resolveCanvasTarget } from './canvas-map.js';
import { isCrossOriginIframe, resolveCrossOriginIframe } from './cross-origin-protocol.js';

const MAX_FRAME_SEARCH_DEPTH = 5;
const MAX_FRAME_WALK_DEPTH = 20;

/**
 * Universal tiered target resolver. Every guide step ultimately calls this.
 *
 * Routes through, in order:
 *   Tier 1 — standard DOM/SVG, walked into same-origin iframes, offsets
 *            accumulated back up to window.top.
 *   Tier 2/3 — <canvas> elements, delegated to canvas-map.js.
 *   Cross-origin iframe cooperative protocol (falls back to a Tier-2-style
 *            iframe bounding box when no cooperative script responds).
 *   Fallback — directional/textual guidance anchored to the nearest known
 *            container, so a step never resolves to "nothing rendered".
 *
 * @param {Object} selector - { css, xpath, text, testId, ariaLabel, container,
 *   region, iframeCss, ... } — same shape already used across the engine,
 *   with `region` (canvas-local region id) and `iframeCss` (explicit
 *   cross-origin iframe scoping) as additive fields.
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=300] - cross-origin cooperative protocol timeout
 * @returns {Promise<{rect: Object|null, tier: number|string, source: string, [key: string]: any}>}
 */
export async function resolveTarget(selector, options = {}) {
  if (!selector || typeof selector !== 'object') {
    return { rect: null, tier: TargetTier.FALLBACK, source: 'invalid-selector' };
  }

  if (typeof document === 'undefined') {
    return { rect: null, tier: TargetTier.FALLBACK, source: 'fallback:no-document' };
  }

  // 1. Top-document resolution via the existing resilient DomObserver pipeline.
  let element = DomObserver.findElement(selector);
  let sourceDoc = document;
  let matchedInFrame = false;

  // 2. Same-origin iframe search when the top document has no match.
  if (!element) {
    const frameDocs = collectSameOriginFrameDocuments(document);
    for (const doc of frameDocs) {
      if (doc === document) continue;
      const found = findInDocument(doc, selector);
      if (found) {
        element = found;
        sourceDoc = doc;
        matchedInFrame = true;
        break;
      }
    }
  }

  if (element) {
    const tag = (element.tagName || '').toLowerCase();

    const result = tag === 'canvas'
      ? resolveCanvasTarget(element, selector)
      : resolveDomTarget(element);

    if (result.rect && matchedInFrame) {
      result.rect = accumulateFrameOffsets(sourceDoc, result.rect);
      result.source = `${result.source}:same-origin-iframe`;
    }
    return result;
  }

  // 3. Cross-origin iframe cooperative protocol — only when the step
  // explicitly scopes to an iframe we could not read directly.
  if (selector.iframeCss) {
    const iframeEl = DomObserver.querySelectorDeep(document, selector.iframeCss);
    if (iframeEl && isCrossOriginIframe(iframeEl)) {
      return resolveCrossOriginIframe(iframeEl, selector, options);
    }
  }

  // 4. Nothing resolvable — directional fallback, never silent.
  return resolveFallback(selector);
}

/**
 * Stub for Layer 4 (Google Docs/Sheets-style canvas-as-screen apps).
 * Out of scope for this pass — always reports "not implemented" so callers
 * degrade to the generic fallback rather than guessing at a screen position.
 */
export function resolvePlatformNative() {
  return { rect: null, tier: TargetTier.PLATFORM_NATIVE, source: 'not-implemented' };
}

// --- Internal helpers ---

function resolveDomTarget(element) {
  const rect = DomObserver.getBoundingBox(element);
  if (!rect) {
    return { rect: null, tier: TargetTier.FALLBACK, source: 'fallback:zero-size-element' };
  }
  return { rect, tier: TargetTier.DOM, source: 'dom' };
}

/**
 * Breadth-first collect same-origin iframe/frame documents reachable from
 * rootDoc. A cross-origin iframe throws or returns null from
 * `contentDocument` — either case is caught and simply excluded, never
 * thrown up to the caller.
 */
function collectSameOriginFrameDocuments(rootDoc) {
  const docs = [rootDoc];
  const queue = [{ doc: rootDoc, depth: 0 }];
  const seen = new Set([rootDoc]);

  while (queue.length) {
    const { doc, depth } = queue.shift();
    if (depth >= MAX_FRAME_SEARCH_DEPTH) continue;

    let frameEls = [];
    try {
      frameEls = Array.from(doc.querySelectorAll('iframe, frame'));
    } catch {
      continue;
    }

    for (const frameEl of frameEls) {
      let innerDoc = null;
      try {
        innerDoc = frameEl.contentDocument || frameEl.contentWindow?.document || null;
      } catch {
        innerDoc = null; // cross-origin boundary — stop here cleanly
      }
      if (innerDoc && !seen.has(innerDoc)) {
        seen.add(innerDoc);
        docs.push(innerDoc);
        queue.push({ doc: innerDoc, depth: depth + 1 });
      }
    }
  }

  return docs;
}

/**
 * Lightweight CSS/testId/text matching against an arbitrary document root
 * (a same-origin iframe's document). Reuses DomObserver's shadow-root-aware
 * query utilities rather than duplicating its full disambiguation pipeline —
 * iframe-embedded content is typically simpler (widgets/forms) than the
 * primary app chrome DomObserver.findElement() is tuned for.
 */
function findInDocument(doc, selector) {
  if (!doc || !selector) return null;
  // Delegates to DomObserver.isVisible, which rejects elements that are laid
  // out but not actually shown (0px, or moved far off-canvas) — a pattern
  // apps use to keep helper/proxy elements focusable for IME/accessibility
  // without displaying them (e.g. Google Sheets' #waffle-rich-text-editor).
  const isVisible = (el) => DomObserver.isVisible(el);

  if (selector.css) {
    try {
      const safeCss = DomObserver.sanitizeCssSelector(selector.css);
      const matches = DomObserver.querySelectorAllDeep(doc, safeCss);
      const visible = matches.find(isVisible);
      if (visible) return visible;
    } catch {}
  }

  if (selector.testId) {
    try {
      const el = DomObserver.querySelectorDeep(doc, `[data-testid="${selector.testId}"], [data-cy="${selector.testId}"]`);
      if (isVisible(el)) return el;
    } catch {}
  }

  if (selector.ariaLabel) {
    try {
      const escaped = selector.ariaLabel.replace(/["'\\]/g, '');
      const el = DomObserver.querySelectorDeep(doc, `[aria-label*="${escaped}" i], [title*="${escaped}" i]`);
      if (isVisible(el)) return el;
    } catch {}
  }

  if (selector.text) {
    const norm = DomObserver.normalizeText(selector.text);
    try {
      const candidates = DomObserver.querySelectorAllDeep(doc, 'button, [role="button"], a, input, select, span, div, p');
      for (const el of candidates) {
        if (DomObserver.normalizeText(el.textContent) === norm && isVisible(el)) return el;
      }
    } catch {}
  }

  return null;
}

/**
 * Accumulate ancestor-frame bounding-box offsets from `doc` up to
 * window.top, so a rect computed relative to a same-origin iframe's own
 * viewport becomes correct relative to the top-level page the overlay is
 * drawn in. Cleanly stops (never throws) the moment `frameElement` access
 * is denied by a cross-origin boundary.
 */
function accumulateFrameOffsets(doc, rect) {
  let currentWin;
  try {
    currentWin = doc?.defaultView || null;
  } catch {
    return rect;
  }

  let result = rect;
  let depth = 0;

  while (currentWin && depth < MAX_FRAME_WALK_DEPTH) {
    let top;
    try {
      top = currentWin.top;
    } catch {
      break;
    }
    if (currentWin === top) break;

    let frameEl = null;
    try {
      frameEl = currentWin.frameElement;
    } catch {
      break; // cross-origin boundary
    }
    if (!frameEl || typeof frameEl.getBoundingClientRect !== 'function') break;

    const frameRect = frameEl.getBoundingClientRect();
    result = {
      ...result,
      top: result.top + frameRect.top,
      left: result.left + frameRect.left,
      bottom: result.bottom + frameRect.top,
      right: result.right + frameRect.left,
      x: (result.x ?? result.left) + frameRect.left,
      y: (result.y ?? result.top) + frameRect.top,
      visibleTop: (result.visibleTop ?? result.top) + frameRect.top,
      visibleLeft: (result.visibleLeft ?? result.left) + frameRect.left,
      visibleWidth: result.visibleWidth ?? result.width,
      visibleHeight: result.visibleHeight ?? result.height,
    };

    try {
      currentWin = currentWin.parent;
    } catch {
      break;
    }
    depth++;
  }

  return result;
}

/**
 * Directional/textual guidance anchored to the nearest known container.
 * Always returns a real rect (never a bare null) so the overlay renders
 * *something* — worst case is a viewport-level hint.
 */
function resolveFallback(selector) {
  const doc = document;
  let containerEl = null;

  if (selector.container) {
    try { containerEl = DomObserver.querySelectorDeep(doc, selector.container); } catch {}
  }

  if (!containerEl && selector.css) {
    const parts = String(selector.css).split(',').map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      try {
        const el = DomObserver.querySelectorDeep(doc, part);
        if (el) { containerEl = el; break; }
      } catch {}
    }
  }

  const viewportEl = doc.body || doc.documentElement;
  const usedViewport = !containerEl;
  if (!containerEl) containerEl = viewportEl;

  const rect = containerEl ? DomObserver.getBoundingBox(containerEl) : null;

  return {
    rect,
    tier: TargetTier.FALLBACK,
    source: usedViewport ? 'fallback:viewport' : 'fallback:nearest-container',
    // Language-agnostic descriptor — the UI layer (ActionEngine) builds the
    // localized sentence, since resolveTarget() has no language context and
    // this codebase is bilingual (km/en) throughout.
    hintScope: usedViewport ? 'viewport' : 'container',
    hintLabel: selector?.text || selector?.ariaLabel || selector?.testId || null,
  };
}
