import { DomObserver } from './dom-observer.js';

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

      const isDirectMatch = targetElement && (event.target === targetElement || targetElement.contains(event.target));

      // Only use CSS selector matching when the selector is specific enough to
      // uniquely identify the element. A bare generic tag like 'button' or 'a'
      // would match every such element on the page and cause any click anywhere
      // to validate the step.
      const isGenericCss = /^(button|div|a|input|span|select|textarea|p|li|ul|ol)$/i.test(
        (selector?.css || '').trim()
      );
      const safeCss = selector?.css ? DomObserver.sanitizeCssSelector(selector.css) : '';
      let isCssMatch = false;
      if (safeCss && !isGenericCss && event.target?.matches) {
        try {
          isCssMatch = Boolean(event.target.matches(safeCss));
        } catch {}
      }

      let isClosestMatch = false;
      if (safeCss && !isGenericCss && targetElement && event.target?.closest) {
        try {
          isClosestMatch = Boolean(event.target.closest(safeCss) === targetElement);
        } catch {}
      }

      if (isDirectMatch || isCssMatch || isClosestMatch) {
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
