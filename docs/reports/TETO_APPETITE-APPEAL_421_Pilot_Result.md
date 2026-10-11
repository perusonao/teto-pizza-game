# Issue #421 — Mozzarella melt Pilot: Final Verification Report

- Status: **implemented and verified (Chromium + real WebKit CI). No PR, not merged, not deployed. Owner iPhone HV is still required.**
- Branch: `claude/issue-421-mozzarella-melt-pilot` (code last changed in `8f8b969`; later commits are docs / images only), on `main` `8cb5d72`.
- Design baseline: `TETO_APPETITE-APPEAL_421_Fresh-Audit-Design.md` (same directory).

## 1. Branch comparison (Owner decision: B is the baseline)

A = `claude/issue-421-finished-pizza-appeal` (`35243f1`), B = this branch.

| Topic | A | B (kept) | Decision |
| --- | --- | --- | --- |
| Scope | mozzarella shape + **sauce tint + crust puff** | mozzarella only (Owner decision) | B. A's sauce / crust overlays are out of the Pilot; they stay on A as a reference for a later follow-up. |
| Cheese melt | `::before` spread skirt (`z-index:-1`) + `::after` spots, opacity-driven | border-radius morph, fading ring, 5 `box-shadow` lobes, non-uniform scale, `radial-gradient` spots; **no pseudo-elements, no new DOM** | B. |
| Doneness inputs | `smooth01(meltIntensity)` etc. | `meltIntensity` / `toastIntensity` / `charIntensity` directly (`cheeseMeltLook`, pinned by a test) | B (Owner: reuse the existing scalars). |
| Spots when charred | fade out (`brown * (1 - 0.6*char)`) | turn dark brown (Owner requirement) | B. |
| Extra DOM | +2 overlay divs per stage body | none | B (avoids DOM-golden churn and per-piece multiplication in CUT). |
| `mix-blend-mode: multiply` (sauce) | yes | none | B (WebKit / Android risk avoided). |
| Opt-in for other cheeses | `MELT_SHAPE_CHEESE_IDS` + class | CSS keyed to `.pizza-cheese--mozzarella`, variables set on all cheeses | **Imported from A:** `MELT_SHAPE_CHEESE_IDS` / `cheeseMeltsShape`, variables only on opted-in cheeses, plus A's "non-pilot cheese keeps its look" test. |
| Tests / evidence | 9 unit tests; no CUT/RESULT image, no e2e, no WebKit | unit + e2e (CUT, RESULT, layout) + before/after images + WebKit | B. |
| A's risk notes | blend mode, crust overlay off the dough silhouette, DOM goldens, egg-yolk-like spots | n/a to B (no overlays / blend / extra DOM); spots were reshaped into soft ellipses | recorded, not carried. |

Nothing was implemented twice: the parallel branch's only reusable ideas (opt-in set and its test) were folded into B.

## 2. What the Pilot does (Owner decisions 1-7)

- Mozzarella only (`MELT_SHAPE_CHEESE_IDS`); every other cheese and topping keeps today's look and receives none of the variables.
- Melted look: lopsided softer outline, the crisp white ring dissolves, lumpy cream spread, gloss, wider and a little flatter (non-uniform scale), uneven soft browning blotches: golden when toasted, **dark brown** when charred (never grey).
- Driven by the existing `heat` scalars only; no new state. `cheeseMeltCssVars` resolves them to finished `rgba()` strings.
- No SVG filter, no `clip-path`, nothing added to `.pizza-pieces` or its ancestors (#467 untouched). Scoring, save, economy and CUT are unchanged.
- Raw look is unchanged wherever PizzaStage does not set the variables (tray, Reference, thumbnails, PREPARE, other cheeses): every CSS custom property has the raw value as its fallback; the raw rows of the images are identical before / after.

## 3. `rgba(calc(...))` compatibility (verification item 2)

The first version computed browning colours in CSS (`rgba(calc(200 - 120 * var(--char)), ...)`). CSS math inside a colour function is not safe on every engine; an engine that rejects it drops the **whole** `background` declaration. Changed, not just tested: colours are now resolved in TypeScript (`cheeseMeltCssVars`) and the stylesheet only reads `var(--bake-cheese-*, <raw value>)`. The only remaining `calc()` is on lengths, percentages and `scale()` with a unitless number, which every engine supports. A unit test asserts no value contains `calc` and every colour matches `rgba(r, g, b, a)`.

## 4. Evidence

Images (before = `main` `8cb5d72`, after = this branch; same spec, real Chromium, DPR 3; the needle position of each stage is read back and recorded in `needle-positions-*.json`, before and after match within about 1 point, i.e. each pair is at the same heat):

- `docs/reports/screenshots/finished-pizza-appeal-421/compare-cheese-closeup-390x844.png`, `...-360x800.png`: raw / melting (needle ~55) / properly baked (~70) / deep (~80) / overbaked (~98).
- `.../compare-cut-result-390x844.png`, `...-360x800.png`: CUT (6 pieces) and RESULT page.

Observed: raw identical; melting loses the ring and spreads; baked is a soft glossy spread with light golden blotches; deep has clear golden-brown blotches; overbaked keeps the spread with **dark brown** blotches on the pre-existing grey-beige cheese tint. CUT pieces and RESULT carry the same baked cheese. No horizontal overflow at 390x844 or 360x800.

## 5. Verification

| Check | Result |
| --- | --- |
| `tsc -b` | pass |
| `oxlint` on touched files | no findings |
| Full vitest (final code) | 380 files, **6996 passed**, 1 skipped |
| New unit tests | `cheeseMeltLook` (equals the 3 existing intensities, raw = zeros, monotonic, in [0,1]); `cheeseMeltCssVars` (no CSS math, raw look at heat 0, ring dissolves, charred spot is brown: R > G > B by clear margins, monotonic darkening); `cheeseMeltsShape` (only mozzarella); PizzaStage (variables only in BAKE..RESULT, only on mozzarella, none on gorgonzola or other toppings) |
| New e2e `mozzarella-melt-421.spec.ts`, Chromium 390x844 + 360x800 | 4 passed (needle position verified per stage; outline / shadow / transform differ from raw and the scale is anisotropic; **rendered pixels of the charred spots are brown (R > G > B), not grey**; CUT and RESULT keep the melt; no overflow). |
| Related existing e2e (finished-pizza-visual-2.0, pizza-cutting-phase4b, cut-skip-failed-bake, result-1screen-2.0, cut-regions-427) + the new spec, Chromium, both viewports | 49 passed, 1 skipped (the skipped test was not investigated) |
| **WebKit** (existing workflow `E2E WebKit`, `workflow_dispatch`, full e2e at 390x844 and 360x800, 2 shards each) | **PASS** (run #726, `8f8b969`, all jobs success: 4 shards, WebKit Gate, Layout Contract Gate; 0 failed). See "WebKit results" below. |

### WebKit results (branch B only)

Run #726 = existing workflow `E2E WebKit`, `workflow_dispatch`, branch `claude/issue-421-mozzarella-melt-pilot`, target `8f8b969` (not re-run).

| Job | Result | passed | skipped | failed |
| --- | --- | ---: | ---: | ---: |
| webkit-360x800 shard 1/2 | success | 126 | 49 | 0 |
| webkit-360x800 shard 2/2 | success | 163 | 12 | 0 |
| webkit-390x844 shard 1/2 | success | 141 | 34 | 0 |
| webkit-390x844 shard 2/2 | success | 170 | 5 | 0 |
| layout-chromium / Layout Contract Gate / **WebKit Gate** | success | | | |

Per viewport: 360x800 = 289 passed, 61 skipped; 390x844 = 311 passed, 39 skipped; no failure. Both new tests (`mozzarella-melt-421.spec.ts`: the raw-to-overbaked stages incl. the rendered-pixel brown check, and CUT/RESULT with layout) passed in WebKit at both viewports. The skipped tests were **not itemised** here; WebKit Gate, which only accepts intentional skips and checks that every listed test ran exactly once, passed.

Earlier runs on this branch (kept for the record): #724 (`eddc6d2`) FAIL, 1 of 163 in `webkit-360x800` shard 2: my new CUT/RESULT test hit `page.screenshot: Test timeout of 30000ms exceeded` (39 s), a timeout from capturing at DPR 3 in WebKit, not a rendering assertion; #725 (`bff224a`) cancelled (superseded). Fix = `8f8b969` (spec timeout 120 s, lighter attachments).

`8f8b969` -> branch tip `a4be4da`: **docs and images only** (8 files under `docs/reports/screenshots/finished-pizza-appeal-421/`; `git diff --name-only 8f8b969 a4be4da | grep -v '^docs/'` is empty), so run #726 covers the code at the tip.

### Branch A runs (reference only; not evidence for B)

Branch A `claude/issue-421-finished-pizza-appeal` is kept for comparison and receives no further work. Its runs: #723 (`59c0a21`) FAIL; #727 (`0bf7cb3`) in progress when this report was written. Neither is counted in B's verification.

### WebKit screenshots: NOT VIEWED (unverified)

The new spec attaches close-ups of the mozzarella (bake stages, CUT, RESULT) to the Playwright report, uploaded as the artifacts `playwright-webkit-report-webkit-{390x844,360x800}-shard{1,2}`. The GitHub API returns a signed download URL, but the blob host answers **HTTP 403 through this environment's network proxy**, so the images could not be downloaded and were not looked at; the proxy was not bypassed. WebKit therefore has geometry / pixel / layout *assertions* passing (outline and transform differ from raw, anisotropic scale, charred spots brown R > G > B as painted, CUT and RESULT keep the melt, no horizontal overflow) but **no human-viewed WebKit image**. The committed comparison images are Chromium. Owner iPhone HV is the first real Safari look.

## 6. Conflict check (PR #466, head `3e22563`)

- Textual: `git merge-tree` of this branch with #466's head: clean, no conflicts (`App.css` auto-merges: #466's three hunks near L1489 / L1606 / L1640, this change near L781).
- Semantic: this branch merged into #466's head in a scratch worktree: `tsc -b` clean and the related **232 unit tests passed** (bakeVisual, PizzaStage*, BakeOverlay, bakeProgress, App.test; 11 files). The new e2e also passed on that merged tree (it steps the needle in a closed loop, so it holds for #419's 7 s one-way gauge).
- The Preview was not touched; #466's 7 s Preview is still the published build.
- Other open PRs: #321 touches one distant line of `PizzaStage.tsx`; #391 and #105 touch other areas; #34 is a stale branch that edits `.pizza-cheese--mozzarella` and would conflict regardless (close or rebase it).

## 7. Remaining risks

1. **Owner iPhone HV is required** (390x844 video, judgement of "looks tasty"). Chromium and CI WebKit are not real iPhone Safari.
2. **WebKit screenshots were not viewed** (artifact download blocked, §5); only the assertions ran in WebKit.
3. **Older in-app WebViews (LINE etc.)** are not verified (#467 is parked). The risky construct (`rgba(calc())`) was removed; `var()` with a fallback inside `radial-gradient` / `box-shadow` is standard.
4. **Paint cost**: 5 extra shadows per mozzarella piece, repeated for each cut piece copy; not measured on a mid-range device.
5. **Spread vs neighbours**: the melted cheese is wider; mozzarella pieces placed very close together, or next to basil, can touch or overlap.
6. **Overbaked cheese body is grey-beige** (pre-existing cheese filter); only the spots were changed to dark brown, as decided.
7. The Preview holds one build and #466 is awaiting HV; nothing was deployed.
