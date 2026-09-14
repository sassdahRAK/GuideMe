import type { BaseTutorialAdapter } from '../adapter/base-adapter.ts';

/**
 * Manages tutorial progress persistence, restoration, and session metrics.
 */
export class SessionManager {
  private adapter?: BaseTutorialAdapter;
  private activeTutorialId: string | null;
  private currentStepIndex: number;
  private completedStepIds: Set<string>;

  constructor(adapter?: BaseTutorialAdapter) {
    this.adapter = adapter;
    this.activeTutorialId = null;
    this.currentStepIndex = 0;
    this.completedStepIds = new Set();
  }

  /**
   * Start a new session or load existing progress.
   */
  async startSession(tutorialId: string, startStepIndex?: number): Promise<number> {
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
   */
  async recordStepProgress(stepId: string, nextStepIndex: number): Promise<void> {
    this.completedStepIds.add(stepId);
    this.currentStepIndex = nextStepIndex;

    if (this.adapter && this.activeTutorialId) {
      await this.adapter.saveProgress(this.activeTutorialId, nextStepIndex);
    }
  }

  /**
   * Reset session.
   */
  async resetSession(): Promise<void> {
    if (this.adapter && this.activeTutorialId) {
      await this.adapter.saveProgress(this.activeTutorialId, 0);
    }
    this.activeTutorialId = null;
    this.currentStepIndex = 0;
    this.completedStepIds.clear();
  }
}
