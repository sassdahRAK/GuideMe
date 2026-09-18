import { test } from 'node:test';
import assert from 'node:assert';
import { EventLog } from '../packages/reporting/src/event-log.js';

function withFakeChromeStorage(run) {
  const store = {};
  const fakeChrome = {
    storage: {
      local: {
        get(keys, cb) {
          const key = Array.isArray(keys) ? keys[0] : keys;
          cb({ [key]: store[key] || [] });
        },
        set(obj, cb) {
          Object.assign(store, obj);
          if (cb) cb();
        },
      },
    },
  };
  const original = globalThis.chrome;
  globalThis.chrome = fakeChrome;
  return Promise.resolve(run(store)).finally(() => {
    globalThis.chrome = original;
  });
}

test('EventLog persists typed events and never logs raw selector text', async () => {
  await withFakeChromeStorage(async (store) => {
    // Use a short debounce here so the test doesn't have to wait out the
    // production default (PERSIST_DEBOUNCE_MS) for the write to land.
    const log = new EventLog({ batchSize: 100, flushIntervalMs: 60000, persistDebounceMs: 10 });
    try {
      await new Promise((resolve) => setImmediate(resolve));

      log.guideStepStarted({ tutorialId: 't1', stepId: 's1', stepIndex: 0 });
      log.targetResolved({
        tutorialId: 't1',
        stepId: 's1',
        stepIndex: 0,
        tier: 1,
        source: 'dom',
        selector: { css: '#save', text: 'Save my secret document', ariaLabel: 'Save' },
      });
      log.guideStepSkipped({ tutorialId: 't1', stepId: 's2', stepIndex: 1 });

      // Persisted writes are debounced — wait past the debounce window.
      await new Promise((resolve) => setTimeout(resolve, 50));

      const events = store.guideme_reporting_events;
      assert.ok(Array.isArray(events));
      assert.strictEqual(events.length, 3);
      assert.strictEqual(events[0].type, 'guide_step_started');
      assert.strictEqual(events[1].type, 'target_resolved');
      assert.deepStrictEqual(events[1].selectorKinds.slice().sort(), ['ariaLabel', 'css', 'text']);
      assert.strictEqual(events[1].selector, undefined);
      assert.strictEqual(JSON.stringify(events).includes('Save my secret document'), false);
      assert.strictEqual(events[2].type, 'guide_step_skipped');
    } finally {
      log.destroy();
    }
  });
});

test('EventLog auto-flushes once the batch size is reached', () => {
  const log = new EventLog({ batchSize: 3, flushIntervalMs: 60000 });
  try {
    log.guideStepStarted({ tutorialId: 't1', stepId: 's1', stepIndex: 0 });
    log.guideStepCompleted({ tutorialId: 't1', stepId: 's1', stepIndex: 0 });
    assert.strictEqual(log._buffer.length, 2);
    log.guideCompleted({ tutorialId: 't1', totalSteps: 1 });
    assert.strictEqual(log._buffer.length, 0); // flushed automatically at batchSize
  } finally {
    log.destroy();
  }
});

test('EventLog reports target resolution failures with selector kind, not raw values', () => {
  const log = new EventLog({ batchSize: 100, flushIntervalMs: 60000 });
  try {
    log.targetResolutionFailed({
      tutorialId: 't1',
      stepId: 's3',
      stepIndex: 2,
      selector: { text: 'Delete my account' },
    });
    const event = log._buffer[log._buffer.length - 1];
    assert.strictEqual(event.type, 'target_resolution_failed');
    assert.deepStrictEqual(event.selectorKinds, ['text']);
    assert.strictEqual(JSON.stringify(event).includes('Delete my account'), false);
  } finally {
    log.destroy();
  }
});
