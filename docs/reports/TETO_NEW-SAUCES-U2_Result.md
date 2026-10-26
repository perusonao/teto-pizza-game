# New Sauces Phase B U2 — ナス田楽ピザ + 味噌だれ + 白ごま（late catalog 方式）Result Report

Issue #578（claim 投稿済み: https://github.com/perusonao/teto-pizza-game/issues/578#issuecomment-6398692780）。ブランチ `claude/u2-eggplant-dengaku-late`、基準 `main` `a540983`。**未 merge・共有 Preview 未更新・本番変更なし。** merge は late catalog が本番 ON のため**即公開**になる。Owner の iPhone 実機 HV と最終承認までは merge しない。
Authority: Owner 承認（2026-10-25）「U2 Final Design Gate」。U3（なすタヒニ、タヒニ・ザクロ）には触れていない。

## 1. 何を出したか

| 項目 | 値 |
|---|---|
| レシピ | `eggplant-dengaku-pizza`（ナス田楽ピザ）、late catalog、全体 67 番目（Pinsa の前）、第 4 章の 31 件目 |
| 構成（**GAMEPLAY ASSUMPTION**、原典未確認） | 味噌だれ 1（焼成前 PAINT）/ モッツァレラ 2（通常 CHEESE）/ ナス 3（焼成前・事前加熱なし）/ 白ごま 1（**焼成後 FINISH、POST_BAKE**） |
| 焼成窓・CUT | 58–78（Free Cooking の汎用窓と同じ）/ CUT なし |
| 新素材 | `miso-sauce`（味噌だれ）: late 専用のソース（`category:"sauce"`, `placement:"spread"`）、色 `#9a5b2e`（**暫定**）。`white-sesame`（白ごま）: late 専用のトッピング（`scatter`）、色 `#f4efe0`（**暫定**）、family `spice`、size class `xs`、**粒状の専用描画 `sesame-seeds`**（葉の `LIGHT_LEAF` や輪の描画は流用しない）。emoji はトレイ／ショップのチップ用の代替のみで、既存と重複しない（🍯 / 🍚） |
| ladder | late step（yuzu の次）に 2 材料。番号は**導出**（通常 step 数 + 3、現在 59）で固定値は埋め込んでいない。星ゲートなし、credited、key-free。Research コホートの鍵は `white-sesame` |
| 価格・補充 | T4 規則。味噌だれ 初回 120 Pitz = 10 回分、補充 60。白ごま 初回 120 Pitz = 10 個分、補充 60 |
| 互換下限 | `LATE_ENTITLEMENT_FLOORS` に `miso-sauce: 59` / `white-sesame: 59` を追加。`salmon-roe: 57` / `yuzu-kosho: 58` は**不変** |
| 表への追加 | `lateCatalog.ts`（レシピ・注文・探索ターゲット `eggplant-dengaku-pizza-pizzadb-p6`・材料・taxonomy 行・size class・ladder step・floors）、`recipeSauceProfiles`（union + PAINT 行）、`recipeHintRoles`（key-free）、`referencePizza`（6 ピース: モッツァレラ 2 / ナス 3 / 白ごま 1、白ごまは `HEAVY_SQUASH`）、`ingredients.ts`（型に `sesame-seeds`）、`IngredientGlyph.tsx`（`SesameSeeds`）、`App.css`（既存の 1.2em 補正グループにセレクタ 1 件追記） |
| 触れていないもの | 採点・経済・保存形式（schema v2）・既存の entitlement floor 値・エンジン（reducer / FINISH / ladder 純粋層）・DH4 gate の assertion・Pinsa・U3・`PINSA_PRODUCTION` |

**エンジンのコード変更はない**（データ表の追記、描画 1 件、テストの pin 更新、テスト支援の拡張 2 件、E2E ヘルパーのページ送り上限）。

## 2. 原典で確認できた事実と、GAMEPLAY ASSUMPTION の区別

- **原典（pizzadb.jp）は本セッションから到達できず、個別ページは未確認。** DNS 解決不可・プロキシ `CONNECT 403`。取得を偽っていない。
- **確認できた事実（repo 内の中継証跡、独立再取得なし。比較表 p6、2026-09-22）**: 薄めの生地、材料 4 種（ナス / 味噌だれ / モッツァレラ / 白ごま）、ソース欄「甘辛だれ」。
- **未確認（ゲーム独自の仮定で補完。コード・PR 本文・Result に明記）**: 味噌だれの使い方（→ 焼成前 PAINT）、ナスの事前加熱（→ なし）、白ごまを加える時期（→ 焼成後 FINISH）、個数、焼成窓。
- **GAMEPLAY CALIBRATION**: 個数（味噌だれ 1 / モッツァレラ 2 / ナス 3 / 白ごま 1）、焼成窓 58–78、色 2 件、モッツァレラは標準チーズ層。
- 説明文は時機を名指ししない（図鑑未発見の状態で表示されるため、Anti-Oracle）。

## 3. 既存セーブ・Dex・Research・ladder への影響（検証済みの範囲）

| 観点 | 結果 |
|---|---|
| 既存セーブの解禁 | 台帳は縮まない。floors は 57 / 58 / 59 / 59。E5 後に未起動で count ≥ 59 のセーブは、通常 step が 0〜3 件増えた後でも 4 材料すべてを得る。count 58 は roe + yuzu のみ、57 は roe のみ、56 は 0 件（`materialEntitlement.lateFloor.test.ts`）。2 回目の resolve は何も通知せず台帳を参照のまま返す。台帳の未知 ID も保持 |
| Dex / 保存 | Dex 項目・未知 ID は保持。schema v2 のまま。**通常 ladder は変更していない** |
| 図鑑の章 | 第 4 章 31→32（Pinsa ON。導出表示）。章クリアの印は後退しない（late recipe は印に不要、`recipeChapters.test.ts` K2） |
| Research | 田楽のコホートは単独（文字なし）。既存レシピの文字は動かない（`lateCatalog.dengaku.test.ts` で全体の文字写像を前後比較、manifest 検証） |
| ladder / ★ | 1–56 凍結、roe 57 / yuzu 58 の step 番号は不変。クレジット対象 61→62。★ゲート値は不変 |
| ヒント | 永久 key-free。Hint 5.0 golden は**追記のみ**（`hint5.ladders55.json` +203 / −0、`hint5.alphaFamilyOnly.json` +1 キー） |
| 在庫・経済 | T4 規則。Pitz・採点は不変 |
| Lunch Rush / Dinner | FINISH 除外のため対象外（`lunchRush:false`） |
| トレイ | 食材 73 種でトレイは 10 ページになった（ソースは 2 ページ目に味噌だれ）。E2E のページ送りヘルパー上限を 8→16 に拡張 |

## 4. DH4 / privacy（gate は緩和していない）

- **family = `spice`（Owner 決定）。** privacy 系 gate（`deductionProduction.gate` 14 件）と hardened guard は全件通過。
- 測定した family 比較（同一ツリー、両材料 + レシピ。`deductionGuard.gate` の旧件数 pin のみが動く）: `spice` **165** / `herb` 156 / `vegetable` 156 / `other` は privacy gate 違反（`attr:group:other` に到達。選ばない）。基準 123。
- **件数 pin の原因分解（OD-B9-15、テスト内コメントにも記録）**: 追加なし 123 → `miso-sauce` のみ 131（+8: `zeroTopping` が全ソースを走査） → `white-sesame`（spice）のみ 180（+57: 合成 family は TOPPINGS を配列添字で切るため topping 1 件で再編） → 両材料 188（加法的） → 両材料 + 田楽レシピ **165**（−23: 仮説の母集団の公開カタログが 1 レシピ増える）。pin 123 → 165 の 1 箇所のみ更新。hardened の `toEqual([])` は全構成で成立。
- **Hint 5.0 の単独メンバー family 検証は削除していない**: `spice` に白ごまが入り、実カタログでは単独メンバー family が 0 になった（以前は `["capers"]`）。実カタログの単独 family を導出して全件の分類を確認する形に直し、さらに**合成カタログ**（ingredientTaxonomy を差し替え、spice = capers のみの旧形）で P1/P2 の性質（単独 family でも分類として表示される）を維持する新規テストを追加した。
- **許可リストへの追記（Owner 承認済み、privacy assertion は不変）**: 技法要求レシピの許可リスト `LATE_ADDITION_RECIPE_IDS`（`src/logic/testSupport/techniqueAllowlists.ts`）に `eggplant-dengaku-pizza` を追加。
- DH4 監査 JSON（`TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json`）は件数の導出差（category 候補 +1、aroma グループ候補 +1）のみで意味の変更はない。

## 5. pin の更新（assertion は弱めていない）

件数・exact-set の期待値を実データに合わせて更新した: `catalogLedger`（recipes 68 / credited 62 / ingredients 73 / toppings 55 / ladder 59 / chapter 4 = 32、sauce 6→7、spice 1→2）、`catalogShelf` / `largeCatalogFixtures`（sauce 7）、`lateCatalog.*` / `pinsa.production` / `e5.ikuraProduction` / `lateAxis` / `recipeChapters` / `materialShop`（offers に 2 行、`nextMaterialHint`）/ `referencePizza.test`（sauce 集合）/ `hint5Ladder.baseCompat`（key-free 41→42、sauce + cheese 17）/ `techniqueAllowlists.test` / `IngredientGlyph.test`（dedicated 一覧に追加）、golden 3 件。`recipeBatchManifest` に `EGGPLANT_DENGAKU_BATCH` を追加し、yuzu の `followedBy` と Pinsa の `afterRecipeId` を更新。バッチ validator は「後続バッチ自身の late step」を凍結接頭辞の判定から除外するよう拡張した（後続の late step を持つバッチを許すだけで、他の検査は不変。既存の validator の mutation テスト群は通過）。`e2e/new-sauces-u1.spec.ts` は「最後の step」を前提にしていた箇所を ladder から導出に直した。

## 6. 検証

| 項目 | 結果 |
|---|---|
| 新規テスト | `lateCatalog.dengaku.test.ts`（OFF で無痕跡、データ・表・identity の一意性、色・family・size class・emoji、Shop T4、Research、manifest、**実 reducer の Free Cooking**: NEW_DISCOVERY / 後乗せ記録 / 白ごまを焼成前・味噌だれなし・FINISH 空・ナス/モッツァレラ欠落は ORIGINAL、Guided 再生）、`materialEntitlement.lateFloor.test.ts` に 59 の保存互換 4 グループ、`IngredientGlyph.test.tsx` に白ごま描画、`hint5Production.gate.test.ts` に合成カタログの P1/P2 |
| フル Vitest | **527 files passed / 1 skipped、9,739 tests passed、13 skipped、4 todo、0 failed**（最終コード、実 git リポジトリ上） |
| 型・lint・build | `tsc -b` 通過、`oxlint` エラーなし（既存 warning のみ）、`npm run build` 通過。CI の `build` が最終 |
| E2E（Chromium 全体、iphone-390x844、本 PR の変更後） | 522 passed / 96 skipped / 4 failed。失敗 4 件は本 PR 無関係: `expansion-batch7a` / `8a` は console の `404`（サンドボックスの外部アセット、`new-sauces-a` / `u1` も同じ）、`discovery-hint-sheet` / `dough-size-status-474` は 30 秒タイムアウトで、**無変更の `main` a540983 でも同一に失敗**（確認済み） |
| E2E（本 PR の新規 `e2e/new-sauces-u2.spec.ts`、390×844 / 360×800） | 2 本 × 2 viewport。①Shop NEW（味噌だれ・白ごま）→ 購入 → Research（識別漏れなし）→ 味噌だれを塗る → CHEESE → ナス → 焼成 → **FINISH で白ごま** → NEW DISCOVERY → 図鑑（章 4 満了・schema v2）、②未起動の旧セーブが 4 材料を NEW で得て保存を書き換えない。②は通過。①は末尾の `console.error` 空判定のみが sandbox の 404 で失敗（他の既存 spec と同じ。本編の全アサートは通過） |
| WebKit | サンドボックスに無く未実行（CI のみ） |

## 7. Human Verification（`TETO_HUMAN-VERIFICATION-POLICY.md`）

- スクリーンショット（committed）: `docs/reports/screenshots/new-sauces-u2/`（390×844 と 360×800 各 9 枚: Shop NEW / Research エントリ / トレイ（ソース選択）/ ソース塗布後 / 具材後 / FINISH / FINISH 白ごま / NEW RECIPE / 図鑑）。新規レシピ・新材料のため before は無い。
- 動画（**repository に commit しない**。セッション内で Owner へ直接提出）: `dengaku-u2-390x844.webm`（390×844、WebM）。**注記**: この動画は sandbox の console 404 のみ末尾で失敗するローカル実行の録画で、操作自体は最後まで完走している。
- **この動画・実機で確認すること**: ①味噌だれの茶色（`#9a5b2e`）が生地・既存ソース（トマト ΔE 33、豆板醤 ΔE 22、ジェノベーゼ・オリーブ油・フロマージュブラン）と見分けられるか、塗布の薄塗り／重ね塗りの見え方、②**FINISH で置いた白ごま**が焼き上がりの生地の上で見えるか（`xs` サイズのため、1 個では小さい。下のリスク参照）、③ナスの置き方、④トレイが 10 ページになったときの操作性（ソースは 2 ページ目）。
- **Owner の実機（iPhone Safari）HV は未実施**。

### Owner HV の手順（最短）
1. 承認のうえ、U1 と同じ隔離 Artifact（本ブランチのビルド、別 origin、本番・共有 Preview・Firebase に非接続）を準備する（Artifact の公開は Owner の事前承認が必要。本セッションは実施していない）。または Preview 用ワークフローで共有 Preview へデプロイ（承認が必要）。
2. 既存の Pinsa 用セーブ A（count ≥ 59、roe・yuzu 済み）を読み込む。ショップで味噌だれと白ごまを購入。
3. 図鑑 → Research から研究、または Free Cooking。味噌だれを塗る → チーズ 2 → ナス 3 → 焼く → 仕上げで白ごま 1 → 完成 → NEW DISCOVERY → 図鑑。

## 8. リスクと注意

1. **merge = 即公開**: late catalog は本番 ON。公開ゲートは新設していない。HV 前の merge は禁止。
2. **原典が未確認**: 味噌だれを焼成後にかける・ナスを焼く／揚げる・白ごまを焼成前に載せる、が後から確認された場合、構成の再分類（ソース後乗せ／下ごしらえ工程／通常 ladder への移行）が必要。通常 ladder への移行は late step の導出番号が変わり、floors の再検討を伴う。
3. **白ごまの視認性**: `xs`（スケール 0.7）の 1 個は焼き上がりの生地の上で小さい（HV で確認）。`s` への変更やピース数の増加は Owner 判断。
4. **色**: `#9a5b2e` は生地の焼き色・豆板醤に近づく可能性。実機で確認する。
5. **トレイの長さ**: 材料 73 種でトレイが 10 ページ。新しい late 材料は末尾のため到達に時間がかかる（既存の傾向）。
6. **重なる open PR**: #665（`lateCatalog.ts` の yuzu-kosho の `color` 1 行、`lateCatalog.yuzu.test.ts`）、#667（`ingredients.ts` / `IngredientGlyph.tsx(.test)` / `App.css` / `lateCatalog.offGolden`）。いずれも別ハンク／追記で、後から merge する側が追従する。本 PR は他 PR の変更を取り込んでいない。
7. late step 番号は通常 batch のたびに +1 される（導出）。floors 57 / 58 / 59 で既存セーブは保護される。
8. 田楽は late のため、Late Catalog を OFF にすると消える（OFF ビルドで痕跡がないことをテスト済み）。

## 9. Owner 判断事項

1. 実機 HV（色・塗布・白ごまの視認性・FINISH の操作）と最終承認。HV 後に merge。
2. Artifact / 共有 Preview の承認（HV 用）。
3. 暫定値（個数・焼成窓・色 2 件・白ごまの size class）の確定、または原典確認後の再設計。
4. #665 / #667 との merge 順序。
5. U3（なすタヒニ）: late step 60、floors は 60 を予定。タヒニの役割（塗る / かける）は未決。
