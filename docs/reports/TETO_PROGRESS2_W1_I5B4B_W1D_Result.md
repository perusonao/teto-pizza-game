# Progression 2.0 W1 — I5b-4b (Cooking layout contract) + W1-d (Discovery Result) (Result)

Status: **I5b-4b and W1-d implemented and verified. STOP before I5b-5** (no PR, no merge).

- Branch `claude/teto-pizza-w1-i4a-j46ph0`; starting HEAD `9d7d397` (Discovery W1); main `12a09de`
  (unchanged, fresh-fetched; no open PR for this branch).
- Commits: `40ea561` I5b-4b · `328f84e` W1-d · evidence/docs (this commit).

## 1. I5b-4b authority (recovered, not invented)

| Source | What it fixes |
|---|---|
| I5b-4 UI/UX Fresh Audit `0c3e01f` (`claude/teto-pizza-fresh-audit-fgqqtc`) §13 row **I5b-4b** | "Cooking のレイアウト契約（in-flow の CTA bar、BAKE の CTA を bar に置く、stage を flex で決める、pager の場所を確保する、inset）" |
| same §3 (F-3, F-3b) | BAKE CTA off-screen (in-flow overlay + fixed reserves); Lunch Rush HUD +8px; tabs jump below the BAKE dialogue; fix e (CTA in the bar) + d (BAKE dialogue → compact order-card) + f (safe-area), b / c minor |
| same §4 (F-4) + Fresh Design diagram | pager −80px under the fixed bar (short viewport + inset + hint); stage = only flexible element, list → pager → 8px → in-flow CTA bar, pager always reserved |
| same §10.2 | I5b-4 scope item 2 = exactly this slice |
| I5b-5 Verification Design `d4f96d0` §5.2 | invariants the slice must satisfy: L-A, L-B, L-C, L-E, L-F, L-G (P0), L-J (tabs top constant), L-K (skeleton order) |

Not in I5b-4b (kept out): 「切る」 rename (I5b-4a), hints (I6), Pizza Select (W1-a3), RESULT bar.

## 2. I5b-4b implementation

- `.game-screen--cooking` (PREPARE / BAKE / CUT): flex column where only the pizza stage
  (`flex: 1 1 0`, size container) takes the left-over height; dough = `min(vw cap, px cap, 100cqh)`.
- `.prepare-bake-bar` in-flow at the bottom (safe-area in its padding); BAKE's 「取り出す！」 moved
  into the same bar (`BakeOverlay`); 8px spacer above the bar (tray / bake Guide / CUT readout).
- Pager row always laid out (`--placeholder`: invisible, aria-hidden, disabled) with one page.
- BAKE's portrait DialogueBox → compact `.order-card--bake` under the tabs (same Teto line text);
  tabs stay right under the header (or the Lunch Rush HUD) on every step.
- Nominal sizes unchanged: dough 290 / 274 (PREPARE) and 359 / 331 (BAKE) at 390×844 / 360×800.

### Geometry (Chromium probe, CDP safe-area override; `cooking-{before,after}/probe.json`)

Profiles N390 390×844, N360 360×800, S390 390×664, S360 360×640, E390i / E360i (+47/34 inset).

| State | before (`9d7d397`) | after |
|---|---|---|
| FREE TOPPING (22 toppings, 4 pages) | E*: pager −65px under bar, 3 chips + pager hidden, `.game-screen` scrolls | 0 failures |
| FREE TOPPING after hint | S*: gap 1px + scroll; E*: **−80px**, chips/pager hidden | 0 |
| guided high-piece (Portuguesa) | E*: chip hidden, scroll | 0 |
| BAKE (start / guide faded) | E*: 取り出す！ bottom 654 > 630 / 630 > 606, scroll | 0 |
| CUT | 0 | 0 |
| New Haven BAKE → RESULT (no CUT) | E*: CTA off-screen | 0; no CUT step, straight to RESULT |
| Lunch Rush PREPARE | E*: chip hidden, scroll | 0 |
| Lunch Rush BAKE | S*: +8px scroll; E*: CTA off-screen and not tappable | 0 |

Tabs top: 56 on every step (97 with the HUD); before, BAKE moved them to 164 (L-J).
Advisory L-N (OD-V-4): smallest dough = 94px (guided high-piece TOPPING at E360i), 113px FREE.

## 3. W1-d Discovery Result (OD-DISC-6 approved)

NEW_DISCOVERY only (the Free Cooking matcher — the only discovery source since W1-a2):
1. NEW PIZZA! stamp + recipe name (first reveal) 2. 「📖 ピザ図鑑に登録！ No.k（第n章 x/m）」 +
「📖 図鑑を見る」 on that row (canonical chapters) 3. ★ / score / +Pitz（初回発見 +50） on one line
4. existing generic material arrival (material names only) + its ショップへ link 5. existing
bottom CTA bar, unchanged. Teto's heading and the bake badge are omitted in this variant only;
known / guided / ORIGINAL / FAILED / Lunch Rush results are unchanged. The Dex opens on the new
slot. HOME keeps W1-e (Shop NEW badge, bubble prioritises Shop arrival) — OD-DISC-6.

Leak contract: the Result names only the recipe just discovered; arrival copy has no recipe name
(unit test with an undiscovered-name oracle).

## 4. Verification

| Check | Result |
|---|---|
| Full Vitest | **153 files / 3268 tests PASS** |
| typecheck / lint / build | PASS / PASS (0 warnings) / PASS |
| Full Chromium e2e (iphone-390x844 + iphone-360x800) | **144 / 144 PASS** (`making-ui-1screen` updated to the in-flow contract) |
| Chromium geometry probe | 9 states × 6 profiles: **0 invariant failures** (before: 48) |
| Discovery regression (browser, legacy Dex-15 save) | LK-8a / LK-8b / LK-8b′: 0 undiscovered names; Pizza Select 15 cards, 0 names |
| Discovery regression (unit) | Pizza Select / Shop / Dex whole-ladder oracles, stock-0, matcher-only, LK-8 suites: PASS |

Screenshots: `docs/reports/screenshots/progression2-w1-i5b4b-w1d/` — `screens/` (390×844 and
360×800: FREE pager p1/p2, guided high-piece, BAKE, CUT, New Haven Result, Discovery Result,
Dex opened from it, HOME after arrival), `cooking-before/` vs `cooking-after/` (N390 and E360i).
Horizontal overflow 0 everywhere.

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---|---|---|
| `i5b4b-cooking-390x844.mp4` | 390×844 (+ a 390×664 segment) | 20.9 s | 0.5 MB | PASS |
| `w1d-discovery-result-390x844.mp4` | 390×844 | 16.6 s | 0.3 MB | PASS |

MP4/H.264, delivered in session, not committed. Video Verification: PASS (contact sheets checked).
Check: pager pages and hint with the bar clear; 焼く / 取り出す！ / 切り終わる in the same bottom bar;
short viewport still clear; Discovery Result order; Dex lands on No.02; HOME Shop `NEW 1` + bubble.

## 5. Remaining / I5b-5 handoff

- I5b-5b: add the Layout Contract spec (L-A..L-O, the 7 profiles, CDP inset self-check) — the scratch
  probe here is the reference implementation of the P0 checks; WebKit S390 / S360 via CI.
- OD-V-4: floor for the dough diameter (measured 94px at E360i, guided high-piece).
- I5b-4a leftovers (not in this slice): 「カット」→「切る」.
- F-13 (LOW) INCOMPLETE_MATCH copy and LK-6 (intentional Dex-0 onboarding hint) unchanged.
- Result screen's own fixed actions bar is not part of I5b-4b (RESULT 1-Screen 2.0); I5b-5 should
  include RESULT in L-A.
