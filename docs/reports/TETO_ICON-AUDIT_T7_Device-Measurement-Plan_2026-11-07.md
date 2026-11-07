# T7 — iPhone Safari 実機計測計画と撮影チェックリスト

Status: **計画のみ（docs-only）。コード・CSS・golden・既存 docs 未変更。共有 Preview 未更新。PR・merge・Production ON なし。**
Branch `claude/teto-pizza-t7-t9-audit-12by6f` / 基準 `main` `06cfc06` / Issue #417 / claim: #417 コメント 6703658614（`TETO_ICON-AUDIT_T7_*`、期限 2026-11-20、本書はその範囲内）。
根拠: Owner 決定 #417 コメント 6703774686（読み取り専用の iPhone Safari 実測 GO。SVG 差し替え・倍率変更・食材別焼成曲線・本番統合は **HOLD**）。
姉妹書: `TETO_ICON-AUDIT_T7_Size-Correction-Inventory_2026-11-07.md`（補正値の一覧表）。

## 0. 検証状況（先に）

| 項目 | 状態 |
|---|---|
| 実機 iPhone Safari での計測 | **未実施・未検証**。この環境（クラウドコンテナ）に実機・Safari はない。**本書のどの項目も PASS ではない** |
| 本計画の撮影手順の実行可能性 | 机上。Preview の入口・シードの動作は下記「既存の仕組み」をコードで読んだのみで、実行して確認していない |
| 数値 | 全て CSS／データ／既存 Result からの算出値。実測値ではない |

実機で撮れない限り、結果表は「未検証」のまま。Chromium／Playwright の画像は参考であり、実機の代わりにはしない（HV Policy、SESSION-OPERATIONS §3-4）。

## 1. 目的と重点（Owner 指定）

1. **xs 食材**: corn・parsley・mint（絵文字のまま、RESULT で箱 約 14.7px）を最優先。
2. **焼成後の淡色 SVG**: 焼成が進んだ段階での輪郭・生地とのコントラスト。
3. **ピーマン**: #771（結果チップで glyph 1.45em がラベルに近い）の見た目の重なり有無。
4. 計測のみ。判定は Owner。倍率・SVG・焼成曲線の変更案は**この段階で出さない**（HOLD）。

## 2. 対象サンプル

xs クラス（`toppingSizeClass.ts` 実測）: corn, capers, pine-nuts, oregano, rosemary, parsley, grana-padano, mint, shiso, green-onion, paprika-powder, cilantro（他に末尾の追加分あり得る。着手時に再確認）。

| 群 | 食材 | 現行の描画 | 計測の狙い |
|---|---|---|---|
| **A: xs 絵文字（最優先）** | corn, parsley, mint | 絵文字 | RESULT・サムネでの判読。Apple Color Emoji の実面積（M6、未確認） |
| A 比較対照 | capers, pine-nuts, green-onion, cilantro, paprika-powder | SVG（1.2em 系）／絵文字 | xs の中で SVG と絵文字の見え方の差 |
| A 参考 | shiso（#758・1.35em）, oregano・rosemary | SVG | 補正済み・新規 SVG の実寸 |
| **B: 焼成後の淡色 SVG** | whitebait, cream-cheese, feta, ricotta, shiso, salmon-roe, sour-cream-dab | SVG | 焼成段階 5 点での輪郭・生地との差 |
| B 比較対照 | black-olive（濃色・絵文字）, sausage（濃色 SVG）, basil（緑ハーブ曲線） | — | 共通曲線で濃色が「消える／汚れる」か |
| **C: ピーマン** | green-pepper, bell-pepper（1.45em／1.65em、チップ 1.35em） | SVG | #771 の結果チップ、トレイチップ、ピザ上 |

## 3. 計測する場面（各サンプル）

| 場面 | 見るもの | 備考 |
|---|---|---|
| S1 トレイのチップ（26px 箱） | 判読、隣の食材との区別 | bell-pepper は専用チップ寸法 |
| S2 ピザ上・焼成前 | 実寸の見え方 | rank 倍率（xs ×0.7）込み |
| S3 BAKE 中〜焼成後 | 焼成段階別の見え方（§4） | フィルタ曲線は共通 1 本 |
| S4 RESULT（×0.75） | 最小サイズでの判読 | xs は箱 約 14.7px の算出値 |
| S5 結果チップ（「今回の試作結果」） | ラベルとの近さ | #771 |
| S6 サムネイル／Dex | 小サイズ | 任意 |

## 4. 焼成段階の取り方

`computeBakeHeat(progress, target)` は target 中心で 1.0、`progress` 0 で 0、100 で 2.0（区分線形）。具材のフィルタは heat 0〜0.8 で無変化、1.0 で輝度 0.97／sepia 0.08、1.6 で 0.90／0.14、2.0 で 0.78／saturate 0.80／0.20（緑ハーブは緩い曲線）。**コードの値であり、実機では未確認**。

| 段階 ID | heat | 針の止め方（target {60,80}＝中心 70 の例） | 区分 |
|---|---|---|---|
| H0 | 0 | 焼成前（置いた直後） | — |
| H1 | 0.8 | progress ≈ 56 | 生焼け上端付近 |
| H2 | 1.0 | progress = 70 | ちょうど |
| H3 | 1.6 | progress ≈ 88 | 焦げ手前 |
| H4 | 2.0 | progress = 100（最後まで） | 黒焦げ |

- recipe ごとに target が違う。**撮影メモには recipe ID と target、止めた針の値を必ず記録**する。
- 針の位置は人の指で ±数点ずれる。目標値との差を記録し、再撮影は「ズレが 3 点超」のときだけ。
- 1 回の焼成で撮れるのは 1 段階。各段階を同一ピザ構成で 1 回ずつ（計 5 回）。

## 5. 既存の仕組み（コードで確認・実行は未検証）

| 手段 | 内容 | 注意 |
|---|---|---|
| 共有 Preview（現在） | `perusonao.github.io/teto-pizza-game-preview/`、README 上は **PR #738・commit `78de12a`・Built 2026-11-06T16:00:50Z** | **更新は禁止（Owner 承認なし）**。この build は main に未取り込みで、main との差分は herb 4 種の SVG（rosemary／oregano／spinach／artichoke）の配線など。**群 A の oregano・rosemary は Preview では絵文字**。corn・parsley・mint・shiso 1.35em・whitebait・bell-pepper 1.65em は同一【`git show` で確認】 |
| `?toppingScale=a|b|c` | rank 倍率の比較（b＝本番値、c＝見かけ補正の未確定案） | **比較のため見るだけ**。倍率変更の根拠にはしない（HOLD） |
| `?resultScale=` | RESULT 縮尺 0.65〜1.0 | 本番 0.75 が基準。比較の参考 |
| HV シード・State Editor | 材料を所持・在庫化する既存のシード（`hvSeeds.ts` ほか）／dev の State Editor（`main.tsx`） | 手順は未実行。**使えるか、どの recipe で xs 食材が置けるかは着手時に Owner と確認** |
| 使い捨てストレージ | `?cookSearHv=1` 等は Preview の保存を使わない方式 | 計測では**実保存を汚さない**ことを優先 |

**Preview を更新しないと撮れないもの**（例: main の herb SVG の実寸）は、Owner が Preview 更新を別途承認するまで「未検証」。代替は、Owner が自分の端末で `localhost`／LAN の dev サーバーを開く方法だが、これも Owner の判断（本書では実施しない）。

## 6. 撮影チェックリスト（Owner が実機で行う場合）

準備
- [ ] 端末名・iOS 版・Safari（通常タブ、**アドレスバー／タブバー表示あり**）を記録。画面の向きは縦。
- [ ] 表示ズーム・文字サイズ設定（アクセシビリティ）を既定に戻して記録。
- [ ] 計測用の保存（使い捨てまたは別プロファイル）。**共有 Preview の実保存を壊さない**。
- [ ] Preview の PR 番号・短縮 SHA（画面右上のバッジ）を最初のカットに写す。
- [ ] 画面録画（動画は repo に commit しない・Owner へ直接）＋スクリーンショット（commit は `docs/reports/screenshots/<task-name>/` のみ、実機撮影は Owner が提出）。

各サンプル × 場面
- [ ] S1 トレイのチップ（食材名が読める位置で）
- [ ] S2 ピザ上・焼成前（H0）
- [ ] S3 H1〜H4 の各段階（recipe ID、target、止めた針の値をメモ）
- [ ] S4 RESULT（同一ピザを各段階で）
- [ ] S5 結果チップ（ピーマンを含む構成。タップ領域・ラベルとの距離）
- [ ] 比較: 同構成の絵文字食材／濃色食材を同画面に入れる

記録（各カット）
- [ ] 判読可否（A: 見分けられる ／ B: 見分けにくい ／ C: 判別不能）— **主観を一言添える**
- [ ] 輪郭が生地色に溶けるか（淡色 SVG）
- [ ] 隣の食材と取り違えそうか
- [ ] 「小さすぎる」「近すぎる」の一言

画面幅
- [ ] 390×844 相当（authority）— 実機の実効 viewport を記録（`innerWidth`×`innerHeight` が取れなければ機種名で代用）
- [ ] 360×800 相当は**実機が無ければ未検証**（Chromium エミュレーションは参考扱い）
- [ ] ステージが低い状態（アドレスバー表示で 約 260〜290px）— 結果画面の下端も確認

## 7. 結果表（記入欄、現在は全て未検証）

| サンプル | 場面 | 段階 | 判読 A/B/C | 取り違え | メモ | 状態 |
|---|---|---|---|---|---|---|
| corn | S4 | H2 | — | — | — | **未検証** |
| parsley | S4 | H2 | — | — | — | **未検証** |
| mint | S4 | H2 | — | — | — | **未検証** |
| whitebait | S3/S4 | H1〜H4 | — | — | — | **未検証** |
| cream-cheese | S3/S4 | H1〜H4 | — | — | — | **未検証** |
| feta／ricotta | S3/S4 | H1〜H4 | — | — | — | **未検証** |
| shiso | S3/S4 | H1〜H4 | — | — | — | **未検証** |
| sour-cream-dab | S3/S4 | H1〜H4 | — | — | — | **未検証** |
| bell-pepper／green-pepper | S5 | — | — | — | #771 | **未検証** |

## 8. 判定の扱い

- 本計画の成果は「事実の記録」のみ。**SVG 差し替え・倍率・食材別焼成曲線は、記録を見た後に Owner が新たに決める**（Owner 決定 6703774686 の HOLD）。
- #771 は、実機で重なりが確認された場合のみ描画だけの案を比較する（Issue 本文の受入条件）。確認できなければ「問題なし」として Owner が close 判断。証跡の一部（Chromium・既存撮影スクリプト）は監査ブランチ `claude/teto-ingredient-icons-audit-du85eg` にあるが、**実機の代替ではない**。

## 9. 次の Owner 判断事項

1. 実機計測の実施者・時期（Owner 本人か）。
2. 共有 Preview の現行 build（#738 @ `78de12a`）で足りるか。main の herb SVG 等も見たい場合のみ、Preview 更新を別途承認するか。**推奨: 先に現行 build で群 A（corn／parsley／mint）・群 B・群 C を計測**（更新不要）。
3. 材料を揃える手段（既存 HV シード／State Editor）で足りるか。
4. 判読の A/B/C の基準で良いか（主観を一言添える方式）。

---
_計画のみ。実機未検証。_
