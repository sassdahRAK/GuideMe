# GuideMe Project Progress Tracker

*Tracks project health, completed milestones, and upcoming roadmap.*

---

## 1. Project Health & Test Status

- **Automated Test Suite:** 119/119 unit tests passing across all 9 suites (`tests/engine.test.js`, `tests/dynamic-analyzer.test.js`, `tests/dom-observer.test.js`, `tests/prompt-classifier.test.js`, `tests/intent-resolver.test.js`).
- **Build Status:** Manifest V3 production bundle (`apps/chrome-extension/.output/chrome-mv3`) compiling cleanly via WXT + Vite (1.92s).
- **Specification Status:** Documentation unified under `docs/` and bound to root `AGENTS.md`.

---

## 2. Completed Milestones

### Phase 1: Core Headless Engine & Monorepo Foundation
- [x] Initialized monorepo with PNPM workspaces across 6 packages (`engine`, `tutorial-ui`, `chrome-adapter`, `adapter-interface`, `tutorial-schema`, `core-types`) and an app (`chrome-extension`).
- [x] Implemented `TutorialEngine` finite state machine (`IDLE`, `LOADING`, `STEP_ACTIVE`, `VALIDATING`, `STEP_COMPLETED`, `PAUSED`, `COMPLETED`, `ERROR`).
- [x] Implemented `ValidationEngine` supporting `click`, `input`, `change`, `submit`, `url_change`, and `manual_next`.
- [x] Created `TutorialParser` and schema validator with Zod checks.

### Phase 2: Chrome Adapter & Isolated UI Overlay
- [x] Developed `ChromeAdapter` with `DOMObserver`, `MutationObserver` element polling, and `URLListener`.
- [x] Mounted `TutorialOverlay` inside isolated Shadow DOM (`guideme-tutorial-root`) via WXT `createShadowRootUi`.
- [x] Built interactive SVG `Spotlight` with cutout mask, corner smoothing, and radiant pulse glow ring.
- [x] Built auto-flipping `StepCard` / `Tooltip` with responsive viewport collision avoidance via `@floating-ui/dom`.
- [x] Built extension popup with active tab matching, category filters, and quick launch actions.

### Phase 3: Dynamic Page Auto-Guider & Khmer-First Accessibility
- [x] Implemented `DynamicPageAnalyzer` for real-time DOM scanning and archetype classification (Login, E-Commerce, Search, Settings, Dashboard).
- [x] Integrated keyword intent prompt generator for custom dynamic walkthrough synthesis.
- [x] Implemented `I18nManager` supporting primary Khmer (`km`) and secondary English (`en`) with live toggle.
- [x] Built `AudioEngine` with pluggable `BaseTtsProvider` interface and voice prompt playback controls.
- [x] Created offline sandbox demo testbed (`test-demo.html`) and pre-built walkthrough catalog.

### Phase 4: Production Hardening & Design System Alignment
- [x] Consolidated documentation under `docs/` and updated `AGENTS.md`.
- [x] Seamless Dark Mode & Light (White) Mode with Tailwind v4 `@custom-variant dark` support.
- [x] Full Khmer (`km`) translation across Popup, Settings drawer, Overlays, and dynamic AI assistant responses.
- [x] Official high-res extension branding and logo icon integration across all Chrome toolbar sizes.

### Phase 4.1: Prompt Intelligence & Classifier
- [x] Enabled prompt-driven CSS selector matching and chained multi-target sequences.
- [x] Built `classifyPrompt` intent classifier distinguishing greetings, unclear prompts, and actionable requests.
- [x] Integrated Gemini DOM Analyzer service with compact DOM extraction.

### Phase 4.2: Tooltip & Target Resilience
- [x] Floating tooltip collision measurement and least-colliding placement around live targets.
- [x] Substring matching for visible link/button text to prevent broad selector false positives.
- [x] Zero-dimension recovery suppressing 0,0 spotlight box and displaying centered retry banner.
- [x] StepCard free-dragging with window-level capture listeners.

### Phase 4.3: Floating PiP Launcher & Cross-Tab Session Persistence
- [x] Integrated standalone PiP mini-launcher window (`pip.html`) accessible via popup or shortcut across all tabs.
- [x] Centrally managed active walkthrough state in Background Service Worker (`chrome.storage.session`).
- [x] Automatic session restoration on page navigation or reload with 0 step context loss.
- [x] Dynamic guide triggering from detached floating launcher directly to the active webpage.

### Phase 4.4: Universal AI Gateway & DOM Engine Intelligence Integration
- [x] **Live DOM Engine + AI Synergy Loop:**
  - Implemented two-stage interactive workflow: DOM Engine scans live host webpage elements (`tag`, `id`, `class`, `testId`, `ariaLabel`, `text`, `coordinates`) -> sends candidates to backend AI gateway -> LLM reasons on user intent (Khmer/English) and maps sequential interactive steps -> Engine binds live spotlights, monitors clicks/inputs, and auto-advances.
- [x] **Headless AI Analysis & DOM Grounding (`@guideme/engine`):**
  - Pure JS, Node & browser-compatible analyzer consuming OpenAI-compatible endpoints and Gemini REST API.
  - Defensive extraction with `<think>...</think>` reasoning token stripping and Markdown code fence isolation for reasoning models.
  - Step candidate hydration and Zod `SchemaValidator` schema validation before passing to engine.
- [x] **Dual-Tier Secret Management Architecture:**
  - **Backend Layer (`GuideMe-Backend`):** Added secure proxy endpoint `POST /api/v1/ai/dom-guide` and `.env` credentials (`OPENROUTER_API_KEY`, `GEMINI_API_KEY`). Zero API key leakage into Chrome extension bundles; allows instant model/key rotation without waiting for Chrome Web Store reviews.
  - **Client-Side BYOK:** Settings popup allows power users/developers to optionally supply their own personal key saved locally in `chrome.storage.local`.
- [x] **Popup & UI Settings:**
  - Added AI Provider selector (OpenAI / OpenRouter vs Google Gemini).
  - Added live status indicators, Khmer diacritic-safe Kantumruy typography, and full Khmer (`km`) / English (`en`) bilingual strings in `ui-strings.js`.
- [x] **Automated Test Coverage:**
### Phase 4.5: AI-First Intent Pipeline & Fuse.js Grounded DOM Scanner (ADR-014)
- [x] **Direct AI Routing & Zero Premature Interception:**
  - Removed premature client-side regex blocking from `ChatBoxWidgetOverlay.jsx` and `App.jsx`. All user prompts route directly to the AI model (`/api/ai/assistant-chat`).
  - Colloquial greetings, typos, and phonetic variations (such as "heeloo brooo", "helo bro", "yo wassup") are naturally handled by the AI in both Khmer and English.
- [x] **Provider-Agnostic Structured Intent Contract:**
  - Standardized the assistant output schema to return `{ answer, triggerGuide, intentPrompt, intent: { targetQuery, action, role, category } }`.
  - Works seamlessly across OpenRouter, Google Gemini, and offline heuristics without requiring provider-specific branching.
- [x] **Zero-Hallucination Local DOM Grounding:**
  - Implemented `harvestInteractiveElements` in `dom-harvester.js` with light DOM & Shadow Root traversal, visibility checks, and identifier harvesting.
  - Implemented `matchDomElementWithFuse` in `fuse-dom-matcher.js` combining Fuse.js fuzzy text scoring with modal primacy (+40), viewport visibility (+25), and action-role affinity (+30).
  - Derived concrete CSS selectors directly from verified in-memory DOM nodes via `deriveConcreteSelector` and `safeIdSelector`.
- [x] **Automated Test Coverage:**
  - Added unit test suite `tests/fuse-dom-matcher.test.js` and expanded `tests/prompt-classifier.test.js`.
  - Total automated test count increased to **166 passing tests across 12 test suites** (100% pass rate).

### Phase 4.6: Gemini Sub-Second Primary Engine & Modal Primacy Hardening
- [x] **Gemini Sub-Second AI Integration:**
  - Configured Google Gemini (`gemini-3.6-flash` / `gemini-3-flash-preview`) and OpenRouter as the unified fast LLM engines in `GuideMe-Backend/src/services/ai.service.ts` across `askContextualAssistant`, `generateDomGuideSteps`, `generateGuideSteps`, and `rerankIntentCandidates`.
  - Replaced high-latency reasoning token generation with sub-second structured JSON responses (<800ms).
  - Maintained Google Gemini rotating key pool as the robust high-availability secondary tier.
- [x] **DOM Observer Modal Primacy & Backdrop Isolation (Option 1A):**
  - Added `DomObserver.getActiveModal()` detecting open `<dialog>`, `[role="dialog"]`, `[aria-modal="true"]`, and Google Docs dialogs.
  - Enforced active modal scoping in `DomObserver.findElement`: elements behind active modal backdrops are filtered out, locking spotlights directly onto foreground dialog targets.
  - Added accessible same-origin `iframe.contentDocument` traversal in `querySelectorAllDeep`.
- [x] **Google Docs Tutorial Catalog Hardening (Option 1B):**
  - Tightened `share-document-guide.json` Step 2 selectors by scoping inputs to `[role='dialog']` and removing collisions with Google Docs top-left toolbar combobox (`docs-material-menu-search-input`).
- [x] **Automated Test Coverage:**
  - All 35 backend tests passing (`vitest run`).
  - All 166 engine and extension tests passing (`pnpm test`).
  - Clean extension build (`994.6 kB`).

### Phase 4.7: Conversational AI Greeting & Resilient Fallback Engine
- [x] **Conversational Greeting & Non-Actionable Heuristic:**
  - Replaced rigid `"For help regarding '...': Please check the highlighted element"` template in `ai.service.ts` with conversational intent recognition (greetings, gratitude, identity/bot capabilities, general questions).
  - Bilingual parity: Greetings naturally respond in Khmer (`"សួស្ដី! ខ្ញុំជា GuideMe AI Assistant..."`) and English (`"Hello! I am your GuideMe AI Assistant..."`).
- [x] **Zod Intent Schema Tolerance:**
  - Added `z.preprocess` to `ContextualAssistantResponseSchema` in `ai-schema.validator.ts` so non-object LLM intent values (such as `"greeting"` or `null`) gracefully normalize to `null` instead of causing validation failures that discard valid AI answers.
- [x] **Fast Timeout & Model Availability:**
  - Configured `GEMINI_MODEL="gemini-3-flash-preview"` with 2500ms timeout for rapid sub-second responses without Google 503 high-demand stalls.
- [x] **Multi-Key Round-Robin & Quota Resilience:**
  - Added multi-key pool resolution in `ai.service.ts` supporting `GEMINI_API_KEY`, `GEMINI_API_KEY_2`, and `GEMINI_API_KEYS`.
  - Implemented `getOrderedGeminiApiKeys()` to alternate which key is tried first on every request (50/50 round-robin load distribution).
  - Automatically fails over to the alternate key if any key encounters HTTP 429 (quota exceeded) or 503 errors, doubling rate capacity.
- [x] **Test Verification:**
  - Added unit test cases for greeting, gratitude, identity, and round-robin key rotation in `services.test.ts`. 36/36 backend tests and 166/166 monorepo tests passing.

---

## 3. Upcoming Roadmap

### Phase 5: Two-Stage Intent Resolution (ADR-006) Integration

- [x] **ADR-006 Dynamic Analyzer Integration**: `DynamicPageAnalyzer.generateDynamicTutorialAsync` now accepts an `options.reranker` parameter. When a non-local `BaseIntentReranker` is provided, the method runs `IntentResolver.resolve()` (Stage 1 Fuse.js + Stage 2 LLM) instead of the direct Gemini/NVIDIA API path. This keeps all API keys server-side via `BackendIntentApiClient`.
- [x] **Content Script Bridge**: `useContentBridge.js` instantiates `IntentRegistry.fromEnv(import.meta.env)` and passes the reranker into every dynamic guide generation call — both the `START_DYNAMIC_GUIDE` message handler and the `handleStartDynamicGuide` function.
- [x] **Test Coverage**: Added `generateDynamicTutorialAsync uses intent-resolver path` unit test verifying the full pipeline with a mock `IntentRegistry` LLM reranker. Total test count increased to **148 passing tests** (100% pass rate).

### Phase 6: Production Hardening & PiP Positioning Fixes
- [x] **PiP Window `createPipWindow` refactored**: Replaced `window.screen` (unavailable in Service Workers) with `chrome.windows.get()` to derive real browser window bounds. Added `clampIntoView` logic to keep the PiP fully visible on screen.
- [x] **Popup Guard**: Backend AI fetch wrapped in `if (baseUrl)` to prevent `net::ERR_CONNECTION_REFUSED` when no backend is running.
- [x] **Synthetic Hover Events**: `ChromeAdapter.findTarget` now dispatches `pointerover`/`mouseover`/`focusin` events on resolved elements before measuring, enabling flyout menus to become visible.
- [x] **Hysteresis Position Tracking**: `ChromeAdapter.observeTargetPosition` uses 4px hysteresis and a dedicated `boxesDiffer` comparator to reduce redundant re-renders.
- [x] **Target Resolution Timeout**: Engine target polling increased from 1500ms to 5000ms for reliability on slow SPA pages.
- [x] **Backend Error Propagation**: `errorHandler.ts` now uses typed `AppError` interface with `statusCode` + `code`, propagating structured service-level errors to the API client.
- [x] **Dynamic Step Generation Timeout Alignment**: Content-script `generate-steps` requests now allow the backend's 12-second model budget to complete, clean up abort timers reliably, and use a deterministic offline fallback without issuing a second LLM request after timeout.
- [x] **Backend Target Hydration**: LLM-generated steps are rebound to stable selectors from the live DOM candidate list before activation, with exact-text resolution for generic menu containers such as `div[role="menuitem"]`.
- [x] **Dynamic Menu Target Recovery**: Target resolution ignores hidden matches and polls for controls revealed by menu/dialog interactions, covering SPA and shadow-root visibility changes beyond document-level mutation events.
- [x] **Exact Menu Text Matching**: Prevented menu labels such as `New` from matching unrelated accessible labels such as `Show all comments 0 new comments`.
- [x] **Incremental Dynamic Planning**: Single-step dynamic responses rescan the live DOM and append one next action after each successful interaction so hidden menu/dialog steps are resolved in their actual UI state; complete multi-step responses are preserved instead of being truncated.
- [x] **Post-Event State Synchronization**: Continuation scans wait for host event handling and a quiet DOM mutation window, use visibility-aware candidates, and request an explicit single next action from the backend.
- [x] **Tutorial Selector Hardening**: `welcome-tour.json` simplified CSS selectors to be more resilient across different web page layouts.

### Phase 7: Crawlee DOM Crawler & Path Graph Engine
- [x] **Created `@guideme/crawlee-engine` package**: New workspace package integrating Crawlee + Playwright for automated website mapping.
- [x] **`CrawleeDOMAnalyzer` class**: Full implementation of button/interactive-element extraction, click simulation, URL navigation tracking, and DOM mutation detection.
- [x] **Path Graph Builder**: Constructs `{ nodes, edges }` JSON graph capturing all button-to-destination mappings including `navigation`, `client_route`, and `dom_mutation` edge types.
- [x] **DOM Extractor Utilities**: `extractInteractiveElements`, `isElementVisible`, `generateStateChangedUrl` for cross-page element discovery and state-change detection.
- [x] **Dual Mode API**: Both `CrawlerDOMAnalyzer` class (for configuration) and `crawlDom()` convenience function.
- [x] **Test Suite**: 14 unit tests covering analyzer instantiation, path graph builder, edge deduplication, and URL generation.
- [x] **Usage Examples**: `examples/usage.js` demonstrating class usage, convenience function, and AI integration patterns.


