# Completion Gate / partial quantity — Owner Decision Sheet と実装 Phase 計画（Issue #215 の次工程準備）

- 作成: 2026-09-24
- 種別: **docs-only（設計・計画のみ）**。`src/**`、`e2e/**`、`.github/**`、`functions/**` は変更していない。
- 基準:
  - `origin/main` = **`dff233c042d2df6ee1c3a92f2d2419830aa05460`**（作業開始時に GitHub の最新と一致を確認）
  - PR #218 head = **`5105771d37577ad353e869ea35295a4ea18bbce9`**（Fresh Audit Rev.5。読むだけ。変更していない）
- 入力: `docs/reports/TETO_COMPLETION-GATE_PARTIAL-QUANTITY_Fresh-Audit.md` と matrix（PR #218 のブランチ上。main には未 merge）

> ## ⚠ 状態: PR #218 は **OPEN — Fresh Review PASS 待ち**
>
> - 本書は #218 の結論を **PASS 扱いにしていない**。#218 の数値（★、Pitz、Lunch Rush の損益）は、Fresh Review で訂正されうる入力として引用している。
> - #218 の Fresh Review が FAIL / 訂正になった場合、本書の §1 の例と §3 の Phase 計画は、訂正後の値で読み直す。
> - Owner は、#218 の Fresh Review PASS の**後で** §1 の OD-1〜OD-5（と本書で追加した OD-4b）を選ぶ。

---

## 0. 要約

1. **Owner が決めること**は OD-1〜OD-5 に加えて、本書の Fresh Audit で見つけた **OD-4b**（量の係数 Q を Lunch Rush の品質点にも掛けるか）の 6 つ。
2. OD-4b が要る理由（**#218 の「LR-A なら ranking は変わらない」に対する補足**）:
   - `computeScoringV2` は FREE と Lunch Rush で共通の 1 か所から呼ばれる（`gameReducer.ts` `CONFIRM_BAKE`）。
   - LR-A でも、**過剰の罰（OD-3）は Lunch Rush の PASS の pizza の `qualityTotal` を下げる**。例: funghi mushroom 5 個で 95.5 → 86.0。
   - ranking の式、ruleset、Cloud Function のコードは変わらない。ただし「同じ置き方で出る点数」は変わる。
3. **Phase 計画は #218 の A〜D から変える。** 主な理由:
   - **B（FAILED 境界）を A（Q）より先に出すと、経済が壊れる。** G1 + S0 では「少なく載せる方が得」が 39/45（#218 §6）。A → B の順は必須。
   - **Lunch Rush の「注文どおり」（LR-A）は、後の Phase D ではなく B と同じ PR に入れる必要がある。** Gate は FREE と Lunch Rush で共通なので、B で G1 にすると Lunch Rush も同時に緩む。
   - Q の計算は、まず **unwired（本番に接続しない）新規ファイル**として出せる（#205 と同じ形）。
4. 実装の開始条件: **#218 Fresh Review PASS → Owner Decision → 3-4C の merge**（#218 §12 の guardrail を維持）。
5. 次に実行する最小タスク: **#218 の Fresh Review を完了させる**（本書は並行作業。§6）。

---

## 1. Owner Decision Sheet（OD-1〜OD-5 + OD-4b）

### 前提と読み方

- 数値は、**配置・ソース・焼き加減が最良のとき**の上限。実際のプレイでは、ここからさらに下がる。
- ★ の閾値は今のまま（90 / 75 / 60 / 40）。Pitz は ★5=120、★4=100、★3=80、★2=50、★1=20。
- **matrix** と書いた値は #218 の matrix（`idealThreeReplayRows`）の値。**概算** と書いた値は、#218 §3.1 の式から本書で再計算した値（matrix との差は ±0.1）。
- 「理想」= お手本の個数（`minCount`）。お手本サムネイルと「○○3個」の表示に出ている数。
- 1 個しか要らない具材（oregano 1、ham 1、egg 1 など）は、どの案でも「0 個 = FAILED、1 個 = 理想」なので、挙動は変わらない。

15 recipe の理想の個数（scatter 具材だけ。`src/data/recipes.ts`）:

| 理想 | 具材の例 |
|---|---|
| 1 | oregano（fugazza、capricciosa、napoletana）、ham、egg、pepperoni（meat-lovers） |
| 2 | mozzarella（多くの recipe）、basil（margherita）、mushroom（capricciosa）、onion（tonno-e-cipolla） |
| 3 | mozzarella（margherita、bismarck）、mushroom（funghi）、garlic、rosemary、sausage、tuna、bacon（breakfast） |
| 4 | onion（fugazza）、pepperoni（pepperoni） |

---

### OD-1 FAILED になる境界

**問い:** 何個まで減らしたら「ピザとして失敗」にするか。

#### プレイヤーが感じること

| 案 | ルール | プレイヤーの感覚 |
|---|---|---|
| **G0（今）** | 理想の数まで置かないと FAILED | 「1 個足りないだけで失敗」。在庫が 2 個しかないと、funghi は作っても必ず失敗する（在庫も消える） |
| **G1** | 0 個のときだけ FAILED | 「入っていればそのピザ。量は点数で評価される」。理由の文言は今の「○○が入っていません」のまま |
| G2 | 理想の半分未満で FAILED | 「半分あれば OK」。ただし理想 4 の 1 個は失敗、理想 2 の 1 個は成功、という差を説明しにくい |
| G4 | 主役の具材だけ半分以上が必要 | 「きのこピザにきのこ 1 個は変」に答えられる。ただし 15 recipe の「主役」を Owner が決める必要がある |

#### 実際に置いたとき（funghi: mushroom 理想 3、mozzarella 理想 2。G1 + OD-2 の Q の場合）

| mushroom を置いた数 | G0（今） | **G1** | G2 |
|---|---|---|---|
| 3 個 | ★5 / 120 Pitz | ★5 / 120 | ★5 / 120 |
| 2 個 | **FAILED**「マッシュルームが足りませんでした」/ 0 Pitz / 在庫 −2 | **★4 / 100 Pitz**（matrix 82.5） | ★4 / 100 |
| 1 個 | **FAILED** / 0 Pitz / 在庫 −1 | **★3 / 80 Pitz**（matrix 65.6） | **FAILED** |
| 0 個 | FAILED「マッシュルームが入っていません」 | FAILED（同じ） | FAILED（同じ） |

pepperoni（理想 4）で G2 を選んだ場合: 2 個 ★3、**1 個 FAILED**。margherita の basil（理想 2）では 1 個 ★3（G1 と同じ）。
→ G2 では「1 個」が recipe によって成功したり失敗したりする。

#### Free Cooking と Lunch Rush の違い

- Free Cooking（recipe mode と自由調理）: 上の表のとおり。
- Lunch Rush: **OD-4 で決まる。** LR-A を選ぶと、Lunch Rush だけは今と同じ G0（注文どおりの数）が残る。

#### Owner の選択肢

| 選択 | 向いている考え方 | 後で変えられるか |
|---|---|---|
| G1 | 「量は点数で評価する。ゲームを止めない」 | G1 → G2/G4 に厳しくするのは、データや判定を足すだけ |
| G2 | 「少なすぎるのはピザではない」を一律の割合で | G2 → G1 に緩めるのは簡単 |
| G4 | 「recipe の意味」を守る | recipe ごとの `role` のデータと、15 recipe 分の Owner 判断が要る |
| G0（据え置き） | 今の厳しさを保つ（#215 はやらない） | — |

#218 の推奨は G1。Human Replay の HR-3（理想 3 に 1 個）で「1 個で完成は変」と感じたら、後から G2/G4 に厳しくできる。

---

### OD-2 不足量の Scoring

**問い:** 足りないとき、点数をどれだけ下げるか。

#### 今の問題（G1 にするだけの場合）

- 今の Scoring 2.0 は、足りない分をほとんど減点しない（置いた駒だけで配置を採点するため）。
- **FAILED を外すだけだと、1 個ずつでも ★5・120 Pitz**。funghi では理想どおり +105 Pitz、1 個ずつ +115 Pitz（在庫の節約分だけ得）。
- だから G1 を選ぶなら、OD-2 は「何もしない」を選べない。

#### 案 Q（中心案）: 最も足りない具材の割合で total を下げる

式（参考）: `total × (1 − 0.5 × 最大の不足率)`。不足率 = (理想 − 置いた数) / 理想。

プレイヤーから見ると:

| 置いた数 | 理想 2 | 理想 3 | 理想 4 |
|---|---|---|---|
| 理想どおり | ★5（99.5） | ★5（99.5） | ★5（99.5） |
| 1 個少ない | **★3**（概算 74.0） | ★4（matrix 82.5） | ★4（概算 86.6） |
| 2 個少ない | —（0 個 = FAILED） | ★3（matrix 65.6） | ★3（概算 73.9） |
| 3 個少ない | — | —（FAILED） | ★3（概算 61.3） |
| **1 個だけ** | ★3 | ★3 | ★3 |

例: margherita basil（理想 2）、funghi mushroom（理想 3）、pepperoni pepperoni（理想 4）。

#### プレイヤーに理解できるか（評価）

- **分かりやすい点:**
  - 「★5 は、お手本どおりの数のときだけ」。
  - 「1 個だけ載せると ★3」は、理想 2〜4 のどの具材でも同じ。
  - 「2/3 なら ★4、半分なら ★3」は割合として一貫している。
  - 配置の良さは点数に残る（★の中で上下する）。
- **分かりにくい点（Owner に知ってほしいこと）:**
  - **「1 個足りない」の結果が recipe で違う。** 理想 2 の basil は ★3、理想 3 の mushroom は ★4。Q は「何個足りないか」ではなく「何割足りないか」で決まるため。
  - 理想 2 の 1 個は **74.0 で ★4（75）の直前**。配置が少し悪いだけで同じ ★3 だが、「あと少しで ★4 だった」とは感じにくい。
  - 複数の具材が足りないとき、見るのは**一番足りない 1 種類だけ**。mozzarella 1/2 と mushroom 2/3 なら、mozzarella の 1/2 で決まる。
  - だから **Result の 1 行（「マッシュルームがお手本より少なめ（2/3）」）が必須**。これがないと、★が下がった理由が見えない（#218 §8）。

#### Owner の選択肢

| 案 | プレイヤーの感覚 | 長所 | 短所 |
|---|---|---|---|
| **Q（係数 0.5）** | 「量が足りない分だけ、なめらかに下がる」 | どの recipe でも割合で同じ。配置の差が残る。★と Pitz が一致する | 「1 個不足」の意味が recipe で違う |
| S4（★の上限の帯） | 「2/3 なら最高 ★4、半分なら最高 ★3、それ未満は最高 ★2」 | ★の上限が明快 | 帯の中で配置の差が消える（1/3 は常に 59.9）。1 個だけで ★2 |
| S1/S2（Pieces の中だけ） | ほとんど変わらない | 変更が小さい | **1/3 でも ★5 のまま**。G1 と組み合わせると経済が壊れる（非推奨） |
| 何もしない | 1 個でも ★5 | — | G1 と組み合わせられない |

※「1 個不足ごとに ★−1」のような**個数ベース**の案は #218 で監査していない。選ぶなら、追加の監査が要る（経済と Lunch Rush の再計算）。

---

### OD-3 置きすぎたときの罰

**問い:** 理想より多く置いたとき、点数をどれだけ下げるか。

前提:
- 置きすぎは、今も Pieces の中で少し減点されている（下の「係数 0」の列）。
- 在庫（M4）は置いた数だけ減るので、置きすぎはそれ自体が経済的な損になる。
- 過剰率は 1 で頭打ち（理想の 2 倍以上は同じ係数）。

#### 具体例（配置は最良。概算。0.15 の funghi は matrix 値）

**funghi mushroom（理想 3）**

| 置いた数 | 係数 0 | 0.10 | **0.15** | 0.25 |
|---|---|---|---|---|
| 3（理想） | ★5 99.5 | ★5 99.5 | ★5 99.5 | ★5 99.5 |
| 4（少し多い: +1） | ★5 97.5 | ★5 94.2 | **★5 92.7** | ★4 89.4 |
| 5（多い: +2） | ★5 95.5 | ★4 89.1 | **★4 86.0** | ★4 79.6 |
| 6（かなり多い: 2 倍） | ★5 93.5 | ★4 84.2 | **★4 79.5** | ★3 70.1 |

**margherita basil（理想 2）**

| 置いた数 | 係数 0 | 0.10 | **0.15** | 0.25 |
|---|---|---|---|---|
| 3（+1） | ★5 96.8 | ★5 92.0 | **★4 89.6** | ★4 84.7 |
| 4（2 倍） | ★5 94.2 | ★4 84.8 | **★4 80.0** | ★3 70.6 |

**pepperoni（理想 4）**

| 置いた数 | 係数 0 | 0.10 | **0.15** | 0.25 |
|---|---|---|---|---|
| 5（+1） | ★5 97.9 | ★5 95.5 | **★5 94.2** | ★5 91.8 |
| 6（+2） | ★5 96.3 | ★5 91.5 | **★4 89.1** | ★4 84.3 |
| 8（2 倍） | ★5 93.1 | ★4 83.8 | **★4 79.1** | ★3 69.8 |

#### プレイヤーが感じること

- **係数 0:** 「多めに置けば安全」。★5 は変わらないので、置きすぎを気にしなくなる。Result に「多め」の 1 行を出しても、点数に効かない。
- **0.15（#218 の推奨）:**
  - 「1 個多い」は、理想 3 以上なら ★5 のまま。**理想 2 では +1 個で ★4**（89.6。★5 の直前）。
  - 「かなり多い（2 倍）」は必ず ★4。
  - 置きすぎより、足りない方が重い（理想 3 で、1 個少ないと 82.5、1 個多いと 92.7）。
- **0.10（本書で比較のために追加。#218 で監査していない）:** +1 個はすべて ★5。+2 個で ★4。
- **0.25:** 理想 3 で +1 個でも ★4。2 倍で ★3。「1 個余分に落としただけで ★が下がる」と感じやすい。

#### Free Cooking と Lunch Rush の違い

- Free Cooking: 上の表のとおり。
- Lunch Rush: **OD-4b で決まる**（Q を Lunch Rush に掛けるなら、過剰の罰は Lunch Rush の品質点と ranking にも効く）。

#### Owner の選択肢

| 係数 | 「少し多い（+1）」 | 「かなり多い（2 倍）」 | 向いている考え方 |
|---|---|---|---|
| 0 | ★5 | ★5 | 置きすぎは在庫の損だけで十分 |
| 0.10 | ★5 | ★4 | 少しは許す。理想 2 の +1 も ★5（※#218 未監査） |
| **0.15** | 理想 3〜4 は ★5、**理想 2 は ★4** | ★4 | #218 の推奨。お手本どおりを強めに促す |
| 0.25 | ★4 が出る | ★3 が出る | お手本どおりを強く求める |

---

### OD-4 Lunch Rush

**問い:** Lunch Rush でも、少ない量での提供を認めるか。

#### 今の Lunch Rush の点数

- 1 run = 180 秒。1 枚の点数 = **100（提供した）+ 品質（0〜100）**。FAILED は 0 点（時間だけ使う）。
- 180 秒より前に**出し終えた** pizza だけが点になる。
- つまり 1 枚の価値の半分以上は「出したこと」自体。**1 枚多く出すことは、品質を大きく上げることより強い。**

#### 実際に置いたとき（funghi の注文。1 個 3 秒のモデル。#218 §7.2）

| プレイ | LR-A（注文どおりが必要） | LR-D（統一 G1。少なく出すのを許す） |
|---|---|---|
| 理想どおり作り続ける（1 枚 43 秒・4 枚） | 798 点 | 798 点 |
| 全部 1 個ずつで作り続ける（1 枚 34 秒・5 枚） | **0 点**（全部 FAILED「注文のマッシュルームの数が足りません」） | **825 点**（理想より高い） |

- 1 個 6 秒のモデルの margherita では、**品質 0 でも 1 個ずつの方が勝つ**（理想 2 枚 399 点 < 1 個ずつ 4 枚 400 点）。これは品質の係数では防げない（#218 §7.3）。

#### プレイヤーが感じること

| 観点 | LR-A: 注文どおりの数が必要 | 少ない量の高速提供を許す（LR-C / LR-D） |
|---|---|---|
| 攻略 | 「正確に、速く」。上手い人 = 注文どおりを速く作れる人 | LR-D: 「少なく、速く」が最適解になる（45 ケース中 31 で得）。LR-C: 提供の点を量で割り引くので、得になりにくい |
| ランキング | 今の上位のスコアと、これからのスコアを比べられる（ruleset v1 のまま） | ruleset v2 に bump。過去のスコアとは比べられない（週の区切りが要る） |
| 公平性 | 全員が同じ条件（注文の数）。「少なく出す」抜け道がない | LR-D: 抜け道を知っている人が有利。LR-C: 公平だが式が複雑 |
| 分かりやすさ | 「注文は注文」。**ただし Free Cooking では 2 個で ★4 なのに、Lunch Rush では 2 個で失敗**、というモードの差を覚える必要がある | ルールが全モードで同じ。ただし LR-C は「提供の点が量で減る」を説明する必要がある |
| 実装 | gate に policy を渡すだけ。ranking、Cloud Function、#213 の `requiredStockUnits` は変えない | LR-C: serve record に量の情報を足し、Cloud Function を変更して deploy。#213 の seam の値を 1 に変える |
| 在庫 | 注文の数の在庫がないと「作れない」（#213 の stock-aware pool から外れる） | 1 個でもあれば「作れる」。注文に出る recipe が増える |

- LR-A の文言は「注文」を強調する: 「注文のマッシュルームの数が足りません（2/3）」。
- Lunch Rush でもお手本のサムネイル（個数つき）は表示される（`GameScreen` の mini thumbnail は mode で gate されていない。**コードを読んだだけで、実機では未確認**。Phase B の Human Verification で確認する）。

#### Owner の選択肢

| 案 | 一言で | #218 の評価 |
|---|---|---|
| **LR-A** | Lunch Rush は注文どおり（今のまま） | 推奨。時間のモデルに左右されない |
| LR-C | 統一 G1 + 提供の点 100 を量で割り引く | 統一したいならこれ。ranking v2 と function の deploy が要る。全ケースは未検証 |
| LR-D | 統一 G1 + 得になるのを受け入れる | 非推奨（少なく出すのが最適解になる） |
| LR-E | 統一 G1 + 不足の係数を上げる | 非推奨（品質 0 でも勝つ秒数があり、係数では防げない） |

---

### OD-4b（本書で追加）: 量の係数 Q を Lunch Rush の品質点にも掛けるか

**なぜ要るか（Fresh Audit で確認した事実。main `dff233c`）:**

- `computeScoringV2` の呼び出しは `gameReducer.ts` の `CONFIRM_BAKE` の 1 か所で、FREE と Lunch Rush で共通。
- Lunch Rush の `qualityTotal` は、その `score.total`（`App.tsx` `handleMissionServeNext`）。
- したがって Q を足すと、**LR-A でも**、Lunch Rush で PASS した「置きすぎ」の pizza の品質点が下がる。
  - 不足の係数は、LR-A では Lunch Rush で効かない（不足は FAILED で、品質点は 0 に固定されるため）。
  - 過剰の係数（OD-3）だけが効く。

| 例（funghi の注文、配置は最良） | 今 | Q を Lunch Rush にも掛ける（OD-3 = 0.15） |
|---|---|---|
| mushroom 3 個 | 1 枚 199.5 | 199.5 |
| mushroom 5 個 | 1 枚 195.5 | **186.0** |

- 1 run 全体への影響は小さい（1 枚で最大 −15 点ほど。1 枚の提供は 100 点）。
- `LUNCH_RUSH_RULESET_VERSION` のコメントは「式、Completion Gate の適用、時間」が変わったら bump するとしている。品質点の中身の変更は書かれていない。**過去に品質点だけが変わったときに bump した前例は、本書では確認していない。**

| 選択 | 内容 | ranking |
|---|---|---|
| **b1: 掛ける（全モード共通）** | Scoring は 1 つのまま。置きすぎは Lunch Rush でも少し損 | ruleset v1 のまま（週の途中で置きすぎの点だけ少し変わる）。または v2 に bump（Owner 判断） |
| b2: Lunch Rush では掛けない | Scoring に mode を渡す。Lunch Rush の品質点は今と同じ | 変化なし |
| b3: OD-3 = 0 にする | そもそも過剰の罰がない | 変化なし |

**#218 の Fresh Review への入力**: #218 §7.6「LR-A: ranking への影響なし」は、ranking の式、ruleset、Cloud Function について正しい。ただし、過剰の罰が Lunch Rush の品質点に効くことは書かれていない。Review で補足するか、本 OD-4b で Owner が決める。

---

### OD-5 Free Cooking の discovery

**問い:** 種類がそろっていれば、量が足りなくても「図鑑のピザを発見」にするか。

#### 今の挙動

- Free Cooking（お手本なしの自由調理）で種類をそろえても、**個数が足りないと発見にならない**。
- 結果は「オリジナルピザ」+「図鑑のピザまであと少し…！材料の数や焼き加減を変えてみよう。」
- Free Cooking では**お手本が見えない**ので、プレイヤーは理想の個数を知らない。つまり「隠れた個数の条件」で落ちている。

#### 実際に置いたとき（margherita: tomato-sauce、mozzarella 理想 3、basil 理想 2）

| 置き方 | 今 | **D-A: 少ない量でも発見** | D-B: 発見には理想量が必要 |
|---|---|---|---|
| ソース + mozzarella 3 + basil 2 | 発見 ★5 | 発見 ★5 | 発見 ★5 |
| ソース + mozzarella 1 + basil 1 | オリジナル「あと少し…」 | **発見**、図鑑に BEST ★3（1/3 が一番の不足）+ 発見のボーナス 50 Pitz | オリジナル「あと少し…」 |
| ソース + mozzarella 3 + basil 0 | オリジナル（種類が違う） | 同じ | 同じ |
| ソースの量が失敗 / 焼き加減が recipe の範囲外 | オリジナル「あと少し…」 | 同じ（文言は「ソースや焼き加減を変えてみよう」に変える） | 同じ |

#### 「発見はできるが評価は下がる」は自然か

- **自然だと言える点:**
  - 「新しいピザを見つけた」と「上手に作れた」は別の喜び。発見は種類の組み合わせ、評価は仕上がり、と分けられる。
  - 発見した後は図鑑でお手本（理想の個数）が見えるので、「次は ★5 を取りたい」という再挑戦の目標が自然に生まれる。
  - discovery の matcher は、もともと種類の集合だけで判定している。量が足りずに落ちるのは、今は Completion Gate だけ。
  - ⭐（Progression）は `Σ max(2, BEST)` なので、発見しただけで ⭐2 が入る点はどちらの案でも同じ。Q があるので、少ない量の BEST は ★3〜★4 までで、⭐ は膨らまない。
- **不自然に感じうる点:**
  - 「1 個ずつで発見した図鑑のピザ」が ★3 で登録される。初めての発見が ★3 だと、嬉しさが少し減る可能性がある（HR-7 で確認）。
  - D-B を選ぶなら、「個数が足りない」ことを near miss の文言か hint で**見える**ようにする必要がある（隠れた条件のままは不公平）。

#### Free Cooking と Lunch Rush の違い

- Lunch Rush は発見済みの recipe だけが注文に出るので、discovery には関係しない。
- recipe mode で「別の recipe を偶然作った」ときの発見（`discoveryRegistration.ts`）も同じ Completion Gate を使う。D-A なら、ここも少ない量で発見になる。

#### Owner の選択肢

| 案 | 一言で | 追加の作業 |
|---|---|---|
| **D-A** | 種類がそろえば発見。量は ★ で評価 | near miss の文言を「ソースや焼き加減」に変える |
| D-B | 発見には理想量が要る | near miss か hint で個数を見せる（新しい UI の設計が要る） |

---

### 決定の組み合わせの制約（Owner が選ぶときの注意）

| 組み合わせ | 可否 | 理由 |
|---|---|---|
| OD-1 = G1 かつ OD-2 = 何もしない / S1 / S2 | **不可** | 1 個ずつでも ★5。少なく載せる方が得（39/45） |
| OD-1 = G0（据え置き） | 可 | #215 は実装しない。OD-2〜OD-5 は不要（OD-3 だけ単独で入れることは可能） |
| OD-4 = LR-C / LR-D | 可 | ranking v2、Cloud Function の deploy、#213 の seam の差し替えが Phase に加わる（§3.5） |
| OD-5 = D-A かつ OD-1 = G2 | 可 | 発見の境界も G2 になる（半分未満は「あと少し…」） |

### Owner の記入欄

| ID | 選択 | メモ |
|---|---|---|
| OD-1 | ☐ G1 ☐ G2 ☐ G4 ☐ G0（据え置き） | |
| OD-2 | ☐ Q（0.5） ☐ S4 ☐ その他 | |
| OD-3 | ☐ 0 ☐ 0.10 ☐ 0.15 ☐ 0.25 | |
| OD-4 | ☐ LR-A ☐ LR-C ☐ LR-D | |
| OD-4b | ☐ b1（掛ける・v1 のまま） ☐ b1（掛ける・v2 に bump） ☐ b2（Lunch Rush では掛けない） ☐ b3（OD-3 = 0） | |
| OD-5 | ☐ D-A ☐ D-B | |

---

## 2. Fresh Audit（main `dff233c`。既存の仕組みへの影響）

| 仕組み | 場所 | 影響（推奨の組み合わせ G1 + Q + LR-A + D-A の場合） |
|---|---|---|
| **Completion Gate** | `src/logic/completionGate.ts` | `completionMinimum(req, policy)` を追加。`evaluatePizzaCompletion(recipe, pizza, policy)`。呼ぶ側は `gameReducer.ts:1001`、`freeCook.ts:56,79`、`discoveryRegistration.ts:37` の 4 か所 |
| **Scoring 2.0** | `src/logic/scoringV2/index.ts`（呼び出しは `gameReducer.ts:992` の 1 か所） | `quantity` の要素を追加して total に掛ける。`SCORING_V2_RULESET_VERSION` を `phase-4a-2-shadow-3` から bump |
| **missionScoring** | `src/logic/missionScoring.ts` | **式は変えない**（`round(served × 100 + Σquality)`）。OD-4b = b1 なら、入ってくる quality の値が変わる |
| **Lunch Rush scoring / ranking ruleset** | `src/shared/lunchRushScoring.ts`（`lunch-rush-v1`） | LR-A: 式と ruleset は変えない（OD-4b の決定しだいで bump）。LR-C: v2 |
| **Cloud Function** | `functions/src/submitLunchRushScore.ts`（`src/shared/lunchRushScoring.ts` をそのまま bundle） | LR-A: 変更なし。`completionStatus` は client が送る値のまま。LR-C: serve record の型と検証の変更、deploy |
| **Lunch Rush の serve** | `App.tsx:525`（FAILED なら quality 0）、`mission/lunchRush.ts:216` | 変更なし。LR-A では「注文」policy の結果がそのまま `state.completion` に入る |
| **recipe discovery** | `logic/discovery/freeCook.ts`、`state/discoveryRegistration.ts`、`logic/discovery/matcher.ts` | matcher は変えない（種類の集合）。gate の policy が `"recipe"` になるので、D-A なら少ない量でも発見 |
| **inventory consumption** | `state/inventory.ts` `consumePizzaInventory`（`gameReducer.ts:1009`） | **変更なし**。置いた数だけ消費。FAILED でも消費（今と同じ） |
| **`requiredStockUnits`** | **main には存在しない**（#213 の設計案。まだ実装されていない） | LR-A: 値は `minCount` のまま。LR-C/D: `completionMinimum(req, "recipe")` = 1 に差し替え |
| **Dex BEST** | `state/dex.ts` `registerScoreToDex` | 式は変えない。過去の BEST は再計算しない（grandfather） |
| **Pitz** | `logic/pitzReward.ts` | 変更なし。total の帯で決まるので、Q で下がった total がそのまま反映される |
| **手際（Efficiency）** | `logic/efficiency.ts` | 変更なし。少なく置くと速くなるが、GOOD は上限が平ら（速いほど得にはならない）で、bonus は品質の帯で決まる。抜け道にならない。**回帰テストで固定する** |
| hint / お手本 / Starter Grant / economy simulation | `hints.ts`、`playerReference.ts`、`starterStock.ts`、`economySimulation.ts` | 変更なし（DS-A: `minCount` = 理想量のまま） |

### 本書の Fresh Audit で見つけたこと（#218 に書かれていないもの）

1. **F-1（OD-4b の元）:** Scoring 2.0 は FREE と Lunch Rush で共通の 1 か所から呼ばれる。LR-A でも、過剰の罰は Lunch Rush の品質点に効く。
2. **F-2（今からある挙動。#215 の範囲外）:** Lunch Rush の `MISSION_NEXT_ORDER`（`gameReducer.ts` の MISSION_NEXT_ORDER の case）は、**FAILED の pizza でも Dex に登録する**（コメントに「意図的」と書かれている）。
   - 今は、Lunch Rush で mushroom 2 個（FAILED）の funghi が、Dex の BEST に 98.9（★5）で記録されうる。
   - Q が入ると、この値は 82.5（★4）に下がる。Q はこの抜け道を小さくする方向に働く。
   - FAILED を Dex に登録するかどうかは、#215 では変えない。直すなら別の Issue にする（本書では Issue を作っていない）。
3. **F-3:** `completionGate.ts`、`scoringV2/**`、`recipes.ts` に触れている OPEN の PR はない（#205、#206、#213、#214、#217、#219、#220、#221 の変更ファイルを確認した）。3-4C の実装 PR はまだない。
4. **F-4:** 「材料の数や焼き加減を変えてみよう。」は `ResultPanel.tsx:213` にある。`INSUFFICIENT_REQUIRED_AMOUNT` を参照しているのは `completionGate.ts`、`completionMessages.ts` と、その test 2 つ、`gameReducer.completionGateEfficiency.test.ts`。

---

## 3. 実装 Phase 計画（Owner Decision の後）

### 3.1 #218 の A〜D から変えた点

| #218 の案 | 問題 | 本書の案 |
|---|---|---|
| A: quantity factor / scoring core | Q を本番につなぐと、G0 のままでは不足は FAILED なので、**過剰の罰だけ**が先に本番に出る（FREE と Lunch Rush の両方） | **A1（unwired の純粋関数）** と **A2（本番につなぐ + Result の 1 行）** に分ける |
| B: FAILED boundary | gate は FREE と Lunch Rush で共通。B で G1 にすると **Lunch Rush も同時に緩む** | **B に Lunch Rush の「注文」policy を含める**（LR-A の enforcement は B の中） |
| C: Free Cooking discovery | B で policy の既定を `"recipe"` にすると、discovery も自動で G1 になる | B では discovery の 2 か所に `"order"` を明示して今の挙動を保ち、C で `"recipe"` に切り替える |
| D: Lunch Rush enforcement / regression | enforcement は B に移るので、D は LR-A では「文言 + 回帰 + E2E」だけ | **D は OD-4 次第**: LR-A なら小さい回帰 PR（B に入れてもよい）、LR-C なら ranking v2 + function |

**順序の必須条件: A2 → B。** B を先に出すと、G1 + S0（1 個ずつでも ★5）が本番に出る。

### 3.2 Phase の一覧

```
#218 Fresh Review PASS ─▶ Owner Decision (OD-1〜5, 4b) ─▶ 3-4C merge (#205 → #206 → 3-4C impl)
                                                               │
                A1 (unwired pure functions) ◀──────────────────┘ ※ A1 は新規ファイルだけなので、Owner が許せば 3-4C の前でも可
                 │
                A2 (Q を本番につなぐ + Result の 1 行)
                 │
                B  (gate policy: recipe = G1、Lunch Rush = 注文)
                 │
                C  (discovery を G1 に)          D (LR-A: 文言 + 回帰 / LR-C: ranking v2)
```

### 3.3 各 Phase の定義

#### Phase A1 — quantity と completion policy の純粋関数（unwired）

| 項目 | 内容 |
|---|---|
| Scope | 新規ファイルだけ。どこからも import しない（#205 と同じ「headless、unwired」の形） |
| 変更予定ファイル | 新規: `src/logic/scoringV2/quantityComponent.ts`（不足率 / 過剰率を worst-group で求め、係数 Q を返す）、`src/logic/completionPolicy.ts`（`completionMinimum(req, policy)`）、それぞれの `*.test.ts` |
| production behavior | **変化なし** |
| unit tests | #218 U-4（worst-group、係数の境界、0 個でも total ≥ 0）。§1 の OD-2 / OD-3 の表の値を golden にする（理想 2/3/4、+1/+2/2 倍）。`completionMinimum`: `"recipe"` → OD-1 の値、`"order"` → `minCount`。spread は常に 1 |
| integration tests | なし（unwired） |
| E2E | 不要 |
| Human Verification | 不要（見た目も操作も変わらない） |
| regression risk | ほぼなし（既存のファイルを変えない） |
| 依存 | Owner Decision（係数の値）。3-4C とは衝突しない（新規ファイルだけ） |
| merge gate | unit / typecheck / lint / build が green。既存のファイルの diff が 0 |

#### Phase A2 — Q を Scoring 2.0 につなぐ + Result の 1 行

| 項目 | 内容 |
|---|---|
| Scope | `computeScoringV2` で Q を total に掛ける。`ScoringV2Result` に `quantity` を追加。ruleset を bump。Result に「○○がお手本より少なめ / 多め（2/3）」の 1 行を追加。OD-4b = b2 なら、Scoring に mode を渡す |
| 変更予定ファイル | `src/logic/scoringV2/index.ts`、`types.ts`、`toLegacyScoreBreakdown.ts`（必要なら）、`src/components/ResultPanel.tsx`、`src/state/gameReducer.ts`（b2 の場合だけ）、test |
| production behavior | gate は G0 のままなので、不足は今と同じ FAILED。**変わるのは過剰のとき**: FREE の ★/Pitz が下がる（OD-3）。OD-4b = b1 なら Lunch Rush の品質点も下がる。F-2 の Lunch Rush の FAILED の Dex 登録の値も下がる |
| unit tests | #218 U-5（15 recipe すべて理想で 99.5）、U-6（ruleset の bump、`malformedInput.test.ts` に quantity を追加）、U-7（`pitzReward` の帯）。efficiency の bonus が Q で下がった品質の帯に従うこと |
| integration tests | `gameReducer` の `CONFIRM_BAKE` → `REGISTER_TO_DEX`（過剰の pizza の BEST / Pitz）。Lunch Rush の `SERVE` の `qualityTotal`（b1 / b2 のどちらか） |
| component tests | #218 C-2（過剰の 1 行）。不足の 1 行は B まで出ない（不足は FAILED のため） |
| E2E | 必要（過剰の pizza の Result。390×844 と 360×800） |
| Human Verification | **必要**（Result の変更）。HR-1（理想 = 回帰）、HR-5（過剰） |
| regression risk | 中。既存の E2E / unit に、理想より多く置いて ★5 を期待しているものがあると壊れる。Scoring 2.0 の golden が変わる |
| 依存 | A1。3-4C の merge（`scoringV2/**` を触るため） |
| merge gate | 全 unit、E2E（Chromium）、#210 の Full WebKit を 1 回、Human Verification の動画と screenshot、Owner の Human Feel review |

#### Phase B — gate の policy（recipe = OD-1、Lunch Rush = 注文）

| 項目 | 内容 |
|---|---|
| Scope | `evaluatePizzaCompletion(recipe, pizza, policy)`。`CONFIRM_BAKE` で、FREE は `"recipe"`、Lunch Rush は `"order"`（LR-A の場合）を渡す。discovery の 2 か所（`freeCook.ts`、`discoveryRegistration.ts`）は **`"order"` を明示**して今の挙動を保つ。文言: Lunch Rush の不足は「注文の○○の数が足りません」 |
| 変更予定ファイル | `src/logic/completionGate.ts`、`src/state/gameReducer.ts`、`src/logic/discovery/freeCook.ts`、`src/state/discoveryRegistration.ts`（policy を渡すだけ）、`src/data/completionMessages.ts`、`src/components/ResultPanel.tsx`（不足の 1 行が出るようになる）、`MissionServePanel.tsx`（文言）、test |
| production behavior | recipe mode: 1 個以上あれば完成し、Q で ★ が下がる。在庫が理想量に足りなくても作れる（EP3 の soft-lock が消える）。Lunch Rush: **今と同じ**（文言だけ変わる）。Free Cooking の discovery: **今と同じ** |
| unit tests | #218 U-1（G1: 0 個は MISSING、1 個以上は PASS）、U-2（注文 policy で今の境界が残る）、U-3（sauce と bake は policy に関係なく同じ）、U-9（`minCount` を読む 6 か所が変わらない） |
| integration tests | `gameReducer.completionGateEfficiency.test.ts` の期待値を policy つきに移す。recipe mode の不足 → Dex / Pitz / 在庫。Lunch Rush の不足 → FAILED、quality 0、ranking の payload は `lunch-rush-v1` のまま（#218 U-11） |
| component tests | #218 C-1（不足の 1 行と ★4）、C-4（Lunch Rush の「注文の数」の文言）、C-5（文言の snapshot） |
| E2E | 必要。#218 E-1（funghi mushroom 2 個 → ★4、Dex、在庫 −2）、E-2（0 個 → FAILED）、E-4（Lunch Rush の不足 → FAILED、payload v1） |
| Human Verification | **必要**。HR-2、HR-3、HR-4、HR-6（と、実機で Lunch Rush のお手本サムネイルに個数が出るかの確認） |
| regression risk | 中〜高。gate は Dex、Pitz、Starter Grant、効率、Lunch Rush の serve に効く。**discovery の 2 か所に `"order"` を渡し忘れると、C の前に discovery が変わる**（test で固定する） |
| 依存 | **A2 が merge 済みであること（必須）**。3-4C の merge |
| merge gate | A2 と同じ + Lunch Rush の ranking の submit の回帰 E2E（`lunch-rush-result-ranking-phase4.spec.ts`） |

#### Phase C — Free Cooking の discovery（OD-5）

| 項目 | 内容 |
|---|---|
| Scope | D-A: `freeCook.ts` と `discoveryRegistration.ts` の policy を `"recipe"` に。near miss の文言を「ソースや焼き加減を変えてみよう。」に。D-B: policy は `"order"` のまま、個数の条件を見せる UI（別の設計が要る） |
| 変更予定ファイル | `src/logic/discovery/freeCook.ts`、`src/state/discoveryRegistration.ts`、`src/components/ResultPanel.tsx:213`、test |
| production behavior | D-A: 種類がそろえば、少ない量でも発見。BEST は Q の ★ で記録 |
| unit tests | #218 U-8（`gameReducer.freeCook.test.ts:192` の「basil が足りない margherita」の期待値を、near miss から発見に書き直す）。sauce / bake の失敗は `INCOMPLETE_MATCH` のまま |
| integration tests | 発見 → Dex（BEST ★3）→ 発見の bonus Pitz → Progression の ⭐（`max(2, BEST)`） |
| component tests | #218 C-3（near miss の文言） |
| E2E | 必要。#218 E-3（margherita の種類を 1 個ずつ → 発見）。回帰: `free-cooking-phase3-2.spec.ts` |
| Human Verification | **必要**。HR-7 |
| regression risk | 低〜中。discovery の数は種類で決まるので増えない。BEST の分布だけが変わる |
| 依存 | B |
| merge gate | A2 と同じ |

※ C は小さいので、Owner が望めば B と同じ PR にしてよい。その場合、B の Human Verification に HR-7 を足す。

#### Phase D — Lunch Rush（OD-4 次第）

| OD-4 | Scope | 変更予定ファイル | production behavior | tests / E2E | 依存 | merge gate |
|---|---|---|---|---|---|---|
| **LR-A** | enforcement は B に入っている。D は「回帰の固定」だけ: 注文 policy、ranking の payload v1、#213 の seam の値が `minCount` のまま | test だけ（B に入れてよい） | 変化なし | `lunch-rush-result-ranking-phase4.spec.ts` の回帰、#218 U-11 | B | CI green |
| LR-C | `LUNCH_RUSH_RULESET_VERSION` を v2 に。serve record に量の情報（残りの割合）を足す。提供の点 = 100 × 残りの割合。Cloud Function の検証を変える。`requiredStockUnits` を 1 に | `src/shared/lunchRushScoring.ts`、`src/firebase/submitLunchRushScore.ts`、`functions/src/submitLunchRushScore.ts`、`src/mission/lunchRush.ts`、`App.tsx`、#213 の実装 | ranking が v2。週の区切り | functions の unit、emulator、E2E、Human Verification（HR-6 の LR-C 版、HR-8 の実測） | B、#213 の実装、production deploy の手順（#134） | 全 CI + functions の deploy の Owner 承認 + 追加の格子の検証（#218 §7.4「LR-C は全ケースを検証していない」） |

### 3.4 まとめ（推奨の組み合わせのときの PR の数）

| PR | 変更の大きさ | Human Verification |
|---|---|---|
| A1 | 新規 4 ファイル | 不要 |
| A2 | Scoring + Result | 必要 |
| B（+ D の回帰。+ C を含めても可） | gate + 文言 | 必要 |
| C（B に含めない場合） | discovery 2 か所 + 文言 | 必要 |

### 3.5 OD の選択によって変わる点

| 選択 | Phase への影響 |
|---|---|
| OD-1 = G0（据え置き） | A1 / A2 は過剰の罰（OD-3）だけ。B / C / D は不要 |
| OD-1 = G2 / G4 | A1 の `completionMinimum` の値が変わる。G4 は recipe に `role` のデータが要る（`recipes.ts` の変更 → 3-4C と #221 の W1 authoring との衝突に注意） |
| OD-2 = S4 | A1 の関数が「上限の帯」になる。以後は同じ |
| OD-3 = 0 | 過剰の 1 行は出さない（または点に効かない表示だけ）。OD-4b は不要 |
| OD-4b = b2 | A2 で `computeScoringV2` に mode を渡す（呼び出しは 1 か所なので小さい） |
| OD-4 = LR-C | D が大きくなる（上の表）。#213 の実装との順序の調整が要る |
| OD-5 = D-B | C は「文言か hint で個数を見せる」UI の設計が先に要る |

---

## 4. 既存の PR / Issue との依存関係（2026-09-24 時点、GitHub で確認）

| PR / Issue | 状態 | 関係 |
|---|---|---|
| **#218**（Completion Gate Fresh Audit） | **OPEN — Fresh Review PASS 待ち**（head `5105771`、mergeable clean） | 本書の入力。**PASS が Owner Decision の前提** |
| Issue #215 | OPEN（コメントなし） | 本書と Phase A1〜D の親 |
| #214（3-4C Decision Gate） | OPEN | D-3 で「Completion Gate の見直しは #215、実装は 3-4C の後」と決めている |
| #205（3-4A headless）→ #206（3-4B save）→ 3-4C の実装 | #205 / #206 は OPEN。3-4C の実装 PR は**まだない** | Phase A2 以降の開始条件（#218 §12）。A1 は新規ファイルだけなので、Owner が許せば先に出せる |
| Issue #212 / #213（3-4F Lunch Rush stock-aware） | OPEN | LR-A: 依存なし（`requiredStockUnits` = `minCount` のまま）。LR-C/D: seam の値の差し替えが要る |
| #209（OD-03 ⭐ gate）、#217（#216 paid unlock） | OPEN | ⭐ の式 `Σ max(2, BEST)` は変えない。Q で BEST が ★3〜★4 に抑えられる（⭐ は膨らまない） |
| #219（CI Phase 2B WebKit） | OPEN | 実装の PR の WebKit の実行方法に影響する（merge されたら、A2 / B / C の PR はその選択のルールに従う） |
| #220 / #221（Content Readiness / W1 authoring） | OPEN | 新しい recipe が入ると、Q の golden（全 recipe 理想で 99.5）に recipe が増える。G4 を選ぶと `role` の authoring が W1 と重なる |
| `docs/PROJECT_HANDOFF.md` | — | #213 と #219 が同じファイルを変えているので、本書は addendum を追加していない |

---

## 5. Guardrail の遵守（本作業）

- PR #218、#220 のブランチ、#205 / #206 / #209 / #211 / #213 / #214 / #217 / #219 は変更していない（読むだけ）。
- 実装のコード（`src/**`、`functions/**`、`e2e/**`、`.github/**`）は変更していない。merge はしていない。
- #218 の結論を PASS 扱いにしていない。
- 重複の Gate: `Completion Gate` / `partial quantity` / `owner decision` で Issue と PR を検索した。重複する Issue / PR はない（関係するのは #215 と #218 だけ）。**新しい Issue は作っていない**（Phase の Issue は Owner Decision の後で、選ばれた Phase の分だけ作る方が重複しないため）。
- UI の変更がないので、Human Verification の対象外（docs-only）。

---

## 6. 次に実行する最小タスク

1. **今: PR #218 の Fresh Review を完了させる**（並行作業中）。その Review で、本書の F-1 / OD-4b（過剰の罰が Lunch Rush の品質点に効く）を #218 §7.6 の補足として扱うかを判断する。
2. **#218 PASS の後:** Owner が §1 の記入欄（OD-1〜OD-5、OD-4b）を埋め、Issue #215 にコメントで記録する。
3. **Owner Decision の後:** Phase A1 の Issue を 1 つ作る（新規ファイルだけの unwired PR。Owner が 3-4C の前に始めてよいかも、その Issue で決める）。
