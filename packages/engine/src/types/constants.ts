/**
 * Engine Finite State Machine States
 */
export const EngineStatus = {
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  STEP_ACTIVE: 'STEP_ACTIVE',
  VALIDATING: 'VALIDATING',
  STEP_COMPLETED: 'STEP_COMPLETED',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR',
} as const;

export type EngineStatus = typeof EngineStatus[keyof typeof EngineStatus];

/**
 * Step Action Visual & Interactive Types
 */
export const ActionType = {
  SPOTLIGHT: 'spotlight',
  TOOLTIP: 'tooltip',
  SCROLL_INTO_VIEW: 'scroll_into_view',
  MODAL: 'modal',
  BANNER: 'banner',
} as const;

export type ActionType = typeof ActionType[keyof typeof ActionType];

/**
 * Step Validation Trigger Types
 */
export const ValidationType = {
  CLICK: 'click',
  INPUT: 'input',
  CHANGE: 'change',
  SUBMIT: 'submit',
  URL_CHANGE: 'url_change',
  ELEMENT_EXISTS: 'element_exists',
  MANUAL_NEXT: 'manual_next',
  CUSTOM_PREDICATE: 'custom_predicate',
} as const;

export type ValidationType = typeof ValidationType[keyof typeof ValidationType];

/**
 * Tooltip Placements
 */
export const Placement = {
  TOP: 'top',
  BOTTOM: 'bottom',
  LEFT: 'left',
  RIGHT: 'right',
  CENTER: 'center',
  AUTO: 'auto',
} as const;

export type Placement = typeof Placement[keyof typeof Placement];

/**
 * Supported Languages for Dual-Language Guidance
 */
export const Language = {
  KM: 'km', // Khmer (Primary)
  EN: 'en', // English (Secondary)
} as const;

export type Language = typeof Language[keyof typeof Language];

/**
 * Audio Engine Playback States
 */
export const AudioPlaybackStatus = {
  IDLE: 'idle',
  BUFFERING: 'buffering',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ENDED: 'ended',
  ERROR: 'error',
} as const;

export type AudioPlaybackStatus = typeof AudioPlaybackStatus[keyof typeof AudioPlaybackStatus];

export const AlertState = {
  NORMAL: 'normal',
  HESITATION: 'hesitation',
  MISCLICK: 'misclick',
} as const;

export type AlertState = typeof AlertState[keyof typeof AlertState];

/**
 * Engine Event Names
 */
export const EngineEvent = {
  STATE_CHANGE: 'engine:state_change',
  STEP_START: 'engine:step_start',
  STEP_SUCCESS: 'engine:step_success',
  STEP_SKIPPED: 'engine:step_skipped',
  STEP_ERROR: 'engine:step_error',
  TUTORIAL_START: 'engine:tutorial_start',
  TUTORIAL_COMPLETE: 'engine:tutorial_complete',
  TUTORIAL_STOP: 'engine:tutorial_stop',
  LANGUAGE_CHANGE: 'engine:language_change',
  HESITATION_DETECTED: 'engine:hesitation_detected',
  MISCLICK_DETECTED: 'engine:misclick_detected',
  TARGET_RESOLVED: 'engine:target_resolved',
  TARGET_RESOLUTION_FAILED: 'engine:target_resolution_failed',
} as const;

export type EngineEvent = typeof EngineEvent[keyof typeof EngineEvent];

/**
 * Target Resolution Tiers (Universal Targeting & Rendering Engine).
 * Mirrors the tiered support model documented in docs/compatibility-matrix.md.
 */
export const TargetTier = Object.freeze({
  DOM: 1,             // Standard DOM, SVG, same-origin iframes
  CANVAS_CONTAINER: 2, // <canvas> bounding box, no coordinate map available
  CANVAS_MAP: 3,       // <canvas> with a registered, version-matched coordinate map
  PLATFORM_NATIVE: 4,  // Structural API + logical-position anchoring (stub only)
  FALLBACK: 'fallback', // Directional/textual guidance anchored to nearest known container
});

/**
 * Reporting Event Names (guide coverage & execution telemetry).
 * See packages/reporting/src/event-log.js.
 */
export const ReportingEvent = Object.freeze({
  GUIDE_STEP_STARTED: 'guide_step_started',
  GUIDE_STEP_COMPLETED: 'guide_step_completed',
  GUIDE_STEP_SKIPPED: 'guide_step_skipped',
  TARGET_RESOLVED: 'target_resolved',
  TARGET_RESOLUTION_FAILED: 'target_resolution_failed',
  GUIDE_COMPLETED: 'guide_completed',
  GUIDE_ABANDONED: 'guide_abandoned',
});

/**
 * Audio Engine Event Names
 */
export const AudioEngineEvent = {
  PLAY: 'audio:play',
  PAUSE: 'audio:pause',
  STOP: 'audio:stop',
  ENDED: 'audio:ended',
  STATUS_CHANGE: 'audio:status_change',
  LANGUAGE_CHANGE: 'audio:language_change',
  ERROR: 'audio:error',
} as const;

export type AudioEngineEvent = typeof AudioEngineEvent[keyof typeof AudioEngineEvent];
