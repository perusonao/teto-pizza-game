# Dough Kind P2 — `SELECT_DOUGH`・DOUGH ドックの選択チップ・Preview フラグ（Issue #577、本番では不活性）

Status: **実装済み・本番では不活性（チップの affordance が全プレイヤーで閉）。merge と共有 Preview 更新は Owner の確認待ち。P3 は HOLD。**
設計: `docs/design/TETO_DOUGH-KIND_PINSA_DETAILED-DESIGN.md` §2 / §6。基準 `main` = `818c10a`（P1 = #583 merge 後）。P1 の記録: `TETO_DOUGH-KIND_P1_Result.md`。

## Owner Decision（#577 のコメント 6284023246、2026-10-20）
| 項目 | 決定 | この実装での扱い |
|---|---|---|
| Q4 未発見時の文言 | 画面・aria-label とも「ふつうの生地」「ほかの生地」。画面と読み上げで同じ情報 | チップは**文字ラベル**を持ち、`aria-label` は同じ文字列（設計 §6.3 の「アイコンのみ」から Owner 決定で変更） |
| Q13 技法発見後 | 選択チップにも「ピンサ生地」を表示。**選択しただけでは正式名称を表示しない** | 2 つ目のチップの文言は「技法が台帳にあるか」だけで決まる（選択中かどうかは無関係）。選択しても名前は出ない |
| 漏らさない契約 | 未発見レシピとの対応・生の技法 ID を出さない | 生の ID・dough の値は DOM / `aria-*` / `data-*` のどこにも出ない（`data-dough-choice="plain"\|"other"`） |
| P3 | HOLD | 未着手。Pinsa レシピ・ladder・RESULT 行は入れていない |

## 変更
| ファイル | 内容 |
|---|---|
| `src/state/doughSelection.ts`（新規） | `doughSwitchOffered`（FREE_COOK ∧ DOUGH ∧ 当該技法の affordance 開 ∧ レシピが生地を固定していない）、`pizzaWithDough`（標準に戻すとキーを削除＝未選択と deep-equal） |
| `src/logic/techniques/doughSwitch.ts`（新規） | `isDoughAffordanceOpen`（技法 `dough-pinsa-romana` 自身の affordance。天板の affordance とは独立）、`isDoughSwitchVisible`、`doughChipOtherLabel`（台帳→2 つ目のチップの文言） |
| `src/state/gameReducer.ts` | `SELECT_DOUGH { dough }`（`SELECT_PAN` の直後に case を 1 つ）。**`pizza.dough` だけ**を書き、`pan` / `doughShape` / `squareDough` / `cookingProfile` / `cutState` に触れない。offered でなければ no-op（同一 state を返す） |
| `src/components/DoughKindSwitch.tsx`（新規） | `PanSwitch` とは別の radiogroup「生地の種類」。44px 以上のタップ領域、`aria-checked`、アイコン（実線の円／破線の円。意味を持たない形） |
| `src/screens/GameScreen.tsx`, `src/App.tsx` | 描画と dispatch。**画面は生の台帳を読まない**（`techniques.tq1c.test.ts` T20 を緩めず、App が文言を計算して prop で渡す） |
| `src/App.css`（末尾追記のみ） | チップ、および両方開のとき 1 行に並べるための `.dock-switch-row`（ドックを伸ばさず、ピザが動かない） |
| `src/preview/doughKindPreview.ts`（新規）, `PreviewBadge.tsx` | `?doughSwitch=open`（Preview / DEV 限定。本番バンドルに含まれない）。バッジに `· DOUGH chips open` |
| 変更なし | 採点、経済、保存形式、CUT、`matcher.ts`、`TechniqueReveal`、Hint / Research、P1 のデータ（技法・軸）、`PanSwitch` |

## 設計との差分と判断
* **ラベルは文字**（設計 §6.3 は「アイコンのみ」。Owner Q4 が「画面・aria-label とも」と決めたので文字ラベルにした。アイコンは補助で、両方開のときは省略）。
* **1 行に並べる**: 両方開のときに 2 行にするとドックが 70px → 120px になりピザが縮む（最初の E2E で実測。360×800 で 552 → 502）。`PanSwitch` は変更せず、**両方開のときだけ**ラッパー（`.dock-switch-row`）で 1 行にし、○/□ は 44px、チップは 12px の文字のみにした。どちらか片方だけ開のとき、また閉のときの DOM は従来と同一。
* 技法を発見したあと、2 つ目のチップが「ピンサ生地」と出るのは、**その技法を使って発見した（または Pinsa を発見した）プレイヤーだけ**。Pinsa レシピが無い本番では技法を発見できないので、この文言が出る経路は P3 まで無い（Preview の保存データで再現）。

## 検証
* 全 Vitest: **489 files passed / 1 skipped、9031 tests passed**（2 skipped・6 todo は既存、failed 0）。`npm run build`（`tsc -b` + `vite build`）通過。`oxlint`: 触ったファイルへの指摘なし。
* 単体: `gameReducer.selectDough.test.ts`（本番では no-op／`pizza.dough` だけを書く／`SELECT_PAN` と互いに不変（PK-6）／`effectivePanShape` 同一（PK-7）／「次へ」後・RESET・Guided・ORDER・Lunch Rush で no-op）、`doughSwitch.test.ts`（本番では全 Dex で閉／天板の affordance と独立／表示条件／ラベル）、`DoughKindSwitch.test.tsx`（文字と aria-label が同じ・選択しても名前は出ない・発見後は「ピンサ生地」・生の ID や dough の値が DOM に出ない）、`doughKindPreview.test.ts`、`doughKindPreview.gate.test.ts`（**本番バンドルにフラグ名・マーカーが無く、Preview バンドルにはある**＝実ビルド）。
* E2E（390×844 / 360×800 の両方、14 件）: `e2e/dough-kind-chips-p2.spec.ts` — 閉では DOM に無い／開で 44px 以上・viewport 内・ピザと「次へ」に重ならず**ピザの位置・大きさが閉と同一**／両方開で 1 行・重ならない・横スクロールなし・ピザ不動／選択しても「ピンサ」が出ない／発見済みの保存で「ピンサ生地」（未選択・選択とも）／○/□ とチップの独立／「次へ」で消える・Guided では出ない。既存の `pan-switch-f4b.spec.ts` と `layout-contract.spec.ts`（layout-chromium）も通過（合計 38 件）。
* **途中で見つかった問題**: 最初の実装は両方開のときチップを 2 行にしており、ドックが 70px → 120px に伸びてピザが縮んだ（360×800 で 552 → 502）。E2E の「ピザが動かない」で検出し、両方開のときだけ 1 行にまとめて解消した。
* 競合確認: `git merge-tree` で #584 / #581 / #582 の各 head と衝突なし。#478（draft・古い履歴）は `GameScreen.tsx` を触るので、先に merge された側へ後の側が base を merge する（claim に記載）。
* WebKit・全体 E2E は PR の CI で確認（ローカルに WebKit なし）。

## HV（Human Verification）— 確認用素材
動画は repository に commit しない（`artifacts/review/` は gitignore 済み。セッション内でユーザーへ直接提出）。
* **動画**: `artifacts/review/dough-kind-p2-chips-390x844.mp4`（H.264 / 390×844 / 24.0 秒 / 約 267 KB）。内容: ① 本番相当（チップなし）→ ② `?doughSwitch=open&panSwitch=open`（「ふつうの生地」「ほかの生地」と ○/□ が 1 行）→「ほかの生地」を選択（名前は出ない）→ □ → ○ → 「ふつうの生地」→ ③ 技法発見済みの保存で「ピンサ生地」の表示（未選択・選択）→ ④ 生地を伸ばして「次へ」→ SAUCE でチップが消える。
* **スクリーンショット**（390×844 / 360×800、`docs/reports/screenshots/dough-kind-p2/`）:
  * `before/…dough-dock-closed.png`: 本番相当（閉）。P2 前と同じ。
  * `after/…open-plain.png` / `open-other-selected.png`: チップのみ開、「ふつうの生地」選択／「ほかの生地」選択。
  * `after/…both-open.png` / `both-square-other.png`: ○/□ とチップが 1 行（□ ＋ 「ほかの生地」の組み合わせを含む）。
  * `after/…discovered-unselected.png` / `discovered-selected.png`: 技法発見後の「ピンサ生地」（未選択・選択）。
* **実機確認（Owner）**: iPhone Safari での 360〜390px 幅のタップ感・読み上げ（VoiceOver で「ふつうの生地」「ほかの生地」）。この環境では未実施（Chromium のみ。WebKit は CI で実行）。

## 未決・次
* P3（Pinsa の有効化）は **HOLD**: pizzadb.jp の原典確認（PK-0）、Q5〜Q8（RESULT の中立行、`ladderCredit` / `lunchRush` / 章の件数、コホート文字と validator 例外、個数・bake）。未回答を承認済みとして扱わない。
* P2 の merge と共有 Preview 更新は、Owner の別の確認時点で扱う。
