# PIZZA GAME Phase 2A 実装結果

Status: 実装完了・レビュー待ち
関連ドキュメント: `docs/design/PIZZA_GAME_SSOT.md`（Phase 2A確定版）

## 1. 監査した base（着手前の GitHub 最新 main）

- リポジトリ: `perusonao/teto-pizza-game`
- 着手前の `origin/main` SHA: `3514cdc3d8eb8f6804017b4ed509860b8ec05884`
  （`docs: GitHub Pages deploy復旧結果を記録 (#4)`）
- 作業ブランチ: `claude/pizza-game-phase-2a-q12fu2`（`origin/main` から新規分岐、着手前に fast-forward 済みであることを確認）
- 着手前の状態: Phase 0 / Phase 1 完了、Public Demo 公開済み、CI・GitHub Pages 正常

過去のチャット履歴ではなく、上記の GitHub 実態（`origin/main` の内容とコミット履歴）を正として実装した。

## 2. 実装内容

### 2.1 SSOT 更新

`docs/design/PIZZA_GAME_SSOT.md` を v2.0 に更新し、以下を反映した。

- Phase 0 / Phase 1 完了ステータスの明記
- Phase 2A の確定スコープ（3A章）を新設
- レシピ判定方式（8章）を「チーズ0種以上」に一般化（マリナーラがチーズ不要のため）
- 焼成の3状態分類（生焼け／いい焼き加減／焦げ）を判定方式に追加
- ロードマップ（10章）を更新し、Phase 2A完了・Phase 2B案を追記
- Phase 2A の Definition of Done（12章）を新設

### 2.2 追加レシピ（3種構成）

既存の data-driven 構造（`src/data/ingredients.ts` / `recipes.ts` / `orders.ts`）を維持したまま拡張。

| レシピ | 必須食材 | 焼成目標レンジ | 備考 |
|---|---|---|---|
| マルゲリータ（既存） | トマトソース・モッツァレラ×3・バジル×2 | 60–80 | 変更なし |
| マリナーラ（新規） | トマトソース・にんにく×3・オレガノ×2 | 45–65 | ナポリ伝統に倣いチーズ不使用 |
| クアトロ フォルマッジ（新規） | オリーブオイル・モッツァレラ×2・ゴルゴンゾーラ×2・パルミジャーノ×2・フォンティーナ×2 | 65–85 | 白ベース＋4種チーズ、焼成後半がシビア |

各レシピについて recipe data / ingredients / order / dialogue（注文セリフ） / scoring（既存ロジックそのまま） / dex entry（説明文）を一通り追加した。マリナーラは実在するナポリの伝統的ピザ（チーズなし）を忠実にモデル化し、クアトロ フォルマッジは白ベース＋4種チーズという実在の構成を踏襲しており、料理として不自然な組み合わせにはしていない。

### 2.3 注文ランダム化

`src/data/orders.ts` の `getNextOrder()` を拡張し、`preferFirst`（初回はマルゲリータ優先）と `excludeRecipeId`（直前のレシピを除外して抽選）の2オプションに対応。`gameReducer.ts` の初期状態生成は `preferFirst: true`、`PLAY_AGAIN` は直前レシピを `excludeRecipeId` に渡すことで、初回体験の連続性を保ちつつ再プレイのたびに違う注文が来るようにした。

### 2.4 トッピング配置改善

`src/state/pizzaState.ts` に `MIN_TOPPING_DISTANCE`（9%）・`isTooClose` / `findOpenSpot` を追加。

- 既存トッピングとの距離が近すぎる場合、リング状に広がる小さな探索（最大4リング×8方向）で近傍の空いている位置に自動でずらして配置する
- 周辺が完全に埋まっていて空きが見つからない場合のみ配置を拒否し、`PizzaStage` に赤い✕マークをパルスアニメーションで表示する（`placement` state + `token` でアニメーションの再トリガーに対応）
- 完全な物理シミュレーションは行わず、スマホの tap 操作性を損なわない範囲の軽量な補正に留めた

### 2.5 焼成の First Fun 強化

`src/logic/bake.ts` に `classifyBake(value, target)` を新設し、`raw`（生焼け）/ `perfect`（いい焼き加減）/ `burnt`（焦げ）の3状態を一元管理。

- `PizzaStage`: 状態ごとに異なるオーバーレイ（生焼け＝淡い白っぽい艶、いい焼き加減＝黄金色のグラデーション、焦げ＝黒っぽい炭化＋煙アニメーション）を表示
- `BakeOverlay`（BAKE中のゲージ）: 生焼けゾーン／目標ゾーン／焦げゾーンを色分けし、現在位置に応じて針の色とキャプション文言（「まだ生っぽいね…」「香ばしいにおい！今がチャンス！」「ちょっと焦げてきたかも！？」）が変化。BAKE中の焼成値を親コンポーネントへ間引きコールバックで伝搬し、ピザ本体もリアルタイムに色が変わるようにした
- `ResultPanel`: 焼き加減バッジ（💧生焼け／✅いい焼き加減／🔥焦げ）をスコアバーの上に表示し、採点と視覚を直結
- `scoring.ts`: 焼成が `perfect` でない場合は★3を上限★2にキャップする補正を追加。これにより「焦げているのに★3で大絶賛」のような見た目とスコアの矛盾を防いだ（実装後のブラウザ確認で発見し修正）
- ブルーのコメントは `bakeState` を最優先で判定し、生焼け／焦げの場合は★2でも専用セリフ（`result.blue.low.raw` / `result.blue.low.burnt`）を表示するよう修正。材料は正しいが焼成だけ外れたケース（★2になりやすい）で汎用の「おいしいよ」コメントが専用セリフより先に選ばれてしまうバグを、PRの自動レビュー（Codex）指摘を受けて修正した（詳細は10章）
- 失敗してもゲームオーバーにはならず、必ず RESULT → DISCOVERED → 再プレイに進める

### 2.6 ミトのヒント強化

`src/data/hints.ts` を新設し、レシピごとに「ソース未塗布」「特定食材が不足」「準備完了」の3段階で自然な口調のセリフを定義（例: マリナーラで にんにく不足時「にんにくをぱらぱらっと散らしてみて！香りが決め手だよ。」）。無機質な「○○が足りません」ではなく、ミトのキャラクター性を保った短い会話にした。

### 2.7 図鑑拡張

`DexOverlay` は元々 `RECIPES` 配列を map するデータ駆動実装だったため、レシピを3種に増やしても変更不要で自動的に3件表示されることを確認。新規発見時のみ表示する `NEW` バッジ（オレンジ色ピル＋カードの光るアニメーション）を追加した。

## 3. First Fun 改善点（まとめ）

- 焼成中からピザの見た目がリアルタイムに変化し、「狙って取り出す」楽しさが増した
- 失敗（生焼け／焦げ）してもゲームオーバーにはならず、見た目・セリフ・スコアが一貫して「次はうまく焼きたい」と思わせる形にフィードバックされる
- 同じ場所に連打しても不格好に重ならず、自然に散らばる／置けなければ分かりやすく拒否される
- 毎回異なる注文が来ることで「もう1枚作ろう」という動機が生まれる
- ミトのセリフがレシピごとに変わり、単なる材料チェッカーではなくキャラクターとの会話として成立している

## 4. 変更ファイル

```
docs/design/PIZZA_GAME_SSOT.md          (更新)
docs/reports/PIZZA_GAME_Phase2A_Result.md (新規, 本ファイル)
docs/reports/screenshots/phase2a-20260913/ (新規, スクリーンショット12枚)
src/App.css                              (更新)
src/App.tsx                              (更新)
src/components/BakeOverlay.tsx           (更新)
src/components/DexOverlay.tsx            (更新)
src/components/PizzaStage.tsx            (更新)
src/components/ResultPanel.tsx           (更新)
src/data/dialogue.ts                     (更新)
src/data/hints.ts                        (新規)
src/data/ingredients.ts                  (更新)
src/data/orders.ts                       (更新)
src/data/recipes.ts                      (更新)
src/logic/bake.ts                        (新規)
src/logic/scoring.ts                     (更新)
src/state/gameReducer.ts                 (更新)
src/state/pizzaState.ts                  (更新)
```

E2Eフレームワークの追加は行っていない（既存CIに新規テストジョブは追加していない）。動作確認はビルド成果物に対する手動 Playwright スクリプトで実施し、テストコード自体はコミットに含めていない（過剰なE2E追加を避けるため）。

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
dist/assets/index-....css         8.46 kB
dist/assets/index-....js        243.05 kB
✓ built in ~0.5s (exit code 0)
```

実装途中で発見した `react(refs)` / `react(set-state-in-effect)` の oxlint 警告（4件）はすべて解消済みで、最終状態は警告0件。

## 6. 390×844 確認結果

Playwright（Chromium, viewport 390×844）で確認。

- `document.documentElement.scrollWidth === window.innerWidth === 390`（横スクロールなし）
- ORDER/PREPARE/BAKE/RESULT/DISCOVERED いずれの画面でも `scrollHeight` が viewport 内に収まり、主要操作（注文確認・ソース/トッピング選択・焼く/取り出すボタン・スコア確認・もう一度作るボタン）がスクロールなしで1画面に収まることを確認
- ピザは全フェーズを通じて画面内最大の視覚要素であることを維持
- キャラクター画像はテト／ミト／ブルーの既存公式素材（`src/assets/characters/*.webp`）をそのまま使用し、再生成・変更は行っていない

## 7. 3レシピ playthrough 結果

自動化した Playwright シナリオで、マルゲリータ・マリナーラ・クアトロ フォルマッジそれぞれについて ORDER→PREPARE→BAKE→RESULT→DISCOVERED を最低1回ずつ確認した。

```
ORDER 1: マルゲリータが食べたいな！おすすめを教えてテト！
Confirmed perfect bake at 62.59
RESULT 1: 最高だよ！これぞ職人の仕事！また作って！ | badge: ✅ 焼き加減: いい焼き加減

order -> quattro-formaggi（チーズたっぷりのクアトロ フォルマッジが食べたい！とろとろにしてね！）
baked recipe=quattro-formaggi mode=raw value=2.19
blue says: うわ、真ん中がまだ生っぽいや…次はもう少し長めに焼いてみよう！ | badge: 💧 焼き加減: 生焼け

order -> margherita（マルゲリータが食べたいな！おすすめを教えてテト！）
baked recipe=margherita mode=burnt value=83.83
blue says: うっ、香ばしいを通り越して焦げてるよ…次は早めに取り出してみて！ | badge: 🔥 焼き加減: 焦げ

order -> marinara（今日はシンプルにマリナーラの気分！トマトとにんにくの香りが恋しいな。）
baked recipe=marinara mode=perfect value=48.02
blue says: 最高だよ！これぞ職人の仕事！また作って！ | badge: ✅ 焼き加減: いい焼き加減

seenRecipes: [ margherita, quattro-formaggi, marinara ]  rawDone: true  burntDone: true
CONSOLE ERRORS: none
ALL CHECKS PASSED
```

（上記は9A章の修正を反映した再実行結果。修正前は raw/burnt でも「おいしいよ！でももう少し極められそうだね。」という汎用セリフが出ていたが、修正後は生焼け・焦げそれぞれの専用セリフが正しく出るようになっている。）

いずれのレシピも DISCOVERED まで到達し、図鑑に正しく登録されることを確認した。

## 8. bake 3状態確認

同一セッション内で以下3状態をそれぞれ最低1回確認した（上記ログの通り）。

- perfect（いい焼き加減）: マルゲリータ, value=62.59 → ★3, バッジ「✅ いい焼き加減」
- raw（生焼け）: クアトロ フォルマッジ, value=2.19 → ★2（生焼けのため★3キャップ）, バッジ「💧 生焼け」, ブルーの専用セリフ表示
- burnt（焦げ）: マルゲリータ, value=83.83 → ★2（焦げのため★3キャップ）, バッジ「🔥 焦げ」, ブルーの専用セリフ表示

3状態それぞれでピザの見た目（オーバーレイ色・焦げの場合は煙アニメーション）・ブルーのコメント・スコアバッジ・★上限が連動して変化することを確認した。

また、同一地点への連続タップ（同じ座標に45回連打）でも、トッピングが自動でずれて13個まで自然に散らばり、密集した場合は✕マークで配置拒否が視覚的にフィードバックされることを確認した（コンソールエラー0件）。

## 9. スクリーンショット

`docs/reports/screenshots/phase2a-20260913/` に格納（390×844）。

1. `01-order-margherita.png` — ORDER（マルゲリータ、初回優先）
2. `02-order-marinara.png` — ORDER（マリナーラ）
3. `03-order-quattro-formaggi.png` — ORDER（クアトロ フォルマッジ）
4. `04-prepare-empty.png` — PREPARE（未着手）
5. `05-prepare-ready.png` — PREPARE（材料配置完了、ミトのready hint）
6. `06-bake-gauge.png` — BAKE（3ゾーン色分けゲージ、生焼けキャプション）
7. `07-result-good-bake.png` — RESULT（good bake, ★3）
8. `08-result-underbake.png` — RESULT（生焼け, ★2, バッジ「💧 生焼け」）
9. `09-result-burnt.png` — RESULT（焦げ, ★2, バッジ「🔥 焦げ」, 煙演出）
10. `10-discovered-new.png` — DISCOVERED（新規発見バナー）
11. `11-dex-new-badge.png` — 図鑑（NEWバッジ付きマルゲリータ、他2件は？？？）
12. `12-dex-all-3-recipes.png` — 図鑑（3レシピ表示、マリナーラ・クアトロ フォルマッジも発見済み）

## 9A. PR自動レビュー指摘への対応

PR作成直後、`chatgpt-codex-connector[bot]` による自動レビューで以下2件のP2指摘を受け、いずれも検証のうえ修正・再pushした。

1. **焼成失敗時のブルーのセリフが選ばれない**: 材料が正しいまま生焼け／焦げにすると★2止まりになりやすく、`App.tsx` の分岐が「★2判定 → bakeState判定」の順だったため、専用の生焼け／焦げセリフ（`result.blue.low.raw` / `.low.burnt`）が実質到達不能だった。分岐順序を「★3 → bakeStateがraw/burnt → ★2 → それ以外」に変更し、材料が合っていても焼成が外れていれば必ず専用セリフが出るように修正した
2. **誤ったソースでもヒントが進んでしまう**: `hints.ts` の `hasSauce` が「何かソースが塗られていること」しか見ておらず、例えばマルゲリータにオリーブオイルを塗っても「ソース完了」とみなされ、次のヒントに進んでしまっていた。レシピが要求する正しいソースIDが塗られているかを見るように修正した

修正後、両ケースをPlaywrightで再現して意図通りの挙動になることを確認済み（生焼け・焦げでそれぞれ専用セリフが出ること、誤ったソースを塗ってもヒントが「まずはトマトソースを塗ってみて！」のまま進まないこと）。修正はレポート添付のスクリーンショットにも反映済み。

## 10. known issues

- チーズ4種（モッツァレラ／ゴルゴンゾーラ／パルミジャーノ／フォンティーナ）は絵文字が同一（🧀）のため、ピザ上での見分けは名前ラベルではなくトレイの表記に頼る。Phase 1 から続く「絵文字プレースホルダー」方針の範囲内だが、Phase 2B 以降で専用アイコン/色分けを検討する余地がある
- トッピング配置の自動ずらしは、レシピが要求する個数（最大でも1レシピあたり8個程度）では拒否がほぼ発生しない設計。今回のテストでは同一点へ45回連打してようやく拒否を確認しており、通常プレイでは「ずらし」のみが体感される（意図通りだが明記しておく）
- BAKE中のライブプレビューはパフォーマンス配慮のため描画を間引いている（フレームスキップ）。低スペック端末での見え方は未検証
- E2Eの自動テストコードはリポジトリに追加していない（手動確認スクリプトのみで検証し、過剰なテスト追加を避けた）。将来的に最小限のロジックテスト（`scoring.ts` や `pizzaState.ts` のユニットテスト）を追加する余地はある

## 11. commit SHA / PR URL / CI状態

- 実装コミット: `ff94634a2a22f967f09817f24ba1ccbf7589fcc1`
  （`Phase 2A: マルチレシピ + First Fun Polish`）
- レポート追加コミット（PRの最新head）: `49cd6664f94e609f9aaa7eb9c47b1fcbf3527f98`
  （`docs: Phase 2A実装結果レポートを追加`）
- ベースコミット（着手前 main）: `3514cdc3d8eb8f6804017b4ed509860b8ec05884`
- Pull Request: https://github.com/perusonao/teto-pizza-game/pull/5
- CI状態: **green**（`build` ジョブ = `success`、`npm ci` / `npm run lint` / `npm run build` すべて成功）。
  レビューコメント・レビューともに0件（2026-09-13 11:47 UTC 時点）

## 12. merge readiness

- ローカル・CI とも `npm ci` / `npm run lint` / `npm run build` がすべて成功（0エラー・0警告）
- Playwright による手動確認で、3レシピ×全フェーズ、焼成3状態、トッピング配置改善、コンソールエラー0件を確認済み
- PRの `mergeable_state` は `clean`（mainとのコンフリクトなし）
- レビューコメント・変更要求は0件で、技術的にマージ可能な状態
- 自動マージは行っていない。マージの可否・タイミングはリポジトリオーナー（perusonao）の判断に委ねる

## 13. Phase 2B 推奨内容

- チーズ4種の視覚的差別化（アイコンまたは色分け）の検討
- トッピングの「再タップで削除」など、配置の自由度をさらに高める操作性改善（UI SPEC 3.3 に記載のある任意実装）
- `scoring.ts` / `pizzaState.ts` の純粋関数に対する最小限のユニットテスト追加
- 図鑑の「発見済みレシピの再チェック（もう一度見る）」など、図鑑まわりのプレイヤー動機付けの強化
- 焼成のライブプレビューのパフォーマンス計測（低スペック端末での実機確認）
- 新レシピ追加のたびに `RECIPE_HINTS` の記述が増えるため、将来レシピ数が更に増える場合はヒント文言のデータ構造をもう一段整理することを検討
