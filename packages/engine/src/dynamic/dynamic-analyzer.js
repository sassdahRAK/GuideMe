// @ts-check
import { SchemaValidator } from '@guideme/tutorial-schema';
import { safeIdSelector, harvestInteractiveElements } from './dom-harvester.js';
import { matchDomElementWithFuse, synthesizeGroundedTutorial } from './fuse-dom-matcher.js';

export { safeIdSelector, harvestInteractiveElements };

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
    /** @type {HTMLInputElement[]} */
    const allInputs = /** @type {HTMLInputElement[]} */ (Array.from(doc.querySelectorAll('input, select, textarea'))).filter((el) => {
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
   * Generates a dynamic tutorial asynchronously, utilizing LLM / Gemini DOM Intelligence
   * if an API key is available, or seamlessly falling back to prompt-driven selector matching.
   * @param {Document} doc
   * @param {string} [url='']
   * @param {string|Object} [userPrompt='']
   * @param {Object} [options={}]
   * @returns {Promise<Object>}
   */
  static async generateDynamicTutorialAsync(doc, url = '', userPrompt = '', options = {}) {
    const isJsonPrompt = typeof userPrompt === 'string' && userPrompt.trim().startsWith('{');

    // Fast-path: Explicit selector prompt (e.g. 'click #confirm-order-btn')
    if (typeof userPrompt === 'string' && !isJsonPrompt) {
      const explicitSteps = this._extractExplicitSelectors(userPrompt.trim(), doc);
      if (explicitSteps.length > 0) {
        return {
          id: `dynamic-guide-${Date.now()}`,
          version: '1.0.0',
          name: `Guide: ${userPrompt}`,
          description: `Step-by-step guidance for "${userPrompt}".`,
          matchUrls: ['<all_urls>'],
          steps: explicitSteps,
        };
      }
    }

    if (typeof userPrompt === 'string' && userPrompt.trim() && !isJsonPrompt) {
      const provider = (options.provider || 'auto').toLowerCase();
      const geminiKey = options.geminiApiKey || (provider === 'gemini' ? options.apiKey : '');
      const backendUrl = options.backendUrl || '';

      const hasBackendUrl = Boolean(backendUrl && typeof backendUrl === 'string' && backendUrl.trim());
      const hasGeminiKey = Boolean(
        (geminiKey && typeof geminiKey === 'string' && geminiKey.trim()) ||
        (options.apiKey && typeof options.apiKey === 'string' && options.apiKey.trim() && provider === 'gemini')
      );

      // 1. Primary: GuideMe Backend AI Proxy (OpenRouter / Gemini Pool)
      if (hasBackendUrl) {
        try {
          const proxyEndpoint = `${backendUrl.replace(/\/$/, '')}/api/ai/dom-guide`;
          const fetchFn = options.fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
          if (fetchFn) {
            const candidates = harvestInteractiveElements(doc, options);
            const serializableCandidates = candidates.map(({ element, ...rest }) => rest);
            const proxyRes = await fetchFn(proxyEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: userPrompt,
                elements: serializableCandidates,
                url,
                language: options.language || 'km',
              }),
            });
            if (proxyRes.ok) {
              const aiTutorial = await proxyRes.json();
              if (aiTutorial && Array.isArray(aiTutorial.steps) && aiTutorial.steps.length > 0) {
                return aiTutorial;
              }
            }
          }
        } catch (err) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[DynamicPageAnalyzer] Backend AI proxy analysis fallback:', err.message);
          }
        }
      }

      // 2. Client-Side Gemini API Walkthrough Generator
      if (hasGeminiKey) {
        try {
          const effectiveGeminiKey = (geminiKey && geminiKey.trim()) || (options.apiKey && options.apiKey.trim());
          const aiTutorial = await this.analyzeWithGemini({
            prompt: userPrompt,
            doc,
            url,
            apiKey: effectiveGeminiKey,
            model: options.geminiModel || options.model || 'gemini-3.6-flash',
            language: options.language || 'km',
            fetchFn: options.fetchFn,
          });
          if (aiTutorial && Array.isArray(aiTutorial.steps) && aiTutorial.steps.length > 0) {
            return aiTutorial;
          }
        } catch (err) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[DynamicPageAnalyzer] Gemini DOM analysis fallback:', err.message);
          }
        }
      }
    }

    // 3. Fallback: Zero-Hallucination Fuse.js Grounded DOM Matching (for simple 1-step actions or offline mode)
    let intent = options.intent || (typeof userPrompt === 'object' && userPrompt !== null && !Array.isArray(userPrompt) ? userPrompt : null);
    if (!intent && typeof userPrompt === 'string' && userPrompt.trim() && !isJsonPrompt) {
      intent = this.extractIntentFromText(userPrompt);
    }

    if (intent && (intent.targetQuery || intent.action)) {
      const candidates = harvestInteractiveElements(doc, { targetQuery: intent.targetQuery, ...options });
      const matched = matchDomElementWithFuse(candidates, intent, options);
      if (matched) {
        return synthesizeGroundedTutorial(matched, intent, options);
      }
    }
    return this.generateDynamicTutorial(doc, url, userPrompt, options);
  }

  /**
   * Deterministically extracts structured intent from user prompt text for zero-hallucination Fuse.js DOM matching.
   * @param {string} text
   * @returns {Object|null}
   */
  static extractIntentFromText(text) {
    if (!text || typeof text !== 'string') return null;
    const clean = text.toLowerCase();

    // Requests requiring multi-level menu navigation (e.g. File → Page Setup) must bypass
    // the single-step Fuse path. Returning null routes them to the AI analyzers which
    // now know to produce a separate step per menu level.
    if (/page\s*setup|paper\s*size|margin|orientation|a4|a3|landscape|portrait|paragraph\s*style|line\s*spacing/.test(clean)) {
      return null;
    }

    if (/\b(share|collaborat|invite|distribut|broadcast|publish|ចែករំលែក|អញ្ជើញ|ផ្សព្វផ្សាយ)\b/i.test(clean)) {
      return { targetQuery: 'Share', action: 'click', role: 'button', category: 'share' };
    }
    if (/\b(search|find|lookup|query|explore|browse|filter|sort|ស្វែងរក|រក|ច្រោះ|ជ្រើស)\b/i.test(clean)) {
      return { targetQuery: 'Search', action: 'input', role: 'input', category: 'search' };
    }
    if (/\b(login|log\s*in|sign\s*in|signin|register|signup|sign\s*up|auth|sso|ចូល|ចុះឈ្មោះ|ចូលប្រើ)\b/i.test(clean)) {
      return { targetQuery: 'Sign In', action: 'click', role: 'button', category: 'auth' };
    }
    if (/\b(settings|setting|config|prefer|preference|option|profile|account|custom|ការកំណត់|គណនី|ប្រវត្តិរូប)\b/i.test(clean)) {
      return { targetQuery: 'Settings', action: 'click', role: 'button', category: 'navigation' };
    }
    if (/\b(export|download|save|print|backup|dump|sync|ទាញយក|រក្សាទុក|បោះពុម្ព)\b/i.test(clean)) {
      return { targetQuery: 'Export', action: 'click', role: 'button', category: 'general' };
    }
    if (/\b(new|create|add|plus|make|compose|upload|post|insert|បង្កើត|បន្ថែម|សរសេរ|បង្ហោះ)\b/i.test(clean)) {
      return { targetQuery: 'New', action: 'click', role: 'button', category: 'general' };
    }

    const stripped = clean
      .replace(/^(yes\s+)?(please\s+)?(help\s+me\s+)?(to\s+)?(get\s+the\s+link\s+to\s+)?(how\s+to\s+)?(can\s+you\s+)?(show\s+me\s+)?(click\s+)?(open\s+)?(find\s+)?/i, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim();
    const words = stripped.split(/\s+/).filter(w => w.length >= 3);
    if (words.length > 0) {
      return {
        targetQuery: words[0].charAt(0).toUpperCase() + words[0].slice(1),
        action: 'click',
        role: 'button',
        category: 'general',
      };
    }

    return null;
  }

  /**
   * Generates a fully formed, executable declarative tutorial schema for the page.
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
        // Fallback to prompt matching
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
    const tutorialId = `dynamic-guide-${Date.now()}`;
    let name = promptText ? `Guide: ${promptText}` : `Interactive Walkthrough: ${domain}`;
    let description = promptText
      ? `Step-by-step guidance for "${promptText}" on ${domain}.`
      : `Auto-generated walkthrough exploring key workflows on this page.`;

    // 1. Explicit CSS Selector & Target Sequence Matching
    // Check if user prompt specifies selectors (e.g. '#search', '.btn-buy', 'input[name="email"]')
    if (promptText) {
      const explicitSteps = this._extractExplicitSelectors(promptText, doc);
      if (explicitSteps.length > 0) {
        return {
          id: tutorialId,
          version: '1.0.0',
          name,
          description,
          matchUrls: ['<all_urls>'],
          steps: explicitSteps,
        };
      }
    }

    // 2. Universal Intent & Precision Semantic DOM Intelligence (Scored, Action-Aligned, Localized, Max 1-4 Steps)
    const STOP_WORDS = new Set([
      'ok', 'okay', 'help', 'me', 'the', 'a', 'an', 'to', 'my', 'your', 'his', 'her', 'their', 'friend', 'so',
      'he', 'she', 'it', 'too', 'also', 'please', 'i', 'want', 'need', 'this', 'that', 'these', 'those', 'show',
      'how', 'on', 'in', 'at', 'for', 'with', 'and', 'or', 'is', 'are', 'am', 'be', 'do', 'does', 'did', 'can',
      'could', 'would', 'should', 'of', 'from', 'by', 'about', 'as', 'into', 'like', 'through', 'after', 'before',
      'what', 'why', 'who', 'where', 'when', 'will', 'ask', 'tell', 'guide', 'doc', 'document', 'page', 'site',
      'click', 'open', 'go', 'navigate', 'press', 'tap', 'button', 'input', 'field', 'screen',
      // Khmer stop words
      'ជួយ', 'ខ្ញុំ', 'សូម', 'ទៅ', 'លើ', 'ក្នុង', 'នៅ', 'សម្រាប់', 'ជាមួយ', 'និង', 'ឬ', 'ជា', 'មាន', 'ធ្វើ', 'អាច',
      'នេះ', 'នោះ', 'ឯកសារ', 'ទំព័រ', 'ប៊ូតុង'
    ]);

    const activeLang = options.language || 'km';
    const rawTokens = promptText ? promptText.toLowerCase().split(/[\s,._\-\/]+/).filter(w => w.length >= 2) : [];
    const meaningfulKeywords = rawTokens.filter(w => !STOP_WORDS.has(w));
    const searchKeywords = meaningfulKeywords.length > 0 ? meaningfulKeywords : rawTokens.filter(w => w.length >= 3);

    // Universal Action Intent Matrix (Multi-lingual: English + Khmer)
    const INTENTS = [
      { id: 'share', regex: /\b(share|collaborat|invite|distribut|broadcast|publish|ចែករំលែក|អញ្ជើញ|ផ្សព្វផ្សាយ)\b/i, weight: 320, keywords: ['share', 'invite', 'collaborate', 'ចែករំលែក', 'send'] },
      { id: 'login', regex: /\b(login|log\s*in|sign\s*in|signin|register|signup|sign\s*up|auth|sso|ចូល|ចុះឈ្មោះ|ចូលប្រើ)\b/i, weight: 300, keywords: ['login', 'signin', 'sign in', 'log in', 'register', 'auth', 'ចូល'] },
      { id: 'logout', regex: /\b(logout|log\s*out|sign\s*out|signout|exit|ចាកចេញ)\b/i, weight: 280, keywords: ['logout', 'signout', 'exit', 'ចាកចេញ'] },
      { id: 'search', regex: /\b(search|find|lookup|query|explore|browse|filter|sort|ស្វែងរក|រក|ច្រោះ|ជ្រើស)\b/i, weight: 290, keywords: ['search', 'find', 'query', 'filter', 'sort', 'ស្វែងរក', 'រក'], preferInput: true },
      { id: 'cart', regex: /\b(cart|basket|bag|buy|purchase|checkout|order|pay|payment|bill|subscribe|កន្ត្រក|ទិញ|កុម្ម៉ង់|បង់ប្រាក់)\b/i, weight: 300, keywords: ['cart', 'buy', 'checkout', 'order', 'pay', 'purchase', 'ទិញ', 'កន្ត្រក'] },
      { id: 'settings', regex: /\b(settings|setting|config|prefer|preference|option|profile|account|custom|ការកំណត់|គណនី|ប្រវត្តិរូប)\b/i, weight: 260, keywords: ['setting', 'config', 'profile', 'account', 'preference', 'ការកំណត់', 'គណនី'] },
      { id: 'export', regex: /\b(export|download|save|print|backup|dump|sync|ទាញយក|រក្សាទុក|បោះពុម្ព)\b/i, weight: 280, keywords: ['export', 'download', 'save', 'print', 'ទាញយក', 'រក្សាទុក'] },
      { id: 'new', regex: /\b(new|create|add|plus|make|compose|upload|post|insert|បង្កើត|បន្ថែម|សរសេរ|បង្ហោះ)\b/i, weight: 270, keywords: ['new', 'create', 'add', '+', 'compose', 'upload', 'post', 'បង្កើត', 'បន្ថែម'] },
      { id: 'edit', regex: /\b(edit|rename|modify|change|update|revise|draft|កែសម្រួល|ប្តូរឈ្មោះ|ផ្លាស់ប្តូរ|ធ្វើបច្ចុប្បន្នភាព)\b/i, weight: 250, keywords: ['edit', 'rename', 'modify', 'update', 'កែសម្រួល', 'ប្តូរឈ្មោះ'] },
      { id: 'delete', regex: /\b(delete|remove|clear|trash|destroy|discard|cancel|dismiss|លុប|ដកចេញ|បោះបង់)\b/i, weight: 280, keywords: ['delete', 'remove', 'trash', 'cancel', 'clear', 'លុប', 'បោះបង់'] },
      { id: 'navigation', regex: /\b(home|menu|nav|navigation|dashboard|tab|feed|overview|ទំព័រដើម|ម៉ឺនុយ|ផ្ទាំងគ្រប់គ្រង)\b/i, weight: 240, keywords: ['home', 'menu', 'dashboard', 'overview', 'feed', 'ទំព័រដើម', 'ម៉ឺនុយ'] },
      { id: 'help', regex: /\b(help|support|docs|faq|guide|tutorial|feedback|assist|ជំនួយ|ឯកសារ|មតិកែលម្អ)\b/i, weight: 240, keywords: ['help', 'support', 'docs', 'faq', 'guide', 'ជំនួយ'] },
      { id: 'notifications', regex: /\b(notif|alert|bell|inbox|message|chat|ការជូនដំណឹង|សារ)\b/i, weight: 260, keywords: ['notification', 'alert', 'inbox', 'message', 'bell', 'ការជូនដំណឹង', 'សារ'] },
    ];

    const matchedIntents = INTENTS.filter(intent => intent.regex.test(promptText));
    const isTypingAction = /\b(type|fill|enter|input|write|search|វាយ|បំពេញ|សរសេរ)\b/i.test(promptText);
    const isClickAction = /\b(click|press|open|tap|select|choose|go\s*to|ចុច|បើក|ជ្រើសរើស)\b/i.test(promptText);

    if (searchKeywords.length > 0 || matchedIntents.length > 0) {
      // 0. Hover-triggered Element Resolution: dispatch synthetic hover before matching
      const hoverRevealedMap = this._resolveHoverFlyouts(doc, searchKeywords, matchedIntents);

      const candidates = [];
      const seenElements = new Set();

      const scoreAndAdd = (el, type) => {
        if (!el || seenElements.has(el)) return;

        const isHoverRevealed = hoverRevealedMap.has(el);

        // 1. Strict Visibility & Interactability check
        if (!this._isInteractable(el, { isHoverRevealed })) return;

        // Exclude site brand logos and home navigation buttons when user is requesting an in-app action
        const isNavLogo = /docs-homescreen|docs\s*home|brand|logo|app-launcher/i.test(
          `${el.className || ''} ${el.getAttribute?.('aria-label') || ''} ${el.id || ''}`
        );
        if (isNavLogo && !/home|logo|ទំព័រដើម/i.test(promptText)) {
          return;
        }

        const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
        const aria = (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || '').trim();
        const id = (el.id || '').trim();
        const testId = (el.getAttribute?.('data-testid') || el.getAttribute?.('data-cy') || el.getAttribute?.('data-tooltip') || '').trim();
        const placeholder = (el.placeholder || el.name || '').trim();
        const role = (el.getAttribute?.('role') || '').trim().toLowerCase();

        const fullStr = `${text} ${aria} ${id} ${testId} ${placeholder} ${role}`.toLowerCase();
        let score = 0;
        let primaryIntentId = null;

        // 2. Universal Intent Match
        for (const intent of matchedIntents) {
          for (const kw of intent.keywords) {
            const kwLower = kw.toLowerCase();
            if (text.toLowerCase() === kwLower || aria.toLowerCase() === kwLower) {
              score += intent.weight;
              primaryIntentId = intent.id;
            } else if (text.toLowerCase().startsWith(kwLower) || aria.toLowerCase().startsWith(kwLower)) {
              score += intent.weight * 0.8;
              primaryIntentId = primaryIntentId || intent.id;
            } else if (fullStr.includes(kwLower)) {
              score += intent.weight * 0.55;
              primaryIntentId = primaryIntentId || intent.id;
            }
          }
          if (intent.preferInput && type === 'input') {
            score += 50;
          }
        }

        // 3. Specific Keyword Overlap Match
        for (const kw of searchKeywords) {
          const kwLower = kw.toLowerCase();
          if (text.toLowerCase() === kwLower || aria.toLowerCase() === kwLower) {
            score += 150;
          } else if (text.toLowerCase().includes(kwLower) || aria.toLowerCase().includes(kwLower)) {
            score += 80;
          } else if (id.toLowerCase().includes(kwLower) || placeholder.toLowerCase().includes(kwLower) || testId.toLowerCase().includes(kwLower)) {
            score += 45;
          }
        }

        // 4. Action Verb & Control Affinity
        if (isTypingAction && type === 'input') score += 60;
        if (isClickAction && type === 'button') score += 40;

        // Actionable control bonuses
        if (type === 'button' && (text || aria || testId)) score += 30;
        if (type === 'input' && (placeholder || aria || id || testId)) score += 20;

        // Flyout item affinity bonus (user specifically requested menu item action)
        if (isHoverRevealed) score += 60;

        // 5. Large text walls and body container penalties
        if (text.length > 50) score -= 45;
        if (text.length > 120) score -= 90;

        // 6. Context-Aware Proximity / Spatial Score (Modals, Dropdowns, Layout, Reference elements)
        if (score > 10) {
           const ctxScore = this._calculateContextScore(el, primaryIntentId, {
             doc,
             previousElement: options.previousElement || null,
           });
           score += ctxScore;
        }

        if (score >= 40) {
          seenElements.add(el);
          const rawLabel = aria.substring(0, 30) || text.substring(0, 30) || placeholder || testId || id || (type === 'button' ? 'Action' : 'Input');
          const cleanLabel = rawLabel.replace(/\s+/g, ' ').trim();
          candidates.push({
            el,
            type,
            score,
            label: cleanLabel,
            hoverTrigger: hoverRevealedMap.get(el) || null,
          });
        }
      };

      // Scan all interactive controls on the page (Universal for all frameworks)
      analysis.buttons.forEach((btn) => scoreAndAdd(btn, 'button'));
      analysis.allInputs.forEach((input) => scoreAndAdd(input, 'input'));
      const linksAndActionables = this._safeQueryAll(doc, 'a[href], [role="button"], [role="tab"], [role="menuitem"], [role="link"], summary');
      linksAndActionables.forEach((link) => scoreAndAdd(link, 'button'));

      // If hover revealed any elements that weren't caught in query, add them directly
      for (const [revealedEl] of hoverRevealedMap) {
        scoreAndAdd(revealedEl, (revealedEl.tagName || '').toLowerCase() === 'input' ? 'input' : 'button');
      }

      // Sort candidates by score descending
      candidates.sort((a, b) => b.score - a.score);

      // --- Sequence Locality Clustering & Deduplication ---
      let topCandidates = [];
      if (candidates.length > 0) {
        // Start with the absolute best candidate (The Anchor)
        const anchor = candidates[0];
        topCandidates.push(anchor);
        
        // Find common ancestor among top candidates to cluster steps
        const findDeepAncestor = (node, levels = 4) => {
          if (!node) return null;
          let current = node.parentElement;
          let d = 0;
          while (current && d < levels) {
             const tag = (current.tagName || '').toLowerCase();
             if (tag === 'form' || tag === 'fieldset' || tag === 'dialog' || (typeof current.className === 'string' && (current.className.includes('card') || current.className.includes('modal')))) {
                return current;
             }
             current = current.parentElement;
             d++;
          }
          return node.parentElement;
        };

        const anchorParent = findDeepAncestor(anchor.el, 5);

        // Score remaining top 10 candidates based on locality to anchor and dedup labels
        const seenLabels = new Set([`${anchor.type}-${anchor.label}`]);
        
        for (let i = 1; i < Math.min(candidates.length, 10); i++) {
          if (topCandidates.length >= 3) break; // Take max 3 steps
          
          const cand = candidates[i];
          const labelKey = `${cand.type}-${cand.label}`;
          
          // Only add if it's not identically labeled to a previous step (prevents 3 "Click Share" steps)
          if (!seenLabels.has(labelKey)) {
            const prevCand = topCandidates[topCandidates.length - 1];

            // 1. Locality boost for sharing an ancestor with the anchor or previous step
            if (anchorParent && cand.el && typeof anchorParent.contains === 'function' && anchorParent.contains(cand.el)) {
              cand.score += 50; 
            }
            if (prevCand?.el?.closest && cand.el?.closest) {
              const prevContainer = prevCand.el.closest('form, dialog, [role="dialog"], .card, section, fieldset');
              if (prevContainer && cand.el.closest('form, dialog, [role="dialog"], .card, section, fieldset') === prevContainer) {
                cand.score += 70;
              }
            }

            // 2. Geometric coordinate proximity to the previous step
            if (prevCand?.el && typeof cand.el.getBoundingClientRect === 'function' && typeof prevCand.el.getBoundingClientRect === 'function') {
              try {
                const r1 = cand.el.getBoundingClientRect();
                const r2 = prevCand.el.getBoundingClientRect();
                if (r1 && r2 && (r1.width > 0 || r1.height > 0) && (r2.width > 0 || r2.height > 0)) {
                  const c1 = { x: (r1.left || r1.x || 0) + (r1.width || 0) / 2, y: (r1.top || r1.y || 0) + (r1.height || 0) / 2 };
                  const c2 = { x: (r2.left || r2.x || 0) + (r2.width || 0) / 2, y: (r2.top || r2.y || 0) + (r2.height || 0) / 2 };
                  const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
                  if (dist < 200) {
                    cand.score += 80;
                  } else if (dist < 400) {
                    cand.score += 40;
                  } else if (dist > 1000) {
                    cand.score -= 30;
                  }
                }
              } catch {}
            }

            topCandidates.push(cand);
            seenLabels.add(labelKey);
          }
        }
        
        // Re-sort the final selection in case locality changed the order
        topCandidates.sort((a, b) => b.score - a.score);
      }

      if (topCandidates.length > 0) {
        const isKm = activeLang === 'km';
        const matchedSteps = topCandidates.map((cand, idx) => {
          const isBtn = cand.type === 'button';
          let stepTitle;
          let stepContent;

          if (isKm) {
            stepTitle = isBtn ? `ចុច "${cand.label}"` : `បញ្ចូល ${cand.label}`;
            stepContent = isBtn
              ? `សូមចុចលើ "${cand.label}" ដែលបានសម្គាល់លើអេក្រង់ដើម្បីបន្ត។`
              : `សូមបំពេញព័ត៌មានក្នុងប្រអប់ ${cand.label}។`;
          } else {
            stepTitle = isBtn ? `Click "${cand.label}"` : `Enter ${cand.label}`;
            stepContent = isBtn
              ? `Click on the highlighted "${cand.label}" button to proceed.`
              : `Fill in the ${cand.label} field.`;
          }

          return {
            id: `prompt_step_${cand.type}_${idx + 1}`,
            title: stepTitle,
            description: `Step ${idx + 1}: ${stepTitle}`,
            target: this._buildTargetSelector(
              cand.el,
              isBtn ? 'button, [role="button"], a' : 'input, textarea',
              { hoverTrigger: cand.hoverTrigger }
            ),
            action: {
              type: 'spotlight',
              title: stepTitle,
              content: stepContent,
              placement: isBtn ? 'top' : 'bottom',
            },
            validation: { type: isBtn ? 'click' : 'input' },
          };
        });

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
   * Helper to safely query elements from a document.
   * @private
   */
  static _safeQueryAll(doc, selector) {
    if (!doc || typeof doc.querySelectorAll !== 'function' || !selector) return [];
    try {
      const res = doc.querySelectorAll(selector);
      return res ? Array.from(res) : [];
    } catch {
      return [];
    }
  }

  /**
   * Checks if an element is strictly visible and interactable.
   * Drops ghost elements, disabled inputs, and zero-dimensional nodes.
   * @param {HTMLElement} el
   * @param {Object} [options={}]
   * @param {boolean} [options.isHoverRevealed=false]
   * @returns {boolean}
   * @private
   */
  static _isInteractable(el, options = {}) {
    if (!el) return false;

    // 1. Semantic disabled states
    const formElement = /** @type {HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} */ (el);
    if (formElement.disabled || el.getAttribute?.('aria-disabled') === 'true') {
      return false;
    }

    // 2. Semantic hidden states
    if (el.getAttribute?.('aria-hidden') === 'true') {
      return false;
    }

    // If element was revealed via synthetic hover trigger, bypass zero-size or transient hidden classes
    if (options.isHoverRevealed) {
      return true;
    }

    // 3. CSS Classes common for hiding elements
    const className = (typeof el.className === 'string'
      ? el.className
      : typeof SVGElement !== 'undefined' && el instanceof SVGElement
        ? el.className.baseVal
        : ''
    ).toLowerCase();
    if (className.includes('hidden') || className.includes('invisible') || className.includes('d-none') || className.includes('opacity-0')) {
      return false;
    }

    // 4. Bounding Client Rect (if layout is available)
    if (typeof el.getBoundingClientRect === 'function') {
      const rect = el.getBoundingClientRect();
      if (rect && rect.width === 0 && rect.height === 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Dispatches synthetic pointerenter, pointerover, mouseover, and mouseenter events
   * to trigger flyouts and dropdowns before matching.
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
        element.dispatchEvent(new Event('mouseover', { bubbles: true }));
        element.dispatchEvent(new Event('mouseenter', { bubbles: false }));
      }

      if (typeof FocusEvent !== 'undefined') {
        element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      }
    } catch {}
  }

  /**
   * Locates the parent trigger element for an item located inside a flyout/dropdown menu.
   * @param {HTMLElement} el
   * @returns {Element|null}
   * @private
   */
  static _findParentHoverTrigger(el) {
    if (!el || !el.parentElement) return null;

    let current = el.parentElement;
    let depth = 0;

    while (current && depth < 6) {
      const tag = (current.tagName || '').toLowerCase();
      const role = (current.getAttribute?.('role') || '').toLowerCase();
      const className = (typeof current.className === 'string'
        ? current.className
        : typeof SVGElement !== 'undefined' && current instanceof SVGElement
          ? current.className.baseVal
          : ''
      ).toLowerCase();

      const isMenuContainer = (
        role === 'menu' ||
        role === 'menubar' ||
        className.includes('dropdown-menu') ||
        className.includes('flyout') ||
        className.includes('sub-menu') ||
        className.includes('submenu') ||
        tag === 'ul' ||
        tag === 'ol'
      );

      if (isMenuContainer) {
        // 1. Preceding sibling trigger
        const prev = current.previousElementSibling;
        if (prev) {
          if (prev.matches?.('button, a, [role="button"], [aria-haspopup]')) {
            return prev;
          }
          const nestedTrigger = prev.querySelector?.('button, a, [role="button"], [aria-haspopup]');
          if (nestedTrigger) return nestedTrigger;
        }

        // 2. Parent's own trigger
        const parent = current.parentElement;
        if (parent) {
          try {
            const directTrigger = parent.querySelector?.(':scope > button, :scope > a, :scope > [role="button"], :scope > [aria-haspopup]');
            if (directTrigger && directTrigger !== el) return directTrigger;
          } catch {}

          try {
            const anyTrigger = parent.querySelector?.('[aria-haspopup="true"], [aria-haspopup="menu"], [data-toggle="dropdown"], .dropdown-toggle');
            if (anyTrigger && anyTrigger !== el) return anyTrigger;
          } catch {}

          if (parent.children) {
            const childTrigger = Array.from(parent.children).find((c) => c !== current && c !== el && c.matches?.('button, a, [role="button"], [aria-haspopup]'));
            if (childTrigger) return childTrigger;
          }
        }
      }

      // Check if current itself has aria-haspopup or dropdown class
      if (current.getAttribute?.('aria-haspopup') || className.includes('has-dropdown') || className.includes('menu-item-has-children')) {
        const trigger = current.matches?.('button, a, [role="button"]') ? current : current.querySelector?.('button, a, [role="button"]');
        if (trigger && trigger !== el) return trigger;
      }

      current = current.parentElement;
      depth++;
    }

    return null;
  }

  /**
   * Inspects potential flyout/dropdown menu candidates. If any match user keywords
   * or intents, dispatches synthetic pointerenter/mouseover events to its parent trigger
   * to reveal it before matching.
   * @param {Document} doc
   * @param {string[]} searchKeywords
   * @param {Object[]} matchedIntents
   * @returns {Map<HTMLElement, HTMLElement>} Map of revealed element -> parent hover trigger
   * @private
   */
  static _resolveHoverFlyouts(doc, searchKeywords = [], matchedIntents = []) {
    const revealedMap = new Map();
    if (!doc || typeof doc.querySelectorAll !== 'function') return revealedMap;

    const potentialMenuItems = this._safeQueryAll(doc, [
      '[role="menuitem"]',
      '.dropdown-item',
      '.menu-item a',
      '.menu-item button',
      '.dropdown-menu a',
      '.dropdown-menu button',
      'nav ul ul a',
      'nav ul ul button',
      'header ul ul a',
      'header ul ul button',
      '[aria-expanded="false"] + * [role="menuitem"]',
      '[aria-haspopup] + * a',
      '[aria-haspopup] + * button',
    ].join(', '));

    for (const item of potentialMenuItems) {
      const text = (item.textContent || '').toLowerCase();
      const aria = (item.getAttribute?.('aria-label') || item.getAttribute?.('title') || '').toLowerCase();
      const id = (item.id || '').toLowerCase();
      const itemStr = `${text} ${aria} ${id}`;

      let matches = false;

      for (const kw of searchKeywords) {
        if (kw && itemStr.includes(kw.toLowerCase())) {
          matches = true;
          break;
        }
      }

      if (!matches) {
        for (const intent of matchedIntents) {
          for (const kw of intent.keywords) {
            if (itemStr.includes(kw.toLowerCase())) {
              matches = true;
              break;
            }
          }
          if (matches) break;
        }
      }

      if (matches) {
        const trigger = /** @type {HTMLElement|null} */ (this._findParentHoverTrigger(item));
        if (trigger) {
          this.dispatchHoverEvents(trigger);
          revealedMap.set(item, trigger);
        }
      }
    }

    return revealedMap;
  }

  /**
   * Evaluates the contextual primacy and spatial proximity of the element within the page layout.
   * Heavily prioritizes active overlays/modals, main containers, and elements near the previous step.
   * Disambiguates duplicate elements sharing identical labels.
   * @param {HTMLElement} el
   * @param {string|null} intentId
   * @param {Object} [options={}]
   * @param {Document} [options.doc]
   * @param {HTMLElement|null} [options.previousElement]
   * @returns {number} Context score modifier
   * @private
   */
  static _calculateContextScore(el, intentId, options = {}) {
    let score = 0;
    let current = el;
    let depth = 0;
    let hasModal = false;
    let isInModal = false;

    // Check global modal existence on the document
    const doc = el.ownerDocument || options.doc;
    let anyModalOpen = null;
    if (doc) {
      if (typeof doc.querySelector === 'function') {
        try {
          anyModalOpen = doc.querySelector(
            'dialog[open], [role="dialog"][aria-modal="true"], [role="dialog"]:not([aria-hidden="true"]), [role="alertdialog"], .modal.show, .modal.active, [aria-modal="true"]'
          );
        } catch {}
      } else if (typeof doc.querySelectorAll === 'function') {
        try {
          const list = doc.querySelectorAll('dialog[open], [role="dialog"], .modal.show, .modal.active, [aria-modal="true"]');
          anyModalOpen = list?.[0] || null;
        } catch {}
      }
      hasModal = !!anyModalOpen;
    }

    while (current && depth < 8) {
      const tag = (current.tagName || '').toLowerCase();
      const role = (current.getAttribute?.('role') || '').toLowerCase();
      const ariaExpanded = current.getAttribute?.('aria-expanded');
      const ariaModal = current.getAttribute?.('aria-modal');
      const className = (typeof current.className === 'string'
        ? current.className
        : typeof SVGElement !== 'undefined' && current instanceof SVGElement
          ? current.className.baseVal
          : ''
      ).toLowerCase();

      // 1. Modals & Dialogs (The Active Layer)
      if (tag === 'dialog' || role === 'dialog' || role === 'alertdialog' || className.includes('modal') || ariaModal === 'true') {
        score += 300;
        isInModal = true;
        hasModal = false; // We are inside the modal, so cancel background penalty
      }

      // 2. Transient Hover/Click Menus (Dropdowns)
      if (ariaExpanded === 'true' || role === 'menu' || role === 'listbox' || className.includes('dropdown-menu') || className.includes('popover') || className.includes('tippy-box')) {
        score += 150;
      }

      // 3. Layout Primacy: Main Content Container priority
      if (tag === 'main' || current.id === 'main-content' || current.id === 'content' || className.includes('main')) {
        score += 80;
      } else if (tag === 'footer' || tag === 'aside' || className.includes('sidebar')) {
        // Penalty unless user specifically asked for navigation/settings which often reside in footers/sidebars
        if (intentId !== 'navigation' && intentId !== 'settings' && intentId !== 'help') {
          score -= 60;
        }
      } else if (tag === 'header' || tag === 'nav') {
        if (intentId !== 'navigation' && intentId !== 'search' && intentId !== 'login') {
          score -= 50; // Penalize standard actions in header
        }
      }

      // 4. Repetitive List structures
      if (tag === 'li' || tag === 'tr') {
        score -= 20; // Slight penalty to avoid picking random list items over page-level buttons
      }

      current = current.parentElement;
      depth++;
    }

    // If an active modal is open on the page and this element is NOT in it, heavily penalize it
    if (hasModal && !isInModal) {
      score -= 250;
    }

    // 5. Spatial & Visual Proximity Scoring relative to Previous Step / Reference element
    const prevEl = options.previousElement;
    if (prevEl && prevEl !== el) {
      // Shared container bonus (same form, dialog, card, or fieldset)
      if (typeof prevEl.closest === 'function' && typeof el.closest === 'function') {
        try {
          const container = el.closest('form, dialog, .modal, [role="dialog"], .card, fieldset, section');
          if (container && prevEl.closest('form, dialog, .modal, [role="dialog"], .card, fieldset, section') === container) {
            score += 90;
          }
        } catch {}
      }

      // Geometric Euclidean coordinate proximity
      if (typeof el.getBoundingClientRect === 'function' && typeof prevEl.getBoundingClientRect === 'function') {
        try {
          const r1 = el.getBoundingClientRect();
          const r2 = prevEl.getBoundingClientRect();
          if (r1 && r2 && (r1.width > 0 || r1.height > 0) && (r2.width > 0 || r2.height > 0)) {
            const c1 = { x: (r1.left || r1.x || 0) + (r1.width || 0) / 2, y: (r1.top || r1.y || 0) + (r1.height || 0) / 2 };
            const c2 = { x: (r2.left || r2.x || 0) + (r2.width || 0) / 2, y: (r2.top || r2.y || 0) + (r2.height || 0) / 2 };
            const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
            if (dist < 200) {
              score += 100; // Right next to previous element
            } else if (dist < 450) {
              score += 60;  // Same visual section
            } else if (dist < 750) {
              score += 20;
            } else if (dist > 1200) {
              score -= 40;  // Distant outlier
            }
          }
        } catch {}
      }
    }

    return score;
  }

  /**
   * Extracts explicit CSS selectors from user prompt.
   * Supports:
   * - Direct selectors: "#submit-btn", ".search-box", "input[name='q']", "button.primary"
   * - Multiple chained targets: "#email, #password, #login-btn" or "step 1: #cart -> step 2: #checkout"
   * - Action directives: "click #save", "type admin in #username", "select #role"
   * @private
   */
  static _extractExplicitSelectors(promptText, doc) {
    if (!promptText || typeof promptText !== 'string') return [];

    // Split multi-step chains
    const segments = promptText.split(/(?:,|->|=>|;|\n|\bstep\s*\d+\s*:)/i).map(s => s.trim()).filter(Boolean);
    const matched = [];
    const seenElements = new Set();

    // Regex matching potential CSS selector syntax: #id, .class, [attr], tag#id, tag.class, tag[attr]
    const selectorRegex = /(?:[#.]|\[[a-zA-Z0-9_-]+|[a-zA-Z0-9_-]+[#.[])[a-zA-Z0-9_\-.:=^$*"'\][]+/g;

    for (const segment of segments) {
      const candidateSelectors = [];

      // Clean leading verbs (e.g. "click #btn" -> "#btn")
      const stripped = segment.replace(/^(click|type|enter|fill|select|hover|inspect|check|find|show)\s+(?:on\s+|in\s+|at\s+)?/i, '').trim();

      if (stripped.startsWith('#') || stripped.startsWith('.') || stripped.startsWith('[') || /^[a-zA-Z0-9_-]+[#.[]/.test(stripped)) {
        // Remove trailing arguments like 'with "text"' or 'and submit'
        const cleanSel = stripped.split(/\s+(?:with|as|and|using)\s+/i)[0].trim();
        if (cleanSel) candidateSelectors.push(cleanSel);
      }

      // Also extract any regex selector tokens found inside the segment
      const tokenMatches = segment.match(selectorRegex);
      if (tokenMatches) {
        for (const token of tokenMatches) {
          candidateSelectors.push(token);
        }
      }

      const uniqueCandidates = Array.from(new Set(candidateSelectors));

      for (const sel of uniqueCandidates) {
        const els = this._safeQueryAll(doc, sel);
        for (const el of els) {
          if (!seenElements.has(el)) {
            seenElements.add(el);

            const segLower = segment.toLowerCase();
            const tag = (el.tagName || '').toLowerCase();
            const isInput = tag === 'input' || tag === 'textarea';
            const isSelect = tag === 'select';
            const isClickable = tag === 'button' || tag === 'a' || (el.getAttribute && el.getAttribute('role') === 'button');

            let valType = 'click';
            let actionText = 'Click this element';
            let actionTitle = 'Click Action';
            if (segLower.includes('type') || segLower.includes('fill') || segLower.includes('enter') || isInput) {
              valType = 'input';
              actionText = 'Type information into this field';
              actionTitle = 'Input Field';
            } else if (isSelect || segLower.includes('select')) {
              valType = 'change';
              actionText = 'Select an option from this dropdown';
              actionTitle = 'Select Option';
            } else if (isClickable || segLower.includes('click')) {
              valType = 'click';
              actionText = 'Click to proceed';
              actionTitle = 'Action Button';
            } else if (segLower.includes('submit') || tag === 'form') {
              valType = 'submit';
              actionText = 'Submit this form';
              actionTitle = 'Submit';
            }

            const label = el.id || (el.getAttribute ? el.getAttribute('data-testid') : '') || el.name || el.placeholder || (el.textContent ? el.textContent.trim().substring(0, 25) : '') || sel;

            matched.push({
              id: `prompt_step_sel_${matched.length + 1}`,
              title: valType === 'input' ? `Enter ${label}` : `Click "${label}"`,
              description: `${actionText} (${sel}).`,
              target: this._buildTargetSelector(el, sel),
              action: {
                type: 'spotlight',
                title: actionTitle,
                content: `${actionText} for "${promptText}".`,
                placement: isInput ? 'bottom' : 'top',
              },
              validation: { type: valType },
            });
          }
        }
      }
    }

    return matched;
  }

  /**
   * Builds resilient multi-strategy target selector definition for a DOM element.
   * Includes container context scoping and hover trigger references.
   * @param {HTMLElement} el
   * @param {string} [defaultCssFallback='']
   * @param {Object} [options={}]
   * @param {HTMLElement|null} [options.hoverTrigger]
   * @private
   */
  static _buildTargetSelector(el, defaultCssFallback = '', options = {}) {
    if (!el) return { css: defaultCssFallback || 'body' };

    const target = {};
    const tag = (el.tagName || '').toLowerCase();

    // 1. CSS Selector strategy
    if (el.id) {
      target.css = safeIdSelector(el.id);
    } else if (el.getAttribute && (el.getAttribute('data-testid') || el.getAttribute('data-cy'))) {
      const tid = el.getAttribute('data-testid') || el.getAttribute('data-cy');
      target.css = `[data-testid="${tid}"]`;
    } else if (el.getAttribute && el.getAttribute('name')) {
      target.css = `${tag || 'input'}[name="${el.getAttribute('name')}"]`;
    } else if (el.className && typeof el.className === 'string') {
      const firstClass = el.className.trim().split(/\s+/)[0];
      const classSelector = `${tag || 'div'}.${firstClass}`;
      const ownerDocument = el.ownerDocument;
      let isUniqueClass = false;
      try {
        isUniqueClass = ownerDocument?.querySelectorAll?.(classSelector).length === 1;
      } catch {
        // Utility classes can contain characters that are not safe in CSS.
      }
      // Class names are often shared by every button in a component library.
      // Only use one as the primary locator when it identifies this one node.
      if (isUniqueClass && !firstClass.includes(':') && !firstClass.includes('/') && !firstClass.includes('[')) {
        target.css = classSelector;
      }
    }

    if (!target.css) {
      target.css = defaultCssFallback || tag || 'body';
    }

    // Contextual Container Scoping to disambiguate identical elements across regions
    try {
      const dialogAncestor = typeof el.closest === 'function' ? el.closest('dialog[open], [role="dialog"], [role="alertdialog"], .modal') : null;
      if (dialogAncestor) {
        target.container = 'dialog[open], [role="dialog"], .modal';
        if (!el.id) {
          target.css = `${target.container} ${target.css}`;
        }
      } else if (!el.id) {
        const containerWithId = typeof el.closest === 'function' ? el.closest('[id]') : null;
        if (containerWithId && containerWithId !== el && containerWithId.id) {
          target.container = safeIdSelector(containerWithId.id);
          target.css = `${target.container} ${target.css}`;
        }
      }
    } catch {}

    // 2. data-testid attribute strategy
    const testId = el.getAttribute ? (el.getAttribute('data-testid') || el.getAttribute('data-cy')) : null;
    if (testId) {
      target.testId = testId;
    }

    // 3. aria-label strategy
    const ariaLabel = el.getAttribute ? (el.getAttribute('aria-label') || el.getAttribute('title')) : null;
    if (ariaLabel) {
      target.ariaLabel = ariaLabel;
    }

    // 4. Visible Text strategy
    const text = el.textContent ? el.textContent.trim().replace(/\s+/g, ' ').substring(0, 40) : '';
    if (text && text.length >= 2 && text.length <= 30) {
      target.text = text;
    }

    // 5. XPath fallback strategy
    if (el.id) {
      target.xpath = `//*[@id="${el.id}"]`;
    } else if (testId) {
      target.xpath = `//*[@data-testid="${testId}"]`;
    } else if (text && text.length >= 3 && text.length <= 25) {
      target.xpath = `//${tag || '*'}[contains(normalize-space(), "${text}")]`;
    }

    // 6. Hover Trigger strategy for flyouts/dropdown menus
    if (options.hoverTrigger) {
      target.hoverTrigger = this._buildTargetSelector(options.hoverTrigger, 'button, a');
    }

    return target;
  }

  /**
   * Extracts a compact list of actionable/interactive DOM elements from a document.
   * Keeps token usage minimal while providing high context for LLM targeting.
   * @param {Document|Object} doc
   * @param {number} [maxElements=80]
   * @returns {Array<Object>}
   */
  static extractInteractiveDom(doc, maxElements = 80) {
    if (!doc || typeof doc.querySelectorAll !== 'function') {
      return [];
    }

    const queries = [
      'button',
      'a',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="combobox"]',
      '[role="listbox"]',
      '[role="radio"]',
      '[role="checkbox"]',
      '[role="link"]',
      '[role="menuitem"]',
      '[role="option"]',
      '[role="tab"]',
      '[data-testid]',
      '.goog-flat-menu-button',
      '.goog-select',
      'summary',
      'h1',
      'h2',
      'h3',
      'table',
      'nav',
    ];

    const rawElements = [];
    const seenSet = new Set();

    // Try combined query first
    try {
      const combined = doc.querySelectorAll(queries.join(', '));
      if (combined && combined.length > 0) {
        for (const el of combined) {
          if (!seenSet.has(el)) {
            seenSet.add(el);
            rawElements.push(el);
          }
        }
      }
    } catch {
      // Ignore and proceed to per-query fallback
    }

    // Fallback: query individually
    if (rawElements.length === 0) {
      for (const q of queries) {
        try {
          const res = doc.querySelectorAll(q);
          if (res) {
            for (const el of res) {
              if (!seenSet.has(el)) {
                seenSet.add(el);
                rawElements.push(el);
              }
            }
          }
        } catch {}
      }
    }

    // Traverse open shadow roots
    try {
      const allNodes = doc.querySelectorAll ? doc.querySelectorAll('*') : [];
      for (let i = 0; i < allNodes.length; i++) {
        const sr = allNodes[i].shadowRoot;
        if (sr && typeof sr.querySelectorAll === 'function') {
          for (const q of queries) {
            try {
              const shadowMatches = sr.querySelectorAll(q);
              if (shadowMatches) {
                for (let j = 0; j < shadowMatches.length; j++) {
                  const el = shadowMatches[j];
                  if (!seenSet.has(el)) {
                    seenSet.add(el);
                    rawElements.push(el);
                  }
                }
              }
            } catch {}
          }
        }
      }
    } catch {}

    const candidates = [];
    const seen = new Set();

    for (const el of rawElements) {
      if (candidates.length >= maxElements) break;
      if (!el || seen.has(el)) continue;
      seen.add(el);

      const tag = (el.tagName || '').toLowerCase();
      const id = el.id || '';
      const name = el.name || (el.getAttribute ? el.getAttribute('name') : '') || '';
      const testId = el.getAttribute ? (el.getAttribute('data-testid') || el.getAttribute('data-cy')) : '';
      const ariaLabel = el.getAttribute ? (el.getAttribute('aria-label') || el.getAttribute('title')) : '';
      const placeholder = el.placeholder || (el.getAttribute ? el.getAttribute('placeholder') : '') || '';
      const type = el.type || (el.getAttribute ? el.getAttribute('type') : '') || '';
      const role = el.getAttribute ? el.getAttribute('role') : '';

      let text = '';
      if (el.textContent) {
        text = el.textContent.trim().replace(/\s+/g, ' ').substring(0, 60);
      }

      if (!id && !testId && !ariaLabel && !placeholder && !text && !name) {
        continue;
      }

      const menuContainer = el.closest ? el.closest('[role="menu"], .dropdown-menu, .goog-menu, details') : null;
      let isCollapsed = false;
      let parentMenu = undefined;

      if (typeof window !== 'undefined' && window.getComputedStyle) {
        try {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            if (menuContainer) {
              isCollapsed = true;
            } else {
              continue;
            }
          }
        } catch {}
      }

      if (menuContainer) {
        let trigger = null;
        if (menuContainer.tagName === 'DETAILS') {
          trigger = menuContainer.querySelector('summary');
        } else if (menuContainer.id && typeof doc.querySelector === 'function') {
          trigger = doc.querySelector(`[aria-controls="${menuContainer.id}"], [aria-owns="${menuContainer.id}"]`);
        }
        if (!trigger && menuContainer.previousElementSibling?.matches?.('button, [role="button"], [role="menuitem"], [aria-haspopup]')) {
          trigger = menuContainer.previousElementSibling;
        }
        if (!trigger && menuContainer.parentElement?.matches?.('button, [role="button"], [role="menuitem"], [aria-haspopup]')) {
          trigger = menuContainer.parentElement;
        }

        if (!trigger) {
          trigger = menuContainer.parentElement?.querySelector?.('[aria-haspopup], [aria-expanded], summary, [role="menuitem"], button')
            || menuContainer.querySelector?.('[aria-haspopup], [aria-expanded], summary');
        }

        if (trigger && trigger !== el) {
          const label = trigger.getAttribute?.('aria-label') || trigger.getAttribute?.('title') || trigger.textContent || '';
          const cleanLabel = label.trim().replace(/\s+/g, ' ').substring(0, 40);
          if (cleanLabel && !/docs-homescreen|docs\s*home|brand|logo/i.test(`${cleanLabel} ${trigger.className || ''} ${trigger.id || ''}`)) {
            parentMenu = cleanLabel;
          }
        }
      }

      let selector = '';
      if (id) {
        selector = safeIdSelector(id);
      } else if (testId) {
        selector = `[data-testid="${testId}"]`;
      } else if (name) {
        selector = `${tag}[name="${name}"]`;
      } else if (ariaLabel) {
        selector = `[aria-label="${ariaLabel}"]`;
      } else if (el.className && typeof el.className === 'string') {
        const firstClass = el.className.trim().split(/\s+/)[0];
        if (firstClass && !firstClass.includes(':')) {
          selector = `${tag}.${firstClass}`;
        }
      }
      if (!selector) selector = tag;

      candidates.push({
        index: candidates.length + 1,
        tag,
        type: type || undefined,
        id: id || undefined,
        name: name || undefined,
        testId: testId || undefined,
        ariaLabel: ariaLabel || undefined,
        placeholder: placeholder || undefined,
        role: role || undefined,
        text: text || undefined,
        selector,
        isCollapsed: isCollapsed || undefined,
        parentMenu: parentMenu || undefined,
      });
    }

    return candidates;
  }

  /**
   * Calls Google Gemini API to analyze the interactive DOM elements and generate a valid GuideMe tutorial.
   * @param {Object} params
   * @param {string} params.prompt - User instruction or natural language request
   * @param {Document|Object} params.doc - Target DOM document
   * @param {string} [params.url=''] - Page URL
   * @param {string} params.apiKey - Google Gemini API Key
   * @param {string} [params.model='gemini-3.6-flash'] - Gemini model
   * @param {string} [params.language='km'] - Primary language ('km' | 'en')
   * @param {Function} [params.fetchFn] - Custom fetch function for testing
   * @returns {Promise<Object>} Validated GuideMe tutorial schema
   */
  static async analyzeWithGemini({
    prompt,
    doc,
    url = '',
    apiKey,
    model = 'gemini-3.6-flash',
    language = 'km',
    fetchFn = (typeof fetch !== 'undefined' ? fetch : null),
  }) {
    if (!apiKey) {
      throw new Error('Gemini API Key is required for AI DOM Intelligence.');
    }
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt is required for Gemini DOM analysis.');
    }
    if (!fetchFn) {
      throw new Error('Fetch API is not available in current environment.');
    }

    const interactiveDom = this.extractInteractiveDom(doc);
    if (interactiveDom.length === 0) {
      throw new Error('No interactive DOM elements found on the current page to analyze.');
    }

    const systemInstruction = `You are GuideMe AI, an expert web walkthrough designer.
Your mission is to inspect the provided interactive DOM elements from a webpage and the user's request, and generate a step-by-step interactive tutorial flow adhering strictly to GuideMe's JSON schema.

Requirements:
1. Element Selection & Universal Planning:
   - For currently visible elements, select their selectors and labels from the provided interactive DOM elements list.
   - Some elements in the list may have "isCollapsed": true or "parentMenu": "...", indicating they are inside a dropdown/menu. When targeting these, ensure a prior step guides the user to open the parentMenu first.
   - For nested submenu items, settings, or multi-step workflow actions that are not yet in the DOM list (because they only render after opening a menu or modal, e.g. "Page setup" inside "File", "Billing" in "Settings", or "Download PDF" in an "Actions" menu):
     Generate the step using universal semantic targets:
     "target": {
       "css": "[role=\\"menuitem\\"], button, a, [role=\\"button\\"], span",
       "text": "<Name of submenu item or button>",
       "ariaLabel": "<Name of submenu item or button>"
     }
     Our Just-in-Time (JIT) runtime engine uses MutationObserver to attach to the target the millisecond the parent menu is opened.
2. For each step:
   - "target" MUST have "css" plus the element's "text" or "ariaLabel" whenever present.
     When targeting controls inside a dialog or modal (e.g. paper size dropdown, radio options, inputs, confirm buttons):
     Target the specific leaf control (e.g. "[role='listbox'], .goog-flat-menu-button, [role='combobox'], select, input, button") with its label, and set "container": "[role='dialog'], .modal-dialog". NEVER target the dialog container (".modal-dialog", "[role='dialog']") itself.
   - "action": { "type": "spotlight", "title": { "km": "...", "en": "..." }, "content": { "km": "...", "en": "..." }, "placement": "bottom"|"top"|"left"|"right" }
   - "validation": { "type": "click" | "input" | "change" | "submit" | "manual_next" } (choose appropriate type based on element tag/type)
   - "title": Bilingual object { "km": "...", "en": "..." }
   - "description": Bilingual object { "km": "...", "en": "..." }
3. GuideMe is Khmer-First: "km" (Khmer) must be accurate, natural, and friendly. "en" (English) is secondary.
4. Universal Multi-Step Menu Rule:
   - If reaching the goal requires navigating through a menu, dropdown, sidebar, or dialog (e.g. File → Page Setup, Settings → General, Actions → Export):
     You MUST generate a separate, sequential step for EACH level:
     - Step 1: Open the parent menu/container (e.g. Click "File").
     - Step 2: Click the nested submenu item (e.g. Click "Page setup").
     - Step 3+: Configure options in the modal or dialog if requested (e.g. Select "A4").
   - NEVER skip the parent menu and jump straight to a hidden submenu item.
5. Output MUST be pure JSON matching this structure:
{
  "id": "gemini-guide-<timestamp>",
  "version": "1.0.0",
  "name": { "km": "...", "en": "..." },
  "description": { "km": "...", "en": "..." },
  "matchUrls": ["<all_urls>"],
  "steps": [ ... ]
}`;

    const userContent = `Page URL: ${url || 'webpage'}
User Request / Intent: "${prompt}"

Interactive DOM Elements on the page:
${JSON.stringify(interactiveDom, null, 2)}

Generate the interactive tutorial JSON now.`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemInstruction}\n\n${userContent}` }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    };

    const candidateModels = [model];
    const fallbackList = ['gemini-3.6-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];
    for (const fb of fallbackList) {
      if (!candidateModels.includes(fb)) {
        candidateModels.push(fb);
      }
    }

    let lastErrorText = '';
    let lastStatus = 0;
    let data = null;

    for (let i = 0; i < candidateModels.length; i++) {
      const currentModel = candidateModels[i];
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;

      const response = await fetchFn(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        data = await response.json();
        break;
      }

      lastStatus = response.status;
      lastErrorText = await response.text().catch(() => '');

      if (response.status === 404 && i < candidateModels.length - 1) {
        continue;
      }

      throw new Error(`Gemini API returned HTTP ${response.status}: ${lastErrorText.substring(0, 200)}`);
    }

    if (!data) {
      throw new Error(`Gemini API returned HTTP ${lastStatus}: ${lastErrorText.substring(0, 200)}`);
    }

    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('Gemini API did not return any generated content.');
    }

    let tutorial;
    try {
      tutorial = JSON.parse(candidateText);
    } catch (parseErr) {
      throw new Error(`Failed to parse Gemini response as JSON: ${parseErr.message}`);
    }

    if (!tutorial.id) tutorial.id = `gemini-guide-${Date.now()}`;
    if (!tutorial.version) tutorial.version = '1.0.0';
    if (!Array.isArray(tutorial.matchUrls)) tutorial.matchUrls = ['<all_urls>'];

    if (Array.isArray(tutorial.steps)) {
      tutorial.steps.forEach((step, idx) => {
        if (!step.id) step.id = `gemini_step_${idx + 1}`;

        if (!step.title) {
          step.title = step.action?.title || step.instruction || step.description || {
            km: `ជំហានទី ${idx + 1}`,
            en: `Step ${idx + 1}`,
          };
        }

        if (!step.action || typeof step.action !== 'object') {
          step.action = {
            type: 'spotlight',
            title: step.title,
            content: step.description || step.instruction || step.title,
            placement: 'bottom',
          };
        } else {
          if (!step.action.type) step.action.type = 'spotlight';
          if (!step.action.title) step.action.title = step.title;
          if (!step.action.content) step.action.content = step.description || step.instruction || step.title;
        }

        if (!step.validation || typeof step.validation !== 'object') {
          step.validation = { type: 'click' };
        } else if (!step.validation.type) {
          step.validation.type = 'click';
        }

        const candidate = interactiveDom.find((item) => item.selector === step.target?.css);
        if (candidate && step.target) {
          if (!step.target.testId && candidate.testId) step.target.testId = candidate.testId;
          if (!step.target.ariaLabel && candidate.ariaLabel) step.target.ariaLabel = candidate.ariaLabel;
          if (!step.target.text && candidate.text) step.target.text = candidate.text;
        }
      });
    }

    const validationResult = SchemaValidator.validateTutorial(tutorial);
    if (!validationResult.valid) {
      throw new Error(`Gemini tutorial schema validation failed: ${validationResult.errors.join('; ')}`);
    }

    return tutorial;
  }
}

/**
 * Alias export for backward compatibility.
 */
export const GeminiDomAnalyzer = DynamicPageAnalyzer;
