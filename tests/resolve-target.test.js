import { test } from 'node:test';
import assert from 'node:assert';
import { resolveTarget } from '../packages/chrome-adapter/src/targeting/resolve-target.js';

function makeDoc({ cssMatches = {} } = {}) {
  const body = {
    tagName: 'BODY',
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 1024, height: 768, bottom: 768, right: 1024 }),
    getClientRects: () => [{}],
    offsetParent: null,
    parentElement: null,
  };
  return {
    body,
    documentElement: { tagName: 'HTML' },
    querySelectorAll(sel) {
      if (sel === 'iframe, frame' || sel === '*') return [];
      return cssMatches[sel] || [];
    },
    querySelector() {
      return null;
    },
  };
}

test('resolveTarget resolves a plain DOM element at Tier 1', async () => {
  const original = globalThis.document;
  const el = {
    tagName: 'BUTTON',
    getBoundingClientRect: () => ({ top: 5, left: 5, width: 50, height: 20, bottom: 25, right: 55 }),
    getClientRects: () => [{}],
    offsetParent: {},
    getAttribute: () => null,
    textContent: '',
    value: '',
    parentElement: null,
  };
  globalThis.document = makeDoc({ cssMatches: { button: [el] } });
  try {
    const result = await resolveTarget({ css: 'button' });
    assert.strictEqual(result.tier, 1);
    assert.strictEqual(result.source, 'dom');
    assert.strictEqual(result.rect.left, 5);
    assert.strictEqual(result.rect.top, 5);
  } finally {
    globalThis.document = original;
  }
});

test('resolveTarget routes a <canvas> element to Tier 2 when no map is registered', async () => {
  const original = globalThis.document;
  const canvas = {
    tagName: 'CANVAS',
    width: 1600,
    height: 900,
    getBoundingClientRect: () => ({ top: 10, left: 10, width: 800, height: 450, bottom: 460, right: 810 }),
    getClientRects: () => [{}],
    offsetParent: {},
    getAttribute: () => null,
    matches: () => false,
    parentElement: null,
  };
  globalThis.document = makeDoc({ cssMatches: { '#stage': [canvas] } });
  try {
    const result = await resolveTarget({ css: '#stage' });
    assert.strictEqual(result.tier, 2);
    assert.strictEqual(result.source, 'canvas-container');
    assert.strictEqual(result.rect.width, 800);
  } finally {
    globalThis.document = original;
  }
});

test('resolveTarget falls back to the viewport with a directional hint when nothing resolves', async () => {
  const original = globalThis.document;
  globalThis.document = makeDoc({ cssMatches: {} });
  try {
    const result = await resolveTarget({ css: '.totally-missing', text: 'Export' });
    assert.strictEqual(result.tier, 'fallback');
    assert.strictEqual(result.source, 'fallback:viewport');
    assert.strictEqual(result.hintScope, 'viewport');
    assert.strictEqual(result.hintLabel, 'Export');
    assert.strictEqual(result.rect.width, 1024);
  } finally {
    globalThis.document = original;
  }
});

test('resolveTarget walks into a same-origin iframe and offsets the rect to window.top', async () => {
  const originalDocument = globalThis.document;

  const innerButton = {
    tagName: 'BUTTON',
    getBoundingClientRect: () => ({ top: 5, left: 5, width: 40, height: 20, bottom: 25, right: 45 }),
    getClientRects: () => [{}],
    offsetParent: {},
    getAttribute: () => null,
    textContent: '',
    value: '',
    parentElement: null,
  };

  const iframeEl = {
    tagName: 'IFRAME',
    getBoundingClientRect: () => ({ top: 100, left: 200, width: 300, height: 200, bottom: 300, right: 500 }),
  };

  const outerWindow = {};
  outerWindow.top = outerWindow;

  const innerDoc = {
    body: { tagName: 'BODY' },
    documentElement: { tagName: 'HTML' },
    querySelectorAll(sel) {
      if (sel === 'iframe, frame' || sel === '*') return [];
      return sel === '#save' ? [innerButton] : [];
    },
    querySelector() {
      return null;
    },
  };
  innerDoc.defaultView = { top: outerWindow, parent: outerWindow, frameElement: iframeEl };
  iframeEl.contentDocument = innerDoc;

  const topDoc = {
    body: { tagName: 'BODY' },
    documentElement: { tagName: 'HTML' },
    querySelectorAll(sel) {
      if (sel === 'iframe, frame') return [iframeEl];
      return [];
    },
    querySelector() {
      return null;
    },
  };

  globalThis.document = topDoc;
  try {
    const result = await resolveTarget({ css: '#save' });
    assert.strictEqual(result.tier, 1);
    assert.strictEqual(result.source, 'dom:same-origin-iframe');
    assert.strictEqual(result.rect.left, 205);
    assert.strictEqual(result.rect.top, 105);
  } finally {
    globalThis.document = originalDocument;
  }
});
