# Progression 2.0 W1 — 25-Recipe Economy & Progression Balance Fresh Audit

Status: **Fresh Audit 完了 — STOP。** docs のみの記録。`src/**`、`e2e/**`、CSS、runtime、balance 値は変更していない。PR は作っていない。merge もしていない。

- 判定: **B. KEEP + small tuning later**（W1 blocker なし、W1 前に必要な Owner Decision なし）
- 並行作業との関係:
  - I5b-3（Production Integration）の branch には触れていない。未コミットの状態も参照していない。
  - I5b-4（UI/UX Fresh Audit、`0c3e01f`）は cross-reference としてだけ読んだ。
- 再現用のファイル（docs 配下の analysis 用データ）:
  - `docs/reports/data/TETO_PROGRESS2_W1_25RECIPE_ECONOMY_simulation.py`
  - `docs/reports/data/TETO_PROGRESS2_W1_25RECIPE_ECONOMY_simulation.json`
  - `python3 docs/reports/data/TETO_PROGRESS2_W1_25RECIPE_ECONOMY_simulation.py` で JSON を再生成できる（決定的）。

---

## 1. Fresh state / authority

| 項目 | 値 |
|---|---|
| audited main | `12a09de2c4da8ed7e92f1ff9f47dd7bdf824a6e5`（PR #228 = I5a の merge）。`git fetch origin main` 直後に確認 |
| working tree | clean（branch `claude/25-recipe-economy-audit-yh82g9` = main と同じ commit から開始） |
| 本番の economy 実装 | `src/logic/materialShop.ts`（tier / pack / price）、`src/logic/pitzReward.ts`（報酬）、`src/logic/efficiency.ts`（CT2 bonus）、`src/state/inventory.ts`（`consumePizzaInventory`）、`src/state/materialEntitlement.ts`（`resolveShopEntitlement`） |
| 本番の ladder | `DISCOVERY_LADDER = SHIPPED_15_DISCOVERY_LADDER`（14 step）。RECIPES 15 件、入手可能な材料 22 |
| REC-04 authority | `6fe02e2`（OD-REC04-1〜3 RESOLVED。branch `claude/rec-04-fresh-design-gz6em4`。main には入っていない） |
| I5b Fresh Audit | `cc9dfaa` + `ca72af6`（OD-I5B-1 / OD-I5B-2 RESOLVED）。`git show` で読むだけにした |
| I5b-1 | `861798f` — `W1_25_DISCOVERY_LADDER` と `W1_RECIPE_REQUIREMENTS_FIXTURE`（未接続）。`git show` で読むだけにした |
| I5b-4 UI/UX Fresh Audit | `0c3e01f`（branch `claude/teto-pizza-fresh-audit-fgqqtc`）。cross-reference のみ |
| 関連する open PR | このセッションからは作っていない。I5b は「PR を作らない」運用で、I5b-1/2 は branch 上の commit のみ。#205 / #221 の TBD economy は authority として使っていない |

### 1.1 target の確認

| 項目 | authority | 確認結果 |
|---|---|---|
| recipe 数 | 25 | 本番の 15 件（`src/data/recipes.ts` を text として parse）+ W1 の 10 件（I5b-1 fixture）= **25** |
| 入手可能な材料 | 29 | starter 3 + ladder の材料 26 = **29**（I5a `obtainableIngredientIds` の定義と同じ） |
| material progression step | 24 | `W1_25_DISCOVERY_LADDER` の step 数 **24**（材料 2 つの step は 11 と 24） |
| starter | tomato-sauce / mozzarella / basil | `unlockCondition` なし。在庫は無制限で消費されない。starter だけで作れるのは Margherita だけ |

## 2. Economy authority（25-recipe 版の再構成）

`materialShop.ts`（main）の定数と一致することをコードで確認した。I5b-1 の `w1LadderEconomy.test.ts` も同じ値を固定している。

| 項目 | 値 | 出典 |
|---|---|---|
| tier の帯 | T1 = step 1–5、T2 = 6–14、T3 = 15–29、T4 = 30+ | `MATERIAL_PRICE_TIERS` |
| 初回パック | T1 60 / T2 80 / T3 100 / T4 120 | 同上（OD-REC04-3） |
| 補充 | T1 30 / T2 40 / T3 50 / T4 60 | 同上 |
| パック量 | 10 × k（k = その材料を使う recipe の最大 minCount）。初回と補充は同量 | `packQuantity`（OD-REC04-3） |
| 解放 | 無料。在庫 0 から始まる（無料の grant はない） | OD-REC04-2 / `resolveShopEntitlement` |
| `baseRewardPitz` | 全 recipe 100 | I5b Fresh Audit §1（Issue #38 V1 の慣例） |

### 2.1 実際の 1 枚あたり収入（シミュレーションが使う式）

`baseRewardPitz = 100` は収入の一部にすぎない。FREE モードで実際に入る額は次の合計（`gameReducer.ts` の `REGISTER_TO_DEX`）。

| 成分 | 値 |
|---|---|
| 品質倍率 | ★5（90+）×1.2 / ★4（75+）×1.0 / ★3（60+）×0.8 / ★2（40+）×0.5 / ★1 ×0 |
| 下限 | 20（★1 でも 20） |
| 初回発見 bonus | +50（その recipe の初めての発見のときだけ） |
| CT2 手際 bonus | base の 0〜10%（★5 GOOD で +10、★4 GOOD で +6、★3 GOOD で +3） |

| 品質 | 発見 1 枚 | 作り直し 1 枚 |
|---|---:|---:|
| ★5（GOOD） | **180** | 130 |
| ★4（GOOD） | **156** | 106 |
| ★4（手際 bonus なし） | 150 | 100 |
| ★3 | 130〜133 | 80〜83 |
| ★2 | **100** | 50 |
| ★1 | **70** | 20 |

- 開始時の Pitz は 0。
- Lunch Rush では 1 枚ごとの credit は出ない。1 run ごとに `calculateMissionReward`（40 + 品質 bonus + 提供数 bonus、最大 140）。
- 消費量:
  - scatter は置いた個数。minCount ではない。
  - spread（tomato-sauce / olive-oil / pesto）は 1 枚につき 1。
  - starter は消費されない。
  - FAILED のピザでも消費される。

## 3. Exact 24-step progression（economy 表）

- 「発見数」= その step が解放される Dex の発見数。発見が 1 つ増えるごとに 1 step 進む。
- key recipe の † は W1 の新しい recipe。
- ‡ は EP1 chain によって Pizza Select では LOCKED のままになる key recipe。Free Cooking でしか発見できない（§12.3）。

| step | 発見数 | 新しく解放される材料 | tier | 初回 | 補充 | k | パック | key recipe |
|---:|---:|---|---|---:|---:|---:|---:|---|
| 1 | 1 | egg | T1 | 60 | 30 | 1 | 10 | bismarck ‡ |
| 2 | 2 | bacon | T1 | 60 | 30 | 3 | 30 | breakfast-pizza ‡ |
| 3 | 3 | mushroom | T1 | 60 | 30 | 3 | 30 | funghi |
| 4 | 4 | **eggplant** | T1 | 60 | 30 | 3 | 30 | melanzane-pizza † |
| 5 | 5 | parmigiano | T1 | 60 | 30 | 2 | 20 | parmigiana-pizza † |
| 6 | 6 | pepperoni | T2 | 80 | 40 | 4 | 40 | pepperoni ‡ |
| 7 | 7 | sausage | T2 | 80 | 40 | 3 | 30 | salsiccia ‡ |
| 8 | 8 | ham | T2 | 80 | 40 | **3** | **30** | meat-lovers ‡ |
| 9 | 9 | **corn** | T2 | 80 | 40 | 3 | 30 | bambino † |
| 10 | 10 | **pineapple** | T2 | 80 | 40 | 3 | 30 | hawaiian † |
| 11 | 11 | black-olive + oregano | T2 | 80+80 = **160** | 40 / 40 | 2 / 2 | 20 / 20 | capricciosa |
| 12 | 12 | onion | T2 | 80 | 40 | 4 | 40 | pizza-portuguesa † |
| 13 | 13 | olive-oil | T2 | 80 | 40 | 1 | 10 | fugazza ‡ |
| 14 | 14 | garlic | T2 | 80 | 40 | 3 | 30 | marinara |
| 15 | 15 | anchovy | T3 | 100 | 50 | 3 | 30 | napoletana |
| 16 | 16 | tuna | T3 | 100 | 50 | 3 | 30 | tonno-e-cipolla |
| 17 | 17 | pesto | T3 | 100 | 50 | 1 | 10 | pesto-tonno † |
| 18 | 18 | cherry-tomato | T3 | 100 | 50 | 3 | 30 | genovese |
| 19 | 19 | **clam** | T3 | 100 | 50 | 3 | 30 | new-haven-apizza † |
| 20 | 20 | **fresh-tomato** | T3 | 100 | 50 | 3 | 30 | pesto-caprese † |
| 21 | 21 | **potato** | T3 | 100 | 50 | 3 | 30 | pesto-patate † |
| 22 | 22 | rosemary | T3 | 100 | 50 | 3 | 30 | pizza-bianca |
| 23 | 23 | **capers** | T3 | 100 | 50 | 2 | 20 | puttanesca-pizza † |
| 24 | 24 | fontina + gorgonzola | T3 | 100+100 = **200** | 50 / 50 | 2 / 2 | 20 / 20 | quattro-formaggi |

- 初回パックの合計: T1 5 × 60 = 300、T2 10 × 80 = 800、T3 11 × 100 = 1,100。**合計 2,200 Pitz**（26 材料）。
- 25 件目の発見（quattro-formaggi、Dex 25）では何も解放されない。

## 4. Player profile

| profile | 発見時の品質 | 作り直しの品質 | 置き方 | 作り直しの方針 | その他 |
|---|---|---|---|---|---|
| **A. Efficient** | 85（★4、手際 +6） | 88 | minCount ちょうど | 足りないときだけ Margherita（材料費 0） | 無駄買いなし、自発的な作り直しなし |
| **B. Normal** | 78（★4） | 80 | minCount | 足りないときは直近の recipe（在庫があれば） | 3 回の発見ごとに新しい pizza を 1 回作り直す。在庫が 1 枚分を切ったら、次の入荷費を残せる範囲で補充する |
| **C. Explorer** | 70（★3） | 74 | minCount | 直近の recipe | step ごとに Free Cooking で **2 回失敗**する（新しい材料 k 個 + 別の材料 2 個を消費し、報酬 0）。新しい pizza を毎回 1 回作り直す。補充は B と同じ |
| **D. Low-score / high-consumption** | 50（★2） | 50 | **minCount × 1.5**（切り上げ） | 直近の recipe | 発見の試行 4 回に 1 回は FAILED（消費ありで報酬 0。やり直す）。新しい pizza を毎回作り直す。補充は B と同じ |
| **E. Floor（追加）** | 35（★1） | 35 | minCount | Margherita | 最悪ケースの stress。REC-04 の "low" profile に相当 |
| **F. Skilled（追加）** | 92（★5、手際 +10） | 93 | minCount | Margherita | 上限の参照用 |

- 時間の仮定: 1 枚 1.25 分（作業約 45 秒 + 焼成 / RESULT 約 30 秒）、Shop 1 回 0.25 分。目安であり、計測値ではない。
- 追加の profile を入れた理由:
  - E は、下限 20 がどこで効くかを見るため。
  - F は、上限の参照のため。
  - 別に §7 で、A と同じ行動のまま品質だけを変えた sweep（★1〜★5）も取った。

## 5. Pitz cash-flow（Dex 0 → 25、step 0 → 24）

| profile | 焼いた枚数 | 収入 | 初回購入 | 補充 | 最終残高 | 最低残高※ | 作り直しの強制 | 入荷時に即購入できなかった回数 | 所要時間の目安 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A. Efficient | 25 | 3,900 | 2,200 | 0 | 1,700 | 96 | **0** | **0** | 37 分 |
| B. Normal | 33 | 4,550 | 2,200 | 0 | 2,350 | 90 | **0** | **0** | 47 分 |
| C. Explorer | 97 | 5,170 | 2,200 | 120 | 2,850 | 70 | **0** | **0** | 128 分 |
| D. Low-score | 57 | 3,700 | 2,200 | 200 | 1,300 | 40 | **0** | **0** | 78 分 |
| E. Floor（★1） | 51 | 2,270 | 2,200 | 0 | 70 | 0 | **26** | **12** | 70 分 |
| F. Skilled | 25 | 4,500 | 2,200 | 0 | 2,300 | 120 | **0** | **0** | 37 分 |

※ 購入・補充の直後の残高のうち最も低いもの（開始時の 0 は除く）。

- **P0 deadlock は 0。** 全 profile が 25/25 に到達した。
  - 理由 1: starter は無制限で消費されないので、Margherita の作り直しは材料費 0 で、常に 20 Pitz 以上になる。どの状態からでも必ず進める。
  - 理由 2（I5b Fresh Audit §11）: 発見数が N なら、N + 1 件が作れる。
- 参考（shipped-15 ladder、同じ profile）:

  | profile | 所要時間 | 最終残高 | 強制された作り直し |
  |---|---:|---:|---:|
  | A | 22 分 | 920 | 0 |
  | B | 29 分 | 1,330 | 0 |
  | E | 50 分 | 70 | 22（最大連続 8、即購入できなかった 6 回） |

  25 ladder は E の最大連続を 8 → 6 に**減らしている**。

## 6. Grind analysis（強制された作り直し）

A / B / C / D / F: **24 step すべてが 0 replay。**

E（★1）の step ごとの分布（key recipe を作る前に必要だった作り直しの回数）:

| 分類 | step（key recipe を作る前の作り直し） | 件数 |
|---|---|---:|
| 0 replay | Margherita、step 1〜10、12、14 | 13 |
| 1 replay | 13、16、18、20、22 | 5 |
| 2–3 replay | 15、17、19、21、23 | 5 |
| 4–5 replay | **11**（black-olive + oregano、160）: 5 | 1 |
| 6+ replay | **24**（fontina + gorgonzola、200）: **6** | 1 |

- **最大連続: 6（step 24）。** Margherita を 6 回（約 7.5 分）作ってから、最後の 2 材料を買う。
- 「技術的には進めるが、同じ pizza を何度も作る」区間:
  - step 11（Margherita 5 回）
  - step 15〜23 の T3 区間。1〜2 回が交互に 9 step 続く
  - step 24（6 回）
- どれも ★1 の player だけに起きる。★2 以上では起きない（§7）。
- REC-04 の "low" profile（51 bakes / grind 26 / streak 6）と数値が完全に一致した。**REC-04 の owner 承認時点で既知の性質**である。

## 7. Reward = 100 audit

### 7.1 発見 1 回の報酬で、次の材料をすぐ買えるか（貯金なし）

| 品質（発見 1 回） | T1 60 | T2 80 | T3 100 | step 11（160） | step 24（200） |
|---|:-:|:-:|:-:|:-:|:-:|
| ★5（180） | ✅ | ✅ | ✅ | ✅ | ❌（−20） |
| ★4（150〜156） | ✅ | ✅ | ✅ | ❌（−4〜−10） | ❌ |
| ★3（130） | ✅ | ✅ | ✅ | ❌ | ❌ |
| ★2（100） | ✅ | ✅ | ✅（ちょうど） | ❌ | ❌ |
| ★1（70） | ✅ | ❌（−10） | ❌（−30） | ❌（−90） | ❌（−130） |

- **材料 2 つの step（11 と 24）は、どの品質でも 1 回の報酬では足りない。**
  - ★2 以上は、それまでの黒字（T1 で 1 step あたり +40〜+120）で吸収できるので、強制される作り直しは 0。
  - ★1 は、T1 の黒字が 1 step +10 しかない。T2 の −10 で使い切るため、step 11 と 24 が grind になる。
- ★2 の player は、T3 区間の収支が 1 step あたり ±0 になる（100 − 100）。残高は横ばいで、step 24 の 200 は T1〜T2 の貯金で払う。最低残高は 40。
- **初回発見 bonus +50 が経済を支えている。** bonus がなければ:

  | 品質 | 強制される作り直し | 最大連続 |
  |---|---:|---:|
  | ★3 | 3 | 1 |
  | ★2 | 20 | 3 |
  | ★1 | 86 | 9 |

### 7.2 品質 sweep（A の行動、品質だけ変える）

| 品質 | 強制される作り直し | 最大連続 | 即購入できなかった回数 | 最終残高 | 最低残高 |
|---|---:|---:|---:|---:|---:|
| ★5 | 0 | 0 | 0 | 2,300 | 120 |
| ★4 | 0 | 0 | 0 | 1,700 | 96 |
| ★3 | 0 | 0 | 0 | 1,125 | 73 |
| ★2 | 0 | 0 | 0 | 300 | 40 |
| ★1 | **26** | **6** | **12** | 70 | 0 |

## 8. Pack quantity audit（pack = 10 × k）

discovery path（Margherita + key recipe 24 件）で実際に使う量:

| 材料 | パック | path での使用量（A） | path での使用量（D ×1.5） | path の後の残り（A） | key recipe の枚数 / パック |
|---|---:|---:|---:|---:|---:|
| egg | 10 | 3 | 6 | 7 | 10 |
| bacon | 30 | 7 | 11 | 23 | 10 |
| mushroom | 30 | 5 | 8 | 25 | 10 |
| eggplant | 30 | 6 | 10 | 24 | 10 |
| parmigiano | 20 | 6 | 9 | 14 | 10 |
| pepperoni | 40 | 5 | 8 | 35 | 10 |
| sausage | 30 | 5 | 8 | 25 | 10 |
| **ham** | **30**（k 1→3） | 9 | 15 | 21 | 10（portuguesa） |
| corn / pineapple / clam / fresh-tomato / potato / cherry-tomato / rosemary | 30 | 3 | 5 | 27 | 10 |
| black-olive | 20 | 8 | 12 | 12 | 10 |
| oregano | 20 | 5 | 9 | 15 | 10 |
| onion | 40 | 10 | 15 | 30 | 10 |
| olive-oil / pesto（spread） | 10 | 4 | 4 | 6 | 10 |
| garlic | 30 | 7 | 11 | 23 | 10 |
| anchovy / tuna | 30 | 6 | 10 | 24 | 10 |
| **capers** | **20**（k 2） | 2 | 3 | 18 | 10 |
| fontina / gorgonzola | 20 | 2 | 3 | 18 | 10 |

- **ham の k 1 → 3（パック 10 → 30）は妥当。** 旧パック 10 のままだと、次の問題が起きる。
  - Portuguesa（ham ×3）の 1 パックが 3.3 枚分になり、「1 パック = ピザ 10 枚分」（OD-REC04-3）の原則が崩れる。
  - path の使用量は 9/10 でぎりぎり。D（15）は path の途中で補充が 1 回必要になる。
  - 価格は T2 の 80/40 のままで、既存の ham 所持者は補充 1 回あたりの量が 3 倍になる（得をする）。
- **capers（k2 / パック 20）:** Puttanesca 10 枚分。capers を使う recipe は 1 件だけで、path では 2 個しか使わない。
- **新 7 材料（k3 / パック 30）:** 初回購入の後、key recipe を 10 枚作れる。path で使うのは 1 枚分（3 個）で、27 個が残る。
  - eggplant だけは 2 recipe（melanzane / parmigiana）で使うので、2 枚分を使う。
- **補充の頻度:**
  - discovery path だけなら、A / B / F は補充 **0 回**。
  - 補充が起きるのは、作り直しを重ねる profile だけ（C 3〜4 回、D 5 回）。
  - 補充が本格的に必要になるのは、Lunch Rush と作り直しを繰り返す段階。
  - 補充のコストは 25 recipe の平均で **1 枚あたり 8.4 Pitz**（最大は quattro-formaggi の 17.0、最小は Margherita の 0）。
- **在庫過多:** A は、終了時に 26 材料の合計で約 560 個の在庫を持っている。
  - 在庫の上限も劣化もないので、害は出ない。作り直しと Lunch Rush の備蓄になる。
  - ただし、発見のために 1 パック（10 枚分）を買って 1 枚分しか使わないため、「パックの大半が余る」体験が 24 回繰り返される。
  - P2。OD-REC04-3 の設計どおりで、変える根拠は弱い。

## 9. 既存 save の migration economy（15 → 25 ladder）

`resolveShopEntitlement` の union 規則で計算した。解放済み、所持、在庫、Pitz は一切減らない。

| ケース | 切り替えで増える NEW 行 | NEW 行の初回合計 | 買わずに作れる未発見 recipe | 全部買った後に作れる未発見 recipe | 次の入荷まで | 見える価格変化 |
|---|---|---:|---|---|---|---|
| A. Dex 0 | — | 0 | margherita | margherita | 1 発見 | なし |
| B. Dex 1 | —（egg は元から NEW） | 60 | — | bismarck | 1 | なし |
| C. Dex 5（旧 key 1〜4 済み、sausage は未購入） | eggplant、parmigiano | 200（sausage 80 を含む） | — | melanzane、parmigiana、salsiccia | 3（step 8） | **sausage の NEW 行 60 → 80**、pepperoni の補充 30 → 40、parmigiano 80 → 60 |
| D. Dex 15（22 材料すべて所持） | **eggplant、corn、pineapple** | **220** | **pizza-portuguesa、pesto-tonno** | + melanzane、parmigiana、bambino、hawaiian（6 件） | 4（step 19） | 補充価格 10 材料（下の §10） |
| E. EP4-era（Dex 3、EP4 grant 済み） | — | 60（bacon） | funghi | funghi | 1 | なし |
| F. high-stock（Dex 15、在庫 99、2,000 Pitz） | D と同じ | 220 | D と同じ | D と同じ | 4 | D と同じ（在庫があるので当面は影響なし） |
| G. low-Pitz（Dex 15、0 Pitz、在庫すべて 0） | D と同じ | 220 | （在庫 0 なので補充が必要） | 6 件 | 4 | D と同じ |

### 9.1 Dex 15 の player が NEW 3 件を同時に見たときの負担

- 初回の合計は 60 + 80 + 80 = **220 Pitz**。★4 の作り直しで約 2.1 回分、★1 なら 11 回分。
- 実際の負担はもっと軽い。Portuguesa と Pesto Tonno は、どちらも旧 15 件の材料だけで作れる。買わずに発見すれば、★4 で 150 × 2 = 300 Pitz が入る。
- Dex 15 から 25 までのシミュレーション（毎回、いちばん安く作れる未発見 recipe を選ぶ）:

| save | profile | 強制される作り直し | 最大連続 | 初回購入 | 補充 | 最終残高 |
|---|---|---:|---:|---:|---:|---:|
| D（600 Pitz、在庫 10） | A / B / D / E | 0 | 0 | 620 | 0〜40 | 680〜1,540 |
| G（0 Pitz、在庫 0） | A. Efficient | 1 | 1 | 620 | 440 | 606 |
| G | B. Normal | 1 | 1 | 620 | 440 | 540 |
| G | D. Low-score | 4 | 2 | 620 | 440 | 140 |
| G | E. Floor（★1） | 22 | 6 | 620 | 440 | 80 |

- 旧 ladder の sim で Dex 15 に着いた時点の残高は、A 920 / B 1,330 / D 700 / E 70。いずれも 220 を即時か 1〜2 枚で払える。
- 残る注意点:
  - load 時に増えた解放には通知が出ない（Shop の NEW 行のみ）。I5b Fresh Audit §11 と同じ扱い。
  - その後の分岐は 6 → 1 に減っていく（§12）。

## 10. Price-change impact（grandfather なし）

| 材料 | 旧 初回 / 補充 / パック | 新 初回 / 補充 / パック |
|---|---|---|
| parmigiano | 80 / 40 / 20 | **60 / 30** / 20（値下がり） |
| pepperoni | 60 / 30 / 40 | **80 / 40** / 40 |
| sausage | 60 / 30 / 30 | **80 / 40** / 30 |
| anchovy / tuna / cherry-tomato / rosemary | 80 / 40 / 30 | **100 / 50** / 30 |
| pesto | 80 / 40 / 10 | **100 / 50** / 10 |
| fontina / gorgonzola | 80 / 40 / 20 | **100 / 50** / 20 |
| ham | 80 / 40 / **10** | 80 / 40 / **30**（価格は同じ、量が 3 倍） |

価格が変わるのは 10 材料（値下がり 1、値上がり 9）。I5b Fresh Audit §5 と一致する。

**新規 player:**

- 旧 15 件と共通の 19 材料を 25 ladder の価格で全部買うと 1,580 Pitz。旧 ladder では 1,420 Pitz。**+160（+11%）** になる。
- 一方で、発見 1 件あたりの初回購入費は下がる。
  - 25 ladder: 2,200 / 25 = 88
  - 旧 ladder: 1,420 / 15 = 94.7
- 新規 player から見て「値上げ」はなく、単に T 帯の後ろに置かれた材料が高いだけ。

**既存 player:**

- 所持済みの材料は、補充の価格だけが変わる。
  - 9 材料が補充 1 回 +10 Pitz、parmigiano は −10。
  - 1 枚あたりの補充コストの増加は最大 +1.7 Pitz（例: tuna 3 個 × 50/30 = 5.0。旧は 4.0）。
- 経済的な影響はほぼない。

**UX 上の finding（F-09、P2）:**

- 価格変更の告知はない。
- いちばん目立つのは、旧 step 4〜5 で解放済みのまま未購入だった pepperoni / sausage の **NEW 行の価格が 60 → 80 に上がって見える**こと（ケース C）。
- grandfather は仕組みが増えるので推奨しない（I5b と同じ判断）。
- 必要なら、I6 で Shop に 1 回限りの告知文を出すかどうかを判断する。

## 11. Discovery tempo

| 区間 | その step を解放する発見 | 新しい材料 | 新しい Shop 行 | 新しい recipe 候補 | 候補になる W1 recipe | 価格 |
|---|---|---:|---:|---:|---|---|
| Early（step 1–5） | 1〜5 件目（Margherita〜Melanzane） | 5 | 5 | 5 | melanzane、parmigiana | T1 60 |
| Mid（step 6–14） | 6〜14 件目（Parmigiana〜Fugazza） | 10 | 10 | 9 | bambino、hawaiian、portuguesa | T2 80 |
| Late（step 15–24） | 15〜24 件目（Marinara〜Puttanesca） | 11 | 11 | 10 | pesto-tonno、new-haven、caprese、patate、puttanesca | T3 100 |
| 完了 | 25（quattro-formaggi） | 0 | 0 | 0 | — | — |

- **発見 1 回につき、ちょうど 1 step（材料 1 つ、Shop 行 1 つ、recipe 候補 1 つ）。** 例外は step 11 と 24 の 2 材料だけ。
- 24 回すべてが同じループになる: 発見 → 🆕通知 → Shop → 購入 → key recipe。
- 「単調になる区間」:
  - Late の T3 が 10 step 続く区間。
  - T3 に入ると価格の刺激（60 → 80 → 100）がなくなる。★2 の player は、収支が ±0 で残高が動かない。
  - 変化を作っているのは、W1 recipe が 5 件入ること（新しい visual、ジェノベーゼ系 3 件）だけ。
- 「新しいことが頻繁すぎる区間」:
  - Early では、約 1.5 分ごとに発見と Shop 訪問がある（§14）。
  - 子ども向けの短いループとしては許容範囲。ただし Shop に行く回数は 25 枚で 24 回になる（A）。P2。

## 12. Choice / branching

### 12.1 新規 save

| Dex | 作れる未発見 recipe | 分岐数 |
|---:|---|---:|
| 0 | margherita | 1 |
| 1〜24 | その step の key recipe だけ | **1** |

- **平均 1.0 / 最小 1 / 最大 1。** shipped-15 ladder でも同じ（全 15 Dex で 1）。
- 構造上そうなる。key recipe の規則では、Dex N で材料がそろう recipe は「Margherita + step 1〜N の key recipe」の N + 1 件だけ。そのうち N 件は発見済みになっている。
- 「実質 1 つしか正解がない step」が 24 step 連続する。Progression 2.0 は**完全な一本道**。
- deadlock しないことの証明（N + 1 件）と、一本道であることは同じ性質の裏表。

### 12.2 migration した save

- Dex 15 の save は、買わずに 2 件、全部買うと 6 件が選べる。
- その後は 5 → 4 → … → 1 と減っていく。
- 一本道でないのは、この移行期間だけ。

### 12.3 cross-reference: EP1 chain

- step 1、2、6、7、8、13 の key recipe（bismarck、breakfast-pizza、pepperoni、salsiccia、meat-lovers、fugazza）は、材料が入荷した時点でも EP1 chain によって Pizza Select では LOCKED のまま。
- そのため Free Cooking でしか発見できない。
- economy への影響は、見本なしで作るので品質が下がりやすい（★1 に寄るほど §6 の grind が増える）こと。
- 表示と gate の扱いは、I5b-4 の OD-PS-1 / F-2a で扱われている。この監査では判断しない。

## 13. Free Cooking の試行錯誤コスト

失敗（ORIGINAL / 不一致）は報酬 0 で、置いた在庫は消費される。

| 1 step あたりの失敗 | profile | 強制される作り直し | 最大連続 | 補充費 | 最終残高 | 所要時間 |
|---:|---|---:|---:|---:|---:|---:|
| 0 | C. Explorer | 0 | 0 | 0 | 2,970 | 67 分 |
| 1 | C | 0 | 0 | 0 | 2,970 | 97 分 |
| 3 | C | 0 | 0 | 220 | 2,750 | 159 分 |
| 5 | C | 0 | 0 | 510 | 2,460 | 221 分 |
| 0 | E. Floor（★1） | 26 | 6 | 0 | — | 70 分 |
| 1 / 3 | E | 26 | 6 | 0 | — | 100 / 160 分 |
| 5 | E | **31** | **7** | 90 | — | 226 分 |

- 失敗 1 回あたりの在庫コストは約 5〜8 Pitz 相当（新しい材料 k 個 = 補充価格 / 10、別の材料 2 個）。★4 の作り直し 1 回（100）よりずっと小さい。
- 新しい材料の初回パックで、key recipe 1 枚分とは別に **9 回まで失敗できる**。k がいくつでも 9 回（パック 10k、1 回の失敗で k 個）。
- **次の材料購入が遅れるのは ★1 の player だけ。** 5 回失敗しても、合計で +5 回の作り直し。
- 「失敗すると経済的に試せなくなる」状態は **ない（OK）**。
  - Margherita は常に材料費 0 で作れる。
  - Explorer の実際のコストは時間（1 step あたり失敗 1 回で、全体 +30 分）。

## 14. Starter / early-game（最初の 5〜10 分）

Margherita → egg → bacon → mushroom → eggplant → parmigiano:

| 発見 | A 残高（入荷後 → 購入後） | B | D（★2） | E（★1） | 経過（A/B） |
|---|---|---|---|---|---|
| Margherita | 0 → 156（egg 入荷） | 150 | 100 | 70 | 約 1.3 分 |
| Bismarck（egg 60） | 96 → 252 | 90 → 240 | 40 → 190 | **10** → 80 | 約 2.8 分 |
| Breakfast（bacon 60） | 192 → 348 | 180 → 430 | 130 → 280 | 20 → 90 | 約 4.3 分 |
| Funghi（mushroom 60） | 288 → 444 | 370 → 520 | 220 → 370 | 30 → 100 | 約 5.8 分 |
| Melanzane（eggplant 60） | 384 → 540 | 460 → 610 | 310 → 460 | 40 → 110 | 約 7.3 分 |
| Parmigiana（parmigiano 60） | 480 → 636 | 550 → 800 | 400 → 550 | 50 → 120 | 約 8.8 分 |

- 発見の頻度: 約 1.5 分に 1 回。Shop にも毎回行く。
- 材料不足と作り直しの要求は、全 profile で 0。
- ★1 は残高 10〜50 のぎりぎりで進むが、止まらない。
- 初回の egg（k1、パック 10）は、path で 3 個しか使わない。
- W1 の変更（eggplant と parmigiano が step 4〜5 に入った）で、最初の 10 分に W1 recipe が 2 件入る。T1 の安い価格で新しい visual に触れられる。**OK。**

## 15. Late-game（step 15 以降）

- T3 100 が 10 step 続く（anchovy〜fontina/gorgonzola）。step 24 だけ 200。

| 品質 | T3 1 step の収支 | 区間 15〜23 の強制作り直し | step 24 |
|---|---:|---:|---|
| ★4（A） | +56 | 0 | 貯金 1,744 → 1,544。即購入 |
| ★2 | ±0 | 0 | 貯金で払う。最低残高 40 |
| ★1 | −30 | 1〜2 が交互に計 14 | **6 replay（最大連続）** |

**step 24（fontina + gorgonzola）の重点監査:**

- 必要額 200 は、どの品質の 1 回の発見報酬（最大 180）でも足りない。ゲームで唯一の「貯金がないと即購入できない」step になる。
- ★2 以上は T1〜T2 の貯金で払えるので、問題なし。
- ★1 では 120 不足。Margherita を 6 回作る必要がある。
- 最後の 1 件（quattro-formaggi）の直前に最大の grind があるので、完走直前の体験を損なう可能性がある（F-01）。
- 調整レバー（§16）の効果:

  | レバー | step 24 の ★1 replay |
  |---|---|
  | 2 材料 step の 2 つ目を半額（bundleHalf） | 6 → 4 |
  | 初回 −20 | 0 |
  | 下限 40 | 0〜1 |

## 16. Sensitivity analysis（what-if のみ。authority にしない）

A の行動で品質だけを変えた。セルの値は「強制される作り直し / 最大連続」。

| 変更案 | ★5 | ★4 | ★3 | ★2 | ★1 | 副作用 |
|---|---|---|---|---|---|---|
| **Current** | 0/0 | 0/0 | 0/0 | 0/0 | **26/6** | — |
| reward 120 | 0/0 | 0/0 | 0/0 | 0/0 | **26/6（変化なし）** | ★1 は下限 20 に張り付くので効かない。★4 の最終残高が +500 増え、インフレが進む |
| 初回 −20（60/80/100 → 40/60/80） | 0/0 | 0/0 | 0/0 | 0/0 | **0/0** | 初回の合計が 2,200 → 1,680。T1 が 40 になる |
| 初回パック無料 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | Shop の購入判断がなくなる（REC-04 の「Shop で手に入れる」体験が消える） |
| 初回だけ 50% 割引 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 同上に近い。補充との価格差が逆転する（初回 = 補充） |
| T3 の初回 80 | 0/0 | 0/0 | 0/0 | 0/0 | 15/5 | T2 と T3 の区別が補充価格だけになる |
| 2 材料 step の 2 つ目を半額（bundleHalf） | 0/0 | 0/0 | 0/0 | 0/0 | 22/4 | step 11/24 の山だけを削る。狙いが限定的 |
| **下限 20 → 40** | 0/0 | 0/0 | 0/0 | 0/0 | **1/1** | ★1 の作り直しが 40 に上がる。★2 の 50 との差が縮む（品質の動機づけが弱まる） |
| 初回発見 bonus なし | 0/0 | 0/0 | 3/1 | 20/3 | 86/9 | 逆方向の感度確認。bonus +50 が経済を支えていることを示す |

**調整レバーのまとめ:**

- ★2 以上の player には、どのレバーも不要。
- ★1 の grind に直接効くのは「下限」と「初回価格」。base reward は効かない。
- step 24 / 11 の山だけを狙うなら、2 材料 step の割引が最も局所的。

## 17. Findings（分類）

| id | finding | severity | 時期 |
|---|---|---|---|
| F-01 | ★1 の player だけ、step 24 で 6 回、step 11 で 5 回の Margherita 作り直しが要る（合計 26 回。所要 37 分 → 70 分）。REC-04 の low profile で既知 | **P1**（★1 に限る） | **I6 tuning**（★ 分布の実測を見て、下限 40 / 初回 −20 / 2 材料 step の割引から選ぶ） |
| F-02 | 2 材料 step（160 / 200）は、1 回の発見報酬を常に超える。★2 以上は貯金で吸収する | P2 | Post-W1 |
| F-03 | 分岐数が全 Dex で 1（完全な一本道）。migration 直後だけ 2〜6 | P2（design） | Post-W1（次の wave の ladder 設計で判断） |
| F-04 | 最も効率のよい稼ぎ方は Margherita の作り直し（材料費 0、★4 で約 85 Pitz/分）。Lunch Rush は補充費を引くと約 18〜20 Pitz/分。「同じ pizza を何度も」は Margherita に集中する | P2 | Post-W1 |
| F-05 | Pitz のインフレ。A〜C は完走時に 1,700〜2,850 が余り、使い道がない。discovery path では補充がほぼ発生しない | P2 | Post-W1（Pitz の使い道を設計するとき） |
| F-06 | 在庫過多。発見のために 10 枚分を買い、1 枚分しか使わない体験が 24 回ある（A の完走時の在庫は約 560 個）。害はない | P2 | Post-W1 |
| F-07 | ham の k 1 → 3（パック 30）は正しい。旧パック 10 だと Portuguesa が 3.3 枚分になり、D は補充が必要になる | OK | — |
| F-08 | capers の k2 / パック 20、新 7 材料の k3 / パック 30 は、いずれも key recipe 10 枚分。失敗 9 回分の余裕がある | OK | — |
| F-09 | 価格変更（10 材料）の告知がない。旧 step 4〜5 で解放済み・未購入の pepperoni / sausage の NEW 行が 60 → 80 に見える。経済への影響は小さい（1 枚あたり +1.7 Pitz 以下） | P2（UX） | I6（告知文を出すかどうか。grandfather は推奨しない） |
| F-10 | Dex 15 の migration: NEW 3 件で 220 Pitz。2 件は買わずに発見できるので、A/B の強制作り直しは 0。0 Pitz かつ在庫 0 でも 1 回 | OK | — |
| F-11 | Free Cooking の失敗が経済的に試行を止めることはない（5 回失敗 / step でも、★2 以上は作り直し 0） | OK | — |
| F-12 | EP1 chain によって、key recipe 6 件（step 1、2、6、7、8、13）は Pizza Select から作れず、Free Cooking でしか発見できない。品質が下がると F-01 が悪化する | P2（cross-ref） | I5b-4 の OD-PS-1 で扱う |
| F-13 | reward 100 + 発見 bonus 50 で、★2 以上は強制作り直し 0。bonus は必須（なければ ★2 で 20 回） | OK | — |
| F-14 | Early は約 1.5 分ごとに発見と Shop 訪問があり、T1 の黒字で余裕がある | OK / P2 | — |
| F-15 | Late は T3 が 10 step 続き、★2 の収支は ±0。価格の刺激がなく、単調になりやすい | P2 | Post-W1 |
| F-16 | Lunch Rush は在庫を見ずに注文を選ぶ（既存の制約、#224 の範囲外）。在庫が少ない D 型の player は FAILED の提供が増えるおそれがある | P2（cross-ref、既知） | Post-W1 |

- **P0 deadlock: 0 件。**
- P1: F-01 の 1 件（★1 に限る）。
- 上記以外は P2 または OK。

## 18. Decision gate

| 判定 | 該当 | 理由 |
|---|---|---|
| A. KEEP | — | ★1 に P1 が 1 件ある |
| **B. KEEP + small tuning later** | **✅** | P0 は 0。★2 以上は全 profile で強制作り直し 0、入荷時に即購入できなかった回数も 0。P1（F-01）は REC-04 の owner 承認時点で既知の数値（low profile と完全に一致）で、25 ladder は shipped-15 の最大連続 8 を 6 に**改善**している。調整は数値 1 つで済み、I6 で ★ 分布を実測してから決めるのが妥当 |
| C. OWNER DECISION REQUIRED before W1 | — | W1 前に判断が必要な項目はない。I5b Fresh Audit §5 の「価格変更は Owner Decision 不要」という判断とも整合する |
| D. BLOCKER | — | deadlock なし、relock なし、在庫消失なし |

**W1 blocker: なし。**

**Owner Decisions（W1 の後。今は起票のみで、値は変えない）:**

| id | 内容 | 時期 |
|---|---|---|
| OD-ECO-1 | ★1 player の grind（F-01）を直すか。レバー: 下限 40 / 初回 −20 / 2 材料 step の割引。I6 で ★ 分布を実測してから判断する | I6 |
| OD-ECO-2 | 価格変更の告知（F-09）を出すか。推奨は「出さない」、または Shop に 1 行だけ | I6 |
| OD-ECO-3 | Pitz の使い道とインフレ（F-05 / F-04） | Post-W1 |
| OD-ECO-4 | 次の wave の ladder で分岐を持たせるか（F-03） | Post-W1 |

## 19. 推奨する次の行動

1. **I5b-3 は economy を変えずにそのまま進める。** この監査は I5b-3 の実装を止める理由を持たない。
2. I5b-5 の Human Verification で、step 4（eggplant）と、可能なら migration した Dex 15 の NEW 3 件の場面で、Pitz の残高と価格の見え方を 1 回確認する（F-09 の実感を確かめる）。
3. I6 で、実際の ★ 分布（特に Free Cooking 限定の key recipe 6 件、F-12）を測る。★1 の割合が大きければ OD-ECO-1 を起票する。

---

この文書は docs のみの記録。`src/**`、`e2e/**`、CSS、runtime、balance 値は変更していない。PR は作っていない。merge もしていない。I5b-3 の branch には触れていない。
