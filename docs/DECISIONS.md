# GuideMe Engine — Architectural Decision Records (ADRs)

This document tracks all foundational architectural choices, scope definitions, and technology selections for GuideMe (Universal Tutorial Engine / Rean Joch).

---

## Index of Decisions

1. [ADR-001: Hybrid Authoring Model (Curated Schemas + Dynamic Heuristics)](#adr-001-hybrid-authoring-model)
2. [ADR-002: Isolated Shadow DOM UI Layer](#adr-002-isolated-shadow-dom-ui-layer)
3. [ADR-003: Session-Durable Storage (`chrome.storage.local`)](#adr-003-session-durable-storage)
4. [ADR-004: Universal Extension Host Permissions (`<all_urls>`)](#adr-004-universal-extension-host-permissions)
5. [ADR-005: Autonomous Prompt Path Detection vs. Manual Educator Recording](#adr-005-autonomous-prompt-path-detection-vs-manual-educator-recording)
6. [ADR-006: In-Browser Offline Fuzzy Search (Fuse.js) for Intent Resolution](#adr-006-in-browser-offline-fuzzy-search-fusejs-for-intent-resolution)
7. [ADR-007: Floating UI (`@floating-ui/dom`) for Tooltip Collision Avoidance](#adr-007-floating-ui-for-tooltip-collision-avoidance)

---

### ADR-001: Hybrid Authoring Model
- **Context:** High-value SaaS applications (Google Docs, Office 365) require deterministic precision, while casual browsing requires instant guidance.
- **Decision:** Dual-mode architecture:
  1. *Curated Schema Mode:* Declarative JSON schemas with step preconditions and multi-strategy DOM resolution for complex enterprise workflows.
  2. *Dynamic Auto-Guide Mode:* Synthesizes contextual walkthroughs on unscripted pages directly from user intent.
- **Status:** **APPROVED**

---

### ADR-002: Isolated Shadow DOM UI Layer
- **Context:** Extension CSS injected directly into host pages (e.g. GitHub, Jira, Canva) causes severe styling collisions and breaks host layouts.
- **Decision:** All overlay components mount strictly inside an isolated Shadow Root via WXT `createShadowRootUi`.
- **Status:** **APPROVED**

---

### ADR-003: Session-Durable Storage
- **Context:** Users frequently switch tabs or restart browsers midway through complex workflows.
- **Decision:** Use `chrome.storage.local` keyed by `tutorialId + domain + userSession` to persist step progress. Ephemeral in-memory state is maintained for ad-hoc prompts.
- **Status:** **APPROVED**

---

### ADR-004: Universal Extension Host Permissions
- **Context:** Limiting permissions to specific domains restricts GuideMe's mission of providing universal digital literacy.
- **Decision:** Configure `<all_urls>` combined with `activeTab` and on-demand content scripting.
- **Status:** **APPROVED**

---

### ADR-005: Autonomous Prompt Path Detection vs. Manual Educator Recording
- **Context:** The Rean Joch project briefly explored educator-guided recording. However, real-world learners require on-demand guidance for arbitrary tasks without waiting for an educator to manually author a guide.
- **Decision:**
  - **Shelve / Defer manual educator recording mode for the current 1-week NextGen milestone.**
  - For this immediate NextGen milestone, the engine must autonomously analyze the DOM and synthesize the execution path directly from the learner's natural language goal (the "Ask anything..." prompt widget).
  - Scope for this NextGen milestone is strictly locked to the **Learner Playback Experience**: robust spotlight, non-clipping floating tooltips, hesitation audio guidance, and misclick rescue.
  - **Future Roadmap Note:** Manual educator recording mode (visual click-to-record studio) is **NOT discarded permanently**. It will be reintroduced in subsequent phases so GuideMe becomes a complete, end-to-end authoring and learner guidance ecosystem.
- **Status:** **APPROVED (Deferred beyond NextGen Milestone)**

---

### ADR-006: Hybrid Two-Stage Intent Resolution (Fuse.js Filter + LLM Re-Ranker)
- **Context:** Hand-coded regex in `DynamicPageAnalyzer` fails on unscripted pages. Pure Fuse.js fails when user intent relies on synonyms ("invite" vs. "share"). Conversely, sending the entire raw DOM to an LLM is slow (3-5s), token-heavy, and prone to selector hallucinations.
- **Decision: Adopt Two-Stage Hybrid Retrieval**
  1. **Stage 1 (Local Candidate Reduction via Fuse.js):** Instantly scans interactive DOM elements (`button`, `a`, `input`, `aria-label`) and narrows hundreds of nodes down to the top 10–15 candidate labels in <5ms.
  2. **Stage 2 (Semantic Re-Ranking via LLM):** Sends only the lightweight candidate list to the LLM to resolve semantic intent and identify the exact target without DOM bloat.
  3. **Offline / Fallback Resilience:** If an API key is missing or the network is disconnected, the engine falls back gracefully to pure Fuse.js fuzzy matching without interrupting the walkthrough.
- **Status:** **APPROVED (Hybrid Two-Stage Pattern Adopted)**

---

### ADR-007: Floating UI (`@floating-ui/dom`) for Tooltip Collision Avoidance
- **Context:** Tooltip coordinates were calculated using fixed height estimates (`cardEstimatedHeight = 240px`). Long Khmer (`km`) text causes cards to overflow or obscure the spotlighted target.
- **Decision:**
  - Adopt **`@floating-ui/dom`** in `@guideme/tutorial-ui`.
  - Use virtual reference elements matching `targetBoundingBox`, applying `flip()`, `shift({ padding: 16 })`, and `offset(16)`.
- **Status:** **APPROVED**

---

### ADR-008: Zero-Coordinate (0, 0) & Missing Target Graceful Recovery
- **Context:** When an element cannot be found, has `display: none`, or has zero dimensions (such as hidden mobile navigation items or off-screen SVG icons), `getBoundingClientRect()` returns `{ x: 0, y: 0, width: 0, height: 0 }`. In earlier implementations, this rendered an erroneous 12px spotlight box pinned to the top-left corner `(0, 0)` of the viewport, confusing learners.
- **Decision:**
  1. **Visible Element Selector:** `DomObserver.findElement` inspects candidate elements and picks the first visible element (`offsetParent !== null` and `getClientRects().length > 0`) to prevent latching onto hidden duplicates.
  2. **Null Bounding Box:** `DomObserver.getBoundingBox` returns `null` (instead of `{0,0,0,0}`) for elements with zero width/height or unmounted nodes.
  3. **Spotlight Suppression:** `Spotlight.jsx` only renders when `hasValidBox` is true (`width > 0 || height > 0`).
  4. **Modal Centering:** When target coordinates are absent or missing, `Tooltip.jsx` gracefully falls back to a clean center modal presentation (`isCenter = true`).
  5. **Learner Feedback Banner & Retry Action:** `StepCard.jsx` renders an amber warning banner:
     - Khmer: `មិនអាចកំណត់ទីតាំងប៊ូតុងបានទេ សូមរមូរទំព័រ ឬចុចសាកល្បងម្ដងទៀត`
     - English: `Cannot locate target element. Please scroll into view or try again.`
     - Displays an interactive **"Try Again" / "សាកល្បងម្ដងទៀត"** button that invokes `engine.retryLocateTarget()`.
- **Status:** **APPROVED & IMPLEMENTED**

---

### ADR-009: StepCard Free-Dragging with Window Pointer Listeners and Center-Override Priority
- **Context:** When the step card was centered (e.g. `isCenter = true` during missing target states) or user moved pointer rapidly, dragging failed. The original logic checked `if (isCenter)` before `if (customPosition)`, permanently pinning the card to 50%/50%. Furthermore, pointer events bound only to a narrow header div were easily dropped when the cursor escaped the header boundaries.
- **Decision:**
  1. **Top Priority for Custom Position:** In `Tooltip.jsx`, `customPosition` is evaluated first in `positionStyle`, giving manual user placement precedence over automatic anchoring and centering.
  2. **Window-Level Pointer Listeners:** When drag initiates, `pointermove` and `pointerup` listeners attach to `window` with capture, ensuring zero dropped drag gestures even during rapid mouse travel.
  3. **Visual Drag Handle & Touch Prevention:** Added `touch-action: none` and a visible drag grip bar in `StepCard.jsx` to afford intuitive repositioning.
- **Status:** **APPROVED & IMPLEMENTED**

---

### ADR-010: Robust Input Field Validation & Dynamic Prompt Entity Extraction
- **Context:** While button clicks advanced instantly, input fields appeared broken. When a walkthrough was generated from natural language prompts, `validation.expectedValue` was left undefined, causing the engine to skip binding the `'input'` listener entirely. Users typing into search filters had to manually hit Enter or blur the field to trigger validation. Furthermore, input steps misleadingly showed "CLICK HERE" / "ចុចទីនេះ" on the spotlight pointer.
- **Decision:**
  1. **Universal Input Listener:** `ValidationEngine.js` now always binds `'input'`. If no `expectedValue` is provided, it validates automatically after a 650ms debounced typing pause once text is entered.
  2. **Direct Entity Extraction:** `DynamicPageAnalyzer.js` extracts quoted keywords or named entities from user prompts (e.g. `"Please help me find repository named GuideMe"` -> `expectedValue: "GuideMe"`).
  3. **Contextual Action Label:** `ActionEngine.js` renders "TYPE HERE" / "វាយបញ្ចូល" for input/change steps instead of "CLICK HERE".
  4. **Detached Element Resilience:** `event-listener.js` dynamically re-queries elements if detached by host SPA frameworks (like GitHub Turbo) and matches direct CSS selectors.
- **Status:** **APPROVED & IMPLEMENTED**

---

### ADR-011: Coherent Step Sequence & Elimination of Duplicate Hidden Input Steps
- **Context:** When searching or navigating from user prompts (e.g. `"Please help me find repository named mytube"`), multiple search inputs exist in complex SPAs like GitHub (visible repo filter, global search bar, hidden mobile input). The generator previously took all high-scoring inputs blindly, generating duplicate steps (e.g. Step 1: Type "mytube", Step 2: Type "mytube" again into a hidden input), causing target resolution to fail and display missing-element warning banners.
- **Decision:**
  1. **Visibility Pre-Filter:** `DynamicPageAnalyzer.js` ignores invisible DOM elements (`offsetParent === null` and `getClientRects().length === 0`).
  2. **Single-Input Discipline:** Walkthrough generators enforce a maximum of ONE input step per search action, discarding secondary/duplicate input candidates.
  3. **Input-to-Result Sequence Flow:** If a walkthrough begins with a search query (e.g. entering "mytube"), Step 2 automatically targets the matching result element (`a[href*="mytube"]`, `[title*="mytube"]`), enabling a natural two-step flow: 1) Type query -> 2) Click result to open.
  4. **Visible Prioritization & Substring Link Matching:** `DomObserver.findElement` prioritizes visible elements over hidden CSS matches, and adds substring matching for interactive link/button text (e.g. matching `thangsaoly/mytube` from `mytube`).
- **Status:** **APPROVED & IMPLEMENTED**

---

### ADR-012: Extension AI API Client vs. Backend Service Boundary Separation
- **Context:** To ensure security, token efficiency, and clean architecture, browser extensions must not bundle backend secrets (e.g. Gemini/OpenAI private keys) or execute heavy backend LLM pipelines client-side.
- **Decision:**
  1. **Extension Client Boundary (`@guideme/engine`):**
     - Performs live DOM scanning, element descriptor extraction, and Stage 1 local candidate pruning (`FuseFilter`) in `<5ms`.
     - For Stage 2 semantic re-ranking, acts purely as an HTTP **API Client** (`BackendIntentApiClient`) sending compact candidate representations (`[{ id, category, label }]`, ~250 tokens) to the backend endpoint (`POST /api/v1/ai/intent-rerank`).
     - Contains an automatic zero-latency local fallback (`LocalFallbackReranker`) if the backend is unreachable or offline.
  2. **Backend Server Boundary (`GuideMe-Site/backend`):**
     - Houses private API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`), system prompts, rate limiting, and model temperature controls.
     - Exposes `POST /api/v1/ai/intent-rerank` accepting prompt and candidates, returning `{ stepIds: [...] }`.
- **Status:** **APPROVED & IMPLEMENTED**
