# Issue #421 — Mozzarella melt Pilot: Result Report

- Status: **implemented and locally verified. Not deployed, no PR, not merged. Owner iPhone HV is still required.**
- Branch: `claude/issue-421-mozzarella-melt-pilot` (on `claude/issue-421-appetite-appeal-design`, on `main` `8cb5d72`)
- Design baseline: `TETO_APPETITE-APPEAL_421_Fresh-Audit-Design.md` (same directory).
  The other design branch `claude/issue-421-finished-pizza-appeal` (`TETO_FINISHED-PIZZA-APPEAL_421_Design.md`) reached the
  same diagnosis; it is **not** carried forward as a second document. Where it differs, this Pilot follows the Owner decision:
  it reuses the existing `meltIntensity` / `toastIntensity` / `charIntensity` instead of adding a new `meltAmount`, and it is
  mozzarella-only (sauce / crust are out of the Pilot). Its risk notes (paint cost of many cheese pieces, DOM golden,
  Preview slot) are kept in "Remaining risks" below.

## What changed (Owner decisions 1-7)

| Decision | Implementation |
| --- | --- |
| 1 Mozzarella only | The look lives in `.pizza-cheese--mozzarella` only (`src/App.css`). Gorgonzola / parmigiano / fontina rules are untouched. |
| 2-3 Clearly stronger melt, not just a uniform scale | Outline morphs to a wider lopsided blob (`border-radius`), the crisp white ring fades out, lumpy cream lobes bleed out in 5 directions (`box-shadow`), a soft gloss appears, the shape is wider and a little flatter (non-uniform `scale`), and uneven soft browning blotches appear (`radial-gradient` ellipses): golden when toasted, dark when charred. |
| 4 Cheese kind stays recognisable | Mozzarella stays cream-white; only mozzarella gets this look, gorgonzola keeps its blue veining. |
| 5 Reuse the existing scalars, ready for other cheeses | `cheeseMeltLook(heat)` (`src/logic/bakeVisual.ts`) is exactly `meltIntensity` / `toastIntensity` / `charIntensity` (pinned by a unit test). `PizzaStage` sets `--bake-melt` / `--bake-toast` / `--bake-char` on **every** cheese; a later cheese opts in by reading them in its own CSS rule. |
| 6 No new SVG filter / clip-path | Only gradients, `box-shadow`, `border-radius`, `transform`. Nothing is added to `.pizza-pieces` or any ancestor of the pieces, so #467's suspects are not touched. |
| 7 No scoring / save / economy / CUT change | None of `classifyBake`, scoring, save, economy, CUT geometry or piece clipping changed. |

Files: `src/logic/bakeVisual.ts` (+ test), `src/components/PizzaStage.tsx` (3 style properties + 1 derived value, ~7 lines),
`src/App.css` (the mozzarella rule), `src/components/PizzaStage.bakeVisual.test.tsx`, `e2e/mozzarella-melt-421.spec.ts`.

Raw look is unchanged: the three variables default to 0 wherever they are not set (tray, Reference, thumbnails, PREPARE), and
at 0 every expression collapses to the previous value. The raw rows in the images are visually identical before / after.

## Evidence

Before = `main` `8cb5d72`, after = this branch; same e2e spec, real Chromium, DPR 3, needle stepped with the faked clock.
Margherita `bakeTarget` is { 60, 80 } (centre 70 = heat 1).

- `docs/reports/screenshots/finished-pizza-appeal-421/compare-cheese-closeup-390x844.png`, `...-360x800.png`:
  raw (needle 0) / melting (56) / properly baked (70) / deep (80) / overbaked (98), before left, after right.
- `.../compare-cut-result-390x844.png`, `...-360x800.png`: CUT (6 pieces) and the RESULT page, before / after.

Observed: raw is identical; from melting on the cheese loses the white ring and spreads irregularly; properly baked is a soft
glossy spread with light golden blotches; deep has clearly browned blotches; overbaked keeps the spread with dark blotches (the
existing grey tint and char spots of the pizza are unchanged). The CUT pieces and the RESULT page carry the same baked cheese.
No horizontal overflow at 390x844 or 360x800; the RESULT page layout is unchanged.

## Verification (local)

| Check | Result |
| --- | --- |
| `tsc -b` | pass |
| `oxlint` on all touched files | no findings |
| Full vitest | 380 files, 6992 passed, 1 skipped (the same skip as on `main`) |
| New unit tests | `cheeseMeltLook` (equals the 3 existing intensities, raw = zeros, monotonic, in [0,1], melts before it browns); PizzaStage sets the variables only in BAKE/CUT/RESULT, also on non-mozzarella cheese, never on other toppings |
| New e2e (`mozzarella-melt-421.spec.ts`), 390x844 + 360x800 | 4 passed: computed outline / shadow / transform differ from raw once melted, and the transform is anisotropic (not a uniform scale); CUT pieces and RESULT keep the melt; no horizontal overflow |
| Related existing e2e (finished-pizza-visual-2.0, pizza-cutting-phase4b, cut-skip-failed-bake, result-1screen-2.0, cut-regions-427), both viewports | 45 passed, 1 skipped (the skipped test was not investigated) |
| WebKit | **not run**: Playwright WebKit is not installed in this environment; CI's WebKit shards are the authority |

## Conflict check

- PR #466 (head `3e22563`): its `App.css` patch is three hunks (~L1489 / L1606 / L1640: CTA glow, gauge zones, needle colour); this
  change is in the mozzarella rule (~L781). `BakeOverlay`, `bakeProgress`, `PizzaStage`, `bakeVisual.ts` are not touched by #466.
- Other open PRs: #321 touches one line of `PizzaStage.tsx` far from this change; #391 and #105 touch other areas. #34 is a stale
  branch (old base) that edits `.pizza-cheese--mozzarella`; it would conflict regardless, and should be closed or rebased by its owner.
- The Preview was not touched; #466's 7 s Preview is still the published build.

## Remaining risks / open items

1. **Owner iPhone HV is required** (390x844 video + judgement of "looks tasty"); Chromium renders are not iPhone Safari.
2. **WebKit / older WebView unverified here.** The browning colour uses `rgba(calc(...), calc(...), calc(...), calc(...))` (CSS
   math in the legacy comma syntax). Modern Safari / Chrome accept it; an engine that does not would drop the whole `background`
   declaration of the mozzarella rule. CI WebKit shards will show it for Safari; LINE's in-app browser (#467) is unverified.
3. **Paint cost:** 5 extra shadows per mozzarella piece, repeated for every cut piece copy. Not measured on a mid-range device.
4. **Spread vs neighbours:** the melted cheese is wider; mozzarella pieces placed very close together, or next to basil, can touch
   or overlap (visible in the images: two pieces nearly meeting the basil). Judge on the Owner's real placements.
5. Overbaked cheese looks grey with dark blotches (the pre-existing cheese `filter` plus the new spots); it may read as unappetising
   on purpose, but it is a design choice to confirm.
6. Preview deploy is blocked behind #466's HV: the Preview holds one build at a time. No deploy was done.
