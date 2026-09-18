import { useEffect, useRef, useCallback } from 'react';
import { getUIString } from '@guideme/tutorial-ui';

/**
 * useStuckDetector — Proactive idle / hesitation monitor.
 *
 * Silently watches the page for signs that a user is stuck:
 *   • No meaningful interaction (mouse, keyboard, scroll) for IDLE_THRESHOLD_MS.
 *   • No active GuideMe tutorial is running.
 *   • The page is not a Chrome internal URL, extension page, or blank tab.
 *
 * When triggered, it renders a lightweight, Shadow-DOM-safe nudge notification
 * (no React dependency — raw DOM so it works even if the React tree is not
 * yet fully mounted). Clicking the nudge fires `onNudgeAccepted`; dismissing
 * clears the timer and backs off for SNOOZE_MS before re-arming.
 *
 * Architecture notes
 * ──────────────────
 * • Runs entirely in the content-script context — zero backend calls.
 * • Reads engine state via the shared `engineState` prop (not chrome.storage)
 *   to avoid a storage round-trip on every activity event.
 * • All strings route through getUIString() — zero hardcoded English.
 * • Rendered nudge is appended to the existing `uiContainer` (the same Shadow
 *   DOM root as TutorialOverlay) so it never pollutes the host page's DOM.
 * • Fully cleaned up (timers, listeners, DOM nodes) on unmount.
 *
 * @param {object} opts
 * @param {object}   opts.engineState      - Live engine state from useContentBridge
 * @param {HTMLElement} opts.uiContainer   - The Shadow DOM host container
 * @param {string}   opts.language         - Current UI language ('km' | 'en')
 * @param {function} opts.onNudgeAccepted  - Called when user clicks the CTA
 * @param {number}  [opts.idleThresholdMs] - Default: 45 000 ms (45 s)
 * @param {number}  [opts.snoozeMs]        - Snooze after dismiss: 3 min default
 */
export function useStuckDetector({
  engineState,
  uiContainer,
  language   = 'km',
  onNudgeAccepted,
  idleThresholdMs = 45_000,
  snoozeMs        = 3 * 60 * 1000,
}) {
  const timerRef     = useRef(null);
  const nudgeElRef   = useRef(null);
  const snoozedUntil = useRef(0);
  const langRef      = useRef(language);

  // Keep langRef current so event callbacks don't close over a stale value
  useEffect(() => { langRef.current = language; }, [language]);

  // ── Nudge DOM helpers ─────────────────────────────────────────────────────

  const removeNudge = useCallback(() => {
    if (nudgeElRef.current) {
      nudgeElRef.current.remove();
      nudgeElRef.current = null;
    }
  }, []);

  const showNudge = useCallback(() => {
    if (nudgeElRef.current) return; // already visible
    if (!uiContainer)        return; // container not ready

    const lang = langRef.current;

    // Build nudge card — inline styles keep it independent of Tailwind compilation
    const wrapper = document.createElement('div');
    wrapper.id = 'guideme-stuck-nudge';
    Object.assign(wrapper.style, {
      position:     'fixed',
      bottom:       '88px',
      right:        '20px',
      zIndex:       '2147483646',
      maxWidth:     '280px',
      background:   '#ffffff',
      border:       '1px solid #ede4ff',
      borderRadius: '14px',
      boxShadow:    '0 8px 30px rgba(147,51,234,0.18)',
      padding:      '16px 18px',
      fontFamily:   lang === 'km' ? '"Kantumruy Pro", sans-serif' : '"Inter", sans-serif',
      fontSize:     '13px',
      lineHeight:   '1.55',
      color:        '#1f1d2b',
      animation:    'guideme-nudge-in 0.25s ease-out',
      pointerEvents: 'auto',
    });

    // Dark mode — check the container's class list
    const isDark = uiContainer.classList.contains('dark');
    if (isDark) {
      Object.assign(wrapper.style, {
        background:   '#1e1e2f',
        border:       '1px solid #3b2d6b',
        color:        '#f9fafb',
        boxShadow:    '0 8px 30px rgba(0,0,0,0.45)',
      });
    }

    // Inject keyframe animation only once per Shadow Root
    const root = uiContainer.getRootNode();
    if (root instanceof ShadowRoot && !root.querySelector('#guideme-nudge-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'guideme-nudge-styles';
      styleEl.textContent = `
        @keyframes guideme-nudge-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `;
      root.appendChild(styleEl);
    }

    // Icon row
    const iconRow = document.createElement('div');
    Object.assign(iconRow.style, { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' });

    const icon = document.createElement('span');
    icon.textContent = '💡';
    icon.style.fontSize = '20px';

    const title = document.createElement('strong');
    title.textContent = getUIString('stuckNudgeTitle', lang);
    Object.assign(title.style, { fontSize: '14px', fontWeight: '600' });

    iconRow.appendChild(icon);
    iconRow.appendChild(title);

    // Body text
    const body = document.createElement('p');
    body.textContent = getUIString('stuckNudgeBody', lang);
    Object.assign(body.style, { margin: '0 0 14px', opacity: '0.85' });

    // Button row
    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '8px' });

    const ctaBtn = document.createElement('button');
    ctaBtn.textContent = getUIString('stuckNudgeCta', lang);
    Object.assign(ctaBtn.style, {
      flex:         '1',
      background:   '#9333ea',
      color:        '#fff',
      border:       'none',
      borderRadius: '8px',
      padding:      '7px 12px',
      fontSize:     '13px',
      cursor:       'pointer',
      fontFamily:   'inherit',
      fontWeight:   '600',
    });
    ctaBtn.addEventListener('click', () => {
      removeNudge();
      clearTimerRef();
      if (typeof onNudgeAccepted === 'function') onNudgeAccepted();
    });

    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = getUIString('stuckNudgeDismiss', lang);
    Object.assign(dismissBtn.style, {
      background:   'transparent',
      color:        isDark ? '#a78bfa' : '#7c3aed',
      border:       `1px solid ${isDark ? '#7c3aed' : '#ddd6fe'}`,
      borderRadius: '8px',
      padding:      '7px 12px',
      fontSize:     '13px',
      cursor:       'pointer',
      fontFamily:   'inherit',
    });
    dismissBtn.addEventListener('click', () => {
      removeNudge();
      clearTimerRef();
      // Snooze — don't re-arm until snoozeMs has passed
      snoozedUntil.current = Date.now() + snoozeMs;
    });

    btnRow.appendChild(ctaBtn);
    btnRow.appendChild(dismissBtn);

    wrapper.appendChild(iconRow);
    wrapper.appendChild(body);
    wrapper.appendChild(btnRow);

    // Auto-dismiss after 15 seconds if user ignores it
    const autoDismiss = setTimeout(() => {
      removeNudge();
      snoozedUntil.current = Date.now() + snoozeMs;
    }, 15_000);
    // Store reference so we can cancel it if the user acts before it fires
    wrapper._autoDismiss = autoDismiss;
    wrapper._cleanup = () => clearTimeout(autoDismiss);

    nudgeElRef.current = wrapper;
    uiContainer.appendChild(wrapper);
  }, [uiContainer, onNudgeAccepted, removeNudge, snoozeMs]);

  // ── Timer helpers ─────────────────────────────────────────────────────────

  const clearTimerRef = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Cancel auto-dismiss if nudge is still alive
    if (nudgeElRef.current?._cleanup) {
      nudgeElRef.current._cleanup();
    }
  }, []);

  const armTimer = useCallback(() => {
    clearTimerRef();
    timerRef.current = setTimeout(() => {
      // Final guard: don't nudge if a tutorial just started while we were waiting
      showNudge();
    }, idleThresholdMs);
  }, [clearTimerRef, idleThresholdMs, showNudge]);

  const resetTimer = useCallback(() => {
    // Dismiss any visible nudge when the user becomes active again
    removeNudge();
    armTimer();
  }, [removeNudge, armTimer]);

  // ── Main effect ───────────────────────────────────────────────────────────

  useEffect(() => {
    // Don't monitor Chrome internal pages or extension pages
    const href = window.location.href;
    if (
      href.startsWith('chrome://') ||
      href.startsWith('chrome-extension://') ||
      href.startsWith('about:') ||
      href.startsWith('edge://')
    ) return;

    // A tutorial is genuinely in progress only when isActive is true.
    // isCompleted is false both for an idle/never-started engine and for one
    // that's actively running, so OR-ing it in here made the idle default
    // register as "active" and kept the nudge timer from ever arming.
    const isEngineActive = () => engineState?.isActive === true;

    const onActivity = () => {
      if (isEngineActive()) {
        clearTimerRef();
        return;
      }
      if (Date.now() < snoozedUntil.current) return;
      resetTimer();
    };

    // Activity events that prove the user is engaged
    const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    // Arm the initial timer — page load counts as activity
    if (!isEngineActive() && Date.now() >= snoozedUntil.current) {
      armTimer();
    }

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      clearTimerRef();
      removeNudge();
    };
  }, [engineState?.isActive, armTimer, clearTimerRef, resetTimer, removeNudge]);

  // Stop the detector immediately if the engine becomes active
  useEffect(() => {
    if (engineState?.isActive) {
      clearTimerRef();
      removeNudge();
    }
  }, [engineState?.isActive, clearTimerRef, removeNudge]);
}
