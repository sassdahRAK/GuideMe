import { ActionType } from '@guideme/core-types';

/**
 * Prepares and dispatches UI actions (scrolling, spotlights, tooltips, modals).
 */
export class ActionEngine {
  /**
   * Execute preparatory actions for a step (e.g. scroll target into view).
   * @param {Object} step
   * @param {import('@guideme/adapter-interface').BaseTutorialAdapter} adapter
   * @returns {Promise<void>}
   */
  static async executeStepActions(step, adapter) {
    if (!step || !adapter) return;

    if (step.target) {
      // Auto-scroll target into view if required
      try {
        await adapter.scrollToElement(step.target);
      } catch (err) {
        console.warn('[GuideMe ActionEngine] Scroll to target failed:', err);
      }
    }
  }

  /**
   * Format action state for the reactive UI layer.
   * @param {Object} step
   * @param {Object|null} targetBoundingBox
   * @returns {Object}
   */
  static getActionUiPayload(step, targetBoundingBox) {
    if (!step) return null;

    const action = step.action || { type: ActionType.TOOLTIP };
    return {
      type: action.type,
      title: action.title || step.title,
      content: action.content || step.description || '',
      placement: action.placement || 'bottom',
      beacon: !!action.beacon,
      canSkip: !!step.canSkip,
      targetBoundingBox,
    };
  }
}
