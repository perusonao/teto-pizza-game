# 下ごしらえ（炒める）技術調査 T0〜T7 — Result Report（調査のみ）

作成: 2026-10-27 / 基準 `main` = `47268e3`（#684）/ ブランチ `claude/teto-pizza-cooking-audit-frxevk`
親: `TETO_COOKING-PROCESS-EXPANSION_Phase1-PreImplementation-Verification.md` §4（T0〜T7）、`…_Fresh-Audit.md`
性質: **技術調査のみ。** 製品コード・Preview・PR・merge・claim 投稿・Monitor は行っていない。リポジトリの追跡ファイルは本書の追加のみ。
計測・スパイクはリポジトリ外（スクラッチ領域）で実施した。**Owner 承認（2026-10-28）によりスパイクとプローブは保持する**: `docs/reports/data/TETO_COOKING-PREP_T1-spike.patch`（reducer の差分 46 行）、`…_T1-spike.prepSpike.test.ts.txt`（スパイクのテスト）、`…_T3-probe.cjs.txt` / `…_T3-probe.json`（レイアウト計測）、`docs/reports/screenshots/cooking-prep-investigation/`（計測画像）。いずれも**製品コードではない**（`.txt` はテスト・ビルドの対象外）。HV 動画は audit-only のため対象外。
Owner 方針（7 点）: SCATTER 新方式は実装しない（#476 D3 維持）／仕上げがけは保留／下ごしらえ（炒め）を優先／試作対象は既存 beef／任意操作が第一候補／識別・採点・保存形式は変更しない／新タブなし。

---

## 0. 結論

| 項目 | 結果 |
|---|---|
| **Go / No-Go** | **条件付き Go。** 状態・入力・採点・識別・保存・レイアウトは**すべて技術的に成立**（T0・T1・T3・T5・T6・T7 PASS、T4 は条件付き PASS）。**ただし T2（描画）が beef では FAIL**: beef は現在 **牛の絵文字 🐄（白黒の乳牛）** で描かれており、焼き色・つやの変化が実測で**ほぼ見えない**。任意操作の「報酬」が成立するには **beef 専用の SVG（`beef-slices`）が前提**。 |
| 技術的な最大の阻害要因 | **B-1: beef の専用グリフが無い**（Style Lock v2 の参照アートにも `beef` は無い）。PR-2 設計も同じ SVG を計画しており、**共有の前提作業**になる。 |
| 任意操作の価値 | **SVG があれば中（「やった感」が盤面に残る）、無ければゼロ。** 採点・Pitz・★に影響しないため、価値は視覚と手応えだけに依存する（本ゲームには音も振動も無い。§6） |
| 実装承認 | **未取得。** Go の場合でも Owner の実装承認までコード変更しない。次に要る判断は §8 |

---

## 1. T0〜T7 の PASS / FAIL

| ID | 調査 | 結果 | 要点（根拠は各節） |
|---|---|---|---|
| **T0** | Duplicate / claim、Owner 回答 | **PASS** | D-9 = beef、D-10 = 任意、D-11 = SCATTER 保留維持は Owner 方針で確定。D-12（claim）は実装承認まで投稿しない。open PR に下ごしらえ・炒めを扱うものは無い。新規 #689 はテストのみ（§7） |
| **T1** | 「炒め済み」の置き場 | **PASS** | `GameState` 上の**省略可能な transient フィールド**で成立。スパイクで Guided・Free の全フィールドが**バイト同一**（§2）。全テスト結果は §2.5 |
| **T2** | 描画 | **FAIL（beef 現状）／PASS（SVG があれば）** | 分岐点は `toppingPieceStyle(ingredient)` 1 箇所で、**未炒めは現状と同一の描画**。ただし **🐄 にフィルターは効かない**（§3） |
| **T3** | 入力の成立性 | **PASS** | ステージ領域にオーバーレイを重ねても**レイアウト不変**（両 viewport 実測）。ステージ上下に空き帯 66〜80px（§4） |
| **T4** | テンポ | **条件付き PASS** | 設計予算で 1 回 +4〜6 秒。**実測値は無い**。HV で ≤ 8 秒・面倒でないことを判定（§5） |
| **T5** | 識別・Anti-Oracle | **PASS** | 識別・採点・ヒントは `pizza` / `recipe` だけを読み、`GameState` 全体を受け取らない（§2.3）。食材単位の affordance で標的は漏れない |
| **T6** | 採点・確定・保存の不変性 | **PASS** | `pendingRound` は pizza のフィールドを明示コピー（`...state` なし）。炒めは在庫を消費しない（§2.3） |
| **T7** | 証跡・PR-2・#679・#478 との整合 | **PASS（順序条件付き）** | 競合はグリフ関連ファイルのみ。PR-2 の beef 前提が**古い**（§7） |

---

## 2. T1 / T5 / T6 — 状態遷移・保存・識別・採点

### 2.1 現在の状態遷移（再確認）

```
ORDER ─BEGIN_PREPARE→ PREPARE[DOUGH→SAUCE→CHEESE→TOPPING] ─START_BAKE→ BAKE ─CONFIRM_BAKE→ POST_BAKE[FINISH?→CUT?] → RESULT
```

- 新ラウンドは `buildOrderState` の**単一リテラル**で作られ、`carry`（ProgressionCarry）だけを引き継ぐ。**新フィールドは省略可能にすれば、新ラウンドで自動的に「無し」になる**。
- `RESET_PIZZA`（PREPARE のみ有効）は自前のオブジェクトを返すため、**ここで 1 箇所だけ消す必要がある**。
- Dinner は `DINNER_COOKING_ACTIONS` の集合で入口を絞るが、**集合に無い新アクションは `baseGameReducer` に素通り**する。したがって新アクション自身の `roundKind` ガードで Lunch Rush・Dinner を拒否する（スパイクで確認）。

### 2.2 「炒め済み」の置き場の比較

| 案 | 内容 | 評価 |
|---|---|---|
| **A（推奨）** | `GameState.preparedIngredientIds?: readonly string[]`（省略可能・transient）＋専用アクション。`RESET_PIZZA` で除去 | 新ラウンド・`PLAY_AGAIN`・`RETRY_SAME_RECIPE` で自動的に消える。`pendingRound` / discovery / scoring に届かない。スパイクで実証 |
| B | ピースに `prep` フィールド | **不可。** `pendingRound.ts` の journal は piece の `id/ingredientId/x/y/stage` だけを許可リストで保存・検証し、他は `corrupt`。journal・sanitizer・R8 行列の改修が付く |
| C | `App.tsx` の UI state（`selectedIngredientId` と同型） | reducer・golden に一切触れない利点。ただしラウンド境界の追従（`pizzaResetToken` / 新ラウンド）を UI 側で再実装し、Lunch Rush / Dinner の除外もコンポーネントで持つことになる。**A が撤回しにくい（フラグ OFF で無害）ため A を推奨、C は代替** |

### 2.3 読み取り側の監査（T5 / T6）

| 対象 | 事実 | 判定 |
|---|---|---|
| 識別（matcher / signature / near-miss / 指紋 / Research / Dex） | `src/logic/discovery/**` は `GameState` を import しない。入力は `pizza` / `recipe` | 影響なし |
| 採点・Completion・確定（`finalizeRound`、scoringV2） | `recipe` / `pizza` / `bakeValue` を受け取る。`GameState` 全体は受け取らない | 影響なし |
| ヒント（`buildHintLine`） | `recipe` / `pizza` / `makingStep` を受け取る | 影響なし |
| 保存（`persistence.ts`）、`pendingRound` | `GameState` を直列化しない。journal は pizza のフィールドを明示コピー（`...state` なし）。復帰は精算専用で**描画しない** | 影響なし |
| DEV State Editor | 保存フィールド（`EDITABLE_STATE_KEYS`）だけを編集 | 影響なし |
| 在庫 | 下ごしらえは何も消費しない。消費は CONFIRM_BAKE の 1 回のまま | 影響なし |
| Anti-Oracle | 炒め可否は**食材の id だけ**で決まり、レシピ・ラウンド種別（Guided / Free / Research）で変わらない。Dinner（START_BAKE までレシピ未確定）と Lunch Rush は除外 | 標的は漏れない |

### 2.4 スパイクの結果（スクラッチコピー。差分とテストは docs/reports/data/ に保持）

`git archive HEAD` をスクラッチ領域に展開し、`GameState` に省略可能フィールド、`PREP_INGREDIENT` アクション（beef のみ・TOPPING のみ・Guided / Free のみ・冪等）、`RESET_PIZZA` での除去を**約 15 行**足した。

| 検証 | 結果 |
|---|---|
| Guided・Free の全フィールドが、炒めあり／なしで同一（`toStrictEqual`、ステップを START_BAKE → CONFIRM_BAKE まで） | PASS |
| TOPPING 以外・beef 以外・Lunch Rush・Dinner で状態が**同一参照のまま**（拒否） | PASS |
| `RESET_PIZZA` でプロパティ自体が消える。`PLAY_AGAIN` / `RETRY_SAME_RECIPE` で持ち越さない | PASS |
| 既存テスト全体への影響 | 既存テストの失敗 0 件（環境起因の 1 件を除く、§2.5） |

**副産物の知見:** reducer は**モジュールレベルの連番**（`topping-N` の id、`placement.token`）を使うため、同一プロセスで 2 回走らせた状態の比較は**これらを正規化する必要がある**。実装時の parity テストはこの正規化を入れる。

### 2.5 全テストスイート（スパイク適用後、スクラッチコピー）

`vitest run` 全体: **537 ファイル成功・1 ファイル失敗・1 スキップ／10019 テスト成功・1 失敗・13 スキップ・2 todo**（約 677 秒）。スパイク自身の 3 テストを含む。

- 失敗した 1 件は `src/preview/lcHandPreview.gate.test.ts`（「no committed .env file…」）。`git ls-files` を実行するテストで、**スクラッチコピーが git リポジトリでない**（`git archive` の展開物）ために `fatal: not a git repository` で落ちた。**スパイクの変更とは無関係な環境起因**。本物のリポジトリでの再実行は行っていない。**Owner 判断（2026-10-28）: 環境要因として記録し、正式実装時に通常のリポジトリで再確認する。**
- スパイクの変更で落ちた既存テストは **0 件**（`GameState` の deep-equal・Dinner のアクション分類・golden を含む）。

---

## 3. T2 — 描画（beef は現状 FAIL）

### 3.1 現状の描画経路

- ピースの焼き色は `PizzaStage.tsx` の **`toppingPieceStyle(ingredient)`（1 箇所）**で決まる。`bakeProgress === null`（PREPARE）では `undefined`（無加工）、焼成後は `toppingVisualFrame(heat, roastResistant)` の連続曲線。
- 炒め済みの見た目を足すなら、この関数に「炒め済みの食材か」を渡し、**PREPARE でも静的な見た目を返し、焼成後は曲線の開始位置をずらす**。**未炒めは現状と同じ値を返すので、描画の回帰は構造的に起きない。**
- CUT の半分ピース・RESULT・Reference 見本は同じ `IngredientPieceVisual` を通る。`PizzaThumbnail`（図鑑）は別描画で、炒めの見た目は出ない。

### 3.2 実測（Chromium、390×844）: 🐄 にフィルターは効かない

beef を 3 個置き、`.pizza-topping--beef` に次のフィルターを当てて 4 枚を比較した。

| 見た目 | フィルター |
|---|---|
| 現状 | なし |
| 炒め済み（PREPARE） | brightness .86 / saturate 1.2 / sepia .28 / contrast 1.08 |
| 焼成「ちょうど」・既定 | brightness .97 / saturate 1.04 / sepia .08（現行曲線） |
| 焼成「ちょうど」・炒め済み | brightness .81 / saturate .83 / sepia .185（曲線を +0.9 ずらした値） |

**結果: 4 枚はほぼ区別できない。** beef は `emoji: "\u{1F404}"`（🐄、`ingredients.ts`、Batch 10 PR-1 の**暫定グリフ**）で、**白黒の乳牛**。茶色方向のフィルターは白黒の絵に効きにくい。さらに「牛肉」を牛の全身で表す絵は、焼いた肉の変化を見せる用途に向かない。

### 3.3 阻害要因 B-1 と対処

| 項目 | 内容 |
|---|---|
| 阻害要因 | **beef の専用 SVG が無い。** `DedicatedIngredientVisual` の union に `beef` が無く、Style Lock v2 の参照アート（`docs/design/references/ingredient-icons-2.0/`）にも `beef.svg` が無い（chicken / pork / ham / sausage 等はある） |
| 必要な作業 | `beef-slices`（薄切り牛肉）の SVG、Style Lock の追補、参照アート、`IngredientGlyph.tsx` の追加、`ingredients.ts` の union と `pieceVisual`。**炒め済みは色の CSS 変数で切り替え、SVG は 1 枚で足りる設計を推奨**（生っぽい赤み → 焼き目の茶） |
| 共有の前提 | **PR-2 の設計も `beef-slices` を計画している**（プルコギ・焼肉・わさび牛の beef 用）。**誰が先に作るかを Owner が決める**必要がある。重複作業を避けるため、SVG は独立した小 PR にするのが妥当 |
| 競合 | #679 が `ingredients.ts`（union）・`IngredientGlyph.tsx`・`App.css` を変更中。SVG 追加は **#679 の merge 後に着手**するのが安全（同じ union に 1 行足すだけだが、同一行の競合になりうる） |
| 副次的な懸念 | Reference 見本や図鑑の beef は炒め済みにならない。プレイヤーのピザだけ見た目が変わる。**変化を控えめ（赤み → 焼き目）に保てば違和感は小さい**が、HV で確認する |
| 補足 | beef は **ladder step 58（rendang）で導入される後半の材料**。到達したプレイヤーだけが見る。HV には DEV State Editor の状態プリセットが要る |

---

## 4. T3 — 入力・レイアウト（実測）

方法: リポジトリ外の使い捨て Playwright プローブ。Free Cooking の TOPPING で beef を 3 個置き、ステージ内に仮のオーバーレイ（`.pizza-dough` の**兄弟**として `.pizza-stage` の直下に absolute）を注入して寸法を比較した。

| 項目 | 390×844 | 360×800 |
|---|---|---|
| `.pizza-stage` | 390×450 | 360×406 |
| `.pizza-dough`（ピザ） | 290×290（上 80px・下 80px の空き） | 273.6×273.6（上下 66px の空き） |
| `.prepare-dock`（トレイ） | 216px | 216px |
| `.prepare-bake-bar` 下端 | **844.0（余白 0px）** | **800.0（余白 0px）** |
| オーバーレイ注入後の dock / bar / stage | **全て不変** | **全て不変** |
| オーバーレイのボタン | 120×48、×は 44×44 | 同 |
| オーバーレイ上のボタンを 3 回押した後のピース数 | 3 → 3（**下の生地に配置が漏れない**） | 3 → 3 |
| タブ数 | 6 | 6 |
| ページ縦オーバーフロー・JS エラー | 0・0 | 0・0 |

**結論:**
- 余白 0px の縦予算には**一切手を付けずに**、ステージの内側だけで完結する（オーバーレイは `.pizza-dough` の外に置くため、生地の pointer ハンドラにイベントが届かない）。
- 「🍳 炒める」を始めるボタンは、**ステージ上下の空き帯（66〜80px）に 44px 級のピルとして置ける**。チップ（118×64）に重ねる必要がなく、`IngredientTray`（#478 が変更中）を触らずに済む。
- 実装上の注意（調査で確認した項目）: (1) オーバーレイ表示中は dock を操作不可にする（`inert`）。(2) オーバーレイの状態はコンポーネント局所にし、`makingStepToken` / `resetToken` で破棄する（既存のジェスチャー中断と同じ流儀）。(3) 完了／×はステージ内に置く。(4) PizzaStage への追加は「子要素を受け取る prop」1 つで足りる（未指定なら DOM 同一）。(5) ボタンは `button` なのでキーボード・AT 代替が標準で付く。

---

## 5. T4 — テンポへの影響（設計予算。実測ではない）

| 区分 | 操作 | 見込み |
|---|---|---|
| 現状の TOPPING（例: rendang の beef 3 + onion 3） | chip 選択 2 回＋配置 6 回＋次へ | 約 10〜15 秒（見込み） |
| 下ごしらえを足す（beef 1 回） | ピル 1 タップ → リズム 3 タップ → 自動で閉じる | **+4〜6 秒**（TOPPING 工程の約 +35〜50%、ラウンド全体の約 +8〜12%） |

- **リポジトリに実測データは無い**（`perStepElapsedMs` は Free のみで、分布の記録なし）。上の数値は操作回数からの見込み。
- 受け入れ基準（提案）: 1 回 ≤ 8 秒／1 レシピ ≤ 1 回／**失敗状態なし**（遅くても完了する）／**飛ばせる**（ピルを押さずに配置できる）／Lunch Rush 不使用。
- 任意なので、**テンポが悪化するのは「やる人」だけ**。やらない人の所要は現状と同一。

---

## 6. 任意操作の価値評価（報酬の検討）

前提: 採点・Pitz・★・Dex に一切反映しない（Owner 方針 6、OD-CS-11）。**本ゲームには音声・振動が無い**（`Audio` / `vibrate` の使用箇所なし）ため、報酬は**視覚と文言のみ**。

| 報酬候補 | 内容 | beef での成立性 | 評価 |
|---|---|---|---|
| R1 盤面に残る見た目の変化 | 炒め済みの牛が赤み → 焼き目に | **🐄 では不成立。SVG があれば成立**（§3） | **最重要。これが無いと任意操作は「何も起きない作業」** |
| R2 焼成後の見た目の差 | 炒め済みは焼成曲線をずらす（現行の「ちょうど」では差が小さい: sepia .08 vs .19） | SVG があれば小さな差 | 補助 |
| R3 パン画面の演出 | 湯気・色の変化・リズムに応じたメーター（ステージ内で完結） | 成立（SVG なしでも、パン内の絵は別に描ける） | **体験の面白さの中心。** 本ゲームで音が無い分、視覚の「ジュッ」を作り込む価値がある |
| R3 ミトの一言 | 食材単位・全モード共通の中立な文言 | 成立 | 低コスト。Anti-Oracle のため標的に触れない文言 |
| R4 採点・Pitz | — | 方針で不可 | 対象外 |

**価値の総括:**
- 任意操作は「**やった人にだけ見える上質さ**」を与える設計で、強制しない限りテンポのリスクは小さい。
- ただし価値の源泉は **R1（盤面に残る変化）** で、これは beef の専用 SVG に依存する。**SVG が無ければ Go にならない。**
- 採点に効かない任意操作は、HV で「面白い」と判定されなければ価値がない。**HV で面倒と判定されたらフラグ OFF で撤回**できる構造にする（§8）。
- 食材単位のため、炒め対象を増やす（eggplant の焼き、mushroom の炒め）ほど「レシピ固有の体験差」が広がる。beef 単体では**出荷済みレシピ 1 件（rendang）**にしか効かない。**最初の検証としては影響範囲が最小で適切だが、体験差の広がりは次段階以降**。

---

## 7. T0 / T7 — 重複・競合・PR-2 整合

確認時点: 2026-10-27、`main` = `47268e3`。読み取り専用。

| 対象 | 状態 | 本計画との関係 |
|---|---|---|
| **#679**（BBQ、open、merge 禁止、実装担当は一本化済み） | 47 ファイル。`ingredients.ts` / `IngredientGlyph.tsx` / `App.css` / `lateCatalog.ts` / `referencePizza.ts` ほか | **reducer・PizzaStage・GameScreen とは重ならない。** 重なるのは **beef の SVG 追加（`ingredients.ts` の union、`IngredientGlyph.tsx`）と `App.css`**。→ **SVG は #679 の merge 後**。`App.css` は炒め用スタイルを別ファイルに分ける |
| **PR-2**（late4 設計 Gate） | 実装 PR なし。Owner 判断 OD-L4-1〜9 が未回答 | **衝突なし。** ただし設計の**前提が古い**: (1) 設計は「beef は新規食材」としているが、**#686（Batch 10 PR-1、merge 済み）で beef は rendang とともに導入済み**（🐄・family `meat`・サイズ `m`・暫定グリフ）。(2) OD-L4-9 の「PR-1 が特定できない」は、**PR-1 = Batch 10 PR-1（#686）**と読める（確認は Owner）。(3) #686 は通常 ladder を step 57-61 に伸ばしたため、**late step の番号導出は PR-2 着手時に再計算**。(4) 焼肉の「炒め」は PR-2 では未モデル（OD-L4-2 の Y1）。**本調査が実装まで進めば、焼肉は Y1 のまま出荷し、炒めの体験は食材単位で後から効く**（レシピの要件・識別は変わらない） |
| **#478**（draft、トレイドラッグ統一） | `IngredientTray.tsx` / `pieceDrag.ts` / `GameScreen.tsx` / `roundKind.ts` | `IngredientTray` は触らない設計にできる。**`GameScreen.tsx` で衝突しうる**（子要素 prop を渡す数行）。`PizzaStage.tsx` は #478 の対象外 |
| **#476**（Issue） | D3: SCATTER 新方式は実装しない | 維持。下ごしらえは SCATTER でも DRIZZLE でもない（食材単位の工程） |
| **#579**（DRIZZLE） | 保留推奨 | 本計画の対象外 |
| **#620**（PR、docs） | open | 競合なし。範囲外 |
| **#468**（open） | `bakeVisual.ts` / `PizzaStage.tsx` / `App.css`（モッツァレラ描画） | T2 の曲線を使うため **`bakeVisual.ts` の変更有無を着手時に再確認**。今回の設計は `bakeVisual.ts` を変えず、`toppingPieceStyle` に値を渡す形 |
| **#689**（新規 open） | テストのみ（research-sim の分割） | 無関係 |
| claim | #611: BBQ（#679）は `01E7…`、優先度表は `01E7…`（期限 11/03）。**本調査は claim を投稿していない** | 実装承認後に #611（親）へ docs / 実装の claim を置く |

---

## 8. Go / No-Go と最小実装計画（S-1〜S5 の再整理）

### 8.1 判断

**条件付き Go。** 条件は次の 2 つで、どちらも Owner の判断を要する。

| 条件 | 内容 |
|---|---|
| **C-1 beef の専用 SVG** | `beef-slices` の設計・Style Lock 追補・制作を誰が・いつ行うか。PR-2 と共有。#679 の merge 後 |
| **C-2 実装承認** | 本書の Go は技術の見立てであり、実装承認ではない。承認までコード変更しない |

C-1 が満たせない場合の**次善**: 炒めをエンジンに入れず、content（BBQ → わさび牛）に専念する。または対象食材を、すでに専用 SVG のある食材に変える案があるが、Owner 方針（beef）に反するため推奨しない。

### 8.2 最小スライス（再整理）

| スライス | 内容 | 触る領域（予定） | 前提 | 本番影響 |
|---|---|---|---|---|
| **S-0（新設・前提）** | `beef-slices` SVG（炒め前後を CSS 変数で切替）、Style Lock 追補、参照アート。**独立した小 PR** | `ingredients.ts`（union・`pieceVisual`）、`IngredientGlyph.tsx`、参照アート、テスト | #679 の merge、C-1 の承認 | beef の見た目が変わる（**単独で HV が要る**） |
| **S1** | 純粋層: 炒め対象の判定（id 導出の別モジュール）、リズム判定（時刻列 → 完了）。テストのみ | `src/logic/prep*.ts`（新規） | 実装承認 | 無し（未配線） |
| **S2** | reducer: `preparedIngredientIds?`・`PREP_INGREDIENT`・`RESET_PIZZA` で除去。**スパイクを本実装＋正規化付き parity テストに昇格**。Lunch Rush・Dinner 拒否 | `gameReducer.ts`、test | S1 | 無し（アクション未発行） |
| **S3** | 描画: `toppingPieceStyle` に炒め済みを渡す（PREPARE でも静的な見た目、焼成後は曲線を開始点ずらし）。SVG の CSS 変数 | `PizzaStage.tsx`、`IngredientPieceVisual` | S-0、S2 | フラグ OFF で無変更 |
| **S4** | UI: ステージ空き帯のピル、パンのオーバーレイ（子要素 prop）、dock の `inert`、×、ミトの一言、フラグ `PREP_EXPERIENCE_PRODUCTION = false` と Preview の opt-in | `GameScreen.tsx`（数行）、`PizzaStage.tsx`（prop 1 つ）、新規コンポーネント、`App.css` 以外の新規 CSS | S3 | フラグ OFF で無変更 |
| **S5** | E2E（390×844 / 360×800 / WebKit）、Preview opt-in、HV 動画＋前後スクショ | `e2e/` | S4 | Preview のみ |

### 8.3 依存関係

```
#679 merge ─→ S-0 (beef-slices SVG; PR-2 と共有)
                 │
Owner 実装承認 ──┴→ S1 → S2 → S3 → S4 → S5(HV)
                          └ スパイク（破棄済み）が S2 の下敷き
並行: PR-2（設計 Gate の再計算後）。炒めには依存しない（焼肉は Y1 のまま）
```

### 8.4 検証方法

| 区分 | 検証 |
|---|---|
| 不変性 | フラグ OFF で既存 golden がバイト同一。ON でも、炒めなしの状態・採点・確定・在庫・Dex が従来と同一（**連番を正規化した** parity テスト） |
| 読まない証明 | architecture test: discovery / scoringV2 / completionGate / pendingRound / hints が炒め状態を import しない |
| 保存 | `pendingRound` 行列テストが無修正で通る。journal に出ない |
| レイアウト | タブ数 6、dock / bar 不変（`dynamic-cooking-steps`・`viewport-1screen`）。ステージ内で完結。ボタン 44px 以上 |
| 入力 | 中断（blur・visibility・ステップ確認）でオーバーレイが破棄され半端な状態が残らない。タップのみで完了（長押し不要）。キーボード |
| Anti-Oracle | 炒め可否が食材単位でモード間同一。Research / Dinner で標的が漏れない |
| 体験（HV） | 390×844 動画（ユーザーへ直接提出）＋前後スクショ。1 回 ≤ 8 秒、失敗なし、任意、**盤面に変化が見える**。Owner が「面白い／面倒」を判定。面倒なら撤回 |
| CI | typecheck / lint / build、WebKit gate |

### 8.5 リスク

| リスク | 緩和 |
|---|---|
| beef の SVG が遅れ、炒めが「何も起きない作業」になる | **S-0 を前提に固定**（無ければ S3 以降に進まない） |
| 食材単位のため rendang の体験が全員変わる（炒め済みの見た目は任意操作の結果のみで、未炒めは現状と同一） | 任意操作のため既存の見た目は不変 |
| HOT ファイル（`GameScreen.tsx` / `PizzaStage.tsx` / `App.css`）の衝突 | claim と merge 順の明記。変更は prop 1 つ・数行に限定 |
| 採点に効かないため価値が薄い | HV で判定、フラグ OFF で撤回 |
| beef は後半の材料で、到達者が少ない | 最初の検証としては影響が小さく安全。汎化（eggplant の焼き等）は別判断 |

---

## 9. 調査の方法と限界

| 項目 | 内容 |
|---|---|
| 実行したこと | `npm ci`（`node_modules` は gitignore）、`vite` 開発サーバー、リポジトリ外の Playwright プローブ（Chromium、390×844・360×800）、スクラッチコピーでのスパイクと vitest。**スパイク差分・プローブ・スクリーンショットは Owner 承認により docs 配下に保持した（上記）。スクラッチコピー自体はリポジトリに入れていない** |
| 変更していないこと | 製品コード、Preview、他の docs、PR、claim、Monitor、`.github` |
| 未実施 | 実機（iPhone / WebKit）の確認、人による所要時間の計測、HV。**テンポは見込みであり実測ではない** |
| 注意 | プローブのオーバーレイは仮の DOM で、実際の見た目・操作感の代替ではない。タップのリズムの手触りは実機でしか判断できない |
| 中断 | 調査中に作業プロセスが一度再起動し、全テストの実行を最初からやり直した（§2.5） |

---

## 10. Result Report

| 項目 | 内容 |
|---|---|
| 依頼 | 下ごしらえ（炒める）の技術調査 T0〜T7、Go / No-Go、最小実装計画。調査のみ |
| 判定 | **条件付き Go**。T0・T1・T3・T5・T6・T7 PASS、T4 条件付き PASS、**T2 は beef 現状 FAIL（🐄 でフィルターが効かない）** |
| 最大の阻害要因 | beef の専用グリフが無い（B-1）。炒めの報酬（R1）が成立せず、任意操作が「何も起きない作業」になる。PR-2 と共有の前提作業 |
| 技術の見立て | 状態は省略可能な transient フィールドで足り、保存・採点・識別・在庫・タブに影響しない（スパイクで実証）。入力はステージ上下の空き帯とオーバーレイで、余白 0px の縦予算を変えずに成立（実測） |
| 任意操作の価値 | SVG があれば中、無ければゼロ。採点に効かず、音・振動も無いため、視覚の質がすべて |
| PR-2 / #679 / #478 | 衝突はグリフ関連ファイルと `GameScreen.tsx` の数行のみ。PR-2 の beef 前提は #686 で古くなっている |
| 変更したもの | docs の追加のみ（本書、保持したスパイク差分・プローブ・スクリーンショット）。製品コード・Preview・PR・merge・claim・Monitor なし |
| Owner に求める判断 | (1) beef の専用 SVG（`beef-slices`）を誰がいつ作るか（PR-2 と共有、#679 の後）。(2) 実装承認（S-0 → S1〜S5）。(3) 面倒と判定された場合は撤回する運用でよいか |
| 次の一手 | Owner が (1) を決める → #679 merge 後に S-0 → 承認後に S1 から |
