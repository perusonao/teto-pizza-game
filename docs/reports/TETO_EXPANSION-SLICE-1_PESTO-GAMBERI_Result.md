# Expansion Slice 1 — pesto-gamberi + shrimp — Result

Branch: `claude/expansion-slice-1-pesto-gamberi-fpru5k`. Implementation (not an audit) from the approved Preflight.

## 1. Base and Duplicate Gate

| | |
|---|---|
| Base `origin/main` (fresh fetch) | `78f41140e34770b2f5c1a843a26d9b640f4833bf` (= the required minimum) |
| Old preflight branch `claude/expansion-slice-1-preflight-levmou` | not reused |
| Duplicate Gate | no open PR implements `pesto-gamberi` / `shrimp` (the open PRs are old docs / audits); the only `pesto-gamberi` hits in the tree were 172-matrix docs / data. No code had `shrimp`. |

## 2. Owner Decisions applied

- Recipe `pesto-gamberi`, `ペストガンベリピザ`, description 「ジェノベーゼソースにエビ、トマト、にんにくをのせた、香り立つ魚介の一枚。」, order 「エビとにんにくのペストガンベリピザ、香りがよさそう！食べてみたいな！」.
- Exact identity `fresh-tomato` / `garlic` / `pesto` / `shrimp`, no cheese; counts pesto 1 / fresh-tomato 2 / garlic 2 / shrimp 3 (7 topping pieces = 2 + 2 + 3 inside the 8-slot ring); `bakeTarget` 50–70; Chapter 3 No.12; no CUT; `lunchRush: false`; `ladderCredit` true (absent); Hint key-free; save schema unchanged.
- Ingredient `shrimp`: topping, family `seafood`, glyph 🦐 U+1F990, ladder step 26 (T3): first purchase 100 Pitz, refill 50, pack 30 (k = 3 × 10 pizzas), no starter grant, no legacy price fields.
- **Hint class symbol:** `seafood` 🦐 → 🌊 U+1F30A (魚介系 label kept). 🦐 stays the shrimp ingredient glyph (G18 / H5-INV-2 hold; 🦞 / 🐙 not used). Display authority only.

## 3. Production change (10 data files, nothing else)

`src/data/{recipes,ingredients,ingredientTaxonomy,discoveryLadder,discoveryCatalog,recipeSauceProfiles,recipeHintRoles,orders,referencePizza,hintClassDisplay}.ts`. No reducer / persistence / component / mechanic / CUT / Lunch Rush / Dinner / HAND-capacity change. The discovery target id is the 172-matrix evidence id `pesto-gamberi-pizzadb-p11`; the sauce profile is `pesto` / `PAINT`; `hintKeyToppingId` / `KEY_TOPPING` were not added.

**Ladder.** Steps 1–25 are frozen byte-identically (pinned by the existing append-only tests). Step 26 = `{ ingredientIds: ["shrimp"], keyRecipeId: "pesto-gamberi" }`, T3. `brazilian-calabresa` stays `ladderCredit: false`.

| | before | after |
|---|---:|---:|
| recipes | 27 | **28** |
| credited recipes (step 26 reached at) | 26 | **27** (26 credited discoveries) |
| ingredients | 30 | **31** |
| toppings | 23 | **24** |
| ladder steps | 25 | **26** |
| chapters | 6 / 10 / 11 | **6 / 10 / 12** (pesto-gamberi = 第3章 No.12) |
| HAND capacity | 12 | 12 |

Note on the derivation rule: the REC-04 key-recipe rule breaks ties by recipe id, so a full re-derivation would put `pesto-gamberi` before `pesto-pollo`. The production ladder is therefore checked as "steps 1–25 fixed, only step 26 derived" (`discoveryLadder.test.ts`, `discoveryLadder.appendOnly.test.ts`); nothing in the ladder moved.

## 4. Test changes (count pins only, plus one slice test)

New: `src/state/discoveryExpansion1.pestoGamberi.test.ts` (13 tests: identity / counts / owner texts / Reference 2+2+3 / shrimp economy / 🌊 vs 🦐 / save v2 / ladder frozen 1–25 + step 26 / chapter 3 No.12 / state progression / target flow / Lunch Rush exclusion / key-free rungs with no CHEESE and no KEY_TOPPING and SUB_CLASS vegetable·herb·seafood), the parity fixture `scoreParity.expansion1-pesto-gamberi.json` (own fixture; frozen 25 / calabresa / pollo fixtures untouched), and `e2e/expansion1-pesto-gamberi.spec.ts`.

Migrated (only what the Expansion legitimately changes): 27→28 recipes, 30→31 ingredients, topping 23→24, 25→26 steps, chapters …/11→…/12, dex-pill `N/27`→`N/28`, Pizza Select sections 7/8/8/4→7/8/8/5, shelf distribution seafood 3→4, LC fixtures (runtime catalog 31 × 28), W1-population fixtures now exclude both appended-step recipes (`W1_RECIPES`, `PRODUCTION_W1`, `hintTarget` `W1_RECIPES`) instead of weakening assertions, economy table (shrimp is a ladder-only material: no legacy price), Lunch Rush exclusion (3 opt-outs), `scoreParity`, Dinner D-P window count (29 windows / 11,658 cases), No.27 pool tests (shrimp is never bought in those pins; the "both discovered" state is now `SHOP_NEW` because pesto-gamberi is the next recipe).

Measured values that were re-measured (not weakened): DH4-2A synthetic-family leak count 76 → 68 (the hardened guard still leaks 0), TQ-1C `SAUCE_ONLY` baseline 47 → 50 (low-k count stays 12), DH4-1 audit JSON (only the `catalogComparisonCandidates` counts changed, as in No.27). `selectableHint` still measures the credited W1 population (515) and excludes both appended-step recipes.

## 5. Verification (each run once on its HEAD)

| check | result |
|---|---|
| `tsc -b` / `npm run build` | clean / built |
| `oxlint` | 0 errors; the only warnings are in the untouched `scoringV2.noSauceProfile.test.ts` (pre-existing) |
| Full Vitest (after the last `src/` change) | **337 files / 6085 tests pass, 1 skipped** (the skip is pre-existing) |
| Focused (Expansion slice) | `discoveryExpansion1.pestoGamberi.test.ts` 13/13; append-only ladder, chapters, materialShop, w1Reachability, w1LadderEconomy, hint gates, G16/G18, lunchRush exclusion, catalogShelf / HAND all green inside the full run |
| Chromium E2E (iphone-390x844 + layout-chromium) over the specs touched or related (Research / Contract 2.1 / #378 / pantry / HAND pin / Dex / Hint / RT-01 / Discovery) | **82 passed, 4 skipped, 3 failed → fixed**; the 3 were legitimate follow-ups (below), re-run once each and green |
| New spec `expansion1-pesto-gamberi` | 2 tests × 390×844 and 360×800: 4/4 pass |
| `discovery3-no27-pesto-pollo` re-run at both widths | pass |
| WebKit | not run locally (left to the required `e2e-webkit` PR gate) |

The three E2E follow-ups: (1) the No.27 spec: discovering pesto-pollo now reaches step 26, so its RESULT shows 「🆕 新しい材料が入荷：エビ」, 「No.11（第3章 11/12）」 and the CTA 「🛒 新しい食材を見る」 (existing generic behaviour); the spec follows and opens the Dex from HOME; (2) `discovery3-pool2-production` Dex counter `発見 13 / 27` → `/ 28`; (3) `research-stock-blocked-378` seeded every ladder material including step 26's shrimp, which made pesto-gamberi researchable on a step-25 save; the seed is now the step-25 state.

## 6. Contracts held

- Hint 5.0 key-free: no `KEY_TOPPING`; rungs are SAUCE, STRUCTURE and SUB_CLASS ×3 (tomato → vegetable, garlic → herb, shrimp → seafood) — no CHEESE rung, so neither cheese nor sauce absence is read off RESULT. #360 contracts untouched (code unchanged).
- Anti-oracle: the E2E sweeps the whole DOM for undiscovered recipe identity at the Research Entry, RESULT, Notebook and Hint sheet; no `ペストガンベリ` / candidate / distance / near-far wording.
- #378: shrimp owned with stock 0 → Research card 「研究を続けるには材料の補充が必要」 (no recipe name, no ingredient list, no number), Shop CTA 「🛒 ショップで補充する」, Shop row 「在庫なし」, refill → Research resumes. No new branch; it is the existing generic behaviour.
- Lunch Rush pool excludes pesto-gamberi (discovered + owned + in stock). Dinner has no dedicated branch (the catalog derivation picked the recipe up; the D-P window sweep covers it). Save: `schemaVersion` 2, no persistence file touched. HAND: capacity 12; shrimp is pinned from the Pantry in the real flow (24 toppings > 12).

## 7. Human Verification

Real operations at 390×844 (and 360×800 for screenshots): Shop NEW → purchase → Inventory → Research Entry → Research Target → a real trial (Pantry-pinned shrimp, eggplant, tomato, pesto) → RESULT ○/× → Notebook → Hint 5.0 (rungs bought until 🌊 魚介系 shows) → the exact recipe → NEW RECIPE → Dex 第3章 No.12 (28/28); plus the #378 loop. **Only the starting save is seeded; no RESULT, Hint or discovery state was seeded in place of an operation.** Horizontal overflow is asserted at every state (none); no console errors.

### Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `expansion1-pesto-gamberi-main-flow-390x844.mp4` | 390×844 | 55.8 s | 1.1 MB | PASS |
| `expansion1-378-stock-block-390x844.mp4` | 390×844 | 13.5 s | 0.3 MB | PASS |

H.264 (converted from Playwright WebM with ffmpeg), checked with `ffprobe` (codec / 390×844 / duration / size). Download: delivered directly in the session; **not committed** (per the Policy). What to check in the main video: shrimp NEW in the Shop (🦐 エビ, 10ピザ分（30個）, 初回 100 Pitz) and bought; Inventory shows 🦐; the Research Entry; the RESULT chips (ジェノベーゼソース○ / ナス× / トマト○, エビ ✓ as the known unlock); the Notebook; the Hint sheet where the seafood class is 🌊 魚介系 (not 🦐); NEW RECIPE ペストガンベリピザ; Dex 第3章 No.12. The second video shows the #378 stock-blocked card → Shop 「在庫なし」 → refill → Research available again.

Video Verification: PASS

Screenshots (committed): `docs/reports/screenshots/expansion-slice-1-pesto-gamberi/` (12 states × 2 widths): `exp1-shop-shrimp-new` (before purchase) / `-bought` (after), `exp1-inventory-shrimp`, `exp1-research-entry`, `exp1-result-research-mark`, `exp1-notebook`, `exp1-hint5-seafood-class`, `exp1-new-recipe-discovered`, `exp1-dex-no12`, `exp1-378-dex-stock-blocked` (before) / `-shop-zero-stock` / `-research-resumed` (after).

## 8. Docs touched

`docs/PROJECT_HANDOFF.md` (Expansion Slice 1 addendum with the new authority counts; the stale "Not done: #360" removed — #360 S1–S3 are merged), `docs/reports/TETO_360_S3_RUNG-BALANCE-GATE_Result.md` (stale "Pending PR CI / Codex review" → merged), `docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json` (regenerated).

## 9. Privacy

No personal data, credentials, e-mail addresses or tokens in any committed file; videos are not committed. The screenshots are test-seeded game states.

## 10. Status

PR opened, **not merged**. Codex review / Final Gate / merge are the next instruction. Expansion Slice 2 is not started.
