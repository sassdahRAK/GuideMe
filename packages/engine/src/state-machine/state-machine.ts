import { EngineStatus } from '../types/index.ts';

export type TransitionCallback = (
  fromState: EngineStatus,
  toState: EngineStatus,
  context: Record<string, unknown>
) => void;

/**
 * Deterministic Finite State Machine managing Engine lifecycle.
 */
export class StateMachine {
  private currentState: EngineStatus;
  private onTransition?: TransitionCallback;
  private transitions: Record<EngineStatus, EngineStatus[]>;

  constructor(onTransition?: TransitionCallback) {
    this.currentState = EngineStatus.IDLE;
    this.onTransition = onTransition;

    // Allowed state transitions
    this.transitions = {
      [EngineStatus.IDLE]: [EngineStatus.LOADING, EngineStatus.STEP_ACTIVE, EngineStatus.ERROR],
      [EngineStatus.LOADING]: [EngineStatus.STEP_ACTIVE, EngineStatus.STEP_COMPLETED, EngineStatus.IDLE, EngineStatus.ERROR],
      [EngineStatus.STEP_ACTIVE]: [EngineStatus.STEP_ACTIVE, EngineStatus.LOADING, EngineStatus.VALIDATING, EngineStatus.PAUSED, EngineStatus.STEP_COMPLETED, EngineStatus.COMPLETED, EngineStatus.IDLE, EngineStatus.ERROR],
      [EngineStatus.VALIDATING]: [EngineStatus.STEP_ACTIVE, EngineStatus.LOADING, EngineStatus.STEP_COMPLETED, EngineStatus.COMPLETED, EngineStatus.ERROR, EngineStatus.IDLE],
      [EngineStatus.STEP_COMPLETED]: [EngineStatus.STEP_ACTIVE, EngineStatus.LOADING, EngineStatus.STEP_COMPLETED, EngineStatus.COMPLETED, EngineStatus.IDLE, EngineStatus.ERROR],
      [EngineStatus.PAUSED]: [EngineStatus.STEP_ACTIVE, EngineStatus.LOADING, EngineStatus.IDLE, EngineStatus.ERROR],
      [EngineStatus.COMPLETED]: [EngineStatus.COMPLETED, EngineStatus.IDLE, EngineStatus.LOADING, EngineStatus.STEP_ACTIVE],
      [EngineStatus.ERROR]: [EngineStatus.IDLE, EngineStatus.LOADING],
    };
  }

  /**
   * Get current state.
   */
  getState(): EngineStatus {
    return this.currentState;
  }

  /**
   * Transition to next state.
   */
  transition(nextState: EngineStatus, context: Record<string, unknown> = {}): boolean {
    // Idempotent self-transitions are safe no-ops
    if (this.currentState === nextState) {
      return true;
    }

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
  reset(): void {
    const previousState = this.currentState;
    this.currentState = EngineStatus.IDLE;
    if (typeof this.onTransition === 'function') {
      this.onTransition(previousState, EngineStatus.IDLE, {});
    }
  }
}
