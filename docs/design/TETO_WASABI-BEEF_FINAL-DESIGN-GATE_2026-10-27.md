# わさびビーフ — Final Design Gate（docs-only、10 レシピバッチへ統合する前提）

Status: **Final Design Gate の提出。runtime は実装していない**（`src/**`・`e2e/**`・CSS・テスト・データ・golden・workflow・本番スイッチ・共有 Preview・Production・Firebase は無変更）。実装・PR 作成・merge・deploy・CI 再実行・Monitor 作成・Issue/PR へのコメント投稿・claim 投稿はしていない。
基準 `main` = `08cd46d`（#677、食材 75 / 通常 ladder 56 + late 4）。**#679（BBQ）は open（別セッションが担当、`claude/bbq-chicken-late-catalog` へは触らない）**。
姉妹資料: バッチ計画 `TETO_NEXT-BATCH-10_EXPANSION-PLAN_2026-10-27.md`、ブッラータ `TETO_BURRATA_FINISH-CHEESE_DESIGN-ISSUE_2026-10-27.md`、先行 audit `TETO_NEXT-CONTENT_FRESH-AUDIT_WASABI-HONEY-BURRATA_2026-10-27.md`。
**「推奨」「判定」は助言であり Owner Decision ではない。未回答を承認済みとみなさない。**

## 更新（2026-10-27 第 2 版）— Owner 判断（第 2 弾）の反映

| 項目 | 反映 |
|---|---|
| 表示名 | **「わさびビーフピザ」を採用**（D-W1 解決。`id` は `wasabi-beef-pizza` のまま） |
| beef・soy-sauce の再利用優先 | **採用。** beef は通常 ladder の 1 材料 step（`[beef]`、key = `rendang-pizza`、カレー→curry-ketchup の検証が前提）で出す。soy-sauce は bulgogi の late step（`[soy-sauce]`）で出し、wasabi-beef の late step は `[wasabi]` のみ（1 材料）。bulgogi を外す場合は `[soy-sauce, wasabi]`（2 材料）。詳細は `TETO_NEXT-BATCH-10_EXPANSION-PLAN_2026-10-27.md` §4・§5 |
| SVG 候補 A | **暫定採用**（beef-A・wasabi-A）。最終は実機 HV（D-W4 は暫定で解決） |
| soy-sauce の色 | 暫定 `#3a2418` を**実機 HV で確定**（D-W6 解決） |
| 初回 360 Pitz | **未承認 → 再評価済み。** バッチ構成では wasabi-beef が beef（120）・soy-sauce（120）・wasabi（120）の 3 step に分散し、1 step あたり 120 Pitz。合計は 360 Pitz のまま。**単独（S）で出すと 360 Pitz の 1 step** になり、未承認の負担がそのまま残る（D-W7 は「S では未承認、B で再評価」） |
| 単独実装（S） | 引き続き**非推奨**（beef が late 専用になり再利用を失う） |
| わさびビーフの位置 | バッチ内の **late 3 番目（L3）**。クリティカルパス D-B3 → O1 → O2（beef）→ L1（soy-sauce）→ L3。#679 の merge 後 |
| 残る D-W | D-W2（個数・size class）、D-W5（説明文）。D-W3 は R2 採用で解決、D-W8 はバッチ計画の E-1〜E-7 に置き換え |

## 0. Owner 決定（2026-10-27）と本資料での扱い

| # | 決定 | 本資料の扱い |
|---|---|---|
| 1 | わさびビーフの Final Design Gate 作成を承認 | 本書 |
| 2 | 実装はまだ行わない。**10 レシピ単位のバッチ拡張計画に統合する** | §9 と姉妹資料。単独実装の計画は「バッチに入れる 1 件分の仕様」として書く |
| 3 | ブッラータは焼成後 FINISH 対応を優先して調査。共通機構としての再利用性を評価 | 姉妹資料（独立した設計課題） |
| 4 | ホットハニーと #579 DRIZZLE は HOLD 維持 | 触れない（再調査が要る新事実は無し、§10） |
| 5 | **原典未確認の内容は GAMEPLAY ASSUMPTION と明記し、事実として断定しない** | 全章に適用。§7 に一覧 |

## 1. 事前確認（CLAUDE.md の起動手順）

| 確認 | 結果 |
|---|---|
| `CLAUDE.md` / `PROJECT_HANDOFF.md` | 読了（HANDOFF 冒頭は 9/18 だが、10 月の addendum と `TETO_STATE-SYNC_2026-10-26.md` が現況の正。HANDOFF 自身が「GitHub の最新状態を正とする」と明記） |
| 最新 main | `08cd46d`（#677）。直前に #674、#673（U3）。本ブランチは main を取り込み済み |
| open PR（関係するもの） | **#679 BBQ（late catalog、CI の build 以外 success、merge 禁止・実機 HV 待ち）**。#540（Draft・HOLD、`recipeSauceProfiles.ts` / `referencePizza.ts` / `hint5.ladders55.json` が重なる）。#651 / #650 / #620 / #612 / #587（docs-only）、#581（Preview 限定の UX） |
| open Issue | #611（TQ-2 / BBQ の親）、#579（DRIZZLE、HOLD）、#578（New Sauces）、#577（Dough Kind、HOLD）、#521（Multi-Sauce）、#527（Batch 8）、CI 間欠失敗 #394 / #680 / #681 |
| claim | #611: **BBQ の実装担当は #679 のセッションに一本化**（2026-10-27 05:38Z、他セッションは #679 のブランチへ push しない）。#578: U3 の claim が 11/02 まで残存（B-1・U1・U2 は代理 release 済み）。**わさびビーフ用の claim はまだ誰も出していない**。本資料の新規ファイルは既存 claim のどれとも重ならない |
| 重複確認 | `wasabi` / `わさび` を扱う open PR・Issue は無い（#579 の監査と本セッションの先行 audit のみ）。わさび牛は #611 で「BBQ の次の late 候補」として整理済みだが、**実装 Issue も PR も無い** |

## 2. 既存 Fresh Audit・172 候補との照合

| 資料 | わさびビーフに関する記述 | 本書との関係 |
|---|---|---|
| 172 品 matrix（`docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`） | `wasabi-beef-pizza` / わさび牛ピザ。材料 beef・mozzarella・onion・soy-sauce・wasabi。生地は「薄めの生地」。基底ソース = 醤油ソース（`その他` family、taxonomy flag `sauce_not_topping`）。`LATE_ADDITION` のみ要。`READY`、blocker 0。証跡の出所 `individual_profile_page`（`https://pizzadb.jp/pizzas/wasabi-beef/`）。後乗せ: wasabi、強さ `source_profile_text`（「焼き上がり後に添える」） | 本書の仕様の根拠。**matrix の記述は設計用の記録で、原典の文言そのものではない。本セッションは pizzadb.jp に到達しておらず（環境の制限）、原典と照合していない** |
| `TETO_NEXT-RECIPES-AND-PROCESSES_PRIORITY-TABLE_2026-10-26.md`（#611 に記録、別ブランチ） | 順位 2: わさび牛（BBQ の後、同じ late 枠の連続）。食材 3 が全て新規、投入時機は matrix のみ | 一致。規模 L〜XL の見積もりを本書 §9 で実測に置き換える |
| `TETO_DRIZZLE-579_VALUE-AUDIT_2026-10-27.md`（#579 に記録） | L1 READY の唯一の行。ペーストを少量のせる = 粒状 topping で近似できる見込み。選択肢 2「late catalog の次候補に加える（DRIZZLE 不要）」 | 一致。「粒状 topping 近似」は GAMEPLAY ASSUMPTION（§7 W3） |
| `TETO_EXPANSION-BATCH-9_OWNER-DECISIONS.md` | 原典未確認は推測で埋めない（OD-B9-11）。暫定仕様で実装前監査（OD-B9-17）。焼成後・炒め工程が確認されたら新工程候補に再分類（OD-B9-16） | 本書の運用規則。わさびビーフの再分類条件は §7 |
| BBQ Final Design Gate（別ブランチ） | 設計値・8 ピース Reference・SVG 比較・原典未確認の表・実装計画の型 | 形式を踏襲 |

## 3. 仕様案（バッチに入れる 1 件分）

| 項目 | 案 | 根拠・区分 |
|---|---|---|
| レシピ id | `wasabi-beef-pizza` | matrix の `canonicalCandidateId`。late catalog の命名前例（`yuzu-shrimp-pizza` 等） |
| 表示名 | **未決 D-W1**: matrix の「わさび牛ピザ」/ Owner の呼称「わさびビーフピザ」 | 表示名は識別に影響しない。助言: Owner の呼称に合わせる |
| 材料 | soy-sauce 1（PAINT）/ mozzarella 2 / onion 1 / beef 3 / **wasabi 1（POST_BAKE）** | 材料集合は matrix。**個数は GAMEPLAY CALIBRATION**（原典に個数の記録なし） |
| ピース数 | 非ソース 7（焼成前 6 + 仕上げ 1） | BBQ gate の測定では 7・8 ピースとも固定リングの最小距離 20。**新しい上限は設けない**（Owner 決定、BBQ と同じ） |
| 焼成窓 | 58–78 | U1〜U3・BBQ と同じ汎用窓（`FREE_COOK_BAKE_TARGET` の median を動かさない）。**GAMEPLAY CALIBRATION** |
| 生地 | 標準（薄め生地は未モデル化） | matrix は薄め。late の既存レシピ（U2・U3）と同じ扱い。**GAMEPLAY ASSUMPTION** |
| 報酬・経済 | `baseRewardPitz: 100`、T4（パック 120 / 補充 60 Pitz、素材個別価格なし）、星ゲートなし | #611 のコメントで確定した規則 |
| ラウンド | `lunchRush: false`、CUT なし、key-free Hint、`ladderCredit: true` | late catalog の既存 5 件と同じ |
| late step | **単独で出す場合（S）:** `{ ingredientIds: ["beef", "soy-sauce", "wasabi"], keyRecipeId: "wasabi-beef-pizza" }`（**3 材料の step は初**。既存の late step は 1〜2 材料）。**バッチで出す場合（B、推奨）:** beef は**通常 ladder の step**（key は beef を使う通常レシピ。第 2 版の姉妹資料 §4 では **rendang-pizza**（カレー→curry-ketchup の検証が前提。READY の通常 beef レシピは無い））に置き、late step は `["wasabi"]`（soy-sauce を bulgogi の late step に置く場合）または `["soy-sauce", "wasabi"]`（置かない場合）で `keyRecipeId: "wasabi-beef-pizza"`。**番号は導出**（絶対番号に固定しない）。cohort の鍵 = step の最後の材料 = `wasabi` | #621 の規則。**S と B の違いが beef の再利用可否を決める（下の注）** |

**注（本セッションが `validateLateCatalog` を読んで確認）:** late recipe は `POST_BAKE` を必ず 1 つ持ち、`ladderCredit: false` の late recipe は late 専用の材料を使えない（`lateCatalog.ts` の検査）。さらに late 専用の材料は通常カタログには存在しない（OFF のカタログから消える）ため、**通常レシピは late 専用の材料を使えない**（通常レシピ側の検査は本セッションでは確認していない。設計上の推論）。したがって **beef を wasabi-beef の late step に入れて単独で出すと、beef は late 専用の材料になり、beef を使う他の 8 行（yakiniku・bulgogi・nigerian-suya・rendang・goulash ほか）は、通常レシピとして beef を使えなくなる**（使えるのは自前の `POST_BAKE` と step を持つ late recipe だけ）。後から beef を通常 ladder へ移すと、追記専用の ladder と既存セーブの解禁（LATE_ENTITLEMENT_FLOORS）に関わる。**beef を通常 step で先に（または同時に）出す B の形が、beef の再利用を保つ唯一の素直な経路**。
| 互換下限 | `LATE_ENTITLEMENT_FLOORS` に 3 材料の行（「出荷時に導出される番号」。#679 が先に merge されれば BBQ = 61、わさびビーフ = 62。バッチで通常 step が増えるとその分ずれる） | 既存規則（`lateCatalog.ts` の RULE コメント） |
| 説明文 | 投入の時機を名指ししない（Anti-Oracle）。例「牛肉と醤油だれに、わさびのツンとした香りをそえた一枚。」 | **Owner 文言が必要 D-W5** |
| 調査ラベル（Research） | 「？？？ピザ（わさび）」（単独コホート、既存の文字は動かない見込み。実装時に確認） | cohort 規則 |

## 4. 食材・投入時機・工程

### 4.1 食材

| 食材 | カテゴリ / family | 描画 | 備考 |
|---|---|---|---|
| `beef` | topping / scatter / `meat`（L1 のみ） | 専用 SVG `beef-slice`（候補 A、§6） | size class `m`（chicken・pork と同じ）。**既存食材なし**（`ingredients.ts` / `lateCatalog.ts` を確認） |
| `soy-sauce` | sauce / PAINT / family 行なし（既存ソースと同じ） | 色駆動、専用 SVG なし | 色は暫定 `#3a2418`（§6.3）。late 専用の有限材料 |
| `wasabi` | topping / scatter / `spice`（「スパイス・薬味」。`white-sesame`・`capers` と同じ。family は 2 → 3 メンバーで単独メンバー検証に影響しない） | 専用 SVG `wasabi-mound`（候補 A、§6） | size class は未決 D-W2（`xs` か `s`）。`applicationPhase: "POST_BAKE"` |

### 4.2 投入時機（GAMEPLAY ASSUMPTION）

| 材料 | 案 | 区分 |
|---|---|---|
| wasabi | **焼成後（FINISH）** | matrix の `source_profile_text`（「焼き上がり後に添える」）。**本セッションは原典未確認。ゲーム用の暫定仕様として扱い、原典の事実としては記録しない**（BBQ の Q2 より根拠は強いが、扱いは同じ） |
| soy-sauce | 焼成前の SAUCE（PAINT） | **GAMEPLAY ASSUMPTION**。matrix は「基底ソース = 醤油ソース」とだけ記録し、塗る・かけるの別と時機は記録なし |
| beef | 焼成前・事前加熱なし | **GAMEPLAY ASSUMPTION**（下ごしらえ・漬け込みはモデル化しない。U1 のエビ・U2/U3 のナスと同じ扱い） |
| mozzarella / onion | 焼成前（標準の CHEESE / TOPPING） | 暫定 |

### 4.3 工程

**新しい工程は不要。** `LATE_ADDITION`（FINISH）は本番 ON（`LATE_CATALOG_PRODUCTION` / `FREE_COOK_FINISH_PRODUCTION` = true）で、wasabi は FINISH が受ける「`scatter` の `topping`」の条件を満たす（reducer の FINISH 分岐、`canPlacePostBakeIngredient`、バッチ validator の `LATE_NOT_TOPPING` で確認）。工程は `DOUGH → SAUCE → CHEESE → TOPPING → BAKE → FINISH`（`deriveCoreSteps` が導出）。**液体の DRIZZLE は使わない**（#579 は HOLD のまま）。

**再分類の条件（OD-B9-16 の考え方）:** 原典で wasabi が焼成前と分かれば `applicationPhase` と late 枠の扱いを、醤油が焼成後にかける液体と分かれば構成を、Owner と相談して再分類する。現行実装はそのとき使えない（U1 の PR 本文と同じ注意）。

## 5. 解禁・ヒント

- **解禁:** S（単独）は late step 1 つ（3 材料）。T4（120 / 60 Pitz）が材料ごとにかかるため、**初回に 3 材料 = 360 Pitz** が必要（既存の late の 2 材料 step は 240 Pitz）。B（バッチ）は beef が通常 step（sour-cream と同じ step なら 240 Pitz）、soy-sauce と wasabi が late step に分かれ、**わさびビーフを作るまでの合計は同じ 360 Pitz だが、1 つの step あたりの負担は 120〜240 Pitz に下がる**。星ゲートなし。**D-W7: この負担を許容するか**（素材個別価格は無いので、緩和には新規の仕組みが要る）。
- **ヒント:** key-free（`recipeHintRoles`）。Hint 5.0 の BASE 段（全ソース + 全チーズ）に soy-sauce が加わる。`spice` family のメンバー +1、`meat` family +1。**時機は名指ししない**（family・カテゴリ名にも時機を示すものは作らない）。技法「後乗せ」は既存（Dex 説明・なぞかけは #621 で確定済み）。
- **DH4 / Hint 5.0（実装時に実測。本セッションは実行していない）:** `deductionGuard.gate` の旧件数 pin が動く。U1〜U3 の前例どおり**原因分解**（beef のみ / soy-sauce のみ / wasabi のみ / 3 つ / 3 つ + レシピ）を行い、privacy assertion と hardened guard は緩和しない（OD-B9-15）。`LATE_ADDITION_RECIPE_IDS`（`techniqueAllowlists.ts`）に 1 件追記。Hint 5.0 golden は追記のみ。`other` family へは何も加わらない（beef = meat、wasabi = spice）ので OD-DH4-2-9 には触れない。
- **識別の衝突:** beef を含む既存レシピは 0（beef 自体が新規）。新材料 3 種が集合を一意にする。バッチ内の近接（beef + soy-sauce + mozzarella + onion を共有するレシピ）は姉妹資料 §2 の注で扱う。

## 6. 視覚素材（具体化）

候補 SVG（**未採用。Style Lock v2 の「採用済み」ディレクトリには入れない**）: `docs/design/candidates/wasabi-beef/beef-A.svg`、`wasabi-A.svg`、`wasabi-B.svg`。比較シート: `docs/reports/screenshots/wasabi-beef-svg/wasabi-beef-candidates.png`（再生成: `render-sheet.mjs`、Chromium 描画、既存の採用済み SVG と 48 / 24 / 20 px、4 種の背景）。仕様は Style Lock v2 の型（64×64、地面の影、外形線、決定性、`id` なし）。

### 6.1 beef（候補 A: 霜降りの薄切り）
- 赤褐色の波打つ薄切りに、白い脂の筋と濃い縁。形は「ひらたい楕円」で、**ペパロニの円形・ベーコンの縞・ハムの骨付き塊・ポークの渦巻き**と形で区別できる。
- 観察: 焼き色の生地・こんがり色の上で読める。**トマトソース（赤）の上では赤どうしで弱い**（わさびビーフは醤油ソースなので該当しないが、beef を別のトマト系レシピで使う将来に注意）。**醤油ソース案（暗茶）の上では暗めに沈む**ので、外形線を濃くしすぎない。20px ではペパロニと「赤い小さな塊」に見えうる → 名前表示と文脈で補う。実機 HV で確認。

### 6.2 wasabi（候補 A: 緑の盛り / 候補 B: しずく形）
- **A（推奨）:** 粒状感のある丸い盛り。柚子胡椒（`#a3ad52`、ソース層の薄いペースト）・パセリ・大葉・ネギの輪・（BBQ の）香菜の葉と、**「小さな盛り上がり」という形**で区別できる。20px でも緑の丸い塊として読める。
- B は水滴に見え、わさびに見えにくい。**推奨しない。**
- 観察: 柚子胡椒の薄い黄緑ペーストとは色相が近い。形と「ピザの上で焼成後に置く単独の 1 点」であることで区別する。20px のパセリ ☘️ とも「緑の塊」になりうる → 名前表示で補う（BBQ の cilantro と同じ懸念）。size class を `s` にするか個数を 2 にするかは D-W2。

### 6.3 soy-sauce の色
- 暫定 `#3a2418`（暗茶）。既存ソースとの色差（CIE76 ΔE、sauce 間のみ）: tahini 29.7 / BBQ（#679 暫定 `#7a2f1c`）30.9 / miso 39.3。U3 のタヒニの採用基準（生地との差 ΔE 約 27〜29）の下限に近い。**素の生地との差・焼成後の焦げ色との見分けは実画面で測る**（暗い色は焦げに見えるおそれ）。実機 HV で確定する運用（BBQ・U1〜U3 と同じ）。

### 6.4 テキスト代替の emoji（DOM には出ない、G18 の一意性のため）
- beef: 🥩 は肉系の class symbol（`familyDisplay.ts`）で使用済み。**未使用の候補: 🐂**。wasabi: 🟢・🟩・🍏 系は使用済みまたは将来の果物と衝突しうる。**未使用の候補: 💚**（見た目には出ない）。いずれも `src/` を grep した結果で、**実装時に G18 のテストで再確認**する。iOS 16.4+ 限定の 🫛・🫚 は避ける。

## 7. 原典未確認項目（すべて GAMEPLAY ASSUMPTION。Result・PR・コードに明記）

**原則:** 原典（pizzadb.jp）には到達していない。matrix の記述を原典の事実として断定しない。コードの定型コメント: 「GAMEPLAY ASSUMPTION（暫定仕様・原典未確認）: …はゲーム用の暫定仕様で、原典の事実としては記録しない。根拠は 172 品 matrix の記録のみ。」

| # | 項目 | 現状の根拠 | 扱い |
|---|---|---|---|
| W1 | 材料集合（beef / mozzarella / onion / soy-sauce / wasabi） | matrix（個別ページ由来とされる。未照合）。taxonomy flag `sauce_not_topping` | 暫定 |
| **W2** | **wasabi が焼成後** | matrix `source_profile_text`。未照合 | **ゲーム用の暫定仕様。事実としては記録しない** |
| W3 | wasabi を「粒状の topping」で表す（実際はペーストを少量のせる） | #579 の価値監査の見込み | 暫定。「かける」動作は作らない |
| W4 | soy-sauce を PAINT（焼成前に塗る） | matrix に塗布方法・時機の記録なし | 暫定 |
| W5 | beef の下ごしらえなし | matrix に記録なし | 暫定 |
| W6 | 個数・焼成窓・生地（薄め → 標準） | ゲーム側の較正 | 暫定 |

## 8. 新食材 3 種の削減可能性と他レシピへの再利用

172 品 matrix の「未出荷の 118 行」（id の機械的な一致で近似。行単位の確認は実装前にやり直す）と現行の食材 75 + #679 の bbq-sauce・cilantro を突き合わせた結果:

| 食材 | 使う未出荷の行 | 内訳 | 削減の可否 |
|---|---|---|---|
| `beef` | **9 行** | FULL 6 / PARTIAL 3。READY は wasabi-beef・yakiniku。残りは基底ソース未特定などの Owner 判断待ち（bulgogi、nigerian-suya、philly-cheesesteak、rendang、goulash、meat-lovers、lomo-saltado） | **削減できない**（レシピの同一性そのもの）。**最も再利用が効くが、late 専用にすると他の 8 行が使えなくなる**（§3 の注）→ 通常 step で出す（B） |
| `soy-sauce` | **現状 1 行**（wasabi-beef のみ） | 「甘辛だれ」の行（bulgogi・eel・teriyaki-chicken・south-african-boerewors）は**基底ソース未特定**で、醤油ソースを共通の和風下地に採用すれば最大 4 行が再利用側になる（teriyaki・うなぎ・プルコギは醤油系が自然。**採用は Owner 判断 D-B1**、未決） | **置換は可能だが非推奨**（下記 R1）。再利用で償却する（R2） |
| `wasabi` | **1 行**（wasabi-beef のみ） | 他に使う行なし | **削減できない**（識別の中心）。再利用の見込みなし |

| 案 | 新食材 | 内容 | 評価 |
|---|---|---|---|
| **R0**（本書の仕様） | 3 | beef / soy-sauce / wasabi をそのまま追加 | 忠実度は最大。新食材 3 は late の既存 step（1〜2 材料）より多い |
| **R1** | 2 | soy-sauce の代わりに出荷済みの `miso-sauce`（「甘辛だれ」）を基底ソースにする | **GAMEPLAY ASSUMPTION の置換**。matrix の「醤油ソース」から離れ、`miso-sauce` を late の別 step が持つため解禁順にも注意。新食材は減るが、レシピの同一性が原典の記録から離れる。**非推奨** |
| **R2（推奨）** | 3（バッチ全体では実質 1 行分を償却） | R0 のまま、soy-sauce を**バッチ内の「甘辛だれ」系の共通下地**に採用して償却（bulgogi ほか。D-B1） | 追加材料の純減は無いが、バッチ全体の 1 レシピあたり新食材が下がる（姉妹資料 §3） |
| R3 | 2 | beef を使わず、既存の肉（pork・chicken）で代替 | **不可**: レシピの名前と同一性を失う |

**結論:** 3 → 2 への削減は soy-sauce の置換（R1）でしかできず、忠実度を失う。**削減ではなく、beef と soy-sauce の再利用でバッチ全体の新食材を償却する**（R2）のが妥当。wasabi は再利用不可。**ただし late 専用にした材料は通常レシピから使えない**（§3 の注）ため、**beef は通常 step で先に出す**（B）ことが再利用の前提になる。単独（S）で出すと beef の再利用は事実上失われる。

## 9. 実装規模（実測）と、バッチに入れたときの差

直近の late catalog の単独 PR の実測（GitHub の PR 統計と `git show --numstat`、ファイル種別は本セッションが分類）:

| PR | 内容 | files | 追加 / 削除 | データ（`lateCatalog.ts` + 他の `src`） | 単体テスト（pin・新規） | golden | e2e | docs |
|---|---|---|---|---|---|---|---|---|
| #662 U1 柚子えび | 1 レシピ + 1 材料（SVG なし） | 44 | +1019 / −81 | 約 140 行 | 23 files・約 390 行 | +205 | 188 | 95 |
| #669 U2 ナス田楽 | 1 レシピ + 2 材料（SVG 1） | 54 | +1149 / −100 | 約 150 行（+ 描画 29） | 19 files・約 440 行 | +205 | 199 | 123 |
| #673 U3 ナスとタヒニ | 1 レシピ + 2 材料（SVG 1） | 50 | +996 / −88 | 約 100 行（+ 描画 31） | 19 files・約 330 行 | +204 | 197 | 136 |

**読み取り:** どの PR も約 50 files・約 +1000 行で、**データ（ゲームの中身）は全体の 1〜2 割**。残りは件数 pin の更新・golden・e2e・Result・スクリーンショットという**レシピ数にほとんど依存しない固定費**。open → merge は U1 約 1.4 時間 / U2 約 10 時間 / U3 約 7 時間（Owner の実機 HV 待ちが支配的）。

わさびビーフ 1 件の単独実装の見積もり（**推定**。U2・U3 との類推）: 約 50〜55 files、約 +1100 行、SVG 2 点（beef・wasabi）、Owner HV 1 回。10 レシピをバッチにした場合の差は姉妹資料 §5。

## 10. #579 DRIZZLE / ホットハニー: HOLD 維持の確認

前回から再調査が必要な新事実は無い。DRIZZLE の判断材料（FINISH の category 制限、`MULTI_SAUCE_RECIPE_IDS`、olive-oil の TODO）は `main` `08cd46d` でも同じ。わさびビーフは粒状 topping で足り、DRIZZLE に依存しない。

## 11. 実装計画（**未着手**。Owner の指示後、バッチの一部として）

1. **claim:** #611 に `teto-claim`（files: `lateCatalog.ts`、`ingredients.ts`、`ingredientTaxonomy.ts`、`toppingSizeClass.ts`、`recipeSauceProfiles.ts`、`recipeHintRoles.ts`、`referencePizza.ts`、`orders.ts`、`techniqueAllowlists.ts`、`IngredientGlyph.tsx`、`App.css`、golden、件数 pin、e2e、Result）。重なる claim: #578 U3（11/02）、#679（BBQ、merge 後に着手するのが前提）。重なる open PR: #540（Draft・HOLD、データ系 3 ファイル）。
2. データ → 描画 → テスト → 検証（tsc、oxlint、vitest、build、Chromium 390×844 / 360×800、WebKit は CI）の順。DH4 の件数 pin は原因分解してから更新。
3. HV: 動画 390×844（Owner へ直接）+ スクリーンショット（390 / 360、`docs/reports/screenshots/<task>/`）。**merge = 即公開**（late catalog は本番 ON）。実機 HV と最終承認まで merge しない。

## 12. Gate チェック

| 項目 | 判定 | 備考 |
|---|---|---|
| 食材・時機・工程・解禁・ヒントの具体化（§3〜§5） | **PASS（確認できた範囲）** | 数値・時機は暫定（§7）。DH4 の件数・cohort 文字・Hint golden は**未実測**（実装時） |
| 視覚素材（§6） | **条件付き PASS** | 候補 A の形・soy-sauce の色は Owner 確認と実機 HV |
| 新食材の削減・再利用（§8） | **PASS** | 3 → 2 は忠実度を失う。再利用で償却する案を提示 |
| 原典未確認の明記（§7） | **PASS** | すべて GAMEPLAY ASSUMPTION。事実として断定していない |
| 既存 Issue/PR との重複（§1） | **PASS** | 重複なし。#679 の merge 後に着手、claim を投稿してから |
| 未決仕様 | D-W1〜D-W7（下記） | いずれも実装前の確認事項 |

**判定: Final Design Gate は提出可能。実装開始の GO は Owner の明示的な指示を待つ（runtime は未着手、バッチ計画の承認が先）。**

## 13. Owner への質問

| ID | 質問 | 助言 |
|---|---|---|
| D-W1 | 表示名: 「わさび牛ピザ」か「わさびビーフピザ」か | Owner の呼称に合わせる |
| D-W2 | wasabi の個数と size class: 1 個・`s` か、2 個・`xs` か | 1 個・`s`（U2 の白ごま `xs` 1 個が小さい、という残存リスクを避ける。HV で確定） |
| D-W3 | R2（beef・soy-sauce を再利用で償却）でよいか。R1（miso-sauce へ置換）は採らない | R2 |
| D-W4 | SVG 候補 A（beef = 霜降りの薄切り、wasabi = 緑の盛り）でよいか。emoji の代替は 🐂 / 💚 | A |
| D-W5 | 説明文の文言（例「牛肉と醤油だれに、わさびのツンとした香りをそえた一枚。」） | Owner 文言 |
| D-W6 | soy-sauce の色（暫定 `#3a2418`）を実機 HV で確定する運用でよいか | はい |
| D-W7 | 初回 3 材料 = 360 Pitz の負担を許容するか | 許容。気になるなら step の分け方をバッチ計画で再検討 |
| D-W8 | 姉妹資料のバッチ計画（B10）を承認するか。バッチ内での扱い・基底ソースの決定は姉妹資料 §6 | 姉妹資料を参照 |

## 14. 触れていないもの

`src/**`、`e2e/**`、CSS、テスト、データ、golden、workflow、本番スイッチ、共有 Preview、Production、Firebase、保存データ、`docs/PROJECT_HANDOFF.md`、既存の決定記録、#679 のブランチ、Issue/PR へのコメント・クローズ。merge・deploy・CI 再実行・Monitor 作成はしていない。
