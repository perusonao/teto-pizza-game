# Cooking Steam Phase 1 — S2 Result（reducer の STEAM_INGREDIENT と steamedLook、Issue #726）

状態: **S2 実装済み・ローカル検証済み。** UI なし（S3 は未着手）。`STEAM_EXPERIENCE_PRODUCTION = false` のまま。merge は Owner 承認待ち。
設計: `TETO_COOKING-STEAM_PHASE1_S2_Design.md`（#732 で merge、Owner 条件付き承認）。基準 main `50ac26b`（#732 = `bca9aec`、その後 #731 Batch 15 が merge）。

## 1. 変更（`git diff --stat origin/main HEAD`: 6 files, +333 −1）
| ファイル | 内容 |
|---|---|
| `src/state/gameReducer.ts`（+23 −1） | import 2 行、`GameState.steamedLook?`、`GameAction` の `STEAM_INGREDIENT`、`case "STEAM_INGREDIENT"`（7 ガード）、`RESET_PIZZA` の分割代入に `steamedLook: _discardedSteam` を 1 語追加。**追加のみ**（−1 行は分割代入の行の書き換え） |
| `src/logic/steam/steamFixtures.ts` | `searFixtures.ts` の**複製**（import で共有しない） |
| `steamIngredient.reducer.test.ts`（26 件） | ゲートを `vi.mock` で開く。成功／1 回のみ／クランプ／拒否 7 種が同一参照／RESET／新ラウンドに持ち越されない |
| `steamIngredient.flagOff.test.ts` | **実ゲート**。本番リテラル `false`、opt-in なしで全拒否、`?cookSteam=on` の Preview/DEV 経路のみ受理、炙りの ON は蒸しを ON にしない |
| `steamIngredient.coexist.test.ts` | 炙り（本番 ON の実ゲート）と蒸しが同一ラウンドで独立、互いの拒否が相手に影響しない、炒め（OFF）に影響しない |
| `steamIngredient.unaffected.test.ts` | 蒸した round と蒸さない round で score・在庫・Completion・Dex・hint が一致（clam / mussel × Guided / Free、amount 0〜1）、R8 journal が `canonicalJson` で同一、`pizza` に look が現れない |

**触れていない:** `App.tsx` / `GameScreen.tsx` / `PizzaStage.tsx`（S3）、炙り・炒めのファイル、`steam*` の S1 ロジック、採点・保存・識別・ladder、`ingredients.ts`、Production・共有 Preview。S1 の `steam.architecture.test.ts` は**無修正**で通る（許可リストに `state/gameReducer.ts` を想定済み）。

## 2. 検証
| 区分 | 結果 |
|---|---|
| 新規テスト | steam 全体 10 files / **133 tests pass**（S2 追加分 32 件） |
| 全 Vitest（基準 `bca9aec`、実装直後） | **601 files passed / 1 skipped、11,193 tests passed / 13 skipped / 2 todo、失敗 0** |
| rebase 後（`50ac26b`、#731 取り込み後）の関連 Vitest | `logic/steam` `logic/sear` `logic/prep` `state` `data`: **228 files / 4,864 tests pass**（8 skipped・2 todo は既存分） |
| `tsc -b` | エラーなし |
| oxlint（reducer と steam） | 警告 0 |
| E2E | 不要（UI なし） |
| HV | 画面変更なしのため対象外（HV は S3 以降） |

## 3. 回帰の確認（Owner 指定の観点）
- **採点:** 蒸した round と蒸さない round の `score` / stars / Completion が一致。
- **保存:** `buildPendingRound` の journal がバイト同一、`pizza` に look なし、`persistence` / `pendingRound` / `scoringV2` は steam を読まない（architecture）。既存の persistence / pendingRound テストは無修正で pass。
- **在庫:** `STEAM_INGREDIENT` は在庫を変えない。消費は従来どおり焼成確定時。
- **炙り（本番 ON）:** 同一ラウンドで共存。炙りの既存テストは無修正で pass。
- **炒め（OFF）:** 影響なし。PREP は従来どおり拒否。
- **Lunch Rush / Dinner:** 拒否（同一参照）。

## 4. 残課題・次
1. S3（UI: `SteamLayer`・ピル・`PizzaStage` の見た目・`App` の dispatch 配線）は未着手。Owner の別判断。注意点は設計書 §8（内側 `.ingredient-glyph` に filter、炙りの本番ピルとの並び、`steamOverlay` スロット）。
2. リロードで蒸しの見た目が消える仕様は暫定承認済み（炙りと同じ）。
3. 参考: #729 の merge 後に main で走った WebKit run（`webkit-390x844 shard 2/3`）が failure だった（run 41572550443）。#729 の PR 上の CI では同 shard が再実行で成功しており、`lunch-rush-r8-restore` 系（#680）の間欠失敗と同じ shard。本 PR の変更とは無関係の可能性が高いが、**main の失敗ジョブの個別テスト名までは確認していない**。
