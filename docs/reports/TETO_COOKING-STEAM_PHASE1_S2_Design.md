# Cooking Steam Phase 1 — S2 詳細設計（reducer・状態・保存互換・テスト計画、docs-only、Issue #726）

状態: **設計のみ。S2 の実装は別の Owner 判断を待つ。** 基準 main `079da33`（#730 炙り Production ON 済み、#729 S1 済み）。
S2 = 蒸しの結果を**ラウンド内の一時状態** `GameState.steamedLook` として 1 回だけ記録できるようにする。UI（S3）はまだ無いので、S2 単体では誰も dispatch しない（`STEAM_EXPERIENCE_PRODUCTION = false` のため本番では常に拒否）。
前版（S1 レビュー中に作成した草案）を、#730 merge 後の実コードで確認し直して置き換えた。

## 0. 前提の再確認（2026-11-03）
| 項目 | 結果 |
|---|---|
| main | `079da33`。`CLAUDE.md` / `PROJECT_HANDOFF.md` / `docs/decisions/**` は S1 着手時（`cfbb083`）から**変更なし**（差分ゼロ）。HV Policy: S2 は画面変更なし → HV 対象外。HV は S3 以降 |
| 解除された依存 | 旧版の「#727 の merge 待ち」は**解消**（#730 で merge 済み）。S1（#729）も main に入った |
| #730 が動かしたもの | `searExperienceGate.ts`（`SEAR_EXPERIENCE_PRODUCTION = true`）、炙りの E2E・テストのみ。**`gameReducer.ts` / `App.tsx` / `GameScreen.tsx` / `PizzaStage.tsx` のソースは動いていない**（確認済み） |
| open PR | #731（Batch 15、`recipes.ts` 系・`orders.ts`・discovery golden・E2E）。**`gameReducer.ts` を含まず、clam / mussel も含まない**。蒸しと重ならない。他は古い docs PR のみ |
| claim | 蒸しの S1 claim（#726）は #729 の merge で用済み。S2 用の claim は**実装着手時に S0 で投稿**（本書では投稿しない） |

## 1. 範囲と非範囲
**S2 でやる:** `GameState.steamedLook?`、`STEAM_INGREDIENT`、`RESET_PIZZA` での除去、テスト。
**S2 でやらない:** UI（S3: `SteamLayer`・ピル・`PizzaStage` の見た目）、`App.tsx` の dispatch 配線（S3）、Preview での操作、本番 ON、HANDOFF 更新、炙り・炒めの変更。
S2 は **`gameReducer.ts` 1 ファイルのソース変更**（＋新規テスト）に限る。`App.tsx`・`GameScreen.tsx`・`PizzaStage.tsx` は触れない（S3）。

## 2. gameReducer との統合（実コードの挿入位置）
炙りと同型の追加のみ。既存の行は変更しない（`RESET_PIZZA` の分割代入に 1 語足す以外）。

| 場所（`gameReducer.ts`） | 変更 |
|---|---|
| import（`canSearIngredient` / `searExperienceEnabled` の隣、約 114–115 行） | `canSteamIngredient`（`../data/steamIngredients`）、`steamExperienceEnabled`（`../data/steamExperienceGate`） |
| `GameState`（`searedLook` の直後、約 349 行） | `steamedLook?: Readonly<Record<string, number>>;`（transient・非保存・display-only のコメント付き） |
| `GameAction`（`SEAR_INGREDIENT` の直後、約 497 行） | `\| { type: "STEAM_INGREDIENT"; ingredientId: string; amount: number }` |
| `case "SEAR_INGREDIENT"` の直後（約 1223 行） | `case "STEAM_INGREDIENT"`（下記ガード） |
| `case "RESET_PIZZA"`（約 1267 行） | 分割代入に `steamedLook: _discardedSteam` を追加（プロパティごと除去） |

規模: 約 +20 行（炙りの約 +22 行と同規模）。`GameAction` に網羅性チェック（`never`）は無く（`default:` のみ）、`GameAction` を import する他ファイル（`App.tsx` とテスト）は新メンバーで壊れない。

### 2.1 `STEAM_INGREDIENT` のガード（失敗はすべて**同じ state 参照**を返す）
`SEAR_INGREDIENT` と同じ順序（レビューしやすさ優先）:
1. `!steamExperienceEnabled()` → 拒否（本番は常にここ）
2. `phase !== "PREPARE"` または `makingStep !== "TOPPING"` → 拒否
3. `roundKind` が `GUIDED` / `FREE_COOK` 以外（Lunch Rush・Dinner）→ 拒否
4. `!canSteamIngredient(id)` → 拒否（clam / mussel 以外、`pieceVisual` なし）
5. `!ownedIngredientIds.includes(id)` → 拒否
6. `steamedLook?.[id] !== undefined` → 拒否（1 ラウンド 1 食材 1 回）
7. `!Number.isFinite(amount)` → 拒否
成功: `amount` を 0..1 にクランプして `steamedLook[id]` に保存。**在庫・pizza・score・completion・hint・placement は変更しない。**
reducer は `amount` の意味（0.95 頭打ち／over=1）を知らず、**クランプのみ**。意味づけは S1 の `steamResultOf` / `steamLookOfAmount` に集約する。

## 3. 既存の調理法との干渉
| 観点 | 設計 | 根拠 |
|---|---|---|
| 対象食材 | 炒め = beef、炙り = sausage、蒸し = clam / mussel。**互いに素** | S1 の `steamIngredients.test.ts`（交差 ∅）で固定済み |
| 状態キー | `preparedIngredientIds` / `preparedLook`、`searedLook`、`steamedLook`。**別キー・別 case・別ガード**。コードを共有しない | Owner 決定（独立実装・一般化しない） |
| フラグ | 炒め OFF、炙り **ON（本番）**、蒸し OFF。互いに依存しない | `steamExperienceGate` は `searPreview` / `prepPreview` を読まない（S1 architecture テストで固定） |
| 同一ラウンドでの共存 | 炙り（sausage）と蒸し（clam）を同じ pescatore 系のラウンドで両方行える。互いの state を変えない | S2 テストで共存を固定（§6） |
| `UNDO_LAST_PLACEMENT` | look は**食材単位**でピース単位ではないので、undo は触れない（炙りと同じ） | 既存の挙動と一致 |
| `START_BAKE` / `CONFIRM_BAKE` ほか `{...state}` の遷移 | `steamedLook` は焼成・結果表示まで**引き継がれる**（置いたピースが蒸し済みの見た目のまま焼ける／RESULT に出る）。炙りと同じ | `placeSausageAndBake` 相当のテストで scoring 等の不変を確認 |
| 新しいラウンド | `buildOrderState` が全フィールドを作り直すので持ち越されない | 次ラウンドの state に `steamedLook` が無いことをテスト |
| `RESET_PIZZA` | ピザを捨てると蒸しも消える（3 つ並べて除去） | §2 |
| 在庫 | 蒸しは在庫を消費しない（消費は従来どおり焼成確定時の 1 回） | reducer テストで不変を確認 |
| 採点・識別・Research・Hint・Dex | `pizza` / `recipe` だけを読むので不変。`steamedLook` は読まれない | architecture テスト（既存・S1）＋ ladder / golden が無修正で通る |

## 4. 保存互換
**結論: 保存形式・スキーマ・journal に一切影響しない。ロールバックも安全。**
- **Save:** `persistence.ts` / `persistProgress` は明示的な引数で保存し、`GameState` を丸ごとシリアライズしない。`steamedLook` を参照するコードは無い（S1 の architecture テストが `persistence` / `pendingRound` / `scoringV2` への言及ゼロを固定）。新しい save key も `schemaVersion` の変更も無い。
- **`pendingRound`（R8 journal）:** `buildPendingRound(source, …)` は `journalPizza(pizza)` で `id / ingredientId / x / y / stage` などの**許可リストだけ**を取り出す。`steamedLook` は `pizza` の外にあるので、入りようがない。journal の version・sanitizer・R8 行列テストは**無修正**。
- **再読込（リロード）での挙動:** 蒸した後に焼成→（後工程があり journal ができる場合）リロードすると、R8 settle は journal から state を組み直すため `steamedLook` は失われ、置いたピースは蒸し前の見た目に戻る。**display-only のため結果・採点・在庫・Dex は変わらない**（炙りと同じ既知の限界。復元しないことを仕様とする）。
- **旧版との往復:** 何も保存しないので、新旧どちらの版で開いても互いの save を壊さない。
- **S2 の確認:** (a) `buildPendingRound` の出力が `steamedLook` の有無で同一（`canonicalJson` 比較）、(b) `steamedLook` を持つ state を `JSON.stringify` した `pizza` 部分に look が現れない、(c) 既存の persistence / pendingRound テストが無修正で通る。

## 5. リスクと対策
| # | リスク | 対策 |
|---|---|---|
| R1 | `gameReducer.ts` は HOT。Batch 15（#731）や他セッションと衝突 | #731 は reducer を含まない（確認済み）。着手時に最新 main へ rebase し、`merge-tree` で再確認。差分は追加のみ |
| R2 | 3 つの似た case による保守負債 | Owner 決定どおり許容。「3 つ目が残ると決まった後」に別 Gate で一般化を検討（Opus レビュー） |
| R3 | 蒸し済みの look が RESULT / Dex 表示に漏れる | 読む箇所を許可リスト（reducer / PizzaStage / SteamLayer / GameScreen / App）に限定（S1 architecture テスト） |
| R4 | 本番フラグを誤って ON | 本番リテラルは `false` を S1 のテストで固定。ON にするのは別の Owner 承認 |
| R5 | リロードで look が消える | §4 のとおり仕様（display-only）。S3 の HV 時に Owner へ周知 |

## 6. テスト計画（新規ファイルのみ。既存テストの編集なし）
炙りのテスト構成（`searIngredient.reducer.test.ts` = ゲート open を `vi.mock`、`searIngredient.flagOn.test.ts` = 本番リテラル）に合わせる。蒸しの本番リテラルは `false` なので、「flagOn」ではなく「**flagOff（本番既定）**」を中心にする。

| ファイル | 内容 |
|---|---|
| `src/logic/steam/steamFixtures.ts` | `searFixtures.ts` を**複製**（import で共有しない）。clam / mussel / sausage を所持した Guided / Free を TOPPING まで進める `toStep`、`placeClamAndBake`、`normalised`（`steamedLook` を除く） |
| `src/logic/steam/steamIngredient.reducer.test.ts` | `steamExperienceGate` を `vi.mock` で open。成功（Guided / Free × clam / mussel）、1 回のみ（2 回目は同一参照）、`steamedLook` 以外が不変（`toStrictEqual`）、クランプ（>1→1、<0→0）、§2.1 の拒否 7 種すべてが**同一参照**（Lunch Rush・Dinner、DOUGH / SAUCE 等の step、PREPARE 以外の phase、非対象（beef・sausage・shrimp）、未所持、非有限値）、`RESET_PIZZA` で消える（プロパティごと除去）、新ラウンドに持ち越されない |
| `src/logic/steam/steamIngredient.flagOff.test.ts` | 実ゲートを使用（モックなし）。本番リテラル `STEAM_EXPERIENCE_PRODUCTION === false`、Preview opt-in なしで `STEAM_INGREDIENT` が全ラウンドで同一参照拒否、全アクション列の結果が蒸し無しの state と同一、`?cookSteam=on` の opt-in では受理される（Preview 経路）。リテラルを変えるには本ファイルの deliberate な編集が必要、と明記 |
| `src/logic/steam/steamIngredient.coexist.test.ts` | 同一ラウンドで炙り（sausage）と蒸し（clam）を行い、`searedLook` と `steamedLook` が互いに独立／片方の拒否がもう片方に影響しない／炒め OFF でも成立 |
| `src/logic/steam/steamIngredient.unaffected.test.ts` | 蒸した round と蒸さない round で、焼成〜RESULT の score・stars・在庫消費・Completion・Dex が一致（`placeSausageAndBake` と同型）。`buildPendingRound` が `steamedLook` の有無で `canonicalJson` 同一 |
| `steam.architecture.test.ts`（S1 作成・既存） | 許可リストに `state/gameReducer.ts` を含む想定で既に作ってあるため**無修正**で通ること。`pendingRound` / `persistence` / `scoringV2` が steam を読まないこと |
| 既存テスト | 全 Vitest・golden・`persistence.*`・`pendingRound.*`・`gameReducer.*` が**無修正**で通ること。E2E は S2 では不要（UI 無し） |

## 7. 完了の定義（S2）
`git diff --stat origin/main...HEAD` が **`gameReducer.ts`（追加のみ＋ `RESET_PIZZA` の 1 語）と新規テストのみ**／新規テスト pass／全 Vitest 緑（件数は main から増加分のみ）／`tsc -b`・oxlint クリーン／フラグ OFF で挙動が従来と完全に同一／`pendingRound`・Save に現れない／`App` / `GameScreen` / `PizzaStage` / 炙り・炒めのファイル無変更。PR は S1 と同じく Owner の指示後に作成し、CI（WebKit 含む）と Codex を通す。

## 8. S3 への引き継ぎ（確認済みの注意点）
1. **ピースの `filter` は焼成のものが既にある。** S1 の `--steam-*` を外側ラッパーに `filter` として当てると競合する。S3 の `Steam.css` は内側の `.ingredient-glyph` に当てる（炙りが SVG パスを上書きするのと同じ）。
2. `PizzaStage` のクラス選択は `preparedLook?.className ?? searLook?.className`。蒸しは末尾に `?? steamLook?.className`（対象が互いに素なので順序に依存しない）。`PizzaStage` に `steamOverlay` スロットを足すか、既存スロットに寄せるかは S3 で決める。
3. `GameScreen` の `setPrepBusy`（背面を `inert` にする）は共有する。蒸しのレイヤも `onBusyChange` で同じ状態を使う。
4. 炙りは**本番 ON**になったため、S3 の Preview 検証では本番の炙りピル（sausage）と蒸しピル（clam / mussel）が同じ TOPPING に出うる。同時には出ない（食材が互いに素）ことを E2E で固定し、ピル位置は炙りの `searPillPlacement` の教訓を取り込む。
5. 本番ビルドに `cookSteam*` が含まれないことの実ビルドゲートテスト（`searPreview.gate.test.ts` と同型）は S3 で追加。

## 9. Owner 判断が要る点
| ID | 論点 | 助言 |
|---|---|---|
| S2-1 | この設計で S2 の実装 PR（`gameReducer.ts` ＋新規テストのみ）に進んでよいか | 進めてよい。差分が小さく UI も無い |
| S2-2 | リロードで蒸しの見た目が失われる点（§4）を仕様として受け入れるか | 受け入れる（炙りと同じ・display-only） |
| S2-3 | S2 を S3 と同じ PR にまとめるか分けるか | **分ける**（S2 はフラグ OFF の本番影響ゼロで小さく、S3 は HOT 3 ファイルと UI を含むため） |
| S2-4 | S2 実装の着手時期（炙り Production ON の実運用で問題が出ていないかを見てからか） | 炙りの本番観察に問題がなければいつでも可 |
