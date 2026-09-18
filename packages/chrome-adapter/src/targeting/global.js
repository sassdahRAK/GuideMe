import { resolveTarget, resolvePlatformNative } from './resolve-target.js';
import { anchor } from './anchor.js';
import { registerCanvasMap, unregisterCanvasMap, registerOcrFallback } from './canvas-map.js';

/**
 * Attaches the public `window.GuideMe` namespace used by canvas-map
 * integrations (`GuideMe.registerCanvasMap(...)`) and by the rest of the
 * targeting system (`GuideMe.anchor(...)`). Idempotent and merges into any
 * existing object rather than clobbering it.
 * @returns {Object|null}
 */
export function installGuideMeGlobal() {
  if (typeof window === 'undefined') return null;
  const existing = window.GuideMe || {};
  window.GuideMe = Object.assign(existing, {
    resolveTarget,
    resolvePlatformNative,
    anchor,
    registerCanvasMap,
    unregisterCanvasMap,
    registerOcrFallback,
  });
  return window.GuideMe;
}
