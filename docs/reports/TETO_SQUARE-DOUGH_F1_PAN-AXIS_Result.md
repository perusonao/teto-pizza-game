# Square Dough F1 — `pan` identity axis (Issue #538 / Epic #532)

Owner decisions 2026-10-18: `PizzaState.pan?` is a new optional field (absent / `null` = ordinary cook, `"tray"` = 天板焼き); the pan is **never inferred from `squareDough`**. F1 only; Technique / Dex / RESULT / Research display and the ○□ switch are F2–F4.

## Changes
| File | Change |
|---|---|
| `src/state/pizzaState.ts` | `PanId = "tray"`, `PizzaState.pan?: PanId \| null` (optional; `createEmptyPizza()` unchanged). |
| `src/logic/discovery/signature.ts` | `pan` is now `OBSERVED`; `signatureOfPizza` reads `"tray"` → `"tray"`, anything else (absent, null, malformed) → `null`. `shape` stays `UNAVAILABLE`. |
| `matcher.ts` | **unchanged** — its exact-match comparison already compares every non-`UNAVAILABLE` axis by value. |
| `attemptFingerprint.ts` | **unchanged** — a non-default OBSERVED axis enters `ext` sparsely, so an ordinary cook keeps its exact `fp1:` string. |
| tests | new `panAxis.test.ts` (identity separation with synthetic targets), pan cases in `attemptFingerprint.test.ts`, the "no axis is OBSERVED" canaries narrowed to "only `pan`", the Sauce B1 golden's `signature` hashes (below). |

## Compatibility
* No recipe or catalog target sets a pan; no code writes `PizzaState.pan`. Production behaviour is unchanged (F1 is inert until F4/E).
* **Sauce B1 single-source golden:** the golden hashes the whole signature including each axis's `status`, so `pan` `FIXED_BY_FLOW` → `OBSERVED` changes all 550 `signature` hashes. Only those 550 values were rewritten; `state`, `scoring`, `near`, `free`, `consume`, `completion`, `advice` and every other field are byte-identical (checked by script against a regenerated copy), and no recipe was added to the golden.
* Canary tests that asserted "no axis is OBSERVED" now assert "only `pan` is OBSERVED" (the fingerprint gate also pins the OBSERVED row list to `["pan"]`). Nothing was skipped, retried or loosened beyond that intentional change.

## Verification
`tsc -b`, `npm run build`, oxlint (existing warnings only), Vitest 439 files / 8377 tests passed (2 skipped, pre-existing), Chromium 390×844 `tq-1d-no-sauce` + `discovery-research-target` 8 passed. The Anti-Oracle gates (`deductionProduction.gate`, Hint 5.0 gates, DH4 privacy sweeps) pass unchanged. WebKit runs in CI.

Human Verification: not required (no visible change; `TETO_HUMAN-VERIFICATION-POLICY.md` §2).
