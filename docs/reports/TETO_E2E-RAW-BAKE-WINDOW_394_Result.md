# E2E RAW_BAKE 窓の見直し — Result Report（Issue #394 / #680 関連）

Status: **テストのみ（e2e 2 ファイル）。製品コード・`e2e/gestures.ts`・保存・採点は不変。** merge は Owner の別途承認待ち。
Base: main `c308a3f7`。Branch: `claude/e2e-raw-bake-window-394`。PR #759（Batch 18）とは独立で、#759 には何も反映していない。

## 1. 何を直したか

`e2e/failed-hint-676.spec.ts` と `e2e/research-failed-trial.spec.ts` の `RAW_BAKE`（生焼けで取り出すための焼成窓）を
`{ start: 3, end: 15 }` から `{ start: 20, end: 40 }` に変更した。各 spec に、この窓が生焼けの意味を保つことを確かめるテストを 1 本ずつ追加した。

### 1.1 なぜ 3-15 が脆かったか（コードから読める事実）
- 針は 0 → 100 を `BAKE_DURATION_S = 3` 秒で進み、戻らない（#419）。速度は約 33.3 pt/s で、「焼く」を押した瞬間から動く。
- `landNeedleAndTakeOut` は窓の中心 ± `min(max(窓幅/2, 1.5), JUST_HALF_WIDTH_PT = 3)` に着地させる。窓 3-15（中心 9）は、
  針が 12 以下で止まっていないと着地できない。12 pt は約 **0.36 秒**。
- 時計が止まるのは `pauseAt` が成功した時点で、それまでの実時間は全て針に積まれる。遅い runner でこの時間を超えると、
  `the one-way needle is already at 14.5, past the window 3-15` で失敗する（PR #759 `d9679e6` の WebKit 390×844 shard 2/3、#394 に記録）。
- 窓 20-40（中心 30）は 33 以下で止まればよく、約 **1 秒**の余裕がある（約 2.75 倍）。着地が手前なら `runFor` で前へ進めるだけで、実時間は使わない。

### 1.2 `{0,40}` ではなく `{20,40}` を選んだ理由
候補は Owner 指示の `{0,40}` と `{20,40}`。`landNeedleAndTakeOut` の許容幅は 3 で頭打ちのため、実際に着地する範囲は窓の中心 ± 3 になる。
`{0,40}` は中心 20（23 以下、約 0.69 秒）、`{20,40}` は中心 30（33 以下、約 0.99 秒）。後者の方が時間の余裕が大きい。
どちらも全レシピの最小開始値 45 より手前で、生焼けの意味は同じ。

## 2. 生焼け／失敗の意味が維持されることの証明

| 層 | 内容 |
|---|---|
| 単体（各 spec に追加） | 窓内の針位置（20〜40、0.5 刻み）の全てが、Free Cooking の窓（58-78）と**全 88 レシピ**の `bakeTarget` に対して `classifyBake` = `"raw"`。さらに 全窓の最小開始値（現在 45）と `RAW_BAKE.end`（40）の差が **5pt 以上**であることを固定。将来、開始値が 45 未満（例: 41〜44）のレシピが入ると、窓は依然 raw でも余白が 5pt を切るので、このテストが落ちて見直しを促す（Codex P2 の指摘で、`<` だけの比較から改めた）。 |
| 実機能（既存 assertion、不変） | 取り出した結果が `.result-panel--failed`（失敗カード）。Research の spec は理由文 `生焼けで提供できません` / 空の皿は `材料が入っていません`、○×の記録、盤面の×を確認する。 |
| Completion Gate | `BAKE_ACCEPTABLE_MARGIN_RATIO = 0`（Issue #482）なので、窓の開始値より手前は UNDERBAKED、`classifyBake` の `"raw"` と一致する。 |

## 3. 検証結果（Chromium、ローカル、HEAD は本ブランチ）

低速条件は、Chromium の CDP `Emulation.setCPUThrottlingRate`（x25）で、ページの CPU を実際に遅くした。
Playwright の `page` 生成を差し替える外部プリロード（リポジトリ外・未コミット）で全 page に適用している。WebKit はこの環境で動かせない。

| 条件 | 変更前（窓 3-15） | 変更後（窓 20-40） |
|---|---|---|
| 通常 390×844 | 5/5 通過 | 7/7 通過（追加 2 本を含む） |
| 通常 360×800 | 5/5 通過 | 7/7 通過 |
| CPU 負荷（燃焼プロセス 8 本） | 10/10 周通過（効かず） | — |
| CPU x10 | 通過（所要は約 5 倍） | — |
| **CPU x25** | **窓 3-15 を使う 8 本中 7 本が失敗**（390: 4/4、360: 3/4）。`needle is already at 12.5〜15.2, past the window 3-15` | **3 周 × 2 サイズ = 42/42 通過** |

- 変更前の x25 の失敗は、CI（WebKit）と同じメッセージ・同じ症状で再現できた。窓に関係しない `C3` は両方とも通過した。
- 負荷のみ（x1）や x10 では変更前も落ちないため、「CI の WebKit で落ちる条件」は x25 付近にある、と読める。これは再現の近似で、WebKit 本体の挙動の証明ではない。

## 4. 範囲と守ったこと
- 変更ファイル: `e2e/failed-hint-676.spec.ts`、`e2e/research-failed-trial.spec.ts`、本 Report のみ。
- 変更しない: 製品コード、`e2e/gestures.ts`、保存、採点、Gate。G-5/G-6 の timeout は変更なし。retry・skip・Gate の緩和なし。
- #759 への push・merge・CI 再実行、Production ON、共有 Preview の更新はしていない。
- 干渉確認（2026-11-06）: 未マージの open PR・remote branch のうち、2 spec と `e2e/gestures.ts` を変更するものは、古いブランチ 2 本（`claude/expansion-batch-13-potato-mayo` の最終コミット 2026-11-01、`claude/issue-394-p2-e2e-diag` は 2026-11-04）のみ。どちらも main の祖先ではないが、main には同名の内容（#716、#744）が入っており、squash-merge の名残とみられる（未確認）。open PR はなく、活動も見られない。この件を扱う既存 PR・Issue はない（#394 の総括のみ）。claim は PR 本文に記載する。

## 5. 残るリスク・未確認
- **WebKit での効果は未確認。** 失敗の原因を「窓が低く時間の余裕が小さい」と読んでいるが、原因は未確定（#394 の方針どおり）。
  CI の WebKit shard が判定する。
- 同じ型の脆さは、窓が低い他のテスト（例: `cut-skip-failed-bake.spec.ts` の `{0,40}`、`free-finish-e3b.spec.ts` の `{0,30}`）には残りうる。今回は範囲外。
- G-5/G-6（`lunch-rush-r8-restore.spec.ts`）のページのクラッシュ・時間切れは別の型で、この変更では直らない（#680）。
- 針の補助関数そのもの（`pauseAt` の遅れの診断など）の改善案は、別の docs（`gestures-needle-helper-proposal.md`、Owner に送付済み）にある。

## 6. Final Gate の確認項目（PR で記録）
build / classify / layout-chromium / Layout Contract Gate / WebKit 6 shard / WebKit Gate、Codex レビュー、未解決スレッド。
merge は Owner の別途承認後。マージ後に限り、PR #759 の main 取り込みと Final Gate 再判定を別途指示する。
