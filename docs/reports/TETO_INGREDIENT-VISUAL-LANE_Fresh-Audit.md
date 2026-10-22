# 食材ビジュアル改善レーン — Fresh Audit（棚卸し・優先順位・受け入れ条件）

Status: **調査のみ（docs-only）。runtime / CSS / SVG / テストの変更なし。共有 Preview 更新なし。本番 FINISH 有効化なし。既存 PR の変更・merge なし。新規 PR は Owner 承認まで作らない。**

> **2026-10-22 更新（docs 整理）:** 本書の食材ビジュアル Pilot D の依存・決定は、Style Lock `TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md` §0-7 / §10 が正。**#584 は HOLD、ikura の正規経路は #621、Pilot D（#623）は #621 の merge 後、Pilot B は #438 の Owner HV 記録待ち。** 本書の「#584 との競合・依存」の記述は、#584 を #621 に読み替える。
Audited: `main` `d70bd20`（2026-10-22）。対象 Issue: #417 / #438 / #479 / #514 / #421 / #486 / #476。
関連 authority: `docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md`（Style Lock v2。**変更しない**）。

> 確認方法の限界: コード・Issue・PR 本文は読んだ。**実機（iPhone）・WebKit・実描画のスクリーンショットは取っていない**（調査のみ・`node_modules` 未使用）。視認性の数値は既存 Result Report と PR #584 本文の記録を引用したもので、本書で再測定していない。

## 0. 結論（先に）

1. **`docs/PROJECT_HANDOFF.md` と Style Lock v2 冒頭の「実装は未着手」は古い。** Pilot A（hot-dog / sausage / feta / ricotta）は main に入っている。さらに Batch 8b で **shiso / whitebait の専用 SVG が本番に入っている**（Style Lock の 26 種の外）。HANDOFF は HOT file のため本書では直さない。
2. **Style Lock 26 種のうち実装済みは 4 種（+ 既存維持の clam）。未実装は 21 種。** うち **salmon と cream-cheese は、PR #584（Batch 8c）のいくらとサーモンのピザの主役 2 食材**なのに、絵文字 / 汎用 CSS 円のまま。#584 が merge されると **専用 SVG の salmon-roe と、絵文字 🍣 の salmon・汎用円の cream-cheese が同じピザに並ぶ**。
3. **サイズ分類（#479）は S1〜S3 まで本番に入り、RESULT 縮尺（#514）は 0.75 で本番採用済み。Canvas モッツァレラ（#486）は既定 ON が main に入っている。** 残りは「SVG の充填率が変わった後の見かけ補正」「iPhone 実機での再確認」「Canvas 周りの残課題」。
4. **#476（食材別 PLACE / SCATTER）は main では未実装。** ドラッグ可否は今も `["mozzarella","basil"]` 固定（`GameScreen.tsx:1113`）。統一 PR #478 は Draft のまま 11 日更新なし。食材別の操作差（PLACE / SCATTER の使い分け）は **Owner 決定で今回の対象外（D3）**。
5. **最初に着手すべき PR 案は「PR-1: salmon + cream-cheese の専用 SVG（Pilot D）」**。ただし **#584 の merge 後**（`IngredientGlyph.tsx` / `ingredients.ts` / `App.css` が重なる。§6）。

## 1. 重複・競合の調査（実施済み）

| 対象 | 状態 | 本レーンとの関係 |
|---|---|---|
| PR #584 Batch 8c（open・clean） | `salmon-roe-grains` の SVG を追加。`IngredientGlyph.tsx` / `ingredients.ts` / `App.css`（HOT）/ `PROJECT_HANDOFF.md`（HOT）を変更 | **最大の競合。** salmon / cream-cheese の SVG はこの merge 後 |
| PR #478（#476 S1・Draft・base `6b86798`） | トレイドラッグ統一。`GameScreen.tsx`（HOT）/ `IngredientTray.tsx` / `pieceDrag.ts` / `roundKind.ts` | 食材ビジュアルとは独立。ただし古く、`GameScreen.tsx` が HOT。Owner が再開か close かを決める |
| PR #468（#421 溶解表現の別案・open・HOLD） | `PizzaStage.tsx` / `App.css` の mozzarella 規則 | #486 の Canvas が既定 ON になり、役割が重なる。**扱いは Owner 判断（触らない）** |
| PR #581 / #615 / #620 / #587 / #612 | 四角生地 / FIN-E4 / 調理工程監査 / 原典証跡 | 食材ビジュアルのファイルとは重ならない（#615 は FINISH 基盤。本番 OFF） |
| Issue #537（Square-Pan D） | 具材・チーズ・RESULT の四角対応 | `PizzaStage` 系の将来競合。本レーンの runtime PR は #537 の claim を確認してから |
| Session claim | Issue #417 / #438 / #476 / #479 / #486 のコメントと本文に `teto-claim` ブロックは見つからなかった | PR 作成前に最新 Owner Gate と claim を再確認（`SESSION-OPERATIONS_1.0` §1） |

HOT file（`scripts/ops/hot-files.json`）: `src/App.css` / `GameScreen.tsx` / `recipes.ts` / `PROJECT_HANDOFF.md` / `e2e/support/**` ほか。本書は新規ファイル 1 つのみ。

## 2. 現行食材の棚卸し（描画経路ごと）

材料は `ingredients.ts` で sauce 3 / cheese 11 / topping 52。`pieceVisual`（専用 SVG）を持つのは **9 種**。

### 2.1 描画経路

| 場所 | 専用 `pieceVisual` あり | なし（絵文字 / CSS チーズ） |
|---|---|---|
| トレイ・在庫・Shop・Dex・RESULT 一覧 | `IngredientGlyph`（SVG） | 絵文字。**チーズは CSS 形状**（`category === "cheese"` かつ `pieceVisual` なし。`IngredientTray.tsx:523`） |
| ピザ上・CUT・RESULT | `IngredientPieceVisual` → SVG（チーズはラッパー内） | 絵文字 28px。チーズは `.pizza-cheese--<id>`（専用 CSS は mozzarella / gorgonzola / parmigiano / fontina のみ。他は汎用 20px 円） |
| サムネイル（`PizzaThumbnail.tsx`） | 同上 | 同上 |
| mozzarella | Canvas（既定 ON）→ 失敗時 M1（CSS） | — |
| サイズ | `--piece-rank-scale`（クラス B 0.7 / 0.85 / 1 / 1.15 / 1.3）。**mozzarella は免除**（倍率 1） | 同左 |
| RESULT | `--piece-phase-scale` 0.75。**mozzarella は免除** | 同左 |
| 焼成 | 全具材共通の連続カーブ。`bakeRoastResistant`（緑ハーブ）だけ緩い。チーズは `cheeseVisualFrame`。SVG 食材に専用の焼成表現はない | 同左 |

### 2.2 食材別ステータス（注目食材）

凡例: **本番** = main に入り本番バンドルに含まれる / **Preview 限定** = 本番バンドルに入らない切替・候補 / **PR 中** = main 未反映 / **未実装** = SVG なし。

| 食材 | アイコン（トレイ等） | ピザ上 | RESULT / CUT | 焼成表現 | サイズ区分 | ステータス |
|---|---|---|---|---|---|---|
| hot-dog / sausage | SVG | SVG | SVG ×0.75 | 共通カーブ | l / m | **本番（Pilot A）** |
| feta / ricotta | SVG | SVG（`.pizza-cheese--glyph` 内） | 同左 | チーズ用 `cheeseVisualFrame` | l / l | **本番（Pilot A）** |
| shiso | SVG | SVG | SVG ×0.75 | 緑ハーブ（`bakeRoastResistant`）か要確認 | xs | **本番（Batch 8b）**。Style Lock 外 |
| whitebait | SVG | SVG | SVG ×0.75 | 共通カーブ | s | **本番（Batch 8b）**。Style Lock 外 |
| **salmon-roe（いくら）** | SVG（PR #584） | SVG | 未計測（PR 本文: トレイ 31 / 生地上 24 / RESULT 18px） | 共通カーブ | 未登録（`m` 扱い）→ 分類表への追加が必要 | **PR 中**（#584）。main に食材 ID なし。参照 SVG も #584 内のみ |
| **salmon** | 🍣 絵文字 | 🍣 絵文字 | 絵文字 ×0.75 | 共通カーブ | l | **未実装**。参照 SVG `salmon.svg` は main にある（Style Lock A） |
| **cream-cheese** | 🧀 絵文字ではなく CSS 形状（未移行チーズ） | 汎用 20px 円（色だけ違う） | 同左 | `cheeseVisualFrame` | l | **未実装**。参照 SVG `cream-cheese.svg` は main にある（Style Lock A） |
| mozzarella | CSS（`pieceVisual` なし） | **Canvas（既定 ON）** / M1 フォールバック | Canvas（RESULT ×0.75 免除） | Canvas の溶解（`melt`） | l（**倍率免除**） | **本番（#486）**。SVG 化は Pilot C（未実施） |
| grana-padano / parmigiano / gorgonzola | CSS | CSS（parmigiano・gorgonzola は専用、grana は汎用円） | CSS | チーズ共通 | xs / s / m | **未実装**（Pilot B） |
| fontina / cashew-cheese / catupiry / goat-cheese | CSS | fontina のみ専用 CSS。他は汎用円 | CSS | チーズ共通 | l 系 | **未実装**（goat-cheese はデザインも未作成） |
| 肉 7 種 pepperoni / bacon / ham / chicken / salami / prosciutto-crudo / pork | 絵文字 | 絵文字 | 絵文字 ×0.75 | 共通カーブ | m〜xl | **未実装**（参照 SVG はある） |
| 魚介 anchovy / sardine / tuna / shrimp / salt-cod | 絵文字 | 絵文字 | 絵文字 ×0.75 | 共通カーブ | s〜l | **未実装**（参照 SVG はある） |
| fresh-tomato / capers / clam | 32×32 SVG | SVG | SVG | 共通カーブ | m / xs / s | **本番（既存維持）** |

### 2.3 Style Lock 26 種の照合

| 区分 | 件数 | 内訳 |
|---|---|---|
| 実装済み | 4 + 既存維持 1 | hot-dog, sausage, feta, ricotta / clam |
| 未実装 | **21** | Pilot B: grana-padano, parmigiano, gorgonzola ／ Pilot C: mozzarella ／ 残り 17: fontina, cashew-cheese, cream-cheese, catupiry, pepperoni, bacon, ham, chicken, salami, prosciutto-crudo, pork, anchovy, sardine, tuna, shrimp, salmon, salt-cod |
| 27 種目 | 1 | goat-cheese（デザイン未作成。Style Lock §9） |
| 26 種の外で実装済み | 2 | shiso, whitebait（Batch 8b、Owner 決定 OD-B8-2 amended） |
| 26 種の外で PR 中 | 1 | salmon-roe（#584） |

## 3. 表示サイズ・視認性・Style Lock v2 との不一致

| # | 事項 | 内容 | 根拠 |
|---|---|---|---|
| M1 | **文書の状態が古い** | Style Lock v2 冒頭・HANDOFF が「実装未着手」。Pilot A・8b は実装済み。§4.4 は §0-6（2026-10-17 改訂）と矛盾する記述が残る（ピザ上チーズは CSS 維持 ↔ `pieceVisual` ありは SVG） | `STYLE-LOCK-V2.md` 冒頭 / §4.4、`ingredients.ts:839,860` |
| M2 | **Style Lock 外の SVG** | shiso / whitebait / salmon-roe は 26 種に含まれない。参照 SVG は `references/ingredient-icons-2.0/` にあるが、決定表（§1b）には無い | `ingredient-icons-2.0/shiso.svg` 等 |
| M3 | **サイズ補正の方針と実装の差** | Style Lock §3 は「初期値は補正なし（1em）」。8b は shiso / whitebait に **1.2em + 負マージン**（`App.css:821-827`）、#584 は salmon-roe に同補正を追加。補正を CSS の個別クラスで足す方式が増えている | `App.css:821` |
| M4 | **クラス倍率との二重掛け** | shiso は xs ×0.7、whitebait は s ×0.85 のうえ glyph 側 1.2em。RESULT では ×0.75 も掛かり、**shiso の RESULT 上の実寸は 28 × 0.7 × 0.75 ≒ 14.7px（描画箱 1.2em で約 17.6px）**。20px 未満。**識別性は未計測** | `toppingSizeClass.ts`（B）、`resultScalePreview.ts` |
| M5 | **SVG 化後の見かけ補正が未確定** | S2c は「#503 の SVG 化後に見かけの大きさを再確認」と明記。Candidate C（`?toppingScale=c`）は **Preview 限定・iPhone で未確定**。hot-dog / sausage / feta / ricotta の充填率は絵文字時代と異なる | `TETO_TOPPING-SIZE-CLASSES_S2C_Result.md` |
| M6 | **Apple Color Emoji 未確認** | 見かけ面積の測定は Noto Color Emoji のみ。iPhone の絵文字では逆転の有無が違う可能性（残り絵文字食材のランク別見え方に影響） | #479 コメント（S4 表示確認） |
| M7 | **いくらのコントラスト** | 橙の粒が焼けた生地（橙）に載り、明度コントラスト約 1.0:1。識別は暗い輪郭（RESULT で 2.3:1）頼み。Style Lock 側に「橙 on 橙」の基準はない | PR #584 本文 |
| M8 | **ピザ上チーズ SVG の判定が `pieceVisual` 有無** | mozzarella を Pilot C で SVG 化すると、Canvas / M1 の分岐（`CheesePoolCanvas`）と衝突しうる。§0-6 は「別途確認」としたまま | `STYLE-LOCK-V2.md` §0-6 |
| M9 | **salmon の絵文字 🍣 は寿司** | 切り身の絵ではない。ピザ上で「サーモン」と読みにくい。cream-cheese の汎用円は他の汎用円チーズ（grana-padano ほか）と色以外区別できない | `ingredients.ts:746`、`App.css` 汎用 `.pizza-cheese` |
| M10 | **ミニ食材の可読性** | xs クラス（corn / capers / oregano / rosemary / parsley / shiso / mint）は ×0.7。360×800 での判読は #479 S2c で「要確認」のまま | `S2C_Result.md` |
| M11 | **Canvas モッツァレラの残課題** | 実物写真の基準が 1 枚、艶は控えめ、**iOS の canvas 破棄を実機で再現できていない**、`PizzaStage.tsx` で #468 と競合。#486 は close されていない | #486 コメント（2026-10-14） |

## 4. Issue / PR ごとの状態（実装済み／未実装／差し替え推奨）

| Issue / PR | 範囲 | 実装済み（main） | 未実装 / 保留 | 差し替え推奨 |
|---|---|---|---|---|
| **#417** Icons 2.0 | 27 種の SVG 化 | Pilot A 4 種、+ 8b の 2 種（範囲外）。`VISUAL_VIEWBOX` / チーズ分岐の共通基盤 | Pilot B・C、残り 17 種、goat-cheese（デザインから） | **salmon・cream-cheese・pepperoni・bacon（絵文字 / 汎用円）** |
| **#438** Pilot A | 4 種 + 基盤 | 4 種すべて `pieceVisual` あり | Issue は open のまま。Owner HV 結果の記録が Issue 上に見当たらない（コメント 0 件）。**HV PASS が Pilot B 着手の Gate** | — |
| **#479** Size Classes | 5 段階分類 | S1（表）、S2a/b/c（`--piece-rank-scale`、B 本番、mozzarella 免除）、S3 の CUT 当たり範囲 | 見かけ補正（候補 C は Preview 限定）、新規食材の分類追加（**salmon-roe は #584 で追加が必要**。mint は表にあることを確認、lamb・sweet-potato は未確認） | 幾何学形絵文字（⚫🔴🟤🟩）の見かけ補正は SVG 化と一緒に整理 |
| **#514** RESULT 縮尺 | `?resultScale=` | 本番 0.75（Owner が iPhone で採用）、Preview は 0.65–1.0 切替、mozzarella 免除 | Issue は close 済み | — |
| **#421 / #486** Canvas チーズ | mozzarella の溶解 | Canvas が**既定 ON**（`CHEESE_CANVAS_DEFAULT_ON = true`）、M1 フォールバック、`?cheeseCanvas=0` で戻す | #486 の残課題 6 点（§3 M11）。#468 は HOLD の open PR | mozzarella を SVG 化する場合の Canvas との切り分け（Pilot C） |
| **#476** PLACE / SCATTER | 配置操作 | なし。tap と mozzarella / basil のみのドラッグ（Guided） | #478（Draft）= S1 ドラッグ統一、S2 = adjusted フィードバック。SCATTER は D3 で対象外 | 食材別 PLACE / SCATTER は本レーンでは扱わない |

## 5. 食材別 PLACE / SCATTER（#476）の位置づけ

- Owner 決定 D1〜D9: **A（ドラッグ統一）のみ先行、SCATTER は今回実装しない（D3）、押し出し 9% は不変（D4）**。
- main は `draggableIngredientIds={["mozzarella", "basil"]}` のまま。#478 は `GameScreen.tsx`（HOT）を変えるため、**食材ビジュアルの PR とは別レーンで扱う**。
- 食材ビジュアル側からの前提: ドラッグ preview（指の 30px 上・固定サイズ）と着地後の大きさ（クラス倍率）が一致しない（#479 コメント）。クラス倍率が 0.7〜1.3 でも preview は一律。**#478 を進めるときの HV 項目**として記録する。

## 6. 最小実装 PR 案（複数候補・競合なし順）

どの案も **Owner 承認前は PR を作らない**。各案は `Depends-on` と claim を宣言してから開始する。

| 案 | 内容 | 触るファイル | 依存・競合 | 工数 | リスク |
|---|---|---|---|---|---|
| **PR-0（docs のみ）** 文書の鮮度回復 | Style Lock v2 の「実装未着手」の更新、§4.4 と §0-6 の整合、shiso / whitebait / salmon-roe の追記（Owner 承認が必要な authority 文書） | `STYLE-LOCK-V2.md`（HANDOFF は HOT のため別 PR / #584 merge 後） | なし | 小 | 低 |
| **PR-1（推奨）** Pilot D: salmon + cream-cheese の SVG | `salmon-fillet` / `cream-cheese-block` を追加。参照 SVG は main にある。トレイ・ピザ上・RESULT・Dex を SVG 化。cream-cheese は §0-6 の「`pieceVisual` あり → ラッパー内 SVG」に乗る | `IngredientGlyph.tsx`、`ingredients.ts`（2 行）、`IngredientGlyph.test.tsx`、必要なら `App.css`（補正 1 規則） | **#584 merge 後。** 重なる: `IngredientGlyph.tsx` / `ingredients.ts` / `App.css`（HOT）/ catalog テスト | 小〜中 | 中。salmon ↔ salmon-roe の橙同士の識別、cream-cheese ↔ feta / ricotta / mozzarella の混同（Style Lock §1c の HV 項目 2） |
| **PR-2** Pilot B: grana-padano / parmigiano / gorgonzola | Style Lock §5 どおり。grana ↔ parmigiano は形で区別 | PR-1 と同じ。**既存 CSS の `.pizza-cheese--parmigiano` / `--gorgonzola` の扱い（SVG 優先か）は §0-6 で確定済みの方式を踏襲** | PR-1 の後（同一ファイルの直列化）。#438 の HV PASS の記録を確認 | 中 | 中 |
| **PR-3** 肉 3 種: pepperoni / bacon / ham | 最も絵文字との差が大きい（⚫🔴 系の見かけ補正問題と bacon の過小表示を同時に解消）。見かけ補正（候補 C）の確定とセットにできる | `IngredientGlyph.tsx`、`ingredients.ts`、`toppingScalePreview.ts`（Preview のみ）、テスト | PR-1/2 の後。M5 の iPhone 確認が前提 | 中 | 中 |
| **PR-4（docs + 小 runtime）** 分類表の網羅 | `salmon-roe` を `toppingSizeClass.ts` に追加（#584 が追加しなければ）。網羅テストは厳格なので **#584 のレビューで確認すれば足りる可能性がある** | `toppingSizeClass.ts` | #584 内で解決済みかを先に確認 | 極小 | 低 |
| **PR-5（保留）** shiso / whitebait / salmon-roe の可読性調整 | M4 の二重補正を整理（RESULT で 20px 未満）。**計測 → Owner 判断 → CSS** の順 | `App.css`（HOT）、`toppingSizeClass.ts` | #584 merge 後。Preview の `?toppingScale=` 比較が使える | 小 | 低〜中 |
| **PR-6（保留）** mozzarella の SVG 化（Pilot C） | Canvas / M1 との分離方針が未決（M8）。Owner が決めるまで着手しない | — | #486 の残課題。#468 の扱い | 中 | 高 |

**PR-1 を最初に推す理由**
1. #584 が直接生む不整合（SVG と絵文字 / 汎用円の混在）を解消する唯一の案。
2. 参照 SVG が既に main にあり、デザイン判断（Owner 採用 A）は完了済み。**新しいデザイン判断を要しない。**
3. 2 食材 + 共通基盤は流用のみで、Pilot A / 8b と同じ作りの小さな差分。
4. 1 回の HV で「サーモン ↔ いくら」「クリームチーズ ↔ 他チーズ」を判定できる（Style Lock §1c の既知リスク 2 に直結）。

**#584 の merge を待てない場合の代替**: PR-0（docs のみ）を先に出し、PR-1 は #584 の merge 後に最新 main から開始する。#584 の中で変更せず、別 PR に分ける。

## 7. 優先順位と受け入れ条件

### 優先順位

| 順位 | 項目 | 理由 |
|---|---|---|
| P0 | #584 の merge 判断（Owner） | 他の SVG 案がすべて待つ。レーン外だが律速 |
| P1 | PR-1（salmon + cream-cheese） | 混在の解消。デザイン確定済み |
| P2 | PR-0（文書の鮮度回復）+ #438 の HV 結果の記録確認 | 次のセッションの誤読を防ぐ。HANDOFF は #584 後 |
| P3 | PR-2（Pilot B）→ PR-3（肉 3 種） | 見かけ補正（M5）と一緒に iPhone で判断 |
| P4 | PR-5（極小食材の可読性）、PR-4（分類表の網羅） | 計測が先 |
| 保留 | PR-6（mozzarella SVG）、#476 の SCATTER、#468、goat-cheese のデザイン | Owner 判断待ち |

### 共通の受け入れ条件（すべての runtime PR）

- `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` に従う: 390×844 の HV 動画（Owner へ直接提出・commit しない）+ before / after スクショ（`docs/reports/screenshots/<task-name>/`）+ Result Report。360×800 も確認。
- 変更は `pieceVisual` の追加（データ 1 行）+ `IngredientGlyph.tsx` の visual + テスト更新。**Save / scoring / economy / recipes / progression / Research authority に差分なし。**
- SVG は 64×64、`id` / gradient / `<defs>` なし、`aria-hidden`（Style Lock §2）。**Style Lock 済みデザインは変更しない**（変更は Owner の明示承認）。
- 未移行チーズが絵文字へ退行しない（§4.4 の分岐を維持）。mozzarella の Canvas / M1 に触れない。
- サイズ: 新しい visual に補正が必要なら **CSS の個別クラス**（8b と同じ方式）で足し、補正値と根拠を Result Report に残す。クラス倍率の表（`toppingSizeClass.ts`）は網羅テストが通ること。
- 共有 Preview は Owner 承認なしに更新しない。本番 FINISH 経路を有効化しない。

### PR-1 固有の受け入れ条件

1. `salmon` / `cream-cheese` が OS 絵文字・汎用円に依存せず、トレイ・在庫・Shop・Dex・ピザ上・CUT・RESULT・サムネで SVG になる。
2. 20 / 24 / 28 / 48px で、**salmon ↔ salmon-roe**（橙同士）、**cream-cheese ↔ feta / ricotta / mozzarella**（白系）が区別できる（赤背景・グレースケール含む）。
3. #584 のピザ（cream-cheese 2 / salmon 3 / shiso 1 / salmon-roe 2）を RESULT まで通して表示し、4 種が並んで読み分けられる。
4. 既存 SVG 9 種と未移行食材の表示が不変（既存の `IngredientGlyph.test.tsx` の絵文字行テストがそのまま通る）。
5. チップ幅・高さ・タップ領域・family filter 行が悪化しない（390×844 / 360×800）。
6. cream-cheese の汎用円 CSS（`.pizza-cheese`）に触れない（`pieceVisual` ありのラッパー内 SVG のみ）。

### 観察項目として記録（PR にしない）

- iPhone 実機での Apple Color Emoji 見え方（M6）。
- #478 のドラッグ preview 固定サイズと着地後サイズの差（§5）。
- #486 の残課題 6 点。

## 8. Owner に判断を求める点

1. **#584 の merge 順**。PR-1 以降はこれを待つ。
2. **PR-1 を最初に着手してよいか**（Pilot D としてよいか。Style Lock §5 の Pilot 表への追記が必要）。
3. **shiso / whitebait / salmon-roe を Style Lock に追記するか**（authority 文書の変更のため承認が必要）。
4. **#438 の HV 結果の記録先**（Issue にコメントなし）。Pilot B の Gate の根拠になる。
5. **#468 / #478 の扱い**（close / 再開 / 保留）。本書は触らない。
6. 見かけ補正（Candidate C）を iPhone で確定する時期。

---
_調査のみ。実装・Preview 更新・PR 作成は Owner 承認後。_
