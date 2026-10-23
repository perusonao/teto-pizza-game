# Next Batch (working name Batch 9: 月見 / 柚子えび) — Owner Decisions と実装仕様の確定

Status: **決定の記録と仕様整理のみ（docs-only）。** ゲームコード・テスト・データ・workflow・共有 Preview・本番は変更していない。レシピ実装 PR は未作成。
基準 `origin/main` = `70aa262`（#644、CI インフラのみ。`CLAUDE.md` は変更なし）、2026-10-23。
前提: `docs/reports/TETO_RECIPE-EXPANSION_NEXT-BATCH-2_Fresh-Audit.md`、`docs/reports/TETO_RECIPE-EXPANSION_YUZU-TSUKIMI_Pre-Implementation-Audit.md`。
形式は `TETO_EXPANSION-BATCH-8_OWNER-DECISIONS.md` に倣う。**「決定済み」は Owner が指示した内容だけ**。それ以外は「提案」「未決」と明記する。

## 1. 決定済み（Owner 方針、2026-10-23）

| ID | 決定 |
|---|---|
| OD-B9-1 | 柚子えびの**焼成タイミングは原典確認まで保留**（焼成前で実装するかどうかも確認待ち） |
| OD-B9-2 | 柚子胡椒（`yuzu-kosho`）は**ソースとして仮分類**（`category: "sauce"`, `placement: "spread"`, 既存 PAINT）。色は **`#b5c56a` を仮採用**（実機 HV で確定） |
| OD-B9-3 | `green-onion`: **family = `herb`（L1 のみ、L2 なし）**、`pieceVisual` = 小口切りの輪、**size class = `xs`** |
| OD-B9-4 | 両レシピの**個数・焼成窓は暫定値のまま**（GAMEPLAY CALIBRATION。Owner が Preview で確認） |
| OD-B9-5 | ladder 順は**柚子 56 → 月見 57 を暫定維持**（§5 の矛盾に注意。再判断が要る） |

OD-B9-3 の適用範囲: `green-onion` の 1 行だけ。他の PROPOSED 行（#255 / #293 / #296）は承認しない。glyph（emoji）は表示しない text fallback で、G18（一意性）を満たすものを実装時に選ぶ。

## 2. 事前確認の結果

| 項目 | 結果 |
|---|---|
| main | `70aa262`。通常レシピ 62・食材 67・ladder 55 step。直近の差分は #644（WebKit CI）のみで、データ・ladder・golden は動いていない |
| `CLAUDE.md` | 変更なし。UI/ゲームプレイ変更は `TETO_HUMAN-VERIFICATION-POLICY.md`（390×844 動画は Owner へ直接、before/after スクショは `docs/reports/screenshots/<task>/`）に従う。claim / Owner Gate は `TETO_SESSION-OPERATIONS_1.0.md` |
| レシピ追加の open PR | **無し**。open: #640 / #639（Pinsa 基盤、データ無し）、#633 / #620 / #612 / #587（docs）、#581 / #540（HOLD）ほか。月見・柚子の食材（green-onion / yuzu-kosho）を扱う PR も無い |
| ファイル重複 | #640 が `data/discoveryCatalog.ts` と `data/lateCatalog.ts` を変更。レシピ実装 PR は `discoveryCatalog.ts` に追記するため**同一ファイル**（別ハンクの見込み）。後から入る方が追従 |
| Issue #578 の claim | session `015Uh6…` の Phase A claim（期限 **2026-10-27**）が**有効のまま**。`pr: 634` で更新済みだが `released: true` の投稿は無い。対象に `ingredients.ts` `recipes.ts` `discoveryLadder.ts` `discoveryCatalog.ts` `referencePizza.ts` `recipeHintRoles.ts` `orders.ts` `recipeSauceProfiles.ts` golden を含む＝**次の実装 PR と全面的に重なる**。文面は「味噌・柚子胡椒・タヒニは着手しない」。#634 は merge 済みで、元セッションの稼働は確認できない |
| → 必要な手続き | 実装着手前に、(a) claim の release（本人、または #527 の前例のような Owner 承認の代理 release）か、(b) 新 claim（Phase B、`dependsOn` 無し、files は実装 PR の範囲）。`expires` 既定 72h・最大 14 日。本セッションは実装しないので claim は**投稿していない** |

## 3. 月見（`tsukimi-pizza`）の仕様と影響

### 3.1 データ（暫定を含む）

| 項目 | 内容 | 状態 |
|---|---|---|
| id / 名 | `tsukimi-pizza` / 月見ピザ。discovery target id = `tsukimi-pizza-pizzadb-p14` | 提案（id は前例の命名） |
| 材料 | bacon 3 / egg 1 / mozzarella 2 / green-onion 2（計 8 片 = リング 8 スロットちょうど。shirasu と同じ上限） | **暫定**（OD-B9-4） |
| 焼成窓 | 58–78 | 暫定 |
| 工程 | NO_SAUCE（`RECIPE_SAUCE_PROFILES["tsukimi-pizza"] = null`）→ CHEESE → TOPPING → BAKE。CUT なし（`EXPECTED_NOT_CUT_ELIGIBLE`） | 提案（証跡のソース欄 = チーズ） |
| 宣言 | credited、`lunchRush:false`、Hint = key-free | 前例 |
| 識別集合 | {bacon, egg, green-onion, mozzarella}。既存 62 件のどれとも不一致（`breakfast-pizza` は tomato-sauce を含み別物） | 再計算済み |
| 説明文 | 食材名を列挙してよいが、**工程タイミングは書かない**（Anti-Oracle の前例） | 方針 |

### 3.2 `green-onion`（OD-B9-3）

| 項目 | 実装内容 |
|---|---|
| `ingredients.ts` | `category: "topping"`, `nameJa: "青ねぎ"`（証跡の表記）, `placement: "scatter"`, `unlockCondition: { minTotalStars: 0 }`, `pieceVisual: "green-onion-slices"`, `color` 緑（`#7fae4a` 前後、HV で確定）, `emoji` は未表示 fallback で G18 一意 |
| 描画 | `DedicatedIngredientVisual` 型に 1 値、`IngredientGlyph.tsx` に小口切りの輪の描画、参照 SVG を `docs/design/references/ingredient-icons-2.0/green-onion.svg`（8b の shiso / whitebait と同じ手順、Style Lock v2） |
| `ingredientTaxonomy.ts` | `["green-onion", "herb"]` を `OD-B9-3` コメントつきで 1 行 |
| `toppingSizeClass.ts` | `"green-onion": "xs"`（網羅テストが要求） |
| 名前の衝突 | `green-onion` ⊃ `onion`。**確認済み**: `selectableHint.test` の漏えい検査は `ing:${id}` と `"${id}"` の完全一致で、`ing:onion` は `ing:green-onion` の部分文字列にならない（#584 の `salmon` ⊂ `salmon-roe` は**前方一致**だった）。ただし `salmon-roe` 型の偽陽性を避けるため、実装 PR で `onion` / `green-onion` を同一レシピに含む合成ケースを 1 本足す。表示名「青ねぎ」は「たまねぎ」を含まない（tray / Dex の既存テストの正規表現とも衝突しない） |

### 3.3 影響

| 領域 | 影響 |
|---|---|
| ladder | 新 step（番号は §5）`["green-onion"]`、key = `tsukimi-pizza`、T4、星ゲート無し、credited +1。既存 step は凍結 |
| Research | コホート = green-onion（単独 step）→ 文字なし。既存エントリの文字は動かない（月見の他の材料 bacon(2)・egg(1) はいずれも最後に解禁する材料ではない） |
| 図鑑 | 通常 +1（63）。章 4 は 27→28（導出表示。保存は schema v2 のまま、既存セーブ無影響） |
| Hint 5.0 | 永久 key-free。golden は追記専用（削除 0）。`herb` が 9 件目になるだけで、単独家族にならず k≥2 ガードに影響しない。`hint5Taxonomy.gate`（G18 一意性・family ラベルに食材名なし）の再実行が必須 |
| DH4 / Anti-Oracle | audit JSON の topping 件数が +1。sweep 再実行。新しい fact id が出ないこと |
| Shop | NEW 行と locked 行の匿名表示（8b の前例）。T4: 初回 120 Pitz・補充 60 |
| Lunch Rush | プール 25 のまま（opt-out +1） |
| 採点 / Pitz / 保存 | 変更なし |
| ★ゲート到達性 | 63 レシピ一律 ★2 = 126★（推定）。`ladderReachability.starGate` を再測定 |
| 手元で確定できない点 | 小口切りの輪の見た目、`xs` の大きさ（リング 8 片での見え方）、緑の色。**実機 HV** |

### 3.4 最終判定: 月見を先行できるか

**判定: 条件付きで先行可。** 技術的な阻害要因は無い（新ジェスチャー・新工程・保存変更なし、手順は 8b の shiso / whitebait と同型、重複 PR 無し）。実装 PR の着手前に Owner が次の 2 点だけ決める:

| # | 判断 | 理由 / 推奨 |
|---|---|---|
| **J1** | **ladder 順を「月見 56 → 柚子 57」に入れ替える（または、柚子を待ってから月見を 57 に置く）** | §5。ladder は追記専用で、番号は merge 順で決まる。柚子は OD-B9-1 で保留なので、月見を 56 にして柚子は確定後に次の空き番号（または後乗せ枠）へ置くのが最小。**推奨: 入れ替え** |
| **J2** | **月見の青ねぎ・卵を「焼成前」で暫定実装してよいか（原典未確認のまま）** | 証跡は比較表のみで工程タイミングは無い（青ねぎは仕上げの飾りの可能性もある）。shirasu（8b）が「暫定・焼成前」で出荷された前例どおり進めるか、柚子と同じ原典確認（§4.3）の結果を待つか。**推奨: 原典確認を Owner が柚子と同時に行える見込みなら待たずに着手し、結果が焼成後なら月見も後乗せ枠へ移す（データ書き換え = 小）** |

このほかに必要な手続き: claim の整理（§2）。

## 4. 柚子えびの実装分岐（OD-B9-1 により保留）

証跡（`yuzu-shrimp-pizza`）: エビ / 柚子胡椒 / モッツァレラ / 大葉、ソース欄「その他」、薄めの生地、個別ページ出典（中継 2026-09-22、独立再取得なし）。**個数・焼成窓・工程タイミングは repo に無い。** 大葉は ikura で「焼成後」と中継されている。

### 4.1 分岐表

| | **B0: すべて焼成前**（現計画） | **B1: 大葉だけ焼成後**（柚子胡椒は焼成前） | **B2: 柚子胡椒も焼成後**（かける・垂らす） |
|---|---|---|---|
| 置き場所 | 通常カタログ（`recipes.ts` ほか） | **後乗せカタログ**（`lateCatalog.ts`、本番 OFF） | **実装不可**（FINISH は topping 専用。ソースの後乗せは #579 / #518 → FINISH D2-2 が前提の未着手の別 Issue） |
| `applicationPhase` | なし | `shiso` が `POST_BAKE` | ソースに `POST_BAKE` を付ける機構が無い |
| ladder | 通常 step（番号は §5）。柚子胡椒が key。credited | 通常 step を**使わない**。late step（番号は「通常 ladder 長 + 1」で導出）。柚子胡椒は late ingredient。`shiso`(54) は既存 | — |
| 新ソースの扱い | 通常 `ingredients.ts` に sauce 追加 | `LATE_INGREDIENTS` に sauce を追加。**late カタログに sauce が入る前例はまだ無い**（`RECIPE_SAUCE_PROFILES` は型キーで late 行を持てるが、sauce 実体を late に置く経路は未検証 → 実装前に確認が要る） | — |
| 本番での見え方 | merge で**有効化** | **E5（FINISH + late catalog の本番化）まで本番に出ない**。E5 の前提: AC-8、Q-5、iPhone 実機 HV、専用検証環境（#638 §5）。Pinsa・ikura と同時 | — |
| 追加の検証 | 通常の Batch 検証（#634 と同型） | 上に加え: ON ビルドの E2E、`validateLateCatalog`（`POST_BAKE` 必須、`lunchRush:false`、target id 一意）、riddle（`late-addition`）の前倒しの確認（#638 §3 T1–T6）、late step 番号のずれ | — |
| 実装差分（目安） | `recipes` `ingredients` `recipeSauceProfiles`（union に 1 つ追加 + PAINT 行）`discoveryCatalog` `discoveryLadder` `referencePizza` `recipeHintRoles` `orders` + テスト + golden 追記 | `lateCatalog.ts` の 5 表（RECIPES / ORDERS / INGREDIENTS / TAXONOMY は不要 / TARGET_IDS / LADDER_STEPS）+ sauce profile・Reference・Hint role 行。通常 ladder・通常 golden は**不変** | 別 Epic |
| 作業量 | M | M〜L（late 経路の初の sauce） | — |

### 4.2 実装前に必要な判断（最小化）

柚子えびの実装に入る前に必要なのは、**原典の確認結果ただ 1 つ**（→ 分岐が決まる）。確認結果ごとの Owner 判断は次のとおり。

| 確認結果 | 次の判断 |
|---|---|
| 大葉・柚子胡椒とも焼成前（または記載なし） | B0。色・価格・星ゲート無しの再確認のみ。**ladder 順は §5** |
| 大葉だけ焼成後 | B1。通常 ladder には入らず、E5 まで本番に出ないことを Owner が了承するか（Pinsa・ikura と同じ待ち） |
| 柚子胡椒も焼成後（仕上げにのせる・かける） | B2。当面追加しない（ソース後乗せの Epic が前提）。柚子胡椒を**焼成前の下地**として扱い替える設計判断（原典と異なる）をするかは別途 Owner 判断 |

### 4.3 残る原典確認事項（Owner が実ページ、または pizzadb.jp を許可した環境で確認）

pizzadb.jp は本セッション環境から到達不可（`CONNECT tunnel failed, response 403`）。**以下はすべて未確認:**

| 対象 | 確認事項 |
|---|---|
| 柚子えび | ① 材料の最終一致（エビ / 柚子胡椒 / モッツァレラ / 大葉）② 大葉・柚子胡椒・エビの**投入タイミング**（焼成前 / 後）③ 柚子胡椒の色（緑 / 赤。赤はトマト `#c73b2e` と同色になり不可）④ 個数 ⑤ 焼成条件 |
| 月見 | ① 材料の最終一致（卵 / ベーコン / モッツァレラ / 青ねぎ）② **青ねぎ・卵のタイミング**（仕上げの飾りか、焼成前か）③ ねぎの種類（青ねぎ / 小ねぎ / 長ねぎ）④ 個数 ⑤ 焼成条件 |
| 共通 | #527 D4（独立再取得）。取得経路: Owner の貼り付け、または環境の Network access に `pizzadb.jp` を追加（設定はユーザー側。`read_documentation environment.network`） |

## 5. ladder 順の矛盾（OD-B9-5 の再判断依頼）

`POST_W1_APPENDED_STEPS` は追記専用の明示リストで、`discoveryLadder.appendOnly.test.ts` が RECIPES 由来の導出と一致を固定している。**step 番号は merge 順に決まり、実装順を無視して予約できない。** したがって「柚子 56 → 月見 57」を保つには**柚子が先に merge される必要がある**が、柚子は原典確認待ちで保留（OD-B9-1）。

| 案 | 内容 | 評価 |
|---|---|---|
| **X（推奨）** | **月見 56**、柚子は確定後に次の通常 step（B0）または後乗せ枠（B1）。柚子が後乗せになれば通常 step 57 は次の通常 batch が使える | 保留中の柚子に月見を縛らない。どの分岐でも再採番が不要 |
| Y | 柚子 56 / 月見 57 のまま、柚子の原典確認を待つ | 月見が柚子待ちになる（後乗せ分岐なら 56 を空けたまま待つことになり、番号が無駄になる） |
| Z | 月見 56 で先行し、柚子が B0 になったときに「柚子 57」とする | X と同じ（X の具体化） |

## 6. 実装 PR の着手条件と構成（未作成）

| PR | 条件 | 内容 |
|---|---|---|
| 月見 PR（先行可） | J1・J2 の回答、#578 claim の整理 | `green-onion` + `tsukimi-pizza`（§3）。HV 必須（動画 + スクショ） |
| 柚子 PR | 原典確認の結果（§4.3）+ §5 | B0 なら #634 と同型の 1 PR。B1 なら late catalog への 1 PR（E5 待ち） |

merge・共有 Preview の更新・本番は Owner の別途承認まで行わない。

## 7. 範囲外

ゲームコード、テスト、e2e、workflow、CI の再実行、他セッションのブランチ、`PROJECT_HANDOFF.md`（HOT）、claim の投稿、pizzadb.jp の再取得。
