# FOLD＋SEAL F2 独立実験画面 Result Report（Refs #773）

2026-11-07、基準 main `06cfc06`（不変）、branch `claude/fold-seal-f2-lab-773`（F1 レビュー用 `claude/fold-seal-f1-review-773`〔PR #785〕から分岐）。
根拠: Owner 決定 #773 コメント 6705248785（F2 条件付き GO）。claim: #780 コメント 6705278323（F1 レビュー用の #773 claim とは別 Issue・別ブランチ・別ファイル範囲）。
**F2 の PR 作成・merge・Production ON・共有 Preview 更新・ゲームへのマウントはしていない。** HV の PASS は主張しない（実機証拠なし）。

## 範囲

新規ファイルのみ（F1 の architecture test 1 本の更新を除く）:

| ファイル | 内容 |
|---|---|
| `foldseal-lab.html` | 独立エントリ（`index.html` とは別。dev サーバでのみ開く） |
| `src/labs/foldSeal/main.tsx` | 画面のマウント（このエントリ専用） |
| `src/labs/foldSeal/FoldSealLab.tsx` | 実験画面。ドラッグとボタンが**同じイベントを同じ F1 状態機械**に送る。SVG の蓋（`scaleY(cos θ)`）、縁の 36 区間、計測表示 |
| `src/labs/foldSeal/foldSealLab.css` | `.fsl` に閉じたスタイル（reduced-motion 対応） |
| `src/labs/foldSeal/labController.ts` | 純粋ヘルパ: ポインタ→箱座標、**接触の明示追跡**、`canAdvance`、計測カウンタ |
| `src/labs/foldSeal/*.test.ts(x)` | 単体テスト 4 ファイル（コントローラ／jsdom の画面／分離／ビルド混入ゲート） |
| `tools/foldSealLabChromium.mjs` | Chromium の実タッチ（CDP）確認スクリプト（既存の `tools/*.mjs` と同じ型） |
| `docs/reports/screenshots/fold-seal-f2/` | 390×844・360×800 の画像 18 枚と `results.json` |
| `src/logic/foldSeal/foldSeal.architecture.test.ts`（**更新 1 箇所**） | 「ゲームの他のファイルが import しない」の許可リストに `src/labs/foldSeal` を追加（F1 の PR #785 の内容は変えない。F2 が F1 を import するための必要な更新） |

**編集していない**: `src/main.tsx`・`src/App.tsx`・reducer・`PizzaStage`・調理 runtime・既存 CSS・`vite.config.ts`・`package.json`・e2e・golden・ゲーム本体・#738／#746 の領域（`src/preview/**`・`src/devtools/**`）。独立エントリは共有設定を**必要としなかった**（停止条件に該当せず）。

## 接触中の画面遷移禁止（Owner 指示）

`canAdvance(state, activeContacts) = stepIsComplete(state) && activeContacts === 0`。接触は `pointerdown` で追加、`pointerup`／`pointercancel`／ウィンドウの blur・resize・orientationchange・非表示で削除する。**`phase === "folded"` だけに頼らない**: 機械が無視した帯外タッチでも接触は数えられ、遷移はブロックされる。「つぎへ」は `aria-disabled`（`disabled` ではない）で、クリックは必ず判定を通る。

## 検証

| 項目 | 結果【実測】 |
|---|---|
| `npx vitest run src/labs src/logic/foldSeal` | **7 ファイル・116 件 pass**（F1 71 件＋lab 45 件） |
| `npx tsc -b` | エラー 0 |
| `npx oxlint src/labs src/logic/foldSeal` | 警告・エラー 0 |
| 全 Vitest | **630 ファイル pass／1 skipped（631）、11,671 件 pass／13 skipped／2 todo、失敗 0**（所要 約 21 分。F1 の 626 ファイル・11,626 件に lab の 4 ファイル・45 件が加わった分） |
| Chromium 実タッチ確認 `CHROMIUM_PATH=/opt/pw-browsers/chromium node tools/foldSealLabChromium.mjs` | **27 項目 × 2 viewport、全 pass、ページ／コンソールエラー 0**（`docs/reports/screenshots/fold-seal-f2/results.json`） |
| 本番ビルド（`vite build`、設定変更なし） | 出力は `index.html` のみ。lab の文言・クラス・機械コードを含むファイル **0** |
| Preview ビルド（`VITE_PREVIEW_MODE=1`） | 同上。**0** |
| ゲートテストの有効性（変異確認） | `index.html` に lab のスクリプトを一時的に足すと、ゲート 2 本と分離テスト 1 本が失敗することを確認し、元に戻した |

### Chromium 実タッチ確認の内容（390×844／360×800 とも）

レイアウト: 横スクロールなし、1 画面に収まる（縦スクロールなし）、全ボタン 44×44px 以上、生地ステージは正方形で画面内（390 で 358px、360 で 328px）。
操作（CDP の実タッチ）: 蓋をつかむと折り始め／指が折り線上で約 90°／離すまで確定しない／しきい値超えで離すと確定／短い離しでバネ戻り／`touchcancel` で中断・接触解除／縁をなぞって封止（部分 14 区間、全周 36 区間）／封止中は「つぎへ」がブロック／**帯外タッチ中（phase は `folded` のまま）もブロックされ、離すと通る**／ボタンのみで折る→とじる 4 回→36 区間／前の工程を変えると全破棄／封止不足は隙間として描画されるが先へ進める／`prefers-reduced-motion` で蓋の transition が 0s。

テスト（jsdom）: ドラッグ・ボタン・36 区間・部分封止・隙間・帯外・接触ガード（第二の指が「つぎへ」を押しても通らない）・pointercancel（別の指のキャンセルでは中断しない）・blur／resize／orientationchange／非表示・アンマウント・保存なし（localStorage／sessionStorage に書かない）。

## 実行方法（DEV のみ）

`npx vite` を起動し、`/teto-pizza-game/foldseal-lab.html` を開く。この環境では Playwright が固定する Chromium のビルドが無いため、`CHROMIUM_PATH` で導入済みの Chromium を指す（`playwright install` は実行していない）。

## 残る課題・ゲート

- **実機 iPhone Safari の証拠はゼロ。** Chromium のエミュレーションは実際の指・WebKit・iOS のジェスチャ（画面端スワイプ、ラバーバンド、手の影）を証明しない。HV-1〜10（`TETO_FOLD-SEAL_F2-Readiness_2026-11-07.md` §5）は未確認。
- 実機に届ける経路が未決（共有 Preview への掲載は Owner の別判断。独立エントリは現行の本番・Preview ビルドに入らない）。
- 数値（`FOLD_D_MIN` など）は暫定。画面は実験用の見た目で、ゲームの絵ではない。
- WebKit の自動確認は環境に WebKit が無く未実施。
- F4 統合、円形採点・CUT との整合、`calzone` 構成（Jaccard 0.5）は HOLD。
- PR #785（F1、Draft／HOLD）の Codex レビューは exact HEAD `fdcc21a41d` で完了し、**指摘 0 件**（receipt: 「Didn't find any major issues」）。F2 は #785 の上に積むため、今後 #785 の HEAD が変わる場合は F2 を追従させ、必要なら Codex を再依頼する。CI の結果は別途確認。
