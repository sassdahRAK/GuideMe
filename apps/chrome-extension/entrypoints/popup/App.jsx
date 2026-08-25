import React, { useEffect, useState } from 'react';
import { ExtensionMessageAction } from '@guideme/core-types';
import { TUTORIAL_CATALOG, getTutorialsForUrl } from '../../src/catalog.js';

export default function App() {
  const [currentTab, setCurrentTab] = useState(null);
  const [engineState, setEngineState] = useState(null);
  const [availableTutorials, setAvailableTutorials] = useState(() => getTutorialsForUrl(''));
  const [contentScriptConnected, setContentScriptConnected] = useState(false);
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

  const handleStartDynamicGuide = async () => {
    if (!currentTab?.id || isChromeInternalUrl) return;

    const dynamicMsg = {
      action: ExtensionMessageAction.START_DYNAMIC_GUIDE,
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

  const hasMatchedGuides = availableTutorials.some((t) => t.isMatched);

  return (
    <div style={{ padding: '16px', boxSizing: 'border-box', minWidth: '330px', backgroundColor: '#12141a', color: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
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
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Universal Tutorial Engine</span>
          </div>
        </div>

        <span
          style={{
            fontSize: '10px',
            backgroundColor: '#181b22',
            color: '#f59e0b',
            padding: '3px 8px',
            borderRadius: '12px',
            border: '1px solid #2a2f3b',
            fontWeight: 700,
          }}
        >
          v2.0 Hybrid
        </span>
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
            ACTIVE CONTEXT
          </span>
          <span style={{ fontSize: '10px', color: contentScriptConnected || isExtensionUrl ? '#10b981' : '#f59e0b' }}>
            ● {contentScriptConnected || isExtensionUrl ? 'Ready' : 'Standby'}
          </span>
        </div>
        <div style={{ color: '#ffffff', fontWeight: 600, marginTop: '3px', fontSize: '12px', wordBreak: 'break-all' }}>
          {hostnameDisplay}
        </div>
      </div>

      {/* Dynamic Auto-Guide Action (Universal Mode) */}
      {!isChromeInternalUrl && (
        <div style={{ marginBottom: '14px' }}>
          <button
            onClick={handleStartDynamicGuide}
            style={{
              width: '100%',
              backgroundColor: '#f59e0b',
              border: 'none',
              color: '#000000',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 3px 10px rgba(245, 158, 11, 0.35)',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#d97706')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f59e0b')}
          >
            <span>⚡</span>
            <span>Auto-Guide This Page</span>
          </button>
          <div style={{ textAlign: 'center', fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
            Dynamically scans forms, buttons & navigation
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
              ● ACTIVE WALKTHROUGH
            </span>
            <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>
              Step {engineState.currentStepIndex + 1} of {engineState.totalSteps}
            </span>
          </div>

          <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
            {engineState.tutorial?.name || 'In Progress'}
          </div>

          {engineState.currentStep?.title && (
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px' }}>
              Current: {engineState.currentStep.title}
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
              Resume Focus
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
              Stop Guide
            </button>
          </div>
        </div>
      )}

      {/* Curated Walkthrough List */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
          Curated Walkthroughs
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
                  {tut.name}
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
                    MATCHED
                  </span>
                )}
              </div>

              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', lineHeight: 1.4 }}>
                {tut.description}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: '#64748b' }}>{tut.totalSteps} Steps</span>
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
                  Start Guide
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
          🚀 Open Local Demo Testbed Page
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
          📄 Open New Google Doc Tab
        </button>
      </div>
    </div>
  );
}
