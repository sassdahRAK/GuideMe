import { BaseTutorialAdapter } from '@guideme/adapter-interface';
import { DomObserver } from './dom-observer.js';
import { DomEventListener } from './event-listener.js';
import { UrlListener } from './url-listener.js';
import { ChromeStorageAdapter } from './chrome-storage.js';

/**
 * Concrete Chrome MV3 Adapter implementing BaseTutorialAdapter.
 */
export class ChromeAdapter extends BaseTutorialAdapter {
  /**
   * Find DOM target element bounding box.
   * @param {Object} selector
   * @param {number} [timeoutMs=5000]
   * @returns {Promise<Object|null>}
   */
  async findTarget(selector, timeoutMs = 5000) {
    const element = await DomObserver.waitForElement(selector, timeoutMs);
    return element ? DomObserver.getBoundingBox(element) : null;
  }

  /**
   * Scroll smoothly to bring element into visible area.
   * @param {Object} selector
   * @returns {Promise<void>}
   */
  async scrollToElement(selector) {
    const element = DomObserver.findElement(selector);
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
  }

  /**
   * Continuously observe target element position on resize/scroll.
   * @param {Object} selector
   * @param {(box: Object|null) => void} onChange
   * @returns {() => void}
   */
  observeTargetPosition(selector, onChange) {
    if (typeof window === 'undefined') return () => {};

    let running = true;
    let lastBoxJson = '';

    const update = () => {
      if (!running) return;
      const element = DomObserver.findElement(selector);
      const box = element ? DomObserver.getBoundingBox(element) : null;
      const json = JSON.stringify(box);
      if (json !== lastBoxJson) {
        lastBoxJson = json;
        onChange(box);
      }
    };

    // Listen to scroll and resize
    window.addEventListener('scroll', update, { passive: true, capture: true });
    window.addEventListener('resize', update, { passive: true });

    // Periodic animation frame check for animated/transitioning DOM elements
    let rafId = null;
    const loop = () => {
      if (!running) return;
      update();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', update);
    };
  }

  /**
   * Listen to user DOM interaction on target.
   * @param {Object} selector
   * @param {string} eventType
   * @param {(data: Object) => void} callback
   * @returns {() => void}
   */
  listenToElementEvent(selector, eventType, callback) {
    return DomEventListener.listen(selector, eventType, callback);
  }

  /**
   * Listen for SPA route changes.
   * @param {(newUrl: string) => void} callback
   * @returns {() => void}
   */
  listenToUrlChanges(callback) {
    return UrlListener.listen(callback);
  }

  /**
   * Save tutorial progress.
   * @param {string} tutorialId
   * @param {number} stepIndex
   * @returns {Promise<void>}
   */
  async saveProgress(tutorialId, stepIndex) {
    return ChromeStorageAdapter.saveProgress(tutorialId, stepIndex);
  }

  /**
   * Retrieve saved tutorial progress.
   * @param {string} tutorialId
   * @returns {Promise<number|null>}
   */
  async getProgress(tutorialId) {
    return ChromeStorageAdapter.getProgress(tutorialId);
  }

  /**
   * Get current URL.
   * @returns {string}
   */
  getCurrentUrl() {
    return typeof window !== 'undefined' ? window.location.href : '';
  }
}
