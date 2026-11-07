# T9 — D-A′（方向巡回）と C-A′（アーム付き）の設計更新

Status: **docs-only の設計。実装なし。コード・CSS・golden・reducer・保存・採点・既存 docs 未変更。PR・merge・Production ON・共有 Preview 更新なし。机上の設計で、実機・本番ビルドとも未検証。**
Branch `claude/teto-pizza-t7-t9-audit-12by6f` / 基準 `main` `06cfc06` / Issue #784 / claim: #784 コメント 6705037361（`TETO_COOK-OPS_T9_*`）。
根拠: Owner 決定 #784 コメント 6705238154（D-A→D-A′、C-A→C-A′ の設計 GO。**CUT のタップはアームされるまで no-op（#418 と整合）**。自然なジェスチャを保つ。T6 の C1〜C14／C12（色以外の手掛かり）を維持。#764・#766 を新規操作の統合より先に）。
前提書: `TETO_COOK-OPS_T9_Design-Review_DA-SA-CA_2026-11-07.md`（レビュー）、`TETO_COOK-OPS_T9_Input-Contract_Alt-Controls_2026-11-07.md`（C1〜C14）。T6 `TETO_FOLD-SEAL_Design-Acceptance_2026-11-07.md`（branch `claude/teto-pizza-t5-t6-r9qup3`、読み取りのみ）。

## 0. 使った数値の出所（重要）

§1 の表は、**既存の純粋関数を使い捨てのスクリプトで呼んで得た計算値**（実機でも、ゲーム画面の操作でもない）。スクリプトは repo 外の作業ディレクトリに置き、**コミットしていない**（`src/` への追加なし）。値は main `06cfc06` の `doughShape.ts`・`trace.ts` に対するもの。人の腕前や実機の操作感を示す数値ではない。

## 1. 既存の仕様（コード実測）

### 1.1 生地（`src/logic/doughShape.ts`）

| 項目 | 値 |
|---|---|
| 輪郭の点数 | 8（`DOUGH_SHAPE_POINTS`） |
| 初期半径 | 18.24（`DOUGH_RADIUS 48 × 0.38`）。初期の進捗 0.38 |
| 完成のしきい値 | 進捗 0.75（`DOUGH_COMPLETION_THRESHOLD`）。UI だけのゲート（reducer は不問） |
| 半径の下限／技術上限 | 10／58（理想の円 `DOUGH_RADIUS` は 48） |
| `applyStretchPoint(shape, x, y)` | 点から最も近い方向を中心に隣接も滑らかに寄せ、**1 回の適用で隣の平均から ±`STRETCH_SPIKE_MAX_DELTA` を超えない**。縮むこともある（D3A） |

【計算値】縁（半径 46）を 8 方向に 1 回ずつタップした進捗: 0.491→0.572→0.645→0.718→**0.789（5 回目で完成）**→0.855→0.903→0.930。同じ方向を繰り返しタップすると半径は 30.24→42.24→46（**1 タップで最大 +12**）。

### 1.2 CUT（`src/logic/cut/trace.ts`）

| 項目 | 値 |
|---|---|
| 最小長 `TRACE_MIN_LENGTH` | 8（生地内で測った経路長）。未満はタップ扱いで**無視** |
| 確定される線 | `buildTracedCutLine(path)` ＝ 始点と終点から `buildRimToRimCutLine`（リムからリムの弦）を作る。**2 点の位置が方向を決め、線は縁まで延長される** |
| タップ | 「CUT has no tap outcome」（#418）。誤タップは何も起こさない |

## 2. D-A′（生地・方向巡回）

### 2.1 位置づけ

自然なジェスチャ（ドラッグ／縁タップ）は**そのまま残す**。D-A′ は、ポインタ操作が難しい人・キーボード／スイッチ／VoiceOver 向けの**任意の入口**。**結果は自然なジェスチャと同じ関数（`applyStretchPoint`）で作る**ので、等方ボタンのような「整った円になる」差は生じない（C2）。

### 2.2 UI の骨子（折りたたみ。詳細は `TETO_COOK-OPS_T9_Collapsed-Controls_OneScreen-A11y-Review_2026-11-07.md`）

- 「📐 ボタンで調整」（折りたたみの見出し。既定は閉）。開くと、1 行に 4 ボタン: 「◀ 前の方向」「ひろげる ＋」「ちぢめる −」「次の方向 ▶」。各 44px 以上。
- 現在の方向は、輪郭上の点を**形（二重丸）**で強調し、方向名を文字で表示（例: 「右上」）。色だけに頼らない（C12）。

### 2.3 状態機械（純粋）

```ts
// 座標は箱の単位。時刻・DOM・reducer・保存を知らない（C1）。
export interface DoughAltState {
  dir: 0|1|2|3|4|5|6|7;        // 8 点の添字（角度 = dir/8 × 2π）
  shape: DoughShape;           // 常に applyStretchPoint の出力（または初期値）
  steps: number;               // 押した回数（読み上げ・テスト用。保存しない）
  armedRevision: number;       // INVALIDATE 用
}
export type DoughAltEvent =
  | { type: "DIR_NEXT" } | { type: "DIR_PREV" }
  | { type: "STEP"; delta: 1 | -1 }               // ＋／−
  | { type: "SYNC"; shape: DoughShape }           // 自然なジェスチャで形が変わったら取り込む
  | { type: "CANCEL" } | { type: "INVALIDATE"; revision: number };
export function doughAltReduce(s: DoughAltState, e: DoughAltEvent): DoughAltState;
// STEP: r = doughShapeRadiusAtAngle(shape, θ_dir); target = r + delta × Δ;
//        shape' = applyStretchPoint(shape, 50 + cos θ × target, 50 + sin θ × target)
export function doughAltStatus(s): { dirLabelJa: string; percentJa: "0%"|"25%"|"50%"|"75%"|"100%"; complete: boolean }; // 読み上げ（C10）
// 確定は既存 COMMIT_DOUGH_STRETCH(shape)。reducer は変えない。
```

| 現在 | イベント | 次 | 備考 |
|---|---|---|---|
| any | DIR_NEXT／DIR_PREV | dir を ±1（mod 8） | 形は不変 |
| any | STEP(+1／−1) | shape を更新 | 技術上限 58・下限 10 は `applyStretchPoint` が保証 |
| any | SYNC | shape を差し替え | 自然なジェスチャとの併用（C2）。dir は維持 |
| any | CANCEL | **進行中の入力はない**ため no-op（形は保持） | 生地は離散操作。ジェスチャ側の cancel は既存どおり破棄 |
| any | INVALIDATE（revision 変化） | 初期化 | 工程が変わった・やり直した |

不変条件（将来のテストで固定）: ①shape は常に `isValidDoughShape` ②radii ∈ [10, 58] ③STEP は他方向を**滑らかな隣接のみ**動かす（`applyStretchPoint` の保証に従う）④`STEP(+1)` の後に `STEP(−1)` を同じ方向で押しても、隣接の滑らかさのため**完全には元に戻らない**場合がある（自然なジェスチャも同じ性質。可逆性は保証しない）⑤同一入力列なら同一結果（時刻非依存）。

### 2.4 パラメーター Δ（開いた決定）

| Δ | 8 方向を 1 回ずつ巡回して完成までの押下数【計算値】 | 1 方向だけ連打（8 回）【計算値】 |
|---|---|---|
| 4 | 19 | 22→26→30→34→38→42→46→50（滑らかに増える） |
| 6 | 12 | …→58（7 回目で上限）。隣の方向は約 52 |
| 8 | 10 | …→58（6 回目で上限）。隣は約 52 |
| 12 | **6**（自然なタップの 5 回に近い） | …→58（5 回目で上限） |

- 完成時の半径は、Δ=8 で最大 約 52（進捗 1.03）と**理想円 48 を超える**。自然なタップ（半径 46）は 46 で止まる。**D-A′ は「理想円を示す」ことをしない**（Anti-Oracle を保つ）が、ひろげすぎを避けるための上限（`DOUGH_RADIUS` 48 で止める／止めない）は **Owner 判断**。止めると自然なドラッグ（58 まで可）より表現が狭くなり C2 に影響する。
- 推奨（設計案）: **Δ=8、上限なし（自然なジェスチャと同じ 58）**。完成まで約 10 押下で、細かく調整もできる。【推論。操作感は実機で未確認】

### 2.5 エッジケース

| 場面 | 扱い |
|---|---|
| 自然なジェスチャとの併用 | 形は常に `pizza.doughShape` が正（SYNC で取り込む）。D-A′ は状態を二重に持たない |
| 工程移動・やり直し | INVALIDATE で初期化（既存の工程トークンに従う） |
| 完成（進捗 ≥ 0.75） | 読み上げで「大きさがそろいました」。次へ進むのは既存の「次へ →」（D-A′ は進めない） |
| 初期より縮める | 下限 10 まで可（自然なジェスチャも縮められる） |
| 画面の回転・サイズ変化 | 形は箱の単位なので不変 |
| 連打 | 押した回数分だけ適用（デバウンスしない）。`aria-live` は 250ms まとめて読み上げ |

### 2.6 アクセシビリティ（C3・C10・C11・C12）

- ボタンは 44px 以上（C3）。360 幅では px 下限を併用。
- `role="status" aria-live="polite"`: 「右上をひろげました。全体の 50%」（25%刻み、ビン数でなく割合）。
- モーションなし（即時）。`prefers-reduced-motion` に依存しない。
- 方向は形＋文字で示す（C12）。

### 2.7 将来のテスト計画（実装時・新規ファイルのみ）

`src/logic/doughAlt/doughAltMachine.test.ts`（案）: ①Δ ごとの完成押下数が §2.4 と一致 ②STEP が `applyStretchPoint` と一致（同一入力） ③不変条件 ①〜⑤ ④INVALIDATE ⑤SYNC 後の dir 維持 ⑥境界（10／58）。E2E: 低い高さ（390×664／360×640／375×667）で折りたたみを開いた状態の**幅・高さの収まり**（§ Collapsed-Controls）。**今回は作らない。**

## 3. C-A′（CUT・アーム付き）

### 3.1 位置づけ

自然なスワイプは**そのまま**。C-A′ は、「点で切る」を ON にしたときだけ、2 点タップで直線の切り線を作れる入口。**OFF（既定）の間、タップは従来どおり何も起こさない（#418 を維持）**。

### 3.2 状態機械（純粋）

```ts
export interface CutAltState {
  armed: boolean;                     // 既定 false
  a: { x: number; y: number } | null; // 始点
  b: { x: number; y: number } | null; // 終点（候補）
  revision: number;
}
export type CutAltEvent =
  | { type: "ARM" } | { type: "DISARM" }
  | { type: "POINT"; x: number; y: number }   // 座標は箱の単位。ポインタ・キーボードカーソルのどちらも同じ
  | { type: "COMMIT" }                        // 「切る」
  | { type: "CLEAR_POINTS" }
  | { type: "CANCEL" }                        // blur／hidden／resize／lostcapture
  | { type: "INVALIDATE"; revision: number };
export function cutAltReduce(s: CutAltState, e: CutAltEvent, ctx: { linesUsed: number; limit: number }): CutAltState;
export function cutAltPreview(s: CutAltState): { from: Pt; to: Pt } | null;   // 描画用（色以外: 始点＝○、終点＝□）
export function cutAltLine(s: CutAltState): CutLine | null;                   // buildTracedCutLine([a, b]) と同じ結果。長さ < TRACE_MIN_LENGTH なら null
// 確定は既存 onAddCutLine(line)。評価・保存・採点は変えない。
```

遷移:

| 現在 | イベント | 次 |
|---|---|---|
| armed=false | **POINT** | **不変（no-op。a／b を置かない）** ← #418 の要点。**テストで必ず固定** |
| armed=false | ARM | armed=true、a=b=null |
| armed=true, a=null | POINT | a を設定（生地外は無視） |
| armed=true, a≠null, b=null | POINT | b を設定。長さ < 8 なら b を置かず案内 |
| a,b あり | POINT | b を差し替え（始点は維持） |
| a,b あり | COMMIT | `cutAltLine` を `onAddCutLine` へ。成功したら a=b=null（armed は維持／解除は §3.4） |
| armed | CANCEL | a=b=null、armed=false |
| any | DISARM | armed=false、a=b=null |
| any | INVALIDATE | 初期化（armed=false） |
| armed | COMMIT（`linesUsed ≥ limit`） | 何もしない（本数上限。既存の規則と同じ） |

不変条件: ①`armed=false` のとき `POINT` は state を変えない ②確定する線は `buildTracedCutLine([a,b])` と同一（始点・終点で方向が決まり、縁まで延長）③`TRACE_MIN_LENGTH` 未満は確定しない ④`COMMIT` は a・b が揃うときだけ ⑤評価・Dex・保存は自然なスワイプと**同じ入力**になる。

### 3.3 アーム UI（骨子）

- 折りたたみ内に「**📍 点で切る**」トグル（`aria-pressed`、既定 OFF）。ON のとき生地の上に「始点を押す」の案内文（非色の手掛かり）。
- ON 中は自然なスワイプも使える（併用可）。スワイプ中に POINT は発火しない（既存のジェスチャが優先）。
- 「**切る**」「**やめる**」の 2 ボタン（44px 以上）。

### 3.4 開いた決定

| # | 決定 | 選択肢 | 推奨 |
|---|---|---|---|
| 1 | COMMIT 後に armed を維持するか | 維持（連続して切れる）／解除（毎回 ON） | **維持**（切る本数が複数のレシピで 1 本ごとの再 ON は負担）。ただし本数上限で自動 DISARM |
| 2 | 縁スナップ | なし／弱（半径 4 単位）／強（8） | **なし**（スナップは腕前を損なう。縁の弦は `buildRimToRimCutLine` が延長するため、縁をタップする必要がそもそも無い） |
| 3 | 2 点目で即確定するか | 即確定／「切る」で確定 | **「切る」で確定**（誤タップの取り消しが可能） |
| 4 | キーボード／スイッチでの点指定 | 矢印キーのカーソル（Enter で POINT）／角度プリセット | カーソル方式（同じ `POINT`）。実装は別設計（未検討） |

### 3.5 アクセシビリティ

- 読み上げ: 「始点を置きました」「終点を置きました。線の長さ OK」「線を引きました。残り 2 本」。
- 始点＝○、終点＝□（色以外の手掛かり、C12）。
- ボタン 44px 以上、`aria-pressed` でアーム状態を伝える。

### 3.6 テスト計画（実装時・新規ファイルのみ）

`src/logic/cutAlt/cutAltMachine.test.ts`（案）: ①**unarmed の POINT が no-op**（#418 の回帰固定）②arm→2 点→COMMIT の線が `buildTracedCutLine` と一致 ③長さ < 8 ④本数上限 ⑤生地外の POINT ⑥CANCEL／INVALIDATE ⑦スワイプとの併用で状態が混ざらない。**今回は作らない。**

## 4. T6 との整合（C1〜C14）

| 項目 | T6 | D-A′／C-A′ |
|---|---|---|
| イベントの命名 | `*_BUTTON`、`CANCEL`、`INVALIDATE` | `STEP`／`ARM`／`COMMIT` ＋同じ `CANCEL`／`INVALIDATE` |
| 状態機械の純粋性 | DOM／reducer／保存を知らない | 同じ |
| 既存 commit の再利用 | （折り・封止は新規） | `COMMIT_DOUGH_STRETCH`／`onAddCutLine` |
| 代替の質 | ボタンでも劣らない | 自然な関数を共有（等しい） |
| 読み上げの割合 | 25%刻み | 同じ |
| 中断時の保持 | 封止の進捗は保持 | D-A′ は形を保持、C-A′ の未確定点は CANCEL で破棄 |

T6 が main 未取り込みのため、T6 の契約が変わった場合は本書を再突合する。

## 5. 実装前の条件（再掲）

#764（WebKit 360×800 のソース工程の横はみ出し）と #766（390×664 の RESULT のヒント行）が先。折りたたみの置き場の検討は `TETO_COOK-OPS_T9_Collapsed-Controls_OneScreen-A11y-Review_2026-11-07.md`。**実装・PR・Preview 更新は HOLD。**

## 6. Owner 判断事項

1. D-A′ の Δ（推奨 8）、上限（推奨 なし）。
2. C-A′ の決定 1〜4（推奨: 維持／スナップなし／「切る」で確定／カーソル方式を別設計）。
3. D-A′・C-A′ の純粋ロジックを、実機 HV の前に**新規ファイルのみ**で作り、機械的なテストで固定してよいか（実装 HOLD の解除は別承認）。

---
_設計のみ。実機・本番ビルドとも未検証。_
