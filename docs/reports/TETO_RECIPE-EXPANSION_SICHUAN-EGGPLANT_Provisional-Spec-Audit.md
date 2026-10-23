# 四川風ナスピザ — 暫定仕様による実装前監査（コード読み取りのみ、docs-only）

基準 `origin/main` = `3570f44`（#648、docs のみ。レシピ・ladder・golden・src は `485c515` から不変）、2026-10-23。`CLAUDE.md` は変更なし。
範囲: コード・テスト・データの**読み取り**と、既存の測定結果の再利用だけ。`src/` `e2e/` workflow・Preview・Production は未変更。追加 CI・scratch gate は未実行。新規 claim・実装 PR・ladder 登録なし。Pinsa / FINISH / 四角いピザ / 複数ソースには触れていない。
Owner 方針: 原典確認待ちで準備を止めず、**暫定仕様**で監査する（OD-B9-13〜16 は維持）。

## 0. 暫定仕様（**仮定であり確定情報ではない**）

| 仮定 | 状態 |
|---|---|
| A1 青ねぎは**焼成前**に載せる | **原典 Q1 未確認の仮定** |
| A2 豆板醤は**生地に塗るソース**（SAUCE の PAINT） | **Q2 未確認の仮定** |
| A3 ナスは**事前調理なし**（生で載せる） | **Q3 未確認の仮定** |
| A4 材料は doubanjiang / eggplant / garlic / green-onion / mozzarella の 5 種、ソース欄「ホットソース」 | 172 証跡（中継 2026-09-22、独立再取得なし）。**Q4 未確認** |
| 個数 doubanjiang 1 / mozzarella 2 / eggplant 3 / garlic 1 / green-onion 2、焼成 58–78 | GAMEPLAY CALIBRATION（暫定） |
| 色 `#8a2b1c` | 仮置き。Owner / 実機 HV で確定 |

A1〜A3 のどれかが崩れたら通常 ladder に入れず、新工程対応の候補へ再分類する（OD-B9-16、判定表は決定記録 §5.6）。

## 1. 既存工程だけで実装できるか（コード読み取り結果）

**結論: A1〜A3 が成り立つ限り、既存工程だけで実装できる。新ジェスチャー・新工程・保存形式の変更・採点の変更は要らない。**

| 論点 | 読み取った事実 | 判定 |
|---|---|---|
| 工程の導出 | `deriveCoreSteps` は sauce 要件があれば SAUCE、cheese があれば CHEESE、topping があれば TOPPING を作る（flammkuchen・pesto 系と同じ経路）。四川風ナスは sauce + cheese + topping → SAUCE → CHEESE → TOPPING → BAKE | 既存 |
| 新ソースの描画 | sauce 描画は `colorOf(ingredientId)` の色だけで決まる。個別扱いは **`olive-oil` のみ**（`sauceLayers.ts` `sauceDisplay.ts` `sauceCanvasSupport.ts` `SauceMergedCanvas.tsx` `ReferencePreview.tsx` ほか）。`fromage-blanc-sauce` と同様、コード追加なしで描画される | 既存 |
| 新ソースの型 | `RecipeSauceProfile.ingredientId` はリテラル union（`recipeSauceProfiles.ts` 行 16）。`"doubanjiang"` を 1 つ足し、`RECIPE_SAUCE_PROFILES` に PAINT 行を足す（`satisfies Record<RecipeId, …>` が全レシピを再検査） | 型の追記のみ |
| トレイの上限 | `MAX_INGREDIENT_PALETTE_SLOTS = 6`。四川風ナスは 5 種（doubanjiang / mozzarella / eggplant / garlic / green-onion）で収まる | 収まる |
| Reference | 非ソース 8 片（2 + 3 + 1 + 2）= RT-01 の 8 スロットリング上限。sauce は片ではない（`computeMechanicalSauceReference`） | 収まる（上限ちょうど。shirasu と同じ） |
| 新トッピング | `green-onion` は shiso / whitebait と同じ手順: `ingredients.ts` 1 行（`pieceVisual`）、`ingredientTaxonomy.ts` 1 行（herb）、`toppingSizeClass.ts` 1 行（xs）、`IngredientGlyph.tsx` の描画 1 つ + `App.css` のグリフ寄せ（`.ingredient-glyph--shiso-leaf, --whitebait-school` と同じ箇所、行 823 付近）+ 参照 SVG | 既存手順 |
| 識別・衝突 | 5 種の集合は既存 62 件のどれとも**完全一致・部分集合・上位集合にならない**（再計算）。重なり ≥3 の既存レシピも無い（eggplant 系は melanzane / parmigiana / ratatouille / baba-ganoush が eggplant を共有するが ≤2 種） | 衝突なし |
| 2 材料 1 step | 8b の shiso + whitebait と同形。コホートは step の**最後の材料**（`ingredientIds` の並び順で決まる） | 既存 |
| 焼成での見え方 | 青ねぎは葉もの。shiso は `bakeRoastResistant: true` と `LIGHT_LEAF` で焼き色の扱いを持つ。green-onion を同様に扱うかは**未決の実装詳細**（仮定 A1 の下で、焼いて焦げる見え方を許容するか） | 実装時に HV で決める |
| 暗色ソースの焼成後の見え方 | 非 oil sauce は共通の CSS（`.pizza-dough--raw/perfect .pizza-sauce-layer:not(--oil)`）。暗い赤褐色が焼成で潰れて見えるかは未確認 | 実機 HV |

## 2. 件数ピン（`deductionGuard.gate` の旧ガード漏えい件数 156→123）への寄与の切り分け

方法: テストの構造を読み、**合成 family の生成式を再現**して、追加材料がどのレシピ（= 状態）を足す／消すかを数えた（ガードは実行していない。漏えいの有無はこの方法では測れない）。

### 2.1 構造
- `FAMILIES` は `INGREDIENTS` を category 別に分け（`SAUCES` / `CHEESES` / `TOPPINGS`）、**配列の添字**で合成レシピを作る。状態数 = 合成レシピ数 × `OWNED_STEPS`（7 通り: 3, 8, 12, 16, 20, 24, "all"）。
- ベースライン: 合成レシピ 556（sauceless 396 / cheeseBase 13 / multiSauce 117 / zeroTopping 12 / noCheese 18）= 3,892 状態。旧ガードの漏えい 156 件（約 4%）。
- 追加材料の効き方は 3 経路:
  1. **TOPPINGS の添字・長さ**（`green-onion` のみ）: `filter(i%3===0)` `filter(i%4===0)` と相手選び `T[(i*3+5)%len]` `T[(i*4+7)%len]` `T[(i*3+2)%len]` が変わる。
  2. **SAUCES の全走査**（`doubanjiang` のみ）: `zeroTopping` だけが `SAUCES.flatMap` で全 sauce を走査する。`multiSauce` は `SAUCES[0..2]`（tomato / olive-oil / pesto）固定で、末尾に足した sauce は無関係。
  3. **"all" ステップの母集団**（両方）: `ALL_INGREDIENT_IDS` に両素材が加わり、"all" の 1/7 の状態で仮説集合が広がる。

### 2.2 再現した差分（`green-onion` を TOPPINGS の末尾、`doubanjiang` を SAUCES の末尾に追加した場合）

| 追加 | sauceless | cheeseBase | multiSauce | zeroTopping | noCheese |
|---|---|---|---|---|---|
| `green-onion` のみ | 396 → 396（**22 入替**） | 13 → 14（+1） | 117 → 126（+12 / −3） | 変化なし | 18 → 18（±1 入替） |
| `doubanjiang` のみ | 変化なし | 変化なし | 変化なし | 12 → 15（**+3**） | 変化なし |
| 両方 | 上 2 つの合算 | | | | |

読み取り:
- 合成レシピの**入替（消える方）が漏えいを持つレシピなら件数は減る**。観測は 156 → 123（−33）で、減少の向きは「topping による再生成（入替・追加・消滅）」と「"all" の母集団拡大」と整合する。`doubanjiang` は **zeroTopping に +3 レシピ（sauce + cheese のみ、topping なし）** を足すだけで、単独では件数を**増やす方向**にしか効かない。
- したがって**主因は `green-onion`（topping の添字再編）と推定**されるが、**確定ではない**。漏えいの有無は合成レシピごとにガードを回さないと分からず、追加 gate は禁止（Owner 指示）のため本監査では測れない。
- **重要な注意**: TOPPINGS / SAUCES の**配列内の位置**が結果を決める（`i%3` `i%4` と `%len`）。再現は「末尾追加」の仮定。実装 PR で挿入位置を変えれば件数は別の値になる。**挿入位置を PR に明記し固定する**こと。

### 2.3 実装 PR で行う原因確認（OD-B9-15 の具体化）
同じ PR ブランチ上で `deductionGuard.gate.test.ts` の件数だけを 4 通りの**データ構成**で測る: ①追加なし（= 156 の再確認）②`green-onion` のみ ③`doubanjiang` のみ ④両方。各構成で hardened の `toEqual([])` が全状態で通ることを同時に確認。件数ピンの更新は④の値で行い、②③の値と §2.2 の差分説明を PR 本文に残す。数値だけの置換は不可。他の gate 定数は触らない。

## 3. 各領域への影響

| 領域 | 影響（暫定仕様 A1〜A3 の下） |
|---|---|
| **ladder** | 通常 step を 1 つ追記: `["doubanjiang","green-onion"]`、key = 四川風ナス、T4、星ゲート無し（前例）。1–55 凍結、追記専用（`discoveryLadder.appendOnly` が導出と一致を固定）。**番号は予約しない**（OD-B9-12/13。着手時点の次番号）。credited +1（58→59）。2 材料の初回購入は T4 で 120 Pitz × 2（8b と同形。Owner 確認済みの前例） |
| **Shop** | step の NEW 行に 2 材料、locked 行の匿名表示、`nextMaterialHint`（導出）。`materialShop.test` ほかの step 行・hint chain のテストを更新（#634 / #580 の前例） |
| **Research** | コホート = step の最後の材料（単独 step）→ 文字なし。**既存エントリの文字は動かない**（他のレシピは最後に解禁する材料が別）。ラベルは「？？？ピザ（<コホート鍵の材料名>）」形式（前例）。`acceptedLetterShifts` 不要、validator 例外なし |
| **catalog / 図鑑 / 章** | 通常レシピ 63、食材 69（sauce 5 / topping 53）。章 4 は 27→28（導出表示、セーブ無影響）。`catalogLedger` の単一台帳、`catalogShelf`（sauce 4→5 の再計数）、`largeCatalogFixtures`（split の sauce 4→5）の pin を更新 |
| **Hint 5.0** | 永久 key-free（`recipeHintRoles`）。単独ソースなので sauce rung は 1 つ。golden（`hint5.ladders55.json` `hint5.alphaFamilyOnly.json`）は**追記専用・削除 0**。`herb` が 1 件増える。`hint5Taxonomy.gate`（G18 一意性、family ラベルに食材名なし）の再実行が要る。sauce は topping family を持たない |
| **DH4 / Anti-Oracle** | production gate は 14/14（事前検証済み）。DH4 audit JSON の category 4→5・topping 52→53・herb +1。ソース色は UI に出るが、未発見レシピの identity を出さない（色は塗れば見える既知情報） |
| **Lunch Rush** | `lunchRush: false`、プール 25 のまま。opt-out 合計 37→38（`lunchRush.exclusion.test`）。Lunch Rush / Dinner は FINISH を持たず、A1〜A3 の通常工程と整合 |
| **★ゲート到達性** | 63 レシピの一律 ★2 = 126★（推定）で goat-cheese 120★ は到達、spinach 130★ は未到達のまま（`ladderReachability.starGate` の再測定が必要。推定、未測定） |
| **ikura（late、OFF）** | late step 番号が +1（OFF では無影響。E5 前の既知宿題） |
| **採点 / Pitz / 保存** | 変更なし。schema v2 |
| **月見（HOLD）** | 影響なし。`green-onion` の仕様（herb・xs・小口切り）は共有されるので、四川風ナスが先に入れば月見の再開時に食材は既にある |

## 4. 最小変更範囲（#634 と #580 の前例から。**読み取りによる想定であり、実装 PR で確定**）

- **data**: `ingredients.ts`（doubanjiang / green-onion）、`recipes.ts`、`recipeSauceProfiles.ts`（union + PAINT 行）、`discoveryCatalog.ts`（target id）、`discoveryLadder.ts`（1 step）、`referencePizza.ts`（Reference + 登録）、`recipeHintRoles.ts`、`orders.ts`、`ingredientTaxonomy.ts`（herb 1 行）、`toppingSizeClass.ts`（xs 1 行）。
- **描画**: `IngredientGlyph.tsx` と同テスト、`App.css`（グリフ寄せ 1 箇所）、`docs/design/references/ingredient-icons-2.0/green-onion.svg`。
- **テスト / golden（pin の更新。assertion は削除・緩和しない）**: `recipeBatchManifest.ts`（batch 宣言）、`catalogLedger` / `catalogShelf` / `largeCatalogFixtures`、`recipes.test` / `cookingProfiles.test` / `discoveryLadder*.test` / `materialShop.test` / `progression.test` / `selectableHint.test` / `lunchRush.exclusion.test`、hint5 golden 2 本、DH4 audit JSON、`deductionGuard.gate`（件数ピン、§2.3）、`ladderReachability.starGate`、新規の四川風ナス専用テスト 1 本。
- **e2e**: 代表 1 本（Shop NEW → 購入 → Research → 塗る → 具 → 焼く → NEW DISCOVERY → Dex、390×844 / 360×800）。WebKit は CI のみ。
- **docs**: Result レポート、HV スクショ（`docs/reports/screenshots/…`、動画は Owner へ直接）。
- **触らない**: 採点・経済・保存形式・`matcher.ts`・FINISH / late catalog・Pinsa・天板・複数ソース・DH4 の gate 本体・`other` family。

## 5. 残るブロッカー

| # | ブロッカー | 状態 |
|---|---|---|
| B1 | **原典 Q1〜Q4**（青ねぎの投入タイミング、豆板醤の使い方、ナスの調理、材料の一致）。A1〜A3 が崩れれば再分類 | 未確認（Owner のページ共有待ち。`https://pizzadb.jp/pizzas/sichuan-eggplant/`、補助 `…/compare/world-pizzas/page/14/`） |
| B2 | 新しい実装 claim | 未投稿（#578 の Phase A は代理 release 済み）。実装担当が着手時に投稿 |
| B3 | 件数ピンの原因確認（§2.3） | 実装 PR 内で実施 |
| B4 | Hint 5.0 gate・catalog/ladder 系の全再実行 | 実装 PR 内で実施（本監査では未実行） |
| B5 | 色 `#8a2b1c`、green-onion の見た目（小口切りの輪・`xs`・焼き色）の実機 HV | HV |
| B6 | 個数・焼成窓 | 暫定のまま Owner が Preview で確認 |
| B7 | Owner の着手 GO | 未 |

## 6. 報告（要約）
- **実装可能性**: 暫定仕様 A1〜A3 の下で、**既存工程だけで実装可能**（新工程・新ジェスチャー・保存変更なし）。FINISH / 下ごしらえは A1〜A3 が崩れた場合のみ必要で、その場合は通常 ladder に入れない。
- **件数ピン**: 主因は `green-onion`（topping の添字再編）と**推定**。`doubanjiang` は zeroTopping に +3 レシピを足すのみ。挿入位置が結果を決めるので固定が必要。確定は実装 PR の 4 構成測定。
- **最小変更範囲**: §4（data 10 ファイル前後 + 描画 3 + テスト群 + e2e 1 + docs）。
