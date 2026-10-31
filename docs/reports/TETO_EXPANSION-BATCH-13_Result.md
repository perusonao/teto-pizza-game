# Expansion Batch 13 — Result Report（potato-mayo-pizza + mayo）

Status: **実装完了。Owner の承認と実機 HV の前は merge しない。共有 Preview・Production は更新していない。** 基準 `main` `c914b59`（#711 / #709 merge 済み）。Issue #708。

## 0. 暫定仕様・原典未確認（GAMEPLAY ASSUMPTION）

**原典（pizzadb.jp）には到達しておらず、未確認。** 個数・配置（合計 8 ピース = 8 スロットのリング）、焼成窓 58–78、名称・説明文、`mayo` の色・字形・サイズは GAMEPLAY ASSUMPTION / CALIBRATION。ソース欄が `BASE_SAUCE_UNSPECIFIED` の行を NO_SAUCE とするのは、**Owner 決定（2026-10-30）によりこの 1 件に限る**（他の行には波及しない）。

## 1. 内容（Owner 承認済みの設計、#708）

| 項目 | 内容 |
|---|---|
| レシピ | `potato-mayo-pizza` じゃがマヨピザ（`potato-mayo-pizza-pizzadb-p3`）。mozzarella 2 / potato 2 / bacon 1 / corn 1 / **mayo 2**（8 ピース）。NO_SAUCE（`RECIPE_SAUCE_PROFILES` = `null`）。credited、`lunchRush:false`、CUT なし、key-free、窓 58–78、報酬 100 |
| 新食材 | `mayo` マヨネーズ。**topping（scatter）**・family `spice`・size class `s`・専用 SVG `mayo-drop`（**しずく形**）＋ **なぞって置く（案A）**。T4（初回 120 / 補充 60 Pitz、星ゲートなし）。絵文字は 🧴（既存と重複しない。専用 SVG が描くので文字フォールバックのみ） |
| ladder | 通常 **step 65 = mayo（key `potato-mayo-pizza`）**。1–64 は凍結。late は導出で +1（66–72）、`LATE_ENTITLEMENT_FLOORS` は不変 |
| Reference | 8 点リング（RT-01）を `requiredIngredients` の順に連続割当 |
| 触れていない | 採点・経済・保存形式（schema v2）・Production スイッチ・`lateCatalog.ts`・共有 Preview・#715（Pilot E） |

## 1b. iPhone 実機 HV を受けた変更（Owner 決定 2026-10-31「案A」）

初回の字形（絞り出しジグザグ `mayo-squeeze`）は、iPhone で白い「M」の字に読めた。レシピの発見は旧方式で PASS（61 点）。Owner が **案A** を承認:

- **TOPPING 工程で、mayo を選んで生地を 1 回なぞる = mayo 1 個**（`PlacedTopping.trail`、保存しない）。軌跡の長さ上限は**生地の直径の 60%**（`SQUEEZE_MAX_LENGTH` = 0.6 × 96 = 57.6 dough%）。reducer が境界（mayo 以外は軌跡を無視、薄く間引き・長さ・点数を制限、各点を生地に収める、**駒の座標 `x/y` は軌跡の中点**。採点は `x/y` だけを読むので採点は不変、1 回のなぞり = 1 個）。
- **タップ**は従来どおり 1 個（**しずく形**）。トレイの chip も M 字ではなく**しずく形**（`mayo-drop`）。
- なぞり中のプレビューは既存の軌跡レイヤ（クリーム色＋茶の縁）、置いた後は 1 本の線として描画（`.pizza-squeeze-trail`）。
- 実装は `src/logic/squeeze.ts` / `gameReducer.ts`（PLACE_TOPPING の `trail`）/ `PizzaStage.tsx`（ジェスチャーと描画）/ `App.tsx` / `GameScreen.tsx`。#717 の `mayo-zigzag` SVG は取り込まない（Owner）。
- #717（重複実装）の `persistence.batch13.test.ts`（保存互換 5 件）と `expansionBatch13.test.ts`（レシピ単体、既存テストと重複する分は除外）、`PROJECT_HANDOFF.md` の Batch 13 追記を統合した。

## 2. 影響（Owner が見るべき点）

- **件数**: recipes 83（Pinsa 有効なら 84）、credited 75、ingredients 94、toppings 67、ladder steps 72、第 4 章 46（Pinsa 有効なら 47）、Lunch Rush opt-out 51（プール 25 は不変）、key-free 58。
- **Research**: mayo は step 65 の唯一の素材で、potato-mayo-pizza だけのコホート → ラベルは「？？？ピザ（マヨネーズ）」（文字なし）。**既存レシピのラベルは動かない**（`acceptedLetterShifts` なし）。
- **Hint 5.0**: `hint5.ladders55.json` は挿入のみ（既存エントリ不変）。`hint5.alphaFamilyOnly.json` は、spice family が 4 → 5 件になるため既存 2 件の値が動く（`eggplant-dengaku-pizza` 48 → 71、`wasabi-beef-pizza` 396 → 531。設計時の予告どおり）。DH4 audit JSON は候補数の +1 のみ。
- **設計カタログとの差**: `data/recipes/ingredient_master_catalog.json`（62 カタログ、未有効化）は mayo を sauce / spread としているが、本番は topping / scatter（Owner 決定）。`catalogShelf.test.ts` は、この 1 件だけを宣言された差として固定した（2 件目や変化は失敗する）。
- **保存互換**: schema v2 のまま、新 id の追加のみ。旧版が mayo / potato-mayo-pizza を知らなくても、再保存で残る（既存の仕組み）。
- **既存の「承認例外」配列**: `discoveryCatalog.test.ts` と `matcher.test.ts` に potato-mayo-pizza の BLOCKED_PRODUCT_DECISION 例外（NO_SAUCE、この 1 件限り）を追加。

## 3. 変更ファイル（要点）

`ingredients.ts`（mayo、`mayo-squeeze`）/ `IngredientGlyph.tsx`（SVG）/ `toppingSizeClass.ts` / `ingredientTaxonomy.ts`（mayo = spice）/ `discoveryLadder.ts`（step 65）/ `recipes.ts` / `referencePizza.ts` / `orders.ts` / `discoveryCatalog.ts` / `recipeHintRoles.ts` / `recipeSauceProfiles.ts` ＋ 件数 pin・manifest（`B13_BATCH`）・golden・DH4 audit・E2E の追従。新規テスト: `e2e/batch13-potato-mayo.spec.ts`（390×844 / 360×800 の通し）、`IngredientGlyph.test.tsx` の Batch 13 契約。

## 4. 検証

- 全 Vitest: Pinsa ON 568 files・10797 passed・0 failed / Pinsa OFF 568 files・10789 passed・0 failed（案A と #717 のテスト統合後）。
- `tsc -b` / `vite build` / oxlint: error なし。
- Chromium E2E（`batch13-potato-mayo`）: 390×844 / 360×800 とも 1/1 passed（Shop NEW → 購入 → Research（漏えいなし）→ ソースなしで次へ → モッツァレラ → 具材（マヨネーズは**2 回なぞる = 2 個**）→ 焼成 → NEW DISCOVERY → 図鑑、横スクロールなし、console error 0）。新規: `squeeze.test.ts`（13）/ `gameReducer.squeeze.test.ts` / `PizzaStage.squeeze.test.tsx`（5: なぞり = 1 個の線、タップ = しずく、60% の上限、プレビュー、他の具材は不変）。
- スクリーンショット 14 枚（しずく形・なぞり後の線）: `docs/reports/screenshots/b13/`。動画（390×844）は Owner へ直接提出（リポジトリには含めない）。
- WebKit・iPhone Safari は CI と Owner の実機 HV。

## 5. Owner 判断事項・HV で見てほしい点

1. **マヨネーズ（案A）**: しずく形のトレイ chip・タップの駒の識別（20〜24px、チーズ類との取り違え）、**なぞる操作**（1 回なぞる = 1 個、長さ上限 60%、線の太さ・見え方、指の追従）。
2. size class `s` の妥当性（Issue の指定。実機で再評価可）。
3. 名称「じゃがマヨピザ」と説明文（暫定）。
4. NO_SAUCE 仮定（この 1 件限り）の維持。原典確認は未了。
5. **iPhone 実機 HV**（Owner。セッションは PASS を代行しない）: マヨネーズを**なぞって**置く操作と見え方、しずく形の識別（モッツァレラ、クリームチーズ、リコッタ、リコッタサラータとの取り違え）、じゃがマヨピザの調理から RESULT まで（ソースは塗らない。チーズ工程は飛ばさない）、図鑑・Research の表示。
