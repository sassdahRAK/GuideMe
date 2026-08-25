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
} from '../packages/engine/src/index.js';
import { BaseTutorialAdapter } from '../packages/adapter-interface/src/index.js';
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

  test('Validates and indexes GuideMe Spreadsheet walkthrough schema', async () => {
    const guideMeDemo = (await import('../tutorials/spreadsheet/guideme-spreadsheet-demo.json', { with: { type: 'json' } })).default;
    const parseResult = TutorialParser.parse(guideMeDemo);
    assert.strictEqual(parseResult.success, true);
    assert.strictEqual(parseResult.tutorial.steps.length, 4);
    assert.strictEqual(parseResult.tutorial.steps[0].id, 'step_click_insert');
    assert.strictEqual(parseResult.tutorial.steps[0].action.coachTitle.km, 'GuideMe - AI Live Coach');
  });
});
