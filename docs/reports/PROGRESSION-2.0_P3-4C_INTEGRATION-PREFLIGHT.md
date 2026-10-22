# Progression 2.0 Phase 3-4C — Integration Preflight / Audit

- 監査日: 2026-09-23
- 監査対象 `origin/main`: **`dff233c042d2df6ee1c3a92f2d2419830aa05460`**（PR #210 Dev CI Phase 2A の merge）
- Branch: `claude/teto-pizza-p3-4c-preflight-cvtylb`（docs-only）
- 親 Issue: #182（Progression 2.0）
- 前提 SSOT（再監査はしない。差分だけを見る）:
  - PR #204 `docs/reports/PROGRESSION-2.0_PHASE-3-4_PreImplementation-Audit.md`（Phase 3-4 の Fresh Audit と slice 計画。OPEN）
  - PR #209 `docs/reports/PROGRESSION-2.0_OD-03_DECISION-BRIEF.md`（OD-03 の A/B/C1/C2 比較。OPEN）
- 対象 PR: #205（3-4A、head `9035606`）、#206（3-4B、head `4c1da87`）

> **Scope:** 監査と docs だけを扱う。`src/**`、`e2e/**`、`.github/**` は変更していない。
> #205/#206/#209 には push していない。merge も rebase もしていない。**OD-03 は決めていない。**
> 3-4C の runtime 実装には着手していない。3-4D 以降の設計には入らない。CI は再実行していない。
> 以下の「統合結果」は、ローカルの一時 worktree（scratchpad）に `git merge-tree` で作った合成 tree
> を使った結果で、どの branch にも push していない。

---

## 0. GitHub 実状態（監査開始時に取得）

| 項目 | 状態 |
|---|---|
| `origin/main` | `dff233c` Dev CI Phase 2A（#210）。1 つ前は `66abe43`（#202 の merge） |
| PR #210 | **MERGED**（2026-09-23 21:19Z）。post-merge Full WebKit は別系統で確認中なので、本監査では判定しない |
| PR #202 | **MERGED**（`66abe43`）。Lunch Rush pool を discovered ∩ available に限定し、空なら fail-closed |
| PR #205（3-4A） | **OPEN・未マージ**。head `9035606bec2cec112289654ce4c4e7bebaca303a`、base `d6b6ef9` |
| PR #206（3-4B） | **OPEN・未マージ**。head `4c1da8703bb22a2be7cad911f92ec33cb0f0485d`、base `d6b6ef9` |
| PR #209（OD-03 Brief） | **OPEN・未マージ**。head `d719f1d`、base `66abe43` |
| PR #204（Phase 3-4 Audit） | **OPEN・未マージ**。head `bf70eda`、base `1e73a7d` |
| #205/#206 の CI | head 上で `build`、`classify`、`webkit`、`WebKit Gate` がすべて success。ただし **base が `d6b6ef9`（#202 と #210 の前）で、#210 以前の 1 job WebKit で実行されたもの**（§4.3） |

---

## 1. 結論（TL;DR）

1. **テキスト上の競合はない。** main+#205、main+#206、#205+#206、main+#205+#206 のどれも
   `git merge-tree` で clean。#205、#206、main（`d6b6ef9..dff233c`）が変更するファイルは互いに
   1 つも重ならない。
2. **合成 tree（main+#205+#206）は green。** typecheck と lint は clean。unit は **2484/2484**。
   Chromium E2E は 390×844 と 360×800 の両方で **116/116**。WebKit はこのコンテナに browser が
   ないため未実行（§12）。
3. **#202 と #210 で変わった前提は 3 つ。** Mission pool API、reducer fixture の seed 方式、
   WebKit CI の構成（§4）。どれも #205/#206 のコードには影響しないが、3-4C の作業量と CI の手順が変わる。
4. **3-4C の最大のリスクは OD-03 ではなく save。** 見つかった P0 は 3 件で、すべて OD-03 と無関係に
   先に決められる。
   - **P0-S1:** 在庫の単位を piece から 1 枚分（use）に変える migration を、同じ `inventory` key の
     中で in-place に行うと、rollback と roll-forward で**単位が混ざり、変換が二重にかかる**（§7）。
   - **P0-S2:** 3-4C が `starterGrantClaimedRecipeIds` の維持をやめると、EP4 build に rollback した
     瞬間に全 recipe 分の無料 grant が発生する（R-03 の逆方向。§6、§13）。
   - **P0-S3:** `Ingredient.unlockCondition` は今、「在庫が有限かどうか」の判定も兼ねている
     （`hasStock`、`consumePizzaInventory`）。EP1 の撤去と一緒に消すと、**全材料が無限在庫になる**（§5.3）。
5. **OD-03 が影響するのは「gate 値の出どころ」と、それに付随するテストと表示だけ。**
   gate の読み取りを 1 つの関数に集約しておけば、OD-03 の決定は 1 か所の差し替えで済む（§9）。
6. **判定: 3-4C は現時点で No-Go。** 理由は OD-03 が未決定であることと、#205/#206 が未 merge で
   あること。それ以外の前提（本レポートの §10 の仕様を固めること）は、OD-03 を待たずに今すぐ
   進められる。Go/No-Go checklist は §14。

---

## 2. 最新 main と #205 HEAD の差分

| 項目 | 内容 |
|---|---|
| merge-base | `d6b6ef9`（main より 27 commit 古い） |
| #205 が追加するファイル（すべて新規） | `src/data/progressionUnlocks.ts`（+test）、`src/logic/progressionStars.ts`（+test）、`src/logic/progressionEconomy.ts`（+test） |
| main 側の変更（`d6b6ef9..dff233c`）と重なるファイル | **なし** |
| 既存コードからの import | なし（未配線のまま） |
| #205 から既存コードへの依存 | `IngredientState` 型（`src/state/progression.ts`）の import だけ。main で変更されていない |
| authority との整合 | `progressionUnlocks.test.ts` が authority JSON の 105 行を pin している。合成 tree でも pass |
| production の 22 ingredient との対応 | 22 件すべてに authority の行がある（欠落 0）。無限在庫の 3 件（basil/mozzarella/tomato-sauce）は authority の `initialOwned` の 3 件と一致 |

**判定:** main に対してそのまま統合できる。#202 の変更（Mission pool）とは意味的にも独立している。

## 3. 最新 main と #206 HEAD の差分

| 項目 | 内容 |
|---|---|
| merge-base | `d6b6ef9` |
| #206 が変更するファイル | `src/state/persistence.ts`（`writeSave` を追加し、3 つの書き込み経路をすべて経由させる）、`src/state/persistence.forwardCompat.test.ts`（新規、14 件）、`e2e/save-forward-compat-3-4b.spec.ts`（新規）、Result report |
| main 側の変更と重なるファイル | **なし**。#202 は `persistence.ts` にも e2e の seed helper（`e2e/gestures.ts`）にも関わらない。新しい spec は `gestures.ts` を import しない |
| 挙動 | `loadSave()` の結果は変わらない。書き込みのときだけ、未知の id と未知の top-level key を保持する |

**判定:** main に対してそのまま統合できる。ただし、#206 のテストのうち 2 件は **EP4 の load 時
catch-up を「実際に書き込みが起きる契機」として使っている**。3-4C で EP4 を撤去すると、この 2 件は
前提を失う（§6.2）。

## 4. PR #202/#210 マージ後に前提が変わった箇所

### 4.1 #202（Lunch Rush = discovered ∩ available）

| 変わったもの | 3-4C への影響 |
|---|---|
| `pickMissionOrder(available, discovered, exclude)` が 3 引数になり、`Order \| null` を返す | #204 の「3-4C は #202 の merge を待つ」という依存は**解消した** |
| `nextMissionOrderState` は pool が空なら何もしない（fail-closed） | 3-4C で `availableRecipeIds` の定義が「EP1 AND owned」から「必要な材料をすべて OWNED」に変わる。Mission の pool は discovered ∩（全材料 OWNED）になる。発見済みの recipe は材料を持っているはずなので、pool が縮むことはない |
| reducer と App のテスト 13 本が「発見済み Margherita」などを seed するようになった | 3-4C の fixture fallout の範囲が広がる。**Mission 系の fixture は Dex と owned の両方を明示的に seed しないと、pool が空になって fail-closed する**。これまで REGISTER_TO_DEX の EP4 grant が暗黙に owned を増やしていたテストは要確認 |
| e2e の seed（`6d0432f`: Lunch Rush 用に発見済み Margherita を seed） | 3-4C の後も有効（Margherita の材料は初期 OWNED） |

### 4.2 #210（WebKit 4 shard）

| 変わったもの | 3-4C への影響 |
|---|---|
| Full WebKit は 4 job（2 viewport × shard 1/2, 2/2）。必須 check は **`WebKit Gate`** | 3-4C は `src/**` を変えるので classifier 上は常に Full になる。`webkit-full` label は不要（付けても害はない） |
| `push: main` で post-merge Full が走る | 3-4C の merge 後、main で Full WebKit を確認する手段ができた。**Go の条件にする**（§14） |
| docs だけの push で WebKit を再利用するルール（`tested_base` が同じ場合） | 3-4C の Result report を後から push しても、main が動いていなければ WebKit は再実行されない |

### 4.3 #205/#206 の CI は古い base の結果

#205/#206 の CI は `d6b6ef9` を base に、#210 より前の `webkit` 1 job で実行された。いまの main
（#202 と #210 を含む）との合成結果に対しては、GitHub 上では**まだ一度も CI が走っていない**。
本監査では合成 tree をローカルで検証したが（§1-2）、sharded WebKit は未実行である。
→ merge の前に、owner が各 PR の branch を更新して（Update branch）CI を走らせる。これは本監査の
範囲外で、本監査は何も実行していない。

## 5. #205 の progression rule API を 3-4C で接続する箇所

行番号は main `dff233c` のもの。#205/#206 はこれらのファイルに触れていないので、合成 tree でも同じ。

### 5.1 置き換え表

| 現在の呼び出し | 場所 | 3-4C で使う #205 API | 備考 |
|---|---|---|---|
| `totalStars(dex)` を gate に使う | `gameReducer.ts:1326`（PURCHASE）、`ShopOverlay.tsx:115`、`pizzaSelect.ts:35,44` | `progressionStars(dex)` | Dex 画面の熟練度表示（`DexOverlay.tsx:22`）は gate ではないので ΣBEST のままでよい。**ただし Shop の「⭐N」表示は gate と同じ値を使うこと**（表示と判定がずれるのを防ぐ） |
| `ingredientState(ingredient, owned, totalStars)` | `ShopOverlay.tsx:239`、`economy.ts:113` | `progressionIngredientState(unlock, owned, stars)` | |
| `purchaseIngredient` | `gameReducer.ts:1314-1335` | `purchaseProgressionIngredient` | 購入 1 回で +10 use。`starterGrantOnly` による `NOT_FOR_SALE`（`economy.ts:124`）は消える |
| `restockIngredient` | `gameReducer.ts:1338-1360`、Shop | `refillProgressionIngredient` | 価格は `ceil(price × 0.5)`、+10 use |
| `consumePizzaInventory(pizza, inv)` | `gameReducer.ts:977,1009`（CONFIRM_BAKE） | `consumePizzaUse` を**pizza 単位で集約する関数**（3-4C で新規） | #205 の関数は材料 1 つずつ。「この pizza に 1 回でも使われた有限材料それぞれから −1」を 1 つの純関数にまとめ、1 回の状態遷移で適用する（EP2 と同じ atomic 性） |
| `canPlaceIngredient` / `hasStock` / `remainingStock` | `inventory.ts`、`gameReducer.ts:621,674,721`、`IngredientTray.tsx:430-431`、`InventoryOverlay.tsx:82`、`ShopOverlay.tsx:280` | 使用単位を use にした判定と、`remainingPizzaUses` | scatter でも「use が 1 以上あれば、何片でも置ける」にする（1 枚目の配置が 1 use を予約する） |
| `applyStarterGrants` | `App.tsx:144`（load 時）、`gameReducer.ts:1107`（REGISTER_TO_DEX）、`gameReducer.ts:1281`（MISSION_NEXT_ORDER） | **削除** | `buildStarterGrantNotice` の UI も消える。**ledger の扱いは §6.1 の P0-S2 を参照** |
| `recipeUnlocked` / `Recipe.unlockCondition` | `progression.ts:50-77,98-110`、`starterStock.ts:125`、`pizzaSelect.ts`、`economySimulation.ts` | **削除** | `isRecipeAvailable` は「必要な材料をすべて OWNED」だけになる |
| `starterGrantOnly` による Shop の非表示 | `ShopOverlay.tsx:53` | **削除** | 代わりに LOCKED の行をどう出すかは 3-4D。3-4C の最小 UI は AVAILABLE_TO_BUY を購入できる行として出すだけ |
| `EARLY_GAME_HINT_THRESHOLD` | `ingredients.ts:482-495`、`ShopOverlay.tsx:129` | 要見直し | `unlockCondition` の件数から作っている。§5.3 と同じ理由で、定義を変えると値が変わる |
| `getProgressionIngredientUnlock(id)` | 新規 | runtime の `INGREDIENTS`（22 件）との join | Shop に出すのは **runtime にある 22 件と authority 表の共通部分だけ**。authority にしかない 83 件は、表示用のデータ（名前、絵）がないので出さない |

### 5.2 Gate の読み取りを 1 か所にまとめる

3-4C では、gate の値を**すべて 1 つの関数**（例: `effectiveIngredientGate(ingredientId)`）から
読むようにする。この関数だけが「OD-03 で決まった gate の出どころ」を知っている。
`progressionIngredientState` にはこの関数の結果を渡す（`unlock` を上書きしたコピーを渡すか、
引数を 1 つ増やすかは実装で決める）。
こうしておけば、OD-03 が A/B/C1/C2 のどれになっても、変わるのはこの関数とそのテストだけになる（§9）。
**`progressionUnlocks.ts` の値そのものは編集しない。** このファイルは authority JSON に pin されて
おり、header にも「値を変えるなら JSON 側を変える」と明記されている。

### 5.3 P0-S3: 「有限在庫」の判定を `unlockCondition` から切り離す

現在は `!ingredient.unlockCondition` が「無限在庫」の意味を兼ねている（`inventory.ts`の
`hasStock`、`remainingStock`、`consumePizzaInventory`。`starterStock.ts` の grant 対象の判定。
`ingredients.ts:482` の件数）。3-4C で EP1 の `unlockCondition` を取り除くと、この判定が
**全材料を無限在庫と見なす**ようになり、テストでも見逃しやすい（在庫が減らないだけで、何も落ちない）。
→ 判定は `getProgressionIngredientUnlock(id)?.initialOwned === true`（3 件）に一本化する。
これを 3-4C の必須テストにする（§11 T-C3）。

## 6. #206 の forward-compatible persistence を壊し得る箇所

`writeSave` は「今 storage にある未知のデータを、書き込む内容に足してから書く」。known な key に
ついては書き込む内容が常に勝つ。この仕組みを前提にすると、3-4C で次の変更をすると壊れる。

### 6.1 壊し得る変更

| # | 3-4C でやりがちな変更 | 何が起きるか | 対策 |
|---|---|---|---|
| F-1 | `PersistentSaveV2` から `starterGrantClaimedRecipeIds` を消す（EP4 を撤去したので不要に見える） | `KNOWN_SAVE_KEYS` に残っていれば、次の書き込みで storage から**消える**（known key は extras に入らない）。`KNOWN_SAVE_KEYS` から外せば未知扱いで残るが、中身は更新されない | **field を消さない。** 3-4C 以後も読み書きする（§6.1 P0-S2 の saturation と合わせる） |
| F-2 | **P0-S2:** ledger を更新しなくなる | 3-4C の後に始めたプレイヤーの ledger は空のまま。EP4 build に rollback すると、load 時の catch-up が EP1 で unlock 済みの全 recipe について grant を払う（材料の OWNED と在庫が無料で付く）。roll-forward しても OWNED は永続なので、**gate を飛ばして材料を持った状態が残る** | 3-4C の migration と新規 save の両方で、ledger に**全 shipped recipe の id を入れておく（saturation）**。新しい build では ledger は使われないので害はなく、古い build の grant は二度と起きない |
| F-3 | 在庫を use 単位にするために新しい top-level key（例: `stockUses`）を足すが、`KNOWN_SAVE_KEYS` と sanitizer に登録しない | `loadSave` がその key を読まない。書き込み側は `{...extras.topLevel, ...next}` なので、`next` に入れれば残るが、load で失われる | key を足すなら `KNOWN_SAVE_KEYS`、`sanitizeSave`、既定値の 3 か所に同時に登録する |
| F-4 | 新しい在庫 map を足すが、未知 id の保持を `inventory` にしか実装していない | 3-4G で追加される材料の在庫が、それより古い build で書き込まれると消える | #206 の `extractForwardCompatExtras` と同じ扱い（未知だが形式の正しい id と、非負整数の値を保持）を新しい map にも入れる。テストは #206 のものを流用する |
| F-5 | `schemaVersion` を 3 に上げる | #206 より前の build**と** #206 の build の両方で、root が認識されずに既定値で上書きされる（save 全体が消える） | **上げない**（#204、#206 と同じ方針） |
| F-6 | 材料や recipe の id を rename する、または `INGREDIENTS`/`RECIPES` から外す | その id のデータが「未知」扱いになる。保持はされるが、gameplay からは見えなくなる | rename も削除もしない。authority の id は production の id と一致していることを確認済み（§2） |
| F-7 | `persistProgress`/`persistDex`/`persistMissionBest` 以外の書き込み経路を新しく作る（例: migration 専用の書き込み） | `writeSave` を通らないと extras が消える | 書き込みはすべて `writeSave` を通す。既存のテスト「3 つの書き込み経路すべてで保持される」に新しい経路を追加する |
| F-8 | load 時の migration の結果を、差分がなくても毎回書き込む | #206 の「mount だけでは書き込まない」テストが落ちる。致命的ではないが、ずっと書き込み続ける | migration は「marker がないときだけ 1 回」にする（§7.3） |

### 6.2 #206 のテストのうち、3-4C で書き直しが必要なもの

- `e2e/save-forward-compat-3-4b.spec.ts`: 「mount 時に実際の書き込みが起きる」ことを、EP4 の
  catch-up が `funghi` を ledger に足すことで確かめている。3-4C では EP4 がなくなるので、この
  `expect.poll(... toContain("funghi"))` は**永遠に満たされない**。
  → 3-4C では、書き込みの契機を「piece→use の migration の書き込み」か「Shop での購入」に変える。
  **弱めてはいけない。** 未知データが実際の書き込みと reload を生き残ることを、引き続き確かめる。
- `persistence.forwardCompat.test.ts` の「runtime hydration が future data の有無で変わらない」:
  `applyStarterGrants` を hydration の手順に含めている。3-4C では hydration の手順を
  「loadSave → migration → createInitialGameState」に変えて、同じ性質を確かめる。

## 7. piece → one-pizza-portion（use）inventory migration

### 7.1 現状の単位

- spread（olive-oil、pesto）: **すでに 1 枚 = 1 単位**（`consumePizzaInventory` は sauce ごとに 1）。変換は 1:1
- scatter（残りの有限 17 件）: **置いた片数**を消費する。recipe によって 1 枚あたりの片数が違う

| 材料 | 1 枚あたりの片数（recipe ごとの minCount） | 最小 | 最大 |
|---|---|---:|---:|
| pepperoni | pepperoni 4、meat-lovers 1 | 1 | 4 |
| onion | fugazza 4、tonno 2 | 2 | 4 |
| oregano | marinara 2、fugazza/napoletana/capricciosa 1 | 1 | 2 |
| mushroom | funghi 3、capricciosa 2 | 2 | 3 |
| sausage | salsiccia 3、meat-lovers 2 | 2 | 3 |
| bacon | breakfast 3、meat-lovers 2 | 2 | 3 |
| egg、ham | 1 | 1 | 1 |
| gorgonzola、parmigiano、fontina、black-olive | 2 | 2 | 2 |
| garlic、cherry-tomato、anchovy、tuna、rosemary | 3 | 3 | 3 |

### 7.2 変換式（OD-03 とは無関係。3-4C の着手時に確定する）

| 案 | 式 | pepperoni 12 片の場合 | 性質 |
|---|---|---:|---|
| **M-max（推奨）** | `ceil(片数 / その材料の最大 minCount)` | 3 | 最も多く使う recipe で作れる枚数を下回らない。在庫が 1 片でもあれば 1 use 以上になる。EP4 の grant（`minCount × 10`、共有材料は max）は、ちょうど 10 use に戻る |
| M-min | `ceil(片数 / 最小 minCount)` | 12 | 最も寛大。pepperoni だけ 4 倍になるなど、材料による偏りが大きい |
| M-flat | `min(片数, 10)` など固定値 | — | 単純だが、既存の在庫量を反映しない |

**推奨は M-max。** プレイヤーが以前その材料で作れた「最も多く使う recipe の枚数」を下回らず、
EP4 の grant 量ともきれいに対応する。どの案を選んでも経済への影響は小さい（既存の在庫は多くて
40 片程度）。選んだ式は 3-4C の Result report に書き、owner に通知する。

### 7.3 保存の形（P0-S1）

| 案 | 内容 | rollback の安全性 |
|---|---|---|
| **in-place（非推奨）** | 同じ `inventory` key の値を use に書き換える | 古い build はこの値を片数として読むので、在庫が目減りする（pepperoni 3 use → 3 片）。古い build が片数で減らした値を、新しい build が use として読む。roll-forward のたびに変換をもう一度かけるかどうかが判別できず、**二重変換**が起きる |
| **別 key + legacy の dual-write（推奨）** | use の在庫は新しい top-level key（例: `stockUses`）に持つ。これを migration の marker も兼ねる（key があれば変換済み）。`inventory` には `use × 最大 minCount` の片数を書き戻し続ける | 古い build は `inventory`（片数）をそのまま使える。#206 がある build なら `stockUses` を保持する。#206 がない build が書き込むと `stockUses` は消えるが、roll-forward で `inventory` から再変換され、ほぼ同じ値に戻る。marker があるので二重変換は起きない |

rollback 中に古い build で消費した分は `stockUses` に反映されない。roll-forward 後の在庫は少し
多くなるが、これはプレイヤーに有利な方向なので許容する（§13）。

## 8. existing save / new game / future-ID save の transition

3-4C の load 手順は `loadSave → (marker がなければ) migration と 1 回だけの書き込み → createInitialGameState`。

| ケース | Dex / BEST | ⭐ | OWNED | 在庫 | Pitz / missionBest | EP4 ledger | 期待される結果 |
|---|---|---|---|---|---|---|---|
| **N0 新規**（save なし、または reset） | 空 | 0 | 初期 3 件 | `stockUses: {}`（marker あり） | 既定値 | **saturated** | 作れるのは Margherita だけ。egg/bacon/onion は ⭐2 まで LOCKED |
| **E1 既存 v2**（3-4C より前の途中データ） | そのまま | Σmax(2,BEST) ≥ ΣBEST（**再 lock なし**） | そのまま（grandfather、C-04） | §7.2 で 1 回だけ変換 | そのまま | saturate | 発見済みの recipe はすべて作れる（材料は OWNED）。追加の購入は authority の gate に従う |
| **E2 既存 v1** | v1→v2（既存の処理）のあと E1 と同じ | | | | | | 既存の v1→v2 テストに、3-4C の migration の段階を足して確かめる |
| **E3 EP4 以前の save**（grant が未 claim） | そのまま | | そのまま | 変換 | | saturate（**未 claim の grant は払わない**） | EP4 以降の build で 1 度でも load していれば claim 済みなので、影響するのはごく古い save だけ。払うには EP1 のコードを残す必要があり、atomic な撤去と矛盾するので払わない。Result report に書く |
| **E4 gate より上の材料を所有**（EP4 で入手） | そのまま | | そのまま（LOCKED に戻さない） | 変換 | | | 補充もできる。OD-03 が A の場合は、新規プレイヤーとの差（cohort の非対称）になる（§9） |
| **F1 未知 id を含む save**（#206） | 未知 id は保持されるが gameplay からは見えない | 未知 id は数えない | 同左 | `inventory` と `stockUses` の両方で未知 id を保持（F-4） | | 未知 id を保持 | Dex の件数表示は runtime の件数のまま（例: 1/15） |
| **X1 壊れた save / schemaVersion が未知** | 既定値に戻る（変更なし） | | | | | | 既存の方針のまま |

## 9. OD-03 A/B/C1/C2 それぞれで 3-4C の実装が変わる箇所

OD-03 が決めるのは **ingredient の gate 値だけ**。価格（60/100/140/180）、在庫の規則、⭐の式、
save の規則は、どの Option でも同じ（#209 §3）。

| 箇所 | A（authority のまま） | B（15 件で再計算） | C1（hard lock の 3 件を上書き） | C2（保証最低で届かない 7 件を上書き） |
|---|---|---|---|---|
| `effectiveIngredientGate` の中身（§5.2） | `PROGRESSION_INGREDIENT_UNLOCKS` をそのまま返す | runtime の pool から `2 × ceil(0.6 × それより前に発見可能な数)` を出す。build 時に表にするか、runtime で計算するか | authority の値に、3 行の上書き表を重ねる | 7 行の上書き表を重ねる |
| 追加の永続データ | なし | tranche で gate が上がったときに再 lock を許さないなら、save ごとの固定値が必要（#209 Q4）。その場合 F-3/F-4 の対策が必要 | 上書きを解除するときに同じ問題がある | 同じ |
| 必須のテスト | 新規プレイヤーの「届かない recipe」集合を BEST ごとに固定（★5 で {genovese, quattro-formaggi}）。既存 save の非対称（E4） | 全 BEST で 15/15 に届く。pool の大きさごとの snapshot。authority と同じ式で 101 件のとき一致する | 順序の逆転（Genovese が Marinara より先）を仕様として固定。★≤3 の skill lock | 全 BEST で 15/15。seq 順の単調性が崩れることを許容するテスト |
| Pizza Select の未入手 recipe の説明（3-4C の最小限） | 「今は作れない」を正直に出す必要がある（hard lock）。#209 Q8: 3-4E を 3-4C と同時にするかは owner 判断 | 常に「材料を買う」か「Pitz を貯める」 | skill lock が残るので「BEST を上げる」の説明が要る | B と同じ |
| Human Replay の到達点 | ★3 では Marinara の後、anchovy ⭐40 で止まる | ★2 で 15/15 | ★2 では Genovese の後、garlic ⭐28 で止まる | ★2 で 15/15 |
| `progressionUnlocks.ts` | 変更なし | 変更なし（再承認で authority JSON を改める場合は、JSON と生成器から変える） | 変更なし | 変更なし |

## 10. OD-03 の決定に依存せず、先に確定できる仕様

以下は OD-03 の結果にかかわらず同じなので、今のうちに確定しておける。3-4C の着手時に
そのまま仕様として使う。

1. **atomic cutover の範囲:** EP1 の recipe unlock、EP4 の recipe 単位の grant、`starterGrantOnly`
   による `NOT_FOR_SALE` を同じ PR で撤去し、⭐ gate、authority の価格、購入時の +10 use、
   R10 の補充（×0.5、+10 use）を入れる（#204 R-01/R-03）。
2. **⭐:** `progressionStars = Σ max(2, BEST)`。永続化しない（Dex から毎回導出する）。
3. **lifecycle:** LOCKED → AVAILABLE_TO_BUY（⭐ ≥ gate、境界を含む）→ OWNED（永続）。
   初期 OWNED の 3 件は無限在庫で、売り物ではない。
4. **有限在庫の判定:** `initialOwned` の 3 件だけが無限。`unlockCondition` とは切り離す（P0-S3）。
5. **単位:** 1 枚 = 1 use。scatter は、その枚に 1 片でも置けば 1 use を消費する。
   bake が在庫不足で止まることはない（配置時の Stock Gate で防ぎ、bake 時は 0 で止める。EP2 と同じ）。
6. **migration:** §7.2 の M-max。別 key と legacy への dual-write（§7.3）。marker があれば 1 回だけ。
7. **transition:** §8 の表。OWNED、Dex、Pitz、missionBest はすべて維持する。ledger は saturate する。
8. **save の不変条件:** `schemaVersion` は 2 のまま。書き込みはすべて `writeSave` を通す。
   新しい key と map には #206 と同じ未知 id の保持を入れる（F-1〜F-8）。
9. **`availableRecipeIds`:** 必要な材料がすべて OWNED であること。在庫の有無は含めない
   （在庫を考慮した Mission の pool は 3-4F）。
10. **Lunch Rush:** pool は #202 のまま（discovered ∩ available）。在庫が 0 の材料を含む注文が
    出る問題は現在の production にもあり、3-4F で扱う（P1 のまま引き継ぐ）。
11. **Shop（3-4C の最小限）:** AVAILABLE_TO_BUY の行を購入できる状態で出す。OWNED で有限の行には
    補充を出す。⭐ の表示には gate と同じ `progressionStars` を使う。runtime にない 83 件は出さない。
    LOCKED の行の見せ方は 3-4D で扱う。
12. **Pitz の報酬:** 変更しない（OD-02 と一致済み）。
13. **gate の読み取り:** 1 つの関数に集約する（§5.2）。

## 11. atomic cutover に必要なテスト

### 11.1 Unit（Vitest）

| ID | 内容 |
|---|---|
| T-C1 | EP1 がなくなったことの確認: `Recipe.unlockCondition` と `recipeUnlocked` の参照が 0 件で、`isRecipeAvailable` が owned だけで決まる |
| T-C2 | EP4 がなくなったことの確認: load、REGISTER_TO_DEX、MISSION_NEXT_ORDER のどれも在庫や OWNED を無料で増やさない（R-03） |
| T-C3 | 有限在庫の判定: 22 件それぞれについて、無限なのは 3 件だけ。有限の 19 件は bake で必ず 1 use 減る（P0-S3） |
| T-C4 | 購入の取引: ⭐ が gate 未満なら LOCKED、Pitz が足りなければ INSUFFICIENT_FUNDS で状態は変わらない。成功すると Pitz −価格、OWNED、+10 use を 1 回の遷移で。二重 dispatch でも二重に課金されない |
| T-C5 | 補充の取引: `ceil(price × 0.5)`、+10 use。未所有と初期 3 件は拒否 |
| T-C6 | 消費: 同じ材料を何片置いても 1 use。1 枚に有限材料が複数あれば、それぞれ −1 を atomic に。在庫が 0 なら 0 で止まる |
| T-C7 | Stock Gate: use が 0 の材料は置けない（sauce と scatter の両方）。1 以上なら何片でも置ける |
| T-C8 | migration: M-max の表（§7.1 の全 17 件と spread 2 件）。marker があれば 2 回目は何もしない。1 回だけ書き込み、以後の mount では書き込まない |
| T-C9 | dual-write: 書き込むたびに `inventory` = `use × 最大 minCount`。古い build（#206 あり、なし）の書き込みを模した save から roll-forward しても、二重変換が起きない |
| T-C10 | ledger の saturation: 新規、migration、reset のどれでも、全 shipped recipe の id が入る。それを EP4 の `applyStarterGrants` に渡しても grant が 0 件（rollback の安全性） |
| T-C11 | 既存 save で再 lock しない: Σmax(2,BEST) ≥ ΣBEST。E1〜E4 の fixture で、発見済み recipe がすべて available のまま |
| T-C12 | forward-compat の回帰: #206 の 14 件がすべて pass。新しい key と map を加えて（F-3、F-4）、hydration の手順を差し替えたもの（§6.2） |
| T-C13 | Mission: pool は discovered ∩ available のまま。pool が空なら fail-closed（#202 のテストを維持） |
| T-C14 | 経済のシミュレーション: `economySimulation.ts` は EP1/EP4 を前提にしているので、3-4A の `progressionEconomy` を使う形に置き換えるか、廃止する。authority の simulation の先頭イベント（#204 §5.2）との parity を取る |
| T-C15 | OD-03 で決まった Option のテスト（§9 の「必須のテスト」の行） |

fallout が想定されるテストファイル（合成 tree で EP1/EP4/`unlockCondition`/`totalStars`/在庫 API を
参照しているもの）は 34 本。そのうち `starterStock.test.ts`、`economy.test.ts`、
`economySimulation.test.ts`、`progression.test.ts`、`pizzaSelect.test.ts`、
`gameReducer.restock.test.ts`、`gameReducer.inventoryConsumption.test.ts` は、書き直しになる。

### 11.2 E2E

- Chromium の全 spec（390×844 と 360×800）。合成 tree では 116/116（3-4C の前の baseline）
- 3-4C で新しく作る spec: 新規プレイヤーで Margherita → ⭐2 → egg を購入 → Bismarck を発見 →
  Bismarck を焼いて egg の在庫が 1 減る。reload しても OWNED と在庫が残る
- 既存 save の spec: EP4 で所有していた材料を持つ v2 save を seed → 発見済みの recipe がすべて
  作れて、在庫が M-max で変換されている
- `save-forward-compat-3-4b.spec.ts` の書き込みの契機を差し替える（§6.2）
- seed で EP4 を前提にしている e2e（`inventory`、`ownedIngredientIds`、
  `starterGrantClaimedRecipeIds` を seed する 9 ファイル）を確認する

## 12. Chromium / WebKit / Human Replay で必要な検証

| 種類 | 3-4C の要件 | 本監査での実施 |
|---|---|---|
| Unit / typecheck / lint / build | 全件 | 合成 tree で unit 2484/2484、typecheck と lint は clean |
| Chromium E2E | Full（2 viewport）と、§11.2 の新しい spec | 合成 tree で 116/116（390×844 と 360×800） |
| WebKit | **Full が必須**（storage、Shop、Stock Gate）。#210 の 4 shard と `WebKit Gate`。merge 後は post-merge Full も green であること | 未実施（このコンテナには WebKit がない）。#205/#206 の head での WebKit は、古い base と 1 job 構成の結果 |
| Human Verification（policy §2: gameplay、Shop、Recipe Select） | 390×844 の動画（repo には commit しない）と、before/after の screenshot（`docs/reports/screenshots/<task>/`） | 対象外（docs-only） |

3-4C の Human Replay で必ず撮るシナリオ:

1. **新規プレイヤー:** Margherita を発見 → Shop に egg/bacon/onion が出る → egg を購入
   （Pitz と在庫の表示）→ Bismarck を発見 → 在庫が 1 減る
2. **Stock Gate:** 在庫 1 の材料で 1 枚焼く → 0 になり、tray と Shop で補充を促す表示になる →
   補充する（Pitz −半額、+10）
3. **既存 save:** 3-4C より前の save を読み込む → Dex、OWNED、Pitz が変わらない → 在庫が
   use 単位で表示される
4. **OD-03 の到達点:** 決まった Option の「止まる地点」まで（または 15/15 まで）、fixture の
   save から再現し、そこでの表示（次に何をするか）を見せる
5. **回帰:** Lunch Rush を 1 回、Free Cooking の ORIGINAL を 1 回

## 13. rollback 時の save の安全性

| シナリオ | 推奨の設計（§7.3、F-2 あり）での結果 | 対策がない場合 |
|---|---|---|
| 3-4C を revert し、#206 がある build に戻る | Dex、Pitz、OWNED、missionBest はそのまま。在庫は `inventory`（dual-write の片数）で続けられる。`stockUses` は保持される。ledger が saturate しているので grant は起きない | ledger が空だと、EP1 で unlock 済みの全 recipe の grant が無料で払われる（F-2）。in-place の変換だと、在庫が use を片数として読まれて目減りする |
| #206 もない build まで戻る | `stockUses` は最初の書き込みで消えるが、roll-forward で `inventory` から再変換される。known なデータは失われない | 同上。加えて、rollback 中の未知データは消える（#206 の前提） |
| rollback の後に roll-forward | marker（`stockUses`）があればそのまま使う。なければもう一度 migration する。二重変換は起きない | in-place では二重変換 |
| rollback 中にプレイした分 | 古い build で消費した在庫は `stockUses` に反映されない（プレイヤーに少し有利）。Pitz、Dex、OWNED は共有の key なので反映される | — |
| 3-4C の後に OWNED になった材料 | 古い build でも OWNED のまま（EP1 の recipe gate は残るが、材料は失わない）。補充もできる | — |
| `schemaVersion` | 2 のまま（F-5）。どの build も root を認識できる | 3 にすると、古い build で save 全体が既定値に戻る |

**結論:** 3-4C の revert だけで元に戻せるための条件は、(1) ledger の saturation、(2) 在庫は別 key と
legacy への dual-write、(3) `schemaVersion` を上げないこと、の 3 つ。どれも OD-03 と無関係に決められる。

## 14. 3-4C 開始前の Go/No-Go checklist

| # | 条件 | 現在 |
|---|---|---|
| G-1 | OD-03 が owner によって決定され、ledger に記録されている（C の場合は C1/C2、上書き値、解除条件まで。#209 Q1〜Q8） | ❌ 未決定 |
| G-2 | OD-03 が A または C1 の場合: end-of-content の説明を 3-4C と同時に出すかどうか（#209 Q8）が決まっている | ❌（G-1 次第） |
| G-3 | PR #205 が main に merge されている。merge の前に、今の main で CI（sharded WebKit を含む）が green | ❌ OPEN。CI は古い base の結果 |
| G-4 | PR #206 が main に merge され、**本番に deploy されている**（3-4C より前に。rollback の安全性の前提） | ❌ OPEN |
| G-5 | main の post-merge Full WebKit（`dff233c` 以降）が green | ⏳ 別系統で確認中 |
| G-6 | §10 の OD-03 に依存しない仕様（特に 5、6、7、8、13）を 3-4C の Issue か PR の本文で確定している | ⏳ 本レポートで提案済み。確定は 3-4C の着手時 |
| G-7 | 在庫の migration の方式（M-max、別 key と dual-write、marker）が合意されている | ⏳ 提案済み（§7） |
| G-8 | 3-4C の branch は、merge 済みの #205/#206 を含む最新の main から切る | — |
| G-9 | 3-4C で `.github/**` と `functions/**` を変更しない（ranking や CI と衝突しない） | ✅ 計画上 |
| G-10 | 3-4C の Human Verification（§12 の 5 シナリオ）を実施できる Preview 環境がある | ✅ 既存の運用 |

**判定: No-Go。** 満たしていないのは G-1〜G-4（外部の決定と merge 待ち）だけ。G-6/G-7 は本レポートの
内容で合意できれば満たせる。

---

## 付録 A. 検証コマンド（合成 tree、ローカルのみ）

```
git merge-tree --write-tree origin/main <#205 head>             # clean
git merge-tree --write-tree origin/main <#206 head>             # clean
git merge-tree --write-tree <#205 head> <#206 head>             # clean
git merge-tree --write-tree <main+#205 の一時 commit> <#206 head>  # clean
# 合成 tree の worktree（scratchpad）で:
npm ci && npx tsc -b && npm run lint                            # exit 0 / exit 0
npx vitest run                                                  # 2484 passed
npx playwright test --project=iphone-390x844 --project=iphone-360x800   # 116 passed
```

一時 commit と worktree は scratchpad にだけ作ったもので、push していない。
