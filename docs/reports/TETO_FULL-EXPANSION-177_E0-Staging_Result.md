# TETO FULL-EXPANSION 177 — E0 隔離基盤 + WS-R 84 レシピ + WS-I 70 食材 一括登録 Result（#780）

2026-11-07 / 基準 `origin/main` = `e6b205c`（作業開始時に再確認、変更なし）。claim: #780 コメント 6711787241。計画: `TETO_FULL-EXPANSION-177_Plan_2026-11-07.md`。

Owner 判断（2026-11-07）: G-1 GO／G-2 既存 claim を尊重して段階移行／**P-1 Staged 限定 GO**／R-1〜R-8・I-1〜I-3 は計画書の推奨を**暫定ルール**として採用（不可逆な除外・最終 ID 確定は再判定）／M-0 GO／H-1 全品自動テスト＋代表実機 HV の条件で GO。

凡例: 【実測】テスト・スクリプトの出力、【推論】解釈。**本 PR はゲーム挙動・UI を変えない**（本番ビルド成果物がバイト一致、§5）ため、HV Policy の HV 動画・スクリーンショットの適用外。

## 0. 結果（実測）

| 項目 | 値 |
|---|---|
| 登録レシピ | **84**（87 未実装行 − 既存作業の 3 行。evidenceId が計画の 84 行と完全一致、テストで固定） |
| 登録食材候補 | **70**（73 − burrata／honey／walnut）。内訳 ACTIVE 62、ALIASED_PROVISIONAL 6（I-1 で既存 id を再利用）、MERGED_PROVISIONAL 2（I-2） |
| 昇格可能（ブロッキング依存 0） | **0 / 84** |
| ブロッキング依存（項目数） | **433**（Owner ルール 121、工程 59、重複ゲート 193、ソース未特定 24、未解決トークン 21、in-flight 食材 8、ID 接尾辞 7） |
| 非ブロッキング（staged 食材の参照、昇格時に同じ列車で解消） | 69 |
| 重複ゲートで出荷済みと 1 件も当たらないレシピ | 38 / 84 |
| Hint 5.0（key-free）対象になれるレシピ | **84 / 84**。出荷済み 55 ladder の golden は**不変** |
| Research ラベル: 正準順で文字が変わる出荷済みレシピ | **19**（停止条件。原因となる staged レシピは 25 件）。非正準順を含むと 86 |
| 保存データ | staged id を含む保存を本番ビルドで読むと staged id だけ落ち、出荷済みデータ・Pitz は保持、読み込みで書き込みなし |
| 本番ビルド（`vite build` の dist） | main と**全ファイルの SHA-256 が一致** |

## 1. 追加したもの（すべて新規ファイル）

- `src/data/staged/stagedTypes.ts` — staged 型（`Recipe`／`Ingredient` とは別の型。候補であり catalog ではない）
- `src/data/staged/stagedMechanics.ts` — 工程レジストリ（M1〜M6、所有 Issue、Gate 名）
- `src/data/staged/stagedCatalog.ts` — 検証・重複ゲート・依存計算（出荷済みカタログを引数で受け取る純粋関数）
- `src/data/staged/testSupport/stagedRecipes.ts`（WS-R、生成）／`testSupport/stagedIngredients.ts`（WS-I、生成）。`testSupport/` は「本番コードが import しないモジュール」を置くリポジトリの既存慣例（`logic/catalog/testSupport/` と同じ）。計画書 §6 の `src/data/staged/stagedRecipes.ts` から場所だけ変えた（理由は §2 末尾）
- `src/data/staged/whatIfSupport.ts` — what-if 測定用の行（テストからだけ import）
- テスト 5 本: `stagedIsolation`・`stagedCatalog`・`stagedWhatIf.research`・`stagedWhatIf.hint`・`stagedSaveSafety`
- golden 3 本: `src/data/staged/__golden__/{stagedGate,whatIf.research,whatIf.hint5}.json`（実測値。変化は差分でレビューする）
- 生成器: `docs/reports/data/TETO_FULL-EXPANSION-177_stage-gen.py.txt`（`python3 -I … . <#781 rows.json>`。同じ入力で 2 回目もバイト一致を確認）

変更していないもの: HOT ファイル、`src/data/{recipes,ingredients,discoveryLadder,…}.ts`、既存 golden、`persistence.ts`、`src/preview/**`、`src/main.tsx`、他 claim の成果物、PR #783、preview リポジトリ。

## 2. E0 隔離と自動検証

| 検証 | テスト | 結果 |
|---|---|---|
| `src/data/staged/` を外から import するファイル（static／dynamic／require／re-export）が 0 | `stagedIsolation` | 0 件 |
| エントリ HTML が staged を参照しない | 同上 | 0 件 |
| 出荷済みカタログに staged id が無い、食材総数 97 のまま | 同上 | 合格 |
| 84 レシピ = 計画の 84 evidenceId、出荷済み + 87 = 177（Pinsa OFF ビルドでは 176） | `stagedCatalog` | 合格 |
| 70 食材 = 計画の 73 − 3、ステータス別の内訳を固定 | 同上 | 合格 |
| 構造検証（ID 形式・重複・出荷済み／in-flight との衝突、食材参照の解決、minCount、カテゴリと配置、family、usedBy、ステータス、レーン） | 同上 | 問題 0 件 |
| 工程レジストリの GATED_OFF が実際の `PREP_EXPERIENCE_PRODUCTION`／`FRY_EXPERIENCE_PRODUCTION`（false）と一致 | 同上 | 合格（本番 ON になると失敗して更新を促す） |
| 重複ゲート・依存の台帳（golden） | 同上 | §3 |
| Research ラベル what-if | `stagedWhatIf.research` | §4 |
| Hint 5.0 what-if | `stagedWhatIf.hint` | §4 |
| 保存安全性 | `stagedSaveSafety` | §5 |

既存ガードとの関係（実測、ガード側は変更していない）:
- #749 FRY の未配線ガード（`fry.architecture.test.ts`）は、FRY の名前を含む非テストファイルと、FRY のファイルを import するテストを禁じる。最初の版は工程レジストリに Gate 定数名を書き、テストで Gate を import していたため 2 件失敗した。レジストリから Gate 名を外し、テストは Gate ファイルの定数を**テキストとして読む**（import しない）形に直した。
- #577 Pinsa のガード（`doughPrivacy.test.tsx`）は、`testSupport/` を除く `src/**` の文字列リテラルに「ロマーナ」「romana」があることを禁じる（プレイヤーに見える文言の管理）。staged のレシピ名（ピッツァ・ロマーナ等）は本番から import されず表示されないので、生成データを `staged/testSupport/` に置いた。昇格するときに、この 2 品はこのガードの許可リストに個別に追加する（Owner レビュー対象）。

what-if の方法: テストファイル内の module mock で `ingredients`（と Hint では `ingredientTaxonomy`）に staged 食材と in-flight 3 食材を**メモリ上だけ**追加し、本番の `researchCohortLetters`／`researchLetterChangesAcrossOrders`（Batch 18/19 と同じシナリオ）／`buildHint5Ladder` をそのまま実行する。

## 3. 重複ゲートと依存（実測、`__golden__/stagedGate.json`）

重複ゲート（ingredient id 集合、個数無視、ソースも材料）。下表は「該当が 1 件以上あるレシピ数」。

| 種別 | 出荷済みと | staged 同士と |
|---|---|---|
| 同一集合 | 5 | 8 |
| 部分集合 | 17 | 13 |
| 上位集合 | 8 | 61 |
| 1 材料差 | 19 | 28 |
| Jaccard > 0.4 | 21 | 13 |

- mozzarella だけ（quad-cities・colorado）や mozzarella＋トマトだけ（trenton・ny-style）など、**生地や工程が正体のレシピは材料集合が小さく、出荷済みの多数の部分集合になる**【実測】。生地軸で区別できるか（R-3）が前提。
- staged 同士の上位集合 61 は、上の小さい集合のレシピを他の staged が包むため【推論】。

ブロッキング依存のレシピ数（1 件でもあるレシピ）: R-1 24、R-2 19、R-3 5、R-4 22、R-5 14、R-6 11、R-7 18、R-8 8／工程 DOUGH_VARIANT 31、PAN_PROFILE 6、ENCLOSE 5、DOUGH_SHAPE_TARGET 5、MID_BAKE 3、PREP 3、STEP_ORDER 2、ZONED 1、FRY 1、LAMINATE 1、MULTI_SPREAD_3 1。

依存が 1 種類だけのレシピ: `taco-pizza`（R-6 のみ。R-6 は暫定適用済みで、残りは確認だけ）、`piadina-romagnola`（DOUGH_VARIANT のみ）。

暫定ルールの適用（生成器が記録、各エントリの `applied`）:
- I-1 再利用 7 件（ground-beef→beef、salsa→tomato-sauce、blue-cheese-dressing→gorgonzola ×2、pecorino→grana-padano、chili-powder→paprika-powder、cotija→feta）。保持 4 件（chicken-tikka・spicy-salami・brick-cheese・mentaiko は再利用すると重複ゲートの当たりが増えるため新 id のまま）。blue-cheese-dressing は 1 品で再利用・1 品で保持のため ACTIVE のまま。
- I-2 統合 2 件（puntarelle→chicory、nutella-spread→chocolate。商標名の id を避けた）。
- R-6 1 件（taco-pizza の lettuce・tortilla-chips を既存の後乗せ POST_BAKE で表す）。
- I-3: 調理済み複合 5 種は 1 食材のまま（`composite: true`）。
- 除外は 0 件（不可逆な判断はしていない）。

## 4. Research・Hint（実測）

- **Research（停止条件）:** 84 品を全部足すと、**正準の ladder 順でも出荷済み 19 品の cohort 文字が変わる**（例: aussie A→C、pizza-portuguesa C→F、capricciosa 文字なし→A）。単独で正準順の文字を変える staged レシピは 25 件（`whatIf.research.json`）。いずれも**出荷済み食材だけで作れる**レシピ（39 件のうち 25 件）。非正準順を含めると 86 品に何らかの変化がある。**列車ごとに、この 25 件を入れるかを ID ごとに Owner が判断する必要がある**（B19 の AC-8 と同じ規則）。
- **Hint 5.0:** 84 品すべてが key-free の Hint 5.0 対象になる（トッピングは暫定 family で全件解決）。出荷済み 55 品の ladder golden（`hint5.ladders55.json`）は staged を足しても不変。key-topping を指定する authored roles は未作成（列車ごと）。DH4（deduction hint）は未測定。

## 5. 保存安全性と本番への影響（実測）

- staged の recipe id を Dex に、staged の食材 id を所持・在庫に入れた保存を本番ビルドの `loadSave` で読むと、**staged id だけが落ち**、margherita の Dex（bestScore 88・timesMade 4）、Pitz 1234、既存の所持食材は保持。読み込みで storage への書き込みは 0 回。
- この「未知の id は落ちる」挙動のため、Gate 付きの列車を本番 ON にする前に #668（Dex の raw エントリ保持）が必要（計画 §7-5 のまま）。
- `vite build` の dist は main（staged 無し）と本 branch で全ファイルの SHA-256 が一致。本番の挙動・バンドルは変わらない。

## 6. テスト（実測）

- `src/data/staged` の 5 ファイル 15 テスト: 合格（research what-if は単独で約 40 秒。Batch 18/19 と同じシナリオを 84 品 × 出荷済み 90 品に適用するため）。
- Pinsa ロールバック版（`TETO_PINSA_OFF=1`）: 13 合格・2 skip（golden は本番カタログ＝Pinsa ON で測ったため、その 2 件だけ skip）。
- **全 Vitest: 631 ファイル合格・1 skip、11,570 テスト合格・13 skip・2 todo、失敗 0**（ローカル、所要 16 分 51 秒）。
- 型チェック `tsc -b`: エラー 0。lint `oxlint`: エラー 0（警告は既存ファイルのみ、staged は 0）。
- `vite build`: 成功。dist 16 ファイルの SHA-256 が main と一致。
- 途中で見つかった不具合: 既存ガード 3 件の失敗（§2 末尾）。ガードは変更せず、staged 側を直した。

## 7. 残りの未確定事項（Owner 判断が必要なもの）

| ID | 内容 | 根拠（実測） |
|---|---|---|
| U-1 | 生地が正体のレシピ（mozzarella だけ等）を生地軸で区別してよいか（R-2／R-3 の個別判断） | 出荷済みと部分集合のレシピ 17、同一集合 5 |
| U-2 | Research 正準順で文字を変える 25 品の扱い（列車に入れるか、ID ごとの承認） | 正準順の変化 19 品 |
| U-3 | ソース未特定 24 品のソース（R-1 の個別適用） | SAUCE_UNSPECIFIED 24 |
| U-4 | 未解決トークン 21 件（唐辛子・ひき肉・チーズ等）を既存 id で解決するか | UNRESOLVED_TOKEN 21 |
| U-5 | 最終 ID（`-pizzadb` 接尾辞の 7 件を含む全 84 件） | ID_SUFFIXED 7 |
| U-6 | minCount・family・カテゴリ・名前の暫定値の確定（列車ごと） | 全件 PROVISIONAL |
| U-7 | アイコン（新食材 62 種の SVG／emoji、#417） | 未作成 |
| U-8 | 工程 M1〜M6 の進行（既存 Issue／PR の線） | 工程依存 43 品 |

## 8. 状況

- **完了**: claim 登録、E0（隔離・検証・what-if・保存安全性）、WS-R 84 レシピ、WS-I 70 食材の一括登録、一括検証、本書。
- **未完了**: 昇格（列車）は未着手。原典 pizzadb.jp は全件未確認。DH4 は未測定。e2e／WebKit は CI に任せる（UI 変更なし）。
- **ブロッカー**: 昇格できるレシピは 0 件。§7 の U-1〜U-8（特に U-1・U-2・U-3）と、HOT ファイルを触る列車の前提（PR #783 → B20-A の merge）。
- **次の行動**: CI と Codex のレビュー結果を確認する。§7 の判断を受けて、最初の列車（PT-1a）の候補を golden から機械的に選ぶ。merge・Production ON・共有 Preview 更新はしない。
