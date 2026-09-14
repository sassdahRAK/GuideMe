import { defineBackground } from 'wxt/sandbox';
import { ExtensionMessageAction } from '@guideme/engine';
import { triggerQueueSync } from '../src/lib/progress-sync.ts';

// Session storage key for active tutorial state
const STORAGE_KEY_ACTIVE_SESSION = 'guideme_active_tutorial_session';
const STORAGE_KEY_MULTI_PAGE_PLAN = 'guideme_multi_page_plan';

/**
 * Get the storage area for active session (session storage with local fallback)
 */
function getSessionStorage(): chrome.storage.StorageArea | undefined {
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    return chrome.storage.session;
  }
  return chrome.storage?.local;
}

export default defineBackground(() => {
  console.log('[GuideMe Background] Service Worker initialized');

  // Allow session storage access across contexts if supported
  try {
    if ((chrome.storage?.session as any)?.setAccessLevel) {
      (chrome.storage.session as any).setAccessLevel({
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
  let activePipWindowId: number | null = null;

  // ── Tab Navigation & Tab Activation Handlers for Seamless Session Sync ──
  chrome.tabs.onUpdated?.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab?.url) {
      const storage = getSessionStorage();
      if (!storage) return;

      // First check for multi-page plan (Stage 1 planned navigation)
      storage.get([STORAGE_KEY_MULTI_PAGE_PLAN], (planResult: Record<string, any>) => {
        const plan = planResult?.[STORAGE_KEY_MULTI_PAGE_PLAN];
        if (plan && plan.pages && Array.isArray(plan.pages)) {
          const currentIdx = plan.currentPageIndex || 0;
          const nextIdx = currentIdx + 1;
          const nextPage = plan.pages[nextIdx];
          if (nextPage && nextPage.route !== 'current') {
            try {
              const tabUrl = new URL(tab.url!);
              const plannedPath = nextPage.route;
              // Check if the user navigated to the planned route
              if (tabUrl.pathname === plannedPath || tabUrl.pathname.startsWith(plannedPath)) {
                plan.currentPageIndex = nextIdx;
                storage.set({ [STORAGE_KEY_MULTI_PAGE_PLAN]: plan });

                // Notify content script to generate steps for this new page
                chrome.tabs.sendMessage(tabId, {
                  action: 'GUIDEME_MULTI_PAGE_NEXT',
                  payload: { prompt: plan.prompt, page: nextPage },
                }, () => {
                  if (chrome.runtime.lastError) { /* ignore */ }
                });
                return;
              }
            } catch { /* ignore invalid URLs */ }
          }
        }
      });

      // Then check for active tutorial session
      storage.get([STORAGE_KEY_ACTIVE_SESSION], (result: Record<string, any>) => {
        const session = result?.[STORAGE_KEY_ACTIVE_SESSION];
        if (!session || !session.tutorial) return;

        // Check if the tutorial matches this tab's URL or domain
        try {
          const tabUrl = new URL(tab.url!);
          const targetUrl = session.targetUrl ? new URL(session.targetUrl) : null;

          const isSameDomain = targetUrl && tabUrl.hostname === targetUrl.hostname;
          const isSameTab = session.tabId === tabId;

          if (isSameDomain || isSameTab) {
            session.tabId = tabId;
            storage.set({ [STORAGE_KEY_ACTIVE_SESSION]: session });

            chrome.tabs.sendMessage(tabId, {
              action: 'GUIDEME_SYNC_SESSION',
              payload: session,
            }, () => {
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
    const storage = getSessionStorage();
    if (!storage) return;

    storage.get([STORAGE_KEY_ACTIVE_SESSION], (result: Record<string, any>) => {
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
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'GUIDEME_LAUNCHER_DOCKED' }, () => {});
        }
      });
    }
  });

  // Handle messages forwarded between popup, content scripts, and PiP
  chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    // ── Session State Persistence: Save / Update active session ──
    if (message.action === 'GUIDEME_UPDATE_SESSION') {
      const { tutorial, currentStepIndex, url, active } = message.payload || {};
      const storage = getSessionStorage();

      if (!storage) {
        sendResponse({ success: false, error: 'Storage unavailable' });
        return false;
      }

      if (!active || !tutorial) {
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

    // ── Multi-Page Plan: Store from popup ──
    if (message.action === 'GUIDEME_MULTI_PAGE_PLAN') {
      const plan = message.payload;
      if (plan && plan.pages) {
        const storage = getSessionStorage();
        if (storage) {
          storage.set({ [STORAGE_KEY_MULTI_PAGE_PLAN]: plan }, () => {
            sendResponse({ success: true });
          });
          return true;
        }
      }
      sendResponse({ success: false });
      return false;
    }

    // ── Multi-Page Plan: Advance to next page ──
    if (message.action === 'GUIDEME_MULTI_PAGE_NEXT' || message.action === 'GUIDEME_MULTI_PAGE_COMPLETE') {
      const storage = getSessionStorage();
      if (!storage) {
        sendResponse({ success: false });
        return false;
      }

      storage.get([STORAGE_KEY_MULTI_PAGE_PLAN], (result: Record<string, any>) => {
        const plan = result?.[STORAGE_KEY_MULTI_PAGE_PLAN];
        if (!plan || !plan.pages) {
          sendResponse({ success: false, error: 'No multi-page plan' });
          return;
        }

        const currentIdx = plan.currentPageIndex || 0;
        const nextIdx = currentIdx + 1;

        if (message.action === 'GUIDEME_MULTI_PAGE_COMPLETE' || nextIdx >= plan.pages.length) {
          storage.remove(STORAGE_KEY_MULTI_PAGE_PLAN);
          sendResponse({ success: true, completed: true });
          return;
        }

        const nextPage = plan.pages[nextIdx];
        if (nextPage.route === 'current') {
          plan.currentPageIndex = nextIdx;
          storage.set({ [STORAGE_KEY_MULTI_PAGE_PLAN]: plan }, () => {
            if (sender.tab?.id) {
              chrome.tabs.sendMessage(sender.tab.id, {
                action: 'GUIDEME_MULTI_PAGE_NEXT',
                payload: { prompt: plan.prompt, page: nextPage },
              });
            }
            sendResponse({ success: true, page: nextPage });
          });
          return true;
        } else {
          plan.currentPageIndex = nextIdx;
          storage.set({ [STORAGE_KEY_MULTI_PAGE_PLAN]: plan }, () => {
            if (sender.tab?.id) {
              chrome.tabs.update(sender.tab.id, { url: nextPage.route });
            }
            sendResponse({ success: true, navigating: true, url: nextPage.route });
          });
          return true;
        }
      });
      return true;
    }

    // ── Tutorial step badge updates ──
    if (
      message.action === ExtensionMessageAction.TUTORIAL_STATE_UPDATED ||
      message.action === 'TUTORIAL_STEP_ADVANCED' ||
      message.action === ExtensionMessageAction.TUTORIAL_STEP_ADVANCED
    ) {
      const { active, currentStepIndex, totalSteps } = message.payload || {};

      if ((active || currentStepIndex !== undefined) && sender.tab?.id) {
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

    if (
      message.action === 'TUTORIAL_COMPLETED' ||
      message.action === ExtensionMessageAction.TUTORIAL_COMPLETED
    ) {
      if (sender.tab?.id) {
        chrome.action.setBadgeText({
          tabId: sender.tab.id,
          text: '✓',
        });
        chrome.action.setBadgeBackgroundColor({
          tabId: sender.tab.id,
          color: '#10b981', // Emerald green
        });
        setTimeout(() => {
          try {
            if (sender.tab?.id) {
              chrome.action.setBadgeText({ tabId: sender.tab.id, text: '' });
            }
          } catch {}
        }, 3000);
      }
    }

    // ── Extract Separate UI / Popout PiP Launcher Window ──
    if (message.action === 'GUIDEME_POPOUT_LAUNCHER') {
      try {
        const pipUrl = chrome.runtime.getURL('pip.html');

        const storeAndLaunch = (tabId?: number, windowId?: number, tabUrl?: string): void => {
          const openPip = (): void => {
            if (activePipWindowId) {
              chrome.windows.get(activePipWindowId, (existing) => {
                if (existing && !chrome.runtime.lastError) {
                  chrome.windows.update(activePipWindowId!, { focused: true });
                  sendResponse({ success: true, windowId: activePipWindowId });
                } else {
                  createPipWindow(pipUrl, sendResponse);
                }
              });
            } else {
              createPipWindow(pipUrl, sendResponse);
            }
          };

          if (tabId) {
            chrome.storage?.local?.set(
              { guideme_target_tab_id: tabId, guideme_target_window_id: windowId, guideme_target_tab_url: tabUrl || '' },
              () => openPip()
            );
          } else {
            openPip();
          }
        };

        if (sender.tab?.id) {
          storeAndLaunch(sender.tab.id, sender.tab.windowId, sender.tab.url || '');
        } else {
          chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
            const webTab = (tabs || []).find(
              (t) => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://')
            );
            storeAndLaunch(webTab?.id, webTab?.windowId, webTab?.url || '');
          });
        }
      } catch (err: any) {
        console.error('[GuideMe Background] GUIDEME_POPOUT_LAUNCHER error:', err);
        sendResponse({ success: false, error: err?.message || String(err) });
      }
      return true; // async response
    }

    function createPipWindow(pipUrl: string, responseCallback: (res: any) => void): void {
      const DEFAULT_SCREEN = { left: 0, top: 0, width: 1920, height: 1080 };
      const SCREEN_EDGE_MARGIN = 24;

      const clampIntoView = (
        screen: { left: number; top: number; width: number; height: number },
        left: number,
        top: number,
        width: number,
        height: number
      ) => {
        const minLeft = screen.left;
        const minTop = screen.top;
        const maxLeft = screen.left + screen.width - width;
        const maxTop = screen.top + screen.height - height;
        return {
          left: Math.max(minLeft, Math.min(left, maxLeft)),
          top: Math.max(minTop, Math.min(top, maxTop)),
        };
      };

      const openPip = (screen: { left: number; top: number; width: number; height: number }) => {
        chrome.storage?.local?.get(['guideme_chat_messages', 'guideme_active_guide_state'], (res: Record<string, any>) => {
          const hasMessages = Array.isArray(res?.guideme_chat_messages) && res.guideme_chat_messages.length > 0;
          const hasActiveGuide = Boolean(res?.guideme_active_guide_state?.active);
          const pipWidth = 550;
          const initialHeight = (hasMessages || hasActiveGuide) ? 360 : 160;

          let rawLeft = screen.left + screen.width - pipWidth - SCREEN_EDGE_MARGIN;
          let rawTop = screen.top + screen.height - 160;
          if (hasMessages || hasActiveGuide) rawTop = Math.max(screen.top + 10, rawTop - 200);

          const { left, top } = clampIntoView(screen, rawLeft, rawTop, pipWidth, initialHeight);

          chrome.windows.create({
            url: pipUrl,
            type: 'popup',
            width: pipWidth,
            height: initialHeight,
            left,
            top,
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
        });
      };

      chrome.storage?.local?.get(['guideme_target_window_id'], (stored: Record<string, any>) => {
        const resolveFromWindow = (win?: chrome.windows.Window) => {
          if (win && win.width) {
            openPip({ left: win.left || 0, top: win.top || 0, width: win.width, height: win.height || 1080 });
          } else {
            openPip(DEFAULT_SCREEN);
          }
        };

        const targetWindowId = typeof stored?.guideme_target_window_id === 'number' ? stored.guideme_target_window_id : null;
        if (targetWindowId !== null && typeof chrome.windows?.get === 'function') {
          chrome.windows.get(targetWindowId, (win) => {
            if (chrome.runtime.lastError || !win) {
              chrome.windows.getLastFocused({}, resolveFromWindow);
            } else {
              resolveFromWindow(win);
            }
          });
        } else if (!targetWindowId && typeof chrome.windows?.getLastFocused === 'function') {
          chrome.windows.getLastFocused({}, resolveFromWindow);
        } else {
          openPip(DEFAULT_SCREEN);
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
  chrome.runtime.onMessageExternal?.addListener((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    console.log('[GuideMe Background] Received external message:', message?.type, 'from:', sender?.url);

    if (message?.type === 'GUIDEME_PING') {
      sendResponse({ status: 'PONG', version: chrome.runtime.getManifest()?.version });
      return false;
    }

    if (message?.action === 'GUIDEME_GET_AUTH_TOKEN') {
      chrome.storage.local.get(['authToken'], (result) => {
        sendResponse({ token: result?.authToken || null });
      });
      return true; // keep channel open for async sendResponse
    }

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
