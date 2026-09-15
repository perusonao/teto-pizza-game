# PIZZA GAME Phase 4A-1B — Cheese & Topping Physical Interaction Design

- Status: pre-implementation design
- Repository: `perusonao/teto-pizza-game`
- Fresh audit time: 2026-09-15 14:49 JST / 05:49 UTC
- Audited main: `45362e210a3e99ecc949706e9d007bf42e558881`
- Required implementation baseline: PR #21 HEAD `e0e4f1663304e6f7f34c0f0d48381a9e28e6d261`, rebased/merged with the then-current main before coding
- Prototype scope: FREE Margherita only
- Authority boundary: legacy Quality remains authoritative; this design adds shadow Reference placement only

## 1. Product decision

Phase 4の中心は次の体験とする。

> 注文されたピザの見本を見て、自分の手でできるだけ美しく再現する。見本に近いほど高得点。

PR #21の物理iPhone Human Feel結果はPASSである。長押し＋dragのソース操作は「自分で作っている」感覚を作れているため、gesture/timestamp方式は再設計しない。Phase 4A-1Bは、その成功をMozzarellaとBasilへ同じ操作として複製するのではなく、素材の重さが異なる2種類のplacementで広げる。

- Sauce: PR #21の`SPREAD`をそのまま再利用する。
- Mozzarella: 1個の塊を持ち上げ、運び、落とす。
- Basil: 1枚の葉を持ち上げ、運び、軽く回転しながら落とす。
- Bake: 現行を変更しない。
- authoritative score / Dex / Mission / Pitz / Shop / progression / save schema: 変更しない。

## 2. Scope

### In scope

- FREE MargheritaのMozzarella 3個、Basil 2枚
- ingredient trayからpizzaへのpointer drag/drop
- 既存のselect → pizza tapをfallbackとして維持
- pickup、drag preview、drop、素材別landing animation
- pointer lifecycle、cancel、outside drop、multi-touch、backgrounding safety
- normalized dough coordinatesでのReference positions
- permutation-invariant minimum-distance matching
- count qualityとplacement qualityの独立したshadow metrics
- deterministic visual rotation、reduced motion
- unit / component / regression testsと物理iPhone Human Feel Gate

### Out of scope

- 他recipeまたはMissionへの展開
- 181 ingredientsのruntime登録
- HOLD_SCATTER / SPRINKLE / DRIZZLE / SPECIALの実装
- authoritative Scoring 2.0、Dex BEST migration、save schema変更
- undo、piece reposition、piece removalの新UI
- sauce gesture/timestamp/field modelの再設計
- PR #21の「太い赤線」visual polish（別候補として記録のみ）

## 3. Existing architecture to reuse

PR #21 HEADには再利用可能な境界が既にある。

| Existing element | Reuse decision |
|---|---|
| `PizzaState.toppings: PlacedTopping[]` | canonical piece stateとしてそのまま使う |
| `PlacedTopping { id, ingredientId, x, y }` | `PlacedPiece`を新設しない |
| `PLACE_TOPPING` | valid dropとtap fallbackの共通commit actionとして使う |
| `findOpenSpot` / `MIN_TOPPING_DISTANCE=9` | overlap防止と最終描画座標の決定に使う |
| `clientPointToDoughPercent` / `isInsideDough` / `clampToDough` | drop coordinate変換とedge graceに使う |
| `PizzaStage` rendering | canonical x/yを唯一のlanding位置として使う |
| `IngredientTray` button | pickup sourceかつtap fallback selectorとして使う |
| `referencePizza.ts` | `ReferencePizza`をMozzarella/Basil groupへ後方互換拡張する |
| `referenceScoring.ts` | sauce shadow scoreを壊さずpiece shadow metricsを追加する |
| reducer phase/ownership guards | `PLACE_TOPPING`にもPREPARE scope guardを追加する |
| current CSS landing animation | generic fallbackとして維持し、ingredient-specific modifierを追加する |

`scorePizza()`は全toppingsのgeneric containment/distributionを20点として扱う。このlegacy behaviorは変更せず、Reference matchingは別pure functionからのみ計算する。

## 4. Interaction-family decision

181-ingredient auditのfamilyは次の7種である。

```ts
type InteractionFamily =
  | "SPREAD"
  | "HOLD_SCATTER"
  | "TAP_PLACE"
  | "SPRINKLE"
  | "DRIZZLE"
  | "SPECIAL"
  | "NON_INTERACTIVE";
```

今回、`DRAG_PLACE`を第8 familyとして追加しない。familyは素材をどう投入・採点するかのsemanticであり、touch inputの細部ではない。Mozzarellaの塊とwhole-leaf Basilは、どちらも「1 pieceを意図して置く」`TAP_PLACE` familyに属する。physical dragは同familyの入力variantとする。

```ts
type PlacementInput = "DRAG_FROM_TRAY" | "TAP_ON_PIZZA";

interface PieceInteractionSpec {
  family: "TAP_PLACE";
  primaryInput: "DRAG_FROM_TRAY";
  fallbackInput: "TAP_ON_PIZZA";
  landingStyle: "HEAVY_SQUASH" | "LIGHT_LEAF";
}
```

Catalog上のMozzarella=`HOLD_SCATTER`は汎用proposalであり、形状根拠はsourceにない。Margherita prototypeではrecipe/reference profileがchunk formを`TAP_PLACE`へoverrideする。Basilもwhole leaf表現のため`TAP_PLACE`へoverrideする。ingredient masterを全recipe一律に書き換えない。

## 5. Recommended Mozzarella UX

### Primary path

```text
Mozzarella chip pointerdown
→ candidate pickup
→ 6 CSS px以上の上向き/縦方向移動でdrag開始
→ fingerの少し上にcheese preview + shadow
→ pizza上でpreviewをvalid表示
→ pointerup
→ final client pointをdough coordinateへ変換
→ PLACE_TOPPINGを1回dispatch
→ canonical final positionへ220ms squash/bounce
```

重さは入力回数ではなくvisual feedbackで表す。drag中にquantityを増やさず、1 successful drop = 1 pieceとする。

### Fallback path

- short tap on chip: 現行どおりingredientを選択する。
- subsequent tap on pizza: 現行`PLACE_TOPPING`を使う。
- drag開始済みpointerupから`click`が合成されても、同じpieceを二重配置しない。session tokenまたは`didDrag`でsuppressする。
- keyboard: chipはbuttonのまま`aria-pressed`を持つ。doughをfocusableにし、Enter/Spaceで選択中pieceを中央付近のopen spotへ1個置ける最低限のfallbackを用意する。

3個というtargetは現行recipeの`minCount: 3`と一致し、5個へ増やす案よりdrag負担が小さい。最初のprototypeで「運ぶことが作業」になるリスクを抑える。

## 6. Recommended Basil UX

Basilもtrayからdragするが、Mozzarellaと同じ手触りにしない。

```text
Basil chip pointerdown
→ 軽いleaf preview（shadow弱め、finger offsetやや大きめ）
→ drag/drop
→ canonical coordinateを即commit
→ 280ms、上方からふわっと下降 + 小さな回転 + soft settle
```

- scoringはcanonical x/yだけを見る。
- visual rotationは`ingredientId + rounded canonical x/y`のstable hashから`-14deg..14deg`を導出する。
- `Math.random()`、animation中のDOM position、CSS transform値をscoreへ渡さない。
- 同じcanonical inputは同じrotationになる。duplicate coordinatesは同じrotationでもよい。
- landing中も次のinputを受け付ける。animation要素は`pointer-events: none`。

targetは2枚とし、現行recipeの`minCount: 2`と一致させる。

## 7. Shared pointer lifecycle

一つのframework-independentな`PieceDragSession`または小さなhookに集約する。Sauce controllerを汎化して混ぜない。Sauceはtime-based deposition、piece dragはsingle commitで責務が違う。

### Start

1. PREPARE、FREE、Margherita、eligible ingredientのときだけ候補を開始する。
2. `event.isPrimary`かつactive pointerなしを要求する。first pointer wins。
3. pointerId、ingredientId、source element、start client point、session tokenをsnapshotする。
4. source chipでpointer captureを試みる。
5. eligible chipだけ`touch-action: pan-x`を使い、横tray scrollを残す。縦/upward intentがthresholdを越えたときdragを開始する。

### Move

- previewのscreen-space transformは`requestAnimationFrame`で最大1回/frame更新する。
- React stateはstart/endとvalidity変化だけに使い、全pointermoveでtree全体をrerenderしない。
- coalesced eventsはpreviewの最終点にのみ使える。quantity/scoringはevent数に依存しない。
- previewは`position: fixed; pointer-events: none`のoverlay/portalに置く。

### Drop

- pizzaの`getBoundingClientRect()`をdrop時にfresh取得する。pointerdown時の古いrectを長時間保持しない。
- `clientPointToDoughPercent`で0..100 dough-localへ変換する。
- center distance `<=48`はvalid。
- `48 < distance <=52`はfinger-size edge graceとして`clampToDough`しvalid。
- `>52`、zero-sized rect、non-finite coordinateはcancel。canonical stateを変更しない。
- valid dropは`PLACE_TOPPING`を exactly once dispatchする。最終canonical/render/scoring位置はreducerの`findOpenSpot`後の座標である。

### Abort

次のすべてはpreviewを破棄し、commitしない。

- `pointercancel`
- `lostpointercapture`
- `window.blur`
- `document.visibilitychange`でhidden
- unmount
- PREPARE終了、BAKE開始、RESET/order change
- Mission開始、Reference overlayがinteractionを無効化
- ingredient/category変更
- Escape（desktop）

cleanupはidempotentにし、late pointerupはsession token不一致でno-opにする。

## 8. Canonical and visual state boundary

### Canonical

- `PizzaState.toppings`の`ingredientId/x/y/id`
- reducerが決めたauto-nudge後のx/y
- `recipe`, `phase`, `ownedIngredientIds`

### Temporary visual only

- pointerId、capture、start/move client coordinates
- pickup threshold、dragging flag、preview position、drop-valid flag
- preview shadow/scale
- landing animation progress
- Basil rotation derived value
- RAF id、listeners、session token

temporary stateを`PizzaState`、Dex、persistenceへ保存しない。drop commitはpointerup時に1 action、animationはcommit後のCSS presentationである。

## 9. Animation architecture

| Concern | Choice |
|---|---|
| live drag preview | imperative transform batched by `requestAnimationFrame` |
| pickup/drop phase visibility | minimal React state |
| landing | CSS keyframes keyed by newly mounted `PlacedTopping.id` |
| scoring/canonical coordinate | reducer state only |
| reduced motion | `@media (prefers-reduced-motion: reduce)`でtransform animationを無効化/1ms化 |

Suggested timing:

- pickup: 70–90ms scale/shadow response
- Mozzarella landing: 220ms; translateY(-8px) → squash `(1.08, .86)` → small overshoot → 1
- Basil landing: 280ms; translateY(-16px) + derived rotation → soft settle
- visual response to move: next animation frame、通常16.7ms以内

React renderだけで全moveを処理すると390×844実機でinput lagを作りやすい。CSSだけではclient pointerに追従できない。よってpreview座標のみRAF、着地はCSSが適切である。

## 10. Reference data model

既存`ReferencePizza`を最小拡張する。`ReferenceLayout`、pieceごとの`ReferencePiece`、新`PlacedPiece`は不要である。Reference positionsはingredient groupで持つ。

```ts
interface DoughPoint {
  x: number;
  y: number;
}

interface ReferencePieceGroup {
  ingredientId: "mozzarella" | "basil";
  positions: readonly DoughPoint[];
  interaction: PieceInteractionSpec;
  matching: {
    fullCreditRadius: 8;
    zeroCreditRadius: 22;
  };
}

interface ReferencePizza {
  recipeId: "margherita";
  sauce: ReferenceSauce;
  pieceGroups: readonly ReferencePieceGroup[];
}
```

Prototype authoring:

| Ingredient | Count | normalized positions |
|---|---:|---|
| Mozzarella | 3 | `(35,35)`, `(65,36)`, `(50,66)` |
| Basil | 2 | `(31,62)`, `(69,62)` |

全positionは既存`MIN_TOPPING_DISTANCE=9`を互いに上回るため、見本どおりのdropがauto-nudgeされない。Reference previewとmatchingは同じdataを読む。

Reference値はgame-authored prototypeであり、PIZZA DB由来の個数・位置ではない。g/mlやsource factとして表示しない。

## 11. Permutation-invariant matching

同一ingredientについてplayer set `P`とreference set `R`を抽出し、IDと配列順を無視する。

1. rectangular Euclidean distance matrixを作る。
2. 小さい側の全pieceを、大きい側のsubsetへminimum-total-distanceで割り当てる。
3. Hungarian algorithm `O(n^3)`で求める。
4. matched distanceをtolerant similarityへ変換する。

```ts
similarity(d) = 1                                      d <= 8
              = 1 - smoothstep((d - 8) / (22 - 8))   8 < d < 22
              = 0                                      d >= 22
```

現在の3/2 piecesにはexhaustive permutationでも十分だが、pepperoni等への拡張時に組合せ爆発する。依存packageなしの小さなpure Hungarian implementationが適切である。matching結果のpair順はtie時に固定するが、scoreはpiece ID/入力順に不変とする。

radial position、angular distribution、centroid、pairwise spacingは4A-1Bでは加えない。小規模setではdistance matchingと同じ誤差を再加点しやすく、over-designと二重罰になる。将来のHOLD_SCATTER/SPRINKLE profileでdistribution metricとして追加する。

## 12. Forgiveness

300 CSS px doughでは1 dough-unit ≈ 3 pxである。満点半径8 units ≈ 24 pxは指先中心のばらつきを吸収し、0点半径22 units ≈ 66 pxは明確な別領域だけをmissにする。

| Per-piece distance | Feedback band |
|---:|---|
| `0..8` | Excellent / full credit |
| `>8..14` | Good |
| `>14..<22` | Acceptable |
| `>=22` | Miss |

scoreはbandで段階的に切らず、8..22の間をsmoothstepで連続変化させる。UI labelだけをband化する。数px、rounding、Basil visual rotationで点数は変わらない。

## 13. Quantity handling and double-penalty avoidance

QuantityとPlacementを別metricとして返す。

```ts
interface PieceReferenceMetrics {
  ingredientId: string;
  targetCount: number;
  playerCount: number;
  quantitySimilarity: number;
  placementSimilarity: number | null;
  matchedDistances: readonly number[];
}
```

Initial count score:

```ts
quantitySimilarity = clamp01(1 - abs(playerCount - targetCount) / (targetCount + 1));
```

- target 3: 2/4 pieces = 0.75、1/5 = 0.50。
- target 2: 1/3 pieces = 0.67、0/4 = 0.33（ただしplayer 0は0へ明示clamp）。
- placementはmatched pairsだけの平均で、unmatched pieceを再度0点として足さない。
- player count 0は`placementSimilarity: null`（評価不能）とし、0点を二重表示しない。
- extra pieceが良いmatching pairを提供する可能性はcount scoreでのみ抑える。

4A-1Bではshadow breakdownを表示するだけでweighted totalへ接続しない。Phase 4A-2で合成する際もcount差をplacement denominatorへ再度入れない。

## 14. Shadow scoring boundary

`scorePieceGroupsAgainstReference(pizza.toppings, reference.pieceGroups)`をpureに導出する。GameStateへ保存する必要はない。Reference panel/Prototype Metricsがrender時にmemoizeして読む。

変更禁止のauthoritative path:

```text
CONFIRM_BAKE
→ scorePizza(recipe, pizza)
→ state.score
→ REGISTER_TO_DEX / MISSION_NEXT_ORDER
→ Dex BEST / stars / totalStars
→ unlock / Shop / Pitz / save v1
```

new shadow path:

```text
PizzaState.toppings + ReferencePizza.pieceGroups
→ pure reference matching
→ Prototype Metrics only
→ persistenceなし / progression side effectなし
```

`ScoreBreakdown`、`state.score`、`dex.ts`、`missionScoring.ts`、`mastery.ts`、`economy.ts`、`progression.ts`、`persistence.ts`を変更しない。

## 15. State/data changes

### Required

- `ReferencePizza.pieceGroups`の追加
- `ReferencePieceGroup` / `PieceInteractionSpec`型
- pure `referenceMatching.ts`
- temporary `PieceDragSession`（component ref/hook内）
- `PLACE_TOPPING`に`phase === PREPARE` guard
- ingredient-specific CSS classes/derived rotation helper

### Not required

- `PlacedPiece`
- `ReferencePiece` ID
- `ReferenceLayout` top-level wrapper
- random rotation field
- drag preview field in`PizzaState`
- new persisted state / save migration
- recipe dataへのprototype-only positions混入

Referenceはrecipe requirementではなく評価profileなので、4A-1Bでは`referencePizza.ts`のprototype fixtureに置く。複数recipeへ展開する段階でregistry化する。現行`recipes.ts`へpositionを入れるとauthoritative recipe requirementとgame-authored visual targetが混ざるため避ける。

## 16. Test specification

### Pure coordinate / matching

- client rectのleft/top/width/heightから0..100変換
- exact center/corners、non-square/zero rect rejection
- distance 48 valid、48..52 grace clamp、>52 reject
- exact Reference placement = quantity 1 / placement 1
- player/reference order permutation、piece ID変更で同score
- extra/missing piecesでquantityだけ低下、matched placementは維持
- duplicate player/reference positions、tieでfinite/deterministic
- rim/boundary positions、NaN/Infinity rejection
- input arrayをmutateしない
- repeated evaluationがbit-for-bit deterministic

### Drag lifecycle

- chip short tap selects but does not place
- threshold未満moveはtap、threshold以上でdrag
- valid drop dispatches`PLACE_TOPPING` exactly once
- pizza外dropはno-op + preview cleanup
- near-rim grace clamps before dispatch
- pointercancel/lost capture/blur/hidden/unmount/Bake/ingredient switchはno commit
- capture failureのwindow pointerup fallback
- second pointer ignored; first pointer retains ownership
- synthetic click after drag does not double-place
- animation中に次のdropが可能
- drag preview does not enter canonical pizza state

### Animation / accessibility

- Basil rotation helperはsame inputでsame output、range内
- rotation/animation class変更前後でshadow score同一
- `prefers-reduced-motion`でlanding transformを抑制
- chip `aria-pressed`、live announcement、keyboard fallback
- preview `aria-hidden` / `pointer-events:none`

### Legacy regressions

- non-MargheritaとMissionは現行tap placementのまま
- PR #21 sauce quantity/coverage/evenness/overflow/timestamp tests全pass
- legacy `scorePizza`の35/15/20/30とstars不変
- Dex BEST / timesMade / totalStars不変
- Mission score/BEST/reward不変
- Pitz/Shop/ownership/progression不変
- persistence schema/version/serialized keys不変
- RESET/PLAY_AGAIN/order transitionでtemporary dragが残らない

## 17. Physical iPhone Human Feel Gate

390×844相当だけでなく物理iPhone Safari/PWAで確認する。

### Required scenarios

1. Mozzarellaを3個連続dragし、指についてくる感覚と重いlandingを確認。
2. Basilを2枚dragし、Mozzarellaより軽く感じるか確認。
3. chip tap → pizza tap fallbackで同じcanonical placementになる。
4. tray横scrollがdrag gestureに壊されない。
5. pizza中央、rim、rim直外、明確な外側へdrop。
6. drag中に2本目の指で別chip、Reference、BAKEを操作。
7. drag中にControl Center/app switch、戻る、画面回転、Safari tab切替。
8. rapid 5-dropでpreview lag、lost drop、double placementがない。
9. reduced motion ONで操作可能性が変わらない。
10. VoiceOver/keyboard相当fallbackのfocus/announcement smoke test。

### Acceptance questions

- Mozzarella 3 + Basil 2の5回dragは楽しいか、面倒か。
- previewは指に隠れず、16.7–33ms程度で追従するか。
- Mozzarella/Basilの重さの違いを説明なしで感じるか。
- outside cancelとedge graceが予測可能か。
- 見本へ近づけようとする行為が自然に発生するか。

VerdictはPASS / BORDERLINE / FAIL。BORDERLINEなら、primaryをdragのまま維持しつつtap fallbackの発見性、target count、preview offset、timingを先に調整する。gesture familyの再設計は最後の手段とする。

## 18. Future scalability

| Future material | Likely semantic family | 4A-1B asset reusable? |
|---|---|---|
| whole onion / mushroom / ham / olive / sausage / chicken / seafood pieces | TAP_PLACE | drag session、drop validation、matching、landing variants |
| pepperoni slices | TAP_PLACEまたはHOLD_SCATTER profile | small countsはmatching、large countsはdistributionへ切替 |
| shredded cheese | HOLD_SCATTER | pointer lifecycle/previewのみ、single-drop scoringは使わない |
| oregano/grated cheese | SPRINKLE | normalized coordinatesとlifecycle、density scoringは別実装 |
| oil | DRIZZLE | Sauce同様のpath/timestamp基盤を再利用、piece matchingは使わない |
| egg/large center item | SPECIAL | drop validation、single canonical commitを再利用 |

181件のcatalog family mappingは変更しない。recipe/form profileがingredient defaultをoverrideできる設計にする。`TAP_PLACE`の入力variantをdrag/tap両対応にしたことは、98件のfamily候補へ段階的に展開できるが、今回mappingやruntime contentは増やさない。

## 19. Implementation scope and sequence

Expected files after PR #21 and PR #25 integration state is settled:

### New

- `src/logic/referenceMatching.ts`
- `src/logic/referenceMatching.test.ts`
- `src/interaction/pieceDragSession.ts`または`usePieceDrag.ts`
- corresponding lifecycle/component tests

### Modify

- `src/data/referencePizza.ts` / test
- `src/logic/referenceScoring.ts` / test
- `src/components/IngredientTray.tsx`
- `src/components/PizzaStage.tsx`
- integration owner (`GameScreen.tsx` if PR #25 is present; otherwise `App.tsx`)
- `src/state/gameReducer.ts` / tests
- `src/App.css`

Sequence:

1. GitHub fresh stateとbaselineを再確認し、PR #21を含むbranchで作業する。
2. PR #25が先に入った場合は`GameScreen` boundaryへ統合する。
3. Reference group + matching pure logic + tests。
4. reducer PREPARE guard。
5. drag session + preview + cancel lifecycle。
6. material-specific landing + reduced motion。
7. shadow metrics UI。
8. full unit/lint/typecheck/build、390×844 browser smoke。
9. physical iPhone Human Feel Gate。

## 20. Risks and mitigations

| Risk | Level | Mitigation |
|---|---|---|
| PR #21/#25 both edit `App.tsx`/`App.css` | medium | implementation開始時の統合済みbaselineを固定し、drag logicを独立moduleへ隔離 |
| horizontal tray scrollとvertical pickup競合 | medium | `pan-x` + intent threshold + iPhone Gate |
| drag 5回が面倒 | medium | target=3/2、tap fallback常設、Human Feelで回数/offsetを調整 |
| auto-nudgeとplayer intent差 | low-medium | scoringはfinal rendered coordinate、Reference pointsは9 units以上離す |
| count/placement二重罰 | low | matched-only placement + separate quantity |
| random visualがscore/replayを揺らす | low | coordinate-derived deterministic rotation |
| animationでinput lag | low | previewだけRAF、landingはCSS、canonical即commit |
| legacy progression contamination | low | shadow-only pure path + explicit regression tests |

## 21. Design verdict

**B. READY WITH MINOR DESIGN CHANGES**

Human Feel PASSによりphysical makingの方向は確定した。実装前のminor changesは、`DRAG_PLACE`をcatalog familyに増やさず`TAP_PLACE`のinput variantとすること、target countを現行recipeと同じ3/2にすること、matchingをdistance-only shadow評価に限定すること、PR #21/#25の統合順を開始時に固定することである。追加のthrowaway prototypeは不要で、4A-1Bそのものをgated prototypeとして実装できる。
