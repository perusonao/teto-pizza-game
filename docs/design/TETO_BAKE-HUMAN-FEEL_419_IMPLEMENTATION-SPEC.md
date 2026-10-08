# Bake Human Feel — 実装仕様書（Issue #419）

Status: **DOCS ONLY / 実装前仕様**。Production コードは未変更。
Issue: #419「Bake Human Feel: 焼成進行を一方向にする / 右端から戻らない」
Authority: Issue #419 本文 + **OD-419 Guide Visibility（Owner 承認 2026-10-08）** + 本タスクの Owner 確定事項。
根拠調査: 既存の READ-ONLY 監査（`docs/reports/TETO_M3A_BAKE-JUDGMENT_Fresh-Audit.md` / `_Result.md`、#419 本文の「現行 main とのギャップ」）を再利用。**新しい Fresh Audit・既存監査の再実行は行っていない**（本書の現行コード記述は、仕様の接続点を示すための参照確認のみ）。
関連 Owner HV: `docs/reports/TETO_BAKE-HUMAN-FEEL_419_OWNER-HV-CHECKLIST.md`

> **実装ゲート**: #418 の Owner HV PASS まで Production 実装は禁止（Issue 本文）。本書は #418 に触れない。
> 実装は別 Issue / PR で、本書の §1 B 節（Pilot 仮決定）を Owner が確認・修正してから着手する。

---

## 0. 要約

| 項目 | 内容 |
|---|---|
| 変えるもの | `BakeOverlay` の針進行（往復 → 0→100 一方向・右端保持）、目安ゾーンの BAKE 専用フェード、CTA の正解位置 glow 削除、開始直後の入力ロック、背景復帰時の時間ジャンプ防止 |
| 変えないもの | `CONFIRM_BAKE` の入力値の意味（針位置 0–100）、Scoring 2.0 Bake 配点・式（`bakeComponent.ts`）、`classifyBake`、Pitz / economy / save / progression / Research、**CUT のガイド処理一式** |
| 最大のリスク | ① CUT と共有している `computeGuideOpacity` / `GUIDE_FADE_*` を誤って変更する（§2）② 10 秒 Pilot が Lunch Rush 180 秒に与える影響（§4）③ 針速度低下による Bake スコア分布の変化（§4.4） |

---

## 1. Owner 確定事項と Pilot 仮決定の分離

### A. Owner 確定事項（変更不可。仕様の前提）

| # | 確定事項 | 出所 |
|---|---|---|
| O1 | 焼成は **0→100 の一方向**。往復（100 で反転）は廃止 | 本タスク / Issue OD 1–3 |
| O2 | **焼き色・bake visual は逆戻りしない**（針の位置＝進行の単調非減少に従う） | 本タスク / Issue OD 4 |
| O3 | 目安ゾーン: **0〜3 秒表示 / 3〜5 秒でフェードアウト / 5 秒以降は完全非表示・復活しない** | OD-419 |
| O4 | **針とゲージ本体（トラック）は消さない**。消すのは目安ゾーンのみ | OD-419 |
| O5 | 右端（100）に達したら**焦げ状態を保持**し、プレイヤーが**手動で取り出す**（自動取り出し・自動失敗はしない） | 本タスク |
| O6 | **CUT のガイド処理は変更しない**。CUT と共有する既存 guide fade 定数は変更せず、BAKE 専用にする | OD-419 / 本タスク |
| O7 | フェードは**レシピ・正解位置に依存させない**（経過時間のみの関数） | OD-419 |
| O8 | 正解位置を漏らす補助表示（CTA の正解位置発光など）は**設けない方向**で設計する（最終実装ゲートで再確認） | OD-419 |
| O9 | プレイヤーはピザの見た目を観察して自分で取り出す。guide は補助で、針を当てることが主ゲームではない | Issue OD 5–7 |
| O10 | scoring / economy / save / progression / Research は対象外。Bake の配点・式、Pitz、ranking は変更しない | Issue Scope 外 |
| O11 | 背景復帰時の**無制限 dt による時間ジャンプ**は、実装時の**必須検証項目** | OD-419 |
| O12 | 完了条件は iPhone 実機 390×844 の Owner HV（`TETO_HUMAN-VERIFICATION-POLICY.md` 準拠） | Issue Completion gate |

> OD-419 は「10 秒基準、Rush 共通速度、入力ロックなどの詳細は設計案であり、この Owner 承認だけで確定扱いにしない」と明記している。よって下記 B は **Owner 未確定**。

### B. Pilot 仮決定（推奨案。Pilot HV で検証し、Owner が確定するまで仮置き）

| # | Pilot 仮決定 | 値 / 内容 | 備考 |
|---|---|---|---|
| P1 | 全行程時間 | **10 秒**（0→100、速度 **10 %/s**） | 定数 `BAKE_DURATION_S = 10` |
| P2 | 通常 / Lunch Rush | **共通の 10 秒**。モード別速度は**別 Issue** | 現行 BAKE はモード非依存（監査 §5）。分岐を増やさない |
| P3 | CTA 正解位置 glow | **削除**（`cta-button--glow` を BAKE で使わない） | O8 を実装に落とす。現行は目安フェード窓と連動（監査 §3）だが、新仕様では「ゾーン消失後も glow が答えを漏らす」ので窓連動ではなく全廃 |
| P4 | 開始後の誤確定防止 | 開始後 **300 ms** は「取り出す！」を無効 | 「焼く！」と「取り出す！」は同じ `.prepare-bake-bar` の同位置（`BakeOverlay.tsx` コメント）。二重タップ誤確定対策 |
| P5 | 背景復帰の時間ジャンプ防止 | 1 フレームの dt を **`MAX_DT_S = 0.1`** に clamp ＋ `document.hidden` / window blur 中は進行を凍結し、復帰時に基準時刻を取り直す | clamp 値 0.1 s は仮置き（60fps で 6 フレーム分。低フレームレート端末での遅れと復帰ジャンプの折衷） |
| P6 | 針の色 | **常にニュートラル色**（`raw/perfect/burnt` の状態色を廃止） | 現行 `NEEDLE_COLOR[bakeState]` は針色が target 境界で変わり、ゾーン消失後も答えを漏らす |
| P7 | Teto キャプション | ゾーンと同じ 3〜5 秒窓で状態表示文（`CAPTION[bakeState]`）からニュートラル文（既存 `CAPTION_NEUTRAL`）へ切替 | 状態を明かす文言をゾーン消失後に残さない |
| P8 | 終端の見た目 | 100 到達で針は右端に留まり、ピザは `heat = 2`（charred）で保持 | O5 の表現。`computeBakeHeat` は変更しない |
| P9 | 開始位置 | 針は 0 から開始。ゾーン経過時間 / 入力ロック / 針位置は**単一の経過時間 `bakeElapsedS`** から導出 | 3 つの時計が乖離しない |

---

## 2. Bake 専用フェード関数と CUT 共有コードの分離計画

### 2.1 現状（参照確認）

- `src/logic/bakeGuideFade.ts` の `GUIDE_FADE_START_S = 3.6` / `GUIDE_FADE_END_S = 7.2` / `computeGuideOpacity` は、名前に反して **BAKE と CUT の両方**が使っている。
  - BAKE: `src/components/BakeOverlay.tsx`
  - **CUT**: `src/components/PizzaStage.tsx`（CUT 角度ガイドのフェード。コメントで「BakeOverlay's already-shipped `computeGuideOpacity` unchanged」と明記）
- テスト: `src/logic/bakeGuideFade.test.ts`、`src/components/BakeOverlay.test.tsx`（3.6 / 7.2 を直書き）、`e2e/layout-contract.spec.ts`（`AFTER_GUIDE_FADE_MS = 7_300`）。

→ `GUIDE_FADE_*` を 3 / 5 に書き換えると **CUT のガイドが変わってしまう**（O6 違反）。

### 2.2 分離計画

1. **`src/logic/bakeGuideFade.ts` は 1 バイトも変更しない**（定数・関数・既存テスト含む）。以後は事実上 CUT 専用だが、**リネームは本タスクで行わない**（差分と CUT 回帰リスクを増やさない。名称整理は別 Issue 候補）。
2. 新規 `src/logic/bakeZoneFade.ts` を追加（BAKE 専用）:
   ```ts
   export const BAKE_ZONE_FADE_START_S = 3;
   export const BAKE_ZONE_FADE_END_S = 5;
   /** 経過秒のみの関数。recipe / target / 針位置を引数に取らない（O7）。 */
   export function computeBakeZoneOpacity(elapsedSeconds: number): number;
   ```
   - `t <= 3` → 1、`t >= 5` → 0、間は線形（`1 - (t-3)/2`）、**単調非減少でなく単調非増加**。`t` が負・NaN なら 1 を返す防御。
3. `BakeOverlay.tsx` は `bakeGuideFade` の import を**削除**し、`bakeZoneFade` のみを使う。`PizzaStage.tsx` は無変更。
4. 回帰の固定: `bakeGuideFade.test.ts` は無変更で通ること。さらに「CUT 用定数が 3.6 / 7.2 のまま」を `bakeZoneFade.test.ts` 側ではなく既存テストが担保していることを実装 PR の差分チェック項目にする（`git diff --stat` で `bakeGuideFade*` と `PizzaStage.tsx` が変更ファイルに含まれないこと）。
5. 「ゾーン」として消す DOM: `.bake-gauge__zone--raw` / `.bake-gauge__target` / `.bake-gauge__zone--burnt`。**消さない DOM**: `.bake-gauge`（トラック）、`.bake-gauge__needle`、`.bake-oven`（炎・キャプション行）。現行は `.bake-gauge` 全体に opacity を掛けているため、**opacity の適用先をゾーン 3 要素（またはそれを包む新ラッパー）に移す**。トラックの背景スタイルがゾーン色に依存していないか、実装時に 390×844 で確認する（トラック枠が消えると O4 違反）。
6. ゾーン opacity は rAF ごとの React state 更新を避けられるなら ref + `style.opacity` 直書きでもよい（CUT 側は同方式）。ただしテスト容易性のため、まず現行どおり state 経由で可。

### 2.3 CUT 非接触の保証（実装 PR のチェック項目）

- [ ] `src/logic/bakeGuideFade.ts` / `.test.ts` 差分なし
- [ ] `src/components/PizzaStage.tsx` の CUT ガイド effect 差分なし（BAKE visual の `bakeProgress` 経路を触る場合も CUT 部は無変更）
- [ ] `PizzaStage.cutGesture.test.tsx` 無変更で PASS

---

## 3. 状態遷移: 一方向進行・終端保持・二重タップ防止

### 3.1 状態

`BakeOverlay` ローカルの論理状態（reducer の `GamePhase` は変更しない。`phase: "BAKE"` の内側の UI 状態）:

| 状態 | 条件 | 針 | 「取り出す！」 |
|---|---|---|---|
| `LOCKED` | `0 ≤ bakeElapsedS < 0.3` | 進行する | **無効**（P4） |
| `RUNNING` | `0.3 ≤ bakeElapsedS < 10` | 進行する | 有効 |
| `TERMINAL` | `bakeElapsedS ≥ 10`（針 = 100） | **100 に固定・保持**（O5） | 有効 |
| `PAUSED`（直交） | `document.hidden` または window blur | **凍結**（P5） | 状態は直前を維持 |
| `CONFIRMED`（ラッチ） | 有効状態で 1 回目の click | 凍結 | 以降の click は無視 |

遷移は `LOCKED → RUNNING → TERMINAL` の**前進のみ**。逆方向の遷移は存在しない（O1–O3）。`PAUSED` は経過時間を進めないだけで、状態を巻き戻さない。

### 3.2 進行の定義（純関数で表現する）

新規 `src/logic/bakeProgress.ts`（BAKE 専用・純関数）:

```ts
export const BAKE_DURATION_S = 10;       // P1
export const BAKE_INPUT_LOCK_S = 0.3;    // P4
export const BAKE_MAX_DT_S = 0.1;        // P5

/** 1 フレーム分の経過時間を加算。dt は [0, MAX_DT] に clamp。elapsed は DURATION で頭打ち。 */
export function advanceBakeElapsed(elapsedS: number, rawDtS: number): number;
/** 針位置。elapsed のみの関数: min(100, elapsed / DURATION * 100)。単調非減少。 */
export function bakePositionFromElapsed(elapsedS: number): number;
export function isBakeInputLocked(elapsedS: number): boolean;
```

- 針位置を「前フレーム位置 ± 速度×dt」で積分せず、**累積経過時間から導出**する。これにより反転の余地がなく、終端で厳密に 100 になる（浮動小数の累積誤差で 99.99 に留まらない）。
- 現行の `directionRef` は削除。`SPEED = 55` も削除（`BAKE_DURATION_S` から導出）。
- `elapsed` が `BAKE_DURATION_S` に達した後は加算を止める（`elapsed` は 10 で頭打ち）。ゾーンフェード（≥5 s で 0）・入力ロック（≥0.3 s で解除）は、頭打ち後も値が変わらない。

### 3.3 終端保持（O5）

- 100 到達後も rAF を回し続けるか、停止するかは実装裁量。ただし **終端到達時に最終値 100 が `onTick` 経由で `liveBake` に確実に届く**こと。`App.tsx` の `handleBakeTick` は **3 フレームに 1 回しか `setLiveBake` しない**（`bakeFrameSkip % 3`）ため、「100 到達の 1 フレームで onTick して rAF を止める」実装だと最終値が間引かれ、**ピザが charred 手前の見た目で止まる**恐れがある。→ 終端では間引きを通さず確実に反映する（例: 終端フレームは rAF を数フレーム継続する / `onTick` に終端フラグ。どちらでもよいがテスト必須、§5）。
- 保持中は焦げ表示（`heat = 2`）。char / smoke は `charIntensity` の既存ランプにより連続的に出ており、新規演出は追加しない。
- 自動取り出し・自動失敗・タイムアウトは設けない（O5。現行も BAKE に自動失敗は無い）。Lunch Rush では既存の 180 秒クロックだけが外側の制約（§4）。

### 3.4 視覚の単調性（O2）

- `PizzaStage` は `bakeProgress`（`liveBake`）から `computeBakeHeat` 等で連続計算する。針が単調非減少になれば、**heat・dough 色・cheese・char・smoke も自動的に単調**になる。`bakeVisual.ts` / `PizzaStage` の描画は**変更不要**の見込み。
- ただし `liveBake` は `handleBakeTick` で間引かれ、`BAKE` 入室時に `setLiveBake(0)` でリセットされる。これらは進行を戻さない（新ラウンド開始時のリセットのみ）。実装で間引きを変更する場合も単調性を壊さないこと。

### 3.5 二重タップ防止

3 層で守る:

1. **入力ロック（P4）**: 開始 300 ms は `disabled`。「焼く！」の連打・ダブルタップが、そのまま「取り出す！」に落ちて 0% 付近で確定する事故を防ぐ。ロックは `bakeElapsedS`（P9）で測る＝背景中は進まない。
2. **コンポーネントのラッチ**: `confirmedRef`。1 回目の有効 click で `true` にし `onConfirm` を 1 回だけ呼ぶ。2 回目以降は無視（同一 tick 内の連打で、state 更新前に 2 回目が来る場合を塞ぐ）。
3. **reducer の既存バックストップ**: `CONFIRM_BAKE` は `state.phase !== "BAKE"` で no-op（EP2 の exactly-once ガード）。**変更しない**。`handleConfirmBake`（`App.tsx`）は CONFIRM_BAKE の直後に REGISTER_TO_DEX を dispatch するため、UI 層のラッチ（2）が REGISTER_TO_DEX の二重 dispatch も未然に防ぐ。

`onConfirm(value)` の `value` は従来どおり確定時点の針位置（`positionRef.current` 相当、0–100）。**入力値の意味・範囲は不変**で、scoring への影響は式レベルでゼロ（§4.4 の分布変化を除く）。

### 3.6 背景復帰（O11）

- 現行の rAF は `dt = (now - last)/1000` を**上限なし**で使う（監査 §6）。タブ復帰時、ブラウザによっては復帰直後に大きな dt が 1 回入る。旧実装は位置を [0,100] に clamp するため破綻しなかったが、**一方向・累積経過時間方式では 1 フレームで 10 秒分ジャンプして終端（焦げ）に直行し得る**。
- 対策（P5）:
  1. `advanceBakeElapsed` で `dt` を `[0, BAKE_MAX_DT_S]` に clamp。
  2. `visibilitychange`（`document.hidden`）と window `blur` で凍結フラグ、`visible` / `focus` で解除し、`last` 基準時刻を `performance.now()` に取り直す（復帰直後の巨大 dt を捨てる）。`App.tsx` の CT2 は同種の hidden/blur 二重検知を既に持つ（コメント参照）。**同じ二信号方式に揃える**が、状態を共有する必要はなく BAKE ローカルで足りる。
  3. 凍結中は入力ロックの解除（0.3 s）も、ゾーンフェードも進めない（=背景に隠れて待つことでフェード・ロックをやり過ごせない）。
- Lunch Rush のミッションクロック（`endsAt` 絶対時刻、`lunchRush.ts`）は**別系統で壁時計のまま進む**。BAKE を背景に置いても Rush の残り時間は減るので、BAKE 凍結が Rush 上の有利にならない。この非対称は**意図どおり**（Rush クロックは変更しない）。
- 必須テスト: §5 U-6 / C-7。

---

## 4. Lunch Rush 180 秒への影響と Pilot HV の判断基準

### 4.1 事実関係

- Lunch Rush は 180 秒（`DEFAULT_MISSION_DURATION_SECONDS`）、`endsAt - now` の壁時計方式。`BakeOverlay` / `CONFIRM_BAKE` はモード非依存（監査 §5）。
- 現行: 針は 55 %/s で往復し、いつでも tap できる。target 窓（recipes の `bakeTarget` は 45–65 〜 65–85）への最速到達は約 0.8〜1.2 秒（上り 1 周目）。
- 新（P1）: 10 %/s。target の開始 / 中心 / 終了は下表（秒 = 針位置 / 10）。

| 区間（`bakeTarget` の範囲） | 秒 |
|---|---|
| target 開始（start 45〜65） | 4.5〜6.5 s |
| target 中心（heat = 1。ピザ見た目の「ちょうどいい」） | 約 5.5〜7.5 s |
| target 終了（end 65〜85） | 6.5〜8.5 s |
| 終端（焦げ保持） | 10 s |
| 入力可能（P4） | 0.3 s〜 |
| 目安ゾーン完全消失（O3） | 5 s（＝針 50%） |

### 4.2 影響の整理

- **Rush の 1 皿あたり、BAKE の下限が約 +3.5〜5.5 秒**（旧: 約 1 秒前後 → 新: target 開始まで 4.5〜6.5 秒）。180 秒で完了できる注文数の上限は、他条件が同じなら減る。減少幅は PREPARE 側の所要時間に依存するため**本書では数値を断定しない**（PREPARE の実測は Pilot で取る。§4.3）。
- 目安ゾーンは 5 秒で消えるため、**ほぼ全レシピで target 窓の本番（4.5〜8.5 s）は目安ゾーンが無い状態**になる。つまり Rush でも通常でも「ピザの見た目で判断」が主体になる（O9 の意図どおり）。
- 速く取り出したい Rush プレイヤーは、早めに（粗い見た目で）取り出す選択ができる＝**速度と品質のトレードオフ**が生まれる。10 秒固定は「待たされる」だけにならない設計か、HV で確かめる。
- Rush 中に BAKE 待機中でクロックが 0 になった場合の挙動は**既存どおり**（`SERVE` / `TICK` の期限判定、`lunchRush.ts` コメント参照）。本変更で変えない。実装時に「BAKE 中にタイムアップ」を 1 ケース手動確認する。
- Dinner Mission も同一 `BakeOverlay` を使う（`src/mission/dinner/` が bake を参照）。通常・Rush と同じ 10 秒の影響を受けるため HV 対象に含める（Dinner 側に固有の時間制約があるかは未確認 → §7 の未確定事項）。

### 4.3 Pilot HV での判断基準（Owner が確定する。数値は提案）

計測: 実装後、同一レシピ・同一プレイヤーで **変更前 / 変更後**の Rush 1 回（180 秒）を撮り、次を記録する。

| 観点 | 指標 | 判断の目安（提案・Owner 調整可） |
|---|---|---|
| 退屈さ | 針が動いている間、プレイヤーが「待たされている」と感じるか（Owner 主観）。target 前の 4.5〜6.5 s | 「長い」とのフィードバックなら P1 を短縮（例 8 s）か Rush のみ別速度（別 Issue） |
| Rush の進行感 | 180 秒での提供数（変更前比） | 目安: 旧比で大きく（例: 概ね 2 割超）減るなら Rush 速度を別 Issue で検討 |
| 見た目判断 | 目安ゾーン消失（5 s）後、ゾーン無しでも「そろそろ」が見た目だけで分かるか | 分からない → ピザ visual のコントラスト調整は別 Issue（本件では `bakeVisual.ts` 非変更） |
| 取り出しの納得感 | 終端（焦げ）で保持されることが分かるか。「逆戻りしない」が体感できるか | O1〜O5 の合否 |
| 誤確定 | 「焼く！」連打で即確定しないか（P4） | 1 件でも起きたら P4 のロック長を再検討 |
| 背景復帰 | 背景→復帰で針が飛ばないか（O11） | 飛んだら P5 不合格 |

結果の分岐（Owner 判断）:
- **Keep**: 通常・Rush とも 10 秒共通で確定 → 仮決定 P1/P2 を Owner 確定事項へ昇格。
- **Adjust**: 秒数のみ調整（定数 `BAKE_DURATION_S` の差し替えで済む。構造は不変）。
- **Split**: Rush のみ別速度 → **別 Issue**（本件では `BakeOverlay` にモード引数を追加しない）。
- いずれも scoring / Pitz は変更しない。

### 4.4 Bake スコア分布への副作用（式は不変だが記録する）

`scoreBakeComponentV2` は針位置 0–100 と `bakeTarget` のみを読み、式は変えない。一方、針速度が 55 → 10 %/s に下がるため、**target 窓（幅 20）を通過する時間が約 0.36 s → 約 2.0 s に伸び、数値上の「良い位置」で取り出しやすくなる**。結果として Bake component のスコア分布（平均）が上がり得る。これは Issue Scope 外（配点・式の変更禁止）だが、Pitz 報酬・ランキングへの二次影響として **Owner に未確定事項として報告**する（§7）。式を触る判断は別 Issue。

---

## 5. 最小テスト計画（Unit / Component / E2E）

実装 PR で追加する最小セット。**本書作成タスクでは一切実行しない**（E2E / CI 禁止）。

### 5.1 Unit

| ID | 対象 | 内容 |
|---|---|---|
| U-1 | `bakeProgress.bakePositionFromElapsed` | 0→0、5→50、10→100、20→100（頭打ち）。全域で単調非減少（0.01 s 刻み） |
| U-2 | `bakeProgress.advanceBakeElapsed` | dt clamp: 30 s の raw dt でも +0.1 s 以内。負 dt → 0 加算。終端 10 で頭打ち |
| U-3 | `bakeProgress.isBakeInputLocked` | 0 / 0.29 → true、0.3 / 10 → false |
| U-4 | `bakeZoneFade.computeBakeZoneOpacity` | 0 / 3 → 1、4 → 0.5、5 / 6 / 100 → 0、0〜10 s 全域で単調非増加。引数は経過秒のみ（recipe を取らない型） |
| U-5 | CUT 非接触の固定 | 既存 `bakeGuideFade.test.ts` が**無変更で PASS**（3.6 / 7.2 のまま） |
| U-6 | 時間ジャンプ | 「経過 2 s → 1 回の 60 s dt」を `advanceBakeElapsed` に通しても elapsed ≤ 2.1 |
| U-7 | scoring 不変 | 既存 `gameReducer.bakeGuideRegression.test.ts` 無変更で PASS（同じ tap 値 → 同じ score） |

### 5.2 Component（`BakeOverlay.test.tsx`、既存の rAF / `performance.now` スタブを流用）

| ID | 内容 |
|---|---|
| C-1 | 15 秒分 tick して、針位置が一度も減少しない（スタイル `left` を毎フレーム採取）。10 秒以降は 100% のまま |
| C-2 | ゾーン 3 要素の opacity: 2.9 s=1 / 4 s≈0.5 / 5.1 s=0。**トラックと針は 8 s 時点で DOM に存在**し opacity が 0 でない（O4） |
| C-3 | `cta-button--glow` がどの時点でも付かない（target 内の 6 s でも）（P3 / O8） |
| C-4 | 針の背景色が時間・位置によらず一定（P6）。キャプションは 5 s 以降 `CAPTION_NEUTRAL` |
| C-5 | 0.29 s で「取り出す！」が disabled、0.31 s で enabled（P4） |
| C-6 | 有効状態で連続 2 click → `onConfirm` が**1 回のみ**、引数は click 時点の針位置（P3.5 ラッチ） |
| C-7 | 背景: `visibilitychange`（hidden）後に 30 s 分 tick しても針が動かない。復帰後の最初の tick で +0.1 s 以内（O11 / P5） |
| C-8 | 終端: 10 s 以降の tick でも `onTick` の最終値が 100 に到達し、以降 100 を超えない（§3.3 の間引き対策の検証） |
| C-9 | アンマウントで rAF / listener が解除される（リーク無し） |
| C-10 | `PizzaStage.bakeVisual.test.tsx`: `bakeProgress` を 0→100 で単調に与えたとき、heat 由来の dough 色・char 強度が単調（O2） |

### 5.3 E2E（最小 2〜3 本。実装 PR で実行。WebKit gate は実装 PR 側）

既存 `e2e/layout-contract.spec.ts` は `AFTER_GUIDE_FADE_MS = 7_300`（旧 7.2 s 基準）で BAKE を検査している。新仕様では 7.3 s は針 73% で、依然ゾーン消失後のため**そのまま成立する見込み**だが、定数名と意味（`GUIDE_FADE_END_S`）が旧仕様に紐づくので、`BAKE_ZONE_FADE_END_S + 余裕`（例 5_100）へ更新するか、現行値の妥当性をコメントで更新する。

| ID | シナリオ |
|---|---|
| E-1 | FREE: PREPARE→「焼く！」→ 直後に即 tap しても RESULT へ行かない（300 ms ロック）→ 5.1 s でゾーン非表示・針とトラック可視 → 10.5 s でも針は右端のまま → 「取り出す！」で RESULT |
| E-2 | Lunch Rush: 同様に BAKE 到達・ゾーン消失・取り出し成立。クロックが減り続けること（BAKE 中も） |
| E-3 | 回帰: 既存 `layout-contract` の BAKE 検査（390×844 / 360 系）と `cut-skip-failed-bake.spec.ts` が無変更ロジックで PASS（CUT 非接触の間接確認） |

`page.clock`（Playwright）で時間を進める既存流儀（`enterBakePaused`、`clock.runFor`）に従う。

---

## 6. iPhone Owner HV チェックリスト

別ファイル `docs/reports/TETO_BAKE-HUMAN-FEEL_419_OWNER-HV-CHECKLIST.md` に分離（実装 PR の Result Report にそのまま貼れる形）。要点のみ:

- 実機 iPhone / 390×844 を Authority viewport とする（Policy §3）。
- 動画は repo に commit せず Owner へ直接提出、スクリーンショットは `docs/reports/screenshots/bake-human-feel-419/` に commit（Policy §6）。
- チェックは「一方向 / 逆戻りしない / ゾーンの 0–3–5 秒 / 針とトラック常時表示 / 終端焦げ保持 / 手動取り出し / glow 無し / 300 ms ロック / 背景復帰 / Rush 180 秒体感 / CUT 無変化」。

---

## 7. Issue #419 との整合確認

| Issue #419 の記述 | 本書での扱い | 整合 |
|---|---|---|
| OD 1–3 一方向・往復廃止・右端から戻らない | O1 / O5、§3 | ✅ |
| OD 4 焼き色が逆戻りしない | O2、§3.4（`bakeVisual` は針に従うだけで自動的に単調） | ✅ |
| OD 5–7 見た目で判断 / guide は補助 / #37 M3·M3A と整合 | O9、§2、§4.2 | ✅ |
| 「最小仕様で確定する」5 項目 | ①進行の定義 → §3.2 ②終端 → O5/§3.3 ③guide の位置づけ → O3/O4/§2 ④`CONFIRM_BAKE` 入力値との対応 → §3.5（不変）⑤背景復帰 → §3.6 | ✅（④は不変、③の Practice/Normal/Challenge 差は下記） |
| 「Practice / Normal / Challenge の差」 | **現行コードにそのモード区分は存在しない**（監査 §8 は将来拡張の準備のみ）。本件は単一の挙動とし、難易度別は別 Issue | ⚠ 不採用（スコープ外として明記） |
| 現行ギャップ「fade 3.6→7.2s」 | O3 の 3→5 s に置換。ただし旧定数は CUT が使うため**残置**（§2） | ✅ 差異を明示 |
| OD-419「CUT と共有する既存 guide fade 定数は変更せず」 | §2 の分離計画で担保 | ✅ |
| OD-419「10 秒基準 / Rush 共通 / 入力ロックは設計案」 | §1 B に隔離。Owner 確定事項に混ぜない | ✅ |
| OD-419「背景復帰の無制限 dt は必須検証」 | §3.6、U-2 / U-6 / C-7 | ✅ |
| OD-419「#418 Owner HV PASS まで Production 実装禁止」 | 冒頭に明記。#418 は不触 | ✅ |
| 参照のみ: #256 / #320（CUT skip） | 触れない。焼成結果の扱い（RESULT 経路）は不変 | ✅ |
| Scope 外 scoring/economy/save/progression/Research | O10。§4.4 に分布の副作用だけ記録 | ✅ |
| Completion gate: iPhone 390×844 Owner HV、Policy 準拠 | §6 / HV チェックリスト | ✅ |

不整合: **なし**（⚠ は Issue 側が将来の拡張を示唆している点を本件のスコープ外とした差のみ）。

---

## 8. 未確定事項（Owner 判断待ち）

1. **P1 全行程時間**: 10 秒でよいか（Pilot HV で判断）。
2. **P2 モード別速度**: 通常と Rush を共通にするか（別 Issue 化の要否）。
3. **P4 入力ロック 300 ms**: 長さ、およびロック中の見た目（`disabled` のみか、視覚的に区別するか）。
4. **P3 / O8 glow 削除**: Issue 本文では「最終実装ゲートで確認」。glow を完全廃止してよいか最終確認。
5. **P6 針の色**: 常にニュートラルで確定してよいか（状態色を完全廃止する副作用）。
6. **P7 キャプション**: 3〜5 秒でニュートラル文へ切替える方針でよいか。
7. **P5 の clamp 値** `0.1 s` と、背景中に凍結する方針（Rush クロックは壁時計のまま進む非対称を含む）。
8. **Bake スコア分布の上振れ（§4.4）**: 針が遅くなり target 窓の通過が約 5.5 倍長くなる。式は触らない前提で良いか、別 Issue で再較正するか。
9. **Dinner Mission**: 同一 `BakeOverlay` を使うが、Dinner 固有の時間制約・演出との相互作用は本書では未調査（監査の再実行をしない制約のため）。HV で確認し、問題があれば別 Issue。
10. **`bakeGuideFade.ts` の名称整理**: 事実上 CUT 専用になる。リネームは別 Issue（本件では触らない）。
11. **終端保持の見た目強化**: 保持中に追加の演出（焦げ表示以外）を付けるかは未定（現仕様は追加なし）。
12. **実装着手条件**: #418 の Owner HV PASS 待ち。

---

## 9. 実装ファイル見取り図（参考。実装 PR 用）

| 変更 | ファイル |
|---|---|
| 変更 | `src/components/BakeOverlay.tsx`（rAF ループ、ゾーン opacity、glow 削除、ロック、ラッチ、背景処理、針色） |
| 新規 | `src/logic/bakeProgress.ts` / `.test.ts` |
| 新規 | `src/logic/bakeZoneFade.ts` / `.test.ts` |
| 変更（必要時のみ） | `src/App.tsx`（`handleBakeTick` の終端値の取りこぼし対策のみ） |
| 変更（必要時のみ） | `src/App.css`（ゾーンのみ opacity、ニュートラル針色、disabled 見た目） |
| 更新 | `src/components/BakeOverlay.test.tsx`、`e2e/layout-contract.spec.ts`（定数の意味更新）、新規 E2E |
| **変更禁止** | `src/logic/bakeGuideFade.ts`、`PizzaStage.tsx` の CUT ガイド、`src/logic/bake.ts`、`src/logic/scoringV2/*`、`src/data/recipes.ts`、reducer の `CONFIRM_BAKE`、save / economy / Research |
