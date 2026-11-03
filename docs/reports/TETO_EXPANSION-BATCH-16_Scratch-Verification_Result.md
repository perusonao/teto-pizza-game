# Expansion Batch 16 — 梅しそピザ scratch 検証 Result（docs-only・実装は HOLD）

> **更新（2026-11-03）**: Owner は案 A（通常 step 67・大葉は焼成前・late 移動なし）を採用し、#731 は merge 済み。本書の V-A（大葉＝焼成後）は不採用、V-B が採用案。最新の更新範囲・検証計画・推奨仕様は `TETO_EXPANSION-BATCH-16_Implementation-Plan.md` を参照（矛盾する箇所は同書が優先）。

Status: **Owner 方針どおりの組み合わせ（通常 step 67・credited ＋ 大葉を焼成後）は、現行アーキテクチャでは成立しない。実装せず停止する。** 代替 2 案（§6）を整理し、うち「大葉も焼成前」案（V-B）は scratch で実測して成立を確認した。
本 repo の Production コード・テスト・データ・保存仕様・ladder は未変更（本書のみ）。#731 の変更ファイルには触れていない。PR 作成・merge・Preview 更新・Production Deploy・CI 再実行なし。グローバルの Jaccard 0.4 基準は変更していない。
基準 `origin/main` = `079da33`（#730 / #729 merge 済み）。先行: `TETO_EXPANSION-BATCH-16_Research_Result.md`（同 branch）。scratch は repo 外（`/tmp/.../scratchpad/scratch16`、`079da33` の clone）のみで、commit していない。

## 0. 原典の扱い

pizzadb.jp は引き続き到達不可で**未確認**（Research Result §0 のとおり。根拠は比較表 1 行のみ: 梅肉 / 大葉 / モッツァレラ / しらす、ソース欄「その他」）。個数・焼成窓・ソースの扱い・色・投入タイミングはすべて GAMEPLAY ASSUMPTION。本書でもそれを維持する。スヤのような「存在しない工程」は追加していない。

## 1. 事前確認（main・重複・claim）

| 項目 | 結果 |
|---|---|
| main | `079da33`。#730（炙り Production ON）・#729（蒸す S1）は merge 済み |
| open PR | #731（B15、open のまま）、**#732（蒸す Phase 1 S2 設計、docs-only）**。梅しそ・B16 に関する PR・branch・Issue・claim は**なし** |
| B16 専用 Issue / claim | 未作成（調査・scratch のため。実装 GO 時に起票。`Depends-on: #731`） |
| 干渉 | #731 の変更ファイル・#732 の steam 系に触れていない。scratch は repo 外 |

## 2. 検証方法（scratch、repo 外）

`079da33` を clone して新食材と recipe を**データのみ**で仮実装（O1: `umeboshi-paste` = sauce・spread・PAINT・色 `#b8405a`・emoji 🍑、ordinary step 67・credited・key-free・`lunchRush:false`・CUT なし、bake 58–78）。2 変種を比較した。

| 変種 | 構成 |
|---|---|
| **V-A（Owner 優先案）** | 梅肉ソース 1 / mozzarella 2 / whitebait 4（焼成前）/ **shiso 2（`applicationPhase: "POST_BAKE"`）** |
| **V-B（フォールバック）** | 同じ構成だが **shiso も焼成前**（出荷済み shirasu-pizza と同じ扱い） |

それぞれ全 Vitest（Pinsa ON）と、使い捨てプローブ（実 reducer の通し、実プールの「おしい」・Hint・Research、ショップ解禁の数え方）を実行。限界: **E2E・WebKit・実機・Pinsa OFF 全件は未実施**。referencePizza の座標は仮。V-A の失敗の一部は、ほかの失敗に隠れて未評価の assertion が残り得る。

## 3. 結果の要約

| 項目 | V-A（大葉＝焼成後） | V-B（大葉も焼成前） |
|---|---|---|
| 全 Vitest | 11,179 件中 **100 失敗**（54 ファイル） | 11,179 件中 **56 失敗**（27 ファイル） |
| 失敗の性質 | pin 更新 56 ＋ **契約違反 44** | **すべて pin / golden / 承認例外 / validator**（V-B の失敗はすべて V-A にも含まれる） |
| DH4 / Hint 5.0 の privacy gate | **Technique recipe の再監査 gate が 2 本落ちる**（下記） | **全て pass**（`deductionGuard.*` / `deductionProduction.gate` / `hint5Production.gate` / `hint5Taxonomy.gate` 変更なし） |
| 通し（Free Cooking） | 成立（FINISH を含む） | 成立 |
| Research 表示 | `？？？ピザ（梅肉）`（文字なし、既存ラベル不変） | 同左 |
| 「おしい」 | 悪化 0 | 悪化 0 |

## 4. V-A（大葉＝焼成後）が成立しない理由

実測で、**通常 catalog の recipe に POST_BAKE を入れると、「通常 recipe は後乗せ・FINISH を持たない」という複数の固定契約に当たる**ことが分かった（契約違反 44 件）。後乗せの recipe は現在すべて **late catalog**（`lateCatalog.ts` の `LATE_RECIPES`、専用の late 材料・late step・解禁 floor を持つ）に置かれる設計で、`validateLateCatalog` も「late recipe は POST_BAKE を必ず持つ」を要求する。

| 契約（失敗したテスト群） | 内容 |
|---|---|
| FINISH の分離（`finishD2Inert` / `finishEngine`×3 / `gameReducer.finish` / `finishFlow` / `finishFreeCook` / `finishHint` / `finishCatalogGuards` / `freeCook.latePhase`） | 「通常 RECIPES は FINISH を持たず、Guided・Lunch Rush・Dinner でも FINISH が出ない」。V-A では **Guided の ume-shiso に FINISH 段が付き、bake 値を保持する**（Guided の挙動が変わる） |
| late 軸の専有（`lateAxis`×3 / `discoveryCatalog.doughIdentity`×2 / `lateCatalog.*`（ikura・offGolden・test・pinsa 10）） | 「late の識別を宣言するのは late catalog の target だけ」「late OFF では通常 recipe に POST_BAKE がない」「Pinsa の cohort / 文字の前提」 |
| 技法（`techniques.*`×3 / `dexView` / `runtime`×2） | 通常 recipe が late-addition 技法を要求すると、既存の技法台帳（late-addition）が通常 Dex でも動く |
| Hint / DH4 の再監査（`deductionProduction.gate` / `hint5Production.gate`） | 「新しい Technique recipe は privacy を再監査してから出荷」。V-A は **Technique recipe が 1 件増え、再監査が必須**（gate を緩めない） |
| 発見・Reference（`gameReducer.discovery` / `w1Activation` / `multiSauce.guards` / `doughAxis` / `dinnerResultDetection` / `referencePizza.w1`） | 「Reference 通りに置けば発見される」が、大葉が後乗せだと**焼成前に置いた Reference は ORIGINAL になる**。Dinner は FINISH を持たないため**検出が NONE** になる（late recipe は除外されている前提） |
| 窓・その他（`freeCookBakeWindow`） | 各 recipe の自前の窓を通常 recipe として検査する前提 |

→ これらは件数 pin ではなく**設計上の分離**で、緩めるには Owner の設計判断と大きな変更（FINISH・Guided・Dinner・技法・Hint）が要る。Owner 制約「検証が不成立なら実装せず停止」に従い、**V-A の実装は行わない。** 

## 5. 梅肉ソース・大葉 FINISH・各種検証（測定できた範囲）

### 5.1 梅肉ソースの既存工程への適合（V-A / V-B 共通）
- sauce 型の新食材は既存の PAINT（`RECIPE_SAUCE_PROFILES`）で動く。新しい機構は不要。recipe の工程は DOUGH → SAUCE → CHEESE → TOPPING（V-A のみ + FINISH）。
- 色 `#b8405a` は tomato-sauce `#c73b2e` と ΔE 29、doubanjiang と 26、生地 `#e8c98f` と 64（CIE76）。**識別の見込みはあるが、焼成後の色は未測定・確定は実機 HV。**
- emoji 🍑 は未使用（G18 を満たす見込み）。sauce は family を持たないので **family の Owner 承認（L1）は不要**。

### 5.2 大葉の焼成後投入と FINISH（V-A の通し）
- 工程 `DOUGH / SAUCE / CHEESE / TOPPING / FINISH`。実 reducer で、梅肉ソース ＋ mozzarella 2 ＋ しらす 4（焼成前）→ 焼成 → 大葉 2（FINISH）→ **NEW_DISCOVERY**。大葉 1 でも発見（late 軸は presence-only）。
- 大葉を焼成前に置く / 大葉なし / ソースなし / トマトソース → いずれも ORIGINAL。出荷済み shirasu-pizza（大葉は焼成前、ソースなし）は**従来どおり発見**。「しらすピザ ＋ 梅肉ソース」は ORIGINAL（取り違えなし）。
- **ただし 4 章のとおり、これを通常 recipe として成立させる設計上の根拠がない。**

### 5.3 実プールでの「おしい」・Hint・Research（B15 と同形のプローブ）
- **悪化 0**: ume-shiso の追加で分類が変わる試作は、すべて strictly 近づく（または ume-shiso 自体＝発見）。以前一致していた試作が崩れることはない。V-A: shirasu 未発見の近傍で 69 件中 23 件、キー発見のみで 52 件が変化。V-B: 同 22 件 / 63 件。
- **しらすピザの近傍は不変**: `mozzarella+lemon+shiso+whitebait`（shirasu そのもの）= 一致のまま、`mozzarella+shiso+whitebait` は ADD_ONE(d1) のまま（同点は hint 順で shirasu が優先）。
- **Hint**: 「キー recipe だけ発見済み」では OPEN_POOL のまま（pool 11 → 12）。「しらすピザ未発見」では TARGET（shirasu）→ OPEN_POOL（2 件）に変わる。これは他の multi-recipe step（32・62・66）と同じ挙動。
- **Research**: 新 step 67 の唯一の新材料が梅肉 → cohort は単独、ラベル `？？？ピザ（梅肉）`（文字なし）。**全 ladder prefix で、文字が変わる既存レシピは 0**（`acceptedLetterShifts` 不要）。
- V-A のみ: 大葉が後乗せだと LATE_ONLY（「おしい」が「タイミング」を示す）が出る — 既存の late recipe と同じ仕組み。

### 5.4 ショップの解禁・保存互換
- **解禁**: 発見数 67 で `umeboshi-paste` と late の `soy-sauce` / `wasabi` が**同時に**解禁される。つまり **step 67 は ume-shiso と late の wasabi-beef-pizza が同時に makeable になる multi-recipe step**（B14 の step 66 と同型）。発見数 66 以前の解禁は変更前と同一、late の解禁 floor（66 / 67 / 68）は不変、ladder 総数 73 → 74、credited 76 → 77（#731 が merge されていない main 基準）。
- **late の導出番号は +1**（`materialShop` / `lateFloor` / `late4` 等の pin が動く。解禁そのものは後退しない）。
- **保存**: schema v2 のまま、新 id の追加のみの想定。旧版は未知 ID として保持する機構（#674）の対象。第 4 章を全達成済みの保存は未達成に戻る（導出表示）。**保存互換テスト（`persistence.batch16`）は scratch では書いていない。**

## 6. 代替案（Owner 判断。本書では確定しない）

| 案 | 内容 | 検証状況 | 備考 |
|---|---|---|---|
| **A（V-B）** | 通常 step 67・credited、**大葉も焼成前**（shirasu-pizza と同じ。Owner OD-B8 の既存方針と整合） | **scratch で成立を確認**（56 失敗はすべて pin / golden / 承認例外 / validator。privacy gate は全て pass） | 原典に投入タイミングの記載がなく、焼成前は既存と揃う。**大葉の後乗せという体験は失う** |
| **B** | **late catalog の recipe** にする（大葉＝POST_BAKE。ikura・yuzu-shrimp・tarako が大葉を後乗せにしている既存の型）。梅肉は late 専用材料（late step・entitlement floor・late の taxonomy 行・late の discovery target）、ordinary step 67 ではなく late 末尾に追加 | **未検証**（scratch では作っていない）。V-A の契約違反は late 経路では起きない見込みだが、late の導出番号・Pinsa の末尾順（Pinsa が tail になる前提）・floor との整合・Lunch Rush / Dinner の除外は要検証 | Owner 方針（「ordinary step 67」）の変更を伴う。late は credited の late step になる |
| C | 通常 recipe に POST_BAKE を許すよう、上記の契約（FINISH 分離・Guided / Dinner・技法・Hint 再監査）を設計から見直す | 未検証・大規模 | 本 Batch の範囲を超える。推奨しない |

**整理（推奨ではなく見立て）**: Owner の優先順位が「大葉は焼成後」なら B、「ordinary step 67 を維持」なら A。両立する C は規模が大きすぎる。**どれも HOLD のまま**（B16 本実装は #731 merge 後）。

## 7. 暫定仕様の複数案（原典未確認・すべて暫定）

食材の名称は `梅肉`（原典語）、sauce 型（O1）、色 `#b8405a` 付近、emoji 🍑 を前提。

### 7.1 個数（非ソース 8 ピース = 8 スロット）
| 案 | mozzarella | whitebait | shiso | 備考 |
|---|---|---|---|---|
| P1 | 2 | 4 | 2 | しらすが主役。scratch の構成 |
| P2 | 2 | 3 | 3 | 大葉を多めに（葉が見える。大葉が後乗せなら B / 焼成前なら A のとき見た目の差が出る） |
| P3 | 3 | 3 | 2 | チーズ多め。shirasu-pizza（2/2/1/3 ＋ lemon 2）との差別化は小さい |
- shirasu-pizza との識別は個数ではなく**梅肉ソースの有無**（ソース込みの集合）。shirasu との Jaccard 0.60 は個数案によらない（B16 限定の例外候補）。

### 7.2 焼成窓
| 案 | 窓 | 備考 |
|---|---|---|
| W1（推奨しやすい） | 58–78（汎用窓） | `FREE_COOK_BAKE_TARGET`（recipe の窓の中央値）が動かない（shirasu・B15 と同じ） |
| W2 | 56–76（B8a の較正窓） | 中央値に影響し得る。**未検証** |
| W3 | 60–80 | 同上。**未検証** |

### 7.3 説明文（Anti-Oracle: 投入タイミングは書かない）
| 案 | 文面 |
|---|---|
| D-1 | 梅のさわやかなソースに、しらすと大葉をそえた、和風の一枚。 |
| D-2 | 梅の酸味と大葉の香り、しらすをのせた、すっきりした和風の一枚。 |
| D-3 | しらすと大葉に、梅のソースをあわせた、さっぱりとした一枚。 |

### 7.4 注文セリフ（既存: shirasu「しらすと大葉のピザ、レモンでさっぱりしそう！…」、ikura / tarako の調子に合わせる）
| 案 | 文面 |
|---|---|
| O-1 | 梅のさわやかなピザ、おいしそう！食べてみたいな！ |
| O-2 | ほんのり酸っぱい梅のピザ、おいしそう！食べてみたいな！ |
| O-3 | 梅としらすのピザ、さっぱりしておいしそう！食べてみたいな！ |
- O-3 は食材名を 2 つ出すため、未発見 recipe の名前が DOM に出ない系のテストとの衝突を実装時に確認する（梅肉・しらすは食材名で recipe 名ではない）。

## 8. 未解決事項

1. **投入タイミング（Owner の「大葉は焼成後」）と配置（ordinary step 67）の両立は不可**: A（焼成前）/ B（late catalog）/ C のどれにするか。
2. B を選ぶ場合、late の梅肉の step・floor・Pinsa の tail 順・Lunch Rush / Dinner 除外を **scratch で追加検証**してよいか。
3. 「ソース欄『その他』= 梅肉ソース」は B16 限定の暫定例外として扱う（Owner 方針）。`discoveryCatalog.test` / `matcher.test` の承認例外は ume-shiso のみに限定する設計（B15 と同形）。
4. shirasu-pizza との Jaccard 0.60 を B16 限定の例外にする場合の差別化テスト（同一・部分・上位集合なし、0.4 以上は shirasu のみと名前つきで固定）。**0.4 の全体基準は変えない。**
5. 色・emoji・名称（梅肉 / 梅干し / 梅ペースト）・個数・窓・説明文・注文セリフ（§7）は暫定。実機 HV で確定。
6. **未検証**: E2E・WebKit・実機・Pinsa OFF の全件・`persistence.batch16`・B の late 経路。
7. 原典確認（pizzadb.jp のネットワーク許可）。
8. #731 の merge 待ち（B16 は `Depends-on: #731`。manifest・件数 pin・golden が重なる）。

## 9. 実施しなかったこと

B16 の Production コード・テスト・データの変更、recipe・食材・step の追加（scratch は repo 外）、PR 作成・merge・Preview 更新・Production Deploy・CI 再実行、グローバルの Jaccard 基準の変更、#731 / #732 のファイルの変更、原典の取得（到達不可）、B（late catalog）案の scratch 実装。
