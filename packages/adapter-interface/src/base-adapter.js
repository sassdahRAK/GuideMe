/**
 * Abstract Base Adapter defining platform capabilities.
 * Decouples engine logic from browser DOM or native OS APIs.
 */
export class BaseTutorialAdapter {
  /**
   * Find a DOM target element and return its bounding box coordinates.
   * @param {Object} selector - Target selector criteria ({ css, xpath, text, testId, ariaLabel })
   * @param {number} [timeoutMs=5000]
   * @returns {Promise<{x: number, y: number, width: number, height: number, top: number, left: number, bottom: number, right: number}|null>}
   */
  async findTarget(selector, timeoutMs = 5000) {
    throw new Error('findTarget() must be implemented by concrete adapter');
  }

  /**
   * Scroll viewport smoothly to bring target element into visible area.
   * @param {Object} selector
   * @returns {Promise<void>}
   */
  async scrollToElement(selector) {
    throw new Error('scrollToElement() must be implemented by concrete adapter');
  }

  /**
   * Continuously observe target element position on resize/scroll/mutation.
   * @param {Object} selector
   * @param {(rect: Object|null) => void} onChange
   * @returns {() => void} Unsubscribe cleanup function
   */
  observeTargetPosition(selector, onChange) {
    throw new Error('observeTargetPosition() must be implemented by concrete adapter');
  }

  /**
   * Listen to an interaction event on the target element.
   * @param {Object} selector
   * @param {string} eventType - 'click' | 'input' | 'change' | 'submit'
   * @param {(eventData: Object) => void} callback
   * @returns {() => void} Unsubscribe cleanup function
   */
  listenToElementEvent(selector, eventType, callback) {
    throw new Error('listenToElementEvent() must be implemented by concrete adapter');
  }

  /**
   * Listen for SPA URL navigation changes (pushState, popstate, replaceState).
   * @param {(newUrl: string) => void} callback
   * @returns {() => void} Unsubscribe cleanup function
   */
  listenToUrlChanges(callback) {
    throw new Error('listenToUrlChanges() must be implemented by concrete adapter');
  }

  /**
   * Persist tutorial completion progress.
   * @param {string} tutorialId
   * @param {number} stepIndex
   * @returns {Promise<void>}
   */
  async saveProgress(tutorialId, stepIndex) {
    throw new Error('saveProgress() must be implemented by concrete adapter');
  }

  /**
   * Retrieve saved tutorial progress.
   * @param {string} tutorialId
   * @returns {Promise<number|null>}
   */
  async getProgress(tutorialId) {
    throw new Error('getProgress() must be implemented by concrete adapter');
  }

  /**
   * Get current URL string.
   * @returns {string}
   */
  getCurrentUrl() {
    return '';
  }
}
