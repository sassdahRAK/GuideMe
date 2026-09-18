/**
 * Batch-send stub. Wire this up to your existing backend once one exists —
 * EventLog already handles local persistence (chrome.storage.local) and
 * batching, so this only needs to deliver `events` somewhere durable.
 * @param {Array<Object>} events
 * @returns {Promise<void>}
 */
export async function sendReport(events) {
  // TODO: wire up to your backend, e.g.:
  //   await fetch(`${backendUrl}/api/reporting/events`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ events }),
  //   });
  console.debug(`[GuideMe Reporting] sendReport stub called with ${events.length} event(s) — not yet wired to a backend.`);
}
