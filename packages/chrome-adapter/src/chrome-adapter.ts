import {
  BaseTutorialAdapter,
  TargetTier,
  type StepTarget,
  type TargetBoundingBox,
  type TargetDescription,
} from '@guideme/engine';
import { DomObserver } from './dom-observer.ts';
import { DomEventListener, type DomEventData } from './event-listener.ts';
import { UrlListener } from './url-listener.ts';
import { ChromeStorageAdapter } from './chrome-storage.ts';
import { resolveTarget } from './targeting/resolve-target.js';
import { resolveCanvasTarget } from './targeting/canvas-map.js';
import { installGuideMeGlobal } from './targeting/global.js';

// Install the public `window.GuideMe` namespace (anchor/registerCanvasMap/...)
// as soon as the adapter module loads. Idempotent — safe if called more than once.
installGuideMeGlobal();

/**
 * Merge a resolved rect + tier metadata into the box shape the rest of the
 * engine already expects (top/left/width/height/isClipped/...), additively.
 */
function toTieredBox(result: any): any {
  if (!result?.rect) return null;
  return {
    ...result.rect,
    tier: result.tier,
    source: result.source,
    ...(result.versionMismatch ? { versionMismatch: result.versionMismatch } : {}),
    ...(result.hintScope ? { hintScope: result.hintScope, hintLabel: result.hintLabel } : {}),
    ...(result.unsupportedCooperativeIframe ? { unsupportedCooperativeIframe: true, reason: result.reason } : {}),
  };
}

/**
 * Concrete Chrome MV3 Adapter implementing BaseTutorialAdapter.
 */
export class ChromeAdapter extends BaseTutorialAdapter {
  /**
   * Find DOM target element bounding box. Routes through the tiered
   * targeting engine (packages/chrome-adapter/src/targeting) so canvas
   * elements, same-origin iframes, and cross-origin cooperative iframes all
   * resolve to *something* rather than null.
   */
  async findTarget(selector: StepTarget, timeoutMs = 5000): Promise<TargetBoundingBox | null> {
    const element = await DomObserver.waitForElement(selector, timeoutMs);

    if (element) {
      const tag = (element.tagName || '').toLowerCase();

      if (tag === 'canvas') {
        return toTieredBox(resolveCanvasTarget(element, selector));
      }

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
      return box ? { ...box, tier: TargetTier.DOM, source: 'dom' } : null;
    }

    // Not resolvable via the standard top-document DOM pipeline — route
    // through the full tiered resolver (same-origin iframes, cross-origin
    // cooperative protocol, directional fallback). This never throws and
    // never silently returns nothing useful to render: worst case is a
    // fallback rect + textual hint.
    const result = await resolveTarget(selector, { timeoutMs: Math.min(timeoutMs, 300) });
    return toTieredBox(result);
  }

  /**
   * Directly find the DOM element instance for testing or inspection.
   *
   * Mirrors the JIT dynamic-grounding fallback in StepResolver.resolveTarget:
   * if the step's literal CSS doesn't match anything on the page but a
   * text/ariaLabel hint is present, retry against generic interactive tags.
   * Without this, a stale selector makes the spotlight highlight one element
   * (found via that fallback) while click-validation keeps checking against
   * the original, now-unmatched selector — so the step can never validate no
   * matter what the user clicks.
   */
  override findElement(selector: StepTarget): any {
    const primary = DomObserver.findElement(selector);
    if (primary) return primary;

    if (selector?.text || selector?.ariaLabel) {
      const fallbackSelector: StepTarget = {
        ...selector,
        css: '[role="menuitem"], [role="option"], button, a, [role="button"], span, div, p',
      };
      return DomObserver.findElement(fallbackSelector);
    }

    return null;
  }

  /**
   * Return the live element details used by the overlay for diagnostics.
   */
  override describeTarget(selector: StepTarget): TargetDescription | null {
    const element = DomObserver.findElement(selector);
    if (!element) return null;

    const getAttribute = element.getAttribute?.bind(element);
    const tag = (element.tagName || '').toLowerCase();
    const rect = typeof element.getBoundingClientRect === 'function'
      ? element.getBoundingClientRect()
      : null;

    const canvasInfo = tag === 'canvas' ? resolveCanvasTarget(element, selector) : null;

    return {
      tag,
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
      ...(canvasInfo ? { tier: canvasInfo.tier, source: canvasInfo.source } : {}),
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

    // Canvas-aware box lookup for the pinned element. Same-origin-iframe and
    // fallback/cross-origin tiers keep the position resolved once by
    // findTarget() above rather than re-running the heavier tiered resolver
    // on every animation frame — DomObserver.findElement cannot re-locate
    // those elements from the top document, so pinnedElement simply stays
    // null and lastBox (last known position) is left untouched.
    const computeBox = (element: any): TargetBoundingBox | null => {
      if (!element) return null;
      const tag = (element.tagName || '').toLowerCase();
      if (tag === 'canvas') {
        const result = resolveCanvasTarget(element, selector);
        return toTieredBox(result);
      }
      const box = DomObserver.getBoundingBox(element);
      return box ? { ...box, tier: TargetTier.DOM, source: 'dom' } : null;
    };

    const update = (): void => {
      if (!running) return;

      // Re-query only if the pinned element has been detached from the DOM.
      if (pinnedElement && typeof pinnedElement.isConnected === 'boolean' && !pinnedElement.isConnected) {
        pinnedElement = DomObserver.findElement(selector);
      } else if (!pinnedElement) {
        pinnedElement = DomObserver.findElement(selector);
      }

      const box = computeBox(pinnedElement);
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
