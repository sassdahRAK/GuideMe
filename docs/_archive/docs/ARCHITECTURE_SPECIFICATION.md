# Architectural Specification & Production Blueprint: Universal Tutorial Engine (GuideMe)

---

## Executive Summary

- **Ingestion & Reconciliation:** Synthesized the 7-Layer Architecture specifications, runtime subsystem definitions, execution lifecycles, and framework evaluations across the reference documentation (`Where-it-locate.html`, `Full-picture of Universal tutorial engine.html`, `framework_comparison_guide.html`, and Markdown notes).
- **Framework & Language Alignment:** Unified the target architecture around **WXT + React (Manifest V3) using pure JavaScript (`.js` / `.jsx`)**. Reconciled directory structure with standard **WXT conventions** (`entrypoints/`, isolated Shadow DOM mounting for content script UI, and dynamic runtime messaging).
- **Core Decoupling Guardrail:** Enforced the strict rule: **Zero engine/step execution logic inside React components**. The Tutorial Engine (`packages/engine`) is 100% headless and platform-agnostic. The Chrome Adapter (`packages/chrome-adapter`) manages DOM queries and browser events, while React (`packages/tutorial-ui` & `apps/chrome-extension`) strictly acts as a reactive rendering consumer.
- **Shadow DOM Isolation & Dynamic SPA Tracking:** Standardized on WXT `createShadowRootUi` to prevent CSS bleed between host webpages (e.g., GitHub, Jira, SaaS apps) and tutorial overlays, coupled with `ResizeObserver` / `MutationObserver` for resilient SPA element tracking.

---

## The Refined Solution

```
================================================================================
              UNIVERSAL TUTORIAL ENGINE (GUIDEME) — JS + REACT + WXT
================================================================================
```
### 1. High-Level Architecture & The 7-Layer System Matrix

#### 1.1 Universal System Architecture Diagram

```text
                  +-----------------------------------+
                  |      Tutorial Authoring System    |
                  |                                   |
                  |  Visual Builder / JSON Editor     |
                  +----------------+------------------+
                                   |
                                   v
                  +-----------------------------------+
                  |       Tutorial Definition         |
                  |           JSON / DSL              |
                  +----------------+------------------+
                                   |
                                   v
+---------------------------------------------------------------------+
|                     UNIVERSAL TUTORIAL ENGINE                       |
|                                                                     |
|  +-------------------+  +-------------------+  +-----------------+  |
|  | Schema Validator  |  | Tutorial Parser   |  | State Machine   |  |
|  +-------------------+  +-------------------+  +-----------------+  |
|                                                                     |
|  +-------------------+  +-------------------+  +-----------------+  |
|  | Step Resolver     |  | Action Engine     |  | Validation      |  |
|  |                   |  |                   |  | Engine          |  |
|  +-------------------+  +-------------------+  +-----------------+  |
|                                                                     |
|  +-------------------+  +-------------------+  +-----------------+  |
|  | Event System      |  | Variable Store    |  | Progress        |  |
|  |                   |  |                   |  | Manager         |  |
|  +-------------------+  +-------------------+  +-----------------+  |
|                                                                     |
|  +---------------------------------------------------------------+  |
|  |                     Adapter Interface                         |  |
|  +---------------------------------------------------------------+  |
+-----------------------------------+---------------------------------+
                                    │
                                    ▼
             +----------------------+----------------------+
             |                      |                      |
             v                      v                      v
+---------------------+  +---------------------+  +---------------------+
|    Chrome Adapter   |  |     Web Runtime     |  |   Desktop Adapter   |
|                     |  |        / SDK        |  |                     |
+----------+----------+  +----------+----------+  +----------+----------+
           │                        │                        │
           ▼                        ▼                        ▼
+---------------------+  +---------------------+  +---------------------+
| Chrome APIs / DOM   |  | Embedded App DOM /  |  | OS Accessibility /  |
|  (Prompt Box UI)    |  | Application State   |  | Automation APIs     |
+----------+----------+  +---------------------+  +---------------------+
           │
           │ Learner Interacts (Clicks / Typing / Navigation)
           ▼
+---------------------------------------------------------------------+
|                       STEP VALIDATION FEEDBACK LOOP                 |
|                                                                     |
|  1. Prompt / Guide Box UI  ──► Learner sees step guidance in UI     |
|  2. User Action / Event    ──► Adapter captures click/input/nav     |
|  3. Validation Engine      ──► Checks action: Success or Error?     |
|  4. State Machine (FSM)    ──► Advances to NEXT_STEP or Recovery    |
+-----------------------------------+---------------------------------+
                                    │
                                    └────► Loops back into Engine State Machine
```

#### 1.2 The 7-Layer Architecture Matrix

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ LAYER 7: AUTHORING SYSTEM (Visual Builder, JSON / DSL Editor, Studio)  │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ Generates
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ LAYER 6: TUTORIAL DEFINITION (JSON Schema, Domain Specific Language)   │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ Ingests
                                     ▼
 ╔════════════════════════════════════════════════════════════════════════╗
 ║ LAYER 5: ENGINE CORE (Universal Headless Execution Engine)            ║
 ║  • Schema Validator    • Tutorial Parser   • State Machine (FSM)       ║
 ║  • Step Resolver       • Action Engine     • Validation Engine         ║
 ╚═══════════════════════════════════╤════════════════════════════════════╝
                                     │ Coordinates
                                     ▼
 ╔════════════════════════════════════════════════════════════════════════╗
 ║ LAYER 4: RUNTIME SERVICES (In-Memory Engine Context)                  ║
 ║  • Event System        • Variable Store    • Progress Manager          ║
 ╚═══════════════════════════════════╤════════════════════════════════════╝
                                     │ Dispatches
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ LAYER 3: ADAPTER INTERFACE (Universal Platform Contract)               │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ Bridges to Adapters
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ LAYER 2: ENVIRONMENT INTEGRATION (Multi-Target Adapters & Overlays)    │
 │  • Chrome Adapter (MV3 Extension / Content Script / Shadow DOM UI)     │
 │  • Web Runtime / SDK (Embedded In-App DOM & State Observer)            │
 │  • Desktop Adapter (OS Accessibility & Native Automation APIs)         │
 │  • Step Overlays: Prompt / Guide Box UI, Spotlights, Floating Tooltips │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ Manipulates & Observes
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ LAYER 1: TARGET ENVIRONMENTS (Host Application & System Layers)        │
 │  • Chrome APIs & Host Web Page DOM (e.g., Google Docs, SaaS Portals)   │
 │  • Embedded Application DOM & Internal State (In-App SDKs)             │
 │  • OS Accessibility Tree & Native Desktop Window APIs                  │
 └────────────────────────────────────────────────────────────────────────┘
```

| Layer | Component Breakdown | Responsibility | Runtime Boundary | Tech Stack |
|---|---|---|---|---|
| **Layer 7: Authoring System** | Visual Builder, JSON Editor, Web Studio | Step recording, branching logic editor, tutorial authoring. | Web App / Studio | React (`.jsx`), Tailwind CSS |
| **Layer 6: Definition** | Tutorial Definition (JSON / DSL) | Declarative specification of steps, selector strategies, target URLs, actions, and validation criteria. | Data / JSON Store | JSON / Zod (`.js`) |
| **Layer 5: Engine Core** | Schema Validator, Tutorial Parser, State Machine, Step Resolver, Action Engine, Validation Engine | Headless state transitions, step resolution, action triggering, interactive event validation. | Client Memory (Headless) | Pure JavaScript (`.js`) |
| **Layer 4: Runtime Services** | Event System, Variable Store, Progress Manager | Dynamic runtime state, event dispatching/subscriptions, session and progress persistence. | Client Memory / Storage | Event Emitter, Reactive State (`.js`) |
| **Layer 3: Adapter Interface** | `BaseTutorialAdapter` Abstract Protocol | Decouples engine logic from host environments (DOM, Web APIs, OS). | Boundary Contract | JavaScript Base Class (`.js`) |
| **Layer 2: Environment Integration** | Chrome Adapter, Web Runtime / SDK, Desktop Adapter | Implements platform-specific querying, DOM event listening, and overlay rendering. | Browser Extension / SDK / Native Runtime | WXT, React (`.jsx`), Web / Desktop APIs |
| **Layer 1: Target Environment** | Chrome APIs / DOM, Embedded App DOM / State, OS Accessibility APIs | The host application or platform where the learner interacts. | Host Page DOM / OS | Host DOM / SPA Frameworks / OS APIs |
| **Step Pipeline** | Prompt / Guide Box UI & Step Validation Engine | In-page instruction cards, spotlight cutouts, user interaction validation (click, input, submit), error recovery, and next-step progression. | Isolated Shadow DOM Overlay & Event Listener | React (`.jsx`), Shadow DOM, Native DOM Events |

---

### 2. Monorepo Repository Structure (JavaScript + WXT + React)

A PNPM workspace layout using standard JavaScript (`.js`) and React (`.jsx`):

```text
guideme/
├── apps/
│   ├── chrome-extension/                  # WXT Browser Extension (JavaScript)
│   │   ├── entrypoints/
│   │   │   ├── background.js              # MV3 Background Service Worker
│   │   │   ├── content/                   # Content script entrypoint
│   │   │   │   ├── index.jsx              # WXT createShadowRootUi mount
│   │   │   │   └── style.css              # Isolated tutorial overlay styling
│   │   │   ├── popup/                     # Browser Action Popup
│   │   │   │   ├── App.jsx                # Extension controls & tutorial list
│   │   │   │   ├── index.html
│   │   │   │   └── main.jsx
│   │   │   └── sidepanel/                 # Optional Chrome Side Panel
│   │   │       ├── App.jsx
│   │   │       ├── index.html
│   │   │       └── main.jsx
│   │   ├── public/
│   │   │   └── icon/                      # Extension icons (16, 48, 128)
│   │   ├── package.json
│   │   ├── jsconfig.json                  # IDE Path Aliases & Autocomplete
│   │   └── wxt.config.js                  # WXT Configuration with React Plugin
│   │
│   └── authoring-studio/                  # (Layer 7) Web Studio for creating tutorials
│
├── packages/
│   ├── core-types/                        # JSDoc Type Definitions & Message Constants
│   │   └── src/
│   │       ├── constants.js
│   │       ├── messages.js
│   │       └── index.js
│   │
│   ├── engine/                            # (Layer 5 & 4) Universal Headless Execution Engine
│   │   └── src/
│   │       ├── parser/                    # Tutorial Parser & Schema Validator bridge
│   │       ├── state-machine/             # State Machine (IDLE, ACTIVE, STEP_RUNNING, SUCCESS, FAILED)
│   │       ├── resolver/                  # Step Resolver (targets, fallback selectors, conditions)
│   │       ├── actions/                   # Action Engine (Highlight, scroll, tooltips, clicks)
│   │       ├── validation/                # Validation Engine (DOM events, URL checks, step action checks)
│   │       ├── runtime/                   # Runtime Services (Event System, Variable Store, Progress Manager)
│   │       ├── engine.js                  # Engine entrypoint & coordinator
│   │       └── index.js
│   │
│   ├── adapter-interface/                 # (Layer 3) Adapter Interface (Universal Contract)
│   │   └── src/
│   │       ├── base-adapter.js            # BaseTutorialAdapter protocol
│   │       └── index.js
│   │
│   ├── chrome-adapter/                    # (Layer 2) Chrome MV3 Adapter Implementation
│   │   └── src/
│   │       ├── dom-observer.js            # MutationObserver & dynamic element finder (Chrome APIs / DOM)
│   │       ├── event-listener.js          # Normalizes click, input, submit events from DOM
│   │       ├── url-listener.js            # SPA pushState / popstate interceptor
│   │       ├── chrome-storage.js          # chrome.storage.local persistence bridge
│   │       ├── chrome-adapter.js          # Implements BaseAdapter
│   │       └── index.js
│   │
│   ├── tutorial-ui/                       # (Layer 2 UI) React Visual Components (Render Only)
│   │   └── src/
│   │       ├── components/
│   │       │   ├── Spotlight.jsx          # SVG/Canvas backdrop cutout around target
│   │       │   ├── Tooltip.jsx            # Floating guide bubble anchored to target
│   │       │   ├── StepCard.jsx           # Step instructions, next/back buttons
│   │       │   └── ProgressBar.jsx        # Visual progress indicator
│   │       └── index.js
│   │
│   └── tutorial-schema/                   # Zod definitions and JSON Schema validation
│       └── src/
│           ├── v1/
│           │   ├── tutorial-schema.js
│           │   └── step-schema.js
│           └── index.js
│
├── tutorials/                             # Example declarative JSON tutorials
│   ├── google-docs/
│   │   └── share-document-guide.json
│   └── general/
│       └── welcome-tour.json
│
├── docs/                                  # Project Documentation & Architecture
│   ├── REQUIREMENTS.md
│   └── ARCHITECTURE_SPECIFICATION.md
├── package.json                           # Root workspace configuration
└── pnpm-workspace.yaml
```

---

### 3. Core Engine Contracts & Message Protocols (JavaScript)

#### 3.1 Declarative Tutorial Schema Example (`tutorials/google-docs/share-document-guide.json`)

```json
{
  "id": "google-docs-share-flow",
  "version": "1.0.0",
  "name": "Share & Manage Permissions in Google Docs",
  "description": "Step-by-step guide to share a Google Doc and set access permissions.",
  "matchUrls": ["https://docs.google.com/document/*"],
  "steps": [
    {
      "id": "step_click_share",
      "title": "Open Sharing Settings",
      "description": "Click the blue 'Share' button in the top right corner.",
      "target": {
        "css": "#docs-share-button, div[aria-label*='Share']",
        "ariaLabel": "Share",
        "text": "Share"
      },
      "action": {
        "type": "spotlight",
        "title": "Share Document",
        "content": "Click here to manage collaborators and link access.",
        "placement": "bottom"
      },
      "validation": {
        "type": "click"
      }
    }
  ]
}
```

#### 3.2 Abstract Base Adapter (`packages/adapter-interface/src/base-adapter.js`)

```javascript
/**
 * Abstract Base Adapter defining platform capabilities.
 */
export class BaseTutorialAdapter {
  /**
   * Find a DOM target element and return its bounding box.
   * @param {Object} selector - Target selector criteria (css, xpath, text, testId)
   * @param {number} [timeoutMs=5000]
   * @returns {Promise<DOMRect|null>}
   */
  async findTarget(selector, timeoutMs = 5000) {
    throw new Error('findTarget() must be implemented by concrete adapter');
  }

  /**
   * Scroll viewport to bring element into view.
   * @param {Object} selector
   * @returns {Promise<void>}
   */
  async scrollToElement(selector) {
    throw new Error('scrollToElement() must be implemented by concrete adapter');
  }

  /**
   * Continuously observe element bounding box on resize/scroll.
   * @param {Object} selector
   * @param {(rect: DOMRect|null) => void} onChange
   * @returns {() => void} Unsubscribe function
   */
  observeTargetPosition(selector, onChange) {
    throw new Error('observeTargetPosition() must be implemented by concrete adapter');
  }

  /**
   * Listen to an interaction event on the target element.
   * @param {Object} selector
   * @param {string} eventType
   * @param {(event: Event) => void} callback
   * @returns {() => void} Unsubscribe function
   */
  listenToElementEvent(selector, eventType, callback) {
    throw new Error('listenToElementEvent() must be implemented by concrete adapter');
  }

  /**
   * Listen for SPA URL navigation changes.
   * @param {(newUrl: string) => void} callback
   * @returns {() => void} Unsubscribe function
   */
  listenToUrlChanges(callback) {
    throw new Error('listenToUrlChanges() must be implemented by concrete adapter');
  }

  /**
   * Persist tutorial completion progress.
   * @param {string} tutorialId
   * @param {number} stepIndex
   * @returns {Promise<void>}
   */
  async saveProgress(tutorialId, stepIndex) {
    throw new Error('saveProgress() must be implemented by concrete adapter');
  }

  /**
   * Retrieve saved tutorial progress.
   * @param {string} tutorialId
   * @returns {Promise<number|null>}
   */
  async getProgress(tutorialId) {
    throw new Error('getProgress() must be implemented by concrete adapter');
  }
}
```

#### 3.3 Execution Lifecycle & State Machine (`packages/engine/src/state-machine/`)

```
   [IDLE] ──► [LOAD_TUTORIAL] ──► [RESOLVE_STEP] ──► [WAIT_FOR_ELEMENT]
                                          ▲                  │
                                          │                  ▼
                                     [NEXT_STEP] ◄── [VALIDATE_EVENT] ◄── [APPLY_ACTION & RENDER]
                                          │
                                          ▼
                                     [COMPLETED]
```

1. **`LOAD_TUTORIAL`**: Engine validates schema and checks URL against `matchUrls`.
2. **`RESOLVE_STEP`**: Engine fetches current step definition and calculates target selectors.
3. **`WAIT_FOR_ELEMENT`**: Calls `adapter.findTarget()`. Uses `MutationObserver` under the hood to handle dynamic SPA renders.
4. **`APPLY_ACTION & RENDER`**: Once coordinates are resolved, engine emits step state to the UI layer (Spotlight & Tooltip anchor to coordinates).
5. **`VALIDATE_EVENT`**: Adapter listens to DOM interaction (click/input) or URL change. Upon verification, transitions state to `NEXT_STEP` or `COMPLETED`.

---

### 4. WXT Extension Implementation (`apps/chrome-extension`)

#### 4.1 WXT Config (`wxt.config.js`)

```javascript
import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';

export default defineConfig({
  manifest: {
    name: 'GuideMe: Universal Tutorial Engine',
    description: 'Interactive step-by-step guidance overlays for any web application.',
    version: '1.0.0',
    permissions: [
      'storage',
      'activeTab',
      'tabs'
    ],
    host_permissions: [
      '<all_urls>'
    ]
  },
  vite: () => ({
    plugins: [react()],
  }),
});
```

#### 4.2 Content Script with Isolated Shadow DOM (`entrypoints/content/index.jsx`)

```jsx
import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import ReactDOM from 'react-dom/client';
import React, { useEffect, useState } from 'react';
import { TutorialEngine } from '@guideme/engine';
import { ChromeAdapter } from '@guideme/chrome-adapter';
import { TutorialOverlay } from '@guideme/tutorial-ui';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'guideme-tutorial-root',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      onMount(uiContainer) {
        const root = ReactDOM.createRoot(uiContainer);

        function TutorialApp() {
          const [engineState, setEngineState] = useState(null);

          useEffect(() => {
            const adapter = new ChromeAdapter();
            const engine = new TutorialEngine({ adapter });

            const unsubscribe = engine.subscribe((state) => {
              setEngineState(state);
            });

            // Listen for popup / background start commands
            const messageHandler = (message, _sender, sendResponse) => {
              if (message.type === 'START_TUTORIAL') {
                engine.start(message.payload.tutorialId, message.payload.startStepIndex);
                sendResponse({ success: true });
              } else if (message.type === 'STOP_TUTORIAL') {
                engine.stop();
                sendResponse({ success: true });
              }
            };

            chrome.runtime.onMessage.addListener(messageHandler);
            engine.init();

            return () => {
              unsubscribe();
              chrome.runtime.onMessage.removeListener(messageHandler);
              engine.destroy();
            };
          }, []);

          if (!engineState || !engineState.isActive) return null;

          return <TutorialOverlay state={engineState} />;
        }

        root.render(<TutorialApp />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
```

---

### 5. Design System & Visual Specification: The 60-30-10 React + Tailwind CSS Architecture

To establish maximum visual hierarchy, readability, and brand consistency across both simple websites and complex host UIs (like Google Docs or AWS), GuideMe strictly enforces **React + Tailwind CSS** with the **60-30-10 Design Rule** using a sleek, high-contrast **Black, White, and Yellow-Orange (Warm Amber / Marigold)** color system.

> [!IMPORTANT]
> **Strict Styling Architecture Rule: Pure React + Tailwind CSS**
> - **Zero Vanilla CSS & Zero Inline CSS:** All layout, spacing, typography, gradients, borders, and animations must use standard Tailwind CSS utility classes. Arbitrary inline `style={{ ... }}` objects are prohibited (with the sole exception of dynamically computed pixel coordinates for anchored floating elements).
> - **Zero Raw Emojis:** Prohibit unicode emojis (except country/language flags). All UI symbols use `react-icons`.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    60-30-10 COLOR DISTRIBUTION MATRIX                       │
│                                                                             │
│   ██████████████████████████████  ░░░░░░░░░░░░░░░  ▓▓▓▓▓                    │
│   60% Dominant Base               30% Secondary    10% Focal Accent         │
│   Deep Blacks & Dark Neutrals     Crisp Whites     Warm Yellow-Orange/Amber │
│   (#0F1117 / #181A20)             (#FFFFFF / #F1)  (#F59E0B / #FF9E0B)      │
│   • Backdrop Spotlight Mask       • Body & Titles  • Action Buttons ("Next")│
│   • Tooltip & Card Backdrops      • Borders/Cards  • Spotlight Target Glow  │
│   • Popup Shell & Containers      • Secondary UI   • Progress Bar & Badges  │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 5.1 The 60-30-10 Palette & Tailwind Utility Breakdown

| Tier | Ratio | Token Name | Hex / Value | Tailwind Utility Class | Semantic Role & UI Application |
|---|---|---|---|---|---|
| **Dominant** | **60%** | `--gm-bg-backdrop` | `rgba(15, 17, 23, 0.82)` | `bg-black/80 backdrop-blur-sm` | Full-screen SVG spotlight cutout mask dimming the host webpage. |
| | | `--gm-bg-surface` | `#12141A` | `bg-[#12141a]` | Main card background for floating tooltips, popups, and dialogs. |
| | | `--gm-bg-elevated` | `#1E222B` | `bg-[#1e222b]` / `bg-[#181b22]` | Nested content wells, audio bars, feedback cards, and input surfaces. |
| **Secondary** | **30%** | `--gm-text-primary` | `#FFFFFF` | `text-white` | Primary headings, step titles, and high-contrast text content. |
| | | `--gm-text-secondary` | `#CBD5E1` | `text-slate-300` / `text-slate-400` | Step body descriptions, secondary labels, and timestamps. |
| | | `--gm-border-subtle` | `#2A2F3B` | `border-[#2a2f3b]` / `border-[#3e4556]` | Subtle card borders, divider lines, and neutral interactive states. |
| | | `--gm-btn-secondary` | `#262B35` | `bg-[#262b35] text-slate-200` | "Back", "Skip", and "Close" neutral control buttons. |
| **Accent** | **10%** | `--gm-accent-primary` | `#F59E0B` *(Warm Amber)* | `bg-amber-500` / `from-amber-500 to-amber-600` | Primary action triggers ("Next Step", "Start Guide", "Finish"). |
| | | `--gm-accent-glow` | `rgba(245, 158, 11, 0.38)` | `shadow-[0_0_24px_rgba(245,158,11,0.45)]` | Glowing highlight ring around spotlighted target DOM element. |
| | | `--gm-accent-progress`| `#D97706` | `bg-amber-500` | Active progress bar fill, active step counter badge (`Step 2 of 5`). |
| | | `--gm-accent-contrast`| `#000000` | `text-black font-extrabold` | High-contrast black text on yellow-orange buttons and badges for AAA a11y. |

#### 5.2 Tailwind CSS v4 Configuration (`@import "tailwindcss";` & `@theme`)

GuideMe strictly uses **Tailwind CSS v4 (CSS-First Configuration)** with zero legacy JavaScript config files (`tailwind.config.js` is deprecated in v4). All theme design tokens and cross-package content discovery are declared directly in CSS:

```css
/* apps/chrome-extension/entrypoints/content/style.css */
@import url('https://fonts.googleapis.com/css2?family=Kantumruy+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

@import "tailwindcss";
@source "../../../packages/tutorial-ui/src";

@theme {
  --color-gm-backdrop: rgba(15, 17, 23, 0.82);
  --color-gm-surface: #12141a;
  --color-gm-card: #12141a;
  --color-gm-card-hover: #181b22;
  --color-gm-elevated: #1e222b;
  --color-gm-dark: #0f1117;
  --color-gm-border: #2a2f3b;
  --color-gm-border-hover: #3e4556;
  --color-gm-border-subtle: #232734;
  --color-gm-text-primary: #ffffff;
  --color-gm-text-secondary: #cbd5e1;
  --color-gm-text-muted: #94a3b8;
  --color-gm-accent: #f59e0b;
  --color-gm-accent-hover: #d97706;
  --color-gm-accent-active: #b45309;
  --color-gm-accent-contrast: #000000;

  --font-kantumruy: 'Kantumruy Pro', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
```

#### 5.3 Component Application Specifications

1. **Spotlight & Target Highlight (SVG Cutout):**
   - **Backdrop (60%):** Smooth dark mask (`--gm-color-bg-mask`) with SVG rounded cutout around target DOM element.
   - **Target Ring (10%):** 2px pulsating Warm Yellow-Orange outline (`#F59E0B`) with subtle outer glow (`--gm-color-accent-glow`) to instantly draw learner eyes.
2. **Floating Step Tooltip (`Tooltip.jsx` / `StepCard.jsx`):**
   - **Shell (60%):** Sleek deep black card background (`#12141A`) with subtle border (`#2A2F3B`) and deep drop shadow.
   - **Typography & Details (30%):** Crisp white bold title (`#FFFFFF`), light slate description text (`#CBD5E1`), close icon (`react-icons` e.g. `FiX` / `LuX`).
   - **Action & Progress (10%):**
     - Step Badge: Warm Amber pill tag with bold black text (`Step 2 of 4`).
     - Progress Bar: Dark track (`#262B35`) filled with animated Yellow-Orange bar (`#F59E0B`).
     - Primary Button: Solid Warm Yellow-Orange fill (`#F59E0B`), dark black text (`#000000`), hover transition to `#D97706`.
3. **Extension Popup (`popup/App.jsx`):**
   - **Container (60%):** Dark obsidian surface (`#12141A`) with crisp borders.
   - **List & Cards (30%):** White guide titles, gray description text, subtle hover card backgrounds.
   - **CTA (10%):** Warm Amber-Orange "Start Guide" / "Auto-Guide Page" primary buttons.

#### 5.4 Iconography & Emoji Restrictions (Strict Rule)

> [!IMPORTANT]
> **Strict UI Standard: No Unicode Emojis (Except Country/Language Flags)**
> - **Prohibition:** Raw unicode emojis (e.g. 🚀, 💡, ❌, 👉, ⚙️, 🔍, 📝) are **strictly forbidden** in all GuideMe user interface elements (`tutorial-ui`, `popup`, `sidepanel`, `content` overlays, buttons, badges, and step cards).
> - **Sole Exception (Country/Language Flags):** Country/regional flag emojis (e.g., 🇰🇭 for Khmer, 🇺🇸 for English) are permitted **only** inside locale/language selector components where national flags aid quick visual recognition.
> - **Mandatory Icon System (`react-icons`):** All iconography (close buttons, directional navigation arrows, status indicators, settings, search, help markers) must use vector SVG components imported from `react-icons` (e.g., `react-icons/fi`, `react-icons/lu`, `react-icons/tb`, `react-icons/ri`).
> - **Color Token Inheritance:** All `react-icons` components must inherit dynamic theme colors via CSS `currentColor` or explicit GuideMe design tokens (`--gm-color-accent`, `--gm-color-text-primary`, `--gm-color-text-muted`).

---

### 6. Step Guidance, Prompt Box & Step Validation Pipeline

GuideMe guides learners through web application workflows step-by-step. The runtime pipeline coordinates between the in-page prompt box and the step validation engine:

```text
                  Step Guidance & Validation Pipeline
                                │
               +----------------+----------------+
               |                                 |
               v                                 v
        +-------------+                   +-------------+
        | Prompt /    |                   | Step Action |
        | Guide Box UI|                   | & Event     |
        +------+------+                   +------+------+
               |                                 |
               +----------------+----------------+
                                │
                                v
                     Step Validation Engine
                    (Success / Error / Next)
```

#### 6.1 Subsystem Responsibilities

1. **Prompt / Guide Box UI (`packages/tutorial-ui`):**
   - **Instruction Prompts:** Renders clear, contextual guidance inside floating tooltips, spotlights, and step cards (e.g., *"Click the blue 'Share' button"*, *"Type the recipient's email"*).
   - **Interactive Feedback:** Displays step counters (`Step 2 of 5`), progress bars, action buttons ("Next", "Back", "Skip"), and error hints.

2. **Step Action & Event Listener (`packages/chrome-adapter`):**
   - Intercepts and observes live DOM interactions on target elements (`click`, `input`, `change`, `keydown`, `submit`, or URL route changes).
   - Normalizes host webpage events and dispatches them safely to the engine without interfering with the website's native functionality.

3. **Step Validation Engine (`packages/engine/src/validation/`):**
   - **Success Check:** Validates whether the user's interaction satisfies the step criteria (e.g., did they click the exact target element? Did the input value match?).
   - **Error Handling & Recovery:** If the user clicks the wrong element, if the target DOM element disappears during an SPA render, or if a step times out:
     - Detects the failure/error condition.
     - Updates the Prompt Box with a helpful recovery hint (e.g., *"Element moved or not found. Please click here to retry"*).
     - Keeps the tutorial state stable and prevents broken flows.
   - **Progression:** On successful validation, transitions the `State Machine` to `NEXT_STEP` and dynamically recalculates targets for the next step.

---

## Resolved Architectural & Strategic Decisions

All core strategic decisions have been resolved and implemented in the current production codebase:

1. **Storage Synchronization Model:**
   - **Status:** **RESOLVED & IMPLEMENTED** *(Option A: Local Persistence)*
   - **Implementation:** [`ChromeStorageAdapter`](file:///home/saoly/Documents/Code/GuideMe/packages/chrome-adapter/src/chrome-storage.js) utilizes `chrome.storage.local` with automatic in-memory / `localStorage` fallback. Step completion and learner progress are persisted locally without requiring user accounts or external servers.

2. **Tutorial Catalog Source:**
   - **Status:** **RESOLVED & IMPLEMENTED** *(Hybrid Curated + Dynamic)*
   - **Implementation:** High-fidelity curated guides are packaged as declarative schemas in [`apps/chrome-extension/src/catalog.js`](file:///home/saoly/Documents/Code/GuideMe/apps/chrome-extension/src/catalog.js) (offline instant availability), while the on-page `DynamicPageAnalyzer` generates contextual walkthroughs on the fly for unconfigured URLs.

3. **Selector Resilience Strategy:**
   - **Status:** **RESOLVED & IMPLEMENTED** *(Option A: Multi-Layered Fallback Heuristics)*
   - **Implementation:** [`DomObserver.findElement`](file:///home/saoly/Documents/Code/GuideMe/packages/chrome-adapter/src/dom-observer.js#L10-L60) uses a 5-tier fallback cascade (CSS Selector $\rightarrow$ `data-testid`/`data-cy` $\rightarrow$ `aria-label` $\rightarrow$ Visible Text Matching $\rightarrow$ XPath) combined with `MutationObserver` to ensure reliable targeting across dynamic SPAs.

