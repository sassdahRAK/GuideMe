# GuideMe — User Simulation & Evaluation Harness

**ISOLATED test environment — no production files are ever modified.**

## Directory Structure

```
tests/user-simulation/
├── runner.js           # Main orchestrator (start site → launch browser → run tasks → save results)
├── .env.test           # Test-only env vars (never overwrites production .env)
├── package.json        # Isolated dependencies (playwright only)
├── config/
│   └── settings.js     # All config resolves from .env.test
├── simulator/
│   └── user-simulator.js  # Khmer low-digital-literacy user simulator
├── scenarios/
│   └── smoke-tasks.js  # 5 smoke test tasks (Khmer prompts)
├── evaluator/
│   └── evaluate.js     # Metrics calculator (7 official metrics)
├── fixtures/
│   ├── index.html      # Test website — Home
│   ├── profile.html    # Test website — Profile (name, email, avatar)
│   ├── settings.html   # Test website — Settings (password, language, notifications)
│   ├── upload.html     # Test website — Upload files
│   ├── help.html       # Test website — Help & FAQ
│   ├── style.css       # Test website styles
│   ├── app.js          # Test website JS (form handling)
│   └── serve.js        # Static file server (port 7777, no external deps)
└── results/
    ├── raw/            # Per-task JSON result files (generated at runtime)
    ├── screenshots/    # Per-task screenshots (generated at runtime)
    ├── failures/       # Failure artifacts — screenshot, trace, guidance, error
    └── evaluation-report.json  # Final metrics report
```

## Safety Guarantees

| Rule | Status |
|------|--------|
| Production files modified | **NEVER** |
| Production database used | **NEVER** |
| Production `.env` read | **NEVER** — uses `.env.test` only |
| Existing `npm test` (177 unit tests) | **Unaffected** |
| GuideMe extension modified | **NEVER** — loaded read-only as unpacked build |

## Quick Start

```bash
# 1. Install Playwright (from tests/user-simulation/)
cd tests/user-simulation
npm install

# 2. Install Playwright browsers
npx playwright install chromium

# 3. Run 5-task smoke test (from GuideMe root)
npm run test:user-simulation:smoke

# 4. Show the browser (headed mode)
npm run test:user-simulation:headed

# 5. Calculate metrics
npm run test:user-simulation:evaluate
```

## Test Tasks (Smoke — 5 tasks)

| ID | Khmer Prompt | Type |
|----|-------------|------|
| task_001 | ខ្ញុំចង់ប្ដូរ password តែអត់ដឹងទៅណា | form-fill-multi-step |
| task_002 | ចង់ប្ដូរឈ្មោះខ្ញុំក្នុងនេះ | form-fill-single |
| task_003 | ខ្ញុំចង់ upload ឯកសារ តែអត់ដឹងចុចត្រង់ណា | navigation-and-click |
| task_004 | ចង់ save តើចុចមួយណា? | single-click |
| task_005 | ខ្ញុំចង់ប្ដូររូប profile | single-click |

## Metrics

- Task Support Rate
- Task Completion Rate
- Guidance Accuracy
- Guidance Understandability
- User Error Rate
- Recovery Rate
- Completion Time (avg / median / min / max)
