import { test } from 'node:test';
import assert from 'node:assert';
import { anchor } from '../packages/chrome-adapter/src/targeting/anchor.js';

function flush(times = 5) {
  return new Promise((resolve) => {
    let n = 0;
    const step = () => {
      n += 1;
      if (n >= times) return resolve();
      setImmediate(step);
    };
    setImmediate(step);
  });
}

function makeElement(rect) {
  return {
    tagName: 'BUTTON',
    _rect: rect,
    getBoundingClientRect() {
      return this._rect;
    },
    getClientRects() {
      return [this._rect];
    },
    offsetParent: {},
    getAttribute: () => null,
    textContent: '',
    value: '',
    parentElement: null,
  };
}

test('anchor() resolves fresh on every mutation and cleans up on unobserve', async () => {
  const original = {
    document: globalThis.document,
    window: globalThis.window,
    MutationObserver: globalThis.MutationObserver,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };

  const el = makeElement({ top: 10, left: 10, width: 100, height: 40, bottom: 50, right: 110 });

  let observedCallback = null;
  class FakeMutationObserver {
    constructor(cb) {
      observedCallback = cb;
    }
    observe() {}
    disconnect() {}
  }

  const listeners = {};
  globalThis.window = {
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
    removeEventListener(type, fn) {
      if (listeners[type] === fn) delete listeners[type];
    },
  };
  globalThis.document = {
    body: {
      tagName: 'BODY',
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 800, height: 600, bottom: 600, right: 800 }),
    },
    documentElement: { tagName: 'HTML' },
    querySelectorAll(sel) {
      if (sel === 'iframe, frame' || sel === '*') return [];
      if (sel === 'button') return [el];
      return [];
    },
    querySelector() {
      return null;
    },
  };
  globalThis.MutationObserver = FakeMutationObserver;
  globalThis.requestAnimationFrame = (fn) => {
    setImmediate(fn);
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {};

  try {
    const results = [];
    const unobserve = anchor({ css: 'button' }, (result) => results.push(result));

    await flush();
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].tier, 1);
    assert.strictEqual(results[0].rect.left, 10);

    // A no-op mutation (element hasn't actually moved) must not re-emit.
    observedCallback([]);
    await flush();
    assert.strictEqual(results.length, 1);

    // Move the element and trigger a mutation — anchor() must recompute
    // fresh (never reuse the cached rect) and report the new position.
    el._rect = { top: 60, left: 10, width: 100, height: 40, bottom: 100, right: 110 };
    observedCallback([]);
    await flush();
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[1].rect.top, 60);

    unobserve();
    assert.strictEqual(listeners.scroll, undefined);
    assert.strictEqual(listeners.resize, undefined);

    // Further mutations after unobserve() must not schedule any more work.
    observedCallback([]);
    await flush();
    assert.strictEqual(results.length, 2);
  } finally {
    globalThis.document = original.document;
    globalThis.window = original.window;
    globalThis.MutationObserver = original.MutationObserver;
    globalThis.requestAnimationFrame = original.requestAnimationFrame;
    globalThis.cancelAnimationFrame = original.cancelAnimationFrame;
  }
});
