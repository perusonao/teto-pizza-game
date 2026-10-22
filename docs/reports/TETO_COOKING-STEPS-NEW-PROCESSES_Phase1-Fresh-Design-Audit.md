# 新しい調理工程 Phase 1 Fresh Design Audit — POST_BAKE / MULTI_SAUCE / ZONED（docs-only）

作成: 2026-10-22 / 基準 `main` `83f4b55`（#618 merge 後）/ ブランチ `claude/teto-pizza-cooking-audit-5qb1ol`
性質: **調査・設計のみ。** `src/**`・`e2e/**`・CSS・データ・テストは変更していない。共有 Preview の更新、merge、本番 FINISH 有効化はしていない。
Issue は新規作成していない（§9）。HV 動画は audit-only のため対象外（`PROJECT_HANDOFF.md` の「Audit-only tasks are exempt」）。
この文書の「推奨」は助言であり Owner Decision ではない。未決は §10 に列挙し、推測で確定していない。

> **更新 2026-10-22（Owner 決定の反映、3 回）:** §12（第 1 回）、§13（第 2 回: Q-1〜Q-8 の回答）、§14（第 3 回: E4b-ikura Issue 起票、技法文言候補、ビジュアル監査、Style Lock 追補範囲、#587 整理、#615 Final Gate 読み取り）を追加した。**§0・§5・§7・§8・§10 のうち §12 / §13 / §14 と食い違う記述は後の節が優先する**（§14 が最新）（初版の推奨のうち、最初のレシピを BBQ とする部分、late step 番号の扱い、Phase 1 の範囲は Owner 決定で置き換わった）。初版の本文は経緯として残す。

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

## 12. Owner 決定の反映（2026-10-22）と、次の実装 PR の設計整理

基準 `main` `d70bd20`（#619 merge 後）。docs-only。`src`・`e2e`・#615・#584・#394・共有 Preview・本番 FINISH には触れていない。PR 作成・merge は Owner 承認待ち。

### 12.1 Owner 決定（記録）

| # | 決定 | 初版への影響 |
|---|---|---|
| OD-P1-1 | 最初の新工程は POST_BAKE（topping のみ） | 初版 §7 と一致 |
| OD-P1-2 | 最初のレシピ候補は**イクラサーモン** | 初版 §7 / D-7（BBQ 維持）を**置換** |
| OD-P1-3 | BBQ チキンは次候補。**原典確認まで先行しない** | 初版 D-7 の「個別ページ確認」を前提条件に格上げ。#611 の E4b（BBQ データ）は保留 |
| OD-P1-4 | ladder は**通常枠と後乗せ枠を分離**し、後乗せ内の**相対順序**を維持。**絶対 step 番号には固定しない** | 初版 D-3 / R1 を**解決**（§12.3） |
| OD-P1-5 | MULTI_SAUCE の仕上げソースと ZONED は Phase 1 の対象外 | 初版 Q5 / Q6 を**解決**（Phase 1 では扱わない） |
| OD-P1-6 | #615 は Final Gate GREEN 後に merge 判断 | 初版 D-2 を条件付きで承認 |

### 12.2 #615 の現状（2026-10-22 確認、変更なし）

| 項目 | 事実 |
|---|---|
| head | `a122774`。Codex レビュー指摘なし、レビュースレッド解決済み |
| CI | build / layout-chromium / Layout Contract Gate / classify / WebKit 360×800 全 shard / 390×844 shard 2・3 は success。**WebKit Gate は failure** — `webkit-390x844 shard 1/3` の `e2e/cooking-tray-family-expanded.spec.ts:166` のみ（attempt 1: `Expected 0 / Received 1`、再実行 1 回: `388 / 390`）。#615 のコメントは「本 PR の変更ではない」と判断し Owner 判断待ち |
| その後 | #619（`e2e/support/familyTray.ts` の `settle()` をフレーム数基準にする、#394 対応）が main に merge 済み（`d70bd20`）。**#615 の head はこれを取り込んでいない** |
| 結論 | **現時点で Final Gate は GREEN ではない。** #619 を取り込んだ head で WebKit Gate が通るかは未確認（#619 が当該不安定を直す保証はなく、本書は推測しない）。head 更新（main の merge）と再実行は #615 の担当 session / Owner の操作で、**本書は行わない** |

### 12.3 #611 の ladder 設計との整合確認

結論: **「後乗せ枠の分離」は #615 の実装構造とすでに一致する。矛盾するのは #611 本文の数値・順序の記述と、#615 の「既知の限界」の解決案の書き方。**

| 箇所 | 記述 | Owner 決定との関係 | 扱い |
|---|---|---|---|
| #615 コード | `LATE_LADDER_STEPS` は通常 ladder とは別配列。`appendLadderSteps` が番号を**導出**（通常の長さ + 連番）。OFF の ladder は ON の厳密な前置 | 枠の分離・導出番号・OFF 同一と**整合** | 変更不要 |
| #615 Result §5b（および FIN-E2 §E5 申し送り） | 「ON の間は通常バッチを止める」か「late 用の安定番号の範囲を予約」の**どちらか**を E5 前に決める | Owner はどちらでもなく「分離＋相対順序、絶対番号に固定しない」を選択（= 予約範囲案を採らない） | **#615 の文言を後で更新**（merge 後の docs 追補。#615 は触らない） |
| #611 §1 ladder | 「step **56**。#584 が 55 を使用し E4 は後続」。BBQ を `{bbq-sauce, cilantro}` | 絶対番号の固定は OD-P1-4 と**矛盾**。最初のレシピも ikura に変更 | **superseded**。BBQ の行は BBQ 再開時に相対順序で書き直す |
| #611 §1 `ladderCredit` | 「#584 後 credited 58→59」 | ikura を後乗せ枠に移すと通常枠の credited は main の 57 のまま。後乗せ枠の credited は ON のときだけ数える | 数値の前提が変わる。E4b-ikura で再計算 |
| #611 §0 ① / D-2 | 「#584 の ladder 割当を優先」「#584 を先に merge してよいか」 | #584 は merge せず HOLD（再設計）。ikura は後乗せ枠に入る | **superseded** |
| #611 §3 | 本番 OFF は案 1（ビルド時定数） | 同じ | 整合 |
| #584 の step 55 | 通常枠 step 55 / credited 57→58 / ★2 到達性 baseline の締め直し / ladder golden +202 | ikura が後乗せ枠へ移ると通常枠の step 55 は空き、**次の通常バッチが 55 を使う**。#584 の golden・baseline の変更は E4b-ikura には持ち込まない | #584 は変更しない。再設計 PR は通常枠を触らない |

**相対順序を守るための追加規則（E4b-ikura の受け入れ条件へ）**
1. late の step 番号を**どのテストにも固定しない**。検証は「番号 = 通常 ladder の長さ + 後乗せ枠内の位置（導出）」と「後乗せ枠内の順序・key レシピ・素材が不変」。
2. 通常バッチが 1 つ追記されると、**未到達**の後乗せ step の必要発見数が +1 になる（導出の帰結）。**到達済みの後乗せ素材は再ロックされない**（`resolveMaterialUnlocks` は「既得 ∪ 到達分」で再ロックしない、コード確認済み）。この挙動は Owner が許容するか確認（§12.8 Q-6）。
3. ON の全カタログで `validateLadderProgression`（SOFTLOCK / UNREACHABLE / KEY_RECIPE）が空であること（#615 のテストが適用済み。ikura を入れた状態でも空）。
4. 後乗せ枠の**並べ替えは禁止**（枠内は追記専用）。枠は常に通常枠の後ろに追記される。
5. #615 の golden（OFF の 4 面）は無修正で通ること。

### 12.4 イクラサーモンの原典証跡と、後乗せ対象・投入タイミングの確定可否

> **証跡の出所に注意（2 系統あり、同一視しない）:** (a) 172 マトリクス（#614、main）は「個別ページ、Owner 確認 2026-10-21」と記録。(b) #587（open）は「ChatGPT が 2026-10-20 に個別ページを取得、Claude は独立再取得なし（`independentlyVerified:false`）、受領した原文は短い引用のみ」と記録。**どちらも本環境から pizzadb.jp に到達して確認したものではない**（本書も未確認）。

| 食材 | ゲーム内 | 原典の記述 | 確定できるか |
|---|---|---|---|
| いくら（salmon-roe） | **焼成後（FINISH）** | 引用「いくらと大葉は焼成後に載せ」（#587、#614 とも一致） | **確定可**（一次の短い引用が 2 系統で一致。個別ページの独立再取得は未実施） |
| 大葉（shiso） | **焼成後（FINISH）** | 同上。※別レシピ `shirasu-pizza` の大葉は「明確な指定なし」で焼成前のまま維持（#587）。同じ食材でもレシピごとに時機が違う | **確定可**（late 軸は食材 ID の集合で識別されるため、shirasu との衝突なし — 集合が別） |
| サーモン（salmon） | 焼成前（通常の TOPPING） | 「載せて焼く」「別に加熱する」の**両方式の記載**（#587 の要約。原文は未受領）。#614 は「十分に加熱し」と記録 | **証跡だけでは一意に確定できない。** 「焼成前」はゲーム化の既定（原典が許す方式の 1 つ。別加熱はゲームで表現不能）。Owner 承認が必要（§12.8 Q-1） |
| クリームチーズ | 焼成前（CHEESE） | **時機の明記なし** | **確定不可。** 既定（焼成前）として Owner 承認が必要（Q-1） |
| 個数・bake 窓・ピース数 | roe 2 / shiso 1 / salmon 3 / cream-cheese 2、bake 58–78、非ソース 8 | 原典に**なし**（#587: GAMEPLAY CALIBRATION） | 暫定のまま（#527 D4）。Owner が Preview で確認する値 |

**投入タイミング（ゲーム内）**: 焼成確定（CONFIRM_BAKE）の**後**に FINISH タブで `roe` と `shiso` をタップ配置する。ikura は NO_SAUCE・CUT なし（#584 の仕様）なので、FINISH がラウンド最後の工程になる。焼成失敗（生焼け・焦げ）のときは FINISH を飛ばして失敗確定（OD-CS-7）。Guided では FINISH のトレイに後乗せ要件の食材（roe・shiso）のみが並ぶ。

**確定できること / できないこと（要約）**: 「いくらと大葉が焼成後」は確定してよい。サーモン・クリームチーズの時機は証跡が弱く、設計上の既定として Owner が承認する形になる。個数と bake 窓は原典で裏づけられない。

### 12.5 #615 / #584 / FIN-E4b の依存関係

```
#619 (merged d70bd20)          #587 (docs, open, 古い base)   #614 (merged, 172 行の訂正)
        │                              │ 証跡の記録（任意の先行）        │
        ▼                              ▼                                ▼
#615 head 更新 → Final Gate GREEN ──(Owner merge 判断)──▶ main に late 基盤（データなし）
                                                              │ Depends-on: #615
                                                              ▼
                                        【次の PR】FIN-E4b-ikura（後乗せ枠に ikura を追加、本番 OFF）
                                                              │
                                   ┌──────────────────────────┤
                                   ▼                          ▼
                    #584（HOLD、変更しない）         E5 有効化（別 Owner 判断、実機 HV 必須）
                    ※同一レシピ id のため             ※ late 基盤の ON ＋ FINISH 本番スイッチ
                      E4b-ikura と同時に存在させない

FIN-E4b-BBQ（#611 のデータ）: 原典確認まで保留（OD-P1-3）。E4b-ikura とは独立で、その後に追加可能
```

| 依存 | 内容 |
|---|---|
| #615 → E4b-ikura | ikura のデータは `lateCatalog.ts` に入れるため、#615 の merge が前提（`Depends-on: #615`）。#615 を待たずに `RECIPES` へ直接入れると、全 Vitest 23 件が失敗する（#615 の測定） |
| #584 ⟂ E4b-ikura | 両方とも `ikura-salmon-pizza` を定義する。`validateLateCatalog` は「recipe id が base と重複」を違反とするため、**#584 が merge された状態で E4b-ikura は成立しない**（その逆も不可）。したがって **#584 は HOLD を維持し、E4b-ikura の merge 後に Owner が扱いを決める**（Q-3） |
| #584 → E4b-ikura（再利用） | 食材 `salmon-roe`・SVG（`salmon-roe-grains`）・taxonomy 行（OD-B8-2、seafood）・CSS 補正・Research cohort の考え方は流用可能。**コピーであって #584 の変更ではない** |
| #587 | 証跡の記録（docs/JSON）。E4b-ikura の必須前提ではないが、証跡の出所を repo に残す意味で先行 merge が望ましい（Q-4）。base が古く `mergeable_state` は未確認 |
| #394 | 間欠失敗の追跡。#619 は merge 済み。E4b-ikura の CI でも同様の失敗が出うるが、規則（再実行 1 回、skip・閾値緩和なし）は変えない |
| E5 | E4b-ikura の後。late 基盤の ON、FINISH 本番スイッチ、UD-D/F/G、#495、実機 HV |
| HOT file claim | #615 の claim（#611 のコメント、`recipes.ts` / `ingredients.ts` / `discoveryLadder.ts` / `discoveryCatalog.ts` / `lateCatalog*`、期限 2026-10-28）を尊重し、E4b-ikura の着手は #615 merge 後。着手時に claim を #611 へ投稿（下記） |

### 12.6 次の実装 PR（FIN-E4b-ikura）の最小スコープ

名称案: 「feat(finish): FIN-E4b — いくらとサーモンのピザを後乗せカタログへ追加（本番 OFF、#611 / #527）」。追跡は既存の #611（親 #294 / #604）と #527。新規 Issue なし。

**含む（最小）**
1. `src/data/lateCatalog.ts`: `LATE_RECIPES` に `ikura-salmon-pizza`（`requiredIngredients`: cream-cheese 2 / salmon 3 / salmon-roe 2・`POST_BAKE` / shiso 1・`POST_BAKE`、`lunchRush:false`、NO_SAUCE、CUT なし、bake 窓 58–78、報酬は全レシピ共通）、`LATE_INGREDIENTS` に `salmon-roe`（`unlockCondition` あり、ladder だけで入手）、`LATE_DISCOVERY_TARGET_IDS`（`ikura-salmon-pizza-pizzadb-p1`）、`LATE_LADDER_STEPS` に `{ ingredientIds:["salmon-roe"], keyRecipeId:"ikura-salmon-pizza" }`（**番号は書かない**、星ゲートなし）。
2. 型で強制される表の行: `recipeSauceProfiles`（no-sauce）、`recipeHintRoles`（key-free Hint）ほか `Record<RecipeId, …>` の表。
3. `salmon-roe` の taxonomy 行（OD-B8-2: seafood）と専用ビジュアル（#584 の `salmon-roe-grains` を流用）。CSS（`App.css`〔HOT〕）は salmon-roe 用の最小追加のみ。
4. テストと golden（§12.7）。結果報告 `docs/reports/TETO_FINISH-FIN-E4b-ikura_Result.md`。

**含まない**
`LATE_CATALOG_PRODUCTION` / FINISH 本番スイッチの変更、共有 Preview の更新、BBQ・cilantro・bbq-sauce、通常枠の ladder / golden の変更、#584・#615 への変更、reducer・`finishEngine`・`persistence.ts`・UI の変更（FINISH 画面は E3b までで完成）、仕上げソース・ZONED・mid_bake、UD-G の正式文言（仮文言のまま。ただし merge 条件は下記 AC-10）。

**claim（案。実投稿は着手時）**
`<!-- teto-claim:v1 {"issue":611,"branch":"claude/fin-e4b-ikura-<id>","files":["src/data/lateCatalog.ts","src/data/lateCatalog*.test.ts","src/data/recipeSauceProfiles.ts","src/data/recipeHintRoles.ts","src/data/ingredientTaxonomy.ts","src/App.css","src/components/** のうち salmon-roe の visual のみ","docs/reports/TETO_FINISH-FIN-E4b-ikura_Result.md"],"dependsOn":[615],"expires":"<着手から 72h〜14 日>"} -->`
`App.css` と `recipes.ts` 系の HOT 重なり（#584 / #615 / #540 / #468）は、PR 本文に「#615 が先に merge、#584 は HOLD で非 merge」と明記する。

### 12.7 受け入れ条件（AC）

| # | 条件 | 検証の方法 |
|---|---|---|
| AC-1 | **本番 OFF は従来と同一**: OFF の 4 面（recipes / ingredients / ladder / 発見 target）の golden が**無修正で**通る。`mergeLate(base, late, false) === base`。`RECIPES` に `POST_BAKE` が 0 件。`finishD2Inert` が無修正で通る | #615 の golden・既存ガード |
| AC-2 | **ON の構造**: `validateLateCatalog` 空、`validateLadderProgression` 空（SOFTLOCK / UNREACHABLE / KEY_RECIPE なし）、`validateCatalogTables` / `validateFinishCatalog` 空。late step 番号は**テストに固定せず**、導出（通常の長さ + 枠内位置）として検査 | 合成ではなく**実データ**を `vi.doMock("./lateCatalog")` 経由で ON にして検査 |
| AC-3 | **相対順序の保全**: 通常 ladder に合成の通常 step を 1 つ追記しても、後乗せ枠の順序・key・素材は不変、未到達 step の必要発見数だけ +1、到達済み素材は再ロックされない | 追記前後の ON ladder を比較するテスト |
| AC-4 | **識別**（FIN-E2 §3.3）: 正しい配置（cream-cheese・salmon を焼成前、roe・shiso を焼成後）→ 一意一致。全部焼成前 → ORIGINAL。roe を焼成前／shiso を焼成前に置く → 不一致。roe 1 個（不足）→ 識別一致・Gate 通過・数量は採点で減点。roe 0 個 → 不一致。**既存レシピとの食材集合の衝突なし**（特に `shirasu-pizza`：shiso を共有） | 識別・Completion Gate のテスト |
| AC-5 | **ラウンド**: Guided の FINISH トレイは roe・shiso のみ。焼成失敗で FINISH をスキップ。在庫は焼成前ピースが焼成時に 1 回、後乗せが完成時に 1 回（合計 1 回）。Free / Research でも ikura が発見できる。R8 の行列（`pendingRound.matrix`）に ikura が含まれ、二重消費なし。Dinner / Lunch Rush は除外のまま | reducer・R8 のテスト（ON ビルド） |
| AC-5b | **8 スロット上限**（D-6）: 非ソース 8 ピース（後乗せ 3 を含む）で、リング上限が FINISH ピースを数えるかを実測し記録 | 実測テスト／報告書 |
| AC-6 | **Anti-Oracle / Hint 5.0**（FIN-E2 §8 の 1〜5）: gate・DH4 privacy sweep（300 ladder 状態 + seeded random）を ikura 込みで再実行し緑。閾値・k・範囲は緩めない。STRUCTURE 件数は distinct 4。`applicationPhase` を hint / deduction / Research / Dex が読まない grep ガード維持。時機を示すカテゴリ名・family 名なし。Research ○× 台帳・Notebook・Hint 事実に時機が出ない。`late-addition` の affordance step が ladder から**導出**され、`deductionProduction.gate` の INV-TQ-4 の期待値更新が diff に現れる | 既存 gate / sweep の再実行、更新差分の明示 |
| AC-7 | **セーブ互換**: ON で作ったセーブ（ikura の Dex 記録、`salmon-roe` の既得、在庫、ヒント事実）を OFF ビルドが開いてクラッシュせず、書き戻しで失われず、ON で開き直すと復元される。**#615 が Dex のみ検証としている範囲を、既得素材・在庫・ヒント事実へ拡張** | `persistProgress` 経由のテスト |
| AC-8 | **表示**: Preview opt-in の ON ビルドで、salmon-roe が（トレイ・生地上・RESULT）で識別できること。後乗せは焼成フィルターの外に描かれるため、**3 状態（raw / perfect / burnt）で再測定**（#584 の 1.0:1 / 2.3:1 は焼成前配置の値で流用不可）。**共有 Preview は更新しない**（ローカル／e2e で測定） | 測定報告（動画は E5 の HV） |
| AC-9 | **CI**: 最終 HEAD で build・tsc・oxlint・Vitest 全件・代表 E2E（390×844 / 360×800）・WebKit 各 shard が GREEN。WebKit の間欠失敗は #394 の規則（原因記録、再実行 1 回まで、skip・閾値緩和・空コミットなし）。**前 HEAD の結果は流用しない** | Final Gate |
| AC-10 | **merge 条件（FIN-E2 §8-6）**: UD-F（価格・星・credit）と UD-G（技法名・なぞかけ・Dex 文言）が Owner 決定済み。未決の間は PR を Draft / merge 保留 | Owner 確認 |
| AC-11 | **範囲の遵守**: diff に #615 / #584 / #394 関連ファイル、`LATE_CATALOG_PRODUCTION`、`FREE_COOK_FINISH_PRODUCTION`、reducer・persistence のコードが含まれない。claim 投稿済み。`Depends-on: #615` を PR 本文に記載 | diff レビュー |

HV: E4b-ikura は本番で可視変化なし（OFF）。POLICY の HV（390×844 動画 + before/after スクショ）は **E5 で必須**。E4b では AC-8 の測定とスクリーンショットのみ（動画は不要、Owner の承認が必要 — Q-8）。

### 12.8 残る未決事項（これだけが未回答）

| # | 未決 | 推奨（助言） |
|---|---|---|
| Q-1 | サーモン・クリームチーズを**焼成前**で確定してよいか（原典は「両方式」「明記なし」） | 承認（ゲームで別加熱は表現不能。いくら・大葉のみを後乗せとする） |
| Q-2 | UD-F: ikura の価格・星・credit。OD-B8-1（T4 / 120・60 Pitz / 星ゲートなし / credited）を**後乗せ枠でもそのまま適用**してよいか。UD-G: 技法名・なぞかけ・Dex 文言（#611 §4 のドラフトの承認または修正） | OD-B8-1 を流用。UD-G は文言が Owner のもの |
| Q-3 | **#584 の最終的な扱い**（E4b-ikura の merge 後にクローズか、HOLD 継続か）。同一 id のため併存不可 | E4b-ikura merge 後に「superseded」としてクローズ |
| Q-4 | #587（原典タイミング証跡）を E4b の前に merge するか。証跡の出所が #614（Owner 確認）と #587（ChatGPT 取得、未再確認）で食い違うため、**どちらを source of record とするか**。pizzadb.jp の独立再取得（Owner または到達できる環境）を行うか | #587 を先に merge し、出所を併記 |
| Q-5 | 8 スロット上限と後乗せピース（D-6）— AC-5b の実測後に再提示 | 実測してから判断 |
| Q-6 | 通常バッチが追記されると**未到達**の後乗せ step の必要発見数が +1 になる挙動（到達済みは再ロックされない）を許容するか | 許容（絶対番号に固定しない決定の帰結） |
| Q-7 | #615 の Final Gate: WebKit Gate の赤（#394 系の既知の不安定）を、#619 を取り込んだ head で確認する運用でよいか。取り込み後も赤なら Owner 判断（別修正 or 再実行） | #615 の担当 session が main を merge して再実行（1 回） |
| Q-8 | E4b-ikura に実機 HV 動画を求めるか（OFF で可視変化なし → E5 まで延期でよいか） | E5 まで延期 |

**前回の未決との対応**: D-1 ✅（OD-P1-1）、D-2 ✅ 条件付き（OD-P1-6）、D-3 ✅（OD-P1-4）、D-4（cilantro-leaf）— BBQ 再開まで保留、D-5（UD-G）→ Q-2、D-6 → Q-5、D-7 ✅（OD-P1-2/3）、D-8 → Q-3、Q5 / Q6 ✅（OD-P1-5、Phase 1 対象外）。§8 のリスクのうち R9（Style Lock V2 の #423 ゲート）は **#423 が closed（PR #430 merge、2026-10-08）のため解消**。実装前に Style Lock V2 §7 の他の条件がないかは未確認。

### 12.9 確認範囲（追加分）

読んだもの: #615 のコメント・チェック（head `a122774`）と `lateCatalog.ts` / Result の §2・§5b（`origin/claude/late-catalog-foundation-1jvnee`）、`discoveryLadder`（logic / data）、#587 の本文と報告書、#584 の本文・コメント、Batch 8 Owner Decisions、172 マトリクスの ikura 行、#423。読んでいない・できなかったもの: pizzadb.jp、`persistence.ts` の素材既得の保存経路の全体（`resolveMaterialUnlocks` のコメントとコードで「再ロックしない」ことのみ確認）、#611 のコメント以外の更新（本文は 2026-10-21 時点）、Owner Gate の実行。

## 13. Owner 判断の反映・第 2 回（2026-10-22）

基準 `main` `d70bd20`。docs-only。#615・#584 のコード、共有 Preview、本番 FINISH は変更していない。新規 PR・merge なし。以下の「修正候補」は**提案であり、他の Issue / PR / 文書は編集していない**。

### 13.1 Owner 判断欄（§12.8 Q-1〜Q-8 の確定）

| # | 確定した判断 | 設計への反映 |
|---|---|---|
| Q-1 | サーモン・クリームチーズは**焼成前を暫定採用**。**原典確定とは扱わない** | データ・Result・コード注釈・PR 本文で「暫定（ゲーム化の既定）」と明記し、「原典で確定」と書かない。後乗せ（roe・shiso）だけが個別ページの引用に基づく |
| Q-2 | イクラは **Batch 8 の T4・星ゲートなし・credited を維持**。技法名・Dex 文言は **Style Lock との照合後に確定** | 価格・星・credit は OD-B8-1 のまま（再議論しない）。技法名・Dex 文言は未確定で、照合結果を §13.4 に整理（AC-10 は「文言確定まで merge 保留」のまま） |
| Q-3 | #584 は **E4b-ikura merge 後にクローズ判断** | E4b-ikura の merge 前に #584 はクローズしない。併存不可（同一 recipe id）の制約は維持 |
| Q-4 | #587 は **#614 との証跡整合性を確認してから判断**。**#614 の Owner 確認を優先** | §13.2 に確認結果。#587 は現状のまま merge 判断に進めない（要修正点あり） |
| Q-5 | 後乗せピースのリング上限は**実測で判断** | AC-5b を「実測し、結果で Owner が判断」に強化（事前に仕様化しない） |
| Q-6 | 通常 ladder 追加に伴う**未到達 step の必要発見数 +1 は許容**。**既到達・既解禁状態は後退させない** | AC-3 に「後退させない」の検査を明示（§13.3） |
| Q-7 | #615 は **#619 取り込み後の新 HEAD** で Final Gate を確認 | 新 HEAD `224a190`（#619 を取り込む merge commit）。確認状況は §13.6 |
| Q-8 | 実機動画は E4b では必須でなく、**E5 有効化前に必須** | AC-8 は測定とスクリーンショットのみ。E5 の前提条件に動画を明記 |

### 13.2 #587 と #614 の証跡整合性

| 観点 | #614（main、172 マトリクスの訂正） | #587（open、`TETO_PIZZADB_172_MASTER-EVIDENCE.json` ほか） | 整合 |
|---|---|---|---|
| いくら・大葉 | 焼成後（`source_profile_text`） | 引用「いくらと大葉は焼成後に載せ」、`post_bake` | **一致** |
| サーモン | 「十分に加熱」＝後乗せではない | 「載せて焼く／別に加熱する」の**両方式**、単一の時機ではない | **結論（後乗せでない）は一致**。記述の粒度が違う（#614 は一方式のみ、#587 は両方式）。Q-1 の暫定扱いはどちらにも整合 |
| クリームチーズ | 時機の記載なし | 明記を確認できず | **一致** |
| 出所の表現 | 「個別ページ、**Owner 確認** 2026-10-21」 | 「**ChatGPT** が 2026-10-20 に取得。**Owner の確認ではない**。Owner の独立再取得の記録なし」 | **不整合**（出所の表現が逆の主張）。Owner 決定により **#614 を優先** |
| 日付 | 2026-10-21 | 2026-10-20（取得日） | 取得と確認で日が違う可能性。断定せず |
| 個数・bake・ピース数 | 記載なし | GAMEPLAY CALIBRATION（roe 2 / shiso 1 / salmon 3 / cream-cheese 2、58–78、8 ピース） | #584 の値と一致。原典ではない |
| 工程の記述 | — | 「`currentGameTiming`: 全食材焼成前」「再開時の ladder step は main で採番（55 固定しない）」 | 前者は #584（HOLD）の現状で正しい。後者は OD-P1-4 と方向は同じ（番号に固定しない）が、「通常枠で採番」と読めるため**後乗せ枠の導出**と整合させる修正が望ましい |
| 機械検査 | `--check` / `--check-runtime` 通過と記載 | `progression2_mechanic_matrix.py --check` は main でも FAIL（#260 で追跡）と記載 | **要確認**（#614 の merge 後の状態。本書は再実行していない） |
| ブランチの状態 | main（merge 済み） | base が古く（`5997157`）、現 main との差が 160 ファイル規模。`mergeable_state` は未確認 | merge 前に更新が必要（#587 の担当側） |

**判断材料（Owner 向け）**: #587 を merge すると repo に「Owner の確認ではない」という出所記述が入り、#614 の「Owner 確認」と**矛盾したまま並ぶ**。Q-4 の方針（#614 優先）に沿うなら、**#587 の `independentlyVerifiedNote` と報告書の「確認範囲」を、「source of record は #614（Owner 確認）、ChatGPT 取得は補足」へ修正してから**判断するのが筋。修正は #587 の担当 session / Owner の操作（本書は編集しない）。**E4b-ikura は #587 の merge を待たない**（#614 が main にあるため）。

### 13.3 固定 step 番号・merge 順の古い記述 — 修正候補

| 場所 | 現行の記述（要旨） | 問題 | 修正候補 | 修正の時機・担当 |
|---|---|---|---|---|
| #611 本文 §0 ① | 「#584 の ladder 割当を優先し E4 は後続 step」 | #584 は HOLD・非 merge。ikura は後乗せ枠 | 「ikura（#584 再設計）が後乗せ枠の先頭。通常枠の step は使わない」 | Owner が #611 を更新 or 新コメントで supersede |
| #611 本文 §1 ladder 行 | 「**step 56**。`{bbq-sauce, cilantro}`」 | 絶対番号の固定（OD-P1-4 に反する）。BBQ は保留 | 「後乗せ枠の 2 番目（相対順序）。番号は導出。**BBQ は原典確認後**」 | 同上 |
| #611 本文 §1 `ladderCredit` | 「#584 後 credited 58→59」 | #584 が通常枠に入らなくなる | 「通常枠の credited は 57 のまま。後乗せ枠の credited は ON のときのみ加算」 | 同上 |
| #611 本文 §5 D-2 | 「#584 を先に merge してよいか（E4b は merge 後）」 | 順序が逆転（#615 → E4b-ikura → #584 クローズ判断） | 「#615 → E4b-ikura → #584 の扱いを判断（Q-3）」 | 同上 |
| #611 本文 §0 ④ / §3 | 本番 OFF 時は BBQ も除外 | 対象が ikura に変わるが方式（案 1）は不変 | 「後乗せレシピ（ikura、後に BBQ）を OFF では除外」 | 同上 |
| #615 本文「既知の限界」 | 「通常バッチ停止か、安定番号の予約範囲を **E5 前に決める**」 | Owner はどちらも選ばず「枠の分離＋相対順序」を決定 | 「**決定済み（OD-P1-4）**: 枠を分離し相対順序を維持、絶対番号に固定しない。未到達 step の必要発見数 +1 は許容、既到達・既解禁は後退させない」 | #615 の merge 後に docs 追補（#615 は編集しない。コード不要の文言のみ） |
| #615 Result §5b | 同上 | 同上 | 同上（「選択肢 (a)/(b)」を「決定済み」へ） | merge 後の追補 PR |
| #615 `lateCatalog.ts` のコメント | 「KNOWN LIMIT (decide before E5)」 | 決定済みの項目が未決のコメントのまま | 「Decided (Owner, 2026-10-22): …」へ置換（コメントのみ） | **コード変更を伴うので別 PR（本書の範囲外）。#615 には入れない** |
| FIN-E2 設計書 §7「E5」 | 「有効化の OFF ゲート方式（E4 前に決定）」 | late 番号の扱いは別論点として未記載 | 「late の番号は導出（OD-P1-4）」を 1 行追記 | #615 が既に追記済みの箇所と併せて追補 |
| #587 の `gameDesignValues` / 報告書 | 「再開時の ladder step は main で採番」 | 後乗せ枠の導出と読み違えうる | 「後乗せ枠で導出（絶対番号に固定しない）」 | #587 の修正時（§13.2） |
| 本書 §5 / §7 / §10 | BBQ を第 1 レシピ、D-3 を未決 | Owner 決定で置換 | §12 / §13 が優先（バナーで明記済み） | 本 PR で対応済み |
| #584 本文 | 「ladder step 55」「credited 57→58」 | HOLD。再設計で通常枠を使わない | **#584 は編集しない**。クローズ時（Q-3）に「superseded by FIN-E4b-ikura」と記す | E4b-ikura merge 後 |

**検査を伴う修正候補（E4b-ikura の AC に取り込み済み）**: late step の絶対番号をテストに固定しない／相対順序・key・素材の不変を検査／到達済み解禁の後退なし（AC-3）。

### 13.4 Style Lock の未確認条件

対象: `docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md`（Style Lock v2）。**前提の確認**: この文書は食材**アイコン**の意匠・実装規約で、**技法名・Dex 文言の規定は含まない**（`文言`・`Dex`・`なぞかけ` を検索し、アイコン用途の Dex 表示以外の記述なし）。技法名・なぞかけ・説明文の authority は `TETO_COOKING-TECHNIQUES_1.0_*`（INV-TQ-5、P6、OD-TQ-5/6/16）と Anti-Oracle Contract。Q-2 の「Style Lock との照合」が別の文書を指す場合は指定が必要（§13.7 B-5）。

| # | 条件（Style Lock v2） | 状態 | ikura への影響 |
|---|---|---|---|
| S-1 | §7 / §0-4: **#423 完了まで Production 実装禁止** | **解消**（#423 closed、PR #430） | なし |
| S-2 | §7: 「実装 Issue は **Owner が起票**」「実装は #423 完了後の最新 main から」 | 実装 Issue の起票は Owner。**salmon-roe 専用の実装 Issue は存在しない**（#584 / #527 が追跡） | E4b-ikura の追跡は #611 / #527。Owner が実装 Issue 扱いを承認するか未確認（B-4） |
| S-3 | §1 / §1b / §9: 対象は **26 + goat-cheese 1 = 27 種**。**salmon-roe・shiso・whitebait は対象外**（本文に記載なし）。salmon（`salmon.svg`）と cream-cheese（`cream-cheese.svg`）は**対象で意匠確定済みだが `pieceVisual` は未実装**（`ingredients.ts` に無い） | salmon-roe の意匠は **OD-B8-2 追記（2026-10-20）** で別途認可。Style Lock 本文には未反映 | ① ikura のピザ上で roe は SVG、**salmon・cream-cheese は emoji / CSS のまま**（意匠が混在）。② Style Lock 文書に salmon-roe を載せる更新が要るか（B-3） |
| S-4 | §2 共通仕様（64×64、`id` / gradient / `<defs>` なし、2 トーン、接地影）、§3 サイズ補正 | #584 の `salmon-roe-grains` は「64×64、id/gradient/defs なし、2 トーン、接地影」と記載（本書は SVG 本体を未検査） | E4b で流用時に §2 のチェックを再実行 |
| S-5 | §6: 実装テスト — `IngredientGlyph.test.tsx` の dedicated 集合更新、visual ごとの描画、id 非依存、`id=` / `url(#` なし、テキスト規約、save 不変 | 現行テストは `BATCH8B_DEDICATED` に shiso / whitebait。**salmon-roe は未追加**（#584 側にのみ） | E4b-ikura の必須テスト |
| S-6 | §6 末尾: UI 変更は **Human Verification（390×844 動画 + before/after スクショ）** が完了条件 | Q-8 により E4b では動画不要、E5 前に必須 | Style Lock の HV 要件を「E5 まで延期」と PR 本文に明記（Owner 承認済みの Q-8 を根拠） |
| S-7 | §8 未確定: 接地影のピザ上での見え方、サイズ補正の要否、チップ幅・タップ領域・行高への影響（cheese 分岐）、sausage↔hot-dog の 20px 識別 | #584 の測定（トレイ 31px / 生地上 24px / RESULT 18px、輪郭コントラスト 2.3〜3.1:1）はあるが**焼成前配置の値** | **後乗せは `PostBakePiece` で「焼いていない見た目のまま」`.pizza-post-layer` に描かれる**（焼成フィルター外、`IngredientPieceVisual` 経由）。コントラスト・接地影は**再測定が必要**（AC-8） |
| S-8 | §0-3 / §0-6 / §4.4: ピザ上・ドラッグ preview・サムネ・Reference の SVG 化は **チーズの `pieceVisual` 限定の決定** | roe は topping。トッピングの `pieceVisual` はピザ上でも描く既存方式（capers 等） | 該当しない（確認済み）。ただし Reference / Pizza Select サムネでの roe の見え方は未測定 |
| S-9 | §9-6: 絵文字重複（artichoke/rosemary、spinach/oregano）は対象外 | G18（グリフ一意性）は維持 | roe の emoji（🟠）は表示されないフォールバック。G18 の再確認を AC に（既存 gate） |

**技法名・Dex 文言の照合（Q-2 の前提作業）**: 現行の仮文言は `techniques.ts` の `late-addition`（名称「後乗せ」、なぞかけ「同じ材料でも、ひと手間の加え方で違う一枚になることがあるよ。」、説明「焼き上がりのあとに仕上げる調理法」）。Techniques SSOT の規則との照合結果 — (a) なぞかけは動作・時機を名指ししていない（INV-TQ-5 / P6 に適合）。(b) **説明文は「焼き上がりのあとに」と時機を名指ししている**が、Dex で名称・説明が見えるのは**発見後のみ**（INV-TQ-5）なので許容範囲。ただし RESULT の技法段（①Technique → ②Recipe）やヒントなど、**発見前に見える面に説明文が出ない**ことを E4b のテストで固定すること。(c) Anti-Oracle 上、トレイ（FINISH タブの食材一覧）が後乗せ要件の食材だけを並べる点は OD-TQ-16 系の既存許容の範囲か、E4b の privacy sweep で再確認（AC-6）。最終文言は Owner のもので、本書は決めない。

### 13.5 E4b-ikura の受け入れ条件（Owner 判断反映後の最終版）

§12.7 の AC を次のとおり更新する（変更・追加のみ。AC-1/2/4/6/7/9/11 は §12.7 のまま、AC-7 の対象拡張も維持）。

| # | 更新後の条件 | 反映した判断 |
|---|---|---|
| AC-0（新） | **暫定表記**: salmon・cream-cheese を焼成前とする注釈（コード・データ・Result・PR 本文）は「**暫定（ゲーム化の既定）。原典確定ではない**」と書き、roe・shiso のみ「個別ページの引用に基づく」と書く。「原典で確認済み」と書かない。個数・bake 窓は GAMEPLAY CALIBRATION | Q-1 |
| AC-3（強化） | 通常 ladder に合成の通常 step を追記しても、後乗せ枠の**順序・key・素材は不変**、**未到達** step の必要発見数だけ +1。**既到達・既解禁は後退しない**: (i) 追記前に `salmon-roe` を既得としたセーブは、追記後も `resolveMaterialUnlocks` の結果に `salmon-roe` を含む、(ii) 追記前に到達済みだった後乗せ step のレシピが、追記後も Dex の発見・Shop の解禁で失われない、(iii) 追記前後で `reachedLadderSteps` の既通過 step が減らない。**late step 番号は固定しない** | Q-6 / OD-P1-4 |
| AC-5b（強化） | **実測して判断**: 非ソース 8 ピース（後乗せ 3 を含む）で、リング上限が後乗せピースを数えるかを実測し、結果と代替案（上限を超える場合の挙動）を報告書に記録。**閾値・上限の変更を実装に含めない**（判断は Owner が実測結果で行う） | Q-5 |
| AC-8（更新） | Preview opt-in の ON ビルド（ローカル／e2e。**共有 Preview は更新しない**）で、salmon-roe をトレイ・生地上・RESULT で**後乗せ（焼成フィルター外、未焼成の見た目）**の状態で再測定（3 状態: raw / perfect / burnt）。**動画は不要**（E5 前に必須）。測定値は #584 の値を流用しない | Q-8 / S-7 |
| AC-10（更新） | **merge 条件**: (a) UD-F: **OD-B8-1（T4・星ゲートなし・credited）を維持**、(b) UD-G: 技法名・なぞかけ・説明文は Owner 決定済み（照合結果 §13.4）、(c) 発見前の面に説明文が出ないテスト。未決の間は Draft / merge 保留 | Q-2 |
| AC-12（新） | **Style Lock 適合**: §13.4 S-4・S-5・S-9（共通仕様、`IngredientGlyph.test.tsx` の更新、G18）を満たす。S-2・S-3（Issue 起票、Style Lock 文書への反映）は Owner 判断（B-3 / B-4）を PR 本文に記録 | Q-2 |
| AC-13（新） | **#584 の非干渉**: E4b-ikura の merge 前に #584 をクローズ・変更しない。E4b-ikura の merge 後のクローズは Owner 判断（Q-3）。同一 recipe id の併存は `validateLateCatalog` が違反とすることをテストで固定 | Q-3 |
| AC-14（新） | **E5 の前提を明記**: E4b の PR 本文に「E5 有効化の前に **390×844 の実機動画（直接送付）と before/after スクショ**が必須」「`LATE_CATALOG_PRODUCTION` / `FREE_COOK_FINISH_PRODUCTION` は E4b で変更しない」と記載 | Q-8 |

### 13.6 #615 の Final Gate（Q-7）— 2026-10-22 時点の確認

| 項目 | 事実 |
|---|---|
| 新 HEAD | `224a190`（`merge: main (#619 WebKit 安定化 d70bd20) を FIN-E4 基盤に取り込む`）。base は `d70bd20`（#619 取り込み済み） |
| 差分 | main に対し 10 ファイル / +758 −12。#615 の本来の範囲（`src/data/` の配線、golden、テスト、docs）のまま |
| CI | **実行中**（build、layout-chromium、WebKit 6 shard が `in_progress`、classify は success）。**この時点で Final Gate は未確定** — 本書は GREEN とも RED とも断定しない |
| `mergeable_state` | `unstable`（チェック実行中のため。結論ではない） |
| 次の確認 | 全 shard 完了後に WebKit Gate・build・layout を確認。#394 系の赤が出た場合は規則（原因記録、再実行 1 回まで、skip・閾値緩和なし）。**前 HEAD（`a122774`）の結果は流用しない** |
| Codex | 現 HEAD への `@codex review` の受領は未確認（前 HEAD `a122774` は指摘なし）。merge 判断は Final Gate（現 HEAD の Codex・CI・スレッド）が揃ってから |

### 13.7 HOT file claim の整理（次の実装 = FIN-E4b-ikura）

**既存の claim / 使用状況（2026-10-22 確認）**

| 持ち主 | 対象 | 期限 | 状態 |
|---|---|---|---|
| #611 のコメント（session `019hxepa…`、#615） | `recipes.ts`〔HOT〕、`ingredients.ts`、`discoveryLadder.ts`、`discoveryCatalog.ts`、`lateCatalog.ts`、`lateCatalog*.test.ts` | 2026-10-28 | 有効。**#615 merge 後に release されるはず**（`released:true` の投稿を確認すること） |
| #604 のコメント（FIN-E2 `01C3ra…` / FIN-E3a `01Pdte…`） | `techniques.ts`、`signature.ts`、`state/finishEngine.ts`、`gameReducer.ts`〔HOT〕ほか | 10-24 / 10-25 | E2・E3a は merge 済みで実質完了。**`techniques.ts` を UD-G で変更する場合は新規 claim**（期限切れ後） |
| #584 | `recipes.ts`〔HOT〕、`App.css`〔HOT〕、`PROJECT_HANDOFF.md`〔HOT〕、ingredients、ladder | （PR 本体） | HOLD。変更しない |
| #540 | `recipes.ts`〔HOT〕 | Draft・HOLD | 変更しない |
| #468 | `PizzaStage.tsx`、`App.css`〔HOT〕 | open | 後乗せ描画層と近い。E5 前に再確認 |

**FIN-E4b-ikura が触る予定のファイルと HOT 判定**

| ファイル | HOT | 備考 | 衝突しうる相手 | 対処 |
|---|---|---|---|---|
| `src/data/lateCatalog.ts`、`lateCatalog*.test.ts` | — | データ追加（#615 の claim 対象） | #615 | **#615 merge 後に着手**。claim は #615 の release を確認してから |
| `src/data/ingredients.ts` | — | `DedicatedIngredientVisual` の union に `salmon-roe-grains` を追加（line 93 付近） | #615（wiring）、#584 | 同上。#584 とは同一変更になるが併存しない |
| `src/data/recipeSauceProfiles.ts`、`src/data/recipeHintRoles.ts` | — | `Record<RecipeId,…>` の表に ikura の行（#615 の注記どおり） | #584（同行を追加） | #584 は HOLD。併存しない |
| `src/data/ingredientTaxonomy.ts` | — | `TOPPING_FAMILY_ROWS` に salmon-roe（OD-B8-2） | #584 | 同上 |
| `src/components/IngredientGlyph.tsx`、`IngredientGlyph.test.tsx` | — | visual と viewBox、dedicated 集合 | #584 | 同上 |
| **`src/App.css`** | **HOT** | salmon-roe 用の最小補正のみ（`.ingredient-glyph--salmon-roe-grains` 相当。shiso 補正は line 823 付近） | #584（同 CSS）、#468 | PR 本文に「#615 → 本 PR、#584 は HOLD で非 merge」を明記。追加は末尾の局所ブロックに限定 |
| `src/data/techniques.ts` | — | **UD-G の文言確定後のみ**変更 | #604 の旧 claim（期限切れ予定） | 文言決定後に別途 claim |
| `src/data/recipes.ts` | **HOT** | **触らない**（late は `lateCatalog.ts` に入れる。配線は #615 で完了） | #615 / #584 / #540 | 触る必要が出たら着手を止めて Owner に確認 |
| `docs/PROJECT_HANDOFF.md` | **HOT** | **触らない**（更新は Owner の指示後に別 PR） | — | — |
| `gameReducer.ts`、`persistence.ts`、`GameScreen.tsx` | **HOT** | **触らない**（範囲外） | — | — |
| `docs/reports/TETO_FINISH-FIN-E4b-ikura_Result.md` | — | 新規 | — | — |

**claim の投稿案**（実投稿は着手時。#611 に投稿）
`<!-- teto-claim:v1 {"session":"<着手時>","issue":611,"pr":null,"branch":"claude/fin-e4b-ikura-<id>","files":["src/data/lateCatalog.ts","src/data/lateCatalog*.test.ts","src/data/ingredients.ts","src/data/recipeSauceProfiles.ts","src/data/recipeHintRoles.ts","src/data/ingredientTaxonomy.ts","src/components/IngredientGlyph.tsx","src/components/IngredientGlyph.test.tsx","src/App.css","docs/reports/TETO_FINISH-FIN-E4b-ikura_Result.md"],"dependsOn":[615],"expires":"<着手から 72h、最大 14 日>"} -->`
`App.css`（HOT）について、PR 本文に「**#615 が先に merge。#584 は HOLD（非 merge、本 PR の merge 後にクローズ判断）。#468 とは別領域**」と明記する。Owner Gate の最新レポートを着手前に確認する（本環境では未実行）。

### 13.8 残るブロッカー・未決（これだけが未解決）

| # | 種別 | 内容 |
|---|---|---|
| B-1 | **ブロッカー** | **#615 の Final Gate**: 新 HEAD `224a190` の CI が実行中で未確定。全チェック・Codex・スレッドの確認後に Owner が merge 判断。E4b-ikura の着手は #615 merge 後 |
| B-2 | **ブロッカー** | **技法名・Dex 文言（UD-G）**: Owner 決定が未了。照合の結果、現行の仮文言は発見前の面に出ない前提で適合するが、最終文言は Owner のもの。AC-10 により E4b-ikura の merge 条件 |
| B-3 | 未決 | **Style Lock v2 に salmon-roe（と shiso / whitebait）を載せる更新が必要か**（現状は OD-B8-2 追記のみで、本文は 27 種のまま）。salmon・cream-cheese の `pieceVisual` 未実装により、ikura の意匠が混在する点の許容 |
| B-4 | 未決 | **実装 Issue の扱い**: Style Lock §7「実装 Issue は Owner が起票」。E4b-ikura を #611 / #527 の下で進めてよいか（新規 Issue は作らない方針に沿う） |
| B-5 | 要確認 | Q-2 の「Style Lock との照合」が Style Lock v2（アイコン）以外の文書を指すか。本書は Techniques SSOT / Anti-Oracle と照合した |
| B-6 | 要確認 | **#587 の修正**（出所を「#614 = Owner 確認が source of record」へ、`independentlyVerifiedNote` と「確認範囲」を整合）と、base の更新。`--check` の状態（#614 は通過、#587 は FAIL と記載）の食い違い |
| B-7 | 実測待ち | リング上限（Q-5）— E4b-ikura 内で実測し、結果を報告して Owner が判断 |

以上以外（Q-1〜Q-8）は確定済み。

## 14. Cooking Steps Phase 1 — 第 3 回（2026-10-22）

基準 `main` `d70bd20`。docs と Issue のみ。E4b の実装、#615・#584・#587 の変更、共有 Preview、本番 FINISH、PR 作成・merge は行っていない。Q-1〜Q-8 は再審議しない。

### 14.1 E4b-ikura 専用 Issue

- 起票: **#621** 「FIN-E4b-ikura: いくらとサーモンのピザを後乗せカタログへ追加（本番 OFF・後乗せ枠・Batch 8c の再設計）」
- 重複確認（起票前、open / closed 両方）: `E4b ikura salmon late catalog` / `いくら salmon-roe 専用 SVG 後乗せレシピ追加 late catalog data` で検索 → 該当なし。近い既存 Issue は #611（BBQ を含む TQ-2 / FIN-E4b の親）、#527（Batch 8 の追跡）、#604（TQ-2）で、いずれも親・追跡であり重複ではないと判断。
- 依存の記載: Depends-on #615、親 #611 / #294 / #604、追跡 #527、併存不可 #584、証跡 #614 / #587、前提 #517 系・#617。スコープ・AC・claim 案・ブロッカーも本文に記載。
- **未実施**: #611 / #527 / #615 へのコメント追記（外部への書き込みになるため、Owner の指示があるまで行っていない）。#527 の旧 claim（`01XFuM…`、2026-10-27 期限）が `ingredients.ts` / `ingredientTaxonomy.ts` / `recipeHintRoles.ts` / `catalogLedger.test.ts` / `__golden__` で #621 と重なる点は #621 に記載済み。

### 14.2 #615 Final Gate（読み取りのみ、確認時刻 2026-10-22 の本節作成時）

| 項目 | 状態 |
|---|---|
| 新 HEAD | `224a190`（#619 取り込み済みの main merge、base `d70bd20`）。差分は 10 ファイル / +758 −12 で範囲は不変 |
| 完了したチェック | build ✓ / layout-chromium ✓ / Layout Contract Gate ✓ / classify ✓ / webkit 390×844 shard 3/3 ✓ |
| **未完了** | webkit 360×800 shard 1・2・3、webkit 390×844 shard 1・2 が **in_progress**（開始 06:24Z）。集約の **WebKit Gate はまだ存在しない** |
| 失敗 | この時点で failure なし。ただし前 HEAD で赤だった `390×844 shard 1/3` は**まだ完了していない**（#619 の効果は未確定） |
| Codex | 前 HEAD `a122774` の receipt（指摘なし）のみ。**`224a190` へのレビュー依頼・receipt は見当たらない**。「前 HEAD の結果は流用しない」の規則どおり、現 HEAD の Codex は未取得 |
| レビュースレッド | 2 件とも解決済み（P2 の 2 指摘、`65cb952` / `a122774` で対応） |
| `mergeable_state` | `unstable`（チェック実行中のため） |
| 結論 | **Final Gate は未確定（GREEN と断定できない）。** 必要な残り: WebKit 5 shard の完了と集約 Gate、現 HEAD への `@codex review` と receipt。merge 判断は Owner。本書は rerun・コメント・push を行っていない |

### 14.3 技法名「後乗せ」と Dex 文言の正式候補

**整合性の確認（Techniques SSOT / Anti-Oracle / 実装の表示面）**

| 規則 | 出典 | 本件への含意 |
|---|---|---|
| 未発見の技法の名称・説明は出さない。Dex は「？？？」となぞかけまで（affordance が開いた後だけ） | INV-TQ-5、SSOT P6、`dexView.ts`（`RIDDLE` 状態は `riddleJa` のみ、`DISCOVERED` で `nameJa` / `descriptionJa`） | **名称「後乗せ」は発見前に一切出ない**ため、名称自体が時機を含んでも漏れない |
| 技法の発見は Free Cooking のラウンドのみ、RESULT の技法段で**名称だけ**を表示 | `TechniqueReveal.tsx` | 説明文は RESULT には出ない。説明文の露出面は Dex の発見済みカードのみ |
| 未発見技法の答えを Hint で売らない | OD-TQ-6 | ヒント・near-miss に文言を足さない（FIN-E2 §3.4: 本番 RESULT は中立 1 行のまま） |
| 発見のきっかけに ★ / Pitz を付けない | OD-TQ-7 | 影響なし |
| 「ない」を直接言わない／Notebook・保存に時機を載せない | INV-D7、#604 | 文言は時機を含む語を避ける |
| なぞかけは軸を**ぼかす**（前例: ピンサ「生地の仕立て方で」は軸の種類のみ、no-sauce は物の名前を出さない）。ただし tray は「四つの角まで生地を広げてみよう」と動作に踏み込んでおり、**一貫した前例ではない** | `techniques.ts` | 後乗せは **動作・時機・「あと／最後／仕上げ」を名指ししない** 方針（FIN-E2 の仮文言の趣旨）を採る |

**重要な指摘**: #611 §4 のドラフト「**香りは、焼けたあとで決まる。**」は**時機（焼けたあと）を名指し**しており、なぞかけ（発見前に Dex に出る）としては不適。「あつあつのうちに、ひとつまみ。」は動作（ひとつまみ=のせる）と熱を示すため、なぞかけには不適、**説明文（発見後）なら可**。→ #611 のドラフトはそのままなぞかけに使わない。

**正式候補（Owner が選ぶ。本書は決めない）**

| 項目 | 候補 | 内容 | 評価 |
|---|---|---|---|
| 技法名 | **N1（第一候補）** | 「後乗せ」 | 平易で他の技法名（ソースなし／天板焼き／ピンサ生地）と同じ体言止めの長さ。発見前は非表示のため漏れなし |
| | N2 | 「仕上げのせ」 | 時機を含む語を避けるが、「仕上げ」はゲーム内の FINISH タブ名と重なり、FINISH タブを見た時点で名前が推測される恐れ |
| 技法の説明（発見後のみ表示） | **D1（推奨）** | 「焼き上がったあとに、仕上げの具材をのせる調理法。香りや彩りが生きるよ。」 | 動作と時機を明示（発見後なので可）。香り・彩りは #611 の意図を踏襲 |
| | D2 | 「焼き上がりのあとに仕上げる調理法」（現行の仮文言） | 最小。他の説明文より短く、動作が曖昧 |
| | D3 | 「あつあつのうちに、ひとつまみ。焼いたあとにのせる調理法。」 | #611 のドラフトの一部を流用。やや詩的で、他の説明文と調子が異なる |
| なぞかけ（affordance 後・発見前に Dex に表示） | **R1（推奨）** | 「同じ材料でも、ひと手間の加え方で違う一枚になることがあるよ。」（現行の仮文言） | 動作・時機を名指ししない。ピンサのなぞかけと同形で、他技法との調子も揃う。**変更なし** |
| | R2 | 「材料は同じでも、ふしぎと別の一枚になることがあるよ。」 | 軸への言及を最小化（最も保守的）。ただし他技法の axis-hint との一貫性は落ちる |
| | R3 | 「いつもの手順に、もうひと手間くわえてみよう。」 | 「手順」が順序を示唆する余地があるため非推奨 |
| 避ける語 | — | 「焼成」「焼いた」「あと」「最後」「仕上げ」「のせる」「タイミング」「順番」をなぞかけに入れない | 時機・動作・軸の名指し |

**確認の追加項目（E4b の AC-6 / AC-10 に紐づく）**
1. なぞかけ R1 がピンサの現行文と**重複しない**こと（先頭 11 文字が同じ「同じ具材でも…／同じ材料でも…」で、語頭が似る。**具材 vs 材料**の差だけ）。紛らわしければ R2 を選ぶ判断材料。
2. 説明文が出るのは Dex の DISCOVERED カードのみで、RESULT / ヒント / Notebook / 保存に出ないことをテストで固定。
3. `late-addition` の affordance が ladder から導出され、後乗せレシピ（ikura）の素材が全て解放されるまで RIDDLE も出ないこと。
4. 技法名の語（「後乗せ」）を含む **family 名・カテゴリ名を作らない**（H3 / H4）。

### 14.4 ビジュアル実装状況の監査（main `d70bd20`、#584 ブランチは読み取りのみ）

| 食材 | main の状態 | Style Lock v2 の位置づけ | ピザ上（pre / post の別） | 備考 |
|---|---|---|---|---|
| **salmon-roe** | **main に存在しない**（食材も visual も無い）。#584 ブランチにのみ: `pieceVisual:"salmon-roe-grains"`（64×64 SVG、`id=` / `url(#` / `<defs>` / gradient なし → 規約に適合、2 トーン、接地影）、`App.css` の補正規則に追記、参照 SVG `salmon-roe.svg`、emoji 🟠（非表示のフォールバック） | **対象外**（27 種に無い）。OD-B8-2 追記（2026-10-20）で専用絵を認可 | 後乗せ: `PostBakePiece` → `IngredientPieceVisual`（焼成スタイルなし）で SVG | 橙 `#f2842b` の粒。**サーモン（`#f08a6c`）と色が近い**（下記） |
| **shiso** | main に実装済み（`pieceVisual:"shiso-leaf"`、emoji 🍂 は非表示フォールバック、`App.css:823` で補正、参照 SVG `shiso.svg` が main にある） | **対象外**（Batch 8b、OD-B8-2 追記） | 通常: 焼成スタイルあり。ikura では**後乗せ**（未焼成の見た目） | 同じ食材が shirasu では焼成前、ikura では焼成後に使われる（識別は late 軸） |
| **whitebait** | main に実装済み（`pieceVisual:"whitebait-school"`、emoji ⚪、同補正規則） | **対象外**（Batch 8b） | 焼成前（shirasu のみ） | ikura では使わない。表示整合の比較対象 |
| **salmon** | `emoji 🍣`（寿司絵文字）、`pieceVisual` なし、`scatter` | **対象（A 採用、`salmon.svg` 確定済み）だが未実装**。Pilot 割当なし（§5「残り 17 種は未定」） | 焼成前 | 絵文字が「にぎり寿司」でレシピの文脈（ピザの具材）とずれる。**ikura で最も目立つ食材の 1 つが未移行のまま** |
| **cream-cheese** | `category:"cheese"`、`pieceVisual` なし → CSS の `.pizza-cheese--cream-cheese`（`--cheese-color #fbf7ec`）、トレイ等は emoji 🧀 | **対象（A 採用、`cream-cheese.svg` 確定済み）だが未実装**。Pilot 割当なし | 焼成前 | 現状は他の未移行チーズと同じ CSS 形状。Style Lock §4.4: `pieceVisual` を持たないチーズは CSS 維持 |

**表示整合性の所見（ikura の 1 皿を構成する 4 食材）**
1. **意匠の混在**: roe・shiso は専用 SVG（64×64、輪郭＋ハイライト）、salmon は絵文字（🍣）、cream-cheese は CSS 形状。同じ皿で描画方式が 3 種類になる（Style Lock の「全部 SVG に揃える」目標とは異なる中間状態。26 種のうち 17 種が未実装なので、他の既存レシピでも同様の混在は既にある）。
2. **色の近接**: roe `#f2842b` と salmon `#f08a6c`、さらに焼けた生地（#584 の測定: 明度コントラスト約 1.0:1「橙 on 橙」）。後乗せの roe は**焼成フィルターの外で未焼成の見た目**になるため、焼けた生地・焼成済みサーモンに対する見え方は #584 の測定値と異なる → AC-8 の再測定が必須。
3. **サーモンの絵文字**: 🍣 は米つきの寿司で、後乗せの roe と並ぶと「寿司ネタの寄せ集め」に見える懸念（主観的判断。実機で要確認）。
4. **後乗せ層の描画経路**: 後乗せは常に `PostBakePiece`（`IngredientPieceVisual` を style なしで呼ぶ）で、焼成の `toppingPieceStyle` / チーズ melt が届かない設計。shiso を焼成前と後乗せで使い分けるレシピ（shirasu / ikura）は、**同じ食材が焼成の有無で見え方が違う**ことを意味する（意図どおり）。
5. **サイズ補正**: shiso / whitebait / salmon-roe の 3 visual は `App.css:823` 付近の 1.2em 補正を共有（roe は #584 側で追記）。後乗せ層・RESULT での縮尺（#514 の `phaseScale`）の見え方は未測定。

### 14.5 Style Lock v2 追補の必要範囲（提案。本書は Style Lock を編集していない）

Style Lock v2 は**食材ビジュアル**の authority（技法名・Dex 文言は適用外 — §13.4 B-5 の確認結果を踏襲）。追補が必要かを項目別に整理する。

| # | 追補候補 | 必要性 | 内容 |
|---|---|---|---|
| SL-1 | **Status / 実装状況の更新** | 高（現状と食い違う） | ヘッダの「実装は未着手」「Production 実装は #423 完了まで禁止」は陳腐化。Pilot A（feta / ricotta / hot-dog / sausage）と Batch 8b（shiso-leaf / whitebait-school）は実装済み、#423 は closed（PR #430）。実装済み visual の一覧表を追加 |
| SL-2 | **対象の追記: Batch 8 の専用 visual** | 高（E4b-ikura の前提） | `shiso-leaf` / `whitebait-school` / `salmon-roe-grains` を「Lock 由来ではなく OD-B8-2 追記で認可された専用 visual」として §1 系に明記。参照 SVG のパス（`shiso.svg`・`whitebait.svg` は main、`salmon-roe.svg` は #584 のみ → **E4b-ikura で main に入れる**）。§2 の共通仕様への適合確認（roe は適合）を記録 |
| SL-3 | **後乗せ層（post-bake）の描画ルール** | 高（新しい表示面） | 後乗せ piece は焼成スタイルなし・`.pizza-post-layer`・CUT 線より後ろ。§4.2-3「接地影のピザ上での見え方」「コントラスト測定」を **pre / post の 2 面**に分けて測定項目化。roe の 3 状態（raw / perfect / burnt）の再測定を必須とする |
| SL-4 | **同一皿での混在の扱い** | 中（Owner 判断） | 未実装 17 種（salmon・cream-cheese を含む）と専用 visual が同じ皿に並ぶことの許容方針。選択肢: (a) E4b では許容（混在のまま）、(b) salmon・cream-cheese の `pieceVisual` 実装を先行 Pilot にする、(c) ikura の E5 前までに実装。Pilot B / C は別対象で、17 種の割当は Owner が決める（§5） |
| SL-5 | **既定サイズ補正と G18** | 低 | 補正規則（1.2em）を visual 単位で管理する方針の明文化。G18（グリフ一意性）の維持を確認（roe 🟠 は一意とされている — #584 の記載）。実装 PR の AC に既存 gate で担保 |
| SL-6 | **HV 要件の延期の明記** | 中 | §6「UI 変更は HV を完了条件に含む」に対し、**本番 OFF の間は延期し、E5 前に必須**（Q-8）という例外を、E4b の PR 本文と Style Lock の運用注記に残す |
| SL-7 | テスト規約の更新 | 中 | §6 の `IngredientGlyph.test.tsx` の dedicated 集合に、Batch 8b（shiso / whitebait）は追加済み。**salmon-roe を追加**（E4b）。「emoji 行 DOM 完全一致」は salmon-roe が dedicated になる分だけ集合が変わる |
| SL-8 | Style Lock 本体の編集権限 | — | docs-only PR で行う（§7）。Owner が追補 PR を許可するまで編集しない。E4b-ikura の実装 PR に混ぜない（AC-12） |

追補の最小セットは **SL-1・SL-2・SL-3・SL-6**。SL-4 は Owner の判断後に追加。追補は E4b-ikura の merge 前に別の docs-only PR で行うのが望ましいが、必須とするかは Owner 判断（§14.8 O-3）。

### 14.6 #587 の矛盾箇所と修正方針（#614 の Owner 確認を優先）

**Source-of-record の方針（案）**: 後乗せ（いくら・大葉）の根拠は **#614（Owner 確認、2026-10-21）を source of record**とし、#587（ChatGPT 取得、2026-10-20）は**補足の取得記録**として位置づける。

| # | #587 の箇所 | 矛盾・問題 | 修正方針（#587 の担当 session / Owner が実施。本書は編集しない） |
|---|---|---|---|
| C-1 | JSON `independentlyVerifiedNote`: 「…it is NOT an Owner confirmation」 | #614 の「Owner 確認 2026-10-21」と**逆の主張** | 「Owner 確認は #614（matrix 訂正）に記録。本ブロックは ChatGPT が 2026-10-20 に取得した補足記録で、Claude Code は独立再取得していない」へ書き換える。`independentlyVerified` の意味（Claude Code の再取得の有無）は維持 |
| C-2 | 報告書「確認範囲」の「Owner 本人の確認ではない」 | 同上 | 「source of record は #614。ここは補足」と明記。Owner 確認の日付（10-21）と取得日（10-20）の差は、**別の出来事として併記**し、順序を断定しない |
| C-3 | 日付（`retrievedOn` 2026-10-20 vs #614 の 2026-10-21） | 同一事象かが不明 | 「別日付の 2 件の記録」として扱い、同一視しない。Owner が同一事象か別事象かを示せる場合のみ統合 |
| C-4 | 「サーモンは両方式の記載」（要約） | #614 は「十分に加熱し」のみ。粒度が違う | 両者の記述を並記し、「後乗せではない」という共通点を結論に。Q-1 で焼成前は**暫定**であることを追記 |
| C-5 | 「再開時の ladder step は main で採番（55 固定しない）」 | OD-P1-4 は「後乗せ枠で導出」。「main で採番」は通常枠を連想させる | 「後乗せ枠で導出（絶対番号に固定しない）」へ |
| C-6 | `gameDesignValues.currentGameTiming`: 全食材焼成前 | #584（HOLD）の現状としては正しい。E4b-ikura で roe・shiso が後乗せになる点が未反映 | 「現行 #584 は全食材焼成前（HOLD）。設計では roe・shiso を後乗せ（E4b-ikura、#621）」と追記 |
| C-7 | PR 本文: `progression2_mechanic_matrix.py --check` が main でも FAIL（#260）と記載 | #614 は `--check` / `--check-runtime` 通過と記載 | **再実行して現状を記録**（#614 merge 後の main で通るなら、#587 の記述を更新）。本書は再実行していない |
| C-8 | base `5997157`（古い）、`mergeable_state` 不明 | 現 main との差が大きい（160 ファイル規模） | main を取り込み、JSON / matrix の差分が #587 の 2 行追加と報告書に限られることを再確認 |
| C-9 | `TETO_PIZZADB_TIMING-AUDIT_shipped.md`（#614 で main に入った）が「`shirasu-pizza` は #587 に部分証跡あり」と参照 | #587 が未 merge／クローズだと参照が宙に浮く | #587 の扱いを決めるときに、この参照の更新（または #587 の merge）を同時に判断 |

**選択肢（Owner 向け）**: A) C-1〜C-8 を直して merge（出所を #614 優先で整合）。B) #587 を閉じ、必要な引用（「いくらと大葉は焼成後に載せ」、shirasu の 2 引用）だけを #614 系の docs に統合。C) 保留。E4b-ikura は #587 を**待たない**（#614 が main にある）。ただし Result Report の根拠表記は上記の source-of-record 方針に従う。

### 14.7 E4b-ikura への反映（#621 の AC への追加）

| 追加・修正 | 内容 |
|---|---|
| AC-6 | 説明文の露出面は Dex の発見済みカードのみ（§14.3）。ikura の素材が全解放されるまで RIDDLE が出ない |
| AC-8 | roe を**後乗せ層**で 3 状態再測定。色近接（roe vs salmon）と🍣絵文字の見え方を実機の比較で確認（E5 前の動画で Owner 判断） |
| AC-12 | Style Lock 追補（§14.5 SL-1/2/3/6）は E4b と別の docs PR。SL-4 の判断を PR 本文に記録 |
| Result Report | 根拠表記は §14.6 の source-of-record 方針（#614 優先）に従う |

### 14.8 Owner の追加判断が必要な事項

| # | 判断 | 推奨（助言） |
|---|---|---|
| O-1 | **技法の正式文言**: 名称 N1「後乗せ」／説明 D1／なぞかけ R1（現行維持）でよいか。R1 とピンサのなぞかけの語頭の近さ（具材 vs 材料）を許容するか、R2 にするか | N1・D1・R1。紛らわしければ R2 |
| O-2 | **ikura の食材意匠の混在**（salmon=🍣 絵文字、cream-cheese=CSS、roe・shiso=専用 SVG）を E4b では許容するか。salmon・cream-cheese の `pieceVisual` を先行させるか | E4b では許容（E5 前の実機動画で判断）。salmon の🍣は優先度高めで Pilot 化を検討 |
| O-3 | **Style Lock 追補**を E4b の前提にするか（SL-1/2/3/6 の docs PR）。実施するなら許可 | 追補 PR は E4b と並行可。merge 条件にはしない |
| O-4 | **#587** の扱い（§14.6 の A / B / C）と、その修正を担当する session の指定 | A（出所を #614 優先に直して merge） |
| O-5 | #621 への**依存関係コメント**を #611 / #527 / #615 に追記してよいか（外部書き込みのため未実施） | 承認（#611 と #527 のみ。#615 はコードに触れないコメントでも Owner の指示を待つ） |

**ブロッカー（変わらず）**: #615 の Final Gate（WebKit 5 shard 実行中・Codex 現 HEAD 未取得）。E4b 着手は #615 merge 後。
