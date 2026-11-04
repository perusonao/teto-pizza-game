# Cooking Steam Phase 1 — 実装計画（S1 詳細設計 / S2〜S4 / 依存 / HV 比較基準）— docs-only

作成: 2026-11-02 / 基準 `main` = `cfbb083`（#725）/ ブランチ `claude/teto-pizza-cooking-research-d2tbgv` / 管理 Issue **#726**
親: `docs/reports/TETO_COOKING-METHODS-NEXT_Research.md`（以下「Research」）
性質: **計画のみ。** `src/**`・`e2e/**`・CSS・データ・テスト・PR・Preview・Production は変更していない。数値はすべて **PROVISIONAL**（初期の設計値。実機 HV で調整する）。

---

## 0. Owner 決定（2026-11-02）の反映

| 決定 | 本計画での扱い |
|---|---|
| 「蒸す」採用、対象は clam / mussel | `STEAM_TARGET_INGREDIENT_IDS = ["clam", "mussel"]`（§2.1） |
| 既存3レシピ（vongole / new-haven-apizza / pescatore）で Preview/DEV 限定の実験 | 新レシピ・新食材なし。`?cookSteam=on` の opt-in のみ（§2.6）。本番フラグ `STEAM_EXPERIENCE_PRODUCTION = false` |
| 必須工程・採点・識別・保存は不変 | transient な `steamedLook` のみ。journal・Save・scoring・signature・Hint は読まない（§4 architecture test） |
| 操作 A（ふたをタップ）／B（鍋を左右にゆする）の比較 | 同じ結果型を返す2つの状態機械（§2.3 / §2.4）。比較基準は §6 |
| 見た目は CSS 優先 | 置いたピースは `filter` 系の CSS 変数のみ。`IngredientGlyph.tsx` の SVG は変更しない。殻が「開く」表現は**ステージ内の専用画面（新規ファイル）**で描く（§2.5） |
| 独立実装・一般化しない | 炒め（`logic/prep`）・炙り（`logic/sear`）と**コードを共有しない**。第3の独立した複製として作る（§4.2 で相互参照禁止をテスト化） |
| 揚げる・煮込む・新規レシピは対象外 | 触れない |
| **A（炙り Production ON）が最優先、HOT file を今は触らない** | S1 は新規ファイルのみ。`gameReducer.ts` / `GameScreen.tsx` / `App.tsx` / `PizzaStage.tsx` に触れるのは S2 以降で、A の merge 後（§5） |

---

## 1. 着手前の再確認（2026-11-02 時点の事実）

| 項目 | 結果 |
|---|---|
| main | `cfbb083`（#725）から**動いていない**（`git fetch` で本ブランチとの差は本書の追加分のみ） |
| open PR | 20 件超（古い docs PR が大半）。**蒸し・炙り・炒めに触れる PR は無い。** #725 は merged。A の「炙り Production ON」PR は**まだ存在しない**。C のレシピ拡張 Research も PR 化されていない。HOT file に触る古い PR は #581（`PizzaStage`）・#478（draft, `GameScreen`/`PizzaStage`）・#468（`PizzaStage`）のみ |
| open Issue | 蒸すの先行 Issue なし（重複検索 0 件）→ **#726 を新規作成** |
| claim | #724 に Sear の claim（最新 `expires 2026-11-16`、`files` に `searExperienceGate.ts`・`GameScreen.tsx`・`gameReducer.ts`・`App.tsx`・`PizzaStage.tsx` ほか）。A は Production ON で **`src/data/searExperienceGate.ts`（フラグ）と、場合により HOT 3 ファイル・Result 文書・HANDOFF** を触ると予想。**蒸すの claim は未投稿**（着手時 S0 で投稿） |
| A/C との重なり | S1 の予定ファイル（§3）は**すべて新規**で、A の `files` とも C の領域（recipes / ingredients 系）とも重ならない。S2 以降は A と HOT 3 ファイルで重なるため、**A の merge 後**に限る |

> A・C の PR/claim の実体は GitHub から確認できていない（A の Production ON は未着手と読める）。A が何を編集するかは**推測**を含むので、S0 で A の最新 claim/PR を必ず再確認する。

---

## 2. S1 詳細設計 — 純粋ロジック（新規ファイルのみ・未配線）

### 2.0 ファイル一覧（すべて新規。既存ファイルの編集ゼロ）

| ファイル | 役割 |
|---|---|
| `src/data/steamIngredients.ts` (+ `.test.ts`) | 対象規則 |
| `src/logic/steam/steamPot.ts` (+ `.test.ts`) | 共通の結果型・段階・文言・レベル→殻の数 |
| `src/logic/steam/steamLid.ts` (+ `.test.ts`) | 案 A の状態機械 |
| `src/logic/steam/steamShake.ts` (+ `.test.ts`) | 案 B の状態機械（往復ドラッグ＋タップ代替） |
| `src/logic/steam/steamedLook.ts` (+ `.test.ts`) | 置いたピースの CSS 変数（`filter` のみ） |
| `src/logic/steam/steamOffer.ts` (+ `.test.ts`) | ピルを出す条件（純粋） |
| `src/logic/steam/steamFixtures.ts` | テスト用の入力（`searFixtures.ts` と同型） |
| `src/preview/steamPreview.ts` (+ `.test.ts`) | `?cookSteam=on` / `?cookSteamVariant=` の解釈（純粋。配線は S3） |
| `src/data/steamExperienceGate.ts` | `STEAM_EXPERIENCE_PRODUCTION = false` と `steamExperienceEnabled()` |
| `src/logic/steam/steam.architecture.test.ts` | 読まれ方・独立性の固定 |

S1 は**どこからも import されない**ため、本番バンドルには入らない（tree-shaking。本番ビルドへの混入確認は S3 のゲートテストで行う）。

### 2.1 `steamIngredients.ts`
```ts
export const STEAM_TARGET_INGREDIENT_IDS: readonly string[] = ["clam", "mussel"];
export function canSteamIngredient(id: string): boolean // 対象リストにある かつ getIngredient(id)?.pieceVisual !== undefined
```
- 入力は食材 id のみ（レシピ・標的・モードを読まない = Anti-Oracle）。`ingredients.ts` は読むだけ。
- テスト: clam / mussel は true／`pieceVisual` が無いフィクスチャは false（休眠ガード）／beef・sausage・shrimp・未知 id は false／**炒め・炙りの対象リストと交わらない**（`prepIngredients` / `searIngredients` の定数を import して `intersection === ∅`。読み取りのみ）。

### 2.2 `steamPot.ts` — 共通の型と段階
```ts
export type SteamVariant = "lid" | "shake";
export const STEAM_SHELL_COUNT = 5;
export const STEAM_SHELL_THRESHOLDS = [0.30, 0.42, 0.54, 0.66, 0.78] as const; // 殻 i が開くレベル（決定論的・ばらつきなし）
export const STEAM_OVER_MS = 3000;       // レベルが 1 に達してからこの時間たつと「くたっと」
export type SteamLook = "closed" | "partial" | "open" | "over";
export interface SteamResult { amount: number /*0..1*/; openCount: number /*0..5*/; look: SteamLook; }
export function steamOpenCount(level: number): number   // 閾値以上の数。非有限は 0、範囲外はクランプ
export function steamLookOf(level: number, overMs: number): SteamLook
//   openCount===0 -> closed; 1..4 -> partial; 5 -> open; open かつ overMs >= STEAM_OVER_MS -> over
export const STEAM_LOOK_COPY: Record<SteamLook,string> // 描写のみ。評価語を使わない
//   closed:"まだ閉じてる" partial:"ちょっと開いた" open:"ぱっくり開いた" over:"くたっとしぼんだ"
export const STEAM_LOOK_LIVE: Record<SteamLook,string> // 蒸し中の短い語（ゲージ・数値・残り時間は出さない）
export function steamResultOf(level: number, overMs: number): SteamResult
```
設計の要点:
- **失敗状態なし**（4つの look はいずれも正解。`closed` もそのまま確定できる）。採点・合否・星に使わない。
- 殻の開き方は**レベルの純関数**（乱数なし）。HV で見た目を再現できる。
- 文言に「成功／失敗／ベスト」を使わない（炒めの early/best/overdone と区別。炙りと同じ「描写のみ」）。

テスト: `steamOpenCount` の境界（0.29→0, 0.30→1, 0.78→5, 1→5, NaN→0, 負→0, 2→5）／閾値が昇順・長さ5／look の遷移（open+2999ms→open、+3000ms→over）／`over` は `open` のときだけ／`STEAM_LOOK_COPY` に評価語（成功・失敗・ベスト・おしい・完璧）が無い／全 look に文言がある。

### 2.3 `steamLid.ts` — 案 A（ふた＋待つ＋開ける）
```ts
export const STEAM_LID_FULL_MS = 4500;   // ふたを閉めてから全殻が開く時間
export const STEAM_LID_MIN_MS  = 600;    // これより早く開けたら「閉じただけ」で何も残さない
export type SteamLid =
  | { status: "idle"; tooShort?: boolean }
  | { status: "steaming"; startedAt: number }
  | { status: "released"; result: SteamResult; elapsedMs: number };
export type SteamLidAction = {type:"CLOSE"; now:number} | {type:"OPEN"; now:number; fullMs?:number} | {type:"CANCEL"} | {type:"INTERRUPT"};
export function steamLidLevelAt(elapsedMs: number, fullMs = STEAM_LID_FULL_MS): number   // 0..1 線形
export function steamLidReducer(state: SteamLid, action: SteamLidAction): SteamLid
```
- `CLOSE`: idle のときだけ steaming（非有限の `now` は無視）。`OPEN`: steaming のときだけ。経過が `MIN` 未満・非有限・負（時計の逆行）は `{idle, tooShort:true}`。それ以外は `released`（`result = steamResultOf(level, overMs)`、`overMs = max(0, elapsed - fullMs)`）。`CANCEL`＝何も残さず idle。`INTERRUPT`＝steaming だけ idle に戻し、idle/released はそのまま（炙りの blur 対策と同じ）。
- 経過時間は呼び出し側が渡す `now` のみ（`Date.now()` を内部で読まない）。`fullMs` は Preview の比較用（炙りの `cookSearMs` と同型。S3 で配線）。
- テスト: 通常経路（CLOSE→OPEN）／二重 CLOSE 無視／idle で OPEN 無視／599ms は tooShort・600ms は released／全開で `look=open`、+3000ms で `over`／途中（2000ms）は partial でレベルが線形／`fullMs` 上書き／負・NaN・逆行／CANCEL・INTERRUPT／released 後の CLOSE は無視（1ラウンド1回の判断は reducer 側。S2）／**同じ入力列→同じ結果（決定論）**。

### 2.4 `steamShake.ts` — 案 B（鍋ゆすり）
```ts
export const STEAM_SHAKE_STROKE_MIN = 0.18;   // 1ストロークと数える最小の横移動量（鍋の幅に対する比）
export const STEAM_PER_STROKE = 0.07;         // 1ストロークで増えるレベル
export const STEAM_PER_TAP = 0.10;            // タップ代替（「ゆする」ボタン／Space・Enter）1回で増えるレベル
export const STEAM_DECAY_GRACE_MS = 400;      // 最後の入力からこの間は減らない
export const STEAM_DECAY_PER_S = 0.12;        // その後に減る速さ（止めると蒸気が弱まる）
export const STEAM_SHAKE_MIN_MS = 800;        // これより早く開けたら何も残さない
export type SteamShake =
  | { status: "idle"; tooShort?: boolean }
  | { status: "steaming"; startedAt: number; level: number; at: number /*level の基準時刻*/; lastInputAt: number;
      dir: -1 | 0 | 1; originX: number | null; fullSince: number | null }
  | { status: "released"; result: SteamResult; elapsedMs: number };
export type SteamShakeAction =
  | {type:"MOVE"; now:number; x:number; width:number}   // ポインタ位置（pot 内の座標）
  | {type:"TAP"; now:number}                              // タップ代替
  | {type:"OPEN"; now:number}
  | {type:"CANCEL"} | {type:"INTERRUPT"};
export function steamShakeLevelAt(s: Extract<SteamShake,{status:"steaming"}>, now: number): number // 遅延評価の減衰
export function steamShakeReducer(state: SteamShake, action: SteamShakeAction): SteamShake
```
- **ストロークの定義:** 進行方向 `dir` を持ち、反対向きに `STROKE_MIN × width` 以上動いた時点で 1 ストローク確定（`originX` を更新）。小さな揺れ・同方向の移動では増えない。1回の `MOVE` で複数ストローク分は数えない（フレーム飛びで一気に溜まらない）。
- **蒸気（レベル）:** 入力で加算し上限 1。最後の入力から `GRACE` 後に `DECAY` で減る。**減衰は読み出し時に遅延評価**（`steamShakeLevelAt`）。タイマーを reducer に持たない。
- 最初の `MOVE`/`TAP` で idle→steaming。`fullSince` はレベルが 1 に達した時刻（1 を割ったら null）。`OPEN`（「ふたを開ける」）で確定: `overMs = fullSince ? now - fullSince : 0`。
- `OPEN` が `SHAKE_MIN_MS` 未満・非有限は tooShort で何も残さない。
- **タップ代替は必須**（Research §4）。TAP は同じレベル機構に `PER_TAP` を足す。TAP と MOVE は同じ state を共有（混在可）。
- テスト: 1ストローク未満の揺れ→加算なし／往復1回→`+PER_STROKE`／同方向の長い移動→加算なし／フレーム飛び（巨大な dx）で複数加算されない／止めて `GRACE` 内→減らない・超えると `DECAY` で減る・0未満にならない／連続で全殻→`over`／TAP のみで `open` に到達できる（約10回）／MOVE/TAP 混在／width ≤ 0・NaN・非有限 x は無視／OPEN の MIN／CANCEL・INTERRUPT／決定論。
- 疲労の目安（設計値）: 全殻を開けるのに約 12 ストローク（`0.78/0.07 ≈ 11.1`）。1往復≒0.5 秒なら約 6 秒。HV で調整。

### 2.5 `steamedLook.ts` — 置いたピースの CSS（CSS 優先）
```ts
export function steamedPieceStyle(amount: number | undefined): CSSProperties | undefined
// undefined（未蒸し）→ undefined（従来どおり・スタイルを足さない）
// 量に応じ --steam-sat / --steam-bright / --steam-sheen（0..1）のみ。filter 用。transform は使わない（配置のスケールと競合しない）
export function steamedLookOf(amount: number): SteamLook   // 結果の見た目名（steamPot と同じ閾値の写像）
```
- 方針: 蒸すと「しっとり艶・わずかに明るい」。`over` 側は「少し沈んだ色」。**SVG（`IngredientGlyph.tsx`）は変更しない**（HOT・C と衝突しうる）。殻が開く様子は S3 の `SteamLayer`（新規）が自前の大きな絵で描く（Research U-3 = CSS のみで進める。足りなければ別 Gate）。
- テスト: 未蒸し→`undefined`／値は有限・範囲内／`--steam-bright` が `closed → open` で単調（下限・上限を固定）／`over` で明度が下がる／NaN・範囲外は安全側（未蒸しと同じ扱い）／**ピースが ほかの CSS 変数名（`--sear-*`, `--prep-*`）を使わない**。

### 2.6 `steamOffer.ts` / `steamPreview.ts` / `steamExperienceGate.ts`
- `steamOffer(input) → { ingredientId: string; done: boolean } | null`。入力は炙りの `SearOfferInput` と同型（`enabled, phase, makingStep, roundKind, active, selectedIngredientId, ownedIngredientIds` ＋ `steamedIngredientIds`）。条件: 有効・`PREPARE`/`TOPPING`・`GUIDED|FREE_COOK`・`active`・対象食材・所持。**Lunch Rush / Dinner は null。** `done` は既に蒸し済みのとき true（「✓ 蒸し済み」表示用）。レシピ・標的を入力に持たない。
- `steamPreview.ts`: `?cookSteam=on`（ちょうど1回のみ有効）、`?cookSteamVariant=lid|shake|both`（`both` は比較用でピルから選ぶ。無効値・重複・無指定は `both`）、`?cookSteamMs=3000|4500|6000`（案 A の全開時間の比較用）。`sessionStorage` によるタブ単位の記憶（炙りの iPhone HV で「ピルが消えた」問題の教訓を最初から入れる）と `?cookSteam=off`。Preview/DEV 限定は `import.meta.env.DEV || VITE_PREVIEW_MODE` の静的ガード。テスト: 解釈の全分岐、ストレージ失敗時のフォールバック。
- `steamExperienceGate.ts`: `STEAM_EXPERIENCE_PRODUCTION = false`、`steamExperienceEnabled() = PRODUCTION || steamPreviewOptedIn()`。

### 2.7 architecture / 独立性テスト（`steam.architecture.test.ts`）
1. `steamedLook` / `STEAM_INGREDIENT` は許可リスト（`state/gameReducer.ts`・`components/PizzaStage.tsx`・`components/SteamLayer.tsx`・`screens/GameScreen.tsx`・`App.tsx`）以外のソースに現れない。S1 時点では**どこにも現れない**ので、許可リストの外に出たら赤。
2. `state/pendingRound.ts` / `state/persistence.ts` / `logic/scoringV2.ts` は読まない。
3. `logic/steam/**` は `preparedIngredientIds|preparedLook|PREP_INGREDIENT|prepExperienceGate|searedLook|SEAR_INGREDIENT|searExperienceGate` を含まない（炒め・炙りと独立）。
4. 逆方向: `logic/prep/**` と `logic/sear/**` は `steam` を参照しない（**本テストは読み取り専用で両ディレクトリを走査するだけ。編集しない**）。
5. 対象リストの互いに素（§2.1）。

### 2.8 S1 の完了定義
新規ファイルのみ・既存ファイルの diff ゼロ／上記テスト全 pass／`tsc -b`・oxlint 警告 0／全 Vitest 緑（既存件数＋新規分）／本番ビルドに `steam` 関連文字列が無い（S1 は未配線なので自明だが、S3 の gate テストで固定）／PR 作成は Owner の指示後。

---

## 3. S2〜S4 実装計画

### 3.1 全体の依存

```
Owner GO ──┬─► S0（再確認・claim・Issue 更新）
           │
A merged ──┘   S1（新規ファイルのみ。A と衝突しない → Owner GO があれば A 完了前でも着手可）
                │
A merged ───────┼─► S2（gameReducer.ts 追加のみ）
                │        │
                │        ▼
A merged ───────┴─► S3（GameScreen / App / PizzaStage 追加 + SteamLayer 新規）
                         │
共有 Preview の Owner 承認 ─► S4（E2E・WebKit・HV 素材・Result）
```
- **S1 だけは A 待ちでない**（新規のみ）。ただし「今回は計画まで」のため S1 も Owner の GO まで実装しない。
- S2・S3 の HOT 3 ファイルは A の Production ON が触る可能性がある → **A の PR が merge されるまで編集しない**。A が最優先という Owner 方針どおり。
- 古い #581 / #478 / #468 は `PizzaStage` / `GameScreen` に触れる。追加のみで衝突しにくいが、S3 開始時に `git merge-tree` で再確認する。

### 3.2 S0 — 着手前（実装前の最小手続き）
最新 main／open PR／claim の再確認（特に A の PR・claim と C の領域）。Issue #726 に claim を投稿（期限 14 日以内）: `files` = §2.0 の全ファイル、S2/S3 で触る HOT は「追加のみ・A の merge 後」と明記。`Depends-on` に A の PR 番号。

### 3.3 S2 — reducer（HOT・追加のみ・A の merge 後）
- `GameState.steamedLook?: Readonly<Record<string, number>>`（炙りと同型。キー＝蒸した食材、値＝`amount`）。
- `GameAction`: `{ type: "STEAM_INGREDIENT"; ingredientId: string; amount: number }`。
- ガード（失敗は**同じ state 参照**を返す）: `steamExperienceEnabled()`／`PREPARE`+`TOPPING`／`GUIDED|FREE_COOK`／`canSteamIngredient`／`ownedIngredientIds` に含む／既に `steamedLook[id]` がある（1ラウンド1回）／`amount` が有限。値は 0..1 にクランプ。
- `RESET_PIZZA`: 既存の分割代入に `steamedLook: _discardedSteam` を追加（炒め・炙りと同様に**プロパティごと除去**）。
- 変えないもの: `pizza`・`score`・`completion`・在庫・Dex・`pendingRound` journal・Save・signature・Hint。
- テスト（新規ファイル）: `steamIngredient.reducer.test.ts`（各ガードの拒否が同一参照／受理時に他フィールド不変／クランプ／RESET で消える）、`steamIngredient.flagOff.test.ts`（フラグ OFF で全アクションの結果が従来と同一）、`steam.architecture.test.ts`（許可リストが埋まる）、**persistence round-trip: `pendingRound` に含まれない**ことの確認。
- 差分は炙りと同規模（`gameReducer.ts` 約 +22 行）を上限目安とする。

### 3.4 S3 — UI（HOT・追加のみ・A の merge 後）
- 新規: `components/SteamLayer.tsx`、`components/Steam.css`、`components/SteamLayer.test.tsx`。`PizzaStage.tsx` は `steamedLook` を受けて `steamedPieceStyle` を適用する小さな追加のみ（炙りが `searedPieceVisual` を使う箇所の隣）。`GameScreen.tsx` はピルとレイヤの追加のみ。`App.tsx` は `STEAM_INGREDIENT` の dispatch 1 行＋ Preview opt-in の初期化。
- **画面:** TOPPING で clam/mussel を選ぶと角に「♨ 蒸す」ピル。炙りのピルとは**食材が互いに素**なので同時に出ない（テストで固定）。位置規則は炙りの `searPillPlacement` の教訓（iPhone Safari で隠れた）を参照して、**初回から実機で位置を確認**。鍋の画面はステージ内（`inert` で背面を無効化、×で閉じる）。
- **案 A の画面:** 鍋＋ふた。タップで閉じる→湯気が立ち、殻が（`STEAM_SHELL_THRESHOLDS` に従い）1つずつ「パカッ」と開く→「ふたを開ける」ボタンで確定。ゲージ・数値・残り時間は出さない。
- **案 B の画面:** 鍋の上で左右に往復ドラッグ。止めると蒸気が弱まる。**「ゆする」ボタン（タップ代替・Space/Enter 対応）を常設。** 「ふたを開ける」で確定。
- 共通: `touch-action: none` とポインタキャプチャ、`pointercancel`/blur は `CANCEL`/`INTERRUPT`、確定後に短いガード時間で背面への誤タップを防ぐ（炙りの `SEAR_GUARD_MS` と同型）、`prefers-reduced-motion` では殻の状態を静止表示、`aria-live` で look の語を読み上げ、既存の iOS 対策（callout/選択の無効化）。
- 比較用: `both` のとき最初に A/B を選ぶ小さなタブ。選んだ案を画面左上に表示（HV 動画で判別できる）。
- ゲート: 本番ビルドに `cookSteam`/`cookSteamVariant`/`cookSteamMs` が**含まれない**ことを実ビルド2回で確認する gate テスト（炙りの `searPreview.gate.test.ts` と同型）。
- アクセシビリティ・誤爆の受け入れ条件は §4。

### 3.5 S4 — 検証・HV 素材
Chromium E2E（390×844・360×800）: ゲート（フラグ無しでピルが出ない）／対象外食材でピルが出ない／Lunch Rush・Dinner で出ない／A の完了／B（ドラッグ）の完了／B（タップ代替のみ）の完了／確定後に配置できる／×で何も残らない／RESET で消える／蒸し済みの再提示がない。WebKit CI（`workflow_dispatch` または PR）。HV 動画（390×844、直接提出）と before/after スクリーンショット（`docs/reports/screenshots/cooking-steam-phase1/`）、Result Report（HV Policy の書式）。**共有 Preview の更新は Owner 承認が必要**（現在は #724 / #725 の HV に使われている可能性）。

---

## 4. 受け入れ条件（S2〜S4 通し）
1. フラグ OFF／対象外食材／Lunch Rush／Dinner で、状態・DOM・スコア・在庫・Dex・保存・journal が従来とバイト同一。
2. 蒸しの結果は採点・識別・Hint・Research・Dex・Pitz・在庫・Save・`pendingRound` に**読まれない**（architecture test）。
3. 炒め・炙りのファイル（`logic/prep/**`・`logic/sear/**`・各 Layer/CSS/Gate/Preview）の diff がゼロ。
4. 入力は食材 id と round の状態のみ（レシピ・標的・モードに依存しない）。
5. タブ数・縦レイアウト不変（`dynamic-cooking-steps` / `viewport-1screen` が無修正で通る）。
6. B はタップ代替のみで完了できる。キーボード・スクリーンリーダーで A/B とも完了できる。
7. 390×844・360×800 で鍋・ボタンが収まり、背面は操作されない。
8. 全 Vitest・`tsc -b`・oxlint・Chromium E2E pass、WebKit CI success（炙りと同水準）。iPhone 実機 Safari は Owner が確認（WebKit CI は実機の代わりにならない）。
9. 本番ビルドに opt-in 名が含まれない。

---

## 5. HOT file と競合の管理

| ファイル | 誰が触りうるか | 蒸すの扱い |
|---|---|---|
| `src/data/searExperienceGate.ts` | **A（Production ON）** | 触らない |
| `gameReducer.ts` / `GameScreen.tsx` / `App.tsx` | A（可能性あり）、古い #478 | **A の merge 後に追加のみ**（S2/S3） |
| `PizzaStage.tsx` | #468 / #581 / #478（古い） | S3 で小さな追加のみ。着手時に `merge-tree` |
| `PROJECT_HANDOFF.md` | A・C・他 | **蒸すでは更新しない**（Owner が必要と判断したら最後に別途） |
| `ingredients.ts` / `IngredientGlyph.tsx` / `recipes.ts` | C（レシピ拡張）ほか | **読むだけ**。C が clam/mussel 周辺（`pieceVisual`・レシピ）を変えたら S0 で再確認 |
| `src/App.css` | 他 | 触らない（CSS は新規 `Steam.css`） |

merge 順の原則: A →（C のレシピ変更）→ 蒸す。蒸すの PR は後発として base を取り込む。

---

## 6. HV 比較基準（案 A vs 案 B）

### 6.1 実施条件
- 実機 iPhone Safari（Owner）＋ 390×844 の録画（Owner へ直接提出・commit しない）。共有 Preview の更新は Owner 承認後。
- URL: `?cookSteam=on&cookSteamVariant=both`（A/B 切替）。A の全開時間の比較は `?cookSteamMs=3000|4500|6000`。
- シナリオ（各レシピで A と B を ABBA の順に実施し、順序効果を打ち消す）:
  1. **vongole**（clam のみ）— 基本操作。
  2. **pescatore**（clam＋mussel＋shrimp）— 2食材の対象、非対象の shrimp にピルが出ないこと。
  3. **new-haven-apizza**（clam）— 別レシピでも同じ体験・採点が不変なこと。
- 各案を最低3回（初見1回＋慣れ2回）。

### 6.2 観点と採否の目安（PASS/FAIL の語は Owner のもの。ここは判定の物差し）

| # | 観点 | 測り方 | 目安 |
|---|---|---|---|
| H1 | 初見で理解できるか | 説明なしで1回目を完了できたか | A・B とも「できた」 |
| H2 | 所要時間 | 1回の蒸しの時間（録画から） | 4〜8 秒に収まる |
| H3 | **炒め・炙りと違うと感じるか** | Owner の5段階（1=同じ〜5=別物） | 4 以上 |
| H4 | 殻が開く「出来事」が見え、判断に使えたか | はい／いいえ | はい |
| H5 | 楽しさ・もう一度やりたいか | 5段階 | 4 以上 |
| H6 | **疲労**（特に B） | 3回連続で手・指が疲れたか | 疲れない（B の必須条件） |
| H7 | **誤操作**（B のドラッグがスクロール・背面タップ・長押しメニューに化ける） | 回数 | 0 |
| H8 | タップ代替で完了できるか | はい／いいえ | はい（必須） |
| H9 | 面倒さ（毎回やるか／飛ばしたいか） | 自由記述＋5段階 | 「飛ばしたい」が多数でない |
| H10 | 採点・Dex・在庫・次のラウンドに影響が出ないか | 配置→焼成→RESULT まで | 影響なし |
| H11 | 置いたピースの見た目の変化が読めるか | はい／いいえ | 蒸した／蒸さないが区別できる |

### 6.3 決定ルール（案）
- **必須条件（どちらの案も）:** H1・H4・H7・H8・H10 を満たす。満たさなければその案は却下。
- **B を採る条件:** H3・H5 が A より高く、かつ H6（疲労）・H7（誤操作）の必須条件を満たす。
- **A を採る条件:** B が H6/H7 を満たさない、または H3・H5 が A と同等以下。
- **両方却下（打ち切り）:** 両案とも H3 が 3 以下（「炒めと同じに感じる」）。Phase 1 を畳み、揚げる（絵の整備後）へ進むか Owner が判断。
- 最終決定は Owner。上記は助言。

---

## 7. リスクと未決

| # | リスク／未決 | 対応 |
|---|---|---|
| R1 | A（炙り Production ON）との HOT 衝突 | S1 は新規のみ。S2/S3 は A の merge 後。S0 で A の最新 PR/claim を再確認 |
| R2 | 炙りの iPhone 実機 HV が未完了（#725 Result §11.4）。同じ「ピル→一時画面」方式の iOS 問題（ピルが隠れる等）を再発させうる | `searPillPlacement` の教訓を S3 の初回設計に取り込み、最初の Preview で実機確認 |
| R3 | 殻が「開く」のを CSS だけで置いたピースに反映できない | 開く様子はステージ内の専用画面で描き、置いたピースは `filter` 系のみ。足りなければ別 Gate（`IngredientGlyph.tsx` は触らない） |
| R4 | B の往復ドラッグが疲れる／誤爆する | タップ代替を必須化。HV の H6/H7 で足切り |
| R5 | 炒め・炙り・蒸しの3独立実装による重複（保守負債） | Owner 決定どおり一般化はしない。**3つ目が残ると決まった時点**で別 Gate（Opus でのレビュー）に回す |
| R6 | C のレシピ拡張が clam/mussel/`ingredients.ts` を変える | S0 で確認。S1 は読み取りのみなので影響しない |
| U-a | 蒸し済みの表示（「✓ 蒸し済み」）と「やり直し」の可否 | Phase 1 は炙りと同じ（1ラウンド1回・取り消しなし）を踏襲 |
| U-b | 名称・ミトの一言・Dex／技法化 | Phase 1 は技法化しない（INV-TQ）。小さな印のみ |
| U-c | 数値（`FULL_MS`・閾値・`PER_STROKE`・`DECAY`・`OVER_MS`）の最終値 | HV で調整。定数は各モジュール1か所 |

---

## 8. 推奨モデルと次のアクション
- S1（純粋ロジック・テスト）: Sonnet 5.5 で足りる。S2（reducer の HOT 追加）・S3（UI／iOS）・A 完了後の統合レビュー: Opus 5.5 を推奨（助言）。
- **次のアクション:** Owner の GO を待って停止する。GO の条件は #726 の「着手条件」。実装・PR・Preview 更新は行わない。

## 9. 禁止事項の遵守
ソース・テスト・CSS・データの変更なし／PR 作成なし／merge なし／共有 Preview・Production の更新なし／claim 投稿なし／炒め・炙り・A・C のファイル・Issue・PR に触れていない／追加物は本書と Issue #726 のみ（Research 文書は前回追加済み）。
