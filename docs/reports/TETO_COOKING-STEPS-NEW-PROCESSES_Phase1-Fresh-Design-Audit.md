# 新しい調理工程 Phase 1 Fresh Design Audit — POST_BAKE / MULTI_SAUCE / ZONED（docs-only）

作成: 2026-10-22 / 基準 `main` `83f4b55`（#618 merge 後）/ ブランチ `claude/teto-pizza-cooking-audit-5qb1ol`
性質: **調査・設計のみ。** `src/**`・`e2e/**`・CSS・データ・テストは変更していない。共有 Preview の更新、merge、本番 FINISH 有効化はしていない。
Issue は新規作成していない（§9）。HV 動画は audit-only のため対象外（`PROJECT_HANDOFF.md` の「Audit-only tasks are exempt」）。
この文書の「推奨」は助言であり Owner Decision ではない。未決は §10 に列挙し、推測で確定していない。

## 0. 要約（先に結論）

1. **3 工程は成熟度がまったく違う。** 「新しい工程」として白紙から設計するのは ZONED だけ。
   - **POST_BAKE**: engine・画面・Free/Research UI・保存の原子性（R8）まで main にあり、本番 OFF。残りは**データ（E4b）と有効化（E5）**。すでに #615 / #611 / #584 が動いている。
   - **MULTI_SAUCE**: 「焼成前に 2 種を塗る」は engine 完成済み、実在レシピ 0。残りはレシピ追加（グランマ等）で、Square Dough 待ち。「**仕上げソース**」は POST_BAKE のソース対応（#579）で、別物。
   - **ZONED**: 証跡の必須 1 行＋候補 2 行。識別・採点・Reference の 3 点が円 8 スロット前提で、presence-only 識別の例外になる。
2. **Phase 1 で最初に進める工程は POST_BAKE（topping のみ）を推奨。** 新しい設計を足すのではなく、既存の FIN-E4b → E5 の線を Owner 判断で通す。これが最も対象が多く（13 行）、すでに土台があり、価値（焼成後に載せる体験）が最も直接的。
3. **#584 のイクラサーモンは POST_BAKE の代表例として妥当で、むしろ BBQ チキンより証跡が強い**（§5）。ただし現行の #584（全材料を焼成前）は原典の工程と違うため、**HOLD のまま「#615 の上に後乗せとして作り直す」**のが筋。
4. **ZONED は Phase 1 に入れない。** MULTI_SAUCE の「仕上げソース」は POST_BAKE の有効化後（Phase 2）。
5. Owner 判断は §10 の D-1〜D-8。最優先は「POST_BAKE の最初のレシピを BBQ のままにするか」と「#615 → E4b の順序」。

## 1. 確認範囲（正直な記録）

| 区分 | 読んだもの | 読んでいない／できなかったもの |
|---|---|---|
| 必読 | `CLAUDE.md`、`PROJECT_HANDOFF.md`（先頭・startup checklist）、`SESSION-OPERATIONS_1.0`、`COOKING-STEPS-2.0_AUTHORITY-INDEX`、`COOKING-EXPANSION_FRESH-AUDIT-AND-PLAN`（#575、`c98d957` 時点）、`FIN-E2_LATE-AXIS_DESIGN`、FIN-E3a/E3b/E4a/R8/D2-2c F-3 の Result、`PIZZADB_TIMING-AUDIT_shipped` | `POST-W1_COOKING-STEPS_NEXT-PHASE_DESIGN`、FINISH Pilot 設計、`MULTI-SAUCE-RECIPES_Fresh-Audit/Design-Lock` の本文（#575 §5 と #521 の要約で代替）、`PROJECT_HANDOFF.md` の 1140 行のうち冒頭と末尾以外 |
| main | `83f4b55`（`git fetch` で最新を確認） | — |
| GitHub | #584、#615、#394、#611、#579、#578、#521 の本文、#584 / #611 のコメント、open PR 一覧、claim の検索 | #294 / #604 / #608 / #465 / #617 / #619 の本文とコメント（タイトルと関連 Result で代替）、Owner Gate (dry-run) の実行結果（Actions 未実行） |
| 172 行 | `TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（正）から能力別に集計 | pizzadb.jp の個別ページ（この環境から確認していない。原典の記述はすべて Issue / docs 経由の二次情報） |

**重要: #575 の audit は `c98d957` 時点で、以降に main が大きく進んでいる**（FIN-E3a/E3b/E4a、D2-2c、R8、#585 生地の種類 P2 など）。#575 の「POST_BAKE は画面未接続」は古い。本書の §2 が現状。

## 2. 現状との差分表

凡例: ✅ main にあり　🟡 一部／本番 OFF　❌ 無い

| 観点 | POST_BAKE（焼成後の食材追加） | MULTI_SAUCE（複数ソース／仕上げソース） | ZONED（領域別配置） |
|---|---|---|---|
| **データ構造** | ✅ `applicationPhase: "POST_BAKE"`（要件側、OD-CS-3=A）。ピース側 `stage: "post"`（`gameReducer.ts:1134`）。🟡 レシピ 0 件（本番）。#615 で単一合流点 `lateCatalog.ts`（open） | ✅ 追記式 `sauceDeposits`（B1）、種類別 ledger。🟡 `RecipeSauceProfile.ingredientId` は 3 種の union（新ソースで拡張）。実在の 2 ソース要件レシピ 0 | ❌ zone の概念なし。位置は dough-percent 座標のみ |
| **操作 UI** | 🟡 FINISH タブ（FIN-A〜C、E3b の Free/Research トレイ）。タップ配置。`FREE_COOK_FINISH_PRODUCTION = false`、Preview opt-in のみ | ✅ 既存 SAUCE 工程で順に塗る（新 UI 不要）。❌ 仕上げソースは FINISH が topping 専用（`gameReducer.ts:1078` `category !== "topping"` で拒否）。DRIZZLE は未実装（olive-oil は TODO） | ❌ ガイド・区画 UI なし。人が置くことは可能だがゲームは見ない |
| **食材配置** | 🟡 FINISH は scatter topping のみ。`findOpenSpot` を共有 | ✅ field-based paint（食材配置ではない） | ✅ 自由配置（`PLACE_TOPPING`、ドラッグ）。❌ 区画の概念 |
| **採点** | 🟡 OD-CS-11=A（既存 Pieces/Recipe 成分、配点不変）。`pizzaForFinalEvaluation` で後乗せ要件は post ピースのみで満たす。**#495（後乗せ要件を除いた暫定スコア）は未決** | ✅ 主ソースは量、副ソースは presence（Owner 方針）。仕上げソースは未設計 | ❌ Pieces は円 8 スロット `PIECE_RING_POSITIONS` の Reference と照合。区画 Reference なし |
| **識別（Discovery）** | 🟡 `late` 軸 OBSERVED（FIN-E2、D-1 strict）、`LATE_ADDITION` 技法（仮文言）。UD-G の正式文言は未決 | ✅ `sauceBase` は配列一致で変更不要。Hint 5.0 SAUCE rung は `grandma-pizza` 限定で承認（OD-544-3） | ❌ `zones` 軸は `UNAVAILABLE`（`signature.ts:104`）。presence-only 原則の例外になる |
| **CUT / RESULT** | ✅ CUT 線を後乗せの前面へ（F-3、#597 closed）、焼成フィルターから後乗せを分離（#518 系 F-1〜F-3 closed）。RESULT の 3 状態（raw/perfect/burnt）の見え方は E5 の HV で確認が必要（本書では未確認） | ✅ 描画は run 単位で重ね塗り（B2）。油系のみ特例（`bakeOilHex` 等）が散在 | ❌ 見本（サムネ・Pizza Select・プレイヤー Reference）が区画対応でない。`PanGeometry`（Square Dough）との整合も要 |
| **セーブ復旧** | ✅ R8 pendingRound（#618、merge 済み）: 焼成確定と在庫消費を同一保存、FINISH→CUT の再書込、起動／HOME の settle、冪等。✅ FIN-E4 基盤の「ON で作ったセーブを OFF で開く」ケースは #615 のテスト対象 | ✅ 変更不要（`sauceDeposits` は既存の保存対象） | 🟡 座標は既存保存に載る。zone 判定を保存しない限り schema 影響なし（A 案） |
| **オンボーディング** | ❌ FINISH を初めて見るレシピの導入が未設計。Anti-Oracle 上、なぞかけ・Dex で動作を名指しできない（OD-TQ-5/6）。FINISH タブは後乗せレシピのみ表示（UD-E）で affordance は導出 | ✅ 追加なし（SAUCE 工程の延長）。Hint 5.0 の SAUCE 段が両ソースを示す | ❌ 区画ガイドは識別情報を漏らす（Guided 非表示など出し分け方針が要る） |
| **本番での状態** | OFF（定数 `false`）。`finishD2Inert.test.ts` が見張り | 実在レシピ 0 のため不活性 | 未着手 |

## 3. 工程別の設計検討

### 3.1 POST_BAKE

**できること（確定）**: scatter topping の後乗せ。要件側 `applicationPhase`、ピース側 `stage:"post"`、識別は `late` 軸（strict）、採点は既存成分、焼成失敗時は FINISH スキップ（OD-CS-7=A）、Dinner / Lunch Rush は当面除外（UD-I）。

**できないこと**: ソース・チーズの後乗せ（#579）、焼成途中の追加 mid_bake（納豆・めんたい・フライドポテトの 3 行。別設計）。

**残作業**
1. 後乗せカタログ基盤 #615（open）。OFF の 4 面（recipes / ingredients / ladder / 発見 target）を従来と同一に保つ golden 付き。
2. E4b データ（#611）: 食材・レシピ・ladder・アイコン。Hint 5.0 gate と privacy sweep を後乗せレシピ込みで再実行（FIN-E2 §8 の 6 条件）。
3. E5 有効化: 方式は案 1（ビルド時定数）。既知の限界 — ON カタログの late step 番号が通常 ladder の長さ + k で、通常バッチの追記でずれる（#615 Result §5b）。**ON の間は通常バッチを止めるか、late 用の安定番号を予約するかを E5 の前に決める。**
4. UD-D / F / G、#495、実機 HV（390×844）。

**リスク**
- ladder の追記専用規則と late step の相互作用（上記 3）。
- 識別 strict（D-1）: 有効化後は、既存レシピの食材を焼成後に置くと ORIGINAL になる。プレイヤーに「後に置くと別物」が見えない設計（Anti-Oracle）なので、初見の混乱が予想される。HV で確認する項目。
- リング上限 8 と FINISH ピースの関係は**未実測**（D-6）。
- `sanitizeToppings` が `stage` を落とす（FIN-E2 §2）。`stage` を読む新コードは raw の `pizza.toppings` から読むこと。

### 3.2 MULTI_SAUCE

2 つに分けて扱う。混ぜると依存関係が見えなくなる。

| | (a) 焼成前の複数ソース | (b) 仕上げソース（焼成後） |
|---|---|---|
| 内容 | 土台＋オイル等を SAUCE 工程で順に塗る | はちみつ・マヨ・バッファロー・タヒニ等を焼成後にかける |
| engine | ✅ 完成（B1/B2/S1/S2、ガードテスト） | ❌ FINISH の category 制限、在庫関数 `canPlacePostBakeIngredient`、`sauceIds` との関係、描画、DRIZZLE（新ジェスチャー）が未設計 |
| 追跡 | #521（S3 = グランマ）、#540（Draft HOLD）、#519 | #579（整理のみ）、#476（DRIZZLE は食材別操作の候補） |
| 依存 | Square Dough B・C・D・F、Design Lock §8-1（pizzadb.jp 原典確認、**未完了**）、OD-544-1/2/6/8、F4（#538） | POST_BAKE の E5 → #579 → #476 の Decision Gate |
| 新規 UI | なし | DRIZZLE（Owner 方針: 食材ごとに操作が違うのは許容） |

- (b) に該当する 172 行: 必須 `buffalo-chicken`（buffalo-sauce）・`detroit-style`（tomato-sauce）・`teriyaki-chicken`（mayo + nori）、候補 `hot-honey-pepperoni`（honey）。いずれも `BLOCKED_PRODUCT_DECISION`（`hot-honey` は `READY_WITH_REVIEW`）。
- (a) の 172 行: 必須 17 行（独立した 2 種の土台ソースを示す行は 0。大半は土台＋オイル／はちみつ／マヨ）。READY 6 / READY_WITH_REVIEW 3 / BLOCKED 8。
- 新ソース 4 種（#578）は (a) の延長（焼成前 PAINT）で、MULTI_SAUCE ではなく「ソース追加」。本書の対象外。

### 3.3 ZONED

- 172 行: 必須 1（`quattro-stagioni`、READY）、候補 2（`capricciosa` / `bismarck` の「卵を中央」、`BLOCKED_PRODUCT_DECISION`、repo inference）。**出荷済みとの重なり 0**。最も対象が少ない。
- 案 A（操作は変えず判定だけ追加）が最小だが、(i) zone 分類の閾値、(ii) presence-only 識別の例外、(iii) 区画ごとの Reference と照合する新 Pieces 評価、(iv) サムネ・見本の区画対応、(v) `pizzaReferenceLayout.ts` の 8 スロット byte-identical 方針との両立、を同時に決める必要がある。
- 案 B（区画ガイド）は識別情報の漏れ、案 C（区画ごとの食材選択）はトレイの操作モデル変更で、優先度低。
- 他の工程のどれにも依存されない。**独立しているが、効果が最小で難度は中〜大。**

## 4. 既存レシピとの後方互換性

| 項目 | 結論 | 根拠 |
|---|---|---|
| 本番カタログ | 3 工程とも OFF／不活性の間は既存レシピの識別・採点・在庫・Dex・ladder は不変 | `finishD2Inert`、#615 の golden（OFF の 4 面の SHA-256、main `78a4a0f` で生成）、`RECIPES` に後乗せ要件 0 件 |
| `applicationPhase` を持たないレシピ | `pizzaForFinalEvaluation` は同一オブジェクトを返す（FIN-E4a で固定） | FIN-E4a Result |
| 識別 | strict（D-1）。有効化後、既存レシピの食材を焼成後に置くと ORIGINAL。**これは有効化（E5）で初めて起きる挙動変更** | FIN-E2 §5 D-1 |
| Fingerprint / Notebook | `late` は ext から除外（D-3、fp1 不変、既存 Notebook 有効） | FIN-E2 §3.5 |
| セーブ | `pendingRound` は任意キー、`schemaVersion` 2 のまま。ない場合は従来とバイト同一 | R8 Result §1 |
| MULTI_SAUCE (a) | レシピ追加のみ。reducer・採点・schema 無変更 | #575 §5.4 |
| ZONED | zone 判定を保存しなければ schema 影響なし。ただし presence-only の例外を作る時点で、既存の「位置は identity ではない」前提のテスト・golden が影響を受ける | #575 §6.4 |
| 6 タブ上限 | 後乗せ＋CUT＋SAUCE＋CHEESE＋TOPPING＋DOUGH＋BAKE は 6 を超えうる。`LATE_WITH_CUT` ガード（E1）が有効 | FIN-E2 §2 |

## 5. #584 イクラサーモン — POST_BAKE の代表例としての評価

事実（#584 本文・コメント、172 マトリクス、#614）
- 現行 #584: `ikura-salmon-pizza` を**全材料焼成前**で実装。構成 cream-cheese 2 / salmon 3 / shiso 1 / salmon-roe 2（暫定）、NO_SAUCE、CUT なし、ladder step 55、専用 SVG `salmon-roe-grains`。Codex は最新 HEAD `e2ac301` で指摘なし。**Owner 判断で HOLD**（2026-10-20、原典の工程相違）。
- 原典（個別ページ、Owner 確認 2026-10-21）: **いくらと大葉は焼成後**、サーモンは加熱。172 マトリクスは #614 で訂正済み（`LATE_ADDITION` 必須、証跡強度 `source_profile_text`、READY）。
- 比較: BBQ チキンの後乗せ（cilantro）の証跡強度は **`catalog_design_tag`**（repo のカタログ設計タグ）で、個別ページ由来ではない。

| 観点 | イクラサーモン | BBQ チキン（OD-CS-10 で最初の対象に決定済み） |
|---|---|---|
| 後乗せ時機の証跡 | **個別ページ（強）** | カタログ設計タグ（弱）— 個別ページ確認は未実施 |
| 後乗せ食材 | salmon-roe（#584 で新規）＋ shiso（出荷済み）= **2 種**。両方 scatter topping | cilantro（新規）1 種 |
| 新規アセット | salmon-roe SVG は #584 に実装・測定済み。**shiso は既存** | bbq-sauce、cilantro、`cilantro-leaf` SVG（D-4 未決） |
| ソース | NO_SAUCE（ソース工程なし） | bbq-sauce（base）。ソース＋後乗せの共存を検証できる |
| 設計上の検証価値 | 後乗せ**複数**・ソースなしレシピでの FINISH、既存食材（shiso）が後乗せになる late 軸 strict の実例 | ベースソース＋後乗せ 1 種の最小例 |
| 弱点 | 橙の粒が焼けた生地に対し明度コントラスト約 1.0:1、輪郭頼み（RESULT 2.3:1 が最弱、#584 測定）。**後乗せは焼成フィルターの外に描かれる（F-1〜F-3）ので見え方が変わる可能性 — 要再測定**。個数・bake 窓は暫定（#527 D4 は原典未確認のまま）。ladder step 55 を #584 が確保 | ladder step 56 を #611 が提案（#584 の後ろ）。bbq-sauce の色決めが要る |
| 作業の再利用 | #584 の食材・SVG・ladder・Research cohort・テスト更新は**流用可能**（工程の付け替えが主） | 新規 |

**評価**: POST_BAKE の**代表例**としては ikura の方が証跡・アセット・検証価値の面で優れる。ただし (1) #584 は現状のままでは原典と違う工程を出荷してしまう、(2) late 内容は #615 の単一合流点（`LATE_*`）に入れないと本番 OFF で進行不能になる（#615 本文: 後乗せを `RECIPES` に直接入れると全 Vitest 23 件が失敗、8 件は Dex 26/28 に到達不能）、(3) ladder の late step の安定番号が未決、の 3 点で **#584 のままは出せない**。したがって「#584 を HOLD のまま維持し、#615 merge 後に late カタログへ移して再設計する」が Owner の現行方針と整合する（#615 本文: merge 順は「基盤 → #584 再設計」）。**本書は #584・#615 に何も変更していない。**

## 6. 比較表

| | POST_BAKE | MULTI_SAUCE (a) 焼成前 | MULTI_SAUCE (b) 仕上げ | ZONED |
|---|---|---|---|---|
| 対象レシピ（172 行、必須 / 候補） | **13 / 11**（post_bake 9、mid_bake 3、未解決 1）。うち FINISH だけで足りるのは post_bake 9 のうち topping 系 | **17 / 10** | 必須 3〜4（buffalo、detroit、teriyaki、候補 hot-honey）。POST_BAKE の部分集合 | **1 / 2** |
| そのうち READY | 4（bbq-chicken、mentaiko-cream〔mid_bake〕、ikura、wasabi-beef）。FINISH で足りるのは 3 | 6（＋READY_WITH_REVIEW 3） | 0〜1 | 1（quattro-stagioni） |
| 出荷済みとの重なり | 0 | 0 | 0 | 0 |
| 実装難度 | **中**（残りはデータ＋有効化＋HV） | **小〜中**（データ・ゲート更新）。ただし待ち時間が長い | **大**（FINISH 液体対応＋DRIZZLE） | **中〜大**（識別・採点・Reference の 3 点同時） |
| 新規 UI | なし（FINISH は実装済み） | なし | DRIZZLE | A 案はなし |
| 依存 | #615 → E4b → E5。#518 系は完了。UD-D/F/G、#495 | Square Dough B・C・D・F、原典確認 §8-1、F4 | POST_BAKE の E5 → #579 → #476 | なし（独立）。ただし presence-only の例外判断（Q6） |
| ユーザー体験上の価値 | **高**: 「焼いたあとに載せる」という調理の時間軸が増える。13 行を解禁し、ikura・BBQ・わさび牛など見た目と体験が直結 | 中: 見た目の変化は小さい（塗り重ね）。グランマは四角生地の体験と一体 | 中〜高: ただし対象が少なく POST_BAKE の後 | 低〜中: 対象 1 行。クアトロスタジオーニの「4 区画」は印象的だが単発 |
| 並行可否 | #615 / #584 / #611 が使用中のため、**新規作業者は E4b 以降のみ** | グランマ以外（スフィンチョーネ等）は Owner 保留 | 不可（前提待ち） | 他と独立。ただし今は不要 |
| 本番リスク | 中（有効化時の strict 識別、ladder 番号、HV） | 低 | 中 | 低（未着手） |

注: mid_bake（3 行）は POST_BAKE の対象に含めない（再焼成が必要で別設計、#575 §4.5 C）。FINISH 対象の数は「topping 系の post_bake」のみ。

## 7. 推奨: Phase 1 の最初の工程は POST_BAKE（topping のみ）

**理由**
1. 対象が最大で、**すでに土台がある**（engine〜UI〜保存原子性〜カタログ基盤）。残りが最も少ない「新しい工程」。
2. 他の 2 工程の前提にもなる（仕上げソースは POST_BAKE の上に乗る）。
3. MULTI_SAUCE (a) は Square Dough と原典確認の待ちで、いま着手しても進まない。ZONED は対象 1 行。
4. 実績のある手順（OFF 固定 → データ → 有効化）に従え、ロールバックは定数 1 つ。

**段階的な実装計画**（各段階は独立 PR。重複 Issue は作らず、既存 Issue に紐づける）

| 段階 | 内容 | 追跡 | 前提 | 新規 HV |
|---|---|---|---|---|
| **P0（監査、本書）** | 現状整理・Owner 判断の洗い出し | — | — | 不要 |
| **P1** | **#615 の Owner 確認と merge**（本書は触らない）。これが E4b / ikura 再設計の前提 | #611 / #615 | Owner 承認、CI 緑 | 不要（データなし・OFF 同一） |
| **P2** | **FIN-E4b**: 最初の後乗せレシピ 1 件のデータ（OFF のまま、`LATE_*` に追加）。Hint 5.0 gate・privacy sweep・STRUCTURE 件数・Research/Notebook 非漏洩を後乗せ込みで再実行（FIN-E2 §8） | #611 | P1、D-1〜D-6 | 本番で可視変化なしのため原則不要。ON の Preview で FINISH 画面の確認は E5 側 |
| **P3** | **ikura 再設計**: #584 の食材・SVG・テストを late カタログへ移し、`salmon-roe` と `shiso` を POST_BAKE 要件にする。ladder の位置は D-3 の結論に従う | #527 / #584 / #611 | P2、D-7 | OFF のため不要。Preview opt-in で 3 状態の見え方は P4 前に確認 |
| **P4（E5）** | 有効化の判断。late step 番号の安定化、UD-D/F/G、#495、**iPhone 実機 HV（390×844、必須）** | #294 / #604 / #495 | P2・P3、Owner 判断 | **必須**（動画は直接送付、スクショは `docs/reports/screenshots/<task>/`） |
| Phase 2 | 仕上げソース（#579）、MULTI_SAUCE (a) のグランマ（Square Dough 完了後）、DRIZZLE（#476 Gate） | #579 / #521 / #476 | P4 | 必須 |
| 保留 | ZONED（Q6 の回答後）、mid_bake（別設計） | — | — | — |

**第 1 レシピの選び方（D-7）**: Owner 決定済みの BBQ（OD-CS-10）を変えない場合も、**データ PR の前に BBQ チキンの個別ページで cilantro の時機を確認する**ことを推奨（現状は `catalog_design_tag` のみ）。ikura を先にする選択肢もあるが、これは Owner の既存決定の変更になるため、本書は変更を推奨せず、判断材料として §5 を示す。

## 8. リスクと未確認事項

| # | リスク | 内容 | 緩和 |
|---|---|---|---|
| R1 | ladder 番号の不安定 | ON カタログの late step 番号が通常バッチの追記でずれる | E5 前に「ON の間は通常バッチ停止」か「late 用の予約範囲」を決める（D-3） |
| R2 | 識別 strict の初見混乱 | 有効化後、既存レシピ食材を焼成後に置くと ORIGINAL | HV で観察。文言は Anti-Oracle のため動作を名指ししない |
| R3 | RESULT / Reference の 3 状態 | 後乗せの raw / perfect / burnt の見え方、見本・サムネ・RESULT の後乗せ表示は本書では未確認 | E5 の HV と Preview opt-in |
| R4 | 8 スロット上限 | FINISH ピースがリング上限を数えるか未実測 | E4b で実測（D-6） |
| R5 | 原典未確認 | pizzadb.jp はこの環境から未確認。BBQ の時機は設計タグのみ。ikura の個数・bake 窓は暫定（#527 D4）。レシピ原典監査 #612 は未 merge | データ PR の前に個別ページ確認（Owner 側または到達できるセッション） |
| R6 | HOT file 競合 | `recipes.ts` を #615 / #584 / #540 が触る | §9 の順序を守る |
| R7 | CI の間欠失敗 | #394（WebKit cooking E2E）で別 PR の赤が出うる | #619（テスト支援のみ）の結果待ち。再実行は 1 回のみ、緩和しない |
| R8 | Dinner / Lunch Rush | 除外が前提（UD-I）。ON 後も fail-closed 除外が壊れないこと | E4b の AC に入れる |
| R9 | Style Lock V2 | 食材 SVG の Production 実装は #423 完了まで禁止の記述あり。現在の解除状態は未確認 | 実装前に再確認（#611 §2 の注意と同じ） |

## 9. 既存 Issue・PR との重複、HOT file claim

**Issue（再利用。新規作成なし）**

| 工程 | 既存 Issue | 備考 |
|---|---|---|
| POST_BAKE | #294（親）、#604（TQ-2）、#611（E4b / Owner Decision）、#608（E3b）、#518（フィルター分離）、#495（暫定スコア）、#617（R8、#618 で実装済み）、#527（Batch 8） | 本書の成果は #611 / #604 に紐づく |
| 仕上げソース | #579（整理のみ・着手は E5 後）、#476 | 重複 Issue 不要 |
| MULTI_SAUCE (a) | #521、#519、#540（PR、HOLD）、#538（F4） | |
| 新ソース | #578 | MULTI_SAUCE ではない |
| ZONED | **専用 Issue なし。** #579 の非目標と #575 §6 に「将来フェーズ」とあるのみ | Owner が実装を決めるまで**起票しない**（Q6 未回答のため） |

**open PR と衝突しうるファイル**（HOT = `scripts/ops/hot-files.json`）

| PR | 状態 | 触る領域 | 本書の方針 |
|---|---|---|---|
| #615 | open | `recipes.ts`〔HOT〕、`ingredients.ts`、`discoveryLadder.ts`、`discoveryCatalog.ts`、`lateCatalog.ts`。claim は #611 のコメント（`expires` 2026-10-28） | 触れない。P1 の前提 |
| #584 | open（HOLD） | `recipes.ts`〔HOT〕、ingredients、ladder、`App.css`〔HOT〕、`PROJECT_HANDOFF.md`〔HOT〕 | 触れない。merge 順は「#615 → #584 再設計」 |
| #540 | Draft・HOLD | `recipes.ts`〔HOT〕（グランマ） | 触れない。Square Dough 完了待ち |
| #581 | open | Square Dough UX（`GameScreen.tsx`〔HOT〕等） | 触れない |
| #478 | Draft | `GameScreen.tsx`〔HOT〕、`IngredientTray.tsx`、`roundKind.ts` | FINISH の必須条件ではない（Owner 決定）。依存させない |
| #619 | open | `e2e` のテスト支援（#394 対応） | 触れない |
| #468 | open | `PizzaStage.tsx` / `App.css`〔HOT〕 | 後乗せの描画層と近い。E5 の前に再確認 |

- `gameReducer.ts`〔HOT〕、`persistence.ts`〔HOT〕、`App.css`〔HOT〕、`PROJECT_HANDOFF.md`〔HOT〕は**本書では編集していない**。
- Owner Gate (dry-run) は Actions 上の手動実行で、この環境から実行していない。重なりは open PR の一覧と claim コメントの検索で確認した（claim 検索の結果に載ったのは #584 / #217 など。**#615 の claim は #611 のコメントにある**）。実装開始時は最新の Owner Gate を必ず確認すること。
- #394・#615・#584・#618 への影響: なし（docs 1 ファイルの追加のみ。#618 は merge 済みで、本書はその上に立つ）。

## 10. Owner 判断事項（本書では決めない）

| ID | 判断 | 推奨（助言） |
|---|---|---|
| D-1 | Phase 1 の最初の工程を POST_BAKE（topping のみ）とし、P1〜P4 の順で進めてよいか | 承認 |
| D-2 | #615 を P1 として先に merge してよいか（#611 の D-2 と同じ順序の確認） | 承認 |
| D-3 | late step 番号の扱い: ON の間は通常バッチ停止／late 用の予約範囲／その他 | E5 の前に決定。いまは決めなくてよい |
| D-4 | `cilantro-leaf` 専用 SVG を E4b に含めるか（#611 D-4）。Style Lock V2 の解除状態の確認を含む | 含める（herb の葉系 emoji は識別不能のため） |
| D-5 | UD-G: 「後乗せ」の正式名・なぞかけ・Dex 文言（#611 D-5） | E4b の前に決定（ドラフトは #611 §4） |
| D-6 | 8 スロット上限と FINISH ピースの関係（#611 D-6） | E4b の実測後に再提示 |
| D-7 | 第 1 レシピ: BBQ を維持するか、証跡の強い ikura を先にするか。維持する場合、個別ページでの時機確認を E4b の前提にするか | BBQ 維持＋個別ページ確認。ikura は P3 |
| D-8 | #584 の扱い: HOLD のまま「late カタログ上で再設計」とし、現行 PR はクローズするか HOLD 継続か | HOLD 継続（クローズは再設計の見通しが立ってから） |
| Q6 | ZONED を実装するか。presence-only 識別の例外（位置を identity にする）を許すか | Phase 1 では実装しない。判断を保留 |
| Q5 | 仕上げソース（DRIZZLE）を FINISH の範囲に入れるか別 Issue か | 別（#579、E5 後） |
| 既存 | UD-D / F / G、OD-CS-12..19、#495、Design Lock §8-1（原典確認）、#527 D4 | 本書では追加の推奨なし |

## 11. 参照

- `docs/PROJECT_HANDOFF.md`、`docs/decisions/TETO_SESSION-OPERATIONS_1.0.md`、`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`
- `docs/design/TETO_COOKING-EXPANSION_FRESH-AUDIT-AND-PLAN.md`（#575）、`docs/design/TETO_FIN-E2_LATE-AXIS_DESIGN.md`、`docs/design/TETO_COOKING-STEPS-2.0_AUTHORITY-INDEX.md`
- `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（正）、`docs/reports/TETO_PIZZADB_TIMING-AUDIT_shipped.md`
- `docs/reports/TETO_FINISH-FIN-E3a_Result.md` / `-E3b` / `-E4a`、`TETO_FINISH-R8_PENDING-ROUND_Result.md`、`TETO_FINISH-D2-2C_F3_Result.md`
- Issue: #294、#476、#495、#518、#521、#527、#578、#579、#604、#608、#611、#617 / PR: #584、#615、#618、#619、#540、#478
