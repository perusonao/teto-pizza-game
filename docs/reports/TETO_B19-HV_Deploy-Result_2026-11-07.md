# Batch 19 専用 Preview — deploy 実行結果（Result Report）

2026-11-07。Owner 承認に基づき、`perusonao/teto-pizza-game-preview` の PR 専用ページ workflow を **1 回だけ**実行した。再実行・追加 deploy はしていない。Production ON、共有 Preview の手動更新、PR #783 の merge、他 PR の公開はしていない。実機 HV は **0 PASS**（Owner の iPhone Safari 待ち）。

## 事前確認（実行前）
| 項目 | 結果 |
|---|---|
| preview main | `2ae3a4a671a400d300741405ca0375a710436f70` |
| PR #783 | open（Draft）、HEAD `abb3da5a1021b160b2ee75acbe5a00866a8a0eaf` |
| `source_sha` | `8137dc3ba61d636d777b05596b8866f5a74a9d03`。abb3da5a の strict な子孫（ahead 5・behind 0）、変更 9 ファイルは `src/preview/` と `docs/` のみ（workflow の validate が本物の API で再確認） |
| `site/` | 変更なし（PR #2 の merge 前後で差分 0） |

## 実行
- Workflow: Publish / remove a PR-scoped preview page、**run ID `42403073165`**（run_number 1、attempt 1）、ref `main`、起動 18:48:05Z、完了 18:52:37Z。
- 入力: `action=deploy` / `pr_number=783` / `sha=abb3da5a…` / `source_sha=8137dc3b…` / `confirm=pr-783-8137dc3`。
- 全 job 成功: **validate**（入力検証）→ **build**（固定 SHA の checkout 一致確認、Firebase 設定の混入なし、`npm ci`、PR 用 base path でビルド、`patch-build.sh`（CSP 先頭挿入・保存キー付け替え・文書系ファイル拒否）、artifact）→ **publish**（PR head 再検証、**プリフライト: ライブの共有 Preview が `site/` と一致**、`pr/pr-783-8137dc3/` だけをステージ、公開、Pages 再 deploy、ライブ検証）。ロールバック step は skipped（不要）。
- 公開コミット: `188ec324d67a582ca4cfaa2035d7eaf0a9036b91`（github-actions[bot]、`PR page deploy: pr-783-8137dc3`）。**変更は `pr/pr-783-8137dc3/` の 23 ファイルのみ**（`site/`・README・workflows・docs・tests は不変）。`preview-meta.json`: pr 783、sha `8137dc3b…`、prHeadSha `abb3da5a…`、workflowRun `42403073165-1`。
- Pages: `Deploy Preview to GitHub Pages` run `42403173670`（workflow_dispatch、publish job が起動）**success**。

## 公開 URL（Safari のプライベートタブで開く）
- `https://perusonao.github.io/teto-pizza-game-preview/pr/pr-783-8137dc3/?hv=b19-pesto-burrata`
- `https://perusonao.github.io/teto-pizza-game-preview/pr/pr-783-8137dc3/?hv=b19-crudaiola`
バッジは `PREVIEW · PR#783 · 8137dc3`。URL を新しく開くと再シード、reload・戻る操作では再シードされない。

## 検証
| 項目 | 結果 | 出所 |
|---|---|---|
| ページの HTTP 応答 | `/pr/pr-783-8137dc3/` が 404 → 公開後に 200、`preview-meta.json` の `workflowRun` が今回の run と一致 | CI の live 検証（13 回待機後に成功、log に記録） |
| 共有 Preview | ライブの全 22 ファイル＋ルート URL が `site/` と**バイト一致**（公開前のプリフライトと公開後の検証の両方） | CI |
| Production | 触れていない（別リポジトリ・別 Pages・別 workflow） | 構成 |
| 公開物の挙動（バッジ・保存・外部通信・Worker/frame 遮断） | **公開コミットのバイトそのもの**をローカルで配信して実ブラウザ検証（390×844）: `b19-pesto-burrata`／`b19-crudaiola` とも 33 項目 pass。保存は `…--pr-783-8137dc3` のみ、本番・共有 Preview 用ダミーキーは不変、外部リクエスト 0 | ローカル Chromium |
| シードとレシピ関連の表示 | 両 URL で、バッジ `PREVIEW · PR#783 · 8137dc3`、Pitz 999、burrata 未所持、新 2 レシピ未発見、Shop に「ブッラータ」と NEW が表示 | ローカル Chromium |
| レシピの中身（2 層ソース、チーズ区別、Research 名、焼成〜図鑑） | **未確認**（Owner の実機 HV 項目。PR #783 Result §9） | — |

制約: この作業環境のネットワークは `perusonao.github.io` への接続を遮断している（403）ため、**公開 URL への直接アクセスはできていない**。ライブの応答確認は CI のログに基づく。公開物の挙動は、公開コミットから取り出したファイルをローカルで配信して確認した。実際の iPhone Safari での表示は未確認。

## 残存リスク
- **同一 origin（P1）**: PR のコードが本番・共有 Preview と同じ `perusonao.github.io` で動く。Owner が Batch 19 の限定的な iPhone Safari HV に限り条件付きで受容（PR #2 の該当スレッドは未解決のまま）。CSP と保存キーの付け替えは誤用の防止で、同一 origin の保存へのアクセスは止められない。`sendBeacon` と画面遷移は止まらない。Safari のプライベートタブを使うこと（強制はできない）。他の PR・作者・公開したままの運用は対象外。
- **公開したままにしない**: HV が終わり次第 remove する（下記）。ページは公開リポジトリの git 履歴に残る（秘密情報なし）。
- 実機 HV は 0 PASS。`github-pages` Environment の保護ルールは未確認（今回の run では承認待ちは発生しなかった）。

## 撤去（HV 終了後、Owner の承認で）
Actions → Publish / remove a PR-scoped preview page → `action=remove` / `pr_number=783` / `sha=abb3da5a1021b160b2ee75acbe5a00866a8a0eaf` / **`source_sha=8137dc3ba61d636d777b05596b8866f5a74a9d03`（remove でも必須）** / `confirm=pr-783-8137dc3`。`pr/pr-783-8137dc3/` だけが消え、Pages が再公開され、URL が 404 になるまで待つ。共有 Preview（`site/`）には触れない。
