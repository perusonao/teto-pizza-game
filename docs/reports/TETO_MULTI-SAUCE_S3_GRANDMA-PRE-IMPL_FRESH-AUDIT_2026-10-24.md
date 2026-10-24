# グランマピザ（#521 E = S3）実装前 Fresh Audit — 最新 main 基準

> **更新あり（2026-10-24）**: Owner から PIZZA DB 英語版ページの確認内容が中継された。**§11 が §2.1・§7.1 条件 1 を上書きする**（本文 §0〜§10 は更新前の記録として残す）。本セッションは原典ページを**直接確認できていない**（§11.1）。

Status: **docs-only**。`src/**`・`e2e/**`・レシピ/食材データ・テスト・CSS・workflow・save は無変更。PR 作成・merge・共有 Preview 更新・Production 変更は行っていない（**PR 作成と merge は Owner 承認待ち**）。
監査基準: `origin/main` = `dde0660`（2026-10-24）。調査日 2026-10-24。
関連 SSOT: `docs/PROJECT_HANDOFF.md`、`docs/decisions/TETO_SESSION-OPERATIONS_1.0.md`、`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`。

「推奨」は助言であり Owner Decision ではない。未回答を承認済みとみなさない。

## 0. 結論

1. **グランマピザは今も実装できない。** 唯一の確定的ブロッカーは **Design Lock §8-1（pizzadb.jp の原典確認）が未完了**であること（オイルの焼成前後・天板形状は未確認。この環境からも pizzadb.jp は到達不可）。
2. **Square Dough の前提は 10/18 の準備監査時点から大きく進んだ。** A・B・C・D1・D2・F1〜F4 は main に入った。残る技術的な穴は **(a) 四角の Reference と採点（D4）が未配線**、**(b) `PAN_TRAY_RECIPE_IDS` の共有定数化（OD-544-1）が未実施**、**(c) 四角 DOUGH の UX 確定（#581 と STEP 2 設計の Owner 判断）**。
3. **重複確認**: グランマ実装を行う open PR は #540（Draft HOLD・丸い版・触らない）のみ。他に open の claim・docs PR は無い。ただし **未 PR の先行ブランチ `claude/grandma-pizza-recipe-prep-0qh3qu`（準備監査、2026-10-18）が存在**する。本書はその**更新版**（最新 main で再検証、Pinsa / FINISH E5 / New Sauces との競合を追加）であり、先行ブランチの結論を置き換える部分は §1 の表で明示する。
4. 実装順は §6。**E の PR は 1 本にまとめず、(E-0) 共有定数・gate 準備 → (E-1) 四角 Reference・採点配線 → (E-2) レシピ + target 同時投入 の 3 段**を推奨する（AC8 の「同一コミット」制約は E-2 に限る）。

## 1. 先行ブランチ（準備監査 10/18）との関係

`claude/grandma-pizza-recipe-prep-0qh3qu` の 3 commit（`45b9e46` / `610121d` / `654f565`）は `docs/reports/TETO_MULTI-SAUCE_S3_GRANDMA-PREP_Audit.md` のみを追加し、**PR は無く main にも入っていない**。10/18 以降の更新が無いため、進行中の作業とは判断せず、本書で最新 main に再照合した。先行監査の Owner 決定の記録（§8 の確定/未確定、AC1〜4・8、文言の併存）は有効で、本書はそれを**引用し再掲しない**。

| 先行監査の記述 | 最新 main での状態 |
|---|---|
| B・C・D・F が未完（開始条件 2〜5） | **B・C・D1・D2・F1〜F4 は main 済み**（§3 の表）。ただし D4（四角 Reference・採点）は未実施 |
| 「F2 で affordance step を再導出」 | F2 は #548 で merge 済み。step の導出ロジックは main にあるが、**grandma の行が無いので `tray` の affordance は null のまま**（`deductionProduction.gate.test.ts:168`）。E で材料が確定した時点の再導出は引き続き必要 |
| 四隅・均一度閾値は C の HV で決定 | C（#558）は main 済みだが **Owner 実機 HV は未実施**。#581 / STEP 2 設計で UX が再検討中（§4） |
| 57 → 58 レシピ | 現 main は **63 レシピ**（Batch 8a/8b、New Sauces A/B-1 で増加）。件数固定テストの更新量は先行監査の見積りより大きい |
| ladder 53 step | 現 main は **56 step**。olive-oil=13 / garlic=14 は追加のみ（append-only）で不変 |

## 2. 調査項目 1 — 原典確認状況と未確定事項

### 2.1 原典（pizzadb.jp）

| 項目 | 記録 | 状態 |
|---|---|---|
| 行 ID・食材 4 種 | `grandma-pizza-pizzadb`、tomato-sauce / mozzarella / garlic / olive-oil（Phase 0B canonical に明記） | リポジトリ内記録あり |
| 個数・bake 窓 | 記録なし。#540 の 1/1/3/2・56–76 は調整値 | 原典外 |
| オイルの焼成前/後 | 記録なし（`MULTI_SPREAD_LAYER` 証跡のみ） | **未確認** |
| 生地 `doughStyle` | 未記録 | **未確認** |
| 天板（四角）形状 | 記録なし。Addendum は「Owner のゲーム設計判断」と明記 | **未確認** |
| ライブ確認 | 環境から 403 | **Owner 側で必要** |

表記ルール: Owner が確認するまで、UI 文言・レシピ説明・docs に「PIZZA DB が四角い天板を記録している」「オイルは焼成前/後」と書かない。

### 2.2 Design Lock §8 の状態（Issue #521 のコメント履歴から）

- **確定（Owner）**: 8-2 `ladderCredit:false` / 8-3 SAUCE 段は両ソース（OD-544-3、grandma に限定）/ 8-4 TQ-3 より先に追加可 / 8-5 オイル重ね 0.3 維持 / 8-6 id・名称 `grandma-pizza`・グランマピザ / 8-7 スフィンチョーネ保留 / 8-8 異種 2 ソースは後続。`panShape: square` 必須、`pan: tray` 必須、`lunchRush:false`、CUT 無効。RESULT 中立文言と Research G2 は併存（別定数）。
- **未確定**: **8-1 原典確認（E をブロック）**、affordance step（暫定 14、E で再導出）、四隅・均一度閾値の最終値（C の実機 HV）、完成後の再編集仕様、個数・bake 窓、四角 Reference の設計、marinara の A/B 適用時期（OD-544-4/5 で方針は受容済み）、OD-544-6 の validator 例外 allowlist の登録内容、**OD-544-8（Anti-Oracle §15 の複数ソース前提での再計算）は E の Final Gate 前に必須で未実施**。
- #540 の「§8-3 / §8-4 は受理扱い」は当時は誤り。#540 本文は訂正済みだが、**Result Report と commit message は未訂正**（HOLD のため触れていない）。E の実装時に書き直す。

## 3. 調査項目 2 — 四角形生地・2 ソース工程の実装状況（main `dde0660`）

### 3.1 四角形生地（Epic #532）

| 段 | PR | 状態 | 備考 |
|---|---|---|---|
| A 形状基盤 | #541 | main | `PanShape` / `Recipe.panShape?`。**どのレシピも未設定**（テストで固定） |
| B タップ/長押し | #545 / #546 | main（closed） | 暫定パラメータ。実機 HV 後に調整する前提 |
| C 四隅ドラッグ・STEP 1/2・完成判定 | #558 | main | 実機 HV 未実施 |
| D1 ソース指標・reducer 境界・CUT 無効 | #549 / #552 | main | `computeSquareSauceMetrics` は**定義のみで本番コードからの呼び出し無し** |
| D2 描画（DOUGH〜RESULT、焼成、えぐれ） | #563 / #573 / #576 / #582 | main | 四角サムネイルの呼び出し元は未追加（意図的。D2-b2 Result） |
| F1 pan 軸 OBSERVED | #547 | main | |
| F2 Technique `tray` | #548 | main | affordance は要求レシピが無いので null |
| F3 RESULT 中立文言 | #553 | main | |
| F4 ○/□ 切替 | #555 / #566 | main | |
| UX AB-min | **#581** | **open**（Preview 限定） | §4 参照 |

→ 「プレイヤーが `pan:"tray"` で四角生地を作って RESULT まで進める」経路は、**Preview / DEV と pan 選択 UI（affordance 閉）の範囲で存在**する。Production では grandma が無いので affordance が開かず不活性。

### 3.2 2 ソース工程

| 項目 | 状態 |
|---|---|
| 複数ソースの ledger・描画（B1/B2） | main（#498 / #500 / #494） |
| S1 トマト→オイルの重なり（#519 描画） | **#524 で main**。Owner 決定で `SAUCE_OIL_OVERLAP_ALPHA_FACTOR = 0.3` 維持（`sauceDisplay.ts:317`） |
| S2 `buildHintLine` が必須ソース全件を確認 | **#525 で main** |
| 2 ソースのガードテスト基盤（`requiredSauces.ts` 等） | **#540 のブランチにのみ存在**（main に無い）。E-0 で main に入れ直す必要がある（§6） |
| `APPLY_SAUCE` の置換経路 | 残存（UI 到達不能。防御修正は未実施・任意） |
| 四角でのソース描画 | D2-a2 で `sauceSurface.ts` 経由。**トマト→オイルの重ねを四角面で検証する E2E は無い**（`e2e/sauce-oil-over-519.spec.ts` に square の記述は 0 件） |

## 4. 調査項目 3 — 四角形ピザの Reference・採点の不足部分

| # | 不足 | 根拠 | 影響 |
|---|---|---|---|
| G-1 | **四角 Reference が存在しない** | `data/referencePizza.ts` は円前提（`computeMechanicalSauceReference` と 8 スロットのリング `pizzaReferenceLayout.ts`）。`pan` / `square` への分岐なし | grandma の Reference を円配置で作ると四角生地の外にピースが出る/偏る。先行監査どおり**円の 8 スロット流用は不可** |
| G-2 | **四角のソース指標・採点が未配線（D4）** | `computeSquareSauceMetrics` は `squareSauce.ts:86` の定義のみ。D1-b Result 「Scoring 2.0 / Reference に routing しない。D4 は四角レシピ（E）が出るまで不変」、D2-a2 Result 「四角のソース指標・採点は丸のまま」 | 四角で調理しても `computeSauceMetrics`（円）で評価される。**E の前に配線するか、E の中で明示的に扱うかの判断が必要**。式・重みは変えない（D4）。Reference は「調理した形状」の入力であり新式ではない（Addendum §5） |
| G-3 | 四角の Reference プレビュー/サムネイル | `ReferencePreview` / `PlayerReferencePreview` / `SauceMetricsPanel` は円。D2-b2 は四角サムネの呼び出し元を意図的に追加していない | プレイヤー向け見本（Making reference）が円のまま。未発見時は形状中立が必要（Anti-Oracle）なので、**発見前に四角見本を出さない設計**が要る |
| G-4 | 二次ソース（オイル）の Reference 目標 | Owner 方針は「副ソースは有無のみ」。完成判定はオイル 0 = FAILED / 1 tick = PASS | 量の目標は不要。ただし Reference 上の表示（オイル層の見せ方）は未設計 |
| G-5 | 均一度の完成ゲートの閾値 | B2 Visual-Feedback Result: 「均一度の閾値は未採用（Owner HV で判断）」 | 品質入力としての扱いのみ。識別には使わない（Addendum） |
| G-6 | 四角の Reference 回帰（57 レシピ byte-identical） | Epic 共通条件 | G-1/G-2 の配線時に丸レシピのゴールデンが不変であることをテストで固定する必要 |

## 5. 調査項目 4 — #581・#540・#519 との依存関係

| 対象 | 状態 | grandma との依存 |
|---|---|---|
| **#581**（Square Dough UX AB-min、open、Preview 限定） | `SquareDoughLayer.tsx` / `SquareDoughGuide.tsx` / 新規 `squareGapGuide.css` 等 21 files。判定・閾値・採点・保存形式は不変。**実機 HV 未実施**。STEP 2 一筆通過の別設計（`...STEP2-SEPARATION_DESIGN.md`）は Owner の追加承認待ち | **ファイル衝突は小**（E は `recipes.ts` / `discoveryCatalog` / gate テスト / Reference が中心）。ただし **(1) E の個数・bake 再調整と HV 動画は DOUGH UX が確定した後が望ましい**、**(2) STEP 2 の判定・難易度が変わると完成判定を前提にしたレシピ E2E（四角 + tray の通し）がやり直しになる**。マージ順は #581 → E を推奨 |
| **#540**（Draft HOLD、丸い版） | head `124f696`、base は大幅に古い。**丸いまま grandma を発見できる**ので公開不可（D3 / AC8） | **マージ・クローズ禁止のまま**。再利用/再設計/破棄の分類は先行監査 §3 と #540 本文を踏襲。E は #540 を rebase せず、**最新 main から新ブランチ**で §3.1 の部分だけを持ち込む |
| **#519**（Bug A、open） | 実機再現は取れず、S1 #524 で描画面を修正済み。Issue のクローズ判断（Owner の再現条件確認）は未了 | grandma はこの描画経路（トマト→オイル）を**四角面で**初めて Production 相当に露出する。#519 の Owner 判断を待つ必要はないが、**E の受け入れ条件に「四角面でのトマト→オイル画素検証」を追加**する（G-7）。#502（oil + bakedOil の heatmap fallback）のテストは #524 で追加済み |
| #521（本 Issue） | open。E の追跡先 | — |
| #532（Epic） | open。sub-issue 6 件 | E の完了で Epic の残りは #536 の UX 確定のみ |
| #544 / OD-544-1〜8 | 決定済み（docs #550） | §6 の E-0 で実装する項目 |

## 6. 調査項目 5 — FINISH E5・Pinsa との競合可能性

### 6.1 共有するファイル/テスト（競合の源）

| 領域 | grandma（E-2） | Pinsa P3-b（#577、HOLD） | FINISH E5（#621、HOLD） |
|---|---|---|---|
| `data/recipes.ts` | 通常レシピ 1 行追加（hot file） | `lateCatalog.ts` 側（通常 `RECIPES` に入れない） | `lateCatalog.ts` 側 |
| `discoveryCatalog.ts` | target 追加（`pan: tray`） | Pinsa target（`dough`・`late`） | 本番スイッチ OFF→ON のみ |
| `signature.ts` | 変更なし（`pan` は F1 で OBSERVED） | `dough` 軸の OBSERVED 化は済み（#583）。P3-b はデータ | 変更なし |
| **`PAN_TRAY_RECIPE_IDS`** | `grandma-pizza` を追加 | 触れない | 触れない |
| **`DOUGH_PINSA_ROMANA_RECIPE_IDS`** | 触れない | `pinsa-romana` を追加 | 触れない |
| `deductionProduction.gate.test.ts` / `hint5Production.gate.test.ts` | `TECHNIQUE_REQUIRING_RECIPE_IDS = NO_SAUCE ∪ PAN_TRAY ∪ DOUGH_PINSA` に**同じ式で追記** | 同上 | 触れない |
| 件数固定テスト・Hint 5.0 ゴールデン（`catalogLedger`、`hint5.ladders55.json` 等） | +1 レシピ | +1 レシピ（late） | — |
| `recipeBatchManifest.ts` / `recipeBatchValidator.ts` | `acceptedLetterShifts` に marinara `-→A`（OD-544-6） | `pinsa-romana` 限定で jamon `-→B`（Q7 確定、#648） | — |
| Research コホート文字 | marinara が「文字なし→A」、grandma が B | jamon に B | — |
| `lateCatalog` / FINISH 本番スイッチ | 触れない | 触れる（late 軸） | `LATE_CATALOG_PRODUCTION` / `FREE_COOK_FINISH_PRODUCTION` |
| ladder 追加 step | **追加しない**（方針）。ただし New Sauces が 55・56 を既に使用 | 専用 step は不要と見込み（未検証）。late は 57 が実例 | — |

### 6.2 判定

- **直接の機能競合はない**（grandma は通常レシピ・`pan`、Pinsa は late 軸・`dough`、E5 はスイッチ）。識別軸は独立（`pan` と `dough` は互いを推定しない）。組み合わせ表でも `(standard, tray)` は grandma、`(Pinsa, tray)` は ORIGINAL。
- **実際の競合点は「同じ gate テストの allowlist 式」と「件数・ゴールデン・manifest の再生成」**。3 本が順不同で merge すると、後続は必ず rebase で再生成が要る。**merge 順の調整が必要**（Owner Gate の hot-file 規約に従い、後発の claim に先行 PR を明記）。
- **`PAN_TRAY_RECIPE_IDS` が 2 つの gate に別定義のまま**（`deductionProduction.gate.test.ts:128`、`hint5Production.gate.test.ts:325`）。OD-544-1 は共有定数 1 か所化を決定済みだが**未実施**。Pinsa の `DOUGH_PINSA_ROMANA_RECIPE_IDS` が先に入ったため、E-0 では両方の定数を同じ場所にまとめるか、`tray` 側のみ先行するかの調整が要る。
- E5 は**本番スイッチ OFF のまま HOLD**で、ladder・Research の件数に影響しない。grandma が E5 に先行/後続しても機能的な依存はない。ただし E5 の Owner 実機 HV が LAN サーバの待機中であり、**同じ iPhone/HV 枠を共有する**ため、HV の予約（運用面）が競合しうる。
- New Sauces（#578、通常 ladder 55・56）は **olive-oil=13 / garlic=14 を動かさない**（append-only）ので affordance 14 は不変。ただし件数固定が既に 63 レシピになっているため、先行監査の件数見積りは使えない。

## 7. 調査項目 6 — 実装可能になる条件と推奨実装順

### 7.1 E-2（レシピ + target の同時投入）の開始条件

| # | 条件 | 現状 |
|---|---|---|
| 1 | **§8-1 原典確認が完了し、矛盾がない**（食材・オイル位置・天板形状） | **未完了（唯一の確定ブロッカー）**。矛盾があれば grandma は保留に戻す |
| 2 | A・B・C・D・F の機能 | **main 済み** |
| 3 | **D4 の扱いの決定と四角 Reference の設計** | 未決・未実装（G-1/G-2） |
| 4 | 四角 DOUGH の UX 確定（#581 の Owner 判断、STEP 2 設計、閾値、完成後の再編集） | 未決。**個数・bake 窓の再調整と HV の前提** |
| 5 | OD-544-1/2 の gate 共有定数と grandma 限定 allowlist | 未実施（E-0） |
| 6 | OD-544-8 Anti-Oracle §15 の複数ソース再計算 | 未実施（**Final Gate 前に必須**） |
| 7 | affordance step の再導出（暫定 14） | E-2 で実施。ハードコードせず導出結果を採用 |
| 8 | Owner 承認前に merge しない / #540 は不変 / 共有 Preview を更新しない | 常時 |

条件 1 以外は実装側で解消できる。**条件 1 が満たされるまで E-2（`recipes.ts` への grandma 追加）は着手しない**。E-0 / E-1 は条件 1 と独立に進められるが、いずれも Owner の指示後。

### 7.2 推奨実装順（推奨であり決定ではない）

| 段 | 内容 | 前提 | HV | 備考 |
|---|---|---|---|---|
| **E-0** | `PAN_TRAY_RECIPE_IDS` の共有定数化（OD-544-1）、2 ソース用テスト基盤の main 取り込み（`requiredSauces.ts` ほか、#540 §3.1 の再利用分）、gate の `GATE_STATES` に pan ○/□ を追加して再実行（状態数を記録）。**grandma の行は入れない** | なし（原典確認は不要） | 不要（テスト・ロジックのみ、本番挙動不変） | `MULTI_SAUCE_RECIPE_IDS` は空/synthetic fixture で検証 |
| **E-1** | 四角 Reference と採点配線（D4）。`computeSquareSauceMetrics` を調理形状で解決、四角用 Reference 型、57→63 レシピの byte-identical 回帰。**式・重みは不変** | E-0。#581 / UX は並行可（ファイル別） | 必要（見た目が変わる場合）。Production では `pan:"tray"` を要求するレシピが無いため不活性 | 円 Reference の流用はしない。四角見本は発見前に出さない |
| **E-2** | `grandma-pizza`（`panShape:"square"`）+ target（`pan:"tray"`）を**同一コミット**で追加。`ladderCredit:false`・`lunchRush:false`・CUT なし・key-free。個数/bake 再調整、Hint 5.0 の SAUCE 段（両ソース）、allowlist に追加、OD-544-8 の再計算、件数/ゴールデン/manifest 更新、約 35 件の Research 追従テスト、marinara `-→A`（OD-544-6） | **§8-1 完了**、E-0・E-1、#581 の UX 確定、Owner 承認 | 必須（Square Dough 版） | 先行ブランチ・#540 の文言誤記を訂正。丸い E2E は否定形に書き換え（AC2） |
| **E-3**（任意） | `APPLY_SAUCE` の防御修正、四角面のトマト→オイル E2E の恒久化 | E-2 後 | 内容次第 | 別 PR |

PR は Owner 承認後。各段で WebKit 390×844 / 360×800 を含む CI と最新 head の Codex レビューを通す。既知 flake（#394 / #529 / #531）は隠さず記録し、timeout 延長・retry・判定緩和はしない。

### 7.3 受け入れ条件への追加提案（先行監査 E-AC1〜8 に加えて）

- **E-AC9** 四角面で tomato → olive-oil を塗った後も tomato が可視（画素、390×844 / 360×800、SAUCE→BAKE→RESULT）。
- **E-AC10** 四角 Reference での採点が、同一入力の丸 Reference 採点と式・重み不変であること（入力の差のみ）。57→63 レシピの採点ゴールデン byte-identical。
- **E-AC11** `PAN_TRAY_RECIPE_IDS` が共有定数 1 か所で、`grandma-pizza` のみを含み、`techniqueRequiringRecipeIds` と双方向一致。

## 8. Owner への確認事項（回答まで推測で進めない）

1. **pizzadb.jp の原典確認（§8-1）**: 食材、オイルの焼成前/後、天板形状。完了予定があれば E-2 の時期の目安になる。
2. **E-0 / E-1 を原典確認より先に進めてよいか**（本番挙動は不変、grandma 行は入れない）。進めない場合は E 全体が §8-1 待ちになる。
3. **D4 の扱い**: 四角の採点配線（G-2）を E-1 として独立させる案でよいか、E-2 に含めるか。
4. **#581 / STEP 2 設計の判断時期**: E-2 の個数・bake 再調整と HV の前提になるため。
5. **merge 順**: Pinsa P3-b・FINISH E5・grandma の gate allowlist 式が衝突するため、先行させる順序の希望。

## 9. 今回確認できたこと / できなかったこと

確認した: main `dde0660` の fetch、`CLAUDE.md` / `PROJECT_HANDOFF.md` の起動チェックリスト、`TETO_SESSION-OPERATIONS_1.0.md`、Issue #519 / #521（本文と全コメント）/ #532、PR #540 / #581 の本文、open PR 一覧 28 件（グランマ実装・docs の重複なし）、先行ブランチ 3 本（`grandma-pizza-recipe-prep-0qh3qu`＝上記、`grandma-pizza-square-dough-58ktfl`・`grandma-multi-spread-audit-mh1huh`＝2026-10-02〜17 の古い docs で main に取り込み済みか陳腐化）、先行準備監査の全文、Pinsa/E5 の追跡文書と P3 L1 決定、main のコード（`recipes.ts` に grandma 無し、`panShape` の使用箇所、`computeSquareSauceMetrics` の未配線、`PAN_TRAY_RECIPE_IDS` の 2 箇所定義、ladder の olive-oil=13 / garlic=14）。

確認できなかった: pizzadb.jp（403）、#581 / #540 の最新 CI・mergeable 状態（`unknown`）、Owner Gate の実行結果（Actions 実行は行っていない）、各 Epic sub-issue の最新コメント全件（#536 のみ確認）、E2E / Vitest の実行（docs-only のため未実行）。

## 10. 触れていないもの

ゲームコード、テスト、`e2e/`、Production、共有 Preview（`teto-pizza-game-preview`）、#540（Draft HOLD のまま）、#527、#581、#650、Pinsa/E5 の docs、`PROJECT_HANDOFF.md`（hot file。更新が必要なら Owner 承認後の別 PR）。

## 11. 原典更新（2026-10-24、Owner 中継）— §2.1 / §7.1 条件 1 を上書き

docs-only。ゲームコード・テスト・Production・共有 Preview・PR・merge は無し。**原典が確認できたことを理由に、未承認の工程・材料・文言・数値を追加していない。**

### 11.1 証拠の扱い

| 項目 | 状態 |
|---|---|
| 対象 | https://pizzadb.jp/en/pizzas/grandma-pizza/ |
| 本セッションの直接確認 | **不可**。`curl`: CONNECT tunnel 403、WebFetch: `getaddrinfo ENOTFOUND pizzadb.jp`（環境のネットワーク制限）。本文の引用・独立検証は**していない** |
| 以下の「原典の事実」の出所 | **Owner が確認して中継した内容**。本セッションの再確認なし。原文の転記も受け取っていない |
| 依頼 1「現在の本文を直接確認」 | **未達**。Owner が原文（該当段落の貼り付けまたは取得日付きの保存）を残せば、独立検証なしの区分を解除できる |

### 11.2 原典の事実（Owner 中継）とゲーム設計の対応

| # | 原典の事実（中継） | §2.1 の旧状態 | 更新後の状態 | ゲーム側の現状（main `dde0660`） |
|---|---|---|---|---|
| F1 | アメリカ・ロングアイランド由来 | 記録なし | 中継あり | ゲーム内に由来の記述なし。**由来を説明文・UI に出すかは未承認**（出さない） |
| F2 | 薄い**長方形**の天板焼き生地 | 天板形状 **未確認** | 中継あり（長方形） | ゲームは `panShape:"square"`（正方形、半辺 44）。**長方形と正方形の差は未整理**（§11.3 M-1） |
| F3 | 食材: トマトソース・モッツァレラ・にんにく・オリーブオイル | repo 記録と一致 | 中継あり・**一致** | 変更なし |
| F4 | **生地を伸ばす前に天板へ薄くオイルを塗る** | オイル位置 **未確認** | 中継あり | ゲームのオイルは SAUCE 工程内の PAINT_TEMPORARY（既存 9 レシピと同形）。**DOUGH 前の天板オイル工程は存在しない**（§11.3 M-2） |
| F5 | チーズとソースの重ね順にはバリエーションがある | 記録なし | 中継あり | `layerOrder` は `FIXED_BY_FLOW`。ゲームの工程順（ソース→チーズ）は固定（§11.3 M-3） |
| F6 | **焼成後の追加オイルは必須と確認できない** | 後乗せ証跡なし | 中継あり | `postBakeFinish` なし・late 軸なし。**FINISH / 後乗せは不要**（原典と矛盾しない） |
| — | 個数（1/1/3/2）・bake 窓 | 原典外 | **変わらず原典外** | ゲームの調整値 |
| — | 生地 `doughStyle` | 未記録 | 中継された記述は「薄い」のみ。**スタイル分類は未記録のまま** | `doughKind` 未設定（標準） |

### 11.3 原典の事実とゲーム独自の設計判断の分離

**原典の事実**（11.2 の F1〜F6）と、**ゲームの設計判断**は別物として扱う。

| 区分 | 項目 | 根拠 |
|---|---|---|
| 設計判断（Owner 決定済み） | `panShape:"square"`、`pan:"tray"`、技法「天板焼き」、`ladderCredit:false`、`lunchRush:false`、CUT 無効、SAUCE 段は両ソース、id・名称 | Design Lock / #521 コメント。**原典が根拠ではない**（Addendum は「天板はゲーム設計判断」と明記） |
| 設計判断（未決） | **M-1 長方形 ↔ 正方形**: 原典は長方形。正方形の天板は「長方形の簡略化」か「別表現」か。比率を変えると A の形状基盤・D の描画・C の完成判定・Reference すべてに波及する | 変更は Owner 決定が必要。**本書は変更しない** |
| 設計判断（未決） | **M-2 オイルの扱い**: ゲームのオイルは SAUCE 工程の「有無のみ」（Owner 方針）。原典の「伸ばす前に天板へ薄く塗る」を (a) 現行の SAUCE 工程内オイルで代替する簡略化として許容するか、(b) 別工程として設計するか。**(b) は新工程の追加で、未承認のため設計しない** | 原典は焼成後オイルを必須としない（F6）ため、POST_BAKE は不要で一致 |
| 設計判断（未決） | **M-3 重ね順**: 原典にバリエーションがあるので、ゲームが順序を**識別条件にしない**（`layerOrder` は固定のまま）こと自体は原典と整合。順序の入れ替えを遊びとして許すかは別問題 | 新しい識別軸・工程は追加しない |
| 設計判断（未決） | 説明文: 現行案（時点を断定しない一文）を維持。由来・薄さ・天板オイル等を**書く場合は Owner の文言承認**が必要 | 中継内容を文言として自動採用しない |
| 原典外 | 個数・bake 窓・均一度/四隅の閾値 | ゲーム調整値。原典確認の対象ではない |

### 11.4 Design Lock §8-1 との整合

§8-1 の要求は「食材・オイル位置・天板形状を Owner が確認し、**矛盾がないこと**。矛盾があれば grandma は保留に戻す」。

| §8-1 の要素 | 中継内容 | 整合 |
|---|---|---|
| 食材不変 | 4 種で repo 記録と一致 | **整合** |
| オイル位置（焼成前/後） | 焼成前（天板に塗る）。焼成後は必須でない | 「焼成前」という方向は**整合**。ただしゲームの SAUCE 工程内オイルとは**工程の位置が異なる**（M-2） |
| 天板形状 | 長方形 | 「天板である」点は整合。**正方形との差は整理が必要**（M-1） |

→ **本書は 8-1 の完了を宣言しない。** 食材は整合、オイルは方向が整合し位置が簡略化、形状は長方形↔正方形の差が残る。「この差は矛盾か許容か」は Owner の判断事項である（Design Lock §8-1 は Owner の確認項目）。直接確認の欠如（11.1）も 8-1 完了の記録としては弱い。

### 11.5 E-0 / E-1 / E-2 の実装条件の再評価

| 段 | §7 の条件 | 更新後 |
|---|---|---|
| **E-0** 共有定数・gate 準備・2 ソース基盤 | 原典確認に依存しない | **変更なし**。Owner の着手指示待ち。grandma の行は入れない |
| **E-1** 四角 Reference・D4 配線 | 原典確認に依存しない | **条件が 1 つ増える**: M-1（長方形か正方形か）が決まらないと Reference の領域形状が確定しない。正方形のまま進める場合は「Owner が正方形を維持と明示」が前提。**M-1 未決のまま E-1 の Reference 形状を決めない** |
| **E-2** レシピ + target 同時投入 | 条件 1: 原典確認完了 | 条件 1 を次に分解: (1a) 食材整合 ✓（中継）、(1b) 8-1 の完了を Owner が宣言、(1c) M-1・M-2 の決定、(1d) 11.1 の直接確認の記録。**1b〜1d が未了のうちは着手しない** |
| 共通 | OD-544-8、#581 の UX 確定、affordance 再導出 | **変更なし** |

後乗せ（POST_BAKE / FINISH）が不要と読めるため、**FINISH E5・`lateCatalog` との依存は増えない**（§6 の競合評価は不変）。Pinsa との gate allowlist・件数・manifest の競合も不変。

### 11.6 推奨実装計画（推奨であり決定ではない）

1. Owner が M-1・M-2 を決定し、8-1 の扱い（完了/条件付き）を宣言する。
2. 並行して E-0（Owner 指示後）。
3. M-1 確定後に E-1。
4. 8-1 完了 + #581 の UX 確定後に E-2。説明文は現行案のまま、原典由来の文言は Owner 承認後のみ。

### 11.7 残る Owner 判断

1. 原文の記録: 取得日付き保存または該当段落の貼り付け（独立検証の代替。実施するか）。
2. **M-1**: 天板を正方形のまま「長方形の簡略化」として維持するか、長方形（比率）を導入するか。後者は A・C・D・Reference に波及する大きな変更。
3. **M-2**: 天板オイルを現行の SAUCE 工程内オイル（有無のみ）で代替してよいか。別工程は設計しない前提で、許容の可否。
4. **M-3**: 重ね順のバリエーションを、ゲームでは固定フローのままにしてよいか。
5. §8-1 を完了とするか、条件付きとするか。
6. 説明文に由来・薄さ等を入れるか（入れない場合は現行案のまま）。
7. E-0 を原典確認の完了前に始めてよいか（§8-2 から継続）。
