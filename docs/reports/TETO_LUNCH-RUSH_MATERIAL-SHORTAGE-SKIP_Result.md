# Lunch Rush — 材料不足注文のスキップ（H-R）: Implementation Result（Issue #212）

- **Base main:** `f3bb7030c6bed15a6e2e6cd57a5e13bdce9ae9a8`（PR #233 のマージ）
- **Branch:** `claude/lunch-rush-shortage-revalidation-dky0du`
- **Design:** `docs/reports/TETO_LUNCH-RUSH_MATERIAL-SHORTAGE-SKIP_Fresh-Revalidation.md`（`76cde34`）
- **Owner decisions:** OD-1 = **H-R**、OD-2 = **承認**、OD-3 = **別 Issue #234**、OD-4 = **#212 を使う**
- **GitHub:**
  - #212 の description を H-R 仕様に更新した
  - PR #213 は superseded のコメントを付けて close した（merge はしていない）
  - FAILED 時の Dex 更新は #234 として新しく起票した。重複する既存 Issue が無いことは確認済み

## 1. What changed

| 層 | 変更 |
|---|---|
| 在庫判定（pure） | `recipeStockShortage(recipe, inputs)` を追加した（`src/state/recipeDiscoveryState.ts`）。`isRecipeCookable` の中身を材料ごとの `{ingredientId, need, have}[]` に分解したもので、`isRecipeCookable` は `shortage.length === 0` のラッパーとして残した。判定の閾値は変えていない（scatter は `max(1,minCount)`、sauce/spread は 1、starter は無限、未所有は 0、未知 id は不足）。Lunch Rush にも UI にも依存しないので、他のモードからも再利用できる |
| Lunch Rush の pool（pure） | `src/mission/lunchRush.ts` に次の 3 つを追加した。<br>・`missionOrderRecipeIds`: 発見済み ∩ 全材料 OWNED ∖ SOLD OUT。在庫は見ないので、不足した注文も出る<br>・`cookableMissionRecipeIds`: 上に `isRecipeCookable` を掛けたもの<br>・`canStartLunchRush` |
| reducer の権威 | ・`BEGIN_PREPARE`: phase が ORDER のときだけ有効にした（E3 の修正）。Lunch Rush では「発見済み ∧ **cookable**」のときだけ PREPARE に進む（FREE の LK-8 と対称）<br>・`MISSION_SKIP_ORDER {recipeId}`: 新しい action<br>・`missionSoldOutRecipeIds`: run 内だけの state。保存しない<br>・`MISSION_NEXT_ORDER` / `MISSION_RESET_ORDER`: cookable が 0 件のときは注文を作らない |
| Mission run | `END_EARLY` action と `endedEarly` フラグを追加した。一度だけ遷移し、metrics・serves・clock は保持する |
| UI | ・`MissionShortagePanel`: 「⚠️ 材料が足りません」、不足材料のチップ（glyph + 名前 + `have/need`）、補充の案内、唯一の CTA「この注文をスキップ」。不足している注文では Teto の台詞も不足を説明するものに変わる<br>・HOME: cookable が 0 件ならランチラッシュを無効にし、理由を表示する<br>・Mission RESULT: 早期終了の説明を出し、「もう一度」を無効にして補充を案内する |
| App の配線 | ・skip handler: reducer 側でも条件を再検査する。clock には触れない。次の cookable 注文へ `BEGIN_PREPARE` で直行する（UX-1 と同じ）<br>・serve 後に cookable が 0 件なら `END_EARLY`<br>・`startMission` / `handleStartLunchRush` は `canStartLunchRush` で guard する |

## 2. 承認した仕様と実装の対応

| 仕様 | 実装 / 証拠 |
|---|---|
| 不足した注文も出てよい | 通常の抽選は `missionOrderRecipeIds`（在庫を見ない）から行う。テスト「the normal draw may still land on a short order」 |
| PREPARE に進めない / bake できない | `BEGIN_PREPARE` が同じ参照を返す（reducer test B/C）。PREPARE に入れないので bake 経路にも到達しない |
| 「材料が足りません」と不足材料の表示 | `MissionShortagePanel`。App / E2E / component の各テストで確認 |
| skip は不足しているときだけ | UI は `recipeStockShortage` が空でないときだけパネルを描画する。reducer は cookable な注文への skip を拒否する（M） |
| skip しても score / Pitz / inventory / Dex / bestScore / timesMade / servedCount が変わらない | reducer test K/L/P（参照が同一であること、Dex entry が等しいこと）、App test（HUD 0、Pitz 120、localStorage が bytewise 同一） |
| skip 中も timer は動き続ける | skip は `missionRunReducer` を呼ばない。App test J（固定 `Date.now` で 2:30 のまま、期限を過ぎると RESULT）。E2E で HUD が減り続けることを確認。HV 動画 |
| skip した recipe は SOLD OUT（run 内のみ、保存しない） | reducer の SOLD OUT テスト、run 全体テスト G（40 注文 × 10 run）。E2E で実際に serve した後にも再出現しないこと。localStorage に SOLD OUT が無いこと |
| skip の次は cookable な注文、不足 → 不足の連鎖なし | reducer test F（60 回）と G |
| 開始時に cookable が 0 件なら開始しない | HOME ボタンを無効化 + `handleStartLunchRush` / `startMission` の guard。`MISSION_RESET_ORDER` は状態を変えない |
| run の途中で cookable が 0 件になったら安全に RESULT | `MISSION_NEXT_ORDER` は RESULT のまま（登録済み）→ App が `END_EARLY` を出す。reducer / App / E2E で「PREPARE にも Free Cooking にも戻らない」ことを確認 |
| Free Cooking への fallback も、PREPARE への不正遷移も起きない | 0 件の各経路で `freeCook:false` と `isMissionRound:true` が保たれること、`BEGIN_PREPARE` が no-op になることを確認（reducer test H、R） |
| starter の無限在庫を維持 | `recipeStockShortage` は starter を常に充足として扱う（E） |

## 3. Owner decision の実施

- **OD-3（#234）:** FAILED の pizza を serve すると `MISSION_NEXT_ORDER` で Dex が更新される既存の挙動は変えていない。今回保証したのは「skip の経路が Dex を一切変えない」ことだけで、reducer test K/L/P が `dex` の参照同一性で確認している。
- **Dinner Mission との互換:** 在庫の判定は `isRecipeCookable` / `recipeStockShortage` の pure 関数に閉じている。Lunch Rush 固有なのは pool の選び方（lunchRush.ts）と UI だけ。Dinner 用の data / UI / reward / timer / unlock は追加していない。

## 4. Tests

| 種別 | ファイル | 件数 |
|---|---|---:|
| reducer / pure（新規） | `src/state/gameReducer.missionShortage.test.ts` | 27 |
| Mission run（追記） | `src/mission/lunchRush.test.ts`（END_EARLY） | 3 |
| App（追記） | `src/App.test.tsx`「Lunch Rush material shortage (Issue #212)」 | 6 |
| component（新規・追記） | `MissionShortagePanel.test.tsx`（2）、`MissionResultOverlay.test.tsx`（2） | 4 |
| E2E（新規） | `e2e/lunch-rush-material-shortage.spec.ts` | 3 × 4 project |
| Layout Contract（追記） | `e2e/layout-contract.spec.ts` LC-3b（4 材料不足の ORDER と skip 後の PREPARE） | 7 profile |

Revalidation の matrix との対応:

| ID | 内容 | 確認したテスト |
|---|---|---|
| A | 在庫十分 | reducer、App |
| B | 1 材料不足 | reducer、App、E2E |
| C | 複数材料不足 | reducer（quattro-formaggi 3 件）、App / E2E（genovese 2 件）、LC-3b（4 件） |
| D | 在庫ちょうど 1 | reducer（egg 1、cherry-tomato 3/3、2/3） |
| E | starter のみ | reducer |
| F | skip → cookable | reducer、App、E2E |
| G | 連続 skip の防止 / 同じ run で再出現しない | reducer、E2E |
| H | cookable 0 件 | reducer、pool、App、E2E |
| I | reload / save | App（保存データが bytewise 同一、SOLD OUT は保存されない）、E2E |
| J | timer 継続 | App、E2E、HV |
| K | score / Pitz / servedCount に影響しない | reducer、App、E2E |
| L | 在庫を消費しない | reducer、E2E |
| M | cookable な注文は skip 不可 | reducer、App |
| N / O | FREE / Free Cooking / ORDER 以外の phase では no-op | reducer |
| R | `BEGIN_PREPARE` の phase guard | reducer |
| mutation | App の END_EARLY 分岐を無効化した場合 | App test H が失敗することを確認 |

## 5. Final Gate（ローカル、exact HEAD）

| Gate | 結果 |
|---|---|
| full Vitest | **172 files / 3636 passed**, 1 skipped（既存）, 0 failed |
| typecheck（`tsc -b`） | PASS |
| lint（`oxlint`） | PASS（0 warnings） |
| build（`npm run build`） | PASS（chunk size の警告は既存のもの） |
| full Chromium E2E（`iphone-390x844` + `iphone-360x800` + `layout-chromium`） | **161 passed**, 19 skipped（既存の OD-V-6 による 1 幅 1 回の guard）, 0 failed |
| Layout Contract | LC-0〜LC-5 と新しい LC-3b が 7 profile（N/S × 390/360、safe-area の P390i/E390i/E360i）すべてで PASS |
| WebKit | ローカルに WebKit が無いため、PR の exact HEAD で GitHub Actions `E2E WebKit` の結果を確認する（§8） |

## 6. Mobile / Layout

- 不足パネルは serve パネルと同じ「stage だけが縮む」skeleton を使っている。そのため CTA は常に in-flow の最下部、safe-area の上に置かれる（L-A）。
- 注文の会話はこの画面の説明役なので、高さを固定した（`flex-shrink: 0`）。高さが足りない profile（E360i）では飾りの生地が縮み、container の高さが 120px 以下になったら非表示になる。実装途中で、会話の吹き出しが縮んで生地と重なる不具合を見つけて修正した（`after-shortage-order-4materials-E360i-safearea.png`）。
- 材料チップは 360px でも 2 列に収まる。4 材料の quattro-formaggi でも 2 行で済む。

## 7. Human Verification

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| `TETO_LUNCH-RUSH_SHORTAGE-SKIP_HV1_390x844.mp4` | 390×844 | 21.4 s | 320 KB | H.264 High, yuv420p, 25 fps | PASS |
| `TETO_LUNCH-RUSH_SHORTAGE-SKIP_HV2_390x844.mp4` | 390×844 | 22.0 s | 316 KB | H.264 High, yuv420p, 25 fps | PASS |

Download: セッション内で直接提出した。policy に従い repo には commit していない。

Video Verification: PASS。ffprobe で codec / 解像度 / 長さを確認し、フレームを抜き出して内容を確認した。

**HV1 で確認できること:**

1. HOME からランチラッシュを開始する
2. 最初の注文は在庫不足のビスマルク
3. 「⚠️ 材料が足りません」が表示される
4. 不足材料「たまご 0/1」が表示される
5. 「この注文をスキップ」をタップする
6. 次の注文は作れるマルゲリータで、PREPARE に直行する
7. timer は止まらない（不足画面 2:57 → skip 後 2:55 → 次の注文 2:45）
8. 通常の注文は PREPARE に進む。1 枚提供（🍕 1）した後の次の注文もマルゲリータで PREPARE に直行し、SOLD OUT のビスマルクは再び出ない

**HV2 で確認できること:**

- 作れる recipe が 0 件のとき、HOME のランチラッシュが無効になり理由が表示される
- ジェノベーゼの 2 材料不足（C）→ skip → 最後の在庫（たまご 1 個）でビスマルクを作る → 「次の注文へ」→ Mission RESULT に「作れるピザがなくなったので終了しました」が出て、「もう一度」は無効、補充が案内される

**Screenshots:** `docs/reports/screenshots/lunch-rush-material-shortage-skip/`

| before（main `f3bb703`） | after |
|---|---|
| `before-shortage-order-*`: 不足している注文でも「ピザを作る！」が出る | `after-shortage-order-*`: 不足パネルと skip |
| `before-shortage-prepare-*`: 不足している注文でも PREPARE に入れる | `after-skip-prepare-*`: skip 後に作れる注文で PREPARE |
| `before-home-zero-cookable-*`: 作れる recipe が 0 件でもランチラッシュを押せる | `after-home-zero-cookable-*`: 無効化 + 理由表示 |
| — | `after-shortage-order-4materials-*`: 4 材料不足（360×800 と safe-area E360i） |

## 8. CI（PR exact HEAD）

WebKit は PR の exact HEAD で GitHub Actions を確認する。結果は PR のコメントと最終報告に記録する。

## 9. Scope guard

以下は変更していない（`git diff f3bb703` で確認）。

- Hint Economy / H1–H4 の価格、Discovery matcher / signature、progression ladder
- recipe / ingredient catalog（`src/data/recipes.ts`、`src/data/ingredients.ts`）、Shop の価格
- scoring、★1 economy、Cooking Steps、Cutting、Dinner Mission、monetization、save schema、ranking の server 側（`functions/`）

`src/data/` での変更は `dialogue.ts` への台詞関数 1 つ（`buildTetoShortageLine`）の追加だけ。

## 10. Follow-up（今回はやっていない）

- #234: Lunch Rush の FAILED pizza で Dex の timesMade / BEST が更新される件（OD-3）
- 作れる 1 注文目の「ピザを作る！」タップの要否（Revalidation §5 で範囲外としたもの）
- Mission RESULT に skip 数を表示する（Revalidation §6 で範囲外としたもの）
