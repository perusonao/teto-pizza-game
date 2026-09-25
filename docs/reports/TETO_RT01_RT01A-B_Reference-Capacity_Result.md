# RT-01a / RT-01b — Reference Pizza piece capacity: Result Report

Branch: `claude/rt-01-pizza-piece-capacity-1ncicd` (base main `1e53baa`). No PR and no merge.
RT-01c (the W1 fixtures) has **not** been started.

Design: `docs/reports/TETO_RT01_REFERENCE-PIECE-CAPACITY_Fresh-Design.md`. Owner Decision
RT-01-OD-1 is recorded in §14 of that report.

## Commits

| Step | SHA | Content |
|---|---|---|
| Owner Decision | `745fbd7` | RT-01-OD-1 recorded in the design report and the companion JSON (`verdict: IMPLEMENTATION_READY`). docs/tools only |
| RT-01a | `e708dd2` | `getReferenceSlots(n)` + `assignReferenceSlots()`, not wired into production; frozen BEFORE baseline + tests |
| RT-01b | `afcce51` | `playerReference.ts` / `PizzaThumbnail.tsx` switched to the shared placement; e2e harness + spec; recording script |
| Docs | this commit | Result Report, BEFORE/AFTER screenshots, prototype synced to the final interleave rule |

## Changed files

- RT-01a:
  - `src/logic/pizzaReferenceLayout.ts`
  - `src/logic/pizzaReferenceLayout.test.ts` (new)
  - `src/logic/rt01ReferenceRegression.test.tsx` (new)
  - `src/logic/testSupport/rt01ReferenceBaseline.ts` (new; test-only frozen baseline)
- RT-01b:
  - `src/data/playerReference.ts`
  - `src/components/PizzaThumbnail.tsx`
  - `src/logic/pizzaReferenceLayout.ts` (interleave rule, comments)
  - tests: `src/data/playerReference.test.ts`, `src/components/PizzaThumbnail.test.tsx`,
    `src/data/recipes.test.ts` (two test *titles* only; the "exactly 8 pieces" content
    assertions are kept)
  - `e2e/rt01-reference-capacity.spec.ts` (new)
  - `e2e/harness/rt01-reference.{html,tsx}` and `e2e/harness/rt01-reference-cases.tsx` (new;
    dev-server only, not in `dist/`)
  - `scripts/record-rt01-human-verification.mjs` (new)

Untouched:

- `referencePizza.ts` (Scoring fixtures), `scoringV2/*`, `referenceMatching.ts`
- `persistence.ts`, `recipes.ts` data, `ingredients.ts`
- CSS and workflows
- #220, #221, #222, REC-04, Production Visual P1

No new ingredient or recipe is registered.

## Implementation

- `getReferenceSlots(n)` handles every n:
  - n ≤ 8 returns `PIECE_RING_POSITIONS.slice(0, n)` (copies).
  - n ≥ 9 returns the approved Candidate B multi-ring layout: optional centre + 1–4 rings, outer
    radius 28–34. It picks the most compact configuration that keeps a centre gap of at least
    18.2 dough-% (the 48px mini 見本 piece footprint); if none exists, it picks the widest gap.
  - There is no maximum n. The function is deterministic, depends on n only, and is memoised
    per n; results are returned as copies.
  - The output is **identical to `tools/rt01_reference_capacity_design.py` for n = 1..40**
    (cross-checked).
  - Cost: n = 9–15 takes ≤ 19 ms once, in jsdom.
- `assignReferenceSlots(groups)`:
  - total ≤ 8: the legacy consecutive rule, unchanged.
  - total ≥ 9: interleaved. Groups take turns; a group's first piece takes the first free slot
    (outer ring clockwise from 12 o'clock, centre last). Each later piece takes the free slot
    farthest from that group's own earlier pieces.
  - This is a refinement over the plain round-robin prototype: at 12 pieces, the minimum distance
    between pieces of the same ingredient rises from 19.2 to 34.2, and at 15 pieces from 20.2 to
    34.9. The prototype tool was synced to it, and TS and Python match for 9/10/12/15/16/20.
- `PizzaThumbnail` uses `getReferenceSlots(typeCount)[i]`, which is identical for ≤ 8 types.

## 1–8 parity

- Unit tests: `getReferenceSlots(1..8)` deep-equals the legacy table, and `PIECE_RING_POSITIONS`
  itself is pinned.
- Frozen BEFORE baseline (`rt01ReferenceBaseline.ts`, generated from pre-change code and verified
  green against main's `pizzaReferenceLayout.ts`). The following are **byte-identical after
  RT-01b** for all 15 shipped recipes:
  - `getPlayerReferencePizza().pieceGroups`
  - `<PizzaThumbnail>` markup
- Real-browser pixel comparison (Chromium, DPR 2, both viewports): 38/38 captures are
  **SHA-256 identical** BEFORE vs AFTER. These cover:
  - the 15 shipped recipes (popover, 64, 48 and Recipe Select views);
  - the 8-piece case;
  - the real-app Recipe Select full page and its thumbnail DOM.

  Only the synthetic 9/10/12/15 cases changed. See `sha256-manifest.json` under
  `docs/reports/screenshots/rt-01/{before,after}/`.

## 9 / 10 / 12 / 15 spacing (dough-%)

| n | layout | min gap | max radius | min same-ingredient gap (harness composition) |
|---|---|---|---|---|
| 9 | centre + ring r=28 | 21.43 | 28.0 | 28.0 |
| 10 | centre + ring r=28 | 19.15 | 28.0 | 28.0 |
| 12 | ring r=30 (9) + inner ring (3) | 19.17 | 30.0 | 34.2 |
| 15 | ring r=34 (11) + inner ring r=14 (4) | 19.15 | 34.0 | 34.9 |

- The minimum gap is at least 18.2 for every n ≤ 15, so no pieces touch at the 48px mini
  見本. The popover threshold (10.94) holds through n = 38.
- Every n ≤ 40 gives n distinct points within radius 34.
- The e2e spec checks real rendered piece centres in Chromium and WebKit: at least 18% of the
  box apart at 140, 64 and 48px for 9/10/12/15, and all pieces distinct for the 15 shipped
  recipes.
- The spec was confirmed to **fail against the legacy code** (4 synthetic cases fail) and pass
  after the change.

## Save / scoring invariants

- **Scoring**: the digest of all 15 `getReferencePizza` fixtures is pinned (length 12175,
  FNV-1a `d8d71484`) and unchanged. The ruleset version is unchanged, and no runtime scoring
  target is generated (OD item 6).
- **Save**: `persistence.ts` is untouched, and schema v2 stores no coordinates.

## Validation

| Check | Result |
|---|---|
| Focused tests (layout, regression, playerReference, thumbnail, ReferenceTruth, referencePizza, PlayerReferencePreview, recipes, App.playerReference, PizzaSelect) | 248/248 |
| Full unit, RT-01a | 127 files / 2464 tests PASS |
| Full unit, RT-01b | 127 files / 2474 tests PASS |
| typecheck (`tsc -b`) | PASS |
| lint (`oxlint`) | PASS, 0 warnings |
| build (`vite build`) | PASS; `dist/` contains no harness |
| Chromium E2E (iphone-390x844 + iphone-360x800), clean run at `afcce51` | **124/124 PASS** |
| WebKit Full E2E (4 shards) + **WebKit Gate**, workflow_dispatch at `afcce51` | **success**: https://github.com/perusonao/teto-pizza-game/actions/runs/36102834454 |

About the Chromium runs: the first full run had 2 failures.

- `making-ui-1screen` Margherita failed with `page.reload: net::ERR_ABORTED`. I was editing the
  harness files while the run was in progress, and the Vite dev server was serving them.
- `lunch-rush-result-ranking-phase4` hit its 40s wall-clock timeout.

Both spec files were re-run once with nothing else running: 26/26 passed. The full suite was
then re-run clean on the committed head: 124/124.

## BEFORE / AFTER screenshots

Location: `docs/reports/screenshots/rt-01/{before,after}/{390x844,360x800}/`

- `case-p8` (Meat Lovers, 8 pieces): identical.
- `case-p9`, `case-p10`, `case-p12`, `case-p15`:
  - BEFORE shows 8 spots (1, 2, 4 and 7 pieces stacked).
  - AFTER shows all pieces.
- `app-recipe-select`, `case-meat-lovers`, `case-capricciosa`, `case-quattro-formaggi`:
  identical.
- `sha256-manifest.json`: hashes for all 46 captures per state.

## Human Verification Videos

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| `rt01b-human-verification-390x844.mp4` | 390×844 | 59.3 s | 2.02 MB | H.264 High, yuv420p, 25 fps | PASS |
| `rt01b-human-verification-360x800.mp4` | 360×800 | 59.1 s | 1.89 MB | H.264 High, yuv420p, 25 fps | PASS |

Download: sent directly in this session. Not committed; `artifacts/` is gitignored.

Video Verification: **PASS**. Checks performed:

- the file exists and its size is > 0;
- a full decode (`ffmpeg -f null`) produced no errors;
- the resolution equals the viewport;
- sampled frames show every scene.

What to check in the video:

1. **Recipe Select** (all 15 recipes): the thumbnails of shipped recipes are unchanged.
2. **Meat Lovers (8 pieces)**: the mini 見本 and the popover keep the old layout.
3. **8 pieces BEFORE/AFTER**: identical.
4. **9 pieces**: BEFORE shows 8 spots (1 stacked); AFTER shows 9 spots, a ring plus a centre.
5. **10 pieces** (Portuguesa composition): BEFORE shows 8 spots; AFTER shows 10.
6. **12 pieces**: outer and inner rings. Pieces of the same ingredient are not next to each
   other.
7. **15 pieces**: no touching pieces, even in the 48px mini 見本. The 390×844 and 360×800 videos
   show whether this is legible.

The BEFORE side is a reproduction of the pre-RT-01 `slot % 8` rule, clearly labelled. The
AFTER side calls the live production function.

## Not done (per instruction)

- RT-01c: Parmigiana, Portuguesa and Puttanesca fixtures and recipe registration.
- The 7 new ingredients.
- The W1 recipes.
- PR and merge.
