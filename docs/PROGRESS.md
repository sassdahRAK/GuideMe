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

### Phase 4.4: NVIDIA AI NIM (Kimi-K3) DOM & Engine Intelligence Integration
- [x] **Live DOM Engine + AI Synergy Loop:**
  - Implemented two-stage interactive workflow: DOM Engine scans live host webpage elements (`tag`, `id`, `class`, `testId`, `ariaLabel`, `text`, `coordinates`) -> sends candidates to NVIDIA NIM -> `moonshotai/kimi-k3` reasons on user intent (Khmer/English) and maps sequential interactive steps -> Engine binds live spotlights, monitors clicks/inputs, and auto-advances.
- [x] **Headless `NvidiaDomAnalyzer` (`@guideme/engine`):**
  - Pure JS, Node & browser-compatible analyzer consuming NVIDIA NIM chat completions (`https://integrate.api.nvidia.com/v1/chat/completions`).
  - Defensive extraction with `<think>...</think>` reasoning token stripping and Markdown code fence isolation for reasoning models (e.g. `moonshotai/kimi-k3`).
  - Step candidate hydration and Zod `SchemaValidator` schema validation before passing to engine.
- [x] **Dual-Tier Secret Management Architecture:**
  - **Backend Layer (`GuideMe-Backend`):** Added secure proxy endpoint `POST /api/v1/ai/dom-guide` and `.env` credentials (`NVIDIA_API_KEY`, `NVIDIA_MODEL=moonshotai/kimi-k3`, `NVIDIA_BASE_URL`). Zero API key leakage into Chrome extension bundles; allows instant model/key rotation without waiting for Chrome Web Store reviews.
  - **Client-Side BYOK:** Settings popup allows power users/developers to optionally supply their own personal key saved locally in `chrome.storage.local`.
- [x] **Popup & UI Settings:**
  - Added AI Provider selector (NVIDIA NIM vs Google Gemini vs Cloud Proxy).
  - Added live status indicators, Khmer diacritic-safe Kantumruy typography, and full Khmer (`km`) / English (`en`) bilingual strings in `ui-strings.js`.
- [x] **Automated Test Coverage:**
### Phase 4.5: AI-First Intent Pipeline & Fuse.js Grounded DOM Scanner (ADR-014)
- [x] **Direct AI Routing & Zero Premature Interception:**
  - Removed premature client-side regex blocking from `ChatBoxWidgetOverlay.jsx` and `App.jsx`. All user prompts route directly to the AI model (`/api/ai/assistant-chat`).
  - Colloquial greetings, typos, and phonetic variations (such as "heeloo brooo", "helo bro", "yo wassup") are naturally handled by the AI in both Khmer and English.
- [x] **Provider-Agnostic Structured Intent Contract:**
  - Standardized the assistant output schema to return `{ answer, triggerGuide, intentPrompt, intent: { targetQuery, action, role, category } }`.
  - Works seamlessly across NVIDIA AI NIM (Kimi-K3), Google Gemini, and offline heuristics without requiring provider-specific branching.
- [x] **Zero-Hallucination Local DOM Grounding:**
  - Implemented `harvestInteractiveElements` in `dom-harvester.js` with light DOM & Shadow Root traversal, visibility checks, and identifier harvesting.
  - Implemented `matchDomElementWithFuse` in `fuse-dom-matcher.js` combining Fuse.js fuzzy text scoring with modal primacy (+40), viewport visibility (+25), and action-role affinity (+30).
  - Derived concrete CSS selectors directly from verified in-memory DOM nodes via `deriveConcreteSelector` and `safeIdSelector`.
- [x] **Automated Test Coverage:**
  - Added unit test suite `tests/fuse-dom-matcher.test.js` and expanded `tests/prompt-classifier.test.js`.
  - Total automated test count increased to **166 passing tests across 12 test suites** (100% pass rate).

### Phase 4.6: Gemini Sub-Second Primary Engine & Modal Primacy Hardening
- [x] **Gemini Sub-Second AI Integration (Option 2B):**
  - Configured Google Gemini (`gemini-3.6-flash`) as the primary fast LLM engine in `GuideMe-Backend/src/services/ai.service.ts` across `askContextualAssistant`, `generateDomGuideSteps`, `generateGuideSteps`, and `rerankIntentCandidates`.
  - Replaced high-latency reasoning token generation with sub-second structured JSON responses (<500ms).
  - Maintained NVIDIA NIM (`moonshotai/kimi-k3` / `meta/llama-3.3-70b-instruct`) as the robust secondary fallback tier.
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

### Phase 5: Cloud Sync
- [ ] Organization tutorial catalog distribution API.

