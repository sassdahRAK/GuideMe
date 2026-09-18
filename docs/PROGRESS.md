# GuideMe Project Progress Tracker

*Tracks project health, completed milestones, and upcoming roadmap.*

---

## 1. Project Health & Test Status

- **Automated Test Suite:** 179/179 unit tests passing across all 12 core suites (`tests/engine.test.js`, `tests/dynamic-analyzer.test.js`, `tests/prompt-classifier.test.js`, `tests/intent-resolver.test.js`, `tests/fuse-dom-matcher.test.js`, `tests/rescue-engine.test.js`, `tests/tutorial-overlay-render.test.js`, etc.).
- **TypeScript Health:** `pnpm typecheck` (`tsc --noEmit`) passes with 0 errors across `@guideme/engine`, `@guideme/chrome-adapter`, and `apps/chrome-extension`.
- **TypeScript Migration Scorecard:** **61/75 files (81.3%)** in native TypeScript:
  - `@guideme/engine`: 34/34 TS files (100.0%)
  - `@guideme/chrome-adapter`: 6/6 TS files (100.0%)
  - `apps/chrome-extension`: 21/21 TS files (100.0%)
  - `@guideme/tutorial-ui`: 0/14 files (Phase 7 - next)
- **Build Status:** Manifest V3 production bundle (`apps/chrome-extension/.output/chrome-mv3`) compiling cleanly via WXT + Vite in 2.2s (1.04 MB).
- **Monorepo Architecture:** Clean 3-package layout (`@guideme/engine`, `@guideme/chrome-adapter`, `@guideme/tutorial-ui`) + host extension app (`apps/chrome-extension`).
- **Specification Status:** Documentation unified under `docs/` and bound to root `AGENTS.md`.

---

## 2. Completed Milestones

### Phase 1: Core Headless Engine & Monorepo Foundation
- [x] Initialized monorepo with PNPM workspaces; consolidated into 3 core packages (`engine`, `chrome-adapter`, `tutorial-ui`) and host app (`chrome-extension`) per ADR-015.
- [x] Migrated `@guideme/engine` types, schemas, and adapter contracts to TypeScript with strong domain models (`TutorialDefinition`, `StepAction`, `ValidationResult`).
- [x] Enhanced `SchemaValidator` with self-healing for LLM dynamic outputs (missing `name`, `matchUrls`, action/validation defaults) and strict bilingual validation.
- [x] Implemented `TutorialEngine` finite state machine (`IDLE`, `LOADING`, `STEP_ACTIVE`, `VALIDATING`, `STEP_COMPLETED`, `PAUSED`, `COMPLETED`, `ERROR`).
- [x] Implemented `ValidationEngine` supporting `click`, `input`, `change`, `submit`, `url_change`, and `manual_next`.
- [x] Created `TutorialParser` and schema validator with Zod checks.

### Phase 2: Chrome Adapter & Isolated UI Overlay
- [x] Developed `ChromeAdapter` with `DOMObserver`, `MutationObserver` element polling, and `URLListener`.
- [x] Migrated 100% of `@guideme/chrome-adapter` to native TypeScript (`chrome-adapter.ts`, `dom-observer.ts`, `event-listener.ts`, `url-listener.ts`, `chrome-storage.ts`, `index.ts`) with zero type diagnostics.
- [x] Resilient selector auto-sanitization (handling `#:<id>` colons and invalid CSS identifiers) and dialog container disambiguation in `dom-observer.ts`.
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

### Phase 7: Infrastructure Gaps — Redis, S3/R2 CDN, Proactive Stuck Detection

- [x] **Redis Caching Layer (`GuideMe-Backend`):**
  - Created `src/config/redis.ts` — ioredis singleton with graceful degradation (no crash when `REDIS_URL` is absent), `lazyConnect`, 3-retry cap, and `enableOfflineQueue: false`.
  - Three namespaced cache layers: `guideme:session:{userId}` (24 h TTL), `guideme:ai_rate:{userId}:{date}` (expires at next UTC midnight), `guideme:tts:{sha256hash}` (30-day TTL).
  - Upgraded `aiRateLimit.ts` to Redis-first atomic `INCR` + `EXPIRE NX` pipeline — sub-millisecond quota checks, zero DB round-trip on hot path. Prisma counter still updated fire-and-forget for analytics/billing dashboards. Falls back transparently to Prisma when Redis is unavailable.
  - `env.ts` extended with `REDIS_URL` and `REDIS_DISABLED` vars. `.env.example` updated.

- [x] **S3 / Cloudflare R2 Audio CDN (`GuideMe-Backend`):**
  - Installed `@aws-sdk/client-s3` v3. Rewrote `tts.service.ts` with a 4-layer storage cascade:
    1. **Redis URL cache** — instant lookup by SHA-256 hash, zero re-synthesis.
    2. **S3/R2 `HeadObject` existence check** — idempotent; skips re-upload if audio already on CDN.
    3. **Edge TTS synthesis** → uploads buffer to R2/S3 via `PutObjectCommand` with `public-read` ACL + 30-day `Cache-Control`; falls back to local disk when `S3_BUCKET` is unset.
    4. **Browser Web Speech API** fallback signal returned to client.
  - `buildPublicUrl` resolves: `CDN_BASE_URL` → S3-compatible endpoint URL → standard AWS virtual-hosted URL.
  - `env.ts` extended with `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `CDN_BASE_URL`. `.env.example` updated.

- [x] **Proactive Stuck Detection (`@guideme/chrome-extension`):**
  - Created `useStuckDetector.js` hook — passive idle monitor listening to `mousemove`, `mousedown`, `keydown`, `scroll`, `touchstart`, `click` events.
  - After 45 seconds of inactivity (configurable `idleThresholdMs`) with no active tutorial, renders a lightweight Shadow-DOM-safe nudge card (pure DOM, no React dependency) inside the existing `uiContainer`.
  - Nudge card: bilingual (Khmer-first via `getUIString`), dark-mode aware, auto-dismisses after 15 s. CTA opens the floating prompt widget. Dismiss snoozes for 3 minutes (`snoozeMs`). Immediately cancelled if engine becomes active.
  - Wired into `TutorialApp.jsx` via `useStuckDetector({ engineState, uiContainer, language, onNudgeAccepted })`.
  - Four new bilingual strings added to `ui-strings.js`: `stuckNudgeTitle`, `stuckNudgeBody`, `stuckNudgeCta`, `stuckNudgeDismiss`.

- [x] **DOM Observer & Event Listener Hardening (bonus fixes found during test run):**
  - `DomObserver.findElement` now sanitizes CSS selectors via `sanitizeCssSelector` before passing to `querySelectorAllDeep` — prevents `querySelectorAll` throwing on IDs like `#:6j`.
  - Composite CSS selectors (`A, B, C`) are now split and queried part-by-part; results are scored — leaf interactive controls (score=1) win over dialog/modal container elements (score=0) when text constraints are present.
  - `DomEventListener.listen` now sanitizes the CSS selector before calling `event.target.matches()` / `.closest()` — eliminates uncaught `SyntaxError` on invalid selectors.
  - `tests/tutorial-overlay-render.test.js` Windows ESM path fixed (`file:///C:/...` URL scheme).
  - `@babel/parser` and `@babel/traverse` added as root workspace dev dependencies.

- [x] **Test & Build Verification:**
  - **177/177 monorepo tests passing** (100% pass rate, +1 new test from existing suite now passing).
  - **Clean extension build** — `1.06 MB`, `3.9 s` (`apps/chrome-extension/.output/chrome-mv3`).

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

