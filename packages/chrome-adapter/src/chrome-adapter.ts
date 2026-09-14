import {
  BaseTutorialAdapter,
  type StepTarget,
  type TargetBoundingBox,
  type TargetDescription,
} from '@guideme/engine';
import { DomObserver } from './dom-observer.ts';
import { DomEventListener, type DomEventData } from './event-listener.ts';
import { UrlListener } from './url-listener.ts';
import { ChromeStorageAdapter } from './chrome-storage.ts';

/**
 * Concrete Chrome MV3 Adapter implementing BaseTutorialAdapter.
 */
export class ChromeAdapter extends BaseTutorialAdapter {
  /**
   * Find DOM target element bounding box.
   */
  async findTarget(selector: StepTarget, timeoutMs = 5000): Promise<TargetBoundingBox | null> {
    const element = await DomObserver.waitForElement(selector, timeoutMs);
    if (!element) return null;
    const box = DomObserver.getBoundingBox(element);
    // Only dispatch synthetic hover events when the target has zero bounding
    // dimensions, which means it might be inside a collapsed flyout/dropdown
    // menu that needs a hover to open.
    if (box && box.width === 0 && box.height === 0) {
      DomObserver.dispatchHoverEvents(element);
    }
    return box;
  }

  /**
   * Directly find the DOM element instance for testing or inspection.
   */
  override findElement(selector: StepTarget): any {
    return DomObserver.findElement(selector);
  }

  /**
   * Return the live element details used by the overlay for diagnostics.
   */
  override describeTarget(selector: StepTarget): TargetDescription | null {
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
   */
  async scrollToElement(selector: StepTarget): Promise<void> {
    const element = DomObserver.findElement(selector);
    if (element) {
      DomObserver.scrollIntoView(element);
    }
  }

  /**
   * Continuously observe target element position on resize/scroll.
   */
  observeTargetPosition(
    selector: StepTarget,
    onChange: (box: TargetBoundingBox | null) => void
  ): () => void {
    if (typeof window === 'undefined') return () => {};

    const HYSTERESIS_PX = 4;
    let running = true;
    let lastBox: TargetBoundingBox | null = null;

    // Pin the element identity at observation start. Re-querying on every
    // frame with a generic selector (e.g. css:'button') causes the spotlight
    // to jump to whichever matching element becomes first-visible after a
    // dropdown opens. We only re-query when the pinned element disconnects.
    let pinnedElement = DomObserver.findElement(selector);

    const boxesDiffer = (a: TargetBoundingBox | null, b: TargetBoundingBox | null): boolean => {
      if (a === b) return false;
      if (!a || !b) return true;
      return (
        Math.abs(a.left - b.left) >= HYSTERESIS_PX ||
        Math.abs(a.top - b.top) >= HYSTERESIS_PX ||
        Math.abs(a.width - b.width) >= HYSTERESIS_PX ||
        Math.abs(a.height - b.height) >= HYSTERESIS_PX ||
        Boolean(a.isClipped) !== Boolean(b.isClipped)
      );
    };

    const update = (): void => {
      if (!running) return;

      // Re-query only if the pinned element has been detached from the DOM.
      if (pinnedElement && typeof pinnedElement.isConnected === 'boolean' && !pinnedElement.isConnected) {
        pinnedElement = DomObserver.findElement(selector);
      } else if (!pinnedElement) {
        pinnedElement = DomObserver.findElement(selector);
      }

      const box = pinnedElement ? DomObserver.getBoundingBox(pinnedElement) : null;
      if (boxesDiffer(lastBox, box)) {
        lastBox = box;
        onChange(box);
      }
    };

    // Listen to scroll and resize
    window.addEventListener('scroll', update, { passive: true, capture: true });
    window.addEventListener('resize', update, { passive: true });

    // Periodic animation frame check for animated/transitioning DOM elements
    let rafId: number | null = null;
    const loop = (): void => {
      if (!running) return;
      update();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', update);
    };
  }

  /**
   * Listen to user DOM interaction on target.
   */
  listenToElementEvent(
    selector: StepTarget,
    eventType: string,
    callback: (data: DomEventData) => void
  ): () => void {
    return DomEventListener.listen(selector, eventType, callback);
  }

  /**
   * Listen for SPA route changes.
   */
  listenToUrlChanges(callback: (newUrl: string) => void): () => void {
    return UrlListener.listen(callback);
  }

  /**
   * Save tutorial progress.
   */
  async saveProgress(tutorialId: string, stepIndex: number): Promise<void> {
    return ChromeStorageAdapter.saveProgress(tutorialId, stepIndex);
  }

  /**
   * Retrieve saved tutorial progress.
   */
  async getProgress(tutorialId: string): Promise<number | null> {
    return ChromeStorageAdapter.getProgress(tutorialId);
  }

  /**
   * Get current URL.
   */
  getCurrentUrl(): string {
    return typeof window !== 'undefined' ? window.location.href : '';
  }
}
