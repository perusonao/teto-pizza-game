# Progression 2.0 Phase 3-4 Production — Pre-Implementation Audit

- 監査日: 2026-09-23
- 監査対象 `origin/main`: `1e73a7d3e6007e67d1d2ea14e103a47c491bdbd5`（PR #199 Phase 3-3 merge）
- Branch: `claude/teto-phase-3-4-audit-gwskdy`（docs-only）
- 親 Issue: #182（Progression 2.0）。前提 authority: #195 / PR #196（Phase 3-4 unlock/price 設計、MERGED）
- 成果物:
  - 本レポート
  - `docs/reports/PROGRESSION-2.0_PHASE-3-4_Implementation-Matrix.json`（機能 matrix、owner decision、slice、risk の machine-readable 版）
  - `docs/reports/data/PROGRESSION-2.0_PHASE-3-4_Progression-Graph.json`（依存グラフと economy path。生成物）
  - `docs/reports/data/PROGRESSION-2.0_PHASE-3-4_audit_graph.py`（上記 JSON の生成・検証スクリプト。docs 配下に置いた読み取り専用ツール）

> **Scope:** 調査、設計、PR 分割、docs だけを扱う。`src/**`、`e2e/**`、`functions/**`、`.github/**`、
> 経済値、価格、recipe/ingredient 定義、scoring、ranking、save schema は一切変更していない。
> PR #202 と Issue #200/#201 にも触れていない。

---

## 0. GitHub 実状態（監査開始時に確認）

| 項目 | 状態 |
|---|---|
| `origin/main` | `1e73a7d` Progression 2.0 Phase 3-3: 0-recipe onboarding (#199) |
| OPEN PR | #202（Issue #200、Lunch Rush pool、head `7376714`）、#105（draft、automation）、#72、#46、#34、#3。Phase 3-4 Production audit の PR は**存在しない**（重複なし） |
| OPEN Issue | #201（CI/WebKit）、#200（Lunch Rush pool）、#182（Progression 2.0 親）、ほか既存の roadmap issue。Phase 3-4 Production audit と重複する issue は**ない** |
| Issue #200 | 方針 **DISCOVERED_ONLY_MISSION_POOL**（`discovered ∩ available`）は決定済み。実装 PR #202 は **OPEN・未 merge** |
| PR #202 | 変更するのは `src/mission/lunchRush.ts`、`src/state/gameReducer.ts`（`nextMissionOrderState`）とテスト 8 本。**本監査では main に存在しないものとして扱う** |
| Issue #201 | A0 Fresh Audit まで完了。A1/A2（classifier と conditional WebKit）は未実装。`.github/workflows/**` を変更する予定 |

**依存関係の記録:** Phase 3-4 は Lunch Rush pool policy として **DISCOVERED_ONLY_MISSION_POOL**
（`discovered ∩ available`、空なら fail-closed）を前提にする。`gameReducer.ts` を触る slice は、
PR #202 の merge 後に開始する（§7）。

---

## 1. 結論（TL;DR）

1. **Authority は健全。** Phase 3-4 JSON（105 材料、initial OWNED 3、purchasable 102、全 128
   node、101 target）を独立に再検証した。star deadlock は 0、prerequisite 違反は 0、dead node は 0、
   gate は sequence 順に単調で、starter だけで作れる target は Margherita のみ。Pitz の循環はない
   （Margherita は在庫を消費せず、必ず ★1 floor の 20 Pitz 以上を払う）。
   `tools/progression2_phase34_unlocks.py --check` と `tools/progression2_phase2_progression.py --check`
   は main で PASS。
2. **Production は authority の 15/101 しか持っていない。** runtime には recipe 15 件と ingredient
   22 件しかない。進行ルールは旧 EP1（recipe chain `requiresRecipeId`）と EP4（recipe unlock 時の
   Starter Grant。`starterGrantOnly` の材料は買えない）のまま。Phase 3-4 の中核は「ルールの cutover」。
3. **P0（実装前に設計で潰すべきもの）が 3 件ある。**
   - **R-01:** authority の gate を入れても EP1 chain を残すと、Margherita 直後に deadlock する。
     chain が次に許すのは funghi だけで、その mushroom の gate は ⭐10、Margherita 1 枚では最大 ⭐5。
   - **R-02:** authority の gate をそのまま現行 15 recipe に当てると、保証最低 ⭐（2/発見）では
     marinara、napoletana、pizza-bianca、genovese、quattro-formaggi の **5 件に到達できない**
     （garlic ⭐28、anchovy ⭐40、rosemary ⭐48、cherry-tomato ⭐76、gorgonzola/fontina ⭐102 に対し、
     到達できる ⭐ は 20〜26）。authority の gate は 101 件の母集団を前提に作られているため。
     このうち **genovese と quattro-formaggi は、全発見を ★5 にした理論最大（65⭐）でも届かない
     hard lock** で、BEST を上げても解消しない。残り 3 件は BEST を上げれば届く skill lock。
     → **owner decision OD-03（content projection policy）が必要。**
   - **R-03:** recipe unlock を撤去して recipe-keyed Starter Grant を残すと、load 時に全 recipe の
     材料が無料配布される。
   - → R-01 と R-03 は、**3-4C を 1 つの atomic PR にする**ことで構造的に防ぐ。
4. **Economy に hard-lock はない（authority 上）。** 序盤（early tier、sequence 23 まで）は、★1
   プレイヤーでも「1 発見で 70 Pitz ≥ 次の材料 60 Pitz」になるため、grind は 0 回。最初の grind は
   low-score で 48 発見後（cilantro 購入前に 3 回）。「同じピザを何十回も焼く」状態は、authority の
   low-score 終盤で最大 25 bake の無発見区間（P2、authority 承認済みの範囲）に限られる。
5. **推奨する最初の slice は 3-4A**（headless の progression rules foundation。未配線なので
   production の挙動は変わらない）。OD-03 の判断を待たずに開始でき、PR #202 や #201 とも file が
   重ならない。

---

## 2. Authority の Fresh Audit

### 2.1 OD-01 SHIPPED_KEEP

- Ledger: `docs/design/TETO_PROGRESSION2_PHASE34_OWNER-DECISION-LEDGER.md`。**APPROVED**
  （perusonao、PR #196 comment、2026-09-23）。
- 意味: 出荷済み recipe の構成を 101-target overlay として保持する（`shipped:*` 14 件と
  `tonno-e-cipolla-pizzadb`）。starter trio だけで Margherita を発見できる、という loop を保証する。
- 実装との整合: `src/data/discoveryCatalog.ts` の 15 target は Phase-2 JSON の `SHIPPED_KEEP` と一致
  する（`discoveryCatalog.test.ts` が pin している）。監査スクリプトでも、15 recipe すべての
  ingredient set が JSON の target items と一致することを assert した。**整合 OK。**

### 2.2 OD-02 Pitz（★1 floor 20 / First Discovery Bonus 50）

- Authority の reward table は `FLOOR_DISCOVERY_BONUS`（base 100、mult ★1..★5 = 0.2/0.5/0.8/1.0/1.2、
  discoveryBonus 50）。
- 実装（`src/logic/pitzReward.ts`）: `PITZ_QUALITY_FLOOR = 20`、`PITZ_FIRST_DISCOVERY_BONUS = 50`。
  ★1 の mult は 0 だが `max(20, …)` の floor が掛かるので、★1..★5 すべてで authority と**数値が
  一致**する（20/50/80/100/120 と、初回のみ +50）。FREE のみ。Lunch Rush の
  `calculateMissionReward`（40 + quality + serve、最大 140）とは分離されたまま。
- 差分: authority の table は `originalPizzaPays: true` だが、金額の指定がない。production の
  ORIGINAL は 0 Pitz（P3-3 が意図的に follow-up とした）。authority 自身が「recommended profile は
  ORIGINAL 収入を必要としない」と明記しているため、**P2**。

### 2.3 S10_R10

`policy.stockPolicy = S10_R10` の中身は、purchaseGrantPortions 10、refillPortions 10、
refillPriceFactor 0.5。starter trio は `UNLIMITED`。dough/pan/capability は `NON_CONSUMABLE`。
Stock の単位は **portion（1 枚分）**。production の inventory は **piece 単位**（scatter は 1 片で
1 消費）なので、単位換算が必要になる（Phase-2 の C-01 が「実装詳細」と明記、§6 R-07）。

### 2.4 Progression ⭐（hybrid）

`G4_HYBRID_060`: 発見ごとに +2、BEST が ★3/★4/★5 に届くたびに各 +1。
**整理すると 1 recipe あたり `max(2, BEST)`、合計は `Σ max(2, BEST)`**（★1→2、★2→2、★3→3、★4→4、
★5→5）。gate は `2 × ceil(0.6 × その step より前に発見可能な数)`。production の
`mastery.totalStars` は `Σ BEST`（legacy）なので、hybrid より常に小さいか等しい。
**この差分は既存 save に有利に働く**（切り替えても gate が再 lock されない）。

### 2.5 Dataset（最新 repo で再カウント）

| 項目 | Authority（Phase 3-4 JSON） | Production（`src/data/*` @ `1e73a7d`） |
|---|---:|---:|
| Ingredients | **105**（initial OWNED **3**、purchasable **102**） | **22**（unlimited starter 3、starterGrantOnly 19） |
| 全 unlock node | **128**（ingredient 105、dough 10、pan 3、capability 10） | — |
| Target recipes | **101**（evidence-ready 87 + shipped overlay 14） | **15** |
| Tier の価格 | early 60、mid 100、late 140、endgame 180 | 55〜170（材料ごとの legacy 値） |
| Condition type | `CUMULATIVE_STARS` 125、`INITIAL_OWNED` 3 | ingredient `minTotalStars`（onion 12、他は 0）と recipe の EP1 chain |

これは旧 53/62 dataset ではない。旧 53-entry catalog は Phase 0〜2 で 172 行の PIZZA DB 母集団に
置き換わっており、101 target はそのうち evidence-ready の 87 件と shipped の 14 件である。

---

## 3. Current Implementation Matrix

凡例: **P0** は Phase 3-4 着手時に設計で必ず潰すもの、**P1** は Phase 3-4 の中で解消するもの、
**P2** は後回しでよいもの。machine-readable 版は `Implementation-Matrix.json#features`。

| 機能 | Design Authority | Current Implementation | Test | Gap | Phase 3-4 対応 |
|---|---|---|---|---|---|
| Dex | discovered target + BEST★、101 target | `state/dex.ts`、15 RecipeId。未知 id は sanitizer が捨てる | dex, persistence | 101 中 15 のみ | tranche に追従（3-4G）、未知 id を保持（3-4B） |
| Recipe discovery | PASS free-cook の exact match のみ | matcher と `REGISTER_TO_DEX`（P3-1/2） | gameReducer.discovery, discoveryCatalog | なし | 変更なし |
| Signature matching | exact signature。superset は ORIGINAL | catalog は RECIPES から導出、capability なし | discoveryCatalog parity | capability 次元がまだない | 3-4 では変更なし |
| Free Cooking | OWNED 材料すべてから選べる、stock gate あり | `START_FREE_COOK`、OWNED tray を 6 件ずつページング | freeCook, FreeCook.ui, e2e P3-2 | なし | 変更なし |
| First discovery | NEW → ⭐+2(+quality)、+50 Pitz | NEW path、+50 実装済み | pitzReward 系 | 表示される ⭐ が ΣBEST | 3-4A/C/E |
| Repeat discovery | KNOWN → Pitz のみ | 実装済み | discovery | なし | 変更なし |
| Quality stars | ★1–5（90/75/60/40） | `starsFromTotal` | scoring | なし | 変更なし |
| Progression ⭐ | hybrid Σmax(2,BEST) | ΣBEST | mastery | **P0** | 3-4A 追加、3-4C 切替 |
| Pitz reward | 100×mult、★1 floor 20 | 数値は一致 | pitzReward | なし | 変更なし |
| First discovery bonus | +50 | 50 | pitzReward, ResultPanel | なし | 変更なし |
| ORIGINAL Pitz | originalPizzaPays（金額未指定） | 0 | freeCook | **P2** | 対象外（owner 数値待ち） |
| Ingredient OWNED | LOCKED→AVAILABLE→OWNED | EP4 grant 経由。19 件すべて購入不可 | progression, economy | **P0** | 3-4A → 3-4C |
| Inventory | S10_R10（portion 単位） | piece 単位、restock 3〜12 片を定価で | inventory, restock | **P1** 単位差 | 3-4A 換算、3-4C 適用 |
| Starter Grant | 廃止（購入時付与へ） | recipe unlock 時に付与、ledger 永続化 | starterStock | **P0**（atomic） | 3-4C |
| Ingredient availability | ⭐ gate と prerequisite | ΣBEST と minTotalStars | progression | **P0** | 3-4C |
| Ingredient purchase | Pitz → OWNED + 10 portion | starterGrantOnly は `NOT_FOR_SALE` | economy | **P0** | 3-4A → 3-4C |
| Ingredient price | 60/100/140/180 | 55〜170。19 件すべて不一致 | ingredients | 値の差 | 3-4C（JSON からコピー、新しい数値は作らない） |
| Unlock condition | recipe には無し、ingredient は ⭐ | recipe に EP1 chain | progression, pizzaSelect | **P0**（R-01） | 3-4C |
| availableRecipeIds | 全 item OWNED | EP1 AND owned | progression | **P0** | 3-4C |
| Recipe Select | discovered の guided replay | EP1 の「あと★N」表示 | pizzaSelect | **P1** | 3-4C（state）、3-4E（copy） |
| Lunch Rush unlock | Dex ≥ 1 | 実装済み（P3-3） | App, e2e | なし | 変更なし |
| Lunch Rush pool | discovered ∩ available（#200） | main は available と全件 fallback。**#202 OPEN** | lunchRush | 依存。**P1** stock 非対応 | #202、3-4F |
| Save persistence | ⭐ は派生、owned は永続 | v2 | persistence | 新 field 不要 | schema bump なし |
| Save migration | C-04 grandfather | v1→v2 のみ | persistence | **P1** rollback 時に未知 id が消える | 3-4B |
| Existing saves | 進行を後退させない | EP1/EP4 の owned | e2e existing-save | transition 規則が未定義 | 3-4B 規定、3-4C 適用 |
| HOME guidance | 「次に何を」が自然に分かる | Dex 0 の onboarding のみ | HomeScreen | **P1** | 3-4E |
| Shop | LOCKED/AVAILABLE/OWNED と補充 | 未所有の grant 材料を隠す、補充のみ | Shop/Inventory | **P0**（3-4C 時）、**P1** UX | 3-4C 最小、3-4D |
| Result | Pitz 内訳、⭐ 増分 | Pitz 内訳あり | ResultPanel | **P2** ⭐/次 unlock | 3-4E |
| DISCOVERED | NEW 演出 | あり | e2e | **P2** 新入荷を出さない | 3-4E |
| Ranking boundary | 経済と独立 | shared/functions | lunchRushScoring | なし | 触らない |
| Mission scoring boundary | Mission score と Pitz を分離 | 分離済み | missionScoring, economy | なし | 触らない（3-4F は pool のみ） |

---

## 4. Progression Graph 監査

生成物: `docs/reports/data/PROGRESSION-2.0_PHASE-3-4_Progression-Graph.json`

- `targetDependencyMatrix`: 101 件。各 recipe について、必要な items と capabilities、
  prerequisite を含む必要 node、必要な購入とその合計 Pitz、⭐ gate、到達 sequence を持つ。
- `starSupplyChecks`: 125 件（初期 OWNED 以外の全 node）。
- `productionProjection`: 現行 15 recipe と 22 ingredient への投影。

### 4.1 Authority graph（101 target / 128 node）

| 検査 | 結果 |
|---|---|
| Unreachable recipe | **0** |
| Circular dependency（prerequisite） | **0**。dough:* → `DOUGH_VARIANT`、pan:* → `PAN_BAKE` の 2 系統だけで、どちらも前方参照なし |
| Ingredient unlock deadlock（⭐ 保証供給 < gate） | **0 / 125**。各 node で `2 × (それ以前に発見可能な target 数) ≥ gate` |
| Recipe unlock deadlock | **該当なし**。authority の recipe は unlock 条件を持たない（所有から派生） |
| Pitz 不足による hard-lock | **なし**。Margherita は unlimited の starter trio だけで作れて在庫を消費せず、PASS すれば必ず ≥20 Pitz |
| Starter material 不足 | **なし**。starter だけで作れる target は Margherita（1 件）で、それで十分 |
| 発見不能なのに unlock 条件になっている recipe | **なし**（authority の条件は `CUMULATIVE_STARS` と `PREREQUISITE_OWNED` だけ） |
| OWNED にならない必須材料 | **0**（target が参照する node はすべて matrix の行にある） |
| Shop に出ない必須材料 | **0**（purchasable node はすべて正の整数価格を持つ） |
| Dead node（どの target も使わない） | **0** |
| Gate の単調性（sequence 順） | **OK** |

到達経路（authority の standard profile の先頭部分）:

```
Dex0 → Margherita（starter）
     → egg(⭐2,60) → Bismarck
     → bacon(⭐2,60) → Breakfast
     → onion(⭐2,60) → Aussie*
     → pepperoni(⭐6) → Pepperoni
     → sausage(⭐6) → Salsiccia
     → ham(⭐6) → Meat Lovers
     → black-olive(⭐10) → Portuguesa*
     → mushroom(⭐10) → Funghi
     → oregano(⭐10) → Calabresa*, Capricciosa
     → fresh-tomato*(⭐14) → Chilena*
     → olive-oil(⭐14) → Fugazza
     → feta*(⭐14) → Feta Eliniki* → …
（* は production に未実装の recipe または材料）
```

### 4.2 Production への投影（authority の gate を現行 15 recipe に適用した場合）

| ⭐ 獲得モデル | 発見できる数 | 到達不能 |
|---|---:|---|
| 保証最低（2/発見、★1–2） | 10/15 | marinara, napoletana, pizza-bianca, genovese, quattro-formaggi |
| standard（3/発見） | 11/15 | genovese, napoletana, pizza-bianca, quattro-formaggi |
| skilled（4/発見） | 13/15 | genovese, quattro-formaggi |
| 理論最大（5/発見） | 13/15 | genovese, quattro-formaggi |

T1 tranche（§7 3-4G。新材料 0 で作れる PIZZA DB 3 件: aussie、portuguesa、brazilian-calabresa）を
加えた 18 件の pool でも、保証最低では **13/18**。同じ 5 件が残る
（`od03OptionA_authorityVerbatimWithT1Pool`）。

現行 15 recipe の authority 上の位置（到達 sequence / gate / 必要購入）:

| recipe | seq | ⭐ gate | 必要購入（Pitz） |
|---|---:|---:|---|
| margherita | 3 | 0 | —（0） |
| bismarck | 4 | 2 | egg（60） |
| breakfast-pizza | 5 | 2 | egg, bacon（120） |
| pepperoni | 7 | 6 | pepperoni（60） |
| salsiccia | 8 | 6 | sausage（60） |
| meat-lovers | 9 | 6 | bacon, ham, pepperoni, sausage（240） |
| funghi | 11 | 10 | mushroom（60） |
| capricciosa | 12 | 10 | black-olive, ham, mushroom, oregano（240） |
| fugazza | 14 | 14 | olive-oil, onion, oregano（180） |
| tonno-e-cipolla | 19 | 18 | onion, tuna（120） |
| marinara | 24 | 28 | garlic, oregano（160） |
| napoletana | 32 | 40 | anchovy, oregano（160） |
| pizza-bianca | 39 | 48 | olive-oil, rosemary（160） |
| genovese | 64 | 76 | cherry-tomato, pesto（200） |
| quattro-formaggi | 92 | 102 | fontina, gorgonzola, olive-oil, parmigiano（440） |

→ **R-02（P0）**。authority の gate は 101 件の母集団を前提にしている。runtime の content が
追いつくまで、後半の shipped recipe には 2 種類の lock が生じる（`lockClassification`）:

| recipe | ⭐ gate | 必要な発見数（2⭐/発見） | 必要な発見数（5⭐/発見） | 分類 |
|---|---:|---:|---:|---|
| marinara | 28 | 14 | 6 | **SKILL_LOCK**（BEST を上げれば届く） |
| napoletana | 40 | 20 | 8 | **SKILL_LOCK** |
| pizza-bianca | 48 | 24 | 10 | **SKILL_LOCK** |
| genovese | 76 | 38 | 16 | **HARD_LOCK**（15 件の pool では理論最大 65⭐ でも届かない） |
| quattro-formaggi | 102 | 51 | 21 | **HARD_LOCK**（T1 を足した 18 件の pool でも届かない） |

genovese と quattro-formaggi は、現行 production では ★3 以上なら発見できる出荷済み recipe
である。authority の値を verbatim に入れると、runtime の発見可能数が上表の数に達するまで
**全プレイヤーにとって発見不能**になる（既存 save で発見済みの Dex は残る）。これは content の
regression であり、BEST を上げても解消しない。**OD-03 の決定と、3-4E の end-of-content 表示が
必須。**

### 4.3 現行 production（Phase 3-4 前）の既存 lock

EP1 chain と ΣBEST で、BEST を一定と仮定したとき（`currentProductionEP1ChainConstantBest`）:

| BEST | 発見数 | 停止点 |
|---|---:|---|
| ★1 | 5/15 | quattro-formaggi（⭐8 が必要、保有 5） |
| ★2 | 7/15 | salsiccia（⭐15 が必要、保有 14） |
| ★3–5 | 15/15 | — |

→ 現行 production は ★1/★2 のプレイヤーを既に skill-lock している（**R-09、P1**）。Phase 3-4 の
cutover（hybrid ⭐ と recipe chain 撤去）で解消する。

### 4.4 EP1 chain と authority gate の混在（R-01、P0）

EP1 chain を残したまま ingredient の gate だけ authority 値にすると、Margherita（⭐ 最大 5）の後、
chain が許す次の recipe は funghi だけになる。funghi に必要な mushroom の gate は ⭐10 なので、
**全 profile で deadlock する**。EP4 grant を先に撤去しても同じ。したがって
「recipe unlock の撤去」「Starter Grant の撤去」「gate と価格の適用」は同じ PR で行う（3-4C）。

---

## 5. Economy Progression 監査

※ 数値はすべて authority から再計算したもの。価格は一切変更していない。production の手際ボーナス
（CT2、加算、数 Pitz）は保守側に倒して含めていない。

### 5.1 初回 Margherita 発見直後

| Profile（Margherita BEST） | Pitz 残高 | 以後の Margherita 1 回 | hybrid ⭐ | AVAILABLE_TO_BUY | 即購入できる数 | 3 つ全部買うまでの追加 bake |
|---|---:|---:|---:|---|---:|---:|
| low-score（★1） | **70** | 20 | 2 | egg / bacon / onion @60 | 1（残 10） | 6 |
| beginner（★2） | 100 | 50 | 2 | 同上 | 1（残 40） | 2 |
| standard（★3） | **130**（P3-3 実測は手際込みで 133） | 80 | 3 | 同上 | 2 | 1 |
| skilled（★4） | 150 | 100 | 4 | 同上 | 2 | 1 |
| perfect（★5） | 170 | 120 | 5 | 同上 | 2 | 1 |

「次の recipe の発見に必要な Pitz」は、egg 60 → Bismarck。**全 profile で追加プレイ 0 回。**
Bismarck を発見すると、low-score でも +70（20 + 50）が入るので、次の 60 がそのまま買える。

### 5.2 代表 path（authority simulation、先頭 22 event）

| seq | 購入 | 価格 | ⭐ gate | 新発見 | low-score Pitz 後 | standard Pitz 後 | grind（low/std） |
|---:|---|---:|---:|---|---:|---:|---|
| 0 | （Margherita） | — | — | margherita | 70 | 130 | 0/0 |
| 4 | egg | 60 | 2 | bismarck | 80 | 200 | 0/0 |
| 5 | bacon | 60 | 2 | breakfast | 90 | 270 | 0/0 |
| 6 | onion | 60 | 2 | aussie* | 100 | 340 | 0/0 |
| 7 | pepperoni | 60 | 6 | pepperoni | 110 | 410 | 0/0 |
| 8 | sausage | 60 | 6 | salsiccia | 120 | 480 | 0/0 |
| 9 | ham | 60 | 6 | meat-lovers | 130 | 550 | 0/0 |
| 10 | black-olive | 60 | 10 | portuguesa* | 140 | 620 | 0/0 |
| 11 | mushroom | 60 | 10 | funghi | 150 | 690 | 0/0 |
| 12 | oregano | 60 | 10 | calabresa*, capricciosa | 230 | 890 | 0/0 |
| 13 | fresh-tomato* | 60 | 14 | chilena* | 240 | 960 | 0/0 |
| 14 | olive-oil | 60 | 14 | fugazza | 250 | 1030 | 0/0 |
| 19 | tuna | 60 | 18 | pesto-tonno*, tonno | 360 | 1440 | 0/0 |
| 22 | zucchini* | 60 | 22 | pesto-veg*, ratatouille* | 460 | 1780 | 0/0 |

- **Early tier（sequence ≤ 23）は全 profile で grind 0。** 「1 発見で ≥70 Pitz、次の材料は 60 Pitz」
  が成り立つので、序盤で同じピザを繰り返す必要はない。
- 同じ Margherita を焼く回数の上限（tier ごと、1 品を買うまで）:

  | tier | 価格 | low ★1 | beginner ★2 | standard ★3 | skilled+ |
  |---|---:|---:|---:|---:|---:|
  | early | 60 | 3 | 2 | 1 | 1 |
  | mid | 100 | 5 | 2 | 2 | 1 |
  | late | 140 | 7 | 3 | 2 | 2 |
  | endgame | 180 | **9** | 4 | 3 | 2 |

- 最初に grind が発生する地点: low-score は 48 発見後（cilantro、3 bake）、beginner は 85 発見後、
  standard は 97 発見後、skilled は発生しない。
- 最悪の無発見区間: low-score が **25 bake**（97 発見時、nori の前）、beginner 10、standard 7、
  skilled 1。low-score は全 483 bake のうち 79% が grind。

### 5.3 判定

| 観点 | 判定 |
|---|---|
| Economy hard-lock（Pitz が永久に不足する） | **なし**（Margherita の floor は無限、在庫を消費しない） |
| 「次の材料のために同じピザを何十回も」 | **序盤と中盤ではなし**。authority の late/endgame で、★1 固定のプレイヤーだけ 1 購入あたり最大 9 回、無発見区間 25 bake → **P2**（authority 承認済みの範囲。変えるなら Human Feel の証拠が必要） |
| Production への投影（R-02） | **P0**（Pitz ではなく ⭐ gate の問題。§4.2） |
| Refill | 補充は 30〜90 Pitz（価格 × 0.5）。authority simulation では 101 件で 6 回。hard-lock なし |
| Lunch Rush | 収入源としては必須ではない（authority の `noDeadlockProof.lunchRush`）。ただし在庫を消費する（R-05） |

---

## 6. Owner decision が必要なもの

### OD-03 — Content projection policy（**3-4C の値を block する。3-4A は block しない**）

| Option | 内容 | 数値の変更 | 評価 |
|---|---|---|---|
| **A: AUTHORITY_VERBATIM_CONTENT_TRANCHED（条件付き推奨）** | authority の gate と価格をそのまま使い、content を authority の sequence 順に tranche で追加する。marinara、napoletana、pizza-bianca は BEST を上げれば届く（skill lock）。**genovese と quattro-formaggi は、runtime の発見可能数がそれぞれ 16 件以上／21 件以上（全員 ★5 の場合。保証最低では 38／51）になるまで誰も発見できない（hard lock）。** end-of-content の説明 UI（3-4E）を必須にする | なし | 承認済みの数値を守り、tranche ごとに単調に改善する。代償として、出荷済み 2 recipe が新規プレイヤーから一時的に消える |
| B: PROJECTED_GATES | 同じ G4 式を runtime pool で再計算する（Graph JSON の illustration: garlic 16、anchovy 18、rosemary 18、cherry-tomato 20、gorgonzola/fontina 22 など） | **あり** | 全 15 件に届くが、承認済みの値から外れる。tranche を追加するたびに gate が上がり、AVAILABLE だった材料が LOCKED に戻る |
| C: CONTENT_FIRST | EP1/EP4 のまま content を sequence 92 まで追加する（capability 6 種以上が必要） | なし | Phase 3-4 の loop 完成が大幅に遅れる |

A を推奨するのは、**owner が「genovese と quattro-formaggi の一時的な hard lock」を受け入れる
場合に限る**。承認済みの経済値を変えずに Phase 3-4 の loop を成立させられる。その場合でも
「今は届かない」ことを UI で正直に案内し、tranche で解消していく。この hard lock を受け入れない
場合は B（数値の変更を伴う）か、この 2 件だけ例外にする別案が必要になる。どちらにしても owner の
承認が要る。**本監査は A も B も実装しない。値の決定は owner に委ねる。**

---

## 7. Phase 3-4 Slice 計画（小さい PR へ分割）

分割の原則:

1. 純関数を先に入れて未配線のまま置く（A）。挙動を切り替える PR（C）は atomic かつ最小にする。
2. save の forward-compat（B）は、新しい id を出荷する PR（G）より**先に deploy** する。
3. `gameReducer.ts` と `lunchRush.ts` に触れる slice は PR #202 の merge 後にする。`.github/**` には
   どの slice も触れない（#201 と衝突しない）。
4. UI は Shop（D）と HOME/RESULT（E）に分けて、それぞれ Human Verification を行う。

| Slice | Purpose | 主な Files | Dependencies | Tests | E2E | WebKit | HV | Rollback | Merge 順 |
|---|---|---|---|---|---|---|---|---|---:|
| **3-4A** Progression rules foundation（headless、未配線） | `progressionStars`=Σmax(2,BEST)、`ingredientLifecycle`、購入時の 10 portion 付与、R10 補充（×0.5）、portion→piece 換算、authority JSON の読み込み。parity、deadlock、経済 simulation のテスト | `src/data/progressionUnlocks.ts`、`src/logic/progressionStars.ts`、`src/logic/progressionEconomy.ts`（すべて新規）とテスト | なし（#202/#201 と file が重ならない） | JSON parity、hybrid ⭐ 表、lifecycle の真理値表、取引の atomicity、投影 pool の deadlock、authority の先頭 event との parity | なし | #201 classifier 上は src/** なので required（no-op 想定） | 不要 | revert するだけ（どこからも import されていない） | 1 |
| **3-4B** Save forward-compat と既存 save の transition 契約 | sanitizer が未知の ingredient/recipe id を保持する。transition 規則（owned 維持、EP4 ledger は不活性、stock 維持）をテストで固定する | `src/state/persistence.ts` とテスト | なし。**3-4G より前に deploy する** | 未知 id の round-trip、v1/v2 fixture、rollback simulation | Chromium: 既存 save の reload smoke | **Required**（storage） | 不要（見た目の変化なし） | revert。その間に書かれた save は読める | 2 |
| **3-4C** Unlock/purchase rule cutover（**atomic**） | EP1 recipe unlock と EP4 recipe-keyed grant を撤去し、⭐ gate、authority 価格、購入時 10 portion、R10 を入れる。Shop は既存 UI のまま購入行を出すだけ。Pizza Select の LOCKED 理由は EP1 から切り離す | `data/ingredients.ts`、`data/recipes.ts`、`state/progression.ts`、`state/starterStock.ts`、`logic/economy.ts`、`state/gameReducer.ts`（purchase/restock のみ）、`state/pizzaSelect.ts`、`ShopOverlay.tsx`（filter のみ）、`App.tsx`（load 時の grant 呼び出し削除）、fixture | 3-4A、3-4B、**OD-03**、**PR #202 merge** | unit 全体（P3-3 と同様に fixture の fallout を想定） | Chromium full（両 viewport）+ 新規「egg を買う → Bismarck を発見できる」 | **Required** | **Required** | revert すれば EP1/EP4 に戻る。購入済みは永続 OWNED なので失われない | 3 |
| **3-4D** Shop progression UX | LOCKED 行に「あと⭐N」、AVAILABLE 行を強調、「新しいピザが作れるかも（件数のみ、ネタバレなし）」、portion 在庫と補充行、購入 feedback | `ShopOverlay.tsx`、`InventoryOverlay.tsx`、`App.css`、`e2e/progression-shop.spec.ts`（新規） | 3-4C | component unit | Chromium focused | **Required**（UI/scroll） | **Required** | revert（3-4C の最小行は残る） | 4 |
| **3-4E** HOME/RESULT/DISCOVERED の次の目標 | HOME に次の目標を 1 行（優先順: 今発見できる件数 → 買える材料 → Pitz 不足 → ⭐ 不足 → end-of-content）。RESULT と DISCOVERED に ⭐ 増分と次の入荷。Pizza Select の未発見 copy | `HomeScreen.tsx`、`ResultPanel.tsx`、`PizzaSelectScreen.tsx`、`logic/progressionGuidance.ts`（新規、純関数）、css | 3-4C | guidance selector の真理値表、component | Chromium focused | **Required** | **Required** | revert（state に影響なし） | 5 |
| **3-4F** Lunch Rush の stock-aware pool | pool を discovered ∩ available ∩ in-stock にする。空なら fail-closed で、HOME に理由を出す | `mission/lunchRush.ts`、`state/gameReducer.ts`（`nextMissionOrderState`）、`HomeScreen.tsx` | **PR #202 merge**、3-4C | lunchRush unit | Chromium focused | **Required**（timer/input） | **Required** | revert すれば #202 の pool に戻る | 6 |
| **3-4G** Content tranche T1 | aussie、portuguesa、brazilian-calabresa（**新しい材料は 0**）。recipe、reference visual、profile、orders、catalog。aussie は sauce なしなので sauce-free boundary を確認する | `data/recipes.ts`、`discoveryCatalog.ts`、`orders.ts`、`referencePizza.ts`、`recipeSauceProfiles.ts`、`cookingProfiles.ts` | **3-4B deployed**、3-4C | catalog parity、recipe validator、signature の一意性 | Chromium focused | **Required** | **Required** | revert。3-4B があれば T1 の Dex は未知 id として残る | 7 |
| **3-4H** 統合と最終 Human Replay | Journey E2E、economy parity の再実行、Result report、SSOT の supersede 注記、HANDOFF | `e2e/progression2-phase3-4-journey.spec.ts`、docs、screenshots | C、D、E、F、G | unit 全体 | Chromium full と **WebKit full**（最終） | **Required** | **Required**（§9） | docs/e2e のみ | 8 |

A と B は並行して進められる（file が重ならない）。D、E、G は C の後に並行できる（D は Shop、E は
HOME/Result、G は data と、file が分かれている）。F は #202 の merge と C に依存する。

---

## 8. CI 効率（Issue #201 と整合）

| Slice | Focused unit | Fast CI（lint/unit/typecheck/build） | Chromium E2E | WebKit | Human Verification |
|---|---|---|---|---|---|
| 3-4A | ✅ | ✅ | — | classifier 上は required（src/**）。no-op 想定 | — |
| 3-4B | ✅ | ✅ | focused（reload） | **required**（storage） | — |
| 3-4C | ✅ | ✅ | **full** | **required** | **required** |
| 3-4D | ✅ | ✅ | focused | **required**（UI/scroll） | **required** |
| 3-4E | ✅ | ✅ | focused | **required** | **required** |
| 3-4F | ✅ | ✅ | focused（lunch rush） | **required**（timer/input） | **required** |
| 3-4G | ✅ | ✅ | focused | **required** | **required** |
| 3-4H | ✅ | ✅ | **full** | **full（最終）** | **required（最終 Replay）** |
| 本監査 PR | — | ✅（docs-only） | — | #201 導入後は skip 対象 | 不要（docs-only） |

- full E2E を毎 PR で回すのは C と H だけ。D/E/F/G は focused spec と WebKit（#201 の classifier が
  required と判定する）で済ませ、最後に H で full を 1 回まとめて回す。
- runtime、UI、storage、input に触れる slice から WebKit と HV を削ることはしない。

---

## 9. 最終 Human Replay シナリオ（設計のみ、未実行）

- **対象:** 3-4H の Preview build。authority 390×844 と secondary 360×800 でそれぞれ 1 本。
  MP4/H.264。1 状態につき 1〜3 秒保持する。動画は commit せず直接提出し、screenshot を
  `docs/reports/screenshots/progression2-phase3-4/` に置く。
- **前提:** Full Game Reset を実行した新規 save。Pitz 0、Dex 0、OWNED は starter trio のみ。

| # | 操作 | 確認点（期待値） |
|---:|---|---|
| 1 | 起動して HOME | Dex 0、フリークッキングが primary、ランチラッシュは 🔒、次の目標は「最初の 1 枚」 |
| 2 | Shop を開く | starter 3 件が OWNED。egg/bacon/onion は LOCKED「あと⭐2」。購入ボタンなし |
| 3 | Free Cooking で tomato + mozzarella のみ | ORIGINAL（失敗表示ではない）、Dex 0 のまま |
| 4 | tomato + mozzarella + basil | **NEW マルゲリータ**、★ 表示、Pitz 内訳（基本 + 初回 +50 + 手際）、⭐+2〜5 |
| 5 | HOME | Dex 1、ランチラッシュ解放、次の目標「新しい材料が入荷！ Shop へ」 |
| 6 | Shop | egg/bacon/onion が AVAILABLE @60。残高 ≥ 70 なので 1 つ以上買える |
| 7 | egg を購入 | 残高 −60、egg は OWNED、在庫 10 portion、「新しいピザが作れるかも」 |
| 8 | Free Cooking の tray | egg が表示される（OWNED だけ、ページング） |
| 9 | tomato + mozzarella + egg | **NEW ビスマルク**、+50 bonus、⭐ 増分、egg の在庫が減る |
| 10 | HOME | Dex 2、次の目標の更新 |
| 11 | ランチラッシュ | 注文は margherita と bismarck だけ（discovered ∩ available ∩ in-stock）。未発見の注文は出ない |
| 12 | 1〜2 枚提供して終了 | Mission 結果と Mission Pitz（40 + …）。ranking の表示が壊れない |
| 13 | reload | Dex 2、Pitz、egg の OWNED と在庫、⭐ がすべて維持される |
| 14 | ★1 の variant（任意、短い別録り） | 低品質のマルゲリータで +70、egg を買える（hard-lock しないことの証跡） |

Result report には、ファイル名、viewport、duration、size、codec と、上の各状態との対応を記載する
（Policy の §7 と §10）。

---

## 10. Risk 一覧

| Id | 優先度 | Risk | 対策 |
|---|---|---|---|
| R-01 | **P0** | EP1 chain を残したまま gate を入れると Margherita 直後に deadlock | 3-4C を atomic にする |
| R-02 | **P0** | authority の gate を 15 recipe に適用すると shipped 5 件に届かない（3 件は skill lock、genovese と quattro-formaggi は理論最大でも届かない hard lock） | OD-03（hard lock を受け入れるなら A、受け入れないなら B か例外案）、3-4E end-of-content、3-4G T1 |
| R-03 | **P0** | recipe unlock を撤去し grant を残すと、load 時に全材料が配布される | 3-4C を atomic にする。「load では何も付与しない」を test で固定 |
| R-04 | P1 | rollback すると新 id の購入や発見が消える | 3-4B を 3-4G より先に deploy |
| R-05 | P1 | Lunch Rush が在庫 0 の recipe を注文して stall する | 3-4F |
| R-06 | P1 | ⭐ が 2 種類画面に出る（ΣBEST と hybrid） | gate の UI は progression ⭐ に統一し、Dex は per-recipe の BEST★ |
| R-07 | P1 | portion と piece の単位差 | 3-4A で換算を定義。piece 単位の保存を維持（schema bump なし） |
| R-08 | P1 | 初回発見後の導線がない | 3-4E |
| R-09 | P1 | 現行 production が ★1/★2 を skill-lock している | 3-4C で解消 |
| R-10 | P1 | #202/#201 との file 競合 | A と B は非競合。C と F は #202 の後。`.github/**` は不変 |
| R-11 | P2 | low-score 終盤の grind（無発見 25 bake、grind 率 79%） | authority 承認済み。Human Feel の証拠が出るまで変更しない |
| R-12 | P2 | ORIGINAL 0 Pitz と authority の `originalPizzaPays` | deadlock には無関係。owner の数値待ち |
| R-13 | P2 | T1 の aussie は sauce なし | 3-4G で sauce-free boundary を確認 |
| R-14 | P2 | Dex の分母と「N/15」copy | runtime catalog から導出（3-4E） |

**Progression deadlock:** authority 上は**なし**。production への投影では、OD-03 が未決のまま
authority 値を入れると**あり**（R-01、R-02）。
**Economy hard-lock:** **なし**。

---

## 11. 推奨実装順

```
OD-03 decision (owner)        ─┐
3-4A rules foundation  ────────┼─► 3-4C atomic cutover ─┬─► 3-4D Shop UX ──┐
3-4B save forward-compat ──────┘   (after PR #202)      ├─► 3-4E guidance ─┼─► 3-4H integration
                                                        ├─► 3-4F LR stock ─┤   + final Human Replay
                                   3-4B deployed ───────┴─► 3-4G T1 content┘
```

1. **3-4A**（今すぐ開始できる）と 3-4B（並行可）
2. OD-03 の決定と PR #202 の merge を待つ
3. 3-4C
4. 3-4D、3-4E、3-4G（並行可）と 3-4F
5. 3-4H

**Phase 3-4 の最初の実装 slice: 3-4A「Progression rules foundation（headless、未配線）」。**
authority JSON の読み込みと parity test、hybrid ⭐（`Σ max(2, BEST)`）、ingredient lifecycle、
purchase-with-grant、R10 補充、portion→piece 換算、projected-pool の deadlock test を純関数として
入れる。production の挙動は変わらない。OD-03 にも PR #202 にも #201 にも依存しない。

---

## 12. 再現

```
python3 docs/reports/data/PROGRESSION-2.0_PHASE-3-4_audit_graph.py          # 生成
python3 docs/reports/data/PROGRESSION-2.0_PHASE-3-4_audit_graph.py --check  # drift 検証
python3 tools/progression2_phase34_unlocks.py --check                       # authority（PASS）
python3 tools/progression2_phase2_progression.py --check                    # Phase 2（PASS）
```

production data の snapshot は、スクリプト冒頭の `PROD_RECIPES` / `PROD_INGREDIENTS`
（`src/data/*` @ `1e73a7d` から転記）。スクリプトは recipe ごとに Phase-2 JSON の target items と
一致することを assert する。
