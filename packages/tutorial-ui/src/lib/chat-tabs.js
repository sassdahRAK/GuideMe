// Shared multi-tab chat storage model, used by BOTH the in-page widget
// (ChatBoxWidgetOverlay.jsx) and the popup (App.tsx) so they read/write the
// exact same chrome.storage.local shape and stay in sync via a single
// chrome.storage.onChanged listener on `guideme_chat_tabs` — no separate
// "who wrote this" heuristic needed, since there is only one write shape.
import { getUIString } from '../i18n/ui-strings.js';

export const CHAT_TABS_KEY = 'guideme_chat_tabs';
export const ACTIVE_TAB_ID_KEY = 'guideme_active_chat_tab_id';
// Flat mirror of the active tab's messages, kept for one release cycle as a
// harmless back-compat fallback for any reader that hasn't moved to the tab
// model yet. Not load-bearing for sync anymore.
export const FLAT_MESSAGES_KEY = 'guideme_chat_messages';

export function createDefaultTab(lang, tabNumber = 1) {
  return {
    id: 'tab-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    title: `${getUIString('defaultChatTitle', lang)} ${tabNumber}`,
    messages: [
      {
        role: 'assistant',
        content: getUIString('chatGreeting', lang),
        timestamp: Date.now(),
      },
    ],
    isDefaultTitle: true,
    createdAt: Date.now(),
  };
}

/**
 * Read the current tabs + active tab id from storage, creating and
 * persisting a single default tab if none exist yet.
 */
export async function loadOrInitTabs(lang) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    const tab = createDefaultTab(lang);
    return { tabs: [tab], activeTabId: tab.id };
  }

  const res = await chrome.storage.local.get([CHAT_TABS_KEY, ACTIVE_TAB_ID_KEY]);
  let tabs = res[CHAT_TABS_KEY];
  let activeTabId = res[ACTIVE_TAB_ID_KEY];

  if (!Array.isArray(tabs) || tabs.length === 0) {
    const tab = createDefaultTab(lang);
    tabs = [tab];
    activeTabId = tab.id;
    await persistTabs(tabs, activeTabId);
  } else if (!activeTabId || !tabs.some((t) => t.id === activeTabId)) {
    activeTabId = tabs[0].id;
  }

  return { tabs, activeTabId };
}

/**
 * Atomically persist the full tab array + active tab id, mirroring the
 * active tab's messages into the flat back-compat key — all in one
 * chrome.storage.local.set() call so onChanged listeners see every key
 * change together.
 */
export async function persistTabs(tabs, activeTabId) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  const active = tabs.find((t) => t.id === activeTabId) || tabs[0];
  try {
    await chrome.storage.local.set({
      [CHAT_TABS_KEY]: tabs,
      [ACTIVE_TAB_ID_KEY]: activeTabId,
      [FLAT_MESSAGES_KEY]: active?.messages || [],
    });
  } catch {}
}

// Unsent input text per tab, keyed by tab id — kept separate from the tabs'
// `messages` so a draft in progress survives the popup auto-closing (on
// blur, a real browser action popup unconditionally destroys its whole React
// tree) or the in-page widget being closed, without polluting chat history.
export const CHAT_DRAFTS_KEY = 'guideme_chat_drafts';

/**
 * Read back whatever unsent text was last saved for this tab, if any.
 */
export async function loadDraft(tabId) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local || !tabId) return '';
  try {
    const res = await chrome.storage.local.get([CHAT_DRAFTS_KEY]);
    return res[CHAT_DRAFTS_KEY]?.[tabId] || '';
  } catch {
    return '';
  }
}

/**
 * Persist (or, for empty text, clear) this tab's draft. Both the popup and
 * the in-page widget call this on every keystroke (debounced) so whichever
 * surface is open, the other one picks up the same draft on next open.
 */
export async function saveDraft(tabId, text) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local || !tabId) return;
  try {
    const res = await chrome.storage.local.get([CHAT_DRAFTS_KEY]);
    const drafts = { ...(res[CHAT_DRAFTS_KEY] || {}) };
    if (text) {
      drafts[tabId] = text;
    } else {
      delete drafts[tabId];
    }
    await chrome.storage.local.set({ [CHAT_DRAFTS_KEY]: drafts });
  } catch {}
}

/**
 * Replace one tab's `messages` (and optionally auto-derive its title from
 * the first user message, matching the widget's existing behavior) and
 * persist the result.
 */
export async function updateTabMessages(tabs, tabId, messages, { deriveTitleFrom } = {}) {
  const nextTabs = tabs.map((t) => {
    if (t.id !== tabId) return t;
    let title = t.title;
    let isDefaultTitle = t.isDefaultTitle;
    if (isDefaultTitle && deriveTitleFrom) {
      const clean = deriveTitleFrom.trim();
      if (clean) {
        title = clean.length > 18 ? clean.slice(0, 16) + '...' : clean;
        isDefaultTitle = false;
      }
    }
    return { ...t, title, isDefaultTitle, messages };
  });
  await persistTabs(nextTabs, tabId);
  return nextTabs;
}
