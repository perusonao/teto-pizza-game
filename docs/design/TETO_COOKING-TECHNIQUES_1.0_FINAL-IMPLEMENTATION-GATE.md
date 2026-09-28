# TETO Cooking Techniques 1.0 — Owner Authority 記録 + Final Implementation Gate（LAD-1 / TQ-1A / TQ-1B）

> 基準: `03f81e2`（TQ-1 Owner Decision Gate）。Owner が 2026-09-27 に承認した。
> 本書は Owner Authority の正式記録と、3 レーン（LAD-1 / TQ-1A / TQ-1B）の Final Implementation Gate。
> **TQ-1C 以降・Aussie の production 追加・CSS / UI / E2E / HV は範囲外。**
> main 上の要約 authority は `docs/design/TETO_COOKING-TECHNIQUES_1.0_SSOT.md`。TQ-1C 以降の Owner Decision（OD-TQ1C-1/2/3）もそこに記録している。

## 1. Owner Authority（確定）

| ID | 決定 | 絶対条件 / 補足 |
|---|---|---|
| **OD-TQ-S1** | no-sauce scoring は **案 B**。sauce reference を持たない recipe では、sauce 52 点分を pieces に移した専用 weight profile を使う。**Wave 2 OD-W2-8 の回答も兼ねる** | 以下をすべて変えない: sauce ありの既存 25 recipe の score（1 点も）、★ threshold、Completion Gate threshold、Lunch Rush scoring formula、Dinner minimumStars authority、scoring version、Lunch Rush ruleset version |
| **OD-W2-1** | W1 ladder の step 1〜24 を固定する。新しい recipe / ingredient を足す時に全体を再生成しない。Wave 2 以降の unlock は後ろに append する | 既存 save の next unlock と W1 途中 save の意味を変えない。W1 完了 save は新しい step へ進める |
| **OD-TQ-P1** | near-miss に privacy fallback を入れる。軸を示しても答えを特定しない場合（候補 ≥2）だけ、軸別の guidance を許す。それ以外は「おしい！あと少し、なにかが違うみたい…？」 | Aussie の NO_SAUCE を「ソースを変えると…」から特定できないこと。未発見技法の名前や具体操作は表示しない |
| OD-TQ-1 | Technique はプレイで発見する | — |
| OD-TQ-2 | 技法の分類は監査案どおり | — |
| OD-TQ-4/5 | Pizza Dex 内に「調理法」欄を置き、未発見は「？？？」 | — |
| OD-TQ-6 | 未発見技法の答えを Hint で売らない | — |
| OD-TQ-7 | 技法の発見自体には ★ / Pitz を付けない | — |
| OD-TQ-12 | 推測だけの post-bake evidence は必須扱いにしない | — |
| OD-TQ-15 | 最初の技法は NO_SAUCE | — |
| OD-TQ-S2/S3 | scoring / Lunch Rush の version を上げない | — |
| OD-TQ-P2 | DH4 の購入済み情報を組み合わせた推測は許容 | — |
| OD-TQ-16 | SAUCE step の「なしでもOK」を維持 | — |
| OD-TQ-18 | Aussie を TQ-1 recipe として採用し、CUT なし（production への追加は TQ-1D） | — |
| OD-TQ-10改 | Technique Discovery は Free Cooking のみ。Dinner では行わない | **OD-TQ1C-3（2026-09-28）で詳細化:** 使用経路は Free Cooking のみ。レシピ経路（INV-TQ-1）は FREE の全 round（guided を含む）。Lunch Rush / Dinner は両経路とも 0（SSOT P8） |
| 同時発見 | 表示順は ① Technique → ② Recipe。save mutation は 1 回の atomic な登録処理 | 二重登録・二重報酬なし |

## 2. Fresh GitHub state

| 項目 | 値 |
|---|---|
| `origin/main` | `51e0923b`（PR #252 merge、DM-3R-2）。gate 以降の変化なし |
| open PR | #259, #255, #243, #221, #220, #219, #218, #217, #214, #211, #209, #208, #205, #105, #72, #46, #34, #3。LAD / TQ と重なるものはない。#205（Phase 3-4A、`progressionUnlocks` / `progressionEconomy` / `progressionStars`）も対象ファイルが別 |
| 重複 Issue | append-only ladder / technique / no-sauce scoring / mechanic_matrix drift の検索で 0 件 |
| ベースライン | `npx vitest run` = 192 files / 4078 passed / 1 skipped（main 相当の src） |

## 3. レーン別 Final Gate

### 3.1 LAD-1 — append-only discovery ladder

| 項目 | 内容 |
|---|---|
| Branch / PR | `claude/lad-1-append-only-ladder` → main。単独 PR、auto-merge OFF |
| Files | `src/logic/discoveryLadder.ts`（pure API 追加）、`src/data/discoveryLadder.ts`（`W1_FIXED_STEP_COUNT`、`POST_W1_APPENDED_STEPS = []`、`DISCOVERY_LADDER` を append で合成）、`src/logic/testSupport/discoveryLadderRule.ts`（`buildAppendOnlyLadder`）、tests、Result Report |
| Public API | `appendLadderSteps(base, steps, populationId)`、`validateAppendOnlyExtension(base, next)`、`validateLadderProgression(ladder, recipes, starters)`（UNREACHABLE / SOFTLOCK / STARTER_IN_LADDER / KEY_NOT_NEWLY_COMPLETED を返す） |
| 挙動 | `POST_W1_APPENDED_STEPS` は空なので、`DISCOVERY_LADDER` の内容は現行と deep-equal。**gameplay 変化なし** |
| Persistence | なし（`unlockedForShopIngredientIds` の ledger は既存のまま。未来の material id の保持は既存の forward-compat で行い、test で固定する） |
| Tests | W1 1〜24 の pin（literal を固定）。append 規則（新しい材料の無い recipe は step 無し、W1 materials を再 unlock しない）。softlock / duplicate / unreachable = 0。W1 途中 save の next unlock 不変。W1 完了 save が append step（synthetic）へ進めること。「再生成すると並び替わる」ことを negative control として固定（synthetic Aussie） |
| Mutation / adversarial | 固定区間の改変、append での material 重複、starter の混入、step 番号の欠番、unreachable recipe の混入 → validator が検出すること |
| CI | Vitest に数十件追加。build / lint は影響なし。WebKit は src 変更なので走る（挙動不変） |
| Revert | 単独 revert 可（内容は deep-equal なので） |
| 依存 | なし |

### 3.2 TQ-1A — Technique pure model / detection / persistence

| 項目 | 内容 |
|---|---|
| Branch / PR | `claude/tq-1a-technique-foundation` → main。単独 PR、auto-merge OFF |
| Files | 新規 `src/data/techniques.ts`（`TechniqueId = "no-sauce"`、registry）、新規 `src/logic/techniques/{detection,registration,nearMissPrivacy}.ts`、`src/state/persistence.ts`（`discoveredTechniqueIds`）、tests（architecture test を含む）、Result Report |
| Public API | `TECHNIQUES`、`KNOWN_TECHNIQUE_IDS`、`isTechniqueId`、`detectTechniquesUsed(signature)`、`requiredTechniquesOf(target)`、`registerTechniqueDiscovery(input)`（pure、冪等）、`backfillTechniqueLedger(ledger, discoveredTargets)`、`sauceAxisAnswerCount(...)` / `axisGuidanceAllowed(k)`（OD-TQ-P1 の pure 部分）。`PersistentSaveV2.discoveredTechniqueIds`、`ProgressionSnapshot.discoveredTechniqueIds?` |
| 挙動 | **production では未配線**（reducer / App / UI は変更しない）。save には、書かれた時だけ現れる新しい key が 1 つ増える（誰も書かないので、実際の save 内容は変わらない） |
| Persistence | schema bump なし。旧 save → `[]`。壊れた値 → 既知 id だけ残し、重複を除去し、上限 64。未知の well-formed id → forward-compat で保持（`writeSave` の merge）。Full Reset → key ごと消える。`persistProgress` → union（下がらない） |
| Tests | 検出、登録（recipe 経由は gate を無視、ORIGINAL は affordance 必須、PASS 必須、冪等）、backfill（INV-TQ-1）、INV-TQ-4（要求する recipe が 0 の技法は affordance が閉じる）、persistence の全ケース、**architecture test**（matcher / signature / freeCook / discoveryCatalog が technique module と ledger を参照しない）、**INV-TQ-NB**（synthetic no-sauce target が ledger `[]` / 全技法のどちらでも NEW_DISCOVERY、全 25 target の結果が ledger に依存しない）、privacy の k 計算 |
| Mutation / adversarial | hostile な save 値（`__proto__`、非配列、数値、長い id、200 件）、ledger を変えても matcher の結果が同じ、二重登録 |
| CI | Vitest 追加のみ |
| Revert | 単独 revert 可。すでに書かれた key は、revert 後の build でも forward-compat により保持される |
| 依存 | なし（TQ-1C が 1A と 1B と LAD-1 に依存） |

### 3.3 TQ-1B — No-sauce scoring foundation

| 項目 | 内容 |
|---|---|
| Branch / PR | `claude/tq-1b-no-sauce-scoring` → main。単独 PR、auto-merge OFF |
| Files | `src/logic/scoringV2/index.ts`、`src/logic/scoringV2/types.ts`、tests（parity snapshot を含む）、Result Report。**`ReferencePizza` の型、UI、Completion Gate の code は変更しない**（production 型の拡張は TQ-1D） |
| Public API | `computeScoringV2(recipe, pizza, options?)` に `options.reference`（`ScoringReferencePizza \| null`、未指定なら `getReferencePizza`）を追加。`ScoringReferencePizza`（`sauce: ReferenceSauce \| null`）、`SCORING_V2_WEIGHT_PROFILES`（STANDARD 52/16/12/20、NO_SAUCE 0/68/12/20）、`combineWeightedComponents(scores, profile)`、`ScoringV2Result.weightProfile` |
| 挙動 | 既存 25 recipe は STANDARD 経路で式・演算順とも同一 → **score は 1 点も変わらない**（実装前に main で取った snapshot と完全一致で固定）。NO_SAUCE は `reference.sauce === null` の時だけ。そのうえで recipe が sauce 材料を要求していたら fail closed |
| Persistence | なし |
| Tests | 25 recipe × 複数 pizza の parity snapshot、no-sauce ideal = 100 / ★5、careless pieces の劣化（0.68×）、quantity の劣化、bake cap（★5→★4）、Completion Gate（未知 id の no-sauce recipe は sauce 無しで PASS。閾値は不変）、★ threshold / Pitz band の pin、Dinner minimumStars（★1〜5 すべて到達可能）、Lunch Rush（`LUNCH_RUSH_RULESET_VERSION` と式を pin）、**11 点比較で ★ずれ 0**、version を pin |
| Mutation / adversarial | sauce が null なのに sauce 材料を要求 → unavailable。no-sauce recipe に sauce を塗っても得点は上がらない。profile の合計が 100 であること。weight の入れ替えを検出 |
| CI | Vitest 追加のみ |
| Revert | 単独 revert 可（production では no-sauce 経路に到達しない） |
| 依存 | なし |

## 4. 推奨 merge 順

3 レーンは**ファイルが重ならず**、どの順でも merge できる。推奨は次のとおり:

1. **LAD-1**（Wave 2 とも共有する基盤。gameplay 不変）
2. **TQ-1B**（score authority に関わるので、単独で review を集中させる）
3. **TQ-1A**（TQ-1C の直前に必要。単独では production 不活性）

TQ-1C は 3 つすべての merge が前提。

## 5. Follow-up Issue（修正しない）

`tools/progression2_mechanic_matrix.py --check` の clean-main drift → 別 Issue を作成（LAD / TQ には混ぜない）。

## 6. 新しい Owner Decision

なし。Final Gate の範囲で新しい判断は生じなかった。

1 点だけ実装上の注意を記す。OD-TQ-P1 の k 規則を**全 target に一律**適用すると、「ソースを塗らずに焼き、target がトマトで、所持ソースがトマトだけ」の場合に、既存の SAUCE_ONLY 文言も fallback に変わる（k=1）。これは Owner 文言の「候補が 2 未満なら fallback」にそのまま従った結果なので、新しい判断ではない。TQ-1A は pure 関数だけを持ち、適用範囲の wiring と copy は TQ-1C / 1D で扱う。

## 7. 実装状況（Final Gate 後）

実装時点の `origin/main` は `7bb0116`（PR #264 DH4-2A）。§2 以降に main が動いたが、DH4 の discovery hint 系だけで 3 レーンと重ならない。

| レーン | Issue | Branch | PR | 状態 |
|---|---|---|---|---|
| LAD-1 | #261 | `claude/lad-1-append-only-ladder` | #268 | technical gate 完了（CI 全 green）。Owner review 待ち、auto-merge OFF |
| TQ-1B | #263 | `claude/tq-1b-no-sauce-scoring` | #271 | technical gate 完了（CI 全 green）。Owner review 待ち、auto-merge OFF |
| TQ-1A | #262 | `claude/tq-1a-technique-foundation` | #273 | local の tests / typecheck / lint / build は完了。CI の結果は PR を参照。Owner review 待ち、auto-merge OFF |
| follow-up | #260 | — | — | mechanic_matrix drift。修正しない |

推奨 merge 順: **#268 → #271 → #273**。3 本はファイルが重ならない。TQ-1C は 3 本すべての merge 後に着手する（本 PR 系列では着手しない）。
