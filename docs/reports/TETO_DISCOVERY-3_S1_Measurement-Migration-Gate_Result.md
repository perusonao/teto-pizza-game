# Discovery 3.0 S1 — Measurement / Migration Gate: Result

- **種別:** 計測・migration 評価・再現テストの gate。**production は変更していない**（`src/**` の差分 0、`RECIPES` / `INGREDIENTS` / ladder / Hint 5.0 / save / economy 不変）。brazilian-calabresa は **合成 fixture** としてのみ使った（production に存在しない）。S2 には進んでいない。
- **audited main:** `5c8190ff8e0e094baab6e563e06e1a11c16c4a57`（開始時に fetch し直して確認。S0 以降 drift なし）。
- **Owner 決定の扱い:** OD-D3-15 / 16 / 17 / 18 と OD-D3-4 / 9 / 11 / 12 / 13 / 14 は**確定していない**。本書は計測結果と推奨を示すだけで、選ぶのは Owner。
- **関連:** `docs/decisions/TETO_DISCOVERY-3_OWNER-DECISIONS.md`、`docs/reports/TETO_DISCOVERY-3_S0_SSOT-UPDATE-PROPOSAL.md` §4（S1 の範囲）。

## 0. Fresh Gate（S1 開始時）

| 対象 | 状態 |
|---|---|
| `origin/main` | `5c8190f`（変更なし）。ローカルの audit branch は main + audit / decision / roadmap の docs commit のみ |
| PR #295（Cooking Steps 設計 + CS-1a） | open、未 merge、head `13d6836`、base は古い `86b48fd`。**`src/data/cookingProfiles.ts` を変更する**（S2 が calabresa を CUT 対象にするなら衝突しうる）。CS-1b が待っていた #275 は main に merge 済み |
| PR #319（LC-R6-b） | open、`mergeable_state: clean`、head `c5d2da7`、base `6abddc7`。触るのは `handPolicy.ts` / `PreviewBadge.tsx` / `lcHandPreview.ts` で、S2 と重ならない |
| PR #321（Dough Guide Leak Fix） | open、`clean`、head `d7fc86a`、base = 現在の main。触るのは `PizzaStage.tsx`。S2 と重ならない |
| branch drift | リモート 322 branch。本 slice に関係する新しい branch / PR なし |

## 1. 成果物

| ファイル | 内容 |
|---|---|
| `tools/discovery3-s1/s1-probe.test.ts` + `vitest.s1.config.ts` | A / B / C / D / J / K / L と I の純関数側（本番コードを読むだけ。`npm test` の対象外。`npx vitest run --config tools/discovery3-s1/vitest.s1.config.ts`） |
| `tools/discovery3-s1/almost-there-oracle.spec.ts` + `playwright.s1.config.ts` | I の実ブラウザ再現（390×844、実ポインタ。`npm run test:e2e` / CI の対象外） |
| `tools/discovery3_s1_measure.py` | E / F / H（Fresh Audit のスクリプトを読み込んで再利用。約 3 分） |
| `docs/reports/data/TETO_DISCOVERY-3_S1_PROBE.json` / `…_S1_MEASURE.json` / `…_S1_ORACLE.json` | 生データ |
| `docs/reports/screenshots/discovery3-s1-almost-there-oracle/` | 11 ケースの RESULT スクリーンショット（390×844） |
| 本書 | 結果と Owner 向けの選択肢 |

`git diff origin/main..HEAD -- src` は空。既存の `e2e/` にも変更なし。

## 2. A — authoritative data と名前

| 照合先 | 結果 |
|---|---|
| 172 matrix（`brazilian-calabresa-pizzadb-p10`） | identity = `black-olive, onion, oregano, sausage, tomato-sauce`。fixture と**一致**。`FULL`（現行フローで表現可能）、blockers なし、status `READY_WITH_REVIEW` |
| PIZZA DB master evidence | 名前「ブラジリアン・カラブレーザ」、産地「ブラジル / サンパウロ」、sauce family トマトソース、材料（日本語）ソーセージ・玉ねぎ・**オリーブ**・オレガノ。`ingredientsCanonical` は null（matrix 側で解決済み） |
| 注意 1: 「オリーブ」→ `black-olive` | canonicalizer の規則自体が **「confidence-flagged match, not exact」**（PIZZA DB の plain olive は色・品種を指定しない）。runtime の olive 系は `black-olive` だけなので成立するが、**evidence 上の確度は確定ではない** |
| 注意 2: naming cluster NC-4 | 「Calabresa family (2-way)」= `brazilian-calabresa` と `calabresa-argentina`（salami、新食材）。review item が未解消 |
| 注意 3: master catalog の `calabrese` | `mozzarella, nduja, tomato-sauce`。**別のレシピ**（名前が紛らわしい） |
| 注意 4: 量 | evidence に `minCount` はない。fixture の値（sausage 2 / onion 2 / black-olive 2 / oregano 1）は placeholder で、S2 の authoring 作業 |

## 3. B — 既存食材の再利用だけで成立

- 5 食材はすべて runtime の `INGREDIENTS` にあり、starter（tomato-sauce）か ladder の中にある（sausage = step 7、black-olive / oregano = step 11、onion = step 12）。**新食材 0、ladder step 追加 0**。
- `validateDiscoveryLadder` は問題 0。`validateLadderProgression`（SOFTLOCK / KEY_RECIPE / UNREACHABLE / UNUSED_MATERIAL）は **25 件のときも calabresa を足した 26 件のときも問題 0**。

## 4. C — onion 解放時の pool = 2（3. pool=2 reproduction）

実コードの `recipeDiscoveryState` を、標準経路（margherita + step 1..s-1 の key recipe 発見済み）の entitlement・在庫つきで呼んだ。

| ladder step | 現行（25 件）の DISCOVERABLE | + calabresa |
|---|---|---|
| 11（black-olive + oregano） | capricciosa | capricciosa（**1 件のまま**。sausage は step 7、onion はまだ） |
| **12（onion）** | pizza-portuguesa | **brazilian-calabresa + pizza-portuguesa（2 件）** |
| 13（olive-oil） | fugazza | fugazza + brazilian-calabresa |

- **再現した:** step 11 までは 1 件、step 12 で初めて 2 件になる。
- **追加の発見:** `discoverableHintCandidates`（hint target の自動順）は、`keyStep` が同じ 12 で、次に「材料の種類数が少ない方」を先にするため、**calabresa（5 種）が portuguesa（6 種）より先**になる。Dex の「？？？」を pin しなければ、自動 target は calabresa になる。
- 後述のとおり、この pool = 2 が **step 12 で終わるか、最後まで続くか**は OD-D3-17 の選択で変わる。

## 5. D — discovery-count ladder の加速（4. ladder acceleration results）

**定量化の方法.** 実コードの `reachedStepNumber` / `discoveredRecipeCount` / `recipeDiscoveryState` を使い、「1 round = 1 回の発見」のプレイヤー像を 4 つ、解決方式を 3 つ（数値化できるもの）で走らせた。測った量:

- **lead** = 到達した ladder step − 発見した W1 レシピ数（W1 の発見だけで得られる step より、何 step 先に進んでいるか）
- **w1@24** = step 24 に到達した時点で発見済みの W1 レシピ数
- **pool** = 同時に DISCOVERABLE な未発見レシピ数の分布（round 数）

結果（`O1` = 現行仕様 / `O2` = ladder の件数に W1 の 25 件だけを数える / `O4` = step 24 まで calabresa を出さない）:

| プレイヤー | 方式 | lead | w1@24 | step 24 到達 round | pool の分布（round 数）|
|---|---|---:|---:|---:|---|
| 通常（calabresa を発見しない） | O1 | 0 | 24 | 24 | 1 件 12 / **2 件 13** |
| 通常 | O2 | 0 | 24 | 24 | 1 件 12 / 2 件 13 |
| 通常 | O4 | 0 | 24 | 24 | 1 件 24 / 2 件 1 |
| **先に発見** | **O1** | **1** | **23** | 24 | 0 件 1 / 1 件 12 / **2 件 13** |
| 先に発見 | O2 | 0 | 24 | **25**（+1 round） | 1 件 24 / 2 件 1 |
| 先に発見 | O4 | 0 | 24 | 24 | 1 件 24 / 2 件 1 |
| 後で発見（18 件目以降） | O1 | 1 | 23 | 24 | 1 件 12 / 2 件 13（0 件 1） |
| 後で発見 | O2 | 0 | 24 | 25 | 1 件 18 / **2 件 7** |
| すぐ全部発見 | O1 | 1 | 23 | 24 | 2 件が 13 round 続く |
| すぐ全部発見 | O2 | 0 | 24 | 25 | 1 件 24 / 2 件 1 |

**読み取り.**

1. **O1（現行）では、calabresa を 1 件足すだけで lead が 1 になり、step 24 に W1 レシピ 23 件で着く。** 足す件数 N に比例して lead が増える（Fresh Audit の greedy 試算では reuse-only 3 件で 25 round → 17 round）。
2. **O1 では pool = 2 が「永続」する。** 発見数ベースの ladder では、step s 解放後の makeable は常に（W1 の数 + 足した件数 − 発見数）なので、足した 1 件は「未発見のままでも、先に発見しても」**以後 pool が 2 のまま**になる（通常プレイヤーでも 13 round が pool = 2）。Owner の「最初は pool = 2」を超えて、pool が 1 に戻らない。
3. **per-round の ladder の進みは変わらない**（1 round = 1 発見なので step は同じ）。変わるのは「W1 レシピを何件発見したか」との関係で、経済と Hint（ヒントの対象が常に 2 件ある）に効く。
4. **O2 / O3 は lead = 0。** calabresa を発見しても W1 の ladder は進まない。発見した後は pool が 1 に戻る（枝分かれが「解決」する）。calabresa を発見しないプレイヤーでは pool = 2 が続く（通常 13 round、18 件目以降に発見するなら 7 round）。step 24 までの発見が 1 回多く要る（25 round）。
5. **O4 は実証にならない。** step 24 まで calabresa が出ないので、step 12 の pool = 2 が再現しない。

### OD-D3-17 の選択肢（S1 の最後に Owner が選べる形）

既存 save の互換（W1 の発見数と entitlement は保存済み、ladder は LAD-1 で凍結）と W1 LAD-1 を最優先に評価した。

| 案 | 内容 | lead | pool | 既存 save | LAD-1 | 実装の重さ | 所見 |
|---|---|---|---|---|---|---|---|
| **O1** | 現状維持（全発見を数える）+ 必要なら経済を再調整 | **+N** | **N+1 が永続** | 変化なし（production に post-W1 が無いので） | 維持 | なし（+ 経済の再調整） | OD-D3-5 が「実装前に必ず解決」と規定した問題そのもの。**単独では解決にならない** |
| **O2** | ladder の件数 = **W1 の 25 件に限る**。post-W1 は付加 ladder（step 25 以降）にだけ数える | 0 | 発見で 1 に戻る | 件数は Dex から導出されるので保存値はない。post-W1 の発見が 0 件の現 save は不変 | 維持（24 step は不変） | 小（`discoveredRecipeCount` の入力に絞り込み。step 25 以降の数え方は別途定義） | 最小。ただし W1 の 25 件の集合をコードに持つ必要がある |
| **O3** | レシピのデータに `ladderCredit: boolean`（既定 true）を持たせ、calabresa は false | 0 | 発見で 1 に戻る | 同上（Recipe は保存されない） | 維持 | 小（Recipe に 1 フィールド + 数え方） | 数値は O2 と同じ。**新レシピごとに Owner が「ladder を進めるか」を決められる**（将来の拡張で柔軟）。推奨 |
| **O4** | post-W1 レシピは W1 完走（step 24）後に出す | 0 | step 24 以降だけ | 不変 | 維持 | 小（`unlockCondition` 風） | S2 の目的（step 12 で pool = 2）を満たさない。**不採用を推奨** |
| **O5** | 新レシピごとに別の ladder（branch ladder）を持つ | 0 | 別管理 | 新しい保存項目が要る可能性 | 維持 | 大 | 過剰。Owner の「W1 ladder を再設計しない」にも距離がある |

**推奨（決定ではない）: O3**。理由は、lead = 0 と pool の自然な戻りが得られ、LAD-1 と既存 save に触れず、Owner が将来レシピごとに選べるため。O3 を選ぶ場合は、step 25 以降の ladder（`POST_W1_APPENDED_STEPS`）が何を数えるかを別に決める必要がある。

## 6. E — Hint candidate reduction（5. Hint candidate-reduction results）

**測り方.** Fresh Audit と同じ 2 つの世界: closed world（26 件 = 25 + calabresa から候補を絞る）と、open world のプレイヤー視点の組合せ数 R（各レシピの自分の key step の owned 集合で、全ヒント後に残る材料レベルの組合せ）。ヒントの構成は OD-D3-1 に沿い、**key-topping を置かない**。

### 6.1 R の分布（26 件）と 3 区分

「推理余地が適切」の上限が未決（OD-D3-15）なので、3 つの閾値候補で再集計した。

| ヒント構成 | R の 最小 / 中央 / p90 / 最大 | direct answer（R = 1） | 閾値 R ≤ 8 | R ≤ 32 | R ≤ 128 |
|---|---|---:|---|---|---|
| **P-B** sauce + cheese + 種類数 + family | 1 / 4 / 40 / 96 | **6** | 適切 9 / 広すぎ 11 | 適切 16 / 広すぎ 4 | 適切 20 / 広すぎ 0 |
| P-C sauce + cheese + 種類数 | 1 / 57.5 / 560 / 7,315 | 2 | 5 / 19 | 9 / 15 | 16 / 8 |
| P-D 種類数 + family（sauce / cheese を名指ししない） | 4 / 64 / 384 / 1,536 | 0 | 6 / 20 | 10 / 16 | 18 / 8 |
| P-G sauce + family（cheese・種類数なし） | 2 / 16 / 160 / 384 | 0 | 8 / 18 | 15 / 11 | 22 / 4 |
| （参考）現行 Hint 5.0 の全 rung（key 名指し、25 件） | — | **12** | 適切 9 / 広すぎ 4 | 13 / 0 | 13 / 0 |

- **brazilian-calabresa の R（P-B）は 80。** 閾値 32 では「広すぎ」、128 では「適切」。チーズなしで family が 野菜×2 + 肉 + ハーブ、step 12 の owned が 16 個と多いため。
- closed world の 26 件は、sauce → cheese → 種類数 → family の 4 段で 24 件が一意（salsiccia / pepperoni の対が残る。従来と同じ）。calabresa は 26 → 18 → **3 → 2 → 1**（3 段目の cheese「なし」で 3 件まで、種類数で 2 件、family 1 つで 1 件）。
- **step 12 の pool（portuguesa と calabresa）の 2 択は、cheese の段階で分かれる**（portuguesa = mozzarella、calabresa = なし）。cheese を名指しせず「あり / なし」だけなら情報量はさらに小さく、「なし」は 2.32 bit を無料で渡す（Fresh Audit §4）。

### 6.2 OD-D3-1 の「適用可能なヒント」をレシピ構造から導く規則（案）

| 要素 | 規則（案） |
|---|---|
| sauce / base | レシピにソース（sauce category）があるときだけ。無ソースは technique の領域なのでヒントにしない（TQ-1D まで） |
| cheese | チーズがあるときだけ。**無いレシピに「無し」を出さない** |
| 材料数 | 常に適用（総数とトッピング数） |
| family 構成 | トッピングがあるときだけ（quattro-formaggi は「なし」のため適用外） |
| technique | 実装済み authority のあるレシピだけ。現状 0 件 |

例: margherita = 4 要素、marinara / pizza-bianca / calabresa = cheese なし（3 要素）、quattro-formaggi = family なし。「存在しない要素は出さない」と「購入前の見た目が全レシピ同一であること（FREE LEAK）」は**両立しない**（要素の有無そのものが漏洩）。これが S1 で出た設計上の論点で、OD-D3-1 の UI 選択（線形 / メニュー）に効く。

## 7. F — direct-answer になるレシピ（6. direct-answer list）

定義: 自分の key step の owned 集合で、プロファイルの全ヒントを開いた後の R = 1。

**P-B（key 名指しなし）: 6 件**

| レシピ | key step | 理由 |
|---|---:|---|
| margherita | 0 | owned が starter だけ。herb が 1 つしか無い（family 飽和） |
| bismarck | 1 | `other` の owned は egg だけ（飽和） |
| breakfast-pizza | 2 | meat = bacon だけ、other = egg だけ（飽和） |
| funghi | 3 | vegetable = mushroom だけ（飽和） |
| meat-lovers | 8 | 所有する肉 4 種をすべて使う（meat 4 / 4、飽和） |
| quattro-formaggi | 24 | トッピングがなく、sauce・cheese・種類数で一意 |

**現行 Hint 5.0 の全 rung（key 名指し）: 12 件** = 上の 6 件 + genovese / salsiccia / pepperoni / pizza-bianca / melanzane-pizza / parmigiana-pizza。追加の 6 件は、key を名指しすると同 family の代替が残らなくなるもの。

→ direct answer の原因は 2 つ（owned が少ない序盤、family の飽和）。key の名指しが direct answer を 6 件増やす。brazilian-calabresa は direct answer ではない（R = 80）。

## 8. G — Hint 5.0 migration の比較（7. Hint migration comparison）

### 8.1 現状のコード上の依存（実測）

- **「key」は 2 種類ある。混同しない。**
  - `hintKeyToppingId`（Hint 5.0 の KEY_TOPPING rung。`recipeHintRoles.ts` で**レシピごとに authored**）。参照は `recipeHintRoles.ts` と `hint5Ladder.ts` の 2 ファイルのみ。テスト 2 ファイル。
  - `hintKeyIngredientId`（Hint 3.0 の無料 key = **最後に解放された食材から導出**、authored ではない）。参照は `hintSteps.ts` / `selectableHint.ts` / `nearMiss.ts`（FAR の「新しく入荷した材料は使ってみた？」）/ `deductionGuard.ts` ほか 7 ファイル。**OD-D3-2 の「キートッピング廃止」がこちらに及ぶかは未定義**（Owner 確認が要る）。
- `RECIPE_HINT_ROLES` は `Record<RecipeId, …>`。新レシピに**型で記述を強制**する（参照テスト 5 ファイル）。
- save には `discoveryHintFacts: Record<recipeId, string[]>` がある（`ing:` / `h5:sauce` / `h5:cheese` / `h5:key` / `h5:structure` / `cls:` / `meta:` / `attr:`）。読み込みは `isUnknownRecipeId` で未知の id を受け付ける設計。`h5:key` はソース 2 ファイル（`hint5Ladder.ts`、`preview/hvSeeds.ts`）、テスト 5 ファイル。`h5:` 全体は 11 テストファイル。
- Hint 5.0 は OD-H5-M3 により「既存の facts は読むだけで、書き換え・変換・削除しない。rung を完了させない。リクエスト時にだけ、ALL known なら 0 Pitz」。

### 8.2 案

| | **A. compatibility migration** | **B. authority migration** | **C. key を optional にして橋渡し** |
|---|---|---|---|
| 内容 | 既存 25 件は現行の Hint 5.0 runtime を保つ。新レシピは key なしの新 schema（`schemaVersion` をレシピごとに持つ）。2 方式が共存 | 共有 schema を key なしの構造へ移し、既存 25 件も migration | `hintKeyToppingId` を nullable のままにし、新レシピは `null`。ladder は今の「key なし = 有料の『なし』」の経路を使う |
| save 互換 | 変更なし。旧 facts はそのまま読める | `h5:key` を読み続ける（無害化）か、新 facts に写す。後者は M3 の「変換しない」と衝突するので、**読み続けるだけ**が安全 | 変更なし |
| 購入済みヒント | 保持 | 保持（価値を失わない設計が要る）。key rung を買った人に返金 / 等価物の付与の判断（Owner） | 保持 |
| Pitz 経済 | 旧レシピは現行価格（10/10/10/5/5）。新レシピの価格は別設計 | 全体を 1 つの価格体系に統一できる | 変更なし。ただし新レシピは「key の『なし』」に 10 Pitz を払うことになる（OD-D3-1 の「出さない」に反する） |
| 既存テスト | 変更最小。新 schema 用のテストを追加 | `hint5*` / `deduction*` / HintSheet / e2e の多数（`h5:` 11 ファイル、`RECIPE_HINT_ROLES` 5 ファイル）を書き換え | 変更最小 |
| UI | HintSheet が 2 種類の ladder を描く（複雑） | 1 種類。UI の設計が先に要る（linear / menu は未決） | 変更なし。ただし新レシピで「key: なし」の rung が出る |
| rollback | 新 schema だけを flag で止められる。旧経路は不変 | 難しい（旧 schema を消すため）。`HINT5_LADDER_PRODUCTION_DEFAULT` の rollback は旧 sheet に戻すだけで、新 schema には効かない | 容易 |
| 新レシピの authoring | key 不要（OD-D3-2 に沿う） | key 不要 | key を `null` と書く（型は満たす）。OD-D3-2 に沿うが暫定 |
| no-sauce / no-cheese への拡張 | スキーマを最初から「適用可能なヒントの集合」にできる | 同左（最も一貫） | 固定 rung のままなので拡張しづらい。OD-D3-1 に反する |

**所見（決定ではない）.** S2（calabresa の 1 件）に限れば **A が最小の変更で OD-D3-1 / 2 に沿える**。B は OD-D3-1 の UI 選択（linear / menu）が決まってからでないと設計できない。C は最小だが「なし」の rung を新レシピに出すため、OD-D3-1 と衝突する暫定策。いずれも **S1 では実装していない**。選択は Owner（新 OD-D3-19）。

## 9. H — near/far の漏洩量（8. near/far information leakage measurement）

Fresh Audit の solver を **26 件（calabresa 込み）**で再実行した。平均試行回数（括弧は E = フィードバックなし = (N+1)/2 との比）。

| ヒント | step | E | **A（現行 near/far）** | A2（正確な距離） | B（一致数） | C（部分一致） | D（構成数） |
|---|---:|---:|---:|---:|---:|---:|---:|
| H3: sauce + cheese + 種類数 | 12 | 39.5 | **9.0（0.23）** | 7.2（0.18） | 6.8（0.17） | 14.8（0.37） | 100.7（2.5） |
| | 18 | 68.5 | **15.0（0.22）** | 8.8（0.13） | 8.7（0.13） | 25.1（0.37） | 145.5（2.1） |
| | 24 | 116.0 | **30.1（0.26）** | 8.3（0.07） | 10.5（0.09） | 40.8（0.35） | 152.7（1.3） |
| H4: + family | 12 | 2.5 | 3.1（1.24） | 2.9（1.16） | 3.1（1.24） | 9.0（3.6） | 10.0（4.0） |
| | 24 | 6.5 | 4.7（0.72） | 3.4（0.52） | 3.6（0.55） | 26（4.0） | 31.8（4.9） |
| H0: なし | 12 | 4,372 | 68.9 | 8.2 | 8.0 | 53.1 | 136.8 |
| | 24 | 291,488 | ≥379（打切り 400） | 10.9 | 11.3 | 156.8 | 270.1 |

**読み取り.**

1. **near/far（A）は、H3 の水準で総当たりを約 4 分の 1 に縮める**（比 0.22〜0.26）。A2 / B は約 6〜14 分の 1（比 0.07〜0.18）で、探索空間が大きくなっても回数がほとんど増えない（Mastermind 型）。OD-D3-7 の方針（A2 / B を採らない）を、26 件でも支持する。
2. H4（family まで開示）では、A は E とほぼ同じ（比 0.7〜1.2）。**ヒントが十分に効いていれば、near/far の上積みは小さい**。逆に、ヒントが無い（H0）と A は数百回（step 24 で打切り）まで耐えるのは、d ≤ 1 の領域が探索空間に比べて極めて狭いため。
3. **near/far の到達範囲は小さい:** step 12（空間 8,744 件）で、portuguesa から d ≤ 1 の組合せは 8 件（0.09%）。**pool = 2 になると 16 件（0.18%）に倍増**する。ただし P2 の near-miss は「最も近い DISCOVERABLE レシピ」に対する表示なので、**2 つのうちどちらに近いかは分からない**（target ごとの情報は pool = 1 より弱くなる）。
4. 「総当たり solver になりにくい」の定義（OD-D3-16）の候補と、それを満たすフィードバック:
   - **定義 1:** フィードバックありの平均試行回数が、同じヒント水準での E の 25% 以上。H3 で満たすのは C / D（step 24 では A も 0.26 で満たす）。A2 / B は全 step で満たさない。
   - **定義 2:** H3・step 12 以降で平均 20 回以上。step 12 は D のみ、step 18 は C / D、step 24 は A / C / D。
   - どちらでも **A2 / B は不合格、D は合格だが手がかりにならない**（E に近い）。**C（部分一致のフラグ）は両方の定義を満たしつつ手がかりになる**中間案。A（現行）は探索空間が大きいときだけ満たす。
   - 定義の選択は **OD-D3-16（未決）**。

## 10. I — 「あと少し」の browser reproduction（9. browser reproduction verdict）

### 10.1 判定: **再現した**（oracle は技術的に成立する。ただし実害は限定的）

実ブラウザ（Chromium、390×844、実ポインタの dough → sauce → cheese → toppings → bake）で、Dex 3 の save（funghi が唯一の DISCOVERABLE）。各ケースを **3 回**（round 1、同じ画面からの再試行 round 2、別のブラウザ context の round 3）実行し、**全 11 ケースで round 1 = round 3（表示・分類・Dex・Pitz が一致）、round 1 = round 2（表示）だった**（決定論的）。

| # | 構成 | Result の分類 | 表示文言（lead） | near/far 行 | Dex | Pitz | Notebook（再試行で「試作#n」通知が出るか） | 在庫 |
|---|---|---|---|---|---|---|---|---|
| K0 | **正解 + 品質良** | DISCOVERED（NEW_DISCOVERY） | 「NEW PIZZA! フンギを発見」 | — | 3 → 4 | 999 → 1132（+83 +50） | 記録されない | mushroom 30 → 27 |
| **K1** | **正解 + ソース品質だけ失敗（1 タップ）** | ORIGINAL（= INCOMPLETE_MATCH） | **「図鑑のピザまであと少し…！ソースの量や焼き加減を見直してみよう。」** | なし | 変化なし | 変化なし（+0） | **記録されない（再試行でも通知なし）** | mushroom 30 → 27（通常と同じ消費） |
| **K2** | 誤った構成（遠い）+ 同じ品質失敗 | ORIGINAL | 「図鑑にはまだ載っていないピザ！」 | 「🛒 新しく入荷した材料は使ってみた？」 | 変化なし | 変化なし | 再試行で 📓 試作#1 | egg 30 → 29 |
| K3a | ソース / base 不一致（pesto）+ 品質失敗 | ORIGINAL | 「まだ載っていないピザ！」 | 「ソースを変えると…」 | 変化なし | 変化なし | 試作#1 | pesto 30 → 29 |
| K3b | 同（pesto）+ 品質良 | ORIGINAL | 同上 | 同上 | 変化なし | 変化なし | 試作#1 | 同上 |
| K4a | 材料不足（mushroom なし）+ 品質失敗 | ORIGINAL | 「まだ載っていないピザ！」 | 「材料をあと1つ足すと…」 | 変化なし | 変化なし | 試作#1 | 変化なし |
| K4b | 同 + 品質良 | ORIGINAL | 同上 | 同上 | 変化なし | 変化なし | 試作#1 | 変化なし |
| K5a | 余分な材料（+ egg）+ 品質失敗 | ORIGINAL | 「まだ載っていないピザ！」 | 「材料を1つ減らすと…」 | 変化なし | 変化なし | 試作#1 | mushroom 27 / egg 29 |
| K5b | 同 + 品質良 | ORIGINAL | 同上 | 同上 | 変化なし | 変化なし | 試作#1 | 同上 |
| **K6** | **既に発見済みの正解（margherita）+ ソース品質失敗** | ORIGINAL（INCOMPLETE_MATCH） | **「図鑑のピザまであと少し…」** | なし | 変化なし | 変化なし | 記録されない | 消費なし（starter のみの構成） |
| K7 | 正解 + **焼き**の品質失敗（生焼け） | FAILED | 「失敗 生焼けで提供できません」 | — | 変化なし | +0 | 記録されない | 消費あり（mushroom 30 → 27） |

スクリーンショット: `docs/reports/screenshots/discovery3-s1-almost-there-oracle/K0〜K7-round1.png`。matcher の内部結果は画面に出ないため、Result の分類（lead の文言・panel の class・near/far の有無・Dex / Pitz の変化）から読み、同じ構成を**純関数**（実コードの `resolveFreeCookPizza`）でも確認した（§10.3）。

### 10.2 何が再現し、何が再現しないか

1. **「あと少し」は、構成が recipe の identity と完全一致し、かつ recipe の Completion Gate で落ちたときだけに出る。** 誤った構成（K2〜K5）は同じ品質失敗でも出ない。K1 と K2 は同じ操作（ソースを 1 タップ）で、**文言だけが正誤を分ける**。
2. **K1 は「正解かどうか」を Pitz 0・Dex 変化なし・Notebook 記録なしで判定できる。** 再現は決定論的で、何度でも繰り返せる。
3. **発見済みの recipe でも出る（K6）。** 「これは図鑑の recipe と同じ組合せ」という一致の判定になる。
4. **焼きの失敗（K7）では出ない（FAILED の汎用表示）。** 生焼けで近似的に判定することはできない。
5. **通常の試作より得をする点:** 正解の組合せを「品質が低くても」確認できること、ソースを塗る手間（1 タップと 16 タップ）を省けること。**在庫は通常と同じだけ消費される**（mushroom 30 → 27）ので、在庫による歯止めは残る。
6. **得をしない点:** 識別性そのものは、通常の試作で正しい品質で作れば同じ結果（discovery）になる。ヒント 5.0 の有料 rung の価値を食う新しい情報（個々の材料の名前・family）は出さない。つまり **実害は「技量に依存せず、組合せの正誤を確かめられる」点**に限られる。

### 10.3 trigger 条件（純関数の確認）

実コード `resolveFreeCookPizza` に、同じ材料で量・焼きだけを変えた pizza を渡した。

| 構成 | 結果 |
|---|---|
| marinara の identity、焼き 55（recipe の窓 45–65 の内側） | MATCHED（発見） |
| marinara、焼き 70（recipe の許容 ±10 の内側） | MATCHED |
| **marinara、焼き 77（recipe の窓の外、free-cook の汎用窓 58–78 の内側）** | **INCOMPLETE_MATCH** |
| marinara、焼き 95（両方の外） | FAILED（OVERBAKED） |
| funghi、ソース 1 タップ | **INCOMPLETE_MATCH** |
| funghi、ソースをリング状に十分塗る | MATCHED |

**trigger は 2 つ:** (1) ソースの量 / 範囲が閾値（`SAUCE_MIN_RATIO`）未満、(2) 焼きが**その recipe 固有の窓**の外で、かつ free-cook の汎用窓の内側（recipe の窓が汎用窓から離れているほど起きやすい。marinara 45–65、napoletana 48–68、pesto 系 50–70、puttanesca 50–70 など）。(2) は**ブラウザでは再現していない**（純関数のみ）。

### 10.4 trigger 条件の修正候補の比較（実装しない。新 OD-D3-20）

| 案 | 内容 | oracle | 「次に何を直すか」が分かるか | 互換 / 工数 |
|---|---|---|---|---|
| T1 | 現状維持（設計どおりの「あと少し」） | **残る** | 分かる | なし |
| T2 | 文言を通常の ORIGINAL と同じにする | なくなる | **分からない**（技量の問題か構成の問題か見えない） | 小。actionable feedback に反する |
| T3 | **実行だけの助言**（ソースが薄い / 焼きが recipe の窓外）を、構成の正誤と無関係に、プレイヤー自身の pizza から出す | なくなる | 分かる（ただし recipe を名指ししない助言） | 中。新しい判定（自分の pizza のソース量・焼き）と文言。ORIGINAL でも FAILED でも同じ条件 |
| T4 | 構成が一致したら、ソース量・焼きが低くても発見として登録する（Completion Gate の該当を「発見」から外し、品質は Scoring に任せる） | **なくなる**（INCOMPLETE が存在しない） | 発見 + 低い★で伝わる | 大。Issue #215 の OD-5 と Completion Gate の設計、Pitz / FAILED の定義に触れる |
| T5 | ソース工程の途中で「ソースが薄いよ」を出す（recipe と無関係） | なくなる | 分かる（早い） | 中。UI の追加 |

**推奨（決定ではない）:** T3 + T5（構成の正誤と独立した「実行の助言」）か T4。T2 は Owner の actionable の方針に反する。T3 は recipe 固有の焼きの窓の外かどうかも使うので、窓の差（§10.3 の 2 つ目の trigger）が識別性の漏れにならないよう、助言は**自分の pizza の値のみ**から計算する必要がある。

## 11. J — Trial Notebook の挙動（10. Notebook findings）

実コードの Notebook（`recordAttempt`）と `classifyNearMiss` を、step 12 の pool = 2（portuguesa + calabresa）で使った。

| 試作 | 結果（matcher） | near-miss（最も近い DISCOVERABLE に対して） | Notebook |
|---|---|---|---|
| calabresa + mozzarella | NO_MATCH | REMOVE_ONE | NEW #1 |
| portuguesa − ham | NO_MATCH | ADD_ONE | NEW #2 |
| calabresa + mozzarella（再び） | NO_MATCH | REMOVE_ONE | **DUPLICATE #1（retry 1）** |
| tomato + sausage + onion | NO_MATCH | CLOSE | NEW #3 |

- **Notebook は recipe 名・target・距離を保存しない**（保存内容の検査で recipe 名 / `distance` は 0 件）。`feedback.kind` は任意の string で、near/far に依存しない。
- **保存するのは P2 の表示文言そのまま**（`kind` + `textJa`）。pool = 2 では、同じ文言の**意味が時間で変わる**: near-miss は「その時点の最も近い DISCOVERABLE レシピ」に対する表示なので、片方を発見して pool が変わると、過去の「あと 1 つ足すと…」は別のレシピを指していたことになる。Owner の方針（「near/far 文言をそのまま永久保存しない」）は、pool が 2 以上になると実質的にも必要になる。
- INCOMPLETE_MATCH / 発見 / 既知 / FAILED は記録されない（OD-P3-16）。§10 のとおり、「あと少し」の試作は Notebook に残らない。
- **差分表示**（前回との差: 追加 / 削除）は、2 つの試作の材料集合だけから計算できる（test 内の試作関数で確認。例: 「calabresa + mozzarella」→「portuguesa − ham」= 追加 ham 以外の組替え）。**ヒントとの整合表示**（取得済みの fact に対する照合）も、プレイヤーの試作と所有済み fact だけの関数。**どちらも新しい hidden fact を生成しない**。
- multi-target（pool = 2）の整合表示は、**どの target のヒントか**を選ぶ必要がある（OD-D3-10 のとおり Hint / Notebook / Dex で選ぶ）。自動 target は calabresa を先にする（§4）ので、明示の選択か、Dex の「？？？」の pin が前提。

## 12. K — matcher collision（11. matcher collision result）

- catalog = 25 + calabresa（26 件）。**identity（items + sauceBase）の衝突は 0 件**。
- calabresa の材料集合 → `UNIQUE_MATCH` calabresa。portuguesa / capricciosa の集合 → 各自の recipe（影響なし）。calabresa + mozzarella → NO_MATCH。
- calabresa と capricciosa は、ソース・種類数 4・family 構成（野菜×2 + 肉 + ハーブ）が**同じ**で、**チーズ**（なし / mozzarella）と 4 つのうち 3 つのトッピングが違う。ヒント側では、チーズの段階（または family を超える段階）が要る。
- `originalResultCopy.test.ts` の AMBIGUOUS の canary は、collision が 0 件のままなので作動しない。

## 13. L — economy / inventory（12. economy / inventory impact）

| 項目 | 結果 |
|---|---|
| Shop の k / pack | sausage k=3、onion k=4、black-olive k=2、oregano k=2。calabresa の placeholder（2 / 2 / 2 / 1）は既存の最大値以下なので **k・pack 量（10×k）・価格（T2 80 / 返品 40）は変化なし**。minCount が既存の最大を超えると k が増え、pack 量が変わる（S2 の authoring で確認） |
| 新しい在庫の種類 | なし（4 食材はすでに販売中） |
| 在庫の消費 | 通常の試作と同じ（§10: 失敗・oracle の試作でも mushroom 30 → 27） |
| Pitz | 初回発見は基本報酬 100 × 品質 + 初回 +50。品質 70 で **80 + 50 = 130 Pitz**。1 件増えるごとに 130 Pitz の収入機会が 1 回増える |
| Shop の累積コスト（W1 の全材料 1 パックずつ） | step 12 で 940、step 18 で 1,500、step 24 で 2,200 Pitz |
| ladder 加速（O1）の影響 | lead 1 = 「次の step の材料を、W1 を 1 件少なく発見した時点で買える」。足す件数に比例（§5）。O2 / O3 では 0 |

O1 を選ぶなら、W1 の経済（Pitz の到達性、`w1LadderEconomy.test.ts` などの pin）を**再シミュレーション**する必要がある（S1 では O1 の経済を再計算していない。lead と pool の数値のみ）。

## 14. 25 / 24 のハードコードと test の前提

**production の挙動コード:** 25 や 24 を**動作の条件にしている箇所は見つからなかった**（Dex の合計は `RECIPES` から導出されている）。残るのは次のとおり。

- `W1_FIXED_STEP_COUNT = 24`（LAD-1 の凍結を表す定数。意図どおり）。
- `populationId: "w1-25"`（ラベル。`discoveryLadder.ts`、`dinnerMission.ts`）。
- testSupport: `hint5EconomySim.ts` の `dexCount === 25`、`deductionInversion.ts` の「24 target の 300 状態 sweep」。
- コメント（`recipeChapters.ts` の「6 / 9 / 10」など）。

**test / e2e の pin:**

- **unit test 26 ファイル**が件数（25 / 24）を pin している: `discoveryLadder.test.ts`、`discoveryLadder.appendOnly.test.ts`、`w1LadderEconomy.test.ts`、`w1Reachability.test.ts`、`w1Activation.test.tsx`、`recipes.test.ts`、`recipeSauceProfiles.test.ts`、`referencePizza.w1.test.ts`、`completionGate.test.ts`、`efficiency.test.ts`、`pizzaSelect.test.ts`、`recipeDiscoveryState.test.ts`、`PizzaSelectScreen.test.tsx`、`DexOverlay.hint.test.tsx`、`App.test.tsx`、`dinnerResultDetection.test.ts`、`dinnerRun.test.ts`、`discoveryHint.walk.test.ts`、`gameReducer.trialNotebook.test.ts`、`deductionGuard.test.ts`、`deductionProduction.gate.test.ts`、`deductionRequest.test.ts`、`hint5Production.gate.test.ts`、`hint5Taxonomy.gate.test.ts`、`discoveryHintEconomy.sim.test.ts`、`hint5Economy.sim.test.ts`（ほか economySimulation など）。
- **e2e 10 ファイル**が Dex のピル `N/25` を正規表現で assert している（`discovery-dex-hint`、`discovery-hint-facts-save`、`discovery-hint-sheet`、`discovery-near-miss-result`、`original-result-duplicate-notice`、`layout-contract`、`lunch-rush-material-shortage`、`progression2-p3-3-onboarding`、`save-forward-compat-3-4b`ほか）。
- これらは**意図的な pin**（件数が変わると落ちる）。26 件目を production に足す S2 では、**1 つのレビューされた変更として**更新する必要がある。
- ladder の検証は、26 件でも通る（§3）。`POST_W1_APPENDED_STEPS` は空のまま（全材料が既存 step 内）。

## 15. 更新した S2 blockers（14. updated S2 blockers）

S0 の一覧（`…S0_SSOT-UPDATE-PROPOSAL.md` §5）からの更新。

| # | blocker | 状態 |
|---|---|---|
| 1 | S1 の完了 | **解消（本書）** |
| 2 | ladder 加速の解決方式（OD-D3-17） | **未決**。§5 の O1〜O5。推奨は O3 |
| 3 | id と表示名（OD-D3-18） | **未決**。§17 の選択肢。「オリーブ」の確度（§2 の注意 1）も含む |
| 4 | Hint の役割データ（key）の扱い | **未決**（新 OD-D3-19: §8 の A / B / C）。`RECIPE_HINT_ROLES` が型で記述を強制するため、decision 無しに追加できない |
| 5 | 「あと少し」の oracle | **再現済み**（§10）。T1〜T5 から選ぶ（新 OD-D3-20）。**calabresa は 2 つ目の INCOMPLETE 対象**になり、oracle の面が増える |
| 6 | near/far の再評価 | **計測済み**（§9）。採否は OD-D3-7 の範囲内だが、pool = 2 で near-miss が「どちらに近いか」を示さなくなる点と、Notebook の文言の意味が変わる点（§11）は設計が要る |
| 7 | hint の候補削減の判定（OD-D3-15） | **未決**。calabresa は R = 80（閾値 32 では「広すぎ」、128 では「適切」）。S2 の追加前に閾値を決めないと、新レシピのヒント設計が判断できない |
| 8 | 「総当たり solver になりにくい」の定義（OD-D3-16） | **未決**（§9 の定義 1 / 2） |
| 9 | production データの追加 | **確認済みの一覧**: `RECIPES`、`RECIPE_DISCOVERY_TARGET_IDS`（`Record<RecipeId,…>`）、`RECIPE_SAUCE_PROFILES`（同）、`RECIPE_HINT_ROLES`（同、#4 次第）、`getReferencePizza` の fixture（Completion Gate のソース量と Scoring 2.0 が読む）、`CUT_ELIGIBLE_RECIPE_IDS`（**PR #295 が `cookingProfiles.ts` を変更中**）、`playerReference`、minCount の authoring、save の sanitizer（未知 id の扱い） |
| 10 | 25 / 24 の pin の更新 | **範囲を確定**（§14: unit 26 + e2e 10）。1 つの reviewed change にまとめる |
| 11 | Human Verification | 対象（Dex に新しい「？？？」、FREE の発見が変わる）。390×844 の動画と before / after のスクリーンショット |
| 12 | review status | READY_WITH_REVIEW の naming cluster（NC-4）が未解消 |
| 13 | open PR との衝突 | #295（`cookingProfiles.ts`）は **S2 が calabresa を CUT 対象にするなら衝突**。#319 / #321 は重ならない。#295 は base が古く未 merge |

## 16. OD-D3-17 / 18 / 19 / 20 の選択肢

### OD-D3-17（ladder 加速の解決方式）— §5 の表（O1〜O5）。推奨: **O3**

### OD-D3-18（brazilian-calabresa の id / 表示名）

| 案 | id | 表示名 | 所見 |
|---|---|---|---|
| a | `brazilian-calabresa` | ブラジリアン・カラブレーザ | evidence（PIZZA DB）と matrix の `canonicalCandidateId` に一致。NC-4 の相手（calabresa-argentina）と区別できる。長い |
| b | `brazilian-calabresa` | カラブレーザ（ブラジル風） | id は a と同じで、表示名を短く。「ブラジル風」で NC-4 の区別を残す |
| c | `calabresa` | カラブレーザ | 短いが、NC-4（argentina）と master catalog の `calabrese`（nduja）と**紛らわしい** |
| d | `calabresa-brasileira` | （自由） | PIZZA DB の語に近いが、matrix の id と不一致 |

加えて **Owner 確認が要る**: 「オリーブ」→ `black-olive` の canonicalization が確度 flag つき（§2）。選択肢は (i) black-olive のままにする、(ii) 緑オリーブを将来の食材として分離し、S2 では black-olive と注記、(iii) オリーブを外して identity を 4 材料にする（evidence と不一致）。**推奨: (i) + 注記**（runtime の olive は black-olive だけ）。

### OD-D3-19（Hint 5.0 の migration）— §8 の A / B / C。所見は A（S2 に限れば最小）

### OD-D3-20（「あと少し」の trigger）— §10.4 の T1〜T5。推奨: T3 + T5 か T4

## 17. S2 GO / NO-GO の推奨

**NO-GO（今は S2 に進まない）。** 進める条件は次の 5 つ。

1. **OD-D3-17**（ladder 加速）を選ぶ。**これがないと、S2 は W1 の経済と Hint の pool に副作用を残す**（O1 のまま足すと lead +1、pool = 2 が永続）。
2. **OD-D3-18**（id / 表示名）と、NC-4 の review、「オリーブ」の扱い。
3. **OD-D3-19**（Hint 5.0 の migration）。calabresa を足すと `RECIPE_HINT_ROLES` の記述が型で強制されるため、key の方針が先に要る。
4. **OD-D3-20**（「あと少し」の trigger）。oracle が再現したので、calabresa という新しい INCOMPLETE 対象を足す前に方針を決める。
5. **OD-D3-15 / 16**（R の閾値と solver 耐性の定義）。**S2 の実装の前提ではないが、新レシピのヒントが「広すぎ」（R = 80）かを判断するのに要る**。未決でも進めるなら、calabresa の Hint 設計を暫定扱いにする。

逆に、**技術的な blocker は無い**: ladder の検証は 26 件で通り、matcher の衝突は 0 件、Shop / 在庫は変化しない、calabresa は新食材・新 step を要さない。**決定が済めば、S2 は小さな data slice になる**（pin の更新 26 + 10 ファイルと Reference fixture が主な作業）。

## 18. 計測の限界

- C / D の「プレイヤー像」は、1 round = 1 発見の単純な方針。実プレイの探索（失敗試作、在庫切れ、買い忘れ）は含めない。O1 の**経済の再シミュレーションは行っていない**（lead と pool のみ）。
- E / F の R は、各レシピの自分の key step の owned 集合で測る。後の step ほど owned が増えて R は大きくなる。
- H の solver は一様ランダムの中立基準。情報量最大化の戦略ならフィードバックありの方式はさらに速い。上限 400 で打ち切った値（A の H0 など）は下限。pool = 2 の near-miss は「最も近い候補に対する表示」の性質を上の到達範囲の測定で評価しただけで、pool = 2 専用の solver は作っていない。
- I は Chromium の 1 種類、1 つの save、決定論性の確認は 3 回。**焼きの trigger（窓の差）はブラウザ未再現**（純関数のみ）。WebKit / 実機は未確認。
- A の「オリーブ」の canonicalization は evidence 自身が確度を保証していない。
- brazilian-calabresa の minCount は placeholder。
