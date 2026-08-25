/**
 * Engine Finite State Machine States
 */
export const EngineStatus = Object.freeze({
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  STEP_ACTIVE: 'STEP_ACTIVE',
  VALIDATING: 'VALIDATING',
  STEP_COMPLETED: 'STEP_COMPLETED',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR',
});

/**
 * Step Action Visual & Interactive Types
 */
export const ActionType = Object.freeze({
  SPOTLIGHT: 'spotlight',
  TOOLTIP: 'tooltip',
  SCROLL_INTO_VIEW: 'scroll_into_view',
  MODAL: 'modal',
  BANNER: 'banner',
});

/**
 * Step Validation Trigger Types
 */
export const ValidationType = Object.freeze({
  CLICK: 'click',
  INPUT: 'input',
  CHANGE: 'change',
  SUBMIT: 'submit',
  URL_CHANGE: 'url_change',
  ELEMENT_EXISTS: 'element_exists',
  MANUAL_NEXT: 'manual_next',
  CUSTOM_PREDICATE: 'custom_predicate',
});

/**
 * Tooltip Placements
 */
export const Placement = Object.freeze({
  TOP: 'top',
  BOTTOM: 'bottom',
  LEFT: 'left',
  RIGHT: 'right',
  CENTER: 'center',
  AUTO: 'auto',
});

/**
 * Engine Event Names
 */
export const EngineEvent = Object.freeze({
  STATE_CHANGE: 'engine:state_change',
  STEP_START: 'engine:step_start',
  STEP_SUCCESS: 'engine:step_success',
  STEP_ERROR: 'engine:step_error',
  TUTORIAL_START: 'engine:tutorial_start',
  TUTORIAL_COMPLETE: 'engine:tutorial_complete',
  TUTORIAL_STOP: 'engine:tutorial_stop',
});
