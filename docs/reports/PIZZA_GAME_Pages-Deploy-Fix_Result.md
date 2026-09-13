# GitHub Pages Deploy Failure 修正結果

## 結論

PR #2 マージ後の GitHub Pages deploy failure は、workflow の不備ではなく
`github-pages` environment の deployment branch policy が旧作業ブランチだけを
許可していたことが原因だった。

許可ブランチを `main` に修正した後、原因確認後の検証として失敗 run を1回だけ
再実行し、build / deploy ともに成功した。Public Demo は HTTP 200 で応答し、
実ブラウザでゲーム画面の描画まで確認済み。

## 調査対象

- repository: `perusonao/teto-pizza-game`
- default branch: `main`
- 調査開始時 main SHA: `133b439a92a246aa0db6b53d42e364e47136e526`
- PR #2: `MERGED`
- 初回失敗 run: https://github.com/perusonao/teto-pizza-game/actions/runs/34749026402
- 手動実行失敗 run: https://github.com/perusonao/teto-pizza-game/actions/runs/34749210841

## Root cause

手動実行失敗 run の deploy job (`103702585399`) は、開始から4秒で失敗し、
`runner_id: 0`、`runner_name: ""`、`steps: []` だった。これは action の処理中ではなく、
environment protection rule の評価時点で job が拒否されたことを示す。

check-run annotation の実メッセージ:

```text
Branch "main" is not allowed to deploy to github-pages due to environment protection rules.
The deployment was rejected or didn't satisfy other protection rules.
```

GitHub API で `github-pages` environment を確認すると、custom branch policy が有効で、
許可対象は旧作業ブランチだけだった。

```text
claude/teto-pizza-shop-phase-0-1-364h1p
```

PR #2 のマージにより deploy 元が `main` へ変わった一方、environment の許可ブランチが
更新されていなかったため、deploy job が runner 起動前に拒否されていた。

なお、main push 直後の初回 run では Pages サイトがまだ有効化されておらず、
`actions/configure-pages@v5` が Pages API の `Not Found` で失敗していた。その後 Pages は
`build_type: workflow` として有効化され、手動 run の build は成功したため、継続していた
deploy failure の直接原因は上記 environment branch policy である。

## Workflow 監査

`.github/workflows/deploy.yml` を GitHub Pages の推奨構成と比較した。

| 確認項目 | 結果 |
|---|---|
| `permissions.contents: read` | 設定済み |
| `permissions.pages: write` | 設定済み |
| `permissions.id-token: write` | 設定済み |
| environment `name: github-pages` | 設定済み |
| environment `url: ${{ steps.deployment.outputs.page_url }}` | 設定済み |
| `actions/configure-pages@v5` | 設定済み |
| `actions/upload-pages-artifact@v3` (`path: dist`) | 設定済み |
| `actions/deploy-pages@v4` | 設定済み |
| deploy の `needs: build` | 設定済み |

結論として workflow 修正は不要。推測による workflow 書き換えは行っていない。

## 実施した修正

GitHub REST API で `github-pages` environment の deployment branch policy を変更した。

- 削除: `claude/teto-pizza-shop-phase-0-1-364h1p`
- 追加: `main`
- 修正後の policy: `main` 1件のみ

これは repository 設定の修正であり、ソースコードや workflow ファイルの変更ではない。

## 検証結果

### GitHub Pages workflow

原因修正後、run `34749210841` を1回だけ再実行（attempt 2）。

- build job `103704296356`: `success`（18秒）
- deploy job `103704334469`: `success`（11秒）
- deploy job steps:
  - Set up job: success
  - `actions/deploy-pages@v4`: success
- run: https://github.com/perusonao/teto-pizza-game/actions/runs/34749210841

### ローカル検証

Windows 用 optional native binding を含む Fresh install と、依存要件を満たす Node.js
`v24.19.0` で実行した。

```text
npm ci              success (0 vulnerabilities)
npm run lint        success
npm run build       success
                     33 modules transformed
                     dist/index.html 0.54 kB
```

ホスト既定 Node.js `v20.8.1` は Vite / oxlint の要求する `^20.19.0 || >=22.12.0`
より古いため、最終検証では bundled Node.js `v24.19.0` を使用した。CI と成果物への影響はない。

### Public Demo 実測

- URL: https://perusonao.github.io/teto-pizza-game/
- HTTP: `200 OK`
- HTML: title `テトのピザ屋さん（仮）`、root element、`/teto-pizza-game/` base path を確認
- JavaScript asset: `200 OK`
- CSS asset: `200 OK`
- 実ブラウザ: タイトル、レシピ図鑑ボタン、ミト/テトの画像と会話、ピザ台、
  「ピザを作る！」ボタンが描画されることを確認

## 変更ファイル

- `docs/reports/PIZZA_GAME_Pages-Deploy-Fix_Result.md`（本報告書）

変更していないもの:

- `.github/workflows/deploy.yml`
- game logic
- UI
- Phase 2 機能

## 必須報告項目

| 項目 | 結果 |
|---|---|
| root cause | `github-pages` environment が旧作業ブランチだけを許可し、`main` deployment を protection rule で拒否していた |
| 修正ファイル | workflow / game code の修正なし。本報告書のみ追加 |
| commit SHA | `REPORT_COMMIT_SHA` |
| PR URL | `REPORT_PR_URL` |
| CI結果 | `REPORT_CI_RESULT` |
| Pages deploy結果 | **成功**。run `34749210841` attempt 2、build / deploy ともに success |
| Public Demo実測結果 | **成功**。HTTP 200、JS/CSS 200、実ブラウザでゲーム画面を確認 |
| Phase 2開始可否 | **開始可**。CI / Pages / Public Demo の阻害要因は解消済み |

