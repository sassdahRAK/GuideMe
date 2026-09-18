import type { StepTarget, TargetBoundingBox } from '@guideme/engine';

/**
 * Generates a safe CSS ID selector. If the ID contains characters that make
 * direct #id invalid (colons, dots, spaces, brackets, leading digits), it falls
 * back to an attribute selector [id="..."] which is universally valid.
 */
export function safeIdSelector(id: string): string {
  if (!id || typeof id !== 'string') return '';
  if (/^[^a-zA-Z_]|[^a-zA-Z0-9_-]/.test(id)) {
    return `[id="${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
  }
  return `#${id}`;
}

/**
 * Sanitizes potentially invalid CSS selector strings (e.g. '#:6j', '#:a7').
 * Converts invalid ID syntax into robust attribute selectors.
 */
export function sanitizeCssSelector(selector: string): string {
  if (!selector || typeof selector !== 'string') return selector;
  return selector
    .replace(/#([^\s>+~.[\]:]*(?::[^\s>+~.[\]:]*)+)/g, (_match, id) => `[id="${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`)
    .replace(/#([0-9][^\s>+~.[\]]*)/g, (_match, id) => `[id="${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`);
}

/**
 * Checks if an element is a dialog container to avoid matching it as a button or target.
 */
function isDialogContainer(el: any): boolean {
  if (!el) return false;
  const role = el.getAttribute?.('role');
  return role === 'dialog' || role === 'alertdialog' || (el.tagName && el.tagName.toLowerCase() === 'dialog');
}

/**
 * Resilient DOM Query and MutationObserver Utilities.
 */
export class DomObserver {
  static safeIdSelector(id: string): string {
    return safeIdSelector(id);
  }

  static sanitizeCssSelector(selector: string): string {
    return sanitizeCssSelector(selector);
  }

  static normalizeText(value: unknown): string {
    return String(value || '')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /**
   * Create a resilient selector from a user-picked live DOM element.
   * Works universally across any website — does not depend on React,
   * Google Docs, or any other framework-specific attributes.
   */
  static createTargetSelector(element: HTMLElement | Element | null | undefined): StepTarget {
    if (!element || typeof element !== 'object') return { css: 'body' };

    const tag = ((element as Element).tagName || 'div').toLowerCase();
    const getAttribute = (element as Element).getAttribute?.bind(element);
    const testId = getAttribute?.('data-testid') || getAttribute?.('data-cy') || '';
    const formEl = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const name = getAttribute?.('name') || formEl.name || '';
    const ariaLabel = getAttribute?.('aria-label') || getAttribute?.('title') || '';
    const text = ((element as Element).textContent || formEl.value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const escape = (value: string) => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const buildClassSelector = (): string => {
      const classList = (element as Element).classList;
      if (!classList || classList.length === 0) return '';
      const meaningful = Array.from(classList).filter((cls) =>
        cls.length >= 3 &&
        !/^[a-z]-\d/.test(cls) &&            // e.g. "w-4", "h-8" Tailwind
        !/^[_]{2}/.test(cls) &&               // dunder prefixes (__class)
        !/[a-f0-9]{6,}$/i.test(cls) &&        // hash suffix (CSS modules)
        !/^\d/.test(cls)                       // starts with digit
      ).slice(0, 3);
      if (meaningful.length === 0) return '';
      return `${tag}.${meaningful.map(escape).join('.')}`;
    };

    const target: StepTarget = {};
    const elId = (element as Element).id;
    if (elId) {
      target.css = safeIdSelector(elId);
    } else if (testId) {
      target.css = getAttribute?.('data-testid')
        ? `[data-testid="${escape(testId)}"]`
        : `[data-cy="${escape(testId)}"]`;
    } else if (name) {
      target.css = `${tag}[name="${escape(name)}"]`;
    } else if (ariaLabel) {
      target.css = `${tag}[aria-label="${escape(ariaLabel)}"]`;
    } else {
      const classCss = buildClassSelector();
      target.css = classCss || tag;
    }

    if (testId) target.testId = testId;
    if (ariaLabel) target.ariaLabel = ariaLabel;
    if (text) target.text = text;
    return target;
  }

  /**
   * Dispatches synthetic pointerenter, pointerover, mouseover, and mouseenter events
   * to trigger flyouts and dropdown menus.
   */
  static dispatchHoverEvents(element: HTMLElement | Element | null | undefined): void {
    if (!element || typeof (element as Element).dispatchEvent !== 'function') return;
    try {
      const doc = (element as Element).ownerDocument || (typeof document !== 'undefined' ? document : null);
      const win = doc?.defaultView || (typeof window !== 'undefined' ? window : null);
      const opts = { bubbles: true, cancelable: true, view: win as Window | null };

      if (typeof PointerEvent !== 'undefined') {
        (element as Element).dispatchEvent(new PointerEvent('pointerover', opts));
        (element as Element).dispatchEvent(new PointerEvent('pointerenter', { ...opts, bubbles: false }));
      }
      if (typeof MouseEvent !== 'undefined') {
        (element as Element).dispatchEvent(new MouseEvent('mouseover', opts));
        (element as Element).dispatchEvent(new MouseEvent('mouseenter', { ...opts, bubbles: false }));
      } else if (typeof CustomEvent !== 'undefined') {
        (element as Element).dispatchEvent(new CustomEvent('mouseover', opts));
        (element as Element).dispatchEvent(new CustomEvent('mouseenter', { ...opts, bubbles: false }));
      } else {
        (element as Element).dispatchEvent({ type: 'mouseover', bubbles: true } as any);
        (element as Element).dispatchEvent({ type: 'mouseenter', bubbles: false } as any);
      }

      if (typeof FocusEvent !== 'undefined') {
        (element as Element).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      }
    } catch {
      // ignore synthetic event errors
    }
  }

  /**
   * Recursively query all matching elements across the DOM and open shadow roots.
   */
  static querySelectorAllDeep(root: any, selector: string): any[] {
    const results: any[] = [];
    if (!root || !selector) return results;

    const seen = new Set<any>();

    const traverse = (node: any): void => {
      if (!node) return;

      if (typeof node.querySelectorAll === 'function') {
        try {
          const matches = node.querySelectorAll(selector);
          for (let i = 0; i < matches.length; i++) {
            const m = matches[i];
            if (!seen.has(m)) {
              seen.add(m);
              results.push(m);
            }
          }
        } catch {
          // ignore query errors
        }
      }

      // Check all children for open shadow roots
      if (typeof node.querySelectorAll === 'function') {
        try {
          const allChildren = node.querySelectorAll('*');
          for (let i = 0; i < allChildren.length; i++) {
            const child = allChildren[i];
            // Never descend into GuideMe's own overlay UI shadow root — it
            // mounts as an open shadow root (guideme-tutorial-root) so it stays
            // inspectable, but its own Next/Skip buttons and step text must
            // never be resolvable as a tutorial target on the host page.
            if (child && (child.tagName || '').toLowerCase() === 'guideme-tutorial-root') continue;
            if (child && child.shadowRoot) {
              traverse(child.shadowRoot);
            }
          }
        } catch {
          // ignore shadow root query errors
        }
      }
    };

    traverse(root);
    return results;
  }

  /**
   * Recursively query the first matching element across the DOM and open shadow roots.
   */
  static querySelectorDeep(root: any, selector: string): any | null {
    if (!root || !selector) return null;

    if (typeof root.querySelector === 'function') {
      try {
        const direct = root.querySelector(selector);
        if (direct) return direct;
      } catch {
        // ignore direct query error
      }
    }

    if (typeof root.querySelectorAll === 'function') {
      try {
        const allChildren = root.querySelectorAll('*');
        for (let i = 0; i < allChildren.length; i++) {
          const child = allChildren[i];
          if (child && (child.tagName || '').toLowerCase() === 'guideme-tutorial-root') continue;
          if (child && child.shadowRoot) {
            const shadowMatch = this.querySelectorDeep(child.shadowRoot, selector);
            if (shadowMatch) return shadowMatch;
          }
        }
      } catch {
        // ignore shadow query error
      }
    }

    return null;
  }

  /**
   * Evaluate XPath query with open shadow root traversal.
   */
  static evaluateXPathDeep(xpath: string, doc: any): any | null {
    if (!xpath || !doc) return null;

    // 1. Direct document evaluate
    if (typeof doc.evaluate === 'function' && typeof XPathResult !== 'undefined') {
      try {
        const result = doc.evaluate(
          xpath,
          doc,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        if (result?.singleNodeValue) {
          return result.singleNodeValue;
        }
      } catch {
        // ignore xpath error
      }
    }

    // 2. Open shadow root traversal fallback
    try {
      const allNodes = doc.querySelectorAll ? doc.querySelectorAll('*') : [];
      for (let i = 0; i < allNodes.length; i++) {
        if ((allNodes[i].tagName || '').toLowerCase() === 'guideme-tutorial-root') continue;
        const sr = allNodes[i].shadowRoot;
        if (!sr) continue;

        const idMatch = xpath.match(/@id\s*=\s*['"]([^'"]+)['"]/);
        if (idMatch) {
          const el = this.querySelectorDeep(sr, `#${idMatch[1]}`);
          if (el) return el;
        }

        const testIdMatch = xpath.match(/@data-testid\s*=\s*['"]([^'"]+)['"]/);
        if (testIdMatch) {
          const el = this.querySelectorDeep(sr, `[data-testid="${testIdMatch[1]}"]`);
          if (el) return el;
        }

        const textMatch = xpath.match(/text\(\)\s*=\s*['"]([^'"]+)['"]/);
        if (textMatch) {
          const norm = this.normalizeText(textMatch[1]);
          const candidates = this.querySelectorAllDeep(sr, 'button, a, [role="button"], span, div');
          for (const btn of candidates) {
            if (this.normalizeText(btn.textContent) === norm) {
              return btn;
            }
          }
        }
      }
    } catch {
      // ignore shadow traversal error
    }

    return null;
  }

  /**
   * Finds all scrollable or overflow-clipping ancestor elements.
   */
  static getScrollableAncestors(element: any): any[] {
    const ancestors: any[] = [];
    if (!element || typeof element !== 'object') return ancestors;

    const doc = element.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const body = doc?.body;
    const docEl = doc?.documentElement;
    const visited = new Set<any>();

    let curr = element.parentElement || (element.getRootNode?.()?.host || null);
    let depth = 0;

    while (curr && curr !== body && curr !== docEl && depth < 50) {
      if (visited.has(curr)) break;
      visited.add(curr);
      depth++;

      try {
        const win = doc?.defaultView || (typeof window !== 'undefined' ? window : null);
        const style = win?.getComputedStyle ? win.getComputedStyle(curr) : null;
        if (style) {
          const overflow = `${style.overflow} ${style.overflowY} ${style.overflowX}`;
          if (/(auto|scroll|hidden|clip)/.test(overflow)) {
            ancestors.push(curr);
          }
        }
      } catch {
        // ignore style error
      }
      curr = curr.parentElement || (curr.getRootNode?.()?.host || null);
    }

    return ancestors;
  }

  /**
   * Smoothly scrolls an element into view, adjusting both window scroll and any
   * nested scrollable ancestor containers.
   */
  static scrollIntoView(element: any): void {
    if (!element) return;

    if (typeof element.scrollIntoView === 'function') {
      try {
        const rect = element.getBoundingClientRect();
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
        const margin = 48;
        const isFullyVisible =
          rect.top >= margin &&
          rect.left >= margin &&
          rect.bottom <= vh - margin &&
          rect.right <= vw - margin;
        if (!isFullyVisible) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        }
      } catch {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }
    }

    const ancestors = this.getScrollableAncestors(element);
    for (const container of ancestors) {
      try {
        if (container.scrollHeight > container.clientHeight || container.scrollWidth > container.clientWidth) {
          const cRect = container.getBoundingClientRect();
          const eRect = element.getBoundingClientRect();

          if (eRect.top < cRect.top || eRect.bottom > cRect.bottom) {
            const deltaY = eRect.top - cRect.top - (container.clientHeight / 2 - eRect.height / 2);
            container.scrollTop += deltaY;
          }

          if (eRect.left < cRect.left || eRect.right > cRect.right) {
            const deltaX = eRect.left - cRect.left - (container.clientWidth / 2 - eRect.width / 2);
            container.scrollLeft += deltaX;
          }
        }
      } catch {
        // ignore container scroll error
      }
    }
  }

  /**
   * Whether an element is actually visible on screen — NOT the same as being
   * laid out. `getClientRects().length > 0` (and `offsetParent !== null`) are
   * both true for a `position: absolute`/`fixed` element moved far off-canvas
   * (e.g. `top: -9998px`) or collapsed to 0 width — a common pattern for
   * helper/proxy elements apps keep focusable for IME or accessibility
   * purposes without ever showing them. Google Sheets' `#waffle-rich-text-editor`
   * is exactly this: it shares its class and role with the real, visible
   * formula bar, so without this check it gets treated as a legitimate target.
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  static isVisible(element) {
    if (!element) return false;
    try {
      if (typeof element.getBoundingClientRect === 'function') {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        const viewportW = typeof window !== 'undefined' ? window.innerWidth : Infinity;
        const viewportH = typeof window !== 'undefined' ? window.innerHeight : Infinity;
        if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= viewportW || rect.top >= viewportH) {
          return false;
        }
        return true;
      }
    } catch {}
    return Boolean(
      element.offsetParent !== null ||
      element.getClientRects?.().length > 0
    );
  }

  /**
   * Find an element immediately using fallback strategies.
   */
  static findElement(selector: StepTarget | null | undefined): any | null {
    if (!selector || typeof document === 'undefined') return null;

    const isVisible = (element: any): boolean => this.isVisible(element);
    const isDialogContainer = (element: any): boolean => Boolean(
      element && element.closest?.(
        '[role="dialog"], [role="alertdialog"], dialog, [aria-modal="true"]'
      )
    );
    const targetText = selector.text ? this.normalizeText(selector.text) : '';
    const targetAria = selector.ariaLabel ? selector.ariaLabel.trim().toLowerCase() : '';
    const isGenericCss = /^(button|div|a|input|span|select|p)$/i.test((selector.css || '').trim());
    const allowPartialText = Boolean(selector.css && !isGenericCss);

    // Handle hover-triggered target resolution if specified
    if (selector.hoverTrigger && typeof selector.hoverTrigger === 'object') {
      const triggerEl = this.findElement(selector.hoverTrigger as StepTarget);
      if (triggerEl) {
        this.dispatchHoverEvents(triggerEl);
      }
    }

    // Handle container scoping to prioritize active dialog or specific containers
    if (selector.container && typeof selector.container === 'string') {
      try {
        const containerEl = this.querySelectorDeep(document, selector.container);
        if (containerEl) {
          if (selector.css && typeof selector.css === 'string') {
            const cleanSubCss = selector.css.replace(selector.container, '').trim();
            const innerMatch = this.querySelectorDeep(containerEl, cleanSubCss || selector.css);
            if (innerMatch && this.isVisible(innerMatch)) {
              if (!targetText || this.normalizeText(innerMatch.textContent) === targetText || this.normalizeText(innerMatch.value) === targetText) {
                return innerMatch;
              }
            }
          }
          if (targetText) {
            const containerButtons = this.querySelectorAllDeep(containerEl, 'button, [role="button"], input[type="submit"], a, input');
            for (const btn of containerButtons) {
              if (this.normalizeText(btn.textContent) === targetText || this.normalizeText(btn.value) === targetText) {
                if (this.isVisible(btn)) {
                  return btn;
                }
              }
            }
          }
        }
      } catch {
        // ignore container search error
      }
    }

    const HEADING_OR_LABEL_TAG = /^(h1|h2|h3|h4|h5|h6|label)$/i;
    const INTERACTIVE_DISAMBIGUATION_SELECTOR = 'button, a, input, select, textarea, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="option"], summary';

    // 1. Direct CSS Selector Strategy (Traverses Open Shadow Roots)
    if (selector.css) {
      // Sanitize any CSS selector that would throw on querySelectorAll / matches
      // (e.g. bare ID selectors with colons: #:6j → [id=":6j"]).
      const safeCss = this.sanitizeCssSelector(selector.css);

      // For composite selectors (A, B, C), also try each part independently.
      // This ensures that if a broad composite hits a container element first,
      // we can also search the narrower leaf-control parts in isolation.
      const cssParts = safeCss.includes(',')
        ? safeCss.split(',').map((p) => p.trim()).filter(Boolean)
        : [safeCss];

      const isContainerRole = (el) => {
        const role = el.getAttribute?.('role') || '';
        return /^(dialog|alertdialog|region|main|complementary|banner|navigation|form)$/.test(role) ||
          el.tagName === 'DIALOG' ||
          el.getAttribute?.('aria-modal') === 'true';
      };

      // Helper: score + collect visible candidates from a set of matches
      const collectCandidates = (matches) => {
        const scored = [];
        for (const el of matches) {
          if (!isVisible(el)) continue;
          const elText = this.normalizeText(el.textContent);
          const elAria = (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || el.getAttribute?.('data-tooltip') || '').trim().toLowerCase();
          const elVal = this.normalizeText(el.value || el.getAttribute?.('value') || '');

          if (targetText || targetAria) {
            const exactText = targetText && (elText === targetText || elVal === targetText);
            const exactAria = targetAria && (elAria === targetAria || elAria.includes(targetAria));
            const partialText = allowPartialText && targetText && (elText.includes(targetText) || elVal.includes(targetText));
            const partialAria = targetAria && elAria.includes(targetAria);
            if (exactText || exactAria || partialText || partialAria) {
              // Penalize container/dialog wrappers so leaf controls win
              scored.push({ el, score: isContainerRole(el) ? 0 : 1 });
            }
          } else {
            // No text/aria constraint — keep for first-visible return
            scored.push({ el, score: isContainerRole(el) ? 0 : 1 });
          }
        }
        return scored;
      };

      try {
        let allScored = [];

        if (cssParts.length > 1) {
          // Query each part of the composite selector independently so results
          // from specific leaf-control parts can be ranked above container parts.
          for (const part of cssParts) {
            try {
              const partMatches = this.querySelectorAllDeep(document, part);
              allScored.push(...collectCandidates(partMatches));
            } catch {}
          }
        } else {
          const matches = this.querySelectorAllDeep(document, safeCss);
          allScored = collectCandidates(matches);
        }

        if (allScored.length > 0) {
          allScored.sort((a, b) => b.score - a.score);
          let winner = allScored[0].el;

          // Heading/label vs. interactive-control disambiguation: a step's
          // `css` selector can resolve to a heading or label that happens to
          // share the exact same visible text as the real actionable control
          // (e.g. a section title "ប្ដូរ Password" sitting above a button
          // labeled "ប្ដូរ Password"). Headings/labels are never themselves
          // a click/input target, so when text is present, prefer a real
          // interactive element with matching text if one exists elsewhere
          // on the page.
          if (targetText && HEADING_OR_LABEL_TAG.test(winner.tagName || '')) {
            try {
              const interactiveCandidates = this.querySelectorAllDeep(document, INTERACTIVE_DISAMBIGUATION_SELECTOR);
              const betterMatch = interactiveCandidates.find((el) => {
                if (!isVisible(el)) return false;
                const elText = this.normalizeText(el.textContent);
                const elVal = this.normalizeText(el.value || el.getAttribute?.('value') || '');
                return elText === targetText || elVal === targetText;
              });
              if (betterMatch) winner = betterMatch;
            } catch {}
          }

          return winner;
        }
      } catch {
        // Continue to fallbacks
      }
    }

    // 2. data-testid / data-cy attributes
    if (selector.testId) {
      try {
        const el = this.querySelectorDeep(document, `[data-testid="${selector.testId}"], [data-cy="${selector.testId}"]`);
        if (isVisible(el)) return el;
      } catch {
        // ignore testId error
      }
    }

    // 3. aria-label / title / tooltip matching
    if (selector.ariaLabel || targetAria) {
      const ariaQuery = (selector.ariaLabel || targetAria).replace(/["'\\]/g, '');
      try {
        const el = this.querySelectorDeep(
          document,
          `[aria-label*="${ariaQuery}" i], [title*="${ariaQuery}" i], [data-tooltip*="${ariaQuery}" i]`
        );
        if (isVisible(el)) return el;
      } catch {
        // ignore aria query error
      }

      const ariaCandidates = this.querySelectorAllDeep(document, '[aria-label], [title], [data-tooltip]');
      for (const el of ariaCandidates) {
        const aria = (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('data-tooltip') || '').toLowerCase();
        if (aria.includes(targetAria || ariaQuery.toLowerCase())) {
          if (this.isVisible(el)) {
            return el;
          }
        }
      }
    }

    // 4. Visible Text Content Matching — Prioritize Interactive Elements
    if (selector.text || targetText) {
      const searchTxt = targetText || this.normalizeText(selector.text);

      const CONTROLS_SELECTOR = 'button, [role="button"], [role="combobox"], [role="listbox"], [role="option"], [role="radio"], [role="checkbox"], a, select, input[type="submit"], input[type="button"], summary, [role="menuitem"], [role="tab"], .goog-flat-menu-button, .goog-select, div[id*="share" i], div[class*="share" i]';
      const buttonCandidates = this.querySelectorAllDeep(document, CONTROLS_SELECTOR);
      for (const el of buttonCandidates) {
        if (isDialogContainer(el)) continue;
        const text = this.normalizeText(el.textContent);
        const aria = (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || el.getAttribute?.('data-tooltip') || '').trim().toLowerCase();
        const val = this.normalizeText(el.value || el.getAttribute?.('value') || '');

        const isMatch = isGenericCss
          ? (text === searchTxt || val === searchTxt || aria === searchTxt)
          : (
              text === searchTxt ||
              (allowPartialText && text.includes(searchTxt)) ||
              (targetAria && aria.includes(searchTxt)) ||
              (!targetAria && aria === searchTxt) ||
              val === searchTxt
            );

        if (isMatch) {
          if (this.isVisible(el)) {
            return el;
          }
        }
      }

      const allTextNodes = this.querySelectorAllDeep(document, 'span, div, p, label, b, strong, i, [role="menuitem"], [role="tab"]');
      for (const node of allTextNodes) {
        const text = this.normalizeText(node.textContent);
        if (text === searchTxt) {
          const parentBtn = node.closest ? node.closest('button, [role="button"], [role="menuitem"], [role="tab"], a') : null;
          const targetEl = parentBtn || node;
          if (this.isVisible(targetEl)) {
            return targetEl;
          }
        }
      }
    }

    // 5. XPath Query
    if (selector.xpath) {
      try {
        const xpathMatch = this.evaluateXPathDeep(selector.xpath, document);
        if (isVisible(xpathMatch)) return xpathMatch;
      } catch {
        // ignore xpath error
      }
    }

    // 6. Heuristic Alternative Selectors & Fallback CSS
    if (Array.isArray(selector.alternatives) && selector.alternatives.length > 0) {
      for (const alt of selector.alternatives) {
        if (!alt || typeof alt !== 'string' || alt === selector.css) continue;
        try {
          if (alt.includes(':has-text(')) {
            const match = alt.match(/^(.*?):has-text\("(.*?)"\)$/);
            if (match) {
              const [, subTag, subText] = match;
              const normSubText = this.normalizeText(subText);
              const subMatches = this.querySelectorAllDeep(document, subTag || 'button, a, input');
              for (const subEl of subMatches) {
                const txt = this.normalizeText(subEl.textContent);
                const val = this.normalizeText(subEl.value || '');
                if (txt.includes(normSubText) || val.includes(normSubText)) {
                  if (this.isVisible(subEl)) {
                    return subEl;
                  }
                }
              }
            }
          } else {
            const altMatches = this.querySelectorAllDeep(document, this.sanitizeCssSelector(alt));
            const visibleAlt = altMatches.find((el) => this.isVisible(el));
            if (visibleAlt) return visibleAlt;
          }
        } catch {
          // ignore alternative error
        }
      }
    }

    if (selector.fallbackCss && typeof selector.fallbackCss === 'string' && selector.fallbackCss !== selector.css) {
      try {
        const fallbackMatches = this.querySelectorAllDeep(document, this.sanitizeCssSelector(selector.fallbackCss));
        const visibleFallback = fallbackMatches.find((el) => this.isVisible(el));
        if (visibleFallback) return visibleFallback;
      } catch {
        // ignore fallback error
      }
    }

    return null;
  }

  /**
   * Wait for an element to appear in the DOM using MutationObserver.
   */
  static waitForElement(selector: StepTarget | null | undefined, timeoutMs = 5000): Promise<any | null> {
    return new Promise((resolve) => {
      const existing = this.findElement(selector);
      if (existing) {
        return resolve(existing);
      }

      let timer: any = null;
      let poller: any = null;
      const check = (): void => {
        const found = this.findElement(selector);
        if (found) {
          cleanup();
          resolve(found);
        }
      };
      const observer = typeof MutationObserver !== 'undefined'
        ? new MutationObserver(check)
        : null;

      const cleanup = (): void => {
        if (timer) clearTimeout(timer);
        if (poller) clearInterval(poller);
        observer?.disconnect();
      };

      if (typeof document !== 'undefined') {
        observer?.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      }
      poller = setInterval(check, 100);

      timer = setTimeout(() => {
        cleanup();
        resolve(this.findElement(selector));
      }, timeoutMs);
    });
  }

  /**
   * Get element bounding box with scroll offsets and container clipping.
   */
  static getBoundingBox(element: any): TargetBoundingBox | null {
    if (!element || typeof element.getBoundingClientRect !== 'function') {
      return null;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) {
      return null;
    }

    let visibleTop = rect.top;
    let visibleBottom = rect.bottom;
    let visibleLeft = rect.left;
    let visibleRight = rect.right;
    let isClipped = false;

    const ancestors = this.getScrollableAncestors(element);
    for (const ancestor of ancestors) {
      try {
        const aRect = ancestor.getBoundingClientRect();
        visibleTop = Math.max(visibleTop, aRect.top);
        visibleBottom = Math.min(visibleBottom, aRect.bottom);
        visibleLeft = Math.max(visibleLeft, aRect.left);
        visibleRight = Math.min(visibleRight, aRect.right);

        if (visibleBottom <= visibleTop || visibleRight <= visibleLeft) {
          isClipped = true;
          break;
        }
      } catch {
        // ignore ancestor rect error
      }
    }

    const visibleWidth = Math.max(0, visibleRight - visibleLeft);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);

    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
      isClipped: isClipped || visibleWidth <= 0 || visibleHeight <= 0,
      visibleTop,
      visibleLeft,
      visibleWidth,
      visibleHeight,
    };
  }
}
