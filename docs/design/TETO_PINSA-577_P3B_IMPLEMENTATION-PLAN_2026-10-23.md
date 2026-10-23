# #577 Pinsa Romana P3-b — 実装計画・依存・リスク・最初のタスク（docs-only 提案）

Status: **P3-b-0 で Owner 判断（2026-10-23）を反映済み。計画のみ。** `src/**`・`e2e/**`・workflow・データ・CSS・本番スイッチ・共有 Preview は変更していない。**P3-b の実装は開始していない（HOLD 継続）。** #639 / #640 の branch、CI、merge には触れていない。本番 FINISH（`FREE_COOK_FINISH_PRODUCTION`）・Late Catalog（`LATE_CATALOG_PRODUCTION`）は OFF。
基準 `main` = `cea6904`（#638 = L1 決定記録、#642 = b2 安定化が merge 済み）。作成日 2026-10-23。Issue #577。
**この文書の「推奨」は助言であり Owner Decision ではない。** 決定済みの事項は `docs/decisions/TETO_PINSA-577_P3_L1-DECISIONS_2026-10-23.md`（L1 / D1〜D8）が SSOT。

## 1. 確認した資料と現状

| 資料 | 使い方 |
|---|---|
| `CLAUDE.md` / `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` | UI/UX/gameplay の変更は HV 動画（390×844、リポジトリに commit しない）＋ before/after スクショが DoD。**本番 OFF でプレイヤーに見えない変更は HV 不要**（Policy §2）。ON は E5 で HV 必須 |
| L1 決定記録（#638、main） | P3-b の範囲・D1〜D8・D3 漏えい防止 T1〜T6 |
| `TETO_DOUGH-KIND_PINSA_DETAILED-DESIGN.md`（§1 識別軸、§4 判定、§5 ヒント・保存、§6 UI、§8 PK-1〜22） | 仕様の根拠。**§7（4 食材すべて焼成前）は L1 で上書き**、§5.6 の一部も下記 §6 のとおり訂正が要る |
| `TETO_DOUGH-KIND_P3_DECISION-MATERIALS.md` | 原典（PK-0）の状況、Q5〜Q8 |
| コード（main） | `src/logic/dough/doughKind.ts`、`src/state/doughSelection.ts`、`src/logic/techniques/*`、`src/data/{techniques,lateCatalog,discoveryCatalog,recipeSauceProfiles,recipeHintRoles,referencePizza}.ts` |

### 1.1 実装状況

| 項目 | 状態 | 備考 |
|---|---|---|
| P1（`dough` 軸 OBSERVED・`PizzaState.dough?`・`Recipe.doughKind?`・技法 `dough-pinsa-romana` と `late-addition`・`DOUGH_VARIANT`） | **main 済み**（不活性） | `dough` の値が描画へ届く経路は無い（`signature.ts` の識別軸と `GameScreen` のチップ選択状態だけが読む） |
| P2（`SELECT_DOUGH`・生地チップ・`?doughSwitch=open` Preview フラグ） | **main 済み**（affordance は本番で閉） | チップは文字ラベル「ふつうの生地」「ほかの生地」。技法発見後だけ 2 つ目が「ピンサ生地」 |
| 後乗せカタログ（FIN-E4、ikura まで） | **main 済み**（OFF） | `LATE_*` の 6 表＋`mergeLate`＋`validateLateCatalog` |
| P3-0（#638、L1 決定記録） | **main 済み** | |
| **P3-a1**（#639: Guided 開始時・`RESET_PIZZA` で `pizza.dough` をレシピの `doughKind` から設定） | **open / HOLD**。HEAD `fcc0f0d`。Codex 指摘 0。WebKit Gate は apt 取得停止で RED（#643、同 HEAD への唯一の再実行も install 停止）。コード由来の失敗は確認されていない | P3-b の**前提** |
| **P3-a2**（#640: `ladderCredit:false` 例外と strict 検証・`discoveryIdentityOf` が `doughKind`/後乗せを読む） | **open / HOLD**。HEAD `07de06b` | P3-b の**前提** |

→ **P3-b のコードは #639・#640 の merge 後でなければ書けない**（型 `doughKind?`/`ladderCredit?`・validator 例外・識別の導出に依存）。docs の準備（本書）はそれと独立に進められる。

## 2. P3-b の仕様整理

### 2.1 描画（結論: **新しい描画は無い**）
- `PizzaState.dough` は描画コードから読まれない（`rg "pizza\.dough"` は `signature.ts`・`doughSelection.ts`・`pendingRound.ts`・`GameScreen`（チップの選択状態）のみ）。Pinsa は **M0 = 丸いまま・CUT なし・同じ生地ビジュアル**（楕円 F5 は未表現。Result に「原典は楕円、本 slice では未表現」と明記する条件が L1 決定記録 §5 にある）。
- 新規の描画は、(a) Pinsa の **Reference pizza**（`referencePizza.ts`、8 スロットリング、非ソース 7 piece 以内）、(b) 後乗せのルッコラ（FINISH 工程の既存描画。ikura の `salmon-roe-grains` のような専用ビジュアルは**不要**: `arugula` は通常素材で描画済み）、(c) 図鑑・RESULT のレシピ名と説明文（**時機を示さない**）だけ。
- Reference 上のルッコラの位置は calibration（Owner が実機 HV で調整。R4）。

### 2.2 操作
- **新しい操作は無い。** ○/□ とは独立した P2 のチップ（Free Cooking / Research、DOUGH 工程、affordance 開）で「ほかの生地」を選ぶ → 通常の調理 → FINISH（`finish-bar` の既存フロー）でルッコラを後乗せ。
- Guided（図鑑から選ぶ）: チップは出ない。#639 により開始時に `dough` が立つ。Pinsa の Guided は**後乗せ（FINISH）が必須**なので、FINISH が本番 OFF の間は実質プレイ不能（= Late Catalog OFF と同義で、本番では Pinsa 自体が存在しない）。
- Lunch Rush / Dinner: 対象外（`lunchRush:false`、Dinner は固定リスト。PK-19 のガードテストを追加）。

### 2.3 判定
- Pinsa の identity = 食材集合（tomato-sauce / mozzarella / prosciutto-crudo / arugula）∧ `dough = material-multigrain-long-ferment` ∧ `late = [arugula]`（値の表現は #640 の `discoveryIdentityOf` が決める。P3-b-1 でレシピ → target の導出に一致することをテストで固定）。
- L1 の判定表（#640 の 16 行テストが合成 target で固定済み）を**実カタログ（ON 相当）に置き換える**: 標準生地＋後乗せなし = jamon（NEW/ALREADY）／標準生地＋ルッコラ後乗せ = ORIGINAL（D2）／Pinsa＋ルッコラ後乗せ = `pinsa-romana`／Pinsa＋全部焼成前 = ORIGINAL／Pinsa＋tray = ORIGINAL。
- Completion Gate・採点・Pitz・★・ランキングは生地を読まない（INV-TQ-3、変更なし）。
- 技法: `dough-pinsa-romana` と `late-addition` は既存の usage / recipe 経路でそのまま記録される。**ON のとき `late-addition` の affordance は ikura（ladder 長 + 1 = 56）から Pinsa（arugula = step 33）へ前倒しされる**（D3。許容。漏えい防止テスト T1〜T6 が必要）。

### 2.4 保存
- save スキーマ・`schemaVersion` は変更しない。増えるのは図鑑の recipe id `pinsa-romana` と技法台帳の既存 id だけ（前方互換の既存経路）。
- **設計書 §5.6「`PizzaState.dough` は永続しない」は main と食い違う**: `pendingRound.ts` のジャーナル（l.128 / l.171）は `pizza.dough` を保存・復元しており、#639 のテストがこれを固定している。P3-b-0 で §5.6 を訂正する（ラウンド途中の復元のみ。図鑑・ladder には影響しない）。
- 旧 save → 新ビルド、新 save → 旧ビルドの往復（PK-16）と、既存 save への影響テスト（dex・pitzBalance・解禁済み素材が不変、Pitz 二重付与なし）を P3-b で追加。

## 3. 既存の調理工程との互換性

| 工程 | 影響 | 確認方法 |
|---|---|---|
| DOUGH（○/□・チップ） | 変更なし。両方開のとき 1 行（P2 で実測済み、360×800） | 既存 `dough-kind-chips-p2.spec.ts` を流用 |
| SAUCE / CHEESE / TOPPING | **変更なし**（`tomato-sauce` PAINT。jamon と同じ 4 食材。新ソース無し） | `recipeSauceProfiles` の行追加のみ。ladder/hint は jamon と同一 |
| BAKE | 暫定 bake 58–78（D4。実測前に正式確定しない） | calibration は E5 の実機 |
| FINISH | ルッコラのみ POST_BAKE。生ハムは焼成前（L1）。**通常素材なので後乗せ専用の描画・解禁は不要** | `finish-*` 既存 E2E は不変であること |
| CUT | なし | `cookingProfiles` の CUT 対象外が validator と整合（P3 監査項目） |
| Hint / Research | ladder は jamon と同一。`recipeHintRoles` に行が必要（`keyFree` 推奨、G17 で確定）。Research の候補が 1 → 2 件（コホート文字 A/B） | PK-14 / PK-15（HOME 直行・Pizza Select・Hint シートのテスト一覧化） |
| 図鑑・章 | key step は jamon と同じ（arugula = 33）。K2（#637）により**後乗せカタログのレシピは章の ✓ 判定から除かれる**。章 4 の見え方は D7 で E5 HV 判断 | `recipeChapters` / K2 の既存テスト＋ON 差分 |
| Late catalog | `LATE_LADDER_STEPS` に**足さない**（D6）。`LATE_DISCOVERY_TARGET_IDS["pinsa-romana"] = "pinsa-romana-pizzadb-p9"`、`LATE_ORDERS`・`RecipeId` 表（`recipeSauceProfiles` / `recipeHintRoles` は `Record<RecipeId,…>` で型エラーが漏れを教える） | `lateCatalog.offGolden.test.ts`（OFF の golden 不変） |

## 4. 実装順序と最小構成（提案）

**原則: すべての P3-b PR は本番 OFF で挙動不変（OFF golden・DH4 gate 無修正）。ON は E5 まで有効にしない。** 各 PR は小さく・hot file（`recipes.ts`・`gameReducer.ts`・`GameScreen.tsx`・`App.css`・`PROJECT_HANDOFF.md`）を最小限に。Pinsa は `RECIPES` ではなく **`lateCatalog.ts` の `LATE_RECIPES`** に入れる（L1: ルッコラが POST_BAKE のため）。

| # | タスク | 内容 | 依存 | 想定規模 |
|---|---|---|---|---|
| **P3-b-0**（docs-only・**最初に着手**） | 設計書の L1 反映と食い違いの解消＋Owner 判断の確定 | 設計書の L1 反映（superseded 節・§1.5・§5.6・§7・PK-0・PK-3・§11.1・§12）、Owner 判断の記録。`PROJECT_HANDOFF.md` は触らない | なし（#639/#640 と独立） | 小 |
| P3-b-1 | Pinsa データ（本番 OFF） | `LATE_RECIPES` に `pinsa-romana`（4 食材、arugula のみ `POST_BAKE`、`doughKind`、`ladderCredit:false`、`lunchRush:false`、暫定個数・bake 58–78）、`LATE_ORDERS`、`LATE_DISCOVERY_TARGET_IDS`、`recipeSauceProfiles`（tomato-sauce / PAINT）、`recipeHintRoles`、`referencePizza`（8 スロット）。**`LATE_LADDER_STEPS` は変更しない** | **#639・#640 の merge**、P3-b-0 の R2（名前・説明）・R3 | 中 |
| P3-b-2 | ON ビルドの判定テスト（実データ） | `lateCatalog.ikura.test.ts` と同じ `vi.doMock` で ON にし、L1 判定表を実カタログで固定（#636/#640 の合成 fixture を実データへ）、Guided Pinsa が `pinsa-romana` として発見される（#639 が先送りしたテスト）、Reference pizza が Pinsa として発見される、signature 一意性のキーに `identityDimensions` を含める、Dinner PK-19 | P3-b-1 | 中 |
| P3-b-3 | ゲート・Hint・Research | `hint5Production.gate` G7 / `deductionProduction.gate` INV-TQ-4 の named allowlist（`DOUGH_TECHNIQUE_RECIPE_IDS` 等、共有定数 1 か所）、DH4 sweep に `dough` × `late` の状態を追加、G17、Recipe Batch Validator のコホート例外（名前付き）、PK-14 の一覧更新 | P3-b-2 | 中 |
| P3-b-4 | D3 漏えい防止と保存互換 | T1〜T6（ON ビルドの Pinsa データ対象）、PK-16 往復・既存 save 影響テスト、K2 / 章の ON 差分、PK-18（3 状態の DOM 走査）・PK-21・PK-22 | P3-b-3 | 中 |
| （P3-b の外）E5 | 本番 ON | AC-8（ON ビルドで `salmon-roe` 3 状態再測定）、後乗せ 2 の実測と Q-5/Q8 の正式化、iPhone Safari 実機 HV、G-4（専用の一時検証環境）、D7 | P3-b-4 完了 | — |

P3-b-1 と P3-b-2 は 1 PR にまとめる案もある（データだけの PR はテストで動作確認できないため）。**推奨は分割**（b-1 は inert で OFF golden が差分ゼロであることが確認でき、レビューしやすい）。判断は Owner。

### 4.1 依存関係と受入条件（P3-b-0 で確定）

依存: `#639 ∧ #640 merge → P3-b-1 → P3-b-2 → P3-b-3 → P3-b-4 →（P3-b の外）E5`。b-2 以降は直前のタスクの merge を前提にする（並行させない。`recipes` 系の hot file と共通の表を触るため）。P3-b-0 は独立。**全 PR 共通の受入条件**: 本番（OFF）で挙動不変（OFF golden・DH4 gate 無修正）／`LATE_CATALOG_PRODUCTION`・`FREE_COOK_FINISH_PRODUCTION` は false のまま／save スキーマ不変／skip・timeout 延長・閾値緩和なし／UI が本番で変わらないので HV 不要（Policy §2）／Codex 指摘 0・required CI green。

| タスク | 受入条件（個別） |
|---|---|
| **P3-b-1** データ（OFF） | (1) `LATE_RECIPES` の `pinsa-romana` が表示名「ピンサ・ロマーナ」・説明文（§5 の確定文言）・4 食材（arugula のみ `POST_BAKE`）・暫定個数（D4）・`doughKind: material-multigrain-long-ferment`・`ladderCredit:false`・`lunchRush:false`・CUT なしを持つ。(2) `LATE_LADDER_STEPS` は不変（ikura の 1 件のまま。Pinsa が ladder を伸ばさない）。(3) `validateLateCatalog` が ON 相当のデータで違反ゼロ（後乗せ専用素材なし・step の key でない・target id 一意）。(4) OFF で `RECIPES` / `INGREDIENTS` / `DISCOVERY_LADDER` が従来と同一参照（`lateCatalog.offGolden.test.ts` 無修正）。(5) `recipeSauceProfiles`（tomato-sauce / PAINT）・`recipeHintRoles`・`referencePizza`（8 スロット、非ソース 7 piece 以内）・`LATE_ORDERS`・`LATE_DISCOVERY_TARGET_IDS` の行。(6) 説明文が表示される面を列挙し、未発見レシピ向けの面に出ないことを確認（§5 の確認項目）。(7) 変異確認: `ladderCredit` や POST_BAKE を外すと validator が落ちる |
| **P3-b-2** ON 判定テスト | (1) `vi.doMock` で ON にして L1 判定表（5 行: 標準・後乗せなし=jamon / 標準＋ルッコラ後乗せ=ORIGINAL / Pinsa＋後乗せ=pinsa-romana / Pinsa・全部焼成前=ORIGINAL / Pinsa＋tray=ORIGINAL）を実カタログで固定。(2) Guided で Pinsa を選ぶと `pinsa-romana` として発見される（#639 が先送りしたテスト）。(3) Reference pizza が Pinsa として発見される。(4) signature 一意性のキーに `identityDimensions` を含める（§1.4。緩和ではなくキーの是正）。(5) ジャモンの既存発見データ・target が不変（D2）。(6) Dinner: どの `targetRecipeIds` も Pinsa を含まない（PK-19） |
| **P3-b-3** ゲート・Hint・Research | (1) `hint5Production.gate` G7 / `deductionProduction.gate` INV-TQ-4 の named allowlist（共有定数 1 か所）。(2) DH4 sweep の `GATE_STATES` に dough × late の状態を追加して全再実行、掃引した状態数を Result に記載。(3) G17（`recipeHintRoles`、key-free の確定）。(4) Recipe Batch Validator のコホート例外を名前付きで追加（Q7）。(5) Research 候補 1 → 2 件の影響テスト（HOME 直行・Pizza Select・Hint シート）を一覧化して更新（PK-14/15）。(6) G2 固定文言は不変 |
| **P3-b-4** 漏えい防止・保存・章 | (1) D3 の T1〜T6 を ON ビルドの Pinsa データで固定。(2) PK-16: 旧 save ↔ 新ビルドの往復で図鑑・技法台帳・ジャーナルが失われない。`pendingRound` が `pizza.dough` を保存・復元する事実を JSON 往復で固定（#639 と整合）。(3) 既存 save 影響テスト（dex・pitzBalance・解禁済み素材が不変、Pitz 二重付与なし）。(4) K2 / 章 4 の ON 差分（件数と ✓。最終判断は E5 の HV。D7）。(5) PK-18（3 状態の DOM 走査）・PK-21・PK-22 |
| **E5**（P3-b の外） | 原典の確認（PK-0 の全項目。取得日・確認者・URL・引用を #577 に記録）／AC-8（ON ビルドで `salmon-roe` を 3 状態再測定）／後乗せ 2 ピースの実測と Q8 の正式化／Q5・Q7 の決定／iPhone Safari 実機 HV／G-4（専用の一時検証環境）／D7 |

## 5. Owner 判断（2026-10-23、P3-b-0）と残る未確定事項

**確定した判断**
1. **PK-0**: 項目 2（生地の記述）・4（説明文の妥当性）・5（Piadina との区別）は、**本番 OFF でのデータ追加準備に限り未確認のまま許容**。**本番 ON 化の前に必ず原典を確認する**（E5 の条件）。
2. **表示名**: 「ピンサ・ロマーナ」。
3. **説明文**: 「独特の生地とルッコラの風味が楽しめる、ローマ生まれのピザ。」— 時機を示さない。ただしルッコラ（食材）と「独特の生地」を含むため、表示される面の列挙と、未発見レシピ向けの面に出ないことの確認を P3-b-1 の受入条件にした。
4. **PR 分割**: P3-b-1（データ）と P3-b-2（ON 判定テスト）は**別 PR**。

**残る未確定（P3-b の着手を止めないもの）**
- **CUT**: 暫定「なし」。原典の形（楕円）の確認後に判断（E5 の前）。
- **Q5**（RESULT の生地版の中立行）: 設計上の既定は「足さない」。Owner の承認は無い（P3-b-3 で再確認）。
- **Q7**（コホート文字・validator の名前付き例外）: P3-b-3 で allowlist 例外を入れるが、jamon にラベル文字が付く変化の許容は E5 の HV で確認。
- **Q8**: D4 は検証用の暫定値。正式化は後乗せ 2 ピースの実測後。
- **R4**（Reference 配置の calibration を実装側に任せるか）: 未回答。既定は実装側で初期配置し、実機 HV で調整。
- **D7**（章 4 の表示）、AC-8、G-4、実機 HV: E5。
- **P3-b の着手自体**（HOLD の解除）と、#639・#640 の merge: 別途の Owner 指示。

## 6. テスト一覧

- **不変の確認**: OFF の golden（`lateCatalog.offGolden.test.ts`）、DH4 gate、通常レシピ・ジャモンの既存挙動、`RECIPES` / `INGREDIENTS` / `DISCOVERY_LADDER` が OFF で同一参照。
- **新規**: `lateCatalog.pinsa.test.ts`（ON: 追加行・validator が通る・`ladderCredit:false` で ladder が伸びない）、`pinsaDiscovery.onBuild.test.ts`（L1 判定表・Guided・Reference・Dinner）、gate / sweep の更新、`pinsaLeak.onBuild.test.ts`（T1〜T6）、保存往復・既存 save 影響。
- **E2E**: P3-b は本番 OFF のため新規 E2E は必須ではない。ON を対象にした E2E は E5 の検証用ビルドで行う。
- **変異確認**: 識別の導出・allowlist・validator 例外を外すとテストが落ちることを PR ごとに記録（#639/#640 と同じ運用）。

## 7. 想定リスク

| リスク | 対策 |
|---|---|
| **CI 不安定**（WebKit の apt 取得停止、#643。#639/#640 の Gate が止まっている） | #643 の結果（apt キャッシュ＋整合性ガード）の採否を先に決める。P3-b のコード PR はそれまで merge 待ちが長引く前提で小さく分ける |
| 後乗せカタログの step 番号が通常バッチで動く（`lateCatalog.ts` の KNOWN LIMIT） | Pinsa は step を持たない（D6）ので影響は ikura のみ。ON 前に通常バッチ禁止または予約範囲を決める（E5 の前提） |
| ON のとき riddle が step 33 に前倒し・Research の候補が 1 → 2 件・コホート文字が変わる | D3 のテスト T1〜T6、PK-14/15、E5 の実機 HV |
| 生地チップを使わない／FINISH を使わない探索で、Pinsa に気づきにくい（発見の動線） | 追加の誘導は Anti-Oracle 違反。調理法欄のなぞかけ（承認済み）のみ |
| 原典未確認（楕円・食材欄・工程） | R3 と E5 の条件。Result に未表現・未確認を明記 |
| hot file の競合、`recipeHintRoles` 等の `Record<RecipeId,…>` の型エラーが多面に出る | claim（`TETO_SESSION-OPERATIONS_1.0.md`）と、b-1 を型エラーが示す表だけに限定 |
| 章 4 の完了表示（✓ と件数の食い違い） | K2 実装済み。最終判断は E5 の HV（D7） |

## 8. 最初に着手するタスク

P3-b-0（本更新で完了）の次は **P3-b-1（Pinsa データ、本番 OFF）** だが、**#639・#640 の merge と Owner の着手指示が前提**（それまで着手しない）。直近の障害は WebKit Gate の apt 取得停止（#643）。

## 9. 範囲外・未実施
Pinsa データ・テスト・コードの変更、CI の再実行、#639/#640 の変更、E5、Preview・本番デプロイ、Firebase、`PROJECT_HANDOFF.md`。数値（ladder 55 step・通常レシピ 62・ikura = 56）は L1 決定記録 §6 の値で、本書では再導出していない。
