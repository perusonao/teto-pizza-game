# TETO Cooking Techniques 1.0 — SSOT（authority 要約）

> **位置付け:** Cooking Techniques 1.0 の実装が参照する唯一の authority。承認済みの Owner Decision（2026-09-27 と 2026-09-28）と、main に入った実装（LAD-1 #268 `4f7443a`、TQ-1A #273 `73c8ad0`、TQ-1B #271 `bcac961`）を 1 枚にまとめたもの。
> 詳細な根拠は同じディレクトリの次の 3 文書にある:
> - `TETO_COOKING-TECHNIQUES_1.0_OWNER-DECISION-GATE.md`（TQ-1 の判断材料と規則の詳細）;
> - `TETO_COOKING-TECHNIQUES_1.0_FINAL-IMPLEMENTATION-GATE.md`（Owner Authority の正式記録）;
> - `TETO_COOKING-TECHNIQUES_1.0_TQ-1C_PRE-IMPLEMENTATION-GATE.md`（TQ-1C の配線設計）。
>
> 172 行の技法監査、生成ツール、機械可読データは設計 archive（branch `claude/cooking-techniques-design-n0qfwj`、commit `ab77b82`）に残し、main には入れない（OD-TQ1C-1）。
> **本書と詳細文書が食い違う場合は本書が優先する。** 本書と main の実装が食い違う場合は、Owner Decision に照らして本書を直す。

## 1. 原則（Owner Decision）

| # | 原則 | 出典 |
|---|---|---|
| P1 | **Recipe discovery = 何を作ったか（what）。Technique discovery = どう作ったか（how）。** 技法は「新しい作り方」で、レシピではない | OD-TQ-1 / 2 |
| P2 | 技法は**購入しない・直接教えない**。Shop にも Hint にも技法の答えは出さない。★ / Pitz の報酬も付けない | OD-TQ-1 / 6 / 7 |
| P3 | **Recipe discovery と Technique discovery は独立**。recipe の matcher は技法の台帳を読まない。技法はレシピ発見の前提条件にならない（INV-TQ-NB） | OD-TQ-1、INV-TQ-NB |
| P4 | レシピを発見したら、そのレシピが要求する技法も発見済みになる（INV-TQ-1）。オリジナルピザでも、affordance が開いていれば技法を発見できる（INV-TQ-6） | INV-TQ-1 / 6 |
| P5 | **同時発見の表示順は ① Technique → ② Recipe。** 保存は 1 回の遷移（REGISTER_TO_DEX）の中で 1 回だけ行う | Final Gate §1 |
| P6 | 技法の**操作そのものは発見前から可能**（例: SAUCE step の「なしでもOK」）。ただし未発見の技法の**名称・説明は出さない**（Dex の「？？？」となぞかけだけ。なぞかけは affordance 到達後に限る） | OD-TQ-4 / 5 / 16 |
| P7 | near-miss の SAUCE_ONLY 文言には **k 規則を一律に適用する**。整合する答えが 2 つ以上ある時（k ≥ 2）だけ SAUCE_ONLY を出し、k < 2 なら fallback「おしい！あと少し、なにかが違うみたい…？」にする（fail-closed。技法固有の情報は出さない）。target が技法を要求するかどうかで分岐しないので、**side channel を作らない**。**有効化は TQ-1D（Human Verification 付き）で行い、TQ-1C では有効化しない** | OD-TQ-P1、**OD-TQ1C-2** |
| P8 | **技法の発見経路は 2 つ:** (a) **使用経路**（使った技法を affordance の条件付きで認識する）は **Free Cooking（`freeCook`）だけ**。(b) **レシピ経路**（INV-TQ-1: レシピを新しく発見したら、そのレシピが要求する技法も記録する）は、**FREE の全 round**（guided を含む）で記録してよい。guided round が matcher 経由で別のレシピを発見する現行の挙動と整合させる。**Lunch Rush と Dinner では、両経路とも技法の発見は 0** | OD-TQ-10改、**OD-TQ1C-3** |
| P9 | TQ-1 では **production recipe に技法の要求を追加しない**（Aussie の production 追加は TQ-1D） | OD-TQ-18、Final Gate §1 |
| P10 | **INV-TQ-4 を維持する:** 技法を要求する runtime recipe が 1 つもない間は、その技法の affordance は開かず、技法は認識されない（TQ-1C は production では不活性） | INV-TQ-4 |
| P11 | 最初の技法は NO_SAUCE（`"no-sauce"`） | OD-TQ-15 |

### 1.1 OD-TQ1C-2 の監査記録（k 規則を一律に適用した場合の production 影響）

- **対象:** main `bcac961`、canonical ladder の step 0〜24。所持品は starters と、その step までの材料で、すべて在庫あり。
- **方法:** DISCOVERABLE な各 target について、ソースだけが違うピザ（ソース無し、または所持している他のソース）を作り、`classifyNearMiss` → `sauceAxisAnswerCount` を計算した。
- **結果:**
  - SAUCE_ONLY が出るのは **44 件**。
  - そのうち **12 件（27%）** が k < 2 で、一律に適用すると fallback に変わる。
  - 12 件はすべて「ソースを塗り忘れた」ピザで、所持しているソースがトマトだけの step 1〜12 に集中している。
- **判断:** この 12 件の文言変更は production で見える UI の変化なので、TQ-1D の Human Verification で確認する。TQ-1C はこの数を test で固定するだけで、文言は変えない。

## 2. 不変条件

| ID | 内容 | 固定している場所（main） |
|---|---|---|
| INV-TQ-NB | `discovery/**`、`discoveryCatalog`、`recipes`、`completionGate`、`discoveryRegistration` は技法 module や技法の台帳を参照しない | `src/logic/techniques/techniques.architecture.test.ts` |
| INV-TQ-1 | Dex で発見済みのレシピが要求する技法は、すべて台帳にある | `registerTechniqueDiscovery`（レシピ経由）、`backfillTechniqueLedger`（load 時） |
| INV-TQ-2 | 台帳は増えるだけ。同じ技法を 2 回発見しない | registration（冪等）、persistence（union） |
| INV-TQ-3 | scoring、Pitz、★、Dex BEST は技法を読まない。既存 25 recipe の score は不変 | architecture test、`scoreParity.main-7bb0116.json`（225 行） |
| INV-TQ-4 | 要求するレシピが 0 の技法は affordance が開かない | `techniqueAffordanceStep` が `null` を返す |
| INV-TQ-5 | 未発見の技法について、名称や具体操作を出さない。SAUCE_ONLY は k ≥ 2 の時だけ出す（一律に適用、TQ-1D で有効化） | `nearMissPrivacy.ts`（pure 部分）。wiring は TQ-1D |
| INV-TQ-6 | ORIGINAL ピザから技法を認識するのは affordance の到達後だけ | `registerTechniqueDiscovery` の `isAffordanceOpen` |

## 3. Scoring / Reference の境界（TQ-1B で固定済み。変更しない）

- NO_SAUCE の weight は Pieces 68 / Recipe 12 / Bake 20。選ばれるのは `reference.sauce === null` の時だけ。STANDARD（52 / 16 / 12 / 20）は不変。
- 次は変更しない:
  - Reference registry の deep-freeze;
  - `ReferencePizza` 系の型の readonly;
  - weight profiles の freeze;
  - injected Reference の検証（recipe id、ingredient の 1 対 1 対応、ingredient の役割、`minCount` と一致する positions、ingredient ごとの tolerance band と sauce target、slot 領域）;
  - 既存 25 recipe の parity。
- `ReferencePizza.sauce` の nullable 化は **TQ-1D** で行う。TQ-1C では行わない。

## 4. Save

- `PersistentSaveV2.discoveredTechniqueIds: string[]`（schema bump なし）。
  - 旧 save → `[]`。
  - 壊れた値 → 既知の id だけを残し、重複を除き、64 件で切る。
  - 未知の well-formed id → forward-compat で保持する。
  - `persistProgress` → union（下がらない）。
  - Full Reset → key ごと消える。
- `persistProgress` は、DM-4-3 の `requireDinnerRecords` によって**スナップショット単位で all-or-nothing**。技法の台帳だけが部分的に保存される経路はない（TQ-1C Gate §4）。

## 5. Owner Decision（2026-09-28、TQ-1C Gate の結果）

| ID | 決定 |
|---|---|
| OD-TQ1C-1 | APPROVED。TQ-1C の前に docs-only の TQ-1C-0 PR で authority を main に取り込み、main に無い文書への dangling reference を解消する |
| OD-TQ1C-2 | APPROVED。k 規則は最終的に SAUCE_ONLY に一律で適用し、candidate < 2 は fail-closed、side channel は作らない。production の文言が変わるので、TQ-1C では有効化せず、TQ-1D と Human Verification で有効化する。44 件中 12 件が fallback に変わるという監査結果を §1.1 に記録する |
| OD-TQ1C-3 | APPROVED。使用経路は Free Cooking だけ。レシピ経路（INV-TQ-1）は FREE の全 round で記録してよい。Lunch Rush / Dinner は両経路とも 0。guided round が別のレシピを発見できる現行の挙動との整合を維持する |

## 6. Slice

| Slice | 内容 | 状態 |
|---|---|---|
| LAD-1 | append-only ladder | merged `4f7443a` |
| TQ-1A | 技法の pure model、detection、save foundation（未配線） | merged `73c8ad0` |
| TQ-1B | no-sauce scoring（score 不変） | merged `bcac961` |
| TQ-1C-0 | 本書を含む authority を main へ取り込む（docs only） | 本 PR |
| TQ-1C | runtime wiring（production では不活性。near-miss の文言は変えない） | TQ-1C-0 の後 |
| TQ-1D | Aussie、表示（技法段、Dex の「調理法」、RESULT の sauce 行）、`ReferencePizza.sauce` の nullable 化、near-miss の k 規則の有効化。ここで loop が有効になる | 未着手 |
| TQ-1E | Human Verification | 未着手 |
