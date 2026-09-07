# GuideMe Engineering Standards & Design System

> Core guidelines for code quality, design tokens, accessibility, and usability QA protocols.

---

## 1. 60-30-10 Design Token System

GuideMe UI uses a strict **60-30-10 color ratio** across all components in both Light and Dark themes.

### Light Mode (`theme = 'light'`)
| Ratio | Role | Color Token | Hex Code | Usage |
| :---: | :--- | :--- | :--- | :--- |
| **60%** | Dominant Canvas | Background Neutral | `#ffffff` | Card surfaces, popup body, drawers |
| **30%** | Structural Secondary | Contrast / Neutral Soft | `#111827` (Text), `#f3f4f6` (Secondary), `#e5e7eb` (Borders) | Headers, text, borders, pill chips |
| **10%** | Interactive Accent | Electric Violet / Pulse Purple | `#9333ea` (Primary), `#7e22ce` (Hover), `#a855f7` (Glow) | Active CTA buttons, spotlight rings, focus rings |

### Dark Mode (`theme = 'dark'`)
| Ratio | Role | Color Token | Hex Code | Usage |
| :---: | :--- | :--- | :--- | :--- |
| **60%** | Dominant Canvas | Deep Obsidian | `#101018` / `#181826` | Card background, popup canvas |
| **30%** | Structural Secondary | Slate Border & Crisp Text | `#2d2d44` (Borders), `#f9fafb` (Headers), `#9ca3af` (Muted) | Card frames, secondary text, divider lines |
| **10%** | Interactive Accent | Neon Purple Glow | `#9333ea` (Primary), `#a855f7` (Hover/Glow ring) | Pulsing outline rings, action badges, primary buttons |

### Tailwind CSS v4 Dark Mode Requirement
All stylesheets must declare:
```css
@custom-variant dark (&:where(.dark, .dark *));
```
This ensures `.dark` class triggers styling dynamically regardless of OS `@media (prefers-color-scheme)`.

---

## 2. Khmer-First Accessibility Mandate

GuideMe is engineered specifically for digital literacy with **Khmer (`km`) as default** and **English (`en`) as secondary**:

1. **Zero Hardcoded Strings Policy**:
   - Every string rendered in UI must resolve through `getUIString(key, lang)` in `packages/tutorial-ui/src/i18n/ui-strings.js` or via `{ km: string, en: string }` localized objects.
   - Hardcoded English-only strings in JSX/HTML are strictly forbidden.
2. **Khmer Typography**:
   - When active language is `km`, text must apply `font-kantumruy` (`Kantumruy Pro`).
   - Line height must accommodate Khmer diacritics and subscripts without clipping (`leading-relaxed` or `leading-loose`).
3. **Numerals**:
   - Khmer numerals (`១, ២, ៣...`) must be used for step counters when `lang === 'km'`.
4. **Live Language Switching**:
   - Toggling language must update all UI immediately without refreshing the page or restarting active tutorials.
5. **Pluggable Audio / TTS**:
   - Audio guidance uses `BaseTtsProvider` interface, allowing plug-in of the AI team's Khmer TTS service with clean fallback handling.

---

## 3. Code Standards & Architecture Discipline

### React & Component Discipline (`@guideme/tutorial-ui`)
- **Pure Presentational**: Components receive state snapshots and dispatch events. Zero direct DOM queries or mutations outside the isolated Shadow Root.
- **Hooks Discipline**: Keep state minimal; derive values. Avoid deep nested hooks.
- **Shadow DOM Strictness**: All styles must be scoped within `#guideme-tutorial-root`. Never insert global tags into host `document.head` or `document.body`.
- **Floating UI Discipline**: Use `@floating-ui/dom` with `flip()`, `shift({ padding: 16 })`, and `offset(16)` for tooltips. User drag custom coordinates always take precedence over auto-positioning.

### Headless Engine Discipline (`@guideme/engine`)
- **Zero Framework Imports**: No React, no Tailwind, no Chrome API calls.
- **Immutable State Snapshots**: Publish state via `getStateSnapshot()`. External callers cannot mutate internal state machine variables.
- **Defensive Execution**: All DOM observer queries, storage access, and cross-context messaging must be wrapped in defensive try/catch blocks with graceful fallbacks.

### Testing Standard (TDD)
- Core logic in `@guideme/engine`, schemas in `@guideme/tutorial-schema`, and observers in `@guideme/chrome-adapter` must have automated unit tests.
- Run `pnpm test` regularly; zero test regressions allowed.

---

## 4. Usability Testing & QA Protocol

### Usability Evaluation Pillars
1. **Visual Focus & Target Alignment**: Spotlight mask snaps cleanly to element boundaries. No dimming of interactive areas.
2. **Action Validation**: Guided actions auto-advance immediately upon completion (click, typed text, debounced pause).
3. **Bilingual Typography & Audio**: Khmer glyphs render without truncation; audio replay button plays instruction cleanly.
4. **Non-Intrusiveness**: Host page layout, scroll behavior, and pointer events remain intact.
5. **Draggable Ergonomics**: User can drag step cards away from obscured content via the header handle.

### Testing Testbeds
- **Sandbox Testbed**: `chrome-extension://<EXTENSION_ID>/test-demo.html` (simulates interactive controls, inputs, and forms offline).
- **Live SaaS / Public Web**: Verified against unscripted complex SPAs (e.g. GitHub, Google Docs, Wikipedia).

### Usability Checklist (SUS Target > 80/100)
- [ ] Target element clearly visible inside spotlight cutout.
- [ ] Clicks on the highlighted element register on the host site without block.
- [ ] Language toggle updates text and step badges instantly.
- [ ] Missing target gracefully falls back to centered card with retry prompt.
- [ ] Window resize or scrolling dynamically tracks spotlight position.
- [ ] Light and Dark themes both maintain readable contrast and proper borders.
