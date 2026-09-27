# Large Catalog UX — LC-1 / LC-1b Result Report

- Issue: **#269**（LC-1 / LC-1b）。LC-X（1つ戻す）: **#270**（独立 Issue、未実装）。
- Branch: `claude/large-catalog-ux-design-sq8saf`（`origin/main` `7bb0116` を merge 済み）。
- Authority:
  - `docs/reports/TETO_LARGE-CATALOG-UX_LC-1_Implementation-Gate.md`（判定 A）
  - `docs/reports/TETO_LARGE-CATALOG-UX_Owner-Decision-Gate.md` §17
- 状態: **READY FOR OWNER REVIEW**（merge しない。auto-merge なし。deploy なし）。

## 1. Fresh GitHub state

| 時点 | main | 対応 |
|---|---|---|
| Implementation Gate | `51e0923`（PR #252 Dinner DM-3R-2） | Gate を作成 |
| 実装中 | **`7bb0116`**（PR #264 DH4-2A pure logic、PR #265 DH4-2 docs） | main を merge し、DH4-2A と両立するよう API を修正（§3） |

## 2. 実装したもの

| ファイル | 内容 |
|---|---|
| `src/logic/catalog/catalogTypes.ts` | `CatalogIngredient`（レシピ情報を持たない表示用記述子）、`OwnershipView`、`CatalogFamilyId` / `CatalogFamilyTable`（taxonomy を注入するための型）、安定順序、id のサニタイズ |
| `src/logic/catalog/catalogSource.ts` | `runtimeCatalog(familyOf)`。`INGREDIENTS` だけを読む |
| `src/logic/catalog/catalogText.ts` | 検索の正規化（NFKC・カタカナ→ひらがな・長音 / 中黒 / 空白の除去、code point 比較） |
| `src/logic/catalog/catalogQuery.ts` | `queryCatalog`（OWNED のみ、category / family / text / favorite / recent / in-stock、sort は catalog / recent / reading / stock、在庫 0 は末尾）、`familyCounts`（所持 × family のみ） |
| `src/logic/catalog/usageSignals.ts` | session 内の favorite / recent / newly-owned（LC-OD-5）。上限あり、own property だけを読む |
| `src/logic/catalog/hintDisclosure.ts` | `disclosedHintsFromSheetView`（シートが表示したものだけ）、`libraryFilterForAttribute(factId, taxonomy)`（回答の粒度のまま） |
| `src/logic/catalog/workingSet.ts` | `selectWorkingSet`（capacity は引数。placed > pinned > hint > favorite > recent > new > fill。自動の source は在庫 0 を除外。容量以下なら現行トレイと同一） |
| `src/logic/catalog/dexActionSummary.ts` | `summarizeChapter(s)`（LC-OD-8b 所持基準。import なし、在庫は引数に存在しない） |
| `src/logic/catalog/testSupport/largeCatalogFixtures.ts` | LC-1b fixture 8 種（§5） |
| `src/logic/catalog/*.test.ts` | 9 ファイル（§4） |
| `tools/large-catalog-ux/mutation-check.mjs` | mutation gate（§6） |

**既存ファイルの変更: なし。** production の src・e2e・CSS・workflow・save・Dinner・Hint / DH4 には触れていない。

## 3. Implementation Gate からの変更（DH4-2A 対応）

- DH4-1 の guard test は「production module は `ingredientTaxonomy` を import しない」ことを検査している。type import も対象。DH4-2A で許可リストが更新された。
- 当初案の `catalogSource` / `hintDisclosure` / `catalogTypes` は taxonomy を import していたため、この guard に抵触した。
- DH4 側を変えず（Owner 指示「Hint / DH4 を変更しない」）、catalog 側を**注入方式**に変えた。
  - `runtimeCatalog(familyOf)`: LC-2 が `ingredientAttributeFamily` を渡す。
  - `libraryFilterForAttribute(factId, taxonomy)`: LC-4 が `ATTRIBUTE_FAMILIES` を渡す。
  - family id は `string`（`CatalogFamilyId`）。
- boundary test は、catalog の production module が taxonomy を import することを禁止した（DH4 の guard と二重化）。mutant M16 で検証済み。
- DH4-2A の attribute 回答（`reserveAttributeAnswer` / `guardedReserveAttributeAnswer`）を、runtime の 25 レシピ × 3 通りの所持集合で実際に生成し、filter が回答の粒度どおりになることを確認した（family 56 / group 19 / category 69 / existence 6 件）。`meta:topping-total` などの structure fact は filter にならない。

## 4. テスト

| 種類 | 件数・内容 |
|---|---|
| unit | text / query / usage / hint / working set / Dex summary |
| property | `workingSet.test.ts`: 105 材料の fixture で 200 ケース（決定性、入力順に非依存、所持の部分集合、容量以下、placed が先頭） |
| privacy（P-1〜P-7） | P-1: 在庫を 0 にすると既存の `recipeDiscoveryState` は変わる（PV-1）が、summary は不変。在庫 data を entitlement に紛れ込ませても不変（adversarial）。P-2: target / matcher / near-miss / 正解材料 / reserve を余分なキーで渡しても出力が不変。P-3: 未購入 fact と reserve は disclosure に出ない（25 レシピすべて）。P-4 / P-5: family と group を粒度どおりに対応させ、group が reserve の family 1 つに潰れない。P-6: Dinner target を渡しても自動投入しない。P-7: import の静的境界 |
| production equivalence | 容量以下のとき、working set が `trayIngredientsFor(freeCook)` と 3 カテゴリすべてで一致 |
| scale / perf | 8 fixture すべてで、2 回の実行が deep-equal。1 回の全処理（working set 6 通り + query 3 + Dex summary）が 250ms 未満 |
| fixture | 人口・分割・章・family の件数・分布が `TETO_LARGE-CATALOG-UX_SCALE-MODEL.json` と一致。合成 id のみで実名なし |
| 全体 | **204 files / 4176 passed / 1 skipped**、`npm run lint` 0、`npm run build` 0。catalog の文字列は `dist/` に 0 件（未配線の確認） |

## 5. LC-1b fixtures

| id | 材料（sauce / cheese / topping） | レシピ（章） |
|---|---|---|
| `runtime-29x25` | 実データ 3 / 4 / 22 | 実データ 25（6 / 9 / 10） |
| `w2a-37x34` | 3 / 4 / 30 | 34（6 / 9 / 19） |
| `w2a-mixed-37x34` | 3 / 7 / 27 | 34 |
| `mid-40x34` | 3 / 7 / 30 | 34 |
| `catalog-62x101` | 10 / 10 / 42 | 101（23 / 37 / 30 / 11） |
| `progression-105x101` | 18 / 16 / 71 | 101 |
| `full-105x172` | 18 / 16 / 71 | 172（39 / 63 / 51 / 19） |
| `stress-179x172` | 31 / 25 / 123 | 172 |

- family: 105 → 24 / 13 / 11 / 8 / 7 / 5 / 3、179 → 40 / 20 / 17 / 15 / 12 / 11 / 8（PR #255 PROPOSED）。
- topping 数の分布は 172 matrix に準拠（0 topping の行は 1 に丸めている。TOPPING ステップで置ける物を必ず持たせるため）。

## 6. Mutation gate

`node tools/large-catalog-ux/mutation-check.mjs` の結果: **19 / 19 killed**（出力は `docs/reports/data/TETO_LARGE-CATALOG-UX_LC-1_MUTATION-RESULT.txt`）。

| mutant | kill した test |
|---|---|
| M1 RECIPES を import して正解材料を hint へ / M1b 余分なキーの正解材料を pinned へ / M2 matcher の import / M7 Dinner target の材料を pinned へ | P-7 boundary、P-2、P-6 |
| M3 未開示の fact を named に入れる | P-3 |
| M4 group → 先頭の family 1 つ / M5 family filter を 1 件に絞る | P-5 / query unit |
| M6 Dex summary が inventory を import / **M6b 紛れ込ませた在庫 map を読む** | boundary / P-1 adversarial |
| M8 fill が入力順 / M9 hint と pinned の順位入れ替え / M10・M10b 容量の off-by-one / M11 自動 fill に在庫 0 / M12 inactive 時の不一致 / M13 LOCKED の漏れ / M14 `__proto__` 経由の漏れ | property、priority unit、capacity unit、LC-OD-17 unit、production equivalence、query unit、usage unit |
| M15 production module が catalog を import / M16 catalog が taxonomy を import | B-6 boundary / P-7 + DH4-1 guard |

途中で生き残った mutant が 2 つあった。どちらも**テスト側の欠陥**で、修正後に kill されることを確認した。

- M6b: P-1 が紛れ込んだ在庫 data を検証していなかった → adversarial ケースを追加。
- M15: boundary が side-effect import（`import "x"`）を検出していなかった → 検出を追加。

## 7. W2-A との関係（fresh state で再判定）

- main は `7bb0116` に進んだ。追加されたのは DH4-2A の pure logic（unwired）と docs で、トレイ・Dex・Shop の UI や材料・レシピ数は変わっていない。W2-A の定義は GitHub 上にまだない。
- 判定は **C のまま**: W2-A の前提として必要なのは LC-1 / 1b だけで、本 PR がそれを満たす。
  - W2-A worst（topping 30）はトレイ 5 ページで、stage は不変。
  - `w2a-37x34` / `mid-40x34` fixture で次の閾値を検証できる。
- LC-2 / 3 は、いずれかのカテゴリの所持数が 30 を超える wave の前に必須（変更なし）。

## 8. Rollback

`src/logic/catalog/` と `tools/large-catalog-ux/mutation-check.mjs` を削除するだけで元に戻る。production からの import は 0 件で、bundle にも含まれない。

## 9. Owner Decision 残件

- LC-OD-4 の数値（9 / 12）: LC-2 で 4 viewport 比較と Human Feel により決定。
- LC-OD-8b の production 反映: LC-5。PV-1 はそれまで既存のまま。
- LC-X（#270）: Lunch Rush を含めるか、UI の位置、HV の範囲。
- LC-2 以降の各 slice Gate（LC-OD-3 / 9〜11 / 13〜15）。

## 10. Human Verification

UI・操作・見た目の変更がない pure logic とテストのみの変更なので、Human Verification Policy §2 の「原則不要」（見た目や操作が変わらない unit test 追加、内部実装）に該当し、動画・スクショはない。

## 11. PR #272 — CI とレビュー

| 項目 | 結果 |
|---|---|
| PR | #272（`claude/large-catalog-ux-design-sq8saf` → `main`、base `7bb0116`）。mergeable_state **clean** |
| CI（head `11471ac`） | **9/9 success**: `build`（lint → Vitest → build）、`classify`、`layout-chromium`、`Layout Contract Gate`、`webkit-390x844` shard 1/2・2/2、`webkit-360x800` shard 1/2・2/2、**`WebKit Gate`** |
| 旧 head `526fd25` の WebKit Gate FAIL | 修正 push による per-PR `cancel-in-progress` で shard 1/2 が cancelled になったためで、テストの失敗ではない。完了していた shard 2/2・layout-chromium・Layout Contract Gate はすべて success |
| Codex review（2 件、どちらも投影ツールの不具合） | ① P2: `vertical_scroll` の章数を `ceil(n/25)` から `CHAPTER_SIZES` に修正。172 の scroll 投影は −120px（範囲表記は不変）。② P1: 発見済みカードの DOM コストに locked 分を足し戻した。Dex 172 全発見の推定が 1045 → 2242 要素になり、Fresh Design の性能表を修正。どちらも `11471ac` で修正し、返信・resolve 済み |
| mutation gate | 19 / 19 killed（`docs/reports/data/TETO_LARGE-CATALOG-UX_LC-1_MUTATION-RESULT.txt`） |

**判定: READY FOR OWNER REVIEW。** merge、auto-merge、deploy はしていない。
