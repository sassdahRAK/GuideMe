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
          const stepId = (step as { id: unknown }).id;
          if (typeof stepId === 'string') {
            if (stepIds.has(stepId)) {
              errors.push(`Duplicate step id found: '${stepId}' at index ${index}`);
            }
            stepIds.add(stepId);
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

    // Optional audio validation
    if (s.audio && typeof s.audio !== 'object') {
      errors.push(`${prefix} 'audio' must be an object if provided`);
    }

    return errors;
  }
}
