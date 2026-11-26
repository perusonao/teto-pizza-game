# B案再構成 Phase 2a — 注文システムの Preview 接続 Result Report（2026-11-26）

- 親 Issue: #901（claim: 2026-11-26 投稿）／設計: `docs/design/TETO_SHOP-GROWTH-RESTRUCTURE_PHASE0-1_DESIGN_2026-11-25.md` §3.2・§4 Phase 2a・§6
- 基準: `main` = `2240f13`（Phase 1a PR #903 と Phase 1b PR #906 がマージ済み）
- 状態: **Draft PR。マージと Draft 解除は Owner 承認待ち**

## 1. 何をしたか

- **Preview 限定（`?progression=shop`）で、次のループを通しました**：注文 → 調理 → 評価 → Pitz と評判 → 章の進行 → Shop で買える材料の拡大
- **本番の既定は legacy のまま**です
  - フラグの既定値には触れていません
  - shop 用の UI は、shop モデルが動いているとき（`SHOP_MODEL_ACTIVE`）だけ描画します

| 項目 | 内容 |
|---|---|
| 評判表 | Owner 承認値（2026-11-26）を `REPUTATION_TABLE` に反映。章の下限 0／40／110／210／340、注文 1 件 ★1 +1／★2 +2／★3 +3／★4 +5／★5 +8、メニュー開発（初回発見）+3。Pitz の初回発見ボーナス +50 は従来どおり。gate テストは「全部 null」の確認を、**承認値そのものを固定する確認**に置き換えた（Phase 1b のテスト注記が予告していた唯一の追従） |
| `SHOP_PROGRESSION` | 評判 → 章（最高到達の下限）。章 → 材料（その材料を必要とする採用レシピの最小章）。材料の解放は legacy と同じく、台帳・所持品との和集合で、再ロックしない。価格と並び順はラダーのまま（R1）。starGate（R2）と late floor（R3）は読まない |
| メニュー | （初期メニュー margherita（Q2）∪ `grantedMenuRecipeIds` ∪ Dex の発見済み）∩ 採用集合。初期メニューは導出で持つので、新規セーブでも legacy セーブでも `shopProgress` キーは作られない |
| 採用集合（暫定） | `MENU_CATALOG`（厳選 60 品、Phase 3）はまだ空。そのため**暫定カタログ＝全レシピを legacy 章（1〜4）のまま**使う。新しい章番号や数値は作っていない。`MENU_CATALOG` に 1 件でも入れば、カタログ全体が自動で切り替わる。本番切替の gate（`canEnableShopProgression`）は、引き続き厳選カタログを必須にしている |
| 注文（通常営業） | 既存の FREE の Mito 注文（ORDER フェーズ、`nextOrderState`）を使う。プールは「メニュー ∩ 調理可能」。HOME の「注文を受ける」と RESULT の「次の注文へ」から入る（どちらも `PLAY_AGAIN` で、新しく Mito 注文を引く） |
| 報酬 | Pitz は既存の `applyPitzCredit`（出来栄え倍率）と手際ボーナス（Q6）。評判は、注文なら星の数、メニュー開発なら +3。**Lunch Rush では評判を加えない**（R7、既存の run 報酬だけ）。章を越えた注文では、同じトランジションの中で材料を解放し、RESULT で「新しい材料が入荷」を表示する |
| 評価アダプタ | `serviceQuality.ts` の `serviceQualityOf(score, cut)`。Pitz、手際、評判は、評価をこのアダプタ経由でだけ読む。中身は既存の `total`／`stars` をそのまま返すだけ（legacy の Pitz も同じ値になる）。Scoring 3.0（#176）は、このアダプタの中身だけを差し替える |

### 申し送りへの対応

`menuRecipeIds` / `isOnMenu` の付け替え先（legacy では、どれも「発見済み」と同じ値を返す）:

| 呼び出し元 | 対応 |
|---|---|
| 注文プール（`guidedRecipeIds`） | メニュー ∩ `canStartGuidedRound` |
| `canStartGuidedRound`（LK-8 の単一判定。R6） | 「発見済み」を「メニューにある」に置き換え。`SELECT_RECIPE`／`BEGIN_PREPARE`／`RETRY`／App の導線が、すべてこれを経由する |
| Lunch Rush（`missionOrderRecipeIds`、`pickMissionOrder` の backstop、`BEGIN_PREPARE`、`MISSION_NEXT_ORDER` の登録） | メニュー |
| Pizza Select（`buildPizzaSelectView` のカード） | 作ったことがある（BEST あり）∩ メニュー |
| REGISTER_TO_DEX の `guidedIdOnly` | メニュー。初期メニューの margherita を最初に出すと Dex に登録されるが、「発見」としては扱わない（+50 なし、NEW 表示なし） |
| GameScreen（`buildMitoOrderLine`） | **付け替えない**。ここは「前に作ったことがあるか」（Dex の記録）で常連向けのセリフを選んでいる。メニューに置き換えると、初回のマルゲリータ注文が「また〜」になってしまう |
| Free Cooking（`resolveFreeCookPizza`） | **付け替えない**。matcher の「未発見か発見済みか」の判定で、C3（matcher は不変）の対象 |

- **`isMaterialReached`**: `MaterialReachInputs` に `shop?` を追加しました
  - 渡し先: `resolveRoundTechniques`（reducer）、`isDoughAffordanceOpen`／`isTrayAffordanceOpen`（reducer と GameScreen）、`techniqueDexViews`（App）
  - shop の規則は「その材料の章が開いているか」です。legacy は `shop` を読みません（等価テストで固定）

### UI（shop のときだけ）

- **HOME**
  - 評判の行を追加（例：「評判 N　第X章　次の章まで あと M」）
  - 主ボタンを「注文を受ける」にした
  - Pizza Select は、その下の小さなリンク「メニューから選んで作る」から開く
- **RESULT**
  - 評判の行を追加（例：「評判 +N（a → b）」。章を越えたときは「第X章に進みました！」）
  - 主ボタンに「次の注文へ」を追加（「もう一度つくる」は副ボタンになる）
- **Shop**
  - 進捗の行を「評判があとNで第X章：新しい材料が入荷」に変更
  - ★ゲートの行は表示しない（R2 の吸収）
  - HV の録画中に、legacy の「あとN つ発見で〜」が出ていることに気づいて修正した

## 2. 今回やらなかったこと（後続 Phase へ）

- **Q7（Pizza Select ＝ 報酬なしの練習）**
  - shop でも、Pizza Select から作ったラウンドには、従来どおり Pitz と評判が入ります
  - 練習と注文を区別するには、ラウンドの種別（`RoundKind`）の追加、R8 の中断復帰用ジャーナル、RESULT の表示を一緒に変える必要があるため、Phase 2b にまとめる提案です
  - `RoundKind` の値も、その時点で追加します（今回は、通常営業を既存の GUIDED のまま運用しています）
- **Dinner の解放判定**：メニュー経由への付け替えは、設計どおり Phase 3 で行います
- **ヒントの対象を採用集合に絞る（Q4）**：Phase 3 で行います
- **「発見」の文言変更**（HOME の「レシピ 0/116」、Dinner の「発見で解放」など）：Phase 2b で行います

## 3. テスト

- **追加したテスト**
  - `src/logic/progression/shopProgression.test.ts`（28 件）
    - 章の境界
    - 暫定カタログ
    - 材料の章
    - entitlement の和集合と、変化がないときに同じ参照を返すこと
    - メニュー
    - アダプタ
    - 評判の加算
  - `src/state/gameReducer.shopService.test.ts`（19 件、shop）
    - 初回の注文
    - 星ごとの評判
    - Pitz の式
    - 累積
    - 章の到達と、材料の解放・通知
    - メニュー開発
    - 注文プール
    - Lunch Rush で評判が増えないこと
  - `src/state/gameReducer.shopService.flagOff.test.ts`（10 件、legacy）
    - 付け替えたすべての経路が、Phase 2a 以前の式と一致すること（既定ではない shop 状態を渡しても変わらないこと）
  - `src/components/shopModelUi.phase2a.test.tsx`（11 件）
    - HOME／RESULT／Shop で、shop の表示が出ること
    - 対応する props が無いときは、従来どおりの表示になること
  - `e2e/shop-service-orders-2a.spec.ts`（3 件、実ブラウザ）
    - legacy の HOME が変わらないこと
    - 新規セーブで注文から次の注文まで通ること
    - 評判 39 から章に到達すること
- **変更した既存テスト**：`reputationTable.gate.test.ts` だけです
  - 「全部 null」の確認を、承認値の固定に置き換えました
  - `perOrderGain` を星ごとの配列にしたので、型に合わせて合成テーブルを更新しました
  - 「表が未完成なら false」の確認は、未完成の合成テーブルで引き続き行っています
  - **削除・スキップ・緩和はしていません**

## 4. Human Verification

スクリーンショット（`docs/reports/screenshots/b-phase-2a-service-orders/`）:

| 区分 | ファイル |
|---|---|
| before（legacy） | `before-home-legacy.png`, `before-result-legacy.png` |
| after（shop） | `after-home-shop-new.png`, `after-order-shop.png`, `after-result-shop.png`, `after-home-shop-after-order.png`, `after-result-chapter-up.png`, `after-shop-chapter2-materials.png` |

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `B-PHASE-2A_shop-service-orders_390x844.mp4`（H.264） | 390×844 | 57.0 s | 1.04 MB | PASS |

Download: セッション内で直接提出しました（リポジトリには commit していません）。

Video Verification: PASS（ffprobe：h264, 390×844, 56.96 s, 1,035,717 bytes。途中のフレームを抽出して、HOME・RESULT・章到達が映っていることを確認）

動画で確認すること:

1. 冒頭（パラメータなし）：legacy の HOME。評判の行がなく、「ピザを作る」が主ボタンのまま
2. `?progression=shop` の新規セーブ：「評判 0　第1章　次の章まで あと 40」と「注文を受ける」が出る
3. ミトの注文（マルゲリータ）→ 調理 → RESULT：「評判 +3（0 → 3）　第2章まで あと 37」と「+83 Pitz」が出て、主ボタンが「次の注文へ」
4. 「次の注文へ」→ 次の注文画面 → HOME：評判の行が 3 になっている
5. 評判 39 のセーブで 1 件こなす：「第2章に進みました！」と「新しい材料が入荷：ペパロニ・…」が出る → ショップに第2章の材料が NEW で並び、「評判があと68で第3章」と表示される

## 5. 実行結果（ローカル）

- typecheck（`tsc -b`）／oxlint／`npm run build`：OK
  - Production バンドルに progression の DEV／Preview キーが残っていないことを確認
- vitest 全体：13196 passed／20 skipped（既存の skip）／2 todo、失敗 0（698 files）
- e2e（Chromium 390×844）
  - 関連する既存 spec 9 本と、新規 spec：35 件 passed
  - 対象：free-cooking、onboarding、Lunch Rush の材料不足、Shop LOCKED、生地の種類、○/□ 切替、Completion Gate、CUT の HOME 確認、本 PR の spec
