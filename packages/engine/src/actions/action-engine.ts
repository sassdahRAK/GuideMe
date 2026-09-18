import { ActionType, Language } from '../types/index.ts';
import type { TutorialStep, StepTarget } from '../types/index.ts';
import type { BaseTutorialAdapter } from '../adapter/base-adapter.ts';
import type { I18nManager } from '../i18n/i18n-manager.ts';

export interface ActionUiPayload {
  type: string;
  title: string;
  content: string;
  subtitle: string;
  actionText: string;
  coachTitle: string;
  audioStatusText: string;
  audio: any | null;
  placement: string;
  beacon: boolean;
  canSkip: boolean;
  targetBoundingBox: any | null;
}

/**
 * Prepares and dispatches UI actions (scrolling, spotlights, tooltips, modals)
 * with full dual-language (Khmer / English) resolution.
 */
export class ActionEngine {
  /**
   * Execute preparatory actions for a step (e.g. scroll target into view).
   */
  static async executeStepActions(step: TutorialStep | null | undefined, adapter: BaseTutorialAdapter | null | undefined): Promise<void> {
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
   */
  static getActionUiPayload(
    step: TutorialStep | null | undefined,
    targetBoundingBox: any | null,
    i18n?: I18nManager | null
  ): ActionUiPayload | null {
    if (!step) return null;

    const action = step.action || { type: ActionType.TOOLTIP };
    const lang = i18n?.getLanguage() || Language.KM;

    const resolve = (val: any): string => (i18n ? i18n.resolve(val, lang) : typeof val === 'object' ? val?.[lang] || '' : val || '');

    const title = resolve((action as any).title || step.title);
    let content = resolve((action as any).content || (action as any).instruction || (step as any).instruction || (step as any).description || '');
    const subtitle = resolve((action as any).subtitle || (action as any).description || '');

    // Targeting fallback: when the resolver couldn't pin an exact element
    // (Tier "fallback", or a Tier-3 canvas map that missed its region), the
    // adapter still attaches a directional hint to the resolved box so the
    // step never renders with silent/empty guidance. Built here (not in the
    // resolver) so it can be localized like every other user-facing string.
    if (targetBoundingBox?.hintScope) {
      const label = targetBoundingBox.hintLabel;
      const fallbackHint = lang === Language.KM
        ? (targetBoundingBox.hintScope === 'viewport'
            ? (label ? `មិនអាចកំណត់ទីតាំង "${label}" នៅលើទំព័រនេះបានទេ — សូមមើលនៅជុំវិញអេក្រង់។` : 'មិនអាចកំណត់ទីតាំងធាតុនេះនៅលើទំព័រនេះបានទេ — សូមមើលនៅជុំវិញអេក្រង់។')
            : (label ? `មិនអាចកំណត់ទីតាំងច្បាស់លាស់បានទេ។ សូមមើលនៅក្នុងផ្ទៃដែលបានរំលេចសម្រាប់ "${label}"។` : 'មិនអាចកំណត់ទីតាំងច្បាស់លាស់បានទេ។ សូមមើលនៅក្នុងផ្ទៃដែលបានរំលេច។'))
        : (targetBoundingBox.hintScope === 'viewport'
            ? (label ? `We couldn't automatically locate "${label}" on this page — look around the screen for it.` : "We couldn't automatically locate this control on this page — look around the screen for it.")
            : (label ? `We couldn't pinpoint the exact control. Look inside the highlighted area for "${label}".` : "We couldn't pinpoint the exact control. Look inside the highlighted area."));
      content = content ? `${content}\n\n${fallbackHint}` : fallbackHint;
    } else if (targetBoundingBox?.unsupportedCooperativeIframe) {
      const iframeHint = lang === Language.KM
        ? 'ធាតុនេះស្ថិតនៅក្នុងស៊ុមបង្កប់មួយដែលមិនអាចគាំទ្របានពេញលេញ។ សូមមើលនៅក្នុងផ្ទៃដែលបានរំលេចខាងក្រោម។'
        : "This control is inside an embedded frame we can't fully support. Look inside the highlighted area.";
      content = content ? `${content}\n\n${iframeHint}` : iframeHint;
    }
    const isInput = step.validation?.type === 'input' || step.validation?.type === 'change' || (action as any).category === 'input';
    const defaultActionText = isInput
      ? (lang === Language.KM ? 'វាយបញ្ចូល' : 'TYPE HERE')
      : (lang === Language.KM ? 'ចុចទីនេះ' : 'CLICK HERE');
    const actionText = resolve((action as any).actionText) || defaultActionText;
    const coachTitle = resolve((action as any).coachTitle) || (lang === Language.KM ? 'GuideMe - ការណែនាំផ្ទាល់' : 'GuideMe - AI Live Coach');

    // Resolve audio narration status text
    const audioConfig = (step as any).audio || (action as any).audio;
    let audioStatusText = '';
    if (audioConfig) {
      const langAudio = audioConfig[lang] || audioConfig;
      audioStatusText = resolve(langAudio?.transcript || langAudio?.statusText) ||
        (lang === Language.KM ? 'កំពុងអានការណែនាំជាសំឡេង...' : 'Playing voice guidance...');
    } else {
      audioStatusText = lang === Language.KM ? 'ការណែនាំជាសំឡេង (Voice Guidance)' : 'Voice Guidance Available';
    }

    return {
      type: action.type || ActionType.TOOLTIP,
      title,
      content,
      subtitle,
      actionText,
      coachTitle,
      audioStatusText,
      audio: audioConfig || null,
      placement: (action as any).placement || 'bottom',
      beacon: !!(action as any).beacon,
      canSkip: !!step.canSkip,
      targetBoundingBox,
    };
  }
}
