# 次期コンテンツ Fresh Audit — わさびビーフ / ホットハニー / ブッラータ（docs-only）

Status: **調査と比較表のみ。** `src/**`・`e2e/**`・CSS・テスト・データ・golden・workflow・本番スイッチ・共有 Preview・Production・Firebase は変更していない。実装・PR 作成・merge・Monitor 作成・CI 再実行・Issue/PR へのコメント投稿・claim 投稿はしていない（新規ファイル 1 件のみ、下記ブランチへ push）。
基準 `main` = `de87234`（#674）。起点: ブランチ `claude/teto-pizza-fresh-audit-wboqxo`。
**「推奨」「評価」は助言であり Owner Decision ではない。未回答を承認済みとみなさない。**

## 0. 事前確認（CLAUDE.md の起動手順）

| 確認 | 結果 |
|---|---|
| `CLAUDE.md` / `docs/PROJECT_HANDOFF.md` | 読了。HANDOFF 冒頭は 2026-09-18 だが、10 月分の addendum が追記されている。現況の正は `TETO_STATE-SYNC_2026-10-26.md` と GitHub（HANDOFF 自体が「fresh GitHub state を正とする」と明記） |
| 最新 main | `de87234`（#674 Dex 生エントリ保持）。直前は #673（U3、ナス+タヒニ、late catalog S2）。`git fetch` で origin/main と一致 |
| open PR（主なもの） | **#679 BBQチキン（late catalog、未 merge、CI の build が実行中・WebKit 各シャードと Gate は success）**、#677（発見失敗後の案内、Final Gate・merge 禁止）、#651 / #650（docs-only）、#540（Draft・HOLD、グランマ丸版）、その他は 9〜10 月の古い PR 群 |
| open Issue | 98 件。関係するのは #611（TQ-2 / BBQ の親）、#579（DRIZZLE）、#578（New Sauces）、#577（Dough Kind / HOLD）、#521（Multi-Sauce）、#394 / #680（WebKit 間欠失敗） |
| claim | #611 に BBQ セッションの claim（PR #679、files は `lateCatalog.ts`・`referencePizza.ts`・`recipeSauceProfiles.ts`・`ingredients.ts`・`IngredientGlyph.tsx`・`App.css`・Hint 5.0 golden ほか）。#578 の U3 claim は期限 11/02 まで残存（Owner 承認なしに release しない）。**本調査の新規ファイルはどの claim とも重ならない** |
| #579 DRIZZLE | 価値監査（第 1 回）が 2026-10-27 に #579 へ記録済み。**評価: 保留（機構は作らない）**。§6 で再調査の要否を判定 |

## 1. 比較表（結論）

| 観点 | **わさびビーフ** (`wasabi-beef-pizza`) | **ホットハニー** (`hot-honey-pepperoni`) | **ブッラータ** (`burrata-pizza` ほか 3 行) |
|---|---|---|---|
| 材料（matrix） | beef / wasabi / soy-sauce / onion / mozzarella | pepperoni / mozzarella / honey（+ tomato-sauce 由来） | burrata-pizza: basil / burrata / olive-oil（+ tomato-sauce 由来） |
| **既存との重複** | なし。材料集合・id とも未出荷（本 main の `ingredients.ts` / `lateCatalog.ts` に beef・wasabi・soy-sauce は無い） | 既存 `pepperoni`（tomato-sauce + mozzarella + pepperoni）の**上位集合**。集合一致ではないので識別は衝突しないが、分岐発見（pepperoni → 蜂蜜を足す）になる | 既存と集合一致なし。`pizza-margherita` と mozzarella→burrata の差 |
| **追加食材数** | **3**（beef 肉、wasabi 薬味、soy-sauce ソース） | **1**（honey） | **1**（burrata、チーズ） |
| **既存素材の再利用率**（レシピの材料数ベース） | 2/5 = **40%**（onion・mozzarella） | 3/4 = **75%**（tomato-sauce・mozzarella・pepperoni） | burrata-pizza 2/3 ≒ **67%**（basil・olive-oil）。pesto-burrata・crudaiola を含めると 1 食材で **3 レシピ**に効く（crudaiola は 5/6 再利用） |
| **新しい調理工程** | **不要**。`LATE_ADDITION`（出荷済み・本番 ON）のみ | **条件付き**。液体の後乗せ（DRIZZLE）を本物にするなら要（HOLD）。粒状 topping で近似するなら不要だが「かける」感は出ない。さらに 2 ソース（tomato + honey）= `MULTI_SPREAD_LAYER`。matrix の根拠は `repo_inference`（推定） | **条件付き**。(a) 焼成前チーズなら工程不要だが 2 層（tomato/pesto + olive-oil）= `MULTI_SPREAD_LAYER`。(b) 本物の姿（焼成後にのせる）にするなら **FINISH がチーズを受けない**（`gameReducer.ts` の FINISH 分岐は `category !== "topping"` を拒否）ため新規対応が要る。時機の記録は matrix に無い |
| **投入時機の根拠** | wasabi の焼成後追加が `source_profile_text`（原典に近い記述）。BBQ（`catalog_design_tag`）より強い。**ただし原典サイトには未到達** | 蜂蜜の後乗せは `repo_inference`。最も弱い | なし（後乗せの記録が無い） |
| **見た目** | 牛肉（赤茶）+ 緑のわさび少量 + 醤油ソースの暗色。色の対比が強く、焼成後に緑をのせる動作が絵になる。**要新規 SVG 2（beef、wasabi）**。wasabi は yuzu-kosho / parsley / cilantro と緑が近いので識別設計が要る | 蜂蜜の金色の筋・ドロップ。静止ピースでは「筋」が出せず、粒の金色ドットに見える恐れ。**液体表現が主役なのに既存機構では描けない** | 白い丸いボールは見た目の訴求が最も強い。ただし mozzarella（白）と混同しやすく、焼成前だと溶けて個性が消える（Canvas のモッツァレラ溶け表現 #421 系）。焼成後の「割る」演出が理想だが機構が無い |
| **操作感** | 既存のタップ配置（FINISH）。新しい操作なし | DRIZZLE が本命（#476 の Gate が前提）。タップ配置では差が出ない | 既存のチーズ配置か FINISH のタップ。割る・崩す等は新規ジェスチャー |
| **ゲームとしての面白さ** | 中。新しい「出会い」は乏しい（BBQ と同型）。ただし「ソース = 醤油」「緑の薬味を最後に」は和風の新味。**late 枠の次の定番** | 高い可能性はあるが DRIZZLE 依存で未検証。粒状近似では BBQ と同じ体験 | 中〜高。1 食材から 3 レシピが派生し、チーズの発見の幅が増える。反面チーズの Hint（BASE 段 = ソース+チーズ全件）の件数と、DH4 の「その他は到達不能」契約への影響を要確認 |
| **実装規模**（#673 = 50 ファイル・食材 2 + レシピ 1 + SVG 1 との類推。測定値ではない） | **L〜XL**（食材 3、SVG 2、レシピ 1、late step 1、golden・件数 pin） | 粒状近似なら **L**（食材 1、SVG 1）。本物なら **XL 複数 PR** + #476 / #495 / OD-CS-11 の決定 | 焼成前・単層に簡約すれば **L**。本物（2 層 + 焼成後）なら **XL**（`MULTI_SPREAD_LAYER` と FINISH のチーズ対応） |
| **リスク** | 低〜中。機構の新規なし、前例（U1〜U3、BBQ）の型。リスクは(1) 食材 3 の golden・Hint の件数変動 (2) sauce の「その他」family（タヒニの前例あり）(3) 原典未確認の暫定仕様 (4) BBQ との共有 hot file | 中〜高。(1) 根拠が推定 (2) honey の分類（sauce 級 / topping 級）が Hint 5.0 のサブ分類に影響 (3) 2 層ソース (4) DRIZZLE を作らない前提で「かける」が成立しない | 中〜高。(1) 新しい cheese 食材が cheese 軸の Hint・Shop タブ・Research コホートに波及 (2) 2 層ソースまたは FINISH 対応 (3) mozzarella との視認性 |
| **DRIZZLE との関係** | 不要（監査も同判断） | **DRIZZLE の本命候補**（唯一の READY_WITH_REVIEW） | 直接は無関係。ただし FINISH のカテゴリ制限という同種の論点 |
| **本 audit の評価** | **次の候補として最有力** | 保留（DRIZZLE の HOLD と同期） | 将来の候補（機構の先決条件が二つある） |

## 2. 根拠となる事実（コード・GitHub で確認したもの）

- **late catalog / FINISH は本番 ON**（`LATE_CATALOG_PRODUCTION = true`、`src/data/lateCatalog.ts:33`）。出荷済みの late レシピ: ikura、yuzu-shrimp、eggplant-dengaku、eggplant-tahini（#673）、pinsa-romana。いずれも「焼成前に PAINT するソース + 焼成後の**粒状 topping**」の型で、新機構を使っていない。
- **FINISH は topping のみ受ける**: `src/state/gameReducer.ts` の FINISH 分岐が `placingIngredient.category !== "topping"` を拒否する（ソース・チーズは置けない）。これが DRIZZLE（液体）と、ブッラータ（焼成後チーズ）の両方に効く制約。
- **2 ソース必須のレシピは 1 件だけ**: `MULTI_SAUCE_RECIPE_IDS = ["grandma-pizza"]`（`src/logic/testSupport/requiredSauces.ts`）。`grandma-pizza` は天板（角形）で、丸形の 2 ソースは #540（Draft・HOLD）。したがってホットハニーとブッラータの原典どおりの構成（tomato/pesto + olive-oil / honey）は、**丸形 2 層ソースを新しく出荷することになる**。マスターカタログの旧メモ（`TETO_COOKING-EXPANSION_FRESH-AUDIT-AND-PLAN.md` §4）も burrata / honey のアイコン作業と「はちみつは新しい sauce 級食材」を挙げている。
- **チーズ食材は 11 件**（mozzarella、gorgonzola、parmigiano、fontina、cashew-cheese、grana-padano、cream-cheese、catupiry、feta、ricotta、goat-cheese）。`burrata` は無い。**ソースは 7+ 件**で `honey`・`soy-sauce` は無い。`beef`・`wasabi` も無い。
- **olive-oil は PAINT_TEMPORARY**（`recipeSauceProfiles.ts`、`// TODO: olive-oil -> DRIZZLE candidate`）。tomato-sauce と olive-oil を併用する既存レシピは無い。
- **172 品 matrix の該当行**（`docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`）: wasabi-beef = `LATE_ADDITION` のみ・READY・`source_profile_text`。hot-honey-pepperoni = `LATE_ADDITION`（`repo_inference`）+ `MULTI_SPREAD_LAYER`。burrata-pizza / pesto-burrata / pizza-alla-crudaiola = `MULTI_SPREAD_LAYER`、後乗せの記録なし。
- **#679（BBQ）は open**。BBQ と共有するファイル（`lateCatalog.ts`・`ingredients.ts`・`IngredientGlyph.tsx`・`App.css`・Hint 5.0 golden・件数 pin）に次の late 候補も触る。**BBQ merge 前に次の実装を始めると、同じ hot file で衝突する。**

## 3. 未確認・限界（推測で埋めない: OD-B9-11）

- **原典（pizzadb.jp ほか）には到達していない。** 食材・時機・個数は matrix の記録と既存の決定記録の引用。wasabi の焼成後追加が「強い」のは matrix 内の相対評価で、原典の確認ではない。
- ブッラータの「焼成後にのせるのが本来の姿」は一般的な調理知識に基づく**本 audit の推測**で、matrix には記録が無い。ゲーム仕様に採るなら Owner の暫定仕様承認（BBQ の Q2 と同じ扱い）が要る。
- 「実装規模」は #673 との類推で、測定していない。
- 本 audit では `check.ts` 型の機械検証（件数・Hint の衝突）を**実行していない**（読み取りのみ）。実装前 Gate で必ず行う。
- Hint 5.0 / DH4 のプライバシー契約（OD-DH4-2-9 ほか）への影響は、wasabi-beef の soy-sauce（sauce の「その他」family）・honey・burrata のそれぞれで**未測定**。

## 4. BBQ 後の追加順序（助言）

| 順 | 候補 | 先行条件 | 理由 |
|---|---|---|---|
| 0 | **#679 BBQ の完了**（Owner の実機 HV と最終承認、merge） | Owner | 同じ hot file を共有。BBQ の cilantro 暫定仕様・late step 番号が確定してから次に着手するのが安全 |
| **1** | **わさびビーフ** | BBQ merge、Owner の Final Design Gate 承認（暫定仕様・原典未確認の扱い、beef / wasabi の SVG 方針、soy-sauce の色） | 新機構ゼロ、matrix の根拠が候補中で最も強い、DRIZZLE 監査の選択肢 2 と一致 |
| 2 | **ブッラータ**（調査 Gate を先に） | wasabi-beef 後。(a) 焼成前・単層簡約で出すか、(b) 本物（焼成後・2 層）を待つか、の Owner 判断。FINISH のチーズ対応の設計 | 1 食材で 3 レシピ分の将来価値が最大。ただし機構の先決条件が二つ |
| 3 | **ホットハニー** | DRIZZLE の HOLD 解除（#579）または Owner が粒状近似を許容 | 根拠が最も弱く、本質が DRIZZLE に依存 |

## 5. 推奨する候補 1 件

**わさびビーフ（`wasabi-beef-pizza`）。**

1. **新工程が要らない。** `LATE_ADDITION` のみで、出荷済みの late catalog の型（粒状 topping の焼成後追加）に収まる。ホットハニー・ブッラータは機構の新規出荷が前提。
2. **根拠が最も強い。** 焼成後の追加が `source_profile_text`。BBQ（`catalog_design_tag`）、ホットハニー（`repo_inference`）、ブッラータ（記録なし）より上。ただし原典未確認の暫定仕様として扱う前提は変わらない。
3. **#579 の HOLD と整合する。** DRIZZLE を作らずに、late catalog の連続した拡張として進められる（DRIZZLE 監査の選択肢 2 と同じ結論）。
4. **弱点は正直に: 追加食材が 3（再利用率 40%）で、SVG が 2 点要る。** 規模は L〜XL。食材数だけならホットハニー・ブッラータ（各 1）が小さいが、どちらも機構の先決条件（2 層ソース / 液体 / 焼成後チーズ）が本体で、規模が見かけどおりにならない。

着手条件: #679 が merge され、BBQ の late step・floor・golden が main に入ってから。実装前に Final Design Gate（docs-only）を出し、Owner の承認を得る。

## 6. #579 DRIZZLE: HOLD 維持の判定

再調査が必要な**新事実は無かった**ため HOLD を維持する。

- 監査（#579 のコメント、2026-10-27）の前提を本 main（`de87234`）で再確認: FINISH は topping のみ（`gameReducer.ts` の同じ分岐）、`MULTI_SAUCE_RECIPE_IDS` は `grandma-pizza` のみ、`olive-oil` の DRIZZLE は TODO のまま。**監査後に変わったのは #674（保存）と #679（BBQ、late の topping）だけで、DRIZZLE の判断材料には触れない。**
- 本 audit が加えた観点は 1 点だけ: **ブッラータの焼成後チーズは「FINISH のカテゴリ制限」という同種の論点**。ただし液体ではなくチーズなので DRIZZLE の価値評価（液体の後乗せの行数）を変えない。DRIZZLE の機構コスト（XL）を共有する可能性は将来の設計 Gate で扱う。
- 再開条件（監査の記録どおり）: 原典の共有で液体の後乗せが確認され代替では足りないと判断されたとき、または Owner が液体の後乗せを必須とする行（hot-honey、buffalo など）を優先したとき。

## 7. Owner に確認したいこと（回答待ち）

1. 次の候補をわさびビーフにしてよいか（BBQ #679 の merge 後に Final Design Gate を出す流れでよいか）。
2. ブッラータを将来候補に置く場合、焼成後チーズ（FINISH のカテゴリ拡張）と焼成前・単層簡約のどちらを優先するか。
3. ホットハニーを DRIZZLE と同期して保留のままにしてよいか。
4. わさびビーフでも BBQ と同じ「暫定仕様・原典未確認（GAMEPLAY ASSUMPTION）」の扱いを適用してよいか。

## 8. 触れていないもの

`src/**`、`e2e/**`、CSS、テスト、データ、golden、workflow、本番スイッチ、共有 Preview、Production、Firebase、保存データ、`docs/PROJECT_HANDOFF.md`、既存の決定記録、Issue/PR へのコメント・クローズ、#679 の head。merge・deploy・CI 再実行・Monitor 作成はしていない。
