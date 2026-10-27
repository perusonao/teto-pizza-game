# 新工程 Phase 1 実装前検証 — D-1〜D-8 整理・「散らす」評価・仕上げがけ最小範囲・炒め/焼き調査計画・競合確認（docs-only）

作成: 2026-10-27 / 基準 `main` = `47268e3`（#684）/ ブランチ `claude/teto-pizza-cooking-audit-frxevk`
親: `docs/reports/TETO_COOKING-PROCESS-EXPANSION_Fresh-Audit.md`（以下「前回 audit」）
性質: **調査・設計のみ。** `src/**`・`e2e/**`・CSS・データ・テスト・Preview は変更していない。PR 作成・merge・claim 投稿・GitHub への書き込みはしていない。
HV 動画は audit-only のため対象外。「推奨」は助言であり Owner Decision ではない。

---

## 0. 結論（先に）— 前回 audit の推奨を一部撤回する

1. **前回 audit の Phase 1A「散らす（SPRINKLE）」は撤回する。** 検証の結果、タップと十分に違う体験にならない（§2）。
   - xs 食材が必要とするピース数は **1 ストロークの対象になる食材 31 件中 15 件が 1 個、13 件が 2 個、3 件が 3 個**。全 28 レシピを合わせても、ストロークで減らせるタップは**最大 19 回（1 レシピあたり約 0.7 回）**。1 個の食材は「ストローク」と「タップ」を区別できない。
   - 採点の Reference は**固定座標＋半径**（`ReferencePieceGroup.positions` と `matching`、`interaction.family` は型リテラル `"TAP_PLACE"`）。位置が結果に効く食材を「ざっくり散らす」操作は、うまくやるほど不利になる。
   - 最小間隔 9%（`MIN_TOPPING_DISTANCE`、約 26px）は Owner が #476 D4 で「変更しない」と決定済み。振りかけの密度感は出せない。
   - **#476 の D3（Owner 決定）は「SCATTER 新方式は今回実装しない」、D1 は「A（トレイドラッグ統一）の HV 後に B」**。前回 audit はこの Owner 決定を見落としていた。
2. **仕上げがけ（DRIZZLE）の先行は推奨しない。** 別セッションの価値監査（#579 コメント、2026-10-27）は「DRIZZLE が必須な行は確認できた範囲で 0、機構コスト XL、保留を推奨」。さらに本検証で、**線状ピース案（前回 audit の案 A）は Reference モデルが固定点前提のため成立しない**ことがわかった（§3）。先行するなら最小範囲は §3.3 だが、価値が確認できていない。
3. **推奨 Phase 1 = 「下ごしらえ（炒め／焼き）の体験のみ版」を、独立した技術調査（§4、コード変更なし）を通過した後に Preview 限定で試作する。** 食材単位（レシピ単位ではない）の操作で、ピース・保存・採点・識別に痕跡を残さない設計。**調査が No-Go なら、エンジンは変えず content（BBQ・わさび牛）に専念する**のが次善。
4. **競合は小さい。** #679（BBQ）は `lateCatalog.ts`・`ingredients.ts`・`referencePizza.ts`・`App.css` ほかデータ系。下ごしらえの調査・試作は、`ingredients.ts` と `lateCatalog.ts` を触らない設計にすれば重ならない。PR-2（late4）は設計 Gate のみで実装 PR は無い（§5）。

### 0.1 前回 audit の訂正（erratum）

| # | 前回 audit の記述 | 訂正 |
|---|---|---|
| E1 | §12「重複・関連」に #476 / #579 が無い | **#476（食材別 PLACE/SCATTER 操作、Owner 決定 D1〜D9）と #579（DRIZZLE 論点＋価値監査）が最重要の関連 Issue**。見落とし |
| E2 | §9/§10 SPRINKLE を Phase 1A に推奨 | 撤回（§2） |
| E3 | §7.1「P-SPRK のテンポは −2〜4 秒（見込み）」 | 根拠なし。実際の削減はほぼゼロ（§2.1） |
| E4 | §4.1/§4.4「P-DRIZ 証跡あり 17 行」 | `MULTI_SPREAD_LAYER` の required 17 行は**多くが焼成前の第 2 ソース層**で、「焼成後にかける」が必要な行ではない。#579 の分類では焼成後の液体・ペースト記録は L1 の 5 行（READY 1、REVIEW 1、BLOCKED 3） |
| E5 | §3.2「案 A: 線状ピース」を推奨 | Reference が固定点＋半径のため採点で成立しない（§3.2） |
| E6 | 「#620 の Issue」 | #620 は Issue ではなく **PR**（docs-only audit、open） |

前回 audit の冒頭に、本書への訂正参照を 1 ブロック追記した。

---

## 1. D-1〜D-8 の判断表（推奨案と代替案の比較）

前回 audit §11 の D-1〜D-8 を、本検証の結果で再評価した。**「推奨」が前回から変わったものは ▲。**

| ID | 論点 | 推奨案 | 代替案 | 比較の要点（根拠） |
|---|---|---|---|---|
| **D-1** ▲ | Phase 1 の優先 | **(a) 下ごしらえ（炒め／焼き）の体験のみ版を、調査 No-Go でなければ試作**。食材単位 | (b) 散らす（撤回）／(c) エンジン変更なし・content のみ（BBQ → わさび牛）／(d) 並べる補助 | (a): 唯一「レシピ固有性」と「タップと違う操作」を両立（§4）。リスクは状態の置き場と体感の未知。(b): §2 で不十分。(c): 安全だが新しい調理体験は増えない。(d): #476 A / #478 の領域で、ドラッグ統一は今回の目標外 |
| **D-2** | 対象ラウンド | **Guided / Free / Research のみ。Lunch Rush・Dinner は除外** | Dinner を含める | Lunch Rush はランキング公平性（`lunch-rush-v1`）、Dinner は START_BAKE までレシピ未確定（`finishAllowedForRound` と同じ fail-closed）。#476 D2 も Lunch Rush 据え置き |
| **D-3** ▲ | 仕上げがけ | **保留（#579 の保留推奨に合流）。再開条件を明記** | 案 A 線状ピース（成立しない）／案 B 第 2 ソース層（XL）／D0 わさび牛を粒状 topping で（機構なし） | §3。案 A は Reference モデルと衝突、案 B は XL で必須行 0。D0 は「かける」体験ではなく content |
| **D-4** | 結果の採点反映 | **反映しない**（OD-CS-11 を維持） | Pieces / Recipe に取り込む | 反映すると配点・`lunch-rush-v1`・Dex BEST の比較可能性に波及。体験のみなら全て不変 |
| **D-5** ▲ | 識別（`prep` 軸） | **体験のみ。ピース・pizza state に痕跡を残さず、識別に入れない** | `prep` 軸を OBSERVED にして要件化 | 要件化は discovery matcher / Hint 5.0 / DH4 / Research / Dex / 技法台帳（P9）に波及し、DH4 sweep（timeout の 98%）を悪化させる。体験のみなら `signature`・保存・journal は無変更 |
| **D-6** | 既存レシピの扱い | **レシピ定義・要件は変えない。操作は食材単位の affordance（その食材を使う全レシピ・全モード共通）** | レシピ単位のフラグ | レシピ単位だと Free / Research で工程の有無が標的を漏らす（Anti-Oracle）。食材単位なら標的と無関係。**副作用: その食材を使う既存レシピの体験が変わる**（beef は出荷済み 1 件のみ、§4.2） |
| **D-7** | タブ上限 | **6 を維持。新タブなし** | — | 11 レシピが上限、PREPARE の縦余白 0px。操作はステージ上のオーバーレイ／既存 dock の中で完結させる |
| **D-8** | 名称・文言・ヒント | **Phase 1 は技法名・Dex 文言・ヒント変更なし。チップの小さな印とミトの一言のみ（食材単位で全モード共通）** | 技法として発見対象にする | 技法化は INV-TQ（購入しない・直接教えない・TQ-1 の要求先は aussie のみ）に触れ、Owner 判断が重い |

### 1.1 追加で Owner に確認が要る判断（調査後に必要）

| ID | 論点 | 推奨（助言） |
|---|---|---|
| D-9 | 試作の対象食材 | **beef（炒め）**。出荷済みレシピは rendang-pizza の 1 件だけで影響が最小、焼肉・ロモサルタードの証跡とも合う。次に eggplant（焼き、出荷済み 9 件）で汎化を検証 |
| D-10 | 下ごしらえは任意か必須か／しない場合の見た目 | **任意**（飛ばしても配置できる。しなければ「生っぽい」見た目になるが採点は同じ）。必須にすると採点に影響しない作業が強制され、テンポ悪化だけが残る |
| D-11 | #476 D3（SCATTER 保留）の扱い | **保留を維持**（本書で SPRINKLE を撤回）。再開は #478 の A が実機 HV を通った後 |
| D-12 | 実装・調査の claim をどの Issue に置くか | #611（親）。**本書は claim を投稿していない** |

---

## 2. 「散らす」はタップと十分に異なる体験になるか — 評価

### 2.1 数値（出荷済み 74 レシピ、xs サイズ区分の 14 食材）

| 指標 | 値 |
|---|---|
| xs 食材を要求するレシピ | 28 / 74 |
| xs 食材の要求エントリ（レシピ×食材） | 31 |
| 要求ピース数の分布 | 1 個: 15 件／2 個: 13 件／3 個: 3 件（最大 3） |
| ストローク化で減らせるタップの上限（各食材 1 ストロークで足りる前提） | **19 回 / 28 レシピ** |
| 1 レシピの全ピースに占める xs の平均割合 | 約 28% |

→ **半数（15 件）は 1 個で、ストロークとタップの区別がつかない。**

### 2.2 設計案ごとの評価

| 案 | 内容 | タップとの差 | 採点との整合 | 判定 |
|---|---|---|---|---|
| V1 | ストローク＝数個を距離間隔で配置（前回 audit の案） | 操作が違うだけで**結果は同一**。減るタップは 0〜2 回 | 配置点は指の通過位置。Reference の固定点（半径内）に入れるには狙う必要があり、「散らす」意味が消える | ✕ |
| V2 | 量ゲージを満たすと、ブラシ範囲内に**ランダム**に配置 | 連続量・リズムで体験は変わる | 位置がランダムだと Pieces 成分が運任せになる。係数を変えず（#476 D6）に許容半径を広げるのは別判断 | ✕（採点を変える判断が要る） |
| V3 | 配置は従来どおり。xs ピースを置いた瞬間の**粒が落ちる演出**のみ追加 | 操作は同じ、見た目の手応えのみ | 無変更 | △（安価。「新工程」ではなく演出の改善） |
| V4 | 全 scatter のドラッグ配置（#478 の A） | 操作の統一であり、ここでは目標外 | 無変更 | 別系統（今回は扱わない） |

**結論:** 「散らす」はタップと十分に異なる体験にならない。理由は (1) 数が少ない、(2) 位置が採点に直結する、(3) 最小間隔 9% で密度が出ない、の 3 点で、いずれも **Owner が固定している条件**（D4・D6）に起因するため、設計の工夫では解消できない。**撤回して D-11（保留維持）とする。** V3 は安価な演出として別途検討余地があるが、本書の対象（新工程）ではない。

---

## 3. 仕上げがけを先行する場合の最小実装範囲

### 3.1 現状の事実

| 事実 | 出典 |
|---|---|
| FINISH は topping のみ（`category !== "topping"` を拒否） | `gameReducer.ts:1077` |
| ソース塗り `COMMIT_SAUCE_DISPENSE` は **PREPARE かつ SAUCE ステップ限定** | `gameReducer.ts:1017` |
| 複数ソースの台帳（Sauce B1）は存在し、種類ごとの 100% 上限と合計 200%（暫定）の上限がある | `gameReducer.ts:1023-1037` |
| 沈着（deposit）に `stage`（焼成前後）の区別は無い。`pendingRound` は deposit のフィールドを許可リストで保存・検証 | `pizzaState.ts`、`pendingRound.ts:120, 222` |
| Reference の piece グループは**固定座標＋full/zero 半径**、`interaction.family` は型リテラル `"TAP_PLACE"` | `referencePizza.ts:51-70` |
| 識別の `late` 軸は**ピースの stage だけ**を読む（沈着の後乗せは識別に出ない） | `signature.ts`（`lateOf`） |
| 焼成後の液体・ペーストを要する行は L1 の 5 行（READY 1: wasabi-beef、REVIEW 1: hot-honey-pepperoni、BLOCKED 3） | #579 価値監査 |
| #518（焼成フィルターが後乗せに掛かる問題）は技術的に解消（D2-2a など） | #579 価値監査 |

### 3.2 方式の再評価

| 方式 | 成立性 | 理由 |
|---|---|---|
| **A: 線状ピース**（前回 audit の推奨） | **不成立** | Reference が固定点＋半径のため、なぞった線上のピースは採点で「位置外れ」になる。成立させるには Reference に「線／領域」グループを新設する必要があり、`TAP_PLACE` リテラル型・採点・Reference 表示・DH4 スナップショットに波及。さらに最小間隔 9% で、線ではなく点線になる |
| **B: 第 2 のソース層**（FINISH で塗る） | 成立するが **XL** | 下の最小スライス参照 |
| **D0: わさび牛を粒状 topping で** | 成立（機構なし） | 「かける」体験ではなく content。#579 監査が次候補として提案 |

### 3.3 仕上げがけを先行する場合の最小範囲（Owner が保留を覆す場合のみ）

**目標:** 1 レシピ（hot-honey-pepperoni 候補）・1 液体（はちみつ）・FINISH のみ・採点に入れない。

| スライス | 内容 | 触る領域 | 備考 |
|---|---|---|---|
| DR-0 | 原典確認（はちみつが焼成後か。現状は repo 推論のみ）と、ベースソース・構成の決定 | docs / Owner | #579 の再開条件そのもの |
| DR-1 | reducer: FINISH 用の沈着 commit（`COMMIT_SAUCE_DISPENSE` の FINISH 版）。対象はレシピが `POST_BAKE` と宣言した sauce のみ。在庫は FINISH 側で 1 回消費 | `gameReducer.ts`、`finishEngine.ts` | 沈着に `stage` が要る → `pendingRound` の許可リスト・検証・R8 行列テストの改修（前回 audit §8-4） |
| DR-2 | 描画: 後乗せ沈着を焼成色の外側の層に描く（D2-2a と同型）。FINISH で塗りモード（`isPaintMode` は SAUCE ステップ前提） | `PizzaStage.tsx`、`SauceMergedCanvas` 系 | HOT: #468 / #478 / #581 と衝突しうる |
| DR-3 | 採点・Completion: 後乗せソースを Sauce 成分に入れるか、除外するか。**除外するなら Reference の sauce が単一前提（`ReferencePizza.sauce`）のため仕様が要る** | `scoringV2/sauceComponent.ts`、`completionGate.ts` | Scoring 2.0 authority。Owner 判断 |
| DR-4 | 識別: `late` 軸を沈着にも拡張するか、除外か。除外なら「はちみつの有無でレシピ判別されない」 | `signature.ts`、Hint、DH4 | 拡張は Anti-Oracle・DH4 再 audit |
| DR-5 | content: 新食材（はちみつ）・SVG・価格・ladder・レシピ | late catalog 一式（#679 と同型で約 50 ファイル） | |

→ **DR-1〜DR-4 だけで Scoring 2.0・保存・識別の 3 つの authority に触れる。「最小」ではない。** 保留推奨は妥当。

### 3.4 仕上げがけを先送りしても得られるもの

- わさび牛（D0）は粒状 topping として late catalog に載せられる（機構なし）。BBQ（#679）の次候補。
- 「はちみつ」を使う体験は、焼成前 PAINT の第 2 ソース（グランマの型）で近似できる行がある。ただし「焼成後にかける」ではない。

---

## 4. 焼肉ピザなどに必要な炒め・焼き工程 — 独立した技術調査計画

### 4.1 目的と範囲

**問い:** 「炒める／焼いてから乗せる」を、**pizza state・保存・採点・識別に痕跡を残さず**、**新タブなし**で、**390×844 の 1 画面に収まるミニ操作**として入れられるか。入れられるなら最小の状態の置き場はどこか。

**前提（設計案。調査で検証する）:** 食材単位の affordance。対象食材の chip を選んだとき、ステージが一時的に「フライパン」表示になり、短い操作（約 3 回のタップのリズム、または長押し）で「炒め済み」になる。炒め済みの食材は、その後の配置で**調理済みの見た目**になる。ピースには何も足さない。

**範囲外:** 採点反映、識別化（`prep` 軸）、技法化、Lunch Rush / Dinner、`mid_bake`、混ぜる、実装。

**証跡との関係:** 焼肉・ロモサルタードの炒め記述は repo 内の二次情報（`source_profile_text`）。PR-2 の設計 Gate は「焼肉の炒めは未モデル。識別に入らない」を前提にしており、**本調査が体験のみ版を許すなら、焼肉は PR-2 の仕様のまま（炒めを要求せず）出荷しつつ、体験だけ後から足せる**。

### 4.2 現状の事実（調査の出発点）

| 項目 | 事実 |
|---|---|
| beef を使う出荷済みレシピ | rendang-pizza のみ（1 件）。mushroom 4、eggplant 9、onion 15、shrimp 2 |
| 焼成見た目の hook | `bakeProgressForPiece(piece, pizzaBakeProgress)` は pre-bake ピースに pizza の値を、post-bake に `null` を返す純関数（D2-0）。ピース単位の焼き色は `toppingVisualFrame(heat, roastResistant)` |
| ラウンドの transient な状態 | `GameState` は保存されない。`pendingRound` journal は toppings / sauce / dough 等を許可リストで保存し、**精算専用で描画しない** |
| ステージ表示の切替 | `roomyStage`（BAKE / CUT）、`isFinishStep`、`isPaintMode`。工程ごとに内容を切り替える構造が既にある |
| 食材ごとの性質の導出 | `toppingSizeClass` のように **id から導出し保存しない**前例 |

### 4.3 調査項目（T0〜T7）

各項目は**コードを書かずに**答えを出す。実機計測が必要なものは、リポジトリ外の使い捨て Playwright プローブ（#476 Phase 0 と同じ方式。`node_modules` は gitignore 済み）で行う。

| ID | 調査 | 方法 | 判定基準（Go の条件） | 想定規模 |
|---|---|---|---|---|
| **T0** | Duplicate / claim 確認、Owner 回答（D-9〜D-12）の取得 | GitHub 読み取り、#611 | D-9〜D-11 に回答がある。重複する claim なし | 小 |
| **T1** | **「炒め済み」の置き場**: (a) `GameState` 上の transient な `preparedIngredientIds`、(b) ピースの新フィールド（`pendingRound` に触れるため原則不可）、(c) 導出のみ。リセット意味論（`RESET_PIZZA`、ステップ確認、`RETRY_SAME_RECIPE`、Free の再開、`ADOPT_STATE`、Undo）と、`GameState` の deep-equal を使う既存 golden / parity への影響範囲を数える | grep と読解。`GameState` のスナップショット箇所一覧、deep-equal を使うテストの一覧 | (a) が既存 golden を無修正で通せる（初期値が省略可能で、省略時に従来と同一） | 中 |
| **T2** | **描画**: 調理済み見た目を、`bakeProgressForPiece` の hook（ピース単位の熱オフセット）で表現できるか。PREPARE の見た目、焼成後、CUT の半分ピース、RESULT、Reference 比較、サムネイルへの影響。`IngredientPieceVisual` / `PizzaStage` の現在の配線を確認（D2-0 時点の記述は古い可能性） | 読解＋使い捨てプローブで 390×844 / 360×800 の画像比較 | 見た目の差が 20px 級のピースで識別でき、Reference 比較・サムネイルが変わらない／変わっても許容 | 中 |
| **T3** | **入力の成立性**: ステージ差し替え（フライパン表示）で、トレイが隠れても戻れるか（完了／×をステージ内に）。タップのリズム vs 長押し、タップ 3 回の代替、`pointer capture`・abort 条件（blur / visibility / `makingStepToken`）、`isPaintMode` との競合、`touch-action`、キーボード・AT 代替。**縦余白 0px の再配分が不要か** | 読解＋使い捨てプローブ（描画だけの仮オーバーレイをプローブ側で注入して寸法を実測） | 追加行なしでレイアウトが不変、横スクロールなし、タップ領域 44px 以上 | 中〜大 |
| **T4** | **テンポ**: 1 回の下ごしらえの所要。目標 ≤ 8 秒。複数食材のレシピでの積み上がり。Free の `perStepElapsedMs` と Preview での計測方法 | プローブで操作時間を模擬、HV で人が計測。**実測値がまだ無いことを前提に基準を先に決める** | 1 食材 ≤ 8 秒、1 レシピ ≤ 1 回、失敗状態なし、任意（飛ばせる） | 小 |
| **T5** | **識別・Anti-Oracle 監査**: 「炒め済み」を `signature` / Hint / DH4 / Research / Dex / near-miss / 技法台帳 / 指紋が**読まない**こと。チップの印が全モード・全レシピで同一に出ること（レシピ固有の漏洩なし）。Dinner（START_BAKE まで未確定）と Lunch Rush の扱い | grep、architecture test 設計（`techniques.architecture.test.ts` の流儀） | 読み取り箇所 0。印は食材単位で、モード間で差がない | 中 |
| **T6** | **採点・確定・保存の不変性**: `finalizeRound`、Scoring 2.0、Completion Gate、在庫消費（下ごしらえは消費しない）、`pendingRound` が一切影響を受けないこと。parity golden を無修正で通せるか | 読解、既存 golden の対象範囲の確認 | 影響 0 の証明が書ける | 小 |
| **T7** | **証跡と PR-2 の整合**: 焼肉・ロモサルタードの原典確認（Owner が共有できる範囲）。体験のみ版が PR-2 の「炒めは未モデル」前提と矛盾しないこと。BBQ（#679）と `ingredients.ts` / `App.css` を共有しない設計か | docs 読解、Owner への質問 | 矛盾なし。共有ファイルなし（食材ごとの下ごしらえ区分は `ingredients.ts` ではなく小さな別モジュールで id 導出） | 小 |

### 4.4 Go / No-Go と成果物

| 結果 | 条件 | 次 |
|---|---|---|
| **Go** | T1 の (a) が成立、T2・T3 が両 viewport で成立、T5・T6 が影響 0、T4 の基準を満たす見込み | Phase 1 試作（§6）へ |
| **条件付き Go** | T3 でステージ差し替えがレイアウトを動かす → オーバーレイ方式に変更して再評価 | 再調査 1 回のみ |
| **No-Go** | T1 で既存 golden の大量改修が要る、または T5 で読み取り箇所が見つかる、または T4 が基準外 | 下ごしらえはエンジンに入れず、content（BBQ・わさび牛）に専念。調査結果を docs に残す |

成果物: `docs/reports/TETO_COOKING-PREP_Technical-Investigation_Result.md`（T0〜T7 の回答、図、Go / No-Go、試作スコープ）。コード変更なし。**推奨モデル: Sonnet。** T1 の状態遷移（`ADOPT_STATE` と `pendingRound` の往復）で既存 parity が壊れる懸念が出た場合のみ、その設計判断に Opus を使う。

---

## 5. PR #679・PR-2・#620 との重複・競合

確認時点: 2026-10-27、`main` = `47268e3`。すべて読み取り専用。

| 対象 | 状態 | 触る領域 | 本計画との関係 |
|---|---|---|---|
| **#679**（BBQ チキン late、open、merge 禁止） | head `933e518`。47 ファイル。Owner の実機 HV 待ち | `lateCatalog.ts`、`ingredients.ts`、`referencePizza.ts`、`recipeSauceProfiles.ts`、`IngredientGlyph.tsx`、`App.css`（3 行）、hint5 golden、DH4 監査 JSON、`catalogLedger.test.ts` ほか | **ファイル重複は `ingredients.ts` と `App.css` のみ。** 下ごしらえは `ingredients.ts` を触らず（id 導出の別モジュール）、`App.css` は試作段階で最小に。調査（T0〜T7）は docs のみで競合なし。**#679 の merge 後に着手する必要はない**が、`App.css` を触る試作 PR は #679 の merge 後に rebase 不要な形（別ファイルのスタイルを import）にする |
| **PR-2（late4: プルコギ・焼肉・わさび牛・たらこクリーム）** | **実装 PR は存在しない。** 設計 Gate が main にある（docs-only）。Owner 判断 9 件・先行条件が未達。DH4 sweep の余裕不足が最大リスク（#688 で高速化済み、#684 で pin 追加）。#686（Batch 10 PR-1、merge 済み）で通常 ladder が step 57-61 に伸びた | `lateCatalog.ts`、食材・レシピ・SVG・orders・taxonomy・floors 一式 | **衝突なし**（本計画はデータ系を触らない）。**依存関係:** 焼肉の「炒め」は PR-2 では未モデル（識別に入れない）。本調査が体験のみ版を許せば、焼肉は PR-2 の仕様のまま出荷でき、体験は後から追加できる。PR-2 の設計 Gate は #686 による ladder の伸びを反映していない可能性があるため、**PR-2 着手時に再計算が要る**（本計画の範囲外） |
| **#620**（PR、docs-only、open、2026-10-22） | 前々回の audit（POST_BAKE / MULTI_SAUCE / ZONED）。1 ファイル | `docs/reports/TETO_COOKING-STEPS-NEW-PROCESSES_Phase1-Fresh-Design-Audit.md` | **競合なし。** POST_BAKE は #620 の後に本番 ON になり、記述は一部古い。本書の対象（炒め等）は #620 の範囲外 |
| **#476**（Issue、Owner 決定 D1〜D9） | 食材別操作の authority。D3: SCATTER 新方式は実装しない | — | **本書の SPRINKLE 撤回はこの決定と整合。** 下ごしらえは「食材別操作」の一種だが、#476 の PLACE / SCATTER / SLICE / DRIZZLE のいずれにも該当しない新分類。**#476 の Owner Decision Gate に載せるか別 Issue にするかは Owner 判断（D-12）** |
| **#478**（draft、トレイドラッグ統一） | `IngredientTray.tsx`、`pieceDrag.ts`、`GameScreen.tsx`、`roundKind.ts` | — | 本計画は統一を前提にしない。**`GameScreen.tsx` の試作変更が HOT 衝突しうる** |
| **#579**（Issue、DRIZZLE 論点＋価値監査 2026-10-27） | 保留推奨。再開条件あり | — | §3 はこの監査に合流 |
| **#581**（square dough UX）、**#468**（モッツァレラ溶け） | `Square*` 系／`bakeVisual.ts`・`PizzaStage.tsx`・`App.css` | — | #468 は `bakeVisual.ts` を触るため、T2（焼き色 hook）で再確認が必要 |
| claim | #611: `01E7…`（優先度表・BBQ 設計の docs、期限 11/03）。`019hxe…`（late-catalog-foundation、期限 10/28）は実質完了。#578: U3 の claim が残存（BBQ と重なるファイル） | — | **本書は claim を投稿していない。** 調査 PR を切るときに #611 へ docs-only claim を置く |

---

## 6. Phase 1 の推奨方式と最小実装スライス

### 6.1 推奨方式

**「下ごしらえ（炒め）の体験のみ版」を、食材単位の affordance として、Preview 限定・フラグ OFF で試作する。** ただし §4 の調査が Go のときだけ。

| 項目 | 内容 |
|---|---|
| 対象食材 | beef（炒め）。出荷済みは rendang-pizza のみ。次段で eggplant（焼き） |
| 対象ラウンド | Guided / Free / Research。Lunch Rush・Dinner は除外 |
| 操作 | beef の chip を選ぶ → ステージが「フライパン」表示（既存の工程別表示切替と同型）→ タップのリズム（約 3 回）で炒め済み → 元の配置に戻る。×で中止。飛ばして配置も可（見た目は生っぽい） |
| 状態 | `GameState` 上の transient な炒め済み食材集合（調査 T1 で最終決定）。ピース・pizza state・journal・保存は無変更 |
| 見た目 | 炒め済み食材のピースは調理済みの色で描く（`bakeProgressForPiece` 系の hook、T2） |
| 変えないもの | タブ、採点、Completion Gate、識別、Hint、Dex、Research、在庫、レシピ定義、保存形式、ランキング |
| フラグ | `PREP_EXPERIENCE_PRODUCTION = false`（`lateCatalog.ts` / `freeCookFinishGate.ts` と同じリテラル切替） |

### 6.2 スライス

| スライス | 内容 | 触る領域（予定） | 前提 | 本番影響 |
|---|---|---|---|---|
| **S-1（今回の後の最初）** | 調査 T0〜T7。docs のみ（Result を 1 本） | docs | D-9〜D-12 の回答 | 無し |
| S0 | Owner 決定の記録（D-1〜D-12 の回答）＋ claim | docs | S-1 が Go | 無し |
| S1 | 純粋層: 食材ごとの下ごしらえ区分（id 導出の別モジュール）、炒め済み集合の純関数、リズム判定。テストのみ | `src/logic/prep*.ts`（新規） | S0 | 無し（未配線） |
| S2 | reducer: transient 状態の追加と専用アクション（省略時は従来と同一）。parity golden 無修正 | `gameReducer.ts` | S1 | 無し（アクション未発行） |
| S3 | 描画: 調理済み見た目（T2 の方式） | `PizzaStage.tsx` / `IngredientPieceVisual` | S2 | フラグ OFF で無変更 |
| S4 | UI: フライパン表示と操作、チップの印 | `GameScreen.tsx`、`PizzaStage.tsx`、`App.css` | S3 | フラグ OFF で無変更 |
| S5 | E2E（390×844 / 360×800 / WebKit）、Preview opt-in、HV 動画＋前後スクショ | `e2e/` | S4 | Preview のみ |

### 6.3 依存関係

```
D-9〜D-12 回答 ─→ S-1 調査(T0〜T7) ─→ Go/No-Go ─→ S0 ─→ S1 ─→ S2 ─→ S3 ─→ S4 ─→ S5(HV)
                                         │
                                         └─ No-Go ─→ エンジン変更なし（content: #679 → わさび牛）

並行（独立）: #679 BBQ → PR-2 late4（設計 Gate 再計算後）。本計画はデータ系を触らないため待たない。
外部依存: #478(draft) の GameScreen.tsx 変更 → S4 で衝突確認。#468 の bakeVisual.ts → S3 で確認。
```

### 6.4 検証方法

| 区分 | 検証 |
|---|---|
| 不変性（最重要） | フラグ OFF で `RECIPES × {Guided, Free, Lunch Rush, Dinner}` の既存 golden がバイト同一。フラグ ON でも、炒めをしなかった場合の状態・採点・確定・在庫・Dex が従来と同一 |
| 読まない証明 | architecture test: `signature` / Hint / DH4 / Research / Dex / near-miss / 技法台帳 / 指紋 / scoringV2 / completionGate / pendingRound が炒め済み状態を import しない |
| 保存 | `pendingRound` 行列テストが無修正で通る。炒め済み状態が journal に出ない |
| レイアウト | タブ数・縦余白不変（`dynamic-cooking-steps`、`viewport-1screen` の既存 E2E が無修正）。両 viewport で横スクロールなし、操作領域 44px 以上 |
| 入力 | 中断（blur・visibility・ステップ確認）で炒めが破棄され、半端な状態が残らない。タップ 3 回の代替、キーボード |
| Anti-Oracle | 印と文言が食材単位で、全レシピ・全モードで同一。Research / Dinner で標的が漏れない |
| 体験 | HV: 390×844 動画（ユーザーへ直接提出、リポジトリには入れない）＋前後スクショ（`docs/reports/screenshots/<task-name>/`）。**1 食材 ≤ 8 秒、任意、失敗なし**を満たすか。「面白い／面倒」を Owner が判定 |
| CI | typecheck / lint / build、WebKit gate（src 変更） |

### 6.5 リスク

| リスク | 緩和 |
|---|---|
| 採点に影響しない作業が「面倒な儀式」になる | 任意＋短時間＋見た目と一言の手応え。HV で面倒と判定されたら即撤回（フラグ OFF） |
| 食材単位のため、同じ食材を使う既存レシピの体験が変わる | beef は 1 件のみ。Owner 判断 D-9 |
| ステージ差し替えでトレイが隠れる | T3 で確認。完了／×はステージ内 |
| `GameScreen.tsx` / `PizzaStage.tsx` / `App.css` の HOT 衝突 | claim と merge 順の明記 |
| 体験のみで終わり、将来の要件化（識別）で作り直しになる | 状態を食材単位の集合にして、後から `prep` 軸へ拡張できる形にしておく（ただし要件化は別 Gate） |

---

## 7. 未確認事項

- アプリの実行・テスト実行・実機操作は未実施（`node_modules` なし）。テンポ・難易度の数値は設計上の目安。
- 焼肉・ロモサルタードの炒めの原典（pizzadb.jp）は未確認（repo 内の二次情報のみ）。
- open PR / Issue のコメント全文は読んでいない（#611・#579・#476 の主要コメントのみ読んだ）。
- PR-2 設計 Gate は #686（ladder step 57-61）以前の基準で書かれている。再計算は PR-2 側の作業。
- `PizzaStage` / `IngredientPieceVisual` の現在の焼き色 hook の配線は未確認（D2-0 の記述は古い可能性。T2 の最初の作業）。

---

## 8. Result Report

| 項目 | 内容 |
|---|---|
| 依頼 | Fresh Audit を受けた Phase 1 実装前検証（D-1〜D-8 整理、「散らす」評価、仕上げがけ最小範囲、炒め・焼き調査計画、#679 / PR-2 / #620 の重複確認）。調査・設計のみ |
| 成果物 | 本書（`docs/reports/TETO_COOKING-PROCESS-EXPANSION_Phase1-PreImplementation-Verification.md`）。前回 audit の冒頭に訂正参照を追記 |
| 主な結論 | (1) 「散らす」は撤回（タップと差が出ない。#476 D3 と整合）。(2) 仕上げがけは保留（線状ピース案は Reference モデルと衝突、第 2 ソース層は XL、必須行 0）。(3) 推奨 Phase 1 は下ごしらえ（炒め）の体験のみ版。ただし §4 の調査が Go のときだけ。No-Go なら content に専念 |
| 判断表 | D-1〜D-8（▲ が前回から変更）＋追加 D-9〜D-12 |
| 最小スライス | S-1（調査）→ S0 → S1〜S5。調査は docs のみ |
| 競合 | #679 とは `ingredients.ts` / `App.css` のみ重複（回避策あり）。PR-2 は実装 PR なし・衝突なし。#620 は PR で競合なし。#476 / #478 / #579 は Owner 決定・保留と整合 |
| 変更したもの | docs 2 ファイル（新規 1、追記 1）のみ。製品コード・Preview・PR・merge・claim なし |
| 実行していないこと | アプリ実行、テスト、実機、外部原典の確認 |
| Owner に求める判断 | D-1（Phase 1 の優先）、D-3（仕上げがけ保留の確定）、D-9（試作の対象食材）、D-10（任意か必須か）、D-11（SCATTER 保留の維持）、D-12（claim の置き場）。回答後に調査 S-1 を開始 |
