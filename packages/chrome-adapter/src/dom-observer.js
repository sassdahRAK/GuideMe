/**
 * Resilient DOM Query and MutationObserver Utilities.
 */
export class DomObserver {
  static normalizeText(value) {
    return String(value || '')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /**
   * Create a resilient selector from a user-picked live DOM element.
   * The primary selector is stable where possible; secondary metadata keeps
   * repeated controls (for example several "Save" buttons) unambiguous.
   * @param {HTMLElement} element
   * @returns {Object}
   */
  static createTargetSelector(element) {
    if (!element || typeof element !== 'object') return { css: 'body' };

    const tag = (element.tagName || 'div').toLowerCase();
    const getAttribute = element.getAttribute?.bind(element);
    const testId = getAttribute?.('data-testid') || getAttribute?.('data-cy') || '';
    const name = getAttribute?.('name') || element.name || '';
    const ariaLabel = getAttribute?.('aria-label') || getAttribute?.('title') || '';
    const text = (element.textContent || element.value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const escape = (value) => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const escapeId = (value) => typeof CSS !== 'undefined' && CSS.escape
      ? CSS.escape(value)
      : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');

    const target = {};
    if (element.id) target.css = `#${escapeId(element.id)}`;
    else if (testId) target.css = getAttribute?.('data-testid')
      ? `[data-testid="${escape(testId)}"]`
      : `[data-cy="${escape(testId)}"]`;
    else if (name) target.css = `${tag}[name="${escape(name)}"]`;
    else if (ariaLabel) target.css = `${tag}[aria-label="${escape(ariaLabel)}"]`;
    else target.css = tag;

    if (testId) target.testId = testId;
    if (ariaLabel) target.ariaLabel = ariaLabel;
    if (text) target.text = text;
    return target;
  }

  /**
   * Find an element immediately using fallback strategies.
   * @param {Object} selector - { css, xpath, text, testId, ariaLabel }
   * @returns {HTMLElement|null}
   */
  static findElement(selector) {
    if (!selector || typeof document === 'undefined') return null;

    const targetText = selector.text ? this.normalizeText(selector.text) : '';
    const targetAria = selector.ariaLabel ? selector.ariaLabel.trim().toLowerCase() : '';
    const isGenericCss = /^(button|div|a|input|span|select|p)$/i.test((selector.css || '').trim());
    const allowPartialText = Boolean(selector.css && !isGenericCss);

    // 1. Direct CSS Selector (with text/aria verification if available)
    if (selector.css) {
      try {
        const matches = document.querySelectorAll(selector.css);
        if (matches.length > 0) {
          // If no text or aria constraint, return the first match immediately
          if (!targetText && !targetAria) {
            return matches[0];
          }

          // A broad CSS selector such as `button` must still anchor to the
          // requested control. Prefer exact accessible-name/text matches over
          // a container whose descendant text happens to include the label.
          for (const el of matches) {
            const elText = this.normalizeText(el.textContent);
            const elAria = (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || '').trim().toLowerCase();
            const elVal = this.normalizeText(el.value || el.getAttribute?.('value') || '');
            const exactText = targetText && (elText === targetText || elVal === targetText);
            const exactAria = targetAria && (elAria === targetAria || elAria.includes(targetAria));

            if (exactText || exactAria) {
              return el;
            }

            // A button may contain an icon and nested label text. Match the
            // requested property inside it, but return the clickable button.
            if (targetText && allowPartialText && elText.includes(targetText)) {
              return el;
            }

          }

          // Do not fall back to the first CSS match when the capture contains
          // identifying metadata. A captured `{ css: 'button', text: 'Save' }`
          // must wait for Save to render (for example inside a lazy dialog),
          // rather than incorrectly highlighting the page's first button.
          if (!targetText && !targetAria) {
            // A selector without secondary identity metadata can only use its
            // CSS match as the fallback.
            return matches[0];
          }
        }
      } catch (e) {
        // Invalid selector, ignore and continue to fallbacks
      }
    }

    // 2. data-testid / data-cy attributes
    if (selector.testId) {
      const el = document.querySelector(`[data-testid="${selector.testId}"], [data-cy="${selector.testId}"]`);
      if (el) return el;
    }

    // 3. aria-label / title matching
    if (selector.ariaLabel) {
      const el = document.querySelector(`[aria-label="${selector.ariaLabel}"], [title="${selector.ariaLabel}"]`);
      if (el) return el;
    }

    // 4. Visible Text Content Matching — Prioritize Button Elements & Ascend from Nested Spans
    if (selector.text) {
      // 4a. Check interactive elements first (button, a, role=button, summary)
      const buttonCandidates = document.querySelectorAll(
        'button, [role="button"], a, input[type="submit"], input[type="button"], summary, [role="menuitem"], [role="tab"]'
      );
      for (const el of buttonCandidates) {
        const text = this.normalizeText(el.textContent);
        const aria = (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || '').trim().toLowerCase();
        const val = this.normalizeText(el.value || el.getAttribute?.('value') || '');

        if (text === targetText || (allowPartialText && text.includes(targetText)) || aria === targetText || aria.includes(targetText) || val === targetText) {
          if (el.offsetParent !== null || el.getClientRects().length > 0) {
            return el;
          }
        }
      }

      // 4b. Check other text elements and ascend to parent button if nested
      const allTextNodes = document.querySelectorAll('span, div, p, label, b, strong, i');
      for (const node of allTextNodes) {
        const text = this.normalizeText(node.textContent);
        if (text === targetText || (allowPartialText && text.includes(targetText))) {
          // If inside a button or clickable container, return the button itself!
          const parentBtn = node.closest ? node.closest('button, [role="button"], a') : null;
          const targetEl = parentBtn || node;
          if (targetEl.offsetParent !== null || targetEl.getClientRects().length > 0) {
            return targetEl;
          }
        }
      }
    }

    // 5. XPath Query
    if (selector.xpath) {
      try {
        const result = document.evaluate(
          selector.xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        if (result.singleNodeValue instanceof HTMLElement) {
          return result.singleNodeValue;
        }
      } catch (e) {
        // invalid xpath
      }
    }

    return null;
  }

  /**
   * Wait for an element to appear in the DOM using MutationObserver.
   * @param {Object} selector
   * @param {number} [timeoutMs=5000]
   * @returns {Promise<HTMLElement|null>}
   */
  static waitForElement(selector, timeoutMs = 5000) {
    return new Promise((resolve) => {
      // Immediate check
      const existing = this.findElement(selector);
      if (existing) {
        return resolve(existing);
      }

      if (typeof MutationObserver === 'undefined') {
        return resolve(null);
      }

      let timer = null;
      const observer = new MutationObserver(() => {
        const found = this.findElement(selector);
        if (found) {
          cleanup();
          resolve(found);
        }
      });

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        observer.disconnect();
      };

      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      timer = setTimeout(() => {
        cleanup();
        resolve(this.findElement(selector));
      }, timeoutMs);
    });
  }

  /**
   * Get element bounding box with scroll offsets.
   * @param {HTMLElement} element
   * @returns {Object}
   */
  static getBoundingBox(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function') {
      return null;
    }

    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
    };
  }
}
