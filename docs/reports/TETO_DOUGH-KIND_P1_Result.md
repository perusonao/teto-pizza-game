# Dough Kind P1 — `dough` 識別軸・技法 `dough-pinsa-romana`・`Recipe.doughKind?`（Issue #577、本番では不活性）

Status: **実装済み・本番では不活性。HV 不要**（見た目・操作は変わらない。`TETO_HUMAN-VERIFICATION-POLICY.md` §2「内部変更のみ」）。merge と共有 Preview 更新は **Owner 承認待ち**。
設計: `docs/design/TETO_DOUGH-KIND_PINSA_DETAILED-DESIGN.md`（#575、§11.1 P1）。基準 `main` = `e19247c`。

## Owner Decision（#577、2026-10-20）
* `dough` 軸 OBSERVED、`DOUGH_VARIANT` supported を P1 で承認。
* 技法 ID `dough-pinsa-romana`、名前「ピンサ生地」、なぞかけ・説明は #575 §3.2 の承認文言。
* **Pinsa レシピ（`pinsa-romana`）の公開は P3 まで禁止**（pizzadb.jp 原典確認まで HOLD）。

## 変更
| ファイル | 内容 |
|---|---|
| `src/logic/dough/doughKind.ts`（新規） | `DoughKind = "standard" \| "material-multigrain-long-ferment"`、`resolveDoughKind`（唯一の読み手。不正値は `standard`） |
| `src/state/pizzaState.ts` | `PizzaState.dough?: DoughKind`（任意・非永続。`pan` / `squareDough` から推定しない） |
| `src/data/recipes.ts` | `Recipe.doughKind?: DoughKind`（interface に 1 フィールドのみ。**どの `RECIPES` も設定しない**） |
| `src/logic/discovery/signature.ts` | `dough` を OBSERVED に昇格（`pan` に次ぐ 2 本目）。`RUNTIME_SUPPORTED_CAPABILITIES = ["DOUGH_VARIANT"]` |
| `src/data/techniques.ts` | 技法 `dough-pinsa-romana`（名前・なぞかけ・説明）を末尾に登録 |
| `src/logic/techniques/detection.ts` | 使った（`dough` OBSERVED かつ Pinsa 値）／要求した（target の `dough`）の判定。技法 ID ↔ 識別値の対応はここ 1 か所 |
| `src/components/TechniqueReveal.tsx` | 生の技法 ID を出す `data-technique-id` を値なしの `data-technique-name` に置換（設計 §5.7 R6。見た目は不変） |
| `matcher.ts`, `registration.ts`, `runtime.ts`, `dexView.ts`, reducer, UI, CSS | **変更なし** |

## 変更していないもの
採点（Scoring 2.0）、Pitz・経済、保存形式（`schemaVersion` 2、新キーなし）、CUT、`matcher.ts`、Hint 5.0 / Research のコード、`SELECT_DOUGH` とチップ UI（P2）、Pinsa レシピ・ladder・件数（P3）。#580（Batch 8b）・#582・#581・#468 の変更範囲には触れない。`recipes.ts` は hot file だが、触るのは `Recipe` interface の `panShape` 直後の 1 フィールドのみで、#580 のレシピ追記位置とは離れている。

## 不活性であることの根拠
* `RECIPES` に `doughKind` を持つ項目なし、`RECIPE_DISCOVERY_CATALOG` の全 target が `dough: "standard"`、`DOUGH_VARIANT` を要求する target なし（テストで固定）。
* 技法を要求する target が無いので affordance は `null`（INV-TQ-4）。Dex 調理法欄に何も出ず、`PizzaState.dough` を設定する経路も本番に無い。

## 既存 pin の更新（名前付き。assertion の緩和ではなく仕様変更への追随）
| テスト | 変更 |
|---|---|
| `signature.test.ts` | OBSERVED は `["dough","pan"]`、supported は `["DOUGH_VARIANT"]` |
| `attemptFingerprint.gate.test.ts` | `signature.ts` の supported 宣言の文字列、OBSERVED 行は `["dough","pan"]` |
| `resultFeedback.gate.test.ts` | supported 宣言の文字列 |
| `attemptFingerprint.test.ts` | OBSERVED カナリアを dough に拡張、dough の fingerprint テスト追加 |
| `techniques.test.ts` / `techniques.tray.test.ts` | レジストリ 3 件 |

## 追加テスト
* `doughKind.test.ts`: 語彙・解決・本番で未設定。
* `doughAxis.test.ts`: 不正値は standard / 明示値だけ Pinsa / `pan`・`squareDough` と相互に推定しない（PK-2）/ 未設定ピザは全軸の値が不変（PK-1）/ standard と Pinsa は ambiguous にならない・tray 併用は一致なし（PK-3）/ `DOUGH_VARIANT` 非対応なら一致しない / **既存全レシピの組成が自分の target にだけ一致し、fingerprint が P1 前の文字列のまま**。
* `techniques.dough.test.ts`: 登録文言（PK-20/22）、検出・要求、affordance は導出、本番で開かない、Free Cooking のみ・一度だけ発見、レシピ経路、Dex の RIDDLE→DISCOVERED（対応表示なし）、文言は `techniques.ts` だけ・生の ID は登録と検出だけ。
* `doughPrivacy.test.tsx`（Anti-Oracle）: 本番カタログで Dex・RESULT の技法ステージ・発見結果・レシピ名に Pinsa が出ない／Pinsa 生地で jamon の食材を作っても jamon にならない／アプリ内の文字列リテラルに「ピンサ」「ロマーナ」が出るのは技法登録と検出だけ。
* `TechniqueReveal.test.tsx`: 全技法で生の ID が DOM に出ない（R6）。

## 検証
* 全 Vitest: **482 files passed / 1 skipped、8977 tests passed**（2 skipped・6 todo は既存、failed 0）。
* `npm run build`（`tsc -b` + `vite build`）通過。`oxlint`: 触ったファイルへの指摘なし（警告は既存分のみ）。
* **途中で出た失敗と原因**: (1) `sauceB1.singleSource.golden` の 550 件。golden が signature 全体（各軸の `status` を含む）をハッシュしており、`dough` が `FIXED_BY_FLOW` → `OBSERVED` に変わるため（PK-1 が明示的に許容する唯一の差。F1 の `pan` と同じ）。**`signature` の 550 値だけを書き換え**、`state` / `scoring` / `near` / `free` / `consume` / `completion` / `advice` ほか他のフィールドはバイト一致（スクリプトで確認）、golden に新しいレシピは足していない（再生成では #561 以降の 5 レシピが入ったので、既存キーの `signature` のみ取り込んだ）。(2) `deductionProduction.gate` / `hint5Production.gate` の「技法を要求する recipe」の許可リストに、`DOUGH_PINSA_ROMANA_RECIPE_IDS`（空）を名前付きで追加。skip・retry・緩和なし（PK-13）。(3) `attemptFingerprint.gate` の「fingerprint を参照するファイル」一覧: 新規テストから import を外し、既存の `attemptFingerprint.test.ts` に寄せた。
* 衝突確認: `git merge-tree` で #580 / #581 / #582 の各 head と衝突なし。#580 との共有ファイルは `src/data/recipes.ts` のみ（`Recipe` interface の 1 フィールド）。
* E2E / HV: 見た目・操作・DOM 構造（属性名 1 つを除く）が変わらず、affordance が閉じているため対象外。`TechniqueReveal` の属性は本番でも RESULT の技法ステージが出るまで描画されない。

## 未決・次
* P2（`SELECT_DOUGH`・チップ）は **チップの `aria-label` 文言（Q4）と Q13 の確定待ち**。P3 は **原典確認（PK-0）と Q5〜Q8 待ち**。いずれも未着手。
* Hint 5.0 / DH4 の sweep への `dough` 状態の追加（PK-11）は Pinsa の ladder が現れる P3 で全再実行する。P1 は Hint / Research のコードに触れず、本番カタログに Pinsa が無いため出力は変わらない。
* `DOUGH_VARIANT` の supported 化は P1 時点では何も有効にしない（要求する target が無い）。
