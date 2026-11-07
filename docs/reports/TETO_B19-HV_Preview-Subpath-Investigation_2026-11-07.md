# B19 HV を既存 `teto-pizza-game-preview` 内の専用パスで提供できるか（docs-only 調査）

2026-11-07。Owner 方針: 新規リポジトリは作らない（以前の作成承認は撤回）。`b19-hv-repo-kit` と検証成果は保持。調査のみで、デプロイ・push（Preview repo へ）・PR・merge・共有 Preview 更新はしていない。ローカルでの試験ビルドのみ。
ラベル: 【実測】= 今回 repo / GitHub で確認、【推論】、【未確認】。対象 B19 シード HEAD `8137dc3ba61d636d777b05596b8866f5a74a9d03`（PR #783 `abb3da5a` + Preview 専用シード）。

## 結論
1. **可能。しかも既に設計・実装済みの下地がある【実測】**: Preview repo のブランチ `claude/pr-scoped-preview-pages`（HEAD `02c06e29`、PR なし、未 merge）が、`pr/<slug>/` に PR ごとのページを共有 Preview と共存させる workflow 一式（`pr-page.yml`＋ `.github/scripts/pr-pages/*`、48→87 の offline テスト、Codex レビュー反映済み）を持つ。`site/`（共有 Preview）を書き換える `deploy-from-source.yml` の `rm -rf site` は `pr/` に触れないため、共有 Preview の更新で B19 ページが消えない。
2. **そのままでは B19 には使えない（要改修 2 点）**: (a) `validate-inputs.sh` は「PR の現在の head SHA」しか受け付けず、B19 の `8137dc3b` は PR #783 の head（`abb3da5a`）ではないため拒否される。(b) 保存キーの付け方が Owner 指定の `teto-pizza-b19-hv-save-v1` ではなく `<key>--<slug>`（例 `teto-pizza-preview-save-v1--pr-783-8137dc3`）。
3. 共有 Preview の既存コンテンツ・保存・URL・バッジ・SHA は、**site/ が一切変わらないため影響しない**。ただし `pages.yml` を変更する（下記）ため、その変更自体が Owner の承認事項。
4. 同じ origin（`perusonao.github.io`）の制約は消えない。**プライベートタブ必須**は変わらない。

## 現状【実測】
- `site/`: `index.html`、`manifest.webmanifest`、`assets/`、`icons/`（共有 Preview は `78de12a`/PR #738、Built 2026-11-06T16:00:50Z、main `4a66b3c`）。
- 配信は 2 段階の手動運用: `deploy-from-source.yml`（`rm -rf site` → ビルドを cp → main に push）→ `pages.yml`（`workflow_dispatch`。GITHUB_TOKEN の push は他 workflow を起動しないため、直近の run はすべて手動）。現 main の `pages.yml` は push 時 `paths: site/**` に限定済み。
- したがって **repo の main に何かを push しても、pages.yml を実行するまで公開は変わらない**【実測: 直近 run は全て workflow_dispatch】。
- 他ブランチ: `claude/pages-push-paths-filter`（main に取り込み済みの内容）、`claude/iphone-safari-hv-prep-112710`。

## B19 専用パスを追加した場合の差分（案 S: `pr-scoped-preview-pages` を流用）
- 追加（infra のみ。`site/` は不変）: `pr-page.yml`、`.github/scripts/pr-pages/*`（検証・パス保護・キー付け替え・ロールバック・live 検証）、`docs/PR-PAGES.md`、`tests/*`。
- 変更: **`pages.yml` 1 本**。`site/` ＋（あれば）`pr/` を `_pages` に組み立て、`pr/` が無ければ成果物は従来の `path: site` と同一（`diff -r` で検査）。main との差は push の `paths` フィルタのみで、衝突は軽微【実測: base `d5202f7f` → main は pages.yml +2 行と README のみ】。
- 公開 URL: `https://perusonao.github.io/teto-pizza-game-preview/pr/pr-783-8137dc3/?hv=b19-pesto-burrata`（および `?hv=b19-crudaiola`）。
- 必要な改修（B19 用）: 入力検証に「PR 本文の head ではなく、PR #783 の head の子孫で、シード用ブランチの固定 SHA」を許す明示モード（固定 40 桁 SHA、作者許可リスト、他は据え置き）を追加。キー名は `--<slug>` 方式のままにするか、slug を `b19-hv` にして `…--b19-hv` に揃える（Owner 判断）。

## 既存 Preview への影響【実測・推論】
| 項目 | 影響 |
|---|---|
| ルート URL・`site/` の内容・アセット | なし（site/ 不変。`pages.yml` は `site/pr` の存在を禁止し、ルートが `site/` と同一であることを `diff -r` で検査） |
| バッジ・SHA | なし（共有 Preview は PR#738 / `78de12a` のまま。B19 ページは別ビルドで `PR#783 · 8137dc3`） |
| 共有 Preview の保存 | 触れない。B19 ページは `teto-pizza-preview-save-v1--<slug>` 等 4 キーすべてを付け替え（cheese-canvas・hint5-optin・`teto.dev.researchIdentify` を含む）。ビルドが未知の `teto-` キーを見つけたら失敗する fail-closed 設計 |
| Production の保存 | 触れない（Preview ビルドに本番キー文字列なし。共有 origin のため、プライベートタブ運用は継続） |
| 公開タイミング | `pages.yml` 実行までは変わらない。**実行すると main 全体が公開される**ため、`check-root-synced.sh` が「ライブのルート＝main の `site/index.html`」を要求（未公開の共有 Preview 更新を巻き込まない） |
| 共有 Preview の次回更新 | `pr/` はそのまま残る（`site/` だけが置換される）。撤去を忘れると B19 ページが残るので終了後に remove |

## B19 専用保存キーの適用
- 案 S: ビルド後に全ファイルの `teto-…` リテラルを `<key>--<slug>` に付け替え。**8137dc3b で実測**: 4 リテラルが付け替えられ（`teto-pizza-preview-save-v1`、`teto-pizza-cheese-canvas`、`teto-pizza-preview-hint5-optin`、`teto.dev.researchIdentify`）、未知のリテラルなし、`patch-build.sh` 成功。
- Owner 指定の `teto-pizza-b19-hv-save-v1` にしたい場合は、保存キー 1 つだけを別名にする小改修（または既存の `VITE_SAVE_KEY_OVERRIDE` パッチを併用）が必要。ただし他の 3 キーの付け替えが失われるため、**`--<slug>` 方式の採用を推奨**（機能上、本番・共有 Preview と分離）。

## ローカル検証（デプロイなし・Chromium 390×844）
Preview ビルドを `--base=/teto-pizza-game-preview/pr/pr-783-8137dc3/` で作り `patch-build.sh` を適用、`/teto-pizza-game-preview/pr/pr-783-8137dc3/?hv=b19-crudaiola` を開いた結果:
- ダミーの本番キー・共有 Preview キー・cheese-canvas・hint5-optin は**値が不変**。書き込まれたのは `…--pr-783-8137dc3` のみ（Pitz 999、burrata 未所持、既発見 83、reload で維持）。
- バッジ `PREVIEW · PR#783 · 8137dc3`、manifest の `start_url`/`scope` は新パス、外部リクエスト 0、ページエラー 0、CSP 違反メッセージ 0（`connect-src 'self'`）。
- **未実施**: 同ブランチの offline テスト（`tests/pr-pages.test.sh`）は、外部由来コードの実行として自動承認が拒否されたため走らせていない。Owner 承認のもとで走らせるか、内容を読んで取り込む。

## 検証後の撤去（B19 ディレクトリだけ）
- 手順 1: `pr-page.yml` を `action=remove`（`pr_number=783`、`sha`、`confirm=<slug>`）で実行 → `pr/<slug>/` だけを削除して `pages.yml` を再公開し、URL が 404 になるまで待つ。
- 手順 2（手動）: `pr/pr-783-8137dc3/` を GitHub の Web 画面で削除 → `pages.yml` を実行。
- 共有 Preview（`site/`）には触れない。ファイルは公開リポジトリの git 履歴に残る（秘密情報なし）。

## 既知のリスク・限界
- 同一 origin は分離できない（案 S の docs 自身も「サンドボックスではない」と明記）。CSP は fetch/XHR を止めるが、同一 origin の storage アクセスは止められない。完全な分離は別 origin のみ（新規リポジトリは撤回済みのため非採用）。
- `pages.yml` の変更と `pr-page.yml` の追加は共有 Preview リポジトリの変更。**Owner 承認が要る**。
- ブランチは 2026-10-16 の古い base で、`pages.yml` の取り込みと実運用での再検証が要る。GitHub 上の Pages / Environment 設定は未確認。
- 実機 HV は 0 PASS。

## Owner 判断（推奨つき）
1. 案 S（`claude/pr-scoped-preview-pages` を流用）で進めるか — **推奨: はい**（実績・テスト・撤去手順あり、`site/` 不変）。代案は `pages.yml` を触らない新設計だが、`rm -rf site` による消失を避ける仕組みを自作することになり非推奨。
2. B19 用の入力検証の拡張（固定 SHA ＋ PR head の子孫）を承認するか。
3. 保存キーは `--<slug>` 方式で良いか（推奨）。
4. Preview repo への push（infra のみ、公開はしない）を別ブランチで行ってよいか。公開（`pages.yml` 実行）は別承認。
5. `b19-hv-repo-kit` は保持（`build-site.sh`/`verify-site.sh` の検査項目は案 S の検証に流用可）。
