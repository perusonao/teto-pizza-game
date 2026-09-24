# Progression 2.0 Content Readiness / Implementation Wave — Fresh Audit

## 0. 結論

監査基準は `main` `dff233c042d2df6ee1c3a92f2d2419830aa05460`（2026-09-24T06:19:56+09:00）。PR #189 の 172-row matrix を read-only input として使い、分類を再作成していない。

- production は **15 recipes / 22 ingredients**。
- matrix は **172 rows: FULL 101 / PARTIAL 55 / NOT_REPRESENTABLE 16** のまま。
- production 15 件のうち 10 件に matrix correspondence があり、5 件（`funghi`, `napoletana`, `pepperoni`, `pizza-bianca`, `salsiccia`）は対応 row がない。これは欠落ではなく、172 evidence と production overlay の集合差である。
- 追加候補から production correspondence 10 row を除くと、最小差分 Wave は **W1 20件**、複数材料 Wave は **W2 29件**。
- 最初の 10 件候補は W1 内の同順位集合で、**新 ingredient 6種**に抑えられる。
- current renderer は ingredient の `color` + `emoji` を data から描画するため、専用 bitmap asset が必須の候補は **0**。ただし visual content authoring/review は新 ingredient ごとに必要。

## 1. SSOT / GitHub 実状態

| Source | State |
|---|---|
| Issue #182 | OPEN; parent scope。recipe は購入せず Free Cooking で discover。 |
| PR #189 | MERGED (`2f9f28e9...`); 172 mechanic matrix の authority。 |
| PR #191 | MERGED (`9c22ef2e...`); progression candidate design。数値は final ではない。 |
| PR #217 | OPEN / unmerged / clean; base = audited main。価格、unlock fee、star/non-star gates は owner decision のまま。 |
| Matrix | `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` |
| Production | `src/data/recipes.ts`, `src/data/ingredients.ts`（catalog と ID set を照合） |

## 2. 分類方法

1. matrix の canonical ingredient IDs と production 22 ingredient IDs を差分化。
2. ingredient overlap は候補 ingredient のうち production 既存材料が占める割合。併せて production 15 recipes との最大 Jaccard と exact-set collision を記録。
3. `FULL + READY` のみを即時 content wave に入れる。0–1 新材料を W1、2+ を W2 とした。
4. `FULL` でも review/blocker があれば W3。`PARTIAL` は W4、`NOT_REPRESENTABLE` は W5。
5. production correspondence は W0 reference とし、追加候補に二重計上しない。

## 3. Proposed implementation waves

| Wave | Meaning | recipes | distinct new ingredients | mechanic dependency | collision risk | evidence status |
|---|---|---:|---:|---|---|---|
| W0 | Current production baseline | 15 | 0 | none | {"PRODUCTION_BASELINE": 15} | {"SHIPPED": 15} |
| W0_CORRESPONDENCE | Matrix-to-production correspondence | 10 | 5 | DOUGH_VARIANT, MULTI_SPREAD_LAYER | {"HIGH": 2, "LOW": 5, "MEDIUM": 3} | {"ALREADY_SHIPPED_CORROBORATED": 1, "BLOCKED_PRODUCT_DECISION": 9} |
| W1 | Minimal current-mechanic additions | 20 | 16 | none | {"LOW": 20} | {"READY": 20} |
| W2 | Multi-ingredient current-mechanic additions | 29 | 48 | none | {"HIGH": 1, "LOW": 28} | {"READY": 29} |
| W3 | Content/evidence decision queue | 45 | 63 | none | {"HIGH": 1, "LOW": 26, "MEDIUM": 18} | {"BLOCKED_PRODUCT_DECISION": 38, "READY_WITH_REVIEW": 7} |
| W4 | Non-structural mechanic queue | 52 | 80 | DOUGH_VARIANT, LATE_ADDITION, MULTI_SPREAD_LAYER, PREP_STEP, STEP_ORDER, ZONED_PLACEMENT | {"HIGH": 6, "LOW": 40, "MEDIUM": 6} | {"BLOCKED_PRODUCT_DECISION": 29, "READY": 14, "READY_WITH_REVIEW": 9} |
| W5 | Structural mechanic queue | 16 | 11 | DOUGH_SHAPE_TARGET, DOUGH_VARIANT, ENCLOSE, FRY_COOK, LAMINATE, LATE_ADDITION, MULTI_SPREAD_LAYER, PAN_BAKE, STEP_ORDER | {"HIGH": 3, "LOW": 11, "MEDIUM": 2} | {"BLOCKED_PRODUCT_DECISION": 9, "READY": 4, "READY_WITH_REVIEW": 3} |

Wave counts are implementation buckets, not unlock order. Pitz price, unlock fee, star gate, non-star condition, and Completion Gate are all `TBD` / `OWNER_DECISION_REQUIRED`.

## 4. 最初の 10 recipes（順位なし、W1 内 candidate set）

選択規則は distinct new ingredients を最小化し、次に production ingredient overlap を最大化する deterministic set optimization。表示順は matrix 順であり順位ではない。

| evidence id | recipe | new ingredient | existing overlap | nearest production recipe |
|---|---|---|---:|---|
| `aussie-pizzadb` | オージーピザ | none | 100% | `breakfast-pizza` |
| `bacalhau-pizzadb` | バカリャウピザ | `salt-cod` | 75% | `tonno-e-cipolla` |
| `parmigiana-pizza-pizzadb-p7` | パルミジャーナピザ | `eggplant` | 75% | `margherita` |
| `pizza-portuguesa-pizzadb-p9` | ピッツァ・ポルトゲーザ | none | 100% | `capricciosa` |
| `puttanesca-pizza-pizzadb-p10` | プッタネスカ | `capers` | 75% | `marinara` |
| `full-english-pizza-pizzadb-p10` | フルイングリッシュピザ | `baked-beans` | 80% | `breakfast-pizza` |
| `pesto-tonno-pizzadb-p12` | ペストトンノピザ | none | 100% | `tonno-e-cipolla` |
| `polish-kielbasa-pizzadb-p12` | ポーリッシュキエルバサピザ | `sauerkraut` | 75% | `salsiccia` |
| `melanzane-pizza-pizzadb-p13` | メランザーネピザ | `eggplant` | 67% | `margherita` |
| `tsukimi-pizza-pizzadb-p14` | 月見ピザ | `green-onion` | 75% | `breakfast-pizza` |

必要な新材料は **6種**: `baked-beans`, `capers`, `eggplant`, `green-onion`, `salt-cod`, `sauerkraut`。

## 5. Change map（将来実装。今回変更なし）

今回の変更は docs/data/tooling のみ。runtime 実装時に影響する可能性がある file family:

- `src/data/ingredients.test.ts`
- `src/data/ingredients.ts`
- `src/data/recipeSauceProfiles.test.ts`
- `src/data/recipeSauceProfiles.ts`
- `src/data/recipes.test.ts`
- `src/data/recipes.ts`
- `src/logic/discovery/*`
- `src/logic/discovery/*.test.ts`

- Recipe data only: production 既存 ingredient だけを使う W1 の3件。
- New ingredient data only: current `spread` / `scatter` と `color` / `emoji` で成立する W1/W2。
- Asset addition: dedicated bitmap は不要。新 ingredient の visual fields は content authoring 対象。
- Evidence/content review: W3 と unresolved ledger を先に解消する。
- New mechanic: W4/W5。PR #189 の capability IDs をそのまま参照し、再分類しない。

## 6. Unresolved / content-authoring

- blocker/review を持つ rows: **104**。
- type counts: `{"BASE_SAUCE_UNSPECIFIED": 33, "CANDIDATE_CAPABILITY": 14, "COMPOSITION_CONFLICT_CANDIDATE": 18, "COMPOSITION_CONFLICT_SHIPPED": 9, "DISCOVERY_COLLISION": 2, "EVIDENCE_GAP": 2, "MECHANIC_INTERPRETATION": 11, "NAME_SPECIFICITY_GAP": 2, "NAMING_CLUSTER": 12, "PREPARED_COMPOSITE_INGREDIENT": 3, "SAME_INGREDIENT_SET_AS_CATALOG_RECIPE": 8, "SCOPE_QUESTION": 2, "SOURCE_INCONSISTENCY": 1, "UNRESOLVED_INGREDIENT": 24}`。
- 詳細: `docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_UNRESOLVED.json`。
- 価格・unlock: `pitzPrice=TBD`, `unlockFee=TBD`, `starGate=TBD`, `nonStarCondition=OWNER_DECISION_REQUIRED`。
- Completion Gate: `OWNER_DECISION_REQUIRED`。#217 や関連 Issue/PR の決定を先取りしない。

## 7. Machine-readable artifacts

- JSON: `docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_WAVES.json`
- CSV: `docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_MATRIX.csv`
- unresolved: `docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_UNRESOLVED.json`
- generator/checker: `tools/progression2_content_readiness_audit.py --check`

## 8. 次の推奨作業

1. W1 の candidate set 10件について、recipe description / minCount / bakeTarget / visual fields を content-authoring review する。
2. #217 の owner decision が終わるまで価格・unlock 条件を埋めない。
3. W1 を小さな production implementation PR に分け、discovery collision regression tests を同時追加する。
4. W3 unresolved ledger を blocker type ごとに別作業化する。W4/W5 は mechanic implementation 後に再評価する。

## 9. Issue management

既存 Issue #182 が 172 recipes、ingredient reuse、mechanic dependency、実装 PR 分割までを明示的に管理しているため、本 audit は #182 の子成果物として十分に管理可能。重複する専用 Issue は作成しない。

## 10. Validation

- `python tools/progression2_content_readiness_audit.py --check`: PASS
- `python tools/validate_recipe_catalog.py`: PASS（53 recipes / 62 ingredients / 11 mechanics）
- `python tools/progression2_evidence_invariants.py`: PASS 4/4
- #189 matrix `build()` + `validate()`: semantic PASS
- 既存 `progression2_mechanic_matrix.py --check` の byte check は Windows で `inputs[0]` の `/` と `\` だけが一致しない。最初かつ唯一の値差分であり、row/count/ingredient/status/capability/ledger の差分ではない。本 task では #189 generator/matrix を変更しない。
