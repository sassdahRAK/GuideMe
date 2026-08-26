# Code Standards — GuideMe

## 1. General Principles

- **Small, Single-Purpose Modules:** Every file must have a single clear responsibility. Keep modules under 250 lines when feasible.
- **Pure JavaScript & JSDoc:** Use modern ES Modules (`import`/`export`) with explicit JSDoc annotations for parameter types and return signatures.
- **Defensive Engineering:** Never assume DOM elements exist or remain static. Validate external input and schema payloads at system boundaries before execution.
- **Immutability:** Avoid mutating shared state or engine configuration directly. Always produce cloned state snapshots (`getStateSnapshot()`).

---

## 2. Monorepo Package Boundaries & Dependency Rules

| Package | Allowed Dependencies | Prohibited Dependencies |
| :--- | :--- | :--- |
| **`packages/core-types`** | None (pure constants & enums). | Any other package or external library. |
| **`packages/adapter-interface`** | `@guideme/core-types` | React, DOM globals, Chrome APIs. |
| **`packages/tutorial-schema`** | `@guideme/core-types` | React, DOM, Engine. |
| **`packages/engine`** | `@guideme/core-types`, `@guideme/adapter-interface`, `@guideme/tutorial-schema` | React, Chrome APIs, DOM-specific libraries. |
| **`packages/chrome-adapter`** | `@guideme/core-types`, `@guideme/adapter-interface` | React, Engine internal state. |
| **`packages/tutorial-ui`** | React 18, Lucide React, `@guideme/core-types` | Direct Engine state machine mutations, Chrome extension APIs. |
| **`apps/chrome-extension`** | All `@guideme/*` workspace packages, WXT. | Direct coupling between React and DOM mutation logic. |

---

## 3. Frontend & Extension (React 18 + WXT)

- **Pure Presentational Components:** React components in `@guideme/tutorial-ui` must be pure views driven by props. They trigger event callbacks (`onNext`, `onPrev`, `onSkip`, `onClose`, `onLanguageChange`, `onReplayAudio`) rather than manipulating the state machine directly.
- **Shadow DOM Style Encapsulation:** All overlay CSS must be injected directly into the Shadow Root via WXT's `createShadowRootUi` or `@import` within `style.css`.
- **Zero Host DOM Pollution:** Never inject global class names, un-scoped CSS tags, or style blocks directly onto `document.head` or `document.body`.
- **Hooks Discipline:** Keep hook logic clean. Use `useEffect` strictly for lifecycle subscriptions (e.g. `engine.subscribe()`), and clean up all listeners in return handlers.

---

## 4. Headless Engine Design Patterns

```javascript
// ✅ Good: Engine is pure JS, decoupled from React and DOM
export class TutorialEngine {
  constructor({ adapter, parser, schemaValidator }) {
    this.adapter = adapter;
    this.status = EngineStatus.IDLE;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notify() {
    const snapshot = this.getStateSnapshot();
    this.listeners.forEach((fn) => fn(snapshot));
  }
}
```

- **FSM Transitions:** State transitions (`IDLE` -> `LOADING` -> `STEP_ACTIVE` -> `VALIDATING` -> `STEP_COMPLETED` -> `COMPLETED`) must be explicit.
- **Decoupled Adapters:** All DOM queries, storage operations, and event interceptors must pass through `this.adapter` implementing `BaseTutorialAdapter`.

---

## 5. Styling, Typography & Design Tokens

- **Theme Palette:**
  - **Surface & Backgrounds:** `#12141a` (Card/Surface), `#1e222b` (Elevated), `#0f1117` (Dark Backdrop).
  - **Borders:** `#2a2f3b` (Subtle), `#3e4556` (Hover).
  - **Brand Accent:** `#f59e0b` (Amber Gold), Hover `#d97706`.
  - **Semantic Action Accents:**
    - Button / Click actions: Emerald (`#10b981`).
    - Input / Form fields: Blue (`#3b82f6`).
    - Navigation / Links: Amber (`#f59e0b`).
    - AI / Dynamic actions: Purple / Violet (`#8b5cf6`).
- **Typography Standards:**
  - **Khmer Text (Primary):** `'Kantumruy Pro'`, sans-serif.
  - **English / Latin Text (Secondary):** `'Inter'`, -apple-system, sans-serif.
  - **Monospace Stack:** System monospace (`ui-monospace`, `monospace`) for CSS selectors, DOM IDs, and technical metrics.
- **Spacing Grid:** Strict `4px` / `8px` spacing scale (`4px`, `8px`, `12px`, `16px`, `20px`, `24px`).
- **Corner Radii:** `12px` (`rounded-xl`) for buttons and inner badges; `16px` (`rounded-2xl`) for tooltip cards and modal containers.

---

## 6. Testing Standards

- **Test Runner:** Built-in Node.js Test Runner (`node:test` and `node:assert`).
- **Running Tests:** `npm test` or `npx pnpm test`.
- **Coverage Focus:**
  1. Finite state machine transitions and lifecycle events.
  2. Schema parser validation and error reporting.
  3. Dynamic DOM page analyzer and keyword heuristic generators.
  4. Khmer/English bilingual localization resolver and audio engine status.
- **Deterministic Assertions:** Never write flaky time-dependent tests; use mock adapters and clock ticks when simulating timeouts.
