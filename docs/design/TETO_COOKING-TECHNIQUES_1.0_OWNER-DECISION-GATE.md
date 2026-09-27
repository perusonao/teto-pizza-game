# TETO Cooking Techniques 1.0 — TQ-1 Owner Decision Gate

> **Status:** Fresh Audit + Owner Decision Gate。docs / data / tools のみ。
> src・CSS・e2e・save・recipe・price・★は変更していない。PR 作成・merge・deploy もしていない。
>
> - 基準: `claude/cooking-techniques-design-n0qfwj` の commit `49b0976`（`TETO_COOKING-TECHNIQUES_1.0_DESIGN.md`）
> - 監査した `origin/main`: `51e0923`（PR #252 DM-3R-2）。49b0976 以降、main は動いていない。
>
> **Verdict: A. TQ-1 READY FOR OWNER FINAL DECISIONS**
> （条件: §9 の hard prerequisite 3 件、OD-TQ-S1・OD-W2-1・OD-TQ-P1 を実装前に確定すること）

| Artifact | Path |
|---|---|
| 本書 | `docs/design/TETO_COOKING-TECHNIQUES_1.0_OWNER-DECISION-GATE.md` |
| TQ-1 gate データ（機械可読） | `docs/design/data/TETO_COOKING-TECHNIQUES_TQ1_GATE.json` |
| 生成テーブル | `docs/design/TETO_COOKING-TECHNIQUES_TQ1_GATE_TABLES.md` |
| 生成・検証ツール | `tools/cooking_techniques_tq1_gate.py`（`--check`） |
| 前回の設計・監査（変更なし） | `TETO_COOKING-TECHNIQUES_1.0_DESIGN.md` / `..._AUDIT.json` / `tools/cooking_techniques_audit.py` |

数値はすべてツールの出力。本文と JSON が食い違う場合は JSON が正。重み、★閾値、Pitz 帯、ladder、SAUCE_ONLY 文言、free-cook の SAUCE 文言は `src/**` から読み取り専用で parse しており、drift すると `--check` が fail する。

---

## 0. 結論

1. **TQ-1 の候補は 1 レシピだけ: オージー（`aussie-pizzadb`）。** 172 matrix の NO_SAUCE 44 行のうち、次をすべて満たすのは 1 行だけ（§3）。
   - ready（Phase-2 target）
   - 材料が全部 runtime にある
   - 他の技法が要らない
   - review 項目なし
   - collision なし

   チリアンナポリターナは Napoletana 命名クラスタの review が残るため外した。
2. **Scoring は案 B（no-sauce 専用 weight profile: sauce の 52 を pieces に移す）を推奨。** 「同じ腕前なら同じ★」を 11 点すべてで満たすのは B だけ（偏差 0、★ずれ 0）。A（比例再配分）は pieces 0 でも ★3 になり、C（満点扱い）は ★4 になる。既存 25 レシピは、どの案でも data 条件（`reference.sauce === null`）で分岐するので byte 不変にできる（§4）。
3. **新たに見つかった blocker 級の論点が 2 つある（どちらも設計で解消できる）。**
   - **Ladder:** Aussie を `RECIPES` に足して REC-04 rule で再生成すると、W1 ladder の順番が step 3 から変わる（onion→aussie が割り込む）。**append-only ladder（OD-W2-1 (b)）が TQ-1 の前提**になる（§5）。
   - **Privacy:** Aussie を最初に作れるのは W1 step 12 で、その時点の所持ソースは tomato だけ。そのため既存の near-miss「おしい！ソースを変えると、何か見つかりそう！」は候補が「なし」1 つ（k=1）になり、**未発見技法の答えを実質的に特定する**。Aussie と同じ PR で抑制ルールが要る（§7）。
4. **既存 UI が affordance を既に明示していた。** free cook の SAUCE step の文言は「好きなソースを選んでぬろう（なしでもOK）」「ぬらずに『次へ』でもOK！」。これは「操作の余地（affordance）」であって答えではないので、モデルと矛盾しない。ただし NO_SAUCE は「驚き」が最も小さい技法になる。TQ-1 の目的はループの実証なので、それでよい（OD-TQ-16）。
5. **Recipe Discovery を技法が阻害しない**ことを、機械テスト可能な不変条件 INV-TQ-NB として定義した（§6）。
6. Wave 2 とは PR を分ける。**共通基盤（no-sauce scoring、append-only ladder、NO_CUT profile）→ TQ-1 → Wave 2** の順（§9）。Aussie は TQ-1 が持ち、Wave 2 の W2-C からは外す。

---

## 1. Fresh GitHub 状態

| 項目 | 状態 |
|---|---|
| `origin/main` | `51e0923`（PR #252 merge）。49b0976 の base と同じ。 |
| 本ブランチ | `49b0976`（design）→ 本 gate commit。未 PR。 |
| 関連 open PR | #255（DH4 172 ingredient taxonomy、docs）、#259（Dinner DM-4-1 reward、unwired）、#243（Dinner DM-3 UI）、#220 / #221（Progression 2.0 content audit）。**いずれも技法台帳・no-sauce scoring に触れない。** |
| Wave 2 | `origin/claude/wave2-runtime-recipe-design-os06j1` の `e009da2`（docs/data/tools、未 PR・未 merge）。W2-C No-sauce（SAUCELESS_SCORING）と OD-W2-1〜9 を含む。§9 で依存を整理した。 |
| 重複 Issue | technique / no-sauce / mechanic_matrix drift の Issue は 0 件（§10）。 |

---

## 2. OD-TQ-2 の再確認（172 evidence との矛盾チェック）

`classificationChecks`（ツール）。すべて holds=True。

| Check | 結果 |
|---|---|
| C1 特殊ソース = 材料 | non-tomato base 33 行。そのうち 21 行は capability が一切不要。ソースの種類だけで新しい操作が要る行はない（2 層目は DOUBLE_SPREAD として別に数える）。 |
| C2 生地種類 = 材料 | DOUGH_VARIANT 33 行。Phase-1 の merge rationale のとおり、どの生地でもジェスチャーは変わらない。 |
| C3 piadina | `requiredCapabilities = [DOUGH_VARIANT]`、sauce = none。**piadina は技法ではなく「生地（材料）× ソースなし（技法）」の合流点**。 |
| C4 CUTなし | serve-whole-no-cut は calzone の 1 行だけで、ENCLOSE 行に含まれる。CUT は signature から除外されている。唯一の full-signature collision（fugazza / fugazzetta）も CUT では分かれない。 |
| C5 焼く前 | 後乗せ材料を持つ完全行も、すべて焼く前の材料を持つ（焼いた後だけで作るピザは 0）→ 全行共通の基準線。 |
| C6 後乗せの推測行 | required 12 行と candidate-only 11 行は重ならない（OD-TQ-12 の分離が data 上で成立している）。 |

→ **OD-TQ-2 の分類は evidence と矛盾しない。**

---

## 3. TQ-1 候補テーブル（NO_SAUCE 44 行を全件）

全列は `TETO_COOKING-TECHNIQUES_TQ1_GATE_TABLES.md` §1 と JSON `noSauceCandidates`。列は次のとおり:

- recipe ID
- 日本語名
- ingredients
- sauce requirement
- required techniques
- runtime で不足する材料
- Phase-2 class / step
- W1 ladder で作れるようになる step
- matcher identity
- exact collision（runtime 25 ＋ 172）
- runtime の近傍（near-miss d≤2）
- scoring impact
- CUT
- evidence（status / origin / review / blocker）
- SAUCE_ONLY k
- TQ-1 eligible と除外理由

除外理由の内訳: runtime にない材料 22、BLOCKED 系 18（mechanic-interpretation 7、product-decision 5、evidence 4、discovery-rule 2）、review 項目 2、他技法が必要 1 → **eligible は 1 行**。

### 3.1 オージー（TQ-1 推奨）

| 項目 | 値 |
|---|---|
| ID | `aussie-pizzadb`（canonical candidate `aussie`） |
| 名前 | オージーピザ |
| ingredients | bacon, egg, mozzarella, onion（**全部 runtime にある**） |
| sauce | 「チーズ（トマトソースなし）」family → none（evidence がソースなしを明示） |
| 技法 | NO_SAUCE のみ |
| progression | Phase-2 ready（Phase-2 step 1）／W1 ladder では **step 12**（onion）で作れるようになる |
| matcher identity | items {bacon, egg, mozzarella, onion}、sauceBase []、非既定の identity 次元なし |
| collision | 完全一致なし（runtime 25 ／ 172 とも）。runtime の近傍は breakfast-pizza（d=2: onion の有無＋ソースの違い） |
| scoring | 現行式では最大 48（★2 上限）→ §4 の scoring 改修が必須 |
| CUT | dough evidence なし → Wave 2 OD-W2-4 の New Haven 前例に従い **CUT なし**（free cook にも CUT はない） |
| evidence | READY、review なし、blocker なし。PIZZA DB 比較表 sample（Phase 0B、page 1） |
| privacy | 初めて作れる時点の所持ソースは tomato のみ → **SAUCE_ONLY k=1（要対策、§7）** |

### 3.2 次点（TQ-1 には入れない）

- **チリアンナポリターナ:** 材料は runtime にあり、step 20 から作れて、k=3 と安全。ただし NAMING_CLUSTER（Napoletana 3 系統）の review が未決。W2-C の候補。
- **ほかの ready no-sauce 行:** すべて新材料が 1 つ以上要る。Wave 2 以降。

---

## 4. 「ソースなし」の Scoring 2.0 詳細監査

### 4.1 現状（コードで確認）

- `computeScoringV2` = (Sauce 52 + Pieces 16 + Recipe 12 + Bake 20)/100 × quantity factor。
- **sauce component は常に計算される**。available/unavailable による分岐はない。
- `scoreSauceComponentV2` は quantity / coverage を reference 目標との類似度で測り、evenness / edge には presence gate（quantity < 0.05 → 0）がかかる。
- `ReferencePizza.sauce` は型として必須。読むのは次の箇所:
  - `completionGate.checkSauceQuantity`
  - `ReferencePreview`
  - `DinnerGameUi`
  - `GameScreen`（2 箇所）
  - `App.tsx` の live preview
- Completion Gate は、recipe が sauce を要求しない時は sauce 量検査を skip する（`isRequired` 判定）。ここは今のままで no-sauce に対応している。
- ★ = 90/75/60/40。Pitz 倍率 = 1.2/1.0/0.8/0.5/0（floor 20）。

→ no-sauce レシピを今の式に載せると **最大 48 点 = ★2 上限、Pitz ×0.5**。これは「不当に低得点」の確認でもある。

### 4.2 方式比較（equal-skill モデル: 同じ腕前 x なら sauce レシピは sauce=pieces=x、no-sauce は pieces=x。recipe=100、bake=100）

| 方式 | 式（no-sauce 時） | 同腕前との最大偏差 | ★ずれ（11 点中） | pieces 0 の下限 | 評価 |
|---|---|---:|---:|---:|---|
| 現行のまま | sauce≈0 | 52.0 | 9 | 32（★1） | ★2 上限。Dinner の ★≥3 target は到達不能。不可 |
| **A. 比例再配分** | (16P+12R+20B)/48 | 34.7 | 9 | **66.7（★3）** | 「何もしなくても ★3」。recipe と bake のタダ点が 25%+42% に膨らむ。不可 |
| **B. 専用 profile（sauce→pieces）** | (68P+12R+20B)/100 | **0.0** | **0** | 32（★1） | 同腕前なら同じ★・同じ Pitz。タダ点（recipe+bake=32）が sauce レシピと同じ。**推奨** |
| **C. sauce 満点扱い** | (5200+16P+12R+20B)/100 | 52.0 | 9 | **84（★4）** | 最悪。RESULT の「ソース 満点」表示も嘘になる。不可 |
| D1. 目標量 0 の reference | sauce=60 固定 | 31.2 | 8 | 63.2（★3） | 型を変えずに済むが、意味論が誤り（evenness / edge が常に 0）。不可 |
| D2. 生地・チーズ面の新 component | — | — | — | — | D3B（Dough scoring）や cheese-as-base の将来案。TQ-1 の範囲外 |

（全 11 点の表は生成テーブル §3。）

### 4.3 推奨: 案 B の仕様（OD-TQ-S1）

- `ReferencePizza.sauce: ReferenceSauce | null`。**null は「そのレシピに sauce 材料がない」時だけ**許す（test で双方向を強制）。
- `computeScoringV2`:
  - `reference.sauce === null` の時だけ `NO_SAUCE_WEIGHTS = { pieces: 68, recipe: 12, bake: 20 }` を使う。
  - sauce component は `{ available: false, reason: "NOT_APPLICABLE_NO_SAUCE" }` にする。
  - recipe id では分岐しない（data 条件のみ）。
- **既存 25 レシピ:** 全 fixture に sauce があるので従来の分岐を通る。**golden test（25 recipe × 既存 fixture の total / stars が 1e-9 以内で不変）で固定する。**
- quantity factor・bake cap（★5→★4）・Completion Gate はそのまま（no-sauce の sauce 検査は元から skip）。
- `SCORING_V2_RULESET_VERSION`: 既存の結果は変わらず、値は debug panel に出るだけ（save / Firebase には入らない）→ **bump しない**を推奨（OD-TQ-S2）。
- `LUNCH_RUSH_RULESET_VERSION`: mission score の式は不変。W1 の +10 レシピでも bump していない前例がある → **bump しない**（OD-TQ-S3）。

### 4.4 モード別の影響

| 対象 | 案 B での影響 |
|---|---|
| ★分布 | equal-skill で sauce レシピと同じ帯。**注意:** pieces が 68% を占める。pieces score は sauce ほど iPhone で calibration されていないので、TQ-1E の HV で「オージーの★が体感と合うか」を確認項目にする（R-S1） |
| Completion Gate | 変更なし（no-sauce は sauce 検査の対象外）。`reference.sauce` の null ガードだけ追加 |
| Dinner | 既存 mission（DM-A / DM-B）に Aussie は含まれない → 影響なし。将来 no-sauce を target にしても ★≥S が到達可能になる（現行式だと ★2 上限で deadlock する） |
| Lunch Rush | 発見済みになれば order に出る。guided profile は `deriveCoreSteps` によって DOUGH→CHEESE→TOPPING（SAUCE tab なし）、CUT なし。mission 品質の平均は B で同腕前と同等 |
| Pitz | `pitzReward` は total 帯を読むだけ → 変更なし |
| RESULT | sauce 行を「ソース：なし（このピザは使わない）」と表示する（0 点表示にしない）。UI は TQ-1D |

---

## 5. Discovery Ladder への影響（機械確認）

ツールは `src/logic/testSupport/discoveryLadderRule.ts` の REC-04 rule を Python に移植し、**現行 W1 24 step の完全再現（parity=True）**を確かめたうえで、Aussie を追加した場合を計算した。

| 方式 | 結果 |
|---|---|
| 再生成（現行 test の pin 方式） | 25 step になり、**step 3 に `onion→aussie` が割り込む**。以降、mushroom→4、…、black-olive→10（portuguesa）などと W1 の順番が全面的にずれる。途中まで進んだ save で「step N で何が開くか」が変わる |
| **append-only**（W1 1–24 固定） | Aussie は新材料 0 → **step 追加 0、W1 順不変**。onion が開く step 12 から発見可能 |

→ **TQ-1 は OD-W2-1 = (b) append-only に依存する（hard prerequisite）。** append-only の実装は Wave 2 と共有の基盤 slice（LAD-1、§9）。
付随作業（TQ-1D）: `discoveryLadder.test.ts` の `RECIPES.toHaveLength(25)` と「production ladder = rule(RECIPES)」の pin を append-only 版に置き換える。`recipeChapters` での Aussie の章は key step 12 から派生する（要確認）。

---

## 6. 不変条件（machine-testable）

| ID | 内容 | テスト方法 |
|---|---|---|
| **INV-TQ-NB**（No Blocking） | `signatureOfPizza` / `matchDiscovery` / `evaluateDiscovery` / `resolveFreeCookPizza` の出力は、技法台帳と affordance に**依存しない** | (1) 静的: これら 4 module と import 先が technique module / 台帳を import しないこと（source を読む test）。(2) property: `RECIPE_DISCOVERY_CATALOG` の全 target について、ideal pizza を台帳 `[]`・全技法・ランダム部分集合の 3 条件で評価し、結果が同一で、未発見なら `NEW_DISCOVERY` になること |
| **INV-TQ-1**（Implication） | Dex で discovered の recipe が要求する技法は、すべて台帳にある | REGISTER_TO_DEX 後の状態と、`loadSave`→backfill 後の状態の両方で検査。壊れた save（Dex に Aussie があり台帳が空）→ ロード後に `["no-sauce"]` |
| **INV-TQ-2**（Exactly once） | 台帳は単調増加。`lastTechniqueDiscovery` は 1 ラウンド 1 回 | REGISTER_TO_DEX の二重 dispatch、RETRY、reload で台帳と演出が 2 回目に出ないこと |
| **INV-TQ-3**（Score authority） | 技法台帳は scoring / Pitz / ★ / Dex BEST から読まれない。既存 25 recipe の score は不変 | 静的 import 検査 ＋ golden test |
| **INV-TQ-4**（No dead technique） | registry にあり affordance が開く技法には、runtime recipe が 1 つ以上ある | registry × catalog の test。**要求レシピが 0 の技法は affordance が開かず、認識もされない**（= TQ-1C を production で不活性にする仕組みにもなる、§9） |
| **INV-TQ-5**（Privacy） | 未発見技法の target に対する near-miss / hint の出力は、技法名・具体操作を含まず、軸を示す文言は k≥2 の時だけ出る | §7 のルールを pure function で表し、全 target × 全 ladder step で k を計算して検査 |
| **INV-TQ-6**（Recognition gate） | ORIGINAL ピザからの技法認識は affordance 到達後だけ。recipe 経由の認識は常に行う（INV-TQ-1 が優先） | step 11 / 12 の境界 test |

**deadlock の禁止:** INV-TQ-NB によって、matcher は技法を一切見ない。したがって「技法を先に知らないとレシピが見つからない」状態は構造的に存在しない。技法はレシピ発見の**結果として記録される**か、オリジナルピザで**先に気付かれる**かのどちらかで、前提条件になることはない。

---

## 7. near-miss guidance の privacy（DH4 方針との整合）

### 7.1 採用する基準

DH4 の `privacyWorstCaseCandidates`（k≥2、所持品 universe、単調安全）を、**「文言と整合する具体的な答えの数」**に適用する。

### 7.2 監査結果

| 出力 | Aussie の状況 | 判定 |
|---|---|---|
| 既存 `SAUCE_ONLY`「おしい！ソースを変えると、何か見つかりそう！」 | tomato＋Aussie の 4 品で焼くと d=1 SAUCE_ONLY。step 12 時点で所持ソースは tomato のみ → 整合する答えは「なし」だけ → **k=1、漏れる** | **要対策（TQ-1 と同じ PR）** |
| Owner 案「材料は合っているけど何かが違う…？」 | ソースが違うケースでは「材料は合っている」が偽になる（sauce は identity 材料）。また d=1 には追加・除去・ソース変更の全候補が整合する → k は大きい | 文言を「**おしい！あと少し、なにかが違うみたい…？**」にすれば真で、k≥2 |
| Selectable Hint（H3） | 行は 3 つ固定で、カテゴリが空であることは示さない（OD-H3-16）。Aussie の sauce 行は売る fact がないが、それは表示されない | 漏れない |
| DH4 structure（`meta:ingredient-total` = 4、DH4-2 で wiring 予定） | material fact をすべて買い、reserve の属性まで買えば「sauce 無し」を演繹できる | 「答えを全部買った後の演繹」。OD-TQ-P2 で許容/除外を決める（推奨: 許容） |
| Hint 2.0 step（H0〜H4） | no-sauce target には SAUCE 行が出ない（構造上の手掛かり）。production で見えるのは Dex 0 onboarding と legacy 購入済みレベルだけで、Aussie に legacy 購入は存在しない → 到達不能と判断 | TQ-1D の Fresh Audit で到達不能を再確認 |
| free cook の SAUCE 文言「なしでもOK」 | affordance の明示（操作できること）であって、どのピザになるかは言わない | 許容（OD-TQ-16） |
| Technique Dex の「？？？」なぞかけ | 固定の一行。例: 「いつもの“ぬるもの”がなくても…？」 | 具体操作に近いので、なぞかけを出すタイミング＝affordance 到達後に限定（OD-TQ-5 を維持） |

### 7.3 ルール（OD-TQ-P1、pure function として TQ-1A で定義し TQ-1C で wiring）

> near-miss の最近傍 target が、**未発見技法を要求し**、かつ出力 class がその技法の軸を示す（SAUCE_ONLY → NO_SAUCE、将来は late / spread 軸）場合:
>
> - 整合する具体的な答えの数 k（所持ソースのうち使った以外のもの＋「なし」）が 2 未満なら、class を **`SOMETHING_DIFFERENT`**（新設。文言「おしい！あと少し、なにかが違うみたい…？」）に落とす。
> - 技法名、「ソース」「焼いた後」などの軸名は出さない。
> - 技法が発見済みなら、既存どおり SAUCE_ONLY を出す。

所持ソースは単調増加なので、一度 k≥2 で出した文言が後で k<2 になることはない（DH4 と同じ単調安全）。

---

## 8. 同時発生の順序と二重処理の監査

**固定する順序:** 1 回の `REGISTER_TO_DEX`（既存の `phase === "RESULT"` guard、RESULT→DISCOVERED）の中で、次を**同じ reducer 遷移で**行う。

1. 技法検出（`detectTechniquesUsed(signature)` × affordance gate または recipe 経由）
2. 台帳更新
3. Dex 登録
4. Pitz 加算

演出は DISCOVERED overlay で **技法段 → レシピ段（Pitz summary を含む）** の順。

| 観点 | 挙動 | 二重処理の有無 |
|---|---|---|
| save | App の `persistProgress` が dex / pitz / 台帳を 1 回の read-patch-write で書く。台帳は union merge（`writeSave` の他 ledger と同形） | なし（1 遷移 = 1 書き込み） |
| overlay | `lastTechniqueDiscovery`（transient、`lastDiscovery` と同じ扱い）。save されない → reload 後に再表示されない | なし |
| Pitz | 技法は Pitz を加算しない（OD-TQ-7）。レシピ分は既存の exactly-once guard のまま | なし |
| ★ / BEST | レシピ側だけ。技法は★を持たない | なし |
| Dex | 既存の `registerScoreToDex` / `registerDiscoveryToDex` のまま | なし |
| retry | DISCOVERED から RETRY → 新しいラウンド。台帳に既にあるので再発見しない（INV-TQ-2） | なし |
| reload（DISCOVERED 表示中） | save 済み。overlay は消えるが、Dex の「調理法」欄には記録済み | なし |
| reload（CONFIRM_BAKE 後・REGISTER 前） | FREE は `handleConfirmBake` で即 REGISTER。万一この間に落ちても、何も書かれない（レシピと同じ挙動） | なし |
| ORIGINAL 経路 | 既存の `state.freeCook && !state.score` 分岐の中で技法だけを記録し、Dex / Pitz は触らない | なし |
| Lunch Rush / guided | 検出しない。guided の Aussie は発見済みなので、技法も INV-TQ-1 で既知 | — |
| Dinner | `REGISTER_TO_DEX` 自体を拒否する（DM-2 OD-DM-11）→ **技法検出もしない**（49b0976 の OD-TQ-10「Dinner も検出」を撤回、§11） | — |

---

## 9. Wave 2 との依存と最小安全実装順

### 9.1 共有するもの（どちらの PR にも入れず、基盤 slice として先に出す）

| 基盤 | 使う側 | 決定 |
|---|---|---|
| **LAD-1 append-only ladder**（W1 1–24 固定、25 以降に append。新材料のないレシピは step を持たない） | TQ-1D（Aussie）、Wave 2 全案 | OD-W2-1 (b) |
| **TQ-1B no-sauce scoring profile**（案 B） | TQ-1D（Aussie）、W2-C、W2-E、将来の piadina / argentine | OD-TQ-S1 ＝ OD-W2-8 の回答（同じ決定を 1 回で行う） |
| NO_CUT profile（dough evidence なし → CUT allowlist に入れない） | Aussie、W2 の多数 | OD-W2-4（維持）。追加コードなし（allowlist に載せないだけ） |

**W2-C と TQ-1 の関係:** 同じ mechanic を共有するが、所有を分ける。

- 技法検出・台帳は **TQ-1 が所有**する。
- no-sauce scoring は **TQ-1B（共有基盤）**。
- **Aussie は TQ-1 のレシピ**。W2-C の recipe set から外す（W2-C は残りの no-sauce 行を追加する recipe expansion）。
- W2-C のレシピは sauceBase=[] から NO_SAUCE を**自動で要求する**（派生）。したがって W2-C は技法コードを 1 行も書かない。

### 9.2 実装 slice（依存・変更ファイル候補・test gate・revert）

| Slice | 内容 | 依存 | 変更ファイル候補 | Test gate | Revert |
|---|---|---|---|---|---|
| **TQ-0** | Owner Decisions / SSOT（本 PR 系列、docs のみ） | — | docs / data / tools | 各ツールの `--check` | docs のみ |
| **LAD-1** | append-only ladder（Wave 2 と共有） | OD-W2-1 | `src/data/discoveryLadder.ts`、`src/logic/testSupport/discoveryLadderRule.ts`、`discoveryLadder.test.ts` | W1 24 step の pin が不変、append の決定性、既存の reachability test | 単独 revert 可（RECIPES が 25 のままなら結果は同じ） |
| **TQ-1A** | 技法 ID registry、pure detection、requiredTechniques の派生、near-miss privacy rule（pure）、save model（sanitize / forward-compat / union / backfill）。**production 未配線** | TQ-0 | 新規 `src/data/techniques.ts`、`src/logic/techniques/*`、`src/state/persistence.ts`（KNOWN_SAVE_KEYS・sanitizer・extras・writeSave） | unit: 検出、INV-TQ-NB（静的＋property）、INV-TQ-4、persistence（§10 の全ケース）、INV-TQ-5 の pure 版 | 新規ファイル削除＋persistence の差分 revert。書かれた key は旧 build でも保持される |
| **TQ-1B** | no-sauce scoring（案 B）。`ReferencePizza.sauce` を nullable にし、null ガード。**既存 recipe の score 不変** | OD-TQ-S1 | `src/logic/scoringV2/index.ts`・`types.ts`、`src/data/referencePizza.ts`、`src/logic/completionGate.ts`、null ガードのみ: `ReferencePreview.tsx`・`DinnerGameUi.tsx`・`GameScreen.tsx`・`App.tsx` | golden（25×fixture 不変）、synthetic の no-sauce fixture で B の式、Completion Gate、型検査。**見た目の変化なし → HV 不要**（ポリシー対象外であることを Result Report に明記） | 単独 revert 可（no-sauce recipe が存在しない間は到達不能） |
| **TQ-1C** | runtime wiring: REGISTER_TO_DEX で技法検出、台帳、`lastTechniqueDiscovery`、load 時 backfill、affordance gate（ladder から派生）、near-miss privacy の wiring。**Aussie はまだ入れない → INV-TQ-4 によって production では不活性** | TQ-1A、TQ-1B、LAD-1 | `src/state/gameReducer.ts`、`src/state/resultNearMiss.ts`、`App.tsx`（persist の引数） | reducer: 同時発生、ORIGINAL 経路、二重 dispatch、retry、Dinner / Lunch Rush で検出しないこと。synthetic catalog で全ループ | 単独 revert 可（不活性なので） |
| **TQ-1D** | 表示と内容: Aussie（recipe・reference（sauce null）・catalog id・CUT なし）、DISCOVERED の技法段、Pizza Dex の「調理法」欄（？？？／発見済み）、RESULT の sauce 行「なし」、`SOMETHING_DIFFERENT` 文言。**ここで初めてループが production で有効になる** | TQ-1C、OD-TQ-4/5/P1、OD-W2-4 | `src/data/recipes.ts`・`referencePizza.ts`・`discoveryCatalog.ts`、Dex / DISCOVERED / Result コンポーネント、CSS、e2e | unit ＋ e2e（free cook でソースを飛ばして Aussie → 技法段 → レシピ段 → Dex 記録 → reload → retry）、`RECIPES` pin の更新、HV | 単独 revert でループが無効に戻る。発見済みの Dex / 台帳は forward-compat で保持される |
| **TQ-1E** | Human Verification（390×844 動画は直接納品、before/after スクショは commit）。確認観点: 未発見 → ソースを飛ばして試す → 技法段 → レシピ段 → Dex、k=1 状況での near-miss 文言、オージーの★の体感（R-S1） | TQ-1D | docs / reports、screenshots | ポリシー準拠 | — |

**production 露出:** main merge = deploy なので、ループが半端な状態で出ないよう、有効化は TQ-1D の 1 PR に集約する（1C までは INV-TQ-4 で不活性）。TQ-1D と TQ-1E は同じ PR でもよい（HV はその PR の DoD）。

**その後:** TQ-2（後乗せ: FINISH gameplay ＋ late 軸 OBSERVED ＋ DIMENSION near-miss ＋ content）、TQ-3（複数 spread: SAUCE 2 層、Wave 2 W2-D と共有基盤化）。

### 9.3 最小安全実装順

```
TQ-0 (docs) ─┬─ LAD-1 (append-only ladder, shared) ────────┐
             ├─ TQ-1A (pure, unwired) ─────────────────────┤
             └─ TQ-1B (no-sauce scoring, score-invariant) ─┴─> TQ-1C (wiring, inert) ─> TQ-1D+E (Aussie + UI + HV: loop live)
                                                                                           └─> Wave 2 (W2-A / W2-C recipe expansion, Aussie excluded)
```

LAD-1 / TQ-1A / TQ-1B は互いに独立しているので並行できる。ただし全部 `src` を触るので、merge は順番に行う。

---

## 10. `discoveredTechniqueIds` の save 監査

**形:** `PersistentSaveV2.discoveredTechniqueIds: string[]`（schema bump なし。`discoveryHintFacts` などと同じ「無ければ空」パターン）。技法 id は `no-sauce`、`post-bake`、`double-spread` のような kebab 形で、`FORWARD_COMPAT_ID_PATTERN` に収まる。

| ケース | 挙動（現行 persistence の仕組みで確認） | 必要な test |
|---|---|---|
| 旧 save（キーなし） | `[]` として読み、ロード時に backfill（INV-TQ-1）。現行 Dex に技法レシピはないので no-op | v1 / v2 / キー欠落 |
| 壊れた値（非配列、数値、`__proto__`、空文字、重複） | sanitizer で既知 id に絞り、重複を除去する。既知でも形が不正なら捨てる。root の他 field は無傷 | hostile 値の table test |
| **unknown ID の保持**（新しい build が書いた `post-bake` など） | `extractForwardCompatExtras` に `discoveredTechniqueIds: unknownIdsIn(raw, KNOWN_TECHNIQUE_IDS)` を追加し、`writeSave` で append merge | 旧→新→旧の往復 |
| **旧 build との往復**（TQ 以前の build が新 save を読んで書く） | P3-4B 以降の build は未知の top-level key を**そのまま保持**する（`topLevel`）→ 台帳は消えない。P3-4B より前の build では消えるが、次のロードで Dex から backfill されて復元される（技法レシピ経由の分）。ORIGINAL 経由で得た技法だけは失われる（許容。OD-TQ-13） | 旧 build をシミュレートした write |
| Full Reset | `resetSave` = key ごと削除 → 台帳も消える。affordance は派生なので別途リセット不要 | Full Reset 後に `[]` |
| 将来の技法 ID | registry に無い id は gameplay で無視し、storage には保持 | 上と同じ |
| exactly-once | REGISTER_TO_DEX の RESULT guard ＋ 台帳の union（冪等） | 二重 dispatch、再ロード後の再 bake |
| 上限 | 64 件（保存形式の上限。現実には 12 前後） | 超過の切り捨て |

---

## 11. 49b0976 からの修正点（この gate で変えたもの）

| 49b0976 の記述 | 修正 |
|---|---|
| OD-TQ-10「free cook ＋ Dinner で検出」 | **free cook のみ**。Dinner は REGISTER_TO_DEX 自体を拒否する設計（OD-DM-11）なので、技法だけ別経路で書くと exactly-once の境界が増える |
| §10「`ProgressionStepKind += TECHNIQUE_SLOT`」 | **TQ-1 では新しい step kind を足さない。** affordance ＝「その技法を要求する runtime recipe が、ladder で解放済みの材料だけで作れるようになる最初の step」として**派生**させる（Aussie → step 12）。ladder data も Wave 2 との衝突も増えない。TQ-2 以降で UI の余地が必要になった時に再検討 |
| OD-TQ-6（near-miss の DIMENSION_MISMATCH） | 既存 SAUCE_ONLY の k=1 漏れを発見 → OD-TQ-P1（§7.3）の抑制ルールを追加 |
| scoring「実装監査で確認」 | 案 B に確定して推奨（§4） |
| ladder「再生成して slot を置く」 | **append-only が前提**（§5） |

---

## 12. Owner Decisions（最終確認用）

### 12.1 Owner 方針候補の追認（本 gate の監査結果）

| ID | 方針 | 監査結果 |
|---|---|---|
| OD-TQ-1 | ⭐で解放して Teto が教える方式は採用しない。progression は余地だけ、発見はプレイで | 採用可。INV-TQ-NB / INV-TQ-6 で実装上も成立する |
| OD-TQ-2 | 技法: ソースなし・後乗せ・複数 spread／後段: 形状・pan・包む ほか／非技法: 焼く前・特殊ソース・生地種類・piadina・CUTなし | **172 evidence と矛盾なし**（§2、C1〜C6 すべて True） |
| OD-TQ-4 / 5 | Pizza Dex 内に「調理法」欄。未発見は「？？？」＋なぞかけ | 採用可。なぞかけは affordance 到達後だけ表示 |
| OD-TQ-6 | Hint は未発見技法を売らない。near-miss guidance は許可 | 採用可。**ただし OD-TQ-P1 の k≥2 抑制が必須** |
| OD-TQ-7 | 技法発見に ⭐ / Pitz なし | 採用可。二重処理なし（§8） |
| OD-TQ-12 | 推測の post-bake 行は昇格しない | 採用可。data 上で分離済み（C6） |
| OD-TQ-15 | TQ-1 = ソースなし | 採用可。**レシピはオージー 1 品のみが適格** |

### 12.2 新たに決めること

| ID | 決めること | 推奨 |
|---|---|---|
| **OD-TQ-S1** ★hard | no-sauce scoring 方式（＝ Wave 2 OD-W2-8 の回答も兼ねる） | **案 B**（sauce 52 → pieces。`reference.sauce === null` の時だけ） |
| OD-TQ-S2 | `SCORING_V2_RULESET_VERSION` の bump | しない（既存結果は不変、保存もされない） |
| OD-TQ-S3 | `LUNCH_RUSH_RULESET_VERSION` の bump | しない（mission の式は不変。W1 の前例あり） |
| **OD-W2-1** ★hard | ladder を再生成するか append-only にするか | **(b) append-only**（再生成すると W1 の順番が step 3 から変わる） |
| **OD-TQ-P1** ★hard | near-miss の k≥2 抑制と新 class `SOMETHING_DIFFERENT`（文言「おしい！あと少し、なにかが違うみたい…？」） | 採用（Aussie と同じ PR で有効化） |
| OD-TQ-P2 | DH4 structure による「全部買った後の演繹」を技法 target でも許すか | 許容（答えを全部買った後の演繹であり、技法を売っていない） |
| OD-TQ-16 | free cook の「なしでもOK」文言を残すか | 残す（affordance の明示であり答えではない。NO_SAUCE は驚きの小さい「ループ実証用」技法と位置付ける） |
| OD-TQ-17 | 技法の表示名 | 「ソースなし」（候補:「ぬらないピザ」）。Owner が文言を決める |
| OD-TQ-18 | オージーの採用（CUT なし、nameJa / description / minCount / bakeTarget は authoring で決定） | 採用。Wave 2 W2-C から外す |
| OD-TQ-10（改） | 技法検出は free cook のみ（Dinner は対象外） | 採用 |
| OD-TQ-19 | TQ-1 の slice 分割（LAD-1、1A、1B、1C（不活性）、1D+E で有効化） | 採用 |

### 12.3 未決事項（TQ-1 を止めない）

- オージーの authoring 値（nameJa / 説明 / minCount / bakeTarget / reference の piece 配置）→ TQ-1D の authoring で決める。
- Technique Dex の見た目（チップかカードか）→ TQ-1D の Fresh Audit と HV。
- pieces 68% の★の体感（R-S1）→ TQ-1E の HV で確認する。外れていれば pieces の tolerance を別 slice で調整する（sauce 側の式は触らない）。
- `recipeChapters` での Aussie の章割り → TQ-1D で確認。
- Hint 2.0 の構造上の手掛かりが到達不能であることの再確認 → TQ-1D。
- 後乗せ（TQ-2）の content（BBQチキンの材料 3 つ）と、page-8 の推測行の evidence 再確認 → 別タスク。

---

## 13. mechanic_matrix drift（修正しない。follow-up Issue 候補）

- **事象:** `python3 tools/progression2_mechanic_matrix.py --check` が clean な main（`51e0923`）でも「committed JSON differs from a fresh deterministic regeneration」で fail する。
- **原因（一時的に再生成して特定し、元に戻した）:** tool が `src/data/recipes.ts` / `ingredients.ts` を読み直すため、W1（I5b-3）で増えた 10 recipes / 7 ingredients の分だけ次の派生 field がずれる。**172 行のエビデンス・分類・capability は不変。**
  - `shippedRecipeIdsInSrc`
  - `ingredientIdsNotYetInShippedGame`（148 → 141）
  - 行ごとの `newContentIngredientIds`
- **本 gate への影響:** なし。本ツールは matrix のエビデンス field だけを読み、runtime の差分は `src` から独自に計算している。
- **重複確認:** Issue 検索（mechanic matrix drift / regeneration）は 0 件。Wave 2 設計（`e009da2`、未 PR）の §9 が同じ事象を記録しているだけ。
- **Issue 候補（未作成）:** 「tools/progression2_mechanic_matrix.py --check が W1 後の src で fail する — src 由来の派生 field を matrix JSON から切り離すか、`--check` を src snapshot 固定にする」。選択肢は (a) JSON を再生成して commit、(b) src 由来 field を別ファイルに分離。推奨は (b)。

---

## 14. リスク

| # | リスク | 対策 |
|---|---|---|
| R-S1 | 案 B で pieces が 68% を占め、pieces の tolerance の粗さが★に強く出る | TQ-1E の HV で確認。調整は pieces 側の別 slice |
| R-L1 | LAD-1 が Wave 2 と TQ の両方の前提なので、順番を誤ると W1 順が変わる | LAD-1 を最初に merge する。「W1 24 step 不変」の pin test |
| R-P1 | k の計算は「所持品」が前提。将来ソースが 1 種しかない新規 save 状態で技法 target が出ると、常に抑制される | 抑制されても `SOMETHING_DIFFERENT` は出る（導線は消えない）。Teto の tier 3 救済は 49b0976 §8 のまま |
| R-U1 | TQ-1C を出した後、TQ-1D までに時間が空く | INV-TQ-4 によって production では不活性。test で固定 |
| R-W1 | Wave 2 が Aussie を重複して足す | OD-TQ-18 で W2-C から除外し、Wave 2 のツールに exclude list を渡す |

---

**STOP.** src / CSS / e2e は変更していない。PR 作成・merge・deploy もしていない。Owner の最終決定（特に ★hard の 3 件）を待つ。
