# GuideMe: Universal Tutorial Engine

> Interactive step-by-step guidance overlays, SVG spotlights, and dynamic DOM auto-guidance for web applications.

---

## 🚀 Quick Setup

Dependencies are already installed in your workspace! You can run commands directly using `npx pnpm`.

### If `pnpm` is not installed on your system:
You can either use `npx pnpm` directly:
```bash
npx pnpm dev       # Start development server
npx pnpm build     # Build Chrome extension bundle
npx pnpm test      # Run unit tests
```

Or install standalone `pnpm`:
- **Windows (PowerShell)**:
  ```powershell
  iwr https://get.pnpm.io/install.ps1 -useb | iex
  ```
- **macOS / Linux**:
  ```bash
  curl -fsSL https://get.pnpm.io/install.sh | sh -
  ```

### 1. Build Extension
```bash
npx pnpm build
# or
pnpm build
```

### 2. Load into Browser
1. Open Google Chrome or any Chromium browser and navigate to `chrome://extensions`.
2. Toggle **Developer mode** ON (top-right corner).
3. Click **Load unpacked** and select:
   `apps/chrome-extension/.output/chrome-mv3`

---

## 📖 Complete Documentation & Usage Guide

For complete details on monorepo architecture, curated walkthroughs, Dynamic Auto-Guide (`DynamicPageAnalyzer`), custom tutorial JSON schema specifications, target matching strategies, and troubleshooting, please read:

👉 **[Complete Setup & Usage Guide](docs/SETUP_AND_USAGE_GUIDE.md)**

---

## 💻 Available Scripts

- **`npx pnpm dev`**: Start WXT hot-reloading dev server
- **`npx pnpm build`**: Build production Chrome Manifest V3 extension
- **`npx pnpm test`**: Run engine and dynamic analyzer unit test suite
- **`npx pnpm clean`**: Clean build outputs and cached packages

---

## 🛡️ Implementation & QA Guidelines

For every implementation, feature addition, or UI change:
1. **Dark Mode & Light (White) Mode**: Verify visual contrast, surfaces, borders, and theme toggle responsiveness in both modes.
2. **Khmer (`km`) & English (`en`) Support**: Never hardcode English strings. Centralize all UI text in `ui-strings.js` or bilingual `{ km, en }` definitions and verify live switching.
3. **Build & Test**: Ensure `pnpm test` (14/14 tests) and `pnpm build` pass with zero errors.

---

## 📄 Documentation Links
- [Core Components & Lifecycle](docs/CORE_COMPONENTS_AND_LIFECYCLE.md)
- [Setup & Usage Guide](docs/SETUP_AND_USAGE_GUIDE.md)
- [Usability Testing Guide](docs/USABILITY_TESTING_GUIDE.md)
- [Architecture Specification](docs/ARCHITECTURE_SPECIFICATION.md)
- [Requirements](docs/REQUIREMENTS.md)
- [New Requirements](docs/New_Requirements.md)
