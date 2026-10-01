# Discovery 3.0 PR-1: Oracle Neutralization — Result Report

Branch `claude/discovery3-pr1-oracle-neutralization`, from `origin/main` `5c8190f`.
Authority: OD-D3-20 / OD-D3-23 (S2 Implementation Gate, Owner decisions after the S1 review).

## 1. Production behaviour change

Before: for a free-cook pizza whose ingredient set + sauce base exactly matched a discoverable recipe but failed that
recipe's Completion Gate (`INCOMPLETE_MATCH`), the result differed from every other undiscovered pizza in three ways:
(a) lead 「図鑑のピザまであと少し…！」, (b) no near/far row, (c) no Trial Notebook record (no 「試作#n」 on retry).
Each one told the player "your combination is correct".

After:
| channel | before (INCOMPLETE) | after (INCOMPLETE) |
|---|---|---|
| lead | あと少し… | `図鑑にはまだ載っていないピザ！` (same as ORIGINAL/AMBIGUOUS) |
| near/far row | none | classified against the *other* discoverable candidates (the matched recipe is excluded); generic FAR line when nothing is nearer |
| Notebook | not recorded | recorded like ORIGINAL (`#n`, duplicate notice on retry) |

Discovery success conditions, matcher, Completion Gate, scoring, Dex, ladder, save schema: unchanged.

## 2. Execution advice (recipe-independent only)
`src/state/executionAdvice.ts`: when the sauce is below the Completion Gate's own floor
(`isSauceBelowMinimum`, shared with the gate; all recipes share the same sauce reference so it is recipe-independent),
the free-cook ORIGINAL card shows `ソースが少なめかも。もう少し広く塗ってみよう。` — for *any* composition.
No bake advice (the recipe's own window would leak the recipe). Recipe-specific bake-window-only failures are
deliberately not explained (OD-D3-23).

## 3. Notebook
Stores only the player's own attempt fingerprint, `#n`, retry count and the already-shown near/far row. Nothing about
hidden target, correct count, distance or "構成が正解だった".

## 4. Tests
- New: `executionAdvice.test.ts`, `oracleNeutralization.test.tsx` (exact+thin vs other+thin through the real reducer and
  ResultPanel: same lead, same row, same Notebook outcome, byte-identical card HTML except the ingredient list).
- Updated old pins (13 tests) to the new behaviour.
- E2E 390×844: `discovery3-oracle-neutralization.spec.ts` (new), `discovery-near-miss-result`, `original-result-duplicate-notice`.
- Unit suite 5384 passed; `tsc -b`, `oxlint` (no new warnings), `vite build` OK.

## 5. Known consequences
Honest players with the correct combination and a thin sauce see the generic far line plus the thin-sauce advice; a
correct combination failing only the recipe's own bake window gets a neutral ORIGINAL with no explanation. Technique
discovery for INCOMPLETE is unchanged (TQ-1D re-check is a follow-up).

## 6. Human Verification Videos
Delivered directly to the Owner (not committed), 390×844, 25 fps:
- `pr1-exact-vs-other-thin-390x844.webm` (13.6 s)
- `pr1-good-sauce-390x844.webm` (8.5 s)

Format: WebM/VP8. MP4/H.264 conversion was not possible (Playwright's bundled ffmpeg has no H.264 encoder; no system
ffmpeg). Validated with the bundled ffmpeg (`-i`): 390x844, vp8. Video Verification: **PASS**.

Screenshots: `docs/reports/screenshots/discovery3-pr1-oracle-neutralization/` (`before_K1/K2` from the S1 oracle run;
after: `exact-thin-*`, `other-thin-*`, `exact-good-discovery`, `other-good-no-advice`, `c4-incomplete-match`,
`incomplete-first-attempt-N390`).
