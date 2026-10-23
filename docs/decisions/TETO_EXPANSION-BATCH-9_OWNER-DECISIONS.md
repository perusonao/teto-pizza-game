# Next Batch (working name Batch 9: 月見 先行 / 柚子えび 保留) — Owner Decisions と着手条件

Status: **決定の記録と着手条件の整理のみ（docs-only）。** ゲームコード・テスト・データ・workflow・共有 Preview・本番は変更していない。レシピ実装 PR は未作成。**#578 の claim は解除していない。**
基準 `origin/main` = `70aa262`（#644、CI インフラのみ）、2026-10-23。`CLAUDE.md` は変更なし。
前提: `docs/reports/TETO_RECIPE-EXPANSION_NEXT-BATCH-2_Fresh-Audit.md`、`docs/reports/TETO_RECIPE-EXPANSION_YUZU-TSUKIMI_Pre-Implementation-Audit.md`。形式は `TETO_EXPANSION-BATCH-8_OWNER-DECISIONS.md` に倣う。
**「決定済み」は Owner が指示した内容だけ。** それ以外は「提案」「未決」と明記する。

## 1. 決定済み（Owner、2026-10-23）

| ID | 決定 |
|---|---|
| OD-B9-1 | 柚子えびは**原典確認まで保留**（焼成前 / 後の分岐も確認待ち） |
| OD-B9-2 | 柚子胡椒（`yuzu-kosho`）はソースとして仮分類、色 `#b5c56a` を仮採用（実機 HV で確定）。**柚子えびの保留中は実装しない** |
| OD-B9-3 | `green-onion`: family = `herb`（L1 のみ）、`pieceVisual` = 小口切りの輪、size class = `xs`（維持） |
| OD-B9-4 | 個数・焼成窓は暫定値のまま（GAMEPLAY CALIBRATION） |
| **OD-B9-5（改訂）** | **J1: 月見を通常 ladder の次の step 56 として先行する。** 旧案「柚子 56 → 月見 57」は**撤回**（柚子は保留で step を持たない） |
| **OD-B9-6（新）** | **J2: 青ねぎ・卵の投入タイミングは原典確認まで未確定。本番を有効化する実装はまだ許可しない**（通常カタログへの追加は merge = 有効化なので、確認前は実装 PR を作らない） |
| **OD-B9-7（新）** | **#578 の有効な claim は無断で解除しない** |

OD-B9-3 の適用範囲は `green-onion` の 1 行のみ（他の PROPOSED 行は承認しない）。glyph は表示しない text fallback で、G18 を満たすものを実装時に選ぶ。

## 2. 事前確認の結果

| 項目 | 結果 |
|---|---|
| main | `70aa262`。通常レシピ 62・食材 67・ladder 55 step（**次は 56**）。差分は #644（WebKit CI）のみ |
| レシピ追加の open PR | **無し**。open: #645（Pinsa docs、`docs/decisions` `docs/design` のみ → 重複なし）、#640 / #639（Pinsa 基盤）、#633 / #620 / #612 / #587（docs）、#581 / #540（HOLD）。`green-onion` / `tsukimi-pizza` / `yuzu-kosho` を扱う PR は無い |
| #640 との重複 | `data/discoveryCatalog.ts` を変更。月見の PR も同ファイルに 1 行追記するため同一ファイル（別ハンクの見込み。後から入る方が追従） |

## 3. #578 の claim: 状態・対象・担当

### 3.1 状態（確認事項のみ。解除はしていない）

| 項目 | 内容 |
|---|---|
| claim | session `session_015Uh6ASC8mbkWCYQVK5bb3w`、issue 578、`pr: 634`、branch `claude/resume-dev-work-issues-zl9pht`、**期限 2026-10-27T00:00:00Z**。`released: true` の投稿は**無い** |
| 範囲（文面） | 「Phase A — Flammkuchen 単独。味噌・柚子胡椒・タヒニは着手しない」 |
| files | `src/data/{ingredients,recipes,recipeSauceProfiles,discoveryCatalog,discoveryLadder,referencePizza,recipeHintRoles,orders}.ts`、`src/data/*.test.ts`、`src/logic/catalog/**`、`src/logic/discovery/__golden__/**`、`src/logic/discovery/*.test.ts`、`src/logic/materialShop.test.ts`、`src/state/progression.test.ts`、`docs/reports/TETO_NEW-SAUCES-A_Result.md` |
| 担当セッションの状態（session API、参考） | status `IDLE` / 接続なし / 最終更新 2026-10-23T03:33Z / 要約「PR #634 squash-merged、session unsubscribed」。ブランチ先頭 `91ffe89` は #634 の head。**継続作業の兆候なし。ただし稼働を直接確認できたわけではない**（#527 の代理 release 時の記述と同じ限界） |
| 仕事の状態 | #634 は main に入っている（flammkuchen = No.62、step 55）。claim の Phase A の仕事は完了済み |

### 3.2 月見の実装と claim の重なり

月見の PR が触るファイルのうち、claim の files と重なるもの: `recipes.ts` `ingredients.ts` `recipeSauceProfiles.ts` `discoveryCatalog.ts` `discoveryLadder.ts` `referencePizza.ts` `recipeHintRoles.ts` `orders.ts`、`src/data/*.test.ts`、`src/logic/catalog/**`（manifest / ledger）、`__golden__/**`、`materialShop.test.ts`、`progression.test.ts` — **ほぼ全部**。重ならない: `ingredientTaxonomy.ts` `toppingSizeClass.ts` `components/IngredientGlyph.tsx` `App.css`（新トッピングの描画）、`e2e/`、新規レポート。
重ならない領域の作業は claim と衝突しない。HOT 領域（`recipes.ts` 等）は §3.3 の手続きが済むまで着手しない。

### 3.3 既存担当者との重複を避けた引き継ぎ手順（提案、Owner が選ぶ）

claim は soft reservation（警告のみ、lock ではない）で、解除できるのは同じ session + issue の `released: true`（Owner / Member / Collaborator 名義）。**無断では解除しない**（OD-B9-7）。選択肢:

| 案 | 手順 | 評価 |
|---|---|---|
| **A（推奨）Owner 承認の代理 release** | Owner が「#578 の Phase A claim（session `015Uh6…`）を代理 release してよい」と明示 → 実装担当セッションが #527 の前例（2026-10-22）と同じ形式で、**「元セッション本人の release ではない・Owner 承認による代理操作」と明記**した `released: true` ブロックを #578 に投稿。根拠は #634 merge 済み・担当 IDLE | 最も明確。Owner Gate の HOT 重複警告が出ない |
| B 自然失効を待つ | 2026-10-27T00:00Z に期限切れ（約 3 日後）。それまで HOT 領域に着手しない | 手続き不要だが遅い。原典確認の待ちと並行できるなら実害は小さい |
| C 併存 | claim は解除せず、新しい **Phase B claim**（下記）を追加。重なりと merge 順（月見 PR を先に merge、旧 claim の PR は既に merge 済みで衝突なし）を本文に明記。Owner Gate は HOT 重複を警告表示する | 解除を伴わないので OD-B9-7 に抵触しない。警告は残る |

新 claim（実装着手時に実装担当が投稿。本セッションは投稿しない）の雛形:

```
Phase B-1: 月見ピザ + green-onion（柚子えび・味噌・タヒニは対象外）。旧 Phase A claim（session 015Uh6…、#634 merge 済み）との重なり: <A: 代理 release 済み / B: 失効待ち / C: 併存・本 PR を先に進める>。
teto-claim:v1 {"session":"<実装セッション>","issue":578,"pr":null,"branch":"<claude/...>",
 "files":["src/data/recipes.ts","src/data/ingredients.ts","src/data/ingredientTaxonomy.ts","src/data/toppingSizeClass.ts","src/data/recipeSauceProfiles.ts","src/data/discoveryCatalog.ts","src/data/discoveryLadder.ts","src/data/referencePizza.ts","src/data/recipeHintRoles.ts","src/data/orders.ts","src/data/*.test.ts","src/components/IngredientGlyph.tsx","src/components/IngredientGlyph.test.tsx","src/App.css","src/logic/catalog/**","src/logic/discovery/__golden__/**","src/logic/materialShop.test.ts","src/state/progression.test.ts","docs/reports/TETO_NEW-SAUCES-B1_Result.md"],
 "dependsOn":[],"expires":"<着手から 72h〜14 日以内>"}
```
（実際の comment では HTML コメント形式 `<!-- teto-claim:v1 {...} -->` で投稿する。この文書内の例は fence 内なので live ではない。）

## 4. 月見（`tsukimi-pizza`）

### 4.1 データ・描画・ヒント・Research・ladder（OD-B9-3/4/5 反映）

| 項目 | 内容 | 状態 |
|---|---|---|
| id / 名 / target | `tsukimi-pizza` / 月見ピザ / `tsukimi-pizza-pizzadb-p14` | 提案 |
| 材料 | bacon 3 / egg 1 / mozzarella 2 / green-onion 2（8 片 = リング 8） | **暫定** |
| 焼成窓 | 58–78 | 暫定 |
| 工程 | NO_SAUCE（sauce profile `null`）→ CHEESE → TOPPING → BAKE。CUT なし。credited、`lunchRush:false`、key-free | 提案 |
| `green-onion` | `category: "topping"`, `nameJa: "青ねぎ"`, `placement: "scatter"`, `pieceVisual: "green-onion-slices"`（小口切りの輪）, `unlockCondition: { minTotalStars: 0 }`, 色 緑（HV で確定）, family `herb`（`OD-B9-3` コメント）, size class `xs`, 専用 SVG + 参照 SVG（Style Lock v2） | 決定済み（OD-B9-3） |
| ladder | **step 56** `["green-onion"]`、key = `tsukimi-pizza`、T4（120 / 60 Pitz）、星ゲート無し、credited 58→59。1–55 凍結 | 決定済み（OD-B9-5）。星ゲート無しは前例 |
| Research | コホート = green-onion（単独）→ 文字なし。既存エントリの文字は動かない | 導出 |
| 図鑑 | 通常 63 件。章 4 は 27→28（導出表示、保存無影響） | 導出 |
| Hint 5.0 | 永久 key-free。golden は追記専用。`herb` が 9 件目。`hint5Taxonomy.gate`（G18）要再実行 | 要検証 |
| 名前衝突 | `ing:onion` は `ing:green-onion` の部分文字列にならない（確認済み）。同一レシピに `onion` / `green-onion` を含む合成ケースを 1 本足す | 確認済み |
| ★ゲート到達性 | 63 レシピ一律 ★2 = 126★（推定）。`ladderReachability.starGate` 再測定 | 要検証 |
| Lunch Rush | プール 25 のまま（opt-out +1） | 前例 |
| ikura（late、OFF）| late step 番号が 56→57（OFF では無影響） | 既知宿題 |

### 4.2 見落としていた過去の保留: Batch 3 の `tsukimi-pizza` 延期（OD-DH4-2-9）— **新たな阻害要因**

`TETO_EXPANSION-BATCH-3_Result.md`（Owner Decision A、2026-10-07）: 「`tsukimi-pizza` + `green-onion` を batch から外した。**OD-DH4-2-9 の「その他」到達条件・文面・プライバシー契約は変更しない。ladder 順を回避のために並べ替えない**」。理由: 「`tsukimi-pizza` は OD-DH4-2-9（`other` 家族に到達不能）に抵触した。egg が reserve で、`other` 家族の almond / pine-nuts を所持していると `attr:*:other` が答えられてしまう」。
- `deductionProduction.gate.test.ts` の「`その他` は到達不能（どの状態でも `:other` の family/group 回答なし）」テストが対象。
- **現在の状況**: `other` の所属は今も egg / almond / pine-nuts（`ingredientTaxonomy.ts`）。`green-onion = herb` は `other` に影響しない。egg が `other` である以上、同じ抵触が再現する可能性が高い。ただし reserve の選ばれ方（レシピの材料・ladder 位置に依存）が当時と変わっている可能性もあり、**本セッションでは判定できていない**。
- 本セッションで main の gate を scratch コピー（リポジトリ外）で実行 → ベースラインは **14 / 14 pass（約 87 秒）**。月見を加えたコピーでの再実行は、環境の権限判定で止まったため**未実施**（再試行していない）。
- 帰結: 月見の実装 PR は最初に DH4 gate（上記テスト + 独立攻撃者テスト）を月見入りで通す必要がある。**通らなければ gate の緩和は不可**（Owner Decision A）。その場合の選択肢は Owner 判断: ① 月見を再度保留 ② egg の family/回答規則に触れる設計変更（OD-DH4-2-9 の改訂 = 別の Owner 決定）③ 月見の構成変更（原典と乖離するため非推奨）。

### 4.3 最終判定: 月見を先行できるか

**判定: 方針（OD-B9-5）どおり step 56 の先行候補とするが、実装開始は「未了の条件 3 つ」が済むまで不可。** 技術的にはデータ追加のみで、新操作・新工程・保存変更はない。

実装開始条件（すべて満たすこと）:

| # | 条件 | 状態 |
|---|---|---|
| S1 | **原典確認 M1〜M3 が済む**（§5）。結果は #527 / #578 に「中継 or 独立再取得」を明記して記録 | **未了**（OD-B9-6） |
| S2 | **DH4 gate の事前検証**（月見入りで §4.2 のテストが通る）。実装前に scratch コピーで先に確認するのが最小コスト | **未了**（過去に抵触した実績あり） |
| S3 | **claim の整理**（§3.3 の A / B / C のいずれか） | 未了（Owner 選択待ち） |
| S4 | Owner の「着手 GO」 | 未了 |

S1 の結果による分岐:

| 原典の結果 | 扱い |
|---|---|
| 青ねぎ・卵とも焼成前（または焼成後の記載なし） | 通常カタログ、step 56（上表）。S2 を通す |
| 青ねぎが焼成後 | **後乗せカタログ**（`LATE_*` 表、本番 OFF、E5 まで本番に出ない）。`green-onion` は late ingredient。**通常 step 56 は空く**（次の通常 batch が使える）。Anti-Oracle / riddle の追加検証（#638 §3） |
| 卵が焼成後 | 想定外（卵は焼成前に火を通すのが通例）。Owner に差し戻し |

## 5. 月見の実装開始に必要な原典確認事項（最小）

対象ページ: **`https://pizzadb.jp/compare/world-pizzas/page/14/`**（比較表、「月見ピザ」行。repo の証跡 `tsukimi-pizza-pizzadb-p14` の唯一の出典 URL、中継 2026-09-22）。個別ページの URL は repo の証跡に無い（推測で書かない）。個別ページがある場合は、その URL を Owner が記録する。
間接証跡（同じ「青ねぎ」を使う兄弟ページ。**月見の根拠にはならない**が、使い方の傾向を知る手がかり）: `https://pizzadb.jp/pizzas/unagi-pizza/`、`/pizzas/kimchi-pizza/`、`/pizzas/natto-pizza/`、`/pizzas/peking-duck/`、`/pizzas/sichuan-eggplant/`。

| # | 確認事項 | 開始に必須か |
|---|---|---|
| **M1** | **青ねぎの投入タイミング**（焼成前 / 焼成後の仕上げ） | **必須**（分岐を決める） |
| **M2** | **卵の扱い**（焼成前に載せるか、後か。生卵か） | **必須** |
| **M3** | **材料の一致**（卵 / ベーコン / モッツァレラ / 青ねぎ の 4 つで過不足がないか。ソース欄「チーズ」のままか） | **必須** |
| M4 | 個数・焼成条件 | 不要（暫定値のまま。OD-B9-4） |
| M5 | ねぎの種類（青ねぎ / 小ねぎ / 長ねぎ） | 不要（OD-B9-3 の描画は小口切りで確定済み。表示名「青ねぎ」は証跡の表記） |

pizzadb.jp は本セッション環境から到達不可（`CONNECT tunnel failed, response 403`、#527 と同じ）。確認の経路: Owner が実ページの該当箇所を #527 / #578 に貼る、または環境の Network access に `pizzadb.jp` を追加して別セッションで読み取り専用に取得（設定はユーザー側。`read_documentation environment.network`）。**いずれも未実施。**

## 6. 柚子えび（保留）— 実装分岐（再掲、OD-B9-1）

実装は原典確認まで行わない。確認項目は `https://pizzadb.jp/pizzas/yuzu-shrimp/`（証跡の出典 URL）の ①材料の最終一致 ②大葉・柚子胡椒・エビの投入タイミング ③柚子胡椒の色（赤はトマト `#c73b2e` と同色で不可）④個数 ⑤焼成条件。分岐: **B0 すべて焼成前** → 通常 ladder（月見の次の空き step = **57**）、**B1 大葉のみ焼成後** → 後乗せカタログ（通常 step を使わず E5 待ち。後乗せカタログに sauce を置く前例が無く要事前確認）、**B2 柚子胡椒も焼成後** → 実装不可（ソース後乗せは #579 / #518 が前提）。ladder 番号は月見が 56 を取るため、**柚子は 56 を持たない**。月見が後乗せ分岐になった場合のみ 56 が空く。

## 7. 残る Owner 判断

1. #578 claim の引き継ぎ方法（§3.3 の A / B / C）。
2. 原典 M1〜M3 の確認（Owner の貼り付け or `pizzadb.jp` の許可）。
3. DH4 事前検証（S2）の実施可否。**抵触した場合の方針**（§4.2 の ①②③）は結果が出てから。
4. 着手 GO（S1〜S3 が揃った後）。

## 8. 範囲外

ゲームコード、テスト、e2e、workflow、CI の再実行、他セッションのブランチ、`PROJECT_HANDOFF.md`（HOT）、claim の投稿・解除、pizzadb.jp の再取得、merge、デプロイ。
