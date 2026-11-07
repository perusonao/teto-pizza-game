# FOLD＋SEAL F1 最終整理・F2 実装準備（docs-only、Refs #773）

2026-11-07、main `06cfc06`（不変を確認）、branch `claude/teto-pizza-t5-t6-r9qup3`。
根拠: Owner 決定 #773 コメント 6704922161（F1 は現状維持。F2 は docs-only の実現性・競合調査・HV 計画のみ。HOLD: App／main／reducer／PizzaStage／runtime／CSS の編集、DEV UI のマウント、PR 作成、merge、Production／共有 Preview、F4 統合、calzone、Jaccard 例外）。
claim: #773 コメント 6703596787（docs）・6703665181（F1）の範囲内（`TETO_FOLD-SEAL_*`）。**本書は新規 docs 1 本のみ。`src/`・`e2e/`・CSS・golden・既存 docs は未変更。F2 のコード実装・PR・merge・共有 Preview 更新なし。**
ラベル: 【実測】= 今回コマンドで確認、【推論】、【未確認】。実機 PASS は主張しない（実機証拠がない）。

---

## 0. 結論

1. **F1 は現状維持**（コード変更なし）。差分は新規 9 ファイル（ソース 6／テスト 3、計 950 行）と Result 1 本。数値は再実行して一致（71／71、型、lint）。
2. **Codex の独立レビューは PR が無いと依頼できない**【実測: 過去の #776 の receipt】。PR の作成は HOLD のため、Owner が下記 3 案から選ぶ。推奨は「F1 だけを載せたクリーンな draft PR（HOLD 表記）を Owner が許可 → `@codex review`」。
3. **競合の再調査**: #738 と #746 はどちらも `src/main.tsx` の**同じ数行**（import 群・`try` ブロック・`if` 条件・描画分岐）を編集し、さらに #746 は `src/devtools/devtoolsAccess.test.ts` の**正規表現固定**を書き換えている。F2 のマウントも同じ箇所を触るため、**#738／#746 の merge 後に直列で**行うのが安全。
4. **HOT／claim 対象を変更せずに実験画面を作る方法は存在する**【実測】。独立の HTML エントリ（`foldseal-lab.html`＋`src/preview/foldSealLab*.tsx` の新規ファイル）は、(a) dev サーバで設定変更なしにそのまま開け、(b) 現行の本番・Preview ビルドには**入らない**。実機の iPhone Safari で使うには Preview ビルドへの組み込みが要り、`vite.config.ts` の小さな条件付き変更で可能なことを使い捨てコピーで確認した（本番ビルドは**バイト単位で同一**）。ただし `vite.config.ts` の編集とビルド成果物の差（§4.3）は Owner 判断。
5. **iPhone Safari の確認項目と受入条件を §5 にまとめた**。Owner の補足（`stepIsComplete` は進行中の指があるあいだ画面遷移を起こさない）を F2 の受入条件 AC-F2-6 に入れた。

---

## 1. F1 の最終整理

### 1.1 変更差分（`4a5bec8`（設計 docs）→ `0a4b5c5`（F1））

| 区分 | ファイル | 行数 |
|---|---|---|
| ソース | `src/logic/foldSeal/foldSealConstants.ts` | 36 |
| ソース | `src/logic/foldSeal/foldSealGeometry.ts` | 32 |
| ソース | `src/logic/foldSeal/foldSealDoughShape.ts` | 7 |
| ソース | `src/logic/foldSeal/foldSealSeam.ts` | 87 |
| ソース | `src/logic/foldSeal/foldSealMachine.ts` | 246 |
| ソース | `src/logic/foldSeal/index.ts` | 9 |
| テスト | `src/logic/foldSeal/foldSealMachine.test.ts` | 434 |
| テスト | `src/logic/foldSeal/foldSealSeam.test.ts` | 49 |
| テスト | `src/logic/foldSeal/foldSeal.architecture.test.ts` | 50 |
| 報告 | `docs/reports/TETO_FOLD-SEAL_F1-PureLogic_Result_2026-11-07.md` | 59 |

`git diff --stat origin/main...HEAD -- src` は上記 9 ファイル・950 行の追加のみ。**既存ファイルの変更・削除はゼロ**【実測】。外部の依存は、兄弟ファイルと既存の純粋関数 `../doughShape`（`doughShapeRadiusAtAngle` と型）の読み取りのみ。

### 1.2 テスト結果（本セッションで再実行、HEAD `0a4b5c5`）

| 項目 | 結果【実測】 |
|---|---|
| `npx vitest run src/logic/foldSeal` | 3 ファイル・**71 件 pass**（machine 62／seam 5／architecture 4） |
| `npx tsc -b` | エラー 0 |
| `npx oxlint src/logic/foldSeal` | 警告・エラー 0 |
| 全 Vitest（直前の実行、F1 コミット時） | 626 ファイル pass・1 skipped、11,626 件 pass・13 skipped・2 todo、失敗 0（約 23 分） |
| 再現コマンド | `npm ci && npx vitest run src/logic/foldSeal && npx tsc -b && npx oxlint src/logic/foldSeal` |

Owner の注記どおり、数値は実装者の報告で Owner は未再現。上のコマンドで独立に再現できる。全 Vitest は所要が長く、今回は F1 のみ再実行した（F1 以降 `src/` は変更していない）。

### 1.3 Owner 補足の取り込み（コード変更なし）

`stepIsComplete` は `folded` と `sealing` の両方で真だが、**進行中の指があるあいだ画面遷移を起こしてはならない**。F1 の状態機械は遷移を持たないため、この規則は**呼び出し側（F2 以降）の責務**。呼び出し側は次の規則で判定する:

- 先へ進めるのは `state.phase === "folded"` のとき**だけ**（`sealing` では指が接触中。`folding` はそもそも未完了）。
- 判定は `stepIsComplete` ではなく `phase === "folded"` を使う。
- F2 の受入条件 AC-F2-6 とテストに入れる（§5.3）。F1 には未配線のため該当テストが無い（【既知の空白】）。

### 1.4 F1 の既知の限界

数値（`FOLD_D_MIN` 等）は暫定。実機の親指の可動域・手の影・端スワイプは未検証。WebKit／実機は未実施。描画なし。`calzone` と重複 Gate（Jaccard 0.5）は HOLD のまま。

---

## 2. Codex による独立レビューの依頼方法

### 2.1 確認できたこと【実測】

- Codex は `chatgpt-codex-connector[bot]` で、**PR に対して**動く。トリガーは PR を開く／draft を ready にする／PR に `@codex review`（または `@codex security review`）とコメントする、の 3 つ（#776 に付いた Codex の説明文）。**Issue やブランチ単体には反応しない**。
- 結果は PR の「Codex Review Summary」コメント（`commit_sha`・`has_unresolved_findings`・`status`）。**Owner Gate は現 head の receipt だけを有効とする**（`SESSION-OPERATIONS_1.0.md` §2）。
- 先例: #776（DRIZZLE D1、同じ「未配線の純粋ロジック」）は、`@codex review` を exact HEAD つきで依頼し、P2 の指摘 2 件を受けて修正→再依頼している。
- リポジトリ側に Codex の設定ファイル（`AGENTS.md`・`.codex`）や PR なしのレビュー経路は**無い**【実測】。`@codex review` の自動投稿は Owner 承認の対象（`SESSION-OPERATIONS_1.0.md` §6）。

### 2.2 選択肢（Owner 判断）

| 案 | 内容 | 長所 | 短所／条件 |
|---|---|---|---|
| **A（推奨）** | Owner が許可 → F1 だけを新ブランチ（main から `0a4b5c5` を cherry-pick）に載せた **draft PR**（題に `[HOLD・マージ禁止]`）を作り、`@codex review` を exact HEAD つきで依頼 | 差分が新規 9 ファイル＋Result のみで見やすい。#776 と同じ型。draft のまま HOLD 運用できる | **PR 作成と新ブランチ作成の許可**が要る（現在 HOLD）。指定ブランチ以外への push も要許可 |
| B | 現ブランチ（設計 docs ＋ T5 docs ＋ F1 を含む）から draft PR | 追加ブランチ不要 | 差分に T5・T6 の docs が混ざる。PR を開く許可は同じく要る |
| C | PR なしの暫定: 本セッションの Claude による別視点レビュー（`code-review` スキル）を F1 差分に対して実施 | 許可不要。早い | **Codex ではない**。receipt にならず、Owner Gate の `CODEX_NEEDED` は解消しない。補助扱い |

重点確認の依頼文案（A／B 用、PR 作成後に Owner の許可を得て投稿）:

> `@codex review` 最新 HEAD `<exact SHA>` を対象にお願いします。FOLD＋SEAL の純粋ロジック（新規ファイルのみ・未配線・本番 OFF）。重点: ①状態機械の遷移の漏れ・到達不能状態・不変条件（`foldSealInvariantViolations`）、②ジェスチャとボタンが同一の結果に収束すること、③補間・帯判定の境界（`SEAL_MAX_INTERP`・`SEAM_BAND`・端のビン）、④非有限入力・別 pointerId・古いイベントで例外を投げないこと／同一参照を返す無視、⑤既存ファイルの変更ゼロとどこからも import されないこと（architecture test）。

**今回は PR を作らず、`@codex review` も投稿していない。** Codex の receipt は取得していない（Codex 未レビューを PASS 扱いしない）。

---

## 3. #738・#746 ほかとの競合の再調査（main `06cfc06`、2026-11-07）

### 3.1 open PR のファイル（`git diff --name-only origin/main...origin/<branch>`、docs 以外）

| PR | head | 編集する共有／HOT ファイル | 新規ファイル | F2 との関係 |
|---|---|---|---|---|
| **#738**（STEAM S3） | `78de12a9` | `src/App.tsx`（HOT）、`src/screens/GameScreen.tsx`（HOT）、`src/components/PizzaStage.tsx`、**`src/main.tsx`**、e2e 1 | `src/preview/CookSteamHvStarter.tsx`・`cookSteamHv*`・`steamPreview.ts`・`Steam.css`・`src/logic/steam/**` ほか | `src/main.tsx` と HOT 3 件が重なる |
| **#746**（DRIZZLE Lab） | `b774a322` | **`src/main.tsx`**、**`src/devtools/devtoolsAccess.test.ts`**、e2e 1 | `src/preview/DrizzleLab(.tsx/.css/.ts)`・`drizzleLab.gate.test.ts` ほか | `src/main.tsx` と `devtoolsAccess.test.ts` が重なる |
| #776（DRIZZLE D1） | `c75838f2` | なし（新規のみ） | `src/logic/drizzle/**`、`src/data/drizzleExperienceGate*` | 重ならない |
| #775（DOUGH KIND PD-1a） | `9e77805c` | `doughKind` 周辺（挙動不変） | ― | 重ならない |
| #783（Batch 19、draft） | `94954b72` | `recipes.ts`・`ingredients.ts`・`App.css`・`IngredientGlyph.tsx`・golden 等（HOT） | ― | 重ならない（F2 は触れない）。ただし T1 のカタログ lane と直列 |
| #781／#782 | ― | docs／eggplant 絵（新規） | ― | 重ならない |

### 3.2 `src/main.tsx` 内の具体的な衝突位置

| 位置 | #738 | #746 | F2 を同様に載せた場合 |
|---|---|---|---|
| import 群（`activateCookSearHv` の直後） | `activateCookSteamHv` を追加 | `drizzleLabOptedIn` を追加 | 同じ行の隣に追加 → **textual conflict** |
| `*Requested` フラグの定義 | ― | `drizzleLabRequested` を追加 | 隣に追加 → 衝突 |
| `if (DEV \|\| PREVIEW) && !inspectorRequested && … {` と `if (PREVIEW) && … {` の条件 | ― | 2 行とも `&& !drizzleLabRequested` を追加 | 同じ 2 行に `&& !foldSealLabRequested` → **確実に衝突** |
| `try { activateCookPrepHv … }` ブロック | `activateCookSteamHv(window)` を追加 | ― | ― |
| 描画の `if / else if` 連鎖 | ― | 先頭に `drizzleLabRequested` 分岐を追加 | 同じ連鎖に分岐 → 衝突 |

### 3.3 見落としやすい連動

- `src/devtools/devtoolsAccess.test.ts` は `main.tsx` のソースを**正規表現で固定**している（`if (import.meta.env.VITE_PREVIEW_MODE && !inspectorRequested && !devStateRequested && !postLayerBenchRequested) {`）。#746 はこの正規表現を `&& !drizzleLabRequested` つきに書き換える。**フラグを足す PR は毎回このテストも更新する必要があり**、F2 が `main.tsx` に足すなら #746 の後に追加の更新が要る。
- 各 DEV 画面は「本番バンドルに入口名が残らない」ゲートテスト（`drizzleLab.gate.test.ts` ほか、実際の `vite build` を 2 回行う）を持つ。F2 も同型のゲートテストを持つ前提で、ビルド時間が増える。
- `src/preview/` の名前は衝突しない（`steam*`／`cookSteamHv*`／`drizzleLab*` に対し `foldSealLab*`）。

### 3.4 claim の確認（#773・#780・#774 の最新コメント）

| 追跡 | 状態 | F2 準備への影響 |
|---|---|---|
| 本セッション T6（`TETO_COOKING-OP_T6_*`／`TETO_FOLD-SEAL_*`／`src/logic/foldSeal/**`） | 有効（〜11/20） | 本書はこの範囲内 |
| #773 の C1（`TETO_NEW-PROCESS_*`） | 有効（別名前空間） | 重ならない |
| #738／#746／#726／#579 | open のまま、HV 待ち | F2 のマウントはこの 2 PR の後 |
| T1 #774（PR #783 draft、AC-8 非正準差分 20 件は Owner 承認待ち） | 進行中 | カタログ lane。F2 と無関係 |
| #772／T2 #780（PR #781） | 進行中 | 無関係 |

**結論: main は不変、F1・本書は既存の claim・PR と重ならない。F2 のコード実装を `src/main.tsx` に載せる案は、#738／#746 の merge 後でないと競合する。**

---

## 4. HOT ファイルを変更せずに F2 の実験画面を実現できるか

### 4.1 要件（F2 の定義、`TETO_FOLD-SEAL_Design-Acceptance_2026-11-07.md` §8.1）

ゲームに統合せず、保存・採点・在庫に触れない独立画面で、390×844／360×800 の iPhone Safari で操作でき、本番ビルドには入口名を残さない。

### 4.2 実測（使い捨てコピーでの検証。本体の作業ツリーは未変更）

`git ls-files` のコピー（docs／e2e を除く）に、最小の独立エントリ（`foldseal-lab.html`＋ `src/preview/foldSealLabProbe.tsx`。F1 モジュールを import して状態を表示）を足して確認した。

| 実験 | 結果【実測】 |
|---|---|
| dev サーバ（設定変更なし）で `/teto-pizza-game/foldseal-lab.html` を開く | HTTP 200。Chromium（390×844、touch）で F1 の状態 `phase=folded` を描画 |
| 本番相当 `vite build`（設定変更なし） | `dist/` は `index.html` のみ。**独立エントリは入らない** |
| Preview 相当 `VITE_PREVIEW_MODE=1 vite build`（設定変更なし） | 同じく `index.html` のみ。入らない |
| `vite.config.ts` に Preview 時だけ `build.rollupOptions.input` へ第 2 エントリを足す | Preview ビルドに `foldseal-lab.html` と専用チャンクが出る。**本番ビルドは変更前と `diff -rq` で完全に同一** |
| 上の変更を入れた Preview ビルドの副作用 | `index.html` に `modulepreload` が 3 行増える（共有チャンクへの再分割）。ゲームの挙動は不変の見込みだが、**Preview 成果物がこれまでと完全には同一でない**【未確認: 実機での影響】 |

WebKit はこの環境に無い（Playwright は Chromium のみ【実測】）。iPhone／WebKit の動作はここでは確認できない。

### 4.3 方式の比較

| 案 | 編集するファイル | HOT／claim | 実機（iPhone Safari）で使えるか | 評価 |
|---|---|---|---|---|
| **A: 独立 HTML エントリ＋dev サーバ** | 新規のみ（`foldseal-lab.html`、`src/preview/foldSealLab*.tsx`） | なし | dev サーバが iPhone から到達できる場合のみ。PC 準備・ローカルサーバ前提は **Owner の標準ワークフロー（iPhone＋Claude Code Cloud 中心、ローカルサーバ前提にしない）と合わない**【実測: `TETO_VISUAL-HV_PREVIEW-WORKFLOW_2026-10-30.md`】 | Chromium での開発確認（Playwright）には最適。実機 HV には不足 |
| **B: A ＋ `vite.config.ts` の Preview 限定第 2 エントリ** | 上 ＋ `vite.config.ts` 1 箇所 ＋ ゲートテスト 1 本 | `vite.config.ts` は `hot-files.json` に無く、確認した open PR も触れていない【実測】。ただし全ビルドに効く共有設定 | 共有 Preview に載せれば実機で開ける（**共有 Preview 更新は Owner 承認が必須**）| **HOT／claim を触らずに実機へ届く唯一の案**。成果物の差（§4.2 の最後の行）と設定変更の可否は Owner 判断 |
| C: `src/main.tsx` に `?foldSealLab=on` を足す（#746 と同型） | `src/main.tsx`、`src/devtools/devtoolsAccess.test.ts` | **#738／#746 と衝突**（§3.2、§3.3） | Preview で可 | #738／#746 の merge 後なら 1 行追加で済む。それまで HOLD |
| D: 既存の DEV 画面（`?dev=postlayer` など）に相乗り | 既存 DEV 画面の編集 | 他の claim の領域 | ― | 不採用 |

**推奨: 開発・自動確認は A、実機 HV は「#738／#746 の merge 後に C」か「Owner が `vite.config.ts` の変更を許可するなら B」。** どちらも共有 Preview の更新は Owner 承認が前提で、本書は申請しない。待たずに進められる F2 の部分は、A の独立エントリ上での画面実装・Chromium での自動確認までで、これは**いずれも別指示（F2 のコード実装 GO）が要る**。

### 4.4 F2 のファイル案（コード化は HOLD）

| ファイル（新規） | 役割 |
|---|---|
| `foldseal-lab.html`（A／B） | 独立エントリ。`viewport-fit=cover`、`touch-action` はスクリーン層で指定 |
| `src/preview/foldSealLab.ts` | 入口名・マーク・ラベルの定数、`foldSealLabOptedIn`（C 用）、sessionStorage の記憶（入口のみ） |
| `src/preview/FoldSealLab.tsx`＋ `foldSealLab.css` | 画面。F1 の `foldSealReduce` を `useReducer` で使う。ダミーの生地・具、390／360 の枠表示、計測表示、ボタン代替、REOPEN／RESET |
| `src/preview/foldSealLab.test.tsx` | jsdom: 操作列→状態、ナビゲーション規則（§5.3 AC-F2-6） |
| `src/preview/foldSealLab.gate.test.ts` | 本番バンドルに入口名・CSS・コンポーネント文言が残らない／Preview には残る（`drizzleLab.gate.test.ts` と同型） |
| `e2e/foldseal-lab.spec.ts` | Playwright（WebKit）で 390×844・360×800 のスモーク |

---

## 5. iPhone Safari の操作確認項目と受入条件

実機 HV の正式な PASS／FAIL／waived は **Owner のもの**で、セッションは書かない【先行: HV Policy、SESSION-OPERATIONS §3】。自動確認（Chromium／WebKit エミュレーション）と実機は区別して報告し、**実機の証拠がない項目は「未確認」**とする。

### 5.1 実機条件

| 項目 | 内容 |
|---|---|
| 端末・ブラウザ | iPhone の Safari（実機）。機種と iOS の版を記録。可能なら 2 台以上（小型・大型） |
| 画面 | 縦 390×844 を主（Authority）、360×800 相当の幅を副。ホーム画面追加（PWA）起動は別項目で 1 回 |
| 持ち方 | 片手（利き手の親指）／両手。右利き・左利き |
| 設定 | 通常／低電力モード／視差効果を減らす（`prefers-reduced-motion`）／VoiceOver オン |
| 入口 | F2 の入口（案 B／C）。**共有 Preview の更新と対象 SHA の記録は Owner 承認後**。保存データは使い捨て（実験画面は保存しない） |
| 記録 | 画面収録の動画（repo に commit しない）、静止画（`docs/reports/screenshots/<task-name>/`）、端末情報、手順番号ごとの結果 |

### 5.2 操作確認項目（HV-1〜HV-9 を実機手順に展開。合格の目安は暫定）

| # | 手順 | 見るもの | 合格の目安（暫定） |
|---|---|---|---|
| HV-1 | 蓋側の端をつまんで親指で引き下ろす | 迷わず成立／指と縁の追従感 | 説明なしの初見で 10 回中 8 回以上、折れる |
| HV-1b | 途中で離す／引き戻す | バネ戻り、ペナルティなし | 常に開いた状態へ戻る |
| HV-2 | 折りの進み具合を指の外から読む | 手の影で見えなくならないか | 角度と縁位置が読める |
| HV-3 | 縁をなぞって封止 → ソース塗り／DRIZZLE 線描と比較 | **別の操作に感じるか** | Owner が区別できると判定 |
| HV-4 | 速い／遅いなぞり、縁から外れる、中央を横切る | 帯の広さ、意図しない進捗 | 一周 3〜8 秒、横切りは進まない |
| HV-5 | 折り・封止中の画面端スワイプ（戻る）、縦スクロール、ピンチ、ラバーバンド、ホームインジケータ付近 | 誤作動 | 発生 0 |
| HV-6 | ボタンのみで折る→とじる(4 回)→スキップ／やり直し、VoiceOver | 代替だけで完了、読み上げ | 全工程をボタンのみで完了 |
| HV-7 | 低電力・視差軽減・横向き・ノッチ付近・通知バナーの割り込み | 破綻（cancel 動作）なし | 割り込みで状態が壊れない |
| HV-8 | 封止不足の見た目（すき間）を確認 | 失敗に見えないか／納得感 | Owner 判定 |
| HV-9 | 回帰（既存の操作）| F4 統合後のみ | F2 では対象外 |
| HV-10 | 計測表示（初回成功率、所要時間、cancel 回数）を読み上げ、記録する | 数値の記録 | 計測できる（§5.4） |

### 5.3 F2 の受入条件（実装 PR 用。コードは未実装）

| # | 条件 | 検証 |
|---|---|---|
| AC-F2-1 | 独立画面は F1 のモジュールのみを状態源とし、`foldSealReduce` 以外で折り・封止の状態を持たない（ジェスチャとボタンは同一のイベントを送る） | コードレビュー＋jsdom |
| AC-F2-2 | 保存・ネットワーク送信・localStorage 書き込みをしない（sessionStorage は入口の記憶のみ）。既存セーブを読まない | jsdom／構造テスト |
| AC-F2-3 | **本番バンドルに入口名・CSS・文言が残らない**。Preview バンドルには残る（正の対照） | `foldSealLab.gate.test.ts`（実 `vite build` 2 回） |
| AC-F2-4 | 本番ビルドの成果物が変更前と一致（案 B の場合は `diff -rq` 相当の確認） | ビルド比較 |
| AC-F2-5 | ボタンだけで全工程を完了でき、状況が `role="status"`／`aria-live` で読める | jsdom＋実機 HV-6 |
| AC-F2-6 | **指が接触中（`phase` が `folding` または `sealing`）は、画面遷移・「次へ」の確定・ステップ完了通知を起こさない。先へ進めるのは `phase === "folded"` のときだけ**（Owner 補足） | jsdom: pointerdown 後に遷移ボタンが無効／遷移関数が呼ばれない。実機 HV-1・HV-4 |
| AC-F2-7 | `pointercancel`／`blur`／`visibilitychange: hidden`／向き変更／リサイズで `CANCEL` が送られる。リスナーは unmount で解除される | jsdom |
| AC-F2-8 | `touch-action: none` は生地の操作層だけ。ページ全体のスクロール・ピンチを殺さない。最小操作領域 44px 以上、横スクロールなし（390×844・360×800） | e2e（WebKit）＋実機 HV-5 |
| AC-F2-9 | `prefers-reduced-motion` で折りアニメーションが即時になる | jsdom＋実機 HV-7 |
| AC-F2-10 | 既存の画面・FRY・DRIZZLE・STEAM・炙り・炒め・CUT・保存・採点・Dex・在庫・Research・ヒントに変更がない（F2 は独立画面のみ） | 既存の全テスト緑、差分の確認 |
| AC-F2-11 | 実機 HV の記録（端末、iOS、動画、手順別の結果）が揃い、PASS／FAIL／waived は Owner が付ける | Owner |

### 5.4 計測項目（画面内表示のみ。保存・送信しない）

折り: 初回成功率、成功までの時間、つかみ範囲外のタップ数、途中離しの回数、バネ戻り回数。封止: 最終 coverage、所要時間、帯外に出た回数、RESET 回数、スキップの有無。代替: ボタンの使用回数。環境: 画面サイズ、向き、`prefers-reduced-motion`、端末情報（手入力）。

### 5.5 中止条件

実機で HV-5（誤作動）が再現する場合、HV-1 の成功率が目安を大きく下回る場合、または片手で親指が届かない場合は、**F4 統合に進まず設計（折り線の向き・つかみ範囲・帯幅）を見直す**。Owner が No-Go と判断した場合も同じ。

---

## 6. 残る Owner 判断・ブロッカー

| # | 事項 | 推奨 |
|---|---|---|
| F2-1 | Codex レビューの方式（§2.2 の A／B／C）と、PR 作成・新ブランチの許可 | A（F1 だけの draft PR・HOLD 表記）。許可があるまで何も作らない |
| F2-2 | 実験画面の実機到達方式（§4.3 の B か C）。B なら `vite.config.ts` の編集を許可するか | #738／#746 の merge 後に C が最も単純。待てない場合は B（Preview 成果物の差を許容する場合） |
| F2-3 | F2 のコード実装の GO（A の独立エントリ上での画面実装・Chromium 自動確認まで） | 実機到達方式の決定後 |
| F2-4 | 共有 Preview の更新（実機 HV の前提） | 都度 Owner 承認。対象 SHA と復旧 SHA を記録 |
| F2-5 | AC-F2-6 の仕様確認: 進行中の指があるあいだは `phase === "folded"` でのみ遷移を許す、で良いか | 良い（本書の解釈） |

ブロッカー: PR／Codex は Owner 許可待ち。F2 のマウントは #738／#746 待ち（案 C）か `vite.config.ts` の許可待ち（案 B）。実機 HV は共有 Preview の承認と Owner の実機操作が前提。**実機 PASS の証拠は現時点でゼロ。**

---

## 7. 未確認・限界

- Codex の実レビューは未取得。方式は #776 の先例と Codex 自身の説明文で確認したのみ。
- WebKit／iPhone Safari での動作は未確認（この環境は Chromium のみ）。案 A の検証は Chromium（390×844、touch エミュレーション）。
- 案 B の Preview 成果物の差（`modulepreload` の増加）が実機の動作・読み込みに与える影響は未確認。Preview パイプライン（`deploy-from-source`）が別の `base` やビルド設定を使うかは未確認。
- `src/main.tsx` の衝突位置は open PR の head との差分で確認した。PR の更新や merge で変わる可能性があるため、F2 着手時に再確認する。
- 全 Vitest は今回再実行していない（F1 コミット時の結果を引用。F1 以降 `src/` の変更なし）。
- 使い捨てコピーは作業ツリー外で、リポジトリには何も残していない。
