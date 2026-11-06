# DRIZZLE D1（純粋ロジック）の実装範囲・受入条件・テスト計画、#746 の HV 整理（docs-only、Refs #579 #746 #773）

作成: 2026-11-06 / 基準 `main` = `ed159e9` / ブランチ `claude/teto-pizza-issue-773-nlyntr`
性質: 仕様の確定と整理のみ。`src/**`・既存 docs・既存 PR は変更していない。**D1 の実装は開始していない。** D2〜D5・Production ON は HOLD。
「推奨」は助言であり Owner Decision ではない。数値は PROVISIONAL。

Owner 方針（2026-11-06、本書の前提）: DRIZZLE #579 を新調理操作の第一候補／D1 の純粋ロジックのみ実装準備 GO／初期液体は `olive-oil`・データモデルは `postBakeLiquids` を第一候補／#746 の iPhone HV を先に実施／D2〜D5 と Production ON は HOLD。

親資料: `TETO_NEW-PROCESS_Candidate-Comparison_2026-11-06.md`（§6〜8）、#579 の設計資料 3 本（ブランチ `claude/drizzle-579-design-gate-20261104`、`221f69d`）、#746 の HV 手順書（ブランチ `claude/drizzle-746-iphone-hv-runbook-20261104`、`4529926`）。

---

## 0. 結論（先に）

1. **#579・#746 の重複確認: D1 の実装は誰も始めていない。** `postBakeLiquid`・`src/logic/drizzle` を含むブランチ・PR は 0（`origin` の全ブランチを走査【実測】）。#579 の有効な claim は無い（第 1 回監査の claim は 11/03 に失効、11/04 の Owner コメントは「実装スライスの準備」の範囲決めで claim ではない）。#746 は `src/preview/*` と `src/main.tsx` のみ（Preview/DEV 専用）で、D1 の新規ファイルと重ならない。
2. **D1 の範囲は新規ファイル 5〜6 本。** ゲームのどこにも import されない。幾何は #746 を import せず（Preview 専用コードは本番側から import できない）、**本番にある `src/logic/pizzaCoordinates.ts`（`clampToDough` ほか）を再利用**する。
3. **#746 の幾何をそのまま保存用の上限にしてはいけない（本書の発見）。** #746 の上限は 1 ストローク 160 点・24 本で、1 点約 20 byte とすると**最大 77KB** になり、`pendingRound` の上限 64KB（`PENDING_ROUND_MAX_BYTES`、測定済みの最悪値は約 39KB）を**単独で超える**【推論】。D1 は「表示用の上限」と「保存用の上限（粗く間引く）」を分けて定義する（§3.2）。
4. **着手の順序:** ① #746 の iPhone HV（Owner、先） → ② HV 結果で D1 の定数を確定 → ③ #773 の claim の一本化（別書 `TETO_CLAIM-RECONCILIATION_773_2026-11-06.md`）と #579 への D1 の claim → ④ D1 実装。**D1 の実装開始は HV の後**を推奨（OD-D1-1）。

---

## 1. 重複確認（#579）

| 対象 | 状態【実測】 | D1 との関係 |
|---|---|---|
| #579 | open。Owner コメント 3 件（10/27 価値監査、11/04 実装スライス準備、11/04 設計判断資料）。claim: 第 1 回監査分のみで 11/03 失効 | 有効な claim なし。**D1 は新しい claim が要る**（§5.3） |
| PR #746（Lab） | open（draft ではない）、head `b774a32`、CI 11/11 success、Codex は最新 head に指摘なし、`mergeable_state` は `unknown`（base `0016222` が main より古い）。変更は `src/preview/*`・`e2e/drizzle-lab.spec.ts`・`src/main.tsx`・docs | 重ならない。D1 は #746 を編集しない |
| ブランチ `claude/drizzle-579-design-gate-20261104` | docs 3 本のみ（Design Gate、Decision Brief、Gesture Lab Spec） | 設計資料。D1 の根拠 |
| ブランチ `claude/drizzle-746-iphone-hv-runbook-20261104` | HV 手順書 1 本のみ | §6 で参照 |
| `postBakeLiquid`／`src/logic/drizzle` | どのブランチ・main にも無い【実測】 | **D1 の重複実装は無い** |
| STEAM #738／FRY #749／炒め #696 | 触るファイルが別（HOT 3 ファイル、`src/logic/{steam,fry,prep}`） | D1 は新規のみで重ならない |
| 名前空間の衝突 | #746 は `drizzleLab*`・`DRIZZLE_LAB_*`。D1 は `postBakeLiquid`・`logic/drizzle/`・`DRIZZLE_EXPERIENCE_*` | architecture test の検出語を D1 側の固有名に限定し、#746 を誤検出しない（§4.3） |

---

## 2. D1 のスコープ

### 2.1 やる
`PostBakeLiquid` の型、軌跡の幾何（クランプ・間引き・長さ・タップ代替の線）、表示用と保存用の上限、保存向けのサニタイズ（読み取り検証）、初期液体の許可リスト、フラグ、テスト、Result。**純粋・決定的・未配線・本番 OFF。**

### 2.2 やらない（D2〜D5 と禁止事項）
| 項目 | 理由 |
|---|---|
| reducer の action、`PizzaState` への追加 | D2 以降 |
| `pendingRound` の journal の書き込み・読み出し | D2 |
| 在庫の消費・原子性 | D3 |
| 採点・Reference・識別・late 軸・Hint・Research・Dex | D4／OD-DZ-5・6 |
| UI・`PizzaStage`・`GameScreen`・`App`・`main.tsx` | D5 |
| 新食材・新レシピ・ladder | 初期液体は既存の `olive-oil` のみ |
| #746 の編集・import、共有 Preview 更新、Production ON、merge | 禁止 |

---

## 3. 確定する設計（PROVISIONAL。HV の結果で数値のみ調整）

### 3.1 追加ファイル（すべて新規、既存ファイルの変更ゼロ）
| ファイル | 内容 |
|---|---|
| `src/data/drizzleExperienceGate.ts` | `DRIZZLE_EXPERIENCE_PRODUCTION = false`、`drizzleExperienceEnabled()` |
| `src/logic/drizzle/postBakeLiquid.ts` | 型 `PostBakeLiquid = { id: string; ingredientId: string; trail: readonly DoughPoint[]; stage: "post" }`（Decision Brief の草案どおり。未承認）、`POST_BAKE_LIQUID_INGREDIENT_IDS = ["olive-oil"]`、`isPostBakeLiquidIngredient(id)` |
| `src/logic/drizzle/trail.ts` | 幾何: `clampTrailPoint`（`pizzaCoordinates.clampToDough` を再利用）、`thinTrail`、`trailLength`、`tapTrail`、`quantize` |
| `src/logic/drizzle/sanitize.ts` | `sanitizePostBakeLiquid(raw: unknown)` と `sanitizePostBakeLiquids(raw: unknown)`（保存向けの読み取り検証。書き込みは D2） |
| `src/logic/drizzle/drizzle.architecture.test.ts` ほか各 `*.test.ts` | §4 |
| `docs/reports/TETO_COOKING-DRIZZLE_D1_Result.md` | Result（数値・対象外・HV 不要の理由） |

### 3.2 上限（表示用と保存用を分ける）
| 定数 | 値（PROVISIONAL） | 根拠 |
|---|---|---|
| `DISPLAY_MAX_POINTS_PER_STROKE` / `DISPLAY_MAX_STROKES` | 160 / 24 | #746 の契約と同値（描画中の一時状態のみ。保存しない） |
| `MIN_POINT_DISTANCE` / `TAP_TRAVEL` / `TAP_LINE_LENGTH` | 1.4 / 3 / 16（#746 の 100×100 面基準）。**本番座標（0〜100% の `DOUGH_RADIUS = 48`）への換算は D5 で再検証** | #746 は半径 44 の独自面。値をそのまま写すと半径が違うため、D1 は定数を**ダウンスケール係数つきで定義**し、換算を D5 に残す（OD-D1-3） |
| `PERSIST_MAX_POINTS_PER_STROKE` | 24 | 保存・journal 用。粗く間引く |
| `PERSIST_MAX_LIQUIDS` | 4 | 1 ラウンドの回しかけの本数の上限案（OD-DZ-3 の消費単位と連動） |
| 座標の量子化 | 0.1 刻み | JSON を短くする |
| 最悪の JSON 長 | 1 液体 ≈ 24 点 × 約 20 byte ≈ 0.5KB、4 本で ≈ 2KB。テストで**実測して Result に記録**。目標は 4KB 以下 | `pendingRound` 上限 64KB に対し最悪 39KB の上に足しても余裕を残す【推論】 |

### 3.3 関数の契約
- `clampTrailPoint(p)`: 非有限・非数なら `null`。有限なら生地の半径内へ投影（`CLAMP_INSET_EPSILON` の流儀に従う）。
- `thinTrail(points, max)`: 先頭と末尾を保つ。最大 `max` 点。同じ入力は同じ出力（乱数・実時間なし）。
- `tapTrail(at)`: 2 点以上の短い斜めの線（点にならない）。生地の縁の近くでも全点が生地の中。
- `sanitizePostBakeLiquid(raw)`: 非オブジェクト、`stage !== "post"`、`ingredientId` が許可リスト外、`trail` が配列でない、有効な点が 2 未満、は `null`。点は非有限を捨て、クランプし、量子化し、`PERSIST_MAX_POINTS_PER_STROKE` まで間引く。`id` は有限長の英数字とハイフンのみ。未知のフィールドは**捨てる**（保存互換のため、通す場合はテストで固定）。
- `sanitizePostBakeLiquids(raw)`: 配列でなければ空配列。`PERSIST_MAX_LIQUIDS` まで（新しい方を残す）。個々が `null` なら捨てる。**例外を投げない。**

---

## 4. テスト計画

### 4.1 単体テスト（`*.test.ts`）
| 対象 | ケース |
|---|---|
| `clampTrailPoint` | 内側は不変／外側は縁へ／`NaN`・`Infinity`・文字列は `null`／縁ちょうど／丸め誤差が `DOUGH_RADIUS` を超えない（`pizzaCoordinates` の既存の落とし穴の再発防止） |
| `thinTrail` | 点数が `max` 以下／先頭・末尾が残る／決定的（2 回実行して同一）／入力を変更しない／空・1 点・`max` 以下はそのまま |
| `trailLength` | 直線・折れ線・0 点・1 点 |
| `tapTrail` | 点でない（長さ > 0）／縁の近くでも全点が内側／決定的 |
| `quantize` | 0.1 刻み、負値、巨大値 |
| `sanitizePostBakeLiquid` | 正常／各拒否条件（非オブジェクト、`stage` 違い、許可リスト外の食材、`trail` 非配列、有効点 < 2）／非有限点の除去／上限超えの間引き／未知フィールドの除去／`__proto__` や関数を含む入力で例外なし |
| `sanitizePostBakeLiquids` | 非配列→空／上限超え→新しい方を残す／混在（一部 `null`）／例外なし |
| JSON 往復 | `JSON.parse(JSON.stringify(x))` を再度サニタイズして同値（冪等） |
| 最悪の JSON 長 | 上限いっぱいの入力で UTF-8 長を測り、Result に記録。**4KB 以下**を assert |
| 定数 | `DRIZZLE_EXPERIENCE_PRODUCTION === false`／許可リストが `["olive-oil"]`で、その id が `ingredients.ts` に実在し category が `sauce`（食材が変わったら落ちる） |

### 4.2 契約テスト（#746 との整合）
表示用の定数（160・24・1.4・3・16）を**リテラルで**固定し、#746 の値と一致していることを Result に記録（コードの import はしない）。#746 が merge された後に、別 PR で「Lab が D1 の幾何を import する」整理を行う（D1 の範囲外）。

### 4.3 architecture test（`fry.architecture.test.ts` の型）
| 検証 | 内容 |
|---|---|
| 自分のファイル | `logic/drizzle/**`、`data/drizzleExperienceGate.ts` が 5 本以上 |
| 未配線 | 自分以外の非テスト source が `postBakeLiquid|logic/drizzle|DRIZZLE_EXPERIENCE|drizzleExperienceGate` を**含まない**（検出語は D1 固有名のみ。`drizzleLab`・`DRIZZLE_LAB_*` は #746 のもので対象外） |
| 主要ファイル | `state/gameReducer.ts`・`state/pendingRound.ts`・`state/persistence.ts`・`state/inventory.ts`・`state/finalizeRound.ts`・`state/pizzaState.ts`・`components/PizzaStage.tsx`・`screens/GameScreen.tsx`・`App.tsx`・`main.tsx` が上記の語を含まない |
| 非読取り | `logic/scoringV2/**`・`logic/pitzReward.ts`・`logic/discovery/**`・`state/dex.ts` が含まない |
| 独立 | D1 のファイルが `logic/{fry,steam,prep}`・sear 系・`preview/`・`components/` を import しない。import してよいのは `logic/pizzaCoordinates.ts` と `data/ingredients.ts`（テストのみ）と同ディレクトリのみ |
| 純粋 | D1 の source に `Date`・`performance`・`Math.random`・`localStorage`・`sessionStorage`・`document`・`window` を含まない |
| LATER_SLICES | 空集合（D2 以降が配線する時に、レビューされた編集で追加する） |

### 4.4 実行する確認
`npx vitest run src/logic/drizzle src/data/drizzleExperienceGate`（件数を実測で報告）、`tsc -b`、`npm run lint`（oxlint）、`npm run build`。E2E・WebKit は D1 では不要（UI なし）。**未実施の項目は未実施と書く**（本環境では依存を入れていない）。

---

## 5. 受入条件・Issue 案・claim 案

### 5.1 受入条件（D1）
1. 変更は §3.1 の新規ファイルのみ。**既存ファイルの diff がゼロ**（`git diff --stat main` で確認）。
2. どこからも import されない（architecture test と `rg` で固定）。
3. `DRIZZLE_EXPERIENCE_PRODUCTION = false`。
4. 純粋・決定的。非有限・範囲外の入力は安全側に丸める／`null`。例外を投げない。
5. 表示用と保存用の上限が分かれ、保存用の最悪 JSON 長が 4KB 以下（実測値を Result に記録）。
6. 初期液体は `olive-oil` のみ。新食材・新レシピ・ladder の変更なし。
7. 採点・識別・Hint・Research・Dex・Pitz・在庫・保存・journal を読まず書かない（architecture test）。
8. STEAM・FRY・炒め・炙り・#746 のファイルに差分がなく、互いに import しない。
9. Vitest（新規）・`tsc -b`・oxlint・build が通る。件数を実測で報告。
10. HV 動画は対象外（UI／操作が変化しない純粋ロジック、HV Policy §2）。Result に理由を書く。
11. merge・共有 Preview 更新・Production ON はしない。PR 作成後は exact HEAD の CI と Codex を待つ。

### 5.2 Issue 案（#579 への追記。**起票しない**）
タイトル: `D1: 純粋層（postBakeLiquids の型・幾何・サニタイズ、未配線・本番 OFF、Refs #579 #746）`
本文: 目的＝FINISH の液体の回しかけ（DRIZZLE）の純粋ロジックを新規ファイルのみで作る／範囲＝§3／受入条件＝§5.1／前提＝Owner GO（2026-11-06）、#746 の HV の結果、#773 の claim 一本化、#579 への claim／非目標＝§2.2。

### 5.3 claim 案（#579、**投稿していない**。実装を始める session が投稿する）
```
<!-- teto-claim:v1 {"session":"<実装 session>","issue":579,"pr":null,"branch":"<実装 branch>",
  "files":["src/logic/drizzle/**","src/data/drizzleExperienceGate.ts","docs/reports/TETO_COOKING-DRIZZLE_D1_*"],
  "dependsOn":[],"expires":"<投稿から 14 日以内>"} -->
```
（上は fence 内の例で有効ではない。）開始前に、#579・#773 の claim と open PR を再確認する。

### 5.4 D2〜D6 は HOLD（再掲）
D2 journal（`pendingRound.ts`・`persistence.ts`）／D3 在庫の原子性（`inventory.ts`・`pendingRoundSettle.ts`・`finalizeRound.ts`）／D4 採点・識別／D5 UI（`GameScreen.tsx`・`PizzaStage.tsx`・`App.tsx`、#738・FRY F3 の後）／D6 展開。Decision Brief の 3 ゲート（保存互換・在庫の原子性・採点／識別）を満たすまで着手しない。

---

## 6. #746 Gesture Lab の iPhone HV（Owner、先に実施）

### 6.1 既存の手順書を使う（重複して作らない）
`docs/reports/TETO_FINISH-DRIZZLE_746_iPhone-HV_Runbook_20261104.md`（ブランチ `claude/drizzle-746-iphone-hv-runbook-20261104`、main には無い）に、実機確認 12 項目（D1〜D12）と判定基準がある。要点:
- 対象は #746 の exact HEAD `b774a322d8de3ca0d59607a35c660701f58067eb`、入口は `?drizzleLab=on`（ちょうど 1 回）。画面に「試作・保存されません」が出る。
- 判定は項目ごとに PASS／NEEDS FIX／FAIL を、具体的な観察つきで書く。**D6（2 本指）・D7（端のスワイプ・長押し）・D8（中断）・D12（保存・進行に影響なし）のどれかが FAIL なら統合を止める**。D2〜D5（線の追従・速い往復・タップ代替・縁）の指摘は、Owner が採用を判断する前に修正が要る。
- 合格しても、永続的な FINISH 液体モデル・在庫・採点・Production ON は承認されない。
- 承認済みのビルドがない場合は「BLOCKED: no approved HV build」と記録する（テストしたと主張しない）。

### 6.2 追加で必要な Owner 判断
| ID | 論点 | 助言 |
|---|---|---|
| **OD-H1** | **HV 用のビルドをどう用意するか。** 共有 Preview が #746 の head を含むとは限らない（含むかは未確認）。共有 Preview の更新は Owner の明示承認が要る（SESSION-OPERATIONS §5、HV ワークフロー§7） | 現在の公開 SHA／PR を記録（復旧用）→ Owner が承認 → #746 の head `b774a32` を公開。**本セッションは更新しない** |
| OD-H2 | #746 の base `0016222` が main（`ed159e9`）より古い。HV は base が古くても Lab 単体で足りるが、`mergeable_state` が `unknown` | HV は現 head のまま実施。merge の判断の前に、保有 session が main を取り込む（push は保有側の承認が要る） |
| OD-H3 | HV が終わるまで D1 の実装を始めないか（OD-D1-1） | 始めない（数値の定数が HV で変わりうる。D1 の準備＝本書は完了） |
| OD-H4 | HV の観点に、D1 の判断材料を足すか: ① 回しかけの「太さ」が速度で変わる表現（#746 は固定幅）② 初期液体 `olive-oil` のつや・色が焼きピザの上で読めるか ③ タップ代替の線の長さ・向き | 足す（HV 手順書の D2・D4 のコメント欄で足りる。手順書は編集しない） |

### 6.3 HV の結果が D1 に与える影響
| 結果 | D1 |
|---|---|
| D2〜D5 が PASS | §3.2 の定数のまま実装 |
| D4（タップ代替）が NEEDS FIX | `TAP_LINE_LENGTH` と向きを修正（#746 の保有 session が直す）。D1 は新値で実装 |
| D6／D7／D8／D12 が FAIL | D1 を開始しない。統合そのものを Owner が再判断 |
| 速度→太さの要望 | D1 に `width` の導出を足す案を Owner が判断（保存に入れるか、表示のみにするか。保存に入れると D2 の journal が変わる） |

---

## 7. 残る Owner 判断（#579 関連、D1 に関わるもの）

| ID | 論点 | 助言 |
|---|---|---|
| OD-D1-1 | D1 の実装開始を #746 の HV の後にするか | する |
| OD-D1-2 | #773 の claim 一本化が済むまで D1 の claim を投稿しないか。#579 と #773 は別 Issue のため、一本化を待つ必要が本当にあるか | 待たなくてよい（別 Issue・別ファイル）。ただし Owner の明示を推奨 |
| OD-D1-3 | 幾何の座標系: #746 の 100×100 面（半径 44）を、本番座標（0〜100%、半径 48）へ D1 で換算するか、D5 に送るか | D1 は本番座標（`pizzaCoordinates`）で定義し、定数を換算して持つ。換算比は Result に記録 |
| OD-DZ-1 | 初期液体 `olive-oil`（Owner 方針で第一候補） | 方針どおり。ただし識別が焼成前の使い方と重なる件（OD-DZ-6）は D4 まで未決 |
| OD-DZ-2 | データモデル `postBakeLiquids`（Owner 方針で第一候補） | 方針どおり。D1 は型を草案として置く（未承認の注記を型のコメントに書く） |
| OD-DZ-3 | 消費単位（1 ストローク／1 回の適用／1 食材） | D1 では `PERSIST_MAX_LIQUIDS` の数え方に影響。**未決のまま「液体の本数」の上限だけ置く** |
| OD-DZ-4〜7 | タップ代替の形・採点・識別・公開範囲 | D2 以降。D1 は触れない |

## 8. 未確認事項
- 楽しさ・疲労・速度→太さの効果は実測なし（#746 の実機 HV 未実施）。
- 1 点あたり約 20 byte の見積りは概算。D1 のテストで実測する。
- `pendingRound` の測定済み最悪値 39KB は `pendingRound.ts` のコメントによる（再測定していない）。
- 本番座標への換算（#746 の半径 44 と本番の 48）の影響は未検証。
- アプリ実行・テスト実行・実機は本環境で未実施。
