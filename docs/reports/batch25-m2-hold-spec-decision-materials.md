# Batch 25 — M-2 残り 4 行の Owner 決定記録（原典・実装・承認内容・適用範囲）

状態: **4 行とも Owner 承認済み（2026-11-16、個別承認）。** 出荷コード（recipe・catalog・材料・ソース・工程・Research ID・hint・step 番号）は変更していません。
反映先は `matcher.test.ts` の `ownerApproved`（4 行追加、決定 ID と根拠をコメント）のみです。`discoveryCatalog.test.ts` の定数は、4 行が late で既存の late スキップに入るため変更不要です（コメントのみ更新）。
この承認は **各行・各 recipe 限定**です。他の BASE_SAUCE_UNSPECIFIED／UNRESOLVED_INGREDIENT／MECHANIC_INTERPRETATION 行や、他 recipe への肉の追加・置換には波及しません。
Final Gate は Owner の別途承認まで HOLD のままです。

| 決定 ID | recipe（evidence id） | 承認内容 | 適用範囲 |
|---|---|---|---|
| B25-M2-D1 | swedish-kebab-pizza（…-p4） | 案 A: 「肉」と未特定のホットソース下地を省略。kebab-sauce 1／mozzarella 3／lettuce 2 を維持 | この recipe 限定の「肉の省略」例外。肉の追加は禁止 |
| B25-M2-D2 | banh-mi-pizza（…-p6） | 案 A: NO_SAUCE を明示承認。liver-pate は topping／meat の複合 1 ピース。late・POST_BAKE なし（L-1）、step 98 で daikon + liver-pate 同時解放（L-3）を維持 | この recipe 限定の NO_SAUCE（他の NO_SAUCE 承認とは独立） |
| B25-M2-D3 | mexican-elote-pizza（…-p13） | 案 A: sour-cream 1 層を下地として承認。cotija→feta、chili-powder→paprika-powder の 2 置換を承認。mayo・lime・late step 99 を維持 | この recipe 限定。置換は GAMEPLAY ASSUMPTION |
| B25-M2-D4 | pizza-asparagi-limone（…-p8） | 案 A: crudi＝生を POST_BAKE の FINISH で表現（asparagus・lemon は焼成後）。olive-oil／mozzarella／parmigiano、late step 100、D-3 例外を維持 | この recipe 限定（B22 の finocchi／cavolo-carote の先例と同じ解釈） |

下記の各節は、承認前に作成した決定材料（原典との差異・代替案）を記録として残したものです。案 A が承認され、B／C／D は不採用です。

出典: 原典の行は `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`（pizzadb.jp から取得した 172 行の設計 matrix）、出荷内容は `src/data/lateCatalog.ts` と `recipeSauceProfiles.ts`、Owner 記録は `TETO_T25-R2C_OWNER-DECISION-TABLE_2026-11-15.md`（決定表）と `TETO_T24-T26_OwnerDecisions-Followup_2026-11-10.md`（追加判断書）。

## 共通の影響範囲（どの代替案でも、変える場合は再測定が必要になるもの）
- **不変条件**: ordinary 81／late 97〜101／step 98 で 2 食材同時解放／canonical Research 変化 0／non-canonical 42 ID／既存 late の +1 移動。recipe の構成・下地・材料・位置を変えると、これらの再測定と再承認が要る（決定表 L-2 は「予期しない変化は再 HOLD」）。
- **テスト・golden**: `expansionBatch25.test.tsx`、Research の 42 ID 固定（R-00／R-01）、hint の ladder golden（`hint5.ladders55.json` など）、`alphaFamilyOnly`、staged の golden、生成 E2E（`t25.spec.ts`）。
- **全行共通で効かないもの**: 他の recipe の台帳（recipes.ts）、保存形式。

---

## 1. swedish-kebab-pizza（…-p4） — 「肉」の省略 〔B25-M2-D1（案 A 承認）〕
**原典**: 名称「スウェディッシュケバブピザ」。材料表記は「肉」「ケバブソース」「モッツァレラチーズ」「レタス」。**「肉」は generic_unspecified**（曖昧、関連候補 beef／pork／chicken／ground-beef）。ソース系統は「ホットソース」で、下地は未特定（spreadLayers: 未特定のホットソース下地 + kebab-sauce）。分類: BLOCKED_EVIDENCE（BASE_SAUCE_UNSPECIFIED + UNRESOLVED_INGREDIENT）。
**現在の実装**: kebab-sauce 1（PAINT、`#d86a35` は Owner 承認済み I-4）、mozzarella 3、lettuce 2（POST_BAKE の FINISH）。**肉の材料は無く、未特定のホットソース下地も無い**。late step 97（kebab-sauce）。
**未承認の点**: 「肉」を省略して出荷してよいか。ホットソースの下地を省略（kebab-sauce 1 層のみ）としてよいか。

| 案 | 内容 | 影響範囲 |
|---|---|---|
| A（現状） | 「肉」を省略し、GAMEPLAY ASSUMPTION として明示承認する | 実装変更なし。承認記録のみ。Phase-2 の行は「原典未確認の暫定仕様」の扱いのまま |
| B | 既存の肉（beef／pork／chicken／ground-beef のいずれか）を 1 材料足す | recipe の材料が 1 つ増える。重複 Gate（Jaccard 0.4・差分 2）と Research の 42 ID（肉の cohort に新たに入る）、hint の rung、Reference・SVG（既存材料なら新規 SVG は不要）、E2E、golden を再測定。late step の数は変わらない。tomato 系の recipe との Jaccard の再確認が必要 |
| C | T25 から外し HOLD（chicken-tikka と同様） | late 97〜101 が 4 件になり、step 番号と「+1 移動」が変わる。不変条件の「late 97〜101」と 42 ID を再測定・再承認。kebab-sauce の ΔE 例外（B-1）の対象が消える |

推奨: A（最小。ただし「肉の省略」を決定表に明記する）。

## 2. banh-mi-pizza（…-p6） — NO_SAUCE 〔B25-M2-D2（案 A 承認）〕
**原典**: 名称「バインミーピザ」。材料: carrot・cilantro・daikon・ham・liver-pate・mozzarella（6 点、全て特定済み）。**ソース系統は「その他」で、下地は未特定**（`unspecified_sauce_base`）。分類: BLOCKED_EVIDENCE（BASE_SAUCE_UNSPECIFIED）。
**現在の実装**: 下地なし（NO_SAUCE、`sauceBase: []`）。mozzarella 3・carrot 2・cilantro 2・daikon 2・ham 2・liver-pate 1。late だが POST_BAKE なし（決定表 L-1 で承認済みの 1 例外）。step 98（daikon + liver-pate 同時、L-3 承認）。
**経緯**: 追加判断書（2026-11-10）は「25-2 banh-mi の NO_SAUCE は**未承認**（原典調査後に再判断）」。その後のパケット R1 は「liver-pate を塗り層として使う」案を提示したが、決定表（2026-11-15）の I-6 は liver-pate を **topping／meat・複合 1 ピース**（塗り層にしない）と決定。決定表 §5 は「SAUCE を持つのは、将来別途承認された下地を選ぶ場合のみ」とだけ記す。
**未承認の点**: 下地なし（NO_SAUCE）での出荷。

| 案 | 内容 | 影響範囲 |
|---|---|---|
| A（現状） | NO_SAUCE を GAMEPLAY ASSUMPTION として明示承認 | 実装変更なし。NO_SAUCE は `noSauceRecipeIds()` に載っており、Technique の `no-sauce` が必要になる（実測済み）。他の NO_SAUCE は Owner が個別判断してきた（apple-cinnamon・nutella・smore 等）ので、同じ形式の承認が必要 |
| B | 既存の sauce を下地に足す（候補は、原典が「その他」で特定できないため Owner が選ぶ） | SAUCE 工程が加わり、調理フロー・Reference・hint（sauce の rung）・Research cohort・Jaccard が変わる。late かつ POST_BAKE なしの例外（L-1）の前提（工程 DOUGH→CHEESE→TOPPING→BAKE）も変わる |
| C | T25 から外し HOLD | step 98 が無くなり、late 97〜101 の割当て（daikon・liver-pate の 2 食材同時解放）が崩れる。不変条件「step 98 で 2 食材同時解放」自体の再決定が必要 |

推奨: A（既存の L-1／L-3／I-3／I-6 と整合。ただし NO_SAUCE を明示承認する）。

## 3. mexican-elote-pizza（…-p13） — sour-cream 下地 〔B25-M2-D3（案 A 承認）〕
**原典**: 名称「メキシカンエロテピザ」。材料: chili-powder・corn・cotija・lime・mayo。**ソース系統は「ホワイトソース」で、下地は未特定**（汎用の白ソース、「掲載された白ソース系の項目だけが満たす」。mayo が 2 層目）。分類: BLOCKED_EVIDENCE（BASE_SAUCE_UNSPECIFIED）。
**現在の実装**: sour-cream 1 を下地（PAINT）。feta 3・corn 2・mayo 2・paprika-powder 2・lime 2（POST_BAKE の FINISH）。**原典との差**: cotija → feta、chili-powder → paprika-powder の置換が含まれる（承認パケットの構成。置換自体の個別承認行は決定表に無い）。late step 99（lime）。
**経緯**: 追加判断書は「25-3 elote の NO_SAUCE は未承認」。後のパケット R1 が「sour-cream 1 を下地」を提示したが、決定表に確定の承認行がない。
**未承認の点**: sour-cream を下地にすること（と、上記 2 つの置換の扱い）。

| 案 | 内容 | 影響範囲 |
|---|---|---|
| A（現状） | sour-cream 下地 + 2 つの置換を明示承認 | 実装変更なし。sour-cream は goulash-pizza の下地でもあり、Research の cohort（goulash の paprika-powder・sour-cream の行）に既に影響が記録されている（決定表の 42 ID に含まれる） |
| B | fromage-blanc-sauce を下地にする（「白ソース系」を満たす既存の sauce） | Research の cohort が変わる（fromage-blanc-sauce を下地にする既存 recipe は moussaka-style-pizza と reina-pepiada-pizza。matcher.test.ts の既存コメントによる）。42 ID の再測定・再承認。Jaccard・hint の rung・Reference を再測定 |
| C | NO_SAUCE（追加判断書で未承認と明記） | 下地なし。mayo の層の扱いが変わる。late 99 の位置は不変 |
| D | 置換（feta・paprika-powder）を原典へ戻す（cotija・chili-powder は新規材料になる） | 新食材 2 種の追加（T25 の「全食材の並行追加」の範囲を広げる）。SVG・shop・ladder の再設計 |

推奨: A（既存の goulash との整合が実測済み）。ただし置換 2 点を併せて明示承認する。

## 4. pizza-asparagi-limone（…-p8） — MECHANIC_INTERPRETATION 〔B25-M2-D4（案 A 承認）〕
**原典**: 名称「ピッツァ・コン・アスパラージ・クルーディ・エ・リモーネ」（**crudi＝生**のアスパラガスとレモン）。材料: asparagus・lemon・mozzarella・olive-oil・parmigiano（5 点、全て特定済み）。ソース系統は「ノンソース」で、olive-oil が 1 層。分類: BLOCKED_MECHANIC_INTERPRETATION（種別名のみで、解釈の詳細は台帳に無い）。
**現在の実装**: olive-oil 1（PAINT_TEMPORARY）・mozzarella 3・parmigiano 3 を焼成前、asparagus 2・lemon 2 を **POST_BAKE の FINISH**（「生」＝焼成後と解釈）。late step 100（asparagus）。重複例外 D-3（quattro-formaggi との Jaccard 0.429）は決定表で承認済み。
**先例**: 同じ MECHANIC_INTERPRETATION の `pizza-finocchi-salad-pizzadb-p8` と `pizza-cavolo-carote-pizzadb-p8` は、Batch 22 で「生の野菜は焼成後（POST_BAKE）」と解釈して出荷され、Owner が個別承認した（`matcher.test.ts` の ownerApproved に記録済み）。
**未承認の点**: asparagi に同じ解釈（crudi＝焼成後）を適用すること。

| 案 | 内容 | 影響範囲 |
|---|---|---|
| A（現状） | B22 の先例どおり「crudi＝POST_BAKE」を、asparagi にも明示承認 | 実装変更なし。承認記録のみ。FINISH の 2 ピース（asparagus・lemon）の Reference と E2E は検証済み |
| B | 生ではなく焼成前に置く（調理して使う解釈） | POST_BAKE の材料が無くなると、late catalog の検証規則（late recipe は POST_BAKE を持つ。例外は banh-mi の 1 件のみ、`lateCatalog.ts` の `lateWithoutPostBakeExceptions`）に反する。ordinary へ移すか、例外をもう 1 件承認するかが必要で、いずれも step 番号と不変条件（ordinary 81／late 97〜101）の再設計になる |
| C | T25 から外し HOLD | late 97〜101 が 4 件になる。ΔE・Research は影響小だが、D-3 例外・asparagus・lemon の出荷が遅れる |

推奨: A（B22 の 2 行と同じ解釈で、Owner の個別承認の先例がある）。

---

## Owner 決定（2026-11-16）の反映
- 4 行とも案 A を承認。差異（GAMEPLAY ASSUMPTION）: swedish-kebab は原典の「肉」・ホットソース下地を省略、elote は cotija→feta と chili-powder→paprika-powder の置換、asparagi は crudi を POST_BAKE と解釈、banh-mi は下地なし。
- 反映: `matcher.test.ts` の `ownerApproved` に 4 id を追加（`matcher.test.ts` の「Expansion Batch 25 M-2」コメントに決定 ID）。recipe・catalog・Research・step は不変。
- 不変条件: ordinary 81／late 97〜101／step 98 で 2 食材同時解放／canonical Research 変化 0／non-canonical 42 ID／既存 late の +1 移動／B-1 色例外 5 ペア／B-2 重複例外 1 ペア。
