# Lunch Rush v2 — PR-A: infrastructure / server compatibility (Result)

Base: `origin/main` `c62db170df02e87bf78bf952a146f0cc872ee666` (post-#389).
Scope: the first of two rollout-boundary PRs for Lunch Rush Ingredient Selection. **No gameplay and no
production-client change.** The production client keeps submitting `lunch-rush-v1` and reading the v1
weekly leaderboard. PR-B (gameplay + client activation) starts only after PR-A is merged and the
Functions are deployed and verified to accept both rulesets.

## What PR-A adds

| Area | Change |
|---|---|
| `src/shared/lunchRushScoring.ts` | `lunch-rush-v2` identity, `parseLunchRushRulesetVersion`, fixed accuracy table `[1, 0.8, 0.64]`, `LunchRushServeRecordV2` (`wrongIngredientTypes`), `isValidLunchRushServeRecordV2`, `calculateLunchRushMissionScoreV2`, per-ruleset dispatch. v1 exports are untouched. |
| `src/shared/lunchRushPeriodIds.ts` | `computeLunchRushPeriodIds(epochMs, ruleset = v1)` and `weeklyPeriodId(epochMs, ruleset = v1)`. v2 ids: `weekly_v2_<ISO week>`, `monthly_v2_<YYYY-MM>`, `all_v2`. Defaults keep every v1 id byte-identical. |
| `functions/src/submitLunchRushScore.ts` | Accepts exactly `lunch-rush-v1` and `lunch-rush-v2`; any other value is rejected. Validation, score recomputation and period ids are chosen per ruleset. The run ledger stores the submitted ruleset. |
| Tests | shared scoring (v2 table, validator, formula, golden vector, dispatch), period ids (v1 pinned, v2 separation), Functions handler (v1 unchanged, v2 accepted, separate boards, unknown ruleset rejected), `firestore.rules.test.ts` (`weekly_v2_*`, `monthly_v2_*`, `all_v2`). |

`firestore.rules` and `firestore.indexes.json` are **unchanged**: `weekly_v2_*` matches the existing
`^weekly_.*` read rule, writes stay denied, and the `entries` composite index is COLLECTION-scoped on the
collection id, so it applies to every `leaderboards/*/entries`.

## v2 scoring authority (Owner Decisions OD-LR-P1-1 / -2 / -3)

```
servedValue = (100 + qualityTotal) * factor[wrongIngredientTypes]
factor      = [1.00, 0.80, 0.64]   (w = 0, 1, 2; fixed table, no Math.pow)
w >= 3      -> Completion Gate FAILED (a PASS serve with w >= 3 is invalid under v2)
score       = Math.round(sum of servedValue over PASS serves)
```

`totalQualityScore` / `bestQualityScore` stay the raw (un-factored) quality figures, as in v1. A fixed table is
used so the browser (V8 / JavaScriptCore) and the Cloud Function produce bit-identical values. 0.80 / 0.64 are
gameplay calibration values: adjustable during PR-B HV; once v2 is public, a change needs a new ruleset id.

## Trust boundary (unchanged in kind)

The server still cannot re-derive a per-pizza `qualityTotal` (nor `wrongIngredientTypes`); both are client-reported
within validated ranges, exactly as `qualityTotal` is in v1. The server re-derives the Mission Score from the
serve log with the same shared code the client uses.

## Deferred to PR-B (not in this PR)

Candidate tray, hints, Reference Preview, `wrongIngredientTypes` computation, the `EXCESS_WRONG_INGREDIENTS`
Completion Gate reason, post-serve feedback, client switch to `lunch-rush-v2`, reading `weekly_v2_*`, and the
`lunch-rush-v2` `missionBest` key.

## Rollout after merge (Owner-gated)

1. Merge PR-A.
2. Firebase Production Deploy: `verify`, then `functions`.
3. Verify the deployed Function accepts v1 and v2 and rejects unknown rulesets.
4. Only then start PR-B.
