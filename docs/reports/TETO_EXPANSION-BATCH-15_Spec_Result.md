# Expansion Batch 15 — nigerian-suya-pizza 実装仕様 Result（仕様確定のための調査、docs-only）

Status: **調査と仕様案のみ。** レシピ追加・ladder / step 変更・テスト追加・PR 作成・merge・Production / 共有 Preview 更新はしていない。
基準 `origin/main` = `cfbb083`（2026-11-02 再 fetch。先行調査 `…NEXT-BATCH-15_Research_2026-11-02.md` を載せたブランチ以外に差分なし）。
branch `claude/teto-pizza-recipe-research-pllftj`。UI/UX/gameplay の実装ではないため HV 動画・スクリーンショットは対象外（`TETO_HUMAN-VERIFICATION-POLICY.md` 適用外）。

## 0. Owner 方針の反映

| Owner 方針 | 本書での扱い |
|---|---|
| ソース未指定は一律 NO_SAUCE にしない | **suya も NO_SAUCE を既定にしない。** §3 で選択肢を並べ、Owner の明示判断を前提にした |
| nigerian-suya = B15 第一候補 | 本書の対象 |
| caponata / tsukimi = HOLD 継続 | 仕様に含めない。caponata の再開条件（初期 pool 変更の承認）も触れない |
| pesto-genovese = 名称調査待ち | 含めない |
| B16 = ume-shiso | §9 の「B16 との境界」だけ記載（仕様は作らない） |
| 炙り Production ON・蒸す Research に干渉しない | §8 で重なりを確認。本書は新規 docs 1 ファイルのみ |

## 1. 事前確認（重複 Issue / PR / claim）

| 確認 | 結果 |
|---|---|
| 最新 main | `cfbb083` から動いていない（#725 Sear Phase 1 が最新） |
| open PR | expansion 系 **0 件**。`suya` / `nigerian` を含む PR・branch・claim はない（repo 内の言及は 172 matrix 系の docs のみ） |
| open Issue | B15 / suya 専用 Issue **なし**（#706 / #707 / #708 は B12・B13 の merge 済み Issue が open のまま）。**新規 Issue は作っていない**（実装着手時に Owner 承認のうえ起票） |
| 有効な claim | #724（Sear、期限 2026-11-16）のみ。#726（蒸す）は計画のみで **claim 未投稿**（着手時 S0 で投稿予定）。B15 の claim は未投稿（docs-only） |
| 過去の判断 | Batch 10 Owner Decisions: 「goulash・suya は HOLD のまま（構成外）」。NEXT-BATCH-2 Fresh Audit: 「`beef` 1 つで rendang と nigerian-suya の 2 レシピ、どちらも原典未確認かつ『チーズ下地』の解釈が重い」。**HOLD の解除は今回の Owner 方針で与えられた**と解釈するが、解除の明文は repo に無いので §10 の確認事項にした |

## 2. 原典（根拠の確認）

**pizzadb.jp は本セッションでも到達不可**（`getaddrinfo ENOTFOUND pizzadb.jp`、セッションのネットワーク許可に含まれていない）。個別ページ（`/pizzas/nigerian-suya/`）の有無も未確認。取得できるようにするには pizzadb.jp をネットワーク許可に追加する必要がある（docs: `environment.network`）。許可後に再取得すれば §2.1 の「未確認」を埋められる。

### 2.1 repo 内の証跡（これが唯一の根拠）

`docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json`（`nigerian-suya-pizza-pizzadb-p5`、比較表 `https://pizzadb.jp/compare/world-pizzas/page/5/` の 1 件、中継 2026-09-22、**独立再取得なし**、corroboration 0）:

| 項目 | 証跡の値 | 確度 |
|---|---|---|
| 名称 | ナイジェリアンスヤピザ（産地: ナイジェリア / 各地） | 比較表の 1 行 |
| 食材（ja） | 牛肉 / 玉ねぎ / ピーマン / モッツァレラチーズ | 同上 → canonical: `beef` / `onion` / `green-pepper` / `mozzarella`（matrix の token 照合は 4 件とも解決済み、未解決 token 0） |
| ソース欄 | 「その他」→ matrix `sauceBase.status = unspecified`、blocker `BASE_SAUCE_UNSPECIFIED` | **ソースの実体は不明** |
| チーズ | モッツァレラチーズ（食材欄に明記） | 比較表 |
| 生地 | 薄めの生地（matrix: standard / thin / round） | 本ゲームの生地機構は 1 種（丸）。薄さは再現しない |
| 個数・焼成条件 | **記載なし** | — |
| 投入タイミング（焼成前 / 後） | **記載なし。** `postBakeFinish` 空、`prep` 空（matrix は焼成前の通常 TOPPING として導出） | 推測の余地あり |
| 下ごしらえ（炒め・漬け込み） | **記載なし**（matrix の prep は空） | — |
| 調味（スヤ・スパイス / ピーナッツ衣） | **食材欄に無い** | モデル化しない（jerk と同じ扱い） |

### 2.2 一般知識（repo の根拠ではない・参考）

スヤは本来、スパイス（ピーナッツ入りのヤジ系ミックス）をまぶした串焼き牛肉の料理。比較表の食材欄にはスパイスもピーナッツも無い。**これは repo の資料でも原典でもないため、仕様の根拠にしない。** 名称（スヤ）に対して食材欄が貧弱である点だけを Owner に伝える（§10-Q5）。

## 3. NO_SAUCE の採否（Owner 判断。本書は確定しない）

「ソース欄 = その他」は matrix 上 `BLOCKED_PRODUCT_DECISION`（1 件ごとの判断が要る）。選択肢と、repo の資料から言えることだけを整理する。

| 案 | 内容 | 根拠になる資料 | 識別（§4） | 主な副作用・リスク |
|---|---|---|---|---|
| **S0: NO_SAUCE** | SAUCE 工程なし。`RECIPE_SAUCE_PROFILES["nigerian-suya-pizza"] = null` | 食材欄に **ソース食材が 1 つも無い**。前例: jamaican（#711、「その他」→ NO_SAUCE は**仮定**と明記）、potato-mayo（#716、**Owner 例外 2026-10-30**）。本方針は「一律はしない」ため、**suya 単独の Owner 例外として明示承認が要る** | rendang との Jaccard 0.60、部分集合・上位集合なし | key-free Hint・永続。`noSauceRecipeIds()` が 1 件増える（派生）。DH4 の「他は到達不能」契約（OD-DH4-2-9）に触れるか **未検証**（§7） |
| S1: tomato-sauce 充当 | tomato-sauce 1（PAINT） | **資料に根拠なし**（ソース欄「その他」はトマトを示さない。食材欄に無い食材を足すことになる。B11 pescatore は逆に、原典の olive-oil を省いた Owner 判断あり） | veggie-supreme / tonno / rendang と Jaccard 0.50 | 「原典に無い食材を足す」ことの Owner 承認が要る |
| S2: curry-ketchup 充当 | curry-ketchup 1 | 根拠なし | **rendang の上位集合（Jaccard 0.80、SUB/SUPER）** | **避ける**（matcher / Hint の集合関係が壊れる）。仕様案から除外 |
| S3: 専用の新ソース（ヤジ等） | 新食材 1（sauce） | 根拠なし（食材欄に無い） | 別 | **「既存食材だけ」の前提を外れる**。B15 の範囲外。やるなら別 Batch で Owner 判断 |

**本書の見立て（推奨ではなく整理）:** 資料上、追加の仮定が最小なのは S0（食材欄の 4 食材だけで成立し、ソースを発明しない）。ただし Owner 方針で「NO_SAUCE を既定にしない」ため、S0 を採るなら **「suya は NO_SAUCE」と明示する Owner 決定**が必要。S1 / S3 は資料に無い食材を足す判断になる。**どれも本書では確定しない（§10-Q1）。**

## 4. 既存レシピとの差別化（機械照合）

識別集合（食材 id、個数無視）を既存 78 レシピ（`recipes.ts`）と全比較した（late catalog の識別集合は先行 Research と同じ前提で対象外、実装時に再実行）。

| 構成 | 完全一致 | 部分 / 上位集合 | 最近傍（Jaccard） |
|---|---|---|---|
| S0 `{beef, green-pepper, mozzarella, onion}` | なし | なし | rendang-pizza 0.60（curry-ketchup を除く 3 食材が共通）、tandoori-paneer 0.50、veggie-supreme 0.38 |
| S1 `+tomato-sauce` | なし | なし | veggie-supreme / tonno-e-cipolla / rendang 0.50 |
| S2 `+curry-ketchup` | なし | **rendang の上位集合** | rendang 0.80 |

- **B12 jamaican は「0.4 未満」をテストで固定した**（`expansionBatch12.test.ts`）。S0 の 0.60 は **その閾値を超える**。実装時にテストの閾値を「完全一致・部分集合・上位集合が 0」へ緩めるか、閾値自体を Owner が決める必要がある（**既存テストの緩和は勝手に行わない**）。
- 名称: `ナイジェリアンスヤピザ` を含む / 含まれる既存名は src に無い（`suya` / `ナイジェリア` / `スヤ` の語は src に出現しない）。B12 supreme で起きた「名前が別レシピ名の部分文字列」問題の兆候なし。
- **philly-cheesesteak とは排他**: 同じ 4 食材（チーズソースを mozzarella と読んだ場合）で識別集合が一致するため、B15 では suya のみ。

## 5. 既存食材だけで実装可能か（再確認）

| 食材 | 状態 | ladder 解禁 | 描画 |
|---|---|---|---|
| `beef` | 既存（B10 PR-1、family `meat`、`beef-slices` 専用 SVG、HV 済みの色） | **step 58**（rendang の唯一の素材） | あり |
| `green-pepper` | 既存（family vegetable、Pilot E #718 で専用 SVG・#721 で接地影補正済み） | step 32 | あり |
| `onion` | 既存 | step 12（step 10 の olive-oil とも） | あり |
| `mozzarella` | 既存（初期所持） | 初期 | あり |

**判定: 新食材 0・新 SVG 0・新調理法 0・新 ladder step 0 で実装可能**（S0 / S1 の場合。S3 は不可）。レシピが makeable になるのは、最後に解禁される `beef`（step 58）を持った時点。

`ladderCredit` は **false が構造上の前提**: ladder の step は「新材料」単位で、suya は新材料を持たないため専用 step を持てない（jamaican / supreme と同じ）。credited にするには別の ladder 仕様変更が要るので、本 Batch の範囲外（§10-Q3）。

## 6. 実装仕様案（Owner 承認後に実装する内容。ソースは S0 を仮置き、Q1 で確定）

| 項目 | 仕様案 | 状態 |
|---|---|---|
| id / 名 | `nigerian-suya-pizza` / ナイジェリアンスヤピザ（evidence `nigerian-suya-pizza-pizzadb-p5`） | 名称は原典表記どおり。説明文は暫定 |
| 構成（S0） | mozzarella 2 / beef 3 / green-pepper 1 / onion 2（計 8 ピース = 8 スロットのリング）。`requiredIngredients` の順は **sauce（なし）→ cheese → toppings**（B14 で順序バグが出た箇所。Rule W の予約食材と旧 Hint 2.0 H4 が伏せる食材を一致させる） | **個数は GAMEPLAY CALIBRATION（原典に無い）。** key 候補は beef（Rule W は `selectableHint` / `hintFactMigration` の既存テストで検証） |
| 焼成窓 | 58–78（汎用窓） | 仮置き |
| 工程 | DOUGH → CHEESE → TOPPING → BAKE（NO_SAUCE は SAUCE なし）。CUT なし | 仮置き |
| 投入タイミング | **全食材を焼成前（TOPPING）**。後乗せ・下ごしらえ・炙り・蒸しは使わない | **原典に記載なし → 仮定**（Q4） |
| 属性 | `ladderCredit:false`、`lunchRush:false`、key-free Hint（永続）、CUT 許可リスト不変、`baseRewardPitz` 100 | jamaican / supreme と同型 |
| 調味 | スヤ・スパイスは**モデル化しない**（食材欄に無い） | 説明文で名称との乖離を断らない方針は Q5 |
| Reference | 8 点リング（RT-01）を `requiredIngredients` の順に連続割当。生の beef 表示（doneness 0）。Cooking Prep（炒め）は任意・一時状態で本レシピの識別・採点に影響しない | — |

### 6.1 影響（導出値。実装時に ledger / validator で確認）

| 項目 | 予想 |
|---|---|
| 件数 | recipes 85 → **86**（Pinsa 有効）/ 84 → 85、credited 76（不変）、ingredients 95（不変）、toppings 68（不変）、ladder steps 73（不変）、第 4 章 +1。**予想値**（実装で `catalogLedger.test.ts` から導出） |
| 発見 pool | **step 58 が 2 レシピ同時に makeable**（rendang + suya）。step 66（B14）・step 32（jamaican）と同型の multi-recipe step |
| **Research コホート（要注意）** | コホート = 最後に解禁される材料 = beef。現在 rendang は単独（文字なし）。suya が加わると **{rendang, suya} の 2 名コホートになり、既存の rendang のラベルが文字つき（A / B）に変わる**（B12 では veggie-supreme が「文字なし→B」に変わり、validator に `acceptedLetterShifts` を明示）。B10 Owner Decisions は「既存 recipe の文字を動かさない」を条件にしていたため、**これは明示承認が必要な既存ラベルの変更**（Q2）。どちらが A / B になるかは `researchBoard` の規則で決まり、B12 では既存が B・新規が A |
| 図鑑 | 第 4 章が増えるため、**第 4 章を全達成済みの保存は未達成に戻る**（データは消えず、表示は導出。B12 と同じ） |
| ladder / 経済 / ショップ | 変更なし（`LATE_ENTITLEMENT_FLOORS` 不変） |
| Hint 5.0 | `hint5.ladders55.json` は挿入のみの想定、`hint5.alphaFamilyOnly.json` は 1 行追加の想定。DH4 audit の番号シフト。**未検証** |

## 7. 必要なテスト（B12 / B13 / B14 の実績に基づく一覧）

1. 新規: `src/data/expansionBatch15.test.ts`（id・構成・非 credit・NO_SAUCE か充当ソース・key-free・CUT なし・差別化（§4 の閾値は Q 付き）・bake 窓）、`src/state/persistence.batch15.test.ts`（schema v2 のまま、新 id の追加のみ、旧版で未知 ID として保持）、`e2e/b15.spec.ts`（Shop → Research（匿名ラベル漏えいなし）→ チーズ → 具材 → 焼成 → NEW DISCOVERY → 図鑑、390×844 / 360×800）。
2. 追従（実装で一括更新）: `recipes.ts` / `recipeSauceProfiles.ts` / `referencePizza.ts` / `discoveryCatalog.ts` / `recipeHintRoles.ts` / `orders.ts`、`catalogLedger.test.ts`、`recipeBatchManifest.ts`（`B15_BATCH`、`acceptedLetterShifts` に rendang）、`recipeBatch.validator.test.ts`、`cookingProfiles.test.ts`（CUT 非適格一覧）、`lunchRush.exclusion.test.ts`、`progression.test.ts` / multi-recipe の step 58 行、`researchCohortLetter.*` 系（新 batch の文字検査）、`discoveryCatalog.test.ts` / `matcher.test.ts` の **BLOCKED_PRODUCT_DECISION 承認例外**（B14 の moussaka と同形）、`discoveryHint.walk.test.ts`（TOTAL 連動の確認）、Hint 5.0 golden / DH4 audit 再生成。
3. 全 Vitest を **Pinsa ON / OFF の両方**（OFF は `npm run test:pinsa-off`、CI では走らない）、`tsc -b`、`oxlint`、`vite build`、Chromium E2E、CI 11/11（WebKit 6 shard 含む）。既知の間欠失敗（#394 / #680 / #562 / #529 ほか）が出たら、失敗ジョブの再実行 1 回と記録のルール（B14 の前例。隠さない・timeout を緩めない）。
4. **privacy / anti-oracle の assertion は緩和しない**。件数 pin の再計測のみ。
5. **DH4 事前検証**: 4 食材の family は meat / vegetable / vegetable / cheese で `other` を含まず、月見型の抵触（OD-DH4-2-9）は**想定しにくいが未検証**。NO_SAUCE の場合は α sub-row 候補 gate（key-free ≥ 2）も含め、実装前に scratch 検証が要る。**scratch 検証は Owner の追加承認が前提**（NEXT-CANDIDATES-3 §5）。本書では実施していない（本セッションは `node_modules` なしで、テストを実行していない）。

## 8. セッション重なりの確認

| 作業 | 触るファイル | B15 実装との関係 |
|---|---|---|
| #724 / #725 Sear（Production ON 作業の可能性） | `src/logic/sear/**`、`PizzaStage.tsx`、`GameScreen.tsx`、`gameReducer.ts`、`App.tsx`、`src/preview/cookSear*`、`e2e/cooking-sear*` | B15 実装はこれらを**編集しない**。重なりなし |
| #726 蒸す Research（Steam Phase 1、計画のみ） | docs（branch `claude/teto-pizza-cooking-research-d2tbgv`）。着手後は `GameScreen` / `gameReducer` / `App` が対象 | B15 は clam / mussel を使わない。重なりなし。#726 の着手条件に「Sear の HOT file 編集終了」とあり、B15 は HOT file を触らないので**待たせない** |
| 本書 | `docs/reports/TETO_EXPANSION-BATCH-15_Spec_Result.md` の 1 ファイル | 重なりなし。`PROJECT_HANDOFF.md` は未編集 |

B15 実装時に触る **hot files**: `recipes.ts`、`ingredients.ts`（今回は不要）、`PROJECT_HANDOFF.md`（B14 は編集したが、Sear / Steam と衝突しないよう**別 PR か最小追記**にするかは Q6）。実装着手時の claim は次の形（**未投稿**）:

```
files: src/data/recipes.ts, src/data/recipeSauceProfiles.ts, src/data/referencePizza.ts, src/data/discoveryCatalog.ts,
       src/data/recipeHintRoles.ts, src/data/orders.ts, src/data/expansionBatch15.test.ts, src/state/persistence.batch15.test.ts,
       src/logic/catalog/testSupport/recipeBatchManifest.ts, catalog 件数 pin 系テスト, golden, e2e/b15.spec.ts, docs/reports/TETO_EXPANSION-BATCH-15_*
```

## 9. iPhone HV と保存互換性

**HV（UI/UX/gameplay の追加に該当 → ポリシー適用。実装 PR で実施。本書は適用外）**
- 動画（390×844、リポジトリには入れず Owner へ直接提出）＋スクリーンショットを `docs/reports/screenshots/b15/` に（新規レシピなので before なし）。
- 実機（iPhone Safari）で確認する点: ① green-pepper のトレイ絵文字が赤い唐辛子に見える既知の件（B12 HV の指摘。識別性は別課題）② beef の生の見た目（`beef-slices`）がチーズ・玉ねぎ・ピーマンと識別できるか ③ 8 スロットのリングで beef 3 / onion 2 / mozzarella 2 / green-pepper 1 が収まるか ④ NO_SAUCE の場合、SAUCE 工程が無いことの案内文（「ソースなし」）と Hint ⑤ step 58 の Shop / Research で匿名ラベルから rendang・suya の名前が漏れない（`？？？ピザ A / B（牛肉）`）⑥ 横スクロールなし。
- 実機は Owner の HV。Preview は共有（Production と origin 共有、save 共有）のため、更新は Owner 承認が前提（`TETO_SESSION-OPERATIONS_1.0.md` §5）。

**B16（ume-shiso）との境界:** B15 は ladder の新 step を作らない（73 のまま）。B16 の `umeboshi-paste` は **step 74** を使う想定で、B15 と衝突しない。ただし `acceptedLetterShifts`・件数 ledger・golden を同じファイルで編集するため、**B15 を先に merge してから B16 が rebase**（hot file の merge 順を claim に明記）。

**保存互換（想定。実装でテストを追加）**
- schema v2 のまま、新 id の追加のみ。save key・migration なし。
- 旧版が suya を知らない保存を読んでも、未知 ID として保持して再保存で落とさない（`persistence.batch12.test.ts` / `batch13` の型、#674 の前例）。
- Dex は導出。第 4 章の達成表示は戻り得る（データは消えない）。
- Research のコホート文字（rendang）は**保存されない表示導出**。過去の「Research の識別履歴」に文字が入っていないかを実装前に確認（Q2 の前提）。

## 10. Owner 判断が必要な事項（資料に根拠がなく、本書で確定していない）

| # | 判断 | 備考 |
|---|---|---|
| Q1 | **ソース: S0（NO_SAUCE を suya の例外として明示承認）/ S1（tomato-sauce 等を充当）/ S3（新ソースを別 Batch）** | 資料に根拠のある案は無い。S2（curry-ketchup）は rendang の上位集合になるため除外を提案 |
| Q2 | **rendang の Research ラベルが文字つきに変わること（コホート {rendang, suya}）を許容するか** | B10 の「既存の文字を動かさない」方針との整合。許容しない場合、B15 は成立しない（beef が key のため） |
| Q3 | `ladderCredit: false`（ladder を進めない）でよいか | 構造上、新材料なしでは credited にできない |
| Q4 | 全食材を焼成前の TOPPING に置く（後乗せ・下ごしらえなし）でよいか | 原典に記載なし。個数（beef 3 ほか）・焼成窓 58–78・説明文も仮置き |
| Q5 | 名称（スヤ）と食材欄の乖離（スパイスなし）を説明文でどう扱うか（jamaican は「調味は構成に無い」と別途明記） | 原典表記の維持と、プレイヤーの期待のずれ |
| Q6 | `PROJECT_HANDOFF.md` の addendum を B15 PR に含めるか、別 PR にするか | Sear / Steam と hot file の重なりを避けるため |
| Q7 | HOLD 解除の確認（Batch 10 Owner Decisions の「suya は HOLD」を、今回の方針で解除したものとして扱ってよいか） | 解除の文面が repo にない |
| Q8 | §4 の差別化閾値（jamaican は Jaccard 0.4 未満を pin、suya は 0.60）をどうするか、および DH4 scratch 検証の追加承認 | 既存テストの緩和は Owner 判断 |
| Q9 | 原典確認: pizzadb.jp をネットワーク許可に追加し、個別ページ（あれば）から投入タイミング・調味を確認するか | 許可後なら本セッションで再取得できる |

## 11. 実施しなかったこと

コード・テスト・e2e・workflow・データの変更、レシピ・食材・step・ladder の追加、Issue・PR の作成、merge、Production・共有 Preview 更新、claim の投稿、scratch 検証・テスト実行（`node_modules` なし）、pizzadb.jp の取得（到達不可）、他セッション（Sear / 蒸す）のブランチ・ファイルの変更。
