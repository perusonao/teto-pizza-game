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

## 12. 実機 HV 専用入口 `?cookSearHv=1`（Preview/DEV 限定）

| 項目 | 内容 |
|---|---|
| URL | `https://perusonao.github.io/teto-pizza-game-preview/?cookSearHv=1`（長押し比較は `&cookSearMs=2000` / `4000`）。`?cookSear=on` は不要 |
| 開始状態 | Free Cooking の TOPPING。生地は理想形、ソース（トマト）は実際に塗布、チーズ（モッツァレラ）は実際に配置済み（reducer の実アクション）。ソーセージ所持 10・最初から選択、「🔥 炙る」ピルが即表示。炙り ON・長押し既定 3 秒 |
| 保存データ | **端末の実保存は読まず・書かない**。`localStorage` をメモリ上の使い捨て保存（Hint 5.0 HV seed `calabresa-key-free` を実 save writer で書いたもの。全 ladder 素材を 10 ずつ所持）に差し替え。再読込でやり直し。差し替え失敗時は入口 OFF（fail closed）。タブ記憶（`teto:cookSear`）も書かない |
| 重複回避 | #724 ブランチ・`3b49a9f`（opt-in 記憶）を確認。炒める入口（`cookPrepHv`）の仕組みを再利用（`createDisposableStorage` を export しただけ、挙動不変）。両方指定時は炒める入口を優先し本入口は OFF |
| Production | `import.meta.env.DEV \|\| VITE_PREVIEW_MODE` の静的ゲート内のみ。`cookSearHv.gate.test.ts` が実ビルドで、Production に `cookSearHv` / `cook-sear-hv-v1` が無く Preview にはあることを確認。`SEAR_EXPERIENCE_PRODUCTION=false` のまま |
| 変更ファイル | `src/preview/cookSearHv.ts`・`CookSearHvStarter.tsx`（新規）、`searPreview.ts`（`forceSearOptInForHv` 追加）、`main.tsx` / `App.tsx`（各数行）、`cookPrepHv.ts`（export のみ） |
| テスト | Vitest: `cookSearHv.test.tsx`（6 件）・`cookSearHv.gate.test.ts`（3 件）。E2E `e2e/cooking-sear-hv.spec.ts`（入口・保存非破壊・位置、入口→置く→炙り 3 秒→焼成→取り出す→仕上げ→RESULT、再読込でやり直し・`cookSearMs`、パラメータ無しは通常起動）を 390×844 / 360×800 で実行。炙り・炒める既存 E2E 含め 78 件 pass。テストの緩和なし |
| 画像 | `docs/reports/screenshots/cooking-sear-hv-entry/`（`iphone-390x844-` / `iphone-360x800-` の `hv-00-entry`〜`hv-03-result`） |
| 未実施 | Safari 実機 HV（Owner）、HV 動画 |

## 13. iPhone Safari HV フォローアップ（ピル位置・焼き目の段階・2/3/4 秒）

前提（Owner の実機確認）: Preview `2d9c3d49`、`?cookSearHv=1` で入口表示・長押し・「炙り済み」・具材画面への復帰を確認済み。**共有 Preview は未更新（このセクションの変更は branch のみ。公開は Owner 承認待ち）。** main は `82665c8` のまま、open PR との重なりなし（`git merge-tree` clean）。

### 13.1 ピルの位置（原因と修正）
| viewport | stage | dough | ピル（修正前） | 生地との隙間（修正前） |
|---|---|---|---|---|
| 390×844 | 450 | 290 | 帯（stage 下端−18px） | +18px |
| 360×800 | 406 | 274 | 帯 | +4px |
| 390×760 | 366 | 290 | 帯 | −24px（重なる） |
| 390×750 | 356 | 290 | 帯 | −29px |
| 360×700 | 318 | 274 | 帯 | −40px |
| 390×664 | 282 | 274 | 帯 | −58px |
| 360×640 | 258 | 250 | 帯 | −58px |

- **原因:** 生地は**円**で stage の縦中央に置かれ、帯が空くのは `stage 高 ≥ 生地 + 約124px`（390 幅で ≥414、360 幅で ≥398）のときだけ。権威 viewport（390×844 / 360×800）は満たすが、**実機 Safari のアドレスバー／タブバーで可視高が縮むと満たさず**、生地の下 30〜58px にピルが重なる（見えない・生地の下端を置けない）。表示条件ではなく**配置の問題**。
- **修正（最小）:** `src/logic/sear/searPillPlacement.ts`（純関数）が実際の stage／生地の rect から「帯が円に触れるか」を計測し、触れるときだけ `data-placement="corner"`（`SearLayer.tsx`、`ResizeObserver`＋`resize` で再計測）。corner は stage の**右下の角**（円の外側）に 56×52 の同じピル（同じ文言・タップ領域 ≥52px）、「✓ 炙り済み」は 28px の小マーク（`Sear.css`）。権威 viewport は**従来どおりの帯**（centred・18px・44px）。高さの固定しきい値ではなく幾何で決めるため、アドレスバーの伸縮や別サイズでも正しい側に倒れる（iOS で未検証の CSS 数式／コンテナクエリは使っていない）。
- 画像: `docs/reports/screenshots/cooking-sear-hv-followup/position-short-before-after.png`（390×664 / 360×640 の前後）、`position-authority-and-750.png`（帯のまま／750 で corner）。

### 13.2 長押し中の焼き目の変化
- **現状の問題（画像 `hold-screen-before-after.png` の BEFORE 行）:** 保持中の見出しは常に「炙ってる… 離すと決まるよ」で、**今どの焼き目か**は色だけ。盤面（ピース約 24px）では、ほんのり≒生、しっかり≒まっくろが近い。
- **変更 1（色）:** 輝度に加えて**色相**で分離。生のピンクがかった赤（約 12°）から、炙り始めで橙〜琥珀（20〜27°）へ、まっくろは赤茶（13°）へ。隣り合う段階の面の色距離 30 / 38 / 51 / 26（RGB）。既存の全制約（単調に暗くなる・リングが面より暗い・脂身が明るい・輪郭が最暗・まっくろでも黒つぶれしない（輝度 0.036 > 0.03）・生との輝度比の床）は**緩めず**に満たす。
- **変更 2（見出し）:** 保持中に**言葉だけ**で段階を出す（「いま ほんのり…／こんがり…／しっかり…／まっくろ… 離すと決まるよ」）。`SEAR_LOOK_LIVE` / `searHoldingTitle`（`searHold.ts`）。数値・ゲージ・バー・カウントダウン・合否・時間制限は**追加していない**（保持はいつまでも続けられ、自動で閉じない／採点・★・Pitz・保存は不変）。語は結果の語と同じ 4 つで、閾値（0.3 / 0.62 / 0.9）も同じ。
- 画像: `hold-screen-before-after.png`、`pizza-looks-before-after.png`、`pizza-looks-zoom-before-after.png`（盤面のピースを拡大）。**所見:** 盤面での差は「ほんのり＝橙寄り、こんがり＝琥珀、しっかり＝焦げ茶、まっくろ＝ほぼ黒」。ほんのり vs 生は**改善したがなお控えめ**（残課題 13.6）。

### 13.3 焼成 → 取り出し → 仕上げ → RESULT の維持
同じ手順で「生」と「しっかり（2.4 秒保持）」を比較。ピースの塗り（computed fill）は PREPARE `rgb(95,60,38)` → BAKE → FINISH → RESULT で**不変**（生は `rgb(185,94,71)` のまま）。見た目も維持（画像は dev ハーネスでの確認）。**得点は同一（87 点・★4・「ジャスト」・+106 Pitz）で、炙りは採点に影響しない。** E2E `cooking-sear-hv.spec.ts`（入口→炙り 3 秒→焼成→取り出す→完成→RESULT）が両 viewport で通る。

### 13.4 2 秒・3 秒・4 秒の比較と提案
各看板の判定語に入る保持時間（ms。タップ判定の下限 350ms 以降）:

| 設定 | ほんのり | こんがり | しっかり | まっくろ | しっかりまで／まっくろまで |
|---|---|---|---|---|---|
| 2 秒 | 350–600（250） | 600–1240（640） | 1240–1800（560） | 1800– | 1.24 s ／ 1.8 s |
| **3 秒（既定）** | 350–900（550） | 900–1860（960） | 1860–2700（840） | 2700– | 1.86 s ／ 2.7 s |
| 4 秒 | 350–1200（850） | 1200–2480（1280） | 2480–3600（1120） | 3600– | 2.48 s ／ 3.6 s |

窓の中央を狙って離すと仮定し、離すタイミングのばらつき σ（人の反応・指離れ。**実測ではなくモデル**）を変えたときの「狙った段階に収まる確率」:
| σ | 2 秒（こんがり／しっかり） | 3 秒 | 4 秒 |
|---|---|---|---|
| 150ms | 97% / 94% | 100% / 100% | 100% / 100% |
| 250ms | 80% / 74% | 95% / 91% | 99% / 97% |
| 350ms | 64% / 57% | 83% / 77% | 93% / 89% |

- **2 秒:** ほんのりの窓が 250ms しかなく（タップ判定 350ms の直後）、こんがり／しっかりの窓も 0.56〜0.64s。素早すぎて段階を選びにくい。
- **4 秒:** 窓は広いが、しっかりまで 2.5s、まっくろまで 3.6s の長押しが必要。3 個置いた後に 1 回だけ炙る流れでも、指が疲れ、待ち時間が長い。
- **提案: 3 秒既定を変更しない。** ばらつき σ=250ms で 91〜95% が狙った段階に収まり、しっかりまで 1.9s・まっくろまで 2.7s で「長押し」と呼べる範囲に収まる。しかも今回、保持中に段階の語が出るので、狙い撃ちではなく**語を見て離す**使い方になり、窓の広さへの依存は更に下がる。2 秒／4 秒は `?cookSearMs=` の比較として残す（変更なし）。実機での 2/3/4 比較は Owner の指で最終判断。画像: `compare-2s-3s-4s.png`（各設定の連続保持の途中経過。フレームの時刻はスクショ処理の遅れを含む目安）。

### 13.5 テスト結果（再発防止を含む）
- 追加: `searPillPlacement.test.ts`（幾何、権威／短い viewport の 7 プロファイルと境界・未レイアウト）、`searHold.test.ts`（保持中の語・数字なし・閾値）、`SearLayer.test.tsx`（見出しが ほんのり→こんがり→しっかり→まっくろ と進み、dispatch・自動クローズ・進捗バーなし）、`sausageSear.test.ts`（隣り合う段階の色距離 ≥24、ほんのりの色相 +6° 以上）、E2E `cooking-sear-pill-position.spec.ts`（8 プロファイルで: ピルが円に非交差、stage・画面内、生地下端のタップが通る、「炙り済み」も同条件）。
- 既存テストの緩和・skip・timeout 延長なし（位置 E2E は 1 テスト 8 プロファイルが 30 秒の既定を超えたため、**プロファイルごとのテストに分割**。検証内容は同じ）。
- 回帰（390×844 / 360×800 の両 project、E2E）: 炙り・入口・位置・炒める（`cooking-prep`）・FINISH 系（`finish-bar-finc` / `finish-flow-find` / `finish-screen-fina` / `finish-tray-finb` / `free-finish-e3b`）= **162 passed、5 skipped（既存の skip）、失敗 0**（位置テストの分割前 1 件のタイムアウトを上記のとおり修正して再実行済み）。
- **全 Vitest: 589 files passed / 1 skipped、11,036 tests passed / 13 skipped / 2 todo、失敗 0**（HEAD `52902578` の内容。#724 前回の 588 files / 11,022 tests から +1 file / +14 tests）。`tsc -b` エラーなし、oxlint はエラーなし（既存の警告のみ）。Production 隔離テスト（`searPreview.gate` / `cookSearHv.gate`）も全 Vitest に含まれ pass。

### 13.6 残課題
1. ほんのり vs 生は改善したがピース 24px では控えめ（色以外の手がかり＝焼き目の質感などは Phase 1 の範囲外）。Owner が実機で足りないと判断した場合のみ追加調整。
2. 角のピルは一覧性が帯より低い（文言は同じ）。実機で見つけにくければ、アイコン＋「炙る」の縦 2 行などを検討。
3. 保持中の語表示の採否は Owner の判断（数値・ゲージ・判定は無いが「語」は進捗の手がかり）。不要なら `searHoldingTitle` を固定文言に戻す 1 箇所の変更で戻せる。
4. WebKit での `ResizeObserver` による再計測（アドレスバー伸縮時）は Chromium のみで確認。実機 Safari で、ツールバーの出し入れ後にピルが帯⇄角で正しく切り替わるかの確認が必要。
5. 共有 Preview は未更新（Owner の承認待ち）。

## 14. 共有 Preview の更新（Owner 承認済み、HEAD `2000dba4`）

| 項目 | 内容 |
|---|---|
| 公開前の確認 | HEAD `2000dba4fc5cedea844f943848e6de3239a79f91` = origin の同ブランチ、作業ツリーはクリーン、`SEAR_EXPERIENCE_PRODUCTION = false`。テスト結果は §13.5（全 Vitest 589 files / 11,036 tests、失敗 0。E2E 162 passed、失敗 0） |
| ビルド | preview repo: `Build & deploy a source PR/branch` run #205（ref = `2000dba4…`、pr_number = 724）= **success** |
| Pages デプロイ | `Deploy Preview to GitHub Pages` run #202（preview repo main `5a4218ce`、コミットメッセージ `Deploy preview: 2000dba…`）= **success** |
| 公開 SHA | preview repo README: Source commit `2000dba4fc5cedea844f943848e6de3239a79f91`、Source PR 表示 `#724`（Issue 番号。PR は未作成）、Built 2026-11-02T14:59:21Z |
| 公開 URL の実ページ | 本環境から到達できず（プロキシが拒否）、表示は未確認。Actions の成功と README の SHA までを確認 |
| 復元用（直前の公開元） | `2d9c3d492093cf3495f0cc3b57d3d65ab2d8841e`（`Build & deploy a source PR/branch` を ref = この SHA、pr_number = 724 で再実行し、続けて `Deploy Preview to GitHub Pages`） |

実機確認 URL: `https://perusonao.github.io/teto-pizza-game-preview/?cookSearHv=1`（画面のバッジが `#724` / `2000dba`）。長押し時間の比較は末尾に `&cookSearMs=2000` / `4000`。

実機で見てほしい点: (1) 短い可視高（Safari のツールバーあり）でピルが右下の角に出て、生地と重ならず、生地の下端にも置ける。(2) 画面を縦に伸ばす／縮める（ツールバーを出し入れする）とピルが帯⇄角で正しく切り替わる（§13.6-4）。(3) 保持中の見出し（ほんのり→こんがり→しっかり→まっくろ）と色の見分け。(4) 3 秒の長押し感（必要なら 2 / 4 秒と比較）。(5) 炙り後の焼成〜取り出し〜仕上げ〜RESULT での色の維持。

PR 作成・main への merge・Production 更新はしていない。Production の炙りは OFF のまま。公開後の追加実装はなく、Owner の実機 HV 結果を待つ。

## 15. PR 作成前の Fresh Audit と実機 HV の記録（Final Gate 準備）

### 15.1 Fresh Audit（base `82665c8`、branch HEAD の時点）
| 項目 | 結果 |
|---|---|
| 最新 main | `82665c8`（#723）。#724 の branch は main の先に 1 本の履歴で、`git merge-tree` で **衝突なし**（merge 不要） |
| 既存 PR | #724 の実装 PR は**無い**（`perusonao/teto-pizza-game` の open PR を確認）。炙り（sear）に触れる open PR も無い。`GameScreen.tsx` / `PizzaStage.tsx` に触れる stale な draft（#478・#468）は古い履歴で、claim（Issue #724 のコメント）に記載済みのとおり後発が base を取り込む |
| 必読ドキュメント | `CLAUDE.md`、`PROJECT_HANDOFF.md`（startup checklist）、`TETO_HUMAN-VERIFICATION-POLICY.md`、`TETO_SESSION-OPERATIONS_1.0.md`（claim / Owner Gate / HV 手順）を確認 |
| PR テンプレート | リポジトリに無し（`.github/` は workflows のみ）。PR 本文は Result Report の構成に合わせる |
| 変更範囲 | main との差分: 新規ファイル（`src/logic/sear/**`、`src/components/SearLayer*`・`Sear.css`、`src/data/sear*`、`src/preview/searPreview*`・`cookSearHv*`・`CookSearHvStarter.tsx`、E2E 3 本、文書・画像）と、既存ファイル 6 本への**追加のみ**の小変更: `App.tsx`（+6 / −1）、`GameScreen.tsx`（+22 / −0）、`gameReducer.ts`（+22 / −1）、`PizzaStage.tsx`（+19 / −2）、`main.tsx`（+3 / −1）、`cookPrepHv.ts`（`export` を 1 語足しただけ）。HOT ファイルは `App.tsx` / `GameScreen.tsx` / `gameReducer.ts`（いずれも追加のみ、重なる open PR なし） |
| Production OFF | `SEAR_EXPERIENCE_PRODUCTION = false`。炙りは Preview/DEV の `?cookSear=on`（タブ記憶つき）または `?cookSearHv=1` のときだけ。`searPreview.gate.test.ts` / `cookSearHv.gate.test.ts` が**実 `vite build`** で、Production バンドルに `cookSear` / `cookSearHv` / `cook-sear-hv-v1` が無いことを確認（Preview バンドルにはあることも確認） |
| 保存互換性 | `persistence.ts` は**無変更**。`searedLook` は `GameState` の一時項目で、保存されず、`RESET_PIZZA` で消え、ピースの色以外に読まれない。保存スキーマ v2 不変。HV 入口は使い捨てのメモリ保存で端末の実保存を読み書きしない（E2E で実保存のバイト一致を確認）。所持数・進行・採点・★・Pitz は炙りで変わらない（§13.3: 得点 87 点で生と同一） |
| 炒める・FINISH への影響 | 炒める（`CookingPrepLayer` / `logic/prep/**` / `prepIngredients` / `prepExperienceGate` / `prepPreview`）と FINISH のロジックは**無変更**。既存の炒める・FINISH の E2E を両 viewport で実行して回帰なし（§13.5: 162 passed、失敗 0）。炒める HV 入口（`?cookPrepHv=1`）は両方指定時に優先される |
| 炙りの既定 | 長押し 3 秒（`SEAR_FULL_MS = 3000`）を維持。2 / 4 秒は `?cookSearMs=` の比較のみ（Preview/DEV） |

### 15.2 実機 HV の記録（iPhone Safari、Preview `2000dba4`、`?cookSearHv=1`）
**出所:** Owner からの依頼文（2026-11-02）に記載された結果の転記。SESSION-OPERATIONS §3 のとおり HV の PASS / FAIL の語は Owner のものなので、Owner が PR / Issue 上で改めて明記するまでは、**正式な HV 判定の記録としては扱わない**（セッションが代わりに PASS を宣言しない）。

| 確認項目 | 結果（Owner 報告） |
|---|---|
| 専用入口（`?cookSearHv=1`）の表示と開始状態 | PASS |
| 炙り（ピル・長押し・炙り済み表示） | PASS |
| 焼成 | PASS |
| RESULT | PASS |
| Safari **ツールバーの出し入れ**でピルが帯⇄角で切り替わる動き（§13.6-4） | **未確認**（PASS として扱わない。Chromium のみで確認済み） |

HV Policy の成果物: 静止画 before/after は `docs/reports/screenshots/cooking-sear-hv-followup/`（6 枚）と `cooking-sear-hv-entry/`（8 枚）に commit 済み。**HV 動画**（390×844、ユーザーへ直接提出、commit しない）は今回のコード（`2d9c3d49` → `2000dba4`）分は**未提出**で、Policy §12 の DoD の「Human Verification video / Video validation / Download link」は**未完了**。実機 HV（Owner）が主な証跡で、動画の要否は Owner の判断に委ねる（未完了を PASS とは書かない）。

### 15.3 別 Issue 候補（この PR では実装しない）
1. **焼き目の追加視認性改善:** ほんのり vs 生は色相の分離で改善したが、盤面のピース（約 24px）ではなお控えめ。色以外の手がかり（焼き目の質感・グリルマーク等）は Phase 1 の範囲外のため別 Issue 候補。
2. **Safari ツールバー切替の実機確認:** 帯⇄角の切替（`ResizeObserver` による再測定）を実機 Safari で確認する（未確認の項目）。
3. **角のピルの見つけやすさ:** 実機で見つけにくい場合の表示（縦 2 行など）。
4. **保持中の語表示の採否:** Owner の判断（不要なら `searHoldingTitle` を固定文言に戻す 1 箇所の変更）。
5. Phase 2（他食材への展開）は保留のまま。

### 15.4 Final Gate の記録方法
HEAD が変わると CI・WebKit・Codex の証跡は無効になる（SESSION-OPERATIONS §2「latest head vs reviewed head」）。このため、**最新 HEAD に対する CI・WebKit Gate・Layout Contract Gate・Codex レビュー・未解決スレッド・mergeability の実測値は PR 本文（`Final Gate` 節）に追記し、文書 commit は追加しない**（追加すると head が動いて Codex の再レビューが必要になるため）。Result Report には、PR 作成時の HEAD と上記の固定の事実のみを置く。merge・Production 更新・機能有効化は行っていない。
