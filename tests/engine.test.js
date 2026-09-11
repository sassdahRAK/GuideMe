import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
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
} from '../packages/engine/src/index.js';
import { BaseTutorialAdapter } from '../packages/adapter-interface/src/index.js';
import { SchemaValidator } from '../packages/tutorial-schema/src/index.js';
import { EngineStatus, Language, AudioPlaybackStatus } from '../packages/core-types/src/index.js';

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

const sampleBilingualTutorial = {
  id: 'test-bilingual-guide',
  name: {
    km: 'មគ្គុទ្ទេសក៍សាកល្បង',
    en: 'Test Bilingual Guide',
  },
  description: {
    km: 'ការពិពណ៌នាសាកល្បង',
    en: 'Test guide description',
  },
  matchUrls: ['https://example.com/*'],
  steps: [
    {
      id: 'step_1',
      title: {
        km: 'ជំហានទី ១',
        en: 'Step 1',
      },
      action: {
        type: 'spotlight',
        title: {
          km: 'សកម្មភាពទី ១',
          en: 'Action 1',
        },
        content: {
          km: 'សូមចុចប៊ូតុង',
          en: 'Please click the button',
        },
        actionText: {
          km: 'ចុចទីនេះ',
          en: 'Click Here',
        },
      },
      audio: {
        km: {
          ttsText: 'សូមចុចប៊ូតុងទីមួយ',
          transcript: 'កំពុងអានការណែនាំជាសំឡេង...',
        },
        en: {
          ttsText: 'Please click the first button',
          transcript: 'Playing English voice...',
        },
      },
      target: { css: '#btn-1' },
      validation: { type: 'click' },
    },
    {
      id: 'step_2',
      title: {
        km: 'ជំហានទី ២',
        en: 'Step 2',
      },
      action: {
        type: 'spotlight',
        title: {
          km: 'សកម្មភាពទី ២',
          en: 'Action 2',
        },
        content: {
          km: 'សូមវាយពាក្យ hello',
          en: 'Please type hello',
        },
      },
      target: { css: '#input-2' },
      validation: { type: 'input', expectedValue: 'hello' },
    },
  ],
};

describe('GuideMe Tutorial Engine & Bilingual / Audio Tests', () => {
  let adapter;
  let engine;

  beforeEach(() => {
    adapter = new MockAdapter();
    engine = new TutorialEngine({ adapter });
  });

  test('TutorialParser validates and indexes bilingual step definitions', () => {
    const parseResult = TutorialParser.parse(sampleBilingualTutorial);
    assert.strictEqual(parseResult.success, true);
    assert.strictEqual(parseResult.tutorial.steps.length, 2);
    assert.strictEqual(parseResult.tutorial.steps[0].id, 'step_1');
    assert.strictEqual(parseResult.tutorial.steps[0].defaultNextStepIndex, 1);
    assert.strictEqual(parseResult.tutorial.steps[1].defaultNextStepIndex, null);

    // URL matching
    assert.strictEqual(TutorialParser.matchesUrl(parseResult.tutorial, 'https://example.com/dashboard'), true);
    assert.strictEqual(TutorialParser.matchesUrl(parseResult.tutorial, 'https://otherdomain.com'), false);
  });

  test('I18nManager resolves Khmer (default) and switches to English smoothly', () => {
    const i18n = new I18nManager();
    assert.strictEqual(i18n.getLanguage(), Language.KM);

    // Resolve bilingual object
    const bilingualObj = { km: 'សួស្តី', en: 'Hello' };
    assert.strictEqual(i18n.resolve(bilingualObj), 'សួស្តី');

    // Switch to English
    i18n.setLanguage(Language.EN);
    assert.strictEqual(i18n.getLanguage(), Language.EN);
    assert.strictEqual(i18n.resolve(bilingualObj), 'Hello');

    // Step badge formatting
    assert.strictEqual(i18n.formatStepBadge(0, 4, Language.KM), 'ជំហានទី ១/៤');
    assert.strictEqual(i18n.formatStepBadge(0, 4, Language.EN), 'Step 1/4');

    // Fallback handling
    assert.strictEqual(i18n.resolve('Plain string'), 'Plain string');
    assert.strictEqual(i18n.resolve({ km: 'តែខ្មែរ' }, Language.EN), 'តែខ្មែរ');
  });

  test('AudioEngine manages playback state and supports custom TTS providers', async () => {
    let speakCalled = false;
    class CustomAiTeamTtsProvider extends BaseTtsProvider {
      async speak({ text, lang, onStart, onEnd }) {
        speakCalled = true;
        if (onStart) onStart();
        if (onEnd) onEnd();
      }
    }

    const audio = new AudioEngine();
    const customProvider = new CustomAiTeamTtsProvider();
    audio.setTtsProvider(customProvider);

    let statusUpdate = null;
    audio.onStatusChange((st) => {
      statusUpdate = st;
    });

    await audio.play(
      { km: { ttsText: 'សាកល្បងសំឡេង' } },
      Language.KM
    );

    assert.strictEqual(speakCalled, true);
    assert.strictEqual(statusUpdate, AudioPlaybackStatus.ENDED);
  });

  test('AiTtsProvider initializes with API key and handles fetch & fallback execution', async () => {
    const originalFetch = globalThis.fetch;
    let fetchedUrl = '';
    let fetchedHeaders = {};
    let fetchedBody = null;

    globalThis.fetch = async (url, options) => {
      fetchedUrl = url;
      fetchedHeaders = options.headers;
      fetchedBody = JSON.parse(options.body);
      return {
        ok: true,
        blob: async () => ({ size: 1024, type: 'audio/mpeg' }),
      };
    };

    try {
      const aiProvider = new AiTtsProvider({
        apiKey: 'test-sk-12345',
        provider: 'openai',
        model: 'tts-1-hd',
        voice: 'nova',
      });

      assert.strictEqual(aiProvider.apiKey, 'test-sk-12345');
      assert.strictEqual(aiProvider.provider, 'openai');
      assert.strictEqual(aiProvider.model, 'tts-1-hd');
      assert.strictEqual(aiProvider.voice, 'nova');

      let started = false;
      let ended = false;

      await aiProvider.speak({
        text: 'សូមចុចប៊ូតុង',
        lang: Language.KM,
        rate: 1.0,
        onStart: () => { started = true; },
        onEnd: () => { ended = true; },
      });

      assert.strictEqual(fetchedUrl, 'https://api.openai.com/v1/audio/speech');
      assert.strictEqual(fetchedHeaders['Authorization'], 'Bearer test-sk-12345');
      assert.strictEqual(fetchedBody.input, 'សូមចុចប៊ូតុង');
      assert.strictEqual(fetchedBody.model, 'tts-1-hd');
      assert.strictEqual(fetchedBody.voice, 'nova');
      assert.strictEqual(started, true);
      assert.strictEqual(ended, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('GenericHttpTtsProvider dynamically interpolates template variables for custom AI endpoints', async () => {
    const originalFetch = globalThis.fetch;
    let requestCaptured = null;

    globalThis.fetch = async (url, options) => {
      requestCaptured = {
        url,
        headers: options.headers,
        body: JSON.parse(options.body),
      };
      return {
        ok: true,
        blob: async () => ({ size: 2048, type: 'audio/wav' }),
      };
    };

    try {
      const customAiProvider = new GenericHttpTtsProvider({
        endpoint: 'https://khmer-ai.example.com/api/v1/synthesize?voice={{VOICE}}',
        apiKey: 'khmer-secret-key-999',
        headers: {
          'X-Api-Key': '{{API_KEY}}',
          'X-Custom-Engine': 'GuideMe',
        },
        bodyTemplate: {
          khmerText: '{{TEXT}}',
          lang: '{{LANG}}',
          speed: '{{RATE}}',
          speaker: '{{VOICE}}',
        },
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

      assert.strictEqual(requestCaptured.url, 'https://khmer-ai.example.com/api/v1/synthesize?voice=female-channary');
      assert.strictEqual(requestCaptured.headers['X-Api-Key'], 'khmer-secret-key-999');
      assert.strictEqual(requestCaptured.headers['X-Custom-Engine'], 'GuideMe');
      assert.strictEqual(requestCaptured.body.khmerText, 'សូមស្វាគមន៍មកកាន់ GuideMe');
      assert.strictEqual(requestCaptured.body.lang, 'km');
      assert.strictEqual(requestCaptured.body.speed, 0.9);
      assert.strictEqual(requestCaptured.body.speaker, 'female-channary');
      assert.strictEqual(started, true);
      assert.strictEqual(ended, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('TtsRegistry creates providers dynamically from environment variables', () => {
    // No credentials means local browser speech fallback, never an unauthenticated request.
    assert.ok(TtsRegistry.fromEnv({}) instanceof PlaceholderTtsProvider);

    // 1. OpenAI preset from env
    const openAiProvider = TtsRegistry.fromEnv({
      WXT_TTS_API_KEY: 'sk-sample-env-key',
      WXT_TTS_PRESET: 'openai',
      WXT_TTS_MODEL: 'tts-1-hd',
    });
    assert.strictEqual(openAiProvider.apiKey, 'sk-sample-env-key');
    assert.strictEqual(openAiProvider.model, 'tts-1-hd');

    // 2. ElevenLabs preset from env
    const elevenLabsProvider = TtsRegistry.fromEnv({
      WXT_TTS_API_KEY: 'eleven-env-key',
      WXT_TTS_PRESET: 'elevenlabs',
      WXT_TTS_VOICE: 'rachel-voice-id',
    });
    assert.strictEqual(elevenLabsProvider.apiKey, 'eleven-env-key');
    assert.strictEqual(elevenLabsProvider.voice, 'rachel-voice-id');

    // 3. Custom endpoint from env
    const customEnvProvider = TtsRegistry.fromEnv({
      WXT_TTS_PRESET: 'custom',
      WXT_TTS_ENDPOINT: 'https://my-proxy.internal/tts',
      WXT_TTS_API_KEY: 'proxy-token',
    });
    assert.strictEqual(customEnvProvider.endpoint, 'https://my-proxy.internal/tts');
    assert.strictEqual(customEnvProvider.apiKey, 'proxy-token');

    // 4. Custom registered runtime driver
    class BrandNewTtsEngine extends BaseTtsProvider {}
    TtsRegistry.register('custom-plugin', () => new BrandNewTtsEngine());
    const registeredProvider = TtsRegistry.create('custom-plugin');
    assert.ok(registeredProvider instanceof BrandNewTtsEngine);
  });

  test('Engine starts bilingual tutorial and reactively updates on language toggle', async () => {
    let latestState = null;
    engine.subscribe((state) => {
      latestState = state;
    });

    const started = await engine.start(sampleBilingualTutorial, 0);
    assert.strictEqual(started, true);
    assert.strictEqual(latestState.isActive, true);
    assert.strictEqual(latestState.language, Language.KM);
    assert.strictEqual(latestState.tutorial.name, 'មគ្គុទ្ទេសក៍សាកល្បង');
    assert.strictEqual(latestState.actionPayload.content, 'សូមចុចប៊ូតុង');
    assert.strictEqual(latestState.stepBadgeText, 'ជំហានទី ១/២');

    // Switch language to English
    engine.setLanguage(Language.EN);
    assert.strictEqual(latestState.language, Language.EN);
    assert.strictEqual(latestState.tutorial.name, 'Test Bilingual Guide');
    assert.strictEqual(latestState.actionPayload.content, 'Please click the button');
    assert.strictEqual(latestState.stepBadgeText, 'Step 1/2');

    // Simulate clicking target
    adapter.triggerElementEvent('#btn-1', 'click');
    await new Promise((r) => setTimeout(r, 10));

    assert.strictEqual(latestState.currentStepIndex, 1);
    assert.strictEqual(latestState.actionPayload.content, 'Please type hello');

    // Toggle back to Khmer
    engine.toggleLanguage();
    assert.strictEqual(latestState.language, Language.KM);
    assert.strictEqual(latestState.actionPayload.content, 'សូមវាយពាក្យ hello');

    await engine.stop();
    assert.strictEqual(latestState.isActive, false);
  });

  test('Engine blocks Next until click validation and still allows Back navigation', async () => {
    await engine.start(sampleBilingualTutorial, 0);

    await engine.nextStep();
    assert.strictEqual(engine.getStateSnapshot().currentStepIndex, 0);
    assert.strictEqual(engine.getStateSnapshot().canAdvanceNext, false);

    adapter.triggerElementEvent('#btn-1', 'click');
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.strictEqual(engine.getStateSnapshot().currentStepIndex, 1);
    assert.strictEqual(engine.getStateSnapshot().canAdvanceNext, false);

    await engine.prevStep();
    assert.strictEqual(engine.getStateSnapshot().currentStepIndex, 0);
  });

  test('Engine replaces an active tutorial without an invalid loading transition', async () => {
    await engine.start(sampleBilingualTutorial, 0);
    const restarted = await engine.start(sampleBilingualTutorial, 0);

    assert.strictEqual(restarted, true);
    assert.strictEqual(engine.getStateSnapshot().status, EngineStatus.STEP_ACTIVE);
  });

  test('Validates and indexes GuideMe Spreadsheet walkthrough schema', async () => {
    const guideMeDemo = (await import('../tutorials/spreadsheet/guideme-spreadsheet-demo.json', { with: { type: 'json' } })).default;
    const parseResult = TutorialParser.parse(guideMeDemo);
    assert.strictEqual(parseResult.success, true);
    assert.strictEqual(parseResult.tutorial.steps.length, 4);
    assert.strictEqual(parseResult.tutorial.steps[0].id, 'step_click_insert');
    assert.strictEqual(parseResult.tutorial.steps[0].action.coachTitle.km, 'GuideMe - AI Live Coach');
  });

  test('TutorialEngine deduplicates rapid identical playVoicePrompt invocations to prevent echo', async () => {
    let playCallCount = 0;
    class SpyingTtsProvider extends BaseTtsProvider {
      async speak({ onStart, onEnd }) {
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
    // The initial step activation called playVoicePrompt once
    assert.strictEqual(playCallCount, 1);

    // Rapid immediate re-triggers of the exact same step voice prompt (e.g. within 200ms)
    await customEngine.playVoicePrompt(customEngine.currentStep, Language.KM);
    await customEngine.playVoicePrompt(customEngine.currentStep, Language.KM);
    await customEngine.playVoicePrompt(customEngine.currentStep, Language.KM);

    // Deduplication should suppress redundant duplicate playbacks
    assert.strictEqual(playCallCount, 1);
  });

  test('AudioEngine playback tokens guarantee only the latest active speech updates status', async () => {
    const callLog = [];
    class DelayedTtsProvider extends BaseTtsProvider {
      async speak({ text, onStart, onEnd }) {
        if (onStart) onStart();
        await new Promise((resolve) => setTimeout(resolve, 30));
        callLog.push(text);
        if (onEnd) onEnd();
      }
    }

    const audio = new AudioEngine({ ttsProvider: new DelayedTtsProvider() });
    let endedCount = 0;
    audio.onStatusChange((status) => {
      if (status === AudioPlaybackStatus.ENDED) endedCount++;
    });

    // Launch two consecutive speech prompts rapidly
    const p1 = audio.play(null, Language.KM, 'First Speech');
    const p2 = audio.play(null, Language.KM, 'Second Speech');

    await Promise.all([p1, p2]);

    // Only the second/latest speech should have reported ENDED to AudioEngine
    assert.strictEqual(endedCount, 1);
    assert.strictEqual(audio.getStatus(), AudioPlaybackStatus.ENDED);
  });

  test('StepResolver JIT Dynamic Grounding resolves target with generalized interactive fallback if primary CSS selector misses', async () => {
    class JITMockAdapter extends BaseTutorialAdapter {
      async findTarget(selector) {
        // Primary specific selector fails
        if (selector.css === '#hidden-submenu-item') return null;
        // JIT fallback succeeds using text/aria matching
        if (selector.text === 'Page setup') {
          return { x: 50, y: 120, width: 90, height: 28, top: 120, left: 50, bottom: 148, right: 140 };
        }
        return null;
      }
    }

    const adapter = new JITMockAdapter();
    const resolver = new StepResolver({}, adapter);

    const step = {
      id: 'step-page-setup',
      target: {
        css: '#hidden-submenu-item',
        text: 'Page setup',
      },
    };

    const { targetFound, boundingBox } = await resolver.resolveTarget(step, 100);
    assert.strictEqual(targetFound, true);
    assert.ok(boundingBox);
    assert.strictEqual(boundingBox.x, 50);
  });

  test('StateMachine allows idempotent self-transitions (COMPLETED -> COMPLETED) without warnings', () => {
    const sm = new StateMachine();
    assert.strictEqual(sm.getState(), EngineStatus.IDLE);

    // Transition IDLE -> LOADING -> STEP_ACTIVE -> COMPLETED
    assert.strictEqual(sm.transition(EngineStatus.LOADING), true);
    assert.strictEqual(sm.transition(EngineStatus.STEP_ACTIVE), true);
    assert.strictEqual(sm.transition(EngineStatus.COMPLETED), true);
    assert.strictEqual(sm.getState(), EngineStatus.COMPLETED);

    // Calling COMPLETED when already COMPLETED must succeed idempotently
    assert.strictEqual(sm.transition(EngineStatus.COMPLETED), true);
    assert.strictEqual(sm.getState(), EngineStatus.COMPLETED);
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

    // Before validation, step.title is undefined
    assert.strictEqual(rawStepFromGemini.title, undefined);

    // SchemaValidator should heal step.title from action.title
    const errors = SchemaValidator.validateStep(rawStepFromGemini, 0);
    assert.strictEqual(errors.length, 0);
    assert.deepStrictEqual(rawStepFromGemini.title, { km: 'បើកម៉ឺនុយឯកសារ', en: 'Open File Menu' });
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
          action: {
            type: 'spotlight',
            title: 'Open File Menu',
            content: 'Click on File',
          },
          validation: { type: 'click' },
          target: { css: '#file-menu' },
        },
        {
          id: 'step-2-page-setup',
          action: {
            type: 'spotlight',
            title: 'Click Page Setup',
            content: 'Select Page Setup from menu',
          },
          validation: { type: 'click' },
          target: { css: '[role="menuitem"]', text: 'Page setup' },
        },
      ],
    };

    const result = SchemaValidator.validateTutorial(geminiTutorial);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
    assert.strictEqual(geminiTutorial.steps[0].title, 'Open File Menu');
    assert.strictEqual(geminiTutorial.steps[1].title, 'Click Page Setup');
  });
});

