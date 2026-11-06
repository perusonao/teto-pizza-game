# Cooking Methods Fresh Audit — FRY #749 / STEAM #738 / 新調理工程ロードマップ（docs-only）

作成: 2026-11-06 / 基準 `origin/main` = `785d7956b42eac97e42dbd138818262a16c0a91c`（#759 Batch 18、2026-11-06T22:15+09:00）/ ブランチ `claude/teto-cooking-methods-audit-ku35ki`
性質: **調査・設計のみ。** 変更ファイルは本書 1 つ。`src/`・`e2e/`・CSS・SVG・JSON・設定は変更していない。PR 作成・merge・Production ON・共有 Preview 更新・既存 PR への push・claim 投稿・Issue 作成はしていない。
HV: docs-only のため対象外（`TETO_HUMAN-VERIFICATION-POLICY.md`）。
表記: 【実測】= この監査で GitHub / コードを直接確認／【推論】= 設計上の見込み／【未確認】= 確認していない。「推奨」は助言であり Owner Decision ではない。

既存資料と重複させない: 一次比較は `TETO_COOKING-METHODS-NEXT_Research.md`、揚げる設計は `TETO_COOKING-METHODS-AFTER-STEAM_Design-Audit.md`・`TETO_COOKING-FRY_PHASE1_F1_Result.md`、蒸す設計は `TETO_COOKING-STEAM_PHASE1_Plan.md`・`_S2_Design.md`。本書は **それらの後に変わった事実と、実装順序の判断材料**だけを書く。

---

## 0. 結論（先に）

1. **最新状態は「過去報告」とほぼ一致したが、2 点が古かった。**
   - 「F2 は #738 merge 後」という前提（F1 Result §6）は**ファイル競合の実測では過剰**だった。#738 の差分は `App.tsx`／`PizzaStage.tsx`／`GameScreen.tsx`／`main.tsx` のみで、`gameReducer.ts`（F2 の対象）に触れない【実測】。実際に競合するのは **F3（UI 配線）** であり、F2 ではない。
   - #738 は Owner の「ゲーム性がない」判断（#755、2026-11-05）後も **S3 のまま HOLD**。蒸すは「#738 を merge する」より先に「**どの体験を本線にするか**」が未決（§3.4）。
2. **FRY と STEAM は同じ HOT 4 ファイルに F3／S3 で触れるため、UI 配線は直列化が必要。** それ以外（絵・設計・テスト計画・F2 reducer）は独立に進められる。
3. **推奨: 案 C（独立部分だけ並行、UI 配線は STEAM → FRY の順で直列）。** ただし着手の前に Owner 判断 5 件（§11）が要る。
4. **判定: CONDITIONAL GO — Phase 0 / Phase 1（docs・絵の設計・受入条件・テスト計画）のみ。F2 以降・S4・Production は HOLD。**
5. 「実装量が少ない方」で選ぶと FRY（F1 完了済み）だが、**ゲームとしての伸びしろは FRY の方が大きい**【推論】。蒸す A は 4.5 秒で全開（時間で結果が決まる）ため、Owner が既に「判断が少ない」と評価した構造のまま（#755）。揚げる A/B は「泡を見て**引き上げ時刻を自分で選ぶ**」ので、少なくとも判断が入る。

---

## 1. 監査範囲（正直な記録）

| 区分 | 確認したもの | できなかったこと |
|---|---|---|
| 規則 | `CLAUDE.md`（全文）、`PROJECT_HANDOFF.md`（FRY / STEAM / Batch の記載を grep。**FRY・STEAM の記載は無し**、蒸す・揚げるは Handoff 未反映）、`SESSION-OPERATIONS_1.0`・`HUMAN-VERIFICATION-POLICY` は既存設計書の引用経由 | 両文書の全文再読 |
| GitHub | open PR 全件の一覧、#749（本文・コメント）、#738（本文・全コメント・check run・review thread）、#763（本文・コメント・check run・review thread）、#757 の check run、#746 本文、#751・#753・#765 本文、#755（本文・全コメント）、#726 の claim コメント、#748（本文・全コメント）、#579 本文、open Issue 上位 30 件 | #756・#757・#762 の本文全文、#747 Runbook 本文、#726 の S3 以降のコメント、Issue 116 件の全走査 |
| コード（main `785d795`） | `git ls-tree` で FRY / STEAM / DRIZZLE のファイル、`gameReducer.ts` の STEAM 記述、`fryExperienceGate.ts`・`steamExperienceGate.ts`、`ingredients.ts` の `eggplant`（`pieceVisual` なし）、`pieceVisual` 一覧 | アプリ実行・Vitest・E2E・build（**未実行**。`node_modules` なし）。PR の動画・画像の目視 |
| 競合 | `git merge` の試行（作業ツリーのみ・直後に破棄）: main ← #738／#746／#757／#763 の単独、#738+#746、#738+#763、#746+#763 | CI の再実行（不要なため行わず） |
| 設計資料 | `COOKING-METHODS-NEXT_Research`（前半）、`COOKING-METHODS-AFTER-STEAM_Design-Audit`（全文）、`COOKING-FRY_PHASE1_F1_Result`（全文） | `COOKING-STEPS 1.0`／`COOKING-STEAM_PHASE1_Plan`／`S2 Design`／`S3 Design`／`Ingredient Icons 2.0 Style Lock V2` の本文。#753 は PR 本文のみ（eggplant A 案＝輪切りを採用記録、docs-only） |

---

## 2. Fresh State（STEP 1）

### 2.1 main と Batch 18／19
| 項目 | 結果 |
|---|---|
| origin/main | `785d7956b42eac97e42dbd138818262a16c0a91c`（#759 を Squash merge。**既知情報と一致**）【実測】 |
| 直近の main | #759 B18、#768 test、#761 shiso 1.35em、#765 layout（360px 横はみ出し修正、`merged_at 2026-11-06T04:07Z`。PR タイトルは `[HOLD / Draft]` のままだが **merge 済み**）、#760 beef/pepper icons、#750 FRY F1、#734 STEAM S2 ほか |
| Batch 19 | **docs-only の事前調査まで**。Owner 判断（#748 comment `6673566588`、2026-11-06）: burrata（SVG 案 C）＋ pesto-burrata／crudaiola（Jaccard 0.429 の個別例外）。**実装前提 3 件（#765・#759・#760）は main に merge 済み**【実測】。残る条件は「claim の解消と main・Research ラベル・Hint の再検証」。ランタイム実装は未着手・未承認。**`ingredients.ts`／`recipes.ts` を触るため、eggplant の絵（FRY）と同じファイルで競合する** |

### 2.2 open PR / Issue（本件に関係するもの）
| # | 内容 | 状態【実測】 |
|---|---|---|
| #749 | FRY 管理 Issue | open。F0/F1 承認済み、F2〜F4 HOLD、Production ON 禁止 |
| #750 | FRY F1 | **merged**（`c69cb2b`） |
| #751 | FRY の絵の状態 addendum（docs-only） | **draft**、未 merge |
| #753 | eggplant A 案（輪切り）を Style Lock V2 §12 に採用記録（docs-only） | open（non-draft）、未 merge。G2（`pieceVisual` 追加）は未着手 |
| #726 | STEAM 管理 Issue | open。S1（#729）・S2（#734）は merged |
| #738 | STEAM S3（UI・描画・HV 入口） | open（non-draft）。HEAD `2ac98201`、base `49e2add` で **main に 15 commit 遅れ** |
| #747 | S3 iPhone HV 手順書（docs-only） | draft |
| #755 | STEAM ゲーム性 Pilot（Owner「ゲーム性がない」） | open。V1=#756、V2=#757、V3=#763 の 3 本の draft |
| #762 | V3 の別設計（`[HOLD / Draft・マージ禁止]`） | draft。#763 とは数値が異なる別設計（#755 の Owner コメントが「混同するな」と明記） |
| #746 | DRIZZLE Gesture Lab（`?drizzleLab=on`、独立画面） | open（non-draft）。`main.tsx` 1 分岐のみ |
| #579 | POST_BAKE ソース後乗せ（DRIZZLE 候補）の整理 | open（整理・追跡のみ） |
| #748 | Batch 18 管理 Issue | open（#759 merge 後も open）。Batch 19 preflight の Owner 判断が追記されている |

### 2.3 claim と期限（今日 = 2026-11-06）
| claim | 範囲 | 期限 | 状態 |
|---|---|---|---|
| #749（F1） | `src/logic/fry/**` ほか F1 の新規ファイル | 2026-11-18 | F1 は merge 済みで実質完了。**F2 以降の範囲（`gameReducer.ts` ほか）は claim 外**。F2 着手には新しい claim が要る |
| #726（S3） | `SteamLayer.tsx`・`PizzaStage.tsx`・`GameScreen.tsx`・`App.tsx`・`e2e/cooking-steam.spec.ts` ほか | **2026-11-10（残り 4 日）** | 期限が近い。#738 が HOLD のまま失効する恐れ |
| #748（B18） | `recipes.ts`・`ingredients.ts`・`lateCatalog.ts`・`discoveryLadder.ts` ほか | 2026-11-19 | #759 merge 済みで**実質は役目を終えた**が未失効。**eggplant の絵（`ingredients.ts`）と Batch 19 は、この claim の整理が先** |
| #755 系（#756/#757/#763） | `src/logic/steam/steamGame*.ts`・`src/preview/SteamGameLab*`・`main.tsx`（統合は未承認） | 本監査では claim コメントを未確認【未確認】 | — |

> 他担当の claim は変更していない。期限切れ・失効の扱いは Owner 判断（§11 O-1）。

---

## 3. FRY #749 の現状（STEP 2）

### 3.1 実装・Gate 状態【実測】
| 項目 | 状態 |
|---|---|
| F0（Issue + claim） | 完了 |
| F1（純粋ロジック・未配線） | **完了・main に merge 済み**（#750、`c69cb2b`）。新規ファイルのみ: `src/logic/fry/{fryPot,fryTap,fryDrag,friedLook,fryOffer}.ts`＋テスト、`src/data/{fryIngredients,fryExperienceGate}.ts`、`src/preview/fryPreview.ts` |
| F2（reducer `FRY_INGREDIENT`） | **HOLD・未着手**。`gameReducer.ts` に FRY の記述なし |
| F3（UI・Preview/DEV 入口） | **HOLD・未着手** |
| F4（E2E・iPhone HV・Result） | **HOLD・未着手** |
| 配線 | `logic/fry`・`fryIngredients`・`fryExperienceGate`・`fryPreview` を **自分以外から import しているファイルは 0**（grep で確認） |
| Production OFF | `FRY_EXPERIENCE_PRODUCTION = false`。ON の経路は Preview/DEV の `?cookFry=on` のみで、F3 まで誰も読まない |
| eggplant の絵 | `ingredients.ts` の `eggplant` に `pieceVisual` **なし**（`emoji: 🍆` のみ）。このため **`canFryIngredient("eggplant") === false`（休眠）**。#753（docs-only、G1 = A 案「輪切り」採用記録）は未 merge、G2（ランタイムの絵）は未着手 |
| 対象レシピ | 出荷済み 9 レシピが eggplant を使う（`recipes.ts` の出現 24 行は同数のレシピ周辺の参照を含む。**9 は既存設計書の機械走査値で、本監査では再計数していない**【未確認】） |

### 3.2 技術的な依存関係
| 依存先 | 内容 | 競合 |
|---|---|---|
| `gameReducer.ts`（HOT） | F2: `fryLook`（transient）と `FRY_INGREDIENT`、`RESET_PIZZA` の分割代入に 1 語。**追加のみ**。STEAM S2（#734）が同じ形で入っており、そのコードがテンプレート【実測】 | **#738 とは非重複**（#738 は reducer に触れない）。#749 の F2 設計「#738 merge 後」は**競合回避としては不要**だった。炒め・炙り・蒸すの reducer 部分は別 case のため、同ファイル追加でも textual conflict は起きにくい【推論】 |
| `PizzaStage.tsx`・`GameScreen.tsx`・`App.tsx`（HOT） | F3: 見た目スロット・ピル・ステージの一時画面 | **#738 と同じ 3 ファイル**。直列化が必要 |
| `src/main.tsx`（HOT） | F3: HV 入口 `?cookFryHv=1` | **#738・#746・#757/#763 が同じファイルを編集**。後述 §5 |
| `ingredients.ts`・`IngredientGlyph.tsx` | eggplant の `pieceVisual`（G2） | **#748 の claim、Batch 19（burrata）、Icons 2.0 follow-up（rosemary/oregano/spinach/artichoke の Owner 承認済み設計）と同じファイル** |
| 既存の焼成 | 焼成 filter は外側ラッパー、揚げ filter は内側 `.ingredient-glyph` の `filter` のみ（蒸すで実証済みの共存方式を踏襲）。`friedLook` は `--fry-*` 変数のみ【実測: F1 Result・テスト】 | 蒸すと同じ方式のため、焼成との相互作用リスクは STEAM と同等 |
| 保存・採点・識別 | transient、`pendingRound` の許可リストにフィールドを足さない。schema 変更なし【設計・architecture test で固定】 | 保存互換リスク **低**。ただし F2 で `GameState` に型を足す点だけは reducer 変更リスク（§7） |
| 完了判定 | 引き上げ時の `amount`（0〜1）で決まる。over だけ厳密に 1。判定は `fryLookOfAmount` で逆引きできる | — |

### 3.3 UX の評価【推論。実機未確認】
| 観点 | 評価 |
|---|---|
| タップ（A）で成立するか | 成立するが、**炒め（タップ時刻当て）と手触りが近い**（既存設計書の指摘どおり）。差別化は「手掛かりが色でなく泡」。A は **B の代替入力として必須**なので捨てない |
| ドラッグ（B）に楽しさがあるか | **未確認**。「具を油へ沈める→放して待つ→上へ引き上げ」は炒め／炙り／蒸すにない入力語彙で、放して待てるため指で泡が隠れない。縦ドラッグとスクロールの競合・疲労は**実機でしか決まらない**。**B を必須条件にしない**（依頼どおり。Owner 判断 O-5 は「A/B を比較」で据え置き） |
| iPhone 1 画面 | ステージ内の一時画面（蒸すと同じ流儀）。**蒸すで実証済み**（#738 の E2E 390×844／360×800／390×664）。FRY 単体では**未実装のため未検証** |
| 難易度・所要時間 | 設計上 +6〜10 秒／1 回。泡の段階 5 つ（big 0–2.0s／medium–3.5／fine–6.5／calm–8.5／still 以降）。**時間境界は PROVISIONAL**（HV で調整） |
| 見た目の変化 | あり（raw→crisp→over の `filter`：明るさ・彩度・セピア・つや）。**ただし eggplant の絵が無い限り何も見えない** |
| 達成感 | 「カリッと」の見た目のみで、スコア・星・Dex・Pitz は動かさない設計。**達成感は演出に依存**（音・つや・泡が止まる瞬間）。ここは F3 の HV で評価する領域で、現状は未知 |

**FRY 固有の論点（新しい判断材料）:**
- **「ゲーム性がない」(#755) への耐性:** 蒸す A は `steamLidLevelAt`（4.5 秒で全開）で結果がほぼ時間決定。FRY は「泡を見て自分で引き上げを選ぶ」ため、少なくとも**判断が入る**（早い→生っぽい／カリッと／遅い→揚げすぎ）。ただし**「失敗状態なし・採点なし」のため、上達の報酬がない**。Steam V2/V3 の教訓（#757 のレスキュー、#763 の ★評価）を FRY に持ち込むかは Owner 判断（§11 O-4）。F2 に入る前に決めないと、reducer の形（`amount` だけ持つか、評価を持つか）が変わる。
- **対象が eggplant 1 食材のみ**（#749 の Owner 判断）。絵が無い間は完全休眠。絵が付いても Phase 1 の体験が届くのは eggplant を使う既存レシピ（既存設計書の数値で 9）だけ。

---

## 4. STEAM #738 の現状（STEP 3）

### 4.1 実装・Gate 状態【実測】
| 項目 | 状態 |
|---|---|
| S1（純粋ロジック） | **merged**（#729） |
| S2（reducer `STEAM_INGREDIENT`／`steamedLook`） | **merged**（#734）。`gameReducer.ts` に実在、`steamExperienceEnabled()` と `canSteamIngredient()` でガード |
| S3（UI・描画・HV 入口） | **#738 が open（non-draft）**。HEAD `2ac98201`。差分は新規ファイル中心＋HOT は追加のみ（`App.tsx` +3、`main.tsx` +3、`PizzaStage.tsx` +15 −2、`GameScreen.tsx` +22） |
| S4（iPhone HV・採否） | **未完**。Owner 実機: **H13 PASS／H14 PASS（B のみ）**。H1〜H12 は**未報告**（PASS 扱い禁止）。Owner は **A（ふたタップ）を既定に選択**（merge 許可ではない）。H11（24px の貝が生と区別できない）は `2ac9820` で修正済みだが**実機確認待ち** |
| ブラウザ側 | 動画・スクリーンショット・Result は PR コメントにあり（`TETO_COOKING-STEAM_S3_Visual-HV_Result_20261105.md`、`_H11_Result.md`）。判定は「A は GO、軽微 NEEDS FIX（H11 のみ）」。**本監査では動画・画像を再確認していない**【未確認】 |
| CI | `2ac9820` で **11/11 success**（build・classify・layout-chromium・WebKit 390×844／360×800 各 3 shard・Layout Contract Gate・WebKit Gate）。WebKit の 1 shard は再実行で success（attempt 2） |
| Codex | `2ac9820` に **findings なし**。review thread **0 件** |
| 共有 Preview | Owner が `2ac9820` への更新を**承認済み**（comment `6644912674`）。**配備の実行結果は GitHub 上で確認できていない**【未確認】。README の `Source commit` と画面バッジの確認が必要 |
| Production OFF | `STEAM_EXPERIENCE_PRODUCTION = false`（main の `steamExperienceGate.ts` で確認）。本番バンドルにクエリ名が出ないゲートテストあり |
| main との競合 | **#738 を main に merge すると競合なし**（main に 15 commit 遅れでも自動 merge 成功）【実測】。ただし CI は旧 base（`49e2add`）での結果。**merge 前に最新 main で read-only Final Gate が必要**（#738 の comment `6635737959` が要求済み） |
| 未解決レビュー | なし |

### 4.2 #755 系（ゲーム性ラボ）の状態
| PR | 内容 | 状態 |
|---|---|---|
| #756 | V1 Lab（`?steamGameLab=on`） | draft |
| #757 | V2（5 個の貝を個別タップ、`&steamGameMode=v2`） | draft。main に単独で自動 merge 可【実測】。CI 11/11 success（`02edf31` 付近） |
| #763 | V3（★評価・同時開き・3 配置・予兆、`&steamGameMode=v3`） | draft。HEAD `b1fc588`。**CI 11/11 success**、Codex 指摘 1 件→修正・resolved、**未解決 0**。Owner コメント: 「PROTOTYPE GO、ゲーム性とリリースの最終判断は HOLD」。**#757 より先に merge 不可**（Depends-on） |
| Owner の実機 | V2・V3 とも **iPhone HV 未実施** |

これらは **#738 の既存 UI を置き換えず**、独立 Lab（Preview/DEV 限定）として存在する。Owner Gate: 「旧 A/B から切り替えるか」を **Lab 評価後に判断**（#755 本文）。**つまり #738 の A と #763 の V3 は、どちらが本線かまだ決まっていない。**

### 4.3 技術的な依存関係
| 依存先 | 内容 | 競合 |
|---|---|---|
| `PizzaStage.tsx`／`GameScreen.tsx`／`App.tsx` | #738 が追加済み（スロット・ピル・オーバーレイ） | FRY F3 と**同じ 3 ファイル** |
| `src/main.tsx` | #738（+3）、#746（約 20 行・1 分岐）、#757/#763（Lab 入口）が編集 | **三者の組み合わせはすべて競合**: #738+#746／#738+#763／#746+#763 を**実際に merge 試行して `src/main.tsx` が conflict**【実測】。各 PR 単独なら main に clean。Owner コメント（#755、comment `6652495048`・`6656486348` §7）が「手作業統合・両 Lab 入口と HV seed を残す」と既に方針を出している |
| Steam 専用 UI / 描画 | `SteamLayer.tsx`・`Steam.css`・`steamPillPlacement.ts`・`steamScreen.ts`（新規）。内側 `<g>` に pop アニメーションを置く修正済み（殻が隅へ飛ぶちらつきの原因対策） | 他工程と共有しない（独立実装） |
| 状態遷移・完了判定 | `steamLidLevelAt`（4.5 秒で全開）→ `steamedLook`（amount 0〜1）。V3 は別モデル（`steamGameV3.ts`）で、**#738 の amount には接続していない**（Lab 内で完結） | 本線体験を V3 に切り替えるなら、**S2 の reducer の意味（amount）と V3 の評価（★・5 個の回収）の対応づけが新たな設計課題**【推論】 |
| 保存・復元 | transient `steamedLook`。`RESET_PIZZA` で消去。schema 変更なし | リスク低 |
| 既存工程との接続 | 蒸し filter（内側 `.ingredient-glyph`）と焼成 filter（外側ラッパー）が共存（#738 のテストと E2E） | 実証済み |

### 4.4 UX の評価
| 観点 | 評価 |
|---|---|
| 蒸していることが伝わるか | 鍋・ふた・湯気・殻が順に開く。Owner は「描画は OK、**ゲーム性がない**」とした（#755）。H11 修正（開いた貝の見た目）後の実機確認待ち |
| 操作方式 | A（ふたをタップ）を Owner が既定に選択。B（鍋ゆすり）は Preview 限定の実験として残す方針（comment `6636019850`）。H13/H14 は実機 PASS |
| 蒸気・完了フィードバック | あり（殻が開く・湯気）。ブラウザ検証でちらつき・ゴースト click なし（`#738` の comments） |
| 分かりやすさ | A は単純。**単純すぎて判断が要らない**のが #755 の論点 |
| 390×844／360×800 | E2E で 1 画面・スクロール 0（Chromium＋CI WebKit）。**実機は未確認（H1〜H12）** |
| 既存工程との差別化 | 炒め（時刻当て）・炙り（長押し）と**入力語彙は異なるが、結果が時間で決まる点は炒め・炙りと同じ**。差別化は V3（切替の判断）に委ねられている |

---

## 5. 共通ファイルの競合マップ【実測】

| ファイル | #738 STEAM S3 | #746 DRIZZLE | #757/#763 Steam Lab | FRY F2 | FRY F3 | eggplant G2 | Batch 19 | Icons 2.0 follow-up |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `gameReducer.ts` | — | — | — | **編集** | — | — | — | — |
| `PizzaStage.tsx` | 編集 | — | — | — | **編集** | — | — | — |
| `GameScreen.tsx` | 編集 | — | — | — | **編集** | — | — | — |
| `App.tsx` | 編集 | — | — | — | **編集** | — | — | — |
| `src/main.tsx` | 編集 | 編集 | 編集 | — | **編集** | — | — | — |
| `ingredients.ts` | — | — | — | — | — | **編集** | **編集** | 編集の可能性 |
| `IngredientGlyph.tsx` | — | — | — | — | — | **編集** | — | **編集** |
| `recipes.ts` | — | — | — | — | — | — | **編集** | — |
| `App.css` | — | — | — | — | — | — | — | 編集の可能性 |

- **共通ファイル競合: あり。** ①`main.tsx` は #738・#746・#763 の三つ巴（実際に conflict）。②`PizzaStage`／`GameScreen`／`App` は #738 と FRY F3。③`ingredients.ts`／`IngredientGlyph.tsx` は eggplant の絵と Batch 19・Icons 2.0。
- **競合しない（独立）:** FRY F2（`gameReducer.ts` 追加のみ。#738 は触れていない）、eggplant の絵の**設計**（SVG 案は docs／candidates 配下）、受入条件・テスト計画。

---

## 6. FRY / STEAM 比較表（STEP 4）

| 比較項目 | FRY | STEAM |
|---|---|---|
| 実装進捗 | F0/F1 完了（純粋ロジック、未配線）。F2〜F4 未着手。**画面に出るものはまだ無い** | S1/S2 merged、S3 = #738（open、CI 緑、レビュー指摘なし）。**Preview では遊べる**。S4 実機 HV が未完 |
| 既存コードの再利用性 | 高い。S2 の reducer 形・蒸すの filter 共存方式・pill 配置の実測手法をそのまま使える。ただし「**コードを共有しない独立実装**」が Owner 方針（4 つ目の独立実装は承認済み） | 蒸すの実装が最新の雛形。FRY・次工程が参照する側 |
| UI 完成度 | 0（UI なし） | 高い（鍋・殻・蒸気・ふた、A/B、HV 入口、E2E）。**H11 の見た目修正は実機確認待ち** |
| 視覚的な楽しさ | 【推論】高い見込み（泡の大きさと勢い、ジュワ音の擬音、色の変化）。ただし**絵が無ければ 0** | 現状: 殻が開く出来事は伝わるが、Owner は「ゲーム性がない」。V3 Lab は別途評価待ち |
| 操作の分かりやすさ | A は 2 タップで明快。B は新しい入力語彙で**未検証**（スクロール競合・疲労） | A は明快（Owner 選択）。B は H13/H14 実機 PASS |
| 必要な新食材・画像 | **eggplant の専用 SVG（G2）が必須**。A 案「輪切り」は G1 で採用記録済み（#753 未 merge）。新食材はなし | なし（`clam-valve`／`mussel-shell` が既にある） |
| 保存互換性リスク | 低（transient、schema 変更なし） | 低（同左） |
| reducer 変更リスク | 中。F2 で `GameState` に型を足す（S2 と同形）。**ゲーム性要素を足すなら形が変わる**（O-4） | 完了済み。V3 を本線化する場合に再設計が発生しうる |
| 他 PR との競合 | F2: なし。F3: #738 と HOT 3 ファイル＋`main.tsx`。G2: #748 claim／Batch 19／Icons 2.0 | `main.tsx` が #746・#763 と衝突。期限（#726 claim）が 11/10 |
| 必要な HV | 動画 1 本（390×844、Owner へ直接）、前後スクリーンショット、実機 iPhone Safari。**絵の HV は別枠**（色は PROVISIONAL） | S4 の H1〜H12 のうち未報告分、H11 の実機確認、必要なら V3 の実機 HV |
| Production 投入までの残作業 | F2→F3→F4、eggplant 絵（G2〜G4）、A/B 選択、ON の別承認 Gate | #738 の最終 Gate（最新 main）・merge 承認・S4 完了・本線体験の決定・ON の別承認 Gate |

### 6.1 必須評価 5 項目
1. **短期間で完成できるのはどちらか:** 画面に出るまでの残りは **STEAM（S4 実機確認＋最終 Gate）の方が圧倒的に短い**。FRY は絵（G2）→F2→F3→F4 の 4 段で、絵待ち。ただし STEAM は「本線にする体験」が未決で、**完成の定義が動いている**（O-2）。
2. **ゲーム体験を大きく改善するのは:** 【推論】**FRY（ただし絵が整った後）**。理由は「泡を見て引き上げ時刻を選ぶ判断が最初から入る」「縦ドラッグという新しい手触り」「対象のナスは出荷済み 9 レシピ」。STEAM は現状時間決定で、改善幅は **V3 を本線に採用するか**で決まる。
3. **先に統合すると競合が少ないのは:** UI 配線は **#738 を先に**（FRY F3 は #738 の追加を前提に書く方が重複が少ない。逆順だと #738 が FRY 側の変更を取り込んで rebase する）。F2 は #738 と独立なので**どちらが先でもよい**。
4. **片方が他方に与える影響:**
   - STEAM → FRY: #738 merge 後は F3 が `PizzaStage` 等へ追加するだけで済む。蒸す UI の雛形（pill 配置の実測・ghost click 抑止・`inert` 背面保護）を流用できる（コードは共有しない）。
   - FRY → STEAM: F2 が先に入っても #738 に影響しない（別ファイル）。
   - **体験の方向性:** STEAM の「ゲーム性」判断（V2/V3）は FRY の設計にも**そのまま適用される**（O-4）。決まる前に F2 を書くと作り直しになりうる。
5. **並行・直列:**
   - **並行可:** eggplant の絵の設計／FRY 受入条件・テスト計画／STEAM S4 の実機 HV 収集／V3 の実機 HV／Batch 19 の preflight。
   - **直列:** `main.tsx` の統合（#738 → #746 → #763 を 1 本ずつ手作業で）／F3（#738 の後）／eggplant の `ingredients.ts`・`IngredientGlyph.tsx`（#748 claim 整理・Batch 19・Icons 2.0 と順番を決める）／F2（O-4 の後）。

---

## 7. 新しい調理工程の候補（STEP 5）

**重複回避の確認【実測】:** DRIZZLE は #579（整理）・#746（Gesture Lab、実装済みの独立画面）が既存。GRILL（焼き目）= **SEAR が既に ON**（`SEAR_EXPERIENCE_PRODUCTION = true`、#727/#730）、SAUTÉ（炒める）= **PREP Phase 1B が既に main（OFF）**。したがって下表の **DRIZZLE・GRILL・SAUTÉ は新規提案ではなく既存タスク**であり、新工程としては扱わない。

| 候補 | 既存との関係 | 対象食材（絵あり） | 対応レシピ | 操作 | 見た目 | データモデル | 保存 | 難度 | 体験効果 | 優先度 |
|---|---|---|---|---|---|---|---|---|---|---|
| **DRIZZLE** | **既存（#579／#746）。新規提案しない** | — | — | #746 が線をなぞる Lab | — | FINISH の液体対応が前提（#518 → D2-2） | 要設計 | — | — | **対象外（既存タスク）** |
| **GRILL** | **SEAR で実装済み**。拡張は「炙り Phase 2（他食材）」で、Owner が 2026-11-02 に**保留中** | sausage のみ（ON） | — | 長押し | — | — | — | — | — | **対象外（Owner 保留中）** |
| **SAUTÉ** | **PREP 1B（beef、OFF）**。yakiniku／lomo-saltado／kimchi が `PREP_STEP` を要求（原典マトリクス） | beef | yakiniku（READY・新食材 2） | タップ時刻当て | — | `prep` を識別軸にするなら大 | 要設計 | — | — | **対象外（既存。ON は別 Gate）** |
| **BOIL（茹でる）** | 新規。操作語彙は炒めと近い（時刻当て） | potato／spinach 等は**絵なし**。出荷済みで絵ありは shrimp・clam 系のみ | potato-mayo、pesto-patate（potato 2 レシピ）、spinach 1 | 案: **フォークで刺して固さを確かめる（プローブ）**→任意の時点で引き上げ | 泡・色が抜ける／柔らかさ（形のしなり） | transient、FRY・STEAM と同形 | 変更なし | 中 | 【推論】potato の絵を FRY Phase 1b（ポテト）と共有できる。**原典 172 に「茹でる」を要求する行は 0**（既存設計書）。炒め・揚げ（時刻当て・泡）と手触りが近いが、**プローブ（情報を得て判断する）は新しい入力** | **中（第 1 候補・条件付き）** |
| **MARINATE（漬ける）** | 新規 | chicken・pork（絵なし） | jerk chicken ほか（既出荷あり。枚数は未計数） | 「長押しで漬ける」では炙りと被る。**待つだけで変化＝プレイヤー操作が薄い** | 色がしみる（微差） | transient | 変更なし | 小〜中 | 【推論】**視覚差が小さく、24px のピースではほぼ見えない**（蒸すの H11 と同じ失敗パターン）。操作も薄い | 低 |
| **MIX（混ぜる）** | 新規だが **SAUCE（採点 52 点・field 方式）／MULTI_SAUCE（#521 S3 draft HOLD）と境界が衝突** | ソース全般 | MULTI_SPREAD_LAYER を要求する 17 レシピ（原典マトリクス） | 円を描くドラッグ（かき混ぜ） | ソース色の混合 | **識別・採点に波及しうる**（Anti-Oracle 契約 2.1 に注意） | 要設計 | 大 | 【推論】入力は新しいが、**既存の採点 axis に触れるため調理工程というより SAUCE の再設計**。今は避ける | 低（時期尚早） |
| **CRACK（割る：卵）**（リスト外の追加提案） | 新規 | egg（絵なし） | 5 レシピ（既存設計書の値） | タップで割る→ドラッグで広げる | 殻・黄身 | transient | 変更なし | 中 | 既存設計書は「加熱でなく配置の演出」「egg に絵なし」と評価済み | 低 |

**優先順位（新動詞として）:** BOIL（potato 前提・条件付き）> CRACK ≒ MARINATE > MIX。**172 マトリクスが調理法を要求するのは 揚げ 1（pizza-fritta）・炒め 3 のみ**（既存設計書）。これは新動詞より **`FRY_COOK`（揚げ生地）の Design Gate** の方が「未実装レシピが増える」唯一の経路であることを意味する。ただし BAKE の置換で影響が大きく、別 Gate（O-6、F4 の HV 後）。

---

## 8. 実装順序の比較（STEP 6）

| | 案 A: STEAM 先行 | 案 B: FRY 先行 | 案 C: 独立部分だけ並行 |
|---|---|---|---|
| 内容 | #738 の S4 完了・merge → その後に FRY F2〜F4 | eggplant 絵 → F2〜F4 → その後に #738 | 絵・設計・テスト計画・F2 は並行。UI 配線（`PizzaStage` 等・`main.tsx`）だけ STEAM → FRY の順で直列 |
| 依存関係 | FRY は #738 merge に依存（F3 のみ。F2 は不要） | #738 は FRY に依存しない。STEAM の本線決定（V3）が先に要る可能性 | 依存は「`main.tsx` と HOT UI の順序」のみ |
| 競合リスク | **低**（FRY が後から追加するだけ）。ただし #738 が main に 15 commit 遅れ、`main.tsx` が #746/#763 と競合 | **中〜高**（#738 が FRY 後に rebase。HOT 3 ファイル＋`main.tsx` で二重の conflict 解決） | **低**（衝突するファイルを 1 つずつ入れる） |
| 完了までの工程数 | #738 最終 Gate → merge、絵 G2、F2、F3、F4 の 5〜6 段（直列が長い） | 絵 G2、F2、F3、F4、#738 の rebase・最終 Gate・merge の 6〜7 段 | 絵／F2／STEAM 実機 HV が並行で、実質の直列は **#738 → F3 → F4** の 3 段＋Owner 判断待ち |
| Owner 判断の必要箇所 | #738 merge 承認・S4 PASS・本線体験（O-2）→ FRY の O-4／絵 | 絵の Gate・O-4 → 後で STEAM の本線 | O-1〜O-5 を**先に一括**（待たせない） |
| CI／HV の負荷 | 低〜中（STEAM は既に緑。FRY は WebKit 1 本追加） | 中〜高（#738 の rebase 後に WebKit を再実行する負荷が増える） | **最小**（merge ごとに WebKit が 1 回で済む。docs・絵の設計は CI 不要） |
| Production への影響 | なし（両フラグ OFF）。ON は別 Gate | なし | なし |
| メリット | 実績のある順序。#738 を早く片付けて claim 失効を防ぐ | FRY の方が体験の伸びしろが大きい【推論】 | 待ち時間を作らない。**Owner の HV（実機）が律速**なので、その間に独立部分を進められる |
| デメリット | FRY の絵・設計が待たされる（絵は #738 と無関係なのに止まる）。STEAM の本線が未決のまま merge すると**後で作り直しの可能性** | #738 の claim 失効（11/10）と main 遅れが放置される。Owner の「ゲーム性がない」判断が未解決のまま FRY を作る二重の手戻り | 管理が複雑（claim を細かく分ける必要）。Owner が判断待ちのまま複数のトラックが動く |

**推奨: 案 C。** 根拠:
1. **律速段階は実装ではなく Owner の実機 HV と判断**（H1〜H12、V2/V3、eggplant の色）。実装を直列に待つより、待ち時間に独立部分を進める方が総時間が短い。
2. **衝突は実測で `main.tsx`／`PizzaStage`／`GameScreen`／`App`／`ingredients.ts`／`IngredientGlyph.tsx` に集中**。これらだけ直列化すれば他は並行できる。F2（`gameReducer.ts`）は #738 と衝突しないため、「F2 は #738 の後」という旧前提を外せる。
3. 案 B は #738 の rebase と二重 conflict、案 A は FRY の独立部分まで止める無駄がある。
4. ただし **O-4（ゲーム性要素を FRY に入れるか）が決まるまで F2 の reducer 形は固定しない**。案 C でも F2 は O-4 の後。

---

## 9. 推奨ロードマップ（STEP 7）

すべて Production OFF。**Production 投入は別の承認 Gate**（各 Phase の完了条件には含めない）。

### Phase 0: 前提条件の解消（docs・GitHub のみ）
| 項目 | 内容 |
|---|---|
| 編集対象 | なし（docs・GitHub コメントのみ。Owner 判断の記録は `docs/decisions/` に新規ファイル） |
| やること | ①claim の整理: #726 S3（11/10 失効）延長／#748（実質終了）・#749（F1 完了）の更新方針。②**#738 の実機 H1〜H12 と H11 の収集**（Owner）。③**共有 Preview の実体確認**（`2ac9820` の配備結果が未確認）。④Production OFF ガード再確認（main で両フラグ `false`、本番バンドルに `cook*` が出ないゲートテストが CI に含まれる）。⑤**eggplant の絵の不足確認**（`pieceVisual` なし、#753 未 merge）。⑥Owner 判断 O-1〜O-5 |
| 完了条件 | O-1〜O-5 が Owner 回答済み、claim 状態が GitHub 上で明確 |
| 依存関係 | なし |
| Owner 判断 | O-1〜O-5（§11） |

### Phase 1: 独立した準備（並行可）
| 項目 | 内容 |
|---|---|
| 編集対象 | **すべて docs／design 配下**: 食材画像の設計は `docs/design/candidates/ingredient-icons-2.0-eggplant-fry/`（#753 の範囲）、UI 比較案・受入条件・テスト計画は新規 `docs/reports/` |
| トラック 1（絵） | eggplant 輪切り SVG の最終案（#753 の A 案）＋ `pieceVisual` 追加の実装計画（`ingredients.ts`・`IngredientGlyph.tsx` の編集範囲と、Batch 19／Icons 2.0 follow-up との順序案）。**コードは編集しない** |
| トラック 2（FRY 設計） | UI 比較案（A/B 画面レイアウト、390×844／360×800／390×664）、`friedLook` の見た目検証計画、受入条件（既存設計書 §4 の受入条件をベースに、O-4 の結果を反映）、テスト計画（reducer・E2E・WebKit・本番バンドル gate） |
| トラック 3（STEAM） | S4 の判定条件の整理（H1〜H12 のうち実機必須・ブラウザ可の切り分けは既存 Visual-HV Result を参照）。V3 を本線にする場合の接続設計（S2 の `amount` と V3 の評価の対応） |
| 完了条件 | 各トラックの docs が揃い、Owner が O-4・O-2 を判断できる |
| 依存関係 | Phase 0 のうち O-1・O-3 |
| Owner 判断 | O-2（STEAM の本線）、O-4（FRY のゲーム性要素） |

### Phase 2: 先行工程の統合 — STEAM（UI 配線を先に）
| 項目 | 内容 |
|---|---|
| 編集対象 | #738 の範囲（`SteamLayer.tsx`・`Steam.css`・`steamPillPlacement.ts`・`steamScreen.ts`・`PizzaStage.tsx`・`GameScreen.tsx`・`App.tsx`・`main.tsx`）。本監査は編集しない |
| 状態遷移・描画・操作 | 実装済み（A を既定、B は Preview 限定） |
| 保存互換性 | transient のため変更なし。再確認のみ |
| CI／WebKit | **最新 main に対して read-only Final Gate**（#738 の既存要求）。#765（360px layout 修正）後の WebKit 360×800 を再確認 |
| iPhone HV | H1〜H12 の Owner 回答、H11 の実機確認 |
| 競合処理 | `src/main.tsx` を #738 → #746 → #763 の順に**手作業統合**（#755 §7 の方針：両 Lab 入口と HV seed 保護を残す）。1 PR ずつ別承認 |
| 完了条件 | #738 merge（Owner 承認）、`STEAM_EXPERIENCE_PRODUCTION = false` のまま |
| 依存関係 | Phase 0・O-2 |
| Owner 判断 | merge 承認、S4 PASS、H11、本線体験 |

### Phase 3: 後続工程の統合 — FRY（F2〜F4）
| 項目 | 内容 |
|---|---|
| 編集対象 | F2: `gameReducer.ts`（追加のみ、`fryLook`＋`FRY_INGREDIENT`＋`RESET_PIZZA` の 1 語）／G2: `ingredients.ts`・`IngredientGlyph.tsx`（eggplant の絵）／F3: `FryLayer.tsx`・`Fry.css`（新規）＋`PizzaStage.tsx`・`GameScreen.tsx`・`App.tsx`・`main.tsx`（追加のみ）／F4: `e2e/cooking-fry.spec.ts`、`docs/reports/screenshots/cooking-fry-phase1/` |
| 先行工程との競合解消 | F3 は **#738 merge 後**の main から枝を切る。`main.tsx` は Phase 2 の統合済み形に追加する |
| 追加食材との連携 | eggplant の絵が先（G2）。`ingredients.ts`／`IngredientGlyph.tsx` は #748 claim の整理後、Batch 19・Icons 2.0 follow-up と順序を決める。potato（fries）は絵が整った後の Phase 1b |
| テスト | 既存 fry architecture test の `LATER_SLICES` を F2/F3 の PR が意図的に更新。炒め・炙り・蒸すに差分なし。フラグ OFF／対象外食材／Lunch Rush／Dinner でバイト同一 |
| HV | 動画 1 本（390×844、Owner へ直接・commit しない）、前後スクリーンショット、実機 iPhone Safari。A/B の選択、時間 3 段の選択 |
| 完了条件 | F4 Result と Owner の実機 HV。Production OFF のまま |
| 依存関係 | Phase 1 トラック 1・2、Phase 2（F3 のみ）、O-4（F2 の形） |
| Owner 判断 | O-4、O-5、絵の色（PROVISIONAL）、F2 以降の HOLD 解除 |

### Phase 4: 新工程の追加（候補を 1 つ選定）
| 項目 | 内容 |
|---|---|
| 選定 | **BOIL（茹でる、potato 優先）を条件付きで推奨**。次点は `FRY_COOK`（pizza-fritta）の Design Gate（新動詞ではないが、未実装レシピが増える唯一の経路） |
| 実装条件 | ① potato の専用絵（FRY の Phase 1b と共有）② FRY F4 の実機 HV 結果（泡・時刻当てが「炒めと同じ」に感じられないかの知見）③ プローブ操作（フォークで刺す）の A/B ではなく単独仮説の HV |
| 対応レシピ | potato-mayo、pesto-patate（potato 2 レシピ）、spinach 1。**原典 172 に要求行は 0** のため、増えるのは体験のみ（既存レシピは増えない） |
| リスク | 炒め・揚げと手触りが被る／potato・spinach の絵が先／**時間決定になり再び「ゲーム性がない」と言われる**（プローブの情報コスト設計が必須） |
| 完了条件 | Design Gate（docs-only）→ Owner 判断。実装は別 Gate |
| 依存関係 | Phase 3 完了、Batch 19 の `ingredients.ts` 作業との順序 |
| Owner 判断 | 新動詞か `FRY_COOK` か（O-6） |

---

## 10. リスクとブロッカー

| # | リスク／ブロッカー | 区分 | 対処 |
|---|---|---|---|
| R-1 | **#726 の S3 claim が 2026-11-10 に失効**。#738 が HOLD のまま失効すると他セッションが HOT 3 ファイルに入れる | ブロッカー（期限） | O-1 で延長／解除を決める |
| R-2 | **`main.tsx` の三つ巴競合**（#738・#746・#763）。実 merge で conflict を確認【実測】 | ブロッカー | 手作業統合を 1 PR ずつ（#755 §7 の方針）。Owner の別承認 |
| R-3 | **eggplant の絵が無く FRY は休眠**。G2 は `ingredients.ts`・`IngredientGlyph.tsx` を触り、#748 claim／Batch 19／Icons 2.0 と同じファイル | ブロッカー | claim の整理と編集順序の決定（O-3） |
| R-4 | **「ゲーム性がない」問題が FRY にも波及**（時間決定・採点なし・失敗なし） | 設計リスク | F2 の前に O-4 を決める。決めずに F2 を書くと reducer の作り直し |
| R-5 | #738 は main に 15 commit 遅れ。CI は旧 base での結果 | リスク | merge 前に最新 main で read-only Final Gate（#738 の既存要求） |
| R-6 | H1〜H12 の実機結果が未報告。H11（24px の貝）は実寸でほぼ区別できなかった（ブラウザ検証） | リスク | 実機確認。PASS を代筆しない |
| R-7 | 共有 Preview の配備実行結果が GitHub 上で未確認 | 確認不足【未確認】 | README の `Source commit` と画面バッジで確認（Owner／担当セッション） |
| R-8 | WebKit CI の間欠失敗（#394・#680）。#763 でも `cooking-prep.spec.ts:478` 等が一度 timeout（再実行で緑） | 環境リスク | 失敗時は再実行でなく原因確認（SESSION-OPERATIONS の方針に従う）。**不要な再実行はしない** |
| R-9 | #762 と #763 が**別設計**の V3（数値が異なる）で混同しやすい | 管理リスク | #755 の Owner コメントどおり、#763 を基準に比較し、#762 は HOLD のまま |
| R-10 | `PROJECT_HANDOFF.md` に FRY・STEAM の記載が無い（grep） | ドキュメント乖離 | HOT file のため、更新は専用の docs PR で別 Gate |

---

## 11. Owner 判断事項（優先順）

| ID | 判断 | 助言 |
|---|---|---|
| **O-1** | **claim の扱い**: #726 S3（11/10 失効）を延長するか／#748（B18 は merge 済み）・#749（F1 完了）の claim を整理するか | #726 は **11/10 前に判断**が必要。#738 の最終 Gate まで延長が妥当【推論】 |
| **O-2** | **STEAM の本線体験**: #738 の A（ふたタップ）を本線にするか、#763 の V3 の評価・切替を本線にするか、まず V3 の実機 HV を待つか | **実機 HV を先にする**（#755 の Owner Gate「Lab 評価後」と整合）。決まるまで #738 の merge は急がない |
| **O-3** | **eggplant の絵（G2）の Gate と順序**: いつ・どの順で `ingredients.ts`／`IngredientGlyph.tsx` を編集するか（Batch 19・Icons 2.0 follow-up との順序）。#753（G1 採用記録）の merge | #753 を先に merge（docs-only）。G2 は #748 claim の整理後、**Batch 19 より前か後かを決める** |
| **O-4** | **FRY にゲーム性要素（評価・上達の報酬）を入れるか**。現設計は「失敗なし・採点なし・見た目のみ」 | Steam の教訓を FRY の F2 に反映するなら **F2 の前に決める**。入れない選択（見た目のみ）も有効だが、再び「ゲーム性がない」と評価されるリスクがある |
| **O-5** | **FRY F2 の HOLD 解除**（reducer のみ、UI なし）: #738 を待たずに F2 を先行させてよいか | **競合なし**を実測済みなので解除可能。ただし O-4 の後 |
| O-6 | 新工程の方向: BOIL（potato）か `FRY_COOK`（pizza-fritta）か | FRY の F4 HV 後に判断 |
| O-7 | A/B の最終選択（FRY）と、B を残すか | HV 後。B は必須にしない |
| O-8 | 技法（Technique）として Dex に出すか（FRY・STEAM とも Phase 1 は出さない前提のまま） | 据え置き |
| O-9 | Production ON（蒸す・揚げる）は**別の承認 Gate** | 本監査は判断しない |

---

## 12. GO / CONDITIONAL GO / HOLD 判定

| 対象 | 判定 | 理由 |
|---|---|---|
| **Phase 0（前提解消）・Phase 1（独立した準備）** | **GO**（docs・設計のみ） | コード変更なし。競合なし。Owner の待ち時間を使える |
| **FRY F2（reducer）** | **HOLD → CONDITIONAL GO**（O-4 の回答後） | ファイル競合は無いが、ゲーム性要素の有無で reducer の形が変わる |
| **FRY G2（eggplant の絵）** | **HOLD**（O-3 の回答後） | `ingredients.ts`／`IngredientGlyph.tsx` が Batch 19・Icons 2.0 と競合 |
| **FRY F3／F4** | **HOLD** | #738 の merge 後、かつ絵（G2）が前提 |
| **STEAM #738 merge** | **HOLD** | S4 実機 HV 未完、最新 main での最終 Gate 未実施、本線体験（O-2）が未決 |
| **Production ON（両工程）** | **HOLD**（別 Gate） | — |
| **総合の実装開始判定** | **CONDITIONAL GO**（Phase 0／1 のみ。F2 以降・S4 後は上記条件） | |

**監査完了。停止して Owner の承認を待つ。**
