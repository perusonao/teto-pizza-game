# Lunch Rush — 材料不足 / 注文スキップ: Fresh Revalidation

- **Audited SHA:** `f3bb7030c6bed15a6e2e6cd57a5e13bdce9ae9a8`（`origin/main` = PR #233 Discovery Hint Economy 1.0 のマージ。ローカル HEAD と一致、working tree clean を確認）
- **Branch:** `claude/lunch-rush-shortage-revalidation-dky0du`（docs のみ）
- **種別:** Fresh Revalidation。production code / tests / save schema / scoring / inventory / recipe・ingredient catalog / Hint Economy は変更していない。PR 作成・merge・deploy もしていない。
- **再検証の対象:** 旧 Fresh Audit `docs/reports/TETO_LUNCH-RUSH_MATERIAL-SHORTAGE-SKIP_Fresh-Audit.md`（commit `30deb8e`、branch `claude/lunch-rush-shortage-skip-audit-p8whp9`、main 未マージ、audited `12a09de`）。旧 audit から main は **47 commits** 進んでいる。
- **判定:** **B. READY WITH OWNER DECISIONS**（§13）

---

## 0. STEP 0 — GitHub / Duplicate Gate

| 項目 | 結果 |
|---|---|
| `origin/main` | `f3bb703`（指定 SHA と一致） |
| working tree | clean。作業 branch は main と同じ位置から開始 |
| 旧 Fresh Audit | main には無い。`claude/lunch-rush-shortage-skip-audit-p8whp9`（`30deb8e`）にだけある。PR は作られていない |
| **Issue #212**（OPEN） | 「Phase 3-4F: Lunch Rush stock-aware mission pool」。同じ問題を扱う唯一の OPEN Issue。必須シナリオ 1 は「在庫 0 の recipe があるとき、作れる recipe だけが注文される」で、**Option B（filter）を前提にした書き方**になっている |
| **PR #213**（OPEN、docs のみ） | #212 の Fresh Audit（audited `dff233c`）。推奨は Option B と、0 件のときは「開始をブロック / 途中なら早期終了」。skip（Option C）は採用しない |
| 実装を扱う OPEN PR | **無い**。shortage / skip / stock-aware pool を実装する branch や PR も無い |
| #232 / PR #233 | 読んだだけで、変更していない |

→ 重複する実装 PR は無い。新しい Issue は作らず、本書は #212 / #213 / 旧 audit の上に載せる再検証として扱う（tracking の扱いは OD-4）。

---

## 1. 旧 audit（`12a09de`）との差分

Lunch Rush の中核（`src/mission/lunchRush.ts`、`src/state/progression.ts`、`src/data/orders.ts` の抽選部）は **`12a09de` から変わっていない**。変わったのは周辺で、うち 3 点が設計に直接効く。

| # | 変化（`12a09de` → `f3bb703`） | 本件への影響 |
|---|---|---|
| D1 | **`isRecipeCookable` が追加された**（`src/state/recipeDiscoveryState.ts:87`、W1-a1 `e7195f9` / F-15）。定義は「必要材料が全部 OWNED で、有限材料の在庫が scatter なら `max(1,minCount)`、spread/sauce なら 1 以上。starter は無限」 | 旧 audit が新設を提案した `orderShortage` の判定と**同じ定義**が、すでに main にある。新しい述語を作らず、これを分解して不足リストを返す形にすればよい。**実装の範囲が小さくなる** |
| D2 | **FREE 側だけが stock-aware になった。** `canStartGuidedRound` = discovered ∧ cookable（LK-8 backstop）を、`SELECT_RECIPE` / `BEGIN_PREPARE`（FREE）/ `RETRY_SAME_RECIPE` / FREE 注文 pool が使う | Lunch Rush だけが「OWNED なら在庫 0 でも注文される」まま残った。`BEGIN_PREPARE` の Mission 側は `isDiscovered` しか見ない（`gameReducer.ts:643-648`）。**FREE との非対称が、現在の root cause そのもの** |
| D3 | 0 件のときの fallback が変わった。`createInitialGameState` / `nextOrderState` は、guided pool が空なら **Free Cooking round**（`freeCook: true`）を作る | 旧 E2（開始時に pool が空）で残る round は「FREE の guided round」ではなく **Free Cooking round**。`isMissionRound=false` なので `handleConfirmBake` が `REGISTER_TO_DEX` を出す。つまり、**Lunch Rush の HUD の下で発見が起き得る**（潜在。§4） |
| D4 | W1 catalog は **25 recipes / 29 materials**。starter は `tomato-sauce / mozzarella / basil` の 3 つのまま。**starter だけで作れる recipe は margherita だけ**（実測） | 「発見済みの margherita が常に作れる」という前提は維持されている |
| D5 | Hint Economy（#232）。`PURCHASE_DISCOVERY_HINT` は `freeCook && PREPARE && hintSheetOpen` のときだけ有効 | Lunch Rush とは交わらない。本件で依存を足す理由も無い |
| D6 | Discovery 2.0: `MISSION_NEXT_ORDER` は「発見済みのときだけ Dex を再登録」に変わった（`gameReducer.ts:1367`） | Lunch Rush が発見を起こさない仕組みは維持されている。FAILED でも Dex が変わる件（§3 F6）は残っている |
| D7 | #215: Completion Gate に `"recipe"` と `"order"` の 2 つの policy ができた。Lunch Rush は `"order"`（`minCount` が必須） | `isRecipeCookable` の scatter 閾値（`max(1,minCount)`）が、Lunch Rush の完成条件と一致する。したがって「cookable = 最低限なら PASS できる在庫がある」と言える |

旧 audit の結論のうち、**そのまま成り立つもの**:

- stock 不足の注文は main で到達可能で、必ず FAILED になる（再現は §3）
- avoidRepeat のため、2 recipe のうち 1 つが不足していると、注文の 50% が不足になり、交互に来る
- 不足は必ず「注文が決まった時点」ですでに起きている。調理中に在庫が減る経路は無い
- 0 件の潜在バグ E2 / E3 は残っている（E2 は D3 のため、むしろ悪化している）

**修正が必要なもの**:

- 旧 §6 の「`orderShortage` を新設」→ `isRecipeCookable` を分解する形に変える（D1）
- 旧 §8-3 の「`BEGIN_PREPARE` の backstop」→ FREE にある `canStartGuidedRound` と**対称に**、Mission にも cookable 条件を足すだけで済む。さらに、App は今のまま `BEGIN_PREPARE` を出してよい。不足の注文では reducer が no-op にするので、自然に ORDER で止まる（§6 の配線が単純になる）
- 旧 §7 の H「skip 直後だけ makeable pool から抽選」→ **連鎖は防げるが、交互に来るのは防げない**（§5.2）。owner decision が必要（OD-1）

---

## 2. Current runtime（`f3bb703`）の経路

```
HOME「ランチラッシュ」 App.handleStartLunchRush (App.tsx:809)   guard: hasAnyDiscovery だけ
 └ SHOW_INTRO → MissionIntroOverlay → App.startMission (App.tsx:487)
     ├ missionDispatch START          (MissionClock 開始。以降 phase に関係なく時間が減る)
     └ dispatch MISSION_RESET_ORDER → nextMissionOrderState (gameReducer.ts:524)
          ids   = availableRecipeIds(dex, owned)        // recipeUnlocked ∧ 必要材料が全部 OWNED
          order = pickMissionOrder(ids, discovered, prev)  // ids ∩ discovered、avoidRepeat、一様ランダム
          order == null → return state                   // fail-closed（E2）
 1 注文目: ORDER 画面「ピザを作る！」→ BEGIN_PREPARE
          Mission の guard は isDiscovered だけ（在庫は見ない）
 PREPARE: Stock Gate（canPlaceIngredient）が、在庫 0 の有限材料のチップを ×0 で disabled にする
          CONFIRM_MAKING_STEP は材料の有無を gate しない → BAKE まで進める
 CONFIRM_BAKE (gameReducer.ts:1006): phase==="BAKE" guard（exactly-once）
          completion = evaluatePizzaCompletion(recipe, pizza, "order")
          inventory  = consumePizzaInventory(pizza, inventory)   // 置いた分だけ消費。0 でクランプ
 RESULT: MissionServePanel「次の注文へ」→ App.handleMissionServeNext (App.tsx:531)
          missionDispatch SERVE（deadline を再検査。FAILED なら metrics 不変、serves[] に FAILED を記録）
          期限内なら dispatch MISSION_NEXT_ORDER（Dex 再登録 → nextMissionOrderState）
                   + dispatch BEGIN_PREPARE（同じ tick。2 枚目以降は ORDER 画面を描画しない。UX-1）
 TICK: 期限を過ぎたら PLAYING → RESULT（1 回だけ）。MissionResultOverlay（もう一度 / HOME）
          RESULT の effect: persistMissionBest、CLAIM_MISSION_REWARD(runId)、submitLunchRushScore(serves)
```

| 観点 | 現在の仕様（f3bb703） | 根拠 |
|---|---|---|
| order candidate selection | `availableRecipeIds ∩ discovered`、avoidRepeat（pool が 1 件なら繰り返しを許す）、一様ランダム | `lunchRush.ts pickMissionOrder`、`orders.ts getNextOrder` |
| discovered filtering | 必須（#200）。未発見は注文に出ない。`BEGIN_PREPARE` と `MISSION_NEXT_ORDER` にも backstop がある | `gameReducer.ts:643`、`:1367` |
| ingredient ownership | 必須（`ingredientsOwned`）。一度 OWNED になったら外れない | `progression.ts:68` |
| inventory / remainingStock | **注文の抽選では見ない**。PREPARE の Stock Gate（`canPlaceIngredient`）と表示（`remainingStock` の ×N）でだけ使う | `inventory.ts:40,76` |
| starter の無限在庫 | `unlockCondition` が無い材料 = `"UNLIMITED"`。`hasStock` / `consumePizzaInventory` / `isRecipeCookable` のいずれでも常に充足 | `inventory.ts:31,152`、`recipeDiscoveryState.ts:92` |
| 有限在庫 0 | OWNED のまま `inventory[id]=0`。注文には出る。トレイでは ×0 で disabled | — |
| BEGIN_PREPARE guard | FREE: `canStartGuidedRound`（discovered ∧ cookable）。**Mission: `isDiscovered` だけ**。phase guard は無い | `gameReducer.ts:639-648` |
| CONFIRM_BAKE の消費 | 唯一の消費点。`phase==="BAKE"` で exactly-once。FAILED でも置いた分は消費する | `gameReducer.ts:1016,1082` |
| exact recipe validation | Lunch Rush は `"order"` policy。`minCount` 未満、材料が欠けている、焼き過不足のどれかがあれば FAILED | `completionGate.ts:37` |
| score / Pitz | `missionScore(metrics)`、`calculateMissionReward(metrics)`。どちらも metrics だけで決まる。FAILED は metrics に入らない | `lunchRush.ts SERVE` |
| servedCount | PASS の SERVE だけで +1 | 同上 |
| best score（Mission） | RESULT で `persistMissionBest(missionScore)` | `App.tsx:432` |
| Dex / discovery の副作用 | `MISSION_NEXT_ORDER` が **completion に関係なく** `registerScoreToDex` を呼ぶ（発見済みのときだけ）。発見は起きない | `gameReducer.ts:1367` |
| mission timer | 絶対時刻の `MissionClock`。phase に関係なく進む。ORDER でも止まらない | `lunchRush.ts` |
| next-order selection | 毎注文、消費後の state から pool を作り直す。在庫は見ない | `gameReducer.ts:1378` |
| zero-candidate | `nextMissionOrderState` が `state` をそのまま返す（E2 / E3） | `gameReducer.ts:531` |
| RESULT / HOME | TICK か期限切れ SERVE で RESULT。「もう一度」で `startMission`、HOME で `EXIT_TO_FREE + PLAY_AGAIN` | `App.tsx:570` |
| run 中の Shop | GameScreen で Shop CTA が出るのは FREE の結果画面（DISCOVERED の NEW MATERIAL 通知）だけ。**Mission 中に在庫が増える経路は無い** | `GameScreen.tsx:760` |
| reload / save | Mission の run 状態は保存しない（`missionRunReducer` は保存対象外）。保存するのは dex / owned / inventory / pitz / ledger / hint purchases（schemaVersion 2）と Mission BEST | `persistence.ts` |

---

## 3. 「OWNED だが stock 0」の注文 — 再現結果

使い捨ての vitest probe（repo には commit していない。コードは付録 A）を `f3bb703` で実行した。fixture は既存の `discoveredDex` / `walkPostBakeToResult` を使った。条件: `dex = {margherita, bismarck}`、owned = starter + `egg`、`inventory = { egg: 0 }`。

| # | 観測 | 結果 |
|---|---|---|
| F1 | `MISSION_RESET_ORDER` を 400 回 | **bismarck 200 / margherita 200**。20 回連続で追うと `bismarck, margherita, bismarck, …` と**完全に交互**（avoidRepeat と pool 2 件のため） |
| F2 | 不足注文の `isRecipeCookable` | `false` |
| F3 | 不足注文に `BEGIN_PREPARE` | **PREPARE に進む**（Mission の guard は `isDiscovered` だけ） |
| F4 | starter だけを置いて bake | `completion = FAILED / MISSING_REQUIRED_INGREDIENT (egg)`、`inventory.egg = 0`（消費の残りも 0） |
| F5 | FAILED のあと `MISSION_NEXT_ORDER` | 次の注文は margherita（交互） |
| F6 | **FAILED なのに Dex が変わる** | bismarck の `timesMade 0 → 1`、**`bestScore 0 → 43.77`**。FAILED の pizza の品質点が Dex BEST に入る（既知の「completion に関係なく登録する」の続き。旧 audit は timesMade だけを指摘していた） |
| F7 | FAILED の SERVE | `metrics = {servedCount:0,totalQualityScore:0,bestQualityScore:0}`、`serves.length = 1`（FAILED を記録） |
| F8 | 0-cookable: `dex = {bismarck}` だけ、egg 0 | pool = {bismarck}（OWNED なので空ではない）→ 注文は毎回 bismarck、`BEGIN_PREPARE` は PREPARE に進む → **run 全体が FAILED だけになる** |
| F9 | E2: `dex = {bismarck}`、egg を所有していない（pool が空） | `MISSION_RESET_ORDER` は同じ参照を返す。残る round は `isMissionRound:false, freeCook:true`（**Free Cooking round が Mission HUD の下で動く**） |
| F10 | E3: RESULT + pool が空で `MISSION_NEXT_ORDER` → `BEGIN_PREPARE` | `RESULT` → **`PREPARE`**。焼いた pizza が PREPARE に戻る（phase guard が無い） |

既存テストのベースライン: `src/mission`、`gameReducer.test.ts`、`gameReducer.lk8Backstop.test.ts`、`recipeDiscoveryState.test.ts`、`inventory.test.ts` の 5 ファイル・162 tests が pass。

### 3.1 到達性（通常のプレイ）

- **F1–F7 は main で到達する。** 有限材料を Shop で買って recipe を発見し、在庫を使い切ってから Lunch Rush を始めればよい。W1 では recipe 25 のうち 24 が有限材料を要し、そのうち 10 以上は有限材料を 2 つ以上要する（例: `quattro-formaggi` は 4 つ、`capricciosa` / `meat-lovers` も 4 つ）。そのため W1 以降は発生頻度が上がる。
- **F8–F10（作れる recipe が 0 件）は、通常のプレイでは到達しない。** Dex 0 のときに所有しているのは starter だけで、starter だけで作れるのは margherita だけ。したがって最初の発見は必ず margherita になり、margherita は無限在庫で常に作れる。到達するのは、手で編集した save や将来の starter 構成の変更など、この前提が崩れたときだけ（旧 audit / #213 と同じ評価）。
- それでも guard は必要（§5.4）。skip を導入すると「作れる pool から選ぶ」経路ができるので、その pool が空の場合を定義しないと、新しい経路で deadlock が起きる。

---

## 4. Current root cause

1. **Lunch Rush の makeability 判定が ownership だけで止まっている。** FREE は W1（F-15 / LK-8）で `canStartGuidedRound` = discovered ∧ **cookable** に移ったが、Mission の pool（`nextMissionOrderState`）と `BEGIN_PREPARE` の Mission 側 guard は `availableRecipeIds`（OWNED）と `isDiscovered` のままだった。
2. **作れない注文から抜ける手段が無い。** 抜けるには、最後まで作って FAILED になるか、HOME で run を捨てるしかない。FAILED にすると部分在庫を浪費し、Dex の BEST / timesMade も動く（F6）。
3. **avoidRepeat が不足注文を増やす。** 作れる recipe を作った直後は、必ず別の recipe が来る。pool が小さいと不足注文が交互に来る。
4. **0 件の扱いが決まっていない。** E2（Free Cooking round が残る）と E3（`BEGIN_PREPARE` に phase guard が無い）。

---

## 5. STEP 2 — Hybrid H の再評価

### 5.1 仕様項目ごとの判定

| # | Hybrid H（依頼文） | f3bb703 での評価 |
|---|---|---|
| 1 | 通常の抽選では不足注文が出る可能性を残す | **妥当**（在庫が Lunch Rush の中でも意味を持つ）。ただし §5.2 の「交互」問題があるので、OD-1 で出し方を決める |
| 2 | stock が足りるなら今のフロー | **妥当**。`isRecipeCookable` が true なら何も変えない（UX-1 の PREPARE 直行も維持） |
| 3 | 不足注文では PREPARE に進ませない | **妥当・簡単**。`BEGIN_PREPARE` の Mission 側の条件を `isDiscovered ∧ isRecipeCookable` にする（FREE の `canStartGuidedRound` と対称） |
| 4 | 「材料が足りません」を表示 | 妥当。ORDER 画面に出す |
| 5 | 不足材料を表示 | 妥当。`have / need` は `isRecipeCookable` と同じ閾値から出す |
| 6 | 不足のときだけ「この注文をスキップ」 | 妥当。「ピザを作る！」は出さない（押しても no-op になるため） |
| 7 | skip では score / Pitz / inventory / Dex / best / servedCount を変えない | **妥当**。`serves[]` にも追加しない（ranking の payload と server 側検証に影響させない） |
| 8 | timer は止めない | 妥当。`MissionClock` は絶対時刻なので、何もしなくても止まらない |
| 9 | skip 後は作れる recipe から次の注文を選ぶ | **妥当だが不十分**（§5.2） |
| 10 | stock が足りる注文は skip できない | 妥当。reroll を防ぐ。reducer で guard する |
| 11 | cookable が 0 件なら開始を防ぐか安全に終了 | 妥当。開始時はブロック、途中なら早期 RESULT（#213 と同じ） |
| — | starter の無限在庫を維持 | `isRecipeCookable` がすでにそうなっている。変更しない |

### 5.2 仕様どおりの H に残る問題: 不足注文が交互に来る

- **run の途中で在庫は増えない**（Shop に入れない。Pitz 報酬の付与は RESULT のとき。§2）。したがって「一度不足した recipe は、その run の終わりまで不足のまま」。
- 仕様どおりの H（skip 直後の 1 注文だけ作れる pool から選ぶ）で、2 recipe のうち 1 つが不足している場合:
  `bismarck(不足) → skip → margherita → [通常の抽選。avoidRepeat で margherita を除く] → bismarck(不足) → skip → …`
  → **2 注文に 1 回、同じ不足画面と 1 タップが挟まる。** 連鎖（不足 → 不足）は防げるが、同じ不足注文が何度も来るのは防げない。180 秒の run で十数回同じ画面を見ることになる。
- 同じ recipe を再び出しても、在庫の状況は変わらないので新しい情報が無い。時間を削るだけの noise になる。

**修正案 H-R（推奨）: 「その run では売り切れ」を記憶する。**
- skip した recipe を、その run の残りの通常抽選から外す（`missionSoldOutRecipeIds`。GameState の一時フィールドで保存しない。`MISSION_RESET_ORDER` で空に戻す）。
- こうすると、不足注文は 1 recipe につき 1 run で最大 1 回だけになる。「在庫切れを断る」という比喩とも一致し、在庫が Lunch Rush の中で見えるという H の狙いも保てる。
- skip の直後は作れる pool から選ぶ（仕様 9 のまま）。売り切れを外した通常 pool の中にまだ不足 recipe があれば、それも初めて出る 1 回だけ不足として出る。
- 実装コストは小さい。一時的な string 配列を 1 つ足し、抽選の入力から除くだけ。

代替案:
- **H（仕様どおり）**: 何度も同じ不足注文が来ることを許容する。
- **B（#212 と #213 の Option B）**: 通常抽選から不足 recipe を黙って外す。skip UI は不要でコードは最小。ただし在庫切れが Lunch Rush で見えなくなる。
- **H-R から B への切り替え**（逆も）は、同じ述語の上で 1 行の違いにすぎない。

### 5.3 作れる / 不足の述語（1 か所）

`src/state/recipeDiscoveryState.ts` の `isRecipeCookable` を、不足リストを返す関数に分解する（例: `recipeStockShortage(recipe, inputs): { ingredientId, need, have }[]`）。`isRecipeCookable` は `shortage.length === 0` のラッパーとして残し、FREE の既存の呼び出し元の挙動は一切変えない。

- need: scatter は `max(1, minCount)`（= `"order"` policy の `completionMinimum`）、spread / sauce は 1
- have: starter は `Infinity`（表示は不要なので、不足リストには入らない）。有限材料は `inventory[id] ?? 0`
- OWNED でない材料: 通常は pool から外れるが、防御的に `have: 0` の不足として扱う
- 不明な材料 id: `isRecipeCookable` が false を返す現在の挙動を保つ

### 5.4 0 件の policy（仕様 11）

| 時点 | 条件 | 推奨の挙動 |
|---|---|---|
| 開始前（HOME / Intro） | `discovered ∩ cookable` が空 | 開始をブロックする。既存の `lunchRushLocked` と同じ見せ方で、理由を 1 行出す（「作れるピザがありません。ショップで材料を補充してね」）。E2 を防ぐ |
| run の途中（serve 後） | 通常 pool も作れる pool も空 | run を早期終了して Mission RESULT に進む。報酬と ranking は既存の RESULT 経路を使う。`BEGIN_PREPARE` は出さない。E3 を防ぐ |
| skip の直後 | 作れる pool が空 | 同上（早期 RESULT） |
| 防御 | `BEGIN_PREPARE` | `phase !== "ORDER"` なら no-op にする guard を足す（E3 の reducer 側の backstop） |

通常のプレイでは margherita があるので、run の途中で 0 件になることはない。これらは防御のための規定である。

---

## 6. 最新版の仕様（H-R を採用した場合）

```
次注文の決定（run 開始 / serve 後 / skip 後）
  pool_normal   = discovered ∩ OWNED \ soldOut          （avoidRepeat）
  pool_cookable = discovered ∩ cookable \ soldOut       （avoidRepeat。1 件なら繰り返しを許す）
  直前が skip なら pool_cookable から、そうでなければ pool_normal から選ぶ
  選べない（pool が空） → 開始時: ブロック / 途中: 早期 RESULT

注文が決まったあと
  cookable → 今のフロー（1 注文目は「ピザを作る！」、2 枚目以降は PREPARE 直行）。変更なし
  不足     → ORDER で止める（App は今のまま BEGIN_PREPARE を出してよい。reducer が no-op にする）
             Mito / Teto の注文ライン
             ⚠ 材料が足りません
             ・たまご 0/1   ・チェリートマト 1/3        （アイコン + 名前 + have/need）
             （補充はランチラッシュのあとでショップへ）
             [この注文をスキップ]                        （唯一の CTA）

MISSION_SKIP_ORDER { recipeId }
  guard: isMissionRound ∧ phase==="ORDER" ∧ !freeCook ∧ recipe.id===recipeId ∧ 不足あり
  効果: soldOut += recipeId、pool_cookable から次の注文（ORDER）
  不変: dex / inventory / pitzBalance / score / completion / 保存対象の全フィールド
  mission 側: missionRunReducer には何も dispatch しない（clock / metrics / serves は不変）
  期限切れ: App で isMissionExpired なら dispatch しない（TICK が RESULT に進める）
```

- **UI の配線**: `handleMissionServeNext` は今のままでよい。不足の注文では `BEGIN_PREPARE` が no-op になり ORDER に残るので、GameScreen の ORDER 分岐で不足パネルを描画する。skip の後に作れる注文が選ばれた場合は、App が続けて `BEGIN_PREPARE` を出す（UX-1 のテンポを保つ）。
- **1 注文目**: 作れる注文なら今と同じ「ピザを作る！」。1 注文目の要否は本件の範囲外（旧 audit と同じ）。
- **表示用の skip 数**: 範囲外（後で追加できる）。

---

## 7. STEP 3 — 現在のシステムとの干渉

| システム | 干渉 | 結論 |
|---|---|---|
| Discovery 2.0 | `MISSION_NEXT_ORDER` の「発見済みのときだけ再登録」、`BEGIN_PREPARE` の LK-8 backstop | skip は Dex に触らない。backstop の Mission 側に cookable を AND で足すだけ。未発見の recipe は今までどおり注文に出ない |
| discovered-only の対象 | pool = discovered ∩ … は維持する | 変更なし |
| inventory の永続化 | skip は inventory を変えないので、保存の書き込みも起きない | save への影響なし |
| Hint Economy（#232） | `PURCHASE_DISCOVERY_HINT` は `freeCook` のときだけ。Mission の round は `freeCook:false` | **依存を足さない**。skip の画面にヒント CTA も置かない |
| save schemaVersion 2 | soldOut は保存しない一時フィールド | schema 変更なし。reload すると run 自体が消えて HOME に戻るので、soldOut も自然に消える |
| onboarding / Dex 0 lock | Dex 0 では Lunch Rush がそもそも locked（`hasAnyDiscovery`） | 変更なし。0-cookable のブロックはこの lock の後ろに追加の条件として置く |
| W1（25 recipes / 29 materials） | 有限材料が多い recipe が増え、不足の頻度も上がる | H-R の価値が上がる。catalog は変更しない |
| CUT / New Haven | margherita などは CONFIRM_BAKE 後に `POST_BAKE`（CUT）に入る | skip は ORDER でしか有効でないので、CUT には触れない。E3 の `BEGIN_PREPARE` の phase guard は、POST_BAKE から戻される経路も同時に塞ぐ |
| scoring | Scoring 2.0 / completion `"order"` | 変更なし。skip は scoring を呼ばない |
| mission result | metrics / serves / `calculateMissionReward` / `persistMissionBest` / `submitLunchRushScore` | skip は metrics と serves を変えないので、RESULT、Pitz、BEST、ranking の payload は serve の分だけで決まる。早期 RESULT では既存の RESULT 経路をそのまま使う（`clientDurationMs` は上限しか検証されない。#213 の §190 と同じ） |

---

## 8. STEP 4 — Edge cases / test matrix

| ID | ケース | 期待 | 層 |
|---|---|---|---|
| A | 在庫が足りる | 今のフロー。`BEGIN_PREPARE` は PREPARE に進む。skip は no-op | unit / reducer |
| B | 不足が 1 材料 | ORDER で止まる。不足リストは 1 件（`need/have`）。skip できる | unit / reducer / component |
| C | 不足が複数材料（例: `quattro-formaggi`） | 不足リストに全材料が出て、順序は安定（`requiredIngredients` の順）。表示は 360 幅で折り返す | unit / component / E2E |
| D | 在庫がちょうど 1（egg `minCount 1` / spread の sauce） | cookable。bake 後に 0 → 次にその recipe が来たら不足になる | reducer |
| D' | scatter で `minCount 3`、在庫 2 | 不足（need 3 / have 2） | unit |
| E | starter だけの recipe（margherita） | 常に cookable。不足リストは空 | unit |
| F | skip → 作れる注文 | skip 後の注文は必ず cookable（複数 seed で検証） | reducer |
| G | 繰り返し skip の防止 | (1) 同じ recipeId への 2 回目の skip は no-op。(2) H-R では skip した recipe は同じ run で再び出ない。(3) 不足 → 不足の連鎖が 0 回 | reducer |
| H | 作れる recipe が 0 件 | 開始時はブロックし、PLAYING にならない。途中なら早期 RESULT で、`BEGIN_PREPARE` は出ない。E2 / E3 の回帰テスト | reducer / App |
| I | reload / save | skip の前後で保存データが bytewise 同一（persist の書き込み無し）。reload 中の run は既存どおり破棄され、soldOut も残らない | App |
| J | timer は止まらない | skip は `missionRunReducer` を呼ばない。不足画面のまま期限が来たら TICK で RESULT に進む。期限後の skip は no-op | reducer / App / E2E |
| K | score / Pitz / servedCount / serves への副作用 | skip の前後で `metrics`、`serves`、`pitzBalance`、Mission BEST が同一 | reducer / App |
| L | inventory を消費しない | skip の前後で `inventory` が参照同一 | reducer |
| M | 作れる注文は skip できない | cookable な注文への skip は参照同一の no-op（reroll 不可） | reducer |
| N | FREE / Free Cooking では skip できない | `isMissionRound:false` または `freeCook` なら no-op | reducer |
| O | ORDER 以外の phase で skip | no-op | reducer |
| P | Dex が変わらない | skip の前後で `dex` が参照同一。timesMade / BEST も不変 | reducer |
| Q | ranking の payload | skip を含む run の `serves[]` に skip が現れない | App |
| R | `BEGIN_PREPARE` の phase guard | RESULT / POST_BAKE / BAKE から呼んでも no-op（E3） | reducer |
| S | UX-1 の回帰 | 作れる 2 枚目以降は ORDER を描画せずに PREPARE に直行 | App |
| T | layout | 不足パネルが 390×844 と 360×800 で 1 画面に収まり、スクロールが出ない。CTA がタップ可能 | E2E（Chromium + WebKit） |

---

## 9. Test plan

- **Unit / reducer**（新しい `src/state/gameReducer.missionShortage.test.ts`、`recipeDiscoveryState.test.ts` に追記）: A–H、J（reducer 側）、K–R。F / G は乱数を差し替えて複数 seed で確認する。
- **Mission reducer**（`src/mission/lunchRush.test.ts`）: 早期 RESULT のための action（例: `END_EARLY`）が 1 回だけ遷移すること、期限後は no-op になること。
- **App / component**（新しい `src/App.lunchRushShortage.test.tsx`、不足パネルの component test）: 不足表示、「ピザを作る！」が出ないこと、skip → PREPARE、0 件のブロック、I、Q、S。
- **E2E**（新しい `e2e/lunch-rush-material-shortage.spec.ts`、`iphone-390x844` / `iphone-360x800`、WebKit gate も含む）: 在庫 0 の発見済み recipe を持つ save で run → 不足注文 → skip → 作れる注文 → serve → 不足画面のまま時間切れ → RESULT（score / Pitz は serve の分だけ）。既存の `lunch-rush-result-ranking-phase4.spec.ts` の回帰も確認する。
- **Human Verification**: UI / gameplay の変更なので、`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` に従う。390×844 の動画（user に直接渡し、commit しない）と before / after のスクリーンショット（`docs/reports/screenshots/<task-name>/`）が DoD に入る。

---

## 10. Implementation slices

| Slice | 内容 | UI | 規模 |
|---|---|---|---|
| S1 | 述語: `isRecipeCookable` → 不足リスト関数への分解（FREE の挙動は不変）。`cookableMissionRecipeIds` + unit tests（A–E、D'） | なし | 小 |
| S2 | reducer: `BEGIN_PREPARE` の Mission 側に cookable を足し、phase guard も足す（E3）。`MISSION_SKIP_ORDER`、skip 後は作れる pool から選ぶ、soldOut（OD-1 が H-R の場合）、pool が空のときの戻り値の規定 + tests（F–H、K–P、R） | なし | 小〜中 |
| S3 | App / UI: 不足パネル（ORDER 分岐）、skip の配線、開始時の 0 件ブロック（HOME / Intro の理由表示）、早期 RESULT（mission reducer の action）+ component / App tests（I、J、Q、S） | あり | 中 |
| S4 | E2E（T と通しシナリオ）+ HV 動画 + スクリーンショット + Result Report | あり | 中 |

1 PR で S1→S4 を順に commit する想定（どれも小さく、S3 と S4 は切り離すと DoD を満たせない）。分けるなら S1+S2（UI なし・HV 不要）と S3+S4 の 2 PR にする。

### 触ると見込まれるファイル

| ファイル | 変更 |
|---|---|
| `src/state/recipeDiscoveryState.ts` | 不足リスト関数、`isRecipeCookable` をラッパーにする |
| `src/state/gameReducer.ts` | `BEGIN_PREPARE` の guard、`MISSION_SKIP_ORDER`、`nextMissionOrderState` のオプション（cookable-only / soldOut）、GameState の一時フィールド |
| `src/mission/lunchRush.ts` | 早期終了の action（OD-2 が「途中は早期 RESULT」の場合） |
| `src/App.tsx` | skip handler、0 件のブロック、早期 RESULT の配線 |
| `src/screens/GameScreen.tsx` | ORDER 分岐の不足パネル |
| `src/components/MissionShortagePanel.tsx`（新規） | 不足カード |
| `src/screens/HomeScreen.tsx` または `src/components/MissionIntroOverlay.tsx` | 0 件のときの理由表示 |
| `src/App.css` | パネルのスタイル |
| tests / e2e | §9 のファイル |
| `docs/reports/…_Result.md`、`docs/reports/screenshots/<task>/` | Result Report とスクリーンショット |

変更しないもの: `src/data/*`（catalog / recipes / ingredients / ladder）、`src/logic/scoringV2/*`、`src/logic/completionGate.ts`、`src/logic/economy.ts`、Shop、Hint Economy、`persistence.ts`（schema）、`functions/`（ranking の server 側）。

---

## 11. Risks

| Risk | 対策 |
|---|---|
| `isRecipeCookable` の分解で FREE（LK-8）の挙動が変わる | ラッパーとして同じ真理値を返し、`lk8Backstop` / `recipeDiscoveryState` の既存テストを回帰テストにする |
| `BEGIN_PREPARE` に phase guard を足すと、ORDER 以外から呼ぶ既存テストの fixture が壊れる | S2 で全テストを実行して洗い出す。壊れるのは fixture の書き方で、仕様ではないはず |
| React の同じ tick での dispatch（`MISSION_NEXT_ORDER` + `BEGIN_PREPARE`）に依存した配線 | reducer の no-op だけで ORDER に止まる設計なので、描画順に依存しない。App test で確認する |
| 早期 RESULT が ranking の server 検証に引っかかる | `clientDurationMs` は上限しか見ない（#213 で確認済み）。E2E / emulator で serve 0 件の run も確認する |
| H-R の soldOut が漏れる | GameState の一時フィールドで保存しない。`MISSION_RESET_ORDER` と `PLAY_AGAIN` で空にする。テスト G / I |
| F6（FAILED で Dex BEST が動く）を同じ PR で直したくなる | scope 外。FAILED は Lunch Rush 全体の話で、skip とは独立。別 Issue（OD-3） |

## 12. Blockers

- **技術的な blocker は無い。** 3-4C（在庫単位の移行）と OD-03 は、#213 の時点では seam が必要とされていた。しかし現在の main の在庫単位は「片数 / sauce 1」のままで、`isRecipeCookable` がその唯一の定義になっている。単位が変われば、この関数が変わるだけで済む。
- 決定が必要なのは §13 の 4 点だけ。

---

## 13. Owner Decisions

| ID | 論点 | 選択肢 | 推奨 |
|---|---|---|---|
| **OD-1** | 不足注文の出し方 | **H-R**: 通常抽選で出す。skip したらその run では売り切れ。skip 直後は作れる pool から選ぶ / **H**: 依頼文どおり（同じ不足注文が交互に何度も来る。§5.2） / **B**: 通常抽選から不足を外し、skip UI を作らない（#212 の必須シナリオ 1 の文言どおり） | **H-R**。在庫が Lunch Rush で見えるという H の狙いを保ちつつ、1 run で recipe ごとに最大 1 回の不足に抑えられる。run 中に在庫は増えないので、再び出す価値は無い |
| **OD-2** | 作れる recipe が 0 件 | 開始時: **ブロック** / 開始してすぐ RESULT。途中: **早期 RESULT** / 不足画面のまま時間切れを待つ | **開始時はブロック + 途中は早期 RESULT**（#213 と同じ。通常のプレイでは到達しない防御規定） |
| **OD-3** | F6: Lunch Rush の FAILED で Dex の timesMade / BEST が動く（既存の挙動） | 本件に含める / **別 Issue** / 仕様として許容する | **別 Issue**。skip の導入とは独立で、ranking と Dex の方針にも関わる |
| **OD-4** | tracking | **#212 を実装 Issue として使い、scope に H-R を追記する**（シナリオ 1 の「作れる recipe だけが注文される」を「不足注文は skip 可、連鎖しない」に改める）。#213 は本書で置き換えられた旨を記録して owner が close する / 新しい Issue を作る | **#212 を再利用する**（重複を作らない）。#213 と旧 audit の branch は owner の判断で close / 削除する |

## 14. Recommended next action

1. owner が OD-1〜OD-4 を決める（推奨: H-R / ブロック + 早期 RESULT / F6 は別 Issue / #212 を再利用）。
2. 決まったら `f3bb703` 以降の最新 main から実装 branch を切り、S1→S4 を実装する。UI の変更なので HV 動画とスクリーンショットを DoD に含める。
3. 実装の前に main が進んでいたら、§2 の表（特に `nextMissionOrderState`、`BEGIN_PREPARE`、`isRecipeCookable`）だけを再確認する。

**STOP: B. READY WITH OWNER DECISIONS**

---

## 付録 A — 再現に使った probe（commit していない）

`src/__probe__/shortage.probe.test.ts` として一時的に置き、`npx vitest run src/__probe__ --silent=false` で実行した後に削除した。主要部分:

```ts
const finiteOf = (id: string) =>
  getRecipe(id as RecipeId)!.requiredIngredients.map((q) => q.ingredientId)
    .filter((i) => !!getIngredient(i)?.unlockCondition);

const dex = discoveredDex(["margherita", "bismarck"]);
const owned = [...STARTER_INGREDIENT_IDS, ...finiteOf("bismarck")];
let s = createInitialGameState(dex, owned, 100, { egg: 0 });
for (let i = 0; i < 400; i++) s = gameReducer(s, { type: "MISSION_RESET_ORDER" }); // 200/200、交互
// bismarck の注文で:
isRecipeCookable(st.recipe, st);                         // false
gameReducer(st, { type: "BEGIN_PREPARE" }).phase;        // "PREPARE"
// starter だけ置いて START_BAKE → CONFIRM_BAKE → walkPostBakeToResult
//   completion FAILED / MISSING_REQUIRED_INGREDIENT(egg), inventory.egg 0
gameReducer(b, { type: "MISSION_NEXT_ORDER" });          // bismarck timesMade 0→1, bestScore 0→43.77
// E2: dex={bismarck}, egg を所有していない → MISSION_RESET_ORDER は同じ参照（freeCook:true, isMissionRound:false）
// E3: RESULT + 空 pool → MISSION_NEXT_ORDER は RESULT → BEGIN_PREPARE は "PREPARE"
```

出力（抜粋）:

```
RECIPES 25 INGREDIENTS 29 starters [tomato-sauce, mozzarella, basil] starterOnly [margherita]
RESET_ORDER distribution (stock 0 bismarck) { bismarck: 200, margherita: 200 }
cookable? false
BEGIN_PREPARE phase PREPARE
after bake phase RESULT completion {"status":"FAILED","reason":"MISSING_REQUIRED_INGREDIENT","ingredientId":"egg",...} inv {"egg":0}
timesMade before/after 0 1 best 0 43.77032759904669 next recipe margherita
metrics after FAILED serve {"servedCount":0,"totalQualityScore":0,"bestQualityScore":0} 1
seq bismarck,margherita,bismarck,margherita,...
0-cookable: order bismarck isMission true phase ORDER BEGIN_PREPARE -> PREPARE
empty pool: same ref? true isMission false freeCook true phase ORDER
E3: after NEXT phase RESULT after BEGIN_PREPARE PREPARE
```
