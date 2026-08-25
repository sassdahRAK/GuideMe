/**
 * Storage adapter bridging chrome.storage.local with in-memory fallback.
 */
export class ChromeStorageAdapter {
  /**
   * Save tutorial progress.
   * @param {string} tutorialId
   * @param {number} stepIndex
   * @returns {Promise<void>}
   */
  static async saveProgress(tutorialId, stepIndex) {
    const key = `guideme_progress_${tutorialId}`;
    const payload = {
      stepIndex,
      updatedAt: Date.now(),
    };

    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: payload }, resolve);
      });
    }

    // Fallback to localStorage or memory
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(payload));
    }
  }

  /**
   * Retrieve tutorial progress.
   * @param {string} tutorialId
   * @returns {Promise<number|null>}
   */
  static async getProgress(tutorialId) {
    const key = `guideme_progress_${tutorialId}`;

    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          const data = result?.[key];
          resolve(typeof data?.stepIndex === 'number' ? data.stepIndex : null);
        });
      });
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          return typeof parsed?.stepIndex === 'number' ? parsed.stepIndex : null;
        }
      } catch (e) {}
    }

    return null;
  }
}
