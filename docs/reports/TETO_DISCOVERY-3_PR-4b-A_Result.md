# Discovery 3.0 PR-4b-A: pool > 1 rules + foundations — Result Report

Branch `claude/pr-4b-implementation-gate-24nldn`, from `origin/main` `565cd05` (PR-4a #327 + hardening #328 merged; post-merge Deploy and WebKit both success).
Scope: Owner decisions D-1 / D-2 / D-3 (this PR) and the PR-4b-A / PR-4b-B split (Implementation Gate verdict B). **`brazilian-calabresa` is NOT added to production data; `RECIPES` stays 25.** #295 untouched. PR-4b-B is not started.

## 1. What changed (production)

| area | change |
|---|---|
| `logic/discovery/hintTarget.ts` | New `HintEmptyKind` `POOL`. With **more than one DISCOVERABLE recipe and no valid sticky target, nothing is auto-targeted** (`{ kind: "POOL" }`). A valid sticky target is kept (D-3). A pin is honoured only when the pool is 1, or when it is the sticky target: a pin never picks among several candidates. |
| `state/discoveryHint.ts` | `stickySessionTargetId` (revealed / Dex-pinned / paid session target). `isSessionTarget` passes it as sticky, so a paid / revealed target is never dropped or moved at a pool > 1. |
| `components/HintSheet.tsx` | `POOL` copy: 「まだ見つけていないピザがありそう！ / いろいろな材料の組み合わせを試してみよう。」 — no count, no name, no entry. |
| `components/DexOverlay.tsx` | Pool > 1 (state-derived, applies to migrated saves): ONE aggregated notice 「まだ発見できるピザがあるよ」 (`data-dex-aggregated`, CTA = plain Free Cooking, no pin). Each candidate slot is drawn like any other unknown slot (`data-dex-state="UNKNOWN"`, no 🎨, no 💡). |
| `state/pizzaSelect.ts` | The DISCOVERABLE prompt no longer carries a `count`. |
| `data/recipeHintRoles.ts` | `RECIPE_HINT_ROLES: Record<RecipeId, HintRoles>` (was `RecipeHintRoles`). The 25 entries are unchanged. |
| `data/recipes.ts`, `mission/lunchRush.ts` | `Recipe.lunchRush?: false` + `inLunchRush()`; filter in `missionOrderRecipeIds` (the one choke point: cookable pool, reducer order pick, start gate). No production recipe sets it. |

### Interpretation to confirm (D-1 wording)
D-1 says candidates are not shown as individual cards. Removing the slots would leak the count by arithmetic (chapter total − discovered − remaining cards) and by gaps in the fixed `No.` numbering. So the candidate slots **stay, drawn identically to every other unknown slot**, and the one aggregated notice is added. If the Owner wants the slots physically removed, that is a small follow-up, but it re-opens that leak.

## 2. Existing 25 unchanged
- `RECIPES` = 25; no recipe sets `ladderCredit` / `lunchRush`; none is key-free (`pr4bA.parity.test.ts`).
- The normal W1 walk has **exactly one DISCOVERABLE recipe at each of the 25 steps and auto-targets the W1 key recipe, as before** (test per step). A pin with a pool of one is still honoured.
- Economy sims (`HINT_ECONOMY_SIM_OUT` + `HINT5_ECONOMY_SIM_OUT`) on `main@565cd05` vs this branch: **byte-identical** (`cmp`, 1,498,176 + 95,285 bytes).
- Save schema unchanged: still v2, same 12 top-level fields (pinned). No persistence file changed.
- Behaviour that changes only for a **migrated / multi-DISCOVERABLE save** (D-2): no auto-target, aggregated Dex, no per-card hint. Includes a Dex-0 save with several materials already owned (the free Margherita onboarding then needs the pool to be 1).

## 3. Tests
- New: `pr4bA.parity.test.ts` (25-parity, per-step W1 walk, `HintRoles`, Lunch Rush flag, anti-leak: three pool sizes give identical `POOL` / sheet values, Pizza Select has no count, save schema), `DexOverlay.pool.test.tsx` (identical aggregated HTML for different pool sizes, constant card count, candidate slot = any unknown slot, no name/id leak, CTA un-pinned), pool tests in `hintTarget.test` / `branchingPool.test`, `e2e/discovery3-pr4b-a-pool-dex.spec.ts`.
- Rewritten for the new rule (intent kept): pin-based fixtures of the hint suites now start from a sticky session (`state/testSupport/hintSheetOpen.ts`); the old "each card hands over its own recipe" tests are replaced by the pool-1 version and the pool > 1 version.
- Results: unit **5556 passed / 1 skipped** (291 files); `tsc -b`, `npm run lint` (same 2 pre-existing warnings as `main`), `npm run build`, `scripts/ci/test-webkit-ci.sh` 61/61; Chromium Playwright, both projects (390×844 and 360×800), whole suite: **294 passed, 42 skipped (intentional one-project-per-engine skips), 0 failed**.

## 4. Human Verification
No production-visible change on the normal 25 path (pool ≤ 1). The new states exist only on a migrated pool > 1 save, so the Human Verification video and the real step-12 branch (portuguesa + calabresa) belong to **PR-4b-B**. Screenshots of the new states (390×844 / 360×800, migrated-save seed): `docs/reports/screenshots/discovery3-pr4b-a/`.

## 5. Not done / next
PR-4b-B: `brazilian-calabresa` data (calibration from the Owner decisions D-4 / D-6, recorded as gameplay calibration, not source authority; `source=olive → implementation=black-olive`, `likely_alias`; cheese-free because the source ingredient list has no cheese entry), reference slot assignment (Human Review before Preview/HV), order, 25→26 pins, CUT excluded (D-5), HV.
