# Cooking UI 1-Screen 2.0 — PR-A: Real-device Layout — Result Report

Issue: [#167](https://github.com/perusonao/teto-pizza-game/issues/167)
Phase 0: [PR #168](https://github.com/perusonao/teto-pizza-game/pull/168), merged
`3144b4a4cedff83d844c043316c24583f4b40363`, see
`docs/reports/TETO_COOKING-UI_1SCREEN-2.0_Phase0_Fresh-Audit.md`.
Base `main` SHA: `3144b4a4cedff83d844c043316c24583f4b40363` (Duplicate Gate #1 confirmed this was
also fresh `origin/main` HEAD at implementation start).
Implementation HEAD: see PR — branch `claude/cooking-ui-1screen-pr-a`.
Design Reference: `docs/design/references/cooking-ui-1screen-2.0-target.png` (structural layout
intent only — not reproduced pixel-for-pixel; see Phase 0 report's own Design Reference section
for the priority order this PR followed: Acceptance Criteria > real-device Human Verification >
current game spec > Design Reference).

## 1. Root causes addressed

### 1.1 6-step tab strip (Issue #167 §4 / Phase 0 §3)

**Root cause found in Phase 0:** the BAKE indicator was the only tab with `flex: 0 0 auto; width:
40px` — a fixed, non-shrinking box among 5 otherwise-shrinkable (`flex: 1 1 0; min-width: 0`) tabs.
A real Safari font/emoji-metric delta on that one item had nowhere to go.

**Fix (`src/App.css`):** `.making-step-tab--bake` now uses `flex: 0.7 1 0; min-width: 0` — the same
shrinkable pool as the other 5 tabs (still visually narrower via a smaller `flex-grow`, not a hard
px floor). Any per-item real-device width variance is now absorbed by proportional shrinking across
all 6 items instead of concentrating on one item that could not give at all.

**Correction to the Phase 0 report's own framing, found during this implementation:** re-measuring
with real `getBoundingClientRect()` values showed the tab row's own right-edge margin is
*structurally* just this container's own right `padding` value — because every tab is `flex: _ 1
0`, the row always renders at exactly the container's inner width by flex layout definition, so a
wider font can only ellipsize a tab's own label, never push the row past the container. Reducing
padding to "buy width" was therefore backwards (it directly shrinks the edge margin); the actual
fix was making the BAKE indicator shrinkable, and padding was tuned back up to a **deliberate 10px**
edge clearance (`padding: 4px 10px 0`, was `12px`) for visual/touch comfort, not as an
overflow-prevention mechanism (that risk is now handled structurally by the flex pool itself).

**`-webkit-text-size-adjust: 100%`** added to `html` (`src/index.css`) — disables iOS Safari's own
automatic font-boosting heuristic (no equivalent in Chromium, so Playwright can never see its
effect), per Phase 0 §3.3/§5's own recommendation. Does not affect pinch-to-zoom or any
user-initiated accessibility zoom (`index.html`'s `<meta viewport>` is untouched).

**Measured (Chromium, real `getBoundingClientRect()`):** trailing tab's own right-edge margin is a
consistent **10px** at every one of the 6 steps, both 390×844 and 360×800 (see §5 below for the
full table) — comfortably above this PR's own 8px floor, now pinned by
`e2e/making-ui-1screen.spec.ts`'s `assertNavFitsViewport`.

### 1.2 Vertical 1-screen budget (Issue #167 §5 / Phase 0 §4)

**Correction to the Phase 0 report's own framing, found during this implementation:** Phase 0's "the
fixed bottom CTA bar lands at exactly 844.0px, 0px margin" statement conflated two different
things. `.prepare-bake-bar` is `position: fixed; bottom: 0`, so its own bottom edge is *always*
exactly the viewport height by construction — that was never evidence of a tight budget, it is true
whether the layout is comfortable or badly overflowing. The methodologically sound question is
whether `.game-screen`'s actual **in-flow** content (header + tabs + order-card + stage +
ingredient-panel, excluding `position: fixed` elements) fits under the viewport height; this PR
measured that directly as the max `getBoundingClientRect().bottom` among `.game-screen`'s non-fixed
children (`e2e/making-ui-1screen.spec.ts`'s new `assertOneScreen`, see §5 below for numbers). Note
also that `.game-screen`'s own `scrollHeight`/`clientHeight` pair (the original suite's own check)
is spec-clamped to `scrollHeight >= clientHeight`
([CSSOM View](https://drafts.csswg.org/cssom-view/#dom-element-scrollheight)) — it can only report
"overflowed" or "exactly fits", never a positive spare margin, so it could not have been used to
measure slack even if the "0px" framing had been literal.

With the corrected measurement, every step already had real, if uneven, margin before this PR's own
compaction (smallest: BAKE at 360×800, ~55px before this pass). This PR's compaction (below) adds
deliberate headroom on top of that, specifically to protect the *thinner* steps against real-device
variance (font metrics, `env(safe-area-inset-*)`, Safari's dynamic toolbar — Phase 0 §5) that this
Chromium-only measurement cannot itself reproduce, not because Chromium showed an literal crisis.

**Compaction applied (`src/App.css`):**

| Rule | Before | After | Saves |
|---|---|---|---|
| `.ingredient-tray` gap | 8px | 6px | up to 2px/row |
| `.ingredient-chip` min-height | 68px | 64px (still ≫44pt touch target) | up to 4px/row |
| `.order-card` margin-top / padding (vertical) | 4px / 6px | 3px / 5px | ~2px |
| `.pizza-stage` padding (vertical) | 6px | 4px | ~4px |
| `.prepare-bake-bar` padding (vertical) | 10px | 8px (still 54px CTA button untouched) | ~4px |
| `--bake-bar-reserve` | 78px | 74px (kept in sync with the bar's own new height) | ~4px |

Plus: `IngredientTray.tsx`'s per-chip `ドラッグしてのせる` label (§1.4 below) removed entirely,
saving its own line height on every draggable chip.

### 1.3 Safari visual viewport handling (Issue #167 §6 / Phase 0 §5)

No change to the existing `100svh`/`100dvh` fallback pattern (`.app-frame`, `html`/`body`/`#root`)
— it was already correct, using the dynamic viewport unit that tracks Safari's own toolbar
show/hide. What this PR adds:

- `-webkit-text-size-adjust: 100%` (§1.1).
- PizzaStage sizing is now height-aware (§1.5), so `100dvh` shrinking (toolbar shown) has an actual
  shrink path to follow instead of a fixed px cap silently assuming the rest of the layout always
  renders at its Chromium-measured height.
- A **WebKit Playwright project** added to `playwright.config.ts` for this PR's own local
  verification — see §7 for why it could not actually be run in this session's environment, and
  what was verified in its place.

### 1.4 Ingredient UI (Issue #167 §9 / Phase 0 §7)

**"ドラッグしてのせる" removed** from `IngredientTray.tsx`'s per-chip render (only ever shown for
mozzarella/basil, the two physically-draggable ingredients). The drag affordance itself is folded
into `data/hints.ts`'s own margherita `missing.mozzarella`/`missing.basil` lines instead (the only
recipe whose `draggableIngredientIds` list is non-empty today), so a first-time player still learns
"this one drags" without a second on-screen line saying it twice:

- `missing.mozzarella`: `とろっとしたモッツァレラをたっぷりのせよう！` →
  `とろっとしたモッツァレラをドラッグしてたっぷりのせよう！`
- `missing.basil`: `仕上げに香り高いバジルをのせたら完成に近いよ！` →
  `仕上げに香り高いバジルをドラッグしてのせたら完成に近いよ！`

Confirmed live in Video B (see §8) — the CHEESE-step hint reads correctly with the drag mention
folded in.

**`∞` decision — A/B/C comparison, decision deliberately not finalized by this PR alone:**
`IngredientTray.tsx` now has one named, documented variation point:

```ts
type UnlimitedStockDisplay = "symbol" | "hidden" | "label";
const UNLIMITED_STOCK_DISPLAY: UnlimitedStockDisplay = "symbol";
```

- **A. `"symbol"` (shipped this PR)** — today's `∞`, unchanged visual, lowest risk. Screenshot:
  `docs/reports/screenshots/cooking-ui-1screen-2.0-pr-a/unlimited-stock-symbol-shipped.png`.
- **B. `"hidden"`** — renders no badge at all for `UNLIMITED` stock. Implemented and reachable by
  flipping the constant; not screenshotted separately (visually: simply no badge under the chip
  name where `∞` sits today).
- **C. `"label"`** — a short word (`常備`) instead of a symbol, via a new
  `.ingredient-chip__stock--label` CSS rule (`font-size: 8.5px`).

**Rationale for shipping A this round:** Phase 0's own follow-up review correctly separated "is the
underlying Stock Gate information real" (yes, unconditionally — finite `×N` is never touched by
this constant, in any branch) from "is `∞` specifically the right *on-screen* presentation" (left
open). This PR did not find new real-device evidence against `∞`'s own legibility specifically (the
concrete, evidenced problem Phase 0 found was the tab strip's font/emoji metrics, not this 9px
symbol) — so it ships the lowest-risk, no-visual-change option and leaves B/C as real, working,
one-line-flip branches (not deleted after comparison) for a future real-device finding to act on
without re-implementation. This is a UI presentation decision, explicitly not a final Phase-0-level
verdict.

### 1.5 PizzaStage height-aware sizing (Issue #167 §7 / Phase 0 §6)

`.pizza-dough`'s `--compact`/`--roomy` modifiers each gained a third `min()` term:

```css
.pizza-stage--roomy .pizza-dough {
  width: min(92vw, 380px, calc(100dvh - 423px));
  height: min(92vw, 380px, calc(100dvh - 423px));
}
.pizza-stage--compact .pizza-dough {
  width: min(76vw, 290px, calc(100dvh - 439px));
  height: min(76vw, 290px, calc(100dvh - 439px));
}
```

`100dvh` already tracks Safari's own dynamic toolbar (§1.3); the reserve constants (439px compact /
423px roomy) are fixed, documented budgets for "everything in that step that is not the dough"
(CSS cannot read a sibling's live rendered height without JS) calibrated from this PR's own real
measurements plus a deliberate margin — see the CSS comments for the exact derivation. At both
390×844 and 360×800 today, the `vw`/px terms still win (confirmed by measurement, §5 — no visible
size change at either shipped viewport), so this is a **pure safety net**: it only ever engages on a
real device whose available height is smaller than these viewports' own budget (Safari toolbar
shown, a taller real-font line wrap, notch/safe-area, etc.), which is exactly the class of gap
Phase 0's §5/§6 identified this Chromium-only suite as unable to simulate directly.

**Interaction math is unaffected**, confirmed by the full regression suite (§6) and Video B (§8):
`onDoughElementChange`/`resolvePhysicalDrop` and every coordinate helper
(`pizzaCoordinates.ts`/`doughShape.ts`/`sauceField.ts`) already read the dough's own live
`getBoundingClientRect()`, never this CSS formula's literal value — this was already load-bearing
for the pre-existing `--compact`/`--roomy` split (two different literal sizes for the same recipe),
so adding a third, height-derived term to the same `min()` changes only the *number* that pipeline
consumes, not the pipeline.

### 1.6 CUT progress copy (Issue #167 §11)

`GameScreen.tsx`'s `.cut-progress-readout` now reads e.g. `0 / 3 本・あと3本切ろう` while cutting is
incomplete, `0 / 3 本・切り終わったよ！` once the requirement is met — both derived from the exact
same already-existing local consts (`cutRequiredCount`, `state.cutState.lines.length`,
`cutConfirmReady`) the disabled CTA's own `disabled` attribute already used. **No new game state.**
Confirmed live in the CUT screenshot (§4) and both videos.

## 2. Changed files

```
 e2e/making-ui-1screen.spec.ts                                      |  43 +++++++++
 playwright.config.ts                                                |  18 +++++
 src/App.css                                                         | 113 +++++++++++++++++-----
 src/components/IngredientTray.tsx                                   |  31 ++++++-
 src/data/hints.ts                                                   |  10 +-
 src/index.css                                                       |  12 +++
 src/screens/GameScreen.tsx                                          |  10 ++
 docs/reports/screenshots/cooking-ui-1screen-2.0-pr-a/*.png (10 files, new)
 17 files changed, 206 insertions(+), 31 deletions(-)
```

No changes to `.github/workflows/*`, scoring (`src/logic/scoring*`, `scoringV2/**`), economy,
inventory/Stock Gate *semantics* (only the UNLIMITED badge's on-screen presentation, §1.4), Firebase,
ranking, Player Profile, recipe unlock, or CUT scoring (`src/logic/cut/evaluation.ts` untouched,
only read from).

## 3. Tests

| Check | Result |
|---|---|
| Focused/full TypeScript (`tsc -b`) | clean |
| `npm run lint` (oxlint) | clean |
| Full Vitest (`npm test`) | **2088/2088 passed** (112 files) — unchanged from Phase 0 baseline |
| `npm run build` | clean (pre-existing >500kB chunk-size warning, unrelated) |
| Playwright Chromium, both projects (390×844/360×800), full suite | **30/30 passed** |
| Playwright Chromium, `making-ui-1screen.spec.ts` incl. this PR's new `MIN_SAFETY_MARGIN_PX` assertions, both projects, both 390×844 and 361×800 in-test viewports | **10/10 passed** |
| Playwright WebKit | see §7 — genuinely unavailable in this session's environment, not skipped/assumed |

`e2e/making-ui-1screen.spec.ts`'s `assertOneScreen`/`assertNavFitsViewport` were extended with a
`MIN_SAFETY_MARGIN_PX = 8` floor (§1.1/§1.2's own methodology corrections) so a future regression
that quietly eats this PR's own added slack is caught here, not only on a real device again.

## 4. 390×844 measurements (real `getBoundingClientRect()`, Chromium, Margherita)

| Step | Tab right margin | Vertical flow margin |
|---|---:|---:|
| DOUGH | 10px | 365px |
| SAUCE | 10px | 164px |
| CHEESE | 10px | 211px |
| TOPPING | 10px | 207px |
| BAKE | 10px | 64.5px |
| POST_BAKE/CUT | 10px | 306.3px |

## 5. 360×800 measurements

| Step | Tab right margin | Vertical flow margin |
|---|---:|---:|
| DOUGH | 10px | 337.4px |
| SAUCE | 10px | 136.4px |
| CHEESE | 10px | 183.4px |
| TOPPING | 10px | 179.4px |
| BAKE | 10px | 48.1px |
| POST_BAKE/CUT | 10px | 289.9px |

"Vertical flow margin" = `innerHeight - max(getBoundingClientRect().bottom among .game-screen's
non-fixed children)` — see §1.2 for why this, not `scrollHeight`/`clientHeight`, is the correct
metric. BAKE is the tightest step at both viewports (least additional sibling content beyond the
roomy PizzaStage + bake-overlay), still ≥48px above the 8px floor.

## 6. Interaction regression (pointer accuracy after the sizing changes)

Confirmed via the existing full Playwright suite (§3, unmodified assertions covering DOUGH stretch,
sauce paint, mozzarella tap-placement, CUT gesture, full round completion) plus Video B (§8, real
physical-drag mouse gestures for mozzarella/basil, plus dough stretch/sauce paint/CUT line drag) —
every gesture landed where dragged, at the new height-aware dough sizes. No `PizzaStage.*.test.tsx`
(dough-stretch/sauce-parity/cut-gesture/bake-visual/sauce-reset/stage-layout) needed any change.

## 7. WebKit verification

`playwright.config.ts` gained two WebKit projects (`webkit-390x844`/`webkit-360x800`,
`devices["Desktop Safari"]`) for this PR's own local verification, per Issue #167 §13. **WebKit is
not installed in this Claude Code cloud session's environment** — confirmed by directly attempting a
run (`browserType.launch: Executable doesn't exist at /opt/pw-browsers/webkit-2215/pw_run.sh`), not
assumed or skipped. Per this environment's own operating rules, `playwright install` may not be run
here to fetch it. This is reported as a genuine environment limitation, not a PASS — WebKit
verification remains open for PR-C (or any environment/session with WebKit already available) to
actually execute; the two projects are committed and ready to run there unmodified.

## 8. Human Verification

Per `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`. All three delivered directly to the user
this session (file-transfer, not git) — **never committed to the repository.**

| Video | Viewport | Duration | Resolution | Codec | Size | Scenario |
|---|---|---:|---|---|---:|---|
| A | 390×844 | 29.24s | 390×844 | H.264 | 887 KB | Full Margherita flow: HOME → Pizza Select → PREPARE (DOUGH stretch → SAUCE paint → CHEESE tap-place → TOPPING tap-place) → 焼く → BAKE → 取り出す → CUT (3 lines) → 切り終わる → RESULT. Confirms all 6 tabs visible throughout, no scroll, PizzaStage/materials/CTA all visible at every step. |
| B | 390×844 | 35.24s | 390×844 | H.264 | 1005 KB | Interaction regression: DOUGH stretch (12-point radial gesture, held per point), SAUCE paint ring, **mozzarella physical drag** (chip→dough, 3 drops), **basil physical drag** (chip→dough, 2 drops), CUT drag (3 lines). Confirms pointer-drop position matches the visual drop point at the new height-aware dough sizes. |
| C | 360×800 | 25.68s | 360×800 | H.264 | 744 KB | Layout check at the secondary viewport across PREPARE (DOUGH→SAUCE→CHEESE→TOPPING, held on TOPPING) → BAKE (held) → CUT (held, 3 lines drawn). Confirms no horizontal/vertical overflow and all 6 tabs stay visible at 360×800. |

**Video Verification: PASS** for all three — verified via `ffprobe` (`h264`, correct
resolution/duration/nonzero size, table above) and direct frame-extraction visual inspection (3
sample frames pulled and reviewed: DOUGH step showing all 6 tabs + disabled 次へ, CHEESE step
showing the folded-in drag hint text live, TOPPING step at 360×800 showing full layout with no
clipping) — each file plays back real, non-corrupted app content matching its own claimed scenario.

Download: delivered directly to the user this session (file-transfer attachments in this
conversation), per policy §6 — no GitHub Actions Artifact needed for an interactive session.

## 9. Screenshots

`docs/reports/screenshots/cooking-ui-1screen-2.0-pr-a/` (committed, per policy §9):

- `after_01-dough_390x844.png` / `after_02-sauce_390x844.png` / `after_03-cheese_390x844.png`
- `after_04-topping_390x844.png` / `after_04-topping_360x800.png`
- `after_05-bake_390x844.png` / `after_05-bake_360x800.png`
- `after_06-cut_390x844.png` / `after_06-cut_360x800.png`
- `unlimited-stock-symbol-shipped.png` (§1.4's own comparison evidence)

Covers the required minimum (DOUGH/TOPPING/BAKE/CUT) plus SAUCE/CHEESE for completeness at
390×844, and the four steps most sensitive to the secondary viewport at 360×800. Usable for
structural comparison against the Design Reference per the Phase 0 report's own Design Reference
section (6 tabs always visible, compact header, PizzaStage as center focus, compact ingredient UI,
always-reachable CTA — all visually confirmed present; see §10 for the one Design Reference intent
this PR did *not* chase).

## 10. Known limitations

- **WebKit could not actually be run this session** (§7) — committed and ready, not yet executed.
- **PizzaStage's height-aware `min()` term never actually engaged at 390×844/360×800** in this
  session's measurements (the `vw`/px terms still win at both) — it is a real safety net for a
  shorter real `100dvh` than these viewports provide (Safari toolbar shown, etc.), but that specific
  path is unverified against an actual shrunk viewport in this session (WebKit unavailable to
  simulate it, and no `100dvh`-shrinking real device in this environment). A future session could
  verify it directly by setting a Playwright viewport shorter than either shipped target (e.g.
  390×700) and confirming the dough shrinks below its `vw`/px cap without breaking interaction.
- **The empty space below the ingredient tray on several steps** (visible in the TOPPING screenshot,
  §9) was not further compacted — Phase 0/this PR's own scope is "no scroll, tabs fit, deliberate
  margin", not eliminating all empty space; `App.css`'s own pre-existing comment
  (`Visual Polish 2.0A`) documents this as an intentional past tradeoff (a flex-grow PizzaStage was
  tried and reverted for reading worse), not something this PR reopened.
- **`∞` A/B/C**: only option A ("symbol", shipped) was screenshotted/video-verified live; B/C are
  code-complete but visually unverified in this session (§1.4).
- Two of Phase 0's own **methodology corrections** (§1.1/§1.2) mean this Result Report's own
  "before" numbers differ from the Phase 0 report's — see those sections for the specific,
  documented reason (a `position: fixed` element's tautological bottom-edge position, and
  `scrollHeight`'s own spec-mandated clamping). The qualitative direction of Phase 0's concern (thin
  real-device margin risk from font/toolbar/safe-area variance) is unaffected by this correction.

## 11. PR-B handoff (Reference Truth — not built here)

Unchanged from the Phase 0 report's own §8/§11: `ReferenceThumbnail.tsx`/`ReferencePreview.tsx`/
`PlayerReferencePreview.tsx` still each hand-implement their own flat-circle sauce/dough-boundary/
piece-scale instead of reusing `PizzaStage.tsx`'s real heatmap/shape renderer. Not touched by this
PR (explicitly out of scope, Issue #167 §2). `PizzaStage.tsx`'s own now-height-aware sizing (§1.5)
is a design-compatible foundation for PR-B's planned extraction (a shared, size-parameterized
presentational layer) — it does not need to be redone there.

## 12. PR-C handoff (Verification Hardening — not built here)

- Actually **run** the WebKit projects this PR added to `playwright.config.ts`, in an environment
  where WebKit is installed (§7).
- Consider asserting the height-aware `min()` term's own shrink path directly (§10's second bullet)
  at a viewport shorter than 390×844/360×800.
- Wire a CI-safe subset of this margin/overflow verification into `.github/workflows/ci.yml` if
  desired — deliberately not done by this PR (`playwright.config.ts`'s own file header still says
  "Deliberately NOT wired into `npm test` or `.github/workflows/ci.yml`", unchanged; workflow
  changes are explicitly out of this PR's own scope guard).
