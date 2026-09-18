import { ValidationType } from '../types/index.ts';
import type { TutorialStep, StepTarget } from '../types/index.ts';
import type { BaseTutorialAdapter } from '../adapter/base-adapter.ts';

export interface ValidationEngineResult {
  valid: boolean;
  eventData?: any;
}

export interface BindValidationOptions {
  onHesitation?: () => void;
  onMisclick?: (data: { target?: StepTarget; event?: any; coordinates?: { x: number; y: number } }) => void;
  hesitationTimeoutMs?: number;
  targetBoundingBox?: any;
  getTargetBoundingBox?: () => any;
}

/**
 * Evaluates user interactions and environmental states against step validation rules.
 * Manages active learner rescue mechanisms including hesitation timers and misclick detection.
 */
export class ValidationEngine {
  /**
   * Set up validation listeners and rescue monitors for the active step.
   * @param step - Active step definition
   * @param adapter - Tutorial adapter
   * @param onValidate - Callback on validation
   * @param options - Monitoring options
   * @returns Cleanup function to unsubscribe listeners and clear timers
   */
  static bindValidation(
    step: TutorialStep | null | undefined,
    adapter: BaseTutorialAdapter | null | undefined,
    onValidate: (result: ValidationEngineResult) => void,
    options: BindValidationOptions = {}
  ): () => void {
    if (!step || !step.validation || !adapter) {
      return () => {};
    }

    const { validation, target } = step;
    const cleanups: Array<() => void> = [];

    // ── 1. Hesitation Timer (15s Inactivity Detection) ──
    const timeoutMs = (step as any).hesitationTimeoutMs || options.hesitationTimeoutMs || 15000;
    let hesitationTimer: any = null;

    const startHesitationTimer = () => {
      if (hesitationTimer) clearTimeout(hesitationTimer);
      if (typeof options.onHesitation === 'function') {
        hesitationTimer = setTimeout(() => {
          options.onHesitation!();
        }, timeoutMs);
      }
    };

    const resetHesitationTimer = () => {
      startHesitationTimer();
    };

    startHesitationTimer();

    cleanups.push(() => {
      if (hesitationTimer) {
        clearTimeout(hesitationTimer);
        hesitationTimer = null;
      }
    });

    // Helper to check if an element is a workflow completion button (Done, Send, Save, etc.)
    const isCompletionElement = (node: any): boolean => {
      if (!node || typeof node.getAttribute !== 'function') return false;

      // Only real interactive controls can count as a "completion button" — a
      // large wrapping <div> is never one, even though its *aggregated*
      // textContent (all descendant text combined) can innocently contain a
      // matching word. Google Sheets, for example, permanently shows "All
      // changes saved in Drive" in its header, so without this guard almost
      // any click bubbling through that region would match on some ancestor
      // container regardless of what was actually clicked.
      const tag = (node.tagName || '').toLowerCase();
      const role = (node.getAttribute('role') || '').toLowerCase();
      const isInteractive =
        tag === 'button' ||
        tag === 'a' ||
        (tag === 'input' && ['submit', 'button'].includes((node.getAttribute('type') || '').toLowerCase())) ||
        ['button', 'menuitem', 'option'].includes(role);
      if (!isInteractive) return false;

      // Use the node's own direct text where possible; textContent is still
      // used as a fallback for icon buttons whose label lives in a child span,
      // but interactive elements are small enough that this stays precise.
      const text = (node.textContent || '').trim().toLowerCase();
      const aria = (node.getAttribute('aria-label') || node.getAttribute('title') || '').trim().toLowerCase();
      const id = (node.id || '').toLowerCase();
      const testId = (node.getAttribute('data-testid') || '').toLowerCase();
      const combined = `${text} ${aria} ${id} ${testId}`;
      return (
        combined.includes('done') ||
        combined.includes('send') ||
        combined.includes('save') ||
        combined.includes('submit') ||
        combined.includes('apply') ||
        combined.includes('finish') ||
        combined.includes('close') ||
        combined.includes('រួចរាល់') ||
        combined.includes('ផ្ញើ') ||
        combined.includes('រក្សាទុក')
      );
    };

    // ── 2. Misclick Detection (Clicks Outside Target on Click Steps) ──
    if (
      validation.type === ValidationType.CLICK &&
      target &&
      typeof options.onMisclick === 'function' &&
      typeof document !== 'undefined'
    ) {
      const misclickHandler = (event: any) => {
        // Reset hesitation timer on any interaction attempt
        resetHesitationTimer();

        // Guard A: Ignore clicks inside GuideMe's isolated UI root
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        const isInsideGuideMe = path.some(
          (node: any) =>
            node.id === 'guideme-tutorial-root' ||
            node.tagName === 'GUIDEME-TUTORIAL-ROOT' ||
            (node.classList && node.classList.contains('guideme-root-overlay'))
        );
        if (isInsideGuideMe) {
          return;
        }

        // Guard B: Ignore clicks on or inside primary target element
        const targetElement =
          typeof (adapter as any).findElement === 'function' ? (adapter as any).findElement(target) : null;
        if (targetElement) {
          if (
            event.target === targetElement ||
            targetElement.contains(event.target) ||
            path.includes(targetElement)
          ) {
            return; // Valid primary target click
          }
        }

        // Guard C: Ignore clicks on alternative targets or workflow completion buttons (Done, Send, Save)
        const altTargets = (validation as any).alternativeTargets || (step as any).alternativeTargets || [];
        for (const alt of altTargets) {
          const altEl = typeof (adapter as any).findElement === 'function' ? (adapter as any).findElement(alt) : null;
          if (altEl && (event.target === altEl || altEl.contains(event.target) || path.includes(altEl))) {
            return; // Valid alternative click
          }
        }

        const isActionComp = path.some((node: any) => isCompletionElement(node));
        if (isActionComp) {
          return; // Valid completion button click
        }

        // Guard D: Coordinate fallback matching if bounding box provided
        const box = typeof options.getTargetBoundingBox === 'function'
          ? options.getTargetBoundingBox()
          : options.targetBoundingBox;

        if (box && typeof event.clientX === 'number') {
          const { left, right, top, bottom } = box;
          const padding = 8;
          if (
            event.clientX >= left - padding &&
            event.clientX <= right + padding &&
            event.clientY >= top - padding &&
            event.clientY <= bottom + padding
          ) {
            return; // Clicked within target bounding perimeter
          }
        }

        // Outside click confirmed on interactive host page -> Trigger misclick rescue
        options.onMisclick!({
          target,
          event,
          coordinates: { x: event.clientX, y: event.clientY },
        });
      };

      document.addEventListener('click', misclickHandler, true);
      cleanups.push(() => {
        document.removeEventListener('click', misclickHandler, true);
      });
    }

    // ── 3. Universal Action Validation Listeners ──
    // Deduplicate: if target and an alternativeTarget resolve to the same selector
    // string, two listeners would register on the same element and both call
    // onValidate on a single click — causing the double-advance bug.
    // Dedupe by selector *content*, not object identity — `target` and an
    // `alternativeTarget` are near-always distinct object literals even when
    // they describe the exact same selector, so `new Set(...)` (reference
    // equality) never actually removed a duplicate.
    const rawTargets: StepTarget[] = [target, ...((validation as any).alternativeTargets || (step as any).alternativeTargets || [])].filter(Boolean) as StepTarget[];
    const seenTargetKeys = new Set<string>();
    const allTargets = rawTargets.filter((t) => {
      let key: string;
      try { key = JSON.stringify(t); } catch { key = String(t); }
      if (seenTargetKeys.has(key)) return false;
      seenTargetKeys.add(key);
      return true;
    });

    // Global Completion Listener — only for INPUT/CHANGE steps
    if (
      typeof document !== 'undefined' &&
      (validation.type === ValidationType.INPUT || validation.type === ValidationType.CHANGE)
    ) {
      const globalCompletionHandler = (event: any) => {
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        const isInsideGuideMe = path.some(
          (node: any) =>
            node.id === 'guideme-tutorial-root' ||
            node.tagName === 'GUIDEME-TUTORIAL-ROOT' ||
            (node.classList && node.classList.contains('guideme-root-overlay'))
        );
        if (isInsideGuideMe) return;

        const compNode = path.find((node: any) => isCompletionElement(node));
        if (!compNode) return;

        const inputEl = typeof (adapter as any).findElement === 'function' ? (adapter as any).findElement(target!) : null;
        // If the step's own target can't be located on the page at all, there is
        // no way to confirm this completion click is actually related to it —
        // validating anyway would let ANY "Done/Save/Submit"-ish click ANYWHERE
        // on the page silently advance the step. This previously happened
        // whenever a target selector didn't precisely resolve, which is common
        // for freshly AI-generated selectors.
        if (!inputEl) return;

        // Accept if the completion button shares a common form or dialog ancestor
        // with the input target (within 6 DOM levels).
        const form = inputEl.closest?.('form, dialog, [role="dialog"], [role="form"]');
        const compInSameForm = form && form.contains(compNode);
        if (!compInSameForm) return;

        onValidate({ valid: true, eventData: { reason: 'completion_button_clicked', target: compNode } });
      };

      document.addEventListener('click', globalCompletionHandler, true);
      cleanups.push(() => {
        document.removeEventListener('click', globalCompletionHandler, true);
      });
    }

    // Global Dialog / Menu Action Listener for CLICK-type steps whose target
    // lives inside a menu/dropdown/dialog that can re-render its DOM nodes
    // between open and click (Google-style menus commonly do this, breaking
    // a plain element-reference or selector re-query). GM-020: this was
    // previously nested inside the INPUT/CHANGE-only block above and gated
    // on `validation.type === CLICK` at the same time — a condition that can
    // never be true, so it was dead code. It's also now scoped to the step's
    // own target (same dialog/menu container), matching the
    // `globalCompletionHandler` pattern above, instead of accepting ANY
    // menuitem/option/dialog-button click anywhere on the page as "done".
    if (typeof document !== 'undefined' && validation.type === ValidationType.CLICK) {
      const dialogInteractionHandler = (event: any) => {
        const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        const isInsideGuideMe = path.some(
          (node: any) =>
            node.id === 'guideme-tutorial-root' ||
            node.tagName === 'GUIDEME-TUTORIAL-ROOT' ||
            (node.classList && node.classList.contains('guideme-root-overlay'))
        );
        if (isInsideGuideMe) return;

        const menuNode = path.find(
          (node: any) =>
            node && node.getAttribute &&
            (node.getAttribute('role') === 'menuitem' ||
             node.getAttribute('role') === 'option' ||
             node.classList?.contains('goog-menuitem') ||
             node.classList?.contains('goog-menuitem-content') ||
             (node.getAttribute('role') === 'button' && Boolean(node.closest?.('dialog, [role="dialog"], [aria-modal="true"], .apps-share-dialog, .modal-dialog'))))
        );
        if (!menuNode) return;

        // Require the clicked menu/dialog item's visible text (or aria-label)
        // to actually match the step's target text/label — accepting ANY
        // menuitem click anywhere let a user click an unrelated option and
        // have the tutorial silently advance as if they'd done the right
        // thing.
        const targetText = (target?.text || target?.ariaLabel || '').trim().toLowerCase();
        if (!targetText) return;
        const clickedText = (menuNode.textContent || menuNode.getAttribute?.('aria-label') || '').trim().toLowerCase();
        if (!clickedText || !clickedText.includes(targetText)) return;

        onValidate({ valid: true, eventData: { reason: 'dialog_menu_clicked', target: menuNode } });
      };

      document.addEventListener('click', dialogInteractionHandler, true);
      cleanups.push(() => {
        document.removeEventListener('click', dialogInteractionHandler, true);
      });
    }

    switch (validation.type) {
      case ValidationType.CLICK:
        allTargets.forEach((tgt) => {
          const unsub = adapter.listenToElementEvent(tgt, 'click', (eventData: any) => {
            onValidate({ valid: true, eventData });
          });
          cleanups.push(unsub);
        });
        break;

      case ValidationType.INPUT:
      case ValidationType.CHANGE:
        allTargets.forEach((tgt) => {
          let inputDebounceTimer: any = null;
          cleanups.push(() => {
            if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
          });

          // Input/change steps must always wait for a genuine user interaction
          // (typing, change, or Enter) below — never auto-validate purely from
          // whatever value the target field happens to already hold when the
          // step activates. A field can already display a matching value for
          // reasons unrelated to the user completing this step (e.g. a
          // spreadsheet Name Box always shows some cell reference, which can
          // coincidentally match the step's expectedValue), which previously
          // caused steps to silently self-validate and cascade through the
          // rest of the guide without any real interaction.

          // 1. Continuous Input listener (typing)
          const unsubInput = adapter.listenToElementEvent(tgt, 'input', (eventData: any) => {
            resetHesitationTimer();
            const val = (eventData?.targetValue ?? '').trim();

            if (validation.expectedValue) {
              const expected = String(validation.expectedValue).toLowerCase();
              const actual = val.toLowerCase();
              const matches =
                (validation as any).exactMatch === true ? actual === expected : actual.includes(expected);
              if (matches) {
                if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
                onValidate({ valid: true, eventData });
              }
            } else if (val.length > 0) {
              // Generic input step without strict expected value:
              // Debounce validation so user finishes typing their query
              if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
              inputDebounceTimer = setTimeout(() => {
                onValidate({ valid: true, eventData });
              }, 650);
            }
          });
          cleanups.push(unsubInput);

          // 2. Change event (blur or tab away)
          const unsubChange = adapter.listenToElementEvent(tgt, 'change', (eventData: any) => {
            resetHesitationTimer();
            if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
            const val = (eventData?.targetValue ?? '').trim();
            if (validation.expectedValue) {
              const expected = String(validation.expectedValue).toLowerCase();
              if (val.toLowerCase().includes(expected)) {
                onValidate({ valid: true, eventData });
              }
            } else if (val.length > 0) {
              onValidate({ valid: true, eventData });
            }
          });
          cleanups.push(unsubChange);

          // 3. Enter key submission
          const unsubKey = adapter.listenToElementEvent(tgt, 'keydown', (eventData: any) => {
            resetHesitationTimer();
            if (eventData?.key === 'Enter' || eventData?.originalEvent?.key === 'Enter') {
              if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
              const val = (eventData?.targetValue ?? '').trim();
              if (validation.expectedValue) {
                const expected = String(validation.expectedValue).toLowerCase();
                if (val.toLowerCase().includes(expected)) {
                  onValidate({ valid: true, eventData });
                } else if (val.length > 0) {
                  onValidate({ valid: true, eventData });
                }
              } else if (val.length > 0) {
                onValidate({ valid: true, eventData });
              }
            }
          });
          cleanups.push(unsubKey);

          // 4. Rendered-text fallback for hosts that never fire native
          // input/change/keydown on the visible target at all — canvas-
          // rendered grids (e.g. Google Sheets) capture keystrokes globally
          // and manage cell content as internal state, leaving
          // document.activeElement on <body> and no DOM event ever
          // targeting the cell. The visible element's rendered text still
          // changes as the user types, so watch that directly instead of
          // relying on an event that will never come. Applies whether or not
          // the step has a fixed expectedValue — a generic "type anything"
          // step on one of these hosts is just as unreachable via real DOM
          // events as a fixed-value one.
          if (typeof MutationObserver !== 'undefined') {
            const targetEl = typeof (adapter as any).findElement === 'function' ? (adapter as any).findElement(tgt) : null;
            if (targetEl) {
              let mutationDebounce: any = null;
              const checkTextMatch = () => {
                const val = (targetEl.textContent ?? targetEl.value ?? '').trim().toLowerCase();
                if (!val) return;
                if (validation.expectedValue) {
                  const expected = String(validation.expectedValue).toLowerCase();
                  const matches = (validation as any).exactMatch === true ? val === expected : val.includes(expected);
                  if (matches) {
                    onValidate({ valid: true, eventData: { reason: 'mutation_text_match', targetValue: val } });
                  }
                } else {
                  onValidate({ valid: true, eventData: { reason: 'mutation_text_match', targetValue: val } });
                }
              };
              const observer = new MutationObserver(() => {
                resetHesitationTimer();
                if (mutationDebounce) clearTimeout(mutationDebounce);
                mutationDebounce = setTimeout(checkTextMatch, validation.expectedValue ? 400 : 650);
              });
              try {
                observer.observe(targetEl, { childList: true, characterData: true, subtree: true });
              } catch {
                // Ignore hosts where the resolved node can't be observed (e.g. detached).
              }
              cleanups.push(() => {
                if (mutationDebounce) clearTimeout(mutationDebounce);
                observer.disconnect();
              });
            }
          }
        });
        break;

      case ValidationType.URL_CHANGE:
        const unsubUrl = adapter.listenToUrlChanges((newUrl) => {
          resetHesitationTimer();
          if ((validation as any).targetUrlPattern) {
            const escaped = (validation as any).targetUrlPattern
              .replace(/[.+^${}()|[\]\\]/g, '\\$&')
              .replace(/\*/g, '.*');
            const regex = new RegExp(escaped, 'i');
            if (regex.test(newUrl)) {
              onValidate({ valid: true, eventData: { newUrl } });
            }
          } else {
            onValidate({ valid: true, eventData: { newUrl } });
          }
        });
        cleanups.push(unsubUrl);
        break;

      case ValidationType.MANUAL_NEXT:
      default:
        // Programmatic progression
        break;
    }

    return () => {
      cleanups.forEach((cleanup) => {
        try {
          cleanup();
        } catch {
          // Ignore cleanup errors
        }
      });
    };
  }
}
