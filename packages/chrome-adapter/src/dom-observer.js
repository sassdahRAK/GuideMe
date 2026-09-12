/**
 * Generates a safe CSS ID selector. If the ID contains characters that make
 * direct #id invalid (colons, dots, spaces, brackets, leading digits), it falls
 * back to an attribute selector [id="..."] which is universally valid.
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
 * Sanitizes potentially invalid CSS selector strings (e.g. '#:6j', '#:a7').
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
  static safeIdSelector(id) { return safeIdSelector(id); }
  static sanitizeCssSelector(selector) { return sanitizeCssSelector(selector); }
  static normalizeText(value) {
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
   *
   * Priority (most → least stable):
   *   1. #id              — globally unique when present
   *   2. [data-testid]    — stable in test-instrumented apps
   *   3. tag[name]        — reliable for form inputs
   *   4. tag[aria-label]  — semantic; stable across i18n changes only if the site doesn't change them
   *   5. tag.class1.class2 — meaningful semantic classes (utility/hash classes filtered out)
   *   6. bare tag         — last resort; text/ariaLabel metadata always added to disambiguate
   *
   * The selector object ALWAYS includes `text` when the element has visible
   * text content, so findElement can fall through to text-matching even when
   * the CSS selector alone is ambiguous.
   * @param {HTMLElement} element
   * @returns {Object}
   */
  static createTargetSelector(element) {
    if (!element || typeof element !== 'object') return { css: 'body' };

    const tag = (element.tagName || 'div').toLowerCase();
    const getAttribute = element.getAttribute?.bind(element);
    const testId = getAttribute?.('data-testid') || getAttribute?.('data-cy') || '';
    const formEl = /** @type {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement} */ (element);
    const name = getAttribute?.('name') || formEl.name || '';
    const ariaLabel = getAttribute?.('aria-label') || getAttribute?.('title') || '';
    const text = (element.textContent || formEl.value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const escape = (value) => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    // Build a class-based selector using only meaningful classes.
    // Filter out utility/hash/auto-generated classes that are unstable across
    // page loads (Tailwind auto-hashes, CSS modules, Angular scoping, etc.).
    const buildClassSelector = () => {
      const classList = element.classList;
      if (!classList || classList.length === 0) return '';
      // Keep classes that look semantic: at least 3 chars, no hash-like suffix,
      // not pure Tailwind shorthand (single-letter prefix + number).
      const meaningful = Array.from(classList).filter((cls) =>
        cls.length >= 3 &&
        !/^[a-z]-\d/.test(cls) &&            // e.g. "w-4", "h-8" Tailwind
        !/^[_]{2}/.test(cls) &&               // dunder prefixes (__class)
        !/[a-f0-9]{6,}$/i.test(cls) &&        // hash suffix (CSS modules)
        !/^\d/.test(cls)                       // starts with digit
      ).slice(0, 3); // cap at 3 to avoid overly specific selectors
      if (meaningful.length === 0) return '';
      return `${tag}.${meaningful.map(escape).join('.')}`;
    };

    const target = {};
    if (element.id) {
      target.css = safeIdSelector(element.id);
    } else if (testId) {
      target.css = getAttribute?.('data-testid')
        ? `[data-testid="${escape(testId)}"]`
        : `[data-cy="${escape(testId)}"]`;
    } else if (name) {
      target.css = `${tag}[name="${escape(name)}"]`;
    } else if (ariaLabel) {
      target.css = `${tag}[aria-label="${escape(ariaLabel)}"]`;
    } else {
      // Try class-based before falling back to bare tag
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
      } else if (typeof Event !== 'undefined') {
        element.dispatchEvent(new Event('mouseover', opts));
        element.dispatchEvent(new Event('mouseenter', { ...opts, bubbles: false }));
      }

      if (typeof FocusEvent !== 'undefined') {
        element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      }
    } catch {}
  }

  /**
   * Recursively query all matching elements across the DOM and open shadow roots.
   * Enables seamless element resolution on complex web apps (Google Docs, Canvas LMS, Microsoft 365).
   * @param {Document|Element|ShadowRoot|HTMLElement} root
   * @param {string} selector
   * @returns {HTMLElement[]}
   */
  static querySelectorAllDeep(root, selector) {
    /** @type {HTMLElement[]} */
    const results = [];
    if (!root || !selector) return results;

    const seen = new Set();

    const traverse = (node) => {
      if (!node) return;

      if (typeof node.querySelectorAll === 'function') {
        try {
          const matches = node.querySelectorAll(selector);
          for (let i = 0; i < matches.length; i++) {
            const m = /** @type {HTMLElement} */ (matches[i]);
            if (!seen.has(m)) {
              seen.add(m);
              results.push(m);
            }
          }
        } catch {}
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
        } catch {}
      }
    };

    traverse(root);
    return results;
  }

  /**
   * Recursively query the first matching element across the DOM and open shadow roots.
   * @param {Document|Element|ShadowRoot|HTMLElement} root
   * @param {string} selector
   * @returns {HTMLElement|null}
   */
  static querySelectorDeep(root, selector) {
    if (!root || !selector) return null;

    if (typeof root.querySelector === 'function') {
      try {
        const direct = /** @type {HTMLElement|null} */ (root.querySelector(selector));
        if (direct) return direct;
      } catch {}
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
      } catch {}
    }

    return null;
  }

  /**
   * Evaluates an XPath expression across light DOM and open shadow roots.
   * @param {string} xpath
   * @param {Document} doc
   * @returns {HTMLElement|null}
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
        if (result?.singleNodeValue && result.singleNodeValue.nodeType === 1) {
          return /** @type {HTMLElement} */ (result.singleNodeValue);
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

    let curr = /** @type {HTMLElement|null} */ (element.parentElement || (/** @type {any} */ (element.getRootNode?.())?.host || null));
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
      curr = /** @type {HTMLElement|null} */ (curr.parentElement || (/** @type {any} */ (curr.getRootNode?.())?.host || null));
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
      // Skip native scrollIntoView when the element is already fully visible.
      // Scrolling can close transient menus/dropdowns in apps like Google Docs
      // and should only be used when the element is actually off-screen.
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
    * Detects the currently active modal/dialog element on the page.
    * @returns {HTMLElement|null}
    */
   static getActiveModal() {
     if (typeof document === 'undefined') return null;
     try {
       const dialog = /** @type {HTMLElement|null} */ (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"], [aria-modal="true"]'));
       if (dialog) return dialog;
       const modalByClass = /** @type {HTMLElement|null} */ (document.querySelector('.modal-dialog[aria-modal="true"], [role="dialog"]:not([aria-hidden="true"]), .modal[aria-modal="true"], .apps-share-dialog'));
       if (modalByClass) return modalByClass;
     } catch {}
     return null;
   }

   /**
    * Searches for an element inside a given root context (e.g., active modal).
    * Returns the found element or null if not found within the context.
    * @param {Object} selector
    * @param {HTMLElement} root
    * @returns {HTMLElement|null}
    */
   static findElementInContext(selector, root) {
     const isVisible = (element) => Boolean(
       element && (
         element.offsetParent !== null ||
         element.getClientRects?.().length > 0
       )
     );
     const isDialogContainer = (element) => {
       if (!element) return false;
       const role = element.getAttribute?.('role') || '';
       const className = String(element.className || '');
       const tagName = (element.tagName || '').toLowerCase();
       return (
         tagName === 'dialog' ||
         role === 'dialog' ||
         className.includes('modal-dialog') ||
         (element.matches && (element.matches('dialog, [role="dialog"], .modal-dialog') || false))
       );
     };
     const targetText = selector.text ? this.normalizeText(selector.text) : '';
     const targetAria = selector.ariaLabel ? selector.ariaLabel.trim().toLowerCase() : '';
     const isGenericCss = /^(button|div|a|input|span|select|p)$/i.test((selector.css || '').trim());
     const allowPartialText = Boolean(selector.css && !isGenericCss);

     // Handle container scoping within the modal context
     if (selector.container) {
       try {
         const containerEl = this.querySelectorDeep(root, selector.container);
         if (containerEl) {
           if (selector.css) {
             const cleanSubCss = selector.css.replace(selector.container, '').trim();
             const innerMatch = this.querySelectorDeep(containerEl, cleanSubCss || selector.css);
             if (innerMatch && (innerMatch.offsetParent !== null || innerMatch.getClientRects().length > 0)) {
               if (!targetText || this.normalizeText(innerMatch.textContent) === targetText || this.normalizeText(/** @type {any} */ (innerMatch).value) === targetText) {
                 return innerMatch;
               }
             }
           }
           if (targetText) {
             const containerButtons = this.querySelectorAllDeep(containerEl, 'button, [role="button"], input[type="submit"], a, input');
             for (const btn of containerButtons) {
               if (this.normalizeText(btn.textContent) === targetText || this.normalizeText(/** @type {any} */ (btn).value) === targetText) {
                 if (btn.offsetParent !== null || btn.getClientRects().length > 0) {
                   return btn;
                 }
               }
             }
           }
         }
       } catch {}
     }

     // 1. Direct CSS Selector Strategy scoped to root
     if (selector.css) {
       try {
         const cleanCss = sanitizeCssSelector(selector.css);
         const matches = this.querySelectorAllDeep(root, cleanCss);
         if (matches.length > 0) {
           if (!targetText && !targetAria) {
             const firstVisible = Array.from(matches).find((el) => el.offsetParent !== null || el.getClientRects().length > 0);
             if (firstVisible) return firstVisible;
           }
           for (const el of matches) {
             const elText = this.normalizeText(el.textContent);
             const elAria = (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || el.getAttribute?.('data-tooltip') || '').trim().toLowerCase();
             const elVal = this.normalizeText(/** @type {any} */ (el).value || el.getAttribute?.('value') || '');

             const exactText = targetText && (elText === targetText || elVal === targetText);
             const exactAria = targetAria && (elAria === targetAria || (!isGenericCss && elAria.includes(targetAria)));
             const partialText = allowPartialText && targetText && (elText.includes(targetText) || elVal.includes(targetText));
             const partialAria = targetAria && !isGenericCss && elAria.includes(targetAria);

             if ((exactText || exactAria || (partialText && !isDialogContainer(el)) || partialAria) && isVisible(el)) {
               return el;
             }
           }
           if (!isGenericCss && !targetText && !targetAria) {
             const visibleMatch = Array.from(matches).find((el) => el.offsetParent !== null || el.getClientRects().length > 0);
             if (visibleMatch) return visibleMatch;
           }
         }
       } catch (e) {}
     }

     // 2. data-testid / data-cy scoped to root
     if (selector.testId) {
       try {
         const el = this.querySelectorDeep(root, `[data-testid="${selector.testId}"], [data-cy="${selector.testId}"]`);
         if (isVisible(el)) return el;
       } catch { }
     }

     // 3. aria-label / title / tooltip scoped to root
     if (selector.ariaLabel || targetAria) {
       const ariaQuery = (selector.ariaLabel || targetAria).replace(/["'\\]/g, '');
       try {
         const el = this.querySelectorDeep(
           root,
           `[aria-label*="${ariaQuery}" i], [title*="${ariaQuery}" i], [data-tooltip*="${ariaQuery}" i]`
         );
         if (isVisible(el)) return el;
       } catch { }
       const ariaCandidates = this.querySelectorAllDeep(root, '[aria-label], [title], [data-tooltip]');
       for (const el of ariaCandidates) {
         const aria = (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('data-tooltip') || '').toLowerCase();
         if (aria.includes(targetAria || ariaQuery.toLowerCase())) {
           if (el.offsetParent !== null || el.getClientRects().length > 0) {
             return el;
           }
         }
       }
     }

     // 4. Visible Text Content Matching scoped to root
     if (selector.text || targetText) {
       const searchTxt = targetText || this.normalizeText(selector.text);
       const CONTROLS_SELECTOR = 'button, [role="button"], [role="combobox"], [role="listbox"], [role="option"], [role="radio"], [role="checkbox"], a, select, input[type="submit"], input[type="button"], summary, [role="menuitem"], [role="tab"], .goog-flat-menu-button, .goog-select, div[id*="share" i], div[class*="share" i]';
       const buttonCandidates = this.querySelectorAllDeep(root, CONTROLS_SELECTOR);
       for (const el of buttonCandidates) {
         if (isDialogContainer(el)) continue;
         const text = this.normalizeText(el.textContent);
         const aria = (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || el.getAttribute?.('data-tooltip') || '').trim().toLowerCase();
         const val = this.normalizeText(/** @type {any} */ (el).value || el.getAttribute?.('value') || '');
         const isMatch = isGenericCss
           ? (text === searchTxt || val === searchTxt)
           : (
               text === searchTxt ||
               (allowPartialText && text.includes(searchTxt)) ||
               (targetAria && aria.includes(searchTxt)) ||
               (!targetAria && aria === searchTxt) ||
               val === searchTxt
             );
         if (isMatch) {
           if (el.offsetParent !== null || el.getClientRects().length > 0) {
             return el;
           }
         }
       }
       const allTextNodes = this.querySelectorAllDeep(root, 'span, div, p, label, b, strong, i, [role="menuitem"], [role="tab"]');
       for (const node of allTextNodes) {
         const text = this.normalizeText(node.textContent);
         if (text === searchTxt) {
           const parentBtn = node.closest ? node.closest('button, [role="button"], [role="menuitem"], [role="tab"], a') : null;
           const targetEl = /** @type {HTMLElement} */ (parentBtn || node);
           if (targetEl.offsetParent !== null || targetEl.getClientRects().length > 0) {
             return targetEl;
           }
         }
       }
     }

     // 5. XPath scoped to root
     if (selector.xpath) {
       try {
         const xpathMatch = this.evaluateXPathDeep(selector.xpath, root.ownerDocument || document);
         if (isVisible(xpathMatch)) return xpathMatch;
       } catch (e) {}
     }

     // 6. Alternatives scoped to root
     if (Array.isArray(selector.alternatives) && selector.alternatives.length > 0) {
       for (const alt of selector.alternatives) {
         if (!alt || typeof alt !== 'string' || alt === selector.css) continue;
         try {
           if (alt.includes(':has-text(')) {
             const match = alt.match(/^(.*?):has-text\("(.*?)"\)$/);
             if (match) {
               const [, subTag, subText] = match;
               const normSubText = this.normalizeText(subText);
               const subMatches = this.querySelectorAllDeep(root, subTag || 'button, a, input');
               for (const subEl of subMatches) {
                 const txt = this.normalizeText(subEl.textContent);
                 const val = this.normalizeText(/** @type {any} */ (subEl).value || '');
                 if (txt.includes(normSubText) || val.includes(normSubText)) {
                   if (subEl.offsetParent !== null || subEl.getClientRects().length > 0) {
                     return subEl;
                   }
                 }
               }
             }
           } else {
             const altMatches = this.querySelectorAllDeep(root, alt);
             const visibleAlt = Array.from(altMatches).find((el) => el.offsetParent !== null || el.getClientRects().length > 0);
             if (visibleAlt) return visibleAlt;
           }
         } catch {}
       }
     }

     if (selector.fallbackCss && selector.fallbackCss !== selector.css) {
       try {
         const fallbackMatches = this.querySelectorAllDeep(root, selector.fallbackCss);
         const visibleFallback = Array.from(fallbackMatches).find((el) => el.offsetParent !== null || el.getClientRects().length > 0);
         if (visibleFallback) return visibleFallback;
       } catch {}
     }

     return null;
   }

   /**
    * Find an element immediately using fallback strategies.
    * @param {Object} selector - { css, xpath, text, testId, ariaLabel, hoverTrigger, container }
    * @returns {HTMLElement|null}
    */
   static findElement(selector) {
     if (!selector || typeof document === 'undefined') return null;

     const isVisible = (element) => Boolean(
       element && (
         element.offsetParent !== null ||
         element.getClientRects?.().length > 0
       )
     );
     const isDialogContainer = (element) => {
       if (!element) return false;
       const role = element.getAttribute?.('role') || '';
       const className = String(element.className || '');
       const tagName = (element.tagName || '').toLowerCase();
       return (
         tagName === 'dialog' ||
         role === 'dialog' ||
         className.includes('modal-dialog') ||
         (element.matches && (element.matches('dialog, [role="dialog"], .modal-dialog') || false))
       );
     };
     const targetText = selector.text ? this.normalizeText(selector.text) : '';
     const targetAria = selector.ariaLabel ? selector.ariaLabel.trim().toLowerCase() : '';
     const isGenericCss = /^(button|div|a|input|span|select|p)$/i.test((selector.css || '').trim());
     const allowPartialText = Boolean(selector.css && !isGenericCss);

     // Handle hover-triggered target resolution if specified
     if (selector.hoverTrigger) {
       const triggerEl = this.findElement(selector.hoverTrigger);
       if (triggerEl) {
         this.dispatchHoverEvents(triggerEl);
       }
     }

     // Modal Primacy: scope all searches inside the active dialog first
     const activeModal = this.getActiveModal();
     if (activeModal) {
       const modalResult = this.findElementInContext(selector, activeModal);
       if (modalResult) return modalResult;
     }

    // Handle container scoping to prioritize active dialog or specific containers
    if (selector.container) {
      try {
        const containerEl = this.querySelectorDeep(document, selector.container);
        if (containerEl) {
          if (selector.css) {
            const cleanSubCss = selector.css.replace(selector.container, '').trim();
            const innerMatch = this.querySelectorDeep(containerEl, cleanSubCss || selector.css);
            if (innerMatch && (innerMatch.offsetParent !== null || innerMatch.getClientRects().length > 0)) {
              if (!targetText || this.normalizeText(innerMatch.textContent) === targetText || this.normalizeText(/** @type {HTMLInputElement} */ (innerMatch).value) === targetText) {
                return innerMatch;
              }
            }
          }
          if (targetText) {
            const containerButtons = this.querySelectorAllDeep(containerEl, 'button, [role="button"], input[type="submit"], a, input');
            for (const btn of containerButtons) {
              if (this.normalizeText(btn.textContent) === targetText || this.normalizeText(/** @type {HTMLInputElement} */ (btn).value) === targetText) {
                if (btn.offsetParent !== null || btn.getClientRects().length > 0) {
                  return btn;
                }
              }
            }
          }
        }
      } catch {}
    }

    // 1. Direct CSS Selector Strategy (Traverses Open Shadow Roots)
    if (selector.css) {
      try {
        const cleanCss = sanitizeCssSelector(selector.css);
        const matches = this.querySelectorAllDeep(document, cleanCss);
        if (matches.length > 0) {
          // If no text or aria constraint, return the first visible match immediately
          if (!targetText && !targetAria) {
            const firstVisible = Array.from(matches).find((el) => el.offsetParent !== null || el.getClientRects().length > 0);
            if (firstVisible) return firstVisible;
          }

          // Prioritize exact or substring accessible-name/text matches
          for (const el of matches) {
            const elText = this.normalizeText(el.textContent);
            const elAria = (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || el.getAttribute?.('data-tooltip') || '').trim().toLowerCase();
            const elVal = this.normalizeText(/** @type {HTMLInputElement} */ (el).value || el.getAttribute?.('value') || '');

            const exactText = targetText && (elText === targetText || elVal === targetText);
            const exactAria = targetAria && (elAria === targetAria || (!isGenericCss && elAria.includes(targetAria)));
            const partialText = allowPartialText && targetText && (elText.includes(targetText) || elVal.includes(targetText));
            const partialAria = targetAria && !isGenericCss && elAria.includes(targetAria);

            if ((exactText || exactAria || (partialText && !isDialogContainer(el)) || partialAria) && isVisible(el)) {
              return el;
            }
          }

          // If CSS was specific (not a bare generic tag), return first visible match
          if (!isGenericCss && !targetText && !targetAria) {
            const visibleMatch = Array.from(matches).find((el) => el.offsetParent !== null || el.getClientRects().length > 0);
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
        if (isVisible(el)) return el;
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
        if (isVisible(el)) return el;
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

      // 4a. Check interactive elements first (button, a, combobox, listbox, dropdowns, inputs)
      const CONTROLS_SELECTOR = 'button, [role="button"], [role="combobox"], [role="listbox"], [role="option"], [role="radio"], [role="checkbox"], a, select, input[type="submit"], input[type="button"], summary, [role="menuitem"], [role="tab"], .goog-flat-menu-button, .goog-select, div[id*="share" i], div[class*="share" i]';
      const buttonCandidates = this.querySelectorAllDeep(document, CONTROLS_SELECTOR);
      for (const el of buttonCandidates) {
        if (isDialogContainer(el)) continue;
        const text = this.normalizeText(el.textContent);
        const aria = (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || el.getAttribute?.('data-tooltip') || '').trim().toLowerCase();
        const val = this.normalizeText(/** @type {any} */ (el).value || el.getAttribute?.('value') || '');

const isMatch = isGenericCss
	           ? (text === searchTxt || val === searchTxt)
	           : (
              text === searchTxt ||
              (allowPartialText && text.includes(searchTxt)) ||
              (targetAria && aria.includes(searchTxt)) ||
              (!targetAria && aria === searchTxt) ||
              val === searchTxt
            );

        if (isMatch) {
          if (el.offsetParent !== null || el.getClientRects().length > 0) {
            return el;
          }
        }
      }

      // 4b. Check other text elements and ascend to parent button if nested.
      // Only use exact text here. A broad ancestor such as Google Docs' banner
      // can contain the requested menu label in its combined text content and
      // must not become the target for a specific menu-item selector.
      const allTextNodes = this.querySelectorAllDeep(document, 'span, div, p, label, b, strong, i, [role="menuitem"], [role="tab"]');
      for (const node of allTextNodes) {
        const text = this.normalizeText(node.textContent);
        if (text === searchTxt) {
          const parentBtn = node.closest ? node.closest('button, [role="button"], [role="menuitem"], [role="tab"], a') : null;
          const targetEl = /** @type {HTMLElement} */ (parentBtn || node);
          if (targetEl.offsetParent !== null || targetEl.getClientRects().length > 0) {
            return targetEl;
          }
        }
      }
    }

    // 5. XPath Query (Traverses Open Shadow Roots)
    if (selector.xpath) {
      try {
        const xpathMatch = this.evaluateXPathDeep(selector.xpath, document);
        if (isVisible(xpathMatch)) return xpathMatch;
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
                const val = this.normalizeText(/** @type {any} */ (subEl).value || '');
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

      let timer = null;
      let poller = null;
      const check = () => {
        const found = this.findElement(selector);
        if (found) {
          cleanup();
          resolve(found);
        }
      };
      const observer = typeof MutationObserver !== 'undefined'
        ? new MutationObserver(check)
        : null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        if (poller) clearInterval(poller);
        observer?.disconnect();
      };

      observer?.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      // Some SPA/shadow-root controls change visibility without a mutation
      // observable from the document root. Polling closes that gap.
      poller = setInterval(check, 100);

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
