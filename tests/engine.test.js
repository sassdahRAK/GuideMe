import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  TutorialEngine,
  StateMachine,
  TutorialParser,
  StepResolver,
  EventBus,
  VariableStore,
} from '../packages/engine/src/index.js';
import { BaseTutorialAdapter } from '../packages/adapter-interface/src/index.js';
import { EngineStatus } from '../packages/core-types/src/index.js';

// Mock in-memory Adapter for testing headless engine logic
class MockAdapter extends BaseTutorialAdapter {
  constructor() {
    super();
    this.progressStore = new Map();
    this.eventListeners = new Map();
  }

  async findTarget(selector) {
    if (selector.css === '#non-existent') return null;
    return {
      x: 100,
      y: 200,
      width: 80,
      height: 32,
      top: 200,
      left: 100,
      bottom: 232,
      right: 180,
    };
  }

  async scrollToElement() {}

  observeTargetPosition(selector, onChange) {
    return () => {};
  }

  listenToElementEvent(selector, eventType, callback) {
    const key = `${selector.css || ''}_${eventType}`;
    this.eventListeners.set(key, callback);
    return () => this.eventListeners.delete(key);
  }

  listenToUrlChanges() {
    return () => {};
  }

  async saveProgress(tutorialId, stepIndex) {
    this.progressStore.set(tutorialId, stepIndex);
  }

  async getProgress(tutorialId) {
    return this.progressStore.get(tutorialId) ?? null;
  }

  triggerElementEvent(selectorCss, eventType, eventData = {}) {
    const key = `${selectorCss}_${eventType}`;
    const cb = this.eventListeners.get(key);
    if (cb) cb(eventData);
  }
}

const sampleTutorial = {
  id: 'test-tutorial-1',
  name: 'Test Guide',
  description: 'Test description',
  matchUrls: ['https://example.com/*'],
  steps: [
    {
      id: 'step_1',
      title: 'Step 1',
      action: { type: 'spotlight', title: 'Action 1', content: 'Do step 1' },
      target: { css: '#btn-1' },
      validation: { type: 'click' },
    },
    {
      id: 'step_2',
      title: 'Step 2',
      action: { type: 'spotlight', title: 'Action 2', content: 'Do step 2' },
      target: { css: '#input-2' },
      validation: { type: 'input', expectedValue: 'hello' },
    },
  ],
};

describe('GuideMe Tutorial Engine Unit Tests', () => {
  let adapter;
  let engine;

  beforeEach(() => {
    adapter = new MockAdapter();
    engine = new TutorialEngine({ adapter });
  });

  test('TutorialParser validates and indexes step definitions', () => {
    const parseResult = TutorialParser.parse(sampleTutorial);
    assert.strictEqual(parseResult.success, true);
    assert.strictEqual(parseResult.tutorial.steps.length, 2);
    assert.strictEqual(parseResult.tutorial.steps[0].id, 'step_1');
    assert.strictEqual(parseResult.tutorial.steps[0].defaultNextStepIndex, 1);
    assert.strictEqual(parseResult.tutorial.steps[1].defaultNextStepIndex, null);

    // URL matching
    assert.strictEqual(TutorialParser.matchesUrl(parseResult.tutorial, 'https://example.com/dashboard'), true);
    assert.strictEqual(TutorialParser.matchesUrl(parseResult.tutorial, 'https://otherdomain.com'), false);
  });

  test('StateMachine enforces deterministic transitions', () => {
    const sm = new StateMachine();
    assert.strictEqual(sm.getState(), EngineStatus.IDLE);

    // Disallowed transition from IDLE directly to COMPLETED
    assert.strictEqual(sm.transition(EngineStatus.COMPLETED), false);
    assert.strictEqual(sm.getState(), EngineStatus.IDLE);

    assert.strictEqual(sm.transition(EngineStatus.LOADING), true);
    assert.strictEqual(sm.getState(), EngineStatus.LOADING);

    assert.strictEqual(sm.transition(EngineStatus.STEP_ACTIVE), true);
    assert.strictEqual(sm.getState(), EngineStatus.STEP_ACTIVE);
  });

  test('Engine starts tutorial, resolves target, and advances steps', async () => {
    let latestState = null;
    engine.subscribe((state) => {
      latestState = state;
    });

    const started = await engine.start(sampleTutorial, 0);
    assert.strictEqual(started, true);
    assert.strictEqual(latestState.isActive, true);
    assert.strictEqual(latestState.currentStepIndex, 0);
    assert.strictEqual(latestState.currentStep.id, 'step_1');
    assert.notStrictEqual(latestState.boundingBox, null);

    // Simulate clicking the target button
    adapter.triggerElementEvent('#btn-1', 'click');

    // Wait microtask queue for async state advancement
    await new Promise((r) => setTimeout(r, 10));

    assert.strictEqual(latestState.currentStepIndex, 1);
    assert.strictEqual(latestState.currentStep.id, 'step_2');

    // Advance final step
    await engine.nextStep();
    assert.strictEqual(latestState.isCompleted, true);

    // Stop engine and verify reactive state turns inactive
    await engine.stop();
    assert.strictEqual(latestState.isActive, false);
    assert.strictEqual(latestState.status, EngineStatus.IDLE);
  });

  test('Input validation waits for expected value or Enter key without cutting off typing', async () => {
    let latestState = null;
    engine.subscribe((state) => {
      latestState = state;
    });

    await engine.start(sampleTutorial, 1); // start directly at step_2 (input validation with expectedValue: 'hello')
    assert.strictEqual(latestState.currentStepIndex, 1);

    // Typing 1-2 letters ("he") should NOT advance step
    adapter.triggerElementEvent('#input-2', 'input', { targetValue: 'he' });
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(latestState.currentStepIndex, 1);

    // Completing full expected input ("hello") triggers validation
    adapter.triggerElementEvent('#input-2', 'input', { targetValue: 'hello' });
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(latestState.isCompleted, true);
  });

  test('VariableStore and EventBus function reliably', () => {
    const store = new VariableStore({ initial: 42 });
    assert.strictEqual(store.get('initial'), 42);
    store.set('custom', 'value');
    assert.strictEqual(store.get('custom'), 'value');

    const bus = new EventBus();
    let received = null;
    const unsub = bus.on('test_event', (data) => {
      received = data;
    });
    bus.emit('test_event', { msg: 'ok' });
    assert.deepStrictEqual(received, { msg: 'ok' });

    unsub();
    bus.emit('test_event', { msg: 'after_unsub' });
    assert.deepStrictEqual(received, { msg: 'ok' });
  });
});
