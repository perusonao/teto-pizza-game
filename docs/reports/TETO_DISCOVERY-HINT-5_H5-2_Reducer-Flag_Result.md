# Discovery Hint 5.0 — H5-2 Reducer Integration behind the Flag: Result

- **Issue:** #292.
- **Authority:** `docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md` (Owner Decisions rounds 1–4).
- **H5-1 head:** `de11ae2` (approved).
- **Audited `main`:** `86b48fd`, re-fetched before implementation. Unchanged since H5-1.
  - PR #293 (head `1bb4f9d`) and Issue #292 are also unchanged.
  - No new comment and no new authority, so no impact analysis was needed.

**Scope:** H5-2 only. The H5-1 pure layer is wired into the reducer **behind a flag that is OFF in
every build**. Nothing below touches:
- any UI;
- the save schema or persistence code;
- P4 / P4b (the empty-rung semantics stay RESERVED_EMPTY_RUNG);
- M2 (no activation policy);
- a taxonomy family;
- 62 / 172;
- TQ-1D, #275, #260 or PR #291 / #293 / #295.

## 1. Changes

| File | Change |
|---|---|
| `src/logic/discovery/hint5Flag.ts` (new) | `HINT5_LADDER_ENABLED = false`, a one-line switch |
| `src/state/discoveryHint.ts` | `requestHint5RungFact(state, expectedRungIndex, enabled)`, a thin wrapper around H5-1's `requestHint5Rung`. It adds no second implementation.<br>• ANSWERED → it debits and appends facts in one patch.<br>• Every other outcome → `null`.<br>`hint5SheetView(state, enabled)` returns the H5-1 view model (no UI reads it). |
| `src/state/gameReducer.ts` | New action `PURCHASE_HINT5_RUNG { expectedRungIndex }`. Its guard is the same as PURCHASE_SELECTABLE_HINT (sheet open, Free Cooking PREPARE), and it is added to the Dinner-blocked actions. With the flag ON, `PURCHASE_SELECTABLE_HINT` (材料 / 構成 / 特徴) is refused, so no sub-topping name is sold (OD-H5-C3). With the flag OFF that line is inert. |
| `src/logic/discovery/hint5Production.gate.test.ts` | The wiring-boundary gate moves from "unwired" to "the only production importer is `state/discoveryHint.ts`" |
| `src/state/gameReducer.hint5.test.ts` (new) | Flag ON (mocked), 14 tests |
| `src/state/gameReducer.hint5.flagOff.test.ts` (new) | Flag OFF parity, 4 tests |
| `src/state/gameReducer.hint5.invalidTaxonomy.test.ts` (new) | Flag ON with mocked invalid roles, 2 tests |
| `src/logic/testSupport/hint5EconomySim.ts` (new, test-only) | The P-C progression walk through the real reducer |
| `src/logic/hint5Economy.sim.test.ts` (new) | Static P-C invariants and the walk, 4 tests |

**Dex-0 Margherita.** The onboarding keeps its existing free, session-only Hint 2.0 reveal. The
ladder never serves or charges it (Final Design R5: "as today").

## 2. Flag OFF parity (the production build)

- `HINT5_LADDER_ENABLED === false`.
- For every target and index, `PURCHASE_HINT5_RUNG` returns the same `state` object.
- `hint5SheetView` / `requestHint5RungFact` return `null`.
- 材料 / 構成 still charge 5 and store the same facts. The onboarding is unchanged.
- Every pre-existing suite runs with the flag off and passes **unchanged**: the full Vitest run
  below, plus the hint E2E specs.

## 3. Flag ON reducer integration (all through the real reducer)

| Check | Result |
|---|---|
| Only the next rung is purchasable | Any other `expectedRungIndex` (0, 2, 3, 5, 7, 99, −1, NaN) → state unchanged |
| P-C pricing | hawaiian 100 → 90 / 80 / 70 / 65 / 60. Every unblocked target's full ladder costs exactly its P-C total. |
| Double tap / stale | Charged once; the second request returns the same state |
| Insufficient Pitz | Unchanged, uniformly for every target |
| RESERVED_EMPTY_RUNG (6 targets) | No charge, no fact and no `hintOutcome`. The rung is not skipped: the next index is also refused. |
| Invalid / missing taxonomy (mocked roles) | No view, no rung, no charge, **and** no fallback to 材料 / 構成 / 特徴 |
| Dex-0 Margherita | Free onboarding reveal; the ladder is inert |
| `cls:<ingredientId>` facts | Appended, e.g. `cls:ham`, `cls:bacon` |
| Existing facts | Kept verbatim: `attr:group:*`, `meta:topping-total`, `tech:*` and `shape:*`. Other recipes' ledgers are the same objects. |
| Unknown recipe keys / unknown ids | Kept (e.g. `future-pizza: ["cls:future-truffle"]`); the save round trip keeps `tech:` / `cls:` / `attr:` |
| Reload | Facts and balance survive. There is no recharge, and the old index is stale after reload. |
| Full Reset | `resetSave` → `discoveryHintFacts` is `{}` and the ladder restarts at rung 1 |
| Non-Free-Cooking / sheet closed | Ignored |

## 4. P-C economy re-run

### 4.1 Static: pure authority vs the H5-0 prediction

**All 25 recipes match the Final Design §10.1 P-C column.**

| | Value |
|---|---|
| 24 targets (excluding the free onboarding): sum | **910** |
| Mean | **37.9** |
| Min | **25** (quattro-formaggi, pizza-bianca) |
| Max | **50** (capricciosa, meat-lovers, pizza-portuguesa) |
| Typical | 0-sub (pepperoni) 35 · 1-sub (hawaiian) 40 · 3-sub 50 |
| vs the 35 / 75 cap | **every ladder ≤ its cap** (35-cap recipes ≤ 35; 75-cap recipes ≤ 50), so no cap is needed (E2) |
| Reachable while P4 / P4b are open | no-cheese × 5 → **10** (sauce only), quattro-formaggi → **20** (sauce + cheese) |

### 4.2 Progression walk

**Method.** Fresh save → Dex 25, through the real reducer with the flag ON.
- Rungs are bought through `PURCHASE_HINT5_RUNG`, and each price is read from the balance change.
- The Shop, stock, rewards and first-discovery bonus are all real.
- The player bakes the target directly once they have their hints. There are no experimental
  bakes, which is a conservative assumption about earnings.
- An unaffordable rung is skipped, never ground for.

| Quality (reward per discovery) | Profile | Hint spend | Shop | Ending Pitz | Min Pitz | Grind bakes | Insufficient | Reserved stops |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| ★4 q80 (150) | NONE | 0 | 2200 | 1550 | 0 | 0 | 0 | 0 |
| | FIXED4 (rungs 1–4) | 700 | 2200 | 850 | 0 | 0 | 0 | 6 |
| | **FULL** | **795** | 2200 | 755 | 0 | 0 | 0 | 6 |
| ★3 q65 (130) | NONE | 0 | 2200 | 1050 | 0 | 0 | 0 | 0 |
| | FIXED4 | 700 | 2200 | 350 | 0 | 0 | 0 | 6 |
| | **FULL** | **795** | 2200 | 255 | 0 | 0 | 0 | 6 |
| ★1 q30 (70) | NONE | 0 | 2200 | 70 | 0 | 26 | 0 | 0 |
| | FIXED4 / FULL | 240 | 2200 | 70 | 0 | 38 | 24 | 0 |

**Reading the table:**
- **Consistent with the prediction.** FULL = 795 = 910 − 185 (the design totals of the 6 blocked
  targets) + 70 (their reachable prefixes, 5 × 10 + 20).
- **Share of the discovery reward (FULL):**

  | Quality | Mean spend per stage | Share | Max stage (50) |
  |---|---:|---:|---:|
  | ★3 | 33.1 | 25 % of 130 | 38 % |
  | ★4 | 33.1 | 22 % of 150 | 33 % |

- **★1 (q30).** After each stage's Shop pack, only the first rung (10) is affordable. The player
  buys 1 rung per stage, and 24 rung attempts are refused as insufficient. There are +12 Margherita
  replays compared with NONE, because hint spend delays the Shop. There is no hard deadlock, and the
  ending Pitz is the same. This is the same soft friction the Economy 1.0 audit found for ★1
  players.
- **No hard deadlock** in any of the 9 runs. Dex 25 is always reached, and stage 1 (the Dex-0
  onboarding) spends 0.
- **Repeated purchases:** a rung is charged once. Double taps, reloads and completed ladders
  charge 0 (§3).

## 5. Legacy `ing:*` FREE LEAK audit (Owner Decision needed; nothing changed)

### 5.1 Condition

**The rule.** Under the H5-1 §9.1 rule, a name rung (SAUCE / CHEESE / KEY_TOPPING) is settled
**at view time** when every one of its subjects is already a known name: a stored `ing:` fact, or a
legacy Economy 1.0 grant. The sheet then offers the **next** rung.

**The leak.** Whether a rung is settled depends on the target's unbought content: are the names the
player knows the **whole** subject set? The player can read that before paying. Three cases occur:

| Leak | What leaks for free | Recipes that can hit it (known-name sources: Hint 3.0 purchasable facts + Economy 1.0 grants) | Facts involved |
|---|---|---|---|
| **L1 cheese partial.** The CHEESE rung is still offered although a cheese is known. | "There is **another** cheese." For quattro-formaggi that cheese is fontina, the Rule W reserve that Hint 3.0 never hinted. | **2**: parmigiana-pizza, quattro-formaggi | `ing:mozzarella`, `ing:parmigiano` (Hint 3.0), `ing:gorgonzola` (legacy H1 grant) |
| **L2 cheese complete.** The CHEESE rung is skipped. | "The known cheese is the **only** cheese" (a negative fact) | **12** single-cheese recipes where the cheese is purchasable in Hint 3.0: napoletana, tonno-e-cipolla, breakfast, capricciosa, meat-lovers, melanzane, bambino, hawaiian, portuguesa, new-haven, pesto-caprese, pesto-patate | `ing:mozzarella`, `ing:parmigiano` (new-haven) |
| **L3 key role.** The KEY_TOPPING rung is still offered although a topping is known. | "The key topping is **not** one of my known toppings", so an unknown topping exists | **5**: capricciosa, meat-lovers, pizza-portuguesa, pesto-tonno, puttanesca | `ing:ham` / `ing:oregano` (capricciosa), `ing:bacon` / `ing:pepperoni` (meat-lovers), `ing:egg` / `ing:onion` (portuguesa), `ing:black-olive` (pesto-tonno, puttanesca), `ing:capers` (puttanesca) |

**Totals:**
- Union: **16 / 24** targets can show at least one of L1–L3 for some legacy save.
- Sub-topping rungs are safe: they appear only after STRUCTURE and all names have been bought, so
  an ALREADY_KNOWN sub adds nothing.

**New save vs legacy save:**
- A save that only ever buys Hint 5.0 rungs settles rungs by its own in-order purchases, so none
  of L1–L3 can occur. G15 proves that.
- **Every current player is a potential legacy save.** Hint 3.0 / DH4 purchases keep happening in
  production until Hint 5.0 is enabled at H5-4.
- M2 matters here too: with "19 first", the 6 targets left on the old sheet keep producing legacy
  facts.

### 5.2 Options (none implemented; the current code is C)

| Option | L1 | L2 | L3 | Trade-off |
|---|---|---|---|---|
| **A.** A legacy-known name settles its rung when ≥ 1 subject is known | fixed | fixed (settled no longer means complete) | **not fixed** (a single subject: same as today) | The remaining unknown cheese of a multi-cheese rung can never be bought: parmigiano on parmigiana (already seen as the Hint 3.0 free key), fontina on quattro-formaggi (deduction only, P3). |
| **B.** Adjust visibility | – | – | – | **Not viable.** The leak comes from which rung is *next*, and U1 requires the next rung's label and price to be shown. Hiding it breaks U1. |
| **C.** Keep §9.1 and solve it in H5-3 (current) | open | open | open | Leaks remain for legacy saves; the flag is OFF, so there is no production impact yet |
| **D.** Legacy names never settle a rung at view time. At request time, a rung that would reveal nothing new settles **free** (0 Pitz, an "already known" outcome). A rung that reveals at least one new name costs its P-C price and reveals all of them. | fixed | fixed | fixed | Before purchase, every target looks identical (no FREE LEAK). The free request result tells the player "nothing new". That is an **interaction inference**, already accepted as the OD-H3-17 precedent (GUIDANCE_ONLY). E3 holds: nothing is converted or deleted, and owned info is never charged. UX cost: the player may tap a rung they already know, so H5-3 needs a 「もう知っているヒントだったよ（Pitzは使っていないよ）」 message. It changes the H5-1 §9.1 settle rule (name rungs only). |

**Recommendation:** **D.** It is the only option that closes L1, L2 and L3 without breaking U1, E3 or
the no-recharge rule. The runner-up is A, which is simpler but leaves L3.

**This is OD-H5-M3 (open).** It must be decided before H5-3 renders the ladder, because the UI
copy depends on it.

## 6. Migration / forward compatibility

- **No save schema bump.** No persistence code is changed. `cls:` ids fit the persisted grammar,
  and the save round trip keeps them (tested).
- **Read-time mapping only, per §9.1.** Nothing is converted, rewritten or deleted:
  - `attr:group` / `category` stay archive-only (E3b);
  - the free key grants nothing (M1).
- **Unknown / future ids and recipe keys** survive requests and save round trips.
- **Rollback.** A build without H5-2 keeps `cls:` ids (H3-2 forward compatibility), and the flag
  itself is one line.

## 7. Verification

| Check | Result |
|---|---|
| New H5-2 tests | 24: reducer flag ON 14, flag OFF 4, invalid taxonomy 2, economy 4 |
| Hint 5.0 H5-1 tests | 47 / 47 |
| Full Vitest | **223 files · 4580 passed · 1 skipped** (the skip is pre-existing) |
| `tsc -b` | clean |
| `oxlint` | 0 errors; the 2 pre-existing warnings in `scoringV2.noSauceProfile.test.ts` |
| `vite build` | OK |
| E2E (Chromium `iphone-390x844`) | `discovery-hint-sheet`, `discovery-hint-facts-save` and `discovery-dex-hint`: **9 / 9**. With the flag OFF the runtime is unchanged; this run was a regression check. |

Human Verification does not apply: there is no UI change, and the flag is OFF.

## 8. STOP items for the Owner

| ID | Question | Needed by |
|---|---|---|
| **OD-H5-M3 (new)** | The legacy `ing:*` FREE LEAK (§5). Recommended: D (free-on-request settlement for name rungs); runner-up: A. | H5-3 |
| OD-H5-P4 / P4b | Empty fixed rungs (no sauce / no cheese / no key) | H5-4 |
| OD-H5-M2 | 19 targets first, or all 25 | H5-4 |
