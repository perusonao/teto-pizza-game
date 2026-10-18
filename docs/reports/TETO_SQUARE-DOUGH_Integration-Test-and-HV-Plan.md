# Square Dough — 統合テスト計画 / iPhone Safari HV 準備（docs-only）

Epic #532 ／ 担当レーン: Square Dough 統合テスト・iPhone Safari HV 準備。
調査日: 2026-10-18。基準: `origin/main` = `3c3c2da`（#547 F1 マージ済み）。
範囲: **docs-only**。`src/**`・`e2e/**`・CSS は変更していない。既存 PR（#540 / #545 / #546 / #548）・他レーンのブランチには触れていない（`git fetch` と `git merge-tree` による読み取りのみ）。共有 Preview は未更新。新規 PR は作成しない（Owner 承認待ち）。

目的: B2・C・D・F・E の各工程が揃った時点で、最短で E（グランマピザ正式実装）の Final Gate を通すための、依存・テスト・HV・マージ順序の整理。

**改訂 2（2026-10-18）**: 同日の Owner 判断（§0）と最新の CI・PR 状態を反映。改訂 1 からの変更点は §0 と、本文中の「**[改訂2]**」印の箇所。この文書は PR 化しない（Owner 判断 7）。

---

## 0. Owner 判断（2026-10-18）の反映

| # | Owner 判断 | 反映先 |
|---|---|---|
| 1 | #545・#546・#548 のマージは**現時点で承認しない**。各 PR の Final Gate 後に個別判断 | §7.3、§8 |
| 2 | C #536 は **B2 受け入れ後に実装開始**。設計・テスト準備は先行可 | §2.1、§5、§7.3 |
| 3 | C の四隅 85% 到達は**初期基準として採用**。**均一度の最終閾値は実機 HV で決める** | §3.1 V-9〜V-11、§8 |
| 4 | C は完成後も「次へ」を押すまで**再編集可能**。「次へ」で形状を確定する（addendum §7-13 は回答済み） | §3.1 V-10/V-19、§4.8、§6.2 G-8 |
| 5 | D1 と F3 は C と**並行して独立部分の実装を許可**。共有ファイルの競合を避け、各担当 Issue に実装範囲を記録する | §2.1、§7.2、§7.3 |
| 6 | F3 の RESULT 中立文言は **「材料だけでなく、生地の形や調理法も見直してみよう。」で確定** | §4.7、§8（B-6 解消） |
| 7 | 本 docs-only 監査レポートは PR 化しない | 本文書 |

重要指示の反映:
- **#548 の WebKit 再実行失敗は、証拠なしに既知 flake と判定しない。原因を失敗ログ/artifact で確認するまで Final Gate は RED/保留**（§1.2、§8 B-1）。
- **F4 の必須受け入れ条件**: `PizzaState.pan="tray"` の設定と、Technique 解放条件との接続（§2.3、§4.4、§5）。
- **D2 着手前に #518 の依存を再確認**（§1.3）。
- **#521 は Owner 決定済み項目と未確定項目を区別**し、古い記述を根拠にしない（§1.4）。

「確認済み」= このセッションで GitHub / git から実際に読んだもの。「推定」= 読んだ事実からの推論。「未確認」= 見ていないもの。

---

## 1. 最新状態（確認済み）

| 対象 | 状態 |
|---|---|
| main | `3c3c2da`。Q0 #539 / A #541 / F docs #543 / F1 #547 が反映済み |
| #545 B1（ロジック） | open・clean・非 Draft。head `4a539e8`。**base は旧 `74c8297`**（main は F1 で進んでいる）。**マージ未承認（Owner 判断 1）** |
| #546 B2（SquareDoughLayer） | open。head `45f800d`。**base = B1 のブランチ（積み PR）**。**[改訂2]** CI 再確認: `webkit-360x800 shard 3/3` が failure（§1.2）、`webkit-390x844 shard 1/3` も failure（原因未確認）、`webkit-390x844 shard 2/3` は実行中。**マージ未承認** |
| #548 F2（天板焼き Technique 登録） | open。head `2c8eb05`。`WebKit Gate` と `webkit-390x844 shard 2/3` が failure。**原因の一次情報は §1.2。Final Gate は RED/保留**。マージ未承認 |
| **[改訂2]** #549 D1-a（四角ソース指標・ドロップ判定の純ロジック） | **新規 open**（改訂 1 の後に作成）。head `db2fe8c`、base = main `3c3c2da`。本番不活性・見た目変更なし。`mergeable_state: unstable`（CI 実行中）。B1/B2/F2/#518 のファイルに触れないと本文に記載（本セッションで差分は未検証） |
| #540 E 先行実装（丸い版） | Draft・HOLD。base は旧 `80e6d10`。マージ・クローズ禁止 |
| #536 C / #537 D / F3・F4 | **PR なし（未着手）** |
| #518（焼成 filter 分離） | open・PR なし。D2 の前提条件が未解消 |
| #474 | open（Fresh Audit のみ）。実装 PR なし |
| #521 E | open。Design Lock §8 の 8 項目は未回答のまま |

### 1.2 [改訂2] WebKit 失敗の一次情報（ジョブログから確認。artifact は取得不可）

artifact のダウンロード URL（Azure Blob）はこの環境のネットワークポリシーで 403 となり、**artifact の中身（HTML レポート・trace）は未確認**。以下はジョブログ本体から読んだ事実のみ。

**#548（run 39106776222、webkit-390x844 shard 2/3、2 回とも失敗）**
- 失敗テスト: `e2e/discovery3-oracle-neutralization.spec.ts:118`「exact + thin sauce and other + thin sauce are indistinguishable」、失敗行 `:154`（`expect(exact2.html).toBe(other2.html)`）。attempt 1 の `✘` 行（07:31）と attempt 2 の失敗詳細（07:41）が**同じテスト**。残りは 153 passed / 1 failed。
- ログに表示された差分の範囲では、期待値と受信値の違いは `result-panel__bake-badge--near` と `--just`（焼き加減バッジのクラス）。ただしログの表示は途中で切れており、**それ以外の差分がないことは確認できていない**。
- これは Anti-Oracle の DOM 同一性検査（識別情報が漏れていないか）であり、引き継ぎコメントは「負荷依存の既知 flake」と記録しているが、**今回は再実行でも同じ箇所が落ちており、flake と断定する根拠はない**。#548 は Dex/Technique のみの変更で RESULT の焼き加減表示は触っていないはずだが、それも推定であり検証していない。
- **Final Gate: RED/保留**。解除条件: (a) HTML レポートの全 DOM 差分を確認（Owner または artifact を取得できる環境）、(b) 同じテストを F2 を含まない main の同一 SHA で同条件に流し、差が F2 に起因しないことを示す、(c) 差分が焼き加減バッジのみであることを確認。その後も閾値・retry・timeout・skip・assertion の変更は行わない。

**#546（run 39108222937）**
- `webkit-360x800 shard 3/3` failure（2 件）: `e2e/sauce-oil-over-519.spec.ts:114` は `Target page, context or browser has been closed`（31.0s）、`:142` は `RESULT: overlap keeps red … Expected: > 42 / Received: 40`（ピクセル値の閾値）。113 passed / 2 failed。B2 の変更（SquareDoughLayer）とは別領域のテストだが、**B2 起因でないことは未検証**。引き継ぎコメントには同テスト `:142` が #547 でも 1 回落ちて再実行で通った記録がある。これも既知 flake と断定せず、再実行結果と main 同 SHA での比較で判断する。
- `webkit-390x844 shard 1/3` failure: **原因未確認**（ログ未取得）。`webkit-390x844 shard 2/3`: 実行中。
- B2 自身の E2E（`square-dough-b.spec.ts`）が WebKit で落ちたかどうかは、上記ログからは確認できていない（G-2 の `pointerId` 固定問題の判定は保留）。

### 1.3 [改訂2] #518 の依存の再確認（D2 着手前）
- #518 は **open・PR なし**（`search_pull_requests` で関連 PR は #517（closed）のみ）。
- main の `src/App.css` では `.pizza-dough--raw/--perfect/--burnt` の `filter` が依然 `.pizza-dough` 要素そのものに付いている（337/346/354 行）。`src/state/finishD2Inert.test.ts` も main に存在し、#518 の完了までは外さない運用。
- したがって D2 は、**(i) 焼成 filter ブロック・後乗せ piece の領域に触れない**、または **(ii) #518 の着地を待つ** のどちらかを PR 本文に明記して着手する。四角の `pizza-dough--square-pan` は B2 が追加済みで filter ブロックには触れていない。D2 の PR で四角の焼成色が `.pizza-dough` の filter 経由になることの扱い（そのまま利用か分離か）を事前に Owner 確認する。

### 1.4 [改訂2] #521 — Owner 決定済み / 未確定の区別

出典は #521 の引き継ぎコメント（2026-10-18）と各 Issue。**古い記述（#540 本文の旧依存表、「§8-3/§8-4 は受理扱い」）は根拠にしない**。

| 区分 | 項目 |
|---|---|
| **決定済み** | 四角天板 Technique として実装・`pan` 軸を identity に含める／丸い grandma の先行公開禁止／#540 は Draft HOLD／Technique id `tray` ↔ pan 値 `"tray"`・表示名「天板焼き」／Dex 文言（なぞかけ・発見後）／発見条件（解放済み + 正式 `pan:"tray"` 調理完了、レシピ発見は不要、Preview クエリのみは発見でない）／Research 候補フィルターは追加しない／marinara「文字なし→A」許容／G2 固定文言／OD-TQ-5/6 の例外は一般説明に限る／**RESULT 中立文言**（2026-10-18、Owner 判断 6）／**C: 85% 初期採用、「次へ」まで再編集可**（2026-10-18、Owner 判断 3・4）／affordance step は暫定 14（E で再導出） |
| **未確定** | Design Lock §8 の 8 項目（pizzadb.jp 確認＝オイル位置・天板形状、`ladderCredit:false`、Hint 5.0 SAUCE 段が両ソースを示すこと、TQ-3 より先の 2 ソース出荷、S1 オイル重ね、id/名称 `grandma-pizza`、スフィンチョーネ保留、異種 2 ソース候補）／grandma の bake 窓・個数／四角 Reference の設計／marinara A/B 表示変更の適用時期／**均一度の最終閾値（実機 HV）** |
| **未確認事実** | pizzadb.jp の原典（環境から 403）。暫定構成（tomato 1・olive-oil 1・mozzarella 3・garlic 2、bake 56–76）は Owner の原典確認まで確定しない |

### 同期していない記述（修正はしていない・Owner/担当者の確認用）
- #521 の引き継ぎコメントは B2 の E2E を「9 件」、#546 本文は「8 テスト」。差分を読むと **8 件**。
- #538 本文は RESULT の中立一文を「最終文言は Owner 承認が必要」とするが、**[改訂2] 2026-10-18 の Owner 判断 6 で「材料だけでなく、生地の形や調理法も見直してみよう。」に確定**。#538 本文の記述は古い（Issue 本文は未編集）。

---

## 2. B2・C・D・F・E の依存関係とテスト対象

### 2.1 依存グラフ（Issue の記載 + 実コード上の依存）

```
A(main) ──┬─ B1 #545 ── B2 #546 ── C #536 ──┬─ D1(ロジック) ─┐
          │                                  │                ├─ D2(描画) ─┐
          │                                  └─ F3/F4 ────────┘            ├─ E #521
          └─ F1(main) ── F2 #548 ── F3 ── F4 ──────────────────────────────┘
                                           Design Lock §8 の Owner 回答 ───┘
```

| 工程 | 依存（Issue 記載） | 実コード上の追加依存（推定） | テスト対象 |
|---|---|---|---|
| **B2** #546 | B1 | B1 の `COMMIT_SQUARE_DOUGH` / `pressGesture` | 押し広げ操作・キャンセル系（既存 E2E 8 件） |
| **C** #536 | B | B2 の `SquareDoughLayer` にドラッグ追加。`CORNER_REACH_THRESHOLD=0.85`（A、**初期基準として採用済み**）を使う。**[改訂2] 実装開始は B2 受け入れ後。設計・テスト準備は先行可。完成後も「次へ」まで再編集可** | 四隅到達・完成判定・「次へ」ゲート・再編集・タップ/長押しとドラッグの競合 |
| **D1** #537 | A, C | 形状 interface（A）のみで実装可能だが、通し E2E は C が必要。**[改訂2] C と並行して独立部分の実装を許可（Owner 判断 5）。#549 = D1-a（純ロジック）が open。D1-b（reducer 配線）は B1 後** | ソース境界・Reference・ドロップ範囲・CUT 無効 |
| **D2** #537 | A, C, **#518 着地後 or 焼成 filter に触れない** | PizzaStage / App.css の円クリップ | 描画（ソース・チーズ・焼成・RESULT・サムネ） |
| **F2** #548 | A, F1 | なし（B と独立） | Technique 登録・検出・Dex 文言・Anti-Oracle allowlist |
| **F3** | F2 | RESULT 技法段・中立一文（**[改訂2] 文言確定: 「材料だけでなく、生地の形や調理法も見直してみよう。」**）。C と並行して独立部分を実装可（Owner 判断 5） | 未特定 3 区分の DOM 同一性 |
| **F4** | F2, **B2/C** | ○/□ 切替は DOUGH ステップ。四角ラウンドの開始条件に触れる（下記 2.2）。**[改訂2] `PizzaState.pan="tray"` の設定と Technique 解放条件との接続は必須受け入れ条件（§2.3）** | 切替の有無・状態保持・「次へ」後固定・44px・pan 設定・解放接続 |
| **E** #521 | D, F の完了 + A–C + §8 | #540 の再利用/再設計/破棄区分（#521 引き継ぎコメント §4） | 下記 §4 Final Gate |

### 2.2 統合上の継ぎ目（コードで確認した事実）— 最重要

**S-1: 四角ラウンドの判定が「レシピ/Preview」で、プレイヤーの ○/□ 切替ではない。**
- B2 の `GameScreen`: `squareDoughRound = activePanShape(state.recipe) === "square"`。
- B1 の reducer: `COMMIT_SQUARE_DOUGH` は `activePanShape(state.recipe) !== "square"` なら no-op。
- `activePanShape` は「Preview/DEV の `?pan=square`」または「`recipe.panShape`」しか見ない（`src/preview/panShapePreview.ts`）。
- 一方 F の発見条件は `PizzaState.pan === "tray"`（F1/F2、`squareDough` から推定しない）で、`pan` を設定する処理は **main にも #545/#546/#548 にも存在しない**（`grep` で確認。F1 は型とシグネチャ読み取りのみ）。
- Free Cooking / Research（レシピ未確定）では、F4 の ○/□ 切替が「四角ラウンド」と `pan:"tray"` を同時に決める必要がある。現状の B2 のゲートのままでは切替で四角に入れない。
- **担当提案**: F4 の PR で `activePanShape` の入力を「レシピ or 切替状態」に拡張し、同じ箇所で `pizza.pan` を設定する（B2/C 側のロジックを複製しない）。C の PR では判定を 1 関数経由に保つことを受け入れ条件に追加すると F4 が安全になる。

**[改訂2] S-1 の扱い（Owner 重要指示）**: F4 の**必須受け入れ条件**とする。C の PR は四角ラウンド判定を 1 関数経由に保つ（F4 が差し替えられる形）。

**S-2: `PAN_TRAY_RECIPE_IDS` が 2 ファイルに別定義。**
- `deductionProduction.gate.test.ts`（名前付き const）と `hint5Production.gate.test.ts`（テスト本体内の inline const）。どちらも現在 `[]`。E が `grandma-pizza` を足すとき、片方だけ更新して他方が古いまま通る/落ちるリスク。
- **提案**: E の PR（または F3 のついで）で共通の testSupport 定数に集約。E の Result に両ゲートの再実行結果と走査状態数を記載（#538 audit §7 の共通条件 (b)(c)）。

**S-3: #540 は F1 より前の base。**
- F1 で Sauce B1 single-source golden の signature 550 件が更新済み。#540 のゴールデン/件数固定テストは**そのまま移植しない**（新しい main から作り直す。#521 引き継ぎコメント §4 と一致）。

**S-4: E で INV-TQ-4 の表明が反転する。**
- F2 は「tray の affordance は `null` iff allowlist が空」と固定。E で allowlist が非空になると `techniqueAffordanceStep("tray")` が導出値（暫定 14）になる。F2 のテストはこの反転を想定した書き方（allowlist 長で分岐）だが、**E の PR で実値の再導出と記録が必須**。

### 2.3 [改訂2] F4 必須受け入れ条件（`pan="tray"` と解放条件の接続）
1. ○/□ の □ 選択（または四角ラウンドの確定）で `PizzaState.pan = "tray"` が設定される。設定箇所は 1 か所。`squareDough` から推定しない（F1 の契約）。
2. 四角ラウンドの判定（`squareDoughRound` と reducer の `COMMIT_SQUARE_DOUGH` ガード）が、レシピ/Preview に加えて切替状態を見る。丸い側の判定は byte-identical。
3. 切替は Technique の affordance が開くまで DOM に存在しない。affordance 後でも Recipe Select（guided）・Lunch Rush・Dinner では出ない（`techniqueRoundEligibility`）。
4. 解放済み + Free Cooking/Research + Completion Gate PASS + `pan="tray"` で Technique「天板焼き」が発見される（usage path）。Preview の `?pan=square` だけでは `pan` が立たず、発見にならない。
5. 「次へ」で形状と `pan` を確定。確定前は切替・再編集可で、両方の生地状態を保持する（O-7）。
6. 通しテスト（切替 → 四角 DOUGH → … → RESULT → 技法段 → Dex）を 4 プロジェクトで通す。

---

## 3. HV チェックリスト（iPhone Safari 想定）

方針: `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` に従う。390×844 動画は Owner に直接提出（repo に入れない）、スクリーンショットは `docs/reports/screenshots/<task>/` にコミット。以下は **Owner 実機（iPhone Safari）用の確認項目**で、自動化できない理由を併記する。

### 3.0 自動化の限界（確認済み）
`playwright.config.ts` の 4 プロジェクトは `Desktop Chrome` / `Desktop Safari` + viewport 指定で、**`hasTouch` / `isMobile` なし（マウス駆動）**。したがって次は自動テストで担保できず、HV 必須:
実際のマルチタッチ、iOS の画面端スワイプ（戻る・ホーム）との競合、長押し時の iOS コールアウト/拡大鏡、画面ロック・アプリ切替からの復帰、`touch-action` の実機挙動。

### 3.1 共通（390×844 / 360×800 の両方）

| # | 項目 | 合格基準 | 対応工程 |
|---|---|---|---|
| V-1 | 画面内に収まる | 天板・ステップバー・「次へ」・状態表示が 1 画面。縦横スクロールなし | B2〜 |
| V-2 | 天板の外周が画面端にかからない | 左右の端 20px 程度で iOS 戻るスワイプに干渉しない（#536 検証条件） | C |
| V-3 | タップ | 着地の瞬間に局所の押し込み。待ちなし | B2 |
| V-4 | 長押し | 約 0.2 秒後から広がり、進行表示が**指に隠れない** | B2 |
| V-5 | 長押し中に動かす | 10px 超で広がりが止まり、塗り広げにならない（暫定 slop） | B2 |
| V-6 | ドラッグ（外形） | 四隅へ伸ばせる。タップ/長押しと意味が混ざらない | C |
| V-7 | 四隅の到達表示 | 4 隅それぞれ未到達/到達が文字なしで分かる | C |
| V-8 | 厚みの均一さ表示 | どこが薄い/厚いか視覚で分かる | C |
| V-9 | 操作補助 / 85% | 隅の近くで軽く吸い付く。**精密な位置合わせを要求しない**（指先サイズで当たる）。**[改訂2] 四隅 85% 到達は初期基準として採用済み**。Owner は体感が厳しすぎ/甘すぎでないかを確認 | C |
| V-10 | 完成 → 「次へ」 | 条件を満たす前は無効、満たすと有効。アニメ待ちなし。**[改訂2] 完成後も「次へ」を押すまで再編集（押し広げ・ドラッグ）でき、再編集で未完成に戻れば「次へ」は再び無効になる。UI は常に現在の状態と一致** | C |
| V-11 | 均一度の最終閾値 | 均一度の閾値が体感に合うか（**[改訂2] 最終値は実機 HV で Owner が決定**。値は定数 1 か所） | C |
| V-12 | ソース/具材/チーズが四隅まで届く | 隅が丸く欠けない。天板外にはみ出さない（実画面ピクセル） | D2 |
| V-13 | 焼成色・焦げ | 四角で破綻しない（#518/#517 の filter ブロックは未変更） | D2 |
| V-14 | RESULT | 四角いピザと天板が潰れず、縮尺 0.75 でも四角比が保たれる | D2 |
| V-15 | サムネ | Recipe Select / Dex / RESULT / Reference で四角が自然 | D2 |
| V-16 | CUT | 四角では CUT UI が出ない | D1 |
| V-17 | ○/□ 切替 | affordance 前は存在しない / 後は 44px 以上 / 360×800 でステップバーに収まる / 切替で生地状態が失われない / 「次へ」後は固定。**[改訂2] □ で調理を完了すると技法段に「天板焼き」が出て、Dex の調理法に反映される（`pan="tray"` 接続）。○ のままでは出ない** | F4 |
| V-19 | **[改訂2]** 形状確定 | 「次へ」で形状が確定し、以降 SAUCE 以降から DOUGH に戻って変形できない。確定前に ○/□ を往復しても両方の生地が残る | C / F4 |
| V-20 | **[改訂2]** RESULT 中立文言 | 天板で調理して「特定されなかった」ピザ（3 区分）に同一の一文「材料だけでなく、生地の形や調理法も見直してみよう。」。特定成功・完成失敗・丸いピザには出ない | F3 |
| V-18 | 丸い側の無変化 | 既存の丸いピザの生地伸ばし〜RESULT が従来どおり（体感・見た目） | 全 PR |

### 3.2 中断・異常系（実機のみ）

| # | 操作 | 期待 |
|---|---|---|
| X-1 | 押している最中にコントロールセンター/通知を引き下げる | ジェスチャー全体を破棄（確定されない）。次のタップが効く |
| X-2 | 押している最中にホームへ戻る/アプリ切替し、戻る | 破棄済み。生地は押す前の状態 |
| X-3 | 画面ロック → 解除（長押し中/ドラッグ中） | 同上。固まらない |
| X-4 | 2 本指を同時に置く / 1 本目の上に 2 本目 | 1 本目のみ有効、2 本目は無視。指を離した後は通常に戻る |
| X-5 | 2 本指でピンチ/二本指スクロール | ページが拡大/スクロールしない（`touch-action:none` の実機確認） |
| X-6 | 天板の外周から内側へドラッグ開始 / 外側へ抜けて離す | はみ出し・NaN・固着なし。離した位置が天板外でも確定しない/する仕様が一貫 |
| X-7 | 長押しで iOS のコールアウト/テキスト選択/拡大鏡が出ない | 出ない |
| X-8 | 連打（高速タップ 10 回） | 取りこぼしと二重確定がない。待ち時間が増えない |
| X-9 | 画面回転（許可している場合）/ アドレスバー出入り | レイアウト崩れ・誤確定なし |
| X-10 | 低電力モード・古い端末（あれば） | 操作が間引かれず、長押し時間の体感が変わらない |

### 3.3 提出物（工程ごと）
動画 390×844（操作→確認の通し）+ before/after スクリーンショット（390×844、360×800）。B2: `docs/reports/screenshots/square-dough-b2/`（PR #546 に既存）。C: `square-dough-c/`、D2: `square-dough-d2/`、F4: `square-dough-f/`、E: `square-dough-e/`。専用 Preview は Owner の許可後にのみ用意（共有 Preview は上書きしない）。

---

## 4. 統合 E2E / テストマトリクス

凡例: ✅ main に既存 ／ 🟡 open PR に存在 ／ ⬜ 未実装（担当 PR を記載）。E2E は 4 プロジェクト（Chromium 390×844・360×800、WebKit 390×844・360×800）を標準とする。

### 4.1 丸いピザの回帰（byte-identical）

| テスト | 状態 | 備考 |
|---|---|---|
| 丸の `PanGeometry` が既存関数と同一参照 | ✅ `panGeometry.test.ts` | |
| どのレシピも `panShape` 未設定（Production 不活性） | ✅ `panShape.test.ts` | **E でこの表明を `grandma-pizza` のみ例外に更新**（名前付き allowlist） |
| 丸い PizzaStage マークアップ完全一致 | ✅ `PizzaStage.sauceRender.golden.test.tsx` | B2 で空白 1 つにより一度落ちた。D2・F4 でも維持 |
| 57 レシピの Hint 5.0 梯子 golden | ✅ `hint5.ladders55.json` ほか | E で 58 件に更新（意図的） |
| `?pan=square` 無しで四角レイヤーが無い | 🟡 `square-dough-b.spec.ts`（B2） | |
| 丸い DOUGH → RESULT の通し（4 プロジェクト） | ✅ 既存の `making-ui-1screen` / `viewport-1screen` / `stage-size-stability` 等 | 四角 PR ごとに全体 E2E を回す |
| 丸い RESULT に pan 文言・天板クラスが無い | ⬜ F3 | |
| 採点・Pitz・Reference が四角導入前後で byte-identical（D4） | ⬜ D1（既存 `economy`/`referenceScoring` の golden を流用して固定） | |

### 4.2 旧 save 互換

| テスト | 状態 | 備考 |
|---|---|---|
| `discoveredTechniqueIds`: 旧 save は `[]`、未知 ID は保持、不正値は修復、union 書き込み、将来フィールド保持 | ✅ `persistence.discoveredTechniques.test.ts`（7 件）+ `persistence.test.ts` の保存キー列挙 | F2 は新規テスト追加なし。ID 非依存の既存テストで担保されており妥当。`"tray"` を含む round-trip の明示は任意 |
| 旧 save（`[]`/`["no-sauce"]`）→ 新ビルド | 🟡 F2（TechniqueUi / techniques.tray） | |
| 新 save（`tray` 入り）→ 旧ビルド（未知 ID 保持） | ✅ 「well-formed な未知 ID を保持」テストが代替（旧ビルドそのものは使えない） | |
| 調理中 `PizzaState`（`squareDough`/`pan`）は保存対象外 | 🟡 `persistence.test.ts` に保存キー列挙あり（トップレベル）。`pizza` 配下への非混入は未確認 | C で `squareDough`/`pan` が保存 JSON に現れないことを明示固定 |
| save スキーマ変更なし | ✅ `save-forward-compat-3-4b.spec.ts` 系 | 各 PR で Result に明記 |

### 4.3 Technique 解放

| テスト | 状態 | 備考 |
|---|---|---|
| 登録・検出・導出 affordance・ledger | 🟡 F2 `techniques.tray.test.ts` | 合成 tray レシピ使用 |
| 本番で開かない（INV-TQ-4） | 🟡 F2 | E で反転（S-4） |
| affordance 前に ○/□ 切替が DOM に無い | ⬜ F4（E2E + RTL） | |
| affordance 後・未発見で「？？？」+ なぞかけのみ | 🟡 F2（Dex RTL） | E2E は ⬜ F3/F4 |
| 初回 □ 完成で RESULT 技法段に名称 + 説明 | ⬜ F3 | usage path / INV-TQ-6 |
| **[改訂2]** □ 選択 → `pizza.pan="tray"` → 解放条件を満たして発見（S-1 の通し） | ⬜ **F4（必須）** | §2.3 |
| Lunch Rush / Dinner / guided で切替非表示 | ⬜ F4（`techniqueRoundEligibility`） | |
| affordance が導出（materialStep 差し替えで動く） | 🟡 F2 | |
| 実レシピ（grandma）での解放 step 再導出 | ⬜ E | 暫定 14 |

### 4.4 pan identity

| テスト | 状態 |
|---|---|
| pan 軸 OBSERVED / shape 軸 UNAVAILABLE / matcher 不変 | ✅ `panAxis.test.ts`（F1） |
| `pan` は `squareDough` から推定されない | ✅ `panAxis.test.ts` |
| 丸 + grandma 材料 = ORIGINAL、四角 + 同材料 = UNIQUE_MATCH、他レシピ材料を四角 = ORIGINAL（O-2） | ✅ 一部（`panAxis.test.ts`）／⬜ 実レシピでの確認は E |
| pan 同一の 2 target が曖昧にならない | ✅ `panAxis.test.ts` |
| **継ぎ目 S-1: ○/□ 切替 → `pizza.pan="tray"` → 発見** の通し | ⬜ **F4**（最優先の統合テスト） |
| 四角ラウンドで `COMMIT_SQUARE_DOUGH` と `pan` が矛盾しない | ⬜ C + F4 |

### 4.5 Research

| テスト | 状態 |
|---|---|
| R1 登録可否が technique 非依存 | ⬜ F3（audit §9） |
| R2 登録可 ⇒ affordance 開（導出） | ⬜ F3 |
| R3 □ で発見 → 技法段 → Dex | ⬜ F3/E |
| R4 ○× / Notebook / Board / Hint sheet の ○ と □ の byte-identical | ⬜ F3 |
| R5 他レシピ材料を □ → ORIGINAL | ⬜ F3 |
| R6 cohort letter（marinara A / grandma B）は導出 + id 固定 | ⬜ E |
| R9 HOME / Pizza Select / Hint sheet の 1 → 2 件ルーティング | ⬜ E（`App.homeDiscovery` 等を明示更新） |
| R10 Research/pool が `techniques/*` を import しない | ⬜ F3（既存 `techniques.architecture.test.ts` の隣） |
| R11 G2 固定文言と時間差 parity sweep | ⬜ F3 |
| R12 2 ソースで DOM 同一 | ⬜ E（#540 の `multiSauce.guards` 流用） |
| 既存 Research E2E（rows / result / target / stable-identity 等） | ✅ main。各 PR で回帰 |

### 4.6 Hint

| テスト | 状態 |
|---|---|
| Hint 5.0 / deduction に technique 語が出ない（privacy sweep） | 🟡 F2 が `descriptionJa` を含めて更新 |
| Hint が Technique 状態を読まない（import/ledger 禁止） | ✅ 既存 + F2 |
| tray レシピの Hint 5.0 梯子に technique 語なし | ⬜ E（F2 が明示的に E へ繰越） |
| `buildHintLine` が全ソースを確認 | ✅ S2 #525 |
| `GATE_STATES` に pan（○/□）状態を追加して再実行・状態数記録 | ⬜ E |

### 4.7 Anti-Oracle

| テスト | 状態 |
|---|---|
| G7 / INV-TQ-4 / `deductionProduction.gate` の allowlist 化 | 🟡 F2（空 allowlist）／⬜ E（grandma 追加） |
| tray の文言は `src/data/techniques.ts` のみ | 🟡 F2 |
| 要求レシピ 0 件の間、Dex・RESULT・設定・Changelog に天板語/四角サムネ/pan CSS が到達しない sweep | ⬜ F3（AC-9）。**D2 のサムネ/CSS 追加後にも再実行** |
| RESULT 中立一文（**[改訂2] 文言確定: 「材料だけでなく、生地の形や調理法も見直してみよう。」**）: `ORIGINAL`/`AMBIGUOUS`/`INCOMPLETE_MATCH` で DOM 完全同一、MATCHED と完成失敗では非表示、丸では非表示 | ⬜ F3（AC-2/3/5/6） |
| 「別形状なら一致する材料集合」と「どれにも一致しない材料集合」で RESULT DOM 同一 | ⬜ F3 |
| 焼き加減バッジ以外の DOM 差が出ない（`discovery3-oracle-neutralization`） | ✅ 既存。**WebKit で間欠失敗中（B-1）** |
| 発見前の画面に四角天板が出ない（D 受け入れ条件） | ⬜ D2 |

### 4.8 操作（B2 / C）— 自動テスト範囲

| テスト | 状態 |
|---|---|
| タップ/長押し/slop/pointercancel/blur/2 本目/capture 無し | 🟡 B2 E2E 8 件 |
| ユニット: `pressGesture`・`squareDoughSpread`・reducer | 🟡 B1 |
| 四隅到達 → 完成 → 次へ（4 プロジェクト） | ⬜ C |
| 隅を一度に超える/辺沿い往復で NaN・はみ出しなし | ⬜ C |
| タップ/長押しとドラッグが別の意味（混線しない） | ⬜ C |
| 完成後も「次へ」まで再編集可、再編集で未完成に戻れば「次へ」再無効、「次へ」で確定し以後変更不可（**[改訂2] Owner 判断 4 で仕様確定**） | ⬜ C |
| 通し: DOUGH → SAUCE → CHEESE → TOPPING → BAKE → RESULT（四角） | ⬜ D2 |
| 通し + Free Cooking の ○/□ → 発見 → Dex | ⬜ F4/E |

---

## 5. テスト実装の担当 PR と、各 PR の検証

| PR | 追加するテスト | 実施する検証 | HV |
|---|---|---|---|
| **#545 B1** | （既存）logic/reducer/Preview ゲート | 11/11 CI 済み（引き継ぎコメント）。base 付け替え後に再実行 | 不要 |
| **#546 B2** | （既存）E2E 8 件 | WebKit 4 shard 確認。下記ギャップ G-1〜G-3 | 必須（Owner に動画渡し済み） |
| **#548 F2** | （既存）techniques.tray + Dex RTL + gate 更新 | **WebKit Gate failure の原因確認が先（B-1）**。Anti-Oracle DOM 差分が「焼き加減バッジのみ」か | 不要（本番で不活性） |
| **C #536**（**B2 受け入れ後に実装開始**。設計・テスト準備は先行可） | 四隅到達/完成/次へ E2E、**完成後の再編集と「次へ」の再無効化**、NaN・はみ出し、85%・均一度閾値は各 1 か所の定数、save 非保持、判定関数経由（S-1） | tsc / lint / build / Vitest 全体 / 4 プロジェクト / Codex | **必須**（V-6〜V-11, X-4〜X-8） |
| **D1 #537**（#549 = D1-a。C と並行可。実装範囲を #537 に記録） | 形状 interface 経由のソース境界/ドロップ/Reference/CUT 無効、採点 byte-identical | Vitest 全体 + 採点 golden | 不要 |
| **D2 #537**（着手前に #518 を再確認: §1.3） | 四角通し E2E（実画面ピクセル、CSS filter 後）、サムネ、RESULT 0.75、**発見前非表示 sweep** | 4 プロジェクト + 丸い 57 の golden + #519 の教訓 | **必須**（V-12〜V-16） |
| **F3**（C と並行可。実装範囲を #538 に記録） | R1/R2/R4/R5/R10/R11、AC-2/3/5/6/8/9、技法段、確定文言の定数 1 か所 | privacy sweep 全再実行、状態数を Result に記録 | 必須（RESULT 表示）。文言は Owner 確認 |
| **F4** | 切替の有無/状態保持/「次へ」後固定/44px/360 で横スクロールなし、**§2.3 の必須受け入れ条件（`pan="tray"` 設定と解放接続）の通し** | 4 プロジェクト | **必須**（V-17） |
| **E #521** | allowlist 追加（S-2 集約）、`GATE_STATES` に pan、実 affordance 再導出、58 件更新、cohort letter、ルーティング 1→2、Hint 梯子の technique 語なし、通常フロー E2E（四角） | DH4 gate 全体 + sweep 再実行、正式 Codex、WebKit | **必須**（Square 版 HV 全項目 §3） |

### E の Final Gate（一覧）
1. §8 の Owner 回答（特に 1: pizzadb.jp 確認 — 環境から 403 のため Owner 側）。
2. A〜D・F（F3/F4 含む）が main にある。
3. `PAN_TRAY_RECIPE_IDS` に `grandma-pizza`（共通定数）／ G7・INV-TQ-4・`deductionProduction.gate` を allowlist で双方向一致。
4. `GATE_STATES` に pan（○/□）状態を追加した DH4 sweep を再実行し、状態数を Result に記載。
5. affordance step を ladder から再導出（暫定 14）。新しい ladder step は追加しない。
6. 丸い 57 レシピの発見・採点・描画が byte-identical。58 件目のみ追加。
7. `ladderCredit:false` / `lunchRush:false` / CUT なし。
8. 4 プロジェクト E2E + Codex + Owner 実機 HV（動画は repo 外）。

---

## 6. 現行テストの重複と不足

### 6.1 重複（意図的か要整理）
| 箇所 | 評価 |
|---|---|
| pan:null / "tray" の ORIGINAL 同一性が `panAxis.test.ts`（F1）と `techniques.tray.test.ts`（F2）の双方 | 層が異なる（識別軸 vs Technique 検出）。**維持でよいが、E のレシピ実体テストは新規に増やさず既存 fixture を再利用** |
| `shape` 軸 UNAVAILABLE が `panAxis.test.ts` と `signature.test.ts` | 維持（契約の二重ロックとして妥当） |
| technique 語 sweep の `techWords` が `hint5Production.gate` と `deductionProduction.gate` に同形 | 別モジュールの契約なので維持。ただし **allowlist 定数の重複は解消すべき（S-2）** |
| 「Production は panShape 不活性」が `panShape.test.ts` のみ | E で更新する場所が 1 か所で済む（良い） |

### 6.2 不足（ギャップ）
| ID | 内容 | 根拠 | 担当 |
|---|---|---|---|
| **G-1** | B2 E2E「hidden tab / blur」は `blur` のみ発火。**`visibilitychange`(hidden) の破棄が E2E で未検証**（コードには実装あり）。step 変更 / `interactive=false` による破棄も未検証 | `square-dough-b.spec.ts` の該当テスト | B2 追補 or C |
| **G-2** | B2 の `pointercancel` テストが `pointerId: 1` を固定。WebKit のマウス pointerId が 1 でない場合、破棄されず**偽陰性/失敗**になりうる | 同ファイル | #546 の WebKit 結果で確認 |
| **G-3** | 実タッチなし（§3.0）。2 本指の同時開始・1 本目を離した後の 2 本目・実マルチタッチは未検証。`page.touchscreen` は単指のみ | `playwright.config.ts` | HV（X-4/X-5）。Chromium 限定で CDP `Input.dispatchTouchEvent` による補助は任意 |
| **G-4** | 四角ラウンドの通し E2E なし（C/D 待ち） | — | D2 |
| **G-6** | `pizza.squareDough`/`pizza.pan` が保存 JSON に現れないことの明示テストが未確認（トップレベルのキー列挙は既存） | `persistence.test.ts` | C |
| **G-7** | S-1（切替→`pan`→発見）の通しなし | — | F4 |
| **G-8**（解消） | 完成後の再編集可否は **Owner 判断 4 で確定**（「次へ」まで再編集可）。C のテストに入れる | Owner 判断 | C |

---

## 7. マージ順序と競合ファイル

### 7.1 競合調査（実測）
`git merge-tree` で `origin/main` との 3-way マージと、組み合わせを試算した。**いずれも衝突なし（クリーン）**:
B1×main、B2×main、F2×main、#540×main、B2×F2、B2×#540、F2×#540。

ただし #540 は base が古く、`src/state/__golden__` などの**生成物は構文上クリーンでも意味的に古い**（S-3）。マージ可否の根拠にしない。

### 7.2 今後のホットファイル（推定: 変更予定の PR から）
| ファイル | 触る PR | リスク / 対策 |
|---|---|---|
| `src/App.css` | B2（末尾）、F2（2599 行付近）、C・D2・F3・F4・E | **末尾追記が重なる**。各 PR は新クラスのブロックのみ追加し、先行 PR マージ後に rebase。焼成 filter ブロックには触れない（#517/#518） |
| `src/components/PizzaStage.tsx` | B2（追加のみ）、D2（大）、F4 | D2 は #518 と #474 の領域に注意。マークアップ空白まで丸と同一（golden） |
| `src/screens/GameScreen.tsx` | B2、C、F4、E | `squareDoughRound` 判定の一本化（S-1）。F4 が最後に触る想定 |
| `src/state/gameReducer.ts` / `pizzaState.ts` | B1、C、F4 | `pan` 設定箇所は 1 か所に |
| `src/data/techniques.ts` / `logic/techniques/*` | F2、（F3/E で追加なし） | F2 を先にマージ |
| `deductionProduction.gate` / `hint5Production.gate` | F2、E | S-2 集約 |
| `src/data/recipes.ts` / `discoveryCatalog.ts` / `hints.ts` / goldens | E のみ | 最後。F1 後の main から作り直す |
| `docs/PROJECT_HANDOFF.md` | #540、各 PR の Result | 競合しやすい。docs の更新は最小に、E の直前にまとめる |

**[改訂2] 並行実装の衝突回避（Owner 判断 5）**: D1・F3 は C と並行できるが、次を守り、各 Issue（#537・#538）に**実装範囲（触るファイル）**を実装前に記録する。
- D1/F3 は `GameScreen.tsx`・`PizzaStage.tsx`・`SquareDoughLayer.tsx`・`App.css` を触らない（C が使う想定）。D1 は `src/logic/pan/*` と純ロジックの新規ファイル、F3 は RESULT/Research/テスト側。
- `gameReducer.ts` / `pizzaState.ts` は B1 のマージ後に D1-b として行う。
- 各 PR は単独で green。丸い側の挙動・採点・描画を変えない。

### 7.3 最短マージ順序（提案・**[改訂2] 現時点でどの PR のマージも未承認**。各 PR の Final Gate 後に Owner が個別判断）

0. **[改訂2] マージ承認はまだない**。以下は「承認された場合の順序」。#548 は Final Gate RED/保留（§1.2）。
1. **#545 B1** → base を main に更新（衝突なしを確認済み）→ マージ。
2. **#546 B2** → base を main に付け替え → WebKit 結果確認 → マージ。
3. **#548 F2** — B と独立。WebKit failure（B-1）の解消後、1 と並行して可。
4. **C #536**（クリティカルパス）。**B2 受け入れ後に実装開始**（設計・テスト準備は先行可）。85% は採用済み、均一度の最終閾値は実機 HV。再編集仕様は確定済み。
5. **D1 ∥ F3 ∥ F4** — D1（#549 = D1-a）と F3 は **Owner 判断 5 により C と並行可**。F4 は C の判定一本化後。F3 の文言は確定済み。
6. **D2**（#518 の扱いが決まってから）。
7. **E** — §8 回答 + Final Gate。

最短化のポイント（**[改訂2]**）: ① B2 の Final Gate（B-2）と #548 の原因確認（B-1）を先に片付ける ② C は B2 受け入れ後に即着手できるよう設計・テストを先行 ③ D1（#549）・F3 を C と並行（実装範囲を #537/#538 に記録） ④ S-1（F4 必須条件）を C の判定一本化に反映 ⑤ §8 回答を E 着手前に取り付ける。

---

## 8. 残るブロッカー（改訂 2）

| ID | ブロッカー | 状態 | 必要な対応 |
|---|---|---|---|
| **B-1** | #548: WebKit `discovery3-oracle-neutralization.spec.ts:154` が 2 回連続で失敗（attempt 1・2）。表示範囲の差分は焼き加減バッジ `near`/`just` だが、ログは途中で切れ全差分は未確認。artifact は取得不可（403） | **RED/保留**（flake と断定しない） | §1.2 の解除条件 (a)(b)(c)。F2 を含まない main 同 SHA との比較が必要 |
| **B-2** | #546: WebKit `360x800 shard 3/3` が `sauce-oil-over-519.spec.ts:114/:142` で失敗、`390x844 shard 1/3` も失敗（原因未確認）、`390x844 shard 2/3` 実行中 | **RED/保留**（B2 起因かは未検証） | 失敗ログ/artifact の確認、main 同 SHA との比較。B2 の E2E 自体の WebKit 結果の確認（G-2） |
| **B-3** | C 未着手。**B2 受け入れ後に実装開始**（Owner 判断 2）。均一度の最終閾値は実機 HV（Owner 判断 3） | 解消済み: 85% 採用、再編集仕様。**残り**: B2 受け入れ、均一度閾値の HV | B2 の Final Gate → Owner 受け入れ |
| **B-4** | S-1: ○/□ 切替・四角ラウンド判定・`pan` 設定が未接続 | **F4 の必須受け入れ条件として確定**（§2.3）。実装は F4 | C の PR に「判定 1 関数経由」を記録 |
| **B-5** | Design Lock §8 の 8 項目未回答。pizzadb.jp は環境から 403 | 未解消（E の着手・Final Gate） | Owner 回答 |
| ~~B-6~~ | RESULT 中立文言 | **解消**（Owner 判断 6） | #538 本文の古い記述を F3 の PR/コメントで更新 |
| **B-7** | #518: open・PR なし。main の焼成 filter は `.pizza-dough` に付いたまま（§1.3） | 未解消。D2 着手前に方針（触れない or 着地待ち）を PR 本文に明記 | Owner 確認 |
| B-8 | #545 の base が旧 `74c8297`、#540 の base が旧 `80e6d10` | 管理上の注意（B1 は衝突なし確認済み、#540 は作り直し） | マージ承認時に base 更新 |
| B-9 | **[改訂2]** #549（D1-a）の CI は実行中（`unstable`）。#549 の差分は本セッションで未検証 | 確認待ち | D1 の実装範囲を #537 に記録 |
| 非ブロッカー | #544（Research 2.0 の 53/172 再監査）は分離済み | — | — |
