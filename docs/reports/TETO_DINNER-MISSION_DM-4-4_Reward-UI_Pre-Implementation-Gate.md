# Dinner Mission DM-4-4 — Reward / Result UI: Fresh Pre-Implementation Gate

Parent: #257. Predecessors: DM-4-1 (#259), DM-4-2 (#276), DM-4-3 (#281, merge `671532b`).
Audited main: `671532b` (fresh fetch, after the #281 merge).
Status: **audit / plan only**. No `src` / `e2e` / CSS change, no PR, no Preview deploy.

Three things stay separate (Owner, 2026-09-28):

| layer | what it is | status |
|---|---|---|
| settlement wiring | CLEAR → exactly-once settle, atomic Pitz + record | **done** (DM-4-3, merged) |
| balance activation | real amounts / thresholds in the shipped table, START opened | DM-5-2 (not started) |
| reward presentation | what the result overlay / Detail screen shows | **DM-4-4 (this gate)** |

DM-4-4 must be correct under **both** the untuned table (today) and a tuned one (after DM-5-2)
without shipping any number: amounts appear only when `DinnerSettlementView` carries them, and
production's table carries none.

## 1. What exists today (main `671532b`)

**CLEAR overlay** — `DinnerResultOverlay` (`src/components/DinnerGameUi.tsx:145`), rendered by
`GameScreen.tsx:930` when the run is not PLAYING. `role="dialog"`, `aria-modal`, `aria-label="ディナーミッション結果"`.

| outcome | rows |
|---|---|
| CLEAR | mission title · 🎉 DINNER CLEAR! · 作ったピザ n/n · クリアタイム mm:ss · 最後のピザ |
| TIME_UP | ⏰ 時間切れ！ · n/n 完成 |
| INFEASIBLE | 材料が足りなくなりました · n/n 完成 · 最後のピザ · shortages |
| (all) | もう一度 (disabled + 🛒 補充 copy + ショップへ when retry blocked) · 🏠 ホーム |

- No reward row anywhere ("No reward row until DM-4").
- `DinnerAbandonDialog` already says 「報酬はありません。」 — correct under OD-DM4 (abandon = 0) and stays.
- `DinnerMissionScreen` (Select / Detail) shows **no** record (clears / best time) today.

**Measured CLEAR overlay** (main + #281, Chromium, DM-A, retry not blocked; `.dinner-result` box):

| viewport | panel top–bottom | height | last button bottom | vertical headroom |
|---|---|---|---|---|
| 390×844 | 248–597 | 349 | 557 | 495 |
| 360×800 | 226–575 | 349 | 535 | 451 |
| 390×664 | 158–507 | 349 | 467 | 315 |
| 360×640 | 146–495 | 349 | 455 | 291 |

The panel is centred and fixed-content (no `max-height` / `overflow` on `.mission-overlay__panel`).
Budget: +2 rows (~48 px) keeps ≥ 240 px headroom at 360×640 even with the retry-blocked rows
(+~70 px). A third row is still safe but is where DM-4-4 should stop. Screenshots of today's state
are the "before" set (§8): `docs/reports/screenshots/dm4-4-reward-ui/before-clear-{390x844,360x800,390x664,360x640}.png`, captured on `3164cfd` (= tree merged as `671532b`).

## 2. What the settlement can safely give the UI

Source of truth: `GameState.dinner.settlement: DinnerSettlementView | null` (DM-4-3), set in the
same reducer step as Pitz + record, reset to `null` by `DINNER_START` (retry), never persisted
(the overlay is not shown again after a reload — nothing to re-display, nothing to re-settle).

| field | meaning | production today (untuned) |
|---|---|---|
| `kind` | SETTLED / BLOCKED / REFUSED | SETTLED on a valid CLEAR |
| `pitz` | Pitz actually credited | **always 0** |
| `schedule` | FIRST_CLEAR / REPEAT_CLEAR / UNAVAILABLE | **always UNAVAILABLE** |
| `tier` | GOLD / SILVER / BRONZE / null | **always null** (no thresholds) |
| `clearMs` | authoritative clear time | real |
| `newBestTime` | strictly faster than the stored best (same revision) | real |
| `newBestTier` | better tier than stored | always false |

Plus, from `state.dinnerMissionRecordsState` (DM-4-2): per-mission `clears`, `bestClearMs`,
`bestTier`, `firstClearRewarded`, and `blockedMissionIds`.

**Rules for the UI (proposed invariants, to become tests):**

- UI-1 The UI reads `settlement` / records only; it never computes Pitz, tier or first/repeat itself.
- UI-2 A Pitz amount is rendered **only** when `kind === "SETTLED" && schedule !== "UNAVAILABLE" && pitz > 0`.
  Under the shipped table this is unreachable → no provisional amount can reach production (Owner rule).
- UI-3 A tier is rendered only when `tier !== null` (unreachable in production until DM-5-2).
- UI-4 Nothing reward-related renders on FAILED (TIME_UP / INFEASIBLE / ABANDONED); those panels are unchanged.
- UI-5 `settlement === null` on a CLEAR (not expected; defensive) renders the pre-DM-4-4 overlay.
- UI-6 No count-up / animation of Pitz (reduced-motion safe; nothing to animate in production anyway).

## 3. Display matrix (proposal — each "OD" cell needs an Owner Decision, §6)

| case | reachable in prod now? | Pitz row | tier | best-time row | extra |
|---|---|---|---|---|---|
| SETTLED, UNAVAILABLE (untuned) — first CLEAR | yes | **hidden** (OD-DM44-1) | hidden | 「ベスト 02:20」 + NEW BEST? (OD-DM44-3) | — |
| SETTLED, UNAVAILABLE — repeat, faster | yes | hidden | hidden | 「ベスト 02:05」 + NEW BEST | — |
| SETTLED, UNAVAILABLE — repeat, not faster | yes | hidden | hidden | 「ベスト 02:05」 (no badge) | — |
| SETTLED, FIRST_CLEAR (tuned) | after DM-5-2 | 「+N Pitz」 + 初回ボーナス label | badge | as above | — |
| SETTLED, REPEAT_CLEAR (tuned) | after DM-5-2 | 「+N Pitz」 | badge | as above | — |
| BLOCKED (broken record, or refused at write) | yes (corrupt save) | hidden | hidden | hidden | neutral note (OD-DM44-2) |
| REFUSED (authority rejected) | defensive only | hidden | hidden | hidden | same neutral note (OD-DM44-2) |
| FAILED (any reason) | yes | none (UI-4) | none | none | unchanged |

**0 Pitz:** never rendered as 「+0 Pitz」. Under the untuned table 0 means "no reward table yet",
not a result. Under a tuned table the invariants force a first clear to pay ≥ 1 (I3: repeat < first,
amounts are non-negative integers), but a **repeat** clear may legitimately be tuned to 0 — DM-5-2
decides. A tuned 0 on a repeat therefore also hides the row (UI-2), and BLOCKED / REFUSED get the
note instead.

**Best time granularity (finding):** `formatDinnerClock` rounds **up** to whole seconds
(`Math.ceil`) while `newBestTime` compares milliseconds. A 139.2 s clear after a 139.9 s best shows
「NEW BEST 02:20」 next to a previous best that also read 02:20. Plan: show NEW BEST only when the
displayed value changes (compare `formatDinnerClock` strings), or show tenths on the best row only —
Owner pick in OD-DM44-3. The clock format itself matches the Owner's Human Timing evidence
(DM-A 02:20 / DM-B 02:05, source `51e0923`, iPhone), which is the DM-5-1 A/B one-run baseline and
**is not** a tier threshold.

## 4. Mission record display (Detail screen)

Proposal (OD-DM44-4): the Detail card gains one line when a record exists —
「クリア n回 ・ ベスト mm:ss」; none before the first clear; a **blocked** mission shows
「記録を読み込めませんでした」 (no numbers, no reset button — recovery UX is #279). Select-screen
cards unchanged (space). No tier / Pitz on Detail until DM-5-2.

## 5. Accessibility

- New rows are plain text inside the existing dialog (read with it); no extra live region.
- NEW BEST / tier are words, not colour only; emoji `aria-hidden` with the word carrying meaning
  (as in `DinnerTargetRow` 🔍).
- Focus order unchanged: もう一度 remains the first control; no new focusable elements.
- Font floor unchanged (rows reuse `.dinner-result__row`, 15 px); contrast via existing tokens.

## 6. Owner Decisions required before implementation

| id | question | recommendation |
|---|---|---|
| OD-DM44-1 | Untuned table: hide the Pitz row, or show 「報酬：準備中」? | **Hide.** Nothing to promise; avoids a string that must later be removed. |
| OD-DM44-2 | BLOCKED / REFUSED copy on CLEAR | One neutral line: 「記録を保存できませんでした（今回の報酬はありません）」; recovery is #279. |
| OD-DM44-3 | Best time: NEW BEST on the first clear? granularity? | Best row always shows; NEW BEST badge only on a repeat whose **displayed** time improves. |
| OD-DM44-4 | Detail-screen record line in DM-4-4? | Yes: 「クリア n回 ・ ベスト mm:ss」; blocked → neutral line. |
| OD-DM44-5 | Pitz / tier presentation code now or after DM-5-2? | **Split:** DM-4-4a ships record + best time (reachable now); DM-4-4b (Pitz row, 初回ボーナス label, tier badge) is built with test-fixture tables only and HV'd on a Preview-only fixture query, or deferred until DM-5-2 values exist. |
| OD-DM44-6 | Sequencing with PR #275 | **Implement after #275 merges** (see §7). |
| OD-DM44-7 | Preview slot for HV | Owner schedules the shared Preview (§7); no overwrite without permission. |

## 7. Conflicts and sequencing (checked fresh)

- **PR #275** (#256 CUT skip + Dinner UI Polish, open, awaiting Owner HV, head `21fbedf`, base = current
  main) edits the **same surfaces**: `DinnerGameUi.tsx` (`DinnerResultOverlay` 最後のピザ ★N,
  `DinnerAttemptResultPanel` あと★N, `DinnerTargetRow`), `dinnerView.ts` (+40), `App.css` (+56,
  Dinner result / target-row block). DM-4-4 built in parallel would collide textually and would HV a
  layout #275 is about to change. → DM-4-4 implementation branches from main **after** #275 merges
  (or the Owner re-prioritises).
- **Shared Preview** (`perusonao/teto-pizza-game-preview`, checked read-only): latest deploy is
  `30cf00e` (DH4-2C Hint Sheet, `claude/dh4-2c-hint-sheet-ui`, 2026-09-28 04:24 UTC); before it
  `4cf4172` (same branch) and `51e0923` (+ `site/dm5-timing.html` DM-5-1 helper). The slot is
  **in use by DH4-2C**, not by #275 or DM-4. DM-4-4 did not and will not deploy; its HV needs an
  Owner-assigned slot, and the DM-5 timing helper page must be preserved on any redeploy.

## 8. Human Verification plan (per `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`)

Applies (UI change). DM-4-3's HV is folded in here (Owner, 2026-09-28): the video also demonstrates
that a CLEAR records once and a reload re-settles nothing.

- **Video** (390×844, H.264, delivered directly, not committed), one continuous take per scenario:
  1. First CLEAR of DM-A (no prior record) → overlay: best time, no Pitz row, no tier.
  2. Retry, slower CLEAR → best unchanged, no NEW BEST.
  3. Retry, faster CLEAR → NEW BEST.
  4. Reload after a CLEAR → no overlay, Detail shows 「クリア n回 ・ ベスト」, save unchanged.
  5. Broken `dm-a` record (setup helper) → CLEAR shows the neutral note; Detail blocked line.
  6. TIME_UP and INFEASIBLE panels → unchanged (no reward rows).
  7. Abandon dialog → unchanged 「報酬はありません。」
  8. (DM-4-4b only, if built) Preview-only fixture table: first-clear vs repeat Pitz row and tier badge.
- **Screenshots** before/after at **390×844, 360×800, 390×664, 360×640** for: CLEAR (first / new
  best / blocked), TIME_UP, Detail with record, Detail blocked; committed under
  `docs/reports/screenshots/dm4-4-reward-ui/`. Today's "before" CLEAR set was captured during this audit.
- **Automated**: Layout Contract (7 profiles) + a DM-4-4 E2E asserting at the 4 viewports that the
  panel fits (`bottom ≤ innerHeight`, last button visible, no horizontal overflow), and a unit/source
  guard that no Pitz digit renders under the shipped table (UI-2).

## 9. Proposed slices

- **DM-4-4a — record presentation** (reachable now, no economy numbers): best-time row + NEW BEST,
  blocked/refused note, Detail record line, view-model `dinnerResultRewardView(settlement, record)` (pure,
  tested), E2E + HV. Depends on OD-DM44-1..4, 6, 7.
- **DM-4-4b — reward presentation** (Pitz row, 初回ボーナス, tier badge): pure view + component tested
  with fixture tables; production renders nothing until DM-5-2 (UI-2/UI-3). Timing per OD-DM44-5.
- Not in DM-4-4: amounts / thresholds (DM-5-2), clock hardening (DM-4-5), recovery UX (#279),
  multi-tab Pitz (#282), Dex (#234).

## 10. Verdict

Settlement exposes everything the UI needs through a read-only view; no provisional amount can reach
production if UI-2 holds; layout headroom is sufficient at 360×640. Implementation is **blocked only
on Owner Decisions OD-DM44-1..7** (copy, split, #275 sequencing, Preview slot).
