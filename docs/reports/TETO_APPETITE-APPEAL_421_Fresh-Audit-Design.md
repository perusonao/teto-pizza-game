# Issue #421 — Finished Pizza Appetite Appeal: Fresh Audit + Pilot Design

- Status: **READ-ONLY audit + design proposal. docs-only. No production code, no deploy, no PR merge.**
- Base: `main` `8cb5d72` (branch `claude/issue-421-appetite-appeal-design`)
- Written: 2026-10-11
- HV policy: docs-only / audit-only, so no video or screenshots (`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`
  §2; `docs/PROJECT_HANDOFF.md` "Audit-only tasks are exempt").
- Everything below was read from source on `main`. **No rendered screenshot was taken**, so "looks like X" statements are
  code-derived predictions to be confirmed in step 1 of §7.

## 1. Duplicate check (done before any design)

| Item | State | Relation to #421 |
| --- | --- | --- |
| #186 Finished Pizza Visual 2.0 (issue) / #187 PR-E | closed | The base this builds on. Left cheese unchanged on purpose (`TETO_GAMEPLAY-UX_PR-E_FINISHED-PIZZA-VISUAL-2_Result.md`, "Cheese: left unchanged"). |
| #176 Gameplay UX / Scoring 3.0 (umbrella) | open | Parent theme; no overlapping task. |
| #419 Bake Human Feel / PR #466 | open | Changes **how fast / which way the needle moves**, not how `heat` maps to a look. See §5. |
| #418 Pizza Cutting Human Feel / PR #425 | closed | The lane gate in #421 ("start after #418") reads as satisfied; Owner to confirm. |
| #467 | open, low priority | Android/LINE piece rendering; parked by Owner. Constrains §6 (no new filters). |

Searches for cheese / melt / 溶けた / "Appetite Appeal" / 焼き上がり over issues and PRs found no other open issue or PR
for this work. 20 other PRs are open; by title none relates to bake visuals (they are docs/audit, progression, hint, CI and
dough-guide work). A file-level overlap check of those 20 PRs against `bakeVisual.ts` / `PizzaStage.tsx` / the cheese-sauce-crust CSS was
**not** done; repeat it right before the implementation phase starts.

## 2. Why the cheese does not read as melted (root cause, from code)

Bake look is driven by one authority, `computeBakeHeat(progress, bakeTarget)` (`src/logic/bakeVisual.ts`): 0 at 0%, 1 at the
recipe's target centre, 2 at 100%. `PizzaStage.tsx` (~L939-952) turns it into per-frame inline style.

For **cheese** (`cheeseVisualFrame`, 5 keyframes) the entire "melt" is:

1. a uniform `transform: scale()` from 1 to **1.16** (reached at heat 1.0, then held), and
2. a colour `filter`: `brightness / saturate / sepia` (sepia tops out at 0.14 on "good").

What does **not** change at any heat (`.pizza-cheese--mozzarella`, `src/App.css` ~L783):

- the **silhouette**: same 28×23 px rounded blob, same `border-radius`; scaling 16% keeps the outline identical;
- the **crisp white ring** `box-shadow: 0 0 0 1.5px rgba(255,255,255,.8)` and the inset highlight, which stay at full
  strength; a hard bright outline is the opposite of a "soft outline";
- the **surface**: no pooling, no irregular spread, no localized browning. Only a global tint.

So "baked" mozzarella is the raw blob, 16% bigger and slightly yellower. That matches Owner's report.

Other findings:

- `meltIntensity(heat)` (0 → 1 over heat 0.5-0.9) **is exported and unit-tested but not used by any renderer**
  (`grep` finds it only in `bakeVisual.ts` and its test). It is a ready, already-tested melt scalar, so the Pilot needs **no new
  doneness state** (satisfies "no duplicate raw/baked authority").
- `toastIntensity` is likewise exported and tested but unused by any renderer. Of the intensity helpers, only
  `charIntensity` and `rawSheenIntensity` are consumed (`PizzaStage.tsx` L967-968).
- **Sauce** is coloured by a *discrete* rule, not by `heat`: `.pizza-dough--raw` / `--perfect .pizza-sauce-layer`
  (`src/App.css` ~L426-440) pick `saturate/brightness/hue-rotate` from the 3-bucket `classifyBake` class
  (`PizzaStage.tsx` L1223), and there is **no `--burnt` rule at all**. Two consequences: the sauce look **snaps at the scoring
  boundary**, the exact "answer reveal" that `bakeVisual.ts`'s header says M3A removed for dough/cheese/toppings (sauce was not
  converted); and there is no gloss, no deepening toward dark red, no uneven browning. Replacing it with a `heat`-driven
  value is therefore both an appetite fix and a consistency fix. (Whether the snap is visible depends on the Guide being
  hidden; to be confirmed visually.)
- **Crust** colour is a smooth two-stop radial lerp (`doughVisualColors`). That gives a golden average, but no *local* browning
  or puffiness until char spots appear at heat > 1.6 (i.e. only when burnt).

## 3. Pilot design (minimal diff, CSS/DOM only)

Single rule for all three: **a new look reads only `heat` (or the existing `meltIntensity` / `toastIntensity`), exposed as
CSS custom properties with defaults that equal today's look.** At heat 0, and in every non-bake context (Reference views,
`PizzaVisualPieces`, PREPARE), nothing changes. This is the same pattern as `--bake-melt-scale` (default 1).

### 3.1 Mozzarella: raw white lump → irregular, soft, lightly browned spread

Driven by `--bake-melt` (= `meltIntensity(heat)`) and `--bake-toast` (= `toastIntensity(heat)`), set inline next to the existing
`--bake-melt-scale`:

- **Silhouette**: widen the `border-radius` toward a more irregular shape and flatten (non-uniform scale: wider than tall),
  mixed with `calc()` on `--bake-melt`.
- **Soft edge**: fade the white ring's alpha with `--bake-melt` (`rgba(255,255,255, calc(.8 * (1 - var(--bake-melt))))`) and
  let the drop-shadow soften.
- **Spread / pooling**: one `::after` pseudo-element behind the blob, an irregular multi-stop `radial-gradient` in a slightly
  deeper cream, `opacity` and `scale` from `--bake-melt`. It lives inside the cheese element, so **CUT pieces clip it with the
  cheese automatically** (pieces are full body copies clipped by `clip-path`).
- **Restrained browning**: one `::before` with 2-3 small `radial-gradient` golden-brown spots, `opacity` from `--bake-toast`.
- Other cheeses (gorgonzola / parmigiano / fontina) keep today's rule in the Pilot; the CSS is scoped to `--mozzarella`.

### 3.2 Tomato sauce: deeper red, natural gloss, uneven browning

- Replace the discrete `.pizza-dough--raw/--perfect .pizza-sauce-layer` filters (§2) with a `heat`-driven inline value
  (same pattern as `toppingPieceStyle`), keeping today's look at heat 0 and at the target centre. Add `--bake-heat-norm`
  (0..1) to the sauce layer; layer a `background-blend` / overlay: a deeper-red tint and a soft
  glossy highlight (`radial-gradient`, low alpha) that appears past heat ~0.5, plus a faint low-frequency mottling
  (`conic`/`radial` gradients, **no SVG `feTurbulence`**; see §6).

### 3.3 Crust: golden, local browning, puffiness

- Keep `doughVisualColors`. Add a rim-weighted `radial-gradient` of darker golden patches, `opacity` from `--bake-toast`
  (appears at "good", before char spots, which stay as they are for burnt).
- Puffiness: a subtle inner highlight on the crust ring (inset `box-shadow`), strength from `--bake-toast`.

### 3.4 Files expected to change (implementation phase only; none changed here)

`src/logic/bakeVisual.ts` (+ its test): export the two scalars as CSS values; `src/components/PizzaStage.tsx`: add the two
custom properties to `cheeseStyle` and the sauce/crust style (~L946, small hunk); `src/App.css`: the `.pizza-cheese--mozzarella`
block (~L783-790), the sauce layer, the crust ring. `IngredientPieceVisual.tsx` is not needed.

## 4. Acceptance criteria mapping

| #421 criterion | How the design meets it | Evidence to produce later |
| --- | --- | --- |
| Raw vs baked mozzarella clearly different | silhouette + ring + pool + spots change with heat | before/after 390×844 screenshots at heat 0 / 1 / 1.6 |
| Baked cheese looks naturally melted | irregular spread, soft edge | iPhone HV video |
| Sauce / crust look naturally baked | §3.2, §3.3 | same |
| CUT / RESULT keep the baked look | effects are in the cheese/sauce/crust elements, which pieces already copy | CUT + RESULT screenshots; existing `PizzaStage.pieces` tests |
| No gameplay / scoring / save regression | no change to `classifyBake`, scoring, save, economy | existing suites unchanged; new tests only on pure functions |
| Owner HV PASS | iPhone | Owner |

## 5. Conflict analysis with PR #466 (head `3e22563`)

#466 changes: `BakeOverlay.tsx`, `bakeProgress.ts` (+tests), `App.css` at ~L1489 (`.cta-button--glow` removal), ~L1606
(`.bake-gauge__zones`), ~L1640 (needle colour), e2e files, and a result report. Verified from the PR file list/patch.

- `bakeVisual.ts`, `PizzaStage.tsx`, the cheese/sauce/crust CSS (~L330-440, L755-845): **not touched by #466**
  (its `App.css` patch has exactly three hunks, listed above) → no textual
  overlap; the `App.css` hunks are ~650 lines apart, so git merges them cleanly.
- Semantic dependency: #466 changes how the needle reaches a position (7 s, one-way, stops at the right end); the design
  keys on `heat`, i.e. on *where* the needle is, so it is unaffected by the speed change. If the needle now rests at the
  right end (heat 2, "charred" look), the Preview must be judged at the player's **confirmed** position; recorded in §7.
- Rule for the implementation phase: do not edit `BakeOverlay.tsx`, `bakeProgress.ts`, or `App.css` lines owned by the gauge.
  Rebase on `main` after #466 merges; no stacking on #466.

## 6. Risks / constraints

- **No new `filter` layers on ancestors of the pieces, no SVG filters.** #467 (parked) suspects the SVG lighting filter on
  `.pizza-pieces` and/or nested clip-paths on Android/LINE; this design adds only gradients, `box-shadow` and pseudo-elements
  inside the existing cheese element. The existing per-element `filter` on cheese is unchanged.
- Performance: heat changes every frame during BAKE. Pseudo-elements animate only `opacity` / `transform` (compositor-friendly);
  avoid animating `border-radius` per frame on many pieces. Need a check on a mid-range device (open item).
- Reference views must not change: all new variables default to today's values, and a test pins heat = 0 / no-bake equality.
- Large catalogs: 55+ recipes; cheese count per pizza can be high. Pseudo-elements double the node-paint work for cheese;
  measure on the biggest cheese recipe (e.g. quattro-formaggi) before committing to the pool layer.

## 7. Next steps and open questions for Owner

Next (read-only until Owner says go):

1. Take rendered before-screenshots on `main` at heat 0 / 0.6 / 1.0 / 1.6 / 2.0 (390×844) to confirm §2 visually.
2. Prototype §3.1 behind a Preview-only switch in a separate branch off `main`; compare on iPhone.

Questions:

- **Q1.** Is the #418 gate satisfied (PR #425 closed), so the implementation lane may start after Owner approves this design?
- **Q2.** How far should "melted" go: soft restrained (this design) vs a stronger stretchy/pooled cheese?
- **Q3.** Pilot scope: mozzarella only (this design), or also cheddar / goat cheese in the first PR?
- **Q4.** After #466, judge the look at the confirmed needle position only (not at the rest position)?
