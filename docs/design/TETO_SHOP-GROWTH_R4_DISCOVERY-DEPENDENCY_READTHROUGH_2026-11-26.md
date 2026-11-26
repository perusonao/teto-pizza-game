# B案再構成 — R4「発見数」依存の読み替え表（Phase 3 前提）

- 作成日: 2026-11-26
- 対象: `main` `828702a6`（Phase 1: PR #903 / #906、Phase 2a: PR #909、Phase 2b: PR #910 まで）
- 位置付け: `TETO_SHOP-GROWTH-RESTRUCTURE_PHASE0-1_DESIGN_2026-11-25.md` §6 R4 の成果物
- 変更範囲: 文書のみ。コード、テスト、データ、Production 既定値は変更しない

## 1. 目的と前提

Phase 3 で厳選メニュー、材料の段階、Lunch Rush / Dinner、ヒント対象を shop モデルへ接続する前に、過去の仕様・Owner 決定・現行コードのうち、Dex の `discovered` 状態またはそこから数えた発見数を進行・解放・判定に使うものを読み替える。

本表では、次を区別する。

- **確定**: Q1〜Q12、R1 / R2、R4 の Owner 承認分、Phase 1〜2b の実装済み仕様から一意に決まるもの。
- **legacy 限定**: shop では判定根拠に使わず、Production 既定が legacy の間と Phase 5 の撤去まで旧モデルにだけ残すもの。
- **要 Owner 判断**: 既存の確定事項だけでは shop の意味を一意に選べないもの。推測で埋めない。

shop モデルの前提は次のとおり。

- 進行・材料解禁の軸は累積評判。章下限は 0 / 40 / 110 / 210 / 340。
- 表示上の称号ラダーは、見習い 0 / 駆け出し 15 / 一人前 40 / 職人 110 / 達人 210 / 匠 340。駆け出しは表示だけで材料段階を開けない。
- メニューは `(初期付与 ∪ granted ∪ Dex discovered) ∩ MENU_CATALOG`。新規開始時はマルゲリータを 1 品付与する。
- メニュー開発の対象とヒント対象は採用集合に限定する。不採用品の完全一致はオリジナルピザ扱い。
- Pizza Select は報酬なしの練習。Lunch Rush / Dinner は存続し、候補集合だけをメニューへ読み替える。
- 発見条件、matcher、Dex の BEST / ★ / timesMade、研究・ヒントで既に保存済みの ledger は維持する。

## 2. 読み替え表

「R4 #」は本表で固定する項目番号である。Owner から承認済みと指定された **#1・#2・#5・#6** は「確定」として記録する。

| R4 # | 過去の決定・現行依存 | shop モデルでの読み替え | legacy / 保存データ | 状態・根拠 |
|---:|---|---|---|---|
| **1** | `ladderCredit` が false のレシピは、発見しても `creditedDiscoveredCount` を増やさず、材料ラダーを進めない。過去の各 Batch の「新材料なし＝non-credit」判断を含む | `ladderCredit` を **shop の進行、評判、メニュー採否、ヒント対象の判定には使わない**。採用品はメニュー開発でメニューに入り、通常営業等で得た評判だけが材料段階を進める。採否は `MENU_CATALOG`、評判は `shop.reputation` が権威 | `ladderCredit` と credited count は legacy 限定。既存データは価格順・legacy 回帰・Phase 5 撤去判断のため残す | **確定（R4 承認済み）**。C1、Q4、R1 と整合 |
| **2** | OD-420-1: goat-cheese は累計 120★、spinach は 130★に加え、各ラダー段到達を要求する `starGate` | shop では独立した累計★ゲートを置かず、両材料を割り当てた材料段階の **評判ゲートへ吸収**する。具体的な段階は Phase 3 の材料章割当で決める | OD-420-1 と `meetsStarGate` は **legacy 限定**。解放済み ledger の union（再ロックしない）は両モデルで維持 | **確定（R2 / R4 承認済み）**。設計 §6 R2 |
| 3 | Discovery Ladder の段 `s` は credited 発見数 `>= s` で到達し、`resolveMaterialUnlocks` が材料を解放する | 材料解放は `REPUTATION_TABLE.chapterFloors` と Phase 3 の材料段階割当から導出する。既存 `unlockedForShopIngredientIds` との union を取り、再ロックしない | 発見数による段到達と ladder の解放用途は legacy 限定。ラダー順は価格帯の出所として残す（R1） | **確定**。C1、R1、設計 §2.1-B |
| 4 | `LATE_ENTITLEMENT_FLOORS` は late 材料を固定の credited 発見数で解放する互換床 | 採用 60 品が使う late 材料も通常材料と同じく、Phase 3 の材料段階割当に吸収する。採用品が使わない材料は shop の obtainable / offer 対象にしない | floors は legacy 限定。既に解放済みの材料は union により維持 | **確定**。設計 §2.1-B / R3。ただし個々の材料段階は厳選確定後に決まる |
| **5** | OD-H5-M2 は Hint 5.0 の当時の全対象（all 25）を一括で同じ ladder UI に載せる。現行 Hint / Research は `RECIPES` と未発見状態から対象を作る | 対象集合の「all」は **`MENU_CATALOG` に採用された全レシピ**へ読み替える。未メニュー化の採用品だけをメニュー開発・Hint 5.0 / selectable hint / Research の対象にする。不採用品は完全一致してもオリジナル扱い、ヒント対象外。Hint 5.0 の rung、価格、privacy、保存済み facts の規則は変更しない | 当時の「all 25」および全 `RECIPES` 対象は legacy 限定。保存済み hint / research ledger は削除・変換しない | **確定（R4 承認済み）**。Q4、C3、OD-H5-M2 の「混在させない」意図を採用集合内で維持 |
| **6** | legacy の章は鍵材料の ladder 価格帯から計算し、`chapterProgress` / `isChapterCleared` は Dex 発見数・全発見で判定する | 解放段階は `MENU_CATALOG.chapter`（1〜5）と評判下限で決める。段階内の進捗を表示する場合は **採用集合のメニュー化済み数 / 採用品数**。店の主進行表示は Phase 2b の称号ラダーを使い、legacy の「第○章」は出さない | ladder 価格帯由来の章、late 除外の章クリア印は legacy 限定。Dex の収集表示は Dex として残せるが shop の解放判定には使わない | **確定（R4 承認済み）**。Q12、R1、Phase 2b の称号決定。段階内進捗 UI を実際に残すかは #14 |
| 7 | Lunch Rush の開始可否・注文プールは、発見済み ∩ 所持 / 調理可能 ∩ 非 SOLD OUT ∩ `lunchRush !== false` | 「発見済み」を `activeProgressionModel().menuRecipeIds(...)` に置換する。すなわち **メニュー ∩ 調理可能 ∩ 非 SOLD OUT ∩ Lunch Rush 参加可**。run 報酬とランキング ID `lunch-rush-v1` は変更しない | 現行の Dex 発見済みプールは legacy 限定 | **確定**。Q8 |
| 8 | Dinner の `ALL_TARGETS_DISCOVERED` は全 target の Dex 発見済みで解放し、未発見数を表示する | 全 target が **メニューにある**とき解放する。残数は「未メニュー target 数」。mission 定義、段階報酬、target 自体は変更しない | `ALL_TARGETS_DISCOVERED` という識別子と Dex 判定は legacy 限定。shop 用表示は「あと N 品メニュー開発」 | **確定**。Q8、Phase 2b は文言だけ先行済み |
| 9 | Dinner 中に未発見レシピを作ると `ORIGINAL` とする `dinnerResultDetection` | shop では「採用され、かつメニューにある target / non-target」を既知として扱い、**未メニューまたは不採用の完全一致は ORIGINAL** とする | Dex に発見済みでも不採用品なら shop では ORIGINAL。legacy の発見判定は維持 | **確定**。Q4 と Dinner の候補＝メニューへの読み替えから一意 |
| 10 | 技法 affordance は材料の ladder step と credited 発見数を比較する。no-sauce の OD-TQ1D-2 も step 12 を credited 発見数で開く | `ProgressionModel.isMaterialReached` で、その技法に必要な材料が **評判による材料段階で解放済みか**を判定する。技法そのものの発見経路・`discoveredTechniqueIds` は変更しない | credited 発見数との比較と OD-TQ1D-2 の step 12 部分は legacy 限定 | **確定**。C1、設計 §2.1-A。個別技法と材料の対応は現行対応を維持 |
| 11 | `materialOffer` の価格帯と legacy 章はいずれも ladder step から導出される | 解放条件だけを評判段階へ移す。**価格は従来の ladder step / T1〜T4 を使い続ける**。価格と解放段階の不一致を許容する | ラダーは価格 authority と legacy 解放のため残る | **確定**。R1 Owner 了承 |
| 12 | `obtainableIngredientIds` / `ingredientCollectionCount` の分母は、ラダーが販売する材料集合 | shop の分母・Shop 対象は **採用 60 品が使う有限材料 ∪ 常備材料**。材料段階未到達でも分母には含め、入荷時期は評判段階で決める | legacy はラダー材料集合のまま | **確定**。Q4、設計 §2.1-B |
| 13 | 材料入荷通知は、発見後に発見数ラダーを進めた RESULT で出る | 注文・メニュー開発で評判が閾値をまたいだとき、開いた材料段階の新規材料を通知する。既存 entitlement との union 後に、本当に新規の材料だけを通知する | 発見直後の通知は legacy 限定 | **確定**。C1、Phase 2a の評判加算、設計 §2.1-B |
| 14 | Dex / Pizza Select の chapter count と ✓ は、章内の発見数と late 除外の全発見で表示する | shop の主表示は称号で確定しているが、**Dex 内に 5 段階別の「メニュー x/y」や完了印を残すか、Dex は純粋な収集記録として全カタログを見せるか**は既存決定から一意でない | 解放判定には使わない。legacy 表示はそのまま | **要 Owner 判断**: (A) shop Dex は採用 60 品だけを段階別表示、(B) 全 Dex を収集記録として残し段階表示を外す、のどちらか。Q4 の「不採用はオリジナル」と Dex の収集目的の境界を決める必要がある |
| 15 | Home の「発見 x/y」、初回発見前 bubble、Lunch Rush の「まず 1 枚発見」などが Dex 数を読む | 主進行は評判＋称号、収集はメニュー数へ分離する。shop の開始条件は初期付与マルゲリータを含む **メニュー数**を使い、Dex 0 を進行ロックに使わない | Phase 2b では文言だけ「開発」に変更済みで、判定・分母は未変更の箇所がある | **確定**（Q2、C1）。ただし Dex カードの分母は #14 に従う |
| 16 | Dex 0 のマルゲリータだけ Hint を無料にする `isHintOnboardingFree(discoveredCount === 0)` と、`preDiscoveryFreeCookAttempts` による無料・誘導 | shop は新規開始時からマルゲリータがメニューに付与されるため、(a) Dex 0 をそのまま残す、(b) メニュー数 1 を「オンボーディング中」とみなす、(c) 無料ヒントを退役、で挙動が異なる | 現行 Dex 0 条件は legacy では維持 | **要 Owner 判断**: Q2 の初期付与後もマルゲリータ Hint を無料にするか。無料を残すなら `Dex 0 && target=margherita` の legacy 意味を「shop 開始時かつ margherita」へ明示的に読み替える必要がある |
| 17 | Research Entry / Discovery State は、未発見で、材料が使用可能なレシピを候補にする。研究ラベルの cohort は材料解禁順に依存する | shop では候補を **未メニューの採用品 ∩ 現在の材料で調理可能**に限定する。Research Contract 2.1、匿名性、cohort letter、否定 ledger、情報漏れ防止は維持する | 全 `RECIPES` を候補にする経路は legacy 限定。既存 ledger は維持 | **確定**。Q4、C3、R6 |
| 18 | 発見数を入力にした legacy 経済シミュレーション、dev seed、star state、回帰テスト | legacy 回帰用として残し、shop は評判・採用メニュー・材料段階を入力にした別 fixture / simulation を持つ。legacy fixture を shop の期待値へ書き換えない | Phase 5 で撤去対象テスト一覧を提示し Owner 承認後に移設 / 削除 | **確定**。Q11 |

## 3. 「発見」だが進行読み替えの対象外

次は `discovered` に関係するが、「発見数を進行・解放・判定の前提にする」依存ではないため、shop でも意味を維持する。

| 項目 | shop で維持する意味 |
|---|---|
| Dex `discovered` | 採用品のメニュー開発完了と、Dex の記録。メニュー導出の入力の 1 つ |
| matcher / Completion Gate | 完全一致で同定する条件は変更しない。採用品かどうかで結果の行き先だけを分ける |
| BEST / ★ / timesMade | 収集・成績記録として維持。shop の材料解放には使わない |
| `discoveredTechniqueIds` | 技法発見 ledger と技法発見表示は維持。「新しい調理法を発見」はメニュー開発への文言置換対象外 |
| hint facts / purchases / research exclusions | 保存済み ledger を変換・削除しない。対象集合の入口だけを採用品へ絞る |
| `unlockedForShopIngredientIds` | 両モデル共有の monotonic ledger。shop 切替で再ロックしない |
| Pitz 初回発見 +50 | shop では「メニュー開発ボーナス +50」に名称変更済み。採用品の初回メニュー開発にだけ適用 |

## 4. Phase 3 に渡す実装境界

Phase 3 は、本表を次の境界で実装する。

1. `MENU_CATALOG` と材料段階割当を SSOT とし、採用品・章・材料の到達可能性を gate で固定する。
2. Lunch Rush / Dinner / Hint / Research は、それぞれ独自に Dex を読むのではなく、同じ shop のメニュー集合を入口にする。
3. 材料解放、技法 affordance、入荷通知は同じ評判段階を読む。`ladderCredit`、starGate、late floor を shop 側へ混ぜない。
4. legacy のコード・テスト・識別子は Phase 3 で撤去しない。Phase 5 の Q11 手順まで回帰 authority として残す。
5. #14 と #16 は Owner 判断が確定するまで仮実装しない。既存の確定事項と衝突する案を既定値にしない。

## 5. 参照した authority / コード

- 設計・確定事項: [`TETO_SHOP-GROWTH-RESTRUCTURE_PHASE0-1_DESIGN_2026-11-25.md`](./TETO_SHOP-GROWTH-RESTRUCTURE_PHASE0-1_DESIGN_2026-11-25.md) §0、§2、§3、§6
- 過去決定: [`PROJECT_HANDOFF.md`](../PROJECT_HANDOFF.md)（OD-H5、OD-TQ1D、各 Expansion Batch、Discovery / Research / Dinner の記録）
- Hint 5.0: [`TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md`](./TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md)（OD-H5-M2、privacy、価格、保存 facts）
- 発見数ラダー・starGate: `src/logic/discoveryLadder.ts`、`src/data/discoveryLadder.ts`、`src/state/materialEntitlement.ts`
- late floors: `src/data/lateCatalog.ts`
- 章: `src/state/recipeChapters.ts`
- Lunch Rush / Dinner: `src/mission/lunchRush.ts`、`src/mission/dinner/dinnerMission.ts`、`src/mission/dinner/dinnerResultDetection.ts`
- Hint / Research: `src/state/discoveryHint.ts`、`src/logic/discovery/hint5Ladder.ts`、`src/logic/discovery/selectableHint.ts`、`src/logic/discovery/researchEntry.ts`
- 技法: `src/logic/techniques/runtime.ts`、`src/logic/techniques/registration.ts`
- shop 進行・称号: `src/logic/progression/shopProgression.ts`、`src/logic/progression/reputationTable.ts`、`src/logic/progression/shopRank.ts`

## 6. Owner 判断欄

| 項目 | 判断 |
|---|---|
| #14 shop の Dex / 段階別進捗表示 | **要 Owner 判断** |
| #16 shop 開始時のマルゲリータ無料 Hint | **要 Owner 判断** |

この 2 点以外は、本表の「確定」に従って Phase 3 の実装仕様へ落とせる。判断により既存の Q1〜Q12、R1 / R2、R4 承認分、評判値、称号ラダーと矛盾する変更が必要になった場合は、本表を上書きせず、該当行に新しい Owner 決定と日付を追記する。
