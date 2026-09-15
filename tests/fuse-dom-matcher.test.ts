import {
  harvestInteractiveElements,
  safeIdSelector,
} from '../packages/engine/src/dynamic/dom-harvester.ts';
import {
  matchDomElementWithFuse,
  deriveConcreteSelector,
  synthesizeGroundedTutorial,
} from '../packages/engine/src/dynamic/fuse-dom-matcher.ts';
import { DynamicPageAnalyzer, SchemaValidator } from '../packages/engine/src/index.ts';

// ---------------------------------------------------------------------------
// Typed mock element factory
// ---------------------------------------------------------------------------
interface MockElementOptions {
  id?: string;
  text?: string;
  ariaLabel?: string;
  placeholder?: string;
  testId?: string;
  inModal?: boolean;
}

function createMockElement(tag: string, {
  id = '', text = '', ariaLabel = '', placeholder = '', testId = '', inModal = false,
}: MockElementOptions = {}) {
  return {
    tagName: tag.toUpperCase(),
    id,
    textContent: text,
    placeholder,
    className: '',
    closest: (selector: string) => {
      if (inModal && (selector.includes('dialog') || selector.includes('modal'))) {
        return { tagName: 'DIALOG' };
      }
      return null;
    },
    getAttribute: (attr: string) => {
      if (attr === 'aria-label') return ariaLabel;
      if (attr === 'data-testid') return testId;
      if (attr === 'placeholder') return placeholder;
      if (attr === 'type') return tag === 'input' ? 'text' : '';
      return null;
    },
    getBoundingClientRect: () => ({ top: 100, left: 100, bottom: 140, right: 200, width: 100, height: 40 }),
  };
}

function createMockDoc(elements: ReturnType<typeof createMockElement>[] = []) {
  return {
    querySelectorAll: (_sel: string) => elements,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('Fuse.js DOM Scanner & Grounded Matcher Tests', () => {
  test('harvestInteractiveElements extracts valid candidates with identifiers', () => {
    const btn1 = createMockElement('button', { id: 'btn-share', text: 'Share' });
    const input1 = createMockElement('input', { placeholder: 'Search anything...' });
    const hidden = createMockElement('button', { text: '' }); // empty — should be filtered

    const doc = createMockDoc([btn1, input1, hidden]);
    const candidates = harvestInteractiveElements(doc);

    expect(candidates.length).toBe(2);
    expect(candidates[0].text).toBe('Share');
    expect(candidates[0].id).toBe('btn-share');
    expect(candidates[1].placeholder).toBe('Search anything...');
  });

  test('matchDomElementWithFuse matches exact and fuzzy targetQuery', () => {
    const btnShare = createMockElement('button', { id: 'btn-share', text: 'Share' });
    const btnSave = createMockElement('button', { id: 'btn-save', text: 'Save changes' });
    const inputSearch = createMockElement('input', { placeholder: 'Search...' });

    const doc = createMockDoc([btnShare, btnSave, inputSearch]);
    const candidates = harvestInteractiveElements(doc);

    // Exact match
    const match1 = matchDomElementWithFuse(candidates, { targetQuery: 'Share', action: 'click' });
    expect(match1).toBeTruthy();
    expect(match1.id).toBe('btn-share');
    expect(match1.derivedSelector).toBe('#btn-share');

    // Fuzzy typo match ("shre" -> "Share")
    const match2 = matchDomElementWithFuse(candidates, { targetQuery: 'shre', action: 'click' });
    expect(match2).toBeTruthy();
    expect(match2.id).toBe('btn-share');
  });

  test('matchDomElementWithFuse prioritizes elements inside active modals', () => {
    const bgClose = createMockElement('button', { text: 'Close', inModal: false });
    const modalClose = createMockElement('button', { id: 'modal-close', text: 'Close', inModal: true });

    const doc = createMockDoc([bgClose, modalClose]);
    const candidates = harvestInteractiveElements(doc);

    const match = matchDomElementWithFuse(candidates, { targetQuery: 'Close', action: 'click' });
    expect(match).toBeTruthy();
    expect(match.id).toBe('modal-close');
  });

  test('deriveConcreteSelector generates safe selector escaping special characters', () => {
    expect(safeIdSelector(':6j')).toBe('[id=":6j"]');
    expect(safeIdSelector('normal-id')).toBe('#normal-id');

    const elColons = createMockElement('button', { id: ':r1:' });
    const selector = deriveConcreteSelector({ id: ':r1:', element: elColons, tag: 'button' });
    expect(selector).toBe('[id=":r1:"]');
  });

  test('synthesizeGroundedTutorial produces schema compliant with SchemaValidator', () => {
    const btn = createMockElement('button', { id: 'share-btn', text: 'Share' });
    const candidates = harvestInteractiveElements(createMockDoc([btn]));
    const matched = matchDomElementWithFuse(candidates, { targetQuery: 'Share', action: 'click' });

    const tutorial = synthesizeGroundedTutorial(matched!, {
      targetQuery: 'Share',
      action: 'click',
      role: 'button',
      category: 'share',
    });

    expect(tutorial).toBeTruthy();
    expect(tutorial.steps.length).toBe(1);
    expect(tutorial.steps[0].target.css).toBe('#share-btn');
    expect(tutorial.steps[0].validation.type).toBe('click');

    const validation = SchemaValidator.validateTutorial(tutorial);
    expect(validation.valid, `Validation errors: ${validation.errors.join(', ')}`).toBe(true);
  });

  test('DynamicPageAnalyzer integrates Fuse.js matcher seamlessly when intent is provided', async () => {
    const btn = createMockElement('button', { id: 'export-btn', text: 'Export CSV' });
    const doc = createMockDoc([btn]);

    const tutorial = await DynamicPageAnalyzer.generateDynamicTutorialAsync(
      doc,
      'https://example.com',
      'export file',
      {
        intent: {
          targetQuery: 'Export CSV',
          action: 'click',
          role: 'button',
        },
      }
    );

    expect(tutorial).toBeTruthy();
    expect(tutorial.steps[0].target.css).toBe('#export-btn');
    const validation = SchemaValidator.validateTutorial(tutorial);
    expect(validation.valid).toBe(true);
  });

  test('harvestInteractiveElements extracts collapsed menu elements and records parentMenu', () => {
    const triggerBtn = {
      tagName: 'BUTTON',
      id: 'menu-file',
      textContent: 'File',
      getAttribute: (attr: string) => (attr === 'aria-label' ? 'File' : null),
      getBoundingClientRect: () => ({ top: 10, left: 10, bottom: 40, right: 80, width: 70, height: 30 }),
    };

    const dropdownContainer = {
      parentElement: { querySelector: () => triggerBtn },
      querySelector: () => triggerBtn,
    };

    const collapsedItem = {
      tagName: 'BUTTON',
      id: 'page-setup-btn',
      textContent: 'Page setup',
      className: '',
      closest: (sel: string) => (sel.includes('menu') || sel.includes('dropdown') ? dropdownContainer : null),
      getAttribute: (attr: string) => (attr === 'role' ? 'menuitem' : null),
      getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }),
    };

    const doc = createMockDoc([triggerBtn as ReturnType<typeof createMockElement>, collapsedItem as ReturnType<typeof createMockElement>]);
    const candidates = harvestInteractiveElements(doc);

    const setupCand = candidates.find((c: { text: string }) => c.text === 'Page setup');
    expect(setupCand, 'Collapsed item should be captured').toBeTruthy();
    expect((setupCand as Record<string, unknown>).parentMenu).toBe('File');
  });

  test('synthesizeGroundedTutorial produces a valid 2-step hierarchy when item has parentMenu', () => {
    const matched = {
      id: 'page-setup-btn',
      text: 'Page setup',
      tag: 'button',
      derivedSelector: '#page-setup-btn',
      parentMenu: 'File',
    };

    const tutorial = synthesizeGroundedTutorial(matched, { targetQuery: 'Page setup', action: 'click' });
    expect(tutorial).toBeTruthy();
    expect(tutorial.steps.length).toBe(2);

    // Step 1: Open parent menu
    expect(tutorial.steps[0].id).toBe('step-1');
    expect(tutorial.steps[0].title.en.includes('File')).toBeTruthy();
    expect(tutorial.steps[0].target.text).toBe('File');
    expect(tutorial.steps[0].validation.type).toBe('click');

    // Step 2: Target item inside menu
    expect(tutorial.steps[1].id).toBe('step-2');
    expect(tutorial.steps[1].title.en.includes('Page setup')).toBeTruthy();
    expect(tutorial.steps[1].target.css).toBe('#page-setup-btn');
    expect(tutorial.steps[1].validation.type).toBe('click');

    const validation = SchemaValidator.validateTutorial(tutorial);
    expect(validation.valid, `Validation errors: ${validation.errors.join(', ')}`).toBe(true);
  });
});
