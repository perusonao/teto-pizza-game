# Sauce per-kind ledger — B1 (state / inventory / Completion Gate) Result

Issue line: #489 (Sauce Remaining Gauge). Design: B1 / B2 / B3 detailed design (Owner-approved 2026-10-14). **B1 only** — B2 (layered
painting) and B3 (gauge link-up) are NOT started; PR #494 is on HOLD and untouched. Base: `main` `b636c82`.

## What B1 does
- **History kept.** A sauce switch no longer replaces `sauceDeposits`. `sauceIds` collects the kinds actually committed (first-use order).
  `SauceDeposit.ingredientId?` (optional, additive) says who laid a deposit. A single-sauce pizza keeps the historical shape (no stamp);
  when a second kind is committed, every earlier deposit is stamped with the only sauce used so far. All-or-none.
- **Caps.** Each kind 100% (`SAUCE_MAX_QUANTITY`, unchanged); the pizza-wide cap is the constant `SAUCE_TOTAL_MAX_QUANTITY = 2.0`
  (**provisional**, Owner: final value decided after Human Verification). The dispenser reads one headroom
  (`sauceHeadroom` = min(kind's own, total)); the reducer re-checks both caps, but only once two kinds are involved.
- **Inventory.** Unchanged: consumed once at CONFIRM_BAKE (`consumePizzaInventory`), one unit per kind in `sauceIds`. Because `sauceIds`
  now keeps every kind that actually laid sauce, a sauce laid and then switched away from is consumed too (the old free-switch loophole is
  closed). A kind that laid nothing (cancelled / rejected stroke, or blocked by the cap) is never registered, so it is not consumed.
- **Completion Gate.** The required sauce is judged by its own deposits (every deposit when one kind is on the pizza). Another sauce never
  stands in; the one-shot exemption holds only for an empty log.
- **Scoring 2.0 + live 「ソースのでき」.** Reference sauce's own deposits. An extra kind is an extra type in the Recipe component's existing
  purity penalty (no weight / ruleset change).
- **Research / Dex / Dinner.** No code change was needed in the matcher: no catalog target uses two sauces, so a mixed pizza matches nothing.
  Pinned by tests (below). `signature.ts`'s `spreadLayers` reason text was the only edit (the value is unchanged).

## Single-source compatibility (the acceptance condition)
`src/state/sauceB1.singleSource.golden.test.ts` + `__golden__/sauceB1.singleSource.json` (55 recipes × 10 scenarios: state, hint, Scoring 2.0,
Completion Gate, signature, near-miss, Free Cooking outcome, advice, inventory consumption) was generated on the logic **before** B1 (first
commit, no logic change) and is **not edited** by B1. It passes unchanged. (The attempt-fingerprint is a pure function of the signature; the
fingerprint module is not imported by the golden because `attemptFingerprint.gate.test.ts` restricts who may reference it.)

## Tests added
| File | Covers |
|---|---|
| `sauceB1.singleSource.golden.test.ts` | the frozen single-source behaviour (above) |
| `state/sauceLedger.test.ts` | ledger functions, single-kind == old cap bit-for-bit, caps, `planSauceCommit`, live deposits, sanitizer |
| `state/gameReducer.sauceKinds.test.ts` | history kept, stamping, token/origin, stock gate, reducer caps (multi only), inventory per kind, CONFIRM_BAKE exactly once |
| `logic/sauceKinds.gateAndScoring.test.ts` | Gate by own deposits, Scoring own deposits + purity, advice unchanged, single-kind pooled == own for all recipes |
| `logic/discovery/sauceKinds.research.test.ts` | no false discovery / Free Cooking match / Dinner identity for any recipe + extra sauce; near-miss reveals nothing |
| `logic/sauceDispenseController.headroom.test.ts` | classic cap unchanged; `getHeadroom` cap incl. mid-batch |
| `components/PizzaStage.sauceKinds.test.tsx` | the cap through the real PizzaStage (per-kind 100%, total, switch, switch back) |

## Behaviour changes (intended)
Only when one pizza carries **two or more** sauce kinds (impossible before — a later sauce replaced the earlier): history kept, per-kind and
total caps, both kinds consumed, extra kind penalised as an extra type, no recipe match. One-sauce pizzas are byte-identical.

## Known limits / follow-ups (not B1)
- **Interim visuals.** B2 is not built: a multi-sauce pizza is still drawn as ONE heatmap (all deposits, coloured by the latest sauce).
  B1 must not ship to players without B2.
- **No gauge.** B3 connects the gauge; #494's accumulate-across-switch logic is superseded by the ledger and stays on HOLD.
- **Stray taps (UX, recorded for later).** Any committed stroke — even one starter tick from an accidental tap — registers its kind, and the
  stock is consumed at the bake. There is no sauce undo. Owner Decision: not addressed in B1; to be handled as a follow-up UX issue
  (candidates: minimum press time, confirm on switch, a "redo sauce" control).
- **Lunch Rush.** One-sauce behaviour unchanged (covered by the existing suites). Whether Lunch Rush allows multi-sauce is a separate decision.
- **Human Verification video.** B1 has no visual change; per the approved design the behaviour is shown in B3's video (360×800/390×844).

## Verification
See the PR (CI + Codex).
