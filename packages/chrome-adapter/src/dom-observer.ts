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
   * Find an element immediately using fallback strategies.
   */
  static findElement(selector: StepTarget | null | undefined): any | null {
    if (!selector || typeof document === 'undefined') return null;

    const isVisible = (element: any): boolean => Boolean(
      element && (
        element.offsetParent !== null ||
        (element.getClientRects && element.getClientRects().length > 0)
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
            if (innerMatch && (innerMatch.offsetParent !== null || innerMatch.getClientRects().length > 0)) {
              if (!targetText || this.normalizeText(innerMatch.textContent) === targetText || this.normalizeText(innerMatch.value) === targetText) {
                return innerMatch;
              }
            }
          }
          if (targetText) {
            const containerButtons = this.querySelectorAllDeep(containerEl, 'button, [role="button"], input[type="submit"], a, input');
            for (const btn of containerButtons) {
              if (this.normalizeText(btn.textContent) === targetText || this.normalizeText(btn.value) === targetText) {
                if (btn.offsetParent !== null || btn.getClientRects().length > 0) {
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

    // 1. Direct CSS Selector Strategy (Traverses Open Shadow Roots with Auto-Sanitization)
    if (selector.css) {
      const sanitized = this.sanitizeCssSelector(selector.css);
      try {
        const matches = this.querySelectorAllDeep(document, sanitized);
        if (matches.length > 0) {
          if (!targetText && !targetAria) {
            const firstVisible = matches.find((el) => !isDialogContainer(el) && (el.offsetParent !== null || (el.getClientRects && el.getClientRects().length > 0)));
            if (firstVisible) return firstVisible;
          }

          // Prioritize non-dialog matches matching text or aria
          for (const el of matches) {
            if (isDialogContainer(el) && targetText) continue;
            const elText = this.normalizeText(el.textContent);
            const elAria = (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || el.getAttribute?.('data-tooltip') || '').trim().toLowerCase();
            const elVal = this.normalizeText(el.value || el.getAttribute?.('value') || '');

            const exactText = targetText && (elText === targetText || elVal === targetText);
            const exactAria = targetAria && (elAria === targetAria || elAria.includes(targetAria));
            const partialText = allowPartialText && targetText && (elText.includes(targetText) || elVal.includes(targetText));
            const partialAria = targetAria && elAria.includes(targetAria);

            if ((exactText || exactAria || partialText || partialAria) && isVisible(el)) {
              return el;
            }
          }

          if (!isGenericCss && !targetText && !targetAria) {
            const visibleMatch = matches.find((el) => el.offsetParent !== null || (el.getClientRects && el.getClientRects().length > 0));
            if (visibleMatch) return visibleMatch;
          }
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
          if (el.offsetParent !== null || (el.getClientRects && el.getClientRects().length > 0)) {
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
          if (el.offsetParent !== null || (el.getClientRects && el.getClientRects().length > 0)) {
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
          if (targetEl.offsetParent !== null || (targetEl.getClientRects && targetEl.getClientRects().length > 0)) {
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
                  if (subEl.offsetParent !== null || (subEl.getClientRects && subEl.getClientRects().length > 0)) {
                    return subEl;
                  }
                }
              }
            }
          } else {
            const altMatches = this.querySelectorAllDeep(document, this.sanitizeCssSelector(alt));
            const visibleAlt = altMatches.find((el) => el.offsetParent !== null || (el.getClientRects && el.getClientRects().length > 0));
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
        const visibleFallback = fallbackMatches.find((el) => el.offsetParent !== null || (el.getClientRects && el.getClientRects().length > 0));
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
