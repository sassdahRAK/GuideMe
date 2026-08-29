# Verification Checklist: Strict Context Integration & Quality Gates

> **Operating Standard**: All AI agents and developers must strictly follow [`context/`](file:///home/saoly/Documents/Code/GuideMeApp/GuideMe/context) and execute these gates on every task.

## 1. Pre-Implementation Alignment
- Consult [`context/architecture.md`](file:///home/saoly/Documents/Code/GuideMeApp/GuideMe/context/architecture.md) and [`context/ai-workflow-rules.md`](file:///home/saoly/Documents/Code/GuideMeApp/GuideMe/context/ai-workflow-rules.md) for module boundaries.
- Follow [`context/ui-context.md`](file:///home/saoly/Documents/Code/GuideMeApp/GuideMe/context/ui-context.md) for 60-30-10 color rules and token definitions.
- Adhere to [`context/code-standards.md`](file:///home/saoly/Documents/Code/GuideMeApp/GuideMe/context/code-standards.md) for presentational component patterns.

## 2. Mandatory Verification Gates
1. **Gate 1: Dark Mode & Light (White) Mode**:
   - Check all components in Light (`#ffffff` base) and Dark (`#101018`/`#181826` base) modes.
   - Verify `@custom-variant dark (&:where(.dark, .dark *));` is active in Tailwind v4 CSS.
   - Verify immediate theme synchronization across all UI and storage.

2. **Gate 2: Khmer (`km`) & English (`en`) Support**:
   - Zero hardcoded English strings in JSX/HTML.
   - Register all static text in `packages/tutorial-ui/src/i18n/ui-strings.js` or bilingual `{ km, en }` objects.
   - Test language toggling and verify `font-kantumruy` rendering.

3. **Gate 3: Build & Tests**:
   - Verify `pnpm test` passes 100% (14/14 tests).
   - Verify `pnpm build` creates a clean bundle in `apps/chrome-extension/.output/chrome-mv3`.
   - Update [`context/progress-tracker.md`](file:///home/saoly/Documents/Code/GuideMeApp/GuideMe/context/progress-tracker.md).

## 3. ⚠️ Proactive Rule & Context Violation Protocol
If a prompt or requested change violates any context rule or architectural invariant:
- **Pause execution immediately.**
- **Ask the prompter for explicit confirmation** with:
  1. Conflicting specification cite (`context/<file>.md`).
  2. Clear technical explanation of why it violates the architecture ("because...").
  3. Recommended spec-compliant alternative.
  4. Explicit confirmation question: *"Do you want to confirm and override this rule, or should we proceed with the recommended architecture instead?"*

## 4. 🧱 Strict Incremental Delivery
- Never rewrite or discard existing working code.
- Apply surgical edits strictly confined to the requested change.
- Zero tolerance for regressions in working features.
