# PR-2 late4 Result — わさび牛 / たらこクリーム（late catalog、暫定仕様）

Status: **実装済み・自動検証済み・Owner 実機 HV 未実施・PR 未作成。** merge = 即本番公開（late catalog は本番 ON）。Owner の HV と最終承認まで PR を作らない。
基準: `origin/main` = `a4e608a`（#690 V1 取り込み後）。ブランチ `claude/pr2-late-wasabi-tarako-jrzmm3`。設計: `docs/design/TETO_PR2-LATE4_DESIGN-GATE_2026-10-27.md`。
旧ブランチ `claude/pr2-late-wasabi-bulgogi-mentaiko`（3 レシピ案）は参照のみ。merge / rebase / cherry-pick はしていない。プルコギと焼肉は **HOLD（含めない）**。元の commit `1dccdfe5` は取得できず、Owner 決定（2026-10-28）と設計書・旧ブランチから再構築した。

## 内容（すべて GAMEPLAY ASSUMPTION / 暫定。原典 pizzadb.jp は未確認）
| レシピ | 構成 | late step（導出） |
|---|---|---|
| `wasabi-beef-pizza`（わさび牛ピザ） | soy-sauce 1 (PAINT) / mozzarella 2 / onion 1 / beef 3 / wasabi 1 (POST_BAKE) | **67**（`soy-sauce` + `wasabi`、cohort key = wasabi） |
| `tarako-cream-pizza`（たらこクリームピザ） | fresh-cream-sauce 1 (PAINT) / mozzarella 2 / cod-roe 2 + nori 1 + shiso 1（すべて POST_BAKE） | **68**（`cod-roe` + `fresh-cream-sauce` + `nori`、cohort key = nori） |

- 図鑑発見ターゲット ID: `tarako-cream-pizza` → `mentaiko-cream-pizza-pizzadb-p4`（維持）。`wasabi-beef-pizza` → `wasabi-beef-pizza`。レシピ id は Owner 指定の `tarako-cream-pizza`（旧ブランチの `mentaiko-cream-pizza` から変更）。
- floors（固定）: soy-sauce / wasabi 67、cod-roe / fresh-cream-sauce / nori 68。既存 8 件は不変。
- 新食材 5 件: `soy-sauce`（`#2a1a12`、醤油ソース）/ `fresh-cream-sauce`（`#efb9b4`、HV 修正後。初版 `#f2cfc0`、クリームソース、新規採用）/ `wasabi`（spice, xs）/ `cod-roe`（seafood, xs）/ `nori`（vegetable, xs、暫定）。
- 描画（V1 Style Lock v2 語彙: 2.4 の輪郭・2 トーン・足元の影・id/gradient/defs なし・64×64、1.2em 補正は独立ルール）: `beef-slices`（既存 `beef` に `pieceVisual` 追加）/ `wasabi-dab` / `cod-roe-mass` / `nori-strips`。**V1 の SVG・CSS は無変更。**
- 同期した表: 注文 2、Reference 2、hint role（key-free）2、sauce profile（PAINT）2、taxonomy 3 行、size class 3、テスト用 manifest（`LATE4_BATCH`）、`LATE_ADDITION_RECIPE_IDS`。

## 旧ブランチからの再利用 / 変更
- 再利用（読み取りのうえ手で再配線）: 2 レシピ・注文・5 食材・Reference の定義文。
- 不採用: bulgogi 一式（レシピ・注文・target・step 66・floor・matcher の ownerApproved 追加）。
- 変更: step 構成（soy-sauce を わさび牛の step に統合）、floors 67/68、SVG（線幅 2.2→2.4、参照 SVG の語彙へ）、`beef-slices` を新規追加、テスト・golden・件数 pin は 2 レシピで再計算。

## 検証
- `tsc -b` エラー 0。`oxlint` エラー 0（警告は既存のみ）。
- Vitest（`src/state` `src/logic` `src/data`）: **358 files passed / 7,480 tests passed**（DH4 独立攻撃者 sweep を含む、assertion・timeout 無変更）。`src/components`: IngredientGlyph 151 passed を含め全 pass。
- `TETO_PINSA_OFF=1`（data / state / catalog / materialShop / discovery / testSupport / IngredientGlyph）: 5,834 passed、`pinsaGate.test.ts` の 2 件を追従して 9/9。
- golden: `hint5.ladders55.json` は **+502 行・削除 0**（既存エントリ byte 同一）。`hint5.alphaFamilyOnly.json` と DH4-1 AUDIT.json は新レシピ・食材の追加分のみ（privacy assertion は無変更）。
- 新規 `lateCatalog.late4.test.ts`（20 件: OFF で痕跡なし、データ、Reference、識別の一意性、ladder 67/68、Shop、Research、floors、実 reducer の NEW_DISCOVERY / ORIGINAL）と `IngredientGlyph.test.tsx` の新 describe。
- e2e（Chromium、`e2e/late4.spec.ts`、390×844 / 360×800）: 6/6 passed（2 レシピを通しで遊ぶ、保存データ互換: 未起動セーブが 5 食材を load 時に付与し Shop を開いても書き換えない、`schemaVersion` 2 不変）。WebKit・他 spec は未実施（CI に任せる）。
- 保存データ互換: スキーマ変更なし。新食材は ladder による load 時付与（既存の late 機構）。

## HV 成果物
- スクリーンショット（コミット済み）: `docs/reports/screenshots/pr2-late4/` — `beef-before-after-{tray-sauce,topped,finish-garnish}-{390,360}.png`（beef の絵文字 → SVG）と、2 レシピのトレイ・ソース塗り・具材・仕上げ・NEW DISCOVERY（390×844 / 360×800）。
- HV 動画（390×844）は Playwright `HV_VIDEO=1` で録画できるが、**リポジトリに含めない方針のため未提出**。Owner の実機 HV を優先する。

## 視覚確認の所見（視覚修正は 0 回）
- 醤油ソース `#2a1a12`: 生地と明確に区別できる（濃い茶）。
- クリームソース: 初版 `#f2cfc0` は塗布後に生地との差が小さかった（Owner HV A 要改善）。修正版 `#efb9b4` に変更（生地との dE76 約 27、他ソースとの最小 dE76 25 以上）。
- `beef-slices`: 絵文字（🐄）より一目で牛薄切り肉に読める。ベーコン / ハムとの取り違えは **実機で要確認**。
- `wasabi-dab` / `cod-roe-mass` / `nori-strips`: xs サイズで盤面上は小さい（特に 360×800 のわさび）が、淡緑の山・珊瑚色の粒・暗緑の細片として識別できる。

## 既知の懸念 / 残課題
1. 色（soy-sauce / fresh-cream-sauce）と、xs 3 食材の盤面上の小ささは Owner の実機 HV で最終判断（HV 不合格の SVG は採用しない）。
2. `nori` の family = `vegetable` は暫定（`other` は DH4 で到達不能、`seafood` / `herb` は誤表示）。整合性テストは pass。
3. たらこの `mid_bake` は POST_BAKE で近似（原典の事実ではない）。レシピ id の `tarako` と target id の `mentaiko` の不一致は Owner 決定どおり。
4. 参照 SVG（`docs/design/references/ingredient-icons-2.0/`）と Style Lock の追記は、HV 合格後に行う（今回は未昇格）。
5. 元 commit 1dccdfe5 は未確認。Owner の手元仕様との差分があれば指摘が必要。
6. Safari 実機・WebKit e2e は未実施。

## PR 作成可否
**Owner の実機 HV と最終承認があるまで PR を作成しない。** 自動検証は pass。承認後に PR を作る（merge は別途 Owner 承認）。

## Owner 画像 HV の結果と修正（1 回、2026-10-28）
HV: A 要改善（クリームソースのみ）/ B PASS / C 条件付き PASS（サイズ改善推奨）/ D PASS / E PASS。
修正（最小）:
1. `fresh-cream-sauce` の色 `#f2cfc0` → `#efb9b4`（`lateCatalog.ts`、テストの pin を追従）。縁の陰影は触っていない。
2. xs 3 食材の盤面表示サイズ: `.ingredient-glyph--wasabi-dab` を 1.75em（margin -0.375em）、`--cod-roe-mass` / `--nori-strips` を 1.4em（margin -0.2em）に。`--beef-slices` は従来の 1.2em の独立ルールに分離（変更なし）。実測: 盤面上のわさびは 約 11px → 約 16px（390×844、360×800 とも）。
3. 変更していないもの: `beef-slices`・`soy-sauce`・V1 の SVG と CSS、SVG の描画、食材 ID・ladder・floors・保存データ。
前後比較: `docs/reports/screenshots/pr2-late4/hv-fix-before-after.png`（390×844 / 360×800、BEFORE = 764b80f4）。`after-*.png` は修正版に差し替え済み。旧版の HV 比較シート 3 枚（`hv-comparison-sheet-*`）は修正前の記録として残す。
検証: `tsc -b` 0、oxlint エラー 0、関連 Vitest 6 files / 338 passed（late4、lateCatalog、IngredientGlyph、DH4 監査、catalogLedger、materialShop）、e2e（390×844 / 360×800）6/6 passed。全件再実行はしていない（変更は色 1 値と CSS のみ）。
残る懸念: cod-roe / nori は 1.4em で「軽い改善」に留めた。再確認は実機 HV で。
