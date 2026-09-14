import { SchemaValidator } from '../schema/index.ts';
import type { TutorialDefinition, TutorialStep, LocalizedText } from '../types/tutorial.ts';

export interface ParsedStepNode extends TutorialStep {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  defaultNextStepIndex: number | null;
  defaultPrevStepIndex: number | null;
}

export interface ParsedTutorial {
  id: string;
  version: string;
  name?: LocalizedText;
  description?: LocalizedText;
  matchUrls: string[];
  compiledUrlPatterns: RegExp[];
  steps: ParsedStepNode[];
  stepMap: Map<string, ParsedStepNode>;
  raw: TutorialDefinition;
}

export interface ParseResult {
  success: boolean;
  tutorial?: ParsedTutorial;
  errors?: string[];
}

/**
 * Parses raw JSON tutorial definitions into optimized runtime graph structures.
 */
export class TutorialParser {
  /**
   * Parse and validate tutorial definition.
   */
  static parse(rawTutorial: unknown): ParseResult {
    const validation = SchemaValidator.validateTutorial(rawTutorial);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const def = rawTutorial as TutorialDefinition;

    // Compile matchUrl patterns to RegExp for fast evaluation
    const compiledUrlPatterns = (def.matchUrls || []).map((pattern: string) => {
      if (pattern === '<all_urls>' || pattern === '*') {
        return /.*/i;
      }
      const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      return new RegExp(`^${escaped}$`, 'i');
    });

    // Index steps by id for fast lookup and sequential navigation
    const stepMap = new Map<string, ParsedStepNode>();
    const stepList: ParsedStepNode[] = def.steps.map((step: TutorialStep, index: number) => {
      const stepNode: ParsedStepNode = {
        ...step,
        index,
        isFirst: index === 0,
        isLast: index === def.steps.length - 1,
        defaultNextStepIndex: index + 1 < def.steps.length ? index + 1 : null,
        defaultPrevStepIndex: index > 0 ? index - 1 : null,
      };

      stepMap.set(step.id, stepNode);
      return stepNode;
    });

    return {
      success: true,
      tutorial: {
        id: def.id,
        version: def.version || '1.0.0',
        name: def.name,
        description: def.description || '',
        matchUrls: def.matchUrls,
        compiledUrlPatterns,
        steps: stepList,
        stepMap,
        raw: def,
      },
    };
  }

  /**
   * Check if a URL matches any of the tutorial's matchUrls.
   */
  static matchesUrl(parsedTutorial: ParsedTutorial | null | undefined, url: string): boolean {
    if (!parsedTutorial || !parsedTutorial.compiledUrlPatterns || !url) return false;
    return parsedTutorial.compiledUrlPatterns.some((regex) => regex.test(url));
  }
}
