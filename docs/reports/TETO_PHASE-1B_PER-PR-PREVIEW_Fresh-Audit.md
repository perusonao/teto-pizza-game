# Phase 1B — per-PR Preview（独立 origin）Fresh Audit

- 種別: **調査・設計のみ（docs-only）**。デプロイ、GitHub Actions／Pages 設定の変更、runtime 変更、共有 Preview 更新、PR 作成はしていません。#615・#584・#394 には触れていません。
- 調査日: 2026-10-22。対象 `main` = `83f4b55`（#618 merge）。
- 前提（Owner 決定）: 共有 Preview は更新しない／本番で破壊的な HV をしない／PR または検証対象ごとに**独立 origin** の Preview を優先／今回は設計のみ。
- 調べたもの: `CLAUDE.md`、`TETO_SESSION-OPERATIONS_1.0.md` §5・§6、`TETO_HUMAN-VERIFICATION-POLICY.md`、`.github/workflows/*`（`deploy.yml`、`ci.yml`、`e2e-webkit.yml`、`firebase-production-deploy.yml`、`owner-gate.yml`）、`perusonao/teto-pizza-game-preview` の README と 2 つの workflow（`deploy-from-source.yml`、`pages.yml`）と run 履歴、`src/state/persistence.ts`、`src/firebase/config.ts`、`src/components/PreviewBadge.tsx`、`src/preview/*`、`public/manifest.webmanifest`、`vite.config.ts`。
- **未確認の前提**: このセッションは `docs.github.com`・`developers.cloudflare.com`・`firebase.google.com` に直接到達できず（DNS 失敗）、外部サービスの仕様は検索結果の要約でのみ確認しました。GitHub Pages の上限は検索結果で公式文書の記載を確認。Cloudflare・Firebase・Netlify・Vercel の無料枠と挙動は**導入前に Owner が公式ページで再確認する前提**です（本書では「未確認」と明記）。

## 1. 現行構成（事実）

| 項目 | 現状 |
|---|---|
| 本番 | `perusonao/teto-pizza-game`。`deploy.yml` が `main` push で `npm run build` → GitHub Pages（`https://perusonao.github.io/teto-pizza-game/`）。ビルド時に `VITE_FIREBASE_*` を repo secrets から注入（`deploy.yml:39-42`）。`vite.config.ts` の `base` は `/teto-pizza-game/` |
| 共有 Preview | `perusonao/teto-pizza-game-preview`（public）。`deploy-from-source.yml`（手動 `workflow_dispatch`：`ref`、`pr_number`）が source を checkout → `VITE_PREVIEW_MODE=1` ＋ `VITE_PREVIEW_PR`／`VITE_PREVIEW_SHA` で `vite build --base=/teto-pizza-game-preview/` → manifest の `start_url`／`scope` を `sed` で書換え → noindex 追加 → `site/` を **main に commit & push**。`pages.yml` が push で `site/` を Pages にデプロイ。現在は PR #582 の `224672d`（2026-10-21 11:33Z）。repo サイズ 約 23.7 MB、run 履歴 360 件 |
| origin | 本番も Preview も `https://perusonao.github.io`（path だけが違う）。`localStorage`／`indexedDB`／Cache Storage は origin 単位で共有 |
| 保存キー | 本番 `teto-pizza-save-v1`、Preview `teto-pizza-preview-save-v1`（`VITE_PREVIEW_MODE` で切替、`persistence.ts:96-97`）。**全 Preview ビルドが同一キー**を共有（Session Operations §5） |
| 他の保存 | `teto-pizza-cheese-canvas`、`teto-pizza-preview-hint5-optin`、DEV 用バックアップキー、`indexedDB` 5 箇所の参照（`src` 内、テスト除く）。Service Worker は検出なし（`serviceWorker`／`workbox` の grep が 0 件） |
| Firebase | `getFirebaseConfig()` は 4 つの `VITE_FIREBASE_*` が揃わなければ `null`（未設定扱い、オフラインでゲームは動作）。**Preview の workflow はこれらを渡さない**ので、現行 Preview は Firebase 未接続。`.env` はコミットされていない（`.env.example` のみ） |
| バッジ／opt-in | `PreviewBadge` が `PREVIEW · PR#… · <short SHA>` を表示（`VITE_PREVIEW_MODE` 時のみ）。`?freeFinish=on` は Preview／DEV のみで 1 ページロード限り（`freeFinishPreview.ts`）。本番は `FREE_COOK_FINISH_PRODUCTION = false`。`previewIsolation.gate.test.ts` が本番 bundle に Preview 専用文字列がないことを検証 |
| PWA | `manifest.webmanifest` の `start_url`／`scope` は `/teto-pizza-game/` 固定（Preview workflow が `sed` で書換え） |
| CI | `ci.yml`／`e2e-webkit.yml` は PR トリガー。docs-only は重い工程をスキップ。`firebase-production-deploy.yml` は WIF（OIDC）＋ `production` Environment。Preview の workflow は**別 repo**にあり、source repo の CI とは独立 |

## 2. 課題

1. **origin 共有**：Preview も本番も `perusonao.github.io`。同一 origin 内の別 path は互いの `localStorage`・`indexedDB`・Cookie・Cache Storage を読み書きできる。キー名で分けているだけで、誤ったビルド／手動操作（`localStorage.clear()`、サイトデータ消去）が本番セーブを壊す。
2. **Preview 同士も同一キー**：PR 間で保存が混ざる（旧ビルド互換の検証には使えるが、再現性が低い）。
3. **単一スロット**：`site/` を丸ごと置換。複数 PR の同時確認不可。更新の都度、前のビルドが消える。復元は SHA 記録に依存（手動）。
4. **履歴の肥大**：ビルド成果物を main に commit する。現状 23.7 MB で問題ないが、PR 数に比例して増える。
5. **ビルドが source の外**：Preview repo の workflow が public な source を checkout して build する。source 側の CI・ゲートは通らない（HV 対象 SHA を Owner が指定する運用）。

## 3. 方式の比較

評価軸: ①本番 origin からの分離 ②Preview 同士の分離（PR／デプロイ単位） ③iPhone Safari での到達性 ④セキュリティ ⑤運用負担 ⑥コスト ⑦runtime 変更の要否 ⑧既存 CI への影響。

| # | 方式 | ① | ② | 概要・所見 |
|---|---|---|---|---|
| A | 現状維持（共有 Preview、path 1 つ） | ✗ | ✗ | 基準。Owner 決定により更新しない |
| B | GitHub Pages、同一 repo に PR ごとの path（`/pr-618/`）＋ PR／SHA で保存キーを分ける | ✗ | キーのみ | 追加サービス不要。**origin は本番と同一のまま**。`persistence.ts` を変更（runtime 変更）。Pages は 1 サイトを丸ごと置換するため、既存 path を保持する仕組みが必要。Owner の「独立 origin」要件を満たさない |
| C | GitHub Pages、**別の GitHub アカウント／Org**（例: 新規 Org の `<org>.github.io/teto-preview/`） | ✓ | ✗（その Org の Preview 同士は同一 origin） | 本番と分離できる。PR 間は B と同様に別キー（runtime 変更）か単一スロット。Org 作成と Pages 設定の変更が必要。GitHub のみで完結 |
| D | GitHub Pages、**カスタムドメイン**（Preview repo に `preview.<自前ドメイン>`） | ✓ | ✗ | 本番と分離。Preview 同士は同一 origin。ドメイン取得・DNS・HTTPS 設定が必要 |
| E | GitHub Pages、**PR ごとに repo ＋ サブドメイン**（`pr-618.<自前ドメイン>`） | ✓ | ✓ | Pages は 1 repo に 1 つのサイト（カスタムドメインも 1 つ）という製品仕様（本調査では公式文書を再確認できず、既知の仕様として記載）なので、PR ごとに repo と DNS が要る。運用負担が大きく非現実的 |
| F | **Cloudflare Pages**（`wrangler pages deploy` の direct upload。ブランチ別エイリアス `<branch>.<project>.pages.dev` と、デプロイごとの `<hash>.<project>.pages.dev`） | ✓ | ✓（PR＝エイリアス、検証対象＝ハッシュ URL） | GitHub Actions から deploy 可能。無料枠あり（Git ビルド 500 回／月の記載を検索結果で確認。direct upload が数えられるかは**未確認**）。アカウントと API トークンが必要 |
| G | **Firebase Hosting preview channel**（`<site>--<channel>-<hash>.web.app`） | ✓ | ✓ | 期限付き（既定 7 日、最大 30 日。期限後に自動削除。検索結果で確認）。**本番と同じ Firebase プロジェクト**を使うと本番の IAM・WIF・クォータと結合するため、使うなら Preview 専用プロジェクトを新設。無料プランで使えるかは**未確認** |
| H | Netlify（deploy preview）／Vercel（preview） | ✓ | ✓ | F と同等の機能。無料枠・商用利用条件（例: Vercel の無料プランは非商用）は**未確認**。F で足りるため詳細調査は見送り |
| I | ローカル `vite preview` ＋トンネル（`cloudflared` quick tunnel／ngrok 等） | ✓ | ✓ | 一時的。クラウドのセッションからは不可、Owner の Mac が必要。緊急時の逃げ道 |

### 3.1 「GitHub Pages だけで独立 origin は実現できるか」
- **本番からの分離のみなら可能**：C（別アカウント／Org）または D（カスタムドメイン）。いずれも Pages 設定・Org／DNS 作成が必要で、本調査では実施していない。
- **PR／検証対象ごとの独立 origin は、GitHub Pages 単体では不可**（現実的な運用では）。1 repo に 1 つのサイトしか持てず、PR ごとに repo とサブドメインを作る E は運用が重い。`perusonao.github.io` 配下の path は同一 origin になる。
- したがって「PR ごとの独立 origin」要件には別ホスティング（F が第一候補）が必要。

### 3.2 推奨
**第一推奨: F（Cloudflare Pages の direct upload）**。ただし**ホスティングの新規採用（アカウント作成・API トークンの secret 登録）は Owner 判断**。
- 理由: 本番 origin から完全に分離／PR ごとに安定 URL（エイリアス）、検証対象ごとに固有 URL（ハッシュ）／GitHub Actions から手動実行できる（既存の `deploy-from-source` と同じ運用モデル）／**runtime 変更が不要**（base を `/` にし、manifest を書換えるだけ）／無料枠で足りる見込み。
- **代替**: 新規ベンダーを避けるなら C（別 Org の GitHub Pages）で「本番からの分離」だけを先に得て、PR 間の分離は単一スロット運用（現行と同じ）＋保存を毎回使い捨てにする。PR 間の分離まで要るなら F か G。
- **不採用**: B（独立 origin にならない。Owner 決定に反する）、E（運用負担）、I は常用せず緊急時のみ。

## 4. 推奨構成（F）の設計

### 4.1 配置
- 新 workflow は **`perusonao/teto-pizza-game-preview` に追加**（source repo の `ci.yml`・`e2e-webkit.yml`・`deploy.yml` は変更しない）。既存の `deploy-from-source.yml`／`pages.yml`（共有 Preview）は**触らず残す**（凍結。復元用の参照として）。
- `workflow_dispatch` のみ（`pull_request`／`pull_request_target`／`issue_comment` の自動トリガーは使わない。Owner Gate と同じ方針。ビルド対象は任意の PR コードなので、秘密情報のあるジョブに PR のコードを渡さない）。

### 4.2 入力と出力
| 入力 | 意味 |
|---|---|
| `ref` | source repo のブランチ／タグ／commit SHA（HV 対象 SHA を明示する運用） |
| `pr_number` | バッジ表示とエイリアス名（`pr-<n>`） |
| `label`（任意） | 検証対象ごとの別エイリアス（例: `pr-618-r8-hv`） |

出力（Job Summary と Issue コメントに転記）: `https://pr-<n>.<project>.pages.dev`（PR 単位のエイリアス）、`https://<hash>.<project>.pages.dev`（このデプロイ固有）、ビルド SHA・日時・`ref`。

### 4.3 ビルド
- 既存と同じ環境変数: `VITE_PREVIEW_MODE=1`、`VITE_PREVIEW_PR`、`VITE_PREVIEW_SHA`。**`VITE_FIREBASE_*` は渡さない**（Firebase 未接続を構造的に保証。本番 secrets はこの workflow に存在しない）。
- `vite build --base=/ --outDir dist-preview`（origin がルートになるため）。manifest の `start_url`／`scope` を `/` に書換え。noindex（meta ＋ `_headers` の `X-Robots-Tag`）。
- 静的ファイル `preview-info.json`（ref・SHA・PR・ビルド時刻）を `dist-preview/` に追加（workflow のみ、runtime 変更なし）。実機で URL を開いて SHA を確認できる。
- deploy 用トークンは deploy ステップだけに渡す。ビルドステップ（PR のコードを実行する `npm ci`／`vite build`）には渡さない（別 job に分離し、成果物を artifact で受け渡す）。

### 4.4 iPhone Safari
- アクセス: HTTPS の URL を Issue コメントや AirDrop／メモのリンクで渡し、**通常の Safari タブ**で開く。ホーム画面追加は保存領域が別になりうるため、別検証として扱う（H-2）。
- FINISH opt-in: 同じ URL に `?freeFinish=on` を付ける（1 ページロード限り、リロードで OFF に戻る＝E2E の想定どおり）。**本番では無効**（`FREE_COOK_FINISH_PRODUCTION = false` は変更しない）。
- ビルド SHA の確認: 画面のバッジ（PR＋short SHA）と `/preview-info.json`。
- 保存データの隔離: origin が違うため、本番のセーブと**構造的に混ざらない**。PR エイリアスは PR 内の更新で同じ origin（同じ保存）を保つ。デプロイ固有のハッシュ URL は毎回空の保存から始まる（再現性重視の HV、旧ビルド互換の検証は PR エイリアス）。
- Safari の ITP による保存の自動削除（一定期間未使用のサイトデータ）は、Preview 保存を使い捨てとする運用と整合する（挙動の詳細は未確認）。

### 4.5 影響評価
| 対象 | 影響 |
|---|---|
| 共有 Preview | 変更なし（凍結、`224672d`／PR #582 のまま） |
| 本番（Pages・Firebase・保存） | 変更なし。Preview の origin が異なるので本番の `localStorage` に触れない。`deploy.yml`・secrets・`firebase-production-deploy.yml` は無関係 |
| Firebase | Preview に `VITE_FIREBASE_*` を渡さず未接続。ランキング等の書込みは起きない。Preview 専用 Firebase が要る検証は Phase 3（別プロジェクトを新設、本番プロジェクトは使わない） |
| localStorage | 独立 origin で隔離。ただし**共有 Preview の origin（`perusonao.github.io`）では従来の注意が残る**。共有 Preview の保存は引き続き使い捨て |
| source repo の CI | 変更なし。新 workflow は別 repo。Owner Gate に Preview の表示を足すのは別判断 |
| runtime | **変更不要**（`--base=/` と manifest 書換えで足りる）。`previewIsolation.gate.test.ts`・本番 bundle への影響なし |

### 4.6 作成・更新・削除・復元
| 操作 | 方法 | 承認 |
|---|---|---|
| 作成 | `Deploy PR preview` を `ref`／`pr_number` で実行 → URL を Issue に記録 | Owner が実行を承認（セッションが勝手に実行しない） |
| 更新 | 同じ `pr_number` で再実行 → エイリアスの指す先が新しいデプロイに（同じ origin ＝同じ保存を引き継ぐ） | 同上 |
| 削除 | PR の merge／close 後、または一定日数後に、そのブランチ別デプロイを API／ダッシュボードで削除（棚卸し用の手動 workflow を Phase 2 で用意）。保存は端末の Safari にのみ残るので、端末側で当該サイトのデータを消せば足りる（本番とは origin が違うため安全） | Owner |
| 復元 | 記録済みの SHA で再実行（デプロイは SHA から再現可能）。共有 Preview の復元は従来どおり `224672d` での再実行 | Owner |
| 記録 | 各デプロイの URL・SHA・ビルド日時・対象 HV を Issue コメントに残す（HV Policy §3 の「Preview URL/ref は Owner が承認したデプロイのみ記録」に従う） | — |

## 5. セキュリティ
| リスク | 内容 | 対策 |
|---|---|---|
| PR コードのビルドと deploy トークン | 任意の PR コードが `npm ci`／`vite build` で実行される | `workflow_dispatch` のみ／ビルド job にトークンなし／deploy job は成果物のみ受け取り、PR のコードを実行しない／トークンは Pages デプロイ権限のみに限定（**権限範囲はサービス側の仕様を導入前に確認**） |
| 公開 URL | Preview は誰でも URL を知れば開ける。source は public | noindex（meta＋ヘッダ）。ゲーム自体に機密はない。URL の推測困難性（ハッシュ URL）に依存せず、ログイン保護（Cloudflare Access 等）はオプション（未確認、Phase 3） |
| 本番との結合 | 本番 secrets・WIF・`production` Environment を使わない | 新 workflow は別 repo、必要な secret は Cloudflare のトークンのみ |
| origin 誤認 | Safari が Preview URL を本番と取り違える | バッジ（PR／SHA）、`<title>`／theme-color の区別は runtime 変更になるため Phase 3 の任意事項 |
| 旧 Preview の残存 | 古い Preview が公開されたまま | 期限と棚卸し（Phase 2） |
| サプライチェーン | `wrangler` などの外部依存 | バージョン固定（`firebase-production-deploy.yml` の `FIREBASE_TOOLS_VERSION` と同じ方針）、action は SHA 固定 |

## 6. 運用負担・コスト・CI への影響
- 運用負担: 現状（手動 `workflow_dispatch`）とほぼ同じ手数で、Preview が PR ごとに並存し、復元が「SHA で再実行」に単純化される。追加は Cloudflare アカウントとトークンの管理、削除の棚卸し。
- コスト: GitHub Actions は public repo で無料。Cloudflare Pages の無料枠は上記のとおりで direct upload の扱いは未確認。**導入前に公式ページで Free プランの制限（デプロイ回数・ファイル数・サイズ）を確認**。GitHub Pages の上限（公式文書を検索結果で確認）: 公開サイト 1 GB、帯域 100 GB／月（ソフト）、ビルド 10 回／時（ソフト。カスタム Actions workflow には適用されない）、デプロイのタイムアウト 10 分。
- 製品の方向性: Cloudflare が Pages から Workers 系の静的配信へ寄せる可能性があるため、採用時点の推奨構成を再確認（未確認）。
- 既存 CI: 変更なし。docs-only の本書 PR は WebKit 等をスキップする設計（`docs/**` は classify で skip）。

## 7. リスクと未解決事項
1. 外部サービスの仕様・無料枠は本セッションで一次資料に到達できず**未確認**（§冒頭）。Phase 1 の前に Owner が確認する。
2. 実装は新アカウント・secret 登録・workflow 追加が必要で、いずれも Owner 承認事項。本調査は実施していない。
3. 独立 origin でも、**PR エイリアスの保存は更新をまたいで残る**。保存互換の検証には便利だが、再現性を求める HV にはハッシュ URL を使う運用ルールが要る。
4. 共有 Preview（`perusonao.github.io`）は残る。そこで `localStorage.clear()` 等を行うと**本番のセーブを巻き込む**リスクは、共有 Preview を使い続ける限り消えない。HV の手順書（`TETO_R8_IPHONE-SAFARI-HV-PREP_Result.md` §3）の禁止事項を継続。
5. ホーム画面追加（スタンドアロン）は Safari と保存領域が別になりうる（挙動は実機で確認）。
6. `deploy-from-source.yml` が build 成果物を main に commit する現行方式の履歴肥大は、F では発生しない（成果物は Git に置かない）。

## 8. 最小構成と導入計画（すべて Owner 承認後。本書では実施しない）

| Phase | 内容 | 成果・合格基準 | 承認 |
|---|---|---|---|
| 0（現在） | 共有 Preview を凍結。実機 HV の禁止事項と中止条件を運用（R8 HV 準備書）。本書の Owner 判断を取る | 設計の合意 | 本書 |
| 1（最小） | ①ホスティング採否を決定 ②アカウント／プロジェクト作成、デプロイ専用トークンを Preview repo の secret に登録 ③Preview repo に `Deploy PR preview` workflow を追加（`workflow_dispatch`、ビルドと deploy の job 分離、`VITE_FIREBASE_*` なし）④スモーク：`main` を `phase1b-smoke` として 1 回デプロイ | 以下を実機／ブラウザで確認：(a) origin が本番と異なる (b) 本番の保存キーが見えない (c) バッジの SHA と `preview-info.json` が一致 (d) `?freeFinish=on` が効き、リロードで OFF (e) iPhone Safari で開ける (f) 削除できる | デプロイごとに Owner |
| 2 | 削除の棚卸し workflow、記録様式（Issue コメントのテンプレート）、`TETO_SESSION-OPERATIONS_1.0.md` §5 の更新（docs）、HV 手順書の更新、期限ルール | 運用が文書化される | Owner |
| 3（任意） | Preview 専用 Firebase プロジェクト、アクセス制限（Access 等）、origin 誤認防止のバッジ強化（runtime 変更＝別 Issue）、Owner Gate での Preview 表示 | — | 別 Issue |

最小構成 = Phase 1 だけ（新 workflow 1 本＋secret 1 つ＋ホスティング 1 つ）。runtime・source repo の CI・本番設定は変更しない。

## 9. Owner 判断事項
1. **ホスティング採用**: F（Cloudflare Pages）で進めるか。避けるなら C（別 Org の GitHub Pages＝本番から分離、PR 間は単一スロット）または G（Firebase 専用プロジェクト）。
2. 外部サービスのアカウント作成、トークンの発行と登録を誰がいつ行うか（Claude セッションは secret を扱わない）。
3. 独立 origin の粒度: **PR 単位（エイリアス）を標準、検証対象単位（ハッシュ URL）を再現性が要る HV に使う**でよいか。
4. 共有 Preview の扱い: 凍結のまま残す／Phase 1 の合格後に廃止（`pages.yml` の無効化は Pages 設定の変更なので別承認）。
5. 保存の扱い: Preview の保存は引き続き使い捨て（持ち越さない）でよいか。PR エイリアスで更新をまたぐ互換検証を許可するか。
6. 削除ポリシー（merge／close 後すぐ、または N 日後）と、棚卸しを手動 workflow にするか。
7. アクセス制限（URL を知る人は誰でも開ける）の許容範囲。
8. Phase 1 の最初のデプロイ（スモーク）を承認するタイミング。承認なしでは実施しない。
9. 実機 HV（R8）は、Phase 1 の合格後に最初の対象とするか、暫定で共有 Preview を使うか（Owner 決定は「共有 Preview は更新しない」のため、前者が整合する）。

## 10. 結論
GitHub Pages だけでは、PR／検証対象ごとの独立 origin は実現できません。本番からの分離は別 Org またはカスタムドメインで可能です。推奨は、Preview repo に手動 workflow を 1 本追加し、Cloudflare Pages の direct upload（PR エイリアス＋デプロイ固有 URL）へデプロイする最小構成です。runtime・source の CI・本番設定は変更せず、Firebase には構造的に接続しません。外部サービスの仕様と無料枠は本セッションでは一次資料を確認できていないため、Phase 1 の前に Owner が確認してください。
