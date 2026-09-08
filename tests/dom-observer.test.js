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

test('DomObserver.findElement resolves hover-triggered flyout items by dispatching synthetic hover events', () => {
  const originalDocument = globalThis.document;
  const dispatchedEvents = [];

  const triggerButton = {
    tagName: 'BUTTON',
    id: 'nav-account',
    textContent: 'Account',
    offsetParent: {},
    getClientRects: () => [{}],
    getAttribute: () => null,
    dispatchEvent: (evt) => {
      dispatchedEvents.push(evt.type);
    },
  };

  const flyoutItem = {
    tagName: 'A',
    id: 'nav-logout',
    textContent: 'Sign out',
    offsetParent: {},
    getClientRects: () => [{}],
    getAttribute: () => null,
  };

  globalThis.document = {
    querySelectorAll(selector) {
      if (selector === '#nav-account' || selector.includes('#nav-account')) return [triggerButton];
      if (selector === '#nav-logout' || selector.includes('#nav-logout')) return [flyoutItem];
      return [];
    },
    querySelector(selector) {
      if (selector === '#nav-account') return triggerButton;
      if (selector === '#nav-logout') return flyoutItem;
      return null;
    },
  };

  try {
    const selector = {
      css: '#nav-logout',
      text: 'Sign out',
      hoverTrigger: { css: '#nav-account' },
    };

    const found = DomObserver.findElement(selector);
    assert.strictEqual(found, flyoutItem);
    assert.ok(dispatchedEvents.includes('mouseover') || dispatchedEvents.includes('mouseenter'));
  } finally {
    globalThis.document = originalDocument;
  }
});

test('DomObserver.findElement respects container scoping to disambiguate identical elements', () => {
  const originalDocument = globalThis.document;

  const bgButton = createButton('Submit');
  bgButton.id = 'bg-submit';

  const modalButton = createButton('Submit');
  modalButton.id = 'modal-submit';

  const modalDialog = {
    tagName: 'DIALOG',
    querySelector(selector) {
      if (selector === 'button' || selector.includes('button')) return modalButton;
      return null;
    },
    querySelectorAll(selector) {
      if (selector.includes('button')) return [modalButton];
      return [];
    },
  };

  globalThis.document = {
    querySelector(selector) {
      if (selector.includes('dialog') || selector.includes('.modal')) return modalDialog;
      if (selector === '#bg-submit') return bgButton;
      if (selector === '#modal-submit') return modalButton;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'button') return [bgButton, modalButton];
      return [];
    },
  };

  try {
    const found = DomObserver.findElement({
      css: 'button',
      text: 'Submit',
      container: 'dialog[open], [role="dialog"], .modal',
    });
    assert.strictEqual(found, modalButton);
  } finally {
    globalThis.document = originalDocument;
  }
});

