import type { StepTarget } from '@guideme/engine';
import { DomObserver } from './dom-observer.ts';

export interface DomEventData {
  type: string;
  targetValue: string | number | readonly string[] | undefined;
  targetChecked: boolean;
  key?: string;
  originalEvent: Event;
}

/**
 * Normalizes and binds DOM event listeners on target elements.
 */
export class DomEventListener {
  /**
   * Listen to an interaction event on a target selector.
   */
  static listen(
    selector: StepTarget | null | undefined,
    eventType: string,
    callback: (data: DomEventData) => void
  ): () => void {
    if (typeof document === 'undefined') return () => {};

    let targetElement = DomObserver.findElement(selector);

    const handler = (event: any): void => {
      // Re-query if target element was not found or has been detached from document
      if (!targetElement || (typeof targetElement.isConnected === 'boolean' && !targetElement.isConnected)) {
        targetElement = DomObserver.findElement(selector);
      }

      const isDirectMatch = targetElement && (
        event.target === targetElement ||
        (typeof targetElement.contains === 'function' && targetElement.contains(event.target))
      );

      // Only use CSS selector matching when the selector is specific enough to
      // uniquely identify the element. A bare generic tag like 'button' or 'a'
      // would match every such element on the page and cause any click anywhere
      // to validate the step.
      const rawCss = (selector?.css || '').trim();
      const isGenericCss = /^(button|div|a|input|span|select|textarea|p|li|ul|ol)$/i.test(rawCss);
      const sanitizedCss = rawCss ? DomObserver.sanitizeCssSelector(rawCss) : '';

      let isCssMatch = false;
      let isClosestMatch = false;

      if (sanitizedCss && !isGenericCss && event.target) {
        try {
          isCssMatch = Boolean(event.target.matches?.(sanitizedCss));
        } catch {
          // ignore invalid selector matches error
        }
        try {
          isClosestMatch = Boolean(
            targetElement && event.target.closest?.(sanitizedCss) === targetElement
          );
        } catch {
          // ignore invalid selector closest error
        }
      }

      if (isDirectMatch || isCssMatch || isClosestMatch) {
        const payload: DomEventData = {
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
