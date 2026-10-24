# #577 Pinsa Romana — Q7 確定案: コホート文字と validator の名前付き例外（docs-only）

Status: **決定記録（Owner 方針に基づく確定案）。** `src/**`・`e2e/**`・workflow・データ・CSS・本番スイッチ・共有 Preview は変更していない。**P3-b-1 以降の実装は開始していない（HOLD）。** 本番 FINISH / Late Catalog は OFF のまま。PR 作成・merge は別途 Owner 判断。
基準 `main` = `485c515`（#645 = `7be518b` を含む）。作成日 2026-10-23。Issue #577。
関連: `TETO_PINSA-577_P3_L1-DECISIONS_2026-10-23.md`（L1 / D1〜D8）、`docs/design/TETO_PINSA-577_P3B_IMPLEMENTATION-PLAN_2026-10-23.md`（Q7 は P3-b-1 着手前に確定、と記録済み）。

## 1. Owner 方針（2026-10-23）

1. コホート文字は**既存の自動分類を原則維持**する（手書きの文字割り当て・固定表を作らない）。
2. validator の名前付き例外は **`pinsa-romana` だけ**に限定する。
3. jamon の A/B ラベル文字の変化は、**ON 時の影響を検証してから許容**する。
4. **OFF 時の図鑑・Research・ヒント表示は変更しない。**

## 2. 照合した実装（main `485c515`）

| 項目 | 実装 | 根拠 |
|---|---|---|
| コホートの定義 | 「解禁の根拠となる素材（unlock ingredient）が同じレシピの集合」。unlock = レシピの有限素材のうち、**所有順（ladder の取得順）で最後に取得した素材**。**所有だけから計算し、Dex を見ない**（発見済みの兄弟も枠を保つ） | `researchEntry.ts` `unlockIngredientOf` / `researchCohortLetters` |
| 文字の決め方 | 2 件以上のコホートだけに文字。メンバーを `opaqueHash(recipeId)`（FNV-1a、id のみの関数）の昇順、同値は id 順に並べ、A, B, C… | 同上 |
| 表示 | `researchEntryLabel` が唯一の権威（Dex・PREPARE・RESULT・Hint シート・Trial Notebook が共有）。単一コホートは「？？？ピザ（ルッコラ）」、複数は「？？？ピザ A（ルッコラ）」 | 同上。何も保存しない（OD-R2-2） |
| 既存 recipe への文字の変化の扱い | Recipe Batch Validator（test support）の `validateBatchManifest` が、既存レシピの文字の変化を `COHORT_LETTER_SHIFT` として検出する。**Owner が許容した変化だけ**、manifest の `acceptedLetterShifts`（`recipeId -> "<前>-><後>"`、文字なしは `-`）に**レシピ id 付きで**書く。書いた変化が起きなければ `ACCEPTED_LETTER_SHIFT_NOT_OBSERVED`、存在しない id は `ACCEPTED_LETTER_SHIFT_UNKNOWN_RECIPE` | `recipeBatchValidator.ts`。前例: Batch 8a（`pesto-caprese: "-->A"` など。`recipeBatch.validator.test.ts`） |
| `ladderCredit:false` の新レシピ | `COHORT_UNLOCK`（新レシピが自分の key 素材で解禁する、の検査）は**クレジット対象の batch recipe にだけ**かかる。`pinsa-romana` は `ladderCredit:false` なのでかからない | 同 `filter((m) => m.ladderCredit !== false)` |

## 3. jamon の文字が変化する条件

**現状（OFF）**: arugula（ladder step 33）をキーにするコホートは `jamon-serrano-pizza` **1 件だけ**（`prosciutto-crudo` は step 前、`rucola-e-grana` の最後の素材は grana-padano、`california-style-pizza` は avocado / goat-cheese）。単一コホートなので文字なし。

**ON（`LATE_CATALOG_PRODUCTION = true`、`RECIPES` に `pinsa-romana` が入る）**: Pinsa は新しい有限素材を持たず、素材集合が jamon と同じ（tomato-sauce / mozzarella / prosciutto-crudo / arugula）なので、**unlock も arugula**。コホートは `{pinsa-romana, jamon-serrano-pizza}` の 2 件になり、文字が付く。

| 条件 | 内容 |
|---|---|
| 変化が起きる**唯一の**条件 | ON ビルド **かつ** プレイヤーが jamon / Pinsa の有限素材をすべて所有（= arugula を取得済み。登録可能） |
| 文字の割り当て | `opaqueHash("pinsa-romana") = 2311783635` < `opaqueHash("jamon-serrano-pizza") = 3956006712` → **Pinsa = A、jamon = B**（導出。実装 PR のテストで再導出して固定する。**Pinsa の id を変えると割り当てが入れ替わりうる**ので id を P3-b-1 で固定する） |
| jamon 未発見のプレイヤー | Research の jamon の表示が「？？？ピザ（ルッコラ）」→「？？？ピザ B（ルッコラ）」に変わる（`-->B`）。候補が 1 → 2 件になり、HOME の「レシピ発見」直行（候補 1 件のとき）が選択画面になる |
| jamon 発見済みのプレイヤー | jamon は Research のエントリではないので表示は変わらない。**Pinsa のエントリが新しく現れ**、「？？？ピザ A（ルッコラ）」となる（発見済みの兄弟も枠を保つ規則 OD-R2-3） |
| 変化しないもの | 他のどのコホートの文字（Pinsa は他の素材のコホートに入らない）、Dex・保存データ（文字は保存しない）、jamon のレシピ・target・発見データ（D2） |
| 発生しないケース | OFF ビルド（`pinsa-romana` は `RECIPES` に存在せず、`researchCohortLetters(RECIPES)` の入力が従来と同一） |

## 4. validator の名前付き例外 — 最小設計

**結論: validator のコードは変更しない。** 既存の `acceptedLetterShifts`（batch ごと・recipe id ごと・変化の内容ごとの Owner 承認）がすでに「名前付き例外」の機構であり、`pinsa-romana` の batch にだけ次の 1 行を持たせれば足りる。

```
batchId: "pinsa-romana", status: "landed", afterRecipeId: <ON の `RECIPES` で pinsa の直前のレシピ（現在は ikura-salmon-pizza）>,
recipes: [{ recipeId: "pinsa-romana", keyIngredientId: <`BatchRecipe` の必須項目。新素材を持たない前例（Batch 8a）の書き方に倣う。P3-b-3 で確定>,
            ladderCredit: false, lunchRush: false, cut: false, hint: "key-free"（G17 で確定） }],
acceptedLetterShifts: { "jamon-serrano-pizza": "-->B" }
```

- 例外は **(1) `jamon-serrano-pizza` だけ、(2) `-->B` の 1 種類だけ**。他のレシピの文字の変化は `COHORT_LETTER_SHIFT` のまま失敗する。観測されなければ `ACCEPTED_LETTER_SHIFT_NOT_OBSERVED`（OFF の view では例外が失敗として顕在化するので、ON の view でだけ評価する）。
- 暗黙の緩和にしない: 共有の allowlist 定数・id の判定分岐・`if (recipeId === "pinsa-romana")` を validator に入れない。manifest が Owner 承認の単位。
- 追加の否定テスト（P3-b-3）: ① 例外が `{ "jamon-serrano-pizza": "-->B" }` ちょうど（他の key・他の値を持たない）、② `acceptedLetterShifts: {}` にすると `COHORT_LETTER_SHIFT: jamon-serrano-pizza - -> B` で失敗、③ 別レシピの文字を変える変更（例: 別 recipe を arugula コホートへ足す）は失敗、④ `ladderCredit:false` の Pinsa が ladder step を追加しない（`LADDER_ORDER` が空と一致）。
- 旧計画書・設計書の「validator にコホート例外を名前付きで追加」（P3-b-3 (4)、設計書 §5.2 / §12.2）は、本書により「**manifest の `acceptedLetterShifts` に 1 行**」と読み替える（validator 本体は無変更）。

## 5. 受入条件

### OFF（本番）— すべての P3-b PR の共通条件
- 図鑑・Research・ヒント・Trial Notebook・Pizza Select・HOME の表示が**従来と同一**。jamon の Research ラベルは「？？？ピザ（ルッコラ）」のまま。
- `researchCohortLetters(ownedIds, RECIPES)` が従来と同じ結果（`RECIPES` が OFF で `pinsa-romana` を含まない。`lateCatalog.offGolden.test.ts`、`researchCohortLetter.test.ts`、`researchLabels.batch8a.test.ts` が無修正で通る）。
- `RECIPE_BATCHES` / `NEXT_RECIPE_BATCH` と validator の既存テストが無修正で通る（Pinsa の manifest は OFF の view では評価しない）。
- save スキーマ・技法台帳・Dex が不変。

### ON（`vi.doMock` で ON にした実カタログ。P3-b-2〜b-4）
1. **文字の導出**: arugula コホートが `{pinsa-romana, jamon-serrano-pizza}` で、`pinsa-romana = A`、`jamon-serrano-pizza = B`。他のコホートの文字は ON/OFF で完全一致（差分が jamon・pinsa の 2 件だけ）。
2. **validator**: §4 の manifest で `validateBatchManifest` が空配列。否定テスト ①〜④ が通る。
3. **jamon 未発見**: ラベルが「？？？ピザ B（ルッコラ）」になり、Dex・PREPARE・RESULT・Hint シート・Trial Notebook の**すべての面が同じ文字列**（`researchEntryLabel` が唯一の権威であることの確認）。Notebook は文字を保存せず、再導出で読めること。
4. **jamon 発見済み**: jamon の表示は変わらず、Pinsa は「？？？ピザ A（ルッコラ）」。jamon の枠 B は再利用されない（OD-R2-3）。
5. **Research の候補数 1 → 2**: HOME の直行ルート、Pizza Select の routing、Hint シートの `CHOOSE_RESEARCH` を一覧化して更新（PK-14）。
6. **漏えいしない**: 文字・ラベルが、レシピ名・id・ピンサ・生地・後乗せ・時機・コホートの大きさを示さない（INV-B7）。登録できない（素材未所有の）Pinsa が文字から読めない。T1〜T6（D3）と同時に確認。
7. **id 固定**: `pinsa-romana` の id が変わると A/B が入れ替わりうるため、id を P3-b-1 で固定し、`-->B` の観測が壊れたらテストが落ちること。
8. **実機 HV（E5）**: ON ビルドで jamon の表示が「B」に変わること、候補が 2 件になること、HOME の直行が選択画面に変わることを、iPhone Safari 実機で確認（D7 と同じ枠）。

## 6. P3-b-1 の着手条件（Q7 関連）

- **Q7 は本書で確定**（Owner の最終承認は PR のレビュー / merge で行う）。P3-b-1 の前提としての Q7 は解消される。
- P3-b-1 自体の着手には引き続き、**#639・#640 の merge と、Owner の着手指示**が必要。
- P3-b-1 で行うこと（Q7 関連）: `pinsa-romana` の id を確定し、ON 相当の view で文字（A/B）を導出するテストを**データと同じ PR には入れず**、P3-b-2 / b-3 に置く（Owner 判断「b-1 と b-2 は別 PR」）。b-1 は OFF で挙動不変であることの確認のみ。

## 7. 残る未確定事項

- Q7 の運用面: 「jamon の文字が B になる」ことの**許容は ON 時の実機 HV（E5）で最終確認**する（Owner 方針 3: 影響を検証してから許容）。検証前に ON にしない。
- 上記以外（CUT・Q8 の正式値・D7・AC-8・G-4・原典確認）は計画書 §5 のとおり変更なし。
- 数値（hash 値・A/B の割り当て）は本書作成時の `main` で手計算した値で、**実装 PR のテストで再導出する**まで権威とはしない。
