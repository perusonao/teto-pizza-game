# Cooking Prep Phase 1B — Fresh Audit と詳細設計（docs-only、実装は未着手。Owner 決定 2026-10-29 反映済み）

日付: 2026-10-29 / ブランチ: `claude/teto-cooking-prep-1b-p96ftb`（main `3e34656` = #694 から）/ Refs #696（Phase 1B 専用 Issue。#611 は別件の TQ-2 / BBQ Chicken で、本件では使わない。関連 #294 は参照のみ）
目的: PR #695 の「3 タップ」を、牛肉の焼き加減を見極めて「取り出す！」を押すタイミングゲームへ改める。

> **2026-10-29 更新（実装着手、Owner 決定 D2・D3）:** #695 は Squash merge 済み（main `ffff081`）。管理 Issue は **#696**（claim 投稿済み）。本書は実装ブランチ `claude/cooking-prep-1b-timing-game` へ取り込み、判定境界を**半開区間**（best = `2100 ≤ t < 4200`、4200ms ちょうどは overdone）に統一した。以降の「未着手」「禁止」の記述は着手前の履歴で、現状は #696 と実装 Result Report（`TETO_COOKING-PREP_PHASE1B_Result.md`）を正とする。

## 1. Fresh Audit（2026-10-29 時点の GitHub 実測）

| 項目 | 状態 |
|---|---|
| main | `3e34656`（#694 PR-A: reducer・フラグ・Preview opt-in）。**`CookingPrepLayer` / `beefDoneness` / `prepOffer` / `CookingPrep.css` は main に存在しない** |
| PR #695（PR-B） | **open・未 merge**・mergeable clean・43 files / +1946 −8。HEAD `5beb87b` |
| #695 の CI | HEAD `5beb87b` の 11 check **全 success**（WebKit 6 シャード含む）。`fd99869` の WebKit 1 件失敗（`finished-pizza-visual-2.0` の dough box）は無関係と記録済み・HEAD では success |
| #695 の Codex | `fd99869` は「指摘なし」。最新 HEAD `5beb87b` の再レビューは **running**（Preview/DEV 限定の HV 入口の差分）。未解決スレッドの有無は未確認 |
| #695 の HV | 動画・比較画像は用意済み。**iPhone 実機 HV は Owner 判定待ち**。merge は Owner 承認後（Squash） |
| 重複 PR / Issue | open PR に 1B と重なるものなし（`GameScreen.tsx` を触る #478 Draft、`PizzaStage.tsx` を触る #468 のみ要注意）。Issue 検索で焼き加減/タイミングの実装 Issue なし |
| claim | 1B の claim は **#696** に投稿（Owner 決定 D2、2026-10-29）。#611 は別件（TQ-2 / BBQ Chicken）で使わない。#695 側の claim が #611 だったのは経緯で、1B には引き継がない |

**結論: 依存関係あり。1B が変更する主ファイルはすべて #695 で新規追加されるため、最新 main への独立 PR は #695 の merge 前には成立しない。**
Session Operations §2 の `WAIT_DEPENDENCY`（未 merge の base に積まない）に従い、**ここで止めて Owner 判断を求める**（§7）。

## 2. 既存実装の調査（#695 HEAD `5beb87b`）

- `src/logic/prep/prepOffer.ts`: 表示条件（純関数）と定数 `PREP_TOSSES=3` / `PREP_TOSS_DEBOUNCE_MS=120` / `PREP_DONE_MS=700` / `PREP_GUARD_MS=300`。
- `src/logic/prep/beefDoneness.ts`: doneness(0..1)→色。生 `#b8473a` 系 → 炒め済み `#7a4226` 系（暫定）の **2 点間の線形補間**。`preparedPieceVisual` は常に doneness=1。
- `src/components/CookingPrepLayer.tsx`: `idle → pan → done` の 3 状態。1 回目〜3 回目のタップで `tosses` が増え、3 回目で `onPrep` を **1 回だけ** dispatch。`key={step:reset:ingredient}` の再マウントで工程切替・やり直しを破棄。blur / visibilitychange で破棄。× は中止のみ。
- reducer `PREP_INGREDIENT`: フラグ OFF・Lunch Rush/Dinner・TOPPING 以外・非対象・未所持・炒め済みを **同一参照で拒否**。保持するのは `preparedIngredientIds`（transient。`RESET_PIZZA` 等で消え、保存・journal に出ない = AC-5/7/19）。
- テスト資産: `CookingPrepLayer.test.tsx`、`GameScreen.CookingPrep.test.tsx`、`PizzaStage.CookingPrep.test.tsx`、`beefDoneness.test.tsx`、`prepOffer.test.ts`、`e2e/cooking-prep.spec.ts`（18 件）、`cookPrepHv*.test.ts`。**3 タップを前提にした期待値が複数ある**（改修対象）。
- main 側で触るのは reducer の `PREP_INGREDIENT` と `GameState`（`gameReducer.ts` は HOT file）。

## 3. 仕様差分（#695 → 1B）と、Owner 承認済み仕様との関係

| # | 項目 | #695（承認済み仕様） | 1B（今回の指示） |
|---|---|---|---|
| 1 | 操作 | どこでも 3 タップ | 約 6 秒進行する焼き加減を見て「取り出す！」を 1 回押す |
| 2 | 判定 | なし（3 回で必ず成功） | 押した瞬間の経過時間で early / best / overdone |
| 3 | 時間切れ | なし | 6 秒で自動終了＝焼きすぎ |
| 4 | 色 | 3 段階（タップごと）の見た目 | 時間連続（生 → 炒め済み → 焦げ） |
| 5 | 失敗 | 失敗なし | **進行不能なし**（やり直し・そのまま使う・× / スキップ） |
| 6 | 採点・在庫・Dex・保存 | 不変 | 不変（維持） |

要 Owner 確認: #1・#2・#3 は spec §3 / P-系の決定（3 タップ・時間制限なし・失敗なし）と **正面から変わる**。AC-13（所要 ≤ 8 秒・失敗状態なし）は 6 秒＋結果表示で収まる見込みだが「失敗状態なし」の解釈（焼きすぎ＝失敗に見えない設計）の承認が要る。AC-3（炒めあり/なしで `preparedIngredientIds` 以外が同一）は、結果を状態に持つ場合 **「`preparedIngredientIds` と新フィールド以外」** への文言変更が要る（§5.4）。

## 4. 詳細設計

### 4.1 純粋ロジック（先に実装・単体テスト）— 新規 `src/logic/prep/panDoneness.ts`

React・DOM・`Date.now()` に依存しない。時刻は常に引数で受ける。

```
PAN_TOTAL_MS = 6000          // 全体
BEST_START_MS = 2100         // 35%
BEST_END_MS   = 4200         // 70%（半開区間の終点。4200ms ちょうどは overdone）
PAN_ARM_MS    = 300          // 開いた直後の「取り出す！」無効時間（pill を押した指の誤爆防止。HV で調整可）
type PanGrade = "early" | "best" | "overdone"
progressAt(elapsedMs) -> 0..1          // clamp、NaN/負は 0
gradeAt(elapsedMs)    -> PanGrade      // t < BEST_START は early、BEST_START <= t < BEST_END が best、t >= BEST_END は overdone（t >= TOTAL は時間切れ = overdone）
```

- 境界（**Owner 追加決定 2026-10-29 で半開区間に統一**）: early = `0 ≤ t < 2100`、best = `2100 ≤ t < 4200`（始点を含み終点を含まない）、overdone = `t ≥ 4200`（**4200ms ちょうどは overdone**）。`t ≥ 6000` は時間切れ（overdone）。4.2〜6.0 秒が overdone であることは Q2 で確定済み。旧版の閉区間（`4200` を best に含める）は廃止した。
- 状態機械（純 reducer）`panReducer(state, event)`:
  `idle --START(now)--> running{startedAt} --TAKE(now)--> finished{grade, progress, at:"take"}` /
  `running --TICK(now>=startedAt+TOTAL)--> finished{overdone, progress:1, at:"timeout"}` / `any --CANCEL--> idle`。
  - TAKE は `now - startedAt < PAN_ARM_MS` なら **無視**（誤タップ）。`finished` 以降の TAKE / TICK / START は無視（二重入力）。
  - 時間切れと TAKE が同一フレームで競合したら、**`now` が TOTAL 以上なら時間切れ優先**（押下イベントの `timeStamp` を使う）。
  - 時計が巻き戻る / 非有限値は START 時刻に clamp（early 扱い、クラッシュしない）。
- 色: `beefDoneness.ts` を 3 点補間（生 → 炒め済み @ best 中央 ≈ 0.525 → 焦げ @ 1.0）へ拡張。`beefColorsAt(progress)`。既存 `beefDonenessStyle(0..1)` は後方互換（#695 の呼び出しを壊さない）。焦げ色は暫定（HV で確定）。
- 結果文言（`gradeCopy`）: early「まだ生っぽい」/ best「ちょうどいい！」/ overdone「焼きすぎた…」。**レシピ・標的に依存しない**（AC-12）。

### 4.2 UI（`CookingPrepLayer`）

- パン画面を開いた時刻を `performance.now()` で保持。進行表示は `requestAnimationFrame`（判定は rAF ではなく **押下イベントの `timeStamp`** で行い、描画の遅れが判定に入らない）。タイマーは時間切れ用に `setTimeout(TOTAL)` を 1 本（アンマウントで必ず clear）。
- 画面構成: 既存のパン画面に ①牛肉（時間で色が連続変化）②進行ゲージ・残り時間・ベスト帯は**表示しない**（Owner 決定 Q3。色と演出で見極める）③大きな「取り出す！」ボタン（高さ ≥ 56px、画面下寄り、親指で届く位置）④× は従来位置（取り出すボタンから ≥ 16px 離す）。
- 結果: 押下後に入力ロック → 結果ラベル＋ジュッ演出（~700ms、既存 `PREP_DONE_MS`）→ best は自動で閉じ「✓ 炒め済み」。early / overdone は **「もう一度炒める」「これで使う」** を表示（どちらも必須ではなく、× でも閉じられる＝進行不能なし）。「もう一度」は新しい START。
- `onPrep` の dispatch は「これで使う / best 確定」の 1 回のみ（既存の 1 回保証を維持）。
- 動きを減らす: 既存 `@media (prefers-reduced-motion: reduce)` に倣い、振る・湯気アニメ・ジュッ拡大を止める。**色変化と数値/ラベル表示は維持**（情報は色と文字で伝わる）。スクリーンリーダー向けは「進行中」「結果: …」のみ読み上げ、毎フレーム読み上げない。
- 画面離脱: blur / visibilitychange / 工程切替 / やり直しで破棄（#695 の挙動を継承。バックグラウンド中に時間が進んだ状態で復帰しない）。
- 誤タップ: pill の「離した位置で開始」・stage/dock の 300ms ガード・dock `inert` は維持。さらに `PAN_ARM_MS` と、結果表示中の全入力ロックを追加。
- viewport: 390×844 / 360×800 を優先。#695 の既知リスク（360×800 でピル↔生地 4.2px）は 1B で悪化させない（パン画面はピルのレイアウトに触れない）。

### 4.3 見た目（配置後のピース）

配置後の牛肉は、取り出した時点の色（early＝淡い、best＝炒め済み、overdone＝焦げ）で描画（色のみ。`bakeVisual.ts` 無変更・`PREP_HEAT_OFFSET=0` 維持）。Reference 見本・図鑑は生のまま（P-5/AC-17 維持）。

### 4.4 状態の持ち方（Owner 確認 Q4）

案 A（推奨）: `preparedIngredientIds` はそのまま、`PREP_INGREDIENT` に任意 `progress?: number` を足し、`preparedLook?: Readonly<Record<string, number>>`（transient・clamp 0..1・非有限は拒否）に保持。`RESET_PIZZA` / 新ラウンド / `pendingRound` 復元で消える（AC-5/7/19 と同じ行列で固定）。reducer の変更は `PREP_INGREDIENT` と型のみ。
案 B: reducer 無変更。結果色は GameScreen のローカル state。→ RESET・工程切替との同期漏れと、`PizzaStage` への新 prop が必要で、AC-5 の保証を UI 側で再実装することになるため非推奨。
案 C: 見た目は常に best 色（結果を配置後に反映しない）。最小変更だが「焼き加減が効いた」実感が弱い。

## 5. 変更ファイルと依存関係（実装時の見込み）

新規: `src/logic/prep/panDoneness.ts`、`panDoneness.test.ts`（境界・clamp・競合・二重入力・時計異常・property 的な全域 sweep）。
変更（**#695 の merge 後**）: `prepOffer.ts`（定数の置換）、`beefDoneness.ts`(+test)、`CookingPrepLayer.tsx`(+test)、`CookingPrep.css`、`GameScreen.CookingPrep.test.tsx`、`PizzaStage.CookingPrep.test.tsx`、`e2e/cooking-prep.spec.ts`、`cookPrepHv*.ts`（HV 入口の説明）、`TETO_COOKING-PREP_PHASE1_SPEC_*.md`（§3 / AC-3 / AC-13 の改訂）。
案 A のみ追加: `src/state/gameReducer.ts`（HOT。`PREP_INGREDIENT` と state 型）、`prepIngredient.*.test.ts`、`PizzaStage.tsx`（prop 1 つ）、`GameScreen.tsx`（受け渡し）。
不変の確認対象: `BeefSlices` / `IngredientGlyph.tsx` / `ingredients.ts` / `bakeVisual.ts` / `App.css` / 採点 / 在庫 / Dex / `persistence.ts` / `prepExperienceGate.ts`（**本番フラグ OFF のまま**）。

## 6. テスト・検証計画

1. **単体（先行）**: `gradeAt` の境界 2099→early / 2100→best / 4199→best / **4200→overdone** / 4201 / 5999 / 6000（自動終了）/ 6001・負・NaN・Infinity、`panReducer` の全遷移（ARM 内 TAKE 無視、二重 TAKE、時間切れ競合、CANCEL、finished 後の入力）、色の単調性とエンドポイント一致（progress=0 が `BEEF_RAW_COLORS` と同一）。
2. **既存の不変**: フラグ OFF の DOM 同一・parity（炒めあり/なしで pizza/score/completion/inventory 同一）・architecture test（scoring/discovery/hints が炒め状態を参照しない）・`pendingRound` 行列。
3. **結合**: fake timer で early / best / overdone / 時間切れ / × キャンセル / スキップ / blur 破棄 / 工程切替破棄 / 二重タップ / pill 誤爆（ARM 内）/ reduced-motion。
4. **全体**: 全 Vitest、`tsc -b`、`oxlint`、`npm run build`。
5. **E2E**: Chromium と WebKit の 390×844・360×800 の 2 画面。保存データの前後同一（localStorage スナップショット比較）・在庫・Dex・スコア不変。E2E は実時間依存で flaky になりやすいため、時間は `page.clock`（fake time）で進め、`sleep` 待ちに頼らない。
6. **HV**（CLAUDE.md / HV Policy）: 390×844 の動画（early / best / overdone / 時間切れ / キャンセル / スキップ / RESULT までを人間の速度で。リポジトリに commit せず Owner に直接提出）、before/after 画像を `docs/reports/screenshots/cooking-prep-1b/`、360×800 は固有の差が出た場合に追加。iPhone Safari 実機 HV は Owner 判定。
7. WebKit はローカル不可の可能性が高く、CI のシャードで確認（#695 と同じ）。

## 7. 残存リスク（現時点）

- 仕様変更（3 タップ→タイミング）が #695 の Owner 承認済み仕様を覆す点（Q1）。
- 4.2〜6.0 秒の判定が指示に無い（Q2）。
- ベスト帯 2.1〜4.2 秒（2.1 秒幅）は iPhone の指で十分取れるが、**ARM 300ms と合わせた体感は実機でしか確認できない**。定数は 1 か所（`panDoneness.ts`）に集約し HV で調整可能にする。
- 焦げ色・早取り色は暫定。
- E2E の時間依存（fake clock 前提）。`gameReducer.ts` は HOT file（案 A のみ）。
- #695 の最新 HEAD の Codex 結果と実機 HV が未了のため、#695 自体が修正を受ける可能性（1B はその後の最新 main で作るので影響は小さい）。

## 8. Owner 決定の記録（2026-10-29、Fresh Audit への回答）

| # | 決定 | 設計への反映 |
|---|---|---|
| **D1** | **PR #695 の Squash merge 後、最新 main から独立 PR を作成する。** #695 の最新状態は別セッションが確認する | §5 の「変更（#695 の merge 後）」を確定。**先行の純ロジック小 PR も作らない**（Owner は #695 の merge 待ちとし、runtime 実装・独立 PR 作成は未開始のまま）。案 B（#695 に積む）・案 C（#695 に直接追加）は不採用 |
| **Q1** | 3 タップ方式からタイミングゲーム方式への**仕様改訂を承認** | 仕様書 §3 / AC-3 / AC-13 の改訂を 1B PR に含める（本 docs-only 変更では仕様書本体は触らない） |
| **Q2** | **4.2〜6.0 秒は overdone** | §4.1 の解釈を確定: `BEST_START_MS <= t < BEST_END_MS` が best（半開区間）、`t >= BEST_END_MS` は overdone、`t >= PAN_TOTAL_MS` は時間切れ（overdone） |
| **Q3** | **ベスト帯・残り時間のゲージは表示しない**。牛肉の色・演出で判断させる | §4.2 の進行ゲージを**設けない**（時間切れも数値・バーで示さない）。スクリーンリーダー向けも残り時間や帯は読み上げない |
| **Q4** | **transient な `preparedLook` の追加を条件付き承認** | 案 A を採用。**条件: 保存・採点・在庫・Dex への影響は禁止。HOT file（`gameReducer.ts`）の変更は必要最小限**（`PREP_INGREDIENT` の任意 `progress` と transient な保持のみ）。保存・journal・`pendingRound` に出ないこと、採点・在庫・Dex・`completion` が不変なことをテストで固定（AC-3 の文言は「`preparedIngredientIds` と `preparedLook` 以外が同一」へ） |
| **Q5** | early / overdone では**「もう一度炒める」「これで使う」**を提供 | §4.2 の結果表示のとおり（best は自動確定。× でも閉じられ、進行不能なし） |

**初期仕様と調整:** ベスト帯 2.1〜4.2 秒・最大 6 秒・開始 300ms の入力抑止（`PAN_ARM_MS`）は**初期仕様**とし、**実機 HV で調整可能**にする（定数を `panDoneness.ts` の 1 か所に集約。調整は HV の結果に基づく）。

## 9. 現在の状態と未着手項目

- 完了: Fresh Audit・詳細設計・Owner 決定の反映（docs-only、本ファイルのみ）。
- **未着手（#695 の Squash merge 後に開始）:** `panDoneness.ts` と単体テスト、`beefDoneness` の 3 点補間、`CookingPrepLayer` の改修、`preparedLook`（reducer・`PizzaStage`・`GameScreen`）、既存テスト / E2E の改修、仕様書の改訂、HV 動画・比較画像、実機 HV、1B の claim 投稿、PR 作成。
- 開始前の確認事項（merge 後の最初の作業）: 最新 main の取り込み、#695 の merge 内容と本設計の差分（`PREP_TOSSES` 等の定数・テスト）の再確認、Duplicate Gate、#696 への claim（投稿済み）。
- 禁止（継続）: merge、本番フラグ ON、共有 Preview の更新、Monitor 作成、runtime 実装、PR 作成。
