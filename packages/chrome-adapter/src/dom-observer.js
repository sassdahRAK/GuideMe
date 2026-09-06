/**
 * Resilient DOM Query and MutationObserver Utilities.
 */
export class DomObserver {
  /**
   * Find an element immediately using fallback strategies.
   * @param {Object} selector - { css, xpath, text, testId, ariaLabel }
   * @returns {HTMLElement|null}
   */
  /**
   * Check if an element is currently visible and rendered in viewport layout.
   * @param {HTMLElement} el
   * @returns {boolean}
   */
  static isVisible(el) {
    if (!el) return false;
    if (typeof el.getClientRects === 'function' && el.getClientRects().length === 0) {
      return false;
    }
    if (el.offsetParent === null && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
      const style = typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'
        ? window.getComputedStyle(el)
        : null;
      if (style && style.position !== 'fixed') {
        return false;
      }
    }
    return true;
  }

  /**
   * Find an element immediately using fallback strategies.
   * @param {Object} selector - { css, xpath, text, testId, ariaLabel }
   * @returns {HTMLElement|null}
   */
  static findElement(selector) {
    if (!selector || typeof document === 'undefined') return null;

    let firstCssFallback = null;

    // 1. Direct CSS Selector (prefer visible element if multiple exist)
    if (selector.css) {
      try {
        const matches = Array.from(document.querySelectorAll(selector.css) || []);
        if (matches.length > 0) {
          const visible = matches.find((el) => this.isVisible(el));
          if (visible) return visible;
          firstCssFallback = matches[0];
        }
      } catch (e) {
        // Invalid selector, ignore and continue to fallbacks
      }
    }

    // 2. data-testid / data-cy attributes
    if (selector.testId) {
      const matches = Array.from(
        document.querySelectorAll(`[data-testid="${selector.testId}"], [data-cy="${selector.testId}"]`) || []
      );
      if (matches.length > 0) {
        const visible = matches.find((el) => this.isVisible(el));
        if (visible) return visible;
      }
    }

    // 3. aria-label matching
    if (selector.ariaLabel) {
      const matches = Array.from(
        document.querySelectorAll(`[aria-label="${selector.ariaLabel}"], [aria-label*="${selector.ariaLabel}"]`) || []
      );
      if (matches.length > 0) {
        const visible = matches.find((el) => this.isVisible(el));
        if (visible) return visible;
      }
    }

    // 4. Visible Text Content Matching
    if (selector.text) {
      const candidates = document.querySelectorAll(
        'button, a, [role="tab"], [role="button"], [role="menuitem"], [role="link"], span, div, p, label, input, svg, canvas, iframe, summary, [role="switch"]'
      );
      const targetText = selector.text.trim().toLowerCase();

      // Pass 1: Strict equality
      for (const el of candidates) {
        if (el.textContent && el.textContent.trim().toLowerCase() === targetText) {
          if (this.isVisible(el)) {
            return el;
          }
        }
      }

      // Pass 2: Word boundary or prefix matching (e.g. "Repositories 31" matching "Repositories")
      for (const el of candidates) {
        if (el.textContent) {
          const text = el.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
          const escaped = targetText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (text.startsWith(targetText) || new RegExp(`\\b${escaped}\\b`, 'i').test(text)) {
            if (this.isVisible(el)) {
              return el;
            }
          }
        }
      }

      // Pass 3: Substring match on interactive elements (e.g. "thangsaoly/mytube" matching "mytube")
      for (const el of candidates) {
        if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.getAttribute?.('role') === 'link' || el.getAttribute?.('role') === 'button') {
          if (el.textContent && el.textContent.toLowerCase().includes(targetText)) {
            if (this.isVisible(el)) {
              return el;
            }
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

    // 6. Inspect accessible same-origin iframes
    try {
      const iframes = document.querySelectorAll('iframe, frame');
      for (const iframe of iframes) {
        try {
          const subDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (subDoc && selector.css) {
            const subEl = subDoc.querySelector(selector.css);
            if (subEl) return subEl;
          }
        } catch { }
      }
    } catch { }

    // 7. Inspect open Shadow DOM roots
    try {
      const allElements = document.querySelectorAll('*');
      for (const host of allElements) {
        if (host.shadowRoot) {
          try {
            if (selector.css) {
              const shadowEl = host.shadowRoot.querySelector(selector.css);
              if (shadowEl) return shadowEl;
            }
            if (selector.text) {
              const queryText = selector.text.toLowerCase();
              const candidates = host.shadowRoot.querySelectorAll('button, a, [role="tab"], [role="button"], span, p, label');
              for (const cand of candidates) {
                if ((cand.textContent || '').trim().toLowerCase().includes(queryText)) {
                  return cand;
                }
              }
            }
          } catch { }
        }
      }
    } catch { }

    return firstCssFallback || null;
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
   * Get element bounding box with zero-dimension and visibility validation.
   * Returns null if element has no layout footprint or is collapsed at (0, 0).
   * @param {HTMLElement} element
   * @returns {Object|null}
   */
  static getBoundingBox(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function') {
      return null;
    }

    let target = element;
    // If target has zero client rects (e.g. inner SVG path or child span), climb up to layout container
    if (typeof target.getClientRects === 'function' && target.getClientRects().length === 0 && target.parentElement) {
      target = target.closest('svg, button, a, [role="button"], div, form') || target.parentElement;
    }

    const rect = target.getBoundingClientRect();

    // Reject true zero-dimension bounding boxes at (0, 0) (unrendered or collapsed)
    if (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0) {
      return null;
    }

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
