/**
 * GuideMe PiP — Standalone Floating Companion Window Controller.
 *
 * Features:
 *  - Conversational AI Prompt Classifier (greetings, clarifications, actionable tasks)
 *  - Active Walkthrough Controller HUD (Next, Prev, Audio Replay, End Guide)
 *  - Suggested Quick Actions (Spreadsheet walkthrough, Step capture, etc.)
 *  - Real-time Web Speech API voice input (Khmer km-KH & English en-US)
 *  - Step Capture Trigger (Element inspector on active tab)
 *  - Circular Progress Spinner during dynamic guide synthesis
 *  - Auto-growing multiline input with smooth window auto-resize
 *  - Persistent Window-on-Top focus discipline (never hides behind host page)
 *  - Live storage synchronization (theme & language)
 */

import { classifyPrompt } from '@guideme/engine';
import { createSpeechController } from './speech.js';

(function () {
  'use strict';

  // ── UI Strings ───────────────────────────────────────────────
  const UI_STRINGS = {
    askAnything: { km: 'សួរអ្វីមួយ...', en: 'Ask anything ...' },
    send: { km: 'ផ្ញើ', en: 'Send' },
    voiceInput: { km: 'បញ្ចូលសំឡេង', en: 'Voice input' },
    stopListening: { km: 'បញ្ឈប់ការស្ដាប់', en: 'Stop listening' },
    captureStep: { km: 'ជ្រើសរើសធាតុសម្រាប់ជំហាន', en: 'Capture step target' },
    activeGuide: { km: 'កំពុងណែនាំ', en: 'Guiding' },
    step: { km: 'ជំហាន', en: 'Step' },
    prev: { km: 'ថយក្រោយ', en: 'Previous step' },
    next: { km: 'បន្ទាប់', en: 'Next step' },
    replayAudio: { km: 'ស្តាប់ឡើងវិញ', en: 'Replay audio' },
    endGuide: { km: 'បញ្ចប់ការណែនាំ', en: 'End walkthrough' },
    guideStarted: { km: 'កំពុងចាប់ផ្តើមការណែនាំ...', en: 'Starting walkthrough...' },
    guideEnded: { km: 'បានបញ្ចប់ការណែនាំ!', en: 'Walkthrough ended!' },
    clickElementHint: { km: 'សូមចុចលើធាតុណាមួយលើទំព័រដើម្បីបង្កើតជំហាន...', en: 'Click any element on the page to create a step...' },
  };

  function t(key, lang) {
    const item = UI_STRINGS[key];
    if (!item) return key;
    return item[lang] || item['km'] || item['en'] || key;
  }

  // ── State ────────────────────────────────────────────────────
  let currentLang = 'km';
  let currentTheme = 'light';
  let isListening = false;
  let isProcessing = false;
  let activeGuideState = null;
  let availableTutorialsList = [];
  let speechController = null;
  let responseTimer = null;

  // ── DOM refs ─────────────────────────────────────────────────
  let root,
    input,
    micBtn,
    sendBtn,
    captureBtn,
    form,
    badgePlus,
    badgeSpinner,
    responseContainer,
    responseText,
    activeGuideContainer,
    guideTitleEl,
    guideStepTitleEl,
    guideStepCountEl,
    guidePrevBtn,
    guideNextBtn,
    guideReplayBtn,
    guideStopBtn,
    suggestionsContainer,
    suggestionsListEl;

  /**
   * Initialize the PiP window.
   */
  function init() {
    try {
      root = document.getElementById('guideme-pip-root');
      input = document.getElementById('pip-input');
      micBtn = document.getElementById('pip-mic');
      sendBtn = document.getElementById('pip-send');
      captureBtn = document.getElementById('pip-capture');
      form = document.getElementById('pip-form');
      badgePlus = document.getElementById('badge-icon-plus');
      badgeSpinner = document.getElementById('badge-spinner');
      responseContainer = document.getElementById('pip-response');
      responseText = document.getElementById('pip-response-text');

      // Active Guide HUD elements
      activeGuideContainer = document.getElementById('pip-active-guide');
      guideTitleEl = document.getElementById('pip-guide-title');
      guideStepTitleEl = document.getElementById('pip-guide-step-title');
      guideStepCountEl = document.getElementById('pip-guide-step-count');
      guidePrevBtn = document.getElementById('pip-guide-prev');
      guideNextBtn = document.getElementById('pip-guide-next');
      guideReplayBtn = document.getElementById('pip-guide-replay');
      guideStopBtn = document.getElementById('pip-guide-stop');

      // Suggestions elements
      suggestionsContainer = document.getElementById('pip-suggestions');
      suggestionsListEl = document.getElementById('pip-suggestions-list');

      if (!root || !input || !form) {
        console.error('[GuideMe PiP] Critical DOM elements missing — aborting init.');
        return;
      }

      // Load stored preferences (theme, language)
      loadPreferences();

      // Listen for live theme/language & guide updates
      setupStorageListener();
      setupRuntimeMessageListener();

      // Initialize speech controller
      speechController = createSpeechController({
        getLang: () => currentLang,
        onTranscript: (transcript) => {
          if (input) {
            input.value = transcript;
            autoGrow();
            if (micBtn) micBtn.style.display = 'none';
            if (sendBtn) sendBtn.style.display = '';
          }
        },
        onStateChange: (listening) => {
          isListening = listening;
          updateMicUi();
        },
      });

      // Wire up event handlers
      setupEventHandlers();

      // Query active guide status & available tutorials from active page
      queryInitialTutorialStatus();

      // Auto-grow calculation on mount
      autoGrow();

      // Dynamic ResizeObserver observing internal elements whose content dynamically changes
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
          recalculateWindowSize();
        });
        const wrapper = document.getElementById('pip-wrapper');
        if (wrapper) ro.observe(wrapper);
        if (responseContainer) ro.observe(responseContainer);
        if (activeGuideContainer) ro.observe(activeGuideContainer);
        if (suggestionsContainer) ro.observe(suggestionsContainer);
      }

      // Focus input and keep window in front
      ensureWindowOnTop();
      input.focus();

      console.log('[GuideMe PiP] Window initialized with full walkthrough controller.');
    } catch (err) {
      console.error('[GuideMe PiP] Init failed:', err);
    }
  }

  /**
   * Keep the PiP window on top and focused.
   */
  function ensureWindowOnTop() {
    try {
      if (typeof chrome !== 'undefined' && chrome.windows) {
        chrome.windows.getCurrent((currWin) => {
          if (currWin?.id) {
            chrome.windows.update(currWin.id, { focused: true }, () => {
              if (chrome.runtime?.lastError) { /* ignore */ }
            });
          }
        });
      }
    } catch { }
  }

  /**
   * Load theme & language from chrome.storage.local.
   */
  function loadPreferences() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(['guideme_theme', 'guideme_lang'], (result) => {
          try {
            if (chrome.runtime?.lastError) return;
            if (result?.guideme_theme) {
              currentTheme = result.guideme_theme;
              applyTheme(currentTheme);
            }
            if (result?.guideme_lang) {
              currentLang = result.guideme_lang;
              applyLanguage(currentLang);
            }
          } catch { }
        });
      }
    } catch (err) {
      console.error('[GuideMe PiP] loadPreferences failed:', err);
    }
  }

  /**
   * Listen for theme/language changes made elsewhere.
   */
  function setupStorageListener() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
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
          } catch { }
        });
      }
    } catch (err) {
      console.error('[GuideMe PiP] setupStorageListener failed:', err);
    }
  }

  /**
   * Listen for real-time tutorial state updates from content script.
   */
  function setupRuntimeMessageListener() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((message) => {
          if (!message || !message.action) return;

          // Tutorial state changed on the webpage
          if (message.action === 'GUIDEME_TUTORIAL_STATE_UPDATED') {
            const { active, currentStepIndex, totalSteps, tutorial, step } = message.payload || {};
            if (active) {
              updateActiveGuideHUD({
                active: true,
                currentStepIndex: currentStepIndex || 0,
                totalSteps: totalSteps || 1,
                name: tutorial?.name || activeGuideState?.name,
                stepTitle: step?.title,
              });
            } else {
              hideActiveGuideHUD();
            }
          }

          if (message.action === 'GUIDEME_SYNC_SESSION') {
            const session = message.payload;
            if (session?.tutorial) {
              updateActiveGuideHUD({
                active: true,
                currentStepIndex: session.currentStepIndex || 0,
                totalSteps: session.tutorial.steps?.length || 1,
                name: session.tutorial.name,
              });
            }
          }
        });
      }
    } catch (err) {
      console.error('[GuideMe PiP] setupRuntimeMessageListener failed:', err);
    }
  }

  /**
   * Query initial tutorial state and catalog guides from host webpage.
   */
  function queryInitialTutorialStatus() {
    sendMessageToActiveTab({ action: 'GUIDEME_GET_TUTORIAL_STATUS' }, (res) => {
      if (res?.success) {
        if (res.state?.isActive) {
          updateActiveGuideHUD({
            active: true,
            currentStepIndex: res.state.currentStepIndex || 0,
            totalSteps: res.state.totalSteps || 1,
            name: res.state.tutorial?.name,
            stepTitle: res.state.step?.title,
          });
        }
        if (Array.isArray(res.availableTutorials) && res.availableTutorials.length > 0) {
          availableTutorialsList = res.availableTutorials;
          renderSuggestions(availableTutorialsList);
        }
      }
    });
  }

  /**
   * Render quick action suggestion chips.
   */
  function renderSuggestions(tutorials) {
    if (!suggestionsContainer || !suggestionsListEl) return;
    try {
      suggestionsListEl.innerHTML = '';
      if (!tutorials || tutorials.length === 0) {
        suggestionsContainer.style.display = 'none';
        recalculateWindowSize();
        return;
      }

      // Add suggestions
      tutorials.slice(0, 3).forEach((tut) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'suggestion-chip';
        const name = typeof tut.name === 'object'
          ? (tut.name[currentLang] || tut.name.en || 'Guide')
          : tut.name;
        chip.textContent = `🎯 ${name}`;
        chip.addEventListener('click', () => {
          showResponseMessage(`${t('guideStarted', currentLang)} ${name}`);
          sendMessageToActiveTab({
            action: 'GUIDEME_START_TUTORIAL',
            payload: { tutorialId: tut.id },
          });
          ensureWindowOnTop();
        });
        suggestionsListEl.appendChild(chip);
      });

      suggestionsContainer.style.display = 'block';
      recalculateWindowSize();
      setTimeout(() => recalculateWindowSize(), 40);
    } catch { }
  }

  /**
   * Update and show the Active Guide HUD controller card.
   */
  function updateActiveGuideHUD(data) {
    activeGuideState = data;
    if (!activeGuideContainer) return;

    try {
      const guideName = typeof data.name === 'object'
        ? (data.name[currentLang] || data.name.en || 'GuideMe')
        : (data.name || 'GuideMe Walkthrough');

      const stepTitle = typeof data.stepTitle === 'object'
        ? (data.stepTitle[currentLang] || data.stepTitle.en || '')
        : (data.stepTitle || '');

      if (guideTitleEl) guideTitleEl.textContent = guideName;
      if (guideStepTitleEl) {
        guideStepTitleEl.textContent = stepTitle
          ? `${t('step', currentLang)} ${(data.currentStepIndex || 0) + 1}: ${stepTitle}`
          : `${t('activeGuide', currentLang)}: ${guideName}`;
      }
      if (guideStepCountEl) {
        guideStepCountEl.textContent = `${(data.currentStepIndex || 0) + 1}/${data.totalSteps || 1}`;
      }

      activeGuideContainer.style.display = 'block';
      recalculateWindowSize();
      ensureWindowOnTop();
    } catch { }
  }

  /**
   * Hide the Active Guide HUD controller card.
   */
  function hideActiveGuideHUD() {
    activeGuideState = null;
    if (activeGuideContainer) {
      activeGuideContainer.style.display = 'none';
    }
    recalculateWindowSize();
  }

  /**
   * Apply theme to document root.
   */
  function applyTheme(theme) {
    try {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch { }
  }

  /**
   * Apply language — update placeholder, titles & font family.
   */
  function applyLanguage(lang) {
    try {
      currentLang = lang;
      if (input) input.placeholder = t('askAnything', lang);
      if (captureBtn) captureBtn.title = t('captureStep', lang);
      if (micBtn) micBtn.title = isListening ? t('stopListening', lang) : t('voiceInput', lang);
      if (sendBtn) sendBtn.title = t('send', lang);
      if (guidePrevBtn) guidePrevBtn.title = t('prev', lang);
      if (guideNextBtn) guideNextBtn.title = t('next', lang);
      if (guideReplayBtn) guideReplayBtn.title = t('replayAudio', lang);
      if (guideStopBtn) guideStopBtn.title = t('endGuide', lang);

      if (document.body) {
        document.body.style.fontFamily = lang === 'km'
          ? "'Kantumruy Pro', 'Inter', sans-serif"
          : "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
      }

      if (activeGuideState) updateActiveGuideHUD(activeGuideState);
      if (availableTutorialsList.length > 0) renderSuggestions(availableTutorialsList);
    } catch { }
  }

  /**
   * Display conversational AI response message (greeting / clarification / feedback).
   */
  function showResponseMessage(message) {
    try {
      if (!responseContainer || !responseText) return;
      responseText.textContent = message;
      responseContainer.style.display = 'block';

      recalculateWindowSize();
      ensureWindowOnTop();

      if (responseTimer) clearTimeout(responseTimer);
      responseTimer = setTimeout(() => {
        hideResponseMessage();
      }, 8000);
    } catch { }
  }

  /**
   * Hide conversational AI response message.
   */
  function hideResponseMessage() {
    try {
      if (responseTimer) {
        clearTimeout(responseTimer);
        responseTimer = null;
      }
      if (responseContainer) {
        responseContainer.style.display = 'none';
      }
      recalculateWindowSize();
    } catch { }
  }

  /**
   * Toggle processing spinner state.
   */
  function setProcessing(processing) {
    isProcessing = processing;
    if (badgePlus) badgePlus.style.display = processing ? 'none' : 'block';
    if (badgeSpinner) badgeSpinner.style.display = processing ? 'flex' : 'none';
  }

  /**
   * Wire up event handlers.
   */
  function setupEventHandlers() {
    try {
      // Form submit — send prompt to active tab
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          handleSend();
        });
      }

      // Input change — auto-grow textarea & toggle mic/send button
      if (input) {
        input.addEventListener('input', () => {
          try {
            const hasText = input.value.trim().length > 0;
            if (micBtn) micBtn.style.display = hasText ? 'none' : '';
            if (sendBtn) sendBtn.style.display = hasText ? '' : 'none';
            autoGrow();
          } catch { }
        });

        // Keydown — Enter sends, Shift+Enter newlines, Escape closes
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          } else if (e.key === 'Escape') {
            try {
              window.close();
            } catch { }
          }
        });

        input.addEventListener('focus', () => ensureWindowOnTop());
      }

      // Capture button — trigger element selection on webpage
      if (captureBtn) {
        captureBtn.addEventListener('click', () => {
          try {
            showResponseMessage(t('clickElementHint', currentLang));
            sendMessageToActiveTab({ action: 'GUIDEME_START_CAPTURE_MODE' }, (res) => {
              console.log('[GuideMe PiP] Capture mode started:', res);
            });
            ensureWindowOnTop();
          } catch (err) {
            console.error('[GuideMe PiP] Capture button error:', err);
          }
        });
      }

      // Mic button — toggle real speech recognition
      if (micBtn) {
        micBtn.addEventListener('click', () => {
          try {
            speechController?.toggle();
            ensureWindowOnTop();
          } catch (err) {
            console.error('[GuideMe PiP] Mic button error:', err);
          }
        });
      }

      // Active Guide HUD Controls
      if (guidePrevBtn) {
        guidePrevBtn.addEventListener('click', () => {
          sendMessageToActiveTab({ action: 'GUIDEME_PREV_STEP' });
          ensureWindowOnTop();
        });
      }
      if (guideNextBtn) {
        guideNextBtn.addEventListener('click', () => {
          sendMessageToActiveTab({ action: 'GUIDEME_NEXT_STEP' });
          ensureWindowOnTop();
        });
      }
      if (guideReplayBtn) {
        guideReplayBtn.addEventListener('click', () => {
          sendMessageToActiveTab({ action: 'GUIDEME_REPLAY_AUDIO' });
          ensureWindowOnTop();
        });
      }
      if (guideStopBtn) {
        guideStopBtn.addEventListener('click', () => {
          sendMessageToActiveTab({ action: 'GUIDEME_STOP_TUTORIAL' });
          hideActiveGuideHUD();
          showResponseMessage(t('guideEnded', currentLang));
          ensureWindowOnTop();
        });
      }

      // Clicking anywhere in the PiP container maintains window focus
      if (root) {
        root.addEventListener('pointerdown', () => ensureWindowOnTop());
      }
    } catch (err) {
      console.error('[GuideMe PiP] setupEventHandlers failed:', err);
    }
  }

  /**
   * Auto-grow textarea smoothly as prompt length expands.
   */
  function autoGrow() {
    if (!input) return;
    try {
      input.style.height = 'auto';
      const scrollHeight = input.scrollHeight;
      const targetH = Math.max(24, Math.min(scrollHeight, 130));
      input.style.height = targetH + 'px';

      const wrapper = document.getElementById('pip-wrapper');
      const isMulti = targetH > 28;
      if (wrapper) {
        wrapper.classList.toggle('multiline', isMulti);
      }

      recalculateWindowSize();
    } catch { }
  }

  /**
   * Compute exact rendered content height from visible child modules.
   */
  function getActualContentHeight() {
    let h = 18; // Container vertical padding (8px top + 8px bottom + 2px buffer)

    // Active guide HUD if visible
    if (activeGuideContainer && activeGuideContainer.style.display !== 'none') {
      const guideH = activeGuideContainer.offsetHeight || 0;
      if (guideH > 0) h += guideH + 8;
    }

    // Response bubble if visible
    if (responseContainer && responseContainer.style.display !== 'none') {
      const respH = responseContainer.offsetHeight || 0;
      if (respH > 0) h += respH + 8;
    }

    // Main input form
    if (form) {
      h += (form.offsetHeight || 48);
    }

    // Quick action suggestions if visible
    if (suggestionsContainer && suggestionsContainer.style.display !== 'none') {
      const suggH = suggestionsContainer.offsetHeight || 0;
      if (suggH > 0) h += suggH + 6;
    }

    return h;
  }

  /**
   * Recalculate and smoothly adjust window height dynamically to fit all content.
   */
  function recalculateWindowSize() {
    try {
      if (typeof window === 'undefined' || typeof window.resizeTo !== 'function') return;

      const contentH = getActualContentHeight();
      const frameOverhead = Math.max(28, Math.min(60, window.outerHeight - window.innerHeight));
      const targetWindowH = Math.min(420, Math.max(90, Math.ceil(contentH + frameOverhead)));

      if (Math.abs(window.outerHeight - targetWindowH) > 2) {
        window.resizeTo(window.outerWidth, targetWindowH);
      }
    } catch { }
  }

  /**
   * Send the prompt to the active webpage tab in the main browser window.
   */
  function handleSend() {
    try {
      const text = input.value.trim();
      if (!text) return;

      // 1. Classify prompt (greeting / unclear / actionable)
      const classification = classifyPrompt(text);

      if (classification.type === 'greeting' || classification.type === 'unclear') {
        const reply = classification.responses[currentLang] || classification.responses.en;
        showResponseMessage(reply);
        input.value = '';
        if (micBtn) micBtn.style.display = '';
        if (sendBtn) sendBtn.style.display = 'none';
        autoGrow();
        ensureWindowOnTop();
        return;
      }

      // 2. Check if text matches an existing available catalog tutorial
      const lower = text.toLowerCase();
      const matchedCatalog = availableTutorialsList.find((tut) => {
        const kmName = (tut.name?.km || '').toLowerCase();
        const enName = (tut.name?.en || '').toLowerCase();
        return lower.includes(kmName) || lower.includes(enName) || kmName.includes(lower) || enName.includes(lower);
      });

      if (matchedCatalog) {
        const matchedTitle = matchedCatalog.name?.[currentLang] || matchedCatalog.name?.en || 'Guide';
        showResponseMessage(`${t('guideStarted', currentLang)} ${matchedTitle}`);
        sendMessageToActiveTab({
          action: 'GUIDEME_START_TUTORIAL',
          payload: { tutorialId: matchedCatalog.id },
        });
        finishSend(text);
        return;
      }

      // 3. Actionable prompt → Start dynamic guide generation
      hideResponseMessage();
      setProcessing(true);
      showResponseMessage(t('guideStarted', currentLang));

      sendMessageToActiveTab(
        {
          action: 'GUIDEME_START_DYNAMIC_GUIDE',
          payload: { prompt: text },
        },
        (res) => {
          setProcessing(false);
          console.log('[GuideMe PiP] Dynamic guide response:', res);
          if (res && res.success === false && res.error) {
            showResponseMessage(res.error);
          }
          ensureWindowOnTop();
        }
      );

      finishSend(text);
    } catch (err) {
      console.error('[GuideMe PiP] handleSend failed:', err);
      setProcessing(false);
    }
  }

  function finishSend(text) {
    // Save prompt to history in chrome.storage.local
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['guideme_prompt_history'], (res) => {
        const prevHistory = res?.guideme_prompt_history || [];
        const updated = [text, ...prevHistory.filter((h) => h !== text)].slice(0, 20);
        chrome.storage.local.set({ guideme_prompt_history: updated });
      });
    }

    // Clear input and collapse window
    input.value = '';
    if (micBtn) micBtn.style.display = '';
    if (sendBtn) sendBtn.style.display = 'none';
    autoGrow();
    input.focus();
    ensureWindowOnTop();
  }

  /**
   * Helper: Send message to the active webpage tab in the main browser window.
   * NOTE: Never steals focus away from PiP so PiP stays on top!
   */
  function sendMessageToActiveTab(messagePayload, callback) {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.windows) return;

    try {
      chrome.storage?.local?.get(['guideme_target_tab_id', 'guideme_target_window_id'], (res) => {
        const storedTabId = res?.guideme_target_tab_id;
        const storedWinId = res?.guideme_target_window_id;

        const deliver = (targetTabId) => {
          if (!targetTabId) {
            console.warn('[GuideMe PiP] No target webpage tab found to receive message.');
            if (callback) callback({ success: false, error: 'No active tab' });
            return;
          }

          chrome.tabs.sendMessage(targetTabId, messagePayload, (response) => {
            if (chrome.runtime?.lastError) {
              console.warn('[GuideMe PiP] Content script unreachable:', chrome.runtime.lastError.message);
            }
            // Preserve PiP window focus on top!
            ensureWindowOnTop();
            if (callback) callback(response);
          });
        };

        if (storedTabId) {
          chrome.tabs.get(storedTabId, (tab) => {
            if (!chrome.runtime?.lastError && tab?.id && !tab.url?.startsWith('chrome-extension://')) {
              deliver(tab.id);
            } else {
              queryFallbackTab(deliver);
            }
          });
        } else {
          queryFallbackTab(deliver);
        }
      });
    } catch (err) {
      console.error('[GuideMe PiP] sendMessageToActiveTab error:', err);
      if (callback) callback({ success: false, error: err?.message });
    }
  }

  function queryFallbackTab(deliver) {
    chrome.windows.getCurrent((currWin) => {
      chrome.tabs.query({ active: true }, (tabs) => {
        try {
          const targetTab = tabs?.find(
            (t) => t.windowId !== currWin?.id && !t.url?.startsWith('chrome-extension://')
          );
          deliver(targetTab?.id);
        } catch (err) {
          console.error('[GuideMe PiP] queryFallbackTab error:', err);
          deliver(null);
        }
      });
    });
  }

  function updateMicUi() {
    if (micBtn) {
      micBtn.classList.toggle('listening', isListening);
      micBtn.title = isListening ? t('stopListening', currentLang) : t('voiceInput', currentLang);
    }
  }

  // ── Bootstrap ────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
