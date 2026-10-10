# TETO Cooking Steps 2.0 — 新工程レシピ & 操作設計 Fresh Audit（docs-only）

**Status:** 調査・設計のみ。実装・PR作成・merge は行っていない。`src/**` / `e2e/**` / save / Issue / 他branchは無変更。
**Audited main SHA:** `44879be0c0cd038a50fc224c7b2ca1442285510f`（`Batch 6 PR-3 … (#420) (#440)`、2026-10-10 に `git fetch origin main` で取得。本branchはこのSHAから切った）
**Branch:** `claude/cooking-steps-2-audit-design-gzc9rp`（docs-only）
**HV免除:** `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` および handoff の「Audit-only tasks are exempt」により、動画・スクショは対象外（デプロイ物なし）。

> 数値・事実の出所は `file:line` またはドキュメント名で示す。**未mainの文書**（PR #295 branch）は「(未main)」と明記し、そこから得た事実は main の事実と区別する。

---

## 0. 結論（先に）

1. **「こねる」「ちぎる」「具材を切る」は、PIZZA DB（172）の根拠に1行も現れない。** 172行の mechanic 根拠は「生地種別・ソース2層・後乗せ・パン・形状・包む・下ごしらえ」であり、こねる/ちぎるはレシピを *区別しない*。したがって新工程は「レシピ解禁のために必須」ではなく **操作感の改善候補**として扱うべき。ミニゲーム化は推奨しない（§4）。
2. **新工程が *必須* のレシピは、外部根拠付きで 66行**（既存matrix）。うち post-bake 仕上げ（FINISH）は 12行、下ごしらえ 3行、包む 5行。一方 **FULL かつ decision-ready の 56行は新工程不要**で、既存工程だけで追加できる（§3）。
3. **工程の土台は半分できている。** `POST_BAKE` フェーズ、`FINISH`/`FOLD`/`SEAL`/`EDGE_FILL` の `MakingStep`、`STEP_LABEL` は main にある（`gameReducer.ts:127,144`、`makingStepLabels.ts`）が、**placement・gesture・レシピ・scoring は無い**（予約のみ）。
4. **推奨Pilotは C（新工程1種＋操作改善1種）の段階導入**：新工程＝`FINISH`（焼成後トッピング、BBQチキン型）、操作改善＝**「1つ戻す（Undo last placement）」**。理由：焼成後は `RESET_PIZZA` が使えず（PREPARE限定）誤配置が取り返せないため、FINISH の前提として Undo が必要で、かつ Undo 単体で全レシピに効く（§6, §7）。
5. **ただし本番有効化は Owner 判断待ちが多い**（技法TQ-2の帰属、FREEでの仕上げ工程の見え方、7タブ上限）。実装順は「inert な土台 → Undo → 有効化」とし、先に出せる Undo で価値を検証する。

---

## 1. STEP 1 — 現状監査

### 1.1 参照した資料（重複回避の基準）

| 区分 | 資料 | main? |
|---|---|---|
| 工程アーキテクチャ | `docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md`（CookingProfile / POST_BAKE / FOLD…の設計。Phase 1A/1A-T 実装済み） | ✅ |
| 172 mechanic | `docs/design/TETO_RECIPE_172_MECHANIC-MATRIX.md` + `data/…CANDIDATE_MATRIX.json`（172行、11 capability） | ✅（※`shippedRecipeIds` 等の src派生欄は W1以降stale＝Issue #260） |
| PIZZA DB | `docs/reports/TETO_PIZZADB_172_MASTER-REPORT.md` | ✅ |
| 技法 | `docs/design/TETO_COOKING-TECHNIQUES_1.0_SSOT.md`（TQ-1D=no-sauce は本番稼働、`techniques.ts` は `no-sauce` のみ） | ✅ |
| CUT | `docs/design/TETO_PIZZA-CUTTING_1.0.md` ほか | ✅ |
| 物理操作 | `docs/design/PIZZA_GAME_Phase4A-1B_Cheese-Topping-Physical-Interaction_Design.md` | ✅ |
| Post-W1 Cooking Steps | `docs/design/TETO_POST-W1_COOKING-STEPS_NEXT-PHASE_DESIGN.md`（CS-0〜CS-9、OD-CS-1..20） | ❌ **未main**（PR #295 / Issue #294、open）。読み取りのみ。触れていない |

**重複回避:** 「どの mechanic をどの順で作るか」「FINISH engine の分割（CS-1/2）」は #294 設計が既に決めている。本書はそれを *再設計しない*。本書が新たに加えるのは (a) ユーザー向けの**スマホ操作設計**、(b) こねる/ちぎる等の**既存操作の評価**、(c) **Pilot A/B/C 比較と推奨**。

### 1.2 現状の調理工程の分類（A/B/C/D）

A=実装済・正常 / B=実装済・操作性改善要 / C=部分実装（基盤のみ・特定レシピのみ）/ D=未実装

| # | 工程 | 分類 | 現状（根拠） | 備考 |
|---|---|---|---|---|
| 1 | 生地の成形・伸ばし | **A**（円形のみ。非円形は D） | DOUGH 放射状ストレッチ、D3Aで縮小も可（`doughShape.ts`、handoff D3A）。円形固定（`CUT`も理想円前提） | 四角/舟形は MAJOR（matrix #5） |
| 2 | 生地をこねる | **D** | コード・設計とも無し。PIZZA DB根拠も無し | §4で「作らない」を推奨 |
| 3 | ソースを塗る | **A** | 長押し＋ドラッグ塗り（Phase3A / 4A-1B2 parity）。tomato/pesto/olive-oil 共通パス | 再現ガイド・heatmap 実装済み |
| 4 | 複数回のソース塗布 | **D** | `RECIPE_SAUCE_PROFILES` はレシピ1ソース（`recipeSauceProfiles.ts`）。`PAINT_TEMPORARY` はオリーブ油の*単一スロット*で2層ではない | matrix: 17行が必要（MAJOR、技法TQ-3） |
| 5 | チーズをちぎる | **D** | チーズは「塊」。物理ドラッグは `mozzarella`/`basil` のみ（`GameScreen.tsx:838`）。catalog は mozzarella=`HOLD_SCATTER` だがPrototypeで `TAP_PLACE` に上書き（4A-1B設計 §4）。`HOLD_SCATTER`/`SPRINKLE` の consumer は無い | |
| 5b | チーズ/具材を置く（塊） | **B** | mozzarella/basil＝ドラッグ、それ以外の約50具材＝タップ置き（`PizzaStage.tsx:70` "tap-only"） | 操作の不均一。Undo 無し（#270 open） |
| 6 | 具材を切る | **D** | 根拠なし。素材は完成形で供給 | |
| 6b | 具材を配置する | **B**（5bと同） | 同上 | |
| 7 | 具材の事前加熱・調理 | **D** | `PREP_STEP` なし | 3行必要（yakiniku / kimchi / lomo saltado） |
| 8 | 具材を順番に重ねる | **D** | 順序は `DOUGH→SAUCE→CHEESE→TOPPING` 固定（`deriveCoreSteps`）。カテゴリ有無でのみ増減 | 2行（Trenton / Chicago）、SMALL |
| 9 | 焼成途中の具材追加 | **D** | BAKE は単一needle。split bake 無し | 3行、MAJOR |
| 10 | 焼成後のトッピング | **C** | `POST_BAKE`＋`FINISH` step＋ラベル＋reducerの歩行は有る。**placement/gesture/レシピ/scoring/Dinner対応は無い**（予約・inert） | 12行が必要 |
| 11 | ピザを折りたたむ | **D** | `FOLD`/`SEAL` は予約値のみ、ゲーム動作ゼロ | 5行（calzone等）、MAJOR |
| 12 | 焼き加減の操作 | **A / B** | needle＋ガイドfade（M3A）。一方向化・右端戻り #419 open | 新工程なし |
| 13 | 焼成後のカット | **A**（一部B） | CUT 24レシピ（allowlist `cookingProfiles.ts:77`）。#427/#426 は修正済み、#429（歪んだ生地外の領域）/ #288（精度の最終評価反映）/ #320 は open | 新工程の対象外 |

**現在のカタログ規模（main）:** 55 recipes / 61 ingredients / CUT対象 24 recipe（`cookingProfiles.ts`）。フロー＝`DOUGH → [SAUCE] → [CHEESE] → [TOPPING] → BAKE → [CUT]`、最大6タブ（#294 設計 §1.3、(未main)）。

### 1.3 前提として確認できた制約

- `CookingProfile.steps` は順序つき配列で、ステップ追加に耐える構造（`cookingProfiles.ts:29`）。`POST_BAKE_STEPS = {CUT, FINISH}` はステップ固有で、レシピが誤って焼成前に置けない。
- `GameState`/`PizzaState` は保存されない（`persistence.ts`）→ **工程の作業データは save 互換に影響しない**。保存されるのは Dex・Pitz・所持・inventory・`discoveredTechniqueIds` 等（schema v2、フィールド追加は bump 無しの前例あり）。
- CONFIRM_BAKE で bake 失敗時は post-BAKE をスキップする（`gameReducer.ts:1327`、#256 は main 反映済み）。→ #294 設計 D6/OD-CS-7 の前提「#275 未解決」は **main では既に解消**している点に注意（FINISH を失敗時にスキップするかは別途決定が必要）。

---

## 2. STEP 2 — 新工程が必要なレシピの調査

### 2.1 方法と出典の限界

- 出典は **PIZZA DB（pizzadb.jp）ja-172 の証拠行**（`TETO_PIZZADB_172_MASTER-REPORT.md`）と、それを mechanic に写した matrix JSON（`mechanicEvidence[*].source/strength`）。
- **本セッションから pizzadb.jp へは直接アクセスしていない**（既存報告でも egress blocked と記録済み）。よって本書の「根拠」は *リポジトリ内に取り込み済みの証拠* であり、**サイトの再取得による再検証ではない**。
- 証拠強度は matrix の定義を踏襲：`source_dough_field` / `source_ingredient_field` / `source_profile_text` / `phase0_sample_mechanic_tag` / `catalog_design_tag` = REQUIRED、`repo_inference` = CANDIDATE（昇格しない。OD-TQ-12）。

### 2.2 既存工程だけで実現可能 / 新工程が必須（172行の内訳）

| 区分 | 行数 | 意味 |
|---|---:|---|
| 既存工程のみ（FULL） | **101**（うち decision-ready **56**） | 追加に新工程不要。素材・レシピ・ベース決定が必要なだけ |
| 一部劣化して遊べる（PARTIAL） | 55 | 動くが根拠のある1次元（2層ソース・後乗せ等）を失う |
| 現行フローでは別料理になる（NOT_REPRESENTABLE） | 16 | 構造系 capability が必須 |
| 新 capability が必須（requiredCapabilities≥1） | **66** | 下表 |

出典: `TETO_RECIPE_172_MECHANIC-MATRIX.md` §2–§5。**注意:** この matrix は shipped 15 時点の src 派生欄が stale（#260）。上記の*構造*（capability と証拠）は証拠由来で有効、「shipped」判定のみ main と照合が必要。

### 2.3 新工程ごとの候補レシピ（代表と根拠）

> 「現在再現できない理由」「代替可否」「新材料」「順序」「難易度」を各工程の代表で整理。行数は matrix の `requiredCapabilities` 件数（重複あり）。

#### (a) 焼成後トッピング / 仕上げ `FINISH`（LATE_ADDITION post_bake） — 難易度: **低〜中**

| レシピ | 後乗せ食材 | 根拠（strength） | 新材料 | 備考 |
|---|---|---|---|---|
| **BBQチキン** (`bbq-chicken-pizzadb`) | cilantro | `catalog_design_tag`、READY | `bbq-sauce`、`cilantro`（chicken は既存） | 生地根拠なし → CUT無し → **6タブ**。代表候補 |
| わさび牛 (`wasabi-beef-pizza`) | わさび | `source_profile_text`「焼き上がり後に添える」（**最強**）、READY | wasabi 等 | 薄生地→CUTあり→**7タブ**（CS-4待ち） |
| 黒トリュフ | truffle | `catalog_design_tag` | truffle | no-sauce 技法と*二重技法*、構成衝突あり |
| ヌテラデザート | 粉糖 | `catalog_design_tag` | nutella 等 | BLOCKED（ベース未決） |
| スモアデザート | クラッシュグラハム | `source_profile_text` | marshmallow 等 | BLOCKED |
| バッファロー/デトロイト/照り焼き | late は**スプレッド（ドリズル）** | `catalog_design_tag` ほか | 複数 | 2層ソースも必要＝MAJOR |
| 納豆・たらこ・ロモサルタード | **焼成途中**（mid_bake） | `source_profile_text` | 複数 | 別工程（下記(d)） |

- **現在再現できない理由:** 追加食材は `PLACE_TOPPING` が `phase==="PREPARE"` 限定のため焼成前にしか置けず（#294 設計 §1.1）、焼くと *焙られる*（`bakeRoastResistant` は食材単位のみ）。
- **既存工程で代替可能か:** 焼成前に置けば *食べられる料理にはなる*（PARTIAL）が、「生のパクチー/わさびが乗る」根拠次元が失われ、BBQチキンの識別（`lateAdditionTiming`）が不能。
- **順序:** `DOUGH→SAUCE→CHEESE→TOPPING→焼く→仕上げ→[CUT]`。
- **注意（技法）:** 後乗せは Techniques の **TQ-2** に分類（OD-TQ-2）。本番有効化は技法の authority。**FINISH engine のみ Cooking Steps 側で inert に作れる**（OD-CS-1=A、(未main)）。

#### (b) 下ごしらえ `PREP_STEP`（炒める・水気を切る） — 難易度: **中**

| レシピ | 内容 | 根拠 | 状態 |
|---|---|---|---|
| 焼肉ピザ (`yakiniku-pizza`) | 肉を味付けして炒めてから乗せる | `source_profile_text`、READY | 3行中の唯一のREADY |
| キムチピザ | キムチを水切り/軽く炒めて乗せる | `source_profile_text` | BLOCKED |
| ロモ・サルタード | 牛肉と野菜を先に炒める（＋mid-bake） | `source_profile_text` | BLOCKED |

- **再現不可の理由:** 食材は完成形で供給され、「加熱済み」状態を持たない。
- **代替:** *調理済み食材を別 ingredient（例「焼肉用牛肉」）として直接供給*すればゲームとして成立（操作ゼロ）。工程を作るのは「料理している感」のためのみ＝根拠は「調理工程の再現」だが**必須ではない**。
- **新材料:** 牛肉、野菜等（既存 `pork`/`beef` 相当の有無は別途）。

#### (c) 包む・折りたたむ `ENCLOSE`（FOLD/SEAL） — 難易度: **高**

| レシピ | 形態 | 根拠 | 状態 |
|---|---|---|---|
| カルツォーネ | 折りたたみ | 設計タグ＋プロファイル | BLOCKED（サラミ/ハム構成衝突）、**NOT_REPRESENTABLE** |
| フガゼッタ・レジェーナ | 2枚で挟む | `source_dough_field` | **READY**、NOT_REPRESENTABLE |
| スカッチャータ・ラグザーナ | 層状に重ねる | `source_dough_field` | **READY** |
| シカゴスタッフド | 上下2枚 | `source_dough_field` | READY_WITH_REVIEW |
| ピッツァ・ア・カバージョ | ファイナ層を上に | `source_profile_text` | BLOCKED（証拠欠落） |

- **再現不可の理由:** 中身（具材）を覆うため、score が読む具材が見えなくなる／CUT が不要（calzone は「CUTなし」が正）／Completion Gate に「閉じていない」失敗理由が要る。
- **代替:** 無し（形が別料理になる）。
- **順序:** `DOUGH→(中身)→FOLD→SEAL→焼く`（CUTなし）。

#### (d) 焼成途中の追加 `LATE_ADDITION mid_bake` — 難易度: **高**
たらこクリーム（READY、「焼成最後の数分で追加」）、納豆、ロモ・サルタード。BAKE が単一needleのため split bake が必要＝MAJOR。**今回は対象外**（別監査）。

#### (e) 複数ソース/ドリズル `MULTI_SPREAD_LAYER` — 難易度: **高**（17行、READY: burrata / pesto-burrata / pizza-salad / pesto-noci / grandma 等）
マルゲリータ等 *出荷済み* 5〜9レシピも、PIZZA DB版は「トマト＋オリーブ油」の2層。OD-CS-15 は「出荷済みはそのまま」。**Hint 5.0 の SAUCE rung / G7 を再監査**する必要（#294 §10 H1）。

#### (f) 生地バリアント `DOUGH_VARIANT`（33行）— 難易度: **低（データ）**〜**中（選択UX）**
操作は変えない（matrix §4）。ただし識別に必須（pinsa-romana vs jamon-serrano の衝突を分離）。**こねる操作とは無関係**（生地の「種類」であって工程ではない）。

#### (g) 順序 `STEP_ORDER`（2行）/ 領域 `ZONED_PLACEMENT`（1+2候補）/ パン `PAN_BAKE`（8）/ 形状 `DOUGH_SHAPE_TARGET`（5）/ 積層 `LAMINATE`（1）/ 揚げ `FRY_COOK`（1）
いずれも少数行。別監査（#294 CS-8/9）。本書は扱わない。

### 2.4 既存工程だけで実現できる候補（新工程不要）

- **56行（FULL ∧ decision-ready）**が最優先の *content-only* 候補（matrix §5 の推奨も同じ）。
- Batch 3〜6（NO_SAUCE 6件ほか）で既に大量に出荷済み。残りは新素材のみ。
- **結論:** 「レシピ数を増やす」だけなら新工程は不要。新工程が要るのは **識別次元・調理体験の忠実性**を上げたいとき。

---

## 3. STEP 3 — スマートフォン操作設計

### 3.1 設計制約（前提）

| 項目 | 値 / 方針 | 根拠 |
|---|---|---|
| ビューポート | **360×800** と **390×844**（390幅が`App.css`の基準、360でも成立させる） | CLAUDE.md、#294 §1.2 I5b-4 |
| 片手操作 | 主操作は画面下 40%（親指圏）。ピザ面は中央（ステージ約290/274px） | handoff Cooking UI 1-Screen |
| タップ領域 | **≥44px**（既存 family chip 44px 前例）。ピザ上の誤タップ防止に `DRAG_THRESHOLD_PX=10`（`PizzaStage.tsx:54`） | |
| 誤操作 | 既存の「第2指無視」「中断時 discard」「pointercancel」を踏襲。新工程も *commit は pointerup のみ* | `PizzaStage.tsx:615` |
| 所要時間 | FREE: 1工程あたり目標 ≤8s、Lunch Rush: **新工程を入れない**（時間競争と衝突） | OD-CS-6 |
| 数 | 追加の独立ミニゲームは**最大1種/Pilot**。既存ジェスチャ（長押しドラッグ=塗り、ドラッグ=置く、タップ=置く、スワイプ=カット）を再利用 | ユーザー指示 |
| タブ上限 | 最大6タブ（OD-CS-9(a)=テスト不変条件）。7以上は CS-4 が先 | #294 §13 |

### 3.2 工程別の操作設計と評価

| 工程 | 操作案（スマホ） | 既存との重複 | 負担/所要 | 誤操作リスク | 判定 |
|---|---|---|---|---|---|
| **仕上げ `FINISH`**（焼成後） | 既存の「タップで置く」＋mozzarella型「トレイからドラッグ」を**そのまま**使用。置ける食材は *そのレシピの後乗せ素材のみ* トレイに表示。2〜4個置く。画面下にトレイ、ピザ上で確定 | **ほぼ完全に再利用**（`PLACE_TOPPING`系を POST_BAKE で許可＋`stage:post`） | 3〜6s | 低〜中：焼成後は `RESET` 不可 → **Undo 必須** | ✅ **採用（Pilot）** |
| **1つ戻す（Undo）** | トレイ脇に ↩ ボタン（44px、トレイ左下＝親指圏）。直近の *配置1個* だけ取り消し。PREPARE の TOPPING/CHEESE と FINISH で共通。多段Undoは作らない | 新規UIは1ボタンのみ（#270 と同一課題） | 0.3s | 低（直近1個限定・確認ダイアログ不要） | ✅ **採用（Pilot）** |
| **ちぎる**（チーズ） | 案1「ちぎり演出」: チーズ塊をドロップ時に2〜3片へ*見た目だけ*割れる（canonical は1 piece のまま）。案2「ちぎり配置」: 塊を持ってピザ上を**なぞる**と一定間隔で小片が落ちる（`HOLD_SCATTER` 相当）→ 個数・距離ルールが変わる | 案2は塗り(sauce)のtrailと実装を共有できるが、**piece 個数 (Completion Gate `minCount`/Reference matching)** に波及 | 案1: +0s。案2: 1塊あたり3〜5s（現行1タップ） | 案2は高（小片の個数が曖昧、Lunch Rushを遅くする） | 案1: **Pilot外で検討可（見た目のみ・#421 と合流）**。案2: **保留（scoring決定が先）** |
| **こねる** | 生地を指で押す/揺らす。連打型は片手疲労、押し込み型は DOUGH のストレッチと機能重複 | **DOUGH 放射状ストレッチと実質同じ「生地に触る」操作** | 5〜10s | 中 | ❌ **作らない**（根拠なし・重複・スコア効果なし）。「生地の種類」はデータで表現 |
| **切る**（具材） | 具材をスワイプで切る | CUT（ピザ全体のスワイプ）と混同 | 3〜5s/個 × 複数 | 高（具材ごと、小さい標的） | ❌ **作らない**（根拠なし。完成形で供給） |
| **炒める**（PREP） | 食材をフライパン領域にドラッグ→円を描く（または長押し）→加熱ゲージのゾーンで離す（2段） | **BAKE needle の ゾーン判定と同型**。円運動は新規 | 4〜6s | 中（円運動は片手で不安定） | ⏸ **保留**。まず「調理済み食材を別 ingredient として供給」（操作ゼロ）で代替可。作るなら needle型の1タップ判定に簡略化 |
| **折りたたむ**（FOLD/SEAL） | 生地の端ハンドルをドラッグして反対側へ（1ジェスチャ）。シールは「ドラッグ完了時の重なり許容」で**自動**判定（なぞらせない）。CUTは自動無効 | DOUGH のドラッグ・半径モデルを流用 | 4〜6s | 中（ピザ面が見えなくなる→中身の score と視覚の乖離） | ⏸ **後段**（MAJOR、構成衝突の決定が先） |
| **焼成途中追加** | BAKE 中の needle 操作に重なる「追加」ボタン | **BAKE のタップ判定と競合**（親指が2か所） | 1s | 高 | ❌ 当面作らない（split bake が必要） |
| **複数ソース/ドリズル** | 2層目＝*細線ブラシ*（長押しなぞり、塗りより細く、量は線の長さ） | sauce 塗り再利用可 | 3〜5s | 中 | ⏸ 後段（TQ-3、Hint G7 再監査） |
| **順序（チーズ→ソース）** | タブ順を入れ替えるだけ（操作は変わらない） | 既存ジェスチャのみ | 0 | 低 | ⏸ 後段（CS-8、視覚レイヤの再描画が必要） |
| **成形・伸ばし** | 現行（放射状ストレッチ、拡大/縮小可）維持 | — | — | 既存 | 変更なし |

### 3.3 360×800 / 390×844 での確認観点（Pilot の操作）

- **Undo ボタン:** 44×44 を*トレイ行の左端*に固定（右親指は「次へ/焼く」CTAに予約、`dock height Δ0` の既存制約を壊さない＝chips/pager 行と同居し、`familyRowFits` の測定で収まらなければ 360 では 食材庫エントリの隣に退避）。
- **FINISH トレイ:** 後乗せ素材は 1〜2種のみ（BBQチキン＝cilantro のみ）→ ページング不要、既存 6 slot グリッドに収まる。
- **ピザ面:** 焼成後は `bakeVisual`（焼き色）が付くので、新規置き物が「焼かれていない」見た目になること（fresh visual）を確認（#294 CS-2、(未main)）。
- **誤操作:** 焼成後の誤タップ→Undo 1回で復帰。範囲外ドロップは既存 `isInsideDough`/`clampToDough`。
- **所要時間:** FINISH 追加は 1回 +3〜6s（FREE、時間評価の `completedMs` には含めない＝OD-CS-8 案）。※目標値であり計測値ではない。実測は Pilot の HV で取る。

---

## 4. STEP 4 — システム設計

### 4.1 整合性チェック（要点）

| システム | 影響 | 判断 |
|---|---|---|
| **レシピデータモデル** | `Recipe` 無変更。`RecipeRequirement.applicationPhase?: "PRE_BAKE"\|"POST_BAKE"` を追加（absent=PRE_BAKE）。**食材側にフラグを持たせない**（`attr:category`/`attr:group` ヒントへ漏れる＝OD-CS-3、#294 §10 H3） | ✅ 後方互換（既存55レシピは無変更） |
| **CookingProfile / 工程の順序** | `steps` は既に順序配列。FINISH は `deriveCoreSteps` が `applicationPhase` から追加。**任意工程**＝プロファイル省略、**複数回工程**＝現状は1ステップ1回（FINISH 内で複数個配置は"複数回"ではなく*同ステップ内の反復*で表現）、**焼成前後分岐**＝`isPostBakeStep()` がステップ固有で表現済み | ✅ データで表現可能 |
| **Cooking Steps / Technique** | 後乗せは**技法 TQ-2**（OD-TQ-2）。新技法 id（例 `late-addition`）を `techniques.ts` に追加、検出は `signature` の `late` 軸（現在 `FIXED_BY_FLOW`）を OBSERVED 化。**技法は購入しない・前提にしない**（OD-TQ-1） | ⚠ 技法側のOwner判断が必須（本書は決めない） |
| **Free Cooking / Research** | FREE で仕上げを選べないと後乗せレシピは発見不能（OD-CS-4）。一方 FREE に常時「仕上げ」タブを出すと FREE は 5→6 タブ（**訂正: 初版は「7タブ」と誤記。FREE は現在 5 タブ（CUTなし）で、6 は上限内**。詳細は FINISH Pilot 実装前設計レポート §1.3 / §4）。Research の○×/Notebook に「焼成後」次元が新規で出るためヒントの漏洩（H6/H8）を再監査 | ⚠ **未決（§8 UD-1）** |
| **Discovery / Dex** | Dex の「調理法」に新技法を追加（「？？？」＋なぞかけ）。レシピ識別は `(材料集合 + 生地/パン/後乗せ…)` のキーに拡張（matrix §6: 「材料だけで識別してはいけない」） | ✅ 既存の技法Dex枠を再利用 |
| **Shop / Inventory** | 新素材（bbq-sauce, cilantro）は既存の ladder append-only＋T4価格＋`starGates`。在庫消費は CONFIRM_BAKE で一括（後乗せ分の消費タイミングは OD-CS-2=B「後乗せレシピのみ provisional→FINISH後に確定」） | ✅ ただし finalize の抽出（CS-1b）が前提 |
| **Lunch Rush** | 後乗せレシピは `lunchRush:false`（既存フィールド）で除外が最安。ランキング互換（#224, `lunch-rush-v1`）を守る | ✅ 新工程は Lunch Rush に入れない |
| **スコア/品質** | scatter の後乗せは**既存 Pieces/Recipe 成分で構造的に採点**（新ボーナスなし＝OD-CS-11案）。スコア公式・重みは不変（52/16/12/20）。CUT は別軸のまま | ✅ 既存レシピの点数は数学的に不変 |
| **既存セーブ互換** | 工程の作業データは非保存。技法台帳 `discoveredTechniqueIds` は既に可変集合（未知idも forward-compat 保持）。**schema bump 不要**。Full Reset は key ごと消去（既存） | ✅ 互換性維持 |
| **チュートリアル/オンボーディング** | 既存は Hint シート＋Teto台詞（専用チュートリアル画面は無い）。仕上げは*新技法として発見させる*方針（OD-TQ-5）で、事前説明を出さない。操作（Undo）は初回に1行の吹き出し程度 | ✅ 新規チュートリアル不要 |

### 4.2 データで表現する「新工程の形」

```
RecipeRequirement { ingredientId, minCount, applicationPhase?: "PRE_BAKE" | "POST_BAKE" }   // absent = PRE_BAKE
CookingProfile    { steps: [... "FINISH"? ...], cutConfig? }                                // FINISH は postBake 側
PizzaState.toppings[ { id, ingredientId, x, y, stage?: "pre" | "post" } ]                   // stage absent = pre
```

- 既存55レシピ：`applicationPhase` 無し → 挙動はバイト同一（golden で固定、CS-1b）。
- 「任意」「複数回」「分岐」：プロファイルに載せるか否か（任意）、同ステップ内の複数配置（反復）、`isPostBakeStep` で焼成前後（分岐）。
- **MAJOR系（2層ソース・パン・形状・包む）はデータだけでは足りない**（新スコア/幾何/geometry）。データ化できるのは配置時機・順序・有無まで。

### 4.3 互換性優先の原則

1. 既存レシピ・既存セーブに *何も書き込まない／変えない*。
2. 新フィールドは optional・absent=現行挙動。
3. 新工程のスコア寄与は既存成分の枠内（重み再配分しない）。
4. 技法台帳以外に永続状態を足さない。

---

## 5. STEP 5 — Pilot 計画

### 5.1 3案の比較

| 観点 | **A. 既存操作の改善優先** | **B. 新工程レシピ優先** | **C. 新工程1＋改善1（推奨）** |
|---|---|---|---|
| 内容 | Undo / 全具材ドラッグ統一 / チーズ"ちぎり演出" / Bake一方向化（#419）など | FINISH＋BBQチキン等を直接投入 | FINISH engine（inert）＋Undo を先行、後に BBQ型レシピで有効化 |
| 開発規模 | 小〜中（各 ≤1 PR） | 大（engine＋素材2＋レシピ＋技法TQ-2＋Hint再監査＋HV） | 中（段階分割で各PRは小〜中） |
| リスク | 低。既存回帰テストの範囲内。Undo は reducer に1アクション追加 | **高**：finalize 再設計（OD-CS-2）、Dinner Stage A の同定漏洩（OD-CS-5）、Hint G7 tripwire、技法 authority 未決 | 中：段階で隔離。engine は inert（本番で見えない）。有効化は最後 |
| テスト範囲 | reducer 単体＋PizzaStage/GameScreen コンポーネント＋既存 E2E | 全層（pure/reducer/component/App/E2E/WebKit/HV）＋Hint/Discovery ゲート | 段階1: Undo範囲のみ。段階2: engine は fixture で。段階3: 全層 |
| プレイヤー体験 | 全レシピで「失敗が怖くない」。ただし**新しい遊びは増えない** | 新しい調理体験が*一気に*増えるが、品質・時間の評価が不確定 | 先に Undo が全員に効き、次に"焼いた後に乗せる"新体験が1種だけ増える |
| 新工程の根拠 | 不要 | 12行（FINISH）の根拠あり | 同左（有効化段階で使う） |
| 主な不確実性 | 価値が出るか（Undo は #270 の需要あり） | Owner未決が多すぎて着手不可（G-CS-A…F） | Owner決定（OD-CS-4/5/7/11, TQ-2 帰属）は *有効化段階だけ* に集約できる |

**評価:** A は安全だが新体験が無く、ユーザー要望（新工程レシピ）に応えない。B は未決事項が多く一括は危険。**C は A の安全さと B の価値を、段階で切り分けて両取りできる。**

### 5.2 推奨 Pilot（C）の提案

**対象工程:** 新工程＝**`FINISH`（焼成後トッピング）**／改善＝**「1つ戻す」（Undo last placement）**。

**なぜ FINISH か:** (1) 土台（`POST_BAKE`/`FINISH`/ラベル/reducer歩行）が main にあり最小差分、(2) 根拠最強の 12行を解く、(3) 操作は既存の置く操作の再利用で**新ミニゲーム不要**、(4) 他の MAJOR 系（包む・2層ソース）の共通前提（finalize の分離）を同時に敷く。
**なぜ Undo か:** (1) 焼成後は `RESET_PIZZA` 不可（PREPARE限定）→ FINISH で誤配置が致命的、(2) #270 で既に需要が記録、(3) 全55レシピに効く、(4) こねる/ちぎるより*根拠・測定可能性*が高い（誤配置回数、リセット回数）。

**対象レシピ（有効化段階）:** BBQチキン型（`bbq-sauce` + chicken + mozzarella + onion、後乗せ cilantro）。
- 材料: `bbq-sauce`（共有paint pathの新ソース）と `cilantro`（新規）の **2素材**（chicken は既存）。ladder append、T4価格、既存の Batch 6 方式（`starGates` 不要）。
- 生地根拠なし → CUT 無し → 6タブ（D·S·C·T·焼く·仕上げ）で上限内。
- `lunchRush:false`、Dinner 対象外（OD-CS-5 案）。
- **工程のみの検証用**として、素材追加なしの *test-only fixture*（pre: tomato-sauce+mozzarella+onion / post: basil）で engine を検証（`RECIPES` には入れない＝#294 §6 と同方針）。

**具体的な操作（受け入れ条件の前提）:**

1. 焼成完了後、タブ「仕上げ」が現れ、トレイには後乗せ素材のみ表示。
2. タップ or ドラッグで置く（既存ジェスチャ、閾値 10px）。置いた直後に着地アニメ（焼き色なし＝fresh）。
3. ↩（44px）で直近1個を取消。FINISH 内で何度でも。
4. 「次へ」で確定→（CUTがあれば CUT）→RESULT。

**受け入れ条件（案）:**

| # | 条件 | 検証 |
|---|---|---|
| AC-1 | 既存55レシピ × FREE/Lunch Rush/Dinner × bake {raw/perfect/burnt} で CONFIRM_BAKE 後の state・score・在庫・Dex 結果が**変更前とバイト同一**（golden） | Vitest（pure/reducer） |
| AC-2 | 全レシピの最大可視タブ数 ≤6（不変条件を維持） | Vitest |
| AC-3 | Undo は直近1配置のみ戻す。空なら disabled。Dex/Pitz/在庫/タイマーに副作用なし | reducer＋component |
| AC-4 | FINISH は POST_BAKE の FINISH ステップでのみ置ける。PREPARE外・他ステップ・在庫0・カテゴリ違いは reducer が拒否 | reducer guard |
| AC-5 | 390×844 / 360×800 で Undo ボタン・トレイが他の操作領域と重ならず、44px を満たす。ピザ面サイズ（290/274）・dock高さ Δ0 | Playwright layout-contract |
| AC-6 | bake 失敗時の FINISH の扱いが決定どおり（スキップ or 不可）で、post-BAKE スキップ（#256）と矛盾しない | reducer＋E2E |
| AC-7 | Hint 5.0 G7 / `deductionProduction.gate` が*有効化段階で赤になり*、再監査後に緑（弱めない） | 既存ゲート |
| AC-8 | HV：390×844 動画（FINISH 配置→Undo→確定→RESULT）＋before/after スクショ（ポリシー準拠） | 実装時のみ |
| AC-9 | 保存互換：旧セーブを読み込んで挙動不変、schema 変更なし | persistence テスト |

### 5.3 実装順序（推奨）

| 段階 | 内容 | 本番で見えるか | 依存 / 前提 |
|---|---|---|---|
| **S0** | Owner 判断：§8 の UD-1..UD-5（と OD-CS 系の再確認） | — | — |
| **S1** | **Undo last placement**（PREPARE の CHEESE/TOPPING のみ）。単独で出荷可 | ✅ 全員 | #270 の仕様確認のみ |
| **S2** | CS-1 相当：`finalizeRound` 抽出（golden）、ポストベイク view 一般化。*変化なし* | ❌ | #295 の内容を main に取り込む手順の確認（本セッションでは触らない） |
| **S3** | FINISH engine（inert）：`applicationPhase`、`stage`、FINISH 配置（Undo 共有）、fresh visual。test-only fixture で検証 | ❌ | S1, S2, OD-CS-2/3/11 |
| **S4** | 素材2＋BBQ型レシピ＋技法 `late-addition`（TQ-2）＋Hint 再監査＋HV | ✅ | S3, 技法 authority（OD-CS-1）、OD-CS-4..8 |

> S2〜S4 は **PR #295 / Issue #294 のスコープと重なる**。本書はその進行を妨げないよう「依存として参照」に留め、実装担当は #294 の CS 番号に合流させること（番号の付け替えは Owner 判断）。

---

## 6. STEP 6 — 成果物の要求項目への対応

1. **Audited main SHA:** `44879be0c0cd038a50fc224c7b2ca1442285510f`（冒頭）。
2. **工程マトリクス:** §1.2。
3. **新工程が必要な候補レシピ:** §2.3（代表）。一覧の元データは matrix JSON の `rows[*].requiredCapabilities`（66行）／`candidateCapabilities`（推論のみ。required と合わせて82行が何らかの capability を持つ）。本書はこのJSONを読み取っただけで再生成していない。
4. **スマートフォン操作設計:** §3。
5. **データモデルと進行システムへの影響:** §4。
6. **Pilot A/B/C 比較:** §5.1。
7. **推奨Pilotと実装順序:** §5.2–§5.3。
8. **リスク・未決定事項:** §7。
9. **既存Issueとの対応関係:** §8。

---

## 7. リスク・未決定事項

### 7.1 リスク

| # | リスク | 影響 | 緩和 |
|---|---|---|---|
| R1 | **根拠の再検証不能**：pizzadb.jp へ本セッションから接続していない。行は repo 内の取り込み済み証拠に依存 | 根拠の鮮度 | 有効化段階で Owner が対象行（BBQチキン）のみ再確認 |
| R2 | FREE に「仕上げ」を常時出すと FREE は 6 タブ（**訂正: 初版の「7タブ」は誤り**。FREE は現在 5 タブ）。FREE に CUT が入ると 7 になる | 現状は上限内。将来 CUT 導入時に衝突 | S0 で方針決定。後乗せレシピ時のみ表示すると**識別が漏洩**（OD-TQ-16/H6） |
| R3 | finalize を CONFIRM_BAKE から分離（OD-CS-2=B）の複雑化 | Dex/Pitz/在庫の二重計上・取りこぼし | golden＋"abandon during FINISH" テスト。S2 で先に抽出し inert 化 |
| R4 | Dinner は START_BAKE で識別・post-BAKE ステップを決める（D4）→ 後乗せレシピが識別不能・同定漏洩 | Dinner 破損 | 後乗せレシピは Dinner から除外（OD-CS-5 案a） |
| R5 | bake 失敗時に FINISH を許すか（#256 の方針と整合） | 失敗ピザに置ける不整合 | AC-6。スキップを推奨（OD-CS-7案） |
| R6 | Hint 5.0 G7 / `deductionProduction.gate` が新ソース・新技法で赤化 | CI 失敗＝想定内 | 弱めず再監査（§10 H11） |
| R7 | Undo と Lunch Rush の公平性（巻き戻しは時間浪費なので不利益のみ） | 低 | 仕様どおり。ランキング互換に影響なし |
| R8 | 7タブレシピ（wasabi-beef）は CS-4（タブ UI）待ち | スコープ拡大 | Pilot は6タブのBBQ型に限定 |
| R9 | `docs/design/…MECHANIC-MATRIX` の src派生欄 stale（#260） | 「shipped」判定誤り | 本書は構造のみ利用、shipped は main の `recipes.ts` で再確認済み |

### 7.2 未決定事項（Owner 判断。本書は決めない）

| ID | 論点 | 選択肢 | 推奨（助言のみ） |
|---|---|---|---|
| UD-1 | FREE での「仕上げ」タブの見え方 | (a)常時表示 (b)後乗せ素材を所持時のみ (c)FREEでは無し | (a)案はタブ上限と衝突 → 要設計。(b)は所持が識別ヒント化する懸念 |
| UD-2 | 後乗せの本番化を Cooking Steps と技法 TQ-2 のどちらで出荷するか | #294 OD-CS-1（=A: engineはCS、有効化はTQ-2）を踏襲 | 踏襲 |
| UD-3 | Undo の範囲 | PREPARE全体 / TOPPING+CHEESEのみ / FINISHのみ | S1は CHEESE/TOPPING（既存ステップで価値検証）、S3で FINISH に拡張 |
| UD-4 | 「ちぎり演出」（見た目のみ）を #421 食欲表現と合流するか | 合流 / 別 | 合流（scoring 非影響） |
| UD-5 | 「ちぎり配置（HOLD_SCATTER）」を将来やるか | やる（個数ルール改訂）/ やらない | 保留。個数・Completion Gate 影響の Fresh Audit が先 |
| UD-6 | こねる | 作らない / 生地種別の選択UXとして別途 | **作らない**（本書の推奨） |
| UD-7 | 焼成後 FINISH の bake 失敗時 | スキップ / 許可 | スキップ |

---

## 8. 既存Issue/PRとの対応関係（変更なし・重複確認のみ）

| 対象 | 関係 | 本書の扱い |
|---|---|---|
| **#294 Post-W1 Cooking Steps**（open、設計は PR #295 branch・未main） | **最重要**。CS-1/CS-2/CS-3(=TQ-2)・OD-CS-1..20 が本書の FINISH 設計と同一領域 | 参照のみ。Pilot S2〜S4 は #294 の CS 番号に合流。**重複して再設計しない** |
| **#270 LC-X: Undo last placement** | Pilot S1 の Undo と同一課題 | 参照。仕様の出発点。Issue 変更はしない |
| **#421 Finished Pizza Appetite Appeal（溶けたチーズ）** | 「ちぎり演出」(UD-4) の合流先候補 | 参照のみ |
| **#288 Scoring 3.0: CUT skill score** | CUT 評価の最終反映。FINISH→CUT 順序と round-end finalize に関係 | 参照のみ |
| **#320 / #256**（CUT省略） | post-BAKE スキップ（main反映済み）。FINISH の失敗時扱い（UD-7）に関係 | 参照のみ |
| **#429 / #427 / #426 / #424**（CUT・RESULT表示） | 既存CUT側の不具合群。FINISH 後の CUT で再発しないか注意 | 参照のみ |
| **#419 Bake Human Feel** | 「焼き加減の操作」(B判定) | 参照のみ |
| **#216 / #182 Progression 2.0**、**#292 Hint 5.0** | 新素材の解禁・Hint G7 再監査 | 参照のみ |
| **#216 OD-CS-19**（解禁ポリシー） | 技法は購入しない（OD-TQ-1）との整合 | 参照のみ |
| **#33 / #37**（生地・Making Game 2.0） | 生地の伸ばし(A)。「こねる」は #33 の範囲外として扱っていない | 参照のみ |
| **PR #445 / Issue #442 / #443、他の監査branch** | **触れていない**（読み書きとも無し） | — |

**重複確認の結果:** 「Cooking Steps 2.0」「こねる」「ちぎる」を扱う open Issue/PR は無い。「新工程レシピ」は #294 が既に包含。**新規Issueは作成していない**（作成が必要なら Owner 判断）。

---

## 9. 推奨のまとめ

- **推奨Pilot: C（FINISH＋Undo）、段階導入。** 最初の出荷物は **S1: Undo last placement**（低リスク・全員に効く・FINISH の前提）。
- **こねる／具材を切る：作らない。** ちぎるは「見た目の演出」から（UD-4）。「ちぎり配置」は scoring 影響の監査後。
- **新工程が要るレシピ（根拠付き66行）のうち、最初に解くのは FINISH（12行）。** 代表は BBQチキン型（6タブ・CUT無し・新素材2）。
- **着手前に Owner が答えること：** UD-1（FREEの仕上げ表示）、UD-2（出荷帰属）、UD-3（Undo範囲）、UD-7（失敗時）。それまで S2 以降は着手しない。
