# Phase 4A-1B: Independent Review Merge Gate Fix — Result

## Scope

PR #26 ("Phase 4A-1B: Cheese & Topping Physical Interaction") received its
latest Codex Independent Review with 3 open findings (P1 ×1, P2 ×2). This
round fixes all three with the minimum diff needed, re-verifies the whole
Human Feel gate is unbroken, and returns PR #26 to the Final Merge Gate
(Independent Review, not merge).

- **Starting PR HEAD (Independent Review target):** `8b4712106d6f77c9cb70ac27a2103f21dc94df5a`
- **Final source SHA (this round's fix, pushed to PR #26 head):** `2ce72c7cc854dd3d41fe3a37dbdab82cbada36d3`
- **Branch:** `codex/phase-4a-1b-physical-interaction` (PR #26's actual head branch; fast-forwarded, no rebase, no force-push)

## P1 — Purchased onion unreachable

**Finding:** `IngredientTray.tsx` sliced the active category's owned
ingredients to `MAX_INGREDIENT_PALETTE_SLOTS` (6) unconditionally. Once
onion is purchased, `topping` has 7 owned ingredients and onion (last in
`INGREDIENTS`) was always the one cut — permanently unselectable, breaking
Fugazza (which needs 4 onions).

**Root cause:** `ingredientsByCategory(activeCategory).filter(owned).slice(0, 6)` — a
hard cap with no way to reach anything past slot 6.

**Fix** (`src/components/IngredientTray.tsx`): the visible grid stays a
fixed 3x2 (`MAX_INGREDIENT_PALETTE_SLOTS` unchanged, no scrolling
reintroduced). Owned ingredients in the active category are now **paged**
6 at a time:
- `page` state, reset to 0 on category change.
- A compact page nav (`◀ 1/2 ▶`, `.ingredient-page-nav`) renders **only**
  when a category actually owns more than 6 ingredients — every category
  today (all ≤6 owned pre-purchase) renders byte-for-byte as before, no
  layout change, no nav.
- Switching page aborts any in-flight physical-drag session exactly like
  switching category already did (a paged-away chip's DOM button
  unmounts, so its pointer-capture session must end the same way).
- Onion is not in `draggableIngredientIds` (only mozzarella/basil are), so
  it reaches the pizza the same way every other non-physical topping
  already does: tap to select, tap the dough to place — unchanged.

This is a general solution (any future category, any number of owned
ingredients beyond 6, pages cleanly) — not an onion special case.

**Tests added** (`src/components/IngredientTray.palette.test.tsx`): ≤6
owned → no nav (existing behavior byte-for-byte); exactly 6 owned
(boundary) → no nav; 7 owned → page 1 hides onion, page nav shows "1 / 2";
navigating to page 2 reveals onion and it's selectable; prev/next disabled
states at both ends; category switch resets to page 1; switching pages
mid-drag aborts the stale session; Mozzarella/Basil selection and physical
drag on page 1 unaffected by the extra page.

## P2-A — Physical drag survives Dex/Shop overlay

**Finding:** `physicalDragEnabled` only watched
`referenceModeEnabled && !isReferencePopoverOpen`. A second pointer
opening Dex or Shop mid-drag didn't touch that expression, so
`IngredientTray`'s window-level `pointerup`/`pointercancel` listeners kept
tracking the session and could commit `PLACE_TOPPING` under the overlay.

**Root cause:** the interaction gate only ever modeled Reference as "the"
overlay; Dex/Shop's open state never reached it.

**Fix**: threaded a new `isGlobalOverlayOpen` prop (`App.tsx`'s
`isDexOpen || isShopOpen`) through `GameScreen` into the same gate:
`physicalDragEnabled={referenceModeEnabled && !isReferencePopoverOpen && !isGlobalOverlayOpen}`.
No new abort logic was needed — `IngredientTray` already has
`useEffect(() => { if (!physicalDragEnabled && sessionRef.current) clearSession(); }, [physicalDragEnabled])`,
the same `clearSession()` every other abort path (RESET token,
pointercancel, lostpointercapture, blur, visibilitychange, Escape) already
uses. This is purely reusing that existing gate/path, generalized past
Reference-only.

**Tests added** (`src/screens/GameScreen.physicalDragOverlay.test.tsx`,
mounting the real `GameScreen` + real `gameReducer`, not a mock):
Mozzarella drag start → overlay opens → stale pointerup places nothing;
Basil, same path; overlay close restores normal physical drag (a fresh
drag afterward places correctly); a drag that finishes before any overlay
opens still places normally (no over-cancellation).

## P2-B — Fixed Bake CTA above modal overlays

**Finding:** `.prepare-bake-bar` had `z-index: 40`, above
`.dex-overlay`/`.shop-overlay` (20, shared class) and
`.reference-preview__backdrop`/`.mission-overlay` (25, shared value) — so
Bake/Reset/hint stayed visually and interactively on top of any open
modal.

**Fix** (`src/App.css`): lowered `.prepare-bake-bar` to `z-index: 10` —
below every modal backdrop in the app, still above ordinary in-flow
PREPARE content (`z-index: auto`) and `.app-header` (5, which never
overlaps it spatially). No other overlay z-index changed.

**Verification:** jsdom does not apply stylesheets (existing project
convention, see `IngredientTray.palette.test.tsx`'s own note), so this is
confirmed in the 390x844 headless-Chromium pass below via
`document.elementFromPoint` at the Bake button's own coordinates, for
each of Dex/Shop/Reference: open → inaccessible, close → restored.

## Tests added

- `src/components/IngredientTray.palette.test.tsx`: +9 tests (P1 paging).
- `src/screens/GameScreen.physicalDragOverlay.test.tsx`: +4 tests (P2-A), new file.
- **Total: 460 tests** (up from the pre-fix 447), 0 regressions.

## Verification

- `npm ci` — clean install
- `tsc -b` — clean
- `oxlint` — clean
- `vitest run` — **460/460 passed** (33 files)
- `vite build` (production) — clean
- `git diff --check` — clean

### Browser verification (390x844, headless Chromium)

Golden path — HOME → GAME → Margherita → Sauce → Cheese → Mozzarella x3 →
Topping → Basil x2 → Bake:
- vertical scroll = 0, horizontal scroll = 0
- Bake CTA visible throughout
- 0 console errors

Independent Review regression coverage (all PASS, 22/22 checks):
- 7th owned ingredient (onion, via injected save) reachable: page nav
  appears only once topping owns 7, onion hidden on page 1, revealed and
  selectable on page 2, no scroll introduced.
- Dex overlay lifecycle: normal PREPARE → Bake on top; Dex open → Bake
  inaccessible (`elementFromPoint` resolves to the overlay, not Bake);
  Dex close → Bake restored.
- Shop overlay lifecycle: same pattern, PASS.
- Reference overlay lifecycle: same pattern, PASS.
- Stale physical drag under an overlay cannot commit: for both Mozzarella
  (Dex) and Basil (Shop) — real `PointerEvent`s dispatched with an
  explicit `pointerId` confirm the drag session actually starts
  (`.ingredient-chip--grabbing` / `.piece-drag-preview` present), the
  overlay opens mid-drag, and the stale `pointerup` over a valid drop
  point places nothing; after closing the overlay, a fresh drag on the
  same chip places normally.

## Preview deploy

- **Preview repository:** `perusonao/teto-pizza-game-preview`
- **Preview URL:** https://perusonao.github.io/teto-pizza-game-preview/
- **Deploy pipeline used:** the repo's existing `workflow_dispatch`
  pipeline — `Build & deploy a source PR/branch`
  (`.github/workflows/deploy-from-source.yml`), run with
  `ref=2ce72c7cc854dd3d41fe3a37dbdab82cbada36d3`, `pr_number=26` — followed
  by a manual `workflow_dispatch` of `Deploy Preview to GitHub Pages`
  (`.github/workflows/pages.yml`), since a push made with the deploy job's
  own default `GITHUB_TOKEN` does not cascade-trigger other workflows
  (GitHub's standard anti-recursion behavior) — the automatic push→Pages
  chain the workflow's own comment describes does not fire in that case,
  so this step needs to be triggered explicitly each time.
- **Deploy commit (`teto-pizza-game-preview`, `main`):** `b85faedfd6d6b874e72686ab97bfed81b15ff7bf` ("Deploy preview: 2ce72c7cc854dd3d41fe3a37dbdab82cbada36d3 (2ce72c7)")
- **Pages deploy run:** https://github.com/perusonao/teto-pizza-game-preview/actions/runs/34988237912 — `success`
- **Preview badge:** `PreviewBadge.tsx` renders `PREVIEW · PR#{VITE_PREVIEW_PR} · {VITE_PREVIEW_SHA}` whenever `VITE_PREVIEW_MODE` is set. The deploy workflow set `VITE_PREVIEW_PR=26` and `VITE_PREVIEW_SHA` to `git rev-parse --short HEAD` of the checked-out source (`2ce72c7`), so the live badge reads **`PREVIEW · PR#26 · 2ce72c7`**. This session's network egress is sandboxed and cannot reach `perusonao.github.io` directly to screenshot it live — confirmed instead via the deploy workflow's own build inputs/outputs (the exact mechanism the badge is generated from) and its `success` conclusion; the user can open the preview URL directly to see it rendered.
- Production `main` / production GitHub Pages: **untouched**. Preview/production save isolation (`VITE_PREVIEW_MODE`-scoped key) unaffected by this round.

## Scope guard

Confirmed untouched by this round's diff (`src/App.css`, `src/App.tsx`,
`src/components/IngredientTray.tsx`, `src/components/IngredientTray.palette.test.tsx`,
`src/screens/GameScreen.tsx`, new `src/screens/GameScreen.physicalDragOverlay.test.tsx`):
save schema, legacy authoritative scoring, star thresholds, Dex BEST
semantics, Mission logic, Pitz economy, Shop purchase semantics,
progression semantics, Sauce gesture/scoring, Reference scoring formula.
No `state/gameReducer.ts`, `state/pizzaState.ts`, `state/persistence.ts`,
`logic/economy.ts`, `logic/mastery.ts`, `mission/*`, or `data/*` files were
touched.

## CI status

- `build` check on PR #26 HEAD (`2ce72c7`): **success**
  (https://github.com/perusonao/teto-pizza-game/actions/runs/34987942109)

## Review thread status

All 4 Independent Review threads on PR #26:

1. **RESET_PIZZA mid-drag (P2, prior round)** — already resolved before
   this round; unaffected, re-verified no regression.
2. **P1 — purchased onion unreachable** — fix pushed at `2ce72c7`; replied
   with root cause/fix/tests/verification; **resolved**.
3. **P2-A — physical drag survives Dex/Shop overlay** — fix pushed at
   `2ce72c7`; replied with root cause/fix/tests/verification; **resolved**.
4. **P2-B — fixed Bake CTA above modal overlays** — fix pushed at
   `2ce72c7`; replied with root cause/fix/tests/verification; **resolved**.

`@codex review` re-requested on PR #26 after all four replies.

## Remaining blockers (as of the P1/P2-A/P2-B round)

None identified. PR #26 is not merged (per this round's explicit
instruction) — it awaits the re-review this round requested.

## FINAL VERDICT (P1/P2-A/P2-B round)

**A. READY FOR CODEX RE-REVIEW**

---

## Final P2 follow-up — Clamp grace drops inside the reducer boundary

The Codex re-review of HEAD `7aa3d6cdddd899426fd970e97842ef2d5d04f8ec`
resolved all three prior findings and surfaced exactly one new finding,
P2 (no P1).

- **Reviewed HEAD:** `7aa3d6cdddd899426fd970e97842ef2d5d04f8ec`
- **Fix SHA (pushed to PR #26 head):** `7392a42ac0a5e2870afb282f58b6dc20b5d96bc5`

### Finding

For a drop in the piece-drop edge-grace annulus (`48 < distance <= 52`
dough-percent units) at many non-axis angles, `clampToDough`
(`src/logic/pizzaCoordinates.ts`) could return a point whose recomputed
`Math.hypot` distance from center was a hair over `DOUGH_RADIUS` (e.g.
`48.00000000000001`). `resolvePieceDrop` (`src/logic/pieceDrag.ts`)
treated that as a valid drop and showed a valid preview, but
`gameReducer`'s `PLACE_TOPPING` handler subsequently rejected the
identical coordinates because `isInsideDough` requires `distance <=
DOUGH_RADIUS` exactly — a rim drop that looked placeable in the preview
sometimes silently placed nothing on release.

### Root cause

`clampToDough` scaled by `DOUGH_RADIUS / distance` and returned
`{ DOUGH_CENTER + dx*scale, DOUGH_CENTER + dy*scale }`. Reconstructing the
distance from that result via a fresh `Math.hypot` call doesn't always
invert the scale exactly in IEEE-754 double precision — reproduced by
sweeping every angle 0–359.99° at several grace-annulus distances: 43,549
of the sampled angle/distance pairs rounded to *over* `DOUGH_RADIUS`, with
a worst observed overflow of `~2.8e-14` (at 52 units, ~22.31°).
`isInsideDough`'s reducer-side check and `clampToDough`'s preview-side
projection were each internally consistent but not consistent *with each
other* at that precision.

### Fix

`src/logic/pizzaCoordinates.ts`: added `CLAMP_INSET_EPSILON = 1e-9` and
changed `clampToDough`'s scale from `DOUGH_RADIUS / distance` to
`(DOUGH_RADIUS - CLAMP_INSET_EPSILON) / distance`. Re-running the same
angle/distance sweep with this margin: **0** overflow cases (checked up
to distance 1000, far beyond anything `resolvePieceDrop` ever passes in),
with a maximum inward shift of `~1e-9` dough-percent — many orders of
magnitude below one visible pixel or one `toFixed(2)` rendering unit.
`isInsideDough`/`DOUGH_RADIUS` themselves are untouched — the reducer's
boundary is not loosened; the guarantee comes entirely from the clamp
side landing a hair inside it, so preview and reducer share one
consistent contract instead of two separately-tuned tolerances.

### Tests added (`src/logic/pieceDrag.test.ts`, +13 tests, all in the existing file)

- Updated the one pre-existing hardcoded exact-`98` grace-clamp assertion
  to `toBeCloseTo` (the point now legitimately lands `~1e-9` inside `98`,
  not exactly on it).
- **Invariant fuzz test:** every point `clampToDough` returns satisfies
  `isInsideDough`, swept across all angles (0–359°) and 8 distances
  (48.001–100).
- +X axis, +Y axis, 45°, and 30° grace drops each individually confirmed
  inside the boundary.
- The exact worst-case angle/distance found while reproducing this
  finding (52 units @ 22.31°) pinned directly, plus a dedicated "inward
  shift stays under 1e-6" assertion.
- Multiple grace-annulus distances (48.001–52) at a fixed non-axis angle
  (30°).
- A drop past the edge-grace boundary (`DOUGH_RADIUS + PIECE_DROP_EDGE_GRACE
  + 0.5`) remains rejected by `resolvePieceDrop` (no loosening of the
  outer boundary).
- An ordinary inside-dough drop (no clamping) is unaffected.
- `gameReducer` `PLACE_TOPPING` integration tests (real reducer, not
  mocked) for **both Mozzarella and Basil**: the pinned worst-case
  angle/distance now places (`toppings.length === 1`,
  `placement.status !== "rejected"`), and a spread of 5 grace
  distance/angle combinations across both ingredients all place
  successfully in sequence.
- Sanity-checked by reverting the fix locally: 6 of the new/updated tests
  failed exactly as expected (including both reducer-level
  Mozzarella/Basil "always places" tests going from length 1 to length 0),
  confirming the tests isolate this specific inconsistency.

### Total tests

**473/473 passing** (up from 460 going into this round).

### Verification

`tsc -b`, `oxlint`, `vitest run` (473/473), `vite build`, `git diff
--check` — all clean.

### Browser verification (390x844, headless Chromium)

- Golden path (HOME → GAME → Margherita → Sauce → Cheese → Mozzarella x3
  → Topping → Basil x2 → Bake) unaffected: 0 vertical/horizontal scroll,
  Bake CTA visible, 0 console errors.
- Real dispatched `PointerEvent`s (exact fractional `clientX`/`clientY`,
  dispatched on the pointer-captured chip element to mirror native
  capture routing) driving a physical drag to a grace-annulus point 51.9
  dough-percent units from center, swept across **19 angles** (0° through
  337.5°) for Mozzarella and 2 angles for Basil: every case showed a
  **valid preview** before release and **committed** on release
  (`before=0`/`after=1` topping count each time), 0 console errors —
  **63/63 checks passed**.

### Unresolved threads

**0** after this round. The single new P2 thread
(`discussion_r4017391946`) was replied to with root cause/fix/tests/SHA
and resolved.

### CI

`build` check green on PR #26 HEAD `7392a42ac0a5e2870afb282f58b6dc20b5d96bc5`;
`mergeable_state`: `clean`.

### Re-review requested

`@codex review` requested on PR #26 after the reply/resolve.

### Merge status

**Not merged.** PR #26 remains open, awaiting this round's re-review.

## FINAL VERDICT (Final P2 boundary-fix round)

**A. READY FOR FINAL CODEX RE-REVIEW**
