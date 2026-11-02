# Cooking Sear Phase 1 Result — ソーセージの「焼き目をつける」（長押し炙り）

Status: **試作 実装済み・自動検証済み（Preview / DEV 限定、本番 OFF）。実機 HV は Owner 待ち。PR 未作成・未 merge。共有 Preview・Production は更新していない。**
管理 Issue: **#724**（claim 投稿済み）。基準 main: `7f3aa63`（#722 merge 後）。ブランチ `claude/teto-pizza-cooking-audit-5qhbpw`。
Owner 方針（2026-11-02）: 調理法=焼き目をつける（長押し炙り）／試作食材=sausage のみ／本番 OFF・Preview/DEV 限定／既存の炒め・FINISH は変更しない／ルンダンの煮込みは別課題／#604・#579・#608 は別管理。
推奨モデル: 下記「推奨モデル」。

## 1. 着手前の確認

| 確認 | 結果 |
|---|---|
| main / CLAUDE.md / PROJECT_HANDOFF.md / SESSION-OPERATIONS | 確認済み。HV Policy（動画は commit しない、スクリーンショットは `docs/reports/screenshots/<task>/`）に従った |
| 重複 Issue | なし（`焼き目` / `炙り` / `Cooking Prep` の検索で #696 のみ。#696 は炒めで別件）→ **#724 を新規作成** |
| claim | #696 は release 済み。他に Cooking Prep / 炙りの claim なし。#724 に claim を投稿（期限 2026-11-09） |
| **#722 の実機 HV** | **確認できなかった。** #722 は merge 済み・CI 11/11・Codex 指摘 0 件だが、Owner の iPhone 再検証の結果コメントは見当たらない。本作業は #722 の CSS（`CookingPrep.css`）に依存せず、`game-screen--prep-busy`（背面を薄くする既存クラス）を**そのまま再利用するだけ**で変更しない |
| #723 | **触れていない。** 変更ファイル一覧の読み取りのみ |
| HOT file の競合 | 下表。**停止条件に該当せず**（#723 が触るファイルは一切編集していない） |

HOT file の重なり（実装前に確認）:

| ファイル | #723 | 他の open PR | 本作業の変更 |
|---|---|---|---|
| `src/App.css` | 触る | — | **触らない**（炙りの CSS は新規 `Sear.css`） |
| `src/components/IngredientGlyph.tsx` | 触る | — | **触らない**（ソーセージの色は CSS の selector で上書き。§6 のリスク参照） |
| `src/data/ingredients.ts` / `recipes.ts` / `docs/PROJECT_HANDOFF.md` | 触る | — | **触らない**（HANDOFF は更新していない。#723 との衝突回避） |
| `src/state/gameReducer.ts` | 触らない | — | **+約 22 行（追加のみ）** |
| `src/screens/GameScreen.tsx` | 触らない | #478（draft・base が古い）が +15/−5 | **+22 行（追加のみ）** |
| `src/App.tsx` | 触らない | — | **+1 行** |
| `src/components/PizzaStage.tsx` | 触らない | #468 が触る計画 | +19/−2（pieces の style 式を 1 箇所だけ整形し直した） |

## 2. 仕様（実装したもの）

1. TOPPING 工程で **ソーセージ**を選ぶ → ステージ下の帯に「🔥 炙る」ピル（炒めのピルと同じ位置・寸法。2 つが同時に出ることはない）。
2. ピルを押して離す → 炙り画面（ステージ内を覆う）。**「🔥 長押しで炙る」ボタンを押し続ける間だけ**、焼き色が進む。炎・熱の光・煙・焼き目の線が出る。
3. **離すと確定**（1 回だけ reducer に届く）。言葉が出て約 0.9 秒後に閉じ、「✓ 炙り済み」。
4. 押下 350ms 未満は「タップ」として何も残さず、「もう少し押し続けてね」と出す。× は常に何も残さず閉じる。ブラウザが指を取り上げた（`pointercancel`）／ページが blur したら、残さず捨てる。
5. 量 = 押した時間 ÷ 4 秒（0〜1）。**目標の窓も、成功・失敗も、時間切れも、ゲージ・数字・カウントも無い。** 4 秒を超えても同じ「完全に焼いた」見た目のまま（失敗にならない）。
6. 結果の言葉は採点ではなく**見た目の名前**（ほんのり／こんがり／しっかり／まっくろ焦げ目）。どれも正解。
7. 置いた後のソーセージ（すでに盤面にある分も、あとで置く分も）が、その焼き色で描かれる（食材単位。炒めの P-4 と同じ）。焼成後・RESULT でもそのまま。
8. キーボード（Enter / Space を押し続ける）でも同じ操作。

ゲート: `SEAR_EXPERIENCE_PRODUCTION = false`（本番 OFF）＋ Preview / DEV の `?cookSear=on`。**`?cookPrep=on` では炙りは出ない（独立）。** 本番ビルドは `cookSear` の文字列を含まない（実ビルドを走査するゲートテスト）。

状態: `GameState.searedLook?: Record<id, 0..1>`（transient・表示専用・保存しない。`RESET_PIZZA` で除去、次ラウンドへ持ち越さない）。アクション `SEAR_INGREDIENT`（TOPPING の GUIDED / FREE_COOK のみ、sausage のみ、所持、未炙り、有限値のみ。違反は同一参照の state を返す）。**採点・識別・保存・在庫・Dex・Pitz・ヒントは一切変更なし**（同一ラウンドの炙りあり／なしで state が `searedLook` 以外同一、を 0 / 0.2 / 0.5 / 0.9 / 1 でテストで固定）。

## 3. 既存の炒め（Cooking Prep）との差別化

| | 炒める（既存・変更なし） | 炙る（今回） |
|---|---|---|
| 食材 | beef | sausage |
| 操作 | 「取り出す！」を**1回押す**（離散） | **押し続け→離す**（連続） |
| 量を決めるのは | システムの時計（2100〜4200ms が best） | **プレイヤーの手**（押した時間そのまま） |
| 良し悪し | early / best / overdone の判定あり（失敗状態は無いが“ベスト”がある） | **判定なし**（4 つの見た目の名前だけ。全部正解） |
| 手掛かり | 色・つや・湯気／煙 | 色・熱の光・炎・煙・**焼き目の線**（ゲージなし） |
| 確定 | 「これで使う」／best で自動 | **離した瞬間** |
| 失敗・やり直し | early / overdone で「もう一度」 | 無い（× で捨てて、もう一度押せばよい。炙り済みは 1 ラウンド 1 回） |
| 状態・コード | `preparedIngredientIds` / `preparedLook` / `PREP_INGREDIENT` | `searedLook` / `SEAR_INGREDIENT`（**独立**。炒めのファイルは 1 行も変更していない） |

> 既存の炒め関連ファイル（`CookingPrepLayer.tsx`、`CookingPrep.css`、`logic/prep/**`、`prepIngredients.ts`、`prepExperienceGate.ts`、`prepPreview.ts`、`gameReducer.ts` の `PREP_INGREDIENT`）は無変更。既存の炒め E2E（`cooking-prep.spec.ts`）と Vitest は無修正で通る（§5）。

## 4. 評価（重点 3 項目）

**前提:** 以下は動画・スクリーンショット・自動計測に基づく所見で、**実機 iPhone での操作感の判断ではない**（実機 HV は Owner）。

### 4.1 操作の楽しさ（仮説と所見）
- **良い点（観察）:** 押している間に色・炎・光が連続して変わり、**自分の手が量を決める**ので、炒めの「待って押す」とは体験が別物になる。失敗が無く、止める位置に正解が無いので、気軽に試せる。ボタンが大きく（高さ 64px・幅 78%）、押している間は沈み込み＋リングで反応が見える。結果の言葉で「どこまで焼いたか」が分かる。
- **懸念:** (1) 4 秒の長押しは**指が疲れる／長い**可能性（初期値。`SEAR_FULL_MS` 1 か所で調整可）。(2) 「採点に効かない」ので、**盤面の差が見えなければただの作業**になる（§4.2）。(3) 1 ラウンド 1 回で取り消せず、気に入らなければ × で捨てるのではなく**押し直せない**（炙り済みになる前の × は何も残さない）。(4) 実機の iOS Safari での長押しの挙動（コールアウト・選択・スクロール）は未確認。
- **確認してほしい点（実機 HV）:** ① 説明なしで長押しだと分かるか ② 3 秒前後が楽しいか長いか ③ 離したときの確定が気持ちよいか ④ 押している間に指がソーセージを隠さないか（ボタンは絵の下） ⑤ やらなかったときに損をした気がしないか。

### 4.2 焼き色の視認性（数値）
炙り画面では 4 段階がはっきり読める（スクリーンショット `03`〜`06`: 生のピンク赤 → 茶色＋薄い焼き目の線 → 濃い焼き目の線 → 黒褐色。ピクセルで確認）。**一方、盤面（約 24px）では段階が薄い側で読みにくい。**

| 量 | 面の色 | 生の面との輝度比 | 生地（235,202,143）との比（面／外側） |
|---:|---|---:|---|
| 0（生） | rgb(185,94,71) | 1.00 | 2.81 / 4.58 |
| 0.25 ほんのり | rgb(166,87,51) | 1.18 | 3.32 / 5.47 |
| 0.5 こんがり | rgb(148,80,31) | 1.39 | 3.90 / 6.52 |
| 0.7 しっかり | rgb(112,61,27) | 2.00 | 5.64 / 8.17 |
| 1.0 まっくろ | rgb(59,33,21) | 3.36 | 9.46 / 10.88 |

- 生 → ほんのり／こんがりは**輝度差が 1.2〜1.4 倍しかなく、色相の変化（ピンク→茶）に頼る**。24px 級の盤面では「少し焼けた」程度の差で、**未炙りとの見分けは Owner の目で判断が要る**（`docs/reports/screenshots/cooking-sear-phase1/before-after-*.png` は 0.7 の「しっかり」の例で、未炙りとはっきり違う）。
- **深く焼くとほぼ黒くなり、ブラックオリーブと取り違える恐れ**がある（盤面 24px）。面の暗い側の抑制、または縁の明るさの保持が改善候補。
- 焼き目の線（炙り画面）は**盤面には出ない**（小さすぎる）。盤面は色だけで伝わる。
- 色は暫定。調整は `src/logic/sear/sausageSear.ts` の 3 つの停止色 1 か所。
- 非色の手掛かり（光・炎・煙・焼き目の線）を設けたので、色覚差があっても炙り画面では段階が読める。reduced motion でも煙の濃さと光は静止画で読める（アニメだけ止まる）。

### 4.3 既存 Prep との差別化
§3 の表のとおり。要点: **「システムが窓を決めて止めさせる」から「プレイヤーが量を決める」へ。** 両者は同じ食材に同時に付かない（ソーセージは炒めの対象外、beef は炙りの対象外。テスト）。ただし「炒める＝時間を見る」「炙る＝時間をかける」は**言葉の上では近く**、プレイヤーが二つを別の調理と感じるかは HV で確認が要る（炎・光の見た目で差を付けた）。

## 5. 検証

| 区分 | 結果 |
|---|---|
| 新規 Vitest | `logic/sear/**`（長押しの状態機械・色・reducer・flagOff・architecture）、`searIngredients`、`searPreview`、`SearLayer`（fake timer 15 件）、`PizzaStage.SearLook`（ソーセージ SVG の構造固定＋ class/変数の受け渡し）。**合計 約 80 件・全件 pass** |
| 実ビルド・ゲート | `searPreview.gate.test.ts`（本番ビルドに `cookSear` が無い／Preview ビルドにはある。2 回の `vite build`） |
| 全 Vitest | **584 files passed / 1 skipped（計 585）、10,956 tests passed / 13 skipped / 2 todo、失敗 0**（所要 1,130 秒。skipped / todo は既存分。直前の Cooking Prep 1B 時点の 10,639 件から新規分で増加） |
| `tsc -b` | エラーなし |
| oxlint | 触ったファイルに警告 0（全体の残りは `CheesePoolCanvas.tsx` / `GameScreen.tsx:553` の既存分） |
| Chromium E2E（新規 `e2e/cooking-sear.spec.ts`） | **390×844・360×800 で各 6 件、計 12 / 12 pass**。ゲート（フラグ無しではピルが出ない・`?cookPrep=on` だけでは出ない）／ピルの位置（44px・ステージ下端−18px・生地に触れない）／押している間だけ色が動き離すと止まる／保存データ（localStorage）が前後で同一／タップは残さない／× は残さない／ボタン ≥56px・× から ≥8px・スクロールなし／背面（焼く！・トレイ）は触れず、閉じた直後の遅れタップが生地に届かない／炙ったまま 焼く → 取り出す → RESULT まで進む |
| 既存の炒め E2E | `cooking-prep.spec.ts` **50 pass / 4 skip（無修正。skip は既存分）**、390×844 と 360×800 |
| WebKit | **ローカル不可**（環境に WebKit が無い）。CI の WebKit シャードで確認が要る。長押し系のイベント（`pointercancel`・`setPointerCapture`・`touch-action: none`・`-webkit-mask-image`）は iOS Safari での実機確認が必要 |
| 実機 | **未実施** |

## 6. 既知のリスク・トレードオフ

1. **ソーセージの色の上書きは「SVG の構造」に依存する。** `IngredientGlyph.tsx`（#723 が触る HOT 寄りのファイル）を編集しない代わりに、`Sear.css` が `path:nth-of-type` と `g[fill="#6e2a1e"]` で `fill` / `stroke` を上書きする（炒めの beef と同じ手法）。**ソーセージの絵が変わると静かに効かなくなる**ので、構造を固定するテスト（`PizzaStage.SearLook.test.tsx`）を置いた。#723 マージ後に絵が変わったらこのテストが落ちる（意図した検知）。
2. **盤面の視認性**（§4.2）。ほんのり／こんがりの差は小さく、深いとブラックオリーブに近づく。
3. 炙りは**この 1 ラウンドに 1 回**・取り消し無し。再度炙るには「やり直す」（盤面ごと破棄）。
4. 炙り画面は `game-screen--prep-busy`（炒めと同じ「背面を薄く」クラス）と `setPrepBusy` を共有する。炒めと炙りの画面が同時に開くことは無い（選択は 1 食材）が、状態を共有している点は記録しておく。
5. Preview 用の HV 専用入口（`?cookPrepHv=1` のような 1 URL 起動）は**作っていない**。実機では Preview で `?cookSear=on` を付け、Free Cooking → TOPPING → ソーセージを選ぶ（HAND_ON 相当の所持が必要）。専用入口が必要なら別途。
6. 動画・スクリーンショットは dev サーバー＋Playwright の実ポインター入力で、**Preview ビルドの実機録画ではない**。

## 7. HV 成果物

| 区分 | 内容 |
|---|---|
| 動画（repo に commit しない・Owner へ直接提出） | `cooking-sear-phase1-hv-390x844.mp4`（H.264、390×844、約 27 秒、人間のペース、画面に指のリングを重ねた）。ソーセージ選択 → ピル → 3 枚置く → 炙り画面 → **短いタップ（何も残らない）** → **約 3.2 秒の長押し** → 離す →「しっかり焼き目」→ 閉じて「✓ 炙り済み」→ 盤面の色の変化 → 焼く → 取り出す → RESULT（既存フローの完走） |
| スクリーンショット（commit 済み） | `docs/reports/screenshots/cooking-sear-phase1/` — 390×844・360×800 の各 11 枚（`00` フラグ OFF の before、`01` ピル、`02` 置いた生、`03` 炙り画面（待機）、`04` 押下中（薄）、`05` 押下中（濃）、`06` 離した直後、`07` 盤面の after、`08` レイアウト、`09` 3 枚炙り、`10` 焼成）＋ `before-after-390x844.png` / `before-after-360x800.png` |
| Video Verification | PASS（ファイル存在・size > 0・最後まで再生・390×844 全体が映る・対象操作が映る。ffprobe: h264 / 390×844） |

## 8. 推奨モデル

- **Phase 1 の調整（色・長押し時間・文言）と HV 修正:** Sonnet 5.5 で足りる（定数 1 か所と CSS の範囲）。
- **他食材への展開（Phase 2）の設計判断、`preparedLook` と `searedLook` の統合や、reducer の「調理法の種類」一般化のレビュー:** Opus 5.5 を推奨（HOT file とセーブ境界に触れうるため）。
- これは助言で、決定は Owner。

## 9. Owner に判断してほしいこと

1. 実機 HV（§4.1 の ①〜⑤）の結果と、4 秒の長押しの長さ。
2. 盤面の視認性（§4.2）: 色の見直しをしてよいか（暗さの抑制、薄い側の差の強調）。
3. Preview の共有デプロイ（この ブランチで実機に出すため）を認めるか。**→ §10 のとおり 2026-11-02 に実施済み（Owner 指示）。**
4. 炙りを 1 ラウンド 1 回・取り消し無しのままでよいか。
5. Phase 2（他食材）に進むか、ここで評価を止めるか。

## 次のアクション
§10 の iPhone Safari 実機 HV を Owner が行い、結果を待って停止する。PR 作成・merge・Production 更新・本番フラグ ON は行っていない（共有 Preview のみ #724 に切替済み）。

## 10. 再開セッション（2026-11-02）: 統合と共有 Preview の #724 への切替

### 10.1 重複防止の確認
| 項目 | 結果 |
|---|---|
| 最新 main | `82665c8`（#723 merge 済み）。#724 の PR は未作成、open PR に #724 と重なるものなし |
| 実作業の所在 | `claude/teto-pizza-cooking-audit-5qhbpw`（base `7f3aa63`）。指定ブランチ `claude/teto-pizza-724-cooking-sear-nr27h1` は main と同一で空だった |
| 3 秒既定 | 維持（`SEAR_FULL_MS = 3000`、コード `97fc650`、文書 `6ed4acf`）。2/3/4 秒の比較（`?cookSearMs=`）も維持 |
| 統合 | 指定ブランチへ上記ブランチを `--no-ff` で merge（衝突なし、履歴の書換えなし）。統合 HEAD = `a1b7419`。元ブランチは削除していない |

### 10.2 PR #723 の Production Deploy
`Deploy to GitHub Pages` run #492（head `82665c8`）= **success**。同 head の `E2E WebKit` run #1322 は確認時点で実行中（Preview 切替の条件ではない）。

### 10.3 安全性（Preview 公開前）
- `SEAR_EXPERIENCE_PRODUCTION = false` のまま。Production ビルドは `cookSear` / `cookSearMs` を含まない（`searPreview.gate.test.ts` が実ビルドで確認）。main 自体にこのコードは未到達。
- 炙りは Preview/DEV の `?cookSear=on` のときだけ有効。保存形式・採点・既存の炒め／FINISH は変更なし。
- 検証（統合 HEAD `a1b7419`）: `tsc -b` エラーなし／全 Vitest **586 files passed / 1 skipped、11,010 tests passed / 13 skipped / 2 todo、失敗 0**／oxlint エラーなし。既存テストの skip・緩和・timeout 延長なし。

### 10.4 共有 Preview の切替
| 項目 | 内容 |
|---|---|
| 切替前（復元用） | Source commit `4b0df7cf0224d7c2c562503340f74684e38089fc`（#723）。戻す場合は `Build & deploy a source PR/branch` にこの SHA と PR 番号 723 を入れて再実行し、続けて `Deploy Preview to GitHub Pages` を実行 |
| 切替後 | Source commit `a1b7419bed41f4a6f73b778b6cd498e1640afcb1`、Source PR 表示 `#724`（Issue 番号。PR は未作成）、Built 2026-11-02T09:05:53Z |
| 実行 | preview repo: Build & deploy run #203 = success、Deploy Preview to GitHub Pages run #200 = success |
| 公開物の確認 | preview repo の `site/assets` に `cookSear` / `cookSearMs` / PREVIEW バッジを確認。**公開 URL へは本環境から到達できず（プロキシが拒否）、実ページの表示は未確認** |
| 注意 | Preview の保存キーは全 Preview ビルド共通。#723 の Preview で作った保存が残っている場合は想定外の状態になりうるため、使い捨てとして扱う |

### 10.5 iPhone Safari での確認
- URL: `https://perusonao.github.io/teto-pizza-game-preview/?cookSear=on`（3 秒既定）。比較は末尾に `&cookSearMs=2000` / `3000` / `4000` を付ける。`?cookSear=on` が無いと炙りは出ない（正常）。
- 手順: ①画面に PREVIEW バッジ `#724` / `a1b7419` を確認 → ②Free Cooking → ③TOPPING でソーセージを選び生地に置く（所持が必要。無ければ Shop で購入）→ ④「焼き目をつける」のピルをタップ → ⑤短いタップでは何も残らない → ⑥長押し（約 3 秒で「しっかり焼き目」）、押している間だけ色が進み離すと止まる → ⑦× で閉じ、盤面の色と「✓ 炙り済み」→ ⑧焼く → 取り出す → RESULT まで進む → ⑨`cookSearMs` を 2000 / 4000 にして長さの違いを比較 → ⑩`?cookSear=on` を外したらピルが出ないこと。
- 見てほしい点: §4.1 の ①〜⑤、盤面の視認性（§4.2）、WebKit 固有（`pointercancel`・長押し中のスクロール／選択／コールアウトが出ない）。

### 10.6 未実施・残課題
- iPhone Safari 実機 HV は **未実施**（Owner）。結果の PASS/FAIL は Owner の言葉で記録する。
- HV 動画・スクリーンショットは従来分（dev サーバー＋Playwright）のまま。今回の再開セッションでは新規撮影なし（コード変更なし）。
- WebKit CI は `97fc650` で run #1320 を確認済み（文書 `6ed4acf`）。統合 HEAD `a1b7419` では、指定ブランチへの push に対する WebKit は未確認。PR 作成時に CI で確認する。
- #723 の `E2E WebKit` run #1322 は実行中だった。
- PR 作成・merge・Production 更新・本番フラグ ON はしていない（Owner 判断待ち）。

## 11. iPhone Safari HV: 「🔥 炙る」ピルが出ない（調査と修正）

| 項目 | 内容 |
|---|---|
| 症状 | Preview #724 / a1b7419、TOPPING でソーセージ選択・配置（10→9）は成功、ピルが見えない |
| 実 DOM / 位置（Chromium＋iPhone 寸法・タッチ・モバイル UA、`?cookSear=on`） | 390×844: stage 100–550、dough 180–470、pill 488–532（帯の中・生地に非接触）。360×800: stage 100–506、dough 166–440、pill 444–488。両方 `elementFromPoint` がピル自身（隠れなし）。390×664 / 360×640 では生地に重なるが表示はされる |
| 結論 | 表示条件・配置・重なりでは再現せず。ピルの表示は `searExperienceEnabled()`（= Preview/DEV の `?cookSear=on`、**ページ読込時の URL だけ**を読む）に完全に依存。Owner の回答で iPhone では URL に `?cookSear=on` が無い／不明 → opt-in が OFF のまま（正常動作）と判断。Safari 実機・WebKit は本環境から未確認 |
| 修正（最小） | `?cookSear=on` をタブ単位（sessionStorage、Preview/DEV のみ）で記憶。以降の読込（再読込・クエリ無し）でも ON。`?cookSear=off` で解除。ゲート・本番 OFF（`SEAR_EXPERIENCE_PRODUCTION=false`・本番ビルドに `cookSear` 無し）・3 秒既定・炙り操作は無変更 |
| テスト | `searPreview.test.ts` に記憶／解除／storage 例外の 3 件追加。sear 系＋preview 系 34 files / 286 tests pass、`tsc -b` エラーなし。既存テストの緩和なし |
| 未完 | 最初の 1 回は `?cookSear=on` 付き URL で開く必要がある（URL 無しの初回は OFF のまま）。修正版 Preview の公開・実機再確認・HV 動画は Owner 承認後 |
