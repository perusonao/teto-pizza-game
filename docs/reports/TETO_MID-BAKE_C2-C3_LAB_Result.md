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
