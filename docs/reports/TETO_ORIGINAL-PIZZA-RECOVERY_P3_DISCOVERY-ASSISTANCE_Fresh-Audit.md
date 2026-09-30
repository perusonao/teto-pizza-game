# Original Pizza Recovery P3 — Discovery Assistance Fresh Audit (design only)

- **Audited `origin/main` SHA:** `e14f33ef196cc4eb8c9080974cddd5dc67ba6459` (`Merge pull request #312 … lc-r5c-dormant-pin-foundation`). Fresh `git fetch origin main` at session start. It equals the known SHA, so main has not moved.
- **Branch:** `claude/original-pizza-discovery-p3-audit`, cut from that SHA. Docs and measurement tooling only. **No PR.**
- **Inputs read as authority:** P2 Result (`docs/reports/TETO_ORIGINAL-PIZZA-RECOVERY_P2_RESULT-FEEDBACK_Result.md`, merged via #311, Owner HV PASS). The lane's first Fresh Audit (branch `claude/pizza-recovery-discovery-audit-mvq4dn` @ `7c06e48`, OD-ORP-1..12). The P1 branch `claude/attempt-fingerprint-p1` @ `2810f26` (**read only, not changed**). H5-0 Final Design (H5-INV-1..7). TQ SSOT (INV-TQ-*). Discovery 2.0 code.
- **Companion files (this task):**
  - `tools/original_pizza_p3_discovery_audit.mjs`: read-only. It loads the production TS modules through Vite SSR and writes `docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3_DISCOVERY-ASSISTANCE_Audit.json`.
  - `tools/original-pizza-p3/{playwright.dex-geometry.config.ts,dex-geometry.measure.spec.ts}`: a manual harness, not CI. It writes `docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3_DexGeometry.json`.
- **Scope guard:** no `src/`, CSS, save, matcher, Hint 5.0, P1 or P2 change. No collision fix. No PR, no merge.
- **Verification Policy:** not triggered. This is an audit-only task with no UI, UX or gameplay change (Handoff: "audit-only tasks are exempt"). Every slice from P3-3 on **will** trigger it (§18).
- **Final verdict:** **B. OWNER DECISION REQUIRED** (§21).

---

## Owner Authority (recorded 2026-09-30; supersedes every "recommended" / "pending" statement below)

The Owner reviewed this audit and decided the following. **Where the audit text below recommends or assumes something different, this section wins** (notably §8's DEDUCED example line and §10 R-3: the system does **not** show an inferred ingredient as ✅ in Phase 1).

| ID | Owner decision (Phase 1) |
|---|---|
| **OD-P3-1** | Adopt the P1 Attempt Fingerprint, but through its own Review / Merge Gate first, not folded into P3. **Done:** PR #313 merged, `main` `d727030`, post-merge Deploy and WebKit green. |
| **OD-P3-2** | Trial Notebook is **session-only**. No save schema change, no persistence. Persistence is reconsidered in a later slice. |
| **OD-P3-3** | History is by **unique attempt fingerprint**. A retry of the same fingerprint adds no new row; it updates the existing attempt's retry count. Newest attempt on top. (Limits: OD-P3-12.) |
| **OD-P3-4** | The Notebook may hold only: the ingredients the player actually used; the P2 feedback actually shown; the attempt fingerprint / version; the minimal metadata the player's own attempts need. **Forbidden:** hidden recipe id / name, hidden target, internal matcher distance, collision candidate, unpurchased Hint fact, hidden exact ingredient, technique answer. |
| **OD-P3-5** | **Option C.** Dex = "what is legitimately known now"; Trial Notebook = "what I tried". History is never tied to a hidden recipe or to a chapter. Child decision: the Phase 1 structured 発見メモ targets **🎨 DISCOVERABLE cards only**; not 🏪 KNOWN_BUT_MISSING_MATERIAL, UNKNOWN or other states. DISCOVERED cards keep the formal recipe information. |
| **OD-P3-6** | The system does **not** turn P2 attempt history into an automatic "✅ confirmed" exact ingredient on the Dex. In Phase 1 the player reads the Notebook and deduces for themselves. The Dex shows an exact confirmation only for a fact with legitimate authority for that card. "It matched the internal answer" is forbidden as a reason. |
| **OD-P3-7** | **A.** The Dex shows no sub-topping candidate list, no eliminated-candidate result, and no candidate count. The Notebook stores the player's own reasoning material; it does not present a system-derived answer. |
| **OD-P3-8** | Even with a single 🎨 candidate, automatic confirmation from P2 feedback to the Dex is **OFF** (it could bypass paid Hints for free). |
| **OD-P3-9** | The existing recipe description is not partially masked. While undiscovered, the card uses a structured 発見メモ built only from purchased / legitimately disclosed facts. The formal description appears after discovery. The sub-topping slot count is never shown before STRUCTURE is bought. |
| **OD-P3-10** | The duplicate notice is shown on **RESULT** in Phase 1 (e.g. 「📓 前にも同じ材料の組み合わせで作ったよ（試作#4）」). Retrying is never forbidden. A Builder-side notice is considered separately, after Large Catalog R6. |
| **OD-P3-11** | **A.** Phase 1 Trial Notebook entry points: the ORIGINAL RESULT and the Dex header. **No HOME entry.** |
| **OD-P3-12** | **A.** Detail display: latest **50** unique attempts. Duplicate-detection identity is kept separately for the session, up to **2 000** unique fingerprints. A retry never adds a unique attempt (it updates the retry count). The attempt number `#n` is stable for the session. Detail rows beyond 50 may leave the Notebook view, while duplicate detection stays as long as the identity is kept. Beyond 2 000 the oldest identity is evicted; trying an evicted combination again is treated as a first attempt and must never be shown as a duplicate. Persistence is forbidden in Phase 1. 50 / 2 000 are Phase 1 authority and are re-evaluated when a persistent Notebook is designed. Memory estimates are not authority. |
| **OD-P3-13** | **A. REVIVE.** A retry of an identity whose detail row left the 50-row display keeps the same stable `#n` and brings the detail row back to the newest position. Nothing hidden may be rebuilt: only the retained fingerprint identity, the combination the player used now, the feedback shown now, the retry count and the stable number. |
| **OD-P3-14** | The Phase 1 Notebook gets **no internal outcome field** (ORIGINAL / INCOMPLETE_MATCH ...). OD-P3-4 stays the authority: the Notebook is the player's own tries and the feedback actually shown, not a history of internal matcher judgements. |
| **OD-P3-15a** | A duplicate retry is the newest activity (a displayed row moves to the newest position; an identity outside the display is revived there per OD-P3-13). `#n` never changes. |
| **OD-P3-15b** | On a retry the row's feedback is updated to the latest feedback actually shown. The first feedback is not kept; no feedback history in Phase 1. |
| **Collision** | IC-1 / IC-2 are separated from the P3 scope and not fixed here. |
| **P1 blocker** | Approved: the P2 boundary gate adjustment (allowlist exactly `attemptFingerprint.ts`), carried as a separate commit in the same P1 PR. Done (PR #313). |

**Status of the slices (see §18):** P3-0 (P1) **merged** (PR #313, `d727030`). P3-1 (Trial Notebook pure model) **complete** on branch `claude/p3-1-trial-notebook-model` (pure, unwired, no PR; REVIVE is the only retry behaviour) — `docs/reports/TETO_ORIGINAL-PIZZA-RECOVERY_P3-1_TRIAL-NOTEBOOK-MODEL_Result.md`, verdict A. Next: P3-2 (Dex 発見メモ pure display model) — Fresh Audit first.

---

## 0. Executive summary

1. **The 3-layer split is sound, with one correction.** Two different "subjects" exist, and mixing them is the main P3 risk:
   - **Hint 5.0 facts belong to one Dex card.** Every rung is bought for a specific recipe (`discoveryHintFacts[recipeId]`, from a Dex-card pin or the automatic target).
   - **P2 feedback belongs to no card.** It is about "the nearest DISCOVERABLE, non-colliding recipe, whichever it is" (`classifyNearMiss` over `discoverableHintCandidates`).

   So **P2 feedback and Notebook history must never write a Dex card field** (Layer 1), except in one narrow, player-provable case (§10 R-6, Owner-gated). Layer 1 = Hint 5.0 facts + set logic over public information. Layer 2 = the player's own attempts + the feedback *as it was shown*. Layer 3 = P2, unchanged.
2. **The authority matrix (§9) is strict.** The only per-card exact sources are the bought Hint 5.0 rungs and discovery itself. A sub-topping becomes *exact* only by a set-logic deduction whose premises the player owns: the family from the bought rung, the family's members visible on the shelf, and the ingredients the player can use. P2 classes and history, used alone, confirm nothing about a specific card.
3. **Masking the existing description is not feasible (§8).** 25/25 descriptions name at least one ingredient, and **21/25 name every ingredient**. 22/25 also carry non-name clues:
   - family words: きのこ好き, 魚介, お肉好き;
   - flavour words tied to one ingredient: 塩気 → anchovy, ピリッと → pepperoni;
   - technique or empty-rung clues: 「チーズを使わない」 = the paid 「チーズ：なし」; 「トマトソースを使わない」;
   - identity words: ナポリ / ローマ / アルゼンチン / ブラジル / ニューヘイブン / カプレーゼ仕立て / 朝食.

   Showing any part of a description would also break H5-INV-3 ("a recipe's description is never displayed"). **Recommendation:** a structured, template-generated 「発見メモ」 built only from owned facts. The real description appears at discovery, as today.
4. **P1 is compatible and merges cleanly.** `git merge-tree origin/main origin/claude/attempt-fingerprint-p1` has no conflicts. `signature.ts` and `matcher.ts` are unchanged since P1's base `21dc0a6`. `fp1` is matcher-aligned (it includes OBSERVED dimensions), whereas P2's collision key is not (items + sauceBase only). P3 must use `fp1` for duplicate identity and must never reuse P2's `identityKey`. **P1 is not on main and has no PR.** Landing it is P3's first dependency (OD-P3-1).
5. **P3's real "less brute force" lever is the Notebook, not an oracle (§17).** With known sauce, cheese and key, a one-ingredient probe returns different P2 classes for "in the recipe" and "not in it" while ≤ 3 sub-toppings remain (computed with the real `classifyNearMiss`: k = 2 → ADD_ONE vs FAR; k = 3 → CLOSE vs FAR). Remembering those results turns a combinatorial search into a roughly linear one:
   - pool 12, 3 subs: 110.5 → ~10.5 expected cooks;
   - pool 20, 3 subs: 570 → ~17;
   - a 172-scale mix: 52 200 → ~38.

   The *player* makes that inference. P3 records the results and does not certify the inference, because a second 🎨 recipe could be the nearer one.
6. **Privacy is preservable** if P3 reads only two things: the existing privacy-safe `hint5Presentation` view model, and the player's own attempts. The gates in §15 cover this, including a metamorphic "swap the hidden answer, output unchanged" test. Two new, previously unnamed leak paths were found and closed by rule:
   - showing unit slots 「サブ①②③」 before STRUCTURE is bought (the ingredient count is paid information);
   - Notebook grouping "per target recipe" or "per chapter" (that is attribution to hidden identities).

---

## 1. Audited main SHA and drift

| Item | Value |
|---|---|
| `origin/main` | `e14f33ef196cc4eb8c9080974cddd5dc67ba6459` (= known) |
| Since P2's base `af8d46d` | #311 (P2) and #312 (LC-R5-c dormant pins: App-level session pins, `HandSession`) |
| `src/logic/discovery/{signature,matcher}.ts` since P1 base `21dc0a6` | **unchanged** (`git diff --stat` shows only the `nearMiss*` P2 files) |
| P1 branch vs main | merges clean (`git merge-tree`); 6 added files, 0 modified |
| P1 PR | **none** (GitHub PR list; branch only) |
| Production catalog (measured) | 29 ingredients / 22 toppings, **22/22 classified** (families: meat 4, seafood 3, vegetable 8, herb 4, spice 1, fruit 1, other 1). 25 recipes, 25 discovery targets, **1 target per recipe**, **0 identity collisions**, 25/25 Hint 5.0 targets |

The first lane audit counted 62 / 45 toppings. That count was the *master catalog JSON* (`data/recipes/*`), not `INGREDIENTS`. Production is 29. "62 / 172" is therefore a forward scale, analysed in §17.

---

## 2. Existing Dex / Discovery architecture (Discovery 2.0)

| Element | Where | Contract P3 must keep |
|---|---|---|
| Per-recipe state | `recipeDiscoveryState` → `DISCOVERED > DISCOVERABLE > KNOWN_BUT_MISSING_MATERIAL > UNKNOWN`, derived only from (dex, owned, shop-unlocked, inventory ≥ 1) | Public: the Dex shows each undiscovered slot's state tag. **The count and positions of 🎨 slots are already public.** |
| Undiscovered slot | `DexOverlay.UndiscoveredSlot`: `No.NN ？？？`, a tag (🎨 「今の材料で作れるかも」 / 🏪 / 「まだ見ぬピザ」), a CTA; the 🎨 CTA is 「💡 ヒントを見る」 (pins the hint sheet, id via closure only) | Never the name, preview, ingredients or name length (W1-f L1). UNKNOWN is not talked about (P-4). |
| Chapters / numbering | `recipeChapter` = Discovery-Ladder price tier of the recipe's key step; `No.` = position in chapter (declaration order) | A slot's chapter already discloses "needs a tier-T material". P3 adds no other position signal. |
| Discovery | Free Cooking only: `signatureOfPizza` → matcher (`NO_MATCH` / `UNIQUE_MATCH` / `AMBIGUOUS`) → recipe Completion Gate → `NEW_DISCOVERY` / `ALREADY_DISCOVERED` / `ORIGINAL` / `AMBIGUOUS` (shown as ORIGINAL, byte-identical, OD-P2-1) / `INCOMPLETE_MATCH` | Guided rounds only for DISCOVERED recipes (LK-8, `canStartGuidedRound`). Lunch Rush and Dinner never register. P3 records only FREE_COOK rounds. |
| ORIGINAL side effects | score null, no Dex, no Pitz, **stock consumed** | A repeat costs real stock, so the Notebook has real value. |
| Current Dex geometry (measured, `?hv=multi-sub`) | 390×844: body 756 px visible / 2 924 px scroll; card width 358; discovered card 134–183 px (median 165); **locked card 51 px (UNKNOWN), 99 px (🎨 with CTA)**. 360×800: width 328, same heights, no horizontal overflow. | Dex is one long scroll (25 cards now → 172 later). Adding rows to *every* locked card does not scale; adding rows only to cards with owned facts does. |

## 3. Existing Hint authority (Hint 5.0, ON in production)

- **Ladder** (`hint5Ladder.ts`, strictly linear): 1 SAUCE (10) → 2 CHEESE (10, 「なし」 possible) → 3 KEY_TOPPING (10, 「なし」 possible) → 4 STRUCTURE (5; the distinct-ingredient total) → 5.. SUB_CLASS ①..ⓝ (5 each; **family only, never the name**, in `hintSubToppingOrder`).
- **Stored facts** (`discoveryHintFacts[recipeId]`): `ing:<id>` names plus `h5:sauce|cheese|key|structure` completion records, `meta:ingredient-total`, and `cls:<ingredientId>`. The `cls:` fact carries the answer id **in the save only**; no presentation field carries it (H5-INV-1).
- **Presentation authority:** `hint5Presentation(...)` builds the view model. `board` holds COMPLETED rungs only. SUB_CLASS entries appear **only after STRUCTURE is completed**, because the sub count is paid. `legacyKnownIngredientIds` holds the player's own older names. `next` holds the kind, index and price only.
- **Invariants P3 inherits:** H5-INV-1 (no sub-topping name / glyph unless it is a legacy owned name), H5-INV-3 (no recipe name / id / **description** / image), H5-INV-4 (no undiscovered technique; no rung says "no sauce" while **P4-SAUCE is reserved** for TQ-1D), H5-INV-5 (FREE LEAK: the pre-purchase presentation depends only on owned facts and constants), H5-INV-7 (fail closed on taxonomy).
- **No k ≥ 2 rule** (OD-H5-P1/P2): a family may narrow to one candidate. The design calls that "deduction, not disclosure". P3's set-logic deduction (§10) relies on this principle.
- **TQ authority:** techniques are a separate ledger (INV-TQ-NB). The no-sauce technique is revealed only from an ORIGINAL once its affordance is open (INV-TQ-6), and it is inert in production (INV-TQ-4). P3 never shows 「ソースなし」 as a card fact while P4-SAUCE is reserved.
- **Target attribution:** the hint target is a *specific* DISCOVERABLE recipe, pinned from a Dex card (`source: "dex"`) or chosen automatically (hint order). The HintSheet shows no slot, but a player can open every 🎨 card's hint sheet for free and see which one holds the board. **Linking bought facts to their slot is therefore already player-derivable** (relevant to §7 and §15).

## 4. Existing P2 authority (merged, HV PASS)

| Line | Precise meaning (what is *true*) | Subject |
|---|---|---|
| ADD_ONE 「材料をあと1つ足すと…」 | The nearest non-colliding DISCOVERABLE target (hint-order tie-break) is at d = 1 with exactly one missing non-sauce ingredient. | ∃ some 🎨 recipe |
| REMOVE_ONE 「1つ減らすと…」 | d = 1 with one extra piece, **or** a SAUCE_ONLY with `sauceStep = REMOVE` (the target has no sauce; unreachable in production). **Two meanings.** | ∃ |
| SAUCE_ONLY 「ソースを変えると…」 | d = 1, pieces identical to the target's non-sauce set, sauce differs (CHANGE, or ADD when the pizza has no sauce). | ∃ |
| CLOSE 「かなり近づいてるよ」 | min d = 2 (no d = 1 target). | ∃ |
| FAR generic 「別の組み合わせも…」 | an ORIGINAL with candidates and no nearer line (d ≥ 3). | ∀ 🎨: d ≥ 3 |
| FAR_KEY_UNUSED 「新しく入荷した材料は…」 | FAR, and the nearest candidate's key ingredient is not on the pizza. | ∃ |
| (none) | exact match with a colliding target, no candidates, a known pizza at d ≠ 1, FAILED, non-FREE | — |
| ORIGINAL lead 「図鑑にはまだ載っていないピザ！」 | NO_MATCH **or AMBIGUOUS** (identical DOM) | this fingerprint was not discovered |
| INCOMPLETE_MATCH lead 「図鑑のピザまであと少し…」 | the composition **is** a recipe identity; the Completion Gate failed | ∃ some recipe (any state) |

Two properties matter for P3:

- **Time-indexing.** The candidate set D = DISCOVERABLE recipes changes with discovery, ownership and **stock** (an ORIGINAL consumes stock). A P2 fact is only meaningful relative to the D of its own attempt. D is a function of player-visible state, so a **public epoch key** can be defined: (discovered set, owned set, set of finite ingredients with stock ≥ 1, shop-unlocked set). A player can know when it changed; the game can compare it without leaking anything.
- **P2 reads no hint fact** (OD-P2-4), and its input has no Pitz / ladder field. P3 must keep that true: the Notebook stores the line *as shown* and never re-derives it.

## 5. P1 Attempt Fingerprint integration audit (P1 branch unchanged)

| Topic | Finding | P3 integration rule |
|---|---|---|
| fp1 identity | `fp1:` + JSON `[sauceBase, ingredientSet(, ext)]`, derived only from `RuntimeSignature`. Order, counts, placement, bake, sauce amount and CUT are excluded. Proven equal to matcher identity (3 000 property pairs, the matcher as oracle). | Use fp1 as the **only** duplicate key. |
| fp1 compatibility | `ext` is sparse: an OBSERVED dimension enters only when non-default. Default attempts keep a byte-identical string when a dimension ships. | No migration needed while dimensions are added additively. |
| Future extension | A canary test fails if any axis becomes OBSERVED. `RUNTIME_SUPPORTED_CAPABILITIES = []`. | P3 does not interpret `ext`; it compares strings only. |
| Version mismatch | `attemptFingerprintVersion` reports unknown `fpN:`; `parseAttemptFingerprint` accepts canonical v1 only. | A Notebook entry with an unknown version is **kept and never matched** (no false "tried before"). It renders from its stored ingredient list, not from parsing. |
| Old/new comparison | fp1 ≡ fp1 is string equality. fpN ≠ fpM is never equal. | "Tried before" is shown only for same-version equality. An `fp2` would need an explicit migration (P1 §5) **only if** P3-6 persistence exists. Session-only storage needs none. |
| Duplicate judgement | The same fp can differ in quantity, bake and sauce amount, and **in outcome across epochs** (a later discovery, a stock change, a new build). | The notice says 「同じ材料の組み合わせ」, never 「同じ結果」 or 「意味がない」. It informs and never blocks (OD-ORP-12). |
| Ingredient-id renames (Large Catalog / canonicalization) | fp1 embeds ingredient ids. | Session-only: no issue. Persistent: store the ids in the entry too, and treat an unknown id as "cannot compare" (P3-6). |
| Collision key divergence (Codex, P2) | `nearMiss.identityKey` = items + sauceBase (no dimensions / capabilities); fp1 and the matcher include OBSERVED dimensions. Identical today (no OBSERVED axis). | P3 never imports `nearMiss` internals and never computes a collision set. Separate Issue candidate IC-1 (§16). |
| Wiring | P1's gate forbids any production import today. | P3-1 lands P1 first (a PR from the P1 branch, unchanged) and then relaxes the gate to allow **one** importer: the Notebook module. |

**P1 verdict for P3:** usable as is. No change to P1 is required.

## 6. Trial Notebook design alternatives (Layer 2)

What an entry holds. Everything is the player's own or was shown to the player:

```
TrialEntry {
  seq: number                       // 試作 #n, monotonic in the store (no wall clock)
  fp: string                        // fp1 (or unknown version, kept)
  sauceIds: string[]; pieceIds: string[]   // own composition, catalog-ordered, distinct
  outcome: "ORIGINAL" | "INCOMPLETE_MATCH" // as shown; AMBIGUOUS is recorded as ORIGINAL (identical DOM)
  lineKind: NearMissKind | null; lineTextJa: string | null  // the P2 line exactly as rendered
  epoch: string                     // opaque hash of the public epoch key (§4); never shown
  repeats: number                   // same fp made again (count only)
}
```

Not recorded:

- FAILED bakes (they say nothing about the composition);
- NEW_DISCOVERY / ALREADY_DISCOVERED (the Dex already holds them);
- guided, Lunch Rush and Dinner rounds;
- any recipe id, any nearest-target id, any distance number, any hint fact.

| Alternative | Description | Verdict |
|---|---|---|
| N-A. Log only | A list of entries with the as-shown line | Minimum viable. Safe. |
| N-B. Log + duplicate notice | N-A plus a 「📓」 notice on an fp match (§12) | **Recommended first wiring.** |
| N-C. Log + epoch grouping | N-B, and entries from an older epoch are visually dimmed ("材料が変わる前の試作") | Useful and still safe (the epoch is public), but it adds complexity. Later slice. |
| N-D. Log + automatic inference | The Notebook computes "ingredient X is in / out" from P2 lines | **Rejected** for the multi-candidate case (§9, §10). Allowed only as R-6 (single-candidate attribution), Owner-gated. |

## 7. Discovery Notebook / Dex design alternatives

| Option | What | Info density on 390 px | Navigation | Privacy | Discoverability | Verdict |
|---|---|---|---|---|---|---|
| A. Trial Notebook only | No Dex change; a new Notebook screen | Low | +1 screen | Safest | Low (hint facts stay buried in the HintSheet) | Solves Layer 2 only |
| B. Dex becomes Discovery Notebook (history inside the Dex) | Attempts listed under cards | Very high, and 172 cards × attempts blows up the scroll | One place | **Unsafe by construction:** listing attempts under a card = attributing attempts to a hidden recipe | High | **Reject** |
| **C. Dex = "what is known"; separate history = "what I tried"** | 🎨/🏪 cards with owned facts gain a compact fact block; a separate 「試作ノート」 | Cards with no facts unchanged (51 / 99 px); only cards with facts grow (est. +56–110 px, §14) | Dex ⇄ Notebook links; RESULT → Notebook | Each layer has one subject | Good | **Recommended** |
| D. Fact block in the HintSheet only + Notebook | No Dex change; the sheet already shows the board | Zero Dex growth | The facts are one tap deeper | Safe | Medium | Fallback if the Owner wants no Dex change |

Recommendation: **C**. The Dex card block renders the existing `hint5Presentation` board (as chips) plus the deduction states of §10 and nothing else. Which cards get a block (🎨 only, or also 🏪 / UNKNOWN cards that still hold bought facts) is OD-P3-5. Facts bought while a card was 🎨 were linkable then (§3), so showing them later adds no new disclosure. Showing them on an UNKNOWN card, though, reads as a strong visual signal, and that is a product call.

## 8. Masked description feasibility

**Measured** (`descriptions` in the audit JSON; the lexicon hits are listed verbatim there):

| Metric | Count / 25 |
|---|---|
| Names ≥ 1 of its own ingredients | **25** |
| Names **all** of its own ingredients | **21** |
| Family word (きのこ, 魚介, 肉, チーズ…) | 5 |
| Flavour word tied to an ingredient (香り, 塩気, ピリ, 甘…) | 13 |
| Technique / empty-rung clue (チーズを使わない, トマトソースを使わない, 白い, オイルを塗った生地…) | 7 |
| Recipe-identity word (ナポリ, ローマ, アルゼンチン, ブラジル, ニューヘイブン, 定番, 朝食, 4種…) | 11 |
| Contains its own recipe name (ジェノベーゼ, ナポリ…) | 3 |
| Any non-name clue | **22** |

Clue classes and why a string replacement fails:

| Clue class | Examples from production | What it leaks after name masking |
|---|---|---|
| ingredient name | all 21 "full list" descriptions | the answer |
| ingredient-specific adjective | 「塩気のきいた」(anchovy), 「ピリッと香ばしい」(pepperoni), 「ゴロッとした自家製」(sausage), 「まんなかがとろ〜り」(egg), 「ほくほく」(potato), 「バジル香る緑の」(pesto) | the sub-topping (exact, via family + adjective) |
| category clue | 「きのこ好きのための」, 「魚介のピザ」, 「お肉好きには」, 「4種のチーズ」 | the family (paid SUB_CLASS rung) or the cheese count |
| technique / empty-rung clue | marinara 「チーズを使わない」; bianca 「トマトソースを使わない…白いピザ」 | the paid 「チーズ：なし」 rung for free; the sauce identity / no-sauce framing (H5-INV-4 risk once P4-SAUCE ships) |
| recipe identity clue | 「ナポリ生まれ」, 「ローマ生まれ」, 「アルゼンチン生まれ」, 「ブラジル定番」, 「ニューヘイブン風」, 「カプレーゼ仕立て」, 「朝食にもぴったり」 | the recipe (then the whole composition by general knowledge) |
| recipe name in text | genovese (sauce name = recipe name), napoletana (ナポリ) | the recipe name (H5-INV-3) |
| length / structure | the ・ separators and 、 count mirror the ingredient count | the paid STRUCTURE total |

Alternatives:

| Option | Safety | Authoring cost | Verdict |
|---|---|---|---|
| M-1 string replacement of names | fails on 5 of the 6 clue classes | none | **Reject** |
| M-2 hand-authored per-recipe "stages" of the existing text | every stage must be audited against every fact combination (2^rungs × 172). Unprovable, and it breaks H5-INV-3 | very high | **Reject** |
| M-3 reveal the full description only when every ingredient is ✅ | still leaks identity / technique clues and the name; still breaks H5-INV-3 | none | **Reject** (the player can discover by cooking at that point anyway) |
| **M-4 structured 「発見メモ」 generated from owned facts only** | provable: a pure template over `hint5Presentation.board` + the §10 deductions; it never reads `recipe.description` or `nameJa` | low (one template) | **Recommended** |
| M-5 new Owner-authored "undiscovered teaser" per recipe | it would need its own clue audit per recipe × fact state | high; content work at 172 scale | Not recommended now |

M-4 example (only lines whose facts are owned appear; nothing is shown for an unbought rung):

```
？？？ピザ
✅ ソース：ジェノベーゼソース        (h5:sauce)
✅ チーズ：なし                     (h5:cheese, none)
✅ キートッピング：ツナ              (h5:key)
✅ 材料は全部で 4 種類               (h5:structure)
🔎 サブトッピング①：🥬 野菜・きのこ系   (cls, family only)
✅ サブトッピング②：マッシュルーム     (DEDUCED — only if §10 R-3 holds)
```

The real description appears only on the DISCOVERED card (unchanged).

## 9. Information-authority matrix

Legend:

- ✅ may be shown as *confirmed* for **that Dex card**.
- 🔎 partial fact for that card.
- ⊘ exclusion for that card.
- N = Notebook-only (a record of what was shown; no card field).
- — = nothing.

"Attrib." = true only under single-candidate attribution (R-6, Owner-gated, default OFF).

| Source | sauce exact | cheese exact | key exact | sub family | sub exact | ingredient exclusion |
|---|---|---|---|---|---|---|
| **A. Hint 5.0** (bought rungs of that card) | ✅ SAUCE rung | ✅ CHEESE rung (incl. 「なし」) | ✅ KEY rung (incl. 「なし」) | ✅ per ordinal, only after STRUCTURE (`cls:` via the board's family, never the id) | ✅ **only by deduction** R-3 (family pool ∩ player universe − known = size k), or a legacy owned name (M3 exception) | ⊘ every other sauce after SAUCE; ⊘ every other cheese after CHEESE; ⊘ toppings of families absent from the full SUB multiset after STRUCTURE + all SUB rungs; ⊘ named fixed ingredients from sub slots |
| **B. P2 ADD_ONE** | N (Attrib.: ✅ pizza sauce = target's) | N (Attrib.: 🔎 placed cheeses ⊂ recipe) | N | — | N (Attrib.: placed toppings ⊂ recipe) | N (Attrib.: none singly) |
| **C. P2 REMOVE_ONE** | N (Attrib.: **not** exact, because of the second meaning, sauce REMOVE) | N | N | — | — | N (Attrib.: "one of the placed items is extra", not which) |
| **D. P2 SAUCE_ONLY** | N (Attrib.: ⊘ the used sauce; if the pizza had none, "has a sauce") | N (Attrib.: ✅ = placed cheeses) | N (Attrib.: ✅ ∈ placed) | N (Attrib.: ✅) | N (Attrib.: ✅ placed toppings are exactly the toppings) | N (Attrib.: ⊘ every unplaced topping) |
| **E. P2 CLOSE** | N | N | N | — | — | — (four compatible explanations) |
| **F. P2 FAR** (generic / key-unused) | N | N | N | — | — | N (key-unused, Attrib.: ⊘ each placed topping *as the key*) |
| **G. Past attempt history** | only via B–F of each entry, **within one epoch**; otherwise — | same | same | — | — | combination-level only: 「この組み合わせでは見つからなかった」 (fp → ORIGINAL). Not "not a recipe": AMBIGUOUS looks identical. |
| **G'. INCOMPLETE_MATCH entry** | N: "this combination is some recipe's composition", attributable to no card (the matcher spans every recipe, any state) | N | N | N | N | — |
| **H. Discovery success** | ✅ all (the card becomes DISCOVERED; the existing Dex shows everything) | ✅ | ✅ | ✅ | ✅ | For *other* cards: only that their identity ≠ this fp (not displayed) |

Forbidden in every row: "the game compared it with the internal answer, so it is confirmed". Every ✅ above is derivable by a player holding the same facts (§10 R-1).

Why B–F are Notebook-only: they quantify over D, the set of 🎨 recipes. With |D| ≥ 2, the line may be about another card, so attributing it to "the card I was aiming at" can be **false**. A player aiming at card X can get ADD_ONE because of card Y.

## 10. Exact-confirmation rules

- **R-1 (derivability).** A card field is ✅ only if it follows logically from (i) that card's owned facts (`hint5Presentation.board`, legacy owned names) and (ii) public information: the player's usable-ingredient universe, shelf/family membership as shown by ShelfChips, and the card's public state tag. The internal recipe is never an input to the decision.
- **R-2 (provenance).** Every ✅ carries an internal provenance, `HINT` / `DEDUCED` / `DISCOVERED`. The view model carries the provenance and the owned display value only; never a hidden id. Whether DEDUCED looks different (「🧠 推理で確定」) is OD-P3-6.
- **R-3 (sub-topping deduction).** SUB_CLASS slot(s) of family f with k slots are exact iff |U_f| = k, where:
  - U_f = { toppings of shelf f in the card's universe } − {named sauce / cheese / key} − {sub names already ✅};
  - universe = usable now (owned, stock ≥ 1, or a starter) for a 🎨 card (its tag guarantees the answer is ⊆ usable); shop-entitled for a 🏪 card; **no deduction** for an UNKNOWN card (its universe is not public).
  - Several slots of one family resolve together (a set, not an order). **Slot order is authored (`hintSubToppingOrder`) and must not be implied**: when k ≥ 2 the deduced names are shown as a set under the family, not assigned to ①/②.
  - Measured today: of the 17 targets that have sub-toppings, 4 are fully resolved by R-3 alone (breakfast, meat-lovers, melanzane, parmigiana), and the 8 with none are fully known after rung 3. The universe here is a proxy: toppings whose Ladder step ≤ the recipe's key step.
- **R-4 (monotonic, not sticky).** Deductions are recomputed from the facts on each render. A universe change (new shelf members from the Shop) can turn a DEDUCED ✅ back into 🔎. Because this is a pure function of public state, it leaks nothing. R-3 with a fixed universe is monotone in facts.
- **R-5 (no count leak).** 🔎 / ？ slot chips exist only for rungs the board shows. Before STRUCTURE no slot row is rendered; the ingredient total is paid. No "候補 n 個" count is shown (§15).
- **R-6 (single-candidate attribution, Owner-gated, default OFF).** A P2 line may update a card only if, in that attempt's epoch, **exactly one 🎨 card existed** (the player sees exactly one tag) and it is the card. With one candidate, the colliding-target filter means "line shown ⇒ about that card". This is sound but has three costs:
  - it turns SAUCE_ONLY / ADD_ONE into free substitutes for paid rungs (the OD-ORP-2 economy conflict);
  - REMOVE_ONE stays ambiguous;
  - it must re-check 1-target-per-recipe (today max 1) and "no OBSERVED dimension" at runtime, and fail closed.
- **R-7 (no completion promise).** Even with every field ✅, the card never says 「これで作れる」. The combination might collide (AMBIGUOUS ⇒ ORIGINAL), and the Completion Gate / bake still apply (§16).

## 11. Exclusion rules

- **X-1.** Sauce and cheese exclusions follow only from the completed SAUCE / CHEESE rung (the rung lists **every** sauce / cheese).
- **X-2.** Family-absence exclusion only after STRUCTURE **and all** SUB rungs are completed (before that, an unbought slot could be any family).
- **X-3.** Combination exclusion (Notebook): an fp recorded with outcome ORIGINAL is displayed as 「この組み合わせでは見つからなかった（試作#n）」. It is valid for the build and catalog it happened in; it is not a claim about any card.
- **X-4.** No P2-derived ingredient exclusion on a card, except under R-6.
- **X-5.** Exclusions are shown only as the *absence* of a candidate on the card (or a ⊘ in a future "候補" view, OD-P3-7). The list of remaining candidates is itself a derived count, so it is shown only if the Owner accepts it as deduction (it is derivable from R-1 inputs).

## 12. Duplicate-attempt rules

- Identity = fp1 string equality, same version (§5). Scope = the Notebook store (§13).
- Recorded: FREE_COOK ORIGINAL / INCOMPLETE_MATCH only. A remake of a discovered recipe is not "tried before" (the Dex holds it).
- The notice is **silent for an untried combination**, so its absence is no oracle. It never states or implies the future result, and never blocks.

| Option | Where / when | Stock saved? | UI risk | Verdict |
|---|---|---|---|---|
| A. no warning, Notebook only | — | no | none | too weak (the player re-burns stock) |
| **B. light notice** 「📓 前にも同じ材料の組み合わせで作ったよ（試作#4）」 | **RESULT** in slice P3-3; Builder pre-bake (bake step / before CONFIRM_BAKE) in P3-5 | RESULT: no; Builder: yes | RESULT: one line in an existing row; Builder: the busiest screen, LC pantry lane | **Recommended** (RESULT first, Builder later) |
| C. warn right before RESULT (modal at bake confirm) | pre-bake | yes | interrupts the flow; a modal on every repeat | not recommended |
| D. block creation | — | yes | violates "re-trying is allowed"; the fp → outcome mapping changes with epoch / build | **Reject** |

The notice may show the previous entry's as-shown line (「前回：🤏 おしい！…」), labelled as the past. That is still the player's own record.

## 13. Persistence alternatives (no decision here — OD-P3-2)

| | A. round-only | B. app session-only (LC-R5-c `HandSession` precedent: App-level `useState`, cleared on reload) | C. save persistence |
|---|---|---|---|
| Usefulness | ≈ none (a round is one pizza) | good within a play session; lost on reload | best |
| Complexity | trivial | low (one App-level store, no reducer / save) | medium-high: a new top-level key, `KNOWN_SAVE_KEYS`, forward-compat merge, `resetSave`, set-union merge for multi-tab (#282), caps |
| Save schema impact | none | none | additive key (no `schemaVersion` bump, per the `discoveryHintFacts` / `dinnerMissionRecords` precedent), but **out of scope now** |
| Version compatibility | n/a | n/a | fp version per entry; unknown versions kept; ingredient ids stored for display |
| Privacy | n/a | player's own compositions only | same, but the save is readable: the store must hold no target-derived value (the stored line is display copy, the epoch an opaque hash) |
| Data growth | 0 | bounded by the cap (§13b) | must be capped (~150 B/entry → 200 entries ≈ 30 KB) |
| Old save compatibility | n/a | n/a | an absent key = empty notebook |

Recommended *for the Owner to choose from*: **B for P3-3**, and C as a separate additive slice P3-6 after a real-device HV of B.

**13b. History count** (OD-P3-3):

| Option | Leak risk | Verdict |
|---|---|---|
| all | none | unbounded; fine for a session with a hard cap |
| recent N | none | loses old entries → "tried before" can go silent (acceptable: silence is not a claim) |
| **unique fp (latest entry + repeat count)** | none | **recommended**; N-cap with LRU eviction |
| per target recipe | **leaks attribution** to hidden identities | **Reject** (only a *player-declared* aim, never verified, could be a label — not recommended) |
| per chapter | same (a chapter of a hidden target) | **Reject** |
| group by own sauce / own key ingredient | none (own composition) | optional filter |

## 14. Mobile UX alternatives (390×844 / 360×800; no production UI)

Measured baseline (§2): locked card 51 / 99 px, card width 358 / 328 px, Dex body 756 / 712 px visible.

**Dex card with owned facts (option C).** Estimated from the existing chip metrics (~36 px chip row, ~26 px text row):

```
┌──────────────────────────────────────┐  358 px (328 @360)
│ 🔒 No.07 ？？？                       │
│   🎨 今の材料で作れるかも              │
│   ✅ ジェノベーゼソース ✅ チーズなし   │ ← chip row: bought name rungs
│   ✅ ツナ   材料 4種                    │
│   🥬 野菜・きのこ系 ×1  🧠 マッシュルーム │ ← family chips (after STRUCTURE), DEDUCED chip
│   [💡 ヒントを見る] [📓 試作ノート]      │
└──────────────────────────────────────┘  ≈ 99 + 56…110 px
```

| Element | Recommendation | Why |
|---|---|---|
| confirmed ingredient chip | reuse `.dex-card__ingredient` look + ✅ | consistent with DISCOVERED cards |
| family-level chip | `hint5ClassView.lineJa` (🥩 肉系…), never an ingredient glyph (H5-INV-2) | existing authority |
| unknown chip 「？」 | only for slots the board shows (after STRUCTURE) | R-5 |
| masked description | **no** (§8); one-line M-4 memo optional instead of chips | H5-INV-3 |
| deduced chip | 🧠 or dashed border (OD-P3-6) | provenance visible |
| Trial History entry | one row: `#4  🍅🐟🍄🧅 … 🤏 あと1つ足すと…` with glyphs of *own* ingredients; tap to expand | own data only |
| duplicate-attempt notice | one line in the RESULT near-miss row area (P3-3), Builder later (P3-5) | P2 row already has this shape and passed HV |
| Notebook entry points | RESULT (ORIGINAL card) link + Dex header button | discoverability without a HOME change |

Scale: at 172 recipes only cards with facts grow; a player typically holds facts for a handful of cards. A long Notebook list is a separate screen with its own scroll, so it does not lengthen the Dex.

## 15. Privacy analysis

| Must not leak | Surface risk | Rule / gate for implementation |
|---|---|---|
| undiscovered recipe name | fact block / memo / Notebook | Card and memo read only `hint5Presentation` + deduction output. Gate: the rendered DOM (text, aria, `data-*`, title, alt) contains no `nameJa` / `description` of any undiscovered recipe (extend `HintSheet.hint5.test.tsx`'s DOM serialisation to Dex / Notebook). |
| hidden recipe id | DOM / view model / Notebook store | The store holds no recipe id (type-level: a `TrialEntry` has no id field); the card callback id travels only via a closure (existing W1 pattern). Gate: no `shipped:` / RecipeId string in the store or DOM. |
| unpurchased Hint fact | fact block before purchase | Render only board entries (COMPLETED). Metamorphic gate: two recipes with the same bought board → byte-identical block. |
| hidden exact ingredient | DEDUCED chip | Deduction module input type excludes `Recipe` / `RECIPES` / `cls:` ids; **metamorphic gate**: replace the hidden subs with any other composition consistent with the board + universe → identical output. |
| candidate recipe count | "n 件のレシピが当てはまる" | never computed or shown. The 🎨 count is already public (Dex tags); nothing more. |
| internal matcher distance | Notebook | store `lineKind` / `lineTextJa` as shown; no `distance` field (gate on keys, like P2's anti-spoiler key list). |
| collision candidate | Notebook / card | AMBIGUOUS recorded as ORIGINAL; no "cannot be found" or "shared" wording; no import of the nearMiss collision set. |
| technique answer | card / memo | no 「ソースなし」 fact while P4-SAUCE is reserved (the ladder stores none: RESERVED_EMPTY_RUNG); memo template has no technique slot. |
| count of subs before STRUCTURE (new) | unit chips | R-5. |
| attribution of attempts to hidden recipes (new) | grouping | §13b rejects per-target / per-chapter. |
| hint-order / auto-target position | fact block on a slot | acceptable: already derivable by opening each 🎨 card's sheet for free (§3); OD-P3-5 covers non-🎨 cards. |

## 16. Collision boundary (no fix here)

- Production: 0 collisions, 1 target per recipe. The 172 authority: 5 exact-identity groups / 10 rows (first lane audit §8.4), plus 11 extended collisions listed in the matrix.
- **P3 boundaries:**
  1. never say a combination "is not a recipe" (AMBIGUOUS = ORIGINAL on screen), only 「見つからなかった」;
  2. R-7: no "これで作れる" promise even at full ✅;
  3. P3 computes no collision set and does not import `nearMiss`'s `identityKey`;
  4. R-6 (if ever enabled) must fail closed if any catalog target collides, any recipe has > 1 target, or any dimension is OBSERVED;
  5. deduction R-3 assumes one identity per recipe; a gate should pin `targetsPerRecipe === 1` so a multi-target recipe forces a re-review.
- **Issue candidates (not opened):**
  - **IC-1** align the `nearMiss` collision key with the matcher's identity (dimensions + capabilities), the Codex P2 finding;
  - **IC-2** before any colliding recipe ships, decide how its Dex card behaves once its facts are fully known (it can never be discovered by composition alone; OD-ORP-10 / OD-P2-1 canary).

## 17. 62 / 172 scale analysis

**Today (production, after full Hint 5.0, "ladder-reachable" universe).** The answer space is the set of sub-topping combinations consistent with the bought families:

- max: puttanesca 32, capricciosa 24; then portuguesa and pesto-tonno 10;
- 4 of the 17 with sub-toppings are resolved by R-3 alone;
- expected cooks, brute force (S0) → Notebook-assisted probing (S1): capricciosa 12.5 → 5.9, puttanesca 16.5 → 7.6, portuguesa 5.5 → 4.5.

**P2 probe discrimination** (real `classifyNearMiss`, one candidate, known sauce / cheese / key; probe = fixed + one topping):

| remaining subs k | probe ∈ recipe | probe ∉ recipe | leave-one-out, rest right | one wrong |
|---|---|---|---|---|
| 1 | discovery | CLOSE | ADD_ONE | CLOSE |
| 2 | **ADD_ONE** | **FAR** | ADD_ONE | CLOSE |
| 3 | **CLOSE** | **FAR** | ADD_ONE | CLOSE |
| 4 | FAR | FAR | ADD_ONE | CLOSE |
| 5 | FAR | FAR | ADD_ONE | CLOSE |

So probing discriminates for k ≤ 3. For k ≥ 4 the first stage is FAR-blind until the player fills slots with guesses. The d = 2 CLOSE ("exactly one wrong") and d = 1 signals then take over.

**Scale** (S0 = brute force with dedup, expected cooks; S1 = exclusion probing, expected / worst):

| Pool P, subs k | combos | S0 | S1 |
|---|---|---|---|
| 8, 2 | 28 | 14.5 | 6.7 / 8 |
| 12, 3 | 220 | 110.5 | 10.5 / 12 |
| 20, 3 | 1 140 | 570.5 | 16.6 / 20 |
| 40, 3 | 9 880 | 4 940.5 | 31.7 / 40 |
| veg 8×2 + meat 4×1 (today-ish) | 112 | 56.5 | 9.0 / 11 |
| veg 15×2 + meat 10×1 (62-scale) | 1 050 | 525.5 | 16.9 / 24 |
| veg 30×2 + meat 20×1 + herb 12×1 (172-scale) | 104 400 | 52 200.5 | 38.5 / 60 |

Reading:

- **Hint 5.0 + brute force does not scale.** Hint 5.0 + *remembered* probe results scales roughly linearly in the pool size. That memory is exactly what the Trial Notebook provides; without it the player must keep 20–60 probe results in their head.
- S1 is the player's strategy. P3 certifies it only under R-6. With several 🎨 cards, the player's inference is usually right (probes built on the card's known sauce / cheese / key are nearest to that card) but not guaranteed. That is why the Notebook shows lines as shown and never claims ✅.
- Each probe consumes stock and can change the epoch (a finite ingredient reaching 0 removes recipes from D). S1 therefore also costs Pitz, consistent with the intended friction.
- **An initial-letter hint is not proposed.** The prior audit measured family + first kana → a unique ingredient in 19/19 classified toppings (≈ a name reveal).

## 18. Implementation slices (proposed; none started)

| # | Slice | Nature | Depends | HV? |
|---|---|---|---|---|
| **P3-0** | Land P1 — **DONE: PR #313 merged (`d727030`)** | pure, unwired | OD-P3-1 | no |
| **P3-1** | **DONE on `claude/p3-1-trial-notebook-model` (no PR; OD-P3-13..15 decided).** `trialNotebook` pure model: entry type, fp1 dedup, repeat count, cap / LRU, epoch hash, unknown-version keep; gates (no recipe id / distance keys; imports limited to `attemptFingerprint`) | pure, unwired | P3-0 | no |
| **P3-2** | `discoveryCardFacts` pure view model: input = `Hint5Presentation` + public universe (usable / shop-entitled set, shelf families) + public card state; output = rows (HINT / DEDUCED / family / ？) per R-1..R-5, X-1..X-2; metamorphic privacy gate; M-4 memo template | pure, unwired | — | no |
| **P3-3** | Wire the Notebook: record FREE ORIGINAL / INCOMPLETE at REGISTER_TO_DEX time (App-level session store per OD-P3-2); 「試作ノート」 screen; RESULT link + duplicate notice (B) | RESULT UI + new screen | P3-1, ODs | **yes** |
| **P3-4** | Dex card fact block (option C) | Dex UI | P3-2, ODs | **yes** |
| **P3-5** | Builder pre-bake duplicate notice | Builder UI | P3-3; **after LC-R6 / pantry lane** | **yes** |
| **P3-6** | Notebook persistence (C) | save (additive) | P3-3 HV; OD | yes (reload flow) |
| **P3-7** | R-6 single-candidate attribution (optional) | logic + Dex | OD-P3-8, economy proof | yes |

Recommended next slice after the ODs: **P3-0 + P3-1 + P3-2 as pure, unwired work** (no HV, no save, no UI). They are useful whatever B / C / N-cap is chosen.

## 19. Required Owner Decisions

> Historical record of the questions as asked. **All of OD-P3-1..12 are decided: see "Owner Authority" at the top.**

| ID | Decision | Options (recommendation in **bold**, not decided) |
|---|---|---|
| OD-P3-1 | Land P1 as P3's dependency | **merge P1 branch unchanged as P3-0** / re-implement inside P3 |
| OD-P3-2 | Notebook persistence | round-only / **app session-only first** / save (then P3-6) |
| OD-P3-3 | History size & shape | all / recent N / **unique fp + repeat count, cap N (value TBD)**; per-recipe / per-chapter = rejected |
| OD-P3-4 | What is recorded | **ORIGINAL + INCOMPLETE_MATCH, FAILED excluded, line as shown** / ORIGINAL only |
| OD-P3-5 | Dex vs Notebook layout and which cards show facts | **C (Dex facts + separate Notebook)** / A / D; facts on **🎨 only** / 🎨 + 🏪 / all cards with facts |
| OD-P3-6 | Show set-logic deductions (R-3) as confirmed? and how | **yes, marked 🧠 推理で確定** / yes, unmarked / no (raw facts only) |
| OD-P3-7 | Show remaining candidate ingredients per family ("候補") | no / **later, as deduction only** |
| OD-P3-8 | Single-candidate P2 attribution (R-6) | **no (default)** / yes with an economy proof vs paid rungs (links OD-ORP-2, OD-P2-4) |
| OD-P3-9 | Undiscovered description | **structured 発見メモ (M-4)** / nothing / Owner-authored teasers (M-5) — masked original = rejected |
| OD-P3-10 | Duplicate notice placement | **RESULT first, Builder pre-bake later** / RESULT only / Builder only; blocking = rejected |
| OD-P3-11 | Notebook entry points | **RESULT ORIGINAL card + Dex header** / also HOME |

## 20. Risks / blockers

| Risk | Severity | Mitigation |
|---|---|---|
| P1 not on main (no PR) | blocker for P3-1 wiring | P3-0 (clean merge) |
| Confusing "per-card" Hint facts with "∃-card" P2 facts | high (false ✅ = lie + leak) | R-1, R-6 default OFF, types: card view model cannot take a NearMiss input |
| Free substitution of paid rungs via Notebook inference | medium (economy) | no auto-inference (N-D rejected); R-6 needs its own proof |
| Epoch drift (stock / discovery changes D) | medium | lines stored as shown; epoch hash to dim old entries (N-C) |
| H5-INV-3 (description) | high if masked text shipped | M-4 structured memo only |
| Dex length at 172 | medium | only cards with facts grow; Notebook separate |
| Builder / pantry lane overlap (LC R5-c dormant pins, R6) | medium for P3-5 | serialise P3-5 after the pantry lane |
| Save growth / multi-tab (#282) | only for P3-6 | cap + set-union merge |
| Collisions at 172 | medium | §16 boundaries; IC-1 / IC-2 |
| Taxonomy growth enlarges pools | medium | measured; Notebook value grows with it; tool re-runnable |

Blockers for *design*: none. Blockers for *implementation*: P1 landing (OD-P3-1) and the ODs above.

## 21. Final verdict

> Update 2026-09-30: OD-P3-1..12 decided (see "Owner Authority"). The original verdict is kept below.

**B. OWNER DECISION REQUIRED**

- Design is complete enough to implement P3-0..P3-2 (pure, unwired) as soon as OD-P3-1 is decided. P3-3 onward needs OD-P3-2..P3-6, P3-9..P3-11 and triggers the Human Verification Policy.
- No design revisit is needed: the 3-layer model holds, with the correction that P2 / Notebook never writes Layer 1 (except the Owner-gated R-6).
- Not blocked: P1 merges cleanly, and matcher / signature are unchanged.

Production implementation was **not** started. No PR was created.
