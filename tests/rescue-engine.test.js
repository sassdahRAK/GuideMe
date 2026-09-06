import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import {
  TutorialEngine,
  ValidationEngine,
  TutorialParser,
} from '../packages/engine/src/index.js';
import { BaseTutorialAdapter } from '../packages/adapter-interface/src/index.js';
import { EngineEvent, AlertState, ValidationType } from '../packages/core-types/src/index.js';

class MockAdapter extends BaseTutorialAdapter {
  constructor() {
    super();
    this.progressStore = new Map();
    this.eventListeners = new Map();
    this.mockTargetElement = {
      tagName: 'BUTTON',
      id: 'submit-button',
      contains: () => false,
    };
  }

  async findTarget() {
    if (this.customTargetBox !== undefined) {
      return this.customTargetBox;
    }
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

  findElement() {
    return this.mockTargetElement;
  }

  async scrollToElement() {}

  observeTargetPosition() {
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

  async clearProgress(tutorialId) {
    this.progressStore.delete(tutorialId);
  }

  triggerElementEvent(selector, eventType, data = {}) {
    const key = `${selector.css || ''}_${eventType}`;
    const cb = this.eventListeners.get(key);
    if (cb) cb(data);
  }
}

describe('Day 2: Hesitation & Misclick Rescue Engine Unit Tests', () => {
  let prevDocument;
  let documentListeners = new Map();

  before(() => {
    prevDocument = globalThis.document;

    globalThis.document = {
      addEventListener: (type, handler) => {
        if (!documentListeners.has(type)) {
          documentListeners.set(type, new Set());
        }
        documentListeners.get(type).add(handler);
      },
      removeEventListener: (type, handler) => {
        if (documentListeners.has(type)) {
          documentListeners.get(type).delete(handler);
        }
      },
    };
  });

  after(() => {
    if (prevDocument) globalThis.document = prevDocument;
    else delete globalThis.document;
  });

  function dispatchDocumentClick(eventData) {
    const listeners = documentListeners.get('click');
    if (listeners) {
      listeners.forEach((handler) => handler(eventData));
    }
  }

  test('ValidationEngine triggers onHesitation after configured timeout', async () => {
    const adapter = new MockAdapter();
    const step = {
      id: 'step-1',
      validation: { type: ValidationType.CLICK },
      target: { css: '#btn' },
    };

    let hesitated = false;
    const cleanup = ValidationEngine.bindValidation(
      step,
      adapter,
      () => {},
      {
        hesitationTimeoutMs: 30,
        onHesitation: () => {
          hesitated = true;
        },
      }
    );

    assert.strictEqual(hesitated, false);

    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(hesitated, true);

    cleanup();
  });

  test('ValidationEngine resets hesitation timer when input activity occurs', async () => {
    const adapter = new MockAdapter();
    const step = {
      id: 'step-input',
      validation: { type: ValidationType.INPUT, expectedValue: 'khmer' },
      target: { css: '#text-input' },
    };

    let hesitated = false;
    const cleanup = ValidationEngine.bindValidation(
      step,
      adapter,
      () => {},
      {
        hesitationTimeoutMs: 40,
        onHesitation: () => {
          hesitated = true;
        },
      }
    );

    // At 25ms, user types partial input, resetting timer
    await new Promise((resolve) => setTimeout(resolve, 25));
    adapter.triggerElementEvent({ css: '#text-input' }, 'input', { targetValue: 'kh' });

    // At 50ms (more than 40ms from start, but only 25ms since last input), should NOT have hesitated yet
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.strictEqual(hesitated, false);

    // After remaining time with no input, hesitation fires
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.strictEqual(hesitated, true);

    cleanup();
  });

  test('ValidationEngine detects misclick when user clicks outside target on click step', () => {
    const adapter = new MockAdapter();
    const step = {
      id: 'step-click',
      validation: { type: ValidationType.CLICK },
      target: { css: '#submit-button' },
    };

    let misclickPayload = null;
    const cleanup = ValidationEngine.bindValidation(
      step,
      adapter,
      () => {},
      {
        targetBoundingBox: { left: 100, right: 180, top: 200, bottom: 232 },
        onMisclick: (data) => {
          misclickPayload = data;
        },
      }
    );

    // Click outside target element and outside bounding box
    const randomDiv = { tagName: 'DIV', id: 'background' };
    dispatchDocumentClick({
      target: randomDiv,
      clientX: 500,
      clientY: 600,
      composedPath: () => [randomDiv],
    });

    assert.ok(misclickPayload !== null);
    assert.strictEqual(misclickPayload.coordinates.x, 500);

    cleanup();
  });

  test('ValidationEngine ignores clicks on target element (not a misclick)', () => {
    const adapter = new MockAdapter();
    const step = {
      id: 'step-click',
      validation: { type: ValidationType.CLICK },
      target: { css: '#submit-button' },
    };

    let misclicked = false;
    let validated = false;

    const cleanup = ValidationEngine.bindValidation(
      step,
      adapter,
      (res) => {
        validated = res.valid;
      },
      {
        targetBoundingBox: { left: 100, right: 180, top: 200, bottom: 232 },
        onMisclick: () => {
          misclicked = true;
        },
      }
    );

    // Click on the valid target element
    dispatchDocumentClick({
      target: adapter.mockTargetElement,
      clientX: 120,
      clientY: 210,
      composedPath: () => [adapter.mockTargetElement],
    });

    // Misclick must NOT fire
    assert.strictEqual(misclicked, false);

    cleanup();
  });

  test('ValidationEngine ignores clicks inside GuideMe UI root (no penalty for UI clicks)', () => {
    const adapter = new MockAdapter();
    const step = {
      id: 'step-click',
      validation: { type: ValidationType.CLICK },
      target: { css: '#submit-button' },
    };

    let misclicked = false;
    const cleanup = ValidationEngine.bindValidation(
      step,
      adapter,
      () => {},
      {
        targetBoundingBox: { left: 100, right: 180, top: 200, bottom: 232 },
        onMisclick: () => {
          misclicked = true;
        },
      }
    );

    // Click inside GuideMe's Shadow DOM (e.g. language toggle button)
    const uiNode = { id: 'guideme-tutorial-root', tagName: 'GUIDEME-TUTORIAL-ROOT' };
    const langBtn = { tagName: 'BUTTON', id: 'lang-toggle' };

    dispatchDocumentClick({
      target: langBtn,
      clientX: 800,
      clientY: 50,
      composedPath: () => [langBtn, uiNode],
    });

    assert.strictEqual(misclicked, false);

    cleanup();
  });

  test('TutorialEngine integrates rescue states, emits events, and updates alertState', async () => {
    const adapter = new MockAdapter();
    const engine = new TutorialEngine({ adapter });

    const tutorial = {
      id: 'rescue-demo-tutorial',
      name: { km: 'ការណែនាំសង្គ្រោះ', en: 'Rescue Walkthrough' },
      matchUrls: ['https://example.com/*'],
      steps: [
        {
          id: 'step-target',
          title: { km: 'ចុចប៊ូតុង', en: 'Click button' },
          action: { type: 'spotlight', content: { km: 'ចុចប៊ូតុង', en: 'Click button' } },
          target: { css: '#submit-button' },
          validation: { type: ValidationType.CLICK },
          hesitationTimeoutMs: 35,
        },
      ],
    };

    let hesitationEventReceived = false;
    let misclickEventReceived = false;

    engine.events.on(EngineEvent.HESITATION_DETECTED, () => {
      hesitationEventReceived = true;
    });

    engine.events.on(EngineEvent.MISCLICK_DETECTED, () => {
      misclickEventReceived = true;
    });

    await engine.start(tutorial);

    assert.strictEqual(engine.getStateSnapshot().alertState, AlertState.NORMAL);

    // 1. Wait for hesitation timer
    await new Promise((resolve) => setTimeout(resolve, 55));
    assert.strictEqual(hesitationEventReceived, true);
    assert.strictEqual(engine.getStateSnapshot().alertState, AlertState.HESITATION);

    // 2. Simulate misclick outside target
    const randomDiv = { tagName: 'DIV', id: 'outside-area' };
    dispatchDocumentClick({
      target: randomDiv,
      clientX: 50,
      clientY: 50,
      composedPath: () => [randomDiv],
    });

    assert.strictEqual(misclickEventReceived, true);
    assert.strictEqual(engine.getStateSnapshot().alertState, AlertState.MISCLICK);

    // 3. Complete step
    adapter.triggerElementEvent({ css: '#submit-button' }, 'click');
    await new Promise((resolve) => setTimeout(resolve, 10));

    // After step completion, alertState is cleared back to normal
    assert.strictEqual(engine.getStateSnapshot().alertState, AlertState.NORMAL);
  });

  test('TutorialEngine handles missing target gracefully and recovers on retryLocateTarget', async () => {
    const adapter = new MockAdapter();
    adapter.customTargetBox = null; // simulate element hidden or not yet rendered

    const engine = new TutorialEngine({ adapter });

    const tutorial = {
      id: 'missing-target-test',
      name: { km: 'តេស្តបាត់ប៊ូតុង', en: 'Missing Target Test' },
      matchUrls: ['https://example.com/*'],
      steps: [
        {
          id: 'step-missing',
          title: { km: 'ជំហានទី១', en: 'Step 1' },
          action: { type: 'spotlight', content: { km: 'ចុចប៊ូតុង', en: 'Click button' } },
          target: { css: '#hidden-menu-item' },
          validation: { type: ValidationType.CLICK },
        },
      ],
    };

    await engine.start(tutorial);

    const snapshot1 = engine.getStateSnapshot();
    assert.strictEqual(snapshot1.targetMissing, true);
    assert.strictEqual(snapshot1.boundingBox, null);

    // Now simulate element rendering and user clicking "Try Again" (retryLocateTarget)
    adapter.customTargetBox = {
      x: 120,
      y: 250,
      width: 100,
      height: 40,
      top: 250,
      left: 120,
      bottom: 290,
      right: 220,
    };

    await engine.retryLocateTarget();

    const snapshot2 = engine.getStateSnapshot();
    assert.strictEqual(snapshot2.targetMissing, false);
    assert.notStrictEqual(snapshot2.boundingBox, null);
    assert.strictEqual(snapshot2.boundingBox.width, 100);
    assert.strictEqual(snapshot2.boundingBox.height, 40);
  });

  test('ValidationEngine validates generic input without expectedValue on Enter key', async () => {
    const adapter = new MockAdapter();
    const step = {
      id: 'step-search-input',
      target: { css: '#search-field' },
      validation: { type: ValidationType.INPUT },
    };

    let validated = false;
    const cleanup = ValidationEngine.bindValidation(
      step,
      adapter,
      (res) => {
        if (res.valid) validated = true;
      }
    );

    // Simulate Enter key on input field with non-empty query
    adapter.triggerElementEvent({ css: '#search-field' }, 'keydown', {
      key: 'Enter',
      targetValue: 'TOUB_POS',
    });

    assert.strictEqual(validated, true);
    cleanup();
  });

  test('ValidationEngine validates generic input without expectedValue on debounced typing', async () => {
    const adapter = new MockAdapter();
    const step = {
      id: 'step-search-typing',
      target: { css: '#search-field' },
      validation: { type: ValidationType.INPUT },
    };

    let validated = false;
    const cleanup = ValidationEngine.bindValidation(
      step,
      adapter,
      (res) => {
        if (res.valid) validated = true;
      }
    );

    // User types into the field
    adapter.triggerElementEvent({ css: '#search-field' }, 'input', {
      targetValue: 'TOUB_POS',
    });

    assert.strictEqual(validated, false); // Debounce waiting for user to finish typing

    // Wait 700ms for debounce timer
    await new Promise((resolve) => setTimeout(resolve, 750));
    assert.strictEqual(validated, true);

    cleanup();
  });
});
