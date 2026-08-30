/**
 * GuideMe PiP — Standalone popup window controller.
 *
 * This script runs inside a chrome.windows.create() popup window.
 * It is intentionally framework-free (no React) to keep the window
 * lightweight and avoid any rendering race conditions that could
 * cause the window to close immediately on launch.
 *
 * Key guarantees:
 *  - All initialization is wrapped in DOMContentLoaded.
 *  - No window.close() or window.blur() listeners exist in this file.
 *  - Every critical section has try...catch with console.error logging.
 *  - The window stays open until the user explicitly closes it.
 */

(function () {
  'use strict';

  // ── UI Strings (Khmer-first, English secondary) ──────────────
  const UI_STRINGS = {
    askAnything: { km: 'សួរអ្វីមួយ...', en: 'Ask anything ...' },
    send: { km: 'ផ្ញើ', en: 'Send' },
    voiceInput: { km: 'បញ្ចូលសំឡេង', en: 'Voice input' },
    stopListening: { km: 'បញ្ឈប់ការស្ដាប់', en: 'Stop listening' },
  };

  function t(key, lang) {
    const item = UI_STRINGS[key];
    if (!item) return key;
    return item[lang] || item['km'] || item['en'] || key;
  }

  // ── GuideMe Logo SVG (inline to avoid network fetch) ─────────
  const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 1500 1499.999933" preserveAspectRatio="xMidYMid meet" aria-label="GuideMe Logo">
    <defs>
      <clipPath id="gm-clip-1"><path d="M 343 353 L 1265 353 L 1265 1317 L 343 1317 Z M 343 353 " clip-rule="nonzero"/></clipPath>
      <clipPath id="gm-clip-2"><path d="M 59.328125 364.316406 L 898.867188 23.710938 L 1350 1135.683594 L 510.460938 1476.289062 Z M 59.328125 364.316406 " clip-rule="nonzero"/></clipPath>
      <clipPath id="gm-clip-3"><path d="M 59.328125 364.316406 L 898.867188 23.710938 L 1350 1135.683594 L 510.460938 1476.289062 Z M 59.328125 364.316406 " clip-rule="nonzero"/></clipPath>
      <clipPath id="gm-clip-4"><path d="M 240 218 L 669 218 L 669 540 L 240 540 Z M 240 218 " clip-rule="nonzero"/></clipPath>
      <clipPath id="gm-clip-5"><path d="M 59.328125 364.316406 L 898.867188 23.710938 L 1350 1135.683594 L 510.460938 1476.289062 Z M 59.328125 364.316406 " clip-rule="nonzero"/></clipPath>
      <clipPath id="gm-clip-6"><path d="M 59.328125 364.316406 L 898.867188 23.710938 L 1350 1135.683594 L 510.460938 1476.289062 Z M 59.328125 364.316406 " clip-rule="nonzero"/></clipPath>
    </defs>
    <rect x="-150" width="1800" fill="#1d1e22" y="-149.999993" height="1799.99992" fill-opacity="1"/>
    <g clip-path="url(#gm-clip-1)">
      <g clip-path="url(#gm-clip-2)">
        <g clip-path="url(#gm-clip-3)">
          <path fill="#fefefe" fill-opacity="1" fill-rule="nonzero" d="M 1142.503906 625.746094 C 1124.742188 582.035156 1074.6875 560.90625 1030.933594 578.65625 C 1002.578125 590.164062 983.710938 615.234375 978.796875 643.382812 L 977.945312 641.285156 C 960.15625 597.441406 910.015625 576.238281 866.175781 594.027344 C 837.859375 605.515625 818.988281 630.503906 813.976562 658.582031 L 813.191406 656.652344 C 795.40625 612.808594 745.265625 591.605469 701.421875 609.394531 C 673.101562 620.882812 654.230469 645.875 649.214844 673.949219 L 541.046875 407.324219 C 532.40625 386.035156 516.003906 369.421875 494.832031 360.511719 C 473.738281 351.625 450.46875 351.46875 429.277344 360.066406 L 429.03125 360.167969 C 385.382812 378.039062 364.304688 428.140625 382.03125 471.839844 L 593.128906 992.15625 C 594.992188 996.75 594 1001.589844 590.472656 1005.074219 C 586.945312 1008.585938 582.09375 1009.5 577.515625 1007.558594 L 464.308594 960.078125 C 426.082031 944.054688 381.574219 957.398438 358.476562 991.8125 C 344.816406 1012.132812 340.351562 1037.410156 346.246094 1061.199219 C 352.125 1084.96875 367.882812 1105.28125 389.457031 1116.886719 L 688.566406 1277.8125 C 773.34375 1323.625 873.183594 1329.128906 962.472656 1292.90625 L 1087.601562 1242.140625 C 1157.578125 1213.75 1212.316406 1159.8125 1241.722656 1090.253906 C 1271.125 1020.691406 1271.671875 943.839844 1243.277344 873.878906 Z M 1142.503906 625.746094 "/>
        </g>
      </g>
    </g>
    <g clip-path="url(#gm-clip-4)">
      <g clip-path="url(#gm-clip-5)">
        <g clip-path="url(#gm-clip-6)">
          <path fill="#fefefe" fill-opacity="1" fill-rule="nonzero" d="M 291.066406 537.128906 C 304.535156 531.664062 311.027344 516.328125 305.558594 502.847656 C 270.671875 416.855469 312.253906 318.503906 398.257812 283.613281 C 484.261719 248.71875 582.613281 290.300781 617.503906 376.292969 C 622.972656 389.773438 638.316406 396.25 651.78125 390.785156 C 665.25 385.320312 671.742188 369.984375 666.273438 356.503906 C 620.476562 243.625 491.367188 189.035156 378.46875 234.839844 C 265.574219 280.644531 210.992188 409.757812 256.789062 522.636719 C 262.257812 536.113281 277.601562 542.59375 291.066406 537.128906 Z M 291.066406 537.128906 "/>
        </g>
      </g>
    </g>
  </svg>`;

  // ── State ────────────────────────────────────────────────────
  let currentLang = 'km';
  let currentTheme = 'light';
  let isListening = false;

  // ── DOM refs (populated on init) ─────────────────────────────
  let root, input, micBtn, sendBtn, form, logoContainer, themeBtn, iconSun, iconMoon;

  /**
   * Initialize the PiP window.
   * Called once DOM is fully parsed.
   */
  function init() {
    try {
      // Grab DOM elements
      root = document.getElementById('guideme-pip-root');
      input = document.getElementById('pip-input');
      micBtn = document.getElementById('pip-mic');
      sendBtn = document.getElementById('pip-send');
      form = document.getElementById('pip-form');
      logoContainer = document.getElementById('pip-logo');
      themeBtn = document.getElementById('pip-theme-btn');
      iconSun = document.getElementById('icon-sun');
      iconMoon = document.getElementById('icon-moon');

      if (!root || !input || !form) {
        console.error('[GuideMe PiP] Critical DOM elements missing — aborting init.');
        return;
      }

      // Inject logo
      if (logoContainer) {
        logoContainer.innerHTML = LOGO_SVG;
      }

      // Load stored preferences
      loadPreferences();

      // Listen for live theme/language changes
      setupStorageListener();

      // Wire up event handlers
      setupEventHandlers();

      // Focus the input so the user can type immediately
      if (input) {
        input.focus();
      }

      console.log('[GuideMe PiP] Window initialized successfully.');
    } catch (err) {
      console.error('[GuideMe PiP] Init failed:', err);
    }
  }

  /**
   * Load theme & language from chrome.storage.local.
   */
  function loadPreferences() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['guideme_theme', 'guideme_lang'], (result) => {
          try {
            if (chrome.runtime && chrome.runtime.lastError) {
              console.warn('[GuideMe PiP] Storage read error:', chrome.runtime.lastError.message);
              return;
            }
            if (result && result.guideme_theme) {
              currentTheme = result.guideme_theme;
              applyTheme(currentTheme);
            }
            if (result && result.guideme_lang) {
              currentLang = result.guideme_lang;
              applyLanguage(currentLang);
            }
          } catch (innerErr) {
            console.error('[GuideMe PiP] Error applying preferences:', innerErr);
          }
        });
      }
    } catch (err) {
      console.error('[GuideMe PiP] loadPreferences failed:', err);
    }
  }

  /**
   * Listen for theme/language changes made in the popup or other views.
   */
  function setupStorageListener() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        const listener = (changes, areaName) => {
          try {
            if (areaName !== 'local') return;
            if (changes.guideme_theme) {
              currentTheme = changes.guideme_theme.newValue;
              applyTheme(currentTheme);
            }
            if (changes.guideme_lang) {
              currentLang = changes.guideme_lang.newValue;
              applyLanguage(currentLang);
            }
          } catch (err) {
            console.error('[GuideMe PiP] Storage listener error:', err);
          }
        };
        chrome.storage.onChanged.addListener(listener);
      }
    } catch (err) {
      console.error('[GuideMe PiP] setupStorageListener failed:', err);
    }
  }

  /**
   * Apply theme to document root and update the toggle icon.
   */
  function applyTheme(theme) {
    try {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        if (iconSun) iconSun.style.display = '';
        if (iconMoon) iconMoon.style.display = 'none';
      } else {
        document.documentElement.classList.remove('dark');
        if (iconSun) iconSun.style.display = 'none';
        if (iconMoon) iconMoon.style.display = '';
      }
    } catch (err) {
      console.error('[GuideMe PiP] applyTheme failed:', err);
    }
  }

  /**
   * Apply language — update placeholder & font class.
   */
  function applyLanguage(lang) {
    try {
      currentLang = lang;
      if (input) {
        input.placeholder = t('askAnything', lang);
      }
      const card = document.querySelector('.floating-card');
      if (card) {
        card.classList.toggle('font-kantumruy', lang === 'km');
        card.classList.toggle('font-sans', lang !== 'km');
      }
    } catch (err) {
      console.error('[GuideMe PiP] applyLanguage failed:', err);
    }
  }

  /**
   * Wire up all event handlers.
   */
  function setupEventHandlers() {
    try {
      // Form submit — send prompt to content script
      if (form) {
        form.addEventListener('submit', (e) => {
          try {
            e.preventDefault();
            handleSend();
          } catch (err) {
            console.error('[GuideMe PiP] Form submit error:', err);
          }
        });
      }

      // Input change — toggle mic/send button visibility
      if (input) {
        input.addEventListener('input', () => {
          try {
            const hasText = input.value.trim().length > 0;
            if (micBtn) micBtn.style.display = hasText ? 'none' : '';
            if (sendBtn) sendBtn.style.display = hasText ? '' : 'none';
          } catch (err) {
            console.error('[GuideMe PiP] Input handler error:', err);
          }
        });
      }

      // Theme toggle button — switch between light and dark
      if (themeBtn) {
        themeBtn.addEventListener('click', () => {
          try {
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
            currentTheme = newTheme;
            // Persist to storage so other views sync
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({ guideme_theme: newTheme });
            }
          } catch (err) {
            console.error('[GuideMe PiP] Theme toggle error:', err);
          }
        });
      }

      // Mic button — toggle voice input
      if (micBtn) {
        micBtn.addEventListener('click', () => {
          try {
            toggleListening();
          } catch (err) {
            console.error('[GuideMe PiP] Mic button error:', err);
          }
        });
      }
    } catch (err) {
      console.error('[GuideMe PiP] setupEventHandlers failed:', err);
    }
  }

  /**
   * Send the current prompt to the active tab's content script.
   */
  function handleSend() {
    try {
      const text = input.value.trim();
      if (!text) return;

      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
          try {
            if (tab && tab.id) {
              chrome.tabs.sendMessage(tab.id, {
                action: 'START_DYNAMIC_GUIDE',
                payload: { prompt: text },
              }, () => {
                if (chrome.runtime && chrome.runtime.lastError) {
                  console.warn('[GuideMe PiP] Could not reach content script:', chrome.runtime.lastError.message);
                }
              });
            }
          } catch (err) {
            console.error('[GuideMe PiP] Tab query error:', err);
          }
        });
      }

      // Clear input after send
      input.value = '';
      if (micBtn) micBtn.style.display = '';
      if (sendBtn) sendBtn.style.display = 'none';
      input.focus();
    } catch (err) {
      console.error('[GuideMe PiP] handleSend failed:', err);
    }
  }

  /**
   * Toggle voice input (placeholder — Web Speech API can be added here).
   */
  function toggleListening() {
    try {
      isListening = !isListening;
      if (micBtn) {
        micBtn.classList.toggle('listening', isListening);
        micBtn.title = isListening ? t('stopListening', currentLang) : t('voiceInput', currentLang);
      }
      // NOTE: Web Speech API integration point — intentionally minimal for now
      // to keep the window stable. Extend here if voice is needed.
    } catch (err) {
      console.error('[GuideMe PiP] toggleListening failed:', err);
    }
  }

  // ── Bootstrap ────────────────────────────────────────────────
  // Wait for DOM to be fully ready before touching any elements.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already parsed (e.g. script loaded with defer)
    init();
  }
})();
