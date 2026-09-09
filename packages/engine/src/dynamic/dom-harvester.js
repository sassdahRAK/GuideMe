/**
 * DOM Harvester — Lightweight, safe interactive element extractor.
 * Collects actionable DOM elements across light DOM and open shadow roots
 * for zero-hallucination candidate indexing.
 */

/**
 * Safely generates a CSS selector for an element ID.
 * Uses attribute selector [id="..."] when the ID contains characters like colons (':6j', ':a7'),
 * dots, spaces, slashes, brackets, or starts with digits, preventing CSS syntax errors.
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

const INTERACTIVE_SELECTORS = [
  'button',
  'a[href]',
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"])',
  'input[type="submit"]',
  'input[type="button"]',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="searchbox"]',
  '[data-testid]',
  '[tabindex="0"]',
  '[aria-label]',
  '[title]',
  '[data-tooltip]',
];

/**
 * Traverses a document or element tree to harvest all visible, interactive element candidates.
 * Supports open Shadow DOM roots (Google Docs, Canvas LMS, Microsoft 365, Web Components).
 *
 * @param {Document|Element} doc
 * @param {Object} [options]
 * @param {number} [options.maxElements=350]
 * @returns {Array<Object>} Extracted candidate descriptors with direct element references
 */
export function harvestInteractiveElements(doc, options = {}) {
  if (!doc || typeof doc.querySelectorAll !== 'function') {
    return [];
  }

  const maxElements = options.maxElements || 800;
  const rawElements = [];
  const seenSet = new Set();

  // 0. High-Priority Fast Query for Explicit Target
  const targetQuery = (options.targetQuery || options.intent?.targetQuery || '').trim();
  if (targetQuery) {
    const escaped = targetQuery.replace(/["\\]/g, '\\$&');
    try {
      const targeted = doc.querySelectorAll(
        `#${escaped}, [id*="${escaped}" i], [aria-label*="${escaped}" i], [title*="${escaped}" i], [data-tooltip*="${escaped}" i]`
      );
      for (let i = 0; i < targeted.length; i++) {
        const el = targeted[i];
        if (!seenSet.has(el)) {
          seenSet.add(el);
          rawElements.push(el);
        }
      }
    } catch {}
  }

  // 1. Light DOM Query
  try {
    const combined = doc.querySelectorAll(INTERACTIVE_SELECTORS.join(', '));
    for (let i = 0; i < combined.length; i++) {
      const el = combined[i];
      if (!seenSet.has(el)) {
        seenSet.add(el);
        rawElements.push(el);
      }
    }
  } catch {
    // Fallback if combined query throws in older browser / mocked DOM
    for (const sel of INTERACTIVE_SELECTORS) {
      try {
        const matches = doc.querySelectorAll(sel);
        for (let i = 0; i < matches.length; i++) {
          const el = matches[i];
          if (!seenSet.has(el)) {
            seenSet.add(el);
            rawElements.push(el);
          }
        }
      } catch {}
    }
  }

  // 2. Open Shadow Roots Traversal
  try {
    const allNodes = doc.querySelectorAll('*');
    for (let i = 0; i < allNodes.length; i++) {
      const sr = allNodes[i].shadowRoot;
      if (sr && typeof sr.querySelectorAll === 'function') {
        for (const sel of INTERACTIVE_SELECTORS) {
          try {
            const matches = sr.querySelectorAll(sel);
            for (let j = 0; j < matches.length; j++) {
              const el = matches[j];
              if (!seenSet.has(el)) {
                seenSet.add(el);
                rawElements.push(el);
              }
            }
          } catch {}
        }
      }
    }
  } catch {}

  // 3. Filter & Descriptor Synthesis
  const candidates = [];

  for (const el of rawElements) {
    if (candidates.length >= maxElements) break;
    if (!el) continue;

    // Filter out hidden / disconnected elements
    if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') continue;

    // Dimensions check when layout engine is present
    let rect = { top: 0, left: 0, bottom: 0, right: 0, width: 24, height: 24 };
    if (typeof el.getBoundingClientRect === 'function') {
      try {
        const r = el.getBoundingClientRect();
        // In browser environments with real layout, skip 0x0 elements
        if (r.width === 0 && r.height === 0 && (r.top !== 0 || r.left !== 0)) continue;
        rect = r;
      } catch {}
    }

    if (typeof window !== 'undefined' && window.getComputedStyle) {
      try {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          continue;
        }
      } catch {}
    }

    const tag = (el.tagName || '').toLowerCase();
    const id = (el.id || '').trim();
    const name = (el.name || (el.getAttribute ? el.getAttribute('name') : '') || '').trim();
    const testId = (el.getAttribute ? (el.getAttribute('data-testid') || el.getAttribute('data-cy')) : '') || '';
    const ariaLabel = (el.getAttribute ? (el.getAttribute('aria-label') || el.getAttribute('title')) : '') || '';
    const placeholder = (el.placeholder || (el.getAttribute ? el.getAttribute('placeholder') : '') || '').trim();
    const type = (el.type || (el.getAttribute ? el.getAttribute('type') : '') || '').toLowerCase();
    const role = (el.getAttribute ? el.getAttribute('role') : '') || tag;

    // Filter CSRF / Token hidden fields
    const lowerName = name.toLowerCase();
    const lowerId = id.toLowerCase();
    if (lowerName.includes('csrf') || lowerName.includes('token') || lowerId.includes('csrf') || lowerId.includes('token')) {
      continue;
    }

    let text = '';
    if (el.textContent) {
      text = el.textContent.trim().replace(/\s+/g, ' ').substring(0, 80);
    }

    // Skip empty decorative elements without label or identifier
    if (!text && !ariaLabel && !placeholder && !id && !testId && !name) {
      continue;
    }

    const isInput = ['input', 'select', 'textarea'].includes(tag);
    const isInModal = Boolean(el.closest && el.closest('dialog, [role="dialog"], [aria-modal="true"], .modal, .MuiDialog-root'));

    let category = 'action';
    if (isInput) category = 'input';
    else if (tag === 'a' || role === 'link' || role === 'tab') category = 'navigation';

    candidates.push({
      element: el,
      tag,
      type,
      id,
      name,
      testId,
      ariaLabel,
      placeholder,
      role,
      text,
      rect,
      isInModal,
      isInput,
      category,
    });
  }

  return candidates;
}
