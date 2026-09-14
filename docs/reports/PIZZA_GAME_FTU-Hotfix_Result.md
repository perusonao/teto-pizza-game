# PIZZA GAME First-Time User Hotfix 実装結果

Status: 実装完了・レビュー待ち

## 1. Base

- リポジトリ: `perusonao/teto-pizza-game`
- 着手前 `origin/main` SHA: `8fc3b31caa7a962c3fec400224b5d92b5c3abbd5`
  （`Phase 3A: Sauce Painting (#8)`、依頼文記載の Expected base と一致。
  作業時点で `main` はこれより進んでいなかった）
- 作業ブランチ: `claude/ftu-hotfix-0ky5sw`

## 2. スコープ

Sauce Painting自体の再設計・変更は行っていない。変更したのは以下3ファイルのみ。

- `src/App.tsx` — 初回PREPARE時の ingredient 未選択バグの修正
- `src/data/hints.ts` — Hint（ボタン押下時）と通常guidance（自動表示）の文言差別化
- `src/state/gameReducer.ts` — `SHOW_HINT` が明示的Hint文言を使うようフラグを渡すだけ

新規レシピ・Dex再設計・Topping Drag・Placement Scoring・キャラクター拡張・音声・
永続化・management系の変更は一切行っていない。ingredient count badgeも実装していない
（依頼通り見送り）。

## 3. Root cause

`src/App.tsx` の `selectedIngredientId` は `useState<string | null>(null)` で初期化されて
いた。一方、「新しい注文が来たら recipe の主ソースを自動選択する」ロジックは

```ts
const [lastOrderId, setLastOrderId] = useState(state.order.id);
if (lastOrderId !== state.order.id) { ... setSelectedIngredientId(primarySauce...) ... }
```

という形で、`lastOrderId` を**現在の注文IDそのもの**で初期化していたため、マウント直後は
`lastOrderId === state.order.id` が常に真になり、このブロックは初回レンダーでは一度も
実行されなかった。その結果、初回のみ `selectedIngredientId` が `null` のまま PREPARE に
入り、`handleTapPizza` の `if (!selectedIngredientId) return;` により dough 操作が
完全に無反応になっていた。2回目以降は `PLAY_AGAIN` で `state.order.id` が実際に変化する
ため、このブロックが発火し正常に見えていた。

## 4. Fix

`selectedIngredientId` の初期値を、注文切り替え時と同じロジック（recipeの
`requiredIngredients` からsauceカテゴリの最初の1件を探す）を使った lazy initializer に
変更し、重複ロジックを `findPrimarySauceId()` ヘルパーに切り出して両箇所から共有した。

```ts
const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(() =>
  findPrimarySauceId(state.recipe),
);
```

これにより、初回マウント時点で既に recipe の主ソース（Margheritaなら `tomato-sauce`）が
selected な状態になる。`lastOrderId` を使った「注文が変わったら再選択する」既存ロジック
自体は変更していない（`PLAY_AGAIN` 経路は従来どおり動作）。

## 5. Hint改修（副次対応）

`buildHintLine()` は `SHOW_HINT` アクションでも、`BEGIN_PREPARE` / `APPLY_SAUCE` /
`PLACE_TOPPING` などの自動guidanceでも全く同じ関数・同じ引数で呼ばれており、Hintボタンを
押しても通常guidanceと文言が完全一致していた。

最小差分で解決するため、`buildHintLine(recipe, pizza, isExplicitHint = false)` に第3引数
を追加し、sauce未塗布時のみ `empty`（通常guidance・「次に何をするか」）と `emptyHint`
（明示的Hint・「指でなぞって塗る」という具体的操作方法）を出し分けるようにした。
`SHOW_HINT` の呼び出し側だけ `true` を渡す1行の変更で完結している。新規tutorial overlay
は追加していない。

- 通常guidance（例）: 「まずはトマトソースを塗ってみて！」
- 明示的Hint（例）: 「ピザを指でなぞると、トマトソースが塗れるよ。ふちの近くまで大胆に
  広げてみて！」

missing ingredient以降の文言（`missing`/`ready`）は変更していない。

## 6. Verification（390×844 Chromium / Playwright）

ローカルでVite dev serverを起動し、`/opt/pw-browsers` のChromiumで検証した
（依頼文の禁止事項に従い、新規E2E基盤はリポジトリに追加していない。検証スクリプトは
スクラッチパッド上でのみ実行し、コミットしていない）。

実施内容と結果（すべてPASS、計24チェック）:

- 初回 ORDER → PREPARE で Tomato Sauce（Margherita）/ Olive Oil（Quattro Formaggi）が
  自動selectedになっていること — PASS
- 初回drag painting（sauce塗布が実際に反映される）— PASS
- 初回tap compatibility（<10px移動はtap経路でtopping配置）— PASS
- near-rim drag（ふち近くでのドラッグでクラッシュ・無反応なし）— PASS
- Margherita completion → BAKE → RESULT → レシピ図鑑に登録 → DISCOVERED → PLAY AGAIN
  — PASS
- PLAY AGAINで2枚目以降（Marinara / Quattro Formaggi）でも ingredient selection が
  毎回正しく初期化される（4ラウンド連続で確認）— PASS
- Hintボタン押下時の文言が通常guidanceと異なり、「指でなぞ」という操作説明を含む
  こと — PASS
- pointerdown中にBAKEへ相フェーズ遷移させるレース、および明示的な `pointercancel`
  ディスパッチでもconsoleエラーが増えないこと — PASS
- console error: 0件（全フロー通して）
- horizontal overflow: なし（ORDER開始時・複数ラウンド後の両方で確認）

## 7. Phase 3A regression

本Hotfixでの変更は `App.tsx` の状態初期化1箇所と `hints.ts` の文言分岐のみで、
`PizzaStage.tsx` / `pizzaState.ts` / `pizzaCoordinates.ts` / スコアリング / CSS には
一切手を入れていない。上記Verificationで実施したdrag painting・<10px tap互換・
near-rim座標・release時のsauce反映・pointercancel・BAKE中断・topping tapは、
Phase 3Aが実装した経路をそのまま初回ユーザーとして通しており、いずれも壊れていない
ことを確認した（SVG trail・auto-nudge・touch-actionはコード上も変更対象外であり、
上記フローの中で例外なく動作した）。

依頼文にあった「既存17ケース」の個別チェックリスト自体はこのリモート環境のファイル
システム上に見つからなかったため、今回のVerificationで機能領域として重複がないよう
横断的に確認した（drag/tap/trail/near-rim/release/pointercancel/BAKE中断/topping tap/
複数レシピ周回）。

## 8. Tests

- `npm run build` — PASS（`tsc -b && vite build`、エラーなし）
- `npm run lint` — PASS（`oxlint`、exit code 0）
- `git diff --check` — PASS（空白関連の警告なし）

### Initial-selection regression testについて（見送り）

リポジトリには現時点でテストランナーが一切存在しない（`package.json` に
test scriptなし、vitest/jest等の依存なし、`tsconfig`にもtest除外設定なし）。
「既存の軽量test infrastructureで合理的に可能なら追加」という条件のため、
新規にテストランナー・設定を導入することはHotfixのスコープを超えると判断し、
見送った。代わりに上記Playwright検証（一時スクリプト、非コミット）で
initial-selection regressionを含む全シナリオを確認済み。

## 9. Ingredient count badge

依頼通り実装していない（正解個数合わせのゲーム性へ寄せすぎないため）。
Hint文言のみで補助する方針も、既存 `missing` 文言（「◯◯をのせてみよう！」等）で
既に個数ではなく種類ベースの案内になっており、追加変更は不要と判断した。

## 10. P0/P1/P2

- P0: なし
- P1: なし
- P2: なし（今回のPrimary bugをP1として修正完了、Hint文言差の軽微な指摘も対応済み）

## 11. Changed files

- `src/App.tsx`
- `src/data/hints.ts`
- `src/state/gameReducer.ts`
- `docs/reports/PIZZA_GAME_FTU-Hotfix_Result.md`（本ファイル、新規）

## 12. Git

- Commit SHA: `d3694cb`
- PR: [#9](https://github.com/perusonao/teto-pizza-game/pull/9)（`main`向け、auto-mergeなし・未マージ）
- `git status`: 上記4ファイルのみ変更。既存local untracked report/screenshotsは
  コミット対象に含めていない。
