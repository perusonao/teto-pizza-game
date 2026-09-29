# Large Catalog UX — LC-R5 Implementation & Verification Plan (R5-a 〜 R5-e, iPhone HV, R6 Gate)

**docs / test-planning only (revision 2).** production code 0 / save 0 / test 実装 0 / e2e 0 / runtime 0 変更。PR 作成なし。LC-R5 production 実装なし。
Human Verification: 対象外（Policy §2: docs-only）。本書は各スライスの HV 計画（§11）を定めるだけで、動画・スクリーンショットは撮らない。

## 0. Authority と fresh state

### 0.1 Authority（実物を read-only で確認済み）

| 項目 | 値 |
|---|---|
| **Authority branch** | `claude/lc-r5-fresh-audit-z4bga9`（`origin/claude/lc-r5-fresh-audit-z4bga9`、docs-only。`main` には無い） |
| **Authority commit** | **`b584b7a0a8b98c1e507d0ce860bb7064dcabff82`**（`docs(large-catalog): record LC-R5 Owner Decisions OD-R5-1..12 …`）。merge-base = `origin/main` `12725eb`（PR #306 merge）。`main` との差分は docs 2 ファイルのみ（audit 新規 + `PROJECT_HANDOFF.md` +1 行） |
| **LC-R5 Fresh Audit** | `docs/reports/TETO_LARGE-CATALOG-UX_LC-R5_Fresh-Audit.md`（464 行、`git show b584b7a:…` で全文を読了） |
| **最新 Owner Authority** | **§21**（OD-R5-1〜12 CONFIRMED、§21.1 #197 追加契約、§21.2 R5 スライスへの帰結）。§19 は推奨案の履歴。**競合時は §21 が優先**（audit 自身も §20 末尾でそう述べている） |
| `PROJECT_HANDOFF.md` | 同 commit に R5 Owner Decision の要約 1 行あり（§21 と一致） |
| 本書の基準 `origin/main` | `12725eb`（fresh fetch、PR #306 merged） |
| 本書 branch | `claude/lc-r5-implementation-verification-jo557t`（`origin/main` から。authority branch は merge していない — 本 branch は docs 1 ファイルのみ） |
| テスト実行 | なし（docs-only）。数値は LC-R4 Result / audit の実測値からの引用、または "est." 表記の算術 |

### 0.2 改訂履歴と D0 の解消

初版（`03068b5`）は「OD-R5-1〜12 の原本が repo に無い」と報告し D0 を BLOCK としたが、**それは authority が `main` に無く別 branch にあったための誤りだった**。本改訂で:

- **D0 解消**: OD-R5-1〜12 と #197 追加契約は §21 に実在する。初版で「依頼文要件 B-n」と呼んだ項目は §21 の各 OD に置き換えた。
- 初版が authority と食い違っていた点は §1.2 に一覧化した（OD-R5-5 の sheet 高さ、Escape の IME 例外、slice 構成 ほか）。

## 1. Authority → 計画への反映

### 1.1 OD-R5-1〜12 と #197 追加契約（§21）の反映表

| OD | Owner Authority（§21 要旨） | 本計画での反映 |
|---|---|---|
| **OD-R5-1** *(R6 finalization pending)* | capacity **12 = 現設計候補**（final ではない）。R5 は 12 を想定して設計・検証するが、**UI 文言・layout に 12 を hard-code しない**。9 vs 12 は R6 実機 Human Feel Gate で確定 | forced-on テストは 12 を主、9 を parametrize（hard-code 検知）。§12 |
| **OD-R5-2** | Model D（tile 操作が `HandSession` の pin を直接編集。pending picks + commit の 2 段階 state を作らない）| §7 R5-c |
| **OD-R5-3** | R2 の hand 構成を維持（pins + 決定的 automatic fill）。pins-only にしない（audit §8.3: 3-state tile cue = 手元に固定 / 手元 / 印なし）| §7、§9 |
| **OD-R5-4** | active-category pantry 維持。cross-category pantry なし。topping-only enforcement なし | 全スライスの前提 |
| **OD-R5-5** | pantry sheet は search / 選択中 UI を収容するため**利用可能 viewport 高さの上限へ向けて拡大**。**固定値は事前に決めない**。R5-b が 4 viewport を実測し iPhone 実機 keyboard HV を行って**安全な最大高さを確定**。search は**必要時のみ**表示、選択中 area は**pin 存在中のみ**表示。**collapsible strip は不採用** | §6.2（初版の「sheet 外形不変 + 70dvh 前提」を撤回・改訂）|
| **OD-R5-6** | inventory 0 の材料は**新規 pin 不可**。既存 pin は R2 contract（prune / sanitize authority）に従う。save schema 変更なし | §7.2（**D-c1 解消**）|
| **OD-R5-7** | 「選択中 n/cap」は許可。ただし `HAND_ENFORCEMENT_ENABLED=false` の R5 では**capacity UI を production に出さない**。R6 の enforcement 有効化時に表示 | §4（dormant）、§8 |
| **OD-R5-8** | Escape は R3 契約: **search field にフォーカス中でも sheet を閉じる**。「1 回目は search だけ clear」はしない | §6.1（**初版の IME 例外を撤回**）|
| **OD-R5-9** | pin は **App-level・session-only**。round 終了 / HOME / FREE 再開を跨いで保持、reload / app 再起動で消える。Dinner / guided / Lunch Rush に影響なし。save schema 追加なし | §7.1 |
| **OD-R5-10** | **E1**: 現在の配置（utility / pager 行の左）を維持し、**availability / reservation authority のみ pager から分離**: `utilityRow = pager OR pantryWorthwhile`。`pantryWorthwhile` は **owned / catalog authority** から導出し、hand availability・pager availability に依存しない。**stage / dock Δ0 を 4 viewport で再検証** | §5 R5-a |
| **OD-R5-11** | R5 に **Hint 5.0 → Pantry の自動 preset / link なし**。手動経路のみ。再検討は専用 audit（LC-4 等）| §9.3 privacy |
| **OD-R5-12** | R5 = **wiring / search / pin editing / #197 / entry separation**。`HAND_ENFORCEMENT_ENABLED` は **false のまま**。R6 Gate（audit §16）通過後にのみ true | §4、§12 |

**§21.1 #197 追加契約**（§8 で詳述）: `selectedIngredientId` は pantry の open / close・shelf 変更・search 変更・pantry scroll・**Builder の visible tray を実際には変えない pin 変更**では clear しない。clear 判定は **HAND enforcement が Builder tray の visible set を実際に変える瞬間のみ**。hand 変更後 tray は page 0 へ戻る。変更後に選択が**現在 visible な page**に無ければ clear、有れば維持。「hand のどこかにある」では不十分で、**authority は現在 visible な tray page**（R2 の hand-level `selectionAfterVisibleChange` をそのまま使わず page-level を実装）。OD-2（pin は filter/search/shelf で消えない・`selectedIngredientId` と別 state）は維持。

### 1.2 初版（`03068b5`）からの訂正一覧

| # | 初版 | authority との関係 | 改訂 |
|---|---|---|---|
| 1 | D0: OD-R5 原本なし（BLOCK）| 誤り（別 branch に実在）| 解消（§0）|
| 2 | D-c1: 在庫 0 pin は Owner 確認待ち（BLOCK）| OD-R5-6 で決定済み | 解消。guard の置き場所は pantry（audit §8.5）|
| 3 | D-c3: pin UI を production に出すか Owner 判断待ち（BLOCK）、案 X として「Preview 限定 compile-out」を推奨 | OD-R5-12 / OD-R5-7 / audit §8.6・§15・§16 を再評価（§4）| **Preview-only compile-out を Owner Decision として確定することはしない**。dormant 化は既存の単一 const（`HAND_ENFORCEMENT_ENABLED`）で成立し、追加 flag / Preview 経路を要しない |
| 4 | sheet 外形は R3/R4 のまま（70dvh）+ search 固定 slot（H-A 推奨、上限拡大案 H-B を「不可」）| **OD-R5-5 と不一致** | 全面改訂（§6.2）。70dvh を前提にしない。拡大方向は決定済み、値は実測で確定 |
| 5 | Escape: IME 変換中は close しない例外 | OD-R5-8 は「フォーカス中でも閉じる」。例外は authority に無い | 撤回。IME + 外付 keyboard の Escape は HV 観察項目にとどめ、挙動は変えない |
| 6 | `pantryWorthwhile` の閾値・search 表示閾値を DEFAULT 扱い | audit §6.7 / §10.1、§21.2 に「> 6」が明記 | authority 事項として記載 |
| 7 | pin の capacity 超過 UX は enforcement スライスへ先送り | audit §8.2 に契約あり（blocked add・eviction なし・中立メッセージ）。R5 では dormant UI 内で実装・forced-on 検証 | 実装対象に追加（§7.3）|
| 8 | placed 材料の保護なし | audit §8.4 | 追加（§7.3）|
| 9 | pin の寿命は「app セッション」を推奨（DEFAULT）| OD-R5-9 で決定済み | 決定済みとして記載 |
| 10 | slice 構成が audit §15 と異なる | audit §15 は提案、OD-R5-12 は範囲のみ確定 | §13 で対応表を明記 |
| 11 | `utilityRow` の式は eligible ガード付き | audit §10.1 の式には eligible が書かれていない — **文字どおり実装すると guided / Lunch Rush の dock が変わる**（所持 > 6 でも tray は recipe 限定で pager が false → 行が追加される）| eligible ガードを維持し、隔離テストで固定（§5.2）。authority と矛盾しない「実装上の必須条件」|

### 1.3 全スライス共通の不変条件

- `HAND_ENFORCEMENT_ENABLED === false`（R5 では反転しない。R6 Gate 後のみ）。
- **capacity（9 / 12）の文言・数・UI を production に出さない**（OD-R5-7）。`×n` 在庫以外の数字なし。
- save / `GameState` / Firebase / ranking に何も足さない。pin・search・shelf は保存しない。
- Dinner / guided / Lunch Rush の tray・dock・stage は R5 前後で同一。gate は `isLargeCatalogEligible` のみ（`freeCook` / `recipeFreeTray` 禁止）。
- counts なし（Phase 5 まで）。Hint 5.0 privacy contract 不変（OD-B5）。hint → pantry の自動連携なし（OD-R5-11）。
- **新しい flag / Preview・DEV opt-in を追加しない**（§4。追加が必要と判明した場合は §14 の G-c に従い Owner に戻す）。

## 2. 着手ゲート

1. #306 post-merge の Deploy / E2E WebKit が green（**本タスクの前提「待ち」。本書作成時点では未確認**）。audit §20 blocker 1（#306 未 merge）は merge 済みで解消。
2. `main` が `12725eb` から動いていたら fresh fetch して §3 の事実を再確認。
3. authority branch `b584b7a` の docs が `main` に取り込まれていること（OD-R5 記録が `main` の `PROJECT_HANDOFF.md` / reports に無いと、実装 branch から authority が見えない）。**取り込みは docs-only の別作業**で、本タスクでは行わない。
4. 各スライスは別 branch・別 PR（Owner の go ごと）。WebKit は CI（sandbox 不可）。新規 e2e は in-run 比較中心（R3 の cross-engine 教訓）。

## 3. 現状の事実（main `12725eb`）

| 領域 | 事実 |
|---|---|
| pantry entry | `pantryAvailable = eligible && PREPARE && step≠DOUGH && dockReserve.pager`（`GameScreen.tsx:326`）。**pager 依存**（OD-R4-3 が R5 で分離を要求）|
| `dockReserve.pager` | round のいずれかの step で `trayIngredientsFor().length > 6`（`MAX_INGREDIENT_PALETTE_SLOTS=6`）。round 固定 |
| tray の pager 行 | `pantryEntry && (pageCount>1 \|\| reservePagerRow)` で、`pageCount<=1` なら pager は `aria-hidden` の placeholder、entry のみ残る構造が**既にある** |
| tray の page | `IngredientTray` ローカル `useState(0)`。`goToPage` が page-level の #197（離れる page に選択があり行き先に無ければ `onClearSelection`）|
| tray の item 源 | `trayIngredientsFor()`（全 OWNED、6/page）。**hand を読まない**（未配線）|
| `handPolicy` | `HAND_ENFORCEMENT_ENABLED=false`。`handCapacityFor` は OFF で `max(1, owned)` → working set は inactive |
| `handSession` | pure、未配線。`addToHand` は在庫 0 も受理（R2）。`selectionAfterVisibleChange` は **hand-level**（未配線、R4 boundary test が import 禁止）|
| selection | `selectedIngredientId` は **`App.tsx` の useState**。round 変更 / step 変更で `App` が set・clear（`App.tsx:~290 / ~317`）|
| pantry | active category・OWNED のみ・read-only。ShelfChips は represented shelves ≥ 2。`activeShelf` はローカル（close で unmount → reopen で「すべて」）。Escape は sheet の `onKeyDown` で常に close。sheet = `position: fixed`、`height: min(70dvh, 100dvh − safe-top − 20px)`（`App.css:6256`）|
| 既存 gating の型 | ① module const（`HAND_ENFORCEMENT_ENABLED`、`DEDUCTION_HINTS_ENABLED`）② 純関数に `enabled: boolean = FLAG` の既定引数 seam（`discoveryHint.ts`）③ production default + Preview/DEV opt-in を compile-out する重い型（`hint5Flag.ts` + `previewIsolation.gate.test.ts`）|
| mutation gate | M1〜M50、52/52 killed（R4）。次の空き番号 M51（本書の番号は仮）|
| 実測（R4） | sheet 高 590.8 / 560 / 464.8 / 448（390×844 / 360×800 / 390×664 / 360×640）。chip slot 54px。list 高（chip 有）435.8 / 405 / 309.8 / 293。stage Ø 290 / 273.6 / 269.1 / 245.1、dock 174 / 174 / 162 / 162 |

## 4. R5 production の「表示」と「休眠」— D-c3 の再判定（OD-R5-12 と feature-gating architecture）

### 4.1 問い
R5 は `HAND_ENFORCEMENT_ENABLED=false` のまま（OD-R5-12）。この間 tray は hand を反映しない。**「操作できる pin UI だけが production に出るが tray に効かない」という中途半端な player UX を、新しい仕様として作ってはならない。** R5 production で何を表示し、何を休眠させるのが既存 authority と最も整合するか。

### 4.2 authority 上の根拠
| 出典 | 内容 |
|---|---|
| OD-R5-12（§21）/ §19 の「R5 dormant / R6 enable」| R5 は wiring・search・pin editing・#197・entry separation。flag は R6 Gate 後 |
| OD-R5-7 + §21.2 | capacity indicator は「`HAND_ENFORCEMENT_ENABLED` に紐づく internal capability switch」の内側。**R5 tests は force on、production は表示なし** |
| audit §8.6 note | 「R5 は internal capability switch（`GameScreen` が `HAND_ENFORCEMENT_ENABLED` から渡す `IngredientPantry` の prop）の背後に置き、**pins UI を enforcement 前は production に出さない**。R5 tests は force on。これが『R5 実装・R6 有効化』を整合させる」。「enforcement OFF の間、strip は効果を約束してはならない」|
| audit §15 R5-c / R5-d | R5-c: 「pins は保存され、tray は不変（enforcement off）」。R5-d: 「production では wired and dormant」|
| audit §16 item 10 / 11 | R6 は「tray の見え方が変わる最初のスライス」。rollback は flag 1 つ |
| §21.2 の注記 | §19 の推奨と §21 は OD-R5-1 / 5 / 7 以外**一致**。OD-R5-2〜4, 6, 8〜12 は推奨どおり承認済み（§8 の pick / hand contract の各細目が個別に承認されたとまでは §21 に書かれていない） |

**留意（正直な限界）**: §21 が「production で非表示」と**明示**しているのは capacity UI（OD-R5-7）だけである。pin toggle / 選択中 strip / 3-state cue まで休眠させる点は、audit §8.6・§15・§21.2 と OD-R5-12 の**整合的な読み**であり、§21 の逐語ではない。ただし逆の読み（inert な pin UI を production に出す）は上表のどれとも整合せず、新しい player-facing 仕様を作ってしまう。§4.5 に「読みが違っていた場合の反転コスト」を書いた。

### 4.3 既存 gating architecture の評価
- **休眠に新しい flag は要らない。** 既存の単一 const `HAND_ENFORCEMENT_ENABLED` を唯一のスイッチにし、`GameScreen` が `handEditing = HAND_ENFORCEMENT_ENABLED` を pantry / tray に渡す（audit §8.6 の prop 案）。R6 で const を反転すると、pin UI・capacity 表示・tray の hand 消費・page reset / #197 が**同時に**生きる（= R6 が「tray の見え方が変わる最初のスライス」）。**第 2 の const / 環境変数 / opt-in を作らない**（R6 での反転漏れ・二重管理を防ぐ）。
- **テストで on にする seam は型 ② に倣う**: 純関数は `enforced: boolean = HAND_ENFORCEMENT_ENABLED` の既定引数、component は `handEditing?: boolean` prop（既定は const）。production 経路は引数を渡さない。source-level gate で「production 経路が true を渡していない」「const が false」を固定。
- **型 ③（Preview/DEV opt-in を compile-out）は「休眠」の手段ではなく「実機 / e2e で休眠 UI を見る手段」の一候補**にすぎず、本書はこれを採用・確定しない（§14 の G-c）。

### 4.4 R5 production の表示 / 休眠マトリクス（本計画の提案 = authority の整合的な読み）
| 機能 | R5 production | 根拠 |
|---|---|---|
| pantry entry の分離（`utilityRow` / `pantryWorthwhile`）| **有効（見た目 Δ0）** | OD-R5-10。production では `pantryWorthwhile ⇔ 旧 pager`（§5.3）|
| search field（category の OWNED > 6 のときのみ）| **有効（表示）** | OD-R5-12 が R5 に search を含める。enforcement に依存しない。OD-R5-5「必要時のみ」|
| shelf chips / read-only tile list | 有効（R4 の見た目のまま）| R4 |
| sheet 高さの拡大（OD-R5-5）| **有効**（値は R5-b 実測で確定）| OD-R5-5 |
| pin toggle（tile が button 化）/ 3-state cue / 選択中 strip / capacity 表示 / 容量超過メッセージ | **休眠**（`handEditing=false` では描画されない。tile は R4 と同じ read-only）| §4.2 |
| App-level `HandSession`（state + ハンドラ）| **配線済み・休眠**（writer が production から到達不能 → 常に空）| OD-R5-9 / R5-c |
| tray の hand 消費（catalog 順・pager を hand 数から）| **休眠**（`enforced=false` → 従来の全 OWNED tray）| OD-R5-12 / audit §15 R5-d |
| page 0 reset + page-level #197 clear | **休眠**（visible set が変わらないので発火しない。forced-on テストで検証）| §21.1 |
| `HAND_ENFORCEMENT_ENABLED` | **false** | OD-R5-12 |

補足: production R5 の search は「見つけて名前・在庫を確認する」までで、pantry から配置・pin はできない（配置は tray のみ、audit §7 rule 6）。R5 単体の player 価値は限定的だが、これは OD-R5-12 が定めた範囲であり、**inert な操作 UI は追加しない**ことで player に「操作したのに効かない」体験を与えない。

### 4.5 反転コスト（Owner が「pin UI も production に出す」と読んでいた場合）
`handEditing` の供給元を `HAND_ENFORCEMENT_ENABLED` から常時 true に変える 1 箇所の変更で足りる。pin ロジック・state・#197・テストは同一。よって **R5-a / R5-b / R5-c のロジック / R5-d は、この読みの確認を待たずに着手できる**。UI 露出の最終確認は R5-e の統合 Gate 前（§14）。

## 5. R5-a — Pantry availability を pager availability から分離（OD-R5-10）

### 5.1 設計
1. **`pantryWorthwhile`（新 pure authority、`src/logic/catalog/` 配下）** = round の SAUCE / CHEESE / TOPPING step のいずれかで「その category の OWNED 数 > `MAX_INGREDIENT_PALETTE_SLOTS`(6)」。入力は所持数のみ。**hand・pager・pin・在庫・recipe・enforcement・page を読まない**（OD-R5-10 / audit §10.1）。
2. **`prepareDockReserve` に `utilityRow`**: `utilityRow = pager || (largeCatalogEligible && pantryWorthwhile)`。`pager`（tray が複数 page）は従来の意味のまま。CSS 変数 `--dock-pager` / class `prepare-dock--no-pager` は「utility 行の有無」と読み替え、名前・CSS は変えない（R5-a は原則 `App.css` を触らない）。
3. **`GameScreen`**: `pantryAvailable = eligible && PREPARE && step≠DOUGH && pantryWorthwhile`（`dockReserve.pager` を参照しない）。`IngredientTray` へ `reservePagerRow={dockReserve.utilityRow}`。tray の既存構造（`pantryEntry` あり・`pageCount<=1` → pager は placeholder、entry のみ）で足りる見込みなので **`IngredientTray.tsx` はコメントのみ**を目標にする。entry が無い分岐（非 eligible）の `reservePagerRow ? placeholder` は従来の `pager` で駆動。
4. **eligible ガードは必須**（§1.2 #11）: 文字どおり `pager || pantryWorthwhile` にすると、guided / Lunch Rush（tray は recipe 限定で `pager=false`、所持は > 6 でも）で utility 行が増えて dock の高さが変わる。

### 5.2 検証
- **等価性テスト（pure）**: 所持 0〜22（境界 6/7）× freeCook × enforcement false で、eligible のとき `pantryWorthwhile === 旧 pager` を全件 assert → production の dock 高さが変わり得ないことの機械的証明（**Δ0**）。
- **隔離 golden**: guided / Lunch Rush / Dinner（`recipeFreeTray`）の `prepareDockReserve` 出力が R4 と deep-equal（`utilityRow === pager`）。所持 > 6 の guided / Lunch Rush を必ず含める。
- **分離テスト（seam）**: `enforced=true` で hand が 6 以下・1 page でも entry が残る（audit §10.1、実ケース: 在庫 0 が多く自動 source が skip して hand ≤ 6 / capacity 候補が 6 以下 / pin で page 数 1）。全 category の所持 ≤ 6 なら entry なし。
- **source-level**: `pantryAvailable` / `pantryWorthwhile` が `dockReserve.pager` も hand（`resolveHand` / `workingSet` / `handSession`）も参照しない（OD-R5-10 で必須と明記）。
- **e2e（4 viewport: 390×844 / 360×800 / 390×664 / 360×640）**: 同一 run 内で entry あり/なしの stage 直径・dock 高さ差 ≤ 0.5px（R3 の 1.5px は sanity bound として据え置き）。R3 の基準 JSON は Chromium 絶対 px の sanity 用のみ。`layout-contract.spec.ts` の 7 profile の stage 下限表が無変更で green。

### 5.3 mutation 候補（M51〜）
M51 gate を `dockReserve.pager` に戻す / M52 worthwhile を hand 長・page 数から算出 / M53 `utilityRow` の eligible ガードを外す / M54 閾値 `>=6` / M55 worthwhile が在庫 0 を除外 / M56 worthwhile が pin 数に依存 / M57 `pager` を `utilityRow` から導出 / M58 非 eligible の `reservePagerRow` を `utilityRow` に / M59 `pantryAvailability` が recipes / discovery を import。

## 6. R5-b — Search + sheet layout（OD-R5-5 / OD-R5-8）

### 6.1 Search 契約（audit §6 + §21）
- **範囲**: active category の OWNED 行のみ（`queryCatalog({ shelves, text })` の AND）。cross-category・recipe・属性・fuzzy・operator なし。一致は `matchesSearch`（NFKC・カナ畳み込み・長音/空白/中黒除去、`nameJa`。本番に `readingJa` は無い）。
- **chip は text に依存しない**（chip 導出は text なしの OWNED 行）。検索で chip が増減せず、固定 slot が reflow しない。
- **表示条件（§21.2）**: category の OWNED 行が **≤ 6 なら search field を出さない**（> 6 で出す）。**選択中 strip は pin が 1 つ以上ある間だけ**（R5 production では休眠）。**collapsible strip は採らない**。
- **0 件文言**: 「該当する材料がありません」。未所持の名前・任意文字列・空でも DOM 同一（oracle にならない）。suggestion / autocomplete / 履歴 / 例示 placeholder なし。**件数表示・読み上げなし**（`aria-live` に数字を出さない。R4 と同じく live announcement なしでも可）。
- **reset**: close で text と shelf を両方 reset（pantry ローカル state、unmount）。text 変更・shelf 変更の両方で list `scrollTop = 0`。shelf 変更は text を消さない（AND）。× ボタン（44px）は text を消して field にフォーカスを残す。
- **Escape（OD-R5-8）**: R3 契約のまま、**field にフォーカス中でも sheet を close**。IME 変換中の例外は**設けない**（初版の例外は撤回）。close 後は entry にフォーカスを戻す（既存挙動）。外付 keyboard + 変換中 Escape の体感は HV 観察項目（§11 K-7）に留め、挙動変更が必要なら Owner に戻す。
- **入力属性**: `type="search"`（もしくは `inputMode="search"`）、`enterKeyHint="search"`、`autocomplete="off"`、`autocapitalize="off"`、`autocorrect="off"`、`spellcheck=false`、`maxLength` ≈ 20、**font-size ≥ 16px**（iOS の focus 時 auto-zoom 防止）。text は保存・ログ・dispatch しない。
- **IME**: 入力ごとに更新（composition 中に例外・誤った empty のちらつきを出さない）。確定後更新にするかは実機で違和感が出た場合のみ R5-b 内で調整（挙動の一部であり Owner 決定事項ではない）。

### 6.2 Sheet 高さ（OD-R5-5 に合わせて全面改訂）
**前提の訂正**: 初版は「sheet 外形は R3/R4 のまま（70dvh）+ search 固定 slot」を推奨し、上限拡大を「不可」としたが、**OD-R5-5 は逆方向**（利用可能 viewport 上限へ向けて拡大、固定値は事前に決めない）。70dvh は R3 の暫定値で、R3 note 自身が「#304 の上限へ上げるのは Human Feel の判断」と留保していた。**固定 70dvh を前提にしない。**

**Authority が決めていること / 決めていないこと**
| 決定済み | 未確定（R5-b が実測で確定）|
|---|---|
| 拡大の**方向**（利用可能 viewport 高さの上限へ）| 最終の高さ値・式（例: `100dvh − safe-top − 20px` = #304 ceiling そのまま / それ未満の安全上限）|
| search は必要時のみ、選択中は pin 存在中のみ、collapsible strip なし | keyboard 表示中の sheet 高さの扱い（下記候補）|

**不変にする invariant（PR #304 stable-height 契約の継承。測定の合否として使う）**
1. 与えられた viewport（と keyboard の状態）で、sheet の**外形 bounds は sheet 内の状態（search の有無・text・0 件〜多数件・shelf・pin 数）で変わらない**。変わってよいのは list の高さだけ。
2. header と 閉じる は固定、scroll するのは list のみ、chip 行 / strip は横 scroll のみ。body / page は scroll しない。safe-area（top / bottom）を侵さない。
3. 閉じる / × / chip / tile は 44px 以上。

**候補レバー（audit §10.3。値は決めない）**: L1 sheet 高を #304 ceiling まで引き上げる（audit 推奨 L1 + L3）/ L2 search を subtitle 行に同居 / L3 search・chip を必要時のみ（既に採用）/ L4 strip を 1 行の compact 表示。**keyboard 対策候補**: focus 中のみ `visualViewport` に基づき sheet の `max-height` を `min(既定, vv.height − 余白)` へ制限し、keyboard を閉じたら既定へ復帰。または search を keyboard の上に残る位置に置く構造。どれも**実機 HV の結果で採否**（採用しても keyboard 非表示時の外形は不変）。

**参考の概算（est. — R4 実測 + 算術。R5-b で必ず再実測）**: L1（ceiling = `100dvh − 20px`、emulation では safe-top 0）の場合
| viewport | sheet 高（R4 → L1 est.）| list 高: chip 有 | + search(≈52) | + strip(≈52) | tile 行数(@78px) |
|---|---|---|---|---|---|
| 390×844 | 590.8 → ≈824 | ≈669 | ≈617 | ≈565 | ≈7.2 |
| 360×800 | 560 → ≈780 | ≈625 | ≈573 | ≈521 | ≈6.7 |
| 390×664 | 464.8 → ≈644 | ≈489 | ≈437 | ≈385 | ≈4.9 |
| 360×640 | 448 → ≈620 | ≈465 | ≈413 | ≈361 | ≈4.6 |
実機の Safari は safe-area-inset-top（ノッチ等）と keyboard で利用可能高さがこれより小さくなる。**したがって最終値は emulation の ceiling ではなく実機 HV で確認した安全上限**になる。

**合否ガードレール（提案。authority の数値ではない）**: 4 viewport すべてで「search + chip + strip(forced-on) を全部載せても list が 2 タイル行以上」／keyboard 表示中に「search field と少なくとも 1 結果行が keyboard の上に見える」。下回る場合は Owner に案を戻す。

### 6.3 4 viewport 測定方法（実装フェーズで `e2e/large-catalog-pantry-search.spec.ts` 等を追加）
R4 spec と同型（幅ごと project 分岐、in-run 比較のみ）:
1. FREE・topping 22 所持・topping step で pantry を開く。sheet / header / 閉じる / search / chip / list の `getBoundingClientRect` を記録（**実測値そのものが Result Report の成果物**: 4 viewport の sheet 高・list 高・費用）。
2. search なし ↔ 文字あり ↔ 0 件 ↔ shelf 変更で sheet 外形が ±0.5px 同一（invariant 1）。strip は forced-on の別ケースで pin 0 / 1 / 多数を確認。
3. `ベーコン` / `べーこん` / `ﾍﾞｰｺﾝ` / `べこん` が同一行集合。text + shelf の AND。text 変更で chip 行不変。text / shelf 変更ごとに list `scrollTop === 0`。
4. stage / dock は search 操作の前後で不変（Δ ≤ 0.5px）。body / documentElement が scroll しない。Escape（field 内）で close → entry にフォーカス → 再 open で text 空・shelf「すべて」。
5. Chromium では keyboard を再現できない。viewport 高を縮めるエミュレーションは早期の破綻検知にとどめ、**keyboard 関連の合否は実機 HV が authority**（§11）。

### 6.4 mutation 候補（M60〜）
M60 text と shelf を OR / M61 正規化なしの生 `includes` / M62 検索を catalog 全体（LOCKED 含む）へ / M63 text を reopen で保持 / M64 text 変更で scrollTop 戻さず / M65 chip 導出に text を渡す / M66 **Escape が field 内で close しない、または IME 例外を入れる（authority 逸脱）**/ M67 search 表示条件の両端（≤6 で表示・>6 で非表示）/ M68 0 件文言に「未所持」「N 件」/ M69 search を scroll 内に配置 / M70 text を state / storage へ保存 / M71 入力 font-size < 16px / M72 sheet 外形が search・pin 数で変わる（invariant 1）/ M73 collapsible strip の導入。

## 7. R5-c — Direct pin editing（OD-R5-2 / -3 / -6 / -9）

### 7.1 State（OD-R5-9）
- **App-level `HandSession`**（`App.tsx`、`selectedIngredientId` と同階層）。`GameScreen` は `handSession` と `onHandChange(next)` を受け取るだけ。**writer は pantry のみ**（`onHandChange` 経由）、`App` が値を所有、`IngredientTray` は解決済み hand を読むだけ（audit §4 の one-writer 規則）。
- 寿命: round 終了 / HOME / FREE 再開を跨いで保持、reload / app 再起動で消滅、save に一切書かない（`sanitizeHandSession` を入口に）。所持変更に対し `pruneHand`（open 時と round 開始時）。**full game reset 時に空へ戻すか**は OD-R5-9 が触れていない実装詳細（既定: `emptyHandSession()` に戻す。所持外 pin は `pruneHand` でも落ちる）。R5-c 着手時にテストで固定する。
- eligible ガード: ハンドラは先頭で `isLargeCatalogEligible` を検査し、非 eligible では何もしない。`resolveHand` は非 eligible で `null`（既存）。**前 FREE round で作った pin が Dinner の tray を変えない**ことを最強の隔離テストにする（session pin が新しい cross-mode state のため）。
- production ではこのハンドラは到達不能（§4.4 休眠）。App-level state は常に空。

### 7.2 add / remove と在庫 0（OD-R5-6 — D-c1 解消）
- 操作は Model D: tile を toggle button 化（`aria-pressed`、44px 以上）し `addToHand` / `removeFromHand` を直接呼ぶ。pending picks や commit ボタンは作らない。pantry の **active category のみ**（cross-category なし）。
- **inventory 0 の tile は新規 pin 不可**（`aria-disabled` + 可視「ざいこなし」。色だけに頼らない）。**guard は pantry（UI 層）に置き、`handSession` の pure 層は変更しない**（audit §8.5。R2 の API と既存テストを壊さない）。remove は常に可能。
- **既存 pin は R2 contract のまま**: 調理で在庫 0 になっても pin は残る（`workingSet` の「placed / pinned は在庫 0 でも保持」）。所持外・別 category の id は `sanitizeHandSession` / `acceptable()` / `pruneHand` が落とす。save schema 変更なし。

### 7.3 hand 構成の契約（OD-R5-3、audit §8.2–8.6）
- hand = placed > pinned > … > fill（R2 の順）。**strip は pin（明示部分）を表示し hand 全体ではない**。tile の 3-state cue: 手元に固定 / 手元（自動）/ 印なし（cue は休眠 UI の一部）。tray の並びは **catalog 順**（pin で無関係な tile が動かない。必須テスト）。
- **容量超過**: pin + placed が capacity に達したら add を**ブロック**、eviction なし、中立メッセージ（audit の文言案: 「手元がいっぱいです。外してから追加してください」）。capacity 表示・この文言はいずれも休眠 UI（production 非表示、OD-R5-7）。
- **placed 材料の保護**: 配置ずみは pin/remove 不可（`aria-disabled`、「配置ずみ」）。capacity を消費する。`placed > capacity` でも placed は全部保持（`overflowIds` は pin のみ）。`placedIds` の `GameState` 上の出所は audit §20 の to-verify（R5-c 着手時に reducer の `pizza` 形状を確認し、`GameScreen` から渡す。pantry が reducer 内部を読まない）。
- クリア: 「おまかせに戻す」（`replaceHand(session, [], ctx)`、pin のみ）。
- capacity は引数（`handCapacityFor`）。**UI 文言・layout に 12 を hard-code しない**（OD-R5-1）。

### 7.4 テスト・mutation
- unit: toggle add/remove・順序保持・shelf/search を跨いで保持（OD-2）・strip は filter で消えない・在庫 0 新規 pin 拒否 / 既存 pin 保持・placed 保護・容量超過ブロック・per-category 独立・`sanitizeHandSession` に不正入力・App 寿命（round / HOME / FREE 再開を跨ぐ・reload 相当で空）・非 eligible で不変・Dinner 隔離。
- boundary: pantry / pin 経路は recipes / matcher / hint / persistence を import しない（allow-list 拡張: pantry は `handSession` の操作のみ追加可）。
- mutation（M74〜）: 未所持 id を add / 別 category に add / **UI が在庫 0 の新規 pin を受理** / remove が no-op / pin を storage・save へ / 非 eligible で state 変化 / `pruneHand` 除去 / **placed を remove 可能** / 容量超過で pin を eviction / tray の並びが source 順 / **production で pin UI が描画される（`handEditing=false` で描画）** / capacity 文字が production に出る / 12 の hard-code / production 経路が `enforced: true` を渡す / `HAND_ENFORCEMENT_ENABLED` 反転。

## 8. R5-d — Tray が hand を消費（休眠）+ #197 page-level 契約（§21.1）

### 8.1 契約（§21.1 を逐語で反映）
| # | 契約 |
|---|---|
| P1 | `selectedIngredientId` は **pantry の open / close・shelf 変更・search 変更・pantry scroll・Builder の visible tray を実際には変えない pin 変更**では clear しない |
| P2 | clear 判定は **HAND enforcement が Builder tray の visible set を実際に変える瞬間のみ** |
| P3 | hand 変更後、tray は **page 0** に戻る |
| P4 | 変更後、選択が**現在 visible な page**に無ければ clear、有れば維持。**「hand のどこかにある」では不十分**。authority は現在 visible な tray page |
| P5 | R2 の hand-level `selectionAfterVisibleChange` をそのまま配線しない。**page-level の実装**（入力 = 現在 visible な page の ids と変更後 page 0 の ids）|
| P6 | OD-2: pin は filter / search / shelf で clear されず、`selectedIngredientId` とは別 state。pantry は `selectedIngredientId` を set しない |
| P7 | enforcement OFF（R5 production）では hand が tray の visible set を変えない → page reset も clear も**発火しない**（tray の DOM・page state 不変）|

audit §7 rule 2 の「一度も visible でなかった選択（別 category）は放置」は §21.1 の「visible page に無ければ clear」と文言が異なる。**§21 を優先**して P4 を実装する。実害が出ない根拠: `App` は step / round 変更で `selectedIngredientId` を必ず set/clear し（`App.tsx:~290 / ~317`）、pantry は active category のみ編集するため、hand 変更の瞬間に選択が別 category になっている状態は通常到達しない。**この到達不能性を App レベルのテストで固定**し、到達し得ると分かったら Owner に戻す（G-d、§14）。

### 8.2 実装場所
- tray が page state を持つので、page reset と clear は **tray 内**で行う（App は page を知らない）。tray は「直前の visible page の ids」を保持し、hand 由来の visible items が変化した時だけ page 0 へ戻し、page-level 判定が null なら既存の `onClearSelection()` を呼ぶ。effect 駆動の clear は 1 frame 遅れて「選択が残った tray」が見えるため、`makingStepToken` と同じ render 中導出パターン or 同期ハンドラで行う。
- pure 側に **page-level helper**（audit §5 の `handTray`）を追加: hand → tray page items（catalog 順）、page-level の selection-after-change。R2 の hand-level 関数は残す（unit テストは既存のまま）。
- tray の item 源は `enforced=false` で従来の `trayIngredientsFor()`（休眠）。`enforced=true`（テストのみ）で `resolveHand` を消費し、pager は hand 数から。**`utilityRow` は R5-a の authority のまま**（pager が消えても entry と予約行は残る）。
- R4 の boundary test（`selectionAfterVisibleChange` の import 禁止）は「tray 内のみ許可、pantry からは禁止」に更新。

### 8.3 テスト・mutation（M87〜）
- forced-on unit: page 1 の選択 + hand 変更 → page 0 へ、選択が page 0 に無ければ clear / 有れば維持。**whole-hand には有るが visible page に無い**ケースで clear（hand-level 実装を殺す）。
- 非発火: shelf / search / open / close / scroll / **visible set を変えない pin 変更（`enforced=false` を含む）**で `onClearSelection` 0 回・tray DOM と page 不変。
- e2e: page 2 の材料を選択 → pantry で検索・shelf → 閉じる → **選択と page 保持**（production 相当）。forced-on: pin 変更 → page 0・stage/dock 不変。
- mutation: M87 shelf/search で clear / M88 hand 変更で page を戻さない / M89 whole-hand 基準で判定 / M90 `enforced=false` でも page reset / M91 pantry open・close で clear / M92 選択が消えた page に残る / M93 pantry が `selectedIngredientId` を set。

## 9. R5-e — 選択中 presentation・privacy・統合 Gate

### 9.1 presentation（休眠 UI。`handEditing=true` のテスト経路で検証）
- 選択中 strip: pin が 1 つ以上ある間だけ 1 行（横 scroll、各 44px、× で remove）。**collapsible にしない**（OD-R5-5）。pin 0 で slot を出さない。strip の高さ（≈52px est.）は list が吸収し、sheet 外形は不変（§6.2 invariant 1）。
- tile: 色だけに頼らない（📌 + 「選択中」テキスト + `aria-pressed`）。tray の `ingredient-chip--selected`（`selectedIngredientId`）は不変で、pantry に反映しない（OD-2）。
- 「選択中 n/cap」: 許可だが休眠（OD-R5-7）。**cap は引数由来**で、production では描画されず、forced-on では 12 と 9 の両方で検証（hard-code 検知）。
- **strip の高さ予算は R5-b の高さ確定時には production で描画されない**ため、R5-b では算術（≈52px est.）で余白を確保し、R5-e の forced-on 4 viewport 実測で再検証する。不足なら値を実測で見直す（新しい決定事項ではない）。

### 9.2 統合 Gate
| Gate | 内容 |
|---|---|
| enforcement | `HAND_ENFORCEMENT_ENABLED === false`（unit + source-level）。production build（`dist/`）に capacity 文言・pin UI・hand 消費が描画される経路が無い（R4 と同じ dist 検査を拡張）|
| dormancy | `handEditing=false` の production 経路で pin toggle / strip / cue / capacity が DOM に無い。tray は byte-for-byte 従来（rollback の回帰テストを保持）|
| 単一 switch | 新しい const / env / opt-in が増えていない（source-level: `HAND_ENFORCEMENT_ENABLED` が唯一）|
| privacy | §9.3 |
| accessibility | §9.4 |
| regression | §10.2 |
| mutation | §10.3（M1〜M50 + 新規、全 killed）|
| Human Verification | §11（R5 で production 表示される面）|

### 9.3 privacy（Hint 5.0 不変、OD-R5-11）
- pantry / search / pin / tray 配線が import してよいのは `catalog/*`（pure）・`data/ingredients`・`data/ingredientShelf`・`state/inventory` のみ。`recipes` / `discovery/*`（matcher・hint5Ladder・hint5Flag）/ near-miss / mission / Dinner target は boundary test の allow-list 外。
- hint は `NO_DISCLOSED_HINTS` のまま。**Hint 5.0 → pantry の preset / deep link / chip ハイライトなし**（OD-R5-11）。hint sheet と pantry は相互排他の overlay で、pantry は hint state を読まない（import テスト）。shelf ラベルを Hint 5.0 のラベル・記号に寄せない（chip がヒントの答えに見えるため）。
- search は oracle にならない（LOCKED / 未購入 / 任意文字列で同一の 0 件表現）。suggestion・履歴・placeholder に材料名を出さない。text / pin 順 / shelf はどこにも保存・送信しない。
- 数字は `×n`（自分の在庫）のみ。R5 production では capacity 系の数字なし。件数・shelf 別件数・「隠れている N 件」なし。

### 9.4 accessibility
search: `aria-label="材料を検索"`（例示なし）、`role="search"`、× は「検索をクリア」。pin toggle: `aria-pressed`、disabled（placed / ×0）は `aria-disabled` + 可視説明。フォーカス: open → 閉じる（既存）→ search → × → chip → strip → list → tile。close → entry に戻る（pin / search 後も e2e で検証）。cooking inputs は open 中は停止（既存）。`prefers-reduced-motion` で新規アニメなし。tile タップは `click`（`pointerdown` にしない）で、list の touch scroll が pin を toggle しないことを e2e で検証。

## 10. 検証マトリクス（R5 全体）

### 10.1 自動テスト
| 層 | 対象 |
|---|---|
| Vitest | `pantryWorthwhile`・`prepareDockReserve` golden・`IngredientPantry.*`（search / pin / strip / dormancy）・App の pin 寿命・tray page / clear・boundary allow-list（R4 baseline: 246 files / 4861 passed）|
| Playwright Chromium | 新規: availability / search / pins（forced-on）/ #197。既存: pantry-shell, pantry-shelves, free-cooking-phase3-2, dinner-mission, stage-size-stability, layout-invariants-lb, layout-contract（7 profile）, inventory-modal-stable-bounds, discovery-hint-sheet, discovery-hint5-ladder, lunch-rush-*, making-ui-1screen, viewport-1screen（390×844 / 360×800 project + 4 viewport spec）|
| WebKit | CI の Gate（sandbox 不可）。新規 e2e は in-run 比較のみ |
| 型 / lint / build | `tsc -b`、`oxlint`、`vite build`（+ dist 検査）|

### 10.2 回帰ゲート（毎スライス）
Dinner（tray / dock / stage / settlement）・guided・Lunch Rush・Hint 5.0（ladder sheet / near-miss / k≥2）・Inventory / Shop の shelf・save 互換（`save-forward-compat-3-4b`, `save-dinner-records-dm4-2`。**save 差分 0**）・cut / bake。

### 10.3 mutation gate
`tools/large-catalog-ux/mutation-check.mjs` に M51〜（§5.3 / 6.4 / 7.4 / 8.3 + 統合 Gate の dormancy / 単一 switch）を追加。全 killed が merge 条件（生き残りは R4 の M50 のように source-level assertion で殺す）。番号は実装時に再採番してよい。

## 11. iPhone 実機 Human Verification 計画

CLAUDE.md / HV Policy に従い、動画（390×844、Owner へ直接提出、**repo に commit しない**）+ before/after スクリーンショット（`docs/reports/screenshots/<task-name>/` に commit）+ Result Report（Policy §10）。**OD-R5-5 により、この実機 keyboard HV が sheet の安全な最大高さを確定する authority**（Chromium では keyboard を再現できない）。

### 11.1 端末・環境
主: 390×844 級 iPhone（14/15/16 相当）、Safari（Chrome iOS ではない）、Preview デプロイ。小型: 375×667 / 375×812 級（Safari 可視高が 360×640 級になる状態）。日本語 IME（ひらがな / カタカナ / 全角半角）。準備: topping 22 所持・sauce/cheese 各 10 所持の save（Preview seed）、Dex ありの FREE。**R5 の HV 対象は production で表示される面**（entry 分離・search・sheet 拡大・shelf）。休眠 UI（pin / strip / cue / capacity）は R5 では forced-on の Chromium 証跡に限り、実機での親指・誤タップ確認は R6 Gate（下記 K-16）。

### 11.2 チェックリスト
| # | 項目 | 合格条件 |
|---|---|---|
| K-1 | FREE → topping step → 食材庫を開く | 開いても stage / dock が動かない（R5-a の Δ0 の体感確認）|
| K-2 | 拡大した sheet の見え方 | safe-area を侵さず、header / 閉じる が見える。実機の上端・下端の余白を記録（安全最大高さの根拠）|
| K-3 | search focus | keyboard 表示。**search field・閉じる・chip が keyboard の上で見える**。画面全体が上下にズレない。見える結果行を記録 |
| K-4 | 日本語入力（ひらがな→変換→確定、カタカナ、半角ｶﾅ）| 変換中 / 確定で list が想定どおり絞られ、操作不能にならない（IME 更新タイミングの違和感があれば記録）|
| K-5 | list scroll（keyboard 表示中 / 閉じた後）| list のみ scroll、body / page は scroll しない |
| K-6 | shelf chip 変更（search 文字あり）| AND で絞られ、list は先頭へ、chip 行・search 欄は動かない |
| K-7 | Escape / 閉じる / 背景タップ | 閉じる・背景で close。**Bluetooth keyboard があれば field フォーカス中の Esc でも close**（OD-R5-8）。変換中 Esc の体感を記録（挙動は変えない）|
| K-8 | close 後 focus | entry ボタンに戻る |
| K-9 | **keyboard を閉じた後の layout 復帰** | sheet の高さ・位置・list が open 直後と同一。stage / dock に残骸なし |
| K-10 | body scroll なし | focus / keyboard 開閉で page が動かない |
| K-11 | reopen | search 文字空・shelf「すべて」・list 先頭 |
| K-12 | tray 選択との独立 | tray で材料選択（page 2 上）→ 食材庫で search・shelf → 閉じる → **選択と page が保持**（#197 P1）|
| K-13 | 小型 iPhone で K-2〜K-11 を再実施 | list が 2 行未満にならない、閉じる / search が押せる |
| K-14 | 誤タップ感 | × / chip / tile の隣接タップで誤爆しない（片手・親指）|
| K-15 | Dinner / Lunch Rush / guided を 1 周 | 食材庫 entry なし、tray / stage が従来どおり |
| K-16 | *(R6 Gate、R5 対象外)* pin add/remove・strip・capacity 表示・tray の hand 反映 | R6 で enforcement を有効にしたビルドで実機確認（§12）|

### 11.3 提出物
動画 1 本（K-1〜K-12、390×844、各状態 1〜3 秒保持）+ 小型端末動画（K-13）+ 4 viewport の before/after スクリーンショット + Result Report（4 viewport 実測表: sheet 高 / list 高 / 費用、keyboard 表示中の可視領域、確定した最大高さの式とその根拠）。実機が使えない場合は「実機未確認」を Result に明記し、Owner 実機確認を merge 条件に残す（H5-5 方式）。

## 12. R6 Gate と 9 vs 12 Human Feel Gate

**位置づけ**: OD-R5-1 により 12 は現設計候補、final は R6 実機 Human Feel Gate 後。`HAND_ENFORCEMENT_ENABLED=true` は R6 Gate 通過後のみ（OD-R5-12）。R5 は 12 を想定して設計・検証し、9 も parametrize して hard-code を検知する。

### 12.1 R6 enablement Gate（audit §16 をそのまま採用）
到達性（全 OWNED が hand または pantry ≤ 1 open + ≤ 1 tap で到達、12 / 22+ / 62 fixtures、在庫 0・placed 含む）／entry independence（4 viewport で stage / dock / pager 行不変）／#197 page-level／placed 保護・容量超過・×0／tray 順序安定・page 0 reset／**capacity 確定（OD-R5-1）+ 実機 thumb / mis-tap 確認**／privacy／Dinner・guided・Lunch Rush 不変／iOS keyboard 実機／WebKit green／HV 動画 + Owner の Human Feel 承認／rollback = flag（false で tray が byte-for-byte 従来）。cross-category・hint deep link・save 永続化・counts・62 catalog activation・Dinner は R6 の必須外。

### 12.2 9 vs 12 の構造的事実（audit §9 + 既存コード）
- page 容量は 6 固定で dock 予約は page 単位 → **stage / dock の幾何は 9 でも 12 でも同一**（R2 実測 + R6 で再確認）。差は「hand に載る数」「page 数（9: 6+3 / 12: 6+6）」「pantry 送りの数」。
- 62 catalog では sauce / cheese が各 10: 9 だと hand が active（sauce 選択で材料を隠す）、12 だと inactive。これが 12 を推す決定的根拠（audit）。

### 12.3 比較項目と測り方
| 項目 | シナリオ | 指標 / 手段 |
|---|---|---|
| A. sauce / cheese 10 材料 | 各 10 所持 | 9 で pantry 送りになる材料の探索回数・pantry を開く回数/ピザ（HV タスク）|
| B. topping 大量 | 22 / 30 所持 | 目的材料までの操作数と時間（page 送り + pantry）|
| C. pager | page 2 の中身（9: 3 個 / 12: 6 個）| page 送り回数、page 2 の体感（5 段階）|
| D. pantry を開く回数 | 標準タスク 3 種 | 回数/ピザ、pin 追加回数（DEV 計測、保存しない）|
| E. 誤タップ | 標準タスク | 選び間違い → 取消の回数（動画 + DEV カウンタ）|
| F. 片手操作 | 390×844 / 375×667 右手親指 | 親指圏（画面下 ~55%）で完結する操作割合 |
| G. 360×640 | Safari 可視高最小 | 全操作が完結・list ≥ 2 行・閉じる / search が押せる |
| H. stage 幾何 | 7 profile | 9 と 12 で dough 直径・dock 高さ差 ≤ 0.5px（差が出たら設計違反）|

### 12.4 判定基準（事前に Owner が承認する。数値は提案）
1. **足切り**: G・H・privacy / a11y 回帰なし。
2. **12 を採用**（すべて）: A で sauce/cheese 10 の pantry 依存 0（9 は ≥ 1）／B で 12 が 9 より悪化しない／E の誤タップが増えない／F で page 2 の 6 個が親指圏。
3. **9 を採用**（いずれか）: 12 で B・E が有意に悪化（目安 +20% 超）／「多すぎて選べない」の主観評価が 12 で悪い／pin 運用が 9 で自然に回る（pantry ≤ 1 回/ピザ）。
4. **同点は 12**（OD-R5-1 の現候補）。**final は Owner**（AI は推奨まで）。

## 13. Slice plan（更新版）

audit §15 の slice 構成は提案で、OD-R5-12 が確定しているのは範囲（wiring / search / pin editing / #197 / entry separation）。本書は依頼の a〜e 名称を保ち、audit との対応を明記する。

| Slice | 内容 | 主な変更（予定）| 前提 | audit §15 対応 | 完了条件 |
|---|---|---|---|---|---|
| **R5-a** | availability 分離（`pantryWorthwhile` / `utilityRow`）、`enforced` seam の導入（const は反転しない）| `pantryAvailability.ts`（新）、`prepareDock.ts`、`GameScreen.tsx`、`handSession` / `handPolicy` に既定引数のみ、boundary / golden テスト | §2 着手ゲート | R5-a | Δ0 証明（§5.2、4 viewport）、隔離 golden、M51〜M59 killed |
| **R5-b** | search + sheet 高さ（OD-R5-5）、Escape（OD-R5-8）| `IngredientPantry.tsx`、`App.css`（sheet 高の変更を含む）、search e2e | R5-a merge | R5-b | 4 viewport 実測で最大高さの式を確定、実機 K-1〜K-15、M60〜M73 killed |
| **R5-c** | App-level `HandSession`・pin ハンドラ・tile toggle・在庫 0 guard・placed 保護・容量超過（**休眠 UI**）| `App.tsx`、`GameScreen.tsx`（`handEditing` を const から供給）、`IngredientPantry.tsx` | R5-a（b は独立）。G-c（§14）は e2e の forced-on が要る R5-e までに | R5-c | §7.4 のテスト、M74〜M86 killed、production で pin UI が出ないことの検証 |
| **R5-d** | tray が hand を消費（休眠）+ page reset + page-level #197 | `IngredientTray.tsx`、page-level pure helper、boundary 更新 | R5-c | R5-d | §8.3、M87〜M93 killed、production tray は byte 同一 |
| **R5-e** | strip / cue / capacity 表示の presentation（休眠、forced-on で検証）+ 統合 Gate + 検証 | presentation、統合 e2e、dist 検査、Result | R5-a〜d、G-c | R5-c の strip 部分 + R5-e | §9.2 全 Gate、Result Report、実機 HV（表示面）、forced-on 証跡 |

各スライスの Result は `docs/reports/TETO_LARGE-CATALOG-UX_LC-R5{a..e}_*_Result.md`（R3 / R4 と同形式）。`PROJECT_HANDOFF.md` の Large Catalog UX 節は各スライスの docs で更新。PR は Owner の go まで作成しない。

## 14. 未決事項の再判定

### 14.1 結論
**R5 の実装開始を止める Owner Decision は残っていない。** OD-R5-1〜12 と §21.1 が範囲・契約を決めており、OD-R5-1（capacity 最終）は R6、OD-R5-5（sheet 高さの値）は R5-b の実測と実機 HV で確定するとの定義が authority 自身にある（未決ではなく「決め方が決まっている」）。

| 旧 ID | 状態 |
|---|---|
| D0（OD-R5 原本の所在）| **解消**（§0）|
| D-c1（在庫 0 pin）| **解消**（OD-R5-6）|
| D-c3（pin UI を production に出すか）| **再判定済み**（§4）: 既存 authority と整合する読みは「**休眠**（単一 const に紐づく）」。Preview-only compile-out は確定しない。反転コストは小（§4.5）|
| D-c2（pin 寿命）| 解消（OD-R5-9）|
| D-c4（容量超過 UX）| audit §8.2 の契約を採用（休眠 UI 内で実装）|
| D-a1 / D-b1（閾値 > 6）| authority 記載（audit §6.7 / §10.1、§21.2）|
| D-b2（Escape）| 解消（OD-R5-8）。初版の IME 例外は撤回 |
| D-b4 / D-e1 / D-e2 | 解消（counts なし・pin 存在中のみ strip・collapsible なし・選択を pantry に反映しない）|

### 14.2 R5 着手後に閉じる項目（Owner Decision ではないが、条件付きで Owner に戻す）
| ID | 内容 | いつ | Owner に戻す条件 |
|---|---|---|---|
| **G-c** | 休眠 UI を e2e（real layout）/ HV で on にする**手段**。候補: (m1) unit のみ（prop / 既定引数）— layout 検証に不足 / (m2) DEV server 限定 seam（`import.meta.env.DEV` の型 ③、production では compile-out、`previewIsolation.gate.test.ts` の走査対象に追加）/ (m3) test 専用 build define。**本書は選ばない** | R5-c 着手前に候補を Pre-Implementation で評価、R5-e までに確定 | 採用案が **Preview デプロイから到達できる runtime opt-in**（URL / localStorage）を増やす場合、または production から到達可能な切替になる場合 |
| **G-d** | hand 変更の瞬間に選択が別 category になり得ないことの App レベルテストによる確認（§8.1）| R5-d | 到達し得ると判明した場合（§21.1 の逐語と audit §7 rule 2 のどちらを採るか）|
| **G-e** | `placedIds` の `GameState` 上の出所確認（audit §20 item 5）| R5-c | reducer 形状が想定と大きく違う場合 |
| **G-f** | full game reset で pin を空に戻すか（OD-R5-9 が触れない実装詳細。既定: 空に戻す）| R5-c | — （テストで固定するのみ）|
| **G-g** | 拡大後の sheet が実機 safe-area・keyboard で安全上限に収まるか | R5-b | ガードレール（§6.2）を下回る場合 |
| — | §4 の「休眠」の読み（逐語では OD-R5-7 が capacity のみ明示）| R5-e の統合 Gate 前 | Owner が「pin UI も R5 production に出す」意図だった場合のみ（§4.5 の 1 箇所変更）|

## 15. FINAL VERDICT

**A. R5 IMPLEMENTATION PLAN READY**

- Authority（branch `claude/lc-r5-fresh-audit-z4bga9` / commit `b584b7a`、§21 優先）を実物で確認し、D0・D-c1 を解消、D-c3 を OD-R5-12 と既存 gating architecture（単一 const `HAND_ENFORCEMENT_ENABLED`、既定引数 seam）で再判定、OD-R5-5 と食い違っていた sheet 高さ計画・OD-R5-8 と食い違っていた Escape 例外を訂正した。
- R5-a は #306 の WebKit green（本書時点で未確認）後に着手可能。R5-b〜e は §13 の順序。着手を止める Owner Decision はなし。G-c 〜 G-g は実装フェーズ内で閉じる項目で、§14.2 の条件に該当した場合のみ Owner に戻す。
- 留意: 「pin UI を production で休眠させる」読みは、§21 が逐語で明示している capacity UI 以外については audit §8.6 / §15 / §21.2 と OD-R5-12 からの整合的な導出である（§4.2、反転コストは §4.5）。
