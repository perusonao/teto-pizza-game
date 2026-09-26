# Completion Gate: 理想量より少ない具材でも完成できるようにする — Fresh Audit / Pre-Implementation Design（Issue #215）

- 作成: 2026-09-24 / **Rev.2（2026-09-24）: Codex review P2 への対応。**
  - §7.3 の「4 秒以上では品質 0 でも得」という誤った解釈を訂正した。
  - 品質 0 のケースの比較と、recipe mode と両立する係数の上限を追加した。
  - LR-A の推奨は維持し、強さを下げた（§0-5、§7.3、§7.4、HR-8、OD-4）。
  - tooling と matrix を再生成した（raw の simulation は変わらない）。
- **Rev.5（2026-09-24）: Codex review P2（4 回目）への対応。**
  - Lunch Rush の 1 run の点数に、production と同じ最後の整数への丸め（`Math.round(served × 100 + Σquality)`。`missionScoring.ts` と `shared/lunchRushScoring.ts`）を適用してから比較するようにした。
    - 同じ recipe が続く run: 理想と少なく載せた場合の両方を整数に丸めてから損益分岐を求める（例: 1.5 秒の pizza-bianca の理想 997.5 → 998。必要な `a` は 0.978 → 0.973）。
    - 注文の流れ: run ごとに整数へ丸めてから、その点数を平均する（平均を丸めるのではない）。
  - 必要な `a` は、格子の多くの点で小数第 3 位が 0.001〜0.010 下がった。§7.2〜§7.3 の表の値を更新した。
  - **結論は変わらない。** 45 ケースの勝敗（31/45）、品質 0 の少ない pizza が勝つ秒数（3.9 秒、4.4〜6.0 秒、6 秒で 7/45）、recipe mode と両立する秒数（同じ recipe: 0.5〜0.8 秒、注文の流れ: 0.5〜1.7 秒と 2.3〜2.9 秒）はすべて同じ。OD-4 の推奨（LR-A）も変わらない。
  - 丸めの回帰（pizza-bianca 1.5 秒、0.6 秒の 0.653、注文の流れの run ごとの丸め）を tool の中で assert している。
- **Rev.4（2026-09-24）: Codex review P2（3 回目）への対応。**
  - Python のバージョンによって matrix の生成結果が変わり、`--check` が STALE になる問題を修正した。原因は Python 3.12 で浮動小数の `sum()` が補正つきの加算に変わったこと。
  - tool のすべての派生値を、厳密な有理数（`fractions.Fraction`）と整数のミリ秒・0.1 秒単位で計算するようにした。
  - 注文の流れの表示値 5 つが、最後の桁で変わった（ちょうど中間の値を、厳密な偶数丸めで丸めるようになったため）。本文で引用しているのは §7.3 の 6 秒の平均枚数だけ（2.14 → 2.13）。結論は変わらない。
- **Rev.3（2026-09-24）: Codex review P2（2 回目）への対応。**
  - Lunch Rush のモデルを、180 秒より前に完了した提供だけを数える（`now >= endsAt` の提供は数えない）整数のモデルに置き換えた。
  - 同じ recipe が続く run と、production の注文の選び方を再現した注文の流れ（2000 run、seed 固定）の 2 つで、次を計算し直した: 理想と少なく載せた場合、品質 0、45 ケースの勝敗、係数の損益分岐、recipe mode との両立。
  - Rev.2 の「約 1.94 秒」の境界と「品質 0 はどの仮定でも勝たない」は誤りだったので削除した。
  - LR-E は非推奨に変え、LR-A の推奨の強さを元に戻した（§0-5、§7.2〜§7.4、HR-8、OD-4）。
  - 回帰の例（1 個 6 秒の margherita: 399 点 vs 品質 0 で 400 点）は tool の中で assert している。
- 監査対象 `origin/main`: **`dff233c042d2df6ee1c3a92f2d2419830aa05460`**（PR #210 の merge。作業開始時に GitHub の最新と一致することを確認）
- Branch: `claude/completion-gate-audit-7rqylp`（docs/data/tooling-only の PR。OPEN・未マージで止める）
- Machine-readable:
  - `docs/reports/data/ISSUE-215_COMPLETION-GATE_COMPARISON-MATRIX.json`（比較 matrix。`tools/issue215_completion_gate_audit.py` が生成）
  - `docs/reports/data/ISSUE-215_COMPLETION-GATE_sim-raw.json`（production code で実行したシミュレーションの生の出力）
  - `docs/reports/data/ISSUE-215_COMPLETION-GATE_simulation.test.ts.txt`（再現用 harness。`.txt` なのでビルドやテストには含まれない）

| PR / Issue | 状態（監査開始時） | 本書での使い方 |
|---|---|---|
| Issue #215 | OPEN（コメントなし） | 本書のスコープ |
| PR #214（3-4C Decision Gate） | OPEN・未マージ、head `5c1d6f0` | D-2（M4）、D-3（#215 に分離）、D-4（`10 × k` 個）を前提として読む |
| Issue #212 / PR #213（3-4F Lunch Rush） | OPEN・未マージ、head `7ccf5df` | `requiredStockUnits` の seam（§7） |
| #205 / #206 / #209 / #211 / #217 | OPEN | 読んでいない。変更もしていない |

> **Guardrail の遵守**
> - `src/**`、`e2e/**`、`.github/**` は変更していない。シミュレーションは一時的な vitest ファイルで実行し、終わった後に `src/` から削除した。`git status src` は clean。
> - Completion Gate は実装していない。
> - #205/#206/#209/#211/#213/#214/#217 に push、merge、rebase はしていない。
> - Progression 2.0 の Decision（⭐ の式や gate の値）は先取りしていない（§5.3 は影響の記録だけ）。
> - Full Chromium/WebKit は実行していない（docs/data/tooling-only のため）。
> - `docs/PROJECT_HANDOFF.md` の addendum は追加していない。OPEN の #213 が同じファイルを変更しているので、衝突を避けた。実装の Issue を切るときに追加する。

---

## 0. 結論（先に）

1. **今の不足の減点は軽すぎる（確認済み）。** 原因は構造的なもの。不足しているとき、Pieces の配置スコアは「置いた駒の平均」になり、置かなかったお手本の位置は減点されない。だから量の差は Pieces（重み 16）の中の「数」（30%）だけに効く。
   - funghi で mushroom 2/3 は −0.6 点、1/3 は −1.2 点。
   - **mushroom 0 個でも 87.5 点（★4）**（今は Completion Gate が FAILED にしているので見えていない）。
   - capricciosa の mushroom 0/2 は 94.3 点で **★5**。
   - 「FAILED を外すだけ」だと、全 46 の不足ケースが **★5・120 Pitz** になる（§3.2）。
2. **Scoring の中だけの修正（S1/S2: Pieces の配置を不足分も減点する）では足りない。** 1/3 でも 46 ケース中 45 ケースが ★5 のまま。量の軸は、Pieces の重み 16 を group の数で割った分しかスコアに効かないため。
3. **推奨: 量の係数 Q を total に掛ける。** 最も足りない具材の不足率（worst-group）を使う。
   - 式: `total × (1 − 0.5 × 不足率 − 0.15 × min(1, 過剰率))`
   - 理想 3 → 2 個 ★4 / 1 個 ★3、理想 4 → 3 個 ★4、過剰は +1 個で ★5 か ★4、+2 個以上で ★4
   - 経済: D-4 の価格では、少なく載せて Pitz が得になるケースは **45 中 0**
4. **FAILED の境界の推奨: G1「0 個だけ FAILED」。**
   - discovery の matcher（種類の集合で判定）、Recipe の要素（種類があるか）、今の文言「○○が入っていません」と一致する。
   - `minCount` を per-recipe で書き直す必要がない。
   - 50% などの割合（G2）は「理想 3 に 2 個」では通るが、「4 に 1 個」「2 に 1 個」の扱いが直感的でない（§2）。
5. **Lunch Rush は、recipe mode 用の係数（0.5）では守れない。品質の係数だけでは安定して守れない（Rev.3 で再計算）。**
   - Ranking は `served × 100 + Σquality` で、**180 秒より前に完了した提供だけ**が点になる（`now >= endsAt` の提供は数えない）。1 枚の価値の大部分は「提供した」こと自体にある。
   - 量の係数 Q（0.5）があっても、1 個 3 秒のモデルでは、少なく載せて早く出す方が 45 中 31 で得になる（§7.2）。
   - 1 本の係数で recipe mode の意図（2/3 = ★4。係数 ≤ 0.711）と Lunch Rush の両方を満たせる秒数は、狭く連続しない（§7.3）。
     - 注文の流れ: 0.5〜1.7 秒と 2.3〜2.9 秒
     - 同じ recipe が続く run: 0.5〜0.8 秒
   - 同じ recipe が続く run では、**品質 0 でも少なく載せる方が勝つ**秒数がある（1 個 6 秒の margherita: 理想 2 枚 399 点 < すべて 1 個 4 枚 400 点）。これは品質の係数では防げない。
   - Rev.1 の「4 秒以上で品質 0 でも得」（係数の読み違い）と、Rev.2 の「約 1.94 秒未満なら両立」「品質 0 はどの仮定でも勝たない」（端数の提供に点を与えるモデル）は、どちらも誤りとして訂正した（§7.3）。
   - **推奨: LR-A「Lunch Rush は注文どおりの数を求める」（今の gate のまま）。Rev.2 で下げた強さは元に戻す。**
     - 1 個の時間に左右されない: ranking の ruleset の bump、Cloud Function の変更、#213 の seam の値の変更がすべて不要。
     - LR-E（gate を統一して係数を上げる）は非推奨にした。統一した gate を選ぶなら、代案は LR-C（提供の点を量で割り引く）。
     - 代わりに「Lunch Rush では少ないと失敗」というモードの差が生まれる。これは owner の判断が要る（Decision Sheet OD-4）。
6. **データの持ち方の推奨: DS-A。** `minCount` は「理想量」のまま残し（読んでいる 7 箇所をそのまま使える）、完成に必要な最低量は Completion Gate の関数で決める（G1 なら常に 1）。`minCount` の意味を変える案（DS-B）は、Starter Grant、効率の閾値、Player Reference の表示を静かに壊す（§1）。
7. **判定:**
   - 設計: **Go（条件付き）**。Decision Sheet の OD-1〜OD-5 を owner が決めた後。
   - 実装: **No-Go（今は）**。#215 の guardrail どおり、3-4C の merge の後に始める。

---

## 1. 「最低量」「理想量」「実際に使った量」の分離

### 1.1 今 `minCount` を読んでいる場所（main `dff233c`、test を除く）

| # | ファイル | 使い方 | 本当は何の値か |
|---|---|---|---|
| 1 | `src/logic/completionGate.ts:179` | `count < minCount` で FAILED | **完成に必要な最低量** |
| 2 | `src/data/hints.ts:172` | `count < minCount` なら「○○をのせてみよう」、そうでなければ ready | 理想量（お手本に近づけるための案内） |
| 3 | `src/data/playerReference.ts:51` | お手本の表示の駒の数 | 理想量 |
| 4 | `src/state/starterStock.ts:51` | Starter Grant = `minCount × 10` | 理想量（1 枚あたりの想定消費） |
| 5 | `src/logic/efficiency.ts:64` | 調理時間の閾値 = `25s + 3s × Σ minCount` | 理想量（作業量） |
| 6 | `src/logic/economySimulation.ts:165,246` | 1 枚あたりの消費の想定 | 理想量 |
| 7 | `src/logic/scoringV2/boundary.ts:173` | 数値かどうかの検証だけ | —（値は使わない） |
| — | 3-4F（#213 案）`requiredStockUnits` | 在庫 ≥ `minCount` で「作れる」 | 完成に必要な最低量 |
| — | 3-4C（#214 D-4）`k` | `10 × max(minCount)` の**固定値** | 3-4C 移行時点で固定済み。以後は `minCount` を読まない |

- 理想量のもう 1 つの出どころ: Reference Pizza の `pieceGroups[].positions.length`（Scoring 2.0 の Pieces と `PizzaVisualPieces` の「○○3個」の表示）。**15 recipe の全 scatter 具材で `minCount` と一致する（ずれ 0 件）。** シミュレーションで確認した（`sim-raw.json` の `recipes[].minCountDrift` はすべて空）。
- この一致は `src/data/playerReference.test.ts:40`（`positions` の長さ = `minCount`）で固定されている。

### 1.2 データの持ち方の案

| 案 | 内容 | 変更の範囲 | 評価 |
|---|---|---|---|
| **DS-A（推奨）** | `minCount` は**理想量**のまま。完成に必要な最低量は `completionGate.ts` の関数 `completionMinimum(req, policy)` で決める（G1 なら 1、LR-A の注文 policy なら `minCount`） | `completionGate.ts` と、それを呼ぶ 3 箇所に policy を渡すだけ。#1 以外の 6 箇所は変更なし | 変更が最小。理想量の SSOT が 1 つのまま |
| DS-B | `minCount` の意味を「最低量」に変え、`idealCount` を新しく足す | 7 箇所すべて。15 recipe のデータ | #3〜#6 が `minCount` を読み続けると、Starter Grant が減り、効率の閾値が短くなり、お手本の表示が 1 個になる。静かに壊れる |
| DS-C | 理想量は Reference の `positions.length` だけから取り、`minCount` は最低量にする | DS-B と同じ。さらに Reference のない recipe の扱いが要る | DS-B と同じリスク。Reference のない recipe（今は 0 件）で理想量がなくなる |
| DS-D | recipe ごとに `completionMinCount` を足す（G3 を採る場合だけ必要） | 15 recipe × 約 40 行 | G3 を採らなければ不要 |

- 「実際に使った量」は今も `countUsedIngredient`（`scoring.ts`）が唯一の読み方。変えない。消費（M4）も実際に置いた個数のまま（#214 D-2）。

---

## 2. FAILED の境界

### 2.1 比較（single-group の 206 ケース。1 つの具材の個数だけを 0〜理想+2 で変え、他はお手本どおり。配置は最良）

| 案 | ルール | 理想 3 に 2 個 | 3 に 1 個 | 4 に 1 個 | 2 に 1 個 | 0 個 | 新しいデータ | 評価 |
|---|---|---|---|---|---|---|---|---|
| G0（今） | 個数 ≥ 理想 | FAILED | FAILED | FAILED | FAILED | FAILED | — | owner の方向と合わない |
| **G1（推奨）** | 個数 ≥ 1 | PASS | PASS | PASS | PASS | FAILED | なし | 最も単純。「入っていればピザ、量はスコア」 |
| G2 | 個数 ≥ ceil(理想 × 50%) | PASS | FAILED | FAILED | PASS | FAILED | なし | 「4 に 2 個は OK、1 個はダメ」をプレイヤーに説明しにくい。理想 1 の具材では G1 と同じ |
| G2b | 個数 ≥ ceil(理想 × 2/3) | PASS | FAILED | FAILED | FAILED | FAILED | なし | 「2 に 1 個」が FAILED になり、owner の方向（少なくても完成）とずれる範囲が広い |
| G3 | 具材ごとに authored の最低量 | 決め方次第 | 〃 | 〃 | 〃 | FAILED | 約 40 行（DS-D） | authoring と review の手間。ずれの温床。今の根拠データがない |
| G4 | 「recipe として成り立つか」（主役の具材は理想の半分以上、脇役は 1 以上など） | PASS | 主役なら FAILED | 主役なら FAILED | — | FAILED | recipe ごとに `role` の field | 意味としては最も正しいが、「主役」を 15 recipe 分決める product 判断と新しいデータが要る |

matrix の `singleGroupStarDistribution`（Q = 推奨の Scoring と組み合わせた場合）:

| 区分（件数） | G0 | **G1** | G2 | G2b |
|---|---|---|---|---|
| 0 個（40） | FAILED 40 | FAILED 40 | FAILED 40 | FAILED 40 |
| 不足、残り ≥ 2/3（12） | FAILED 12 | ★4 12 | ★4 12 | ★4 12 |
| 不足、残り ≥ 1/2（22） | FAILED 22 | ★3 22 | ★3 22 | FAILED 22 |
| 不足、残り < 1/2（12） | FAILED 12 | ★3 12 | FAILED 12 | FAILED 12 |

### 2.2 推奨の理由（G1）

- **discovery と一致する。** matcher（`logic/discovery/matcher.ts`）は具材の**種類の集合**で recipe を決める。量は Completion Gate しか見ていない。G1 なら「種類がそろえば、その recipe の pizza」と一本化できる。
- **Scoring と二重にならない。** Recipe の要素（重み 12）は「種類があるか」。G1 は「種類がない = そもそもその pizza ではない」を FAILED にするだけで、量の評価は Scoring に任せられる。
- **今の文言がそのまま使える。** 0 個は `MISSING_REQUIRED_INGREDIENT`「○○が入っていません」。`INSUFFICIENT_REQUIRED_AMOUNT` は G1 では recipe mode で起きなくなる（LR-A の注文 policy でだけ残る。§8）。
- **新しいデータが要らない**（DS-A と組み合わせて `completionMinimum = 1`）。
- **「1 個だけ」は Scoring が抑える。** 理想 3 に 1 個は ★3（Q）か ★2（S4）。報酬は 80 か 50 Pitz。「ほとんどのせないで ★5」は起きない（§3）。
- G4 の「主役の具材」という考え方は魅力があるが、今それを決めると recipe の意味に関する product 判断を先取りすることになる。G1 で出して、Human Replay で「1 個で完成は変だ」となったときに、G4 か G2 を足す（G1 から厳しくする変更は、データを足すだけで済む）。

---

## 3. 不足・過剰の Scoring 2.0

### 3.1 今の不足の減点が軽い理由（production のコードで確認）

`scorePieceGroup`（`logic/referenceMatching.ts:122`）と `scorePieceGroupV2`（`scoringV2/piecesComponent.ts`）:

- 数の類似度 `q = 1 − |c − n| / (n + 1)`（0 個なら 0）
- 配置の類似度 = **マッチした組み合わせの平均**。組み合わせの数は `min(c, n)` なので、不足のときは置いた駒だけの平均になる。**置かなかったお手本の位置は減点されない**
- group のスコア = `q × 30 + 配置 × 70 × gate`。gate は過剰のときだけ `q`、不足のときは 1
- Pieces = group の平均。total への重みは 16

したがって、具材 1 種類で Δ 個不足すると、total の減点は **`4.8 × Δ / ((n + 1) × G)`**（G = piece group の数）。
funghi（n = 3、G = 2）で Δ = 1 なら 0.6。これは PR #214 Rev.2 の実測と一致する。
過剰は `16 × Δ / ((n + 1) × G)`（配置も gate されるので、不足の約 3.3 倍）。

0 個でも減点は `16/G + 12/T`（T = 必要な種類の数）しかない。
funghi は 8 + 4 = 12 で 87.5 点（★4）。capricciosa（G = 5、T = 6）は 5.2 で 94.3 点（**★5**）。

### 3.2 候補の比較（全 206 ケース、matrix `singleGroupStarDistribution`。すべて G1 の場合）

| Model | 内容 | 不足 ≥ 2/3 | 不足 ≥ 1/2 | 不足 < 1/2 | 過剰 +1 | 過剰 +2 以上 |
|---|---|---|---|---|---|---|
| S0（今のまま G1 だけ） | — | ★5 12 | ★5 22 | ★5 12 | ★5 40 | ★5 40 |
| S1 | 不足時、配置 × c/n | ★5 12 | ★5 22 | ★5 11 / ★4 1 | ★5 40 | ★5 40 |
| S2 | S1 + 不足の数の曲線を `1 − Δ/n` に | ★5 12 | ★5 22 | ★5 11 / ★4 1 | ★5 40 | ★5 40 |
| Q（過剰 0） | `total × (1 − 0.5 × 不足率)` | ★4 12 | ★3 22 | ★3 12 | ★5 40 | ★5 40 |
| **Q（過剰 0.15、推奨）** | `total × (1 − 0.5 × 不足率 − 0.15 × min(1, 過剰率))` | ★4 12 | ★3 22 | ★3 12 | ★5 26 / ★4 14 | ★4 40 |
| Q（過剰 0.25） | 同上、過剰 0.25 | ★4 12 | ★3 22 | ★3 12 | ★5 5 / ★4 27 / ★3 8 | ★4 12 / ★3 28 |
| S4（★ の上限の帯） | 不足率で total の上限: 残り < 1 → 89.9、< 2/3 → 74.9、< 1/2 → 59.9 | ★4 12 | ★3 22 | ★2 12 | ★5 40 | ★5 40 |

- 不足率 = `max(n − c) / n`、過剰率 = `max(c − n) / n`。いずれも最も差が大きい具材（worst-group）で見る。
- すべてのケースで理想のときの total は 99.5。

**推奨: Q（不足 0.5、過剰 0.15）を新しい Scoring 2.0 の要素（`quantity`）として足す。** 理由:

- S1/S2 は量の軸が Pieces の重み 16/G の中に閉じているので、★が動かない（上の表）。重みそのものを変える（例: Pieces 16 → 40）と Sauce と Bake の重みも動き、Scoring 2.0 全体の再調整になる。これは #215 の範囲を超える。
- Q は total に掛けるので、recipe の group の数 G や種類の数 T に左右されない。「理想 3 に 2 個」は、どの recipe でも同じ ★4。
- S4（上限の帯）は結果が Q とほぼ同じだが、帯の中で差がなくなる（1/3 は配置が良くても悪くても 59.9）。Q は配置の良さが total に残る。
- **Pitz と ★ が一致する。** Pitz の倍率は total の帯（90/75/60/40）を使う（`pitzReward.ts`）。★ の上限だけを動かす方式（`capStarsForBake` と同じ形）だと、★4 なのに 1.2 倍の Pitz、というずれが出る。Q と S4 は total 自体を下げるので、このずれは出ない。
- 過剰の 0.15 は、「1 個多いのは ★5 のまま（26/40）か、ぎりぎり ★4、2 個以上多いと必ず ★4」になる値。過剰は M4 で在庫を多く使うので、それ自体が経済的な罰になる。0.25 にすると「1 個多いだけで ★3」が出るので、強すぎる（OD-3）。
- Q を入れたら、Pieces の中の数の類似度（30%）は二重になる。影響は小さい（−0.6〜−1.4）ので、今回は残す。消すかどうかは実装の時に調整する。
- `SCORING_V2_RULESET_VERSION` を `phase-4a-2-shadow-3` から bump する（Dex BEST は grandfather。§5.4）。

### 3.3 ★ の閾値（90/75/60/40）への影響

- **閾値は変えない。** Q は「理想どおりなら 99.5 → ★5」を保ち、不足の分だけ total を下げる。
- 理想 3 → 2 個が 82〜83 点（★4 の中ほど）、1 個が 65 点前後（★3）、理想 4 → 3 個が 86.7（★4）、2 個が 73.9（★3 の上限の近く）。閾値のすぐ上や下に固まっていない。

---

## 4. ★5/4/3/2/1 の分布への影響

「理想量どおり」以外は 1 つの具材だけを変えたときの分布（206 ケース、G1。配置と sauce と bake は最良）:

| | ★5 | ★4 | ★3 | ★2 | ★1 | FAILED |
|---|---|---|---|---|---|---|
| 今（G0 + S0） | 120 | 0 | 0 | 0 | 0 | 86 |
| G1 + S0（FAILED を外すだけ） | 166 | 0 | 0 | 0 | 0 | 40 |
| **G1 + Q（0.15）** | 66 | 66 | 34 | 0 | 0 | 40 |
| G1 + S4 | 120 | 12 | 22 | 12 | 0 | 40 |

pizza 全体で量を変えたとき（matrix `wholePizzaStrategies`。scatter 具材をすべて −1 個、すべて半分、すべて 1 個）:

| Recipe | 理想 | すべて −1 | すべて半分 | すべて 1 個 |
|---|---|---|---|---|
| funghi（今） | ★5 | FAILED | FAILED | FAILED |
| funghi（G1 + S0） | ★5 | ★5 | ★5 | ★5 |
| funghi（**G1 + Q**） | ★5 | ★3（mozzarella 2→1 が worst-group） | ★3 | ★3 |
| fugazza（G1 + Q） | ★5 | ★4 86.7 | ★3 73.9 | ★3 61.3 |
| quattro-formaggi（G1 + Q） | ★5 | ★3 73.5 | ★3 | ★3 |

- 注: 「すべて −1」で ★3 になる recipe があるのは、理想 2 の具材（mozzarella 2 など）が 1 個になり、不足率 1/2 が worst-group になるため。
- 実際のプレイでは sauce、配置、焼き加減でさらに下がる。したがって、少なく載せた pizza が ★1〜★2 になることも普通にある。
- この分布は「最良の配置」の上限。★5 は「理想量どおりにのせたときだけ」になる（Q と S4 の両方）。

---

## 5. Free Cooking の discovery への影響

### 5.1 今の経路

1. `freeCook.ts` の `resolveFreeCookPizza` で次の順に判定する。
   - recipe によらない完成判定（何か 1 つ以上ある、焼き加減が generic の範囲内）
   - matcher（種類の集合）
   - **その recipe の Completion Gate**
2. 3 つ目の Completion Gate で FAILED なら `INCOMPLETE_MATCH`（オリジナルピザ + 「図鑑のピザまであと少し…！材料の数や焼き加減を変えてみよう。」）。
3. recipe mode での「別の recipe の発見」（`discoveryRegistration.ts`）も同じ Completion Gate を使う。

### 5.2 推奨: 少ない量でも discovery にする（D-A）

- Free Cooking ではお手本が出ないので、**プレイヤーは理想量を知らない**。今の `INCOMPLETE_MATCH` の大部分は「隠れた個数の条件」で落ちている（`gameReducer.freeCook.test.ts:192` は「basil が足りない margherita」を near miss の代表例にしている）。種類をそろえたのに発見にならないのは、discovery の遊びとして不公平。
- G1 + Q なら「1 個ずつでも発見」になる。ただし BEST は ★3 程度で記録される。図鑑で理想量が見えるようになった後で、★5 を取り直す遊びが自然に生まれる。
- `INCOMPLETE_MATCH` は、recipe の焼き加減の範囲（generic より狭い）と sauce 量の失敗では残る。**文言は「材料の数や焼き加減」から「ソースや焼き加減」に変える**（§8）。
- 案 D-B（Free Cooking の discovery だけ理想量を求める）は、「種類はそろえたのに発見にならない」問題をそのまま残す。これを採るなら、hint か near miss の文言で個数を示す必要がある。

### 5.3 Progression 2.0 への影響（記録だけ。決定はしない）

- ⭐ の式（`Σ max(2, BEST)`、#209/#214 D-1）は変えない。discovery はどちらの案でも ⭐2 の下限を入れる。
- **G1 + S0 だと、1 個ずつの pizza でも BEST ★5 = ⭐5 になり、⭐ が膨らむ。** gate の到達が早まる。G1 + Q なら少ない量の BEST は ★3〜★4 までなので、膨らまない。
- 「発見が 1 個ずつでよくなると gate の到達が早まるか」は、⭐ の下限が discovery 自体で入るので、今と変わらない（発見の数は種類の集合で決まる）。

### 5.4 既存の Dex BEST

- 今までの BEST はすべて「理想量以上」の pizza（不足は FAILED だったので）。Q の過剰の罰を入れると、昔の過剰 pizza の BEST は新しいルールより高いことがある。**BEST は再計算しない（grandfather）。** BEST は最高記録なので下げない、という今の設計（#214 D-1 の前提）と同じ。

---

## 6. M4 在庫への影響

前提: 消費は実際に置いた個数（#214 D-2）。購入は `10 × k` 個（D-4。1 個あたりの単価 = 価格 / 10k）。比較として、今の EP3 補充（単価 = 価格 / `restockQuantity`）も出す。

pizza 1 枚の Pitz の損益（報酬 − 使った具材の単価の合計。matrix `underfillDominance`、45 の「少なく載せる」ケース）:

| Model | 少なく載せる方が得（D-4 単価） | 少なく載せる方が得（EP3 単価） |
|---|---|---|
| 今（G0） | 0 / 45（FAILED） | 0 / 45 |
| G1 + S0 | **39 / 45** | **39 / 45** |
| **G1 + Q（0.15）** | **0 / 45** | 5 / 45 |
| G1 + S4 | 0 / 45 | 3 / 45 |

- **G1 + S0 は経済を壊す。** 1 個ずつにすると、在庫の節約分がそのまま利益になる（funghi: 理想 +105、1 個ずつ +115）。
- **G1 + Q は D-4 の単価で壊れない。** 1 段階 ★ が下がると 20 Pitz 減るが、節約できるのは 1 個あたり 1.8〜14 Pitz（多くは 3〜5。ham 14、egg 10.5 が最大）。
- EP3 の単価で得になる 5 件は quattro-formaggi（3 件）、fugazza、tonno-e-cipolla。
  - もともと理想どおりでも利益が小さい recipe（quattro-formaggi は +8.3、meat-lovers は +0.3）。今の EP3 の価格の問題で、#215 の問題ではない。
  - 3-4C（D-4）の後は 0 件になる。**#215 の実装は 3-4C の後**なので、この 5 件は実際には起きない。
- **authority の economy simulation（`economySimulation.ts`、#196）は壊れない。** 1 枚 = `minCount` 個の消費を仮定しているので、少なく載せるプレイヤーには「下限」になる（在庫はより長くもつ）。DS-A なので simulation のコードは変えない。
- **Stock Gate（EP3）の soft-lock が recipe mode で消える。** 在庫が理想量に足りなくても（例: mushroom 2 < 3）、1 個以上あれば ★4 で完成できる。#213 の B2（「必ず FAILED になり、しかも在庫を浪費する」）は recipe mode では起きなくなる（Lunch Rush は §7）。

---

## 7. Lunch Rush / Issue #212・PR #213 との seam

### 7.1 今の Lunch Rush の点数

- 注文ごとに作る。PASS なら `100 + quality`、FAILED は 0（ただし時間は使う）。180 秒。
- ranking の submit も同じ式。`completionStatus` は client が送り、server はその値を信じて再計算する（`shared/lunchRushScoring.ts`）。
- `LUNCH_RUSH_RULESET_VERSION = "lunch-rush-v1"` のコメントには、「Completion Gate の Mission への適用が意味のある形で変わるときは bump する」と書かれている。

### 7.2 G1 を Lunch Rush にもそのまま使うと（Rev.3: 完了した提供だけを数える）

**Rev.3 のモデル**（matrix `lunchRushDiscrete.rule`。**モデルであり実測ではない**）:

- 1 枚にかかる時間 T = 25 秒 + 1 個あたりの秒数 × (駒の数 + sauce の数)。`efficiency.ts` の authored の定数を、唯一の時間の代わりに使った。
- **提供は整数でしか数えない。** production では `SERVE` は `now < endsAt` のときだけ記録される。
  - `src/mission/lunchRush.ts` の `isMissionExpired` は `now >= endsAt`。`App.tsx` の `handleMissionServeNext` も同じ判定をしている。
  - 締め切りの時点で作りかけの pizza は点にならない。
  - 続けて作ると k 枚目は k × T 秒に出るので、完了した提供の数は `k × T < 180 秒`（厳密に未満）を満たす k の数 = `(180000 − 1) // T_ms`。
- **1 run の点数は整数に丸める（Rev.5）。** production は `Math.round(served × 100 + Σquality)`（`missionScoring.ts` の `missionScore`、`shared/lunchRushScoring.ts`）。0.5 は切り上げ。
  - 比べるのは丸めた整数どうし。少なく載せた run が理想に勝つのは、丸める前の点数が「理想の整数 + 0.5」以上のとき。
  - 注文の流れでは、run ごとに丸めてから平均する。
- Rev.2 までは「点/秒 × 180」を使っていたので、**端数の pizza にも点を与えていた。** これは production の挙動と違うので、すべて計算し直した（Codex review P2）。

1 個 3 秒のモデル、45 ケース（matrix `wholePizzaStrategies` の `lrCompletedServes`、`underfillDominance`）:

| Model | 少なく載せる方が得（1 run の点数） | 例: funghi 理想（43 秒・4 枚） → すべて 1 個（34 秒・5 枚） |
|---|---|---|
| 今（G0） | 0 | 798 → 0（FAILED） |
| G1 + S0 | **31** | 798 → 988 |
| G1 + Q（0.15） | **31** | 798 → 825 |
| G1 + S4 | **31** | 798 → 800 |

- 整数にしたことで、得になるケースは Rev.2 の 39〜45 から、どの Model でも 31 になった。得か損かは主に「完了する枚数が 1 枚増えるか」で決まり、品質の式はほとんど効かない。
- 回帰の例（matrix `lunchRushDiscrete.regressionChecks`。tool の中で assert している）:
  - 1 個 6 秒: Margherita の理想は 61 秒で 2 枚 → **399 点**。すべて 1 個は 43 秒で 4 枚 → **品質 0 でも 400 点**。
  - 45 秒の pizza は 3 枚（4 枚目はちょうど 180 秒に出るので数えない）。

### 7.3 品質の式だけで守るのに必要な係数（Rev.3 で再計算）

不足の係数 `a` は、最も大きい不足率に掛ける値（`quality = max(0, total × (1 − a × 不足率))`）。
少なく載せた pizza が理想の点数を**上回らない**ための最小の `a` を、2 つのモデルで求めた。

1. **同じ recipe が続く run**（1 recipe だけの run）。#213 で「作れる recipe が 1 つだけ」のとき、repeat avoidance は同じ recipe に戻るので、実際に起きうる。
2. **注文の流れ**（production の注文の選び方: 15 recipe すべて発見済み、直前と同じ recipe を避けて一様に選ぶ `getNextOrder`/`avoidRepeat`）。2000 run、seed 固定。すべての案に同じ注文の順番を使う。

**(1) 同じ recipe が続く run**（matrix `lunchRushDiscrete.perRecipeRepeated`）:

| 1 個あたりの秒数（仮定） | 必要な `a` | 制約になるケース | 品質 0 の少ない pizza が理想に勝つケース |
|---|---|---|---|
| 1.5 秒 | 0.97 | pizza-bianca のすべて −1（理想 5 枚 → 6 枚） | 0 / 45 |
| 2 秒 | 1.59 | fugazza のすべて −1（4 枚 → 5 枚） | 0 / 45 |
| 2.5 秒 | 1.19 | tonno-e-cipolla のすべて 1 個（3 枚 → 5 枚） | 0 / 45 |
| 3 秒 | 1.18 | pizza-bianca のすべて −1（4 枚 → 5 枚） | 0 / 45 |
| 4 秒 | 1.49 | bismarck のすべて −1（3 枚 → 4 枚） | 0 / 45 |
| 6 秒 | **どの係数でも防げない** | — | **7 / 45**（margherita、marinara、genovese、funghi、fugazza、salsiccia、pepperoni のすべて 1 個） |

- 0.5〜6.0 秒の 0.1 秒刻みの格子（`gridPerRecipeRepeated`）では、品質 0 の少ない pizza が勝つのは 3.9 秒（3/45）、4.4〜5.8 秒（1/45）、5.9〜6.0 秒（7/45）。
- **Rev.2 の「品質 0 の少ない pizza は 1.5〜6 秒のどの仮定でも勝たない」は誤り**（連続値のモデルでだけ成り立っていた）。完了した枚数で数えると、1 枚増えるだけで品質 0 でも逆転する。

**(2) 注文の流れ**（matrix `lunchRushDiscrete.orderStream`）:

| 1 個あたりの秒数（仮定） | 理想の平均（枚 / 点） | 必要な `a` | 品質 0 の少ない pizza の平均点（最も高い案） | 品質 0 で勝つか |
|---|---|---|---|---|
| 1.5 秒 | 4.83 / 964.5 | 0.18 | 517.5 | 負ける |
| 2 秒 | 4.02 / 801.5 | 0.84 | 500.0 | 負ける |
| 2.5 秒 | 3.95 / 788.8 | 0.59 | 490.5 | 負ける |
| 3 秒 | 3.44 / 686.6 | 0.74 | 455.4 | 負ける |
| 4 秒 | 3.00 / 598.4 | 0.91 | 398.6 | 負ける |
| 6 秒 | 2.13 / 425.9 | 1.24 | 332.6 | 負ける |

- 注文の流れでは、品質 0 の少ない pizza は平均で理想に勝たない（格子のすべての点で）。recipe ごとの枚数の差が平均でならされるため。
- ただし必要な `a` は、秒数に対して**単調ではない**（1.5 秒 0.18 → 2 秒 0.84 → 2.5 秒 0.59 → 3 秒 0.74）。完了する枚数が整数で切り替わるため。

**recipe mode との両立**（matrix `lunchRushDiscrete.compatibleSecondsPerItem`）:

- recipe mode の設計意図「残り 2/3 以上の不足は ★4」を、最良の配置で保てる `a` の上限は **0.711**（pizza-bianca の rosemary 2/3。Lunch Rush の時間には関係しない）。
- 1 本の係数（≤ 0.711）で Lunch Rush も守れる 1 個あたりの秒数（0.1 秒刻み）:
  - 同じ recipe が続く run: **0.5〜0.8 秒だけ**
  - 注文の流れ: **0.5〜1.7 秒と 2.3〜2.9 秒**（1.8〜2.2 秒と 3.0 秒以上は両立しない）
- **Rev.2 の「約 1.94 秒未満なら両立」という境界は消えた。** 両立する範囲は連続しておらず、どのモデルを採るかでも大きく変わる。

> **訂正の履歴:**
> - Rev.1: 「4 秒以上では品質 0 でも得」→ 誤り（`a` は不足率に掛ける値）。Rev.2 で訂正。
> - Rev.2: 「品質 0 の少ない pizza はどの仮定でも勝たない」「約 1.94 秒未満なら 1 本の係数で両立」→ どちらも端数の提供に点を与える連続値のモデルによるもので、誤り。Rev.3 で、完了した提供だけを数えるモデルに置き換えた（Codex review P2）。

### 7.4 Lunch Rush の案

| 案 | 内容 | ranking の ruleset | Cloud Function | #213 の seam（`requiredStockUnits`） | UX |
|---|---|---|---|---|---|
| **LR-A（推奨）** | Lunch Rush は「注文」の policy。完成に理想量が要る（今の gate のまま）。recipe mode と Free Cooking だけ G1 | **変えない**（v1 のまま、過去のスコアと比べられる） | 変えない | **変えない**（= `minCount` = 理想量。#214 D-2 の文言「在庫 ≥ 完成に必要な最低量」がそのまま成り立つ） | Lunch Rush だけ「注文の数に足りません」で失敗する。文言で「注文」を強調する |
| LR-C | gate は G1 で統一。提供の基本点を `100 × 残りの割合` にする | v2 に bump | serve record に量の情報が要る。function を変えて deploy | 1 に変える（pool が広がる） | 一貫している。ranking の過去スコアとは比べられない |
| LR-D | gate は G1 で統一。得になることを受け入れる（Lunch Rush は速さのゲーム） | v2 に bump（適用が変わるので） | 変えない | 1 に変える | 1 個 3 秒のモデルで、少なく載せる方が 45 中 31 で得。**推奨しない** |
| LR-E（Rev.2 で追加、Rev.3 で**非推奨**に変更） | gate は G1 で統一。不足の係数を上げて、recipe mode と Lunch Rush で同じ式にする | v2 に bump | 変えない | 1 に変える | recipe mode の ★4（係数 ≤ 0.711）と両立するのは、狭く連続しない秒数の範囲だけ（§7.3）。同じ recipe が続く run では、品質 0 の少ない pizza が勝つ秒数があり（3.9 秒、4.4〜6.0 秒）、**どの係数でも防げない** |

LR-C の数値の例（quattro-formaggi のすべて −1、1 個 3 秒）:

- 少なく載せた場合: 40 秒で 4 枚。1 枚は提供の点 50 + quality 73.5 = 123.5 → 494 点。
- 理想: 52 秒で 3 枚 → 598.5 → 599 点（1 run の点数は整数に丸める）。
- この例では LR-C で防げる。ただし LR-C は全ケースを格子では検証していない。ranking と function の変更も要り、#215 の範囲を広げる。

**LR-A の推奨の再評価（Rev.3）:**

- Rev.3 の正しい根拠（完了した提供だけを数える）:
  1. recipe mode 用の係数 0.5 では、1 個 3 秒のモデルで、少なく載せる方が 45 中 31 で得になる（§7.2）。
  2. 品質の係数で両立するのは、狭く連続しない秒数の範囲だけ。範囲はモデルによっても変わる（§7.3）。
  3. 同じ recipe が続く run（#213 の「作れる recipe が 1 つだけ」で実際に起きうる）では、品質 0 でも少なく載せる方が勝つ秒数がある。これは**品質の係数では防げない**。防げるのは gate（LR-A）か、提供の点そのものを変える案（LR-C）だけ。
  4. LR-A は、1 個の時間がどうであっても、ranking の ruleset、Cloud Function、#213 の seam を変えずに済む。
- **判定: LR-A の推奨を維持する。Rev.2 で下げた強さは元に戻す。**
  - Rev.2 では、「約 1.94 秒未満なら LR-E で両立できる」ことを条件つきの代案にしていた。その前提が消えたので、LR-E は非推奨にした。
  - 統一した gate を選ぶなら、代案は LR-C（提供の点を量で割り引く）になる。
- HR-8（実機の 1 個あたりの時間）は、LR-A と LR-E を選ぶための材料ではなくなった。代わりに、Lunch Rush のモデルの前提（T = 25 + 秒 × 個数）が妥当かを確かめるために残す。

### 7.5 #213 の seam の確認

- #213 の設計は、単位の差を `requiredStockUnits(ingredient, requirement)` 1 箇所に閉じ込めている（#213 §2、§8、§12）。今の実装案の値は scatter なら `req.minCount`、spread なら 1。
- **LR-A: 値は変えない。** #215 の実装で #213 のコードに触れる必要はない。
- **LR-C / LR-D: `requiredStockUnits` の中身を `completionMinimum(req, policy)`（= 1）に差し替えるだけ。** #214 D-3 の「#215 で最低量が変わったら、`requiredStockUnits` の値だけを差し替える」がそのまま成り立つことを確認した。pool は広がる（在庫 1 個でも「作れる」）。#213 の U-1/U-2 の期待値（「在庫 < minCount なら false」）は書き直しが要る。
- どちらの案でも、Lunch Rush の B2（在庫が理想に足りない）の扱いは Lunch Rush の policy に合わせて一貫する（LR-A では「作れない」、LR-C/D では「作れる」）。

### 7.6 Ranking（submit）への影響

- LR-A: なし。
- LR-C / LR-D: `LUNCH_RUSH_RULESET_VERSION` の bump、functions の deploy（production deploy の手順が要る）、週間 ranking の区切り。**owner の判断が要る**（OD-4）。

---

## 8. Result / hint / completion message への影響

| 場所 | 今 | G1 + Q + LR-A での変更案 |
|---|---|---|
| `completionMessages.ts` `MISSING_REQUIRED_INGREDIENT` | 「○○が入っていません」 | 変更なし |
| 〃 `INSUFFICIENT_REQUIRED_AMOUNT` | 「○○が足りませんでした」 | Lunch Rush（注文 policy）でだけ出る。「注文の○○の数が足りません」に変える案（注文であることを明示） |
| `hints.ts` の missing / ready | `count < minCount` なら「○○をのせてみよう！」 | 条件は変えない（`minCount` = 理想量なので、理想まで案内する）。**変更なし** |
| Result（PASS で不足があるとき） | —（今は FAILED なので出ない） | **新しい 1 行**: 「マッシュルームがお手本より少なめ（2/3）」。Scoring 2.0 の新しい `quantity` の要素から作る。★ の横に理由が見えるようにする（Human Feel: 1 つの大きな理由） |
| Result（過剰） | 表示なし（Pieces に埋もれる） | 同じ 1 行の形式で「多め（5/3）」。Q の過剰の罰が 0 でないとき |
| Result の near miss（Free Cooking） | 「材料の数や焼き加減を変えてみよう。」 | 「ソースや焼き加減を変えてみよう。」（G1 では数で落ちなくなるため） |
| `buildPieceCountLabels`（お手本の「○○3個」） | 理想量 | 変更なし（理想量を見せ続ける） |
| Lunch Rush の serve panel（`MissionServePanel`） | FAILED の文言は `buildCompletionFailureMessage` | LR-A なら、上の Lunch Rush 用の文言が出る |

- Result の 1 行と文言の変更は UI/UX の変更なので、**実装フェーズでは `TETO_HUMAN-VERIFICATION-POLICY.md` の対象**になる（390×844 の video、before/after の screenshot）。

---

## 9. テストマトリクス（実装するとき）

### Unit（Vitest）

| ID | 対象 | 内容 |
|---|---|---|
| U-1 | `completionGate` | G1: 0 個は `MISSING_REQUIRED_INGREDIENT`、1 個以上は PASS（各 recipe の各 scatter 具材） |
| U-2 | 〃 | 注文 policy（LR-A）: 今の `INSUFFICIENT_REQUIRED_AMOUNT` の境界がそのまま残る（今の test 3 を policy つきに移す） |
| U-3 | 〃 | sauce と bake の判定は policy に関係なく変わらない（回帰） |
| U-4 | `scoringV2/quantity`（新規） | 不足率と過剰率が worst-group になる。係数の境界。0 個（FAILED 側なので呼ばれないが、total ≥ 0 で落ちない） |
| U-5 | `computeScoringV2` | 理想量で 99.5 のまま（全 15 recipe）。2/3 で ★4、1/3 で ★3、4/3 で ★5 か ★4（matrix の値を golden にする） |
| U-6 | 〃 | `SCORING_V2_RULESET_VERSION` の bump。malformed input の fail-closed（既存の `malformedInput.test.ts` に quantity を追加） |
| U-7 | `pitzReward` | 変更なし。Q で下がった total が正しい帯に入ること（2/3 で 100 Pitz、1/3 で 80） |
| U-8 | `freeCook` / `discoveryRegistration` | 種類がそろえば 1 個ずつでも MATCHED/NEW_DISCOVERY。sauce/bake の失敗は `INCOMPLETE_MATCH` のまま（`gameReducer.freeCook.test.ts:192` の期待値を書き直す） |
| U-9 | `playerReference` / `starterStock` / `efficiency` / `economySimulation` | 変更がないことの回帰（DS-A で `minCount` = 理想量のまま） |
| U-10 | #213 の seam（LR-C/D を採る場合だけ） | `requiredStockUnits` が完成の最低量と一致する |
| U-11 | `lunchRushScoring` | LR-A: 変更なし（ruleset v1）。LR-C: v2 と提供の点 |

### Component（Vitest + RTL）

| ID | 対象 | 内容 |
|---|---|---|
| C-1 | `ResultPanel` | 不足の PASS で「少なめ（2/3）」の 1 行と ★4 が出る。FAILED の card は出ない |
| C-2 | 〃 | 過剰の 1 行（Q の過剰の罰が 0 でない場合） |
| C-3 | 〃（Free Cooking） | near miss の文言が「ソースや焼き加減」になる |
| C-4 | `MissionServePanel` | LR-A: 不足は FAILED で「注文の数」の文言。0 個は今と同じ |
| C-5 | `completionMessages` | 文言の変更の snapshot |

### E2E（Chromium, 390×844 と 360×800）

| ID | 内容 |
|---|---|
| E-1 | funghi を mushroom 2 個で焼く → PASS、★4、Dex に登録、在庫は 2 減る |
| E-2 | 0 個 → FAILED（今の `gestures.ts` の MISSING の helper がそのまま使える） |
| E-3 | Free Cooking で margherita の種類を 1 個ずつ → 発見 |
| E-4 | Lunch Rush（LR-A）で少ない量 → FAILED の serve。ranking の submit の payload が v1 |
| 回帰 | `lunch-rush-result-ranking-phase4.spec.ts`、`free-cooking-phase3-2.spec.ts`、`result-1screen-2.0.spec.ts` は MISSING（0 個）を使っているので、そのまま通るはず |

### WebKit

- #210 の Full WebKit（2 viewport × 2 shard + `WebKit Gate`）を**実装の PR で 1 回だけ**回す。E-1〜E-4 の新しい spec が shard に含まれることを確認する。
- 本 audit（docs/data/tooling-only）では回さない。

---

## 10. Human Replay（実装したときに撮るもの。funghi、mushroom の理想は 3）

| # | シナリオ | 期待（G1 + Q 0.15 + LR-A） | 確認すること |
|---|---|---|---|
| HR-1 | 理想 3 → **3 個** | PASS、99.5 相当（配置次第）、★5、120 Pitz | 今と同じ（回帰） |
| HR-2 | 理想 3 → **2 個** | **PASS**、約 82 点、**★4**、100 Pitz、Result に「マッシュルームがお手本より少なめ（2/3）」、在庫 −2 | 「完成した、でも少ない」が 1 目で分かるか |
| HR-3 | 理想 3 → **1 個** | **PASS**、約 65 点、**★3**、80 Pitz、同じ 1 行（1/3）、在庫 −1 | 「1 個でピザ」に違和感がないか（あれば G2/G4 へ。OD-1） |
| HR-4 | **0 個** | **FAILED**「マッシュルームが入っていません」、報酬なし、Dex なし、在庫は置いたものだけ減る | 今と同じ（回帰） |
| HR-5 | **過剰**（4 個 / 5 個） | 4 個: 約 93 点 ★5 / 5 個: 86 点 ★4。Result に「多め（5/3）」。在庫は置いた数だけ減る | 過剰の罰の強さ（OD-3） |
| HR-6 | Lunch Rush で funghi の注文を 2 個で出す | LR-A: **FAILED**「注文のマッシュルームの数が足りません」、0 点、在庫 −2 | mode の差が理不尽に感じないか（OD-4） |
| HR-7 | Free Cooking で margherita の種類を 1 個ずつ | **発見**、BEST ★3、発見の bonus 50 Pitz | 発見の嬉しさと、★5 を取り直したくなるか（OD-5） |
| HR-8（Rev.2 で追加、Rev.3 で目的を変更） | 390×844 の実機で、具材 1 個をトレイから pizza にのせる時間を測る（例: funghi と quattro-formaggi を理想量で各 3 回。TOPPING の step の `perStepElapsedMs` ÷ 駒の数）。1 枚の合計時間も測る | 1 個あたりの秒数と、1 枚の秒数 | Lunch Rush のモデル（T = 25 + 秒 × 個数）の前提が妥当か。LR-C を選ぶ場合の検証の材料（LR-A の選択には必要ない） |

- 参考のシミュレーション値（配置と sauce と bake は最良）: `idealThreeReplayRows`（matrix）。funghi の mushroom は、3 個 99.5 / 2 個 82.5 / 1 個 65.6 / 0 個 FAILED / 4 個 92.7 / 5 個 86.0。
- 撮影は Human Verification Policy に従う（video はユーザーに直接渡し、repo には commit しない。screenshot は `docs/reports/screenshots/<task-name>/`）。

---

## 11. 実装のスコープ案（Decision Sheet が推奨どおりの場合）

**3-4C の merge の後**に、1 つの PR で行う（#215 の guardrail）。

1. `completionGate.ts`: `completionMinimum(req, policy)` を追加する（`"recipe"` → 1、`"order"` → `minCount`）。`evaluatePizzaCompletion(recipe, pizza, policy = "recipe")`。
2. 呼ぶ側に policy を渡す: `gameReducer.ts` の `CONFIRM_BAKE`（Lunch Rush なら `"order"`）、`freeCook.ts` と `discoveryRegistration.ts`（`"recipe"`）。
3. `scoringV2/quantityComponent.ts`（新規）と `index.ts`: Q を掛ける。`types.ts` に `quantity` を足す（Result の 1 行の元）。ruleset を bump する。
4. `completionMessages.ts`、`ResultPanel.tsx`（1 行と near miss）、Lunch Rush の文言。
5. test（§9）。Human Verification（§10）。
6. 変えないもの: `recipes.ts` の `minCount`、`hints.ts`、`playerReference.ts`、`starterStock.ts`、`efficiency.ts`、`economySimulation.ts`、`pitzReward.ts`、`lunchRushScoring.ts`、#213 の seam（LR-A の場合）。

---

## 12. Go / No-Go

| 項目 | 判定 |
|---|---|
| Fresh Audit | 完了 |
| 設計 | **Go（条件付き）**: Decision Sheet の OD-1〜OD-5 |
| 実装 | **No-Go（今は）**: 3-4C（#205 → #206 → 3-4C）の merge を待つ。`completionGate.ts`、`scoringV2/**`、`recipes.ts` に 3-4C と衝突する変更を入れない |
| #213（3-4F）との順序 | LR-A なら順序は自由（seam の値が変わらない）。LR-C/D なら #215 は 3-4F の後か、同時に seam を差し替える |

---

## 13. Decision Sheet（owner の判断が要る項目だけ）

| ID | 判断 | 選択肢 | 推奨 | 根拠（本書） |
|---|---|---|---|---|
| **OD-1** | FAILED の境界 | G1: 0 個だけ / G2: 理想の 50% 未満 / G3: 具材ごとの最低量 / G4: recipe として成り立つか（主役の具材） | **G1** | §2。discovery、Recipe の要素、文言と一致。データの追加なし。厳しくするのは後からでもできる |
| **OD-2** | 不足の Scoring の方式 | Q: total に量の係数（連続） / S4: 不足率で ★ の上限（段階） / S1・S2: Pieces の中だけ（★が動かないので非推奨） | **Q（不足の係数 0.5）** | §3.2。S1/S2 では 1/3 でも ★5。Q は配置の差が残り、Pitz と ★ が一致する |
| **OD-3** | 過剰の罰の強さ | 0 / **0.15** / 0.25 | **0.15** | §3.2。+1 個で ★5 か ★4、+2 個以上で ★4。0.25 は +1 個で ★3 が出る。過剰は M4 で在庫を多く使うので、それ自体が罰になる |
| **OD-4** | Lunch Rush の扱い | LR-A: 注文どおりの数が要る（今の gate） / LR-C: gate を統一して提供の点を量で割り引く（ranking v2 と function の deploy） / LR-D: 統一して得になることを受け入れる / LR-E: 統一して不足の係数を上げる（Rev.3 で非推奨） | **LR-A** | §7.2〜§7.4（Rev.3: 完了した提供だけを数える）。係数 0.5 では、1 個 3 秒のモデルで少なく載せる方が 45 中 31 で得。1 本の係数（≤ 0.711）で両立する秒数は狭く連続しない。同じ recipe が続く run では、品質 0 でも少なく載せる方が勝つ秒数があり、品質の係数では防げない。LR-A は時間に関係なく、ranking、function、#213 の seam を変えない。統一した gate を選ぶなら、代案は LR-C |
| **OD-5** | Free Cooking の discovery | D-A: 種類がそろえば少ない量でも発見 / D-B: discovery だけ理想量を求める | **D-A** | §5。Free Cooking ではお手本が見えないので、個数の条件は隠れた条件になる。BEST が ★3 程度に抑えられるので ⭐ は膨らまない |

**owner の判断に含めていないもの**（技術的な既定値で決めたもの）:

- データの持ち方 DS-A（§1.2）
- BEST の grandfather（§5.4）
- `SCORING_V2_RULESET_VERSION` の bump
- Pieces の数の類似度の二重は今回は残す
- hint は変えない
- 文言の細部（Human Verification で調整する）

---

## 付録 A. 再現の手順

1. 監査した main（`dff233c`）で `npm ci` を実行する。
2. 次のコマンドで harness を実行する（終わったら `src/` のコピーを削除する）。
   ```
   cp docs/reports/data/ISSUE-215_COMPLETION-GATE_simulation.test.ts.txt src/__issue215_sim.test.ts
   ISSUE215_OUT=$PWD/docs/reports/data/ISSUE-215_COMPLETION-GATE_sim-raw.json npx vitest run src/__issue215_sim.test.ts
   rm src/__issue215_sim.test.ts
   ```
3. `python3 tools/issue215_completion_gate_audit.py`（`--check` で、commit 済みの matrix が最新かを確認する）。

- harness は production の `evaluatePizzaCompletion`、`computeScoringV2`、`toLegacyScoreBreakdown`、`scorePieceGroup`、`calculatePitzReward`、`buildIdealSauceFixture`、`getReferencePizza` だけを呼ぶ。S1/S2/Q/S4 は、同じ production の metrics から harness の中で計算した**案**で、production の値ではない。
- 乱数は使わない。2 回実行して、`sim-raw.json` が byte 単位で一致することを確認した。
- Lunch Rush の秒数と、経済の単価（D-4 は `10 × k`、k は matrix の `kPerIngredient`。#214 D-4 の表と一致）はモデルで、実測ではない。

## 付録 B. 実行したもの / していないもの

- 実行した:
  - `npm ci`
  - harness の vitest 1 ファイル（2 回）
  - `python3 tools/issue215_completion_gate_audit.py --check`
  - Rev.2: tooling を変更して matrix を再生成し、`--check` が通ることを確認した。raw の simulation は変えていないので、再実行していない。
  - Rev.3: Lunch Rush を整数のモデル（同じ recipe が続く run、注文の流れ 2000 run、seed 215）に置き換えて matrix を再生成した。`--check` が通ることを確認した。回帰の assert（6 秒の margherita で 399 vs 400、45 秒で 3 枚）は tool の実行ごとに検証される。raw の simulation は変えていない。
  - Rev.4: tool を厳密な有理数の計算に変えて matrix を再生成した。
    - Python 3.10 / 3.11 / 3.12 / 3.13 / 3.14.0rc2 のすべてで `--check` が OK になることを確認した。
    - 3.10、3.12、3.13 でそれぞれ再生成し、byte 単位で一致することを確認した。
    - 回帰の assert は維持している。
  - Rev.5: 1 run の点数に production の `Math.round` を適用して matrix を再生成した。
    - Python 3.10 / 3.11 / 3.12 / 3.13 で再生成し、byte 単位で一致することを確認した。3.14.0rc2（uv）でも `--check` が OK。
    - 丸めの回帰（pizza-bianca 1.5 秒: 997.5 → 998、`a` 0.973。0.6 秒: 0.653。注文の流れ 1.5 秒: run ごとに丸めた平均 964.5 ≠ 丸めない平均 964.1）を assert している。
    - raw の simulation は変えていない。
- 実行していない:
  - Full unit suite
  - E2E
  - Chromium/WebKit（docs/data/tooling-only のため）
