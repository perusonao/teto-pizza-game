# M7 許可リスト（honey 初号機）と B22 の PAINT 仕様の二重適用を避ける設計（#780、docs-only・設計のみ）

2026-11-09。コード・HOT は変更していない。凡例: 【実測】読取り、【推論】設計。

> **決定済み（Owner 承認 2026-11-09）:** M7-d — **buffalo-chicken は B22 の焼成前 PAINT・通常カタログで実装し、buffalo-sauce は POST_BAKE 液体にも M7 の許可リストにも追加しない。** M7 の最初の適用は **hot-honey-pepperoni の honey のみ**（許可リストは `["olive-oil","honey"]`）。実装順序は #776 merge ✔（`1d5f5a1e`）→ B22 の HOT 編集 → M7。M7 の完成には DRIZZLE D2 以降（journal・在庫・採点・工程遷移・UI 接続）が必要で、許可リストの追加だけでは完成扱いにしない。
> 旧版（作成時）は buffalo-sauce を許可リスト候補として扱い M7-d を未決の推奨としていたが、承認により該当の記述はすべて下記に置き換えた（独立レビュー 2026-11-09 の指摘 F1 への対応）。

## 1. 二重適用が起きる場所【実測】
| 食材 | 出荷・計画での扱い | M7 での扱い | 衝突の可能性 |
|---|---|---|---|
| **buffalo-sauce** | B22 準備書: 焼成前の PAINT ソース、`buffalo-chicken` は通常カタログ・後乗せなし | **M7 の対象外**（許可リストにも POST_BAKE にも使わない） | なし（M7-d で排除） |
| **honey** | **出荷済み**: B20-A で焼成前の第 2 ソース（pesto＋honey）。`recipeSauceProfiles` に honey の行は無く「存在で採点」される（`recipeSauceProfiles.ts:392`）。カタログの `applicationPhase` は焼成前では未指定 | hot-honey-pepperoni（staged のみ）で `applicationPhase: "POST_BAKE"` の液体 | 同じ食材が**別レシピで別工程**。同一レシピ内で両方に出るのは禁止 |

## 2. 設計原則【推論】
1. **工程はレシピの要件が持つ**（`applicationPhase`）。許可リストは「液体として後がけできる」という能力で、焼成前での使用を禁じない。
2. **1 レシピ内で同じ食材を 2 つの工程に出さない**（`POST_BAKE` の要件と、そうでない要件の併記を検証で拒否）。
3. **許可リストへの追加は 1 食材・1 PR・1 行**（`POST_BAKE_LIQUID_INGREDIENT_IDS`、型が連動）。最初は honey のみ。buffalo-sauce の追加は Owner 承認のない限り行わない。
4. **在庫・採点・Dex は工程ごとに別経路**。同一食材の二重消費を防ぐため、1 回の調理でその食材はどちらか 1 経路で 1 回だけ消費する（D2 の原子的消費の設計に含める。D2 は HOLD）。

## 3. 追加する検証（実装時・テストで強制。詳細は `TETO_M7_HONEY-TEST-DESIGN_2026-11-09.md`）
| 検証 | 内容 |
|---|---|
| T-1 | 同一レシピ内で、同じ食材が `POST_BAKE` の要件とそうでない要件の両方に現れない |
| T-2 | honey を焼成前に持つレシピ集合と POST_BAKE で持つレシピ集合が互いに素 |
| T-3 | POST_BAKE のソース／液体要件の食材はすべて許可リストに載る（逆の条件は課さない） |
| T-5 | buffalo-chicken は POST_BAKE 要件を持たず、許可リストに buffalo-sauce が無い |
| T-6 | 許可リストが `["olive-oil","honey"]` に等しい（拡張は Owner 承認が必要） |

## 4. 順序と競合【実測】
B22 の HOT 編集（仕様の Owner 最終承認後、buffalo-sauce の PAINT 行を含む）→ D-ING-1 R1 → M7-PR1（honey 追加＋T-3・T-6）→ M7-PR2（`validateLateCatalog` の緩和）→ M7-PR3（hot-honey-pepperoni の登録）→ D2〜D5（HOLD、完成条件）。M7 の食材・レシピ登録は B22 と同じ HOT ファイルのため B22 の後。本書は docs のみで HOT・他の claim と重ならない。
