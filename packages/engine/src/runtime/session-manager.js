/**
 * Manages tutorial progress persistence, restoration, and session metrics.
 */
export class SessionManager {
  /**
   * @param {import('@guideme/adapter-interface').BaseTutorialAdapter} adapter
   */
  constructor(adapter) {
    this.adapter = adapter;
    this.activeTutorialId = null;
    this.currentStepIndex = 0;
    this.completedStepIds = new Set();
  }

  /**
   * Start a new session or load existing progress.
   * @param {string} tutorialId
   * @param {number} [startStepIndex]
   * @returns {Promise<number>}
   */
  async startSession(tutorialId, startStepIndex) {
    this.activeTutorialId = tutorialId;
    this.completedStepIds.clear();

    if (typeof startStepIndex === 'number') {
      this.currentStepIndex = startStepIndex;
    } else if (this.adapter) {
      const savedIndex = await this.adapter.getProgress(tutorialId);
      this.currentStepIndex = typeof savedIndex === 'number' ? savedIndex : 0;
    } else {
      this.currentStepIndex = 0;
    }

    return this.currentStepIndex;
  }

  /**
   * Mark a step index as completed and persist.
   * @param {string} stepId
   * @param {number} nextStepIndex
   */
  async recordStepProgress(stepId, nextStepIndex) {
    this.completedStepIds.add(stepId);
    this.currentStepIndex = nextStepIndex;

    if (this.adapter && this.activeTutorialId) {
      await this.adapter.saveProgress(this.activeTutorialId, nextStepIndex);
    }
  }

  /**
   * Reset session.
   */
  async resetSession() {
    if (this.adapter && this.activeTutorialId) {
      await this.adapter.saveProgress(this.activeTutorialId, 0);
    }
    this.activeTutorialId = null;
    this.currentStepIndex = 0;
    this.completedStepIds.clear();
  }
}
