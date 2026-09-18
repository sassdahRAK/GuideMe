/**
 * GuideMe Cooperative Embed Script
 * -----------------------------------------------------------------------
 * Add this script to your own site to opt into accurate GuideMe overlay
 * targeting when your page is shown inside another site's cross-origin
 * iframe while GuideMe is guiding a user through that host page.
 *
 *   <script src="https://your-host/guideme-embed.js"></script>
 *
 * Without this script, GuideMe still works — it just falls back to
 * highlighting your iframe's own bounding box instead of the specific
 * control inside it.
 *
 * This script is entirely read-only and overlay-cooperative: it listens
 * for a `guideme:locate` postMessage, looks up the requested element with
 * a plain `querySelector`, and replies with that element's bounding box
 * relative to *this* page's own viewport. It never simulates clicks,
 * focuses anything, or modifies your page's DOM or state in any way.
 * Deliberately dependency-free — it runs standalone in your page's own JS
 * realm, with no reference to any GuideMe package.
 */
(function () {
  'use strict';

  function normalizeText(value) {
    return String(value || '')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function isVisible(el) {
    return Boolean(
      el && (el.offsetParent !== null || (typeof el.getClientRects === 'function' && el.getClientRects().length > 0))
    );
  }

  /**
   * Minimal, self-contained subset of GuideMe's selector matching: css,
   * then data-testid/data-cy, then exact visible text. Good enough for the
   * kind of widget content typically embedded in a third-party iframe.
   * @param {Object} selector
   * @returns {Element|null}
   */
  function locate(selector) {
    if (!selector || typeof selector !== 'object') return null;

    if (selector.css) {
      try {
        var matches = document.querySelectorAll(selector.css);
        for (var i = 0; i < matches.length; i++) {
          if (isVisible(matches[i])) return matches[i];
        }
      } catch (e) {
        // Selector isn't valid CSS on this page — ignore and fall through.
      }
    }

    if (selector.testId) {
      var byTestId = document.querySelector(
        '[data-testid="' + selector.testId + '"], [data-cy="' + selector.testId + '"]'
      );
      if (isVisible(byTestId)) return byTestId;
    }

    if (selector.text) {
      var target = normalizeText(selector.text);
      var candidates = document.querySelectorAll('button, [role="button"], a, input, select, span, div, p');
      for (var j = 0; j < candidates.length; j++) {
        var el = candidates[j];
        if (normalizeText(el.textContent) === target && isVisible(el)) return el;
      }
    }

    return null;
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.type !== 'guideme:locate' || !data.requestId) return;

    var source = event.source;
    if (!source || typeof source.postMessage !== 'function') return;

    var el = locate(data.selector);
    var rect = el && typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;

    source.postMessage(
      {
        type: 'guideme:location',
        requestId: data.requestId,
        rect: rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null,
      },
      event.origin || '*'
    );
  });
})();
