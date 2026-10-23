# 本番解禁監査 — FINISH（後乗せ）とグランマピザ（四角い生地＋2 ソース）（docs-only）

Status: **監査のみ。** `src/**`・`e2e/**`・workflow・データ・CSS は変更していない。新規 claim・Issue・実装 PR・merge・CI 再実行・Preview / Production 操作は行っていない。#639・#640 には触れていない（一覧で題名を見ただけで、本文・差分は未読。§7 に影響の可能性だけ記す）。
基準 `main` = `3570f44`（2026-10-24 05:11 JST）。監査日 2026-10-23。
**「推奨」は助言であり Owner Decision ではない。未回答を承認済みとみなさない。** 「推定」と書いた箇所は私の見積りで、事実ではない。

## 0. 結論（先に）

| | FINISH（ikura 1 件を出す） | グランマピザ |
|---|---|---|
| コードの残り | **ごく小さい**（本番スイッチ 2 個を `true` にし、その 2 本の「OFF を固定するテスト」を意図的に反転する 1 PR） | **大きい**（レシピ行・発見 target・四角の Reference / 採点（D4）・gate 許可リスト・Research 文字変更・全面再実行） |
| 止めているもの | **コードではなく証跡と Owner 判断**（AC-8 の ON ビルド実測＋動画、実機 HV、Q-5、G-3、R8 実機 HV の残り） | **原典確認（Design Lock §8-1、E をブロック）**＋ D4 未実装 ＋ OD-544-1/2/8 未実施 ＋ 四角の実機 HV 未了 |
| プレイヤーが得るもの | 1 レシピ（ikura）＋1 食材（salmon-roe）＋技法「後乗せ」＋ Free / Research の「仕上げ」タブ | 1 レシピ（グランマ）＋技法「天板焼き」＋ ○/□ 切替 |
| 推奨順 | **FINISH 先行**（§6） | 後続 |

最短の公開順（§8）: ① Owner 判断 5 件 → ② V1 ON ビルド実測と動画（AC-8 / Q-5） → ③ iPhone Safari 実機 HV（FINISH＋R8 残り） → ④ E5 PR（2 リテラル反転） → ⑤ 並行してグランマの原典確認と D4 を解く → ⑥ グランマ E。

## 1. 実装済み / 未実装 / 本番 OFF の区別

### 1.1 FINISH（後乗せ）

| 区分 | 項目 | 根拠（main の事実） |
|---|---|---|
| **実装済み・本番 OFF** | FINISH 画面・トレイ・↩/完成・統合（FIN-A〜D） | #600〜#603 |
| 同 | D2-2 後乗せレイヤーを焼成フィルターから分離（#518 案 b）、F-1〜F-3 | #588・#593・#596・#599。動画 HV と原因調査 #591 |
| 同 | late 軸の識別・技法「後乗せ」・near-miss、Free / Research の FINISH 工程と UI、phase 契約 | #606・#607・#609・#610 |
| 同 | 後乗せカタログの単一合流点（**案 1 = ビルド時定数**で OFF 時は従来とバイト同一） | #615。`src/data/lateCatalog.ts:31` `LATE_CATALOG_PRODUCTION = false` |
| 同 | ikura（`ikura-salmon-pizza`・`salmon-roe`・late step・taxonomy・art・UD-G 文言） | #627（`db6e360`）。cream-cheese 2 / salmon 3 / salmon-roe 2 `POST_BAKE` / shiso 1 `POST_BAKE`、NO_SAUCE、CUT なし、`lunchRush:false`、bake 58–78 |
| 同 | R8 `pendingRound`（在庫消費と登録を同一保存）、Lunch Rush E2E | #618・#641。FINISH ON の前提（#617） |
| 同 | K2（章の ✓ 判定から後乗せカタログを除く。ON 時も既存の ✓ を維持） | #637 |
| **本番 OFF の実体** | スイッチは **ソース上のリテラル 2 個のみ**: `LATE_CATALOG_PRODUCTION`（`lateCatalog.ts:31`）と `FREE_COOK_FINISH_PRODUCTION`（`freeCookFinishGate.ts:13`）。環境変数・Remote Config 経路は無い | コード確認 |
| 部分的 | Preview での確認手段: `?freeFinish=on` は FINISH 工程だけを開く（`freeFinishPreview.ts`、本番ビルドは query 名ごと除去）。**後乗せカタログは Preview からは ON にできない** → ikura は共有 Preview に存在しない | コード確認。#633 §11 も同じ結論 |
| **未実装** | BBQ チキン（原典確認まで保留。#621 Owner 決定） | #611 |
| 未実装 | DRIZZLE（液体の後乗せ・仕上げソース）| #579 |
| 未実装 | 後乗せを含む暫定スコアの UI 表示 | #495（「本番で後乗せを有効化する時」が着手条件。§2 の C-9 で扱う） |
| 未実装 | late step 番号の方針（G-3） | 現状は「通常 ladder 長 + 1」を導出（#634 が step 55 を使ったので ikura の late step は今 56 になる）。追記ごとに +1（既到達は不変） |

### 1.2 グランマピザ

| 区分 | 項目 | 根拠 |
|---|---|---|
| **実装済み・本番では到達不能** | A 形状基盤（`PanShape` / `Recipe.panShape?`、**どのレシピも未設定**） | #541 |
| 同 | B タップ・長押し、C 四隅ドラッグ・STEP1/2・完成判定、D1 ソース・配置、D2-a2 工程接続、D2-b1 焼成、D2-b2 えぐれ・側面 | #545・#546・#558・#563〜#576・#573・#582 ほか（Result 群） |
| 同 | F1 `pan` 軸 OBSERVED 化、F2 技法 `tray`（天板焼き）、F3 RESULT 中立文言、F4-a/b ○/□ 切替（**要求レシピが 0 件の間は affordance が閉**） | #547・#548・#553・#555・#566 |
| 同 | 複数ソースのエンジン（B1/B2）、S1 オイル重ね（係数 0.3）、S2 `buildHintLine` 全ソース対応 | `sauceDisplay.ts:317`、`hints.ts:160`、`hints.multiSauce.test.ts` |
| **未マージ** | #581 AB-min（四隅 4/4・STEP1 未完了で「すき間をうめよう」） | open PR。判定・閾値は不変 |
| **未実装** | **グランマのレシピ行**（`grandma-pizza`）— main に存在しない（`recipes.ts` はコメントのみ） | grep |
| 未実装 | **D4 = 四角の Reference と Scoring 2.0 / ソース指標**。`computeSquareSauceMetrics` は定義とテストのみで本番経路に未接続。四角用 Reference（円の 8 スロットは流用しない）は未設計 | D1-b / D2-a2 Result「D4 は E まで保留」 |
| 未実装 | `PAN_TRAY_RECIPE_IDS` の共有定数化（OD-544-1）。現状は `deductionProduction.gate.test.ts:128` と `hint5Production.gate.test.ts:325` に**別々の空配列** | grep |
| 未実装 | DH4 sweep の `GATE_STATES` への pan ○/□ 追加と再実行（OD-544-2）、Anti-Oracle §15 の複数ソース前提での再計算（OD-544-8、E の Final Gate 前に必須・未実施） | Anti-Oracle 2.1 §15 の 2026-10-18 追記 |
| 未実装 | Research の cohort 文字変更（marinara `-`→A、grandma=B）と validator allowlist（OD-544-6）、約 35〜40 件のテスト更新 | #540 本文・#521 コメント |
| **保留（本番に出さない）** | #540（丸い grandma。Draft HOLD・マージ禁止。D3 により公開禁止） | |

## 2. 本番公開を阻む条件の一覧

### 2.1 FINISH（E5）

| # | 条件 | 状態 | 種別 |
|---|---|---|---|
| C-1 | **AC-8**: ON ビルドで後乗せ `salmon-roe` を 3 状態（raw / perfect / burnt）再測定し、**動画（390×844）を Owner が #621 に添付**し、commit SHA・環境・SHA-256・結果を記録。証跡確認まで PASS にしない | 未実施 | 証跡（Owner 動画） |
| C-2 | **Q-5** リング上限。R-A（総数 8 以内、後乗せ専用上限なし）は**検証用の暫定**。ikura は後乗せ 3 / 8 で実測済み。ikura だけを出すなら 5 ピースの実測は E5 に不要（Pinsa L2 用） | 未決 | Owner 判断 |
| C-3 | **G-3** late step 番号（案 A 導出のまま / B ON 中は通常 batch 凍結 / C 番号帯予約） | 未決。#634 で実際に +1 が起きた | Owner 判断 |
| C-4 | **iPhone Safari 実機 HV（動画必須）**。V1（Chromium 録画）は代替にならない | 未実施 | 実機（Owner） |
| C-5 | **R8 の実機 HV の残り**。実機で確認できたのは B-1 の一部のみ（CUT 中の強制終了後に登録され `timesMade` 2 回）。**復旧通知の表示は未確認**（出ていなかった可能性が排除できない）、B-2・D-1・C・E・F・G・H は未実施。#617 は「FINISH 本番 ON の前提に R8 を含める」 | 一部のみ | 実機（Owner） |
| C-6 | 専用の ON 検証環境 **V1**（使い捨て作業ツリー・Firebase なし・`127.0.0.1`・新規コンテキスト。安全条件 6 項目）での実施 | 方針は採用済み（#621 第 3 弾）。実施前 | 作業（セッション） |
| C-7 | E5 PR が**意図的に反転する 2 本のテスト**: `freeCookFinishGate.test.ts:16`（`FREE_COOK_FINISH_PRODUCTION === false`）、`lateCatalog.offGolden.test.ts:28`。OFF の 4 面 golden と `finishD2Inert` は**緩めず**、ON 用の golden を別に追加する形にする（OFF 経路を関数引数で残す等）。「緩和ではない」ことを PR 本文で示す | 未着手 | 設計制約 |
| C-8 | ON ビルドの E2E（現状「ON の E2E 0 本」）。両 viewport・Chromium＋WebKit。既知 flake（#394 系）はマスクしない | 未着手 | 作業 |
| C-9 | **#495**（後乗せを含む暫定スコア）。ikura は失敗ラウンドでのみ暫定値が表に出て、その値が正しい最終値という整理。UI に出さない限り不要とも読めるが、着手条件に「本番で後乗せを有効化する時」とあるため、**Owner に不要と確認してもらう**（私の判断では閉じない） | 未確認 | Owner 判断 |
| C-10 | 原典の根拠表記: roe・shiso のみ個別ページ引用、salmon・cream-cheese の焼成前は**暫定（原典確定ではない）**。#587 の出所整合は merge 条件ではないが Result の根拠欄に関係 | 暫定採用済み（Q-1） | 記録 |
| C-11 | #633（Draft docs。E5 前ゲートの追跡文書）が未マージ。方針は #621 コメントに Owner 判断として残っているため、E5 の障害ではないが、E5 PR 前に docs の置き場を決める | open | 整理 |

**ブロッカーではないもの（確認済み）**: UD-F（ikura のデータ）は #627 で出荷済み。UD-G（名称「後乗せ」/ D1 / R1）は 2026-10-22 に Owner 確定・`techniques.ts` 反映済み。本番 OFF 方式は案 1 で確定・実装済み。#584 は閉じ（#632 で証跡保全）、旧 step 55 は不採用で、step 55 は #634（New Sauces）が使用 → #584 との ladder 順序問題は消滅。R8 の実装は merge 済み。

### 2.2 グランマピザ（E = #521）

| # | 条件 | 状態 | 種別 |
|---|---|---|---|
| G-1 | **Design Lock §8-1 pizzadb.jp 原典確認**（食材・オイルの焼成前後・天板形状）。Owner 決定で **E をブロック**中。このセッションからは取得不可（過去セッションは 403） | 未了 | Owner |
| G-2 | **D4 四角の Reference と採点**（`computeSquareSauceMetrics` を採点に採用するか、別の暫定仕様か）。未設計・未実装。「新規基盤開発を前提にしない」制約と衝突する最大の項目 | 未着手 | 設計＋実装（大） |
| G-3 | E の実装一式: `recipes.ts` 行（`panShape:"square"`・個数・bake 窓は暫定）、発見 target（`pan:"tray"` の名前付き例外が `discoveryCatalog.test` に要る）、`ladderCredit:false`・`lunchRush:false`・CUT なし、`orders`・`recipeHintRoles`・`recipeSauceProfiles`（主=tomato） | 未着手 | 実装 |
| G-4 | OD-544-1（`PAN_TRAY_RECIPE_IDS` 共有定数、E の最初の commit か F2 前）、OD-544-2（複数ソース例外と INV-TQ-4 allowlist を `grandma-pizza` に限定し、`GATE_STATES` に pan ○/□ を追加して**全再実行・状態数を Result に記載**） | 未実施 | 実装 |
| G-5 | OD-544-8: Anti-Oracle §15 の複数ソース前提での再計算（**E の Final Gate 前に必須**） | 未実施 | 監査 |
| G-6 | OD-544-6: validator allowlist（marinara `-`→A）と、Research 候補 1→2 件によるテスト約 35〜40 件の更新（HOME 直行→選択画面を含む）。E2E 候補: `discovery-research-dex.spec.ts:56` ほか静的 grep の 6 本 | 未実施 | 実装 |
| G-7 | affordance step の再導出（暫定 14。ladder が 55 step になった今は値が変わりうる）。**新しい ladder step は追加しない**方針 | 未実施 | 実装 |
| G-8 | **#519 の表示回帰条件（§5）** | 未実施（四角版） | テスト |
| G-9 | 四角ラウンドの**実機 HV**: D2-b1 / D2-b2 / #576 の perfect glow は「実機未確認」と各 Result に記載。#566 の HV で出た「輪郭・えぐれ」所見は D2-b2 で対処済みだが再確認していない | 未了 | 実機（Owner） |
| G-10 | #581 AB-min は未 merge（Preview 限定の UX 改善）。STEP 2 が一筆で通過しやすい件は**別設計・Owner の追加承認待ち**（判定・難易度は未変更）。「簡単すぎる」ままグランマを出してよいかの判断 | open | Owner 判断 |
| G-11 | Research 2.0 の 53 件導入前再監査（#544）は 2026-10-18 に本番 57 recipe で実施済み（cohort 文字・INV-B7 問題なし）。ただし**複数ソース前提の §15 再計算は G-5 として別** | 一部済 | — |
| G-12 | 未回答の Design Lock §8 は 8-1 のみが E をブロック。8-2〜8-8 と RESULT 文言（RESULT「見直して」/ Research G2「工夫して」は併存で確定）は決定済み | — | 記録 |

## 3. FINISH の最小差分（食材・レシピ追加と再利用範囲）

### 3.1 ikura 1 件だけを出す場合（推奨）
- **追加データ: 0。** 食材・レシピ・ladder・taxonomy・art・技法文言は全て #627 で main にある。残るコード変更は **E5 PR 1 本**: 2 リテラルを `true` にし、C-7 の 2 テストを意図的に反転し、ON 用 golden と ON の E2E を追加する。
- 再利用できるもの: FINISH 工程一式（A〜D・E3）、後乗せレイヤー（D2-2）、late 識別・near-miss（E2）、R8、K2、`validateLateCatalog` / `validateLadderProgression` ほかの構造検査（ON で空になることがテスト済み）。
- 画面側の変化: Free Cooking / Research に常設の「仕上げ」タブが出る（UD-B）。**全プレイヤーの Free / Research が対象**で、後乗せを使わないラウンドの挙動（6 タブ・保存・R8 窓）が ON 時に変わる点が最大のリスク面（§6）。

### 3.2 食材・レシピを増やす場合（今回は不要）
- 後乗せの新レシピ 1 件の最小差分は #627 と同形: `LATE_RECIPES` / `LATE_INGREDIENTS` / `LATE_DISCOVERY_TARGET_IDS` / `LATE_LADDER_STEPS`（番号は書かない）＋型で強制される表（`recipeSauceProfiles`・`recipeHintRoles`）＋ taxonomy 行＋ art。**既存食材だけ**で組めるなら食材追加は不要。
- BBQ チキンは bbq-sauce（新ソース）と cilantro（新食材）が要り、原典確認まで保留。**ikura と同時に出さない。**
- Pinsa（#577）はこのカタログを共有する（L2 は後乗せ 5 ピース）。E5 後でないと存在しない。**E5 は Pinsa を待たない**（ikura で E5、Pinsa は E5 後の P3）。

## 4. グランマの必須要件・Research・Hint 5.0・DH4・原典未確認の代替

### 4.1 四角い生地の解禁条件（現行の決定）
- 天板は**技法「天板焼き」（`tray`）として一般解放**（Shop 購入は不採用）。解放条件は U1 = 要求レシピの材料が makeable になる最初の ladder step から**導出**（番号を直書きしない・`ladderCredit:false` はカウントしない・要求レシピ 0 件の間は閉＝本番では閉）。
- 技法の**発見条件**: 解放済みで正式な `pan:"tray"` の調理を完了したとき（グランマの発見は不要・Preview クエリだけでは発見にならない）。
- 丸い調理では正確な材料でも ORIGINAL（Dex・BEST・Pitz・★・新発見なし）。四角＋tray＋完成判定 PASS ⇒ UNIQUE_MATCH。AC1・AC2・AC3・AC4・AC8（`pan:tray` を持たない grandma が main に存在しない）は E の正式受け入れ条件。
- **丸い grandma の先行公開は禁止（D3）。**

### 4.2 2 ソースの必須要件
- 構成: tomato-sauce 1 / olive-oil 1 / mozzarella 3 / garlic 2（個数・bake 56–76 は**暫定**）、副ソースは「使用の有無」のみ（presence）。主ソース=tomato。
- 実装済みの前提: エンジン対応、S1（oil 重ね 0.3）、S2（ヒント全ソース対応）。完成判定は油なし=FAILED（実測）。
- 未了: 2 ソース用 gate 許可リスト（`grandma-pizza` 限定、双方向 equality）、Hint 5.0 の SAUCE 段が**両ソースを名指し**（OD-544-3 で確定）、複数ソース技法（TQ-3）より先に出す（確定）。

### 4.3 Research・Hint 5.0・DH4 の変更箇所（E の PR で触る面）
| 面 | 変更 |
|---|---|
| Research | cohort（step 14 で marinara と同コホート）: marinara `-`→A、grandma=B。HOME 直行→選択画面。テスト約 35〜40 件。「発見できない B」が技法解放前に Research に出る点は Owner 許容済み（候補フィルターは追加しない） |
| Research 共通ヒント G2 | 「材料だけでなく、生地の形や調理法も工夫してみよう。」を全 target 共通で固定。**OD-544-7（購入ゼロ〜全購入の timing parity テスト）は F4 の受け入れ条件として「未実装」と記録されている** — 今の main で実装済みかは**私は未確認**。E 着手前に確認が必要 |
| Hint 5.0 | `hint5Production.gate.test.ts` の tray allowlist に `grandma-pizza` を追加し、ladder に technique 語が出ないことを assert。golden は追記専用 |
| DH4 | `deductionProduction.gate.test.ts`: `GATE_STATES` に pan ○/□ を足して sweep を再実行、allowlist 化、状態数を Result に記載 |
| Anti-Oracle | §15 の複数ソース前提の再計算（G-5）。Result と §15 の注記を更新 |
| RESULT | 中立文言「材料だけでなく、生地の形や調理法も見直してみよう。」は F3 で実装済み（ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH で同一） |

### 4.4 原典未確認事項と、代替のゲーム仕様（提案。決定ではない）
| 未確認 | 現状 | 代替の案（Owner 判断で採否） |
|---|---|---|
| オイルが焼成前か後か | 証跡に記録なし | 既存 9 の油レシピと同じ**焼成前の PAINT_TEMPORARY**として扱い、**説明文は時点を断定しない**（#521 設計と同じ）。後乗せ（FINISH）には載せない（確定: 新 FINISH なし・液体対応は #579 で別） |
| 天板形状（正方形か長方形か） | 未確認 | ゲーム内は**正方形（半辺 44）**で固定し、Result / Dex に「原典の形状は未確認の暫定」と記録。形状を原典主張として文言に出さない |
| 生地・個数・bake | 未記録・暫定 | ikura の先例（Q-1: 暫定採用を明記すれば出荷可）に倣い、**個数・bake を GAMEPLAY CALIBRATION と明記** |
| 上記を Owner が受け入れる場合 | §8-1 の「E をブロック」を**明示的に解除**する必要がある | 私は解除しない。推奨は「原典確認を待つ（G-1）」か「暫定採用＋表記の義務化」のどちらかを Owner が選ぶこと（§7 の O-6） |

## 5. #519 の表示回帰条件

- #519 の実体: **データ消失ではなく**、油 canvas の CSS フィルター（saturate 2.1 等）で重なり部が不透明な黄緑になり、tomato → oil で tomato が見えなくなる（`r−g` 132→30）。S1 で係数 0.3 に変更済み（main）。実測 `r−g`=81、oil 単独は不変。**Issue #519 自体は open のまま**（Owner の再現条件は未回答。クローズ判断は Owner）。
- 既存の回帰 E2E: `e2e/sauce-oil-over-519.spec.ts`（390×844 / 360×800、SAUCE→CHEESE→焼成取り出し→RESULT の**実ページ画素**）。ただし**丸い生地の経路**。WebKit 360×800 の `:142` は境界値 55 vs 55 の既知 flake（#529）— マスクしない。
- **グランマの公開条件（四角版の回帰）**:
  1. 四角天板上で tomato → olive-oil を同一範囲に塗り、SAUCE / CHEESE / BAKE / RESULT の各工程で重なり部に**tomato の赤が残る**こと（丸い版と同基準: `r−g` ≥ tomato 単独の 0.55、oil 単独は dough から ≥30）。
  2. 四角のソース描画は `squareSauceDisplay` / `sauceSurface` の別マスク経路。**S1 の係数が四角経路でも効いていること**を、CSS フィルター後の実ページ画素で検証（canvas 画素を読むだけの検査は #519 で通ってしまった教訓）。
  3. oil→tomato と tomato→pesto は不変。単一ソースの四角描画は byte-identical。
  4. 390×844 / 360×800、Chromium＋WebKit。#529 系はマスクせず別記録。
  5. 焼成フィルター（`.pizza-dough--raw/--perfect/--burnt`、#518 対象）は変更しない。

## 6. FINISH 先行 vs グランマ先行（工数・リスク比較）

工数は**私の推定**（AI セッションのコード作業量。Owner の実機時間・待ち時間は別）。

| 観点 | FINISH 先行（ikura） | グランマ先行 |
|---|---|---|
| コード作業（推定） | 小: 1 PR（リテラル 2 個＋テスト反転＋ON golden＋ON E2E）。実測用の使い捨てパッチは commit しない | 大: G-2〜G-7（D4 の設計と実装、レシピ、gate 全再実行、Research 約 40 テスト、§15 再計算）。複数 PR（§7 の分割案） |
| コード外の待ち | AC-8 動画・実機 HV（FINISH＋R8 残り）・Owner 判断 5 件 | **原典確認（Owner）**・D4 の設計判断・四角 HV（複数回）・#581 / STEP 2 難易度判断 |
| プレイヤー価値 | 1 レシピ＋1 食材＋新技法。ただし Free / Research に常設タブ＝**既存プレイ体験に触れる** | 1 レシピ＋新技法。**操作が新規**（指で押し広げ）でインパクトは大きいが、完成度の不確実性も大きい |
| 主なリスク | ① 全プレイヤーの Free / Research に仕上げタブが出る（レイアウト 360×800・6 タブ）② R8 の実機復旧が未確認 ③ late step が通常 batch ごとに +1（未到達のみ） ④ ON→OFF ロールバック時の既発見データ（テスト済みだが実機未確認） | ① 原典未確認のまま出す問題 ② D4 の採点・Reference を新規に決める＝新規基盤に近い ③ 四角の STEP 2 が簡単すぎる所見が未解決 ④ Research の文字・候補数が全員で変わる（marinara A/B、1→2 候補） ⑤ gate / DH4 の再実行範囲が広い |
| ロールバック | 2 リテラルを `false` に戻すだけ（コード上は単純）。ただし発見済みのセーブの扱いは実機未検証 | 要求レシピの削除でほぼ元に戻るが、Research の文字変更・保存済みの技法発見が残る |
| 既存 Gate の扱い | OFF 固定のテスト 2 本を**意図的に**反転（緩和ではないことを明示する必要） | gate の allowlist を `grandma-pizza` 限定で拡張（緩和でなく限定追加） |
| 推奨 | **先行** | 原典確認と D4 設計を**並行して先に動かす**（実装は E5 後でも間に合う） |

## 7. Owner 判断が必要な項目と推奨案

| # | 判断 | 推奨（助言） | 理由 |
|---|---|---|---|
| O-1 | E5 の範囲を **ikura のみ**（FINISH＋後乗せ 2 スイッチ同時）にしてよいか | ikura のみ。Pinsa（P3）・BBQ・DRIZZLE は E5 に含めない | 追加データ 0 で最小。Pinsa は E5 後 |
| O-2 | Q-5 リング上限: ikura は実測 3 / 8 で足りる。**R-A 暫定のまま E5 を進め、5 ピース実測と正式上限は Pinsa P3 の前に回す**でよいか | 可 | E5 の公開条件から 5 ピース実測を外せる。ただし R-A は検証用暫定のまま残す |
| O-3 | G-3 late step 番号: 案 A（導出のまま）を E5 でも維持 | A | 既到達は不変・未到達のみ +1 と契約化済み。B は通常 batch を止める、C は save / entitlement に触れ別 Issue |
| O-4 | #495（暫定スコア）は E5 に不要と確認してよいか | 不要（UI に出さない限り） | 失敗ラウンドでのみ表に出て、その値が正しい最終値 |
| O-5 | R8 の実機 HV の残りを E5 前に**どこまで**必須とするか（復旧通知の表示、B-2、D-1 など） | 少なくとも B-1 の通知表示、B-2、D-1（3 回強制終了）を E5 前に必須 | 通知が出ない可能性が排除できず、#617 が「FINISH ON の前提」と明記 |
| O-6 | グランマ: §8-1 のブロックを (a) 維持して原典確認を待つ (b) 暫定採用＋表記義務で解除（§4.4） | **(a) 維持**。確認が取れない間も D4・gate を先に進める | 解除は E のブロックを Owner だけが外せる。推測で承認しない |
| O-7 | D4（四角の Reference と採点）の方針: 既存の Scoring 2.0 を**変えない**暫定（例: 四角では Pieces を presence 中心、sauce 指標は丸基準のまま）か、`computeSquareSauceMetrics` を採用するか | 先に**設計 docs（docs-only）で選択肢と Anti-Oracle への影響を比較**してから決める | 「新規基盤開発を前提にしない」に最も反する項目で、決め打ちできない |
| O-8 | #581（AB-min）の merge と、STEP 2 の難易度（別設計）を E 前に解くか | #581 は E 前に merge 判断、STEP 2 は E 前に Owner 承認を取る | 「簡単すぎる」所見のまま公開しない |
| O-9 | #519 のクローズ判断（再現条件は未回答。S1 で解消済みと整理できるか） | 四角版の回帰（§5）が入るまでクローズしない | |
| O-10 | #633（Draft docs）の扱い（merge して置き場を確定するか、E5 PR に畳むか） | E5 前に merge（docs-only） | 方針は #621 コメントにあるため障害ではないが、参照先を安定させる |

## 8. 最小 PR 分割案

新規 claim・実装 PR・merge は**禁止中のため、以下は提案のみ**（Owner 承認後に着手）。#639・#640 は対象外。

### 8.1 FINISH（E5）
| PR | 内容 | HV | 備考 |
|---|---|---|---|
| F-0 | #633 の merge 判断（docs-only）、O-1〜O-5 の記録 | 不要 | |
| F-1（PR にしない作業） | V1 ON ビルド実測（AC-8 / C-1）。使い捨て作業ツリー、**commit・deploy・Preview 更新なし**。動画は Owner が #621 に添付、比較画像のみ `docs/reports/screenshots/<task>/` | 動画必須（Owner へ直接） | 安全条件 6 項目＋停止条件を満たせなければ開始しない |
| F-2 | **E5 PR**: `LATE_CATALOG_PRODUCTION` / `FREE_COOK_FINISH_PRODUCTION` を `true`、C-7 の 2 テスト反転、ON golden、ON E2E（両 viewport・Chromium＋WebKit）、Result Report | **必須（iPhone Safari・動画）** | merge は Owner。F-1・実機 HV・R8 残りが済んでから |
| F-3（任意） | #587 の出所整合、HANDOFF への追記（HOT・Owner 承認後にまとめて） | 不要 | |

### 8.2 グランマ（E）
| PR | 内容 | HV | 備考 |
|---|---|---|---|
| G-0 | 原典確認の結果を docs に記録（Owner 取得。推測しない） | 不要 | **E のブロック解除条件** |
| G-1 | D4 設計 docs（docs-only）: 四角 Reference / 採点の選択肢と Anti-Oracle 影響 | 不要 | O-7 の前提 |
| G-2 | #581 merge（既存 PR、Owner 判断） | 実機 | |
| G-3 | OD-544-1: `PAN_TRAY_RECIPE_IDS` 共有定数化（テストのみ・挙動不変） | 不要 | E の最初の commit にしてもよい |
| G-4 | D4 実装（G-1 の決定どおり） | 必須 | |
| G-5 | **E 本体**: `grandma-pizza` 行・発見 target・gate allowlist 限定追加・GATE_STATES pan 追加と全再実行・Research 文字（validator allowlist）・§15 再計算・四角版 #519 回帰・Result | **必須（四角 DOUGH〜RESULT、丸の回帰を含む）** | G-0〜G-4 完了後。正式な Codex レビュー、WebKit 両 viewport |

## 9. 最短でプレイヤーが体験できる公開順序（推奨）

1. **Owner 判断**: O-1〜O-5・O-10（一度にまとめて回答できる）。
2. **F-1**: V1 実測と動画（AC-8）。同時に Owner が **R8 残りの実機 HV**（通知表示・強制終了反復）。
3. **F-2（E5）** merge → Production 公開: **ikura / 後乗せ / 仕上げタブ**。ここが最初に体験できるもの。
4. **並行（1 の直後から開始可）**: G-0（原典確認）・G-1（D4 設計）・G-3（共有定数）・G-2（#581）。実装は E5 の影響を受けない（`lateCatalog` 以外を触る）。
5. **G-4 → G-5**: グランマ公開。
6. その後: Pinsa P3（E5 後）、BBQ（原典確認後）、DRIZZLE（#579）。

グランマ先行にしない理由: 原典確認（Owner）と D4（設計＋実装）が解けない限り最短にならず、FINISH は残りが**証跡と判断だけ**で、コードリスクが低いため。ただし FINISH は全プレイヤーの Free / Research に触れるため、C-4・C-5（実機）を省略しない。

## 10. 重複確認

- open PR 30 件・open Issue 60 件（上限）を一覧し、さらに「グランマ / grandma / 本番解禁 / E5」で検索（open 11 件）。**FINISH の本番 ON（E5）専用の Issue / PR は存在しない**（追跡は #621）。**グランマの公開専用の Issue も無い**（追跡は #521・#532・#538）。新規 Issue は作っていない。
- 関連 open: #621・#611・#617・#604・#608・#579・#495・#518 / #521・#532・#533・#538・#544・#527 / PR #540（HOLD）・#581・#633（Draft）。**#639・#640** は題名のみ把握（#639 = Guided の生地設定、#640 = late-catalog の `ladderCredit:false` 例外・`discoveryIdentityOf` の生地対応）。後者は `lateCatalog` / 発見 identity を触るため、E5 PR とファイルが重なりうる。**本監査では触れず、重なりの評価もしていない**。E5 着手前に Owner Gate で確認が必要。
- claim: 本監査は claim を投稿していない。#621 の claim（`session_01QBfqm3q2UdhdW9wKhRxy1d`、期限 2026-10-29、PR #627）は #627 merge 済みで実体は終了しているが、release の記録は確認していない。

## 11. このタスクでやっていないこと / 限界

- ブラウザ・ビルド・テストの実行は**していない**。全て main の静的読み取りと Issue / PR / docs の記述に基づく。テスト件数・CI 状態は再確認していない。
- pizzadb.jp は取得していない（環境から不可）。原典に関する記述は Issue / docs の転記。
- Issue の本文・コメントは全件ではなく、決定に関わるもの（#521・#532・#536〜#538・#611・#617・#621・#519・#495）を読んだ。#587・#614・#579・#578・#577 本文・#544 のコメントは未読（#577 は #633 の docs 経由）。
- 工数は推定。HV 結果の語は Owner のもので、本書は PASS / FAIL を書いていない。
