import { test } from 'node:test';
import assert from 'node:assert';
import { DomObserver, safeIdSelector, sanitizeCssSelector } from '../packages/chrome-adapter/src/dom-observer.js';
import { DomEventListener } from '../packages/chrome-adapter/src/event-listener.js';

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

test('safeIdSelector and sanitizeCssSelector handle colon IDs and invalid CSS identifiers', () => {
  assert.strictEqual(safeIdSelector(':6j'), '[id=":6j"]');
  assert.strictEqual(safeIdSelector(':a7'), '[id=":a7"]');
  assert.strictEqual(safeIdSelector('123'), '[id="123"]');
  assert.strictEqual(safeIdSelector('normal-id'), '#normal-id');
  assert.strictEqual(safeIdSelector('btn_save'), '#btn_save');

  assert.strictEqual(sanitizeCssSelector('#:6j'), '[id=":6j"]');
  assert.strictEqual(sanitizeCssSelector('#:a7'), '[id=":a7"]');
  assert.strictEqual(sanitizeCssSelector('div #:6j button'), 'div [id=":6j"] button');
  assert.strictEqual(sanitizeCssSelector('#safe-id'), '#safe-id');
});

test('DomObserver.createTargetSelector generates safe selector for elements with colon ID (:6j, :a7)', () => {
  const el = {
    tagName: 'DIV',
    id: ':6j',
    textContent: 'Send message',
    value: '',
    getAttribute: () => null,
  };

  const target = DomObserver.createTargetSelector(el);
  assert.strictEqual(target.css, '[id=":6j"]');
});

test('DomObserver.findElement heals invalid selector string like #:6j without throwing', () => {
  const originalDocument = globalThis.document;
  const targetElement = createButton('Compose');
  targetElement.id = ':6j';

  globalThis.document = {
    querySelectorAll(selector) {
      if (selector === '#:6j') {
        throw new Error("Failed to execute 'querySelectorAll' on 'Document': '#:6j' is not a valid selector.");
      }
      if (selector === '[id=":6j"]') {
        return [targetElement];
      }
      return [];
    },
    querySelector() { return null; },
  };

  try {
    const found = DomObserver.findElement({ css: '#:6j' });
    assert.strictEqual(found, targetElement);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('DomEventListener safely handles invalid selector like #:6j without throwing SyntaxError', () => {
  const originalDocument = globalThis.document;
  let registeredListener = null;

  const targetElement = {
    tagName: 'BUTTON',
    id: ':6j',
    isConnected: true,
    matches(sel) {
      if (sel === '#:6j') {
        throw new Error("Failed to execute 'matches' on 'Element': '#:6j' is not a valid selector.");
      }
      return sel === '[id=":6j"]';
    },
    contains() { return false; },
  };

  globalThis.document = {
    addEventListener(evt, handler) {
      registeredListener = handler;
    },
    removeEventListener() {},
    querySelectorAll(sel) {
      if (sel === '#:6j') throw new Error("invalid selector");
      if (sel === '[id=":6j"]') return [targetElement];
      return [];
    },
    querySelector() { return null; },
  };

  try {
    let triggered = false;
    const unsub = DomEventListener.listen({ css: '#:6j' }, 'click', () => {
      triggered = true;
    });

    assert.doesNotThrow(() => {
      registeredListener({
        target: targetElement,
        key: undefined,
      });
    });

    assert.strictEqual(triggered, true);
    unsub();
  } finally {
    globalThis.document = originalDocument;
  }
});

test('DomObserver prioritizes leaf interactive control (e.g. Paper size dropdown) over the modal dialog container itself when modal is open', () => {
  const originalDocument = globalThis.document;

  const paperSizeDropdown = {
    tagName: 'DIV',
    className: 'goog-inline-block goog-flat-menu-button',
    textContent: 'A4 (21.0 cm x 29.7 cm)',
    offsetParent: {},
    getClientRects: () => [{ width: 180, height: 32 }],
    getAttribute: (attr) => (attr === 'role' ? 'listbox' : null),
    matches: (sel) => sel.includes('goog-flat-menu-button') || sel.includes('listbox'),
    contains: () => false,
  };

  const modalDialog = {
    tagName: 'DIV',
    className: 'modal-dialog',
    textContent: 'Page setup Pages Pageless Paper size A4 (21.0 cm x 29.7 cm) OK Cancel',
    offsetParent: {},
    getClientRects: () => [{ width: 500, height: 400 }],
    getAttribute: (attr) => (attr === 'role' ? 'dialog' : null),
    matches: (sel) => sel.includes('dialog') || sel.includes('modal'),
    contains: (el) => el === paperSizeDropdown || el === modalDialog,
    querySelectorAll: (sel) => {
      if (sel.includes('goog-flat-menu-button') || sel.includes('listbox') || sel.includes('button')) {
        return [paperSizeDropdown];
      }
      return [];
    },
  };

  globalThis.document = {
    querySelectorAll(sel) {
      if (sel.includes('dialog') || sel.includes('modal')) {
        return [modalDialog];
      }
      if (sel.includes('goog-flat-menu-button') || sel.includes('listbox')) {
        return [paperSizeDropdown];
      }
      return [];
    },
    querySelector(sel) {
      if (sel.includes('dialog') || sel.includes('modal')) {
        return modalDialog;
      }
      return null;
    },
  };

  try {
    const found = DomObserver.findElement({
      css: '.modal-dialog, [role="dialog"], [role="listbox"], .goog-flat-menu-button',
      text: 'A4',
    });

    assert.strictEqual(found, paperSizeDropdown, 'Should return the dropdown control, NOT the modal dialog container');
  } finally {
    globalThis.document = originalDocument;
  }
});

