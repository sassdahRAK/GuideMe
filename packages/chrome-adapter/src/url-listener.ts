/**
 * Intercepts Single Page Application (SPA) route changes across pushState, replaceState, and popstate.
 */
export class UrlListener {
  /**
   * Listen to SPA URL navigation changes.
   * @param callback Callback invoked with new URL
   * @returns Unsubscribe function
   */
  static listen(callback: (newUrl: string) => void): () => void {
    if (typeof window === 'undefined') return () => {};

    let lastUrl = window.location.href;

    const checkUrl = (): void => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        callback(currentUrl);
      }
    };

    // 1. Listen to native popstate & hashchange
    window.addEventListener('popstate', checkUrl);
    window.addEventListener('hashchange', checkUrl);

    // 2. Wrap history.pushState & history.replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (this: History, ...args: Parameters<History['pushState']>) {
      const result = originalPushState.apply(this, args);
      checkUrl();
      return result;
    };

    history.replaceState = function (this: History, ...args: Parameters<History['replaceState']>) {
      const result = originalReplaceState.apply(this, args);
      checkUrl();
      return result;
    };

    return () => {
      window.removeEventListener('popstate', checkUrl);
      window.removeEventListener('hashchange', checkUrl);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }
}
