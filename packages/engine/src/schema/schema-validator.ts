import type {
  LocalizedText,
  TutorialDefinition,
  TutorialStep,
  ValidationResult,
} from '../types/tutorial.ts';

/**
 * Helper to check if a value is a valid non-empty string or bilingual object ({ km, en }).
 */
export function isValidLocalizedOrString(val: unknown): boolean {
  if (typeof val === 'string' && val.trim().length > 0) {
    return true;
  }
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const obj = val as Record<string, unknown>;
    const hasKm = typeof obj.km === 'string' && obj.km.trim().length > 0;
    const hasEn = typeof obj.en === 'string' && obj.en.trim().length > 0;
    return hasKm || hasEn;
  }
  return false;
}

/**
 * Validates tutorial and step definitions against schema constraints with active self-healing.
 */
export class SchemaValidator {
  /**
   * Validate and self-heal a full tutorial definition object.
   */
  static validateTutorial(tutorial: unknown): ValidationResult {
    const errors: string[] = [];

    if (!tutorial || typeof tutorial !== 'object') {
      return { valid: false, errors: ['Tutorial definition must be a valid non-null object'] };
    }

    const tut = tutorial as Record<string, unknown>;

    if (!tut.id || typeof tut.id !== 'string') {
      errors.push("Missing or invalid 'id' (must be a non-empty string)");
    }

    // Self-healing: If name is missing, recover from title, description, id, or fallback
    if (!isValidLocalizedOrString(tut.name)) {
      if (isValidLocalizedOrString(tut.title)) {
        tut.name = tut.title;
      } else if (isValidLocalizedOrString(tut.description)) {
        tut.name = tut.description;
      } else if (typeof tut.id === 'string' && tut.id.trim().length > 0) {
        tut.name = tut.id;
      } else {
        tut.name = { km: 'មគ្គុទ្ទេសក៍ស្វ័យប្រវត្តិ', en: 'Dynamic Guide' };
      }
    }

    // Self-healing: If matchUrls is missing or empty, default to universal match
    if (!Array.isArray(tut.matchUrls) || tut.matchUrls.length === 0) {
      tut.matchUrls = ['<all_urls>'];
    }

    if (!Array.isArray(tut.steps) || tut.steps.length === 0) {
      errors.push("Missing or invalid 'steps' (must be a non-empty array of step definitions)");
    } else {
      const stepIds = new Set<string>();
      tut.steps.forEach((step: unknown, index: number) => {
        const stepErrors = this.validateStep(step, index);
        errors.push(...stepErrors);

        if (step && typeof step === 'object' && 'id' in step) {
          const s = step as { id: unknown };
          if (typeof s.id === 'string') {
            // Self-healing: generative backends occasionally reuse a generic id
            // (e.g. 'step-1') across steps. Step order/navigation is index-based
            // elsewhere in the engine, so the id itself is cosmetic — disambiguate
            // it rather than rejecting an otherwise-valid tutorial outright.
            let finalId = s.id;
            if (stepIds.has(finalId)) {
              finalId = `${finalId}-${index}`;
              while (stepIds.has(finalId)) {
                finalId = `${finalId}-${index}`;
              }
              s.id = finalId;
            }
            stepIds.add(finalId);
          }
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate and self-heal an individual step definition.
   */
  static validateStep(step: unknown, index = 0): string[] {
    const errors: string[] = [];
    const s = step as Record<string, any>;
    const prefix = `Step[${index}] ('${s?.id || 'unknown'}'):`;

    if (!step || typeof step !== 'object') {
      return [`${prefix} Step must be a valid non-null object`];
    }

    if (!s.id || typeof s.id !== 'string') {
      errors.push(`${prefix} Missing or invalid 'id'`);
    }

    // Self-healing: If step.title is missing, recover from action.title, instruction, or description
    if (!isValidLocalizedOrString(s.title)) {
      if (isValidLocalizedOrString(s.action?.title)) {
        s.title = s.action.title;
      } else if (isValidLocalizedOrString(s.instruction)) {
        s.title = s.instruction;
      } else if (isValidLocalizedOrString(s.description)) {
        s.title = s.description;
      } else {
        errors.push(`${prefix} Missing or invalid 'title' (must be string or localized object)`);
      }
    }

    if (!s.action || typeof s.action !== 'object') {
      s.action = { type: 'spotlight', title: s.title };
    } else {
      // Self-healing: Default action type to spotlight
      if (!s.action.type || typeof s.action.type !== 'string') {
        s.action.type = 'spotlight';
      }
      // Self-healing: Sync action.title from step.title if missing
      if (!s.action.title && isValidLocalizedOrString(s.title)) {
        s.action.title = s.title;
      }
      if (!s.action.content && !s.action.title && !s.action.instruction) {
        s.action.title = s.title || 'Step';
      }
    }

    if (!s.validation || typeof s.validation !== 'object') {
      s.validation = { type: 'click' };
    } else {
      // Self-healing: Default validation type to click
      if (!s.validation.type || typeof s.validation.type !== 'string') {
        s.validation.type = 'click';
      }
    }

    // GM-041: a 'click'/'input'/'change'/'submit' validation type needs a
    // bindable target (on the step itself or as an explicit validation
    // override) to ever fire. Self-healing a target-less step into one of
    // these types — the previous behavior — meant the listener never
    // attaches and the tutorial hangs forever with no visible error.
    // Downgrading to 'manual_next' here keeps the step self-healing (it
    // still renders and lets the user proceed via Next/Skip) instead of
    // silently stranding them.
    const TARGET_REQUIRED_TYPES = new Set(['click', 'input', 'change', 'submit']);
    const hasUsableTarget = (target: unknown): boolean =>
      !!target &&
      typeof target === 'object' &&
      ['css', 'xpath', 'text', 'testId', 'ariaLabel', 'role', 'placeholder'].some(
        (key) => typeof (target as Record<string, unknown>)[key] === 'string' && (target as Record<string, unknown>)[key]
      );

    if (
      TARGET_REQUIRED_TYPES.has(s.validation.type) &&
      !hasUsableTarget(s.target) &&
      !hasUsableTarget(s.validation.selector)
    ) {
      s.validation.type = 'manual_next';
    }

    // Optional audio validation
    if (s.audio && typeof s.audio !== 'object') {
      errors.push(`${prefix} 'audio' must be an object if provided`);
    }

    return errors;
  }
}
