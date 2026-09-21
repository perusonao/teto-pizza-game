# Teto Pizza Game — Visual Polish 2.0C Fresh Audit

**Type:** Read-only / audit. No production code changed. `git status` for this branch shows only
this report and `docs/reports/screenshots/visual-polish-2.0c-audit/` — no file under `src/**`,
`functions/**`, Firebase config, GitHub Actions production-deploy workflows,
`firestore.rules`/`firestore.indexes.json`, Player Profile, `setDisplayName`,
`submitLunchRushScore`, or ranking backend/query logic was read for editing or touched in any way.
This session ran fully independent of, and does not depend on, the parallel Firebase Production
Deploy Phase 4b / IAM session.

**Scope:** Fresh-reproduce exactly two carried-over P1 findings from
`docs/reports/TETO_VISUAL-POLISH_2.0_Phase0_Fresh-Audit.md` against current `main` — **P1-4**
(Recipe Select fresh-save first impression) and **P1-5** (RESULT primary CTA below fold). P1-1/
P1-2/P1-3 are not re-audited here (already shipped as Visual Polish 2.0A/2.0B, PR #146/#147).
No implementation in this session — docs + screenshots only.

---

## 1. Audited main SHA

`41a08cc26756d17289cfd888653208d8da558dcb` — confirmed via `git fetch origin` + `git rev-parse
origin/main` at session start, matching the task brief's expected SHA exactly (no drift). Working
tree was clean before this session's own screenshot/report files were added.

## 2. Duplicate Gate #1 (start of session)

Checked before any review work:

- `git fetch origin` pulled ~140 branches; `origin/main` HEAD confirmed as `41a08cc2` above.
- **Open PRs** (`state:open`, 6 total): **#148** "docs: IAM fix for Phase 4b —
  `firebaseProjectsGetOnly` custom role" (the parallel Firebase/IAM session's own PR — explicitly
  out of this session's scope, not touched, not read beyond its title); **#105** (Dev Automation
  A1, draft, unrelated to UI); **#72** (docs-only status-sync, stale base); **#46** (Issue #33
  Dough Shaping D0 audit, docs-only, stale base); **#34** (Issue #32 Phase 1 reference visuals,
  stale base); **#3** (very old docs PR). **None of the 6 open PRs touch Recipe Select, RESULT,
  or any Visual Polish surface.**
- Local/remote branch scan for `visual-polish` / `recipe-select` / `result` naming: found
  `claude/visual-polish-2-0a-cbmbd9` and `claude/visual-polish-2-0b-v0r5em` (both already merged
  as #146/#147 — see `docs/reports/TETO_VISUAL-POLISH_2.0A_Result.md` /
  `..._2.0B_Result.md`), `claude/teto-recipe-select-2.0-audit-a866hp` and
  `claude/recipe-select-2-0a-6tzrq6` (both predate/underlie the already-merged Recipe Select 2.0A,
  PR #139), `claude/teto-result-2-audit-rjbvjo` and `claude/teto-result-2-slice-1-e6m42f` (both
  already merged — `docs/reports/TETO_RESULT-2_Fresh-Audit.md` / `..._SLICE1_Result.md` confirm
  PR #75 shipped RESULT 2.0 Slice 1, which is directly relevant context for P1-5, folded in below).
  No open, in-flight branch or PR duplicates this session's P1-4/P1-5 scope.
- **Conclusion:** no duplicate work in flight. Proceeded on `claude/visual-polish-2.0c-audit-shyxxg`.

## 3. Important context found during Duplicate Gate #1: RESULT already changed since Phase 0

The Phase 0 audit (SHA `f14217b3d`) described RESULT as a two-phase screen
(`RESULT` → tap "レシピ図鑑に登録する" → `DISCOVERED`). **That is no longer how `main` behaves.**
`docs/reports/TETO_RESULT-2_SLICE1_Result.md` (PR #75, merged before the SHA this session audits)
already merged RESULT+DISCOVERED into one continuous screen: `REGISTER_TO_DEX` now auto-dispatches
immediately after `CONFIRM_BAKE` (`App.tsx`'s `handleConfirmBake`), so a player never sees a
separate "register" tap — score, discovery/BEST banner, Pitz credit, and the two retry CTAs all
render together in `ResultPanel.tsx` today. This session's P1-5 fresh reproduction (§5) is
against **this current, already-merged single-screen RESULT**, not the two-phase version Phase 0
described — the finding still reproduces, but the shape of "why" has changed (see §7).

## 4. P1-4 Fresh reproduction — Recipe Select fresh-save first impression

**Method:** real Chromium (Playwright, `/opt/pw-browsers/chromium`), mobile emulation
(`isMobile`, `hasTouch`, `deviceScaleFactor: 2`), fresh `localStorage.clear()` + reload, HOME →
「ピザを作る」 → Recipe Select, measured before any scroll.

**Result: still reproduces, materially unchanged from Phase 0, with one mitigating detail Phase 0
under-emphasized.**

| Viewport | Total cards | Locked (total) | Cards in first viewport (no scroll) | Locked in first viewport |
|---|---|---|---|---|
| 390×844 | 15 | 14 (93.3%) | 7 | 6 (85.7%) |
| 360×800 | 15 | 14 (93.3%) | 7 | 6 (85.7%) |

The first viewport at both sizes shows exactly 第1章's 7 cards (マルゲリータ NEW + 6 locked) —
第2章 starts right at the fold. Only マルゲリータ (the one recipe with no `unlockCondition`) is
playable; every other card in view is a grey lock silhouette.

**What is already better than Phase 0's own framing suggested:** every locked card — including
the mystery 「？？？」 card — renders its own specific unlock-condition string directly under the
lock icon (e.g. 「フンギを1枚完成させると解禁」, 「あと★12で解禁」 for the mystery card), not a
generic "locked" label. Phase 0's report described this state as "14 of 15... render as an
identical grey lock icon" without mentioning this per-card hint text, which already exists in
`recipeCardState`/`CardStatusContent` (`src/state/pizzaSelect.ts` / `PizzaSelectScreen.tsx`) and
renders on every locked card today. Opening a locked card's own detail view (§ screenshots) shows
the same hint again, plus a disabled 「このピザを作る！」 CTA — so **"unlock可能性が理解できるか"
is already reasonably well served**: nothing about *why* a card is locked or *what unlocks it* is
hidden or ambiguous. The remaining problem is purely the **first-glance visual impression**: 6
uniform grey-lock cards outweighing 1 colored, playable card in the very first thing a new player
sees, which risks reading as "a mostly-broken/locked screen" before the player has read any of
the per-card hint text — a first impression / information-hierarchy problem, not an information-
availability problem.

**Scroll:** grid `scrollHeight` is 1568px (390×844, ~1.86× viewport) / 1571px (360×800, ~1.96×
viewport) — by design, a browse grid, not meant to fit one screen (unchanged from Phase 0).

**No horizontal overflow, zero console errors** at either viewport for this flow.

## 5. P1-5 Fresh reproduction — RESULT primary CTA below fold

**Method:** real Chromium, same setup, three real playthroughs driven via actual pointer-drag/tap
gestures against the live `PizzaStage` drop target (dough stretch, sauce-ring painting,
cheese/topping placement, real-time bake-needle wait, and — for margherita — three real CUT
drags), matching the codebase's own `App.test.tsx` interaction patterns translated to real
browser pointer events (not mocked/dispatched state).

**Result: still reproduces in every scenario tested, at both viewports, on the current
already-merged single-screen RESULT.**

| Scenario | Viewport | `scrollHeight` | Ratio vs. viewport | CTA row top / bottom | Fully visible w/o scroll? |
|---|---|---|---|---|---|
| マルゲリータ (CUT, first discovery) | 390×844 | 1121px | 1.33× | 959 / 1097 | **No — entirely below fold** |
| マルゲリータ (CUT, retry, no discovery) | 390×844 | 1024px | 1.21× | 862 / 1000 | **No** |
| フンギ (no CUT, first discovery) | 390×844 | 972px | 1.15× | 810 / 948 | **No** (top peeks 34px into view, bottom half cut off) |
| マルゲリータ (CUT, first discovery) | 360×800 | 1102px | 1.38× | 939.8 / 1077.8 | **No** |
| マルゲリータ (CUT, retry, no discovery) | 360×800 | 1005px | 1.26× | 842.8 / 980.8 | **No** |
| フンギ (no CUT, first discovery) | 360×800 | 953px | 1.19× | 790.8 / 928.8 | **No** (button not visibly reachable in the screenshot) |

Every one of the 6 combinations tested puts the primary retry CTA row (`.result-panel__actions`,
「もう一度つくる」/「別のピザを作る」) below the fold. The **best** case (フンギ, no CUT, smaller
viewport-independent content) still fails — its CTA row starts 34px above the 390×844 fold but
extends 104px past it, and at 360×800 doesn't even start until 9px past the fold.

**What drives the height, ranked by contribution (read directly off the scrolled screenshots):**
1. The pizza hero + Teto verdict line + stars/score/bake-badge — fixed cost, present in every
   round, not the tall part.
2. Discovery/starter-grant banners (「発見しました」 + 「材料を最初の10回分プレゼントしました」)
   — present only on a first discovery (accounts for most of the gap between the CUT-discovered
   row at 1121px and the CUT-retry row at 1024px, ~97px).
3. The Pitz credit `<dl>` (5–6 rows) — always present for a FREE round.
4. **The CUT evaluation block (`.cut-evaluation-summary`)** — present only for margherita today
   (the only CUT-enabled recipe), and **rendered fully expanded, unconditionally** (headline +
   disclaimer + 3-row `<dl>`, no `<details>` collapse) — this is the single largest swing item:
   removing it (funghi vs. margherita, same discovery state) accounts for ~149–152px of the
   ~972–1121px total.
5. The collapsed `<details>「くわしいスコアを見る」` — already collapsed by default (RESULT 2.0
   Slice 1's own explicit design decision, confirmed unchanged on current `main`) — this is
   *not* part of the problem; it was already fixed before this audit.

**No horizontal overflow, zero console errors**, at either viewport, across all three
playthroughs (6 total round-trips through PREPARE→BAKE→(CUT)→RESULT).

**Fixed-CTA / safe-area / competing-overlay check (per task instruction):** `.prepare-bake-bar`
(the existing `position: fixed` bottom bar, `App.css`, z-index 10, with its own
`--bake-bar-reserve: 84px` + `env(safe-area-inset-bottom, 0px)` reservation pattern) is used only
during PREPARE/BAKE (`GameScreen.tsx` lines 426/517) — it is **not mounted at all** while RESULT
is showing, so a future fixed CTA on RESULT would not visually collide with it, though it *is* the
established pattern (same z-index/safe-area convention) a RESULT-CTA fix should reuse rather than
inventing a new one. `MissionResultOverlay`/`.mission-overlay` (z-index 25) and the shared
`.dex-overlay` family (z-index 20, or 25 for the ranking-overlay override per 2.0B) are Lunch
Rush/HOME-navigation overlays, never mounted simultaneously with FREE's `ResultPanel` — confirmed
no z-index or stacking conflict exists for a RESULT-only change.

## 6. Screenshots

Saved to `docs/reports/screenshots/visual-polish-2.0c-audit/`, split by viewport (390x844/,
360x800/), before-only (no implementation this session):

- `p1-4_01_recipe-select_first-viewport.png` — fresh-save grid, no scroll, both viewports.
- `p1-4_02_recipe-select_scrolled-bottom.png` — full grid extent for context.
- `p1-4_03_recipe-select_new-detail.png` — the one NEW card's (マルゲリータ) detail view.
- `p1-4_04_recipe-select_locked-detail.png` — a LOCKED card's (マリナーラ) detail view, showing
  the unlock-hint text + disabled CTA referenced in §4.
- `p1-5_01_result_margherita-cut-discovered_first-viewport.png` — worst-case RESULT, no scroll.
- `p1-5_02_result_margherita-cut-discovered_scrolled.png` — same round, scrolled to show the full
  stack (CUT block, collapsed details toggle, CTA row) referenced in §5's ranking.
- `p1-5_03_result_margherita-cut-retry_first-viewport.png` — same recipe, no discovery banner.
- `p1-5_04_result_funghi-nocut-discovered_first-viewport.png` — best-case RESULT, still below fold.

12 screenshots total (6 per viewport) — kept to the representative set needed to support every
number in §4/§5, not a full step-by-step capture pass.

## 7. Already resolved (found during this fresh audit, not previously tracked as such)

- **RESULT's own two-phase structure (RESULT → tap to register → DISCOVERED)**, which Phase 0's
  P1-5 finding implicitly assumed as the source of RESULT's extra height, **is gone** — RESULT 2.0
  Slice 1 (PR #75) already merged both into one screen, and the score-breakdown bars are already
  collapsed behind `<details>` by design (§5, item 5) specifically so they don't contribute to the
  fold problem. P1-5 still reproduces, but *not* for the reason Phase 0's text implied it might
  (two stacked phases) — it reproduces because the now-single screen's *own* content (banners +
  Pitz `<dl>` +, for margherita, an unconditionally-expanded CUT block) is still taller than one
  viewport on a typical first-discovery round.
- P1-4's "does a new player understand *why* a card is locked / what unlocks it" sub-question is
  already answered by the existing per-card unlock-hint text (§4) — this was not explicitly
  credited in Phase 0's finding text, though the same code was already live at Phase 0's own audit
  SHA.

## 8. Still open (confirmed reproducing on current `main`, `41a08cc2`)

- **P1-4:** the first viewport of a fresh save is still 6-locked-vs-1-playable (85.7% locked at a
  glance), at both 390×844 and 360×800 — a first-impression/hierarchy problem, not a missing-info
  problem.
- **P1-5:** the primary retry CTA is below the fold in every one of 6 tested combinations (2
  viewports × {CUT+discovered, CUT+retry, no-CUT+discovered}), ranging from 1.15× to 1.38×
  viewport height. The CUT evaluation block (margherita-only today, unconditionally expanded) is
  the single largest, most fixable contributor to the worst cases.

## 9. P1-4 improvement options (comparison, no implementation)

**A. Promote unlocked/recommended cards to their own lead section, ahead of any locked cards.**
Currently マルゲリータ already sits first *within* 第1章's section, but is immediately followed by
6 locked siblings in the same section/viewport. A small "つくれるピザ" (or similar) section header
above 第1章, containing only currently-unlocked+undiscovered cards, would put 100% of the first
viewport's content on cards the player can actually tap today, deferring all locked cards below
the fold entirely on a fresh save (where there is exactly one such card, so this section would be
very small — a real design tension: a 1-card "recommended" section may itself look sparse/odd).
*Risk:* on a fresh save this section is a single card, which may look unfinished on its own;
reads better once 2–3 recipes are unlocked. *Scope:* `buildRecipeSections`
(`src/state/pizzaSelect.ts`) + `PizzaSelectScreen.tsx` section render — logic-light, mostly a new
section-partition function.

**B. Reduce locked-card visual weight/density so more fit per row or read as clearly secondary.**
E.g., a more compact locked-card treatment (smaller card height, lock icon without the full
card-sized silhouette box) so the first viewport shows the same 7 cards but the 6 locked ones
recede visually and the 1 unlocked card dominates by contrast, not just by position. Keeps the
existing chapter-based section structure and per-card unlock-hint text (§4/§7) untouched — pure
CSS/sizing. *Risk:* if locked cards shrink significantly, the existing unlock-hint text needs to
still fit/read legibly at the smaller size — a real layout constraint to design against, not just
implement. *Scope:* `App.css` locked-card modifier class only.

**C. Add a one-line first-play framing banner above the grid on a fresh/near-fresh save.**
E.g., 「レシピは遊ぶほど増えていくよ。まずはマルゲリータから！」 shown only while `dex` has zero
discoveries (or below some small threshold), directly telling a new player what Phase 0's finding
worried they might not infer from the layout alone. Doesn't change the grid itself at all — purely
additive, easiest to scope precisely and least likely to affect the returning-player experience
once several recipes are unlocked (condition naturally stops showing it). *Risk:* another banner
competing for attention with HOME's own onboarding conventions — should match, not duplicate, any
existing first-play messaging elsewhere in the app (not audited in this session; worth checking
before implementing). *Scope:* one conditional block in `PizzaSelectScreen.tsx`, no CSS/logic
changes elsewhere.

**No implementation chosen in this session** — options are presented for a future task to pick
from, per the "実装はまだしないでください" instruction.

## 10. P1-5 improvement options (comparison, no implementation)

**A. Make the CTA row `position: fixed` to the viewport bottom**, reusing the exact
`.prepare-bake-bar` pattern already established for PREPARE/BAKE (§5's fixed-CTA check confirms
no z-index/mounting conflict exists). *Pro:* guaranteed always-reachable regardless of content
height, zero risk of a future RESULT addition (e.g., a future Cooking Time card per
`TETO_RESULT-2_Fresh-Audit.md` §6) silently pushing it out of reach again. *Con:* a fixed bar
permanently covers ~84px+safe-area of the pizza hero/score content on every RESULT screen, even
the already-short funghi/no-CUT case that's only barely below the fold today — a real trade-off
between "always reachable" and "always covers some content," and the *only* one of the three
options that changes RESULT's visual chrome on every round, not just the tall ones. *Scope:*
`App.css` (new fixed-bar rule + `--bake-bar-reserve`-style content padding) +
`ResultPanel.tsx`/`.result-panel__actions` class change only.

**B. Compress RESULT's own content — specifically, collapse the CUT evaluation block behind the
same `<details>` disclosure already used for the score bars**, rather than rendering it
unconditionally expanded. Per §5's ranking, this is the single largest lever available without
touching layout chrome at all: it directly removes the largest content-driven gap between the
worst case (margherita, 1.33×/1.38×) and the near-passing case (funghi, 1.15×/1.19×) — collapsing
it would likely bring even the CUT case close to or within the fold on its own, without a fixed
bar. *Pro:* smallest, most targeted change; keeps CTA in normal document flow (matches RESULT 2.0
Slice 1's own stated design choice not to force a fixed bar); doesn't cover any content on shorter
rounds. *Con:* CUT score is arguably payoff information a player who just cut their pizza wants to
see immediately, not hidden behind a tap — collapsing it changes what "immediately visible" means
for that one recipe family today (only margherita, but by design more CUT recipes are expected
later per `docs/design/TETO_PIZZA-CUTTING_1.0.md`). *Scope:* `ResultPanel.tsx` (wrap
`.cut-evaluation-summary` in a `<details>`, mirroring the existing score-bars block) +
`App.css` for the summary-header treatment — no reducer/state change.

**C. Reorder RESULT so the retry CTAs sit higher in the stack** — e.g., immediately under the
stars/score headline (mirroring `MissionResultOverlay`'s own "all key info, one screen, no
scroll-to-act" precedent cited in `TETO_RESULT-2_Fresh-Audit.md` §8), with Pitz/discovery/CUT
detail continuing below as supporting detail a player can still scroll to. *Pro:* no new fixed
chrome, no information removed or hidden — matches an existing precedent already in this same
codebase (Lunch Rush's own result screen). *Con:* the largest information-hierarchy change of the
three — moving "what next" above "how did I do" is a real UX-sequencing decision (score → reward →
retry is the sequence `TETO_RESULT-2_Fresh-Audit.md` §8 itself recommended and RESULT 2.0 Slice 1
already implemented), not a mechanical layout tweak, and risks feeling like it front-loads the
"leave" action before the player has seen their reward. *Scope:* `ResultPanel.tsx` JSX reorder +
possibly a duplicate/secondary compact CTA — the option most likely to need a Human Feel check
before shipping, per this codebase's own established practice for RESULT-adjacent changes.

**Comparison summary:** B is the smallest, most targeted fix and directly attacks the largest
measured contributor (§5); A is the most robust against future RESULT growth but changes chrome on
every round, not just tall ones; C best matches this codebase's own existing "single screen, no
scroll to act" precedent (Lunch Rush) but is the most design-sensitive of the three. **B and A are
not mutually exclusive** — B alone may not fully solve the CUT+discovered worst case (1.33×/
1.38×) even after removing the CUT block's ~150px, since the discovery/starter-grant banners
(§5 item 2, ~97px) still apply on exactly the rounds where this matters most (a new player's very
first completions). A future slice could ship B first (cheapest, most scoped) and re-measure
before deciding whether A is still needed for the worst case.

## 11. Recommended next implementation slice

**B (collapse the CUT evaluation block) first, as its own small slice — re-measure against the 6
scenarios in §5 before deciding whether A (fixed CTA) is still needed for the remaining worst
case.** Rationale: B is the only option of the three that is pure removal-of-unconditional-height
using a pattern (`<details>`) already proven and already shipped elsewhere on this exact screen
(the score bars), touches one file's JSX (`ResultPanel.tsx`) with no reducer/state/CSS-chrome
change, and directly targets the largest single content contributor found in this audit (§5). It
is also the lowest-risk of the three to a first-time player's experience, since it doesn't hide or
relocate the discovery/Pitz/retry information Phase 0/RESULT 2.0 both treat as RESULT's real
payoff — only a secondary, recipe-specific (today: margherita-only) detail block. A/C are better
suited to a follow-up slice once B's actual post-fix numbers are re-measured, per the "1つのP1に
フォーカスする" convention this codebase's own Visual Polish 2.0A/2.0B slices already followed.

## 12. Restricted-scope confirmation

This session did not read for editing, modify, or open a PR touching any of: `functions/**`,
Firebase config/rules (`firestore.rules`, `firestore.indexes.json`), any GitHub Actions
*production deploy* workflow, Player Profile, `setDisplayName`, `submitLunchRushScore`, ranking
backend/query logic, or any GitHub Environment setting. `git diff --stat` against `origin/main`
for this branch contains only this report file and PNGs under
`docs/reports/screenshots/visual-polish-2.0c-audit/`. `src/**` was **read only** (for the specific
files named in §5/§9/§10, to ground the improvement options in real code paths) — zero files under
`src/**` were written to.

## 13. Final Verdict

**A. Both P1-4 and P1-5 still reproduce on current `main` (`41a08cc2`) — proceed to implementation
as separate, focused slices, starting with P1-5 Option B.**

- P1-4: confirmed reproducing at both required viewports (85.7% locked in the first viewport on a
  fresh save), with one previously under-credited mitigation already in place (per-card unlock
  hints) that narrows the real remaining problem to first-glance visual hierarchy, not information
  availability.
- P1-5: confirmed reproducing in all 6 tested combinations at both required viewports, on the
  current already-merged single-screen RESULT (RESULT 2.0 Slice 1) — not for the two-phase reason
  Phase 0's text implied, but because the single screen's own content (banners + Pitz breakdown +,
  for CUT recipes, an unconditionally-expanded CUT block) still exceeds one viewport on a typical
  first-discovery round. A concrete, scoped, lowest-risk first fix (Option B) is identified and
  ready for its own implementation slice.

---

## 14. Duplicate Gate #2 (end of session, before PR)

Re-checked immediately before opening this session's PR:

- `git fetch origin` re-run: `origin/main` advanced from `41a08cc2` (this audit's own SHA, §1) to
  **`6534c079aaf030f26ccb51658cde2d409ad7bbbd`** — one new commit, **PR #148 "docs: IAM fix for
  Phase 4b — `firebaseProjectsGetOnly` custom role"** (the parallel Firebase Production Deploy
  Phase 4b / IAM session's own work). `git diff --stat 41a08cc 6534c07` confirms it touched only
  3 docs files under `docs/reports/TETO_FIREBASE-*` — no overlap with this audit's scope
  (Recipe Select / RESULT / Visual Polish). This audit's own findings (§4/§5, code-path-grounded
  against `PizzaSelectScreen.tsx`/`ResultPanel.tsx`/`App.css`, none of which #148 touches) are
  unaffected by this advance.
- Open PRs re-checked (`state:open`): #148 is no longer open (merged, as above); remaining open
  PRs are the same 5 as Duplicate Gate #1 (#105, #72, #46, #34, #3) — unchanged, still none
  overlapping this audit's scope.
- **Conclusion:** no duplicate/overlapping work appeared during this session. Proceeding to open
  a docs-only PR against the current `origin/main` tip (`6534c079`).
