# Progression 2.0 REC-04: 材料の解放・価格・在庫 Fresh Design

- 種別: docs/tools のみの Fresh Design / Audit。`src/**`、`e2e/**`、`.github/**` は変更していない。PR は作らず、merge もしていない。
- 監査日: 2026-09-25。GitHub の実状態を取り直してから開始した（§1）。
- 生成物:
  - 本書（手書き）
  - `docs/reports/TETO_PROGRESS2_REC-04_SIMULATION.md`（表をツールで生成。手で編集しない）
  - `docs/reports/data/TETO_PROGRESS2_REC-04_FRESH-DESIGN.json`（機械可読の companion。全値に status を付けた）
  - `tools/progression2_rec04_fresh_design.py`（生成・simulation・checker。`--check` で検証）
- Status の凡例（JSON の `statusLegend` と同じ）:

| status | 意味 |
|---|---|
| `CONFIRMED` | main にあり、owner が承認済み（例: PR #196 の OD-01/OD-02） |
| `MERGED_DESIGN_BASELINE` | merge 済みの設計文書（#191/#196）の値。owner decision ではない |
| `RECORDED_IN_OPEN_PR` | 未 merge の PR（#214/#217）で「決定」と記録されている。main の authority ではない |
| `CONFIRMED_OWNER_DECISION` | REC-04 の Owner Decision（OD-REC04-1〜3、2026-09-25）で承認された値 |
| `DERIVED_FROM_CONFIRMED_RULES` | 承認済みのルールから tool が生成した値（ladder の具体的な順番など）。wave ごとに再生成する |
| `PROPOSED` | REC-04 の候補値（未承認） |
| `OWNER_DECISION_REQUIRED` | 実装前に owner が選ぶもの |

## Owner Decision record（2026-09-25）

**REC-04 = APPROVED → 再計算の結果 REC-04 = RESOLVED**

出典: repo owner（perusonao）の REC-04 session での決定（2026-09-25）。

| ID | 決定 | status |
|---|---|---|
| **OD-REC04-1 Material Unlock** | **Discovery Ladder を採用。** 新しい pizza を1つ発見するたびに、次の **ordered progression step** を1段階進める（Dex 発見数 ≥ step 番号）。⭐ は material の解放条件に使わない。authority は「1発見 = 任意の材料1個」ではなく、順番付きの step として持つ。各 step は `kind` を持ち、将来は材料以外の解放も扱える。W1 では全 step が `MATERIAL` | `CONFIRMED_OWNER_DECISION` |
| **OD-REC04-2 First Stock** | 解放直後の在庫は 0。無料の starter stock は付与しない。導線は **NEW MATERIAL → Shop へ移動 → 最初のパックを購入 → Free Cooking**。「解放したが、どこで買えばよいか分からない」状態は禁止。基本材料（tomato sauce / mozzarella / basil）は既存の onboarding starter authority のまま（無限）で、このルールでは上書きしない | `CONFIRMED_OWNER_DECISION` |
| **OD-REC04-3 Pack / Price** | Shop で1回買うと、ピザ 10 枚分の在庫が増える。パックの在庫量 = **10 × k**（k はその材料の最大 minCount）。価格 tier は **60 / 80 / 100 / 120 Pitz**、補充は各 tier の 50% で **30 / 40 / 50 / 60 Pitz** | `CONFIRMED_OWNER_DECISION` |

⭐ の役割:

- ⭐ を material 解放の通貨にはしない。
- ⭐ 自体は廃止しない。skill / quality の progression、achievement、今後の capability / content の gate、Lunch Rush などで使える。
- REC-04 が外すのは、material の入手と ⭐ の直接の依存だけ。

保存単位と表示単位（OD-REC04-3 の確認事項）:

| 項目 | 内容 |
|---|---|
| 保存単位 | main のまま。scatter は個数、spread は回数。save の key、値、`schemaVersion` 2 は変えない |
| 表示単位 | 「ピザ○枚分」。例: 「🍕ピザ10枚分（30個）」 |
| 保存単位でのパック量 | 10 × k。scatter は個数、spread は k = 1 なので 10 回分 |
| migration authority | piece / portion の migration は main で未決定。#214 D-2（M4）は `RECORDED_IN_OPEN_PR`、#205 の use モデルは未 merge。REC-04 は save schema を変更しない |

Economy safety の記録（authority record）:

- **W1:** 4つの player profile すべてで、到達 25/25、deadlock 0、unreachable 0、circular prerequisite 0。
- **101 recipe stress:** 全 profile が完走。
- **W2+ ECONOMY TUNING ITEM:** 101 規模の ★1 相当では、通貨のための replay（Margherita の焼き直し）が最大 **15 回連続**する。対策の候補は、複数材料の step への束割引、T4 の上限、Lunch Rush の収入。**W1 実装の blocker にはしない。**

再計算した readiness（`--check` が毎回計算する。JSON の `readiness`）:

| 確認項目 | 結果 |
|---|---|
| W1 の deadlock 0（4 profile 完走）、25/25 発見 | PASS |
| unreachable recipe 0 / circular prerequisite 0 / 無意味な解放 0 | PASS |
| affordability（通貨不足・解放済みなのに使えない・在庫不足の finding が 0） | PASS |
| 決定性（2回ビルドしてバイト単位で同じ）/ authority pin | PASS |
| negative control 6/6 | PASS |
| W1 の7材料 matrix が揃っている / W1 の10 recipe の到達性が揃っている | PASS |
| 101 規模で全 profile 完走 / onboarding（starter だけで作れるのは Margherita のみ） | PASS |

さらに `--check` は、simulation が使った設定（Dex ladder、解放料 0、初回在庫 0、パック 10、価格 60 / 80 / 100 / 120、補充 30 / 40 / 50 / 60）が承認済みの決定と一致しない場合、W1 matrix の行が「パック = 10 × k、初回在庫 0、解放料 0」に反する場合にも FAIL する。

以下 §「結論」〜§20 は、Owner Decision 前の Fresh Design 本文。記録として残す。§19 の選択肢は上の決定で閉じた。

## 結論（先に・Owner Decision 前の記述）

**REC-04: READY FOR OWNER DECISION**（→ 上の record により **RESOLVED**）

推奨は **Candidate A「Discovery Ladder + 無料解放 + 入荷パック購入」**（→ 採用された）。

1. **解放条件:** 新しいピザを1つ発見するたびに、材料の「入荷ステップ」が1つ進む（Dex 発見数 ≥ step 番号）。
2. **ステップの作り方:** 各ステップは「新しいレシピを最低1つ完成させる、最小の材料セット」とする。材料ごとの手入力はせず、ルールで生成する。
3. **解放料:** 0。
4. **初回在庫:** 解放しただけでは 0。解放通知から、そのまま最初のパックを買える。
5. **パック:** 1回の購入で「ピザ10枚分」（= 10 × k 個。k はその材料の最大 minCount）。
6. **価格:** tier 制で 60 / 80 / 100 / 120 Pitz。補充はその半額。

根拠（§13–§15 の simulation。25 recipe = shipped 15 + W1 10、4 つの腕前 profile、Lunch Rush の収入は含めない保守的な条件）:

- **#196 の ⭐ gate をそのまま使うと、W1 の規模で詰む。** 25 recipe での ⭐ 上限は、★1–2 で 50、★3 で 75。一方、potato の gate は ⭐88、capers は ⭐70、pineapple は ⭐62、corn は ⭐54。low / beginner / standard の3 profile が STAR_DEADLOCK になり、「解放しても使えない」手順も3つ出る。
- **推奨案 A は全 profile で完走し、finding は 0。**
  - 全員が 25/25 を発見し、1回の焼成での解放は最大 2 材料。
  - 最も弱い profile（毎回 ★1、報酬 20 Pitz）でも、連続 grind は最大6回。
  - 詰み、unreachable recipe、circular prerequisite、無意味な解放、在庫切れで進めない状態は、いずれも 0。
- **#217 型の解放料（B）は、同じ ladder でも low の grind を 26 → 81 回に増やす。** 「通貨不足で解放済みなのに使えない」状態が 11 回続く。
- **無料 grant（C）は滑らかだが、Pitz の使い道がなくなる。** 完走時点で 1,620–4,120 Pitz が余る。owner のループにある「ショップで購入」という手順も消える。
- **101 target 規模の stress でも、A は全 profile 完走。** 解放ステップの束は最大3材料、無意味な解放は0。#196 をそのまま使うと、無意味な解放が33ステップ、1回の焼成で最大15材料が同時に解放される。

Owner Decision は3つ（§19）。

---

## 1. GitHub の現状（fresh）

| 対象 | 状態 | head | REC-04 での扱い |
|---|---|---|---|
| `main` | — | `1e53baa88f390bf6d8f52647e7c65cc279eb2567`（#223） | 基準。tool で pin |
| #220 Content Readiness | OPEN | `e49dab96bd9b26dc0f520349cf09d1160c3519f5` | W1 authority（#221 経由）。触っていない |
| #221 W1 Authoring | OPEN | `070afc0827f382bec8bc813d62e7fafe663a0991` | W1 の10 recipe の構成（blob `a4beec9`）を pin |
| #222 Completion Gate 実装 | OPEN | `81a850c` | 触っていない。§17 で関係だけ記録 |
| #218 Completion Gate Audit | OPEN | `5105771` | 同上 |
| #217 Paid Unlock Fresh Design | OPEN | `a39932d` | 監査対象（§2） |
| #214 3-4C Decision Gate | OPEN | `5c1d6f0` | 監査対象（§2） |
| #205 / #206 Phase 3-4A / 3-4B | OPEN | `9035606` / `edfca8b` | 監査対象（§2, §17） |
| Production Visual P1（`claude/w1-ingredient-visual-preview-mt4uxw`） | 別 session で進行中 | `9420478`（Phase A `3fc02a0`、Phase B `80ce35e` の後に P1 の commit が進んでいる） | **触っていない**。W1 の visual Human Gate 7/7 PASS は Phase A の記録 |

- #221 W1 の判定は READY 0 / REVIEW 10 / BLOCKED 0（#221 の報告書どおり）。
- REC-04 は #221 ledger で `OWNER_DECISION_REQUIRED` / field `progression`: "Pitz price, unlock fee, star gate, and non-star condition stay TBD"。

## 2. 現在の authority の監査

| 項目 | 内容 | status |
|---|---|---|
| OD-01 | SHIPPED_KEEP（shipped の構成を 101 target に重ねる） | `CONFIRMED`（#196 で owner 承認） |
| OD-02 | PASS の Pitz 下限 20 + 初回発見 +50 | `CONFIRMED`、main の `pitzReward.ts` に実装済み |
| OD-S1 | W1 は #220 の W1。sauce は現行の union の中だけ | `CONFIRMED`（#221 ledger REC-11） |
| 0 recipe 開始 | Dex 0 → starter 3種 → Free Cooking → Margherita（#199） | `CONFIRMED`、main に実装済み |
| ⭐ の式 | Σmax(2, BEST)（Phase 2 G4 hybrid） | `MERGED_DESIGN_BASELINE`。runtime は未 merge の #205 だけ。**main は Σ BEST** |
| ⭐ gate | G4_HYBRID_060。101 target 用の絶対値（W1: fresh-tomato 14 / eggplant 22 / clam 28 / corn 54 / pineapple 62 / capers 70 / potato 88） | `MERGED_DESIGN_BASELINE` |
| tier 価格 | 60 / 100 / 140 / 180 | `MERGED_DESIGN_BASELINE` |
| 在庫 policy | S10_R10（購入 10 / 補充 10、補充は ×0.5） | `MERGED_DESIGN_BASELINE` |
| #214 D-1 | OD-03 = Option A。固定の authority ⭐ gate | `RECORDED_IN_OPEN_PR` |
| #214 D-2 | 在庫の単位は M4（個数）。migration しない | `RECORDED_IN_OPEN_PR` |
| #214 D-4 | 購入・補充は固定の 10 × k 個 | `RECORDED_IN_OPEN_PR` |
| #217 OD216-1..4 | 解放料の curve / non-star 条件 / capability の解放方式 / k の authoring | `OWNER_DECISION_REQUIRED`（未決） |

監査で分かったこと:

- **#196 の ⭐ gate は「101 target が全部出た世界」の値。** 実際にリリースされる content（W1 後で 25 recipe）では届かない gate がある（§14）。#209 も既に「genovese（⭐76）と quattro-formaggi（⭐102）は、content が増えるまで新規プレイヤーが発見できない」と記録している。
- **piece / portion の単位は、main では未決着。**
  - main の在庫は個数（scatter）と回数（spread）。#214 は M4（個数）を、#205 は「1 pizza = 1 use」を前提にしている。どちらも未 merge。
  - REC-04 は単位を固定しない（§10: パックを「ピザ P 枚分」で定義すれば、どちらの単位でも同じ意味になる）。
- **#217 の未決4件について REC-04 が答えるもの。**
  - 解放条件: §6 で答える。
  - 解放料: §7 で答える（0 を推奨）。
  - capability の解放方式: W1 には capability が不要なので決めない。scale stress では #217 の推奨 B_AUTO を仮に置いた。
  - 解放時・初回在庫の UX: §8 で答える。

## 3. 今の economy の監査（main `1e53baa`）

- **材料**
  - 22 件。無限の starter 3 件（tomato-sauce / mozzarella / basil）と、有限の 19 件。
  - 有限の 19 件は全部 `starterGrantOnly`。recipe が解放されると、EP4 grant で `minCount × 10` 個もらえる。Shop は補充だけ。
  - 補充量は `restockQuantity`（= 3 × minCount）。価格は材料ごとの手入力で 55–170。
- **recipe の解放:** `requiresRecipeId` の鎖に `minTotalStars` を組み合わせる（Margherita → Funghi → …）。
- **⭐:** `totalStars` = 発見済み recipe の BEST の合計（★1 は 1 と数える）。
- **Pitz**
  - FREE: 100 × 倍率（0 / 0.5 / 0.8 / 1.0 / 1.2）。下限は 20。初回発見は +50。
  - Lunch Rush: 40 + 品質 bonus + 提供 bonus（1回最大 140 程度）。
- **在庫:** 個数。`CONFIRM_BAKE` で置いた分だけ減る（PASS でも FAILED でも同じ）。
- **save**
  - `schemaVersion` 2。
  - `sanitizeInventory` は、知らない ingredient id を**捨てる**。W1 の材料を入れた build から rollback すると在庫が消える。#206 が入るまで注意が要る。

Progression 2.0（#196）はこの鎖と grant を「材料を買う → Free Cooking で発見」に置き換える計画で、runtime への配線は #205 / #206（未 merge）で止まっている。REC-04 の推奨は、この置き換え先の数値とルールを決めるもの。

## 4. REC-04 の定義

W1（と、それ以降の wave）の新材料について、次を決める。

1. いつ解放されるか
2. 解放にいくら払うか
3. 解放直後の在庫
4. 1回の購入で増える量
5. 価格
6. 解放の間隔
7. 新材料で発見できる recipe が必ずあること
8. 通常のプレイで買えること

条件:

- 0 recipe 開始（Margherita の自力発見）を壊さない。
- W1 だけに合わせすぎず、172 recipe まで rule / formula で生成できること。

## 5. 候補の比較（Candidate A / B / C / D と、現行 authority の A_AUTH）

全案とも、解放の順番は §6 の key-recipe rule で揃えている（A_AUTH だけは #196 の順番と gate）。

| 案 | 解放条件 | 解放料 | 解放直後の在庫 | 初回の入手 | 補充 |
|---|---|---|---|---|---|
| A_AUTH | #196 の絶対 ⭐ | 0 | 0 | #196 の tier 価格で購入 | 半額 |
| **A（推奨）** | Discovery Ladder | 0 | 0 | tier 価格でパックを購入 | 半額 |
| B | Discovery Ladder | tier の 50%（#217 F2 型） | 0 | 解放料 + パック購入の2回 | 半額 |
| C | Discovery Ladder + 前の key recipe を発見済み | 0 | 無料 grant（3枚分） | 購入なし | 半額 |
| D | Discovery Ladder | 0 | お試し1枚分 | tier 価格でパックを購入 | 半額 |

simulation の結果（low / beginner / standard / skilled。詳細は appendix の表）:

| 案 | 完走 | low の grind（連続最大） | 解放済みなのに買えず待った最大回数 | 1回の焼成での最大解放 | 完走時の Pitz（standard） | finding |
|---|---|---|---:|---:|---:|---|
| A_AUTH | **skilled のみ** | 2（2） | 2 | 6 | 1160（途中で詰み） | DEADLOCK ×3、USELESS_UNLOCK、BURST |
| **A** | 4/4 | 26（6） | 6 | 2 | 1050 | なし |
| B | 4/4 | 81（11） | 11 | 2 | 190 | CURRENCY_STARVATION、UNLOCKED_BUT_UNUSABLE |
| C | 4/4 | 0 | 0 | 2 | 3120 | なし（ただし Pitz の使い道がない） |
| D | 4/4 | 0 | 0 | 2 | 1050 | なし |

比較軸での評価:

| 軸 | A | B | C | D |
|---|---|---|---|---|
| 分かりやすさ | ◎ 「発見 → 入荷 → 買う → 試す」 | △ 解放料と在庫の二重課金 | ○ 買わなくてよい | ○ 「お試し」と「購入」が混在 |
| progression のテンポ | ◎ 1発見 = 1入荷 | △ low が遅い | ◎ | ◎ |
| deadlock リスク | 0（構造上） | 0（遅い） | 0。ただし前提 recipe の鎖が長い | 0 |
| economy の制御 | ◎ 購入が主な使い道 | ○ | ✕ 使い道がない | ○ |
| shop の意味 | ◎ owner のループそのまま | ○ | ✕ 補充だけ | ○ |
| onboarding との相性 | ◎ Margherita の直後に最初の入荷（60 Pitz。Margherita の報酬だけで買える） | ○ | ◎ | ◎ |
| save migration | ◎ 解放は Dex 数から導ける | △ 解放料の支払い済みを保存する必要 | ○ grant の exactly-once を保存する必要 | △ お試しの exactly-once を保存する必要 |
| 実装の複雑さ | ◎ | △ 状態が5つ（#217） | ○（今の EP4 に近い） | ○ |
| 172 への拡張 | ◎ rule で生成 | ○ | ○ | ○ |

D はお試し在庫のおかげで low の grind が 0 になるが、その分「1枚分を FAILED で失うと、結局は買うまで作れない」。お試しの付与を1回だけにする管理も増える。これは UX の好みで決まる部分なので、owner decision にした（OD2）。

## 6. Star Gate curve → Discovery Ladder

**ladder の生成ルール（PROPOSED）:**

- starter 3種から始める。
- 各ステップでは、「まだ作れない recipe のうち、足りない材料が最も少ない recipe（= key recipe）」の不足分を1ステップとして解放する。
- 同点のときは、次の順で決める。
  1. そのステップで新しく作れる recipe が多い
  2. 解放した材料が他の recipe でも多く使われる
  3. recipe id の順

このルールだと、次のことが**構造的に**保証される。

- 無意味な解放がない（全ステップが recipe を1つ以上完成させる）
- prerequisite は常に前のステップにある（循環しない）
- 材料が揃う recipe はすべていつか作れる（unreachable がない）

**解放条件（OWNER_DECISION_REQUIRED、推奨）:** step s は Dex の発見数 ≥ s で解放される。

⭐ gate ではなく発見数を推奨する理由（sensitivity の結果）:

- **⭐ のルールで詰まないようにすると、結局「1発見 = 1ステップ」になる。**
  - ⭐ ladder を詰まないように作ると、gate(s) = 2·R_before(s) になる（R_before(s) = step s より前のステップで作れるようになる recipe の数）。
  - 燃えすぎ（burst）を防ぐ throttle を入れると、standard / skilled では ⭐ が条件として効かなくなる。★1–2 の profile では「発見数 ≥ s」と同じ条件になる。
  - つまり W1 の規模では、⭐ ladder と Discovery Ladder はほぼ同じ結果になる（appendix: `starLadder_f1.0_noThrottle` は low / beginner で A と同一。standard / skilled では1回の焼成で3材料が解放されるようになるだけ）。
- **⭐ ladder は main の ⭐ の式で詰む。**
  - main の Σ BEST では ★1 の発見が 1⭐ にしかならず、low は Margherita の直後に STAR_DEADLOCK になる（`starLadder_f1.0_productionStars`）。
  - Discovery Ladder はどちらの式でも完走する（`dexLadder_productionStars`）。#205 の ⭐ の式の変更に依存しない。
- **f を緩めると burst が出る。** f = 0.6（#196 の係数）で throttle を外すと、standard / skilled で1回の焼成に 4–5 材料が解放される（UNLOCK_BURST）。

⭐ は Dex の品質、BEST、Pitz の軸として表示し続ける。プレイヤー向けの文言は「新しいピザを発見！ → 新しい材料が入荷したよ」。参考として、⭐ で表すと「⭐2つごと」（Σmax(2,BEST) で 2×step）に相当する。

## 7. 解放料のモデル

| 方式 | REC-04 の評価 |
|---|---|
| 解放そのものに払う（#217 の3層） | B の結果: low の grind が 3倍、standard でも最大 11 回待つ。二重課金に見える。**不採用** |
| 解放後に初回購入する | **採用（A）**。解放は無料。最初のパック購入が実質の「入荷」 |
| 解放は無料で、在庫だけ買う | 上と同じ。A はこれにあたる |
| 初回在庫込みの解放料 | 「解放料 = 最初のパックの価格」にすると A と経済的に同じ。見せ方の違いだけなので、A の「入荷する（🪙60 でピザ10枚分）」に統合する |

補充はパック価格の半額（`MERGED_DESIGN_BASELINE`）。「初回は補充の2倍」が、#217 の言う unlock fee の役割を自然に果たしている。

## 8. 初回在庫のモデル

| 選択肢 | 評価 |
|---|---|
| 0 個（推奨） | 解放通知から、そのまま購入へ進める。「使えない」時間は、買えるまでの grind だけ。A で最大 6 回（low）、beginner 以上は 0 回 |
| 少量（1枚分のお試し） | D。low の grind は 0 になるが、FAILED で失うと結局は買う必要がある。exactly-once の管理も必要 |
| 1 recipe 分 × 数枚（grant） | C。Pitz の使い道が消える。今の EP4（10枚分 grant）が抱える問題（Shop が補充しか意味を持たない）の繰り返しになる |
| 数 recipe 分 | C 以上に Shop の意味が薄れる |

「解放したのに使えない」状態は、**価格を1回の発見で払える範囲に抑える**（§11）ことで避ける。在庫を無料で配ることでは避けない。

## 9. パックのモデル

| 方式 | 内容 | 評価 |
|---|---|---|
| A. 固定の個数 | 例: 常に +10 個 | 材料で意味がばらばら。k = 1 なら10枚分、k = 4 なら 2.5 枚分 |
| **B. recipe を何枚作れるかで決める（推奨）** | 1パック = ピザ P 枚分 = P × k 個。k はその材料の最大 `minCount`（固定データ） | UI は「🍕ピザ10枚分（30個）」。単位（個数 / use）がどちらになっても同じ意味。#214 D-4 の 10 × k と数値は一致する |
| C. 量を自由に選ぶ | 1個単位で買う | 在庫管理が細かくなりすぎる |
| D. S / M / L | 3サイズ | UI が増える。W1 では不要 |

P（1パックで何枚分か）は 5 と 10 を比べた（appendix の「Pack size comparison」）。

- P = 10 なら、★1 で作り直しても損をする recipe は 0。
- P = 5 だと、★1 で作るたびに Pitz が減る recipe が6つ出る（puttanesca、new-haven、pesto-tonno、pesto-patate、portuguesa、quattro-formaggi）。1枚あたりの補充費は最大 34 で、★1 の報酬 20 を超える。

発見までの流れ自体には P の影響がない（25 recipe を1回ずつ作るだけなので、補充は 0 回）。P が効くのは、作り直し、BEST の更新、Lunch Rush。

**推奨は P = 10。** 材料1つあたり、30枚作る間の補充は3回で、細かすぎない。

注意: k は「その材料が販売される時点での最大 minCount」で固定する。W1 が入ると ham の k は 1 → 3 になる（portuguesa が ham ×3）。これは #214 D-4 の「recipe が増えても自動では変えない」と衝突する。**W1 の data slice の中で、明示的な balance 変更として ham を 30 個にする**ことを推奨する。

## 10. 価格の curve

- tier は「ladder のステップの帯」で決める（PROPOSED）。この帯は後の wave で content が増えても、既存の材料の tier を変えない。
  - T1: step 1–5
  - T2: step 6–14
  - T3: step 15–29
  - T4: step 30 以上
- 推奨価格（PROPOSED）: **60 / 80 / 100 / 120**。補充は半額（30 / 40 / 50 / 60）。
- #196 の 60 / 100 / 140 / 180 を同じ ladder に当てると（sensitivity `authPrices`）、low の grind は 26 → 58、連続は 6 → 10 になり、CURRENCY_STARVATION と UNLOCKED_BUT_UNUSABLE が出る。
- 材料ごとの手入力の価格表は作らない（172 で維持できない）。

## 11. W1 の新7材料の matrix（PROPOSED。確定値は1つもない）

| 材料 | step | key recipe | 先に必要な材料 | Dex 条件 | ⭐ 換算 | #196 の ⭐ gate（参考） | 解放料 | 解放直後の在庫 | パック | 初回 🪙 | 補充 🪙 | 使う recipe |
|---|---:|---|---|---:|---:|---:|---:|---:|---|---:|---:|---|
| eggplant | 4 | melanzane-pizza | — | 4 | 8 | 22 | 0 | 0 | ピザ10枚分（30個） | 60 | 30 | melanzane-pizza、parmigiana-pizza |
| corn | 9 | bambino | ham | 9 | 18 | 54 | 0 | 0 | ピザ10枚分（30個） | 80 | 40 | bambino |
| pineapple | 10 | hawaiian | ham | 10 | 20 | 62 | 0 | 0 | ピザ10枚分（30個） | 80 | 40 | hawaiian |
| clam | 19 | new-haven-apizza | garlic、olive-oil、parmigiano | 19 | 38 | 28 | 0 | 0 | ピザ10枚分（30個） | 100 | 50 | new-haven-apizza |
| fresh-tomato | 20 | pesto-caprese | pesto | 20 | 40 | 14 | 0 | 0 | ピザ10枚分（30個） | 100 | 50 | pesto-caprese |
| potato | 21 | pesto-patate | bacon、pesto | 21 | 42 | 88 | 0 | 0 | ピザ10枚分（30個） | 100 | 50 | pesto-patate |
| capers | 23 | puttanesca-pizza | anchovy、black-olive、garlic | 23 | 46 | 70 | 0 | 0 | ピザ10枚分（20個） | 100 | 50 | puttanesca-pizza |

W1 のうち Pizza Portuguesa と Pesto Tonno は新材料を使わない。前者は step 12 の onion、後者は step 17 の pesto で作れるようになる。ladder 全体（24 step）は appendix にある。W1 の材料は shipped の材料の間に自然に混ざる（eggplant は4番目）。

## 12. W1 の10 recipe の到達性

| recipe | 作れるようになる step | 発見した焼成回（low / standard） |
|---|---:|---|
| melanzane-pizza | 4 | 5 / 5 |
| parmigiana-pizza | 5 | 6 / 6 |
| bambino | 9 | 10 / 10 |
| hawaiian | 10 | 11 / 11 |
| pizza-portuguesa | 12 | 18 / 13 |
| pesto-tonno | 17 | 29 / 18 |
| new-haven-apizza | 19 | 34 / 20 |
| pesto-caprese | 20 | 36 / 21 |
| pesto-patate | 21 | 39 / 22 |
| puttanesca-pizza | 23 | 44 / 24 |

10/10 とも、全 profile で発見される（`--check` が確認している）。

## 13. progression の simulation

モデル（決定的）:

- **profile:** 固定の品質で焼く4種。low = ★1（20 Pitz）、beginner = ★2、standard = ★3、skilled = ★5。
- **1手番の流れ:** 解放 → 購入（step の順、初回パック）→ 次の発見に必要な補充 → 焼成。
  - 焼成は、発見できる recipe があれば発見を優先する。なければ Margherita を焼いて稼ぐ（starter だけなので無限・無料）。
- **収入:** Lunch Rush の収入は入れていない（入れれば余裕が増えるだけ）。
- **発見の判定:** 1回の PASS 焼成で発見とする。#218 / #222 の部分量 PASS は仮定しない。

standard の流れ（抜粋。全行は appendix の Trace）:

| 焼成 | 出来事 | ⭐ | 🪙 | 持っている有限材料 | 次の解放 |
|---:|---|---:|---:|---:|---|
| 0 | New Game（Dex 0、starter のみ。発見できるのは margherita） | 0 | 0 | 0 | #1 egg（Dex 1） |
| 1 | margherita を発見 → egg が入荷 → 購入 | 3 | 70 | 1 | #2 bacon |
| 2 | bismarck を発見 → bacon | 6 | 140 | 2 | #3 mushroom |
| 5 | melanzane-pizza（W1 で最初）を発見 → parmigiano | 15 | 350 | 5 | #6 pepperoni |
| 11 | hawaiian を発見 → black-olive + oregano（束） | 33 | 570 | 10 | #12 onion |
| 25 | quattro-formaggi を発見 → 完走 | 75 | 1050 | 26 | — |

low の流れ（抜粋）:

| 焼成 | 出来事 | ⭐ | 🪙 | 次の解放 |
|---:|---|---:|---:|---|
| 1 | margherita（70 Pitz）→ egg を 60 で購入 | 2 | 10 | #2 bacon |
| 6 | parmigiana-pizza（6 手目で W1 を2つ） | 12 | 120 | #6 pepperoni（T2 80） |
| 11 → 17 | hawaiian の後、black-olive と oregano（計 160）のために grind 5 回 → capricciosa | 22 → 24 | 70 → 80 | #12 onion |
| 44 → 51 | puttanesca の後、fontina と gorgonzola（計 200）のために grind 6 回（最長）→ quattro-formaggi で完走。grind は合計 26 回 | 48 → 50 | 80 → 70 | — |

## 14. deadlock の分析

| 検出項目 | A_AUTH（#196 そのまま） | A（推奨） | 検出方法 |
|---|---|---|---|
| progression deadlock | **low / beginner / standard で STAR_DEADLOCK**。⭐ の上限（50 / 50 / 75）が potato 88、capers 70 などに届かない | 0 | simulation。発見できるものがなく、買うものもなく、次の gate に届かない |
| recipe unreachable | 0（static）。ただし low は 8 件、standard は 5 件の recipe に実際には届かない | 0 | 静的な被覆 + simulation |
| 解放したのに使えない | USELESS: onion（step 3）、fresh-tomato（step 10）、fontina（step 25）は、それだけでは何も作れない | 0 | 各ステップの newlyReachable が空でないこと |
| 通貨不足 | — | 最大6回連続（low）。閾値は 8 | 連続 grind の回数 |
| 在庫不足で進めない | 0 | 0 | 材料は揃っているのに在庫が足りない焼成の回数 |
| unlock burst | skilled で1回に6 | 最大 2（束 black-olive + oregano、fontina + gorgonzola） | 1回の焼成での解放数（閾値 3） |
| 無意味な解放 | 3 step | 0 | static |
| circular prerequisite | 0 | 0 | prerequisite graph の DFS |

negative control:

- `--check` は、次の6つの壊れた入力で、各検出器が**反応すること**も確認している。
  1. main の ⭐ の式での ⭐ ladder（deadlock）
  2. 存在しない材料を使う recipe（unreachable）
  3. 3ノードの循環（circular prerequisite）
  4. 5000 Pitz のパック（通貨不足）
  5. #196 の順番（無意味な解放）
  6. 同じ入力での2回実行（決定性）
- 6/6 PASS。

## 15. affordability の分析

- **1ステップの初回費用と、1回の発見の報酬（報酬 + 50）の差**
  - T1 / T2 / T3 は、beginner 以上なら追加の grind 0 回。
  - low は T2 で 1 回、T3 で 2 回、束（160–200）で 5–7 回。
- **作り直しの採算（P = 10）**
  - 25 recipe すべてで、★1 でも Pitz は増える。最悪は quattro-formaggi で +3.0、puttanesca で +3.3。
  - ★2 以上なら、どの recipe でも 1枚 +33 以上。
- **無限の収入源:** Margherita（starter のみ）は常に 20–120 Pitz を生む。Pitz が 0 に張り付く通貨 deadlock は構造上起きない。
- **余る Pitz:** 25 recipe を完走した standard は 1,050 Pitz が余る。作り直し、Lunch Rush、次の wave の材料が使い道になる。

## 16. 172 への拡張

- **rule で生成する。** ladder（順番・束・Dex 条件）、tier、価格、k、パックは全部、recipe の構成から tool が生成する。材料ごとに手で入れる値はない。
- **101 target での stress**（#191 の Phase 2 SHIPPED_KEEP の構成。k は 1。capability は #217 の B_AUTO を仮定）:

| | ステップ数 | 無意味な解放 | 1回の最大解放 | low（焼成 / grind / 連続最大） | beginner | standard | skilled |
|---|---:|---:|---:|---|---|---|---|
| A（推奨） | 93 | 0 | 3 | 406 / 305 / 15 | 163 / 62 / 6 | 103 / 2 / 2 | 101 / 0 / 0 |
| A_AUTH（#196） | 125 | 33 | 15 | 483 / 382 / 24 | 194 / 93 / 9 | 122 / 21 / 6 | 101 / 0 / 0 |

  - A は全 profile で 101/101 を完走する。
  - 101 規模の low（毎回 ★1）では通貨不足の連続が 15 回ある。3材料の束と T4 が重なるときに起きる。**W2 以降の tuning 項目**（束の割引、T4 の上限、Lunch Rush の収入）として記録し、W1 の範囲では扱わない。
- **wave を追加するとき**
  - ladder を作り直すと、既存の材料の step が後ろにずれることがある。
  - 一度解放した材料は **戻さない**（§17 の entitlement）。
  - 新しいステップは Dex 数で自然に続く。25 recipe を発見済みの既存プレイヤーは、W2 で「発見1回ごとに1入荷」を再開する。
- **capability（DOUGH_VARIANT など）:** ladder のノードとして同じ rule に乗る。有料にするかは #217 OD216-3 のまま（REC-04 では決めない）。

## 17. save の互換性

- **Discovery Ladder の解放状態は Dex 数と ladder data から導ける。** 新しい save field は必須ではない。
- **wave の追加で ladder がずれても解放済みを戻さないために、次を推奨する。**
  - #217 と同じく、`unlockedForShopIngredientIds` を持つ。一度入れたら消さない。
  - forward-preserve は #206 のやり方で行う。
- **在庫:** key、単位、`schemaVersion` 2 は変えない。パックは「P × k 個」を個数として足すだけなので、M4 のままで成立する。#205 の use モデルになっても P を足すだけ。
- **既存 save**
  - EP4 grant で持っている材料と在庫は、そのまま残る。
  - Dex 15 のプレイヤーは step 15 まで解放済みと導かれる。W1 の eggplant / corn / pineapple はすぐ「入荷」に並ぶ。
- **rollback の注意:** 今の `sanitizeInventory` は、知らない ingredient id の在庫を捨てる。W1 の材料を出す前に #206（unknown id の forward-preserve）が必要。
- **#218 / #222（部分量 PASS）との関係:** 最低量が minCount より下がれば、パックは10枚以上もつ。REC-04 の数値は下限として成立し、変更は要らない。

## 18. 実装への影響（今回は実装しない）

| 範囲 | 変更 |
|---|---|
| data | ladder（step、items、key recipe、tier）と、材料ごとの `packPrice` / `refillPrice` / `packQuantity`（= 10 × k）を、tool の生成物から取り込む。`starterGrantOnly` と EP4 の recipe grant を Progression 2.0 の新規 save で止める |
| logic | 純関数 `ladderUnlockedSteps(dexCount)`、`ingredientShopState(...)`（LOCKED / NEW入荷 / OWNED）、初回購入と補充の取引 |
| #205 | ⭐ の式の変更（Σmax(2,BEST)）は、REC-04 の解放には不要になる。表示・Pitz 用に残すかは別途判断。「1 pizza = 1 use」は採らなくてよい（パックの定義が単位に依存しない） |
| #206 | `unlockedForShopIngredientIds` と unknown ingredient id の forward-preserve |
| UI | DISCOVERED 画面の「🆕○○が入荷！」通知と、購入への直接導線。Shop の「NEW 入荷」行と「🍕ピザ10枚分（30個） 🪙60」表示 |
| Lunch Rush | #213 の在庫つき mission pool は、個数のままで接続できる |

## 19. Owner Decision（→ 2026-09-25 に全件決定済み。冒頭の record を参照）

決定: OD-REC04-1 = ①、OD-REC04-2 = ①、OD-REC04-3 = ①。以下は決定前に提示した選択肢。

| ID | 決めること | 選択肢 | 推奨 |
|---|---|---|---|
| **REC04-OD1** | 解放条件の基準 | ① **Discovery Ladder**: 新しいピザを1つ発見するたびに次の入荷ステップ ② ⭐ ladder: content に合わせた ⭐ gate。品質で先に進めるが、101 規模で burst と ⭐ の式への依存がある ③ #196 の ⭐ 絶対値のまま（W1 規模で詰む） | ① |
| **REC04-OD2** | 解放直後の在庫 | ① **0 個 + 解放通知から初回パックを購入** ② 1枚分の無料お試し + 初回パックを購入 | ① |
| **REC04-OD3** | economy の数値 | ① **1パック = ピザ10枚分（10 × k 個）+ tier 60 / 80 / 100 / 120、補充は半額** ② ピザ10枚分 + #196 の 60 / 100 / 140 / 180 ③ ピザ5枚分 + 60 / 80 / 100 / 120 | ① |

REC-04 では決めないもの（他の issue / PR が持つ）:

- capability の解放方式（#217 OD216-3）
- Completion Gate（#218 / #222）
- W1 の description、minCount、bakeTarget（#221 REC-01 / REC-02）
- ingredient の visual（Production Visual P1）

## 20. 次の実装 slice の案

1. **S0 決定の記録（docs）:** 完了。OD の結果を JSON の status に反映し（→ `CONFIRMED_OWNER_DECISION`）、`--check` で readiness を再計算する。
2. **S1 headless の ladder と economy（src/logic、src/data）:** 生成済み ladder の data、`ladderUnlockedSteps`、購入・補充の純関数、unit test。#205 はこの上に置き直す。
3. **S2 save の entitlement と forward-compat:** #206 を基に `unlockedForShopIngredientIds` を追加。rollback の test も入れる。
4. **S3 Shop と解放通知の UI:** NEW 入荷の行、パック表示、DISCOVERED 画面の通知と購入導線。UI 変更なので Human Verification（390×844 の動画と before / after）が必要。
5. **S4 EP4 grant の引退:** Progression 2.0 の新規 save だけ。既存 save の在庫は保持する。
6. **S5 W1 content の data:** #221 の REVIEW 項目が解消した後。ham の k の変更（10 → 30 個）も同じ slice で行う。Production Visual P1 は FINAL PASS（実装 `39ce35c`、Human PASS の記録 `802b023`）。この session では P1 branch を変更せず、P2 にも進まない。
7. **S6 human-feel と balance の確認:** 実機で low と standard 相当の2周をプレイし、W2 に向けた tuning 項目（§16）を判断する。

## 残っている実装の依存関係

- #205 を Discovery Ladder の上に作り直す。material の解放に ⭐ の式の変更は不要になった。
- #206: unknown ingredient id と `unlockedForShopIngredientIds` の forward-preserve。main の `sanitizeInventory` は、知らない id の在庫を捨てる。
- #221: REC-01〜03 の content sign-off と、RT-01（Parmigiana / Portuguesa / Puttanesca の reference ring の容量）。
- #218 / #222: Completion Gate の部分量。REC-04 の数値は下限として成立する。
- #217 OD216-3: capability の解放方式。W1 では不要。
- piece / portion の migration authority。REC-04 は schema を変えない。
- Production Visual P1 は FINAL PASS 済み（依存は解消）。W1 の7材料の production 登録は、まだしていない。

## 検証

```
python tools/progression2_rec04_fresh_design.py --check
```

- **PASS 条件（1–4: 入力と生成物）**
  1. main の `recipes.ts` と、#221 の W1 matrix blob が pin と一致する。
  2. Phase 2 matrix の sha256 が一致する。
  3. 2回ビルドして結果がバイト単位で同じ（決定性）。
  4. 生成物（JSON / appendix）にドリフトがない。
- **PASS 条件（5–9: 推奨案の中身）**
  5. 推奨案の finding が 0。
  6. onboarding: starter だけで作れるのは Margherita のみで、最初の解放は Margherita の発見の後。
  7. W1 の10 recipe が全部、trace の中で発見される。
  8. negative control が 6/6。
  9. 101 target の stress で、推奨案に deadlock / 無意味な解放 / burst がない。
- **PASS 条件（10–12: 候補値の扱い）**
  10. ★2 の採算が全 recipe でマイナスにならない。
  11. 候補値に `CONFIRMED` を付けていない。
  12. OD がすべて `OWNER_DECISION_REQUIRED`。
- **pin の確認:** PR #221 の object が取れない環境では FAIL（`--allow-offline-pins` を付けたときだけ、commit 済みの snapshot を使う）。
- **実行した test:** docs / tools だけの変更なので、ブラウザ E2E は実行していない。
