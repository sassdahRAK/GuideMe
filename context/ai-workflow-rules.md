# AI Workflow Rules — GuideMe

## 1. Core Engineering Approach

Build and refine GuideMe incrementally using a **spec-driven, test-validated workflow**. The context files in `context/` define the canonical system requirements, architectural boundaries, and design invariants.

- Always implement strictly against the architectural specifications in `context/architecture.md` and requirements in `context/software-engineering.md`.
- Never guess or invent architectural patterns that violate existing package decoupling contracts.

---

## 2. Monorepo Boundary & Decoupling Guardrails

1. **Headless Engine Autonomy:**
   - Never import React, Tailwind, or Chrome APIs into `@guideme/engine`.
   - Engine logic must remain 100% executable and testable in headless Node.js environments.
2. **Shadow DOM Isolation:**
   - All visual overlay components (`@guideme/tutorial-ui`) must mount strictly inside the isolated Shadow DOM (`guideme-tutorial-root`).
   - Never inject unstructured global CSS into the host page `document.head` or `document.body`.
3. **Bilingual Completeness:**
   - Whenever adding or modifying UI components, schema definitions, or tutorials, always ensure both **Khmer (`km`)** and **English (`en`)** translations and audio references are properly supported.
4. **State Immutability:**
   - The engine must publish immutable state snapshots via `getStateSnapshot()`. UI components must never mutate state machine internals directly.

---

## 3. Implementation & Scoping Rules

- **Work in Atomic Feature Units:** Deliver focused, verifiable increments without touching unrelated code.
- **Preserve Working Logic:** NEVER rewrite, discard, or break existing working solutions when implementing requested features.
- **Surgical Edits Only:** Limit blast radius strictly to the component, style, or logic requested by the user.
- **Run Tests Regularly:** Execute `pnpm test` after modifying any logic to ensure 0 regression across the test suite.
- **Defensive Error Handling:** Wrap external DOM queries, storage calls, and runtime messaging in defensive try/catch blocks with sensible fallbacks.

---

---

## 4. Rule & Context Violation Protocol

If any prompt or request violates the rules, architectural boundaries, 60-30-10 design system, or context documents in `context/`:
- **Do NOT execute breaking changes silently.**
- **Flag the violation directly to the prompter:**
  - Cite the conflicting `context/<file>.md` specification.
  - Explain the technical conflict ("because...").
  - Offer the clean recommended architecture.
  - Ask for explicit user confirmation before applying any override.

---

## 5. Definition of Done Checklist

Before considering an implementation task complete:
1. [ ] The feature works end-to-end within its defined package boundaries.
2. [ ] All invariants in `context/architecture.md` are preserved.
3. [ ] All unit tests in `tests/` pass (`pnpm test`).
4. [ ] Both Dark Mode and Light (White) Mode are verified.
5. [ ] Bilingual Khmer/English support with zero hardcoded strings is maintained.
6. [ ] `context/progress-tracker.md` is updated to reflect current state and completed milestones.
