# Steam S4 — iPhone 実機 HV 最小手順（H1・H2・H3・H9・H11、docs-only・Owner 向け）

最終版: 2026-11-06（UTC 約 14:50。H9 の期待値を実コードに合わせて修正、§5 に H4・H8・H10・H12 の免除判断表を追加）。初版は同日の commit `893a472` / 基準 main `785d7956b42eac97e42dbd138818262a16c0a91c` / 対象 PR #738（HEAD `2ac98201e7d300090201937809f2c9d0bd2d9d55`、CI 結果は旧 base `49e2add` 上）
親資料: `TETO_COOKING-METHODS_FRY-STEAM_Evidence-Supplement.md` §3（H1〜H14 の区分）、#747 Runbook（H1〜H14 の原表）、`TETO_COOKING-STEAM_S3_Result.md`・`_H11_Result.md`（#738 ブランチ）
性質: 手順書のみ。コード・テスト・Preview・claim は触っていない。**PASS／FAIL を書くのは Owner だけ**（SESSION-OPERATIONS §3.3）。自動テストは HV の代替ではない（同 §3.4。H1・H2・H3・H9・H11 以外を免除するかは Owner の判断）。

---

## 0. 先に知っておくこと（重要）

1. **共有 Preview は今 #738 ではない。** 配備元の README を読んだ結果【実測】:
   - 現在: **#756 `8dfca29`**（V1 Lab、`Built 2026-11-05T00:32:32Z`）。
   - #738 `2ac9820` は 11/4 23:25Z に一度配備されたが、**その後 #756 に上書きされた**（preview リポの commit 履歴で確認）。
   - したがって **今の共有 Preview では `?cookSteamHv=1` が使えない**（この入口は #738 を含むビルドにしか無い）。HV の前に、**Owner の承認を得た再配備**が要る。承認済みの 11/5 のコメント（`6644912674`）は 2ac9820 への一度きりの更新承認で、**再配備にそのまま使えるかは Owner 判断**（SESSION-OPERATIONS §5: 更新は毎回 Owner 承認）。
2. **HV の証拠は 1 つの HEAD に属する**（SESSION-OPERATIONS §3.1: HEAD が変わると HV はやり直し）。#738 には最新 main の取り込みが残っている（`Gate 計画` 参照）。**取り込み後の最終 HEAD で 1 回だけ HV する**のが最も無駄がない。`2ac9820` で先に HV し、取り込み後に Owner が持ち越しを認める方法もある（§6 の選択肢）。
3. 所要時間の目安: **約 5 分**（準備 1 分＋確認 4 分）。

---

## 1. 5 項目の既存証拠と、不足する撮影

「既存証拠」はすべて**ブラウザ（Playwright Chromium、CI の WebKit）**。実機ではない。

| ID | 確認すること | 既存証拠【実測】 | 実機でしか分からない理由 | **不足する撮影**（Owner が iPhone で） |
|---|---|---|---|---|
| **H1** | コントロールが見え、届く。ツールバーの展開／折りたたみで崩れない | E2E（Chromium 390×844・360×800・390×664）: 全ボタンがステージ内、主ボタン ≥ 56px、× ≥ 44×44、横スクロールなし。CI WebKit（Playwright の WebKit）。画像 `cooking-steam-phase1/iphone-390x844-A-00-screen-idle.png` ほか | Safari の動的ツールバー・ホームバー・safe-area は Playwright で再現できない | **スクショ 2 枚**: ツールバー展開時／折りたたみ時の蒸し画面（A の待機） |
| **H2** | 蒸すピルが生地に重ならず、片手で届く | E2E でピルと生地の円の距離を実測（両 viewport）。炙りの実機教訓（生地に 30〜58px 重なった）を踏まえた配置 | 幾何は測定済み。**片手の届きやすさは主観**で実機のみ | **スクショ 1 枚**: ピルが出た TOPPING 画面（あさり選択中）。**片手で押して届いたか**をメモ |
| **H3** | A: ピルをタップして蒸し画面を開いた直後に、勝手に蒸し始めない（ghost click なし） | Chromium のタッチ E2E 12 件・CDP タッチ。**修正前は実際にタッチでだけ再現した不具合**（S3 Result §7）。修正は `steamGhostClick.ts`（新しい pointerdown まで最初の click を 1 回抑止、60〜120ms 後の意図的な再タップは有効） | Playwright の WebKit が実機と同じ互換イベント（mousedown→click）を出すとは限らない。**この種の不具合は実機のタッチでしか確定できない** | **画面録画 1 本（任意だが推奨）**: ピルをタップ → 蒸し画面が開く → 2 秒そのまま。**勝手にふたが閉じて蒸気が出始めないこと**が映ればよい |
| **H9** | 割り込み（アプリ切替・通知）から戻っても安全にリセットされ、勝手に完了しない | `pointercancel` → INTERRUPT の単体・E2E（B）。A は「ふたをしている最中」の状態機械を単体で検証。**OS の割り込みは再現できない** | iOS のアプリ切替・ロック・通知の挙動は実機のみ | **画面録画 1 本または結果のメモ**: 蒸している最中に別アプリへ → 戻る。戻った画面の状態（待機に戻る／蒸し続ける／勝手に完了する）を記録 |
| **H11** | ピザ上の実寸 24px で、蒸した貝と生の貝が見分けられる | 24px 比較シート（DPR1／DPR3、Chromium）で判別可（開いた貝殻の `::after`、`2ac9820`）。修正前は**実寸でほぼ区別不能**だった（Visual-HV Result） | 知覚の判定は Owner のみ。iOS Safari での `:has()` セレクタ・疑似要素の描画も実機で確認が望ましい | **スクショ 1 枚**（iPhone の通常の見え方）: 蒸したあさり 1〜2 個と**蒸していないあさり 1 個**を同じピザに置いた状態。**拡大せずに**見分けられたかをメモ |

> H4・H8・H10・H12 は既存証拠（連打・キャンセル・切替・焼成〜RESULT の回帰・保存隔離と本番 OFF の gate）で代替できる見込みですが、**免除するかは Owner の判断**です。本手順でも通しプレイの中で自然に触れます（§3 の Step 5）。H5〜H8 は B を Preview 限定の実験にする場合、必須から外せます。H13・H14 は 11/5 に Owner の実機 PASS 済みです。

---

## 2. 準備（承認が前提）

| 項目 | 内容 |
|---|---|
| 配備 | **Owner の承認を得た上で**、`perusonao/teto-pizza-game-preview` の `Build & deploy a source PR/branch` を `ref=<最終 HEAD>`、`pr_number=738` で実行。**実行前に現在の配備元 `8dfca29c0fcfaeae6efbd9e4199f6b112bc51886`（PR #756）を記録済み**（復元はこの SHA と `pr_number=756` で同じ workflow を再実行） |
| 配備後の確認 | ①workflow success、②preview リポ README の `Source commit` が最終 HEAD、③**画面の PREVIEW バッジが `#738` と HEAD の短縮 SHA**。**3 つとも一致するまで HV を始めない** |
| URL | `https://perusonao.github.io/teto-pizza-game-preview/?cookSteamHv=1&cookSteamVariant=lid`（A のみを開く。A/B 切替を見るなら `variant` を外す） |
| 端末 | iPhone Safari（通常のタブ。ホーム画面に追加したものではない）。ロック画面の自動回転は縦固定 |
| セーブ | HV 入口は使い捨てのメモリ保存で、実機のセーブは読み書きしない（S3 Result）。Preview の保存は使い捨て扱い |

---

## 3. 手順（約 4 分）

各 Step の「期待」から外れたら、その場で止めて内容を記録（スクショか画面録画）。**迷ったら FAIL ではなく NEEDS FIX と書いてよい**（#747 の判定語は PASS／NEEDS FIX／FAIL）。

**Step 1（H1）— 画面を開く**
1. 上の URL を開く。バッジが想定どおりか確認。
2. 画面を少し上へスワイプして**ツールバーを折りたたむ → 下へ戻して展開**。
3. 期待: あさり選択済みの TOPPING 画面。ボタン・ピルが画面内に収まり、**ツールバーの展開／折りたたみで欠けたり、押せなくなったりしない**。**スクショ 2 枚**（展開・折りたたみ）。

**Step 2（H2）— ピルの位置**
1. 蒸すピル（「蒸す」）が出ているのを確認。
2. **片手で**親指だけでピルを狙う。
3. 期待: ピルが**生地の円に重ならない**。無理なく届く。**スクショ 1 枚**。

**Step 3（H3）— 開いた直後（最重要）**
1. （画面録画を始めておく）ピルを**指でタップ**して蒸し画面を開く。
2. **そのまま 2 秒、何も触らない。**
3. 期待: 蒸し画面は**待機のまま**（ふたが閉じない、蒸気が出ない、殻が開かない）。
4. 「ふたをする」を**1 回**タップ → 蒸気が出て殻が順に開く → 「ふたを開ける」をタップ。
5. 同じことをもう 2 回（開いた直後の 2 秒待機を毎回確認）。1 回でも勝手に蒸し始めたら NEEDS FIX。

**Step 4（H9）— 割り込み**
1. 蒸し画面でふたを閉じ、蒸している最中に**ホームへ戻る（別アプリを開く）か、サイドボタンでロック**して約 5 秒待つ。
2. Safari に戻る。
3. **設計上の期待（コードと単体テストで確認済み）:** アプリが背面に回る（`visibilitychange` が hidden、またはウィンドウ `blur`）と、**蒸し画面ごと閉じて蒸しを破棄**する（`SteamLayer.tsx` の `abort`／`onVisibility`、テスト「the page losing focus / being hidden mid-steam discards it」）。つまり戻ると **TOPPING 画面に戻り、蒸した印は付かず、貝は蒸されていない**状態が PASS。蒸し画面がそのまま続いている、または**勝手に「蒸し済み」になっている**場合は NEEDS FIX。
4. **状態をメモ**（「TOPPING に戻り、蒸されていない」「蒸し画面が残っていた」「勝手に蒸し済みになった」のどれか）。通知センターを引き下ろしただけのとき（背面に回らない場合がある）は、その旨を併記。

**Step 5（H11 ＋ H4・H10 の軽い確認）— ピザ上の見分け**
1. あさりを 3 個置く流れで、**1 個目と 2 個目を蒸し、3 個目は蒸さずに置く**（蒸し画面を途中で × で閉じる操作や、素早い連打・再入場も 1〜2 回試すと H4 の確認になる）。
2. **拡大せず**、普通に持った見え方で、ピザ上の 3 個を見比べる。
3. 期待: **蒸した貝と生の貝が見分けられる**（下縁に橙の身が覗く）。**スクショ 1 枚**。
4. そのまま「焼く」→ RESULT まで進める（H10 の軽い確認: 貝の見た目や他の表示が崩れない）。

---

## 4. 記録シート（Owner が埋める。セッションは代筆しない）

| 項目 | 内容 |
|---|---|
| 日付 | |
| 端末（機種・iOS・Safari のバージョン） | |
| ビューポート（縦の見え方がわかればよい） | |
| 配備したビルド（バッジの PR 番号と短縮 SHA） | |
| 添付（スクショ／画面録画のファイル名） | |

| ID | PASS / NEEDS FIX / FAIL / 未確認 | 所見（1 行） |
|---|---|---|
| H1 | | |
| H2 | | |
| H3 | | |
| H9 | | |
| H11 | | |
| （任意）H4・H10 | | |

提出先: #738 のコメント（Owner またはセッションが転記）。**スクショ・画面録画は repo に commit しない**（HV Policy の動画の扱いに合わせる。スクショを repo に入れる場合は `docs/reports/screenshots/steam-s4-iphone/` 配下で別途 Owner 承認）。

---

## 5. H4・H8・H10・H12 — 免除判断のための既存証拠（Owner 判断用）

**免除は Owner だけが決められる**（自動テストは HV の代替ではない、SESSION-OPERATIONS §3.4）。下表は「免除してよいと判断できる材料があるか」の整理で、PASS の記録ではない。「再確認」は 2026-11-06 に**最新 main に #738 を merge した使い捨てツリー（push なし）**で、ローカルの Chromium（iPhone 390×844・360×800 プロジェクト、**WebKit・実機ではない**）で再実行した結果。

| ID | 確認内容（#747 Runbook） | 既存証拠【実測】 | 最新 main 上での再確認（ローカル Chromium） | 残る不確実性 | 免除の見立て |
|---|---|---|---|---|---|
| **H4** | A を素早く連打・キャンセル／戻る。二重確定・固まったオーバーレイなし | `cooking-steam.spec.ts:302`（タッチで開く → 待機のまま → 120ms 後の明示タップで蒸し開始、lid／shake・通常／短い画面の 4 通り）、`:338`（2 回続けたタップ）、`:226`（× で何も残らない）。単体: `steamGhostClick.test.ts`（60〜120ms の再タップが有効）、`SteamLayer.test.tsx` | `cooking-steam.spec.ts` **30/30 pass**（390×844・360×800） | 実機のタッチの互換イベントの順序（H3 と同じ実機確認で自然に触れる） | **免除の根拠あり**。H3 の通しプレイで 1〜2 回素早く触れば足りる |
| **H8** | A↔B 切替で前の操作を引き継がない | `:226` 「in-screen switch … **locked while steaming**; × keeps nothing」。単体: 「a switch while idle changes the screen; a half-way steam is discarded; the switch is locked while steaming」 | 同上 30/30 pass | **蒸している最中は切替自体が無効**なので「引き継ぎ」は構造上起きない。B 自体を Preview 限定の実験にするなら対象外 | **免除の根拠あり**（B の扱い次第で不要） |
| **H10** | 焼成 → RESULT まで完走。貝の見た目・他の技法が崩れない | `:245` 「steamed -> bake -> RESULT: the steam look and the bake's own filter both apply」。炙り・炒め・`dynamic-cooking-steps`・`viewport-1screen` の回帰（S3 Result §7）。H11 Result に焼成・仕上げ・RESULT の画像 | 追加で `cooking-screen-sideways`・`cooking-sear-hv`・`dynamic-cooking-steps`・`viewport-1screen`（両 viewport）**55 pass／3 skip**、`cooking-prep`・`b18-hv-preview`（390×844）**30 pass／2 skip**。skip はテスト側の既存条件 | 実機での焼成表示（HV の Step 5 で貝の見た目を見る際に自然に確認できる） | **免除の根拠あり**。Step 5 の「焼く → RESULT」で軽く見れば足りる |
| **H12** | 保存が汚れない・本番 OFF | `:76`（実際のセーブに触れない）、`:278`（リロードで最初から）、`steam.gate.test.ts`（本番バンドルに `cookSteam*`・HV 印が無く、Preview バンドルには全部ある）、`steamIngredient.flagOff.test.ts`・`unaffected.test.ts`（フラグ OFF で状態不変／保存・採点・在庫・journal がバイト同一）、`STEAM_EXPERIENCE_PRODUCTION = false`（`steamExperienceGate.ts`） | `npm run build` 成功、**`dist/` に `cookSteam*`・`steamGameLab` の文字列なし**、`steam.gate.test.ts` ほか gate 5 本・FRY 純ロジックを含む 81 件 pass、`previewIsolation.gate.test.ts` pass | 実機でしか見えない要素はほぼない。ただし「共有 Preview の保存キーは全 PR で共有」（SESSION-OPERATIONS §5）なので、HV 前後の Preview の保存は使い捨て扱い | **免除の根拠が最も強い**（自動 gate が本番混入を直接検出） |

**免除しない方がよいもの（実機が必要）:** H1・H2・H3・H9・H11（§1）。
**B 専用の H5〜H7:** B を「Preview 限定の実験」と決めれば必須から外せる。H13・H14 は 2026-11-05 に Owner の実機 PASS 済み。

---

## 6. HEAD の扱い（Owner の選択肢）

| 案 | 内容 | 利点 | 注意 |
|---|---|---|---|
| **A（推奨）**: 最終 HEAD で 1 回 | #738 に main を取り込み → CI／Codex が緑 → **その HEAD を Preview に配備して HV** | HV の HEAD と merge する HEAD が一致。免除判断が要らない | 実機 HV まで CI の待ち（WebKit 6 shard、最長 約 35 分の上限）が挟まる。claim 期限（11/10 00:00 UTC）には余裕がある |
| B: `2ac9820` で先に HV | 今の HEAD を再配備して HV → 取り込み後に Owner が**持ち越し**を認める | 実機結果が早く出る | 取り込み後の HEAD は別。**持ち越しの可否は Owner が決める**（main の差分は #738 の 110 ファイルと**重複ゼロ**だが、`App.css`（#765 の 360px 向け chip 補正、#761/#739 のアイコン補正）と `IngredientGlyph.tsx` の変更は画面に影響しうる）。取り込み後に H1 だけ再確認する折衷もある |
