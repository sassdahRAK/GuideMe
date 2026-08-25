import { ValidationType } from '@guideme/core-types';

/**
 * Evaluates user interactions and environmental states against step validation rules.
 */
export class ValidationEngine {
  /**
   * Set up validation listeners for the active step.
   * @param {Object} step - Active step definition
   * @param {import('@guideme/adapter-interface').BaseTutorialAdapter} adapter
   * @param {(result: { valid: boolean, eventData?: Object }) => void} onValidate
   * @returns {() => void} Cleanup function to unsubscribe listeners
   */
  static bindValidation(step, adapter, onValidate) {
    if (!step || !step.validation || !adapter) {
      return () => {};
    }

    const { validation, target } = step;
    const cleanups = [];

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
          // 1. If an explicit expectedValue is set, check on input
          if (validation.expectedValue) {
            const unsubInput = adapter.listenToElementEvent(target, 'input', (eventData) => {
              const val = eventData?.targetValue ?? '';
              const expected = String(validation.expectedValue).toLowerCase();
              const actual = val.toLowerCase();
              const matches = validation.exactMatch === true 
                ? actual === expected 
                : actual.includes(expected);
              if (matches) {
                onValidate({ valid: true, eventData });
              }
            });
            cleanups.push(unsubInput);
          }

          // 2. Listen to 'change' event (fired when user finishes typing and blurs/tabs)
          const unsubChange = adapter.listenToElementEvent(target, 'change', (eventData) => {
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

          // 3. Listen to Enter key ('keydown') so user can press Enter to submit input
          const unsubKey = adapter.listenToElementEvent(target, 'keydown', (eventData) => {
            if (eventData?.key === 'Enter' || eventData?.originalEvent?.key === 'Enter') {
              const val = (eventData?.targetValue ?? '').trim();
              if (validation.expectedValue) {
                const expected = String(validation.expectedValue).toLowerCase();
                if (val.toLowerCase().includes(expected)) {
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
        // Triggered programmatically via onNextStep
        break;
    }

    return () => {
      cleanups.forEach((cleanup) => {
        try {
          cleanup();
        } catch (e) {
          // ignore cleanup errors
        }
      });
    };
  }
}
