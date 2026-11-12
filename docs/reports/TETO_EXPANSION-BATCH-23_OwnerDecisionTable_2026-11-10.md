# Expansion Batch 23 — Owner 決定表（デザート列車: 3 レシピ・6 食材、docs のみ・実装前、Refs #780）

2026-11-10 / 基準 main `d3d4ec05`（B22 出荷後）。Owner は 2026-11-10 に **B23 の着手**を承認し、「既存台帳から候補を選定し、claim と競合しない範囲で進める」と指示した。本書は**選定結果と、実装前に Owner の決定が要る点**の表である。**コード・テスト・golden・HOT ファイルは変更していない。** 決定表が承認されるまで HOT の編集（`ingredients.ts`・`recipes.ts`・`lateCatalog.ts`・`discoveryLadder.ts` 等）は始めない（B22 と同じ運用）。凡例: 【実測】コード・台帳の読取りと実行、【提案】本書の案、【未確認】測っていない。

## 1. 選定 — なぜデザート列車か【実測：台帳 `TETO_CONTENT-MASTER_recipes.csv`（main `d3d4ec05` 基準で再生成、#810）】
未出荷の 76 レシピのうち、**Owner の判断なしで進められるものは 0**（READY_TO_PROMOTE／READY_AFTER_RENAME は B21・B22 で出荷し尽くした）。状態別: WAITS_MECHANIC 44（未実装の調理法を待つ）／NEEDS_D2_SOURCE_RESEARCH 10（原典のベースソース調査）／STOP_D6_RESEARCH 10／NEEDS_D1_EXCEPTION_JUDGEMENT 10（Owner の個別例外判断）／NEEDS_CANDIDATE_SELECTION 1／NEEDS_OWNER_DECISION 1。
その中で B23 に最も向くのは次の**デザート 3 品**（理由）:
- 新しい調理法・工程が要らない（`mechanics` が空。台帳の WAITS_MECHANIC ではない）。
- 新食材 6 種（apple・banana・chocolate・powdered-sugar・graham-cracker・marshmallow）の**専用 SVG が制作済み**（`src/components/dessertGlyphs/`、B23 デザート SVG Result、未配線・形と色は PROVISIONAL）。他の候補群は新食材の絵がまだ無い。
- 既存レシピとの重複なし【実測】: 3 品とも、同一・部分集合・上位集合・1 材料差・Jaccard ≥ 0.4 の該当が出荷済み 101 品に **0**。B23 内の nutella と smore は chocolate を共有（Jaccard 0.2 < 0.4）。
- Research の影響が小さい【実測、§4】: 正準順で文字が変わる出荷済みレシピは **0**。非正準順で変わるのは 8 ID（すべて apple の通常 step が原因。late の 2 品は 0）。
- ほかの群（RB-04〜RB-09 の D-1／D-2／D-6 待ち）は Owner の個別判断が先に要る。それらを先に進めるには、本書と同様の決定表が個別に要る。

**ただし、実装に進む前に Owner の決定が要る**（§3）。staged の記録では、apple-cinnamon と smore は「ベースソース未指定（`BASE_SAUCE_UNSPECIFIED`、D-2 の原典調査待ち）」、nutella は chocolate を基底として記載しているが構成の衝突候補（R-5／R-7）が付いている。原典（pizzadb.jp）はこの実行環境から到達できず【実測：接続不可】、私は調査できない。D-2 は「ソース無しを仮定してはならない」と定めているので、**Owner の明示判断なしには決められない**。

## 2. 提案する構成（暫定仕様・原典未確認、すべて GAMEPLAY ASSUMPTION）
| レシピ | 種別 | 材料（個数） | 後乗せ | 新食材 |
|---|---|---|---|---|
| `apple-cinnamon-dessert` アップルシナモンデザートピザ | 通常（POST_BAKE 無し）→ step 74 | apple 2・cinnamon 2・cream-cheese 3・walnut 2 | なし | apple |
| `nutella-dessert-pizza` ヌテラデザートピザ | late | banana 2・chocolate 2・powdered-sugar 2 | powdered-sugar | banana・chocolate・powdered-sugar |
| `smore-dessert-pizza` スモアデザートピザ | late | chocolate 2・graham-cracker 2・marshmallow 2 | graham-cracker | graham-cracker・marshmallow（chocolate は nutella が先に出荷） |
- 既存の食材: cinnamon・cream-cheese・walnut は出荷済み（`ingredients.ts`）。
- ladder の順【提案、REC-04 の規則: 新材料の少なさ→解放されるレシピ数→再利用→recipe id】: apple（新材料 1）が最初の通常 step。late は新材料 3 で同点のため id の昇順で nutella → smore。late は「POST_BAKE のトッピングを 1 つ以上持つ」規則を満たす（powdered-sugar／graham-cracker）。
- 件数: レシピ 101 → **104**、食材 116 → **122**、ladder step 86 → 89（通常 74・late 15）、工程の追加 0。

## 3. Owner の決定が要る点（選択肢・推奨・影響）
| # | 論点 | 選択肢 | 推奨 | 影響 |
|---|---|---|---|---|
| Q-1 | **ベースソース（D-2）**。apple-cinnamon・smore は原典で「デザートソース」の種類が不明 | (a) ソース無し（NO_SAUCE）を Owner が明示承認（speck-e-brie・black-truffle-pizza の先例）／(b) Owner が原典で確認した種類を指定／(c) 新しいデザートソース食材を足す | **(a)**（暫定。原典で分かった時点で別バッチで差し替え） | (a) 食材数 +0、NO_SAUCE の Technique 数え方（二重計上に注意）。(c) は食材が増え（総数 170 の枠を超える）、新ソースの色差 dE ≥ 25 の検査・Research のソース層が増える |
| Q-2 | **nutella の chocolate**。台帳は「nutella-spread を chocolate に統合（I-2）」、`sauce.baseIngredientId = chocolate`、`COMPOSITION_CONFLICT_CANDIDATE`・未解決トークン「ナッツ」あり | (a) chocolate を**散らす食材**として、材料は banana・chocolate・powdered-sugar の 3 つ（本書の測定）／(b) 「ナッツ」を walnut で足す（4 材料）／(c) chocolate をソース層にする（新しい塗る食材） | **(a)** | (b) は apple-cinnamon と walnut を共有し Jaccard が変わる（再測定が要る）。(c) は新しいソース扱いで Q-1(c) と同じ影響 |
| Q-3 | **種別（通常／late）**。apple-cinnamon は後乗せなしで通常、nutella・smore は後乗せありで late | 提案どおり／apple-cinnamon にも後乗せを足して late にする | 提案どおり | late は `LATE_ENTITLEMENT_FLOORS` に固定値が要る（B22 と同じ。足す順は nutella → smore） |
| Q-4 | **食材の family・size・色・絵文字** | 下の暫定案を承認／変更 | 暫定案を承認 | 下記 |
| Q-5 | **Research の非正準 8 ID の個別承認**（§4） | 一括／ID 別 | 承認前は merge しない | 正準順 0 |
| Q-6 | **専用 SVG の配線の形・色**（PROVISIONAL） | 現状の形で配線／Owner の好みで差し替え（例: apple の薄切りが小サイズで盾に見える→丸い輪切り案） | 現状で配線し HV で確認 | powdered-sugar は 17.6px で粒が潰れる→配線時にサイズ補正が要る |
| Q-7 | 名前の扱い | 日本語名のまま（台帳の nameJa）／短縮 | そのまま | B22 の長い名前は HV で備考なしだった |

### Q-4 の暫定案（食材）
| 食材 | 区分 | family（Hint 5.0） | size | 備考 |
|---|---|---|---|---|
| apple | topping | fruit | s（案） | 薄切りくさび SVG |
| banana | topping | fruit | s（案） | 輪切り 2 枚 SVG |
| chocolate | topping（散らす） | other | s（案） | 板チョコ SVG。nutella-spread と統合（I-2） |
| graham-cracker | topping | other | m（案） | 後乗せ。穴つき長方形 SVG |
| marshmallow | topping | other | s（案） | 白い円柱 SVG |
| powdered-sugar | topping | other | xs（案） | 後乗せ。粒 SVG（17.6px で潰れる→サイズ補正） |
- family `other`: 既存のタクソノミーの設計どおり「卵・ナッツ・甘味は `other` を共有」【実測：`ingredientTaxonomy.ts` の注記】。ただし Hint 5.0 の「other 族は到達不能」の既存規則（OD-DH4-2-9）と G18／H5-INV-2（絵文字の一意性）は、実装時に再測定する【未確認】。
- 絵文字（案）: 🍪は cinnamon が使用済み。6 種の絵文字は実装時に G18（family 記号・他食材と重ならない）で選ぶ【未確認】。size／色の値は台帳に無く、**案であって測定値ではない**。

## 4. Research の非正準順の文字変化 — 影響 ID（個別承認が必要）【実測】
測定: main `d3d4ec05`（101 レシピ）に 3 品を足した 104 品、ladder は §2 の順、`researchLetterChangesAcrossOrders`（既定の seeded random 順）。**正準順（ladder の順）の変化は 0**。Research の文字は保存されない。1 品だけ足した場合の影響 ID 数: apple-cinnamon **8**／nutella **0**／smore **0**（late は Research の文字に影響しない）。
| # | 出荷済みレシピ | 変化（before→after、非正準順） |
|---|---|---|
| 1 | `ikura-salmon-pizza` | (なし)→B A→B B→C |
| 2 | `jalapeno-popper-pizza` | (なし)→A |
| 3 | `moussaka-style-pizza` | (なし)→B |
| 4 | `pesto-noci-pizza` | (なし)→B A→B |
| 5 | `pesto-salmone` | (なし)→B B→C C→D D→E |
| 6 | `pizza-radicchio-noci` | (なし)→B B→C |
| 7 | `speck-e-brie` | (なし)→B B→C C→D |
| 8 | `spinach-artichoke-pizza` | (なし)→B B→C C→D |
- 8 ID のうち 2 つ（`speck-e-brie`・`pizza-radicchio-noci`）は B22 で出荷した新しいレシピ。
- 測定は一時のテスト（コミットしない）で、食材の色・絵文字などはダミー。実装時に `expansionBatch23.test.ts` へ ID の固定として入れる（`PENDING_OWNER_APPROVAL`）。

## 5. 実装の計画（承認後）
1. claim を取る（B22 と同様。HOT: `ingredients.ts`・`recipes.ts`・`lateCatalog.ts`・`discoveryLadder.ts`・`recipeHintRoles.ts`・`recipeSauceProfiles.ts`・`referencePizza.ts`・`orders.ts`・`toppingSizeClass.ts`・`ingredientTaxonomy.ts`・`IngredientGlyph.tsx` ほか）。
2. 新食材 6 種と dessertGlyphs の配線、3 レシピ、Reference、注文台詞、late の床、Hint 5.0／Research／DH4 の golden（挿入のみ）、バッチのテスト、E2E、Preview 限定の HV シード（`?hv=b23-*`）。
3. 全 Vitest・E2E・CI を確認し、1 つの Draft PR にまとめる。Codex レビューと iPhone Safari HV の後に Owner が merge。**Production ON・共有 Preview の更新はしない。**
4. テスト性能（#811）: 全 Vitest は約 28 分、`resultNearMiss.p2` は分割済み。B23 の追加で上限を超えるテストが出ないか、実装中に計測する。

## 6. 停止条件
Research の正準順で文字が変わる／保存互換に影響する／重複 Gate に該当する／ladder のスラックが 1 を下回る／Q-1 の回答が (c)（新ソース）で食材の総数が 170 を超える場合は、停止して報告する。

## 7. 進捗（目標 170 食材／177 レシピ／27 調理法、縮小なし）
| 区分 | 現在（出荷済み） | B23 後 | 残り |
|---|---|---|---|
| 食材 | 116 | 122 | 48 |
| レシピ | 101 | 104 | 73 |
| 調理法・工程（実装済み） | 7 | 7 | 20 |

---

## 8. Owner 決定の記録（2026-11-10、本書の §3 への回答。上の本文は決定前の記載のまま、改変しない）

| # | Owner の決定 | 補足 |
|---|---|---|
| Q-1 | `apple-cinnamon-dessert` と `smore-dessert-pizza` に **NO_SAUCE を明示承認**。**原典の事実ではなく、ゲーム実装上の判断**として記録する | 原典（pizzadb.jp）で分かった時点で別バッチで差し替える余地を残す。コード・テスト・Result Report では「GAMEPLAY ASSUMPTION（原典未確認）」と書く。nutella は §3 Q-2 のとおり chocolate を散らす食材とし、ソース無し（NO_SAUCE）で実装する |
| Q-2 | nutella の chocolate は**散らす食材**。**walnut は足さない**（材料は banana 2・chocolate 2・powdered-sugar 2） | 本書の測定どおり |
| Q-3 | apple-cinnamon は**通常 step 74**。nutella と smore は **late** | late の順は nutella → smore（REC-04 の規則: 同点は recipe id の昇順）。late の床は固定値で追加 |
| Q-4 | 提案の 6 食材の **family・size を承認**（apple fruit／s、banana fruit／s、chocolate other／s、graham-cracker other／m、marshmallow other／s、powdered-sugar other／xs）。**色・絵文字は既存検査を必須とする** | 色・絵文字は案であって測定値ではなかった。実装時に G18（family 記号・他食材と重ならない）、H5-INV-2、既存の色検査で確かめ、通らない場合は停止して代案を提示する |
| Q-5 | Research 非正準 **8 ID の提示された before→after を個別承認**。**正準順の変化 0 が必須** | §4 の 8 行。正準順で 1 件でも変われば停止 |
| Q-6 | **既存 SVG を配線**。**apple と powdered-sugar の小サイズ視認性を重点 HV** | powdered-sugar は 17.6px で粒が潰れる（B23 デザート SVG Result）ため、配線時にサイズ補正（案）を入れて HV で確認する |
| Q-7 | 日本語名は**変更しない** | |

**追加の Owner 指示（同日）**: 実装前に #780 の HOT claim を確認する。既存 101 レシピの互換性・Research・在庫・保存・Hint・G18・WebKit を検証し、Codex レビューまたは Owner 承認の独立レビューを受ける。Production ON・共有 Preview の更新は禁止。**これで §3 の決定は確定。B23 の実装を開始する**（HOT claim は #780 のコメントで確認・取得）。

