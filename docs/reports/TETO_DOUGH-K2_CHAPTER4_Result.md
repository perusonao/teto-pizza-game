# #577 B — K2: 章の✓判定から後乗せカタログのレシピを除く Result

Refs #577。基準 `main` `bd71539`。Owner 判断（2026-10-23）: K2 を承認。本番 FINISH / Late Catalog は OFF のまま、Pinsa 本体（C）は HOLD。

## 変更
- `src/state/recipeChapters.ts`: `isChapterCleared(chapter, dex, lateRecipeIds?)` を追加。章の**通常レシピ**（`LATE_RECIPES` の id を除く）が 1 件以上あり、すべて発見済みのとき true。通常レシピが 0 件の章（後乗せのみ）は常に false。
- `src/components/DexOverlay.tsx`: 章見出しの「✓」の条件を `discovered === total` から `isChapterCleared` に置換。**表示する数（`discovered/total`）は変更なし**（`chapterProgress` は無変更。Result 画面の `No.xx（第n章 d/t）` も無変更）。
- 保存形式・schema・Dex の中身は変更しない（✓ は毎回 Dex から導出）。採点・経済・`matcher.ts`・`lateCatalog.ts`・本番スイッチは未変更。

## 挙動
| 状態 | 章4 の表示 |
|---|---|
| 本番（後乗せ OFF。`RECIPES` に後乗せレシピなし） | 従来と同一: `d/t`、`d === t` のとき ✓ |
| late catalog ON、通常 26 件を発見済み | `26/27 ✓`（分母は 27 のまま。後乗せレシピは✓の条件にならない） |
| late catalog ON、通常が 1 件でも未発見 | ✓ なし（後乗せだけ発見しても付かない） |

本番は後乗せレシピが `RECIPES` に存在しないため、`isChapterCleared` ＝ `discovered === total` で、**見た目・挙動は変わらない**。

## テスト
`src/state/recipeChapters.test.ts` に `isChapterCleared (K2)` を 5 件追加（本番は全章で `discovered===total` と同値／ON 相当で 26/27 ✓／通常の欠けは✓を妨げ、後乗せのみの発見は✓を付けない／id が後乗せ集合に無い追加レシピは数える・集合は注入可／後乗せのみの章は常に false）。既存の `DexOverlay` 系テスト（6/6 ✓ など）は無修正で通る。

## 検証
- `npx vitest run`: 507 files passed, 1 skipped（9346 passed, 2 skipped, 4 todo）
- `tsc -b`、`npm run build`: 問題なし
- Playwright / WebKit E2E は未実施（CI で確認）

## HV
本番で見た目・操作が変わらない。✓ の変化が見えるのは late catalog ON の状態のみで、ON ビルドは共有 Preview に載せない方針（#633 V1）のため、**ON 状態の見え方の確認は E5 の HV（iPhone Safari 実機）で行う**。本 PR での動画・スクリーンショットの要否は Owner 判断（`TETO_HUMAN-VERIFICATION-POLICY.md` §2「見た目/操作が変化しない」に該当すると判断し、未作成）。

## 範囲外
Result 画面の章進捗に ✓ は無く、変更していない。`pizzaSelect.ts` の章進捗（`discovered: cards.length`）は ✓ を出さないため未変更。章 4 の件数の再導出、late step 番号（G-3）は触れない。
