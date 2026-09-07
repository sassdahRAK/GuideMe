import { test } from 'node:test';
import assert from 'node:assert';
import { DomObserver } from '../packages/chrome-adapter/src/dom-observer.js';

function createButton(label) {
  return {
    textContent: label,
    value: '',
    offsetParent: {},
    getClientRects: () => [{}],
    getAttribute: () => null,
  };
}

test('DomObserver resolves the exact button when a broad CSS selector has text metadata', () => {
  const originalDocument = globalThis.document;
  const cancelButton = createButton('Cancel');
  const saveButton = createButton('Save changes');

  globalThis.document = {
    querySelectorAll(selector) {
      return selector === 'button' ? [cancelButton, saveButton] : [];
    },
  };

  try {
    assert.strictEqual(
      DomObserver.findElement({ css: 'button', text: 'Save changes' }),
      saveButton,
    );
  } finally {
    globalThis.document = originalDocument;
  }
});

test('DomObserver does not fall back to an unrelated button while an exact captured target is absent', () => {
  const originalDocument = globalThis.document;
  const upgradeButton = createButton('Upgrade');

  globalThis.document = {
    querySelectorAll(selector) {
      if (selector === 'button' || selector.startsWith('button,')) return [upgradeButton];
      return [];
    },
  };

  try {
    assert.strictEqual(
      DomObserver.findElement({ css: 'button', text: 'Save' }),
      null,
    );
  } finally {
    globalThis.document = originalDocument;
  }
});

test('DomObserver does not treat a partial button label as a captured target match', () => {
  const originalDocument = globalThis.document;
  const saveDraftButton = createButton('Save draft');

  globalThis.document = {
    querySelectorAll(selector) {
      if (selector === 'button' || selector.startsWith('button,')) return [saveDraftButton];
      return [];
    },
  };

  try {
    assert.strictEqual(
      DomObserver.findElement({ css: 'button', text: 'Save' }),
      null,
    );
  } finally {
    globalThis.document = originalDocument;
  }
});

test('DomObserver captures a resilient selector from a user-picked element', () => {
  const element = {
    tagName: 'BUTTON',
    id: 'save-profile',
    textContent: 'Save profile',
    value: '',
    getAttribute: (name) => ({ 'aria-label': 'Save profile', 'data-testid': 'profile-save' }[name] || null),
  };

  assert.deepStrictEqual(DomObserver.createTargetSelector(element), {
    css: '#save-profile',
    testId: 'profile-save',
    ariaLabel: 'Save profile',
    text: 'Save profile',
  });
});
