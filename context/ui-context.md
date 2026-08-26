# UI Context — GuideMe

## 1. Visual Theme & Philosophy

GuideMe follows a **Dark Luxury Glassmorphic Aesthetic** with high-contrast amber/gold brand accents. The interface is engineered to feel modern, sleek, non-intrusive, and accessible across any host website.

- **Theme Base:** Dark slate/navy surfaces (`#12141a`, `#1e222b`) with subtle translucent borders (`rgba(255, 255, 255, 0.08)` / `#2a2f3b`).
- **Brand Accent:** Warm Amber Gold (`#f59e0b` to `#d97706`), conveying mastery, guidance, and premium polish.
- **Visual Distinction:** Strong contrast between darkened backdrop cutouts and illuminated target elements to guide user focus immediately.

### The 60-30-10 Color Rule Breakdown

| Ratio | Role | Color & Hex | Purpose in GuideMe UI |
| :--- | :--- | :--- | :--- |
| **60%** (Dominant) | **Dark Base & Backdrop** | `#0f1117` / `#12141a`<br/>`rgba(15, 17, 23, 0.82)` | Full-screen dimming mask cutout, main popup background, deep canvas. Creates maximum focus on the spotlighted element. |
| **30%** (Secondary) | **Surfaces, Cards & Text** | `#1e222b` (Card Surface)<br/>`#2a2f3b` (Subtle Borders)<br/>`#cbd5e1` / `#ffffff` (Text) | StepCard containers, search inputs, modal boxes, dividers, and readable instruction typography. |
| **10%** (Accent) | **Brand Gold & Action Highlights** | `#f59e0b` (Amber Gold)<br/>`#10b981` (Emerald Action)<br/>`#3b82f6` (Blue Input) | Glowing spotlight pulse rings, primary CTA buttons ("Next", "Start Guide"), active step counters, and audio equalizer bars. |

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
├── Spotlight (SVG Mask Cutout with Glow Pulse Ring)
└── Tooltip (Auto-Positioned Floating Container)
    └── StepCard
        ├── Header (Step Counter Badge, LanguageToggle, Close Button)
        ├── Content (Bilingual Title, Instruction, Step Type Badge)
        ├── Audio Bar (Equalizer Visualization, "ស្តាប់ឡើងវិញ / Listen" Button)
        ├── ProgressBar (Step Completion Gauge)
        └── Navigation Footer (Back, Skip, Next / Complete Action Button)
```

| Component | Responsibility |
| :--- | :--- |
| **`TutorialOverlay`** | Orchestrates SVG cutout, floating tooltip, and global keybindings (`Escape`, `ArrowRight`). |
| **`Spotlight`** | Computes SVG `path` mask with `evenodd` fill rule and rounded cutout around target DOM `DOMRect`. |
| **`StepCard`** | Renders localized instructions, audio equalizer, step badge, and navigation buttons. |
| **`LanguageToggle`** | Interactive bilingual pill switch (`🇰🇭 ខ្មែរ` / `🇬🇧 EN`) with instant state synchronization. |
| **`ProgressBar`** | Visual indicator displaying current step progress (`(currentStep / totalSteps) * 100%`). |
| **`FloatingAssistantButton`** | Collapsible floating bubble providing a quick way to resume or restart tutorials. |

---

## 4. Design Tokens & Color Palette

## 4. Exact Implemented Design Tokens & Color Palette

All colors match the exact Tailwind `@theme` in `apps/chrome-extension/entrypoints/content/style.css` and `popup/style.css`.

### 4.1 Surface, Background & Border Tokens (`@theme`)
```css
/* 60% Dominant: Dark Backdrops & Surfaces */
--color-gm-backdrop: rgba(15, 17, 23, 0.82);      /* Full-screen SVG spotlight mask */
--color-gm-dark: #0f1117;                          /* Deepest background base */
--color-gm-surface: #12141a;                       /* Popup body & StepCard root */
--color-gm-card: #12141a;                          /* Tooltip card container */
--color-gm-card-hover: #181b22;                    /* Interactive card / survey box */
--color-gm-elevated: #1e222b;                      /* Elevated header & pill surfaces */

/* 30% Secondary: Borders & Structural Dividers */
--color-gm-border: #2a2f3b;                        /* Default card & modal borders */
--color-gm-border-hover: #3e4556;                  /* Interactive button hover borders */
--color-gm-border-subtle: #232734;                 /* Header & footer divider lines */
```

### 4.2 Component Surface Hierarchy (Actual Hex Values in Components)
| Component Layer | Background Hex | Border Hex | Used in Component |
| :--- | :--- | :--- | :--- |
| **Card Header Gradient** | `from-[#1a1e28] to-[#12141a]` | `border-[#232734]` | `StepCard.jsx` |
| **Audio Narration Bar** | `bg-[#181c26]` | `border-[#2a3142]` | `StepCard.jsx` |
| **Listen Again Button** | `bg-[#1e232d]` (Hover `#272e3b`) | `border-[#333a4a]` (Hover `#f59e0b`) | `StepCard.jsx` |
| **Survey / Feedback Box** | `bg-[#181b22]` | `border-[#2a2f3b]` | `TutorialOverlay.jsx` |
| **Feedback Action Button** | `bg-[#262b35]` | `border-[#3e4556]` | `TutorialOverlay.jsx` |

### 4.3 10% Brand Accent & Glowing Focus (Amber Gold)
```css
/* Brand Gold Accent Tokens */
--color-gm-accent: #f59e0b;                        /* Amber-500 (Primary Gold) */
--color-gm-accent-hover: #d97706;                  /* Amber-600 (Button Hover) */
--color-gm-accent-active: #b45309;                 /* Amber-700 (Button Active) */
--color-gm-accent-contrast: #000000;               /* Black text on Gold buttons */
```

| Element | Implemented Styling Classes | Visual Appearance |
| :--- | :--- | :--- |
| **Primary CTA Button** | `bg-gradient-to-r from-amber-500 to-amber-600 text-black font-extrabold` | High-contrast gold gradient button |
| **Spotlight Target Glow** | `border-[2.5px] border-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.25),0_0_24px_rgba(245,158,11,0.45)]` | Glowing yellow pulse focus on element |
| **Pointer Callout Pill** | `bg-gradient-to-r from-amber-500 to-amber-600 text-black` | Floating "ចុចទីនេះ / CLICK" indicator |
| **Step Counter Badge** | `bg-amber-500/15 text-amber-500 border-amber-500/30` | Subtle translucent gold pill badge |
| **Audio Equalizer Waves** | `bg-amber-500` with `guideme-wave` animation | 5 animated vertical gold bars |

### 4.4 Typography Tokens
```css
--color-gm-text-primary: #ffffff;                  /* Primary titles & headings */
--color-gm-text-secondary: #cbd5e1;                /* Body copy (slate-300) */
--color-gm-text-muted: #94a3b8;                    /* Subtitles & icons (slate-400) */

--font-kantumruy: 'Kantumruy Pro', sans-serif;    /* Primary font (Khmer + English) */
--font-sans: 'Inter', sans-serif;                 /* Fallback Latin font */
--font-mono: ui-monospace, monospace;             /* Selectors & IDs */
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
- **`guideme-pulse`:** Continuous golden glow ring animation around target spotlight cutout (`box-shadow` pulse in `2s infinite`).
- **`guideme-wave`:** Equalizer bar animation for active audio playback (`height` oscillation in `1s ease-in-out infinite`).
