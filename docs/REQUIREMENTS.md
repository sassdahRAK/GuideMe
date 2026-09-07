# GuideMe Requirements & Schema Specifications

> Core reference for functional requirements, declarative JSON schemas, multi-strategy DOM targeting, and validation rules.

---

## 1. Functional Requirements Matrix

| ID | Capability | Description | Layer / Package |
| :--- | :--- | :--- | :--- |
| **FR-01** | Pre-built Guide Execution | Run pre-made multi-step JSON guides with next/back/skip controls. | `@guideme/engine` (Logic) |
| **FR-02** | Target Highlighting | Draw SVG spotlight cutout and pulse ring over target elements. | `@guideme/tutorial-ui` (Shadow DOM) |
| **FR-03** | Viewport Anchoring | Auto-position floating step cards using `@floating-ui/dom`. | `@guideme/tutorial-ui` (Shadow DOM) |
| **FR-04** | Action Validation | Auto-advance on click, text input, dropdown change, or page navigation. | `@guideme/engine` (Logic) |
| **FR-05** | Dynamic Auto-Guide | Generate 3–5 step guides on unscripted pages using heuristics or AI. | `@guideme/engine` (Logic) |
| **FR-06** | Prompt Classifier | Identify greetings or unclear requests before guiding. | `@guideme/engine` (Logic) |
| **FR-07** | Khmer-First Dual-Language | Instant toggle between Khmer (`km`) and English (`en`); Kantumruy Pro font. | `@guideme/tutorial-ui` (Shadow DOM) |
| **FR-08** | Audio / Voice Guidance | Play voice narration with "Listen Again" trigger and visual equalizer. | `@guideme/tutorial-ui` (Shadow DOM) |
| **FR-09** | Session Durability | Save and restore active guide progress via `chrome.storage.local`. | `@guideme/chrome-adapter` |
| **FR-10** | Missing Target Recovery | Centered modal with retry banner if target element is missing. | `@guideme/tutorial-ui` (Shadow DOM) |

---

## 2. Declarative Tutorial JSON Schema

Walkthroughs are authored as portable JSON documents validated against `@guideme/tutorial-schema`:

```typescript
export interface TutorialSchema {
  id: string;                      // Unique identifier: "guideme-demo-tour"
  version: string;                 // Semantic version: "1.0.0"
  domain: string;                  // Target domain regex or pattern: "github.com"
  defaultLanguage: "km" | "en";    // Default: "km"
  supportedLanguages: ("km" | "en")[];
  title: { km: string; en: string };
  description?: { km: string; en: string };
  steps: StepDefinition[];
}

export interface StepDefinition {
  id: string;                      // "step-01-click-search"
  order: number;
  title: { km: string; en: string } | string;
  instruction: { km: string; en: string } | string;
  actionText?: { km: string; en: string } | string; // e.g., "ចុចទីនេះ" / "Click Here"
  target: TargetDefinition;
  validation: ValidationDefinition;
  audio?: AudioPromptConfig;
  placement?: "top" | "bottom" | "left" | "right" | "auto";
  canSkip?: boolean;
}
```

---

## 3. Multi-Strategy DOM Target Resolution

Targeting uses fallback strategies to ensure resilience against minor layout or framework changes:

```typescript
export interface TargetDefinition {
  css?: string;                    // Primary CSS selector: "#repo-search-input"
  testId?: string;                 // data-testid attribute value
  ariaLabel?: string;              // Accessible name match: "Search or jump to..."
  text?: string;                   // Exact or substring text content
  xpath?: string;                  // Fallback XPath query
  timeoutMs?: number;              // Polling duration before failing (default: 5000)
}
```

### Resolution Order
1. `testId` match (highest stability)
2. Direct `css` selector match
3. `ariaLabel` case-insensitive match
4. Visible text / link content match
5. `xpath` fallback query

*Rules:*
- Any candidate with `offsetParent === null` or `getClientRects().length === 0` is discarded as invisible.
- First visible, interacting match is selected.
- Zero-dimension boxes (`width === 0 && height === 0`) trigger missing-target recovery.

---

## 4. Validation Engine Specifications

Steps advance upon satisfying their defined validation criteria:

| Type | Trigger Event | Completion Condition |
| :--- | :--- | :--- |
| `click` | `click` / `pointerup` | Target element receives user click event. |
| `input` | `input` | Value matches `expectedValue`, OR 650ms debounced pause after typing. |
| `change` | `change` | Select dropdown, radio, or checkbox state changes. |
| `submit` | `submit` | Enclosing form submitted. |
| `url_change` | Navigation / History API | Active tab URL matches target regex/substring. |
| `manual_next` | UI Button Click | User clicks "Next" button in the StepCard directly. |
