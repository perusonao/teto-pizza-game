# Production 27 Discovery progression — Deadlock Fresh Audit

Audit only. No runtime change, no Save/schema change. PR #376 / R6-e / HAND 12 untouched, nothing merged.
Audited base: `37c220b` (main). Method: production authority functions + real reducer, run through throw-away vitest fixtures (not committed; fixture recipe in Appendix).

## Verdict

| | |
|---|---|
| HARD DEADLOCK | **NO** |
| SOFT DEADLOCK | **YES (class B), conditional state-class** — see §3 |

## 1. No.10 = `puttanesca-pizza` (Chapter 3, No.10)

Dex "No." is a per-chapter slot (`recipeChapterSlot`); chapters are 6 / 10 / 11. Only Chapter 3 has No.10 *and* No.11, so the Owner screen is:
No.08 `pesto-caprese`, No.09 `pesto-patate` discovered; No.10 `puttanesca-pizza` (anchovy, black-olive, **capers@step23**, garlic + tomato-sauce); No.11 `pesto-pollo` (chicken@step25).

Implied Owner state (derived, Owner save not available): discovered credited count N is 23 or 24 (capers entitled, chicken not), `brazilian-calabresa` (`ladderCredit:false`) found, and — because the Hint sheet said **REFILL** — `emptyKind()` (`hintTarget.ts:82`) found no KBMM recipe needing an unowned finite material: **all four puttanesca materials are OWNED and at least one has stock 0.**

## 2. Reachability answers (items 2–7, 9)

- Research Entry (`researchEntry.ts`): undiscovered + every finite ingredient **owned** (stock ignored). DISCOVERABLE (`recipeDiscoveryState`): every finite ingredient entitled+owned **and stock ≥ 1**. Research Target start needs DISCOVERABLE (`isValidResearchTarget`); the Dex 「研究する」 CTA is rendered only when `cookableNow`.
- Unlock: capers, step 23, reached when credited discoveries ≥ 23. Price T3: first pack 100 Pitz, **refill 50**; (garlic 80/40, anchovy 100/50, black-olive 80/40).
- Pitz: every registered FREE round credits ≥ 20 (floor) — Margherita (starters only) is always cookable, so Pitz is farmable with zero stock. Not a hard block.
- Reducer reproduction (fixture, §Appendix): S2 (all owned, garlic 0, 50 Pitz) → `RESTOCK_INGREDIENT garlic` → puttanesca DISCOVERABLE → `START_FREE_COOK researchTargetId` → `researchTargetId` set, `isValidResearchTarget` true. S4 (capers unbought, 100 Pitz) → `PURCHASE_INGREDIENT capers` → DISCOVERABLE. **A complete HOME → Dex → Shop → materials → Research Target path exists mechanically.**
- 「次のピザを作る」 (`DexOverlay` footer) is only `onClose`: it starts nothing (verified: onClose×1, onResearch×0, onOpenShop×0).

## 3. Why SOFT DEADLOCK (B)

Owner-screen reproduction (all 24 owned finite materials at stock 0, N=23): Dex shows No.10 `🏪 ショップの材料で作れるかも / ショップを見る`, No.11 `まだ見ぬピザ`, HOME route `TARGETLESS`, hint sheet `REFILL` — identical to the Owner report. Additionally the Dex shows a 「🔎 研究中のピザ — ？？？ピザ — ✓ ケッパーを使う」 card with **no CTA and no explanation** (Research Entry is ownership-derived, CTA is stock-gated).

What the player can know: only "capers is used" (unlock fact). Not knowable: which of the other owned materials are required. Every other information channel is closed while stock-blocked:
- Hint purchases (Selectable/Hint5/Structure) require a DISCOVERABLE target → unavailable.
- `REFILL` copy ("持っている材料を補充しよう") names nothing; Shop rows are generic (在庫 N / 補充).
- Naming the missing ingredients would be an oracle for an undiscovered recipe (Anti-Oracle Contract), so the existing authority deliberately does not.

The player must therefore refill by guess/brute force; refill-everything for the 24 owned materials at N=23 costs **1000 Pitz** vs 20–120 Pitz per Margherita replay.

Chokepoint amplifier: at the minimum-slack state of **every** ladder step N=1..25, exactly **one** credited undiscovered recipe is makeable (the key recipe; `calabresa` never counts). So a stall on the current key recipe stalls all progression; puttanesca is that single recipe at N=23/24.

Existing proofs do not cover this: `discoveryHint.walk.test` restocks *every* owned material (`restockLow`) with 1,000,000 Pitz; Contract 2.1 Gate C ("no unavoidable inventory deadlock") refills the target's own material (oracle policy) — and records refill events 13–23 / 510–890 Pitz per walk, i.e. REFILL is a *routine* production state, not an edge case.

Why not A: unlock (all 25 steps entitled at N=s, verified), shop price/ownership, DISCOVERABLE and Research route are all reachable from zero ownership with exactly the first-pack cost (max 360 Pitz for a key recipe) at every step 1–25; Pitz farmable via Margherita; closure over the 27 recipes covers all 27 (existing `w1Reachability` + my fixed-point run: 26 credited, 27 total, no unreachable step).
Why not C: the required action (which materials) is not determinable from screen info.
Contract 2.1 ○/× only applies after a Research Target starts; it is not involved here.

Severity note: SHOP_NEW (unbought NEW material) is directed (Shop lists NEW rows first, `仕入れる`) → at worst C. The B class is specifically *Research Entry registered + stock-blocked + ≥1 unidentified empty material*.

## 4. Summary items

- **Player can do now:** Shop → check 在庫 0 rows → refill (40–50 Pitz each; capers first); earn Pitz via Margherita replays (≥20/round); then Dex 「このピザを研究する」 appears once all four are ≥1.
- **Root cause:** Research Entry registration is ownership-based but cookability/Research Target is stock-based, and the stock-blocked state has no player-visible, oracle-safe guidance (no CTA/explanation on the Research card, generic REFILL copy, hints unavailable without a target).
- **Minimal fix proposals (design decision needed, oracle-safe):**
  1. Research card, when stock-blocked: explain "材料の在庫が足りない → ショップで補充" with a Shop CTA (no names/counts), and make Shop 在庫0 rows visually distinct ("在庫なし").
  2. Or let a registered Research Entry's Hint/○× reach stock-blocked entries.
  3. Or economy: a small free "sample" allotment (1 unit) for owned finite materials of a registered Research Entry when stock is 0.
  Recommended: (1) first; needs Owner decision vs (3).
  Also relabel Dex footer 「次のピザを作る」 (closes only).
- **Affected:** every Research Entry stock-blocked state; all 25 ladder steps / key recipes (single-chokepoint), concretely No.10 puttanesca (step 23) now.
- **Save/schema change:** none for (1); (3) would touch inventory semantics only.
- **Existing Issues:** no duplicate (#195/#190 closed design issues; #377 = targetless CTA entry points, #358 = Contract 2.1 pre-activation UX, #373 closed). Related, not overlapping.

## Appendix: fixture

`disc = ["margherita", ...keys of ladder steps 1..22, "brazilian-calabresa"]`; `finMats = materials of steps ≤23`; owned = starters + finMats; inventory = 0 for all (S3) / garlic 0 only (S2); capers removed from owned (S4); `createInitialGameState(dex, owned, pitz, inv, [], entitlement)`; drive `RESTOCK_INGREDIENT` / `PURCHASE_INGREDIENT` / `START_FREE_COOK {researchTargetId}`; render `DexOverlay` with the same state.
