# Phase 1B — Cloudflare Pages 独立 Preview：Phase 1 実装計画

> **【2026-10-23 位置づけ】比較資料（案の一つ）です。採用済みの実装方針ではなく、本計画の実装は承認されていません。** Cloudflare のアカウント・プロジェクト・トークン、および新規の外部サービスは Owner が**未承認**です。下記の「Owner の操作が先に必要（§8）」は未実施のまま保留です。方式の比較は `TETO_PHASE-1B_PER-PR-PREVIEW_Fresh-Audit.md`、R8 の HV 準備は `TETO_R8_IPHONE-SAFARI-HV-PREP_Result.md` を参照してください。

- 種別: **計画のみ（docs-only）。実装開始前に停止します。**
- 実施していないこと: Cloudflare へのアクセス／デプロイ、トークン登録、GitHub Actions／Pages 設定の変更、workflow の追加、runtime 変更、共有 Preview 更新、本番 FINISH 有効化、PR 作成・merge。#615・#584・#394 にも触れていません。
- 前提: `TETO_PHASE-1B_PER-PR-PREVIEW_Fresh-Audit.md`（以下「Fresh Audit」）。Owner 方針: Cloudflare Pages Direct Upload を第一候補／PR 別の安定 URL とデプロイ固有 URL を使い分ける／共有 Preview は維持・凍結／最初の HV 対象は #618 R8 の保存安全性／アカウントとトークンは Owner 管理。
- 対象 `main` = `83f4b55`。

## 0. 要約

1. 設計は Fresh Audit のとおりで成立する。再検証で**修正・追加すべき点が 5 つ**あった（§2.2）。特に **API トークンの権限はアカウント単位**で、プロジェクト単位に絞れる記載を確認できなかった。専用の Cloudflare アカウントを推奨する。
2. Preview ビルドを `--base=/` で実際に作って測った（デプロイなし、scratch 出力のみ）: **22 ファイル／2.1 MB／最大 1.3 MB**。無料枠の上限（20,000 ファイル、1 ファイル 25 MiB）には大きな余裕がある。
3. workflow は **Preview repo に 1 本**（ビルド job＝トークンなし、deploy job＝承認付き Environment）。source repo の CI・runtime・本番設定は変更しない。
4. 受け入れ条件は 14 項目（§5）。最初のスモークと #618 R8 HV の手順、ロールバックも §7〜§9 に記載。
5. **Owner の操作が先に必要**（§8）。それまで実装は始めない。

## 1. 現行 workflow との差分（確認済みの事実）

| 項目 | 共有 Preview（現行、凍結） | 新 workflow（案） |
|---|---|---|
| 置き場 | `perusonao/teto-pizza-game-preview`：`deploy-from-source.yml` ＋ `pages.yml` | 同じ repo に **新規ファイルを追加**（既存 2 本は変更しない） |
| 出力先 | repo の `site/` に commit → GitHub Pages | **Git に置かず** Cloudflare Pages に直接アップロード |
| base | `--base=/teto-pizza-game-preview/` | `--base=/`（アプリは `import.meta.env.BASE_URL` で参照しており対応済み。測定時のビルドで `index.html` の資産パスが `/…` になることを確認） |
| manifest | `start_url`／`scope` を `sed` で `/teto-pizza-game-preview/` に | 同じ `sed` で `/` に（測定ビルドで元の値が `/teto-pizza-game/` のまま残ることを確認＝書換えは必須） |
| Node | 20 | **22**（source の `ci.yml`／`deploy.yml` と同じ） |
| 環境変数 | `VITE_PREVIEW_MODE=1`、`VITE_PREVIEW_PR`、`VITE_PREVIEW_SHA` | 同じ。**`VITE_FIREBASE_*` は渡さない** |
| 実行権限 | `contents: write`（main へ push） | ビルド job は `contents: read` のみ。deploy job だけが Cloudflare のトークンを使う |
| 履歴 | ビルドごとに main へ commit | なし（repo は増えない） |

## 2. 公式仕様に照らした再検証

**方法と限界**: このセッションは `developers.cloudflare.com` などへ直接アクセスできません（`WebFetch` が DNS エラー）。検索結果が返す公式ページの要約でのみ確認しており、**条文の原文は未確認**です。下の「確度」は、要約の根拠が公式ドキュメント由来か、ほかの出典かを表します。スモーク（§7）で実機・実環境の確認を取ります。

### 2.1 確認できた事項

| 事項 | 確認内容 | 確度 | スモークで確認 |
|---|---|---|---|
| Direct Upload | `wrangler pages deploy` で事前ビルドを直接アップロードできる。CI 用ガイドあり | 公式（要約） | 実行して成功すること |
| フラグ | `--branch`（デプロイ先ブランチ）、`--commit-hash`（デプロイに付く SHA）、`--commit-message`、`--commit-dirty` | 公式（要約） | 出力と Dashboard に SHA が出る |
| Git 外では branch 必須 | Git 管理下でない場所では `--branch` を明示する必要がある | 公式（要約） | 明示指定で運用 |
| 戻せない選択 | **Direct Upload のプロジェクトは後から Git 連携へ切り替えられない** | 公式（要約） | 受容する（Git 連携は採らない） |
| ブランチ別の安定 URL | ブランチ名は小文字化され、英数字以外は `-` に置換される。`fix/api` → `fix-api.<project>.pages.dev`。エイリアスは最新デプロイを指す | 公式（要約） | `pr-618` で確認 |
| デプロイ固有 URL | ハッシュ URL は新しいデプロイ後も直接アクセスできる | 公式（要約） | 2 回デプロイして旧ハッシュが生きていること |
| Preview の公開範囲 | **既定で公開**。Cloudflare Access で保護でき、パターンは `*.{project}.pages.dev` | 公式（要約） | 公開で開けることを確認（保護は任意） |
| 削除 | API `DELETE …/pages/projects/{project}/deployments/{id}`（Pages Write 権限）。**エイリアス付きの非 production デプロイは `force` が必要**。wrangler にも `pages deployment delete`（`--force`）がある | 公式（要約） | 削除手順を実行 |
| 削除の制約 | **ブランチの最新デプロイは削除できない**（要約の記述）。エラー内容は未確認 | 公式（要約・要検証） | 最新を消そうとして挙動を記録 |
| トークン | カスタムトークンで **Account → Cloudflare Pages → Edit** が必要。Workers 用テンプレートには Pages が含まれない | 公式（要約） | 権限不足で失敗する負の確認 |
| 無料枠 | 月 500 ビルド（20 分タイムアウト、同時 1）、1 サイト 20,000 ファイル、1 ファイル 25 MiB | 公式（要約。取得元ページは約 47 日前の更新と表示） | 測定値と比較（§2.3） |

### 2.2 Fresh Audit からの修正・追加

1. **トークンはアカウント単位**: Pages 権限は Account レベルで設定する。1 プロジェクトに限定できると読める記載は見つからなかった。トークンが漏れると**そのアカウントの全 Pages プロジェクト**を編集できる。→ **この用途専用の Cloudflare アカウント（無料）を推奨**。既存アカウントを使うなら、同居するプロジェクトを Owner が許容できるか判断が要る。
2. **無料枠の数え方**: Pages の概要は「月 500 **デプロイ**」と書いている一方、限界ページは「500 **ビルド**」。Direct Upload が数えられるかは確定できない。→ **数えられるものとして予算を立てる**（§6）。Fresh Audit の「未確認」を維持。
3. **「最新デプロイは削除できない」**: 削除運用が単純でない。PR のエイリアスが指す最新デプロイは、新しいデプロイを作るか、プロジェクト／ブランチ単位で片付ける必要がある。→ 運用は「期限切れの**古い**デプロイを消す」「PR 終了後は最後のデプロイを残すか、プロジェクトごと作り直す」の 2 通りを Owner が選ぶ（§6.3）。
4. **production ブランチ**: Direct Upload のプロジェクトにも production ブランチがある。`--branch` がそれと一致すると、**production デプロイ**（`<project>.pages.dev`）になる。→ Preview 専用に作る場合は production ブランチを**使わない名前**にし、workflow に「`--branch` が production ブランチと一致したら失敗」のガードを入れる（フラグ名はスモーク前に `wrangler pages project create --help` で確認）。
5. **製品の方向性**: 第三者の記事は「Cloudflare は新規プロジェクトに Workers の静的アセットを勧めている」と述べるが、**Pages の非推奨・廃止の公式告知は見つからなかった**。→ Phase 1 は Pages で進める（Owner 方針）。リスクとして記録し、Workers の静的アセット＋プレビュー URL を**代替**に残す（本調査では詳細未確認）。

### 2.3 実測（デプロイなし）
`VITE_PREVIEW_MODE=1 VITE_PREVIEW_PR=618 VITE_PREVIEW_SHA=83f4b55 npx vite build --base=/`（scratch に出力、repo に影響なし）:

| 項目 | 値 | 無料枠の上限 |
|---|---|---|
| ファイル数 | 22 | 20,000 |
| 合計 | 2.1 MB | （サイズ上限の記載なし） |
| 最大ファイル | 約 1.3 MB（JS） | 25 MiB |
| `AIza`（Firebase apiKey 形式）を含むファイル | 0 | — |

## 3. 設計

### 3.1 Cloudflare 側の命名
| 項目 | 案 | 備考 |
|---|---|---|
| アカウント | Preview 専用の新規アカウント（推奨） | §2.2-1 |
| プロジェクト名 | `teto-pizza-preview`（Owner が決定） | `<name>.pages.dev` はグローバルに一意。取得できない場合は別名 |
| production ブランチ | 使わない名前（例 `unused-production`） | §2.2-4。`<project>.pages.dev` 直下は空のまま |
| PR 用ブランチ名 | `pr-<n>`（例 `pr-618`） | 安定 URL: `pr-618.<project>.pages.dev` |
| 検証対象用（任意） | `pr-<n>-<label>`、`[a-z0-9-]`、**全体 28 文字以内**（長さ制限の有無は未確認のため保守的に） | 例 `pr-618-r8hv` |
| デプロイ固有 URL | デプロイごとに自動（`<hash>.<project>.pages.dev`） | 再現性重視の HV |

### 3.2 URL の使い分け
| 用途 | 使う URL | 理由 |
|---|---|---|
| 通常の確認、更新をまたぐ互換確認 | PR のエイリアス | 同じ origin ＝同じ保存を引き継ぐ。再デプロイで最新を指す |
| 再現性が要る HV（#618 R8 の B・D・E など） | その回のハッシュ URL | 毎回空の保存から始まり、他のデプロイと混ざらない。新しいデプロイ後も生き続ける |
| 旧ビルド互換の確認 | エイリアス（旧 SHA→新 SHA の順に 2 回デプロイ） | 同一保存で旧→新を踏む |

### 3.3 workflow（設計案。**リポジトリには追加しない**）
置き場: `perusonao/teto-pizza-game-preview/.github/workflows/deploy-pr-preview.yml`（新規）。

```yaml
name: Deploy PR preview (Cloudflare Pages)
on:
  workflow_dispatch:
    inputs:
      ref:       { description: "perusonao/teto-pizza-game の branch / tag / commit SHA", required: true }
      pr_number: { description: "対象 PR 番号（数字のみ）", required: true }
      label:     { description: "任意。検証対象の別名（[a-z0-9-]、先頭に pr-<n>- が付く）", required: false, default: "" }
permissions: {}                       # 既定は何も許可しない
concurrency: { group: "pr-preview-${{ inputs.pr_number }}${{ inputs.label }}", cancel-in-progress: false }

jobs:
  build:                              # ← PR のコードを実行する。秘密情報なし
    runs-on: ubuntu-latest
    permissions: { contents: read }
    outputs: { sha: ..., short: ..., branch: ... }
    steps:
      - 入力検証: pr_number は ^[0-9]+$、label は ^[a-z0-9-]{0,16}$、branch 名 = pr-<n>[-<label>] が 28 文字以内
      - checkout: repository=perusonao/teto-pizza-game, ref=inputs.ref, path=source（トークン不要。public）
      - setup-node 22 / npm ci
      - env: VITE_PREVIEW_MODE=1, VITE_PREVIEW_PR=<n>, VITE_PREVIEW_SHA=<short>   # VITE_FIREBASE_* は定義しない
      - npx vite build --base=/ --outDir dist-preview
      - manifest の start_url / scope を "/" に sed
      - noindex の <meta> を挿入、_headers を生成（X-Robots-Tag: noindex, nofollow / preview-info.json は no-store）
      - preview-info.json を生成（§3.4）
      - ガード: dist-preview 内に "AIza" や firestore の接続先文字列がない／manifest が "/" ／preview-info.json の commit = checkout の HEAD
      - actions/upload-artifact（dist-preview）

  deploy:                             # ← トークンを使う。PR のコードは実行しない
    needs: build
    runs-on: ubuntu-latest
    permissions: { contents: read }
    environment: cloudflare-preview   # Owner が Required reviewers を設定 ＝ 実行前の承認ゲート。secrets はこの Environment にのみ置く
    steps:
      - actions/download-artifact
      - ガード: branch が production ブランチ名と一致したら失敗
      - npx wrangler@<固定版> pages deploy dist-preview --project-name=<project> --branch=<branch> --commit-hash=<full sha> --commit-message="PR #<n> <short>"
        env: CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID（Environment secrets）
      - Job Summary に: PR エイリアス URL、デプロイ固有 URL、SHA、時刻、run URL
```

設計上の要点:
- `wrangler-action` を使わず `wrangler` を**バージョン固定**で直接実行する（`firebase-production-deploy.yml` の `FIREBASE_TOOLS_VERSION` 固定と同じ方針）。公式例が要求する GitHub 側の `deployments: write` も不要になる。サードパーティ action を増やさない。
- action は commit SHA で固定する。
- **ビルドと deploy を別 job に分ける**のは、PR のコード（`npm ci` のスクリプト、vite のプラグイン）がトークンに触れないようにするため。`pull_request`／`pull_request_target`／`workflow_run`／`issue_comment` は使わない（Owner Gate と同じ方針）。
- 「`ref` が source repo の PR の head であること」の追加検証（fork 由来の SHA 排除）は任意。Phase 1 は Owner が `ref` を指定する前提とし、Phase 2 で検討。

### 3.4 `preview-info.json`
```json
{
  "schema": 1,
  "sourceRepo": "perusonao/teto-pizza-game",
  "ref": "<入力値>",
  "commit": "<40 桁>",
  "shortSha": "<7 桁>",
  "pr": 618,
  "label": "",
  "branch": "pr-618",
  "builtAt": "2026-…Z",
  "workflowRunUrl": "https://github.com/perusonao/teto-pizza-game-preview/actions/runs/…",
  "firebase": "disabled (no VITE_FIREBASE_* at build)",
  "freeFinishOptIn": "append ?freeFinish=on to the URL (Preview only; page-load scoped)"
}
```
バッジ（`PREVIEW · PR#618 · 83f4b55`）と一致することが受け入れ条件。

### 3.5 影響範囲（変更しないものの明示）
| 対象 | 変更 |
|---|---|
| source repo（`src/**`、`e2e/**`、`ci.yml`、`e2e-webkit.yml`、`deploy.yml`、`firebase-production-deploy.yml`、secrets） | **なし** |
| `FREE_COOK_FINISH_PRODUCTION` | **変更しない**（`false` のまま） |
| 共有 Preview（`site/`、`pages.yml`、`deploy-from-source.yml`、GitHub Pages 設定） | **なし**（`224672d`／PR #582 のまま凍結） |
| Preview repo | `deploy-pr-preview.yml` の追加、Environment `cloudflare-preview` の作成（Owner） |
| docs | 運用が確定した後に `TETO_SESSION-OPERATIONS_1.0.md` §5 を更新（Phase 2） |

## 4. トークンと権限
| 項目 | 方針 |
|---|---|
| Cloudflare アカウント | 専用の無料アカウント（§2.2-1）。2 要素認証を有効化 |
| トークンの種類 | **Account API token（カスタム）**。権限は `Account → Cloudflare Pages → Edit` のみ。Zone・Workers・DNS・R2 などは付与しない |
| 有効期限 | 設定する（例 90 日。期限切れで deploy が失敗することを運用に織り込む） |
| 保管 | GitHub の **Environment secrets**（`cloudflare-preview`）に `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。repo secrets には置かない。Claude セッションは値を扱わない |
| 承認 | Environment の Required reviewers に Owner を設定 → deploy job は承認されるまで秘密情報にアクセスできない |
| 失効手順 | Cloudflare で当該トークンを Revoke → GitHub の Environment secrets を削除。その後ブランチ別デプロイは残るが新規は作れない |
| 到達範囲 | トークンはアカウント内の全 Pages プロジェクトに及ぶ（§2.2-1）。専用アカウントなら実質このプロジェクトのみ |

## 5. 受け入れ条件（Phase 1 完了の定義）

| ID | 条件 | 確認方法 |
|---|---|---|
| AC-1 | **PR 別 origin**: Preview の `location.origin` が `https://pr-<n>.<project>.pages.dev`（またはハッシュ URL）で、`perusonao.github.io` と異なる | ブラウザ／Safari の Web Inspector |
| AC-2 | **URL の使い分け**: 同じ PR で 2 回デプロイし、(a) エイリアスは新しい SHA を指す (b) 1 回目のハッシュ URL は旧 SHA のまま開ける | `preview-info.json` の `commit` を 3 つの URL で比較 |
| AC-3 | **SHA 表示**: 画面のバッジの PR 番号／short SHA が、`preview-info.json`、workflow の Job Summary、Cloudflare の `--commit-hash` と一致 | 目視＋比較 |
| AC-4 | **`preview-info.json`**: `/preview-info.json` が 200 で §3.4 の全項目を含み、`Cache-Control: no-store` | `curl -I`／ブラウザ |
| AC-5 | **Firebase 無効化**: (a) ビルド job に `VITE_FIREBASE_*` がない (b) `dist-preview` に `AIza` 等の apiKey がない (c) 実行中に Firestore／Identity Toolkit へのリクエストが出ない | workflow ログ、`grep`、Network タブ |
| AC-6 | **保存データ分離**: (a) 新 origin の `localStorage` に `teto-pizza-save-v1` がない (b) 遊ぶと `teto-pizza-preview-save-v1` だけが書かれる (c) PR A のハッシュ URL と PR B のエイリアスで保存が見えない (d) 検証前後で本番（`perusonao.github.io/teto-pizza-game/`）の保存キーが**未変更**（読み取りのみで比較） | Web Inspector（読み取りのみ。`clear()` 禁止） |
| AC-7 | **FINISH opt-in**: `?freeFinish=on` で Free Cooking に FINISH が出て、再読み込み（パラメータなし）で OFF に戻る。`git diff` で `FREE_COOK_FINISH_PRODUCTION` に変更なし | 実機＋差分確認 |
| AC-8 | **iPhone Safari 到達**: HTTPS で開け、バッジが見え、Guided が最後まで遊べる。manifest の `scope`／`start_url` は `/` | 実機 |
| AC-9 | **noindex**: HTML に `<meta name="robots" content="noindex, nofollow">`、`X-Robots-Tag: noindex, nofollow` | `curl -I` |
| AC-10 | **削除**: wrangler／API で古いデプロイを削除でき、そのハッシュ URL が到達不能になる。最新デプロイ削除の挙動を記録（§2.2-3） | 手動 |
| AC-11 | **復元**: 記録した SHA で再実行すると同じ `commit` の Preview が得られる（バイト同一は求めない） | `preview-info.json` |
| AC-12 | **無影響**: 共有 Preview は `224672d`（README の記載が不変）、source repo は変更なし、本番の Pages デプロイ履歴に新しい run がない | Actions 履歴 |
| AC-13 | **秘密情報**: ログにトークンが出ない。ビルド job に secrets がない。deploy は Environment 承認を経た | run ログ、Environment 履歴 |
| AC-14 | **コスト**: 月間デプロイ回数を記録し、予算内（§6） | Cloudflare Dashboard |

## 6. 無料枠・運用

### 6.1 無料枠（§2.1 の確度で）
- 月 500 デプロイ／ビルド（Direct Upload が数えられる前提で予算）。1 サイト 20,000 ファイル（実測 22）。1 ファイル 25 MiB（実測最大 約 1.3 MB）。
- 予算案: 通常 1 PR あたり 3〜5 回、同時に 3 PR 程度 → 月 60 回前後。上限の 12% 程度。月の消費が 300 を超えたら Owner に報告。
- Cloudflare Pages のプロジェクト数の上限は確認できていない（§2 注）。1 プロジェクト運用なので問題にならない見込み。
- GitHub 側: Preview repo は public のため Actions 分は無料の想定。Environment の Required reviewers が public repo の無料プランで使えることは未確認（導入時に Owner が確認）。

### 6.2 作成・更新
| 操作 | 方法 | 承認 |
|---|---|---|
| 作成・更新 | `Deploy PR preview` を `ref`／`pr_number`（／`label`）で実行 → Environment 承認 → URL を対象 Issue に記録 | Owner（Environment 承認） |
| 記録様式 | Issue コメントに: PR、SHA、エイリアス URL、ハッシュ URL、実行日時、run URL、対象 HV | 実行者 |

### 6.3 削除・復元
| 操作 | 方法 | 注意 |
|---|---|---|
| 古いデプロイの削除 | `wrangler pages deployment list`／`delete`（エイリアス付きは `--force`）、または API | 最新デプロイは削除できない可能性（§2.2-3） |
| PR 終了後 | 方針 A: 最後のデプロイを残して放置（URL は生きる）／方針 B: 数日後に Owner が一括削除、または**プロジェクトを作り直す** | Owner が選ぶ（§9 判断 4） |
| 端末側の保存 | Safari の当該サイトのデータを消す（origin が違うので本番に影響しない） | `perusonao.github.io` のデータには触れない |
| 復元 | 記録した SHA で再実行。共有 Preview を元に戻す場合は従来どおり `224672d` で再実行（本計画の対象外） | Owner |

## 7. 最初のスモーク手順（Owner 承認後。本書では実施しない）

**目的**: AC-1〜AC-13 を、**#618 の SHA（`83f4b55a404ace3148adbb9058f4d63c5b1a1c55`）**で確認し、そのまま R8 HV の環境にする。

事前（Owner、§8 完了）: Cloudflare アカウント／プロジェクト／トークン、GitHub の Environment とシークレット、workflow の追加（別途 Owner が承認した PR で）。

| 手順 | 内容 | 期待 |
|---|---|---|
| S-0 | `main`（または docs-only の無害な ref）を `pr_number=0 label=smoke` で 1 回デプロイ（実装直後の動作確認用。本番相当の挙動を避けるため PR 番号 0 の専用ブランチ） | deploy 成功、URL が出る |
| S-1 | AC-1・3・4・9 を PC のブラウザで確認 | 合格 |
| S-2 | 同じ入力でもう 1 回デプロイ。AC-2（エイリアスは新、旧ハッシュは旧のまま） | 合格 |
| S-3 | AC-5・6 を確認（Network に Firebase なし、保存キーが `teto-pizza-preview-save-v1` のみ、本番キー未変更） | 合格 |
| S-4 | `?freeFinish=on` の ON／リロードで OFF（AC-7） | 合格 |
| S-5 | iPhone Safari で S-2 のハッシュ URL を開く（AC-8）。QR・AirDrop・メモのリンクのいずれか | 開ける、バッジ表示 |
| S-6 | 削除を試す（AC-10）。最新デプロイ削除の挙動も記録 | 記録される |
| S-7 | `83f4b55…` を `pr_number=618` でデプロイし、バッジが `PR#618 · 83f4b55` になることを確認 | 合格 |
| S-8 | S-7 の**ハッシュ URL**を使って `TETO_R8_IPHONE-SAFARI-HV-PREP_Result.md` のチェックリスト（P→A→B→…）を開始 | 実機 HV |

S-0〜S-7 が全部合格するまで S-8 に進まない。どれかが失敗したら §9（ロールバック）へ。

## 8. Owner が行う Cloudflare 側の操作（Claude は実行しない）

1. **アカウント**: Cloudflare に Preview 専用の無料アカウントを作成（メールは運用用）。2 要素認証を有効化。
2. **プロジェクト作成**: Workers & Pages → Create → Pages → **Direct Upload** を選び、プロジェクト名（例 `teto-pizza-preview`）を決めて作成（最初の資産のアップロードを求められたら、空に近い無害なファイルでよい。**ここで本番ブランチ名を使うデプロイを作らない**）。production ブランチ名は `unused-production` など使わない名前にする（画面または `wrangler pages project create --help` で確認）。**Direct Upload は後から Git 連携に切り替えられない**点を了承する。
3. **API トークン**: My Profile / Account → API Tokens → Create Token → **Custom token**。Permissions: `Account` / `Cloudflare Pages` / `Edit` のみ。Account Resources は当該アカウントのみ。有効期限を設定。作成後に表示される値を控える（一度しか表示されない）。
4. **Account ID**: ダッシュボードのアカウント概要から取得。
5. **GitHub の設定（Preview repo `perusonao/teto-pizza-game-preview`）**: Settings → Environments → New environment `cloudflare-preview` → **Required reviewers に Owner を追加** → Environment secrets に `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` を登録。repo の secrets には置かない。
6. **Preview の公開範囲**: 既定で公開（§2.1）。保護が必要なら Cloudflare Access を後で追加（Phase 3）。Phase 1 は公開のまま（noindex）で進めてよいかを判断（§10）。
7. **実装の承認**: workflow 追加を Claude に依頼する承認（別 PR）。承認前は何も追加されない。
8. **スモークの承認**: S-0 以降の各デプロイは Environment の承認で行う。

## 9. ロールバック

| 状況 | 手順 | 影響 |
|---|---|---|
| スモークの deploy が失敗／想定外 | Environment の承認を拒否。失敗した run は残して原因を記録 | 公開物なし |
| 不要・不適切な Preview を公開した | Cloudflare で該当デプロイを削除（`--force`）。最新で消せなければ、新しい無害なデプロイを同ブランチに作ってから旧を削除、または**プロジェクトごと削除** | 当該 URL が到達不能に |
| トークン漏えいの疑い | Cloudflare で Revoke → GitHub Environment secrets を削除 → 必要なら新トークン | 新規デプロイ不可 |
| 設計自体を取りやめる | workflow ファイルを削除する PR（Owner 承認）、Environment の削除、Cloudflare プロジェクト／アカウントの削除 | **共有 Preview・本番・source は影響を受けない**（変更していないため） |
| 実機 HV 中に問題 | `TETO_R8_IPHONE-SAFARI-HV-PREP_Result.md` §3 の中止条件に従う。Preview の保存は使い捨て。端末側は該当サイトのデータを消す | 本番に影響なし |

**元に戻す対象が実質ない設計**: 共有 Preview・本番・source repo・Pages 設定を一切変更しないため、巻き戻しは「Cloudflare 側の削除」と「workflow ファイルの削除」だけで完結する。

## 10. 未解決事項

1. 外部仕様の**原文未確認**（§2）：トークン権限名の正確な表記、Direct Upload が無料枠の 500 を消費するか、エイリアス長さの制限、最新デプロイ削除の挙動、Pages プロジェクト数の上限、`wrangler pages project create` の production ブランチ指定フラグ。→ スモークと Owner の画面確認で解消。
2. Cloudflare が新規に Workers 静的アセットを勧めている件（§2.2-5）。Pages の廃止告知は見つかっていない。
3. Environment の Required reviewers が public repo の無料プランで使えるか（未確認）。使えない場合は、トークンの権限を最小にした上で `workflow_dispatch` の手動実行のみで代替するか、Owner が判断。
4. `ref` が source repo の正当な PR の head であることの検証（fork 由来の SHA 排除）は Phase 1 では未実装。
5. 共有 Preview の行き先（凍結のまま残す／Phase 1 合格後に廃止＝Pages 設定の変更で別承認）。
6. Safari のホーム画面追加時の保存領域（実機で確認）。ITP による自動削除の挙動（未確認）。
7. docs の更新（`TETO_SESSION-OPERATIONS_1.0.md` §5、HV 手順書）は運用確定後（Phase 2）。

## 11. Owner 判断事項
1. Cloudflare の**専用アカウント**で進めるか（推奨）／既存アカウントを使うか。
2. プロジェクト名と production ブランチ名（使わない名前）。
3. Preview の公開範囲: Phase 1 は**公開（noindex）**でよいか、最初から Access で保護するか。
4. PR 終了後のデプロイの扱い（残す／N 日後に削除／プロジェクト作り直し）。
5. Environment の Required reviewers を Owner 単独にするか。
6. 月間デプロイ数の報告閾値（案: 300 回）。
7. 実装（workflow 追加 PR）を Claude に依頼するタイミングと、スモーク S-0 の承認。
8. 共有 Preview の廃止時期。
9. #618 R8 の実機 HV を、本計画の S-7 で出る**ハッシュ URL**で行う方針でよいか。

## 12. 停止点
本書をもって計画を終え、**実装を開始していません**。workflow の追加、Cloudflare／GitHub の設定、デプロイ、トークン登録、PR 作成は Owner の承認後です。
