# Dinner Mission DM-5-1 — Human Timing Gate: measurement environment Result

- **Parent Issue:** #257（DM-5-1 slice）
- **Authority:** `TETO_DINNER-MISSION_DM-4_Phase4-0_Plan.md` §11（Human Timing protocol）、`TETO_DINNER-MISSION_DM4-DM5_Fresh-Audit.md`、OD-DM5-1〜6
- **Branch:** `claude/dm5-1-human-timing-gate-otc0c8`。audit branch `claude/dinner-mission-dm4-dm5-audit-0dotex`（`cbeaae4`）の上に積んでいる。templates と summary tool はそちらから来ている
- **Audited main:** `51e09237`（Merge PR #252, DM-3R-2）。この後 main は `7bb0116`（DH4-2A。unwired な pure logic で、Dinner runtime は同じ）に進んだ。Preview は Owner の指示どおり `51e0923` で build した
- **Scope:** docs、data、tools、Preview repo の `site/` だけ。**production code、Dinner の値、reward、Scoring、DM-4 runtime はどれも変えていない**（`git diff 51e0923 HEAD -- src public index.html vite.config.ts package.json` は空）
- **STOP 判定:** **A. HUMAN TIMING READY TO COLLECT**（§8）

## 1. 何を用意したか

| 項目 | 場所 | 役割 |
|---|---|---|
| Preview の helper と recorder | `tools/dinner-dm5/preview/dm5-timing.html`（SOURCE OF TRUTH）→ Preview の `site/dm5-timing.html` | ① seed ② DM-A / DM-B の測定用リンク ②' 900 s の supplemental リンク ③ 1 run ごとの記録フォーム ④ CSV の共有とコピー。元に戻すボタンもある |
| runs template | `docs/reports/data/TETO_DINNER-MISSION_DM5_human-timing_runs.template.csv` | 列 `evidence_class` を追加した（値は `HUMAN` だけ有効） |
| summary tool | `tools/dinner-dm5/dm5_human_timing_summary.py` | 改修（§4） |
| 環境チェック | `tools/dinner-dm5/preview/dm5-timing.check.ts` と `playwright.check.config.ts` | tools 専用で CI には入れない。Preview build と production build の両方を検証する（§5） |

helper の Preview repo への反映は copy で行う。Preview の `deploy-from-source.yml` は `site/` を丸ごと置き換える。そのため、**Preview を deploy し直したら、helper を再配置する必要がある**（本体側のファイルからの copy。`__DM5_BUILD__` を short SHA に置換する）。

## 2. 条件の分離（混同させない仕組み）

| 条件 | URL | 扱い |
|---|---|---|
| **BASELINE**（正式サンプル） | DM-A `?dinnerDuration=320&dinnerMinStars=3` / DM-B `?dinnerDuration=355&dinnerMinStars=3` | OD-DM5-2 の検証用 baseline（**最終値ではない**）。gate、tier 候補、TIME_UP 率、repeat 上限に使う |
| **SUPPLEMENTAL（AUX_900）** | `?dinnerDuration=900&dinnerMinStars=3`（beginner だけ） | censored-distribution を見るための観察用。**balance sample ではない**。summary の `supplemental900` に別に出し、gate と候補には一切入れない |
| OFF_PROTOCOL | 上記以外の組み合わせ（DM-A を 355 s で遊ぶ、beginner 以外が 900 s を使う、★≠3 など） | 除外し、problem として出す |

- **HUMAN / AUTOMATED / MODEL:** recorder が書く行は常に `evidence_class=HUMAN`。summary は HUMAN の行だけを読む。AUTOMATED / MODEL の行が混ざった場合は `excluded` に入れて warning を出す。値が空なら problem にする。
  - AUTOMATED（`..._measure.jsonl`）と MODEL（`..._balance-matrix.json`）は、この tool の入力ではない。
- **recorder のフォームでも防ぐ:** ミッションと秒数の組み合わせが違うと「手順外」と表示する。900 s を beginner 以外で保存しようとすると拒否する。

## 3. 記録項目

| 依頼された項目 | 取り方 |
|---|---|
| mission | recorder の DM-A / DM-B（② のリンクを押すと自動で選ばれる） |
| device / viewport | 機種は iPhone を自動で推定し、OS / browser と CSS viewport は自動で入る |
| experience group | experienced / normal / beginner |
| total clear time | CLEAR 画面の「クリアタイム m:ss」 |
| pizza ごとの時間 | 各ピザの結果パネルに出る ⏱ 残り時間から自動で差分を出す。最後のピザはクリアタイムから計算する |
| final stars | 結果パネルの ★。CLEAR 画面には最後のピザの ★ が出ないので、そこは空欄を許す |
| retry count | `attempt_index`（tester × mission × 条件ごとに自動で数える）と、run の中で作り直した枚数（`pizzaRetakes`） |
| QUALITY_FAIL count | ピザごとの結果から数える |
| TIME_UP | 結果で「時間切れ」を選ぶ |
| completion order | TARGET_PASS になったピザの順番（`completionOrder`） |
| notes | メモ欄 |

## 4. summary tool の変更点

- HUMAN の行だけを読む。条件を BASELINE / SUPPLEMENTAL / OFF_PROTOCOL に分類する（§2）。
- 書き写しの誤りを検出する。
  - `clear_s` が `duration − remaining_at_end_s` と合わない
  - ⏱ が前のピザより増えている
  - `pizza_seq` が連番でない
  - CLEAR なのに TARGET_PASS が 4 枚でない、または最後のピザが TARGET_PASS でない
  - ★ が minStars 未満なのに TARGET_PASS になっている
  - 同じターゲットが 2 回 PASS している
  - ほかに、warning として attempt の連番の乱れ、ピザの行が無い run を出す
- 出力: run ごとの `runs[]`（clearS、pizzaSeconds、qualityFailCount、pizzaRetakes、completionOrder、passStars、ownerIphone）と、`missions`（BASELINE だけ）、`supplemental900`、全体の `gatePass`。
- `--bundle` は recorder が出した文字列（2 つの sheet がつながったもの）をそのまま読む。`--split-to` はそれを 2 つの CSV に分けて保存する。`--strict` は problem があれば exit 1 にする。
- `--self-test`（synthetic な行だけを使う）: MODEL / AUTOMATED / off-protocol の除外、900 s の分離、最後のピザの時間の計算、書き写しの誤りの検出、bundle の往復を確認する。

## 5. 検証

| # | 検証 | 結果 |
|---|---|---|
| V1 | `dm5_human_timing_summary.py --self-test` | PASS |
| V2 | local の Preview build（`51e0923`、`VITE_PREVIEW_MODE=1`）+ production build で `dm5-timing.check.ts` を実行 | **3 / 3 PASS** |
| V3 | **deploy した Preview の `site/`（Preview repo の `e3ce684`）を byte 単位で同じまま配信**し、同じ check を実行 | **3 / 3 PASS** |
| V4 | recorder が出した bundle を summary に `--strict` で渡す | problems 0。BASELINE 2 run と SUPPLEMENTAL 1 run に分かれる。900 s の beginner の run は balance の beginner runs に数えられない（0） |

check の内容:

- **E1:** seed は Preview の key（`teto-pizza-preview-save-v1`）だけに書く。production の key には触れない。restore で元に戻る。
- **E2:** DM-A は詳細画面で「制限時間 05:20・合格ライン ★3 以上」と出る。START 後の HUD は `⏱ 05:20`。DM-B は「05:55・★3 以上」。
- **E3:** 900 s のリンクでは DM-A / DM-B とも「15:00」と出る。helper に戻ると「補助（正式サンプルではない）」と表示される。
- **E4:** production build は `?dinnerDuration=320&dinnerMinStars=3` を付けても「制限時間 調整中」のままで、START は disabled。
- **E5:** recorder の CSV のヘッダーは 2 つの template と一致する。summary tool は問題なく受け付ける。

V3 の比較: deploy した `site/` の JS / CSS / icon は、local の `51e0923` Preview build と sha256 が一致した。違うのは workflow が後処理する `index.html`（noindex）と manifest（パス）だけ。

**live URL へのアクセスについて:** この sandbox の network policy は `perusonao.github.io` を拒否する（proxy 403）。そのため、live の URL を直接は開けていない。V3 は、Pages が配信しているものと同じ bytes を local で配信して検証したものである。live での最初の確認は、Owner が iPhone で行う（§7 の手順 1）。

証拠のスクリーンショット: `docs/reports/screenshots/dinner-dm5-1/`（390×844。V3 のもの）。V2 / V3 の run で入れた値は **synthetic なパイプライン確認用で、測定データではない**。どれも `docs/reports/data/` には置いていない。

## 6. Preview

| 項目 | 値 |
|---|---|
| Preview URL | https://perusonao.github.io/teto-pizza-game-preview/ |
| Source commit | `51e09237b52c02d92b2244fe67b567d45ddbe060`（badge は `PREVIEW · 51e0923`） |
| deploy-from-source | run #40 [36349977751](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/36349977751) success。Preview repo の commit は `956b111` |
| （取り消し） | run #39 [36349944000](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/36349944000)。ref を打ち間違えたので cancel した。push は発生していない |
| helper の配置 | Preview repo の commit `e3ce684`。`site/dm5-timing.html` を追加し、`site/dm3r2-setup.html` を戻した（sha256 `78c8afef…`、変更なし） |
| Pages | run #42 [36350022568](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/36350022568) success |
| production | **deploy していない**。`perusonao/teto-pizza-game` の Pages、Firebase、main には触れていない |

## 7. Owner の iPhone での最小手順

1. Safari で **https://perusonao.github.io/teto-pizza-game-preview/dm5-timing.html** を開く。
   - ホーム画面に追加しておくと便利。
   - 画面上部のビルドが `51e0923` になっていることを確認する。
2. 初回だけ「**テスト用セーブを入れる**」を押す（材料が減ったらもう一度押す）。
3. iPhone の**画面収録**を開始し、「**DM-A: ディナーミッション 1**」か「**DM-B: ディナーミッション 2**」を押す。
   - ゲームでは、同じ番号のミッションを選んで START する。
4. 普通にプレイする（CLEAR か時間切れまで）。画面収録を止める。
5. 「戻る」で helper に戻る。ミッションと秒数はすでに選ばれている。
   - 結果を押し、クリアタイムを入れる。
   - ピザごとに、⏱ 残り、結果、★ を入れる（画面収録を見ながら）。
   - 「**この run を保存**」を押す。
6. 次の run は 3 から繰り返す。
7. 終わったら「**CSV を共有 / コピー**」を押し、チャットに貼る。
   - CSV の編集は不要。Claude が `--bundle` で分割、集計して `docs/reports/data/` に commit する。

- **まず最初の目標:** DM-A と DM-B を各 1 run（Plan §11.4 の P3。記入の流れを確認するため）。
  - これで OD-DM5-6（Owner の iPhone のデータ）を満たす。
- **Owner（experienced）の最終目標:** DM-A と DM-B を、それぞれ CLEAR 3 run 以上。
- **ピザごとの入力が大変なとき:** クリアタイムと結果だけ保存し、画面収録を送ってもらえればよい。
  - ピザごとの行が無い run は warning になるだけで、集計はできる。
- **900 s（②'）** は beginner の人にだけ使う。Owner の run では使わない。

## 8. HUMAN サンプルの収集状況と判定

| profile | DM-A（BASELINE） | DM-B（BASELINE） | SUPPLEMENTAL 900 s |
|---|---|---|---|
| experienced（Owner の iPhone を含む） | 0 / 3 | 0 / 3 | — |
| normal | 0 / 3 | 0 / 3 | — |
| beginner | 0 / 3 | 0 / 3 | 0（任意。U-7: 最低 1 人） |

- **HUMAN のデータはまだ 0 件である。** 320 / 355 s と S=3 は、検証用の baseline のままで、最終値ではない。
- gate（Plan §11.5）はまだ未達である。DM-5-2 に進めるかは、この gate を満たし、Owner が review した後で判断する。

**STOP 判定: A. HUMAN TIMING READY TO COLLECT**
