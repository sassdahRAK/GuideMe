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

    // Helper to check if an element is a workflow completion button (Done, Send, Save, etc.)
    const isCompletionElement = (node) => {
      if (!node || typeof node.getAttribute !== 'function') return false;
      const text = (node.textContent || '').trim().toLowerCase();
      const aria = (node.getAttribute('aria-label') || node.getAttribute('title') || '').trim().toLowerCase();
      const id = (node.id || '').toLowerCase();
      const testId = (node.getAttribute('data-testid') || '').toLowerCase();
      const combined = `${text} ${aria} ${id} ${testId}`;
      return (
        combined.includes('done') ||
        combined.includes('send') ||
        combined.includes('save') ||
        combined.includes('submit') ||
        combined.includes('apply') ||
        combined.includes('finish') ||
        combined.includes('close') ||
        combined.includes('រួចរាល់') ||
        combined.includes('ផ្ញើ') ||
        combined.includes('រក្សាទុក')
      );
    };

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

        // Guard B: Ignore clicks on or inside primary target element
        const targetElement =
          typeof adapter.findElement === 'function' ? adapter.findElement(target) : null;
        if (targetElement) {
          if (
            event.target === targetElement ||
            targetElement.contains(event.target) ||
            path.includes(targetElement)
          ) {
            return; // Valid primary target click
          }
        }

        // Guard C: Ignore clicks on alternative targets or workflow completion buttons (Done, Send, Save)
        const altTargets = validation.alternativeTargets || step.alternativeTargets || [];
        for (const alt of altTargets) {
          const altEl = typeof adapter.findElement === 'function' ? adapter.findElement(alt) : null;
          if (altEl && (event.target === altEl || altEl.contains(event.target) || path.includes(altEl))) {
            return; // Valid alternative click
          }
        }

        const isActionComp = path.some((node) => isCompletionElement(node));
        if (isActionComp) {
          return; // Valid completion button click
        }

        // Guard D: Coordinate fallback matching if bounding box provided
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

    // ── 3. Universal Action Validation Listeners ──
    const allTargets = [target, ...(validation.alternativeTargets || step.alternativeTargets || [])].filter(Boolean);

    // Global Completion Listener — only for INPUT/CHANGE steps where the user
    // submits a form or dialog by clicking Done/Send/Save/Submit rather than
    // by pressing Enter. This must NOT fire for CLICK steps because:
    //   1. The primary allTargets listener already handles the exact target click.
    //   2. Many host pages have persistent Done/Close buttons in their own UI
    //      that have nothing to do with the tutorial step, and blindly treating
    //      those as step completion would advance the guide incorrectly.
    if (
      typeof document !== 'undefined' &&
      (validation.type === ValidationType.INPUT || validation.type === ValidationType.CHANGE)
    ) {
      const globalCompletionHandler = (event) => {
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        const isInsideGuideMe = path.some(
          (node) =>
            node.id === 'guideme-tutorial-root' ||
            node.tagName === 'GUIDEME-TUTORIAL-ROOT' ||
            (node.classList && node.classList.contains('guideme-root-overlay'))
        );
        if (isInsideGuideMe) return;

        // Only treat the click as a completion if the button is visually near
        // (in the same form/dialog) as the input target element. This prevents
        // a "Close" button in an unrelated panel from advancing the step.
        const compNode = path.find((node) => isCompletionElement(node));
        if (!compNode) return;

        const inputEl = typeof adapter.findElement === 'function' ? adapter.findElement(target) : null;
        if (inputEl) {
          // Accept if the completion button shares a common form or dialog ancestor
          // with the input target (within 6 DOM levels).
          const form = inputEl.closest?.('form, dialog, [role="dialog"], [role="form"]');
          const compInSameForm = form && form.contains(compNode);
          if (!compInSameForm) return;
        }

        onValidate({ valid: true, eventData: { reason: 'completion_button_clicked', target: compNode } });
      };

      document.addEventListener('click', globalCompletionHandler, true);
      cleanups.push(() => {
        document.removeEventListener('click', globalCompletionHandler, true);
      });

      // Global Dialog / Menu Action Listener for interactive selection steps
      if (validation.type === ValidationType.CLICK) {
        const dialogInteractionHandler = (event) => {
          const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
          const isInsideGuideMe = path.some(
            (node) =>
              node.id === 'guideme-tutorial-root' ||
              node.tagName === 'GUIDEME-TUTORIAL-ROOT' ||
              (node.classList && node.classList.contains('guideme-root-overlay'))
          );
          if (isInsideGuideMe) return;

          const isMenuOrDropdownClick = path.some(
            (node) =>
              node && node.getAttribute &&
              (node.getAttribute('role') === 'menuitem' ||
               node.getAttribute('role') === 'option' ||
               node.classList?.contains('goog-menuitem') ||
               node.classList?.contains('goog-menuitem-content') ||
               (node.getAttribute('role') === 'button' && Boolean(node.closest?.('dialog, [role="dialog"], [aria-modal="true"], .apps-share-dialog, .modal-dialog'))))
          );

          if (isMenuOrDropdownClick) {
            onValidate({ valid: true, eventData: { reason: 'dialog_menu_clicked' } });
          }
        };

        document.addEventListener('click', dialogInteractionHandler, true);
        cleanups.push(() => {
          document.removeEventListener('click', dialogInteractionHandler, true);
        });
      }
    }

    switch (validation.type) {
      case ValidationType.CLICK:
        allTargets.forEach((tgt) => {
          const unsub = adapter.listenToElementEvent(tgt, 'click', (eventData) => {
            onValidate({ valid: true, eventData });
          });
          cleanups.push(unsub);
        });
        break;

      case ValidationType.INPUT:
      case ValidationType.CHANGE:
        allTargets.forEach((tgt) => {
          let inputDebounceTimer = null;
          cleanups.push(() => {
            if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
          });

          // 1. Pre-check: If target element already contains the valid value on step start
          if (typeof adapter.findElement === 'function') {
            try {
              const existingEl = adapter.findElement(tgt);
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
          const unsubInput = adapter.listenToElementEvent(tgt, 'input', (eventData) => {
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
              // Debounce validation so user finishes typing their query
              if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
              inputDebounceTimer = setTimeout(() => {
                onValidate({ valid: true, eventData });
              }, 650);
            }
          });
          cleanups.push(unsubInput);

          // 3. Change event (blur or tab away)
          const unsubChange = adapter.listenToElementEvent(tgt, 'change', (eventData) => {
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
          const unsubKey = adapter.listenToElementEvent(tgt, 'keydown', (eventData) => {
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
        });
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
