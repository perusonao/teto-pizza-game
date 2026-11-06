# Steam #738 — 最新 main 取り込み前の準備（docs-only）

作成: 2026-11-06（UTC 約 14:55）/ 基準 `origin/main` = `785d7956b42eac97e42dbd138818262a16c0a91c`（変化なし）/ ブランチ `claude/teto-cooking-methods-audit-ku35ki`
親資料: `TETO_COOKING-METHODS_Next-Gate-Plan.md`（Gate G0〜G8）、`TETO_COOKING-STEAM_S4_iPhone-HV_Minimal-Procedure.md`（実機 HV 最終版）
性質: **#738 の更新前準備まで。** #738 への push・PR merge・Production ON・共有 Preview の更新と復元・FRY 実装・他セッションの claim 変更・GitHub への投稿は**していない**。本書にある連絡文・承認文は**下書きで、未送信**。
表記: 【実測】= 今回確認／【推論】／【未確認】。

---

## 0. 結論（先に）

1. **#726 の S3 claim は更新されていない**【実測: #726 のコメントは 5 件のまま、最後は 11/3】。失効は **2026-11-10 00:00 UTC（JST 11/10 09:00）、残り約 3 日 9 時間**。更新できるのは**元の claim を書いたセッション（session_013m8Cb5Gjss…）だけ**で、本セッション（別 ID）は更新しない。更新文の下書きを §1.2 に置いた。
2. **#753 は Final Gate 全項目が揃っている（docs-only、merge 可能な状態）。#769 は CI の `build` が実行中（14:21 UTC 開始）で、それ以外は揃っている。** 両者は互いに衝突せず、先行 merge の見込みは良い（§2）。
3. **最新 main に #738 を取り込んだツリーを、使い捨ての worktree（push なし）で検証した。** `tsc -b` エラー 0、焦点を絞った Vitest 21 ファイル・262 件と gate 11 ファイル・81 件が pass、`npm run build` 成功、本番 `dist/` に蒸しの文字列なし、Chromium E2E は蒸し 30/30・回帰 55 pass（3 skip）・prep／B18 HV 30 pass（2 skip）。**CI（WebKit 6 shard・Layout Contract）・Codex は新 HEAD でなければ意味がないので、本書の結果は代替ではない**（§3）。
4. **`main.tsx` の HV 入口の相互作用は問題なし**（§3.2）。ただし `?cookSteamHv=1` と `?hv=` を同時に付けない運用を推奨。
5. **共有 Preview は #756 `8dfca29` のまま**で、今も 2 つの競合する用途（#738 の HV と #755 系の V2/V3 HV）が**同じ 1 枠**を取り合う。配備順は Owner が決める（§5）。
6. **F2 は G2a の後に着手**とし、設計を継続した。**新しい制約:** G2a は F1 のテスト（`fryIngredients.test.ts`・`fryOffer.test.ts`）と `IngredientGlyph.test.tsx` の「休眠／絵文字」の assertion を**必ず反転させる**ので、G2a の PR は**#749 の claim 範囲に踏み込む**（§6）。

---

## 1. #726 claim の再確認と期限延長（担当セッションによる更新）

### 1.1 事実【実測】
| 項目 | 内容 |
|---|---|
| claim | コメント `6600517648`（2026-11-03T09:55:07Z）、`session: session_013m8Cb5GjssgoY27cSCQ3jk`、`issue: 726`、`pr: null`、`branch: claude/cooking-steam-s3-ui`、`expires: 2026-11-10T00:00:00Z` |
| 更新 | なし（#726 のコメント 5 件のうち、最後が S3 claim） |
| 現在 | 2026-11-06T14:28Z 時点で残り約 **3 日 9 時間 30 分** |
| 規則 | SESSION-OPERATIONS §1: 更新は「**同じ `session` ＋ `issue` で新しい block を投稿**」、`expires` の上限は投稿から **14 日**、`pr` は PR ができたら埋める。Owner／Member／Collaborator のコメントのみ有効。別セッションが同内容を投稿しても**更新にならず別の claim**（overlap 警告の対象）になる |
| 本セッション | 別の session ID（`session_013m8Cb3UeRV…`）。**更新しない**（指示どおり） |

### 1.2 担当セッション向けの更新文（下書き・未送信）
> 担当セッション（`session_013m8Cb5GjssgoY27cSCQ3jk`）へ。#726 の S3 claim は 2026-11-10T00:00:00Z に失効します。#738 は最新 main との取り込みと Owner の実機 HV が残っており、取り込みから merge 判断まで約 2〜5 日を見込みます。既存ルール（SESSION-OPERATIONS §1）に従い、**同じ session・issue で**次の block を #726 に投稿して更新してください（`pr` を 738 に更新、`expires` は 14 日以内）。
>
> ```
> <!-- teto-claim:v1 {"session":"session_013m8Cb5GjssgoY27cSCQ3jk","issue":726,"pr":738,"branch":"claude/cooking-steam-s3-ui","files":["src/components/SteamLayer.tsx","src/components/SteamLayer.test.tsx","src/components/Steam.css","src/components/PizzaStage.tsx","src/components/PizzaStage.SteamLook.test.tsx","src/screens/GameScreen.tsx","src/App.tsx","src/main.tsx","src/logic/steam/**","src/preview/steamPreview.gate.test.ts","src/preview/cookSteamHv.ts","e2e/cooking-steam.spec.ts","docs/reports/TETO_COOKING-STEAM_PHASE1_S3_*","docs/reports/screenshots/cooking-steam-phase1/**"],"dependsOn":[],"expires":"2026-11-13T00:00:00Z"} -->
> ```
> `files` には、元の claim に載っていなかった `src/main.tsx`・`src/preview/cookSteamHv.ts`（#738 が実際に編集・追加）を足しています。不要なら元の一覧のままで構いません。期限は #738 の Gate（取り込み → CI → Codex → 実機 HV）に必要な最小限として 11/13 を提案します（延長が必要になれば再更新）。

※ 上の block はコードフェンス内なので**本書の中では live な claim ではない**（SESSION-OPERATIONS §1）。実際に投稿するのは担当セッションだけ。

---

## 2. #753・#769 の Final Gate と先行 merge の見込み

| 項目 | #753（eggplant A 案の採用記録） | #769（Batch 19 の docs 取り込み） |
|---|---|---|
| HEAD | `ed0d191`（11/4 23:12Z から変化なし） | `186cc57`（11/6 14:21Z、main `785d795` から作成＝**遅れなし**） |
| 種別 | docs（Style Lock 追記・参照 SVG・候補・Result・スクショ、20 ファイル） | docs 3 ＋ JSON 1（`TETO_EXPANSION-BATCH-19_PREP_jaccard.json`）、4 ファイルとも新規 |
| draft／mergeable | non-draft／`unknown` | non-draft／`unstable`（`build` 実行中のため） |
| CI | **build success**、classify success、WebKit Gate success、Layout Contract Gate success、`layout-chromium`・WebKit shard は skipped（docs のため）【実測】 | classify success、WebKit Gate success、Layout Contract Gate success、WebKit shard・`layout-chromium` skipped、**`build` in_progress**（14:21:41Z 開始。JSON を含み `docs_only=false` のため lint／Vitest／build が走る。過去の docs＋JSON 系は 15〜25 分の実績があり、**14:40〜14:50Z 頃に完了する見込み**【推論】） |
| Codex | summary `status: completed`・`has_unresolved_findings: false`（`ed0d191`）【実測】 | summary `status: completed`・`has_unresolved_findings: false`（`186cc57`、14:23:40Z）【実測】 |
| review thread | 0 | 0 |
| Depends-on | なし | なし |
| 衝突 | main へ merge して **conflict なし**。#769 との同時 merge も conflict なし【実測】 | main の新規ファイルのみで衝突なし（PR 本文）。#753 とも conflict なし【実測】 |
| 他セッションの claim | #748 の claim 範囲（`src/data/*` ほか）とは**重ならない**（docs のみ） | 同左。Batch 19 の実装は #748 の claim 解放と Owner の GO まで**実施しない**（PR 本文） |
| HV | 不要（docs-only） | 不要（docs-only） |
| 残る条件 | **Owner の merge 承認のみ** | `build` の完了と、**Owner の merge 承認** |

**見込み（【推論】）:** #753 は即時に merge 可能。#769 は `build` が緑になれば同じ状態。**両方とも `src/`・`e2e/` を含まず、#738 の取り込みと衝突しない。merge の順序は問わない**。どちらも WebKit は走らない（docs）ため、#738 の WebKit の負荷とも干渉しない。

**注意（#753 の base が古い点）:** #753 の base は `5d54bf2`（main は `785d795`）。docs-only なので内容は衝突しないが、**CI の結果は古い base 上のもの**。ブランチ保護が「up-to-date」を要求するかは確認できていない【未確認】（`mergeable_state` が `unknown`）。要求される場合は、担当が「Update branch」→ CI 再実行（docs なので短い）が要る。

---

## 3. #738 の最新 main 取り込みの事前確認

### 3.1 差分・競合【実測】
| 項目 | 結果 |
|---|---|
| #738 の変更 | 110 ファイル（`merge-base` = `49e2add` からの差分） |
| main の変更 | 334 ファイル（base 以降の 15 commit） |
| **共通ファイル** | **0**。`git merge-tree` で conflict なし。実際の merge も自動成功（merge commit のみ、他の手作業なし） |
| #753・#769 が先に merge された場合 | 追加されるのは docs のみ（Style Lock・候補・Batch 19 資料）。**#738 の差分と重ならず、取り込み結果は変わらない**【推論。#753+#769 の相互 merge と main への各 merge は conflict なしを実測】 |

### 3.2 `main.tsx` の HV 入口の相互作用【実測：コード読み＋E2E】
- main の入口: 炒め `activateCookPrepHv` → 炙り `activateCookSearHv`（炒めが勝つ）→ `applyPreviewHvSeed(?hv=…)`。
- #738 の追加: 上の 2 つの直後に `activateCookSteamHv(window)`（**+3 行**）。`cookSteamHv.ts` は **`<html>` の `data-cook-*-hv` 印を見て譲る**（`/^cook(?!Steam)[A-Za-z]+Hv$/`）ので、**3 つの HV 入口は排他のまま**。
- main 側の変更（`hvSeeds.ts`、B18 の `?hv=` 追加）: `cookSteamHv.ts` が使う `buildHvSnapshot`・`findHvScenario` は**変更なし**（差分は `applyPreviewHvSeed` と返却型だけ）。→ **取り込みで #738 の HV 入口は壊れない。**
- **残る運用上の注意:** `?cookSteamHv=1&hv=<…>` を**同時に付けない**。HV 入口は `localStorage` を使い捨てのメモリ保存に差し替えるため、その後に `applyPreviewHvSeed` が走ると seed がメモリ側に書かれる（従来の炒め・炙りでも同じ性質で、#738 で新しく生じる問題ではない）。HV の案内 URL は `?cookSteamHv=1&cookSteamVariant=lid` のみとする。
- `e2e/cooking-steam.spec.ts` が使う `tapDoughPercent`（`e2e/gestures.ts`）は main で内部が診断ラッパー `diagMouse` に変わったが、**シグネチャ・振る舞いは同じ**。

### 3.3 ローカル検証（使い捨て worktree、**push なし**、作業後に削除）
`origin/main` に `refs/audit/pr738`（`2ac9820`）を merge したツリー（#738 の 110 ファイルのみ追加、他は main のまま）で実施。

| 検証 | 結果 |
|---|---|
| `npm ci` | 成功 |
| `tsc -b` | エラー 0 |
| Vitest（steam 一式・`SteamLayer`・`steamGhostClick`・`PizzaStage.SteamLook`・`steamIngredients`・`steamPreview`・`cookSteamHv`・`previewIsolation.gate`・`b18HvSeeds`・`devtoolsAccess`） | **21 ファイル／262 件 pass** |
| gate・FRY（`steam.gate`・`cookPrepHv.gate`・`cookSearHv.gate`・`searPreview.gate`・`prepPreview.gate`・`src/logic/fry`） | **11 ファイル／81 件 pass** |
| `npm run build` | 成功。`dist/` に `cookSteam`・`teto:cookSteam`・`steamGameLab` の文字列なし |
| `oxlint`（変更ファイル） | 警告 1（`GameScreen.tsx:557` の `exhaustive-deps`。**#738 の S3 Result が従来からの警告と記録しているもの**） |
| Chromium E2E 蒸し（`cooking-steam.spec.ts`、390×844・360×800） | **30/30 pass** |
| Chromium E2E 回帰（`cooking-screen-sideways`・`cooking-sear-hv`・`dynamic-cooking-steps`・`viewport-1screen`、両 viewport） | **55 pass／3 skip** |
| Chromium E2E（`cooking-prep`・`b18-hv-preview`、390×844） | **30 pass／2 skip** |
| 本番フラグ | `STEAM_EXPERIENCE_PRODUCTION = false`、`FRY_EXPERIENCE_PRODUCTION = false` |

**限界（正直に）:** ①**Playwright の WebKit・Layout Contract・Codex・GitHub CI は実行していない**（`npm ci` の playwright は 1.56.1 で、同梱ブラウザが無いため、この環境の Chromium を `executablePath` で差し替えた**使い捨ての設定ファイル**で実行。リポジトリのファイルは変更していない）。②全 Vitest の一括は未実行（SESSION-OPERATIONS §8.6: 変更に見合う範囲）。③**結果は #738 の更新後の新 HEAD の証拠にはならない**。CI・Codex・HV は新 HEAD で 1 回ずつやり直す。

---

## 4. 実行順（最短）と必要な Owner 承認

#753・#769 を先に main へ入れてから、#738 を**1 回だけ**更新し、CI・Codex も 1 回だけにする。

| # | 作業 | 実行者 | 必要な承認 | 見込み | 並行 |
|---|---|---|---|---|---|
| 0 | #726 の claim を更新（§1.2） | **元の担当セッション** | Owner が依頼・確認 | 数分 | すべてと並行可 |
| 1 | #769 の `build` 完了を確認 | 本セッション（read-only） | なし | 14:40〜14:50Z 頃【推論】 | 0 と並行 |
| 2 | **#753 を merge**、**#769 を merge** | Owner（または Owner が指示した担当） | **Owner の merge 承認 ×2** | 数分 | #753 は #769 の完了待ち不要（順序不問） |
| 3 | main を #738 に取り込む（merge commit、履歴の書き換えなし、1 回だけ） | **#726 claim の担当セッション**（#738 の branch の担当） | **Owner の push 承認**（G0） | 数分 | 2 の後 |
| 4 | CI 11 件（WebKit 6 shard を含む）＋ Codex（`@codex review`）を新 HEAD で 1 回 | CI（自動）／Owner または担当 | Codex の依頼は Owner／担当 | CI 約 30〜40 分、Codex 数分 | — |
| 5 | Owner Gate（dry-run）で `READY_FOR_OWNER_REVIEW` を確認 | Owner（Actions で手動実行） | なし（read-only） | 数分 | 4 の後 |
| 6 | **共有 Preview に新 HEAD を配備** | Owner／担当 | **Owner の配備承認**（§5） | 数分 | 5 の後 |
| 7 | **実機 HV（H1・H2・H3・H9・H11）** | Owner | — | 約 5 分 | 6 の後 |
| 8 | HV の結果を記録（Owner の言葉で） | Owner | — | — | — |
| 9 | 共有 Preview を #756 `8dfca29` へ復元（または次の HV 用に別 PR を配備） | Owner／担当 | **Owner の復元承認**（§5） | 数分 | 8 の後 |
| 10 | #738 の最終 Gate（read-only）→ **merge 承認（別）** | 本セッション or 担当／Owner | **Owner の merge 承認** | — | 9 の後でも可 |

**最短の見積もり:** Owner の承認が即時なら、2 → 3 → 4 → 6 → 7 まで **約 1 時間 〜 1 時間 20 分**（CI が律速）。HV の時刻は Owner の都合。**claim の失効（11/10 00:00 UTC）までは余裕がある**が、0 は先に済ませておくと安全。

**必要な Owner 承認（まとめ）:** ① #753・#769 の merge、② #738 への main 取り込み push、③ Codex 依頼、④ 共有 Preview の配備、⑤ 共有 Preview の復元、⑥ #738 の merge（別）。Production ON は含まれない。

---

## 5. 共有 Preview の配備と復元（準備のみ。実行しない）

### 5.1 現状【実測】
- 配備元: **#756 `8dfca29c0fcfaeae6efbd9e4199f6b112bc51886`**（`Built 2026-11-05T00:32:32Z`、preview リポの最新 commit `8ffc141`。**本ターンの開始時点でも変化なし**）。
- 直前の配備: #738 `2ac9820`（11/4 23:25Z）、`85b4a07`（11/4 14:50Z）。
- Preview は**1 枠**。#738 の HV と、#755 系（#757 V2・#763 V3）の実機 HV が**同じ枠を取り合う**。配備の順序は Owner が決める（本書では判断しない）。

### 5.2 配備の手順（Owner の承認後）
1. **配備直前に README を再読**し、現在の `Source commit` が `8dfca29…`（#756）のままであることを確認。別の配備が入っていたら、その SHA を新しい復元先として記録する。
2. preview リポジトリ（`perusonao/teto-pizza-game-preview`）の Actions → **`Build & deploy a source PR/branch`** を `ref=<#738 の新 HEAD の完全 SHA>`、`pr_number=738` で実行（`.github/workflows/deploy-from-source.yml`。別の Pages deploy が連動）。
3. **3 点確認**: ①workflow success、②README の `Source commit` ＝ 新 HEAD、③画面の PREVIEW バッジが `#738` と新 HEAD の短縮 SHA。**3 つとも揃うまで HV を始めない**。
4. HV 用 URL: `https://perusonao.github.io/teto-pizza-game-preview/?cookSteamHv=1&cookSteamVariant=lid`（**`hv=` を付けない**）。
5. Preview の保存は使い捨て（SESSION-OPERATIONS §5）。

### 5.3 復元の手順（Owner の承認後）
- 同じ workflow を **`ref=8dfca29c0fcfaeae6efbd9e4199f6b112bc51886`、`pr_number=756`** で再実行し、同じ 3 点確認をする。
- 次に別の HV（V2／V3 など）を入れる場合は、復元せずにその PR を直接配備してよい（Owner の判断）。

### 5.4 Owner 承認文の下書き（未投稿。#738 のコメント用）
> **Owner approval — shared Preview update for Steam #738 (YYYY-MM-DD)**
> Owner approves **updating the shared Preview to the exact #738 head** `<新 HEAD の完全 SHA>` for iPhone Safari HV (H1, H2, H3, H9, H11). **Not** a merge, Production ON, or any HV PASS/waiver.
> - Current Preview source before replacement (restoration target): `8dfca29c0fcfaeae6efbd9e4199f6b112bc51886` (PR #756) — re-read the preview repo README immediately before dispatching.
> - Workflow: `perusonao/teto-pizza-game-preview` → `Build & deploy a source PR/branch`, inputs `ref=<新 HEAD>`, `pr_number=738`.
> - Verify: workflow success, README `Source commit`, on-screen badge (`#738` + short SHA). Report the dispatch result separately.
> - Restoration (separate Owner approval): same workflow, `ref=8dfca29c0fcfaeae6efbd9e4199f6b112bc51886`, `pr_number=756`.
> - Preview save data is disposable. `?cookSteamHv=1` only, without `hv=`.

---

## 6. FRY F2 — G2a の後に実装する前提での設計継続

### 6.1 前提と順序
親設計は `TETO_COOKING-METHODS_Next-Gate-Plan.md` §4（層 1: `amount` 保存、層 2: β のゲーム性）。**変更点: F2 は G2a（eggplant の絵の登録）が main に入った後に着手する**（テスト戦略 a）。

### 6.2 新しい発見 — G2a が反転させる既存テスト【実測】
eggplant に `pieceVisual` が付くと、**次の既存 assertion が必ず失敗する**ので、G2a の PR（または F2 の PR）で**意図して更新**する必要がある。

| ファイル | 内容 | G2a 後 |
|---|---|---|
| `src/data/fryIngredients.test.ts:12-14` | 「is DORMANT today: eggplant has no dedicated drawing yet」（`pieceVisual` が `undefined`、`canFryIngredient("eggplant")` が false） | **失敗**（休眠でなくなる）。「絵が付いたら true になる」の本来の形へ更新 |
| `src/logic/fry/fryOffer.test.ts:17-21` | 「offers nothing today, whatever the round says」（GUIDED／FREE_COOK で eggplant を選び所有していても null） | **失敗**（`enabled: true` で GUIDED／FREE_COOK なら `{ingredientId, done}` を返す）。期待を反転 |
| `src/components/IngredientGlyph.test.tsx:242-245` | 「corn / eggplant / potato draw their approved emoji」 | **失敗**（eggplant が SVG になる）。dedicated 表へ移す |
| `W1_DEDICATED` 等の dedicated 表（同ファイル） | eggplant の追加 | 追記（ハーブ・burrata と同じ追記箇所） |

→ **G2a の PR は、#749 の claim 範囲（`src/data/fryIngredients.test.ts`・`src/logic/fry/**`）に踏み込む。** #749 の claim は F1 の新規ファイル範囲で〜11/18 有効。**G2a の前に、#749 の担当セッションと Owner が「F1 のテストの更新を G2a の PR に含めてよいか」を決める**（含めない場合は G2a と F1 テスト更新を同時 merge できない＝CI が赤になるため、**同じ PR に入れる以外の選択肢はほぼない**【推論】）。

### 6.3 F2 の開始条件（チェックリスト）
1. G2a が main に merge 済み（eggplant に `pieceVisual`、上の既存テストが更新済み）。
2. #749 の claim 範囲と F2 の範囲（`src/state/gameReducer.ts`、`src/logic/fry/fry.architecture.test.ts` の `LATER_SLICES`、reducer テスト 4 本）を、**新しい claim** で宣言（HOT の `gameReducer.ts` を含むため、重なる PR／claim がないことを再確認。今回確認した範囲では `gameReducer.ts` を触る open PR なし）。
3. Owner の F2 HOLD 解除（#749 の明示）。
4. `FRY_EXPERIENCE_PRODUCTION = false` を維持。

### 6.4 F2 の変更（層 1、再掲・確定）
- `GameState.fryLook?: Readonly<Record<string, number>>`（transient）、`{ type: "FRY_INGREDIENT"; ingredientId: string; amount: number }`、`STEAM_INGREDIENT` と同形の拒否条件（同じ state 参照を返す）、`RESET_PIZZA` の分割代入へ 1 語。
- テスト 4 本（reducer／flagOff／coexist／unaffected）は steam の複製。**G2a 後は実カタログで受理経路を検証**でき、モックは不要。
- 層 2（β）は F2 に含めない（F1 の純ロジック追加と F3 の UI）。

---

## 7. 残るリスク
| # | 内容 |
|---|---|
| R-1 | #726 の claim 更新が **11/10 00:00 UTC までに行われない** → 他セッションが HOT 3 ファイル（`PizzaStage`・`GameScreen`・`App`）に入れる状態になる |
| R-2 | WebKit の間欠失敗（#394・#680）。#763 では `cooking-prep.spec.ts:478` 等が一度落ちた。#738 に取り込む main 側は該当 spec と診断を更新済み。失敗したら**失敗記録を残してから**該当 job のみ再実行 |
| R-3 | #753 の base が古く、ブランチ保護の「up-to-date」要求の有無が未確認 |
| R-4 | 共有 Preview の 1 枠を #738 の HV と #755 系の HV が取り合う |
| R-5 | G2a が #749 の claim 範囲（F1 のテスト）に踏み込む |

---

## 8. Owner 判断事項（最大 5 件、優先順）

| # | 判断 | 推奨 |
|---|---|---|
| **D1** | **#726 claim の更新を元の担当セッションに依頼**する（期限 11/10 00:00 UTC、提案: 11/13、`pr: 738`）。あわせて、#738 を更新する担当を同じセッションとすること | 依頼する（§1.2 の文面をそのまま使える） |
| **D2** | **#753 と #769 を merge**（docs-only、先行 merge）。#769 は `build` 完了後 | 承認（衝突なし、順序不問）。**これが済んでから #738 を 1 回だけ更新**する |
| **D3** | **#738 への main 取り込み push の承認**（merge commit 1 つ、履歴書き換えなし）と、Codex の依頼 | D2 の後に承認 |
| **D4** | **共有 Preview の配備順序と配備・復元の承認**: #738 の新 HEAD → HV → 復元（#756）／または V2・V3 の HV を先にするか。**1 枠**のため順序を決める | #738 の HV を先（claim の期限があるため）、復元は HV 後 |
| **D5** | **G2a の PR が F1 のテスト（#749 の claim 範囲）を更新することの承認**と、F2 の着手条件（G2a 後・新 claim・HOLD 解除） | 承認（G2a と F1 テスト更新を同じ PR にする） |

**今回は判断を求めない（HOLD のまま）:** Production ON、V3 の本線化、γ 案、新工程の方向、Batch 19 の実装 GO、ハーブ・burrata の実装時期。

---

## 9. 禁止事項の遵守
`src/`・`e2e/`・CSS・SVG・JSON・設定は未変更（docs のみ）／#738 への push なし／merge なし／Production ON なし／共有 Preview の更新・復元なし（README と commit 履歴の**読み取りのみ**）／FRY 実装なし／他セッションの claim は未変更／GitHub への投稿なし。ローカル検証は**使い捨ての worktree（merge のみ、push なし）で行い削除済み**。
