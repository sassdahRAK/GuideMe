export interface TutorialProgressData {
  stepIndex: number;
  updatedAt: number;
}

/**
 * Storage adapter bridging chrome.storage.local with in-memory fallback.
 */
export class ChromeStorageAdapter {
  /**
   * Save tutorial progress.
   */
  static async saveProgress(tutorialId: string, stepIndex: number): Promise<void> {
    const key = `guideme_progress_${tutorialId}`;
    const payload: TutorialProgressData = {
      stepIndex,
      updatedAt: Date.now(),
    };

    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({ [key]: payload }, () => resolve());
      });
    }

    // Fallback to localStorage or memory
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(payload));
    }
  }

  /**
   * Retrieve tutorial progress.
   */
  static async getProgress(tutorialId: string): Promise<number | null> {
    const key = `guideme_progress_${tutorialId}`;

    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      return new Promise<number | null>((resolve) => {
        chrome.storage.local.get([key], (result) => {
          const data = result?.[key] as TutorialProgressData | undefined;
          resolve(typeof data?.stepIndex === 'number' ? data.stepIndex : null);
        });
      });
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<TutorialProgressData>;
          return typeof parsed?.stepIndex === 'number' ? parsed.stepIndex : null;
        }
      } catch {
        // ignore parse errors
      }
    }

    return null;
  }
}
