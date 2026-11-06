# Steam #738 — 更新準備 Rev 2（main `3a41bb64` 基準、docs-only）

作成: 2026-11-06（UTC 約 14:58）/ 基準 `origin/main` = `3a41bb64a7d704ca33fd0ab9aa5ba582a755f8bb`（#769 の Squash merge、2026-11-06T14:49:28Z）/ ブランチ `claude/teto-cooking-methods-audit-ku35ki`
前版: `TETO_COOKING-STEAM_738_Update-Prep-Plan.md`（以下 Rev 1）。本書は **差分と、Rev 1 §4 の実行順の更新**のみ。HV 手順は `TETO_COOKING-STEAM_S4_iPhone-HV_Minimal-Procedure.md`（変更なし）。
性質: 読み取りと使い捨て worktree での検証のみ。PR への push・merge・Production ON・共有 Preview の更新と復元・claim の変更・GitHub への投稿は**していない**（§5 の依頼文は下書きで未送信）。
読んだ規則: `CLAUDE.md`（全文）、`docs/PROJECT_HANDOFF.md`（行数 1147、`New-session startup checklist`〔L1106〕）。HANDOFF の最終更新は main 上 `d85b9575`（#651）で、**FRY・STEAM・#738 の記載は無い**（grep）。startup checklist の「fresh GitHub state を権威とする」に従い、本書は GitHub と実コードを根拠にした。

---

## 0. 結論（先に）

1. **「#753 と #738 が `mergeable=false`」は、今の GitHub では再現しなかった**【実測】。2026-11-06T14:52Z に取得した両 PR の `mergeable_state` は **`clean`**。使い捨て worktree で `origin/main`（`3a41bb64`）に対して実際に merge しても、**#738 単独・#753 単独・#753＋#738 の同時、いずれも conflict なし**。**原因として確認できたものは無く、修正は不要**と判断する（§2）。ただし、この取得手段は `mergeable_state` しか返さず、`mergeable`（真偽値）そのものは見えない【限界】。
2. **#738 の実行コードは前回検証したものと同一**。`785d795..3a41bb6` の差分は docs 3 ＋ JSON 1 のみで、`src/`・`e2e/`・`scripts/`・`.github/`・`package*.json`・各 config の差分は**空**【実測】。したがって前回のローカル検証（tsc 0 エラー、Vitest 262＋81 件、build、Chromium E2E 30＋55＋30）は `3a41bb64` にそのまま当てはまる（§3）。
3. **#726 の S3 claim は未更新**【実測】。失効まで **約 3 日 9 時間**（2026-11-10 00:00 UTC）。担当セッション向けの依頼文を §5 に更新した。
4. **main の Deploy は success、WebKit E2E は未完了**（§6）。#769 は docs＋JSON のみなので、直前の `785d795`（WebKit success）と実行コードが同一であり、**緑になる見込みが高い**が、**結果が出るまで確定しない**。
5. **#753 の merge は #738 の更新をブロックしない**（§4）。docs-only で #738 の 110 ファイルと重ならず、merge 順は不問。

---

## 1. Fresh Audit

| 項目 | 結果【実測】 |
|---|---|
| main | `3a41bb64`（#769）。直前は `785d795`（#759）。差分は新規 4 ファイル（Batch 19 Prep・R2 Owner 決定記録・実装前 Fresh Audit・jaccard.json）のみ |
| #769 | **merged**（2026-11-06T14:49:29Z、merged_by `perusonao`） |
| #753 | HEAD `ed0d1916`（変化なし）、open、non-draft、`mergeable_state: clean`、base は古い `5d54bf27`（main に 8 commit 遅れ、4 commit 先行）。docs 20＋追記 1 ファイル（追加 19／変更 2）。CI は 11/4 時点で緑、Codex 指摘 0、thread 0（前回確認） |
| #738 | HEAD `2ac98201`（変化なし）、open、non-draft、`mergeable_state: clean`、main に **16 commit 遅れ**、10 commit 先行、110 ファイル |
| 競合ファイル | #738 の差分と main の差分（`merge-base` `49e2add` 以降）の**共通ファイルは 0**。#753 と main の共通も 0 |
| open PR | #763・#762・#757・#756・#738・#753・#751・#747・#746 は 11/5 以前の更新で、HEAD は前回と同じ |
| claim（#726 S3） | 更新コメントなし（#726 のコメントは 5 件のまま）。`expires 2026-11-10T00:00:00Z` |
| 共有 Preview | #756 `8dfca29`（commit `8ffc141`、前回確認から変化なし。本ターンでは README を再読していない【未再確認】 — 配備の直前に再読する） |

---

## 2. #753・#738 の `mergeable=false` の原因調査

### 2.1 確認したこと
| 確認 | 結果 |
|---|---|
| GitHub の `mergeable_state`（14:52Z、`pull_request_read get`） | #753 `clean`、#738 `clean` |
| `git merge-tree --write-tree`（`3a41bb64` ＋ 各 PR HEAD） | 両方とも tree を返し、conflict ファイルの列挙なし |
| 使い捨て worktree で実際に merge（`--no-commit`） | #738: 自動成功（110 files changed）、#753: 自動成功（21 files changed）、**#753 のあとに #738**: 自動成功。conflict ファイル 0 |
| #753 に特有の要因 | 削除ファイルなし（追加 19／変更 2）。変更 2 のうち `STYLE-LOCK-V2.md`（追記）・`ingredient-icons-2.0/README.md`（追記）は、main 側で同じファイルが変わっていない（`merge-base` 以降の共通 0）。`merge main` commit を含む 4 commit。巨大ファイルなし（最大 `metrics.json` 249 行） |

### 2.2 考えられる原因（確認できたものではなく、可能性の整理）
1. **mergeability の再計算中だった**【最有力、推論】: GitHub は base が動くと各 PR の `mergeable` を**遅延再計算**し、その間は `null`／`unknown`（`mergeable_state: unknown`）になる。#769 の merge（14:49:28Z）の**直後**に取得された値なら、再計算前の途中値を `false`／未確定として見た可能性がある。実際、本セッションが #753・#738 を最初に取得したときも `unknown` だった。
2. **ブランチ保護の「up-to-date」要求**: 要求されていれば `mergeable_state` は `behind` になる（`false` ではない）。#753 は main に 8 commit 遅れ、#738 は 16 commit 遅れだが、**14:52Z の値は `clean`** で、`behind` ではなかった。→ 現状この要求は効いていないように見える【推論】。
3. **本当の conflict**: 上の実 merge で否定された（`3a41bb64` に対して）。

### 2.3 判断
- **修正は不要**（#753 に push する必要も無い）。#753 は docs-only で内容が独立しており、conflict は存在しない。
- **持続する場合の確認手順**（Owner 向け）: ①PR のページを開く（開くと GitHub が再計算する）、②それでも conflict 表示なら**表示されているファイル名**を教えてもらう（本調査では該当ファイルが存在しない）、③その時点の `main` SHA を記録。
- 限界: ①本セッションの取得手段は `mergeable`（真偽値）を返さない。②Owner が見た画面の時刻・値は未確認【未確認】。

---

## 3. #738 の最新 main（`3a41bb64`）との再検証（使い捨て worktree、push なし、検証後に削除）

| 項目 | 結果 |
|---|---|
| 実行コードの差 | `785d7956` → `3a41bb64` で `src/ e2e/ scripts/ .github/ package.json package-lock.json playwright.config.ts vite.config.ts` の差分**なし**（`git diff --stat` が空） |
| merge | #738 → 自動成功、conflict 0（110 files changed、+2962 −14） |
| `main.tsx` | 前回と同じ。#738 の追加（import 1 行＋`activateCookSteamHv(window)` 1 呼び出し）は、main の炒め→炙り→`applyPreviewHvSeed` の流れと排他を保つ（前回 §3.2） |
| ローカル検証 | **再実行していない**。実行コードが同一のため、前回（`785d795` ＋ #738）の結果が適用される: `tsc -b` 0 エラー、steam 関連 Vitest 21 ファイル／262 件、gate・FRY 11 ファイル／81 件、`npm run build` 成功（`dist/` に蒸しの文字列なし）、Chromium E2E 蒸し 30/30・回帰 55 pass（3 skip）・prep／B18 HV 30 pass（2 skip）。**CI・WebKit・Codex は新 HEAD で必要（代替にならない）** |

---

## 4. 実行計画（Rev 1 §4 の更新）

**変更点:** #769 が merge 済みで、#753 だけが先行 merge の対象。**#753 の merge は #738 の更新と独立**（docs-only・重複ファイルなし・順序不問）。ただし **CI の基準を固めるため、main の WebKit E2E（`3a41bb64`）が出るのを待つ**。

| # | 作業 | 実行者 | 承認 | 備考 |
|---|---|---|---|---|
| 0 | #726 の claim を更新（§5） | 元の担当セッション | Owner が依頼 | **失効の 11/10 00:00 UTC まで約 3 日 9 時間**。他と並行 |
| 1 | main の WebKit E2E（run 42237370637、`3a41bb64`）の完了確認 | 本セッション（read-only、**ポーリングしない**。完了通知後に 1 回読む） | なし | 緑なら #738 の CI 基準として使える。赤ならその原因を先に切り分け（#738 とは無関係） |
| 2 | **#753 を merge**（任意のタイミング） | Owner | Owner の merge 承認 | **#738 の更新の前提ではない**。更新後に merge しても #738 は再 CI 不要（実行コード不変）。ただし**ブランチ保護が「up-to-date」を要求する場合のみ**、main が動くたびに #738 の更新が要る【未確認】→ 迷うなら #753 を先に merge すれば 1 回で済む |
| 3 | main（`3a41bb64` 以降）を #738 に取り込む（merge commit 1 つ、履歴書き換えなし） | **#726 claim の担当セッション** | **Owner の push 承認** | 新 HEAD `H'` |
| 4 | CI 11 件（WebKit 6 shard を含む）＋ Codex（`@codex review` を `H'` に 1 回） | CI（自動）／Owner または担当 | Codex の依頼は Owner／担当 | CI 約 30〜40 分。同じ HEAD の再実行はしない。失敗した job のみ、失敗記録を残して再実行（既知: #394・#680） |
| 5 | Owner Gate（dry-run）で `READY_FOR_OWNER_REVIEW` | Owner（Actions） | なし | 任意 |
| 6 | 共有 Preview に `H'` を配備（直前に README を再読し、#756 `8dfca29` のままか確認） | Owner／担当 | **Owner の配備承認**（Rev 1 §5.4 の承認文を使える） | 3 点確認（workflow・README の `Source commit`・画面バッジ） |
| 7 | 実機 HV（H1・H2・H3・H9・H11、約 5 分） | Owner | — | URL は `?cookSteamHv=1&cookSteamVariant=lid`（`hv=` を付けない） |
| 8 | 結果の記録（Owner の言葉で）、必要なら Preview を #756 へ復元 | Owner／担当 | **Owner の復元承認** | `ref=8dfca29c0fcfaeae6efbd9e4199f6b112bc51886`、`pr_number=756` |
| 9 | 最終 Gate（read-only）→ merge 承認（別） | — | **Owner の merge 承認** | HEAD が CI・Codex・HV のものと一致していること。Production ON は別 Gate |

**停止条件（再掲）:** ①取り込みの merge で conflict が出る、②G2 相当のローカル検証が落ちる、③WebKit が失敗 → 失敗記録を残し、#738 由来か main 由来かを切り分けるまで再実行しない（緩和・skip・timeout 延長はしない）、④Codex が指摘 → 修正は新 HEAD になり 4 からやり直し。

**最短の見込み:** 承認が即時なら、3 → 4 → 6 → 7 まで **約 1 時間 〜 1 時間 20 分**（CI が律速）。

---

## 5. #726 claim の更新依頼（担当セッション向け・下書き、未送信）

> **#726 の S3 claim の更新のお願い**（担当: `session_013m8Cb5GjssgoY27cSCQ3jk`）
>
> 現在の claim（コメント `6600517648`）は **2026-11-10T00:00:00Z（JST 11/10 09:00）に失効**します。2026-11-06 時点で更新コメントは無く、残りは約 3 日 9 時間です。#738（HEAD `2ac9820`）は、最新 main（`3a41bb64`）との merge が conflict なし（実測）で、次が残っています: ①main の取り込み（Owner の push 承認後、あなたの branch への merge commit 1 つ）、②CI 11 件と Codex（新 HEAD で 1 回）、③共有 Preview への配備と Owner の実機 HV（H1・H2・H3・H9・H11）、④merge 判断（別承認）。約 2〜5 日を見込みます。
>
> SESSION-OPERATIONS §1 に従い、**同じ session・issue で**新しい block を #726 に投稿して更新してください（別セッションの投稿は更新にならず別 claim になります）。`pr` は 738、`expires` は 14 日以内（提案: `2026-11-13T00:00:00Z`）。
>
> ```
> <!-- teto-claim:v1 {"session":"session_013m8Cb5GjssgoY27cSCQ3jk","issue":726,"pr":738,"branch":"claude/cooking-steam-s3-ui","files":["src/components/SteamLayer.tsx","src/components/SteamLayer.test.tsx","src/components/Steam.css","src/components/PizzaStage.tsx","src/components/PizzaStage.SteamLook.test.tsx","src/screens/GameScreen.tsx","src/App.tsx","src/main.tsx","src/logic/steam/**","src/preview/steamPreview.gate.test.ts","src/preview/cookSteamHv.ts","e2e/cooking-steam.spec.ts","docs/reports/TETO_COOKING-STEAM_PHASE1_S3_*","docs/reports/screenshots/cooking-steam-phase1/**"],"dependsOn":[],"expires":"2026-11-13T00:00:00Z"} -->
> ```
> `files` には、元の claim に載っていなかった `src/main.tsx`・`src/preview/cookSteamHv.ts`（#738 が実際に編集・追加）を足しています。不要なら元の一覧のままで構いません。更新後も、Production ON・merge・共有 Preview の更新は Owner の別承認が前提です。

※ 上の block はコードフェンス内なので、本書の中では live な claim ではない。投稿するのは担当セッションだけ（本セッションは投稿・更新しない）。

---

## 6. #769 merge 後の main の Deploy と WebKit E2E【実測、2026-11-06T14:53Z 時点】

| 項目 | 結果 |
|---|---|
| **Deploy to GitHub Pages**（run 42237370323、`3a41bb64`） | **success**。`build` 14:49:34Z〜14:50:50Z、`deploy` 14:50:53Z〜14:53:22Z |
| **E2E WebKit (Cooking UI 1-Screen)**（run 42237370637、`3a41bb64`） | **未完了**。`classify` success、`layout-chromium` と WebKit 6 shard（390×844 ×3、360×800 ×3）が **14:49:53Z 頃に開始**。取得時点（14:53Z）では run の status が `queued` と表示され、shard の job は in_progress（実行中）。**完了結果は未確定** |
| 参考（直前の main） | `785d795`（#759）の WebKit run 42223996134 は **success**（13:15:11Z〜13:33:52Z、約 18.7 分）、Deploy run 42223996114 も success |
| 見込み | #769 は docs 3＋JSON 1 のみで実行コードが `785d795` と同一のため、WebKit も緑になる見込み【推論】。**完了は 15:05〜15:15Z 頃**と見込む（過去の実績 約 19 分） |
| 失敗した場合 | main の失敗なので #738 とは無関係。原因（既知 flake #394・#680 か）を切り分けてから #738 の更新に進む |

---

## 7. Owner 判断・承認事項（最大 5 件）

| # | 判断 | 推奨 |
|---|---|---|
| **D1** | **#726 claim の更新を元の担当セッションに依頼**（§5。11/10 00:00 UTC 失効）。あわせて、#738 を更新・push する担当をそのセッションとする | 依頼する |
| **D2** | **#753 の merge**（docs-only・conflict なし・順序不問）。ブランチ保護が up-to-date を要求するか不明なので、**迷うなら #738 の更新前に merge** | 承認（`mergeable=false` は再現せず、修正不要。PR ページを開いて再計算させる） |
| **D3** | **#738 への main 取り込み push の承認**（merge commit 1 つ、履歴書き換えなし）と **Codex の依頼**。main の WebKit E2E が緑になってから | 承認（main の WebKit 完了後） |
| **D4** | **共有 Preview の配備承認**（新 HEAD、直前に README を再読）と、HV 後の**復元承認**（#756 `8dfca29`）。1 枠のため V2/V3 の HV との順序を決める | #738 を先、復元は HV 後 |
| **D5** | **F2／G2a**（Rev 1 §6）: G2a が F1 のテスト 3 ファイルを更新することの承認と、F2 の着手条件（G2a 後・新 claim・HOLD 解除）。今回は判断を急がない | 保留でよい（#738 の更新の後） |

**今回は判断を求めない（HOLD のまま）:** Production ON、V3 の本線化、γ 案、新工程の方向、Batch 19 の実装 GO。

---

## 8. 禁止事項の遵守
`src/`・`e2e/`・CSS・SVG・JSON・設定は未変更（docs のみ追加）／#738・#753 への push なし／merge なし／Production ON なし／共有 Preview の更新・復元なし／FRY 実装なし／他セッションの claim は未変更／GitHub への投稿なし。検証は使い捨て worktree（merge のみ、push なし）で行い削除済み。
