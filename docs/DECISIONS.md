# GuideMe Architectural Decision Records (ADRs)

This document tracks all foundational architectural choices, scope definitions, and technology selections for GuideMe.

---

## Index of Decisions

1. [ADR-001: Hybrid Model (Pre-built Guides + Dynamic Heuristics)](#adr-001-hybrid-authoring-model)
2. [ADR-002: Isolated Shadow DOM UI Layer](#adr-002-isolated-shadow-dom-ui-layer)
3. [ADR-003: Session-Durable Storage (`chrome.storage.local`)](#adr-003-session-durable-storage)
4. [ADR-004: Universal Extension Host Permissions (`<all_urls>`)](#adr-004-universal-extension-host-permissions)
5. [ADR-005: Autonomous Prompt Path Detection vs. Manual Educator Recording](#adr-005-autonomous-prompt-path-detection)
6. [ADR-006: Hybrid Two-Stage Intent Resolution (Fuse.js + LLM Re-Ranker)](#adr-006-hybrid-two-stage-intent-resolution)
7. [ADR-007: Floating UI (`@floating-ui/dom`) for Tooltip Collision Avoidance](#adr-007-floating-ui-collision-avoidance)
8. [ADR-008: Zero-Coordinate (0, 0) & Missing Target Graceful Recovery](#adr-008-missing-target-recovery)
9. [ADR-009: StepCard Free-Dragging with Window Pointer Listeners](#adr-009-stepcard-free-dragging)
10. [ADR-010: Robust Input Field Validation & Dynamic Entity Extraction](#adr-010-input-field-validation)
11. [ADR-011: Coherent Step Sequence & Duplicate Input Elimination](#adr-011-coherent-step-sequence)
12. [ADR-012: Extension AI Client vs. Backend Service Boundary](#adr-012-ai-client-backend-boundary)
13. [ADR-013: Central Background Session Orchestration & In-Page Shadow DOM Overlay](#adr-013-background-session-pip-launcher)
14. [ADR-014: AI-First Intent Pipeline with Fuse.js Grounded DOM Scanner](#adr-014-ai-first-intent-fuse-dom-scanner)

---

### ADR-001: Hybrid Authoring Model
- **Context:** High-value SaaS applications require deterministic precision, while casual web browsing demands immediate zero-config guidance.
- **Decision:** Dual-mode architecture combining pre-built JSON guides (with multi-strategy DOM resolution) and dynamic runtime walkthrough synthesis from natural language intents.
- **Status:** **APPROVED**

### ADR-002: Isolated Shadow DOM UI Layer
- **Context:** Injecting standard CSS into third-party host web pages causes severe style collisions and layout breakage.
- **Decision:** All overlay components mount exclusively inside an isolated Shadow Root (`#guideme-tutorial-root`) via WXT `createShadowRootUi`.
- **Status:** **APPROVED**

### ADR-003: Session-Durable Storage
- **Context:** Users frequently reload pages, switch tabs, or restart browsers midway through multi-step workflows.
- **Decision:** Persist progress via `chrome.storage.local` keyed by `tutorialId + domain + userSession`. In-memory map fallback for testing.
- **Status:** **APPROVED**

### ADR-004: Universal Extension Host Permissions
- **Context:** GuideMe's mission is universal digital literacy across any web tool without per-domain barriers.
- **Decision:** Configure `<all_urls>` combined with `activeTab` and on-demand content scripting.
- **Status:** **APPROVED**

### ADR-005: Autonomous Prompt Path Detection (Learner-Only Architecture)
- **Context:** Real-world learners require on-demand walkthroughs immediately without manual recording, screen capture, or authoring studio overhead.
- **Decision:** Permanently reject visual educator recording studios, click-recording capture modes, and manual authoring studios. Focus the entire architecture exclusively on autonomous, real-time AI & dynamic DOM walkthrough synthesis directly from natural language prompts.
- **Status:** **APPROVED (Manual recording studios and capture modes permanently rejected)**

### ADR-006: Hybrid Two-Stage Intent Resolution
- **Context:** Pure regex fails on unscripted pages; sending entire raw DOMs to LLMs causes latency (3-5s), token exhaustion, and selector hallucination.
- **Decision:** 
  1. **Stage 1 (Local Filtering via Fuse.js):** Prune DOM nodes to top 10–15 candidate interactive elements in <5ms.
  2. **Stage 2 (Semantic Re-Ranking via LLM):** Send lightweight candidate descriptors (~250 tokens) to backend endpoint (`POST /api/v1/ai/intent-rerank`).
  3. **Offline Fallback:** Revert to pure Fuse.js fuzzy matching when offline or API key is absent.
- **Status:** **APPROVED**

### ADR-007: Floating UI Collision Avoidance
- **Context:** Long localized Khmer strings caused step cards to overflow or obscure highlighted elements when using fixed pixel offsets.
- **Decision:** Adopt `@floating-ui/dom` with virtual bounding boxes, applying `flip()`, `shift({ padding: 16 })`, and `offset(16)`.
- **Status:** **APPROVED**

### ADR-008: Missing Target Graceful Recovery
- **Context:** Hidden elements or unmounted nodes returned `(0, 0, 0, 0)` bounding boxes, rendering broken 12px spotlight artifacts at the top-left of the screen.
- **Decision:** Suppress spotlight if dimensions are zero; fall back to a centered modal presentation; render bilingual warning banner with interactive "Try Again" retry action.
- **Status:** **APPROVED**

### ADR-009: StepCard Free-Dragging
- **Context:** Rapid cursor movement dropped drag gestures, and centered fallback mode locked coordinates.
- **Decision:** Attach `pointermove` and `pointerup` listeners to `window` with capture during active drag; prioritize manual drag coordinates over automatic anchoring.
- **Status:** **APPROVED**

### ADR-010: Input Field Validation & Entity Extraction
- **Context:** Walkthroughs generated from prompts left `expectedValue` blank, failing to advance when users typed into inputs.
- **Decision:** Universal input listener advances after 650ms debounced typing pause; prompt analyzer extracts quoted keywords as expected values; action pill displays "TYPE HERE" / "វាយបញ្ចូល".
- **Status:** **APPROVED**

### ADR-011: Coherent Step Sequence & Duplicate Input Elimination
- **Context:** Complex SPAs contain multiple search inputs (mobile, desktop, filters), causing duplicate typing steps.
- **Decision:** Pre-filter invisible DOM elements; enforce max 1 input step per search flow; automatically chain input step to matching result link.
- **Status:** **APPROVED**

### ADR-012: AI Client vs. Backend Service Boundary
- **Context:** Browser extensions must not expose private API keys or bundle heavy machine learning dependencies client-side.
- **Decision:** Extension acts as an HTTP client sending compact element lists to backend; backend manages LLM keys, rate limiting, and prompt orchestration.
- **Status:** **APPROVED**

### ADR-013: Central Background Session Orchestration & Floating PiP Launcher
- **Context:** When users reload a webpage or switch between tabs during a multi-step walkthrough, in-page content scripts terminate and lose active state, resetting tutorial progress. Furthermore, having an always-accessible search/prompt bar across all tabs without covering page content improves usability.
- **Decision:**
  1. **Background Session Store (`chrome.storage.session`):** Active tutorial state (`tutorial`, `currentStepIndex`, `targetUrl`, `tabId`) is centrally managed in the Background Service Worker using fast in-memory session storage.
  2. **Auto-Restoration on Navigation:** When a tab finishes reloading (`chrome.tabs.onUpdated`) or mounts, it queries `GUIDEME_GET_SESSION` and auto-resumes the active tutorial at the exact step.
  3. **Standalone PiP Launcher Window:** A lightweight, non-blocking floating window (`entrypoints/pip/index.html` + `main.js`) opened via `chrome.windows.create({ type: 'popup' })` allows searching and commanding walkthroughs from anywhere across the browser without being tied to a single tab's DOM lifecycle.
- **Status:** **APPROVED & IMPLEMENTED**

### ADR-014: AI-First Intent Pipeline with Fuse.js Grounded DOM Scanner
- **Context:** Premature client-side regex heuristics (e.g. `classifyPrompt`) intercepted and blocked conversational inputs, typos, and slang (such as "heeloo brooo"), returning hardcoded error messages without contacting the AI model. Conversely, dumping large raw DOM trees (80+ elements) to LLMs caused token bloat, latency (3-5s), and severe CSS selector hallucination.
- **Decision:**
  1. **Direct AI Routing (No Premature Regex Blocking):** Every user prompt routes directly to the AI assistant (`/api/ai/assistant-chat`). The LLM naturally handles greetings, typos, slang, and contextual inquiries without rigid regex gatekeeping.
  2. **Provider-Agnostic Structured Intent Contract:** When actionable guidance is detected (`triggerGuide: true`), the AI (whether NVIDIA NIM, Gemini, or fallback) outputs semantic search criteria (`targetQuery`, `action`, `role`, `category`) rather than guessing raw CSS selectors.
  3. **Local Fuse.js Grounded DOM Grounding:** The Content Script extracts visible interactive elements on the active page via `harvestInteractiveElements()` and uses `Fuse.js` (`matchDomElementWithFuse`) to match against actual DOM nodes in memory (<5ms).
  4. **Zero Hallucination:** The final spotlight CSS selector is derived directly from the verified physical DOM element, completely eliminating selector hallucination.
  5. **Offline Fallback:** `classifyPrompt` is retained strictly as an offline/network-error fallback when the backend service is unreachable.
- **Status:** **APPROVED & IMPLEMENTED**

