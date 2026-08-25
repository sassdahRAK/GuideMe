# Universal Tutorial Engine (GuideMe) — Functional Requirements & Use Cases

**Document Version:** 1.0.0  
**Target Platform:** Chrome Extension (Manifest V3) with WXT + React + JavaScript  
**Target Application Showcase:** Google Docs (`https://docs.google.com/document/*`)  
**Architecture:** Decoupled 7-Layer Universal Tutorial Engine  

---

## 1. Product Overview & Core Objectives

**GuideMe** is an interactive, non-intrusive in-browser tutorial engine delivered as a browser extension. It overlays contextual spotlights, tooltips, and interactive checkpoints onto any target web application (e.g., Google Docs, Google Workspace, Jira, AWS Console, custom SaaS) to guide learners through complex workflows step by step.

### Key Value Propositions
- **Platform Agnostic Core:** Engine business logic runs independently of the browser DOM or extension APIs.
- **Zero Host Contamination:** UI overlays are injected via Shadow DOM, preventing styles from leaking into or getting corrupted by host web pages like Google Docs.
- **Action-Driven Progression:** Steps advance not just via "Next" button clicks, but by observing real user actions (e.g., clicking a toolbar icon, opening the Share dialog, typing into a field, navigating menus).
- **SPA & Canvas/IFrame Resilience:** Works seamlessly across dynamic Single Page Applications with dynamic DOM mutations, client-side menus, and dynamic toolbars.

---

## 2. User Personas

| Persona | Role | Primary Goal |
|---|---|---|
| **Learner (End User)** | Uses Google Docs while being guided | Follows interactive instructions, receives instant visual feedback, and learns how to format, collaborate, share, or structure documents. |
| **Creator / Author** | Defines tutorial flows | Writes declarative JSON step schemas (or uses the Layer 7 Authoring Studio) specifying selectors, actions, and validation rules for Google Docs and other web apps. |

---

## 3. Use Cases

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             USE CASE DIAGRAM                             │
│                                                                          │
│                 ┌──────────────────────────────────────┐                 │
│                 │ UC-1: Discover & Trigger Tutorial    │                 │
│                 └──────────────────────────────────────┘                 │
│                                    │                                     │
│                                    ▼                                     │
│                 ┌──────────────────────────────────────┐                 │
│                 │ UC-2: Render Spotlight & Tooltip     │                 │
│                 └──────────────────────────────────────┘                 │
│                                    │                                     │
│                                    ▼                                     │
│                 ┌──────────────────────────────────────┐                 │
│                 │ UC-3: Perform & Validate Action      │                 │
│                 └──────────────────────────────────────┘                 │
│                                    │                                     │
│                 ┌──────────────────┴───────────────────┐                 │
│                 ▼                                      ▼                 │
│ ┌──────────────────────────────┐     ┌─────────────────────────────────┐ │
│ │ UC-4: Dynamic Modal & Menus  │     │ UC-5: Real-time Track & Resize  │ │
│ └──────────────────────────────┘     └─────────────────────────────────┘ │
│                 │                                      │                 │
│                 └──────────────────┬───────────────────┘                 │
│                                    ▼                                     │
│                 ┌──────────────────────────────────────┐                 │
│                 │ UC-6: Save & Resume Progress         │                 │
│                 └──────────────────────────────────────┘                 │
│                                    │                                     │
│                                    ▼                                     │
│                 ┌──────────────────────────────────────┐                 │
│                 │ UC-7: Dismiss, Pause, or Restart     │                 │
│                 └──────────────────────────────────────┘                 │
└──────────────────────────────────────────────────────────────────────────┘
```

### UC-1: Discover & Trigger Tutorial
- **Primary Actor:** Learner
- **Precondition:** Extension is installed; user navigates to a supported web page (e.g. `https://docs.google.com/document/d/*` or `https://docs.google.com/document/u/0/`).
- **Trigger:**
  - *Method A (Manual):* User clicks the GuideMe extension icon in the toolbar, sees available Google Docs tutorials (e.g. *"How to Share & Manage Permissions"*, *"Formatting Headings & Table of Contents"*), and clicks "Start Guide".
  - *Method B (Auto-trigger):* Tutorial schema specifies `autoStart: true` for the URL matching rule if the user has never completed it.
- **Postcondition:** Tutorial engine initializes, and Step 1 is loaded on Google Docs.

### UC-2: Render Spotlight & Floating Tooltip
- **Primary Actor:** Learner
- **Flow:**
  1. Engine resolves the target selector for the active step (e.g., Google Docs Share button `#docs-share-button` or `#insertMenu`).
  2. Chrome Adapter finds the DOM element (waiting if the Google Docs UI is still rendering).
  3. UI layer renders an SVG/Canvas backdrop overlay with a cutout (spotlight) over the button.
  4. UI layer positions a floating tooltip adjacent to the element (`top`, `bottom`, `left`, `right`) with step title, description, and controls.
- **Postcondition:** The target element is prominently highlighted, while the rest of the Google Docs interface is dimmed.

### UC-3: Perform & Validate Action
- **Primary Actor:** Learner
- **Flow:**
  - *Scenario A (Click Validation):* Step prompts the user to click the highlighted "Share" button. User clicks the real DOM element $\rightarrow$ Adapter intercepts event $\rightarrow$ Engine transitions to the next step.
  - *Scenario B (Input Validation):* Step prompts the user to type an email in the sharing modal input. User types text $\rightarrow$ Validation engine confirms match $\rightarrow$ Step completes.
  - *Scenario C (Informational / Next Button):* Step is purely informative (e.g., explaining document version history). User clicks "Next Step" on the GuideMe tooltip $\rightarrow$ Engine advances.
- **Postcondition:** Step transitions smoothly to Step $N+1$ or triggers the completion screen.

### UC-4: Dynamic Modal & Menu Navigation
- **Primary Actor:** Learner
- **Precondition:** Tutorial requires interacting with Google Docs dropdown menus (e.g., File, Insert) or dynamic overlay dialogs (e.g., Share modal, Page Setup).
- **Flow:**
  1. Step $N$ completes upon clicking a top-level menu (e.g. "Insert").
  2. Step $N+1$ targets a submenu item that is rendered dynamically into the DOM (e.g., "Table" or "Comment").
  3. Adapter's `MutationObserver` detects the newly rendered menu item in the Google Docs overlay layer.
  4. Spotlight and tooltip smoothly reposition over the newly opened menu/dialog element.
- **Postcondition:** Tutorial continues across dynamic modals and popover menus without losing context.

### UC-5: Real-time Element Position Tracking
- **Primary Actor:** Learner
- **Flow:**
  1. User scrolls the Google Docs document or resizes the browser window while a tooltip is active.
  2. Target toolbar element or sidebar moves or changes dimensions.
  3. Adapter continuously tracks element bounding box (`DOMRect`) using `ResizeObserver` / scroll listeners.
  4. Tooltip and spotlight recalculate coordinates at 60fps without lag or jitter.
- **Postcondition:** Spotlight mask and tooltip remain locked to the Google Docs element at all times.

### UC-6: Progress Saving & Resume
- **Primary Actor:** Learner
- **Flow:**
  1. User completes Step 2 of 4 in *"Google Docs Sharing Guide"*, then closes the document tab.
  2. User re-opens Google Docs later and opens the GuideMe popup.
  3. GuideMe detects saved progress in `chrome.storage.local` ("Step 2 of 4 completed").
  4. User clicks "Resume Tutorial" $\rightarrow$ Engine jumps directly to Step 3.
- **Postcondition:** User does not need to repeat previously completed steps.

### UC-7: Dismiss, Pause, or Restart
- **Primary Actor:** Learner
- **Flow:**
  1. User clicks the "Close" (✕) button on the tooltip or clicks "Stop Guide" from the extension popup.
  2. Engine dispatches cleanup command $\rightarrow$ Spotlight and tooltips unmount from the Shadow DOM.
  3. Target DOM event listeners are removed, leaving Google Docs completely untouched.
- **Postcondition:** Google Docs document returns to 100% normal state with zero remaining overlays.

---

## 4. Functional Requirements (FR)

### FR-1: Headless Execution Engine (`packages/engine`)
- **FR-1.1 (State Machine):** Must manage finite states: `IDLE`, `LOADING`, `STEP_ACTIVE`, `VALIDATING`, `STEP_COMPLETED`, `PAUSED`, `COMPLETED`, `ERROR`.
- **FR-1.2 (Step Resolver):** Must evaluate step preconditions, branching logic, and fallback timeouts.
- **FR-1.3 (Event Bus):** Must provide a publish/subscribe event system for engine state changes (`onStateChange`, `onStepChange`, `onError`).
- **FR-1.4 (Platform Agnostic):** Engine package must have zero dependencies on `window`, `document`, or `chrome.*` APIs.

### FR-2: Chrome MV3 Adapter (`packages/chrome-adapter`)
- **FR-2.1 (DOM Query & Waiting):** Must support multi-strategy selector resolution:
  1. CSS Selector (e.g. `#docs-share-button`, `div[aria-label="Share"]`)
  2. `aria-label` / `role` matchers (standard in Google Docs UI)
  3. Text content matching (case-insensitive)
  4. Fallback XPath
- **FR-2.2 (SPA Observer):** Must use `MutationObserver` to wait for dynamic elements (configurable timeout, default 5000ms).
- **FR-2.3 (Event Interception):** Must listen to user DOM actions (`click`, `input`, `change`, `submit`) and notify the validation engine.
- **FR-2.4 (Storage Persistence):** Must implement progress save/load using `chrome.storage.local`.
- **FR-2.5 (URL Monitoring):** Must hook into `history.pushState`, `history.replaceState`, and `window.addEventListener('popstate')`.

### FR-3: UI Overlays & Rendering (`packages/tutorial-ui`)
- **FR-3.1 (Spotlight Mask):** Must render a smooth dark overlay with a transparent cutout matching the target element's exact bounding box and border radius.
- **FR-3.2 (Floating Tooltip):** Must render anchored next to the target with auto-flip logic (if tooltip overflows bottom viewport, flip to top).
- **FR-3.3 (Step Navigation Controls):** Must include "Next", "Back", "Skip", and "Close" controls, dynamic progress counters (`Step 2 of 5`), and progress bar.
- **FR-3.4 (Keyboard Accessibility):** Must allow pressing `Escape` to close and `Enter` / `ArrowRight` to advance when applicable.

### FR-4: Shadow DOM Isolation (`apps/chrome-extension`)
- **FR-4.1 (Zero CSS Bleed):** All tutorial UI elements must be mounted inside an isolated Shadow Root via WXT `createShadowRootUi`.
- **FR-4.2 (Host Isolation):** Google Docs styles (e.g. Docs toolbars, fonts, overlays) must not alter GuideMe UI, and GuideMe CSS must never interfere with the Google Docs editing canvas.

### FR-5: Extension Architecture & Messaging (`apps/chrome-extension`)
- **FR-5.1 (Popup Interface):** Browser action popup must display:
  - Active website hostname (`docs.google.com`)
  - List of relevant available tutorials (e.g., Google Docs guides)
  - Current progress badges ("Not Started", "In Progress (2/4)", "Completed")
  - "Start" / "Resume" / "Restart" buttons
- **FR-5.2 (Message Dispatcher):** Type-safe runtime message passing between Popup $\leftrightarrow$ Background $\leftrightarrow$ Content Script.

---

## 5. Non-Functional Requirements (NFR)

- **Performance:** Bounding box recalculation during scroll/resize must maintain $\ge$ 55 FPS with zero perceptible UI stutter.
- **Lightweight Footprint:** Content script bundle size should remain $< 150\text{ KB}$ (minified + gzipped).
- **Security & Permissions:** Strictly follow Manifest V3 security requirements (no `unsafe-eval`, no arbitrary remote code execution).
- **Reliability:** If a target DOM element is not found within the timeout window, the engine must degrade gracefully (display a fallback modal asking the user to navigate or skip).

---

## 6. Acceptance Criteria

| Requirement | Acceptance Test |
|---|---|
| **AC-1: Element Highlighting** | When Step 1 activates on Google Docs (`docs.google.com/document/*`), an SVG cutout overlay highlights the "Share" button with a tooltip positioned below it. |
| **AC-2: Action Progression** | Clicking the highlighted "Share" button immediately satisfies the validation condition and advances the guide to the sharing modal step. |
| **AC-3: Scroll & Resize Sync** | Scrolling the document or resizing the browser window moves the spotlight and tooltip synchronously with the element. |
| **AC-4: Progress Persistence** | Refreshing Google Docs during a tutorial retains the current step index; clicking "Resume" restarts at the same step. |
| **AC-5: Clean Teardown** | Clicking "Close" removes all overlays and disconnects all observers with 0 memory leaks or lingering styles. |
