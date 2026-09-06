import { ValidationType } from '@guideme/core-types';

/**
 * Evaluates user interactions and environmental states against step validation rules.
 * Manages active learner rescue mechanisms including hesitation timers and misclick detection.
 */
export class ValidationEngine {
  /**
   * Set up validation listeners and rescue monitors for the active step.
   * @param {Object} step - Active step definition
   * @param {import('@guideme/adapter-interface').BaseTutorialAdapter} adapter
   * @param {(result: { valid: boolean, eventData?: Object }) => void} onValidate
   * @param {Object} [options={}]
   * @param {() => void} [options.onHesitation] Triggered when learner is inactive
   * @param {(data: Object) => void} [options.onMisclick] Triggered when learner clicks outside target
   * @param {number} [options.hesitationTimeoutMs=15000] Inactivity threshold
   * @param {Object} [options.targetBoundingBox=null] Bounding box of target element
   * @returns {() => void} Cleanup function to unsubscribe listeners and clear timers
   */
  static bindValidation(step, adapter, onValidate, options = {}) {
    if (!step || !step.validation || !adapter) {
      return () => {};
    }

    const { validation, target } = step;
    const cleanups = [];

    // ── 1. Hesitation Timer (15s Inactivity Detection) ──
    const timeoutMs = step.hesitationTimeoutMs || options.hesitationTimeoutMs || 15000;
    let hesitationTimer = null;

    const startHesitationTimer = () => {
      if (hesitationTimer) clearTimeout(hesitationTimer);
      if (typeof options.onHesitation === 'function') {
        hesitationTimer = setTimeout(() => {
          options.onHesitation();
        }, timeoutMs);
      }
    };

    const resetHesitationTimer = () => {
      startHesitationTimer();
    };

    startHesitationTimer();

    cleanups.push(() => {
      if (hesitationTimer) {
        clearTimeout(hesitationTimer);
        hesitationTimer = null;
      }
    });

    // ── 2. Misclick Detection (Clicks Outside Target on Click Steps) ──
    if (
      validation.type === ValidationType.CLICK &&
      target &&
      typeof options.onMisclick === 'function' &&
      typeof document !== 'undefined'
    ) {
      const misclickHandler = (event) => {
        // Reset hesitation timer on any interaction attempt
        resetHesitationTimer();

        // Guard A: Ignore clicks inside GuideMe's isolated UI root
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        const isInsideGuideMe = path.some(
          (node) =>
            node.id === 'guideme-tutorial-root' ||
            node.tagName === 'GUIDEME-TUTORIAL-ROOT' ||
            (node.classList && node.classList.contains('guideme-root-overlay'))
        );
        if (isInsideGuideMe) {
          return;
        }

        // Guard B: Ignore clicks on or inside the valid target element
        const targetElement =
          typeof adapter.findElement === 'function' ? adapter.findElement(target) : null;
        if (targetElement) {
          if (
            event.target === targetElement ||
            targetElement.contains(event.target) ||
            path.includes(targetElement)
          ) {
            return; // Valid click target
          }
        }

        // Guard C: Coordinate fallback matching if bounding box provided
        const box = typeof options.getTargetBoundingBox === 'function'
          ? options.getTargetBoundingBox()
          : options.targetBoundingBox;

        if (box && typeof event.clientX === 'number') {
          const { left, right, top, bottom } = box;
          const padding = 8;
          if (
            event.clientX >= left - padding &&
            event.clientX <= right + padding &&
            event.clientY >= top - padding &&
            event.clientY <= bottom + padding
          ) {
            return; // Clicked within target bounding perimeter
          }
        }

        // Outside click confirmed on interactive host page -> Trigger misclick rescue
        options.onMisclick({
          target,
          event,
          coordinates: { x: event.clientX, y: event.clientY },
        });
      };

      document.addEventListener('click', misclickHandler, true);
      cleanups.push(() => {
        document.removeEventListener('click', misclickHandler, true);
      });
    }

    // ── 3. Action Validation Listeners ──
    switch (validation.type) {
      case ValidationType.CLICK:
        if (target) {
          const unsub = adapter.listenToElementEvent(target, 'click', (eventData) => {
            onValidate({ valid: true, eventData });
          });
          cleanups.push(unsub);
        }
        break;

      case ValidationType.INPUT:
      case ValidationType.CHANGE:
        if (target) {
          let inputDebounceTimer = null;
          cleanups.push(() => {
            if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
          });

          // 1. Pre-check: If target element already contains the valid value on step start
          if (typeof adapter.findElement === 'function') {
            try {
              const existingEl = adapter.findElement(target);
              if (existingEl && typeof existingEl.value === 'string') {
                const currentVal = existingEl.value.trim();
                if (validation.expectedValue) {
                  const expected = String(validation.expectedValue).toLowerCase();
                  if (currentVal.toLowerCase().includes(expected)) {
                    setTimeout(() => {
                      onValidate({ valid: true, eventData: { targetValue: currentVal } });
                    }, 400);
                  }
                }
              }
            } catch {
              // Ignore DOM query errors on mount
            }
          }

          // 2. Continuous Input listener (typing)
          const unsubInput = adapter.listenToElementEvent(target, 'input', (eventData) => {
            resetHesitationTimer();
            const val = (eventData?.targetValue ?? '').trim();

            if (validation.expectedValue) {
              const expected = String(validation.expectedValue).toLowerCase();
              const actual = val.toLowerCase();
              const matches =
                validation.exactMatch === true ? actual === expected : actual.includes(expected);
              if (matches) {
                if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
                onValidate({ valid: true, eventData });
              }
            } else if (val.length > 0) {
              // Generic input step without strict expected value:
              // Debounce validation so user finishes typing their search/input query (650ms pause)
              if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
              inputDebounceTimer = setTimeout(() => {
                onValidate({ valid: true, eventData });
              }, 650);
            }
          });
          cleanups.push(unsubInput);

          // 3. Change event (blur or tab away)
          const unsubChange = adapter.listenToElementEvent(target, 'change', (eventData) => {
            resetHesitationTimer();
            if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
            const val = (eventData?.targetValue ?? '').trim();
            if (validation.expectedValue) {
              const expected = String(validation.expectedValue).toLowerCase();
              if (val.toLowerCase().includes(expected)) {
                onValidate({ valid: true, eventData });
              }
            } else if (val.length > 0) {
              onValidate({ valid: true, eventData });
            }
          });
          cleanups.push(unsubChange);

          // 4. Enter key submission
          const unsubKey = adapter.listenToElementEvent(target, 'keydown', (eventData) => {
            resetHesitationTimer();
            if (eventData?.key === 'Enter' || eventData?.originalEvent?.key === 'Enter') {
              if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
              const val = (eventData?.targetValue ?? '').trim();
              if (validation.expectedValue) {
                const expected = String(validation.expectedValue).toLowerCase();
                if (val.toLowerCase().includes(expected)) {
                  onValidate({ valid: true, eventData });
                } else if (val.length > 0) {
                  onValidate({ valid: true, eventData });
                }
              } else if (val.length > 0) {
                onValidate({ valid: true, eventData });
              }
            }
          });
          cleanups.push(unsubKey);
        }
        break;

      case ValidationType.URL_CHANGE:
        const unsubUrl = adapter.listenToUrlChanges((newUrl) => {
          resetHesitationTimer();
          if (validation.targetUrlPattern) {
            const escaped = validation.targetUrlPattern
              .replace(/[.+^${}()|[\]\\]/g, '\\$&')
              .replace(/\*/g, '.*');
            const regex = new RegExp(escaped, 'i');
            if (regex.test(newUrl)) {
              onValidate({ valid: true, eventData: { newUrl } });
            }
          } else {
            onValidate({ valid: true, eventData: { newUrl } });
          }
        });
        cleanups.push(unsubUrl);
        break;

      case ValidationType.MANUAL_NEXT:
      default:
        // Programmatic progression
        break;
    }

    return () => {
      cleanups.forEach((cleanup) => {
        try {
          cleanup();
        } catch {
          // Ignore cleanup errors
        }
      });
    };
  }
}
