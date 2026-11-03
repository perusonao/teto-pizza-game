# Cooking Steam Phase 1 — S1 Result（純粋ロジック・単体テスト、Issue #726）

状態: **S1 実装済み・ローカル検証済み。** 未配線（どこからも import されない）。S2〜S4・PR 作成・merge・共有 Preview 更新は未承認で未実施。
基準 main `cfbb083`（変化なし）/ ブランチ `claude/teto-pizza-cooking-research-d2tbgv` / 計画 `TETO_COOKING-STEAM_PHASE1_Plan.md` §2 / claim: https://github.com/perusonao/teto-pizza-game/issues/726#issuecomment-6584332172

## 1. 着手前の確認
main は `cfbb083` のまま。open PR に蒸し・炙り・炒めに触れるものなし。A（炙り Production ON）・C の PR/claim は GitHub 上にまだ無い。#726 に S1 限定の claim を投稿（期限 2026-11-09、`files` は新規ファイルのみ）。CLAUDE.md・HANDOFF・HV Policy は前の作業で読んだ内容から変更が無いことを main の差分で確認（再読はしていない）。HV Policy: S1 は UI/UX の変更を含まない（未配線）ため HV 動画は対象外。

## 2. 変更ファイル（すべて新規。既存ファイルの diff はゼロ）
| ファイル | 内容 |
|---|---|
| `src/data/steamIngredients.ts` / `.test.ts` | 対象規則（clam / mussel、`pieceVisual` 必須） |
| `src/data/steamExperienceGate.ts` | `STEAM_EXPERIENCE_PRODUCTION = false` ＋ `steamExperienceEnabled()` |
| `src/logic/steam/steamPot.ts` / `.test.ts` | 殻の閾値（決定論）、look、`steamResultOf`、文言 |
| `src/logic/steam/steamLid.ts` / `.test.ts` | 案 A（ふたをタップ）の状態機械 |
| `src/logic/steam/steamShake.ts` / `.test.ts` | 案 B（鍋ゆすり＋タップ代替）の状態機械 |
| `src/logic/steam/steamedLook.ts` / `.test.ts` | 置いたピースの CSS 変数（filter 用のみ） |
| `src/logic/steam/steamOffer.ts` / `.test.ts` | ピルを出す条件 |
| `src/logic/steam/steam.architecture.test.ts` | 読まれ方・炒め／炙りとの独立性・時計／乱数不使用 |
| `src/preview/steamPreview.ts` / `.test.ts` | `?cookSteam=on|off` / `?cookSteamVariant=` / `?cookSteamMs=` の解釈とタブ記憶 |
| 本書 | Result |

計 約 1,160 行（テスト含む）。`GameScreen` / `App` / `gameReducer` / `PizzaStage` / `App.css` / `ingredients.ts` / `IngredientGlyph.tsx` / 炙り・炒めのファイル、採点・保存・識別・ladder は**未変更**。

## 3. 実装の要点
- **対象規則:** clam / mussel のみ。`pieceVisual` が無ければ false。炒め・炙りの対象と重ならないことをテストで固定。
- **殻の開き:** 閾値 `[0.30, 0.42, 0.54, 0.66, 0.78]` の決定論的な純関数（乱数・時計なし）。look = closed / partial / open / over（over は全開で `STEAM_OVER_MS`＝3000ms 保持）。評価語・数値・時間は文言に含めない（テストで固定）。
- **保持値 `amount`:** レベルを 0.95 で頭打ちにし、over のときだけ 1。**この 1 つの数値から look を復元できる**（全レベル×保持時間でラウンドトリップをテスト）。S2 で `steamedLook[ingredientId]` に入れる値はこれ。
- **案 A:** 閉める→線形（既定 4500ms で全開）→開ける。600ms 未満は何も残さない。比較用の全開時間は `OPEN` の `fullMs`。
- **案 B:** 1 回の MOVE で最大 1 ストローク、幅の 18% 以上の逆向きで確定。最後の入力から 400ms 保持→毎秒 0.12 で減衰（読み出し時の遅延評価）。タップ代替あり。12 ストロークで全殻、タップのみなら 8 回。800ms 未満の開封は何も残さない。
- **置いたピース:** `--steam-bright / --steam-sat / --steam-sheen` のみ（`filter` 用）。未蒸し・不正値はスタイルなし（従来と同一）。SVG は触らない。
- **ゲート:** Preview/DEV のみ（静的 `import.meta.env` ガード）。本番は固定 OFF。

## 4. 検証
| 区分 | 結果 |
|---|---|
| 新規テスト（8 ファイル） | **100 / 100 pass**（境界値・不正入力・決定論・独立性・時計／乱数不使用） |
| 関連 Vitest（`logic/sear` `logic/prep` `data` `preview`、ツリーを走査する既存テスト 4 本、IngredientGlyph・SearLayer・CookingPrepLayer） | **100 files / 1,742 tests pass**（8 skipped は既存分）。炙り・炒めに変化なし |
| `tsc -b` | エラーなし |
| oxlint（新規ファイル） | 警告 0 |
| 未配線の確認 | 新規ファイル以外から steam 系を import している箇所なし（grep） |
| 全 Vitest・E2E・WebKit | **未実行**（S1 は未配線のため。PR 作成時に CI で確認） |

テスト中に直した点: ①10 回タップが 0.9999999999999999 になり「全開」にならない浮動小数の問題 → レベルを 1e-9 に丸めて固定（テストあり）。②architecture テストが炒めの CSS 内の「steam」という普通の単語に反応 → 識別子名で判定するよう絞った。

## 5. 計画 §2 からの差分（意図的）
1. `steamFixtures.ts` は作らない（reducer が無く、テスト用の入力は各テスト内で足りる）。S2 で必要になれば追加。
2. 案 B の状態から `at` を削除（`lastInputAt` のみで減衰を計算できる）。
3. `amount` の写像（0.95 頭打ち／over=1）、`steamLookOfAmount`、`steamedPieceVisual`、`steamedSheen` を追加。
4. 最初の MOVE は「アンカー設定のみ」で、最初の掃引から加算。
5. タップのみで全殻を開けるのは約 8 回（計画の「約 10 回」より少ない）。HV で調整。
6. 数値はすべて PROVISIONAL。

## 6. S2 への依存関係
- **ブロッカー:** A（炙り Production ON）が `gameReducer.ts` / `GameScreen.tsx` / `App.tsx` を編集している可能性があるため、S2 は **A の merge 後**に限る（Owner の方針どおり）。
- **S2 が使う S1 の API:** `canSteamIngredient`、`steamExperienceEnabled`、`SteamResult.amount`（→ `GameState.steamedLook[id]`）、`steamedPieceVisual`（S3 の `PizzaStage`）、`steamOffer`（S3 の `GameScreen`）。
- **S2 でやること（計画 §3.3）:** `GameState.steamedLook?`、`STEAM_INGREDIENT`（全ガードは同一参照で拒否）、`RESET_PIZZA` での除去、reducer / flagOff / persistence テスト。`steam.architecture.test.ts` の許可リスト（`LATE_SLICES`）は既に S2/S3 のファイルを想定済み。
- 前提: S2 の開始前に A / C の最新 PR・claim、`ingredients.ts` の clam / mussel の `pieceVisual` が変わっていないことを再確認。

## 7. 未解決事項
1. 数値（閾値・全開時間・ストローク量・減衰・over 時間）の最終値は実機 HV 後。
2. 案 B の疲労・誤爆（HV の H6/H7）は S3 以降でしか確かめられない。タップ代替は S1 で用意済み。
3. 殻が「開く」描画（SteamLayer）は S3。置いたピースは CSS のみ（`filter`）で、開閉は表現しない。
4. 炙りの iPhone 実機 HV の結果次第で、ピル→一時画面の方式（S3）に追加の iOS 対策が要る可能性。
5. 本番ビルドに `cookSteam` が含まれないことを確認する実ビルドのゲートテストは S3（配線時）。S1 は未配線のため自明。
6. HANDOFF は更新していない（HOT）。

## 8. 禁止事項の遵守
既存ソース変更なし／HOT 4 ファイル未編集／採点・保存・識別・ladder 未変更／炙り・炒め未接触／Production・共有 Preview 未変更／PR・merge なし／CI の再実行・Monitor なし。
