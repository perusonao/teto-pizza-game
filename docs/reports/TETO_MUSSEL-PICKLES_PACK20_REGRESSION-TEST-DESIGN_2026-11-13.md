# mussel / pickles pack 20 — 回帰テスト設計（docs-only）

Date: 2026-11-13

Base: `main` `81974d02`

Scope: test design only; production/test code unchanged

## 1. 固定する契約

T24/T26 の候補追加により最大使用数 `k` が 1 から 2 へ上がるため、`mussel` と `pickles` の pack quantity は 10 から 20 へ変わる。一方、両方とも T4 の価格を維持する。

| ingredient | current | target | price contract |
|---|---:|---:|---|
| `mussel` | pack 10 | pack 20 | first pack 120 Pitz / refill 60 Pitz unchanged |
| `pickles` | pack 10 | pack 20 | first pack 120 Pitz / refill 60 Pitz unchanged |

Authority inputs:

- `docs/reports/data/TETO_TRAIN-EFFICIENCY/T24.spec.json` / `T24.preflight.md`
- `docs/reports/data/TETO_TRAIN-EFFICIENCY/T26.spec.json` / `T26.preflight.md`
- `src/logic/materialShop.ts`
- purchase/refill authority (`purchaseFirstPack` / `refillPack`) in `src/logic/materialShop.ts` and the corresponding reducer actions
- save normalization/migration in `src/state/persistence.ts`

## 2. Proposed test placement

実装時は T24/T26 のclaimと重ならないことを再確認してから、最小の専用回帰ファイル（例: `src/logic/materialShop.pack20.regression.test.ts`）に集約する。既存 batch test の固定値だけを書き換えて完了扱いにしない。

## 3. Test matrix

| ID | Layer | Setup | Action | Required assertion |
|---|---|---|---|---|
| MP20-01 | offer pure | T24/T26 landed catalog | `materialOffer(mussel/pickles)` | `k=2`, `packQuantity=20`, `packPrice=120`, `refillPrice=60`, tier T4 and step unchanged |
| MP20-02 | first purchase | entitled, not owned, balance exactly 120 | real first-purchase authority | success; balance 120→0; ownership appended once; inventory exactly 20 |
| MP20-03 | first purchase atomic fail | balance 119 | same | failure; balance, ownership, inventory byte-equivalent to before |
| MP20-04 | refill | owned, stock 0, balance exactly 60 | real refill authority | success; balance 60→0; stock 0→20; ownership order unchanged |
| MP20-05 | refill additive | owned, stock 3, balance 60 | refill | stock 3→23, not replacement with 20 |
| MP20-06 | refill atomic fail | owned, stock low, balance 59 | refill | no debit and no stock change |
| MP20-07 | repeated refill | owned, stock 0, balance 120 | refill twice | stock 40, balance 0; each transaction grants exactly 20 |
| MP20-08 | consume boundary | stock 20 and a valid pizza consuming 2 | real finalize/consume path | stock 18; pack-size change does not alter per-pizza consumption |
| MP20-09 | old v2 save | serialized save has owned ID and inventory 7 | load/migrate | remains 7; loading must not top up to 20 |
| MP20-10 | old v2 zero | owned ID and inventory 0 | load/migrate | remains owned with 0; no free refill |
| MP20-11a | v1 migration, inventory absent | v1 save owns the ID and has no v2 inventory field | migrate v1→v2 | current `DEFAULT_MIGRATION_RESTOCK_QTY` backfill remains exact; it is not replaced by pack 20 |
| MP20-11b | v2 missing inventory key | v2 save owns the ID but that inventory key is absent | sanitize/load v2 | key remains absent/effective zero under the current contract; no 20-unit windfall |
| MP20-12 | round trip | old save → load → persist → reload | persistence round trip | inventory and ownership stable; schema version unchanged |
| MP20-13 | unrelated T4 control | `porcini` or another unchanged `k=1` item | `materialOffer` | remains pack 10 / 120 / 60; change is ID-scoped through composed recipe maxima |
| MP20-14 | catalog composition guard | shipped vs composed T24/T26 inputs | derive maximum count | only landed candidate raises each selected ID; staged-not-landed behavior follows the train contract |

## 4. Old-save fixtures

最低限、次の手書きfixtureを各IDでparameterizeする。

1. owned + stock 7 + 180 Pitz
2. owned + stock 0 + 60 Pitz
3. not owned + no inventory key + 120 Pitz + entitled
4. v1 owned + inventory field absent（migration既定量をassertし、pack 20とは独立であることを固定）
5. v2 owned + target inventory key absent（sanitize後も20を付与しないことを固定）

テストは「期待する20」を migration fixture に埋め込まない。20が適用されるのは新しい購入・補充 transaction のみで、保存済み数量はユーザーデータである。

## 5. STOP conditions

- 価格が 120/60 から変わる。
- first purchase と refill で異なる pack quantity が使われる。
- load/migration が既存 stock を20へ補正・増量する。
- recipe 1枚の消費量が pack-size変更に連動する。
- `mussel` / `pickles` 以外の offer が意図せず変わる。
- staged candidate を未出荷状態で production authority が読む。

## 6. 実行計画（実装時）

1. T24/T26 の landed 状態とclaimを再確認。
2. pure offer testsを先に追加し、期待する赤を確認。
3. purchase/refill/old-save testsを追加。
4. targeted Vitest、full unit suite、typecheck、lint、buildを実行。
5. save schema/version diffがないことを確認。

このPRでは設計のみで、テストコード、production code、staged data、save schemaを変更しない。
