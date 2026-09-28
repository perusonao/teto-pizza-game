# Discovery Hint 5.0 — H5-4 Fresh Gate (P4 / P4b / M2)

- **Issue:** #292.
- **Scope:** read-only. No flag, activation, recipe, taxonomy, TQ authority or Cooking Steps
  change. PR #275 / #293 / #295 are untouched, and nothing is merged.
- **Baseline:**
  - `main` is `86b48fd`, unchanged since H5-0;
  - the H5-3 head is `1ec4253`;
  - Issue #292 has no new comments.

## 0. Verdict

**B. Conditionally adoptable.** P4 splits in two:

| Proposal | Verdict | Why |
|---|---|---|
| **P4-CHEESE** (「チーズ：なし」 as a paid answer) | **A-level: adopt** | Not a Technique (OD-TQ-2). The same fact was already production copy (Hint 2.0 「チーズは使わないみたい」). No new FREE LEAK. |
| **P4b** (「キートッピング：なし」) | **A-level: adopt** | Not a Technique. Only quattro-formaggi is affected. No new FREE LEAK. |
| **P4-SAUCE** (「ソース：なし」) | **C: wait for TQ-1D** | It **is** the Technique answer: `no-sauce` is displayed as 「ソースなし」. The TQ SSOT P2 forbids it (「Hint にも技法の答えは出さない」, OD-TQ-1 / 6 / 7). **No runtime recipe needs it today**: 0 of 25 are sauceless. |
| **M2 = all 25 at once** | **Adopt, if P4-CHEESE and P4b are adopted** | Runtime has no sauceless target, so no RESERVED rung remains. "19 first" would create its own FREE LEAK (§4). |

## 1. Fresh state

| Item | State |
|---|---|
| `main` | `86b48fd`. No commits since H5-0. |
| Issue #292 | Open. Body as updated at H5-3; no comments. |
| TQ authority (`docs/design/TETO_COOKING-TECHNIQUES_1.0_SSOT.md` on main) | TQ-1D has not started (Aussie, display, `ReferencePizza.sauce` nullable, near-miss k rule). **P2:** 技法は購入しない・直接教えない、**Hint にも技法の答えは出さない**. **P6:** the name and description of an undiscovered Technique are never shown. **OD-TQ-2:** Techniques = ソースなし・後乗せ・複数 spread; not Techniques = 焼く前・特殊ソース・生地種類・piadina・CUTなし. |
| Cooking Steps (PR #295, open; now carries CS-1a code) | §10 H2 calls "an empty SAUCE rung = no-sauce identity" and says Hint 5.0 keeps those targets back until OD-H5-P4. H1 notes that a SAUCE rung revealing 2 sauces = multi-spread, guarded by G7. It changes nothing in Hint 5.0. |
| PR #293 (open) | F-1: runtime 22 / 22 classified. F-2: no silent fallback, kept. F-8: `attr:family` stability, kept. F-9 / K3: "no sauce" has **two definitions**: TQ `requiredTechniquesOf` = no spread layer, but the 172 `sauceBase: none` also covers olive-oil-only rows. |

## 2. The 10 checks

### 1. Technique identity (TQ-1D)

- **SAUCE:** 「ソース：なし」 = 「ソースなし」, which is the Technique's own `nameJa`. That is a direct
  leak. Even reworded (「ソースは使わない」), it states the Technique's concrete action, which P2 / P6
  forbid.
  - After the Technique is discovered, the answer no longer names an unknown Technique, but P2
    ("never sold through a hint") still applies.
  - Either way, a TQ authority decision is needed. **Not safe to assume.**
- **CHEESE / KEY:** neither 「チーズなし」 nor 「トッピングなし」 is a Technique (OD-TQ-2), and no TQ
  or Cooking Steps document plans one. There is no Technique leak.

### 2. The no-sauce authority

- Runtime: 0 of 25 recipes are sauceless, and TQ-1C is inert (INV-TQ-4).
- The Hint 5.0 SAUCE rung uses `category === "sauce"` ingredients. TQ's `requiredTechniquesOf`
  uses "no spread layer", and PR #293 K3 shows the two definitions differ. They must be reconciled
  **before** any sauce-「なし」 exists.
- G7 (the Hint 5.0 production tripwire) already fails the build when a production target has a
  sauce count ≠ 1 or requires a Technique.

### 3. A new FREE LEAK before purchase?

**None for CHEESE / KEY.** Every target has the same rungs 1–4 and the same prices (10 / 10 / 10 /
5). A 「なし」 rung is offered, labelled and priced like any other (G15 / M3 sweeps). The 「なし」
appears only after a paid request.

**Existing leak that P4 removes.** Today's `RESERVED_EMPTY_RUNG` leaks **at request time**: a tap
that changes nothing tells the player the rung is empty, for free. So RESERVED must never reach
production. P4-CHEESE / P4b make those taps paid answers, and the leak disappears.

**M3 interplay:**
- An Economy 1.0 legacy buyer whose count line said 「チーズは使わないみたい」 already knows the
  cheese rung is empty. That is ALL known, so the request completes for 0 Pitz. (That line is the
  `COUNT_CHEESE` line `legacyOwnsIngredientTotal` already detects; for a cheeseless recipe it states
  the absence.)
- No other legacy fact states an absence (OD-H3-7), so every other case pays 10.
- The 0 is still learnt only after the request, so M3-D holds.

### 4. The same method for all three rungs?

| Rung | Status |
|---|---|
| CHEESE | Safe |
| KEY | Safe |
| **SAUCE** | **Not safe.** See 1 and 2. |

A uniform rule is possible only after TQ-1D decides the sauce case.

### 5. Modes

| Mode | Effect |
|---|---|
| Free Cooking PREPARE | The hint sheet exists only here (`isHintSheetVisible`) |
| Dinner | Blocks `PURCHASE_HINT5_RUNG` (`DINNER_BLOCKED_ACTIONS`) |
| Lunch Rush / guided rounds | Never open the sheet |
| Near-miss (RESULT) | Not touched by Hint 5.0 |

No impact.

### 6. Save / reload / Full Reset / forward compatibility

- A 「なし」 purchase stores only its completion record (`h5:cheese` / `h5:key`), and no `ing:` id.
  The board renders the COMPLETED empty rung as 「なし」 from the recipe data. Reload therefore shows
  it again with no recharge.
- Full Reset clears it.
- Older builds keep `h5:` ids (H3-2).
- No schema bump.

### 7. All 25 at once: open authority left?

With P4-CHEESE + P4b, no runtime target reaches RESERVED: its 6 users are 5 without cheese and
quattro-formaggi without a topping. The SAUCE case has 0 runtime users and stays guarded by G7.

**The Owner must explicitly accept one product consequence:** with the flag ON, the 材料 / 構成 /
特徴 purchases are refused, so the Hint 3.0 / DH4-PROD sheet is **retired in production for every
target**. Its facts are kept and shown in 「以前のヒント」.

### 8. PR #293

Consistent:
- no taxonomy change;
- F-2 kept (no fallback);
- K3 recorded as a reason to defer SAUCE;
- `h5:` completion ids never embed a family, so F-8 does not apply.

### 9. H5-3 M3-D

Kept:
- **Before purchase:** the view is unchanged.
- **At request time:**
  - a 「なし」 rung becomes a normal paid answer, or a 0-Pitz completion only when a legacy
    Economy 1.0 line explicitly stated the absence;
  - PARTIAL does not apply, since an empty rung has one piece of information.

### 10. PR #295 / CS-1a conflicts

A trial merge of H5-3 with PR #295 head `13d6836` gives 2 **textual** conflicts, both adjacency
only:
- `src/screens/GameScreen.tsx`: two import lines at the same spot;
- `docs/PROJECT_HANDOFF.md`: two new sections at the same spot.

Keep both sides. There is no logic overlap. PR #295 changes `cookingProfiles.ts`, `postBakeView.ts`
and GameScreen's post-bake layout, and none of the Hint 5.0 files. H5-4 would touch `hint5Ladder.ts`,
`discoveryHint.ts`, `HintSheet.tsx`, `hint5Flag.ts` and tests, with no overlap either.

## 3. P4 / P4b comparison

| | **P4 as proposed** (sauce + cheese + key 「なし」) | **P4-revised** (cheese + key now, sauce deferred to TQ-1D) | Keep RESERVED |
|---|---|---|---|
| **UX** | Consistent 「なし」 for all three | The same for runtime: sauce-「なし」 never occurs among the 25 | A tap on an empty rung does nothing (confusing) |
| **Privacy** | No pre-purchase leak | No pre-purchase leak | **Request-time leak** (a free "empty" signal), so not shippable |
| **Technique leak** | **Yes: 「ソース：なし」 = 「ソースなし」 (P2 / P6)** | None | None |
| **Economy** (P-C, per ladder) | +10 on each of the 6 targets. Two targets, marinara and fugazza (40 each), are then above their old 35 cap; E2 (no cap) allows that. | Same as proposed | The 6 stop early: reachable 10 / 20 |
| **Save migration** | A completion record only; legacy 「チーズは使わない」 → 0 Pitz | Same | None |
| **Complexity** | Small, plus a TQ authority change | Small: EMPTY becomes a paid answer for CHEESE / KEY; SAUCE stays RESERVED behind G7 | None |

**Economy with P4-revised** (24 targets, Dex-0 excluded):

| | Before | After |
|---|---|---|
| Total | 910 | **970** |
| Mean | 37.9 | **40.4** |
| Min / max | – | 35 / 50 |
| ★3 share of the discovery reward (130) | – | about 31 % mean, 38 % max |

The six affected targets:

| Target | Ladder total |
|---|---:|
| marinara | 40 |
| fugazza | 40 |
| pizza-bianca | 35 |
| pesto-tonno | 45 |
| puttanesca | 50 |
| quattro-formaggi | 35 |

## 4. M2 comparison

| | 19 first | **All 25** |
|---|---|---|
| FREE LEAK | **Yes.** Which sheet a target gets (ladder vs old) reveals "this target has no cheese or no topping" before any purchase. | None: one sheet for every target |
| UX | Two different hint systems at once | One system |
| Complexity | Needs a per-target enable list plus its own gate | The flag alone |
| Prerequisites | none | P4-CHEESE + P4b; G7 green (no sauceless target) |

**Recommendation:** all 25 at once.

## 5. Revised Owner Decision proposal

| ID | Proposal |
|---|---|
| **OD-H5-P4 (revised) = P4-CHEESE** | A cheeseless target's CHEESE rung is a normal paid rung (10). After the purchase the board shows 「チーズ：なし」, stored as the `h5:cheese` completion record, with no recharge after reload. Before purchase it is identical to any other target. **M3:** if a legacy Economy 1.0 line already said 「チーズは使わないみたい」, the request completes for 0 Pitz; otherwise the normal price. OD-H3-7 / -15 (no negative facts) are superseded for this paid Hint 5.0 answer. |
| **OD-H5-P4b** | The same rule for KEY_TOPPING: 「キートッピング：なし」, stored as `h5:key`. No legacy fact states it, so it always costs 10. |
| **OD-H5-P4-SAUCE (new, deferred)** | Not decided in Hint 5.0. It goes to TQ-1D, because it needs a TQ authority decision on SSOT P2 / P6 and the K3 definition. Until then an empty SAUCE rung stays RESERVED, and G7 keeps any sauceless or Technique target out of production. |
| **OD-H5-M2** | **All 25 at once**, gated by: P4-CHEESE + P4b implemented; a new production gate "no production target can reach RESERVED_EMPTY_RUNG"; G7 green. |
| **OD-H5-RETIRE (acknowledgement)** | With the flag ON, the Hint 3.0 / DH4-PROD 材料 / 構成 / 特徴 purchases are retired in production for every target. Their facts are kept (「以前のヒント」). |

## 6. What H5-4 would then contain (not started)

1. P4-CHEESE / P4b in the pure layer:
   - EMPTY CHEESE / KEY rungs become paid ANSWERED with only the completion record;
   - the legacy-absence ALL-known check (cheeseless count line);
   - the board shows 「なし」.
2. The production gate "no reachable RESERVED".
3. The economy re-run at 970.
4. UI copy for 「なし」.
5. The flag ON for production, plus the Preview and the Owner's iPhone Human Verification.

**STOP:** waiting for the Owner's decision on §5.
