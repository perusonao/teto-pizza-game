# B案再構成（発見をご褒美に、店の成長を主目的に）— Phase 0 依存棚卸し ＋ Phase 1 基盤設計

- Status: **設計のみ（docs-only）**。この文書の作成でコード・テスト・データは一切変更していない。
- 改訂: 2026-11-25 初版（`2aee550`）→ 同日、§6 Q1〜Q12 と R1/R2/R4 に Owner 回答を反映 → 2026-11-26、Q3・Q10 を Owner 判断（旧セーブは対象外）で上書き → 2026-11-26、Phase 2b：Q7 の実装と、shop の表示を「第○章」から称号ラダー（見習い 0／駆け出し 15／一人前 40／職人 110／達人 210／匠 340、表示のみ。材料の区切りは章の下限のまま）に変更（Owner 決定） → 2026-11-26、Phase 3a：厳選 60 品（5 段階 × 12 品）を `MENU_CATALOG` に投入（Owner 決定。§4 の Phase 3 を 3a〜3e に分割） → 2026-11-26、Phase 3b：材料の段階をカタログ由来に、メニュー開発に段階の条件、段階前の完全一致は「判明」→段階到達で自動メニュー入り（Owner 決定）
- 作成日: 2026-11-25
- 調査基準: `main` = `39d6b5b`（PR #897 merge 後）
- 対象: Owner が採用した B案（評判と Pitz を進行の軸にし、通常営業を主目的、発見を「メニュー開発」へ改称）
- 進め方（Owner 確定）: **同一リポジトリ内で新構造を作り、フラグで切り替え、最後に旧構造を消す**。新リポジトリは作らない
- 本書で扱わないこと: 数値（評判の閾値・獲得量・ボーナス額・章ごとの材料割当・厳選 60 品の選定）の確定。未決定点は §6 に推奨案つきで列挙した（Q1〜Q12 は 2026-11-25 に Owner 回答済み。数値は引き続き未定）

> 用語: 本書では現行の進行を **legacy モデル**（発見駆動）、B案の進行を **shop モデル**（評判駆動）と呼ぶ。
> 「メニュー」= 通常営業で注文を受けられるレシピの集合。

---

## 0. Owner 確定事項（本書の前提）

| # | 確定事項 | 本書での扱い |
|---|---|---|
| C1 | 進行の軸は「評判」と Pitz。章と材料の解放条件は発見ではなく評判到達 | §3.2 `ProgressionModel` の shop 実装で、材料解放と章を評判から導く |
| C2 | 通常営業（注文）が主目的。注文は解放済みメニューから生成、報酬は出来栄え連動 | §3.2 注文はメニュー ∩ 調理可能 から生成。報酬は既存 `applyPitzCredit`（出来栄え倍率）を再利用 |
| C3 | 発見は「メニュー開発」に改称。役割はメニュー追加＋ボーナス。発見条件は完全一致のまま | matcher（`logic/discovery/matcher.ts`）と Completion Gate は変更しない。結果の「行き先」だけを変える |
| C4 | 初回レシピは厳選 60 品。不採用分はデータとして残し、後から有効化できる | レシピデータは削除しない。「採用集合」をデータとして別に持つ（§3.2.4） |
| C5 | 調理システム（生地・ソース・トッピング・焼き・仕上げ・カット）の中身は変更しない | PREPARE〜CUT の reducer case・`PizzaState`・Scoring 2.0 component は対象外 |
| C6 | スコアは Scoring 3.0（Issue #176）の設計と接続する | 報酬・評判は `ScoreBreakdown` を 1 つのアダプタ経由でだけ読む（§3.2.5） |

---

## 1. 現行モデルの要約（legacy）

```
Free Cooking（自由に作る）
   └─ CONFIRM_BAKE → REGISTER_TO_DEX
        ├─ matcher: 署名が未発見レシピに完全一致 → Dex に discovered=true（=「発見」）
        ├─ Pitz: baseRewardPitz(100) × 出来栄え倍率 ＋ 初回発見ボーナス 50（FREE のみ）
        ├─ 技法: レシピ経路／使用経路で ledger に追記
        └─ resolveShopEntitlement: 「発見数（ladderCredit 対象）」→ Discovery Ladder の到達段
              → その段の材料が Shop で購入可能に（在庫 0、Pitz でパック購入）
                 ※ goat-cheese / spinach だけは累計★ 120 / 130 の追加ゲート

章（第1〜4章）= レシピの「鍵となる材料」のラダー段 → 価格帯 T1..T4 から機械的に導出
注文（ORDER フェーズの Mito 注文）= 発見済み ∩ 調理可能 からランダム（空なら Free Cooking に落ちる）
Lunch Rush / Dinner = 発見済みレシピだけがプール／解放条件
```

計測値（`main` 39d6b5b、テストランナーで一時プローブを実行して取得。プローブは削除済み）:

| 項目 | 値 |
|---|---|
| `RECIPES`（late catalog 含む、`LATE_CATALOG_PRODUCTION = true`） | **116** |
| うち ladder に数える（`countsTowardLadder`） | 104（`ladderCredit:false` が 12） |
| Lunch Rush 参加（`participatesInLunchRush`） | 25 |
| 旧 EP1 `unlockCondition` を持つレシピ | 14（発見済みなら無条件解放のため実効性は限定的） |
| `INGREDIENTS` | 137（オンボーディング常備 3: tomato-sauce / mozzarella / basil） |
| `DISCOVERY_LADDER.steps` | **101 段**（starGate は 50, 51 段のみ） |
| 章の分布（`buildRecipeChapters`） | 第1章 6 / 第2章 12 / 第3章 19 / 第4章 **79** |
| `ORDERS` | 116（全レシピに Mito の注文文がある） |
| `DINNER_MISSIONS` | 2 |
| `baseRewardPitz` | 全レシピ 100 |
| ステージ済み（未出荷）`STAGED_RECIPES` | 61 |

→ 第4章に 79 品が集中しており、「章＝ラダー価格帯」という導出はすでに章として機能していない。B案で章を評判帯に作り直す動機と一致する。

---

## 2. Phase 0 — 依存の棚卸し

### 2.1 「発見」が担っている箇所の一覧

「発見」の実体は **`DexEntry.discovered`（`src/state/dex.ts`）** ただ 1 つで、ほかはすべてそこからの導出である。これは B案にとって有利な構造で、**導出側を差し替えれば進行モデルを切り替えられる**。

#### (A) 進行・章の解放条件

| 箇所 | 何をしているか | shop モデルでの扱い |
|---|---|---|
| `state/recipeChapters.ts` `recipeChapter` / `buildRecipeChapters` | 章 = 鍵材料のラダー段 → `MATERIAL_PRICE_TIERS` の帯 | 章 = **レシピに付与した章番号**（評判帯）。導出関数を `ProgressionModel` 経由にする |
| `recipeChapters.ts` `chapterProgress` / `isChapterCleared` | 章の発見数・クリア印（Dex 由来） | 「メニュー化済み数」に読み替え。late 除外ロジックは維持 |
| `state/progression.ts` `recipeUnlocked` / `isRecipeAvailable` / `availableRecipeIds` | 旧 EP1 チェーン（発見済みなら常に解放） | shop では「章が評判で開いている」がレシピ側の解放軸になる |
| `state/recipeDiscoveryState.ts` | DISCOVERED / DISCOVERABLE / KNOWN_BUT_MISSING / UNKNOWN | メニュー開発の対象判定として**そのまま使える**（材料が使えるか、の導出なので） |
| `recipeDiscoveryState.ts` `canStartGuidedRound`（LK-8） | ガイド付き（見本表示）ラウンドは**発見済みのみ** | shop では「メニュー ∩ 調理可能」。未メニューの見本を出さない原則（情報漏れ防止）は維持 |
| `state/pizzaSelect.ts` | カード状態 COMPLETED / NEW / LOCKED、章セクション | 章の出所だけ差し替え。Pizza Select 自体の位置付けは §6 Q7 |
| `screens/HomeScreen.tsx` / `state/homeBubble.ts` | 「レシピ 発見数 N/M」表示、初回発見前は Free Cooking を強調、吹き出し文言 | 評判・メニュー数の表示へ。文言変更は UI 変更なので HV 対象 |
| `mission/dinner/dinnerMission.ts` `dinnerMissionUnlock` | 解放 = 全ターゲット発見済み（`ALL_TARGETS_DISCOVERED`） | 「全ターゲットがメニューにある」へ。判定関数 1 か所の差し替え |
| `mission/lunchRush.ts` `missionOrderRecipeIds` ほか / `canStartLunchRush` | プール = 発見済み ∩ 所持 ∩ 非 SOLD OUT | プール = メニュー ∩ …。Lunch Rush 自体の存続は §6 Q8 |
| `logic/techniques/{runtime,dexView,doughSwitch,panSwitch}.ts` | 技法のアフォーダンス = `creditedDiscoveredCount` ≥ 材料のラダー段 | 「その材料が解放済みか」に置換（発見数→段 の比較をやめる） |

#### (B) 材料の入荷・解放条件

| 箇所 | 何をしているか | shop モデルでの扱い |
|---|---|---|
| `data/discoveryLadder.ts` `DISCOVERY_LADDER`（101 段） | 段 s は「発見数 ≥ s」で到達、段ごとに材料 | **データとして残す**（価格帯の出所・材料の並び順として）。解放条件としては読まない |
| `logic/discoveryLadder.ts` `resolveMaterialUnlocks` / `meetsStarGate` | 到達段の材料 ∪ 既存 ledger（再ロックしない） | shop 版 resolver を新設：章（評判）で開いた材料 ∪ 既存 ledger。**union で再ロックしない原則は共有** |
| `state/materialEntitlement.ts` `resolveShopEntitlement` | 上記を runtime に橋渡し。呼び出し元 3 か所（REGISTER_TO_DEX / MISSION_NEXT_ORDER / startup） | `ProgressionModel.resolveEntitlement` に一本化。呼び出し元はそのまま |
| `data/lateCatalog.ts` `LATE_ENTITLEMENT_FLOORS` | late 材料の「発見数 ≥ floor」互換床 | shop では章割当に吸収。legacy 側は不変 |
| `logic/materialShop.ts` `priceTierForStep` / `materialOffer` | 価格 = 材料のラダー段の価格帯 | 価格の出所としては**ラダー段を使い続ける**（解放条件と価格を分離） |
| `materialEntitlement.ts` `obtainableIngredientIds` / `ingredientCollectionCount` | 「所持 N/M 種」の分母 = ラダーが売る材料 | shop では採用 60 品が使う材料 ∪ 常備。採用集合の関数にする |
| `buildMaterialUnlockNotice`（`lastMaterialUnlockNotice`） | 発見した回の RESULT に「新しい材料が入荷」 | 評判到達（章が開いた）時の通知へ。発生タイミングが変わる |
| `state/starterStock.ts`（EP4、退役済み） | 旧 Starter Grant ledger | 変更不要（ledger は保存上残るだけ） |

#### (C) 経済（ヒント・報酬）の接続点

| 箇所 | 何をしているか | shop モデルでの扱い |
|---|---|---|
| `logic/pitzReward.ts` `applyPitzCredit` | `baseRewardPitz × qualityMultiplierForScore(total)`、★1 床 20、**初回発見ボーナス 50** | 注文報酬としてそのまま再利用（C2「出来栄え連動」と一致）。初回発見ボーナスは「メニュー開発ボーナス」へ改称（額は §6 Q5） |
| `logic/efficiency.ts`（CT2 手際ボーナス） | FREE のみ、加算・上限付き | 通常営業でも加算するかは §6 Q6 |
| `REGISTER_TO_DEX` の `isMissionRound` ガード | FREE だけが per-pizza Pitz を得る（Lunch Rush は run 報酬） | 通常営業 = FREE の guided 経路と同じ扱いで成立 |
| `logic/economy.ts` `calculateMissionReward` | Lunch Rush の run 報酬 | 変更しない |
| `mission/dinner/dinnerReward.ts` | Dinner の段階報酬（未調整テーブル） | 変更しない |
| ヒント経済: `logic/discovery/hintPurchase.ts`, `selectableHint.ts`, `hint5Ladder.ts`（Production ON）, `state/discoveryHint.ts` | 未発見レシピのヒントを Pitz で購入 | **メニュー開発のヒントとして残す**（対象 = 未メニュー化の採用レシピ）。価格表は不変。対象集合を採用 60 品に絞るかは §6 Q4 |
| 研究系: `researchTargetId`, `trialNotebook`, `researchExclusions`, `lastResearchRows`, Research Contract 2.1 | 研究対象・試作記録・否定 ledger | メニュー開発 UI の中身として**そのまま残す**（発見条件が不変のため） |
| `logic/economySimulation.ts`, `logic/testSupport/*EconomySim.ts` | 発見前提の経済シミュレーション | legacy の回帰用として残し、shop 用シミュレーションを別に追加 |

#### (D) その他の読み手

- `logic/discovery/researchEntry.ts`（研究エントリ = 未発見で鍵材料を所持）、`mission/dinner/dinnerResultDetection.ts`（Dinner 中に未発見レシピを作っても ORIGINAL 扱い）、`screens/GameScreen.tsx`、`components/DexOverlay.tsx` / `ShopOverlay.tsx` / `MissionShortagePanel.tsx`。
- 開発用: `src/dev/discoveryProgressionModel.ts`, `src/devtools/stateModel.ts`, `devtools/starStates.ts`（Dev State Editor のプリセット）。shop モデル用のプリセット追加が必要。
- サーバ: `functions/src/submitLunchRushScore.ts` は `recipeId` の非空検査のみで発見状態を見ない → **影響なし**。

### 2.2 `GameState`（`src/state/gameReducer.ts`、約 160KB）のうち発見・研究・図鑑に関わる部分

| フィールド | 永続 | 役割 | shop での扱い |
|---|---|---|---|
| `dex: DexState` | ○ | 発見フラグ＋ BEST ★/点＋ timesMade | **SSOT として維持**（メニューは Dex から導出、§3.2.3） |
| `unlockedForShopIngredientIds` | ○ | 材料の Shop 解放 ledger（union のみ） | 共有。shop resolver も union で追記 |
| `ownedIngredientIds` / `inventory` / `pitzBalance` | ○ | 所持・在庫・残高 | 不変 |
| `discoveryHintPurchases` / `discoveryHintFacts` | ○ | ヒント購入 ledger | 不変（メニュー開発用） |
| `researchExclusions` | ○ | 否定 ledger | 不変 |
| `discoveredTechniqueIds` | ○ | 技法 ledger | 不変（アフォーダンス判定だけ差し替え） |
| `starterGrantClaimedRecipeIds` | ○ | 退役した EP4 ledger | 不変 |
| `freeCook` / `researchTargetId` / `researchTargetValidAtStart` / `hintSession` / `hintOutcome` / `hintSheetOpen` | × | Free Cooking・研究のセッション状態 | 不変（メニュー開発ラウンドの状態） |
| `lastDiscovery` / `justDiscovered` / `justGotNewBest` / `lastTechniqueDiscovery` | × | RESULT/DISCOVERED の一回限り表示 | 表示文言のみ変更 |
| `trialNotebook` / `lastTrialAttempt` / `lastResearchRows` | × | 試作記録 | 不変 |
| `lastPitzCredit` / `lastEfficiencyCredit` / `lastMaterialUnlockNotice` | × | 報酬・入荷通知の一回限り表示 | shop では評判獲得の表示を追加 |
| `preDiscoveryFreeCookAttempts` | × | 初回発見前の Free Cooking 試行数（ヒント文言） | オンボーディング設計次第（§6 Q2） |
| `order` / `recipe` / `isMissionRound` / `roundKind` / `missionSoldOutRecipeIds` / `dinner` | × | 注文・モード | `roundKind` に通常営業を表す値を足すか §3.2.2 |

アクション（43 種）のうち発見・進行に関わるのは `REGISTER_TO_DEX`（発見・Pitz・材料解放・技法を 1 トランジションで原子的に確定）、`MISSION_NEXT_ORDER`（Lunch Rush の再登録＋解放解決）、`SELECT_RECIPE` / `RETRY_SAME_RECIPE` / `BEGIN_PREPARE`（LK-8）、`START_FREE_COOK`、`PURCHASE_DISCOVERY_HINT` / `SHOW_HINT` / `CLOSE_HINT`、`PURCHASE_INGREDIENT` / `RESTOCK_INGREDIENT`、`PLAY_AGAIN`（`nextOrderState`）。調理系アクション（`APPLY_SAUCE`〜`ADD_CUT_LINE`）は**無関係**で、C5 と整合する。

### 2.3 セーブデータの形式

- キー: `teto-pizza-save-v1`（Preview は `teto-pizza-preview-save-v1`）。ネイティブ版は `nativeStorage` アダプタ経由で同一形式。
- `schemaVersion: 2`（`PersistentSaveV2`、`state/persistence.ts`）。v1 → v2 は `migrateV1toV2`。**未知の `schemaVersion` は書き換えずに保護**（Save Protection #560: future version は上書き禁止、破損は隔離してから置換）。
- 発見済み情報の保存場所: **`dex: DexEntry[]` の `discovered: boolean` のみ**。ほかに「発見済み一覧」は保存されていない（章・解放・Lunch Rush 解放・Dinner 解放はすべて読み込み時に導出）。
- 発見に付随して保存されるもの: `unlockedForShopIngredientIds`（解放 ledger）、`discoveredTechniqueIds`、`discoveryHintPurchases` / `discoveryHintFacts` / `researchExclusions`。
- 前方互換: `writeSave` は保存済み JSON の**未知トップレベルキーを `extras.topLevel` として保持**し、未知のレシピ/材料 ID（整形式）も保持する。→ **新フィールドを schema bump なしで追加しても、旧ビルドへのロールバックで消えない**（過去 6 回以上この方式で追加済み）。
- 書き込み経路: `App.tsx` の `persistProgress` effect（`progressionSnapshotOf(state)`）と、R8 の `pendingRound` ジャーナル（焼いた後に中断したラウンドを起動時に `settlePendingRound` で完了）。
- 読み込み時の移行: `state/startup.ts` `buildStartup` が `resolveShopEntitlement` → `createInitialGameState` を毎回実行（冪等）。

### 2.4 既存テストの分布（発見に依存するもの、`main` 39d6b5b 時点の grep 計数）

| 群 | 件数（ファイル） | 主な内容 |
|---|---|---|
| ユニット/コンポーネントテスト全体 | 686 | — |
| ラダー・解放・Shop 価格（`discoveryLadder|materialEntitlement|materialShop` を参照） | 162 | ラダー凍結・追記専用・starGate・各 Batch の段番号 |
| 発見結果（`isDiscovered|NEW_DISCOVERY|justDiscovered` 等） | 125 | 発見・RESULT 表示 |
| ヒント・研究（`discoveryHint|researchTarget|trialNotebook|researchExclusions`） | 105 | Hint 3.0/5.0・Research 2.0 |
| Free Cooking（`START_FREE_COOK|freeCook`） | 129 | 自由調理経路 |
| Lunch Rush / Dinner | 123 | プール・解放・精算 |
| reducer テスト（`gameReducer.*.test`） | 67（うち `REGISTER_TO_DEX` を使う 35） | — |
| 永続化（`persistence*.test.ts`） | 28 | 互換ゴールデン・前方互換・各 Batch |
| 章・Pizza Select | 22 | — |
| `progression` / `recipeDiscoveryState` | 26 | — |
| Pitz・経済 | 50 | — |
| 技法 | 9 | アフォーダンス段 |
| App / Home / Dex / Shop 画面 | 21 / 3 / 5 / 4 | — |
| e2e spec 全体 / `discovery-*` / Dex を seed するもの | 163 / 19 / 104 | — |

これらの大半は「legacy モデルの正しさ」を固定しているテストであり、**Phase 1 ではすべて無変更で通ること**を完了条件にする（§3.4）。

---

## 3. Phase 1（基盤）の設計

### 3.1 方針: Scoring 2.0 と同じ「Shadow → Authority 切替 → Legacy 退役」

このリポジトリには、旧ロジックを残したまま新ロジックを並走させ、検証後に権威を切り替え、最後に旧ロジックを消した前例がある（Scoring 2.0: Shadow → A1 Authority Cutover PR #60 → A3a/A3b Legacy Retirement PR #62/#63）。B案も同じ 3 段で進める。

- **Phase 1 の成果は「フラグ OFF で挙動が 1 バイトも変わらない基盤」**。新しい状態・型・純関数・セーブフィールドの読み書き・移行関数・フラグを入れるが、Production では legacy が権威のまま。
- 調理系（C5）・matcher（C3）・Scoring 2.0 component には触れない。

### 3.2 構成

#### 3.2.1 フィーチャーフラグ — 切り替え単位は「進行モデル」1 つ

```ts
// src/logic/progression/progressionModelFlag.ts（新設）
export type ProgressionModelId = "legacy" | "shop";
const PROGRESSION_MODEL_PRODUCTION_DEFAULT: ProgressionModelId = "legacy";
export function progressionModelId(): ProgressionModelId;
```

- 既存の `hint5Flag.ts` と同じ形にそろえる: Production 既定は定数 1 か所、Preview/DEV のみ `?progression=shop|legacy`（Preview 専用キーに記憶）、DEV のみ `localStorage["teto.dev.progressionModel"]`。Production ビルドに DEV キーが残らないことは既存の `previewIsolation.gate.test.ts` の走査対象に追加する。
- **切り替え単位を 1 つにする理由**: 材料解放・章・注文プール・Lunch Rush/Dinner 解放・技法アフォーダンスは互いに整合している必要がある（例: 章が評判で開いているのに材料がラダー段で閉じている、は不整合）。機能ごとの個別フラグにすると組み合わせ爆発する。
- 段階投入が必要な UI（Home の表示、メニュー開発の改称）は、同一フラグの下で Phase 2 以降に順次接続する。Phase 1 では UI に何も出さない。
- フラグはビルド単位で、**セーブ単位ではない**。shop で遊んだセーブを legacy ビルドで開いても壊れないこと（§3.3）を互換要件にする。

#### 3.2.2 進行モデルの差し込み口（port）

`gameReducer.ts` は HOT ファイル（160KB）なので、**reducer 内の分岐は最小**にし、導出をすべて 1 つの interface に寄せる。

```ts
// src/logic/progression/progressionModel.ts（新設・純関数のみ）
export interface ProgressionInputs {
  dex: DexState;
  ownedIngredientIds: readonly string[];
  unlockedForShopIngredientIds: readonly string[];
  inventory: InventoryState;
  shop: ShopProgressState;            // §3.2.3（legacy では読まない）
}
export interface ProgressionModel {
  id: ProgressionModelId;
  /** 材料の Shop 解放（union で再ロックしない）。resolveShopEntitlement の置き換え先。 */
  resolveEntitlement(inputs: ProgressionInputs): ShopEntitlementResult;
  /** レシピの章番号。 */
  chapterOf(recipe: Recipe): number;
  /** 章が開いているか（legacy は常に true = 章は表示上の区分だけ）。 */
  isChapterOpen(chapter: number, inputs: ProgressionInputs): boolean;
  /** 注文・ガイド付きラウンド・Lunch Rush/Dinner が使えるレシピ（= メニュー）。 */
  menuRecipeIds(inputs: ProgressionInputs): readonly RecipeId[];
  /** 技法アフォーダンス用: その材料が使える段階に達しているか。 */
  isMaterialReached(ingredientId: string, inputs: ProgressionInputs): boolean;
}
export const LEGACY_PROGRESSION: ProgressionModel;   // 現行関数をそのまま包むだけ
export const SHOP_PROGRESSION: ProgressionModel;     // §3.2.3〜3.2.4
export function activeProgressionModel(): ProgressionModel;
```

- `LEGACY_PROGRESSION` は既存関数（`resolveShopEntitlement`, `recipeChapter`, `discoveredRecipeIds`, `creditedDiscoveredCount` 比較）への**委譲だけ**で作る。新ロジックを書かない。
- 呼び出し元の付け替えは Phase 1 で行うが、legacy 委譲なので出力は同一。これを「flag OFF 等価テスト」（§3.4）で固定する。
- `RoundKind`（`state/roundKind.ts`、現在 `"GUIDED" | "FREE_COOK" | "LUNCH_RUSH" | "DINNER"`）への値追加（例: `"SERVICE"`）は Phase 2 で注文システムを入れるときに行う。Phase 1 では追加しない。

#### 3.2.3 新しい状態の持ち方

```ts
// GameState に 1 フィールドだけ追加（ネストして reducer の diff を小さくする）
shop: ShopProgressState;

export interface ShopProgressState {
  /** 評判。単位・上限・減少の有無は §6 Q1。Phase 1 は値を読むだけで増やさない。 */
  reputation: number;
  /** メニュー開発以外でメニューに入ったレシピ（初期メニュー・章の付与など）。union のみ。 */
  grantedMenuRecipeIds: readonly string[];
  /** 旧セーブから評判を一度だけ導いた記録（§3.3）。null = 未実施。 */
  reputationSeed: { source: "legacy-dex"; value: number } | null;
}
```

- **メニュー = Dex の discovered ∪ `grantedMenuRecipeIds`**（採用集合でのフィルタは §3.2.4）。メニュー専用の一覧を別に持たない理由:
  1. 「発見済み → メニュー解放済み」の寄せが**導出だけで常に成立**し、一回限りの移行処理が不要。
  2. メニュー開発（=発見）は今後も `registerScoreToDex` が Dex に書く。BEST・★・timesMade も Dex のまま。二重管理にならない。
  3. legacy ビルドへ戻しても Dex はそのまま有効。
- 注文（Phase 2）は既存の Order/ORDER フェーズを再利用する。`getNextFreeOrder` の `guidedRecipeIds` を `menuRecipeIds ∩ 調理可能` に替えるだけで「解放済みメニューから生成」が成立する（現行の guided 注文はすでに「発見済み ∩ 調理可能」から生成しており、報酬も出来栄え連動）。

#### 3.2.4 厳選 60 品（採用集合）の持ち方

- `RECIPES` からは**削除しない**。理由: `persistence.ts` の sanitizer は `RECIPES` に無い ID を `GameState` に読み込まない（保存上は前方互換で残るが、ゲームからは見えなくなる）。削除すると旧セーブの BEST・発見が見えなくなり、後で有効化する手間も増える。
- 新設データ `src/data/menuCatalog.ts`:
  ```ts
  export interface MenuCatalogEntry { recipeId: RecipeId; chapter: number }
  export const MENU_CATALOG_ID = "curated-60-v1";        // 改訂ごとに id を変える（Ladder の populationId と同じ考え方）
  export const MENU_CATALOG: readonly MenuCatalogEntry[] = [];   // Phase 1 は空、選定は Owner
  ```
  章はここで**レシピごとに明示する**（導出しない）。材料の章は「その材料を使う採用レシピの最小章」で導出し、例外だけ上書き表で持つ。
- 不採用レシピの扱い: `RECIPES`・`ORDERS`・matcher のカタログ・Dex には残る。shop モデルでは「メニューにならない／注文に出ない／章に現れない」。後から有効化 = `MENU_CATALOG` に 1 行足すだけ。
- コンテンツトレイン（`tools/train-kit`、Issue #780）との関係: 新規レシピは従来どおり `RECIPES` に入り、採用集合への追加は別操作になる。kit 側への追記は Phase 3 で扱う（Phase 1 では kit に触れない）。

#### 3.2.5 Scoring 3.0（Issue #176）との接続点

- Issue #176 の Scoring 3.0 = 監査 §3 の PR-F（CUT と `total` の関係: Option A/B/C）で、**Owner の選択待ちのまま未実装**。
- shop モデルの報酬・評判は `ScoreBreakdown` を直接読まず、1 つのアダプタだけを通す:
  ```ts
  // src/logic/progression/serviceQuality.ts（新設）
  export interface ServiceQuality { total: number; stars: QualityStars; cutScore: number | null }
  export function serviceQualityOf(score: ScoreBreakdown, cut: CutEvaluation | null): ServiceQuality;  // CutEvaluation = logic/cut/types.ts
  ```
  Pitz は既存 `applyPitzCredit(base, quality.total, …)`（pitzReward.ts はもともと抽象的な 0-100 を受ける設計）、評判は `reputationGainOf(quality, table)`。
- PR-F がどの Option になっても、変わるのはアダプタの中身だけ。Option B（CUT の上限付き加算）なら `total` に入ってくるので評判も自動で追従、Option C（独立）なら `cutScore` を評判だけに使う選択肢が残る（§6 Q9）。

#### 3.2.6 評判の獲得表（数値は未定のまま型だけ入れる）

- Dinner の前例（`timeLimit: { seconds: null }` = 未調整なら START 不可）に合わせ、`REPUTATION_TABLE` の各値を `number | null` で持つ（章の下限値は Q12 により長さ 5 の配列。注文ごとの獲得量・メニュー開発の評判ボーナス（Q5）も同じ表に null で置く）。**null が 1 つでもあれば shop モデルは有効化できない**ことを gate テストで固定する。これで「数値を独断で決めない」を機械的に守る。

### 3.3 セーブ互換の方針

| 要件 | 方式 |
|---|---|
| schema | `schemaVersion: 2` のまま、**トップレベルキー `shopProgress` を追加**（bump しない）。前例: `unlockedForShopIngredientIds` / `discoveryHintFacts` / `discoveredTechniqueIds` / `researchExclusions` |
| 旧セーブで起動 | キー無し → `{ reputation: 0, grantedMenuRecipeIds: [], reputationSeed: null }` と読む |
| 発見済み → メニュー | 導出で常に成立（§3.2.3）。移行コード不要 |
| 材料 | `unlockedForShopIngredientIds` は union のみなので、legacy で開いた材料は shop でも開いたまま。**材料が再ロックされることはない** |
| 評判の初期値（旧セーブ） | ~~shop モデルで初めて起動したときに `reputationSeed` が null なら、Dex から評判を一度だけ導いて記録（関数は純関数、数式は §6 Q3）。以後は再計算しない~~ → **2026-11-26 の Owner 判断で上書き（旧セーブは対象外）**：seed は作らない（§6 Q3） |
| ロールバック（shop → legacy ビルド） | legacy ビルドは `shopProgress` を未知キーとして保持（`extras.topLevel`）。Dex・材料・Pitz は共通なので legacy で遊べる。再び shop に戻ると評判はそのまま |
| マージ規則 | 複数タブ・ロールバック対策で、`grantedMenuRecipeIds` は union、`reputation` は **max**（=評判は減らない前提）。減る設計にする場合は max マージが使えないので §6 Q1 と連動 |
| 不正値 | 既存 sanitizer と同じ fail-soft（負・NaN → 0、未知レシピ ID は前方互換で保持しゲームでは無視） |
| 保護 | Save Protection（future version / corrupt の書き込み拒否）・R8 `pendingRound` ジャーナルは変更しない。通常営業ラウンドもジャーナル経路に乗る（Phase 2 で確認） |
| ネイティブ | 同一形式のため追加対応なし |

テスト: `persistence.compat.golden.test.ts` に「`shopProgress` あり／なし」両方のゴールデンを**追加**し、既存ゴールデンは変更しない。

### 3.4 既存テストへの影響範囲

**原則: Phase 1 では既存テストを 1 件も書き換えない・削除しない・緩和しない。** フラグ既定が legacy で、legacy 実装は既存関数への委譲なので、通るのが完了条件。

追加するテスト（Phase 1）:

| 追加 | 内容 |
|---|---|
| `progressionModel.legacyEquivalence.test.ts` | 代表セーブ群（空・初回発見前・中盤・starGate 前後・late floor 境界・全発見）で `LEGACY_PROGRESSION` の各出力が現行関数と一致 |
| `gameReducer.progressionFlagOff.test.ts` | flag OFF で REGISTER_TO_DEX / MISSION_NEXT_ORDER / 起動の state が付け替え前と同一（`hint5.flagOff` と同じ形） |
| `progressionModelFlag.test.ts` | Production 既定 legacy、Preview/DEV の切り替え、Production に DEV キーが無い |
| `persistence.shopProgress.test.ts` | 読み込み既定値・sanitize・union/max マージ・ロールバック保持・前方互換 |
| `shopProgression.test.ts` | shop 実装の純関数（章・材料解放・メニュー導出）を**合成カタログ**で検証（本物の 60 品選定前でも書ける） |
| `reputationTable.gate.test.ts` | 表に null があれば shop を有効化できない |

Phase 2 以降で影響を受ける群（書き換えではなく**モード別の追加**が基本）:

| 群 | 影響 | 方針 |
|---|---|---|
| ラダー・解放（162） | legacy の正しさとして有効 | そのまま。shop 用の解放テストを別ファイルで追加 |
| 章・Pizza Select（22） | 章の出所が変わる | legacy 固定で残し、shop 版を追加 |
| Lunch Rush / Dinner 解放・プール | 判定がメニュー経由になる | legacy で同値。shop の追加ケース |
| 技法アフォーダンス（9） | 判定式が変わる | 同上 |
| REGISTER_TO_DEX 系 reducer（35） | shop では評判・メニュー開発ボーナスが加わる | legacy は不変、shop 用 reducer テストを追加 |
| Home / Dex / Shop / RESULT コンポーネント・e2e | 文言・表示（「発見」→「メニュー開発」等） | Phase 2b 以降。文言を固定している e2e は **shop 用 spec を追加**し、legacy spec は legacy フラグで走らせ続ける |
| 経済シミュレーション | 前提が変わる | legacy は残し shop 用を追加 |

退役段階（Phase 5）で legacy 専用コードを消すときに、そのコードだけを検証しているテストの扱いが問題になる（§6 Q11）。

---

## 4. Phase 2 以降の実装順序案

| Phase | 内容 | 完了条件 |
|---|---|---|
| **1a** | フラグ・`ProgressionModel` port・`LEGACY_PROGRESSION`（委譲）・呼び出し元付け替え | 既存全テスト無変更で green（Vitest 3 shard + e2e + WebKit Gate）。等価テスト追加。UI 変化ゼロ（HV 不要） |
| **1b** | `ShopProgressState` 型・`GameState.shop`・セーブ `shopProgress` の読み書き・評判 seed 関数（純関数）・`MENU_CATALOG`（空）・`REPUTATION_TABLE`（全 null） | 1a と同じ＋互換ゴールデン追加。Production の保存 JSON は `shopProgress` 未書き込みで不変（既定値なら書かない） |
| **2a** | **注文システム**: `SHOP_PROGRESSION` 実装、通常営業ラウンド（`RoundKind` 追加、ORDER フェーズ再利用、メニュー ∩ 調理可能から注文、出来栄え連動 Pitz、評判加算） | Preview でのみ有効（`?progression=shop`）。Owner が評判表・初期メニューを確定済み。HV（390×844 動画＋スクショ）PASS |
| **2b** | **発見の付け替え**: Free Cooking を「メニュー開発」へ改称・導線変更、初回発見ボーナス→メニュー開発ボーナス、RESULT/Home/Dex の文言、入荷通知を評判到達に | 情報漏れ防止（LK-8・Research Contract 2.1）の既存テストが shop でも green。HV PASS |
| **3** | **厳選適用**: `MENU_CATALOG` に 60 品と章を投入、材料の章割当（5 章、Q12）、Lunch Rush/Dinner のプール・解放をメニュー経由に、ヒント対象の絞り込み、train-kit への「採用集合」手順追記 | 60 品すべてが章到達後に調理可能（到達可能性テスト：既存 `ladderReachability` の shop 版）。旧セーブ移行（seed）の Owner 承認済み数式で HV |
| 3a | **（2026-11-26 実装、PR #912）** `MENU_CATALOG`（`curated-60-v1`）に Owner の 60 品と段階を投入。shop の段階・メニュー（注文・Lunch Rush）・図鑑／HOME の図鑑ピル／Pizza Select を 60 品ベースに。材料の段階は Phase 2a の暫定規則のまま | `docs/reports/TETO_B-PHASE-3A_CATALOG_Result.md` |
| 3b | **（2026-11-26 実装、PR #915）** 食材の段階解禁（77 種＝17／9／13／23／15、第4段階の後半 12 種は評判 275、上書き表なし）。メニュー開発に段階の条件（Owner 決定 2026-11-27）。段階前の完全一致は「判明」として図鑑に記録し、段階が開いたら自動でメニュー入り（開発ボーナスはそのとき 1 回だけ）。研究・ヒント候補は開いている段階のレシピだけ。昇格バナーに段階で開いたもの（R4 #13 の材料入荷を含む） | `docs/reports/TETO_B-PHASE-3B_STAGES_Result.md` |
| 3c・3d | 研究ポイント・判明ヒント | — |
| 3e | 特別注文（Dinner）のメニュー経由解放、ヒント／開発対象の 60 品への絞り込み、不採用の完全一致をオリジナルピザ扱いに（Q4） | — |
| **4** | **Authority 切替**: Production 既定を `shop` に | Owner 承認。旧セーブ（各進行段階の代表）での起動 HV。ロールバック手順（既定を legacy に戻す 1 行）を Result Report に明記 |
| **5** | **旧構造撤去**: ラダーの解放用途・`LATE_ENTITLEMENT_FLOORS`・legacy 章導出・発見数ベースの技法判定・legacy 分岐の削除（ラダーデータは価格の出所として残すか判断） | Owner 承認。撤去対象コードの参照 0（grep）、セーブ互換ゴールデン green、legacy 専用テストは §6 Q11 のとおり、撤去 PR に一覧表を載せ Owner 承認を得てから移設／削除 |

順序の理由: 注文（2a）を先にするのは C2「通常営業が主目的」を最初に体験で確認するため。発見の付け替え（2b）は 2a の報酬・評判が動いてからでないと「ご褒美」の比重を判断できない。厳選（3）は Owner の選定作業が並行できるので、2a/2b と独立に準備し、投入だけ後にする。

並行性: 1a は `gameReducer.ts`・`App.tsx`・`materialEntitlement.ts` を触る HOT 変更なので、コンテンツトレイン（#780）や他の reducer 変更と衝突しやすい。Session Operations §1 の claim を Issue 上に置き、merge 順を明記してから着手する。

---

## 5. Phase 1 の PR 分割案（参考）

1. **PR-1a**: `progressionModelFlag.ts` ＋ `progressionModel.ts`（legacy 委譲のみ）＋ 呼び出し元 3 系統の付け替え（解放 3 か所、章、技法 4 ファイル）＋ 等価テスト。挙動不変。
2. **PR-1b**: `ShopProgressState` ＋ セーブフィールド ＋ seed 関数 ＋ 空カタログ・null 表 ＋ gate テスト。挙動不変。

どちらも UI 変化が無いため HV 対象外（`TETO_HUMAN-VERIFICATION-POLICY.md` の適用対象は UI/UX/gameplay 変更）。

---

## 6. リスクと要確認事項（推奨案つき）

### 仕様側の論点 — Owner 回答（2026-11-25、確定）

初版（commit `2aee550`）で推奨案つきで列挙した Q1〜Q12 に、Owner が回答した。以下はその記録で、**数値そのもの（評判の閾値・獲得量・評判ボーナス額）は引き続き未定**。

| # | 論点 | Owner 回答 | 設計への反映 |
|---|---|---|---|
| Q1 | 評判は減るか | **下がらない（累積のみ）** | §3.3 の `reputation` max マージの前提が確定 |
| Q2 | 新規プレイヤーの最初のメニュー | **マルゲリータ 1 品を付与**（`grantedMenuRecipeIds`） | 注文プールが空になる状態を作らない |
| Q3 | 旧セーブの評判の初期値（seed） | ~~**解放済みの材料がそろう章の下限値**。ただし**判定は採用 60 品が使う材料だけで行う**（不採用レシピ由来の解放材料は章判定に使わない。Q10 のメニュー残留とは別扱い）~~ → **2026-11-26 の Owner 判断で上書き（旧セーブは対象外）**：リリース前なので旧セーブは気にしない。seed は作らない | ~~`reputationSeed` に一度だけ記録し、再計算しない（§3.3）~~ → `reputationSeed` は持たない（Phase 1b PR #906 で除外済み）。`shopProgress` の無いセーブは評判 0 から始まる |
| Q4 | メニュー開発とヒントの対象 | **採用 60 品に限定**（不採用は完全一致しても「オリジナルピザ」扱い、ヒント対象外）。Q10 の例外を除く | matcher の判定自体は不変（C3）。結果の分類だけを採用集合で分ける |
| Q5 | メニュー開発ボーナス | **現行の初回発見 +50 Pitz を維持**。評判ボーナスは獲得表に未定（null）で予約 | OD-02 の数値を動かさない。§3.2.6 の null gate の対象に評判ボーナスも含める |
| Q6 | 手際ボーナス（CT2） | **付ける**。現行 FREE の guided 注文に既に付いている手際ボーナスが、通常営業でもそのまま付く | §2.1-C。新規ロジックは不要 |
| Q7 | Pizza Select | **報酬なしの「練習」として残す**（Pitz・評判は付けない） | 報酬の二重経路を作らない。**Phase 2b で実装**：`RoundKind` に `PRACTICE`（shop のみ）。Pizza Select と「もう一度」が練習、FREE の Mito 注文が注文。R8 ジャーナルは `GUIDED` ＋ `practice: true` で種別を保つ（`docs/reports/TETO_B-PHASE-2B_PRACTICE-AND-COPY_Result.md`） |
| Q8 | Lunch Rush / Dinner | **候補をメニューに読み替えるだけで据え置き。ランキング（`lunch-rush-v1`）は変えない** | 判定関数の差し替えのみ |
| Q9 | #176 の CUT の扱い | **B案側では今決めない**。§3.2.5 のアダプタで受けるので、PR-F の決定を待たずに進める | Scoring 3.0 たたき台ではボーナス扱いが候補（参考情報） |
| Q10 | 旧セーブで発見済みの不採用レシピ | ~~**メニューに残す（取り上げない）**。表示上は「特別メニュー」等で区別。**章や数の数え方には含めない**~~ → **2026-11-26 の Owner 判断で上書き（旧セーブは対象外）**：「特別メニュー」としての残留は不要 | メニュー = （初期メニュー ∪ granted ∪ Dex discovered）∩ 採用集合（Phase 2a `shopProgression.ts`）。不採用レシピはメニューに入らない |
| Q11 | 旧構造撤去時の旧モデル専用テスト | **Scoring 2.0 A3b の前例どおり、撤去 PR で対象テストの一覧表を提示し、Owner 承認のうえで移設／削除を判断する** | 無言で消さない。Phase 5 の完了条件に「一覧表の Owner 承認」を含める |
| Q12 | 章の数 | **5 章で確定**（厳選リストの 5 段階 × 12 品と一致）。**評判の表は 5 章分（章の下限値 5 つ・境目 4 つ）で扱う**。数値は未定 | `REPUTATION_TABLE` の章下限は長さ 5 の配列（値は null）。Q3 の seed 計算もこの 5 行を使う |

その他の Owner 回答（同日）:

- Phase 1a 着手前に Issue 上で作業宣言（claim）を出し、マージ順を決める: **了承**。対象 Issue は別途決める。
- 章と価格の分離（価格はラダーのまま、章は `MENU_CATALOG` で明示。R1）: **了承**。
- starGate（R2）: **評判ゲートへの吸収で了承**。OD-420-1（goat-cheese 120★ / spinach 130★）は「legacy 限定」と明記する。
- 発見数を前提にした過去の決定（Hint 5.0 の対象集合 OD-H5-M2、`ladderCredit` 等。R4）: 読み替え表を **Phase 2b 着手前にまとめて確認**する。

### 仕様側で引き続き未定のもの

- ~~評判の数値（章の下限値 5 つ、注文ごとの獲得量、メニュー開発の評判ボーナス）~~ → **Owner 承認（2026-11-26）**：章の下限 0／40／110／210／340、注文の獲得 ★1 +1／★2 +2／★3 +3／★4 +5／★5 +8、メニュー開発の評判 +3（Pitz +50 は従来どおり）。Phase 2a で `REPUTATION_TABLE` に反映
- ~~厳選 60 品の選定と各品の章（`MENU_CATALOG`）~~ → **Owner 決定（2026-11-26）、Phase 3a で投入**（第1段階 評判 0／第2段階 40／第3段階 110／第4段階 210／第5段階 340、各 12 品。一覧は `src/data/menuCatalog.ts`）
- ~~材料の章割当の例外（Phase 3b）~~ → **Owner 決定（2026-11-27）、Phase 3b で実装**：上書きはしない。例外は第4段階の章内分割だけ（後半 12 種は評判 275）。段階より材料が早くそろうレシピは、メニュー開発に段階の条件を足して扱う（段階前の完全一致は「判明」→段階到達で自動メニュー入り）
- ~~「特別メニュー」（Q10）の表示仕様（Phase 2b の UI 設計で扱う）~~ → 2026-11-26 の Owner 判断で不要（Q10）
- R4 の読み替え表（Phase 2b 着手前）

### コード都合で仕様と衝突しうる点

| # | 衝突・リスク | 推奨対応 |
|---|---|---|
| R1 | **章と価格の結合**: 現行は章も材料価格もラダー段の価格帯から導出。評判で章を決めると、価格帯（T1〜T4）と章が食い違う | 価格はラダー段のまま、章は `MENU_CATALOG` で明示。解放と価格を分離（§2.1-B）。**Owner 了承（2026-11-25）** |
| R2 | **starGate（goat-cheese 120★ / spinach 130★）** は Owner 決定（OD-420-1）による累計★ゲート | **Owner 回答（2026-11-25）: 評判ゲートに吸収**。OD-420-1 は「legacy 限定」と明記する |
| R3 | **late catalog の互換床（`LATE_ENTITLEMENT_FLOORS`）** は発見数基準 | shop では章割当に吸収。legacy 側は Phase 5 まで不変 |
| R4 | **`ladderCredit:false` の 12 品**（ラダーを進めない）や **Hint 5.0 の対象集合（OD-H5-M2）** など、発見数を前提にした過去の Owner 決定が複数ある | Phase 2b 着手前に、発見数を前提とする decision record を一覧化し「legacy 限定」か「shop へ読み替え」かを Owner に確認。**Owner 回答（2026-11-25）: Phase 2b 着手前にまとめて確認** |
| R5 | **`gameReducer.ts` の HOT 性**（160KB、67 の reducer テスト、並行トレイン） | port に寄せて reducer 差分を最小化。PR を小さく分ける。claim で merge 順を宣言 |
| R6 | **情報漏れ防止（LK-8 / Research Contract 2.1 / Dex シルエット）**: 未メニュー化レシピの名前・見本を出さない原則 | `menuRecipeIds` を唯一の判定にし、注文・Pizza Select・Dinner 表示が必ずそれを経由するよう `canStartGuidedRound` を内部で差し替える |
| R7 | **報酬の二重計上**: 通常営業の per-pizza 報酬と Lunch Rush の run 報酬 | 既存の `isMissionRound` ガードを維持。通常営業は FREE 側の経路に乗せる |
| R8 | **評判の数値が未定のまま実装が進む**と、仮の値が既定値として固定される | 表を `null` 必須にし、null が残る限り shop を有効化できない gate テスト（§3.2.6） |
| R9 | **旧セーブの seed がロールバック往復で再計算される** | `reputationSeed` を記録し、記録済みなら再計算しない。max マージで値は下がらない |
| R10 | **e2e の Dex seed（104 spec）** は「発見済み」を前提に画面を開く | legacy フラグで走らせ続ける。shop 用は seed ヘルパー（`e2e/support`）に shop 用関数を追加。support は HOT なので Phase 2a で一括 |

---

## 7. 調査メモ（再現用）

- 計測はテストランナー上の一時プローブ（`RECIPES` / `INGREDIENTS` / `DISCOVERY_LADDER` / `buildRecipeChapters` / `ORDERS` / `DINNER_MISSIONS` を集計）で行い、実行後に削除した。リポジトリへの残留なし。
- テスト件数は `grep -rlE` によるファイル数で、正規表現は §2.4 の群名のとおり。参照の有無を数えたもので、失敗しうる件数ではない。
- オープン PR（2026-11-25 時点）に B案・進行モデルを扱うものは無い（重複なし）。
