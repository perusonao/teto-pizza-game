# T9 追補 — 代替操作がスコア記録・星・Lunch Rush・複数ソース・保存へ及ぼす影響（docs-only、Refs #784）

2026-11-07、main `06cfc066`、branch `claude/teto-pizza-parallel-tasks-ylyfe5`。**読み取りのみ。** `src/`・CSS・golden・既存 docs は未変更。測定コードの追加なし（Owner 決定 #784 コメント 6705771479 (2): 「星換算・Lunch Rush・複数ソースの docs-only 計画は GO、新しい測定コードはまだ」）。実装・PR・merge・Production ON・共有 Preview 更新なし。HV 対象外（docs-only）。
ラベル: 【実測】= 今回 main のコードで確認、【引用】= 既存 docs、【推論】、【未確認】。

## 0. 位置づけ（重複させない）

T9 本体は別セッション（claim: #784 コメント 6705411933、`TETO_COOK-OPS_T9_*`、`src/logic/{doughAlt,cutAlt,sauceAlt}/**`、branch `claude/teto-pizza-t7-t9-audit-12by6f`）が進行中で、設計（D-A′／C-A′）、S-A の M0/M1（合成測定）、折りたたみ UI のレビュー、CUT 寸法、HV チェックリストを出している。**その claim の名前空間は編集せず、別名で追補する。** 同セッションの `SA-Scoring-Reference-Measurement-Plan` §0 は「星への換算、Lunch Rush／Research への波及、保存形式（pendingRound）への影響は今回読んでいない（未確認）」と明記しており、本書はその **M4（影響調査）と、M2（既存記録の棚卸し）の最初の段**を埋める。

**重要な前提の限定**: 影響が出るのは主に **S-A（ソース）** で、D-A′（生地）と C-A′（CUT）は §6 で別に扱う。D-A′／C-A′ は純粋ロジックのみ（未配線）で、本書の「現行の経路」は今のところ変わらない。

## 1. 現行の経路（スコアと星がどこで決まるか）【実測】

```
ジェスチャ → SauceDispenseController が deposit[] を生成（0.02 / 50ms、1 種 1.0 上限・全体 2.0）
  → COMMIT_SAUCE_DISPENSE(ingredientId, deposits)   ※ reducer は出所（ジェスチャかスタンプか）を区別しない
  → computeSauceMetrics(deposits) → scoreSauceComponentV2（量30/被覆30/均一20/ふち20）
  → combineWeightedComponents: STANDARD は ソース52 / 具材16 / レシピ12 / 焼き20（NO_SAUCE は ソース0、具材=68）
  → × quantityFactor（#215、理想量で 1）→ totalScore（丸めない 0〜100）
  → starsFromTotal: 90→★5, 75→★4, 60→★3, 40→★2, 他→★1
  → capStarsForBake: ★5 だが焼きが perfect でなければ ★4
  → Dex: bestScore / bestStars（単調。★が上がるか、同じ★で total が上がる場合のみ更新）
  → Pitz: recipeBaseReward × qualityMultiplier（FREE のみ、exactly-once）
  → Lunch Rush: 1 枚ごとの qualityTotal（0〜100）→ missionScore = round(served×100 + Σ qualityTotal)
```

出所: `scoringV2/index.ts:59-100,425-440`、`scoring.ts:28-52`、`dex.ts:52-62`、`state/gameReducer.ts:1041-1073`、`missionScoring.ts`、`shared/lunchRushScoring.ts`。

## 2. 星への換算

ソース成分の重みは **52/100** で最大【実測】。したがって S-A がソース成分を Δ 点動かすと、total は **約 0.52 × Δ × quantityFactor** 動く（他成分が同じとして【推論】）。星の境界は 90／75／60／40 で、段の幅は 15〜20 点。

T9 の M1（合成、2,016 通り）の数値【引用: `TETO_COOK-OPS_T9_SA-M1-Grid-Result_2026-11-07.md`、人の分布ではない】と合わせた換算例:

| 比較 | ソース成分差 Δ | total 差（×0.52） | 星への影響の見立て【推論】 |
|---|---|---|---|
| S-A 高得点候補（約 98）vs 自然ジェスチャ中央値（63.1） | 約 35 | **約 18** | ほぼ **1 段以上**（★3 相当 → ★4〜5 側へ） |
| 同 vs 自然 p25（49.0） | 約 49 | **約 25** | **1〜2 段** |
| 同 vs 自然 p75（74.7） | 約 23 | **約 12** | 0〜1 段 |
| S-A 弱い候補（N=5、約 67〜80）vs 自然中央値 | 約 +4〜+17 | +2〜+9 | 0〜1 段 |

- **結論（設計上の含意）**: S6（許容する有利さ）は「点数の上限」の議論に見えて、実際は **星 1〜2 段の差**を意味しうる。支援が強すぎると、代替操作を選ぶだけで BEST の★が上がり、Dex の「BEST は下がらない」規則（`dex.ts`）で**固定される**。取り消しが効かない点が重い【推論】。
- ★5 の上限は焼き（perfect）で別途かかるため、ソース単独で★5 にはならない【実測】。
- 実際の星差は、他成分（具材／レシピ／焼き）と `quantityFactor` に依存する。**ここの換算は、他成分が同じ場合の線形近似**で、実測の total ではない【未確認】。

## 3. 既存スコア記録（M2 の棚卸し — 人の分布に使えるもの／使えないもの）

Owner 決定 (1): 「S-A M2 は、まず比較可能な既存のジェスチャ／スコア記録を棚卸しし、不足する場合に限り iPhone 観察を使う」。

| 区分 | 記録 | 人の分布に使えるか | 理由 |
|---|---|---|---|
| 保存済み | Dex `bestScore`／`bestStars`（レシピ別 BEST）、Mission BEST | **不可（この repo 内には人の実データなし）** | 端末の localStorage にのみ存在し、repo にもサーバーにも集約されない。BEST は最大値のみで分布にならない |
| サーバー | Lunch Rush ランキング（Firebase Functions） | **不可** | 提出されるのは 1 枚ごとの `qualityTotal`（0〜100）と recipeId で、**ソース成分やジェスチャ軌跡は含まれない**【実測: `LunchRushServeRecord`】。サーバーは式を再計算するだけで、各 `qualityTotal` の出所は検証しない（検証できない） |
| E2E | `e2e/sauce-*.spec.ts`、`new-sauces-*.spec.ts`、`gestures.ts` | **不可** | 機械が決めた軌跡で、人の腕前ではない。スコア閾値のアサーションはあるが分布ではない |
| 単体テスト | `scoringV2.test.ts`、`sauceMetrics.slice1Pin.test.ts`、`sauceEvaluation.test.ts`、`pointerSamplingFidelity.test.ts`、`referencePizza.test.ts` | **一部（上限・下限の固定値）** | 理想フィクスチャ（99.1）などの**固定点**は得られるが、人の分布ではない |
| Result Report | `PIZZA_GAME_Phase3A_Sauce-Painting_Result.md`、`Phase4A-1A/1B2`、`TETO_HUMAN-FEEL_TUNING-1A_Sauce-Copy_Result.md`、`TETO_ISSUE-32_SAUCE-PARITY_Result.md` 等 | **【未確認】** | 本書では本文を読んでいない。人の HV 所見（「塗りやすい／足りない」等）の定性記述はあり得るが、**点数の列**があるかは未確認 |
| HV 記録 | Owner の iPhone HV 動画（repo 外） | **不可（repo 内になし）** | 動画は commit しない方針。スコアが映っていても数値化されていない |

**結論**: repo とサーバーの既存記録だけでは、**人のソース成分の分布は得られない**。M2 は Owner の iPhone 観察（数本）が必要になる見込み【推論】。最小の依頼案は §7 の判断 1。測定コードを足さずに済む方法として、既存の `SauceMetricsPanel`（`SauceMetricsPanel.test.tsx` がある）や RESULT 画面の ソース評価（広さ／均一さ／ふち、`sauceEvaluation.ts`）が表示する値を Owner が読み取る形が使えるかは **【未確認】**（Preview/DEV 限定の表示かどうかを要確認）。

## 4. Lunch Rush への影響

| 論点 | 事実／見立て |
|---|---|
| 代替操作が Lunch Rush に出るか | Lunch Rush も同じ `PizzaStage`／DOUGH→SAUCE→CHEESE→TOPPING の 4 工程（`cookingProfiles.ts` の既定プロファイル）を使うため、工程画面を共有する限り **出る可能性が高い**【推論】。Lunch Rush 固有の除外（取り消しなど）は `roundKind.ts`／`undoPlacement.ts` の前例があり、「Lunch Rush では出さない」は実装上可能 |
| スコアの公平性 | missionScore = `served×100 + Σ qualityTotal`。1 枚の qualityTotal は §2 のとおり **代替操作で 12〜25 点動きうる**。サーバーは出所を検証できない【実測】ため、**ランキングの「操作条件の同一性」はクライアントのルールだけが担保** |
| 互換性 | `lunch-rush-v1` の式と提出形式は不変（OD-B2 = A、#224）。代替操作の追加で式を変える必要はない。ただし **スコアの分布が変わる**ため、過去の BEST／ランキングとの比較可能性が下がる |
| 時間 | Lunch Rush は時計（`MissionClock`）がある。D-A′ の「向きを循環するタップ」は時間を食う可能性があり、**代替が遅い＝有利ではない**設計になりやすい。ソース S-A は 1 タップ数回で終わるため**時間面でも有利**になりうる【推論】 |
| 選択肢 | (a) Lunch Rush では代替操作を出さない（公平性を維持。アクセシビリティの観点では、代替が必要な人が Lunch Rush を遊べなくなる）／(b) 出すが **スコア上限を自然な操作の p75 付近に制限**（S6 の選択）／(c) 出して無制限（非推奨）／(d) 出すが **ランキング提出の対象外にする**（ランキング側の変更が要る＝別承認） |

**推奨（助言）**: アクセシビリティ（C12 を含む T6 の共通契約）を損なわない (b) か (d) を、S6 の結論と**セットで** Owner が決める。(a) は最小変更だが、代替が必要な人を Lunch Rush から締め出す。**S6 が決まるまで Lunch Rush への配線は決めない**（Owner 決定 (2) と整合）。

## 5. 複数ソースへの影響

| 論点 | 事実 |
|---|---|
| データ形 | 1 種のみ: deposit に `ingredientId` なし。2 種目をコミットした瞬間、**全 deposit に ingredientId が付く**（先のものは遡って付与）。`sauceIds` は初回使用順【実測: `sauceLedger.ts`】 |
| 上限 | 1 種 1.0（`SAUCE_MAX_QUANTITY`）、全体 2.0（暫定）。reducer も `exceedsSauceCaps` で拒否（2 種以上のとき）【実測】 |
| 採点 | 第 1 ソース＝Reference ソース（量・被覆で採点）、第 2 は「使った／使わない」で判定（Owner 方針 #521 S2）。`sauceOwnDeposits(pizza, referenceSauce.ingredientId)` で**自分の deposit のみ**を指標化【実測】 |
| S-A との整合 | S-A が出す deposit 配列は **ingredientId を正しく付ける必要**がある（複数ソース時）。`isValidSauceDepositBatch` は ingredientId を検証せず、reducer の `planSauceCommit` が付与する経路のため、**スタンプも同じ COMMIT 経路に乗せれば付与は自動**【推論】。逆に別経路で deposit を作ると台帳が壊れる |
| 量の上限 | S-A は 1 種ごとに 1.0 を超えない必要（`tickDepositAmount` と同じ打ち切り）。第 2 ソース（オイル等）は「使った」だけでよいので、**スタンプ 1 回で足りる**一方、第 1 ソースと**重なり**（`sauceOverlap.test.ts`、#519 オイル over）の扱いが変わりうる |
| 描画 | 層の順序（B2）は first-use 順。スタンプ deposit も同じ描画に乗る見込みだが、**クラスター deposit が多い（49〜63）と層ごとの描画コストが増える**【未測定】 |
| 既存テスト | `multiSauce.guards.test.ts`、`sauceKinds.gateAndScoring.test.ts`、`sauceMerge.test.ts`、`sauceOverlap.test.ts`、`e2e/sauce-layers-b2.spec.ts` が現行の保証。S-A を足しても**これらが変わらないこと**が回帰条件（T9 計画 §4.3） |

**S-A の計画段階で決めること**: 「第 2 ソースにも同じスタンプを出すか」「第 1 ソースのみスタンプ、第 2 は 1 タップ『使う』にするか」。後者は「第 2 は使用有無で判定」という採点方針と自然に整合する【推論】。

## 6. 保存・復元（pendingRound）と、D-A′／C-A′ の影響

| 項目 | 事実／見立て |
|---|---|
| pendingRound | `sauceDeposits` を保存し、復元時に検証・サニタイズ（`pendingRound.ts:197-246`）。**サイズ上限 64 KiB**（暫定、最悪値の実測 約 39 KB）【実測】。スタンプのクラスター（49〜63 deposit/枚相当）は理想フィクスチャ（46）より増えるため、**複数ソース＋クラスターで上限に近づく可能性**【推論・未測定】。T9 M1 は pending-round の長さを測っている【引用】が、64 KiB との比較は **要確認** |
| D-A′（生地） | `COMMIT_DOUGH_STRETCH` が `doughShape` を原子的に置換する既存の経路に、**同形の shape を渡す**なら reducer／保存への影響なし。D-A′ は Δ=8 の向き循環で、完成後の入力は no-op（Owner 決定）。**採点は生地の寸法ゲートのみで、ソース成分より影響が小さい**（生地に重み付き成分はない）【推論: 要確認】。星換算は S-A ほど大きくない見込み |
| C-A′（CUT） | アーム前タップ no-op（#418）、アーム維持、明示の「切る」確定。CUT は採点成分でなく、Completion Gate／工程スキップに関わる（#482）。**星への直接影響は小さい**が、失敗扱い（スキップ）との境界は要確認【未確認】 |
| どちらも | 「出所の区別なしに同形の入力を reducer に渡す」設計である限り、**Dex／BEST／Pitz／Research の経路は変えない**。ただし S-A と同様、**得点しやすさの差**は星・Pitz・Lunch Rush に波及する |

## 7. Owner 判断（まとめて 1 回、推奨つき）

| # | 判断 | 推奨 |
|---|---|---|
| 1 | M2 の人のデータを、Owner の iPhone で「ソースを 5〜10 回塗る」観察から取ってよいか（数値は RESULT のソース評価を読む。**新規測定コードなし**で足りるかは §3 末尾の確認が前提） | 先に「既存 UI でソース成分の値を読めるか」を確認（docs／読み取りのみ）。読めなければ最小の使い捨て手順を提案 |
| 2 | S6（許容する有利さ）を **「星の段数」で定義**してよいか（例: 「自然操作の p75 付近を超えない」＝代替でも★は最大 +1 段まで） | はい。§2 のとおり点数より星で語るほうが Owner が判断しやすい |
| 3 | Lunch Rush での代替操作の扱い（§4 の a〜d） | S6 の結論とセットで決定。それまで配線しない |
| 4 | 複数ソース: 第 2 ソースは「1 タップで使う」にするか、同じスタンプにするか | 1 タップ（採点方針と整合） |
| 5 | pendingRound 64 KiB との比較測定を、新規テスト専用ファイルでやってよいか（`sauceAlt` の既存測定の拡張。別 claim が要る） | 条件付きで GO。複数ソース＋クラスターで 64 KiB に近づくかを 1 回だけ測る |
| 6 | D-A′／C-A′ の星・Lunch Rush 影響を、ソースほど重くないと見なして S-A より先に進めてよいか | はい（ただし「生地は採点成分なし」の確認を先に） |

## 8. 未確認・限界

- 星換算は**線形近似**。実際の total は他成分と `quantityFactor` に依存し、実測していない。
- Result Report 群の本文（点数の列の有無）は読んでいない。Preview/DEV でソース成分を読める UI の有無も未確認。
- 描画コスト、64 KiB との比較、第 2 ソースのスタンプ設計は未測定・未設計。
- すべて合成データと読み取りに基づく。**人の分布・実機の挙動は未取得（iPhone HV 0 PASS）。**
- 他セッションの claim（T9 本体、T6 #773、#764）は変更していない。本書の追補は別名で、claim の範囲外。
