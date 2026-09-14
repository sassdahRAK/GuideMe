import type { TutorialDefinition, TutorialStep, StepTarget } from '../types/index.ts';
import type { BaseTutorialAdapter } from '../adapter/base-adapter.ts';

export interface StepResolverTutorial extends Partial<TutorialDefinition> {
  stepMap?: Map<string, TutorialStep>;
}

export interface TargetResolutionResult {
  targetFound: boolean;
  boundingBox: any | null;
}

/**
 * Resolves active step definitions, target elements, and navigation branching.
 */
export class StepResolver {
  private tutorial: StepResolverTutorial;
  private adapter: BaseTutorialAdapter;

  constructor(parsedTutorial: StepResolverTutorial, adapter: BaseTutorialAdapter) {
    this.tutorial = parsedTutorial;
    this.adapter = adapter;
  }

  /**
   * Get step by index.
   */
  getStepByIndex(index: number): TutorialStep | null {
    if (!this.tutorial || !this.tutorial.steps) return null;
    return this.tutorial.steps[index] || null;
  }

  /**
   * Get step by ID.
   */
  getStepById(stepId: string): TutorialStep | null {
    if (!this.tutorial || !this.tutorial.stepMap) return null;
    return this.tutorial.stepMap.get(stepId) || null;
  }

  /**
   * Resolve target bounding box for a given step with Just-in-Time (JIT) dynamic grounding.
   */
  async resolveTarget(step: TutorialStep | null | undefined, timeoutMs: number = 5000): Promise<TargetResolutionResult> {
    if (!step || !step.target) {
      // Step without target is an unanchored informational modal/banner
      return { targetFound: false, boundingBox: null };
    }

    if (!this.adapter) {
      return { targetFound: false, boundingBox: null };
    }

    let box = await this.adapter.findTarget(step.target, timeoutMs);

    // JIT Dynamic Grounding: If target was not found by primary selector,
    // and target specified text or ariaLabel, attempt secondary fallback with generalized interactive tags
    if (!box && (step.target.text || step.target.ariaLabel)) {
      const fallbackTarget: StepTarget = {
        ...step.target,
        css: '[role="menuitem"], [role="option"], button, a, [role="button"], span, div, p',
      };
      box = await this.adapter.findTarget(fallbackTarget, Math.min(timeoutMs, 1000));
    }

    return {
      targetFound: !!box,
      boundingBox: box,
    };
  }

  /**
   * Determine next step index based on current step branching logic.
   * @returns Next step index, or null if completed
   */
  resolveNextStepIndex(currentStep: TutorialStep | null | undefined, _runtimeVariables: Record<string, any> = {}): number | null {
    if (!currentStep) return null;

    // Explicit branching target ID
    if (currentStep.onSuccessNextStepId) {
      const nextStep = this.getStepById(currentStep.onSuccessNextStepId);
      return nextStep && typeof (nextStep as any).index === 'number' ? (nextStep as any).index : null;
    }

    // Default sequential progression
    return typeof (currentStep as any).defaultNextStepIndex === 'number'
      ? (currentStep as any).defaultNextStepIndex
      : null;
  }
}
