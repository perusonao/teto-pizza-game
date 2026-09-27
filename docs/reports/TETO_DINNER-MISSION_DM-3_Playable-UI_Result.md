# Dinner Mission DM-3 — Playable UI / Human Verification: Result

- **Audited main:** `4bf098fc21baf457fe7e04ea96fb70a628de10ed`（Merge PR #240, DM-2）
- **Branch:** `claude/dinner-mission-phase-0-design-ryqsnc`（最新の main から作り直した）
- **Authority:**
  - `docs/reports/TETO_DINNER-MISSION_Phase0_Fresh-Design.md` §17
  - DM-2 Result Report
  - DM-3 の指示
  - 下記 OD-DM3-1

> §3 UI Integration Map は **UI の実装より前に** 書いて commit した（`9112b86`）。残りの節は実装と検証のあとに追記した。

## 0. Owner Decision（DM-3 の作業開始時）

**OD-DM3-1 制限時間:**
- 「本番の START は無効にし、Preview だけで duration を注入する」を採用した（2026-09-27）。
- production では Dinner の入口、Mission Select、Detail までは表示する。START は「制限時間を調整中」として押せない。
- `?dinnerDuration=<秒>` による duration の注入は、`import.meta.env.DEV` と `VITE_PREVIEW_MODE` の build でだけ有効。
- HV と iPhone での確認は Preview deployment で行う。
- production のコードに仮の秒数は一切置かない。mission の `timeLimit.seconds` は `null` のまま（DM-5 で決める）。

## 1. Audited main SHA

- `4bf098fc21baf457fe7e04ea96fb70a628de10ed`（Merge PR #240, DM-2）。
- PR を作る直前に `origin/main` を fetch して、main がまだ `4bf098f` であることを確認した（DM-3 の作業中に main は動いていない）。

## 2. Issue / PR

- Duplicate Gate: Issue を作る前に open / closed の Issue と PR を確認した。DM-3 と重複するものはなかった。
- Issue: **#242**「Dinner Mission DM-3: Playable UI / Human Verification」
- PR: **#243**（OPEN のみ。auto-merge は使わない。main への merge もしない）。
- 並行している PR #241（Discovery Hint 3.0 H3-1）の変更ファイルは 6 個で、DM-3 と重なるファイルはない（`docs/reports/TETO_DISCOVERY-HINT-3_*`、`docs/reports/data/TETO_DISCOVERY-HINT-3_*`、`src/logic/discovery/selectableHint*`）。
- Issue #234 は OPEN のまま。DM-3 では触っていない。

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

## 4. HOME

- `.home-menu` の先頭に横長のカード「🌙 ディナーミッション」を 1 枚追加した。
  - サブテキスト: 解放済みの mission があれば「時間内に指定のピザを全部作ろう！（解放 N）」。なければ「… 発見で解放」。
  - カードは常に押せる。locked だけの状態でも Mission Select を開いて、解放条件を読める。
- 2+1 の CTA（🍕 ピザを作る / ⏱️ ランチラッシュ / 🎨 フリークッキング）の構成、大きさ、位置は変えていない。
  - 390×844 と 360×800 のどちらでも、CTA の top は 307 / 307 / 369 px。
  - Dex 0 → Dex 1 で CTA が動かないことを Layout Contract LC-4（7 profile）で確認した。
- 最初に 64px の 2 行カードで作ったところ、P390i で LC-4 が落ちた（Dex 0 と Dex 1 で CTA の top が 4px ずれた）。
  - そこで 1 行、`min-height: 48px` のカードに作り直した。LC-4 は通る。
- before / after: `before-home-{dex1,dmA}-{390x844,360x800}.png` と `after-home-dmA-{390x844,360x800}.png`。

## 5. Mission Select

- 画面: `DinnerMissionScreen`。タイトルは「🌙 ディナーミッション」。header に 🏠 ホーム がある。
- 表示は `dinnerMissionCardView` の結果だけから作る。
- **unlocked のカード** は `<button>` にする。
  - 中身: タイトル、ピザ N 種類、target 名（`マルゲリータ・ビスマルク・…`）、「くわしく見る →」。
- **locked のカード** は `<div>` にする（button ではないので focus も click もできない）。
  - 中身: 🔒 タイトル、ピザ N 種類、「あと N 種類のピザを発見すると解放」だけ。
  - view model の段階で target の id と名前を持たない（§14）。

## 6. Mission Detail

- 表示するもの:
  - target の grid（名前）
  - 制限時間 `MM:SS`。duration がなければ「調整中」
  - readiness
  - 注意書き「材料を使いすぎて残りのピザが作れなくなると失敗です。始めたらショップには行けません。」
  - 画面下の `🌙 スタート`
- readiness（`dinnerReadiness`）:
  - READY: 「✅ 材料はそろっています」（`role=status`）。START を押せる。
  - SHORTAGE: 「⚠️ 材料が足りません」と各行の「たまご 必要 2 / 所持 1」（`role=alert`）、それに「🛒 ショップで補充する」。START は disabled。
  - NO_TIME_LIMIT: 制限時間「調整中」。START は disabled（OD-DM3-1。production はこの状態）。
  - 不足の判定は duration の判定より先に行う。production でも、足りない材料は分かる。
- START は `dinnerStartBlock`（DM-2 と同じ gate）を通ったときだけ `DINNER_START` を dispatch する。

## 7. Target selection

- 通常の ORDER 画面（dialogue、「ピザを作る！」の action-row、PizzaStage）は、Dinner では描画しない。代わりに `DinnerTargetBoard` を出す。
  - 押しても何も起きない「ピザを作る！」は残らない。
- board の中身: mission タイトル、「残り N / M」、残り時間、target ごとの行（高さ 56px）。
  - 完成した行は「✔️ 完成」と表示し、`disabled` にする。
- 行を押す → `DINNER_SELECT_TARGET` → その recipe の調理 round が始まる。
- 1 枚を焼き終えると（CUT がある target は CUT のあと）`DinnerTargetResultPanel` が出る。
  - PASS: 「✔️ {name} 完成！」と「完成 N / M」。
  - 品質 FAILED: Completion Gate の理由と「{name}はもう一度作れます」。
  - 「ターゲット一覧へ」で board に戻る（`DINNER_RETURN_TO_TARGETS`）。二度押ししても 1 回だけ戻る（E2E 31）。
- 作る順番は自由。E2E は breakfast → margherita → funghi → bismarck、HV-A は funghi → breakfast → margherita → bismarck で作った。

## 8. Cooking HUD

- `DinnerHud`（`.mission-hud.dinner-hud`、高さ 33px）: 🌙 DINNER、⏱ MM:SS、完成数 / 全体。
  - 調理中だけ出す（run が PLAYING で、phase が ORDER ではないとき）。
- 調理中は target の一覧を出さない。今作っている target の名前だけが、既存の recipe カードに出る。
- Lunch HUD の component も state も使っていない（`isMissionRound` は Dinner では false のまま）。
- 生地、ソース、チーズ、具材、焼く、カットの工程 UI は Free Cooking と同じ。HUD が 33px 増えただけなので、調理エリアは狭くならない（screenshot の `after-cooking-hud-*`）。

## 9. Timer

- duration の出どころ（`resolveDinnerDurationMs`）:
  1. mission の `timeLimit.seconds`。DM-5 で決めるまで `null`。
  2. `?dinnerDuration=<正の数の秒>`。ただし `import.meta.env.DEV || VITE_PREVIEW_MODE` の build だけ。production の bundle では search 文字列を `""` として渡すので、この経路は届かない。
  3. どちらもなければ `null`。START は disabled になる。
- production build（`npm run build`）で確認した:
  - `dist/assets/*.js` の中に `location.search` は 0 件。
  - 解決関数を呼ぶ箇所は `lr(e, ``)` に畳み込まれている。
  - parser は bundle に残るが、空文字列しか渡されないので必ず `null` を返す。
- 時計: `useDinnerRuntime` が PLAYING の間、250ms ごとに `now` を更新して `DINNER_TICK` を dispatch する。
  - 表示は `formatDinnerClock(endsAt - now)` で、切り上げて 0 で止める。
  - 判定は reducer が行う。Lunch Rush の timer とは別のもの（Lunch の hook と state は触っていない）。
- TIME_UP は `page.clock.fastForward` を使った E2E 12 と HV-C で確認した。

## 10. CLEAR

- `DinnerResultOverlay`（`role=dialog`、aria-label「ディナーミッション結果」）:
  - 「🎉 DINNER CLEAR!」
  - 「作ったピザ 4 / 4」
  - 「クリアタイム MM:SS」（`outcome.clearMs`）
- 報酬の行は出さない（DM-4 の範囲）。Pitz も Dex も変わらないことを E2E で save から確認した。
- ボタンは「もう一度」と「🏠 ホーム」。

## 11. FAILED

- TIME_UP: 「⏰ 時間切れ！」と「X / N 完成」。
- INFEASIBLE: 「材料が足りなくなりました」「X / N 完成」、不足の行（例「たまご 必要 1 / 所持 0」）。
  - 置きすぎた（over-placement）とき: E2E 13、HV-B。
  - 品質 FAILED で在庫が足りなくなったとき: E2E 15。
- 品質 FAILED でも在庫が足りる場合は run を続ける。target は board に残り、もう一度作れる（E2E 14）。
- **もう一度**: `dinnerStartBlock` と duration をもう一度確かめる。
  - 足りなければ disabled にして、「🛒 材料を補充すると再挑戦できます」と「ショップへ」を出す（E2E 21）。
  - 足りれば、同じ mission、同じ duration の出どころで新しい run を始める（E2E 20）。
- **ショップへ**: `DINNER_EXIT` → HOME → Shop overlay（E2E 23）。run が続いている間は、どの画面にもショップの入口がない（E2E 22）。

## 12. Abandon

- 🏠 ホームを押すと `requestLeave()` が呼ばれる。run が PLAYING なら `DINNER_REQUEST_ABANDON` になり、アプリ内の `DinnerAbandonDialog`（`role=alertdialog`）が出る。
  - 文言: 「ディナーミッションをやめますか？」「ここまで使った材料は戻りません。」「報酬はありません。」
  - **続ける**（主ボタン、48px）: `DINNER_CANCEL_ABANDON`。run と時計はそのまま進む。
  - **やめる**（44px）: `DINNER_CONFIRM_ABANDON` → `DINNER_EXIT` → HOME。
- `window.confirm` はもう使っていない。
  - unit test: `confirm` の spy が一度も呼ばれない。
  - E2E: page の `dialog` イベントが来たら throw する。
- 消費した材料は戻らない（E2E 16/17/18: たまご 5 → 4）。

## 13. Reload

- run は保存しない（save schema は変えていない）。reload すると HOME から始まる。
- board も overlay も出ない。「再開」という文言はどこにもない（E2E 19）。

## 14. Privacy

- locked のカードの view model は `{missionId, titleJa, totalTargets, unlocked:false, undiscoveredCount}` だけを持つ。
  - target の id と名前は、発見済みのものも含めて持たない（unit test で JSON を全 recipe について確認した）。
- DOM の検査（component test）: text と全要素の全属性（`data-*`、`aria-*`、`title` などを含む）に、未発見の recipe の nameJa、description、id が出ない。
- E2E: 既存の `expectNoUndiscoveredIdentity` の sweep を 2 つの状態で実行した（全部 locked、DM-A だけ unlocked）。
- locked のカードは button ではない。Detail は unlocked のときだけ開ける。

## 15. Mobile measurements

Playwright Chromium で実測した。値は px。

| 画面 | 390×844 | 360×800 |
|---|---|---|
| HOME 縦 / 横 スクロール | 0 / 0 | 0 / 0 |
| HOME CTA top（作る / ランチ / フリー） | 307 / 307 / 369 | 307 / 307 / 369 |
| HOME Dinner カード | top 429、h 48、w 358 | top 429、h 48、w 328 |
| HOME `.home-menu` bottom / footer top | 661 / 801（before 605 / 801） | 661 / 757（before 605 / 757） |
| Detail START | top 784、h 48、w 358 | top 740、h 48、w 328 |
| Detail スクロール | 0 / 0 | 0 / 0 |
| Target Board の行 | h 56、w 358 | h 56、w 328 |
| Board スクロール | 0 / 0 | 0 / 0 |
| Dinner HUD | top 64、h 33 | top 64、h 33 |
| 調理中スクロール | 0 / 0 | 0 / 0 |
| Abandon 続ける / やめる | h 48 / h 44 | h 48 / h 44 |

- Dinner カードの分だけ `.home-menu` が 56px（48px + gap 8px）伸びた。footer との間はまだ 140px（390）/ 96px（360）空いている。
- Layout Contract（`layout-chromium`、safe-area の profile P390i / E390i / E360i を含む 7 profile）は全部通った。

## 16. E2E

`e2e/dinner-mission.spec.ts` には 11 test がある。`iphone-390x844` と `iphone-360x800` の両方で実行する。WebKit は CI の WebKit Gate で実行する。

| # | 内容 | 確認している場所 |
|---|---|---|
| 1 | HOME → Dinner | spec「1/2/32」 |
| 2 | locked mission の privacy | spec「1/2/32」 |
| 3 | unlocked mission の target 名 | spec「3/32」 |
| 4 | 不足で START disabled | spec「4」 |
| 5 | 足りていれば START | spec「5-11…」 |
| 6–9 | target を選ぶ → 作る → board に戻る → 順番は自由 | spec「5-11…」（breakfast → margherita → funghi → bismarck） |
| 10 | 完成した target は disabled | spec「5-11…」 |
| 11 | 全 target → CLEAR | spec「5-11…」 |
| 12 | TIME_UP | spec「12」（`page.clock`） |
| 13 | over-placement で INFEASIBLE | spec「13/18/21/23」 |
| 14 | 品質 FAILED で在庫が足りる → target が残る | spec「14」 |
| 15 | 品質 FAILED で在庫が足りない → FAILED | spec「15」 |
| 16 / 17 | HOME の abandon で続ける / やめる | spec「16/17/18/22」 |
| 18 | 消費した材料は戻らない | spec「13…」「16…」 |
| 19 | reload で run がなくなる | spec「19」 |
| 20 | 在庫が足りる retry | spec「5-11…」 |
| 21 | 在庫が足りない retry は disabled | spec「13…」 |
| 22 | run 中は Shop に入れない | spec「16…」 |
| 23 | FAILED のあとは Shop に入れる | spec「13…」 |
| 24 | Lunch Rush に影響しない | `lunch-rush-material-shortage`、`lunch-rush-result-ranking-phase4`、LC-3（full Chromium run） |
| 25 | Free Cooking に影響しない | `free-cooking-phase3-2`、`making-ui-1screen`、`dynamic-cooking-steps`（full run） |
| 26 | Discovery に影響しない | `discovery-*`、`progression2-discovery-ladder`（full run） |
| 27 | Dinner で Dex が変わらない | spec「5-11…」（save の dex が一致） |
| 28 | Dinner で Pitz が払われない | spec「5-11…」（pitzBalance が一致） |
| 29 | CUT のある target | 全 target を実際の gesture の `cutThreeLines` で切っている |
| 30 | New Haven（CUT なし）の target | DM-A / DM-B に New Haven は入っていない。UI からは到達できないので、DM-2 の reducer test 41/42 と「no-CUT path」の test で確認している |
| 31 | 古い CTA / 二度押し | spec「5-11…」（「ターゲット一覧へ」を dblclick） |
| 32 | locked の DOM privacy | spec「1/2/32」「3/32」（`expectNoUndiscoveredIdentity`） |
| 33 / 34 | 390×844 / 360×800 | 両方の project で実行している |
| 35 | WebKit | CI の WebKit Gate（§19） |

ローカルの結果:
- Dinner spec: 390×844 で 11 / 11 passed（`a739532`）。
- Chromium E2E 全体（iphone-390x844、iphone-360x800、layout-chromium）: **183 passed / 19 skipped / 0 failed**（6.4 分）。

## 17. Human Verification

- Policy: `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`。
- 動画は repo に commit していない。チャットでユーザーに直接渡した。
- 録画環境: local の DEV server（`?dinnerDuration=` は OD-DM3-1 のとおり DEV でだけ効く）と Playwright Chromium。操作はすべて実際の gesture。
- 変換: `ffmpeg libx264 yuv420p` → `ffprobe` で検証 → frame を抜き出して内容を目視で確認した。

| 動画 | 渡し方 | viewport | 長さ | サイズ | codec | 内容 |
|---|---|---|---|---|---|---|
| `TETO_DINNER-MISSION_DM3_HV-A_clear_390x844.mp4` | チャットで直接 | 390×844 | 56.8s | 1.00 MB | H.264 | HOME → Dinner → Detail（READY）→ START → フンギ → ブレックファストピザ → マルゲリータ → ビスマルク（好きな順番、全部 CUT まで）→ 🎉 DINNER CLEAR! 4 / 4、クリアタイム 00:40 |
| `TETO_DINNER-MISSION_DM3_HV-B_infeasible_390x844.mp4` | チャットで直接 | 390×844 | 22.9s | 0.35 MB | H.264 | たまご 2 個で START → ビスマルクにたまごを 1 個多く置く → 焼く → 材料が足りなくなりました 1 / 4、たまご 必要 1 / 所持 0 → もう一度は disabled → ショップへ → HOME の Shop |
| `TETO_DINNER-MISSION_DM3_HV-C_abandon-timeup_390x844.mp4` | チャットで直接 | 390×844 | 33.0s | 0.31 MB | H.264 | 20 秒の run → 🏠 ホーム → アプリ内 dialog → 続ける → マルゲリータを始める → 00:00 → ⏰ 時間切れ！ 0 / 4 |

- 最初に録った HV-C は、Playwright が context を閉じるときに最後の数秒を落としていて、overlay が映っていなかった。最後に待ち時間を足して録り直し、最後の frame に overlay が映っていることを確認した。
- Screenshot（`docs/reports/screenshots/dinner-mission-dm3/`）:
  - 390×844: `after-home-dmA`、`after-mission-select`、`after-mission-detail-ready`、`after-target-board`、`after-target-board-progress`、`after-cooking-hud-{dough,toppings}`、`after-target-result`、`after-abandon-dialog`、`after-clear`、`after-failed-timeup`、`after-failed-infeasible`
  - 360×800: `after-home-dmA`、`after-mission-select-locked`、`after-mission-detail-shortage`、`after-target-board`、`after-cooking-hud`、`after-clear`
  - before: `before-home-{dex1,dmA}-{390x844,360x800}`
- Human Feel（録画を見た実装者の所見。Owner による実機での確認は §22 に残す）:
  - timer が焦らせすぎない: 残り時間は HUD の右上に 1 か所だけ出る。色での警告はまだない。秒数はまだ仮（DM-5）なので、最終的な判断は保留する。
  - target 切替がテンポを壊さない: 完成 → 「ターゲット一覧へ」→ 次を選ぶ、の 2 tap で切り替わる。
  - 何枚中何枚か一目で分かる: HUD（`1 / 4`）、board（残り 3 / 4）、完成パネル（完成 1 / 4）のどれにも出る。
  - cooking area が狭くない: HUD は 33px だけ。stage と chip の配置は Free Cooking と同じ。
  - CLEAR に達成感がある: 🎉 と大きい見出し、4 / 4、クリアタイム。報酬の演出は DM-4 で足す余地がある。

## 18. Regression

- full Vitest: §19 に記録する。Lunch Rush、Free Cooking、Discovery、Hint Economy、Shop、Inventory の各 suite を含む。
- full Chromium E2E（§16）: 既存の Lunch Rush、Free Cooking、Discovery、Hint、Shop、Inventory、Layout Contract LC-1〜LC-5 の spec は全部通った。
- Lunch Rush: Lunch の runtime、Lunch HUD、`isMissionRound` は変えていない。HOME の確認は、Dinner の run 中だけアプリ内 dialog になる。それ以外の調理中は、今までどおり `window.confirm(GO_HOME_CONFIRM_MESSAGE)` を使う。
- Free Cooking の結果画面: `isFreeResultScreen` は `state.dinner !== null` のときだけ除外する。Dinner がないときの挙動は同じ。
- save: schema、key、persistence は変えていない。

## 19. CI

**`0b65500`（PR を作ったときの head）: 9 / 9 success**

| check | 結果 |
|---|---|
| build | success |
| classify | success |
| layout-chromium | success |
| Layout Contract Gate | success |
| webkit webkit-390x844 shard 1/2・2/2 | success |
| webkit webkit-360x800 shard 1/2・2/2 | success |
| WebKit Gate | success |

**Codex review（`0b65500` に対する P2 × 3）: 3 件とも確認して修正した**

1. **retry したときに、調理中の一時的な UI 状態が残る**
   - 原因: Dinner の target は recipe ごとに固定の order を使う。そのため、1 つ目の target の途中で TIME_UP になってから retry すると、order id も `makingStep` も同じままになり、App の round reset が発火しなかった（見本の popover が開いたまま戻ってくる）。
   - 修正: reset の key を `order.id` から `order.id | run.clock.startedAt | activeRecipeId` に変えた（Dinner のときだけ。それ以外の round の key は今までどおり `order.id`）。
   - test: App test を追加した。修正前に失敗することを確認してから修正した。
2. **`missions` prop で渡した mission の Detail を、global の一覧から引いていた**
   - 修正: Detail もカードと同じ `missions` から引くようにした。
   - test: component test を追加した。
3. **秒を ms に変換したあとの値を検証していなかった**
   - 問題: `?dinnerDuration=0.0001` は 0ms に、`1e306` は Infinity になり、START が押せてしまっていた。
   - 修正: 変換後の値が有限で 0 より大きいときだけ duration として返す。あわせて `handleStartDinner` も、`startDinnerRun` と同じ条件（mission、`dinnerStartBlock`、duration）を満たすときだけ GAME に移るようにした。
   - test: unit test に 2 つの値を追加した。

修正後の head の CI: 下に追記する。

## 20. Changed files

16 files、+2032 / −63（screenshot を除く）。

| 種類 | ファイル |
|---|---|
| 新規 UI | `src/screens/DinnerMissionScreen.tsx`、`src/components/DinnerGameUi.tsx` |
| 新規 view model | `src/state/dinnerView.ts` |
| 変更 | `src/App.tsx`、`src/screens/GameScreen.tsx`、`src/screens/HomeScreen.tsx`、`src/state/useDinnerRuntime.ts`、`src/App.css`（Dinner 用の section を追加しただけ） |
| unit / component test | `src/state/dinnerView.test.ts`、`src/components/DinnerGameUi.test.tsx`、`src/screens/DinnerMissionScreen.test.tsx`、`src/App.dinner.test.tsx`、`src/state/useDinnerRuntime.test.tsx` |
| E2E | `e2e/dinner-mission.spec.ts`、`e2e/support/dinner.ts` |
| docs | この report と screenshot 22 枚 |

## 21. Scope verification

| DM-3 でやらないこと | 状態 |
|---|---|
| Pitz の報酬の支払い、tier の閾値、報酬の balance | 触っていない。overlay に報酬の行はない |
| best time / clear 回数の保存、ranking | なし |
| save schema | 変更なし |
| inventory / Shop の pack、価格 | 変更なし |
| mission の `timeLimit.seconds` | `null` のまま（OD-DM3-1） |
| #234 | OPEN のまま、触っていない |
| Hint 3.0 / recipe の追加 / Cooking Steps / Cutting | 触っていない |
| DM-1 / DM-2 の core と reducer | 変更なし。UI は既存の action だけを dispatch する |

## 22. Residual risks

1. **production では START を押せない**（OD-DM3-1）。DM-5 で `timeLimit.seconds` が決まるまで、production のユーザーは Dinner を遊べない。これは意図したとおりの状態。
2. **実機と Preview deployment での HV は未実施**。今回の HV は local の DEV server と Chromium で行った。Owner による iPhone 実機（Preview build の `?dinnerDuration=`）での確認と、Human Feel の最終判断が残る。
3. **New Haven（CUT なし）の target** は今の mission set に入っていないので、UI の E2E では通っていない（reducer test で確認済み）。将来 mission に入れたときは E2E を足す。
4. **背景に回ったとき**: 時計は壁時計なので、背景でも時間は進む（Lunch Rush と同じ）。復帰したときに、すでに TIME_UP になっていることがある。
5. **HOME の footer との余白**: 360×800 では 96px になった。HOME にもう 1 段足すなら、Layout Contract を見直す必要がある。

## 23. DM-4 plan（未着手）

- 報酬: OD-DM-9 の tier の形に沿って、CLEAR のときだけ Pitz を払う。tier の閾値は DM-5 の時間と合わせて決める。
- CLEAR overlay に報酬の行を足す。二重に払わないように、run ごとに 1 回だけにする。
- best time と clear 回数を保存するかどうか。save schema を変えるなら migration の Owner Decision が必要になる。
- DM-5: `timeLimit.seconds` を決めて production の START を有効にする。OD-DM3-1 の Preview 注入はそのあと外すか残すか決める。
- DM-3 では何も着手していない。
