# Progression 2.0 / Completion Gate — Human Verification Plan（Fresh Design）

- 作成: 2026-09-24
- 種別: **テスト計画のみ（docs/data）**。実装・E2E・Owner Decision の確定は含まない。
- 基準: `main` `dff233c042d2df6ee1c3a92f2d2419830aa05460`
- 準拠: `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`（本書は policy を複製しない。動画は repo に commit しない / screenshot は `docs/reports/screenshots/<task-name>/`）
- Machine-readable: `docs/reports/data/TETO_PROGRESS2_HUMAN-VERIFICATION_SCENARIO-MATRIX.json`（全 scenario、seed、enum、P0 smoke の ID 列）

---

## 0. 結論

- 将来の実装後に iPhone 実機（390×844）と 360×800 で行う Human Verification を **86 scenario** に設計した。
  - **P0 22 / P1 48 / P2 16**
  - 自動化区分: E2E_CANDIDATE 26 / HYBRID 33 / DEVICE_REQUIRED 27
- **P0 smoke flow は 14 step の 1 本道**（§7）。1 つの save で LOCKED → REFILL → 発見 → Completion Gate → Lunch Rush → 旧 save まで確認する。
- 未決の Owner Decision（#217 の OD216-1〜4、#218 の OD-1〜5）は**確定していない**。期待結果は分岐テストとして書いた（§5、§6）。
- 読み取り中に見つけた、計画に影響する事実:
  1. **PR #221 の W1 set は、PR #220 の最新 head の first-10 set と違う。** #221 は #220 の初版（`d3a2c8f`）の set（aussie ほか。新材料 6 種）を監査している。#220 は `4b777fe` 以降、sauceless の行を W4（`SAUCELESS_RECIPE_CONTRACT`）へ移し、set が変わった（新材料 7 種: capers, clam, corn, eggplant, fresh-tomato, pineapple, potato）。
     - 両方の set にある recipe は 5 件: parmigiana, pizza-portuguesa, puttanesca, pesto-tonno, melanzane。
     - #221 で READY の唯一の recipe（aussie）は sauceless。#220 の最新の分類では、今の runtime contract のままでは実装できない。
     - 本計画では、両方にある **eggplant / melanzane を標準の対象**にした。visual の確認（VIS）は両方の set を対象にした。
  2. **W1 候補 emoji の一部は、既存の材料と同じ glyph を使う。** salt-cod 🐟 = anchovy 🐟、green-onion 🌱 = rosemary 🌱。fresh-tomato は、既存の 🍅（cherry-tomato / tomato-sauce）と同じになりやすい。VIS-02 で、区別できるかを実機で判定する。
  3. 🫘（baked-beans）は Emoji 14.0。古い OS では tofu（☐）になり得る（VIS-01）。

## 1. 入力と最新状態（2026-09-24 に確認。どの PR も変更していない）

| 対象 | head | 状態 | 本計画で使う内容 |
|---|---|---|---|
| Issue #216 / PR #217 | `a39932d` | OPEN、Codex review で大きな指摘なし | 材料の 5 状態、永久の entitlement `unlockedForShopIngredientIds`、3 層の経済（fee / 初回 stock / 補充 = ceil(価格×0.5)）、capability A/B/C、OD216-1〜4 |
| Issue #215 / PR #218 | `5105771`（Rev.5） | OPEN | G0〜G4、Q（不足 0.5 / 過剰 0.15）、S4、LR-A/C/D/E、HR-1〜8、OD-1〜5。推奨は G1 + Q + LR-A + D-A（**確定していない**） |
| PR #220 | `e49dab9` | OPEN | Wave W0〜W5、first-10 set（新材料 7 種）。emoji + color で描くので、専用の bitmap は 0 |
| PR #221 | `279b6b1` | OPEN（最後の Codex re-review は usage limit で未実行） | READY 1 / REVIEW 9 / BLOCKED 0。新材料 6 種の emoji / color 候補と uncertainty |

production で確かめた前提（`main`）:

- save key: `teto-pizza-save-v1`（Preview では `teto-pizza-preview-save-v1`）、schemaVersion 2
- Lunch Rush: 180 秒。`now >= endsAt` の SERVE は拒否
- 点数: `Math.round(servedCount × 100 + totalQualityScore)`

## 2. スコープ

- 対象: 将来の実装 PR が「Progression 2.0 の材料解放・経済」「Completion Gate（部分量）」「W1 content」を production に入れた**後**の、実機での Human Verification。
- 対象外: 今回の実行、src/e2e の変更、Full Chromium/WebKit の実行、Owner Decision、価格・条件値の決定。

## 3. 共通の約束

### 3.1 Viewport と端末

| viewport | 端末 | 役割 |
|---|---|---|
| **390×844**（authority） | iPhone 実機（iPhone 12〜16 の標準サイズ、Safari とホーム画面に追加した PWA） | 全 P0 を撮る。policy §3 の authority |
| **360×800**（secondary） | iPhone に該当する画面サイズがないため、**Android 実機**（Chrome）。なければ Playwright Chromium emulation | layout・tap target・OS emoji の差。scenario に 360×800 があるものだけ |

- 表の viewport 列に 360×800 がない scenario は、390×844 だけで撮る。

### 3.2 自動化の区分

- `E2E_CANDIDATE`: 状態を決定的に assert できる。将来 e2e 化する候補（今回は e2e を書かない）。
- `HYBRID`: 状態は E2E で assert し、見え方と操作感は実機で確認する。
- `DEVICE_REQUIRED`: 実機でしか判定できない（連打、実際の touch、OS の emoji、background / 強制終了、Human Feel）。

### 3.3 Evidence

- `VIDEO`: MP4 / H.264、各状態を 1〜3 秒保持する。repo に commit しない（policy §5〜§8）。
- `SCREENSHOT`: `docs/reports/screenshots/<task-name>/` に commit する。
- `SAVE_DUMP`: save の JSON。
  - iPhone では Mac Safari の Web Inspector で `localStorage` を読む。
  - 使えない場合は、同じ手順を E2E で再現して取る（HYBRID）。
  - 確認する field: `pitz`、`unlockedForShopIngredientIds`、inventory の数量、discovered / BEST。
- `PITZ_LEDGER`: 取引ごとの「前の残高 / 表示価格 / 後の残高」の手書きの表。
- `NETWORK`: ranking submit の payload（ruleset version と score）。

### 3.4 Seed state

実機で同じ状態を作るには、seed が要る。Preview 用の save の import や、Web Inspector で `localStorage` に入れる方法が考えられる。この方法は実装側で決める（本計画では決めない）。

| Seed | 状態 |
|---|---|
| S0 | 新しい save |
| S1 | X（標準は eggplant）が LOCKED。解放条件まであと 1 |
| S2 | X が AVAILABLE_TO_UNLOCK。残高 ≥ fee + 初回価格×2 |
| S3 | X が AVAILABLE_TO_UNLOCK。残高 < fee |
| S4 | X が OWNED、stock 0 |
| S5 | 今の production の schemaVersion 2 の save（set なし、既存の購入あり） |
| S6 | funghi を選べる。mushroom stock ≥ 5 |
| S7 | Lunch Rush を開始できる。注文の recipe の在庫は十分 |

### 3.5 材料のライフサイクルの各段階（#217 の設計）

| 段階 | プレイヤーに見えるもの | タップ | 保存されるべきもの |
|---|---|---|---|
| LOCKED | 材料名、鍵、解放条件と進捗 | 行（詳細の表示だけ） | set に X がない |
| AVAILABLE_TO_UNLOCK | 「解放できる」通知、unlock fee、解放 CTA | 解放（→ 確認） | 条件の判定は derived。set にはまだ X がない |
| AVAILABLE_TO_BUY | 初回 stock の価格、数量 10×k、購入 CTA | 購入 | set に X がある。Pitz −fee（set と同時に書く） |
| OWNED | Inventory に X と在庫数。tray に X がある | 調理で置く | inventory の X = 10×k − 使った個数 |
| REFILL（OWNED・stock 0） | 補充の行、補充価格 | 補充 | OWNED のまま。Pitz −補充価格、在庫 +10×k |

---

## 4. Scenario（全 86）

### 4.1 新材料のアンロック（UNL）

| ID | Pri | 名前 | 前提状態 | 操作 | 期待結果 | viewport | evidence | 自動化 | 関連 | OD 分岐 |
|---|---|---|---|---|---|---|---|---|---|---|
| `UNL-01` | P0 | LOCKED 表示 | Seed S1（条件未達。X=eggplant が LOCKED） | HOME → Shop を開く → X の行をタップ | X は LOCKED 表示。購入/解放 CTA は無い（または disabled）。解放条件の文言と進捗（例: ⭐/発見数/完成数/獲得Pitz のうち採用された条件）が読める。タップしても Pitz・state は変わらない。save: unlockedForShopIngredientIds に X が無い | 390×844 / 360×800 | VIDEO, SCREENSHOT, SAVE_DUMP | HYBRID | Issue #216, PR #217 | OD216-2 |
| `UNL-02` | P0 | 条件達成 → AVAILABLE_TO_UNLOCK | Seed S1（条件まであと 1 回の bake/発見） | 条件を満たす 1 枚を焼く → RESULT → HOME → Shop | RESULT または HOME/Shop に『解放できる』通知が 1 回出る。Shop の X は AVAILABLE_TO_UNLOCK で、unlock fee と『解放』CTA が見える。save: Pitz 変化は報酬分だけ、set にはまだ X が無い（fee 未払い） | 390×844 / 360×800 | VIDEO, SCREENSHOT, SAVE_DUMP, PITZ_LEDGER | HYBRID | Issue #216, PR #217 | OD216-2, OD216-1 |
| `UNL-03` | P0 | unlock fee 支払い → AVAILABLE_TO_BUY | Seed S2（AVAILABLE_TO_UNLOCK、残高 ≥ fee + 初回価格） | Shop → X の『解放』→ 確認 UI があれば確定 | Pitz が fee ちょうど 1 回分減る。X は AVAILABLE_TO_BUY になり、初回 stock 価格と数量（10×k 個）が表示される。stock はまだ 0 / Inventory に X は無い。save: set に X が追加、Pitz と set が同時に書かれている。F0 の場合は fee 0 の扱い（自動遷移 or 0 Pitz 確認）が仕様どおり | 390×844 / 360×800 | VIDEO, SCREENSHOT, SAVE_DUMP, PITZ_LEDGER | HYBRID | Issue #216, PR #217 | OD216-1 |
| `UNL-04` | P0 | 初回 stock 購入 → OWNED | UNL-03 の直後（AVAILABLE_TO_BUY、残高 ≥ 初回価格） | Shop → X の『購入』 | Pitz が初回価格だけ減る（fee は再請求されない）。X は OWNED、stock = 10×k 個。Inventory に X が出る。save: inventory の X 数量 = 10×k、set に X が残る | 390×844 / 360×800 | VIDEO, SCREENSHOT, SAVE_DUMP, PITZ_LEDGER | HYBRID | Issue #216, PR #217 | OD216-4 |
| `UNL-05` | P0 | OWNED 材料を調理で使う（M4 消費） | UNL-04 の直後 | HOME → Free Cooking → tray で X を探して 2 個置く → 焼く → RESULT | tray に X が出る（360×800 では paging 後も到達可能）。stock が置いた個数（2）だけ減る。LOCKED 材料は tray に出ない | 390×844 / 360×800 | VIDEO, SCREENSHOT, SAVE_DUMP | HYBRID | Issue #216, PR #217 | — |
| `UNL-06` | P0 | stock 0 でも OWNED のまま → REFILL | Seed S4（X OWNED、stock 0） | Shop と Inventory を開く | X は OWNED のまま『補充』行になり、補充価格 = ceil(初回価格×0.5)。unlock fee や LOCKED 表示に戻らない。Free Cooking の tray で X は在庫 0 表示（置けない） | 390×844 / 360×800 | VIDEO, SCREENSHOT, SAVE_DUMP | HYBRID | Issue #216, PR #217 | — |
| `UNL-07` | P0 | REFILL 購入 | UNL-06 の状態、残高 ≥ 補充価格 | Shop → X の『補充』 | Pitz が補充価格だけ減り、stock が 10×k 個増える。『補充しました』系の feedback。state は OWNED のまま | 390×844 / 360×800 | VIDEO, SAVE_DUMP, PITZ_LEDGER | HYBRID | Issue #216, PR #217 | OD216-4 |
| `UNL-08` | P1 | 複数の材料が同時に AVAILABLE_TO_UNLOCK | Seed S2+（X と Y が AVAILABLE_TO_UNLOCK、Z が LOCKED） | Shop をスクロールして 3 行を確認 | 5 状態の行が見た目で区別できる。並び順が仕様どおり。360×800 で CTA が切れない・誤タップしない | 390×844 / 360×800 | VIDEO, SCREENSHOT | DEVICE_REQUIRED | Issue #216, PR #217 | — |
| `UNL-09` | P1 | 非⭐条件の文言と進捗 | OD216-2 で採用された条件種別ごとに 1 材料ずつ LOCKED | Shop で各 LOCKED 行を読む | 条件（発見数 / 特定 recipe の発見 / 累計完成数 / 累計獲得 Pitz / ⭐）がプレイヤーに分かる言葉で出て、進捗 N/M が正しい。残高や消費額を条件にしていない | 390×844 / 360×800 | SCREENSHOT | HYBRID | Issue #216, PR #217 | OD216-2 |
| `UNL-10` | P2 | PREREQUISITE_OWNED 付き材料 | 前提材料 P が未所有、X の他条件は達成 | Shop で X を確認 → P を所有 → 再確認 | P 未所有の間 X は LOCKED で、前提 P が表示される。P 所有後に AVAILABLE_TO_UNLOCK | 390×844 | SCREENSHOT, SAVE_DUMP | E2E_CANDIDATE | Issue #216, PR #217 | OD216-2 |
| `UNL-11` | P2 | NOT_FOR_SALE（k 未 authoring）材料 | k 未 authoring の材料が catalog に存在 | Shop / Inventory / tray を確認 | 購入 CTA が出ない（非表示 or 準備中）。fail-closed で Pitz を受け取らない | 390×844 | SCREENSHOT | E2E_CANDIDATE | Issue #216, PR #217 | OD216-4 |
| `UNL-12` | P1 | fee 確認 UI のキャンセル | Seed S2 | 『解放』→ 確認 UI で『やめる』/ 外側タップ | Pitz・state・save が変わらない。もう一度開くと同じ AVAILABLE_TO_UNLOCK | 390×844 / 360×800 | VIDEO, SAVE_DUMP | HYBRID | Issue #216, PR #217 | — |
| `UNL-13` | P2 | 解放通知は 1 回だけ | UNL-02 の後 | HOME ↔ Shop を 3 往復、アプリ再起動 | 『解放できる』通知/バッジが毎回出ない（仕様で既読管理する場合）。バッジは fee 支払い後に消える | 390×844 | VIDEO | HYBRID | Issue #216, PR #217 | — |

### 4.2 永久アンロック（PERM）

| ID | Pri | 名前 | 前提状態 | 操作 | 期待結果 | viewport | evidence | 自動化 | 関連 | OD 分岐 |
|---|---|---|---|---|---|---|---|---|---|---|
| `PERM-01` | P0 | fee 支払い後に再起動 | UNL-03 直後（AVAILABLE_TO_BUY、未購入） | アプリを完全終了（Safari タブを閉じる / ホーム画面アプリを swipe で終了）→ 再度開く → Shop | X は AVAILABLE_TO_BUY のまま。fee の再請求なし。Pitz も同じ | 390×844 | VIDEO, SAVE_DUMP | DEVICE_REQUIRED | Issue #216, PR #217 | — |
| `PERM-02` | P0 | OWNED・stock 0 で再起動 | Seed S4 | 完全終了 → 再起動 → Shop / Inventory / Free Cooking tray | X は OWNED（補充行）。LOCKED / AVAILABLE_TO_UNLOCK に戻らない | 390×844 | VIDEO, SAVE_DUMP | DEVICE_REQUIRED | Issue #216, PR #217 | — |
| `PERM-03` | P1 | HOME へ戻る（調理途中 / RESULT 後） | X OWNED | Free Cooking の TOPPING 途中で HOME へ戻る → Shop。RESULT から HOME → Shop | どちらでも X の state は変わらない。途中離脱で在庫の扱いが既存仕様どおり | 390×844 / 360×800 | VIDEO | HYBRID | Issue #216, PR #217 | — |
| `PERM-04` | P0 | 残高が減っても再 LOCK されない | X は AVAILABLE_TO_BUY か OWNED。残高が解放条件の Pitz 値を上回っている | 他の材料の購入で残高をほぼ 0 にする → Shop | X は再 LOCK されない（残高・消費は eligibility に使わない）。『解放済み』のまま | 390×844 | VIDEO, SAVE_DUMP, PITZ_LEDGER | HYBRID | Issue #216, PR #217 | — |
| `PERM-05` | P1 | Free Cooking / Lunch Rush をまたいでも state 維持 | X OWNED | Free Cooking 1 枚 → HOME → Lunch Rush 1 run → HOME → Shop | X は OWNED。Lunch Rush で X を使えば stock が減るだけで state は変わらない | 390×844 | VIDEO, SAVE_DUMP | HYBRID | Issue #216, PR #217, Issue #215, PR #218 | — |
| `PERM-06` | P1 | 購入直後に background / 画面ロック | Seed S2 | 『解放』を確定した直後にホームボタン/画面ロック → 10 秒後に復帰 | fee と state が両方反映されているか、両方未反映か（中途半端な状態が無い）。再タップで二重課金しない | 390×844 | VIDEO, SAVE_DUMP, PITZ_LEDGER | DEVICE_REQUIRED | Issue #216, PR #217 | — |
| `PERM-07` | P1 | save の forward-compat（旧 build → 新 build） | 新 build で X を解放済みの save | 旧 build（set を知らない）Preview で開いて 1 枚焼いて保存 → 新 build で開く | 新 build で X は解放済みのまま（旧 build が set を消さない。PR #206 パターン） | 390×844 | SAVE_DUMP | E2E_CANDIDATE | Issue #216, PR #217, PR #206 | — |
| `PERM-08` | P2 | Full Game Reset は意図どおり全て戻す | X OWNED | 設定 → Full Game Reset → Shop | Reset は明示的な例外として X を LOCKED に戻す（仕様確認）。通常フローでは戻らない | 390×844 | VIDEO, SAVE_DUMP | E2E_CANDIDATE | Issue #216, PR #217 | — |
| `PERM-09` | P0 | 既存プレイヤーの save（set が無い） | Seed S5（現 production の schemaVersion 2 save。onion など既存購入あり） | 新 build で開く → HOME → Shop → Inventory | クラッシュしない。set は空で開始、starter と既存所有材料は OWNED のまま。既存の在庫数・Pitz・Dex・BEST が変わらない | 390×844 / 360×800 | VIDEO, SAVE_DUMP, SCREENSHOT | HYBRID | Issue #216, PR #217, PR #206 | — |
| `PERM-10` | P2 | localStorage が使えない環境 | iOS Safari プライベートブラウズ（または storage 無効） | 起動 → 1 枚焼く → Shop | 既存の fallback どおり動き、解放操作で例外が出ない。再起動で失われることが UI 上破綻しない | 390×844 | VIDEO | DEVICE_REQUIRED | Issue #216, PR #217 | — |

### 4.3 Pitz（PITZ）

| ID | Pri | 名前 | 前提状態 | 操作 | 期待結果 | viewport | evidence | 自動化 | 関連 | OD 分岐 |
|---|---|---|---|---|---|---|---|---|---|---|
| `PITZ-01` | P0 | 3 取引が別々に記録される | Seed S2。開始残高を記録 | unlock fee → 初回 stock 購入 → 在庫を使い切る → 補充。各操作の前後で HOME/Shop の残高を記録 | 残高の減り方が fee / 初回価格 / 補充価格の 3 回で、それぞれ表示価格と一致。fee は 1 回だけ。合算された謎の減算が無い | 390×844 | VIDEO, PITZ_LEDGER, SAVE_DUMP | HYBRID | Issue #216, PR #217 | OD216-1 |
| `PITZ-02` | P0 | unlock fee CTA の連打 | Seed S2 | 『解放』（確認 UI があれば確定ボタン）を指 2 本 / 高速で 5 回タップ | fee は 1 回だけ引かれる。CTA は処理中に disabled か、2 回目以降は no-op | 390×844 / 360×800 | VIDEO, PITZ_LEDGER, SAVE_DUMP | DEVICE_REQUIRED | Issue #216, PR #217 | — |
| `PITZ-03` | P0 | 初回購入 CTA の連打 | AVAILABLE_TO_BUY、残高 ≥ 初回価格×2 | 『購入』を高速で 5 回タップ | 初回購入は 1 回だけ。2 回目以降が補充として勝手に課金されない（初回→補充への遷移が連打で起きない） | 390×844 / 360×800 | VIDEO, PITZ_LEDGER, SAVE_DUMP | DEVICE_REQUIRED | Issue #216, PR #217 | — |
| `PITZ-04` | P1 | 補充 CTA の連打 | OWNED、残高 ≥ 補充価格×3 | 『補充』を高速で 5 回タップ | 仕様（1 タップ 1 補充 / 確認 UI あり）どおり。表示された回数と課金回数と在庫増加が一致 | 390×844 / 360×800 | VIDEO, PITZ_LEDGER | DEVICE_REQUIRED | Issue #216, PR #217 | — |
| `PITZ-05` | P0 | 残高不足で unlock fee | Seed S3（AVAILABLE_TO_UNLOCK、残高 < fee） | Shop → X の『解放』をタップ | CTA は disabled か不足表示（あと N Pitz）。Pitz / state / save 不変 | 390×844 / 360×800 | SCREENSHOT, SAVE_DUMP | HYBRID | Issue #216, PR #217 | OD216-1 |
| `PITZ-06` | P0 | fee 支払い後、初回購入の残高が足りない | fee 支払い後の残高 < 初回価格 | Shop → X の『購入』→ HOME → starter recipe を焼いて Pitz を稼ぐ → 再度購入 | 購入できない間も X は AVAILABLE_TO_BUY のまま（fee 再請求なし）。稼いだ後に購入できる（deadlock しない） | 390×844 | VIDEO, PITZ_LEDGER | HYBRID | Issue #216, PR #217 | — |
| `PITZ-07` | P1 | 残高不足で補充 | OWNED stock 0、残高 < 補充価格 | Shop → 補充 | 不足表示。stock 0 でも OWNED のまま、LOCKED に戻らない | 390×844 | SCREENSHOT | E2E_CANDIDATE | Issue #216, PR #217 | — |
| `PITZ-08` | P1 | 残高 = 価格ちょうど | 残高 = fee（別ケースで = 初回価格、= 補充価格） | それぞれ実行 | 実行でき、残高 0。負の残高にならない | 390×844 | PITZ_LEDGER, SAVE_DUMP | E2E_CANDIDATE | Issue #216, PR #217 | — |
| `PITZ-09` | P1 | fee と初回購入を 1 画面で続けて行う UI の場合 | UI が『解放して購入』を 1 導線にする設計の場合のみ | 導線を実行 | 合計額の表示が fee + 初回価格と一致し、内訳が見える。save には 2 取引として残る。途中キャンセルで fee だけ引かれた場合も AVAILABLE_TO_BUY として整合 | 390×844 / 360×800 | VIDEO, PITZ_LEDGER | HYBRID | Issue #216, PR #217 | OD216-1 |
| `PITZ-10` | P1 | 取引直後のアプリ強制終了（atomicity） | Seed S2 | 『解放』確定の直後に App Switcher から強制終了 → 再起動 | fee と set が両方反映 or 両方未反映。fee だけ引かれて LOCKED、は起きない | 390×844 | VIDEO, SAVE_DUMP | DEVICE_REQUIRED | Issue #216, PR #217 | — |
| `PITZ-11` | P2 | 残高表示の一致 | PITZ-01 後 | HOME / Shop / RESULT / Inventory の残高を見比べる | 全画面で同じ値。取引直後に古い値が残らない | 390×844 | SCREENSHOT | E2E_CANDIDATE | Issue #216, PR #217 | — |
| `PITZ-12` | P2 | capability A_PAID の fee が ingredient fee と別 | OD216-3 = A_PAID の場合のみ。capability 購入可、ingredient も AVAILABLE_TO_UNLOCK | capability を購入 → ingredient を解放 | 2 つの fee が別取引・別表示。二重に同じ fee を取らない | 390×844 | PITZ_LEDGER | HYBRID | Issue #216, PR #217 | OD216-3 |

### 4.4 Completion Gate（CG）

| ID | Pri | 名前 | 前提状態 | 操作 | 期待結果 | viewport | evidence | 自動化 | 関連 | OD 分岐 |
|---|---|---|---|---|---|---|---|---|---|---|
| `CG-00` | P0 | 理想 3 の mushroom を 0 個（funghi, recipe mode） | Seed S6（funghi 選択可、mushroom stock ≥ 5、他材料十分）。recipe mode | funghi を選ぶ → sauce/cheese はお手本どおり → mushroom を 0 個だけ置く → 焼く（適正）→ RESULT | 全分岐で FAILED『マッシュルームが入っていません』。報酬 0、Dex/BEST 変化なし、stock は置いた分（0）だけ減る | 390×844 / 360×800 | VIDEO, SCREENSHOT, SAVE_DUMP | HYBRID | Issue #215, PR #218 | OD-1 |
| `CG-01` | P1 | 理想 3 の mushroom を 1 個（funghi, recipe mode） | Seed S6（funghi 選択可、mushroom stock ≥ 5、他材料十分）。recipe mode | funghi を選ぶ → sauce/cheese はお手本どおり → mushroom を 1 個だけ置く → 焼く（適正）→ RESULT | §5 の分岐表どおり（G0/G2/G2b: FAILED『数が足りない』系 / G1: PASS・Q で★3・約65点・80 Pitz / S4 で★2）。PASS の場合は RESULT に『少なめ（1/3）』。stock −1 | 390×844 | VIDEO, SCREENSHOT, SAVE_DUMP | E2E_CANDIDATE | Issue #215, PR #218 | OD-1, OD-2, OD-3 |
| `CG-02` | P0 | 理想 3 の mushroom を 2 個（funghi, recipe mode） | Seed S6（funghi 選択可、mushroom stock ≥ 5、他材料十分）。recipe mode | funghi を選ぶ → sauce/cheese はお手本どおり → mushroom を 2 個だけ置く → 焼く（適正）→ RESULT | §5 の分岐表どおり（G0: FAILED / G1・G2・G2b: PASS・Q で★4・約82点・100 Pitz）。PASS の場合『少なめ（2/3）』が 1 目で分かる。stock −2 | 390×844 / 360×800 | VIDEO, SCREENSHOT, SAVE_DUMP | HYBRID | Issue #215, PR #218 | OD-1, OD-2, OD-3 |
| `CG-03` | P0 | 理想 3 の mushroom を 3 個（funghi, recipe mode） | Seed S6（funghi 選択可、mushroom stock ≥ 5、他材料十分）。recipe mode | funghi を選ぶ → sauce/cheese はお手本どおり → mushroom を 3 個だけ置く → 焼く（適正）→ RESULT | 全分岐で PASS ★5（約99.5）・120 Pitz。『少なめ/多め』表示なし（回帰）。stock −3 | 390×844 | VIDEO, SCREENSHOT, SAVE_DUMP | HYBRID | Issue #215, PR #218 | OD-1, OD-2, OD-3 |
| `CG-04` | P1 | 理想 3 の mushroom を 4 個（funghi, recipe mode） | Seed S6（funghi 選択可、mushroom stock ≥ 5、他材料十分）。recipe mode | funghi を選ぶ → sauce/cheese はお手本どおり → mushroom を 4 個だけ置く → 焼く（適正）→ RESULT | 全分岐で PASS。OD-3=0: ★5 / 0.15: ★5（約93-94）/ 0.25: ★5（約91）。『多め（4/3）』表示。stock −4 | 390×844 | VIDEO, SCREENSHOT, SAVE_DUMP | E2E_CANDIDATE | Issue #215, PR #218 | OD-1, OD-2, OD-3 |
| `CG-05` | P1 | 理想 3 の mushroom を 5 個（funghi, recipe mode） | Seed S6（funghi 選択可、mushroom stock ≥ 5、他材料十分）。recipe mode | funghi を選ぶ → sauce/cheese はお手本どおり → mushroom を 5 個だけ置く → 焼く（適正）→ RESULT | 全分岐で PASS。OD-3=0: ★5 / 0.15: ★4（約86）/ 0.25: ★4（約83）。『多め（5/3）』表示。stock −5 | 390×844 | VIDEO, SCREENSHOT, SAVE_DUMP | E2E_CANDIDATE | Issue #215, PR #218 | OD-1, OD-2, OD-3 |
| `CG-06` | P1 | 不足/過剰メッセージの可読性 | CG-02 / CG-05 の RESULT | RESULT を 360×800 で表示 | 『少なめ（2/3）』『多め（5/3）』が折り返しで欠けない。★・点数・Pitz と矛盾しない（★4 なのに ★5 の Pitz、が無い） | 390×844 / 360×800 | SCREENSHOT | HYBRID | Issue #215, PR #218 | OD-2 |
| `CG-07` | P1 | 在庫が理想量未満での recipe 開始 | mushroom stock = 2（理想 3） | Recipe Select で funghi を選ぶ | G0: 選べない/警告（現行 EP3 Stock Gate）。G1: 選べて 2 個で完成できる（soft-lock 解消）。G2/G2b: ideal 3 に 2 個は PASS なので G1 と同じ | 390×844 | VIDEO, SCREENSHOT | E2E_CANDIDATE | Issue #215, PR #218, PR #213 | OD-1 |
| `CG-08` | P1 | Free Cooking で同じ数量パターン | Free Cooking、funghi 未発見 / 発見済みの 2 状態 | mushroom を 0/1/2/3/5 個で funghi の組み合わせを焼く | discovery の扱いは OD-5 の分岐表（DISC-03）どおり。0 個は funghi にならない（オリジナル/別 recipe） | 390×844 | VIDEO | E2E_CANDIDATE | Issue #215, PR #218 | OD-1, OD-5 |
| `CG-09` | P2 | 既存 Dex BEST は下がらない（grandfather） | 過剰で ★5 を取った旧 BEST を持つ save | 新 build で同じ過剰量を焼く → Dex | BEST は旧値のまま。新しい結果が低くても上書きしない | 390×844 | SCREENSHOT, SAVE_DUMP | E2E_CANDIDATE | Issue #215, PR #218 | — |
| `CG-10` | P2 | 複数具材が同時に不足（worst-group） | Seed S6 | funghi で mozzarella 2→1 と mushroom 3→2 を同時に | ★ は最も足りない具材（1/2）で決まる（Q なら★3）。メッセージは両方 or worst を仕様どおり表示 | 390×844 | SCREENSHOT | E2E_CANDIDATE | Issue #215, PR #218 | OD-2 |

### 4.5 Lunch Rush（LR）

| ID | Pri | 名前 | 前提状態 | 操作 | 期待結果 | viewport | evidence | 自動化 | 関連 | OD 分岐 |
|---|---|---|---|---|---|---|---|---|---|---|
| `LR-01` | P0 | 注文どおりの数で提供（exact） | Seed S7（Lunch Rush 開始可、注文 recipe の在庫十分） | HOME → Lunch Rush → 1 枚目を注文どおりに作って提供 | 全分岐で PASS。100 + quality。HUD の served +1。stock は置いた分だけ減る | 390×844 / 360×800 | VIDEO, SCREENSHOT | HYBRID | Issue #215, PR #218, PR #213 | — |
| `LR-02` | P0 | under-fill（理想 3 に 2 個）で提供 | Seed S7（funghi 注文が出る状態） | mushroom を 2 個だけ置いて提供 | LR-A: FAILED『注文のマッシュルームの数が足りません』0 点、時間は消費、stock −2。LR-C: PASS、基本点 = 100×(2/3) + quality。LR-D: PASS 100 + quality（少なく載せる方が得になり得る）。LR-E: PASS、品質に強い不足係数 | 390×844 / 360×800 | VIDEO, SCREENSHOT | HYBRID | Issue #215, PR #218, PR #213 | OD-4 |
| `LR-03` | P1 | 注文具材 0 個で提供 | Seed S7 | 注文の主役具材を置かずに提供 | 全分岐で FAILED『○○が入っていません』0 点 | 390×844 | VIDEO | E2E_CANDIDATE | Issue #215, PR #218 | — |
| `LR-04` | P1 | over-fill（理想 3 に 5 個）で提供 | Seed S7 | mushroom を 5 個置いて提供 | 全分岐で PASS。quality に過剰罰（OD-3）。stock −5。多めに置いても served は 1 | 390×844 | VIDEO | E2E_CANDIDATE | Issue #215, PR #218 | OD-3, OD-4 |
| `LR-05` | P1 | 180 秒境界 | Seed S7。残り 10 秒前後まで進める | (a) 残り 1〜2 秒で提供 (b) 0 秒到達後に提供ボタンを押す (c) 作りかけのまま 0 秒 | (a) は served に数える。(b)(c) は数えない（now ≥ endsAt は拒否）。終了 overlay の served / 点数が HUD と一致。作りかけの pizza は点にならない | 390×844 | VIDEO, SCREENSHOT | HYBRID | Issue #215, PR #218 | — |
| `LR-06` | P1 | Lunch Rush 中の background | Lunch Rush 開始直後 | 30 秒 background → 復帰、200 秒 background → 復帰 | 残り時間は wall clock 基準（endsAt − now）。200 秒後の復帰では run が終了済み、背景中の提供は無い | 390×844 | VIDEO | DEVICE_REQUIRED | Issue #215, PR #218 | — |
| `LR-07` | P1 | mission score の丸め | quality の小数が .5 になる seed（または E2E の clock/品質固定） | run を終える → 結果 overlay → ranking 送信 | 表示点 = Math.round(served×100 + Σquality)（.5 切り上げ）。結果 overlay・HOME の BEST・ranking の値が同じ整数 | 390×844 / 360×800 | SCREENSHOT, NETWORK | E2E_CANDIDATE | Issue #215, PR #218 | — |
| `LR-08` | P1 | ranking payload の ruleset version | Firebase Preview 接続 | run 終了 → submit | LR-A: lunch-rush-v1 のまま。LR-C/D/E: v2 に bump、週間 ranking の区切りが仕様どおり | 390×844 | NETWORK, SCREENSHOT | HYBRID | Issue #215, PR #218 | OD-4 |
| `LR-09` | P1 | 在庫による注文 pool（#213 seam） | mushroom stock = 2（理想 3）、他は十分 | Lunch Rush を 3 回開始して注文を観察 | LR-A: funghi は注文に出ない（在庫 < minCount）。LR-C/D: 在庫 ≥ 1 なので出る | 390×844 | VIDEO | E2E_CANDIDATE | Issue #215, PR #218, PR #213 | OD-4 |
| `LR-10` | P2 | 新 recipe は DISCOVERED 後にだけ注文に出る | W1 recipe を所有材料で作れるが未発見 | Lunch Rush 開始 → 発見 → 再度開始 | 未発見の間は注文に出ない（#200 の discovered pool）。発見後は出うる | 390×844 | VIDEO | E2E_CANDIDATE | Issue #215, PR #218, PR #220, PR #221 | — |
| `LR-11` | P1 | 提供ボタンの連打 | Seed S7 | 完成直後に『提供』を高速 5 回 | served は 1 回だけ増える。次の注文が飛ばされない | 390×844 / 360×800 | VIDEO | DEVICE_REQUIRED | Issue #215, PR #218 | — |
| `LR-12` | P1 | mode 差の納得感（LR-A 採用時） | LR-A 採用。CG-02（recipe mode で 2 個 PASS）を体験した直後 | Lunch Rush で同じ 2 個を提供 | FAILED の文言が『注文』を強調し、理不尽に感じないか（Human Feel）。LR-C 採用時は代わりに減点の理由が見えるか | 390×844 | VIDEO | DEVICE_REQUIRED | Issue #215, PR #218 | OD-4 |

### 4.6 Recipe discovery（DISC）

| ID | Pri | 名前 | 前提状態 | 操作 | 期待結果 | viewport | evidence | 自動化 | 関連 | OD 分岐 |
|---|---|---|---|---|---|---|---|---|---|---|
| `DISC-01` | P0 | 所有 → Free Cooking → match → DISCOVERED → Dex/BEST/⭐ | X（eggplant）OWNED、melanzane 未発見。⭐ 合計を記録 | Free Cooking → tomato-sauce / mozzarella / eggplant / basil を理想量で置く → 焼く → RESULT → Dex | RESULT で新発見の演出と recipe 名。Dex に melanzane が BEST ★ 付きで出る。⭐ 合計が max(2, BEST) だけ増える。save: discovered に追加、BEST 記録 | 390×844 / 360×800 | VIDEO, SCREENSHOT, SAVE_DUMP | HYBRID | PR #220, PR #221, Issue #216, PR #217 | — |
| `DISC-02` | P1 | Dex の新 recipe 詳細 | DISC-01 後 | Dex → melanzane を開く | 名前・説明・材料と理想量（お手本）が読める。新材料の emoji が他と区別できる。未発見 recipe は伏せ字 | 390×844 / 360×800 | SCREENSHOT | HYBRID | PR #220, PR #221 | — |
| `DISC-03` | P1 | 少ない量での discovery（OD-5） | X OWNED、parmigiana 未発見 | Free Cooking で parmigiana の種類を 1 個ずつ置いて焼く | D-A: 発見、BEST ★3 程度、発見 bonus。D-B: INCOMPLETE_MATCH（オリジナル）と、個数を示す hint 文言 | 390×844 | VIDEO, SCREENSHOT | HYBRID | Issue #215, PR #218, PR #220, PR #221 | OD-5, OD-1 |
| `DISC-04` | P1 | 近傍 recipe との衝突 | eggplant OWNED、margherita 発見済み | (a) margherita の組み合わせ (b) + eggplant（melanzane）(c) + eggplant + parmigiano（parmigiana）を順に焼く | それぞれ正しい recipe に match。melanzane と parmigiana を取り違えない。margherita の BEST は (b)(c) で更新されない | 390×844 | VIDEO, SCREENSHOT | E2E_CANDIDATE | PR #220, PR #221 | — |
| `DISC-05` | P1 | 発見後に recipe mode で選べる | DISC-01 後 | HOME → recipe 選択 | melanzane が選べる（在庫条件つき）。お手本に eggplant が正しく出る | 390×844 / 360×800 | SCREENSHOT | E2E_CANDIDATE | PR #220, PR #221 | — |
| `DISC-06` | P1 | ⭐/発見数が次の解放条件を進める（chain） | 次の材料 Y の条件が『⭐ N』または『発見数 N』で、あと 1 | DISC-01 を実行 → Shop | Y が AVAILABLE_TO_UNLOCK になる（UNL-02 と同じ表示） | 390×844 | VIDEO | HYBRID | PR #220, PR #221, Issue #216, PR #217 | OD216-2 |
| `DISC-07` | P2 | BEST 更新は上方向のみ | melanzane BEST ★3 | ★5 で焼く → ★2 で焼く | ★5 で BEST 更新・⭐ 増加、★2 では変化なし | 390×844 | SCREENSHOT | E2E_CANDIDATE | PR #220, PR #221 | — |
| `DISC-08` | P1 | 発見の永続化 | DISC-01 直後 | 完全終了 → 再起動 → Dex | melanzane は発見済み、BEST と ⭐ が同じ | 390×844 | VIDEO, SAVE_DUMP | DEVICE_REQUIRED | PR #220, PR #221 | — |
| `DISC-09` | P1 | 未所有材料では発見できない | eggplant LOCKED | Free Cooking の tray を全ページ確認 | eggplant は tray に無い（または locked 表示で置けない）。melanzane を偶然発見できない | 390×844 / 360×800 | SCREENSHOT | E2E_CANDIDATE | PR #220, PR #221, Issue #216, PR #217 | — |

### 4.7 新工程 / capability（CAP）

| ID | Pri | 名前 | 前提状態 | 操作 | 期待結果 | viewport | evidence | 自動化 | 関連 | OD 分岐 |
|---|---|---|---|---|---|---|---|---|---|---|
| `CAP-B-01` | P1 | B_AUTO: 条件達成で自動解放 | OD216-3=B（foundational: DOUGH_VARIANT / PAN_BAKE など）。条件まであと 1 | 条件を満たす bake → RESULT → HOME | Pitz を使わずに解放。通知が 1 回。関連する材料/recipe が以後の Shop/tray に出る | 390×844 | VIDEO, SAVE_DUMP, PITZ_LEDGER | HYBRID | Issue #216, PR #217 | OD216-3 |
| `CAP-B-02` | P1 | B_AUTO: 初回使用の分かりやすさ | CAP-B-01 後 | 新工程を含む pizza を初めて作る | 説明なしでも新しい step/UI が理解できる（Human Feel）。分からない場合は C への切替材料として記録 | 390×844 | VIDEO | DEVICE_REQUIRED | Issue #216, PR #217 | OD216-3 |
| `CAP-C-01` | P1 | C_TUTORIAL: 初回 target で tutorial | OD216-3=C（interaction-heavy。例: STEP_ORDER を starter の trenton-tomato-pie で） | その target を初めて作る | tutorial は target の matching より前に出る（循環しない）。完了後に通常フローへ戻る。skip しても壊れた状態にならない | 390×844 / 360×800 | VIDEO, SCREENSHOT | DEVICE_REQUIRED | Issue #216, PR #217 | OD216-3 |
| `CAP-C-02` | P1 | C_TUTORIAL: 再起動後に再表示しない | CAP-C-01 完了 | 完全終了 → 再起動 → 同じ target | tutorial は出ない。capability は解放済み | 390×844 | VIDEO, SAVE_DUMP | DEVICE_REQUIRED | Issue #216, PR #217 | OD216-3 |
| `CAP-C-03` | P1 | C_TUTORIAL: overlay の収まり | CAP-C-01 | tutorial の全ページを 390/360 で表示 | CTA が画面内、scroll trap なし、背面操作が漏れない | 390×844 / 360×800 | SCREENSHOT, VIDEO | DEVICE_REQUIRED | Issue #216, PR #217 | OD216-3 |
| `CAP-A-01` | P2 | A_PAID: capability 購入（採用時のみ） | OD216-3=A の capability がある | 購入 / 残高不足 / 連打 / キャンセルを PITZ-02,05,12 と同じ手順で | 1 回だけ課金、不足時は不変、ingredient fee と別取引 | 390×844 | VIDEO, PITZ_LEDGER | DEVICE_REQUIRED | Issue #216, PR #217 | OD216-3 |
| `CAP-X-01` | P1 | capability 前提の材料が deadlock しない | cauliflower dough（DOUGH_VARIANT 前提）が見える段階 | Shop で確認 → capability 解放 → 再確認 | capability 未解放の間は購入できず理由が出る。B/C どちらでも fee を払った材料が使えない状態にならない | 390×844 | SCREENSHOT, SAVE_DUMP | E2E_CANDIDATE | Issue #216, PR #217 | OD216-3 |
| `CAP-X-02` | P2 | 新工程の gesture 感（mechanic 実装時） | PAN_BAKE / ENCLOSE / LATE_ADDITION / MULTI_SPREAD_LAYER の各実装後 | 各工程を実機で 3 回 | 指で操作でき、誤操作が少ない。W1 のスコープ外（W4/W5） | 390×844 / 360×800 | VIDEO | DEVICE_REQUIRED | Issue #216, PR #217, PR #220 | —<br>blocked: mechanic 実装（W4/W5） |

### 4.8 W1 content visual（VIS）

| ID | Pri | 名前 | 前提状態 | 操作 | 期待結果 | viewport | evidence | 自動化 | 関連 | OD 分岐 |
|---|---|---|---|---|---|---|---|---|---|---|
| `VIS-01` | P1 | emoji の OS 差 | W1 新材料（#220 head: capers, clam, corn, eggplant, fresh-tomato, pineapple, potato / #221: baked-beans, capers, eggplant, green-onion, salt-cod, sauerkraut） をすべて OWNED | iPhone（iOS）と Android 実機で tray / pizza 上 / Shop / Inventory / Dex を撮る | どの OS でも材料が判別できる。☐（tofu）にならない。特に 🫘（Emoji 14.0: iOS 15.4+ / Android 12L+ 目安）。最低 OS を下回る端末の扱いを記録 | 390×844 / 360×800 | SCREENSHOT | DEVICE_REQUIRED | PR #220, PR #221 | — |
| `VIS-02` | P1 | 既存材料と同じ/似た glyph | 該当材料を OWNED | tray と pizza 上で並べる: salt-cod 🐟 vs anchovy 🐟 / green-onion 🌱 vs rosemary 🌱 / capers 🟢 vs black-olive ⚫・pepperoni 🔴 / fresh-tomato vs cherry-tomato 🍅 / sauerkraut 🥬 vs basil 🌿 | 同一 emoji の組は color/label だけで区別できるか判定。できなければ authoring へ差し戻し（REVIEW のまま） | 390×844 | SCREENSHOT | DEVICE_REQUIRED | PR #220, PR #221 | — |
| `VIS-03` | P1 | 焼成前後の視認性 | 各 W1 recipe を理想量で作れる | 焼く前 / 焼いた後（適正・焼きすぎ）を同じ位置で撮る | 焼成の色変化後も新材料が見える。低コントラスト候補（salt-cod #d8c9aa, sauerkraut #d8d59a, potato 等の淡色）が mozzarella 上で消えない | 390×844 / 360×800 | SCREENSHOT | DEVICE_REQUIRED | PR #220, PR #221 | — |
| `VIS-04` | P1 | ingredient overlap | 材料数が多い recipe（pizza-portuguesa: 6 種 11 片 など） | 理想量を置く → 重なった piece を 1 つ選んで動かす/外す | 重なっても種類と数が読める。狙った piece を指でつかめる（390/360）。上に来る piece の順が自然 | 390×844 / 360×800 | VIDEO, SCREENSHOT | DEVICE_REQUIRED | PR #220, PR #221 | — |
| `VIS-05` | P1 | sauce ごとの見え方 | tomato-sauce 系（melanzane, parmigiana, puttanesca, portuguesa）と pesto 系（pesto-tonno, #220 の pesto-caprese / pesto-patate） | sauce を塗った上に新材料を置いて焼く | pesto の緑の上で緑系（capers 🟢, green-onion 🌱）が消えない。tomato の赤の上で赤系が消えない | 390×844 / 360×800 | SCREENSHOT | DEVICE_REQUIRED | PR #220, PR #221 | — |
| `VIS-06` | P1 | tray の到達性と tap target（360×800） | 全 W1 材料 OWNED（合計材料数が増えた状態） | Free Cooking / recipe mode の tray を全ページめくって各材料を 1 つずつ置く | 全材料に到達でき、paging が分かる。tap target が小さすぎない。誤って隣の材料を取らない | 390×844 / 360×800 | VIDEO | DEVICE_REQUIRED | PR #220, PR #221 | — |
| `VIS-07` | P1 | Shop / Inventory の行（長い名前） | W1 材料が各 state に 1 つ以上 | Shop / Inventory を 360×800 で表示 | ベイクドビーンズ / ザワークラウト / フレッシュトマト 等が CTA や価格と重ならない | 390×844 / 360×800 | SCREENSHOT | E2E_CANDIDATE | PR #220, PR #221 | — |
| `VIS-08` | P1 | お手本 / RESULT の完成 pizza 表示 | 各 W1 recipe | recipe mode のお手本 → 作る → RESULT | お手本と RESULT の finished pizza で新材料の見え方が一致（Reference visual の統一ルール） | 390×844 | SCREENSHOT | HYBRID | PR #220, PR #221 | — |
| `VIS-09` | P2 | 長い recipe 名 | W1 recipe 発見済み | Recipe Select / Dex / RESULT / Lunch Rush 注文 を 360×800 で | ピッツァ・ポルトゲーザ / ペストカプレーゼピザ 等が切れない・2 行で崩れない | 390×844 / 360×800 | SCREENSHOT | E2E_CANDIDATE | PR #220, PR #221 | — |
| `VIS-10` | P2 | CUT（6-slice 候補） | CUT を opt-in した W1 recipe | CUT で切る | emoji piece の上でも切り線が見え、分割後も材料が読める | 390×844 | VIDEO | DEVICE_REQUIRED | PR #220, PR #221 | —<br>blocked: CUT 採否（#221 Gate TBD） |
| `VIS-11` | P2 | sauceless recipe（#221 slice A 等） | SAUCELESS_RECIPE_CONTRACT 実装後のみ（aussie, bacalhau, full-english, polish-kielbasa, tsukimi） | SAUCE step の有無を確認して作る | SAUCE step が出ない/任意で、生地の上に直接置いた材料が見える | 390×844 / 360×800 | VIDEO, SCREENSHOT | DEVICE_REQUIRED | PR #220, PR #221 | —<br>blocked: #220 head で W4（SAUCELESS_RECIPE_CONTRACT） |
---

## 5. Completion Gate の分岐表（理想 3 の mushroom、funghi、recipe mode）

- #218 の OD-1（FAILED の境界）と OD-2 / OD-3（Scoring）は**決まっていない**。
- 実装で採った分岐の列だけを期待値として使う。
- 点数と Pitz は #218 §2〜§4 の「最良の配置」での値。実機では配置・sauce・焼き加減の分だけ下がる。したがって判定は「★の帯」と「文言」で行い、点数の完全一致は求めない。

| 置いた数 | G0（今） | G1（#218 推奨） | G2 = ceil(3×50%) = 2 | G2b = ceil(3×2/3) = 2 | G3 / G4 | ★（Q, 不足 0.5） | ★（S4） | 表示 |
|---|---|---|---|---|---|---|---|---|
| 0 | FAILED | FAILED | FAILED | FAILED | FAILED | — | — | 「マッシュルームが入っていません」 |
| 1 | FAILED | PASS | FAILED | FAILED | authored の値 / 主役なら FAILED | ★3 約65、80 Pitz | ★2 59.9、50 Pitz | PASS なら「少なめ（1/3）」 |
| 2 | FAILED | PASS | PASS | PASS | authored の値 / 主役でも PASS | ★4 約82、100 Pitz | ★4 89.9 | 「少なめ（2/3）」 |
| 3 | PASS | PASS | PASS | PASS | PASS | ★5 約99.5、120 Pitz | ★5 | なし（回帰） |
| 4 | PASS | PASS | PASS | PASS | PASS | 過剰 0: ★5 / 0.15: ★5 約93〜94 / 0.25: ★5 約91 | ★5 | 「多め（4/3）」（表示する仕様の場合） |
| 5 | PASS | PASS | PASS | PASS | PASS | 過剰 0: ★5 / 0.15: ★4 約86 / 0.25: ★4 約83 | ★5 | 「多め（5/3）」 |

すべての分岐で共通して確認すること:

- stock は置いた個数だけ減る（M4）。
- ★ と Pitz の帯が一致する。
- FAILED のときは Dex / BEST / 報酬が変わらない。
- G0 以外の分岐では、CG-07（理想より少ない在庫での開始）の期待値が変わる。

## 6. Lunch Rush: OD-4 の選択肢ごとのテストの差

| 観点 | LR-A（#218 推奨） | LR-C | LR-D（非推奨） | LR-E（非推奨） |
|---|---|---|---|---|
| under-fill（LR-02） | FAILED「注文の○○の数が足りません」0 点、時間と在庫は消費 | PASS、基本点 = 100×残りの割合 + quality | PASS 100 + quality | PASS、品質に強い不足の係数 |
| exact（LR-01） | 変化なし（回帰） | 変化なし | 変化なし | 変化なし |
| over-fill（LR-04） | PASS、OD-3 の過剰罰は quality だけ | 同じ | 同じ | 同じ |
| 0 個（LR-03） | FAILED | FAILED | FAILED | FAILED |
| 180 秒の境界（LR-05） | 共通: `now ≥ endsAt` は数えない | 共通 | 共通 | 共通 |
| 丸め（LR-07） | v1 の式のまま | 基本点が小数になるので、**.5 の境界の seed を追加する** | v1 と同じ式 | quality の小数が増えるので境界の seed を追加 |
| ranking（LR-08） | `lunch-rush-v1` のまま、送信内容は変わらない | v2 に bump。週の区切りと、過去スコアと混ざらないことを確認 | v2 | v2 |
| 注文の pool（LR-09） | 在庫 < minCount の recipe は出ない | 在庫 ≥ 1 で出る（#213 U-1/U-2 の期待値を書き直す） | 同 LR-C | 同 LR-C |
| Human Feel（LR-12） | mode の差（recipe mode では PASS、LR では FAILED）が理不尽でないか | 減点の理由が HUD / 結果で見えるか | 少なく載せる方が得になることが見えてしまわないか | recipe mode の ★ の感覚と矛盾しないか |
| 追加の証拠 | なし | NETWORK（v2 の payload）、結果 overlay の内訳 | NETWORK | NETWORK |
| HR-8（1 個あたりの秒数の実測） | 任意（モデルの前提確認） | **必須**（LR-C を検証する材料） | 任意 | 必須 |

## 7. P0 / P1 / P2

### 7.1 基準

- **P0**: 壊れると進行不能、Pitz の損失、進行の巻き戻り（再 LOCK / 二重課金 / 旧 save の破損）、Completion Gate / Lunch Rush の中心の判定。実装 PR の merge 前に必須。
- **P1**: 分岐ごとの仕様確認、境界、操作感、layout、visual の authoring 判断。該当する実装 PR の merge 前に行う。OD で採らなかった分岐の scenario は N/A にする。
- **P2**: まれな経路、将来の mechanic、表示の細部。release 前にまとめて確認する。

### 7.2 分類（件数は machine-readable の `counts` と一致する）

| Priority | 件数 | ID |
|---|---:|---|
| P0 | 22 | UNL-01〜07, PERM-01, PERM-02, PERM-04, PERM-09, PITZ-01, PITZ-02, PITZ-03, PITZ-05, PITZ-06, CG-00, CG-02, CG-03, LR-01, LR-02, DISC-01 |
| P1 | 48 | UNL-08, 09, 12 / PERM-03, 05, 06, 07 / PITZ-04, 07, 08, 09, 10 / CG-01, 04, 05, 06, 07, 08 / LR-03〜09, 11, 12 / DISC-02〜06, 08, 09 / CAP-B-01, 02, CAP-C-01〜03, CAP-X-01 / VIS-01〜08 |
| P2 | 16 | UNL-10, 11, 13 / PERM-08, 10 / PITZ-11, 12 / CG-09, 10 / LR-10 / DISC-07 / CAP-A-01, CAP-X-02 / VIS-09, 10, 11 |

### 7.3 最小の P0 smoke flow（390×844 の iPhone 実機、動画 3 本、合計 6〜8 分が目安）

- 1 つの流れで、P0 のうち実機が必要な部分をまとめて確認する。
- X = eggplant、確認用の recipe = melanzane。
- 各 step の前後で PITZ_LEDGER を付ける。

| # | 動画 | step | 対応する scenario | 合格条件 |
|---|---|---|---|---|
| 1 | A | Seed S1 で Shop を開き、X が LOCKED で条件が読める | UNL-01 | CTA なし、条件と進捗が見える |
| 2 | A | 条件を満たす 1 枚を焼く → HOME → Shop | UNL-02 | 通知 1 回、AVAILABLE_TO_UNLOCK、fee が見える |
| 3 | A | 解放の確定ボタンを 5 回連打 | UNL-03, PITZ-02 | fee が 1 回だけ引かれ、AVAILABLE_TO_BUY |
| 4 | A | アプリを完全終了 → 再起動 → Shop | PERM-01 | AVAILABLE_TO_BUY のまま、fee の再請求なし、残高も同じ |
| 5 | A | 購入 → OWNED、在庫 10×k | UNL-04 | 初回価格だけ引かれ、fee の再請求なし |
| 6 | B | Free Cooking で melanzane を理想量で焼く → RESULT → Dex | UNL-05, DISC-01 | 新発見、Dex に BEST、⭐ 増加、在庫が置いた数だけ減る |
| 7 | B | 在庫を 0 にする（seed の差し替えでもよい）→ Shop | UNL-06 | OWNED の補充行。LOCKED に戻らない |
| 8 | B | 補充 | UNL-07 | 補充価格だけ引かれ、在庫 +10×k |
| 9 | B | 残高を fee 未満にして、別の材料 Y の解放をタップ | PITZ-05 | 不足の表示、状態は変わらない |
| 10 | C | recipe mode の funghi で mushroom 2 個 → RESULT | CG-02 | 採った OD-1 / OD-2 の分岐表どおり |
| 11 | C | funghi で mushroom 0 個 → RESULT | CG-00 | FAILED「マッシュルームが入っていません」 |
| 12 | C | Lunch Rush で funghi の注文に mushroom 2 個で提供 | LR-02 | 採った OD-4 の分岐どおり |
| 13 | C | 同じ run で次の注文を注文どおりに提供 | LR-01 | PASS、served +1 |
| 14 | —（SAVE_DUMP のみ） | Seed S5（旧 save）を新 build で開く | PERM-09 | クラッシュなし、既存の所有・在庫・Dex が変わらない |

- smoke に含めない P0 は、E2E で状態を assert すれば十分なもの: PERM-02, PERM-04, PITZ-01, PITZ-03, PITZ-06, CG-03。
  - 実装 PR の Result Report では、smoke の動画と、これらの E2E の結果を合わせて P0 の完了とする。
- 360×800 の smoke は、同じ step 1〜4、6、10 を Android 実機（なければ Chromium emulation）で撮る。

## 8. 将来 E2E にする候補（今回は e2e を書かない）

- `E2E_CANDIDATE` の 26 件と `HYBRID` の 33 件の状態 assert。
- 優先して e2e 化するもの:
  - 3 取引の ledger（PITZ-01）
  - 再 LOCK なし（PERM-02, PERM-04）
  - 旧 save（PERM-09）
  - forward-compat（PERM-07）
  - 丸め（LR-07）
  - 180 秒の境界（LR-05 の (b)(c)。clock を固定する）
  - recipe の衝突（DISC-04）
- `DEVICE_REQUIRED` の 27 件は、E2E に置き換えられない。連打、OS の emoji、background / 強制終了、Human Feel が理由。

## 9. 未決と前提（Owner / 実装の側で決める。本書は決めない）

| ID | 何が未決か | 影響する scenario |
|---|---|---|
| OD216-1 | fee の curve（F0〜F3）。F0 のときに AVAILABLE_TO_UNLOCK を画面に出すか | UNL-02, UNL-03, PITZ-01, PITZ-05, PITZ-09 |
| OD216-2 | ⭐ 以外の解放条件の割り当て | UNL-01, UNL-02, UNL-09, UNL-10, DISC-06 |
| OD216-3 | capability の A / B / C | CAP-*, PITZ-12 |
| OD216-4 | k の authoring / NOT_FOR_SALE | UNL-04, UNL-07, UNL-11 |
| #218 OD-1 | G0〜G4 | CG-01, CG-02, CG-07, CG-08, DISC-03 |
| #218 OD-2 / OD-3 | Q / S4、過剰の係数 | CG-01〜06, CG-10, LR-04 |
| #218 OD-4 | LR-A / C / D / E | LR-02, LR-07〜09, LR-12（§6） |
| #218 OD-5 | D-A / D-B | DISC-03, CG-08 |
| W1 set | #220 の head と #221 の set の違い（§0） | VIS-*, DISC-*（標準の eggplant / melanzane は両方の set にある） |
| sauceless | `SAUCELESS_RECIPE_CONTRACT` の実装 | VIS-11 |
| CUT | W1 の CUT を採るか | VIS-10 |
| seed | 実機に seed を入れる方法 | すべての Seed を使う scenario |

## 10. 検証

- JSON の scenario 数と P0 / P1 / P2 は、本書 §7.2 の数と一致する（86 = 22 + 48 + 16）。ID は重複しない。
- すべての scenario が次の field を持つ: ID / priority / 前提状態 / 操作 / 期待結果 / viewport / evidence / 自動化 / 関連 Issue・PR / OD の分岐。
- 実行したもの: GitHub の PR / Issue の読み取り、各 PR の head の docs と data の読み取り、`main` の src の読み取り（save key、Lunch Rush、丸め、emoji）。
- 実行していないもの: Full Chromium / WebKit、unit / e2e、実機の撮影（実装がまだないため）。
