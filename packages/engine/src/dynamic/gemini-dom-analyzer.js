import { SchemaValidator } from '@guideme/tutorial-schema';

/**
 * GeminiDomAnalyzer — Headless LLM-powered DOM Intelligence Engine.
 * Extracts a lightweight interactive DOM tree and asks Google Gemini to
 * intelligently map user intent to target DOM elements and generate tutorials.
 */
export class GeminiDomAnalyzer {
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
      '[role="link"]',
      '[role="menuitem"]',
      '[role="tab"]',
      '[data-testid]',
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

    // Fallback: query individually (e.g. for unit test mocks or engines without combined selector support)
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

    // Traverse open shadow roots for Web Components (Google Docs, Canvas LMS, Microsoft 365)
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

      // Skip invisible / useless elements
      if (!id && !testId && !ariaLabel && !placeholder && !text && !name) {
        continue;
      }

      // Build clean suggested selector
      let selector = '';
      if (id) {
        selector = `#${id}`;
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
   * @param {string} [params.model='gemini-2.5-flash'] - Gemini model
   * @param {string} [params.language='km'] - Primary language ('km' | 'en')
   * @param {Function} [params.fetchFn] - Custom fetch function for testing
   * @returns {Promise<Object>} Validated GuideMe tutorial schema
   */
  static async analyzeWithGemini({
    prompt,
    doc,
    url = '',
    apiKey,
    model = 'gemini-2.5-flash',
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

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const systemInstruction = `You are GuideMe AI, an expert web walkthrough designer.
Your mission is to inspect the provided interactive DOM elements from a webpage and the user's request, and generate a step-by-step interactive tutorial flow adhering strictly to GuideMe's JSON schema.

Requirements:
1. Select ONLY elements from the provided interactive DOM elements list.
2. For each step:
   - "target" MUST have "css" (exact CSS selector from the element list) plus the element's "text" or "ariaLabel" whenever it is present. This is required to distinguish repeated buttons.
   - "action": { "type": "spotlight", "title": { "km": "...", "en": "..." }, "content": { "km": "...", "en": "..." }, "placement": "bottom"|"top"|"left"|"right" }
   - "validation": { "type": "click" | "input" | "change" | "submit" | "manual_next" } (choose appropriate type based on element tag/type)
   - "title": Bilingual object { "km": "...", "en": "..." }
   - "description": Bilingual object { "km": "...", "en": "..." }
3. GuideMe is Khmer-First: "km" (Khmer) must be accurate, natural, and friendly. "en" (English) is secondary.
4. Output MUST be pure JSON matching this structure:
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

    const response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Gemini API returned HTTP ${response.status}: ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
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

    // Assign fallback IDs and URL match if missing
    if (!tutorial.id) tutorial.id = `gemini-guide-${Date.now()}`;
    if (!tutorial.version) tutorial.version = '1.0.0';
    if (!Array.isArray(tutorial.matchUrls)) tutorial.matchUrls = ['<all_urls>'];

    // Ensure steps have unique IDs
    if (Array.isArray(tutorial.steps)) {
      tutorial.steps.forEach((step, idx) => {
        if (!step.id) step.id = `gemini_step_${idx + 1}`;

        // Gemini may select a broad selector (for example `button`). Hydrate
        // its target with the matching DOM candidate's stable secondary
        // locators so the adapter can identify the exact visible control.
        const candidate = interactiveDom.find((item) => item.selector === step.target?.css);
        if (candidate && step.target) {
          if (!step.target.testId && candidate.testId) step.target.testId = candidate.testId;
          if (!step.target.ariaLabel && candidate.ariaLabel) step.target.ariaLabel = candidate.ariaLabel;
          if (!step.target.text && candidate.text) step.target.text = candidate.text;
        }
      });
    }

    // Validate with GuideMe SchemaValidator
    const validationResult = SchemaValidator.validateTutorial(tutorial);
    if (!validationResult.valid) {
      throw new Error(`Gemini tutorial schema validation failed: ${validationResult.errors.join('; ')}`);
    }

    return tutorial;
  }
}
