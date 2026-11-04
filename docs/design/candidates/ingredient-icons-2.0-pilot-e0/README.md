# Pilot E-0 — 候補 SVG（Issue #712、2026-10-31）

Authority: [`Style Lock V2 §11`](../../../decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md)。比較と判断: [`TETO_PILOT-E0_ROUND2_Result.md`](../../../reports/TETO_PILOT-E0_ROUND2_Result.md)、画像: [`docs/reports/screenshots/ingredient-icons-pilot-e0/`](../../../reports/screenshots/ingredient-icons-pilot-e0/)。

これらは**候補**で、`src/` は何も読まない。**Owner の採用は下表のとおり。採用デザインの参照 SVG への昇格（`references/ingredient-icons-2.0/`）は、Pilot E の実装 PR で行う**（bell-pepper のサイズ確認と最終形の確定の後）。

| ファイル | 食材 | 内容 | 状態 |
|---|---|---|---|
| `svg/green-pepper-a2-strips.svg` | ピーマン | 緑の細切り（磨き込み後） | **Owner 採用**（2026-10-31） |
| `svg/bell-pepper-b2-quarter.svg` | パプリカ | 赤の四つ割り（縮小・磨き込み後） | **条件付き採用**（1.65em を起点にサイズ確認） |
| `svg/pineapple-a2-wedges.svg` | パイナップル | くさび形（外皮を弱めた改訂） | **Owner 採用**（実機で果肉としての識別性を確認） |
| `svg/green-pepper-a-strips.svg` | ピーマン | 緑の細切り（初稿） | 比較のみ（A2 に改訂） |
| `svg/green-pepper-b-rings.svg` | ピーマン | 輪切り | 比較のみ（青ねぎと近く不採用） |
| `svg/bell-pepper-a-strips.svg` | パプリカ | 赤・黄の太い細切り | 比較のみ |
| `svg/bell-pepper-b-quarter.svg` | パプリカ | 赤の四つ割り（初稿） | 比較のみ（B2 に改訂） |
| `svg/pineapple-a-wedges.svg` | パイナップル | くさび形（初稿） | 比較のみ（A2 に改訂） |
| `svg/pineapple-b-cubes.svg` | パイナップル | 角切り | 比較のみ（フェタの角切りと同系で不採用） |
| `svg/chicken-b1-bites.svg` | チキン | 骨なしひと口 | 比較のみ。**既存のドラムスティック承認を維持**（変更は Owner の承認が必要） |
| `svg/chicken-b2-grilled-strips.svg` | チキン | グリル細切り | 同上 |

全 11 点が Style Lock V2 §2 の共通仕様（64×64、透明背景、接地影、`id` / gradient / `<defs>` / `url(#` なし、文字なし）に適合することを確認済み。
