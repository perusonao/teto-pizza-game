# PIZZA GAME Phase 2C 実装結果

Status: 実装完了・レビュー待ち
関連ドキュメント: `docs/design/PIZZA_GAME_SSOT.md`、`docs/reports/PIZZA_GAME_Phase2B_Result.md`

## 0. 監査資料について（重要な前提）

今回のタスク依頼では、以下のファイルを読んでから着手するよう指示された。

- `docs/reports/PIZZA_GAME_Phase2B_PostDeploy_Fresh-Review.md`
- `docs/reports/screenshots/phase2b-postdeploy-fresh/`

着手前にリポジトリ内（このリモートセッションのファイルシステム上）を確認したが、
このファイル・ディレクトリは存在しなかった。`docs/reports/screenshots/` に実在するのは
`fresh-review-20260913/`（01〜06の主要画面キャプチャのみ、監査コメント付きの
Markdownは同梱されていない）と `phase2b-20260913/` のみで、指定された
`PIZZA_GAME_Phase2B_PostDeploy_Fresh-Review.md` 自体はGitHub上のどのブランチにも
存在しなかった。Phase 2Bの実装結果（`PIZZA_GAME_Phase2B_Result.md` 0章）でも同様の
状況が記録されており、これはユーザーのローカル環境にのみ存在するファイルで、この
リモートコンテナからはアクセスできないという既知のパターンだと判断した。

そのため、本Phase 2Cはタスク依頼文に直接記載された Fresh Review 結果
（Verdict B / P0=0 / 2枚目=YES / 4枚目=BORDERLINE / Phase 2B各項目の
Olive Oil=PASS・Four Cheese=PASS・Bake Visual=PARTIAL・Dex Motivation=PASS）を
そのまま一次情報として採用し、実装した。この記載内容は `PIZZA_GAME_Phase2B_Result.md`
8章・9章が自己申告していた「raw視認性はレシピ依存」という既知課題（Bake Visualの
PARTIAL判定の根拠）と整合しており、依頼内容の信頼性は裏付けられると判断した。

## 1. 監査した base

- リポジトリ: `perusonao/teto-pizza-game`
- 着手前の `origin/main` SHA: `1b6723c977b24bb2d3542dea9ec26d473b93204e`
  （`Phase 2B: Visual Feedback + Replay Motivation Polish (#6)`、依頼文記載の
  Phase 2B merge SHAと一致）
- 作業ブランチ: `claude/pizza-game-phase-2c-98miyv`（`origin/main` から分岐、
  着手前に一致していることを確認）
- Phase 2B（オリーブオイル・4種チーズ視覚差・焼成ビジュアル・図鑑動機付け）は
  再オープンしていない。既存実装はそのまま土台として使い、上に薄く重ねる形で
  3項目のみ追加した。

## 2. Fresh Review指摘との対応表

| # | Fresh Review指摘 | 対応 | 実装箇所 |
|---|---|---|---|
| P1 | ソースが「1タップで全面が即座に塗られる」ため塗った感が弱い | タップ位置を起点に `clip-path: circle()` で円形に広がるspread animation（380ms, linear）を追加。トマトソースは赤、オリーブオイルは既存の光沢グラデーションがそのまま同じ広がり方をする | `src/App.css`（`.pizza-sauce-layer`, `@keyframes sauce-spread`）、`src/components/PizzaStage.tsx`、`src/state/pizzaState.ts`（`sauceOrigin`/`sauceToken`）、`src/state/gameReducer.ts`（`APPLY_SAUCE` にx/y追加） |
| P2 | トッピングを置いた瞬間の演出が単なるフェードインで「置いた」感が弱い | 少し上から落ちて着地時にオーバーシュート（scale 0.6→1.12→0.95→1.0）する landing animation（220ms）に変更。auto-nudgeされた最終位置に対してそのまま着地するため、ずれた場合も不自然にならない | `src/App.css`（`.pizza-topping`, `@keyframes topping-land`。旧`drop-in`を置換） |
| P2 | raw/perfect/burntの見た目差が弱い（特にraw↔perfectがソースに隠れやすい） | ①生地の縁（crust border）の色をraw=淡いクリーム／perfect=濃い黄金褐色／burnt=ほぼ黒に変更（ソース面積に依存せず常に視認可能）②perfect時のみソース・具材・チーズにごく軽い暖色/焼き色フィルタを追加③perfect到達直後に一度だけ短い warm glow（700ms）を発火 | `src/App.css`（`.pizza-dough--*` の `border-color`、`.pizza-dough--perfect .pizza-sauce-layer`/`.pizza-topping`、`.pizza-cheese--melted.pizza-cheese--toasted`、`.pizza-perfect-glow`）、`src/components/PizzaStage.tsx`（`resultRevealed` prop、`meltClass`にtoasted追加）、`src/App.tsx` |

新機能追加・自由描画・ドラッグ配置刷新・新レシピ・キャラクター表情追加は
一切行っていない（スコープ外）。

## 3. 実装内容

### 3.1 Sauce Feedback（最優先）

- `PizzaState` に `sauceOrigin: { x, y } | null` と `sauceToken: number` を追加。
  `APPLY_SAUCE` アクションに `x`/`y` を追加し、タップ位置を保存、`sauceToken` を
  インクリメントする。
- `PizzaStage` はソースレイヤーに `key={pizza.sauceToken}` を付け、タップの
  たびに要素を再マウントしてアニメーションを毎回リプレイさせる。CSS変数
  `--sauce-origin-x`/`--sauce-origin-y` にタップ位置（%）を渡す。
- `.pizza-sauce-layer` に `clip-path: circle(0% at origin) → circle(150% at origin)`
  を380ms・linearで適用。開始時は透明度も0.55からスタートし、単純なopacity
  fade-inではなく「タップ位置から円形に広がった」ことが明確に分かるようにした
  （150%は、境界に近い位置をタップしても確実に全面を覆いきるための安全マージン）。
- トマトソース・オリーブオイルとも同じアニメーションを共有し、既存の色・質感
  （P1-1で作った光沢グラデーションなど）はそのまま活きる。
- 判定に使う `sauceIds` / レシピ判定ロジックは一切変更していない。

### 3.2 Topping Placement Feedback

- `.pizza-topping` の `animation` を `drop-in`（単純なscale 0.3→1 フェード）から
  `topping-land`（0%: 上方14px・scale 0.6・opacity 0 → 55%: scale 1.12 →
  80%: scale 0.95 → 100%: scale 1.0）に置き換え、220ms・linearで再生。
  「タップした」ではなく「置いた」と感じられるよう、着地の伸び縮み（バウンス）を
  つけた。
- アニメーションは各トッピング要素の**マウント時**にのみ再生されるため、
  auto-nudgeで最終位置が調整された場合も、その最終座標へ向けて自然に着地する
  （タップ位置から最終位置へ移動する演出ではなく、最終位置に「降ってくる」演出
  にすることで、既存の spiral-search による座標調整ロジックとも矛盾なく組み合わさる）。
- アニメーションはトッピングのラッパー `<span className="pizza-topping">`側にのみ
  適用し、チーズ形状・回転（`.pizza-cheese--parmigiano` の `rotate(-18deg)` 等）は
  内側の `<span className="pizza-cheese pizza-cheese--*">` 側でそのまま維持している
  ため、4種チーズの形状・サイズ差は変更していない。

### 3.3 Raw / Perfect Visual Difference

- **crust（生地の縁）の色分け**: `.pizza-dough--raw/--perfect/--burnt` に
  `border-color` を追加（raw: `#ecd9a3` 淡いクリーム／perfect: `#a06a2b`
  濃い黄金褐色／burnt: `#3a2211` ほぼ黒）。生地の縁（10px の枠線）はソースの
  面積に関わらず常に見えているため、マルゲリータ・マリナーラのようにソースで
  ほとんど覆われるレシピでも raw/perfect の差が一目で分かるようにした
  （Phase 2B 9章で自己申告していた既知課題への直接対応）。
- **ソースの色味**: perfect時はソース層に `saturate(1.08) brightness(0.95)
  hue-rotate(-6deg)` を適用し、少し暖色・深みのある色にする。raw時は
  `saturate(1.18) brightness(1.06)` で鮮やか・生っぽい発色を維持する。
  いずれも `filter` を使い、既存の背景色・グラデーション自体は変更していない
  （`:not(.pizza-sauce-layer--oil)` でオリーブオイル層は別ルールに分離）。
- **具材のロースト感**: `.pizza-dough--perfect .pizza-topping` に
  `brightness(1.02) saturate(1.06) sepia(0.05)` というごく軽いフィルタを追加。
  焦げではなく「軽く火が通った」程度に留めた。
- **チーズの焼き色**: perfect時のみ `pizza-cheese--melted pizza-cheese--toasted`
  の2クラスを付与し、`.pizza-cheese--melted.pizza-cheese--toasted`（複合セレクタ）
  で `brightness(1.06) saturate(1.12) sepia(0.14)` を適用。単一クラスの
  `.pizza-cheese--toasted` ではなく複合クラスにしたのは、Phase 2B 9A章の
  postmortem（スタイルシートの記述順でチーズの見た目が意図せず上書きされた
  バグ）を踏まえ、**宣言順に依存せず詳細度で確実に勝つ**ようにするため。
  burnt用の `--charred` クラスとは別クラスなので、既存の焦げ表現は変更していない。
- **完成直後のwarm glow**: `PizzaStage` に `resultRevealed`（`phase === "RESULT"`）
  propを追加。`resultRevealed && bakeState === "perfect"` の間だけ
  `.pizza-perfect-glow` 要素を描画し、RESULT表示に切り替わった瞬間にマウント
  されることで `perfect-glow`（700ms, opacity 0→1→0 + scale 0.85→1.06→1.2、
  `mix-blend-mode: screen` の暖色radial-gradient）が一度だけ再生される。
  BAKE中にゲージがperfectゾーンを通過するだけでは発火しない（`resultRevealed`
  がfalseのため）。

## 4. 変更ファイル

```
src/App.css                     (更新: sauce-spread/topping-land keyframes、
                                  crust色分け、raw/perfect用フィルタ追加、
                                  pizza-cheese--toasted、pizza-perfect-glow)
src/App.tsx                     (更新: APPLY_SAUCEにx/y追加、PizzaStageへ
                                  resultRevealed props追加)
src/components/PizzaStage.tsx   (更新: sauceOrigin CSS変数、meltClassにtoasted、
                                  perfect-glowのレンダリング分岐)
src/state/pizzaState.ts         (更新: PizzaStateにsauceOrigin/sauceToken追加)
src/state/gameReducer.ts        (更新: APPLY_SAUCEアクション型・reducerにx/y追加)
docs/reports/PIZZA_GAME_Phase2C_Result.md       (新規, 本ファイル)
docs/reports/screenshots/phase2c/               (新規, スクリーンショット14枚)
```

新規レシピ・経営要素・永続化・音・自由描画・ドラッグ全面刷新・E2Eフレームワーク
追加はスコープ外のため行っていない。検証に使ったPlaywrightスクリプトは
リポジトリにコミットせず、確認後に削除した（Phase 2A/2Bの方針を踏襲）。

## 5. lint / build 結果

```
$ npm ci
added 30 packages, and audited 31 packages in 3s
found 0 vulnerabilities

$ npm run lint
> oxlint
(警告・エラーなし, exit code 0)

$ npm run build
> tsc -b && vite build
✓ 35 modules transformed.
dist/index.html                   0.53 kB
dist/assets/teto-....webp         7.23 kB
dist/assets/index-....css        12.59 kB
dist/assets/index-....js        244.10 kB
✓ built in ~0.5s (exit code 0)
```

## 6. 実機（Playwright, Chromium, 390×844）確認結果

`npm run build` の成果物を `vite preview` で配信し、Playwright（Chromium実バイナリ、
viewport 390×844）で実際に操作して確認した。テストコードは確認後にリポジトリから
削除している。

### 6.1 3レシピ連続 playthrough（同一セッション）

```
ORDER 1: マルゲリータが食べたいな！おすすめを教えてテト！   ← 初回優先どおり
  → トマトソース(spread確認) + モッツァレラ5(auto-nudge込み) + バジル2
  → perfect付近（bakeTarget 60-80のレンジ内）で取り出し
  RESULT: ブルー「最高だよ！これぞ職人の仕事！また作って！」★3
  → 図鑑登録 → もう一度作る

ORDER 2: 今日はシンプルにマリナーラの気分！...          ← 未発見優先で選出
  → トマトソース + にんにく3 + オレガノ2
  → 220ms（bakeTarget開始45%より大幅前）で取り出し = raw
  RESULT: ブルー「うわ、真ん中がまだ生っぽいや…次はもう少し長めに焼いてみよう！」
  → 図鑑登録 → もう一度作る

ORDER 3: チーズたっぷりのクアトロ フォルマッジが食べたい！...  ← 残り最後の未発見
  → オリーブオイル + 4種チーズ各2
  → 1650ms（bakeTarget終了85%を超過）で取り出し = burnt
  RESULT: ブルー「うっ、香ばしいを通り越して焦げてるよ…次は早めに取り出してみて！」★2
  → 図鑑登録

CONSOLE ERRORS: []
```

3レシピとも初回=マルゲリータ固定、2・3回目は未発見優先ロジックどおりに選出され、
それぞれ異なる焼成状態（perfect/raw/burnt）で最後までプレイできた。Blueの専用
セリフ・バッジ・スコア連動（Phase 2A/2B由来）は壊れていない。

### 6.2 図鑑 3/3 確認

3回目の登録直後に図鑑を開き、`.dex-card--locked` が0件、カード総数3件で、
マルゲリータ・マリナーラ・クアトロ フォルマッジすべてが発見済み表示、最後に
発見したクアトロ フォルマッジに `NEW` バッジが付いていることを確認した。
スクリーンショット: `screenshots/phase2c/11-dex-3of3.png`

### 6.3 Sauce spread animation

タップ直後（約110ms後）にスクリーンショットを撮ったところ、タップした
左上寄りの位置を起点に赤いソースが円形に広がっている途中の状態（生地が
右下にまだ見えている）が確認できた。完了後（約400ms後）は全面が均一に
覆われている。オリーブオイルでも同じ広がり方をすることをコード上・実機の
両方で確認した（`10-quattro-cheeses.png` の元になったQuattroプレイで
オリーブオイル塗布時に目視確認）。
スクリーンショット: `02-sauce-spreading.png` → `03-sauce-after.png`

### 6.4 Topping landing animation + auto-nudge

トッピング配置直後（約55ms後）に、まだ小さく・やや上にオフセットした状態の
チーズが確認でき、完了後（約350ms後）は通常サイズに着地していることを確認した。
また、ほぼ同じ座標に連続で2回配置した際（auto-nudgeテスト）、2つ目が既存の
0.6%オフセットで自動的にずらされ、最終的に5個のモッツァレラが重なりなく
着地することを確認した（`auto-nudge-landing.png`）。
スクリーンショット: `05-topping-landing.png` → `06-topping-after.png`

### 6.5 raw / perfect / burnt 比較（第三者判別レビュー）

| 状態 | スクリーンショット | 見た目の特徴 |
|---|---|---|
| raw（マリナーラ） | `07-bake-raw.png` | 生地の縁が淡いクリーム色。ソース自体も鮮やかな赤のまま（焼けた深みがない）。にんにく・オレガノの色も生っぽい |
| perfect（マルゲリータ） | `08-bake-perfect.png` | 生地の縁が濃い黄金褐色。ソースがやや暖色に深まり、モッツァレラ・バジルにもごく軽い焼き色。取り出し直後は`08-bake-perfect-glow-peak.png`のように一瞬明るい暖色のglowが差す |
| burnt（クアトロ フォルマッジ） | `09-bake-burnt.png` | 生地全体がほぼ黒に近い焦げ茶色。縁も黒褐色。焦げ斑点・煙エフェクトが出て、4種チーズも暗く色褪せている |

3枚を横に並べて自己レビューしたところ、**生地の縁（crust）の色だけを見ても**
raw（淡いクリーム）／perfect（濃い黄金）／burnt（ほぼ黒）の3段階が明確に区別
でき、Phase 2Bで課題だった「ソースが生地面積の大半を覆うレシピ（マルゲリータ・
マリナーラ）でraw/perfectの差が弱い」という問題は、縁の色というソース面積に
依存しない指標を追加したことで解消したと判断した。テキスト・バッジを見なくても
3状態を判別できる。

## 7. Visual Gate 結果

`docs/reports/screenshots/phase2c/` に保存（すべて390×844）。

```
01-sauce-before.png
02-sauce-spreading.png
03-sauce-after.png
04-topping-before.png
05-topping-landing.png
06-topping-after.png
07-bake-raw.png
08-bake-perfect.png
09-bake-burnt.png
10-quattro-cheeses.png
11-dex-3of3.png
(補助) auto-nudge-landing.png, 07-bake-inprogress.png, 08-bake-perfect-glow-peak.png
```

07/08/09を横に並べたセルフレビュー結果は6.5節のとおりで、第三者がテキストなしでも
raw/perfect/burntを判別できるレベルに達していると判断した。

## 8. Fresh Reviewとの比較（4枚目判定の再評価）

Phase 2B Fresh Review の「4枚目 = BORDERLINE」は、依頼文の記述と
`PIZZA_GAME_Phase2B_Result.md` 9章の自己申告から、主に次の2点が根拠だったと
解釈している。

1. ソース塗り・トッピング配置が「1タップで完了」で操作のフィードバックが薄く、
   4枚目あたりで「作業感」が出やすい
2. raw/perfect の視覚差がレシピ（ソース面積）依存で、連続プレイ中に
   「今のは本当にperfectだったのか」が分かりにくい場面がありうる

Phase 2Cでは、(1)に対してsauce spread animation・topping landing animationを
追加し、塗る/置く操作のたびに視覚的なレスポンスが返るようにした。(2)に対しては
crustの色分けという、ソース面積に依存しない新しい指標を追加した。実機で3レシピ
連続プレイした際、2枚目はもちろん3枚目（burnt）まで含めて、操作のたびに
「反応が返ってきている」感触があり、焼き加減の違いも一目で分かった。

**自己評価**: 4枚目のプレイを直接は行っていない（3レシピ×1周のみ）ため、
「4枚目でも本当に飽きないか」を実機で確認したとは言い切れない。ただし、
Fresh Reviewが指摘した2つの弱点（操作フィードバックの薄さ／raw視認性）に
対する直接的な対策を入れたため、**4枚目 = BORDERLINE → YES に上がったと
判断する**。ただし、これはP1/P2の3項目を実装した範囲での改善であり、
「派手さを増やしたことによる目新しさ」ではなく「同じ操作でも毎回気持ちよく
返ってくる」ことによる改善である点を強調しておく。断定的な結論ではなく、
実際に4枚連続でプレイしたユーザーの評価と照合されるべき自己評価である。

## 9. known issues

- 4枚目の実機プレイは今回のセッションでは行っていない（3レシピ×1周のみ）。
  上記8章の「4枚目 = YES」判断は、Fresh Reviewの指摘に対する直接対策の有無に
  基づく推定であり、実プレイでの確認ではない
- perfect時の warm glow は `mix-blend-mode: screen` を使っているため、
  理論上は非常に暗い背景色と組み合わさった場合に効果が弱まる可能性があるが、
  今回の3レシピ（生地はいずれも明るいオレンジ〜黄金系）では問題なく視認できた
- raw/perfectの crust 色分けは効果的だが、生地の縁は10px幅と細いため、
  非常に小さい画面や低解像度スクリーンショットではやや見づらくなる可能性がある
  （390×844の基準解像度では問題なく判別可能なことを確認済み）
- E2Eの自動テストコードはリポジトリに追加していない（Phase 2A/2Bの方針を
  踏襲し、手動Playwright確認のみで検証）

## 9A. PR自動レビュー指摘への対応

PR作成直後、`chatgpt-codex-connector[bot]` による自動レビュー（P2）で以下の指摘を
受け、検証のうえ修正・再pushした。

**指摘**: `PizzaStage.tsx` の `handleClick` が計算する `rawX`/`rawY` は
`.pizza-dough`（border box、border込み）を基準にした%だが、sauce-spread
アニメーションの `clip-path: circle(... at var(--sauce-origin-x) ...)` は
`.pizza-sauce-layer`（`inset: 6%` 分小さい）自身のボックスを基準に解決される
ため、両者の基準が一致していない。生地の縁に近い位置をタップすると、
スプレッドの開始位置がタップ位置よりやや中心寄りにずれる（300pxのピザで
目視できる程度のズレ）。

**検証**: 実機で、生地の縁近く（半径46%）をタップした位置に緑色のマーカーを
重ねてスクリーンショットを撮り、修正前はスプレッドの起点がマーカーよりも
内側にずれることを確認した。指摘は正確だった。

**対応**: `PizzaStage.tsx` に `SAUCE_LAYER_INSET_PERCENT`（CSS側の
`.pizza-sauce-layer { inset: 6%; }` と一致させる定数）を追加し、
`toSauceLayerPercent()` でタップ位置（dough基準%）をsauce-layer自身の
座標系に変換してからCSS変数に渡すよう修正した。修正後、同じ縁近くタップで
再検証し、スプレッドの起点がタップ位置（マーカー）と一致することを確認した。
これに伴い、上記9章にあった「座標系の僅かなズレ」の既知課題は解消したため
削除済み。

## 10. Git / commit / PR

- ベースコミット（着手前 `origin/main`）: `1b6723c977b24bb2d3542dea9ec26d473b93204e`
- 作業ブランチ: `claude/pizza-game-phase-2c-98miyv`
- 自動マージは行っていない。マージの可否・タイミングはリポジトリオーナー
  （perusonao）の判断に委ねる
- commit SHA・PR URL・CI状態は本ファイルの末尾（コミット後に追記）を参照

## 11. 最終判定

**A. FIRST FUN READY**

判断根拠:

- Sauce Feedback・Topping Placement Feedback・Raw/Perfect Visual Differenceの
  3項目すべてを実装し、390×844の実ブラウザで実際に操作して確認した
  （コードを書いただけでなく、アニメーションのイージング関数が速すぎて
  スクリーンショットで変化がほぼ見えないという問題を実機確認で発見し、
  `cubic-bezier` から `linear` に変更して再検証するサイクルを回している）
- ソース塗りはタップ位置から円形に広がる過程が実機スクリーンショットで
  明確に確認でき、単なるopacityフェードではないことを検証した
- トッピング配置は着地バウンスが確認でき、auto-nudgeされた場合でも
  最終位置に自然に着地することを確認した。4種チーズの形状差（Phase 2B）は
  維持されている
- raw/perfect/burntは、生地の縁の色という新しい・ソース面積に依存しない
  指標を追加したことで、3レシピ連続プレイのスクリーンショットを並べて
  テキストなしで判別できることを確認した。perfect到達直後のwarm glowも
  実機で発火を確認した
- 3レシピすべてを同一セッションで図鑑登録でき（3/3、NEWバッジ確認）、
  Margherita/Marinara/Quattro Formaggiの既存レシピ判定・スコアリング・
  Blueのコメント分岐・bakeスコアリングは壊れていない
- lint・buildともにエラー・警告0件、実機確認でconsoleエラー0件
- 新機能・新レシピ・経営要素・永続化・音・自由描画・ドラッグ全面刷新・
  大量E2Eは追加しておらず、スコープを逸脱していない

9章に記載した既知の限界（4枚目の実機未検証、座標系の僅かなズレ）は残っているが、
これらはP0/P1指摘の未達ではなく、「今回の目的（塗る/置く/焼くの操作に視覚的な
responseがあるか）」を損なうほどの欠陥ではないと判断し、A評価とした。ただし
8章に明記した通り、4枚目=YESという評価は実プレイに基づく確認ではなく推定である
ことを正直に記載しておく。
