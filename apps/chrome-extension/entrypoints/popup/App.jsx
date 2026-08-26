import React, { useEffect, useState } from 'react';
import {
  FiCompass,
  FiZap,
  FiMessageSquare,
  FiPlay,
  FiSquare,
  FiExternalLink,
  FiFileText,
  FiCheckCircle,
  FiArrowRight,
} from 'react-icons/fi';
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
            }, 350);
            return;
          }
        } catch (err) {
          console.error('[GuideMe Popup] Failed to inject content script:', err);
        }
      }
      window.close();
    });
  };

  const handleStartDynamicGuide = async (promptText) => {
    if (!currentTab?.id || isChromeInternalUrl) return;

    const actionPayload = {
      action: ExtensionMessageAction.START_DYNAMIC_GUIDE,
      payload: { prompt: promptText },
    };

    chrome.tabs.sendMessage(currentTab.id, actionPayload, async (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        try {
          if (chrome.scripting?.executeScript) {
            await chrome.scripting.executeScript({
              target: { tabId: currentTab.id },
              files: ['content-scripts/content.js'],
            });
            setTimeout(() => {
              chrome.tabs.sendMessage(currentTab.id, actionPayload, () => {
                window.close();
              });
            }, 350);
            return;
          }
        } catch (err) {
          console.error('[GuideMe Popup] Failed to trigger dynamic guide:', err);
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

  const handlePopOutToPage = () => {
    if (!currentTab?.id || isChromeInternalUrl) return;
    chrome.tabs.sendMessage(
      currentTab.id,
      { action: ExtensionMessageAction.OPEN_FLOATING_PROMPT },
      () => {
        window.close();
      }
    );
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
      className={`p-4 box-border min-w-[360px] bg-[#12141a] text-slate-100 ${
        isKhmer ? 'font-kantumruy' : 'font-sans'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center font-black text-sm text-black shadow-[0_2px_10px_rgba(245,158,11,0.4)]">
            G
          </div>
          <div>
            <h3 className="m-0 text-sm font-bold text-white tracking-tight">GuideMe</h3>
            <span className="text-[11px] text-slate-400">
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
      <div className="bg-[#181b22] border border-[#2a2f3b] rounded-lg p-2.5 sm:px-3 mb-3">
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
            {isKhmer ? 'ទំព័របច្ចុប្បន្ន (ACTIVE PAGE)' : 'ACTIVE CONTEXT'}
          </span>
          <span
            className={`text-[10px] font-semibold flex items-center gap-1 ${
              contentScriptConnected || isExtensionUrl ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {contentScriptConnected || isExtensionUrl
              ? isKhmer ? 'រួចរាល់' : 'Ready'
              : isKhmer ? 'រង់ចាំ' : 'Standby'}
          </span>
        </div>
        <div className="text-white font-semibold mt-1 text-xs break-all">
          {hostnameDisplay}
        </div>
      </div>

      {/* Custom Prompt Input Guide */}
      {!isChromeInternalUrl && (
        <div className="bg-[#181b22] border border-[#2a2f3b] rounded-xl p-3 mb-3.5">
          <div className="flex justify-between items-center mb-1.5">
            <div className="text-[11px] text-amber-400 font-extrabold uppercase tracking-wide flex items-center gap-1.5">
              <FiMessageSquare className="w-3.5 h-3.5" />
              <span>Prompt-to-Guide Anywhere</span>
            </div>
            <button
              type="button"
              onClick={handlePopOutToPage}
              title={isKhmer ? 'បើកប្រអប់ Prompt លើទំព័រផ្ទាល់' : 'Pop out prompt box onto page'}
              className="text-[10px] text-slate-400 hover:text-amber-400 flex items-center gap-1 bg-transparent hover:bg-[#262b35] px-1.5 py-0.5 rounded cursor-pointer transition-colors"
            >
              <FiExternalLink className="w-3 h-3" />
              <span>{isKhmer ? 'បើកលើទំព័រ' : 'Pop Out'}</span>
            </button>
          </div>
          <div className="text-[11px] text-slate-400 mb-2">
            {isKhmer
              ? 'វាយបញ្ចូលអ្វីដែលអ្នកចង់ធ្វើ (ឬបិទភ្ជាប់ JSON ជំហាន):'
              : 'Type what you want to do on this page (or paste JSON steps):'}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleStartDynamicGuide(customPrompt);
            }}
          >
            <div className="flex gap-1.5 mb-2">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g. search, fill email, click share..."
                className="flex-1 bg-[#12141a] border border-[#3e4556] rounded-lg text-white px-2.5 py-1.5 text-[11px] outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="bg-amber-500 text-black px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap hover:bg-amber-400 transition-colors"
              >
                Guide Me
              </button>
            </div>
          </form>

          <button
            type="button"
            onClick={() => handleStartDynamicGuide('')}
            className="w-full bg-[#262b35] border border-[#3e4556] text-slate-200 hover:border-amber-500 hover:text-amber-400 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
          >
            <FiZap className="w-3.5 h-3.5 text-amber-400" />
            <span>{isKhmer ? 'ចាប់ផ្តើមស្កេនទំព័រនេះដោយស្វ័យប្រវត្តិ' : 'Auto-Guide This Page'}</span>
          </button>
          <div className="text-center text-[10px] text-slate-500 mt-1">
            {isKhmer ? 'វិភាគទម្រង់ ប៊ូតុង និងម៉ឺនុយលើទំព័រភ្លាមៗ' : 'Dynamically scans forms, buttons & navigation'}
          </div>
        </div>
      )}

      {/* Active Guide State Banner */}
      {engineState?.isActive && (
        <div className="bg-[#181b22] border border-amber-500 rounded-xl p-3 mb-3.5 shadow-[0_4px_16px_rgba(245,158,11,0.15)]">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] text-amber-400 font-extrabold tracking-wide flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              {isKhmer ? 'កំពុងដំណើរការមេរៀន' : 'ACTIVE WALKTHROUGH'}
            </span>
            <span className="text-[11px] text-slate-300 font-semibold">
              {engineState.stepBadgeText || `${engineState.currentStepIndex + 1}/${engineState.totalSteps}`}
            </span>
          </div>

          <div className="text-xs font-bold text-white mb-1 truncate">
            {resolveText(engineState.tutorial?.name, currentLanguage) || (isKhmer ? 'កំពុងដំណើរការ' : 'In Progress')}
          </div>

          {engineState.currentStep?.title && (
            <div className="text-[11px] text-slate-400 mb-2.5 truncate">
              {resolveText(engineState.currentStep.title, currentLanguage)}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.close()}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-black py-1.5 px-2.5 rounded-lg text-[11px] font-bold cursor-pointer shadow-[0_2px_6px_rgba(245,158,11,0.3)] transition-colors"
            >
              {isKhmer ? 'បន្តការណែនាំ' : 'Resume Focus'}
            </button>
            <button
              type="button"
              onClick={handleStopTutorial}
              className="bg-[#262b35] border border-red-500/80 text-red-400 hover:bg-red-500/10 py-1.5 px-3 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors"
            >
              {isKhmer ? 'បញ្ឈប់' : 'Stop Guide'}
            </button>
          </div>
        </div>
      )}

      {/* Curated Walkthrough List */}
      <div className="mb-3.5">
        <div className="text-[11px] text-slate-400 font-bold uppercase mb-2 tracking-wide">
          {isKhmer ? 'មេរៀនណែនាំដែលមានស្រាប់' : 'Curated Walkthroughs'}
        </div>

        <div className="flex flex-col gap-2">
          {availableTutorials.map((tut) => (
            <div
              key={tut.id}
              className={`rounded-xl p-3 transition-colors ${
                tut.isMatched
                  ? 'bg-[#181b22] border border-amber-500/80'
                  : 'bg-[#15171e] border border-[#2a2f3b]'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="text-xs font-semibold text-white">
                  {resolveText(tut.name, currentLanguage)}
                </div>
                {tut.isMatched && (
                  <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1.5 py-0.5 rounded ml-1.5 whitespace-nowrap">
                    {isKhmer ? 'ត្រូវគ្នា' : 'MATCHED'}
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-400 mb-2.5 leading-relaxed">
                {resolveText(tut.description, currentLanguage)}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-500 font-medium">
                  {tut.totalSteps} {isKhmer ? 'ជំហាន' : 'Steps'}
                </span>
                <button
                  type="button"
                  onClick={() => handleStartTutorial(tut.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                    tut.isMatched
                      ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-[0_2px_6px_rgba(245,158,11,0.3)]'
                      : 'bg-[#262b35] border border-[#3e4556] text-white hover:border-amber-500 hover:text-amber-400'
                  }`}
                >
                  {isKhmer ? 'ចាប់ផ្តើម' : 'Start Guide'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Launch Actions */}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleOpenDemoTestbed}
          className="w-full bg-[#181b22] border border-dashed border-[#3e4556] hover:border-amber-500 text-amber-400 hover:text-amber-300 p-2 rounded-lg text-[11px] font-semibold cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
        >
          <FiExternalLink className="w-3.5 h-3.5" />
          <span>{isKhmer ? 'បើកទំព័រសាកល្បង Demo Testbed' : 'Open Local Demo Testbed Page'}</span>
        </button>

        <button
          type="button"
          onClick={handleOpenGoogleDocs}
          className="w-full bg-transparent border border-[#2a2f3b] hover:border-slate-500 text-slate-400 hover:text-slate-200 p-2 rounded-lg text-[11px] cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
        >
          <FiFileText className="w-3.5 h-3.5" />
          <span>{isKhmer ? 'បើកឯកសារ Google Docs ថ្មី' : 'Open New Google Doc Tab'}</span>
        </button>
      </div>
    </div>
  );
}
