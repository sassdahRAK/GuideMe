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
      // Direct element match or event delegated from child
      if (targetElement && (event.target === targetElement || targetElement.contains(event.target))) {
        const payload = {
          type: eventType,
          targetValue: event.target?.value ?? '',
          targetChecked: event.target?.checked ?? false,
          key: event.key,
          originalEvent: event,
        };
        callback(payload);
      } else if (!targetElement) {
        // Retry finding element if rendered late
        targetElement = DomObserver.findElement(selector);
        if (targetElement && (event.target === targetElement || targetElement.contains(event.target))) {
          callback({
            type: eventType,
            targetValue: event.target?.value ?? '',
            targetChecked: event.target?.checked ?? false,
            key: event.key,
            originalEvent: event,
          });
        }
      }
    };

    // Use capture phase so we observe clicks before host page might stop propagation
    document.addEventListener(eventType, handler, true);

    return () => {
      document.removeEventListener(eventType, handler, true);
    };
  }
}
