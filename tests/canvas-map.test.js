import { test } from 'node:test';
import assert from 'node:assert';
import { registerCanvasMap, unregisterCanvasMap, resolveCanvasTarget } from '../packages/chrome-adapter/src/targeting/canvas-map.js';

function makeCanvas({
  cssWidth = 800,
  cssHeight = 450,
  internalWidth = 1600,
  internalHeight = 900,
  matchesSelector = '#editor-canvas',
} = {}) {
  return {
    tagName: 'CANVAS',
    width: internalWidth,
    height: internalHeight,
    getBoundingClientRect: () => ({
      top: 100,
      left: 50,
      width: cssWidth,
      height: cssHeight,
      bottom: 100 + cssHeight,
      right: 50 + cssWidth,
    }),
    getClientRects: () => [{}],
    offsetParent: {},
    matches: (sel) => sel === matchesSelector,
    parentElement: null,
  };
}

test('resolveCanvasTarget returns Tier 2 container box when no map is registered', () => {
  const canvas = makeCanvas();
  const result = resolveCanvasTarget(canvas, { css: '#unregistered' });
  assert.strictEqual(result.tier, 2);
  assert.strictEqual(result.source, 'canvas-container');
  assert.strictEqual(result.rect.left, 50);
  assert.strictEqual(result.rect.width, 800);
});

test('registerCanvasMap + resolveCanvasTarget scales a region to screen coordinates', () => {
  const canvas = makeCanvas();
  registerCanvasMap('#editor-canvas', {
    version: '1.2.3',
    detectVersion: () => '1.2.3',
    regions: [{ id: 'play-button', x: 100, y: 800, width: 60, height: 60 }],
  });
  try {
    const result = resolveCanvasTarget(canvas, { css: '#editor-canvas', region: 'play-button' });
    assert.strictEqual(result.tier, 3);
    assert.strictEqual(result.source, 'canvas-map:1.2.3:play-button');
    // scaleX = 800/1600 = 0.5, scaleY = 450/900 = 0.5
    assert.strictEqual(result.rect.left, 100);
    assert.strictEqual(result.rect.top, 500);
    assert.strictEqual(result.rect.width, 30);
    assert.strictEqual(result.rect.height, 30);
  } finally {
    unregisterCanvasMap('#editor-canvas');
  }
});

test('version mismatch never guesses — downgrades to Tier 2 and reports the mismatch', () => {
  const canvas = makeCanvas();
  registerCanvasMap('#editor-canvas', {
    version: '1.2.3',
    detectVersion: () => '2.0.0',
    regions: [{ id: 'play-button', x: 100, y: 800, width: 60, height: 60 }],
  });
  try {
    const result = resolveCanvasTarget(canvas, { css: '#editor-canvas', region: 'play-button' });
    assert.strictEqual(result.tier, 2);
    assert.strictEqual(result.source, 'canvas-container:version-mismatch');
    assert.deepStrictEqual(result.versionMismatch, { expected: '1.2.3', detected: '2.0.0' });
  } finally {
    unregisterCanvasMap('#editor-canvas');
  }
});

test('an unrecognized region id downgrades to Tier 2 instead of guessing', () => {
  const canvas = makeCanvas();
  registerCanvasMap('#editor-canvas', {
    version: '1.0.0',
    detectVersion: () => '1.0.0',
    regions: [{ id: 'play-button', x: 0, y: 0, width: 10, height: 10 }],
  });
  try {
    const result = resolveCanvasTarget(canvas, { css: '#editor-canvas', region: 'does-not-exist' });
    assert.strictEqual(result.tier, 2);
    assert.strictEqual(result.source, 'canvas-container:no-region');
  } finally {
    unregisterCanvasMap('#editor-canvas');
  }
});
