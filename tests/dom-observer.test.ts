import { DomObserver, safeIdSelector, sanitizeCssSelector } from '../packages/chrome-adapter/src/dom-observer.ts';
import { DomEventListener } from '../packages/chrome-adapter/src/event-listener.ts';

// ---------------------------------------------------------------------------
// Minimal mock element factory
// ---------------------------------------------------------------------------
interface MockElement {
  textContent: string;
  value: string;
  offsetParent: Record<string, unknown> | null;
  getClientRects: () => Record<string, unknown>[];
  getAttribute: (name: string) => string | null;
  id?: string;
  tagName?: string;
  isConnected?: boolean;
  matches?: (sel: string) => boolean;
  contains?: (el: unknown) => boolean;
}

function createButton(label: string): MockElement {
  return {
    textContent: label,
    value: '',
    offsetParent: {},
    getClientRects: () => [{}],
    getAttribute: () => null,
  };
}

// ---------------------------------------------------------------------------
// Helpers — use vi.stubGlobal because jsdom makes `document` a read-only
// getter on `window`; direct assignment throws in strict mode.
// ---------------------------------------------------------------------------
function stubDocument(mockDoc: unknown) {
  vi.stubGlobal('document', mockDoc);
}
function restoreDocument() {
  vi.unstubAllGlobals();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('DomObserver resolves the exact button when a broad CSS selector has text metadata', () => {
  const cancelButton = createButton('Cancel');
  const saveButton = createButton('Save changes');

  stubDocument({
    querySelectorAll(selector: string) {
      return selector === 'button' ? [cancelButton, saveButton] : [];
    },
  });

  try {
    expect(DomObserver.findElement({ css: 'button', text: 'Save changes' })).toBe(saveButton);
  } finally {
    restoreDocument();
  }
});

test('DomObserver does not fall back to an unrelated button while an exact captured target is absent', () => {
  const upgradeButton = createButton('Upgrade');

  stubDocument({
    querySelectorAll(selector: string) {
      if (selector === 'button' || selector.startsWith('button,')) return [upgradeButton];
      return [];
    },
  });

  try {
    expect(DomObserver.findElement({ css: 'button', text: 'Save' })).toBe(null);
  } finally {
    restoreDocument();
  }
});

test('DomObserver does not treat a partial button label as a captured target match', () => {
  const saveDraftButton = createButton('Save draft');

  stubDocument({
    querySelectorAll(selector: string) {
      if (selector === 'button' || selector.startsWith('button,')) return [saveDraftButton];
      return [];
    },
  });

  try {
    expect(DomObserver.findElement({ css: 'button', text: 'Save' })).toBe(null);
  } finally {
    restoreDocument();
  }
});

test('DomObserver resolves exact text on a generic menu container', () => {
  const fileMenu = {
    textContent: 'File',
    offsetParent: {},
    getClientRects: () => [{}],
    getAttribute: (name: string) => (name === 'role' ? 'menuitem' : null),
    closest: () => fileMenu,
  };

  stubDocument({
    querySelectorAll(selector: string) {
      return selector.includes('[role="menuitem"]') ? [fileMenu] : [];
    },
  });

  try {
    expect(DomObserver.findElement({ css: 'div', text: 'File' })).toBe(fileMenu);
  } finally {
    restoreDocument();
  }
});

test('DomObserver ignores a hidden matching target until it becomes visible', () => {
  const hiddenMenu = {
    textContent: 'New',
    offsetParent: null,
    getClientRects: () => [] as Record<string, unknown>[],
    getAttribute: () => null,
  };

  stubDocument({
    querySelectorAll(selector: string) {
      return selector === 'div' ? [hiddenMenu] : [];
    },
  });

  try {
    expect(DomObserver.findElement({ css: 'div', text: 'New' })).toBe(null);
  } finally {
    restoreDocument();
  }
});

test('DomObserver does not match target text inside an unrelated ARIA label', () => {
  const commentsButton = {
    textContent: '0',
    offsetParent: {},
    getClientRects: () => [{}],
    getAttribute: (name: string) => (name === 'aria-label' ? 'Show all comments 0 new comments' : null),
  };
  const newMenuItem = {
    textContent: 'New',
    offsetParent: {},
    getClientRects: () => [{}],
    getAttribute: () => null,
  };

  stubDocument({
    querySelectorAll(selector: string) {
      if (selector === '.goog-menuitem') return [];
      if (selector.includes('[role="menuitem"]')) return [newMenuItem];
      if (selector.includes('button')) return [commentsButton];
      return [];
    },
  });

  try {
    expect(DomObserver.findElement({ css: '.goog-menuitem', text: 'New' })).toBe(newMenuItem);
  } finally {
    restoreDocument();
  }
});

test('DomObserver does not resolve a menu target to a broad page banner', () => {
  const docsChrome = {
    id: 'docs-chrome',
    textContent: 'Untitled document File New Document',
    offsetParent: {},
    getClientRects: () => [{}],
    getAttribute: () => null,
  };

  stubDocument({
    querySelectorAll(selector: string) {
      if (selector === '.apps-menuitem') return [];
      if (selector.includes('button') || selector.includes('[role="menuitem"]')) return [];
      if (selector.includes('span, div, p')) return [docsChrome];
      return [];
    },
  });

  try {
    expect(DomObserver.findElement({ css: '.apps-menuitem', text: 'New' })).toBe(null);
  } finally {
    restoreDocument();
  }
});

test('DomObserver captures a resilient selector from a user-picked element', () => {
  const element = {
    tagName: 'BUTTON',
    id: 'save-profile',
    textContent: 'Save profile',
    value: '',
    getAttribute: (name: string) =>
      ({ 'aria-label': 'Save profile', 'data-testid': 'profile-save' } as Record<string, string>)[name] || null,
  };

  expect(DomObserver.createTargetSelector(element)).toEqual({
    css: '#save-profile',
    testId: 'profile-save',
    ariaLabel: 'Save profile',
    text: 'Save profile',
  });
});

test('DomObserver.findElement resolves hover-triggered flyout items by dispatching synthetic hover events', () => {
  const dispatchedEvents: string[] = [];

  // ownerDocument.defaultView must be null so dispatchHoverEvents uses view:null
  // in its event options, avoiding jsdom's real window which makes PointerEvent
  // constructor throw (caught silently, preventing our dispatchEvent spy from firing).
  const mockDoc = { defaultView: null, querySelectorAll: () => [], querySelector: () => null };

  const triggerButton = {
    tagName: 'BUTTON',
    id: 'nav-account',
    textContent: 'Account',
    offsetParent: {},
    getClientRects: () => [{}],
    getAttribute: () => null,
    ownerDocument: mockDoc,
    dispatchEvent: (evt: Event) => { dispatchedEvents.push(evt.type); },
  };

  const flyoutItem = {
    tagName: 'A',
    id: 'nav-logout',
    textContent: 'Sign out',
    offsetParent: {},
    getClientRects: () => [{}],
    getAttribute: () => null,
    ownerDocument: mockDoc,
  };

  stubDocument({
    querySelectorAll(selector: string) {
      if (selector === '#nav-account' || selector.includes('#nav-account')) return [triggerButton];
      if (selector === '#nav-logout' || selector.includes('#nav-logout')) return [flyoutItem];
      return [];
    },
    querySelector(selector: string) {
      if (selector === '#nav-account') return triggerButton;
      if (selector === '#nav-logout') return flyoutItem;
      return null;
    },
  });

  // Stub PointerEvent to a dummy class so jsdom doesn't throw a TypeError
  // ("member view is not of type Window") when dispatching on our plain object mock.
  vi.stubGlobal('PointerEvent', class {
    type: string;
    constructor(type: string) { this.type = type; }
  });

  try {
    const found = DomObserver.findElement({
      css: '#nav-logout',
      text: 'Sign out',
      hoverTrigger: { css: '#nav-account' },
    });
    expect(found).toBe(flyoutItem);
    expect(dispatchedEvents.includes('mouseover') || dispatchedEvents.includes('mouseenter') || dispatchedEvents.includes('pointerover')).toBeTruthy();
  } finally {
    vi.unstubAllGlobals();
    restoreDocument();
  }
});

test('DomObserver.findElement respects container scoping to disambiguate identical elements', () => {
  const bgButton = createButton('Submit');
  (bgButton as Record<string, unknown>).id = 'bg-submit';

  const modalButton = createButton('Submit');
  (modalButton as Record<string, unknown>).id = 'modal-submit';

  const modalDialog = {
    tagName: 'DIALOG',
    querySelector(selector: string) {
      if (selector === 'button' || selector.includes('button')) return modalButton;
      return null;
    },
    querySelectorAll(selector: string) {
      if (selector.includes('button')) return [modalButton];
      return [];
    },
  };

  stubDocument({
    querySelector(selector: string) {
      if (selector.includes('dialog') || selector.includes('.modal')) return modalDialog;
      if (selector === '#bg-submit') return bgButton;
      if (selector === '#modal-submit') return modalButton;
      return null;
    },
    querySelectorAll(selector: string) {
      if (selector === 'button') return [bgButton, modalButton];
      return [];
    },
  });

  try {
    const found = DomObserver.findElement({
      css: 'button',
      text: 'Submit',
      container: 'dialog[open], [role="dialog"], .modal',
    });
    expect(found).toBe(modalButton);
  } finally {
    restoreDocument();
  }
});

test('safeIdSelector and sanitizeCssSelector handle colon IDs and invalid CSS identifiers', () => {
  expect(safeIdSelector(':6j')).toBe('[id=":6j"]');
  expect(safeIdSelector(':a7')).toBe('[id=":a7"]');
  expect(safeIdSelector('123')).toBe('[id="123"]');
  expect(safeIdSelector('normal-id')).toBe('#normal-id');
  expect(safeIdSelector('btn_save')).toBe('#btn_save');

  expect(sanitizeCssSelector('#:6j')).toBe('[id=":6j"]');
  expect(sanitizeCssSelector('#:a7')).toBe('[id=":a7"]');
  expect(sanitizeCssSelector('div #:6j button')).toBe('div [id=":6j"] button');
  expect(sanitizeCssSelector('#safe-id')).toBe('#safe-id');
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
  expect(target.css).toBe('[id=":6j"]');
});

test('DomObserver.findElement heals invalid selector string like #:6j without throwing', () => {
  const targetElement = createButton('Compose');
  (targetElement as Record<string, unknown>).id = ':6j';

  stubDocument({
    querySelectorAll(selector: string) {
      if (selector === '#:6j') {
        throw new Error("Failed to execute 'querySelectorAll' on 'Document': '#:6j' is not a valid selector.");
      }
      if (selector === '[id=":6j"]') return [targetElement];
      return [];
    },
    querySelector() { return null; },
  });

  try {
    const found = DomObserver.findElement({ css: '#:6j' });
    expect(found).toBe(targetElement);
  } finally {
    restoreDocument();
  }
});

test('DomEventListener safely handles invalid selector like #:6j without throwing SyntaxError', () => {
  let registeredListener: ((e: unknown) => void) | null = null;

  const targetElement: MockElement = {
    tagName: 'BUTTON',
    id: ':6j',
    isConnected: true,
    textContent: '',
    value: '',
    offsetParent: {},
    getClientRects: () => [{}],
    matches(sel: string) {
      if (sel === '#:6j') throw new Error("Failed to execute 'matches' on 'Element': '#:6j' is not a valid selector.");
      return sel === '[id=":6j"]';
    },
    contains() { return false; },
    getAttribute: () => null,
  };

  stubDocument({
    addEventListener(evt: string, handler: (e: unknown) => void) {
      registeredListener = handler;
    },
    removeEventListener() {},
    querySelectorAll(sel: string) {
      if (sel === '#:6j') throw new Error('invalid selector');
      if (sel === '[id=":6j"]') return [targetElement];
      return [];
    },
    querySelector() { return null; },
  });

  try {
    let triggered = false;
    const unsub = DomEventListener.listen({ css: '#:6j' }, 'click', () => { triggered = true; });

    expect(() => {
      registeredListener!({ target: targetElement, key: undefined });
    }).not.toThrow();

    expect(triggered).toBe(true);
    unsub();
  } finally {
    restoreDocument();
  }
});

test('DomObserver prioritizes leaf interactive control (e.g. Paper size dropdown) over the modal dialog container itself when modal is open', () => {
  const paperSizeDropdown = {
    tagName: 'DIV',
    className: 'goog-inline-block goog-flat-menu-button',
    textContent: 'A4 (21.0 cm x 29.7 cm)',
    offsetParent: {},
    getClientRects: () => [{ width: 180, height: 32 }],
    getAttribute: (attr: string) => (attr === 'role' ? 'listbox' : null),
    matches: (sel: string) => sel.includes('goog-flat-menu-button') || sel.includes('listbox'),
    contains: () => false,
  };

  const modalDialog = {
    tagName: 'DIV',
    className: 'modal-dialog',
    textContent: 'Page setup Pages Pageless Paper size A4 (21.0 cm x 29.7 cm) OK Cancel',
    offsetParent: {},
    getClientRects: () => [{ width: 500, height: 400 }],
    getAttribute: (attr: string) => (attr === 'role' ? 'dialog' : null),
    matches: (sel: string) => sel.includes('dialog') || sel.includes('modal'),
    contains: (el: unknown) => el === paperSizeDropdown || el === modalDialog,
    querySelectorAll: (sel: string) => {
      if (sel.includes('goog-flat-menu-button') || sel.includes('listbox') || sel.includes('button')) {
        return [paperSizeDropdown];
      }
      return [];
    },
  };

  stubDocument({
    querySelectorAll(sel: string) {
      if (sel.includes('dialog') || sel.includes('modal')) return [modalDialog];
      if (sel.includes('goog-flat-menu-button') || sel.includes('listbox')) return [paperSizeDropdown];
      return [];
    },
    querySelector(sel: string) {
      if (sel.includes('dialog') || sel.includes('modal')) return modalDialog;
      return null;
    },
  });

  try {
    const found = DomObserver.findElement({
      css: '.modal-dialog, [role="dialog"], [role="listbox"], .goog-flat-menu-button',
      text: 'A4',
    });
    expect(found, 'Should return the dropdown control, NOT the modal dialog container').toBe(paperSizeDropdown);
  } finally {
    restoreDocument();
  }
});
