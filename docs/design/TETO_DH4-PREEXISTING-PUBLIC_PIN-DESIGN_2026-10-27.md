# DH4 `preExistingPublic` の pin を「標本」から「全探索」へ — 設計案（docs-only、#679 の調査から）

Status: **調査と設計案のみ。実装しない**（`src/**`・テスト・golden は無変更）。基準 `main` `08cd46d5`（#677 merge 後）。#679（BBQ）の `deductionProduction.gate.test.ts` の変更が発端。**privacy の assertion は緩めない**（本案も緩めない）。
Authority: Owner 判断（2026-10-27）「`preExistingPublic` の全探索ベースの検証への変更案を docs-only で調査」。

## 1. 問題

`deductionProduction.gate.test.ts` の「k >= 2 …」は、ladder 状態・全所持・**シード付きランダム順 40 本**の各状態で `hypotheticalReserves(parts)`（仮説の reserve の集合 H）を計算し、`H.length < MIN_ATTRIBUTE_CANDIDATES`（= Hint 3.0 の Rule W が既に 1 件に絞る状態、DH4 は何も足さない）になった recipe の集合を `preExistingPublic` に集め、**厳密一致**で pin している（現在 `melanzane-pizza` / `parmigiana-pizza`、#679 で `pesto-caprese` が加わる）。

- この集合は**標本（ランダム順 40 本）に依存**する。`INGREDIENTS` が増えるとシャッフルの列が変わり、同じ構造的条件がたまたま標本に入る／入らないだけで pin が動く（新しい漏えいが生まれたわけではない）。
- 実測（#679 の調査、同一手順で BBQ 前後）: 40 シードでは pesto-caprese が「なし → 2 状態」、600 シードでは**BBQ 前の main でも 6 状態**で、頻度は不変（6 → 6）。parmigiana は 40 シードで 8 → 12、600 シードで 106 → 134（母数の増加）。

## 2. 構造（なぜ全探索が可能か）

`hypotheticalReserves`（`deductionGuard.ts`）:

```
known   = knownPart(parts)                      // その recipe の材料から reserve を除いたもの（recipe で決まる）
floor   = max(Rule W rank of known \ {key})      // recipe で決まる
keyStep = ingredientKeyStep(key)                 // recipe で決まる
prefix  = makeablePrefix(parts)                  // 所持順のうち、recipe が作れるようになるまでの接頭辞
H = { id ∈ prefix : id ∉ known, id ≠ key, rank(id) ≥ floor, step(id) ≤ keyStep }
```

- `known` / `floor` / `keyStep` は **recipe だけで決まり、所持順に依存しない**。所持順が効くのは `prefix` だけ。
- H は `prefix` に**単調**（prefix が大きいほど H は同じか大きい）。したがって `|H|` の最小値は、**最小の接頭辞 = スターター + その recipe の必要材料（作れるようになる最後の 1 つまで）**で達成される。他の材料は、後から手に入れる順なら prefix に入らない。
- 最小の接頭辞は、recipe の非スターター材料の**並べ替え**だけで尽きる（≤ 7 材料 → 最大 5,040 通り。実際は 3〜6 材料）。ランダム順の標本は必要ない。

## 3. 検証（実測、`vite-node` 相当の一時テスト。リポジトリには含めない）

各 recipe について「スターター → その recipe の非スターター材料のすべての並べ替え」× `discoveredCount ∈ {5, 24}` で `targetReserveParts` → `reserveInHypotheses` → `hypotheticalReserves` を計算し、最小の `|H|` が `MIN_ATTRIBUTE_CANDIDATES` 未満になる recipe を列挙した。

| | 食材 | レシピ | `|H| < MIN` になる recipe（最小の接頭辞） |
|---|---|---|---|
| main（#677 merge 前の #673 時点と同じカタログ） | 75 | 69 | `melanzane-pizza`（H = [basil]）、`parmigiana-pizza`（[basil]）、`pesto-caprese`（[basil]） |
| #679（BBQ 後） | 77 | 70 | **同じ 3 件**（H = [basil]） |

- **決定的**（乱数なし）で、BBQ の前後で**同一**。標本では pesto-caprese が出入りしたが、構造的には最初から 3 件。
- いずれも reserve の仮説は `basil`（スターター）のみ。ガードはこの状態で `existence`・トッピング節なしの fail-closed（既存の assertion が全状態で成立）。

## 4. 設計案

1. **集合の pin を全探索の結果に置き換える**（既存の厳密一致は維持し、標本ではなく全探索で定義する）。`preExistingPublic` の期待値は「全 recipe × 必要材料の並べ替え × `discoveredCount ∈ {5, 24}` の最小 `|H|` が MIN 未満の recipe」の集合を**テスト内で計算した値**と一致、かつ**現在の 3 件を明示した固定リスト**とも一致（2 重 pin）。新しい recipe / 材料がこの集合を変えたら、**原因が構造（recipe の材料と Rule W / key step）にあることが assertion の差分で分かる**。
2. **ランダム順の掃引は残す**が、`preExistingPublic` の厳密一致には使わない。標本で見つかった「H < MIN」の recipe は、全探索の集合の**部分集合**であること（健全性: 標本が全探索に無い recipe を見つけたら失敗）を assert する。これは緩和ではなく**追加の検査**（標本 ⊆ 全探索）。ガード側の assertion（`existence`・節なし、独立攻撃者 0）は、標本・全探索の両方の状態で従来どおり assert する。
3. **全探索の状態も、ガードの assertion の対象に加える**（最小接頭辞の状態は標本に入りにくい最悪ケースなので、privacy の検証としても強くなる）。
4. 計算量: 69 recipe × 最大 5,040 並べ替え × 2 は秒単位（実測、上の一時テストは数秒）。`SWEEP_TIMEOUT_MS` の範囲内。
5. **変更しないもの**: `MIN_ATTRIBUTE_CANDIDATES`、ガードの assertion、Hint 3.0 / DH4 の計算、本番コード。テストの追加と pin の定義の変更のみ。

## 5. 限界・未確認

- 単調性の議論は `hypotheticalReserves` の現在の定義（上の式）を前提とする。定義が変わったら全探索の前提を見直す（テスト内で「prefix が大きいと H が縮まない」を、標本で検査する補助テストを置くと、前提の崩れを検出できる）。
- `discoveredCount` の値は 5 と 24 を使った。`makeablePrefix` / Rule W の rank が `discoveredCount` に依存する場合は、依存する閾値の境界（ladder の主要 step）も含める必要がある（実装時に `deductionGuard` の依存を再確認）。
- 到達可能性（ladder で実際に起きる順序か）は別の問い。標本の該当状態はすべて ladder では到達できない順序だった（#679 の調査）。全探索の最小接頭辞は「T1a の信頼できない順序も含む最悪ケース」で、**本番で起きるとは主張しない**。
- 実装は別の PR（Owner の承認後）。本書は設計案のみ。

## 6. Owner 判断

1. 上の案（全探索で pin を定義し、標本は部分集合の検査に降格）で進めるか。
2. 実装を #679 に含めるか、独立 PR にするか（推奨: **独立 PR**。#679 は BBQ のデータ PR で、gate の仕組みの変更を混ぜない。#679 は現行の標本ベースの pin に `pesto-caprese` を足した版で merge でき、後続の PR が pin の定義を置き換える）。
