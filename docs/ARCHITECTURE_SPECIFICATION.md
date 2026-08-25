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

### 1. The 7-Layer Architecture Matrix

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ LAYER 7: AUTHORING & MANAGEMENT (Studio, Visual Builder, Dashboard)   │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ Generates
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ LAYER 6: TUTORIAL DEFINITION (JSON Schema, DSL, Step Graph)            │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ Ingests
                                     ▼
 ╔════════════════════════════════════════════════════════════════════════╗
 ║ LAYER 5: TUTORIAL EXECUTION ENGINE (Headless Core)                    ║
 ║  • Schema Validator    • Parser            • State Machine (FSM)       ║
 ║  • Step Resolver       • Action Engine     • Validation Engine         ║
 ╚═══════════════════════════════════╤════════════════════════════════════╝
                                     │ Coordinates
                                     ▼
 ╔════════════════════════════════════════════════════════════════════════╗
 ║ LAYER 4: RUNTIME SERVICES (In-Memory Context)                         ║
 ║  • Event Bus           • Variable Store    • Progress & Session Mgmt   ║
 ╚═══════════════════════════════════╤════════════════════════════════════╝
                                     │ Dispatches
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ LAYER 3: ADAPTER ABSTRACTION INTERFACE (Adapter Protocol Contract)     │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ Bridges to
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ LAYER 2: ENVIRONMENT INTEGRATION (WXT Chrome MV3 Extension / Web SDK)  │
 │  • Background Service Worker  • Content Scripts  • Shadow DOM Overlays │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ Manipulates & Observes
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │ LAYER 1: TARGET ENVIRONMENT (Host Web DOM e.g. GitHub, SaaS Apps)      │
 └────────────────────────────────────────────────────────────────────────┘
```

| Layer | Responsibility | Runtime Boundary | Tech Stack |
|---|---|---|---|
| **Layer 7: Authoring** | Visual step recording, branching editor, tutorial catalog management. | Web App / Studio | React (`.jsx`), Tailwind CSS |
| **Layer 6: Definition** | Declarative specification of steps, selector strategies, target URLs, actions, and criteria. | Data / JSON Store | JSON / Zod (`.js`) |
| **Layer 5: Engine Core** | FSM state transitions, step resolution, action triggering, validation evaluation. | Client Memory (Headless) | Pure JavaScript (`.js`) |
| **Layer 4: Runtime** | Dynamic runtime variables, event subscriptions, progress persistence. | Client Memory / Storage | Event Emitter, Reactive State (`.js`) |
| **Layer 3: Abstraction** | Decouples engine logic from host platform (DOM, Web APIs, OS). | Boundary Contract | JavaScript Adapter Base Class (`.js`) |
| **Layer 2: Integration** | Translates adapter commands into Chrome MV3 actions and Shadow DOM overlays. | Browser Extension (MV3) | WXT, React (`.jsx`), Chrome APIs |
| **Layer 1: Target** | The target website the user interacts with. | Host Page DOM | Native DOM / SPA Frameworks |

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
│   ├── engine/                            # (Layer 5 & 4) Headless Execution Engine
│   │   └── src/
│   │       ├── parser/                    # Schema parsing & validation (Zod / JSON)
│   │       ├── state-machine/             # Finite State Machine (IDLE, ACTIVE, STEP_RUNNING, SUCCESS, FAILED)
│   │       ├── resolver/                  # Resolves targets, fallback selectors, and conditions
│   │       ├── actions/                   # Highlight, scroll, tooltips, click synthesis
│   │       ├── validation/                # Event matching, DOM element checks, URL matchers
│   │       ├── runtime/                   # EventBus, VariableStore, SessionManager
│   │       ├── engine.js                  # Engine entrypoint & coordinator
│   │       └── index.js
│   │
│   ├── adapter-interface/                 # (Layer 3) Abstract Base Adapter Class
│   │   └── src/
│   │       ├── base-adapter.js
│   │       └── index.js
│   │
│   ├── chrome-adapter/                    # (Layer 2) Chrome MV3 Adapter Implementation
│   │   └── src/
│   │       ├── dom-observer.js            # MutationObserver & dynamic element finder
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
    name: 'GuideMe — Universal Tutorial Engine',
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

### 5. Design System & Visual Specification: The 60-30-10 Black/White/Yellow-Orange (Amber) Architecture

To establish maximum visual hierarchy, readability, and brand consistency across both simple websites and complex host UIs (like Google Docs or AWS), GuideMe enforces the **60-30-10 Design Rule** using a sleek, high-contrast **Black, White, and Yellow-Orange (Warm Amber / Marigold)** color system.

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

#### 5.1 The 60-30-10 Palette Breakdown

| Tier | Ratio | Token Name | Hex / Value | Semantic Role & UI Application |
|---|---|---|---|---|
| **Dominant** | **60%** | `--gm-bg-backdrop` | `rgba(15, 17, 23, 0.82)` | Full-screen SVG spotlight cutout mask dimming the host webpage. |
| | | `--gm-bg-surface` | `#12141A` | Main card background for floating tooltips, popups, and dialogs. |
| | | `--gm-bg-elevated` | `#1E222B` | Nested content wells, code blocks, and input surfaces. |
| **Secondary** | **30%** | `--gm-text-primary` | `#FFFFFF` | Primary headings, step titles, and high-contrast text content. |
| | | `--gm-text-secondary` | `#CBD5E1` | Step body descriptions, secondary labels, and timestamps. |
| | | `--gm-border-subtle` | `#2A2F3B` | Subtle card borders, divider lines, and neutral interactive states. |
| | | `--gm-btn-secondary` | `#262B35` | "Back", "Skip", and "Close" neutral control buttons (with white text). |
| **Accent** | **10%** | `--gm-accent-primary` | `#F59E0B` *(Warm Yellow-Orange / Amber)* | Primary action triggers ("Next Step", "Start Guide", "Finish"). |
| | | `--gm-accent-glow` | `rgba(245, 158, 11, 0.38)` | Glowing highlight ring around spotlighted target DOM element. |
| | | `--gm-accent-progress`| `#D97706` | Active progress bar fill, active step counter badge (`Step 2 of 5`). |
| | | `--gm-accent-contrast`| `#000000` | High-contrast black text on yellow-orange buttons and badges for AAA a11y. |

#### 5.2 Standardized Design Tokens (`packages/tutorial-ui/src/styles/theme.css`)

```css
:host, .guideme-root {
  /* 60% Dominant (Blacks & Deep Neutrals) */
  --gm-color-bg-mask: rgba(15, 17, 23, 0.82);
  --gm-color-bg-card: #12141a;
  --gm-color-bg-card-hover: #181b22;
  --gm-color-bg-elevated: #1e222b;

  /* 30% Secondary (Whites & Slate Accents) */
  --gm-color-text-title: #ffffff;
  --gm-color-text-body: #cbd5e1;
  --gm-color-text-muted: #94a3b8;
  --gm-color-border: #2a2f3b;
  --gm-color-border-hover: #3e4556;
  --gm-btn-sec-bg: #262b35;
  --gm-btn-sec-text: #ffffff;

  /* 10% Accent (Warm Yellow-Orange / Amber & Focus Rings) */
  --gm-color-accent: #f59e0b;
  --gm-color-accent-hover: #d97706;
  --gm-color-accent-active: #b45309;
  --gm-color-accent-text: #000000;
  --gm-color-accent-ring: rgba(245, 158, 11, 0.45);
  --gm-color-accent-glow: 0 0 20px rgba(245, 158, 11, 0.38);

  /* Geometry & Typography */
  --gm-radius-sm: 6px;
  --gm-radius-md: 10px;
  --gm-radius-lg: 16px;
  --gm-font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --gm-shadow-overlay: 0 20px 40px rgba(0, 0, 0, 0.6);
}
```

#### 5.3 Component Application Specifications

1. **Spotlight & Target Highlight (SVG Cutout):**
   - **Backdrop (60%):** Smooth dark mask (`--gm-color-bg-mask`) with SVG rounded cutout around target DOM element.
   - **Target Ring (10%):** 2px pulsating Warm Yellow-Orange outline (`#F59E0B`) with subtle outer glow (`--gm-color-accent-glow`) to instantly draw learner eyes.
2. **Floating Step Tooltip (`Tooltip.jsx` / `StepCard.jsx`):**
   - **Shell (60%):** Sleek deep black card background (`#12141A`) with subtle border (`#2A2F3B`) and deep drop shadow.
   - **Typography & Details (30%):** Crisp white bold title (`#FFFFFF`), light slate description text (`#CBD5E1`), close icon (`✕`).
   - **Action & Progress (10%):**
     - Step Badge: Warm Amber pill tag with bold black text (`Step 2 of 4`).
     - Progress Bar: Dark track (`#262B35`) filled with animated Yellow-Orange bar (`#F59E0B`).
     - Primary Button: Solid Warm Yellow-Orange fill (`#F59E0B`), dark black text (`#000000`), hover transition to `#D97706`.
3. **Extension Popup (`popup/App.jsx`):**
   - **Container (60%):** Dark obsidian surface (`#12141A`) with crisp borders.
   - **List & Cards (30%):** White guide titles, gray description text, subtle hover card backgrounds.
   - **CTA (10%):** Warm Amber-Orange "Start Guide" / "Auto-Guide Page" primary buttons.

---

## Strategic Decisions Needed

1. **Storage Synchronization Model:**
   - *Option A (Default MVP):* Local persistence using `chrome.storage.local`. Progress stays on the user's browser without requiring authentication. *(Adopted)*
   - *Option B (Cloud Sync):* Remote backend sync via REST/GraphQL API to track team-wide tutorial completion metrics.
2. **Tutorial Catalog Source:**
   - *Option A (Bundled JSON):* Tutorials pre-packaged inside the extension distribution for immediate offline availability.
   - *Option B (Remote CDN / API):* Extension dynamically fetches tutorial schemas from a remote endpoint based on the active tab domain (`window.location.hostname`). *(Recommended for live updates without extension re-publishing)*.
3. **Selector Resilience Strategy:**
   - *Option A:* Multi-layered fallback heuristics (CSS selector $\rightarrow$ `data-testid` $\rightarrow$ ARIA label $\rightarrow$ Text XPath).
   - *Option B:* Visual recording engine via Authoring Studio (Layer 7) that automatically records all 4 selector types during point-and-click recording.

