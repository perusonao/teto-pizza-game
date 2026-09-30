# Roadmap / Handoff SSOT — Fresh Audit と更新提案

- **種別:** 監査と提案のみ。`PROJECT_HANDOFF.md`・Issue #22・他の Issue・`src/**` は変更していない。PR・merge なし。
- **Audited main SHA:** `5c8190ff8e0e094baab6e563e06e1a11c16c4a57`（fetch し直して確認、Discovery 3.0 Fresh Audit と同じ）。
- **姉妹文書:** `docs/reports/TETO_DISCOVERY-3_FRESH-AUDIT.md`（Discovery の中身）。本書は「計画がリポジトリだけで復元できるか」を扱う。
- **読んだ範囲:** `PROJECT_HANDOFF.md` 全体の構成と該当節、Issue #22 / #288 の本文、PR #319 / #321 / #296 / #295 / #293 の本文、open Issue 30 件と open PR 23 件の題名・更新日、`docs/` の題名一覧、`origin/claude/cut-scoring-audit-drh1e2` の CUT-S2 報告の冒頭。**#33 / #37 / #176 / #216 / #182 などの Issue 本文は読んでいない**（題名と更新日での分類）。下の分類のうち、そうした項目には「題名のみ」と付けた。

## 10. Roadmap / Handoff SSOT Audit

### 10.1 結論

**今のリポジトリだけでは、現在地・最優先・次・保留 lane は復元できない。** 新しいセッションが `CLAUDE.md` → `PROJECT_HANDOFF.md` → Issue #22 の順に読むと、次の状態を「現在」と受け取る。

| 読んだもの | そこに書かれている「現在」 | 実際 |
|---|---|---|
| Issue #22（最終更新 2026-09-18） | main は `398d484`、レシピ 7 件、最優先は Making Game 2.0 の Bake（PR #68 が open）、次の 5 slice は M3A / M2 / D3B / E1 / E-P3 | main は `5c8190f`、レシピ 25 件。M3A は merge 済み、`InventoryState` も存在する。Discovery / Hint 5.0 / Large Catalog / Techniques / Dinner は一切載っていない |
| `PROJECT_HANDOFF.md` 冒頭 | 2026-09-18〜23 の addendum が積み重なる（15 レシピ時代の記述を含む） | 上の addendum 群は履歴としては正しいが、優先順位を示さない |
| 同 `Re-prioritized ordered roadmap`（654 行〜） | P0 HOME → P1 Scoring → P2 Making Game 2.0（ACTIVE）→ P3 Scoring → P4 Pitz | 全項目が完了済みか置き換え済み |
| 同 `New-session startup checklist`（949 行〜） | 10 項目、すべて 2026-09-18 時点の PR #60〜#68 の話 | 現在の lane（Discovery・LC・Techniques・CUT）を指していない |

`PROJECT_HANDOFF.md` は 985 行。中段に 2026-09-28〜30 の lane 別の SSOT 節（Hint 5.0、Category Tabs、Large Catalog、Techniques）が挿入されていて、**lane ごとの現在地は復元できる。lane 間の優先順位と、保留 lane の位置づけが復元できない。**

### 10.2 検索で確認した「handoff に存在しない」もの

`PROJECT_HANDOFF.md` 内の出現数（0 = 一度も言及がない）:

| キーワード | 出現 | 備考 |
|---|---:|---|
| Trial Notebook / Original Pizza Recovery | **0** | P1〜P3-3b は main にある（#316 / #317） |
| CUT-S / Scoring 3.0 / #288 | **0** | CUT-S2 は専用 branch のみ |
| Cooking Steps / #294 | **0** | 設計と Owner Decision は PR #295（open）の中 |
| trajectory | **0** | CUT-S2 報告の「次の HV」にだけ存在 |
| Dough Guide / #321 | **0** | PR #321（open）の本文にだけある |
| Discovery 3.0 | **0** | 本日始まったばかり |
| Dinner | 5 | Dinner Mission は DM-4-3 まで main（#257 が親、open） |
| 25-recipe / Recipe Expansion | 2 | W1 の 25 件への移行は節として無い |

### 10.3 authority が merge されていない場所にあるもの

| authority | 場所 | main にあるか |
|---|---|---|
| Cooking Steps の設計と Owner Decisions（OD-CS-1 = A、OD-CS-2 = B、OD-CS-9、OD-CS-20） | PR #295（open、「Do not merge without Owner review」） | 無い（`docs/reports` に Phase 0 / 1A の古い結果はある） |
| 172 レシピの taxonomy / HCG（27 個の Owner Decision 候補） | PR #296（「Not an authority」）、#255、#293 | 無い |
| CUT-S2（Shadow 評価、Owner HV PASS 記録、trajectory の再 HV 項目） | `claude/cut-scoring-audit-drh1e2`（PR なし、main を merge 済みで最新） | 無い |
| Large Catalog R6-a の Preview 活用 audit | `claude/lc-preview-activation-r6b-f78gdv` の履歴（`4d2d6ae` / `7727cdc`、意図的に re-land しない） | 無い |
| Technique の 172 行 audit | `claude/cooking-techniques-design-n0qfwj`（commit `ab77b82`） | 無い（handoff に「design archive」とだけ書いてある） |
| Dough Guide Leak Fix（本体 + 結果レポート） | PR #321（open。Owner HV PASS 記載） | 無い |
| Discovery 3.0 Fresh Audit / 本書 | `claude/recipe-discovery-3-audit-t823yu` | 無い |

リモートには 322 の branch がある。「どの branch が生きた authority か」を示す索引が無い。

### 10.4 最新 Owner Direction との差分

| Owner Direction | repo 上の状態 | 差分 |
|---|---|---|
| Recipe Discovery が現在の最優先 product lane | どの文書にも書かれていない。#22 の最優先は Bake | **未記載。#22 と handoff は逆向きの優先順位を示している** |
| 「推理して発見する」が中心体験 | `PROJECT_HANDOFF.md` の Product goal は「見本を再現して高得点」（making 中心）。Discovery 側は Progression 2.0 の節と Hint 5.0 の節に分散 | Product goal が making 中心のまま。Discovery を中心に置く記述が無い |
| 「近い / 遠い」を中心情報にしない | production の P2 near-miss（0 Pitz）が近い/遠いの唯一の試作フィードバック。Notebook もその文言を保存 | **矛盾**（コード側は逆方向に実装済み）。Owner Decision 未記録 |
| key-topping は廃止候補 | Hint 5.0 は KEY_TOPPING を正式な rung として production ON（`hintKeyToppingId` を authored） | **矛盾**（OD-H5-C1 系が現行 authority）。廃止するなら Hint 5.0 の Owner Decision を上書きする明示的な決定が要る |
| sauce/base・cheese・材料数・材料分類を Hint 候補として再検証 | Hint 5.0 と DH4 の構造ヒントが近い材料を持つ。Discovery 3.0 audit で測定済み | 整合（再検証の出発点はある）。決定待ち |
| sauce なし / cheese なし / special steps へ拡張 | no-sauce = Technique（TQ-1D 予約）、cheese なし = Hint 5.0 の有料「なし」、special steps = PR #295（未 merge） | 整合するが、3 つの lane に分かれ、どれが先かがどこにも書かれていない |
| Trial Notebook を実験ノートに | P3-3b まで。一覧 UI なし。handoff に言及なし | 未記載 |
| 1 unlock = 1 recipe を必須にしない | ladder（LAD-1 で凍結）は 24 step すべてが 1:1。ladder の rule コメントは「key recipe」前提 | コードは 1:1 を強制していないが、ladder 生成規則と検証（`KEY_RECIPE`）が 1:1 を前提にしている |
| 候補レシピ名を並べる選択式にしない | Dex の「？？？」は名前を出さない。target 選択 UI は無い | 整合 |
| Discovery → 小さな Expansion Pack を縦に繰り返す | Recipe Expansion は Batch 1A〜1C（W1 の 25 件まで）の報告が main。W1 以降の計画が無い | 未記載 |
| CUT-S2 は凍結 | CUT-S2 は専用 branch に完了記録。#288 は open で「CUT-S0 から開始」と書かれたまま | 凍結の記録が無い。#288 の本文が現状より古い |
| CUT の将来目的は総合 score の quality component | #288 の本文は「bonus / 独立表示 / 100 点へ組み込み」の 3 案を並べ、独立表示（★に入れない）も候補 | **一部矛盾**（「独立 CUT score」「独立表示」案は方針外になる） |
| trajectory / CUT-S3 は最優先ではない | CUT-S2 報告に「trajectory HV」が次項目として残る。#288 の S3 は RESULT UI | 優先度の記録が無い |
| Dough Guide Leak Fix #321 は独立 Gate lane | PR #321（open、Owner HV PASS 記載、merge 待ち） | handoff に無い |
| Large Catalog は Expansion を支えるが Discovery を止めない | handoff の LC 節は詳細で、他 lane との順序が無い。R6 は capacity 未決で停止 | 順序の記載が無い |

**Discovery 3.0 の発見との関連で、Owner の候補順に影響する依存関係:**

1. **ヒント・フィードバックの決定（OD-D3-1〜8）が Expansion Pack 1 の前提。** Hint 5.0 は `RECIPE_HINT_ROLES`（key topping を authored）をレシピごとに要求する。key を廃止するなら、Pack のレシピに置く data が変わる。
2. **「actionable feedback」を名乗る前に、INCOMPLETE_MATCH の無料 oracle（Discovery audit §6）を決める必要がある。** P2 near-miss も含め、フィードバックの再設計が Notebook より先。
3. **Cooking Steps foundation は「no-sauce」の前提ではない。** no-sauce は Technique lane（TQ-1D）。Cooking Steps（#295）が扱うのは post-bake / late-add の機構。multi-spread の機構はどちらにも無い（172 matrix の capability 判定では 26 行が 2 層以上）。Pack 1 に multi-spread（hot-honey）を入れるなら別 slice が要る。
4. **CS-1b は PR #275 を待っていた（#295 本文）。#275 は main に merge 済みなので、この blocker は消えた。** ただし #295 自体が「Owner review まで merge 禁止」のまま。
5. **Pack に新食材を入れると taxonomy が必要。** T-COV の fail-fast gate は、family を持たない topping を含むレシピを Hint 5.0 の対象から外す（`NOT_A_TARGET`）。bell-pepper・zucchini・honey は production の taxonomy に無く、#296 の HCG でも候補の決定が要る。reuse-only のレシピ（新食材 0）はこの依存を避けられる。
6. **Unlock density は ladder 凍結（LAD-1）と、発見が ladder を早める効果の経済影響に縛られる。** 経済（Pitz の ORIGINAL 報酬 = P3-3）は handoff 上「pending」のまま。
7. **Large Catalog は Discovery を止めない。** ただし hand capacity（9 / 12）は「FREE で見える探索空間」を決めるので、フィードバックの強さの判断（OD-D3-13）に影響する。決定順は逆にならない（LC の Human Feel が先に決まる必要はない）。

## 11. 既存 SSOT の分類

A = 現在も有効、B = 実装済みで obsolete、C = 最新 Owner Direction で priority 変更、D = 最新方針と矛盾、E = authority 不明。

**CUT / Scoring / Cooking Interaction を先に進める古い順序は、最新 priority として扱わない**（C に分類し、理由を添えた）。

### 11.1 `PROJECT_HANDOFF.md`

| 節 | 分類 | 理由 |
|---|---|---|
| 冒頭の 2026-09-18〜23 addendum 群（〜303 行） | **B** | Scoring 2.0 A1〜A3、Dough D3A、Sauce Free、Pitz、RESULT 2.0、Cooking UI 1-Screen、CUT 全展開、Progression 2.0 Phase 1〜3-2 の完了記録。履歴として有効だが「現在」ではない。**15 レシピ前提の記述を含む。** |
| Discovery Hint 5.0（306 行〜） | **A**（内容）/ **C**（priority） | production ON の authority。key-topping 廃止の判断が出れば一部 D になる |
| Ingredient Category Tabs 1.0（351 行〜） | **A** | builder tray tabs は CLOSED。Large Catalog の節が補う |
| Large Catalog UX（376 行〜） | **A**（内容）/ **C**（priority: Expansion を支える lane） | LC-R3〜R5-e-h の状態は正確。R6 が次 |
| Cooking Techniques 1.0（415 行〜） | **A** | TQ-1A/1B/1C が main、inert。TQ-1D 予約 |
| Product goal（448 行〜） | **C** | making 中心。Discovery を中心に置く Owner Direction と順序が逆 |
| Current roadmap issues（464 行〜） | **B** | #32 / #33 / #47 / #39 / #38 が完了または完了寄り。#37 も主要部は完了（本文未読のため **E** とも）。当時の「次」の記述は obsolete |
| Navigation contract / Approved visual direction（610〜653 行） | **A** | 基本方針。変更の証拠なし |
| **Re-prioritized ordered roadmap**（654 行〜） | **B**（P0〜P4 の大半）/ **D**（P2「Making Game 2.0 ACTIVE」、P3 Scoring の後続） | 「CUT / Scoring / Cooking Interaction を先に進める」順序の出所。最新 priority と矛盾するので、そのまま使わない |
| Screen implementation timing（848 行〜） | **E** | 内容は読んだが、現在の lane とどう結ぶか不明 |
| Parallel / non-blocking（862 行〜） | **B** | HOME polish 等。#27 の現状は未確認 |
| Non-negotiable guards（870 行〜） | **A** | 保存互換・player-made shape・390×844 基準等。今も有効 |
| Preferred workflow（884 行〜） | **A** | Fresh Audit → 実装 → HV。`CLAUDE.md` の HV policy と整合 |
| New-session startup checklist（949 行〜） | **B / C** | 全 10 項目が 2026-09-18 の状態。Discovery・LC・Techniques を指す項目が無い |

### 11.2 Issue

| Issue | 分類 | 備考 |
|---|---|---|
| **#22 [SSOT] roadmap** | **B**（本文全体） | 7 レシピ、main `398d484`、Bake が最優先。Fresh 状態に対して古い（本文自身も「fresh が勝つ」と書いている） |
| #33 Dough / #32 Phase 4A-2.1 / #39 HOME / #47 Making UX | **B**（題名のみ） | handoff 上は完了。open のまま残っている |
| #37 Making Game 2.0 | **B / E**（題名のみ） | 主要 slice は handoff で完了（D3A、Sauce Free、Cooking UI 等）。親として閉じてよいかは本文未読 |
| #38 Economy（Pitz 報酬） | **B**（題名のみ）+ P3-3（ORIGINAL の Pitz）が未着手 | |
| #176 Gameplay UX / Scoring 3.0（調理工程・時間評価） | **C**（題名のみ） | 「CUT / Scoring / Cooking Interaction を先に」の系譜。後順位に下げる |
| **#288 Scoring 3.0: CUT skill score** | **C / D** | 凍結。本文の「独立表示（★に入れない）」案は最新方針と矛盾。S0〜S4 の段階は CUT-S2 の branch で S2 まで進んでいるが本文は更新されていない |
| #320 構成失敗の CUT 省略（#256 follow-up） | **A**（低優先） | |
| #216 / #182 Progression 2.0 | **A**（umbrella）/ **C**（priority: Discovery 3.0 が上位） | Phase 2 の設計（Hybrid ⭐ 曲線）は production の ladder と別物（production は OD-REC04-1 で「★は材料解放に使わない」）。**Phase 2 の ⭐ curve は D** |
| #238 Hint 3.0 / #253 Hint 4.0 | **B** | #292 で置き換え済み |
| **#292 Hint 5.0** | **A**（production ON）/ **C**（Discovery 3.0 が key-topping と線形 ladder を再検証する） | |
| #294 Post-W1 Cooking Steps | **A**（lane）/ priority は候補 P1 | 設計は PR #295（未 merge） |
| #269 / #270 Large Catalog / Undo | **A** | |
| #257 Dinner Mission（DM-4/5）+ #279 / #282 | **A**（後順位） | DM-4-3 まで main |
| #224 Lunch Rush ranking / #129 Player Profile / #134 Firebase / #87 Ranking | **E**（題名のみ） | 本 audit の範囲外 |
| #207 WebKit CI / #104 automation / #260 tooling drift | **A**（並行） | |
| #27（handoff が参照） | **E** | open 一覧に無い |

### 11.3 PR / branch

| 対象 | 分類 |
|---|---|
| PR #321 Dough Guide Leak Fix | **A**（独立 Gate lane、merge 判断は Owner） |
| PR #319 LC-R6-b | **A**（LC lane、Preview 基盤） |
| PR #295 Cooking Steps 設計 + CS-1a | **A**（未 merge の authority） |
| PR #296 / #293 / #255（172 taxonomy） | **E**（自身が「authority ではない」と明記） |
| PR #272（LC 旧実装） | **B**（porting source として凍結） |
| PR #307（LC-R4 完了の docs 同期） | **B**（LC-R4 はすでに main に反映済みの記録。未 merge の古い docs PR） |
| PR #72 / #46 / #34 / #3 | **B**（古い docs / 旧 PR。#22 期の報告が既に「stale」としたもの） |
| branch `claude/cut-scoring-audit-drh1e2` | **A**（CUT-S2 の記録。凍結） |

### 11.4 `docs/design` / `docs/reports`（抜粋）

| 文書 | 分類 |
|---|---|
| `PIZZA_GAME_SSOT.md` / `PIZZA_GAME_PROGRESSION_SSOT.md`（chapter 1 の解放 chain） | **E**（7〜15 レシピ時代。EP1 の `unlockCondition` chain はコードに残るが W1 の表示・gate からは外れている（OD-DISC-5）） |
| `TETO_RECIPE-DISCOVERY-PROGRESSION_2.0.md` / `TETO_PROGRESSION2_PHASE2_DESIGN.md` | **E / D**（⭐ 曲線は production ladder と異なる） |
| `TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md` | **A**（ただし key-topping 部分は **C**） |
| `TETO_COOKING-TECHNIQUES_1.0_SSOT.md` | **A** |
| `TETO_PIZZA-CUTTING_1.0.md` + Phase 1〜4B 報告 | **A**（CUT の実装記録） |
| `TETO_GAMEPLAY-UX_SCORING-3.0_Fresh-Audit.md` | **C**（後順位） |
| `TETO_RECIPE_172_MECHANIC-MATRIX*.md` / `data/*MATRIX.json` | **A**（母集団の authority。ただし未 merge の HCG に依存する部分あり） |
| `TETO_ROADMAP-SSOT_FRESH-SYNC_2026-09-18.md` | **B** |
| `TETO_DISCOVERY-3_FRESH-AUDIT.md`（本日） | 提案段階（未 merge） |

## 12. Proposed canonical roadmap（案）

Owner の候補順を repo 監査で検証した。**順序そのものは成立する。**ただし次の依存を明示する必要がある: (a) P1 の Expansion Pack 1 は P0 の決定（ヒント構造・key 廃止）の後、(b) no-sauce レシピは TQ-1D の後、(c) multi-spread / late-add は機構 lane の後、(d) 新食材は taxonomy の後。

記号: 並行 = ほかの項目と同時に進められるか。

| P | Lane | 現在の状態 | できるようになること | dependency | blocker | 次の具体的 slice | 並行 |
|---|---|---|---|---|---|---|---|
| **P0** | **Discovery 3.0** | Fresh Audit 完了（本日、未 merge）。Hint 5.0 production ON、P2 near-miss、Notebook P3-3b まで | 「推理して発見する」が成立する設計と決定。総当たり耐性とヒントの指標（ヒント後の残り R、pool 数） | なし（設計） | **OD-D3-1〜3、5〜8、10**（Owner） | **S0 = Owner Decision を docs に確定**、続けて S1 計測ゲート（テストと tools） | 他の P1 は並行可。Expansion Pack の data 作成だけ待つ |
| **P0** | **Discovery minimum loop** | attempt・near-miss・重複通知・Hint・Dex は main。Notebook 一覧 UI・整合表示が無い。INCOMPLETE_MATCH の oracle が未処理 | 発見 → 複数の未知 → 試作 → ヒントとノートから推理 → 発見 の 1 周を production で確認 | P0 の決定。reuse-only のレシピ 1 件（brazilian-calabresa、新食材 0・ladder 変更 0） | OD-D3-7 / 8（feedback 方式、oracle）、OD-D3-9（Notebook の仕様） | **S2 = brazilian-calabresa を追加して pool = 2 を作る**、S3 = INCOMPLETE_MATCH 文言、S4 = Notebook 一覧（P3-3c） | S2 と S4 は並行可 |
| **P1** | **Unlock / Discovery Density** | ladder は 24 step すべて 1:1（凍結）。束ね step と空振り step でないと 25 件だけでは分岐不可 | 1 unlock で複数の未知が開く progression | P0 の Owner Decision（OD-D3-5、6）。経済（P3-3 ORIGINAL の Pitz 報酬が pending） | LAD-1 の凍結方針。余分な発見が ladder を早める影響が未測定 | pace と経済の測定（tools）。reuse-only で pool の推移を見る | P0 と並行可（測定だけ） |
| **P1** | **Large Catalog** | LC-R3 / R5-b は main。R5-c〜e-h は休眠。PR #319（R6-b）open | 多数の owned ingredients から選びやすくなる（hand + pantry） | なし（Discovery を止めない） | hand capacity 9 vs 12 は R6 Human Feel 待ち。PR #319 の review | PR #319 の review、R6-c（Hand / Pin UI）の準備 | 並行可（他 lane と file が重ならない） |
| **P1** | **Cooking Steps foundation（+ Technique）** | #295（設計 + CS-1a）未 merge。TQ-1A/1B/1C は main、TQ-1D 未着手 | no-sauce（TQ-1D）、late-add / post-bake（#295）、multi-spread（機構なし）への拡張 | #295 の Owner review。CS-1b は #275 待ちだったが #275 は merge 済み | PR #295 の review。multi-spread の lane が無い | **#295 の review と、CS-1b の再開判断**。TQ-1D は OD-D3-12 の後 | 並行可 |
| **P1** | **Recipe Expansion Pack 1** | Pack 案 DV-1（Discovery audit §8）。Batch 1A〜1C（W1 25 件）は完了 | 新食材・新レシピで branching discovery を実ゲームで検証 | P0（ヒント構造）、taxonomy（新食材は #296 の HCG と T-COV gate）、ソースなしは TQ-1D | OD-D3-11（pack の採否）、naming cluster（NC-1 / NC-4）の review | reuse-only のレシピ（calabresa）から始め、新食材は taxonomy の決定後 | P0 の S2 と同一 slice にできる |
| **Loop** | Discovery 改善 → Expansion Pack → Discovery 改善 → … | — | 縦の vertical slice の繰り返し | 上記 | — | 各回に「R ≥ 2、pool、oracle」の計測ゲートを回す（S1） | — |
| **後** | CUT total-score integration | CUT-S2 は凍結（Owner HV PASS 記録あり）。#288 は open で本文が古い | CUT が総合 pizza score の quality component になる | Scoring ruleset / ranking の方針。#288 の再定義 | Owner 方針（凍結） | #288 の本文を「quality component 統合」に書き直す docs 変更（Owner 承認後） | 並行可だが着手しない |
| 後 | trajectory interaction / CUT-S3 | CUT-S2 報告に HV の持ち越し項目 | pointer trajectory を入力にした CUT | CUT-S2 の契約 | 凍結 | なし | — |
| 後 | BAKE feel | M3A は merge 済み | — | — | 優先度外 | なし | — |
| 後 | Dinner expansion | DM-4-3 まで main。#257 親、#279 / #282 follow-up | — | — | 優先度外 | なし | — |
| 独立 | **Dough Guide Leak Fix（#321）** | PR open、Owner HV PASS（WebM）、CI の WebKit 待ち | DOUGH で sauce guide が出る表示不具合の解消 | なし | Owner の merge 判断 | merge 判断のみ | **独立 Gate lane。他と完全に並行** |
| 並行 | polish | #320（構成失敗の CUT 省略）、CHEESE の hint 文言（#321 が既知として記録）、HOME polish | — | — | — | — | 並行可 |

**一つの注意:** Owner の「P1 の 4 項目」は互いに独立して進められるが、**Expansion Pack 1 の「実ゲームで検証」は P0 の S2 と同じ slice で始められる**（reuse-only 1 件）。Pack を別 lane として待たせると、P0 の検証が遅れる。

## 13. SSOT update proposal

**今回は何も書き換えていない。** 以下は Owner が承認した後にやる作業の提案。

### 13.1 canonical roadmap の置き場所

**`docs/ROADMAP.md`（新規、1 ファイル、200 行以内）を優先順位の唯一の authority にする。** 理由: `PROJECT_HANDOFF.md` は 985 行で、履歴と lane の詳細が混ざり、優先順位の更新が埋もれる。Issue #22 は GitHub のコメント欄に流れる性質があり、repo だけで読めない（復元条件に反する）。

`docs/ROADMAP.md` の構成案:

1. 更新日・audited main SHA・「fresh が勝つ」の一文
2. Owner Direction（日付つきの箇条書き。本書 §10.4 の左列）
3. lane 表（§12 の表。lane・優先度・状態・次の slice・blocker・凍結 flag）
4. 凍結 lane と再開条件（CUT-S2、trajectory、LC R6 の capacity など）
5. 「未 merge の authority」の索引（§10.3 の表。branch / PR → どの決定が入っているか）
6. 新セッション用の読み順（3〜5 行）

### 13.2 `PROJECT_HANDOFF.md` の更新案

- 冒頭に `docs/ROADMAP.md` への誘導を置く。「優先順位は ROADMAP.md、本書は履歴と lane の詳細」と明記する。
- `Re-prioritized ordered roadmap`、`Current roadmap issues`、`Parallel / non-blocking`、startup checklist の 10 項目に **`SUPERSEDED by docs/ROADMAP.md (2026-10-01)`** の帯を付ける。**削除はしない**（報告書から参照されている）。
- 冒頭の addendum 群（〜303 行）は `docs/archive/HANDOFF_HISTORY_2026-09.md` に移す案を検討（Owner 判断。行番号参照が報告書に残っているので、移動時は旧位置に 1 行の誘導を置く）。
- lane 別の SSOT 節（Hint 5.0、Category Tabs、Large Catalog、Techniques）は残す。各節の先頭に「priority は ROADMAP.md」と 1 行足す。
- Product goal に「推理して発見する」を反映する（Owner 承認後）。
- 新しい startup checklist: (1) fetch main と open PR / Issue (2) `docs/ROADMAP.md` (3) 該当 lane の節 (4) 該当 lane の最新 Result / Audit。

### 13.3 Issue #22 の更新案

- 本文を 40 行以内にする: 現在の main SHA、`docs/ROADMAP.md` へのリンク、P0 の 1 行、lane → Issue 番号の対応表、「fresh が勝つ」。
- 旧本文（7 レシピ、Bake 最優先）は**コメントとして保存**してから置き換える（履歴を失わない）。
- #22 は「索引」に徹し、優先順位の議論は ROADMAP.md の更新（PR）でやる。

### 13.4 obsolete roadmap の扱い

- 削除しない。帯（SUPERSEDED）を付けて `docs/archive/` へ移す、または位置を変えずに帯だけ付ける。どちらでも旧報告書のリンクは壊さない。
- 完了済みの Issue（#32 / #33 / #39 / #47 と、#37 / #38 の完了分）は Owner が確認してから close を提案。**この audit は close していない。**
- #288 は本文を更新（または follow-up コメント）して「CUT = 総合 score の quality component。独立表示案は取り下げ。CUT-S2 は凍結」を記録。
- #238 / #253 は #292 に置き換わったことを示すコメントを提案。
- PR #307 / #72 / #46 / #34 / #3 は Owner が close 可否を判断。

### 13.5 個別 Issue との責務分離

| 文書 | 持つもの | 持たないもの |
|---|---|---|
| `docs/ROADMAP.md` | 優先順位、lane の状態、凍結、未 merge authority の索引 | 設計の詳細、Owner Decision の本文 |
| lane の SSOT（`PROJECT_HANDOFF.md` の節、将来は `docs/lanes/*.md`） | その lane の Owner Decision、完了 slice、次の slice | 他 lane との優先順位 |
| 個別 Issue | slice の受け入れ条件と議論 | 全体の優先順位 |
| Result / Audit reports | 特定 SHA での事実（不変） | 「現在」の記述 |
| Issue #22 | ROADMAP.md への索引 | 本文の重複 |

### 13.6 drift を防ぐ仕組み（提案）

- `docs/ROADMAP.md` の冒頭に audited SHA を置き、`tools/` の小さな check（`--check`）で main の SHA との差（commit 数、`docs/ROADMAP.md` 以外の merge 数）を警告する。CI には入れず、新セッション開始時の確認用。
- lane を閉じる PR は、`docs/ROADMAP.md` の該当行の更新を含める（PR テンプレートの項目）。
- 未 merge の authority は、PR の本文に「authority か否か」を 1 行書く（#296 が既にやっている形式）。

### 13.7 復元テスト（合格条件）

新しいセッションが、`CLAUDE.md` と `docs/ROADMAP.md`、該当 lane の節だけを読んで、次の 4 点に答えられること: **現在地**（main と最新の完了）、**最優先**（Discovery 3.0、S0）、**次**（S1〜S2、ほか P1）、**保留 lane**（CUT-S2 凍結、trajectory、BAKE、Dinner expansion）。`CLAUDE.md` の「Read first」は `docs/PROJECT_HANDOFF.md` のままなので、これも `docs/ROADMAP.md` を先に読むよう更新する必要がある。

## 付録: この audit の限界

- #33 / #37 / #176 / #182 / #216 / #224 / #129 / #134 / #87 の Issue 本文は読んでいない。分類は題名・更新日・handoff の記述による。
- Owner Direction は依頼文の記述をそのまま使った。repo 内に同じ文言の決定記録は無い（本書がその差分を示している）。
- 322 の branch の内容は、CUT / LC / Discovery に関係するものだけ確認した。
