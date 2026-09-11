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

    // 4. Inject Kantumruy Pro + Inter into the HOST document <head> so the
    //    browser registers the font at the top-level document. Fonts declared
    //    only inside a Shadow DOM stylesheet are not reliably loaded in Chrome;
    //    injecting a <link> at document level guarantees the font data is
    //    available to every context, including the Shadow DOM.
    if (!document.getElementById('guideme-font-preload')) {
      // Preconnect hints for faster handshake
      const preconnect1 = document.createElement('link');
      preconnect1.rel = 'preconnect';
      preconnect1.href = 'https://fonts.googleapis.com';

      const preconnect2 = document.createElement('link');
      preconnect2.rel = 'preconnect';
      preconnect2.href = 'https://fonts.gstatic.com';
      preconnect2.crossOrigin = 'anonymous';

      // Actual font stylesheet
      const fontLink = document.createElement('link');
      fontLink.id = 'guideme-font-preload';
      fontLink.rel = 'stylesheet';
      fontLink.href =
        'https://fonts.googleapis.com/css2?family=Kantumruy+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700;800&display=swap';

      document.head.appendChild(preconnect1);
      document.head.appendChild(preconnect2);
      document.head.appendChild(fontLink);
    }

    console.log('[GuideMe Content Script] Mounting isolated Shadow DOM UI...');

    const ui = await createShadowRootUi(ctx, {
      name: 'guideme-tutorial-root',
      position: 'overlay',
      anchor: 'body',
      append: 'last',
      zIndex: 2147483647,
      onMount(uiContainer) {
        // Create a dedicated app container inside the shadow root so React
        // never calls createRoot() directly on document.body or uiContainer,
        // which suppresses the "Creating roots directly with document.body"
        // React warning caused by third-party script interference.
        const appContainer = document.createElement('div');
        appContainer.id = 'guideme-app-root';
        appContainer.style.cssText = [
          'position:fixed',
          'inset:0',
          'width:100vw',
          'height:100vh',
          'pointer-events:none',
          'z-index:2147483647',
          // Set Kantumruy Pro at the container level so every descendant
          // inherits it — this is the highest-priority inheritance anchor
          // inside the Shadow DOM, above all Tailwind utility classes.
          "font-family:'Kantumruy Pro','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
        ].join(';');
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
