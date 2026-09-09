/**
 * Generates a safe CSS ID selector.
 * If the ID contains characters that make direct #id invalid in CSS (e.g. colons like ':6j',
 * dots, spaces, slashes, brackets, or starting with digits), it formats as an attribute
 * selector [id="..."], which is universally valid across all CSS engines.
 * @param {string} id
 * @returns {string}
 */
export function safeIdSelector(id) {
  if (!id || typeof id !== 'string') return '';
  if (/^[^a-zA-Z_]|[^a-zA-Z0-9_-]/.test(id)) {
    return `[id="${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
  }
  return `#${id}`;
}

/**
 * Sanitizes potentially invalid CSS selector strings (such as '#:6j' or '#:a7').
 * Converts invalid ID syntax into robust attribute selectors.
 * @param {string} selector
 * @returns {string}
 */
export function sanitizeCssSelector(selector) {
  if (!selector || typeof selector !== 'string') return selector;
  return selector
    .replace(/#([^\s>+~.[\]:]*(?::[^\s>+~.[\]:]*)+)/g, (match, id) => `[id="${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`)
    .replace(/#([0-9][^\s>+~.[\]]*)/g, (match, id) => `[id="${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`);
}

/**
 * Resilient DOM Query and MutationObserver Utilities.
 */
export class DomObserver {
  static safeIdSelector(id) {
    return safeIdSelector(id);
  }

  static sanitizeCssSelector(selector) {
    return sanitizeCssSelector(selector);
  }

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

    const target = {};
    if (element.id) target.css = safeIdSelector(element.id);
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
   * Dispatches synthetic pointerenter, pointerover, mouseover, and mouseenter events
   * to trigger flyouts and dropdown menus.
   * @param {HTMLElement} element
   */
  static dispatchHoverEvents(element) {
    if (!element || typeof element.dispatchEvent !== 'function') return;
    try {
      const doc = element.ownerDocument || (typeof document !== 'undefined' ? document : null);
      const win = doc?.defaultView || (typeof window !== 'undefined' ? window : null);
      const opts = { bubbles: true, cancelable: true, view: win };

      if (typeof PointerEvent !== 'undefined') {
        element.dispatchEvent(new PointerEvent('pointerover', opts));
        element.dispatchEvent(new PointerEvent('pointerenter', { ...opts, bubbles: false }));
      }
      if (typeof MouseEvent !== 'undefined') {
        element.dispatchEvent(new MouseEvent('mouseover', opts));
        element.dispatchEvent(new MouseEvent('mouseenter', { ...opts, bubbles: false }));
      } else if (typeof CustomEvent !== 'undefined') {
        element.dispatchEvent(new CustomEvent('mouseover', opts));
        element.dispatchEvent(new CustomEvent('mouseenter', { ...opts, bubbles: false }));
      } else {
        element.dispatchEvent({ type: 'mouseover', bubbles: true });
        element.dispatchEvent({ type: 'mouseenter', bubbles: false });
      }

      if (typeof FocusEvent !== 'undefined') {
        element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      }
    } catch {}
  }

  /**
   * Recursively query all matching elements across the DOM and open shadow roots.
   * Enables seamless element resolution on complex web apps (Google Docs, Canvas LMS, Microsoft 365).
   * @param {Document|Element|ShadowRoot} root
   * @param {string} selector
   * @returns {Element[]}
   */
  static querySelectorAllDeep(root, selector) {
    const results = [];
    if (!root || !selector) return results;

    const seen = new Set();
    const cleanSelector = sanitizeCssSelector(selector);

    const traverse = (node) => {
      if (!node) return;

      if (typeof node.querySelectorAll === 'function') {
        let nodeMatches = [];
        try {
          nodeMatches = node.querySelectorAll(selector);
        } catch {
          if (cleanSelector && cleanSelector !== selector) {
            try {
              nodeMatches = node.querySelectorAll(cleanSelector);
            } catch {}
          }
        }
        for (let i = 0; i < nodeMatches.length; i++) {
          const m = nodeMatches[i];
          if (!seen.has(m)) {
            seen.add(m);
            results.push(m);
          }
        }
      }

      // Check all children for open shadow roots and accessible iframes
      if (typeof node.querySelectorAll === 'function') {
        try {
          const allChildren = node.querySelectorAll('*');
          for (let i = 0; i < allChildren.length; i++) {
            const child = allChildren[i];
            if (child && child.shadowRoot) {
              traverse(child.shadowRoot);
            }
            if (child && (child.tagName === 'IFRAME' || child.tagName === 'FRAME')) {
              try {
                const subDoc = child.contentDocument || child.contentWindow?.document;
                if (subDoc && subDoc.body && !seen.has(subDoc)) {
                  seen.add(subDoc);
                  traverse(subDoc);
                }
              } catch {}
            }
          }
        } catch {}
      }
    };

    traverse(root);

    // If no results and cleanSelector differs, attempt fallback query
    if (results.length === 0 && cleanSelector && cleanSelector !== selector) {
      if (typeof root.querySelectorAll === 'function') {
        try {
          const fallbackMatches = root.querySelectorAll(cleanSelector);
          for (let i = 0; i < fallbackMatches.length; i++) {
            const m = fallbackMatches[i];
            if (!seen.has(m)) {
              seen.add(m);
              results.push(m);
            }
          }
        } catch {}
      }
    }

    return results;
  }

  /**
   * Recursively query the first matching element across the DOM and open shadow roots.
   * @param {Document|Element|ShadowRoot} root
   * @param {string} selector
   * @returns {Element|null}
   */
  static querySelectorDeep(root, selector) {
    if (!root || !selector) return null;

    const cleanSelector = sanitizeCssSelector(selector);

    if (typeof root.querySelector === 'function') {
      try {
        const direct = root.querySelector(selector);
        if (direct) return direct;
      } catch {
        if (cleanSelector && cleanSelector !== selector) {
          try {
            const direct = root.querySelector(cleanSelector);
            if (direct) return direct;
          } catch {}
        }
      }
    }

    const matches = this.querySelectorAllDeep(root, selector);
    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Evaluate XPath query with open shadow root traversal.
   * @param {string} xpath
   * @param {Document} doc
   * @returns {Element|null}
   */
  static evaluateXPathDeep(xpath, doc) {
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
      } catch {}
    }

    // 2. Open shadow root traversal fallback
    try {
      const allNodes = doc.querySelectorAll ? doc.querySelectorAll('*') : [];
      for (let i = 0; i < allNodes.length; i++) {
        const sr = allNodes[i].shadowRoot;
        if (!sr) continue;

        const idMatch = xpath.match(/@id\s*=\s*['"]([^'"]+)['"]/);
        if (idMatch) {
          const el = this.querySelectorDeep(sr, safeIdSelector(idMatch[1]));
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
    } catch {}

    return null;
  }

  /**
   * Finds all scrollable or overflow-clipping ancestor elements.
   * Supports nested scrollable divs (overflow: auto, scroll, hidden).
   * @param {HTMLElement} element
   * @returns {HTMLElement[]}
   */
  static getScrollableAncestors(element) {
    const ancestors = [];
    if (!element || typeof element !== 'object') return ancestors;

    const doc = element.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const body = doc?.body;
    const docEl = doc?.documentElement;
    const visited = new Set();

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
      } catch {}
      curr = curr.parentElement || (curr.getRootNode?.()?.host || null);
    }

    return ancestors;
  }

  /**
   * Smoothly scrolls an element into view, adjusting both window scroll and any
   * nested scrollable ancestor containers (overflow: auto/scroll).
   * @param {HTMLElement} element
   */
  static scrollIntoView(element) {
    if (!element) return;

    if (typeof element.scrollIntoView === 'function') {
      try {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      } catch {
        try { element.scrollIntoView(true); } catch {}
      }
    }

    // Explicitly adjust nested scrollable ancestor containers
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
      } catch {}
    }
  }

  /**
   * Identifies the currently active/topmost modal or dialog in the DOM.
   * Recognizes standard <dialog>, ARIA modals, Material UI, Bootstrap, and Google Docs dialogs.
   * @param {Document|Element} [doc]
   * @returns {HTMLElement|null}
   */
  static getActiveModal(doc = (typeof document !== 'undefined' ? document : null)) {
    if (!doc || typeof doc.querySelectorAll !== 'function') return null;
    const MODAL_SELECTORS = 'dialog[open], [role="dialog"], [aria-modal="true"], .modal.show, .apps-share-dialog, .modal-dialog, .MuiDialog-root';
    try {
      const modals = this.querySelectorAllDeep(doc, MODAL_SELECTORS);
      for (let i = modals.length - 1; i >= 0; i--) {
        const m = modals[i];
        if (!m || (m.getAttribute && m.getAttribute('aria-hidden') === 'true')) continue;
        if (typeof m.offsetParent !== 'undefined' && m.offsetParent === null && typeof m.getClientRects === 'function' && m.getClientRects().length === 0) {
          continue;
        }
        return m;
      }
    } catch {}
    return null;
  }

  /**
   * Find an element immediately using fallback strategies.
   * @param {Object} selector - { css, xpath, text, testId, ariaLabel, hoverTrigger, container }
   * @returns {HTMLElement|null}
   */
  static findElement(selector) {
    if (!selector || typeof document === 'undefined') return null;

    const targetText = selector.text ? this.normalizeText(selector.text) : '';
    const targetAria = selector.ariaLabel ? selector.ariaLabel.trim().toLowerCase() : '';
    const isGenericCss = /^(button|div|a|input|span|select|p)$/i.test((selector.css || '').trim());
    const allowPartialText = Boolean(selector.css && !isGenericCss);

    // Active Modal Primacy: Detect if an interactive dialog/modal overlay is currently open
    const activeModal = selector.container
      ? (this.querySelectorDeep(document, selector.container) || this.getActiveModal(document))
      : this.getActiveModal(document);

    // Handle hover-triggered target resolution if specified
    if (selector.hoverTrigger) {
      const triggerEl = this.findElement(selector.hoverTrigger);
      if (triggerEl) {
        this.dispatchHoverEvents(triggerEl);
      }
    }

    // Handle container scoping to prioritize active dialog or specific containers
    if (selector.container || activeModal) {
      try {
        const containerEl = selector.container ? this.querySelectorDeep(document, selector.container) : activeModal;
        if (containerEl) {
          if (selector.css) {
            const cleanSubCss = selector.container ? selector.css.replace(selector.container, '').trim() : selector.css;
            const innerMatch = this.querySelectorDeep(containerEl, cleanSubCss || selector.css);
            if (innerMatch && (innerMatch.offsetParent !== null || innerMatch.getClientRects().length > 0)) {
              if (!targetText || this.normalizeText(innerMatch.textContent) === targetText || this.normalizeText(innerMatch.value) === targetText || allowPartialText) {
                return innerMatch;
              }
            }
          }
          if (targetText || targetAria) {
            const containerButtons = this.querySelectorAllDeep(containerEl, 'button, [role="button"], input, a, [contenteditable="true"]');
            for (const btn of containerButtons) {
              const bText = this.normalizeText(btn.textContent);
              const bAria = (btn.getAttribute?.('aria-label') || btn.getAttribute?.('title') || '').trim().toLowerCase();
              const bVal = this.normalizeText(btn.value || '');
              if ((targetText && (bText === targetText || bVal === targetText || bText.includes(targetText))) ||
                  (targetAria && (bAria === targetAria || bAria.includes(targetAria)))) {
                if (btn.offsetParent !== null || btn.getClientRects().length > 0) {
                  return btn;
                }
              }
            }
          }
        }
      } catch {}
    }

    // 1. Direct CSS Selector Strategy (Traverses Open Shadow Roots & Modal Primacy)
    if (selector.css) {
      try {
        let matches = [];
        try {
          matches = this.querySelectorAllDeep(document, selector.css);
        } catch {
          const sanitized = sanitizeCssSelector(selector.css);
          if (sanitized && sanitized !== selector.css) {
            matches = this.querySelectorAllDeep(document, sanitized);
          }
        }
        if (matches.length > 0) {
          // Modal Primacy: If an active modal is open and has matching elements, filter out background elements
          const hasModalMatches = Boolean(activeModal && typeof activeModal.contains === 'function' && matches.some((el) => activeModal.contains(el)));
          const eligibleMatches = hasModalMatches
            ? matches.filter((el) => activeModal.contains(el))
            : matches;

          // If no text or aria constraint, return the first visible match immediately
          if (!targetText && !targetAria) {
            const firstVisible = Array.from(eligibleMatches).find((el) => el.offsetParent !== null || el.getClientRects().length > 0);
            return firstVisible || eligibleMatches[0];
          }

          // Prioritize exact or substring accessible-name/text matches
          for (const el of eligibleMatches) {
            const elText = this.normalizeText(el.textContent);
            const elAria = (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || el.getAttribute?.('data-tooltip') || '').trim().toLowerCase();
            const elVal = this.normalizeText(el.value || el.getAttribute?.('value') || '');

            const exactText = targetText && (elText === targetText || elVal === targetText);
            const exactAria = targetAria && (elAria === targetAria || elAria.includes(targetAria));
            const partialText = allowPartialText && targetText && (elText.includes(targetText) || elVal.includes(targetText));
            const partialAria = targetAria && elAria.includes(targetAria);

            if (exactText || exactAria || partialText || partialAria) {
              return el;
            }
          }

          // If CSS was specific (not a bare generic tag), fallback to first visible match
          if (!isGenericCss) {
            const visibleMatch = Array.from(eligibleMatches).find((el) => el.offsetParent !== null || el.getClientRects().length > 0);
            if (visibleMatch) return visibleMatch;
          }
        }
      } catch (e) {
        // Invalid selector, ignore and continue to fallbacks
      }
    }

    // 2. data-testid / data-cy attributes (Deep Shadow Root Search)
    if (selector.testId) {
      try {
        const el = this.querySelectorDeep(document, `[data-testid="${selector.testId}"], [data-cy="${selector.testId}"]`);
        if (el) return el;
      } catch { }
    }

    // 3. aria-label / title / tooltip matching (Exact + Substring Case-Insensitive)
    if (selector.ariaLabel || targetAria) {
      const ariaQuery = (selector.ariaLabel || targetAria).replace(/["'\\]/g, '');
      try {
        const el = this.querySelectorDeep(
          document,
          `[aria-label*="${ariaQuery}" i], [title*="${ariaQuery}" i], [data-tooltip*="${ariaQuery}" i]`
        );
        if (el) return el;
      } catch { }

      // Manual scan if selector contains complex characters
      const ariaCandidates = this.querySelectorAllDeep(document, '[aria-label], [title], [data-tooltip]');
      for (const el of ariaCandidates) {
        const aria = (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('data-tooltip') || '').toLowerCase();
        if (aria.includes(targetAria || ariaQuery.toLowerCase())) {
          if (el.offsetParent !== null || el.getClientRects().length > 0) {
            return el;
          }
        }
      }
    }

    // 4. Visible Text Content Matching — Prioritize Interactive Elements
    if (selector.text || targetText) {
      const searchTxt = targetText || this.normalizeText(selector.text);

      // 4a. Check interactive elements first (button, a, role=button, summary, inputs)
      const buttonCandidates = this.querySelectorAllDeep(
        document,
        'button, [role="button"], a, input[type="submit"], input[type="button"], summary, [role="menuitem"], [role="tab"], div[id*="share" i], div[class*="share" i]'
      );
      for (const el of buttonCandidates) {
        const text = this.normalizeText(el.textContent);
        const aria = (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || el.getAttribute?.('data-tooltip') || '').trim().toLowerCase();
        const val = this.normalizeText(el.value || el.getAttribute?.('value') || '');

        const isMatch = isGenericCss
          ? (text === searchTxt || val === searchTxt || aria === searchTxt)
          : (text === searchTxt || (allowPartialText && text.includes(searchTxt)) || aria.includes(searchTxt) || val === searchTxt);

        if (isMatch) {
          if (el.offsetParent !== null || el.getClientRects().length > 0) {
            return el;
          }
        }
      }

      // 4b. Check other text elements and ascend to parent button if nested
      if (!isGenericCss || allowPartialText) {
        const allTextNodes = this.querySelectorAllDeep(document, 'span, div, p, label, b, strong, i');
        for (const node of allTextNodes) {
          const text = this.normalizeText(node.textContent);
          if (text === searchTxt || (allowPartialText && text.includes(searchTxt))) {
            const parentBtn = node.closest ? node.closest('button, [role="button"], a') : null;
            const targetEl = parentBtn || node;
            if (targetEl.offsetParent !== null || targetEl.getClientRects().length > 0) {
              return targetEl;
            }
          }
        }
      }
    }

    // 5. XPath Query (Traverses Open Shadow Roots)
    if (selector.xpath) {
      try {
        const xpathMatch = this.evaluateXPathDeep(selector.xpath, document);
        if (xpathMatch) return xpathMatch;
      } catch (e) {
        // invalid xpath
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
                  if (subEl.offsetParent !== null || subEl.getClientRects().length > 0) {
                    return subEl;
                  }
                }
              }
            }
          } else {
            const altMatches = this.querySelectorAllDeep(document, alt);
            const visibleAlt = Array.from(altMatches).find((el) => el.offsetParent !== null || el.getClientRects().length > 0);
            if (visibleAlt) return visibleAlt;
          }
        } catch {}
      }
    }

    if (selector.fallbackCss && selector.fallbackCss !== selector.css) {
      try {
        const fallbackMatches = this.querySelectorAllDeep(document, selector.fallbackCss);
        const visibleFallback = Array.from(fallbackMatches).find((el) => el.offsetParent !== null || el.getClientRects().length > 0);
        if (visibleFallback) return visibleFallback;
      } catch {}
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
   * Get element bounding box with scroll offsets and container clipping.
   * Adjusts accurately for nested scrollable divs (overflow: auto/scroll/hidden)
   * rather than assuming simple window.scrollY.
   * @param {HTMLElement} element
   * @returns {Object|null}
   */
  static getBoundingBox(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function') {
      return null;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) {
      return null;
    }

    // Calculate visible bounds across all nested scrollable/overflow ancestors
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
      } catch {}
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
