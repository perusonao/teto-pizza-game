# DRIZZLE D1 — Result（純粋ロジックのみ・未配線・本番 OFF、Refs #579）

作成: 2026-11-06 / 基準 `main` = `ed159e9` / ブランチ `claude/drizzle-d1-pure-logic-579` / 管理 Issue **#579**（D1 専用 claim 投稿済み）
仕様: `TETO_COOKING-DRIZZLE_D1_Spec_2026-11-06.md`（#773 の docs ブランチ `claude/teto-pizza-issue-773-nlyntr`。main には未取り込み）
Owner 承認範囲（2026-11-06）: **D1 の純粋ロジックのみ。** 初期液体 `olive-oil`／座標系は本番 `pizzaCoordinates.ts`／保存用上限 24 点×4 本（暫定）／本番フラグ `false` 固定／**D2〜D5 は HOLD**／#746 の iPhone HV は STEAM の HV 後。

## 1. 結論
D1 は新規ファイルだけで完了した。どこからも import されず、UI・reducer・journal・在庫・採点・識別・Dex・Pitz・保存には接続していない。`DRIZZLE_EXPERIENCE_PRODUCTION = false`。HV 動画は対象外（UI／操作が変化しない純粋ロジックのみ。`TETO_HUMAN-VERIFICATION-POLICY.md` §2 の「見た目／操作が変化しない unit test 追加」に相当）。

## 2. 追加ファイル（すべて新規、既存ファイルの変更ゼロ）
| ファイル | 役割 |
|---|---|
| `src/data/drizzleExperienceGate.ts`(+test) | `DRIZZLE_EXPERIENCE_PRODUCTION = false`、`drizzleExperienceEnabled()`。Preview／DEV の opt-in は持たない（#746 の `?drizzleLab=on` は無関係） |
| `src/logic/drizzle/postBakeLiquid.ts`(+test) | 型 `PostBakeLiquid`（Decision Brief の草案、**未承認**）、`olive-oil` の許可リスト、表示用／保存用／防御用の上限、`labToDough`（#746 の半径 44 → 本番 48 の換算） |
| `src/logic/drizzle/trail.ts`(+test) | `clampTrailPoint`（本番 `clampToDough` を再利用）、`clientToTrailPoint`（client → 生地 %）、`quantize`、`thinTrail`、`resampleTrail`、`dropRepeats`、`trailLength`、`tapTrail` |
| `src/logic/drizzle/sanitize.ts`(+test) | `sanitizeTrail`／`sanitizePostBakeLiquid`／`sanitizePostBakeLiquids`（読み取り検証。**例外を投げない**） |
| `src/logic/drizzle/drizzle.architecture.test.ts` | 独立性・未配線・非読取り・純粋性の固定 |
| `docs/reports/TETO_COOKING-DRIZZLE_D1_Result.md` | 本書 |

## 3. 仕様（数値はすべて PROVISIONAL）
- **座標系:** 本番 `src/logic/pizzaCoordinates.ts`（中心 50、半径 48、% 単位）。#746 の 100×100 面（半径 44）の長さは `labToDough`（×48/44、0.1 刻み）で換算し、値をテストで固定: `MIN_POINT_DISTANCE` 1.5、`TAP_TRAVEL` 3.3、`TAP_LINE_LENGTH` 17.5。表示用の点数・本数（160／24）は #746 と同値のリテラル（#746 は import しない）。
- **保存用の上限（Owner 暫定）:** 1 液体 24 点、1 ラウンド 4 本、座標は 0.1 刻み。**最悪ケースの JSON は 2,285 byte**（4 本×24 点、id 40 字、4 文字幅の座標）【実測、UTF-8】で、目標の 4KB 以下に収まる。`pendingRound` の上限 64KB（測定済み最悪 約 39KB）に対する余裕は残る。参考: #746 の表示上限（160 点×24 本）を保存すると約 77KB 【推論】で、64KB を超える。**D1 は表示用と保存用を分けた。**
- **検証（sanitize）:** 非オブジェクト、`stage !== "post"`、許可リスト外の食材、不正な id（`^[A-Za-z0-9-]{1,40}$`）、有効点 2 未満、長さ 0 の軌跡は `null`。非有限・過大（|座標| > 1000）の点は捨て、生地内へ投影し、量子化し、連続する重複を除き、24 点へ間引く。未知フィールドは捨てる。配列は末尾の 4 本を残し、同じ id は後のものを残す。生入力の上限（軌跡 1000 点、配列 64 件）を超えるものは走査しない。冪等、JSON 往復で不変。
- **タップ代替（#746 との差）:** タップの中心を、線全体が生地に収まる位置まで内側へ寄せてから描くため、**縁でのタップでも全長 17.5 の線**になる（#746 は両端を別々にクランプし、縁で短くなりうる）。HV の D4／D5 の結果で調整する。
- **丸め誤差の対策:** 量子化は縁の点を生地の外へ出しうる。量子化後に外なら 0.1 内側へ引いて再量子化する（全角度×半径の総当たりテストで、全点が生地内であることを固定）。

## 4. テスト
| 項目 | 結果 |
|---|---|
| D1 の新規テスト | **69 件**／5 ファイル通過（`npx vitest run src/logic/drizzle src/data/drizzleExperienceGate.test.ts`） |
| 変異検査（コードを壊して失敗を確認） | 6 種類すべて検出: 量子化後の再クランプ無し、タップの内側寄せ無し、`stage` 未検査、間引き無し、本数上限無し、量子化無し |
| `tsc -b` | 通過 |
| `npm run lint`（oxlint） | D1 のファイルに警告 0（全体の警告は既存ファイルのもの） |
| `npm run build` | 通過。**本番バンドルに D1 の名前なし**（`postBakeLiquid`・`DRIZZLE_EXPERIENCE`・`drizzleExperienceGate`・`logic/drizzle` が `dist/assets/*.js` に 0 件） |
| 全体 Vitest（`npx vitest run`、D1 追加後・lint 修正後の worktree） | **626 ファイル通過／1 skipped、11,608 件通過／13 skipped／2 todo、失敗 0**（1,004 秒） |
| E2E／WebKit | 対象外（UI なし）。CI の既存ジョブに委ねる |

テスト内容: 型と許可リスト（実在する `sauce` のカタログ食材）、上限の固定、座標変換（client → 生地 %、非正方形、退化した箱、非有限）、クランプ（全角度×半径、冪等、非有限・過大は `null`）、間引き（端を保つ・決定的・重複なし・入力不変）、タップ線（点でない・縁でも全長・決定的）、検証（各拒否条件、未知フィールド除去、`__proto__`、投げる getter／Proxy でも例外なし、冪等、JSON 往復）、保存サイズの最悪ケース、architecture（未配線・非読取り・独立・純粋）。

## 5. 対象外・HOLD（実施していない）
D2 journal の書き込み・読み出し／D3 在庫の原子性／D4 採点・識別・Reference／D5 UI／本番フラグ ON／共有 Preview 更新／merge。`gameReducer.ts`・`GameScreen.tsx`・`PizzaStage.tsx`・`App.tsx`・`main.tsx`・`pendingRound.ts`・`persistence.ts`・`inventory.ts`・`finalizeRound.ts`・`pizzaState.ts`、STEAM・FRY・炒め・炙り・#746 のファイルは変更していない（`git diff --stat origin/main` で新規ファイルのみ）。

## 6. 残る Gate・Owner 判断
- #746 の iPhone HV（STEAM の HV の後。D1 の数値の定数は HV の結果で調整しうる）。
- OD-DZ-3（消費単位）、OD-DZ-5（採点／Reference）、OD-DZ-6（late 軸への液体の算入）、OD-DZ-7（公開範囲）。D2〜D5 の着手は Decision Brief の 3 ゲート（保存互換・在庫の原子性・採点／識別）の承認後。
- 液体の「太さ」（速度との関係）は未検討。保存に入れるかは D2 の journal に影響するため Owner 判断。

## 7. 未確認事項
- 実機（iPhone Safari）・WebKit の挙動は未確認（D1 は UI なし）。
- 座標の換算（#746 の半径 44 → 48）の見た目への影響は D5 で再検証。
- `pendingRound` の測定済み最悪値 39KB は `pendingRound.ts` のコメントによる（再測定していない）。
