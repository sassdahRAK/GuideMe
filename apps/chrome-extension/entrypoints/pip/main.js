/**
 * GuideMe PiP — Floating Companion Window Controller.
 *
 * Features:
 *  - Conversational AI synced across Popup and PiP via shared storage (`guideme_chat_messages`)
 *  - Dynamic Intent Routing: AI triggers DOM analysis and step-by-step guidance on host tab
 *  - Active Walkthrough Controller HUD (Next, Prev, Audio Replay, End Guide)
 *  - Suggested Quick Actions / Catalog Guides
 *  - Real-time Web Speech API voice input (Khmer km-KH & English en-US)
 *  - Step Capture Trigger (Element inspector on active tab)
 *  - Circular Progress Spinner during dynamic guide synthesis
 *  - Auto-growing multiline input with smooth window auto-resize (Windows clipping prevention)
 *  - Persistent Window-on-Top focus discipline
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
    errorConnecting: { km: 'មានបញ្ហាក្នុងការតភ្ជាប់ទៅកាន់ AI', en: 'Error connecting to AI' },
  };

  function t(key, lang) {
    const item = UI_STRINGS[key];
    if (!item) return key;
    return item[lang] || item['km'] || item['en'] || key;
  }

  function nowTime(lang) {
    return new Date().toLocaleTimeString(lang === 'km' ? 'km-KH' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ── State ────────────────────────────────────────────────────
  let currentLang = 'km';
  let currentTheme = 'light';
  let isListening = false;
  let isProcessing = false;
  let activeGuideState = null;
  let availableTutorialsList = [];
  let speechController = null;

  // ── DOM refs ─────────────────────────────────────────────────
  let root,
    input,
    micBtn,
    sendBtn,
    captureBtn,
    form,
    badgePlus,
    badgeSpinner,
    chatHistoryContainer,
    chatMessagesList,
    activeGuideContainer,
    guideTitleEl,
    guideStepTitleEl,
    guideStepCountEl,
    guidePrevBtn,
    guideNextBtn,
    guideReplayBtn,
    guideMuteBtn,
    guideVolumeSlider,
    iconVol,
    iconMute,
    guideStopBtn,
    suggestionsContainer,
    suggestionsListEl;

  let isAudioMuted = false;
  let audioVolume = 1.0;

  /**
   * Initialize the PiP window.
   */
  async function init() {
    try {
      root = document.getElementById('guideme-pip-root');
      input = document.getElementById('pip-input');
      micBtn = document.getElementById('pip-mic');
      sendBtn = document.getElementById('pip-send');
      captureBtn = document.getElementById('pip-capture');
      form = document.getElementById('pip-form');
      badgePlus = document.getElementById('badge-icon-plus');
      badgeSpinner = document.getElementById('badge-spinner');

      // Chat history container
      chatHistoryContainer = document.getElementById('pip-chat-history');
      chatMessagesList = document.getElementById('pip-chat-messages');

      // Active Guide HUD elements
      activeGuideContainer = document.getElementById('pip-active-guide');
      guideTitleEl = document.getElementById('pip-guide-title');
      guideStepTitleEl = document.getElementById('pip-guide-step-title');
      guideStepCountEl = document.getElementById('pip-guide-step-count');
      guidePrevBtn = document.getElementById('pip-guide-prev');
      guideNextBtn = document.getElementById('pip-guide-next');
      guideReplayBtn = document.getElementById('pip-guide-replay');
      guideMuteBtn = document.getElementById('pip-guide-mute');
      guideVolumeSlider = document.getElementById('pip-guide-volume');
      iconVol = document.getElementById('pip-icon-vol');
      iconMute = document.getElementById('pip-icon-mute');
      guideStopBtn = document.getElementById('pip-guide-stop');

      // Suggestions elements
      suggestionsContainer = document.getElementById('pip-suggestions');
      suggestionsListEl = document.getElementById('pip-suggestions-list');

      if (!root || !input || !form) {
        console.error('[GuideMe PiP] Critical DOM elements missing — aborting init.');
        return;
      }

      // Restore stored preferences, chat history, and active guide state
      if (typeof chrome !== 'undefined') {
        const localData = chrome.storage?.local
          ? await chrome.storage.local.get([
              'guideme_theme',
              'guideme_lang',
              'guideme_chat_messages',
              'guideme_active_guide_state',
              'guideme_active_tutorial_session',
            ])
          : {};

        let sessionData = {};
        if (chrome.storage?.session) {
          try {
            sessionData = await chrome.storage.session.get([
              'guideme_active_guide_state',
              'guideme_active_tutorial_session',
            ]);
          } catch {}
        }

        const res = { ...localData, ...sessionData };

        if (res.guideme_theme) {
          currentTheme = res.guideme_theme;
          applyTheme(currentTheme);
        }
        if (res.guideme_lang) {
          currentLang = res.guideme_lang;
          applyLanguage(currentLang);
        }
        if (Array.isArray(res.guideme_chat_messages) && res.guideme_chat_messages.length > 0) {
          renderChatMessages(res.guideme_chat_messages);
        }

        // Restore active guide state if one was active when PiP was closed or reopened
        const activeState = res.guideme_active_guide_state || res.guideme_active_tutorial_session;
        if (activeState && (activeState.active || activeState.tutorial)) {
          const stepTitle = activeState.step?.title || activeState.stepTitle || '';
          updateActiveGuideHUD({
            active: true,
            currentStepIndex: activeState.currentStepIndex || 0,
            totalSteps: activeState.totalSteps || activeState.tutorial?.steps?.length || 1,
            name: activeState.tutorial?.name || activeState.name,
            stepTitle,
          });
        }
      }

      // Listen for live theme/language, chat history & guide updates
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

      // Dynamic ResizeObserver to prevent window clipping on OS title bars / borders
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => {
          recalculateWindowSize();
        });
        const wrapper = document.getElementById('pip-wrapper');
        if (wrapper) ro.observe(wrapper);
        if (chatHistoryContainer) ro.observe(chatHistoryContainer);
        if (activeGuideContainer) ro.observe(activeGuideContainer);
        if (suggestionsContainer) ro.observe(suggestionsContainer);
      }

      ensureWindowOnTop();
      input.focus();

      console.log('[GuideMe PiP] Window initialized with unified chat and guide controller.');
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
   * Retrieve chat messages from storage.
   */
  function getStoredChatMessages() {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        resolve([]);
        return;
      }
      chrome.storage.local.get(['guideme_chat_messages'], (res) => {
        resolve(res?.guideme_chat_messages || []);
      });
    });
  }

  /**
   * Save chat messages to storage.
   */
  function saveStoredChatMessages(messages) {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ guideme_chat_messages: messages });
    }
  }

  /**
   * Render chat history list.
   */
  function renderChatMessages(messages) {
    if (!chatHistoryContainer || !chatMessagesList) return;

    if (!messages || messages.length === 0) {
      chatHistoryContainer.style.display = 'none';
      chatMessagesList.innerHTML = '';
      recalculateWindowSize();
      return;
    }

    chatHistoryContainer.style.display = 'flex';
    chatMessagesList.innerHTML = '';

    messages.forEach((msg) => {
      const bubble = document.createElement('div');
      const isUser = msg.role === 'user';
      bubble.className = `chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}`;
      bubble.textContent = msg.content || '';
      chatMessagesList.appendChild(bubble);
    });

    // Scroll chat to newest message
    chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
    recalculateWindowSize();
  }

  /**
   * Append a user message to shared chat history.
   */
  async function appendUserMessage(text) {
    const messages = await getStoredChatMessages();
    const updated = [...messages, { role: 'user', content: text, time: nowTime(currentLang) }];
    saveStoredChatMessages(updated);
    renderChatMessages(updated);
  }

  /**
   * Append an assistant message to shared chat history.
   */
  async function appendAiMessage(text) {
    const messages = await getStoredChatMessages();
    const updated = [...messages, { role: 'assistant', content: text, time: nowTime(currentLang) }];
    saveStoredChatMessages(updated);
    renderChatMessages(updated);
  }

  /**
   * Listen for theme/language/chat changes made elsewhere (e.g. in Popup).
   */
  function setupStorageListener() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
          if (areaName !== 'local' && areaName !== 'session') return;
          if (changes.guideme_theme) {
            currentTheme = changes.guideme_theme.newValue;
            applyTheme(currentTheme);
          }
          if (changes.guideme_lang) {
            currentLang = changes.guideme_lang.newValue;
            applyLanguage(currentLang);
          }
          if (changes.guideme_chat_messages) {
            renderChatMessages(changes.guideme_chat_messages.newValue || []);
          }
          if (changes.guideme_active_guide_state || changes.guideme_active_tutorial_session) {
            const newState = (changes.guideme_active_guide_state || changes.guideme_active_tutorial_session)?.newValue;
            if (newState && (newState.active || newState.tutorial)) {
              updateActiveGuideHUD({
                active: true,
                currentStepIndex: newState.currentStepIndex || 0,
                totalSteps: newState.totalSteps || newState.tutorial?.steps?.length || 1,
                name: newState.tutorial?.name || newState.name,
                stepTitle: newState.step?.title || newState.stepTitle || '',
              });
            } else {
              hideActiveGuideHUD();
            }
          }
        });
      }
    } catch (err) {
      console.error('[GuideMe PiP] setupStorageListener failed:', err);
    }
  }

  /**
   * Listen for real-time tutorial state updates and step progress from content script.
   */
  function setupRuntimeMessageListener() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((message) => {
          if (!message || !message.action) return;

          // 1. General state update
          if (
            message.action === 'GUIDEME_TUTORIAL_STATE_UPDATED' ||
            message.action === 'TUTORIAL_STATE_UPDATED'
          ) {
            const { active, currentStepIndex, totalSteps, tutorial, step } = message.payload || {};
            if (active) {
              const stepTitle = step?.action?.title || step?.title || '';
              updateActiveGuideHUD({
                active: true,
                currentStepIndex: currentStepIndex || 0,
                totalSteps: totalSteps || 1,
                name: tutorial?.name || activeGuideState?.name,
                stepTitle,
              });
            } else {
              hideActiveGuideHUD();
            }
          }

          // 2. Realtime Step Progress: Step Advanced
          if (
            message.action === 'TUTORIAL_STEP_ADVANCED' ||
            message.action === 'GUIDEME_TUTORIAL_STEP_ADVANCED'
          ) {
            const { currentStepIndex, totalSteps, tutorial, step } = message.payload || {};
            const stepTitle = step?.action?.title || step?.title || '';
            updateActiveGuideHUD({
              active: true,
              currentStepIndex: currentStepIndex || 0,
              totalSteps: totalSteps || 1,
              name: tutorial?.name || activeGuideState?.name,
              stepTitle,
            });
          }

          // 3. Realtime Step Progress: Tutorial Completed
          if (
            message.action === 'TUTORIAL_COMPLETED' ||
            message.action === 'GUIDEME_TUTORIAL_COMPLETED'
          ) {
            hideActiveGuideHUD();
            appendAiMessage(t('guideEnded', currentLang));
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
          const step = res.state.currentStep || res.state.step;
          const stepTitle = step?.action?.title || step?.title || '';
          updateActiveGuideHUD({
            active: true,
            currentStepIndex: res.state.currentStepIndex || 0,
            totalSteps: res.state.totalSteps || 1,
            name: res.state.tutorial?.name,
            stepTitle: stepTitle,
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

      tutorials.slice(0, 3).forEach((tut) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'suggestion-chip';
        const name = typeof tut.name === 'object'
          ? (tut.name[currentLang] || tut.name.en || 'Guide')
          : tut.name;
        chip.textContent = `🎯 ${name}`;
        chip.addEventListener('click', () => {
          appendAiMessage(`${t('guideStarted', currentLang)} ${name}`);
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

      if (data.isMuted !== undefined) {
        updateMuteUI(data.isMuted);
      }
      if (data.volume !== undefined && guideVolumeSlider) {
        guideVolumeSlider.value = data.volume;
        guideVolumeSlider.title = `Volume: ${Math.round(data.volume * 100)}%`;
      }

      activeGuideContainer.style.display = 'block';
      recalculateWindowSize();
      ensureWindowOnTop();
    } catch { }
  }

  /**
   * Update mute icon and class in PiP HUD.
   */
  function updateMuteUI(muted) {
    isAudioMuted = Boolean(muted);
    if (guideMuteBtn) {
      guideMuteBtn.classList.toggle('muted', isAudioMuted);
      guideMuteBtn.title = isAudioMuted ? 'Unmute audio' : 'Mute audio';
    }
    if (iconVol) iconVol.style.display = isAudioMuted ? 'none' : 'block';
    if (iconMute) iconMute.style.display = isAudioMuted ? 'block' : 'none';
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
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          handleSend();
        });
      }

      if (input) {
        input.addEventListener('input', () => {
          try {
            const hasText = input.value.trim().length > 0;
            if (micBtn) micBtn.style.display = hasText ? 'none' : '';
            if (sendBtn) sendBtn.style.display = hasText ? '' : 'none';
            autoGrow();
          } catch { }
        });

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          } else if (e.key === 'Escape') {
            try { window.close(); } catch { }
          }
        });
        input.addEventListener('focus', () => ensureWindowOnTop());
      }

      if (captureBtn) {
        captureBtn.addEventListener('click', () => {
          appendAiMessage(t('clickElementHint', currentLang));
          sendMessageToActiveTab({ action: 'GUIDEME_START_CAPTURE_MODE' });
          ensureWindowOnTop();
        });
      }

      if (micBtn) {
        micBtn.addEventListener('click', () => {
          speechController?.toggle();
          ensureWindowOnTop();
        });
      }

      if (guidePrevBtn) guidePrevBtn.addEventListener('click', () => sendMessageToActiveTab({ action: 'GUIDEME_PREV_STEP' }));
      if (guideNextBtn) guideNextBtn.addEventListener('click', () => sendMessageToActiveTab({ action: 'GUIDEME_NEXT_STEP' }));
      if (guideReplayBtn) guideReplayBtn.addEventListener('click', () => sendMessageToActiveTab({ action: 'GUIDEME_REPLAY_AUDIO' }));
      if (guideMuteBtn) {
        guideMuteBtn.addEventListener('click', () => {
          isAudioMuted = !isAudioMuted;
          updateMuteUI(isAudioMuted);
          sendMessageToActiveTab({ action: 'GUIDEME_TOGGLE_MUTE', payload: { muted: isAudioMuted } });
        });
      }
      if (guideVolumeSlider) {
        guideVolumeSlider.addEventListener('input', (e) => {
          const vol = parseFloat(e.target.value);
          audioVolume = vol;
          if (isAudioMuted && vol > 0) {
            isAudioMuted = false;
            updateMuteUI(false);
          }
          guideVolumeSlider.title = `Volume: ${Math.round(vol * 100)}%`;
          sendMessageToActiveTab({ action: 'GUIDEME_SET_VOLUME', payload: { volume: vol } });
        });
      }
      if (guideStopBtn) {
        guideStopBtn.addEventListener('click', () => {
          sendMessageToActiveTab({ action: 'GUIDEME_STOP_TUTORIAL' });
          hideActiveGuideHUD();
          appendAiMessage(t('guideEnded', currentLang));
        });
      }

      if (root) root.addEventListener('pointerdown', () => ensureWindowOnTop());
    } catch (err) {
      console.error('[GuideMe PiP] setupEventHandlers failed:', err);
    }
  }

  /**
   * Auto-grow textarea smoothly.
   */
  function autoGrow() {
    if (!input) return;
    try {
      input.style.height = 'auto';
      const scrollHeight = input.scrollHeight;
      const targetH = Math.max(24, Math.min(scrollHeight, 130));
      input.style.height = targetH + 'px';

      const wrapper = document.getElementById('pip-wrapper');
      if (wrapper) {
        wrapper.classList.toggle('multiline', targetH > 32);
      }
    } catch { }
  }

  /**
   * Recalculate and adjust window height dynamically to fit all content.
   * Fixes clipping on Windows & macOS OS window frames.
   */
  function recalculateWindowSize() {
    try {
      requestAnimationFrame(() => {
        const rootEl = document.documentElement;
        const bodyEl = document.body;
        const scrollH = Math.max(rootEl ? rootEl.scrollHeight : 0, bodyEl ? bodyEl.scrollHeight : 0);
        const targetH = Math.min(600, Math.max(160, scrollH + 24));

        if (typeof chrome !== 'undefined' && chrome.windows) {
          chrome.windows.getCurrent((currWin) => {
            if (currWin?.id && Math.abs((currWin.height || 0) - targetH) > 8) {
              chrome.windows.update(currWin.id, { height: targetH }, () => {
                if (chrome.runtime?.lastError) { /* ignore */ }
              });
            }
          });
        } else if (typeof window !== 'undefined' && typeof window.resizeTo === 'function') {
          window.resizeTo(window.outerWidth || 550, targetH);
        }
      });
    } catch { }
  }

  /**
   * Send the prompt to the backend AI and active webpage tab in the main browser window.
   */
  async function handleSend() {
    try {
      const text = input.value.trim();
      if (!text) return;

      appendUserMessage(text);
      finishSend(text);
      setProcessing(true);

      const classification = classifyPrompt(text);

      if (classification.type === 'greeting') {
        const reply = classification.responses[currentLang] || classification.responses.en;
        appendAiMessage(reply);
        setProcessing(false);
        ensureWindowOnTop();
        return;
      }

      if (classification.type === 'unclear') {
        const reply = classification.responses[currentLang] || classification.responses.en;
        appendAiMessage(reply);
        setProcessing(false);
        ensureWindowOnTop();
        return;
      }

      // Query Backend AI for reasoning and dynamic guide triggering
      let aiResponded = false;
      const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development';
      const defaultProdUrl = 'https://guideme-lac.vercel.app';
      const baseUrl = import.meta.env.WXT_API_URL || (isDev ? 'http://localhost:4000' : defaultProdUrl);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/ai/assistant-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: text, language: currentLang }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const reply = data.answer || data.message;
          if (reply) {
            appendAiMessage(reply);
            aiResponded = true;

            if (data.triggerGuide) {
              const intentPrompt = data.intentPrompt || text;
              sendMessageToActiveTab(
                {
                  action: 'GUIDEME_START_DYNAMIC_GUIDE',
                  payload: { prompt: intentPrompt },
                },
                (bridgeRes) => {
                  console.log('[GuideMe PiP] Dynamic guide started:', bridgeRes);
                }
              );
            }
          }
        }
      } catch (backendErr) {
        console.warn('[GuideMe PiP] Backend AI unreachable, executing on-page guide fallback:', backendErr);
      }

      // If backend was offline or unreachable, execute resilient on-page guide fallback
      if (!aiResponded) {
        if (classification.type === 'actionable') {
          const startingMsg = currentLang === 'km'
            ? 'ខ្ញុំយល់ហើយ! កំពុងចាប់ផ្តើមការណែនាំជាជំហានៗលើទំព័រនេះ...'
            : "Got it! Starting a step-by-step walkthrough on this page...";
          appendAiMessage(startingMsg);

          sendMessageToActiveTab(
            {
              action: 'GUIDEME_START_DYNAMIC_GUIDE',
              payload: { prompt: text },
            },
            (bridgeRes) => {
              console.log('[GuideMe PiP] Dynamic guide started via fallback:', bridgeRes);
            }
          );
        } else {
          const fallbackReply = classification.responses?.[currentLang] || classification.responses?.en || "Hello! How can I help you on this page?";
          appendAiMessage(fallbackReply);
        }
      }
    } catch (err) {
      console.error('[GuideMe PiP] handleSend failed:', err);
      if (classification.type === 'actionable') {
        sendMessageToActiveTab({
          action: 'GUIDEME_START_DYNAMIC_GUIDE',
          payload: { prompt: text },
        });
      }
    } finally {
      setProcessing(false);
      ensureWindowOnTop();
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

    // Clear input and collapse height
    input.value = '';
    if (micBtn) micBtn.style.display = '';
    if (sendBtn) sendBtn.style.display = 'none';
    autoGrow();
    input.focus();
    ensureWindowOnTop();
  }

  /**
   * Helper: Send message to the active webpage tab in the main browser window.
   */
  function sendMessageToActiveTab(messagePayload, callback) {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    try {
      chrome.storage?.local?.get(['guideme_target_tab_id', 'guideme_target_window_id'], (res) => {
        const storedTabId = res?.guideme_target_tab_id;

        const deliver = (targetTabId) => {
          if (!targetTabId) {
            queryFallbackTab((fbId) => {
              if (fbId) sendDirect(fbId);
              else if (callback) callback({ success: false, error: 'No active tab' });
            });
            return;
          }
          sendDirect(targetTabId);
        };

        const sendDirect = (tabId) => {
          chrome.tabs.sendMessage(tabId, messagePayload, (response) => {
            if (chrome.runtime?.lastError) {
              console.warn('[GuideMe PiP] Content script unreachable on tab', tabId, chrome.runtime.lastError.message);
              // Auto-inject content script if tab was opened before extension reload
              if (chrome.scripting?.executeScript) {
                chrome.scripting.executeScript({
                  target: { tabId },
                  files: ['content-scripts/content.js'],
                }).then(() => {
                  setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, messagePayload, (retryRes) => {
                      ensureWindowOnTop();
                      if (callback) callback(retryRes);
                    });
                  }, 200);
                }).catch(() => {
                  ensureWindowOnTop();
                  if (callback) callback({ success: false });
                });
                return;
              }
            }
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
    chrome.tabs.query({}, (tabs) => {
      try {
        const targetTab = tabs?.find(
          (t) => t.active && !t.url?.startsWith('chrome-extension://') && !t.url?.startsWith('chrome://')
        ) || tabs?.find(
          (t) => !t.url?.startsWith('chrome-extension://') && !t.url?.startsWith('chrome://')
        );
        deliver(targetTab?.id);
      } catch (err) {
        console.error('[GuideMe PiP] queryFallbackTab error:', err);
        deliver(null);
      }
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
