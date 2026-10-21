# FIN-E2（TQ-2 / Issue #604）— late 軸・LATE_ADDITION・後乗せ技法・near-miss の設計と実装準備

親: #294 / #604。base `main` `afb3b7c`（FIN-E1 #605 merge 後）。**Owner は 2026-10-21 に D-1〜D-5 を承認（本書 §5 の推奨どおり）。実装は本書 §6 の範囲で完了。** 本番レシピ・食材・ladder・UI・reducer・FINISH 工程・save は無変更、FINISH は本番 OFF のまま。
検証は `src/logic/discovery/lateAxis.test.ts`（設計段階の `lateAxis.design.test.ts` を、実装に対する正式テストへ昇格）。

## 1. Duplicate Gate（2026-10-21）

- open PR 24 件を確認。`signature.ts` / `techniques.ts` / `detection.ts` / `nearMiss.ts` / `attemptFingerprint.ts` を触る PR なし。
  近いのは #295（2026-09 の古い Cooking Steps 設計 PR、CS-1a は別経路で取り込み済み）のみで、E2 の対象ファイルとは重ならない。#584 / #587 は `recipes.ts` 系（E2 は触らない）、#581 / #478 は UI。
- Issue #604 は E2 の authority（open、コメントなし）。他に TQ-2 / 後乗せ / late-addition の open Issue なし。
- 実装 PR の前に claim（`teto-claim:v1`、files: 下記 §6）を #604 に置くこと。`recipes.ts` / `PROJECT_HANDOFF.md` は HOT file なので E2 では触らない方針。

## 2. 現状の事実（コードで確認）

| 項目 | 現状 |
|---|---|
| 識別 | `signatureOfPizza` は `ingredientSet`（stage 無視）+ `pan`/`dough` のみ OBSERVED。`late` は `FIXED_BY_FLOW`（`[]`）。`RUNTIME_SUPPORTED_CAPABILITIES = ["DOUGH_VARIANT"]` |
| 落とし穴 | `sanitizeToppings` は `stage` を**落とす**。`late` は raw の `pizza.toppings` から読む必要がある |
| 技法 | `TECHNIQUES` は no-sauce / tray / dough-pinsa-romana。`detection.ts` は signature の軸から used、target の `identityDimensions` から required を導出。matcher は技法を一切読まない（INV-TQ-NB、architecture test） |
| near-miss | `classifyNearMiss` は items + sauceBase の距離のみ。距離 0 は `null`（「発見が優先」）。**本番 RESULT は中立 1 行のみ**（Near/Far Neutralization）で、方向つきの行は出ない。`nearMissPrivacy.ts` は pure のまま未配線 |
| Fingerprint / Notebook | `extensionOf` は「非 default の OBSERVED 軸」を自動で `ext` に載せる。canary test が「他の軸が OBSERVED になったら失敗する」ように置いてある |
| Hint / Dex | `applicationPhase` を読むのは `recipes.ts` / `cookingProfiles.ts` / `finishEngine.ts` / `finishHint.ts` / `prepareDock.ts` / test support のみ。Hint 事実・`deductionGuard`・Research・Dex・hintDisclosure は**読まない** |
| Free Cooking | `roundRunsFinish` は Free を除外。Free の発見解決は CONFIRM_BAKE で行われるため、FINISH の後に回す必要がある（E3 の範囲、§7） |

## 3. 設計

### 3.1 late 軸の観測

- `late` を `OBSERVED` にする。値は `stage === "post"` のピースの ingredientId 集合を `[["POST_BAKE", 昇順 unique ids]]` で表す。post ピースが無ければ `[]`（= default）。
- 読み取りは raw の `pizza.toppings` から（配列でなければ `[]`、`ingredientId` が string でなく座標が有限でない要素は無視）。`sanitizeToppings` は使わない。
- `ingredientSet` は従来どおり stage 無視（焼成前でも後でも「その食材がある」）。timing は `late` 軸だけが持つ。
- 比較は matcher の既存規則そのもの（JSON 一致）。matcher / `compareDimensions` は**無変更**。
- `RUNTIME_SUPPORTED_CAPABILITIES` に `LATE_ADDITION` を追加。後乗せ target だけが `capabilities: ["LATE_ADDITION"]` と `late: [["POST_BAKE", [...]]]` を持つ。
- 型: `RUNTIME_DIMENSION_OBSERVATION` の `K extends "pan" | "dough"` に `"late"` を足す。

### 3.2 LATE_ADDITION 技法（仮称「後乗せ」）

- `techniques.ts`: id `late-addition` を追加。名称は Owner 決定の仮称「後乗せ」。**なぞかけ・Dex 説明は UD-G 待ち**のため、E2 では動作を名指ししない中立な仮文言を入れ、Owner 承認まで本番に出ない（INV-TQ-4: 要求するレシピが無い間は affordance が開かず Dex に何も出ない）。
- `detection.ts`: `usesLateAddition` = `late` 軸が OBSERVED かつ値が非空かつ ingredientSet 非空。`requiresLateAddition` = target の `identityDimensions.late` が非空。`TechniqueTargetView` の `identityDimensions` に `late` を追加。
- 購入しない・★/Pitz なし・Free Cooking のみ（OD-TQ-1/7/10改）は既存の registration / runtime の経路をそのまま使う（変更なし）。

### 3.3 識別規則（近縁レシピ）

| 状況 | 結果 |
|---|---|
| 焼成前に base、焼成後に後乗せ食材（正しい配置） | 後乗せレシピ UNIQUE_MATCH |
| 全部焼成前（誤配置）、同じ食材集合の「焼成前のみ」レシピが無い | ORIGINAL（後乗せレシピは発見されない） |
| 全部焼成前、同じ食材集合の通常レシピがある | その通常レシピ（後乗せレシピは一致しない） |
| 後乗せ食材が違う（chicken を後、parsley を前） | 別の後乗せレシピのみ。該当が無ければ ORIGINAL |
| 後乗せ食材が無い／全部焼成後 | ORIGINAL |
| 後乗せ 1/2 個（不足） | **識別は一致**（presence-only は全軸共通）。Completion Gate（`recipe` policy = 各 1 個以上）も通り、数量は Scoring の quantity で減点（#215 OD-5）。0 個は識別・Gate とも不一致 |
| 同じ食材が焼成前にも後にもある | late 軸は一致。late 要件は post ピースだけで判定（`pizzaForFinalEvaluation`）なので pre ピースは代用できない |

候補の順序・ピースの順序に結果は依存しない（テスト済み）。

### 3.4 near-miss

- `classifyNearMiss` の距離に **late 軸の差を +1** で加える（`items` 一致でも late が違えば距離 1）。現状は誤配置が距離 0 → `null` で「何も言わない」ため、このままだと後乗せの近さを検出できない（テストで現状を固定）。
- 種別は DIMENSION 系（`LATE_ONLY`）として pure に追加。**本番 RESULT は中立 1 行のまま**で、プレイヤーに見える文言は増えない（Owner は near-miss の本番配線を復活させない方針）。
- k 規則: `nearMissPrivacy.ts` に late 用の答え数（pizza の非 sauce 食材の種類数。2 未満なら汎用文言）を追加。target が後乗せを要求するかで分岐しない（side channel を作らない）。

### 3.5 Fingerprint / Notebook / Research

- 現状のままだと late が `ext` に自動で載り、同じ食材の「前」「後」が別 attempt になって Notebook に同じ組み合わせの行が 2 つ並ぶ（時機の存在が見える）。#604 の「Notebook に時機の情報を出さない」に反する。
- **推奨**: `extensionOf` で `late` を明示的に除外（fp1 は不変、既存 Notebook も有効）。canary test を「late は OBSERVED だが fingerprint に載らない」に更新。→ **Owner 判断 D-3**。
- Research ○× 台帳・STRUCTURE 件数・Hint 事実は `applicationPhase` を読まないため、後乗せ食材は通常食材と同じ数え方になる（H5 を構造的に満たす）。E2 では変更しない。

### 3.6 Hint / Dex への影響（確認結果）

- Hint 5.0 gate（`deductionProduction.gate` / G7）・`deductionGuard`・hintDisclosure: `applicationPhase` も `late` も読まない。E2 の変更で挙動は変わらない。**弱める変更は無い**。後乗せレシピが入る E4 で、そのレシピを含めて gate / privacy sweep を再実行する（本番カタログが変わる時点で必須）。
- Dex 調理法: `techniqueDexViews` は affordance（要求する target の素材が全て解放済み）が開いた技法だけ RIDDLE を出す。後乗せ target が無い E2〜E3 では何も出ない。Dex の recipe カード・silhouette・件数は無変更。
- 6 タブ上限: E1 のガード（`TAB_CEILING` / `LATE_WITH_CUT`）が有効。E2 は profile / tab に触れない。

## 4. 合成カタログでの検証結果（`lateAxis.design.test.ts`、15 件 PASS）

正常配置 / 焼成前誤配置（双子レシピあり・なし）/ 別食材を後に置く / 後乗せ無し / 全部焼成後 / 不足配置（Gate は通る）/ pre のみ（Gate 失敗）/ 前後両方 / 順序非依存 / capability 未対応 / 本番全 target が default late / `sanitizeToppings` が stage を落とすこと / near-miss の距離 0 の穴 / 技法の要求面。`tsc`・`oxlint` 緑。

## 5. Owner 判断（2026-10-21 承認済み）

| ID | 論点 | 推奨 |
|---|---|---|
| **D-1** | post ピースを含む pizza の**既存レシピ**の識別。strict（late も常に比較）か、既存レシピは late 無視か | **strict**。現行の本番では post ピースが作れない（FINISH OFF）ため「既存レシピの識別結果は変えない」は満たされる。E3 以降、既存レシピの食材を焼成後に置くと ORIGINAL になる（lenient は後乗せレシピの双子と AMBIGUOUS になり、後乗せの一意性が崩れる） |
| **D-2** | 技法の発見経路。usage（Free で後乗せを実際にやった）＋recipe か、recipe のみか | usage＋recipe（no-sauce / tray と同じ。affordance が開くまで発見されない） |
| **D-3** | Fingerprint / Notebook で late を同一視（除外）するか | 除外（§3.5） |
| **D-4** | UD-G（名称確定・なぞかけ・Dex 文言） | 仮文言（承認済み）。**E4 前に Owner が正式決定**。仮文言は `techniques.ts` に「PLACEHOLDER」と明記 |
| **D-5** | near-miss は pure 追加のみで本番は中立 1 行のまま | 現方針維持 |

## 6. E2 の最小実装範囲（確定案、本番カタログ変更なし）

| ファイル | 内容 |
|---|---|
| `src/logic/discovery/signature.ts` | late 軸を OBSERVED（raw stage 読み取り）、`LATE_ADDITION` を supported に、型更新 |
| `src/data/techniques.ts` | `late-addition` 追加（仮文言） |
| `src/logic/techniques/detection.ts` | used / required の late 判定、`TechniqueTargetView` 拡張 |
| `src/logic/discovery/nearMiss.ts` / `src/logic/techniques/nearMissPrivacy.ts` | late 距離（+1、`LATE_ONLY`）と k 規則の答え数。RESULT 配線なし |
| `src/logic/discovery/attemptFingerprint.ts` | late を ext から除外（D-3 承認時） |
| tests | `signature.test` / `attemptFingerprint.test` の canary 更新、matcher の late、技法 detection / registration（合成カタログ）、architecture（matcher は技法を読まない）、`lateAxis.design.test.ts` を正式テストへ昇格、本番 `RECIPES`/profile 無変更の既存 gate（`finishD2Inert` / `finishCatalogGuards`）無変更 |

触らない: reducer・`finishEngine`・UI/CSS・save・`recipes.ts`・`discoveryCatalog.ts`・ladder・共有 Preview。claim の files は上記のみ。
Human Verification: 本番で可視の変化が無い inert 変更のため動画は対象外（POLICY の適用対象は UI/UX/gameplay の可視変更）。E3 / E5 で必須。

## 7. 後続への申し送り

- **E3**: Free Cooking の発見解決は CONFIRM_BAKE で走る。仕上げタブを足すときは、解決を FINISH 完了後へ移す必要がある（`roundRunsFinish` が Free を除外している現状の理由）。Dinner Stage A は START_BAKE で識別するため late は常に `[]`（後乗せレシピは識別不能 = 除外方針と整合、UD-I）。
- **E4**: bbq-sauce / cilantro / ladder / レシピ追加時に Hint 5.0 gate・privacy sweep・`validateFinishCatalog` を後乗せレシピ込みで再実行。UD-F（価格・星条件）が必要。
- **E5**: 有効化の OFF ゲート方式（E4 前に決定）、実機 HV。
  - **決定（Owner 2026-10-21）**: OFF 方式は案 1（ビルド時定数によるカタログ除外）。単一の合流点は `src/data/lateCatalog.ts`（データなしの基盤。`docs/reports/TETO_FIN-E4_LATE-CATALOG-FOUNDATION_Result.md`）。本番 ON はこの定数と FINISH 本番スイッチを別の Owner 判断で同時に切り替える。

## 8. Hint 5.0 gate を E4 で再監査する条件（弱めない）

E2 は Hint 5.0 gate（`deductionProduction.gate` / G7 / privacy sweep）を**変更していない**。変えたのは「登録された技法が 4 つになった」ことを確認する 1 行（`late-addition` の affordance が本番カタログで `null` のまま）だけで、検証は強くなっている。
**後乗せレシピを本番カタログに入れる PR（E4）は、次をすべて満たすまで merge しない。**

1. `deductionProduction.gate` の技法要求レシピ allow-list（`TECHNIQUE_REQUIRING_RECIPE_IDS`）に後乗せレシピを加える**前に**、gate 全体と DH4 privacy sweep（300 ladder 状態 + seeded random 順序）をそのレシピ込みで再実行し、緑にする。gate の閾値・k・sweep 範囲は緩めない。
2. 構成（STRUCTURE）の件数が `requiredIngredients` の distinct 数と一致し続けること（後乗せ食材を数えない・別カウントにしない）。`applicationPhase` を hint / deduction / Research / Dex モジュールが読んでいないこと（grep ガード）を維持。
3. 新食材（bbq-sauce / cilantro）に `finish` / `garnish` 等の**時機を示すカテゴリ・ファミリー名**を作らない（H3 / H4）。ソースは 1 レシピ 1 種のまま（H1、G7 の sauce count tripwire）。
4. Research ○× 台帳・Notebook・Hint 事実に時機が出ない（本 PR の Fingerprint 除外と同じ性質のテストを、新レシピ込みで E4 でも通す）。
5. `late-addition` の affordance step が ladder から**導出**され（authored でない）、`ladderCredit` 規則（OD-TQ1D-2）に従うこと。`deductionProduction.gate` の INV-TQ-4 テストの `null` 期待を、その導出値の期待に更新する（この更新自体が E4 の diff に現れること）。
6. UD-F（価格・星条件）と UD-G（技法名・なぞかけ・Dex 文言）の Owner 決定済みであること。

## 9. 実装結果（E2）

実装・テスト・回帰の結果は `docs/reports/TETO_FINISH-FIN-E2_Result.md`。
