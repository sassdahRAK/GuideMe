import { EngineStatus, EngineEvent, Language, AlertState, ValidationType } from './types/index.ts';
import type { TutorialDefinition, TutorialStep, TargetBoundingBox } from './types/index.ts';
import { StateMachine } from './state-machine/state-machine.ts';
import { TutorialParser } from './parser/parser.ts';
import { StepResolver } from './resolver/step-resolver.ts';
import { ValidationEngine } from './validation/validation-engine.ts';
import { ActionEngine } from './actions/action-engine.ts';
import type { ActionUiPayload } from './actions/action-engine.ts';
import { EventBus } from './runtime/event-bus.ts';
import { VariableStore } from './runtime/variable-store.ts';
import { SessionManager } from './runtime/session-manager.ts';
import { I18nManager } from './i18n/i18n-manager.ts';
import { AudioEngine, BaseTtsProvider } from './audio/audio-engine.ts';
import type { BaseTutorialAdapter } from './adapter/base-adapter.ts';

export interface TutorialEngineOptions {
  adapter: BaseTutorialAdapter;
  initialLanguage?: string;
  ttsProvider?: BaseTtsProvider | null;
  beforeNextStep?: ((context: { step: TutorialStep; stepIndex: number; tutorial: TutorialDefinition | null }) => Promise<boolean | void> | boolean | void) | null;
}

export interface EngineStateSnapshot {
  status: string;
  isActive: boolean;
  isCompleted: boolean;
  language: string;
  stepBadgeText: string;
  isPlayingAudio: boolean;
  audioStatus: string;
  volume: number;
  isMuted: boolean;
  tutorial: {
    id: string;
    name: string;
    description: string;
  } | null;
  currentStep: TutorialStep | null;
  currentStepIndex: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  alertState: string;
  targetMissing: boolean;
  canAdvanceNext: boolean;
  boundingBox: TargetBoundingBox | any | null;
  actionPayload: ActionUiPayload | null;
  variables: Record<string, any>;
}

/**
 * Universal Headless Tutorial Engine with Dual-Language (Khmer/English) and Voice Guidance.
 * Drives all tutorial state, step progression, validation, audio triggers, and lifecycle.
 */
export class TutorialEngine {
  public adapter: BaseTutorialAdapter;
  public events: EventBus;
  public variables: VariableStore;
  public session: SessionManager;
  public i18n: I18nManager;
  public audio: AudioEngine;
  public beforeNextStep: ((context: { step: TutorialStep; stepIndex: number; tutorial: TutorialDefinition | null }) => Promise<boolean | void> | boolean | void) | null;
  public stateMachine: StateMachine;

  public activeTutorial: TutorialDefinition | any | null = null;
  public stepResolver: StepResolver | any = null;
  public currentStep: TutorialStep | any | null = null;
  public currentStepIndex: number = 0;
  public targetBoundingBox: TargetBoundingBox | any | null = null;
  public targetMissing: boolean = false;
  public validationSatisfied: boolean = true;
  public alertState: string = AlertState.NORMAL;
  private _alertResetTimer: any = null;

  private _activeValidationCleanup: (() => void) | null = null;
  private _activePositionCleanup: (() => void) | null = null;
  private _startGeneration: number = 0;
  private _lastSpokenStepId: string | null = null;
  private _lastSpokenLang: string | null = null;
  private _lastVoicePromptTime: number = 0;

  constructor({ adapter, initialLanguage = Language.KM, ttsProvider = null, beforeNextStep = null }: TutorialEngineOptions) {
    this.adapter = adapter;
    this.events = new EventBus();
    this.variables = new VariableStore();
    this.session = new SessionManager(adapter);
    this.i18n = new I18nManager({ initialLanguage });
    this.audio = new AudioEngine({ ttsProvider });
    this.beforeNextStep = beforeNextStep;

    this.stateMachine = new StateMachine((from, to, ctx) => {
      this._emitStateChange(from, to, ctx);
    });

    // Synchronize language change with engine subscribers & trigger audio update
    this.i18n.onLanguageChange((newLang) => {
      this.events.emit(EngineEvent.LANGUAGE_CHANGE, { language: newLang });
      if (
        this.currentStep &&
        this.stateMachine.getState() === EngineStatus.STEP_ACTIVE &&
        this._lastSpokenLang !== newLang
      ) {
        this.playVoicePrompt(this.currentStep, newLang);
      }
      this._notifyState();
    });

    // Notify state on audio playback changes so UI equalizer responds instantly
    this.audio.onStatusChange((_status) => {
      this._notifyState();
    });
  }

  /**
   * Subscribe to engine state updates.
   */
  subscribe(listener: (state: EngineStateSnapshot) => void): () => void {
    listener(this.getStateSnapshot());
    return this.events.on(EngineEvent.STATE_CHANGE, () => {
      listener(this.getStateSnapshot());
    });
  }

  /**
   * Initialize engine.
   */
  init(): void {
    this.stateMachine.reset();
  }

  /**
   * Set active language ('km' or 'en').
   */
  setLanguage(lang: string): boolean {
    return this.i18n.setLanguage(lang);
  }

  /**
   * Get active language code.
   */
  getLanguage(): string {
    return this.i18n.getLanguage();
  }

  /**
   * Toggle between Khmer and English.
   */
  toggleLanguage(): string {
    return this.i18n.toggleLanguage();
  }

  /**
   * Get Audio Engine instance.
   */
  getAudioEngine(): AudioEngine {
    return this.audio;
  }

  /**
   * Get I18n Manager instance.
   */
  getI18nManager(): I18nManager {
    return this.i18n;
  }

  /**
   * Play voice narration for a given step in the specified language.
   */
  async playVoicePrompt(step: TutorialStep | null = this.currentStep, lang: string = this.i18n.getLanguage()): Promise<void> {
    if (!step) return;

    const now = Date.now();
    // Guard against duplicate concurrent or rapid sequential invocations for the exact same step & language
    if (
      this._lastSpokenStepId === step.id &&
      this._lastSpokenLang === lang &&
      now - this._lastVoicePromptTime < 350
    ) {
      return;
    }

    this._lastSpokenStepId = step.id;
    this._lastSpokenLang = lang;
    this._lastVoicePromptTime = now;

    const audioConfig = (step as any).audio || (step.action as any)?.audio;
    const fallbackText = this.i18n.resolve((step.action as any)?.content || step.instruction || (step as any).description || step.title, lang);
    await this.audio.play(audioConfig, lang, fallbackText);
  }

  /**
   * Load and parse a tutorial definition.
   */
  loadTutorial(rawTutorial: any): boolean {
    const parseResult = TutorialParser.parse(rawTutorial);
    if (!parseResult.success) {
      console.error('[GuideMe Engine] Tutorial validation failed:', parseResult.errors);
      this.stateMachine.transition(EngineStatus.ERROR, { errors: parseResult.errors });
      return false;
    }

    this.activeTutorial = parseResult.tutorial;
    this.stepResolver = new StepResolver(this.activeTutorial, this.adapter);

    // Set default tutorial language if specified and not manually overridden
    if ((this.activeTutorial as any).defaultLanguage) {
      this.i18n.setLanguage((this.activeTutorial as any).defaultLanguage);
    }

    return true;
  }

  /**
   * Start executing a tutorial.
   */
  async start(tutorialDefinition: any, startStepIndex?: number): Promise<boolean> {
    const startGeneration = ++this._startGeneration;
    this._cleanupStepSubscriptions();

    if (!this.loadTutorial(tutorialDefinition)) {
      return false;
    }

    this.stateMachine.transition(EngineStatus.LOADING);
    this.events.emit(EngineEvent.TUTORIAL_START, { tutorial: this.activeTutorial });

    const stepIndex = await this.session.startSession(this.activeTutorial.id, startStepIndex);
    if (startGeneration !== this._startGeneration) return false;
    await this._activateStep(stepIndex, startGeneration);
    return true;
  }

  /**
   * Advance to the next step.
   */
  async nextStep(bypassValidation: boolean = false): Promise<void> {
    this.audio.stop();
    if (!this.activeTutorial || !this.currentStep) return;
    if (!bypassValidation && !this.validationSatisfied) return;

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
  async prevStep(): Promise<void> {
    this.audio.stop();
    if (!this.activeTutorial || !this.currentStep) return;

    const prevIndex = (this.currentStep as any).defaultPrevStepIndex;
    if (prevIndex !== null && prevIndex >= 0) {
      await this.session.recordStepProgress(this.currentStep.id, prevIndex);
      await this._activateStep(prevIndex);
    }
  }

  /**
   * Skip current step.
   */
  async skipStep(): Promise<void> {
    this.audio.stop();
    await this.nextStep(true);
  }

  /**
   * Set playback volume (0.0 to 1.0).
   */
  setVolume(vol: number): void {
    this.audio.setVolume(vol);
    this._notifyState();
  }

  /**
   * Get current playback volume.
   */
  getVolume(): number {
    return this.audio.getVolume();
  }

  /**
   * Set mute state.
   */
  setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
    this._notifyState();
  }

  /**
   * Check if audio is muted.
   */
  isMuted(): boolean {
    return this.audio.isMuted();
  }

  /**
   * Toggle mute state.
   */
  toggleMute(): boolean {
    const res = this.audio.toggleMute();
    this._notifyState();
    return res;
  }

  /**
   * Pause tutorial execution.
   */
  pause(): void {
    if (this.stateMachine.getState() === EngineStatus.STEP_ACTIVE) {
      this.audio.pause();
      this.stateMachine.transition(EngineStatus.PAUSED);
    }
  }

  /**
   * Resume tutorial execution from paused state.
   */
  resume(): void {
    if (this.stateMachine.getState() === EngineStatus.PAUSED) {
      this.audio.resume();
      this.stateMachine.transition(EngineStatus.STEP_ACTIVE);
    }
  }

  /**
   * Stop and dismiss the tutorial.
   */
  async stop(): Promise<void> {
    this._cleanupStepSubscriptions();
    this.audio.stop();
    await this.session.resetSession();

    this.activeTutorial = null;
    this.currentStep = null;
    this.currentStepIndex = 0;
    this.targetBoundingBox = null;
    this.targetMissing = false;

    this.stateMachine.reset();
    this.events.emit(EngineEvent.TUTORIAL_STOP);
    this._notifyState();
  }

  /**
   * Complete the tutorial successfully.
   */
  async complete(): Promise<void> {
    if (this.stateMachine.getState() === EngineStatus.COMPLETED) {
      return;
    }
    this._cleanupStepSubscriptions();
    this.audio.stop();
    this.stateMachine.transition(EngineStatus.COMPLETED);
    this.events.emit(EngineEvent.TUTORIAL_COMPLETE, { tutorial: this.activeTutorial });
  }

  /**
   * Append dynamically discovered steps to the active tutorial.
   */
  appendSteps(steps: any[] = []): number {
    if (!this.activeTutorial || !Array.isArray(steps) || steps.length === 0) return 0;

    const existingCount = this.activeTutorial.steps.length;
    const appended = steps.map((step, offset) => ({
      ...step,
      index: existingCount + offset,
      isFirst: false,
      isLast: false,
      defaultPrevStepIndex: existingCount + offset - 1,
      defaultNextStepIndex: null,
    }));

    this.activeTutorial.steps.push(...appended);
    for (let index = 0; index < this.activeTutorial.steps.length; index += 1) {
      const step = this.activeTutorial.steps[index];
      step.index = index;
      step.isFirst = index === 0;
      step.isLast = index === this.activeTutorial.steps.length - 1;
      step.defaultPrevStepIndex = index > 0 ? index - 1 : null;
      step.defaultNextStepIndex = index + 1 < this.activeTutorial.steps.length ? index + 1 : null;
      this.activeTutorial.stepMap?.set(step.id, step);
    }

    this._notifyState();
    return appended.length;
  }

  /**
   * Complete teardown and memory cleanup.
   */
  destroy(): void {
    this.stop();
    this.events.clear();
    this.variables.clear();
  }

  /**
   * Get current reactive snapshot for UI components with localized content.
   */
  getStateSnapshot(): EngineStateSnapshot {
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
      volume: this.audio.getVolume(),
      isMuted: this.audio.isMuted(),
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
      alertState: this.alertState,
      targetMissing: this.targetMissing,
      canAdvanceNext: this.validationSatisfied,
      boundingBox: this.targetBoundingBox,
      actionPayload: ActionEngine.getActionUiPayload(this.currentStep, this.targetBoundingBox, this.i18n),
      variables: this.variables.toObject(),
    };
  }

  // --- Internal Methods ---

  private async _activateStep(stepIndex: number, startGeneration: number | null = null): Promise<void> {
    this._cleanupStepSubscriptions();

    const step = this.stepResolver.getStepByIndex(stepIndex);
    if (!step) {
      console.error(`[GuideMe Engine] Step index out of range: ${stepIndex}`);
      await this.complete();
      return;
    }

    this.currentStep = step;
    this.currentStepIndex = stepIndex;
    this.validationSatisfied = !step.validation || step.validation.type === ValidationType.MANUAL_NEXT;

    // Execute pre-step actions (e.g. scroll into view)
    await ActionEngine.executeStepActions(step, this.adapter);
    if (startGeneration !== null && startGeneration !== this._startGeneration) return;

    // Resolve target coordinates
    if (step.target && this.adapter) {
      const { boundingBox } = await this.stepResolver.resolveTarget(step, 5000);
      if (startGeneration !== null && startGeneration !== this._startGeneration) return;
      this.targetBoundingBox = boundingBox;
      this.targetMissing = !boundingBox || (boundingBox.width === 0 && boundingBox.height === 0);

      // Start continuous position tracking
      this._activePositionCleanup = this.adapter.observeTargetPosition(step.target, (newBox: any) => {
        this.targetBoundingBox = newBox;
        this.targetMissing = !newBox || (newBox.width === 0 && newBox.height === 0);
        this._notifyState();
      });
    } else {
      this.targetBoundingBox = null;
      this.targetMissing = false;
    }

    this.stateMachine.transition(EngineStatus.STEP_ACTIVE, { step });
    this.events.emit(EngineEvent.STEP_START, { step, stepIndex });

    // Trigger voice guidance
    if (step.audio?.autoPlay !== false) {
      this.playVoicePrompt(step);
    }

    const boundGeneration = this._startGeneration;
    this._activeValidationCleanup = ValidationEngine.bindValidation(
      step,
      this.adapter,
      async (result) => {
        if (result.valid) {
          this.validationSatisfied = true;
          this._clearAlertState();
          this.events.emit(EngineEvent.STEP_SUCCESS, { step, eventData: result.eventData });
          if (typeof this.beforeNextStep === 'function') {
            const shouldAdvance = await this.beforeNextStep({
              step,
              stepIndex: this.currentStepIndex,
              tutorial: this.activeTutorial,
            });
            if (this._startGeneration !== boundGeneration) return;
            if (shouldAdvance === false) return;
          }
          await this.nextStep();
        }
      },
      {
        targetBoundingBox: this.targetBoundingBox,
        getTargetBoundingBox: () => this.targetBoundingBox,
        hesitationTimeoutMs: (step as any).hesitationTimeoutMs || 15000,
        onHesitation: () => {
          this._handleHesitation(step);
        },
        onMisclick: (data: any) => {
          this._handleMisclick(step, data);
        },
      }
    );

    this._notifyState();
  }

  private _cleanupStepSubscriptions(): void {
    this._clearAlertState();
    this.audio.stop();
    if (typeof this._activeValidationCleanup === 'function') {
      this._activeValidationCleanup();
      this._activeValidationCleanup = null;
    }
    if (typeof this._activePositionCleanup === 'function') {
      this._activePositionCleanup();
      this._activePositionCleanup = null;
    }
  }

  private _handleHesitation(step: TutorialStep): void {
    this.alertState = AlertState.HESITATION;
    this.events.emit(EngineEvent.HESITATION_DETECTED, { step });
    this._notifyState();

    const currentLang = this.i18n.getLanguage();
    const hintText =
      currentLang === Language.KM
        ? 'សូមចុចលើប្រអប់ដែលបានសម្គាល់ដើម្បីបន្ត'
        : 'Please click the highlighted box to continue';
    this.audio.play(null, currentLang, hintText);
  }

  private _handleMisclick(step: TutorialStep, data: any): void {
    this.alertState = AlertState.MISCLICK;
    this.events.emit(EngineEvent.MISCLICK_DETECTED, { step, ...data });
    this._notifyState();

    const currentLang = this.i18n.getLanguage();
    const warningText =
      currentLang === Language.KM
        ? 'អ្នកបានចុចខុសកន្លែង សូមចុចលើប្រអប់ដែលបានសម្គាល់'
        : 'Clicked outside. Please click the highlighted box';
    this.audio.play(null, currentLang, warningText);

    if (this._alertResetTimer) {
      clearTimeout(this._alertResetTimer);
    }
    this._alertResetTimer = setTimeout(() => {
      if (this.alertState === AlertState.MISCLICK) {
        this.alertState = AlertState.NORMAL;
        this._notifyState();
      }
    }, 1500);
  }

  async retryLocateTarget(): Promise<void> {
    if (!this.currentStep || !this.currentStep.target || !this.adapter) return;
    const { boundingBox } = await this.stepResolver.resolveTarget(this.currentStep, 2000);
    this.targetBoundingBox = boundingBox;
    this.targetMissing = !boundingBox || (boundingBox.width === 0 && boundingBox.height === 0);
    this._notifyState();
  }

  private _clearAlertState(): void {
    if (this._alertResetTimer) {
      clearTimeout(this._alertResetTimer);
      this._alertResetTimer = null;
    }
    this.alertState = AlertState.NORMAL;
  }

  private _notifyState(): void {
    this.events.emit(EngineEvent.STATE_CHANGE, this.getStateSnapshot());
  }

  private _emitStateChange(from: string, to: string, context?: any): void {
    this.events.emit(EngineEvent.STATE_CHANGE, {
      previousState: from,
      currentState: to,
      context,
      snapshot: this.getStateSnapshot(),
    });
  }
}
