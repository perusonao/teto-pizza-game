# Progression 2.0 W1 — Integration Preflight

- 種別: READ-ONLY の統合監査。変更は docs / tools だけ。`src/**` / `e2e/**` / `.github/**` は変更していない。PR は作らず、merge もしていない。P2 / RT-01c / MD-01 fixture / Discovery Ladder には着手していない。
- 監査日: 2026-09-25。過去の session report ではなく、GitHub の実状態（`git fetch` + GitHub API）から開始した。
- 機械可読: `docs/reports/data/TETO_PROGRESS2_W1_INTEGRATION_PREFLIGHT.json`
- checker: `python3 tools/progression2_w1_integration_preflight.py --check [--live]`
  - pin した SHA の git object だけを読む（working tree に依存しない）。
  - code probe 42 件、`git merge-tree` 15 通り、main の事実 7 件、negative control 2 件、Owner Decision record との照合、JSON のバイト一致を確認する。
  - `--live` は remote の branch tip が pin から動いたかを報告する（今回: drift なし）。

## 結論

| 判定 | 結果 |
|---|---|
| **P2**（7 ingredient の production 登録） | **NOT READY** — READY 0 / WAITING 7 / BLOCKED 0 |
| **W1 IMPLEMENTATION**（10 recipe の production 登録） | **NOT READY** — READY 0 / WAITING 10 / BLOCKED 0 |
| 残っている Owner Decision | **0 件** |
| **NEXT IMPLEMENTATION SLICE** | **I0: Save forward-compat（#206 を main に載せる）** |

- 以前の「0 READY / 10 REVIEW / 0 BLOCKED」は、authority の review が残っているという意味だった。REC-01〜04、RT-01、MD-01 の authority が揃ったので、**10 件とも REVIEW → WAITING**（残っているのは実装と統合の作業だけ）に変わった。BLOCKED は 0。
- NOT READY の理由は、判断の不足ではない。**main に次の 4 つがまだ無い**ことが理由。
  1. unknown id を保存し続ける save 層（#206）
  2. Discovery Ladder / パック economy
  3. IngredientGlyph（P1）
  4. Completion Gate G1（#222）と RT-01a/b
- 新しい判断は求めない。実装の既定値（§K）は、承認済みの値を変えないものだけにした。

## 0. 監査開始時の GitHub HEAD

| 対象 | ref | HEAD | 状態 |
|---|---|---|---|
| main | `main` | `1e53baa88f390bf6d8f52647e7c65cc279eb2567` | #223（CI のみ）が最新 |
| Production Visual P1 | `claude/w1-ingredient-visual-preview-mt4uxw` | `802b023d0753eebd9bd4222d21f5fa33424df5d6` | branch のみ（PR なし）。base は `dff233c`（main より 1 つ前。差は CI だけ） |
| REC-01〜03 | `claude/w1-fresh-audit-rec-6u420b` | `35bc937556ba6df0b4458c8bffbecc95b9058c92` | branch のみ。docs / tools |
| REC-04 | `claude/rec-04-fresh-design-gz6em4` | `6fe02e2d23610e926bab2367405fe9f717d25421` | branch のみ。docs / tools（Fresh Design は `2e19415`） |
| RT-01 | `claude/rt-01-pizza-piece-capacity-1ncicd` | `63d3acfd9410dbdac5b53e2a506a850a6f5e2871` | branch のみ。base は現在の main。`745fbd7` → `e708dd2` → `afcce51` → Human PASS `63d3acf` |
| #205 | `claude/progression-2-0-phase-3-4a-km8q1c` | `9035606` | OPEN。main から 28 commit 遅れ |
| #206 | `claude/progression-2-0-phase-3-4b-y8g73a` | `edfca8b` | OPEN。28 遅れ。CI（build + WebKit 4 shard + Gate）は green |
| #222 | `claude/completion-gate-partial-quantity-7myahx` | `81a850c`（実装は `9abe481`） | OPEN。1 遅れ。build と WebKit Gate は success |
| #218 | `claude/completion-gate-audit-7rqylp` | `5105771` | OPEN。docs のみ |
| #217 | `codex/issue-216-fresh-design` | `a39932d` | OPEN。docs のみ |
| #220 / #221 | codex branches | `e49dab9` / `070afc0` | OPEN。docs のみ |
| #214 | `claude/teto-pizza-p3-4c-decision-foc6x9` | `5c1d6f0` | OPEN。docs のみ |

owner / 以前の session が挙げた 11 個の commit（`39ce35c`、`802b023`、`3fc02a0`、`35bc937`、`2e19415`、`6fe02e2`、`745fbd7`、`e708dd2`、`afcce51`、`9abe481`、`4c1da87`）は、すべて記載どおりの branch から到達でき、**main には 1 つも入っていない**（checker で確認）。

## A. Branch dependency graph

「OPEN なので未実装」とは判定していない。どれも実際の diff と code probe で確認した。

| 項目 | 場所 | 実体 |
|---|---|---|
| Production Visual P1 | **branch のみ** | src の変更は 1 commit（`39ce35c`、11 files）。dedicated visual は 3 つ（`tomato-slice` / `caper-cluster` / `clam-valve`）。W1 ingredient の row は **登録していない** |
| REC-01〜03 | **docs のみ** | `35bc937`。Q1〜Q4 は APPROVED |
| REC-04 | **docs のみ** | `6fe02e2`。OD-REC04-1〜3 は CONFIRMED_OWNER_DECISION、verdict は RESOLVED |
| RT-01a/b | **branch のみ** | `getReferenceSlots` がある。`referencePizza.ts` / `recipes.ts` は main と同一（RT-01c は未着手） |
| #205 | **OPEN PR**（code） | headless の star gate 表と「1 pizza = 1 use」の economy。unwired。REC-04 と衝突する（§B） |
| #206 | **OPEN PR**（code） | `writeSave` による forward-compat（§C） |
| #218 | **OPEN PR**（docs） | #215 OD-1〜5 の根拠。runtime ではない |
| #222 | **OPEN PR**（code） | G1 policy、Q 係数、ruleset `phase-4a-2-shadow-4-quantity`。`recipes.ts` / `persistence.ts` / `referencePizza.ts` は main と同一 |
| #217 | **OPEN PR**（docs） | 有料解放の設計。W1 については REC-04（解放料 0）で置き換わった。OD216-3（capability）は W1 では不要 |
| MD-01 | **未実装** | fixture 0/10 |
| CUT allowlist | **未実装** | main は 15 件。W1 の 9 件はどこにも入っていない |
| W1 ingredient records | **未実装** | 0/7。main にも、どの branch にもない |
| W1 recipe records | **未実装** | 0/10。main にも、どの branch にもない |
| Discovery Ladder | **docs のみ** | REC-04 の生成 tool と JSON だけ |
| Shop / economy | **docs のみ** | main は、EP1 の recipe chain（`requiresRecipeId` + `minTotalStars`）、EP4 の starter grant、legacy の `pricePitz` / `restockQuantity` のまま |
| inventory / save 互換 | **OPEN PR** | main は unknown id を落とす。#206 は保持する |

### merge-tree（pin した HEAD 同士。checker が固定）

| 組み合わせ | 結果 |
|---|---|
| main ← P1 / RT-01 / #205 / #206 / #222 | 5 つとも **clean** |
| P1 × RT-01 | **CONFLICT 1 件**: `src/components/PizzaThumbnail.tsx`。隣り合った import 行と `PIECE_POSITIONS` の置き換えがぶつかるだけで、両方の変更を残せば解決する |
| その他の 9 組 | clean（P1 × #222 は `App.css` / `ResultPanel.tsx` を両方触るが、自動 merge できる） |

`39ce35c` を単独で cherry-pick する場合も、main には clean、RT-01 の上では同じ 1 file が conflict する。

## B. #205 audit

| 部分 | 判定 | 理由 |
|---|---|---|
| `PROGRESSION_INGREDIENT_UNLOCKS`（101 行、`minProgressionStars` の絶対値、60 / 100 / 140 / 180） | **OBSOLETE** | OD-REC04-1 で ⭐ は material の解放条件ではなくなった。価格は 60 / 80 / 100 / 120 に決まった。例: potato ⭐88 / 140 → ladder step 21 / T3 100 |
| `progressionIngredientState`（⭐ で LOCKED / AVAILABLE を決める） | **OBSOLETE** | 解放条件は Dex 発見数 ≥ step 番号 |
| `PROGRESSION_PURCHASE_GRANT_USES = 10` / `USES_PER_PIZZA = 1` | **OBSOLETE** | REC-04 はパックを保存単位の **10 × k** 個で持つ。1 pizza = 1 use は採らない |
| `progressionStars` = Σmax(2, BEST) | **material の解放には不要** | ⭐ は廃止しないので、ほかの gate で使う余地はある。W1 では使わない |
| refill = ceil(0.5 × price) | **使える** | OD-REC04-3 の補充 50% と同じ |
| 購入 / 補充の失敗理由の union、入力の sanitize、`OWNED` / `AVAILABLE_TO_BUY` / `LOCKED` の enum | **使える**（enum はもう main にある） | 形だけ借りる |

→ **#205 はそのまま merge しない。** I4a を fresh implementation にして、上の「使える」部分だけ形を借りる。#205 の扱い（close / supersede）は owner が行う。この preflight は PR を変更していない。

## C. #206 audit（実コードの比較）

REC-04 の「main は unknown ingredient の在庫を落とす」と、#206 の「unknown id の forward compatibility は対応済み」は、**どちらも正しい**。前者は main、後者は未 merge の #206 branch のことを言っている。矛盾はない。

| 対象 | main `1e53baa` | #206 `edfca8b` | P1 branch | RT-01 / #222 | 将来の統合 |
|---|---|---|---|---|---|
| unknown recipe の Dex entry | **落とす**（`sanitizeDexEntry`） | **保持**（形が正しい entry だけ） | main と同じ | main と同じ | I0 |
| unknown ingredient の owned id | **落とす** | **保持** | 同上 | 同上 | I0 |
| unknown ingredient の inventory | **落とす**（`sanitizeInventory`） | **保持**（非負整数だけ） | 同上 | 同上 | I0 |
| starter grant ledger の unknown recipe | **落とす** | **保持** | 同上 | 同上 | I0 |
| unknown な top-level field | **落とす**（`sanitizeSave` が known key だけで root を作り直す） | **保持**（そのまま書き戻す） | 同上 | 同上 | I0 |
| `unlockedForShopIngredientIds` | 落とす（unknown key） | 保持（B-2 test で固定） | 同上 | 同上 | I4b で known key にする |

- #206 の仕組み: 書き込みはすべて `writeSave` を通る。storage にある extras を読み直して追記する（known field が優先）。
- `schemaVersion` は 2 のまま。
- main の `persistence.ts` は、#206 の base（`d6b6ef9`）から **1 byte も変わっていない**（checker の fact）。そのため rebase で意味は変わらない。
- **検証**（この session で、main + #206 を merge した一時 worktree）:
  - `tsc -b` clean
  - vitest 2435/2435 PASS（`src/state` は 665/665）
  - `e2e/save-forward-compat-3-4b.spec.ts` を Chromium（iphone-390x844）で 1/1 PASS
- **順序の制約**: 新しい id を出す build が壊れたときの rollback 先が、すでに #206 を含んでいなければならない。つまり I0 は、W1 の id を出す release より **少なくとも 1 回前に deploy** する。

## D. #222 / Completion Gate

- W1 に必要な commit は **`9abe481`（実装）と `81a850c`（Known Limitation の docs）の 2 つだけ**で、PR の全部。#218（docs の audit）は main に入れなくてよい。
- main との差: src 25 files、e2e 1 file、docs 37 files。main には clean に merge できる。
- W1 との互換性:
  - 全具材が minCount ≥ 1 なので、G1（0 個だけが FAILED）と整合する。
  - Lunch Rush の注文数 = minCount（LR-A）。
  - MD-01 の fixture は理想の量なので、Q = 1。
  - ruleset の bump は fixture の digest に影響しない。
- CI: `81a850c` で build と WebKit Gate が success（WebKit の shard は `9abe481` で PASS。`81a850c` は docs だけなので skip）。
- **Human Verification**: 実装 session が 390×844 / 360×800 の動画を提出している。ただし、**owner の PASS は PR #222 にも Issue #215 にも記録されていない**。merge の前に記録が必要（I1 の gate）。merge するかどうかはこの preflight では決めない。

## E. Inventory unit

- 現行: scatter は個数、spread は回数（Save v2）。
- REC-04 は保存単位を変えない（units は CONFIRMED_OWNER_DECISION）。#214 D-2（M4 = 個数、migration なし）とも一致する。
- パック = 10 × k 個なので、今の単位のまま成り立つ。表示「ピザ10枚分（30個）」は k から計算できる。
- → **piece / portion の migration は W1 / P2 の blocker ではない。** 必要になれば後から k で在庫を換算できる。W1 とは独立している。

## F. P2 readiness（7 ingredient）

| ingredient | step | tier | 初回パック / 補充 🪙 | k | パック | visual | 判定 |
|---|---:|---|---|---:|---:|---|---|
| eggplant | 4 | T1 | 60 / 30 | 3 | 30 | emoji 🍆 | **WAITING** |
| corn | 9 | T2 | 80 / 40 | 3 | 30 | emoji 🌽 | **WAITING** |
| pineapple | 10 | T2 | 80 / 40 | 3 | 30 | emoji 🍍 | **WAITING** |
| clam | 19 | T3 | 100 / 50 | 3 | 30 | dedicated `clam-valve` | **WAITING** |
| fresh-tomato | 20 | T3 | 100 / 50 | 3 | 30 | dedicated `tomato-slice` | **WAITING** |
| potato | 21 | T3 | 100 / 50 | 3 | 30 | emoji 🥔 | **WAITING** |
| capers | 23 | T3 | 100 / 50 | 2 | 20 | dedicated `caper-cluster` | **WAITING** |

7 件とも、確認項目の状態は同じ。

| 確認項目 | 状態 |
|---|---|
| visual Human approval | DONE（7/7 HUMAN_PASS） |
| REC-04 | DONE（RESOLVED） |
| matcher / discovery | DONE（catalog は `RECIPES` から自動生成。25 target の probe で signature collision 0、W1 は全件 unique self-match） |
| canonicalization | DONE（fresh-tomato ≠ cherry-tomato。alias は禁止） |
| catalog | DONE（#220） |
| identity | DONE（topping / scatter） |
| Visual P1 | WAITING → I3（branch だけにある） |
| price tier / pack / step | WAITING → I4a（REC-04 の規則から導出済み。ただし main には ladder も価格 field もない） |
| save 互換 | WAITING → I0 |

- **BLOCKED は 0。**
- P2 は I0 + I3 + I4a の後に「ladder-dark」（W1 recipe がないので ladder の step もなく、プレイヤーには見えない）として単独で入れられる（I5a）。I5b と一緒に入れてもよい。
- main の今の model（`starterGrantOnly` + 星の unlock + legacy の価格）で登録すると、承認されていない値を作ることになる。**I4a より前には登録しない。**

## G. W1 recipe readiness（再計算）

| recipe | sauce | 焼き | 具材数 | CUT | 新 ingredient | step | RT-01 | 判定 |
|---|---|---|---:|---|---|---:|---|---|
| New Haven Apizza | olive-oil | 62–82 | 7 | なし | clam | 19 | N/A | **WAITING** |
| Hawaiian | tomato | **60–80**（正規化） | 7 | 6 切れ | pineapple | 10 | N/A | **WAITING** |
| Parmigiana | tomato | 58–78 | **9** | 6 切れ | eggplant | 5 | 必要 | **WAITING** |
| Bambino | tomato | 56–76 | 7 | 6 切れ | corn | 9 | N/A | **WAITING** |
| Pizza Portuguesa | tomato | 58–78 | **10** | 6 切れ | — | 12 | 必要 | **WAITING** |
| Puttanesca | tomato | 50–70 | **9** | 6 切れ | capers | 23 | 必要 | **WAITING** |
| Pesto Caprese | pesto | 50–70 | 7 | 6 切れ | fresh-tomato | 20 | N/A | **WAITING** |
| Pesto Tonno | pesto | 50–70 | 7 | 6 切れ | — | 17 | N/A | **WAITING** |
| Pesto Patate | pesto | 58–78 | 7 | 6 切れ | potato | 21 | N/A | **WAITING** |
| Melanzane | tomato | 58–78 | 7 | 6 切れ | eggplant | 4 | N/A | **WAITING** |

確認項目ごとの状態（10 件共通）:

| 状態 | 項目 |
|---|---|
| authority は解決済み | REC-01〜04 はすべて RESOLVED。値の出どころは REC-01〜03 の `final`（checker で照合。#221 との差は Hawaiian の焼きだけ） |
| WAITING → I1 | Completion Gate |
| WAITING → I2 + I5b | RT-01（3 件だけ） |
| WAITING → I5b | MD-01、CUT、焼き、量、scoring |
| WAITING → I0 | save |
| WAITING → I5a | ingredients（新材料を使う 8 件） |
| DONE | ingredients（Portuguesa と Pesto Tonno は main の材料だけで作れる） |

**READY 0 / WAITING 10 / BLOCKED 0**

## H. ham ×3

- 分類: **recipe ごとの数量**（Pizza Portuguesa の ham minCount 3。#221 で authored、Q1 + Q2 KEEP AUTHORED COUNTS で承認済み）。
- 既存の recipe は変わらない。main の ham は Capricciosa 1、Meat Lovers 1 のまま。
- economy への影響: OD-REC04-3 の「パック = 10 × k、k = その材料の最大 minCount」を当てはめると、W1 後の ham は k = max(1, 1, 2, 2, 3) = 3 で、パックは 30 個になる。Hawaiian と Bambino だけでも k = 2 になる。
- 結論:
  - **global な ingredient balance の変更ではない。**
  - **reference fixture だけの話でもない**（MD-01 の Portuguesa fixture にも ham を 3 個置く）。
  - REC-04 の JSON は `hamKChangeForW1` を `PROPOSED` としている。しかし実際は、承認済みの 2 つの決定から機械的に出てくる値なので、**Owner Decision は不要**。
  - 実装では、ham を手で直さず、I5b の ladder 再生成で recipe の集合から k を計算する。

## I. Integration order（最小の production slice）

依存関係:

```
I0 (#206) ─────────────┬──────────────┐
I4a (ladder headless) ─┼─→ I4b (economy wiring) ─┐
I2 (RT-01a/b) → I3 (P1)┴─→ I5a (P2 ingredients)  ├─→ I5b (W1 recipes, atomic) → I6 (release gate)
I1 (#222) ────────────────────────────────────────┘
```

| slice | 内容 | 依存 | 主な変更 file | risk | Chromium | WebKit | Human Verification | 順序の制約 |
|---|---|---|---|---|---|---|---|---|
| **I0** | #206 を載せる | なし | `persistence.ts`、forwardCompat test、save e2e | 低 | 必要 | 必要（Full + Gate） | 不要（UI なし） | 新しい id を出す release より 1 回以上前に deploy |
| I1 | #222 を載せる | なし | completionGate、scoringV2、reducer、Result / MissionServe、e2e | 中 | 必要 | 必要（merge した head で再実行） | **必要**（動画はある。owner の PASS の記録が必要） | I5b の前 |
| I2 | RT-01a/b を載せる | なし | `pizzaReferenceLayout.ts`、`playerReference.ts`、`PizzaThumbnail.tsx`、rt01 e2e | 低 | 必要 | 必要 | 済（FINAL PASS） | I3 より先が望ましい。I5b の前 |
| I3 | P1 を載せる | I2（順序だけ） | `IngredientGlyph.tsx`、呼び出し 8 箇所、`ingredients.ts`（型と optional field） | 低 | 必要 | 必要 | 済（FINAL PASS）。conflict 解決後に pixel harness が一致すること | I5a の前 |
| I4a | Discovery Ladder + パック economy（headless、unwired） | なし | 新規 `progressionLadder` の data と logic、unit test | 低 | unit のみ | Gate のみ | 不要 | I4b の前 |
| I4b | economy の配線（Shop の NEW 入荷、パック表示、DISCOVERED の通知、EP4 grant の停止、entitlement） | I0、I4a | ShopOverlay、ResultPanel、economy、starterStock、reducer、persistence（known key）、e2e | **高** | 必要 | 必要（Full） | **必要**（390×844 の動画 + before / after） | I5b の前（EP4 が残ったままだと、W1 recipe が初回在庫 0 に違反する） |
| I5a | P2: 7 ingredient（ladder-dark） | I0、I3、I4a | `ingredients.ts` +7 行（3 行に pieceVisual）、data test | 低 | 必要（smoke） | 必要（Gate） | 見えるものがなければ不要 | I5b に含めてもよい |
| I5b | W1 recipe（atomic） | I0、I1、I2、I4b、I5a | `recipes.ts` +10、`recipeSauceProfiles.ts` +10、CUT +9、`referencePizza.ts` +10（RT-01c の 3 件を含む）、ladder の再生成、discovery の regression | 中 | 必要 | 必要（Full） | **必要** | 分割できない（下記） |
| I6 | W1 の release gate | I5b | W1 loop の e2e、docs | 低 | 必要 | 必要（Full） | **必要**（owner が実機でプレイ） | 最後 |

最初に挙げられていた I5（CUT）、I6（recipe）、I7（MD-01）は、別々の slice にできない（main の code で確認した）。I5b にまとめた理由:

- `CUT_ELIGIBLE_RECIPE_IDS` は `ReadonlySet<RecipeId>` なので、recipe がないと型が通らない。
- `referencePizza.test.ts` は、すべての `RECIPES` に Reference があることを要求する。
- `RECIPE_SAUCE_PROFILES` は `Record<RecipeId, …>` なので、全 recipe の entry が要る。

## J. Cherry-pick / reimplementation strategy

| branch | 判定 | commit ごとの扱い |
|---|---|---|
| **P1** | **CHERRY-PICK**（branch を丸ごとは merge しない） | `39ce35c` は cherry-pick（src はこの 1 commit だけ）。`d323d36` / `e83bee4` は tools の harness として cherry-pick。`9420478` / `802b023` は docs。`d62e884`〜`3fc02a0` は evidence docs と visual-gate の preview app で、**preview app は main に入れない** |
| **RT-01a/b** | **そのまま merge**（branch から PR） | 今の main が base で、rebase は不要。`e708dd2` / `afcce51` が code、ほかは docs |
| **#205** | **fresh implementation**（merge しない） | `9035606` の大部分は obsolete。使える形は §B |
| **#206** | **rebase（または main を merge）して、そのまま載せる** | `4c1da87` が code、`edfca8b` が test |
| **#222** | **main を merge して、そのまま載せる** | `9abe481` が code（必須）、`81a850c` が docs |
| #217 / #214 / #209 | docs のみ。W1 については superseded | #214 の D-2（M4）は REC-04 と一致する |
| #220 / #221 / REC-01〜03 / REC-04 | docs のみ | 実装の authority として使う。main に merge するかは任意で、code の依存ではない |

## K. Remaining Owner Decisions / 実装の既定値

**Owner Decision: 0 件。** 次の項目は、承認済みの値を変えないので、実装の既定値として扱う（JSON の `implementationDefaults`）。

| ID | 既定値 | Owner Decision にしない理由 |
|---|---|---|
| DEF-1 | 一度 AVAILABLE になった材料は、wave で ladder を作り直しても LOCKED に戻さない（`unlockedForShopIngredientIds` を保存する） | regression を防ぐだけで、承認済みの値を変えない（REC-04 §16 / §17） |
| DEF-2 | EP4 grant は、今後すべての save で止める。すでに持っている材料と在庫は残す（取り上げない） | REC-04 §17 に「既存の在庫は残る。Dex 15 のプレイヤーは step 15 まで解放済み」とある |
| DEF-3 | W1 recipe の `baseRewardPitz` = 100 | 承認済みの REC-04 economy safety record が、100 を入力にしている |
| DEF-4 | dedicated visual を持つ 3 材料の emoji fallback は、描画されない必須 field として持つ。却下された glyph（🦪 / 🐚 / 🟢）と、fresh-tomato の 🍅 は使わない | 表示の fallback にすぎない |
| DEF-5 | ladder は、I4a で shipped の 15 件、I5b で 25 件について生成する | REC-04 で、ladder の順番は DERIVED_FROM_CONFIRMED_RULES（wave ごとに再生成） |

## Blocker list

| ID | 止めているもの | 内容 | 解消する slice |
|---|---|---|---|
| B-1 | P2、W1 | main は、書き込みのたびに unknown recipe / ingredient のデータを落とす | I0 |
| B-2 | P2、W1 | main に ladder / パック economy がない（EP1 の chain、EP4 の grant、legacy の restock / 価格が有効） | I4a、I4b |
| B-3 | P2 | IngredientGlyph が branch にしかない | I3 |
| B-4 | W1 | Completion Gate G1 / Q が PR #222 にしかない（owner の Human PASS が未記録） | I1 |
| B-5 | W1（Parmigiana / Portuguesa / Puttanesca） | RT-01a/b が branch にしかない | I2 |
| B-6 | W1 | MD-01 0/10、CUT 0/9、recipe の record 0/10 | I5b |

W1 の外で、blocker にしないもの:

- 101 規模の grind（REC-04 の W2+ tuning item）
- #212 の Lunch Rush 在庫つき mission pool（今の limitation がそのまま残る）
- #224 の ranking ruleset

## Recommended next session

**NEXT IMPLEMENTATION SLICE = I0: Save forward-compat（#206）**

1. main（`1e53baa` 以降）を #206 に merge する（conflict なし）。または同じ内容で rebase する。
2. full vitest、`tsc -b`、lint、build、`save-forward-compat` の e2e（Chromium の 2 project）を実行する。
3. PR の CI で Full WebKit + WebKit Gate を実行する。
4. UI の変更がないので、Human Verification の動画は不要。
5. merge したら production に deploy し、そのあとは W1 の id を含む build より前の rollback 先にする。

I1 / I2 / I3 / I4a は I0 に依存しないので、並行して進められる。
