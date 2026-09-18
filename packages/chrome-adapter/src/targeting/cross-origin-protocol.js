import { TargetTier } from '@guideme/engine';

/**
 * Lightweight postMessage-based protocol so a third-party site can opt into
 * cooperative target resolution inside a cross-origin iframe by embedding
 * `apps/chrome-extension/public/guideme-embed.js` (see that file for the
 * child-side half of this protocol).
 *
 * Overlay-only: this module never simulates clicks, injects scripts into the
 * iframe, or otherwise touches the embedded page beyond asking it, via
 * postMessage, where an element is.
 */

const DEFAULT_TIMEOUT_MS = 300;
let _requestCounter = 0;

/**
 * @param {HTMLIFrameElement} iframeEl
 * @returns {boolean}
 */
export function isCrossOriginIframe(iframeEl) {
  if (!iframeEl) return false;
  try {
    // Accessing contentDocument on a cross-origin frame either throws a
    // SecurityError or (in some engines) silently returns null.
    return !iframeEl.contentDocument;
  } catch {
    return true;
  }
}

/**
 * Ask a cross-origin iframe (via its embedded `guideme-embed.js`, if present)
 * to locate `selector` inside itself. Falls back to the iframe's own
 * bounding box (a Tier-2-equivalent container highlight) if no cooperative
 * response arrives within `timeoutMs`.
 * @param {HTMLIFrameElement} iframeEl
 * @param {Object} selector
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=300]
 * @returns {Promise<{rect: Object, tier: number|string, source: string, unsupportedCooperativeIframe?: boolean, reason?: string}>}
 */
export function resolveCrossOriginIframe(iframeEl, selector, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const requestId = `guideme-locate-${Date.now()}-${_requestCounter++}`;

  return new Promise((resolve) => {
    let settled = false;
    let timer = null;

    const cleanup = () => {
      if (typeof window !== 'undefined') window.removeEventListener('message', onMessage);
      if (timer) clearTimeout(timer);
    };

    const finishAsContainer = (reason) => {
      if (settled) return;
      settled = true;
      cleanup();
      const iframeRect = iframeEl.getBoundingClientRect();
      resolve({
        rect: toBoxShape(iframeRect),
        tier: TargetTier.CANVAS_CONTAINER,
        source: 'iframe-container',
        unsupportedCooperativeIframe: true,
        reason,
      });
    };

    const onMessage = (event) => {
      if (settled) return;
      const data = event?.data;
      if (!data || data.type !== 'guideme:location' || data.requestId !== requestId) return;
      if (event.source !== iframeEl.contentWindow) return;

      settled = true;
      cleanup();

      if (!data.rect) {
        const iframeRect = iframeEl.getBoundingClientRect();
        resolve({
          rect: toBoxShape(iframeRect),
          tier: TargetTier.CANVAS_CONTAINER,
          source: 'iframe-container',
          unsupportedCooperativeIframe: true,
          reason: 'embed-script-no-match',
        });
        return;
      }

      const iframeRect = iframeEl.getBoundingClientRect();
      const top = data.rect.top + iframeRect.top;
      const left = data.rect.left + iframeRect.left;
      resolve({
        rect: {
          top,
          left,
          width: data.rect.width,
          height: data.rect.height,
          bottom: top + data.rect.height,
          right: left + data.rect.width,
          x: left,
          y: top,
          isClipped: false,
          visibleTop: top,
          visibleLeft: left,
          visibleWidth: data.rect.width,
          visibleHeight: data.rect.height,
        },
        tier: TargetTier.DOM,
        source: 'cooperative-iframe',
      });
    };

    if (typeof window === 'undefined' || !iframeEl?.contentWindow) {
      finishAsContainer('no-content-window');
      return;
    }

    window.addEventListener('message', onMessage);
    timer = setTimeout(() => finishAsContainer('timeout'), timeoutMs);

    try {
      iframeEl.contentWindow.postMessage({ type: 'guideme:locate', requestId, selector }, '*');
    } catch {
      finishAsContainer('postmessage-failed');
    }
  });
}

function toBoxShape(rect) {
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom,
    right: rect.right,
    x: rect.x ?? rect.left,
    y: rect.y ?? rect.top,
    isClipped: false,
    visibleTop: rect.top,
    visibleLeft: rect.left,
    visibleWidth: rect.width,
    visibleHeight: rect.height,
  };
}
