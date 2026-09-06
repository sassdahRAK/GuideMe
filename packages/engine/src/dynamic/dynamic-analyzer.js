import { IntentResolver, IntentRegistry } from '../intent/index.js';

/**
 * Dynamic Page Analyzer & Universal Step Generator (Hybrid Engine Mode 2).
 * Inspects host DOM structure on unscripted pages and synthesizes interactive tutorial flows.
 * Supports standard HTML elements, Links, Tabs, SVG icons, Canvas charts/graphics, and Iframes.
 */

export class DynamicPageAnalyzer {
  /**
   * Analyzes the active webpage DOM and extracts structural component metrics.
   * Scans HTML elements, navigation links, tabs, canvases, svgs, and iframes.
   * @param {Document} doc
   * @param {string} [url='']
   * @returns {Object} Page analysis metadata
   */
  static analyzePage(doc, url = '') {
    if (!doc || typeof doc.querySelectorAll !== 'function') {
      return {
        url,
        title: '',
        pageType: 'generic',
        forms: [],
        allInputs: [],
        buttons: [],
        links: [],
        allClickables: [],
        navElements: [],
        canvases: [],
        svgs: [],
        iframes: [],
        headings: [],
        passwordInputs: [],
        emailOrUserInputs: [],
        searchInputs: [],
        addToCartButtons: [],
        saveOrSubmitButtons: [],
        hasPasswordInput: false,
      };
    }

    const title = doc.title || '';

    // Collect open Shadow DOM roots if present (e.g. Web Components)
    const shadowRoots = [];
    try {
      const allTree = doc.querySelectorAll('*') || [];
      for (const node of allTree) {
        if (node.shadowRoot && typeof node.shadowRoot.querySelectorAll === 'function') {
          shadowRoots.push(node.shadowRoot);
        }
      }
    } catch { }

    const queryDoc = (selector) => {
      const results = Array.from(doc.querySelectorAll(selector) || []);
      for (const sr of shadowRoots) {
        try {
          const srResults = sr.querySelectorAll(selector);
          if (srResults) results.push(...Array.from(srResults));
        } catch { }
      }
      return results;
    };

    // 1. Forms
    const forms = Array.from(queryDoc('form') || []);

    // 2. All form inputs
    const allInputs = Array.from(
      queryDoc('input, select, textarea, [role="textbox"], [role="searchbox"], [role="combobox"], [contenteditable="true"]') || []
    ).filter((el) => {
      const type = (el.type || '').toLowerCase();
      if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'image' || type === 'reset') return false;
      const ariaHidden = el.getAttribute ? el.getAttribute('aria-hidden') : null;
      if (ariaHidden === 'true') return false;
      const name = (el.name || '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      if (name.includes('csrf') || name.includes('token') || name.includes('hidden') || id.includes('csrf') || id.includes('token') || id.includes('hidden')) return false;
      return true;
    });

    // 3. Action buttons
    const buttons = Array.from(
      queryDoc('button, [role="button"], input[type="submit"], input[type="button"], a.btn, a[class*="button"]') || []
    ).filter((btn) => {
      const ariaHidden = btn.getAttribute ? btn.getAttribute('aria-hidden') : null;
      return ariaHidden !== 'true';
    });

    // 4. Navigation links, tabs, and interactive items
    const links = Array.from(
      queryDoc('a[href], [role="link"], [role="tab"], [role="menuitem"], [role="option"], [role="treeitem"], [role="switch"], [role="checkbox"], [role="radio"], summary') || []
    ).filter((el) => {
      const ariaHidden = el.getAttribute ? el.getAttribute('aria-hidden') : null;
      return ariaHidden !== 'true';
    });

    // 5. Combined interactive clickables (Buttons + Links + Tabindex elements)
    const clickableSet = new Set([...buttons, ...links]);
    const otherClickables = Array.from(
      queryDoc('[tabindex="0"], [onclick], [data-action], [data-click]') || []
    ).filter((el) => !clickableSet.has(el));
    const allClickables = [...clickableSet, ...otherClickables];

    // 6. Navigation containers
    const navElements = Array.from(queryDoc('nav, [role="navigation"], header nav, .nav, .menu, .tabs') || []);

    // 7. Canvas elements (Charts, graphics, games, webgl)
    const canvases = Array.from(queryDoc('canvas, [role="img"] canvas') || []).filter((el) => {
      const ariaHidden = el.getAttribute ? el.getAttribute('aria-hidden') : null;
      return ariaHidden !== 'true';
    });

    // 8. SVG icon and vector graphic elements
    const svgs = Array.from(queryDoc('svg, [role="img"] svg, svg[role="img"]') || []).filter((svg) => {
      const hasLabel = Boolean(
        svg.getAttribute?.('aria-label') ||
        svg.getAttribute?.('title') ||
        (svg.querySelector && svg.querySelector('title'))
      );
      const isInteractive = svg.getAttribute?.('role') === 'button' || svg.getAttribute?.('tabindex') === '0' || Boolean(svg.onclick);
      return hasLabel || isInteractive;
    });

    // 9. Iframes (Embedded widgets, players, authentication frames)
    const iframes = Array.from(queryDoc('iframe, frame') || []);

    // 10. Heading elements for anchor discovery
    const headings = Array.from(queryDoc('h1, h2, h3, h4, h5, h6') || []);

    // Specific input classifications for page type detection
    const passwordInputs = allInputs.filter((el) => el.type === 'password');
    const emailOrUserInputs = allInputs.filter((el) => {
      const type = (el.type || '').toLowerCase();
      const name = (el.name || '').toLowerCase();
      const placeholder = (el.placeholder || '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      return (
        type === 'email' ||
        name.includes('user') ||
        name.includes('email') ||
        name.includes('login') ||
        placeholder.includes('user') ||
        placeholder.includes('email') ||
        id.includes('user') ||
        id.includes('email')
      );
    });

    const searchInputs = allInputs.filter((el) => {
      const type = (el.type || '').toLowerCase();
      const name = (el.name || '').toLowerCase();
      const placeholder = (el.placeholder || '').toLowerCase();
      const ariaLabel = ((el.getAttribute ? el.getAttribute('aria-label') : '') || '').toLowerCase();
      return (
        type === 'search' ||
        name.includes('search') ||
        name.includes('query') ||
        name.includes('q') ||
        placeholder.includes('search') ||
        ariaLabel.includes('search')
      );
    });

    const addToCartButtons = buttons.filter((btn) => {
      const text = (btn.textContent || '').toLowerCase();
      const aria = ((btn.getAttribute ? btn.getAttribute('aria-label') : '') || '').toLowerCase();
      return text.includes('cart') || text.includes('buy') || aria.includes('cart') || aria.includes('buy');
    });

    const saveOrSubmitButtons = buttons.filter((btn) => {
      const text = (btn.textContent || '').toLowerCase();
      return text.includes('save') || text.includes('submit') || text.includes('apply') || text.includes('update');
    });

    const pageType = this.classifyPageType({
      url,
      hasPasswordInput: passwordInputs.length > 0,
      emailOrUserInputsCount: emailOrUserInputs.length,
      passwordInputsCount: passwordInputs.length,
      searchInputsCount: searchInputs.length,
      addToCartCount: addToCartButtons.length,
      saveButtonsCount: saveOrSubmitButtons.length,
      formsCount: forms.length,
      inputsCount: allInputs.length,
      buttonsCount: buttons.length,
      hasNav: navElements.length > 0,
    });

    return {
      url,
      title,
      pageType,
      forms,
      allInputs,
      buttons,
      links,
      allClickables,
      navElements,
      canvases,
      svgs,
      iframes,
      headings,
      passwordInputs,
      emailOrUserInputs,
      searchInputs,
      addToCartButtons,
      saveOrSubmitButtons,
      hasPasswordInput: passwordInputs.length > 0,
    };
  }

  /**
   * Classifies the page category based on structural patterns.
   * @param {Object} metrics
   * @returns {string} Page category
   */
  static classifyPageType(metrics) {
    const {
      hasPasswordInput,
      searchInputsCount,
      addToCartCount,
      saveButtonsCount,
      formsCount,
      inputsCount,
      buttonsCount,
      hasNav,
    } = metrics;

    if (addToCartCount > 0) {
      return 'ecommerceProduct';
    }

    if (hasPasswordInput) {
      if (inputsCount >= 4) {
        return 'signupForm';
      }
      return 'loginForm';
    }

    if (searchInputsCount > 0 && inputsCount <= 3) {
      return 'searchPage';
    }

    if (saveButtonsCount > 0 && inputsCount >= 3) {
      return 'settingsPage';
    }

    if (buttonsCount >= 6 && hasNav) {
      return 'dashboard';
    }

    if (formsCount > 0 || inputsCount >= 2) {
      return 'form';
    }

    if (hasNav) {
      return 'navigation';
    }

    return 'generic';
  }

  /**
   * Extracts unified descriptive metadata from any DOM element.
   * Supports normal HTML elements, links, tabs, SVGs, Canvases, and Iframes.
   * @param {HTMLElement|SVGElement} el
   * @returns {Object|null}
   */
  static extractElementDescriptor(el) {
    if (!el) return null;

    const tagName = (el.tagName || '').toLowerCase();
    const role = el.getAttribute ? (el.getAttribute('role') || '').toLowerCase() : '';
    const id = (el.id || '').trim();
    const className = typeof el.className === 'string' ? el.className.trim() : (el.className?.baseVal || '');
    const ariaLabel = el.getAttribute ? (el.getAttribute('aria-label') || '').trim() : '';
    const title = el.getAttribute ? (el.getAttribute('title') || '').trim() : '';
    const href = el.getAttribute ? (el.getAttribute('href') || '').trim() : '';
    const alt = el.getAttribute ? (el.getAttribute('alt') || '').trim() : '';
    const placeholder = el.getAttribute ? (el.getAttribute('placeholder') || '').trim() : '';
    const name = el.getAttribute ? (el.getAttribute('name') || '').trim() : '';
    const type = (el.type || '').toLowerCase();

    // SVG title tag if available
    let svgTitle = '';
    if (tagName === 'svg' && el.querySelector) {
      try {
        svgTitle = (el.querySelector('title')?.textContent || '').trim();
      } catch {}
    }

    // Direct text content (excluding script/style)
    let text = '';
    if (tagName !== 'script' && tagName !== 'style') {
      text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    }

    // High-level category
    let category = 'element';
    if (tagName === 'canvas') {
      category = 'canvas';
    } else if (tagName === 'svg' || role === 'img') {
      category = 'svg';
    } else if (tagName === 'iframe' || tagName === 'frame') {
      category = 'iframe';
    } else if (['input', 'textarea', 'select'].includes(tagName) || ['textbox', 'searchbox', 'combobox'].includes(role)) {
      category = 'input';
    } else if (tagName === 'a' || role === 'tab' || role === 'link' || role === 'menuitem') {
      category = 'navigation';
    } else if (tagName === 'button' || role === 'button' || type === 'submit' || type === 'button') {
      category = 'action';
    } else if (/^h[1-6]$/.test(tagName)) {
      category = 'heading';
    }

    // Best concise label for human display and matching
    const label = ariaLabel || title || svgTitle || alt || placeholder || (text ? text.slice(0, 45) : '') || name || id || `${category}`;

    return {
      element: el,
      tagName,
      category,
      role,
      id,
      className,
      ariaLabel,
      title,
      href,
      alt,
      placeholder,
      name,
      type,
      svgTitle,
      text,
      label,
    };
  }

  /**
   * Infers the primary intent of the user prompt.
   * @param {string} promptText
   * @returns {'navigate'|'input'|'action'|'visual'|'general'}
   * @private
   */
  static _determinePromptIntent(promptText) {
    const p = (promptText || '').toLowerCase().trim();
    if (/^(view|open|go to|show|see|visit|switch to|navigate)\b/.test(p)) {
      return 'navigate';
    }
    if (/^(type|enter|search|write|fill|input)\b/.test(p)) {
      return 'input';
    }
    if (/^(click|press|tap|submit|send|save|apply|checkout|buy)\b/.test(p)) {
      return 'action';
    }
    if (/(canvas|chart|graph|draw|icon|svg|visual|plot|diagram)/.test(p)) {
      return 'visual';
    }
    return 'general';
  }

  /**
   * Calculates semantic match score between prompt keywords and element metadata.
   * @param {Object} desc - Element descriptor from extractElementDescriptor
   * @param {string} promptText - Raw user prompt
   * @param {string[]} keywords - Normalized keywords
   * @param {string} promptIntent - Inferred intent
   * @returns {number} Score (higher is better)
   */
  static scoreElementForPrompt(desc, promptText, keywords, promptIntent) {
    if (!desc || !promptText) return 0;

    let score = 0;
    const normPrompt = promptText.toLowerCase().trim();
    const normText = (desc.text || '').toLowerCase();
    const normLabel = (desc.label || '').toLowerCase();
    const normHref = (desc.href || '').toLowerCase();
    const normId = (desc.id || '').toLowerCase();
    const normAria = (desc.ariaLabel || '').toLowerCase();
    const normName = (desc.name || '').toLowerCase();

    // 1. Full phrase match (Highest Priority)
    if (normLabel.includes(normPrompt) || normText.includes(normPrompt)) {
      score += 200;
    }

    // 2. Keyword matching with boundary recognition
    let matchedKeywordsCount = 0;
    for (const kw of keywords) {
      const kwRegex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

      let kwMatched = false;
      if (kwRegex.test(normLabel) || kwRegex.test(normAria)) {
        score += 100;
        kwMatched = true;
      } else if (kwRegex.test(normText)) {
        score += 80;
        kwMatched = true;
      } else if (normHref && kwRegex.test(normHref)) {
        score += 70;
        kwMatched = true;
      } else if (kwRegex.test(normId) || kwRegex.test(normName)) {
        score += 60;
        kwMatched = true;
      } else if (normText.includes(kw) || normLabel.includes(kw)) {
        // Substring inside word (e.g. "view" inside "overview") -> lower score
        score += 15;
      }

      if (kwMatched) matchedKeywordsCount++;
    }

    // Bonus for matching all keywords in the prompt
    if (keywords.length > 1 && matchedKeywordsCount === keywords.length) {
      score += 120;
    }

    // 3. Category & Intent alignment
    if (promptIntent === 'navigate') {
      if (desc.category === 'navigation' || desc.role === 'tab') score += 40;
      if (desc.category === 'action') score += 25;
    } else if (promptIntent === 'input') {
      if (desc.category === 'input') score += 50;
    } else if (promptIntent === 'visual') {
      if (desc.category === 'canvas' || desc.category === 'svg') score += 70;
    }

    // 4. SVG / Canvas / Iframe domain relevance
    if (desc.category === 'svg' && (desc.svgTitle || desc.ariaLabel)) {
      score += 25;
    }
    if (desc.category === 'canvas' && (normPrompt.includes('canvas') || normPrompt.includes('chart') || normPrompt.includes('graph'))) {
      score += 100;
    }
    if (desc.category === 'iframe' && (normPrompt.includes('frame') || normPrompt.includes('embed') || normPrompt.includes('video') || normPrompt.includes('payment'))) {
      score += 100;
    }

    // 5. Penalize noisy elements with giant text blocks (e.g. whole articles or footers)
    if (desc.text.length > 150) {
      score -= Math.min(60, Math.floor((desc.text.length - 150) / 10));
    }

    return score;
  }

  /**
   * Generates a fully formed, executable declarative tutorial schema for the page.
   * @param {Document} doc
   * @param {string} [url='']
   * @param {string|Object} [userPrompt=''] - Custom user input prompt or JSON schema
   * @returns {Object} JSON Tutorial schema
   */
  /**
   * Collects all interactive candidate DOM elements and extracts their descriptors.
   * Filters out hidden elements in browser environments.
   * @param {Document} doc
   * @param {string} [url='']
   * @returns {{ analysis: Object, descriptors: Array<Object> }}
   */
  static collectCandidateDescriptors(doc, url = '') {
    const analysis = this.analyzePage(doc, url);
    const candidateElements = [
      ...(analysis.allClickables || []),
      ...(analysis.allInputs || []),
      ...(analysis.canvases || []),
      ...(analysis.svgs || []),
      ...(analysis.iframes || []),
    ];

    const descriptors = [];
    const seenElements = new Set();

    for (const el of candidateElements) {
      if (!el || seenElements.has(el)) continue;
      seenElements.add(el);

      // Filter out hidden/invisible elements in browser environment
      if (typeof window !== 'undefined') {
        if (el.offsetParent === null && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
          const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
          if (!style || style.position !== 'fixed') continue;
        }
        if (typeof el.getClientRects === 'function' && el.getClientRects().length === 0) {
          continue;
        }
      }

      const desc = this.extractElementDescriptor(el);
      if (desc) {
        descriptors.push(desc);
      }
    }

    return { analysis, descriptors };
  }

  /**
   * Transforms resolved candidate descriptors into executable declarative tutorial steps.
   * Enforces single-input discipline and dynamic search query target resolution.
   * @param {Array<Object>} selectedCandidates
   * @param {string} promptText
   * @returns {Array<Object>}
   * @private
   */
  static _buildStepsFromSelectedCandidates(selectedCandidates, promptText) {
    let extractedQuery = '';
    const quotedMatch = promptText.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      extractedQuery = quotedMatch[1].trim();
    } else {
      // 1. Explicit named entity (e.g. "named mytube", "called mytube")
      const namedMatch = promptText.match(/(?:named\s+as|named|called)\s+([A-Za-z0-9_.-]+)/i);
      if (namedMatch) {
        extractedQuery = namedMatch[1].trim();
      } else {
        // 2. Direct search/find entity (e.g. "search mytube", "find mytube", "repo mytube")
        const actionMatch = promptText.match(/(?:search|find|for|repo|repository)\s+(?:for\s+)?([A-Za-z0-9_.-]+)/i);
        if (actionMatch && !['a', 'the', 'repository', 'repo', 'project', 'page'].includes(actionMatch[1].toLowerCase())) {
          extractedQuery = actionMatch[1].trim();
        }
      }
    }

    return selectedCandidates.map((desc, idx) => {
      const stepId = `prompt_step_${desc.category}_${idx + 1}`;
      let target;
      if (desc.isDynamicResult) {
        const q = desc.extractedQuery || extractedQuery;
        target = {
          css: `a[href*="${q.toLowerCase()}"], [title*="${q}"], [aria-label*="${q}"]`,
          text: q,
        };
      } else {
        target = this._buildTargetSelector(desc);
      }

      let stepTitle = `Click "${desc.label}"`;
      let stepDescription = `Click this element to proceed.`;
      let actionContent = `Click here as part of "${promptText}".`;
      let validationType = 'click';

      if (desc.isDynamicResult) {
        stepTitle = `Click "${desc.label}"`;
        stepDescription = `Select "${desc.label}" from the results list.`;
        actionContent = `Click here to open "${desc.label}".`;
        validationType = 'click';
      } else if (desc.category === 'input') {
        stepTitle = extractedQuery ? `Enter "${extractedQuery}"` : `Enter ${desc.label}`;
        stepDescription = extractedQuery
          ? `Type "${extractedQuery}" into the ${desc.label} field.`
          : `Type information into the ${desc.label} field.`;
        actionContent = extractedQuery
          ? `Type "${extractedQuery}" into this field.`
          : `Type text into this field for "${promptText}".`;
        validationType = 'input';
      } else if (desc.category === 'canvas') {
        stepTitle = `Interact with ${desc.label}`;
        stepDescription = `View or interact with the canvas graphic.`;
        actionContent = `Interact with this canvas area for "${promptText}".`;
        validationType = 'click';
      } else if (desc.category === 'svg') {
        stepTitle = `Click ${desc.label}`;
        stepDescription = `Select this icon to activate the feature.`;
        actionContent = `Click on this icon for "${promptText}".`;
        validationType = 'click';
      } else if (desc.category === 'iframe') {
        stepTitle = `Access ${desc.label}`;
        stepDescription = `View and interact with content in this embedded frame.`;
        actionContent = `Interact with this embedded section for "${promptText}".`;
        validationType = 'click';
      } else if (desc.category === 'navigation') {
        stepTitle = `Open ${desc.label}`;
        stepDescription = `Navigate to ${desc.label}.`;
        actionContent = `Click here to navigate to "${desc.label}".`;
        validationType = 'click';
      }

      return {
        id: stepId,
        title: stepTitle,
        description: stepDescription,
        target,
        action: {
          type: 'spotlight',
          title: desc.label,
          content: actionContent,
          placement: desc.category === 'input' ? 'bottom' : 'top',
          category: desc.category,
        },
        validation: {
          type: validationType,
          ...(validationType === 'input' && extractedQuery ? { expectedValue: extractedQuery } : {}),
        },
      };
    });
  }

  /**
   * Generates structural template tutorials based on detected page category.
   * @param {Object} analysis
   * @param {string} domain
   * @param {string} tutorialId
   * @param {string} name
   * @param {string} description
   * @returns {Object}
   * @private
   */
  static _generateStructuralTutorial(analysis, domain, tutorialId, name, description) {
    const steps = [];

    switch (analysis.pageType) {
      case 'loginForm': {
        name = `Sign In Walkthrough: ${domain}`;
        description = `Step-by-step guidance to sign in to your account.`;

        const userInput = analysis.emailOrUserInputs[0] || analysis.allInputs[0];
        const passInput = analysis.passwordInputs[0];
        const submitBtn = analysis.buttons[0];

        if (userInput) {
          steps.push({
            id: 'dynamic_step_username',
            title: 'Enter Username or Email',
            description: 'Type your account email or username into this field.',
            target: this._buildTargetSelector(userInput, 'input[type="text"], input[type="email"]'),
            action: {
              type: 'spotlight',
              title: 'Account Identifier',
              content: 'Enter your registered email address or username.',
              placement: 'bottom',
            },
            validation: { type: 'input' },
          });
        }

        if (passInput) {
          steps.push({
            id: 'dynamic_step_password',
            title: 'Enter Password',
            description: 'Enter your secure password.',
            target: this._buildTargetSelector(passInput, 'input[type="password"]'),
            action: {
              type: 'spotlight',
              title: 'Password Field',
              content: 'Enter your password (characters remain safely hidden).',
              placement: 'bottom',
            },
            validation: { type: 'input' },
          });
        }

        if (submitBtn) {
          steps.push({
            id: 'dynamic_step_submit',
            title: 'Submit Login',
            description: 'Click the button to access your account.',
            target: this._buildTargetSelector(submitBtn, 'button, [role="button"]'),
            action: {
              type: 'spotlight',
              title: 'Log In',
              content: 'Click here to sign in.',
              placement: 'top',
            },
            validation: { type: 'click' },
          });
        }
        break;
      }

      case 'signupForm': {
        name = `Account Registration Guide: ${domain}`;
        description = `Follow these steps to create a new account.`;

        analysis.allInputs.slice(0, 4).forEach((input, idx) => {
          const label = input.placeholder || input.name || `Input field #${idx + 1}`;
          steps.push({
            id: `dynamic_step_signup_${idx}`,
            title: `Fill ${label}`,
            description: `Complete the ${label} to continue registration.`,
            target: this._buildTargetSelector(input, 'input'),
            action: {
              type: 'spotlight',
              title: label,
              content: `Please enter required information in this field.`,
              placement: 'bottom',
            },
            validation: { type: 'input' },
          });
        });
        break;
      }

      case 'ecommerceProduct': {
        name = `Product & Shopping Guide: ${domain}`;
        description = `Discover product details, options, and cart actions.`;

        if (analysis.searchInputs[0]) {
          steps.push({
            id: 'dynamic_step_search',
            title: 'Search for Products',
            description: 'Use the search bar to find products or catalog items.',
            target: this._buildTargetSelector(analysis.searchInputs[0], 'input[type="search"]'),
            action: {
              type: 'spotlight',
              title: 'Product Search',
              content: 'Type your search query and press Enter.',
              placement: 'bottom',
            },
            validation: { type: 'input' },
          });
        }

        if (analysis.addToCartButtons[0]) {
          steps.push({
            id: 'dynamic_step_add_cart',
            title: 'Add to Cart',
            description: 'Click to add the selected item to your shopping cart.',
            target: this._buildTargetSelector(analysis.addToCartButtons[0], 'button'),
            action: {
              type: 'spotlight',
              title: 'Add to Cart Action',
              content: 'Click here when you are ready to purchase.',
              placement: 'top',
            },
            validation: { type: 'click' },
          });
        }
        break;
      }

      case 'searchPage': {
        name = `Search Guide: ${domain}`;
        description = `Learn how to search and filter content on this site.`;

        const searchInput = analysis.searchInputs[0] || analysis.allInputs[0];
        if (searchInput) {
          steps.push({
            id: 'dynamic_step_search_query',
            title: 'Enter Search Query',
            description: 'Type terms or keywords to find relevant results.',
            target: this._buildTargetSelector(searchInput, 'input'),
            action: {
              type: 'spotlight',
              title: 'Search Bar',
              content: 'Type your keywords and press Enter.',
              placement: 'bottom',
            },
            validation: { type: 'input' },
          });
        }
        break;
      }

      case 'settingsPage': {
        name = `Settings & Configuration Guide: ${domain}`;
        description = `Navigate configuration options and save changes.`;

        analysis.allInputs.slice(0, 3).forEach((ctrl, idx) => {
          const label = ctrl.placeholder || ctrl.name || `Option ${idx + 1}`;
          steps.push({
            id: `dynamic_step_setting_${idx}`,
            title: `Configure ${label}`,
            description: `Adjust this setting according to your preference.`,
            target: this._buildTargetSelector(ctrl, 'input, select'),
            action: {
              type: 'spotlight',
              title: label,
              content: `Change or toggle this configuration option.`,
              placement: 'bottom',
            },
            validation: { type: 'input' },
          });
        });

        if (analysis.saveOrSubmitButtons[0]) {
          steps.push({
            id: 'dynamic_step_save_settings',
            title: 'Save Changes',
            description: 'Apply your updated preferences.',
            target: this._buildTargetSelector(analysis.saveOrSubmitButtons[0], 'button'),
            action: {
              type: 'spotlight',
              title: 'Apply Settings',
              content: 'Click to save and apply your configuration changes.',
              placement: 'top',
            },
            validation: { type: 'click' },
          });
        }
        break;
      }

      case 'dashboard':
      case 'navigation':
      case 'generic':
      default: {
        name = `Explore ${domain}`;
        description = `Interactive walkthrough of primary interactive elements on this page.`;

        // 1. Navigation item if available
        if (analysis.navElements[0]) {
          steps.push({
            id: 'dynamic_step_nav',
            title: 'Main Navigation',
            description: 'Access different sections of the website from this navigation area.',
            target: this._buildTargetSelector(analysis.navElements[0], 'nav, header'),
            action: {
              type: 'spotlight',
              title: 'Navigation Bar',
              content: 'Use this bar to explore different categories and pages.',
              placement: 'bottom',
            },
            validation: { type: 'click' },
          });
        }

        // 2. Interactive action buttons or links
        const topActions = (analysis.allClickables && analysis.allClickables.length > 0)
          ? analysis.allClickables.slice(0, 2)
          : analysis.buttons.slice(0, 2);

        topActions.forEach((btn, idx) => {
          const label = (btn.textContent || '').trim().substring(0, 30) || `Action Button ${idx + 1}`;
          steps.push({
            id: `dynamic_step_btn_${idx}`,
            title: `Explore "${label}"`,
            description: `Primary interactive action on this page.`,
            target: this._buildTargetSelector(btn, 'button, a'),
            action: {
              type: 'spotlight',
              title: label,
              content: `Click this action to proceed with the core workflow.`,
              placement: 'bottom',
            },
            validation: { type: 'click' },
          });
        });

        // 3. Primary input if present
        if (analysis.allInputs[0]) {
          const input = analysis.allInputs[0];
          const label = input.placeholder || input.name || 'Input field';
          steps.push({
            id: 'dynamic_step_primary_input',
            title: `Interact with ${label}`,
            description: 'Enter data or search query.',
            target: this._buildTargetSelector(input, 'input'),
            action: {
              type: 'spotlight',
              title: label,
              content: `Type information or selection here.`,
              placement: 'bottom',
            },
            validation: { type: 'input' },
          });
        }
        break;
      }
    }

    // Fallback step if page has no recognizable elements
    if (steps.length === 0) {
      steps.push({
        id: 'dynamic_fallback_step',
        title: `Welcome to ${domain}`,
        description: 'Explore this page at your own pace.',
        target: { css: 'body, main, #root, #app' },
        action: {
          type: 'spotlight',
          title: `Welcome to ${domain}`,
          content: 'This page is ready for interaction. Follow on-screen controls to navigate.',
          placement: 'bottom',
        },
        validation: { type: 'click' },
      });
    }

    return {
      id: tutorialId,
      version: '1.0.0',
      name,
      description,
      matchUrls: ['<all_urls>'],
      steps,
    };
  }

  /**
   * Generates a fully formed, executable declarative tutorial schema synchronously.
   * Powered by Stage 1 local Fuse.js filter with zero network latency.
   * @param {Document} doc
   * @param {string} [url='']
   * @param {string|Object} [userPrompt=''] - Custom user input prompt or JSON schema
   * @param {Object} [options={}]
   * @returns {Object} JSON Tutorial schema
   */
  static generateDynamicTutorial(doc, url = '', userPrompt = '', options = {}) {
    // 0. If userPrompt is a raw JSON string of a tutorial schema, parse and return it directly
    if (typeof userPrompt === 'string' && userPrompt.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(userPrompt.trim());
        if (parsed && parsed.steps && Array.isArray(parsed.steps)) {
          return {
            id: parsed.id || `custom-prompt-guide-${Date.now()}`,
            version: parsed.version || '1.0.0',
            name: parsed.name || 'Custom Guided Tour',
            description: parsed.description || 'User-defined custom guide.',
            matchUrls: parsed.matchUrls || ['<all_urls>'],
            steps: parsed.steps,
          };
        }
      } catch (e) {
        // Fallback to prompt keyword matching
      }
    }

    const { analysis, descriptors } = this.collectCandidateDescriptors(doc, url);
    const domain = (() => {
      try {
        return new URL(url || (typeof location !== 'undefined' ? location.href : '')).hostname;
      } catch {
        return 'Webpage';
      }
    })();

    const promptText = (typeof userPrompt === 'string' ? userPrompt.trim() : '');
    const tutorialId = `dynamic-guide-${Date.now()}`;
    let name = promptText ? `Guide: ${promptText}` : `Interactive Walkthrough: ${domain}`;
    let description = promptText
      ? `Step-by-step guidance for "${promptText}" on ${domain}.`
      : `Auto-generated walkthrough exploring key workflows on this page.`;

    if (promptText && descriptors.length > 0) {
      const keywords = promptText.toLowerCase().split(/[\s,._-]+/).filter((w) => w.length >= 2);
      const promptIntent = this._determinePromptIntent(promptText);
      const heuristicScorer = (desc) => this.scoreElementForPrompt(desc, promptText, keywords, promptIntent);

      const resolver = options.resolver || new IntentResolver();
      const selectedCandidates = resolver.resolveSync(descriptors, promptText, { ...options, heuristicScorer });

      if (selectedCandidates.length > 0) {
        const steps = this._buildStepsFromSelectedCandidates(selectedCandidates, promptText);
        return {
          id: tutorialId,
          version: '1.0.0',
          name,
          description,
          matchUrls: ['<all_urls>'],
          steps,
        };
      }
    }

    return this._generateStructuralTutorial(analysis, domain, tutorialId, name, description);
  }

  /**
   * Generates a fully formed, executable declarative tutorial schema asynchronously.
   * Leverages the Hybrid Two-Stage Intent Resolver (Fuse.js + LLM Semantic Re-ranking)
   * with automatic fallback to Stage 1 on timeout or missing API keys.
   * @param {Document} doc
   * @param {string} [url='']
   * @param {string|Object} [userPrompt='']
   * @param {Object} [options={}]
   * @returns {Promise<Object>} JSON Tutorial schema
   */
  static async generateDynamicTutorialAsync(doc, url = '', userPrompt = '', options = {}) {
    // 0. If userPrompt is a raw JSON string of a tutorial schema, parse and return it directly
    if (typeof userPrompt === 'string' && userPrompt.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(userPrompt.trim());
        if (parsed && parsed.steps && Array.isArray(parsed.steps)) {
          return {
            id: parsed.id || `custom-prompt-guide-${Date.now()}`,
            version: parsed.version || '1.0.0',
            name: parsed.name || 'Custom Guided Tour',
            description: parsed.description || 'User-defined custom guide.',
            matchUrls: parsed.matchUrls || ['<all_urls>'],
            steps: parsed.steps,
          };
        }
      } catch (e) {
        // Fallback to prompt keyword matching
      }
    }

    const { analysis, descriptors } = this.collectCandidateDescriptors(doc, url);
    const domain = (() => {
      try {
        return new URL(url || (typeof location !== 'undefined' ? location.href : '')).hostname;
      } catch {
        return 'Webpage';
      }
    })();

    const promptText = (typeof userPrompt === 'string' ? userPrompt.trim() : '');
    const tutorialId = `dynamic-guide-${Date.now()}`;
    let name = promptText ? `Guide: ${promptText}` : `Interactive Walkthrough: ${domain}`;
    let description = promptText
      ? `Step-by-step guidance for "${promptText}" on ${domain}.`
      : `Auto-generated walkthrough exploring key workflows on this page.`;

    if (promptText && descriptors.length > 0) {
      const keywords = promptText.toLowerCase().split(/[\s,._-]+/).filter((w) => w.length >= 2);
      const promptIntent = this._determinePromptIntent(promptText);
      const heuristicScorer = (desc) => this.scoreElementForPrompt(desc, promptText, keywords, promptIntent);

      const reranker =
        options.reranker ||
        IntentRegistry.fromEnv(options.env || (typeof process !== 'undefined' && process.env ? process.env : {}));
      const resolver = options.resolver || new IntentResolver({ reranker });

      const selectedCandidates = await resolver.resolve(descriptors, promptText, { ...options, heuristicScorer });

      if (selectedCandidates.length > 0) {
        const steps = this._buildStepsFromSelectedCandidates(selectedCandidates, promptText);
        return {
          id: tutorialId,
          version: '1.0.0',
          name,
          description,
          matchUrls: ['<all_urls>'],
          steps,
        };
      }
    }

    return this._generateStructuralTutorial(analysis, domain, tutorialId, name, description);
  }

  /**
   * Builds resilient, disambiguated multi-strategy target selector definition for any element.
   * Supports normal HTML elements, links, tabs, SVGs, Canvases, and Iframes.
   * @param {HTMLElement|Object} descriptorOrEl - Element or extracted descriptor
   * @param {string} [defaultCssFallback='']
   * @returns {Object} Target selector object { css, text, ariaLabel }
   */
  static _buildTargetSelector(descriptorOrEl, defaultCssFallback = '') {
    if (!descriptorOrEl) return { css: defaultCssFallback || 'body' };

    const desc = descriptorOrEl.element ? descriptorOrEl : this.extractElementDescriptor(descriptorOrEl);
    if (!desc || !desc.element) return { css: defaultCssFallback || 'body' };

    const el = desc.element;
    const target = {};

    // 1. Clean, unique ID
    if (desc.id && !desc.id.includes(' ') && !desc.id.includes(':') && !/^\d+$/.test(desc.id)) {
      target.css = `#${desc.id}`;
    }

    // 2. Data attributes
    if (!target.css) {
      const dataAttrs = ['data-tab-item', 'data-testid', 'data-cy', 'data-action', 'data-nav', 'data-id'];
      for (const attr of dataAttrs) {
        const val = el.getAttribute?.(attr);
        if (val) {
          target.css = `${desc.tagName}[${attr}="${val}"]`;
          break;
        }
      }
    }

    // 3. Anchor href query or path (Crucial for GitHub tabs e.g. a[href*="tab=repositories"])
    if (!target.css && desc.tagName === 'a' && desc.href) {
      try {
        const urlObj = new URL(desc.href, 'https://guideme.local');
        if (urlObj.search && urlObj.search.length > 2) {
          target.css = `a[href*="${urlObj.search.slice(1)}"]`;
        } else if (urlObj.pathname && urlObj.pathname !== '/' && urlObj.pathname.length > 1) {
          target.css = `a[href*="${urlObj.pathname.slice(1)}"]`;
        }
      } catch {
        if (!desc.href.startsWith('#') && !desc.href.startsWith('javascript:')) {
          target.css = `a[href="${desc.href}"]`;
        }
      }
    }

    // 4. Role + aria-label
    if (!target.css && desc.role && desc.ariaLabel) {
      target.css = `[role="${desc.role}"][aria-label="${desc.ariaLabel}"]`;
    }

    // 5. Canvas specific
    if (!target.css && desc.tagName === 'canvas') {
      if (desc.ariaLabel) {
        target.css = `canvas[aria-label="${desc.ariaLabel}"]`;
      } else {
        target.css = 'canvas';
      }
    }

    // 6. SVG specific
    if (!target.css && desc.tagName === 'svg') {
      if (desc.ariaLabel) {
        target.css = `svg[aria-label="${desc.ariaLabel}"]`;
      } else if (desc.svgTitle) {
        target.css = `svg:has(title)`;
      } else if (desc.className) {
        const firstCls = desc.className.split(/\s+/)[0];
        if (firstCls && !firstCls.includes(':')) {
          target.css = `svg.${firstCls}`;
        }
      }
      if (!target.css) target.css = 'svg';
    }

    // 7. Iframe specific
    if (!target.css && (desc.tagName === 'iframe' || desc.tagName === 'frame')) {
      if (desc.title) {
        target.css = `iframe[title="${desc.title}"]`;
      } else if (desc.name) {
        target.css = `iframe[name="${desc.name}"]`;
      } else {
        target.css = 'iframe';
      }
    }

    // 8. Named form control
    if (!target.css && desc.name) {
      target.css = `${desc.tagName}[name="${desc.name}"]`;
    }

    // 9. Class-based fallback (combined for specificity)
    if (!target.css && desc.className) {
      const classes = desc.className.split(/\s+/).filter(c => c && !c.includes(':') && !c.includes('/'));
      if (classes.length > 0) {
        const classSelector = classes.slice(0, 2).map(c => `.${c}`).join('');
        target.css = `${desc.tagName}${classSelector}`;
      }
    }

    // Default CSS fallback
    if (!target.css) {
      target.css = defaultCssFallback || desc.tagName;
    }

    // Always attach resilient text & ariaLabel fallbacks
    if (desc.ariaLabel) {
      target.ariaLabel = desc.ariaLabel;
    }
    if (desc.label && desc.label.length >= 2 && desc.label.length <= 45) {
      target.text = desc.label;
    }

    return target;
  }
}
