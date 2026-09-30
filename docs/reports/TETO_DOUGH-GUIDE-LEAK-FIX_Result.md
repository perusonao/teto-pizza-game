# Dough Guide Leak Fix — Result Report

Cooking Interaction 2.0 / OD-CI-1. Slice 1 of the Fresh Audit (`claude/cooking-interaction-fresh-audit-18pfmn`).
Base: main `5c8190ff8e0e094baab6e563e06e1a11c16c4a57` (PR #275 merged).

## Problem
Owner saw two dashed guide rings on the DOUGH step of guided Margherita, but one ring on FREE Cooking. Both showed the
same hint ("生地を伸ばしたり縮めたりして形を整えよう"), so the inner ring read as a pass band.

## Root cause
- Outer ring (`.dough-target-guide`, r = `DOUGH_RADIUS` 48) is the DOUGH guide, rendered on `isDoughStep && interactive`.
- Inner ring (`.sauce-target-guide`, r = `SAUCE_TARGET_RADIUS` 40) is the **sauce** target guide, rendered on
  `referenceModeEnabled && interactive` with **no `makingStep` condition**. It was added before the DOUGH step existed
  (Issue #33 D1) and was never phase-gated. All 25 recipes now have a Reference, so every recipe-based non-Lunch-Rush
  round showed it on DOUGH, CHEESE, TOPPING and CUT as well. FREE Cooking has no Reference, hence one ring.
- It is a display bug from a missing phase gate, not a game rule (OD-CI-1). The ring never affected dough judgment,
  scoring, the Completion Gate, or state.

## Fix
`src/components/PizzaStage.tsx`: the sauce guide is rendered only when `makingStep === "SAUCE"` (one condition + comment).
No change to scoring, dough behavior, sauce behavior, state, or save.

## Regression coverage
- `src/components/PizzaStage.targetGuides.test.tsx` (18 tests): FREE Cooking / guided (margherita, capricciosa) / Dinner /
  Lunch Rush x DOUGH, SAUCE, CHEESE, TOPPING, CUT. DOUGH has no `.sauce-target-guide`; SAUCE has it only for guided rounds;
  CHEESE/TOPPING/CUT have neither guide; a non-interactive stage has neither. Verified: 6 tests fail without the fix.
- `e2e/dough-guide-leak-fix.spec.ts`: real browser at 390x844 and 360x800 for guided Margherita, FREE Cooking, Lunch Rush,
  Dinner. Verified: the 2 guided cases fail without the fix.
- Dinner is a recipe-free round and never showed the sauce guide (the Fresh Audit's earlier "2 rings on Dinner" estimate was
  wrong; measured 1).

## Human Verification
Human Verification: **PASS**

| Video | Viewport | Format | Duration | Size | Verification |
|---|---|---|---:|---:|---|
| `guided-margherita-dough-sauce-cheese-390x844.webm` | 390×844 | WebM / VP8, 25 fps | 13.84 s | 329,005 B | PASS |

Flow (guided Margherita, real interaction, whole screen recorded):
- DOUGH: dough guide 1 / sauce guide 0 (single outer ring; the former inner ring is gone)
- complete DOUGH, tap 次へ
- SAUCE: dough guide 0 / sauce guide 1 (the needed sauce guide is kept)
- CHEESE: dough guide 0 / sauce guide 0

Video Verification: PASS (file exists, size > 0, plays to the end, full 390×844 viewport recorded, operations visible,
Acceptance Criteria judgeable from the video; frames at 3 s / 9 s / 12 s inspected).

Download: submitted directly in the session (not committed to the repository, per the policy §6).

### Why WebM instead of MP4 (policy §5)
TETO_HUMAN-VERIFICATION-POLICY.md §5 allows WebM when MP4 is not possible ("MP4化できない環境ではWebMでも可。その場合は
Result Reportに理由を明記する"). The only ffmpeg in this environment is the Playwright-bundled one
(`/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux`), which has only the VP8 encoder (`libvpx`) and the `webm` muxer; it has no
H.264 encoder and no mp4 muxer, so it cannot produce MP4/H.264. No system package was installed and the environment was not
changed. The Owner approved this WebM substitution.

### Screenshots (committed)
`docs/reports/screenshots/dough-guide-leak-fix/{before,after}/` at 390×844 and 360×800, for guided / FREE Cooking /
Lunch Rush / Dinner. Guided DOUGH: before 2 rings, after 1 ring. `before/guided-sauce-*` is absent because the e2e stops at
its DOUGH assertion without the fix; the SAUCE view is unchanged by the fix.

## Scope exclusions
Not changed: BAKE, CUT, sauce behavior, CHEESE step, scoring, dough behavior, state, save, other open PRs
(#319 / CUT-S2 branch untouched). Fresh Audit report and Owner Decision docs are not part of this PR.

## Known existing issue (recorded only, out of scope)
On the CHEESE step the hint still reads 「指でなぞってトマトソースを塗ろう！」 (seen in the HV video). Pre-existing, unrelated to
the guide leak; intentionally not fixed here.
