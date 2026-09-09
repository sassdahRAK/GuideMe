import { SchemaValidator } from '@guideme/tutorial-schema';

/**
 * Safely generates a CSS selector for an element ID.
 * Uses attribute selector [id="..."] when the ID contains colons or special characters.
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
 * Strips reasoning tokens (<think>...</think>) and Markdown code fences from LLM text.
 * Essential for reasoning models like moonshotai/kimi-k3.
 * @param {string} rawText
 * @returns {string}
 */
export function cleanJsonResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match) {
    cleaned = match[1].trim();
  }
  return cleaned;
}

/**
 * NvidiaDomAnalyzer — Headless NVIDIA AI NIM DOM Intelligence Engine.
 * Extracts a lightweight interactive DOM representation and uses NVIDIA NIM
 * (moonshotai/kimi-k3) directly or via the GuideMe backend proxy to synthesize
 * real-time, interactive, bilingual walkthroughs.
 */
export class NvidiaDomAnalyzer {
  /**
   * Extracts a compact list of actionable/interactive DOM elements from a document.
   * Keeps token usage minimal while providing rich semantic context for LLM targeting.
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

    // Fallback: query individually (for test mocks or environments without combined selector support)
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

      // Skip invisible / useless elements without identifiers or text
      if (!id && !testId && !ariaLabel && !placeholder && !text && !name) {
        continue;
      }

      // Build clean suggested selector
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
      });
    }

    return candidates;
  }

  /**
   * Calls NVIDIA AI NIM (or backend proxy) to analyze DOM candidates and synthesize a valid GuideMe tutorial.
   * @param {Object} params
   * @param {string} params.prompt - User instruction or natural language request
   * @param {Document|Object} params.doc - Target DOM document
   * @param {string} [params.url=''] - Page URL
   * @param {string} [params.apiKey=''] - NVIDIA API Key ($NVIDIA_API_KEY)
   * @param {string} [params.model='moonshotai/kimi-k3'] - Model name on NVIDIA NIM
   * @param {string} [params.endpoint='https://integrate.api.nvidia.com/v1/chat/completions'] - NIM completions URL
   * @param {string} [params.backendUrl=''] - Optional GuideMe backend URL for server-side secret proxy
   * @param {string} [params.language='km'] - Primary language ('km' | 'en')
   * @param {Function} [params.fetchFn] - Custom fetch function for testing
   * @returns {Promise<Object>} Validated GuideMe tutorial schema
   */
  static async analyzeWithNvidia({
    prompt,
    doc,
    url = '',
    apiKey = '',
    model = 'moonshotai/kimi-k3',
    endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions',
    backendUrl = '',
    language = 'km',
    fetchFn = (typeof fetch !== 'undefined' ? fetch : null),
  }) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt is required for NVIDIA DOM analysis.');
    }
    if (!fetchFn) {
      throw new Error('Fetch API is not available in current environment.');
    }

    const interactiveDom = this.extractInteractiveDom(doc);
    if (interactiveDom.length === 0) {
      throw new Error('No interactive DOM elements found on the current page to analyze.');
    }

    let tutorial;

    // ── Mode A: Backend Proxy (Keeps API key secure on server) ──
    if (backendUrl && !apiKey) {
      const proxyEndpoint = `${backendUrl.replace(/\/$/, '')}/api/ai/dom-guide`;
      const proxyRes = await fetchFn(proxyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          elements: interactiveDom,
          url,
          language,
        }),
      });

      if (!proxyRes.ok) {
        const errText = await proxyRes.text().catch(() => '');
        throw new Error(`Backend proxy returned HTTP ${proxyRes.status}: ${errText.substring(0, 150)}`);
      }

      tutorial = await proxyRes.json();
    } else {
      // ── Mode B: Direct NVIDIA NIM API Call ──
      if (!apiKey) {
        throw new Error('NVIDIA API Key ($NVIDIA_API_KEY) or backendUrl is required for AI DOM Intelligence.');
      }

      const systemInstruction = `You are GuideMe AI, an expert interactive web walkthrough and DOM guidance engine.
Your mission is to inspect the provided interactive DOM elements from a webpage and the user's intent, and generate a step-by-step interactive tutorial flow adhering strictly to GuideMe's JSON schema.

Requirements:
1. Select ONLY elements from the provided interactive DOM elements list.
2. For each step:
   - "id": unique string identifier (e.g. "step_1", "step_2")
   - "target": {
       "css": exact CSS selector from the candidate list (e.g. "#search-box", ".login-btn"),
       "text": element text if present (to distinguish repeated buttons),
       "ariaLabel": ariaLabel if present,
       "testId": testId if present
     }
   - "action": {
       "type": "spotlight",
       "title": { "km": "...", "en": "..." },
       "content": { "km": "...", "en": "..." },
       "placement": "bottom" | "top" | "left" | "right"
     }
   - "validation": {
       "type": "click" | "input" | "change" | "submit" | "manual_next"
     }
   - "title": Bilingual object { "km": "...", "en": "..." }
   - "description": Bilingual object { "km": "...", "en": "..." }
3. GuideMe is Khmer-First: "km" (Khmer) must be natural, accurate, and beginner-friendly. "en" (English) is secondary.
4. Output MUST be ONLY pure valid JSON (no surrounding markdown code blocks, no conversational text) matching:
{
  "id": "nvidia-guide-${Date.now()}",
  "version": "1.0.0",
  "name": { "km": "...", "en": "..." },
  "description": { "km": "...", "en": "..." },
  "matchUrls": ["<all_urls>"],
  "steps": [ ... ]
}`;

      const userContent = `Page URL: ${url || 'webpage'}
User Request / Goal: "${prompt}"

Interactive DOM Elements on the page:
${JSON.stringify(interactiveDom, null, 2)}

Generate the interactive tutorial JSON now.`;

      const requestBody = {
        model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 4096,
        stream: false,
      };

      const response = await fetchFn(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`NVIDIA API returned HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('NVIDIA API did not return generated choices content.');
      }

      const cleanedJson = cleanJsonResponse(content);
      try {
        tutorial = JSON.parse(cleanedJson);
      } catch (parseErr) {
        throw new Error(`Failed to parse NVIDIA response as JSON: ${parseErr.message}`);
      }
    }

    // Default top-level properties
    if (!tutorial.id) tutorial.id = `nvidia-guide-${Date.now()}`;
    if (!tutorial.version) tutorial.version = '1.0.0';
    if (!Array.isArray(tutorial.matchUrls)) tutorial.matchUrls = ['<all_urls>'];

    // Ensure steps have unique IDs and hydrate selectors from candidate locators
    if (Array.isArray(tutorial.steps)) {
      tutorial.steps.forEach((step, idx) => {
        if (!step.id) step.id = `nvidia_step_${idx + 1}`;

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
      throw new Error(`NVIDIA tutorial schema validation failed: ${validationResult.errors.join('; ')}`);
    }

    return tutorial;
  }
}
