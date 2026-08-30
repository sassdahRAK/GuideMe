import { useState, useCallback, useRef } from 'react';

/* ─────────────────────────────────────────────────────────────────
   copyShadowStylesToPip — Extracts styles from the Shadow DOM host
   and clones them into the PiP window <head>. This is required because
   WXT's createShadowRootUi isolates styles inside Shadow DOM, so
   document.styleSheets won't contain component styles.
───────────────────────────────────────────────────────────────── */
function copyShadowStylesToPip(shadowRoot: ShadowRoot, pipWindow: Window) {
  // Extract all inline <style> elements from Shadow DOM
  const shadowStyles = shadowRoot.querySelectorAll('style');
  shadowStyles.forEach((styleElement) => {
    const clonedStyle = pipWindow.document.createElement('style');
    clonedStyle.textContent = styleElement.textContent;
    pipWindow.document.head.appendChild(clonedStyle);
  });

  // Extract linked stylesheets (<link rel="stylesheet">)
  const shadowLinks = shadowRoot.querySelectorAll('link[rel="stylesheet"]');
  shadowLinks.forEach((linkElement) => {
    const clonedLink = pipWindow.document.createElement('link');
    clonedLink.rel = 'stylesheet';
    clonedLink.href = (linkElement as HTMLLinkElement).href;
    pipWindow.document.head.appendChild(clonedLink);
  });
}

/* ─────────────────────────────────────────────────────────────────
   copyDocumentStylesToPip — Fallback for non-Shadow DOM contexts.
   Copies all accessible stylesheets from the main document.
───────────────────────────────────────────────────────────────── */
function copyDocumentStylesToPip(pipWindow: Window) {
  [...document.styleSheets].forEach((sheet) => {
    try {
      const cssRules = [...sheet.cssRules].map((r) => r.cssText).join('\n');
      const style = document.createElement('style');
      style.textContent = cssRules;
      pipWindow.document.head.appendChild(style);
    } catch (e) {
      // Fallback for cross-origin linked stylesheets
      if (sheet.href) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        pipWindow.document.head.appendChild(link);
      }
    }
  });
}

/* ─────────────────────────────────────────────────────────────────
   useDocumentPip — React hook for managing a Document Picture-in-
   Picture window lifecycle. Opens an always-on-top OS window,
   copies styles into it, and tracks the window reference.
───────────────────────────────────────────────────────────────── */
export function useDocumentPip(onDock?: () => void) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const onDockRef = useRef(onDock);
  onDockRef.current = onDock;

  const openPip = useCallback(async (width = 800, height = 600) => {
    if (!('documentPictureInPicture' in window)) {
      console.error('[GuideMe PiP] Document Picture-in-Picture API is not supported in this browser.');
      return;
    }

    // Must be invoked directly from a user action (e.g., click event handler)
    const dw = await (window as any).documentPictureInPicture.requestWindow({
      width,
      height,
      disallowReturnToOpener: false,
    });

    // 1. Try to find the Shadow DOM host and copy styles from it
    const shadowHost = document.querySelector('guideme-tutorial-root, #guideme-tutorial-root');
    const shadowRoot = shadowHost?.shadowRoot;

    if (shadowRoot) {
      copyShadowStylesToPip(shadowRoot, dw);
    } else {
      // Fallback: copy from document stylesheets
      copyDocumentStylesToPip(dw);
    }

    // 2. Also copy any global document-level styles (fonts, etc.)
    copyDocumentStylesToPip(dw);

    // 3. Add base background class to native window body
    dw.document.body.className = 'bg-white dark:bg-[#101018] text-gray-900 dark:text-zinc-100 m-0 p-0 overflow-hidden';

    // 4. Handle window closure initiated by user OS action (dock back)
    dw.addEventListener('pagehide', () => {
      setPipWindow(null);
      pipWindowRef.current = null;
      onDockRef.current?.();
    });

    pipWindowRef.current = dw;
    setPipWindow(dw);
  }, []);

  const closePip = useCallback(() => {
    if (pipWindowRef.current) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
      setPipWindow(null);
    }
  }, []);

  return { openPip, closePip, pipWindow };
}
