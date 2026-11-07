# FOLD＋SEAL「包む」詳細設計・受入条件（docs-only、Refs #773、T6 続き）

2026-11-07、main `06cfc06`（不変を確認）、branch `claude/teto-pizza-t5-t6-r9qup3`。
根拠: Owner 決定 #773 コメント 6703581625（FOLD＋SEAL を次の新調理操作の**設計候補**に選定）／Owner 指示 6703584772（本書の範囲）。claim は同 session + issue の更新（コメント 6703596787、`TETO_COOKING-OP_T6_*` ＋ `TETO_FOLD-SEAL_*`）。
**新規ファイル 1 本のみ。`src/`・`e2e/`・CSS・golden・既存 docs は未変更。reducer／runtime／保存／採点に触れない。PR・merge・Production ON・共有 Preview 更新なし。**
HV: docs-only のため対象外（HV Policy §2）。本書の操作契約は**机上の設計で未検証**。統合の前に iPhone 実機 HV が必須（§8）。
ラベル: 【実測】= main のコードで確認、【先行】= 既存設計書の記述、【推論】= 設計上の見込み、【暫定】= 初期値（HV で調整）、【未確認】。

先行資料（重複させない）: `TETO_COOKING-OP_T6_New-Process-Design_2026-11-07.md`（候補選定と優先順位）、`docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md` §3.2・§4（FOLD／SEAL は step）。

---

## 0. 結論と範囲

1. **操作契約**: 折りは「蓋側（上半分）をつかみ、親指で下へ弧を描くように引き下ろす」。指の位置が折り角度を**直接決める**（縁が指に貼り付く）。封止は「折り縁（下半分の外周）を指でなぞる」。どちらも**失敗状態なし**。離す／中断すると折りは戻り、封止は進捗が残る。
2. **代替操作**: 折りは「折る」ボタン、封止は「とじる」ボタン（1 回で縁の 1/4 ずつ）。キーボード・スクリーンリーダー・Switch Control・ドラッグが難しい人向け。ドラッグと**同じ状態機械・同じ結果**に落とす。
3. **純粋状態機械**: 入力は正規化済みの点とイベントのみ、時刻は引数で受ける、DOM／reducer／保存を知らない。`src/logic/foldSeal/**` の新規ファイルとして将来作る前提で、インターフェースを §5 に固定。
4. **封止不足は見た目のみ**: 縁のすき間・湯気／中身のはみ出しとして描くだけ。採点・完成判定・Dex・在庫・保存・Research の識別・ヒントに**一切流さない**（§7、構造テストで固定）。
5. **DEV 限定の実験計画**（§8）: 本番バンドルに入口名を残さないゲート、独立の実験画面、計測項目、HV チェックリスト。**本番化ゲート**（§9）は 8 項目で、全て Owner 承認が絡む。
6. **calzone の構成は UNDECIDED のまま**（§10）。原典と重複の監査が先。事前情報として、172 行どおりの集合は既存 `calabresa-argentina` と Jaccard 0.5 で、現行の規則（≤ 0.4）を超える点を記録する（決定ではない）。

---

## 1. 重複・claim の確認（2026-11-07 時点）

| 追跡 | 範囲 | 本書の関係 |
|---|---|---|
| FRY #749 | `src/logic/fry/**`、F2 以降 HOLD | 触れない。入力語彙は別（泡を見て取り出す） |
| DRIZZLE #579／PR #746・#776 | `src/preview/*` の Lab、`src/main.tsx`、D1 純粋ロジック | 触れない。**SEAL の縁なぞりは DRIZZLE の線描画と指の動きが近い**ため、HV で区別を確認（§8、HV-3）。実験画面は #746 の入口方式（`src/main.tsx`）に依存しうる（§8.1） |
| DOUGH KIND #577／PR #775 | `DOUGH_KINDS`、Piadina／Pinsa | 触れない。厚い生地が前提の fugazzeta／chicago-stuffed は DOUGH KIND 待ちで対象外 |
| STEAM #726／PR #738 | HOT: `App.tsx`・`GameScreen.tsx`・`PizzaStage.tsx`・`src/main.tsx` | 触れない。F4 の統合はこの HOT 群の解消後 |
| #772／T1 #774／T2 #780 | `TETO_CONTENT-POOL_*`、catalog ファイル、`TETO_POOL-REJUDGE_87_*` | 触れない。calzone の追加は catalog lane の直列化後 |
| #773 の C1（`TETO_NEW-PROCESS_*`） | 別名前空間 | 別名で衝突なし |
| origin のブランチ・main の `fold`／`seal` を含む名前 | ― | **なし**【実測: `git ls-remote`、`ls-tree`】 |

---

## 2. 前提となる座標と寸法

- 座標: `.pizza-dough` の箱の内側をパーセント（0〜100）で表す共通空間。中心 50、理想半径 `DOUGH_RADIUS = 48`【実測: `src/logic/pizzaCoordinates.ts`】。重ね描画（SVG／canvas）も同じ箱を基準にする。
- 生地の輪郭: プレイヤーが伸ばした 8 点の `DoughShape` があり、`doughShapeRadiusAtAngle(shape, angle)` と `isInsideDoughShape` が公開されている【実測: `src/logic/doughShape.ts`】。**封止の縁は固定の円ではなく、この輪郭の下半分**を使う（手で伸ばした形に追従。不規則な形ではそのまま不揃いな縁になる）。
- 画面: 390×844（authority）／360×800（secondary）【先行: HV Policy §3】。箱の実寸は F2 で実測する【未確認】。目安として箱が 320〜340px なら 1 単位 ≈ 3.2〜3.4px【推論】。
- ヒット領域: 既存 CSS は 44px／48px の最小サイズを 41 箇所で使う【実測】。本書の最小操作領域も **44px 以上**。
- ジェスチャの土台: 既存は `touch-action: none` の層、`setPointerCapture`、`pointercancel`、window レベルの pointerup 保険、2 本目の指は無視、を使う【実測: `PizzaStage.tsx`、`SearLayer.tsx`】。**同じ作法**に揃える。

以降、距離の単位は「箱の単位（0〜100）」。px は目安。

---

## 3. タッチ操作契約

### 3.1 配置の約束（初版、【暫定】）

- 折り線は常に**水平の直径（y = 50）**。プレイヤーは選ばない。
- **具を乗せる側は下半分**（親指に近い側）、**蓋になる側は上半分**。下から上へ折ると親指が生地を隠すため、蓋を手前（下）へ引き下ろす。実際の作業（奥の生地を手前に折り返す）にも合う【推論】。
- 上半分には具を置かない（TOPPING 側の領域制限。calzone の TOPPING modifier として別設計、本書の対象外）。

### 3.2 折り（FOLD）

| 項目 | 契約 |
|---|---|
| つかみ始め | 蓋側（y ≤ 50 − `D_MIN`）かつ生地輪郭の内側＋余白 `GRAB_MARGIN` 内で pointerdown。`D_MIN = 14`（≈ 45px、これより折り線に近いと角度が不安定）、`GRAB_MARGIN = 6`【暫定】。範囲外は無視し、「上の生地をつかんで下へ」と案内を出す（失敗扱いにしない） |
| 追従 | つかんだ点の折り線からの距離 `d = 50 − y_start`。指の現在 y（`y_f`）から `cosθ = (50 − y_f) / d` を `[-1, 1]` にクランプして折り角度 `θ = acos(·)` を得る（θ: 0＝開、π＝完全に折り返し）。**指の y が角度を直接決める**ので、縁が指に貼り付いて見える。横方向の動きは無視（縦成分のみ使う） |
| 引き上げ | 指を戻せば θ も戻る（可逆）。つかんだ位置より上はクランプ（θ = 0） |
| 確定 | **離した時**に `θ ≥ θ_COMMIT`（`0.88π`、指が折り線の下側 ≈ `0.93 d` に達する位置）なら折り完了、閉じる方向へスナップ（`SNAP_MS = 180`）。届いた時点で「ぱたん」の合図（触覚は使わない・見た目のみ）を出すが、確定は離した時 |
| 不足 | `θ < θ_COMMIT` で離したらバネ戻り（`RETURN_MS = 200`）、状態は `idle` に戻る。ペナルティなし |
| 多点 | 2 本目の指は無視（pointerId を固定）。指が 2 本触れても 1 本目の追従は続く |
| 中断 | `pointercancel`、`blur`、`visibilitychange: hidden`、向き／サイズ変更で CANCEL（`idle` に戻す） |
| スクロール | 蓋側の生地層だけ `touch-action: none`。ページ全体のスクロールやピンチは殺さない |

### 3.3 封止（SEAL）

折り完了後、縁は**下半分の外周（輪郭の下側の半円）**になる。

| 項目 | 契約 |
|---|---|
| 縁の分割 | 下半円を `SEAM_BINS = 36` 個のビン（5° ずつ。半径 48 で 1 ビン ≈ 4.2 単位 ≈ 14px）に分ける。角度 `φ` は縁の左端 = 0、右端 = π |
| 判定帯 | 指が縁から半径方向に `±SEAM_BAND`（`8` 単位 ≈ 26px、片指で覆い隠すのを許す広さ）以内にいる間だけ、通過したビンを「とじた」とする【暫定】 |
| 速い動き | 前回サンプルと今回サンプルが**共に帯内**なら、その間の角度のビンを全て埋める（補間）。片方が帯外なら埋めない（中を横切っても進捗にならない） |
| 方向・順序 | 任意（左右どちらからでも、途中からでも）。重複は無害 |
| 進捗 | `coverage = とじたビン数 / 36`。**離しても保持**、取り消さない。中断（cancel）でも保持 |
| すき間 | 連続する未封止ビンの列（run）を `openRuns` として導出。見た目に使う（§7） |
| 完了 | 縁を一周する必要はない。**折り完了後は封止の質に関わらず BAKE へ進める**。「このままにする」で明示的に進められる |
| 多点・中断 | §3.2 と同じ |

### 3.4 横幅 360 での確認項目（設計時点の見積もり）

360×800 では箱が小さくなり、`D_MIN`・`SEAM_BAND` の px 換算が約 8％ 小さくなる【推論】。44px 規則を満たすため px 下限を併用する（`max(単位換算, 44px)`）。F2 で 390／360 の両方を実測して確定する。

---

## 4. タップ／アクセシビリティ代替

ドラッグを前提にしない入口を**同じ状態機械**に用意する（結果が同じになるよう、イベントを共通にする）。

| 操作 | 代替 | 挙動 |
|---|---|---|
| 折る | 「折る」ボタン（44px 以上、折り線のすぐ下の親指圏） | `FOLD_BUTTON` で θ を 0 → π へ `FOLD_BUTTON_MS = 400` でアニメーション、完了で `folded`。`prefers-reduced-motion` では即時。Enter／Space で作動 |
| あけなおす | 「あけなおす」ボタン（折り完了後に表示） | `REOPEN`。折りを戻し、封止の進捗は破棄 |
| 封止 | 「とじる」ボタン | 1 回で縁の 1/4（9 ビン）を左から順にとじる。4 回で全周。連打は無害。Enter／Space で作動 |
| 先へ | 「このままにする」／「次へ」 | 封止を終える（`SEAL_SKIP`）。封止不足は見た目のみ（§7） |
| 状況の読み上げ | `role="status"` `aria-live="polite"` | 「折りました」「縁を 50％ とじました」。ビン数ではなく割合を 25％ 刻みで読む |

- ボタン代替は**結果の質が劣らない**（全周が 1/4 ずつ埋まる）。ただし「ドラッグの方が上手」の差を作らない・罰しない設計にするため、見た目の差は付けない。
- 既存の CUT は「tap の結果」を持たず、DOUGH にもキーボード同等がまだ無い【実測: `PizzaStage.tsx` のコメント】。**FOLD＋SEAL は最初から代替を持つ**（新規の基準を作る）。
- VoiceOver 等でドラッグを実行できない場合の想定は F3 の HV に含める（§8.3、HV-6）。

---

## 5. 純粋状態機械インターフェース（設計のみ）

将来 `src/logic/foldSeal/` に**新規ファイルのみ**で置く想定（`foldSealGeometry.ts`・`foldSealMachine.ts`・`foldSealSeam.ts` と各テスト）。reducer／runtime は変更しない。入力は正規化済みで、DOM・時刻・乱数・保存・採点・catalog を import しない。

```ts
// 座標は箱の単位 (0..100)。角度はラジアン。
export interface FoldSealGeometry {
  center: { x: 50; y: 50 };
  /** 折り線は y = 50 固定。輪郭の下半分を縁にする。 */
  radiusAt(angle: number): number;          // doughShapeRadiusAtAngle を包む
  contains(x: number, y: number, margin: number): boolean;
}

export type FoldSealPhase = "idle" | "folding" | "folded" | "sealing";
export type FoldVia = "drag" | "button";

export interface FoldSealState {
  phase: FoldSealPhase;
  /** 0 (open) .. π (folded). folded 中は π。 */
  foldAngle: number;
  grab: { pointerId: number; startY: number; d: number } | null;     // folding のみ
  seal: {
    bins: ReadonlyArray<0 | 1>;               // 長さ SEAM_BINS
    pointerId: number | null;                 // sealing のみ
    lastAngle: number | null;                 // 補間用。帯外なら null
    buttonStep: 0 | 1 | 2 | 3 | 4;            // 代替操作の進み
  };
  foldedVia: FoldVia | null;
  sealSkipped: boolean;
  /** 前段（生地・ソース・具）が変わったら増える。変わったら全て破棄。 */
  inputsRevision: number;
}

export type FoldSealEvent =
  | { type: "FOLD_DOWN"; pointerId: number; x: number; y: number }
  | { type: "FOLD_MOVE"; pointerId: number; x: number; y: number }
  | { type: "FOLD_UP"; pointerId: number }
  | { type: "FOLD_BUTTON" }                   // 代替：完了まで進める
  | { type: "REOPEN" }                        // folded -> idle（封止は破棄）
  | { type: "SEAL_DOWN"; pointerId: number; x: number; y: number }
  | { type: "SEAL_MOVE"; pointerId: number; x: number; y: number }
  | { type: "SEAL_UP"; pointerId: number }
  | { type: "SEAL_BUTTON" }                   // 代替：縁の 1/4 を進める
  | { type: "SEAL_SKIP" }
  | { type: "SEAL_RESET" }                    // 封止の進捗だけ消す
  | { type: "CANCEL" }                        // pointercancel / blur / hidden / resize
  | { type: "INVALIDATE"; revision: number }; // 前段の変更

export function createInitialFoldSealState(revision: number): FoldSealState;
export function foldSealReduce(s: FoldSealState, e: FoldSealEvent, g: FoldSealGeometry): FoldSealState;

// 導出（純粋）
export function foldAngleFromFinger(yFinger: number, d: number): number;      // acos(clamp((50 - y)/d))
export function isFoldCommitted(angle: number): boolean;                      // angle >= θ_COMMIT
export function sealCoverage(s: FoldSealState): number;                       // 0..1
export function sealOpenRuns(s: FoldSealState): ReadonlyArray<{ from: number; to: number }>;
export function stepIsComplete(s: FoldSealState): boolean;                    // phase==="folded"（封止の質は問わない）
export interface FoldSealVisual { foldAngle: number; openRuns: ReadonlyArray<{ from: number; to: number }>; }
export function foldSealVisual(s: FoldSealState): FoldSealVisual;             // 描画用の唯一の出口
```

遷移（`INVALIDATE` と `CANCEL` は §6 を参照）:

| 現在 | イベント | 次 | 備考 |
|---|---|---|---|
| idle | FOLD_DOWN（つかみ範囲内） | folding | `grab` を記録。範囲外は無視（state 不変） |
| folding | FOLD_MOVE（同 pointerId） | folding | `foldAngle` 更新 |
| folding | FOLD_UP（commit 以上） | folded | `foldAngle = π`、`foldedVia = drag` |
| folding | FOLD_UP（commit 未満）／CANCEL | idle | `foldAngle = 0` |
| idle | FOLD_BUTTON | folded | `foldedVia = button` |
| folded | SEAL_DOWN（帯内） | sealing | `pointerId` を記録 |
| sealing | SEAL_MOVE | sealing | 補間してビンを埋める |
| sealing | SEAL_UP／CANCEL | folded | **進捗は保持** |
| folded | SEAL_BUTTON | folded | `buttonStep` を 1 進め、対応する 9 ビンを埋める |
| folded | SEAL_SKIP | folded | `sealSkipped = true` |
| folded | SEAL_RESET | folded | ビンと `buttonStep` を 0 に |
| folded | REOPEN | idle | 封止は破棄 |
| any | INVALIDATE（revision が変化） | idle（初期化） | 前段の編集で全て破棄 |
| 他 | 上記以外 | 不変 | 範囲外・別 pointerId・不正な順序は無視（例外を投げない） |

不変条件（テストで固定する）: ①`foldAngle ∈ [0, π]`、②`phase === "folded"` ⇒ `foldAngle = π`、③`bins` の長さは `SEAM_BINS` で 0／1 のみ、④`coverage` は単調（RESET／REOPEN／INVALIDATE 以外で減らない）、⑤`pointerId` が違うイベントは状態を変えない、⑥同じイベント列は常に同じ結果（純粋）、⑦非有限数・NaN の座標は無視。

---

## 6. エッジケース・中断・再試行・保存／再開

| 場面 | 扱い |
|---|---|
| 2 本目の指 | 無視（1 本目の追従は継続） |
| 蓋の外で pointerdown | 無視＋案内。state は不変 |
| 指が生地の外に出る | pointer capture で追従を継続。y をクランプ |
| 指を折り線より上へ戻す | θ → 0。離せば `idle` |
| 折り中の pointercancel（通知・着信・システムジェスチャ） | CANCEL → バネ戻りで `idle` |
| 封止中の pointercancel | CANCEL → `folded`、**進捗は保持** |
| `blur`／`visibilitychange: hidden`／向き変更／リサイズ | CANCEL。封止の進捗は保持、箱の座標は再計算 |
| 折り完了後に前段（生地・ソース・具）へ戻って編集 | `INVALIDATE` で折りと封止を全破棄し、折り線から再開（折った状態で具が変わると見た目と状態が食い違うため） |
| 「あけなおす」 | `REOPEN`。具はそのまま、封止は破棄。回数制限なし |
| 封止のやり直し | `SEAL_RESET`。回数制限なし |
| BAKE 確認後 | 折り・封止の状態は焼成の見た目の入力としてのみ使われ、確認後は読み取り専用（変更不可） |
| **保存・再開** | **この状態は保存しない。** 理由: ①Owner 決定「保存ロジックは変えない」。②保存の `pendingRound` は `CONFIRM_BAKE` 後（CUT／FINISH の前）の焼成済みピザだけを記録する【実測: `src/state/pendingRound.ts` の冒頭】ため、焼成前の途中状態はそもそも保存対象外。再読み込み・復帰時は折る前から再開し、他の焼成前の工程と同じ扱い |
| 再読み込み後の整合 | 状態は `createInitialFoldSealState` から始まる。journal に折り・封止の項目は**追加しない**（スキーマ変更なし）|

【未確認】焼成前の途中状態を一時保管する仕組みが他にあるか（F4 の Fresh Audit で `persistence.ts`／ラウンド復帰を確認する）。あった場合も、この状態を載せるかは別途 Owner 判断。

---

## 7. 封止不足は「見た目のみ」

### 7.1 見せ方（案）

| 状態 | 見た目 |
|---|---|
| 全周とじた | 縁がなめらかな一本線（焼きで少し膨らむ） |
| すき間あり（`openRuns`） | その区間だけ縁が浮き、焼成中に湯気／チーズ／ソースが**少し**はみ出す。すき間の長さで量が増える（連続 3 ビン以上＝ 15° 以上のすき間から表示）【暫定】 |
| 封止ゼロ（スキップ） | 縁全体が口を開けた状態で焼き上がる（ただし破綻させない。中身が落ちるなどの失敗演出は付けない） |

- 見た目は **BAKE の描画と RESULT のピザ絵**に反映する案。どこまで描くかは描画実装量が最大のため F2 の Lab で先に確認する。
- 失敗演出（爆発・焦げ・中身が出る）は初版では付けない。STEAM／FRY／炙りと同じ「失敗状態なし」の方針。

### 7.2 流さないもの（明示）

`foldSealVisual()` が唯一の出口。次の全てに**値を流さない**:

採点（Scoring 2.0 の全成分）／完成判定（Completion Gate）／Dex・BEST・Pitz／在庫の消費／保存（`pendingRound`・save v2）／Research の識別と cohort ラベル／Discovery ヒント／ランキング・Lunch Rush／実績。

### 7.3 構造テスト（将来の F1 で追加。本書は計画）

- `foldSeal` モジュールが `scoring`・`economy`・`persistence`・`discovery`・`state/**` を import しないこと（`searIngredient.architecture.test.ts` と同型の静的テスト）【先行: 既存の同型テストあり】。
- 同じ折り・封止の入力でも、`scorePizza` 系・`saveGame` の出力が**変わらない**こと（ゴールデン比較）。
- 本番バンドルに実験の入口名が残らないこと（§8.1）。

---

## 8. DEV 限定の実験計画・計測・HV

### 8.1 構成（将来、新規ファイル中心）

| 要素 | 内容 |
|---|---|
| 入口 | Preview／DEV 限定のクエリ（例 `?foldSeal=on`）。`import.meta.env.DEV || VITE_PREVIEW_MODE` の静的判定の背後に置き、**本番 build に入口名を残さない**。タブ内記憶（sessionStorage）と `?foldSeal=off` で解除。`searPreview.ts`／`searPreview.gate.test.ts` と同型【実測: 既存の型】 |
| 本番スイッチ | `FOLD_SEAL_EXPERIENCE_PRODUCTION = false`（`searExperienceGate.ts` と同型）。巻き戻しはリテラルを戻すだけ |
| 実験画面 | ゲームに統合しない独立の画面（DRIZZLE の Gesture Lab #746 と同型）。生地＋具のダミー、折り・封止、リセット、計測表示、390／360 の枠表示。保存・採点・在庫に触れない |
| 状態機械 | §5 の純粋モジュールを使う（単体テストを先に通す） |
| 依存と干渉 | 実験画面のマウントは既存の入口（`src/main.tsx`、または `App.tsx` の `*HvStarter`）を編集する必要がある【実測: `CookSearHvStarter` は `App.tsx`／`main.tsx` から呼ばれる】。この 2 ファイルは #738／#746 と HOT 共有なので、**F2 は #738／#746 の merge 順を確認してから**。ファイル自体は新規（`src/preview/foldSeal*`）で名前は衝突しない |

新規ファイル案（将来、本書では作らない）: `src/logic/foldSeal/{foldSealGeometry,foldSealMachine,foldSealSeam}.ts` と各 `.test.ts`、`src/data/foldSealExperienceGate.ts`、`src/preview/foldSealPreview.ts`・`foldSealPreview.gate.test.ts`・`FoldSealLab.tsx`。

### 8.2 計測項目（Lab の画面と記録。保存・送信しない）

| 区分 | 項目 |
|---|---|
| 折り | 初回で折れた割合／折るまでの時間／つかみ範囲外のタップ回数／途中で離した回数／バネ戻り回数 |
| 封止 | 最終 coverage／封止にかけた時間／帯外に出た回数／`SEAL_RESET` 回数／スキップの有無 |
| 代替操作 | 「折る」「とじる」ボタンの使用回数 |
| 環境 | 画面サイズ（390×844／360×800）、向き、`prefers-reduced-motion` の有無 |

記録は画面内の表示とメモだけ。ネットワーク送信・localStorage 保存はしない（sessionStorage は入口の記憶のみ）。

### 8.3 HV チェックリスト（iPhone Safari、実機、390×844 を主、360×800 を副）

| # | 確認 | 合格の目安（【暫定】） |
|---|---|---|
| HV-1 | 折りのドラッグが親指 1 本で迷わず成立する（片手持ち） | 初見で 10 回中 8 回以上、説明なしで折れる |
| HV-2 | 指が生地を隠しても折り角度と縁の位置が読める（手の影） | 折りの進み具合を指の外から見て取れる |
| HV-3 | 封止の縁なぞりが、DRIZZLE の線描画・ソース塗りと**別の操作**に感じる | 区別できるとの Owner 判定 |
| HV-4 | 封止の帯が広すぎ／狭すぎない（なぞった所だけ進み、横切りは進まない） | 一周に 3〜8 秒、意図しない進捗が出ない |
| HV-5 | 誤作動なし: ページのスクロール、Safari の戻る（画面端スワイプ）、ピンチ、ラバーバンド | 折り・封止中に発生 0 |
| HV-6 | 代替操作（ボタン）が単独で完了でき、VoiceOver で読める | 全工程をボタンのみで完了 |
| HV-7 | `prefers-reduced-motion`、横向き、ノッチ／ホームインジケータ近傍 | 破綻なし |
| HV-8 | 封止不足の見た目が「失敗」に見えず、納得感がある | Owner 判定 |
| HV-9 | 既存操作（ソース塗り・トッピング・CUT）への回帰なし | 統合後（F4）にのみ実施 |

### 8.4 手順の制約

- 共有 Preview の更新は**別途 Owner 承認が必要**（本書は申請しない）。F2 は承認後に専用ビルドで実施。
- 動画は repo に commit しない（HV Policy §6）。静的画像は `docs/reports/screenshots/<task-name>/` に置く。
- HV の結果語（PASS／FAIL／waived）は Owner のもので、セッションは書かない【先行: SESSION-OPERATIONS §3】。

---

## 9. 本番化ゲート（全て満たすまで統合・本番 ON をしない）

| # | ゲート | 状態 |
|---|---|---|
| G1 | F3（実機 HV）で §8.3 の HV-1〜8 が Owner の PASS | 未実施 |
| G2 | 統合 PR の HOT 衝突の解消（`GameScreen.tsx`／`PizzaStage.tsx`／`gameReducer.ts`／`App.tsx`／`src/main.tsx` の #738・#746・#749・#579 とのマージ順を明記） | 未 |
| G3 | CI の既存 11 チェック全てと WebKit Gate（390×844・360×800 の両方）が緑。待機・再実行で隠さない | 未 |
| G4 | 最新 head に対する Codex 指摘 0（旧 head の receipt は流用しない） | 未 |
| G5 | 「保存・採点・識別に何も流れない」構造テストとゴールデンが緑（§7.3） | 未 |
| G6 | 円形前提の採点と CUT との整合の決定（折った形＝半円は CUT 対象外のままか、別評価か）。`CUT_ELIGIBLE_RECIPE_IDS` は非円形の追加を禁じている【実測】 | 未決 |
| G7 | calzone の構成が原典・重複監査を経て Owner 決定済み（§10） | 未決 |
| G8 | **別途の Owner 承認による Production ON**（リテラル 1 つ、巻き戻し可能）。Preview も Owner 承認後のみ | 未 |

---

## 10. calzone の構成 — UNDECIDED

Owner 決定どおり、構成は未決。決める前に必要な監査のチェックリストと、現時点で分かる事実だけを記録する（決定ではない）。

### 10.1 監査チェックリスト

1. **原典**: pizzadb.jp の個別ページ（172 行の `calzone-pizzadb` は比較表のサンプルで、状態は BLOCKED_PRODUCT_DECISION【実測】）。この環境から pizzadb.jp には到達できなかった実績がある【先行・未確認】ため、到達できなければ URL とエラーを報告して ChatGPT 側の調査に渡す（SESSION-OPERATIONS §8.2）。推測で決めない。
2. **重複検査**: 完全一致・部分集合・上位集合・1 材料差・Jaccard ≤ 0.4（現行規則）。
3. **識別の扱い**: 「包んだか」を識別軸に入れるか。入れない初版なら、同じ材料の開いたピザとは**別レシピにならない**ため、材料の集合が既存と重ならないことが必須。
4. **ソースの位置**: 中（生地の間）か外（焼成後にかける）か。
5. **新食材の要否**: 172 行は新食材 0。ricotta・salami は既存【実測】。
6. **ラダー／Research への影響**: 通常 ladder に載せるなら step 番号・Research ラベルの測定（B19／B20 の後、catalog lane の直列化）。

### 10.2 事前情報（main `06cfc06` の静的 Jaccard、材料 id の集合のみ【実測】）

| 案（検討用、候補ではない） | 最大 Jaccard | 近傍 | 同一／部分／上位／1 材料差 |
|---|---|---|---|
| 172 行どおり: mozzarella・ricotta・salami・tomato-sauce | **0.5** | calabresa-argentina（対称差 3） | なし |
| ソース無し: mozzarella・ricotta・salami | 0.4 | pizza-bianca-ricotta（対称差 3） | なし |

読み方: 172 行どおりの集合は現行規則（≤ 0.4）を超え、Owner 方針「例外は原則認めない」に当たる。構成を変える（材料の追加・削除）か、識別軸に「包む」を入れる決定が要る可能性がある。**これは論点の提示であり、構成の提案ではない。**

---

## 11. 受入条件（F1 以降の実装 PR 用）

| # | 条件 | 該当 |
|---|---|---|
| AC-1 | 純粋モジュールが §5 のインターフェースと不変条件を満たす（単体テスト、境界値：D_MIN、commit 閾値、帯の端、補間、NaN） | F1 |
| AC-2 | 同一イベント列で常に同一結果（純粋性）。DOM・時刻・保存・採点を import しない（構造テスト） | F1 |
| AC-3 | 保存・採点・識別・在庫・Dex への出力が変わらない（ゴールデン／構造テスト） | F1・F4 |
| AC-4 | 本番バンドルに入口名（クエリ名）が残らない。Preview バンドルには残る（正の対照）。ゲートテスト | F2 |
| AC-5 | 実験画面が保存・ネットワーク送信をしない | F2 |
| AC-6 | ボタン代替だけで折り・封止が完了し、スクリーンリーダーで状況が読める | F2・F3 |
| AC-7 | 390×844・360×800 の両方で最小操作領域 44px 以上、横スクロールなし | F2・F4 |
| AC-8 | §8.3 の HV が Owner の PASS | F3 |
| AC-9 | calzone の構成が決定済み、重複検査と Research ラベル測定が完了 | F5 |
| AC-10 | 既存 FRY／DRIZZLE／STEAM／炙り／炒め／CUT の挙動が不変（回帰テスト） | F4 |

---

## 12. 残る Owner 判断・ブロッカー

### 12.1 Owner 判断（まとめて、推奨つき）

| # | 判断 | 推奨 |
|---|---|---|
| FS-1 | 折り線の向き（水平固定・下に具、上が蓋）と、引き下ろし方式 | 初版は水平固定・引き下ろし。F3 で左右反転や縦折りと比較 |
| FS-2 | SEAL を FOLD と別の `MakingStep` として出すか、同一画面の副段階にするか | **同一画面の副段階で開始**（タブ上限 6 と縦余白 0px の制約。予約済みの `SEAL` は将来の分離用に残す）|
| FS-3 | 折り完了後、封止の質に関わらず BAKE へ進める（スキップ可）か | 進める（Owner 決定「見た目のみ」に整合） |
| FS-4 | 前段を編集したら折りと封止を全破棄する（`INVALIDATE`）か | 破棄 |
| FS-5 | 封止不足の見た目の強さ（すき間の閾値 15°、はみ出しの量） | HV で決める。初版は控えめ |
| FS-6 | 折った半円の形と CUT・円形採点の扱い（G6） | 初版は CUT 対象外のまま。採点の円形前提との整合は F4 前に Fresh Audit |
| FS-7 | F2 用の共有 Preview 更新 | 都度 Owner 承認（本書は申請しない） |
| FS-8 | calzone の構成（§10）。原典と重複監査の担当 | 原典到達の可否を先に確認。Jaccard 0.5 の扱いを Owner が先に判断 |

### 12.2 ブロッカー

- **F1（純粋ロジック）**: 実装は**未承認**。Owner の追加指示が必要（本指示は docs-only）。
- **F2（Lab）**: 共有 Preview 更新の承認と、`src/main.tsx`／`App.tsx` の HOT 編集が #738／#746 と衝突しない順番の確認。
- **F3（実機 HV）**: F2 が前提。実機操作は Owner 側の作業。
- **F4（統合）**: HOT 群の解消、G6、calzone 構成。
- **F5 以降**: T1（Batch 19）／B20 の catalog lane の直列化。
- 原典（pizzadb.jp）の到達性: 未確認。

---

## 13. 未確認・限界

- 本書の操作契約・数値（`D_MIN`・`GRAB_MARGIN`・`θ_COMMIT`・`SEAM_BINS`・`SEAM_BAND`・各 ms）は**全て暫定で未検証**。実機の親指の可動域・手の影・端スワイプとの干渉は F3 まで不明。
- 箱の実寸（390／360）と px 換算は未実測。
- `PizzaStage.tsx`／`GameScreen.tsx`／`gameReducer.ts` の内部は精読していない（HOT で他の claim と干渉しうる）。F4 前に Fresh Audit が必要。
- 焼成前の途中状態の保管の有無（§6）は未確認。
- 描画（折りの 3D 的な見え方、すき間の表現）の実装量は未見積もり。
- テスト・build は未実行（docs-only）。
