# T7 — サイズ補正値の一覧表（Size Correction Inventory）

Status: **docs-only（読み取りのみ）。コード・CSS・golden 未変更。値は `src/App.css`・`src/data/toppingSizeClass.ts` の現物（main `06cfc06`）から転記した算出値で、実機の見え方ではない。**
Issue #417 / claim: #417 コメント 6703658614（`TETO_ICON-AUDIT_T7_*`）/ Owner 決定 6703774686（補正値の新規 docs 一覧表は GO。倍率変更は HOLD）。
姉妹書: `TETO_ICON-AUDIT_T7_Device-Measurement-Plan_2026-11-07.md`。

## 0. 読み方

- 箱 = `IngredientGlyph` の描画箱（`width/height`）。`margin` は負値で、レイアウト上の占有を 1em に戻す（`-(box-1)/2 em`）。
- 実効 px = `28px × rank倍率 × (RESULTなら 0.75) × 箱(em)`。ピザ上のフォント基準は 28px（`App.css:795-801`）。**矩形の箱の大きさ**であり、見える絵の大きさ（充填率）ではない。
- rank 倍率: xs 0.7／s 0.85／m 1／l 1.15／xl 1.3。mozzarella は免除。
- 「計測」列は、実機で測られているか。**実機計測済みと書けるのは Owner の iPhone HV の記録がある項目のみ**。

## 1. 補正の方式（現状）

1. 絵文字（補正なし）: 箱 = 1em（テキスト）。
2. 専用 SVG の既定: `width/height: 1em`、`vertical-align: -0.125em`（`App.css:~815`）。
3. 64×64 の余白ぶんを補う個別補正: `width/height` を `X em`、`margin: -(X-1)/2 em` で 1em 占有を維持。
4. トレイチップ内の専用上書き（`.ingredient-chip …`）: arugula、bell-pepper のみ。
5. 影の抑止（Pilot E の 3 種）: ピザ上だけ接地影の楕円を非表示。

## 2. 補正値一覧（SVG 食材）

| 箱 em | margin | 対象 visual（CSS クラス） | 由来（CSS コメント） | 計測 |
|---|---|---|---|---|
| 1.0（既定） | — | 上記以外の専用 SVG（hot-dog, sausage, feta, ricotta, clam, fresh-tomato 以外 等） | Style Lock §3「初期値は補正なし」 | 一部（各 Result） |
| 1.15 | −0.075 | tomato-slice | Human-approved fresh-tomato | Human |
| 1.2 | −0.1 | salmon-roe-grains, green-onion-slices, shrimp-curl, sesame-seeds, pomegranate-aril, cilantro-leaf, rosemary-sprigs, oregano-flakes, spinach-leaves, artichoke-quarter（共通ルール） | Batch 8b/8c/B-1/U2、R2 ハーブ | 390×844／360×800（Chromium）。herb 4 種は R2 決定 |
| 1.2 | −0.1 | pickle-slices, wurstel-links, paprika-powder-pile | Ingredient Visual V1 | Chromium で測定 |
| 1.2 | −0.1 | beef-slices | PR-2 late4（#733 で角切り＋断面に） | #733 HV |
| 1.2 | −0.1 | cinnamon-powder-pile | Batch 14（PROVISIONAL） | HV |
| 1.2 | −0.1 | salmon-fillet, cream-cheese-block | Pilot D（#623） | Owner 決定 2026-10-22 |
| 1.3 | −0.15 | porcini-slice, mussel-shell | B11 S1（PROVISIONAL） | Chromium 390/360 |
| **1.35** | −0.175 | **whitebait-school**（#739 で 1.2→1.35）, **shiso-leaf**（#758 で 1.2→1.35） | Owner P1／#758 | #739 は Chromium＋HV 動画、**実機は未確認** |
| 1.4 | −0.2 | cod-roe-mass, nori-strips | PR-2 late4 Owner HV 2026-10-28 | Owner HV |
| 1.45 | −0.225 | green-pepper-strips, pineapple-wedges | Pilot E（#715） | Owner iPhone HV 2026-11-01 |
| **1.5** | −0.25 | sour-cream-dab, umeboshi-paste-dab | #739（梅肉）／B17 | Chromium。実機未確認 |
| 1.65 | −0.325 | bell-pepper-quarter | Pilot E | Owner iPhone HV 2026-11-01 |
| 1.75 | −0.375 | wasabi-dab, arugula-leaves | PR-2 late4／arugula | Owner HV |
| チップ専用 | — | `.ingredient-chip` 内: arugula 1.25em、bell-pepper 1.35em | 26px のチップ箱に収める | Owner HV（bell-pepper） |

注: 上表は CSS に現れる visual を転記した。`pieceVisual` を持つ 33 種のうち、CSS に個別ルールがないものは既定の 1em（絵文字相当）。**どの食材が既定のままかの完全一覧は、着手時に `ingredients.ts` と突き合わせて確定する**（本書は CSS 側から作成。突き合わせは未実施）。

## 3. 実効サイズ（ピザ上・28px 基準、箱の算出値）

| 食材（クラス） | rank | 箱 em | ピザ上 px | RESULT px(×0.75) | メモ |
|---|---|---|---|---|---|
| corn（xs・絵文字） | 0.7 | 1.0 | 19.6 | **14.7** | 絵文字。見かけの面積は Apple Color Emoji で違い得る【未確認】 |
| parsley（xs・絵文字） | 0.7 | 1.0 | 19.6 | **14.7** | 同上 |
| mint（xs・絵文字） | 0.7 | 1.0 | 19.6 | **14.7** | 同上 |
| capers（xs・SVG） | 0.7 | 1.0 | 19.6 | 14.7 | 既定の 1em |
| green-onion（xs・SVG） | 0.7 | 1.2 | 23.5 | 17.6 | |
| cilantro（xs・SVG） | 0.7 | 1.2 | 23.5 | 17.6 | |
| oregano／rosemary（xs・SVG） | 0.7 | 1.2 | 23.5 | 17.6 | R2 決定 |
| paprika-powder（xs・SVG） | 0.7 | 1.2 | 23.5 | 17.6 | |
| shiso（xs・SVG） | 0.7 | 1.35 | 26.5 | **19.9** | #758 で 23.5→26.5（CSS コメント記載） |
| whitebait（s・SVG） | 0.85 | 1.35 | 32.1 | 24.1 | #739 で 28.5→32.1 |
| salmon-roe（m 扱い） | 1.0 | 1.2 | 33.6 | 25.2 | 分類表の確認は別件 |
| green-pepper（m 前後） | — | 1.45 | 要クラス確認 | — | クラスは着手時に確認 |
| bell-pepper（—） | — | 1.65 | 要クラス確認 | — | チップは 1.35em |

【推論】xs 食材は RESULT で箱 14.7〜19.9px にばらつく。**同じクラスの中で補正の有無により最大 約 5px の差**がある（絵文字・既定 1em は 14.7、shiso は 19.9）。絵文字の見かけ面積は箱より大きいことが多い（`.ingredient-glyph--tomato-slice` のコメント: 「絵文字は 1em の箱を overfill」）ため、**箱の数字だけで優劣を決めない**。実機計測（Device-Measurement-Plan）の結果を見てから判断する。

## 4. 気づいた不整合・注意（変更提案ではなく記録）

| # | 事項 | 内容 |
|---|---|---|
| N1 | 補正の分散 | 個別ルールが `App.css` の 2 か所（~815〜917 行、~8303〜8386 行）に分かれる。新規はファイル末尾の「Pilot E」ブロックのように追記される傾向 |
| N2 | 値の揺れ | 同じ「64 箱の余白補正」でも 1.15／1.2／1.3／1.35／1.4／1.45／1.5／1.65／1.75 と段階が多い。根拠は各 Owner HV 記録にあるが、**統一の方針は無い**（Style Lock §3 は初期補正なし） |
| N3 | チップだけ別寸 | arugula と bell-pepper のみ `.ingredient-chip` で縮小。他の大きな補正（wasabi 1.75em 等）のチップでの収まりは本書では未確認 |
| N4 | 二重の掛け算 | rank 倍率 × 箱 em × RESULT 0.75 の積。shiso は xs×1.35em で RESULT 19.9px だが、同じ xs の絵文字は 14.7px |
| N5 | #771 | 結果チップの `li.original-pizza__ingredient`（`padding: 2px 8px; font-size: 12px`）で、bell/green-pepper の負マージン −0.225em＝−2.7px の張り出し。見た目の重なりは未確認 |
| N6 | 本書の網羅性 | 追加中の PR（#782 eggplant 輪切り等）の値は含まない（未配線） |

## 5. HOT ファイルの扱い

`src/App.css` は HOT（`scripts/ops/hot-files.json`）。補正値を変える実装 PR は、先に claim を取り、`App.css` を触る open PR（#468 ほか）との順序を明記する。**本書は App.css を編集しない**。

## 6. 次の Owner 判断事項

1. 補正値の一覧を、実機計測の結果と合わせて **次の判断材料の正式な参照（SSOT 候補）にするか**（Style Lock の更新は #770 が担当。本書は Style Lock を変更しない）。
2. §2 の「既定 1em のまま」の完全な突き合わせ（`ingredients.ts` との照合）を実施してよいか（docs のみ、新規ファイル）。
3. 倍率・補正の変更案は、**実機計測後**に別途（現在 HOLD）。

---
_読み取りのみ。実機の見え方は未検証。_
