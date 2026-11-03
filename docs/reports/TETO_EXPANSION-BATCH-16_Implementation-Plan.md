# Expansion Batch 16 — 梅しそピザ 実装計画・推奨仕様（Owner 方針更新後、docs-only）

Status: **計画のみ。実装は未開始（Owner の最終 GO 待ち）。** Production コード・テスト・データ・保存仕様・ladder は未変更。PR 作成・merge・Preview 更新・Production Deploy・CI 再実行・Monitor 作成なし。
基準 `origin/main` = `50ac26b`（**#731 B15 は merge 済み**。#732 蒸す S2 設計も merge 済み）。本書は `TETO_EXPANSION-BATCH-16_Research_Result.md` / `…_Scratch-Verification_Result.md`（同 branch）の更新版で、矛盾する箇所は**本書が優先**する。

## 0. Owner 方針（2026-11-03 更新）の反映

| 方針 | 本書での扱い |
|---|---|
| 案 A: 通常 recipe の ordinary step 67 | 採用。ladder 総数 73 → 74、late の導出番号は +1（解禁 floor は不変） |
| 大葉は焼成前、late catalog への移動なし | 採用（shirasu-pizza と同じ。FINISH の制約・privacy gate は緩めない。V-A は不成立のまま） |
| 梅肉 = O1（塗るソース・PAINT） | 採用（sauce 型、family なし） |
| 「その他」= 梅肉ソースは B16 限定の暫定例外 | `discoveryCatalog.test` / `matcher.test` の承認例外は **ume-shiso のみ**（B15 と同形） |
| しらすピザとの Jaccard 0.60 は B16 限定で例外承認 | 全体基準 0.4 は不変。構造的保証（同一・部分・上位集合なし）をテストで固定し、0.4 以上の近傍は shirasu-pizza のみと名前つきで固定 |
| Research 表示 `？？？ピザ（梅肉）` | 単独 cohort・文字なし。既存ラベルの変更 0 を全 ladder prefix で固定 |
| schema v2 維持 | 新 id の追加のみ |
| 原典未確認を明記 | 全成果物（recipe コメント・テスト・Result・PR）に明記 |

## 1. 開始条件の確認

| 条件 | 結果 |
|---|---|
| #731 が merge 済み | **満たす**（`50ac26b`） |
| 残りの仕様（個数・焼成窓・説明文・注文セリフ）が Owner 承認済み | **未承認。** 今回の依頼は「推奨案の提示」で、Owner の選択は記録にない。B15 は Owner が値を明示して「暫定承認」した。このため**実装には進まない** |
| 重複 | B16 / 梅しそに関する Issue・PR・branch・claim は**なし**（#733 は beef / green-pepper の視認性で無関係）。open PR は #651 / #650 / #620 / #612 のみ（docs）。専用 Issue・claim は GO 時に作成 |

→ **次の Owner 判断は §2 の推奨案を承認（または別案を指定）してください。** 承認があれば、そのまま S0（Issue・claim）から実装します。

## 2. 推奨仕様（すべて暫定・原典未確認）

原典 pizzadb.jp は未確認。根拠は 172 matrix の 1 行（梅肉 / 大葉 / モッツァレラ / しらす、ソース欄「その他」）だけ。以下は GAMEPLAY ASSUMPTION / CALIBRATION。

| 項目 | 推奨 | 理由 |
|---|---|---|
| 構成（`requiredIngredients` の順） | 梅肉 1（PAINT）→ mozzarella 2 → whitebait 4 → shiso 2（全て焼成前） | 順序は sauce → cheese → toppings（B14 で Rule W と旧 Hint 2.0 H4 の不一致が出た箇所）。8 ピース = 8 スロット（B12–B15 の慣例） |
| 個数 | **P1: mozzarella 2 / whitebait 4 / shiso 2** | しらすが主役で、shirasu-pizza（whitebait 3 / shiso 1 / lemon 2）と見た目の構成が離れる。識別そのものは個数ではなくソースの有無。P2（3/3）は whitebait の個数が shirasu と同じ、P3（チーズ 3）は差別化が弱い。大葉 2 はショップの 1 パック（k=1・10 個）で 5 枚分になる点だけ Owner 確認（shirasu は 1 枚） |
| 焼成窓 | **58–78（汎用窓）** | `FREE_COOK_BAKE_TARGET`（recipe の窓の中央値）が動かない（shirasu・B12–B15 と同じ）。56–76 / 60–80 は中央値に影響し得て**未検証** |
| 説明文 | **D-1「梅のさわやかなソースに、しらすと大葉をそえた、和風の一枚。」** | 既存の説明文と同様に材料を名指しし、投入の時機は書かない（Anti-Oracle）。D-3 は大葉・しらすを先に出すが内容は同等 |
| 注文セリフ | **O-1「梅のさわやかなピザ、おいしそう！食べてみたいな！」** | 単一の形容で、shirasu の注文（「しらすと大葉のピザ…」）と食材が重ならず取り違えにくい。O-3 は食材名が 2 つで shirasu と重なる |
| 食材名・emoji・色 | 梅肉（原典語）/ 🍑（未使用を確認済み）/ `#b8405a` 付近（トマト ΔE 29・豆板醤 26・生地 64）。**実機 HV で確定** | sauce は emoji を表示する（G18: 他食材と重複不可）。焼成後の色は未測定 |
| credited・step | credited、ordinary step 67、T4・星ゲートなし、key = ume-shiso-pizza | 新材料の key recipe は credited が前例 |

## 3. 更新範囲の確定（実測: `50ac26b` の clone に V-B を適用して全 Vitest）

結果: Pinsa ON **11,222 件中 59 失敗**、Pinsa OFF **11,213 件中 59 失敗**。失敗は**同じ 28 ファイル**（ON / OFF の差なし）で、**すべて件数・一覧・golden・manifest・承認例外・自分の B15 pin の追従**。privacy / DH4 / Hint 5.0 / Research / matcher の**識別系 gate は 1 件も落ちない**（`deductionGuard.*` / `deductionProduction.gate` / `hint5Production.gate` / `hint5Taxonomy.gate` は無修正で pass）。

### 3.1 追加するデータ（8 ファイル）
`ingredients.ts`（`umeboshi-paste`: sauce・spread・色・🍑・unlockCondition）/ `discoveryLadder.ts`（ordinary step 67、末尾）/ `recipes.ts`（BASE_RECIPES 末尾）/ `recipeSauceProfiles.ts`（`ingredientId` の型に追加 + `ume-shiso-pizza: PAINT`）/ `referencePizza.ts`（8 点リング。**shiso は `LIGHT_LEAF`**＝`referencePizza.w1` の「leafy herb は LIGHT_LEAF」に合わせる）/ `orders.ts` / `discoveryCatalog.ts` / `recipeHintRoles.ts`（key-free）。`ingredientTaxonomy.ts` は **sauce なので変更なし**。`PROJECT_HANDOFF.md` は B15 と同じく**変更しない**（Owner 指示がなければ）。

### 3.2 追従する既存テスト（28 ファイル・59 件、assertion の意味は変えない）
| 種別 | ファイル（件数） | 更新内容 |
|---|---|---|
| 件数 ledger | `catalogLedger`（2）、`lateCatalog.bbq`（1）、`catalogShelf`（1）、`largeCatalogFixtures`（1） | recipes 86→**87**（Pinsa 開）/ 85→86、credited 76→**77**、ingredients 95→**96**、ladder steps 73→**74**、sauce 13→**14**、第 4 章 +1 |
| ladder / late の導出 | `expansionBatch11.s1`（1）、`12b`（1）、`13`（1）、`14`（1）、`lateCatalog.late4`（1）、`materialEntitlement.batch6`（1）、`lateFloor`（2）、`materialShop`（19） | ordinary の step 数 66→67 と、late の導出番号 +1（`LATE_ENTITLEMENT_FLOORS` は**不変**。解禁そのものが後退しないことを `lateFloor` で固定） |
| 一覧 pin | `recipes.test`（2）、`lunchRush.exclusion`（1: opt-out 52→53）、`progression.test`（1）、`researchLabels.batch8a`（1）、`discoveryProgressionModel`（1）、`DiscoveryProgressionInspector`（2: step 数・multi-recipe 行）、`cookingProfiles`（3）、`referencePizza.test`（1: sauce 集合に梅肉） | 一覧に 1 件追加・数を 1 つ増やす |
| Hint 5.0 / DH4 | `hint5Ladder.baseCompat`（2: key-free 母集団 61→62、sauce+cheese の件数）、`hint5Ladder.golden55`（1）、`hint5Ladder.alphaReport`（1）、`deductionHint.audit`（1） | golden は**挿入のみ**（実測: `hint5.ladders55.json` **+203 行・削除 0**、`alphaFamilyOnly.json` +1 行）。DH4 audit JSON は `category` の件数 **13 → 14 の 1 行のみ**（B-1 の豆板醤と同じ性質） |
| manifest / validator | `recipeBatch.validator`（6） | `B16_BATCH` を追加（`afterRecipeId: "nigerian-suya-pizza"`、key `umeboshi-paste`、credited、`acceptedLetterShifts` なし）、B10–B15 の `followedBy` に ume-shiso を追記、`RECIPE_BATCHES` に追加、B16 の整合テストを新規追加 |
| 承認例外（**ume-shiso のみ**） | `discoveryCatalog.test`（1）、`matcher.test`（1） | `BATCH16_PHASE2_BLOCKED_OWNER_APPROVED = ["ume-shiso-pizza"]`、`ownerApproved.add("ume-shiso-pizza-pizzadb-p14")`。他の BASE_SAUCE_UNSPECIFIED 行は引き続き「出荷されていない」を検査 |
| **自分の B15 pin** | `expansionBatch15.test`（2） | 「ordinary ladder の最後は step 66（cinnamon）」→ 67、「ume-shiso は出荷されていない HOLD 一覧」から **ume-shiso を外す**（意図した B16 による変更。他の 4 件の HOLD は維持） |

### 3.3 新規ファイル
`expansionBatch16.test.ts`（構成・ソース = 梅肉 PAINT・非 NO_SAUCE・credited・key-free・CUT なし・全て焼成前・同一 / 部分 / 上位集合なし・**shirasu 0.60 の名前つき例外**・0.4 以上は shirasu のみ・matrix 行の blocker 不変）、`persistence.batch16.test.ts`、`expansionBatch16.step67.test.ts`（実プール全体の「おしい」・Hint・Research、B15 の step58 テストと同形。step 67 は **late の wasabi-beef-pizza と同時**に makeable になるため、その pool も含める）、`e2e/b16.spec.ts`、`docs/reports/TETO_EXPANSION-BATCH-16_Result.md`、`docs/reports/screenshots/b16/`。

## 4. 検証計画

| 項目 | 内容 |
|---|---|
| 全 Vitest | **Pinsa ON / OFF の両方**（OFF は `npm run test:pinsa-off`、CI では走らない）。scratch 実測では ON / OFF とも失敗は同じ 28 ファイルで、追従後は 0 になる見込み（実装で確認） |
| 型・lint・build | `tsc -b`、`oxlint`（新規警告 0）、`vite build` |
| 保存互換（`persistence.batch16`） | schema v2 のまま。新 id の追加のみ。旧版の保存が読めて、再保存で落とさない（未知 ID 保持、#674）。**shirasu-pizza の Dex エントリは byte 同一**。発見数 67 で梅肉・soy-sauce・wasabi が同時に解禁され、66 以前の解禁と late の解禁 floor（66 / 67 / 68）は変更前と同一（scratch の実測で確認済みの数え方を固定）。梅肉を持たない保存は、梅肉を自動では持たない |
| Research | `？？？ピザ（梅肉）`（文字なし）。全 ladder prefix と 40 通りのランダム購入順で、**既存レシピの文字が変わらない**こと。ラベルに recipe 名・id を含まない（INV-B7） |
| Hint 5.0 | key-free（BASE 段に新 sauce が入る）。golden は挿入のみを差分で確認。`deductionGuard.gate` の旧ガード件数ピンは B-1 / B14 と同様に**原因を分解して再測定**し、**hardened guard と privacy assertion は緩めない** |
| 「おしい」・Hint target | step 67 の実プール（キー発見のみ / shirasu 未発見 / 他すべて発見済み）で B15 と同形の測定。**悪化 0**（変わる試作は strictly 近づく、または ume-shiso 自体）、しらすピザの近傍（`mozzarella+shiso+whitebait` = ADD_ONE d1）が不変、結果にレシピ名・食材名を含まない。scratch 実測: 分類が変わる試作は 63/69 件（キー発見のみ）・22/69 件（shirasu 未発見）、悪化 0 |
| E2E | Chromium 390×844 / 360×800: ショップ NEW（梅肉）→ 購入 → Research（漏えいなし）→ 梅肉を塗る → チーズ → 具材 → 焼成 → NEW DISCOVERY → 図鑑（schema v2、横スクロールなし、console error なし） |
| WebKit | PR の CI（6 shard + WebKit Gate）。既知の間欠失敗（#394 / #680 / #562 / #529 ほか）が出たら失敗ジョブの再実行 1 回と記録（隠さない・timeout を緩めない）。**不要な再実行はしない** |
| HV | 動画（390×844、Owner へ直接提出、repo には入れない）＋スクリーンショット `docs/reports/screenshots/b16/`。実機 iPhone Safari は Owner。確認点: 梅肉ソースの色（トマト・豆板醤と識別できるか、焼成後の色）、🍑 の表示、しらす 4 + 大葉 2 の盛り付け、シソ（leaf）が生地上で見えるか、step 67 のショップ NEW |
| FINISH / privacy | **緩めない**: 大葉は焼成前なので FINISH の契約（通常 recipe は FINISH を持たない）に触れない。Technique recipe は増えない（V-A のような再監査 gate は発動しない） |

## 5. 残る未解決事項

1. **§2 の推奨（個数 P1・窓 58–78・説明 D-1・注文 O-1・食材名・🍑・色）の Owner 承認。** これが「残りの仕様の承認」に当たる。
2. 大葉 2 枚のショップ 1 パック（k=1・10 個）の消費感（shirasu は 1 枚）。
3. 梅肉の色は焼成後が未測定。HV で確定（暫定色のまま実装）。
4. `PROJECT_HANDOFF.md` の B16 addendum は、Owner の指示がなければ変更しない（hot file）。
5. 原典確認（pizzadb.jp はネットワーク未許可・未確認のまま）。
6. 未検証: E2E・WebKit・実機（実装後）。V-B は scratch での全 Vitest と通し・近傍のプローブまで。
7. 件数 pin の最終値（recipes 87 / 86、credited 77、ingredients 96、ladder 74、sauce 14、第 4 章）は実装の `catalogLedger` から導出して確定する（上記は scratch の実測）。

## 6. 着手時の claim（案・**未投稿**）

```
files: src/data/{ingredients,discoveryLadder,recipes,recipeSauceProfiles,referencePizza,orders,discoveryCatalog,recipeHintRoles}.ts,
       上記 28 ファイルの pin / manifest / golden、src/data/expansionBatch16.test.ts, src/state/persistence.batch16.test.ts,
       src/logic/discovery/expansionBatch16.step67.test.ts, e2e/b16.spec.ts, docs/reports/TETO_EXPANSION-BATCH-16_*, docs/reports/screenshots/b16/**
Depends-on: （#731 は merge 済み。依存なし）
HOT: recipes.ts（末尾追記のみ）。PROJECT_HANDOFF.md / App.css / GameScreen.tsx / gameReducer.ts / ingredientTaxonomy.ts は編集しない。
```
重なり確認: #732 は docs のみで merge 済み。open PR に ume-shiso・step 67・`recipes.ts` を触るものなし。炙り（#727）・蒸す（#726 S1 は merge 済み、S2 以降は未着手）のファイルには触れない。

## 7. 実施しなかったこと

実装（B16 の Production コード・テスト・データの変更）、Issue・PR・claim の作成、merge、共有 Preview / Production の更新、グローバルな Jaccard 基準・FINISH の制約・privacy gate の変更、CI の再実行、Monitor の作成、原典の取得。scratch（repo 外）の検証結果のみを使用した。
