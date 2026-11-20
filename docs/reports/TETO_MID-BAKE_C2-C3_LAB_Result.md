# MID_BAKE C-2（独立 Lab 画面）・C-3（E2E）Result Report

Issue #795 ／ 作成: 2026-11-12 ／ 基準 `main` `4314ca2` ／ Production OFF・未配線・Draft 運用（merge・Production ON・共有 Preview 更新なし）
claim: Issue #795 コメント 6825109936（`:c2` / `:c3`）。`Depends-on: #829`（C-1 `labClock`）、#827（段階C設計）。

## 1. 変更内容

| 区分 | ファイル（すべて新規。既存の変更は下の「共有箇所」のみ） |
|---|---|
| C-1 再利用 | `src/logic/midBake/labClock*.ts` は #829 の commit を本ブランチへ cherry-pick（#829 のブランチは無変更） |
| 食材別の操作登録簿 | `src/components/midBakeLab/labIngredients.ts` |
| 純粋セッション（時計＋エンジン＋ログ） | `src/components/midBakeLab/labSession.ts` |
| Lab 画面・CSS | `MidBakeLab.tsx`、`midBakeLab.css`（`App.css` は触らない） |
| 入口 | `src/preview/midBakeLab.ts`（`?dev=midbake`、`scenario=`、`hold=`） |
| テスト | `labSession.test.ts`（12）、`MidBakeLab.test.tsx`（5）、`labArchitecture.test.ts`（5）、`e2e/mid-bake-lab.spec.ts`（7 本×2 viewport） |

共有箇所の追記（HOT ではないが複数 PR が触る）: `src/main.tsx`（`midBakeLabRequested` の 1 条件＋1 動的 import。#738・#746 と同じ領域。後から merge する側が取り込む）、`src/preview/previewIsolation.gate.test.ts`（`"mid-bake-lab-v1"` を 1 行）、`src/devtools/devtoolsAccess.test.ts`（既存の正規表現に `&& !midBakeLabRequested` を追加。検査は同じ強さ）。
`gameReducer.ts`・`GameScreen.tsx`・`PizzaStage.tsx`・`App.tsx`・`App.css`・catalog・golden・実セーブ・`e2e/support/**`・`playwright.config.ts` は変更していない。

## 2. 設計（食材別の配置操作を拡張できる構造）

- 食材は `LabIngredientSpec` 1 件（個数・`requiredState`・提供する操作 `ops`）。セッションと画面は食材名を一切書かない。次の食材（french-fries＝`requiredState: "fried"`、ドラッグ操作＝#478 の後）は登録簿に 1 件足すだけで、`labSession.test.ts` に「別食材でもセッション変更なし」で通る回帰がある。
- 操作（tap／alternative）は入力方法であり結果ではない。すべて同じエンジン `ADD` に解決し、違いは `input` のみ（テストで追加内容・時計が同一であることを固定）。
- 追加を受け付けるのは時計が停止している間だけ（トレイもその間だけ有効）。再開後の窓（〜90%）はエンジンの安全網にとどめる。停止中は `now === lastAt` の ADD（エンジン契約）。エンジンの `now` は能動時間の**ミリ秒**。
- 画面はタブ非表示・フォーカス喪失で時計と停止タイムアウトを止める（回は破棄しない）。再読み込みはメモリ上の Lab のため回が消える（実セーブに触れない: E2E で `localStorage` が空であることを確認）。
- ログ（画面下）: 受理／拒否（理由別）、入力別、停止の能動時間、終了の理由、結果。停止タイムアウト 6 秒は **Lab 検証用の暫定値**（`hold=` で短縮可。Production 仕様ではない）。

## 3. 検証結果

| 項目 | 結果 |
|---|---|
| 型（`tsc -b`） | クリーン |
| lint（`npm run lint`） | 新規ファイルの警告なし |
| MID_BAKE／Lab／main 関連 vitest | 全件成功（midBake・components/midBakeLab・devtools・dev・previewIsolation） |
| 全 vitest | 12287 passed、失敗 0（§5） |
| E2E（Chromium、390×844・360×800） | 7 本 ×2 viewport、`--repeat-each=2` で 28/28 成功（実時間。針が 65% で停止・停止中は不動・2 タップで再開し complete・「とじる」で missing・タイムアウトで再開・代替操作が同結果・スクロールなし／タップ 44px 以上・localStorage 空） |
| WebKit | **ローカル未実施**（この環境の Playwright は WebKit を持たない）。CI の WebKit shard の結果を最新 HEAD で確認する |
| 本番バンドル | 入口名・マークが本番に残らないことは `previewIsolation.gate.test.ts`（`"mid-bake-lab-v1"` 追記）で検証 |
| Codex 独立レビュー | `48aaa4b` に P2 1 件（非表示・フォーカス喪失で rAF が止まると基準時刻が残る）。`visibilitychange`／`blur`／`focus` でリセットするよう修正し、修正前に失敗・修正後に成功する回帰テストを追加。最新 HEAD で再レビューを依頼する（§8） |

初回の E2E で `hold=800` のタイムアウト検査が、`expect` のポーリング間隔より停止が短く不安定だった。アサーションを緩めず、停止を `hold=2500` に伸ばして実際の停止を観測できるようにした（`--repeat-each=2` で安定を確認）。

## 4. Human Verification（HV）成果物

- 動画（390×844、H.264 MP4、約 26 秒、リポジトリには commit しない）: ラウンド A＝通常タップで成功、B＝「とじる」で取り逃し、C＝代替操作で成功。Owner へ直接提出。
- スクリーンショット（commit 済み）: `docs/reports/screenshots/mid-bake-lab-c2/01-running.png` ほか 5 枚。新規画面のため before はなし（after のみ）。
- 合否の言葉は Owner のもの。iPhone Safari 実機での手触り（10 回中 8 回成功など、段階C §4 の暫定基準）は未実施。入口の公開・Preview 更新は別途 Owner 承認。

## 5. 全 vitest

`npx vitest run`: Test Files 663 passed / 2 skipped（665）、Tests 12287 passed / 14 skipped / 2 todo。失敗 0。

## 6. 競合・前提・未了

- 入口は `?dev=midbake` で **Owner が確定**（2026-11-12）。(b)（実ゲーム接続）は HOT 変更を要し #738 と競合するため採らない。入口名の変更は `src/preview/midBakeLab.ts` と `main.tsx` の 1 行。
- `src/main.tsx` は #738・#746 も変更する。merge 順の調整が必要（後から merge する側が取り込む）。
- #829（C-1）が先に merge されると本ブランチの cherry-pick は重複として解消される。#829 が変更される場合は本ブランチで取り込み直す。
- 段階D（実ゲーム接続）、natto 以外の食材、ドラッグ、代替操作 UI の本実装（#784）は未着手・別承認。

## 7. 件数（#780、毎回再集計）

カタログは #815 以降 `main` で変わっていない（`recipes.ts`・`ingredients.ts`・late catalog の変更なし）。件数は #780 コメント 6794857448（Batch 23-b Result）の値。

| ライン | 実装済み | 目標 | 残 | 進捗率 |
|---|---|---|---|---|
| レシピ | 104 | 177 | 73 | 58.8% |
| 食材 | 122 | 170 | 48 | 71.8% |
| 調理法 | 7 | 27 | 20 | 25.9% |

本タスクは調理法ライン（MID_BAKE）の検証基盤で、レシピ・食材の件数は変えない（natto-pizza の catalog 昇格は別タスク）。

## 8. 重複・競合調査と merge 順の提案（2026-11-12、PR #834 作成後に確認）

### 8.1 重複 PR（他セッション、無変更）
| PR | 内容 | #834 との関係 |
|---|---|---|
| #830 | C-2 の別実装。入口 `?cookMidBakeHv=1`、食材別の配置戦略 `PLACEMENT_STRATEGIES`、在庫の代用、誤取り出し計測 | `src/components/midBakeLab/{MidBakeLab.tsx,labSession.ts,midBakeLab.css,*.test.*}`・`src/preview/midBakeLab.ts`・`src/main.tsx`・`labClock*` が**同じパスで内容違い** |
| #832 | C-3 の E2E（`e2e/mid-bake-lab.spec.ts`・`mid-bake-lab-regression.spec.ts`）。#830 の上に積まれている | `e2e/mid-bake-lab.spec.ts` が**同名で内容違い** |

両方を merge すると必ず競合し、内容の統合が必要になる。入口名は Owner 確定の `?dev=midbake` で、#830 の `?cookMidBakeHv=1` と食い違う。**どの実装を採用するかは Owner 判断**（本 PR は #830・#832 を変更しない）。本作業の claim 確認は着手前に 1 度だけで、claim 投稿の直前に再確認しなかったことが重複の原因。

### 8.2 `src/main.tsx` の競合（open PR のブランチ差分を確認）
| PR | `main.tsx` への追記 | #834 との競合 |
|---|---|---|
| #738 | import 1 行＋`activateCookSteamHv(window)` | 別の領域（seed 前の HV 入口）。自動 merge できる |
| #746 | import、`drizzleLabRequested`、**seed 条件 2 か所に `&& !drizzleLabRequested`**、先頭の `if (drizzleLabRequested)` 分岐 | **seed 条件の同じ 2 行**でテキスト競合。両方の `&& !…Requested` を並べれば解消（trivial） |
| #830 | 同様に import・要求判定・`else if` | #834 と排他（同じ役割） |

`src/devtools/devtoolsAccess.test.ts` の正規表現（seed 条件の検査）は #746・#834・#830 が同じ行を変更するため、同様に後から merge する側が `&& !…Requested` を並べて取り込む。

### 8.3 提案する merge 順（merge は Owner のみ）
1. **#829（C-1）**: #830・#832・#834 すべての前提。
2. **Lab 実装を 1 本に決める**（Owner 判断）。`?dev=midbake` 確定なら #834 を採用し、#830・#832 は閉じるか #834 の上へ再構成（#830 の配置戦略・在庫代用・誤取り出し計測は #834 へ移植する価値がある）。#830 を採用する場合は入口名を `?dev=midbake` へ変更し、#834 は閉じる。#832 の E2E は採用した実装の data-testid に合わせる。
3. **#738・#746**: 技術的にどちらが先でもよい。後から merge する側が `main.tsx`（と `devtoolsAccess.test.ts`）を取り込む。#746 と Lab は seed 条件の同じ 2 行を触るため、この 2 つの間でだけ手作業が要る。
4. **#827（docs）**: 独立。いつでもよい。
5. #823 は 2026-11-12 に main へ merge 済み（`6df4748`）。#834 は merge で取り込み済み（ファイルの重なり 0）。

## 9. 先行 PR の読み取り確認（2026-11-12、変更なし）

| PR | HEAD | CI | Codex | 未解決スレッド | 依存・base |
|---|---|---|---|---|---|
| #827（docs） | `2c016a8` | build・classify・Layout Contract Gate・WebKit Gate success（docs-only のため layout-chromium と WebKit shard は skipped） | 受領あり（`2c016a8`、major issue なし） | 0（4 件すべて resolved） | base `4314ca2`（main は `cf0c865` に進行）。他 PR への依存なし |
| #829（C-1） | `e59dcf8` | 11 件すべて success（WebKit 6 shard 含む） | 受領あり（`e59dcf8`、major issue なし） | 0（指摘なし） | base `4314ca2`。他 PR への依存なし。**#834 の `labClock*.ts` は #829 の commit と内容が同一**（差分 0 を確認）ため、#829 が先に merge されても #834 側の競合は出ない |
| #834（本 PR） | `c2fabe3`（コード）。本節の docs 追記で HEAD が進む | `c2fabe3` で 11 件すべて success（WebKit 6 shard・Layout Contract Gate・WebKit Gate 含む） | `c2fabe3` で指摘 0（受領あり）。docs 追記後の HEAD は再依頼する（Codex は現 HEAD のみ対象） | 0 | `Depends-on: #829, #827`。main `cf0c865` との merge-tree は clean |

#827・#829 は merge 未承認。いずれも main（`cf0c865`、#823・#831 を含む）より古い base だが、ファイルの重なりはない（#827 は新規 docs 4 本、#829 は新規 2 ファイル）。

## 10. #832 から #834 へ移植するか — E2E ケースの分類（コードは未変更）

方針: #830/#832 の一括移植はしない（Owner 判断）。ここでは**必要性**と**既存仕様（段階C 設計・判断表）との一致**だけで分類する。#832 は #830 の画面（`?cookMidBakeHv=1`、`mb-*` の testid、取り出し・在庫代用・開始ボタンあり）を前提にしているため、移植には #834 の画面に合わせた書き直しが要る。

### 10.1 通常 BAKE の回帰 spec（`e2e/mid-bake-lab-regression.spec.ts`）
| ケース | 必要性 | 仕様との一致 | 分類 |
|---|---|---|---|
| 通常 BAKE の針が 65 を止まらずに通過し、3 秒で 100 に達する（仮想時計で決定的） | **高**: 段階C §4 のラウンド C（回帰）そのもの。Lab が通常 BAKE を変えないことの唯一の自動証拠 | 一致。Lab に依存しない（通常ゲームのみ、`e2e/support/**` は読み取りのみ） | **移植推奨**（Lab 固有の `mb-lab` アサーションだけ #834 の `data-mid-bake-lab` へ差し替え） |
| 通常の取り出しが 65 付近で効く | 中: 取り出しを Lab が奪わないことの確認 | 一致 | 移植推奨（同上、`mb-takeout` を差し替え） |

### 10.2 Lab の spec（`e2e/mid-bake-lab.spec.ts`）
| #832 のケース | #834 の現状 | 必要性 | 仕様との一致 | 分類 |
|---|---|---|---|---|
| 針が 65 で止まり、停止中は動かない | 同等あり | — | 一致 | 移植不要（済） |
| 2 タップで再開し complete | 同等あり（実時間） | 仮想時計による**決定的な位置検証**は価値あり（実時間は CI で揺れうる） | 一致 | **仮想時計の技法のみ移植**（任意・中） |
| 「とじる」で取り逃し | あり（1 個追加後）。**0 個で閉じる**は未 | 低 | 一致 | 小さく追加可（低） |
| タイムアウトで再開 | あり | — | 一致（暫定 6 秒） | 移植不要（済） |
| 代替操作は既定で折りたたみ、同じ ADD | 同等あり。**既定で折りたたみ**の断言は未 | 低 | 一致（#784 の方針） | 小さく追加可（低） |
| もう一度で新しい回 | E2E 未（単体テストにあり） | 中 | 一致 | **追加推奨**（中） |
| 保存に何も書かない（回の最後まで） | あり（1 タップ後）。**回の最後まで**は未 | 中 | 一致（Lab は実セーブに触れない） | 拡張推奨（中） |
| クエリなし／誤値／他の dev 入口と併記で Lab が出ない | 未（vitest の静的検査のみ） | **中〜高**: 本番に入口が漏れない・他入口と同時に動かない | 一致 | **追加推奨**（`?dev=midbake` 版に書き換え） |
| 短い viewport（390×664・360×640）で主要操作が画面内 | 未（390×844・360×800 のみ） | 中: HV 方針（iPhone の短い高さ） | 一致 | 追加検討（中） |
| **取り出しは停止中は拒否** | **Lab に取り出しがない**（#834 は取り出しなしで焼き上がりまで進む） | 判断表 D1 の推奨「停止中の取り出しを無効化」の検証 | 段階C §3 は「誤タップ防止のため無効化」。ただし #834 に取り出し UI 自体がない | **Owner 判断**（Lab に取り出しを足すか。足すなら本 PR の後続で） |
| **代用在庫 1 個で 1 回だけ追加、以降は拒否** | **Lab に在庫の代用がない** | 判断表 Q9／§11「在庫」項目の検証 | Q9 は「既存の在庫方式を優先、予約は新設しない」。Lab 内の代用在庫がその検証手段になるかは未決 | **Owner 判断**（代用在庫を #834 に足すか。#830 の `cookMidBakeStock` をどう扱うか） |

### 10.3 まとめ
- 移植推奨: 通常 BAKE の回帰 spec（2 本）、クエリのゲーティング（否定系）、「もう一度」、保存に書かない（回の最後まで）。
- 仮想時計は決定性のための技法として任意。短い viewport は中。
- Owner 判断が要る: Lab に**取り出し**と**代用在庫**を足すか（どちらも #834 の現行機能にない）。
- 一括移植はしない。着手は Owner の指示後、別 claim で最小の追加として行う。

## 11. iPhone Safari HV（Owner 実施）の手順と判定表

合否の言葉（PASS／FAIL／waived）は Owner のもの。本節は手順であり、結果は書かない。動画・スクリーンショットは §4 のとおり（Playwright／Chromium の 390×844 による**エミュレーション**で、実機ではない）。

### 11.1 URL
- 入口は `?dev=midbake`（DEV／Preview ビルドのみ。本番では開かない）。
- **PR 専用 HV ページが必要。** 形は既存の先例（`https://perusonao.github.io/teto-pizza-game-preview/pr/pr-<PR 番号>-<commit 7 桁>/`）に倣うと `…/pr/pr-834-<HEAD の 7 桁>/?dev=midbake`。**このページの公開は Owner 承認が必要で、本セッションは公開していない**（共有 Preview の更新は禁止）。承認後に対象 HEAD の 7 桁を確定する。
- 端末ローカルで見る場合は `npm run dev` の `…/teto-pizza-game/?dev=midbake`。
- 任意の調整: `&hold=<ms>`（停止タイムアウト、500〜60000。既定 6000 は**暫定値**）、`&scenario=natto`。

### 11.2 手順と判定表
| ID | 操作 | 期待 | 判定（Owner） | メモ |
|---|---|---|---|---|
| H0 | URL を開く | 見出し「MID_BAKE Lab（検証用…）」、ゲージ、トレイは押せない、ページスクロールなし | | |
| H1（ラウンド A） | 待つ → 針が止まったら「なっとう」を 2 回タップ。10 回繰り返す（「もう一度」） | 針が窓の入口（黄色の帯の左端、約 65%）で止まる。「とまった！」と残り秒が出る。2/2 で自動再開し「成功」。**10 回中 8 回以上が代替操作なしで成功**（暫定基準） | | 成功 /10 |
| H2 | 止まっている間、針が動かない・トレイが押せる／止まっていない間は押せない | 止まっている間だけ押せる | | |
| H3（ラウンド B） | 「代替操作（確認用）」を開き、代替ボタンで 2 回追加 | 結果は H1 と同じ。ログの `alternative 2` | | |
| H4 | 1 回だけ追加して「とじる」 | 再開し「取り逃し」。ログ `released=closed` | | |
| H5 | 何もせず約 6 秒待つ | 自動で再開し「取り逃し」。トレイは閉じたまま。ログ `released=timeout` | | |
| H6（中断・バックグラウンド） | 止まっている間にホームへ戻る／画面ロックを約 10 秒 → 戻る | 同じ停止状態から続く。**停止の残り時間が背景中に減らない**。追加できる | | `c2fabe3` の修正（Codex P2）の実機確認 |
| H7（中断・再読み込み） | 止まっている間にページを再読み込み | 新しい回から始まる（追加済みは残らない）。通常ゲームのセーブは無傷（通常 URL で確認） | | |
| H8（ラウンド C・回帰） | Lab ではなく通常ゲームで BAKE する | 針は 65 を止まらずに通過し、通常どおり取り出せる（自動確認は #832 の回帰 spec の移植案を参照） | | |
| H9 | 指の大きさでタップしやすいか、文字が読めるか | 主要ボタンは 44px 以上、誤タップが起きない | | |

結果に「FAIL」が出た場合は、ID・画面の状態・ログ欄の文字列を記録して報告する（ログ欄は HV の記録用）。

## 12. merge 順序と、それぞれの再検証条件（merge はすべて Owner 承認待ち）

| 順 | PR | 先に必要な条件 | merge 直前の再検証 | merge 後の再検証 |
|---|---|---|---|---|
| 1 | #829（C-1） | Owner 承認 | 最新 HEAD の CI 全件・Codex（現 HEAD）・スレッド 0・base が main から遅れている場合は merge で取り込み（rebase しない） | main で `src/logic/midBake` の vitest と tsc |
| 2 | #827（docs、独立） | Owner 承認 | 最新 HEAD の Codex・スレッド 0。docs-only のため WebKit は skipped が正 | なし（docs のみ） |
| 3 | #834（Lab） | #829 が merge 済み（`Depends-on`）、iPhone HV の結果（Owner） | **HEAD が変わっていないこと**（レビュー済みの HEAD と一致、変わったら停止）。CI 11 件・WebKit 6 shard・Codex（現 HEAD）・スレッド 0。#829 取り込み後に `labClock*` の差分が 0 のままであること。`src/main.tsx` と `devtoolsAccess.test.ts` を #738／#746 が先に変更していれば merge で取り込み、`&& !…Requested` を並べる | main で全 vitest・E2E（mid-bake-lab）・`previewIsolation.gate.test.ts`（入口が本番バンドルに残らない）|
| — | #738・#746 | 順不同。後に merge する側が `main.tsx` を取り込む | 各自の再検証 | #746 と #834 は seed 条件の同じ 2 行を触るため、後から merge する側は手作業の取り込み |
| — | #830・#832 | **merge しない**（Owner 判断） | — | #832 の有用なケースは §10 の分類に従い、必要なものだけ別の小さな変更で移植 |

Production ON・共有 Preview の更新・PR 専用 HV ページの公開は、いずれも別途 Owner 承認。

## 13. Owner 判断が必要な項目
1. **PR 専用 HV ページの公開**（`pr/pr-834-<sha7>/`）。承認があれば対象 HEAD で公開手順を依頼（本セッションは公開しない）。
2. **#832 から移植するケース**（§10.3 の推奨で足りるか）と、移植の着手許可。
3. **Lab に取り出しを足すか**、**代用在庫を足すか**（§10.2。どちらも現行の #834 にない）。
4. #829・#827・#834 の merge 順（§12）と、それぞれの merge 承認（現時点は未承認）。
5. iPhone Safari HV の実施日と、結果の記録（§11、判定の言葉は Owner）。
