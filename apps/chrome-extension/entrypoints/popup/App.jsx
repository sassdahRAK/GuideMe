import React, { useEffect, useState } from 'react';
import { ExtensionMessageAction, Language } from '@guideme/core-types';
import { LanguageToggle } from '@guideme/tutorial-ui';
import { TUTORIAL_CATALOG, getTutorialsForUrl } from '../../src/catalog.js';

/**
 * Safely resolves localized string or object for the popup UI.
 */
function resolveText(val, lang = Language.KM) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val[lang] || val[Language.KM] || val[Language.EN] || Object.values(val)[0] || '';
  }
  return String(val);
}

export default function App() {
  const [currentTab, setCurrentTab] = useState(null);
  const [engineState, setEngineState] = useState(null);
  const [availableTutorials, setAvailableTutorials] = useState(() => getTutorialsForUrl(''));
  const [customPrompt, setCustomPrompt] = useState('');
  const [contentScriptConnected, setContentScriptConnected] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(Language.KM);
  const [loading, setLoading] = useState(true);

  const currentUrl = currentTab?.url || '';
  const isChromeInternalUrl = currentUrl.startsWith('chrome://') || currentUrl.startsWith('edge://') || currentUrl.startsWith('about:');
  const isExtensionUrl = currentUrl.startsWith('chrome-extension://');

  // Query active tab and request current tutorial status
  useEffect(() => {
    async function initPopup() {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        setCurrentTab(tab);

        const url = tab?.url || '';
        const categorized = getTutorialsForUrl(url);
        setAvailableTutorials(categorized);

        if (tab?.id && !isChromeInternalUrl) {
          chrome.tabs.sendMessage(
            tab.id,
            { action: ExtensionMessageAction.GET_TUTORIAL_STATUS },
            (response) => {
              if (chrome.runtime.lastError) {
                setContentScriptConnected(false);
              } else if (response?.success) {
                setContentScriptConnected(true);
                setEngineState(response.state);
                if (response.state?.language) {
                  setCurrentLanguage(response.state.language);
                }
              }
              setLoading(false);
            }
          );
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('[GuideMe Popup] Initialization error:', err);
        setLoading(false);
      }
    }

    initPopup();
  }, []);

  const handleLanguageChange = (newLang) => {
    setCurrentLanguage(newLang);
    if (currentTab?.id && !isChromeInternalUrl) {
      chrome.tabs.sendMessage(
        currentTab.id,
        { action: ExtensionMessageAction.SET_LANGUAGE, payload: { language: newLang } },
        () => {}
      );
    }
  };

  const handleStartTutorial = async (tutorialId) => {
    if (!currentTab?.id) return;

    const startMsg = {
      action: ExtensionMessageAction.START_TUTORIAL,
      payload: { tutorialId },
    };

    if (isExtensionUrl) {
      chrome.tabs.sendMessage(currentTab.id, startMsg, () => {
        window.close();
      });
      return;
    }

    chrome.tabs.sendMessage(currentTab.id, startMsg, async (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        try {
          if (chrome.scripting?.executeScript) {
            await chrome.scripting.executeScript({
              target: { tabId: currentTab.id },
              files: ['content-scripts/content.js'],
            });
            setTimeout(() => {
              chrome.tabs.sendMessage(currentTab.id, startMsg, () => {
                window.close();
              });
            }, 120);
            return;
          }
        } catch (e) {
          console.warn('Could not inject content script:', e);
        }
      }
      window.close();
    });
  };

  const handleStartDynamicGuide = async (promptOverride = null) => {
    if (!currentTab?.id || isChromeInternalUrl) return;

    const promptText = typeof promptOverride === 'string' ? promptOverride : customPrompt;
    const dynamicMsg = {
      action: ExtensionMessageAction.START_DYNAMIC_GUIDE,
      payload: { userPrompt: promptText },
    };

    chrome.tabs.sendMessage(currentTab.id, dynamicMsg, async (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        try {
          if (chrome.scripting?.executeScript) {
            await chrome.scripting.executeScript({
              target: { tabId: currentTab.id },
              files: ['content-scripts/content.js'],
            });
            setTimeout(() => {
              chrome.tabs.sendMessage(currentTab.id, dynamicMsg, () => {
                window.close();
              });
            }, 120);
            return;
          }
        } catch (e) {
          console.warn('Could not inject content script for dynamic guide:', e);
        }
      }
      window.close();
    });
  };

  const handleStopTutorial = () => {
    if (!currentTab?.id) return;

    chrome.tabs.sendMessage(
      currentTab.id,
      { action: ExtensionMessageAction.STOP_TUTORIAL },
      () => {
        setEngineState(null);
      }
    );
  };

  const handleOpenDemoTestbed = () => {
    const demoUrl = chrome.runtime.getURL('test-demo.html');
    chrome.tabs.create({ url: demoUrl });
    window.close();
  };

  const handleOpenGoogleDocs = () => {
    chrome.tabs.create({ url: 'https://docs.google.com/document/create' });
    window.close();
  };

  const hostnameDisplay = (() => {
    if (!currentUrl) return 'Unknown';
    if (isExtensionUrl) return 'Local Demo Testbed';
    if (isChromeInternalUrl) return 'Browser Page (Restricted)';
    try {
      return new URL(currentUrl).hostname;
    } catch {
      return currentUrl;
    }
  })();

  const isKhmer = currentLanguage === Language.KM;

  return (
    <div
      style={{
        padding: '16px',
        boxSizing: 'border-box',
        minWidth: '350px',
        backgroundColor: '#12141a',
        color: '#f8fafc',
        fontFamily: isKhmer
          ? "'Kantumruy Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '15px',
              color: '#000000',
              boxShadow: '0 2px 10px rgba(245, 158, 11, 0.4)',
            }}
          >
            G
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>GuideMe</h3>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              {isKhmer ? 'ជំនួយការណែនាំឆ្លាតវៃ' : 'Universal Tutorial Engine'}
            </span>
          </div>
        </div>

        {/* Language Toggle in Header */}
        <LanguageToggle
          currentLanguage={currentLanguage}
          onChange={handleLanguageChange}
        />
      </div>

      {/* Target Page Info Banner */}
      <div
        style={{
          backgroundColor: '#181b22',
          border: '1px solid #2a2f3b',
          borderRadius: '8px',
          padding: '10px 12px',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
            {isKhmer ? 'ទំព័របច្ចុប្បន្ន (ACTIVE PAGE)' : 'ACTIVE CONTEXT'}
          </span>
          <span style={{ fontSize: '10px', color: contentScriptConnected || isExtensionUrl ? '#10b981' : '#f59e0b' }}>
            ● {contentScriptConnected || isExtensionUrl ? (isKhmer ? 'រួចរាល់' : 'Ready') : (isKhmer ? 'រង់ចាំ' : 'Standby')}
          </span>
        </div>
        <div style={{ color: '#ffffff', fontWeight: 600, marginTop: '3px', fontSize: '12px', wordBreak: 'break-all' }}>
          {hostnameDisplay}
        </div>
      </div>

      {/* Custom Prompt Input Guide */}
      {!isChromeInternalUrl && (
        <div
          style={{
            backgroundColor: '#181b22',
            border: '1px solid #2a2f3b',
            borderRadius: '10px',
            padding: '12px',
            marginBottom: '14px',
          }}
        >
          <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.04em' }}>
            💬 Prompt-to-Guide Anywhere
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
            Type what you want to do on this page (or paste JSON steps):
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleStartDynamicGuide(customPrompt);
            }}
          >
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. search, fill email, click share..."
                style={{
                  flex: 1,
                  backgroundColor: '#12141a',
                  border: '1px solid #3e4556',
                  borderRadius: '6px',
                  color: '#ffffff',
                  padding: '7px 10px',
                  fontSize: '11px',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  backgroundColor: '#f59e0b',
                  border: 'none',
                  color: '#000000',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Guide Me
              </button>
            </div>
          </form>

          <button
            onClick={() => handleStartDynamicGuide('')}
            style={{
              width: '100%',
              backgroundColor: '#262b35',
              border: '1px solid #3e4556',
              color: '#cbd5e1',
              padding: '7px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>⚡</span>
            <span>{isKhmer ? 'ចាប់ផ្តើមស្កេនទំព័រនេះដោយស្វ័យប្រវត្តិ' : 'Auto-Guide This Page'}</span>
          </button>
          <div style={{ textAlign: 'center', fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
            {isKhmer ? 'វិភាគទម្រង់ ប៊ូតុង និងម៉ឺនុយលើទំព័រភ្លាមៗ' : 'Dynamically scans forms, buttons & navigation'}
          </div>
        </div>
      )}

      {/* Active Guide State Banner */}
      {engineState?.isActive && (
        <div
          style={{
            backgroundColor: '#181b22',
            border: '1px solid #f59e0b',
            borderRadius: '10px',
            padding: '12px',
            marginBottom: '14px',
            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.15)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 800, letterSpacing: '0.04em' }}>
              ● {isKhmer ? 'កំពុងដំណើរការមេរៀន' : 'ACTIVE WALKTHROUGH'}
            </span>
            <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>
              {engineState.stepBadgeText || `${engineState.currentStepIndex + 1}/${engineState.totalSteps}`}
            </span>
          </div>

          <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
            {resolveText(engineState.tutorial?.name, currentLanguage) || (isKhmer ? 'កំពុងដំណើរការ' : 'In Progress')}
          </div>

          {engineState.currentStep?.title && (
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px' }}>
              {resolveText(engineState.currentStep.title, currentLanguage)}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => window.close()}
              style={{
                flex: 1,
                backgroundColor: '#f59e0b',
                border: 'none',
                color: '#000000',
                padding: '7px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)',
              }}
            >
              {isKhmer ? 'បន្តការណែនាំ' : 'Resume Focus'}
            </button>
            <button
              onClick={handleStopTutorial}
              style={{
                backgroundColor: '#262b35',
                border: '1px solid #ef4444',
                color: '#ef4444',
                padding: '7px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isKhmer ? 'បញ្ឈប់' : 'Stop Guide'}
            </button>
          </div>
        </div>
      )}

      {/* Curated Walkthrough List */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
          {isKhmer ? 'មេរៀនណែនាំដែលមានស្រាប់' : 'Curated Walkthroughs'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {availableTutorials.map((tut) => (
            <div
              key={tut.id}
              style={{
                backgroundColor: tut.isMatched ? '#181b22' : '#15171e',
                border: tut.isMatched ? '1px solid #f59e0b' : '1px solid #2a2f3b',
                borderRadius: '8px',
                padding: '12px',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                  {resolveText(tut.name, currentLanguage)}
                </div>
                {tut.isMatched && (
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      backgroundColor: 'rgba(245, 158, 11, 0.18)',
                      color: '#f59e0b',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      marginLeft: '6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isKhmer ? 'ត្រូវគ្នា' : 'MATCHED'}
                  </span>
                )}
              </div>

              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', lineHeight: 1.4 }}>
                {resolveText(tut.description, currentLanguage)}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: '#64748b' }}>
                  {tut.totalSteps} {isKhmer ? 'ជំហាន' : 'Steps'}
                </span>
                <button
                  onClick={() => handleStartTutorial(tut.id)}
                  style={{
                    backgroundColor: tut.isMatched ? '#f59e0b' : '#262b35',
                    border: tut.isMatched ? 'none' : '1px solid #3e4556',
                    color: tut.isMatched ? '#000000' : '#ffffff',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: tut.isMatched ? '0 2px 6px rgba(245, 158, 11, 0.3)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isKhmer ? 'ចាប់ផ្តើម' : 'Start Guide'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Launch Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          onClick={handleOpenDemoTestbed}
          style={{
            width: '100%',
            backgroundColor: '#181b22',
            border: '1px dashed #3e4556',
            color: '#f59e0b',
            padding: '9px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          🚀 {isKhmer ? 'បើកទំព័រសាកល្បង Demo Testbed' : 'Open Local Demo Testbed Page'}
        </button>

        <button
          onClick={handleOpenGoogleDocs}
          style={{
            width: '100%',
            backgroundColor: 'transparent',
            border: '1px solid #2a2f3b',
            color: '#94a3b8',
            padding: '8px',
            borderRadius: '8px',
            fontSize: '11px',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          📄 {isKhmer ? 'បើកឯកសារ Google Docs ថ្មី' : 'Open New Google Doc Tab'}
        </button>
      </div>
    </div>
  );
}
