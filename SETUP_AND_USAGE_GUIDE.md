# GuideMe — Universal Tutorial Engine

## Complete Setup & User Guide

**GuideMe** is the client repository in a multi-repo universal tutorial system. The companion `GuideMe-Site` repository is a full-stack repository containing the web frontend and shared backend API. The browser extension, and the future desktop app, are clients of that API. The extension overlays non-intrusive step-by-step guidance, SVG spotlights, dynamic DOM interaction validation, and on-the-fly automated page guides directly on any web application.

---

## Table of Contents

1. [Architecture & Multi-Repo Overview](#1-architecture--multi-repo-overview)
2. [Prerequisites](#2-prerequisites)
3. [Setup & Installation](#3-setup--installation)
4. [Development & Build Commands](#4-development--build-commands)
5. [Loading Extension into Browser](#5-loading-extension-into-browser)
6. [How to Use GuideMe](#6-how-to-use-guideme)
   - [6.1 Extension Popup Overview](#61-extension-popup-overview)
   - [6.2 Running Curated Walkthroughs](#62-running-curated-walkthroughs)
   - [6.3 Using Auto-Guide (Dynamic Page Analyzer)](#63-using-auto-guide-dynamic-page-analyzer)
   - [6.4 Local Offline Testbed Page](#64-local-offline-testbed-page)
7. [Authoring Custom Tutorial JSON Guides](#7-authoring-custom-tutorial-json-guides)
   - [7.1 Tutorial Schema Reference](#71-tutorial-schema-reference)
   - [7.2 Target Selectors & Matching](#72-target-selectors--matching)
   - [7.3 Validation Types](#73-validation-types)
   - [7.4 Sample Tutorial JSON](#74-sample-tutorial-json)
8. [Troubleshooting & FAQ](#8-troubleshooting--faq)

---

## 1. Architecture & Multi-Repo Overview

The project uses two repositories. `GuideMe-Site` is the full-stack web/API repository, while this `GuideMe` repository is the client repository. Within the client repository, the extension is built as a modular PNPM workspace using **React 18** and **WXT** (Web Extension Framework).

```text
GuideMe-Site/                         # Repo 1: Web & API (full-stack repository)
├── frontend/
└── backend/  <----------------------------- shared API requests
                                                ^
GuideMe/                               # Repo 2: Clients
├── apps/chrome-extension/
└── desktop/                           # Future client
```

```
GuideMe/
├── apps/
│   ├── chrome-extension/   # WXT + React Browser Extension (MV3 Chrome/Firefox)
│   │   ├── entrypoints/
│   │   │   ├── background.js    # Service worker runtime listener
│   │   │   ├── content/        # Shadow DOM Content Script UI overlay
│   │   │   └── popup/          # Extension toolbar Popup React UI
│   │   ├── public/             # Built-in offline testbed (test-demo.html)
│   │   └── wxt.config.js       # Extension manifest & Vite config
│   └── authoring-studio/   # Reserved folder for visual guide builder
├── packages/
│   ├── engine/             # Core state machine, step resolver & dynamic analyzer
│   ├── tutorial-ui/        # React components (Spotlight, Tooltip, StepCard, Overlay)
│   ├── tutorial-schema/    # JSON schema validator & structural definitions
│   ├── chrome-adapter/     # Chrome DOM observer, storage & event listeners
│   ├── adapter-interface/  # Platform-agnostic adapter interface base class
│   └── core-types/         # Shared TypeScript/JS constants, actions & types
├── tutorials/              # Prebuilt walkthrough JSON files
│   ├── general/            # Welcome & general feature tours
│   └── google-docs/        # Google Docs specific walkthroughs
├── tests/                  # Node.js test runner suites
├── docs/                   # Specifications, requirements & guides
├── package.json            # Monorepo root config
└── pnpm-workspace.yaml     # Monorepo workspace layout
```

### Key Technical Features:

- **Shadow DOM Isolation**: The UI overlay renders inside an isolated Shadow DOM (`guideme-tutorial-root`), ensuring extension CSS never conflicts with host site styles.
- **Hybrid Tutorial Mode**: Supports both pre-authored JSON walkthroughs and dynamic AI/heuristics-based page auto-guided walkthroughs (`DynamicPageAnalyzer`).
- **Real-Time Dynamic Target Resolution**: Multi-strategy DOM resolver supporting CSS selectors, `data-testid`, `aria-label`, and text matching with MutationObserver element polling.
- **Interactive SVG Spotlight**: Smooth SVG mask cutout highlights target elements without blocking click interactions on the underlying website.

---

## 2. Prerequisites

Before installing GuideMe, ensure your system has the following installed:

- **Node.js**: `v18.0.0` or higher (v20+ or v22+ recommended). Check version with `node -v`.
- **Package Manager**: `pnpm` (recommended for monorepo workspace support) or `npm` (`v9.0.0`+).
  - To install PNPM globally:
    ```bash
    npm install -g pnpm
    # or enable via Corepack:
    corepack enable && corepack prepare pnpm@latest --activate
    ```

---

## 3. Setup & Installation

Dependencies across all 8 workspace packages are installed via `pnpm`.

### Running Commands Without Global `pnpm`:

If `pnpm` is not installed globally on your machine, you can run all commands directly using `npx pnpm`:

```bash
# Install workspace dependencies
npx pnpm install

# Start development server with HMR
npx pnpm dev

# Build production Chrome extension
npx pnpm build

# Run unit test suite
npx pnpm test
```

### Installing `pnpm`:

- **Windows (PowerShell)**:
  ```powershell
  iwr https://get.pnpm.io/install.ps1 -useb | iex
  ```
- **macOS / Linux**:
  ```bash
  curl -fsSL https://get.pnpm.io/install.sh | sh -
  ```

---

## 4. Development & Build Commands

All main commands can be run from the repository root:

| Command                                                   | Action / Description                                                                           |
| :-------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| `npx pnpm dev`                                            | Launches the WXT development server with Hot Module Reloading (HMR).                           |
| `npx pnpm build`                                          | Builds the production Manifest V3 extension inside `apps/chrome-extension/.output/chrome-mv3`. |
| `npx pnpm --filter @guideme/chrome-extension dev:firefox` | Runs development server targeting Mozilla Firefox.                                             |

Ensure you have the following installed on your development machine:

- **Node.js**: `v18.0.0` or later (tested on Node v20/v22).
- **pnpm**: `v9.0.0` or later (recommended package manager).
- **Google Chrome / Chromium-based Browser**: Chrome v102+ with Manifest V3 support.

---

## 3. Repository Installation

Clone the repository and install all workspace dependencies:

```bash
# Clone the repository
git clone https://github.com/sassdahRAK/GuideMe.git
cd GuideMe

# Install all monorepo dependencies
pnpm install
```

---

## 4. Environment Configuration

Copy the example `.env` file to create your extension environment configuration:

```bash
cp apps/chrome-extension/.env.example apps/chrome-extension/.env
```

Open `apps/chrome-extension/.env` in your editor and configure your preferred AI provider API key:

```env
# Google Gemini API Key (Default)
VITE_GEMINI_API_KEY="your-gemini-api-key-here"

# Optional: Anthropic Claude API Key
VITE_ANTHROPIC_API_KEY=""

# Optional: OpenAI API Key
VITE_OPENAI_API_KEY=""

# Optional: DeepSeek API Key
VITE_DEEPSEEK_API_KEY=""
```

> **Note**: Even without an API key, GuideMe ships with built-in mock/demo guides for Google Docs and general test environments that work 100% offline out-of-the-box!

---

## 5. Building & Loading the Extension

### 5.1 Build the Extension

Run the production build command:

```bash
pnpm build
```

This compiles all packages and generates the unpacked Chrome extension into:

```
apps/chrome-extension/.output/chrome-mv3/
```

### 5.2 Load into Google Chrome

1. Open Google Chrome.
2. In the address bar, navigate to:
   ```
   chrome://extensions
   ```
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click the **Load unpacked** button in the top left corner.
5. Select the output directory:
   ```
   GuideMe/apps/chrome-extension/.output/chrome-mv3
   ```
6. The **GuideMe: Universal Tutorial Engine** extension icon will now appear in your browser toolbar.

---

## 6. How to Use GuideMe

### 6.1 Extension Popup Overview

Clicking the GuideMe icon in your extension toolbar opens the control popup:

- **Active Context**: Displays the current web domain (e.g., `docs.google.com` or `Local Demo Testbed`) and connection status (`Ready` or `Standby`).
- **⚡ Auto-Guide This Page**: Instant button to dynamically generate and launch an interactive tour of any unknown page.
- **Curated Walkthroughs**: Lists predefined guides. Matches are automatically highlighted with a gold `MATCHED` tag based on URL patterns.
- **Quick Launch Buttons**:
  - `🚀 Open Local Demo Testbed Page`: Opens the offline sandbox demo page.
  - `📄 Open New Google Doc Tab`: Opens a blank Google Doc to test Google Docs walkthroughs.

### 6.2 Running Curated Walkthroughs

1. Navigate to a site with a matching tutorial (e.g. Google Docs or `test-demo.html`).
2. Click the GuideMe toolbar icon.
3. Locate the guide under **Curated Walkthroughs** and click **Start Guide**.
4. The GuideMe Spotlight will highlight the target element on the web page:
   - Read the tooltip instructions.
   - Complete the required action (e.g., click a highlighted button or fill in a text field).
   - The engine automatically validates your interaction and proceeds to the next step.
   - Use the controls on the overlay to go **Next**, **Previous**, **Skip**, or **Close**.

### 6.3 Using Auto-Guide (Dynamic Page Analyzer)

GuideMe features an intelligent DOM analyzer (`DynamicPageAnalyzer`) for unscripted pages:

1. Visit any web page or SaaS dashboard.
2. Click the GuideMe extension icon.
3. Click **⚡ Auto-Guide This Page**.
4. GuideMe scans the DOM for primary actions, forms, input fields, navigation links, and headers, automatically constructing an interactive step-by-step walkthrough in real time!

### 6.4 Local Offline Testbed Page

To test features without an active internet connection:

1. Open the popup and click **🚀 Open Local Demo Testbed Page**.
2. Or navigate directly to `chrome-extension://<EXTENSION_ID>/test-demo.html`.
3. Test interactive spotlights, input validation, modal popups, and state progression in a controlled offline environment.

---

## 7. Authoring Custom Tutorial JSON Guides

You can add new walkthroughs simply by creating JSON definition files in `tutorials/` or importing them into `catalog.js`.

### 7.1 Tutorial Schema Reference

Every tutorial JSON file follows this top-level structure:

```json
{
  "id": "unique-tutorial-id",
  "version": "1.0.0",
  "name": "Human Readable Title",
  "description": "Brief description of what this walkthrough teaches.",
  "matchUrls": ["https://example.com/dashboard/*", "*://*/*test-demo.html*"],
  "steps": [
    {
      "id": "step_1",
      "title": "Step Title",
      "description": "Instructional text displayed in tooltip/modal.",
      "target": {
        "css": "#target-button, .btn-primary",
        "text": "Submit",
        "ariaLabel": "Submit Form"
      },
      "action": {
        "type": "spotlight",
        "title": "Action Heading",
        "content": "Click here to continue.",
        "placement": "bottom"
      },
      "validation": {
        "type": "click"
      }
    }
  ]
}
```

### 7.2 Target Selectors & Matching Strategies

GuideMe uses fallback target resolution to ensure element detection even on dynamic web applications:

| Property    | Type     | Description                                                                          |
| :---------- | :------- | :----------------------------------------------------------------------------------- |
| `css`       | `string` | Primary CSS selectors (comma-separated). E.g., `#submit-btn, button[type="submit"]`. |
| `text`      | `string` | Matches elements containing exact or partial text content. E.g., `"Share"`.          |
| `ariaLabel` | `string` | Matches elements with matching `aria-label` or `aria-description`.                   |
| `testId`    | `string` | Matches `data-testid` or `data-test-id` attributes.                                  |

### 7.3 Validation Types

The `validation.type` field determines how GuideMe knows when a step is completed:

- `"click"`: Automatically advances when the user clicks the highlighted target element.
- `"input"`: Automatically advances when the user types text into the highlighted input field.
- `"manual_next"`: Advances when the user clicks the "Next" button in the GuideMe tooltip/modal overlay.
- `"url_change"`: Advances when the tab URL changes or matches a target pattern.

---

### 7.4 Sample Tutorial JSON

Below is a complete, working example tutorial definition (`tutorials/general/welcome-tour.json`):

```json
{
  "id": "guideme-welcome-tour",
  "version": "1.0.0",
  "name": "GuideMe Feature Walkthrough",
  "description": "An interactive tour highlighting toolbars, action buttons, and input validation.",
  "matchUrls": ["<all_urls>", "*://*/*"],
  "steps": [
    {
      "id": "welcome_step_1",
      "title": "Welcome to GuideMe",
      "description": "GuideMe provides interactive, non-intrusive step-by-step guidance overlays on any web app.",
      "action": {
        "type": "modal",
        "title": "Welcome to GuideMe",
        "content": "Let's explore how interactive spotlights, input validation, and automatic step advancement work!"
      },
      "validation": {
        "type": "manual_next"
      }
    },
    {
      "id": "welcome_step_2",
      "title": "Interactive Spotlight",
      "description": "GuideMe highlights elements with smooth SVG masks without blocking your clicks.",
      "target": {
        "css": "#demo-action-btn, button, #docs-share-button",
        "text": "Try Action"
      },
      "action": {
        "type": "spotlight",
        "title": "Click Target",
        "content": "Click this button to see GuideMe detect your interaction in real time!",
        "placement": "bottom"
      },
      "validation": {
        "type": "click"
      }
    },
    {
      "id": "welcome_step_3",
      "title": "Dynamic Input Validation",
      "description": "Steps can validate typing and ensure users enter required details.",
      "target": {
        "css": "#demo-text-input, input[type='text'], input[type='email'], input",
        "testId": "demo-input"
      },
      "action": {
        "type": "spotlight",
        "title": "Type Something",
        "content": "Type any message in this input box to advance.",
        "placement": "bottom"
      },
      "validation": {
        "type": "input"
      }
    },
    {
      "id": "welcome_step_4",
      "title": "You're All Set!",
      "description": "You've experienced how GuideMe works. Build custom guides or follow app tutorials anytime.",
      "action": {
        "type": "modal",
        "title": "Tour Complete",
        "content": "Explore Google Docs or create custom JSON guides for any SaaS platform!"
      },
      "validation": {
        "type": "manual_next"
      }
    }
  ]
}
```

---

## 8. Troubleshooting & FAQ

#### Q1: Why does the popup say "Standby" or fail to start on `chrome://` pages?

> **Answer**: Browser security restrictions prevent Chrome extension content scripts from running on internal pages such as `chrome://extensions` or `about:blank`. Test GuideMe on regular web pages (e.g. `https://google.com`), Google Docs, or the built-in testbed page (`test-demo.html`).

#### Q2: How do I rebuild after modifying extension code?

> **Answer**: Run `pnpm build` (or `npm run build`), then go to `chrome://extensions` and click the **Reload** icon on the GuideMe extension card. If running `pnpm dev`, changes automatically hot-reload.

#### Q3: How do unit tests run?

> **Answer**: Run `pnpm test` (or `npm test`). Node's built-in test runner executes `tests/engine.test.js` and `tests/dynamic-analyzer.test.js`.

#### Q4: Windows PC Troubleshooting Guide

> **Issue 1: PowerShell script execution error (`PSSecurityException`)**
>
> - **Cause**: Windows PowerShell blocks running scripts like `pnpm.ps1` or `npx.ps1` by default.
> - **Fix**: Open PowerShell as Administrator and run:
>   `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
>   Or run your commands inside **Command Prompt (cmd.exe)** or **Git Bash**.

> **Issue 2: PNPM Symlink / Permission Error (`EPERM: operation not permitted, symlink`)**
>
> - **Cause**: PNPM workspaces use symbolic links, which require Developer Mode or Admin rights on Windows.
> - **Fix**: Enable **Developer Mode** in Windows (`Settings > Update & Security > For developers` -> toggle **Developer Mode** ON). Alternatively, run `npx pnpm install` in an Administrator terminal.

> **Issue 3: Unix shell scripts or `rm -rf` error**
>
> - **Cause**: Commands like `curl ... | sh` or `rm -rf` are Linux/macOS commands and do not exist in Windows CMD.
> - **Fix**: We updated `package.json` to use cross-platform Node.js commands (`npm run clean`). For PNPM installation on Windows PowerShell, use:
>   `iwr https://get.pnpm.io/install.ps1 -useb | iex`
>   Or simply use `npx pnpm <command>` or `npm install -g pnpm`.

> **Issue 4: Loading extension path in Windows Chrome**
>
> - **Fix**: In Chrome (`chrome://extensions`), turn on **Developer Mode**, click **Load unpacked**, and select `apps\chrome-extension\.output\chrome-mv3`.

---

_GuideMe: Universal Tutorial Engine Docs_
