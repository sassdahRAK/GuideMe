/**
 * Resolves active step definitions, target elements, and navigation branching.
 */
export class StepResolver {
  /**
   * @param {Object} parsedTutorial
   * @param {import('@guideme/adapter-interface').BaseTutorialAdapter} adapter
   */
  constructor(parsedTutorial, adapter) {
    this.tutorial = parsedTutorial;
    this.adapter = adapter;
  }

  /**
   * Get step by index.
   * @param {number} index
   * @returns {Object|null}
   */
  getStepByIndex(index) {
    if (!this.tutorial || !this.tutorial.steps) return null;
    return this.tutorial.steps[index] || null;
  }

  /**
   * Get step by ID.
   * @param {string} stepId
   * @returns {Object|null}
   */
  getStepById(stepId) {
    if (!this.tutorial || !this.tutorial.stepMap) return null;
    return this.tutorial.stepMap.get(stepId) || null;
  }

  /**
   * Resolve target bounding box for a given step.
   * @param {Object} step
   * @param {number} [timeoutMs=5000]
   * @returns {Promise<{ targetFound: boolean, boundingBox: Object|null }>}
   */
  async resolveTarget(step, timeoutMs = 5000) {
    if (!step || !step.target) {
      // Step without target is an unanchored informational modal/banner
      return { targetFound: false, boundingBox: null };
    }

    if (!this.adapter) {
      return { targetFound: false, boundingBox: null };
    }

    const box = await this.adapter.findTarget(step.target, timeoutMs);
    return {
      targetFound: !!box,
      boundingBox: box,
    };
  }

  /**
   * Determine next step index based on current step branching logic.
   * @param {Object} currentStep
   * @param {Object} [runtimeVariables={}]
   * @returns {number|null} Next step index, or null if completed
   */
  resolveNextStepIndex(currentStep, runtimeVariables = {}) {
    if (!currentStep) return null;

    // Explicit branching target ID
    if (currentStep.onSuccessNextStepId) {
      const nextStep = this.getStepById(currentStep.onSuccessNextStepId);
      return nextStep ? nextStep.index : null;
    }

    // Default sequential progression
    return currentStep.defaultNextStepIndex;
  }
}
