import { EngineStatus } from '@guideme/core-types';

/**
 * Deterministic Finite State Machine managing Engine lifecycle.
 */
export class StateMachine {
  /**
   * @param {(fromState: string, toState: string, context: Object) => void} [onTransition]
   */
  constructor(onTransition) {
    this.currentState = EngineStatus.IDLE;
    this.onTransition = onTransition;

    // Allowed state transitions
    this.transitions = {
      [EngineStatus.IDLE]: [EngineStatus.LOADING, EngineStatus.STEP_ACTIVE, EngineStatus.ERROR],
      [EngineStatus.LOADING]: [EngineStatus.STEP_ACTIVE, EngineStatus.STEP_COMPLETED, EngineStatus.IDLE, EngineStatus.ERROR],
      [EngineStatus.STEP_ACTIVE]: [EngineStatus.STEP_ACTIVE, EngineStatus.VALIDATING, EngineStatus.PAUSED, EngineStatus.STEP_COMPLETED, EngineStatus.COMPLETED, EngineStatus.IDLE, EngineStatus.ERROR],
      [EngineStatus.VALIDATING]: [EngineStatus.STEP_ACTIVE, EngineStatus.STEP_COMPLETED, EngineStatus.COMPLETED, EngineStatus.ERROR, EngineStatus.IDLE],
      [EngineStatus.STEP_COMPLETED]: [EngineStatus.STEP_ACTIVE, EngineStatus.STEP_COMPLETED, EngineStatus.COMPLETED, EngineStatus.IDLE, EngineStatus.ERROR],
      [EngineStatus.PAUSED]: [EngineStatus.STEP_ACTIVE, EngineStatus.IDLE, EngineStatus.ERROR],
      [EngineStatus.COMPLETED]: [EngineStatus.IDLE, EngineStatus.LOADING, EngineStatus.STEP_ACTIVE],
      [EngineStatus.ERROR]: [EngineStatus.IDLE, EngineStatus.LOADING],
    };
  }

  /**
   * Get current state.
   * @returns {string}
   */
  getState() {
    return this.currentState;
  }

  /**
   * Transition to next state.
   * @param {string} nextState
   * @param {Object} [context={}]
   * @returns {boolean}
   */
  transition(nextState, context = {}) {
    const allowed = this.transitions[this.currentState] || [];
    if (!allowed.includes(nextState)) {
      console.warn(`[GuideMe StateMachine] Invalid transition from '${this.currentState}' to '${nextState}'`);
      return false;
    }

    const previousState = this.currentState;
    this.currentState = nextState;

    if (typeof this.onTransition === 'function') {
      this.onTransition(previousState, nextState, context);
    }

    return true;
  }

  /**
   * Reset state to IDLE.
   */
  reset() {
    const previousState = this.currentState;
    this.currentState = EngineStatus.IDLE;
    if (typeof this.onTransition === 'function') {
      this.onTransition(previousState, EngineStatus.IDLE, {});
    }
  }
}
