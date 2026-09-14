/**
 * Canonical GuideMe Domain Type Definitions
 */

export type BilingualObject = {
  km?: string;
  en?: string;
  [key: string]: unknown;
};

export type LocalizedText = string | BilingualObject;

export type StepActionType =
  | 'spotlight'
  | 'tooltip'
  | 'scroll_into_view'
  | 'modal'
  | 'banner'
  | (string & {});

export type StepValidationType =
  | 'click'
  | 'input'
  | 'change'
  | 'submit'
  | 'url_change'
  | 'element_exists'
  | 'manual_next'
  | 'custom_predicate'
  | (string & {});

export type StepPlacement =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'center'
  | 'auto'
  | (string & {});

export interface StepTarget {
  css?: string;
  xpath?: string;
  text?: string;
  testId?: string;
  ariaLabel?: string;
  role?: string;
  placeholder?: string;
  [key: string]: unknown;
}

export interface StepAction {
  type?: StepActionType;
  title?: LocalizedText;
  content?: LocalizedText;
  instruction?: LocalizedText;
  placement?: StepPlacement;
  [key: string]: unknown;
}

export interface StepValidation {
  type?: StepValidationType;
  expectedValue?: string | number;
  timeoutMs?: number;
  selector?: StepTarget;
  [key: string]: unknown;
}

export interface TutorialStep {
  id: string;
  title?: LocalizedText;
  instruction?: LocalizedText;
  description?: LocalizedText;
  action: StepAction;
  validation: StepValidation;
  target?: StepTarget;
  audio?: {
    text?: LocalizedText;
    audioUrl?: string;
    rate?: number;
    [key: string]: unknown;
  };
  onSuccessNextStepId?: string;
  defaultNextStepIndex?: number | null;
  canSkip?: boolean;
  index?: number;
  [key: string]: unknown;
}

export interface TutorialDefinition {
  id: string;
  name?: LocalizedText;
  title?: LocalizedText;
  description?: LocalizedText;
  matchUrls: string[];
  steps: TutorialStep[];
  version?: string;
  category?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface TargetBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
  bottom: number;
  right: number;
  isClipped?: boolean;
  visibleTop?: number;
  visibleLeft?: number;
  visibleWidth?: number;
  visibleHeight?: number;
}

export interface TargetDescription {
  tag: string;
  id: string;
  className: string;
  role: string;
  ariaLabel: string;
  text: string;
  selector: StepTarget;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null;
}
