/**
 * DOM Harvester — Lightweight, safe interactive element extractor.
 * Collects actionable DOM elements across light DOM and open shadow roots
 * for zero-hallucination candidate indexing.
 */

export interface HarvestOptions {
  maxElements?: number;
  targetQuery?: string;
  intent?: {
    targetQuery?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface HarvestedElementCandidate {
  element: any;
  tag: string;
  type: string;
  id: string;
  name: string;
  testId: string;
  ariaLabel: string;
  placeholder: string;
  role: string;
  text: string;
  rect: {
    top: number;
    left: number;
    bottom: number;
    right: number;
    width: number;
    height: number;
  };
  isInModal: boolean;
  isInput: boolean;
  category: string;
  isCollapsed?: boolean;
  parentMenu?: string;
}

/**
 * Safely generates a CSS selector for an element ID.
 * Uses attribute selector [id="..."] when the ID contains colons or special characters.
 */
export function safeIdSelector(id: string): string {
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
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="radio"]',
  '[role="checkbox"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="searchbox"]',
  '[data-testid]',
  '[tabindex="0"]',
  '[aria-label]',
  '[title]',
  '[data-tooltip]',
  '.goog-flat-menu-button',
  '.goog-select',
  'summary',
  // Spreadsheet/table grid containers (Google Sheets, similar canvas-rendered
  // grids). Individual cells have no DOM presence to harvest, but the guide
  // generator still needs *something* selectable for "select a range of
  // cells" steps — without this, it has no valid target at all and falls
  // back to reusing an unrelated selector like the formula bar.
  '[role="grid"]',
];

/**
 * Traverses a document or element tree to harvest all visible, interactive element candidates.
 * Supports open Shadow DOM roots (Google Docs, Canvas LMS, Microsoft 365, Web Components).
 */
export function harvestInteractiveElements(doc: any, options: HarvestOptions = {}): HarvestedElementCandidate[] {
  if (!doc || typeof doc.querySelectorAll !== 'function') {
    return [];
  }

  const maxElements = options.maxElements || 800;
  const rawElements: any[] = [];
  const seenSet = new Set<any>();

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
      const host = allNodes[i];
      // Never harvest GuideMe's own overlay UI as a tutorial target. It mounts
      // as an open shadow root (guideme-tutorial-root) so it stays inspectable,
      // which means this same traversal that finds real host-page shadow DOM
      // (Google Docs, Web Components, etc.) would otherwise also hand the AI
      // our own Next/Skip buttons and step-title text as "page" candidates —
      // producing selectors like "h3.text-[15px]" that target our own card
      // instead of anything on the actual page.
      if ((host.tagName || '').toLowerCase() === 'guideme-tutorial-root') continue;
      const sr = host.shadowRoot;
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
  const candidates: HarvestedElementCandidate[] = [];

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

    // Check if element is inside a popup/dropdown menu container
    const menuContainer = el.closest ? el.closest('[role="menu"], .dropdown-menu, .goog-menu, details') : null;
    let isCollapsed = false;
    let parentMenu: string | undefined = undefined;

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
      let trigger: any = null;
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
        // Exclude generic brand logos or home navigation from being treated as parent menus
        if (cleanLabel && !/docs-homescreen|\b(docs|sheets|slides|forms|drive)\s*home\b|brand|logo/i.test(`${cleanLabel} ${trigger.className || ''} ${trigger.id || ''}`)) {
          parentMenu = cleanLabel;
        }
      }
    }

    const formEl = el as any;
    const textInputEl = el as any;
    const tag = (el.tagName || '').toLowerCase();
    const id = (el.id || '').trim();
    const name = (formEl.name || (el.getAttribute ? el.getAttribute('name') : '') || '').trim();
    const testId = (el.getAttribute ? (el.getAttribute('data-testid') || el.getAttribute('data-cy')) : '') || '';
    const ariaLabel = (el.getAttribute ? (el.getAttribute('aria-label') || el.getAttribute('title')) : '') || '';
    const placeholder = (textInputEl.placeholder || (el.getAttribute ? el.getAttribute('placeholder') : '') || '').trim();
    const type = (formEl.type || (el.getAttribute ? el.getAttribute('type') : '') || '').toLowerCase();
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
      isCollapsed: isCollapsed || undefined,
      parentMenu: parentMenu || undefined,
    });
  }

  return candidates;
}
