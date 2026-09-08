import { GeminiDomAnalyzer } from './gemini-dom-analyzer.js';
import { NvidiaDomAnalyzer } from './nvidia-dom-analyzer.js';

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
    if (typeof userPrompt === 'string' && userPrompt.trim() && !isJsonPrompt) {
      const provider = (options.provider || 'auto').toLowerCase();
      const nvidiaKey = options.nvidiaApiKey || (provider === 'nvidia' ? options.apiKey : '');
      const geminiKey = options.geminiApiKey || (provider === 'gemini' ? options.apiKey : '');
      const backendUrl = options.backendUrl || '';

      // 1. Try NVIDIA AI NIM (Direct Key or Backend Proxy)
      if (nvidiaKey || (backendUrl && provider !== 'gemini') || provider === 'nvidia') {
        try {
          const aiTutorial = await NvidiaDomAnalyzer.analyzeWithNvidia({
            prompt: userPrompt,
            doc,
            url,
            apiKey: nvidiaKey,
            model: options.nvidiaModel || options.model || 'moonshotai/kimi-k3',
            endpoint: options.nvidiaEndpoint || options.endpoint || 'https://integrate.api.nvidia.com/v1/chat/completions',
            backendUrl,
            language: options.language || 'km',
            fetchFn: options.fetchFn,
          });
          if (aiTutorial && Array.isArray(aiTutorial.steps) && aiTutorial.steps.length > 0) {
            return aiTutorial;
          }
        } catch (err) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[DynamicPageAnalyzer] NVIDIA NIM analysis fallback:', err.message);
          }
        }
      }

      // 2. Try Gemini API if configured
      if (geminiKey || provider === 'gemini' || (options.apiKey && !nvidiaKey)) {
        try {
          const aiTutorial = await GeminiDomAnalyzer.analyzeWithGemini({
            prompt: userPrompt,
            doc,
            url,
            apiKey: geminiKey || options.apiKey,
            model: options.model || 'gemini-2.5-flash',
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
    return this.generateDynamicTutorial(doc, url, userPrompt, options);
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
      const candidates = [];
      const seenElements = new Set();

      const scoreAndAdd = (el, type) => {
        if (!el || seenElements.has(el)) return;

        // 1. Strict Visibility & Interactability check
        if (!this._isInteractable(el)) return;

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

        // 5. Large text walls and body container penalties
        if (text.length > 50) score -= 45;
        if (text.length > 120) score -= 90;

        // 6. Context-Aware Proximity / Spatial Score (Modals, Dropdowns, Layout)
        if (score > 10) {
           const ctxScore = this._calculateContextScore(el, primaryIntentId);
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
          });
        }
      };

      // Scan all interactive controls on the page (Universal for all frameworks)
      analysis.buttons.forEach((btn) => scoreAndAdd(btn, 'button'));
      analysis.allInputs.forEach((input) => scoreAndAdd(input, 'input'));
      const linksAndActionables = this._safeQueryAll(doc, 'a[href], [role="button"], [role="tab"], [role="menuitem"], [role="link"], summary');
      linksAndActionables.forEach((link) => scoreAndAdd(link, 'button'));

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
             if (tag === 'form' || tag === 'fieldset' || (typeof current.className === 'string' && current.className.includes('card'))) {
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
            // Locality boost for sharing an ancestor with the anchor
            if (anchorParent && cand.el && anchorParent.contains(cand.el)) {
              cand.score += 50; 
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
            target: this._buildTargetSelector(cand.el, isBtn ? 'button, [role="button"], a' : 'input, textarea'),
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
   * @private
   */
  static _isInteractable(el) {
    if (!el) return false;

    // 1. Semantic disabled states
    if (el.disabled || el.getAttribute?.('aria-disabled') === 'true') {
      return false;
    }

    // 2. Semantic hidden states
    if (el.getAttribute?.('aria-hidden') === 'true') {
      return false;
    }

    // 3. CSS Classes common for hiding elements
    const className = (typeof el.className === 'string' ? el.className : el.className?.baseVal || '').toLowerCase();
    if (className.includes('hidden') || className.includes('invisible') || className.includes('d-none') || className.includes('opacity-0')) {
      return false;
    }

    // 4. Bounding Client Rect (if layout is available)
    if (typeof el.getBoundingClientRect === 'function') {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        // Some span wrappers might have 0 size but visible children, but for interactable inputs/buttons, they must have size.
        // Exception: If the element is purely a visually hidden text container (like screen reader only), but we are a visual engine.
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluates the contextual primacy of the element within the page layout.
   * Heavily favors active overlays/modals and transient UI.
   * @private
   */
  static _calculateContextScore(el, intentId) {
    let score = 0;
    let current = el;
    let depth = 0;
    let hasModal = false;
    
    // Check global modal existence on the document
    const doc = el.ownerDocument;
    if (doc) {
      const anyModalOpen = doc.querySelector('dialog[open], [role="dialog"], .modal.show, .modal.active, [aria-modal="true"]');
      hasModal = !!anyModalOpen;
    }

    while (current && depth < 8) {
      const tag = (current.tagName || '').toLowerCase();
      const role = (current.getAttribute?.('role') || '').toLowerCase();
      const ariaExpanded = current.getAttribute?.('aria-expanded');
      const className = (typeof current.className === 'string' ? current.className : '').toLowerCase();

      // 1. Modals & Dialogs (The Active Layer)
      if (tag === 'dialog' || role === 'dialog' || role === 'alertdialog' || className.includes('modal') || current.getAttribute?.('aria-modal') === 'true') {
        score += 200;
        hasModal = false; // we are IN the modal, so cancel the penalty
      }

      // 2. Transient Hover/Click Menus (Dropdowns)
      if (ariaExpanded === 'true' || role === 'menu' || role === 'listbox' || className.includes('dropdown-menu') || className.includes('popover') || className.includes('tippy-box')) {
        score += 150;
      }

      // 3. Layout Primacy
      if (tag === 'main' || current.id === 'main-content' || className.includes('main')) {
        score += 50;
      } else if (tag === 'footer' || tag === 'aside') {
        // Penalty unless user specifically asked for navigation/settings which often reside in footers/sidebars
        if (intentId !== 'navigation' && intentId !== 'settings' && intentId !== 'help') {
          score -= 40;
        }
      } else if (tag === 'header' || tag === 'nav') {
        if (intentId !== 'navigation' && intentId !== 'search' && intentId !== 'login') {
          score -= 30; // Penalize standard actions in header
        }
      }

      // 4. Repetitive List structures
      if (tag === 'li' || tag === 'tr') {
        score -= 20; // Slight penalty to avoid picking random list items over page-level buttons
      }

      current = current.parentElement;
      depth++;
    }
    
    // If a modal is open somewhere else on the page, and we are NOT in it, penalize heavily.
    if (hasModal && score < 200) {
      score -= 150;
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
   * @private
   */
  static _buildTargetSelector(el, defaultCssFallback = '') {
    if (!el) return { css: defaultCssFallback || 'body' };

    const target = {};
    const tag = (el.tagName || '').toLowerCase();

    // 1. CSS Selector strategy
    if (el.id) {
      target.css = `#${el.id}`;
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

    return target;
  }
}
