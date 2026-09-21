# Teto Pizza Game — Recipe Select 2.0 — Phase 0 Fresh Audit

**Docs/screenshots-only task. No `src/**`, test, Firebase, workflow, or save-schema changes.**

Companion design document: `docs/design/TETO_RECIPE-SELECT_2.0.md` (layout comparison, locked
UX, category/search/sort/favorite decisions, recommended 2.0A/2.0B/2.0C architecture).

---

## 1. Fresh sync

- `git fetch origin` run at session start.
- `origin/main` HEAD at fetch time: **`1b0b764b0c09d0f74215a04f303095bea577a572`**
  ("docs: Firebase Production Deploy via GitHub Actions -- Phase 0 Fresh Design (Issue #134) (#135)").
- Working branch `claude/teto-recipe-select-2.0-audit-a866hp` was created from and is identical to
  this SHA (`git merge-base HEAD origin/main` == `git rev-parse HEAD` == the SHA above) — no
  rebase needed.
- Open PRs at fetch time (`list_pull_requests`, state=open): **#136** ("Pizza Cutting 1.0 Phase 4:
  Human Feel / Activation Fresh Audit (docs-only)") and **#133** ("Player Profile 1.0 Phase 1B:
  ranking display-name snapshot"), plus #105 (dev automation) and older docs-fix PRs (#72, #46,
  #34, #3). **Neither #133 nor #136 was read for merge purposes, modified, or merged** — confirmed
  by `git log`/`git status` showing no interaction with those branches this session.
- Past information referenced "15 recipes" in the task description; this was verified fresh
  against `src/data/recipes.ts` rather than trusted — confirmed accurate (§3).

## 2. Duplicate gate

`search_issues` (semantic) for "recipe select catalog filtering category search favorite 2.0"
against this repository returned **0 results**. No open Issue/PR proposes Recipe Select UX
changes. `docs/design/TETO_RECIPE-EXPANSION-20.md` / `TETO_RECIPE-MASTER-CATALOG.md` /
`TETO_RECIPE-MASTER-CATALOG_160_Fresh-Analysis.md` exist but scope *which recipes to add and in
what order* (content/data), not *how Recipe Select displays/organizes them* — no overlap. No
duplicate work found; proceeded.

## 3. Current implementation audit (code, verified against `main`)

Read in full: `src/screens/PizzaSelectScreen.tsx`, `src/state/pizzaSelect.ts`,
`src/data/recipes.ts`, `src/state/dex.ts`, `src/components/DexOverlay.tsx`,
`src/state/persistence.ts` (save schema), `src/data/cookingProfiles.ts` (CookingProfile),
`src/App.tsx` (HOME→PIZZA_SELECT→GAME routing), `docs/design/PIZZA_GAME_UI_SPEC.md`, and the
prior `TETO_UX-4_PIZZA-SELECT-PAGER_Result.md` / `TETO_INGREDIENT-ECONOMY-UI-SCALABILITY_Fresh-Audit.md`
(§9/§10.2, the pre-existing Scale Gate table this task's §3/§15 build directly on).

Key facts (see companion design doc §2 for the full table):

- **Production recipe count: 15**, confirmed by counting `id:` entries in `RECIPES`
  (margherita, marinara, quattro-formaggi, genovese, bismarck, funghi, fugazza, salsiccia,
  pepperoni, napoletana, tonno-e-cipolla, pizza-bianca, breakfast-pizza, capricciosa,
  meat-lovers).
- **UI is a single-recipe pager** (前へ/次へ, clamp-at-ends), rebuilt from an earlier full grid by
  Issue #88 (UX-4) specifically for the then-7-recipe catalog. The position indicator is already
  in **counter mode** (`N / 15`) today, since `pagerIndicatorKind` switches from dots to a counter
  above `PAGER_DOT_INDICATOR_MAX = 10` — confirmed live in the screenshots below.
- **No `category`/`tier`/`difficulty` field exists on `Recipe`.** Unlock is a single strict linear
  chain (`requiresRecipeId` + increasing `minTotalStars`), not a branching/categorized structure.
- **Exactly one recipe (`fugazza`) uses `mysteryLock`**; every other locked card shows its real
  name plus an unlock hint (`〇〇を1枚完成させると解禁` / `あと★Nで解禁`).
- **Dex (`DexOverlay.tsx`) already cleanly separates "what have I made"** (full description,
  ingredients, ★BEST, `timesMade`) from Select's "what will I make" — this division was already
  close to the task's own proposed §12 split before this audit began.
- **A pre-existing Scale Gate table already on record** (`TETO_INGREDIENT-ECONOMY-UI-SCALABILITY_Fresh-Audit.md`
  §10.2) recommends "flat grid + tier/chapter section headers" for the 11–30 recipe band. At 15
  recipes, production is already inside that band with no section headers implemented — UX-4's own
  result report explicitly deferred that rung to "whenever recipe content actually grows past
  Chapter 1," which is the state found this session.

## 4. Live UX audit — method

Ran the actual app (not just source reading): `npm install` (no `node_modules` present at session
start), `npm run dev` (Vite, port 5183), driven headlessly via Playwright
(`/opt/pw-browsers/chromium`, the environment's pre-installed browser) at both required
viewports. `localStorage`'s `teto-pizza-save-v1` key was seeded with a representative save (6 of
15 recipes discovered at varying ★1–★5/BEST scores, 0 Pitz, starter ingredients only) before each
page load, so screenshots capture real COMPLETED, NEW, and LOCKED-with-hint card states rather
than only the untouched-fresh-save default. This is read-only against the app (a `localStorage`
seed in a Playwright-driven browser tab, never a code change) and does not touch the save schema.

## 5. 390×844 findings

Screenshots: `docs/reports/screenshots/recipe-select-2.0-phase0/390x844-*.png`.

- **Recipes visible per screen: 1** (by design — the pager shows exactly one `RecipeDetailPanel`
  at a time).
- **Scrolling: none** — confirmed no vertical/horizontal scroll needed at this viewport for any
  card state (COMPLETED/NEW/LOCKED/mystery/last-in-list all fit without overflow).
- **Recipe name readability**: good — large centered heading, high contrast against the cream
  card background.
- **Locked recipe representation**: silhouette + 🔒 icon + real name + hint text (e.g.
  「サルシッチャ／フガッサを1枚完成させると解禁」) — clear, answers "what do I do next" directly, matches
  the task's own §7 priority.
- **Unlocked/NEW representation**: thumbnail + name + `NEW` badge + `未挑戦` status line.
- **COMPLETED representation**: thumbnail + name + ★★★★☆-style star row + `BEST 92`-style score.
- **Selected/current state**: implicit — there is no separate "selected" visual state distinct
  from "currently shown," since only one recipe is ever on screen; the position counter (`N / 15`)
  is the only indicator of where the player is in the list.
- **Difficulty / other info**: none shown — matches current data model (§3: no difficulty field
  exists).
- **前へ/次へ操作**: two pill buttons flanking the position counter; both large, clearly labeled
  with arrows, `disabled` (grayed, not hidden) at the first/last recipe respectively — confirmed
  at index 1/15 (前へ disabled) and 15/15 (次へ disabled).
- **戻る操作**: `🏠 ホーム` button, top-left of the header, present on every position.
- **タップ領域**: all four interactive elements (🏠ホーム, 前へ, 次へ, CTA) are comfortably large,
  no crowding, consistent with `PIZZA_GAME_UI_SPEC.md`'s 44×44px minimum.
- **Horizontal overflow**: none observed at any of the 5 captured states per viewport.
- **Breakdown at scale**: not a layout breakdown (nothing clips or overflows even at 15) — the
  breakdown is a *browsing-cost* one: reaching recipe 15 from recipe 1 requires 14 consecutive
  「次へ」 taps with no visibility into what's ahead beyond a bare `N / 15` counter. This is the
  central, measured finding driving the companion design doc's Layout recommendation (§4/§5
  there).

## 6. 360×800 findings

Screenshots: `docs/reports/screenshots/recipe-select-2.0-phase0/360x800-*.png`.

Identical behavior to 390×844 at every measured state (HOME, COMPLETED, NEW, LOCKED-with-hint,
last-recipe-LOCKED) — no horizontal overflow, no clipped text or buttons, same disabled-button
behavior at both ends of the list, same readability. The narrower/shorter viewport does not
introduce any new failure mode; the single-recipe-per-screen design has enough headroom margin
that 360×800 is not meaningfully tighter than 390×844 here.

## 7. Screenshot index

All in `docs/reports/screenshots/recipe-select-2.0-phase0/`, `{viewport}-{step}-{description}.png`:

| File suffix | Content |
|---|---|
| `01-home.png` | HOME screen (shows `レシピ 6/15` badge, `ビザ図鑑 発見 6/15` card) |
| `02-recipe-select-index0-completed.png` | Recipe Select, position 1/15, マルゲリータ, COMPLETED (★4, BEST 92) |
| `03-recipe-select-fugazza-mystery-locked.png` | Position 7/15, フガッサ — in this seeded save state, total ★ already clears its `minTotalStars: 12` gate, so it renders unlocked/NEW (mystery lock only applies while still locked) |
| `04-recipe-select-locked-with-hint.png` | Position 8/15, サルシッチャ, LOCKED with real name + chain hint |
| `05-recipe-select-last-locked.png` | Position 15/15, ミートラヴァーズ, LOCKED, 次へ disabled, CTA disabled |

Both `390x844-*` and `360x800-*` sets cover the same five states.

## 8. Scalability verdict

**Current implementation does not break at 15 (confirmed — no overflow, no crash, no mis-render
at either viewport). It is, however, already past the point the pre-existing Scale Gate table
(§3) flags for a structural change (flat grid + section headers at 11–30 recipes), and the
serial-tap browsing cost documented in §5 is the concrete mechanism that will make 30–50 recipes
materially worse without any further code defect** — at 30 recipes reaching the last one is 29
taps; at 50, 49 taps, always with zero visibility into what's ahead. See the companion design
document (`TETO_RECIPE-SELECT_2.0.md` §4/§5/§15) for the full layout comparison and the
recommended phased fix.

## 9. Validation

- `git status`/`git diff --stat` (post-write, see §10): only new files under `docs/design/` and
  `docs/reports/`, plus new PNGs under `docs/reports/screenshots/recipe-select-2.0-phase0/`.
- **No `src/**` changes.**
- **No test files changed.**
- **No Firebase config/workflow files changed** (`.github/workflows/**` untouched).
- **No save-schema changes** — `src/state/persistence.ts` was read, not edited; the Playwright
  audit only wrote to a running browser tab's `localStorage`, never to any file in the repo.
- Screenshots captured at both required viewports (390×844, 360×800) — §5/§6/§7.
- Findings cross-checked against currently-running code (live Playwright session against
  `npm run dev`), not against memory or the historical "15 recipes" figure in the task prompt
  alone.

## 10. Changed files (this session)

- `docs/design/TETO_RECIPE-SELECT_2.0.md` (new)
- `docs/reports/TETO_RECIPE-SELECT_2.0_Phase0_Fresh-Audit.md` (new, this file)
- `docs/reports/screenshots/recipe-select-2.0-phase0/*.png` (new, 10 files — 5 states × 2 viewports)

No other file in the repository was modified.

## 11. Post-audit merge-forward

This section documents a later, separate action against this same PR — **not** a re-audit.

- The Recipe Select investigation, findings, verdicts, and screenshots recorded in §1–§10 above
  were produced against `origin/main` at **`1b0b764b0c09d0f74215a04f303095bea577a572`**, and that
  remains the SHA this audit's actual content (layout comparison, UX findings, scalability
  verdict, screenshots) was performed against.
- After this audit was written and PR #137 opened, `origin/main` advanced to
  **`5b38304de1bcb0c2c946c37a18d3a130421e800f`** via the merge of **PR #138** ("Pizza Cutting 1.0
  Phase 4A: duplicate-line gate, Lunch Rush CUT feedback, RESULT clarification").
- This branch (`claude/teto-recipe-select-2.0-audit-a866hp`) was subsequently **merge-forwarded**
  to bring that newer `main` in — a routine merge-in of PR #138's already-merged history, with no
  conflicts. Nothing about Recipe Select, its screens, its data, or its UX was re-investigated,
  re-tested, or re-screenshotted as part of this merge; §1–§10's findings stand exactly as
  originally audited.
- This PR's own diff against `origin/main` (`docs/design/TETO_RECIPE-SELECT_2.0.md`,
  `docs/reports/TETO_RECIPE-SELECT_2.0_Phase0_Fresh-Audit.md`, and the 10 screenshots under
  `docs/reports/screenshots/recipe-select-2.0-phase0/`) is unchanged by this merge — still exactly
  the same 12 files, still docs/screenshots-only, still zero `src/**`/test/Firebase/workflow/
  save-schema changes.
- PR #138's own production changes (`src/**`, `functions/**`, its own reports/screenshots) are
  carried through unmodified by this merge — verified `src/**`/`functions/**` on this branch's new
  HEAD are byte-identical to `origin/main`.
