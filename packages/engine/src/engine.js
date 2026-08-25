import { EngineStatus, EngineEvent } from '@guideme/core-types';
import { StateMachine } from './state-machine/state-machine.js';
import { TutorialParser } from './parser/parser.js';
import { StepResolver } from './resolver/step-resolver.js';
import { ValidationEngine } from './validation/validation-engine.js';
import { ActionEngine } from './actions/action-engine.js';
import { EventBus } from './runtime/event-bus.js';
import { VariableStore } from './runtime/variable-store.js';
import { SessionManager } from './runtime/session-manager.js';

/**
 * Universal Headless Tutorial Engine.
 * Drives all tutorial state, step progression, validation, and lifecycle without UI coupling.
 */
export class TutorialEngine {
  /**
   * @param {Object} options
   * @param {import('@guideme/adapter-interface').BaseTutorialAdapter} options.adapter
   */
  constructor({ adapter }) {
    this.adapter = adapter;
    this.events = new EventBus();
    this.variables = new VariableStore();
    this.session = new SessionManager(adapter);

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
  }

  /**
   * Subscribe to engine state updates.
   * @param {(state: Object) => void} listener
   * @returns {() => void} Unsubscribe function
   */
  subscribe(listener) {
    // Send immediate initial state
    listener(this.getStateSnapshot());
    return this.events.on(EngineEvent.STATE_CHANGE, () => {
      listener(this.getStateSnapshot());
    });
  }

  /**
   * Initialize engine and verify adapter presence.
   */
  init() {
    this.stateMachine.reset();
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
      this.stateMachine.transition(EngineStatus.PAUSED);
    }
  }

  /**
   * Resume tutorial execution from paused state.
   */
  resume() {
    if (this.stateMachine.getState() === EngineStatus.PAUSED) {
      this.stateMachine.transition(EngineStatus.STEP_ACTIVE);
    }
  }

  /**
   * Stop and dismiss the tutorial.
   */
  async stop() {
    this._cleanupStepSubscriptions();
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
   * Get current reactive snapshot for UI components.
   * @returns {Object}
   */
  getStateSnapshot() {
    const status = this.stateMachine.getState();
    const isActive = status === EngineStatus.STEP_ACTIVE || status === EngineStatus.VALIDATING || status === EngineStatus.PAUSED;

    return {
      status,
      isActive,
      isCompleted: status === EngineStatus.COMPLETED,
      tutorial: this.activeTutorial ? {
        id: this.activeTutorial.id,
        name: this.activeTutorial.name,
        description: this.activeTutorial.description,
      } : null,
      currentStep: this.currentStep,
      currentStepIndex: this.currentStepIndex,
      totalSteps: this.activeTutorial?.steps?.length || 0,
      isFirstStep: this.currentStep?.isFirst ?? false,
      isLastStep: this.currentStep?.isLast ?? false,
      boundingBox: this.targetBoundingBox,
      actionPayload: ActionEngine.getActionUiPayload(this.currentStep, this.targetBoundingBox),
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
