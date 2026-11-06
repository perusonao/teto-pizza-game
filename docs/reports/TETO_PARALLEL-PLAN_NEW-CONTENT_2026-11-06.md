# 新食材・新レシピ・新調理方法 — 6 セッション並列開発計画（docs-only・Owner 承認待ち）

**種類:** docs-only。`src/`・`e2e/`・CSS・JSON・SVG・テストは変更していません。PR 作成・merge・Production ON・共有 Preview 更新・既存 PR への push・Issue／claim の作成は行っていません（必要なものは §8 で Owner 承認を求めます）。
**基準:** `origin/main` = `3a41bb6`（#769、Batch 19 Prep Rev 5 取り込み）。Audit 日 2026-11-06。ブランチ `claude/teto-pizza-parallel-plan-sh894e`。
**限界:** 件数は `src/data` の静的抽出（近似）。172 マトリクス（`docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`）は一部の出荷済み id を別名で取りこぼします。**候補一覧は S2 が再生成してから確定**します。Jaccard（0.4）・Research ラベル・Hint 実測は未実施。open Issue 118 件のうち claim を全文確認したのは #726・#748・#749・#764・#758 のみ（§2）。

---

## 1. 目標と現在地

| 指標 | 目標 | 現在（baseline、本計画の起点） |
|---|---|---|
| 追加食材数 | 8 | **0**（Batch 19 の burrata が最初。未着手・Owner GO 待ち） |
| 追加レシピ数 | 20 | **0**（Batch 18 まで merge 済みは起点より前） |
| 追加調理方法数 | 2 | **0**（STEAM は Preview/DEV 限定・本番 OFF、FRY は F1 の純粋ロジックのみ、炙りは本番 OFF #727） |
| 実装中 | — | #738（STEAM S3 UI、open）、#755 系 Draft 4 本（#756/#757/#762/#763）、#749 FRY（claim 有効）、#753/#751（docs） |
| HOLD | — | Batch 19 実装（Owner の明示 GO 待ち）、#540 Grandma、#762、#765 系 |
| merge 済み（baseline） | — | recipes 約 90（credited 79）、Batch 18 まで |

**品質ガード（数を満たすための劣化は認めない）:** Jaccard 0.4・同一／部分／上位集合禁止、Research ラベル全数監査、Hint 実測（AC-8/8b）、通常 ladder 凍結、HV ポリシー。**8/20/2 に届かない場合は届かないと報告します。**

## 2. Fresh Audit の要点

### 2.1 既存 claim（尊重・奪わない）

| Issue／PR | 担当 session | files（抜粋） | 期限 | 状態・扱い |
|---|---|---|---|---|
| #748 Batch 18 | `claude/teto-pizza-game-content-9ctr2x` の担当 | `recipes.ts`・`ingredients.ts`・`lateCatalog.ts`・`discoveryLadder.ts`・`referencePizza.ts`・golden ほか | 2026-11-19 | **#759 は merge 済みだが release コメント無し**。カタログ全体と重なる。担当が解放するか、Owner が失効を宣言するまで **カタログ系ファイルの新規 claim は取れない** |
| #749 FRY F1 | `session_013m8Cb49gBq9AcNooPFsNsB` | `src/logic/fry/**`・`src/data/fry*`・`src/preview/fryPreview*` | 2026-11-18 | 有効。F2 以降（`ingredients.ts`・`IngredientGlyph.tsx` を触る eggplant 絵）は **この claim の外**＝別途調整 |
| #726 STEAM S3 | `session_013m8Cb5GjssgoY27cSCQ3jk` | `PizzaStage.tsx`・`GameScreen.tsx`・`App.tsx`・`SteamLayer*`・`steam/**`・e2e | 2026-11-10 | 有効（PR #738 open）。**`PizzaStage.tsx`・`GameScreen.tsx`・`App.tsx` は他セッション編集禁止** |
| #755 STEAM ゲーム性 | #756/#757/#762/#763（Draft） | `src/main.tsx` ほか | 未取得（要確認） | **既存 Draft に push しない**。新方式は新ブランチ |
| #764 360px はみ出し | `claude/webkit-360-cooking-overflow` | e2e／docs のみ | 2026-11-12 | 本計画と重ならない |
| #758 大葉 | — | — | **release 済み** | 影響なし |
| #741 / #736 / #706 / #707 / #708 | 未取得 | — | — | 出荷済み（goulash・jerk・supreme・alla-norma・umeboshi は `recipes.ts`/`ingredients.ts` に存在）。**Issue は open のまま**＝クローズ確認を Owner に依頼（§8） |

### 2.2 ファイル HOT 表（同時編集禁止）

| 区分 | ファイル | 同時に触れるのは |
|---|---|---|
| **カタログ lane（直列）** | `ingredients.ts`・`recipes.ts`・`lateCatalog.ts`・`discoveryLadder.ts`・`discoveryCatalog.ts`・`referencePizza.ts`・`recipeHintRoles.ts`・`recipeSauceProfiles.ts`・`orders.ts`・`ingredientTaxonomy.ts`・`toppingSizeClass.ts`・golden（`hint5.ladders55.json` ほか） | **常に 1 セッションだけ（S1）** |
| **描画 lane（直列）** | `IngredientGlyph.tsx`・`App.css` の食材サイズ規則 | 常に 1 セッション（S3）。B19 の burrata SVG も同ファイル |
| **調理画面（STEAM 保有）** | `PizzaStage.tsx`・`GameScreen.tsx`・`App.tsx`・`gameReducer.ts`・`main.tsx` | #726 claim 保有セッションのみ。他は禁止 |
| 新規ファイル | `docs/**`・`src/logic/<新方式>/**`・`src/preview/**`（新規） | 各セッションが独自の名前空間で |

→ **レシピ・食材の実装は 1 本のレーンに直列化**し、並列化は「準備（仕様・監査・SVG・Jaccard）」「別領域（調理方法）」で行います。これが衝突を避けつつ最大スループットを出す構成です。

## 3. 依存関係の整理

```
Owner GO(B19) ──┐
#748 claim解放 ─┼─▶ S1 B19 (burrata+2) ─▶ B20 (既存食材のみ) ─▶ B21 (honey+walnut) ─▶ B22 ...
docs取り込み(S2)┘        ▲
S3 herb4種 描画PR ───────┘ (IngredientGlyph.tsx を先に merge)
S3 eggplant 絵 (#753 A案) ─▶ S5 FRY F2（eggplant を対象化）
#738 STEAM S3 merge ─▶ S4 STEAM Production判断（Owner HV）
S6 新工程候補の調査 ─▶ Owner が 1 つ選択 ─▶ 別 Gate
```

| 項目 | 依存 | 並列実行可能条件 |
|---|---|---|
| Batch 19（#748 の続き） | Owner の明示 GO（Q3）／Prep の D1・D3・D4・D7・D9 を Owner が #748 に記録（X2）／#748 claim の解放／ハーブ 4 種 PR の merge 後 | 不可（カタログ lane） |
| ハーブ 4 種描画（R2 D1–D4） | #759 merged（充足済み）。**別 PR・描画のみ** | `IngredientGlyph.tsx`/`App.css` を S3 だけが持つ間 |
| #753（eggplant A 案 docs） | — | docs のみ。S3 の eggplant 実装の前提 |
| #749 FRY F2 | eggplant の `pieceVisual`（`ingredients.ts` 編集）＝カタログ lane と描画 lane の両方 | S1/S3 の順番待ち |
| #738 STEAM | Owner HV（S3 iPhone Safari）／#755 の方式選択 | S4 は読み取り＋新規 docs のみ |
| 新食材を使うレシピ | その食材の追加（別タスク） | **食材タスクとレシピタスクを分割**（§5） |

## 4. 候補の抽出

### 4.1 既存食材のみで追加できるレシピ（優先・要 Jaccard 実測）

マトリクスから、未出荷・新食材 0 の行（別名取りこぼし未補正）:

| 区分 | レシピ（マトリクス id） | 必要な仕組み | 備考 |
|---|---|---|---|
| A1 すぐ取りかかれる | `tsukimi-pizza`（READY）、`bianca`・`sfincione`・`trenton-tomato-pie`（READY_WITH_REVIEW） | 既存機構（sfincione は MULTI_SPREAD_LAYER、trenton は STEP_ORDER の要確認） | 重複（Jaccard・出荷済みとの部分集合）は **S2 が実測**。bianca・sfincione は既存と近い恐れ |
| A1' Owner 承認済み設計の続き | `caponata-pizza`（#706、NO_SAUCE の例外を計画） | 既存機構 | #706 の Owner 判断状態を要確認 |
| A2 Owner の製品判断が必要 | `bulgogi`・`teriyaki-chicken`・`keema`・`philly-cheesesteak`・`pizza-chilena`・`pizza-baiana`・`pizza-de-cancha`・`hokkaido-cheese`・`pizza-zucchine-menta` | ソース未特定／原典の曖昧語（唐辛子・ひき肉・チーズ）の解決 | `BLOCKED_PRODUCT_DECISION`。**Owner が 1 件ずつ決める**。決まれば新食材 0 で追加可能 |
| A3 別機構が要る | `pizza-fritta`（FRY_COOK）、`mentaiko-cream`（LATE_ADDITION・後乗せ本番 OFF）、`quattro-stagioni`（ZONED）、DOUGH_VARIANT 系（`piadina-romagnola`〔READY〕・ny-style・argentine-napolitana ほか）、PAN_BAKE 系 | 新工程または生地バリエーション | §6 の新工程候補と連動 |

**正直な見積り:** A1＋A1' ＝ 約 5、A2 は Owner 判断次第で最大約 9。A1〜A2 だけで約 14。**20 に到達するには、新食材レシピ（§4.2）か Owner 発の原案レシピ（Batch 13/14/17/18 の方式）が要ります。** 既存と重複するレシピでの水増しはしません。

### 4.2 新食材（8 種）と、それを使うレシピ（別タスクに分割）

1 食材で複数の未出荷 READY 行を解放するものを優先:

| 順位 | 食材 | 解放できるレシピ（マトリクス） | 状態 |
|---|---|---|---|
| 1 | **burrata** | pesto-burrata（READY）、crudaiola（READY）、burrata-pizza（READY・crudaiola と Jaccard 0.429 → 近傍 5 件目で再判断） | Batch 19 で 2 レシピ承認済み |
| 2 | **honey** | hot-honey-pepperoni（READY_WITH_REVIEW）、nduja・nashville-hot-chicken（ホットソース未特定で BLOCKED） | 食材 1 で READY 1＋判断待ち 2 |
| 3 | **walnut** | pesto-noci（READY、honey と併用）、speck-e-brie（brie と併用） | honey とセットで B21 |
| 4 | **brie** | speck-e-brie（walnut と併用、COMPOSITION_CONFLICT 要判断） | |
| 5 | **yakiniku-sauce** | yakiniku-pizza（READY、PREP_STEP＝炒めが必要） | 炒め（Prep）の実装が未承認 |
| 6 | **spicy-salami** | diavola（BLOCKED：唐辛子の解決） | Owner 判断後 |
| 7 | **squid** | frutti-di-mare（BLOCKED：構成競合） | Owner 判断後 |
| 8 | **cheddar** | breakfast-pizza（BLOCKED：ホワイトソース未解決） | Owner 判断後 |

これは**提案**であり、8 種の確定は Owner の選択です（§8）。代替候補: caciocavallo（scacciata、ENCLOSE が必要）、kimchi・truffle・cumin・asparagus・chutney。**食材タスク（データ＋絵＋Research）とレシピタスク（recipes＋ladder＋Hint）は必ず別 PR**、レシピは食材の merge 後。

### 4.3 調理方法・新工程

| 候補 | 現状 | 解放するレシピ | 判断 |
|---|---|---|---|
| **STEAM（蒸す）** | #726 S1/S2 merge 済み、#738 S3 UI が open。**Preview/DEV 限定・本番 OFF**。対象 clam・mussel。#755 でゲーム性を V1〜V3 で試作中 | 既存レシピの体験（新レシピ 0） | 「追加調理方法」に数えるには **Owner HV＋本番 ON の別承認**が必要 |
| **FRY（揚げる）** | #749 F1（純粋ロジック・休眠）。eggplant は絵が無く対象外。Phase 2（`FRY_COOK`）で `pizza-fritta`（新食材 0） | Phase 1 は 0、Phase 2 で 1（＋lomo-saltado に相乗り） | Phase 2 は BAKE 置換・識別 cook 軸の再実行で影響が大きく**別 Owner Gate** |
| 新工程候補（調査） | POST_BAKE／DRIZZLE（#579・#746）、MULTI_SAUCE（#521・#620）、ZONED（#620、quattro-stagioni）、DOUGH_VARIANT（Pinsa は出荷済み、piadina は design gate あり）、PAN_BAKE（#532 Epic、HOLD）、PREP「炒め」（#696、Owner 未承認） | 工程ごとに 1〜数件 | S6 が比較表を作る |

数字の注意: Fry 設計監査（`TETO_COOKING-METHODS-AFTER-STEAM_Design-Audit.md`）は「調理法が解放する未実装レシピは揚げ 1・炒め 3 のみ。茹で・煮込み・蒸しは 0」と結論。**調理方法は「遊びの幅」を増やす目標であって、レシピ数の主経路は食材・ソース・生地バリエーションです。**

## 5. 6 セッションの割り当て

| # | 担当 | 担当 Issue | 作業ブランチ（案） | claim 対象ファイル | 成果物 | 開始条件 |
|---|---|---|---|---|---|---|
| **S1** | **Catalog lane（食材・レシピの実装）** | #748 の続き（Batch 19 は新 Issue 起票が必要・Owner 承認）、以降 Batch 20/21/22 | `claude/batch-19-burrata`（以降 batch ごと） | カタログ lane 全部（§2.2） | B19: burrata＋2 レシピ。B20: 既存食材のみ 5 レシピ。B21: honey＋walnut＋2 レシピ。各 Batch の Result・HV 動画（直接配布）・before/after | **Owner の明示 GO**＋#748 claim 解放＋S3 のハーブ PR merge。**今は着手不可** |
| **S2** | **Recipe Pool／Prep（docs-only）** | 新 Issue（案）「新規コンテンツ候補プール再構築」 | `claude/content-pool-audit` | `docs/reports/TETO_CONTENT-POOL_*`・`docs/reports/data/**`（新規のみ） | (1) 候補マトリクスを main の実カタログに再照合（別名補正）、(2) 候補ごとの Jaccard・近傍・出荷済みとの部分集合チェック、(3) Batch 20/21/22 の Prep（仕様・AC-8/8b 事前測定計画）、(4) Prep Rev4／R2 決定の main 取り込み状態の確認と X1〜X4 の整理 | **すぐ着手可（Owner 承認は Issue 作成のみ）** |
| **S3** | **描画 lane** | #417 系（ハーブは R2 決定）、#753 | `claude/herbs-4-glyphs`（描画のみ）→ `claude/eggplant-glyph` | `IngredientGlyph.tsx`・`App.css`（食材サイズ規則）・描画テスト・`docs/reports/screenshots/<task>/` | ① ハーブ 4 種（rosemary B／oregano B／spinach A2／artichoke A2、1.2em）② eggplant A 案（輪切り）③ 以降の新食材の SVG を burrata → honey ほかの順に | ハーブは **#759 merged で条件充足**。ただし `ingredients.ts` を触らない描画のみ。eggplant は `ingredients.ts` の `pieceVisual` が要るため **S1 の順番に差し込む**（要調整） |
| **S4** | **STEAM lane（調整役・docs）** | #726・#755 | `claude/steam-readiness-pack`（新規 docs のみ） | `docs/reports/TETO_COOKING-STEAM_PRODUCTION-READINESS_*`（新規） | #738／#755 V1〜V3 の比較表、HV 項目一覧、Production ON の前提条件（Owner 用）。**#738・#756/#757/#762/#763 へは push しない** | #726 の claim 保有セッションとの重複確認後。コード変更は claim 保有者のみ |
| **S5** | **FRY lane** | #749 | `claude/teto-next-cooking-method-cgnsh4`（既存 claim の branch。**同一セッションが続行**）または新 branch | `src/logic/fry/**`・`src/data/fry*`・`src/preview/fry*`（既存 claim 範囲） | F2 設計（泡の UI を新規ファイル中心に）、eggplant の対象化は S3/S1 の描画・カタログ変更後。Phase 2（`pizza-fritta`）の Owner Gate 資料 | claim 保有セッションが継続できるか Owner 確認。他セッションは奪わない |
| **S6** | **新工程の調査（docs＋新規ファイル試作）** | 新 Issue（案）「新工程 候補比較」 | `claude/new-process-research` | `docs/reports/TETO_NEW-PROCESS_*`（新規）、必要なら `src/logic/<名前空間>/**`（新規のみ・未配線） | 候補（POST_BAKE/DRIZZLE・ZONED・MULTI_SAUCE・DOUGH_VARIANT〔piadina〕）の比較（解放レシピ数・影響範囲・既存 Issue 重複・HV 方法）と 1 案の推奨 | すぐ着手可（既存 #579/#620/#521/#577 を再利用、重複 Issue は作らない） |

**同一ファイルの同時編集がないことの確認:** S1=カタログ lane、S3=描画 lane、S4/S5=STEAM/FRY の別名前空間（S4 は docs のみ）、S2/S6=docs 新規。S3 と S1 は `IngredientGlyph.tsx` と `ingredients.ts` の境界で**順番待ち**（下記）。

## 6. 推奨 merge 順

1. docs-only: #753（eggplant 採用記録）、Prep Rev4／R2 決定の取り込み（S2・要確認。#769 で取り込み済みの範囲は S2 が確認）
2. S3: ハーブ 4 種（描画のみ・Owner HV）
3. **Owner GO** → S1: Batch 19（burrata＋2 レシピ。Phase 0 の P0 を満たしてから）
4. S3: eggplant の絵＋`ingredients.ts` の `pieceVisual`（S1 の B19 merge 後。カタログ lane の順番待ち）
5. S1: Batch 20（既存食材のみ。S2 の Prep が済んだ分）
6. #738 STEAM S3 → Owner HV → S4 の Production 判断（別承認）
7. S1: Batch 21（honey＋walnut）→ Batch 22（Owner が選んだ A2／新食材）
8. S5: FRY F2、Phase 2 は別 Gate

**同時 merge はしない。** merge は Owner の承認が必要で、私は merge・Production ON・共有 Preview 更新をしません。

## 7. 進捗の報告形式（今後）

> **追加食材数 x/8｜追加レシピ数 y/20｜追加調理方法数 z/2｜実装中: …｜HOLD: …｜merge 済み: …**

「追加調理方法数」は本番 ON（またはOwner が数えると決めた段階）まで加算しません（STEAM／FRY は現状 0）。

## 8. Owner 承認が必要な事項（いずれも未実施）

| # | 事項 |
|---|---|
| 1 | **新 Issue の作成**（重複確認済み）: (a) 「新規コンテンツ候補プール再構築」（S2）、(b) 「新工程 候補比較」（S6）、(c) Batch 19 実装 Issue（#748 は Batch 18 で merge 済み。#748 のまま続けるか新 Issue か） |
| 2 | **claim の投稿**（S1〜S6。#748 の未解放 claim の解放確認を含む） |
| 3 | **新食材 8 種の選択**（§4.2 は提案） |
| 4 | **A2（BLOCKED_PRODUCT_DECISION）の個別判断**。決まらない限り 20 に届かない |
| 5 | Batch 19 の**明示 GO**と Prep の D1・D3・D4・D7・D9 の記録（X2） |
| 6 | 「追加調理方法」の定義（STEAM は本番 ON まで数えないか） |
| 7 | #741・#736・#706・#707・#708 は出荷済みに見える。クローズしてよいか |
| 8 | `teto-pizza-game-preview` リポジトリは**触りません**（共有 Preview 更新禁止のため） |

---

## 9. 各セッション向けコピペ用プロンプト

共通の前置き（全セッション）:

```
あなたは TETO Pizza Game の並列開発セッションです。
最初に CLAUDE.md、docs/PROJECT_HANDOFF.md の startup checklist、docs/decisions/TETO_SESSION-OPERATIONS_1.0.md、
docs/reports/TETO_PARALLEL-PLAN_NEW-CONTENT_2026-11-06.md（本計画）を読み、最新 main・open PR・Issue の claim を Fresh Audit してください。
禁止: 既存 PR への無断 push、merge、Production ON、共有 Preview 更新、他セッションの claim の奪取、
CI 赤の隠蔽（skip/retry/timeout 緩和）、数を満たすための品質低下。UI/UX/ゲーム性の変更は
docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md に従う（動画 390×844 は repo に commit せず Owner へ直接、スクショは
docs/reports/screenshots/<task>/）。claim と Issue の作成は Owner 承認後に行う。
報告は「追加食材数・追加レシピ数・追加調理方法数・実装中・HOLD・merge済み」の形式。
```

**S2（すぐ着手可）**
```
[S2 Recipe Pool / Prep, docs-only] 本計画 §4.1・§4.2 を実施。
1) docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json と main の src/data/recipes.ts・lateCatalog.ts を再照合し、出荷済み id の別名を補正した未出荷リストを作る。
2) 新食材 0 の候補（A1／A1'）ごとに既存全レシピとの Jaccard、同一／部分／上位集合、1 材料差を計算（Batch 19 の researchLabelAudit・Jaccard 手順を再利用）。0.4 超は理由を明記。
3) Batch 20（既存食材のみ）の Prep を docs に書く（仕様・AC-8/8b の測定計画・暫定仕様の明示）。
4) A2 の各行について Owner が決めるべき論点を 1 件 1 行で表にする。
変更は docs/reports/TETO_CONTENT-POOL_* と docs/reports/data/ の新規ファイルのみ。src/ は触らない。Issue 作成は Owner 承認後。
```

**S6（すぐ着手可）**
```
[S6 New Process Research, docs-only] 新工程候補（POST_BAKE/DRIZZLE #579/#746、MULTI_SAUCE #521/#620、ZONED #620、DOUGH_VARIANT piadina #577、PAN_BAKE #532）を比較。
各候補: 解放できる未出荷レシピ数（マトリクス実測）、新食材の要否、影響ファイル（HOT 表）、既存 Issue/PR/claim との重複、iPhone 操作の適性、保存・採点・Research/Hint への影響、HV 方法。
推奨 1 案と、STEAM/FRY と干渉しない理由を書く。成果は docs/reports/TETO_NEW-PROCESS_* の新規ファイルのみ。既存 PR・claim 範囲には触れない。
```

**S3（ハーブ PR は着手可・Owner の最終確認後）**
```
[S3 Ingredient Glyph lane] docs/decisions/TETO_ICONS-HERBS-BURRATA_R2_OWNER-DECISIONS_2026-11-06.md の D1〜D4（rosemary B／oregano B／spinach A2／artichoke A2、初期 1.2em、別 PR、描画のみ）を実装。
編集してよいのは IngredientGlyph.tsx・App.css（食材サイズ個別規則）・描画テスト・screenshots のみ。ingredients.ts・recipes.ts・採点・保存・id・emoji は変更しない。
Style Lock V2 を遵守。HV: 390×844 動画＋before/after を Owner へ。burrata・eggplant の SVG は後続（B19／S1 の順番に合わせて Owner 指示後）。
```

**S1（Owner GO 後のみ）**
```
[S1 Catalog lane, Batch 19] 開始条件: Owner の明示 GO、#748 claim の解放、S3 ハーブ PR の merge、docs/reports/TETO_EXPANSION-BATCH-19_*.md の Phase 0 条件充足。
docs/reports/TETO_EXPANSION-BATCH-19_Prep.md と PreImplementation_Fresh-Audit.md の Phase 1〜5 に従い burrata（案 C SVG）＋pesto-burrata-pizza＋pizza-alla-crudaiola を実装。
AC-8（正準順で既存ラベル変化 0・非正準差分は 1 件ずつ Owner 承認）、AC-8b、Jaccard 近傍固定、step 1–69 凍結を満たす。
このレーンはカタログ系ファイルを単独で持つ。merge は Owner 承認後。
```

**S4（STEAM readiness・docs のみ）**
```
[S4 STEAM readiness, docs-only] #726・#738・#755・#756/#757/#762/#763 の現状を再取得し、claim 保有を確認。
V1〜V3 の比較表、iPhone Safari HV 項目、Production ON の前提条件、#738 の merge 順を docs/reports/TETO_COOKING-STEAM_PRODUCTION-READINESS_* に新規作成。
既存 PR・claim 範囲（PizzaStage.tsx・GameScreen.tsx・App.tsx・main.tsx）へは編集・push しない。
```

**S5（#749 の claim 保有セッション向け）**
```
[S5 FRY lane] #749 の claim（src/logic/fry/**・src/data/fry*・src/preview/fry*、期限 2026-11-18）の範囲内でのみ作業。
F2 の設計（泡の UI・操作）を新規ファイル中心に進め、eggplant を対象にするには専用 pieceVisual（ingredients.ts・IngredientGlyph.tsx）が要るため、その編集は S1/S3 の順番に従い Owner 調整後。
Phase 2（pizza-fritta・FRY_COOK）は別 Owner Gate の資料のみ。本番 OFF 固定。
```
