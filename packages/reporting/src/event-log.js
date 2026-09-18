import { ReportingEvent } from '@guideme/engine';
import { sendReport } from './send-report.js';

const STORAGE_KEY = 'guideme_reporting_events';
const MAX_BUFFERED_EVENTS = 500; // ring buffer — local storage never grows unbounded
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_FLUSH_INTERVAL_MS = 15000;
const PERSIST_DEBOUNCE_MS = 300;

/**
 * Reduces a selector object down to which resolution strategies it carries
 * (css/testId/ariaLabel/text/xpath/...), never the raw string values. Raw
 * `text`/`ariaLabel` values can echo page copy or, for form-adjacent
 * targets, user-entered content — selectors/tiers/step ids are logged,
 * never page content.
 * @param {Object} selector
 * @returns {string[]}
 */
function describeSelectorKinds(selector) {
  if (!selector || typeof selector !== 'object') return [];
  const kinds = [];
  if (selector.css) kinds.push('css');
  if (selector.testId) kinds.push('testId');
  if (selector.ariaLabel) kinds.push('ariaLabel');
  if (selector.text) kinds.push('text');
  if (selector.xpath) kinds.push('xpath');
  if (selector.region) kinds.push('canvasRegion');
  if (selector.iframeCss) kinds.push('iframe');
  return kinds;
}

function safePageLocation() {
  try {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}`;
  } catch {
    return '';
  }
}

/**
 * Local-first, batched telemetry for guide execution and target-resolution
 * coverage. Persists every event to chrome.storage.local (or localStorage
 * outside the extension) as it's recorded, and periodically hands batches
 * to `sendReport()` for delivery to a backend.
 */
export class EventLog {
  /**
   * @param {Object} [options]
   * @param {number} [options.batchSize=20]
   * @param {number} [options.flushIntervalMs=15000]
   * @param {number} [options.persistDebounceMs=300]
   */
  constructor(options = {}) {
    this.batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
    this.flushIntervalMs = options.flushIntervalMs || DEFAULT_FLUSH_INTERVAL_MS;
    this.persistDebounceMs = options.persistDebounceMs ?? PERSIST_DEBOUNCE_MS;
    this._buffer = [];
    this._persistedCache = null; // lazily loaded to avoid a get-then-set race
    this._flushTimer = null;
    this._persistTimer = null;
    this._loadPersisted();
    this._startFlushTimer();
  }

  _loadPersisted() {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      try {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
          this._persistedCache = Array.isArray(result?.[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
        });
        return;
      } catch {}
    }
    if (typeof localStorage !== 'undefined') {
      try {
        this._persistedCache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return;
      } catch {}
    }
    this._persistedCache = [];
  }

  _startFlushTimer() {
    if (typeof setInterval === 'undefined') return;
    this._flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  /** Stop the periodic flush timer (e.g. on tutorial engine teardown). */
  destroy() {
    if (this._flushTimer) clearInterval(this._flushTimer);
    this._flushTimer = null;
    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
      this._persistTimer = null;
      this._writePersistedCache(); // don't drop the last debounced write
    }
  }

  /**
   * Record a raw reporting event. Prefer the typed helpers below.
   * @param {string} type - one of ReportingEvent
   * @param {Object} [data]
   */
  record(type, data = {}) {
    const event = { type, timestamp: Date.now(), url: safePageLocation(), ...data };
    this._buffer.push(event);
    this._persist(event);
    if (this._buffer.length >= this.batchSize) this.flush();
  }

  guideStepStarted({ tutorialId, stepId, stepIndex }) {
    this.record(ReportingEvent.GUIDE_STEP_STARTED, { tutorialId, stepId, stepIndex });
  }

  guideStepCompleted({ tutorialId, stepId, stepIndex }) {
    this.record(ReportingEvent.GUIDE_STEP_COMPLETED, { tutorialId, stepId, stepIndex });
  }

  guideStepSkipped({ tutorialId, stepId, stepIndex }) {
    this.record(ReportingEvent.GUIDE_STEP_SKIPPED, { tutorialId, stepId, stepIndex });
  }

  /**
   * @param {Object} params
   * @param {string} params.tutorialId
   * @param {string} params.stepId
   * @param {number} params.stepIndex
   * @param {number|string} params.tier
   * @param {string} params.source
   * @param {Object} [params.selector]
   */
  targetResolved({ tutorialId, stepId, stepIndex, tier, source, selector }) {
    this.record(ReportingEvent.TARGET_RESOLVED, {
      tutorialId,
      stepId,
      stepIndex,
      tier,
      source,
      isFallback: tier === 'fallback',
      selectorKinds: describeSelectorKinds(selector),
    });
  }

  /**
   * @param {Object} params
   * @param {string} params.tutorialId
   * @param {string} params.stepId
   * @param {number} params.stepIndex
   * @param {Object} [params.selector]
   * @param {string|null} [params.appVersion] - detected app version/build marker, if any
   */
  targetResolutionFailed({ tutorialId, stepId, stepIndex, selector, appVersion }) {
    this.record(ReportingEvent.TARGET_RESOLUTION_FAILED, {
      tutorialId,
      stepId,
      stepIndex,
      selectorKinds: describeSelectorKinds(selector),
      appVersion: appVersion || null,
    });
  }

  guideCompleted({ tutorialId, totalSteps }) {
    this.record(ReportingEvent.GUIDE_COMPLETED, { tutorialId, totalSteps });
  }

  /**
   * @param {Object} params
   * @param {string} params.tutorialId
   * @param {string|null} params.lastSuccessfulStepId
   * @param {number|null} params.lastSuccessfulStepIndex
   */
  guideAbandoned({ tutorialId, lastSuccessfulStepId, lastSuccessfulStepIndex }) {
    this.record(ReportingEvent.GUIDE_ABANDONED, { tutorialId, lastSuccessfulStepId, lastSuccessfulStepIndex });
  }

  /**
   * Append to the persisted ring buffer. No-ops silently while the initial
   * load is still in flight — the event is still queued in `_buffer` for
   * `flush()`, so it is never lost, only its local-storage durability is
   * delayed by one tick.
   *
   * The actual storage write is debounced (PERSIST_DEBOUNCE_MS) so a burst
   * of events recorded in the same tick (e.g. guideStepStarted immediately
   * followed by targetResolved) coalesces into one write instead of one
   * full-array `chrome.storage.local.set` per event.
   * @private
   */
  _persist(event) {
    if (!Array.isArray(this._persistedCache)) return;

    this._persistedCache = [...this._persistedCache, event].slice(-MAX_BUFFERED_EVENTS);

    if (typeof setTimeout === 'undefined') {
      this._writePersistedCache();
      return;
    }
    if (this._persistTimer) clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(() => {
      this._persistTimer = null;
      this._writePersistedCache();
    }, this.persistDebounceMs);
  }

  /** @private */
  _writePersistedCache() {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      try {
        chrome.storage.local.set({ [STORAGE_KEY]: this._persistedCache });
        return;
      } catch {}
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._persistedCache));
      } catch {}
    }
  }

  /**
   * Hand the current in-memory batch to sendReport() and clear it. Does not
   * clear persisted local storage — that remains the durable local record
   * until sendReport() is actually wired up to a backend.
   */
  flush() {
    if (this._buffer.length === 0) return;
    const batch = this._buffer.splice(0, this._buffer.length);
    Promise.resolve(sendReport(batch)).catch((err) => {
      console.warn('[GuideMe Reporting] sendReport failed (events remain in local storage):', err?.message);
    });
  }
}
