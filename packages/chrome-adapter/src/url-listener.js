/**
 * Intercepts Single Page Application (SPA) route changes across pushState, replaceState, and popstate.
 */
export class UrlListener {
  /**
   * Listen to SPA URL navigation changes.
   * @param {(newUrl: string) => void} callback
   * @returns {() => void} Unsubscribe function
   */
  static listen(callback) {
    if (typeof window === 'undefined') return () => {};

    let lastUrl = window.location.href;

    const checkUrl = () => {
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

    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      checkUrl();
      return result;
    };

    history.replaceState = function (...args) {
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
