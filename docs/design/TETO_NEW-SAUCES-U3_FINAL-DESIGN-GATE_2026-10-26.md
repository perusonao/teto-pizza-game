# 新ソース U3（ナスとタヒニのピザ）— Final Design Gate（S1 / S2 比較、docs-only）

Status: **設計と調査のみ。実装コードは変更していない。** `src/**`・`e2e/**`・CSS・テスト・データ・golden・workflow・本番スイッチ・共有 Preview・Production・Firebase は無変更。
基準 `main` = `f661767d634ac53d71a1a1b0f1aa8954b76eaddf`（2026-10-26）。追跡: #578（U3 専用の Issue は無い。重複を作らず #578 に紐づける）。
**「推奨」「案」は助言であり Owner Decision ではない。未回答を承認済みとみなさない。原典（pizzadb.jp）はこの環境から到達できず、U3 の工程・タイミング・個数・焼成窓は全て未確認。**
Owner 方針（2026-10-26）: **タヒニは焼成前 PAINT を暫定の基準とするが、正式採用しない。ザクロは焼成前・焼成後の両案を維持する。**
方法: 検証は `f661767` の `git archive` を隔離ディレクトリに展開し、ローカルで `vitest` を実行した（CI の再実行ではない）。U3 の仮データ（食材・レシピ・ladder step・taxonomy 行・ソース profile のみ）を隔離コピーに足して既存テストを**そのまま**実行し、gate の緩和・テストの変更・family の都合のよい変更はしていない。

## 0. Gate の判定

| # | 項目 | 判定 | 要旨 |
|---|---|---|---|
| G1 | S1（ザクロ焼成前・通常カタログ） | **技術的に可 / 着手は HOLD** | privacy gate は通過。件数 pin の更新が要る（§5）。Owner 決定と原典が先 |
| G2 | S2（ザクロ焼成後・late catalog） | **技術的に可 / 着手は HOLD** | 同上。加えて技法 allow-list の更新（U1・U2 と同じ手順）が要る |
| G3 | S3（タヒニを焼成後にかける） | **不可（保留）** | FINISH はトッピング専用。ソースの後乗せは #579 が前提（§3） |
| G4 | ラダー・到達性 | **PASS** | S1・S2 とも ★1 61/63、★2 63/63、slack 1（§4） |
| G5 | 視認性 | **HOLD** | 仮のタヒニ色が生地と同化する（§6）。実機 HV が必須 |
| G6 | 原典 | **HOLD** | T-1〜T-7 が全て未確認（§8） |

**総合: HOLD。** S1・S2 はどちらも実装可能であることを確認した。選択は Owner 決定（ザクロの時機）と原典確認（またはその暫定承認）に依存する。

## 1. 前提（実コードと既存決定）

- 4 材料: tahini（新ソース）、eggplant（既存、step 4）、parsley（既存、step 27）、pomegranate（新トッピング）。**チーズなし**。工程は DOUGH → SAUCE → TOPPING → BAKE（S2 は FINISH が加わる）。
- ソースの契約: `category: "sauce"`、`placement: "spread"`、既存の PAINT。`RecipeSauceProfile.ingredientId` の union に `tahini` を追加する。ソースに taxonomy の family は付けない。
- 暫定採用済み（Owner、2026-10-25、#578 のコメント）: ザクロ SVG 案 A'（涙形を強調した種の小山）、サイズ区分 `xs`、family `fruit`、色（実 `#c4163f` / 輪郭 `#650d27` / 暗部 `#a50f33` / ハイライト `#ef5b79` + 白）。置き場はブランチ `claude/pomegranate-drawing-research-c4piy8`（`854f810`、PR なし）の `docs/design/candidates/pomegranate-u3/`。案 A・案 B は比較用に保持。
- U2（ナス田楽、#669）は main に merge 済み。「U3 は U2 の merge 後に最新 main へ追従して実装する」の前提は満たされた。U3 の claim は未投稿。#578 の U1・U2 の claim は期限（11/1）内で release の記録が無い。着手時に確認する。

## 2. S1 / S2 比較（ザクロの時機。タヒニは両案とも焼成前 PAINT を暫定基準とする）

| 項目 | **S1**: ザクロ（とパセリ）が焼成前 | **S2**: ザクロが焼成後（FINISH） |
|---|---|---|
| カタログ | 通常カタログ（`ingredients.ts`・`recipes.ts`・`discoveryLadder.ts` の追記） | late catalog（`lateCatalog.ts`）。POST_BAKE 要件が 1 つ以上必須（`validateLateCatalog`） |
| ラダー | 通常 step 57 に `[tahini, pomegranate]`。late の roe・yuzu・miso+sesame は 58・59・60 に繰り下がる（導出）。既存セーブは `LATE_ENTITLEMENT_FLOORS`（57 / 58 / 59 / 59）で保護 | late step 60 に `[tahini, pomegranate]`。`LATE_ENTITLEMENT_FLOORS` に tahini と pomegranate の 60 を追加（規則: 出荷時に導出される番号） |
| 到達性（隔離コピー実測） | ★1: 61/63、到達不能は californiaとspinach-artichoke の 2 件（星ゲート直接）。★2: 63/63。★3: 63/63。slack 1。閉じる step なし | 同左 |
| ステップ数・カウント | recipes 69 / ingredients 75 / ladder 60 | 同左 |
| 工程タブ | DOUGH・SAUCE・TOPPING・BAKE | 上記に FINISH（6 タブ以内）。Free Cooking は FINISH を常設 |
| Lunch Rush / Dinner | 通常レシピ。除外するなら `lunchRush:false` を明示（Owner 判断） | 必須（`lunchRush:false`。FINISH は Lunch Rush・Dinner で使えない） |
| 章（Dex の章） | 通常レシピとして章に算入（章の件数・分母が変わる） | K2 により後乗せカタログのレシピは章の完了判定の分母から除外 |
| 技法 | 技法なし（ソースあり・生地は標準・後乗せなし） | 「後乗せ」（`late-addition`）。affordance は ikura 由来で既に開く時点がある（リドルは固定文字列。D3 の漏えい防止テストを U3 でも通す） |
| Research のコホート | `[tahini, pomegranate]` の最後に所持する材料が鍵。単独レシピで文字なし。**既存のコホート文字は動かない** | 同左 |
| 描画の確認面 | 焼成フィルタ越し（ザクロが焼けて褐色化・暗色化しないか。`bakeRoastResistant` の要否を確認） | 焼成前の見た目と後乗せの 2 面（Style Lock §10.4）。焼成フィルタ外 |
| DH4（隔離コピー実測） | privacy gate 14/14 通過。`deductionGuard.gate` の件数 pin のみ 165 → **132** に動く | privacy 系は通過。技法 allow-list の pin が失敗（後乗せ要件のレシピは allow-list への追記が必要。U1・U2 の手順） + 件数 pin 165 → 132 |
| 追加で必要な表 | `ingredientTaxonomy`（pomegranate = fruit）、`toppingSizeClass`（xs）、`recipeSauceProfiles`、`recipeHintRoles`、`orders`、`discoveryCatalog` target、`referencePizza`、golden、テストの件数 pin | `lateCatalog.ts` の `LATE_INGREDIENTS`・`LATE_TAXONOMY_ROWS`・`LATE_TOPPING_SIZE_CLASS`・`LATE_DISCOVERY_TARGET_IDS`・`LATE_LADDER_STEPS`・orders、`techniqueAllowlists`、`recipeSauceProfiles`、`recipeHintRoles`、`referencePizza`、golden |
| HOT ファイル | `recipes.ts`・`discoveryLadder.ts`・`ingredients.ts`・hint5 golden | `lateCatalog.ts`・`IngredientGlyph.tsx`・`App.css`（U1・U2 で実績あり） |
| 実績 | ikura 以外の通常レシピ追加（#634・#649） | ikura・yuzu・dengaku・Pinsa |
| 原典との整合 | ザクロが焼成後なら乖離 | ザクロが焼成前なら乖離 |

**評価.** 技術的な難易度に大差はない。S2 は late catalog の実績が新しく、確認面（未焼成の見た目）が増える。S1 は通常カタログで、ラダーの番号が late 側にずれるが floors で保護される。**時機は原典（T-4）で決まる事柄であり、ここで推奨を固定しない。**

## 3. タヒニの役割（OD-U0-5。焼成前 PAINT は暫定基準、正式採用ではない）

| 案 | 内容 | 状態 |
|---|---|---|
| **PAINT（焼成前に塗る）** | 既存の PAINT。新しい操作・工程なし。U1（柚子胡椒）・U2（味噌だれ）と同じ型 | **暫定基準**（Owner、2026-10-26）。原典未確認のため正式採用しない。PIZZA DB のソース欄は「その他」で、matrix の `taxonomyNote` は「タヒニは topping/drizzle としてソース欄の記載どおり」とだけ書く |
| FINISH でかける | ソースの後乗せ（DRIZZLE 候補） | **不可**。`PLACE_TOPPING` は FINISH でトッピングのみ許可し、ソース・チーズの後乗せは未対応（#579 が open）。原典が「焼成後にかける」と確認された場合は再分類（OD-B9-16 と同じ扱い） |

暫定仕様を採る場合は、U1・U2 と同様にレシピ定義のコメントで「ゲーム独自の暫定仕様、原典未確認」と明記する（Owner の承認が前提）。

## 4. ラダー影響の詳細

- 現状: 68 レシピ・59 step・credited 62・slack 1。U3 は credited で専用の step を持つため slack は変わらない（S1・S2 とも 61/63・63/63）。
- 星ゲートの値は不変（goat-cheese ★120 / spinach ★130）。★1 では引き続き 2 レシピが閉じる（#420 の意図）。
- S1 では late の derived step 番号が +1 される。`salmon-roe` の floor 57・`yuzu-kosho` の 58・`miso-sauce`/`white-sesame` の 59 は固定値のため、E5 後に一度も起動していない既存セーブも後退しない（U0 Gate §3、#660）。
- `[tahini, pomegranate]` の並び順がコホート鍵を決める（最後の材料）。単独レシピなので文字は付かない。
- T4 tier（初回 120 Pitz / 補充 60）・星ゲートなしは U1・U2 の前例。Owner の再確認が要る。

## 5. DH4 / Anti-Oracle の実測結果

隔離コピー（`f661767`）に tahini（sauce）・pomegranate（topping、family `fruit`）・レシピ・ladder step・profile を足した結果:

| 構成 | `deductionProduction.gate`（privacy） | `deductionGuard.gate` | 備考 |
|---|---|---|---|
| ベースライン（U3 なし） | 14/14 | 16/16（件数 pin 165） | - |
| S1 | **14/14 通過** | 15/16。件数 pin が 165 → **132** | pin は旧 DH4-2A の件数で、privacy の合否ではない（硬化した guard の漏えいは 0）。OD-B9-15 により原因分解して更新する（gate は緩和しない） |
| S2（POST_BAKE を付けた近似） | privacy 系は通過。**技法 allow-list の pin が失敗** | 15/16。同じ pin 変化 | U1・U2 は allow-list に追記して通した（privacy assertion は緩めていない） |

- ザクロは「その他」家族（egg / almond / pine-nuts）に入らない。`fruit` の既存メンバーは pineapple と lemon（k≥2 のガードを満たす）。
- 限界: ladder の位置を近似した（S2 は通常 step の末尾に追加）。実装時に実際のカタログ構成で再測定する。全体の Vitest・tsc・E2E は未実行。

## 6. タヒニの視認性改善案

**問題.** 仮色 `#dcc7a1` は生地と同化する。CIE76 の ΔE 概算（生地: 未焼成 `#f3d9a4`、焼成後 `#e2b876`）:

| 候補（仮） | 未焼成生地との ΔE | 焼成後生地との ΔE | 薄塗り（α0.46）の焼成後との ΔE | 最も近い既存ソース |
|---|---|---|---|---|
| `#dcc7a1`（現在の仮定） | 10.1 | 18.6 | 8.8 | オリーブ油 11.1 |
| `#c9ae82` | 15.7 | 14.2 | 6.9 | オリーブ油 16.1 |
| `#bfa07a`（灰褐） | 21.1 | 17.7 | 8.1 | オリーブ油 21.8 |
| `#b89a6e` | 22.7 | 16.9 | 7.6 | オリーブ油 23.0 |
| `#a58a63`（濃い灰褐） | 29.2 | 23.2 | 10.4 | 味噌だれ 25.0 |
| `#d8cdb4`（淡灰） | 16.5 | 26.9 | 12.8 | オリーブ油 17.0 |

参考: 既存の柚子胡椒は生地との ΔE 30.8 / 26.0、味噌だれは 47.8 / 35.5、ペストは 43.8 / 39.8、フロマージュブランは 29.3 / 43.3。

- 仮色は既存の全ソースのうち生地との差が最も小さく、**オリーブ油ともほぼ区別できない**（ΔE 11.1）。
- 候補としては、より濃く灰みのある褐色（`#a58a63` 付近）が、生地との差とオリーブ油・味噌だれとの区別を両立する。実際のタヒニの色（淡いベージュから灰褐色）の範囲に収まる。
- ΔE は概算（sRGB → CIELAB の簡易計算、焼成の色変化と heatmap の合成は近似）。**実機 HV での判断が前提。**

**色以外の案（いずれも未検証で、実装コードを読んで可否を確認する必要がある）.**

| 案 | 内容 | 懸念 |
|---|---|---|
| トレイのチップ | 色のほかに識別しやすい絵文字・ラベルを使う | G18（絵文字の一意性）。食材の見た目と塗りの見え方は別問題 |
| 焼成での色変化 | オリーブ油のように、焼成で色が変わる（`PAINT_TEMPORARY`）扱いにする | オリーブ油だけが特例で、描画コードの複数箇所に特別扱いがある。新しい特例を増やすことになる |
| 塗りの濃さ | 薄塗りでも見える下限を設ける | Scoring 2.0 の Sauce 成分・見本との整合に触れる。範囲外 |
| 見本・見せ方 | 塗る対象のガイド（目標リング）を強調する | 他のソースと共通の表示で、タヒニだけの変更は不整合 |

**結論.** 最小で安全なのは「色を濃い灰褐に寄せる」案。色の確定は Owner の実機 HV（生地上・焼成前後・RESULT・オリーブ油との並び）で行う。形の変更は不要。

## 7. ザクロの描画（案 A' を参考にする）

- 案 A' は 64×64、`id`・gradient・`<defs>` なしで Style Lock v2 の共通仕様に沿った作り。サイズ `xs`、family `fruit`。
- 実機で確認する項目（暫定採用の記録 §3 を踏襲）: 18px（RESULT 相当）・24px（xs の配置）でのイクラとの区別 / 赤いトマトソース上での視認性 / 赤系（トマトスライス、さくらんぼ）との取り違え / 白ごまとの並び / 粒が潰れて赤い塊に見えないか。
- 色の事実: 実色 `#c4163f` とトマト `#c73b2e` の ΔE は 18.4 と小さい。ただし U3 のレシピにトマトソースは入らない。焼成後の生地との ΔE は約 69、イクラ `#f2842b` とは約 53。
- S2 では未焼成の見た目と後乗せの 2 面、S1 では焼成フィルタ越しの見え方（赤が褐色化しないか）を確認する。
- 実装 PR の範囲: 食材の追加、`IngredientGlyph.tsx` の描画、`App.css` の個別補正（1.2em 方式）、`toppingSizeClass`、`ingredientTaxonomy`、Style Lock への追記（暫定採用は Style Lock への正式追加ではない）。
- `pieceVisual` 名（案: `pomegranate-aril`）と、必須の文字フォールバック emoji は未決（🍇 は G18 で使えない）。
- ザクロは存在しない食材なので、**描画だけの PR にはできない**（#663・#667 は既存の食材の描画差し替えだった）。

## 8. 原典未確認事項（Owner が確認または暫定承認する）

| # | 項目 | 影響する判断 |
|---|---|---|
| T-1 | 個別ページの URL（比較表 p5 のみ） | 証跡の出典 |
| T-2 | タヒニは塗るか、焼成後にかけるか | PAINT か、ソース後乗せ（保留）か |
| T-3 | ナスは事前に焼く・揚げる・炒めるか | 通常の工程か、下ごしらえ工程か（現在は未モデル化。暫定は「事前加熱なし」） |
| T-4 | ザクロ（種）を載せる時機 | S1 か S2 か |
| T-5 | パセリを載せる時機 | 同上（暫定は焼成前） |
| T-6 | チーズが本当に無いか | 識別集合・工程（CHEESE の有無） |
| T-7 | 個数・オーブン温度・焼成時間 | GAMEPLAY CALIBRATION の根拠（暫定: 焼成窓 58–78 = Free Cooking と同値） |

pizzadb.jp は本環境から到達不可。U1・U2 と同様、Owner が承認した暫定仕様としてレシピ定義に明記する場合に限り、原典未確認のまま進められる。

## 9. Owner 決定項目

| ID | 決定 | 現状 |
|---|---|---|
| OD-U3-1 | ザクロの時機: S1 か S2（両案維持） | 未決。原典 T-4 次第 |
| OD-U3-2 | タヒニの役割: PAINT を正式採用するか | 暫定基準のみ。正式採用は原典 T-2 の後 |
| OD-U3-3 | パセリの時機 | 未決（暫定: 焼成前） |
| OD-U3-4 | ナスの事前加熱を「なし」の暫定仕様にするか | 未決（U2 は同じ扱い） |
| OD-U3-5 | ザクロの family `fruit`・サイズ `xs`・色・`pieceVisual` 名・emoji・SVG 案 A' の最終 | 暫定。実機 HV で確定 |
| OD-U3-6 | タヒニの色と視認性対策（§6） | 未決。仮色は不十分と判断される見込み |
| OD-U3-7 | 個数・焼成窓・CUT の有無・Lunch Rush（S1 の場合） | 未決（暫定値は提案のみ） |
| OD-U3-8 | ラダー: T4・星ゲートなし | U1・U2 の前例。再確認 |
| OD-U3-9 | 原典未確認のまま暫定仕様で進めるか、確認を待つか | 未決 |
| OD-U3-10 | `deductionGuard.gate` の件数 pin 更新（165 → 132 の原因分解）を許可するか | OD-B9-15 の方式の再確認 |
| OD-U3-11 | #578 の U1・U2 の claim の扱いと、U3 の claim 投稿 | 着手前 |

## 10. 実装に進む場合の PR 案（承認後。いずれも未着手）

| PR | 内容 | 前提 |
|---|---|---|
| U3-1 | S1 または S2 のデータ実装（食材 2・レシピ 1・ladder step・表・テスト・golden・ザクロ SVG・Style Lock 追記）。`TETO_NEW-SAUCES-U3_Result.md` | OD-U3-1〜11、claim、U1・U2 の claim 整理 |
| U3-2（任意） | タヒニの色の調整（`color` のみの PR。#665 の前例） | 実機 HV の結果 |

merge = 即公開のため、Owner の実機 HV と最終承認まで merge しない（U1・U2 と同じ）。公開ゲートは新設しない案（U1・U2 の前例）。

## 11. 重複確認（2026-10-26）

- U3・タヒニ・ザクロを扱う open の PR/Issue は無い。
- #578 のコメント（10/25 14:41 まで）に U3 の実装 claim は無い。ザクロ描画は暫定採用の記録のみ。
- 関連の既存文書: `TETO_NEW-SAUCES-B_U0-GATE_2026-10-25.md`（OD-U0-4・OD-U0-5、DH4 事前評価）、`TETO_NEW-SAUCES-B_SOURCE-TIMING-EVIDENCE_TEMPLATE.md`（T-1〜T-7）、`TETO_NEW-SAUCES-U2_Result.md`。
- U0 Gate の「late step 57」「3 レシピ未実装」は古い（U1・U2 出荷済み。`TETO_STATE-SYNC_2026-10-26.md` §5 を参照）。

## 12. 触れていないもの

`src/**`、`e2e/**`、CSS、テスト、golden、データ、workflow、本番スイッチ、`PROJECT_HANDOFF.md`、#650 の 4 ファイル、Batch-9 決定記録、U0 Gate 文書、共有 Preview、Production、Firebase、保存データ、#666 とその HV。Issue/PR へのコメント投稿・クローズ、CI の再実行、Codex の再依頼、Monitor の作成はしていない。
