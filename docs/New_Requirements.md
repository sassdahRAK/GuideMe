# Universal Tutorial Engine (GuideMe) — Master Product & Technical Requirements

**Document Version:** 2.0.0 (Unified Master Specification)  
**Status:** Draft / Consolidation Pending Architecture Review  
**Target Platform:** Chrome Extension (Manifest V3) with WXT + React + JavaScript 
**Target Environments:** Universal Web (Any URL) & Showcase High-Complexity SaaS (Google Docs, Microsoft 365, Zoom, Notion, Microsoft Teams, etc.)  
**Architecture:** Decoupled Multi-Layer Engine (Headless Core + Chrome Adapter + Shadow DOM UI + Dynamic Auto-Guider)

---

## 1. Executive Summary & Core Concept

**GuideMe** is an interactive, non-intrusive in-browser tutorial engine delivered as a browser extension. It overlays contextual spotlights, tooltips, and interactive checkpoints onto any target web application to guide learners through complex workflows step-by-step.

The unified vision combines two powerful guiding models:
1. **Precision Curated Guidance:** Declarative, high-fidelity JSON schemas tailored for complex web applications (e.g., Google Docs, Microsoft 365, Zoom, Notion, Microsoft Teams, SaaS tools) with precise step preconditions and multi-strategy DOM resolution.
2. **Dynamic Auto-Detection (Zero-Config):** An intelligent on-page pattern analyzer that scans any unconfigured website, classifies page types (e-commerce, login forms, settings, dashboards), identifies interactive components, and automatically synthesizes contextual walkthroughs on the fly.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GUIDEME OPERATIONAL MODES                          │
│                                                                             │
│  Mode 1: Curated Schema Mode                 Mode 2: Dynamic Auto-Guide     │
│  ┌─────────────────────────────┐             ┌───────────────────────────┐  │
│  │ Verified Tutorial Schemas   │             │ Universal DOM Page Scan   │  │
│  │ (e.g. Google Docs Guides)   │             │ (Form / Nav / E-Commerce) │  │
│  └──────────────┬──────────────┘             └─────────────┬─────────────┘  │
│                 │                                          │                │
│                 ▼                                          ▼                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │             Unified Decoupled Headless Engine (State Machine)         │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │                                       │
│                                     ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │      Isolated Shadow DOM UI (Spotlight Mask + Smart Floating Tooltip) │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Resolved Architectural Decisions

> [!NOTE]
> All core architectural decisions between curated schema guidance and universal dynamic auto-guiding have been consolidated and resolved below.

### Architectural Decision 1: Tutorial Generation & Authoring Model (RESOLVED)
- **Choice A (Schema-First / Curated Guides):** Guides authored as declarative JSON schemas (or via Layer 7 Authoring Studio) for high-precision workflows (e.g., Google Docs, enterprise SaaS).
- **Choice B (Dynamic Heuristic / Auto-Detection):** Zero-configuration on-the-fly DOM parsing using pattern recognition templates (e-commerce, login, settings) for generic websites.
- **Adopted Decision: Hybrid Engine**
  - **Primary Route:** When a matching curated tutorial schema exists for the active domain/URL, load and execute the high-fidelity schema.
  - **Dynamic Fallback / Exploration Mode:** When browsing unconfigured web pages, provide an "Auto-Guide Me" action powered by the Dynamic Page Analyzer and pattern library to generate interactive steps on the fly.
- *Status:* **DECIDED (Hybrid Engine Adopted)**

### Architectural Decision 2: UI Injection & Styling Architecture (RESOLVED)
- **Choice A (Shadow DOM + SVG Spotlight Cutout):** Renders inside an isolated Shadow Root (`createShadowRootUi`), using dark SVG/Canvas mask cutouts and floating tooltips with auto-flip positioning. Eliminates CSS collisions with host applications.
- **Choice B (Host DOM CSS Injection + Color-Coded Outlines):** Directly injects fixed CSS overlay classes (`.highlight-overlay`, `.button-highlight` emerald, `.input-highlight` blue, `.link-highlight` amber, top-left step indicator).
- **Adopted Decision: Shadow DOM Isolation with Semantic Color-Coded Overlays**
  - All overlay components mount strictly inside an isolated Shadow Root via WXT `createShadowRootUi` to prevent any CSS bleed with host applications.
  - The spotlight cutout incorporates semantic accent borders (emerald for buttons, blue for inputs, amber for navigation) and floating tooltips with auto-flip viewport collision avoidance.
- *Status:* **DECIDED (Shadow DOM + Semantic Color Accents Adopted)**

### Architectural Decision 3: Storage & Progress Scope (RESOLVED)
- **Choice A (`chrome.storage.local` across sessions):** Persists step progress permanently across browser restarts and tab closures.
- **Choice B (`localStorage` per tab only):** Retains progress only during the active tab lifecycle.
- **Adopted Decision: Session-Durable Storage with Ephemeral Mode Support**
  - Use `chrome.storage.local` keyed by `tutorialId + domain + userSession` to ensure robust persistence across tab closures and browser restarts for curated workflows.
  - Ephemeral per-tab state is maintained in-memory for ad-hoc dynamic auto-guides.
- *Status:* **DECIDED (Durable `chrome.storage.local` Adopted)**

### Architectural Decision 4: Extension Match Permissions (RESOLVED)
- **Choice A (Scoped Host Matches):** Explicit host permissions (e.g., `https://docs.google.com/*`, specified domain lists). Lower security footprint.
- **Choice B (Universal `<all_urls>`):** Runs content scripts across all web pages to enable universal auto-guiding everywhere.
- **Adopted Decision: Universal URL Support with On-Demand Content Scripting**
  - Configure `<all_urls>` host permissions in `manifest.json` combined with `activeTab` and dynamic scripting injection so the extension can universally auto-guide any page when invoked by the user, while minimizing background resource consumption.
- *Status:* **DECIDED (Universal Support via `<all_urls>` + Dynamic Injection Adopted)**

---

## 3. User Personas

| Persona | Role | Primary Goal & Behavior |
|---|---|---|
| **Learner (End User)** | Browses web apps / Google Docs | Follows guided interactive instructions, receives visual spotlight feedback, learns by doing without leaving the interface. |
| **Creator / Author** | Defines structured tutorials | Creates and publishes declarative JSON tutorial flows (or uses Authoring Studio) specifying selectors, actions, and validation checkpoints. |
| **Casual Explorer** | Visits arbitrary websites | Enables Dynamic Auto-Guide to quickly discover how to navigate unfamiliar web portals, checkout flows, or dashboards. |
| **Admin / Enterprise Manager** | Manages team onboarding | Tracks tutorial completion metrics, assigns standard operational workflows, and audits compliance. |

---

## 4. Comprehensive Use Cases

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USE CASE OVERVIEW                               │
│                                                                              │
│    ┌──────────────────────────────────────────────────────────────────┐      │
│    │               UC-1: Discover & Trigger Tutorial                  │      │
│    │     (Curated Guide Selection OR Dynamic Page Auto-Detection)     │      │
│    └────────────────────────────────┬─────────────────────────────────┘      │
│                                     │                                        │
│                                     ▼                                        │
│    ┌──────────────────────────────────────────────────────────────────┐      │
│    │          UC-2: Dynamic Element Scan & Page Classification        │      │
│    │            (Form / E-Commerce / Navigation / Dashboard)          │      │
│    └────────────────────────────────┬─────────────────────────────────┘      │
│                                     │                                        │
│                                     ▼                                        │
│    ┌──────────────────────────────────────────────────────────────────┐      │
│    │            UC-3: Render Spotlight Mask & Floating Tooltip        │      │
│    │             (Shadow DOM, Color Codes, Dynamic Cutout)            │      │
│    └────────────────────────────────┬─────────────────────────────────┘      │
│                                     │                                        │
│                                     ▼                                        │
│    ┌──────────────────────────────────────────────────────────────────┐      │
│    │            UC-4: Perform Action & Multi-Type Validation          │      │
│    │             (Click, Input, Change, Submenu, Navigation)          │      │
│    └────────────────────────────────┬─────────────────────────────────┘      │
│                                     │                                        │
│                      ┌──────────────┴──────────────┐                         │
│                      ▼                             ▼                         │
│       ┌──────────────────────────────┐ ┌──────────────────────────────┐      │
│       │  UC-5: Dynamic Modal/Menu    │ │  UC-6: Real-time Resize/     │      │
│       │        Observation           │ │        Scroll Tracking       │      │
│       └──────────────────────────────┘ └──────────────────────────────┘      │
│                      │                             │                         │
│                      └──────────────┬──────────────┘                         │
│                                     ▼                                        │
│    ┌──────────────────────────────────────────────────────────────────┐      │
│    │            UC-7: Save, Resume, or Reset Progress                 │      │
│    │                 (Multi-session Storage Sync)                     │      │
│    └────────────────────────────────┬─────────────────────────────────┘      │
│                                     │                                        │
│                      ┌──────────────┴──────────────┐                         │
│                      ▼                             ▼                         │
│       ┌──────────────────────────────┐ ┌──────────────────────────────┐      │
│       │  UC-8: Dismiss, Pause &      │ │  UC-9: Analytics & Survey    │      │
│       │        Clean Teardown        │ │        Data Capture          │      │
│       └──────────────────────────────┘ └──────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### UC-1: Discover & Trigger Tutorial
- **Primary Actor:** Learner / Explorer
- **Precondition:** Extension is installed; user navigates to any URL (e.g., `https://docs.google.com/document/d/*`, Amazon, GitHub, Jira).
- **Trigger Methods:**
  - *Method A (Curated List):* User clicks extension icon, views matching guides (e.g., *"How to Share & Manage Permissions in Google Docs"*), and clicks **"Start Guide"**.
  - *Method B (Dynamic Auto-Guide):* User clicks **"Auto-Guide Page"** in popup on an unscripted site $\rightarrow$ system analyzes page type and generates steps.
  - *Method C (Auto-Start):* Schema specifies `autoStart: true` for matching URL pattern if not previously completed.
- **Postcondition:** Tutorial Engine initializes and triggers Step 1.

### UC-2: Dynamic Element Scan & Page Classification
- **Primary Actor:** System / Chrome Adapter
- **Flow:**
  1. Content script collects page metrics (`formCount`, `inputCount`, `buttonCount`, navigation headers, tables).
  2. Pattern classifier determines page category (`e-commerce`, `loginForm`, `signupForm`, `settingsPage`, `dashboard`, `learningPlatform`, `generic`).
  3. Dynamic step generator constructs sequential guiding steps targeting classified interactive elements.

### UC-3: Render Spotlight & Floating Tooltip
- **Primary Actor:** Learner
- **Flow:**
  1. Engine resolves target selector via multi-strategy resolution.
  2. Adapter locates target DOM element (waiting if dynamically rendered).
  3. UI Layer in Shadow DOM draws an SVG dark backdrop overlay with a rounded cutout over the target.
  4. UI renders semantic border styling (emerald for buttons, blue for inputs, amber for navigation).
  5. Floating tooltip positions adjacent to element (`top`, `bottom`, `left`, `right`) with step title, description, step counter (`Step 2 of 5`), progress bar, and controls.

### UC-4: Perform & Validate Action
- **Primary Actor:** Learner
- **Flow:**
  - *Click Validation:* User clicks target element $\rightarrow$ Adapter intercepts event $\rightarrow$ Engine transitions to next step.
  - *Input Validation:* User inputs text matching regex/rule $\rightarrow$ Engine completes step.
  - *Navigation / Change:* User selects dropdown option or URL shifts $\rightarrow$ Engine advances.
  - *Informational Step:* User clicks "Next Step" on tooltip $\rightarrow$ Engine advances.

### UC-5: Dynamic Modal & Submenu Navigation
- **Primary Actor:** Learner
- **Precondition:** Workflow requires opening dropdowns (e.g., Docs Insert menu, modal dialogs).
- **Flow:**
  1. User clicks menu trigger in Step $N$.
  2. Step $N+1$ targets dynamically mounted submenu item.
  3. Adapter's `MutationObserver` detects target element appearance.
  4. Spotlight and tooltip smoothly reposition over the newly rendered modal/menu item.

### UC-6: Real-Time Position Tracking & Viewport Sync
- **Primary Actor:** Learner
- **Flow:**
  1. User scrolls host webpage or resizes window during active step.
  2. Adapter continuously tracks `DOMRect` bounding box via `ResizeObserver` and scroll listeners.
  3. Spotlight cutout and tooltip reposition smoothly at 60 FPS without jitter or lag.

### UC-7: Save & Resume Progress
- **Primary Actor:** Learner
- **Flow:**
  1. User completes step 3 of 6, then closes browser tab.
  2. User reopens application later and opens GuideMe popup.
  3. Extension displays saved progress badge ("Step 3 of 6 Completed").
  4. User clicks "Resume" $\rightarrow$ Engine jumps directly to step 4.

### UC-8: Dismiss, Pause & Clean Teardown
- **Primary Actor:** Learner
- **Flow:**
  1. User clicks Close (✕) on tooltip or "Stop Guide" in popup.
  2. Engine dispatches cleanup signal.
  3. Overlays unmount from Shadow DOM, event listeners detach, host DOM is left 100% clean with zero style pollution or memory leaks.

### UC-9: Feedback, Survey & Analytics Capture
- **Primary Actor:** Learner / Admin
- **Flow:**
  1. On tutorial completion, an optional in-tooltip rating/survey appears ("Was this guide helpful?").
  2. Non-PII telemetry (completion time, step drop-off index, selector performance) is recorded locally or dispatched to analytics endpoint (if user opted in).

---

## 5. Functional Requirements (FR)

### FR-1: Decoupled Headless Engine (`packages/engine`)
- **FR-1.1 (State Machine):** Enforces finite states: `IDLE`, `LOADING`, `STEP_ACTIVE`, `VALIDATING`, `STEP_COMPLETED`, `PAUSED`, `COMPLETED`, `ERROR`.
- **FR-1.2 (Step Resolver):** Evaluates step preconditions, conditional branching, timeouts, and fallback degradation paths.
- **FR-1.3 (Event Bus):** Exposes typed pub/sub bus: `onStateChange`, `onStepChange`, `onValidation`, `onError`, `onComplete`.
- **FR-1.4 (Platform Agnostic Core):** Zero direct dependencies on DOM, `window`, or `chrome.*` APIs (enabling Node/testbed execution).

### FR-2: Chrome MV3 Adapter (`packages/chrome-adapter`)
- **FR-2.1 (Multi-Strategy Selector Engine):** Resolves target elements using fallback waterfall:
  1. CSS Selectors (e.g., `#docs-share-button`, `button[data-testid="submit"]`)
  2. Semantic ARIA matchers (`aria-label`, `role`)
  3. Text content matching (case-insensitive substring/regex)
  4. Fallback XPath expressions
- **FR-2.2 (Dynamic SPA Observer):** Uses `MutationObserver` with configurable timeouts (default 5000ms) to resolve asynchronously rendered elements.
- **FR-2.3 (Event Interceptor):** Safely binds to DOM events (`click`, `input`, `change`, `keydown`, `submit`) to trigger validation without breaking host handlers.
- **FR-2.4 (URL & Navigation Tracking):** Intercepts `history.pushState`, `history.replaceState`, and `popstate` to handle SPA route changes.
- **FR-2.5 (Storage Synchronizer):** Encapsulates persistence using `chrome.storage.local`.

### FR-3: Dynamic Page Analysis & Pattern Library (`packages/dynamic-analyzer`)
- **FR-3.1 (Page Inspection Module):** Automatically analyzes DOM structure on load:
  - Form counts, text inputs, password fields, select dropdowns
  - Action buttons, submit triggers, interactive `[role="button"]`
  - Navigation headers, sidebars, breadcrumbs, footers
  - Product grids, pricing badges, media players, data tables
- **FR-3.2 (Pattern Recognition Library):** Built-in templates for common web flows:
  - `loginForm`: 2 inputs + submit button
  - `signupForm`: Name + email + password + terms checkbox
  - `searchPage`: Prominent search input + submit action + result container
  - `ecommerceProduct`: Search $\rightarrow$ Select Product $\rightarrow$ Choose Options $\rightarrow$ Add to Cart $\rightarrow$ View Cart
  - `settingsPage`: Toggles, dropdowns, form controls, "Save Changes" triggers
  - `adminDashboard`: Metric widgets, sidebar navigation, table row action triggers
  - `learningPlatform`: Course enrollment, video player controls, progress bars
- **FR-3.3 (Dynamic Step Synthesizer):** Converts classified element hierarchies into executable tutorial steps when no curated schema is found.

### FR-4: UI Overlays & Rendering (`packages/tutorial-ui`)
- **FR-4.1 (60-30-10 Design System):** Strict adherence to the 60-30-10 color rule:
  - **60% Dominant:** Deep black/dark neutral backdrops (`#12141A`), spotlight mask (`rgba(15, 17, 23, 0.82)`), and card shells.
  - **30% Secondary:** Crisp white headings (`#FFFFFF`), light slate body text (`#CBD5E1`), subtle borders (`#2A2F3B`), and neutral controls.
  - **10% Focal Accent:** Warm Yellow-Orange / Amber (`#F59E0B`, hover `#D97706`) for target spotlight glow rings, primary action buttons, step badges, and active progress bar fills.
- **FR-4.2 (Spotlight Backdrop Mask):** Renders SVG/Canvas dark overlay with rounded transparent cutout around target bounding box (`DOMRect`) with warm yellow-orange pulsating focus ring (`rgba(245, 158, 11, 0.45)`).
- **FR-4.3 (Smart Floating Tooltip):** Positions dynamically relative to target (`top`, `bottom`, `left`, `right`) with auto-flip collision detection against viewport boundaries.
- **FR-4.4 (Step Controls & Indicators):** Includes Next (Warm Amber CTA), Back, Skip, Close buttons, step badge (`Step X of Y`), and animated yellow-orange progress bar.
- **FR-4.5 (A11y & Keyboard Navigation):** Supports `Escape` (dismiss), `Enter` / `ArrowRight` (advance), and focus trapping inside tooltip with AAA text-on-accent contrast.

### FR-5: Shadow DOM Isolation (`apps/chrome-extension`)
- **FR-5.1 (Zero CSS Bleed):** All overlay UI mounted inside isolated Shadow Root via WXT `createShadowRootUi`.
- **FR-5.2 (Host Immunity):** Host page styles (e.g., Google Docs CSS) cannot distort GuideMe UI; GuideMe styles cannot alter host layout or canvas.

### FR-6: Extension Architecture & Message Bus (`apps/chrome-extension`)
- **FR-6.1 (Browser Action Popup):** Displays:
  - Active domain / page title
  - Matching Curated Tutorials with status badges ("Not Started", "In Progress", "Completed")
  - "Auto-Guide This Page" action for unscripted sites
  - Tutorial management controls (Start, Resume, Restart, Clear Progress)
- **FR-6.2 (Type-Safe Messaging):** Structured communication between Popup $\leftrightarrow$ Background Service Worker $\leftrightarrow$ Content Scripts.

### FR-7: Declarative Schema Specification (`packages/tutorial-schema`)
- **FR-7.1 (JSON Schema Validation):** Standardized JSON schema for curated guides validating:
  - Tutorial metadata (`id`, `title`, `description`, `targetUrlPattern`, `version`)
  - Step definitions (`id`, `title`, `content`, `targetSelector`, `actionType`, `placement`, `validation`, `timeoutMs`)
- **FR-7.2 (Branching & Preconditions):** Supports conditional branching based on user state or DOM conditions.

### FR-8: Feedback, Research & Tier Management
- **FR-8.1 (Survey Integration):** In-guide prompt upon completion for micro-surveys and UX feedback.
- **FR-8.2 (Monetization / Feature Tiers Support):** Architecture support for Free (Standard Auto-Guide) vs Pro/Team (Custom Schemas, Analytics, Team Sharing).

---

## 6. Non-Functional Requirements (NFR)

| Category | Specification |
|---|---|
| **Performance** | Element bounding box tracking during scroll/resize must maintain $\ge$ 55 FPS with zero perceptible UI jitter. |
| **Bundle Footprint** | Content script bundle size $< 150\text{ KB}$ (minified + gzipped). |
| **Security (MV3)** | 100% compliant with Manifest V3 policies: zero `unsafe-eval`, no remote arbitrary code execution, sanitized tooltip markdown. |
| **DOM Reliability** | Graceful degradation if target element fails to mount within timeout window (fallback informational modal offering skip/manual navigation). |
| **Cross-Browser** | Architecture compatible with Chromium-based browsers (Chrome, Edge, Brave, Opera) and Firefox. |

---

## 7. Security, Privacy & Data Governance

### Data Collected (Non-PII Only)
- Tutorial step completion timestamps and durations.
- Element selector signatures (hashed, not containing sensitive user data).
- Interaction types (`click`, `submit`) and time-on-task metrics.
- Classified page categories (`e-commerce`, `settings`, `form`).

### Data NOT Collected (Strict Guarantee)
- User keystrokes in password fields or personal data inputs.
- Full webpage DOM / text content / private document contents (e.g. Google Docs text).
- User identity or cross-site tracking fingerprints.

### Permissions Architecture
```json
{
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "tabs"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

---

## 8. Dynamic vs. Curated Comparison Matrix

| Dimension | Curated Schemas (e.g. Google Docs) | Dynamic Auto-Guide (Universal) |
|---|---|---|
| **Authoring Effort** | Requires upfront JSON schema or Authoring Studio definition | Zero configuration; runs instantly on any URL |
| **Precision** | 100% deterministic, exact target validation | Heuristic classification, adaptive guidance |
| **Best Used For** | Complex SaaS workflows, enterprise onboarding, intricate multi-step apps | Generic web exploration, standard forms, e-commerce, settings pages |
| **Maintenance** | Updated when target app DOM radically shifts | Self-adapting based on recognized DOM tags and ARIA roles |
| **Engine Role** | Executed directly by Headless State Machine | Synthesized by Dynamic Analyzer, then fed to Headless State Machine |

---

## 9. Success Metrics & Key Performance Indicators (KPIs)

- **Tutorial Completion Rate:** Target $> 60\%$ across curated workflows.
- **Dynamic Classification Accuracy:** Target $> 85\%$ correct page type detection on top 100 web domains.
- **Drop-off Mitigation:** Identified drop-off points reduced by offering fallback hints at Step 3+.
- **User Satisfaction Score:** Target $\ge 4.2 / 5.0$ star rating on completed guide survey modals.
- **Render Latency:** Overlay spotlight mount time $< 50\text{ ms}$ after element detection.

---

## 10. Prioritized Implementation Roadmap

1. **Phase 1 — Core Stabilization:**
   - Decoupled headless state machine (`packages/engine`).
   - Chrome Adapter with multi-strategy selectors (`packages/chrome-adapter`).
   - Isolated Shadow DOM spotlight and tooltip renderer (`packages/tutorial-ui`).
2. **Phase 2 — Showcase Application Integration:**
   - Complete Google Docs guide suite (Sharing, Formatting, Menus, Comments).
   - Robust dynamic menu and modal mutation tracking.
3. **Phase 3 — Dynamic Page Analyzer & Pattern Library:**
   - Page classification module (`packages/dynamic-analyzer`).
   - Heuristic templates: Login, E-Commerce, Navigation, Settings, Dashboard.
   - Dynamic step synthesizer and auto-guide UI trigger.
4. **Phase 4 — Authoring Studio & Enterprise Features:**
   - Visual step recorder / Layer 7 Authoring Studio.
   - Team analytics, completion metrics, and monetization tiers.
5. **Phase 5 — Cross-Browser & Performance Hardening:**
   - Test across 50+ diverse web platforms; offline caching support.

---

## 11. Acceptance Criteria (AC)

- **AC-1 (Google Docs Showcase Highlighting):** On Google Docs (`docs.google.com/document/*`), activating the Share tutorial displays an SVG cutout spotlight over the Share button with an adjacent floating tooltip inside Shadow DOM.
- **AC-2 (Action Progression):** Clicking the real Google Docs Share button immediately validates the step and advances to the modal interaction step.
- **AC-3 (Dynamic Modal & Submenu Tracking):** Opening a top-level menu (e.g. "Insert") triggers `MutationObserver` to locate and spotlight dynamically rendered submenu items without page reload.
- **AC-4 (Viewport Lock):** Scrolling or resizing the browser window recalculates spotlight mask and tooltip position at $\ge 55\text{ FPS}$ with zero lag.
- **AC-5 (Universal Auto-Detection):** Visiting an unscripted login page or e-commerce site and clicking "Auto-Guide" correctly identifies key inputs/buttons and generates a sequential guide.
- **AC-6 (State Persistence):** Closing and reopening an in-progress tutorial page preserves the completed step index and offers a one-click "Resume" action.
- **AC-7 (Clean Teardown):** Closing/dismissing a tutorial removes all overlays, disconnects mutation observers, and restores the host DOM with 0 memory leaks or style artifacts.
