# Progression 2.0 W1 Content Authoring — Fresh Audit

## 結論

監査基準は最新 `main` `dff233c042d2df6ee1c3a92f2d2419830aa05460`。W1 authority は PR #220 exact HEAD `e49dab96bd9b26dc0f520349cf09d1160c3519f5` の `docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_WAVES.json`（Owner Decision **Sauce OD-S1 = A**: #220 の W1 を正とし、sauceless recipes は W4 のまま、Sauce Contract 2.0 は実装しない）。既存172件調査は再実施していない。

判定は **READY 0 / REVIEW 10 / BLOCKED 0**。旧 #221 の W1（Aussie READY を含む）は stale authority に基づいていたため同期で置き換えた。10件すべてに global requirement（REC-01〜04、全 recipe が継承）と、新 ingredient の visual approval、likely-alias provenance、discovery regression、reference-capacity runtime dependency のいずれかが残るため、Progression 2.0 確定後すぐ content data 実装へ直行できる recipe は現時点で0件。READY を維持するための調整はしていない。

## Authority sync

- authority: PR #220 `e49dab96bd9b26dc0f520349cf09d1160c3519f5`、waves blob `af5b5689fc5c86bd47b31d79c5d11750ec89b7b8`、W1 snapshot sha256 `88422a13baff67a3ad65eb8df9f7c116d2d2d8db73ba04034cf7b7bdb375e746`（`docs/reports/data/TETO_PROGRESS2_W1_AUTHORITY_REFERENCE.json`）。
- W1 から外した（#220 では W4 / `SAUCELESS_RECIPE_CONTRACT`）: Aussie, Bacalhau, Full English, Polish Kielbasa, Tsukimi。
- W1 に加えた: New Haven Apizza, Hawaiian, Bambino, Pesto Caprese, Pesto Patate。
- 維持: Parmigiana Pizza, Pizza Portuguesa, Puttanesca, Pesto Tonno, Melanzane Pizza。
- retired ledger ids（再利用禁止）: `REC-05`, `ING-01`, `ING-04`, `ING-05`, `ING-06`。
- drift 検出: generator と `--check` はどちらも #220 waves artifact から W1 snapshot を再計算し、pin した sha256 と一致しなければ FAIL。git object / 明示ファイルから読む場合は blob 全体の sha256 も照合する。ローカルに見えている #220 branch tip が pin と異なる場合、または authority を読めない場合も FAIL（silent pass なし）。

## Reference capacity / global requirements

- 現行 reference ring は `PIECE_RING_POSITIONS` の 8 slot 固定で、`getPlayerReferencePizza()` は slot を modulo 割り当てする。authored non-sauce piece 数が 8 を超える Parmigiana（9）/ Pizza Portuguesa（10）/ Puttanesca（9）は `RT-01`（`REFERENCE_RING_CAPACITY`, `RUNTIME_DEPENDENCY_REQUIRED`）を参照し、runtime slice E が解消するまで READY にならない。minCount は UI 制約に合わせて削らない。
- global ledger entry は `inheritedByEveryRecipe` を持ち、open な REC-01 / REC-02 / REC-03 / REC-04 は全 recipe の `inheritedRefs` に継承される。readiness と change-map の `recipeDependencies` は `unresolvedRefs + inheritedRefs` から導出し、recipe を運ぶ slice の `dependsOn` も継承 global を明記する。REC-11（OD-S1 記録）は解決済み決定のため継承しない。

## 判定基準

- `READY`: composition evidence、独自 description/minCount/bakeTarget candidate、現行 ingredient visual、reference capacity が揃い、recipe 固有 ref と継承 global ref のどちらも open でない。
- `REVIEW`: recipe data は準備済みだが、継承 global requirement、新 ingredient の visual、likely-alias provenance、discovery regression、または reference-capacity runtime dependency が open。
- `BLOCKED`: evidence または現行 mechanic で安全に表現できない。今回0件。

## Recipe authoring summary

| recipe | sauce | cheese | toppings | pieces / ring | bake | CUT | collision | open refs (+ inherited) | status |
|---|---|---|---|---|---|---|---|---|---|
| `new-haven-apizza`<br>olive-oil×1, parmigiano×2, clam×3, garlic×2 | olive-oil | parmigiano | clam, garlic | 7 / 8 | 62–82 | 6-slice candidate; Gate TBD | LOW (near `quattro-formaggi`) | ING-07 (+ REC-01, REC-02, REC-03, REC-04) | **REVIEW** |
| `hawaiian`<br>tomato-sauce×1, mozzarella×2, ham×2, pineapple×3 | tomato-sauce | mozzarella | ham, pineapple | 7 / 8 | 58–78 | 6-slice candidate; Gate TBD | LOW (near `meat-lovers`) | ING-10 (+ REC-01, REC-02, REC-03, REC-04) | **REVIEW** |
| `parmigiana-pizza`<br>tomato-sauce×1, mozzarella×2, eggplant×3, parmigiano×2, basil×2 | tomato-sauce | mozzarella, parmigiano | eggplant, basil | 9 / 8 ⚠ | 58–78 | 6-slice candidate; Gate TBD | LOW (near `margherita`) | ING-03, REC-08, REC-10, RT-01 (+ REC-01, REC-02, REC-03, REC-04) | **REVIEW** |
| `bambino`<br>tomato-sauce×1, mozzarella×2, ham×2, corn×3 | tomato-sauce | mozzarella | ham, corn | 7 / 8 | 56–76 | 6-slice candidate; Gate TBD | LOW (near `meat-lovers`) | ING-08 (+ REC-01, REC-02, REC-03, REC-04) | **REVIEW** |
| `pizza-portuguesa`<br>tomato-sauce×1, mozzarella×2, ham×3, egg×1, onion×2, black-olive×2 | tomato-sauce | mozzarella | ham, egg, onion, black-olive | 10 / 8 ⚠ | 58–78 | 6-slice candidate; Gate TBD | LOW (near `capricciosa`) | REC-06, RT-01 (+ REC-01, REC-02, REC-03, REC-04) | **REVIEW** |
| `puttanesca-pizza`<br>tomato-sauce×1, anchovy×3, black-olive×2, capers×2, garlic×2 | tomato-sauce | none | anchovy, black-olive, capers, garlic | 9 / 8 ⚠ | 50–70 | 6-slice candidate; Gate TBD | LOW (near `marinara`) | ING-02, REC-07, RT-01 (+ REC-01, REC-02, REC-03, REC-04) | **REVIEW** |
| `pesto-caprese`<br>pesto×1, mozzarella×2, fresh-tomato×3, basil×2 | pesto | mozzarella | fresh-tomato, basil | 7 / 8 | 50–70 | 6-slice candidate; Gate TBD | LOW (near `margherita`) | ING-09 (+ REC-01, REC-02, REC-03, REC-04) | **REVIEW** |
| `pesto-tonno`<br>pesto×1, tuna×3, black-olive×2, onion×2 | pesto | none | tuna, black-olive, onion | 7 / 8 | 50–70 | 6-slice candidate; Gate TBD | LOW (near `tonno-e-cipolla`) | REC-09 (+ REC-01, REC-02, REC-03, REC-04) | **REVIEW** |
| `pesto-patate`<br>pesto×1, mozzarella×2, potato×3, bacon×2 | pesto | mozzarella | potato, bacon | 7 / 8 | 58–78 | 6-slice candidate; Gate TBD | LOW (near `genovese`) | ING-11 (+ REC-01, REC-02, REC-03, REC-04) | **REVIEW** |
| `melanzane-pizza`<br>tomato-sauce×1, mozzarella×2, eggplant×3, basil×2 | tomato-sauce | mozzarella | eggplant, basil | 7 / 8 | 58–78 | 6-slice candidate; Gate TBD | LOW (near `margherita`) | ING-03, REC-08 (+ REC-01, REC-02, REC-03, REC-04) | **REVIEW** |

Descriptions、minCount、bakeTarget は外部事実ではなく独自 game-authoring candidate。production投入前の content sign-off を `AUTHORING_REQUIRED` として ledger に残した。全10件の sauce は現行 `RecipeSauceProfile` union（tomato-sauce / pesto / olive-oil）内。

## Ingredient authoring summary

| id | displayName | emoji | color | category / placement | recipes | status | uncertainty |
|---|---|---|---|---|---|---|---|
| `capers` | ケッパー | 🟢 | `#6f7f35` | topping / scatter | puttanesca-pizza | **REVIEW** | No dedicated caper emoji; generic green-circle glyph needs visual differentiation review. |
| `clam` | あさり | 🦪 | `#c9b89a` | topping / scatter | new-haven-apizza | **REVIEW** | No clam emoji; the oyster glyph stands in for a bivalve and must not read as a different shellfish recipe. |
| `corn` | コーン | 🌽 | `#f5cf3a` | topping / scatter | bambino | **REVIEW** | Whole-cob glyph represents loose kernels abstractly; yellow tone must stay distinguishable from egg on cheese. |
| `eggplant` | ナス | 🍆 | `#62407b` | topping / scatter | melanzane-pizza, parmigiana-pizza | **REVIEW** | Whole-eggplant glyph represents a slice abstractly; verify visual density and tone after bake. |
| `fresh-tomato` | トマト | 🍅 | `#d9432f` | topping / scatter | pesto-caprese | **REVIEW** | Same glyph as production tomato-sauce and cherry-tomato; needs a distinguishing representation so Pesto Caprese is not confused with Genovese. |
| `pineapple` | パイナップル | 🍍 | `#f3c623` | topping / scatter | hawaiian | **REVIEW** | Whole-fruit glyph represents chunks abstractly; verify contrast on mozzarella after bake. |
| `potato` | じゃがいも | 🥔 | `#d9b77e` | topping / scatter | pesto-patate | **REVIEW** | Whole-potato glyph represents slices abstractly; beige tone may blend with cheese/crust after bake. |

全7種は current `Ingredient` schema と `IngredientPieceVisual` の emoji branch で表現可能で、#220 W1 の newIngredientIds と一致する。専用bitmapは不要だが、絵文字のOS差・抽象表現・焼成後コントラストを authoring review する。

## Completion Gate / Progression 接点

- 現行 Completion Gate が読む `requiredIngredients[].minCount` と `bakeTarget` の候補は用意した。ただし #218 の requiredForCompletion、CUT採否、許容幅を決めない。
- `pitzPrice`, `unlockFee`, `starGate`, `nonStarUnlockCondition`, `baseRewardPitz` は未決定。PR #217 の owner decision を先取りしない。
- wave は実装順候補であり unlock order ではない。

## Collision / evidence

10件とも exact production ingredient-set collision は0（`src/data/recipes.ts` を read-only で照合）。近傍 recipe は #220 authority の `nearestProductionRecipeId` と一致させ、regression target として記録した。Pizza Portuguesa / Puttanesca / Pesto Tonno の「オリーブ→black-olive」と Parmigiana の「パルミジャーノチーズ→parmigiano」は merged canonicalizer の likely alias であり、ledger（REC-06 / REC-07 / REC-09 / REC-10）と source trace を双方向照合する。Parmigiana / Melanzane は eggplant family として別 signature を固定する（REC-08）。Hawaiian / Bambino は1 ingredient 差、Pesto Caprese は Genovese と tomato glyph を共有するため visual 区別が必要（ING-09）。

## Progression確定後すぐ実装可能な範囲

- 即時: なし（READY 0）。全 recipe slice は REC-01〜04 を継承する。
- alias evidence確認後: slice A（Pizza Portuguesa / Pesto Tonno）。Pizza Portuguesa は RT-01（slice E）も必要。
- visual approval後: slice B（7 ingredients）→ slice C（残り8 recipes）。slice C の Puttanesca は REC-07 / RT-01、Parmigiana は REC-08 / REC-10 / RT-01、Melanzane は REC-08 も dependency として保持する（`recipeDependencies`）。
- #218後: slice D（Completion Gate integration）。
- reference-layout redesign 承認後: slice E（8-slot reference ring の capacity 拡張、runtime）。RT-01 を解消する。

## Deliverables

- `docs/reports/data/TETO_PROGRESS2_W1_RECIPE_AUTHORING_MATRIX.json`
- `docs/reports/data/TETO_PROGRESS2_W1_INGREDIENT_AUTHORING_MATRIX.json`
- `docs/reports/data/TETO_PROGRESS2_W1_UNRESOLVED_EVIDENCE_LEDGER.json`
- `docs/reports/data/TETO_PROGRESS2_W1_FUTURE_IMPLEMENTATION_CHANGE_MAP.json`
- `docs/reports/data/TETO_PROGRESS2_W1_AUTHORITY_REFERENCE.json`
- `tools/progression2_w1_authoring_audit.py --check`

## Validation

- W1 authority checker: recipe / ingredient evidence を #220 W1 snapshot（evidenceId、canonicalCandidateId、identity ingredients、sauce、newIngredientIds、nearest recipe、runtimeContractDependencies）と照合。authority drift で FAIL。
- W1 ledger link checker: recipe ↔ ledger ↔ change-map を双方向検証（recipe-specific / ingredient-specific ledger entry の orphan、scope外参照、change-map dependency 欠落、likely-alias の未ledger化、global requirement の継承漏れを検出）。
- reference-capacity checker: `src/logic/pizzaReferenceLayout.ts` の slot 数を read-only で数え、超過 recipe 集合 = RT-01 scope を双方向照合。RT-01 以外を全解決しても超過 recipe は READY にならない。
- canonicalCandidateId checker: 全 recipeIdCandidate を governing matrix と #220 authority の canonicalCandidateId と照合。
- W1 generator/checker: PASS（10 recipes / 7 ingredients / READY 0 / REVIEW 10 / BLOCKED 0）。
- `validate_recipe_catalog.py`: PASS（53 / 62 / 11）。
- `progression2_evidence_invariants.py`: PASS 4/4。

## Issue management

Issue #182 が既に content inventory / ingredient canonicalization / implementation split を管理しているため、新Issueは作らない。
