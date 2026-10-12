# Issue #482 — 生焼け・焦げは必ず調理失敗（OD-CUT256-1 改訂 / bake margin 0 / FREE generic 窓）Result

Draft PR。merge・本番 deploy・Preview 切替は未実施で、Owner の別途明示承認が必要。Human Verification（390×844 動画 + Owner iPhone HV）は未実施。

## Owner Decisions（#482 に記録済み）
OD-B1 = Completion Gate の焼成マージン 0（判定源一本化）/ OD-B2 = Lunch Rush は `lunch-rush-v1` 据え置き（ランキングの既知の互換性問題は #224）/ OD-B3 = FREE ORIGINAL の失敗範囲変更を承認、Research Contract 2.1 の開示 byte 同一性を回帰テストで保証 / OD-B4 = 過去の BEST・Dex・ランキングは遡及変更しない / OD-B5 = 失敗文言は現状維持 / OD-B6 = F1（FREE は画面に表示する generic 窓 58–78 を失敗判定と結果バッジの共通基準とし、レシピ固有の窓は Scoring 2.0 の採点にのみ使う）。

## 変更（src）
- `src/logic/completionGate.ts`: `BAKE_ACCEPTABLE_MARGIN_RATIO` 0.5 → 0。Gate の bake 窓が `classifyBake`（ゲージ・バッジ）の窓と一致し、生焼け／焦げは常に FAILED（UNDERBAKED / OVERBAKED）、惜しい／ジャスト（窓内、両端含む）だけが CUT へ進む。
- `src/logic/discovery/freeCook.ts`: `withFreeCookBakeWindow(recipe)` を追加し、`resolveFreeCookPizza` の MATCHED 検証（`evaluatePizzaCompletion`）の bake 判定を generic 窓にした（構成・ソース量の判定は recipe のまま）。
- `src/state/gameReducer.ts` CONFIRM_BAKE（FREE MATCHED 経路のみ）: Completion Gate / `bakeState`（結果バッジ）/ `toLegacyScoreBreakdown` の★上限を generic 窓で判定。`computeScoringV2(recipe, pizza)` はレシピ固有の窓のまま。Guided / Lunch Rush / Dinner は従来どおりそれぞれの窓（margin 0 のみの変更）。
- 変更していない: Scoring 2.0 の式、Pitz、Dex、`LUNCH_RUSH_RULESET_VERSION`（`lunch-rush-v1`）、`src/shared/lunchRushScoring.ts`、Functions、セーブ形式、失敗文言、BAKE メーター / 結果バッジ表示（#481 / #483）。

## 挙動
| | 旧 | 新 |
|---|---|---|
| Guided / Lunch Rush（マルゲリータ 60–80） | 50–59.99 / 80.01–90 は生焼け・焦げのバッジでも PASS → CUT → ★・Pitz | 窓外は FAILED、CUT なしで失敗カード、星・Pitz・Dex なし |
| FREE MATCHED / ORIGINAL | generic 窓 ±10pt（48–88）まで PASS。MATCHED はレシピ窓（±10pt）で再判定 | generic 窓 58–78 の外は FAILED。窓内ならバッジは常に「いい焼き加減」（3 段階のまま）。レシピ窓は Bake 採点（距離減点）だけ |
| Dinner | 識別レシピの窓 ±10pt | 識別レシピの窓（margin 0）。INVALID_PIZZA と CUT 免除（`cutWaivedFor`）は同じ selector で追従 |

FREE の副作用（承認済み）: 窓が 50–70 のレシピ（11 レシピ）は generic 窓（58–78）と重なる 58–70 でないと FREE で発見できない。45–65 のレシピは 58–65、65–85 のレシピは 65–78。全 55 レシピとも generic 窓と重なる（`gameReducer.freeCookBakeWindow.test.ts` で全 `RECIPES` を確認）。

## Research Contract 2.1
窓の直外（旧 margin 帯 48–57.99 / 78.01–88）の ORIGINAL → FAILED で、○× rows / `discoveryHintFacts` / `researchExclusions` / Trial Notebook / `lastTrialAttempt` / 在庫 / セーブ JSON が窓内 ORIGINAL と byte 同一（`gameReducer.failedResearch.test.ts`）。唯一の差は、窓内 ORIGINAL が使用経路で払う Technique（報酬）を FAILED が払わないこと（開示ではない。専用テストで固定）。失敗理由の文はマージン帯と遠方で同一。

## テスト
- Vitest 全件: 387 ファイル / 7066 件通過（1 skip）。`tsc -b` / `vite build` 通過、`oxlint` は既存 warning のみ。
- 新規: `gameReducer.freeCookBakeWindow.test.ts`（全 `RECIPES` × 窓の内外・境界）、`completionGate.test.ts`（全レシピで Gate の bake 判定 = `classifyBake`）、`gameReducer.cutSkipFailedBake.test.ts`（窓外 FAILED・窓の両端と窓内は CUT・Guided はレシピ窓・FAILED は登録不可）、`gameReducer.failedResearch.test.ts`（byte 同一）。
- 契約反転・更新: `completionGate.test.ts` 11/13/15/boundary、`cutSkipFailedBake` C-2/C-3、`dinnerResultDetection.test.ts`・`gameReducer.dinner.test.ts`（★4 は旧「窓外のバッジ上限」から、Gate を通る薄いソースへ）、`gameReducer.discovery.test.ts` #12・`gameReducer.pitzReward.test.ts`（FREE は generic 窓内で焼く）。
- E2E（Chromium、iphone-390x844 / iphone-360x800）: `bakeToTarget` / `landNeedleAndTakeOut` / `cookDinnerPizza` を使う 39 ファイル（262 件）を実行、修正後に失敗 0。E2E の修正: Dinner ヘルパーの窓データ（marinara 45–65、hawaiian 60–80 は旧マージンに依存していた）、FREE を 50–70 の窓で焼いていた 4 件（generic 窓へ）、焦げのマルゲリータが CUT を期待していた Scenario C（FAILED カードへ）。新規 E2E: マルゲリータを旧 margin 帯（52–56）で取り出すと生焼け FAILED・CUT なし。WebKit プロジェクトはローカル未実行（CI 参照）。
- スクリーンショット: `docs/reports/screenshots/bake-failure-482/`（before / after、390×844・360×800、マルゲリータを 52–56 で取り出し）。

## 追加修正（Codex P2 と Guided cross-recipe、同一 PR、Owner Decision 案を #482 に記録済み）
- **FREE MATCHED の結果表示（Codex P2）**: `GameScreen.tsx` が、FREE のときだけ `PizzaStage` に `withFreeCookBakeWindow(state.recipe)` を渡す。結果バッジ・焼き色（`bakeHeat`）・結果のパーフェクトグローがすべて generic 窓（58–78）で揃う。照合したレシピの固有窓は Scoring 2.0 だけ。BAKE 中と Guided / Lunch Rush / Dinner は不変。
- **Guided cross-recipe 発見**: `registerDiscoveryToDex` に `judgedBakeTarget` を追加し、`gameReducer` の REGISTER_TO_DEX が `state.recipe.bakeTarget`（プレイヤーが見た選択レシピ A の窓。FREE は generic 窓）を渡す。別レシピ R の発見は A の窓で成否を決め、R の固有窓は Scoring 2.0 の Bake 成分だけ。引数なしの既定は従来どおり R の窓。
- **到達可能性の訂正**: 先に報告した「2970 組中 236 組が阻害」は、A 自身の Gate を通らない組（A の必須食材が R の組成に無い）を含む過大な数字だった。REGISTER_TO_DEX まで届く組成は 12 組（例: funghi → veggie-supreme-pizza、margherita → parmigiana-pizza）で、A の窓中心を狙えば全て発見できる。阻害されるのは A の窓内で R の窓外の bake（最大 8pt、funghi → veggie-supreme-pizza の 71–78 など）。
- **現行の通常プレイでは到達しない（調査時点）**: 上記 12 組すべてで、R の組成に使う素材の 1 つが R 自身を発見しないと入手できない（discovery ladder の key recipe で解放される。例: パルミジャーノは parmigiana-pizza、ピーマンは veggie-supreme-pizza）。素材の所持を保存データに書いても解放条件で無効になることを実測した。したがって本修正は、現行の条件では本番での効果が確認できず、将来、素材の解放条件やレシピ構成が変更された場合に効果が生じ得る。現行の通常プレイ条件では画面で再現できなかったため、自動テスト（`gameReducer.discovery.test.ts`）で検証している。
- **テスト**: `GameScreen.bakeBadge.test.tsx`（FREE MATCHED でバッジ・焼き色・グローが generic 窓に一致、Guided は不変、修正を外すと失敗することを確認済み）、`gameReducer.discovery.test.ts`（A=マルゲリータ・R=marinara・bake 70 の発見、A の窓外では発見しない、R の Scoring 2.0 は固有窓、reducer 経由の funghi → veggie-supreme-pizza、全到達ペア）。Vitest 全件 387 ファイル / 7077 件通過。E2E（iphone-390x844 / 360x800）は関連 12 ファイル 108 件通過。

## Lunch Rush（OD-B2 = A）
`lunch-rush-v1` 据え置き。Functions deploy 不要（サーバーは `completionStatus` を信用して式だけ再計算）。同じプレイなら新スコア ≤ 旧スコア。旧ルールの窓外 PASS が旧記録に残る互換性問題は #224 の scope（Issue #482 の調査コメント参照）。

## 未実施・要確認
- Human Verification 動画（390×844）と Owner iPhone HV、WebKit E2E（CI）。
- 実プレイヤーの押下ばらつきの実測（Lunch Rush の影響は仮定による感度分析のみ）。
- Guided の cross-recipe discovery（`registerDiscoveryToDex`）は、別レシピの組成を、そのレシピ自身の窓で判定する（margin 0 で厳しくなる）。今回は変更していない。
