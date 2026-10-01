# Discovery 3.0 — Hint × Pantry × Free Cooking × Trial Notebook: Integration Fresh Audit / Design

**AUDIT / DESIGN ONLY.** No `src` / e2e / CSS / recipe / save-schema change, no PR, no merge, no existing-branch merge / rebase.
This file is the only artifact. Human Verification: not applicable (Policy §2, no visible change).

## 0. Fresh Gate

| Item | Result |
|---|---|
| `git fetch origin` | done |
| `origin/main` | **`93ca1e404c4e942e48b69506ff600bd8fcdfbb51`** (= PR #332 merge, Trial Notebook N1) |
| Drift vs expected `93ca1e4` | **none** (0 commits; identical SHA) |
| Open PRs relevant (Duplicate Gate) | #319 (LC-R6-b, Preview-only hand activation infra), #307 (docs: LC-R4 complete), #272 (old LC-1 PR, superseded), #296 / #293 / #255 (taxonomy docs), #295 (cooking steps). **None implements Hint→Pantry, an OPEN_POOL experiment prompt, or a Notebook attempt diff.** |
| Open Issues relevant | #292 (Hint 5.0), #269 / #270 (Large Catalog / Undo), #253, #238, #294, #320. None covers this integration. |
| Production population (counted from code) | **26 recipes, 29 ingredients** (sauce 3 / cheese 4 / topping 22). Not 62 / 172: those are design targets. |
| Existing audits found (branch-only, docs) | `claude/discovery3-multi-candidate-hint-audit` (OPEN_POOL options A–D, MC-1 recommendation, OD-MC-1..7) and `claude/discovery-3-hint-notebook-audit` (N1 → H1 → N2 → N3 plan). Used as input; their code was not used. |

## 1. Current production UX (code-verified)

- **Hint sheet, pool = 1:** Hint 5.0 ladder (flag `HINT5_LADDER_PRODUCTION_DEFAULT = true`). Completed SUB_CLASS rungs show `classView` (symbol + `labelJa`, e.g. 🥬 野菜・きのこ系). The class id carried to the UI is the **DH4-1 `AttributeFamilyId`**.
- **Hint sheet, pool > 1 (OPEN_POOL):** `hintSheetView` returns `{ kind: "OPEN_POOL" }`; `HintSheet` renders `EMPTY_COPY.OPEN_POOL` only. Every purchase path starts with `isSessionTarget()`, which returns false, so nothing is sold. Production reaches this at Dex 12 + onion (Portuguesa + Calabresa both DISCOVERABLE, PR #331). It is a dead end by design (D-1), not a bug.
- **N1 notebook:** reachable from the Hint sheet header for every view kind including OPEN_POOL. Read-only, session-only.
- **Pantry (食材庫):** entry sits in the tray's pager row on the real FREE round. Opens per active step category. Shows OWNED rows only, with shelf chips and search. **It is a read-only browser in production: tiles do nothing when tapped.**
- **Free Cooking tray:** every OWNED ingredient of the active step category, catalog order, 6 per page (3 columns × 2 rows), pager. No filter, no pin priority. Topping step today = 22 items = 4 pages.

## 2. Large Catalog history audit (fresh; states from GitHub + `git`)

| Item | State | Evidence |
|---|---|---|
| #269 (Issue) / #272 (PR, LC-1 pure model, base `e21fbc2`) | **OPEN + SUPERSEDED** | Never merged. Replaced by the fresh-main port (LC-R0…). Fresh-Rebase Gate lists "close #272 as superseded" as pending. Its design docs remain the *design authority* (Fresh Design §6.3). |
| #270 LC-X Undo | OPEN (separate, not part of this loop) | |
| LC-R0 / R1 / R2 (foundation, shelf copy, hand model) | **MERGED (in main via the R3 chain)** | commits `df5202e`, `b827445` are ancestors of main. `PROJECT_HANDOFF.md` still says "branch, no PR": stale wording. |
| LC-R3 #305 pantry shell | **MERGED / PRODUCTION-ON** | `3b0da33` |
| LC-R4 #306 shelf filtering | **MERGED / PRODUCTION-ON** | `12725eb`. #307 (docs "LC-R4 complete") is **OPEN, DOCS-ONLY**. |
| LC-R5-a #308 availability | MERGED / PRODUCTION-ON | `21dc0a6` |
| **LC-R5-b #310 search + IME + keyboard fit** | **MERGED / PRODUCTION-ON** | `b35739a`; real-iPhone HV PASS recorded |
| LC-R5-c #312 dormant pin foundation | **MERGED / FLAG-OFF** | `e14f33e` |
| LC-R5-d #314 dormant tray hand | **MERGED / FLAG-OFF** | `eb6c32d` |
| **LC-R5-e #318** (audit + hardening) | **MERGED, tests / tooling / docs only; FLAG-OFF** | merged 2026-09-30; PR body states no production src change |
| LC-R6-a audit (`4d2d6ae`, `7727cdc`) | **BRANCH-ONLY / DOCS-ONLY** | Present in history, but reverted from #318 (`89a23ee`); the file is **not in main's tree**. Owner chose to re-land it with R6-b. |
| **LC-R6-b #319** | **OPEN, FLAG-OFF infra** | Preview-only committed variant, main = `null`; PR base is `6abddc7` (main has since moved to `93ca1e4`: needs a merge of main before any merge). |
| R6-c (Hand/Pin UI), R6-d (9 vs 12 HV), R6-e (production ON) | **NOT STARTED** (designed in the R6-a doc) | |
| `HAND_ENFORCEMENT_ENABLED` on main | **`false`** | `src/logic/catalog/handPolicy.ts`. Capacity 9 vs 12 undecided. |

**Net: search + shelf filters are PRODUCTION-ON. Pin and hand are fully built and mutation-hardened but PRODUCTION-OFF, and their activation (R6-c/d/e) has not started.**

## 3. Pantry current-state (code)

| Capability | Class | Evidence |
|---|---|---|
| Pantry component / sheet | **IMPLEMENTED + PRODUCTION ON** (read-only) | `IngredientPantry.tsx`; mounted from `GameScreen` when `pantryVisible` |
| Ingredient search | **IMPLEMENTED + PRODUCTION ON** | field shown only if the category's OWNED rows > 6 (topping today); IME contract; 3 approved search-only aliases |
| Category / filter (shelf chips) | **IMPLEMENTED + PRODUCTION ON** | `ShelfChips`, shown when OWNED rows span ≥ 2 shelves; local state, resets on reopen |
| Pin / unpin | **IMPLEMENTED + FLAG OFF** | `pinEdit.ts` + tile `aria-pressed` + 「選択中」 strip behind `handEditing = HAND_ENFORCEMENT_ENABLED` |
| Pinned ingredients (App state) | **IMPLEMENTED + FLAG OFF** | `handSession` in `App.tsx`, session-only |
| Working set / hand → tray | **IMPLEMENTED + FLAG OFF** | `handTray.ts`, `workingSet.ts`; `trayHand.ids === null` in production |
| Session-only state | Pins, shelf, search, Notebook: all session-only by design | |
| Persistence | **NOT IMPLEMENTED (by decision)** | `persistence.ts` is progression only, schema v2; boundary tests forbid pin storage |
| FREE integration | entry in pager row, FREE only (`isLargeCatalogEligible`: FREE_COOK ∧ no Dinner) | pin → tray path dormant |
| Inventory integration | Pantry shows `×n` / `∞` / zero-stock last; `InventoryOverlay` is deliberately **not** reused (read-only by type) and has its own shelf chips (Category Tabs P4, merged) | |
| Mobile UI | 390×844 / 360×800 geometry measured; stable-height sheet; keyboard fit "Mode C" | |
| Hint → Pantry connection (LC-4) | **DESIGNED ONLY** | Fresh Design §6.3 / H-01; deferred in the Fresh-Rebase Gate (§11, §13) pending a Hint 5 audit that never happened |

## 4. Authority of 「分類」 (taxonomy)

**One id authority, two label sets.**

```
ingredient id ──ingredientAttributeFamily()──▶ AttributeFamilyId   (src/data/ingredientTaxonomy.ts, DH4-1)
                                                  │
        Hint 5.0 SUB_CLASS ◀── subToppingClass() ─┤   labels: hintClassDisplay.ts  (肉系 / 魚介系 / 野菜・きのこ系 /
        (hint5ClassView.family)                   │            ハーブ・香味系 / スパイス・薬味系 / 果物系 / ちょっと変わった材料)
        Pantry shelf ◀── ingredientShelf() ───────┘   labels: ATTRIBUTE_FAMILIES.labelJa (肉 / 魚介 / 野菜・きのこ /
        (sauce, cheese = category; topping = family)             ハーブ・香味 / スパイス・薬味 / 果物 / その他)
```

- `IngredientShelfId = "sauce" | "cheese" | AttributeFamilyId`. `catalogSource` copies `shelf` from `ingredientShelf()`. **No mapping table is needed**: a Hint class id *is* a shelf id for toppings. No new taxonomy is required.
- **Labels differ on purpose** (OD-CT-3, OD-TAX-8): the Hint says 「肉系」, the chip says 「肉」; the Hint says 「ちょっと変わった材料」 for `other`, the chip says 「その他」. `ingredientShelf.ts` deliberately never imports `hintClassDisplay`. Seven of seven families differ by at least the 「系」 suffix; only `other` differs in meaning.
- Hint 5.0 classifies **toppings only**. Sauce / cheese rungs name the ingredient; their shelf is the category.
- Production coverage: all 22 toppings have exactly one family (meat 4, seafood 3, vegetable 8, fruit 1, herb 4, spice 1, other 1). Gate: `auditShelfAuthority`.
- **62-ingredient catalog:** 23 of 42 toppings are unclassified (HCG #293 / #296 open docs). Unclassified = `shelf: null`, reachable only under 「すべて」. **A Hint→Pantry shelf link must not ship against 62 before HCG classification lands.** Not a blocker for the current 29.

## 5. Free Cooking current-state

- The step tabs (生地 / ソース / チーズ / 具材 / 焼く) are **making steps**, not ingredient categories. `makingStepToCategory` maps SAUCE / CHEESE / TOPPING → category.
- 具材 (TOPPING) tray: `trayIngredientsFor(category, {ownedIngredientIds, freeCook: true, recipe})` = all OWNED toppings, **catalog order**, no filter, no pin priority, no sort other than catalog order.
- Max shown: `MAX_INGREDIENT_PALETTE_SLOTS = 6` per page; pager row appears when any step has > 6.
- Hand / working set: exists, **inactive** in production (`resolveTrayHandIds` = `null`). When on: placed > pinned > … , capacity 9 or 12 (undecided), catalog-ordered tray, page 0 on change, #197 selection rule, Model C pin fit.
- Large-catalog design: tray = 手元 (≤ capacity), pantry = 棚 (everything owned). At 62 / 172 without activation the topping tray is 42 items = 7 pages; with 105 ingredients, 12 pages (Fresh Design F-01).

## 6. Were Search and Pin built to make Free Cooking manageable? — **YES**

Evidence (not memory):
- Fresh Design root cause: "トレイが 棚 と 手元 を兼ねている" → solution "手元 + 食材庫 の 2 層化"; F-08 "検索・お気に入り・最近・family 絞り込みが無い" (required at 105 / 172 scale); goal "任意の所持材料は ≤ 3 タップ (食材庫 → family → 材料)".
- Fresh Design §6.3 flow: `フリークッキング → 調理 (トレイ = 手元) ⇄ 食材庫シート (選ぶモード)` and **`ヒントシート (fact チップ → 手元へ / family → 食材庫を family で開く)`**; pain point H-01 "ヒントでベーコンと分かっても、トレイ側に印が無い。閉じてから 12 ページを探す".
- Fresh-Rebase Gate §13 slice table: R5 = "search / picks / selection"; **LC-4 hint → pantry deferred** until a Hint 5 ladder audit.
- OD-R5-2 / OD-R5c-1..3: pin edited directly in the pantry (Model D), shown in a 「選択中」 strip; production pin UI stays hidden until the hand ships together (R6).

**Verdict: YES.** Nuance: "Pantry → pin → hand" is the official flow, but it is **built and dormant**, not live. And "Hint → Pantry by family" was in the original design (LC-4) but is **DESIGNED ONLY** and its Hint 5 privacy audit has not been done. This audit is that audit (§8–§9).

## 7. Search / Pin / hand classification summary

| Piece | State |
|---|---|
| Search | PRODUCTION ON (topping only today, > 6 rule) |
| Shelf chips | PRODUCTION ON |
| Pin UI + hand | FLAG OFF, hardened (118/118 mutants, hand-on-9 / 12 test projects) |
| Activation | R6-b infra open (#319); R6-c/d/e not started; capacity undecided |
| Hint → Pantry | DESIGNED ONLY |

## 8. OPEN_POOL × Pantry: options (A–E)

Hard rules (Owner): no candidate names / counts / multiple choice / exact match / distance / similarity % / 「あと1つ」 / correctness judgement / key-topping revival.
A test for any option: **"is the output a function of the hidden pool?"** If yes it is an oracle channel. Pool-derived output is Option A in disguise.

| | Summary | Verdict |
|---|---|---|
| **A** pool-common features | Intersection of candidates' features | **Reject.** Thin / empty intersection leaks heterogeneity and pool growth; breaks no-cheese / no-sauce rules (H5-INV-4); degrades to empty at 172. Needs a save change or session-only stale handling. |
| **B** Notebook-based, recipe-independent | "Owned ingredients not yet in my Notebook", from the player's own state only | **Recommended base.** Cannot contain recipe information by construction. No save change. Scales with inventory, not recipes. |
| **C** hidden internal target | Pick a target by a rule, reuse the ladder | **Reject.** Every rule is arbitrary or a new near/far authority; steers which recipe is found; at the current candidate order it would pick No.26 first. |
| **D** category-only Hint → open Pantry at that category | Valid in **two** forms: (D1) *pool = 1*: re-show a class the sheet already displayed. (D2) *OPEN_POOL*: a **recipe-blind** pantry entry. **Invalid** form: deriving *which* category to suggest from the pool/candidates (that is A). | **Adopt D1 + D2; reject pool-derived D.** |
| **E** reuse existing architecture | `ingredientShelf` + `catalogQuery({shelves})` (array input already exists for group-level answers), `ShelfChips`, `notebookView()` identity index, the `hintDisclosure` "only what the sheet showed" pattern | **Adopt as the implementation vehicle for B + D.** No new taxonomy, no new authority. |

**Combined recommendation for OPEN_POOL (B + D2 + E): "ノートにまだのっていない材料" grouped by the existing shelf, each group opens the Pantry at that shelf.**
- Inputs: `ownedIngredientIds`, stock, Trial Notebook identity index. No recipe, pool, target, hint fact or Pitz.
- Lists all owned-and-unlisted ingredients, including ones no candidate uses (omission would be an oracle).
- Copy must say 「ノートにのっていない」, never 「まだ使っていない」: the Notebook records only ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH and is session-only (known limit, carried from the earlier audit).
- Property gate: swap `RECIPES` / pool size, view is byte-identical for equal inputs.
- Shown for every sheet state (pool 0 / 1 / > 1) to avoid adding a new 1-vs-many tell (pre-existing tell: ladder vs paragraph stays).
- No counts on chips / entry (OD-CT-6: counts are Phase 5).

## 9. Hint → Pantry UX (pool = 1 ladder)

Target flow:
`Hint 「サブトッピング① 🥬 野菜・きのこ系」` → CTA 「この分類の食材を見る」 → Pantry opens on the **vegetable** shelf, topping category → player chooses → pin → back to Free Cooking → 試作 → Notebook.

| Question | Answer |
|---|---|
| Possible on current architecture? | **Mostly.** Class id (`entry.classView.family`) = shelf id; `queryCatalog({shelves})` exists; pantry shelf is local state (`activeShelf`) and needs an *initial shelf* input. |
| What is missing | (1) A Hint-sheet CTA and a relay in `GameScreen`. (2) Pantry `initialShelf` + a **category override**: the Pantry follows the active making step, so a topping class opened while on SAUCE must open the topping pantry, or switch the step. (3) Pantry availability gate (`pantryWorthwhile`: some category > 6 owned; PREPARE; non-DOUGH) may be false → the CTA must be hidden/disabled then (fail-closed). (4) A shelf with 0 owned rows has no chip → falls to 「すべて」 (neutral, but the CTA label promised a class). (5) **Pin→hand is dormant**, so in production the CTA lands the player in a read-only list: the value is "see which owned items are in this class", not "get it onto the tray". |
| Candidate-identity leak? | **No, if** the CTA opens exactly the displayed class at the displayed granularity, lists *all* owned items of that shelf (not only recipe members), and is rendered only for **COMPLETED** rungs (never before purchase). Same rule as `hintDisclosure` (#272): "only what the sheet has shown". Sauce / cheese rungs name an ingredient: no shelf CTA needed. Group-level answers are not used by Hint 5.0 (families only). |
| 172 recipes? | Yes: independent of recipe count. Shelf size grows with the ingredient count (topping 71 across 7 families ≈ 10 per shelf), which fits a 3-column sheet with search. |
| Label mismatch | CTA shows the Hint's own label (🥬 野菜・きのこ系); the chip reads 「野菜・きのこ」. Acceptable for six families; `other` (「ちょっと変わった材料」 vs 「その他」) needs an Owner call (§17 OD-3). |
| Sheet stacking | N1 already stacks a sheet over the Hint sheet and returns focus; same pattern, or close Hint and open Pantry. UI choice, technical. |

## 10. Trial Notebook N2: attempt diff (「前回から」)

Derivable **safely from existing data, no schema change**:
- `TrialEntryView.combination = { sauceBase, ingredientSet }` are the player's own sorted id lists. `ingredientSet` includes sauces.
- Diff = `ingredientSet(curr) \ ingredientSet(prev)` (+), `ingredientSet(prev) \ ingredientSet(curr)` (−), and `sauceBase` change (トマト → オリーブオイル). Names come from the player's own ingredients only: no recipe, matcher, distance or similarity involved. It is player-attempt vs player-attempt.
- Caveats the design must carry:
  1. **"Previous" must be defined.** Display order is *activity* (a retry moves a row to the top); `#n` is *creation*. Recommend: previous = the nearest older `#n` still in the display history, computed with a pure selector `attemptDiff(prev, curr)`; the first row shows no diff.
  2. **The Notebook does not hold every pizza** (FAILED, MATCHED discovery, ALREADY_DISCOVERED are not recorded): the label must be 「ノートの前の試作から」, not "前に作ったピザから".
  3. Set-based fingerprint: **quantity / position / bake changes are invisible** to the diff. Copy must not imply "nothing changed" for an identical set (that is the existing duplicate notice).
  4. 50-row display cap: an evicted predecessor means no diff for that row (omit, do not guess).
  5. Session-only: after reload there is nothing to diff (existing N1 footer already states it).
- Risk: a diff next to a hidden-recipe feedback line could be read as "this change moved me closer". The P2 line is already shown on the row; the diff must carry **no direction wording** (no 「近づいた」), only 「＋ / −」.

**N2 vs Hint/Pantry order:** N2 is independent of the Pantry (pure selector + a row line), tiny, and improves the loop immediately; but its value compounds once the player can *act* on diffs quickly (pin / pantry). Recommend N2 **after** the OPEN_POOL prompt slice and **in parallel with or just after** pin activation; it needs no activation gate.

## 11. 172-recipe scalability: role split

| Mechanism | Role at 62 / 172 | Mobile (390×844, 360×800) |
|---|---|---|
| Listing all owned in the tray | **Not viable** (topping 42 = 7 pages at 62; 71 at 105+) | one screen = 6 items |
| Making-step tabs | Stay as **process** steps; never become category tabs | unchanged |
| Hand / working set (≤ 9 / 12) | The **play surface**: tray shows only the working set | same stage/dock geometry at 9 and 12 (measured in R5-e) |
| Pantry | The **shelf**: everything owned, per step category | stable-height sheet, one scroller |
| Shelf chips | Primary narrowing (≤ 7 families) | one horizontally scrolling row |
| Search | Secondary narrowing (name; IME-hardened) | keyboard fit Mode C |
| Pin | Moves an item from the shelf to the hand | tile toggle + strip; strip auto-hidden while keyboard up |
| Hint → shelf CTA | Reduces "find the class" to one tap | same sheet |

Conclusion: **no new Free Cooking category tabs.** The existing Pantry / search / shelf / pin / hand set is the intended answer; what is missing is activation (pin / hand) and the Hint connection.

## 12. Gap Matrix (current production readiness)

| Area | Rating | Basis |
|---|---|---|
| Hint (pool = 1 ladder) | **GREEN** | production ON, classes shown |
| Hint (OPEN_POOL) | **RED** | dead end: one paragraph, nothing purchasable, no route to Pantry |
| Pantry | **YELLOW** | live but read-only; no Hint entry |
| Search | **GREEN** | live, IME / keyboard hardened (topping only today) |
| Category filter (shelf) | **GREEN** at 29 · **RED** at 62 until HCG | 23 / 42 toppings unclassified at 62 |
| Pin | **RED** | built + hardened, flag OFF |
| Working set (hand) | **RED** | built + hardened, flag OFF, capacity undecided |
| Free Cooking | **YELLOW** | works at 29 (4 topping pages); no class filter in the tray; does not scale |
| Trial Notebook (N1) | **GREEN** | merged, post-merge green, Owner-verified |
| Attempt diff | **RED** | not implemented; data sufficient |
| Persistence | **YELLOW** | session-only by design (Notebook, pins, shelf); save v2 untouched; acceptable for now |

## 13. Minimum Completion Plan (reuse, not rebuild)

Three mergeable slices. Each: no save change, no recipe change, HV (390×844 video + before/after screenshots) per policy.

**P1 — OPEN_POOL experiment prompt + shelf entry (B + D2 + E).** Pure selector (`owned ∧ not in any Notebook ingredientSet`, grouped by `ingredientShelf`, catalog order) + Hint-sheet section + CTA that opens the Pantry at that shelf (needs Pantry `initialShelf` / category override, read-only list acceptable). Recipe-blind property test, pool 1/2/3 identical, no counts.
*Why first:* it closes the only RED on the Owner's observed screen, it is independent of the open R6 decisions, and it creates the Pantry entry point that P2/P3 reuse.

**P2 — Pin / hand activation (existing R6-b → R6-c → R6-d → R6-e).** Not new design. Re-sync #319 with main, then Preview-only Hand/Pin UI (OD-R5e-1 / OD-R5e-3), real-device 9 vs 12 comparison, Owner capacity decision, production flag.
*Why second:* turns the Pantry from a viewer into the "choose → pin → hand" half of the loop. It carries the one genuinely Owner-gated item (capacity) and a real-device HV, so it should not block P1.

**P3 — Hint (pool = 1) class → Pantry shelf CTA + Notebook N2 diff.** Class CTA on COMPLETED SUB_CLASS rungs (reuses P1's Pantry input) and `attemptDiff` row line.
*Why third:* the class CTA is only worth its privacy surface once pins make the destination actionable; N2 is small and can ship in P1 or P3 as the Owner prefers (no dependency).

Not recommended: any Free Cooking category tab; pool-derived hints (A / C); persisting the Notebook as part of this loop.

## 14. Save schema

**No change required for P1, P2, P3.** Pins, shelf, Notebook, the OPEN_POOL prompt and the diff are all session-only / derived. Only N3 (persisting the Notebook across reload) would touch the save; it is optional and an Owner call. Do not bump the schema speculatively.

## 15. Blockers

- **No technical blocker.**
- Dependencies / hygiene: #319 is based on `6abddc7` and must merge main before any further R6 work; `PROJECT_HANDOFF.md` has stale LC-R0..R2 "no PR" wording and no R6-a content on main; the R6-a audit exists only in history (`7727cdc`) and is meant to re-land with R6-b.
- Gate: Hint→Pantry shelf CTA must not be wired against the 62 catalog until HCG classification (#293 / #296) covers the 23 unclassified toppings.

## 16. What this audit did not do

No implementation, no browser / e2e run, no Preview deploy, no Human Verification. Production state was read from code at `93ca1e4`, not from the deployed site. The multi-candidate audit's leak analysis was re-read and its option verdicts reused, not re-proven.

## 17. Owner Decisions (only what code cannot decide)

| ID | Question | Recommendation |
|---|---|---|
| **OD-1** | OPEN_POOL direction: free, answer-free, recipe-blind prompt (B + D2) as the answer for now, or must pool > 1 also give *answer-bearing* hints? (= OD-MC-1 / OD-MC-2 of the earlier audit, still open) | B + D2 first; revisit answer-bearing hints after playing it. Show in every sheet state. |
| **OD-2** | Sequence: P1 → P2 → P3 as above, or finish pin / hand activation (P2) first? | P1 first (independent, fixes the observed dead end). |
| **OD-3** | Label for the `other` family when the Hint CTA lands on the Pantry (「ちょっと変わった材料」 in the Hint vs 「その他」 on the chip), and whether the 「系」 difference is acceptable. | Accept 「系」 difference; for `other` the CTA names no chip label (copy 「この分類の食材を見る」). |
| **OD-4** | Hand capacity 9 vs 12 (already scheduled for the R6-d real-device comparison). | Decide at R6-d, as planned. |
| **OD-5** | N2 "前回" wording and scope: 「ノートの前の試作から」, ＋/− only, no direction wording, no diff for the first or evicted rows. | Accept as stated. |
| **OD-6** | Notebook persistence (N3), optional. | Defer; not needed for this loop. |

Not Owner decisions (code decides): shelf id reuse, no mapping table, storage of pins, flag mechanism, stacking behaviour, selector inputs, save schema.

## 18. Final report items (index)

1. Audited main SHA `93ca1e404c4e942e48b69506ff600bd8fcdfbb51` (no drift) · 2. §2 · 3. §3 · 4. §3 (search PRODUCTION ON) · 5. §3 (pin FLAG OFF) · 6. §5 (hand FLAG OFF) · 7. §6 YES · 8. §4 · 9. §1, §8 · 10. §9 · 11. §10 · 12. §11 · 13. §12 · 14. §13 · 15. §17 · 16. §15 · 17. §14 (none).
