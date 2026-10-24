# FINISH E5 — PC なしで実機 HV を完了する隔離検証環境の調査と提案（調査・提案のみ）

Status: **調査と提案のみ。** 公開・デプロイ・新規外部サービスの導入・ビルドの配布は**していない**。`src/**`・`e2e/**`・workflow・本番スイッチ（OFF）・Production・共有 Preview・Firebase は変更していない。E5 実装 PR は作っていない。**E5 は HOLD。**
基準 `main` = `dde0660`。作成日 2026-10-24。背景: Owner は PC を使わず、iPhone から Claude Code Cloud を操作して開発している。そのため **PC 上の LAN サーバを必須とする V1-LAN A1（`TETO_FIN-E5_LAN-HV-SERVER_Audit_2026-10-24.md`、PR #650 で main 取り込み待ち）は採用しない**。本書はその代替の提案で、採否は Owner が決める。
**実機の結果（PASS / FAIL）は Owner の言葉でのみ記録する。** 本書の「見込み」「未検証」は事実ではない。

## 0. 結論

- **既存の共有 Preview（`perusonao.github.io/teto-pizza-game-preview/`）は使えない**。理由は 2 つ: ① 本番と同じ origin（`perusonao.github.io`）で localStorage を共有する、② 内容を更新すること自体が必須条件 1（既存の共有 Preview を変更しない）に反する。同じ理由で、同じユーザーの別リポジトリの GitHub Pages も使えない（origin が同じ）。
- **Claude Code Cloud のコンテナ自体を iPhone から開く方法は、調べた範囲では存在しない**（外向き通信のみで、公開ポートの仕組みは公式の環境ドキュメントの目次に無い。**未検証**）。
- **最小構成の提案: Claude の Artifact（非公開）に、使い捨て ON ビルドを置く**。既存のツールで、新しい外部サービスを使わず、リポジトリ・本番・共有 Preview に触れず、起点の URL は Owner のアカウントだけで開ける。プラットフォームの CSP が Firebase を含む外部通信を**すべて**遮断し、削除すれば消える。
- ただし**実現できるかは小さな実機の試験（PoC、非公開 Artifact）で確かめるまで不明**。主な不確実性は、(a) Artifact の枠（iframe）の中でゲームが動くか、(b) iPhone で localStorage が**アプリの強制終了後も残る**か（R8 の検証の前提）、(c) サイト間の分割保存（ITP）の影響。(b) が満たせなければ**この方式では R8 の実機確認は成立しない**。
- 代替（フォールバック）: **別の GitHub アカウント／Organization の Pages**（`<org>.github.io` は別 origin）。最も本番に近い（トップレベルの origin）が、新しいアカウントの作成と GitHub App の追加が要り、URL は公開（推測しにくい名前＋ noindex）になる。

## 1. 既存の仕組みの調査結果（事実）

| 対象 | 事実 | 出典 |
|---|---|---|
| 本番の公開 | `deploy.yml`: `main` への push で `npm run build` → GitHub Pages（`perusonao.github.io/teto-pizza-game/`）。ビルド時に `VITE_FIREBASE_*` を**リポジトリの secrets から**渡す（本番は Firebase 構成あり） | `.github/workflows/deploy.yml` |
| 本番 Firebase の操作 | `firebase-production-deploy.yml`: 手動・`production` Environment のレビュア承認・`main` のみ。Hosting は使わない | 同 |
| 共有 Preview | 別リポジトリ `perusonao/teto-pizza-game-preview`。`Build & deploy a source PR/branch`（任意の branch / SHA を `VITE_PREVIEW_MODE=1` でビルドして `site/` に push）→ `Deploy Preview to GitHub Pages`。**Firebase の secrets は渡さない**（Firebase 未構成のビルド）。保存キーは `teto-pizza-preview-save-v1`（本番キーと別） | そのリポジトリの 2 つの workflow と README |
| origin の共有 | 本番・共有 Preview とも `perusonao.github.io`。**localStorage は origin 単位で、キーが違っても同じ保存領域**。Preview 同士は 1 つのキーを共有する（PR 間の持ち越しに注意） | `TETO_SESSION-OPERATIONS_1.0.md` §5、README |
| 本番スイッチ | 後乗せカタログと FINISH の 2 つはソース上のリテラル `false`（環境変数・クエリでは ON にならない）。ON ビルドは**ソースを変える**必要がある | `lateCatalog.ts:32`、`freeCookFinishGate.ts:13` |
| ビルドの性質 | ON ビルド（Preview 型）は 23 ファイル・約 2.2 MB（最大の JS 約 1.3 MB）。Service Worker・IndexedDB・`window.open` は使っていない。ルートは `--base` で相対化できる | `dist` の実測（afd1718 ビルド） |
| Cloud 環境 | コンテナは外向き通信のみ・使い捨て。`read_documentation` の目次（GitHub、コネクタ、secrets、ネットワーク、依存、setup、リソース、権限、Remote Control）に、**コンテナの公開 URL・ポート転送は無い**。Remote Control は「本人の PC」を要する | `read_documentation`（目次） |
| Artifact の制約（公式の契約） | 非公開が既定・削除可。ページは**ロックされたフレーム**で動く。**fetch / XHR / WebSocket / 許可外ホストはすべて CSP で遮断**。`localStorage` / IndexedDB は使える（artifact 固有の origin、閲覧者のブラウザ内のみ）。**Service Worker 不可**。`alert()` / `confirm()` / `prompt()` は出ない（`confirm` は常に false）。クエリ文字列は届かない（`#anchor` のみ）。ダウンロード・印刷は不可。複数ファイル可（`files`、合計 16 MB 以下、追加の HTML は「骨格なし」で配信）。1 回の公開は 255 ファイル・64 MB まで | Artifact ツールの説明と `artifact-design` の契約 |

## 2. 必須条件ごとの方式比較

○ 満たす／△ 条件付き／× 満たさない／？ 未検証。

| 方式 | 1 共有 Preview・本番を変えない | 2 Firebase の通信を完全遮断 | 3 本番の保存・ランキングに影響しない | 4 ON ビルドを本番コードに混入させない | 5 URL を限定・停止／削除できる | 6 iPhone で FINISH と R8（強制終了・復旧） | 新規外部サービス | PC |
|---|---|---|---|---|---|---|---|---|
| **A** 既存の共有 Preview に ON ビルドを載せる | **×**（更新が必須） | △（Firebase 未構成のビルド） | **×**（本番と同 origin） | △（作業用 branch。merge しなければ混入しない） | ×（公開 URL・削除不可で上書きのみ） | ○ | なし | なし |
| **B** 同じユーザーの別リポジトリの Pages | ○ | △ | **×**（同 origin `perusonao.github.io`） | △ | △（公開） | ○ | なし | なし（= V3、不採用済み） |
| **C 提案** **Artifact（非公開）に ON ビルド** | **○** | **○**（プラットフォーム CSP が通信全般を遮断 + Firebase 未構成ビルドの二重） | **○**（artifact 固有 origin。本番キー・本番 origin に届かない） | **○**（使い捨てツリーでパッチ→ビルド→ファイルとして公開。リポジトリに入れない） | **○**（非公開・Owner のアカウントのみ。削除で停止） | **？**（PoC で確認: 枠内で動くか、強制終了後も保存が残るか） | **なし**（既存の Artifact ツール） | **なし** |
| **D** 別アカウント／Organization の Pages | ○ | △（Firebase の secrets が無いので未構成。CSP は `<meta>` で付与可能） | ○（別 origin。トップレベル） | △ | △（**公開 URL**。推測しにくい名前＋ noindex。Pages 非公開化・リポジトリ削除で停止） | ○（最も本番に近い。ホーム画面追加も可） | **新規**（アカウント／Org の作成、GitHub App の追加） | なし |
| **E** Firebase Hosting のプレビューチャネル | ○ | **×**（本番の Firebase プロジェクトを使う。Firebase 操作禁止に反する） | × | △ | ○（期限つき） | ○ | 既存だが本番プロジェクト | なし |
| **F** 他社の静的ホスティング（Netlify・Cloudflare Pages 等） | ○ | △ | ○ | △ | △ | ○ | **新規外部サービス（今回は不可）** | なし |
| **G** Claude Code Cloud コンテナを iPhone から直接開く | ○ | ○ | ○ | ○ | ○ | ？ | なし | **不明（公開 URL の仕組みを確認できない）** |
| **H** zip を iPhone に渡して Files / Safari で開く | ○ | ○ | ○ | ○ | ○ | **×**（`file://` は module script・localStorage が不安定） | なし | なし |
| **I** V1-LAN A1（参考・不採用） | ○ | ○（CSP をサーバが付与） | ○ | ○ | ○ | ○ | なし | **PC が必要** |

## 3. 提案する最小構成（PC なし）

**方式 C（非公開 Artifact）。ただし段階的な PoC を先に行い、実機で成立しなければ方式 D に切り替える。** すべて iPhone から Claude Code Cloud を操作して完結する。**以下は提案で、実施は Owner の承認後。** どの段階も、リポジトリ・本番・共有 Preview・Firebase を変更しない。

### 3.1 構成
1. クラウドのセッションが、**使い捨てツリー**（`git archive <main の SHA>` の展開物、リポジトリの外）に V1 パッチ（2 リテラルを `true`）を当て、**`VITE_PREVIEW_MODE=1`・Firebase 変数なし・`--base=./`** でビルドする（V1 と同じ手順。測定済みの方式）。パッチもビルドも **commit・push しない**。
2. ビルド成果物（約 2.2 MB・23 ファイル）を、**非公開の Artifact**として公開する。入口の 1 ページ（検証の案内と、検証用セーブの投入、ゲームを開くリンク）＋ゲーム本体（`app/index.html` と `app/assets/*`）。プラットフォームの CSP が、ゲームから Firebase を含む**すべての外部通信を遮断**する。
3. Owner は iPhone の Claude アプリ／Safari で Artifact のリンクを開き、Runbook（`TETO_FIN-E5_IPHONE-HV_Runbook_2026-10-24.md`）の E（見え方）と R（R8、強制終了 4 回）を行う。
4. 終わったら Artifact を**削除**（リンクが無効になる）。使い捨てツリーも破棄。Owner のブラウザ内の検証用セーブは、入口ページの「消す」ボタンか Artifact 削除後の Web サイトデータで消える。

### 3.2 段階（PoC → 本番相当）

| 段階 | 内容 | 成功条件（Owner が iPhone で確認） | 失敗時 |
|---|---|---|---|
| **P0** | **ゲームを含まない**小さな Artifact（約 数 KB、非公開）。① 保存テスト: localStorage に印を書く ② 別ページ（`app/` 相当の追加 HTML）へ遷移できるか ③ 外部への `fetch` が遮断される ④ module script が動く ⑤ 「戻る」で状態が残る | ① **アプリ（Claude／Safari）を強制終了して Artifact を開き直しても、印が残る** ② 遷移できる ③ 遮断される | ①が×なら**方式 C は R8 に使えない → D へ**。②が×なら 1 ページに結合する案を検討 |
| **P1** | ゲーム本体（ON ビルド）を載せる。入口ページから起動 | 6 タブ・FINISH が動く。Pitz 999 の検証用セーブで研究 → 仕上げ → 発見まで進める。いくら・大葉の視認性（O-12）を Owner が判定 | 枠内で動かない箇所を記録して D へ |
| **P2** | R8: 最初の FINISH で強制終了 → 再起動の確認（合計 4 回、Runbook §3 の R） | 通知の表示、所持数の差、D-1、B-2（合格条件は Runbook のとおり） | — |
| **終了** | Artifact を削除。結果は Owner の言葉で #621 に記録 | — | — |

### 3.3 必須条件との対応（方式 C）
1. **共有 Preview・本番を変えない**: 使わない・触らない。Artifact は別系統。
2. **Firebase の通信を完全に遮断**: ビルドが Firebase 未構成（Firebase 変数なし。測定でも外部通信 0 件）**かつ** Artifact の CSP が fetch / XHR / WebSocket / 許可外ホストを遮断（二重）。**本番 Firebase のプロジェクトは一切使わない**。
3. **本番の保存・ランキングに影響させない**: Artifact は固有の origin（`perusonao.github.io` でも `claude.ai` でもない）。localStorage は閲覧者のブラウザ内のその origin だけ。ランキングは Firebase 経由で、未構成かつ遮断されている。
4. **ON ビルドを本番コードに混入させない**: パッチはリポジトリに入れない（使い捨てツリーのみ）。公開物は Artifact のファイルで、`main`・Pages・workflow を通らない。パッチと元 SHA のハッシュを記録する（V1 と同じ）。
5. **URL を限定・停止／削除**: 既定で非公開（Owner のアカウントのみ）。削除でリンクが無効になる。共有設定は変更しない。
6. **iPhone で FINISH と R8**: P0 で保存の持続を先に確認する。
7. **制約の明記**: §4。

## 4. セキュリティ上の制約と、実現できない条件

| # | 制約・実現できない条件 | 影響 |
|---|---|---|
| X-1 | Artifact は **iframe の中**で動く。保存は artifact 固有の origin だが、**iOS（WebKit）は第三者コンテキストの保存を分割・期限管理する**（ITP）。強制終了後の保持は**この環境では検証できない**（WebKit なし）。PoC P0 で実機確認が必須 | 保持されなければ R8 を方式 C では確認できない |
| X-2 | **本番の実行形態（`github.io` のトップレベル、ホーム画面追加）とは違う**。R8 の確認は「ゲームの保存ロジック（journal・復旧・通知）」の検証にはなるが、本番と同じ保存環境の検証にはならない。**本番公開前の最終確認としては D（トップレベル）が上** | Owner が「実機 HV」とみなせる範囲を判断する必要がある（記録に方式を明記） |
| X-3 | `confirm()` が常に false（ゲームの「ホームに戻る」確認、リセット確認、`seed` の上書き確認が使えない）。クエリ文字列（`?freeFinish=on` など）は届かない（ON ビルドはリテラルなので不要） | 「ホームに戻る」(C シナリオ）は検証できない。入口ページの上書き確認は画面内ボタンに作り替える |
| X-4 | Service Worker・ダウンロード・外部リンク先のストレージは使えない | ゲームは Service Worker を使わないので影響なし |
| X-5 | Artifact の CSP の細部（`script-src` に自己配信ファイルが入るか、インライン style、`blob:`/`data:`）を**このセッションでは確かめられない**（公開しないと分からない） | P0〜P1 で確認。動かなければ D |
| X-6 | 公開した Artifact の中身（ゲームのビルド）は、リポジトリ公開のため機密ではないが、**リンクを知る権限のある人には見える**設定になりうる。共有設定を既定の非公開のまま、Owner 以外に共有しない | 運用ルールで担保。第三者に渡さない |
| X-7 | **「完全な」遮断の主張の限界**: 遮断はプラットフォームの CSP とビルドの Firebase 未構成による。iPhone 側で通信を観測する手段は無い。ブラウザ内の違反報告は取れない（V1-LAN A1 のサーバとは違う） | 「通信 0 件」を iPhone で**実証**はできない。構成上、通信できない、が根拠 |
| X-8 | 方式 D（別 Org の Pages）は **URL が公開**（認証なし）。GitHub Pages に IP 制限・パスワードは無い。限定の手段は「推測しにくい名前＋ noindex ＋削除」のみ | 公開ビルドに合成データのみ。作成後は短時間で削除 |
| X-9 | 方式 D は新しい GitHub アカウント／Org、リポジトリ、Pages 設定、GitHub App の追加が要り、**今回の「新規外部サービスを導入しない」の範囲外**（GitHub 自体は既存だが新しい実体） | 採用時に Owner の明示承認が必要 |
| X-10 | 方式 G（コンテナの直接公開）は、調べた範囲で**手段が見つからない**。見つかった場合も、ポート公開は V1 の「非公開」条件に別途の審査が要る | 提案から除外 |

## 5. 方式 D（フォールバック）の最小構成（採用する場合）
- GitHub に**新しい Organization**（無料）を作成 → 公開リポジトリ（例: 推測しにくい名前）→ **Pages**。Claude の GitHub App をその Org に追加（`github.access`）。
- workflow（そのリポジトリの中）が `perusonao/teto-pizza-game` を**指定 SHA**でチェックアウト → V1 パッチを `sed` で適用 → `VITE_PREVIEW_MODE=1`・**Firebase の secrets なし**（新リポジトリには secrets が無い）でビルド → `index.html` に `<meta http-equiv="Content-Security-Policy">`（`connect-src 'self'` など）を足す → Pages に配信。**元のリポジトリには何も入らない**。
- 使い捨て: 検証後にリポジトリごと削除（または Pages を非公開化）。URL は公開なので、検証用の合成セーブのみを使い、短期間で削除する。
- 利点: 本番に最も近い（トップレベル origin、ホーム画面追加、WebKit の通常の保存）。欠点: X-8・X-9。

## 6. Owner の判断が要るもの

| # | 判断 | 推奨 |
|---|---|---|
| P-1 | V1-LAN A1 を**取り下げ**、PC なしの方式に切り替える（決定記録の更新） | 取り下げる（Owner の方針どおり。決定記録に「PC 不使用のため A1 は採用しない」を追記） |
| P-2 | 方式 C の **PoC（P0）として非公開 Artifact を 1 つ公開してよいか**（ゲームは含まない・数 KB・Owner のみ・直後に削除可） | 承認する（実機でしか分からない X-1・X-5 を最小の影響で確かめる） |
| P-3 | P0 が成功したら P1・P2（ON ビルドの Artifact）へ進んでよいか | P0 の結果を見てから判断 |
| P-4 | P0 が失敗した場合に方式 D（新 Org・Pages）を採るか、実機 HV を「PC が使えるまで待機」のままにするか | D は新規の実体を作るので、都度判断 |
| P-5 | 方式 C で得た結果を、E5 の実機 HV としてどこまで認めるか（X-2: 本番と同じ実行形態ではない） | 「保存・復旧ロジックの実機確認」として記録し、最終の本番公開前確認の要否は Owner が決める |

## 7. 既存の決定・文書への影響（提案。実施は承認後）
- 決定記録: V1-LAN A1 の承認は**未使用のまま失効**とする（Owner の方針変更）。強制終了 4 回・O-11〜O-13・O-2〜O-5・O-10 は不変。
- Runbook §3: 「強制終了」は、Artifact を開いているアプリ（Claude／Safari）を終了して Artifact を開き直す手順に読み替える。`seed` の確認ダイアログは使えないので、入口ページを作り替える（検証キットを main に入れる必要はない）。
- LAN 安全監査は履歴として残す（PR #650 の取り込みは Owner 判断）。
- #633 の対応表は変わらない（本番スイッチ OFF、E5 HOLD）。

## 8. このセッションが行っていないこと
Artifact の公開、GitHub の Organization・リポジトリ・Pages の作成、共有 Preview の更新、ビルドの配布、Firebase の操作、E5 実装 PR、CI の再実行。Artifact の挙動（枠内での実行、保存の持続）は**公式の契約の記述に基づく机上の評価**で、実機・実環境では未検証。
