# GuideMe — AI Agent & Developer Operating Protocol

> **CRITICAL DIRECTIVE FOR ALL AI AGENTS & DEVELOPERS:**
> This repository strictly adheres to a **Spec-Validated, Clean Architecture**. The files in [`docs/`](docs/) constitute the **authoritative single source of truth** for all architectural boundaries, design tokens, and engineering standards.
> 
> You **MUST** consult and follow the corresponding `docs/` files before making changes, and execute the mandatory verification protocol at the conclusion of every turn.

---

## 1. 📚 Core Documentation Directory (`docs/`)

Every agent action must align with the corresponding domain document:

| Domain | Source of Truth | Key Directives |
| :--- | :--- | :--- |
| **System Architecture** | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | 7-layer architecture, FSM lifecycle, cross-context messaging, headless engine autonomy, Shadow DOM isolation. |
| **Standards & Design Tokens** | [`docs/STANDARDS.md`](docs/STANDARDS.md) | **60-30-10 Color Rule**, Light/Dark mode tokens, Khmer typography (Kantumruy Pro), usability testing protocols. |
| **Decisions & Scope** | [`docs/DECISIONS.md`](docs/DECISIONS.md) | ADR 001–012, technical rationale, approved technology choices, deferred scopes. |
| **Requirements & Schemas** | [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) | Declarative JSON schemas, multi-strategy DOM targeting, action validation rules. |
| **Progress & Milestones** | [`docs/PROGRESS.md`](docs/PROGRESS.md) | Master milestone tracking, test health, and upcoming roadmap. |

---

## 2. 🛡️ Monorepo Boundary & Decoupling Safety Rules

1. **Headless Engine Autonomy (`@guideme/engine`):**
   - Never import React, Tailwind, Chrome APIs, or DOM globals (`window`, `document`) into `@guideme/engine`.
   - Engine logic must remain 100% executable and testable in headless Node.js environments.
2. **Shadow DOM Isolation (`@guideme/tutorial-ui`):**
   - All visual overlay components must mount strictly inside the isolated Shadow DOM (`guideme-tutorial-root`).
   - Never inject unstructured global CSS into the host page `document.head` or `document.body`.
3. **Pure Presentational UI:**
   - UI components receive state snapshots and dispatch callbacks (`onNext`, `onPrev`, `onSkip`, `onClose`, `onLanguageChange`, `onThemeChange`).
   - UI components must never mutate state machine internals directly.
4. **Bilingual Completeness (Khmer-First):**
   - Always support both **Khmer (`km`, default)** and **English (`en`, secondary)**.
   - Zero hardcoded English strings in JSX/HTML. All static strings must resolve via `getUIString(key, lang)` or `{ km, en }` objects.

---

## 3. 🚨 Mandatory Post-Implementation Verification Protocol

At the end of **every single task, UI tweak, or feature implementation**, you **MUST** automatically verify these three gates before completion:

### Gate 1: Theme Verification (Dark Mode & Light/White Mode)
- **Light Mode (`theme = 'light'`)**:
  - Background surfaces are clean `#ffffff`, borders `#e5e7eb` / `#ede4ff`, text high-contrast `#111827` / `#1f1d2b`.
  - No broken or invisible borders; hover and active states use crisp purple `#9333ea` / `#8b5cf6` accents.
- **Dark Mode (`theme = 'dark'`)**:
  - Deep dark surfaces (`#101018`, `#181826`, `#1e1e2f`, `#2d2d44`) properly apply.
  - Text is crisp and legible (`#f9fafb`, `#e4e4e7`, `#ffffff`).
  - No hardcoded white backgrounds or light borders that cause white flashes or outline clashes.
- **Tailwind CSS v4 Requirement**:
  - Ensure `@custom-variant dark (&:where(.dark, .dark *));` is present in style sheets so `.dark` class triggers styling dynamically.
- **Live Sync**:
  - Theme changes must immediately sync across open views and `chrome.storage.local`.

---

### Gate 2: Khmer-First Bilingual Verification (`km` & `en`)
- **Zero Hardcoded Strings Policy**:
  - NEVER hardcode English-only strings in JSX/HTML for buttons, titles, subtitles, placeholders, tooltips, status badges, or AI messages.
  - All static strings MUST be registered in `packages/tutorial-ui/src/i18n/ui-strings.js` or structured as `{ km: '...', en: '...' }` objects.
- **Live Translation Verification**:
  - Toggling between `km` and `en` must immediately re-render all visible text in the active language.
- **Khmer Typography**:
  - When in Khmer (`km`), ensure `font-kantumruy` (Kantumruy Pro) is active with comfortable line-height for diacritics.

---

### Gate 3: Automated Build & Regression Validation
- Run `pnpm test` — all test suites in `tests/` must pass.
- Run `pnpm build` — ensure extension compiles cleanly into `apps/chrome-extension/.output/chrome-mv3`.
- Update [`docs/PROGRESS.md`](docs/PROGRESS.md) whenever milestones or core features change.

---

## 4. ⚠️ Rule & Context Violation Safety Rules

If any prompt or request violates the rules, architectural boundaries, 60-30-10 design system, or documentation in `docs/`:
- **Do NOT execute breaking changes silently.**
- **Flag the violation directly to the prompter:**
  - Cite the conflicting `docs/<file>.md` specification.
  - Explain the technical conflict ("because...").
  - Offer the clean recommended architecture.
  - Ask for explicit user confirmation before applying any override.

---

## 5. 🧱 Strict Incremental Delivery & Minimal Blast Radius Invariant

- **Preserve Working Logic**: NEVER rewrite, replace, discard, or break existing working solutions, event listeners, state lifecycles, or architectural subsystems.
- **Surgical Modifications**: Only modify the exact components, lines, or styles required to fulfill the user's specific request.
- **Zero Regression Principle**: Any enhancement, styling polish, or bug fix must build strictly on top of the established, validated codebase.
