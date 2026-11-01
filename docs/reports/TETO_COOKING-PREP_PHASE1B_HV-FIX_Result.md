# Cooking Prep Phase 1B — iPhone Safari HV 指摘の修正 Result

Status: **実装済み・自動検証済み。Owner の実機再検証待ち。本番フラグ `PREP_EXPERIENCE_PRODUCTION = false` のまま。**
管理: Issue #696（Phase 1B）の追補。独立した修正 PR。基準 main: `ebbe119`。Preview（PR #721 · `31b8c0c`）は更新していない。

## Owner の実機 HV 指摘（iPhone Safari、Preview `PR#721 · 31b8c0c`）
1. 結果メッセージが右上の × に近く、余白が不足
2. 結果ボタンが茶色のパネル下端からはみ出している
3. 背景の食材トレイや「焼く！」が目立ち、モーダルとの区別が弱い

## 原因（修正前のコードで再現済み）
| 指摘 | 原因 | 実測（修正前） |
|---|---|---|
| 1 | 見出しは `max-width: 82%` の中央寄せで、× との水平間隔を保証していなかった | 390 幅で × との間隔 **12px**（基準 16px 未満） |
| 2 | パン画面が `flex` の縦中央寄せで、ステージが低いと内容が上下にあふれた。**実 iPhone Safari のステージは約 260〜290px**（Desktop Chrome の 390×844 は 450px）で、既存の E2E は 450px だけで検証していた | 390×664: ボタン下端 390 > ステージ下端 382。360×640: 371 > 358。見出し上端も 94 < 100 で**パネル上にはみ出し** |
| 3 | パン画面は `.pizza-stage` の中だけを覆う。dock は `inert` だったが、**「やり直す／焼く！」の行は inert でも暗転でもなかった** | `焼く！` の中央をタップすると**パン画面の背後で焼成が始まる**（実バグ。動画で確認） |

## 変更
| ファイル | 内容 |
|---|---|
| `src/components/CookingPrep.css` | パン画面を `grid`（見出し / パン / ボタンの 3 行）に変更。ボタンは常に最下段で下に 12px の余白。見出しは左右対称に 72px（× 44px + 8px + 16px 以上）を確保し、`text-wrap: balance`。パンは**余った高さに追従**（`height: min(100%, 64cqw)`）。牛肉はパンの幅に比例（`70cqw`、48〜124px）。ステージ以外（ヘッダーを除く）を `opacity: 0.55` に落とし `pointer-events: none`（`.game-screen--prep-busy`）。結果文言は 19→18px |
| `src/screens/GameScreen.tsx` | `prepBusy` 中、ルートに `game-screen--prep-busy` を付与し、**「やり直す／戻す／焼く！／ヒント」の行に `inert`**（+2 行。HOT file、既存行は変更なし） |
| `e2e/cooking-prep.spec.ts` | 新規 6 件（下記） |
| `src/screens/GameScreen.CookingPrep.test.tsx` | bake bar の `inert`／ルートのクラスの assert を追加 |
| `docs/reports/screenshots/cooking-prep-hv-fix/` | before / after 各 20 枚 |

不変: 炒めるタイミング判定（`panDoneness.ts`）、`beefDoneness.ts`、reducer、保存・採点・在庫・Dex、`prepExperienceGate.ts`（`PREP_EXPERIENCE_PRODUCTION = false`）。

## テスト
- **新規 E2E 6 件**（Chromium、390×844 / 360×800 の各プロジェクトで 3 件ずつ）
  - 「全結果がパネルに収まり × から離れる」: early / overdone / 時間切れ / best × 390×844・360×800・**390×664・360×640**。メッセージはパネル内かつ × から 16px 以上、ボタンは高さ 48px 以上・パネル下端から 8px 以上内側・パンの下、パンはメッセージの下。スクロールなし。
  - 「背面は触れず、軽くなり、× で戻る」: 実マウスで 焼く！・やり直す・トレイのチップ・工程タブをタップ → 走行中も結果表示中もピース数・保存・フェーズ不変。キーボード（強制フォーカス + Enter）も不変。bake bar / dock の背面は opacity 0.5〜0.75（暗くしすぎない）、ステージとパン画面とヘッダーは 1。× で全部戻る。
  - **修正前のコードでは 3 件とも失敗することを確認**（間隔 12px、ボタンがパネル外、クラス・inert なし）。
- 既存の Cooking Prep E2E 44 件は無修正で通過。

## HV 成果物（Owner が再検証する）
- スクリーンショット（commit 済み）: `docs/reports/screenshots/cooking-prep-hv-fix/{before,after}-{running,early,overdone,timeout,best}-{390x844,360x800,390x664,360x640}.png`
- 動画（repo に commit しない。Owner へ直接提出）: `cooking-prep-hv-fix_{before,after}_{390x844,390x664}.mp4`（H.264）。before は「結果表示中に背面の 焼く！ をタップすると焼成が始まる」まで、after は同じ操作が何も起こさず、もう一度炒める → early → best →「✓ 炒め済み」まで。
- 動画は dev サーバー + Playwright の実ポインター入力で、Preview ビルドの実機録画ではない。

## 残る問題・トレードオフ
1. **短いステージではパンが小さくなる**（ボタン 56px とメッセージ 2 行を確保した結果）。390×664 で約 149px（修正前 175px）、360×640 で約 125px。タイミングの見やすさが落ちていないかを実機で確認してほしい。
2. 食材トレイは白地のため、opacity だけでは差が小さい。視覚的な区別が足りなければ、トレイの背景を暗くする案もあるが、「暗くしすぎない」との兼ね合いで Owner の判断が要る。
3. `text-wrap: balance` は新しい Safari のみ（古い版は従来どおり折り返す）。
4. WebKit は**ローカルで実行できない**（環境に WebKit なし）。CI の WebKit シャードで確認する。
5. 実機 iPhone Safari での再検証は未実施。
