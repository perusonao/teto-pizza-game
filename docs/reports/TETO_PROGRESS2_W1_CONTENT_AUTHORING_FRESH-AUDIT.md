# Progression 2.0 W1 Content Authoring — Fresh Audit

## 結論

監査基準は最新 `main` `dff233c042d2df6ee1c3a92f2d2419830aa05460`。Issue #182、merged PR #189/#191、open PR #217/#220 を確認し、#220 の unordered first-10 candidate set だけを content authoring 面で再監査した。既存172件調査は再実施していない。

判定は **READY 1 / REVIEW 9 / BLOCKED 0**。根拠未確定値を READY に含めないため、Progression 2.0 確定後に content data 実装へ直行できるのは Aussie のみ。Pizza Portuguesa / Pesto Tonno は `オリーブ` → `black-olive` の likely-alias provenance review（REC-06 / REC-09）、残る7件は新 ingredient 6種の visual authoring approvalを要する。Puttanesca は capers visual（ING-02）に加えて同じ likely-alias provenance（REC-07）も未解決のため、capers 承認だけでは READY にならない。

## 判定基準

- `READY`: composition evidence、独自 description/minCount/bakeTarget candidate、現行 ingredient visual が揃う。
- `REVIEW`: recipe data は準備済みだが、新 ingredient の emoji/color/piece abstraction を human review する。
- `BLOCKED`: evidence または現行 mechanic で安全に表現できない。今回0件。

## Recipe authoring summary

| recipe | sauce | cheese | toppings | bake | CUT | collision | evidence | status |
|---|---|---|---|---|---|---|---|---|
| `aussie`<br>mozzarella×2, bacon×3, egg×1, onion×3 | none | mozzarella | bacon, egg, onion | 56–76 | 6-slice candidate; Gate TBD | LOW | EVIDENCE_READY | **READY** |
| `bacalhau`<br>mozzarella×2, salt-cod×3, onion×2, black-olive×2 | none | mozzarella | salt-cod, onion, black-olive | 58–78 | 6-slice candidate; Gate TBD | LOW | EVIDENCE_READY | **REVIEW** |
| `parmigiana-pizza`<br>tomato-sauce×1, mozzarella×2, eggplant×3, parmigiano×2, basil×2 | tomato-sauce | mozzarella, parmigiano | eggplant, basil | 58–78 | 6-slice candidate; Gate TBD | LOW | EVIDENCE_READY | **REVIEW** |
| `pizza-portuguesa`<br>tomato-sauce×1, mozzarella×2, ham×3, egg×1, onion×2, black-olive×2 | tomato-sauce | mozzarella | ham, egg, onion, black-olive | 58–78 | 6-slice candidate; Gate TBD | LOW | EVIDENCE_READY | **REVIEW** |
| `puttanesca-pizza`<br>tomato-sauce×1, anchovy×3, black-olive×2, capers×2, garlic×2 | tomato-sauce | none | anchovy, black-olive, capers, garlic | 50–70 | 6-slice candidate; Gate TBD | LOW | EVIDENCE_READY | **REVIEW** |
| `full-english-pizza`<br>mozzarella×2, bacon×2, sausage×2, egg×1, baked-beans×3 | none | mozzarella | bacon, sausage, egg, baked-beans | 60–80 | 6-slice candidate; Gate TBD | LOW | EVIDENCE_READY | **REVIEW** |
| `pesto-tonno`<br>pesto×1, tuna×3, black-olive×2, onion×2 | pesto | none | tuna, black-olive, onion | 50–70 | 6-slice candidate; Gate TBD | LOW | EVIDENCE_READY | **REVIEW** |
| `polish-kielbasa`<br>mozzarella×2, sausage×3, sauerkraut×3, onion×2 | none | mozzarella | sausage, sauerkraut, onion | 60–80 | 6-slice candidate; Gate TBD | LOW | EVIDENCE_READY | **REVIEW** |
| `melanzane-pizza`<br>tomato-sauce×1, mozzarella×2, eggplant×3, basil×2 | tomato-sauce | mozzarella | eggplant, basil | 58–78 | 6-slice candidate; Gate TBD | LOW | EVIDENCE_READY | **REVIEW** |
| `tsukimi-pizza`<br>mozzarella×2, egg×1, bacon×3, green-onion×2 | none | mozzarella | egg, bacon, green-onion | 56–76 | 6-slice candidate; Gate TBD | LOW | EVIDENCE_READY | **REVIEW** |

Descriptions、minCount、bakeTarget は外部事実ではなく独自 game-authoring candidate。production投入前の content sign-off を `AUTHORING_REQUIRED` として ledger に残した。

## Ingredient authoring summary

| id | displayName | emoji | color | category / placement | recipes | status | uncertainty |
|---|---|---|---|---|---|---|---|
| `baked-beans` | ベイクドビーンズ | 🫘 | `#a94f35` | topping / scatter | full-english-pizza | **REVIEW** | Emoji appearance varies by platform; verify legibility at tray and baked-piece sizes. |
| `capers` | ケッパー | 🟢 | `#6f7f35` | topping / scatter | puttanesca-pizza | **REVIEW** | No dedicated caper emoji; generic green-circle glyph needs visual differentiation review. |
| `eggplant` | ナス | 🍆 | `#62407b` | topping / scatter | parmigiana-pizza, melanzane-pizza | **REVIEW** | Whole-eggplant glyph represents a slice abstractly; verify visual density and tone after bake. |
| `green-onion` | 青ねぎ | 🌱 | `#4f8a3c` | topping / scatter | tsukimi-pizza | **REVIEW** | No exact green-onion emoji; sprout glyph can be confused with basil/herbs. |
| `salt-cod` | 塩だら | 🐟 | `#d8c9aa` | topping / scatter | bacalhau | **REVIEW** | Generic fish glyph does not encode salted cod; description/name must carry specificity. |
| `sauerkraut` | ザワークラウト | 🥬 | `#d8d59a` | topping / scatter | polish-kielbasa | **REVIEW** | Leafy-green glyph represents shredded fermented cabbage abstractly; verify contrast on cheese. |

全6種は current `Ingredient` schema と `IngredientPieceVisual` の emoji branch で表現可能。専用bitmapは不要だが、絵文字のOS差・抽象表現・焼成後コントラストを authoring review する。

## Completion Gate / Progression 接点

- 現行 Completion Gate が読む `requiredIngredients[].minCount` と `bakeTarget` の候補は用意した。ただし #218 の requiredForCompletion、CUT採否、許容幅を決めない。
- `pitzPrice`, `unlockFee`, `starGate`, `nonStarUnlockCondition`, `baseRewardPitz` は未決定。PR #217 の owner decision を先取りしない。
- wave は実装順候補であり unlock order ではない。

## Collision / evidence

10件とも exact production ingredient-set collision は0。近傍 recipe は regression target として記録した。Pizza Portuguesa / Puttanesca / Pesto Tonno の「オリーブ→black-olive」は merged canonicalization の likely alias であり、より具体的な品種は主張しない。Parmigiana / Melanzane は eggplant family として別 signature を固定する。Polish Kielbasa は governing matrix と同じ canonical ID `polish-kielbasa` を使用する。

## Progression確定後すぐ実装可能な範囲

- 即時: slice A（Aussie）の recipe data、CUT opt-in review、discovery collision tests。
- alias evidence確認後: slice B（Pizza Portuguesa / Pesto Tonno）。
- visual approval後: slice C（6 ingredients）→ slice D（残り7 recipes）。slice D の Puttanesca は REC-07、Parmigiana / Melanzane は REC-08 も dependency として保持する（`recipeDependencies`）。
- #218後: slice E（Completion Gate integration）。

## Deliverables

- `docs/reports/data/TETO_PROGRESS2_W1_RECIPE_AUTHORING_MATRIX.json`
- `docs/reports/data/TETO_PROGRESS2_W1_INGREDIENT_AUTHORING_MATRIX.json`
- `docs/reports/data/TETO_PROGRESS2_W1_UNRESOLVED_EVIDENCE_LEDGER.json`
- `docs/reports/data/TETO_PROGRESS2_W1_FUTURE_IMPLEMENTATION_CHANGE_MAP.json`
- `tools/progression2_w1_authoring_audit.py --check`

## Validation

- W1 ledger link checker: recipe ↔ ledger ↔ change-map を双方向検証（recipe-specific / ingredient-specific ledger entry の orphan、scope外参照、change-map dependency 欠落を検出）。
- W1 generator/checker: PASS（10 recipes / 6 ingredients / READY 1 / REVIEW 9 / BLOCKED 0）。
- `validate_recipe_catalog.py`: PASS（53 / 62 / 11）。
- `progression2_evidence_invariants.py`: PASS 4/4。
- PR #189 matrix semantic validation: 172 unique rows、counts/capabilities/ledgers PASS。既存 `--check` の byte comparison だけは Windows path separator（`docs\...` vs `docs/...`）差で FAIL。source matrix は変更していない。

## Issue management

Issue #182 が既に content inventory / ingredient canonicalization / implementation split を管理しているため、新Issueは作らない。
