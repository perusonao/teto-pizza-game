# Progression 2.0 W1 Integration I4b: Discovery Ladder の配線 Result

- branch: `claude/teto-pizza-w1-i4a-j46ph0`（PR 未作成、main へは merge していない）
- base: main `82fe7885c51cb7496ffa114f31be414abcf3d695`（I1 #222。I4a は merge commit `6816d17` で統合済み）
- authority: REC-04 = RESOLVED（OD-REC04-1〜3、Owner Decision commit `6fe02e2d23610e926bab2367405fe9f717d25421`）。新しい Owner Decision は作っていない。
- 計画: `docs/reports/TETO_PROGRESS2_W1_I4B_Fresh-Audit.md`
- implementation default（Owner 承認済み。Owner Decision ではない）:
  - A2: 発見済みの recipe は常に unlocked。未発見の recipe にだけ既存の EP1 chain を適用する
  - Shop は LOCKED の材料を一覧に出さない
- scope 外（追加していない）: W1 の7材料 / W1 の10 recipe、RT-01c、W1 scoring fixtures、CUT、個数 / 回数の単位移行、在庫を考慮した Lunch Rush、25 recipe での tier 再設計、ham の k=3。#205 は merge していない

## 1. Slice と commit

| slice | commit | 内容 |
|---|---|---|
| I4b-1 | `07270ec` | 純関数 `src/logic/materialShop.ts`（k、10×k、tier の価格、NEW / OWNED / LOCKED、初回パック / 補充） |
| I4b-2 | `c2b131c` | save に `unlockedForShopIngredientIds` を追加（schema bump なし、I0 の forward-compat を維持、ledger は減らない） |
| I4b-3 | `9321b07` | reducer と load の配線、EP4 の停止、A2、既存 save の移行 |
| I4b-4 | `3ad1791` | UI: Shop の NEW / OWNED、進捗の1行、NEW MATERIAL 通知と Shop への CTA、EP4 のプレゼント文言を削除 |
| I4b-5 | `332d200` | E2E（新規 save の一連の流れほか）。NEW MATERIAL 通知を1行化（RESULT 1-Screen の高さ予算を守るため） |
| I4b-4 fix | `0500bc8` | 通知の中で材料名が途中改行しないようにした（Human Verification で発見） |
| docs | `7eaa57e` | Result Report と Human Verification の screenshots |
| WebKit fix | `8184298` | 通知が WebKit 360×800 でも RESULT 1-Screen の高さ予算内に収まるように修正（§4 を参照） |
| delta fix | `fc1b885` | 材料が複数のとき、NEW MATERIAL 通知の名前が 1 つの塊になり CTA の下に潜る不具合を修正（§3 の「差分 その 2」） |
| review fix | `ed7bc26` | PR #227 の review（Codex P2）: Shop の進捗表示（「あとN つ発見で…」）が、解放済みの材料だけの step を飛ばすように修正（下記参照） |

## 2. UI の変更一覧

- **Shop**（`ShopOverlay.tsx`）
  - 行は **NEW**（解放済み・未購入・在庫 0・初回パック）と **OWNED**（在庫・補充）の2種類だけ。LOCKED の材料と starter の3材料は一覧に出さない。
  - 各行に表示するもの: 材料名、`在庫 N`、`🍕10ピザ分（N個）`（sauce は `10ピザ分`）、`初回 / 補充 🪙 N Pitz`。Pitz が足りないときはボタンを disabled にし、`あと N Pitz たりません` を出す。
  - 数値はすべて `materialOffer` から読む。reducer が課金に使う純関数と同じなので、UI 側に数値のハードコードはない。
  - 進捗の1行: `🔜 あとN つ発見で新しい材料が入荷`。材料名は出さない。最後の step まで到達したら消える。
  - 空の Shop の文言は「新しいピザを発見すると、材料が入荷します」。
  - 削除したもの: 「あと★N」、「ピザの腕前が上がると入荷します」、「レシピを解放すると…」、`EARLY_GAME_HINT_THRESHOLD`。
- **RESULT**（`ResultPanel.tsx`）
  - NEW MATERIAL 通知 `🆕 新しい材料「たまご」が入荷！` と `🛒 ショップへ` の CTA。CTA は App 既存の Shop overlay を RESULT の上に開き、閉じると RESULT に戻る。
  - EP4 の「🎁…プレゼントしました！」通知と、その生成コード（`buildStarterGrantNotice`）を削除した。
- **Pizza Select**: A2 により、Free Cooking で発見した recipe は LOCKED にならない。recipe EP1 の ⭐ の説明（「あと★Nで解禁」）は残している。

## 3. Human Verification

**Human Verification status: PASS（repo owner の Human PASS、2026-09-25）**

owner が次の3本の動画（UI は `0500bc8` 時点。`7eaa57e` で提出）を確認し、Human Verification PASS とした。

- `I4b_HV_390x844_new-save-full-loop.mp4`
- `I4b_HV_390x844_ep4-migration-refill-shortfall.mp4`
- `I4b_HV_360x800_layout-smoke.mp4`

owner が確認した内容:

- マルゲリータの発見 → NEW MATERIAL → Shop
- たまごが NEW / 在庫 0
- 60 Pitz での初回パック購入。表示価格と実際の Pitz の減り方が一致
- たまごの在庫への反映
- ビスマルクの発見と、次の材料の解放
- 既存 EP4 save の移行
- 補充の表示
- Pizza Select
- 390×844 / 360×800 の layout
- CTA が見えていること
- 材料名の改行の修正

致命的な overflow、CTA の見切れ、価格表示と runtime の減算の不一致は見つからなかった。

**PASS 後の差分（owner が post-fix Human delta として PASS。下記参照）**

- 状況: PASS の対象 HEAD `7eaa57e` の Full WebKit（run 36125278188）が失敗した。webkit-360x800 で result-1screen-2.0 Scenario E が 4px 超過した。
- 原因: `0500bc8` の `word-break: keep-all` によって、Scenario E（マリナーラの発見）の通知が WebKit では Chromium より 1 行多く描画されていた。
  - 訂正: このケースで入荷する材料は **マッシュルーム 1 つ** だった（fixture がにんにく / オレガノをすでに所持しているため）。`8184298` の commit message にある「3 materials」は誤り。
- 修正（`8184298`）:
  - 通知の文言を `🆕 新しい材料「たまご」が入荷！` から `🆕 新しい材料が入荷：たまご` に変更した。
  - 材料名ごとに `white-space: nowrap` をかけた（名前は分割されない）。
  - 材料 1 つの通知は 2 行、Chromium で 52px。Full WebKit を通過した `332d200` のレイアウトより 14px 低い。
- 影響の範囲: 通知の文言と折り返しだけ。CTA「🛒 ショップへ」、Shop、価格、runtime の挙動は変わっていない。
- 差分の証拠:
  - `after/*/05`・`after/*/10` の screenshots を撮り直した。
  - 動画 `v2/I4b_HV_390x844_new-save-full-loop_v2.mp4`（45.00s、796,623 B）と `v2/I4b_HV_360x800_layout-smoke_v2.mp4`（35.28s、699,433 B）。どちらも H.264 で、最後まで decode できることを確認した。
  - Full WebKit run 36126133936 = success。

**PASS 後の差分 その 2（`8184298` の不具合を delta 検証で発見し、修正した）**

- 発見: 実際のアプリで材料が複数入荷する通知を確認したところ、3 つの名前が 1 行につながり、CTA の下に潜り込んでいた（「フォンティーナ・ゴルゴンゾーラ・パ…」）。ladder の step 14 = フォンティーナ・ゴルゴンゾーラ・パルミジャーノ。
- 原因: 区切りの「・」を次の名前の run の先頭に置いていた。「・」の前では改行できない（UAX #14）ため、3 つの名前が 1 つの改行できない塊になっていた。
- 修正: 「・」を前の名前の run の末尾に移した（「・」の後では改行できる）。材料 3 つの通知は 3 行（66.4px）になり、RESULT の overflow は 0。
- 回帰テスト: `e2e/progression2-discovery-ladder.spec.ts` に step 14 のケースを追加した（名前ごとに 1 行、文字が CTA の下に潜らない、RESULT の予算内、CTA が完全に見える、横 overflow なし）。WebKit の CI でも走る。修正前の描画に戻すと失敗することを確認した。
- screenshots（実際のアプリ、`post-fix-delta/`）:
  - `390x844-three-materials-step14.png` / `360x800-three-materials-step14.png`
  - `390x844-single-marinara-mushroom.png` / `360x800-single-marinara-mushroom.png`

**post-fix Human delta: PASS（repo owner が 2026-09-25 に承認）**

owner が承認した対象（実際のアプリの `post-fix-delta/` screenshots と、agent による下表の測定結果に基づく）:

- NEW MATERIAL 通知「🆕 新しい材料が入荷：…」
- 材料 1 つの表示 / 材料 3 つの表示、390×844 / 360×800
- 材料名を途中で分割しない、複数の材料の折り返し、文字が Shop CTA の下に潜り込まない
- 「🛒 ショップへ」が完全に見える、RESULT 1-Screen の予算内、無料プレゼントと誤解する表現がない
- Codex P2 への対応（`ed7bc26`、§5b）: すでに解放済みの step を Shop の進捗表示で飛ばす修正も、owner が承認した

Shop / economy / gameplay の一連の流れは、この文言・レイアウトの修正では挙動が変わらないため、既存の Human PASS をそのまま有効とする（全面的な再検証はしていない）。

agent による測定（Chromium 実機。WebKit は PR CI の e2e で同じ条件を検証）:

| 確認項目 | 390×844 | 360×800 |
|---|---|---|
| 材料名が途中で分割されない（1 つ / 3 つ） | PASS | PASS |
| 通知の文字が box や CTA からはみ出さない | PASS | PASS |
| Shop CTA が完全に見える | PASS | PASS |
| RESULT 1-Screen の予算内（overflow ≤ 0） | PASS | PASS |
| 無料プレゼントと誤解する表現がない | PASS | PASS |

### Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `I4b_HV_390x844_new-save-full-loop.mp4` | 390×844 | 44.96s | 778,388 B | PASS |
| `I4b_HV_390x844_ep4-migration-refill-shortfall.mp4` | 390×844 | 10.48s | 173,963 B | PASS |
| `I4b_HV_360x800_layout-smoke.mp4` | 360×800 | 35.36s | 680,139 B | PASS |

- codec はすべて H.264（High）/ yuv420p / 25fps / MP4。
- 検証: ffmpeg で最後まで decode できることを確認。解像度は viewport と一致。frame の contact sheet で操作が映っていることを確認した。
- Download: セッション内で直接提出した。動画は repository に commit していない（`artifacts/review/` は gitignore 済み）。

Video Verification: PASS

確認できること:

- 新規 save（`new-save-full-loop`）
  - HOME → Shop（空。進捗の1行だけ）→ Free Cooking（starter 3材料だけ）→ マルゲリータを発見 → NEW MATERIAL「たまご」→ `ショップへ`
  - → たまご NEW / 在庫 0 / 10ピザ分（10個）/ 初回 60 → 仕入れる → 133 → **73 Pitz**、在庫 10、補充 30 Pitz
  - → 閉じると RESULT に戻る → Free Cooking（TOPPING にたまご ×10）→ ビスマルクを発見 → NEW MATERIAL「ベーコン」→ Shop（ベーコン NEW、たまご OWNED 在庫 9）
  - → Pizza Select でビスマルクが BEST 63（EP1 の前提であるマリナーラは未発見のまま LOCKED）→ ビスマルクを作り直す
- 既存 EP4 save（`ep4-migration-refill-shortfall`）
  - 旧 save（発見 3、マッシュルーム / にんにく / オレガノを所持）の Shop: OWNED は在庫がそのまま、たまご / ベーコンは NEW で在庫 0
  - 45 Pitz ではたまごが「あと 15 Pitz たりません」
  - マッシュルームを補充（−30 Pitz、+30 個）
- 360×800: 同じ流れ。行は2段に折り返すが、overflow はなく CTA も見切れない。

### Screenshots（`docs/reports/screenshots/progression2-w1-i4b/`）

- `before/390x844/`（main `82fe788`）
  - `01` 空の Shop（「ピザの腕前が上がると入荷します」）
  - `02` RESULT の「🎁「フンギ」の材料を最初の10回分プレゼントしました！」
  - `03` EP4 で付与された後の Shop（補充だけ、150 Pitz / +9、「レシピを解放すると…」）
- `after/390x844/` と `after/360x800/`: `01`〜`16`（HOME、空の Shop、トレイ、RESULT と NEW MATERIAL、Shop の NEW → OWNED、RESULT に戻る、ビスマルク、ベーコン NEW、Pizza Select、作り直し、旧 save の Shop、補充）

Human Verification で見つけて直したもの:

- 通知の中で材料名が途中で改行されていた（「ベーコ/ン」）→ `0500bc8`
- 2段構成の通知が RESULT 1-Screen の高さ予算を 5px 超えていた → `332d200`

## 4. 自動テスト

| gate | 結果 |
|---|---|
| full Vitest | **2827 / 2827**（140 files、`8184298`） |
| typecheck（`tsc -b`） | PASS |
| lint（oxlint） | PASS |
| build | PASS |
| Chromium 390×844 + 360×800 | **140 / 140**（新規 `e2e/progression2-discovery-ladder.spec.ts` を含む、`8184298`） |
| Full WebKit（CI、workflow_dispatch） | `332d200`: run 36123838674 = success / `7eaa57e`: run 36125278188 = **failure**（上記の 4px。修正済み）/ **`8184298`: run 36126133936 = success** |

## 5. save 移行の結果

- 読み込み時に、Shop で買える材料を「保存済み ledger ∪ 所持している有限材料 ∪ ladder（発見数）」として求める。
- 所持している材料と在庫は変えない。starter の付与台帳 `starterGrantClaimedRecipeIds` もそのまま残す（旧 build に rollback しても二重に付与しない）。
- 未所持の ladder 材料は NEW、在庫 0 になる。
- schemaVersion は 2 のまま。未知の id は I0 の仕組みで保持する（unit test と e2e で確認）。
- Full Game Reset は save を丸ごと削除する（e2e で確認）。

## 5b. PR #227 review の対応（`ed7bc26`）

- 指摘: 移行した EP4 save では、ladder の後ろの step の材料をすでに所持していることがある。たとえばマルゲリータとフンギを発見済みで、step 3 のマッシュルームを所持しているケース。このとき「あと1つ発見で新しい材料が入荷」と表示されるが、次の発見では何も入荷しない。
- 修正: `nextMaterialHint` に解放済みの材料の一覧を渡すようにした。発見数より先の step のうち、まだ解放されていない材料を含む最初の step を返す。該当する step がなければ表示しない。
- 検証:
  - unit / component / App test を追加した。指摘されたケースは「あと2つ」（step 4）と表示される。修正前は失敗し、修正後は通ることを確認した。
  - Vitest 2834 / 2834、Chromium 140 / 140。
- UI への影響: 移行 save の Shop にある進捗の1行の数字だけ。新規 save の表示は変わらない（新規 save では、解放済みの材料が発見数と一致するため）。

## 6. 残っている課題

- Human Verification: owner の PASS（§3）。post-fix Human delta（通知の文言・折り返し、`8184298` と `fc1b885`）と Codex P2 への対応（`ed7bc26`）も owner が PASS / 承認した。
- W1 に持ち越すもの（今回の blocker ではない）:
  - 25 recipe で tier が変わる件
  - ham の k=3
  - 在庫を考慮した Lunch Rush
- `pricePitz` / `restockQuantity` / `starterGrantOnly` / `ingredientState` は runtime から読まれなくなった（データと関数は残している）。削除は別 slice で行う。
