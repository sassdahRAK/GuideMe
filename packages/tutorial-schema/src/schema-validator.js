/**
 * Helper to check if a value is a valid string or bilingual object ({ km, en }).
 * @param {any} val
 * @returns {boolean}
 */
function isValidLocalizedOrString(val) {
  if (typeof val === 'string' && val.trim().length > 0) {
    return true;
  }
  if (val && typeof val === 'object') {
    return typeof val.km === 'string' || typeof val.en === 'string';
  }
  return false;
}

/**
 * Validates tutorial and step definitions against schema constraints.
 */
export class SchemaValidator {
  /**
   * Validate a full tutorial definition object.
   * @param {Object} tutorial
   * @returns {{ valid: boolean, errors: string[] }}
   */
  static validateTutorial(tutorial) {
    const errors = [];

    if (!tutorial || typeof tutorial !== 'object') {
      return { valid: false, errors: ['Tutorial definition must be a valid non-null object'] };
    }

    if (!tutorial.id || typeof tutorial.id !== 'string') {
      errors.push("Missing or invalid 'id' (must be a non-empty string)");
    }

    if (!isValidLocalizedOrString(tutorial.name)) {
      errors.push("Missing or invalid 'name' (must be a non-empty string or bilingual object with 'km'/'en')");
    }

    if (!Array.isArray(tutorial.matchUrls) || tutorial.matchUrls.length === 0) {
      errors.push("Missing or invalid 'matchUrls' (must be a non-empty array of URL patterns)");
    }

    if (!Array.isArray(tutorial.steps) || tutorial.steps.length === 0) {
      errors.push("Missing or invalid 'steps' (must be a non-empty array of step definitions)");
    } else {
      const stepIds = new Set();
      tutorial.steps.forEach((step, index) => {
        const stepErrors = this.validateStep(step, index);
        errors.push(...stepErrors);

        if (step.id) {
          if (stepIds.has(step.id)) {
            errors.push(`Duplicate step id found: '${step.id}' at index ${index}`);
          }
          stepIds.add(step.id);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate an individual step definition.
   * @param {Object} step
   * @param {number} [index]
   * @returns {string[]} Array of error strings
   */
  static validateStep(step, index = 0) {
    const errors = [];
    const prefix = `Step[${index}] ('${step?.id || 'unknown'}'):`;

    if (!step || typeof step !== 'object') {
      return [`${prefix} Step must be a valid non-null object`];
    }

    if (!step.id || typeof step.id !== 'string') {
      errors.push(`${prefix} Missing or invalid 'id'`);
    }

    if (!isValidLocalizedOrString(step.title)) {
      errors.push(`${prefix} Missing or invalid 'title' (must be string or localized object)`);
    }

    if (!step.action || typeof step.action !== 'object') {
      errors.push(`${prefix} Missing or invalid 'action' object`);
    } else {
      if (!step.action.type || typeof step.action.type !== 'string') {
        errors.push(`${prefix} Missing 'action.type'`);
      }
      if (!step.action.content && !step.action.title && !step.action.instruction) {
        errors.push(`${prefix} 'action' must specify at least 'title', 'instruction', or 'content'`);
      }
    }

    if (!step.validation || typeof step.validation !== 'object') {
      errors.push(`${prefix} Missing or invalid 'validation' object`);
    } else {
      if (!step.validation.type || typeof step.validation.type !== 'string') {
        errors.push(`${prefix} Missing 'validation.type'`);
      }
    }

    // Optional audio validation
    if (step.audio && typeof step.audio !== 'object') {
      errors.push(`${prefix} 'audio' must be an object if provided`);
    }

    return errors;
  }
}
