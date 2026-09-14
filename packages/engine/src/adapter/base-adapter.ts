import type { StepTarget, TargetBoundingBox, TargetDescription } from '../types/tutorial.ts';

/**
 * Abstract Base Adapter defining platform capabilities.
 * Decouples engine logic from browser DOM or native OS APIs.
 */
export class BaseTutorialAdapter {
  /**
   * Find a DOM target element and return its bounding box coordinates.
   */
  async findTarget(selector: StepTarget, timeoutMs = 5000): Promise<TargetBoundingBox | null> {
    throw new Error('findTarget() must be implemented by concrete adapter');
  }

  /**
   * Scroll viewport smoothly to bring target element into visible area.
   */
  async scrollToElement(selector: StepTarget): Promise<void> {
    throw new Error('scrollToElement() must be implemented by concrete adapter');
  }

  /**
   * Continuously observe target element position on resize/scroll/mutation.
   */
  observeTargetPosition(selector: StepTarget, onChange: (rect: TargetBoundingBox | null) => void): () => void {
    throw new Error('observeTargetPosition() must be implemented by concrete adapter');
  }

  /**
   * Return live element details for overlay diagnostics if supported.
   */
  describeTarget?(selector: StepTarget): TargetDescription | null;

  /**
   * Find raw DOM element if supported by adapter.
   */
  findElement?(selector: StepTarget): any;

  /**
   * Listen to an interaction event on the target element.
   */
  listenToElementEvent(selector: StepTarget, eventType: string, callback: (eventData: any) => void): () => void {
    throw new Error('listenToElementEvent() must be implemented by concrete adapter');
  }

  /**
   * Listen for SPA URL navigation changes (pushState, popstate, replaceState).
   */
  listenToUrlChanges(callback: (newUrl: string) => void): () => void {
    throw new Error('listenToUrlChanges() must be implemented by concrete adapter');
  }

  /**
   * Persist tutorial completion progress.
   */
  async saveProgress(tutorialId: string, stepIndex: number): Promise<void> {
    throw new Error('saveProgress() must be implemented by concrete adapter');
  }

  /**
   * Retrieve saved tutorial progress.
   */
  async getProgress(tutorialId: string): Promise<number | null> {
    throw new Error('getProgress() must be implemented by concrete adapter');
  }

  /**
   * Get current URL string.
   */
  getCurrentUrl(): string {
    return '';
  }
}
