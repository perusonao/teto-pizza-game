# Cooking UI 1-Screen 2.0 — Phase 0 Fresh Audit

Status: **AUDIT ONLY — no production code, CSS, or test changes in this task.**
Issue: [#167](https://github.com/perusonao/teto-pizza-game/issues/167)
Audited `main` SHA: `54282e314d95aec08d96750dae46fc94eb3213d3` (HEAD at audit time, `docs: Node 22
Migration Phase D/E production deployment result (#166)`)
Authority for layout judgment per the task's own instruction: **2026-09-22 iPhone Safari real-device
Human Verification** (screenshots + observation notes supplied to this session), not Playwright.

## Design Reference (Phase 0 Follow-up, ChatGPT Fresh Review)

**Design Reference:** `docs/design/references/cooking-ui-1screen-2.0-target.png` (PNG, 1536×1024,
~1.97MB) — the "完成イメージ" target mockup supplied for this Phase 0 follow-up, registered into the
repository at the user's explicit request.

**This image is not a pixel-perfect specification.** When it conflicts with anything else, priority
is, in order:

1. Issue #167 Acceptance Criteria
2. iPhone Safari real-device Human Verification
3. Current game specification / operability / scoring logic
4. Design Reference image

This report now distinguishes four separate things, never conflated:

- **Current UI** — what `GameScreen.tsx`/`App.css` actually render today on `main`, as measured in
  §2–§9 below (unchanged from the original Phase 0 audit).
- **Real-device Evidence** — the 2026-09-22 iPhone Safari screenshots/observations this audit treats
  as authority (§3–§5's own root-cause analysis is built on this, not on the Design Reference).
- **Design Reference** — this attached target mockup: an aspirational layout illustration, not a
  spec. It may contain typos, unnatural Japanese, or ingredient counts/steps/scoring-adjacent text/
  pizza renderings that differ from the real game — none of that content is adopted.
- **Implementation Target** — what PR-A should actually build: Issue #167's own Acceptance Criteria
  plus the current game's real steps/ingredients/scoring, *informed by* (not copied from) the Design
  Reference's structural layout intent.

Layout intent adopted from the Design Reference (structural only):

- 6-step tabs always visible, no horizontal scroll
- compact Recipe/Instruction header
- PizzaStage kept as the visual/central focus of the screen
- compact Ingredient UI
- bottom CTA always reachable
- the overall layout doesn't move dramatically step to step
- one-screen completion, no scroll

**Explicitly not adopted:** any copy, button, ingredient count, step sequence, or scoring-adjacent
wording the mockup shows that differs from the real game — per the priority list above, the mockup's
own captions/material cards/piece counts are illustrative only, never literal UI copy to ship.
**PR-A must treat this image as a design reference for satisfying Issue #167's Acceptance Criteria,
not as a literal reproduction target.**

## 0. Fresh Start / scope confirmation

- `git fetch origin` run; this audit reads `origin/main` at the SHA above.
- Read fresh: `CLAUDE.md`, `docs/PROJECT_HANDOFF.md`, `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`,
  Issue #167, Issue #157/PR #158, Issue #159/PR #160.
- No production code, CSS, or test file in this repository was modified by this task. Read-only
  code inspection plus a local `npm ci` + `vite dev` + a throwaway, never-committed Playwright
  script (deleted after use, confirmed via `git status --short` returning clean) were used purely
  to capture real `getBoundingClientRect()` numbers for §3/§4 instead of estimating them from CSS
  alone — this does not touch any tracked file.

## 1. Duplicate Gate

Searched open issues/PRs for: Cooking UI, 1-Screen, Safari, visual viewport, PizzaStage, Reference,
見本, tabs, overflow.

- **No open PR implements Issue #167.** `closed_by_pull_requests.total_count` for #167 is 0.
- **Issue #159 "Cooking UI 1-Screen Polish"** (the obvious prior-art candidate) is **already
  CLOSED (completed)**, and its PR **#160 is already MERGED** into `main` (commit `f8e461a`,
  present in `origin/main`'s own history at the audited SHA). `docs/PROJECT_HANDOFF.md`'s own
  2026-09-21 addendum still describes this PR as "OPEN, pending the user's own review" — **that is
  stale text; fresh GitHub state overrides it** per the handoff doc's own "Fresh GitHub/main state
  always wins" rule and per this task's own instruction to treat fresh GitHub/main as authority.
  Issue #167 is explicitly written as a **follow-up/correction** to #159's already-merged work (its
  body opens with "既存のCooking UI 1-Screen対応が実機要件を満たしていない"), not a duplicate of it.
- **PR #158** ("Gameplay UX Phase 2: add Home navigation to Lunch Rush result", closes Issue #157)
  is open but is **unrelated to Cooking UI** — it only touches `MissionResultOverlay`/`App.tsx`
  Lunch-Rush-RESULT navigation. Its `mergeable_state` is `clean` (no conflicts against current
  `main`), CI status returned `"state": "pending"` with 0 statuses recorded (no check runs found
  against its head SHA `3ecc0f47`) at audit time — i.e. nothing is currently failing, but nothing
  has run either; this is a pre-existing state of PR #158 itself, not something this audit changed
  or needs to act on.
- **Verdict: no duplicate implementation PR exists for Issue #167.** Per Issue #167's own
  "Coordination" section ("PR #158を最新mainへ追従・完了後、PR-Aを開始するのを基本とする"), PR #158
  and Issue #167/PR-A are independent, non-conflicting tracks (different files: PR #158 touches
  `MissionResultOverlay.tsx`/mission CSS; PR-A's scope below touches `GameScreen.tsx`/`App.css`
  Cooking-UI selectors) — PR-A does not need to wait for PR #158 to merge, only to stay aware it
  exists so a future rebase doesn't silently drop it.

## 2. Current layout architecture

The Cooking UI screen is `GameScreen.tsx` (`src/screens/GameScreen.tsx`, 671 lines), styled almost
entirely from one 3895-line stylesheet, `src/App.css` (no CSS Modules/scoped styles in this repo).
Render order for the phases this issue covers (PREPARE steps DOUGH/SAUCE/CHEESE/TOPPING, BAKE,
POST_BAKE/CUT):

| Section | Component | Key CSS selector(s) | Rendered when |
|---|---|---|---|
| Outer clip frame | `.app-frame` (`App.tsx`) | `App.css:27-38` — fixed `100dvh`, `overflow:hidden`, `max-width:390px` | always |
| Header (🏠/Pitz) | inline in `GameScreen.tsx:270-279` | `.app-header` `App.css:41-56` | always |
| Mission HUD | `MissionHud` | n/a | Lunch Rush only |
| Dialogue (order/bake line) | inline | `.dialogue-area` `App.css:81-87`, `min-height:84px` | ORDER/BAKE only, not PREPARE/POST_BAKE |
| **6-step tab strip** | `MakingStepTabs.tsx` | `.making-step-tabs`/`.making-step-tab*` `App.css:863-974` | PREPARE, BAKE, POST_BAKE(CUT) |
| Recipe/hint/mini-見本 | inline `.order-card` | `App.css:135-176` | PREPARE, POST_BAKE(CUT) |
| **PizzaStage** | `PizzaStage.tsx` | `.pizza-stage`/`.pizza-dough`(+`--compact`/`--roomy`) `App.css:200-254` | always (interactivity varies) |
| Sauce metrics panel | `SauceMetricsPanel` | `.sauce-metrics-panel` | PREPARE, SAUCE step, reference-covered recipes only |
| Ingredient tray | `IngredientTray.tsx` | `.ingredient-panel`/`.ingredient-tray`/`.ingredient-chip` `App.css:780-1189` | PREPARE, not DOUGH |
| Bake controls | `BakeOverlay.tsx` | `.bake-overlay` `App.css:1271+` | BAKE only |
| Cut controls | inline `.cut-progress-readout` + `.action-row.prepare-bake-bar` | `App.css:178-197`, `1197-1213` | POST_BAKE(CUT) only |
| Bottom CTA (次へ/焼く！/やり直す/ヒント) | inline `.prepare-bake-bar` | `App.css:1190-1213`, `position:fixed` | PREPARE only (CUT has its own bottom bar, same class) |

Sizing model: `.app-frame` is `height:100svh` (fallback) then `height:100dvh` (override),
`overflow:hidden` — a hard, non-growing outer clip. `.game-screen` (`App.css:2707-2714`) is a flex
child with `overflow-y:auto` — **the architecture's actual "1-screen" guarantee is an internal
scroll fallback, not a hard no-scroll layout contract.** Every PREPARE/CUT step budget was tuned by
hand (chip `min-height` 68px, `.ingredient-tray` row auto-sizing, PizzaStage `--compact`, `.order-
card` compaction, etc. — each has its own dated comment in `App.css` citing a prior Fresh Audit) to
land *under* `.game-screen`'s available height so this fallback never actually triggers during
normal PREPARE/BAKE/CUT play; RESULT is the one screen designed to use it (`e2e/viewport-
1screen.spec.ts`'s own `FREE RESULT` test asserts internal-scroll RESULT explicitly, by design).

## 3. Width Audit (6-step tab strip)

Real `getBoundingClientRect()` measurements (Chromium via a throwaway local Playwright script,
Margherita round — the only recipe with a CUT `postStep`, so all 6 items render):

**390×844** (`.making-step-tabs` box: `x=0, w=390`, padding `4px 12px 0`, `gap:4px`):

| Tab | x | width | right edge |
|---|---:|---:|---:|
| 生地 (flex:1) | 12.0 | 61.2 | 73.2 |
| ソース (flex:1) | 77.2 | 61.2 | 138.4 |
| チーズ (flex:1) | 142.4 | 61.2 | 203.6 |
| 具材 (flex:1) | 207.6 | 61.2 | 268.8 |
| 🔥焼く (fixed 40px) | 272.8 | 40.0 | 312.8 |
| カット (flex:1) | 316.8 | 61.2 | **378.0** |

Viewport right edge = 390. Last tab's right edge (378.0) is **12px inside** the viewport — the
strip fits with room to spare under this engine's font metrics.

**360×800**: same math scaled down (container padding/gap unchanged, `12px`/`4px`), each `flex:1`
tab computes to **55.2px**, last tab (`カット`) right edge = **348.0**, viewport = 360 → **12px**
spare, same margin.

**Root cause of the real-device clipping (not "because it's Safari"):**

1. **`playwright.config.ts:24-30` runs both projects on `devices["Desktop Chrome"]`, not any
   WebKit/mobile-Safari device.** There is no `iphone`/WebKit project in this repo at all. This is
   not a subtle gap — the test suite structurally never renders this page in Safari's engine, so
   any Safari-specific text-metric, font-substitution, or emoji-width difference is invisible to
   it *by construction*, independent of how well `e2e/making-ui-1screen.spec.ts`'s own
   `assertNavFitsViewport` (which does correctly assert every tab's `right <= viewport width + 1`,
   §5 below) is written.
2. **Font-family fallback chain is never fully satisfied on either machine, but resolves to a
   different actual font on each.** `body { font-family: "Hiragino Maru Gothic ProN", "Yu Gothic",
   "Rounded Mplus 1c", system-ui, sans-serif; }` (`src/index.css:30-31`) has **zero `@font-face` /
   webfont backing anywhere in the repo** (confirmed via repo-wide grep — no `@font-face`, no
   `fonts.googleapis.com` reference). "Hiragino Maru Gothic ProN" **is a real, installed system
   font on iPhone Safari** (Apple's own rounded Japanese UI font) — so a real iPhone actually
   renders every tab label in it. On the Linux Playwright/CI machine none of the first three names
   resolve to an installed font, so Chromium there falls through to whatever `system-ui`/`sans-
   serif` resolves to locally (typically a Noto/Liberation-family CJK substitute, with different —
   usually narrower — per-glyph advance widths for Japanese characters than Hiragino Maru Gothic
   ProN's rounder, wider glyph set). **The two engines are measuring two different fonts, not the
   same font under two renderers.**
3. **No `-webkit-text-size-adjust: 100%` is set anywhere** (grep confirmed). Absent this
   declaration, iOS Safari's own automatic text-inflation heuristic ("font boosting") can scale
   *rendered* font size above the literal `font-size: 11px` CSS value for narrow flex children —
   a behavior with no equivalent in desktop Chromium's layout engine for a fixed-viewport `<meta
   viewport>` page, so Playwright cannot reproduce it at any font.
4. **Compounding, not sole-cause:** `.making-step-tab` already has `min-width:0` (so a `flex:1 1 0`
   tab genuinely shrinks instead of forcing row overflow) and `overflow:hidden; text-overflow:
   ellipsis` — so a *wider label* alone, for a `flex:1` tab, should just ellipsis in place rather
   than push the row wider. The one tab this protection does **not** cover the same way is the
   fixed-width BAKE indicator (`.making-step-tab--bake`, `flex:0 0 auto; width:40px; display:flex`,
   `App.css:945-953`) — `display:flex` on an element that also carries `text-overflow:ellipsis`
   from `.making-step-tab` is a known cross-engine inconsistency (`text-overflow` requires a
   block-like overflow context; behavior on a `display:flex` element is not identical across
   Chromium and WebKit), and its content is `🔥 焼く` — an **emoji glyph**, whose real Apple Color
   Emoji glyph metrics on iPhone Safari can differ from whatever emoji font (or fallback "tofu")
   Linux Chromium substitutes. A wider-than-40px real render of this one non-shrinking item is the
   most likely single point where extra width enters the row on-device without showing up in CI.
5. **Net effect for PR-A:** the *margin* this audit found in Chromium is only **12px** at either
   viewport — i.e. even a small, realistic Safari-specific width delta (font substitution +
   font-boosting + emoji metrics, any one of which is plausible per above) is enough to consume it
   and clip the trailing tab(s), exactly as the real-device screenshots show. This is a genuine,
   reproducible-in-theory bug, not a flaky one — it will reproduce on every real iPhone Safari
   session with these system fonts, on every load, because the cause is deterministic font
   substitution, not timing.

## 4. Height Budget Audit (real measured, Chromium/Margherita, 390×844)

| Region | y (top) | height | bottom |
|---|---:|---:|---:|
| `.app-header` | 0 | 56.0 | 56.0 |
| `.making-step-tabs` | 56.0 | 44.0 | 100.0 |
| `.order-card` (PREPARE) | 104.0 | 80.0 | 184.0 |
| `.pizza-stage` (`--compact`, PREPARE) | 184.0 | 302.0 (dough 290×290) | 486.0 |
| `.ingredient-panel` (SAUCE) | 529.0 | 162.0 | 691.0 |
| `.prepare-bake-bar` (`position:fixed`) | 770.0 | 74.0 | **844.0** |

PREPARE/SAUCE bottom bar lands at **exactly 844.0px — zero pixels of spare margin** at the
authority viewport. CHEESE/TOPPING ingredient panels measured slightly taller (171/175px) but the
fixed bottom bar still lands at exactly 844.0 either way, because `.ingredient-panel`'s own
`overflow-y` (inherited from `.game-screen`) absorbs any extra tray height — the CTA bar's own
position is pinned, not derived from content height.

| Region | y (top) | height | bottom |
|---|---:|---:|---:|
| `.app-header` | 0 | 56.0 | 56.0 |
| `.dialogue-area` (BAKE only) | 56.0 | 107.7 | 163.7 |
| `.making-step-tabs` | 163.7 | 44.0 | 207.7 |
| `.pizza-stage` (`--roomy`, BAKE) | 207.7 | 370.8 (dough 358.8×358.8) | 578.5 |
| `.bake-overlay` (gauge + CTA) | 578.5 | 205.0 | **783.5** |

BAKE has **60.5px** of spare at 390×844 — more margin than the tab strip's width budget, but still
a fixed, hand-tuned number with no responsive relationship to actual available height (§6).

POST_BAKE/CUT: header 56 + tabs 44 + order-card 45.9 + `.pizza-stage --roomy` 370.8 (same
358.8×358.8 dough as BAKE) + `.cut-progress-readout` 24 = bottom 520.7, then the fixed
`.prepare-bake-bar` again lands at exactly 844.0 (770–844).

At **360×800** the same shape holds: PREPARE/SAUCE bottom bar lands at exactly `y=726, h=74,
bottom=800` — again **zero spare**. `.pizza-stage --compact` dough is 273.6×273.6 there.

**Interpretation:** every one of these numbers is a static, hand-tuned CSS budget (fixed px caps,
`min(Nvw, Mpx)` formulas, fixed `min-height`s) calibrated so the *sum*, under Chromium's font
metrics, lands at-or-under the viewport height — several with **exactly 0px** of margin. This
matches §3's finding: the "0-margin at 390/360 in Chromium" pattern is structural, not
coincidental, and any engine/font/toolbar difference that adds even a handful of px (§5) pushes
these specific steps (most exposed: PREPARE/SAUCE, PREPARE/TOPPING — the tallest ingredient trays,
already at 0px spare) over budget and into `.game-screen`'s `overflow-y:auto` fallback, i.e. real
scrolling — item 1 in the real-device Evidence list.

## 5. Safari Visual Viewport Gap — why Playwright PASS ≠ real-device PASS

This is not a weak-assertion problem — `e2e/making-ui-1screen.spec.ts`'s `assertOneScreen` (checks
`.game-screen` `scrollHeight <= clientHeight` and `docScrollWidth <= innerWidth`) and
`assertNavFitsViewport` (checks every individual tab's `right <= viewport width + 1`) are the
*correct* assertions for this issue's own Acceptance Criteria, run across all 6 steps at both
390×844 and 361×800 (`VIEWPORTS` const). The gap is entirely in what environment they run against:

1. **`playwright.config.ts` uses `devices["Desktop Chrome"]` for both projects** — a desktop
   Chromium build with its `viewport` size overridden, not `devices["iPhone 13"]` or any WebKit
   project. No mobile Safari user-agent, no `isMobile`/`hasTouch`, and critically **no WebKit
   rendering/font engine at all**. Every Safari-only behavior below is structurally untestable by
   this suite regardless of what it asserts.
2. **No dynamic toolbar simulation.** Playwright's `viewport: {width, height}` is a fixed, static
   number for the whole test. Real (non-PWA-standalone) iPhone Safari's visible viewport shrinks
   and grows as the address bar/bottom toolbar show and hide during scroll — `100dvh` (which
   `.app-frame`/`html`/`body`/`#root` all use, correctly, as the modern replacement for `100vh`)
   is *designed* to track this and is not itself a bug — but it means the same page's available
   height is not one fixed number on a real device the way it is in this test suite. Combined with
   §4's several **exactly-0px-margin** budgets, the real device's dynamic toolbar-visible state
   (the default/common state right after navigating, before any scroll gesture collapses the
   toolbar) can legitimately be a few px shorter than the toolbar-hidden state these hand-tuned
   budgets were most likely eyeballed/screenshotted against — enough to flip several already-
   exact-fit steps into `.game-screen`'s scroll fallback.
3. **`env(safe-area-inset-*)` resolves to `0px` on a non-notched desktop Chromium context**, while
   a real iPhone's safe-area insets are non-zero (top inset for the status bar/notch is already
   accounted for via `padding: calc(8px + env(safe-area-inset-top, 0px))` on `.app-header`, and
   bottom insets via `.prepare-bake-bar`'s own `calc(10px + env(safe-area-inset-bottom, 0px))` —
   correctly *using* the primitive, but Playwright's `0px` value in CI means these paddings are
   silently testing their non-notched minimum only, never their real-device (larger) value that
   further eats into the already-0px-margin budgets above).
4. **Font stack**, per §3 — same root mechanism, also affects vertical line-height/wrapping (a
   taller real Hiragino Maru Gothic ProN line in `.order-card__hint`'s 2-line clamp, or in a chip
   label, adds height, not just width).

**Minimum verification strategy to close this gap (feeds PR-C, §12):**

- Add a **WebKit** Playwright project (`devices["iPhone 13"]` or an explicit
  `{ ...devices["Desktop Safari"], viewport: {390,844} }`/`browserName: "webkit"` variant) alongside
  the existing Chrome projects — this alone closes gap #1 without needing real hardware, since
  Playwright's own WebKit build shares much more of Safari's text-layout/font-substitution
  behavior than Chromium does (still not pixel-identical to a real iPhone, since font *availability*
  on the Linux/CI machine is still not Apple's, but structurally closer than Chromium).
- Add `-webkit-text-size-adjust: 100%` to `html`/`body` (a real, no-behavior-change-on-Chromium fix
  that directly removes root-cause §3.3/§5.4's biggest wildcard) — **this is itself a CSS change
  and is out of this audit's own no-code-change boundary; flagged here as a PR-A candidate fix, not
  applied.**
- Re-budget every "exact 0px margin" region in §4 to a small deliberate slack (e.g. 8–12px) rather
  than calibrating to the exact fit Chromium currently reports — the goal is not "0 on Chromium",
  it is "several px of margin on Chromium precisely so a few px of real-device font/toolbar/safe-
  area variance cannot flip it".
- Treat Playwright (any engine) as a regression net for the numeric assertions already written, not
  as the completion authority — continue requiring real-device Human Verification for this class of
  change, per `TETO_HUMAN-VERIFICATION-POLICY.md` (already the case; Issue #167 itself is the
  proof this discipline is necessary, not optional).

## 6. PizzaStage Responsive Design

Current sizing (`App.css:207-254`) is **entirely static, viewport-width-only**, via three fixed
`min(Nvw, Mpx)` rules selected by a boolean `compact`/`roomy` prop from `GameScreen.tsx:441-442`:

- default (ORDER preview only, today): `min(78vw, 300px)`
- `.pizza-stage--compact` (PREPARE): `min(76vw, 290px)`
- `.pizza-stage--roomy` (BAKE, POST_BAKE/CUT): `min(92vw, 380px)`

None of these formulas reference available **height** at all — `vw`-only sizing is why the same
recipe's dough is 290×290 during PREPARE but jumps to 358.8×358.8 during BAKE/CUT (§4), independent
of how much vertical room the header/tabs/order-card/bake-overlay actually leave that step. This is
by original design (`App.css:223-241`'s own comment explains a `flex-grow` approach was tried and
reverted because centering a same-size circle in more vertical space read as "floating" — a real,
documented UX tradeoff, not an oversight) but it is also *why* BAKE (60.5px spare) and PREPARE
(0px spare) have such different safety margins for the same underlying circle-in-a-column layout.

**Is a height-aware design safe to build without touching interaction/scoring math?** Yes, with one
required discipline: **every pointer/gesture calculation already reads the dough element's own
live `getBoundingClientRect()` at interaction time**, not the CSS formula's static px value —
confirmed by `PizzaStage.tsx`'s `onDoughElementChange`/`resolvePhysicalDrop` plumbing
(`GameScreen.tsx:123-124`, `433`) and by `data-pizza-drop-target` being read via `boundingBox()` in
every existing e2e gesture helper (`e2e/gestures.ts`, used throughout `viewport-1screen.spec.ts`/
`making-ui-1screen.spec.ts`). Coordinate math is **not** hardcoded against the `min(78vw,300px)`
literal anywhere in `src/logic/pizzaCoordinates.ts`/`doughShape.ts`/`sauceField.ts` (all percent-
space, 0–100, derived from the live rect) — this was already load-bearing for the existing
`--compact`/`--roomy` split (two different literal sizes for the same recipe today), so a `clamp()`
or `calc()`-based **height-aware** formula (e.g. `clamp(240px, min(76vw, calc(100dvh - <sum of
sibling heights as CSS custom properties or a fixed reserve>)), 340px)`) is architecturally safe:
it changes only the *number* the same live-rect-reading pipeline already consumes, not the pipeline
itself. The real risk is not correctness, it's **regression scope**: `PizzaStage.stageLayout.test.ts`
and 5 other `PizzaStage.*.test.tsx` files assert specific behavior against the current static sizes
(dough-stretch, sauce-parity, cut-gesture, bake-visual, sauce-reset) — any height-aware resize needs
those kept green, likely by keeping the *interaction* percent-space math untouched and only letting
the outer px formula vary.

## 7. Ingredient UI Audit

- **"ドラッグしてのせる"** (`IngredientTray.tsx:414`, `.ingredient-chip__drag-hint` `App.css:1090-
  1095`) renders **only** when `isDraggable(ingredient)` is true — i.e. only for `mozzarella`/
  `basil` chips (`GameScreen.tsx:533`'s `draggableIngredientIds={["mozzarella", "basil"]}`) while
  `physicalDragEnabled` (`referenceModeEnabled && !popover && !overlay`) holds. Every other
  ingredient chip never shows this text at all — it is not a blanket duplicate across the whole
  tray, only these two chip types, and only when drag is actually the available interaction for
  them (tap-to-place chips have no such label). It genuinely restates information already implied
  by the step's own compact hint (`state.hint`/`recipe.description` in `.order-card__hint`), so
  removing it is safe for every recipe/ingredient **except** it is currently the *only* on-screen
  affordance telling a first-time player that mozzarella/basil specifically support physical
  drag-and-drop (as opposed to tap-to-select-then-tap-pizza, the mechanism every other ingredient
  uses) — Fresh Audit recommendation: fold this into the step's own short instruction text
  (`data/hints.ts`) for the two steps that actually have a draggable ingredient, rather than
  deleting the affordance information outright. Height impact if removed: `.ingredient-chip`'s
  `gap:4px` plus one ~9px text line per drag-capable chip — a few px per row, not the tray's
  dominant contributor (that is `min-height:68px` per chip and grid row count, unaffected by this
  text).
- **`∞`** (`IngredientTray.tsx:413`, `.ingredient-chip__stock`) renders `stock === "UNLIMITED" ?
  "∞" : "×N"`. **Revised conclusion (Fresh Review follow-up):** the *internal* Stock Gate semantics
  (`remainingStock`/EP1/EP3, `UNLIMITED` vs. finite) are real and load-bearing — that much is not in
  question, and is not being revisited. What is genuinely still open is only the **on-screen
  presentation** of the `UNLIMITED` case specifically: that the underlying data is meaningful does
  not by itself settle whether `∞`, specifically, is the right *always-visible Cooking UI* rendering
  of it at 9px on a real 390/360px phone. **Finite stock's `×N` badge is unconditionally kept under
  every option below — not up for debate.** PR-A should build enough to compare, without Phase 0
  committing to a final answer:
  - **A. Keep `∞` as-is** — lowest risk, no copy change; real-device legibility of the glyph at the
    current 9px size, at both viewports, is unverified by this audit.
  - **B. Hide the badge entirely when `UNLIMITED`** (blank — no `∞`, no `×N`) — smallest footprint,
    but removes today's explicit "this is unlimited" signal; a first-time player may not distinguish
    "no badge" from "a rendering bug".
  - **C. A different, more legible representation** for the unlimited case (e.g. a short label
    distinct from a numeric badge) — clearest intent, but adds width/height, working against this
    issue's own compaction goal, and needs its own real-device legibility check.

  **Phase 0 does not pick a winner among A/B/C.** PR-A should implement this as a single small
  variation point (e.g. one prop/branch on the existing chip, not three parallel components) so the
  real-device Human Verification pass (§13) can settle it — consistent with Issue #167's own "iPhone
  Safari実機をauthorityとする" stance, applied here to a UI decision, not just a layout-fit one.
- **Recipe header compaction**: `.order-card__hint` already went through exactly this pass under
  Issue #159 P1 (`App.css:160-167`'s own comment) — 2-line clamp, no silent truncation. No further
  Fresh Audit finding here; PR-A should leave it as-is unless a specific hint line is shown to
  still clip at 2 lines on real Safari.
- **Bottom CTA persistent access**: already `position:fixed` (`App.css:1197`), confirmed always
  on-screen in every measured step (§4) — no finding here.

## 8. Reference Truth Audit

Four independent rendering paths exist for what should be "the same pizza, shown small":

| Renderer | Sauce | Dough boundary | Piece scale | Size |
|---|---|---|---|---|
| `PizzaStage.tsx` (real play) | live heatmap (`sauceFieldToRgbaPixels`), can overflow the guide onto the crust (Sauce Free Boundary, PR #66) | player's own hand-shaped `doughShape` (8-point radial, clip-path) | native `IngredientPieceVisual` at full component scale | 290×290 (PREPARE) / 358.8×358.8 (BAKE/CUT), `min(Nvw,Mpx)` |
| `ReferencePreview.tsx` (Scoring-2.0-covered recipes' popover) | flat solid-color circle, `transform: scale(0.55 + coverage*0.4)`, opacity from coverage — **not** the heatmap renderer at all | plain full circle, no shape concept; `SAUCE_TARGET_RADIUS` dashed guide reused (correct, shared constant) | `IngredientPieceVisual` scaled via `--reference-piece-scale` custom property | fixed **140×140** (`.reference-mini-pizza`, `App.css:3487`) |
| `PlayerReferencePreview.tsx` (non-covered recipes' popover) | same flat-circle pattern (`.player-reference-mini-pizza__sauce`) | plain circle | `--player-reference-piece-scale: 0.5` | fixed **140×140** |
| `ReferenceThumbnail.tsx` (always-visible mini icon, `.mini-reference`) | flat solid background color rect (`reference-thumbnail__base`, no shape/coverage/opacity signal at all) | none | `--thumb-piece-scale: 0.26` | **48×48** |

`ReferenceThumbnail` and its popover (`ReferencePreview`/`PlayerReferencePreview`) already share
one upstream data source (Issue #159 P0 bullet 5's own fix: both read `referencePizza ??
getPlayerReferencePizza(recipe)`, same `pieceGroups`/`sauceIngredientId` object read twice, not
recomputed) — **the SSOT-data problem this issue's §8 worries about is already solved for
piece-count parity.** What remains unsolved, and is the actual visible "見本と実際が違う" gap the
screenshots show, is that **none of the three "見本" renderers share PizzaStage's own rendering
code**: sauce is a flat scaled circle vs. a real painted heatmap that can overflow its guide; dough
is always a perfect circle vs. the player's own free-shaped boundary; and each renderer defines its
own independent piece-scale custom property rather than deriving from one shared function of
(container size ÷ reference stage size). The reference popover is also **fixed at 140px** regardless
of the real PizzaStage's own current size (290/358.8/273.6/328px across steps/viewports, §4/§6) —
roughly 39–49% of the real dough's diameter, not a consistent fraction, so relative piece
positions/density can visually read differently even where the underlying `%`-space coordinates are
identical.

**Recommended direction (PR-B, not built here):** extract PizzaStage's own dough/sauce/piece
rendering (currently monolithic inside `PizzaStage.tsx`, 1290 lines) into a shared, size-
parameterized presentational layer that both `PizzaStage` (live, interactive, real `doughShape`/
`sauceDeposits`) and the Reference views (static, `referencePizza`/`playerReference`'s ideal target
data standing in for `doughShape`/`sauceDeposits`) can both call — same component tree, different
data and `interactive`/size props — rather than three hand-written parallel implementations. This is
exactly the `recipe/reference truth → shared rendering data → {Reference, PizzaStage}` shape the
task's own Design Reference calls for, and is scoring-safe: `getReferencePizza`/
`getPlayerReferencePizza` and `SAUCE_TARGET_RADIUS`/Scoring 2.0 are read-only inputs to this
extraction, untouched by it.

## 9. CUT Audit

- `cutRequiredCount` = `requiredCutCount(resolveRequestedSliceCount(state.cutState.config))`
  (`GameScreen.tsx:214`, `src/logic/cut/evaluation.ts:27` — e.g. 6 requested slices → 3 required
  lines) and `cutConfirmReady = state.cutState.lines.length >= cutRequiredCount` (`:215`) are
  **already computed once per render**, both already available to the CTA.
- **A numeric progress readout already exists**: `.cut-progress-readout` renders
  `{state.cutState.lines.length} / {cutRequiredCount} 本` (`GameScreen.tsx:453-455`) directly above
  the CTA row — this is not literally the issue's suggested copy ("あとN本切ろう") but it is already
  a real, live completion-condition readout, contrary to the issue text's framing that *only* the
  disabled CTA communicates state today.
- **No new game state is needed** for a "あと{cutRequiredCount - lines.length}本切ろう" phrasing —
  both operands already exist as local `const`s in `GameScreen.tsx` at the exact point
  `.cut-progress-readout` is rendered; this is a pure JSX/copy change, zero reducer/state-shape
  impact, safe to fold into PR-A.

## 10. Proposed PR-A — 1-Screen Layout

**Scope:** `GameScreen.tsx` + `App.css` selectors listed in §2's table (6-tab strip sizing/label
width; PREPARE/BAKE/CUT vertical budget re-tuned off exact-0px margins to a deliberate ~8–12px
slack at both 390×844/360×800 in Chromium, so real-device variance from §5 has headroom instead of
guaranteed overflow; height-aware `.pizza-stage` sizing per §6, kept scoped to the existing
`--compact`/`--roomy` modifier classes so `PizzaStage.*.test.tsx`'s percent-space interaction
assertions stay untouched; §7's drag-hint copy relocation into `data/hints.ts` for the two
drag-capable steps; §7's `∞` A/B/C comparison, implemented as one small variation point, final
choice deferred to the Human Verification pass, not Phase 0; §9's CUT progress-readout copy). Also
add `-webkit-text-size-adjust: 100%` (`src/index.css`) as a direct, low-risk fix for §3/§5's biggest
real-device wildcard.

**Design Reference usage:** PR-A should consult `docs/design/references/cooking-ui-1screen-2.0-
target.png` for the structural layout intent listed in the "Design Reference" section above
(always-visible 6 tabs, compact header, PizzaStage as center focus, compact ingredient UI, always-
reachable bottom CTA, stable layout across steps) — it is a reference for satisfying Issue #167's
own Acceptance Criteria, never a literal image to reproduce; any mockup text/copy/ingredient/step
detail that conflicts with the real game's current spec is not implemented.

**Explicitly excluded from PR-A** (deferred to PR-B per Issue #167's own split): any change to
`ReferenceThumbnail.tsx`/`ReferencePreview.tsx`/`PlayerReferencePreview.tsx`'s own rendering, or to
`referencePizza.ts`/`playerReference.ts` data.

**Estimated files:** `src/screens/GameScreen.tsx`, `src/App.css`, `src/index.css`,
`src/data/hints.ts`, plus their existing test files (`GameScreen.makingStepNav.test.tsx` and any
`PizzaStage.stageLayout.test.tsx` assertions pinned to the current static px values) updated to
match — roughly 5–7 files, no new files required.

**Estimate:** 2–3 hours (fits the task's own preferred Claude Code session size).

## 11. Proposed PR-B — Reference Truth

**Scope:** per §8 — extract a shared, size/interactive-parameterized dough+sauce+piece renderer out
of `PizzaStage.tsx`, and reuse it (static/non-interactive mode, `referencePizza`/`playerReference`
data) from `ReferenceThumbnail.tsx`/`ReferencePreview.tsx`/`PlayerReferencePreview.tsx` in place of
each one's own hand-written flat-circle sauce + independent piece-scale variable. No change to
`getReferencePizza`/`getPlayerReferencePizza`/`SAUCE_TARGET_RADIUS`/Scoring 2.0.

**Impact on existing 15 recipes:** all 15 already flow through `getPlayerReferencePizza`
(generic, always-available) and 7 already have a `getReferencePizza` Scoring-2.0 fixture (§ per
`docs/PROJECT_HANDOFF.md`'s B2 note) — this PR changes *how* those same existing data objects are
drawn, not what data exists per recipe, so it is additive-safe for all 15 without new authored
Reference data.

**Estimated files:** `PizzaStage.tsx` (extraction), a new shared presentational component (e.g.
`PizzaVisual.tsx`), `ReferenceThumbnail.tsx`, `ReferencePreview.tsx`, `PlayerReferencePreview.tsx`,
`App.css` (consolidate the 3 parallel piece-scale/sauce selector families into one), plus their
existing test files — roughly 8–10 files.

**Estimate:** 3–4 hours (larger than PR-A; recommend the task's own "2–3h" preference be treated as
a soft target with a checkpoint, not a hard cap, given the extraction risk).

## 12. Proposed PR-C — Verification Hardening

**Scope:** per §5 —

1. Add a WebKit Playwright project (`playwright.config.ts`) alongside the existing two Chrome
   projects, run against the same `e2e/making-ui-1screen.spec.ts`/`viewport-1screen.spec.ts` suites
   at 390×844/360×800, so the existing `assertOneScreen`/`assertNavFitsViewport` assertions (already
   correct, per §5) get a second, more Safari-adjacent engine for free.
2. Re-verify §4's per-region margins are ≥8–12px (not exactly 0) at both viewports after PR-A,
   asserted via the same `getBoundingClientRect()` pattern this audit used manually.
3. Document explicitly, in the suite's own header comment, what this still cannot catch (real
   device font substitution/font-boosting/dynamic toolbar — §5's own enumerated list) so a future
   session doesn't re-treat "Playwright PASS" as sufficient without a real-device pass, the same
   trap Issue #167 itself exists to correct.

**Estimated files:** `playwright.config.ts`, `e2e/making-ui-1screen.spec.ts`,
`e2e/viewport-1screen.spec.ts` (assertion/margin tightening only, no new spec files needed).

**Estimate:** 1–2 hours.

## 13. Human Verification Plan (for PR-A onward)

Per `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` — required once PR-A lands (this Phase 0
audit itself is exempt, docs-only, no production code changed):

- **390×844 (authority):** one continuous MP4/H.264, HOME → Pizza Select → Margherita → 生地 →
  ソース → チーズ → 具材 → 焼く → カット → RESULT, holding 1–3s per step, explicitly confirming: all
  6 tabs visible with no right-edge clipping at every step; no vertical scroll gesture is ever
  needed to reach the bottom CTA/BAKE gauge/CUT controls; 見本 popover opens/closes without
  layout shift.
- **360×800 (secondary):** same flow, confirming the same three properties.
- Before/after screenshots for both viewports, committed to
  `docs/reports/screenshots/cooking-ui-1screen-2.0-pr-a/` per existing convention.
- Video delivered directly to the user this session (per policy §6), never committed to the repo.
- **Real iPhone Safari pass remains the closing gate for this issue specifically** (its own
  reason for existing) — a Preview-deployed real-device check by the user, not just Playwright/
  simulator, before Issue #167 can be considered resolved, per §5's own findings.

## Appendix: files read for this audit

`CLAUDE.md`, `docs/PROJECT_HANDOFF.md`, `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`,
`src/screens/GameScreen.tsx`, `src/App.css`, `src/index.css`, `src/components/MakingStepTabs.tsx`,
`src/components/IngredientTray.tsx`, `src/components/ReferenceThumbnail.tsx`,
`src/components/ReferencePreview.tsx`, `e2e/viewport-1screen.spec.ts`,
`e2e/making-ui-1screen.spec.ts`, `playwright.config.ts`, `src/logic/cut/evaluation.ts`, plus GitHub
state for Issues #167/#159/#157 and PRs #160/#158.

**Phase 0 Follow-up (ChatGPT Fresh Review) also added:** the attached "完成イメージ" Design
Reference mockup, registered at `docs/design/references/cooking-ui-1screen-2.0-target.png`; this
follow-up changed no finding from the original audit and added no new code/CSS/test inspection.
