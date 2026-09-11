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

  // Session storage sync ready

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

  chrome.tabs.onActivated?.addListener(({ tabId, windowId }) => {
    // 1. Keep track of active webpage tab for PiP companion routing
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime?.lastError || !tab?.url) return;
      if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        chrome.storage?.local?.set({
          guideme_target_tab_id: tabId,
          guideme_target_window_id: windowId,
        });
      }
    });

    // 2. When user switches to another tab, check if a global session should sync
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

  // Keep target tab updated when user focuses a normal browser window
  chrome.windows.onFocusChanged?.addListener((windowId) => {
    if (windowId !== chrome.windows.WINDOW_ID_NONE) {
      chrome.tabs.query({ active: true, windowId }, ([tab]) => {
        if (tab?.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          chrome.storage?.local?.set({
            guideme_target_tab_id: tab.id,
            guideme_target_window_id: windowId,
          });
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
            chrome.action.setBadgeText({ tabId: sender.tab.id, text: '' });
          } catch {}
        }, 3000);
      }
    }

    // ── Open In-Page Chat Box Overlay on Active Webpage ──
    if (message.action === 'GUIDEME_POPOUT_LAUNCHER' || message.action === 'GUIDEME_OPEN_CHAT_OVERLAY') {
      const openOnTab = (tabId) => {
        if (!tabId) {
          sendResponse({ success: false, error: 'No active web tab' });
          return;
        }
        chrome.storage?.local?.set({ guideme_is_chat_open: true });
        chrome.tabs.sendMessage(tabId, { action: 'GUIDEME_TOGGLE_CHAT_OVERLAY', payload: { open: true } }, (res) => {
          if (chrome.runtime?.lastError || !res?.success) {
            // Auto inject content script if tab doesn't have it yet
            if (chrome.scripting?.executeScript) {
              Promise.all([
                chrome.scripting.executeScript({
                  target: { tabId },
                  files: ['content-scripts/content.js'],
                }),
                chrome.scripting.insertCSS
                  ? chrome.scripting.insertCSS({
                      target: { tabId },
                      files: ['content-scripts/content.css'],
                    }).catch(() => {})
                  : Promise.resolve(),
              ]).then(() => {
                setTimeout(() => {
                  chrome.tabs.sendMessage(tabId, { action: 'GUIDEME_TOGGLE_CHAT_OVERLAY', payload: { open: true } }, (retryRes) => {
                    sendResponse(retryRes || { success: true });
                  });
                }, 300);
              }).catch((err) => {
                sendResponse({ success: false, error: err?.message });
              });
              return;
            }
          }
          sendResponse(res || { success: true });
        });
      };

      const explicitTabId = message.payload?.tabId;
      if (explicitTabId) {
        openOnTab(explicitTabId);
      } else if (sender.tab?.id) {
        openOnTab(sender.tab.id);
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
          if (tab?.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
            openOnTab(tab.id);
          } else {
            findNormalWebTab((tabId) => openOnTab(tabId));
          }
        });
      }
      return true; // async response
    }

    // ── Focus Target Tab (used when returning to previous tab from cross-tab notice) ──
    if (message.action === 'GUIDEME_FOCUS_TAB') {
      const targetTabId = message.payload?.tabId;
      if (targetTabId) {
        chrome.tabs.get(targetTabId, (tab) => {
          if (!chrome.runtime.lastError && tab?.id) {
            chrome.tabs.update(tab.id, { active: true });
            if (tab.windowId) {
              chrome.windows.update(tab.windowId, { focused: true });
            }
          }
        });
      }
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

    // ── Proxy Audio Fetch to bypass host-page CSP (e.g. Google Docs media-src) ──
    if (message.action === 'GUIDEME_PROXY_FETCH_AUDIO_BASE64') {
      const audioUrl = message.payload?.url;
      if (!audioUrl) {
        sendResponse({ success: false, error: 'No URL provided' });
        return false;
      }
      fetch(audioUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const contentType = res.headers.get('content-type') || 'audio/mpeg';
          return res.arrayBuffer().then((buf) => ({ buf, contentType }));
        })
        .then(({ buf, contentType }) => {
          let binary = '';
          const bytes = new Uint8Array(buf);
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          sendResponse({ success: true, base64, contentType });
        })
        .catch((err) => {
          sendResponse({ success: false, error: err?.message || String(err) });
        });
      return true; // async
    }

    // ── Proxy JSON Fetch to bypass host-page CSP (e.g. Google Docs connect-src) ──
    if (message.action === 'GUIDEME_PROXY_FETCH_JSON') {
      const { url, method = 'POST', headers = {}, body } = message.payload || {};
      if (!url) {
        sendResponse({ success: false, error: 'No URL provided' });
        return false;
      }

      (async () => {
        try {
          const reqHeaders = { 'Content-Type': 'application/json', ...headers };

          // Automatically inject stored AI key if missing on AI endpoints
          const isAiEndpoint = typeof url === 'string' && (url.includes('openrouter.ai') || url.includes('api.openai.com'));
          const authHeader = reqHeaders.Authorization || reqHeaders.authorization || '';
          const hasValidBearer = authHeader.startsWith('Bearer ') && authHeader.replace(/^Bearer\s+/, '').trim().length > 0;

          if (isAiEndpoint && !hasValidBearer) {
            const stored = await chrome.storage?.local?.get(['guideme_ai_api_key']).catch?.(() => ({}));
            const key = (stored?.guideme_ai_api_key || '').trim();
            if (key) {
              reqHeaders.Authorization = `Bearer ${key}`;
            }
          }

          // Automatically inject stored backend auth token if targeting backend API
          const isBackendEndpoint = typeof url === 'string' && (url.includes('/api/ai/') || url.includes('/api/v1/'));
          if (isBackendEndpoint && !reqHeaders.Authorization && !reqHeaders.authorization) {
            const stored = await chrome.storage?.local?.get(['guideme_auth_token', 'guideme_jwt_token']).catch?.(() => ({}));
            const token = (stored?.guideme_auth_token || stored?.guideme_jwt_token || '').trim();
            if (token) {
              reqHeaders.Authorization = `Bearer ${token}`;
            }
          }

          const res = await fetch(url, {
            method,
            headers: reqHeaders,
            body: typeof body === 'string' ? body : (body !== undefined ? JSON.stringify(body) : undefined),
          });

          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            return sendResponse({ success: false, status: res.status, error: errText });
          }

          const data = await res.json();
          sendResponse({ success: true, data });
        } catch (err) {
          sendResponse({ success: false, error: err?.message || String(err) });
        }
      })();

      return true; // async
    }

    // ── Capture Active Webpage Tab Screenshot ──
    if (message.action === 'GUIDEME_CAPTURE_TAB_SCREENSHOT') {
      const windowId = sender.tab?.windowId;
      const capture = (targetWinId) => {
        try {
          chrome.tabs.captureVisibleTab(targetWinId || null, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError || !dataUrl) {
              sendResponse({
                success: false,
                error: chrome.runtime.lastError?.message || 'Screenshot capture failed',
              });
            } else {
              sendResponse({ success: true, dataUrl });
            }
          });
        } catch (captureErr) {
          sendResponse({ success: false, error: captureErr?.message || String(captureErr) });
        }
      };

      if (windowId) {
        capture(windowId);
      } else {
        chrome.storage?.local?.get(['guideme_target_window_id'], (stored) => {
          capture(stored?.guideme_target_window_id || null);
        });
      }
      return true; // async
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
        async () => {
          sendResponse({ status: 'SUCCESS' });
          triggerQueueSync();

          // Retrieve origin tab & window to return smoothly to the popup
          const stored = await chrome.storage.local.get([
            'guideme_auth_origin_tab_id',
            'guideme_auth_origin_window_id',
          ]);

          const originTabId = stored?.guideme_auth_origin_tab_id;
          const originWindowId = stored?.guideme_auth_origin_window_id;

          const finishReturn = (targetTabId, targetWindowId) => {
            // 1. Close web login tab
            if (sender.tab?.id) {
              chrome.tabs.remove(sender.tab.id).catch(() => {});
            }

            // 2. Focus destination window and tab
            const focusAndOpenPopup = () => {
              if (targetWindowId) {
                chrome.windows.update(targetWindowId, { focused: true }, () => {
                  if (chrome.runtime.lastError) { /* ignore */ }
                  if (targetTabId) {
                    chrome.tabs.update(targetTabId, { active: true }, () => {
                      if (chrome.runtime.lastError) { /* ignore */ }
                      // 3. Open the extension popup automatically!
                      setTimeout(() => {
                        try {
                          if (chrome.action?.openPopup) {
                            chrome.action.openPopup({ windowId: targetWindowId }).catch(() => {
                              chrome.action.openPopup().catch(() => {});
                            });
                          }
                        } catch { }
                      }, 250);
                    });
                  }
                });
              } else {
                setTimeout(() => {
                  try {
                    if (chrome.action?.openPopup) {
                      chrome.action.openPopup().catch(() => {});
                    }
                  } catch { }
                }, 250);
              }
            };

            setTimeout(focusAndOpenPopup, 100);
          };

          if (originTabId) {
            chrome.tabs.get(originTabId, (tab) => {
              if (!chrome.runtime.lastError && tab?.id && !tab.url?.startsWith('chrome://')) {
                finishReturn(tab.id, originWindowId || tab.windowId);
              } else {
                findNormalWebTab(finishReturn);
              }
            });
          } else {
            findNormalWebTab(finishReturn);
          }
        }
      );

      return true;
    }

    return false;
  });

  /**
   * Resolve an active, normal webpage tab (excluding internal chrome:// pages).
   */
  function findNormalWebTab(callback) {
    chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }, (windows) => {
      const normalWin = (windows || []).find((w) => w.focused) || (windows || [])[0];
      const webTab = normalWin?.tabs?.find(
        (t) => t.active && t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://')
      ) || normalWin?.tabs?.find(
        (t) => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://')
      );
      if (webTab && normalWin) {
        callback(webTab.id, normalWin.id);
      } else {
        callback(null, null);
      }
    });
  }
});
