# UI Context — GuideMe

## 1. Visual Theme & Philosophy

GuideMe follows a **Clean High-Contrast Light Aesthetic** with a focused purple brand accent, strictly adhering to the **60-30-10 design rule**. The interface is engineered to feel modern, accessible, and non-intrusive across any host website.

> **Old theme (deprecated):** Dark Luxury Glassmorphic with Amber Gold (`#f59e0b`) accent.
> **Current theme:** High-contrast light with Purple (`#9333ea`) as the single accent.

- **Theme Base:** White surfaces (`#FFFFFF`) with neutral gray structural elements (`#F3F4F6`, `#E5E7EB`).
- **Brand Accent:** Purple (`#9333ea` — Tailwind `purple-600`), exclusively on CTAs, focus states, and badge indicators.
- **Visual Distinction:** Black/60% semi-transparent backdrop cutout (SVG mask) with a purple glow ring around the target element.

### The 60-30-10 Color Rule Breakdown (Light Mode)

| Ratio | Role | Color & Hex | Purpose in GuideMe UI |
| :--- | :--- | :--- | :--- |
| **60%** (Dominant) | **White Base Surfaces** | `#FFFFFF` | Card backgrounds, popup container, floating widget surface, completion modal. |
| **30%** (Secondary) | **Neutrals / Grays & Dark Typography** | `#111827` / `#374151` (Text)<br/>`#F3F4F6` (Input fill)<br/>`#E5E7EB` (Borders)<br/>`#6B7280` (Muted labels) | All structural content, input containers, body copy, divider lines, placeholder text, and secondary labels. |
| **10%** (Accent) | **Purple Brand Accent** | `#9333EA` (Primary)<br/>`#7C3AED` (Hover)<br/>`#F3E8FF` (Light tint) | Exclusively: primary CTA ("Extract Separate UI"), Next/Finish step button, spotlight glow ring, connector line, active language pill, progress bar fill, step counter badge. |

### Dark Mode Token Mapping

To maintain the exact same 60-30-10 balance in dark mode, invert the neutral roles while keeping the accent focused:

| Role | Percentage | Dark Mode Token | Usage |
| :--- | :--- | :--- | :--- |
| **Dominant** | **60%** | Deep Slate (`#1E1E2E` / `#121212`) | Card & popup background |
| **Secondary** | **30%** | Muted Grays & Off-White (`#E4E4E7` / `#2A2A3C`) | Input bg, subtle borders, text labels |
| **Accent** | **10%** | Lighter Purple (`#A855F7` / `#C084FC`) | Primary CTA & active focus states |

---

## 2. Target Environments & Surfaces

### 2.1 Extension Toolbar Popup (`apps/chrome-extension/entrypoints/popup`)
- **Dimensions:** Fixed width `380px`, max height `580px`, fluid scrollable content.
- **Key Sections:**
  - **Header:** GuideMe gold logo emblem + active tab domain pill badge (e.g. `docs.google.com`).
  - **⚡ Auto-Guide Action Bar:** Prominent gradient card to trigger instant dynamic page scanning with optional AI intent prompt input.
  - **Curated Walkthroughs List:** Categorized guides with URL `MATCHED` badges, step count, and direct "Start Guide" buttons.
  - **Quick Launch Utilities:** Sandbox testbed opener and Google Docs demo launcher.

### 2.2 In-Page Shadow DOM Overlay (`packages/tutorial-ui` & `content/index.jsx`)
- **Mount Point:** Isolated Shadow Root (`guideme-tutorial-root`) attached directly to `document.body`.
- **Z-Index:** Root container fixed at `z-index: 2147483647` (highest 32-bit integer) to guarantee rendering above any host application modals or toolbars.
- **Pointer Events Strategy:** The backdrop allows clicks on the spotlight cutout while capturing dismiss clicks on the dark mask.

### 2.3 Offline Sandbox Demo Testbed (`apps/chrome-extension/public/test-demo.html`)
- Clean local test environment with sample interactive forms, dropdowns, buttons, and tables to test engine flows offline.

---

## 3. Component Architecture & UI Elements

```text
TutorialOverlay (Root Shadow DOM Container)
├── Spotlight (Target Glow & Stylized Pointing Hand Cursor)
├── FloatingPromptWidget ("Extract Separate UI" Floating Prompt Bar)
├── FloatingAssistantButton (Black Pill "Ask GuideMe" Floating Button)
└── Tooltip (Auto-Positioned Floating Container)
    └── StepCard (Translucent Dark Frosted Glassmorphic Step Card)
        ├── Top Header (Speaker & Sound Wave Equalizer | Step X/Y + Language Pill + Close)
        ├── Instruction Body (Clean instruction text)
        ├── Action Pill ("Explain detail" / "ពន្យល់លម្អិត" expandable drawer)
        └── Navigation Footer (Progress bar with thumb handle | Back [←], Skip, Next [→])
```

| Component | Responsibility |
| :--- | :--- |
| **`TutorialOverlay`** | Orchestrates spotlight, floating step card, floating prompt bar, and global keybindings. |
| **`Spotlight`** | Computes target glowing boundary box and renders the stylized pointing hand cursor directly pointing at the target element. |
| **`StepCard`** | Translucent frosted glass step card with audio wave controls, step counter, "Explain detail" pill, progress thumb slider, and navigation arrows. |
| **`FloatingPromptWidget`** | In-page draggable prompt bar for AI guidance queries ("Ask anything..."). |
| **`FloatingAssistantButton`** | Black rounded button in the bottom-right corner ("Ask GuideMe") to open prompt or access context menu. |

---

## 4. Exact Implemented Design Tokens & Color Palette

All tokens are defined in the Tailwind `@theme` in `apps/chrome-extension/entrypoints/content/style.css` and `popup/style.css`.

### 4.1 Light Mode Tokens (Current Implementation)
```css
/* 60% Dominant: White Surfaces */
--color-gm-bg: #ffffff;
--color-gm-surface: #ffffff;
--color-gm-card: #ffffff;

/* 30% Secondary: Neutral Grays & Typography */
--color-gm-elevated: #f9fafb;          /* Page-level elevated surfaces */
--color-gm-input-bg: #f3f4f6;         /* Input field fill */
--color-gm-border: #e5e7eb;           /* Default card & modal borders */
--color-gm-border-hover: #d1d5db;     /* Hover state borders */
--color-gm-border-subtle: #f3f4f6;    /* Header & footer dividers */
--color-gm-text-primary: #111827;     /* Primary headings & strong text */
--color-gm-text-secondary: #374151;   /* Body copy */
--color-gm-text-muted: #6b7280;       /* Subtitles & icons */
--color-gm-text-placeholder: #9ca3af; /* Input placeholder */

/* 10% Accent: Purple */
--color-gm-accent: #9333ea;           /* Tailwind purple-600 */
--color-gm-accent-hover: #7c3aed;     /* Tailwind violet-700 */
--color-gm-accent-active: #6d28d9;    /* Tailwind violet-800 */
--color-gm-accent-light: #f3e8ff;     /* purple-100 tint for bg fills */
--color-gm-accent-contrast: #ffffff;  /* White text on purple buttons */

/* Dark Mode Tokens */
--color-gm-dark-bg: #1e1e2e;
--color-gm-dark-card: #121212;
--color-gm-dark-input: #2a2a3c;
--color-gm-dark-border: #3f3f5a;
--color-gm-dark-text: #e4e4e7;
--color-gm-dark-accent: #a855f7;      /* Tailwind purple-500 (lighter for dark bg) */
```

### 4.2 Component Surface Hierarchy
| Component Layer | Background | Border | Used in |
| :--- | :--- | :--- | :--- |
| **Card / Popup Container** | `bg-white` | `border-gray-200` | `StepCard.jsx`, `FloatingPromptWidget.jsx` |
| **Card Header** | `bg-white` / `bg-gray-50` (on drag) | `border-b border-gray-100` | `StepCard.jsx` |
| **Audio Narration Bar** | `bg-gray-50` | `border-gray-200` | `StepCard.jsx` |
| **Listen Again Button** | `bg-gray-100` (Hover `bg-gray-200`) | `border-gray-200` (Hover `border-purple-300`) | `StepCard.jsx` |
| **Input Field** | `bg-gray-50` (Focus `bg-white`) | `border-gray-200` (Focus `border-purple-400`) | `App.jsx`, `FloatingPromptWidget.jsx` |
| **Survey / Feedback Box** | `bg-gray-50` | `border-gray-200` | `TutorialOverlay.jsx` |
| **Settings Sections** | `bg-purple-50` | none | `App.jsx` (Settings Panel) |

### 4.3 10% Brand Accent — Purple
| Element | Tailwind Classes | Visual Appearance |
| :--- | :--- | :--- |
| **Primary CTA Button** | `bg-purple-600 hover:bg-purple-700 text-white font-semibold` | Solid purple button, white label |
| **Spotlight Target Glow** | `border-[2.5px] border-purple-600 shadow-[0_0_0_4px_rgba(147,51,234,0.20),0_0_20px_rgba(147,51,234,0.35)]` | Purple pulse focus ring |
| **Pointer Callout Pill** | `bg-purple-600 text-white` | Floating "ចុចទីនេះ / CLICK" indicator |
| **Step Counter Badge** | `bg-purple-100 text-purple-700 border border-purple-200` | Subtle purple pill badge |
| **Audio Equalizer Waves** | `bg-purple-500` with `guideme-wave` animation | 5 animated vertical purple bars |
| **Progress Bar Fill** | `bg-purple-600 shadow-[0_0_6px_rgba(147,51,234,0.4)]` | Purple progress with soft glow |
| **Active Language Pill** | `bg-purple-600 text-white` | Solid purple pill |
| **Focus Ring on Inputs** | `focus-within:border-purple-400 focus-within:shadow-[0_0_0_3px_rgba(147,51,234,0.08)]` | Subtle purple outline |

### 4.4 Typography Tokens
```css
--color-gm-text-primary: #111827;    /* Primary titles & headings (gray-900) */
--color-gm-text-secondary: #374151;  /* Body copy (gray-700) */
--color-gm-text-muted: #6b7280;      /* Subtitles & icons (gray-500) */

--font-kantumruy: 'Kantumruy Pro', sans-serif;  /* Primary font (Khmer + English) */
--font-sans: 'Inter', sans-serif;               /* Fallback Latin font */
```

---

## 5. Layout & Viewport Collision Rules

### 5.1 Auto-Flip Floating Tooltip Placement
The floating `Tooltip` calculates optimal placement around the target element's bounding rect:
1. **Preferred Placements:** `bottom` -> `top` -> `right` -> `left`.
2. **Auto-Flip Logic:** If `targetRect.bottom + tooltipHeight > window.innerHeight - 20px`, automatically flips to `top`.
3. **Horizontal Clamping:** Constrained within `16px` margin of the viewport boundaries (`Math.max(16, Math.min(x, window.innerWidth - tooltipWidth - 16))`).
4. **Fallback Centering:** If no target element exists or element is offscreen, smoothly centers in viewport with a subtle backdrop badge.

### 5.2 Micro-Animations & Transitions
- **`guideme-card-pop`:** Tooltip entry animation (scale `0.95` -> `1`, translateY `6px` -> `0`, opacity `0` -> `1` in `200ms ease-out`).
- **`guideme-pulse`:** Continuous **purple** glow ring animation around target spotlight cutout (`box-shadow` pulse with `rgba(147, 51, 234, ...)` in `2s infinite`).
- **`guideme-wave`:** Equalizer bar animation for active audio playback — **purple bars** (`height` oscillation in `0.8s ease-in-out infinite alternate`).
- **`guideme-spin`:** Circular spinner for the processing/loading state inside the prompt input (linear `0.8s` rotation).
