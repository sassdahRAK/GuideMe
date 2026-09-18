import { resolveTarget } from './resolve-target.js';

const HYSTERESIS_PX = 1;

function resultsDiffer(a, b) {
  if (a === b) return false;
  if (!a || !b) return true;
  if (a.tier !== b.tier || a.source !== b.source) return true;
  const ar = a.rect;
  const br = b.rect;
  if (ar === br) return false;
  if (!ar || !br) return true;
  return (
    Math.abs(ar.left - br.left) >= HYSTERESIS_PX ||
    Math.abs(ar.top - br.top) >= HYSTERESIS_PX ||
    Math.abs(ar.width - br.width) >= HYSTERESIS_PX ||
    Math.abs(ar.height - br.height) >= HYSTERESIS_PX ||
    Boolean(ar.isClipped) !== Boolean(br.isClipped)
  );
}

/**
 * `GuideMe.anchor(target, callback)` — the single public entry point the
 * rest of the system calls to keep a resolved target in sync with the live
 * page. Watches document mutations, scroll, and resize; on any change it
 * re-runs `resolveTarget()` from scratch (never reuses a cached rect across
 * a reflow) and, only when the result actually moved, invokes `callback`.
 *
 * @param {Object} target - selector passed straight through to resolveTarget()
 * @param {(result: {rect: Object|null, tier: number|string, source: string}) => void} callback
 * @returns {() => void} unobserve — stops all listeners/observers
 */
export function anchor(target, callback) {
  if (typeof callback !== 'function') {
    throw new Error('[GuideMe] anchor(target, callback) requires a callback function');
  }

  let running = true;
  let rafHandle = null;
  let generation = 0;
  let lastResult = null;

  const recompute = () => {
    if (!running) return;
    const myGeneration = ++generation;
    Promise.resolve(resolveTarget(target)).then((result) => {
      if (!running || myGeneration !== generation) return; // superseded by a newer recompute
      if (resultsDiffer(lastResult, result)) {
        lastResult = result;
        callback(result);
      }
    });
  };

  const scheduleRecompute = () => {
    if (!running || rafHandle !== null) return;
    const raf = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (fn) => setTimeout(fn, 16);
    rafHandle = raf(() => {
      rafHandle = null;
      recompute();
    });
  };

  const observer = typeof MutationObserver !== 'undefined'
    ? new MutationObserver(scheduleRecompute)
    : null;
  observer?.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', scheduleRecompute, { passive: true, capture: true });
    window.addEventListener('resize', scheduleRecompute, { passive: true });
  }

  // Initial resolution.
  scheduleRecompute();

  return function unobserve() {
    running = false;
    observer?.disconnect();
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', scheduleRecompute, { capture: true });
      window.removeEventListener('resize', scheduleRecompute);
    }
    if (rafHandle !== null) {
      const cancel = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout;
      cancel(rafHandle);
      rafHandle = null;
    }
  };
}
