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
      const isCssMatch = Boolean(selector?.css && event.target?.matches?.(selector.css));
      const isClosestMatch = Boolean(selector?.css && targetElement && event.target?.closest?.(selector.css) === targetElement);

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
