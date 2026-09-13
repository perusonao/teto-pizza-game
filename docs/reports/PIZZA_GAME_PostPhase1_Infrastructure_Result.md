# Phase 1マージ後 基盤整備 結果報告

## 概要

Phase 1 (PR #1) マージ後、Phase 2着手前に開発・公開基盤を最小構成で整備した。
ゲームロジック・Phase 2機能への変更は行っていない。

## 実施内容

1. `main` (base SHA `0f3f553e1a99b95c2926bf0313687e5ed39fbec`) から新規ブランチ
   `claude/teto-pizza-phase-1-infra-mzr1rp` を作成
2. `.github/workflows/ci.yml` を追加
   - トリガー: `pull_request` (base: `main`)
   - `npm ci` → `npm run lint` (oxlint) → `npm run build` (`tsc -b && vite build`)
3. `.github/workflows/deploy.yml` を追加（GitHub Pages自動デプロイ）
   - トリガー: `main` への `push`（+ `workflow_dispatch`）
   - `npm ci` → `npm run build` → `actions/configure-pages` →
     `actions/upload-pages-artifact` (path: `dist`) → `actions/deploy-pages`
4. `vite.config.ts` に `base: '/teto-pizza-game/'` を追加
   - `favicon.svg` は `public/` 配下にあるためVite標準の`base`解決で自動的に
     `/teto-pizza-game/favicon.svg` に書き換わることを確認
   - `src/` 配下に絶対パス (`/xxx`) でのアセット参照が無いことを確認済み
   - `npm run build` 後の `dist/index.html` で `script src` / `link href` /
     favicon の全てが `/teto-pizza-game/...` プレフィックス付きで出力される
     ことを確認済み
5. `README.md` にPublic Demo URLを追加
   - `https://perusonao.github.io/teto-pizza-game/`
6. `npm ci` / `npm run lint` / `npm run build` をFresh実行し全て成功

## Fresh実行結果

```
$ rm -rf node_modules dist
$ npm ci
added 30 packages, and audited 31 packages in 3s
found 0 vulnerabilities

$ npm run lint
> oxlint
(no errors, exit code 0)

$ npm run build
> tsc -b && vite build
✓ 33 modules transformed.
dist/index.html                   0.53 kB
dist/assets/teto-DM06YT9o.webp    7.23 kB
dist/assets/index-BNnQSDOS.css    6.49 kB
dist/assets/index-IJW83Ekm.js   236.97 kB
✓ built in 376ms
```

## 必ず報告する項目

| 項目 | 内容 |
|---|---|
| base main SHA | `0f3f553e1a99b95c2926bf0313687e5ed39fbec` |
| commit SHA | `133b439a92a246aa0db6b53d42e364e47136e526`（PR #2 マージコミット、`main` HEAD） |
| PR URL | https://github.com/perusonao/teto-pizza-game/pull/2（**MERGED**） |
| CI結果 | **成功（green）**。`ci.yml` の `build` ジョブが `completed` / `success` (Run: https://github.com/perusonao/teto-pizza-game/actions/runs/34748686460 ほか)。マージ後、`mergeable_state: clean`のままPR #2はマージ済み。ローカルでの`npm ci`/`lint`/`build`もFresh実行で全て成功（上記参照） |
| Pages設定 | **未完了（手動UI操作が必要）— 実測で確認済み**。`main`マージ後に`deploy.yml`が自動起動（Run: https://github.com/perusonao/teto-pizza-game/actions/runs/34749026402）。`npm ci`/`npm run build`ステップは成功（Vite base設定がCI環境でも正しく機能することを確認）したが、`actions/configure-pages@v5`ステップが失敗し、後続の`upload-pages-artifact`/`deploy`はskippedとなった。原因はリポジトリでGitHub Pagesが未有効化（Settings → Pages → Source未設定）のため。**Settings → Pages → Source を「GitHub Actions」に設定後、`deploy.yml`を再実行（workflow_dispatchまたは次のmain push）すれば成功する見込み** |
| Public Demo予定URL | `https://perusonao.github.io/teto-pizza-game/`（Pages有効化・初回デプロイ成功後に利用可能） |
| default branch状態 | **未変更**。引き続き `claude/teto-pizza-shop-phase-0-1-364h1p` のまま（API経由でのdefault branch変更手段がこのセッションのツールセットに存在しないため、手動UI操作が必要） |
| Phase 2開始可否 | **可（コード基盤としては完了）**。PR #2はマージ済み、CIはgreen、`main`にCI/Pages workflowとVite base設定が反映済み。残るのはリポジトリ管理者による手動UI操作2件（Pages Source設定・default branch変更）のみで、Phase 2のコード開発自体を妨げるものではない |

## 必要な手動GitHub UI操作（API経由では実行不可）

1. **Settings → Pages**
   - "Build and deployment" の Source を **GitHub Actions** に設定する
   - （初回のみ必要。設定後は `deploy.yml` が `main` push時に自動デプロイする）
   - 設定後、`Deploy to GitHub Pages` ワークフローを手動再実行（Actions タブ →
     `workflow_dispatch`）するか、`main` に何か1つpushすれば初回デプロイが
     成功する（`npm ci`/`npm run build`ステップは既にCI上で成功確認済み）
2. **Settings → Branches**
   - Default branch を `claude/teto-pizza-shop-phase-0-1-364h1p` から **`main`** に変更する
   - 変更後、既存の未マージブランチがある場合はベースを `main` に付け替える

いずれもリポジトリ管理者権限が必要な操作であり、このセッションで利用可能な
GitHub MCPツールセットには repository settings (default branch) および
Pages configuration を変更するAPIが含まれていないため、GitHub Web UI上での
手動操作が必要。

## 変更していないもの

- ゲームロジック（`src/state/`, `src/data/` 等）
- Phase 2機能
- 既存のREADME本文構成（Public Demo URLの1行追加のみ）
