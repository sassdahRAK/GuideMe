# GuideMe Compatibility Matrix

GuideMe resolves every guide step's target through a single tiered function,
`resolveTarget()` (`packages/chrome-adapter/src/targeting/resolve-target.js`),
exposed publicly as `GuideMe.anchor(target, callback)` and, for canvas
integrations, `GuideMe.registerCanvasMap(...)`. Every step reports which tier
resolved it (see `docs/../packages/reporting`), so coverage gaps are visible
rather than silently degraded.

## Tiers

| Tier | Coverage | Mechanism | Requires site-specific config? |
| --- | --- | --- | --- |
| **1 — Full** | Standard DOM, SVG, same-origin iframes | Native DOM APIs (`DomObserver`), with per-frame offset walking up to `window.top` | No |
| **2 — Container** | `<canvas>` elements with no registered coordinate map; cross-origin iframes with no cooperative script | Bounding box of the `<canvas>`/`<iframe>` tag itself | No |
| **3 — Integrated** | `<canvas>` apps with a registered, version-matched coordinate map | `GuideMe.registerCanvasMap(canvasSelector, { version, regions, detectVersion })` + scale-corrected region lookup | **Yes** — a map must be registered per app |
| **4 — Platform-native** | Structural-API canvas-as-screen apps (Google Docs/Sheets-style) | Structural API + logical-position anchoring | Stub only — not implemented in this pass (`resolvePlatformNative()` always returns "not implemented") |
| **Fallback** | Anything unresolvable | Nearest known container's bounding box + a directional/textual hint, rendered in the existing tooltip | No |

Every tier above **always returns a real rect** (never a bare `null`) once a
step has a target at all, so the spotlight and tooltip always render
*something* — worst case is the fallback tier's textual hint layered onto the
page's own body/documentElement box.

## Cross-origin iframes

A cross-origin iframe cannot be read directly (`iframe.contentDocument`
throws or returns `null`). GuideMe's cooperative protocol
(`packages/chrome-adapter/src/targeting/cross-origin-protocol.js` +
`apps/chrome-extension/public/guideme-embed.js`) lets a third-party site opt
in:

1. The parent page posts `{ type: 'guideme:locate', requestId, selector }` into the iframe.
2. If the iframe has `guideme-embed.js` loaded, it resolves the selector locally and replies with `{ type: 'guideme:location', requestId, rect }`.
3. If nothing replies within ~300ms, GuideMe falls back to Tier 2 (the iframe's own bounding box) and logs an `unsupported-cooperative-iframe` reporting event.

`guideme-embed.js` is intentionally read-only and dependency-free — it never
clicks, focuses, or modifies the embedding page.

## Worked example: a canvas-based video/design editor (e.g. CapCut-style web apps)

This pass ships the **universal engine only** — Tiers 1–3, the generic
`registerCanvasMap()` API, the cross-origin protocol, and reporting. It does
**not** ship a hand-built, site-specific coordinate map for any one product
(no live inspection of a specific third-party app's DOM was performed for
this pass). The table below is a worked example of what tier the *generic*
pipeline reaches on a typical canvas-heavy editor, with no site-specific code
at all:

| Area of the app | What it typically is | Tier reached (generic engine, zero config) |
| --- | --- | --- |
| Top toolbar, sidebars, "Import"/"Export" buttons, modal dialogs | Real DOM/React nodes | **Tier 1** — `DomObserver`'s existing `aria-label`/`data-testid`/text-content matching already handles most app chrome without any app-specific selector list |
| Timeline scrubber, playhead, track rows, preview canvas | `<canvas>`-rendered, not DOM-inspectable | **Tier 2** — the canvas's own bounding box is highlighted automatically; the tooltip adds a directional hint (e.g. "look inside the highlighted area") since no exact sub-region is known |
| A specific timeline control (e.g. "split at playhead") | `<canvas>`-rendered, sub-region of the canvas | **Tier 3, if and only if** someone registers a coordinate map for that app via `GuideMe.registerCanvasMap()`. Not done in this pass. |

### Adding a real Tier-3 map for a specific app (future work)

1. Inspect the live app's DOM to confirm the canvas selector and find a
   stable version/build marker (a meta tag, a global JS variable, or a
   build-hash script `src`).
2. Call `GuideMe.registerCanvasMap(canvasSelector, { version, regions, detectVersion })` with canvas-local pixel coordinates for each region.
3. Reference the region from a step's target via `{ css: canvasSelector, region: '<region id>' }`.
4. If the app ships a new build and `detectVersion()` no longer matches the registered `version`, GuideMe automatically falls back to Tier 2 (never guesses at stale coordinates) and reports the mismatch via `target_resolved`'s `versionMismatch` field.

## Reporting

Every step resolution — success or failure — produces a reporting event
(`packages/reporting`). See `target_resolved` (includes `tier`, `source`, and
`isFallback`) and `target_resolution_failed`. No raw page content, selector
string values, or user-entered text are ever logged — only selector
*strategy kinds* (`css`/`testId`/`ariaLabel`/`text`/`xpath`/`canvasRegion`/`iframe`), tiers, step ids, and page origin+path.
