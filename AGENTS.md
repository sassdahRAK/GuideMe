# GuideMe — AI Agent & Developer Operating Protocol

> **CRITICAL DIRECTIVE FOR ALL AI AGENTS & DEVELOPERS:**
> This repository strictly adheres to a **Context-Driven, Spec-Validated Architecture**. The files in [`context/`](file:///home/saoly/Documents/Code/GuideMeApp/GuideMe/context) constitute the **authoritative single source of truth** for all architectural boundaries, design tokens, and engineering standards.
> 
> You **MUST** consult and follow the corresponding `context/` files before making changes, and execute the mandatory verification protocol at the conclusion of every turn.

---

## 1. 📚 Canonical Context Mapping (`context/`)

Every agent action must align with the corresponding domain document:

| Domain | Context Source of Truth | Key Directives |
| :--- | :--- | :--- |
| **Workflow & Decoupling** | [`context/ai-workflow-rules.md`](file:///home/saoly/Documents/Code/GuideMeApp/GuideMe/context/ai-workflow-rules.md) | Spec-driven workflow, atomic increments, headless engine autonomy, Shadow DOM isolation. |
| **System Architecture** | [`context/architecture.md`](file:///home/saoly/Documents/Code/GuideMeApp/GuideMe/context/architecture.md) | 7-layer architecture, FSM lifecycle transitions, cross-context messaging schemas. |
| **UI & Design Tokens** | [`context/ui-context.md`](file:///home/saoly/Documents/Code/GuideMeApp/GuideMe/context/ui-context.md) | **60-30-10 Color Rule**, Light & Dark mode tokens, Kantumruy Pro typography, auto-flip tooltip collision rules. |
| **Code Standards** | [`context/code-standards.md`](file:///home/saoly/Documents/Code/GuideMeApp/GuideMe/context/code-standards.md) | Pure presentational components, hooks discipline, immutable state snapshots, defensive error handling. |
| **Step Specs & Validation** | [`context/software-engineering.md`](file:///home/saoly/Documents/Code/GuideMeApp/GuideMe/context/software-engineering.md) | Declarative JSON tutorial schemas, multi-strategy DOM resolution, validation types (`click`, `input`, `change`, `submit`, `url_change`, `manual_next`). |
| **Progress & Status** | [`context/progress-tracker.md`](file:///home/saoly/Documents/Code/GuideMeApp/GuideMe/context/progress-tracker.md) | Master milestone tracking, test health, and roadmap. |

---

## 2. 🚨 Mandatory Post-Implementation Verification Protocol

At the end of **every single task, UI tweak, or feature implementation**, you **MUST** automatically verify these three gates before completion without waiting for the user to prompt you:

### Gate 1: Theme Verification (Dark Mode & Light/White Mode)
- **Light Mode (`theme = 'light'`)**:
  - Background surfaces are clean `#ffffff`, borders `#e5e7eb` / `#ede4ff`, text high-contrast `#111827` / `#1f1d2b`.
  - No broken or invisible borders; hover and active states use crisp purple `#9333ea` / `#8b5cf6` accents.
- **Dark Mode (`theme = 'dark'`)**:
  - Deep dark surfaces (`#101018`, `#181826`, `#1e1e2f`, `#2d2d44`) properly apply.
  - Text is crisp and legible (`#f9fafb`, `#e4e4e7`, `#ffffff`).
  - No hardcoded white backgrounds or light borders that cause white flashes or outline clashes.
- **Tailwind CSS v4 Requirement**:
  - Ensure `@custom-variant dark (&:where(.dark, .dark *));` is present in style sheets so `.dark` class triggers styling dynamically rather than locking to OS `@media (prefers-color-scheme)`.
- **Live Sync**:
  - Theme changes in header, Settings drawer, or in-page overlays must immediately sync across open views and `chrome.storage.local`.

---

### Gate 2: Khmer-First Bilingual Verification (`km` & `en`)
GuideMe is a **Khmer-First** dual-language engine (`km` default, `en` secondary):
- **Zero Hardcoded Strings Policy**:
  - NEVER hardcode English-only strings in JSX/HTML for buttons, titles, subtitles, placeholders, tooltips, status badges, empty states, or AI messages.
  - All static strings MUST be registered in [`packages/tutorial-ui/src/i18n/ui-strings.js`](file:///home/saoly/Documents/Code/GuideMeApp/GuideMe/packages/tutorial-ui/src/i18n/ui-strings.js) or structured as `{ km: '...', en: '...' }` objects and resolved via `getUIString(key, lang)`.
- **Live Translation Verification**:
  - Toggling between `km` and `en` (in popup dropdown, Settings drawer, or step cards) must immediately re-render all visible text in the active language.
- **Khmer Typography**:
  - When in Khmer (`km`), ensure `font-kantumruy` (Kantumruy Pro) is active for high-readability Khmer typography.

---

### Gate 3: Automated Build & Regression Validation
Before concluding any task:
1. Run `pnpm test` — all test suites in `tests/` must pass (`14/14`).
2. Run `pnpm build` — ensure extension compiles cleanly into `apps/chrome-extension/.output/chrome-mv3`.
3. Update [`context/progress-tracker.md`](file:///home/saoly/Documents/Code/GuideMeApp/GuideMe/context/progress-tracker.md) whenever milestones or core features change.

---

## 3. 🛡️ Monorepo Decoupling Invariants

- **`@guideme/engine`**: Must remain 100% headless pure JS. NEVER import React, Tailwind, Chrome APIs, or DOM globals.
- **`@guideme/tutorial-ui`**: Pure presentational views driven by props and callbacks (`onNext`, `onPrev`, `onSkip`, `onClose`, `onLanguageChange`, `onThemeChange`).
- **Shadow DOM Mount**: All visual overlays must render inside the isolated `#guideme-tutorial-root` Shadow DOM via `createShadowRootUi` to prevent host page style leakage.
- **Zero DOM Pollution**: Never inject raw global styles or global utility classes directly into host `document.head` or `document.body`.

---

## 4. ⚠️ Rule & Context Violation Guardrail (Proactive Confirmation Protocol)

If a user request or prompt contradicts, breaks, or violates any established architectural invariant, design token guideline, or context specification in [`context/`](file:///home/saoly/Documents/Code/GuideMeApp/GuideMe/context) (such as breaking headless engine decoupling, introducing un-scoped global styles, hardcoding English-only text, violating the 60-30-10 color rule, or mutating state machines directly):

The AI Agent **MUST NOT** silently execute the violating change. Instead, the Agent **MUST proactively flag the conflict and ask for explicit user confirmation** before proceeding:

> ⚠️ **Architectural Conflict / Rule Violation Detected**
> 
> Your request to `[describe the requested change]` conflicts with our established context rules:
> - **Violated Specification:** [`context/<filename>.md`](file:///home/saoly/Documents/Code/GuideMeApp/GuideMe/context/<filename>.md)
> - **Reason for Conflict:** `[Explain clear technical reason, e.g. breaks headless testability, causes theme flashing, breaks Khmer-first dual-language support, or violates 60-30-10 color balance]`
> - **Recommended Clean Solution:** `[Provide the spec-compliant alternative that achieves the user's goal]`
> 
> **Do you want to confirm and explicitly override this rule, or should we proceed with the recommended architecture instead?**

---

## 5. 🧱 Strict Incremental Delivery & Minimal Blast Radius Invariant

- **Preserve Working Logic**: NEVER rewrite, replace, discard, or break existing working solutions, event listeners, state lifecycles, or architectural subsystems when implementing new features or UI refinements.
- **Surgical Modifications**: Only modify the exact components, lines, or styles required to fulfill the user's specific request. Do not refactor unrelated code.
- **Zero Regression Principle**: Any enhancement, styling polish, or bug fix must build strictly on top of the established, validated codebase without degrading existing features into dumbed-down replacements.


