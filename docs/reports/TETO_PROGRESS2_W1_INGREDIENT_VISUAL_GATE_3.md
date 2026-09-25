# Progression 2.0 W1 — Ingredient Visual Gate slice 3（最終）：fresh-tomato Final 候補

## 結論

- iPhone Safari で行った Human Visual Gate の結果（Owner から共有）を、Human Evidence として記録した。
  - **HUMAN_PASS**: clam dedicated B、capers dedicated、eggplant 🍆、corn 🌽、pineapple 🍍、potato 🥔。この 6 材料はこの slice で作り直しておらず、再検証もしていない。
  - **clam の Owner Decision**: `DEDICATED_CLAM_B`。🦪 と 🐚 は不採用。**capers**: dedicated の蕾の塊を採用候補とし、🟢 は不採用。
- **fresh-tomato だけ**を作り直した。前回候補 A は iPhone でサラミやペパロニに見えたため、Final 候補 B を作った。
  - 自動判定は **B = PREVIEW_CANDIDATE_OK**、**A = NEEDS_REVISION**。
  - fresh-tomato 自体は **HUMAN_VERIFICATION_REQUIRED のまま**。
- Preview: **https://perusonao.github.io/teto-pizza-game-preview/w1-visual-gate/**。source は **`fe80e3c2ee4f0d7d3967cbe35780d819e7f842e7`**。iPhone で A と B を比べられる。
- production への反映はしていない。採用するかどうかは、fresh-tomato を iPhone の Human Gate で確認してから決める。`src/**`、`e2e/**`、`.github/**` に差分はない。

## Authority（作業開始時に確認）

| 対象 | 状態 |
|---|---|
| main | `1e53baa`。slice 2 から変わっていないので、W1 authority の意味は変わっていない |
| #220 | `e49dab96bd9b26dc0f520349cf09d1160c3519f5` |
| #221 | `070afc0827f382bec8bc813d62e7fafe663a0991`。指定どおりで、Final Codex Gate は PASS 済み（Owner から共有）。変更していない |
| Preview branch | `dcd6ae6`（slice 2 のレポート）から続けた |

## 1. fresh-tomato の旧 candidate（A、slice 2 の `tomato-slice`）

- 完全な丸。濃い赤の厚い皮の輪、丸い淡い種の部屋が 4 つ、淡い芯。
- iPhone で「赤い円に中の模様」として見え、サラミやペパロニ系の具材に見えた。grayscale にすると「縁の暗い円の中に丸い点が 4 つ」になり、腸詰めの断面の模様と同じになることを Preview でも確認した。自動判定は **NEEDS_REVISION**。
- 比較のため `?tomato=a` と board の A 行で見られるようにしてある。

## 2. fresh-tomato の Final candidate（B、`tomato-slice-final`）

- **外周**: 完全な丸ではない。6 つのゆるいふくらみに、少しの偏りと 3 倍の波を足して、トマトの断面らしい形にした。皮は薄い赤の線。
- **内部**: 中心に**星形の淡い芯**があり、そこから**放射状の淡い隔壁が 6 本**出る。その間に**黄色いゼリー状の種の部屋が 6 つ**あり、それぞれに**芯のほうを向いた涙形の種が 3 粒**入っている。
- **大きさ**: 周りの emoji と同じくらいに見えるよう 1.15em で描いた。負の margin を付けて、レイアウト上の箱は 1em のまま。
- ID は `fresh-tomato` のまま。cherry-tomato への alias も、🍅 の共有に戻すこともしていない。

## 3. pepperoni との差

| | 🔴 pepperoni | A（旧） | B（Final） |
|---|---|---|---|
| 外周 | 真円 | 真円 | ゆるくふくらんだ不規則な形 |
| 内部 | 何もない（ツヤだけ） | 丸い点が 4 つ（サラミ風） | 放射状の車輪、ゼリーの部屋、種 |
| grayscale | 一様な灰色の円 | 縁の暗い円に点 | 明るい放射状の車輪 |

## 4. cherry-tomato との差

- 🍅 は丸ごとの実を横から見た形で、ツヤと緑のヘタがある。B は平らな断面で、ヘタはない。色、grayscale、16px のどれでも輪郭がはっきり違う。
- tomato-sauce は pizza 上では塗り面として描かれ、🍅 が出るのはソースの tray chip と RESULT の材料リストだけ。B の輪切りの絵と並んでも取り違えない。
- 実際のゲームの pizza に「左の列が fresh-tomato ×3、右の列が cherry-tomato ×3、中央が pepperoni ×2」と置き、別々の ID として数えられることを E2E で assert した。

## 5. raw / baked / deep

- raw: トマトソース、モッツァレラ、ペストの上で、B は区別できた（AI 観察）。
- baked（heat 1.0）: 外周、車輪の模様、種が残る。
- deep（heat 1.6）: 色は暗くなるが、ふくらんだ外周と車輪の模様は読める。
- 小さい表示: 16px の thumbnail と RESULT の材料リストのアイコンでも車輪の模様が残る。22 piece を載せた pizza でもトマトの輪切りとして読めた。

## 6. grayscale / 色覚シミュレーション

- grayscale: B は明るい放射状の車輪、🔴 は一様な灰色の円、🍅 はヘタの輪郭で、形だけで区別できる。
- deuteranopia / protanopia のシミュレーション: 車輪と種の構造が残る。区別の手がかりは色ではなく形。
- いずれも AI 観察であり、Human PASS ではない。

## 7・8. 390×844 / 360×800

Chromium E2E は **20/20**（各 viewport 10 test）。実行対象は、deploy したものと byte 単位で同じ bundle。

| 確認項目 | 390×844 | 360×800 |
|---|---|---|
| horizontal overflow なし（PREPARE / RESULT / board / hub） | OK | OK |
| TOPPING で縦スクロールなし、焼くバーが画面内、3 page の tray | OK | OK |
| busy pizza（22 piece）→ 焼成 → RESULT（焦げでない、page error 0） | OK | OK |
| fresh ×3 と cherry ×3 が別 id、選んだ候補の絵だけが描かれる、cherry-tomato は 🍅、pepperoni は 🔴 のまま | OK | OK |
| RESULT の材料リストにも同じ候補が描かれる | OK | OK |
| gate 専用の save key にだけ書き込む | OK | OK |

WebKit はこの sandbox では動かせない。`src/**` は変更していないので Final Gate にはしない。

Screenshots: `docs/reports/screenshots/w1-ingredient-visual-gate-3/{390x844,360x800}/`（各 23 枚）
- `tomato-b-final-*`（after）と `tomato-a-slice2-*`（before）で、それぞれ tray / raw / baked / result
- `busy-*`、`full-tray-1-tray*`、`board-tomato`、`hub`

## 9. Regression

| check | result |
|---|---|
| discovery probe（`progression2_w1_evidence_resolution.py --check` の中で production matcher を使って再実行） | PASS。collision 0、W1 の 10 件すべてが UNIQUE_MATCH、`fresh-tomato->cherry-tomato` は NO_MATCH のまま、**REC-08 は維持** |
| evidence resolution の `--self-test` | 27/27 |
| evidence invariants / recipe catalog / canonicalizer | 4/4 / PASS / 36/36 |
| slice 1 と slice 2 の result `--check` | PASS（変更なし） |
| `tools/w1_visual_gate_3_result.py --check` / `--self-test` | PASS / 14/14 |
| 関連する UI の vitest | 120/120 |
| `tsc -b`、visual-gate の tsc、oxlint、`npm run build` | PASS（production の dist に gate のコードなし） |
| Visual Gate の Chromium E2E | 20/20 |
| 分岐元（merge-base）からの `src/**`、`e2e/**`、`.github/**` の差分 | **なし** |

- W1 identity は変えていない。Evidence ledger と `OWNER_DECISIONS.json` も編集していない。Owner Decision は gate の result にだけ記録した。
- READY / REVIEW / BLOCKED は 0 / 10 / 0 のまま。この visual slice で意味を変えることはしていない。

## 10・11. Preview

| 項目 | 値 |
|---|---|
| Preview URL | https://perusonao.github.io/teto-pizza-game-preview/w1-visual-gate/ |
| Preview source SHA | `fe80e3c2ee4f0d7d3967cbe35780d819e7f842e7`（全ページの ribbon と hub に表示。`SOURCE.txt` にも記載） |
| Preview repo SHA | `0e1e6028ad3a0f89949a8be5c15fe2bf6c215097`（変更は `site/w1-visual-gate/` の中だけ。top-level の preview、README、production Pages は変えていない） |
| Pages run | https://github.com/perusonao/teto-pizza-game-preview/actions/runs/36092970122 — success |
| deploy した bytes の検証 | deploy した tree が、E2E を実行した bundle と `diff -r` で同一。sandbox から `perusonao.github.io` へは egress が拒否されるため、ライブの URL は開けていない |
| Save | `teto-pizza-w1-visual-gate-save-v1`。production と PR preview の save とは分けている |
| 注意 | preview repo の README にある W1 の節は、slice 2 の SHA（ea8ae74）のままになっている。この slice では指示どおり `site/w1-visual-gate/` しか変更していないため。正確な SHA は、各ページの表示と `SOURCE.txt` を見ること |

## 12. iPhone で Human Gate を行う箇所

hub を開き、①（トマト B）と ②（トマト A）を同じ条件で比べ、③ の比較ボードも見る。

1. B が一目で「トマトの輪切り」に見えるか。サラミやペパロニに見えないか。
2. 同じ pizza に置いた B と 🔴 pepperoni を、形で見分けられるか。
3. B と 🍅 cherry-tomato を、tray、pizza、焼いた後、RESULT で見分けられるか。
4. B とトマトソース（塗り面とソースの chip）を取り違えないか。
5. 焼いた後、長く焼いた後、RESULT の材料リストの小さいアイコンでも読めるか。
6. iOS のカラーフィルタ（グレイスケール）で、B と 🔴 を見分けられるか。
7. A と B を比べて、B のほうが良いか。

## Human Verification Videos

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| `w1-ingredient-visual-gate-3-390x844.mp4` | 390×844 | 0:53.8 | 1.68 MB（1,677,616 B） | H.264 High / yuv420p / 30fps | PASS |

Download: セッション内で直接提出した（repo には commit していない）。Video Verification: PASS（ffmpeg で最後まで decode してエラー 0。390×844 全体が映っている）。

収録順: hub → トマト B（tray、配置、焼成中、RESULT）→ トマト A（同じ条件）→ busy pizza → 比較ボード。描画は Chromium と Noto であり、iPhone の実機 PASS の代わりにはならない。

## 次

- ユーザーが iPhone で fresh-tomato B の Human Gate を行う（上の 7 項目）。
- PASS になったら、production 採用を判断する W1 authoring slice に進む。そこで、Human PASS 済みの 6 材料と fresh-tomato の visual を、production で emoji を描いている 8 箇所に反映する。
- NEEDS_REVISION になったら、fresh-tomato だけを Preview の中で直す。

## 追記: fresh-tomato B の Human Verification 動画（完了条件の変更への対応）

この動画を見れば、fresh-tomato Final candidate B を Human PASS にしてよいか判断できるように作った。

| 項目 | 値 |
|---|---|
| File | `w1-fresh-tomato-B-human-verification-390x844.mp4`（セッションで直接提出。repo には commit していない） |
| 形式 | MP4 / H.264 High / yuv420p / 30fps |
| 解像度 | 390×844 |
| 長さ | 63.97 s |
| Size | 1,873,039 B |
| sha256 | `bf545dcebca7abda84b991cd520580b3595b60c7c928a089abc71aee7d1734a0` |
| 収録元 | deploy したものと byte 単位で同じ bundle（source `fe80e3c`、preview repo の `0e1e602` の `site/w1-visual-gate/` と `diff -r` で同一） |
| 台本 | `visual-gate/w1/e2e/w1-hv-video.spec.ts`（`W1_GATE_HV_VIDEO=1` のときだけ動く）。キャプション、タップ位置のカーソル、最後のカードは test 側で表示しており、Preview の bundle には含まれない |

収録順（各場面の静止時間は 1fps のサンプリングで測った値）:

1. Preview の入口（hub）: source SHA を表示して約 5 秒。続けてゲームの ribbon（SHA と `tomato B (Final)`）を約 3 秒。
2. tray: トマト（B）、チェリートマト 🍅、ペパロニ 🔴 が同じページに並ぶ（在庫 ×30）。約 3 秒。
3. 同じ pizza に B ×3（左）、ペパロニ ×3（中）、チェリー ×3（右）を置く。タップ位置のカーソルが見える。
4. RAW で約 4 秒静止し、続けて同じ pizza を grayscale で約 3 秒。
5. BAKED（needle を焼成窓の中心で止める）で約 5 秒静止。同じ配置のまま。
6. DEEP BAKE の見え方（needle ≈ 87、heat ≈ 1.6）を約 4 秒。その後 needle を窓の中心まで戻してから取り出す。
7. RESULT（「いい焼き加減」、焦げではない）: 材料リストの小さいアイコンで比べる。約 5 秒。
8. 比較ボード: A と B の tray と sauce の tray、B と A の行（cherry-tomato、pepperoni、tomato-sauce と一緒）、16px。各約 3 秒。
9. grayscale で B とペパロニを比べる（参考に A も）。
10. 最後の静止画 **HUMAN CHECK**（4 つの質問）と source SHA、Preview URL。約 7 秒。

frame sampling による検証（1fps と、要所をフル解像度で確認）:

| 条件 | 結果 |
|---|---|
| 最初から最後まで再生できる（ffmpeg で最後まで decode） | PASS（エラー 0） |
| 解像度が 390×844 | PASS |
| raw / baked / deep / Result / grayscale が含まれる | PASS |
| B と pepperoni を同時に見られる | PASS（raw、raw の grayscale、baked、deep、board） |
| SHA を読める | PASS（hub、ゲームの ribbon、最後のカード） |
| 意図しない状態が映っていない | PASS（Result は通常の焼成。深焼きは step 6 として表示したものだけ） |

fresh-tomato の **Human PASS はまだ付けていない**。ユーザーがこの動画を見てから決める（result JSON の `humanVerificationVideo.humanPass` は `null`）。
