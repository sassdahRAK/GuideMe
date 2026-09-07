import { defineBackground } from 'wxt/sandbox';
import { ExtensionMessageAction } from '@guideme/core-types';
import { triggerQueueSync } from '../src/lib/progress-sync';

// Session storage key for active tutorial state
const STORAGE_KEY_ACTIVE_SESSION = 'guideme_active_tutorial_session';

/**
 * Get the storage area for active session (session storage with local fallback)
 */
function getSessionStorage() {
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    return chrome.storage.session;
  }
  return chrome.storage?.local;
}

export default defineBackground(() => {
  console.log('[GuideMe Background] Service Worker initialized');

  // Allow session storage access across contexts if supported
  try {
    if (chrome.storage?.session?.setAccessLevel) {
      chrome.storage.session.setAccessLevel({
        accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
      }).catch(() => {});
    }
  } catch {
    // Ignore if not supported
  }

  // Sync any offline progress queued during previous sessions
  triggerQueueSync();

  // Try syncing pending actions when browser opens
  chrome.runtime.onStartup?.addListener(() => {
    triggerQueueSync();
  });

  // Track active PiP window ID
  let activePipWindowId = null;

  // ── Tab Navigation & Tab Activation Handlers for Seamless Session Sync ──
  chrome.tabs.onUpdated?.addListener((tabId, changeInfo, tab) => {
    // When a tab finishes reloading or navigating to a new URL
    if (changeInfo.status === 'complete' && tab?.url) {
      const storage = getSessionStorage();
      if (!storage) return;

      storage.get([STORAGE_KEY_ACTIVE_SESSION], (result) => {
        const session = result?.[STORAGE_KEY_ACTIVE_SESSION];
        if (!session || !session.tutorial) return;

        // Check if the tutorial matches this tab's URL or domain
        try {
          const tabUrl = new URL(tab.url);
          const targetUrl = session.targetUrl ? new URL(session.targetUrl) : null;

          const isSameDomain = targetUrl && tabUrl.hostname === targetUrl.hostname;
          const isSameTab = session.tabId === tabId;

          if (isSameDomain || isSameTab) {
            // Update the tabId in session to the current tab
            session.tabId = tabId;
            storage.set({ [STORAGE_KEY_ACTIVE_SESSION]: session });

            // Notify content script in the refreshed tab to auto-resume
            chrome.tabs.sendMessage(tabId, {
              action: 'GUIDEME_SYNC_SESSION',
              payload: session,
            }, () => {
              // Ignore if content script isn't ready yet (it queries on mount anyway)
              if (chrome.runtime.lastError) { /* ignore */ }
            });
          }
        } catch {
          // Ignore invalid URLs
        }
      });
    }
  });

  chrome.tabs.onActivated?.addListener(({ tabId }) => {
    // When user switches to another tab, check if a global session should sync
    const storage = getSessionStorage();
    if (!storage) return;

    storage.get([STORAGE_KEY_ACTIVE_SESSION], (result) => {
      const session = result?.[STORAGE_KEY_ACTIVE_SESSION];
      if (session?.tutorial) {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError || !tab?.url) return;
          try {
            const currentHost = new URL(tab.url).hostname;
            const targetHost = session.targetUrl ? new URL(session.targetUrl).hostname : null;
            if (targetHost && currentHost === targetHost) {
              session.tabId = tabId;
              storage.set({ [STORAGE_KEY_ACTIVE_SESSION]: session });
              chrome.tabs.sendMessage(tabId, {
                action: 'GUIDEME_SYNC_SESSION',
                payload: session,
              }, () => {
                if (chrome.runtime.lastError) { /* ignore */ }
              });
            }
          } catch { /* ignore */ }
        });
      }
    });
  });

  // Track window closures to clean up PiP reference
  chrome.windows.onRemoved?.addListener((windowId) => {
    if (windowId === activePipWindowId) {
      activePipWindowId = null;
      chrome.storage?.local?.remove('guideme_pip_window_id');
      // Notify active tab that PiP window was closed/docked
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'GUIDEME_LAUNCHER_DOCKED' }, () => {});
        }
      });
    }
  });

  // Handle messages forwarded between popup, content scripts, and PiP
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // ── Session State Persistence: Save / Update active session ──
    if (message.action === 'GUIDEME_UPDATE_SESSION') {
      const { tutorial, currentStepIndex, url, active } = message.payload || {};
      const storage = getSessionStorage();

      if (!storage) {
        sendResponse({ success: false, error: 'Storage unavailable' });
        return false;
      }

      if (!active || !tutorial) {
        // Clear active session
        storage.remove(STORAGE_KEY_ACTIVE_SESSION, () => {
          sendResponse({ success: true, cleared: true });
        });
      } else {
        const sessionPayload = {
          tutorial,
          currentStepIndex: currentStepIndex || 0,
          targetUrl: url || sender.tab?.url || '',
          tabId: sender.tab?.id || null,
          updatedAt: Date.now(),
        };

        storage.set({ [STORAGE_KEY_ACTIVE_SESSION]: sessionPayload }, () => {
          sendResponse({ success: true, session: sessionPayload });
        });
      }
      return true; // async
    }

    // ── Session State Persistence: Retrieve active session on content script mount ──
    if (message.action === 'GUIDEME_GET_SESSION') {
      const storage = getSessionStorage();
      if (!storage) {
        sendResponse({ success: false, session: null });
        return false;
      }

      storage.get([STORAGE_KEY_ACTIVE_SESSION], (result) => {
        const session = result?.[STORAGE_KEY_ACTIVE_SESSION] || null;
        sendResponse({ success: true, session });
      });
      return true; // async
    }

    // ── Session State Persistence: Clear active session ──
    if (message.action === 'GUIDEME_CLEAR_SESSION') {
      const storage = getSessionStorage();
      if (storage) {
        storage.remove(STORAGE_KEY_ACTIVE_SESSION, () => {
          sendResponse({ success: true });
        });
        return true;
      }
      sendResponse({ success: true });
      return false;
    }

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

    // ── Extract Separate UI / Popout PiP Launcher Window ──
    if (message.action === 'GUIDEME_POPOUT_LAUNCHER') {
      try {
        const pipUrl = chrome.runtime.getURL('pip.html');

        // Track caller tab & window so PiP messages route directly to the active webpage
        if (sender.tab?.id) {
          chrome.storage?.local?.set({
            guideme_target_tab_id: sender.tab.id,
            guideme_target_window_id: sender.tab.windowId,
          });
        } else {
          chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([activeTab]) => {
            if (activeTab?.id) {
              chrome.storage?.local?.set({
                guideme_target_tab_id: activeTab.id,
                guideme_target_window_id: activeTab.windowId,
              });
            }
          });
        }

        // If window already exists, focus it
        if (activePipWindowId) {
          chrome.windows.get(activePipWindowId, (existing) => {
            if (existing && !chrome.runtime.lastError) {
              chrome.windows.update(activePipWindowId, { focused: true });
              sendResponse({ success: true, windowId: activePipWindowId });
            } else {
              createPipWindow(pipUrl, sendResponse);
            }
          });
        } else {
          createPipWindow(pipUrl, sendResponse);
        }
      } catch (err) {
        console.error('[GuideMe Background] GUIDEME_POPOUT_LAUNCHER error:', err);
        sendResponse({ success: false, error: err?.message || String(err) });
      }
      return true; // async response
    }

    function createPipWindow(pipUrl, responseCallback) {
      let pipLeft = 100;
      let pipTop = 100;
      try {
        const screenObj = (typeof window !== 'undefined' ? window.screen : null) || {};
        pipLeft = (screenObj.availWidth || 1920) - 540;
        pipTop = (screenObj.availHeight || 1080) - 160;
      } catch { /* fallback */ }

      chrome.windows.create({
        url: pipUrl,
        type: 'popup',
        width: 550,
        height: 120,
        left: Math.max(10, pipLeft),
        top: Math.max(10, pipTop),
        focused: true,
      }, (newWindow) => {
        if (chrome.runtime.lastError || !newWindow?.id) {
          console.error('[GuideMe Background] PiP creation failed:', chrome.runtime.lastError?.message);
          responseCallback({ success: false, error: chrome.runtime.lastError?.message });
        } else {
          activePipWindowId = newWindow.id;
          chrome.storage.local.set({ guideme_pip_window_id: newWindow.id });
          console.log('[GuideMe Background] PiP window created:', newWindow.id);
          responseCallback({ success: true, windowId: newWindow.id });
        }
      });
    }

    // ── PiP window docked (closed by user) — forward to content script ──
    if (message.action === 'GUIDEME_LAUNCHER_DOCKED') {
      activePipWindowId = null;
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'GUIDEME_LAUNCHER_DOCKED' }, () => {});
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

      chrome.storage.local.set(
        {
          authToken: token || null,
          userProfile: user || null,
        },
        () => {
          sendResponse({ status: 'SUCCESS' });
          triggerQueueSync();
          if (sender.tab?.id) {
            chrome.tabs.remove(sender.tab.id).catch(() => {});
          }
        }
      );

      return true;
    }

    return false;
  });
});
