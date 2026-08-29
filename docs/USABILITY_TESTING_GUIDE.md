# GuideMe — Usability Testing Guide & Quality Assurance Protocol

This guide establishes a comprehensive, standard operating procedure for conducting **Usability Testing**, **Interactive QA**, and **User Experience (UX) Validation** on the GuideMe Universal Tutorial Engine Chrome extension.

---

## 1. Overview & Architecture of Extension Usability Testing

Unlike standard web applications, a browser extension operates across **three distinct execution contexts**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Google Chrome Browser                           │
│                                                                        │
│  ┌───────────────────────┐              ┌───────────────────────────┐  │
│  │  Extension Popup UI   │◄──messages──►│ Background Service Worker │  │
│  │ (Toolbar React App)   │              │     (background.js)       │  │
│  └───────────────────────┘              └─────────────┬─────────────┘  │
│                                                       │                │
│                                                    messages            │
│                                                       │                │
│  ┌────────────────────────────────────────────────────▼─────────────┐  │
│  │ Host Webpage DOM (e.g. Google Docs / test-demo.html / SaaS App)   │  │
│  │                                                                  │  │
│  │   ┌──────────────────────────────────────────────────────────┐   │  │
│  │   │ Isolated Shadow DOM (#guideme-tutorial-root)             │   │  │
│  │   │  ├── SVG Spotlight Mask (Interactive Cutout)             │   │  │
│  │   │  ├── Floating StepCard (Bilingual UI, Khmer TTS, Audio)   │   │  │
│  │   │  └── Floating Prompt / Assistant Widget                  │   │  │
│  │   └──────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

When evaluating usability, tests must verify not only the UI within the extension popup, but also how the **injected Shadow DOM overlay interacts with the host website's DOM without layout distortion or event interference**.

---

## 2. Core Usability Pillars

Every usability test session must assess five fundamental pillars:

| Usability Pillar | What to Evaluate | Key Components / Files |
| :--- | :--- | :--- |
| **1. Visual Focus & Glow Ring** | Does the radiant pulse ring and pointer pill clearly highlight target elements without dimming or blocking the host page? | `Spotlight.jsx` |
| **2. Interaction & Validation** | Can users interact freely with the host page? Does the engine auto-advance upon completion? | `entrypoints/content/index.jsx` |
| **3. Accessibility & Khmer Localization** | Is Khmer typography crisp and readable? Does audio narration (TTS) play clearly? Is the step card draggable? | `StepCard.jsx`, `ui-strings.js` |
| **4. Dynamic Auto-Guide (AI / Heuristic)** | Does ⚡ Auto-Guide correctly identify buttons, forms, and search bars on unscripted pages? | `dynamic-analyzer.js` |
| **5. Host Site Non-Intrusiveness** | Is the extension UI strictly contained in Shadow DOM without bleeding styles into the host website? | `entrypoints/content/style.css` |

---

## 3. Environment & Testbed Preparation

### 3.1 Build the Extension
Ensure all monorepo packages are compiled and the production extension bundle is generated:

```bash
# From workspace root:
npm run build
```

The output bundle will be located at:
`apps/chrome-extension/.output/chrome-mv3`

### 3.2 Load Unpacked Extension into Chrome
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked** (top-left) and select:
   `GuideMe/apps/chrome-extension/.output/chrome-mv3`
4. Click the puzzle icon in the Chrome toolbar and **Pin** the GuideMe icon for quick access.

### 3.3 Developer Tools & Multi-Context Inspection
Open DevTools across all three execution contexts to capture logs or silent errors:
- **Host Page & Content Script Overlay:** Right-click anywhere on the active web page -> **Inspect**. Look for `<guideme-tutorial-root>` in the Elements panel.
- **Extension Popup:** Right-click the GuideMe toolbar icon -> **Inspect popup**.
- **Background Service Worker:** On `chrome://extensions`, click **Inspect views: service worker** under GuideMe.

---

## 4. Step-by-Step Usability Test Protocols

### Protocol 1: Controlled Sandbox Usability Test (`test-demo.html`)

The built-in offline testbed simulates a real application with rich interactive controls, forms, and modal dialogs.

1. **Launch Testbed**:
   - Click the GuideMe extension icon in the toolbar.
   - Click **🚀 Open Local Demo Testbed Page** (or navigate to `chrome-extension://<EXTENSION_ID>/test-demo.html`).
2. **Execute Curated Walkthrough**:
   - In the popup, locate **Curated Walkthroughs** and click **Start Guide** on the *Demo Welcome Tour*.
3. **Verification Checkpoints**:
   - [ ] **Target Focus Alignment:** Does the radiant purple glowing ring snap accurately around the target element without dimming the screen?
   - [ ] **Click-Through Transparency:** Can the user freely click and interact with the host app?
   - [ ] **Action Validation:** Does the guide automatically advance to the next step immediately after the user performs the required action (click, text input)?
   - [ ] **Card Ergonomics & Dragging:** Click and drag the `StepCard` by its top header. Does it move smoothly? Double-click the header to reset position to default.

---

### Protocol 2: Khmer-First Accessibility & Audio Narration

GuideMe is engineered with first-class Khmer language and voice support for maximum digital accessibility.

1. **Live Language Switching**:
   - Toggle the language switch (`KM` / `EN`) in the popup or directly on the floating step card.
   - Verify that all instructional text, button labels, and step counts (e.g., `ជំហានទី ១/៤`) switch instantly without refreshing the host page.
2. **TTS Audio Narration**:
   - Click the **Speaker / Audio** icon on the step card.
   - Verify that browser speech synthesis reads the Khmer or English instructions audibly and cleanly.
   - Test the **Replay Audio** button (`FiRefreshCw`) to ensure seamless audio replay.
3. **Khmer Typography & Formatting**:
   - Confirm that Khmer text renders with the `Kantumruy Pro` font.
   - Check that subscripts, ligatures, and diacritics do not get clipped or overlap.

---

### Protocol 3: ⚡ Dynamic Auto-Guide on Live Websites

Evaluate how the heuristic analyzer performs on arbitrary, unscripted web pages.

1. **Test on Public Sites**:
   - Open a live site (e.g. Wikipedia, GitHub, or a web form).
2. **Run Auto-Guide**:
   - Open popup -> Click **⚡ Auto-Guide This Page**.
   - Verify that GuideMe scans the DOM and constructs a logical 3–5 step walkthrough covering primary navigation, search bars, and call-to-action buttons.
3. **Prompt-Driven Query Guidance**:
   - In the popup input field, enter a natural language command (e.g., `how to search` or `find navigation`).
   - Click **Run Prompt** (or use the microphone icon for speech-to-text input).
   - Verify that the generated walkthrough highlights the specific target requested.

---

### Protocol 4: Responsiveness, Scroll Tracking & Edge Cases

1. **Dynamic Scroll & Resize Tracking**:
   - Start any walkthrough.
   - Scroll up and down the page or resize the browser window.
   - **Pass Criteria:** The SVG spotlight mask and tooltip bounding box must dynamically track the target element via `requestAnimationFrame` / `ResizeObserver`.
2. **Theme Switching**:
   - Open popup settings (gear icon) and toggle between **Light** and **Dark** themes.
   - Check contrast ratios: Is text easily readable against both light and dark backgrounds?
3. **Graceful Exit & Resumption**:
   - Close a walkthrough halfway through (Click **X** on Step 2).
   - Reopen the popup: Does the extension update status gracefully and allow restarting from history?

---

## 5. Standardized Usability Evaluation Form (SUS)

For formalized testing sessions with end users, have participants complete the **System Usability Scale (SUS)** immediately following testing:

| # | Question (Scale 1: Strongly Disagree — 5: Strongly Agree) | 1 | 2 | 3 | 4 | 5 |
| :-: | :--- | :-: | :-: | :-: | :-: | :-: |
| 1 | I found the step-by-step spotlight guidance intuitive and easy to follow. | | | | | |
| 2 | I felt the spotlight overlay was intrusive or blocked my view of the page. | | | | | |
| 3 | The audio narration and instructions were clear and helpful. | | | | | |
| 4 | The system automatically advanced when I completed the required action. | | | | | |
| 5 | The language toggle between Khmer and English worked seamlessly. | | | | | |
| 6 | I felt confident navigating unfamiliar web pages using GuideMe. | | | | | |

> **Usability Benchmark**: A SUS score **> 80/100** indicates industry-leading usability for interactive overlay tools.

---

## 6. Usability Defect Checklist & Debugging Reference

| Symptom | Probable Cause | Resolution / Debug Location |
| :--- | :--- | :--- |
| **Spotlight misaligned or 0px wide** | Target element is hidden, loaded dynamically, or has `display: none`. | Check `dynamic-analyzer.js` element resolution; ensure fallback selectors (`data-testid`, `aria-label`) are defined. |
| **Clicks on target element not registering** | Spotlight overlay mask `pointer-events` blocking clicks. | Ensure SVG mask cutout has `pointer-events: none` on the overlay and `pointer-events: auto` on interactive cards. |
| **Host page styles affecting GuideMe UI** | CSS leaking into Shadow DOM. | Verify all CSS rules are enclosed within `:host` or loaded into `<guideme-tutorial-root>`. |
| **Audio narration not playing** | Browser Web Speech API blocked by autoplay policy or unsupported voice locale. | Open Host Page DevTools -> check `AudioEngine` logs; verify user has interacted with the page first. |

---

## 7. Automated Regression Suite

Run automated unit and integration tests prior to every usability testing release:

```bash
npm test
```

This verifies:
- `dynamic-analyzer.test.js`: Form, E-Commerce, Search, and Settings DOM classification.
- `engine.test.js`: Bilingual step indexing, I18nManager locale switching, AudioEngine playback states, and spreadsheet walkthrough schemas.
