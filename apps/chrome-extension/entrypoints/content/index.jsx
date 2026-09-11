import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import ReactDOM from 'react-dom/client';
import React from 'react';
import { TutorialApp } from './components/TutorialApp.jsx';
import './style.css';

/**
 * GuideMe Web Extension — Content Script Entrypoint.
 *
 * Responsibilities:
 *  - Sub-frame isolation & singleton mount guards
 *  - Shadow DOM injection via WXT createShadowRootUi
 *  - React container lifecycle mounting and teardown
 */
export default defineContentScript({
  matches: ['*://*/*', '<all_urls>'],
  allFrames: false,
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx) {
    // 1. Guard against sub-iframes (e.g. voice widgets, auth frames, sandboxed iframes)
    if (typeof window !== 'undefined' && window.self !== window.top) {
      return;
    }

    // 2. Singleton guard against duplicate content script execution
    if (typeof window !== 'undefined') {
      if (window.__GUIDEME_MOUNTED__) {
        console.warn('[GuideMe] Content script already mounted on this page. Skipping duplicate mount.');
        return;
      }
      window.__GUIDEME_MOUNTED__ = true;
    }

    // 3. Clean up any existing orphan shadow host element
    const existing = document.querySelector('guideme-tutorial-root, #guideme-tutorial-root');
    if (existing) {
      existing.remove();
    }

    console.log('[GuideMe Content Script] Mounting isolated Shadow DOM UI...');

    const ui = await createShadowRootUi(ctx, {
      name: 'guideme-tutorial-root',
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      zIndex: 2147483647,
      onMount(uiContainer) {
        const appContainer = document.createElement('div');
        appContainer.id = 'guideme-root-app';
        uiContainer.appendChild(appContainer);

        const root = ReactDOM.createRoot(appContainer);
        root.render(<TutorialApp uiContainer={uiContainer} />);
        return root;
      },
      onRemove(root) {
        if (typeof window !== 'undefined') {
          window.__GUIDEME_MOUNTED__ = false;
        }
        root?.unmount();
      },
    });

    ctx.onInvalidated(() => {
      if (typeof window !== 'undefined') {
        window.__GUIDEME_MOUNTED__ = false;
      }
      ui.remove();
    });

    ui.mount();
  },
});
