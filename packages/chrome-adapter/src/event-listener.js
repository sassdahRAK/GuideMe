import { DomObserver, sanitizeCssSelector } from './dom-observer.js';

/**
 * Normalizes and binds DOM event listeners on target elements.
 */
export class DomEventListener {
  /**
   * Listen to an interaction event on a target selector.
   * @param {Object} selector
   * @param {string} eventType
   * @param {(data: Object) => void} callback
   * @returns {() => void} Unsubscribe function
   */
  static listen(selector, eventType, callback) {
    if (typeof document === 'undefined') return () => {};

    let targetElement = DomObserver.findElement(selector);

    const handler = (event) => {
      // Re-query if target element was not found or has been detached from document
      if (!targetElement || (typeof targetElement.isConnected === 'boolean' && !targetElement.isConnected)) {
        targetElement = DomObserver.findElement(selector);
      }

      const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];

      // Guard: Strictly ignore all events originating from within GuideMe's UI root / Shadow DOM overlay
      const isInsideGuideMe = path.some(
        (node) =>
          node &&
          (node.id === 'guideme-tutorial-root' ||
           node.tagName === 'GUIDEME-TUTORIAL-ROOT' ||
           (node.classList && node.classList.contains && (node.classList.contains('guideme-root-overlay') || node.classList.contains('guideme-card-pop'))))
      );
      if (isInsideGuideMe) {
        return;
      }

      const isDirectMatch = Boolean(targetElement && (path.includes(targetElement) || event.target === targetElement || targetElement.contains(event.target)));

      let isCssMatch = false;
      let isClosestMatch = false;

      if (selector?.css) {
        const subSelectors = selector.css.split(',').map((s) => s.trim()).filter(Boolean);
        for (const sub of subSelectors) {
          try {
            if (path.some((node) => node && node.matches && (node.matches(sub) || (node.closest && node.closest(sub))))) {
              isCssMatch = true;
              break;
            }
          } catch {
            const sanitized = sanitizeCssSelector(sub);
            if (sanitized && sanitized !== sub) {
              try {
                if (path.some((node) => node && node.matches && (node.matches(sanitized) || (node.closest && node.closest(sanitized))))) {
                  isCssMatch = true;
                  break;
                }
              } catch {}
            }
          }
        }
      }

      let isTextOrAriaMatch = false;
      if (selector?.text || selector?.ariaLabel) {
        const normTargetText = selector.text ? DomObserver.normalizeText(selector.text) : '';
        const normTargetAria = selector.ariaLabel ? selector.ariaLabel.trim().toLowerCase() : '';

        for (const node of path) {
          if (!node || !node.getAttribute) continue;
          const nodeText = DomObserver.normalizeText(node.textContent || '');
          const nodeAria = (node.getAttribute('aria-label') || node.getAttribute('title') || '').trim().toLowerCase();
          if ((normTargetText && nodeText.includes(normTargetText)) || (normTargetAria && nodeAria.includes(normTargetAria))) {
            isTextOrAriaMatch = true;
            break;
          }
        }
      }

      if (isDirectMatch || isCssMatch || isClosestMatch || isTextOrAriaMatch) {
        const payload = {
          type: eventType,
          targetValue: event.target?.value ?? targetElement?.value ?? '',
          targetChecked: event.target?.checked ?? targetElement?.checked ?? false,
          key: event.key,
          originalEvent: event,
        };
        callback(payload);
      }
    };

    // Use capture phase so we observe clicks before host page might stop propagation
    document.addEventListener(eventType, handler, true);

    return () => {
      document.removeEventListener(eventType, handler, true);
    };
  }
}
