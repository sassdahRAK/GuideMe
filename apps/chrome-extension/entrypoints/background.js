import { defineBackground } from 'wxt/sandbox';
import { ExtensionMessageAction } from '@guideme/core-types';
import { triggerQueueSync } from '../src/lib/progress-sync';

export default defineBackground(() => {
  console.log('[GuideMe Background] Service Worker initialized');

  // Sync any offline progress queued during previous sessions
  triggerQueueSync();

  // Try syncing pending actions when browser opens
  chrome.runtime.onStartup?.addListener(() => {
    triggerQueueSync();
  });

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

  // ── Handle external messages from Next.js web application ──
  chrome.runtime.onMessageExternal?.addListener((message, sender, sendResponse) => {
    console.log('[GuideMe Background] Received external message:', message?.type, 'from:', sender?.url);

    // Health check / ping from web app
    if (message?.type === 'GUIDEME_PING') {
      sendResponse({ status: 'PONG', version: chrome.runtime.getManifest()?.version });
      return false;
    }

    // Auth success handoff from Next.js login/registration
    if (message?.type === 'GUIDEME_AUTH_SUCCESS') {
      const { token, user } = message.payload || {};

      // 1. Persist auth credentials in chrome.storage.local for popup and content scripts
      chrome.storage.local.set(
        {
          authToken: token || null,
          userProfile: user || null,
        },
        () => {
          sendResponse({ status: 'SUCCESS' });

          // 2. Flush pending progress queue now that we are authenticated
          triggerQueueSync();

          // 3. Automatically close the login tab once linked
          if (sender.tab?.id) {
            chrome.tabs.remove(sender.tab.id).catch(() => {});
          }
        }
      );

      return true; // Keep message channel open for asynchronous sendResponse
    }

    return false;
  });
});
