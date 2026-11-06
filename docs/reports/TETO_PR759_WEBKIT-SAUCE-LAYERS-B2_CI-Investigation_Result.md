# PR #759 CI 調査 — `sauce-layers-b2.spec.ts:306` の WebKit 失敗（読み取り専用）

- 対象: PR #759（Batch 18）HEAD `c533a4f10521e007af14c0c1fb4112d8724aa154`、base main `8210d66`
- 調査日時: 2026-11-06 11:36 UTC 時点
- 制約の遵守: CI 再実行なし / 製品コード・テスト変更なし / Gate 免除・timeout 延長・skip なし / merge・Production ON・共有 Preview 更新なし
- 状態: **原因は未確定**（下記「結論」参照）。このレポートは docs のみの追加。

## 1. CI の完了状況（HEAD `c533a4f`）— **まだ全部は完了していない**

| チェック | 結果 | 備考 |
|---|---|---|
| classify / layout-chromium / Layout Contract Gate | success | |
| webkit 390×844 shard 1・2・3 | success | |
| webkit 360×800 shard 1・2 | success | |
| **webkit 360×800 shard 3/3** | **failure** | 下記 §2 |
| **WebKit Gate** | **failure** | shard 3/3 の結果を受けたもの（11:33:34 完了） |
| **build**（run 42208876856） | **in_progress** | Vitest ステップが 11:17:01 から実行中（11:36 時点で約 19 分）。Build ステップは未開始 |

→ 11 件中 8 success / 2 failure / **1 in progress**。「残りの CI がすべて完了」は **確認できていない**。`build` の最終結果は未確定。

## 2. 失敗の記録

- ジョブ: https://github.com/perusonao/teto-pizza-game/actions/runs/42208877041/job/127862407625 （workflow `E2E WebKit (Cooking UI 1-Screen)`、run 42208877041、attempt 1）
- テスト: `[webkit-360x800] › e2e/sauce-layers-b2.spec.ts:306:1 › overlap: the top layer is dimmed only where it overlaps; 2 and 3 layers stay readable (Owner Decision, PR #494)`
- 結果: shard 内 1 failed / 207 passed / 47 skipped（executed 255）。他の 207 件は成功。
- ログの該当行（job log より）:
  - `| 133% LOW | 40.0 s | 30.0 s | -10.0 s | webkit-360x800 3 | sauce-layers-b2.spec.ts:306 … (unexpected) |` — 既定 30 s の timeout を 40.0 s で超過。
  - PR #759 コメント 6683865091（Claude 記録）によると、エラーは `mouse.move: Protocol error (Input.dispatchMouseEvent): Page closed`（ソース描画のドラッグ中）。**ログ本文の `Error:` 行そのものは、本調査で取得できた末尾 500 行には含まれていない**（上のコメントの引用を二次情報として記載）。
  - 同 shard の timing: 合計 20.2 分 / 208 件（workers 5）。同じファイルの `:340` は 9.7 s。**shard 全体が極端に遅かったわけではない**。他に 80% を超えた test はなし（次点 55%）。
- 順序の解釈: 30 s の timeout 超過 → テストのページが閉じられる → `Page closed`、の順と読むのが自然。つまり「Page closed」は timeout の結果であり、最初の原因ではない可能性が高い（未確証）。

## 3. 履歴調査（読み取り専用）

調査範囲: `gh` ではなく GitHub MCP で取得できた直近 100 件の completed run（2026-11-04 10:04 〜 2026-11-06 11:33 UTC、約 2 日分）。それ以前は未調査。

**このテスト（`sauce-layers-b2.spec.ts:306`）が失敗した記録は、この範囲では今回の 1 件のみ。**

ログを直接読んで確認したもの（失敗した test 名）:

| run | ブランチ | 失敗 test |
|---|---|---|
| 41860969123（main `c69cb2b`） | main | `lunch-rush-r8-restore:145` G-6（30 s 超過） |
| 41942142375（main `2a090ea`） | main | `lunch-rush-r8-restore:135` G-5、`:154` G-6（30 s 超過） |
| 42022401216（steam-gameplay-v3-755） | PR #763 | `cooking-prep:478`、`cooking-tray-family-expanded:251`（`Target … closed`） |
| 42068308943（webkit-360-cooking-overflow） | PR #765 | `cooking-screen-sideways:105` × 3（#764 の横はみ出し。修正済み） |

PR #759 のコメントに記録されているもの: 42165174034（`d9679e6`）で `lunch-rush-r8-restore:154`（attempt 1）と `failed-hint-676:91`（attempt 2）。42058865993（`33bc275`）は `b18-hv-preview` の横はみ出し（#765 で解消）。

**ログ未確認**（attempt 1 の失敗 shard。再実行で成功扱いになった run。失敗 test 名を読めていない）: 42161858291（390×844 shard 2 / 360×800 shard 1）、42073823905（390×844 shard 3）、41977895460（360×800 shard 1）、41933752060（390×844 shard 2）、41879080430（390×844 shard 1）、42021505308（390×844 shard 2）。取得できたログ末尾が artifact アップロード部分のみで、失敗 test 名に届かなかった。**この 6 件の中に `sauce-layers-b2` が含まれる可能性は排除できていない。**

main の WebKit 結果（push）: `8210d66`（#759 の base）/ `c308a3f` / `fa67c72` / `537ed09` / `d85b957` / `5d54bf2` は success。`c69cb2b` と `2a090ea` は上表の lunch-rush で failure。**main で `sauce-layers-b2:306` が失敗した記録は見つからなかった。**

## 4. #759 の変更との関係

- B18 の差分（94 ファイル）に、ソース描画・heatmap・マウス操作・`App.css`・`main.tsx`・`gameReducer.ts`・`e2e/gestures.ts`・CI 設定・`playwright` 設定の変更は **ない**。
- 唯一近い変更は `src/data/recipeSauceProfiles.ts` の 2 行追加（`baingan-bharta-pizza` → curry-ketchup PAINT、`reina-pepiada-pizza` → fromage-blanc-sauce PAINT）。これは新レシピ 2 品のための参照データ行で、該当 test は targetless Free Cook（固定の OWNED、トマト → ジェノベーゼ → オリーブオイル）で動くため、この行を通らない。
- `sauce-layers-b2.spec.ts` は、この PR と main の間で差分なし（直近の変更履歴にも B18 は現れない）。
- 以上は **コード上の経路が重ならない**という状況証拠であり、因果の不在の証明ではない。

## 5. 結論

| 問い | 判定 | 根拠の強さ |
|---|---|---|
| 全 CI が完了したか | **未完了**（`build` が実行中） | 確認済み |
| #759 の変更が原因か | **原因である証拠はない**。ただし未証明 | 弱〜中（経路が重ならない / 今回 1 件のみ / 他の 10 チェックは成功） |
| 既存の間欠失敗か | **可能性が高いが未確定**。過去の同テスト失敗の記録は取得範囲で 0 件（＝「既知の間欠」とも言い切れない） | 弱 |
| 原因（timeout 超過の理由） | **未確定** | — |

重要な点: 履歴上、このテストは **今回が初出**。「既知の flake」とは言えない。一方で「B18 起因」とする根拠もない。切り分けるには、同じ HEAD での再現性（再実行）か、別 HEAD での再現の追加情報が要る。再実行は禁止されているので、**これ以上は Owner の判断待ち**。

## 6. 最小限の対応案（実装していない）

1. **製品コード: 変更不要**（原因が確定していない以上、触らない）。
2. **確認（Owner の許可が要る）:** 失敗した job `127862407625` だけを 1 回再実行して再現性を見る。再実行しても同じテストで落ちるなら #759 側の問題として原因調査に進む。別の test で落ちる／通るなら #394・#680 系の環境要因として扱う。
3. **テストのみの別 PR（推奨・#759 には入れない）:** このテストは実時間で 3 本のストローク（1100 ms + 1500 ms + 1000 ms）と、各 10 s までの settle 待ちを 1 つの test に直列で入れている（30 s の既定内）。2 層の検証（〜`triple` の前まで）と 3 層の検証を **2 つの test に分割**すれば、assertion を一切変えず、timeout も延長せず、1 test あたりの実時間を約半分にできる。ただし「分割で足りるか」は測定していないので、効果は未検証。
4. **診断:** 次に起きたときのために、失敗時に paint の各段階の所要時間をログに出す（test のみ。別 Issue）。

## 7. Owner の判断が必要な点

1. **失敗 job のみ 1 回の再実行を許可するか**（許可しない場合、#759 の WebKit Gate は赤のまま。PASS 扱いにはしない）。
2. 許可しない場合は、**赤を「原因未確定・候補は環境要因」として受容するか**。受容する場合も記録上は「PASS ではなく Owner 受容」。
3. §6-3 のテスト分割を **別 Issue・別 PR** として起票するか。
4. `build`（Vitest 実行中）の完了を待ってから判断する、で良いか。

## 8. Codex レビュー

- HEAD `c533a4f`: Codex の summary コメントは `status: completed`、`has_any_findings: false`、`has_unresolved_findings: false`（2026-11-06 11:17:37 UTC）。receipt も "Didn't find any major issues"。**指摘 0 件。**
- 過去の P2 2 件（取得順ラベル変化）は解決済み。この HEAD 時点の未解決スレッドは確認した範囲では 0 件。
- Codex の結果は WebKit Gate の判定には影響しない（別の事象）。

## 9. 制約の確認

CI 再実行・push（PR ブランチ）・merge・Production ON・共有 Preview 更新・Gate 緩和・timeout 延長・skip・製品コード変更は **いずれも行っていない**。このレポートは調査ブランチ `claude/pr-759-ci-investigation-x34ofq` への docs 追加のみ。
