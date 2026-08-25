import { EngineStatus, EngineEvent, Language } from '@guideme/core-types';
import { StateMachine } from './state-machine/state-machine.js';
import { TutorialParser } from './parser/parser.js';
import { StepResolver } from './resolver/step-resolver.js';
import { ValidationEngine } from './validation/validation-engine.js';
import { ActionEngine } from './actions/action-engine.js';
import { EventBus } from './runtime/event-bus.js';
import { VariableStore } from './runtime/variable-store.js';
import { SessionManager } from './runtime/session-manager.js';
import { I18nManager } from './i18n/i18n-manager.js';
import { AudioEngine } from './audio/audio-engine.js';

/**
 * Universal Headless Tutorial Engine with Dual-Language (Khmer/English) and Voice Guidance.
 * Drives all tutorial state, step progression, validation, audio triggers, and lifecycle.
 */
export class TutorialEngine {
  /**
   * @param {Object} options
   * @param {import('@guideme/adapter-interface').BaseTutorialAdapter} options.adapter
   * @param {string} [options.initialLanguage='km']
   * @param {import('./audio/audio-engine.js').BaseTtsProvider} [options.ttsProvider]
   */
  constructor({ adapter, initialLanguage = Language.KM, ttsProvider = null }) {
    this.adapter = adapter;
    this.events = new EventBus();
    this.variables = new VariableStore();
    this.session = new SessionManager(adapter);
    this.i18n = new I18nManager({ initialLanguage });
    this.audio = new AudioEngine({ ttsProvider });

    this.stateMachine = new StateMachine((from, to, ctx) => {
      this._emitStateChange(from, to, ctx);
    });

    this.activeTutorial = null;
    this.stepResolver = null;
    this.currentStep = null;
    this.currentStepIndex = 0;
    this.targetBoundingBox = null;

    this._activeValidationCleanup = null;
    this._activePositionCleanup = null;

    // Synchronize language change with engine subscribers & trigger audio update
    this.i18n.onLanguageChange((newLang) => {
      this.events.emit(EngineEvent.LANGUAGE_CHANGE, { language: newLang });
      if (this.currentStep) {
        this.playVoicePrompt(this.currentStep, newLang);
      }
      this._notifyState();
    });

    // Notify state on audio playback changes so UI equalizer responds instantly
    this.audio.onStatusChange((status) => {
      this._notifyState();
    });
  }

  /**
   * Subscribe to engine state updates.
   * @param {(state: Object) => void} listener
   * @returns {() => void} Unsubscribe function
   */
  subscribe(listener) {
    listener(this.getStateSnapshot());
    return this.events.on(EngineEvent.STATE_CHANGE, () => {
      listener(this.getStateSnapshot());
    });
  }

  /**
   * Initialize engine.
   */
  init() {
    this.stateMachine.reset();
  }

  /**
   * Set active language ('km' or 'en').
   * @param {string} lang
   */
  setLanguage(lang) {
    return this.i18n.setLanguage(lang);
  }

  /**
   * Get active language code.
   * @returns {string}
   */
  getLanguage() {
    return this.i18n.getLanguage();
  }

  /**
   * Toggle between Khmer and English.
   * @returns {string} New language
   */
  toggleLanguage() {
    return this.i18n.toggleLanguage();
  }

  /**
   * Get Audio Engine instance.
   * @returns {AudioEngine}
   */
  getAudioEngine() {
    return this.audio;
  }

  /**
   * Get I18n Manager instance.
   * @returns {I18nManager}
   */
  getI18nManager() {
    return this.i18n;
  }

  /**
   * Play voice narration for a given step in the specified language.
   * @param {Object} step
   * @param {string} [lang]
   */
  async playVoicePrompt(step = this.currentStep, lang = this.i18n.getLanguage()) {
    if (!step) return;
    const audioConfig = step.audio || step.action?.audio;
    const fallbackText = this.i18n.resolve(step.action?.content || step.instruction || step.description || step.title, lang);
    await this.audio.play(audioConfig, lang, fallbackText);
  }

  /**
   * Load and parse a tutorial definition.
   * @param {Object} rawTutorial
   * @returns {boolean}
   */
  loadTutorial(rawTutorial) {
    const parseResult = TutorialParser.parse(rawTutorial);
    if (!parseResult.success) {
      console.error('[GuideMe Engine] Tutorial validation failed:', parseResult.errors);
      this.stateMachine.transition(EngineStatus.ERROR, { errors: parseResult.errors });
      return false;
    }

    this.activeTutorial = parseResult.tutorial;
    this.stepResolver = new StepResolver(this.activeTutorial, this.adapter);

    // Set default tutorial language if specified and not manually overridden
    if (this.activeTutorial.defaultLanguage) {
      this.i18n.setLanguage(this.activeTutorial.defaultLanguage);
    }

    return true;
  }

  /**
   * Start executing a tutorial.
   * @param {Object} tutorialDefinition
   * @param {number} [startStepIndex]
   */
  async start(tutorialDefinition, startStepIndex) {
    this._cleanupStepSubscriptions();

    if (!this.loadTutorial(tutorialDefinition)) {
      return false;
    }

    this.stateMachine.transition(EngineStatus.LOADING);
    this.events.emit(EngineEvent.TUTORIAL_START, { tutorial: this.activeTutorial });

    const stepIndex = await this.session.startSession(this.activeTutorial.id, startStepIndex);
    await this._activateStep(stepIndex);
    return true;
  }

  /**
   * Advance to the next step.
   */
  async nextStep() {
    if (!this.activeTutorial || !this.currentStep) return;

    const nextIndex = this.stepResolver.resolveNextStepIndex(
      this.currentStep,
      this.variables.toObject()
    );

    if (nextIndex === null || nextIndex >= this.activeTutorial.steps.length) {
      await this.complete();
    } else {
      this.stateMachine.transition(EngineStatus.STEP_COMPLETED, { step: this.currentStep });
      await this.session.recordStepProgress(this.currentStep.id, nextIndex);
      await this._activateStep(nextIndex);
    }
  }

  /**
   * Return to the previous step.
   */
  async prevStep() {
    if (!this.activeTutorial || !this.currentStep) return;

    const prevIndex = this.currentStep.defaultPrevStepIndex;
    if (prevIndex !== null && prevIndex >= 0) {
      await this.session.recordStepProgress(this.currentStep.id, prevIndex);
      await this._activateStep(prevIndex);
    }
  }

  /**
   * Skip current step.
   */
  async skipStep() {
    await this.nextStep();
  }

  /**
   * Pause tutorial execution.
   */
  pause() {
    if (this.stateMachine.getState() === EngineStatus.STEP_ACTIVE) {
      this.audio.pause();
      this.stateMachine.transition(EngineStatus.PAUSED);
    }
  }

  /**
   * Resume tutorial execution from paused state.
   */
  resume() {
    if (this.stateMachine.getState() === EngineStatus.PAUSED) {
      this.audio.resume();
      this.stateMachine.transition(EngineStatus.STEP_ACTIVE);
    }
  }

  /**
   * Stop and dismiss the tutorial.
   */
  async stop() {
    this._cleanupStepSubscriptions();
    this.audio.stop();
    await this.session.resetSession();

    this.activeTutorial = null;
    this.currentStep = null;
    this.currentStepIndex = 0;
    this.targetBoundingBox = null;

    this.stateMachine.reset();
    this.events.emit(EngineEvent.TUTORIAL_STOP);
    this._notifyState();
  }

  /**
   * Complete the tutorial successfully.
   */
  async complete() {
    this._cleanupStepSubscriptions();
    this.audio.stop();
    this.stateMachine.transition(EngineStatus.COMPLETED);
    this.events.emit(EngineEvent.TUTORIAL_COMPLETE, { tutorial: this.activeTutorial });
  }

  /**
   * Complete teardown and memory cleanup.
   */
  destroy() {
    this.stop();
    this.events.clear();
    this.variables.clear();
  }

  /**
   * Get current reactive snapshot for UI components with localized content.
   * @returns {Object}
   */
  getStateSnapshot() {
    const status = this.stateMachine.getState();
    const isActive = status === EngineStatus.STEP_ACTIVE || status === EngineStatus.VALIDATING || status === EngineStatus.PAUSED;
    const currentLang = this.i18n.getLanguage();

    const totalSteps = this.activeTutorial?.steps?.length || 0;

    return {
      status,
      isActive,
      isCompleted: status === EngineStatus.COMPLETED,
      language: currentLang,
      stepBadgeText: this.i18n.formatStepBadge(this.currentStepIndex, totalSteps, currentLang),
      isPlayingAudio: this.audio.isPlaying(),
      audioStatus: this.audio.getStatus(),
      tutorial: this.activeTutorial ? {
        id: this.activeTutorial.id,
        name: this.i18n.resolve(this.activeTutorial.name, currentLang),
        description: this.i18n.resolve(this.activeTutorial.description, currentLang),
      } : null,
      currentStep: this.currentStep,
      currentStepIndex: this.currentStepIndex,
      totalSteps,
      isFirstStep: this.currentStep?.isFirst ?? false,
      isLastStep: this.currentStep?.isLast ?? false,
      boundingBox: this.targetBoundingBox,
      actionPayload: ActionEngine.getActionUiPayload(this.currentStep, this.targetBoundingBox, this.i18n),
      variables: this.variables.toObject(),
    };
  }

  // --- Internal Methods ---

  /**
   * Activate and resolve a specific step index.
   * @private
   * @param {number} stepIndex
   */
  async _activateStep(stepIndex) {
    this._cleanupStepSubscriptions();

    const step = this.stepResolver.getStepByIndex(stepIndex);
    if (!step) {
      console.error(`[GuideMe Engine] Step index out of range: ${stepIndex}`);
      await this.complete();
      return;
    }

    this.currentStep = step;
    this.currentStepIndex = stepIndex;

    // Execute pre-step actions (e.g. scroll into view)
    await ActionEngine.executeStepActions(step, this.adapter);

    // Resolve target coordinates
    if (step.target && this.adapter) {
      const { boundingBox } = await this.stepResolver.resolveTarget(step, 1500);
      this.targetBoundingBox = boundingBox;

      // Start continuous position tracking
      this._activePositionCleanup = this.adapter.observeTargetPosition(step.target, (newBox) => {
        this.targetBoundingBox = newBox;
        this._notifyState();
      });
    } else {
      this.targetBoundingBox = null;
    }

    this.stateMachine.transition(EngineStatus.STEP_ACTIVE, { step });
    this.events.emit(EngineEvent.STEP_START, { step, stepIndex });

    // Trigger voice guidance
    if (step.audio?.autoPlay !== false) {
      this.playVoicePrompt(step);
    }

    // Bind validation listeners
    this._activeValidationCleanup = ValidationEngine.bindValidation(
      step,
      this.adapter,
      async (result) => {
        if (result.valid) {
          this.events.emit(EngineEvent.STEP_SUCCESS, { step, eventData: result.eventData });
          await this.nextStep();
        }
      }
    );

    this._notifyState();
  }

  /**
   * Clean up observers and event bindings for previous step.
   * @private
   */
  _cleanupStepSubscriptions() {
    if (typeof this._activeValidationCleanup === 'function') {
      this._activeValidationCleanup();
      this._activeValidationCleanup = null;
    }
    if (typeof this._activePositionCleanup === 'function') {
      this._activePositionCleanup();
      this._activePositionCleanup = null;
    }
  }

  /**
   * Notify subscribers of state changes.
   * @private
   */
  _notifyState() {
    this.events.emit(EngineEvent.STATE_CHANGE, this.getStateSnapshot());
  }

  /**
   * @private
   */
  _emitStateChange(from, to, context) {
    this.events.emit(EngineEvent.STATE_CHANGE, {
      previousState: from,
      currentState: to,
      context,
      snapshot: this.getStateSnapshot(),
    });
  }
}
