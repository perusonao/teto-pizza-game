# Full Game Reset / はじめから — Issue #89, Reset 1A Result

- **Base `main` SHA:** `2ae37f1e022acb9fcf4bac644e38bd00fb1ff5f7` — re-confirmed fresh via
  `git fetch origin && git rev-parse origin/main` both at session start and again immediately
  before this report was written (Duplicate Gate #2); identical to the Fresh Audit's own
  baseline SHA, so no re-adaptation of the audit's findings was needed.
- **Implementation branch / HEAD:** `claude/teto-pizza-reset-1a-yr7h4n`, built directly on the
  SHA above (not on the audit branch).
- **Issue:** [#89 — Full Game Reset / はじめから](https://github.com/perusonao/teto-pizza-game/issues/89)
- **Audit:** `docs/reports/TETO_FULL-GAME-RESET_89_Fresh-Audit.md`
  (`claude/teto-pizza-reset-audit-w5pdem`) — Verdict A, READY FOR IMPLEMENTATION.

---

## 0. Duplicate Gate

- **Gate #1 (before implementation):** `git fetch origin` — `origin/main` was already at the
  audit's own baseline SHA (unchanged since the audit ran). No open PR targets #89 or touches
  reset/save-wipe work (checked all 5 open PRs: #105 dev automation, #72 docs, #46 Dough
  Shaping D0 audit, #34 Issue #32 visuals, #3 old Phase 2 docs). No other branch name contains
  `reset`/`settings`/`new-game` besides this session's own implementation branch and the
  read-only audit branch.
- **Gate #2 (immediately before this report/PR):** re-ran the same fetch + open-PR check —
  `origin/main` unchanged, no new reset-related PR or branch appeared. Proceeding.

---

## 1. Reset Architecture

**Option B from the Fresh Audit (§13): `resetSave()` (a verified `clearSave()`) + a full page
reload.** No new "reset" state-construction code exists anywhere — the reload re-runs the exact
same mount-time initializer every real first launch already runs
(`loadSave()` → `createDefaultSave()` fallback → `applyStarterGrants()` → `createInitialGameState()`,
all pre-existing, untouched by this change), and the reload itself discards every one of
`App.tsx`'s ~14 other `useState`/`useReducer` hooks (screen, overlay flags, mission run state,
drag/gesture transients, ...) for free — no manual per-field or per-hook reset list to keep in
sync as the app grows.

```
Confirm 「最初からやり直す」
  → resetSave()            // clearSave() + verifies the key is actually gone
  → success? window.location.reload()
      → normal App mount
      → loadSave() → no key → createDefaultSave()
      → applyStarterGrants() (no-op on an empty dex)
      → createInitialGameState()
```

No `RESET_GAME` reducer action, no new save schema, no schema version bump, no manual field
zeroing anywhere.

---

## 2. Changed Files

| File | Change |
|---|---|
| `src/state/persistence.ts` | Added `resetSave(storage)` — calls the pre-existing `clearSave()`, then verifies via `getItem` that the key is actually gone before reporting success. `clearSave()` itself is unchanged. |
| `src/App.tsx` | Added `isSettingsOpen` state, `handleResetGameData()` (calls `resetSave()`, reloads only on success), wired `SettingsOverlay` into the overlay stack and `isGlobalOverlayOpen`. No reducer/action changes. |
| `src/screens/HomeScreen.tsx` | Enabled the previously-`disabled` ⚙️ button (`onOpenSettings` prop), removed the "設定は近日公開" tooltip/`aria-disabled`. |
| `src/components/SettingsOverlay.tsx` (new) | Settings overlay (reuses the existing `.dex-overlay` shell) holding exactly one control today: Full Game Reset, with its own two-stage confirmation modal. |
| `src/App.css` | New `.settings-overlay__*` / `.settings-reset-confirm__*` rules only — no existing selector edited. |
| `src/state/persistence.test.ts` | +7 unit tests for `resetSave` (success, idempotent double-call, no-storage, throwing storage, silently-failing storage). |
| `src/App.fullGameReset.test.tsx` (new) | +15 integration tests (entry point, confirmation UX, execution, post-reset fresh state) through the real `App`. |

No changes to `gameReducer.ts`, `dex.ts`, `progression.ts`, `starterStock.ts`, recipe/ingredient
data, scoring, cooking timing, or the save schema/version.

---

## 3. UI Entry Point

HOME's ⚙️ "設定" button — previously `disabled` with a "設定は近日公開" tooltip (per the Fresh
Audit's own §16 observation) — is now the entry point, per the audit's first-candidate
recommendation. It opens `SettingsOverlay`, whose only content today is Full Game Reset (no
other settings were invented; per the task's own scope guard, "Resetに必要な最小変更のみ"). No
HOME layout change beyond enabling this one existing, already-reserved control — the concurrent
AI UI/UX Visual Review track's HOME redesign is untouched.

---

## 4. Confirmation UX

Two-stage, matching #89's own suggested copy exactly:

1. **Trigger** (inside Settings): "ゲームデータをリセット" — never itself destructive.
2. **Confirmation modal:**
   - Title: 「ゲームデータをリセットしますか？」
   - Body: 「Pitz・材料・レシピ解放・ピザ図鑑・ベスト記録など、すべての進行状況を最初からやり直します。」
   - Actions: 「キャンセル」 / 「最初からやり直す」（visually distinct — muted vs. red/destructive）

Safety properties verified (browser + tests):

- **No one-tap reset** — reaching the destructive action requires Settings → trigger → modal → confirm.
- **Cancel never mutates storage or GameState** — verified at both the unit and browser level (§8).
- **Backdrop tap does nothing** — the confirmation's backdrop has no `onClick` at all, matching
  this codebase's existing `.dex-overlay`/Shop/Inventory overlay convention (none of them close
  on outside-tap either), so an accidental outside tap can neither close nor confirm.
- **No accidental Enter-default** — plain `<button type="button">` elements outside any `<form>`,
  no `autoFocus` on either action.
- **Double-tap safe** — a synchronous `useRef` guard blocks a second `confirmReset()` call before
  React even re-renders with the `disabled` state applied; both buttons also disable once a reset
  is in flight (「リセット中…」).

---

## 5. Canonical Initialization Reuse

No fresh-state values are hardcoded in the Reset UI. `SettingsOverlay`/`handleResetGameData` only
call `resetSave()` + `window.location.reload()` — every fresh-player value (Pitz 0, empty finite
inventory, the 3 Starter ingredients unlimited, Margherita-only recipe availability, empty Dex,
empty `starterGrantClaimedRecipeIds`, empty `missionBest`) comes from the pre-existing
`createDefaultSave()` / `createInitialGameState()` / `applyStarterGrants()` path, unmodified by
this change and re-verified directly against current `main` (§1/§3 of the Fresh Audit) before
implementation began.

---

## 6. Persistence / Failure Handling

`resetSave()` (new, `persistence.ts`) wraps the pre-existing `clearSave()`:

```ts
export function resetSave(storage = getDefaultStorage()): boolean {
  if (!storage) return true;          // no storage at all -> loadSave() already falls back to fresh
  clearSave(storage);
  try {
    return storage.getItem(SAVE_STORAGE_KEY) === null;
  } catch {
    return false;
  }
}
```

`clearSave()` itself still swallows storage errors (matching every other writer in this module),
which is correct for its original best-effort dev/test use but not enough for a player-facing
destructive action — `resetSave()` adds the verification step so App.tsx never reloads (or shows
success) after a `removeItem` that silently failed to actually remove the key. On a verified
failure, `SettingsOverlay` shows「リセットに失敗しました。もう一度お試しください。」and re-enables
both buttons for a retry, instead of reloading into what would look like a stale, not-really-reset
game.

---

## 7. Migration Interaction

Reset operates one level below migration (it deletes the raw storage bytes migration would
otherwise read) — verified directly: a raw `schemaVersion: 1` save, loaded (migrating in-memory),
then reset, leaves `localStorage` with no key at all; the next `loadSave()` takes the
"no item" branch straight to `createDefaultSave()`, never touching the v1→v2 migration branches.
Covered by `App.fullGameReset.test.tsx`'s "an old (v1) save migrated in memory still resets to a
clean v2 default" test.

---

## 8. Starter Grant / Atomicity Verification

`resetSave()`'s single `removeItem` clears `inventory`, `ownedIngredientIds`, and
`starterGrantClaimedRecipeIds` together (one JSON blob, one key) — the same atomicity argument the
Fresh Audit's §6 already established for `clearSave()`. Verified directly:
`loadSave(storage)` after a reset deep-equals `createDefaultSave()` exactly (all 6
`PersistentSaveV2` fields, including a non-empty `starterGrantClaimedRecipeIds` in the seeded
progressed save) — both at the unit level (`persistence.test.ts`) and the integration level
(`App.fullGameReset.test.tsx`, seeding `dex`/`pitzBalance`/`ownedIngredientIds`/`inventory`/
`missionBest`/`starterGrantClaimedRecipeIds` all non-default at once).

---

## 9. Firebase Separation

No Firebase code was added or touched. `handleResetGameData()` calls exactly `resetSave()` +
`window.location.reload()` — no sign-out, no identity/account call, no network call of any kind.
Confirmed no `firebase` dependency exists in `package.json` (unchanged by this PR).

---

## 10. Scope Guard

Not touched: scoring, Completion Gate, Cooking Time, economy balance, recipe data, ingredient
data, Starter Grant semantics, Lunch Rush rules, Firebase, Shop, Dex layout, Ingredient Tray,
HOME's overall layout (only the pre-existing ⚙️ button's `disabled` state was removed), save
schema/version (`schemaVersion` stays `2`).

---

## 11. Tests

All new, none duplicating existing `clearSave` coverage:

**`src/state/persistence.test.ts`** (+7, `describe("resetSave ...")`):
removes a progressed save and reports success · idempotent on an already-empty save ·
idempotent across two consecutive calls (no corruption) · no-storage reports success ·
throwing storage reports failure · a storage whose `removeItem` silently no-ops (key survives)
reports failure.

**`src/App.fullGameReset.test.tsx`** (+15, real `App`, real `localStorage`):
Settings entry point enabled + opens overlay · closes via 閉じる · confirmation shows required
title/body/both actions and does not reset merely by opening · **cancel leaves storage/HOME
completely unchanged, including across a reload** · backdrop tap does not reset · buttons disable
+ show「リセット中…」while in flight · confirm clears storage to exactly `createDefaultSave()` and
reloads exactly once · **double-click reloads exactly once, storage stays a single valid fresh
state** · **a migrated v1 save still resets to a clean v2 default** · post-reset HOME shows Pitz 0
/ 0 discovered · **only Margherita is available, every other recipe locked** (checked generically,
not by hardcoded recipe name — array order ≠ unlock-chain order) · Margherita's round reaches
PREPARE with only Starter ingredients · Inventory shows only the 3 Starter ingredients · Dex shows
0 discovered · **stays fresh across a second reload** (no resurrection).

Together these cover the Fresh Audit's acceptance matrix (§19 A–O): Pitz/inventory/recipe
progression/Starter Grant ledger/Dex/BEST/stars/timesMade/missionBest reset (via the exact
`createDefaultSave()` deep-equal) · cancel unchanged · reload-fresh · Margherita playable ·
double-click safety · migrated-save reset.

**Full suite:** `82` test files, `1625` tests (`1604` pre-existing + `21` new), all passing — zero
regressions.

---

## 12. Browser Verification

Driven with a headless Chromium (Playwright, pre-installed at `/opt/pw-browsers/chromium`)
against `npm run dev`, at both required viewports, seeding a heavily progressed save
(`pitzBalance: 999`, one discovered Dex entry, an extra owned/finite ingredient with stock, a
non-empty `starterGrantClaimedRecipeIds`, a `missionBest` entry) before each run:

**390×844** and **360×800**, both runs:

- Flow 1 (Cancel): progressed save → Settings → Reset trigger → confirmation → キャンセル →
  modal closes, HOME still shows `Pitz残高 999` → reload → still `Pitz残高 999` (cancel never
  touched storage).
- Flow 2 (Confirm): same progressed save → Settings → Reset → confirmation → 最初からやり直す →
  lands on HOME with `Pitz残高 0` → Pizza Select shows Margherita → Inventory shows only the 3
  Starter ingredients (∞ stock), no extra ingredient → Dex shows `発見 0 / 11` → reload → still
  `Pitz残高 0` (fresh state persists).
- **Console errors:** `0` (both viewports).
- **Horizontal overflow:** `0` (both viewports, checked before and after the full flow).

---

## 13. Screenshots

`docs/reports/screenshots/full-game-reset-1a/`:

- `settings-390.png` — Settings overlay with the Reset trigger.
- `reset-confirm-390.png` — confirmation modal (390×844).
- `after-reset-home-390.png` — fresh HOME post-reset (Pitz 0, レシピ 0/11, 材料 3/18種).
- `after-reset-inventory-390.png` — Inventory showing only the 3 Starter ingredients, ∞ stock.
- `reset-confirm-360.png` — confirmation modal (360×800).

---

## 14. Verification Summary

| Check | Result |
|---|---|
| Focused tests (`persistence.test.ts`, `App.fullGameReset.test.tsx`) | ✅ 22/22 passing |
| Full test suite (`npx vitest run`) | ✅ 1625/1625 passing, 82 files |
| `npx tsc -b` | ✅ clean |
| `npx oxlint` | ✅ clean |
| `npm run build` | ✅ built in 544ms |
| Browser 390×844 | ✅ cancel/confirm/reload flows, 0 console errors, 0 overflow |
| Browser 360×800 | ✅ cancel/confirm/reload flows, 0 console errors, 0 overflow |

---

## 15. Remaining Risks

- **P1 — Entry-point churn:** the ⚙️/Settings location may need to move once the concurrent AI
  UI/UX Visual Review 1.0 track lands a real Settings screen/HOME redesign — same risk the Fresh
  Audit already flagged (§22), unchanged by this implementation; `SettingsOverlay` is a small,
  easily-relocated component, not deeply integrated into HOME's markup.
- **P2 — Reload UX on a slow device:** the confirm path necessarily shows a brief blank/loading
  flash (a real `window.location.reload()`) — not a correctness issue, not separately hardened
  here per the audit's own "do not over-design" guidance.
- **None found in Starter Grant/migration/atomicity** — all three were re-verified directly
  against current `main` and are structurally guaranteed by the single-storage-key design, not by
  new reset-specific logic.

---

## 16. Final Verdict

# **A. READY TO MERGE**

Every Fresh Audit acceptance criterion (§19 A–O) is covered by a passing test; both required
browser viewports verified with 0 console errors and 0 horizontal overflow; the full test suite,
`tsc`, `oxlint`, and `npm run build` are all green; no schema, gameplay, or Firebase code was
touched; the change is exactly the audit's recommended "thin UI + integration slice around
`clearSave()`" — no new fresh-state construction, no per-field reset list to maintain.

---

## 17. Main Merge / Conflict Resolution (post-PR #107)

PR #107 ("Visual Polish 1A: Ingredient Tray scroll cue for hidden ingredients") squash-merged to
`main` (`c40f9571322e464a9e9db3fa531cf8a1ef3a4daa`) while this PR was open, leaving PR #106
`mergeable=false`. Resolved on the same branch (`claude/teto-pizza-reset-1a-yr7h4n`), no new PR:

- **Fetched** `origin/main` — new HEAD `c40f957` (one squash commit past this PR's original base
  `2ae37f1e0`), containing only `#107`'s own changes: `src/App.css` (+69 lines, an
  IntersectionObserver-driven scroll cue for the Ingredient Tray), `src/components/
  IngredientTray.tsx`, a new `IngredientTray.scrollCue.test.tsx`, and its own Result Report +
  screenshots. No file it touched overlaps this PR's non-CSS files.
- **Conflict:** `src/App.css` only — both PRs appended new rule blocks near the same region of
  the file (`#107`'s `.ingredient-scroll-cue*` rules and this PR's `.settings-overlay*`/
  `.settings-reset-confirm*` rules land close together relative to each `git diff`'s own context,
  but touch disjoint line ranges within it).
- **Resolution:** `git merge origin/main` — Git's own three-way merge (`ort` strategy) resolved
  `App.css` automatically with **no manual edits and no conflict markers**; every rule from both
  PRs is present and intact post-merge (verified directly: `.ingredient-scroll-cue`/
  `.ingredient-scroll-cue__chevron` from #107 and `.settings-overlay__section`/
  `.settings-reset-confirm*` from this PR all still exist, at their own distinct positions in the
  file). No other file conflicted. Nothing from either PR's own spec was altered, trimmed, or
  reordered by the merge — this was a pure git auto-merge, not a manual reconciliation.
- **New HEAD:** `8bfb88fec858e0b2e6a71fa15a163ba55b7dc747` (merge commit `Merge remote-tracking
  branch 'origin/main' into claude/teto-pizza-reset-1a-yr7h4n`, `claude/teto-pizza-reset-1a-yr7h4n`).
- **Re-verification after merge:**
  - Focused (`persistence.test.ts` + `App.fullGameReset.test.tsx` + #107's own
    `IngredientTray.scrollCue.test.tsx`): **105/105 passing**.
  - Full suite: **1630/1630 passing**, 83 files (1625 from this PR + 5 new from #107). One
    transient failure (`phase4a1a.regression.test.ts`, a pre-existing `Math.random`-seeded recipe
    test unrelated to either PR's diff) appeared once when run as part of the full 83-file suite
    and was confirmed a pre-existing order-dependent flake: it passes in isolation and the very
    next full-suite run was 1630/1630 clean with no code changes in between.
  - `npx tsc -b`: clean.
  - `npx oxlint`: clean.
  - `npm run build`: succeeds (`vite build`, 814ms).
  - Browser re-check at **390×844** and **360×800** (same Cancel/Confirm/reload flows as §12):
    unchanged results — 0 console errors, 0 horizontal overflow at both, Reset 1A's own UI
    unaffected by #107's Ingredient Tray scroll cue landing in the same stylesheet.
- **Scope:** no unrelated spec changes made to satisfy the merge — both PRs' behavior is fully
  preserved as authored; this section is additive documentation only.

**Verdict unchanged: A. READY TO MERGE.**
