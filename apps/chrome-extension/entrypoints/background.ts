import { defineBackground } from 'wxt/sandbox';
import { ExtensionMessageAction } from '@guideme/engine';
import { triggerQueueSync } from '../src/lib/progress-sync.ts';

// Session storage key for active tutorial state
const STORAGE_KEY_ACTIVE_SESSION = 'guideme_active_tutorial_session';
const STORAGE_KEY_MULTI_PAGE_PLAN = 'guideme_multi_page_plan';

// Chat widget storage keys — cleared on browser startup so each fresh
// browser launch begins a new chat session instead of restoring old tabs.
const CHAT_STORAGE_KEYS = [
  'guideme_chat_tabs',
  'guideme_active_chat_tab_id',
  'guideme_chat_messages',
];

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

    // Fresh browser launch — clear persisted chat tabs so the widget
    // re-initializes with a single new default chat session.
    chrome.storage.local.remove(CHAT_STORAGE_KEYS, () => {
      if (chrome.runtime.lastError) { /* ignore */ }
    });
  });

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

  // Handle messages forwarded between popup and content scripts
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

      const stepNum   = typeof currentStepIndex === 'number' ? currentStepIndex + 1 : null;
      const stepTotal = typeof totalSteps       === 'number' && totalSteps > 0 ? totalSteps : null;

      if ((active || currentStepIndex !== undefined) && sender.tab?.id && stepNum !== null && stepTotal !== null) {
        chrome.action.setBadgeText({
          tabId: sender.tab.id,
          text: `${stepNum}/${stepTotal}`,
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

    // ── Proxy Fetch — routes content-script API calls through the service worker
    //    so that requests to loopback (localhost) are not blocked by Chrome's
    //    Private Network Access policy, which forbids public-origin pages from
    //    directly fetching loopback addresses. ──
    if (message.action === 'GUIDEME_PROXY_FETCH') {
      const { url, method = 'GET', headers = {}, body } = message.payload || {};
      if (!url) {
        sendResponse({ ok: false, status: 0, error: 'Missing URL' });
        return false;
      }
      (async () => {
        try {
          // GM-011: this proxy runs in the privileged extension origin
          // specifically to bypass Chrome's Private Network Access policy
          // for loopback calls — restrict it to the user's actually
          // configured backend origin (defaulting to the build-time one)
          // rather than letting it fetch an arbitrary URL, as defense-in-
          // depth against a future bug (or a compromised call site) passing
          // page-influenced data into this handler.
          let targetOrigin: string;
          try {
            targetOrigin = new URL(url).origin;
          } catch {
            sendResponse({ ok: false, status: 0, error: 'Invalid URL' });
            return;
          }

          const stored = await new Promise<Record<string, any>>((resolve) => {
            chrome.storage?.local?.get(['guideme_backend_url'], (res) => resolve(res || {}));
          });
          const configuredBackend = stored?.guideme_backend_url || (import.meta as any).env?.WXT_API_URL || '';
          let allowedOrigin = '';
          try {
            allowedOrigin = configuredBackend ? new URL(configuredBackend).origin : '';
          } catch { /* ignore malformed stored value */ }

          if (!allowedOrigin || targetOrigin !== allowedOrigin) {
            console.warn('[GuideMe Background] Rejected GUIDEME_PROXY_FETCH to untrusted origin:', targetOrigin);
            sendResponse({ ok: false, status: 0, error: 'Proxy target not allowed' });
            return;
          }

          const res = await fetch(url, {
            method,
            headers,
            ...(body !== undefined ? { body } : {}),
          });
          const text = await res.text();
          sendResponse({ ok: res.ok, status: res.status, body: text });
        } catch (err: any) {
          sendResponse({ ok: false, status: 0, error: err?.message || String(err) });
        }
      })();
      return true; // async response
    }

    return false;
  });

  // ── Handle external messages from Next.js web application ──
  // Chrome already restricts *who can reach this listener at all* to the
  // origins listed in manifest.externally_connectable.matches, but we also
  // re-check sender.origin here as defense-in-depth (GM-005) in case that
  // list is ever widened, and do basic shape validation on message payloads
  // rather than trusting them blindly (GM-007) — this is not a full replay-
  // proof handshake (that needs a nonce round-tripped through the web app's
  // login flow, tracked separately), but it stops obviously malformed or
  // wrong-origin messages from writing into extension storage.
  const TRUSTED_EXTERNAL_ORIGINS = (chrome.runtime.getManifest()?.externally_connectable?.matches || [])
    .map((pattern: string) => {
      try {
        return new URL(pattern.replace(/\/\*$/, '/')).origin;
      } catch {
        return null;
      }
    })
    .filter((origin: string | null): origin is string => !!origin);

  chrome.runtime.onMessageExternal?.addListener((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    console.log('[GuideMe Background] Received external message:', message?.type, 'from:', sender?.url);

    const senderOrigin = sender?.origin || (sender?.url ? (() => { try { return new URL(sender.url!).origin; } catch { return null; } })() : null);
    if (!senderOrigin || !TRUSTED_EXTERNAL_ORIGINS.includes(senderOrigin)) {
      console.warn('[GuideMe Background] Rejected external message from untrusted origin:', senderOrigin);
      return false;
    }

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

      if (typeof token !== 'string' || !token.trim() || typeof user !== 'object' || user === null) {
        sendResponse({ status: 'ERROR', message: 'Invalid auth payload' });
        return false;
      }

      chrome.storage.local.set(
        {
          authToken: token,
          userProfile: user,
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
