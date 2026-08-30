import { defineBackground } from 'wxt/sandbox';
import { ExtensionMessageAction } from '@guideme/core-types';

export default defineBackground(() => {
  console.log('[GuideMe Background] Service Worker initialized');

  // ── Keep PiP window always on top ──
  // When any window gains focus, bring the PiP window back to front.
  // This simulates "always on top" behavior for the PiP window.
  chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;

    chrome.storage.local.get(['guideme_pip_window_id'], (result) => {
      const pipWindowId = result?.guideme_pip_window_id;
      if (!pipWindowId || pipWindowId === windowId) return;

      // Check if the PiP window still exists, then bring it to front
      chrome.windows.get(pipWindowId, { populate: false }, (win) => {
        if (chrome.runtime.lastError || !win) {
          // PiP window was closed — clean up
          chrome.storage.local.remove('guideme_pip_window_id');
          return;
        }
        // Bring PiP to front without stealing focus from the current window
        chrome.windows.update(pipWindowId, {
          drawAttention: false,
          focused: false,
        });
      });
    });
  });

  // Clean up PiP window ID when it's closed
  chrome.windows.onRemoved.addListener((windowId) => {
    chrome.storage.local.get(['guideme_pip_window_id'], (result) => {
      if (result?.guideme_pip_window_id === windowId) {
        chrome.storage.local.remove('guideme_pip_window_id');
      }
    });
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

    // ── Extract Separate UI — Create standalone PiP window that stays on top ──
    // Uses chrome.windows.create() instead of documentPictureInPicture to avoid
    // the popup-closes-immediately bug caused by focus/blur race conditions.
    // The window is positioned at bottom-right and kept always on top via
    // chrome.windows.update() with drawAttention: false to prevent stealing focus.
    if (message.action === 'GUIDEME_POPOUT_LAUNCHER') {
      try {
        const pipUrl = chrome.runtime.getURL('pip.html');

        // Calculate position: bottom-right corner of the screen
        let pipLeft = 100;
        let pipTop = 100;
        try {
          // Use screen coordinates for positioning
          const screens = window.screen || {};
          pipLeft = (screens.availWidth || 1920) - 500;
          pipTop = (screens.availHeight || 1080) - 160;
        } catch { /* fallback to defaults */ }

        chrome.windows.create({
          url: pipUrl,
          type: 'popup',
          width: 480,
          height: 120,
          left: pipLeft,
          top: pipTop,
          focused: true,
        }, (newWindow) => {
          if (chrome.runtime.lastError) {
            console.error('[GuideMe Background] PiP window creation failed:', chrome.runtime.lastError.message);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else if (newWindow?.id) {
            // Store the PiP window ID for later reference
            chrome.storage.local.set({ guideme_pip_window_id: newWindow.id });

            // Keep the window on top by periodically ensuring it stays visible
            // Chrome doesn't have alwaysOnTop for extension windows, but we can
            // use drawAttention: false to prevent it from losing focus behavior
            try {
              chrome.windows.update(newWindow.id, {
                drawAttention: false,
                focused: false, // Don't steal focus — let user work in their tab
              });
            } catch { /* ignore */ }

            console.log('[GuideMe Background] PiP window created:', newWindow?.id);
            sendResponse({ success: true, windowId: newWindow.id });
          } else {
            sendResponse({ success: false, error: 'Window created but no ID returned' });
          }
        });
      } catch (err) {
        console.error('[GuideMe Background] GUIDEME_POPOUT_LAUNCHER error:', err);
        sendResponse({ success: false, error: err?.message || String(err) });
      }
      return true; // async response
    }

    // ── PiP window docked (closed by user) — forward to content script ──
    if (message.action === 'GUIDEME_LAUNCHER_DOCKED') {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'GUIDEME_LAUNCHER_DOCKED' }, () => {
            // Content script may not be listening — ignore errors
          });
        }
      });
      sendResponse({ success: true });
      return false;
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

    // ── Dashboard requests to start a tutorial on a specific tab ──
    if (message.action === 'DASHBOARD_START_TUTORIAL') {
      const { tutorialId, targetTabId } = message.payload || {};
      if (targetTabId && tutorialId) {
        // Ensure content script is injected, then send START_TUTORIAL
        chrome.scripting?.executeScript({
          target: { tabId: targetTabId },
          files: ['content-scripts/content.js'],
        }).then(() => {
          // Small delay to let content script initialize
          setTimeout(() => {
            chrome.tabs.sendMessage(targetTabId, {
              action: ExtensionMessageAction.START_TUTORIAL,
              payload: { tutorialId },
            }, () => {
              if (chrome.runtime.lastError) {
                console.warn('[GuideMe Background] Could not reach content script:', chrome.runtime.lastError.message);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
              } else {
                sendResponse({ success: true });
              }
            });
          }, 200);
        }).catch(() => {
          // Content script may already be injected — try sending directly
          chrome.tabs.sendMessage(targetTabId, {
            action: ExtensionMessageAction.START_TUTORIAL,
            payload: { tutorialId },
          }, () => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              sendResponse({ success: true });
            }
          });
        });
      } else {
        sendResponse({ success: false, error: 'Missing tutorialId or targetTabId' });
      }
      return true; // async response
    }

    // ── Open Dashboard as standalone window (outside Chrome) ──
    if (message.action === 'OPEN_DASHBOARD_STANDALONE') {
      try {
        const dashUrl = chrome.runtime.getURL('dashboard.html');
        chrome.windows.create({
          url: dashUrl,
          type: 'popup',
          width: 1120,
          height: 780,
          focused: true,
        }, (newWindow) => {
          if (chrome.runtime.lastError) {
            console.error('[GuideMe Background] Dashboard window creation failed:', chrome.runtime.lastError.message);
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            console.log('[GuideMe Background] Dashboard window created:', newWindow?.id);
            sendResponse({ success: true, windowId: newWindow?.id });
          }
        });
      } catch (err) {
        console.error('[GuideMe Background] OPEN_DASHBOARD_STANDALONE error:', err);
        sendResponse({ success: false, error: err?.message || String(err) });
      }
      return true; // async response
    }

    // ── Open Dashboard in-page overlay on active tab (legacy) ──
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
