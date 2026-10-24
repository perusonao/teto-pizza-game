# FINISH E5 事前検証 — V1 使い捨て ON ビルドでの測定結果と、実機確認の手順（docs-only）

Status: **測定と手順の整理のみ。E5 実装 PR は作っていない。** `src/**`・`e2e/**`・workflow・データ・本番スイッチ（main 上は OFF のまま）は repo で変更していない。merge・共有 Preview / Production 操作・CI 再実行なし。#639・#640 は読み取りのみで変更していない。
基準 `main` = `3570f44`（測定時点の `origin/main`）。測定日 2026-10-24。対象は **「いくらとサーモンのピザ」（`ikura-salmon-pizza`）1 件のみ**（O-1、`docs/decisions/TETO_FIN-E5_O1-O10_DECISION-RECORD_2026-10-24.md`）。

**この文書が言わないこと.** AC-8 を PASS とは書かない（Owner が動画を確認し #621 に記録するまで PASS にしない、2026-10-23 の決定）。iPhone Safari 実機 HV・R8 実機 HV は**未実施**で、PASS と書かない。本書の Chromium 結果は実機の代替ではない。

## 0. 結論

- V1 の安全条件 6 項目は**すべて満たし**、停止条件には**1 件も該当しなかった**ので測定を実施した（§3）。
- 後乗せの `salmon-roe`（と `shiso`）は、raw / perfect / burnt / 焼成なしの **4 状態で画素が SHA-256 まで完全に一致**した（`1b122218…`）。対照（焼成前に置いた同じピース）は 4 状態ですべて別の画素になる。つまり測定は感度がある（§5.1）。
- 実プレイでは、FINISH に入れるのは焼き加減が窓（58–78）内のときだけで、焼き加減の生焼け・焦げは**失敗として FINISH を飛ばす**。実ゲームで FINISH に見える焼き色は `perfect` のみ。raw / burnt はベンチ（DEV の `?dev=postlayer`）でしか観察できない（§5.1）。
- 識別は「いくら 1 個以上 **かつ** 大葉 1 個以上（焼成後）」。どちらか欠ける・全部焼成前なら ORIGINAL。個数の過不足は**得点だけ**を下げる（§5.3）。
- リング: 後乗せの**入力上限は無い**（12 ピース置けた）。8 は Reference の 8 スロットと得点の話（§5.4）。
- R8（強制終了）は Chromium の近似で期待どおり動いたが、**Free / Research の仕上げ中の強制終了では「未完成」の行が通知に出ない**（O-11）（§5.8）。
- **残るブロッカーは証跡と判断**（§8）。コード側の残りは E5 PR 1 本（スイッチ 2 個の反転とピン留めテスト 2 本の意図的な反転、ON 用 golden・E2E）。

## 1. 読んだもの・読んでいないもの

読んだ: `CLAUDE.md`、最新 `main`、Issue #621（本文・全コメント）・#617（本文・コメント）、PR #633（本文）、PR #639・#640（本文と変更ファイル一覧・全パッチ）、`docs/decisions/TETO_PINSA-577_E5-GATES_TRACKING_2026-10-23.md`（#633 のブランチ）、`docs/reports/TETO_R8_IPHONE-SAFARI-HV-PREP_Result.md` と `TETO_R8_IPHONE-SAFARI-HV_Result.md`、`TETO_FINISH-D2-2B_Result.md`。
読んでいない: #639・#640 のコメント・レビュー・CI の詳細、#633 の議論。

## 2. #639・#640 との変更範囲と依存関係（読み取りのみ）

2026-10-24 時点（いずれも base = `3570f44`、**進行中のまま・変更していない**）。

| | #639（P3-a1） | #640（P3-a2） |
|---|---|---|
| 内容 | Guided の開始・作り直しでレシピの生地を設定（`startingPizzaFor`） | 後乗せカタログの型・validator 例外（`ladderCredit:false`）・`discoveryIdentityOf` の生地対応 |
| 変更ファイル | `src/state/doughSelection.ts`、`src/state/gameReducer.ts`（HOT・局所 3 行）、`gameReducer.guidedDough.test.ts`、docs | `src/data/lateCatalog.ts`、`src/data/discoveryCatalog.ts`、同 2 テスト、docs |
| 状態（読取時） | `mergeable_state: unstable` | `mergeable_state: clean` |
| 本番スイッチ | 触らない | 触らない（`LATE_CATALOG_PRODUCTION` の行は未変更） |
| 本番での挙動 | 不変（`doughKind` を持つ出荷レシピ無し） | 不変（同上。ikura の識別は従来と同一とテストで固定） |

**E5 PR が触る予定のファイル**: `src/data/lateCatalog.ts`（31 行目のリテラル）、`src/data/freeCookFinishGate.ts`（13 行目のリテラル）、ピン留めテスト `src/data/freeCookFinishGate.test.ts:16` と `src/data/lateCatalog.offGolden.test.ts:28`、ON 用の golden / E2E の追加。

| 観点 | 判断（読取に基づく） |
|---|---|
| **#639 とのファイル重なり** | **なし**（E5 は `gameReducer.ts` を触らない）。HOT ファイルの claim 競合なし |
| **#640 とのファイル重なり** | **あり**: 両方 `lateCatalog.ts`。#640 は先頭コメント・import（28 行目付近に 1 行追加）・型・validator を変更し、31 行目のリテラルそのものは変更しない。ただし import 追加が 31 行目から 3 行以内なので、**同じファイルへの近接 hunk として機械的な競合になりうる**（意味の衝突ではない） |
| **意味の依存** | E5 は #639・#640 に**依存しない**。ikura は `doughKind` を持たず、`ladderCredit` も省略（=従来どおり credited で late step を持つ）。#640 のテストが ikura の late step を 56 と固定しており、本測定の ladder（56 step・late step 56）と一致 |
| 逆向きの依存 | #640 の D3 テストは「Pinsa target があると late-addition の affordance が step 33 に前倒しされる」を許容済み。**E5 を Pinsa（P3-b）より先に出す**（O-1）限り、E5 の ON ビルドには影響しない。Pinsa を ON の同じビルドに載せると affordance の前倒しが起きる（Owner が許容した D3）ので、順序は ikura E5 → Pinsa |
| 推奨する merge 順 | #640（独立・clean）→ E5 PR（最新 main に追従）。E5 が先なら、#640 側が 31 行目付近の競合を解く。**どちらの PR も本セッションは変更しない** |
| 再測定 | #639 / #640 が先に main に入った場合、E5 PR の HEAD で §5.1・§5.3 の最小再測定（ベンチ 4 状態と実ラウンド 1 回）と CI を取り直す（AC-9。前 HEAD の結果は流用しない） |

## 3. V1 の安全条件 6 項目と停止条件（実施前・実施中の確認）

| # | 安全条件（#633 §11.3） | 確認した方法と結果 |
|---|---|---|
| 1 | **origin** が `perusonao.github.io` でない | 各テストの冒頭で `location.origin` を取得し、`host !== "127.0.0.1"` または github.io を含めば例外（= 停止）にするコードを組み込んだ。実測: `http://127.0.0.1:5193`（全テストで同じ）。**OK** |
| 2 | **save の分離**: 新規プロファイルで `localStorage` が空。本番・Preview の save を読まない | Playwright の新規コンテキスト（永続化なし）。起動直後に `localStorage.length === 0` を確認（`ls: 0`、`ss: 0`）。投入した save は**合成 fixture のみ**（全素材 9 個所持、`dex: []` または `seed-save.json`）。本番・Preview の save・エクスポートは読んでいない。**OK** |
| 3 | **外部通信なし** | `VITE_FIREBASE_*` は未設定（環境変数を確認: `VITE_` / `FIREBASE` を含む変数なし、`.env*` は `.env.example` のみ）。加えて `context.route` で `127.0.0.1` 以外のリクエストをすべて abort し、件数を記録。実測: **全テストで 0 件**。**OK** |
| 4 | **非公開**: ビルドをアップロード・デプロイしない。作業ツリーは使い捨てで、commit 対象に ON リテラルが入らない | 作業ツリーは `git archive 3570f44` の展開物（repo の外、スクラッチパッド）。**repo の作業ツリーは測定中も測定後も clean**（`git status` 空）。デプロイ・Pages・Functions・共有 Preview には触れていない。**OK** |
| 5 | **対象の特定** | commit SHA `3570f44d179bab3bd35ad51ab90c6149b23c0e76`、パッチ差分のハッシュ（§6）、実行コマンドを記録。**OK** |
| 6 | **停止条件**: いずれかが確認できなければ開始・継続しない | 上記 1〜5 がすべて確認できたので開始した。測定中に停止条件には**該当しなかった**。**OK** |

測定環境の補足: Playwright 1.56.1 は自分のバージョン用の Chromium が無く（`playwright install` は実行しない）、`/opt/pw-browsers` の Chrome for Testing 153.0.8010.12 を `executablePath` で指定した。サーバは `vite --host 127.0.0.1 --port 5193 --strictPort`（`VITE_PREVIEW_MODE=1`、`TETO_TEST_HOOKS=1`＝Free Cooking の無対象開始用のテストフック。出荷ビルドには無い）。終了後にプロセスは残していない。

## 4. 使い捨て ON ビルドの内容（repo には入れていない）

| パッチ | 内容 | SHA-256 |
|---|---|---|
| `v1-literals.patch.txt` | `LATE_CATALOG_PRODUCTION` と `FREE_COOK_FINISH_PRODUCTION` を `false`→`true`（2 行のみ）。ヘッダだけ `a/` `b/` 形式に整えた版（`git apply --check` 済）。内容の hunk は測定に使ったものと同一 | `c137ba17…4aa8`（測定時の原版は `6a81b155…d0dd`。ヘッダ違いのみ） |
| `v1-bench.patch.txt` | DEV ベンチ `PostLayerBench.tsx` の測定用差し替え（ikura のピース、`roePre=1` の対照）。**測定専用・Owner の実機手順では使わない** | `41803753…cc10` |

全ファイルのハッシュは `docs/reports/screenshots/fin-e5-v1-measurement/kit/SHA256SUMS`。測定スクリプト（`*.spec.ts.txt`）・設定・結果 JSON も同じ `kit/` に置いた（再現用。実行しても repo のテストにはならない）。

## 5. 測定結果（Chromium 390×844、V1 ON ビルド、`3570f44`）

### 5.1 salmon-roe の 3 状態（raw / perfect / burnt）と焼成なし

**ベンチ**（`?dev=postlayer&bake=…`。ikura の実ピース: クリームチーズ 2・サーモン 3（焼成前）、いくら 2・大葉 1（後乗せ層））。後乗せ層だけを隔離して撮影（背景・焼成前ピース・焼成オーバーレイ・煙・グローを非表示）。

| 状態 | 後乗せ層の画素 SHA-256 | 焼成前ピース（対照）SHA-256 | 焼成前に置いたいくら（対照）SHA-256 |
|---|---|---|---|
| none | `1b122218…aa3b7` | `ef39a01e…6190f` | `70da81f0…a5fdd` |
| raw | `1b122218…aa3b7` | `a262cdc3…de96f` | `91dee06e…c0963` |
| perfect | `1b122218…aa3b7` | `85eaaa2d…7a19d` | `19c2cf0f…ed145` |
| burnt | `1b122218…aa3b7` | `fc3c5a3f…1d0ac` | `7118cc8e…ea732` |
| 結果 | **4 状態で完全一致** | **4 状態ですべて異なる** | **4 状態ですべて異なる** |

（SHA の途中省略は読みやすさのため。完全値は `kit/out-m2-bench.json`。）対照が変わるので、測定は変化を検出できる。**後乗せのいくら・大葉は焼き色フィルターに染まらない**（#518・D2-2 の意図どおり）。DOM 側も確認: 後乗せ層は `.pizza-dough` の外（`layerInsideDough: false`）、層の `filter` は `none`、生地側のフィルターは `saturate(1.12) brightness(0.99)`。

**実ラウンド**（Free Cooking、FINISH 実画面）: 焼き加減の針を 59 / 68 / 77 に落とし、それぞれ FINISH でいくら 2・大葉 1 を置いて隔離撮影。

| 焼き（窓 58–78） | 生地のクラス | 後乗せ層の画素 SHA-256 |
|---|---|---|
| 59（下端） | `pizza-dough--perfect` | `c7bc7788…67030` |
| 68（ジャスト） | `pizza-dough--perfect` | `c7bc7788…67030` |
| 77（上端） | `pizza-dough--perfect` | `c7bc7788…67030`（**3 つとも同一**） |

**raw と burnt は実ゲームの FINISH に現れない**: 生焼け（針 20）・焦げ（針 95）は FINISH を飛ばして**失敗**カード（「生焼けで提供できません」「焦げすぎて提供できません」、+0 Pitz）に直行する（§5.2）。したがって AC-8 の「raw / perfect / burnt」はベンチで、実プレイの FINISH は perfect クラスで測るのが妥当（これは Owner の判断材料）。

### 5.2 失敗ラウンドと暫定スコア

| 針 | FINISH | 結果 |
|---|---|---|
| 20（生焼け） | 出ない（`finish-dock` 0 件） | 「失敗 生焼けで提供できません 💧 焼き加減: 生焼け 今回の獲得 +0 Pitz」 |
| 95（焦げ） | 出ない | 「失敗 焦げすぎて提供できません 🔥 焼き加減: 焦げ 今回の獲得 +0 Pitz」 |

後乗せ要件を外した暫定スコア（#495）が画面に出る経路は、ON ビルドでも見つからなかった（失敗ラウンドは FINISH を飛ばし、暫定値は表に出ない）。#495 を E5 に不要とするかは O-4（未回答）。

### 5.3 識別（後乗せ判定）と採点（Scoring 2.0）

Free Cooking、焼き 68 で、焼成前はクリームチーズ 2・サーモン 3、FINISH で置く後乗せだけを変えた。得点の内訳は Preview ビルドの Scoring 2.0 デバッグ表示。配置は固定の任意位置（Reference の位置には合わせていない）。

| 後乗せ | 結果 | 得点 | 備考 |
|---|---|---|---|
| いくら 2・大葉 1（焼き 59 / 68 / 77） | **ikura 発見**（NEW PIZZA） | **63 点 ★3 / +133 Pitz（初回 +50）**（3 つとも同一） | Bake 100・Recipe 100・Pieces 45。針 59 / 77 も Bake 100（窓内） |
| いくら 1・大葉 1 | ikura 発見 | 50 点 ★2 | いくら 1/2（量 67%）、Q ×0.75 |
| いくら 5・大葉 1 | ikura 発見 | 44 点 ★2 | いくら 5/2（量 0%）、Q ×0.85 |
| いくら 2・大葉 2 | ikura 発見 | 56 点 ★2 | 大葉 2/1（量 50%）、Q ×0.85 |
| いくら 2・大葉 0 | **ORIGINAL**（「まだ新しいレシピは見つかっていません」） | — | 大葉が必須 |
| いくら 0・大葉 1 | ORIGINAL | — | いくらが必須 |
| いくら 2・大葉 1 を**焼成前**に置く | ORIGINAL | — | 後乗せでないと別の皿 |
| FINISH で何も置かない | ORIGINAL | — | クリームチーズ・サーモンのみ |

後乗せの判定は「**種類の有無**（`late` 軸は presence）」で、個数の過不足は得点（量・Q）に出る。誤判定・クラッシュ・外部通信は無し。

### 5.4 リング上限（Q-5 / R-A）

- ikura の Reference は非ソース 8 ピース（焼成前 5 + 後乗せ 3）で、8 スロットのリングに収まる（#627 AC-5、本セッションで再実測はしていない）。
- **プレイヤーの配置に上限は無い**: FINISH でいくら 2・大葉 1（後乗せ 3）の後にさらにいくらを 4 回タップすると、後乗せは **7 ピース、全体で 12 ピース**になった（拒否されない）。最小のピース中心間距離は 24.4 px（この配置での値。ピースの大きさ 約 17〜40 px）。
- 超過の効果は得点側に出る（§5.3 のいくら 5 個 → 量 0%、Q ×0.85）。**後乗せ 5 ピースの Pinsa L2 の実測はしていない**（O-1 で ikura のみのため。O-2 は未回答）。
- 画像: `ring-after-extra-taps.png`。

### 5.5 salmon-roe の見え方（数値は参考。合否基準は既存に無い）

ベンチ（390×844）で、いくらピース（約 19.6×24 px）の内側平均色と、まわり 8 px の輪（ピース自身を除く）の平均色を比較した。

| 焼き状態 | いくら内側 RGB | まわり RGB | RGB 距離 | WCAG 比 |
|---|---|---|---|---|
| none | 219,144,85 / 220,146,88 | 236,184,152 / 235,185,148 | 79 / 73 | 1.45 / 1.44 |
| raw | 221,147,91 / 222,148,92 | 241,203,186 / 240,205,185 | 112 / 110 | 1.66 / 1.66 |
| **perfect** | 218,140,78 / 219,142,81 | 230,167,123 / 226,163,115 | **54 / 41** | **1.29 / 1.22** |
| burnt | 200,123,66 / 201,126,69 | 123,87,65 / 116,82,60 | 85 / 96 | 1.94 / 2.17 |

**焼き色が「ちょうど」のとき、いくらの周囲との差が最小**（オレンジのいくらと黄金色の生地）。後乗せ層は焼き色で変わらないため、焼き色の濃いほど目立つ。大葉（約 16×20 px）も小さく、FINISH 実画面の撮影（`real-finish-just-68.png`）では控えめに見える。見えやすさの判断は Owner（O-12）。画像: `bench-roe-*.png`、`compare-bench-roe-none-raw-perfect-burnt.png`。

### 5.6 ladder と late step

ON ビルドの `DISCOVERY_LADDER` は **56 step**、最後が `{ step: 56, ingredientIds: ["salmon-roe"], keyRecipeId: "ikura-salmon-pizza" }`（通常 55 + 1、#634 が step 55 を使用済み）。通常の credited レシピ 58 件を発見済みの save では、ikura は Research のエントリとして出る。章 4 の表示は「28/28」（K2: 後乗せカタログのレシピは完了判定の分母から除外、既存の ✓ は維持）。通常 batch が追記されるたびに ikura の step 番号は +1（既到達は不変）— 方針は O-3（未回答）。

### 5.7 実プレイの経路（Research）— 本番ビルド相当

出荷ビルド（テストフックなし）では「無対象の Free Cooking」に UI から入れないため、**実プレイヤーの経路は ピザ図鑑 →「研究中のピザ」→「このピザを研究する」**。V1 のテストフック経路（Free Cooking）とは別に、**テストフックなしの `vite build` + `vite preview`**（`VITE_PREVIEW_MODE=1`）でこの経路を通した（`kit/owner-seedflow.spec.ts.txt`）:

- `seed.html` で合成 save を投入 → ホーム → ピザ図鑑 → 研究中のピザ（5 件）の先頭を研究 → タブは 生地 / ソース / チーズ / 具材 / 焼く / **仕上げ**（6 タブ）→ クリームチーズ 2・サーモン 3 → 焼成（針 68）→ 仕上げでいくら 2・大葉 1 → 完成 → **「いくらとサーモンのピザ を発見しました！」**、63 点 ★3、+133 Pitz、新しい調理法「後乗せ」。
- 研究の対象と違うエントリを選んでも、食材が ikura と一致すれば ikura が発見された（そのまま観察。仕様の評価はしていない）。
- 画像: `research-finish.png`・`research-result.png`。

### 5.8 R8（強制終了）の Chromium での近似 — 実機の代替ではない

「強制終了」= ページを `close()`、「再起動」= 同じコンテキストで開き直し（localStorage は残る）。Free Cooking、ikura、焼き 68、FINISH でいくら 2・大葉 1 を置いた状態（`完成` 前）で実施。

| 時点 | 所持数（クリームチーズ / サーモン / いくら / 大葉）、図鑑、Pitz、`pendingRound` |
|---|---|
| 開始前 | 9 / 9 / 9 / 9、図鑑 0、Pitz 0、なし |
| FINISH 中（強制終了の直前） | **7 / 6 / 9 / 9**（焼成前の材料は焼成確定時に消費。後乗せは `完成` で消費）、図鑑 0、`pendingRound: pending` |
| B-1 再起動後 | **7 / 6 / 9 / 9**（**戻らない**）、図鑑 0（ORIGINAL は図鑑に載らない）、Pitz 0、`pendingRound: settled`。ホームに**通知**「中断していたピザを完成させました／オリジナルのピザとして記録しました。」＋「確認した」 |
| D-1: 通知を確認せず再起動 ×3 | 3 回とも状態のハッシュが同一（二重登録なし）、通知は 1 つのまま |
| B-2: 「確認した」→ 再起動 | 通知なし、`pendingRound` 削除、図鑑・Pitz・所持数は確認前と同一 |
| 焼成の取り出し直後（ピース 0 個）で強制終了 | 同じ通知（オリジナルのピザとして記録） |

**観察（O-11）**: Free / Research の仕上げ中に止めた場合、**ikura は発見されず**、焼成前の材料は消費済みで、通知には「仕上げの工程が終わる前に中断したため…（未完成のピザです）」の行が**出ない**。コード上、この行（`unfinishedFinish`）は `finishPending` が立つ Guided のラウンドにだけ出る（`src/state/pendingRound.ts:144`、`pendingRoundSettle.ts:97`）。登録・在庫・通知という R8 の約束（#617: 「前回ピザが登録され、在庫が戻らず、通知が出る」）は満たしている。文言が足りないことを E5 の条件にするかは Owner。Research ラウンドの仕上げ中の強制終了は本セッションでは測っていない。画像: `r8-quit-mid-finish-notice.png`。

## 6. AC-8 の証跡（Owner が #621 に添付するもの）

| 項目 | 値 |
|---|---|
| 対象 commit SHA | `3570f44d179bab3bd35ad51ab90c6149b23c0e76`（`main`）＋ `v1-literals.patch.txt`（スイッチ 2 個の反転）＋ ベンチ測定パッチ（動画の前半のみ使用） |
| パッチのハッシュ | §4 の表 |
| 撮影環境 | Chrome for Testing 153.0.8010.12（Linux、ヘッドレス、Playwright 1.56.1）、390×844、`http://127.0.0.1:5193`、新規コンテキスト、Firebase なし、外部通信 0 件 |
| 動画ファイル | `AC8-v1-evidence-3570f44.webm`（VP8、390×844、25 fps、**31.08 秒**、**1,070,381 bytes**） |
| **動画の SHA-256** | `cff3ed1b94c3475446cf7158467a09e7ef95839b8afd8a3c3d368ba345057c5a` |
| 動画の保存場所 | repo にはコミットしない。**Owner へ直接渡す**（このセッションからファイルを送付）。セッションのスクラッチパッドは使い捨てで、container の寿命と共に消える |
| 動画の内容（画面上端のキャプション付き） | ① ベンチ: いくら（後乗せ層）の none / raw / perfect / burnt ② 対照: いくらを**焼成前**に置いた raw / perfect / burnt ③ 実ラウンド: Free Cooking（FINISH ON の 6 タブ）→ 焼成前 → 焼成 → 仕上げ（いくら 2・大葉 1）→ 結果（ikura 発見） |
| 動画に無いもの | 開始数秒は白画面（ページ読み込み）。360×800、WebKit、Research 経路、失敗ラウンド、R8 は動画に含めていない（スクリーンショットと数値は §5 と `screenshots/fin-e5-v1-measurement/`） |
| 検証結果（本セッションの測定） | §5.1: 後乗せの画素は 4 状態で一致（対照は 4 状態で相違）。**AC-8 の PASS 判定は Owner が動画を確認し #621 に記録してから** |
| #621 への添付 | このセッションの GitHub ツールには添付機能が無い。**Owner が添付**、できなければ外部保管先とこの SHA-256 を #621 に記録（2026-10-23 の決定） |
| 比較画像（commit 済み） | `docs/reports/screenshots/fin-e5-v1-measurement/`（`compare-bench-roe-none-raw-perfect-burnt.png` ほか。`video-contact-sheet.png` は動画のコマの抜粋） |

## 7. Owner が iPhone Safari で実機確認する安全な方法と、R8 の手順・合格条件

### 7.1 安全な環境（共有 Preview・本番を使わない）

**なぜ共有 Preview・本番を使わないか.** どちらも `perusonao.github.io` を共有し、`localStorage` は origin 単位で共有される（`TETO_SESSION-OPERATIONS_1.0.md` §5）。ON ビルドを置くと Owner の本番セーブに触れる経路ができる。2 つのスイッチはソース上のリテラルなので、環境変数で ON にする方法も無い（`?freeFinish=on` は FINISH 工程だけで、後乗せカタログは ON にならない）。

**推奨 I1: PC のローカルサーバを Wi-Fi 経由で iPhone から開く**（デプロイ・アップロードなし）。origin は `http://<PC の LAN IP>:4173` で、`perusonao.github.io` とは別。Mac は不要（Node.js が動く PC なら可）。

前提: PC（Node 22、git、npm）と iPhone が**同じ Wi-Fi**。iPhone は Safari の**通常タブ**（プライベートブラウズは不可）。

```
git clone https://github.com/perusonao/teto-pizza-game.git v1-iphone && cd v1-iphone
git fetch origin claude/teto-pizza-production-audit-jiu7oy
git checkout claude/teto-pizza-production-audit-jiu7oy      # src は main 3570f44 と同一 + 本 docs
git apply docs/reports/screenshots/fin-e5-v1-measurement/kit/v1-literals.patch.txt   # ON リテラル 2 個。commit しない
npm ci
# .env.local など VITE_FIREBASE_* が無いことを確認（Firebase 無し＝ランキング等の外部通信なし）
VITE_PREVIEW_MODE=1 npm run build        # Windows PowerShell: $env:VITE_PREVIEW_MODE=1; npm run build
cp docs/reports/screenshots/fin-e5-v1-measurement/kit/owner-seed.html.txt dist/seed.html
npx vite preview --host 0.0.0.0 --port 4173 --strictPort
```

iPhone Safari で `http://<PC の LAN IP>:4173/teto-pizza-game/seed.html` を開く:
1. 画面に **origin（LAN IP）・「既存セーブ: なし」** と出ることを確認。`github.io` や `https` の公開ホストなら**ボタンは動かない**（安全装置）。
2. 「検証用セーブを書き込む」→「ゲームを開く」。画面右下に **PREVIEW** バッジが出ること。
3. 画面収録を開始し、機種・iOS・Safari かホーム画面かを記録。

終了後: seed.html の「この origin の検証用セーブだけ消す」、PC で `Ctrl+C`、`v1-iphone` を削除。Safari の「履歴と Web サイトデータを消去」（全消去）は**使わない**。必要なら 設定 > Safari > 詳細 > Web サイトデータで**この IP だけ**を削除。

**中止条件（どれかで直ちに中止し、画面と動画を保全して報告）**: URL が `github.io`／本番／共有 Preview。seed.html が「既存セーブ: あり」で、それが検証用でない。PREVIEW バッジが無い。本番の保存が変化した。在庫だけが減り、図鑑・通知のどれにも反映されない状態を再起動後に確認した。二重登録。起動しない・再起動ループ。

**他の方法**: Owner が別 origin（例: `github.io` 以外の使い捨てホスティング）にアップロードする方法もあるが、アップロードを伴うため推奨しない。別リポジトリの Pages は origin が同じで**不採用**（#633 V3）。

**この手順の検証状況**: 同じ手順（seed.html → 図鑑 → 研究 → 仕上げ → 発見）を PC の Chromium でテストフックなしの `vite build`+`vite preview` に対して通した（§5.7）。**iPhone 実機では未実施。**

### 7.2 FINISH / ikura の実機確認（E5 前に必須・動画 390×844）

| ID | 手順 | 合格条件（私の測定に基づく期待。実機の判定は Owner） |
|---|---|---|
| E5-1 | 7.1 の準備後、ピザ図鑑 → 研究中のピザ → 「このピザを研究する」（先頭で可） | 6 タブ（…焼く / **仕上げ**）が 1 行に収まり、横スクロールなし |
| E5-2 | 生地を整える → ソースは何もせず次へ → チーズで **クリームチーズ ×2** → 具材で **サーモン ×3** → 焼く → ジャスト帯（65〜71）付近で取り出す | 仕上げに進む。皿の名前は出ない。「仕上げに好きな具をのせよう（なしでもOK）」 |
| E5-3 | 仕上げで **いくら ×2・大葉 ×1** を置く（↩ で戻せる）→ 完成 | 「いくらとサーモンのピザ を発見しました！」＋「後乗せ」。本書の Chromium 結果は 63 点 ★3（置き方で変わる） |
| E5-4 | 焼き色の違い（針が窓の下端・中央・上端）でも、いくら・大葉の見え方が焼き色で変わらない | **見えやすさは Owner が判断**（O-12）。いくらが周囲に埋もれないか、大葉が小さすぎないか |
| E5-5 | 失敗ラウンド: 生焼け・焦げで取り出す | 仕上げに進まず「失敗」。Pitz +0 |
| E5-6 | 別のやり方: いくらを焼成前（具材）に置く / 大葉を置かない | ORIGINAL（発見にならない） |

### 7.3 R8: B-1 通知・B-2・D-1 の手順と合格条件（実機）

元の定義は `TETO_R8_IPHONE-SAFARI-HV-PREP_Result.md` の B-1 / B-2 / D-1。ここでは **E5 に関係する FINISH 版**を第一に、2026-10-23 に一部実施された **CUT 版（マルゲリータ）**を併記する。**実機の PASS / FAIL は Owner の言葉でのみ記録する（セッションは代行しない）。** 記録欄は PREP §6 の様式に従う。

**準備（共通）**: 7.1 の環境。開始時の所持数（クリームチーズ・サーモン・いくら・大葉）、図鑑、Pitz を画面で確認して記録。画面収録を回し続ける（前回、通知の表示を覚えていなかったため）。

| ID | 手順 | 合格条件 | 中止条件 |
|---|---|---|---|
| **B-1（FINISH 版）** | 7.2 E5-2 まで進み、仕上げでいくら ×2・大葉 ×1 を置く（**完成は押さない**）。所持数を記録。**アプリスイッチャーで Safari を上にスワイプして終了**。Safari を再起動して**同じ URL** を開く | ① ホームに通知「**中断していたピザを完成させました**」が出る（本文は「オリジナルのピザとして記録しました。」。Chromium では「未完成」の行は出なかった: O-11）② **クリームチーズ・サーモンの所持数は戻らない**（焼成後の値のまま）③ いくら・大葉は消費されていない ④ ikura は**発見されない**（図鑑の作成回数・Pitz は変わらない）⑤ 通知が表示されたことを**画面収録で確認できる**（前回は未確認） | 通知が出ず、かつ所持数だけ減っている（R8 の目的が破れた）。起動しない／ループ。データ消失の疑い |
| **B-1（CUT 版・前回の続き）** | ホームの「ピザを作る」→ マルゲリータ →（Guided）→ 焼成を取り出し「切り終わる」が見える状態で、所持数を記録 → Safari を終了 → 同じ URL を開く | ホームに通知。マルゲリータが図鑑に登録される（★・Pitz の該当行）。所持数は焼成後の値のまま。通知の**表示を収録で確認** | 同上 |
| **B-2** | B-1 の通知の「**確認した**」を押す → もう一度 Safari を終了して再起動 | 通知が出ない。登録は 1 回分のまま（図鑑・Pitz・所持数は「確認した」の直前と同一） | 二重登録 |
| **D-1** | B-1 の直後、通知を**確認せず** Safari の終了→再起動を **3 回**繰り返す | 3 回とも図鑑・Pitz・所持数が同一（二重登録なし）。通知は 1 つのまま保持される | 数が増える・減る |
| 参考 | Chromium での近似（§5.8）: B-1 → 通知 1 つ・所持数維持・図鑑 0、D-1 → 3 回とも同一、B-2 → 通知消失・同一 | 実機の期待と同じ形。**実機の結果ではない** | — |

終了後の後片付けは 7.1 のとおり（検証用セーブだけを消す）。

## 8. 残るブロッカー（E5 実装 PR・merge の前に）

| # | ブロッカー | 担当 | 状態 |
|---|---|---|---|
| 1 | AC-8: 動画の確認、#621 への添付（SHA-256・commit SHA・環境・結果の記録）。**確認が済むまで PASS にしない** | Owner | 証跡は §6 で揃えた。**判定待ち** |
| 2 | iPhone Safari 実機 HV（動画）: §7.2。ikura・いくらの見え方（O-12）を含む | Owner | **未実施**（手順は §7.1・7.2） |
| 3 | R8 実機 HV の残り（B-1 通知の表示、B-2、D-1）: §7.3 | Owner | **未実施**（前回は B-1 の一部のみ） |
| 4 | Owner 判断: O-2（Q-5・5 ピース実測を E5 で省くか）、O-3（late step 番号）、O-4（#495）、O-5（R8 実機の範囲）、O-10（#633）、**O-11（仕上げ中断の通知文言）、O-12（見えやすさ）、O-13（R-A の意味）** | Owner | 未回答（記録は decision record） |
| 5 | **E5 実装 PR**（まだ作らない）: `lateCatalog.ts` 31 行目・`freeCookFinishGate.ts` 13 行目を `true`、`freeCookFinishGate.test.ts:16` と `lateCatalog.offGolden.test.ts:28` を**意図的に反転**（OFF の 4 面 golden・`finishD2Inert` は緩めず、ON 用の golden を別に追加）、ON の E2E（両 viewport・Chromium + WebKit）、Result Report。**Owner 承認後に着手** | セッション | 未着手（指示どおり） |
| 6 | E5 PR の最終 HEAD で CI が GREEN（AC-9）。#394 系の既知 flake はマスクしない。#639 / #640 が先に merge された場合は最小再測定（§2） | セッション | E5 PR 後 |
| 7 | 360×800 と WebKit は本セッションで未測定（本環境に WebKit が無く、測定は 390×844 の Chromium のみ）。CI の WebKit shard と実機で確認 | CI / Owner | 未確認 |
| 8 | ON → OFF（ロールバック）で、既に ikura を発見した save の挙動を**実機で**確認していない（自動テストはある: #627 AC-7、#617 AC 追加 5） | Owner（任意） | 未確認 |

**本セッションが測っていないもの**: Pinsa（P3）、BBQ、グランマ、Lunch Rush / Dinner（ikura は `lunchRush:false`）、Research ラウンドの仕上げ中の強制終了、後乗せ 5 ピース、360×800、WebKit、iPhone 実機、ON→OFF のセーブ互換（実機）。

## 9. 再現と保存物

- 作業ツリー: `git archive 3570f44` → `v1-literals.patch.txt` を適用 → `npm ci` → `playwright -c playwright.v1.config.ts`（`kit/` の spec）。実行は repo の外のスクラッチパッドで行い、repo には何も入れていない。
- 結果 JSON: `kit/out-m-results.json`（実ラウンド 3 状態・失敗・識別・リング）、`kit/out-m2-bench.json`（ベンチ 4 状態・対照・見え方）、`kit/out-m3-results.json`（採点・R8）、`kit/out-m4-results.json`（Research 経路）。
- 画像: `docs/reports/screenshots/fin-e5-v1-measurement/`。動画は含めない（HV 方針）。
- 測定中に 1 度、テスト進行が止まった（同じページを再利用して連続ラウンドを回した場合）。原因は調べていない（測定用スクリプト側の問題と見て、ラウンドごとに新しいページを使う形に直した。アプリの不具合かは未確認）。

## 10. 第 2 版の更新（2026-10-24、Owner 回答の反映と最新 main での再測定）

**E5 の本番公開は引き続き HOLD。** 以下は §1〜§9 を書き換えず、更新点だけを足す（§2 の #639・#640 の「進行中」は下記のとおり merge 済みに更新）。

### 10.1 決定の反映
`docs/decisions/TETO_FIN-E5_O1-O10_DECISION-RECORD_2026-10-24.md`（第 2 版）に反映。O-2〜O-5・O-10 は Owner 伝達済み（内容は監査 §7 の推奨案と同一として記録、**原文はこのセッションから参照できないため【内容は要確認】**）。O-11 暫定許容（ただし復旧通知・保存整合性は実機必須）、O-12 実機で判定・現段階未判定、O-13 承認（R-A は配置上限ではなく Reference・採点側の基準）。§8 の「Owner 判断（未回答）」のうち、O-2・O-3・O-4・O-5・O-10・O-11・O-13 は解消。**O-12 は未判定のまま残る。**

### 10.2 最新 main（`976b9f0`）での確認
- `main` は `3570f44` → #640（`95c791f`）→ #639（`976b9f0`）。スイッチは両方とも `false` のまま（`lateCatalog.ts:32`、`freeCookFinishGate.ts:13`）。ピン留めテスト 2 本（`freeCookFinishGate.test.ts:16`、`lateCatalog.offGolden.test.ts:28`）も `toBe(false)` のまま。
- 変更は 9 ファイル（#639: `doughSelection.ts`・`gameReducer.ts` ほか、#640: `lateCatalog.ts`・`discoveryCatalog.ts` ほか、テスト・docs）。`package-lock.json` は同一。E5 のスイッチ行（32 行目）は #640 の import 追加（29 行目付近）と近接するが、**パッチは現 main にそのまま適用できる**（`git apply --check` 済）。
- **最小再測定（§2 の方針どおり）を main `976b9f0` + 同じ 2 リテラルで実施**（同じスクリプト一式、V1 の安全条件 6 項目を再確認: origin `127.0.0.1`、`localStorage` 空、Firebase なし、外部通信 0 件、repo 作業ツリー clean）。**7 本すべて通過**。結果:
  - ベンチ 4 状態の後乗せ画素 SHA-256 は `1b122218…aa3b7` で 4 状態一致、対照は 4 状態で別。**`3570f44` と完全に同一（`out-m2-bench.json` の全値が一致）**。
  - 実ラウンド 3 状態（59 / 68 / 77）の後乗せ画素 SHA-256 は `c7bc7788…67030` で 3 つ一致、`3570f44` と同一。
  - 採点・識別（8 通り）、R8 の B-1 / D-1 / B-2 の近似、Research 経路の結果は `3570f44` と同一。
  - 差は、ピースの大きさの個体差に由来する数値（座標・幅が 0.1〜2 px 程度）のみ。判定に影響しない。
  - 保存: `kit/main976b9f0-*.json`。動画: `AC8-v2-evidence-976b9f0.webm`（33.16 秒、1,069,401 bytes、SHA-256 `351cdeea2c86e441d21d2c13f83ff80552f55c716f08e544e4077f3f3466da8c`）を Owner へ直接送付（repo には入れない）。
- #639・#640 が先に入ったことで、§2 の再測定の前提（E5 PR の HEAD で取り直す）は、**E5 PR を作る時点の main で再度取り直す**に更新（PR 作成後の最終 HEAD で CI と最小再測定）。

### 10.3 #633 の最終 Gate（読み取りのみ）
| 項目 | 状態 |
|---|---|
| 状態 | **Draft**、open、`mergeable_state: unknown`。base は旧 `829d449`（main は `976b9f0` まで進んだ）。変更は docs 1 ファイル（新規）なので衝突は見込まれないが、**merge 前に base の更新確認が要る** |
| CI（head `e2bd79d`） | build / classify / Layout Contract Gate / WebKit Gate は **success**。layout-chromium と WebKit shard は docs-only のため skipped（正常） |
| Codex | head `e2bd79d` に対し「Didn't find any major issues」、サマリは `has_unresolved_findings: false` |
| スレッド | 0 件 / レビュー 0 件 |
| 内容の鮮度 | 第 3 版（2026-10-23）。その後の決定（O-2〜O-5・O-11〜O-13）、V1 の実測、#639・#640 の merge は**含まれない**。#621 のコメントと本決定記録が最新 |
| 判定 | **Gate 条件（CI・Codex・スレッド）は満たしている。残りは Owner の操作**: Draft を ready にして merge する／しない。merge 前に base を更新し、必要なら決定記録・本 Result へのリンクを #633 に足す。**本セッションは #633 を変更・merge しない** |

### 10.4 実機 HV と LAN 方式
`TETO_FIN-E5_IPHONE-HV_Runbook_2026-10-24.md` に整理。**LAN 方式（I1）は V1 の文言どおりには満たさない（条件 2・3・4）**。推奨の補完 A1（iPhone のホットスポットに PC を接続し、サーバをそのホットスポット側 IP だけに束縛・2 台のみ・時間限定・アクセスログ）は **V1-LAN の追補として Owner の承認が要る**。承認までは接続・公開しない。

### 10.5 残るブロッカー（更新）
| # | ブロッカー | 担当 | 状態 |
|---|---|---|---|
| 1 | AC-8: 動画確認・#621 添付・PASS 記録（手順は Runbook §2） | Owner | 判定待ち |
| 2 | **V1-LAN 追補の承認**（無ければ実機 HV は開始できない） | Owner | 未承認 |
| 3 | iPhone 実機 HV（E-1〜E-7、O-12 の視認性判定を含む） | Owner | 未実施 |
| 4 | R8 実機: B-1 通知の表示・保存整合性、D-1、B-2（最小 5 回の強制終了、Runbook §3） | Owner | 未実施 |
| 5 | #633 を merge する（O-10。Draft・base 更新） | Owner | 未実施 |
| 6 | O-2〜O-5・O-10 の内容の確認（決定記録の【内容は要確認】） | Owner | 要確認 |
| 7 | E5 実装 PR（まだ作らない）。作成時: 最新 main で 2 リテラル、ピン留め 2 本の意図的な反転、ON 用 golden・E2E、最終 HEAD の CI（AC-9） | セッション | 未着手（Owner 承認後） |
| 8 | 360×800 と WebKit は未測定（CI と実機） | CI / Owner | 未確認 |

### 10.6 最新 main `afd1718` での記録（2026-10-24、Owner 指示で記録）

| 項目 | 記録 |
|---|---|
| 対象 | main `afd1718`（#639・#640・#649 merge 済み）＋ `v1-literals.patch.txt`（スイッチ 2 個のみ `true`、使い捨てツリー、commit なし） |
| 結果 | **7 / 7 通過**（V1 の安全条件 6 項目を再確認: origin `127.0.0.1`、`localStorage` 空、Firebase なし、外部通信 0 件、repo 作業ツリー clean）。ベンチ 4 状態の後乗せ画素 SHA-256 `1b122218…aa3b7` 一致（対照は 4 状態で相違）、実ラウンド 3 状態 `c7bc7788…67030` 一致。`3570f44`・`976b9f0` と同一。採点・識別・R8 近似・Research 経路も同一 |
| 差 | 章の件数表示（No.29・28/29）、late step **57**（#649 で通常 ladder が 56 step）、ピースの大きさの個体差のみ |
| 保存物 | `kit/main-afd1718-*.json`、`kit/SHA256SUMS` |
| 位置づけ | **Chromium 390×844 の測定であり、AC-8 の PASS ではなく、実機 HV の代替でもない。** `afd1718` 用の動画は撮っていない（画素一致のため。E5 PR の最終 HEAD で最小再測定） |

### 10.7 現在の待機状態（Owner 指示 2026-10-24）

- **LAN 実機 HV（V1-LAN A1）は、Owner が PC を使えるまで待機。** 手順は `TETO_FIN-E5_LAN-HV-SERVER_Audit_2026-10-24.md` §3・§4、強制終了は合計 4 回。待機中、サーバの起動・接続・公開はしない。実機の項目はすべて**未実施**（PASS なし）。
- FINISH / 後乗せカタログの**本番スイッチは OFF のまま**（`lateCatalog.ts:32`、`freeCookFinishGate.ts:13`）。**E5 実装 PR は作らない。** Production・共有 Preview・Firebase は変更しない。
- #633 は案 X（先頭に対応表を追加、本文は履歴）で修正済み。merge は Owner（セッションは merge しない）。
