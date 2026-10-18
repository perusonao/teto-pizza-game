# Square Dough — 統合テスト計画 / iPhone Safari HV 準備（docs-only）

Epic #532 ／ 担当レーン: Square Dough 統合テスト・iPhone Safari HV 準備。
調査日: 2026-10-18。基準: `origin/main` = `3c3c2da`（#547 F1 マージ済み）。
範囲: **docs-only**。`src/**`・`e2e/**`・CSS は変更していない。既存 PR（#540 / #545 / #546 / #548）・他レーンのブランチには触れていない（`git fetch` と `git merge-tree` による読み取りのみ）。共有 Preview は未更新。新規 PR は作成しない（Owner 承認待ち）。

目的: B2・C・D・F・E の各工程が揃った時点で、最短で E（グランマピザ正式実装）の Final Gate を通すための、依存・テスト・HV・マージ順序の整理。

「確認済み」= このセッションで GitHub / git から実際に読んだもの。「推定」= 読んだ事実からの推論。「未確認」= 見ていないもの。

---

## 1. 最新状態（確認済み）

| 対象 | 状態 |
|---|---|
| main | `3c3c2da`。Q0 #539 / A #541 / F docs #543 / F1 #547 が反映済み |
| #545 B1（ロジック） | open・clean・非 Draft。head `4a539e8`。**base は旧 `74c8297`**（main は F1 で進んでいる） |
| #546 B2（SquareDoughLayer） | open・clean。head `45f800d`。**base = B1 のブランチ（積み PR）**。CI: layout 系は success、WebKit 6 shard は確認時点で実行中 |
| #548 F2（天板焼き Technique 登録） | open。head `2c8eb05`。**確認時点で `WebKit Gate` と `webkit-390x844 shard 2/3` が failure**（下記 B-1） |
| #540 E 先行実装（丸い版） | Draft・HOLD。base は旧 `80e6d10`。マージ・クローズ禁止 |
| #536 C / #537 D / F3・F4 | **PR なし（未着手）** |
| #518（焼成 filter 分離） | open・PR なし。D2 の前提条件が未解消 |
| #474 | open（Fresh Audit のみ）。実装 PR なし |
| #521 E | open。Design Lock §8 の 8 項目は未回答のまま |

### 同期していない記述（修正はしていない・Owner/担当者の確認用）
- #521 の引き継ぎコメントは B2 の E2E を「9 件」、#546 本文は「8 テスト」。差分を読むと **8 件**。
- #538 本文は RESULT の中立一文を「最終文言は Owner 承認が必要」とするが、#521 引き継ぎコメントでは「材料だけでなく、生地の形や調理法も見直してみよう。」が決定済みとして記載。F3 着手前に Owner へ最終確認が必要。

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
| **C** #536 | B | B2 の `SquareDoughLayer` にドラッグ追加。`CORNER_REACH_THRESHOLD=0.85`（A）を使う | 四隅到達・完成判定・「次へ」ゲート・タップ/長押しとドラッグの競合 |
| **D1** #537 | A, C | 形状 interface（A）のみで実装可能だが、通し E2E は C が必要 | ソース境界・Reference・ドロップ範囲・CUT 無効 |
| **D2** #537 | A, C, **#518 着地後 or 焼成 filter に触れない** | PizzaStage / App.css の円クリップ | 描画（ソース・チーズ・焼成・RESULT・サムネ） |
| **F2** #548 | A, F1 | なし（B と独立） | Technique 登録・検出・Dex 文言・Anti-Oracle allowlist |
| **F3** | F2 | RESULT 技法段・中立一文（文言は Owner 最終確認） | 未特定 3 区分の DOM 同一性 |
| **F4** | F2, **B2/C** | ○/□ 切替は DOUGH ステップ。四角ラウンドの開始条件に触れる（下記 2.2） | 切替の有無・状態保持・「次へ」後固定・44px |
| **E** #521 | D, F の完了 + A–C + §8 | #540 の再利用/再設計/破棄区分（#521 引き継ぎコメント §4） | 下記 §4 Final Gate |

### 2.2 統合上の継ぎ目（コードで確認した事実）— 最重要

**S-1: 四角ラウンドの判定が「レシピ/Preview」で、プレイヤーの ○/□ 切替ではない。**
- B2 の `GameScreen`: `squareDoughRound = activePanShape(state.recipe) === "square"`。
- B1 の reducer: `COMMIT_SQUARE_DOUGH` は `activePanShape(state.recipe) !== "square"` なら no-op。
- `activePanShape` は「Preview/DEV の `?pan=square`」または「`recipe.panShape`」しか見ない（`src/preview/panShapePreview.ts`）。
- 一方 F の発見条件は `PizzaState.pan === "tray"`（F1/F2、`squareDough` から推定しない）で、`pan` を設定する処理は **main にも #545/#546/#548 にも存在しない**（`grep` で確認。F1 は型とシグネチャ読み取りのみ）。
- Free Cooking / Research（レシピ未確定）では、F4 の ○/□ 切替が「四角ラウンド」と `pan:"tray"` を同時に決める必要がある。現状の B2 のゲートのままでは切替で四角に入れない。
- **担当提案**: F4 の PR で `activePanShape` の入力を「レシピ or 切替状態」に拡張し、同じ箇所で `pizza.pan` を設定する（B2/C 側のロジックを複製しない）。C の PR では判定を 1 関数経由に保つことを受け入れ条件に追加すると F4 が安全になる。

**S-2: `PAN_TRAY_RECIPE_IDS` が 2 ファイルに別定義。**
- `deductionProduction.gate.test.ts`（名前付き const）と `hint5Production.gate.test.ts`（テスト本体内の inline const）。どちらも現在 `[]`。E が `grandma-pizza` を足すとき、片方だけ更新して他方が古いまま通る/落ちるリスク。
- **提案**: E の PR（または F3 のついで）で共通の testSupport 定数に集約。E の Result に両ゲートの再実行結果と走査状態数を記載（#538 audit §7 の共通条件 (b)(c)）。

**S-3: #540 は F1 より前の base。**
- F1 で Sauce B1 single-source golden の signature 550 件が更新済み。#540 のゴールデン/件数固定テストは**そのまま移植しない**（新しい main から作り直す。#521 引き継ぎコメント §4 と一致）。

**S-4: E で INV-TQ-4 の表明が反転する。**
- F2 は「tray の affordance は `null` iff allowlist が空」と固定。E で allowlist が非空になると `techniqueAffordanceStep("tray")` が導出値（暫定 14）になる。F2 のテストはこの反転を想定した書き方（allowlist 長で分岐）だが、**E の PR で実値の再導出と記録が必須**。

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
| V-9 | 操作補助 | 隅の近くで軽く吸い付く。**精密な位置合わせを要求しない**（指先サイズで当たる） | C |
| V-10 | 完成 → 「次へ」 | 条件を満たす前は無効、満たすと有効。アニメ待ちなし | C |
| V-11 | 85% 閾値の体感 | 到達が「厳しすぎ/甘すぎ」でないか（**値は Owner が決定**） | C |
| V-12 | ソース/具材/チーズが四隅まで届く | 隅が丸く欠けない。天板外にはみ出さない（実画面ピクセル） | D2 |
| V-13 | 焼成色・焦げ | 四角で破綻しない（#518/#517 の filter ブロックは未変更） | D2 |
| V-14 | RESULT | 四角いピザと天板が潰れず、縮尺 0.75 でも四角比が保たれる | D2 |
| V-15 | サムネ | Recipe Select / Dex / RESULT / Reference で四角が自然 | D2 |
| V-16 | CUT | 四角では CUT UI が出ない | D1 |
| V-17 | ○/□ 切替 | affordance 前は存在しない / 後は 44px 以上 / 360×800 でステップバーに収まる / 切替で生地状態が失われない / 「次へ」後は固定 | F4 |
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
| RESULT 中立一文: `ORIGINAL`/`AMBIGUOUS`/`INCOMPLETE_MATCH` で DOM 完全同一、MATCHED と完成失敗では非表示、丸では非表示 | ⬜ F3（AC-2/3/5/6） |
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
| 完成後の再編集と確定済み UI が矛盾しない（巻き戻し可否は addendum §7-13 の Owner 回答待ち） | ⬜ C（**Owner 回答が必要**） |
| 通し: DOUGH → SAUCE → CHEESE → TOPPING → BAKE → RESULT（四角） | ⬜ D2 |
| 通し + Free Cooking の ○/□ → 発見 → Dex | ⬜ F4/E |

---

## 5. テスト実装の担当 PR と、各 PR の検証

| PR | 追加するテスト | 実施する検証 | HV |
|---|---|---|---|
| **#545 B1** | （既存）logic/reducer/Preview ゲート | 11/11 CI 済み（引き継ぎコメント）。base 付け替え後に再実行 | 不要 |
| **#546 B2** | （既存）E2E 8 件 | WebKit 4 shard 確認。下記ギャップ G-1〜G-3 | 必須（Owner に動画渡し済み） |
| **#548 F2** | （既存）techniques.tray + Dex RTL + gate 更新 | **WebKit Gate failure の原因確認が先（B-1）**。Anti-Oracle DOM 差分が「焼き加減バッジのみ」か | 不要（本番で不活性） |
| **C #536** | 四隅到達/完成/次へ E2E、NaN・はみ出し、閾値 1 か所固定、save 非保持、判定関数経由（S-1） | tsc / lint / build / Vitest 全体 / 4 プロジェクト / Codex | **必須**（V-6〜V-11, X-4〜X-8） |
| **D1 #537** | 形状 interface 経由のソース境界/ドロップ/Reference/CUT 無効、採点 byte-identical | Vitest 全体 + 採点 golden | 不要 |
| **D2 #537** | 四角通し E2E（実画面ピクセル、CSS filter 後）、サムネ、RESULT 0.75、**発見前非表示 sweep** | 4 プロジェクト + 丸い 57 の golden + #519 の教訓 | **必須**（V-12〜V-16） |
| **F3** | R1/R2/R4/R5/R10/R11、AC-2/3/5/6/8/9、技法段 | privacy sweep 全再実行、状態数を Result に記録 | 必須（RESULT 表示）。文言は Owner 確認 |
| **F4** | 切替の有無/状態保持/「次へ」後固定/44px/360 で横スクロールなし、**S-1 通し** | 4 プロジェクト | **必須**（V-17） |
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
| **G-8** | 完成後の再編集可否（addendum §7-13）は Owner 未回答のため仕様テスト化できない | addendum §7 | Owner 回答後に C |

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

### 7.3 最短マージ順序（提案・実行は Owner 承認後）

1. **#545 B1** → base を main に更新（衝突なしを確認済み）→ マージ。
2. **#546 B2** → base を main に付け替え → WebKit 結果確認 → マージ。
3. **#548 F2** — B と独立。WebKit failure（B-1）の解消後、1 と並行して可。
4. **C #536**（クリティカルパス、未着手）。Owner の 85%/均一さ閾値 HV と §7-13 の回答が必要。
5. **D1 ∥ F3 ∥ F4** — D1（ロジック）と F3（RESULT/Research ロジック）は A・F2 だけで先行着手が可能（推定。Issue 記載は「A, C」なので **Owner 承認が必要**）。F4 は C の判定一本化後。
6. **D2**（#518 の扱いが決まってから）。
7. **E** — §8 回答 + Final Gate。

最短化のポイント: ① B1/B2/F2 を同時に承認 ② C の仕様質問（§7-13、閾値の暫定値）を早く Owner へ ③ D1・F3 を C と並行 ④ S-1/S-2 を C・F4・E の受け入れ条件に先に入れる。

---

## 8. ブロッカー

| ID | ブロッカー | 影響 | 必要な対応 |
|---|---|---|---|
| **B-1** | #548: `WebKit Gate` と `webkit-390x844 shard 2/3` が failure（再実行後の attempt 2 でも失敗。引き継ぎコメントは既知 flake `discovery3-oracle-neutralization.spec.ts:154` と記載）。**ジョブログの末尾 60 行には失敗テスト名がなく原因は未確認** | F2 マージ不可。Anti-Oracle の DOM 同一性検査なので、漏洩ではなく焼き加減バッジ差のみであることの確認が必要 | artifact `playwright-webkit-report-webkit-390x844-shard2`（run 39106776222）を確認。閾値・retry・skip での回避はしない |
| **B-2** | #546: WebKit 6 shard が実行中（結果未確認） | B2 マージ判断不可。G-2 の確認も兼ねる | 完了待ち |
| **B-3** | C 未着手。85%/均一さ閾値と「完成後の再編集可否」（addendum §7-12/13）は Owner 回答待ち | 四角ラウンドが「次へ」で進めず、通し E2E・D2・E がすべて止まる（クリティカルパス） | Owner 回答 + C 着手承認 |
| **B-4** | 継ぎ目 S-1（○/□ 切替と四角ラウンド判定・`pan` 設定が未接続） | F4/E の発見フローが成立しない | C と F4 の受け入れ条件に追加 |
| **B-5** | Design Lock §8 の 8 項目未回答。pizzadb.jp は環境から 403（食材・オイル位置・天板形状は未確認） | E の着手・Final Gate | Owner 回答 |
| **B-6** | RESULT 中立一文の最終文言（#538 本文は未承認、#521 コメントは決定済みと記載） | F3 | Owner 最終確認 |
| **B-7** | #518（焼成 filter 分離）未着手・PR なし | D2 の着手条件 | D2 は filter ブロックに触れない方針を Owner が確認 |
| B-8 | #545 の base が旧 `74c8297`、#540 の base が旧 `80e6d10` | 管理上の注意（B1 は衝突なし確認済み、#540 は作り直し） | マージ時に base 更新 |
| 非ブロッカー | #544（Research 2.0 の 53/172 再監査）は分離済み | E の前提ではない | — |
