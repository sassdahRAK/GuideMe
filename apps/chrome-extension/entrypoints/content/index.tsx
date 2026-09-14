import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import ReactDOM from 'react-dom/client';
import React from 'react';
import { TutorialApp } from './components/TutorialApp.tsx';
import './style.css';

/**
 * GuideMe Web Extension — Content Script Entrypoint.
 */
export default defineContentScript({
  matches: ['*://*/*', '<all_urls>'],
  allFrames: false,
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx: any) {
    // 1. Guard against sub-iframes (e.g. voice widgets, auth frames, sandboxed iframes)
    if (typeof window !== 'undefined' && window.self !== window.top) {
      return;
    }

    // 2. Singleton guard against duplicate content script execution
    if (typeof window !== 'undefined') {
      if ((window as any).__GUIDEME_MOUNTED__) {
        console.warn('[GuideMe] Content script already mounted on this page. Skipping duplicate mount.');
        return;
      }
      (window as any).__GUIDEME_MOUNTED__ = true;
    }

    // 3. Clean up any existing orphan shadow host element
    const existing = document.querySelector('guideme-tutorial-root, #guideme-tutorial-root');
    if (existing) {
      existing.remove();
    }

    // 4. Inject Kantumruy Pro + Inter into the HOST document <head>
    if (!document.getElementById('guideme-font-preload')) {
      const preconnect1 = document.createElement('link');
      preconnect1.rel = 'preconnect';
      preconnect1.href = 'https://fonts.googleapis.com';

      const preconnect2 = document.createElement('link');
      preconnect2.rel = 'preconnect';
      preconnect2.href = 'https://fonts.gstatic.com';
      preconnect2.crossOrigin = 'anonymous';

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
      onMount(uiContainer: HTMLElement) {
        const appContainer = document.createElement('div');
        appContainer.id = 'guideme-app-root';
        appContainer.style.cssText = [
          'position:fixed',
          'inset:0',
          'width:100vw',
          'height:100vh',
          'pointer-events:none',
          'z-index:2147483647',
          "font-family:'Kantumruy Pro','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
        ].join(';');
        uiContainer.appendChild(appContainer);

        const root = ReactDOM.createRoot(appContainer);
        root.render(<TutorialApp uiContainer={uiContainer} />);
        return root;
      },
      onRemove(root?: any) {
        if (typeof window !== 'undefined') {
          (window as any).__GUIDEME_MOUNTED__ = false;
        }
        root?.unmount();
      },
    });

    ctx.onInvalidated(() => {
      if (typeof window !== 'undefined') {
        (window as any).__GUIDEME_MOUNTED__ = false;
      }
      ui.remove();
    });

    ui.mount();
  },
});
