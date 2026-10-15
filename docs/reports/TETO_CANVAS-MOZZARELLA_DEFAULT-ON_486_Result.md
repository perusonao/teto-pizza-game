# Issue #486 — Canvas モッツァレラ 標準 ON 化 Result

Owner 方針: Canvas モッツァレラを本番の標準表示にする。PR #487 で入った opt-in と M1 fallback を活用し、既存の実機 HV 結果を再利用して不要な検証を繰り返さない。PR #494（ソース描画）は変更しない。基準 main: `d0da093`（PR #487 squash merge）。

## 変更（最小差分）
| ファイル | 内容 |
|---|---|
| `src/preview/cheeseRenderMode.ts` | 既定を ON に反転。定数 `CHEESE_CANVAS_DEFAULT_ON = true` を追加。保存キー `teto-pizza-cheese-canvas` の値: `"1"` = ON、`"0"` = M1、未保存・未知の値 = 既定（ON）。`?cheeseCanvas=0` は **`"0"` を保存**（再読込後も M1 を維持。T1 ではキー削除だった）、`?cheeseCanvas=1` は `"1"` を保存。storage が例外を投げる場合はパラメータ、無ければ既定 |
| テスト | `cheeseRenderMode.test.ts`、`PizzaStage.cheeseCanvas.test.tsx`（配置前・焼成後・CUT・RESULT・M1 退避）、`e2e/canvas-mozzarella-optin-486.spec.ts`（既定 ON／`=0`／空読み戻し）、`e2e/finished-pizza-visual-2.0.spec.ts`（M1 の CSS filter を直接読む Scenario A・B のみ、保存値 `"0"` で M1 を明示） |

変更していないもの: `PizzaStage.tsx`（#494 と同ファイル）、`CheesePoolCanvas.tsx`、`App.css`、scoring / recipes / save / economy / progression / CUT geometry、Reference・図鑑・サムネイル（M1 のまま。Owner 決定）。

## M1 に戻す 3 層
1. **端末・ページ単位**: `?cheeseCanvas=0`（`"0"` 保存。`?cheeseCanvas=1` で再度 ON）。
2. **ピース単位（自動）**: 2D コンテキスト無し・bitmap 作成失敗・描画例外・描画後の全透明読み戻し（G1、bitmap 再生成 1 回の再試行後）は、そのピースを M1 に置換。`pageshow` / `visibilitychange` で再確認。透明なチーズは表示しない。
3. **全体ロールバック**: `CHEESE_CANVAS_DEFAULT_ON` を `false` にする 1 行 PR。明示的に `"1"` を保存した端末（T1 の opt-in テスター）のみ Canvas が残る。

## 既存エビデンスの再利用（再検証しないもの）
| 項目 | 出典 |
|---|---|
| 実機 iPhone Safari: 焼成後・カット後・画面復帰後の表示 PASS（Preview バッジ一致） | PR #487 HEAD `9b446be` の Owner HV |
| Canvas の見た目・Preview での iPhone Safari HV PASS | #485 |
| 性能・複数ピース・縁寄り・密集・c64/c96 比較 | #485 / S2-B2 |
| 透明化検出（読み戻し→bitmap 再生成→再描画→M1）、非対応・例外時の M1、焼成前の描画が旧描画とバイト単位で同一（ハッシュ固定） | PR #487 のテスト（描画コードは未変更） |
| 本番 bundle に Canvas 経路が含まれ、`cheesePx` は含まれない | `cheeseCanvasProduction.gate.test.ts`（未変更） |

描画コード（`CheesePoolCanvas.tsx` / `cheesePool.ts`）は変更していないため、上記は標準 ON 後も同じ経路の結果として再利用できる。変えたのは「どの条件で Canvas を選ぶか」だけ。

## 今回追加で必要な HV（実機 iPhone Safari・390×844、動画は Owner へ直接送付）
既存 HV はすべて `?cheeseCanvas=1`（または `?cheese=`）で Canvas を明示した状態だった。標準 ON で新たに増える経路だけを確認する。
1. **クエリ無し・保存値なし**（Safari のサイトデータ消去後、またはプライベートタブ）で開き、配置 → 焼成 → CUT → RESULT で Canvas のチーズが透明・欠落・点滅しない。
2. 別アプリへ切り替えて戻した後もチーズが消えない（標準 ON の全ユーザーに効く経路）。
3. `?cheeseCanvas=0` で M1 になり、**クエリ無しで開き直しても M1 のまま**（保存値 `"0"` の新しい挙動）。`?cheeseCanvas=1` で Canvas に戻る。
4. ホーム画面に追加した状態（PWA）での起動。
5. 360×800 は実機が無ければ CI（WebKit 360×800）とエミュレーションで代替する。

HV の公開先は、共有 Preview #471（`9a154f6`）を変更しない前提では Owner 判断が必要（Preview の公開先は 1 枠）。この PR では Preview の deploy も共有 Preview の変更も行っていない。

## 未検証・残リスク
- **iOS の canvas 破棄は実機で再現できていない**。検出と M1 退避はテスト（読み戻しを空にした模擬）で固定済みだが、実機での確認と、描画ごとの読み戻し（64×64）の実機コスト計測は未実施。標準 ON で全ユーザーに及ぶ点が T1（opt-in）との違い。
- 前景のまま canvas が破棄された場合（`pageshow` / `visibilitychange` を伴わない）は、次の再描画まで検出されない。
- この PR を作成したセッションでは npm レジストリがポリシーで拒否され（403）、tsc / lint / Vitest / Playwright / build を **ローカルで実行できなかった**。検証は CI と Codex レビューに依拠する（結果は PR に記録）。Chromium iPhone プロジェクトは CI 対象外のため、390×844 / 360×800 の画像による目視確認は未実施で、CI の WebKit（両サイズ）の assertion のみ。
- Reference / 図鑑 / サムネイル / トレイは M1 のまま（初期段階の不整合は許容済み）。
- #468（溶融表現の別案、HOLD）および #494 と `PizzaStage.tsx` 周辺で競合しうる。この PR は `PizzaStage.tsx` を変更しないため、本 PR 側の競合要因は無い。
