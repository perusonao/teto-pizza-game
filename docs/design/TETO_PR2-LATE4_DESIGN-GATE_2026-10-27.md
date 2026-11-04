# PR-2（late4: プルコギ / 焼肉 / わさび牛 / たらこクリーム）設計 Gate（docs-only）

Status: **設計と調査結果の記録のみ。** `src/**`・`e2e/**`・CSS・テスト・golden・データ・workflow・本番スイッチは変更していない。実装・PR 作成・merge・Monitor 作成・共有 Preview 更新・GitHub への書き込み（claim・コメント・クローズ）は行っていない。他セッションのブランチ（#679 の `claude/bbq-chicken-late-catalog` ほか）には push していない（読み取りのみ）。
基準 `origin/main` = **`f243c52`**（#683、2026-10-27）。作業ブランチ `claude/teto-pizza-pr2-late4-design-jax0kc`（本書 1 ファイルのみ追加）。
**「推奨」は助言であり Owner Decision ではない。未回答を承認済みとみなさない。原典（pizzadb.jp）には到達していない（matrix とリポジトリ内証跡のみ）。**
読んだ資料: `CLAUDE.md`、`docs/PROJECT_HANDOFF.md`（先頭〜2026-09-21 の addendum と起動チェックリスト。**late catalog・本番スイッチの現況は HANDOFF に無く（最新の addendum は 2026-10-20 止まりで「Updated」行は 2026-09-18）、チェックリスト 3 の規則どおり新しい GitHub の状態と `TETO_STATE-SYNC_2026-10-26.md` を正とした**）、`TETO_SESSION-OPERATIONS_1.0.md`、`TETO_STATE-SYNC_2026-10-26.md`、`TETO_NEW-SAUCES-B_U0-GATE_2026-10-25.md`、`TETO_EXPANSION-BATCH-9_OWNER-DECISIONS.md`、`TETO_FINISH-D2_OWNER-DECISION-TABLE.md`、Fresh Audit 2 本（`TETO_RECIPE-EXPANSION_NEXT-BATCH-2_Fresh-Audit.md`＝基準 `cea6904` で**件数は古い**、`…YUZU-TSUKIMI_Pre-Implementation-Audit.md`）、172 matrix（行 41・123・151・153）、`src/data/lateCatalog.ts`（main と #679 head `933e518`）、#679 の本文・全コメント・変更ファイル一覧、#611 の全コメント、#679 ブランチの `TETO_BBQ-CHICKEN_FINAL-DESIGN-GATE_2026-10-27.md` / `TETO_NEW-BBQ_Result.md`、他ブランチの優先度表。

## 0. 結論

| 項目 | 結果 |
|---|---|
| 設計の確定 | **4 レシピとも仕様案を確定できた**（§3〜§6）。ただし下の「構造制約」により、案の自由度は小さい |
| 実装開始 | **不可。** Owner 判断が §9 に 9 件、先行条件（§10）が未達。特に **yakiniku は原典に「炒める下ごしらえ」の証跡があり、OD-B9-16 に照らして Owner の明示判断が要る** |
| 最大の技術リスク | **DH4 の「独立攻撃者」sweep が 120 秒の固定 timeout の 98% に達する**（§8.2）。#679 の時点で既に余裕が小さく、PR-2（と PR-1）で超える見込み。緩和でなく構造的な対処が要る |
| `PR-1` | **GitHub 上で特定できなかった**（open PR・Issue #611/#578/#679 の全コメント・ブランチ名・claim に該当なし）。#679 とは別物と解釈した。依存は §7 に「#679 と同じ扱い」で整理し、PR-1 の内容は Owner に確認する（§9 OD-L4-9） |

### 構造制約（コードから確定した事実。設計の前提）

`validateLateCatalog`（`lateCatalog.ts`）の規則:

1. **late レシピは必ず `POST_BAKE` 要件を 1 つ以上持つ。** 持たないレシピは late catalog に入れられず、通常カタログ（`recipes.ts`、HOT）に入れることになる。
2. **`ladderCredit:false` の late レシピは late 専用の食材を使えない**。逆に credited の late レシピは**ちょうど 1 つの late step の key** でなければならない（= 新しい食材を持つ step が要る）。
3. `white-sesame` は late 専用食材（U2 で登場、step 59）。よって **プルコギ・焼肉は白ごまを `POST_BAKE` にする場合のみ late catalog に入る**（通常カタログからは late 専用食材を使えない）。これは dengaku と同じ GAMEPLAY ASSUMPTION（仕上げの白ごま）で、原典の事実ではない。
4. 2 から、**どの late レシピも「自分の step」と新食材を最低 1 つ要する**。新食材 0 のレシピ（非 credit 枠）は、late 専用食材を使う限り作れない。

## 1. 現況（main `f243c52`）と #679

| 項目 | 値 | 出どころ |
|---|---|---|
| late catalog | `LATE_CATALOG_PRODUCTION = true`（E5 以降）。late レシピ 4（ikura / yuzu-shrimp / eggplant-dengaku / eggplant-tahini）+ Pinsa（`PINSA_PRODUCTION = true`、`ladderCredit:false`、step なし） | `lateCatalog.ts`、`pinsaGate.ts` |
| late step | 57 roe / 58 yuzu-kosho / 59 miso + sesame / 60 tahini + pomegranate（番号は「通常 ladder 56 + k」の**導出**） | 同 |
| `LATE_ENTITLEMENT_FLOORS` | 57 / 58 / 59 / 59 / 60 / 60（固定定数。**PR ごとに自分の行を足す規則**） | 同 |
| #679（BBQ、open、merge 禁止） | head `933e518`。late step 61（`bbq-sauce` + `cilantro`）、floors 61/61、recipes 70 / ingredients 77 / ladder 61。CI 全件 success、Codex 指摘なし。**Owner の実機 HV 未実施**。実装担当は `01E7dMxPKhEEBDd9GWYtU64L` に一本化済み（#611 のコメント。他セッションは push 禁止） | #679、#611 |
| #683（merged） | Pinsa **OFF** スイートの late 一覧を現行カタログへ。`TETO_PINSA_OFF=1` は CI で走らない | main |
| #684（open） | DH4 `preExistingPublic` を全探索で pin する**テスト追加**（`deductionProduction.gate.test.ts` 周辺）。PR-2 と同じ pin を触る | PR 一覧 |
| #540（Draft・HOLD） | `recipes.ts`・`recipeSauceProfiles.ts`・`referencePizza.ts`・`hint5.ladders55.json` を触る。先に merge されない | #611 コメント |
| 有効な claim | #611: `01E7…`（BBQ 実装、`lateCatalog.ts` 等 10 ファイル、期限 11/03）。#611 の旧 claim（late-catalog-foundation、期限 10/28）は実質完了と推定。#578 の U3 claim は #679 Result §10 に「元セッションが release 済み（10/27 00:43Z）」とある（#578 の全コメントは未再確認） | #611、#679 Result |

**PR-2 は #679 と `lateCatalog.ts`（レシピ・食材・step・floors・orders・taxonomy・size class）、`IngredientGlyph.tsx`、`App.css`、`hint5.ladders55.json`、DH4 監査 JSON、`catalogLedger.test.ts`、件数 pin を共有する。#679 より後に作る場合、#679 を取り込んでから着手する以外に安全な方法はない。**

## 2. 食材・レシピの現況（matrix と main の差）

| 食材 | main | 今回 | 備考 |
|---|---|---|---|
| beef / soy-sauce / yakiniku-sauce / wasabi / cod-roe / fresh-cream-sauce / nori | **いずれも無い** | 新規 7 | 既存と衝突する id・表示名・emoji なし（下記 G18 を除く） |
| white-sesame | late 専用（step 59）、family `spice`、`xs` | 流用 | dengaku と共有 |
| miso-sauce | late 専用（step 59）、`#9a5b2e` | 流用候補 | プルコギ案 C |
| fromage-blanc-sauce | 通常（Flammkuchen）、`#fffdf8` | 流用候補 | たらこクリーム案 S2 |
| shiso | 通常（step 54）、`herb`、`xs` | 流用 | |
| mozzarella / onion | スターター / step 12 | 流用 | |

matrix の 4 行（プルコギだけが `BLOCKED_PRODUCT_DECISION`、他の 3 行は `READY`）:

| 行 | 材料（matrix） | ソース欄 | 機構の証跡 | 判定 |
|---|---|---|---|---|
| `bulgogi-pizza-pizzadb-p11` | beef / mozzarella / onion / white-sesame | 甘辛だれ・**未特定**（`BASE_SAUCE_UNSPECIFIED`） | なし | FULL、`BLOCKED_PRODUCT_DECISION` |
| `yakiniku-pizza` | beef / mozzarella / onion / white-sesame / yakiniku-sauce | 甘辛だれ・listed | **`PREP_STEP`: 牛を炒める**（`source_profile_text`＝個別ページ由来の記述） | PARTIAL、READY |
| `wasabi-beef-pizza` | beef / mozzarella / onion / soy-sauce / wasabi | その他・listed（soy-sauce） | **`LATE_ADDITION`: `post_bake`、わさびは焼き上がり後に添える**（`source_profile_text`） | PARTIAL、READY |
| `mentaiko-cream-pizza-pizzadb-p4`（名称「たらこクリームピザ」） | cod-roe / fresh-cream-sauce / mozzarella / nori / shiso | ホワイトソース・listed | **`LATE_ADDITION`: `mid_bake`、たらこは焼成の最後の数分に加える**（`source_profile_text`） | PARTIAL、READY |

読み方: **わさび牛とたらこクリームは late catalog の既存の型に乗る。焼肉は「炒める下ごしらえ」が証跡付きで、そのまま通常の型では欠落する。プルコギはソースが空白で、Owner の補完が要る。**

## 3. 優先事項 1: プルコギのソース候補（soy-sauce / yakiniku-sauce ほか）

候補ごとの比較（プルコギの材料集合 = beef / mozzarella / onion / white-sesame + ソース）。識別は「材料集合」で行われ、個数は識別に入らない。

| 候補 | 集合の差（対 焼肉 / 対 わさび牛、対称差の個数） | 新食材 | 証跡との整合 | 色（CIE76、生の色どうし） | 判定 |
|---|---|---|---|---|---|
| **B: `yakiniku-sauce`** | **0（焼肉と完全一致）** / 4 | 0 | 甘辛だれ系で整合 | — | **不可。** 焼肉と同じ集合になり、発見の識別が成立しない（片方が到達不能になる）。個数は識別外。焼肉との違いを「下ごしらえ」で作る案は、下ごしらえが未モデルのため不成立 |
| **A: `soy-sauce`** | 2 / **2** | 0（わさび牛と共有） | 甘辛だれ系の `matches`（miso / okonomiyaki / sweet-bean / teriyaki / yakiniku）に**含まれない**＝補完 | 醤油 `#2a1a12` は既存ソースとの最小距離 35.2（tahini） | 可。ただし**プルコギとわさび牛が同じソース色**で、違いは xs の仕上げ（白ごま↔わさび）だけになる |
| **C: `miso-sauce`（既存）** | 2 / **4** | 0（既存を流用） | 甘辛だれ系の `matches` に**含まれる** | 既存色 `#9a5b2e`、焼肉案 `#4a2412` との距離 31.2 | **推奨。** 3 つの牛肉レシピがそれぞれ別のソース（miso / yakiniku / soy）になり、集合の近さが最小。dengaku と miso を共有するが、集合は別（eggplant / miso / mozzarella / sesame ↔ beef / miso / mozzarella / onion / sesame） |
| D: 新規 `bulgogi-sauce` | — | +1 | 補完 | — | 不採用。ソースが 4 つ増え、トレイ（ソースは既に 2 ページ目）と色の密度が悪化する |

**注意:** どの候補を選んでも、プルコギのソースは**原典の事実ではなく Owner の補完**（`BASE_SAUCE_UNSPECIFIED`）。Hint 5.0 / DH4 の観点では A・C のどちらでも新しい leak 経路は作らない（§8）。

## 4. 優先事項 2: プルコギと焼肉の材料集合衝突の解消

- 衝突の原因: 両者は beef / mozzarella / onion / white-sesame を共有し、ソースが「甘辛だれ」で、焼肉の `yakiniku-sauce` を流用すると集合が一致する。
- **解消方針（構造的）:** プルコギのソースを `yakiniku-sauce` にしない（§3 の A か C）。これで 3 レシピは互いに 2〜4 要素違う別集合になる:

| ペア | 案 C（miso） | 案 A（soy） |
|---|---|---|
| プルコギ ↔ 焼肉 | 2（miso ↔ yakiniku-sauce） | 2（soy ↔ yakiniku-sauce） |
| プルコギ ↔ わさび牛 | 4 | **2**（白ごま ↔ わさび） |
| 焼肉 ↔ わさび牛 | 4 | 4 |

- 近い集合（対称差 2）は**研究の取り違え**（Research の ○× / near-miss）を起こしやすい。C は最小距離 2 が 1 組、A は 2 組。
- 後乗せ軸: プルコギ・焼肉は白ごま `POST_BAKE`、わさび牛はわさび `POST_BAKE`。軸は「後乗せの食材集合」まで見るため、**焼成前に白ごまを置いた場合は別物になる**（dengaku と同じ。説明文・Dex・ヒントは時機を名指ししない）。
- 焼肉の「炒め」は未モデルのため識別に入らない。**将来 `PREP_STEP` が入る場合も、プルコギのソースが焼肉と別であれば既存の識別は動かない**（これが A/C を選ぶもう一つの理由）。

## 5. 優先事項 3: わさび牛の確定仕様（4 レシピのうち最も証跡が強い）

| 項目 | 仕様案 | 根拠・状態 |
|---|---|---|
| レシピ id / 名 | `wasabi-beef-pizza` /「わさび牛ピザ」。discovery target = `wasabi-beef-pizza` | matrix の evidence id |
| 材料と個数 | `soy-sauce` 1（PAINT）/ `mozzarella` 2 / `onion` 1 / `beef` 3 / `wasabi` 1（**POST_BAKE**）= 非ソース 7 ピース（焼成前 6 + 仕上げ 1） | 個数は **GAMEPLAY CALIBRATION（暫定）**。**わさびが焼成後は matrix の `source_profile_text`（個別ページ由来の記述）。ただし独立再取得はしていない** |
| 焼成窓・経済 | 58–78 / `baseRewardPitz` 100 / `lunchRush:false` / CUT なし / key-free Hint / `ladderCredit` は**既定の credited**（自分の step の key） | 前例（U1〜U3、#679） |
| 価格 | 全新食材 **T4**（初回パック 120 Pitz / 補充 60 Pitz、個別設定なし。`materialShop.ts` の tier は「step ≥ 30 = T4」）。1 パック = 10 回分 × そのレシピでの最大個数: beef 30 個、cod-roe 20 個、他 10 個 | `materialShop.ts` |
| 星ゲート | なし（前例どおり。slack は §8.3 のとおり 1 を維持） | OD-B8-1 / U1〜U3 |
| `beef` | topping / scatter、family **`meat`**（`xs/s/m/l/xl` は `m`。chicken / pork と同じ）、emoji は**必ず 🥩 以外**（🥩 は `meat` の family 記号で G18 違反。仮データで `🥩: expected true to be false` を再現した）。専用 SVG **`beef-slices`** を推奨（薄切りの赤褐色のリボン 2〜3 枚、脂の筋）。肉の emoji で牛肉に見えるものが残っていない | `familyDisplay.ts`（meat = 🥩）、Style Lock v2 |
| `soy-sauce` | category sauce、spread、PAINT、family 行なし（sauce は topping 専用表の外）。**色は暫定 `#2a1a12`**（既存ソースとの最小距離 35.2）。表示名「醤油ソース」 | 色は実機 HV で確定 |
| `wasabi` | topping / scatter、family **`spice`**（「スパイス・薬味系」＝ white-sesame と同じ、L1 のみ）、size `xs`、**専用 SVG `wasabi-dab`（下記）**、`POST_BAKE` | OD-B8-2 型の batch-scoped L1（Owner 承認が要る） |
| SVG `wasabi-dab` | 64×64 viewBox、地面の影の楕円（opacity .15）、外形線は暗い緑（太さ 2.2 の既存規則）、塗りは**黄緑寄りの淡い緑**（`#a8d070` 前後。cilantro `#6cae3e`・pesto `#6b8e3d` と区別）、形は**なめらかな丸い小山 1 個 + 上面の小さな渦のハイライト**（おろしたペーストの質感）。葉・輪・粒の既存形（shiso-leaf、green-onion、cilantro-leaf、sesame-seeds）と**シルエットで区別**。1em で描画し `xs`（×0.7）でも「緑の小さな山」と読めること。決定性（乱数なし）、`id`/グラデーション属性なし。必要なら `.ingredient-glyph--wasabi-dab` に 1.2em 補正（要否は実測） | Style Lock v2 の型。**最終確認は Owner の実機 HV。パセリ ☘️・cilantro と「緑の塊」に見える懸念が #679 と同様に残る** |
| ラダー | 自分の late step の key（§7.2 の表） | |

## 6. 優先事項 4: たらこクリームの確定仕様（ソースと nori の分類）

| 項目 | 仕様案 | 根拠・状態 |
|---|---|---|
| レシピ id / 名 | id `mentaiko-cream-pizza`、nameJa「**たらこ**クリームピザ」（matrix は `mentaiko-cream-pizza-pizzadb-p4` / たらこ。**明太子（辛い）ではない**。別行 `mentaiko-mochi-pizza` は `mentaiko` という別食材）。食材の表示名は「たらこ」 | **id と表示名の不一致（mentaiko / たらこ）は Owner 判断**（OD-L4-6） |
| 材料と個数 | `fresh-cream-sauce` 1（PAINT）/ `mozzarella` 2 / `cod-roe` 2（POST_BAKE）/ `nori` 1（POST_BAKE）/ `shiso` 1（POST_BAKE）= 非ソース 6（焼成前 2 + 仕上げ 4）。ただし**仕上げが 3 種** | 個数は暫定。**時機の根拠は次の表** |
| 焼成窓・経済 | 58–78 / 100 Pitz / `lunchRush:false` / CUT なし / key-free / credited / T4 | 前例 |

### 6.1 時機（matrix の記述とゲームの工程のずれ）

| 食材 | matrix | ゲーム | 備考 |
|---|---|---|---|
| `cod-roe` | **`mid_bake`**（焼成の最後の数分に加える）。`source_profile_text` | **`POST_BAKE` に近似**（FINISH は焼成後のみで、焼成中の追加は無い） | 証跡のずれは**近似であり、原典の事実としては記録しない**。OD-B9-16 の考え方（焼成後投入が確認された場合は late catalog）に沿うが、`mid_bake` は「焼成後」ではないので Owner の明示承認が要る（OD-L4-5） |
| `nori` | 通常の材料として列挙（時機の記述なし）。**別行 `teriyaki-chicken` では `post_bake`** | `POST_BAKE`（推奨）または焼成前 | 焼成前に置くと焦げる食材で、`teriyaki` 行と揃えると「nori は常に仕上げ」の単一規則になる。焼成前案はたらこ行の記述に忠実（のりを後乗せと書いた記録はない） |
| `shiso` | 通常の材料（時機の記述なし） | `POST_BAKE`（推奨）。ikura / yuzu と同じ扱い | 通常カタログの shirasu-pizza は焼成前 shiso。**shiso の時機はレシピごとに異なってよい**（識別は後乗せ軸で分かれる） |

仕上げが 1 種（cod-roe のみ）の案も成立する。その場合 nori・shiso は焼成前（`bakeRoastResistant` は shiso と同様に必要）。**Owner 判断**。

### 6.2 ソース（案 S1 / S2）

| 案 | 内容 | 新食材 | 色・識別 | 判定 |
|---|---|---|---|---|
| **S1: 新規 `fresh-cream-sauce`**（matrix の語に忠実） | 表示名「クリームソース」、PAINT | +1（このレシピの step が 3 食材: cod-roe / fresh-cream-sauce / nori になる。前例は 1 step 最大 2 食材） | 淡い色は既に fromage-blanc `#fffdf8` と olive-oil `#e9d9a0` が占める。**象牙色 `#f1e6c8` は最小距離 15.0 で余裕が小さい。ピンクがかった乳白色 `#f2cfc0` なら 19.5** | 暫定色 `#f2cfc0`（生クリームがたらこで染まる連想）。**生地との差は未測定（実装 PR で測る。tahini の前例は、最初の色が生地に近すぎて作り直された）** |
| S2: 既存 `fromage-blanc-sauce` を流用 | 追加の食材なし | 0（step は cod-roe + nori の 2 食材） | 既存の HV 済みの色 | matrix の `ホワイトソース` の `matches` に `fromage-blanc-sauce` が**含まれる**（証跡上は許容）。ただし「たらこ**クリーム**」にフロマージュ・ブランを使う**名称のずれ**が残る |

**推奨は S1**（matrix の語に忠実で、他レシピ（miso / tahini / yuzu）の前例と同じ扱い）。**ただし 3 食材の step と淡色の密度が懸念で、HV で生地との識別が不足と出たら S2 に切り替える**（切り替えは食材 1 つと step の変更だけで済む）。Owner 判断（OD-L4-5 に含める）。

### 6.3 nori の分類（L1 family）

| 候補 | ラベル | 評価 |
|---|---|---|
| **`vegetable`**（推奨） | 野菜・きのこ | 海藻は「海の野菜」の語義。`other`（egg / almond / pine-nuts）は **OD-DH4-2-9（その他は到達不能）で使えない** |
| `herb` | ハーブ・香味 | 仕上げの香りもの（青ねぎ・シソ・パクチーと同じ扱い）。shiso と同じ family になり、たらこクリームの中に `herb` が 2 つ並ぶ |
| `seafood` | 魚介系 | cod-roe と同じ family になり、のりを「魚介」と表示してしまう。**不採用** |
| `other` | その他 | **使えない** |

測定（§8.1）: `vegetable` / `herb` / `seafood` のどれでも、DH4 の privacy 系 gate の結果は**同じ**（family の選択で gate は変わらない）。つまり**意味の妥当性で選べる**。`nori` は将来の候補（納豆・照り焼きチキン・明太子もち）でも仕上げの海苔として再利用されるので、**「仕上げ（POST_BAKE）・`xs`・同じ family」を 1 回で固定する**ほうがよい。
`cod-roe` は family **`seafood`**（`salmon-roe` と同じ、OD-B8-2）、size `xs`。専用 SVG **`cod-roe-mass`** を推奨（サーモンのいくら＝大きな橙の粒、と区別するため、淡い珊瑚ピンク `#e8836b` 前後の**細かい粒の塊**、不規則な小さな山 2〜3）。`nori` は **`nori-strips`**（黒みがかった緑の細い短冊 3〜4 本、ぱらぱら）。2 つとも Style Lock v2 の型（§5 の SVG と同じ規則）で、実機 HV が必要。

## 7. 優先事項 5: 依存関係とラダー（#679・PR-1・マージ順）

### 7.1 依存関係

```
#683 (merged f243c52, Pinsa OFF 一覧)
#679 (BBQ, open, merge禁止, Owner 実機HV待ち)  ──▶  PR-2   （lateCatalog.ts / ladder / floors / golden / DH4 pin を共有）
PR-1 (未特定)                                    ──▶  PR-2   （内容次第。late catalog の続きなら #679 と同じ依存）
#684 (DH4 全探索 pin, open, テスト追加)           ──▶  PR-2   （同じ preExistingPublic pin を触る）
#540 (Draft/HOLD)                                 ──   PR-2   （データ系 4 ファイルが重なる。先に merge されない）
```

- **直列が前提。** `lateCatalog.ts`・`LATE_ENTITLEMENT_FLOORS`・`hint5.ladders55.json`・DH4 監査 JSON・件数 pin は並行で触ると必ず衝突する。後に merge する PR が先の PR を取り込んで、**自分の late step 番号と floors を再導出する**。
- **floors は「その PR が出荷する時点の導出番号」を固定する**（規則。#679 は 61）。PR-2 の step 番号は #679 の直後なら 62〜65、PR-1 が間に入るなら 62 + k〜。番号は設計時に決めず、**取り込み後に導出**し、`lateCatalog.*.test.ts` に厳密一致で pin する（部分一致に緩めない）。
- **PR-1 が late catalog の続きでない場合**（例: 通常カタログ）は、通常 step の追加が late step を全部 +1 する（floors が必要になる理由）。PR-2 の floors は PR-1 の後に計算する。

### 7.2 PR-2 のラダー案（順序は設計案。番号は導出）

推奨（プルコギのソース = 案 C、たらこ = S1）:

| 順 | step の食材 | key レシピ | 導出される番号（#679 直後の場合） | 他の材料（既存） | Research コホート |
|---|---|---|---|---|---|
| 1 | `beef` | `bulgogi-pizza` | 62 | miso(59)・white-sesame(59)・onion(12)・mozzarella | 単独（鍵 = beef） |
| 2 | `soy-sauce`, `wasabi` | `wasabi-beef-pizza` | 63 | beef(62)・onion・mozzarella | 単独（鍵 = wasabi） |
| 3 | `yakiniku-sauce` | `yakiniku-pizza`（OD-L4-2 で保留なら無し） | 64 | beef(62)・white-sesame(59)・onion・mozzarella | 単独（鍵 = yakiniku-sauce） |
| 4 | `cod-roe`, `fresh-cream-sauce`, `nori` | `mentaiko-cream-pizza` | 65 | mozzarella・shiso(54) | 単独（鍵 = nori、食材の並び順の最後） |

- 各 key レシピは、その step の最後に解禁される食材が鍵の**単独コホート**になり、**既存レシピのコホート文字は動かない**（既存レシピは新食材を使わない）。新食材のみの Research ラベルは「？？？ピザ（牛肉）」のように**解禁食材名だけ**を出す（時機・family・数量は出さない）。
- プルコギを案 A（soy）にする場合: step 1 = `beef`, `soy-sauce`（key bulgogi）、step 2 = `wasabi`（key wasabi-beef）。それ以外は同じ。
- **credited / slack:** 4 レシピとも credited で各 1 step ＝ credited +4、step +4。星ゲートの slack（`ACCEPTED_MIN_SLACK` = 1）は不変。**仮データで `ladderReachability.starGate` は通過した**（§8）。焼肉を保留する場合は credited +3、step +3。
- **件数（Pinsa ON、#679 の後）:** recipes 70 → **74**（焼肉保留なら 73）、ingredients 77 → **84**（保留なら 83）、ladder 61 → **65**（保留なら 64）。第 4 章 +4。**実測値ではなく設計の見込み**（`catalogLedger.test.ts` の pin は実装 PR で更新する）。
- 規模の見込み: **#673（食材 2 + レシピ 1 + SVG 1）の約 3〜4 倍**（食材 7、SVG 4、レシピ 4）。**実装は 2〜3 PR への分割を推奨**（下の分割案）。分割しても PR ごとに直列で、DH4 の時間余裕（§8.2）が分割の主な理由。

分割案（助言）: ① **わさび牛 + プルコギ**（beef・soy-sauce・wasabi、SVG 2、step 2 本）② **たらこクリーム**（cod-roe・nori・cream、SVG 2、step 1 本）③ **焼肉**（OD-L4-2 の判断後）。

## 8. 優先事項 6: Pinsa ON/OFF・DH4・Research への影響（隔離コピーでの実測）

### 8.0 方法と限界

`origin/claude/bbq-chicken-late-catalog`（#679 head `933e518`）を scratchpad に展開した**リポジトリ外の使い捨てコピー**で、`lateCatalog.ts` にだけ仮データを足した（4 レシピ・7 食材・orders・discovery target・taxonomy 行・size class・4 step・floors）。`recipeSauceProfiles`・`referencePizza`・`recipeHintRoles`・golden・SVG は**足していない**ため、全体 Vitest の失敗 61 ファイルの大半は「仮データに表が無い」ことによる人工的なもので、解釈できない。**意味があるのは下の個別の測定だけ。** ソースの色・SVG・HV・Chromium E2E・WebKit は未実施。仮データは実装案の確定値ではない（`beef` の emoji など測定専用）。

### 8.1 DH4 の privacy 系 gate

| テスト | #679 head（基準） | 仮データ（プルコギ = soy、nori = `vegetable`） |
|---|---|---|
| `deductionProduction.gate`（14 件）のうち privacy・k≥2・「その他」到達不能・Pitz・文面 | 通過 | **k≥2 の 1 件のみ失敗（サンプル依存、下記）。他は通過。「その他」到達不能は通過** |
| `deductionGuard.gate` の件数 pin | 132 | **187**（pin 移動。OD-B9-15 により**実装 PR で原因分解**＝追加なし / 食材のみ / ソースのみ / レシピ追加 の順に測り直す。今回は未分解） |
| INV-TQ-4（技術許可リスト） | 通過 | **失敗（機械的）。** `LATE_ADDITION_RECIPE_IDS`（`techniqueAllowlists.ts`）に 4 id を足す（BBQ が同じ手当をした） |
| `ladderReachability.starGate` | 通過 | **通過**（slack 1 を維持） |
| nori の family を `vegetable` / `herb` / `seafood` に替えた k≥2 | — | **3 つとも同一の結果**（family で gate は変わらない） |

k≥2 の失敗は「既存公開モデルで 1 候補になる集合」(`preExistingPublic`) の**標本依存**で、`pesto-caprese` の出入り（#679 の DH4 調査コメントのとおり、40 シードの標本が食材数でずれる）。**privacy の新たな漏えいではない**が、PR-2 でも再び動く。**#684（全探索で pin）が先に入れば、その pin に追従するだけで済む。** assertion は緩めない（Owner Decision A、OD-B9-14）。

### 8.2 DH4 の時間余裕（最大のリスク）

`deductionProduction.gate.test.ts` の「独立攻撃者」sweep は `SWEEP_TIMEOUT_MS = 120_000` の固定 timeout。単独実行（同一サンドボックス）:

| 構成 | 所要 | timeout に対する割合 |
|---|---|---|
| #679 head | **91.5 秒** | 76% |
| 仮データ（4 レシピ・7 食材） | **117.1 秒** | **98%** |

3 本を並列に流した最初の実測では、仮データで **timeout（120 秒超）** になった。CI の速度はこのサンドボックスと異なる可能性があるが、**1 PR で約 +25 秒増える**ため、PR-1 と PR-2 の両方が入ると**確実に超える**。timeout の延長・retry・skip・assertion の緩和は採らない（既存の規則）。必要なのは sweep の**構造的な軽量化**（同一状態の再計算の除去など。#685 の `w1Reachability` と同じ種類の話）か、サンプリング設計の変更で、**Owner の承認と測定が先**。実装 PR の前に別 PR にするのが安全（OD-L4-8）。

### 8.3 Pinsa ON / OFF

| 観点 | 結果 |
|---|---|
| step・floors | Pinsa は `ladderCredit:false` で step を持たない。**ON でも OFF でも late step 番号と floors は同じ** |
| 4 レシピの位置 | Pinsa-gated ではない。**ON/OFF とも存在する。** `ALL_LATE_RECIPES` では **Pinsa の前**に置く（`lateCatalog.ts` の既存規則「Pinsa が末尾」を保つ） |
| 章 4 の件数 | Pinsa ON は OFF より 1 多い（#679 Result の 34 は ON）。PR-2 は ON/OFF 両方の件数を `catalogLedger.test.ts` で扱う |
| `src/data/pinsaGate.test.ts` の厳密一致 | **OFF で #679 head 自体が既に失敗する**（#683 の注意、#679 の担当へ連絡済み）。PR-2 は #679 の修正の**上に**、2 か所（late 一覧の末尾と `RECIPES.at(-1)`／最後の key レシピ、`ALL_LATE_RECIPE_IDS` の期待）へ 4 id を厳密に追加する。**`TETO_PINSA_OFF=1 npx vitest run` は CI で走らない**ため、実装 PR で手動確認が必須（ON/OFF 両方） |
| 仮データの結果 | Pinsa ON・OFF とも、#679 head は ON で通過・OFF で 2 件失敗。仮データは ON で 4 件・OFF で 5 件失敗（表欠落の人工的な失敗を含む） |

### 8.4 Research の識別子

- 新食材のみの単独コホートで、**既存の文字は動かない**（§7.2）。ladder の導出と `researchEntry.ts` のコホート定義（「最後に解禁した有限食材が同じレシピの集合」）を読んで確認した。**Research 画面・Dex・保存往復の実行検証は未実施**（実装 PR で E2E）。
- 食材の追加は `Research のコホート` を使う `？？？ピザ（○○）` ラベルに新しい食材名を増やすだけで、family・時機・数量は出ない（INV-B7）。
- **セーブ互換:** schema v2 のまま。台帳は縮まない。floors は「PR が出荷する時点の番号」を固定するので、既到達・既解禁は後退しない（`LATE_ENTITLEMENT_FLOORS` の規則）。
- #544（Research 識別子の再監査）は 53/172 件の母数拡大に関する項目で、今回の追加は単独コホートのみのため追加の再監査は不要と読めるが、**Owner が #544 の閉じ方を決める**。

## 9. Owner 判断が必要な未確定事項（空欄 = 未回答。未回答を承認とみなさない）

| # | 判断事項 | 選択肢と助言 | Owner の回答 |
|---|---|---|---|
| OD-L4-1 | 実装の分け方と順 | 助言: ①わさび牛+プルコギ → ②たらこクリーム → ③焼肉。理由: わさび牛は証跡が最も強く（Owner の次点 OD-CS-10）、DH4 の時間余裕と HV の負荷を PR ごとに分けられる | （未回答） |
| OD-L4-2 | **焼肉の扱い**（原典に「牛を炒める」下ごしらえの証跡あり） | **Y1:** 下ごしらえ未モデルの近似で出荷（OD-B9-17 の暫定仕様の延長。ただし dengaku / tahini と違い炒めは**証跡あり**で、OD-B9-16 の文言「焼成後投入・炒める工程が確認された場合は新工程の候補として再分類」と衝突するため、**Owner の明示的な例外が要る**）/ **Y2（助言）:** `PREP_STEP` が入るまで保留。プルコギのソースを焼肉と別にしておけば、後で焼肉を足しても識別は動かない | （未回答） |
| OD-L4-3 | プルコギのソース（原典は空白） | 助言: **C `miso-sauce`**（既存・甘辛だれ系・最も離れる）/ A `soy-sauce` / **B `yakiniku-sauce` は不可**（焼肉と同一集合） | （未回答） |
| OD-L4-4 | プルコギ・焼肉の白ごま `POST_BAKE` | 構造上必須（§0）。dengaku と同じ GAMEPLAY ASSUMPTION（原典の事実ではない）として承認するか | （未回答） |
| OD-L4-5 | たらこクリームの時機とソース | cod-roe の `mid_bake` → `POST_BAKE` 近似（助言: 承認）／nori・shiso を仕上げにする（助言: 仕上げ 3 種）か cod-roe のみか／ソース S1（助言）か S2 | （未回答） |
| OD-L4-6 | 命名 | recipe id `mentaiko-cream-pizza` と表示名「たらこクリームピザ」（食材「たらこ」）の不一致を許すか。助言: matrix の表記（たらこ）に統一し、id を `tarako-cream-pizza` にするか Owner が選ぶ（discovery target は matrix の `mentaiko-cream-pizza-pizzadb-p4` を維持） | （未回答） |
| OD-L4-7 | L1 family（batch-scoped） | `beef` = `meat`、`cod-roe` = `seafood`、`wasabi` = `spice`、**`nori` = `vegetable`（助言。`herb` も可、`other`・`seafood` は不可）** | （未回答） |
| OD-L4-8 | DH4 の時間余裕の対処 | #679 で 76%、PR-2 で 98%。実装前に sweep の構造的な軽量化 PR を別立てにするか。助言: 別立て（timeout 延長・retry・skip は採らない） | （未回答） |
| OD-L4-9 | `PR-1` の内容と順序 | GitHub で特定できなかった。late catalog の続きなら #679 と同じ直列依存。通常カタログなら late step が全部 +1 される | （未回答） |

## 10. 実装開始条件

1. **Owner が OD-L4-1〜9 に回答**する（特に 2・3・5・9）。回答前に新規 claim・実装 PR・ladder 登録をしない（OD-B9-13 と同じ扱い）。
2. **#679 が merge 済み**（またはマージ順の Owner 指示）。`PR-1` の取り込み順が確定している。#684 が入っていれば先に取り込む。実装は**最新 main から**、取り込み後に step 番号と floors を**導出し直す**。
3. **claim:** 実装セッションが #611（または新 Issue）に `teto-claim` を投稿する（GitHub への書き込みは Owner の承認後）。files は `lateCatalog.ts`・`ingredients.ts`・`recipeSauceProfiles.ts`・`recipeHintRoles.ts`・`referencePizza.ts`・`techniqueAllowlists.ts`・`IngredientGlyph.tsx`・`App.css`・`hint5.ladders55.json`・`hint5.alphaFamilyOnly.json`・DH4 監査 JSON・`pinsaGate.test.ts`・`catalogLedger.test.ts`・e2e・Result・参照 SVG。重なる claim（`01E7…` の #679）は解消後に着手。
4. **DH4:** §8.2 の方針が決まっている。`deductionGuard.gate` の pin は原因分解してから更新する（OD-B9-15）。privacy assertion は緩めない。
5. **Pinsa:** `TETO_PINSA_OFF=1 npx vitest run` と ON の両方で `pinsaGate.test.ts`・`lateCatalog.pinsa.test.ts`・`pinsa.production.test.ts` を確認する。
6. **美術:** 参照 SVG 4 点（`beef-slices`・`wasabi-dab`・`cod-roe-mass`・`nori-strips`）を Owner が確認する（Style Lock v2 の追記は別の docs-only PR）。emoji の fallback は G18（食材・family 記号すべてと不重複。🥩・🧂・🌊 は不可）。
7. **HV:** `TETO_HUMAN-VERIFICATION-POLICY.md` に従い、390×844 の動画（Owner へ直接、commit しない）と前後スクリーンショット（390 / 360）。実機は Owner。Preview・隔離 Artifact の公開は Owner の承認が要る。色（醤油 `#2a1a12`／焼肉 `#4a2412`／クリーム `#f2cfc0`）は**暫定**で、生地との差（`#679` と同じ ΔE 測定）を HV 前に測る。**醤油と焼肉の色は最小距離 16.7 と近い**（取り違えの恐れ）。
8. **記録:** PR・Result・コードに「暫定仕様・原典未確認」「GAMEPLAY ASSUMPTION」を明記し、原典を根拠にしない。数値と時機は 1 つのレシピ定義に集める。**merge = 即公開**なので Owner の実機 HV と最終承認まで merge しない。

## 11. 実施しなかったこと

実装・PR・merge・Monitor・共有 Preview・本番・Firebase・GitHub への書き込み。他ブランチへの push。`docs/PROJECT_HANDOFF.md`（HOT）の更新。原典 pizzadb.jp の再取得（到達不可）。実機 HV。Chromium / WebKit の E2E。ソース色と SVG の実描画の測定。`deductionGuard.gate` の pin の原因分解。Research 画面・Dex・保存往復の実行検証。#578 の全コメントの再読（claim の現況は #679 Result の記述を引用）。
