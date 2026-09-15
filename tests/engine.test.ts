import type { TargetSelector, BoundingBox, ElementEvent } from '../packages/engine/src/types/index.ts';
import {
  TutorialEngine,
  StateMachine,
  TutorialParser,
  StepResolver,
  EventBus,
  VariableStore,
  I18nManager,
  AudioEngine,
  BaseTtsProvider,
  PlaceholderTtsProvider,
  AiTtsProvider,
  GenericHttpTtsProvider,
  TtsRegistry,
  BaseTutorialAdapter,
  SchemaValidator,
  EngineStatus,
  Language,
  AudioPlaybackStatus,
} from '../packages/engine/src/index.ts';

// ---------------------------------------------------------------------------
// MockAdapter — in-memory implementation of BaseTutorialAdapter for testing
// ---------------------------------------------------------------------------
class MockAdapter extends BaseTutorialAdapter {
  progressStore = new Map<string, number>();
  eventListeners = new Map<string, (data: ElementEvent) => void>();

  async findTarget(selector: TargetSelector): Promise<BoundingBox | null> {
    if (selector.css === '#non-existent') return null;
    return { x: 100, y: 200, width: 80, height: 32, top: 200, left: 100, bottom: 232, right: 180 };
  }

  async scrollToElement(): Promise<void> {}

  observeTargetPosition(_selector: TargetSelector, _onChange: (box: BoundingBox) => void): () => void {
    return () => {};
  }

  listenToElementEvent(selector: TargetSelector, eventType: string, callback: (data: ElementEvent) => void): () => void {
    const key = `${selector.css ?? ''}_${eventType}`;
    this.eventListeners.set(key, callback);
    return () => this.eventListeners.delete(key);
  }

  listenToUrlChanges(_callback: (url: string) => void): () => void {
    return () => {};
  }

  async saveProgress(tutorialId: string, stepIndex: number): Promise<void> {
    this.progressStore.set(tutorialId, stepIndex);
  }

  async getProgress(tutorialId: string): Promise<number | null> {
    return this.progressStore.get(tutorialId) ?? null;
  }

  /** Helper: fire a registered listener to simulate DOM events in tests */
  triggerElementEvent(selectorCss: string, eventType: string, eventData: ElementEvent = {}): void {
    const key = `${selectorCss}_${eventType}`;
    const cb = this.eventListeners.get(key);
    if (cb) cb(eventData);
  }
}

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------
const sampleBilingualTutorial = {
  id: 'test-bilingual-guide',
  name: { km: 'មគ្គុទ្ទេសក៍សាកល្បង', en: 'Test Bilingual Guide' },
  description: { km: 'ការពិពណ៌នាសាកល្បង', en: 'Test guide description' },
  matchUrls: ['https://example.com/*'],
  steps: [
    {
      id: 'step_1',
      title: { km: 'ជំហានទី ១', en: 'Step 1' },
      action: {
        type: 'spotlight',
        title: { km: 'សកម្មភាពទី ១', en: 'Action 1' },
        content: { km: 'សូមចុចប៊ូតុង', en: 'Please click the button' },
        actionText: { km: 'ចុចទីនេះ', en: 'Click Here' },
      },
      audio: {
        km: { ttsText: 'សូមចុចប៊ូតុងទីមួយ', transcript: 'កំពុងអានការណែនាំជាសំឡេង...' },
        en: { ttsText: 'Please click the first button', transcript: 'Playing English voice...' },
      },
      target: { css: '#btn-1' },
      validation: { type: 'click' },
    },
    {
      id: 'step_2',
      title: { km: 'ជំហានទី ២', en: 'Step 2' },
      action: {
        type: 'spotlight',
        title: { km: 'សកម្មភាពទី ២', en: 'Action 2' },
        content: { km: 'សូមវាយពាក្យ hello', en: 'Please type hello' },
      },
      target: { css: '#input-2' },
      validation: { type: 'input', expectedValue: 'hello' },
    },
  ],
};

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------
describe('GuideMe Tutorial Engine & Bilingual / Audio Tests', () => {
  let adapter: MockAdapter;
  let engine: TutorialEngine;

  beforeEach(() => {
    adapter = new MockAdapter();
    engine = new TutorialEngine({ adapter });
  });

  test('TutorialParser validates and indexes bilingual step definitions', () => {
    const parseResult = TutorialParser.parse(sampleBilingualTutorial);
    expect(parseResult.success).toBe(true);
    expect(parseResult.tutorial.steps.length).toBe(2);
    expect(parseResult.tutorial.steps[0].id).toBe('step_1');
    expect(parseResult.tutorial.steps[0].defaultNextStepIndex).toBe(1);
    expect(parseResult.tutorial.steps[1].defaultNextStepIndex).toBe(null);

    expect(TutorialParser.matchesUrl(parseResult.tutorial, 'https://example.com/dashboard')).toBe(true);
    expect(TutorialParser.matchesUrl(parseResult.tutorial, 'https://otherdomain.com')).toBe(false);
  });

  test('I18nManager resolves Khmer (default) and switches to English smoothly', () => {
    const i18n = new I18nManager();
    expect(i18n.getLanguage()).toBe(Language.KM);

    const bilingualObj = { km: 'សួស្តី', en: 'Hello' };
    expect(i18n.resolve(bilingualObj)).toBe('សួស្តី');

    i18n.setLanguage(Language.EN);
    expect(i18n.getLanguage()).toBe(Language.EN);
    expect(i18n.resolve(bilingualObj)).toBe('Hello');

    expect(i18n.formatStepBadge(0, 4, Language.KM)).toBe('ជំហានទី ១/៤');
    expect(i18n.formatStepBadge(0, 4, Language.EN)).toBe('Step 1/4');

    expect(i18n.resolve('Plain string')).toBe('Plain string');
    expect(i18n.resolve({ km: 'តែខ្មែរ' }, Language.EN)).toBe('តែខ្មែរ');
  });

  test('AudioEngine manages playback state and supports custom TTS providers', async () => {
    let speakCalled = false;

    class CustomAiTeamTtsProvider extends BaseTtsProvider {
      async speak({ onStart, onEnd }: { text: string; lang: string; onStart?: () => void; onEnd?: () => void }): Promise<void> {
        speakCalled = true;
        if (onStart) onStart();
        if (onEnd) onEnd();
      }
    }

    const audio = new AudioEngine();
    const customProvider = new CustomAiTeamTtsProvider();
    audio.setTtsProvider(customProvider);

    let statusUpdate: string | null = null;
    audio.onStatusChange((st: string) => { statusUpdate = st; });

    await audio.play({ km: { ttsText: 'សាកល្បងសំឡេង' } }, Language.KM);

    expect(speakCalled).toBe(true);
    expect(statusUpdate).toBe(AudioPlaybackStatus.ENDED);
  });

  test('AiTtsProvider initializes with API key and handles fetch & fallback execution', async () => {
    const originalFetch = globalThis.fetch;
    let fetchedUrl = '';
    let fetchedHeaders: Record<string, string> = {};
    let fetchedBody: Record<string, unknown> | null = null;

    globalThis.fetch = async (url: string | URL | Request, options?: RequestInit) => {
      fetchedUrl = url.toString();
      fetchedHeaders = options?.headers as Record<string, string>;
      fetchedBody = JSON.parse(options?.body as string);
      return { ok: true, blob: async () => ({ size: 1024, type: 'audio/mpeg' }) } as unknown as Response;
    };

    try {
      const aiProvider = new AiTtsProvider({
        apiKey: 'test-sk-12345',
        provider: 'openai',
        model: 'tts-1-hd',
        voice: 'nova',
      });

      expect(aiProvider.apiKey).toBe('test-sk-12345');
      expect(aiProvider.provider).toBe('openai');
      expect(aiProvider.model).toBe('tts-1-hd');
      expect(aiProvider.voice).toBe('nova');

      let started = false;
      let ended = false;

      await aiProvider.speak({
        text: 'សូមចុចប៊ូតុង',
        lang: Language.KM,
        rate: 1.0,
        onStart: () => { started = true; },
        onEnd: () => { ended = true; },
      });

      expect(fetchedUrl).toBe('https://api.openai.com/v1/audio/speech');
      expect(fetchedHeaders['Authorization']).toBe('Bearer test-sk-12345');
      expect(fetchedBody!.input).toBe('សូមចុចប៊ូតុង');
      expect(fetchedBody!.model).toBe('tts-1-hd');
      expect(fetchedBody!.voice).toBe('nova');
      expect(started).toBe(true);
      expect(ended).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('GenericHttpTtsProvider dynamically interpolates template variables for custom AI endpoints', async () => {
    const originalFetch = globalThis.fetch;
    let requestCaptured: { url: string; headers: Record<string, string>; body: Record<string, unknown> } | null = null;

    globalThis.fetch = async (url: string | URL | Request, options?: RequestInit) => {
      requestCaptured = {
        url: url.toString(),
        headers: options?.headers as Record<string, string>,
        body: JSON.parse(options?.body as string),
      };
      return { ok: true, blob: async () => ({ size: 2048, type: 'audio/wav' }) } as unknown as Response;
    };

    try {
      const customAiProvider = new GenericHttpTtsProvider({
        endpoint: 'https://khmer-ai.example.com/api/v1/synthesize?voice={{VOICE}}',
        apiKey: 'khmer-secret-key-999',
        headers: { 'X-Api-Key': '{{API_KEY}}', 'X-Custom-Engine': 'GuideMe' },
        bodyTemplate: { khmerText: '{{TEXT}}', lang: '{{LANG}}', speed: '{{RATE}}', speaker: '{{VOICE}}' },
        voice: 'female-channary',
      });

      let started = false;
      let ended = false;

      await customAiProvider.speak({
        text: 'សូមស្វាគមន៍មកកាន់ GuideMe',
        lang: Language.KM,
        rate: 0.9,
        onStart: () => { started = true; },
        onEnd: () => { ended = true; },
      });

      expect(requestCaptured!.url).toBe('https://khmer-ai.example.com/api/v1/synthesize?voice=female-channary');
      expect(requestCaptured!.headers['X-Api-Key']).toBe('khmer-secret-key-999');
      expect(requestCaptured!.headers['X-Custom-Engine']).toBe('GuideMe');
      expect(requestCaptured!.body.khmerText).toBe('សូមស្វាគមន៍មកកាន់ GuideMe');
      expect(requestCaptured!.body.lang).toBe('km');
      expect(requestCaptured!.body.speed).toBe(0.9);
      expect(requestCaptured!.body.speaker).toBe('female-channary');
      expect(started).toBe(true);
      expect(ended).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('TtsRegistry creates providers dynamically from environment variables', () => {
    expect(TtsRegistry.fromEnv({}) instanceof PlaceholderTtsProvider).toBeTruthy();

    const openAiProvider = TtsRegistry.fromEnv({
      WXT_TTS_API_KEY: 'sk-sample-env-key',
      WXT_TTS_PRESET: 'openai',
      WXT_TTS_MODEL: 'tts-1-hd',
    });
    expect(openAiProvider.apiKey).toBe('sk-sample-env-key');
    expect(openAiProvider.model).toBe('tts-1-hd');

    const elevenLabsProvider = TtsRegistry.fromEnv({
      WXT_TTS_API_KEY: 'eleven-env-key',
      WXT_TTS_PRESET: 'elevenlabs',
      WXT_TTS_VOICE: 'rachel-voice-id',
    });
    expect(elevenLabsProvider.apiKey).toBe('eleven-env-key');
    expect(elevenLabsProvider.voice).toBe('rachel-voice-id');

    const customEnvProvider = TtsRegistry.fromEnv({
      WXT_TTS_PRESET: 'custom',
      WXT_TTS_ENDPOINT: 'https://my-proxy.internal/tts',
      WXT_TTS_API_KEY: 'proxy-token',
    });
    expect(customEnvProvider.endpoint).toBe('https://my-proxy.internal/tts');
    expect(customEnvProvider.apiKey).toBe('proxy-token');

    class BrandNewTtsEngine extends BaseTtsProvider {}
    TtsRegistry.register('custom-plugin', () => new BrandNewTtsEngine());
    const registeredProvider = TtsRegistry.create('custom-plugin');
    expect(registeredProvider instanceof BrandNewTtsEngine).toBeTruthy();
  });

  test('Engine starts bilingual tutorial and reactively updates on language toggle', async () => {
    let latestState: Record<string, unknown> | null = null;
    engine.subscribe((state: Record<string, unknown>) => { latestState = state; });

    const started = await engine.start(sampleBilingualTutorial, 0);
    expect(started).toBe(true);
    expect(latestState!.isActive).toBe(true);
    expect(latestState!.language).toBe(Language.KM);
    expect(latestState!.tutorial.name).toBe('មគ្គុទ្ទេសក៍សាកល្បង');
    expect(latestState!.actionPayload.content).toBe('សូមចុចប៊ូតុង');
    expect(latestState!.stepBadgeText).toBe('ជំហានទី ១/២');

    engine.setLanguage(Language.EN);
    expect(latestState!.language).toBe(Language.EN);
    expect(latestState!.tutorial.name).toBe('Test Bilingual Guide');
    expect(latestState!.actionPayload.content).toBe('Please click the button');
    expect(latestState!.stepBadgeText).toBe('Step 1/2');

    adapter.triggerElementEvent('#btn-1', 'click');
    await new Promise((r) => setTimeout(r, 10));

    expect(latestState!.currentStepIndex).toBe(1);
    expect(latestState!.actionPayload.content).toBe('Please type hello');

    engine.toggleLanguage();
    expect(latestState!.language).toBe(Language.KM);
    expect(latestState!.actionPayload.content).toBe('សូមវាយពាក្យ hello');

    await engine.stop();
    expect(latestState!.isActive).toBe(false);
  });

  test('Engine blocks Next until click validation and still allows Back navigation', async () => {
    await engine.start(sampleBilingualTutorial, 0);

    await engine.nextStep();
    expect(engine.getStateSnapshot().currentStepIndex).toBe(0);
    expect(engine.getStateSnapshot().canAdvanceNext).toBe(false);

    adapter.triggerElementEvent('#btn-1', 'click');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(engine.getStateSnapshot().currentStepIndex).toBe(1);
    expect(engine.getStateSnapshot().canAdvanceNext).toBe(false);

    await engine.prevStep();
    expect(engine.getStateSnapshot().currentStepIndex).toBe(0);
  });

  test('Engine does not complete a dynamic guide when continuation generation is unavailable', async () => {
    const continuationAdapter = new MockAdapter();
    const continuationEngine = new TutorialEngine({
      adapter: continuationAdapter,
      beforeNextStep: async () => false,
    });

    const singleStepTutorial = {
      ...sampleBilingualTutorial,
      id: 'dynamic-continuation-test',
      steps: [sampleBilingualTutorial.steps[0]],
    };

    await continuationEngine.start(singleStepTutorial, 0);
    continuationAdapter.triggerElementEvent('#btn-1', 'click');
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(continuationEngine.getStateSnapshot().isActive).toBe(true);
    expect(continuationEngine.getStateSnapshot().currentStepIndex).toBe(0);
  });

  test('Engine replaces an active tutorial without an invalid loading transition', async () => {
    await engine.start(sampleBilingualTutorial, 0);
    const restarted = await engine.start(sampleBilingualTutorial, 0);

    expect(restarted).toBe(true);
    expect(engine.getStateSnapshot().status).toBe(EngineStatus.STEP_ACTIVE);
  });

  test('Validates and indexes GuideMe Spreadsheet walkthrough schema', async () => {
    const guideMeDemo = (await import('../tutorials/spreadsheet/guideme-spreadsheet-demo.json', { with: { type: 'json' } })).default;
    const parseResult = TutorialParser.parse(guideMeDemo);
    expect(parseResult.success).toBe(true);
    expect(parseResult.tutorial.steps.length).toBe(4);
    expect(parseResult.tutorial.steps[0].id).toBe('step_click_insert');
    expect(parseResult.tutorial.steps[0].action.coachTitle.km).toBe('GuideMe - AI Live Coach');
  });

  test('TutorialEngine deduplicates rapid identical playVoicePrompt invocations to prevent echo', async () => {
    let playCallCount = 0;

    class SpyingTtsProvider extends BaseTtsProvider {
      async speak({ onStart, onEnd }: { text?: string; onStart?: () => void; onEnd?: () => void }): Promise<void> {
        playCallCount++;
        if (onStart) onStart();
        if (onEnd) onEnd();
      }
    }

    const customEngine = new TutorialEngine({
      adapter: new MockAdapter(),
      ttsProvider: new SpyingTtsProvider(),
    });

    await customEngine.start(sampleBilingualTutorial, 0);
    expect(playCallCount).toBe(1);

    await customEngine.playVoicePrompt(customEngine.currentStep, Language.KM);
    await customEngine.playVoicePrompt(customEngine.currentStep, Language.KM);
    await customEngine.playVoicePrompt(customEngine.currentStep, Language.KM);

    expect(playCallCount).toBe(1);
  });

  test('AudioEngine playback tokens guarantee only the latest active speech updates status', async () => {
    const callLog: string[] = [];

    class DelayedTtsProvider extends BaseTtsProvider {
      async speak({ text, onStart, onEnd }: { text: string; onStart?: () => void; onEnd?: () => void }): Promise<void> {
        if (onStart) onStart();
        await new Promise((resolve) => setTimeout(resolve, 30));
        callLog.push(text);
        if (onEnd) onEnd();
      }
    }

    const audio = new AudioEngine({ ttsProvider: new DelayedTtsProvider() });
    let endedCount = 0;
    audio.onStatusChange((status: string) => {
      if (status === AudioPlaybackStatus.ENDED) endedCount++;
    });

    const p1 = audio.play(null, Language.KM, 'First Speech');
    const p2 = audio.play(null, Language.KM, 'Second Speech');

    await Promise.all([p1, p2]);

    expect(endedCount).toBe(1);
    expect(audio.getStatus()).toBe(AudioPlaybackStatus.ENDED);
  });

  test('StepResolver JIT Dynamic Grounding resolves target with generalized interactive fallback if primary CSS selector misses', async () => {
    class JITMockAdapter extends BaseTutorialAdapter {
      async findTarget(selector: TargetSelector): Promise<BoundingBox | null> {
        if (selector.css === '#hidden-submenu-item') return null;
        if (selector.text === 'Page setup') {
          return { x: 50, y: 120, width: 90, height: 28, top: 120, left: 50, bottom: 148, right: 140 };
        }
        return null;
      }
    }

    const jitAdapter = new JITMockAdapter();
    const resolver = new StepResolver({}, jitAdapter);

    const step = {
      id: 'step-page-setup',
      target: { css: '#hidden-submenu-item', text: 'Page setup' },
    };

    const { targetFound, boundingBox } = await resolver.resolveTarget(step, 100);
    expect(targetFound).toBe(true);
    expect(boundingBox).toBeTruthy();
    expect(boundingBox.x).toBe(50);
  });

  test('StateMachine allows idempotent self-transitions (COMPLETED -> COMPLETED) without warnings', () => {
    const sm = new StateMachine();
    expect(sm.getState()).toBe(EngineStatus.IDLE);

    expect(sm.transition(EngineStatus.LOADING)).toBe(true);
    expect(sm.transition(EngineStatus.STEP_ACTIVE)).toBe(true);
    expect(sm.transition(EngineStatus.COMPLETED)).toBe(true);
    expect(sm.getState()).toBe(EngineStatus.COMPLETED);

    expect(sm.transition(EngineStatus.COMPLETED)).toBe(true);
    expect(sm.getState()).toBe(EngineStatus.COMPLETED);
  });

  test('SchemaValidator self-heals steps where LLM provided action.title but omitted root step.title', () => {
    const rawStepFromGemini = {
      id: 'step-1-open-file-menu',
      action: {
        type: 'spotlight',
        title: { km: 'បើកម៉ឺនុយឯកសារ', en: 'Open File Menu' },
        content: { km: 'ចុចលើ File', en: 'Click File' },
      },
      validation: { type: 'click' },
      target: { css: '#file-menu' },
    };

    expect((rawStepFromGemini as Record<string, unknown>).title).toBe(undefined);

    const errors = SchemaValidator.validateStep(rawStepFromGemini, 0);
    expect(errors.length).toBe(0);
    expect(rawStepFromGemini.action.title).toEqual({ km: 'បើកម៉ឺនុយឯកសារ', en: 'Open File Menu' });
  });

  test('SchemaValidator self-heals complete tutorial where all steps have action.title but lack step.title', () => {
    const geminiTutorial = {
      id: 'gemini-guide-test',
      version: '1.0.0',
      name: { km: 'ការណែនាំ', en: 'Guide' },
      description: { km: 'ការពិពណ៌នា', en: 'Description' },
      matchUrls: ['<all_urls>'],
      steps: [
        {
          id: 'step-1-open-file-menu',
          action: { type: 'spotlight', title: 'Open File Menu', content: 'Click on File' },
          validation: { type: 'click' },
          target: { css: '#file-menu' },
        },
        {
          id: 'step-2-page-setup',
          action: { type: 'spotlight', title: 'Click Page Setup', content: 'Select Page Setup from menu' },
          validation: { type: 'click' },
          target: { css: '[role="menuitem"]', text: 'Page setup' },
        },
      ],
    };

    const result = SchemaValidator.validateTutorial(geminiTutorial);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(geminiTutorial.steps[0].action.title).toBe('Open File Menu');
    expect(geminiTutorial.steps[1].action.title).toBe('Click Page Setup');
  });

  test('SchemaValidator self-heals missing tutorial.name and missing matchUrls from LLM response', () => {
    const rawAiTutorial = {
      id: 'dynamic-ai-tutorial-1',
      title: 'Automated Checkout Guide',
      steps: [
        {
          id: 'step-1-checkout',
          title: 'Click Checkout Button',
          action: { title: 'Click Checkout Button' },
        },
      ],
    };

    const result = SchemaValidator.validateTutorial(rawAiTutorial);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect((rawAiTutorial as Record<string, unknown>).name).toBe('Automated Checkout Guide');
    expect((rawAiTutorial as Record<string, unknown>).matchUrls).toEqual(['<all_urls>']);
    expect(rawAiTutorial.steps[0].action.type).toBe('spotlight');
    expect((rawAiTutorial.steps[0] as Record<string, unknown>).validation?.type).toBe('click');
  });

  test('SchemaValidator correctly validates bilingual objects and rejects empty string bilingual objects', () => {
    const validTutorial = {
      id: 'valid-bilingual',
      name: { km: 'ការណែនាំ', en: '' },
      matchUrls: ['<all_urls>'],
      steps: [
        {
          id: 'step-1',
          title: { km: 'ចុចទីនេះ', en: 'Click here' },
          action: { type: 'spotlight', title: 'Click here' },
          validation: { type: 'click' },
        },
      ],
    };
    const validResult = SchemaValidator.validateTutorial(validTutorial);
    expect(validResult.valid).toBe(true);

    const invalidTutorial = {
      id: 'invalid-bilingual',
      name: { km: '   ', en: '' },
      matchUrls: ['<all_urls>'],
      steps: [
        {
          id: 'step-1',
          title: { km: '', en: '   ' },
          action: { type: 'spotlight' },
          validation: { type: 'click' },
        },
      ],
    };
    const invalidResult = SchemaValidator.validateTutorial(invalidTutorial);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.some((e: string) => e.includes("Missing or invalid 'title'"))).toBeTruthy();
  });
});
