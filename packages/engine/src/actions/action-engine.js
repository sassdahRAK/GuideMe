import { ActionType, Language } from '@guideme/core-types';

/**
 * Prepares and dispatches UI actions (scrolling, spotlights, tooltips, modals)
 * with full dual-language (Khmer / English) resolution.
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
      try {
        await adapter.scrollToElement(step.target);
      } catch (err) {
        console.warn('[GuideMe ActionEngine] Scroll to target failed:', err);
      }
    }
  }

  /**
   * Format action state for the reactive UI layer, resolving localized strings.
   * @param {Object} step
   * @param {Object|null} targetBoundingBox
   * @param {import('../i18n/i18n-manager.js').I18nManager} [i18n]
   * @returns {Object}
   */
  static getActionUiPayload(step, targetBoundingBox, i18n) {
    if (!step) return null;

    const action = step.action || { type: ActionType.TOOLTIP };
    const lang = i18n?.getLanguage() || Language.KM;

    const resolve = (val) => (i18n ? i18n.resolve(val, lang) : typeof val === 'object' ? val?.[lang] || '' : val || '');

    const title = resolve(action.title || step.title);
    const content = resolve(action.content || action.instruction || step.instruction || step.description || '');
    const subtitle = resolve(action.subtitle || action.description || '');
    const isInput = step.validation?.type === 'input' || step.validation?.type === 'change' || action.category === 'input';
    const defaultActionText = isInput
      ? (lang === Language.KM ? 'វាយបញ្ចូល' : 'TYPE HERE')
      : (lang === Language.KM ? 'ចុចទីនេះ' : 'CLICK HERE');
    const actionText = resolve(action.actionText) || defaultActionText;
    const coachTitle = resolve(action.coachTitle) || (lang === Language.KM ? 'GuideMe - ការណែនាំផ្ទាល់' : 'GuideMe - AI Live Coach');

    // Resolve audio narration status text
    const audioConfig = step.audio || action.audio;
    let audioStatusText = '';
    if (audioConfig) {
      const langAudio = audioConfig[lang] || audioConfig;
      audioStatusText = resolve(langAudio?.transcript || langAudio?.statusText) ||
        (lang === Language.KM ? 'កំពុងអានការណែនាំជាសំឡេង...' : 'Playing voice guidance...');
    } else {
      audioStatusText = lang === Language.KM ? 'ការណែនាំជាសំឡេង (Voice Guidance)' : 'Voice Guidance Available';
    }

    return {
      type: action.type,
      title,
      content,
      subtitle,
      actionText,
      coachTitle,
      audioStatusText,
      audio: audioConfig || null,
      placement: action.placement || 'bottom',
      beacon: !!action.beacon,
      canSkip: !!step.canSkip,
      targetBoundingBox,
    };
  }
}
