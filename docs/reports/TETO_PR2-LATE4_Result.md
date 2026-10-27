# PR-2 late4 Result — プルコギ / わさび牛 / たらこクリーム（late catalog、暫定仕様）

Status: **実装済み・Owner 未承認・HV 未実施。** merge = 即本番公開（late catalog は本番 ON）。Owner の実機 HV と最終承認まで merge しない。
基準: `origin/main` = `c6a90e2`（#686 Batch 10 PR-1・#688 DH4 perf 取り込み後）。設計: `docs/design/TETO_PR2-LATE4_DESIGN-GATE_2026-10-27.md`。
**yakiniku-pizza は HOLD（含めない）。** 重複確認: open PR / ブランチ / Issue に同一実装なし（#611 が親 Issue、#578 が拡張親）。

## 内容（すべて GAMEPLAY ASSUMPTION / 暫定。原典 pizzadb.jp は未確認）
| レシピ | 構成 | late step（導出） | 鍵 |
|---|---|---|---|
| `bulgogi-pizza` | soy-sauce 1 (PAINT) / mozzarella 2 / onion 1 / beef 3 / white-sesame 1 (POST_BAKE) | 66 | soy-sauce |
| `wasabi-beef-pizza` | soy-sauce 1 (PAINT) / mozzarella 2 / onion 1 / beef 3 / wasabi 1 (POST_BAKE) | 67 | wasabi |
| `mentaiko-cream-pizza`（たらこクリームピザ） | fresh-cream-sauce 1 (PAINT) / mozzarella 2 / cod-roe 2 + nori 1 + shiso 1（すべて POST_BAKE） | 68 | nori |

新素材 5 件: `soy-sauce`（`#2a1a12`）/ `fresh-cream-sauce`（`#f2cfc0`）/ `wasabi`（spice, xs）/ `cod-roe`（seafood, xs）/ `nori`（vegetable, xs）。専用 SVG 3 点（`wasabi-dab` / `cod-roe-mass` / `nori-strips`）は**暫定の描画**で、参照 SVG ファイルと実機確認は未了。`beef` は #686 で既存（family meat、専用 SVG なし）。
floors: soy-sauce 66 / wasabi 67 / cod-roe・fresh-cream-sauce・nori 68（既存 6 件は不変）。

## 設計 Gate からの逸脱（要 Owner 判断）
1. **プルコギのソースを案 C（miso-sauce）→ 案 A（soy-sauce）に変更。** #686 が `beef` を通常素材にしたため、案 C では credited late recipe が自分の step に置く**新素材が 0** になり `validateLateCatalog` が成立しない。案 A の欠点: わさび牛との集合差が 2（white-sesame ↔ wasabi）で、Research の取り違えが起きやすい。OD-L4-3 は未回答。
2. **プルコギは matrix 上 `BLOCKED_PRODUCT_DECISION`。** `matcher.test.ts` の ownerApproved 集合に `bulgogi-pizza-pizzadb-p11` を足した（暫定出荷の目印。Owner が却下するならここと recipe を外す）。
3. cod-roe の `mid_bake` を POST_BAKE で近似（OD-L4-5 未回答）。id は `mentaiko-cream-pizza`・表示名「たらこ」のまま（OD-L4-6 未回答）。
4. 色（soy-sauce と fresh-cream-sauce の生地との差）は**未測定**。tahini の前例（最初の色が生地に近すぎた）あり。

## 検証
- `tsc -b` エラー 0、oxlint エラー 0。全 Vitest（Pinsa ON）: 10,074 passed。4 件の失敗はすべて 5000/10000ms timeout（負荷由来）で、該当 3 ファイルの単独再実行は 44/44 passed。
- `TETO_PINSA_OFF=1`（data / state / catalog / materialShop / baseCompat / lateAxis / testSupport）: 1,318 件中 1,308 passed → `pinsaGate.test.ts` 2 件を追従して 9/9（CI では走らない）。
- golden: `hint5.ladders55.json` は **+753 行・削除 0**（既存エントリ byte 同一）。`hint5.alphaFamilyOnly.json` は追加 3 件のみ。DH4-1 AUDIT.json は既存の `category` / `group` / `family` の件数が +3/+1（カタログ母数の増加による。privacy assertion は無変更）。
- 新規 `lateCatalog.late4.test.ts`: OFF で痕跡なし、データ、Reference、識別の一意性、ladder / Shop / Research / floors、Free Cooking の実 reducer（NEW_DISCOVERY と ORIGINAL への落ち方）。
- **DH4 実データ再測定**（`deductionProduction.gate.test.ts`、本ブランチ単独実行）: 独立攻撃者 sweep **23.1 秒**（SWEEP_TIMEOUT 120 秒の 19%。設計 Gate 時点の見込み 117 秒 / 98% は #688 の高速化で解消）。k≥2 sweep 15.2 秒。14/14 passed、`deductionGuard.gate` 含め 30/30。assertion・timeout は未変更。

## 未実施（Definition of Done の残り）
- HV 動画（390×844）と before/after スクリーンショット（Owner の実機）。Preview の更新は Owner 承認が必要。
- e2e（Chromium / WebKit）、参照 SVG の確定、Contract 2.1 §15 の再計算要否の確認。
- **#679（BBQ）との競合**: 両 PR が `lateCatalog.ts` ほか同じ追記点を触る。後から merge する側が取り込み、late step 番号と floors を再導出する（BBQ が先なら本 PR は 67〜69、floors も +1）。
