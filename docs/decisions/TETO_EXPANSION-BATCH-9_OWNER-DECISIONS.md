# Next Batch (working name Batch 9: 月見 先行 / 柚子えび 保留) — Owner Decisions と着手条件

Status: **決定の記録と着手条件の整理のみ（docs-only）。** ゲームコード・テスト・データ・workflow・共有 Preview・本番は変更していない。レシピ実装 PR は未作成。
**更新（第 2 版）**: ①**月見は DH4 gate の抵触が実測で確認され、実装保留**（§4.2）。②**#578 の Phase A claim は Owner 承認の代理 release を投稿済み**（§3.4）。③次の実装候補は `docs/reports/TETO_RECIPE-EXPANSION_NEXT-CANDIDATES-3_Reselection.md`。
基準 `origin/main` = `485c515`（#647。#645 Pinsa docs・#646/#647 CI/test のみで、レシピ・ladder・golden は動いていない）、2026-10-23。`CLAUDE.md` は変更なし。
前提: `docs/reports/TETO_RECIPE-EXPANSION_NEXT-BATCH-2_Fresh-Audit.md`、`docs/reports/TETO_RECIPE-EXPANSION_YUZU-TSUKIMI_Pre-Implementation-Audit.md`。形式は `TETO_EXPANSION-BATCH-8_OWNER-DECISIONS.md` に倣う。
**「決定済み」は Owner が指示した内容だけ。** それ以外は「提案」「未決」と明記する。

## 1. 決定済み（Owner、2026-10-23）

| ID | 決定 |
|---|---|
| OD-B9-1 | 柚子えびは**原典確認まで保留**（焼成前 / 後の分岐も確認待ち） |
| OD-B9-2 | 柚子胡椒（`yuzu-kosho`）はソースとして仮分類、色 `#b5c56a` を仮採用（実機 HV で確定）。**柚子えびの保留中は実装しない** |
| OD-B9-3 | `green-onion`: family = `herb`（L1 のみ）、`pieceVisual` = 小口切りの輪、size class = `xs`（維持） |
| OD-B9-4 | 個数・焼成窓は暫定値のまま（GAMEPLAY CALIBRATION） |
| **OD-B9-5（改訂）** | **J1: 月見を通常 ladder の次の step 56 として先行する。** 旧案「柚子 56 → 月見 57」は**撤回**（柚子は保留で step を持たない）。**→ OD-B9-8 / 9 により月見は実装保留、step 56 は予約しない** |
| **OD-B9-6（新）** | **J2: 青ねぎ・卵の投入タイミングは原典確認まで未確定。本番を有効化する実装はまだ許可しない**（通常カタログへの追加は merge = 有効化なので、確認前は実装 PR を作らない） |
| **OD-B9-7（新）** | **#578 の有効な claim は無断で解除しない**（→ OD-B9-10 で代理 release 方式 A を承認） |
| **OD-B9-8（新）** | **月見は DH4 gate の問題が解決するまで実装保留。OD-DH4-2-9 の gate 緩和は禁止** |
| **OD-B9-9（新）** | DH4 の月見入り事前検証を承認（権限エラーが続く場合は再試行せず停止）。**月見の step 56 は予約しない** |
| **OD-B9-10（新）** | #578 claim は **Owner 承認の代理 release（方式 A）**。投稿に「元セッション本人の解除ではない」「#634 は merge 済み」「Owner 承認による引き継ぎ」を明記 |
| **OD-B9-11（新）** | 原典確認は **Owner からのページ内容共有を優先**。未確認事項は推測で埋めない。柚子えびは原典確認まで保留を継続 |
| **OD-B9-12（新）** | 月見は**保留継続（恒久見送りにはしない）**。OD-DH4-2-9 は**改訂しない**、`other` family は**再分類しない**。次の追加候補は**四川風ナス**。四川風ナスを含む DH4 事前検証を**1 回だけ**承認（実施済み）。**原典未確認のまま実装 PR は作らない**。step 56 は予約しない |
| **OD-B9-13（新）** | 四川風ナスは**条件付き GO、ただし原典 Q1〜Q4 の確認まで実装 HOLD**。確認までは**新規 claim・実装 PR・ladder 登録を行わない** |
| **OD-B9-14（新）** | DH4 production gate **14/14 PASS を正式記録**（四川風ナス追加の scratch 検証、main `485c515`）。hardened guard の**漏えいゼロは絶対条件**として維持 |
| **OD-B9-15（新）** | `deductionGuard.gate` の旧ガード件数ピン 156→123 は、**実装 PR で原因を確認したうえで再測定・更新してよい。単純な数値置換だけで済ませない**（§5.6） |
| **OD-B9-16（新）** | 原典で**焼成後投入・炒める工程**が確認された場合は、**通常 ladder に入れず、新工程対応の候補として再分類**する（§5.6）。月見は HOLD 継続、DH4 の緩和・食材 family の変更はしない |
| **OD-B9-17（新）** | **原典確認待ちで準備を止めない。暫定仕様（青ねぎ = 焼成前 / 豆板醤 = ソース塗布 / ナス = 事前調理なし）で実装前監査を行う。** これは**仮定**であり、原典 Q1〜Q4 の確認結果は確定情報にしない。OD-B9-13〜16 は維持（新規 claim・実装 PR・ladder 登録は引き続き行わない）。監査結果: `docs/reports/TETO_RECIPE-EXPANSION_SICHUAN-EGGPLANT_Provisional-Spec-Audit.md`（既存工程だけで実装可能、件数ピンは実装 PR で 4 構成の測定により原因確認） |

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

### 3.3 既存担当者との重複を避けた引き継ぎ手順（選択肢。**Owner は A を採用**、§3.4 で実施済み）

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

### 3.4 実施結果: 代理 release（方式 A、2026-10-23）

| 項目 | 結果 |
|---|---|
| 投稿 | #578 に代理 release を投稿: https://github.com/perusonao/teto-pizza-game/issues/578#issuecomment-6373041313 。`teto-claim:v1` の `released: true`（session `015Uh6…` / issue 578 / pr 634 / files []） |
| 明記した事項 | ①元セッション本人による release ではない ②#634 は merge 済み（`12aaa8e`、flammkuchen = No.62・step 55）③Owner 承認による引き継ぎ（#527 の 2026-10-22 の前例と同形式）④稼働を直接確認できたわけではないという限界 |
| 投稿前の重複確認（読み取りのみ） | 元セッション `IDLE`・接続なし・最終更新 03:33Z（以後の活動なし）／#578 に claim 後の新コメントなし／open PR にレシピ・新ソース・新トッピングを扱うものなし／main の直近差分は docs・CI・test のみ。#577 の claim（`01QxGE…`・`01WXBP…`）は dough / late / DexOverlay 範囲で、別 issue・別ファイル（`discoveryCatalog.ts` は #640 と将来の月見・新レシピ PR で同一ファイルになり得る点だけ既知） |
| 新しい実装 claim | **投稿していない**（実装保留中。着手する担当が §3.3 の雛形で別途投稿） |

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
- **実測（Owner 承認の事前検証、2026-10-23、1 回）**: main `485c515` の scratch コピー（リポジトリ外・使い捨て、削除済み）に月見（bacon 3 / egg 1 / mozzarella 2 / green-onion 2、NO_SAUCE、`green-onion` = herb・`xs`、ladder 末尾）を加えて `deductionProduction.gate.test.ts` を実行。ベースライン（月見なし）は 14 / 14 pass。**月見入りは 13 / 14 pass、1 件 fail**:
  - fail: 「`その他` (provisional copy, OD-DH4-2-9) is unreachable: no family/group 'other' answer in any state」
  - 実際の値: `expected 'attr:group:other' not to match /:other$/`（`attr:group:other` が答えられた）
  - 他の 13 件（独立攻撃者テスト・Technique 非漏えい・fail-closed 等）は pass。
  - 解釈: 月見以外の変更が無いので、抵触は月見の追加に由来する。`other` 家族は egg / almond / pine-nuts のまま（`green-onion = herb` は無関係）。**どの状態・どの reserve で起きるかの特定は未実施**（事前検証は 1 回のみの承認のため、掘り下げの再実行はしていない）。
  - 検証の限界: 全体の Vitest・ladder 導出・tsc は未実行（DH4 gate のみ）。
- 帰結（**確定**）: 月見は OD-DH4-2-9 に抵触する。Owner Decision A（gate 緩和禁止）と OD-B9-8 により、**月見は実装保留**。
- （以下は当初の整理。上の実測で①が採用された状態） 月見の実装 PR は最初に DH4 gate（上記テスト + 独立攻撃者テスト）を月見入りで通す必要がある。**通らなければ gate の緩和は不可**（Owner Decision A）。その場合の選択肢は Owner 判断: ① 月見を再度保留 ② egg の family/回答規則に触れる設計変更（OD-DH4-2-9 の改訂 = 別の Owner 決定）③ 月見の構成変更（原典と乖離するため非推奨）。

### 4.3 最終判定: 月見を先行できるか

**判定（第 2 版）: 月見は実装保留。** DH4 gate の抵触が実測で確認された（§4.2）。step 56 は**予約しない**（OD-B9-9）。以下の S1〜S4 は、保留解除の条件として残す。

実装開始条件（すべて満たすこと）:

| # | 条件 | 状態 |
|---|---|---|
| S1 | **原典確認 M1〜M3 が済む**（§5）。結果は #527 / #578 に「中継 or 独立再取得」を明記して記録 | **未了**（OD-B9-6） |
| S2 | **DH4 gate の事前検証**（月見入りで §4.2 のテストが通る） | **実施済み・不合格**（13/14、`attr:group:other`）。解決策が Owner 決定されるまで保留 |
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

## 5.4 四川風ナスの DH4 事前検証（実施済み）

結果は `docs/reports/TETO_RECIPE-EXPANSION_SICHUAN-EGGPLANT_DH4-Preflight.md`: DH4 production gate **14/14 pass**（OD-DH4-2-9 を含む。OD-B9-14 で正式記録）、deduction guard 関連 7 ファイルで 113/114（`deductionGuard.gate` の旧ガード漏えい件数ピン 156 → 123 の 1 件のみ。hardened ガードの漏えいは 0 のまま）。実装可否・原典確認 Q1〜Q6・Owner 判断はそのレポート §5〜6。

## 5.6 四川風ナス: 原典確認後の判定手順と実装 PR での条件

追加の CI・scratch gate・コード変更・Preview 操作は行わない。**原典（Q1〜Q4。ページ内容は Owner が共有）が未提供のため、「既存工程だけで可能か / 新工程が要るか」の判定は未実施。** 判定表（確認後に埋める）:

| 原典の結果 | 判定 | 扱い |
|---|---|---|
| Q1 青ねぎが焼成前（または仕上げの記載なし）かつ Q2 豆板醤を生地に塗る かつ Q3 ナスを生で載せる／事前調理の記載なし かつ Q4 材料一致 | **既存工程だけで可能** | 通常 ladder（2 材料 1 step）。実装 PR の条件は下記 |
| Q1 青ねぎが**焼成後** | **後乗せ（FINISH / late catalog）が必要** | 通常 ladder に入れない。新工程対応の候補として再分類（E5 待ち、`green-onion` は late ingredient。OD-B9-3 の仕様は維持） |
| Q2 豆板醤を**炒める**（具と合わせて加熱） | **下ごしらえ（`PREP_STEP`）が必要** | 通常 ladder に入れない。再分類（新工程 Epic） |
| Q3 ナスを事前に焼く・揚げる・炒める | 同上（下ごしらえ） | 同上 |
| Q4 材料に過不足 | 識別集合が変わる | 衝突・Research・ladder・DH4 を再検証してから再判定 |
| 豆板醤が焼成後にかけるソース | ソース後乗せ（#579 / #518 前提） | 実装不可。再分類 |

**実装 PR での `deductionGuard.gate` 件数ピン（OD-B9-15）**: 原因確認を必須とする。最低限、(a) 実装と同じデータで 156→新値を再測定し、(b) `green-onion`（topping）と `doubanjiang`（sauce）のどちらが件数を動かすかを**分離して**確認（追加なし / topping のみ / sauce のみ / 両方）、(c) 合成 family が本番 TOPPINGS から切り出される仕様（テスト内コメント）と一致する説明を PR 本文に書く、(d) hardened の `expect(leakPriors(HARDENED, …)).toEqual([])` が全状態で通ることを同じ run で確認、(e) 他の gate 定数を変更しない。これらを満たさない単純置換は不可。

## 5.5 月見の保留解除に要るもの

gate の緩和は禁止なので、解除には次のいずれかが要る（**Owner 判断。推奨はしない**）: ①月見の恒久見送り ②OD-DH4-2-9 自体の改訂（別の Owner 決定。DH4 の設計文書と gate の再設計を伴う）③`other` 家族の再分類（egg / nuts の family 変更。Hint 5.0 の golden と family 規則に波及）。OD-B9-12 により OD-DH4-2-9 の改訂・`other` 再分類は行わない方針のため、解除条件は別途検討（月見は保留継続）。`green-onion` の仕様（OD-B9-3）は維持し、**四川風ナス**（OD-B9-12）で先に導入する。

## 6. 柚子えび（保留）— 実装分岐（再掲、OD-B9-1）

実装は原典確認まで行わない。確認項目は `https://pizzadb.jp/pizzas/yuzu-shrimp/`（証跡の出典 URL）の ①材料の最終一致 ②大葉・柚子胡椒・エビの投入タイミング ③柚子胡椒の色（赤はトマト `#c73b2e` と同色で不可）④個数 ⑤焼成条件。分岐: **B0 すべて焼成前** → 通常 ladder（月見の次の空き step = **57**）、**B1 大葉のみ焼成後** → 後乗せカタログ（通常 step を使わず E5 待ち。後乗せカタログに sauce を置く前例が無く要事前確認）、**B2 柚子胡椒も焼成後** → 実装不可（ソース後乗せは #579 / #518 が前提）。ladder 番号は月見が 56 を取るため、**柚子は 56 を持たない**。月見が後乗せ分岐になった場合のみ 56 が空く。

## 7. 残る Owner 判断

1. 月見の扱い（§5.5: 恒久見送り / OD-DH4-2-9 改訂 / family 再分類）。
2. 次の実装候補の選定（再選定レポートの §5）。
3. 原典（Owner からのページ内容共有）。柚子えびは確認まで保留。
4. 新しい実装 claim の投稿と着手 GO。

## 8. 範囲外

ゲームコード、テスト、e2e、workflow、CI の再実行、他セッションのブランチ、`PROJECT_HANDOFF.md`（HOT）、新しい実装 claim の投稿、pizzadb.jp の再取得、merge、デプロイ。
