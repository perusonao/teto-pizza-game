# TETO Cooking Techniques 1.0 — SSOT（authority 要約）

> **位置付け:** Cooking Techniques 1.0 の実装が参照する唯一の authority。承認済みの Owner Decision（2026-09-27）と、main に入った実装（LAD-1 #268 `4f7443a`、TQ-1A #273 `73c8ad0`、TQ-1B #271 `bcac961`）を 1 枚にまとめたもの。
> 詳細な根拠は同じディレクトリの `_DESIGN.md`、`_OWNER-DECISION-GATE.md`、`_FINAL-IMPLEMENTATION-GATE.md`、`_TQ-1C_PRE-IMPLEMENTATION-GATE.md` を参照する。**本書と詳細文書が食い違う場合は本書が優先**し、本書と main の実装が食い違う場合は、Owner Decision に照らして本書を直す。
> TQ-1C 実装前に、docs-only PR でこのファイルと上記の詳細文書を main に取り込むことを提案している（TQ-1C Gate §2、OD-TQ1C-1）。

## 1. 原則（Owner Decision）

| # | 原則 | 出典 |
|---|---|---|
| P1 | **Recipe discovery = 何を作ったか（what）。Technique discovery = どう作ったか（how）。** 技法は「新しい作り方」で、レシピではない | OD-TQ-1 / 2 |
| P2 | 技法は**購入しない・直接教えない**。Shop にも Hint にも技法の答えは出さない。★ / Pitz の報酬も付けない | OD-TQ-1 / 6 / 7 |
| P3 | **Recipe discovery と Technique discovery は独立**。recipe の matcher は技法の台帳を読まない。技法はレシピ発見の前提条件にならない（INV-TQ-NB） | OD-TQ-1、INV-TQ-NB |
| P4 | レシピを発見したら、そのレシピが要求する技法も発見済みになる（INV-TQ-1）。オリジナルピザでも、affordance が開いていれば技法を発見できる（INV-TQ-6） | INV-TQ-1 / 6 |
| P5 | **同時発見の表示順は ① Technique → ② Recipe。** 保存は 1 回の遷移（REGISTER_TO_DEX）の中で 1 回だけ行う | Final Gate §1 |
| P6 | 技法の**操作そのものは発見前から可能**（例: SAUCE step の「なしでもOK」）。ただし未発見の技法の**名称・説明は出さない**（Dex の「？？？」となぞかけだけ。なぞかけは affordance 到達後に限る） | OD-TQ-4 / 5 / 16 |
| P7 | near-miss の軸を示す文言（SAUCE_ONLY など）は、**整合する答えが 2 つ以上ある時（k ≥ 2）だけ**出す。k < 2 なら技法固有の情報を出さず fallback「おしい！あと少し、なにかが違うみたい…？」にする（fail-closed） | OD-TQ-P1 |
| P8 | **Technique discovery は Free Cooking でだけ起きる。** Lunch Rush と Dinner では発生させない | OD-TQ-10改 |
| P9 | TQ-1 では **production recipe に技法の要求を追加しない**（Aussie の production 追加は TQ-1D） | OD-TQ-18、Final Gate §1 |
| P10 | **INV-TQ-4 を維持する:** 技法を要求する runtime recipe が 1 つもない間は、その技法の affordance は開かず、技法は認識されない（TQ-1C は production では不活性） | INV-TQ-4 |
| P11 | 最初の技法は NO_SAUCE（`"no-sauce"`） | OD-TQ-15 |

## 2. 不変条件

| ID | 内容 | 固定している場所（main） |
|---|---|---|
| INV-TQ-NB | `discovery/**`、`discoveryCatalog`、`recipes`、`completionGate`、`discoveryRegistration` は技法 module や技法の台帳を参照しない | `src/logic/techniques/techniques.architecture.test.ts` |
| INV-TQ-1 | Dex で発見済みのレシピが要求する技法は、すべて台帳にある | `registerTechniqueDiscovery`（レシピ経由）、`backfillTechniqueLedger`（load 時） |
| INV-TQ-2 | 台帳は増えるだけ。同じ技法を 2 回発見しない | registration（冪等）、persistence（union） |
| INV-TQ-3 | scoring、Pitz、★、Dex BEST は技法を読まない。既存 25 recipe の score は不変 | architecture test、`scoreParity.main-7bb0116.json`（225 行） |
| INV-TQ-4 | 要求するレシピが 0 の技法は affordance が開かない | `techniqueAffordanceStep` が `null` を返す |
| INV-TQ-5 | 未発見の技法について、名称や具体操作を出さない。軸を示す文言は k ≥ 2 の時だけ出す | `nearMissPrivacy.ts`（pure 部分）。どの文言に適用するか（wiring の範囲）は OD-TQ1C-2 で決める |
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

## 5. Slice

| Slice | 内容 | 状態 |
|---|---|---|
| LAD-1 | append-only ladder | merged `4f7443a` |
| TQ-1A | 技法の pure model、detection、save foundation（未配線） | merged `73c8ad0` |
| TQ-1B | no-sauce scoring（score 不変） | merged `bcac961` |
| TQ-1C | runtime wiring（production では不活性） | Pre-Implementation Gate（本書と同時） |
| TQ-1D | Aussie、表示（技法段、Dex の「調理法」、RESULT の sauce 行）、`ReferencePizza.sauce` の nullable 化。ここで loop が有効になる | 未着手 |
| TQ-1E | Human Verification | 未着手 |
