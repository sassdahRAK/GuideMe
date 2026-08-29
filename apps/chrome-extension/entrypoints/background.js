import { defineBackground } from 'wxt/sandbox';
import { ExtensionMessageAction } from '@guideme/core-types';

export default defineBackground(() => {
  console.log('[GuideMe Background] Service Worker initialized');

  // Handle messages forwarded between popup and content scripts
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // ── Tutorial step badge updates ──
    if (message.action === ExtensionMessageAction.TUTORIAL_STATE_UPDATED) {
      const { active, currentStepIndex, totalSteps } = message.payload || {};

      if (active && sender.tab?.id) {
        chrome.action.setBadgeText({
          tabId: sender.tab.id,
          text: `${(currentStepIndex || 0) + 1}/${totalSteps || 1}`,
        });
        chrome.action.setBadgeBackgroundColor({
          tabId: sender.tab.id,
          color: '#9333ea', // Brand purple
        });
      } else if (sender.tab?.id) {
        chrome.action.setBadgeText({
          tabId: sender.tab.id,
          text: '',
        });
      }
    }

    // ── Open real Chrome extension popup ──
    if (message.action === 'OPEN_POPUP') {
      const windowId = sender.tab?.windowId;
      if (chrome.action?.openPopup) {
        chrome.action.openPopup(windowId ? { windowId } : undefined).catch(() => {
          chrome.windows.create({
            url: chrome.runtime.getURL('popup.html'),
            type: 'popup',
            width: 400,
            height: 620,
            focused: true,
          });
        });
      } else {
        chrome.windows.create({
          url: chrome.runtime.getURL('popup.html'),
          type: 'popup',
          width: 400,
          height: 620,
          focused: true,
        });
      }
      sendResponse({ success: true });
      return false;
    }

    // ── Open Dashboard in-page overlay on active tab ──
    if (message.action === 'OPEN_DASHBOARD' || message.action === 'OPEN_DASHBOARD_OVERLAY') {
      const targetTabId = sender.tab?.id;
      if (targetTabId) {
        chrome.tabs.sendMessage(targetTabId, { action: 'OPEN_DASHBOARD_OVERLAY' });
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
          if (activeTab?.id) {
            chrome.tabs.sendMessage(activeTab.id, { action: 'OPEN_DASHBOARD_OVERLAY' });
          }
        });
      }
      sendResponse({ success: true });
      return false;
    }

    // ── Open Onboarding in-page overlay on active tab ──
    if (message.action === 'OPEN_ONBOARDING' || message.action === 'OPEN_ONBOARDING_OVERLAY') {
      const targetTabId = sender.tab?.id;
      if (targetTabId) {
        chrome.tabs.sendMessage(targetTabId, { action: 'OPEN_ONBOARDING_OVERLAY' });
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
          if (activeTab?.id) {
            chrome.tabs.sendMessage(activeTab.id, { action: 'OPEN_ONBOARDING_OVERLAY' });
          }
        });
      }
      sendResponse({ success: true });
      return false;
    }

    return false;
  });
});
