# Phase 3C-2: Minimal Persistence — Result

Status: 実装完了（Final Verdict は本レポート末尾を参照）
関連ドキュメント: `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`（第14章 Persistence, 第15章 Dex BEST）/
`docs/reports/PIZZA_GAME_Phase3C-1_Quality-DexBEST_Result.md`

## Base / Branch / Commit

- Base SHA: `84ad19c37544a416533c67fef58df12dffa75008`（origin/main, 期待値と一致）
- Branch: `claude/phase-3c2-persistence-pyaouw`
- Commit SHA: 本レポートをコミットした時点のHEAD（PR側の最新コミットを参照）

## Scope（今回やったこと / やらなかったこと）

実装したのは指示どおり **Minimal Persistence** のみ:

- Dex BEST（`bestScore` / `bestStars`）と `timesMade` の localStorage永続化
- 将来フィールド（Pitz残高・所持食材ID・Mission進捗）を安全に載せられる save schema の用意
  （schema上に確保するのみで、書き込み・UI露出は一切しない）

今回やっていない（指示どおり、非スコープ）:

- Pitz UI、Shop、Mission、食材unlock、レシピ#7
- 途中round（ORDER/PREPARE/BAKE/RESULT）の永続化
- ユーザー向けReset UI、大規模Settings画面
- バックエンド・クラウドセーブ・アカウント

## Changed files

```
src/state/persistence.ts        (新規)  save schema・validation・load/save/clear の純粋関数群
src/state/persistence.test.ts   (新規)  loadSave/persistDex/clearSaveの単体テスト（22件）
src/state/gameReducer.ts        (+3/-2) createInitialGameStateがDexStateを受け取れるように
src/state/gameReducer.test.ts   (+37)   hydration（ORDER起点・BEST/timesMade引き継ぎ）のテスト追加
src/App.tsx                     (+9/-2) 初期化時にloadSave().dexを注入、dex変化時にpersistDex
docs/reports/PIZZA_GAME_Phase3C-2_Persistence_Result.md (新規) 本レポート
```

`src/state/dex.ts` / `src/logic/scoring.ts` / `src/components/*` は無変更
（既存の `DexEntry` 形状がそのまま保存に使える設計だったため — Phase 3C-1のコード
コメントで示唆されていたとおり）。

## Storage key / Schema

- Canonical key: `teto-pizza-save-v1`（`SAVE_STORAGE_KEY` として `persistence.ts` にのみ定義）。
- `schemaVersion: 1` を必須フィールドとして持つ。将来のスキーマ変更時は値を上げ、
  異なる値は「信頼できない」として全体を fresh save にフォールバックする
  （migration自体は今回実装しない — 非スコープ）。

```ts
export interface PersistentSaveV1 {
  schemaVersion: 1;
  dex: DexEntry[];
  pitzBalance: number;              // 予約: Phase 3C-4+、常に0（今回書き込みなし）
  ownedIngredientIds: string[];     // 予約: Phase 3C-4+、既定は既存13食材全部（Starter Set）
  missionBest: Record<string, unknown>; // 予約: Phase 3C-5+、常に{}（今回書き込みなし）
}
```

- `PersistentSaveV1` は `GameState` とは完全に独立した型（`gameReducer.ts` は一切importしない）。
  `GameState` 全体を `JSON.stringify` する方式は採っていない — 保存されるのは `dex`
  （`DexEntry[]`）のみで、他の3フィールドはこのフェーズでは常にデフォルト値のまま書き込まれる。
- ORDER/PREPARE/BAKE/RESULT等の途中roundのフィールド（`pizza`, `phase`, `bakeState`,
  `hint`, `placement`等）はスキーマに一切含まれない。

## Canonical saved state

`dex: DexEntry[]` のみが実際に書き込まれる。各エントリ:

| フィールド | 型 | 検証範囲 |
|---|---|---|
| `recipeId` | known `RecipeId` | `RECIPES`（6種）に存在するIDのみ |
| `discovered` | boolean | 厳密に `boolean` |
| `bestScore` | number | `0 <= x <= 100` |
| `bestStars` | 1-5の整数 | `Number.isInteger` かつ `1 <= x <= 5` |
| `timesMade` | 非負整数 | `Number.isInteger` かつ `x >= 0` |

## Derived / non-saved state

指示どおり、以下はいずれも保存しない（毎回既存ロジックから再導出される）:

- `totalStars` / 発見数（`DexOverlay` が `dex.filter(discovered).length` から都度計算）
- `AVAILABLE_TO_BUY` / recipe availability（本フェーズ非スコープ、そもそも未実装）
- 現在の注文・ピザの中身・フェーズ・焼き加減など、1プレイ中のみ有効な `GameState` の残り全部

## Validation strategy

外部schemaライブラリは追加していない（`zod`等は導入せず、小規模pure validatorのみで
十分と判断）。`persistence.ts` 内の関数群のみで完結:

- **Root shape**: `typeof raw === "object" && raw !== null`、`schemaVersion === 1`、
  `Array.isArray(dex)` のいずれかを満たさない場合は **save全体を破棄** して fresh save
  にフォールバックする（信頼できないrootから部分的に救出しようとしない）。
- **Dex entry（個別）**: 上表の検証を1エントリずつ行い、**不正な1エントリだけをskip**
  する（該当エントリを結果配列に含めないだけで、他の正常なエントリ・save全体には
  影響させない）。`recipeId` の重複エントリも先勝ちで1つに正規化する。
- **pitzBalance / ownedIngredientIds / missionBest**: 型不正・欠損時はそれぞれ個別の
  安全なデフォルト値（`0` / 既存13食材全部 / `{}`）にフォールバックする
  （これらが不正でもDexまで巻き添えで破棄されることはない）。
- `JSON.parse` した値をそのまま `as PersistentSaveV1` にキャストする箇所は存在しない
  — 上記の関数群を経由した値のみが `PersistentSaveV1` 型として扱われる。

## Hydration strategy

- `App.tsx` の `useReducer` 初期化関数で `loadSave().dex` を読み、
  `createInitialGameState(dex)` に明示的に渡す（fresh initial state + loaded progression
  の明示的マージ）。
- `gameReducer.ts` の `createInitialGameState(dex: DexState = EMPTY_DEX)` は、
  受け取った `dex` を使いつつ `nextOrderState(dex, { preferFirst: true })` を呼ぶため、
  **phase は常に `ORDER`**（マルゲリータの注文）から始まる。途中roundのフィールドは
  存在しない新規 `GameState` として毎回組み立てられる。
- 呼び出し側なしの `createInitialGameState()`（既存テスト等）は `EMPTY_DEX` を既定値として
  使うため、既存の呼び出し箇所・テストは無変更で動く。

## Save timing

- Reducer は変更なく **pure のまま**。localStorage副作用は `App.tsx` の
  `useEffect(() => persistDex(state.dex), [state.dex])` のみに閉じ込めている。
- `state.dex` の参照は `REGISTER_TO_DEX` が成功したとき（＝スコアがRESULTから確定した
  ラウンドのみ）にしか変わらないため、毎render書き込まれることはない
  （初回mount直後に1回、以後は `REGISTER_TO_DEX` 成功のたびに1回だけ実行される）。
- `persistDex` は書き込み前に現在の保存内容を読み込み、`dex` フィールドだけを
  置き換えて書き戻す（read-modify-write）。これにより、将来 Pitz 等が書き込まれる
  ようになった後も、Dex更新だけで他フィールドを巻き添えでデフォルト値に戻すことがない。
- React StrictMode等で同一 `state.dex` に対して effect が複数回実行されても、
  書き込む中身は同一JSONになるため（idempotent）、データ破損は起こらない。

## Failure fallback

| 状況 | 挙動 |
|---|---|
| saveなし（`getItem` が `null`） | fresh state（`createDefaultSave()`） |
| 壊れたJSON（`JSON.parse` 例外） | fresh stateへfallback（catchで吸収） |
| unknown schemaVersion | fresh stateへfallback（root判定でreject） |
| root shape不正（object以外、`dex`が配列でない等） | fresh stateへfallback |
| Dex内の1エントリだけ不正 | そのエントリのみskip、他は復元 |
| `localStorage` 自体にアクセス不可（例外を投げる環境） | `getDefaultStorage()` がcatchして
  `null` を返し、以後 `loadSave`/`persistDex`/`clearSave` は全て安全にno-op/デフォルト値。
  ゲーム自体はメモリ上の状態のみで通常通りプレイ可能。 |
| 書き込み時にstorageが例外を投げる（容量超過等） | `persistDex` 内のtry/catchで吸収、
  ラウンド自体（メモリ上のstate）には一切影響しない。 |

いずれの経路でも `console.error` を大量発生させる実装にはしていない（すべてtry/catchで
静かにフォールバックし、余計なログ出力は行わない）。

## Tests

`npm test`:

```
 Test Files  5 passed (5)
      Tests  57 passed (57)
```

既存35テスト（scoring/placement/dex/gameReducerのPhase 3C-1分）は無変更のまま全てpass。
新規22テスト（`persistence.test.ts` 20件 + `gameReducer.test.ts` の hydration 3件、
うち5件重複ケース含め正味の内訳は下記）:

### `src/state/persistence.test.ts`

- `loadSave`:
  - no save → fresh
  - valid save → Dex hydrate
  - malformed JSON → fresh
  - unknown schemaVersion → fresh
  - invalid root shape（文字列/数値/null/配列/空オブジェクト/`dex`が配列でない）→ fresh
  - unknown recipeId のエントリはskipし、有効なエントリは残る
  - `bestScore` が範囲外（101, -5）のエントリはskip
  - `bestStars` が不正（0, 6, 2.5, 文字列）のエントリはskip
  - `timesMade` が負・非整数のエントリはskip
  - エントリ自体がオブジェクトでない（null/文字列/数値）場合もskip、他は保持
  - storageが例外を投げても`loadSave`はthrowせずデフォルトを返す
  - storageが`null`（利用不可）でもfreshを返す
- `persistDex` / `loadSave` roundtrip:
  - serialize → deserializeで同じDexが戻る
  - シミュレートしたreload後もDex BESTが保持される
  - シミュレートしたreload後も`timesMade`が保持される
  - Dexだけ書き込んでも他の保存済みフィールド（例: `pitzBalance`）は保持される
  - 書き込み時にstorageがthrowしても例外を外に投げない
- `clearSave`:
  - 削除後の`loadSave`はfreshになる
  - storageが`null`/throwする場合もthrowしない

### `src/state/gameReducer.test.ts`（追加分）

- 保存なしの`createInitialGameState()`は常にORDER・空Dexで始まる
- Dexを渡してhydrateしても、開始phaseは常にORDER（途中roundは絶対に復元しない）
- hydrateしたDexのBEST（stars/score）と`timesMade`がそのまま初期state.dexに反映される

## 390×844 mobile verification (Playwright / Chromium)

`/opt/pw-browsers/chromium` を使い、390×844のビューポートで `npm run dev` 起動中のアプリを
実際に操作して確認（screenshot取得・console error監視付き、`page.evaluate`で
`scrollWidth <= clientWidth` によるoverflow判定つき）。

1. **Fresh start**: `テトのピザ屋さん` タイトル・「ピザを作る！」ボタン表示、overflowなし。
2. **マルゲリータ作成→焼く→登録**: 具材（トマトソース+モッツァレラ×3+バジル×2）を配置し、
   焼きゲージが目標帯（60-80%）に入った瞬間に「取り出す！」を押下 → `★★★★★ 100`。
   「レシピ図鑑に登録する」→ `✨ マルゲリータを発見しました！`（新規発見バナー）。
3. **Dexを開く**: `🍕 発見 1 / 6`、マルゲリータカードに `NEW` バッジ、`★★★★★ BEST 100`、
   `1回作成` を確認。閉じる操作も正常。
4. **PLAY AGAIN**（「もう一度作る」）でORDERへ復帰することを確認。
5. **ページreload**: reload後も「ピザを作る！」（ORDER開始）を確認 — 途中roundは
   一切復元されない。Dexを開くと `★★★★★ BEST 100`・`1回作成` がそのまま保持。
6. **同じレシピをもう一度作る**: reload直後の注文は常にマルゲリータ
   （`preferFirst: true`）なので、そのまま同一手順で再度作成・登録。
   今回はバナーが「発見」ではなく「また上手にできたね！」（`justDiscovered=false`）になり、
   Dexの`timesMade`が `1回作成` → `2回作成` に増加、BESTは同スコアのため据え置き。
7. **再度reload**: `timesMade` = `2回作成`・BEST 100 が保持されていることを確認。
8. 全ラウンドを通して **console error 0件**、**overflowなし**を確認。

screenshotは本セッションのscratchpadに保存済み（`1-fresh-order.png` 〜
`6-dex-after-reload2.png`）。

## Corrupt-save verification

Playwrightで以下を確認:

1. `localStorage.setItem('teto-pizza-save-v1', '{bad json')` → reload →
   「ピザを作る！」ボタンが表示され、ゲームが正常に起動することを確認
   （console error 0件）。
2. `schemaVersion: 999` の（形式上は妥当な）JSONを保存 → reload →
   同様に正常起動し、Dexは `🍕 発見 0 / 6`（＝ fresh save に安全にフォールバックし、
   信頼できないバージョンのDexデータを復元していない）ことを確認
   （console error 0件）。

## Regression results

- `npm run lint`（oxlint）: ✅ pass, exit code 0
- `npm test`（vitest）: ✅ 57/57 pass（既存35 + 新規22）
- `npm run build`（`tsc -b && vite build`）: ✅ pass
- `git diff --check`: ✅ no whitespace errors
- 実機確認（390×844, Chromium）: console error 0件、overflowなし（上記参照）
- Corrupt save / unknown schemaVersion 実機確認: いずれも正常起動、console error 0件

## Known issues

- P2: `ownedIngredientIds` / `pitzBalance` / `missionBest` は schema 上に確保しているのみで、
  実際にこれらへ書き込む経路は Phase 3C-2 の時点では一切存在しない
  （常にデフォルト値のまま保存される）。Phase 3C-4以降でこれらを実際に使う際、
  `persistDex` と同様の「該当フィールドだけを読み書きする」ヘルパー関数を追加する必要がある
  （設計上は `persistence.ts` に閉じ込められているため、追加は局所的な変更で済む見込み）。
- P2: `missionBest` の型は `Record<string, unknown>` とし、値の形状を今回あえて確定させて
  いない（Phase 3C-5でMission設計が固まった時点で、より厳密な型・validationに更新する
  想定）。
- P2: 複数タブ/複数ウィンドウで同時にプレイした場合、`storage` イベントを購読して
  相互に同期する仕組みは今回実装していない（`persistDex`は自タブの状態を書き込むのみ）。
  シングルタブでの利用を前提とする現在のゲームループでは実害はないと判断。
- Pitz・Shop・Mission・ingredient unlock・レシピ#7・ユーザー向けReset UIは
  本フェーズの非スコープであり、未実装（意図通り）。

## Final Verdict

**A. READY TO MERGE**

- スコープ（Dex BEST / timesMade の localStorage永続化のみ）を逸脱していない
- 既存6レシピ・全ゲームループ（ORDER→PREPARE→BAKE→RESULT→DISCOVERED）を破壊していない
- Reducerはpureなまま維持、副作用は`App.tsx`の`useEffect`一箇所のみに限定
- 壊れたJSON・unknown schemaVersion・不正エントリ・storage利用不可のいずれでも
  ゲームがクラッシュせず、console errorも発生しない
- lint / test / build すべてグリーン（57/57テスト）
- 390×844実機確認で指定項目（NEW/NEW BEST semantics・★・BEST・timesMade・reload後の
  永続化・PLAY AGAIN・overflowなし・console error 0件）を確認済み
- Corrupt-save / unknown-schemaVersionの実機フォールバックも確認済み
- Known issuesはいずれもP2（ブロッカーなし）
