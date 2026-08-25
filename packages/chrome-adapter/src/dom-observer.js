/**
 * Resilient DOM Query and MutationObserver Utilities.
 */
export class DomObserver {
  /**
   * Find an element immediately using fallback strategies.
   * @param {Object} selector - { css, xpath, text, testId, ariaLabel }
   * @returns {HTMLElement|null}
   */
  static findElement(selector) {
    if (!selector || typeof document === 'undefined') return null;

    // 1. Direct CSS Selector
    if (selector.css) {
      try {
        const el = document.querySelector(selector.css);
        if (el) return el;
      } catch (e) {
        // Invalid selector, ignore and continue to fallbacks
      }
    }

    // 2. data-testid / data-cy attributes
    if (selector.testId) {
      const el = document.querySelector(`[data-testid="${selector.testId}"], [data-cy="${selector.testId}"]`);
      if (el) return el;
    }

    // 3. aria-label matching
    if (selector.ariaLabel) {
      const el = document.querySelector(`[aria-label="${selector.ariaLabel}"], [aria-label*="${selector.ariaLabel}"]`);
      if (el) return el;
    }

    // 4. Visible Text Content Matching
    if (selector.text) {
      const candidates = document.querySelectorAll('button, a, span, div, p, label, [role="button"], [role="menuitem"]');
      const targetText = selector.text.trim().toLowerCase();
      for (const el of candidates) {
        if (el.textContent && el.textContent.trim().toLowerCase() === targetText) {
          // Ensure element is visible
          if (el.offsetParent !== null || el.getClientRects().length > 0) {
            return el;
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
