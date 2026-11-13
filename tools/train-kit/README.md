# Train Kit — スペックから列車を実装する（#780）

食材・レシピの列車（release train）を **1 枚の実装スペック JSON** から機械的に実装するためのツール群。
`tools/content-train/`（#816: 承認スペックの事前検査）の**続き**であり、置き換えではない。

```
承認スペック ──preflight──▶ Owner パケット ──(Owner 回答)──▶ scaffold ──▶ 実装スペック（TODO を埋める）
      (tools/content-train)                                        │
                                                                   ▼
  claims ─▶ apply ─▶ sweep（追従リスト）─▶ 全テスト ─▶ E2E ─▶ Draft PR ─▶ CI・レビュー・HV ─▶ merge（Owner）
```

**このツールが決めないこと**: Owner 判断（NO_SAUCE、重複例外、Research の ID 別承認、family、ladderCredit）、
プレイヤーに見える文言（説明文・注文セリフ）、色・絵文字、SVG の絵そのもの、HV の合否。
**このツールが緩めないこと**: 既存 Gate・タイムアウト・テスト。Gate の表明は 1 つも変更していない。

## 1. 手順（Sonnet 級モデル／Codex 向け。上から順に、失敗したら止まって報告）

| # | コマンド | 合格条件 | 失敗したら |
|---|---|---|---|
| 0 | `CLAUDE.md` → `docs/PROJECT_HANDOFF.md` → `docs/decisions/TETO_SESSION-OPERATIONS_1.0.md` を読む。`git fetch origin main` | 最新 main から分岐 | — |
| 1 | `node tools/content-train/preflight.mjs <承認スペック> --out <dir>` | 終了コード 0（STOP なし）。OWNER 行は全て Owner が回答済み | STOP はスペックを直す。OWNER は 1 回にまとめて Owner に聞く |
| 2 | `node tools/train-kit/cli.mjs scaffold <承認スペック> --tag t24 --label "Expansion Batch 24" --out <実装スペック>` | 骨組みができる。`(decision)` 行は Owner 判断と突き合わせる | — |
| 3 | 実装スペックの `TODO` を埋める（§3） | `apply --dry-run` が通る | エラー文のとおりに直す |
| 4 | `node tools/train-kit/cli.mjs plan <実装スペック> --out <dir>` | 検証パケットと `claim-files.json` ができる | — |
| 5 | `node tools/train-kit/cli.mjs claims --files @<dir>/claim-files.json --claims <#780 のコメント JSON> [--prs <open PR JSON>] --session <自分>` | 終了コード 0 | 重複相手の merge／release を待つ。HOT は直列（Session Operations §1） |
| 6 | claim を #780 に投稿（パケット §3 のブロック） | — | — |
| 7 | `node tools/train-kit/cli.mjs apply <実装スペック>` | `edited N file(s), generated M file(s)` | `anchor not found` → §5 |
| 8 | `node tools/train-kit/cli.mjs sweep` | 追従リスト（TYPE／TEST／GOLDEN）が出る | — |
| 9 | 追従リストを 1 件ずつ直す（§4） | `sweep` が終了コード 0 | **件数・位置・新しい行の追加以外**の失敗は Gate 衝突。止まって報告 |
| 10 | staged の追従（パケット §4-5） | staged のテストが通る | — |
| 11 | `npx tsc -b` → `npx oxlint` → `npx vitest run` | 全て 0 | 同上 |
| 12 | `npx playwright test e2e/<tag>.spec.ts --project iphone-390x844 --project iphone-360x800 --trace off` | 全て合格 | 失敗は実際の不具合として扱う（リトライで隠さない） |
| 13 | スクリーンショット・動画（パケット §4-8、HV Policy） | 画像を commit、動画は Owner に直接渡す | — |
| 14 | Draft PR → CI → 独立レビュー → Owner の iPhone HV → Owner の指示で merge → **同じターンで claim release** | — | — |

`apply` は実行前にスペックを検証し、既知の Gate 衝突（`other` family、チーズ無し NO_SAUCE、焼成後ソース、絵文字の重複、
late なのに step 無し など）は**ファイルを 1 つも書く前に**止める。同じ tag での再実行は拒否する（上書きしない）。
やり直すときは、編集されたファイルを `git checkout -- <file>` で戻し、`apply` が `generated` と報告した 4 ファイルだけを削除してから再実行する
（`--out report.json` を付けると両方の一覧が残る）。

## 2. コマンド一覧

| コマンド | 内容 | 所要 |
|---|---|---|
| `scaffold <承認スペック> --tag --label --out` | 実装スペックの骨組み。導出できる値は全部埋め、著作物は `TODO` | 約 3 秒 |
| `apply <実装スペック> [--dry-run] [--skip-glyph-dispatch]` | カタログ 12〜14 ファイルの編集＋HV シード・そのテスト・E2E・landed スペックの生成 | 約 3 秒 |
| `sweep [--min 2] [--no-tsc]` | `tsc` と「過去のバッチが毎回直してきた既存テスト」だけを実行し、追従リストを出す | 約 5 分 |
| `plan <実装スペック> --out <dir>` | 検証パケット（対象ファイル、claim ブロック、実行順、E2E／HV 手順、Result Report の骨組み） | 1 秒未満 |
| `claims --files --claims [--prs] [--session]` | Owner Gate と同じ規則（`scripts/ops/lib`）で claim・open PR との重複を検査 | 1 秒未満 |
| `progress [--out <dir>]` | 食材／レシピ／調理法の進捗台帳を実カタログから再計算。マスター台帳が古いかも報告 | 約 5 秒 |
| `extract --ids --train --tag --label --out` | 出荷済みレシピ → 実装スペック（`apply` の逆） | 約 3 秒 |
| `replay --base --target --ids --tag --label --out [--tsc]` | 出荷済みバッチを生成器で再現し、カタログの完全一致を検査（同値性の証明） | 約 1〜2 分 |
| `e2e <スペック> --out e2e/<名前>.spec.ts` | E2E だけをテンプレートから作り直す | 約 3 秒 |
| `coverage --out` | スペック形式と生成 Reference が既存カタログをどこまで再現するかの測定 | 約 4 秒 |
| `freeze --at <commit> --out <json>` | 凍結基準を記録する（§3.5）。通常は実行しない | 約 20 秒 |
| `mutation --old <tree> --new <tree> --files "<tests>" --out <json>` | 旧テストと新テストが同じ変異を検出するかを比べる（22 件、`mutations.json`） | 約 20〜30 分 |
| `pins --commits <sha,...>` | 追従対象の一覧（`pin-files.json`）を、出荷済みバッチの commit から作り直す | 1 秒未満 |

## 3. 実装スペックの書き方

型と検証規則は `lib/implSpec.ts`（`KitTrain`）。実例は `src/trainKit/landed/b23b.json`（late 2 品＋食材 5 種）、`b23.json`（通常 1 品）。

- `recipes[]` の順 = カタログに書かれる順 = ladder step の順。通常レシピを先、late を後に並べる。
- `ladderStep.ingredientIds`: そのレシピが key になって解禁する**新食材**。新食材は必ずどれか 1 つの step に入れる。
  step の無いレシピ（新食材なし）は `ladderStep: null`・`ladderCredit: false`（Owner 判断が要る）。
- `sauceProfile`: `null` = NO_SAUCE（Owner の明示判断が要る）。あれば主ソース 1 つだけ（`olive-oil` は `PAINT_TEMPORARY`、他は `PAINT`）。
- `newIngredients[]` の順 = 食材配列に書かれる順。`family` は topping のみ（`other` は不可）、`sizeClass` は sauce 以外。
- `emoji` はカタログ内で一意、かつ family 記号と別（検証が重複相手を名指しする）。`color` は小文字 `#rrggbb`。
- 専用 SVG があるとき: `pieceVisual`（visual id）と `glyphHost`（`StagedGlyph`／`DessertGlyph`）。絵は事前に未配線で作っておく
  （`src/components/stagedGlyphs/` に追加し、id をそのコンポーネントの型に入れる）。無ければ両方とも書かない（絵文字表示）。
- `landingStyle`: 葉もののハーブだけ `LIGHT_LEAF`。出荷済み食材は既存の値が自動で引き継がれる。
- 省略すると入る値: `bakeTarget 58–78`・`baseRewardPitz 100`・`lunchRush false`・`ladderCredit true`・`requestedBy "mito"`。
- `description`／`order.lineJa` は Anti-Oracle（数量・タイミング・手順を言わない）。既存レシピの文体に合わせる。

## 3.5 期待値は「凍結基準＋着地済みスペック」から合成される（R-1）

台帳・ladder の件数と位置・late の step 番号・床値・チャプター・Lunch Rush プール・late 食材のショップ行は、テストに数字を書かず、次の 2 つの記録から合成する
（`src/logic/catalog/testSupport/composedCatalog.ts`）。実装の値は一切読まない。

| 記録 | 中身 | 変わるとき |
|---|---|---|
| 凍結基準 `src/logic/catalog/testSupport/frozenBaseline.json` | B23 直前（`577dcfd~1`）の出荷済みカタログ。`node tools/train-kit/cli.mjs freeze --at 577dcfd~1 --out <json>` で記録した履歴 | 出荷済みバッチを後から変えたとき以外は変えない（変えるなら JSON の差分をレビューする） |
| 着地済みスペック `src/trainKit/landed/*.json` | Owner が承認した各列車の記述。`apply` が書く（`seq` = 着地順、`floors` = 着地時の床値） | 列車が着地するたび 1 ファイル増える（同じ PR で） |

比較は**完全一致**なので、手書きの数字と検出力は同じ（証明は変異テスト: `node tools/train-kit/cli.mjs mutation ...`、結果は `docs/reports/data/TETO_TRAIN-KIT-R1/mutation.result.json`）。
列車の PR で人が書くのは、**Owner の承認そのものが内容になる記録だけ**になる:

- Research の非正準差分の ID 別承認表（`expansionBatch18〜22.test.ts` の「pinned … IDs」）
- 重複 Gate の例外（`OD-B18-3` など）
- 既存食材のパック変更（`materialShop.test.ts` の `LANDED_SHOP_CONTRACT`〔着地した食材の k を凍結した手書き表。着地時に行を足す〕と `APPROVED_PACK_CHANGES`〔後続列車による変更〕。k は landed スペックや実装から導出しない。Owner 承認済みの変更であり、プリフライトのパケット §5 に出る）
- ランク外のレシピがチャプター 4 以外に入る場合の `chapter`（スペックに書く。`catalogComposition.test.ts` が検証する）

これらを「導出」してはいけない（承認の記録を実装から逆算すると、承認が要らなくなる）。

## 4. sweep の追従リストの直し方

列車は毎回、同じ種類の既存テストを落とす（過去 4 バッチで 33〜55 ファイル／回）。`sweep` はそれを 1 回で列挙する。

| 表示 | 意味 | 直し方 |
|---|---|---|
| `TYPE` | レシピ／食材 ID をキーにした表（`Record<RecipeId, …>`）に新しい行が無い | 既存の同種レシピの行に倣って 1 行足す |
| `TEST` | 件数・末尾からの位置・step 番号・一覧の固定値 | **承認済みスペックから導ける値**に更新する。値の出どころをコメントに書く |
| `GOLDEN` | golden ファイル | その suite 自身の更新手段で再生成し、差分が「挿入のみ」か確認する |

**直してはいけないもの**: Research の正準順が変わる、承認外の ID が非正準で変わる、`deductionProduction.gate`・
`hint5Production.gate` の本体の表明が落ちる、保存・在庫・価格の値が変わる。これらは追従ではなく Gate 衝突なので、
スペックを直す（Owner に戻す）。期待値を書き換えて通してはいけない。

## 5. 壊れたとき

- **`anchor not found` / `anchor is ambiguous`**: カタログのファイル構造が変わった。`lib/codegen.ts` の該当アンカーを新しい形に合わせ、
  `npx vitest run src/trainKit` と `replay`（下）で、生成結果が変わっていないことを確かめる。推測で書き込む経路は無い（fail closed）。
- **`src/trainKit/codegen.anchors.test.ts` が CI で落ちた**: 同じ原因。カタログのファイルを整理した PR の側で、アンカーを直す。
- **`src/trainKit/trainContract.test.ts` が落ちた**: 出荷済みレシピの値を変えたのに `src/trainKit/landed/<tag>.json` を直していない。同じ PR で直す。
- **テンプレートを直した**: `tools/train-kit/templates/*.tmpl` を直し、`e2e` コマンドで作り直して Chromium で通す。
- **新しいグリフ用コンポーネントを初めて使う**: `--skip-glyph-dispatch` で適用し、`IngredientGlyph.tsx` の振り分け 1 行だけ手で書く。
- **新しい種類の値が要る**（star gate、鍵つき Hint、天板、生地の種類、3 層目のソース、焼成後のソース）: 生成器の対象外。機構の PR で扱う。

同値性の再確認（生成器を直したら必ず）:

```
node tools/train-kit/cli.mjs replay --base 9ad689c~1 --target 9ad689c --ids nutella-dessert-pizza,smore-dessert-pizza --tag b23b --label "Expansion Batch 23-b" --tsc --out <dir>
node tools/train-kit/cli.mjs replay --base d3d4ec0~1 --target d3d4ec0 --ids buffalo-chicken,speck-e-brie,pizza-finocchi-salad,pizza-cavolo-carote,pizza-radicchio-noci,black-truffle-pizza --tag b22 --label "Expansion Batch 22" --skip-glyph-dispatch --tsc --out <dir>
```

どちらも `catalog differences 0` でなければならない（B21・B23-a も同様。結果は `docs/reports/data/TETO_TRAIN-KIT/*.replay.result.json`）。

`codegen.anchors.test.ts` が確かめるのは「アンカーが見つかり挿入できる」ことまでで、**挿入位置が正しいか**は `replay`（CI には入っていない）が証明する。
生成器かカタログの構造を触った PR では、上の `replay` 2 本を手元で実行して結果を PR に書く。

## 6. ファイル構成

| パス | 役割 |
|---|---|
| `cli.mjs` | 入口。`replay` もここ |
| `lib/implSpec.ts` | 実装スペックの型・既定値・検証（純粋） |
| `lib/codegen.ts` | テキスト → テキストの生成器（純粋、アンカーは fail closed） |
| `lib/extract.ts` | 実カタログとの橋渡し（抽出、floor と Reference 配置の導出、スナップショット） |
| `lib/scaffold.ts` | 承認スペック → 実装スペックの骨組み |
| `plan.mjs`／`claims.mjs`／`progress.mjs`／`sweep.mjs` | 検証パケット／claim 検査／進捗台帳／追従スイープ |
| `templates/*.tmpl` | HV シード・そのテスト・E2E のテンプレート（B23-b の実装から機械的に起こしたもの） |
| `pin-files.json`／`targets.json` | 追従対象の一覧（`pins` が生成）／全量目標（Owner の数値） |
| `src/trainKit/*.test.ts` | 単体テスト、アンカー健全性、列車契約、node テストの起動 |
| `src/trainKit/trainKit.run.test.ts` | 実カタログを読むランナー（`TETO_KIT_MODE` が無い通常実行では skip） |
| `src/trainKit/landed/*.json` | 出荷済み列車のスペック（`apply` が書く。契約テストの入力） |

ライブラリが `src/` ではなく `tools/` にある理由: `src/` の非テストファイルを全走査する Gate（`.emoji` を読めるのは
`IngredientGlyph.tsx` だけ、ladder を import できる経路の限定、Preview 分離）を一切変えないため。
