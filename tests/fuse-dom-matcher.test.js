import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  harvestInteractiveElements,
  safeIdSelector,
} from '../packages/engine/src/dynamic/dom-harvester.js';
import {
  matchDomElementWithFuse,
  deriveConcreteSelector,
  synthesizeGroundedTutorial,
} from '../packages/engine/src/dynamic/fuse-dom-matcher.js';
import { DynamicPageAnalyzer } from '../packages/engine/src/dynamic/dynamic-analyzer.js';
import { SchemaValidator } from '../packages/tutorial-schema/src/schema-validator.js';

describe('Fuse.js DOM Scanner & Grounded Matcher Tests', () => {
  // Helper to create mock elements
  function createMockElement(tag, { id = '', text = '', ariaLabel = '', placeholder = '', testId = '', inModal = false } = {}) {
    const el = {
      tagName: tag.toUpperCase(),
      id,
      textContent: text,
      placeholder,
      className: '',
      closest: (selector) => {
        if (inModal && (selector.includes('dialog') || selector.includes('modal'))) {
          return { tagName: 'DIALOG' };
        }
        return null;
      },
      getAttribute: (attr) => {
        if (attr === 'aria-label') return ariaLabel;
        if (attr === 'data-testid') return testId;
        if (attr === 'placeholder') return placeholder;
        if (attr === 'type') return tag === 'input' ? 'text' : '';
        return null;
      },
      getBoundingClientRect: () => ({ top: 100, left: 100, bottom: 140, right: 200, width: 100, height: 40 }),
    };
    return el;
  }

  function createMockDoc(elements = []) {
    return {
      querySelectorAll: (sel) => {
        return elements;
      },
    };
  }

  test('harvestInteractiveElements extracts valid candidates with identifiers', () => {
    const btn1 = createMockElement('button', { id: 'btn-share', text: 'Share' });
    const input1 = createMockElement('input', { placeholder: 'Search anything...' });
    const hidden = createMockElement('button', { text: '' }); // empty, should be filtered

    const doc = createMockDoc([btn1, input1, hidden]);
    const candidates = harvestInteractiveElements(doc);

    assert.strictEqual(candidates.length, 2);
    assert.strictEqual(candidates[0].text, 'Share');
    assert.strictEqual(candidates[0].id, 'btn-share');
    assert.strictEqual(candidates[1].placeholder, 'Search anything...');
  });

  test('matchDomElementWithFuse matches exact and fuzzy targetQuery', () => {
    const btnShare = createMockElement('button', { id: 'btn-share', text: 'Share' });
    const btnSave = createMockElement('button', { id: 'btn-save', text: 'Save changes' });
    const inputSearch = createMockElement('input', { placeholder: 'Search...' });

    const doc = createMockDoc([btnShare, btnSave, inputSearch]);
    const candidates = harvestInteractiveElements(doc);

    // Exact match
    const match1 = matchDomElementWithFuse(candidates, { targetQuery: 'Share', action: 'click' });
    assert.ok(match1);
    assert.strictEqual(match1.id, 'btn-share');
    assert.strictEqual(match1.derivedSelector, '#btn-share');

    // Fuzzy typo match ("shre" -> "Share")
    const match2 = matchDomElementWithFuse(candidates, { targetQuery: 'shre', action: 'click' });
    assert.ok(match2);
    assert.strictEqual(match2.id, 'btn-share');
  });

  test('matchDomElementWithFuse prioritizes elements inside active modals', () => {
    const bgClose = createMockElement('button', { text: 'Close', inModal: false });
    const modalClose = createMockElement('button', { id: 'modal-close', text: 'Close', inModal: true });

    const doc = createMockDoc([bgClose, modalClose]);
    const candidates = harvestInteractiveElements(doc);

    const match = matchDomElementWithFuse(candidates, { targetQuery: 'Close', action: 'click' });
    assert.ok(match);
    assert.strictEqual(match.id, 'modal-close');
  });

  test('deriveConcreteSelector generates safe selector escaping special characters', () => {
    assert.strictEqual(safeIdSelector(':6j'), '[id=":6j"]');
    assert.strictEqual(safeIdSelector('normal-id'), '#normal-id');

    const elColons = createMockElement('button', { id: ':r1:' });
    const selector = deriveConcreteSelector({ id: ':r1:', element: elColons, tag: 'button' });
    assert.strictEqual(selector, '[id=":r1:"]');
  });

  test('synthesizeGroundedTutorial produces schema compliant with SchemaValidator', () => {
    const btn = createMockElement('button', { id: 'share-btn', text: 'Share' });
    const candidates = harvestInteractiveElements(createMockDoc([btn]));
    const matched = matchDomElementWithFuse(candidates, { targetQuery: 'Share', action: 'click' });

    const tutorial = synthesizeGroundedTutorial(matched, {
      targetQuery: 'Share',
      action: 'click',
      role: 'button',
      category: 'share',
    });

    assert.ok(tutorial);
    assert.strictEqual(tutorial.steps.length, 1);
    assert.strictEqual(tutorial.steps[0].target.css, '#share-btn');
    assert.strictEqual(tutorial.steps[0].validation.type, 'click');

    const validation = SchemaValidator.validateTutorial(tutorial);
    assert.strictEqual(validation.valid, true, `Validation errors: ${validation.errors.join(', ')}`);
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

    assert.ok(tutorial);
    assert.strictEqual(tutorial.steps[0].target.css, '#export-btn');
    const validation = SchemaValidator.validateTutorial(tutorial);
    assert.strictEqual(validation.valid, true);
  });

  test('harvestInteractiveElements extracts collapsed menu elements and records parentMenu', () => {
    const triggerBtn = {
      tagName: 'BUTTON',
      id: 'menu-file',
      textContent: 'File',
      getAttribute: (attr) => (attr === 'aria-label' ? 'File' : null),
      getBoundingClientRect: () => ({ top: 10, left: 10, bottom: 40, right: 80, width: 70, height: 30 }),
    };

    const dropdownContainer = {
      parentElement: {
        querySelector: (sel) => triggerBtn,
      },
      querySelector: (sel) => triggerBtn,
    };

    const collapsedItem = {
      tagName: 'BUTTON',
      id: 'page-setup-btn',
      textContent: 'Page setup',
      className: '',
      closest: (sel) => (sel.includes('menu') || sel.includes('dropdown') ? dropdownContainer : null),
      getAttribute: (attr) => (attr === 'role' ? 'menuitem' : null),
      getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }),
    };

    const doc = createMockDoc([triggerBtn, collapsedItem]);
    const candidates = harvestInteractiveElements(doc);

    const setupCand = candidates.find((c) => c.text === 'Page setup');
    assert.ok(setupCand, 'Collapsed item should be captured');
    assert.strictEqual(setupCand.parentMenu, 'File');
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
    assert.ok(tutorial);
    assert.strictEqual(tutorial.steps.length, 2, 'Should create 2 sequential steps');
    
    // Step 1: Open parent menu
    assert.strictEqual(tutorial.steps[0].id, 'step-1');
    assert.ok(tutorial.steps[0].title.en.includes('File'));
    assert.strictEqual(tutorial.steps[0].target.text, 'File');
    assert.strictEqual(tutorial.steps[0].validation.type, 'click');

    // Step 2: Target item inside menu
    assert.strictEqual(tutorial.steps[1].id, 'step-2');
    assert.ok(tutorial.steps[1].title.en.includes('Page setup'));
    assert.strictEqual(tutorial.steps[1].target.css, '#page-setup-btn');
    assert.strictEqual(tutorial.steps[1].validation.type, 'click');

    const validation = SchemaValidator.validateTutorial(tutorial);
    assert.strictEqual(validation.valid, true, `Validation errors: ${validation.errors.join(', ')}`);
  });
});
