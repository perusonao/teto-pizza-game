# Teto Pizza Game — Issue #33 D3A Reversible Dough Shaping — Result

**Type:** Implementation, directly from
`docs/reports/TETO_ISSUE-33_D3A_REVERSIBLE-DOUGH_Fresh-Audit.md` (Phase 0, same session/PR per
the task's own instruction).

- **Start SHA (fresh `origin/main`):** `2a2b9b107990e0ff8b7b2c1b30e21baac181080d` (merge of PR
  #64, confirmed merged via GitHub API before starting).
- **Final SHA (PR head):** `8591be0c625ec67f89da2caec98ba57c7dccf93c`
- **Branch:** `claude/reversible-dough-shaping-8o5v4x`
- **PR:** [#65](https://github.com/perusonao/teto-pizza-game/pull/65) — CI green
  (`run 35341060250`, conclusion `success`).
- **Status:** Implementation complete, Preview deployed, Review Playthrough recorded and
  delivered. **Left OPEN, pending Human Review.**

---

## 1. Audited current interaction

Full write-up in the Fresh Audit. Summary: the 8-point radial dough model
(`src/logic/doughShape.ts`), its gesture lifecycle (`src/components/PizzaStage.tsx`), the
reducer boundary (`COMMIT_DOUGH_STRETCH`), and reset/stale-pointer safety were all confirmed
already direction-agnostic. The **only** thing blocking bidirectional shaping was
`lerpTowardAtLeast`'s `target = Math.max(current, distance)` monotonic floor, restated a second
time in the old spike clamp's own lower bound. `DOUGH_RADIUS` (48) was also found to be silently
playing two unrelated roles at once — both the *ideal/reference* target (the guide ring +
completion threshold) and the *only* hard technical ceiling on an individual control point's own
radius — which is why the ideal boundary read as an absolute ceiling the player could never
cross, even though `DOUGH_COMPLETION_THRESHOLD` itself was never actually a gesture-level
hard-stop (it only ever gated the `次へ` CTA's `disabled` attribute).

## 2. Chosen reversible gesture

No new gesture concept. The touch position already directly represented "desired local radius
for this angular region" — dragging from center outward already read as "stretch." D3A keeps
that exact semantic and simply lets it work in both directions: dragging from the rim back
toward center now shrinks the touched region instead of being a no-op. This matches the task's
own example (`中心 → 外側 = 伸ばす`, `外側 → 中心 = 縮める`) with the smallest possible change —
confirmed by the Fresh Audit as the recommended approach over inventing a delta/velocity-based
alternative.

## 3. Min/max behavior

- `DOUGH_SHAPE_MIN_RADIUS = 10` — the shrink floor. Below `INITIAL_DOUGH_RADIUS` (~18.24) so
  shrinking is meaningful, comfortably above 0 so the boundary can never collapse to a
  degenerate point.
- `DOUGH_SHAPE_TECHNICAL_MAX_RADIUS = 58` — the new technical ceiling, decoupled from
  `DOUGH_RADIUS` (48, unchanged, stays the ideal/reference target). Chosen to stay safely under
  the dough box's own diagonal-corner distance (~70.7 dough-percent units) so overshoot on the
  4 diagonal control points remains visible rather than silently absorbed by the DOM's own
  clip-path box edge (which already, for free, flattens any cardinal-axis radius above 50 — see
  the Fresh Audit §2's clip-path analysis).
- Both bounds are enforced identically at the pure-math layer (`applyStretchPoint`'s final clamp)
  and at the reducer boundary (`isValidDoughShape`), the same belt-and-suspenders pattern every
  other committed-payload validator in this codebase already follows.
- **Spike suppression is now symmetric** (`STRETCH_SPIKE_MAX_DELTA = 12`, unchanged value, now
  applied above *and* below the neighbor average) — a single call can't jump a point far past its
  surroundings in either direction. **Fixed during this change**: the clamp now only evaluates a
  point whose falloff weight this specific call is nonzero for; every other point is passed
  through byte-for-byte unchanged. The old D1/D2 code evaluated the clamp against *every* point
  unconditionally, which was harmless only because the old monotonic floor happened to make it a
  no-op for untouched points — removing that floor without this fix would have let one gesture
  retroactively reshape an untouched, already-asymmetric region elsewhere on the dough (see the
  Fresh Audit §5 and the regression test in §5 below).
- **Tiny-gesture guard** (`DOUGH_TINY_GESTURE_EPSILON = 0.5`): a touch whose implied target is
  already within this epsilon of the nearest control point's *current* value is a complete no-op.
  Deliberately defined as "already close to the current shape," not a drag-distance/tap-duration
  heuristic, so the existing (and still desired) "a deliberate tap far from center registers
  instantly" D1/D2 behavior is untouched.

## 4. Ideal boundary vs. technical boundary

Confirmed by the Fresh Audit and unchanged by this PR: the *ideal/reference* boundary
(`DOUGH_RADIUS` / `DOUGH_COMPLETION_THRESHOLD`) was never a gesture-level hard-stop — it only
ever gates the `次へ` CTA's `disabled` attribute (`App.tsx`'s `doughShapeComplete`), and
`CONFIRM_MAKING_STEP` itself remains ungated at the reducer layer (unchanged, still pinned by
`onewayFlow.test.ts`). What *was* effectively a hard-stop before this PR was `DOUGH_RADIUS`
doubling as the only technical ceiling — a player could never visually exceed the guide ring at
all. That is now fixed: `DOUGH_SHAPE_TECHNICAL_MAX_RADIUS` (58) is the one real hard-stop,
strictly for interaction-canvas safety, entirely separate from the ideal/reference target the
guide ring and completion gate still use unchanged. `doughSizeProgress` (mean radius /
`DOUGH_RADIUS`) can now legitimately exceed `1.0` once a shape is pulled past the ideal size, and
nothing clamps it back — pinned by a dedicated test (`doughShape.test.ts`).

## 5. Reset/stale-event proof

No changes were made to `PizzaStage.tsx`'s gesture lifecycle, `COMMIT_DOUGH_STRETCH`'s reducer
guard, or any reset/stale-pointer abort path — the Fresh Audit confirmed all of it was already
direction-agnostic, and the full existing regression suite (`PizzaStage.doughStretch.test.tsx`'s
pointercancel/lostpointercapture/blur-visibilitychange/stale-resetToken/stale-makingStepToken
tests, `onewayFlow.test.ts`'s stale-event/no-fallthrough/carry-through tests) re-ran green
unmodified, which is itself the proof that reversibility didn't touch this surface. Two new
pieces of coverage were added specifically for D3A:

- `doughShape.test.ts`: "shrinking one region never moves an untouched region elsewhere, even
  after that region was itself asymmetrically stretched earlier" — the regression test for the
  spike-clamp scoping fix in §3.
- `PizzaStage.doughStretch.test.tsx`: a mid-drag `やり直す` reset is also demonstrated live in the
  Review Playthrough (§7 scene E) — start a drag, reset while the pointer is still notionally
  down, keep moving/release that same original pointer afterward, and confirm the dough stays a
  fresh, undeformed circle throughout.

## 6. Tests

`npm test`: **1132/1132 passing** (up from 1127 pre-PR, across the same 57 files).

New/updated coverage, per the task's own list:
- outward drag expands — unchanged pinned values (pure expansion math is byte-identical to
  D1/D2, confirmed by inspection: the old floor was always a no-op in the growth direction)
- inward drag shrinks — new pinned fixture (`doughShape.test.ts`) + component-level test
  (`PizzaStage.doughStretch.test.tsx`)
- shrink after expand works — both a pure-math test and a component-level test, plus a
  reducer-level end-to-end test in `onewayFlow.test.ts` ("an over-stretched-then-corrected shape
  commits and carries through to SAUCE exactly as shaped")
- directional/local deformation remains — existing propagation/asymmetry tests re-verified
  unchanged, plus the new spike-clamp-scoping regression test (§5)
- minimum clamp — `doughShape.test.ts` ("minimum clamp: repeated shrink pulls... never go below
  DOUGH_SHAPE_MIN_RADIUS") + `isValidDoughShape` boundary test
- technical maximum clamp — `doughShape.test.ts` ("repeated outward pulls... eventually reach
  DOUGH_SHAPE_TECHNICAL_MAX_RADIUS") + `isValidDoughShape` boundary test
- exceeding the ideal boundary is allowed — three dedicated tests (mid-gesture, mean-progress,
  `isValidDoughShape` acceptance) + a component-level test + Review Playthrough scene C
- tiny gesture no-op — pure-math test + component-level test (both using a touch near the
  shape's *actual settled* radius, not the raw original touch point, since the spike clamp means
  those differ — see the test's own comment)
- pointercancel safety — existing test, unmodified, re-verified green
- reset safety — existing tests, unmodified, re-verified green + Review Playthrough scene E
- stale pointer event no-op — existing tests, unmodified, re-verified green
- DOUGH confirm後 gesture no-op — existing `makingStepToken`-stale test, unmodified, re-verified
  green
- shape persists into SAUCE — existing carry-through tests (through BAKE/RESULT too) re-verified
  green, plus the new end-to-end reversibility test in `onewayFlow.test.ts` and Review
  Playthrough scene D
- retry/new pizza resets correctly — existing `RESET_PIZZA` tests (every making step, every
  entry path) re-verified green, unmodified
- existing Scoring/Pitz/Lunch Rush regression — full suite re-run green; no file under
  `scoring.ts`/`scoringV2/*`/`pitzReward.ts`/`recipes.ts`/`dex.ts`/`progression.ts` was touched

`npx tsc -b`: clean. `npm run lint` (oxlint): clean. `npm run build`: clean (330.21 kB /
103.68 kB gzip preview build; 324.32 kB / 102.45 kB gzip production build).

## 7. Preview deployment

Deployed via `teto-pizza-game-preview`'s existing manual pipeline (unchanged, no new workflow
files):

1. `deploy-from-source.yml` (`workflow_dispatch`) with `ref=8591be0c625ec67f89da2caec98ba57c7dccf93c`,
   `pr_number=65` → run [35341098697](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/35341098697),
   success.
2. `pages.yml` (`workflow_dispatch`) → run [35341155805](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/35341155805),
   success, published commit `c2068966418a155a0facaaa7cb86463490e1467c` ("Deploy preview:
   8591be0c625ec67f89da2caec98ba57c7dccf93c (8591be0)").

**Preview URL:** https://perusonao.github.io/teto-pizza-game-preview/

This sandboxed session's outbound network policy blocks `perusonao.github.io` directly (same
caveat every prior Preview-Gate report for this project documents). To still verify and record
real behavior rather than only trusting the Actions run logs, this session rebuilt **the exact
same source commit with the exact same build command** the workflow used
(`VITE_PREVIEW_MODE=1 VITE_PREVIEW_PR=65 VITE_PREVIEW_SHA=8591be0 vite build
--base=/teto-pizza-game-preview/`, plus the same manifest/`noindex` post-processing read
directly from `deploy-from-source.yml`), served that output locally, and drove a real
headless-Chromium (390×844) smoke test and the full Review Playthrough recording against it —
byte-for-byte the same static bundle now live at the Preview URL.

| Check | Result |
|---|---|
| Preview badge | ✅ `PREVIEW · PR#65 · 8591be0` |
| `noindex` | ✅ `<meta name="robots" content="noindex, nofollow">` present |
| 390×844 no overflow | ✅ `scrollWidth === clientWidth` (390) |
| Console errors | ✅ none during smoke pass |
| DOUGH hint copy | ✅ shows the updated reversibility-aware hint (「生地を伸ばしたり縮めたりして形を整えよう」) |

## 8. Review Playthrough

`artifacts/review/TETO_ISSUE-33_D3A_REVERSIBLE-DOUGH_ReviewPlaythrough.mp4` — MP4/H.264, 390×844,
~24s (not committed to the repo, delivered directly to the user per this project's standard
workflow).

Scenes (recorded against the local rebuild of the exact preview commit, §7):

- **Fresh dough ball**, held ~1.5s after entering PREPARE.
- **E — Reset mid-drag**: a drag begins (dough visibly starts stretching), then `やり直す` is
  pressed *while the original pointer is still down*; that same pointer is then moved and
  released afterward. The dough stays a fresh, small, undeformed circle throughout — no stale
  gesture leaks through.
- **A — Stretch one direction**: repeated outward pulls in one direction produce a clearly
  visible, organically-rounded bulge (held ~1.5s).
- **C — Exceed the ideal/reference size**: continuing the same pull further out visibly crosses
  the dashed guide ring; the dough keeps growing past it instead of being hard-clamped at the
  ring (held ~2s).
- **B — Shrink/correct**: dragging that same region back toward center visibly shrinks it again,
  correcting the over-stretch (held ~2s). The remaining 7 directions are then filled out to a
  natural, mostly-round shape that stays visibly flatter on the corrected side, so the final
  committed shape is a real "imperfect but reasonable" result, not a forced perfect circle.
- **D — Confirm → SAUCE**: `次へ` is pressed; the making step advances to SAUCE and the same
  dough boundary renders underneath, unchanged, confirming the corrected shape carried through
  (held ~2.2s, plus a still screenshot).

## 9. Human Feel — what to confirm

- Does dragging inward to shrink feel discoverable without the hint text, or does it need a
  stronger visual affordance (e.g., a subtle inward-arrow cue) the first time a player tries it?
- Is `DOUGH_SHAPE_TECHNICAL_MAX_RADIUS` (58) — about 21% beyond the ideal `DOUGH_RADIUS` (48) —
  a satisfying amount of "beyond ideal" overshoot, or should it allow more/less visible excess?
- Is `DOUGH_SHAPE_MIN_RADIUS` (10) a satisfying shrink floor, or does it feel like it stops the
  correction short?
- Does the symmetric spike-suppression clamp (unchanged magnitude, `12`, from D2) still feel
  right now that it also governs shrink speed, or does correcting an over-stretch feel too slow/
  too fast relative to how quickly the original stretch happened?
- Is the updated hint copy ("生地を伸ばしたり縮めたりして形を整えよう" / the explicit variant)
  clear enough that shrinking is possible, without becoming a long tutorial?

## 10. Conditions before D3B (scoring integration)

Per the task's own Phase 4 guard, this PR adds **no** Dough scoring, no Scoring 2.0/Pitz/Recipe
reference changes — `canonical doughShape` (the same 8-point radial array, `PizzaState.doughShape`)
is preserved exactly as D1/D2 defined it, so D3B can evaluate roundness/evenness/distortion
directly from the same array with no shape-model rewrite, per `DOUGH_SHAPE_POINTS`'s own original
doc comment. D3B should not begin until:

1. Human Review of this PR's Review Playthrough returns PASS (or a fix round closes any findings).
2. Real-device (iPhone) Human Feel confirms the reversible gesture itself is understandable and
   satisfying — D3A's headless-Chromium verification is not a substitute for that, the same
   caveat D1/D2's own Result report carried before its real-device pass.
3. Any numeric-knob adjustments this review surfaces (§9) are folded in as a small follow-up,
   the same "D1 → D2 Human Feel Fix" pattern this feature has already followed once.
