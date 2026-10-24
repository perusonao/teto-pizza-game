# FINISH E5 — V1-LAN A1 実機 HV サーバの安全条件の検証・Owner 操作手順・#633 の修正範囲（docs-only）

Status: **準備と検証のみ。接続・公開は行っていない。接続は Owner の操作を待つ。** `src/**`・`e2e/**`・workflow・データ・本番スイッチ（OFF）は変更していない。Production・共有 Preview・Firebase には触れていない。#633 は変更・merge していない。E5 実装 PR は作っていない。**E5 の本番公開は HOLD。**

**参照物の所在（main 取り込み時の注記、2026-10-24）.** 本書が参照する**検証キット**（`kit/`: 測定スクリプト・結果 JSON・パッチ・限定サーバ・`seed.html`）、**比較画像**、**測定 JSON** は、Owner 指示により **main に含めない**。`claude/teto-pizza-production-audit-jiu7oy` ブランチの `docs/reports/screenshots/fin-e5-v1-measurement/`（`kit/` を含む）にある（**このブランチを削除しないこと**。本書の手順の `git checkout origin/claude/teto-pizza-production-audit-jiu7oy -- <path>` はこれを前提とする）。**動画（`AC8-*.webm`）はどのリポジトリにも置かず**、Owner へ直接渡した（SHA-256 は本書に記録）。2026-10-23 の監査（`TETO_PRODUCTION-UNLOCK_FINISH-GRANDMA_Audit_2026-10-23.md`）も同ブランチにあり、main には無い。**本書と `docs/decisions/TETO_PINSA-577_E5-GATES_TRACKING_2026-10-23.md`（#633、main `dde0660`）の「現行決定との対応表」に矛盾はない**（優先順位: P3 L1 / Q7 確定 → 本 E5 決定記録 → #633 本文）。本番スイッチは OFF のまま（`lateCatalog.ts:32`・`freeCookFinishGate.ts:13`）。E5 は HOLD。

基準 `main` = `afd1718`（#639・#640・#649 merge 済み）。作成日 2026-10-24。決定: `docs/decisions/TETO_FIN-E5_O1-O10_DECISION-RECORD_2026-10-24.md`（第 3 版）。手順: `TETO_FIN-E5_IPHONE-HV_Runbook_2026-10-24.md`（以下 Runbook）。測定: `TETO_FIN-E5_V1-MEASUREMENT_Result_2026-10-24.md`。

**このセッションにできないこと（先に明記）.** このセッションはクラウド上のコンテナで動いており、Owner の iPhone からは到達できない。したがって「実機 HV 用サーバを起動して待機させる」ことは**できない**。準備できるのは、(a) Owner の PC で動かす**限定サーバ**（`kit/owner-lan-server.mjs.txt`）、(b) 検証用セーブ投入ページ、(c) 安全条件を機械的に確認する検証、(d) 手順。サーバは Owner の PC で起動し、接続は Owner の操作で始まる。

## 1. 最新 main（afd1718）の確認と、V1 の証跡との整合

| 項目 | 結果 |
|---|---|
| main の変化 | #639・#640 に続き #649（四川風ナスピザ。**通常 ladder の step 56**）。本番スイッチは両方 `false` のまま、ピン留めテスト 2 本も `toBe(false)` のまま |
| **late step 番号** | #649 が通常 ladder を 55→56 にしたため、ikura の late step は **57**（ON ビルドの測定: ladder 57 step、最後が `salmon-roe`）。**O-3（案 A）の契約どおり**、既到達の step は動かない。Result §5.6 の「56」は 3570f44 / 976b9f0 時点の値 |
| V1 パッチ | `v1-literals.patch.txt` は afd1718 に**そのまま適用できる**（`git apply` 済）。リテラルは `lateCatalog.ts:32`、`freeCookFinishGate.ts:13` |
| 再測定（afd1718 + 同じ 2 リテラル、V1 の安全条件 6 項目を再確認） | **7 本すべて通過**。ベンチ 4 状態の後乗せ画素 SHA-256 は `1b122218…aa3b7`（4 状態一致・対照は 4 状態で相違）、実ラウンド 3 状態は `c7bc7788…67030` で一致。**3570f44・976b9f0 と完全に同一**。採点・識別・R8 近似・Research 経路の結果も同一。差は章の件数表示（「No.29・28/29」）、late step 57、ピースの大きさの個体差のみ |
| 証跡の整合 | AC-8 の動画は 3570f44 と 976b9f0 の 2 本（内容同一）。afd1718 の動画は**追加で撮っていない**（画素が一致しているため。E5 PR の最終 HEAD で最小再測定する）。測定 JSON は `kit/main-afd1718-*.json` |
| 決定記録との整合 | 【内容は要確認】を全て確定に更新（0 件）。O-5 の強制終了は**合計 4 回**に更新。Runbook も 4 回に更新 |

## 2. V1-LAN A1 の安全条件（8 項目）の検証

条件は、V1 の 6 条件（#633 §11.3）のうち実機に適用できない 3 項目（2・3・4）を、承認された補完で置き換えたもの（Owner 承認 2026-10-24: 安全条件付き）。**1 つでも確認できなければサーバを起動しない／実機 HV を始めない。**

サーバは `kit/owner-lan-server.mjs.txt`（依存なしの Node、約 100 行、SHA-256 は `kit/SHA256SUMS`）。以下は本セッションで実際に走らせた検証（`127.0.0.1` / `127.0.0.2` のループバック、Chromium）。**WebKit・iPhone では未検証**（本環境に無い）。

| # | 条件 | 実装 | 検証結果（このセッション） | Owner が現地で確認すること |
|---|---|---|---|---|
| L-1 | **接続元制限** | `--allow <iPhone の IP>` 以外は 403 + `DENIED` ログ。許可は明示した IP のみ（ワイルドカード・`0.0.0.0` は起動拒否、自分自身の IP も拒否） | 許可外のクライアントからの `GET` と `..` を含むパスはどちらも **403 でログ**。許可リストが空・`0.0.0.0`・自分の IP の場合は**起動拒否** | `--allow` は PC の**デフォルトゲートウェイ**（iPhone のホットスポットの IP。通常 `172.20.10.1`）。起動時の表示と一致すること |
| L-2 | **束縛 IP 限定** | `--bind` は**リテラルの私設／ループバック IPv4 1 個だけ**。`0.0.0.0`・`::`・ホスト名・公開 IP は起動拒否。起動後に実際の束縛アドレスが `--bind` と一致することを確認し、違えば終了 | `0.0.0.0`、`8.8.8.8`、`localhost` の 3 つはすべて**起動拒否**。`127.0.0.2` に束縛して `127.0.0.2` のみで待受 | 起動時の表示「listening ONLY on http://\<PC のホットスポット IP\>:4173」 |
| L-3 | **Firebase 不使用** | 起動時に ① `VITE_FIREBASE_*` が環境にあれば拒否 ② dist に Google API キー形式（`AIza…`）があれば拒否 ③ dist が **Preview ビルド**（保存キー `teto-pizza-preview-save-v1`）でなければ拒否 | ① 環境変数あり → 拒否 ② ダミーのキー文字列を入れた dist → 拒否 ③ Preview でない dist → 拒否。実際のビルド（afd1718 + ON）は dist にキー形式 0 件で起動できた。アプリは Firebase 未構成のとき初期化しない（コード: `getFirebaseConfig` が `null`）。**Firebase の操作・通信は一切していない** | ビルド時のシェルに `VITE_FIREBASE_*` が無いこと、`.env.local` が無いこと（サーバも検査） |
| L-4 | **外部通信の遮断** | 全応答に **Content-Security-Policy**（`default-src 'none'`、`connect-src 'self'`、`script/style/img/font/manifest/worker` は `'self'`（と必要最小の `data:`/`blob:`/inline）、`frame-ancestors 'none'`）。ブラウザ自身が `self` 以外への通信を拒否し、違反は `/teto-pizza-game/__csp` に報告されてログに残る | **アプリ全体の通し（seed → 図鑑 → 研究 → 仕上げ → 発見）が CSP の下で動き、違反 0 件**、アプリが通信したホストはサーバのみ。**注入テスト**: ページから `fetch("https://example.com")`・外部 `<img>`・外部 `<script>` を実行 → **3 件とも CSP がブラウザ内で遮断**（`connect-src` / `img-src` / `script-src-elem`）、サーバに違反報告 3 件がログされた。ルート外パス（`/etc/passwd`）は 404 | 実機の Safari が CSP を実際に守るかは**この環境で未検証**（Safari は CSP とレポートに対応。実機で外部通信を発生させる検証はしない）。残るリスクは「Safari が CSP を無視した場合に外部通信が見えない」ことだが、アプリは Firebase 未構成で外部通信を行わない（Chromium で 0 件） |
| L-5 | **使い捨て保存データ** | 検証用セーブは `seed.html` が**合成データ**（図鑑 59 件・所持数 9・Pitz 999）を、この origin の `teto-pizza-preview-save-v1` にだけ書く。github.io / https の公開ホストでは動かない。既存セーブがあれば上書き確認。「この origin の検証用セーブだけ消す」ボタン | 通しで「既存セーブ: なし」→ 投入 → 起動を確認。localStorage は origin 単位のため、`perusonao.github.io` の本番・共有 Preview の save には届かない | seed 画面の「既存セーブ: なし」を目視。違えば**中止** |
| L-6 | **アクセスログ** | 1 要求 1 行の JSON（時刻・接続元 IP・メソッド・パス・ステータス・バイト）、`START` / `STOP` 行、終了時のサマリ（総数・許可・拒否・404・CSP 違反・接続元一覧） | ログの内容と、`SIGTERM` 時のサマリ（`total / ok / denied / notFound / csp / clients`）を確認 | 終了時に `clients` が iPhone の IP **だけ**、`denied` が 0 であること。拒否があれば別の端末が接続した記録 |
| L-7 | **時間限定** | `--ttl-minutes`（既定 60、上限 240）で自動終了 | TTL 6 秒の試験で**自動終了し、サマリを出力** | 60 分以内に終える。足りなければ再起動（上限 240 分） |
| L-8 | **片付け** | サーバ停止、検証用セーブ消去、ディレクトリ削除、ホットスポットを OFF、PC を元の Wi-Fi へ | — | 手順は §3 の最後 |

**判定**: L-1〜L-7 は、このセッションで実施できる範囲（Chromium・ループバック）で**検証済み**。L-4 の Safari での挙動、ホットスポットに本当に PC と iPhone しか繋がっていないこと（L-1・L-6 で検知）、実際の IP 値は **Owner の現地確認**。したがって「サーバの準備（キット・手順・検証）」は完了。**起動と接続は Owner の操作を待つ。**

## 3. Owner の操作手順（接続・準備）— ここで停止

PC は Node.js 22・git・npm が使えること。**ビルドまでは普段のネット回線で行い**（`npm ci` は外部からパッケージを取得する）、**その後にホットスポットへ切り替える**（ホットスポット中の PC の通信は携帯回線を使う。サーバは外部通信不要）。

**A. ビルド（通常回線）**
```
git clone https://github.com/perusonao/teto-pizza-game.git v1-iphone && cd v1-iphone
git checkout afd1718                       # 測定と同じ commit（main が進んでいたら、先に Owner と合意した SHA）
git fetch origin claude/teto-pizza-production-audit-jiu7oy
git checkout origin/claude/teto-pizza-production-audit-jiu7oy -- docs/reports/screenshots/fin-e5-v1-measurement/kit
git apply docs/reports/screenshots/fin-e5-v1-measurement/kit/v1-literals.patch.txt     # ON リテラル 2 個。commit しない
git status --short                         # src/data の 2 ファイル + kit だけ。他に変更があれば中止
npm ci
# macOS/Linux: VITE_PREVIEW_MODE=1 npm run build        Windows PowerShell: $env:VITE_PREVIEW_MODE=1; npm run build
cp docs/reports/screenshots/fin-e5-v1-measurement/kit/owner-seed.html.txt dist/seed.html
cp docs/reports/screenshots/fin-e5-v1-measurement/kit/owner-lan-server.mjs.txt owner-lan-server.mjs
```

**B. ホットスポットへ切替**
1. iPhone: 設定 → インターネット共有 → 他の人の接続を許可 **オン**。「接続中のデバイス」が PC 1 台だけになるようにする（他の端末は接続させない）。
2. PC をそのホットスポットに接続。他のアプリ・同期は止める。
3. PC のホットスポット側 IP とデフォルトゲートウェイを確認（Windows: `ipconfig`、macOS: `ifconfig` と `route -n get default`、Linux: `ip -4 addr` と `ip route`）。通常 PC は `172.20.10.2`〜、ゲートウェイ（= iPhone）は `172.20.10.1`。

**C. サーバ起動（PC）**
```
node owner-lan-server.mjs --dist dist --bind <PC のホットスポット IP> --allow <ゲートウェイ = iPhone の IP> --port 4173 --ttl-minutes 60 --log lan-access.jsonl
```
表示を確認: **listening ONLY on http://\<PC の IP\>:4173/teto-pizza-game/**、`allowed client(s)` が iPhone の IP、`dist manifest sha256`（記録）。`REFUSED: …` が出たら**起動しない**（理由を直して再実行、直せなければ中止して報告）。

**D. ここから iPhone（実機 HV。Owner の操作）— 次節**。サーバが動いている間、**他のアプリでこの IP に接続しない**。

**E. 終了後（L-8）**: seed.html の「この origin の検証用セーブだけ消す」→ PC で `Ctrl+C`（終了サマリを保存）→ ホットスポットを OFF → PC を元の回線へ → `v1-iphone` を削除。`lan-access.jsonl` は #621 に要約（接続元・件数・拒否 0・CSP 違反 0）を記録、必要ならファイルを Owner が保管。**Safari の「履歴と Web サイトデータを消去」（全消去）は使わない**（必要なら 設定 → Safari → 詳細 → Web サイトデータでこの IP だけを削除）。

## 4. iPhone 実機 HV の操作（Owner。結果は Owner の言葉でのみ記録）

Safari の**通常タブ**で `http://<PC の IP>:4173/teto-pizza-game/seed.html`。**画面収録を開始**してから進める。

| 順 | 操作 | 確認（合格条件は Runbook §3 の表） |
|---|---|---|
| 1 | seed.html: origin（PC の IP）・「既存セーブ: なし」→「検証用セーブを書き込む」→「ゲームを開く」 | **PREVIEW** バッジ。違えば中止 |
| 2 | 記録: 機種・iOS・Pitz **999**・図鑑の件数。研究 → チーズ ×9・具材 サーモン ×9 | 開始前の値 |
| 3 | **E-1** ピザ図鑑 → 研究中のピザ → 「このピザを研究する」。タブ 6 つ（…焼く / 仕上げ）が 1 行に収まる | 横スクロールなし |
| 4 | **E-2** 生地 → ソースは何もせず次へ → チーズ **クリームチーズ ×2** → 具材 **サーモン ×3** → 焼く → 針を窓の中（65〜71 付近）で取り出す | 仕上げに進む。皿の名前は出ない |
| 5 | **E-4（O-12 の実機判定）** 仕上げで **いくら ×2・大葉 ×1** を置き、**見えるか**を Owner が判定（「見える／見づらい／不可」＋所見） | **未判定を PASS にしない**。見づらければ針の位置（下端 約 60・上端 約 76）でも見る |
| 6 | **R-1 = B-1**（この状態、**完成は押さない**）: 所持数を見て（クリームチーズ ×7・サーモン ×6 のはず）、**アプリスイッチャーで Safari を上にスワイプして終了** → 同じ URL を開く **［強制終了 1 回目］** | ホームに「中断していたピザを完成させました」（「オリジナルのピザとして記録しました。」、**「未完成」の行が無いのは暫定許容**）。**表示された文言を収録で確認**。所持数は戻らない（×7・×6）、いくら・大葉 ×9、Pitz 999、図鑑の件数不変 |
| 7 | **R-2 = D-1**: 通知を**確認せず**、終了 → 再起動を **2 回** **［2・3 回目］**（B-1 の再起動と合わせて確認しない再起動が 3 回） | 毎回、Pitz・図鑑・所持数が同一、通知は 1 つのまま |
| 8 | **R-3 = B-2**: 「**確認した**」→ 終了 → 再起動 **［4 回目］** | 通知が出ない。Pitz・図鑑・所持数は「確認した」の直前と同一 |
| 9 | **E-3**: もう 1 ラウンド（図鑑 → 研究）で、仕上げのいくら ×2・大葉 ×1 → **完成** | 「いくらとサーモンのピザ を発見しました！」＋「後乗せ」 |
| 10 | **E-5**: 焼成で生焼け（早く取り出す）／焦げ（遅く） | 仕上げに進まず「失敗」、Pitz +0 |
| 11 | **E-6**: いくらを焼成前（具材）に置く／大葉を置かない | オリジナル（発見にならない） |

**中止条件**: URL / origin が想定外（`github.io`、https の公開ホスト）、seed 画面が「既存セーブ: あり」、PREVIEW バッジなし、再起動後に所持数だけ減っていて通知がない、Pitz・図鑑・所持数の増減（二重登録）、起動しない／ループ。**中止したらデータを消さず、収録と画面を保全して報告**。

**停止点（このセッション）**: §3 の A〜C と §4 は Owner の実機操作。**実施されるまで実機 HV は「未実施」で、PASS と記録しない。**

## 5. #633 の旧記述の照合と修正範囲

> **実施済み（取り込み時の注記）**: 案 X が Owner に採用され、#633 は修正のうえ merge 済み（main `dde0660`）。以下は修正前の照合で、履歴として残す。

#633（Draft）= `docs/decisions/TETO_PINSA-577_E5-GATES_TRACKING_2026-10-23.md`（head `e2bd79d`、1 ファイル、base は旧 `829d449`）。**本セッションは変更・merge しない。** 以下は、最新の Owner 決定（P3 L1 決定記録 #638、Q7 確定 #648、FIN-E5 決定記録第 3 版）との照合結果。

| # | #633 の記述（節） | 現在の決定・事実 | 要修正 |
|---|---|---|---|
| 1 | §1・§1.1・§3・§7.0・§8・§10: **L2 採用**（生ハム・ルッコラとも後乗せ）、**後乗せ 5 ピース**、非ソース 7（後乗せ 5） | **L1 採用**（#638、2026-10-23）: 生ハムは**焼成前**、**ルッコラのみ**後乗せ。D4: 個数は暫定、非ソース 7、**後乗せ 2** | **必須**（事実が逆） |
| 2 | §4 G-2 / §5 / §12: **Q-5 未決**、R-A は「検証用暫定」、5 ピース実測が必要 | **O-13: R-A は配置上限ではなく Reference・採点側の基準として承認**。**O-2**: E5 では 5 ピース実測を要求しない（正式上限は Pinsa P3 前）。L1 では Pinsa の後乗せは 2 で、5 ピース問題は縮小 | **必須** |
| 3 | §4 G-3: **late step 番号 未決**（案 A/B/C） | **O-3: 案 A 確定**。#649 で ikura の late step は 57（既到達は不変）が実例 | **必須** |
| 4 | §4 G-4 / §11: ON ビルドの置き場 **未決**、V1（`127.0.0.1`）のみ | V1 採用済み。**実機用は V1-LAN A1 を条件付き承認**（本書 §2） | **必須**（追記） |
| 5 | §4 G-1 / §12.3: AC-8 **未実施** | V1 実測は実施済み（動画 2 本、画素一致、測定 JSON）。**Owner の確認・#621 への記録は待ち**（AC-8 は PASS にしない） | 更新 |
| 6 | §9・§12.1 #3・§12.3: **K2 は別 PR・未実装** | **K2 は #637 で実装済み**（`a2cd107`） | **必須** |
| 7 | §8.3・§8.4・§12.1 #1: Q7 = I2、「不要な validator 例外を追加しない」。§12.2: jamon の ORIGINAL 化は**未承認** | **#648（Q7 確定）**: コホート文字は自動分類を維持、validator の名前付き例外は `pinsa-romana` に限り `acceptedLetterShifts` の jamon `-->B` のみ。**D2: 標準生地＋ルッコラ後乗せ（と生ハム後乗せ）は ORIGINAL で承認済み**、既存 jamon の発見は不変 | **必須**（未承認の記述が誤り） |
| 8 | §0 表: 「P1 #583・P2 #585 merge 済み。P3 は HOLD」 | P3-0（#638）、P3-a1（#639）、P3-a2（#640）、P3-b-0（#645）、Q7（#648）も merge 済み。**P3-b のみ HOLD** | 更新 |
| 9 | §12.3 の「完了扱いにしない」一覧と PR 本文の「未完了」 | 上の 2・3・5・6・7 で解消または更新。残る未完了: 原典の未確認事項、AC-8 の Owner 判定、iPhone 実機 HV、R8 実機、Q8 の正式値、Pinsa P3-b | 更新 |
| 10 | 冒頭の「第 3 版」「基準 main = `829d449`」、PR タイトル「…E5公開ゲート(#621: AC-8・Q-5)の追跡整理」 | 基準は `afd1718`。タイトルの「Q-5 未決」の含意が古い | 更新 |
| 11 | §5 の表（R-A〜R-D の比較）、§6 | R-A の意味が変わった（入力上限ではない）。R-B / R-C は L1 で不要化 | 注記 |
| 12 | §2（原典照合の残り）、§11.3（V1 の 6 条件） | 変更なし（有効） | なし |

**推奨する修正方法**（Owner が選ぶ）:
- **X（推奨・最小）**: 文書の先頭に**「現行決定との対応表」**を足し（上の 1〜7 の差し替え先を表で示し、優先順位を明記: P3 L1 決定記録 → FIN-E5 決定記録 → 本書）、本文は履歴として残す。PR タイトル・本文の「未完了」を更新し、base を最新 main に更新（merge main）。変更は同じ 1 ファイルのみ。
- **Y**: §1.1・§3・§4・§5・§8〜§12 を現行決定に書き換える（約 8 節）。履歴が失われ、差分が大きい。
- **Z**: #633 を merge せず閉じ、FIN-E5 決定記録（第 3 版）を E5 ゲートの正とする（#621 のコメントと本記録で足りる）。**P3 L1 決定記録の冒頭は、#633 が merge されても L1 を優先すると既に書いている**ので、Z も成立する。

**merge 判断の前提**: Gate 条件（CI・Codex・スレッド）は 2026-10-23 に満たしている。上の必須 6 点（1・2・3・4・6・7）を直すまでは、**矛盾する記述を main に入れる**ことになる。

## 6. 残るブロッカー（E5 実装 PR の前）

| # | ブロッカー | 担当 | 状態 |
|---|---|---|---|
| 1 | §3 のビルド・サーバ起動と、§4 の iPhone 実機 HV（E-1〜E-6、O-12 の視認性判定、R8 の 4 回の強制終了） | Owner | **未実施**（PASS なし） |
| 2 | AC-8: 動画の確認・#621 への記録（Runbook §2） | Owner | 判定待ち |
| 3 | #633 の修正（方法 X / Y / Z）と merge 判断（本書 §5） | Owner（修正の実作業は指示があれば本セッションが docs-only で行う） | 未実施 |
| 4 | E5 実装 PR（最新 main で 2 リテラル、ピン留め 2 本の意図的な反転、ON golden・E2E、最終 HEAD の CI）。**承認後** | セッション | 未着手 |
| 5 | 360×800・WebKit（CI と実機） | CI / Owner | 未確認 |
| 6 | O-11 の文言追補を行うか（E5 の条件にはしない） | Owner | 未決（別 PR） |

## 7. 保存物
`docs/reports/screenshots/fin-e5-v1-measurement/kit/`: `owner-lan-server.mjs.txt`（限定サーバ）、`owner-seed.html.txt`（afd1718 用に再生成）、`owner-lan-flow.spec.ts.txt` と `playwright.lan.config.ts.txt`（サーバ越しの検証）、`main-afd1718-*.json`、`SHA256SUMS`。動画は repo に含めない。
