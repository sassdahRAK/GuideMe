import { TargetTier } from '@guideme/engine';
import { DomObserver, sanitizeCssSelector } from '../dom-observer.js';

/**
 * Registry of Tier-3 canvas coordinate maps. Any site (not just one specific
 * app) can register a map for a `<canvas>` it controls via
 * `registerCanvasMap()` — the resolver never special-cases a particular
 * product; it only knows how to look maps up by selector and validate them
 * against a live-detected version string.
 */
class CanvasMapRegistryImpl {
  constructor() {
    /** @type {Map<string, Object>} */
    this._maps = new Map();
  }

  /**
   * @param {string} canvasSelector - CSS selector identifying the canvas element
   * @param {Object} config
   * @param {string} config.version - version string this map was built against
   * @param {Array<{id: string, x: number, y: number, width: number, height: number}>} config.regions
   * @param {() => (string|null)} config.detectVersion - returns the currently detected version, or null
   */
  register(canvasSelector, config) {
    if (!canvasSelector || typeof canvasSelector !== 'string' || !config || typeof config !== 'object') {
      throw new Error('[GuideMe] registerCanvasMap requires a canvasSelector string and a config object');
    }
    if (!config.version || !Array.isArray(config.regions)) {
      throw new Error('[GuideMe] registerCanvasMap config requires { version, regions }');
    }
    this._maps.set(canvasSelector, config);
  }

  unregister(canvasSelector) {
    this._maps.delete(canvasSelector);
  }

  clear() {
    this._maps.clear();
  }

  /**
   * Find a registered map whose selector matches the given canvas element
   * (checked either by exact selector match against the requesting step's
   * own css, or by live `element.matches()` against every registered key).
   * @param {HTMLCanvasElement} canvasEl
   * @param {Object} [selector]
   * @returns {Object|null}
   */
  find(canvasEl, selector) {
    for (const [canvasSelector, config] of this._maps) {
      try {
        if (selector?.css && sanitizeCssSelector(selector.css) === sanitizeCssSelector(canvasSelector)) {
          return config;
        }
      } catch {}
      try {
        if (canvasEl?.matches?.(canvasSelector)) return config;
      } catch {}
    }
    return null;
  }
}

export const CanvasMapRegistry = new CanvasMapRegistryImpl();

/**
 * Public registration API: `GuideMe.registerCanvasMap(canvasSelector, { version, regions, detectVersion })`.
 * @param {string} canvasSelector
 * @param {Object} config
 */
export function registerCanvasMap(canvasSelector, config) {
  CanvasMapRegistry.register(canvasSelector, config);
}

export function unregisterCanvasMap(canvasSelector) {
  CanvasMapRegistry.unregister(canvasSelector);
}

// --- Optional, off-by-default OCR fallback hook (Task 2) ---
// Never invoked by resolveTarget()/resolveCanvasTarget() automatically.
// A host application must explicitly call registerOcrFallback() to wire it in.
let _ocrFallback = null;

/**
 * @param {(canvasEl: HTMLCanvasElement, selector: Object) => Promise<{x:number,y:number,width:number,height:number}|null>} fn
 */
export function registerOcrFallback(fn) {
  _ocrFallback = typeof fn === 'function' ? fn : null;
}

export function getExperimentalOcrFallback() {
  return _ocrFallback;
}

function safeDetectVersion(detectVersion) {
  if (typeof detectVersion !== 'function') return null;
  try {
    return detectVersion() || null;
  } catch {
    return null;
  }
}

/**
 * Resolve a target inside a `<canvas>` element.
 *   - No registered map            -> Tier 2, canvas's own bounding box.
 *   - Registered map, version mismatch -> Tier 2 (never guesses) + versionMismatch info.
 *   - Registered map, version match, region found -> Tier 3, scale-corrected region rect.
 * @param {HTMLCanvasElement} canvasEl
 * @param {Object} selector - may include `region` (region id within the map)
 * @returns {{rect: Object, tier: number, source: string, versionMismatch?: Object}}
 */
export function resolveCanvasTarget(canvasEl, selector = {}) {
  const containerBox = DomObserver.getBoundingBox(canvasEl);
  if (!containerBox) {
    return { rect: null, tier: TargetTier.FALLBACK, source: 'fallback:zero-size-canvas' };
  }

  const entry = CanvasMapRegistry.find(canvasEl, selector);
  if (!entry) {
    return { rect: containerBox, tier: TargetTier.CANVAS_CONTAINER, source: 'canvas-container' };
  }

  const detected = safeDetectVersion(entry.detectVersion);
  if (detected !== entry.version) {
    return {
      rect: containerBox,
      tier: TargetTier.CANVAS_CONTAINER,
      source: 'canvas-container:version-mismatch',
      versionMismatch: { expected: entry.version, detected },
    };
  }

  const region = (entry.regions || []).find((r) => r.id === selector.region);
  if (!region) {
    return {
      rect: containerBox,
      tier: TargetTier.CANVAS_CONTAINER,
      source: 'canvas-container:no-region',
    };
  }

  const canvasRect = canvasEl.getBoundingClientRect();
  const scaleX = canvasEl.width ? canvasRect.width / canvasEl.width : 1;
  const scaleY = canvasEl.height ? canvasRect.height / canvasEl.height : 1;

  const left = canvasRect.left + region.x * scaleX;
  const top = canvasRect.top + region.y * scaleY;
  const width = region.width * scaleX;
  const height = region.height * scaleY;

  return {
    rect: {
      top,
      left,
      width,
      height,
      bottom: top + height,
      right: left + width,
      x: left,
      y: top,
      isClipped: Boolean(containerBox.isClipped),
      visibleTop: top,
      visibleLeft: left,
      visibleWidth: width,
      visibleHeight: height,
    },
    tier: TargetTier.CANVAS_MAP,
    source: `canvas-map:${entry.version}${selector.region ? `:${selector.region}` : ''}`,
  };
}
