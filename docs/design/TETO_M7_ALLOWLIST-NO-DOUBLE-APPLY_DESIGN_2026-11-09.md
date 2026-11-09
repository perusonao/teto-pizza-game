# M7 許可リスト（buffalo-sauce・honey）と B22 の PAINT 仕様の二重適用を避ける設計（#780、docs-only・設計のみ）


> **状態更新（2026-11-09）:** #776 は merge 済み（`1d5f5a1e`）、#800 も merge 済み。実装順序は Owner 承認済み: #776 ✔ → B22 の HOT 編集 → M7。M7-d 承認済み（buffalo-chicken は B22 の焼成前 PAINT、buffalo-sauce は許可リストに追加しない）。最初の適用は hot-honey-pepperoni の honey。

2026-11-09。コード・HOT は変更していない。**すべて提案。** 凡例: 【実測】読取り、【推論】、【未確認】。前提: Owner 承認（2026-11-09）— M7 は buffalo-sauce と honey を最初の許可リスト候補とする。実装は #776（DRIZZLE D1）の merge と B22 の HOT 編集の後。

## 1. 二重適用が起きる場所【実測】
| 食材 | B22／出荷済みでの扱い | M7 の許可リスト案での扱い | 衝突 |
|---|---|---|---|
| **buffalo-sauce** | B22 準備書（#801 §5）: **焼成前の PAINT ソース**を推奨（`recipeSauceProfiles` に PAINT 行、`buffalo-chicken` は**通常**カタログ・後乗せなし） | 液体として許可（`buffalo-chicken-pizzadb` は staged では POST_BAKE） | **同一レシピ・同一食材が PAINT と POST_BAKE の両方になり得る** |
| **honey** | **出荷済み**: B20-A で焼成前の第 2 ソース（pesto＋honey、PAINT 系） | `hot-honey-pepperoni` で POST_BAKE の液体 | **同一食材が、別レシピで別工程**。レシピ内で両方に出るのは不可 |

## 2. 設計原則（二重適用の禁止）【推論】
1. **工程はレシピの要件が持つ。食材は持たない。** `applicationPhase` はレシピ側の宣言（現行どおり）。許可リストは「この食材は液体として後がけできる」という**能力**であって、PAINT での使用を禁じない・強制もしない。
2. **1 レシピ内で、同じ食材を 2 つの工程に出さない**（PAINT と POST_BAKE の併記を検証で拒否）。
3. **同じレシピに PAINT 行と液体要件を両方持たせない。** buffalo-chicken は **PAINT か POST_BAKE の一方だけ**（下の Owner 判断 M7-d）。
4. **許可リストの追加は 1 食材につき 1 PR・1 行**（#776 の `POST_BAKE_LIQUID_INGREDIENT_IDS`、型が連動）。B22 の PAINT 行追加（`recipeSauceProfiles`）とは別 PR にして、同時に両方を触らない。
5. **在庫・採点・Dex は工程ごとに別経路**（PAINT は既存のソース経路、液体は D2〜D5 の journal）。同一食材の二重消費を防ぐため、1 回の調理でその食材は**どちらか 1 経路で 1 回だけ**消費する（D2 の原子的消費の設計に含める）。

## 3. 追加する検証（実装時・テストで強制）【推論】
| 検証 | 内容 |
|---|---|
| V-1 | レシピの `requiredIngredients` に同じ `ingredientId` が PAINT 相当と `POST_BAKE` で重複しない |
| V-2 | `applicationPhase: "POST_BAKE"` の食材がソース・液体なら、許可リストに載っていること（載っていなければ現行どおり拒否） |
| V-3 | 許可リストの食材が `recipeSauceProfiles` の PAINT 行を持つ場合、**そのレシピ**では POST_BAKE にしない（レシピ単位の排他） |
| V-4 | buffalo-chicken はカタログ上の工程が 1 つだけ（B22 の PAINT 案を採るなら POST_BAKE 要件・許可リスト登録なし） |

## 4. Owner 判断（推奨つき）
| ID | 論点 | 推奨 |
|---|---|---|
| **M7-d** | buffalo-chicken: B22 の **PAINT（焼成前、通常カタログ）** か M7 の **POST_BAKE 液体**か | **PAINT を B22 で先に出荷し、M7 の液体は honey（hot-honey-pepperoni）から**。現実のバッファローは「焼成後のかけ」だが、B22 は新機構なしで出せる。buffalo-sauce の液体化は M7 の実装（D2〜D5 後）で別レシピ／別版として再判断 |
| M7-b（確認） | 最初の許可リスト候補は buffalo-sauce と honey | 承認済み。ただし buffalo-sauce の登録は M7-d の結論後。**honey を先**（出荷済み食材のため新食材の登録が要らない） |
| M7-e | 原則 1〜5 の採用 | 採用 |

## 5. 順序と競合【実測】
#800 merge → B22 の仕様承認 → B22 の HOT 編集（buffalo-sauce の PAINT 行を含む）→ D-ING-1 R1 → **#776 merge（個別承認）** → DRIZZLE D2〜D5（HOLD）→ M7 実装（honey から）。M7 の食材・レシピ登録は B22 と同じ HOT ファイルのため、必ず B22 の後。本書は docs のみで HOT・他の claim と重ならない。
