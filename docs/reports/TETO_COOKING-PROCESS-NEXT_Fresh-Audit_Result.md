# 新調理工程 Fresh Audit — Result Report（Task B、docs-only）

作成: 2026-11-04 / 基準 `main` = `0016222145c4c88253380d53d5df40607f58e655`（#743）/ 対象 Issue #294・#604・#579 ほか関連
性質: **調査のみ。** 実装・merge・Production ON・共有 Preview 更新・Issue/PR の作成や編集・claim 投稿はしていない。#394 のテストと CI 設定、既存 PR の範囲は変更していない。新規ファイルは本書（と姉妹の Task A 書）のみ。
**方法の限界:** Issue 本文・コメント、`lateCatalog.ts`・本番フラグ・`recipeSauceProfiles.ts` の読み取り、`TETO_COOKING-METHODS-NEXT_Research.md`（2026-11-02、main）、`FINISH-ENGINE_OWNER-DECISIONS`、`STATE-SYNC_2026-10-26`、炙り・炒めの Result の抜粋を読んだ。**アプリの実行・テスト実行・実機操作はしていない。** 「楽しさ」は設計上の見込みで、評価は助言であり Owner Decision ではない。`PROJECT_HANDOFF.md` は先頭 250 行のみ読んだ（全 1,146 行は未読）。
方針: **ドラッグ操作の単純統一は優先しない**（#478 は Draft のまま触れない）。食材・調理法ごとに違う操作を尊重する。

---

## 0. 結論（先に）

1. **「後乗せ」はすでに出荷済み**（`FREE_COOK_FINISH_PRODUCTION = true`・`LATE_CATALOG_PRODUCTION = true`）。late カタログに 7 レシピ + Pinsa が実在（ikura-salmon / yuzu-shrimp / eggplant-dengaku / eggplant-tahini / bbq-chicken / wasabi-beef / tarako-cream）。**#604・#611・#608・#294 の「未完」記述は古い**（§3 Issue の状態）。
2. **未実装で価値が高いのは「液体・ペーストの仕上げ」**（#579 の DRIZZLE）。FINISH は現状トッピング専用で、後乗せのソースを置けない。ただし**採点（#495、OD-CS-11 との整合）と識別の Owner 判断が先**。
3. **新しい加熱方法は「蒸す」が進行中**（#726/#738、実機 HV 待ち）。次の加熱は**「揚げる」が体験の上限は高いが、対象のナスに専用の絵が無い**ので art-first。「茹でる」「煮込む」は既存工程と重なり優先しない。
4. **次の実装候補は 3 件に絞る（§6）:** ①仕上げソース DRIZZLE（まず docs の設計 Gate）、②揚げる（ナスの絵が先）、③炒め 1B / 炙りの実機 HV 結果の取り込み（新規実装ではなく既存 Issue の続き。新しい調理法ではない旨を明記）。
5. **新規 Issue を立てる前に、Owner の許可と Duplicate Gate の再確認が要る**（今回は立てていない）。

---

## 1. 既存の調理工程の一覧

### 1.1 出荷済み（Production ON）
| 工程 | 食材・対象 | 入力 | 手掛かり | 備考 |
|---|---|---|---|---|
| DOUGH | 生地 | 伸ばす／縮めるドラッグ（D3A、双方向） | 生地の形・ガイドリング | Pinsa（生地の種類）は `PINSA_PRODUCTION = true` |
| SAUCE | tomato / pesto / olive-oil ほか | PAINT／PAINT_TEMPORARY（塗る） | ソースの field・残量ゲージ | `DRIZZLE` は TODO コメントのまま（`recipeSauceProfiles.ts` に 7 箇所） |
| CHEESE | チーズ | 溶けて広がる表現（Canvas は #468/#486 で別途） | — | |
| TOPPING | 全トッピング | タップ配置／scatter／マヨのストローク（`squeeze.ts`、Batch 13） | 位置・数 | SPRINKLE は撤回済み |
| BAKE | ピザ全体 | needle を 1 回タップ | 針位置（ガイドは時間で薄れる） | 5 段階判定・失敗は CUT/FINISH を飛ばす |
| CUT | 一部レシピ | カット | — | |
| **FINISH（後乗せ）** | late カタログのトッピング（roe・shiso・cilantro・white-sesame・wasabi・cod-roe・nori・arugula ほか） | タップ配置（`stage:"post"`） | — | トッピング専用。液体は不可（#579） |
| **炙る（Sear）** | sausage のみ | 長押し→離す（既定 3 秒で最大） | 色・熱の光・炎・煙・焼き目 | `SEAR_EXPERIENCE_PRODUCTION = true`。ただし Safari ツールバー開閉時のピル表示などは**未確認のまま**（`SEAR_PRODUCTION-ON_Result` §5） |

### 1.2 実装済みだが本番 OFF／Preview・DEV 限定
| 工程 | 対象 | 入力 | 状態 |
|---|---|---|---|
| 炒める（Prep 1B） | beef | タップ 3 回→「焼き加減を見て取り出す」タイミング（#696） | `PREP_EXPERIENCE_PRODUCTION = false`。実機 HV 指摘の修正済み、**Owner の実機再検証待ち** |
| **蒸す（Steam）** | clam / mussel | A: ふたタップ ／ B: 鍋ゆすり | `STEAM_EXPERIENCE_PRODUCTION = false`。#738 は HV 待ち（Task A） |
| 四角天板（Square-Pan） | grandma-pizza | 四隅へドラッグ | #581 は open、#540 は HOLD／Draft |
| 溶けるチーズ Canvas | mozzarella | — | #468（Pilot）、#486 に本番採用 Gate |

### 1.3 未実装
| 工程 | 状態 | 出典 |
|---|---|---|
| **仕上げソース（DRIZZLE／液体の後乗せ）** | 未着手。#518→FINISH D2-2 が前提とされ、その後 #579 | #579 |
| 揚げる | 調査のみ。対象ナスに専用絵なし | Research §3 |
| 煮込む | 調査のみ。SAUCE と重なる | Research §2 |
| 茹でる | 調査のみ。炒めとほぼ同型 | Research §2 |
| 割る（卵） | 演出。専用絵なし | Research §2 |
| **mid-bake（焼成中追加）** | `cod-roe` は mid_bake を POST_BAKE で**近似**しているだけ。真の mid-bake は未実装 | `lateCatalog.ts` |
| 複数ソース（Multi-Sauce） | S3 グランマは HOLD。四角生地 A〜D・F 完了待ち | #521、#540 |
| ZONED（ゾーン別） | 将来フェーズ。#579 の非目標 | #579、PR #620 |
| トレイドラッグ統一 | Draft。**優先しない** | #478 |
| 食材別 PLACE/SCATTER の操作差 | Human Feel の Fresh Audit | #476 |

## 2. 候補の比較: 後乗せ・仕上げソース・新しい加熱／加工

評価: ◎ 良い／○／△／✕。コストは実装規模の目安（炙り Phase 1 = 新規ファイル中心 + `gameReducer.ts` 約 +22 行、`GameScreen.tsx` +22 行を 1 単位とした相対）。

| 候補 | 操作の楽しさ（見込み） | 食材との相性 | 実装コスト | 保存・採点・識別への影響 | 既存と重なるか | 総評 |
|---|---|---|---|---|---|---|
| **A. 後乗せ（固形）** | ○（タップ配置） | ◎ 済 | 済 | 済（OD-CS-11=A：既存成分で採点） | 完了 | **出荷済み**。追加は「レシピを増やす」データ作業 |
| **B. 仕上げソース／DRIZZLE（#579）** | ◎（細い線を引く・量を手で決める） | ◎ タヒニ・柚子胡椒・はちみつ・マヨ・ドレッシング・オリーブ油（TODO が 7 箇所ある） | **中〜大**: FINISH の `PLACE_TOPPING` は `category !== "topping"` を拒否。在庫関数 `canPlacePostBakeIngredient`、`sauceIds` との関係、描画（液体）。**ただしマヨの `squeeze.ts` が線ジェスチャの先例** | **要 Owner 判断**: 採点は OD-CS-11 と #495（後乗せ要件を除いた暫定スコアの評価）が**未決**。識別の `late` 軸は E2 で OBSERVED 化済み。保存は `PlacedTopping` 系の拡張が要るか不明 | 重ならない（#521 の判断 9「はちみつ／マヨ／ドレッシングは FINISH が液体対応するまで保留」と接続） | **最有力。ただし先に設計 Gate** |
| **C. 蒸す（#726）** | ○〜◎（殻が開く出来事） | ○ clam/mussel（3 レシピ）に限る | 小〜中（済）| なし（transient） | 炒めのタップ判定に近い恐れ（H3） | **進行中**。次は実機 HV であって新規実装ではない |
| **D. 揚げる** | ◎（泡・ジュワ） | ○ ナス（9 レシピ）。ただし**専用絵なし**で対象規則（絵があること）を満たさない | 中〜大 + **アート先行**（Ingredient Icons 2.0、Style Lock V2、Owner 判断） | なし（任意・transient の枠） | 色の進行が炙りと近い（△） | **2 番手。art-first** |
| **E. 煮込む** | ○（混ぜる円運動） | △ 具だけを煮る出荷済み食材が乏しい（curry-pizza-japan の chicken+onion、rendang の beef は炒めと対象が重複） | 大（SAUCE との境界設計） | **SAUCE を扱うと採点に波及** | SAUCE と重なる | 後回し |
| **F. 茹でる** | △（タップで引き上げ） | △ | 小 | なし | **炒めとほぼ同型** | 却下寄り（重複） |
| **G. 割る（卵）** | ○ | △ 専用絵なし・5 レシピ | 小 | なし | 加熱ではなく演出 | 別枠 |
| **H. 炙り Phase 2（他食材）** | — | — | — | — | — | Owner が 2026-11-02 に**保留** |
| **I. mid-bake 追加** | ○ | cod-roe など | **大**（MAJOR：焼成の途中状態を持つ） | 採点・保存に波及 | FINISH で近似済み | 優先しない |

**手触りの割り当て（食材ごとに違う操作を尊重する観点）:** 現在は「時刻当て（炒め）」「長押しで量を決める（炙り）」「出来事を待つ／ゆすり（蒸す）」と、手掛かりが**色**に偏っている。Research の結論（色以外の手掛かり＝出来事）と整合。次に加える仕上げソースは「**線を引く（量と軌跡）**」で、既存のどれとも手触りが違う。

## 3. 保存・採点・識別への影響

| 候補 | 保存 | 採点 | 識別（Anti-Oracle） | 備考 |
|---|---|---|---|---|
| 蒸す・炒め・炙り | **変更なし**（transient: `steamedLook` / `preparedLook` / `searedLook`、`pendingRound` journal に載せない） | **変更なし** | 食材 id のみで出す → 漏れない | 3 つとも独立した状態で相互に干渉しない設計 |
| 仕上げソース | `PlacedTopping`（`stage:"post"`）の拡張か新しい型かが**未決** → schema v2 を変えずに済むか要確認 | OD-CS-11=A（既存 Pieces / Recipe 成分、配点 52/16/12/20 不変）だが、**液体を Pieces か Sauce のどちらで数えるか**が未決。#495 も未決 | `late` 軸は E2 で OBSERVED 化済み。**液体の追加で Hint 5.0 gate（G7）・Research ○× 台帳・STRUCTURE 件数に時機の情報が漏れないこと**を再監査 | Dinner / Lunch Rush は当面除外（UD-I） |
| 揚げる | なし（任意・transient） | なし | なし | 絵が先 |

## 4. Duplicate Gate

調査日 2026-11-04。open の Issue/PR を「揚げ／茹で／煮込／仕上げ／DRIZZLE／はちみつ／蒸／ドラッグ」で検索し、タイトル一覧と照合した。

| 候補 | 既存の Issue/PR | 判定 |
|---|---|---|
| 後乗せ（固形） | #604（識別・技法）・#611（BBQ データ）・#608（Free 仕上げ UI）・#294（親）。**実装は E2/E3/E4/E5 で完了、コードに実在** | **重複／済**。新規 Issue 不要。**クローズ候補の Issue 整理が必要**（§5） |
| 仕上げソース／DRIZZLE | **#579**（整理・追跡のみ）。#476（DRIZZLE は食材別操作の候補と言及）、#521（判断 9 で保留）、#489（残量ゲージ） | **#579 が authority。新規 Issue は作らない**。着手は #579 の更新で |
| 蒸す | #726 + PR #738（S1 = #729・S2 = #734 は merge 済み、S3 = #738 は open） | **重複**。新規実装は不要、HV が次 |
| 炒め | #696（1B）、spec: Cooking Prep Phase 1 SPEC | **重複** |
| 炙り | #724（Phase 1）、#727（Production ON）。コードは true | **重複** |
| 揚げる | **該当する Issue なし**（#726 本文の範囲外記述のみ）。アート側は #417（Icons 2.0 親）、#438（Pilot A: hot-dog/sausage/feta/ricotta）、#623（Pilot D: salmon/cream-cheese）、#733・#739（視認性 follow-up）。**ナスの専用絵を扱う Issue は見当たらない** | **新規。ただし先に Owner がアート方針を決める**（Style Lock V2 の「Production 実装は #423 完了まで禁止」の解除状態を再確認） |
| 煮込む／茹でる／割る | 該当なし | 新規だが**優先しない** |
| トレイドラッグ統一 | #478（Draft）、#476 | **優先しない**（依頼どおり） |
| mid-bake／ZONED／複数ソース | #620（PR、docs-only 監査）、#521、#540（HOLD）、#579 の非目標 | 重複・保留 |

**他セッションの claim:** #726 に S3 の claim（`claude/cooking-steam-s3-ui`、期限 2026-11-10）。本書の docs は別ファイルのみで、`PizzaStage.tsx`・`GameScreen.tsx`・`App.tsx`・`gameReducer.ts` を含め重なりなし。

## 5. Issue の状態（古い記述の整理候補）

**クローズや編集は Owner の判断であり、本書は何も変更していない。**

| Issue | 記載上の状態 | 実際（コード・コメント） | 提案 |
|---|---|---|---|
| #294 | 「CS-0 design done, STOP before implementation」（Status が 9 月のまま） | CS-1/CS-2/CS-3 相当は実装済み（FINISH engine・late 軸・E3・E5・late カタログ 本番 ON） | Status 表を更新（Owner の指示後）。親 Issue として残す理由は CS-4 以降（7 タブ、major 群） |
| #604 | 「E4 の BBQ データが未完」（2026-10-27） | `bbq-chicken-pizza`・`bbq-sauce`・`cilantro` は `lateCatalog.ts` に実在。E5 は #654 で本番 ON | **クローズ検討**（残りは実機 HV の R8・AC-8・O-12 の扱い次第、Owner が 10/27 に「ここではクローズしない」と判断済み） |
| #611 | Owner Decision Report（D-1〜D-6 回答待ち） | 実装は進んだ（BBQ は実在） | 回答済みなら決定の記録＋クローズ検討 |
| #608 | FIN-E3b | E3（#607・#609）merge 済み | クローズ検討 |
| #579 | 整理・追跡のみ | **本件で唯一「未着手のまま価値が高い」** | 残す。設計 Gate の親にする |

## 6. 次の実装候補（最大 3 件）

順位は助言。**どれも Owner の GO が前提で、今回は着手しない。**

### 候補 1: 仕上げソース／DRIZZLE（#579 を親に）
- **なぜ**: 唯一の「ソースを焼成後に置く」手段。タヒニ・柚子胡椒・はちみつ・マヨ・ドレッシング・オリーブ油の仕上げに効き、`recipeSauceProfiles.ts` の TODO（7 箇所）にも対応する。手触り（線を引く＝量と軌跡）は既存と違う。`squeeze.ts` の先例がありゼロからではない。
- **コスト・リスク**: 中〜大。`PLACE_TOPPING` の category 制限、在庫、描画、採点。**採点（#495／OD-CS-11 の液体の扱い）と識別の漏れ**が最大の不確実性。
- **進め方（提案）**: ① **docs-only の Fresh Design（設計 Gate）**: Owner 決定 4〜5 件を整理（液体を Pieces/Sauce どちらで採点するか・保存の型・対象 1〜2 食材・Dinner/Lunch Rush の扱い・Anti-Oracle 再監査）② Preview/DEV 限定で 1 食材（例: はちみつ or マヨ）の Phase 1 ③ 実機 HV。本番 OFF フラグ付き。
- **前提確認**: #518（焼成フィルターが後乗せ piece にかかる問題）が実質解消済みか（FINISH D2-2 の Result 群に対応があるが、Issue は open のまま）。

### 候補 2: 揚げる（ナス）— art-first
- **なぜ**: 体験の上限は最も高い（泡・ジュワ・引き上げ）。出荷済み 9 レシピ（melanzane, parmigiana, alla-norma, sichuan, moussaka, ratatouille, pesto-vegetariana, eggplant-ricotta, baba-ganoush）に効くが、**baba-ganoush は焼きで揚げは不一致**なので実質は 8 前後。
- **ブロッカー**: ナスに `pieceVisual`（専用絵）が無く、炒め・炙り・蒸しと同じ対象規則を満たさない。
- **進め方（提案）**: Ingredient Icons 2.0 の枠で「ナスの専用 SVG」を Owner が優先するかをまず決める。絵が出来てから、揚げる Phase 1 の設計（ドラッグ in → 泡 → 引き上げ、タップ代替必須）。色の進行が炙りと近い点は、**「泡の量と音」など色以外の手掛かり**で差別化する案を設計 Gate で検討。

### 候補 3: 炒め 1B／炙りの実機 HV 結果の取り込み（新しい調理法ではない）
- **なぜ**: 新規実装ではなく**既存 Issue（#696・#727）の完了条件**。炒めは本番 OFF のまま Owner の実機再検証待ち、炙りは本番 ON だが Safari ツールバー開閉時のピル表示などが未確認。**調理法を増やす前に、既に増やした 3 つ（炒め・炙り・蒸し）が実機で成立しているか**を揃える価値が高い（蒸しの H7 も同じ iOS 固有の問題で、判断が連動する）。
- **進め方**: 実機 HV の観点を 3 工程で共通化（ピル位置、ghost click、長押し/ドラッグの競合）。docs の HV チェックリスト 1 枚で足りる可能性が高い。

**候補外にした理由**: 蒸す（進行中。次は HV）、茹でる（炒めと同型）、煮込む（SAUCE と重なる）、割る（演出）、mid-bake（MAJOR）、炙り Phase 2（Owner が保留）、トレイドラッグ統一（優先しない）。

## 7. Owner 判断事項（Task B）
1. **#579 の設計 Gate（docs-only）に進んでよいか**。進める場合の前提決定: (a) 液体の採点（Pieces/Sauce）と #495 (b) 保存の型 (c) Phase 1 の対象 1〜2 食材 (d) Dinner/Lunch Rush の扱い。
2. **ナスの専用絵（Ingredient Icons 2.0）を優先するか**。優先しない場合、揚げるは保留。Style Lock V2 の #423 条件の現状も要確認。
3. **#294・#604・#611・#608 の Status 更新／クローズ**（古い記述の整理。#604 は Owner が 10/27 に保留と判断済み）。
4. **炒め・炙り・蒸しの実機 HV を一本化するか**（候補 3）。
5. 新規 Issue（揚げる、仕上げ HV チェックリスト等）の起票許可。
