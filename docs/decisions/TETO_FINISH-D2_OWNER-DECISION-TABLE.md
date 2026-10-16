# FINISH D2 — Owner Decision 表（P1-0、docs-only）

Issue #294（親）/ #465 項目 10。main `573e2a6` 時点。**この表の「推奨」は助言であり、決定ではありません。** 回答は Issue #294 のコメントを一次記録とし、
決定後に専用の docs PR でこのファイルへ反映します。重複 Issue は作りません。

## 決定済みの前提（Owner 2026-10-16 承認）

- FINISH の最初の対象は **BBQチキン**（= OD-CS-10 の推奨案を Owner が前提として採用。OD-CS-10 自体の正式回答は下表で確認）。
- #478（ドラッグ統一）は FINISH の**必須条件にしない**。既存のタップ操作で FINISH を実現する設計を優先する。
- 決定済み（変更しない）: OD-CS-1=A、OD-CS-2=B、OD-CS-3=A、OD-CS-7=A（= UD-H）、OD-CS-9(a)、OD-CS-11=A、OD-CS-20。

## 表の見方

「原文」は `docs/design/TETO_POST-W1_COOKING-STEPS_NEXT-PHASE_DESIGN.md` §8 と
`docs/reports/TETO_COOKING-STEPS-2.0_FINISH-Pilot_Pre-Implementation-Design.md` §9 の該当セルの転記（改変なし）。
「影響」「未決事項」「必要時期」は本 PR の整理。

## A. Phase 1（FINISH 画面の実装）の前に必要な決定

| ID | 原文（論点 / 選択肢） | 推奨（原文） | 影響 | 未決事項 | 必要時期 |
|---|---|---|---|---|---|
| **UD-B** | FREE の仕上げ UI: 案 A（常設タブ）／案 B（二択パネル） | A。FREE に CUT が入る時点で B/CS-4 へ | A: 全 FREE が 6 タブ（D·S·C·T·焼く·仕上げ）、+1 タップ。後乗せ有無を漏らさない。B: 新コンポーネントで a11y・レイアウトが新規 | ガイドの Pizza Select で未発見レシピが名前つきで選べるか（選べない `？？？` ロックなら、ガイドの仕上げタブ表示は識別に影響しない） | D2-3 の前（Phase 1 のガイド FINISH＝D2-1/D2-2 は不要） |
| **OD-CS-4** | Free Cooking と FINISH: (a) FREE always has 仕上げ, tray = all owned toppings; (b) FINISH only in guided; (c) tray in FINISH = only late-capable items | (a) — FREE is D·S·C·T·焼く·仕上げ = 6 tabs | (b): FREE では後乗せレシピが発見不能。(c): どの材料が後乗せか漏れる（OD-TQ-16）。UD-B と同一論点 | UD-B と同時に回答（OD-CS-4 = UD-B の上位判断） | P4a/P4b の共通ゲート。ガイド先行なら D2-3 まで不要 |
| **OD-CS-10** | Late representative: BBQ チキン / wasabi-beef / keep the audit's prosciutto e rucola | BBQ チキン | rucola は後乗せ証拠なし（OD-TQ-12）。BBQ は新食材 2（bbq-sauce・cilantro）、wasabi-beef は 3（beef・soy-sauce・wasabi） | Owner は BBQ を前提として承認済み。**正式回答（=A）の記録のみ** | 今 |
| **OD-CS-8** | FINISH time and Cooking Time: count / don't count in `completedMs` | don't count (mirror CUT) | 効率ボーナスと Pitz の時間帯。count すると FINISH の操作時間がスコアに効く | 数えない場合も、Step Timing 表示で FINISH を扱うか | D2-2 の前（ガイドの FINISH 実装時に挙動が決まる） |

## B. Phase 1 の前に必須ではないが、有効化（P4b）までに必要な決定

| ID | 原文（論点 / 選択肢） | 推奨（原文） | 影響 | 未決事項 | 必要時期 |
|---|---|---|---|---|---|
| **OD-CS-5** | Dinner and late recipes: (a) exclude late recipes from Dinner targets; (b) move Stage A after FINISH; (c) always show FINISH in Dinner | (a) until a Dinner audit | (b): DM-3R / DM-4 の settlement 不変条件を再設計。(c): 全 Dinner ピザが +1 タブ。D1b は Dinner を fail-closed で除外済み | UD-I と同一論点（下記） | P4b 前 |
| **OD-CS-6** | Lunch Rush and late recipes: include / exclude in the order pool | decide with #224 | FINISH は提供時間を要し `lunch-rush-v1` のランキング比較可能性に影響。現状は fail-closed で除外 | #224 の決着待ち | P4b 前 |
| **UD-I** | 後乗せレシピの Dinner / Lunch Rush: 両方除外／Dinner のみ再設計 | 両方除外（OD-CS-5/6 案） | 両方除外なら engine・UI とも追加作業なし | OD-CS-5/6 への回答が UD-I を兼ねる | P4b 前 |
| **UD-D** | 後乗せの本番出荷の帰属（TQ-2 Issue の起票者）: #294 OD-CS-1=A 踏襲（engine は CS、有効化は TQ-2） | 踏襲 | TQ-2 Issue は未存在。起票は Owner 了承後 | TQ-2 Issue を起票してよいか | P4a 前 |
| **UD-E** | ガイド（レシピ指定）の仕上げ表示: 後乗せレシピのみ表示／全レシピ常設 | 後乗せレシピのみ（現行レシピの見た目を変えない） | 全レシピ常設だと現行 55 レシピのタブが変わる。D2-0 の `finishStepAvailable` は「後乗せのみ」前提で実装済み | 回答が「常設」なら D2-0 の前提を見直す | D2-2 の前（実質 Phase 1 内） |
| **UD-F** | BBQ型の材料条件: `starGates` の有無、T4 価格、1 ステップ 2 素材、キー素材 | Batch 6 前例踏襲（Owner 数値） | ladder は追記専用・順序固定。Batch 7 の着地順で step 番号が決まる | Owner の数値（価格・星条件）。最新 ladder 末尾を P4b で再確認 | P4b 前 |
| **UD-G** | 新技法の名称・なぞかけ・Dex 表示コピー: Owner 文言 | — | 「調理法」欄は未発見＝「？？？」。なぞかけは動作を名指ししない（OD-TQ-5/6） | 文言そのもの | P4a/P4b |

## C. 回答の最小セット

- **FINISH 画面の実装（D2-1/D2-2、ガイドの BBQ のみ）に着手するための回答**: OD-CS-10（記録）、OD-CS-8、UD-E。
- **有効化まで**に追加で必要: UD-B/OD-CS-4、UD-D、UD-F、UD-G、UD-I（OD-CS-5/6）。
- OD-CS-5/6/UD-I を「両方除外」と回答すれば、追加の engine 作業は発生しない。
