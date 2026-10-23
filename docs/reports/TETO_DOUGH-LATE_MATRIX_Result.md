# #577 A — dough × late × pan 組合せ表テスト Result（テストのみ）

Refs #577。基準 `main` `bd71539`。Owner 判断（2026-10-23）に従い、**テストと本書のみ**を追加する。ゲームコード・データ・判定ロジック（`matcher.ts` / `signature.ts`）・採点・保存形式は変更しない。Pinsa 本体（P3 / C）は HOLD のまま追加しない。本番 FINISH / Late Catalog は OFF のまま。

## 追加物
- `src/logic/discovery/doughLateMatrix.test.ts`（41 tests）

## 何を固定し、何を固定しないか
ジャモン・セラーノの食材集合（tomato-sauce / mozzarella / prosciutto-crudo / arugula）を、**実物の `evaluateDiscovery`** に通す。軸は dough（標準 / Pinsa）× late（なし / 両方 / 生ハムのみ / ルッコラのみ）× pan（なし / tray）の 16 行。各行を次の 3 区分で分けて記録する。

| 区分 | 意味 | 扱い |
|---|---|---|
| PRODUCTION | 実カタログ（Pinsa なし・後乗せ target なし）での今の挙動 | 固定（本番 OFF の挙動の pin） |
| ADOPTED (I2) | Owner 採用済みの Q7 = I2（`dough` ∧ `late`）に沿った行。Pinsa target は**テスト内の合成 fixture**（カタログのデータではない） | 設計方針に沿う行として固定 |
| OBSERVED_UNAPPROVED | 「標準生地で、生ハム／ルッコラの一部または全部を後乗せ」→ 現在の実装は ORIGINAL | **現状の実装結果の記録（characterization）。承認済みの仕様ではない** |

### OBSERVED_UNAPPROVED（未承認）の扱い
FINISH ON 後、ハモンセラーノの食材を標準生地で作って後乗せを含めると ORIGINAL になる。これは PR #633 §12.2 の「ハモンセラーノへの副作用」で、**Owner は未承認**。テスト名に「characterization, NOT an approved spec」と明記し、「この区分は 6 行（標準生地 × 後乗せあり × {両方・生ハムのみ・ルッコラのみ} × {tray なし・あり}）に限る」ことと「Pinsa target の有無で結果が変わらない」ことだけを固定した。Owner が許容しない・別の挙動にする判断をした場合、これらの行は変更対象になる。

## 結果（現在の実装）
| dough | late | pan | 本番（Pinsa なし） | late ON（合成 Pinsa） | 区分 |
|---|---|---|---|---|---|
| 標準 | なし | なし | jamon（NEW） | jamon（NEW） | ADOPTED |
| 標準 | 両方 / 生ハム / ルッコラ | なし | ORIGINAL | ORIGINAL | **OBSERVED_UNAPPROVED** |
| Pinsa | なし | なし | ORIGINAL | ORIGINAL | ADOPTED |
| Pinsa | 両方 | なし | ORIGINAL | **Pinsa（NEW）** | ADOPTED |
| Pinsa | 生ハム / ルッコラのみ | なし | ORIGINAL | ORIGINAL | ADOPTED |
| 標準 | 両方 / 生ハム / ルッコラ | tray | ORIGINAL | ORIGINAL | **OBSERVED_UNAPPROVED** |
| 標準（late なし）/ Pinsa（late 任意） | tray | tray | ORIGINAL | ORIGINAL | ADOPTED |

- 本番とlate ONで結果が変わる行は **「Pinsa 生地 × 両方後乗せ × tray なし」の 1 行だけ**。
- ジャモンが発見されるのは「標準生地・後乗せなし・tray なし」の 1 行だけで、本番・late ON のどちらも同じ（誤発見なし）。
- ジャモン発見済みのプレイヤーは、標準の 1 皿で `ALREADY_DISCOVERED` のまま（本番・late ON とも）。ジャモン target 自体は本番のオブジェクトのまま、dough = standard / late = [] / pan = null で、DOUGH_VARIANT・LATE_ADDITION を要求しない。
- DOUGH_VARIANT / LATE_ADDITION を未サポートにすると、合成 Pinsa は一致せず、ジャモンの標準の 1 皿は変わらない。

## 範囲外・未実施
- Pinsa 本体のデータ追加（C）、`lateCatalog.ts` の変更、判定仕様の変更。
- 実カタログに後乗せ（ikura）を ON にした状態でのテスト（本番スイッチは変更しない。ON 相当は合成 fixture）。
- Dex・技法台帳・最良記録そのものの不変（`evaluateDiscovery` は純関数のため、本テストは判定結果のみ）。**実装 PR（C）の前に別途確認が必要。**
- RESULT・Hint・Research での時機の非開示（#627 AC-6 と同形のテスト）は C の範囲。
- HV: 見た目・操作が変わらないテスト追加のみのため不要（`TETO_HUMAN-VERIFICATION-POLICY.md` §2）。

## 検証
`npx vitest run src/logic/discovery/doughLateMatrix.test.ts` 41/41、`tsc -b`、`oxlint`（このファイル）に問題なし。
