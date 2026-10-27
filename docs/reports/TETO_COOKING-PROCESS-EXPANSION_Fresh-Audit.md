# 新工程・調理法の追加 Fresh Audit — 炒め / 下ごしらえ / 後乗せ / 仕上げがけ / 混ぜ / 散らし・並べ（docs-only）

作成: 2026-10-27 / 基準 `main` = `c6a90e2`（#688）/ ブランチ `claude/teto-pizza-cooking-audit-frxevk`
性質: **調査・設計のみ。** `src/**`・`e2e/**`・CSS・データ・テスト・Preview は変更していない。PR 作成・merge・Monitor 作成・claim 投稿・GitHub への書き込みは行っていない。
HV 動画は audit-only のため対象外（`CLAUDE.md` / `PROJECT_HANDOFF.md` の「Audit-only tasks are exempt」）。
本書の「推奨」は助言であり Owner Decision ではない。未決は §11 に列挙し、推測で確定していない。

---

## 0. 結論（先に）

1. **「焼成後に乗せる」はもう工程として存在する**（FINISH。本番 ON: `LATE_CATALOG_PRODUCTION = true`、`FREE_COOK_FINISH_PRODUCTION = true`、出荷済み late レシピ 5）。今回の対象 6 工程のうち、新エンジンが要るのは残り 5 つ。
2. **最大の設計軸は「識別（identity）に入るか、体験だけか」。** 識別に入る工程（`prep` / `spreadLayers` 軸を OBSERVED にするもの）は、discovery matcher・Hint 5.0・DH4・Research・Dex・Anti-Oracle 契約の全部に波及し、DH4 の独立攻撃者 sweep（固定 120 秒 timeout の 98% 到達と記録）を押し上げる。**体験だけの工程は、これらに触れずに済む。** 「レシピごとの調理体験の差」が目的なら、まず体験側から入れる。
3. **新工程はタブにできない。** タブ上限 6（`MAX_VISIBLE_COOKING_TABS`）は 11 レシピがすでに使い切り、PREPARE の縦余白は 390×844 で実測 0px（1SCREEN Phase0 監査）。**新工程は既存の工程（TOPPING / FINISH）の中の「操作の種類」として入れる。**
4. **新ピース状態を作らない工程から入れる。** 保存中ラウンド（`pendingRound`）は piece の `id / ingredientId / x / y / stage` だけを許可リストで保存・検証し、他は `corrupt` で拒否する。ピースに新フィールドを足す工程は journal・sanitizer・テスト行列の改修が付く。**通常の `PlacedTopping` を複数個出すだけの操作（散らす・かける・並べる）は、保存・採点・識別・在庫・Undo の既存経路にそのまま乗る。**
5. **推奨 Phase 1 = 「散らす（SPRINKLE）」操作。** xs サイズ食材（出荷済み 74 レシピ中 28 が持つ）を、長押し＆ドラッグで数個ずつ振りかけられるようにする。新食材・新レシピ・採点・識別・保存・タブは変えない。1 タップ配置は残す（アクセシビリティと既存テスト）。本番 OFF のフラグ付きで Preview の opt-in から。詳細 §10。
6. **ただし Phase 1 の差は「食材ごと」であり、「レシピを定義する差」ではない。** レシピ固有の体験（焼き肉は炒める、ナスは焼く）を作るのは 炒め／焼き下ごしらえ（Phase 2 の試作）。Owner が「レシピ固有性」を最優先するなら、Phase 1 を下ごしらえ試作に替える選択肢がある（D-1）。

---

## 1. 確認範囲（正直な記録）

| 区分 | 読んだ／実行したもの | できなかったもの |
|---|---|---|
| ドキュメント | `CLAUDE.md`、`PROJECT_HANDOFF.md`（先頭・startup checklist）、`STATE-SYNC_2026-10-26`、`COOKING-STEPS-2.0_AUTHORITY-INDEX`、`FINISH-ENGINE_OWNER-DECISIONS`、`COOKING-TECHNIQUES_1.0_SSOT`、`FIN-E2_LATE-AXIS_DESIGN`、`PR2-LATE4_DESIGN-GATE`、`POST-W1_COOKING-STEPS_PHASE1_FRESH-AUDIT`、`RECIPE_172_MECHANIC-MATRIX`（JSON）、`COOKING-UI_1SCREEN-2.0_Phase0_Fresh-Audit`（抜粋）、`FINISH-R8_PENDING-ROUND_Result`（抜粋）、#620 の audit（章立てと要約） | `PROJECT_HANDOFF.md` 全文（1141 行）。ここに書かれた古い現況は信用せず、`STATE-SYNC` とコードを正とした |
| コード | `gameReducer.ts`（GamePhase / MakingStep / GameAction / PLACE_TOPPING の FINISH 分岐）、`cookingProfiles.ts`、`finishEngine.ts`、`undoPlacement.ts`、`pizzaState.ts`（`PlacedTopping`）、`PizzaStage.tsx`（pointer 処理）、`pieceDrag.ts`、`GameScreen.tsx`（FINISH dock / bar）、`signature.ts`（識別軸）、`toppingSizeClass.ts`、`ingredients.ts`（型） | **アプリの実行・テスト実行・実機操作は未実施**（`node_modules` なし。依存インストールもしていない）。以下の「テンポ」「難易度」は設計予算であり**実測ではない** |
| 172 レシピ | `TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（正）と `TETO_PIZZADB_172_MASTER-EVIDENCE.json` のキーワード走査 | pizzadb.jp の個別ページは確認していない（原典の記述はすべて repo 内の二次情報）。**matrix は 2026-09 作成**で、出荷済み 74 レシピとの対応は ID の一致で取った。ID 不一致の別名は取りこぼしている可能性がある |
| GitHub | open PR 一覧、Issue 検索（読み取りのみ） | Issue / PR のコメント全文は読んでいない |

**数値の読み方:** §4 の件数は 3 段階に分ける。① **証跡あり**（原典記述が repo 内にある）、② **推論**（食材から見て自然だが原典記述なし）、③ **適用可能**（食材を含むだけ。「必要」ではない）。③ を「必要なレシピ」と読まないこと。

---

## 2. 現状（`c6a90e2` のコードから再確認）

### 2.1 ゲーム状態遷移

```
ORDER ─(BEGIN_PREPARE)→ PREPARE ─(START_BAKE)→ BAKE ─(CONFIRM_BAKE)→ POST_BAKE? ─→ RESULT → DISCOVERED
        makingStep:                needle タップ      仮判定(PROVISIONAL)        makingStep:
        DOUGH→SAUCE→CHEESE→TOPPING  1 回のみ          ・失敗(UNDER/OVER)なら      FINISH → CUT
        (レシピが必要な分だけ)                          FINISH をスキップ(OD-CS-7)   FINISH を抜ける時に
                                                       ・FINISH 無しなら即確定      最終判定(FINAL)＋在庫消費を 1 回
```

- `GamePhase` 6 値、`MakingStep` 9 値（`DOUGH SAUCE CHEESE TOPPING FOLD SEAL EDGE_FILL CUT FINISH`）。`FOLD / SEAL / EDGE_FILL` は予約のみでゲームプレイなし。
- 工程列はレシピから導出（`deriveCoreSteps`）。`applicationPhase: "POST_BAKE"` の要件があると `FINISH` が付く。CUT は許可リスト（`CUT_ELIGIBLE_RECIPE_IDS`）。`COOKING_PROFILE_OVERRIDES` はまだ空。
- `POST_BAKE_STEPS = {CUT, FINISH}` は工程の性質で固定（レシピ選択ではない）。
- FINISH は Guided（レシピが後乗せ要件を持つ時）と Free / Research（`freeCookingProfile` が恒久タブを付与）で動く。**Lunch Rush と Dinner は fail-closed で除外**（`finishAllowedForRound`、UD-I）。
- 採点・在庫消費・Free の発見解決は「一度だけ」。FINISH 有りのレシピは CONFIRM_BAKE で仮判定、FINISH を抜ける時に最終判定と消費（`finalizeRound`、OD-CS-2 = B）。

### 2.2 工程ごとの「共通部分」と「レシピで変わる部分」

| 工程 | レシピで変わる（データ） | 全レシピ共通（コード） |
|---|---|---|
| DOUGH | 生地の種類（standard / pinsa）、パン形状（四角） | 放射状ストレッチ、採点なし |
| SAUCE | どのソースか（tomato / pesto / olive-oil ほか）、有無 | field ベースの塗り（長押し＋ドラッグ）。**ソースは 1 ピザ 1 層の前提が強い** |
| CHEESE / TOPPING | 食材と `minCount` | **タップで 1 個ずつ**（`PLACE_TOPPING`）。トレイ chip からの物理ドラッグは一部のみ |
| BAKE | 焼成窓 `bakeTarget` | needle 1 タップ。焼成中の介入なし |
| FINISH | 後乗せ要件（出荷済み 5 レシピ） | **topping カテゴリのみ**（`gameReducer.ts:1077`）、タップ配置、↩ と 完成 |
| CUT | 有無、スライス数 | 円前提 |

→ **現状、レシピ間の体験差は「どの工程が出るか」「何を置くか」だけ。工程の中でやる動作はレシピに関係なくほぼ同じ**（塗る・タップで置く・タップで焼く・線を引く）。ここが今回の改善対象。

### 2.3 入力の語彙（現状）

| 動作 | 使われている場所 | 実装の根拠 |
|---|---|---|
| タップ | 食材配置、ボタン、needle | `PizzaStage` の tap 経路、`PLACE_TOPPING` |
| 長押し＋ドラッグ | ソース塗り（`SauceDispenseController`、rAF で時間基準） | `PizzaStage.tsx` `startDispenseSession` |
| ドラッグ（位置駆動） | 生地ストレッチ、CUT の線 | `applyStretchPoint`、`cutPath` |
| 食材 chip からのドラッグ | 一部食材のみ（`draggableIngredientIds`）。上向き 37° 以上の角度ゲートでトレイ横スクロールと衝突回避 | `pieceDrag.ts` `hasPieceDragIntent` |
| キーボード配置 | scatter のみ（`isKeyboardPlaceable`） | 塗り・ストレッチ・CUT は無し |

ステージは `pointer capture` ＋ `preventDefault` ＋ `touch-action: none` で、ステージ上のストロークは画面スクロールと競合しない。**ドラッグの統一は #478（draft）が扱う別系統で、本監査では前提にも依存にもしない**（依頼どおり、食材ごとに操作が違ってよい）。

### 2.4 識別（discovery signature）の軸 — 工程追加の影響範囲を決める

`signature.ts` `RUNTIME_DIMENSION_OBSERVATION`:

| 軸 | 状態 | 意味 |
|---|---|---|
| `dough` / `pan` / `late` | **OBSERVED** | 識別に入る |
| `prep` | FIXED_BY_FLOW（`PREP_STEP` 無し） | **炒め・下ごしらえを識別にするにはここを OBSERVED にする** |
| `spreadLayers` | FIXED_BY_FLOW | 仕上げがけを「第 2 のソース層」にするならここ |
| `zones`, `shape` | UNAVAILABLE | 領域別配置・形状 |
| `enclosure`, `cook`, `laminate`, `layerOrder` | FIXED_BY_FLOW | 対象外 |

軸を OBSERVED にすると: 指紋（`extensionOf`）の canary test が意図的に落ちる、技法台帳（P9: 技法を要求する recipe を足す PR は Hint 5.0 / DH4 privacy を再 audit）、near-miss、Research、Dex、`RUNTIME_SUPPORTED_CAPABILITIES` が連動する。

---

## 3. 工程候補の分類

凡例 — **識別**: 識別に入る＝要件にすると discovery が変わる。**状態**: ピースに足す新フィールドの要否。**成熟度**: ✅ 本番にある / 🟡 部品がある / 🔴 白紙。

| ID | 工程（依頼項目） | 現場のイメージ | 成熟度 | 識別 | 新ピース状態 | 既存の土台 | 主な新規部品 |
|---|---|---|---|---|---|---|---|
| **P-LATE** | 焼成後に食材を乗せる | 焼いた後にルッコラ・いくらを乗せる | ✅ | `late` 軸 OBSERVED 済み | 無し（`stage: "post"`） | FINISH 一式（FIN-A〜E5、R8） | **無し**（レシピ追加＝データのみ。`mid_bake` は別物、§3.1） |
| **P-DRIZ** | ソースを仕上げにかける | オリーブオイル・はちみつ・マヨを線状にかける | 🟡 | 要件にすれば識別（`spreadLayers` ではなく `late` 軸で表現可） | **無し**（案 A: 線状に並ぶ通常ピース） | FINISH、`PlacedTopping`、塗りの stroke 処理 | 線状ストロークの操作と見た目、FINISH の `sauce` カテゴリ許可（案 B のみ） |
| **P-SPRK** | 食材を散らす | パセリ・ごま・チーズ粉を振りかける | 🟡 | 無し（体験のみ。食材集合は変わらない） | **無し** | `PLACE_TOPPING`、xs サイズ区分（`toppingSizeClass`）、`findOpenSpot` | 1 ストローク＝複数配置のバッチ処理、ストローク単位の Undo、見た目 |
| **P-ARNG** | 食材を並べる | トマト・ズッキーニ・ペパロニを等間隔に並べる | 🟡 | 体験のみなら無し。「象限／中央」を要件にすると `zones`（UNAVAILABLE→OBSERVED、大きい） | 無し | Reference の piece 位置（リング 8 スロット）で採点済み | ガイド（スナップ／等間隔）。領域要件は別件 |
| **P-PREP** | 食材を炒める／焼く・下ごしらえ | 牛を炒める、ナスを焼く | 🔴 | **要件にすれば `prep` 軸 OBSERVED（大）**。体験のみなら無し | **体験のみでも「炒め済み」の見た目状態が要る**（§8-5） | 焼成の needle 判定、`bakeVisual` の焼き色 | 下ごしらえのミニ操作、状態の持ち方 |
| **P-MIX** | 食材を混ぜる | じゃがいも＋マヨ、生ハーブサラダを和える | 🔴 | 「混ぜた複合食材」を作るなら**新食材概念**（matrix に `prepared-composite ingredient` の review 項目 3 件） | 要（複合物の表現） | 無し | 混ぜる操作、複合食材の定義 |

### 3.1 P-LATE の残課題（新エンジン不要）

- 出荷済み late レシピ 5（ikura-salmon / yuzu-shrimp / eggplant-dengaku / eggplant-tahini / pinsa-romana）。**BBQ チキンは #679（open）で進行中**。
- 次の候補は content（`LATE_ENTITLEMENT_FLOORS` への行追加規則、DH4 sweep の余裕不足が主なリスク — `PR2-LATE4_DESIGN-GATE` §8.2）。
- `mid_bake`（焼成の最後の数分に加える: たらこ・納豆・ロモサルタードのポテト）は **FINISH では表現できない**。焼成を 2 区間に分けて採点・needle・ガイドを作り直す大工事。matrix も `post_bake` 近似を Owner 判断としている。**本監査では対象外にする**。

### 3.2 P-DRIZ の 2 案

| | 案 A: 線状ピース | 案 B: 第 2 のソース層 |
|---|---|---|
| 内容 | かけた軌跡に沿って、通常の topping ピース（`stage: "post"`）を等間隔に出す。見た目は細い線 | `sauceField` に FINISH 用の第 2 層を持たせる |
| 保存・識別・採点・在庫 | 既存経路そのまま（ピース数＝量） | `sauceIds` が単一要素前提（`pizzaState.ts`）。採点（ソース 52 点）と Completion Gate の改修 |
| FINISH の制約 | `category: "topping"` のまま通る | `gameReducer.ts:1077` を緩める必要 |
| リスク | 「ソースなのに topping 分類」という分類上の違和感（Hint の family 表示に影響しうるため DH4 要確認） | Scoring 2.0 の authority に触れる（Owner 判断） |

**推奨は案 A**（最小。`PlacedTopping` の複数個出力という、散らす操作と同じ基盤で実現できる）。案 B は P-DRIZ の第 2 段階以降。

---

## 4. 172 レシピ候補のうち、新工程が必要なもの

出典は `TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（172 行、うち識別集合が完全なもの 120 行）と master evidence のキーワード走査。出荷済み 74 レシピ（`recipes.ts` 69 + `lateCatalog.ts` 5）との対応を併記する。

### 4.1 総括

| 工程 | ① 証跡あり（原典記述） | ② 推論あり | ③ 食材が該当（適用可能。必要ではない） | 出荷済み 74 のうち③ |
|---|---|---|---|---|
| P-LATE | 8 行（うち `mid_bake` 3・未確定 1 を含む） | 16 行（catalog タグ 6 ＋ repo 推論 10） | — | 5 出荷済み |
| P-DRIZ | 17 行（matrix `MULTI_SPREAD_LAYER` required） | 10 行 | 43 | 10 |
| P-SPRK | 0（原典に「振りかける」の記述なし） | — | 79（xs 以外の香草・粉チーズ・ナッツ類を含む広い定義） | 28（xs サイズ食材を持つレシピ） |
| P-ARNG | 1 行（quattro-stagioni の象限） | 2 行（capricciosa・bismarck の中央） | 106（スライス系食材を含む） | 52 |
| P-PREP | **3 行** | 食材推論のみ（§4.3） | 炒め系 67 / 焼き系 37 | 27 / 18 |
| P-MIX | **0 行**（`mix` の走査ヒットは料理名と納豆のみ） | 食材推論のみ（§4.5） | 19 | 6 |

**読み取れること:** 原典に基づいて「必要」と言い切れる新工程は **P-LATE（既に作った）と P-DRIZ（仕上げの油・蜜・マヨ）と P-PREP（3 行）だけ**。散らす・並べる・混ぜるは**ゲームデザイン上の価値で入れる操作**であり、172 の証跡が要求しているわけではない。これは優先度判断の前提になる（§9）。

### 4.2 P-LATE（証跡あり・未出荷）

| 行 ID | 名 | 後乗せ食材 | 根拠の強さ |
|---|---|---|---|
| `wasabi-beef-pizza` | わさび牛 | wasabi | 原典記述（`source_profile_text`） |
| `smore-dessert-pizza-pizzadb-p4` | スモア | graham-cracker | 原典記述 |
| `ikura-salmon-pizza-pizzadb-p1` | いくらサーモン | roe, shiso | 原典記述 → **出荷済み** |
| `bbq-chicken-pizzadb` | BBQ チキン | cilantro | catalog タグ → **#679 で進行中** |
| `teriyaki-chicken-pizza-pizzadb-p14` | 照り焼きチキン | mayo, nori | catalog タグ |
| `black-truffle-pizza-pizzadb-p14` | 黒トリュフ | truffle | catalog タグ |
| `nutella-dessert-pizza-pizzadb-p6` | ヌテラ | powdered-sugar | catalog タグ |
| `buffalo-chicken-pizzadb` / `detroit-style-pizza-pizzadb-p5` | バッファロー／デトロイト | buffalo-sauce / tomato-sauce | catalog タグ（後者は構造系で NOT_REPRESENTABLE） |
| `taco-pizza-pizzadb` ほか 8 行（page-8 サラダ系）・`hot-honey-pepperoni-pizzadb-p12` | 生野菜・ハニー | lettuce / 生野菜 / honey | repo 推論のみ（BLOCKED が多い） |
| `mentaiko-cream`（たらこクリーム）、`natto-pizza`、`pizza-de-lomo-saltado`、`eel-pizza` | — | — | **`mid_bake`（または未確定）。FINISH では不可** |

### 4.3 P-PREP（炒め・焼き下ごしらえ）

**① 証跡あり（3 行、いずれも未出荷）**

| 行 ID | 記述 |
|---|---|
| `yakiniku-pizza` | 肉を味付けして炒めてから乗せる |
| `pizza-de-lomo-saltado` | 牛と野菜を先に炒める（＋ポテトは `mid_bake`） |
| `kimchi-pizza-pizzadb-p2` | 水気を切る／軽く炒めてから乗せる |

**② 推論 — 出荷済みレシピに「体験差」を足せる候補（原典記述なし。食材が該当するだけ）**

| 動作 | 候補（出荷済み） | 理由（推論） |
|---|---|---|
| 炒める | rendang-pizza（牛＋玉ねぎ）、curry-pizza-japan（鶏＋玉ねぎ）、flammkuchen（玉ねぎ＋ベーコン）、fugazza（玉ねぎ 4）、pesto-gamberi（海老＋にんにく）、polish-kielbasa、spanish-chorizo-pizza、salsiccia-e-friarielli（friarielli）、funghi / prosciutto-funghi / capricciosa（きのこ）、spinach-artichoke-pizza | 加熱した具を乗せる料理で、炒め工程が自然 |
| 焼く（焼き目・下ごしらえ） | baba-ganoush-pizza（焼きナスが料理の本体）、melanzane-pizza、parmigiana-pizza、ratatouille-pizza、pesto-vegetariana、sichuan-eggplant-pizza、eggplant-ricotta-pizza、vegan-cashew-cheese-pizza（パプリカ・ズッキーニ） | ナス・ズッキーニ・パプリカ類は焼いてから乗せる調理が一般的 |

> **重要:** ② は「その料理が実際にそう作られる」という一般知識からの推論で、**pizzadb 原典の記述ではない**。これを根拠に既存レシピの要件を変えるのは不可（既存レシピは無変更が前提）。体験のみの工程として optional に提供する場合の対象候補、という位置づけ。

### 4.4 P-DRIZ（仕上げがけ）

| 液体 | 行（matrix `MULTI_SPREAD_LAYER`） | 出荷との関係 |
|---|---|---|
| オリーブオイル | margherita（row）, marinara, burrata, pescatore, pizza-de-cancha, crudaiola, sfincione, grandma, pesto-burrata | **出荷済み margherita / marinara にオイルを足すと識別が変わる**ため不可。新レシピとして別 id にするか、体験のみ（識別外）の扱いが必要で後者は未定義 |
| はちみつ | hot-honey-pepperoni, pesto-noci, nashville-hot-chicken, nduja, feteer | 新レシピ候補。hot-honey-pepperoni は出荷済み pepperoni と食材集合が近い（honey 追加のみ） |
| マヨ | okonomiyaki, potato-mayo, teriyaki, reina-pepiada, elote, mentaiko-mochi | 新レシピ候補（ベースソースが未特定の行が多い＝BLOCKED） |
| ドレッシング／ヨーグルト／バルサミコ／バター | buffalo-chicken, buffalo-cauliflower, pizza-salad, radicchio-noci, feteer | 同上 |

**P-DRIZ は「出荷済みレシピを変える」工程ではなく、「新レシピの仕上げ」として入る。** 最初の 1 レシピ候補は hot-honey-pepperoni（原典は repo 推論、`READY_WITH_REVIEW`）か、証跡が強い wasabi-beef（わさびは topping 的な「添える」なので P-LATE + SPRK 寄り）。

### 4.5 P-MIX（混ぜる）— 証跡なし

| 区分 | 行（推論） |
|---|---|
| マヨで和える具 | potato-mayo, elote, mentaiko-mochi, reina-pepiada（matrix でマヨが第 2 層扱い） |
| ドレッシングで和える生野菜 | pizza-salad, page-8 のサラダ系 8 行, crudaiola |
| 出荷済みの該当 | tonno-e-cipolla / pesto-tonno（ツナ＋玉ねぎ）、pesto-salmone（サーモン＋クリームチーズ＋レモン）、frango-catupiry / brazilian-catupiry-corn（クリーム系＋具） |

**混ぜる工程を要求する原典記述は 172 行のどこにもない。** 現時点では純粋にゲームデザイン上の選択。

### 4.6 P-ARNG（並べる）

- 領域指定が**証跡あり**なのは quattro-stagioni の「四分割」のみ。推論 2 行（capricciosa・bismarck の中央配置）。
- ペパロニ・ズッキーニ・トマトスライス・じゃがいもスライスを「等間隔に並べる」体験は、**採点がすでに位置を見ている**（Reference のリング 8 スロット）ため、**新しい採点なしで「うまく並べるほど良い」が成立している**。足りないのは操作の補助（ガイド）であり、要件ではない。

---

## 5. iPhone 1 画面 UI 案（390×844）

### 5.0 制約（コードと実測から）

| 制約 | 内容 | 出典 |
|---|---|---|
| タブ上限 | 6。出荷 11 レシピが上限ちょうど。7 は 360px で窮屈、8 は不可 | `MAX_VISIBLE_COOKING_TABS`、1SCREEN Phase0 |
| PREPARE の縦余白 | 390×844 で **実測 0px**（下部バー下端が 844.0px）。ingredient panel は 171〜175px | 1SCREEN Phase0 §4 |
| FINISH 画面 | PREPARE と同じ compact ステージ ＋ dock（tray）＋ bar（↩ / 完成 / ヒント） | `GameScreen.tsx` FINISH FIN-B/C |
| トレイ | 1 ページ 6 スロット（`MAX_INGREDIENT_PALETTE_SLOTS = 6`） | `ingredients.ts` |

→ **UI 案の原則: 画面に行を足さない。操作は「ステージ上のジェスチャー」と「選択中の chip の見た目」で表現する。** 追加のボタンが要る場合は既存の bar の中身の差し替えで済ませる。

### 5.1 工程ごとの UI 案

| 工程 | 配置場所 | 操作 | フィードバック | キーボード／タップ代替 |
|---|---|---|---|---|
| **P-SPRK** 散らす | TOPPING / CHEESE / FINISH のステージ上 | xs 食材を選択 → ステージ上で**長押し＆指を動かす**と、約 24〜32px 進むごと（または停止中は約 200ms ごと）に 1 個ずつ落ちる。1 ストロークの上限は 3〜5 個程度（量はあくまで在庫と Q で制御） | 軌跡に沿って粒が落ちる微小アニメ、触感は haptics 無し（Web） | **1 タップ＝1 個を維持**。キーボード配置は従来どおり |
| **P-DRIZ** かける | FINISH のステージ上 | 選択した液体 chip でステージ上を**なぞる**（ドラッグ）。軌跡に沿って細い線（案 A: 等間隔ピース）。ジグザグ推奨の線ガイドを薄く出す | 線が伸びる。足りない量は残量ゲージ（ソースの `SauceRemainingGauge` の流儀） | 1 タップ＝短い 1 本（固定長） |
| **P-ARNG** 並べる | TOPPING のステージ上 | 既存のタップ配置に**スナップ候補点**（リングの薄い印）を足す／ドラッグで線を引くと**その線上に等間隔で N 個**。N は食材の残数と上限の小さい方 | 置く位置の薄いガイド、ズレの許容を広げる | タップ配置は従来どおり（スナップは任意） |
| **P-PREP** 下ごしらえ | **ステージを一時的に「フライパン」表示に差し替え**（ステージの再利用。新しい行は追加しない）。TOPPING の中で、対象 chip を選んだ時だけ | 炒め: **タップのリズム**（約 3 回）または**スワイプで混ぜ返す**。焼き: **長押し**で焼き目リングが進み、離して止める（needle の小型版） | ジュッ表示と色変化、3 段階（生／ちょうど／焦げ） | タップ 3 回で完了（長押しの代替） |
| **P-MIX** 混ぜる | 同上のステージ差し替え（ボウル表示） | 円を描くドラッグ（約 1〜2 周） | 2 食材の色が混ざる | タップ 3 回 |

### 5.2 「ステージ差し替え」方式の根拠

- ステージは既に BAKE（needle）・CUT（roomy）・FINISH（compact）で**工程ごとに表示内容を切り替える**構造（`roomyStage`、`isCutStep`、`isFinishStep`）。P-PREP / P-MIX は同じ流儀で、新しい行やボタンを増やさない。
- ただし**切り替え中にトレイが隠れる**ため、完了／キャンセル（×）を必ずステージ内に置く。tray の高さは変えない（0px 余白の再配分を避ける）。

---

## 6. 食材に適した操作の評価（タップ・ドラッグ・長押し）

| 食材タイプ | 例 | 現行 | 適した操作 | 理由 |
|---|---|---|---|---|
| 粒・粉・香草（xs） | パセリ、ごま、粉チーズ、オレガノ、コーン、いくら | タップ 1 個 | **長押し＆ドラッグで散らす**（Phase 1） | 現実の動作に一致。1 個ずつは数が多いとタップ回数が増えテンポ悪化 |
| スライス・輪切り（m） | トマト、ズッキーニ、ペパロニ、パイナップル | タップ 1 個 | **タップ維持 ＋ 等間隔ガイド**、任意で**線ドラッグ配置** | 1 枚ずつの位置が採点に直結。ドラッグ一括は精度が落ちる懸念があり、補助に留める |
| 大きい具（l/xl） | 卵、アボカド、ブラータ | タップ 1 個 | **タップ維持**（中央に置く等の位置が重要） | 1〜2 個で足りる |
| 液体・ペースト | オイル、はちみつ、マヨ | （ソース塗りは長押し＆ドラッグ） | **なぞる**（細い線）、タップ＝短い 1 本 | ソース塗りと同じ「なぞる」語彙。新しい概念を覚えさせない |
| 加熱前の具 | 牛、ナス、きのこ、玉ねぎ | タップ 1 個 | **タップのリズム（炒め）／長押し（焼き）** | 時間を使う動作で、needle と似た「止めどき」の面白さを再利用 |
| 和える具 | ツナ＋玉ねぎ、じゃがいも＋マヨ | — | **円を描く**（混ぜ）／タップ 3 回 | 低頻度・高体験差だが、複合食材の定義が重い |

**指の遮蔽:** ステージ上のストロークでは指が置く位置を隠す。散らす・かけるは「軌跡」が主役なので影響が小さい。並べる（精度が必要）は、指の少し上にガイド点を表示する案を HV で確認する（要実機）。

**誤操作:** 散らすの長押しと、トレイ chip の横スクロール・物理ドラッグ（上向き 37° ゲート）は**起点が違う**（ステージ上 vs トレイ）ので衝突しない。ステージ上のタップは「1 個置く」を残すため、短いタップが散らしに化けないよう**移動 4px 未満かつ 200ms 未満はタップ**とする（`PIECE_DRAG_THRESHOLD_PX = 4` と整合）。

---

## 7. テンポ悪化と難易度上昇の評価

> **ここは設計予算です。** repo にステップ別の実測分布（`perStepElapsedMs` の実データ）は無く、実機計測もしていない。

### 7.1 テンポ

| 工程 | 追加される操作 | 目安（設計予算） | 判断 |
|---|---|---|---|
| P-SPRK | 置き換え（タップ多数 → 1 ストローク）。**操作回数は減る方向** | 食材 1 種あたり −2〜4 秒（見込み） | ✅ テンポは改善しうる |
| P-DRIZ | FINISH 内の 1 ストローク 1〜2 回 | +3〜6 秒 | ✅ 許容 |
| P-ARNG | ガイド有りで同等〜わずかに短縮 | ±0 | ✅ |
| P-PREP | 具ごとに 1 ミニ操作（炒め 3 タップ程度） | +4〜8 秒／具 | ⚠ 具が多いレシピで積み上がる → **1 レシピ 1 回まで**に制限 |
| P-MIX | ボウル操作 | +6〜10 秒 | ⚠ 低頻度のレシピ限定 |

**テンポ規則（提案）:** ① 新操作は 1 レシピあたり**最大 1 種**、② 1 操作は**約 10 秒以内**、③ **失敗状態を作らない**（やり直し無制限・時間切れ無し）、④ **操作を飛ばせる**（Phase 2 以降）、⑤ Lunch Rush（ランキング）には**入れない**（`lunch-rush-v1` の公平性、UD-I と同じ fail-closed）。

### 7.2 難易度

- P-SPRK / P-DRIZ / P-ARNG: **採点が既存のまま**（位置と数量）なので、新しい落とし穴が増えない。「散らす」は 1 ストロークで数個出るため**過量（Q の減点）に注意** → 1 ストロークの上限と残数ゲートで防ぐ。
- P-PREP / P-MIX: 結果が採点に入ると難易度が上がる。**Phase 2 までは採点に入れない**（OD-CS-11: FINISH にボーナス無し、重み 52/16/12/20 不変、`lunch-rush-v1` 互換）。入れるなら新しい Owner 判断（D-4）。
- 結果が採点に入らない工程は「やっても意味がない」ため体験として空洞化する懸念がある。緩和: 見た目の変化（焼き色・つや）＋ミト（NPC）の一言＋Dex／結果画面の見た目反映。**これでも弱い場合は、採点に入れる前に「焼き色との連動」（炒め済みの具は焼成で焦げにくい）を検討する**が、それは `bakeVisual` 内の視覚効果に留まり採点は変えない。

---

## 8. 技術的制約（コードで確認した事実）

| # | 制約 | 影響 | 出典 |
|---|---|---|---|
| 1 | タブ上限 6、PREPARE 縦余白 0px | 新工程をタブ／行として足せない。ステージ上の操作として入れる | `cookingProfiles.ts:240`、1SCREEN Phase0 |
| 2 | FINISH は `category: "topping"` のみ配置可 | 液体を「ソース」カテゴリで FINISH に置くには reducer の緩和が必要 → 案 A（topping のまま）なら不要 | `gameReducer.ts:1077` |
| 3 | `PLACE_TOPPING` は 1 ピース／dispatch。**Undo は「最後の 1 個」**（`undoablePlacementIndex`） | 1 ストロークで N 個出す操作には、(a) バッチ配置アクション（`COMMIT_SAUCE_DISPENSE` と同型のアトミック commit）、(b) **ストローク単位の Undo**（transient な群情報を GameState に持つ。pizza には持たない）が必要 | `undoPlacement.ts`、`gameReducer.ts` |
| 4 | 保存中ラウンド（`pendingRound`）は piece の `id/ingredientId/x/y/stage` のみ許可リストで保存・検証、他は `corrupt` | **ピースに新フィールドを足す案は journal・sanitizer・R8 行列テストの改修が付く**。足さない設計を優先 | `pendingRound.ts:116, 206-208` |
| 5 | 炒め済み等の「見た目状態」の置き場 | ピースに持たせるのが自然だが制約 4 に触れる。代替: `GameState` 上の transient な `preparedIngredientIds`（ラウンド内のみ、journal に載せない）。保存中断→復帰ではティントを失うが、復帰は精算専用で描画しない | `pendingRoundSettle.ts` の用途 |
| 6 | 識別軸の追加 | `prep` / `spreadLayers` を OBSERVED にすると指紋 canary、技法台帳（P9）、DH4、Research、Dex、near-miss に波及。DH4 独立攻撃者 sweep は 120 秒 timeout の 98%（#688 で高速化したが、新食材・新軸で再度悪化しうる） | `signature.ts`、`PR2-LATE4_DESIGN-GATE` §8.2 |
| 7 | 採点の固定 | 重み 52/16/12/20 と `lunch-rush-v1`。FINISH にボーナス無し（OD-CS-11） | `FINISH-ENGINE_OWNER-DECISIONS` |
| 8 | 最終判定は FINISH 退出時に 1 回、在庫消費も 1 回 | 新工程の結果を採点に使うなら、同じ `finalizeRound` に畳む必要がある（二重判定を作らない） | `finishEngine.ts`、D1a |
| 9 | Free / Research ではレシピが未知 | 新操作は**全ラウンドで同じ条件**（食材の性質だけ）で出す。レシピ固有に工程が出現すると標的が漏れる（Anti-Oracle）。FINISH タブが Free で恒久（UD-B）なのと同じ理由 | `COOKING-STEPS-2.0_AUTHORITY-INDEX`、ANTI-ORACLE 2.1 |
| 10 | Lunch Rush / Dinner は FINISH 除外（fail-closed） | 新操作も同様に除外が既定（公平性・Dinner の Stage A 識別） | `finishEngine.ts` `finishAllowedForRound` |
| 11 | 食材の性質（サイズ区分）は id から導出し、保存しない | 「散らす対象は xs」を `toppingSizeClass` から導けば新データ不要。ただし **Hint 5.0／DH4 が size class を読まないこと**を実装 PR で test で固定する（現状は「どこも読まない」と docs に記載、再確認要） | `toppingSizeClass.ts` 冒頭 |
| 12 | HOT ファイル | `gameReducer.ts`、`PizzaStage.tsx`、`App.css`、`recipes.ts` は他セッション（#478 draft・#581・#468・#679）と衝突しやすい。claim と merge 順の明記が必要 | `SESSION-OPERATIONS_1.0` §1 |
| 13 | 円前提 | 並べる補助（リング／等間隔）は円で成立。四角パン（Square Dough）・CUT は別系統で、Phase 1 では扱わない | PHASE1 FRESH-AUDIT §8 |

---

## 9. 優先順位

評価軸（◎ 良い / ○ / △ / ✕）。「体験差」は目的（レシピごとの調理体験の差）への効き。

| 順 | 工程 | 体験差（レシピ固有性） | 実装規模 | 既存再利用 | 識別・採点・保存への影響 | 1 画面 UI | テンポ | 総合 |
|---|---|---|---|---|---|---|---|---|
| **1** | **P-SPRK 散らす** | ○（食材ごと。28/74 に効く） | 小 | ◎ | ◎ 無し | ◎ | ◎ 改善 | **Phase 1** |
| **2** | **P-DRIZ かける（案 A）** | ○（新レシピの仕上げ） | 中 | ◎（P-SPRK の基盤） | ○ 識別は late 軸で表現。新食材は DH4 再 audit | ◎ | ○ | **Phase 1B（Owner 判断付き）** |
| 3 | P-ARNG 並べる補助 | △〜○ | 小〜中 | ◎ | ◎ 無し | ◎ | ○ | Phase 2a |
| 4 | **P-PREP 炒め／焼き** | **◎（レシピ固有性が最も高い）** | 大 | △ | △（状態の置き場、識別にするなら大） | ○（ステージ差し替え） | △ | **Phase 2b 試作**（Preview 限定の体験のみ版） |
| — | P-LATE 追加レシピ | ○ | 小（データのみ） | ◎ | ○ DH4 | ◎ | ◎ | **並行**（#679 の流れ。新エンジン不要） |
| 5 | P-MIX 混ぜる | ○ | 大（複合食材） | ✕ | ✕ | ○ | △ | Phase 3 以降 |
| ✕ | `mid_bake`、ZONED（象限）、FOLD/SEAL | — | 大〜特大 | ✕ | ✕ | — | — | 対象外 |

**Phase 1 に P-SPRK を推奨する理由:** (1) 証跡の要求ではなく**操作の質**の改善で、リスクが最小。(2) 保存・識別・採点・在庫・タブに触れない。(3) P-DRIZ / P-ARNG のストローク基盤（バッチ配置・群 Undo）を作れる。(4) テンポが良くなる側。
**弱点:** 「レシピ固有」ではなく「食材固有」。レシピ固有の差が最優先なら P-PREP を前倒す（D-1）が、状態の置き場・識別方針（D-5）が先に決まっていないと試作が無駄になるリスクが高い。

---

## 10. Phase 1 実装計画（最小）

### 10.1 スコープ

**Phase 1A（推奨・単独で価値あり）: 「散らす」ジェスチャー**

- 対象食材: `toppingSizeClass === "xs"` の scatter 食材（現在 14 種: capers, corn, grana-padano, green-onion, mint, oregano, paprika-powder, parsley, pine-nuts, pomegranate, rosemary, salmon-roe, shiso, white-sesame）。出荷済み 74 レシピ中 28 が該当。
- 対象ステップ: TOPPING、FINISH（CHEESE は対象外 — cheese は別の物理表現: `CheesePoolCanvas`）。
- 対象ラウンド: Guided / Free Cooking / Research。**Lunch Rush・Dinner は除外**（既定、D-2）。
- 動作: 食材選択中、ステージ上で長押し＆ドラッグ → 距離基準で 1 個ずつ配置（rAF／pointermove 距離）。1 ストローク上限 N（初期 4）。**タップ（4px 未満・200ms 未満）は従来の 1 個配置**。
- 変えないもの: 食材・レシピ・採点・識別・Hint・保存・タブ・トレイ・CUT。
- フラグ: `SPRINKLE_GESTURE_PRODUCTION = false`（`lateCatalog.ts` / `freeCookFinishGate.ts` と同じ「リテラルを false に戻すロールバック」流儀）。Preview では opt-in で ON。

**Phase 1B（Owner 判断 D-3 後）: 「かける」** — 1A の基盤の上に FINISH 用の線状ストローク（案 A）。最初の 1 レシピ（hot-honey-pepperoni 候補）は content PR を別に切る。

### 10.2 スライス

| スライス | 内容 | 触るファイル（予定） | 本番影響 |
|---|---|---|---|
| S0 | docs: 本書の承認＋ Owner 判断 D-1〜D-7 の記録、claim 投稿 | docs のみ | 無し |
| S1 | 純粋層: ストローク→配置点列（距離サンプリング、決定論的ジッタ、`pan.contains` クランプ、`findOpenSpot` 利用）、ストローク上限、タップ判定。テストのみ | `src/logic/sprinkle*.ts`（新規）、test | 無し（未配線） |
| S2 | reducer: バッチ配置アクション `PLACE_TOPPINGS`（`PLACE_TOPPING` と同じ全ガード: step / category / stock / open spot / FINISH なら `stage:"post"` — **各ピースを個別に検証し、全か無かで commit**）＋ transient な群情報による **ストローク単位 Undo** | `gameReducer.ts`、`undoPlacement.ts`、test | 無し（アクション未発行） |
| S3 | UI: `PizzaStage` のジェスチャー分岐（xs 選択時のみ）、粒の落下表現、フラグ ON 時のみ有効 | `PizzaStage.tsx`、`App.css` | フラグ OFF で無変更 |
| S4 | E2E（390×844、360×800、WebKit）、Preview opt-in、HV 動画＋前後スクリーンショット | `e2e/*.spec.ts` | Preview のみ |

### 10.3 受け入れ条件（AC）

1. フラグ OFF: `RECIPES × {Guided, Free, Lunch Rush, Dinner}` の全 golden（スコア・Completion・在庫消費・Dex）が**バイト同一**。
2. フラグ ON でも、1 タップ配置の結果は従来と同一（同じ座標なら同じ状態）。
3. ストロークで出たピースは `PlacedTopping`（`stage` は FINISH のみ `"post"`）。`pendingRound` journal の許可リストを**変更せず**に往復できる（`pendingRound.matrix` 行列が無修正で通る）。
4. 在庫ゲート: 在庫以上は出ない。ストロークの途中で枯渇したら止まり、そこまでの分は確定する。
5. ↩ は**直前のストローク全体**を取り消す（タップ配置は従来どおり 1 個）。FINISH では pre-bake ピースを消さない。
6. Lunch Rush / Dinner ではジェスチャーが無効（タップのみ）。
7. 識別・Hint・DH4 が `toppingSizeClass`／ジェスチャー有無を読まないことを architecture test で固定。Dex・Research の出力が変わらない。
8. タブ数・縦レイアウトが不変（`dynamic-cooking-steps`、`viewport-1screen` の E2E が無修正で通る）。
9. 390×844 実機相当で、トレイ横スクロール・物理ドラッグと誤爆しない（起点が異なる）。
10. キーボード配置・`aria` は従来どおり。

### 10.4 検証・運用

- テスト: S1 ユニット、S2 reducer ユニット＋ parity、S4 E2E。WebKit gate 対象（src 変更）。
- Human Verification（UI/UX 変更）: 390×844 動画（ユーザーへ直接提出、リポジトリには入れない）＋ `docs/reports/screenshots/<task-name>/` に前後スクリーンショット。Result Report は `TETO_HUMAN-VERIFICATION-POLICY.md` の書式。
- HOT ファイル衝突: `gameReducer.ts` / `PizzaStage.tsx` / `App.css` を #478（draft）・#581 と共有。着手時に claim を置き、merge 順を明記する。
- ロールバック: フラグを `false` に戻すのみ。

### 10.5 Phase 2 以降（予告のみ。本書では決めない）

- 2a: 並べる補助（ガイド点・線ドラッグ配置）。
- 2b: P-PREP の**体験のみ版**を Preview 限定で試作（ステージ差し替え、`preparedIngredientIds` transient、採点に入れない、識別に入れない）。HV で「面白い／面倒」を判定してから識別化（`prep` 軸 OBSERVED と DH4 再 audit）を別 Gate で議論。
- 3: P-MIX（複合食材の設計 Gate から）。

---

## 11. Owner 判断事項（本書では決めない）

| ID | 判断 | 推奨（助言） |
|---|---|---|
| D-1 | Phase 1 の優先: 操作の質（散らす）か、レシピ固有性（炒め／焼き）か | 散らす（理由 §9）。ただしレシピ固有性が最優先なら 2b を前倒し |
| D-2 | 散らす／かけるの対象ラウンド | Guided / Free / Research のみ。Lunch Rush・Dinner は除外 |
| D-3 | 「かける」の表現: 案 A（線状ピース）か案 B（第 2 ソース層） | 案 A |
| D-4 | 下ごしらえ・混ぜの結果を採点に入れるか（OD-CS-11 の例外） | Phase 2 までは入れない |
| D-5 | 下ごしらえを識別（`prep` 軸）にするか、体験のみか | まず体験のみ。識別化は別 Gate（DH4／Anti-Oracle 再 audit 前提） |
| D-6 | 出荷済みレシピの要件は変えない（工程追加は optional な体験か、新レシピのみ） | 変えない |
| D-7 | タブ上限 6 を維持 | 維持 |
| D-8 | 新操作の名称・ミトの一言・ヒントでの扱い（Anti-Oracle: 工程の有無で標的が漏れない文言） | Phase 1A は文言を出さない |

---

## 12. 重複・関連

| 対象 | 関係 |
|---|---|
| **#620**（open、docs、2026-10-22 の「新しい調理工程 Phase 1 Fresh Design Audit」） | 同テーマの前回監査。POST_BAKE / MULTI_SAUCE / ZONED を扱い、結論は「最初は POST_BAKE」。**その後 POST_BAKE は本番 ON になった**（#654 ほか）。本書は #620 の後継として、**残りの 5 工程**（炒め・下ごしらえ・仕上げがけ・混ぜ・散らし／並べ）と、操作設計・テンポ・保存制約を追加した。矛盾する結論は無い |
| #478（draft）トレイドラッグ統一 | 別系統。本書は統一を前提にしない（依頼どおり）。`PizzaStage.tsx` の HOT 衝突のみ要注意 |
| #679（open）BBQ チキン late | P-LATE の content。`lateCatalog.ts` 等を共有。本書の Phase 1 とは別 |
| #540（draft・HOLD）グランマ | P-DRIZ の油の扱いと近いが、Square Dough 待ちで独立 |
| #581 / #468 | `PizzaStage` / bake 見た目の変更。S3 と HOT 衝突の可能性 |
| 本書のブランチ | `claude/teto-pizza-cooking-audit-frxevk`（docs 1 ファイルのみ） |

## 13. 未確認事項

- テンポ・難易度の数値は設計予算で、実測していない。S4 の HV と、FREE の `perStepElapsedMs` を使った Preview 計測で検証する。
- 172 レシピの「②推論」は一般的な調理知識に基づく。原典（pizzadb.jp）の記述は確認していない。
- 「Hint 5.0／DH4 が `toppingSizeClass` を読まない」は docs の記載で、grep による全数確認は S1 の最初の作業とする。
- matrix と出荷済みレシピの対応は ID 一致で取った（別名の取りこぼしあり得る）。
- 指の遮蔽・ステージ差し替え時の tray 非表示の体感は実機でしか判断できない。
