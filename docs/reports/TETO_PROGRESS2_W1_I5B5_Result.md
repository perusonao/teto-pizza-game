# Progression 2.0 W1 — I5b-5 Verification (Layout Contract) (Result)

Status: **I5b-5 automated verification implemented and green. Human PASS (P-9) and three P1 findings
(F-1..F-3) are with the Owner.** No PR, no merge.

- Branch `claude/teto-pizza-w1-i4a-j46ph0` (the I5b integration line). main `12a09de` is unchanged, and
  I5b-3 / I5b-4 / I5b-4b / W1 are **not** in main (the integration strategy merges the line later).
  Starting HEAD `358f8ae`; production HEAD before this slice `328f84e`.
- Authority: I5b-5 Verification Design `d4f96d0` (§3 profiles, §5 L-A..L-O, §6 matrix, §9 videos,
  §12 evidence, §13 Owner checklist, §14 PASS) and the I5b-5 Preflight
  (`claude/i5b-5-verification-preflight-plndos`, OD-V-1..7, §2..§10). No new layout spec was invented.

## 1. Commits

| Commit | Kind | Summary |
|---|---|---|
| `ae15d8d` | D | Layout Contract helpers (`e2e/support/layoutProfiles.ts`, `layoutInvariants.ts`, `layoutContract.ts`), `e2e/layout-contract.spec.ts` (LC-0..LC-5 + LC-2b), `layout-chromium` project, `bakeToTarget` split |
| `d306eb5` | production fix | Lunch Rush serve screen: CTA out of the bottom inset (L-A P0, §4) |
| `060d8cc` | E | CI: `layout-chromium` job + `Layout Contract Gate`, WebKit LC summary, `layout-gate.sh`, `layout-summary.mjs`, +13 CI script cases, OD-V-6 project guard on 8 tests |
| `460a815` | E (fix) | bake clock helper hardening (pauseAt retry, needle read after commit); trace off on WebKit |
| `7bdc2f9` | E (fix) | LC seeds via init script + Dex-pill assertion (WebKit page-hide overwrite); opt-in report screenshots |
| this commit | F | evidence and this report |

## 2. Layout Contract implementation

- **Profiles** (Design §3.1, inset 47/34 = OD-V-2): N390 390×844, N360 360×800, S390 390×664, S360 360×640,
  P390i 390×844+inset, E390i 390×664+inset, E360i 360×640+inset. `layout-chromium` cycles all 7; each WebKit
  project cycles the N and S profile of its own width (Preflight §2.1). An unknown project throws.
- **Safe-area**: Chromium CDP `Emulation.setSafeAreaInsetsOverride`, cleared with `{}` on every N/S profile
  (the override survives resizes and navigations). `applyProfile` re-checks on **every** switch that
  `innerWidth/innerHeight` and CSS `env(safe-area-inset-top/bottom)` match the profile and throws otherwise
  (no skip, no CSS fallback). LC-0 is the standalone self-check.
- **Measurement**: one `page.evaluate` per sample — slot rects (header, HUD, tabs, order card, stage, dough,
  tray, pager, CTA bar, primary CTA), `elementFromPoint` at the center of the CTA / every visible chip /
  every pager button, a real `scrollBy(0,200)` attempt, scrollable CTA ancestor, unclipped elements past the
  right edge, Range-based line counts.
- **Judgement**: `layoutInvariants.ts` (pure; TOL 1px, 8px gap, HOME CTA ≤2 lines / ≤64 / ≥1.6, 44px). Every
  failing check is an `expect.soft` with `<ID> <what> @<profile> <state>: <actual> (need <expected>) Δ=<px>`,
  plus an annotated screenshot (slot boxes, inset line) of that sample. P0 and any P1 outside the
  Owner-pending register fail the test; L-N is recorded only (OD-V-4).
- **Evidence**: `layout-evidence.json` (schema `teto-layout-evidence/1`) attached to every test, pass or fail;
  config `screenshot: only-on-failure`, `trace: retain-on-failure` (off on WebKit, §6), `video: off`.
  `scripts/ci/layout-summary.mjs` writes the job summary (FAIL rows, Owner-pending rows, L-N table, insets).
- **Flows**: BAKE is measured with `page.clock` paused (`enterBakePaused` / `landNeedleAndTakeOut`, the
  latter direction-aware for "after the guide fade" at +7.3 s); no tap happens while cycling.

| Test | Mount | States measured |
|---|---|---|
| LC-0 | each profile | innerWidth/Height, visualViewport, env() insets; override persists over navigation, cleared on N390 |
| LC-1 FREE | S360 | DOUGH, SAUCE, CHEESE, TOPPING p1/4, hint open, p2/4, p4/4, BAKE start, BAKE after fade, **Discovery Result** (マルゲリータ, 「📖 図鑑を見る」 row) |
| LC-2 guided | N390 | Portuguesa TOPPING (10 pieces), BAKE, CUT, RESULT |
| LC-2b | N390 | New Haven TOPPING, BAKE start / after fade, RESULT — **no CUT tab, no 切り終わる, no cut summary** |
| LC-3 Lunch Rush | S360 | PREPARE TOPPING, BAKE start / after fade, CUT, serve, mission RESULT (all with HUD, L-G) |
| LC-4 HOME | each profile | Dex 0 and Dex 1 (L-H, L-O) |
| LC-5 | N390 | Pizza Select grid (25 cards, L-L), New Haven detail CTA, Shop list scrolled to the end (last row) |

Seeds (all materials owned ×99, `schemaVersion 2`): LC-1 = 24 discovered (all but margherita); LC-2/2b/5 = all
25; LC-3 = `pizza-portuguesa` only (every order is Portuguesa); LC-4 = none / `margherita` with starters.

## 3. Results — Chromium (local, final code)

`layout-chromium`: **7/7 PASS**, 210 samples, **P0 fail 0**, P1 fail 0, P1 Owner-pending 37 (3 findings),
L-N recorded 133. Summary: `docs/reports/screenshots/progression2-w1-i5b5/layout-contract-chromium-summary.md`.

| Invariant | Result (7 profiles) |
|---|---|
| L-A CTA reachable (Cooking, RESULT, serve, mission RESULT, HOME, Pizza Select detail, Shop last row) | PASS (after the §4 fix) |
| L-B pager/CTA ≥ 8 | PASS |
| L-C chips / pager above the bar and hittable | PASS |
| L-D no horizontal overflow | PASS |
| L-E no scroll (doc, `.game-screen`, scrollBy, CTA ancestor) | PASS |
| L-F BAKE CTA at start and after fade | PASS |
| L-G Lunch Rush HUD / tabs | PASS |
| L-H HOME CTA ≤2 lines, ≤64, ≥1.6 | PASS |
| L-I nothing in the insets | PASS |
| L-J tabs within width, no ellipsis, top stable | PASS except **F-2** (Owner pending) |
| L-K skeleton order | PASS |
| L-L recipe names ≤2 lines, inside the card (Pizza Select, Discovery Result) | PASS |
| L-M tap targets ≥44 (Cooking, HOME) | PASS except **F-1** (Owner pending) |
| L-N dough diameter | recorded, advisory (§5) |
| L-O HOME skeleton Dex 0 → 1 | PASS except **F-3** (Owner pending) |

LC-0 applied insets: N/S 0/0, P390i/E390i/E360i 47/34 (Chromium 141.0.7390.37, Playwright 1.56.1).

Per screen (all 7 profiles): HOME PASS · Free Cooking PASS · guided high-piece PASS · BAKE (start + after
fade) PASS · CUT PASS (F-2 at 360) · New Haven no-CUT PASS · Lunch Rush HUD PASS · Pizza Select PASS ·
Shop PASS · Discovery Result PASS.

## 4. Production fix (P0) — Lunch Rush serve screen

LC-3 measured 「次の注文へ」 at bottom 639 > 630 (E390i) and 619.8 > 606 (E360i): inside the home-indicator
inset. The serve panel had no inset padding and the pizza above it was a fixed `min(78vw, 300px)`. Why a
production change: L-A is P0 for RESULT screens (Design §5.2) and P-5 needs 0 P0 failures; no test-side
reading makes it pass. The fix (`d306eb5`, CSS only) reuses the I5b-4b pattern for this one screen: the stage
starts at exactly its old height and may only shrink, the dough follows the stage height (container units),
and the panel's bottom padding includes the inset. **N / S / P are pixel-identical** (stage 97–405, dough
300/281, CTA unchanged); E390i/E360i dough 271/247, CTA bottom 610/586. Before/after:
`serve-before/` (annotated failures), `serve-after/`.

## 5. P1 findings for the Owner (registered, reported, not fixed)

Registered in `KNOWN_P1` (`e2e/support/layoutContract.ts`): narrow (ID, state, profiles, exact offender);
still shown as "Owner pending" in the evidence and the job summary; any other P1 fails the test.

| # | Invariant | Finding | Proposed option (Owner decides) |
|---|---|---|---|
| F-1 | L-M | Tray pager buttons ◀ ▶ are 36×28 (< 44×44), every profile | 44px buttons cost +16px of height in the pager row, i.e. −16px of dough on short profiles (see §6) — trade-off with OD-V-4; or accept |
| F-2 | L-J | CUT: the completed 「✓ 焼く」 tab label is clipped (flex-centered, no ellipsis) at 360 wide (N360, S360, E360i) | 11px / no side padding on that one tab, or accept (the label stays legible; the ✓ touches the edge) |
| F-3 | L-O | HOME at 390×664: CTA rows 4px lower at Dex 1 than Dex 0 (the Dex 0 hint 「🔒 まず1枚ピザを発見しよう」 takes 17px and the flexible hero gives 4px back) | reserve the hint row height at Dex ≥ 1, or accept (not a live jump; the two states never show in one session) |

Also noted, not a finding: Shop restock buttons are 76×36 — Shop is outside L-M's scope (Design §5.2: Cooking,
HOME).

## 6. OD-V-4 — dough diameter (L-N), not adopted

Design/Preflight: "I5b-4b の実装後に E360i で実測してから決める（advisory として記録を始める）". Measured
(`dough-diameter-L-N.md`, all states × 7 profiles):

| Worst states | N390 | S360 | P390i | E390i | E360i |
|---|---|---|---|---|---|
| FREE TOPPING + hint (22 toppings, 4 pages) | 290 | 194 | 290 | 137 | 113 |
| guided Portuguesa TOPPING (10 pieces) | 290 | 175 | 290 | 118 | **94** |
| **Lunch Rush Portuguesa TOPPING (HUD)** | 290 | 134 | 257 | 77 | **53** |
| BAKE (any) / CUT (any) | ≥358 | ≥257 | 358 | ≥200 | ≥176 |

- The earlier 94px was **not** the worst case: Lunch Rush with a high-piece recipe reaches **53px at E360i**
  (HUD 41px, order card, a two-row tray of 4 chips, the reserved pager row, a 104px CTA bar with the inset).
- Accuracy / recognisability: placement math follows the live dough rect, so taps stay accurate, but ten
  pieces on a 53–94px pizza are hard to tell apart (`profiles/LC-3-LR_PREPARE_TOPPING-E360i.png`).
- Trade-off: E360i is the design's **envelope** (a short Safari viewport *and* PWA insets together); real
  devices hit one or the other. N/S/P (real states) never drop below 134px.
- **Options**: A (floor 94px) — would fail today (53px); B (a larger floor) — needs a layout change in short
  viewports (e.g. collapse the order card, a one-row tray, drop the reserved pager row when a category has
  one page), which is new layout spec; C (keep advisory, keep recording).
- **Conclusion: C** (follow the existing recommendation; nothing adopted). Recommend the Owner decide between
  C and a follow-up B-slice with the numbers above. No production change was made for L-N.

## 7. WebKit, CI

- WebKit projects run the Layout Contract on their own width's N and S (LC-0 checks no inset profile is used).
- OD-V-6: the 8 viewport-forcing tests run once per engine (intentional skips accepted by the shard verifier).
- WebKit trace is `off` (Preflight §8 / R-4): with `retain-on-failure` the shards grew >10%
  (2:48/1:34/3:04/1:52 → 3:55/1:45/3:53/2:24) and the bake clock race surfaced.
- Runs (`workflow_dispatch`, `.github/workflows/e2e-webkit.yml`):

| Run | HEAD | Result |
|---|---|---|
| 36221528804 | `060d8cc` | Layout Contract Gate PASS; WebKit Gate FAIL — timing-transparency C (`pauseAt` "to the past"), finished-pizza-visual D (mis-landed bake) → fixed in `460a815` |
| 36221989353 | `460a815` | Layout Contract Gate PASS; webkit-390x844 shard 1 FAIL — LC seeds overwritten on WebKit → fixed in `7bdc2f9` |
| 36222600438 | `7bdc2f9` | see the final report message (recorded with the exact final HEAD) |

## 8. Regression

| Check | Result |
|---|---|
| Vitest | 153 files / 3268 tests PASS |
| typecheck (`tsc -b`) / lint (oxlint) / build | PASS / PASS / PASS |
| CI script tests (`scripts/ci/test-webkit-ci.sh`) | 61/61 PASS |
| Full Chromium (iphone-390x844 + iphone-360x800 + layout-chromium) | **143 passed, 8 intentional skips (OD-V-6), 0 failed**, 305 s |
| Discovery regression (browser, legacy Dex-15 save) | LK-8a / LK-8b / LK-8b′: 0 undiscovered names; Pizza Select 15 cards, 0 names |
| Discovery regression (unit) | Pizza Select / Shop / Dex leak oracles, stock-0, matcher-only, LK-8 suites: PASS (in Vitest) |

## 9. Evidence

`docs/reports/screenshots/progression2-w1-i5b5/`: `profiles/` (N390 / S360 / E360i for HOME Dex 0/1, FREE
pager + hint, BAKE after fade, Discovery Result, Portuguesa TOPPING / BAKE / CUT / RESULT, New Haven RESULT,
Lunch Rush PREPARE / BAKE / CUT / serve / mission RESULT, Pizza Select grid + detail, Shop last row),
`serve-before/` + `serve-after/` (§4), `findings/` (F-1..F-3 annotated), `layout-contract-chromium-summary.md`,
`dough-diameter-L-N.md`.

## Human Verification Videos

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---|---|---|---|
| `i5b5-A-first-progression-390x844.mp4` | 390×844 | 33.9 s | 0.68 MB | H.264 (yuv420p, 25 fps) | PASS |
| `i5b5-B-high-piece-pager-390x844.mp4` | 390×844 | 32.5 s | 0.71 MB | H.264 (yuv420p, 25 fps) | PASS |
| `i5b5-C-newhaven-lunchrush-390x844.mp4` | 390×844 | 33.0 s | 0.70 MB | H.264 (yuv420p, 25 fps) | PASS |

Delivered in session, not committed (Policy). Video Verification: PASS (contact sheets checked).
A: fresh HOME Dex 0 → Free Cooking discovers マルゲリータ → たまご arrives → Shop purchase → ビスマルク discovered →
HOME Dex 2 (same 2+1 skeleton). B: Pizza Select → Portuguesa 10 pieces + hint → 取り出す！ → CUT → RESULT →
Free Cooking topping pager 1/4 → 4/4. C: New Haven → RESULT with no CUT → Lunch Rush (HUD) New Haven → serve →
mission RESULT. Seeds: A fresh; B Dex 12 (…, `pizza-portuguesa`) with all materials; C `new-haven-apizza` only.

## 10. Owner iPhone checklist — OWNER HUMAN REQUIRED

Design §13, items 1–14, on the Owner's own iPhone (record model, iOS, Safari or home-screen app; Safari with
the bottom toolbar shown; once more as a home-screen app if that is how the game is played — OD-V-5). Item 9's
「切る」 is still labelled 「カット」 (I5b-4a rename not in this slice). Item 14 does not apply (OD-VIS-1 not
implemented). Status: **not done — OWNER HUMAN REQUIRED.**

## 11. P-1..P-10

| # | Result |
|---|---|
| P-1 exact HEAD | PASS — recorded (main `12a09de`; branch HEAD in the final report; I5b-3/4 not in main by strategy) |
| P-2 Fast Gate | PASS |
| P-3 R-checks | PASS (Vitest) |
| P-4 Full Chromium | PASS (143 / 8 skipped / 0 failed, 305 s) |
| P-5 LC geometry | P0: PASS (0 on 7 profiles). P1: **3 Owner-pending (F-1..F-3)**. L-N recorded |
| P-6 WebKit Gate on exact HEAD | see the final report message |
| P-7 screenshots | PASS |
| P-8 videos A/B/C | PASS |
| P-9 Human PASS | **OWNER HUMAN REQUIRED** |
| P-10 no open P0 | PASS |
