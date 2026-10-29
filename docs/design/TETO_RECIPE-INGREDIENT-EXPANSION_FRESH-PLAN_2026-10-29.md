# TETO レシピ・食材拡張 — Fresh Expansion Plan（docs-only、READ-ONLY 調査）

Status: **調査と計画のみ。Owner 承認前に実装・Issue・PR は作らない。** `src/**`・`e2e/**`・CSS・設定・保存データ・Dex・在庫・採点・本番フラグ・Preview / Production は変更していない。Monitor は作っていない。
この文書の「推奨」は助言であり、Owner Decision ではない。未決は §13 に列挙し、推測で確定していない。
HV: docs-only のため不要（`TETO_HUMAN-VERIFICATION-POLICY.md`、audit-only は Preview・動画の対象外）。

**更新履歴:** 初版 `4b92884`（2026-10-29 READ-ONLY 監査）→ **Owner Decision Update（同日）**: Owner 確定 4 件（O-1・O-6・O-5・O-7）を §0.1〜§0.5 に記録し、§3.2・§5・§6〜§8・§12〜§14 を更新した。更新時の Fresh State: `origin/main` = `ffff081c0136df43113a81c170343d24d968ed1f`（初版と同一）、PR #697 HEAD `8ba2b5b901a79255fd396c755c69b1df2ac59f85`（同一・`clean`・未 merge）、対象ブランチ HEAD `4b92884`・作業ツリー clean、Duplicate Gate（open の PR / Issue に同題の拡張計画なし。最近更新された open PR は #697 のみ）。母数（172 = 71 + 4 + 97）と証跡分類は不変。

## 0. 基準と範囲

| 項目 | 値 |
|---|---|
| 基準 `main` | **`ffff081c0136df43113a81c170343d24d968ed1f`**（#695 Cooking Prep Phase 1 PR-B、2026-10-29 17:19:49 +0900）。調査開始時と終了時の 2 回 `git fetch` で同一 |
| 調査日時 | 2026-10-29 20:56 JST |
| 作業ブランチ | `claude/teto-pizza-expansion-plan-509mh8`（main と同一から開始。docs 1 ファイルのみ追加） |
| 数え方の正 | **コード（`RECIPES` / `INGREDIENTS` を実行して取得）**と GitHub の現況。過去のハンドオフ・過去の監査値は使っていない |
| 再利用した資料 | 172 matrix（`docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`）、`TETO_COOKING-EXPANSION_FRESH-AUDIT-AND-PLAN.md`、`TETO_STATE-SYNC_2026-10-26.md`、B10 / B11 の Owner 決定・Result、`TETO_COOKING-PREP_PHASE1_SPEC_2026-10-28.md` |
| 重複回避 | matrix の行データは複製せず、§4・付録 A に**現行コードとの差分（分類）だけ**を置く |

> **重要な前提（原典の限界）.** matrix の各行は pizzadb.jp の比較表に由来し、原典の個別ページは多くが未確認（PR #612: 45 件は原典未確認）。B10 / B11 のレシピは Owner 承認の「GAMEPLAY ASSUMPTION（暫定仕様）」として出荷されている。本書の候補も同じ扱いで、原典の事実とは断定しない。

## 0.1 Owner Decision Log（2026-10-29 確定・本更新で反映）

初版（コミット `4b92884`）の未決事項のうち 4 件を Owner が確定した。以下は**再承認を求めず反映した記録**で、各決定の範囲を超えて解釈していない。「承認されていないこと」を併記する。

| ID | 決定（Owner 確定） | 承認されていないこと | 反映先 |
|---|---|---|---|
| **O-1** | 根拠不足の候補に **GAMEPLAY ASSUMPTION を条件付きで許可**。証跡 BLOCKED を一律に解除する承認ではない | 個別レシピの**実装承認**（keema / bulgogi を含む）。BLOCKED の元分類の変更。この 2 件以外の BLOCKED への拡張 | §0.2、§8 |
| **O-6** | ブラータは**専用ピース＋色変化**で初回実装。Cheese Pool の汎用化は初回に含めない | 「全ブラータレシピを焼成前配置にする」こと（配置時点はレシピ仕様と整合させる）。描画品質の合格（調査結果待ち） | §0.3、§5.2、§8 |
| **O-5**（honey） | **焼成後の後乗せを優先**（第一候補）。液体の描画・操作が要るなら #579 との依存を記載 | **#579 の実装開始**。既存ソース塗り操作の無条件な流用 | §0.4、§8 |
| **O-7**（pizza-salad） | **生野菜は焼成後に配置** | pizza-salad の READY 扱い（実装可能の確定）。後乗せの操作・採点・保存互換の未解決事項の解消 | §0.4、§8 |

> 決定は「方針」であり、**証跡のない候補を出荷済み・実装可能に変えるものではない**。母数（172 = 71 + 4 + 97）と、READY / REVIEW / BLOCKED の元の証跡分類（付録 A）は変更していない。

## 0.2 O-1 の運用規則（条件付き GAMEPLAY ASSUMPTION）

### 0.2.1 適用条件（全て満たした候補だけが「条件付き計画対象」になれる）

1. 原典・matrix で**確認された事実**と、**ゲーム向けの仮定**を表で分けて書く。
2. 仮定した材料・ソース・チーズ・工程を**候補ごと**に記録する。
3. 仮定の**根拠**と**ゲーム上の必要性**を書く。
4. 原典（matrix）との**相違を隠さない**（実装時の暫定表示・文書コメントにも同じ文言を残す。B10 / B11 の運用）。
5. 既存レシピとの**重複・名称衝突・近接**を確認する（下表）。
6. 保存データ・既存レシピの意味・Dex・採点を変えない（追記のみ）。
7. **実装前に、候補ごとの具体構成（個数・配置・窓・報酬）を Owner が確認**する。確認前は実装しない。

### 0.2.2 管理方式

元の証跡分類（READY / REVIEW / BLOCKED、付録 A）は**そのまま保持**し、別の列「条件付き計画対象」で管理する。現時点で「条件付き計画対象」は次の **2 件のみ**（Owner が名指しした範囲）。他の BLOCKED 69 件は対象外のまま。

| id | 元の証跡分類 | 条件付き計画対象 | 実装承認 |
|---|---|---|---|
| keema-pizza | BLOCKED（`BASE_SAUCE_UNSPECIFIED` ＋ `UNRESOLVED_INGREDIENT`×2） | **はい** | **未** |
| bulgogi-pizza | BLOCKED（`BASE_SAUCE_UNSPECIFIED`） | **はい** | **未** |

### 0.2.3 仮定の記録

**keema-pizza**（evidence `keema-pizza-pizzadb-p2`）

| 項目 | 内容 |
|---|---|
| 確認された事実（matrix） | 材料: mozzarella、onion、および曖昧語「ひき肉」「青唐辛子」。**ソースは記載なし**（`BASE_SAUCE_UNSPECIFIED`）。コードの現行カタログに ground-beef は無い |
| 仮定（ゲーム向け） | ① ソース = **curry-ketchup**（既存の B10 ソース）／② 「ひき肉」= **ground-beef**（新規トッピング）／③ 「青唐辛子」は**未決**（省略するか chili を足すか）／④ 個数・配置・窓 58–78・報酬 100 は CALIBRATION |
| 根拠・必要性 | 既存ソース再利用でソース棚を増やさない／粒状の新しい見た目（ground-beef）を Stage 1 の唯一の新食材に絞れる |
| 原典との相違 | matrix の材料集合に curry-ketchup・ground-beef は無い（仮定で追加）。「青唐辛子」を省く場合は材料も欠ける。**原典は未確認** |
| 重複・近接の確認（実行して取得） | 完全一致 / 部分集合 / 上位集合の既存レシピは**なし**。ただし材料が **2 要素差**の既存が 2 件: `curry-pizza-japan`（chicken↔ground-beef）、`rendang-pizza`（beef↔ground-beef）。「少し変えただけ」に見えるリスクが高い → 新しさを 3→2 に下げた（§6.2） |
| Owner 確認が要る構成 | 材料の最終集合（chili の有無）、個数・配置、説明文、名称 |

**bulgogi-pizza**（evidence `bulgogi-pizza-pizzadb-p11`）

| 項目 | 内容 |
|---|---|
| 確認された事実（matrix） | 材料: beef、mozzarella、onion、white-sesame。**ソースは記載なし** |
| 仮定（ゲーム向け） | ① ソース = **soy-sauce**（既存の late ソース、wasabi-beef-pizza で使用）／② 個数・配置・窓・報酬は CALIBRATION |
| 根拠・必要性 | 新ソースを足さず、beef・white-sesame の既存食材だけで成立する。**ただし soy-sauce は late catalog のソース**で、通常 ladder に載せる扱い（解禁順序）に未決事項がある |
| 原典との相違 | matrix にソースの記載が無いため、soy-sauce は完全にゲーム側の仮定。**原典未確認** |
| 重複・近接の確認 | 完全一致 / 部分集合 / 上位集合なし。**2 要素差**の既存: `wasabi-beef-pizza`（wasabi↔white-sesame）。実質「wasabi-beef からわさびを抜いてごまを足した」構成 |
| Owner 確認が要る構成 | soy-sauce を通常レシピで使う際の解禁（late floors との整合）、個数・配置、名称 |

### 0.2.4 追加の近接チェック（今回の更新で判明）

- **hot-honey-pepperoni**: 既存 `pepperoni`（tomato-sauce・mozzarella・pepperoni）が**部分集合**（honey を足しただけ）。識別は後乗せ（`late` 軸）で分ける設計になるため、matcher / DH4 での扱いの検証が要る。
- **sfincione**: 既存 `fugazza`（olive-oil・onion・oregano）が**部分集合**（tomato-sauce・anchovy を足した構成）。初版の「依存ゼロ」を「**依存は matcher / DH4 の上位集合検証のみ**」に訂正する。
- burrata-pizza / pizza-alla-crudaiola / pizza-salad は完全一致・部分集合・上位集合なし。

## 0.3 O-6: ブラータの描画方式（確定）

**初回実装の設計方針（Owner 決定）:**

- ブラータ専用の描画ピース（`pieceVisual`）を使う。既存の feta（`feta-cubes`）・ricotta（`ricotta-mound`）方式を参考にする。
- 加熱・調理状態による色や質感の違いを表現する。
- 他のチーズ（mozzarella Canvas・ricotta・cream-cheese・catupiry・feta 等の白系）と識別できる**輪郭**を持たせる。
- 完成ピザ上の**小さな表示サイズでも識別**できること。
- **Cheese Pool（`cheesePool.ts`、mozzarella 専用の描画関数）の汎用化は初回に含めず、別 Gate に分離**する（下記 G-CP）。

**配置時点の整合（Owner 注記）:** 専用ピース方式の採用は「全レシピで焼成前配置」と同義ではない。記録上、burrata の 3 行（burrata-pizza・crudaiola・pesto-burrata）の matrix には**後乗せの記載がなく**（`postBakeFinish` 空、スプレッド層は tomato-sauce ＋ olive-oil のみ）、焼成前配置と矛盾しない。ただしこれは記録上の整合で、**各レシピの配置時点は実装前にレシピ仕様として Owner が確認**する（G-B1）。

**描画品質の実装前条件:** 別セッションの食材描画品質 Fresh Audit の結果を、実装前の確認条件とする（§0.5 の R-1）。

## 0.4 O-5 / O-7: 後乗せ（honey・生野菜）の方針と調査結果

### 0.4.1 既存の FINISH / POST_BAKE 構造（コードで確認）

| 事実 | 根拠 |
|---|---|
| FINISH は焼成後（`POST_BAKE` フェーズ）のステップ。本番で有効（`LATE_CATALOG_PRODUCTION`・`FREE_COOK_FINISH_PRODUCTION` とも true） | `gameReducer.ts`、`lateCatalog.ts`、`freeCookFinishGate.ts` |
| **FINISH で置けるのは `category: "topping"` のみ**。sauce / cheese は拒否される | `gameReducer.ts` の FINISH 分岐（`placingIngredient.category !== "topping"`） |
| 後乗せ要件はレシピ側の `applicationPhase: "POST_BAKE"`。出荷済み late レシピ 8 件の後乗せ材料は salmon-roe・shiso・cilantro・wasabi・nori など**全て topping** | `lateCatalog.ts` |
| late レシピは `lunchRush:false`、Dinner は fail-closed で除外、解禁は `LATE_LADDER_STEPS` / `LATE_ENTITLEMENT_FLOORS` の固定表 | `lateCatalog.ts`、B11 Result |
| 後乗せ piece は Reference 側で `stage:"post"` として扱う（CS-1b `finalizeRound`） | #611 本文 §1 |

### 0.4.2 honey（焼成後の後乗せを第一候補）

- honey は **sauce カテゴリ**のため、**現行の FINISH では置けない**。焼成後に加えるには「FINISH の液体（ソース）対応」＝ **#579**（POST_BAKE のソース後乗せ: FINISH の液体対応と仕上げソース〈DRIZZLE 候補〉）が前提になる。
- 既存のソース塗り操作（PAINT）を無条件に流用しない。液体を垂らす描画・操作が必要なら #579 の設計に含める。
- **#579 は open で未設計**。本更新は「honey の方式設計の承認」であり、#579 の実装開始承認ではない。
- 対象候補: **hot-honey-pepperoni**（honey 1 要素。pepperoni の上位集合 → §0.2.4）。honey を使う他の候補（pesto-noci ほか）も同じ方式に従う。
- 初版で「焼成前 PAINT なら Stage 2 に前倒し可」とした選択肢は、本決定により**第一候補ではなくなった**（撤回ではなく、Owner が優先順位を確定）。

### 0.4.3 生野菜（lettuce など）の焼成後配置

- lettuce・cucumber（いずれも野菜 = topping）は、**現行の FINISH のカテゴリ制限には抵触しない**（topping）。#579 は不要。cucumber は Owner の明示が「lettuce など」のため、**生野菜として同じ扱いにする仮定**（確認事項）。
- ただし以下は**未解決で、依存 Gate として残す**（pizza-salad を無条件に READY 扱いしない）:

| Gate | 内容 | 状態 |
|---|---|---|
| G-F1 | 焼成前の具材と後乗せ食材の**工程上の区別**（UI ラベル・トレイ・ヒント。DH4 / Hint 5.0 を漏らさない） | 設計未確認。late catalog の既存方式に従う想定だが、生野菜での実績なし |
| G-F2 | 後乗せ piece の**配置順・個数上限**（リング上限が FINISH piece を数えるか。#611 の D-6 は「要実測」と記載、結果は未確認） | 未確認 |
| G-F3 | **採点**: Reference の `stage:"post"`、焼成失敗時の FINISH スキップ（OD-CS-7）、星・Pitz への影響 | 既存エンジンの仕様はあるが、生野菜レシピでの検証なし |
| G-F4 | **保存互換**: FINISH 中の中断・復帰（`pendingRound`、#617 / #664）、late 解禁表（`LATE_ENTITLEMENT_FLOORS`）への追記と、通常 step 追加による導出番号のずれ | 未確認。B11 の late +2 の前例あり |
| G-F5 | **焼成フィルタの分離**（#518: 後乗せ piece が焼成 `filter` を受けない）— 生野菜の“生の見え方”に直結 | #518 は open のまま。出荷済み late レシピの実績はあるが、生野菜の見え方は未検証 |
| G-F6 | **iPhone 390×844 / 360×800 の操作領域**: FINISH のトレイ・タップ領域・横スクロールなし・生地上の piece との重なり | HV 項目（実機は Owner 判定） |
| G-F7 | yogurt-sauce（sauce）の工程: Owner 決定は「野菜」のみ。matrix では tomato-sauce に次ぐ 2 層目のスプレッド = 焼成前の PAINT と整合 | **未決**（O-7b、§13） |

## 0.5 描画品質調査との関係（未完了 Gate・結果は推測しない）

別セッションで食材描画品質の Fresh Audit が進行中。**その結果を本書は参照していない**（未完了のため）。以下を未完了 Gate として記録し、合否を推測しない。

| Gate | 対象 | 状態 |
|---|---|---|
| **R-1** | burrata の**完成ピザ上での識別性**（他の白チーズとの輪郭・小サイズ・焼成前後の色変化） | 未完了（調査待ち） |
| **R-2** | ground-beef の**形状・質感**（beef・sausage との区別、配置後 20px 級） | 未完了 |
| **R-3** | lettuce（ほか生野菜）の**後乗せ描画**（生地・チーズ上でのコントラスト、焼成フィルタ） | 未完了 |
| **R-4** | honey の**液体表現**（垂らし・艶・curry-ketchup / mustard との色差） | 未完了 |
| **R-5** | **チーズ・ソースとのコントラスト**（白系同士、茶系ソース同士） | 未完了 |
| G-CP | Cheese Pool の汎用化（別 Gate。初回に含めない） | 未着手・未承認 |
| G-B1 | burrata 各レシピの配置時点を Owner が確認 | 未 |

初版 §4.1 / §5 の ΔE は私の仮色による参考値であり、R-4 / R-5 の代わりにはならない。

## 1. Fresh State（確認した事実）

### 1.1 運用ルール

- `CLAUDE.md`: UI/UX/ゲームプレイ変更は HV 方針（390×844 の動画を Owner へ直接、前後スクショを `docs/reports/screenshots/<task>/` へ）が DoD。今回は docs-only で対象外。
- `TETO_SESSION-OPERATIONS_1.0.md`: claim は Issue / PR コメントの任意予約（ブロックしない）。HOT ファイル（`recipes.ts`・`gameReducer.ts`・`PROJECT_HANDOFF.md` ほか）の重複は先に merge する側が優先。新規 Issue / PR / merge / Preview / Production は Owner 承認が必要。
- `docs/PROJECT_HANDOFF.md` は冒頭が 2026-09-18 のまま（約 1142 行）。起動チェックリストの「GitHub の現況を正とする」に従い、**本書は現況を正とした**。

### 1.2 GitHub

| 種別 | 結果 |
|---|---|
| open PR | 30 件。#697（Cooking Prep Phase 1B）以外の 29 件は docs / 古い機能 PR で、**2026-10-29 に更新されたのは #697 のみ**（次に新しいのは 10-24 の #651） |
| #697 | HEAD `8ba2b5b901a79255fd396c755c69b1df2ac59f85`（既知値と**一致**）、base `ffff081`、`mergeable_state: clean`、非 draft、50 ファイル（`src/logic/prep/**`、`CookingPrep*`、`PizzaStage.tsx`、`GameScreen.tsx`、`App.tsx`、`gameReducer.ts`、`e2e/cooking-prep.spec.ts`、`docs/reports/TETO_COOKING-PREP_PHASE1B_*`、仕様書の改訂、スクショ）。**`src/data/**` は 1 ファイルも触らない** |
| open Issue | 100 件。関連: #696（Prep 1B 管理）、#611（TQ-2 / BBQ / Cooking Prep の umbrella）、#578（新ソース。出荷済みが大半）、#527（Batch 8 計画。frango / spanish-chorizo は出荷済みで見出しが古い）、#561（星ゲート。下記）、#604 / #579 / #608（後乗せ・仕上げソース）、#577（Dough Kind）、#521 / #532–#538 / #540（Multi-Sauce・Square Dough、グランマ出荷後の残り）、#675（トレイ UX）、#417 / #438 / #623（アイコン 2.0）、#668 / #664 / #617 / #560（保存保護）、#422（図鑑の匿名ロック枠） |
| Duplicate Gate | open の PR / Issue に「Expansion 計画」の重複なし（`expansion batch` 検索 0 件）。`TETO_COOKING-EXPANSION_FRESH-AUDIT-AND-PLAN.md` は**調理法**の計画（#573 時点、スコープが別）。本書は**レシピ・食材**の選定で重ならない |

### 1.3 現在の実装状態（コードから）

| 項目 | 値 | 根拠 |
|---|---|---|
| レシピ | **80**（Pinsa OFF 時 79）。うち late catalog 8（ikura / yuzu-shrimp / eggplant-dengaku / eggplant-tahini / bbq-chicken / wasabi-beef / tarako-cream / pinsa） | `RECIPES` 実行、`catalogLedger.test.ts` |
| ladder に数えるレシピ（credited） | 73 | `catalogLedger.test.ts` |
| 食材 | **92** = ソース 13 / チーズ 13 / トッピング 66 | `INGREDIENTS` 実行 |
| 棚（family） | sauce 13 / cheese 13 / meat 12 / seafood 11 / vegetable 24 / fruit 3 / herb 9 / spice 4 / other 3 | `catalogLedger.test.ts` |
| ladder | 70 step、章 [6, 12, 18, 44]（第 4 章が 63%） | 同上 |
| Lunch Rush プール | 25（全 80 のうち。B10 / B11 の新規は全て `lunchRush:false`） | 同上 |
| 星ゲート余裕 | `ACCEPTED_MIN_SLACK = 1`（credited 73 − ladder 70 − 星ゲート直接 2 = 1）。**ゲートや step を足すと検出テストが落ちる** | `ladderReachability.starGate.test.ts` |
| 技法（Technique） | `no-sauce` / `tray` / `dough-pinsa-romana` / `late-addition` の 4 | `techniques.ts` |
| 本番スイッチ | `LATE_CATALOG_PRODUCTION` `FREE_COOK_FINISH_PRODUCTION` `PINSA_PRODUCTION` = true、**`PREP_EXPERIENCE_PRODUCTION` = false**、`HAND_ENFORCEMENT_PRODUCTION` = false | 各 `*Gate.ts` |
| Cooking Prep | PR-A（#694）・PR-B（#695）は main。**牛肉の「炒める」のみ・本番 OFF**（`?cookPrep=on` の Preview / DEV のみ）。`PREP_TARGET_INGREDIENT_IDS = ["beef"]`。1B（タイミングゲーム）は #697 で未 merge。`preparedLook` は transient で、保存・採点・在庫・Dex・識別に出ない | `prepIngredients.ts`、#697 本文 |
| チーズ描画 | モッツァレラのみ Canvas（`CHEESE_CANVAS_DEFAULT_ON = true`、#486）。他のチーズは `scatter` の CSS / emoji、専用 `pieceVisual` は feta・ricotta のみ | `cheeseRenderMode.ts`、`ingredients.ts` |
| ソース描画 | 全て同一の field-based PAINT。色駆動（olive-oil だけ特例）。**新しい塗り操作は無い** | `recipeSauceProfiles.ts`、前回監査 §1.1 |
| 専用ピース描画（`pieceVisual`） | トッピング 66 中 **23**（beef・porcini・mussel・salmon-roe・cilantro など直近に集中）。残り 43 は emoji / 汎用 | `INGREDIENTS` 実行 |

### 1.4 利用の偏り（バランス判断の入力）

| 指標 | 値 |
|---|---|
| mozzarella を使うレシピ | **58 / 80（72.5%）** |
| tomato-sauce | 29、onion 17、olive-oil 11、garlic 10、oregano 10、black-olive 10、pesto 9、**eggplant 9** |
| **ちょうど 1 レシピでしか使われない食材** | **50 / 92**（未使用は 0） |

## 2. 数え方の定義（過去の監査値との関係）

過去値（候補 172、実装 55/61・未実装 122、優先 19、新食材約 21 ＋ソース約 6）は**定義が確認できず、今の値と比較できない**ため再計算した。母数と意味を固定する。

| 集計 | 値 | 意味 |
|---|---|---|
| matrix の行（母数） | **172** | pizzadb.jp 由来の証跡行。ゲームのレシピ数とは別物 |
| ① 出荷済みと 1:1 対応する行 | **71** | evidence id / candidate id が現行レシピ id に一致（別名 3 件: bbq-chicken、bianca→pizza-bianca-ricotta、mentaiko-cream→tarako-cream-pizza）。うち 5 行は matrix の材料と出荷の材料が異なる（capricciosa・quattro-formaggi・margherita・fugazza・breakfast、`COMPOSITION_CONFLICT_SHIPPED`） |
| ② 名前が出荷済みと衝突する行 | **4** | bismarck-p7・pesto-genovese・marinara-p13・meat-lovers-p13。新規候補ではなく、出荷版との差の判断対象 |
| ③ **真の未出荷候補** | **97** | 本書の分類対象 |
| 現行レシピ 80 の内訳 | 71（行と対応）＋ **9（行と 1:1 に対応しない原型・独自）** | marinara・genovese・bismarck・funghi・napoletana・pizza-bianca・meat-lovers・pepperoni・salsiccia。同一材料集合の別名行（cauliflower-crust など 5 行）は出荷扱いにせず、DOUGH_VARIANT 候補として③に残した |

検算: 71 + 4 + 97 = **172** ✓ ／ ③の分類（§3）14 + 10 + 25 + 30 + 18 = **97** ✓ ／ 証跡状態 READY 14 + REVIEW 12 + BLOCKED 71 = **97** ✓。

## 3. レシピ候補の分類（97 件）

**分類は技術依存の主分類（互いに排他）。証跡状態は別軸**（matrix の `productDecisionStatus`: READY / REVIEW=READY_WITH_REVIEW / BLOCKED=BLOCKED_PRODUCT_DECISION）。優先順位は ⑥ → ④ → ③ → ② → ① の順に最初に当たったものを採用。

| 主分類 | 規則 | 件数 | READY | REVIEW | BLOCKED |
|---|---|---|---|---|---|
| ① 既存食材だけ | 不足食材なし、構造 / 工程 capability なし | **14** | 1 | 1 | 12 |
| ② 新食材（トッピング）が必要 | ソース・チーズ以外の不足食材あり | **10** | 0 | 0 | 10 |
| ③ 新ソース / チーズが必要 | 不足がソース系 / チーズ系を含む | **25** | 5 | 2 | 18 |
| ④ 新しい調理工程が必要 | `PREP_STEP` / `LATE_ADDITION` / `DOUGH_VARIANT`（Pinsa は出荷済みの 1 種のみ） | **30** | 3 | 5 | 22 |
| ⑥ 既存仕様では再現困難 | `ENCLOSE` / `LAMINATE` / `FRY_COOK` / `ZONED_PLACEMENT` / `STEP_ORDER` / `DOUGH_SHAPE_TARGET` / `PAN_BAKE` | **18** | 5 | 4 | 9 |
| 合計 | | **97** | 14 | 12 | 71 |

- **⑤ 描画品質が先に必要**は独立の列にせず、③ のうち**白〜クリーム系で既存と見分けにくい新ソース / チーズ**（mayo・yogurt-sauce・blue-cheese-dressing・sour-cream・burrata・brie・cheese-curd・ricotta-salata・cotija・condensed-milk 等を含む行）に**フラグ ⑤** を付けた。**13 件**。ヒューリスティックであり、実際の判定は実装時の HV（§5.1 の ΔE 参照）。
- `MULTI_SPREAD_LAYER` は**エンジンが出荷済み**（B1/B2/S1/S2、grandma-pizza・pescatore の前例）なので工程扱いにしていない（データ追加のみ）。`LATE_ADDITION` は**トッピング種別の後乗せは出荷済み**（late catalog）。**ソース・チーズの後乗せは未対応**（`PLACE_TOPPING` の FINISH は topping 限定、#579 / #604）。
- 一覧は付録 A。

### 3.1 BLOCKED の内訳（71 件、複数該当あり）

| blocker | 行数 | 意味 | 解消できる主体 |
|---|---|---|---|
| `BASE_SAUCE_UNSPECIFIED` | 31 | 証跡にソースの記載なし | **Owner 判断**（B10 の curry-ketchup のように GAMEPLAY ASSUMPTION を承認） |
| `UNRESOLVED_INGREDIENT` | 19 | 「ひき肉」(5)・「唐辛子」(5+2)・「チーズ」(3+1)・「ホワイトソース」等の曖昧語 | Owner 判断 / 原典確認 |
| `COMPOSITION_CONFLICT_CANDIDATE` | 16 | 他候補・出荷版と材料集合が衝突 | Owner 判断 |
| `MECHANIC_INTERPRETATION` | 11 | 生・サラダ系などタイミング解釈が割れる | Owner 判断 / 原典確認 |
| `EVIDENCE_GAP` / `SCOPE_QUESTION` / `DISCOVERY_COLLISION` | 2 / 2 / 1 | 証跡不足・範囲・識別衝突 | 個別 |

**最重要の発見:** 「既存食材だけ（①）かつ READY」は **月見ピザ 1 件のみ**で、これは DH4 により**実装保留中**（OD-B9-8 / OD-B9-12、§12）。つまり**証跡上クリーンに出せる Stage 1 の候補はほぼ枯渇**している。Stage 1 を続けるには、B10 / B11 と同じ「Owner 承認の GAMEPLAY ASSUMPTION」が前提になる（O-1）。

### 3.2 「新しい要素が 1 つだけ」で出せる候補（BLOCKED なし・工程なし）

不足が**ちょうど 1 品目**かつ READY / REVIEW かつ工程 capability なし: **ブラータ（3 レシピ）とはちみつ（1 レシピ）だけ**。

| 新要素 | レシピ | 備考 |
|---|---|---|
| burrata（チーズ） | burrata-pizza・pizza-alla-crudaiola・pesto-burrata | いずれも READY。`MULTI_SPREAD_LAYER`（出荷済みエンジン） |
| honey | hot-honey-pepperoni（REVIEW） | **【Owner 決定 O-5 により焼成後の後乗せが第一候補。§0.4.2】** 以下は初版の記録: matrix は honey を tomato-sauce に次ぐ**2 層目のスプレッド**として記録し、「焼成後の垂らし」(`LATE_ADDITION`) は **repo 内の推論（`repo_inference`、原典未確認）**。焼成前の PAINT で出すなら既存エンジンで足りる。垂らす表現を望むなら #579 を待つ（O-5） |

## 4. 食材・ソース・チーズの候補（不足 78 品目 ＋ 曖昧語）

97 候補が必要とする**現行に無い食材は 78 品目**（ソース系 20 / チーズ系 10 / トッピング系 48）。加えて曖昧語（牛ひき肉・唐辛子・汎用チーズ）が 19 行にある。単独で複数行に効くのは次のとおり。

| 食材 | 使われる候補行 | 証跡状態 |
|---|---|---|
| mayo | 6 | 全て BLOCKED（ソース不明の行） |
| honey | 5 | READY 1 / REVIEW 1 / BLOCKED 3 |
| 牛ひき肉（ひき肉） | 6（taco + 曖昧語 5） | 曖昧語は BLOCKED |
| 唐辛子（赤 / 青） | 7（曖昧語） | BLOCKED |
| walnut | 4 | 混在 |
| lettuce・burrata | 各 3 | burrata は全 READY |
| cucumber・french-fries・cinnamon・carrot・blue-cheese-dressing | 各 2 | 混在 |
| 残り（約 60 品目） | 各 1 | — |

### 4.1 食材の評価（§4 の評価観点）

| 食材 | 使えるレシピ数 | 見分けやすさ（トレイ / 完成時） | 調理前後の変化 | 新しい操作 | 描画負荷 | 既存への影響 |
|---|---|---|---|---|---|---|
| **burrata**（チーズ） | 3 | 白い丸い塊。mozzarella（Canvas）・ricotta（`ricotta-mound`）・cream-cheese と**白で近い**ため形（丸い球＋裂け目）で分ける必要 | 焼くと中心がとろけて広がる（Canvas プールの別パラメータ案） | なし（scatter 配置） | 中（専用 SVG ＋ 描画パラメータ。モッツァレラ Canvas は mozzarella 専用で、他チーズへの拡張は未着手） | cheese 棚 13→14。既存レシピに無影響 |
| **牛ひき肉** | 6（曖昧語含む） | 小さな粒の集まり。beef（薄切りリボン）・sausage と区別できる形が必要 | 生→炒め色（Prep の対象にしやすい） | なし（Prep と組むと「炒める」を再利用） | 中（粒状ピース SVG） | meat 棚 12→13 |
| **lettuce / cucumber** | 3 / 2 | 緑の葉 / 薄切り輪。herb（shiso・arugula・mint）と**緑で近い** | 生のまま（焼かない）— 焼成前に置くとしおれる表現が要る | 後乗せ（FINISH）が前提になる可能性 | 中 | vegetable 棚 24→26 |
| **honey** | 5 | 琥珀色の液体。curry-ketchup（ΔE 11.9）・mustard（16.0）と近い | 焼成後の艶 | **焼成後の垂らし（Owner 決定）= #579 が前提**。FINISH は topping 限定のため現行では置けない | 小（色）／大（垂らし操作） | sauce 棚 13→14 |
| **walnut** | 4 | 茶色の割れた粒。almond・pine-nuts と同じ `other` 棚（3 品）に入り、**DH4 の「その他は到達不能」(OD-DH4-2-9) に影響**しうる | 焼くと濃くなる | なし | 小 | `other` 家族の扱い（O-9） |
| **mayo / yogurt-sauce / blue-cheese-dressing** | 6 / 1 / 2 | **白で fromage-blanc-sauce（ΔE 7.1 / 4.2 / 5.1）と区別不能**。色だけでは別ソースに見えない | 焼成後に垂らす（mayo）か、塗り（yogurt） | mayo は DRIZZLE が必要 | 大（質感の差を作る必要） | 既存ソースの識別が悪化 |
| **yakiniku-sauce / sweet-bean-sauce / okonomiyaki-sauce / gravy** | 各 1 | 茶〜黒褐色。bbq-sauce（ΔE 5.2 / 10.4）・soy-sauce（7.2）・miso に近い | — | なし | 大（暗色の既存 4 種と見分けにくい） | ソース棚が「茶」に偏る |
| chili（赤唐辛子） | 7（曖昧語） | 小さな赤いスライス。tomato 系・pepperoni に紛れる | — | なし | 小 | 曖昧語の解決が先（O-4） |

色差は CIE76 ΔE を私が仮色で計算した**参考値**（本番の色ではない）。既存ソース同士の最小は pesto–yuzu-kosho 17.5、bbq–soy 23.4。新ソースをそれ以下に置くと棚の識別が悪化する。

## 5. ソース・チーズの拡張（独立調査）

### 5.1 ソース

- **現在 13 種**（tomato・olive-oil・pesto・fromage-blanc・doubanjiang・curry-ketchup・mustard・yuzu-kosho・miso・tahini・bbq・soy・fresh-cream）。全て PAINT（色駆動）。olive-oil だけ `PAINT_TEMPORARY` 系の特例（焼成で油色が変わる）。
- **未実装候補（上位）:** yogurt-sauce・yakiniku-sauce・sweet-bean-sauce（READY / REVIEW の各 1 行）、honey・mayo（複数行）、buffalo-sauce・okonomiyaki-sauce・peanut-sauce・gravy-sauce・salsa・kebab-sauce・blue-cheese-dressing（各 1 行、多くが BLOCKED）。
- **味・色・質感の差:** 現行は「色」しか差がない。**液体（honey・mayo・dressing）は“垂らす”質感が本質**で、PAINT のまま色だけ足すと既存と区別できない。ここが最大の設計上の分岐。
- **塗る操作の違いを足す必要性:** 焼成前に塗るものは**不要**（PAINT で足りる。B10 / New Sauces U1〜U3 の前例）。**焼成後に垂らす表現（mayo・buffalo・dressing・teriyaki、望むなら honey）は DRIZZLE 相当が必要**で、これは #579 / #604 / #611 の領域（Stage 3）。honey は matrix 上は 2 層目のスプレッドだが、**Owner 決定（O-5）で焼成後の後乗せが第一候補**になったため、液体の垂らし表現は #579 の設計に含める（§0.4.2）。焼成前 PAINT の選択肢は第一候補ではない。
- **再利用性:** 1 行にしか出ないソースが大半（yogurt・yakiniku・sweet-bean・peanut…）。**複数行に効くのは mayo（6、全 BLOCKED）と honey（5）だけ**。1 行専用ソースは「ソース 1 種 ＝ レシピ 1 件」の対になり、棚が増えるだけで体験の広がりは小さい。
- **複雑化の抑制案:** 焼成前 PAINT のソースは**レシピと同時に 1 種ずつ**（B10 の方式）。液体の後乗せは**共通基盤（DRIZZLE）を 1 回作ってから**まとめて入れる。

### 5.2 チーズ

- **現在 13 種**（mozzarella・gorgonzola・parmigiano・fontina・cashew・grana-padano・cream-cheese・catupiry・feta・ricotta・goat・paneer・swiss）。モッツァレラのみ Canvas の溶けた表現（#486 default-on）。feta・ricotta は専用 `pieceVisual`。他は emoji / CSS で、**加熱前後の差は“色の焼き込み”程度**。
- **未実装候補:** burrata（3 行、全 READY）、cheddar・brie・brick-cheese・caciocavallo・cheese-curd・cotija・halloumi・pecorino・ricotta-salata（各 1 行）。曖昧語「チーズ」が 3 行（old-forge・turkish pide・北海道チーズ）、プロヴォローネ 1 行。
- **溶け方・焼き色・配置の差:** burrata は「中心がとろけて外側が残る」、halloumi は「溶けず焼き目がつく」、cheese-curd は「半溶け」、brie は「白カビの皮」。**これらはモッツァレラ Canvas（`cheesePool.ts`）の別パラメータ化が必要**で、既存の Cheese Pool は mozzarella 専用の描画関数。拡張は**独立した設計 Gate**（#421 / #486 の系譜）を要する。
- **依存（O-6 確定）:** **専用 `pieceVisual` ＋焼成の色変化（feta / ricotta 方式）を採用**。Cheese Pool の汎用化は初回に含めず別 Gate（G-CP）に分離。見た目の魅力は下がるが既存システムの複雑化は最小。詳細は §0.3。

## 6. 優先度スコア

### 6.1 方法

6 軸を 5 段階で評価し、指定の重みで加重する（新しさ 25 / 見た目 20 / 再利用 20 / 実装負荷の小ささ 15 / 互換 10 / 解禁相性 10）。**同点は、依存が少なく短期で遊べる状態にできる方を上位**（依存数の昇順、次に Stage の昇順）。

**アンカー（主観を減らすため固定）:**

| 軸 | 5 | 3 | 1 |
|---|---|---|---|
| 新しさ | 新しい操作・体験が加わる | 既存体験の変形 | 既存と同じ |
| 見た目 | 完成時に一目で違う | 色 / 形が少し違う | 既存と区別不能 |
| 再利用（③の未出荷行数） | 6 行以上 | 2〜3 行 | 0（既存のみ）※1 行は 2、4〜5 行は 4 |
| 実装負荷の小ささ | データのみ | 専用 SVG ＋色 | 構造変更 |
| 互換 | HOT ファイル・golden に触れない | ledger / golden の更新のみ | 識別軸・採点・保存に触れる |
| 解禁相性 | 追記 step 1 つで自然 | ladder の位置調整 | 星ゲート / 保存と衝突 |

**代替重みも計算した:** 均等重み（各 1/6）と、実装安全重視（新しさ 15 / 見た目 10 / 再利用 15 / 負荷 30 / 互換 20 / 解禁 10）。順位が大きく動く候補は注記する。**重みの偏りの所見:** 新しさ＋見た目で 45% を占めるため、**構造系（calzone: 8 位、quattro-stagioni）が上位に出やすい**。実装安全重視では bulgogi・sfincione・crudaiola が上がり、calzone は 16 位に下がる。

### 6.2 レシピ（20 候補・更新後）

**評価基準の変更はない（アンカー・重みは §6.1 のまま）。** Owner 決定により**入力の評価値を 4 レシピ・4 食材で見直した**。変更理由と再計算結果を同じ表に示す（機械計算）。

| 変更 | 理由 |
|---|---|
| keema 新しさ 3→2 | §0.2.3: curry-pizza-japan / rendang と 2 要素差（近接の確認で判明） |
| burrata / burrata-pizza 見た目 5→4・負荷 3→4（burrata は新しさも 4→3） | O-6: Cheese Pool を使わず専用ピース＋色変化。溶ける表現が控えめになる分、見た目と新しさを下げ、汎用化が無い分、負荷を下げた |
| hot-honey / honey 負荷 2→1・互換 3→2 | O-5: 焼成後 = #579（FINISH の液体対応）が前提。`gameReducer.ts`（HOT）の FINISH カテゴリ規則に触れる |
| pizza-salad / lettuce / cucumber 解禁 3→2 | O-7: 後乗せ材料は late の固定表（`LATE_ENTITLEMENT_FLOORS`）・導出番号・Dinner / Lunch Rush 除外と結びつく |

「Stage」列は §8.5 の最終推奨案。「実装可能性」は評価値とは別の注記で、スコアに含めない。

| 順位 | id | 名称 | Stage(新) | 新しさ | 見た目 | 再利用 | 負荷小 | 互換 | 解禁 | 加重(新) | 旧順位→新 | 旧加重 | 変更した軸 | 均等 | 実装重視 | 実装可能性 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `pizza-salad` | ピザサラダ | 3a | 5 | 5 | 3 | 2 | 3 | 2 | **3.65** | 1→1 | 3.75 | 解禁 3→2 | 8 | 9 | △ 後乗せ依存 Gate（G-F1〜7）、3 新材料、R-3 |
| 2 | `piadina-romagnola` | ピアディーナ・ロマニョーラ | 4a | 4 | 4 | 5 | 2 | 2 | 3 | **3.60** | 3→2 | 3.60 | — | 9 | 10 | △ Dough Kind 一般化（O-12） |
| 3 | `burrata-pizza` | ブラータピザ | 2 | 3 | 4 | 3 | 4 | 4 | 4 | **3.55** | 2→3 | 3.60 | 見た目 5→4, 負荷 3→4 | 1 | 3 | ○ R-1・G-B1 の確認後 |
| 4 | `pizza-alla-crudaiola` | ピッツァ・アッラ・クルダイオーラ | 2 | 3 | 4 | 3 | 4 | 4 | 4 | **3.55** | 4→4 | 3.55 | — | 2 | 4 | ○ burrata-pizza の後 |
| 5 | `yakiniku-pizza` | 焼肉ピザ | 4a | 4 | 4 | 3 | 3 | 3 | 4 | **3.55** | 5→5 | 3.55 | — | 6 | 7 | △ #697 の Final Gate・実機 HV・merge 後。yakiniku-sauce は暗色で bbq と近い |
| 6 | `calzone` | カルツォーネ（ENCLOSE系） | 4b | 5 | 5 | 4 | 1 | 1 | 2 | **3.50** | 8→6 | 3.50 | — | 15 | 16 | ✕ 構造変更（ENCLOSE） |
| 7 | `manakish` | マナキーシュ | 4a | 4 | 4 | 5 | 1 | 2 | 2 | **3.35** | 9→7 | 3.35 | — | 13 | 14 | △ Dough Kind ＋ halloumi・zaatar、原典の不整合 |
| 8 | `sfincione` | スフィンチョーネ | 1 | 3 | 3 | 2 | 5 | 4 | 4 | **3.30** | 10→8 | 3.30 | — | 3 | 2 | ○ fugazza 上位集合の matcher / DH4 検証 |
| 9 | `pesto-burrata` | ペストブラータピザ | — | 2 | 4 | 3 | 4 | 4 | 4 | **3.30** | 11→9 | 3.30 | — | 5 | 5 | ○ ただし burrata-pizza との差がソースのみで見送り推奨 |
| 10 | `keema-pizza` | キーマピザ | 1 | 2 | 3 | 5 | 3 | 4 | 3 | **3.25** | 6→10 | 3.50 | 新しさ 3→2 | 7 | 6 | ○条件付き O-1・構成確認・R-2、rendang / curry と近接 |
| 11 | `hot-honey-pepperoni` | ホットハニーペパロニピザ | 3b | 4 | 4 | 4 | 1 | 2 | 3 | **3.25** | 7→11 | 3.50 | 負荷 2→1, 互換 3→2 | 12 | 15 | △ #579（FINISH 液体対応）の設計・実装、R-4、pepperoni 上位集合 |
| 12 | `teriyaki-chicken` | 照り焼きチキンピザ | 3b | 3 | 3 | 5 | 2 | 3 | 3 | **3.25** | 12→12 | 3.25 | — | 10 | 11 | △ #579 ＋ mayo |
| 13 | `bulgogi-pizza` | プルコギピザ | 1 | 2 | 3 | 2 | 5 | 5 | 4 | **3.15** | 13→13 | 3.15 | — | 4 | 1 | ○条件付き O-1・soy-sauce の解禁整合。wasabi-beef と近接 |
| 14 | `pesto-noci` | ペストノーチピザ | 3b | 3 | 3 | 4 | 2 | 3 | 3 | **3.05** | 14→14 | 3.05 | — | 11 | 12 | △ honey ＋ walnut（O-9） |
| 15 | `kimchi-pizza` | キムチピザ | 4a | 3 | 4 | 3 | 2 | 3 | 3 | **3.05** | 15→15 | 3.05 | — | 14 | 13 | △ Prep 拡張 |
| 16 | `peking-duck-pizza` | 北京ダックピザ | — | 4 | 4 | 2 | 1 | 3 | 3 | **2.95** | 16→16 | 2.95 | — | 17 | 17 | ○ 3 新材料で見送り |
| 17 | `quattro-stagioni` | クアトロスタジオーニ | 4b | 5 | 5 | 1 | 1 | 1 | 2 | **2.90** | 17→17 | 2.90 | — | 18 | 20 | ✕ 構造変更（ZONED） |
| 18 | `pizza-fritta` | ピッツァフリッタ | 4b | 5 | 4 | 2 | 1 | 1 | 2 | **2.90** | 18→18 | 2.90 | — | 20 | 19 | ✕ 構造変更（FRY） |
| 19 | `tsukimi-pizza` | 月見ピザ（DH4保留中） | 保留 | 2 | 4 | 1 | 5 | 3 | 2 | **2.75** | 19→19 | 2.75 | — | 16 | 8 | ✕ DH4 保留（変更なし） |
| 20 | `trenton-tomato-pie` | トレントントマトパイ | 4b | 4 | 3 | 2 | 2 | 1 | 3 | **2.70** | 20→20 | 2.70 | — | 19 | 18 | ✕ 構造変更（STEP_ORDER） |

### 6.3 食材（17 候補・更新後）

| 順位 | id | 名称 | Stage(新) | 新しさ | 見た目 | 再利用 | 負荷小 | 互換 | 解禁 | 加重(新) | 旧順位→新 | 旧加重 | 変更した軸 | 均等 | 実装重視 | 実装可能性 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `ground-beef` | 牛ひき肉 | 1 | 4 | 3 | 5 | 3 | 3 | 3 | **3.65** | 2→1 | 3.65 | — | 2 | 2 | ○ R-2、O-4（曖昧語の正規化） |
| 2 | `burrata` | ブラータ（チーズ） | 2 | 3 | 4 | 3 | 4 | 4 | 4 | **3.55** | 1→2 | 3.85 | 新しさ 4→3, 見た目 5→4, 負荷 3→4 | 1 | 1 | ○ R-1・G-B1 |
| 3 | `dessert-cluster` | デザート系（りんご/シナモン/チョコ等） | 4c | 5 | 4 | 4 | 1 | 2 | 2 | **3.40** | 4→3 | 3.40 | — | 12 | 16 | ✕ 新 family ＋ 後乗せ |
| 4 | `lettuce` | レタス | 3a | 4 | 4 | 3 | 3 | 3 | 2 | **3.35** | 3→4 | 3.45 | 解禁 3→2 | 5 | 7 | △ 後乗せ依存 Gate・R-3 |
| 5 | `chili` | 唐辛子（赤） | 1〜 | 2 | 3 | 5 | 4 | 3 | 3 | **3.30** | 6→5 | 3.30 | — | 3 | 3 | △ 曖昧語の解決（O-4） |
| 6 | `cucumber` | きゅうり | 3a | 3 | 4 | 3 | 4 | 3 | 2 | **3.25** | 5→6 | 3.35 | 解禁 3→2 | 6 | 5 | △ 同上（焼成後の仮定） |
| 7 | `french-fries` | フライドポテト | 4a | 3 | 4 | 3 | 3 | 3 | 3 | **3.20** | 8→7 | 3.20 | — | 7 | 8 | △ 未計画 |
| 8 | `walnut` | くるみ | — | 2 | 3 | 4 | 4 | 3 | 3 | **3.10** | 9→8 | 3.10 | — | 4 | 4 | △ O-9（other 棚） |
| 9 | `honey` | はちみつ（液体） | 3b | 4 | 3 | 4 | 1 | 2 | 3 | **3.05** | 7→9 | 3.30 | 負荷 2→1, 互換 3→2 | 15 | 17 | △ #579・R-4 |
| 10 | `brie` | ブリー | — | 3 | 4 | 2 | 3 | 3 | 3 | **3.00** | 10→10 | 3.00 | — | 11 | 13 | ○ |
| 11 | `mayo` | マヨネーズ | 3b | 2 | 2 | 5 | 3 | 3 | 3 | **2.95** | 11→11 | 2.95 | — | 8 | 9 | △ 後乗せソース（#579） |
| 12 | `yogurt-sauce` | ヨーグルトソース | 3a | 3 | 3 | 2 | 3 | 3 | 3 | **2.80** | 12→12 | 2.80 | — | 13 | 14 | △ O-7b（工程未決） |
| 13 | `cheddar` | チェダー | — | 2 | 3 | 2 | 4 | 4 | 3 | **2.80** | 13→13 | 2.80 | — | 9 | 6 | ○ |
| 14 | `squid` | いか | — | 2 | 3 | 2 | 3 | 4 | 4 | **2.75** | 14→14 | 2.75 | — | 10 | 12 | ○ |
| 15 | `sweet-bean-sauce` | 甜麺醤 | — | 3 | 2 | 2 | 4 | 3 | 3 | **2.75** | 15→15 | 2.75 | — | 14 | 10 | ○ |
| 16 | `yakiniku-sauce` | 焼肉のたれ | 4a | 3 | 2 | 2 | 4 | 3 | 3 | **2.75** | 16→16 | 2.75 | — | 16 | 11 | △ 暗色ソース同士の識別 R-5 |
| 17 | `halloumi` | ハルーミ | 4a | 3 | 3 | 2 | 3 | 3 | 2 | **2.70** | 17→17 | 2.70 | — | 17 | 15 | △ |

**重みの偏りの所見（更新後）:** 見た目・新しさで 45% のため構造系（calzone: 6 位）が上位に出る点は初版と同じ。実装安全重視では bulgogi・sfincione・burrata 系が上がり、calzone は 16 位。**後乗せ系（pizza-salad・hot-honey・honey）は均等重み・実装重視でさらに下がる**ため、加重 1 位の pizza-salad は Gate 解消前に先行させない。

> **読み方の注意.** 加重スコアは「何を先にやるか」の材料であって、そのまま実装順ではない。更新後も `pizza-salad` は 1 位（3.65）だが、**3 新材料・後乗せ Gate（G-F1〜7）・R-3 が未解決で、READY（証跡）であっても実装可能の確定ではない**。均等重みでは 8 位、実装安全重視では 9 位。burrata 系は全ての重みで 1〜6 位に残り、重みに対して頑健。

## 7. 推奨 TOP10（Owner 決定後の再評価）

### 7.1 レシピ TOP10（加重スコア順 ＋ 実装可能性）

実装可能性: ○=計画上は着手可（Owner の実装承認・描画 Gate 待ち）／○条件付き=O-1 の条件下／△=依存 Gate あり／✕=構造変更。

| 順位 | レシピ | 加重 | 元の証跡 | 実装可能性 | 初版からの変化 |
|---|---|---|---|---|---|
| 1 | pizza-salad | 3.65 | READY | △ 後乗せ Gate（G-F1〜7）・3 新材料・R-3。**READY のままだが実装可能の確定ではない** | 3.75→3.65。1 位は維持だが先行させない |
| 2 | piadina-romagnola | 3.60 | READY | △ Dough Kind 一般化（O-12） | 3→2 位 |
| 3 | burrata-pizza | 3.55 | READY | ○（R-1・G-B1） | 2→3 位（Cheese Pool 不使用で見た目 5→4） |
| 4 | pizza-alla-crudaiola | 3.55 | READY | ○（burrata-pizza の後） | 同点。依存数・Stage が同じなので burrata-pizza の後 |
| 5 | yakiniku-pizza | 3.55 | READY | △ #697 の Final Gate・実機 HV・merge 後 | 同 |
| 6 | calzone（ENCLOSE 系） | 3.50 | BLOCKED | ✕ | 8→6 位（他が下がったため） |
| 7 | manakish | 3.35 | REVIEW | △ Dough Kind ＋ 2 新食材 | 9→7 位 |
| 8 | sfincione | 3.30 | REVIEW | ○（fugazza 上位集合の検証） | 10→8 位 |
| 9 | pesto-burrata | 3.30 | READY | ○ 見送り推奨（差がソースのみ） | 11→9 位 |
| 10 | keema-pizza | 3.25 | BLOCKED（条件付き計画対象） | ○条件付き（O-1・構成確認・R-2） | 6→10 位（新しさ 3→2） |

圏外に下がったもの: **hot-honey-pepperoni 3.25（11 位）**＝#579 依存で負荷 1。bulgogi-pizza は 3.15（13 位、変更なし）。

**実装可能性で見た着手順の所見:** 加重上位 5 件のうち、Gate が少なく着手に近いのは burrata 系だけ。pizza-salad・piadina・yakiniku は上位でも依存 Gate が先。実装順はスコア順ではなく §8 の Stage に従う。

### 7.2 食材 TOP10（加重スコア順 ＋ 実装可能性）

| 順位 | 食材 | 加重 | 区分 | 実装可能性 | 初版からの変化 |
|---|---|---|---|---|---|
| 1 | ground-beef | 3.65 | 肉 | ○ R-2・O-4（「ひき肉」の正規化） | 2→1 位 |
| 2 | burrata | 3.55 | チーズ | ○ R-1・G-B1。**専用ピース方式で確定** | 3.85→3.55（1→2 位）。全重みで引き続き 1〜2 位 |
| 3 | デザート系 | 3.40 | 新 family | ✕ 新 family ＋ 後乗せ。群であり単一食材ではない | 4→3 位 |
| 4 | lettuce | 3.35 | 野菜 | △ 後乗せ Gate・R-3 | 3→4 位 |
| 5 | 唐辛子（赤） | 3.30 | 野菜 / 香辛 | △ 曖昧語の解決（O-4） | 6→5 位 |
| 6 | cucumber | 3.25 | 野菜 | △ 焼成後の仮定・同上 | 5→6 位 |
| 7 | french-fries | 3.20 | 野菜 | △ 未計画 | 8→7 位 |
| 8 | walnut | 3.10 | other | △ O-9 | 9→8 位 |
| 9 | honey | 3.05 | ソース（液体） | △ #579・R-4 | 7→9 位（3.30→3.05） |
| 10 | brie | 3.00 | チーズ | ○（単独行・BLOCKED のため後回し） | 同 |

## 8. 段階的拡張計画（Owner 決定後に更新）

**原則（変更なし）:** 各 Stage は独立して遊べる。新規は `lunchRush:false`、CUT なし、窓 58–78、報酬 100（B10 / B11 の運用）を初期案とし、**星ゲートは追加しない**（slack=1）。**個別レシピの実装承認は Owner の別途承認**（本書は計画）。

### 8.1 Stage 構成の比較

| | 初版（4b92884） | Owner 初期案 | **本更新の最終推奨** |
|---|---|---|---|
| Stage 1 | sfincione、keema・bulgogi（仮定承認前提）、ground-beef | sfincione、keema（条件付き）、bulgogi（条件付き）、ground-beef | **Owner 初期案どおり**。ただし 1a/1b に分割（下記） |
| Stage 2 | burrata 系 ＋ 条件付き pizza-salad・hot-honey | burrata、burrata-pizza、crudaiola | **burrata 系のみ**（pizza-salad・hot-honey を外す） |
| Stage 3 | 新調理法連動（Prep・後乗せソース・Dough Kind） | 後乗せ（honey、hot-honey、pizza-salad、生野菜） | **後乗せ専用**。3a=生野菜（topping）、3b=honey（#579 依存） |
| Stage 4 | 構造系 | 新調理法連動、ZONED、STEP_ORDER、ENCLOSE、デザート | **4a 新調理法連動（Prep・Dough Kind・別セッション調理法）／4b 構造系／4c デザート系** |

**差と理由:**
1. 初版は honey / pizza-salad を「焼成前の PAINT でも出せる」前提で Stage 2 に条件付きで置いたが、Owner 決定（焼成後）で**後乗せ系は独立した Gate 群（G-F1〜7、#579）を持つ**ことが確定した。Stage 2 に混ぜると burrata 系（Gate が少ない）の完成を遅らせるため分離する。
2. 後乗せを 3a / 3b に割るのは、**生野菜は現行 FINISH のカテゴリ制限（topping）内で #579 不要**、**honey は #579（FINISH の液体対応）が前提**という既存構造の違いによる。3a→3b の順。
3. 新調理法連動（Prep・Dough Kind・別セッション調理法）は、#697 の Final Gate・実機 HV・merge ＋別セッションの設計確定まで内容を確定できないため Stage 4a に置く（Owner 初期案と同じ）。
4. Stage 1 の分割: **1a = sfincione**（新食材なし・描画 Gate なし・non-credit）、**1b = ground-beef ＋ keema ＋（任意で）bulgogi**（R-2 と Owner の構成確認が先）。bulgogi は wasabi-beef と近接し新しさが低いため**最後・任意**。

### Stage 1 — 低依存レシピ

| 項目 | 内容 |
|---|---|
| レシピ | **1a:** sfincione（REVIEW）。**1b:** keema-pizza（条件付き計画対象）、bulgogi-pizza（条件付き計画対象・任意）。いずれも**個別の実装承認は未** |
| 食材 | ground-beef（トッピング、meat）。ソース・チーズの追加なし。bulgogi は soy-sauce を通常レシピで使う |
| 必要な工程 | なし（`MULTI_SPREAD_LAYER` は出荷済み）。ground-beef の「炒め」は Prep の別件で、**この Stage では対象外**（Prep は識別に使わない仕様） |
| 依存 Issue / PR | #611（運用）、#561（slack=1）、#623 / #438（アイコン）。**#697 には依存しない**。Gate: O-1 の適用条件（§0.2）、**R-2**（ground-beef の形状・質感）、O-4（「ひき肉」「青唐辛子」）、sfincione の matcher / DH4 検証（fugazza の上位集合）、bulgogi の soy-sauce 解禁整合 |
| 想定変更ファイル | `src/data/recipes.ts`・`ingredients.ts`・`recipeSauceProfiles.ts`・`discoveryLadder.ts`・`referencePizza.ts`・`ingredientTaxonomy.ts`・専用 SVG、`catalogLedger.test.ts` と pin 群、golden（`hint5.ladders55.json` 挿入のみ・`hint5.alphaFamilyOnly.json` 既存値が動く・DH4 audit 再生成） |
| テスト計画 | B11 S1 と同じ（tsc・oxlint・build・全 Vitest を Pinsa ON/OFF、E2E 390×844 / 360×800、Research cohort 文字ドリフト 0、旧ビルドで新 save を再保存しても落ちない）＋ **上位集合 / 近接の識別テスト**（sfincione↔fugazza、keema↔rendang / curry、bulgogi↔wasabi-beef） |
| iPhone Safari HV | ground-beef がトレイで beef・sausage と区別できるか／配置後 20px 級で粒に見えるか／Shop NEW → 購入 → Research ラベル漏えいなし → 調理 → NEW DISCOVERY → Dex／横スクロールなし |
| リスク | 仮定ソースが原典と違う（暫定表示必須）／keema・bulgogi が既存 beef・curry 系と“少し変えただけ”に見える／R-2 が不合格なら ground-beef を見直し |
| 完了条件 | 全ゲート GREEN、構成案の Owner 確認、Owner の実機 HV 判定、`catalogLedger` 更新（全て実装した場合 recipes 83 / ingredients 93 / ladder 71 前後）。**本番反映は別承認** |

### Stage 2 — ブラータ系

| 項目 | 内容 |
|---|---|
| レシピ | burrata-pizza、pizza-alla-crudaiola（pesto-burrata は差がソースのみのため見送り推奨を維持） |
| 食材 / チーズ | **burrata**（専用ピース＋色変化。O-6 確定）。ソース追加なし |
| 描画方針 | 専用 `pieceVisual`（feta-cubes / ricotta-mound 方式）。他の白チーズと区別できる輪郭、加熱状態の色・質感の変化、小サイズでの識別。**Cheese Pool 汎用化は含めない（G-CP）** |
| 必要な工程 | なし。配置時点は各レシピの仕様と整合（G-B1）。matrix 記録上は焼成前で矛盾なし |
| 依存 | **R-1（描画品質調査の結果）**、R-5（白系チーズとのコントラスト）、G-B1、Owner の実装承認。#486 / #421 は出荷済み・変更なし |
| 想定変更ファイル | Stage 1 と同系 ＋ burrata 専用 SVG・焼成色の定義。`cheesePool.ts` は**変更なし** |
| テスト計画 | Stage 1 ＋ burrata の 20px / グレースケール識別（既存のアイコン比較方式）／焼成前後の色変化の単体テスト |
| iPhone HV | トレイで 4 種の白チーズ（mozzarella・ricotta・cream-cheese・catupiry）と区別できるか／焼成前後の変化／完成写真で主役になっているか |
| リスク | 白チーズが 5 種になり識別が悪化（R-1 / R-5）／Cheese Pool を使わないため溶ける魅力は控えめ |
| 完了条件 | Stage 1 と同じ ＋ R-1 / R-5 の合格 ＋ 白チーズ識別の HV PASS |

### Stage 3 — 後乗せ工程（3a → 3b）

| 項目 | 3a 生野菜 | 3b honey |
|---|---|---|
| レシピ | pizza-salad | hot-honey-pepperoni（pesto-noci ほかは後続） |
| 食材 | lettuce、cucumber（焼成後の仮定）、yogurt-sauce（工程は O-7b で未決） | honey（液体、焼成後） |
| 必要な工程 | 既存 FINISH（topping 限定）で足りる想定。**未確認の Gate: G-F1〜G-F7** | **#579: FINISH の液体（ソース）対応と仕上げソース〈DRIZZLE 候補〉**。FINISH のカテゴリ規則（`gameReducer.ts`、HOT）の拡張が要る可能性 |
| 依存 Issue / PR | #604 / #611（後乗せ）、#518（焼成フィルタ分離）、#617 / #664（中断復帰）、R-3、R-5 | **#579（open・未設計。実装開始は未承認）**、R-4 |
| 想定変更ファイル | `src/data/lateCatalog.ts`（`LATE_RECIPES` / `LATE_INGREDIENTS` / `LATE_LADDER_STEPS` / `LATE_ENTITLEMENT_FLOORS` / `LATE_TAXONOMY_ROWS`）、専用 SVG、golden、`catalogLedger.test.ts` | 左 ＋ `src/state/finishEngine.ts`、`gameReducer.ts`（HOT）、`PizzaStage.tsx` の描画 |
| テスト計画 | late の ON/OFF 両方（`lateCatalog.offGolden`）、Research 非漏洩、DH4 privacy sweep、焼成失敗時の FINISH スキップ、中断復帰 | 左 ＋ 液体 piece の Reference / 採点 / 保存 |
| iPhone HV | **390×844 / 360×800 の FINISH 操作領域**（トレイ・タップ領域・横スクロールなし・生地上の重なり）、生野菜が焼成済み生地上で読めるか | 垂らし操作の可否、艶の視認性 |
| リスク | 3 新材料の同時導入、late 固定表の更新で導出番号がずれる、pepperoni の上位集合（hot-honey） | #579 の設計が未了、HOT ファイル衝突（#697 は `gameReducer.ts` に約 10 行追加しており、先に merge する側が優先） |
| 完了条件 | G-F1〜7 の解消、R-3 / R-5 合格、Owner の実機 HV | #579 の設計承認 → 実装 → 左の条件 ＋ R-4 合格 |

### Stage 4 — 新調理法連動・高度な構造

| 区分 | 内容 | 状態 |
|---|---|---|
| **4a 新調理法連動** | 「炒める」(#695 / **#697**): yakiniku-pizza（＋yakiniku-sauce）、ground-beef の炒め対応、kimchi-pizza／Dough Kind 第 2 種(#577): piadina、manakish／**別セッションの調理法**（ソーセージ・ポルチーニの焼く、エビの茹でる、玉ねぎのあめ色炒め、共通基盤） | #697 は Final Gate・実機 HV・merge 後に**再確認**。別セッションは設計未確定のため内容を確定しない（§9） |
| **4b 構造系** | ZONED（quattro-stagioni）、STEP_ORDER（trenton / chicago-deep-dish）、ENCLOSE（calzone ほか 5 行）、PAN_BAKE / DOUGH_SHAPE_TARGET、FRY / LAMINATE | 各構造は個別の設計 Gate が先（O-11） |
| **4c デザート系** | apple-cinnamon・nutella・smore・fruit | 新 family ＋ 後乗せ（mid_bake を含む） |

### 8.5 最終推奨案（依存関係・実装安全性を踏まえて）

**Stage 1a（sfincione）→ Stage 2（burrata 系）→ Stage 1b（ground-beef・keema）→ Stage 3a（生野菜）→ Stage 3b（honey、#579 の後）→ Stage 4。**

- Stage 番号は“テーマ”で、着手順は Gate の少ない順。1a と 2 は描画 Gate（R-1）以外に未解決事項が少なく、先に出せる。1b は R-2（ground-beef）が前提。3a は G-F が多く、3b は #579 が前提。
- ただし着手順は**調査結果（R-1〜R-5）次第で入れ替わる**。描画調査が未完了のため、本書は順序を確定しない。

## 9. 新調理法との依存関係

別セッションが検討中の「焼く（ソーセージ・ポルチーニ）」「茹でる（エビ）」「あめ色炒め（玉ねぎ）」「共通基盤」を、**本書では実装・設計していない**。依存として記録する。

1. **172 の未出荷候補でこれらに依存する行は 0。** matrix で `PREP_STEP` を要求する未出荷行は kimchi・yakiniku・lomo-saltado の 3 行で、いずれも「炒める／水切り」（牛・キムチ）。焼く・茹でる・あめ色炒めは**証跡に現れない**。
2. したがってこれらの新調理法は**新レシピを増やすのではなく、出荷済みレシピの体験を変える**:

| 調理法 | 影響する出荷済みレシピ |
|---|---|
| ソーセージを焼く | 8（salsiccia・meat-lovers・brazilian-calabresa・full-english・polish-kielbasa・salsiccia-e-friarielli・spanish-chorizo・boscaiola） |
| ポルチーニを焼く | 2（boscaiola・porcini-pizza） |
| エビを茹でる | 3（pesto-gamberi・pescatore・yuzu-shrimp） |
| 玉ねぎのあめ色炒め | **17**（fugazza・tonno-e-cipolla・pizza-portuguesa・pesto-tonno・brazilian-calabresa・aussie・veggie-supreme・bacalhau・polish-kielbasa・pizza-moscow・spanish-chorizo・flammkuchen・curry-pizza-japan・rendang・tandoori-paneer・bbq-chicken・wasabi-beef） |

3. 現行 Prep の仕様（#697）は**識別・採点・保存に影響しない**（`preparedLook` は transient）。同じ方針が新調理法にも適用されるなら、**これらは新レシピの前提にならず、拡張計画と独立に進められる**。ただし玉ねぎは 17 レシピに効くため、**共通基盤の設計が出るまで、玉ねぎ・ソーセージ・ポルチーニ・エビを使う新レシピを Stage 1〜2 に入れない**（本書の Stage 1〜2 の候補はいずれも該当しない。bulgogi / keema の onion を除く — onion はあめ色炒めが“任意の見た目”である限り影響しない。必須化されるなら要再確認）。
4. 調理法が未完成のため、これらを必要とする**新規レシピ候補は挙げていない**（挙げられるのは出荷済みの強化のみ）。

## 10. PR #697 との競合分析

| 観点 | 結果 |
|---|---|
| 現在の状態 | HEAD `8ba2b5b9…`（初版・本更新の両時点で一致）、`clean`、50 ファイル。**本書は #697 のブランチにも他セッションのブランチにも触れていない** |
| ファイル重複 | 本書の変更は新規 1 ファイル `docs/design/TETO_RECIPE-INGREDIENT-EXPANSION_FRESH-PLAN_2026-10-29.md` のみ。#697 の docs は `docs/reports/TETO_COOKING-PREP_PHASE1B_*` と仕様書の改訂で**重ならない** |
| 将来の重複（Stage 1〜2） | 想定変更ファイルは `src/data/**` と専用 SVG が中心。#697 の変更は `src/logic/prep/**`・`CookingPrep*`・`PizzaStage.tsx`・`GameScreen.tsx`・`App.tsx`・`gameReducer.ts`。**`src/data/**` は重ならない**。HOT の `gameReducer.ts` / `GameScreen.tsx` は Stage 1〜2 で触らない |
| 将来の重複（Stage 3b / 4a） | 3b は #697 が最小変更した `gameReducer.ts`（HOT）の FINISH 規則に触れる可能性があり、**先に merge する側が優先**。4a: ground-beef を Prep 対象にする変更は `src/data/prepIngredients.ts`（PR-A の claim 範囲）と `PREP_TARGET_INGREDIENT_IDS`。**#697 の merge と実機 HV の後**に行う |
| 古い open PR | #478（`GameScreen.tsx`）・#468（`PizzaStage.tsx`）は既に main と競合。#697 本文の記載どおり。拡張 PR は触らない |
| 結論 | **干渉なし**（現時点・計画上）。実装着手時に最新の open PR / claim を再確認する |

## 11. ゲームバランス・保存データのリスク

| 観点 | 調査結果 | 評価 |
|---|---|---|
| 序盤にレシピが増えすぎないか | 新規は全て ladder の**末尾**（第 4 章＝44/70 step）に追記。第 1〜3 章（36 step）は不変 | 序盤は安全。**第 4 章が長くなりすぎる**（現在 63%）。+3〜6 step ごとに章の見直しを |
| 特定食材ばかり使われないか | mozzarella 58/80、tomato 29、onion 17、eggplant 9。50/92 が単独使用 | eggplant・mozzarella のみの変種（caponata・baingan-bharta 等）は**優先しない**。新食材は 2 レシピ以上で使えるものを選ぶ |
| 食材トレイが長くなりすぎないか | 92 食材、vegetable 棚 24。#675（75 食材時の UX 実測）は open のままで、現在は 92 | Stage ごとに **+6 食材以内**を目安にし、vegetable 棚が 30 を超える前に #675 の測定を先行 |
| レシピ推理のヒントが不足しないか | Hint 5.0（サブ分類ラダー）は全サブトッピングに family を要求。B11 では `alphaFamilyOnly` の既存値が動いた（ikura 70→98 等）。DH4 は「その他は到達不能」(OD-DH4-2-9) | 新食材には family が必須。walnut を `other` に入れると DH4 の制約に影響（O-9）。**各 Stage の PR で golden の挿入のみ / 既存値変化を区別して記録** |
| 同時解禁時の表示や報酬 | ladder は REC-04 規則（1 材料 step を先、id 昇順の同点処理）。non-credit は兄弟 step に乗る（B11 の porcini-pizza） | 矛盾なし。**同一 step に 2 レシピを載せる場合は key を明示** |
| Lunch Rush の難易度 | プール 25/80。新規は `lunchRush:false` が既定運用 | 新規を `false` のままなら**難易度は不変**。プールへ入れる判断は別（O-10） |
| 既存セーブからの移行 | schema v2、ladder 追記専用、新食材は ledger に無ければ未所持。late 床（`LATE_ENTITLEMENT_FLOORS`）が通常 step 追加でずれうる | 追記のみなら自然移行。**旧ビルドで新 save を開いて再保存するケース**をテストで固定（#674 の前例）。#668（Dex raw エントリ保持）は**未実装の既存リスク**で、拡張が増やす |
| 星ゲート | slack=1。ゲート追加は検出テストが失敗 | **星ゲートは付けない**。credited は専用 step を持たせる |
| 保存まわりの open Issue | #560 / #617 / #664 / #668（保存保護・pendingRound・Dex raw） | 本書は触れない。拡張の PR は新規 save フィールドを作らない |

## 12. 既存の保留事項との関係

- **tsukimi-pizza**: 唯一の「① かつ READY」だが、DH4 の `その他` 到達不能制約で**実装保留**（OD-B9-8 / OD-B9-12。gate 緩和と egg の family 変更は禁止）。本書は解除を推奨しない。Stage 1 の数を押し上げる誘惑があるが、**Owner の保留判断を維持**。
- **pescatore**: matrix は tomato＋olive-oil、出荷は olive-oil 省略（B11 の Owner 承認例外）。matrix と出荷のずれは「② 出荷との衝突」と同種の扱い。
- **FINISH / 後乗せ**: 出荷済み 8 late レシピは topping 後乗せのみ。ソース・チーズの後乗せ（#579）は未着手。Owner 決定（O-5 / O-7）で honey・生野菜が後乗せ対象になったため、Gate は §0.4.3 に集約。
- **上位集合の近接**: hot-honey-pepperoni ⊃ pepperoni、sfincione ⊃ fugazza（§0.2.4）。出荷済みレシピの識別を変えないことをテストで固定する。

## 13. Owner 判断が必要な事項（Owner Decision Update 後）

### 13.1 確定済み（再承認不要・§0.1）

O-1（GAMEPLAY ASSUMPTION の条件付き許可）、O-6（burrata は専用ピース＋色変化、Cheese Pool 汎用化は別 Gate）、O-5（honey は焼成後の後乗せ優先）、O-7（生野菜は焼成後）。

### 13.2 未決（整理後）

| # | 判断 | 備考 |
|---|---|---|
| **O-1a** | keema / bulgogi の**具体構成**（最終材料集合、個数・配置、窓・報酬、名称・説明文）の確認 | 実装前の必須確認（§0.2.1 の 7）。実装承認とは別 |
| **O-1b** | keema の「青唐辛子」を省くか、chili を足すか | 足す場合は新食材が 2 つに増える |
| **O-1c** | bulgogi で soy-sauce（late ソース）を通常レシピで使う際の解禁整合 | `LATE_ENTITLEMENT_FLOORS` との関係 |
| O-2 | Stage 1 の範囲（1a のみ／＋1b／bulgogi を含めるか） | 推奨: 1a → 1b（keema まで）、bulgogi は任意 |
| O-3 | 新規レシピの公開方式（通常 ladder 追記／non-credit） | B10 / B11 方式を踏襲 |
| O-4 | 曖昧語の正規化: 「ひき肉」→ground-beef、「唐辛子」→chili（`chili-oil` と割れている）、「チーズ」→mozzarella か | keema / lahmacun ほかに効く |
| O-5a | honey の後乗せ方式の**詳細**（垂らす操作・描画）は #579 の設計で決める。#579 の設計・実装の開始承認 | 本更新は方式の承認のみ |
| **O-7a** | cucumber も生野菜として焼成後にするか（lettuce 以外の扱い） | 仮定のまま計画 |
| **O-7b** | yogurt-sauce の工程（焼成前 PAINT か、後乗せか） | matrix は 2 層目のスプレッド |
| O-7c | pizza-salad の 3 新材料の同時導入の可否 | 分割導入も可（lettuce → cucumber → yogurt） |
| O-8 | 新食材の family 暫定: ground-beef=meat、lettuce / cucumber=vegetable、burrata=cheese、yogurt-sauce=sauce | B10 / B11 と同様 |
| O-9 | walnut を `other` に入れるか、新 family にするか（DH4 の OD-DH4-2-9） | 見送り推奨のまま |
| O-10 | 新規の Lunch Rush 参加（既定 false の維持） | 維持推奨 |
| O-11 | Stage 4b / 4c のどの構造を作る価値があるか | 現時点では計画しない |
| O-12 | Dough Kind を 2 値から一般化してよいか | Stage 4a の入口 |
| O-13 | 各 Stage の Issue 化と claim | 承認前は何も作らない |
| **O-14** | 描画品質調査（R-1〜R-5）の結果を受けた Stage 順の最終確定 | 調査完了後に再評価 |
| **O-15** | tsukimi の保留は維持（変更なし）／sfincione・hot-honey の上位集合検証（§0.2.4）の扱い | 検証は実装時のテストで固定 |

### Issue 案（**作成していない**。Owner 承認後に起票。更新後）

- **案 A: `Expansion Batch 12 S1a/S1b`** — 1a: sfincione。1b: ground-beef ＋ keema（＋任意 bulgogi）。受け入れ条件は §8 Stage 1。依存: #611、#561、O-1a〜c、O-4、R-2。**#697 には依存しない**。
- **案 B: `Expansion Batch 12 S2: burrata（専用ピース）+ burrata-pizza / crudaiola`** — 受け入れ条件は §8 Stage 2。依存: R-1、R-5、G-B1、Cheese Pool 汎用化は含めない。
- **案 C: `Expansion S3: 後乗せ（生野菜 → honey）`** — 3a は G-F1〜7 の解消が受け入れ条件、3b は #579 の設計承認後。実装なし（計画 Issue）。
- **案 D: `Expansion S4a: 新調理法との連動計画`** — #697 の Final Gate・実機 HV・merge 後、別セッションの設計確定後に起票。

## 14. 検証した内容と限界

- **集計の再計算:** `RECIPES` / `INGREDIENTS` を実行して取得（80 / 92）。matrix JSON を現行 id・材料集合と突き合わせ、71 / 4 / 97 に分けた（§2 の検算が一致）。分類・証跡状態・不足食材は同じスクリプトで機械的に出力し、付録 A に全 97 行を載せた。**スクリプトはリポジトリに入れていない**（docs-only）。再現は matrix JSON ＋ `src/data` の実行で可能。
- **更新時の再計算:** §6.2 / §6.3 の加重・順位は、見直した評価値（§6.2 の変更表）から同じ方法で再計算し、旧順位・旧加重と並べて示した。近接・上位集合の確認は、現行 `RECIPES` の材料集合との差（対称差）を実行して取得した（keema / bulgogi / burrata 系 / hot-honey / pizza-salad / sfincione）。描画品質調査（R-1〜R-5）は**未完了のため参照していない**。
- **スコア:** 加重和は表の整数から機械計算（手計算ではない）。アンカーは §6.1 に固定。評価値は私の判断で、Owner の見立てと違えば表の整数を差し替えて再計算できる。
- **限界:** (1) matrix の材料集合は“ソース family 由来”を含まない場合があり（例: tomato-sauce 省略）、材料の差分判定は id レベル。(2) ⑤（描画先行）はヒューリスティック。(3) 色差は仮色の CIE76 ΔE で、実描画（焼成後・縮小時）の見え方は未測定。(4) 原典は未確認。(5) コードは実行・テストしていない（実装なし）。(6) 過去の監査値（55/61・122・19・約 21）は定義不明で再現できなかった。

## 付録 A. 未出荷候補 97 件の分類（READY → REVIEW → BLOCKED の順）

分類記号: ①既存のみ ②新食材 ③新ソース/チーズ ④新工程 ⑥再現困難 ／ ⑤ = 描画先行フラグ（③に付与）。

| # | evidence id | 名称 | 分類 | 証跡 | 不足食材（現行に無い） | 必要 capability | blocker |
|---|---|---|---|---|---|---|---|
| 1 | `tsukimi-pizza-pizzadb-p14` | 月見ピザ | ① | READY | — | — | — |
| 2 | `sfincione-pizzadb` | スフィンチョーネ | ① | REVIEW | — | MULTI_SPREAD_LAYER | — |
| 3 | `caponata-pizza-pizzadb-p2` | カポナータピザ | ① | BLOCKED | — | — | BASE_SAUCE_UNSPECIFIED |
| 4 | `keema-pizza-pizzadb-p2` | キーマピザ | ① | BLOCKED | — | — | BASE_SAUCE_UNSPECIFIED, UNRESOLVED_INGREDIENT |
| 5 | `jamaican-jerk-chicken-pizza-pizzadb-p3` | ジャマイカンジャークチキンピザ | ① | BLOCKED | — | — | BASE_SAUCE_UNSPECIFIED |
| 6 | `supreme-pizzadb` | スプリームピザ | ① | BLOCKED | — | — | COMPOSITION_CONFLICT_CANDIDATE |
| 7 | `nigerian-suya-pizza-pizzadb-p5` | ナイジェリアンスヤピザ | ① | BLOCKED | — | — | BASE_SAUCE_UNSPECIFIED |
| 8 | `baingan-bharta-pizza-pizzadb-p6` | バインガンバルタピザ | ① | BLOCKED | — | — | BASE_SAUCE_UNSPECIFIED |
| 9 | `pizza-zucchine-menta-pizzadb-p8` | ピッツァ・コン・ズッキーネ・クルーデ・エ・メンタ | ① | BLOCKED | — | — | MECHANIC_INTERPRETATION |
| 10 | `pizza-chilena-pizzadb-p8` | ピッツァ・チレーナ | ① | BLOCKED | — | — | UNRESOLVED_INGREDIENT |
| 11 | `pizza-baiana` | ピッツァ・バイアーナ | ① | BLOCKED | — | — | UNRESOLVED_INGREDIENT |
| 12 | `philly-cheesesteak-pizza-pizzadb-p9` | フィリーチーズステーキピザ | ① | BLOCKED | — | — | UNRESOLVED_INGREDIENT |
| 13 | `bulgogi-pizza-pizzadb-p11` | プルコギピザ | ① | BLOCKED | — | — | BASE_SAUCE_UNSPECIFIED |
| 14 | `hokkaido-cheese-pizza-pizzadb-p15` | 北海道チーズピザ | ① | BLOCKED | — | — | UNRESOLVED_INGREDIENT |
| 15 | `apple-cinnamon-dessert-pizzadb` | アップルシナモンデザートピザ | ② | BLOCKED | apple, cinnamon, walnut | — | BASE_SAUCE_UNSPECIFIED |
| 16 | `jerusalem-mixed-grill-pizza-pizzadb-p1` | エルサレムミックスグリルピザ | ② | BLOCKED | cumin | — | BASE_SAUCE_UNSPECIFIED |
| 17 | `chicken-tikka-pizza-pizzadb-p5` | チキンティッカピザ | ② | BLOCKED | chicken-tikka | — | BASE_SAUCE_UNSPECIFIED |
| 18 | `diavola-pizza-pizzadb-p5` | ディアボラ | ② | BLOCKED | spicy-salami | — | COMPOSITION_CONFLICT_CANDIDATE, UNRESOLVED_INGREDIENT |
| 19 | `banh-mi-pizza-pizzadb-p6` | バインミーピザ | ② | BLOCKED | carrot, daikon, liver-pate | — | BASE_SAUCE_UNSPECIFIED |
| 20 | `pizza-asparagi-limone-pizzadb-p8` | ピッツァ・コン・アスパラージ・クルーディ・エ・リモーネ | ② | BLOCKED | asparagus | — | MECHANIC_INTERPRETATION |
| 21 | `pizza-finocchi-salad-pizzadb-p8` | ピッツァ・コン・インサラータ・ディ・フィノッキ | ② | BLOCKED | fennel, orange | — | MECHANIC_INTERPRETATION |
| 22 | `pizza-cavolo-carote-pizzadb-p8` | ピッツァ・コン・カーヴォロ・ロッソ・エ・カローテ | ② | BLOCKED | carrot, red-cabbage, sunflower-seeds | — | MECHANIC_INTERPRETATION |
| 23 | `frutti-di-mare-pizzadb-p11` | フルッティディマーレ | ② | BLOCKED | squid | — | COMPOSITION_CONFLICT_CANDIDATE |
| 24 | `moussaka-style-pizza-pizzadb-p13` | ムサカ風ピザ | ② | BLOCKED | cinnamon | — | UNRESOLVED_INGREDIENT |
| 25 | `pizza-salad-pizzadb-p7` | ピザサラダ | ③⑤ | READY | cucumber, lettuce, yogurt-sauce | MULTI_SPREAD_LAYER | — |
| 26 | `pizza-alla-crudaiola-pizzadb-p8` | ピッツァ・アッラ・クルダイオーラ | ③⑤ | READY | burrata | MULTI_SPREAD_LAYER | — |
| 27 | `burrata-pizza-pizzadb-p10` | ブラータピザ | ③⑤ | READY | burrata | MULTI_SPREAD_LAYER | — |
| 28 | `pesto-noci-pizzadb-p12` | ペストノーチピザ | ③ | READY | honey, walnut | MULTI_SPREAD_LAYER | — |
| 29 | `pesto-burrata-pizzadb-p12` | ペストブラータピザ | ③⑤ | READY | burrata | MULTI_SPREAD_LAYER | — |
| 30 | `hot-honey-pepperoni-pizzadb-p12` | ホットハニーペパロニピザ | ③ | REVIEW | honey | MULTI_SPREAD_LAYER | — |
| 31 | `peking-duck-pizza` | 北京ダックピザ | ③ | REVIEW | cucumber, peking-duck, sweet-bean-sauce | — | — |
| 32 | `okonomiyaki-style-pizza-pizzadb-p1` | お好み焼き風ピザ | ③⑤ | BLOCKED | bonito-flakes, cabbage, mayo, okonomiyaki-sauce | MULTI_SPREAD_LAYER | UNRESOLVED_INGREDIENT |
| 33 | `potato-mayo-pizza-pizzadb-p3` | じゃがマヨピザ | ③⑤ | BLOCKED | mayo | — | BASE_SAUCE_UNSPECIFIED |
| 34 | `goulash-pizza-pizzadb-p3` | グヤーシュピザ | ③⑤ | BLOCKED | sour-cream | — | BASE_SAUCE_UNSPECIFIED |
| 35 | `swedish-kebab-pizza-pizzadb-p4` | スウェディッシュケバブピザ | ③ | BLOCKED | kebab-sauce, lettuce | — | BASE_SAUCE_UNSPECIFIED, UNRESOLVED_INGREDIENT |
| 36 | `speck-e-brie-pizzadb-p4` | スペックエブリー | ③⑤ | BLOCKED | brie, walnut | — | COMPOSITION_CONFLICT_CANDIDATE |
| 37 | `thai-chicken-pizza-pizzadb-p4` | タイチキンピザ | ③ | BLOCKED | peanut-sauce | — | UNRESOLVED_INGREDIENT |
| 38 | `taco-pizza-pizzadb` | タコピザ | ③ | BLOCKED | cheddar, ground-beef, lettuce, salsa, tortilla-chips | — | MECHANIC_INTERPRETATION |
| 39 | `nashville-hot-chicken-pizza-pizzadb-p6` | ナッシュビルホットチキンピザ | ③ | BLOCKED | honey | — | BASE_SAUCE_UNSPECIFIED |
| 40 | `buffalo-cauliflower-pizza-pizzadb-p6` | バッファローカリフラワーピザ | ③⑤ | BLOCKED | blue-cheese-dressing, cauliflower | — | BASE_SAUCE_UNSPECIFIED |
| 41 | `pizza-alla-norma-pizzadb-p9` | ピッツァアッラノルマ | ③⑤ | BLOCKED | ricotta-salata | — | COMPOSITION_CONFLICT_CANDIDATE |
| 42 | `pizza-radicchio-noci-pizzadb-p8` | ピッツァ・コン・ラディッキオ・クルード・エ・ノーチ | ③ | BLOCKED | balsamic-vinegar, radicchio, walnut | MULTI_SPREAD_LAYER | MECHANIC_INTERPRETATION |
| 43 | `venezuelan-reina-pepiada-pizzadb-p12` | ベネズエラレイナペピアーダピザ | ③⑤ | BLOCKED | mayo | — | BASE_SAUCE_UNSPECIFIED |
| 44 | `peruvian-aji-amarillo-pizzadb-p12` | ペルーアヒアマリージョピザ | ③ | BLOCKED | aji-amarillo | — | BASE_SAUCE_UNSPECIFIED |
| 45 | `mexican-elote-pizza-pizzadb-p13` | メキシカンエロテピザ | ③⑤ | BLOCKED | chili-powder, cotija, lime, mayo | — | BASE_SAUCE_UNSPECIFIED |
| 46 | `nduja-pizza-pizzadb-p14` | ンドゥイヤピザ | ③ | BLOCKED | honey | — | BASE_SAUCE_UNSPECIFIED |
| 47 | `south-african-boerewors-pizzadb-p14` | 南アフリカボアヴォースピザ | ③ | BLOCKED | chutney | — | BASE_SAUCE_UNSPECIFIED |
| 48 | `mentaiko-mochi-pizza` | 明太子もちピザ | ③⑤ | BLOCKED | mayo, mentaiko, mochi | — | BASE_SAUCE_UNSPECIFIED |
| 49 | `ume-shiso-pizza-pizzadb-p14` | 梅しそピザ | ③ | BLOCKED | umeboshi-paste | — | BASE_SAUCE_UNSPECIFIED |
| 50 | `piadina-romagnola-pizzadb-p7` | ピアディーナ・ロマニョーラ | ④ | READY | — | DOUGH_VARIANT | — |
| 51 | `poutine-pizza-pizzadb-p10` | プーティンピザ | ④ | READY | cheese-curd, french-fries, gravy-sauce | DOUGH_VARIANT | — |
| 52 | `yakiniku-pizza` | 焼肉ピザ | ④ | READY | yakiniku-sauce | PREP_STEP | — |
| 53 | `argentine-napolitana-pizzadb-p1` | アルゼンチン風ナポリターナ | ④ | REVIEW | — | DOUGH_VARIANT | — |
| 54 | `cauliflower-crust-pizza-pizzadb-p2` | カリフラワークラストピザ | ④ | REVIEW | — | DOUGH_VARIANT | — |
| 55 | `ny-style-pizzadb` | ニューヨークスタイルピザ | ④ | REVIEW | — | DOUGH_VARIANT | — |
| 56 | `fathead-pizza-keto-pizzadb-p9` | ファットヘッドピザ（ケト風） | ④ | REVIEW | — | DOUGH_VARIANT | — |
| 57 | `manakish` | マナキーシュ | ④ | REVIEW | halloumi, zaatar | DOUGH_VARIANT | — |
| 58 | `eel-pizza-pizzadb-p1` | うなぎピザ | ④ | BLOCKED | eel, sansho-pepper | LATE_ADDITION | BASE_SAUCE_UNSPECIFIED, MECHANIC_INTERPRETATION |
| 59 | `kimchi-pizza-pizzadb-p2` | キムチピザ | ④ | BLOCKED | kimchi | PREP_STEP | BASE_SAUCE_UNSPECIFIED |
| 60 | `quad-cities-style-pizza-pizzadb-p2` | クアッドシティーズスタイルピザ | ④ | BLOCKED | — | DOUGH_VARIANT | UNRESOLVED_INGREDIENT |
| 61 | `colorado-mountain-pie-pizzadb-p3` | コロラドマウンテンパイ | ④ | BLOCKED | — | DOUGH_VARIANT | EVIDENCE_GAP |
| 62 | `smore-dessert-pizza-pizzadb-p4` | スモアデザートピザ | ④ | BLOCKED | chocolate, graham-cracker, marshmallow | LATE_ADDITION | BASE_SAUCE_UNSPECIFIED |
| 63 | `st-louis-style-pizza-pizzadb-p4` | セントルイススタイルピザ | ④ | BLOCKED | — | DOUGH_VARIANT | UNRESOLVED_INGREDIENT |
| 64 | `nutella-dessert-pizza-pizzadb-p6` | ヌテラデザートピザ | ④ | BLOCKED | banana, nutella-spread, powdered-sugar | LATE_ADDITION | COMPOSITION_CONFLICT_CANDIDATE, UNRESOLVED_INGREDIENT |
| 65 | `buffalo-chicken-pizzadb` | バッファローチキンピザ | ④ | BLOCKED | blue-cheese-dressing, buffalo-sauce | MULTI_SPREAD_LAYER, LATE_ADDITION | COMPOSITION_CONFLICT_CANDIDATE |
| 66 | `palmitos-salsa-golf-pizzadb-p7` | パルミートス・イ・サルサ・ゴルフ | ④ | BLOCKED | — | DOUGH_VARIANT | BASE_SAUCE_UNSPECIFIED |
| 67 | `pizza-carciofi-salad-pizzadb-p8` | ピッツァ・コン・インサラータ・ディ・カルチョーフィ | ④ | BLOCKED | celery | DOUGH_VARIANT | MECHANIC_INTERPRETATION |
| 68 | `pizza-cicoria-limone-pizzadb-p8` | ピッツァ・コン・チコリア・エ・リモーネ | ④ | BLOCKED | chicory, pecorino | DOUGH_VARIANT | MECHANIC_INTERPRETATION, UNRESOLVED_INGREDIENT |
| 69 | `pizza-puntarelle-pizzadb-p8` | ピッツァ・コン・プンタレッレ | ④ | BLOCKED | puntarelle | DOUGH_VARIANT | MECHANIC_INTERPRETATION |
| 70 | `pizza-de-cancha` | ピッツァ・デ・カンチャ | ④ | BLOCKED | — | DOUGH_VARIANT, MULTI_SPREAD_LAYER | UNRESOLVED_INGREDIENT |
| 71 | `pizza-romana-pizzadb-p9` | ピッツァ・ロマーナ | ④ | BLOCKED | — | DOUGH_VARIANT | COMPOSITION_CONFLICT_CANDIDATE |
| 72 | `focaccia-genovese-pizzadb-p10` | フォカッチャジェノヴェーゼ | ④ | BLOCKED | rock-salt | DOUGH_VARIANT | SCOPE_QUESTION |
| 73 | `fugazzetta-pizzadb-p10` | フガゼッタ | ④ | BLOCKED | — | DOUGH_VARIANT | COMPOSITION_CONFLICT_CANDIDATE, DISCOVERY_COLLISION |
| 74 | `fruit-dessert-pizza-pizzadb-p11` | フルーツデザートピザ | ④ | BLOCKED | blueberry, kiwi, strawberry | DOUGH_VARIANT | BASE_SAUCE_UNSPECIFIED |
| 75 | `lahmacun` | ラフマジュン | ④ | BLOCKED | — | DOUGH_VARIANT, MULTI_SPREAD_LAYER | MECHANIC_INTERPRETATION, UNRESOLVED_INGREDIENT |
| 76 | `pizza-de-lomo-saltado` | ロモ・サルタード・ピザ | ④ | BLOCKED | french-fries | PREP_STEP, LATE_ADDITION | BASE_SAUCE_UNSPECIFIED |
| 77 | `teriyaki-chicken-pizza-pizzadb-p14` | 照り焼きチキンピザ | ④ | BLOCKED | mayo | LATE_ADDITION | BASE_SAUCE_UNSPECIFIED, COMPOSITION_CONFLICT_CANDIDATE |
| 78 | `natto-pizza` | 納豆ピザ | ④ | BLOCKED | natto, okra | LATE_ADDITION | BASE_SAUCE_UNSPECIFIED |
| 79 | `black-truffle-pizza-pizzadb-p14` | 黒トリュフピザ | ④ | BLOCKED | truffle | LATE_ADDITION | COMPOSITION_CONFLICT_CANDIDATE |
| 80 | `quattro-stagioni-pizzadb` | クアトロスタジオーニ | ⑥ | READY | — | ZONED_PLACEMENT | — |
| 81 | `scacciata-ragusana-pizzadb-p4` | スカッチャラグザーナ | ⑥ | READY | caciocavallo | ENCLOSE | — |
| 82 | `pizza-fritta-pizzadb-p9` | ピッツァフリッタ | ⑥ | READY | — | FRY_COOK | — |
| 83 | `fugazzeta-rellena` | フガゼッタ・レジェーナ | ⑥ | READY | — | DOUGH_VARIANT, ENCLOSE | — |
| 84 | `montreal-style-pizza-pizzadb-p13` | モントリオールスタイルピザ | ⑥ | READY | — | DOUGH_VARIANT, PAN_BAKE | — |
| 85 | `chicago-stuffed-pizza-pizzadb-p3` | シカゴスタッフドピザ | ⑥ | REVIEW | — | DOUGH_VARIANT, ENCLOSE | — |
| 86 | `trenton-tomato-pie-pizzadb` | トレントントマトパイ | ⑥ | REVIEW | — | STEP_ORDER | — |
| 87 | `new-england-bar-pizza-pizzadb-p6` | ニューイングランドバーピザ | ⑥ | REVIEW | — | DOUGH_VARIANT, PAN_BAKE | — |
| 88 | `pizza-al-taglio-romana-pizzadb-p9` | ピッツァアルタリオローマーナ | ⑥ | REVIEW | — | DOUGH_VARIANT, PAN_BAKE, DOUGH_SHAPE_TARGET | — |
| 89 | `old-forge-style-pizza-pizzadb-p1` | オールドフォージスタイルピザ | ⑥ | BLOCKED | — | DOUGH_VARIANT, PAN_BAKE, DOUGH_SHAPE_TARGET | UNRESOLVED_INGREDIENT |
| 90 | `calzone-pizzadb` | カルツォーネ | ⑥ | BLOCKED | — | ENCLOSE | COMPOSITION_CONFLICT_CANDIDATE |
| 91 | `greek-style-pizzadb` | グリークスタイルピザ | ⑥ | BLOCKED | — | DOUGH_VARIANT, PAN_BAKE | COMPOSITION_CONFLICT_CANDIDATE |
| 92 | `chicago-deep-dish-pizzadb` | シカゴディープディッシュ | ⑥ | BLOCKED | — | STEP_ORDER, PAN_BAKE | COMPOSITION_CONFLICT_CANDIDATE |
| 93 | `siciliana-pizzadb` | シチリアンピザ | ⑥ | BLOCKED | — | DOUGH_VARIANT, PAN_BAKE, DOUGH_SHAPE_TARGET | COMPOSITION_CONFLICT_CANDIDATE |
| 94 | `detroit-style-pizza-pizzadb-p5` | デトロイトスタイルピザ | ⑥ | BLOCKED | brick-cheese | DOUGH_VARIANT, LATE_ADDITION, PAN_BAKE, DOUGH_SHAPE_TARGET | COMPOSITION_CONFLICT_CANDIDATE |
| 95 | `turkish-pide-pizzadb-p5` | トルコピデ | ⑥ | BLOCKED | — | DOUGH_VARIANT, DOUGH_SHAPE_TARGET | UNRESOLVED_INGREDIENT |
| 96 | `pizza-a-caballo` | ピッツァ・ア・カバージョ | ⑥ | BLOCKED | — | DOUGH_VARIANT, ENCLOSE | EVIDENCE_GAP |
| 97 | `feteer-meshaltet-pizzadb-p10` | フェテイールメシャルテル | ⑥ | BLOCKED | condensed-milk, honey, melted-butter | MULTI_SPREAD_LAYER, LAMINATE | BASE_SAUCE_UNSPECIFIED, SCOPE_QUESTION, UNRESOLVED_INGREDIENT |

## 付録 B. 用語

- READY / REVIEW / BLOCKED: matrix の `productDecisionStatus`（READY / READY_WITH_REVIEW / BLOCKED_PRODUCT_DECISION）。
- credited: ladder に数えられるレシピ（`ladderCredit` が false でない）。non-credit は兄弟の step に乗り、新 step を増やさない。
- GAMEPLAY ASSUMPTION: 原典未確認のまま Owner が承認した暫定仕様。
- DH4: Discovery Hint 4.0（演繹ヒント）。OD-DH4-2-9 は「その他」家族を到達不能に保つ決定。
