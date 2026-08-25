import { SchemaValidator } from '@guideme/tutorial-schema';

/**
 * Parses raw JSON tutorial definitions into optimized runtime graph structures.
 */
export class TutorialParser {
  /**
   * Parse and validate tutorial definition.
   * @param {Object} rawTutorial
   * @returns {{ success: boolean, tutorial?: Object, errors?: string[] }}
   */
  static parse(rawTutorial) {
    const validation = SchemaValidator.validateTutorial(rawTutorial);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // Compile matchUrl patterns to RegExp for fast evaluation
    const compiledUrlPatterns = (rawTutorial.matchUrls || []).map((pattern) => {
      if (pattern === '<all_urls>' || pattern === '*') {
        return /.*/i;
      }
      const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      return new RegExp(`^${escaped}$`, 'i');
    });

    // Index steps by id for fast lookup and sequential navigation
    const stepMap = new Map();
    const stepList = rawTutorial.steps.map((step, index) => {
      const stepNode = {
        ...step,
        index,
        isFirst: index === 0,
        isLast: index === rawTutorial.steps.length - 1,
        defaultNextStepIndex: index + 1 < rawTutorial.steps.length ? index + 1 : null,
        defaultPrevStepIndex: index > 0 ? index - 1 : null,
      };

      stepMap.set(step.id, stepNode);
      return stepNode;
    });

    return {
      success: true,
      tutorial: {
        id: rawTutorial.id,
        version: rawTutorial.version || '1.0.0',
        name: rawTutorial.name,
        description: rawTutorial.description || '',
        matchUrls: rawTutorial.matchUrls,
        compiledUrlPatterns,
        steps: stepList,
        stepMap,
        raw: rawTutorial,
      },
    };
  }

  /**
   * Check if a URL matches any of the tutorial's matchUrls.
   * @param {Object} parsedTutorial
   * @param {string} url
   * @returns {boolean}
   */
  static matchesUrl(parsedTutorial, url) {
    if (!parsedTutorial || !parsedTutorial.compiledUrlPatterns || !url) return false;
    return parsedTutorial.compiledUrlPatterns.some((regex) => regex.test(url));
  }
}
