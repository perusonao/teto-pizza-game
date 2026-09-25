# Progression 2.0 W1 — Ingredient Visual Gate slice 2（専用 visual の Preview 候補）

## 結論

- 前回の Gate で DEDICATED_VISUAL_REQUIRED になった **fresh-tomato** と **capers**、および比較用の **clam B** について、専用 visual の候補を作った。場所は Preview（`visual-gate/w1`）の中だけで、`src/**` と `e2e/**` は slice 1 から一切変えていない。
- 判定は **PREVIEW_CANDIDATE_OK** 3 件と **HUMAN_VERIFICATION_REQUIRED** 5 件。PASS は 0 件。
  - PREVIEW_CANDIDATE_OK: fresh-tomato（輪切り）、capers（蕾の塊）、clam B（あさり）
  - HUMAN_VERIFICATION_REQUIRED: clam A 🦪、eggplant、corn、pineapple、potato
- **PREVIEW_CANDIDATE_OK の意味は「実機 Human Gate へ送ってよい」だけ**である。production で採用すること（PASS）は決めていない。
- iPhone で確認できる Preview を deploy した: **https://perusonao.github.io/teto-pizza-game-preview/w1-visual-gate/**。source SHA は **`ea8ae74b898698b7550bc8cf6ddd7f9382bc044b`** で、全ページの隅に表示される。production の GitHub Pages は変更していない。
- ingredient identity は変えていない。fresh-tomato は cherry-tomato と別の ingredient のまま。discovery regression と REC-08 は PASS。Evidence と Owner Decision は変更していない。READY / REVIEW / BLOCKED は 0 / 10 / 0 のまま。

## Authority の再確認（2026-09-24〜25）

| 対象 | 状態 |
|---|---|
| main | `1e53baa`。slice 1 以降に入ったのは #223（WebKit CI の evidence 修正）だけで、CI のみの変更 |
| #220 | `e49dab9`（変更なし） |
| #221 | slice 1 時点は `d028844`、**現在は `070afc0`**。main（#223）を merge しただけで、W1 content / authority の意味は変わっていない。#221 は変更も rebase もしていない |
| Evidence / OD | `abb0a3d`。evidence resolution の `--check` は新しい main でも PASS。READY 0 / REVIEW 10 / BLOCKED 0 |

authority の意味は変わっていないので、Visual Preview branch は作り直さず、`d62e884` から続けた。

## 仕組み（preview 専用）

- `visual-gate/w1/W1Glyph.tsx`: **ingredient id** をキーにして専用 SVG を描く。それ以外の ingredient は、置き換え前と同じ emoji 文字をそのまま描く。
- `visual-gate/w1/vite.config.ts` の transform（preview bundle のビルド時だけ適用）:
  - production が `ingredient.emoji` を描く **8 箇所**（piece、tray chip、drag preview、RESULT の材料リスト、thumbnail、Inventory、Shop、Dex）を `<W1Glyph>` に差し替える。
  - save key を gate 専用の `teto-pizza-w1-visual-gate-save-v1` に差し替える。Preview は production と同じ origin で配信されるので、production の save と混ざらないようにするため。
  - 置換は、対象の文字列がちょうど決められた回数だけ見つかることを条件にしている。production 側のコードが変わって一致しなくなったら、黙って古い emoji を描くのではなくビルドを失敗させる。
- `index.html`（Human Verification の入口）: 1 回タップすると、全材料を所持した save を gate 専用の key に作ってゲームへ入る。`game.html` がゲーム本体、`board.html` が比較ボード。
- 🐚 は slice 1 で FAIL だったので候補から外した。

## 1. fresh-tomato の専用候補 — PREVIEW_CANDIDATE_OK

- 形: **トマトを輪切りにした断面**。暗い赤の皮の輪と輪郭線、淡い芯、種の入った淡い部屋が 4 つ（車輪のような模様）。ヘタはない。
- cherry-tomato（🍅 のまま、丸ごとでヘタ付き）とは**形で**区別できる。grayscale でも、輪と種の部屋の模様と、🍅 のヘタの輪郭の違いが残る。tomato-sauce は pizza 上では塗り面として描かれ、🍅 が出るのは tray chip と RESULT の材料リストだけ。
- raw、baked（heat 1.0 / 1.6）、16px、tray、RESULT の材料リストのどれでも識別できた（AI 観察）。
- 気になる点（実機で確認）: 周りの emoji より **約 25% 小さく**見える。一目見たときにサラミやペパロニの輪切りに見える可能性がある。

## 2. capers の専用候補 — PREVIEW_CANDIDATE_OK

- 形: 先の尖った小さな蕾 **3 個が不規則に集まった塊**。大きさは 3 個ともばらばらで、濃い輪郭線と蕾の筋、ハイライトがある。
- ⚫ black-olive と 🔴 pepperoni はどちらも円 1 個なので、**形が違う**。grayscale と deuteranopia / protanopia のシミュレーションでも、蕾の塊と円 2 つとして区別できる。slice 1 では形の手がかりがなかったので、そこが解消した。
- raw、baked、16px の小さい piece、22 piece が載った pizza、tray のどれでも読めた（AI 観察）。
- 気になる点: 🔴 より小さい。ケッパーではなく豆、ブドウ、ハーブの塊に見える可能性がある。

## 3. clam の専用候補（B） — PREVIEW_CANDIDATE_OK

- 形: 殻を閉じた**あさりの二枚貝**を上から見た形。横に広い丸みのある三角の輪郭、殻頂（上の蝶番）の膨らみ、横向きの成長線とジグザグ模様、濃い輪郭線。
- 真珠や開いた身がないので oyster に見えにくい。渦巻きがないので巻貝にも見えない。成長線が横向きなので、筋が縦に入る 🧄 garlic とは区別できる。濃い輪郭線があるので parmigiano や oil の上に沈まない。grayscale でも 16px でも輪郭が残った。

## 4. 🦪（A） vs 専用 clam（B）

| | A 🦪 | B 専用 |
|---|---|---|
| 貝として読めるか | 読める（牡蠣として） | 読める（二枚貝、あさりに近い） |
| oyster に見えすぎないか | 見える（牡蠣そのもの） | 見えない |
| 巻貝に見えないか | 見えない | 見えない |
| garlic / parmigiano と混同しないか | しない | しない（grayscale でもしない） |
| 小さい piece での輪郭 | 残る | 残る（ただし 🦪 より小さい） |
| 判定 | HUMAN_VERIFICATION_REQUIRED | PREVIEW_CANDIDATE_OK |

A と B は hub の ①（A）と ②（B）で、同じ条件の pizza に置いて比べられる。**どちらにするかは決めていない**（OD-CLAM-GLYPH = DEFER_TO_VISUAL_GATE のまま）。

## 5・6. 390×844 / 360×800

- Chromium E2E は **20/20**。対象は**実際に deploy した bundle と byte 単位で同じもの**で、2 つの viewport でそれぞれ 10 test を実行した。

| 確認項目 | 390×844 | 360×800 |
|---|---|---|
| horizontal overflow なし（PREPARE / RESULT / board / hub） | OK | OK |
| TOPPING で縦スクロールなし、焼くバーが画面内 | OK | OK |
| 3 page の tray（topping 15 種） | OK | OK |
| busy pizza（22 piece）→ 焼成 → RESULT | OK | OK |
| RESULT に到達（焦げでない、page error 0） | OK | OK |
| 専用 visual の数と置いた id の数が一致。cherry-tomato は 🍅 のまま、fresh-tomato は 🍅 を描かない | OK | OK |
| RESULT の材料リストも同じ専用 visual で描かれる | OK | OK |
| gate 専用の save key にだけ書き込む | OK | OK |
| **visual の判定** | 上の判定のとおり（PASS なし） | 同じ |

- WebKit はこの sandbox では動かせない。`src/**` は変更していないので Final Gate にはしない。iPhone Safari での確認は実機の Human Gate で行う。
- Screenshots:
  - after: `docs/reports/screenshots/w1-ingredient-visual-gate-2/{390x844,360x800}/`（各 57 枚）
  - before: slice 1 の `docs/reports/screenshots/w1-ingredient-visual-gate/`

## 7. Discovery regression

- `progression2_w1_evidence_resolution.py --check` で production matcher を使い probe を再実行した: PASS。fixtures は byte 単位で一致し、collision 0、W1 の 10 件すべてが UNIQUE_MATCH、`pesto-caprese:fresh-tomato->cherry-tomato` は NO_MATCH のまま。**REC-08 は維持**した。
- 見た目は id ごとに描き分けており、identity の置き換えは一切していない。これは in-game の E2E で assert している。

## 8・9. Preview

| 項目 | 値 |
|---|---|
| Preview URL | https://perusonao.github.io/teto-pizza-game-preview/w1-visual-gate/ |
| Preview source SHA | `ea8ae74b898698b7550bc8cf6ddd7f9382bc044b`（全ページの ribbon と hub に表示） |
| Deploy | `perusonao/teto-pizza-game-preview` の commit `a0f34c1` で `site/w1-visual-gate/` を**追加**しただけ。既存の top-level preview（e5d5452）と production Pages は変えていない |
| Pages run | https://github.com/perusonao/teto-pizza-game-preview/actions/runs/36031443175 — success |
| 配信されている内容の検証 | sandbox から `perusonao.github.io` へは egress が拒否されるため、ライブの URL は開けていない。代わりに、deploy した tree が E2E を実行した bundle と `diff -r` で同一であることを確認した |
| 注意 | `deploy-from-source.yml` を次に実行すると `site/` 全体が置き換わり、この subdirectory も消える |

## 10. iPhone で人間が確認する項目（1 回で済むようにまとめた）

hub（上の URL）から ①、②、③ を開いて確認する。

1. capers（蕾の塊）と ⚫ black-olive / 🔴 pepperoni: tray、pizza の raw / baked、RESULT で区別できるか。iOS のカラーフィルタ（グレイスケール）でも区別できるか。
2. fresh-tomato（輪切り）と 🍅 cherry-tomato とトマトソース: 同じく区別できるか。トマトに見えるか（サラミに見えないか）。
3. clam A 🦪（①）: あさりとして受け入れられるか。
4. clam B 専用（②）: あさりに見えるか。牡蠣、巻貝、にんにく、パルミジャーノに見えないか。
5. eggplant 🍆: 焼いた後にトマトソースの上で沈まないか（Apple の glyph は色が暗い）。
6. corn 🌽 / pineapple 🍍: cheese の上で raw / baked とも読めるか。
7. potato 🥔: 長く焼いたときも読めるか。
8. 専用 piece の大きさが周りの emoji と釣り合っているか、画風が浮いていないか。
9. 材料が多い状態（3 page の tray、たくさん載った pizza）でも 1 画面に収まり、RESULT まで行けるか。

## 11. production への反映

**まだ決めない。** どの候補も production で採用していない。採用は、実機の Human Gate、clam についての Owner Decision、size parity の判断を経てからの W1 authoring slice で決める。そのときは emoji を描いている 8 箇所に反映する。`src/**`、#220、#221、#215 / #222 / #223、REC-01〜04、RT-01、recipe quantity、OD-S1 = A、Evidence ledger と Owner Decision は、いずれも変更していない。

## Validation

| check | result |
|---|---|
| evidence resolution `--check` / `--self-test` | PASS / 27/27 |
| recipe catalog / evidence invariants / canonicalizer | PASS / 4/4 / 36/36 |
| slice 1 の result `--check` | PASS（変更なし） |
| `tools/w1_visual_gate_2_result.py --check` / `--self-test` | PASS / 14/14 |
| 関連する UI の vitest | 124/124 |
| `tsc -b`、visual-gate の tsc、oxlint、`npm run build` | PASS（production の dist に gate のコードなし） |
| W1 Gate の Chromium E2E（deploy した bytes に対して） | 20/20 |

## Human Verification Videos

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| `w1-ingredient-visual-gate-2-390x844.mp4` | 390×844 | 2:02.8 | 3.24 MB（3,238,346 B） | H.264 High / yuv420p / 30fps | PASS |

Download: セッション内で直接提出した（repo には commit していない）。Video Verification: PASS（ffmpeg で最後まで decode してエラー 0。390×844 全体が映っていることを抽出フレームで確認）。

動画で見るもの（この順に収録）:

1. hub → ②（clam B）の seed でゲームに入るまで
2. tomato: 輪切りと 🍅
3. capers: 蕾の塊と ⚫ / 🔴
4. clam A
5. clam B
6. eggplant
7. yellow（corn / pineapple / potato / egg / ham）
8. busy: 22 piece を載せて焼成し RESULT へ
9. full-tray: 3 page の tray
10. 比較ボード（A/B、before/after、色覚シミュレーション）

描画は Chromium と Noto なので、iOS の実機 PASS の代わりにはならない。

## 次の最小 slice

1. ユーザーが iPhone で上の 9 項目を 1 回確認する。Owner が clam（A / B / その他）を決める。
2. その結果を受けて、Preview の中で size parity を調整する（SVG の大きさを 1em より大きくする）→ Gate を再実行する。production への反映はその後の W1 authoring slice で判断する。
