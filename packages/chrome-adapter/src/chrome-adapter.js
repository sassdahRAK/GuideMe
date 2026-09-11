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
    if (!element) return null;
    const box = DomObserver.getBoundingBox(element);
    // Only dispatch synthetic hover events when the target has zero bounding
    // dimensions, which means it might be inside a collapsed flyout/dropdown
    // menu that needs a hover to open.  Dispatching mouseover/focusin on an
    // already-visible menu item (e.g. inside an open Google Docs File menu)
    // can trigger unwanted submenu opens or focus changes that close the
    // parent dropdown.
    if (box && box.width === 0 && box.height === 0) {
      DomObserver.dispatchHoverEvents(element);
    }
    return box;
  }

  /**
   * Return the live element details used by the overlay for diagnostics.
   * @param {Object} selector
   * @returns {Object|null}
   */
  describeTarget(selector) {
    const element = DomObserver.findElement(selector);
    if (!element) return null;

    const getAttribute = element.getAttribute?.bind(element);
    const rect = typeof element.getBoundingClientRect === 'function'
      ? element.getBoundingClientRect()
      : null;

    return {
      tag: (element.tagName || '').toLowerCase(),
      id: element.id || '',
      className: typeof element.className === 'string' ? element.className : '',
      role: getAttribute?.('role') || '',
      ariaLabel: getAttribute?.('aria-label') || getAttribute?.('title') || '',
      text: (element.textContent || element.value || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      selector: DomObserver.createTargetSelector(element),
      rect: rect ? {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      } : null,
    };
  }

  /**
   * Scroll smoothly to bring element into visible area.
   * @param {Object} selector
   * @returns {Promise<void>}
   */
  async scrollToElement(selector) {
    const element = DomObserver.findElement(selector);
    if (element) {
      DomObserver.scrollIntoView(element);
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

    const HYSTERESIS_PX = 4;
    let running = true;
    let lastBox = null;

    // Pin the element identity at observation start. Re-querying on every
    // frame with a generic selector (e.g. css:'button') causes the spotlight
    // to jump to whichever matching element becomes first-visible after a
    // dropdown opens. We only re-query when the pinned element disconnects.
    let pinnedElement = DomObserver.findElement(selector);

    const boxesDiffer = (a, b) => {
      if (a === b) return false;
      if (!a || !b) return true;
      return (
        Math.abs(a.left - b.left) >= HYSTERESIS_PX ||
        Math.abs(a.top - b.top) >= HYSTERESIS_PX ||
        Math.abs(a.width - b.width) >= HYSTERESIS_PX ||
        Math.abs(a.height - b.height) >= HYSTERESIS_PX ||
        a.isClipped !== b.isClipped
      );
    };

    const update = () => {
      if (!running) return;

      // Re-query only if the pinned element has been detached from the DOM.
      // This handles SPA navigation / framework re-renders that destroy and
      // recreate nodes, while preventing the spotlight from jumping to a
      // different element of the same type when a dropdown opens.
      if (pinnedElement && typeof pinnedElement.isConnected === 'boolean' && !pinnedElement.isConnected) {
        pinnedElement = DomObserver.findElement(selector);
      } else if (!pinnedElement) {
        pinnedElement = DomObserver.findElement(selector);
      }

      const box = pinnedElement ? DomObserver.getBoundingBox(pinnedElement) : null;
      // Emit only when the resolved box actually moves beyond hysteresis.
      // null→null (element still missing) emits nothing.
      if (boxesDiffer(lastBox, box)) {
        lastBox = box;
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
