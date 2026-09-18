# Chrome Web Store Submission — Ready-to-Paste Content

Packaged zip is built and ready at:
`apps/chrome-extension/.output/guidemechrome-extension-1.0.0-chrome.zip`

Rebuild it any time with `npm run zip --prefix apps/chrome-extension`.

Everything below is drafted so you can copy-paste it directly into the
Developer Dashboard forms. The parts that require your Google account
(paying the $5 registration fee, uploading the zip, filling in the forms,
and clicking Publish) can't be done by anyone but you — this doc exists so
that when you get there, it's copy-paste, not blank-page writing.

---

## 0. Screenshots (ready to attach)

Captured from the real running extension against the bundled demo page,
with the correct purple brand color (an earlier batch briefly showed amber —
that was the demo page's own hesitation-state styling being caught mid-nudge,
already fixed; these are the correct ones):

1. Spotlight walkthrough, step 1 of 4 ("Open Sharing Settings"):
   `C:\Users\TUF\AppData\Local\Temp\claude-chrome-screenshots-do2Gh2\screenshot-1789721478395-11.jpg`
2. Spotlight walkthrough, step 2 of 4 ("Add Collaborators"):
   `C:\Users\TUF\AppData\Local\Temp\claude-chrome-screenshots-do2Gh2\screenshot-1789721489770-12.jpg`
3. AI chat widget, clean shot (Khmer):
   `C:\Users\TUF\AppData\Local\Temp\claude-chrome-screenshots-do2Gh2\screenshot-1789720423360-3.jpg`

Chrome allows up to 5 — these three cover the core feature set well. Note:
these are saved to a temp folder, so copy them somewhere permanent before
that gets cleared.

---

## 1. Store listing

**Extension name** (from manifest, do not change without also changing
`wxt.config.ts`):
```
GuideMe: Universal Tutorial Engine
```

**Short description** (≤132 characters — this one is 127):
```
AI-guided, step-by-step walkthroughs on any website — bilingual Khmer/English voice narration with live on-screen spotlights.
```

**Detailed description:**
```
GuideMe turns any website into a guided, step-by-step walkthrough — no setup, no site-specific plugin required.

Tell GuideMe what you're trying to do, in plain Khmer or English (e.g. "share this document with edit access" or "create a new spreadsheet"), and it inspects the page you're actually on, grounds each step in the real elements it finds, and walks you through it with a spotlight, a tooltip, and — optionally — spoken narration.

KEY FEATURES
• AI-generated walkthroughs from a plain-language request — works on Google Docs, Sheets, Slides, e-commerce sites, government portals, and general web apps alike, not just pre-built tutorials.
• Bilingual, Khmer-first — every step, tooltip, and voice prompt is available in Khmer and English.
• Voice narration (text-to-speech) reads each step aloud so users who struggle with on-screen text still get full guidance.
• Live on-screen spotlight overlay and tooltip — highlights exactly which button, field, or menu to interact with next.
• A dashboard to track guide history, progress, and community-shared walkthroughs, synced between the extension and your GuideMe account.
• Works entirely on top of the page you're already on — no separate app window, no screen sharing, no remote control.

GuideMe is built for people who are new to a piece of software (or to computers in general) and need patient, precise, step-by-step help — right where they're already working, in the language they're most comfortable with.

Privacy Policy: https://guideme-lac.vercel.app/privacy
Terms of Service: https://guideme-lac.vercel.app/terms
```

**Category:** Productivity (or Accessibility, if that category is offered/appropriate for your listing — Productivity is the safer default)

**Language:** Khmer (primary), English

---

## 2. Single purpose description

Chrome requires one clear sentence stating what the extension does — this
is what reviewers check every requested permission against.

```
GuideMe's single purpose is to overlay AI-generated, step-by-step interactive walkthroughs — spotlights, tooltips, and optional voice narration — directly on top of the webpage the user is currently trying to complete a task on.
```

---

## 3. Permission justifications

Paste one of these into the corresponding field for each permission the
dashboard flags. `<all_urls>` will get the most scrutiny — lead with it.

**Host permission (`<all_urls>`):**
```
GuideMe generates and displays step-by-step guidance overlays on whatever website the user is actively trying to complete a task on — this could be Google Workspace, an e-commerce checkout, a government portal, or any internal business app. Because the set of sites a user might request help on is unbounded and chosen by the user at runtime (via a plain-language prompt), GuideMe cannot function with a fixed, pre-declared list of sites. Host access is only ever used to read the page's DOM and render the overlay in direct response to a walkthrough the user explicitly requested.
```

**`scripting`:**
```
Used to inject the content script that renders the spotlight/tooltip overlay and reads the current page's interactive elements (buttons, inputs, menus, links) so the AI backend can generate a walkthrough grounded in what's actually on the page. This only runs in direct response to the user requesting a guide.
```

**`tabs`:**
```
Used to read the active tab's URL so a walkthrough can be matched or resumed on the correct page, and to open the account login page in a new tab when the user chooses to sign in.
```

**`storage`:**
```
Used to store the user's language, theme, and voice preferences, in-progress chat/guide drafts, tutorial progress, and auth token locally, so state persists across browser sessions.
```

---

## 4. Privacy practices disclosure

The dashboard's Privacy Practices tab will ask you to check which data
categories the extension handles. Based on the actual code (real backend
auth, AI prompt processing, DOM read for targeting):

| Category | Collected? | Why |
|---|---|---|
| Personally identifiable information (name, email) | Yes | Account creation / login |
| Authentication information (password hash, OAuth token) | Yes | Account login (email/password + Google OAuth) |
| Website content (page text/DOM) | Yes | Read locally to generate and target walkthrough steps — sent to the AI backend only when the user actively requests a guide |
| User activity (guide progress, completed steps) | Yes | Track walkthrough progress and dashboard stats |
| Location, financial info, health info | No | Not collected |

You'll also need to certify the standard declarations:
- Data is **not sold** to third parties.
- Data is **not used** for purposes unrelated to GuideMe's single purpose.
- Data is **not used** to determine creditworthiness or for lending.

Based on what's actually implemented, all three should be true — the
backend only uses data for account/auth, AI walkthrough generation, and
progress tracking, and the "Coming Soon" payment/billing UI has no real
checkout flow wired up (see `packages/tutorial-ui/src/components/DashboardOverlay.jsx`),
so there's no financial data path to worry about.

**Privacy Policy URL:**
```
https://guideme-lac.vercel.app/privacy
```

---

## 5. What's still on you

- Pay the **$5 one-time developer registration fee** (if not already paid) at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
- **Upload** `guidemechrome-extension-1.0.0-chrome.zip`.
- **Screenshots** (1280×800 or 640×400, at least one required, up to 5): these need to show the actual product running, which means loading the unpacked build (`apps/chrome-extension/.output/chrome-mv3`) in a real Chrome window and capturing it — good candidates are: a spotlight overlay mid-walkthrough, the chat widget, and the dashboard. Say the word if you want help capturing these via browser automation once you have a page to demo against.
- **Promo tile images**, if you want them (optional, improves listing appeal).
- Paste in the copy from sections 1–4 above.
- Click **Submit for review**. Expect a longer-than-average review queue because of the `<all_urls>` host permission — this is normal for this category of extension, not a sign of a problem.
