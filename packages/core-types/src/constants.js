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
 * Supported Languages for Dual-Language Guidance
 */
export const Language = Object.freeze({
  KM: 'km', // Khmer (Primary)
  EN: 'en', // English (Secondary)
});

/**
 * Audio Engine Playback States
 */
export const AudioPlaybackStatus = Object.freeze({
  IDLE: 'idle',
  BUFFERING: 'buffering',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ENDED: 'ended',
  ERROR: 'error',
});

export const AlertState = Object.freeze({
  NORMAL: 'normal',
  HESITATION: 'hesitation',
  MISCLICK: 'misclick',
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
  LANGUAGE_CHANGE: 'engine:language_change',
  HESITATION_DETECTED: 'engine:hesitation_detected',
  MISCLICK_DETECTED: 'engine:misclick_detected',
});

/**
 * Audio Engine Event Names
 */
export const AudioEngineEvent = Object.freeze({
  PLAY: 'audio:play',
  PAUSE: 'audio:pause',
  STOP: 'audio:stop',
  ENDED: 'audio:ended',
  STATUS_CHANGE: 'audio:status_change',
  LANGUAGE_CHANGE: 'audio:language_change',
  ERROR: 'audio:error',
});




