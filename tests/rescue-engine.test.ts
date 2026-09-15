import {
  TutorialEngine,
  ValidationEngine,
  BaseTutorialAdapter,
  EngineEvent,
  AlertState,
  ValidationType,
} from '../packages/engine/src/index.ts';
import type { TargetSelector, BoundingBox, ElementEvent } from '../packages/engine/src/types/index.ts';

// ---------------------------------------------------------------------------
// MockAdapter — full in-memory test double
// ---------------------------------------------------------------------------
class MockAdapter extends BaseTutorialAdapter {
  progressStore = new Map<string, number>();
  eventListeners = new Map<string, (data: ElementEvent) => void>();
  customTargetBox: BoundingBox | null | undefined = undefined;

  mockTargetElement = {
    tagName: 'BUTTON',
    id: 'submit-button',
    contains: () => false,
  };

  async findTarget(): Promise<BoundingBox | null> {
    if (this.customTargetBox !== undefined) return this.customTargetBox;
    return { x: 100, y: 200, width: 80, height: 32, top: 200, left: 100, bottom: 232, right: 180 };
  }

  findElement() { return this.mockTargetElement; }

  async scrollToElement(): Promise<void> {}

  observeTargetPosition(): () => void { return () => {}; }

  listenToElementEvent(selector: TargetSelector, eventType: string, callback: (data: ElementEvent) => void): () => void {
    const key = `${selector.css ?? ''}_${eventType}`;
    this.eventListeners.set(key, callback);
    return () => this.eventListeners.delete(key);
  }

  listenToUrlChanges(): () => void { return () => {}; }

  async saveProgress(tutorialId: string, stepIndex: number): Promise<void> {
    this.progressStore.set(tutorialId, stepIndex);
  }

  async getProgress(tutorialId: string): Promise<number | null> {
    return this.progressStore.get(tutorialId) ?? null;
  }

  async clearProgress(tutorialId: string): Promise<void> {
    this.progressStore.delete(tutorialId);
  }

  /** Helper: fire a registered listener to simulate DOM events */
  triggerElementEvent(selector: TargetSelector | string, eventType: string, data: ElementEvent = {}): void {
    const css = typeof selector === 'string' ? selector : (selector.css ?? '');
    const key = `${css}_${eventType}`;
    const cb = this.eventListeners.get(key);
    if (cb) cb(data);
  }
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('Day 2: Hesitation & Misclick Rescue Engine Unit Tests', () => {
  const documentListeners = new Map<string, Set<(e: unknown) => void>>();

  beforeAll(() => {
    vi.stubGlobal('document', {
      addEventListener: (type: string, handler: (e: unknown) => void) => {
        if (!documentListeners.has(type)) documentListeners.set(type, new Set());
        documentListeners.get(type)!.add(handler);
      },
      removeEventListener: (type: string, handler: (e: unknown) => void) => {
        if (documentListeners.has(type)) documentListeners.get(type)!.delete(handler);
      },
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  function dispatchDocumentClick(eventData: unknown): void {
    const listeners = documentListeners.get('click');
    if (listeners) listeners.forEach((handler) => handler(eventData));
  }

  // ──────────────────────────────────────────────────────────────────────────

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
      { hesitationTimeoutMs: 30, onHesitation: () => { hesitated = true; } }
    );

    expect(hesitated).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(hesitated).toBe(true);

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
      { hesitationTimeoutMs: 40, onHesitation: () => { hesitated = true; } }
    );

    // At 25ms, user types partial input — resets the timer
    await new Promise((resolve) => setTimeout(resolve, 25));
    adapter.triggerElementEvent({ css: '#text-input' }, 'input', { targetValue: 'kh' });

    // At 50ms total (25ms since last input), hesitation must NOT have fired yet
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(hesitated).toBe(false);

    // After remaining time with no input, hesitation fires
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(hesitated).toBe(true);

    cleanup();
  });

  test('ValidationEngine detects misclick when user clicks outside target on click step', () => {
    const adapter = new MockAdapter();
    const step = {
      id: 'step-click',
      validation: { type: ValidationType.CLICK },
      target: { css: '#submit-button' },
    };

    let misclickPayload: Record<string, unknown> | null = null;
    const cleanup = ValidationEngine.bindValidation(
      step,
      adapter,
      () => {},
      {
        targetBoundingBox: { left: 100, right: 180, top: 200, bottom: 232 },
        onMisclick: (data: Record<string, unknown>) => { misclickPayload = data; },
      }
    );

    const randomDiv = { tagName: 'DIV', id: 'background' };
    dispatchDocumentClick({
      target: randomDiv,
      clientX: 500,
      clientY: 600,
      composedPath: () => [randomDiv],
    });

    expect(misclickPayload).not.toBe(null);
    expect((misclickPayload!.coordinates as Record<string, unknown>).x).toBe(500);

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

    const cleanup = ValidationEngine.bindValidation(
      step,
      adapter,
      (_res: { valid: boolean }) => {},
      {
        targetBoundingBox: { left: 100, right: 180, top: 200, bottom: 232 },
        onMisclick: () => { misclicked = true; },
      }
    );

    dispatchDocumentClick({
      target: adapter.mockTargetElement,
      clientX: 120,
      clientY: 210,
      composedPath: () => [adapter.mockTargetElement],
    });

    expect(misclicked).toBe(false);

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
        onMisclick: () => { misclicked = true; },
      }
    );

    // Click inside GuideMe's Shadow DOM — should be ignored entirely
    const uiNode = { id: 'guideme-tutorial-root', tagName: 'GUIDEME-TUTORIAL-ROOT' };
    const langBtn = { tagName: 'BUTTON', id: 'lang-toggle' };

    dispatchDocumentClick({
      target: langBtn,
      clientX: 800,
      clientY: 50,
      composedPath: () => [langBtn, uiNode],
    });

    expect(misclicked).toBe(false);

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

    engine.events.on(EngineEvent.HESITATION_DETECTED, () => { hesitationEventReceived = true; });
    engine.events.on(EngineEvent.MISCLICK_DETECTED, () => { misclickEventReceived = true; });

    await engine.start(tutorial);
    expect(engine.getStateSnapshot().alertState).toBe(AlertState.NORMAL);

    // 1. Wait for hesitation timer
    await new Promise((resolve) => setTimeout(resolve, 55));
    expect(hesitationEventReceived).toBe(true);
    expect(engine.getStateSnapshot().alertState).toBe(AlertState.HESITATION);

    // 2. Simulate misclick outside target
    const randomDiv = { tagName: 'DIV', id: 'outside-area' };
    dispatchDocumentClick({
      target: randomDiv,
      clientX: 50,
      clientY: 50,
      composedPath: () => [randomDiv],
    });

    expect(misclickEventReceived).toBe(true);
    expect(engine.getStateSnapshot().alertState).toBe(AlertState.MISCLICK);

    // 3. Complete step — alertState resets to NORMAL
    adapter.triggerElementEvent({ css: '#submit-button' }, 'click');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(engine.getStateSnapshot().alertState).toBe(AlertState.NORMAL);
  });

  test('TutorialEngine handles missing target gracefully and recovers on retryLocateTarget', async () => {
    const adapter = new MockAdapter();
    adapter.customTargetBox = null; // simulate element not yet rendered

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
    expect(snapshot1.targetMissing).toBe(true);
    expect(snapshot1.boundingBox).toBe(null);

    // Simulate element rendering then user clicking "Try Again"
    adapter.customTargetBox = { x: 120, y: 250, width: 100, height: 40, top: 250, left: 120, bottom: 290, right: 220 };
    await engine.retryLocateTarget();

    const snapshot2 = engine.getStateSnapshot();
    expect(snapshot2.targetMissing).toBe(false);
    expect(snapshot2.boundingBox).not.toBe(null);
    expect(snapshot2.boundingBox.width).toBe(100);
    expect(snapshot2.boundingBox.height).toBe(40);
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
      (res: { valid: boolean }) => { if (res.valid) validated = true; }
    );

    adapter.triggerElementEvent({ css: '#search-field' }, 'keydown', { key: 'Enter', targetValue: 'TOUB_POS' });
    expect(validated).toBe(true);
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
      (res: { valid: boolean }) => { if (res.valid) validated = true; }
    );

    adapter.triggerElementEvent({ css: '#search-field' }, 'input', { targetValue: 'TOUB_POS' });
    expect(validated).toBe(false); // Debounce waiting for user to finish

    await new Promise((resolve) => setTimeout(resolve, 750));
    expect(validated).toBe(true);
    cleanup();
  });
});
