import { useState, useEffect } from 'react';
import { DomObserver } from '@guideme/chrome-adapter';

export function getCapturedStepStorageKey(url) {
  try {
    return `guideme_captured_step_${new URL(url).hostname}`;
  } catch {
    return 'guideme_captured_step_current_page';
  }
}

export function createCapturedTutorial(target) {
  const label = target.ariaLabel || target.text || target.testId || target.css;
  return {
    id: `captured-guide-${Date.now()}`,
    version: '1.0.0',
    name: { km: 'ជំហានដែលបានជ្រើសរើស', en: 'Captured step' },
    description: { km: 'ធាតុដែលអ្នកបានជ្រើសរើស', en: 'The element you selected' },
    matchUrls: ['<all_urls>'],
    steps: [{
      id: 'captured-step-1',
      title: { km: `ចុច ${label}`, en: `Click ${label}` },
      description: { km: `ធាតុដែលបានជ្រើសរើស៖ ${label}`, en: `Selected element: ${label}` },
      target,
      action: {
        type: 'spotlight',
        title: { km: 'ធាតុដែលបានជ្រើសរើស', en: 'Selected element' },
        content: { km: `នេះគឺជា ${label}`, en: `This is ${label}` },
        placement: 'bottom',
      },
      validation: { type: 'click' },
    }],
  };
}

/**
 * Custom hook to isolate DOM element inspection and step capture logic.
 */
export function useCaptureMode(engineRef) {
  const [isCaptureMode, setIsCaptureMode] = useState(false);
  const [captureTargetBoundingBox, setCaptureTargetBoundingBox] = useState(null);

  useEffect(() => {
    if (!isCaptureMode) return undefined;

    const getCandidate = (event) => {
      const rawTarget = event.target;
      if (!(rawTarget instanceof Element)) return null;
      if (rawTarget.closest('guideme-tutorial-root, #guideme-tutorial-root')) return null;
      return rawTarget.closest('button, a, input, select, textarea, [role="button"], [role="link"], [role="menuitem"], [role="tab"]') || rawTarget;
    };

    const updatePreview = (event) => {
      const element = getCandidate(event);
      setCaptureTargetBoundingBox(element ? DomObserver.getBoundingBox(element) : null);
    };

    const selectTarget = async (event) => {
      const element = getCandidate(event);
      if (!element) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      const target = DomObserver.createTargetSelector(element);
      const tutorial = createCapturedTutorial(target);
      try {
        chrome.storage?.local?.set({
          [getCapturedStepStorageKey(window.location.href)]: { target, capturedAt: Date.now() },
        });
      } catch {
        // Capture still works for the current page if storage is unavailable.
      }
      setIsCaptureMode(false);
      setCaptureTargetBoundingBox(null);

      // The selecting click is the learner's confirmed action. Count
      // it immediately so capture mode never requires a second click
      // on the same host-page control to advance the guide.
      const started = await engineRef.current?.start(tutorial, 0);
      if (started) await engineRef.current?.nextStep();
    };

    const cancelOnEscape = (event) => {
      if (event.key === 'Escape') {
        setIsCaptureMode(false);
        setCaptureTargetBoundingBox(null);
      }
    };

    document.addEventListener('pointermove', updatePreview, true);
    document.addEventListener('click', selectTarget, true);
    document.addEventListener('keydown', cancelOnEscape, true);

    return () => {
      document.removeEventListener('pointermove', updatePreview, true);
      document.removeEventListener('click', selectTarget, true);
      document.removeEventListener('keydown', cancelOnEscape, true);
    };
  }, [isCaptureMode, engineRef]);

  const startCapture = () => {
    engineRef.current?.stop();
    setIsCaptureMode(true);
  };

  const cancelCapture = () => {
    setIsCaptureMode(false);
    setCaptureTargetBoundingBox(null);
  };

  return {
    isCaptureMode,
    setIsCaptureMode,
    captureTargetBoundingBox,
    setCaptureTargetBoundingBox,
    startCapture,
    cancelCapture,
  };
}
