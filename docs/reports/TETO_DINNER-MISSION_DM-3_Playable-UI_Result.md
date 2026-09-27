# Dinner Mission DM-3 — Playable UI / Human Verification: Result

- **Audited main:** `4bf098fc21baf457fe7e04ea96fb70a628de10ed`（Merge PR #240, DM-2）
- **Branch:** `claude/dinner-mission-phase-0-design-ryqsnc`（最新の main から作り直した）
- **Authority:**
  - `docs/reports/TETO_DINNER-MISSION_Phase0_Fresh-Design.md` §17
  - DM-2 Result Report
  - DM-3 の指示
  - 下記 OD-DM3-1

> §3 UI Integration Map は **UI の実装より前に** 書いて commit した。残りの節は実装後に追記する。

## 0. Owner Decision（DM-3 の作業開始時）

**OD-DM3-1 制限時間:**
- 「本番の START は無効にし、Preview だけで duration を注入する」を採用した（2026-09-27）。
- production では Dinner の入口、Mission Select、Detail までは表示する。START は「制限時間を調整中」として押せない。
- `?dinnerDuration=<秒>` による duration の注入は、`import.meta.env.DEV` と `VITE_PREVIEW_MODE` の build でだけ有効。
- HV と iPhone での確認は Preview deployment で行う。
- production のコードに仮の秒数は一切置かない。mission の `timeLimit.seconds` は `null` のまま（DM-5 で決める）。

## 3. UI Integration Map（実装前の監査。`4bf098f`）

### 3.1 現在の UI（実測）

| 画面 | 現状 | Dinner への影響 |
|---|---|---|
| HOME | header → hero → 2+1 の CTA（ピザを作る / ランチラッシュ / フリークッキング）→ 2×2 の menu（図鑑 / ショップ / 材料 / ランキング）→ footer。menu の下端は y=605。footer の上端は 360×800 で 757、390×844 で 801。page scroll は 0 | 2+1 の CTA は変えない。menu grid に **2 列分の幅の Dinner カード** を 1 枚足す（高さ約 84px）。360×800 でも scroll は出ない見込み。計測して確認する |
| App routing | `screen: HOME / PIZZA_SELECT / GAME`（App.tsx）。overlay（Dex / Shop / 材料 / 設定 / ランキング）は App が描画する | 新しい screen `DINNER` を追加する（Mission Select と Detail）。run 中と run の後は `GAME` を使う |
| GameScreen の ORDER | `dialogue-area`（Mito / Teto の吹き出し）と「フリープレイ」/「ピザを作る！」ボタン（`BEGIN_PREPARE`） | Dinner の target 選択 round（phase ORDER）では **この UI を出さない**。代わりに **Target Board** を出す（DM-2 の残課題 R-1 を閉じる） |
| GameScreen の PREPARE / BAKE / CUT | `game-screen--cooking` の flex skeleton。header → HUD → tabs → order-card → stage（残りの高さを吸収）→ tray → CTA bar | HUD の位置に **Dinner HUD**（`mission-hud` と同じ 33px の 1 行、Dinner 用の modifier）を置く。target 一覧は置かない |
| GameScreen の RESULT | FREE: `isFreeResultScreen`（`!isMissionActive && RESULT / DISCOVERED`）→ `ResultPanel`（再挑戦、図鑑など）。Lunch Rush: `MissionServePanel` | **Dinner では `ResultPanel` を出してはいけない**（`isFreeResultScreen` から Dinner を除く）。`MissionServePanel` と同じ skeleton の **Dinner target 結果パネル**（「完成！」または失敗の理由 +「ターゲット一覧へ」）を出す |
| Lunch Rush の overlay | `mission-overlay` / `mission-overlay__panel`（absolute、半透明の背景、最大幅 340px） | Dinner の CLEAR / FAILED と abandon の確認はこの overlay の skeleton を使う。state と文言は Dinner 専用 |
| 確認 dialog | HOME の確認は `window.confirm`（`GO_HOME_CONFIRM_MESSAGE`）。in-app の汎用 dialog は無い | Dinner だけ in-app の dialog に置き換える（`DINNER_REQUEST_ABANDON` の state を描画する） |
| safe-area | 下端の CTA は `env(safe-area-inset-bottom)` で逃がしている（`prepare-bake-bar`、HOME footer など） | 新しい画面の CTA も同じ方法で逃がす |

### 3.2 runtime の状態から UI への対応

| DM-2 の状態 | 条件 | UI |
|---|---|---|
| mission 未開始 | `state.dinner === null` かつ `screen === "DINNER"` | Mission Select（カード一覧）→ Detail（target、在庫の準備状況、制限時間、START） |
| START | `DINNER_START {missionId, now, durationMs}` | duration は `resolveDinnerDurationMs(mission)` で決める。`timeLimit.seconds` があればそれを使う。無ければ DEV / Preview のときだけ `?dinnerDuration=` を使う。どちらも無ければ START は無効で「制限時間を調整中」と表示する |
| target 選択（target の間） | `dinner.run.status === "PLAYING"`、`activeRecipeId === null`、`phase === "ORDER"` | **Target Board**（mission 名、残り N / M、残り時間、✓ 済みは押せない、残りの target を選ぶ） |
| 調理中 | `activeRecipeId === state.recipe.id`、PREPARE / BAKE / CUT | 既存の cooking UI に Dinner HUD（🌙 DINNER、残り時間、完成数 / 総数） |
| target の判定後 | `phase === "RESULT"`、run が PLAYING | Dinner target 結果パネル（PASS なら「完成！」、FAILED なら既存の失敗理由の文言と「もう一度作れます」）→「ターゲット一覧へ」 = `DINNER_RETURN_TO_TARGETS` |
| CLEAR | `run.status === "CLEARED"` | CLEAR overlay（🎉 DINNER CLEAR!、作ったピザ N / N、クリアタイム）。HOME / もう一度 |
| TIME_UP | `outcome.reason === "TIME_UP"` | FAILED overlay「時間切れ！」、X / N 完成 |
| INFEASIBLE | `outcome.reason === "INFEASIBLE"` | FAILED overlay「材料が足りなくなりました」、X / N 完成、不足している材料 |
| ABANDONED | HOME の確認 dialog で「やめる」→ `DINNER_CONFIRM_ABANDON` → `DINNER_EXIT` | overlay は出さずに HOME へ戻る |
| HOME の確認中 | `dinner.abandonRequested === true` | in-app dialog「ディナーミッションをやめますか？」（続ける = `DINNER_CANCEL_ABANDON`、やめる = confirm → exit → HOME） |
| もう一度 | 終了した run | `dinnerStartBlock` で初期状態の feasibility を再確認する。足りなければ disabled にしてショップへ案内する。可能なら `DINNER_EXIT` → `DINNER_START`（同じ mission、同じ duration の解決方法） |
| run 終了後の Shop | 終了した run の overlay の「ショップへ」 | `DINNER_EXIT` → HOME → Shop を開く（reducer の guard は run が存在する間だけ効く。exit してから開く） |
| reload | run は保存されない | 何も表示しない。HOME から始まる。「再開できます」のような文言は出さない |

### 3.3 時計

- 表示用の時計は `useDinnerRuntime` が PLAYING の間 250ms ごとに更新する `now`。判定は DM-2 の reducer（`DINNER_TICK`）が行う。
- 表示する残り時間は `ceil((endsAt - now) / 1000)` を 0 で止めた値。reducer の期限判定と同じ時計を使うので、表示と判定はずれない。
- 背景に回ったときの挙動は Lunch Rush と同じ（壁時計なので、背景でも時間は進む）。

### 3.4 未発見の recipe を漏らさないこと

- locked のカードには、タイトル、target の数、「あと N 種類のピザを発見すると解放」だけを描画する。
- target の id / 名前 / 画像は、text にも属性（`data-*`、`aria-*`、`title`、`key` 以外）にも出さない。
- Detail は unlocked のときだけ開ける。
- E2E で既存の `expectNoUndiscoveredIdentity`（DOM 全体と属性の sweep）を実行する。
