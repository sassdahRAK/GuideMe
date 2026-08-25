/**
 * Dynamic Page Analyzer & Universal Step Generator (Hybrid Engine Mode 2).
 * Inspects host DOM structure on unscripted pages and synthesizes interactive tutorial flows.
 */

export class DynamicPageAnalyzer {
  /**
   * Analyzes the active webpage DOM and extracts structural component metrics.
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
        inputs: [],
        buttons: [],
        navigation: [],
        searchInputs: [],
        hasPasswordInput: false,
      };
    }

    const title = doc.title || '';
    const forms = Array.from(doc.querySelectorAll('form'));
    const allInputs = Array.from(doc.querySelectorAll('input, select, textarea')).filter((el) => {
      const type = (el.type || '').toLowerCase();
      if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'image') return false;
      const ariaHidden = el.getAttribute ? el.getAttribute('aria-hidden') : null;
      if (ariaHidden === 'true') return false;
      const name = (el.name || '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      if (name.includes('csrf') || name.includes('token') || name.includes('hidden') || id.includes('csrf') || id.includes('token') || id.includes('hidden')) return false;
      return true;
    });
    const buttons = Array.from(doc.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"], a.btn, a[class*="button"]')).filter((btn) => {
      const ariaHidden = btn.getAttribute ? btn.getAttribute('aria-hidden') : null;
      return ariaHidden !== 'true';
    });
    const navElements = Array.from(doc.querySelectorAll('nav, [role="navigation"], header nav, .nav, .menu'));
    
    // Specific element classifications
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
      navElements,
      passwordInputs,
      emailOrUserInputs,
      searchInputs,
      addToCartButtons,
      saveOrSubmitButtons,
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
      emailOrUserInputsCount,
      passwordInputsCount,
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
   * Generates a fully formed, executable declarative tutorial schema for the page.
   * @param {Document} doc
   * @param {string} [url='']
   * @param {string|Object} [userPrompt=''] - Custom user input prompt or JSON schema
   * @returns {Object} JSON Tutorial schema
   */
  static generateDynamicTutorial(doc, url = '', userPrompt = '') {
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

    const analysis = this.analyzePage(doc, url);
    const domain = (() => {
      try {
        return new URL(url || (typeof location !== 'undefined' ? location.href : '')).hostname;
      } catch {
        return 'Webpage';
      }
    })();

    const promptText = (typeof userPrompt === 'string' ? userPrompt.trim() : '');
    const keywords = promptText ? promptText.toLowerCase().split(/[\s,._-]+/).filter(w => w.length >= 2) : [];

    const tutorialId = `dynamic-guide-${Date.now()}`;
    let name = promptText ? `Guide: ${promptText}` : `Interactive Walkthrough: ${domain}`;
    let description = promptText 
      ? `Step-by-step guidance for "${promptText}" on ${domain}.`
      : `Auto-generated walkthrough exploring key workflows on this page.`;

    // 1. If user typed keywords, search for matching DOM elements on the page first
    if (keywords.length > 0) {
      const matchedSteps = [];

      // Find inputs matching keywords
      analysis.allInputs.forEach((input, idx) => {
        const textToMatch = `${input.placeholder || ''} ${input.name || ''} ${input.id || ''} ${input.type || ''} ${input.getAttribute?.('aria-label') || ''}`.toLowerCase();
        const matchesKeyword = keywords.some(kw => textToMatch.includes(kw));
        if (matchesKeyword) {
          const label = input.placeholder || input.name || input.id || `Input field`;
          matchedSteps.push({
            id: `prompt_step_input_${idx}`,
            title: `Enter ${label}`,
            description: `Type information into the ${label} field.`,
            target: this._buildTargetSelector(input, 'input'),
            action: {
              type: 'spotlight',
              title: `Fill ${label}`,
              content: `Type text into this field for "${promptText}".`,
              placement: 'bottom',
            },
            validation: { type: 'input' },
          });
        }
      });

      // Find buttons matching keywords
      analysis.buttons.forEach((btn, idx) => {
        const textToMatch = `${btn.textContent || ''} ${btn.id || ''} ${btn.className || ''} ${btn.getAttribute?.('aria-label') || ''}`.toLowerCase();
        const matchesKeyword = keywords.some(kw => textToMatch.includes(kw));
        if (matchesKeyword) {
          const label = (btn.textContent || '').trim().substring(0, 30) || `Action button`;
          matchedSteps.push({
            id: `prompt_step_btn_${idx}`,
            title: `Click "${label}"`,
            description: `Click this button to execute the action.`,
            target: this._buildTargetSelector(btn, 'button'),
            action: {
              type: 'spotlight',
              title: label,
              content: `Click here as part of "${promptText}".`,
              placement: 'top',
            },
            validation: { type: 'click' },
          });
        }
      });

      if (matchedSteps.length > 0) {
        return {
          id: tutorialId,
          version: '1.0.0',
          name,
          description,
          matchUrls: ['<all_urls>'],
          steps: matchedSteps,
        };
      }
    }

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
          const isPass = input.type === 'password';
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
            validation: { type: isPass ? 'input' : 'input' },
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

        // 2. Interactive action buttons
        const topButtons = analysis.buttons.slice(0, 2);
        topButtons.forEach((btn, idx) => {
          const label = (btn.textContent || '').trim().substring(0, 30) || `Action Button ${idx + 1}`;
          steps.push({
            id: `dynamic_step_btn_${idx}`,
            title: `Explore "${label}"`,
            description: `Primary interactive action on this page.`,
            target: this._buildTargetSelector(btn, 'button'),
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

    // Ensure we always have at least 1 informational fallback step
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
   * Builds resilient multi-strategy target selector definition for a DOM element.
   * @private
   */
  static _buildTargetSelector(el, defaultCssFallback = '') {
    if (!el) return { css: defaultCssFallback || 'body' };

    const target = {};

    if (el.id) {
      target.css = `#${el.id}`;
    } else if (el.className && typeof el.className === 'string') {
      const firstClass = el.className.trim().split(/\s+/)[0];
      if (firstClass && !firstClass.includes(':')) {
        target.css = `${el.tagName.toLowerCase()}.${firstClass}`;
      }
    }

    if (!target.css) {
      target.css = defaultCssFallback || el.tagName.toLowerCase();
    }

    const ariaLabel = el.getAttribute ? el.getAttribute('aria-label') : null;
    if (ariaLabel) {
      target.ariaLabel = ariaLabel;
    }

    const text = el.textContent ? el.textContent.trim().substring(0, 40) : '';
    if (text && text.length >= 2 && text.length <= 30) {
      target.text = text;
    }

    return target;
  }
}
