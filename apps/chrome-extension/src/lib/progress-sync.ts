// chrome-extension/src/lib/progress-sync.ts
import { apiRequest } from "./api";

export interface StepCompletion {
  guideId: string;
  stepIndex: number;
  completedAt: string;
}

export async function saveStepProgress(guideId: string, stepIndex: number): Promise<void> {
  const timestamp = new Date().toISOString();

  // 1. Instant local persistence (ensures zero UI latency for the user)
  const { localProgress = {}, pendingSyncQueue = [] } = await chrome.storage.local.get([
    "localProgress",
    "pendingSyncQueue",
  ]);

  const updatedGuideSteps = new Set<number>(localProgress[guideId] || []);
  updatedGuideSteps.add(stepIndex);

  localProgress[guideId] = Array.from(updatedGuideSteps);

  const syncItem: StepCompletion = {
    guideId,
    stepIndex,
    completedAt: timestamp,
  };

  // Add to pending queue in case the network fails or Render is waking up
  pendingSyncQueue.push(syncItem);

  await chrome.storage.local.set({ localProgress, pendingSyncQueue });

  // 2. Trigger asynchronous server push
  triggerQueueSync();
}

export async function triggerQueueSync(): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;

  const { pendingSyncQueue = [], authToken } = await chrome.storage.local.get([
    "pendingSyncQueue",
    "authToken",
  ]);

  if (!authToken || pendingSyncQueue.length === 0) return;

  try {
    // Batch sync pending actions to the backend
    await apiRequest("/user/progress", {
      method: "POST",
      body: JSON.stringify({ batch: pendingSyncQueue }),
    });

    // Clear queue upon confirmed sync
    await chrome.storage.local.set({ pendingSyncQueue: [] });
    console.log(`[GuideMe Sync] Successfully synced ${pendingSyncQueue.length} progress items.`);
  } catch (error) {
    // Keep items in pendingSyncQueue to retry automatically on next action or launch
    console.warn("[GuideMe Sync] Progress sync deferred: backend offline or waking up.", error);
  }
}
