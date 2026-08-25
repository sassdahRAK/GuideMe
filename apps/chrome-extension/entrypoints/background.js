import { defineBackground } from 'wxt/sandbox';
import { ExtensionMessageAction } from '@guideme/core-types';

export default defineBackground(() => {
  console.log('[GuideMe Background] Service Worker initialized');

  // Handle messages forwarded between popup and content scripts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === ExtensionMessageAction.TUTORIAL_STATE_UPDATED) {
      const { active, currentStepIndex, totalSteps } = message.payload || {};

      if (active && sender.tab?.id) {
        chrome.action.setBadgeText({
          tabId: sender.tab.id,
          text: `${(currentStepIndex || 0) + 1}/${totalSteps || 1}`,
        });
        chrome.action.setBadgeBackgroundColor({
          tabId: sender.tab.id,
          color: '#0284c7',
        });
      } else if (sender.tab?.id) {
        chrome.action.setBadgeText({
          tabId: sender.tab.id,
          text: '',
        });
      }
    }
    return false;
  });
});
