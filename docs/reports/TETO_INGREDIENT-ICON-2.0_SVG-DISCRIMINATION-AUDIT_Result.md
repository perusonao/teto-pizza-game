# Ingredient Icon 2.0 — 既存食材 SVG の実寸識別性監査 Result Report

Status: **監査 + 比較用アセット（docs / assets のみ）。本番コード・保存・採点・レシピ・Research は変更していない。`IngredientGlyph.tsx` / `ingredients.ts` / `App.css` も未編集。**
Base: `main` `c69cb2b`（2026-11-05 時点）/ branch `claude/teto-pizza-svg-audit-0dl3mt`。対象 Issue: #417（親）/ #733 / #739。
Steam（#738、H11）とは別作業。あさり・ムール貝は対象外。

## 0. 前提の確認（最新 main・Style Lock V2・既存 HV・claim）

- **#739 は main に実装済み**（#740 `d927878`）。梅肉は `umeboshi-paste-dab`（ペースト＋梅の花）、しらすは魚 1.5 倍・輪郭 `#2e2a1d`/2.8・箱 1.35em。**🍑 は main では既に表示されない**（テキスト fallback のみ）。よって梅肉・しらすの評価は「#740 適用後の現行 main」を対象にした。#740 の Owner HV / iPhone Safari は未記録（その Result: `TETO_ISSUE-739_ICONS_Result.md`）。
- **#733（beef / green-pepper）は未着手**（Issue にコメント・claim なし）。
- **`okra` / `green-beans` はゲームに存在しない食材**（`src` に該当 ID なし）。これらは「見間違えられる実物」として比較用に簡易描画した（`ref-*.svg`、ゲームに入れない）。
- **bacon / ham は main では絵文字**（🥓 / 🍖、`pieceVisual` なし）。Style Lock §1b の `bacon.svg` / `ham.svg` は承認済みだが未実装。したがって beef は「現行の絵文字」と「承認済みの将来 SVG」の両方と比べた。
- Style Lock V2 §1c / §11.4: 承認済みデザインの変更は Owner の明示承認が必要。green-pepper は GP-A2 が **Owner 承認済み（§11.1、iPhone Safari HV 合格 2026-11-01）**。beef は「PR-2 late4 の暫定採用（最終は HV）」（`IngredientGlyph.tsx` のコメント）。
- Claim / 重複: #417 の 2026-11-05 コメントで、#748 が `ingredients.ts`、#738 が `PizzaStage.tsx` を占有。**本作業は docs / assets のみで、これらに触れない。** 既存の Tray/Raw/Baked 監査（`claude/ingredient-icons-svg-ojwgap`）と #751 は再作成していない。
- 本作業は監査のため、HV Policy §2 の「Audit-only」「docs-only」に該当し、**HV 動画は作らない**（コミットするのは静止画のみ）。

## 1. 方法と環境（ブラウザ検証であり Owner 実機確認ではない）

| 項目 | 内容 |
|---|---|
| 実アプリ撮影 | 本 repo の dev server + Playwright Chromium、390×844、deviceScaleFactor 2。Research ラウンドで牛肉・ベーコン・ハム・ピーマン・しらす各 2 個を配置（トマトソース / 梅肉ソースの 2 回） |
| 修正前後 | 同じ画面で DOM の `svg` の中身だけを候補に差し替えて再撮影（**位置・回転・焼成状態が同一**）。ソースは未変更 |
| 実寸比較 | 32 / 24 / 20px（DSF 1）。背景はゲームの実測色（Tray chip / 生地 / トマトソース / 梅肉ソース / 焼成後 生地・ソース / RESULT chip / グレースケール）。per-visual の 1.2〜1.5em 補正は main の値を再現 |
| 制約 | Linux の Noto Color Emoji（iPhone の Apple 絵文字ではない）。焼成フィルタは実画面（baking / RESULT）でのみ確認し、実寸表は色サンプルの近似。**iPhone Safari 実機は未実施（Owner の確認事項）** |

画像は `docs/reports/screenshots/ingredient-icons-svg-audit/`。

## 2. 現在表示の分析（原因を 色 / 形 / 線幅 / 背景コントラスト に分解）

コントラストは WCAG 比（実測の背景色: Tray `#fff8ea` / 生地 `#ebcb90` / 生ソース `#d46f52` / 焼成生地 `#e0a353` / 焼成ソース `#d4833d`）。

### 2.1 beef ↔ bacon / ham

| 観点 | 所見 |
|---|---|
| 形 | 細長い 2 本の帯 + 白い脂筋。**将来の `bacon.svg`（赤 + クリーム縞の波帯 2 本）と同じ「平行な帯 + 白い筋」の文法**。現行の絵文字 🥓 は波打つ橙で、現状は色と波形で区別できる |
| 色 | 本体 `#b8473a` / `#8f3a30` と ham.svg `#ea8f98` ・bacon.svg `#d8484a` は同じ暗〜中赤の系統。グレースケール化すると beef と bacon.svg はほぼ同じ「暗い帯 + 明るい筋」 |
| 線幅 | 輪郭 `#4a1a14`/2.4 は Style Lock 共通。差別化要因にならない（どの肉系も同じ） |
| 背景 | 本体 vs 生ソース 1.55:1、焼成ソース 1.78:1。**ソース上では輪郭（4.3〜4.9:1）頼み**。20px では輪郭が潰れ、暗い赤い塊に見える |
| 結論 | 現行の絵文字 bacon / ham とは区別できるが、**承認済みの bacon.svg / ham.svg が入ると形・色・グレースケールで近くなる**。20px の暗赤の細片という弱さは現状でもある |

### 2.2 green-pepper ↔ okra / green-beans（さやいんげん）

| 観点 | 所見 |
|---|---|
| 形 | **3 本の弧が平行に積まれた形は、さやいんげんの 3 本束と実寸ではほぼ同一のシルエット**（20px ではどちらも「緑の線 3 本」）。ピーマンらしい手がかり（ヘタ・空洞・肩）が無い |
| 色 | 本体 `#5fa83a` vs さやいんげん `#78b94a`（ΔL 小、比 1.24:1）。色では区別できない |
| 線幅 | 太い輪郭 `#2c5a1c`/2.4 + 内側のハイライトの文法がオクラ・いんげんの絵にもそのまま当てはまり、差が出ない |
| 背景 | 本体は焼成ソース上で 1.00:1（同明度）・焼成生地上 1.33:1。**輪郭（2.75〜3.69:1）だけで成立**しており、20px で輪郭が細ると緑の線の束になる |
| 結論 | 問題あり。主因は **形**（細長い曲線 3 本）で、色・線幅は副因 |

### 2.3 whitebait（#740 適用後）

| 観点 | 所見 |
|---|---|
| 形 | 魚 3 匹の重なり。尾・目・背の青灰色が 20px でも残る。生地上でも「小魚」と読める |
| 色 | 体 `#fbf9f1` は焼成生地 2.09:1・生ソース 3.22:1と低いが、**濃い輪郭が補う** |
| 線幅 | 輪郭 `#2e2a1d`/2.8（×1.5）。生ソース 4.23 / 焼成生地 6.51 / 焼成ソース 4.86 / Tray 13.6 |
| 背景 | 実画面（390×844 の生・焼成・RESULT）で 3 匹の魚が判別できた |
| 結論 | **PASS**（#740 の改善が実寸でも効いている）。大葉（shiso）が小さい件は #739 で対象外のまま |

### 2.4 umeboshi-paste（#740 適用後）

| 観点 | 所見 |
|---|---|
| 形 | 赤い半球 + 白い 5 弁の花。**桃の絵文字（ハート型・橙・葉）とは全く別の形**。20px でも花の 5 弁が残る |
| 色 | `#b8405a` は Tray 5.07:1・生生地 3.44:1。生ソース 1.58 / 焼成ソース 1.82 では本体が溶けるが、輪郭 `#6e1f35`（3.2〜3.7:1）で形は保てる。梅肉の色は #739 の Non-goal（変更しない） |
| 使用場所 | Tray / Shop / Dex / RESULT の chip（ソースは canvas に塗るため生地上に glyph は出ない）。RESULT chip 背景（淡い紫）では 5:1 以上 |
| 結論 | **PASS**（🍑 の問題は解消済み）。残リスク: 26px chip での梅らしさと iPhone Safari は Owner 実機で確認 |

## 3. Tray / ピザ上 / 焼成中 / RESULT での識別性（実アプリ、390×844）

| 場面 | beef（現行） | green-pepper（現行） | whitebait | umeboshi |
|---|---|---|---|---|
| Tray chip（26px 枠） | 暗赤の帯。肉系だが ham・bacon（絵文字）とは別 | **緑の線 3 本。野菜トレイでピーマンと読みにくい** | 小魚 3 匹で判別可 | 赤い半球 + 花で判別可 |
| ピザ上（生） | 暗赤の細片。ソース上で目立たない | 緑 3 本が束ねて置かれ「さやいんげん」に見える | 判別可 | —（ソースは塗り） |
| 焼成中 | 焼成ソースと同明度で暗い塊 | 緑は保たれるが形が線の束 | 輪郭で判別可 | — |
| RESULT（ピザ・chip） | chip は読める。ピザ上は小さい | chip・ピザ上とも線の束 | 判別可 | chip で判別可 |

## 4. 判定

| 食材 | 判定 | 根拠 |
|---|---|---|
| beef | **NEEDS FIX（優先度: 中）** | 現行 main の絵文字 bacon / ham とは区別できるが、承認済み `bacon.svg` と形・色・グレースケールが近く、ソース上で弱い。#733 の指摘と一致 |
| bacon / ham | 対象外（絵文字。SVG 化は Style Lock で承認済みの別 Pilot） | 評価は beef との比較のみ |
| green-pepper | **NEEDS FIX（優先度: 高）** | 20〜32px でさやいんげんと同じシルエット。形が主因 |
| whitebait | **PASS** | #740 の改善後、全場面で判別可 |
| umeboshi-paste | **PASS（Owner 実機確認待ち）** | 🍑 は解消済み。ブラウザ検証のみ |

## 5. 改善案の制作と修正前後の評価

候補（`docs/design/candidates/ingredient-icons-2.0-svg-audit/svg/`、64×64・線幅 2.4・接地影・id/gradient/defs なし）:

| 候補 | 評価（実寸 32/24/20・実アプリ同一条件） |
|---|---|
| **beef B（角切り 2 塊）** | 角のある立体で、帯（bacon）・骨付き（ham）・丸（pepperoni 系）のどれとも輪郭が違う。グレースケールでも別物。20px でも「小さな塊 2 つ」と読める。ソース上の明度は面ごとに差があり（上面 `#cf6a58`、側面 `#7a2c24`）、現行より輪郭が追いやすい。**採用候補** |
| beef C（グリル跡の厚切り） | 大きく読みやすいが、丸い暗赤が sausage / pepperoni 系の丸と衝突しうる。不採用 |
| **green-pepper H（ヘタ付き縦半割）** | ヘタ + 肩 + 淡い空洞と種で「ピーマン」と読める。さやいんげん・オクラとは形が全く違う。20px でも残り、実画面（Tray・ピザ上・焼成中・RESULT）で判別可。**採用候補** |
| green-pepper D（角切り 3 片） | 形は変わるが青ねぎの輪の房（採用済み）と衝突。不採用 |

修正前後（同一画面）: `ingame-390x844-tray-beef.png` / `-tray-pepper.png` / `-topped-raw.png` / `-baking.png` / `-result-pizza.png` / `-result-chips.png`。実寸表: `sheet-A`〜`D`（`-actual-32-24-20px` と `-zoom4x`）。
サイズ補正は、beef B は現行 beef と同じ 1em（補正なし）、green-pepper H は現行と同じ 1.45em で評価した（変更なし）。実装時に補正値は再確認が必要。

## 6. 採用候補の記録（未決の Style Lock 判断を含む）

| 食材 | 採用候補 | 必要な Owner 判断 |
|---|---|---|
| beef | `beef-b-chunks.svg`（`beef-slices` の差し替え。`pieceVisual` 名は別途） | beef は暫定採用のため、最終デザインの採用判断。bacon / ham の SVG 実装時期とセットで決めると比較が安定する |
| green-pepper | `green-pepper-h-half.svg` | **Owner 承認済みの GP-A2（Style Lock v2 §11.1）の置換になる。** §11.4 のとおり、明示承認と Style Lock の改訂が要る。承認されない場合は現行を維持し、NEEDS FIX は残る |
| whitebait / umeboshi-paste | 変更なし | #740 の Owner HV / iPhone Safari の結果待ち |

実装する場合は新 Issue（Owner 起票）。`ingredients.ts`（#748 の claim）・`IngredientGlyph.tsx`・`App.css`（HOT）に触れるため、claim の確認と最新 main からの着手が必要。Pilot B（チーズ）は HOLD のまま変更しない。

## 7. 検証区分

| 区分 | 内容 | 状態 |
|---|---|---|
| ブラウザ検証（Chromium、390×844、Linux 絵文字） | 実寸比較・実アプリの修正前後 | 実施済み（本書） |
| WebKit / 360×800 | — | **未実施** |
| **Owner の iPhone Safari 実機確認** | 26px chip・20px の実寸・Apple 絵文字（bacon/ham）との並び | **未実施。ブラウザ検証を Owner の確認とみなさない。PASS 扱いにしない** |
| 動画 HV | Audit-only のため対象外（Policy §2） | — |

SVG 規約の機械確認: 候補 7 点とも `id=` / `<defs` / `gradient` / `url(#` なし。
