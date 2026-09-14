# Phase 3C-4: Lunch Rush Mission — Result

Status: 実装完了（Final Verdict は本レポート末尾を参照）
関連ドキュメント: `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`（第11章 Lunch Rush）/
`docs/design/PIZZA_GAME_SSOT.md` /
`docs/reports/PIZZA_GAME_Phase3C-3_Mastery-Availability_Result.md`

## Base / Branch / Commit

- Base SHA: `ff81cf217d09d217ffaff5d353ee7a456d501d51`（origin/main, 期待値と一致）
- Branch: `claude/lunch-rush-mission-j9i57f`
- Commit SHA: 本レポートをコミットした時点のHEAD（PR側の最新コミットを参照）

## Scope（今回やったこと / やらなかったこと）

指示どおり、「Lunch Rush」ミッション（連続注文 → 連続採点 → 制限時間終了 → Mission Result）
のみを実装した。

今回やっていない（指示どおり、非スコープ）:

- Pitz獲得・Pitz UI・Shop・食材購入・ingredient consumption
- Recipe #7（サラミ）・salami・inventory quantity
- 複数Mission・Mission map・経営要素・leaderboard/backend

## Changed files

```
src/mission/lunchRush.ts                (新規) MissionConfig・MissionClock・timer関数・
                                         pickMissionOrder・MissionMode/MissionState・
                                         missionRunReducer
src/mission/lunchRush.test.ts           (新規) 上記の単体テスト（24件）
src/logic/missionScoring.ts             (新規) MissionMetrics・recordServe・
                                         averageQualityScore・missionScore・isNewMissionBest
src/logic/missionScoring.test.ts        (新規) 上記の単体テスト（13件）
src/state/gameReducer.ts                (+66/-8) MISSION_NEXT_ORDER・MISSION_RESET_ORDER
                                         追加、nextOrderStateをbuildOrderStateへ分離・共有化
src/state/gameReducer.test.ts           (+91)   Mission order actionsの単体テスト（7件）
src/state/persistence.ts                (+76/-6) missionBestの型をRecord<string, number>化、
                                         sanitizeMissionBestの実検証、loadMissionBest/
                                         persistMissionBest追加
src/state/persistence.test.ts           (+78)   Mission BESTの単体テスト（11件）
src/components/MissionHud.tsx           (新規) PLAYING中の残り時間+提供数バッジ
src/components/MissionIntroOverlay.tsx  (新規) Mission説明画面
src/components/MissionServePanel.tsx    (新規) Mission中の圧縮RESULT（★・点数・+1 SERVED）
src/components/MissionResultOverlay.tsx (新規) Mission Result画面
src/App.tsx                             (+152/-4) Mission run stateの配線、entry button、
                                         timer interval、persistence effect
src/App.css                             (+171)  上記コンポーネントのスタイル
docs/reports/PIZZA_GAME_Phase3C-4_Lunch-Rush_Result.md (新規) 本レポート
```

既存6レシピ・既存13食材のデータ（`src/data/recipes.ts` / `src/data/ingredients.ts`）、
既存の採点ロジック（`src/logic/scoring.ts`）は無変更。

## Mission architecture

指示（第13章）どおり、Missionを**既存の5フェーズ状態機械の外側に被さる薄いwrapper**として
実装し、`gameReducer`を巨大なMission state machineへ変形しなかった。

- **`GameState`（既存, `src/state/gameReducer.ts`）**: 「今作っている1枚」の唯一の
  canonical state（order/recipe/pizza/dex/ownedIngredientIds）。FreeでもMissionでも
  これ1つだけを使う — Mission専用の別の「現在のピザ」state は一切持たない。
- **`MissionState`（新規, `src/mission/lunchRush.ts`）**: Mission特有の情報
  （`mode`: FREE/INTRO/PLAYING/RESULT、`clock`、`metrics`）のみを持つ、完全に独立した
  `useReducer`。`GameState`と1個もフィールドが重複しないため、「状態の二重管理」には
  当たらない（同じデータを2箇所で持っていない）。
- 両者は`App.tsx`内の少数のハンドラ（`startMission` / `handleMissionServeNext` /
  `exitMissionToFree`）が両方のreducerへ同時にdispatchすることで協調させる。

```
GameState (canonical: 今作っている1枚)        MissionState (canonical: 今のMission run)
  order / recipe / pizza / dex /                mode: FREE|INTRO|PLAYING|RESULT
  ownedIngredientIds                             clock: { startedAt, endsAt } | null
                                                  metrics: { servedCount, totalQualityScore,
                                                             bestQualityScore }
```

`gameReducer`への追加は2アクションのみ（`MISSION_NEXT_ORDER` / `MISSION_RESET_ORDER`）。
どちらも既存の`nextOrderState`から切り出した`buildOrderState`（新しいORDER状態を作る、
pizza/score/bakeState/hint/placementをリセットする唯一の場所）を共有しているため、
「フレッシュなラウンドが何をリセットするか」がFree/Missionの2経路で決してズレない。

## Timer semantics

`src/mission/lunchRush.ts`の`MissionClock`は`{ startedAt, endsAt }`という**絶対時刻**
（epoch ms）のペアで、`remaining -= 1`のような減算カウンタを正典にしていない。

```ts
export function remainingMs(now: number, clock: MissionClock): number {
  return Math.max(0, clock.endsAt - now);
}
```

- `remainingMs`/`remainingSeconds`は毎回`endsAt - now`から算出するため、tickが遅延・
  スキップされても（バックグラウンドタブのスロットリング等）次のtickの`Date.now()`が
  そのまま正しい残り時間になり、誤差が蓄積しない。
- 常に`Math.max(0, ...)`でクランプするため、残り時間が負になることはない
  （`remainingMs`/`remainingSeconds`いずれもunit testで確認）。
- `App.tsx`は1本の`setInterval`（250ms間隔）のみを使い、tickごとに
  `missionDispatch({ type: "TICK", now: Date.now() })`する。productionで大量の
  `setTimeout`を使うことはない。
- ORDER/PREPARE/BAKE/RESULTのどのフェーズでもこのintervalは止まらないため、
  「どのフェーズも時間消費対象」という要件をコード上の特別分岐なしに満たす。
- 時間切れの検知は`missionRunReducer`の`TICK`ケースが担い、`mode !== "PLAYING"`なら
  即座に何もしない（一度`RESULT`へ遷移した後の連続TICKは全て同一の状態参照を返す）ため、
  **二重終了は構造的に起こらない**（`lunchRush.test.ts`の
  「TICK expiration is a one-shot transition」で確認）。
- 「安全なタイミングで遷移する」の実装方針: 時間切れを検知した瞬間、現在フェーズが
  ORDER/PREPARE/BAKE/RESULTのどれであっても即座にMission Result overlayをフルスクリーンで
  被せる。裏の`GameState`はそのまま凍結され、クラッシュや二重ダイアログは発生しない
  （`もう一度`/`フリープレイへ`が裏のGameStateを明示的に作り直す）。「フェーズ境界まで待つ」
  という早期打ち切り回避は今回採用していない — 詳細はKnown issues参照。

## Mission config

```ts
export const DEFAULT_MISSION_DURATION_SECONDS = 180;
export const DEFAULT_MISSION_CONFIG: MissionConfig = { durationSeconds: 180 };
```

- `MissionConfig { durationSeconds: number }`はconfigとして完全に外部注入可能。
- production（`App.tsx`の`resolveMissionConfig`）は常に`DEFAULT_MISSION_CONFIG`（180秒）を
  使う。
- 唯一の例外は`import.meta.env.DEV`でガードされた`?missionDuration=`URLパラメータ
  （dev serverのみ有効）。Viteが`import.meta.env.DEV`をproduction buildで静的に`false`へ
  置き換えるため、このブランチごとproduction bundleからdead-code除去される
  （on-screenのUIコントロールは一切無い＝禁止されている「production debug UI」には
  当たらない）。テストでは`missionRunReducer`の`START`アクションに直接
  `config: { durationSeconds: N }`を渡すだけで短時間化できる。

## Order selection

`src/mission/lunchRush.ts`の`pickMissionOrder`は既存の`getNextOrder`
（`src/data/orders.ts`, Phase 3C-3で実装済み）をそのまま再利用する薄いラッパー。

```ts
export function pickMissionOrder(
  availableRecipeIds: readonly RecipeId[],
  excludeRecipeId?: string,
): Order {
  return getNextOrder({ availableRecipeIds: [...availableRecipeIds], excludeRecipeId });
}
```

- **available filter**: `state/progression.ts`の`availableRecipeIds(ownedIngredientIds)`を
  経由するため、Free playと全く同じavailability規則（現在は6レシピ全てStarter Setなので
  常にavailable）に従う。
- **同じrecipeの連続回避**: `dex`を渡さないため`getNextOrder`内部の「undiscovered優先」
  フィルタが事実上no-opになり（空配列に対する`!dex.includes(...)`は常にtrue）、
  「availableプール内で一様ランダム、かつ直前と同じrecipeは(他に選択肢があれば)避ける」
  という自然なローテーションになる。Dex未発見優先を強制していない。
- **0 available safe behavior**: `getNextOrder`の既存fallback
  （`availableRecipeIds`が空/実在しないIDのみでも全ORDERSにフォールバック、Phase 3C-3で
  実装済み）をそのまま継承。
- Mission用の新しいランダムシステムは実装していない（既存ロジックの再利用のみ）。

## Pizza making / Serve flow

- Sauce Painting・チーズ/トッピング配置・焼成ゲージ・★1〜5採点は完全に既存コンポーネント
  （`PizzaStage`/`IngredientTray`/`BakeOverlay`）と`scorePizza`（`src/logic/scoring.ts`）を
  そのまま使う。Mission専用の簡略ピザ作成engineは実装していない。FREEとMISSIONで採点
  ロジックの分岐は一切無い。
- **圧縮RESULT**: Mission中のRESULTフェーズは`MissionServePanel`
  （★・点数・「+1 SERVED (N)」・「次の注文へ」ボタンのみ）を表示し、Free playの
  `ResultPanel`（採点内訳バー・「レシピ図鑑に登録する」ボタン）やTeto/Blueの長い
  RESULTダイアログは表示しない。
- **DISCOVERED overlayをスキップ**: 「次の注文へ」は`gameReducer`の新アクション
  `MISSION_NEXT_ORDER`をdispatchする。これは既存`REGISTER_TO_DEX`と全く同じDex登録
  （初回発見・BEST更新・timesMade++）を行った**直後に**、DISCOVEREDへ遷移せず直接次の
  ORDERへ進む。Dex登録自体は毎回行われ、`justDiscovered`/`justGotNewBest`はMission UIでは
  表示しない（テンポ優先）が、Dexへの反映自体は通常と全く同じ。

## Mission score

`src/logic/missionScoring.ts`にpure functionとして実装:

```ts
export function missionScore(metrics: MissionMetrics): number {
  return Math.round(metrics.servedCount * 100 + metrics.totalQualityScore);
}
```

指示の例（4枚提供・品質合計342 → 742pts）をそのままunit testの期待値にしている
（`missionScoring.test.ts`）。Pizza Quality（`ScoreBreakdown.total`/`.stars`,
1枚の0-100点）とMission Score（1 run合計）は型・関数どちらのレベルでも完全に別物として
扱い、混同していない。

`MissionMetrics { servedCount, totalQualityScore, bestQualityScore }`が最小構成。
`averageQualityScore`はderived（保存しない）。今回comboは実装していない
（指示の「最小構成を優先」に従い見送り — Known issues参照）。

## Mission BEST

- Phase 3C-2で予約されていた`PersistentSaveV1.missionBest`フィールド（当時は
  `Record<string, unknown>`で未使用）を、本フェーズで初めて実際に読み書きする。
  型を`Record<string, number>`に絞り込み、mission id（`LUNCH_RUSH_MISSION_ID = "lunch-rush"`）
  をキーにしたスコアのrecordとして正式運用する。
- `persistMissionBest(missionId, score)`はDex BESTと同じ「下がらない」ルール
  （`isNewMissionBest`で判定）で、新記録の時だけ書き込む。
- `schemaVersionはbumpしていない`（`1`のまま）— フィールドの**形**（record keyed by
  mission id）はPhase 3C-2時点から変わっておらず、内容の検証・読み書きを今回追加した
  だけのため。
- Mission Result画面の「NEW BEST!」表示は、run開始時点でロードした
  `missionBestAtStartOfRun`（stateとして保持、run中は更新しない）と、run終了時の
  `missionScore(metrics)`を比較して決める。

## Persistence

| 種別 | 内容 |
|---|---|
| **Mission終了後に保存** | `missionBest["lunch-rush"]`（Mission Score BEST, 単調増加） |
| **Mission中は保存しない** | `MissionState`全体（mode/clock/metrics）— React state
  のみに存在し、`localStorage`へ書き込む経路がどこにも無い |
| **既存通り保存** | `dex`（BEST/timesMade, Mission中のプレイも含めて更新される） |

- リロード時、`App.tsx`の`useReducer(missionRunReducer, INITIAL_MISSION_STATE)`は常に
  `mode: "FREE"`から始まる（永続化された`MissionState`を読み込む経路が存在しないため、
  これは「実装漏れ」ではなく構造的に保証される）。`GameState`自体も既存通りラウンド
  途中を永続化しないため、Mission途中でリロードしても**必然的に**通常ORDERへ戻る。
- 明示的な「フリープレイへ」ボタンも同様に`PLAY_AGAIN`（既存アクション）をdispatchして
  `GameState`をクリーンなORDERへ戻す。

## Dex integration

- `MISSION_NEXT_ORDER`は`REGISTER_TO_DEX`と同一の`registerScoreToDex`
  （`src/state/dex.ts`, 無変更）を呼ぶため、Mission中に初めて作ったレシピもDexへ登録され、
  BEST/timesMadeも通常と全く同じルールで更新される。
- Dexの永続化（`persistDex`, 既存の`useEffect`）はMission中も無変更で動作する
  （`state.dex`が変わるたびに発火する既存のeffectがそのまま拾う）。

## Entry / UX

- ORDER画面のaction-rowに、既存の「ピザを作る！」ボタンを`🍕 フリープレイ`に改名し
  （dispatch先は無変更のBEGIN_PREPARE）、隣に小さな`⏱ Lunch Rush`ボタンを追加した
  （`mission.mode === "FREE"`の時のみ表示）。新しい巨大なHome画面は追加していない。
- Mission Intro / Mission Result は`DexOverlay`と同じ`position: absolute; inset: 0`の
  フルスクリーンoverlayパターンを踏襲。
- Mission中は`MissionHud`（残り時間 + 提供数）をヘッダー直下に常時表示。

## Tests

`npm test`:

```
 Test Files  10 passed (10)
      Tests  145 passed (145)
```

既存91テストは無変更のまま全てpass。新規54テストの内訳:

### `src/mission/lunchRush.test.ts`（24件）
- MissionConfigのデフォルト値（180秒）
- `startMissionClock`/`remainingMs`/`remainingSeconds`の計算、丸め、0クランプ
- `isMissionExpired`の境界値
- `pickMissionOrder`: availableプール限定、直前recipe回避、プールが1件の時のfallback、
  空プールでもクラッシュしない、undiscovered優先を強制しない
- `missionRunReducer`: 初期状態、SHOW_INTRO、START（任意のmodeから、retryも含め
  metricsがリセットされる）、SERVE（PLAYING中のみ有効）、TICK（時間内はno-op、
  期限切れで一度だけRESULTへ遷移、以降のTICKは無反応=二重終了防止）、EXIT_TO_FREE

### `src/logic/missionScoring.test.ts`（13件）
- `recordServe`によるservedCount/totalQualityScore/bestQualityScoreの蓄積、非破壊性
- `averageQualityScore`の0除算回避
- `missionScore`のSSOT公式一致（4枚・342点 → 742pts）、四捨五入、1枚のみの高得点より
  複数枚の方が高スコアになりうることの確認
- `isNewMissionBest`のBEST判定（同点は更新しない）

### `src/state/gameReducer.test.ts`（追加7件、"Mission order actions"）
- `MISSION_RESET_ORDER`: 任意フェーズ（PREPARE中も）から呼べる、直前recipeを連続で
  選ばない、availableプール外を選ばない
- `MISSION_NEXT_ORDER`: RESULT以外ではno-op、Dex登録+DISCOVEREDスキップ、repeat playで
  BEST更新、2回連続dispatchしても1回しか登録されない（atomicity）

### `src/state/persistence.test.ts`（追加11件、"Mission BEST"）
- fresh player/未記録missionは0、書き込み後の読み込み、単調増加（下がらない）、
  mission id毎の独立性、他フィールドの保持、storage例外時のno-throw、負数/小数/文字列/
  nullの値のsanitize、非オブジェクトmissionBestのfallback

## 390×844 browser verification (Playwright / Chromium)

`/opt/pw-browsers/chromium`を使い、390×844のビューポートで`npm run dev`起動中のアプリを
実際に操作して確認（console/page error監視、`scrollWidth <= clientWidth`によるoverflow
判定つき、全チェックで自動アサーション）。検証用の一時スクリプトはコミットに含めていない
（devサーバーでの手動確認用途のため）。

1. **FREE playが従来通り動く**: ORDER→（フリープレイ）→PREPARE→（Sauce Painting含む
   配置）→BAKE→RESULT→「レシピ図鑑に登録する」→DISCOVERED→「もう一度作る」→次のORDER、
   の一連が問題なく動作。
2. **Lunch Rush入口**: ORDER画面に「🍕 フリープレイ」「⏱ Lunch Rush」の2ボタンが並び、
   390px幅に収まることを確認。
3. **Mission説明**: 「⏱ Lunch Rush」タップで`LUNCH RUSH`説明overlay（「制限時間◯秒/分
   以内にできるだけ多くのピザを提供しよう！」+「スタート」+「閉じる」）を確認。
4. **Mission開始**: 「スタート」でHUD（残り時間+提供数）が現れ、ORDER画面へ。
5. **timer表示**: HUDが250ms間隔で滑らかに更新されることを確認。
6-10. **注文→Sauce Painting→topping→bake→★結果**: 既存のPREPARE/BAKE操作がMission中も
   完全に同一UIで動作し、RESULTでは`MissionServePanel`（★・点数・「+1 SERVED (N)」）が
   出ることを確認。
11. **次の注文**: 「次の注文へ」でDISCOVERED画面を経由せず即座に次のORDERへ遷移することを
    確認。
12. **2枚以上連続提供**: 自動操作で1 run（40秒のdev短縮設定）あたり最大37枚のピザを連続で
    提供できることを確認（テンポの良さの直接的な証拠）。
13. **時間終了**: タイマー切れで安全にMission Result overlayへ遷移（PREPARE中の切れも
    含め、クラッシュ・console errorなし）。
14. **Mission Result**: 「LUNCH RUSH RESULT」+ 提供枚数/平均/BEST/SCORE + 「NEW BEST!」
    表示を確認（例: 提供37枚・平均50点・BEST59点・SCORE 5538）。
15. **Retry**: 「もう一度」でmetricsが0にリセットされた新runが始まることを確認
    （retry直後のRESULT: 提供0枚・SCORE 0）。
16. **FREEへ戻る**: 「フリープレイへ」で通常ORDER（2ボタン表示）へ戻ることを確認。
17. **DexにMission結果が反映**: Mission中に作った全レシピがDexへ登録され、
    `🏆 6/6`・`合計★10`・各レシピのBEST/times作成数が正しく表示されることを確認。
18. **reload後Dex維持**: リロード後もDex 6/6・合計★が維持されることを確認。
19. **Mission BEST維持**: `localStorage`の`teto-pizza-save-v1.missionBest`に
    `{"lunch-rush": 5538}`が保存され、リロードをまたいで維持されることを確認。
20. **console error 0**: 全シナリオ（FREE play一巡+Mission 2 run+リロード）を通して
    console/page error 0件。
21. **horizontal overflowなし**: 全チェックポイントで`scrollWidth <= clientWidth`を確認。

```
=== SUMMARY ===
console errors: none
page errors: none
overflow findings: none
ALL CHECKS PASSED
```

## FREE play regression

- 6 Starter recipes・13 Starter ingredients・Sauce Painting・FTU sauce auto-select・
  ★1〜5採点・Dex BEST・timesMade・totalStars・persistence・recipe availability・
  undiscovered-priority FREE order・raw/perfect/burnt・Teto/Mito/Blue・6/6・NEW・
  「もう一度作る」は全て無変更（既存91テスト + 今回のbrowser verificationで確認）。
- ORDER画面の唯一の見た目変更は、既存の単一CTAボタンが「🍕 フリープレイ」への改名+
  隣に「⏱ Lunch Rush」が増えたことのみ。dispatch先（`BEGIN_PREPARE`）は無変更。

## Known issues

- **P2**: 時間切れの遷移は「フェーズ境界を待つ」のではなく「検知した瞬間に即座に
  Mission Resultへ遷移する」方式を採用した。PREPARE/BAKE中にタイマーが切れた場合、
  その時点で作りかけのピザはMission Scoreに一切カウントされない（安全・クラッシュなし
  だが、「BAKE中に切れた1枚をどう扱うか」の演出面は今回追求していない）。RESULT画面
  （`MissionServePanel`）表示中に切れた場合も同様（その1枚を「次の注文へ」で確定する
  前に切れると、その1枚はカウントされない）。指示の「安全なタイミングで遷移」は満たすが、
  「切れる直前のBAKE演出」のようなUX磨き込みは対象外とした。
- **P2**: combo（連続高品質ボーナス）は指示どおり最小構成を優先し実装していない。
- **P2**: `MissionServePanel`は`ResultPanel`の内訳バー（具材/配置/焼き）を持たない
  （指示の「テンポよく圧縮」を優先した意図的な省略）。
- **P2**: Mission entry ボタンはORDER画面かつ`mission.mode === "FREE"`の時のみ表示する。
  PREPARE/BAKE/RESULT中にMissionへ入る導線は無い（指示の「ORDER画面等の自然な位置」に
  沿った設計判断）。
- Pitz獲得・Pitz UI・Shop・Recipe #7・salami・inventory quantity・複数Mission・
  Mission map・経営要素・leaderboardは本フェーズの非スコープであり未実装（意図通り）。

P0/P1: 0件。

## Final Verdict

**A. READY TO MERGE**

- スコープ（Lunch Rush 1ミッションの実装のみ）を逸脱していない。Pitz・Shop・Recipe #7等
  非スコープ項目は一切追加していない。
- 既存5フェーズ状態機械（ORDER/PREPARE/BAKE/RESULT/DISCOVERED）・既存6レシピ・既存13食材・
  既存採点ロジック・既存persistenceスキーマを破壊していない（実機・単体テスト両方で
  FREE play regressionを確認済み）。
- Mission state（`MissionState`）とGameState（round in progress）の境界が明確で、
  二重管理になっていない。
- Timerはdrift耐性のある絶対時刻方式、単一interval、二重終了防止を単体テストで
  確認済み（fake clock、実際のブラウザ待機は不要）。
- schemaVersionをbumpせずにMission BESTの永続化を追加（既存フィールドの形を維持）。
- lint / test / build すべてグリーン（145/145テスト、既存91件を維持しつつ新規54件追加）。
- 390×844実機確認で指定21項目（FREE regression・Mission入口〜Result〜Retry〜Exit〜
  reload〜Dex反映・console/page error 0件・overflowなし）を確認済み。
- P0: 0件 / P1: 0件。残るKnown issuesはいずれもP2（ブロッカーなし）。
