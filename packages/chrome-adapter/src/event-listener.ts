import type { StepTarget } from '@guideme/engine';
import { DomObserver } from './dom-observer.ts';

export interface DomEventData {
  type: string;
  targetValue: string | number | readonly string[] | undefined;
  targetChecked: boolean;
  key?: string;
  originalEvent: Event;
  // 'direct' = clicked the actual resolved element; 'css'/'closest' = matched
  // via selector — useful for tracing why a step validated (see matchType
  // usage below).
  matchType?: 'direct' | 'css' | 'closest';
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

    // Pre-sanitize so .matches() / .closest() never throw on selectors like #:6j
    const safeCss = selector?.css ? DomObserver.sanitizeCssSelector(selector.css) : '';

    // How many elements on the page this selector actually matches. AI-picked
    // selectors are frequently a shared utility/class name (e.g.
    // ".docs-material-button") rather than a truly unique one — the bare-tag
    // check below only rejects "button", not "button.docs-material-button"
    // which can still match dozens of unrelated toolbar buttons. Re-checked
    // lazily (not on every event) since the DOM can change between clicks.
    let cachedMatchCount: number | null = null;
    let cachedForCss: string | null = null;
    const getMatchCount = (): number => {
      if (!safeCss) return 0;
      if (cachedForCss === safeCss && cachedMatchCount !== null) return cachedMatchCount;
      try {
        cachedMatchCount = document.querySelectorAll(safeCss).length;
      } catch {
        cachedMatchCount = 0;
      }
      cachedForCss = safeCss;
      return cachedMatchCount;
    };

    const handler = (event: any): void => {
      // Re-query if target element was not found or has been detached from document
      if (!targetElement || (typeof targetElement.isConnected === 'boolean' && !targetElement.isConnected)) {
        targetElement = DomObserver.findElement(selector);
        cachedMatchCount = null; // DOM may have changed; recompute uniqueness lazily
      }

      const isDirectMatch = targetElement && (
        event.target === targetElement ||
        (typeof targetElement.contains === 'function' && targetElement.contains(event.target))
      );

      // Only use CSS selector matching when the selector is specific enough to
      // uniquely identify the element. A bare generic tag like 'button' or 'a'
      // would match every such element on the page and cause any click anywhere
      // to validate the step.
      const isGenericCss = /^(button|div|a|input|span|select|textarea|p|li|ul|ol)$/i.test(
        (selector?.css || '').trim()
      );
      // A selector matching many elements on the page (a shared class, not a
      // unique id/attribute) can't be trusted to identify THIS step's target —
      // clicking any of the other matches would otherwise silently validate
      // the step without the user ever touching the intended element.
      const isNonUniqueCss = Boolean(!isGenericCss && safeCss && getMatchCount() > 3);

      let isCssMatch = false;
      let isClosestMatch = false;

      if (safeCss && !isGenericCss && !isNonUniqueCss && event.target) {
        try {
          isCssMatch = Boolean(event.target.matches?.(safeCss));
        } catch {
          // ignore invalid selector matches error
        }
        try {
          isClosestMatch = Boolean(
            targetElement && event.target.closest?.(safeCss) === targetElement
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
          matchType: isDirectMatch ? 'direct' : isCssMatch ? 'css' : 'closest',
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
