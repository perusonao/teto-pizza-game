# BBQチキン — 条件付き承認と D-1 / D-4 / D-6 の具体差分（#611、docs-only）

> **取り込み注記（PR #679、2026-10-27）:** 本書は別ブランチ `claude/teto-pizza-improvements-research-mxq1wu-c` で作成された BBQ の設計記録を、#679 に取り込んだもの（本文は無変更）。本文が参照する `tools/bbq-final-gate/*`、`docs/design/candidates/cilantro-bbq/*`、`TETO_NEXT-RECIPES-AND-PROCESSES_PRIORITY-TABLE_*`、`TETO_ISSUE-HYGIENE_*`、DRIZZLE 関連の資料は、本 PR には**含めていない**（該当ブランチに残る）。採用された `cilantro-leaf` の SVG は `docs/design/references/ingredient-icons-2.0/cilantro.svg`、実装結果は `docs/reports/TETO_NEW-BBQ_Result.md` を参照。実装は #679（Gate §6 の計画の実施）。


Status: **Owner 判断の記録と、Owner 向けの選択肢の提示。runtime は実装しない**（未決仕様が残るため。§6）。`src/**`・`e2e/**`・CSS・テスト・データ・golden は無変更。merge・deploy・CI 再実行・Monitor 作成なし。
基準 `main` = `9761d03`（#673 merge 後。Deploy to GitHub Pages run #461 は success）。関連: #611、`TETO_NEXT-RECIPES-AND-PROCESSES_PRIORITY-TABLE_2026-10-26.md`（§3・§10・§11）。
**「推奨」は助言であり Owner Decision ではない。**

## 0. Owner 判断（2026-10-27）

1. **BBQチキンの暫定仕様での開発を条件付き承認**する（条件は §1）。
2. **cilantro の焼成後追加は、ゲーム用の暫定仕様として承認する。原典の事実としては記録しない**（§2 に記録ルール）。
3. **D-1（案 A / B）、D-4（案 a / b / c）、D-6（案 a / b）の具体的な差分を Owner 向けに提示する**（§4・§5・§6 の選択）。
4. **リングに「8 個」という新しい上限は設けない**（§5）。
5. **#673 の merge 済み main を基準に依存関係を再確認する**（§3）。
6. **未決仕様がある状態では runtime を実装しない**（§7）。

## 1. 条件付き承認の条件

| # | 条件 | 状態 |
|---|---|---|
| CA-1 | **D-1・D-4・D-6 が確定するまで runtime を実装しない**（本書 §4・§5・§6 から Owner が選ぶ） | **未解決（回答待ち）** |
| CA-2 | 暫定仕様であることを PR・Result・コード・文言に明記し、**原典の事実として書かない**（§2） | 実装時に守る |
| CA-3 | 実装は #673 merge 済み main を基準にする（§3） | 充足（#673 は merge 済み） |
| CA-4 | **merge = 即公開**（late catalog は本番 ON）なので、Owner の実機 HV と最終承認まで merge しない（U2・U3 と同じ運用） | 実装時に守る |
| CA-5 | 着手時に #611 へ claim を投稿し、重なる claim・PR を確認する（§3） | 着手時 |
| CA-6 | 原典のページを Owner が共有できた場合は、数値・時機だけを差し替える小さな PR で追随できるよう、データ定数を 1 か所に集める | 実装時に守る |
| CA-7 | 新しい仕様判断（D-1 / D-4 / D-6 以外）が実装中に出た場合は、実装を止めて Owner に確認する | 実装時に守る |

## 2. cilantro の焼成後追加 — 暫定仕様の記録ルール

**事実関係:** 172 品 matrix の `bbq-chicken-pizzadb` では、cilantro の後乗せ（`post_bake`）は根拠の強さが `catalog_design_tag`（ゲーム側のカタログ設計上のタグ。`pizza_master_catalog.json` の `finishingIngredients`）で、**原典の記述ではない**（ikura は `source_profile_text` で原典に近い記述）。材料の最終一致（Q1）も `phase0b_sample_canonical`（比較表の標本）で、個別ページは未確認。

**記録ルール（コード・PR・Result・Issue に共通）:**

1. cilantro を焼成後（`POST_BAKE`）に置くのは「**ゲーム用の暫定仕様（GAMEPLAY ASSUMPTION）**」と書き、「原典では焼成後」とは書かない。「原典で確認済み」「原典どおり」も書かない。
2. コード内コメントの定型（U2・U3 の型）: 「GAMEPLAY ASSUMPTION（暫定仕様・原典未確認）: cilantro を焼成後にのせるのはゲーム用の暫定仕様で、原典の事実としては記録しない。根拠は 172 品 matrix の `catalog_design_tag` のみ。」
3. 説明文（`description`）・Dex・RESULT・ヒントは、**投入の時機を名指ししない**（Anti-Oracle。発見前に見える文言。#621 で技法名・Dex 説明・なぞかけは確定済み）。
4. Reference のスロット割り当ては「ゲーム内の較正であって原典の権威ではない」（既存の定型句を使う）。
5. Result Report に「未確認事項」の表を載せる（優先度表 §10.3 の Q1〜Q5）。**Q2（cilantro の時機）は暫定仕様として Owner が承認済み**と記録し、「確認済み」とは書かない。
6. 原典の共有があった場合に備え、数値（個数・窓）と時機（`applicationPhase`）を 1 つのレシピ定義に集める（差し替えの PR が小さく済む）。

## 3. 依存関係の再確認（main `9761d03` 基準）

| 項目 | 現状（コードと GitHub で確認） | BBQ への影響 |
|---|---|---|
| **#673（U3）** | **merge 済み**（`9761d03`）。late step は 4 つ（ikura、柚子胡椒、味噌 + 白ごま、タヒニ + ザクロ）。`LATE_ENTITLEMENT_FLOORS` = salmon-roe 57 / yuzu-kosho 58 / miso-sauce 59 / white-sesame 59 / tahini 60 / pomegranate 60 | BBQ の late step は **5 番目**（通常 ladder の長さ + 5。**絶対番号に固定しない**）。floor は bbq-sauce・cilantro が 61 の見込み（導出値より後にならないこと）。前提「#673 の merge」は充足 |
| 通常 ladder の長さ | 56（late 4 を除く。floor 60 = 56 + 4 から逆算） | 通常バッチ（例: カリーヴルスト）が先に入ると late の step 番号がずれる（#615 の既知の限界。未到達の late step の必要発見数 +1 は許容、**既到達・既解禁は後退させない**: #621 の決定） |
| #615（後乗せカタログ基盤） | **merge 済み**（2026-10-22）。`lateCatalog.ts` が単一の合流点 | データ追加のみで足りる |
| #611 の別セッションの claim（`late-catalog-foundation`） | 期限 **2026-10-28T00:00:00Z**（本日中に自然失効）。対応する #615 は merge 済みで、実質完了 | BBQ 着手時は失効後。**Owner による解除は不要**（自然失効する） |
| #604・#608 の claim | 失効済み（§下の「Issue 整理」参照） | — |
| open PR との重なり（各 PR 自身の変更ファイル。履歴を取得し直して確認） | **#540（Draft・HOLD）が `recipes.ts`・`recipeSauceProfiles.ts`・`referencePizza.ts`・`hint5.ladders55.json` を触る**（BBQ のデータ PR とも重なるファイル）。#674 は `persistence.ts` のみ。#478（Draft）は `GameScreen.tsx` のみ。#468 は `App.css` のみ。#581 は該当なし | #540 は Draft・HOLD で先に merge される予定が無く、BBQ 側が先行して良い（後から着手する側が追従）。BBQ が `App.css`（1.2em の補正グループ）を触る場合のみ #468 と重なる |
| Style Lock v2 の実装ゲート（#423） | **解除済み**（2026-10-08、PR #430） | D-4 案 a を実装してよい |
| 原典 | 未確認（matrix の引用のみ） | §2 のルール |

**U3（#673）の変更ファイル構成（BBQ の雛形）:** 50 ファイル・+996/−88。内訳: docs（Result、参照 SVG、スクリーンショット、DH4 監査 JSON）、e2e 1、`App.css` 1 セレクタ、`IngredientGlyph.tsx`・同テスト、`ingredients.ts`、`lateCatalog.ts` と `lateCatalog.*.test.ts`（新規 1 + 既存の更新）、`recipeHintRoles.ts`・`recipeSauceProfiles.ts`・`referencePizza.ts`、技法 allow-list（`techniqueAllowlists.ts` と同テスト）、Hint 5.0 golden（追記）、件数 pin（`catalogLedger.test.ts`、`deductionGuard.gate.test.ts` ほか）、`materialShop.test.ts`、`materialEntitlement.lateFloor.test.ts`、`recipeBatchManifest.ts`、`recipeChapters.test.ts` など。**BBQ もほぼ同じ構成**（新ソース + 新 topping + SVG + レシピ）になる見込み。

## 4. D-1 — 数値（案 A / 案 B の具体差分）

どちらの案も、#611 のコメントで確定済みの次の規則は共通: `lunchRush: false`、CUT なし、key-free、`ladderCredit: true`、cohort の鍵 = cilantro、late step は導出、`baseRewardPitz: 100`、T4（パック 120 / 補充 60 Pitz、星ゲートなし）、焼成窓 58–78（U1〜U3 と同じ）。

| 項目 | **案 A**（#611 の具体案どおり） | **案 B**（chicken を減らす） | 差が出るところ |
|---|---|---|---|
| `requiredIngredients` | bbq-sauce 1 / mozzarella 2 / onion 1 / chicken **3** / cilantro 2（POST_BAKE） | bbq-sauce 1 / mozzarella 2 / onion 1 / chicken **2** / cilantro 2（POST_BAKE） | `minCount` 1 か所 |
| 非ソースのピース数 | **8**（焼成前 6 + 仕上げ 2） | **7**（焼成前 5 + 仕上げ 2） | PREPARE の配置回数が 1 回違う |
| Reference のスロット（RT-01 の厳密配置、`PIECE_RING_POSITIONS`） | mozzarella (50,24)(73,36)、onion (76,63)、chicken (58,79)(38,79)(22,63)、**cilantro (25,36) と中央 (50,52)** | mozzarella (50,24)(73,36)、onion (76,63)、chicken (58,79)(38,79)、**cilantro (22,63)(25,36)**（中央は空き） | `referencePizza.ts` の位置データ。A は仕上げの 1 つがピザ中央に置かれる |
| 採点（Scoring 2.0、配点 52/16/12/20 不変） | 理想量が 8 ピース分 | 理想量が 7 ピース分 | Reference と一致するための量。配点・ruleset は不変 |
| 部分量の完成（Completion Gate #215） | 同じ規則 | 同じ規則 | — |
| Hint 5.0 の STRUCTURE 件数・DH4 | **変わらない**（材料の**種類**数で、ピース数ではない） | 同左 | `deductionGuard.gate` の件数 pin の原因分解は、どちらでも ingredient の追加（bbq-sauce、cilantro）で動く |
| 在庫・パック | chicken 3 / 回の消費 | chicken 2 / 回の消費 | 1 ラウンドの在庫消費がわずかに軽い |
| 前例 | ikura が非ソース 8（後乗せ 3 を含む） | ピンサが 7（後乗せ 2 を含む） | どちらも出荷済み |
| テストの更新 | `lateCatalog.bbq.test.ts`（新規）の期待値、Reference のピース数 | 同左（数値が異なる） | — |

**D-6 は実質、この D-1 のピース数の選択と同じ軸**（§6）。「A + a」か「B + b」の 2 通りになる。

## 5. D-4 — cilantro の見た目（案 a / b / c の具体差分）

**事実:** 新しい食材の絵文字は、**他のどの食材とも重複させない**運用になっている（バッチごとのテスト。例: `lateCatalog.tahini.test.ts`「no other ingredient shares the tahini or pomegranate emoji (G18)」、`lateCatalog.dengaku.test.ts`）。またヒントのファミリー記号（🥬 野菜、🪴 ハーブ、…）とも重複させない（G18、`familyDisplay.test.ts`）。既存の食材には過去の重複が残る（🌿 は pesto と basil、🍃 は oregano・spinach・yuzu-kosho、🌱 は rosemary・artichoke）が、新規で増やさない扱い。**葉の絵文字（🌿 🍃 ☘️ 🍀 🌱 🌾 🥗 🥬 🪴）は全て既存の食材かファミリー記号が使用済み**で、未使用の候補は 🫛（さやえんどう）・🌼・🌸・🍵・🫚 など、**葉に見えないもの**に限られる。🫛・🫚 は Emoji 15.0（iOS 16.4 以降）で、古い端末では表示されない可能性がある。既存の葉の絵文字を cilantro に流用する選択肢もあるが、**他の herb と見分けが付かなくなり**、新食材は重複させない運用にも反する（Owner の例外承認が要る）。

| 項目 | **案 a**（SVG を同じ PR に含める） | **案 b**（emoji で先に出荷、SVG は後続） | **案 c**（emoji のみ） |
|---|---|---|---|
| 食材の見た目 | 専用 SVG `cilantro-leaf`（鋸歯のある緑の葉、shiso-leaf・arugula-leaves と並ぶ系統） | 暫定の絵文字（未使用で、かつ葉に見えるものが無い） | 同左（恒久） |
| 変更ファイル（追加分） | `ingredients.ts`（`DedicatedIngredientVisual` の union と `pieceVisual: "cilantro-leaf"`）、`IngredientGlyph.tsx`（viewBox の表 + `CilantroLeaf` コンポーネント）、`IngredientGlyph.test.tsx`（DEDICATED 一覧）、`App.css`（1.2em の補正グループに 1 セレクタ。要否は実測）、参照アート `docs/design/references/ingredient-icons-2.0/cilantro.svg`、Style Lock v2 の追記（別の docs-only PR） | `ingredients.ts` の `emoji` のみ | `ingredients.ts` の `emoji` のみ |
| 絵文字フィールド | 必須（テキストの代替として残り、DOM には出ない。**重複しないダミー**が要る。U3 のザクロは 🟥） | 見た目そのもの | 見た目そのもの |
| 識別（トレイ・ピザ上・RESULT で herb と分かるか） | 良い（SVG はピザ上でも 1em で描画、`xs` クラス ×0.7 でも葉の形が出る） | 弱い（葉に見えない記号。herb 族の他食材とも区別しにくい） | 弱い（恒久） |
| PR の大きさ | 大きい（#673 は 50 ファイル。BBQ も同程度） | 小さい | 小さい |
| 手戻り | なし | **あとで見た目が変わる**（SVG 追加時に別 PR とセーブ互換は不要だが、HV を再度行う） | 変わらないが識別の弱さが恒久化 |
| 実機・360 幅での確認 | 要（`xs` の小さい葉。parsley・mint など既存の xs 食材も 360 幅で判別性が「要確認」のまま。ingredient visual 監査） | 要（絵文字の表示） | 同左 |
| HV | 390×844 動画 + 前後スクリーンショット | 同左 | 同左 |
| 前例 | shiso-leaf、sesame-seeds、pomegranate-aril（全て同じ PR で出荷） | なし | なし |
| 助言（Owner 決定ではない） | **推奨**（葉の絵文字が全て使用済みで、b・c は識別が弱いため） | | |

サイズクラスは既存の規則（herb の葉 = `xs`。parsley・mint と同じ）に従う想定で、D-4 とは別の確認事項。

## 6. D-6 — 8 ピースとリング（案 a / b の具体差分。**8 個の新上限は設けない**）

**コードの事実（再確認）:** `getReferenceSlots(n)` は **n ≤ 8 を厳密な 8 点のリング、n ≥ 9 を複数リングで生成**する（RT-01、`pizzaReferenceLayout.ts`）。後乗せのピースも `requiredIngredients` の順に同じスロットを使う（`IKURA_SALMON_PIZZA_REFERENCE`: 非ソース 8、shiso・salmon-roe は後乗せ）。**「8」は仕様上の上限ではなく、リングの形が変わる境目**。Owner 判断どおり、**BBQ の実装でも新しい上限規則・上限の定数・上限を主張するコメントは作らない。**

**#621 の Q-5（後乗せのリング上限）との関係:** #621（G-2）では「後乗せ専用の上限」の正式値が**未決**で、R-A（総数 8 以内・後乗せ専用の上限なし）が**検証用の暫定仕様**、後乗せ 5 ピースの実測後に正式上限を判断、とされている（#621 のコメント 2026-10-23、state-sync §3）。BBQ の後乗せは **2 ピース**で、実測済みの ikura（後乗せ 3）以下のため、**Q-5 の正式値を待たずに済む**。BBQ の総数 8（案 A）は R-A の暫定の範囲内だが、Owner 判断（8 個の新上限は設けない）に従い、**BBQ の PR で「総数 8 以内」を規則として固定・主張しない**（Reference は RT-01 の配置を使うだけ）。なお #621 は「総数 8 超（多重リング拡張）」を Reference・Scoring 2.0 に波及するスコープ外と整理しており、BBQ は 8 以内に収まるので触れない。

> 注意: 既存の `lateCatalog.ts` のピンサのコメントに「7 non-sauce pieces <= the 8-slot ring」とある。これは単なる説明で規則ではない。**BBQ の PR では同種の「8 が上限」と読める表現を書かない。**

| 項目 | **案 a**（8 ピース。前例どおり） | **案 b**（7 ピース） |
|---|---|---|
| 対応する D-1 | 案 A | 案 B |
| Reference の配置 | 8 点のリングを使い切る（中央 (50,52) に cilantro 1 つ） | 7 点（中央は空き） |
| 新しい規則・定数 | **なし** | **なし** |
| 画面上の混み具合 | ikura の 8 ピースと同条件。実装 PR の E2E（390×844 / 360×800）で確認 | 8 より余裕 |
| 追加の実測 | 不要（コードで確定済み。画面は実装 PR で確認） | 同左 |
| 助言（Owner 決定ではない） | 前例どおりで追加の判断が要らない | 余裕を持たせたい場合 |

## 7. 未決仕様と runtime 実装の可否

| 未決 | 内容 | 状態 |
|---|---|---|
| D-1 | 案 A / B（ピース数と Reference） | **回答待ち** |
| D-4 | 案 a / b / c（cilantro の見た目） | **回答待ち** |
| D-6 | 案 a / b（D-1 と連動） | **回答待ち** |

**未決仕様が残るため、runtime は実装しない**（Owner 判断）。回答が揃い次第、#673 を雛形に実装前 Final Design Gate（docs-only。#673 の Gate と同じ型）を提出し、その承認後に実装する。

**回答の最短ルート:** 「D-1 = A、D-4 = a、D-6 = a」のように 1 行で選べる。

## 8. Owner への質問（残る判断）

1. **D-1 / D-4 / D-6 の選択**（助言: A / a / a）。
2. 実装前 Final Design Gate を出してよいか（回答後）。
3. Q2 以外（Q1・Q3〜Q5）の暫定仕様の扱いも「ゲーム用の暫定仕様」としてよいか（本書は同様に扱う前提）。
