# GuideMe Project Progress Tracker

*Tracks project health, completed milestones, and upcoming roadmap.*

---

## 1. Project Health & Test Status

- **Automated Test Suite:** All test suites passing (`tests/engine.test.js`, `tests/dynamic-analyzer.test.js`, `tests/dom-observer.test.js`, `tests/prompt-classifier.test.js`).
- **Build Status:** Manifest V3 production bundle (`apps/chrome-extension/.output/chrome-mv3`) compiling cleanly via WXT + Vite.
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
- [x] Added in-page capture mode for element spotlight targeting.

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

---

## 3. Upcoming Roadmap

### Phase 5: Cloud Sync
- [ ] Organization tutorial catalog distribution API.
