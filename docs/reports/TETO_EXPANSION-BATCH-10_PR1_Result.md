# Expansion Batch 10 / PR-1 — 通常 5 レシピ（Result Report）

ブランチ `claude/teto-pizza-pr1-recipes-j7lu6r`、基準 `main` `f243c52`（#683 の merge commit。#683 は merged を確認済み）。**merge・共有 Preview の更新・Production は未実施（Owner の最終承認待ち）。**
Authority: Owner の正式判断（2026-10-27、ChatGPT 上で承認 → 本 PR で repo に記録）= `docs/decisions/TETO_EXPANSION-BATCH-10_PR1_OWNER-DECISIONS.md`。設計資料（branch `claude/teto-pizza-fresh-audit-wboqxo`）: `TETO_B10_PRE-IMPLEMENTATION-AUDIT_2026-10-27.md`、`TETO_NEXT-BATCH-10_EXPANSION-PLAN_2026-10-27.md`（第 3 版）。
**触れていないもの:** #679（BBQ）・#684（DH4 pin）のブランチ・ファイル、`PROJECT_HANDOFF.md`、workflow、Firebase、本番スイッチ。claim は自分では投稿していない（既存の B10 claim は無いことを確認）。

## 0. 原典について（**確定情報ではない**）
pizzadb.jp の各ページは未確認。レシピの材料集合と基底ソースは 172 matrix の記録による。個数・焼成窓・色（curry-ketchup 以外）・字形・`nameJa`（curry-ketchup 以外）・吹き出し文言は**暫定の GAMEPLAY CALIBRATION**（決定記録 §3 に一覧）。`rendang-pizza` / `tandoori-paneer-pizza` の基底ソースが curry-ketchup なのは matrix 上「未特定」への**仮定（D-B3）**。

## 1. 追加したもの
| 項目 | 内容 |
|---|---|
| レシピ（通常 5、章 4、credited） | `curry-pizza-japan` / `rendang-pizza` / `tandoori-paneer-pizza` / `currywurst` / `cuban-pizza`（No.65〜69）。非ソース 8 片 = リング 8、焼成 58–78、`lunchRush:false`、CUT なし、永久 key-free |
| 新ソース | `curry-ketchup`（カレーケチャップ、`#d9892b` 暫定、Owner 承認）、`mustard`（マスタード、sauce、色 `#d4b020` 暫定） |
| 新チーズ | `paneer`（パニール）、`swiss-cheese`（スイスチーズ）— cheese カテゴリ、family なし |
| 新トッピング | `beef`（meat）、`wurstel`（meat）、`paprika-powder`（spice）、`pickles`（vegetable、Owner 承認）。family の meat / spice は監査の「参考」案を暫定採用（Owner 確認事項） |
| ladder（通常 step 57〜61、星ゲートなし） | 57 `[curry-ketchup]` curry-pizza-japan → 58 `[beef]` rendang-pizza → 59 `[paneer]` tandoori-paneer-pizza → 60 `[paprika-powder, wurstel]` currywurst → 61 `[mustard, pickles, swiss-cheese]` cuban-pizza。順序は**既存の REC-04 規則が導く順**（B10 計画の提案は currywurst → tandoori。規則と一致検査があるため規則に合わせた。解禁コストは同じ） |
| 表 | `ingredients` / `recipes` / `recipeSauceProfiles`（union + PAINT 5 行）/ `discoveryCatalog` / `referencePizza`（8 スロットリング）/ `recipeHintRoles` / `orders` / `ingredientTaxonomy` / `toppingSizeClass` |
| 追加していない | 新しい工程・ジェスチャー・保存形式（schema v2）・採点・経済・FINISH / 後乗せ / late catalog・Pinsa の変更、DH4 gate の緩和、専用公開ゲート（Owner: 新設しない）、`nori`（PR-2） |

合計（`catalogLedger.test.ts` が単一台帳）: **74 レシピ（Pinsa OFF: 73）/ 83 食材（topping 60、sauce 10、cheese 13）/ 65 ladder step / credited 68 / 章 6・12・18・38 / Lunch Rush プール 25**。

## 2. 既存パターンとの差分・注意点
- **ladder 規則**: `discoveryLadder.test.ts` / `discoveryLadder.appendOnly.test.ts` の「規則が導く順との一致」検査は、凍結 prefix を 54 → 56 step に更新（それ以前の step は byte 同一）。
- **late 材料の互換 floor（`LATE_ENTITLEMENT_FLOORS`）**: 通常 step が +5 になり、late 材料の導出 step は 57〜60 → 62〜65。floor は出荷時の値（57〜60）に固定されたままなので、**late catalog ON のビルドでは、late 材料はこれまでどおり累計 57〜60 件の時点で解禁される**（導出値より 5 早い）。旧 save が late 材料を失わないことを `materialEntitlement.lateFloor.test.ts` で固定（出荷時 56 step を基準にした既存ケース + 本番 ladder に対する新規ケース）。副作用として Discovery Progression Inspector の「複数レシピ同時解禁」step に 57〜60 が加わる（late ON のとき）。**late catalog は本番 OFF なので Production の挙動は変わらない。**
- **Phase-2 matrix との関係**: 設計 SSOT の Phase-2 matrix は `curry-pizza-japan` / `rendang-pizza` / `tandoori-paneer-pizza` を `BLOCKED_EVIDENCE`（基底ソース未解決・未特定）に分類している。Owner の承認（curry-ketchup を基底とする）が優先するため、`discoveryCatalog.test.ts` と `matcher.test.ts` に**この 3 件だけの明示的な例外**を置いた（matrix 自体は変更なし、非 target 85 行のまま）。currywurst と cuban は Phase-2 でも EVIDENCE_READY_TARGET で、通常どおり照合される。
- **既存 e2e の修正 1 件**: `e2e/new-sauces-b1.spec.ts` は「通常 ladder の末尾 = sichuan の step」を仮定していたため、自分の step を ladder から導出する形に変更。
- **`researchAttempt.sim.test.ts` の分割**: 1 つの `it`（約 120 walk）が 600 秒の枠を超えた（カタログ増加による）。#682 と同種の対処で `it` を分割（assertion は全て維持、timeout は据え置き）。分割後の最長の `it` は約 100 秒。

## 3. 互換性の検証
| 観点 | 結果 |
|---|---|
| Pinsa ON/OFF | 全 Vitest を **ON と OFF（`TETO_PINSA_OFF=1`）の両方**で実行（§6）。B10 は Pinsa の材料・生地を使わず、late step の導出は動かない。`pinsaGate.test.ts` の OFF 専用一覧は PR-2（late）で追記する範囲で、今回は変更なし |
| 既存 save | schema v2 のまま・migration なし。`persistence.batch10.test.ts`: 新材料 / 新 Dex を持つ save の往復、導入前の save が不変、**未知の id（B10 前のビルドが見る新 id の代理）が書き戻しで落ちない**。`materialEntitlement.lateFloor.test.ts`: 旧 save が late 材料を失わない |
| Research identifier | `researchCohortLetter.batch10.test.ts`（**本番の `researchCohortLetters`**）: ladder 順の全 prefix で新 5 件は文字なし・既存の文字は不変、ランダム取得順 40 通り × 全 prefix で「一度付いた文字は変わらない」、INV-B7（全 cohort の label は解禁材料名と文字のみ）。手元の追加測定（150 順 × 全 prefix）でも baseline・B10 後ともドリフト 0。取得順次第で新 5 件が文字を得うる（最大 cohort が増える）点は監査 §2.2 どおり |
| late step 番号 | 上記 floor。ordinary 61 step + late 4 step = 65。`catalogLedger` の ladderSteps = 65 |
| 一意性 | 新 5 件の材料集合は既存 69 件と一致・部分集合・上位集合の関係なし（`expansionBatch10.pr1.test.ts`）|

## 4. golden・件数 pin
- `hint5.ladders55.json`: **+1,065 行 / 削除 0**（既存エントリは byte 同一、5 件の挿入のみ）。`hint5.alphaFamilyOnly.json`: 5 キー追記 + `eggplant-dengaku-pizza` の値が 25 → 47（family 構成の変化）。DH4-1 audit JSON: 件数のみ（catalog comparison 数）。
- `deductionGuard.gate` の旧 DH4-2A 件数 pin: 132 → **173**。hardened ガードの `toEqual([])` と全 privacy assertion は無改変で pass。**材料別の分解測定は今回は行っていない**（8 材料と 5 レシピは相互依存で、validator が材料なしのレシピを拒否するため。テスト内コメントに明記）。
- その他は件数 pin の追随のみ（recipes / credited / ingredients / 章サイズ / shelf / lunchRush 除外 / progression の利用可能 recipe / materialShop の offer / batch manifest）。assertion の削除・緩和なし。
- 追加テスト: `expansionBatch10.pr1.test.ts`（材料・family・ladder・offer・一意性・Reference）、`researchCohortLetter.batch10.test.ts`、`persistence.batch10.test.ts`。

## 5. Contract 2.1 §15 の再計算（OD-544-8）
- **実施内容**: 実 reducer を通す試行 walk（`src/logic/testSupport/researchAttemptSim.ts`、Hint 5.0 ON、profile NONE、★4、探索ピースは pack 単位、tray 順 seed 0〜5）を**現行カタログ（74 レシピ）全体**に対して実行。複数ソース前提（現行 engine: 1 ピザに複数ソース可、最終構築で外れたとき 2 つ目のソースを足す）を含む。
- **結果**: 全 recipe 合計 **832〜842 attempt**（73 stage、平均 **11.4〜11.5**）。ordinary のみ（68 stage）で 730〜740（平均 10.7〜10.9）。今回の 5 件は各 20〜21（合計 104）。最大は 21。全 6 walk で完走、**Contract の不変条件違反 0**、`researchAttempt.sim.test.ts`（36 + 補助 + 感度 72 walk）全 pass。
- **限界（Owner 判断材料）**: §15 の旧表（27 レシピ、解析的な blind scan の期待値、方式 A/B/C-1）とは**測定方法が違う**ため直接比較できない（旧表は置換せず、注記を追加）。旧方式の複数ソース版（解析式）は再実装していない。B10 前の同方式 walk（同じ harness を main で走らせた値）は取っていない。
- `docs/decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md` §15 に 2026-10-27 の注記を追加（旧表は当時の値のまま）。

## 6. 検証結果
| 検証 | 結果 |
|---|---|
| `tsc -b` | pass |
| `oxlint` | 既存の warning のみ（新規なし） |
| Vitest 全体（Pinsa ON、既定） | 全体 1 回目: **537 files、9,998 passed / 3 failed / 13 skipped**。失敗 3 件はすべて本 PR 内で修正済み（`lunchRush.exclusion` の並び順 pin、`deductionGuard.gate` の件数 pin 174 → 173、`researchAttempt.sim` の 600 秒超過 → `it` 分割）。修正後に該当 3 files を再実行: **3 files / 37 tests すべて pass**（sim の最長 `it` は約 100 秒、ファイル全体 562 秒）。全体の再実行はしていない（修正は該当 3 files のテストのみで製品コードは無変更） |
| Vitest 全体（Pinsa OFF、`TETO_PINSA_OFF=1`） | 全体 1 回目: **537 files、9,991 passed / 2 failed / 12 skipped**（ON の 13 skipped との差は OFF 専用 describe）。失敗 2 件は上記と同じ stale pin（lunchRush 順序・deductionGuard 件数）で、修正後に該当 3 files を `TETO_PINSA_OFF=1` で再実行: **37 tests すべて pass**。`pinsaGate.test.ts` の OFF 専用スイートは今回の変更で赤くならない |
| e2e（Chromium 390×844、新規 `e2e/expansion-batch10-pr1.spec.ts` + 関連 spec） | 関連 spec 約 50 本（`CATALOG_COUNTS` / ladder / RECIPES を参照するもの）: **138 passed / 4 failed / 36 skipped**。失敗 4 件の内訳: ① `expansion3-pesto-trapanese` — 末尾の `console.error` 空判定が `Failed to load resource: 404` で落ちる（**このサンドボックスの既存の挙動**。クリーンな main でも `new-sauces-b1` が同じ 404 で落ちることを確認。新規 spec も同じ 404 のみで、機能的な assertion は全て通過）② `discovery-hint-sheet:278` — **クリーンな main でも timeout で落ちる**（既存、本 PR 無関係）③ `expansion-grandma:158` — 4 並列では落ちたが**単独実行で pass**（ペイント操作の負荷依存の flake）④ `new-sauces-u1` — **本 PR が原因**: トレイが 10 sauce でページ分割され、柚子胡椒のチップが 2 ページ目になった。spec 側を `chipOnTrayOrPin` に修正し、修正後 pass。あわせて `new-sauces-b1.spec.ts` は自分の step を ladder から導出するよう修正 |
| WebKit / CI / Codex | PR 作成後に報告（サンドボックスに WebKit なし）|

## 7. Human Verification（`TETO_HUMAN-VERIFICATION-POLICY.md`）
### Human Verification Videos
| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `expansion-batch10-pr1-curry-pizza-japan-390x844.mp4` | 390×844 | 31.9 秒 | 629 KB | PASS |
| `expansion-batch10-pr1-cuban-pizza-390x844.mp4` | 390×844 | 41.5 秒 | 769 KB | PASS |

Download: セッション内直接提出（動画は repo に commit しない。`artifacts/review/` は gitignore 済み）。コーデック H.264（yuv420p、`ffprobe` で確認）、WebM → MP4 に ffmpeg で変換。

Video Verification: PASS（ファイルあり・size > 0・最後まで再生可・viewport 全体・対象操作が映る。末尾の frame を取り出して表示を確認）

**この動画で確認できること**
- Shop の NEW 行（curry-pizza-japan: カレーケチャップ 1 つ、cuban-pizza: マスタード・ピクルス・スイスチーズ 3 つ。各 初回 120 Pitz）と購入。
- 図鑑の Research Entry（「？？？ピザ（カレーケチャップ）」「？？？ピザ（スイスチーズ）」: 解禁材料名のみで、レシピ名の漏えいなし）。
- ソース工程: 新ソースを既存の PAINT 操作で塗る（カレーケチャップ `#d9892b`、マスタード `#d4b020`。**色は暫定。実機で確認してほしい**）。トレイが 10 sauce でページ分割され、マスタードは 2 ページ目にある。
- チーズ・具材の配置、焼成、NEW DISCOVERY、図鑑（導入後の総数 74）。

**注意:** 動画はサンドボックスの Chromium（Playwright）での撮影で、**実機（iPhone Safari）の HV ではない**。各 spec の末尾が `console.error`（404）で赤になるのは上記のとおりサンドボックスの既存の挙動（操作自体は全て完走）。

- スクリーンショット（committed）: `docs/reports/screenshots/expansion-batch10-pr1/` — 390×844 と 360×800 の各 18 枚（Shop NEW ×4 材料、Research Entry、トレイ（ソース / 具材）、ソース塗布、具材配置、NEW DISCOVERY、図鑑）。before は「新規レシピのため存在しない」（追加された画面のみ）。
- **実機 HV は未実施。** Owner に見てほしい点: ①curry-ketchup / mustard の色（塗布後・焼成後。2 色の見分け）②新材料の字形（emoji の暫定: 🍛 カレーケチャップ、🐄 牛肉、🟧 パプリカ、🌯 ヴルステル、🟡 マスタード、🍈 ピクルス、🧀 チーズ 2 種）と名称 ③トレイのページ送り（sauce が 10 種で 2 ページ）④Shop の NEW 行の見え方。

## 8. Owner に残る判断
1. **色**: curry-ketchup `#d9892b`（承認済み・実機で確定）と mustard `#d4b020`（暫定）。両方が黄褐色（ΔE≈27）。焼き色の濃い生地の上での見え方（監査: こんがりとの ΔE 17.5）。
2. 新材料の `nameJa`・字形（emoji fallback。専用 SVG は無し）、topping family（beef / wurstel = meat、paprika-powder = spice）、size class。
3. 個数・焼成窓 58–78・吹き出し文言（暫定）。`rendang` / `tandoori-paneer` の基底ソース（仮定 D-B3）。
4. ladder の順序（規則が導く順に合わせた。B10 計画の提案順を望む場合は規則の例外化が必要）。
5. §15 の再計算の方式（上記の限界）。
6. merge と共有 Preview の更新（未実施）。PR-2（late 4 件）は #679 と本 PR の merge 後、公開ゲート（D-G1）の選択を含め別途。

## 9. Final Gate（2026-10-27、HEAD `84ce914`）
| 項目 | 状態 |
|---|---|
| HEAD / mergeable | `84ce91460fbb6446c14a19fcb6e1e2c383771ab6`、`mergeable_state: clean`、base `main` = `f243c52`（#683 の merge commit、base の動きなし） |
| CI | **11/11 success**（build、classify、layout-chromium、Layout Contract Gate、WebKit 390×844 / 360×800 各 shard 1〜3、WebKit Gate）。再実行なし |
| Codex | `84ce914` に対し **「Didn't find any major issues」**（receipt `codex-review-receipt:v1`、summary `status: completed` / `has_unresolved_findings: false`）。review thread **0 件**（未解決なし） |
| 他の open PR との重複 | #679（BBQ）・#684 とは別ブランチのまま。触れていない |
| Preview | 共有 Preview（`teto-pizza-game-preview`）を **Owner の承認を得て** `84ce914` / PR #686 で更新（§10）。直前の Preview は PR #618（`a6c1463226254e6a769842ce3fa678465f7c93a7`、2026-10-24 build）で、復元は同 SHA を指定して再デプロイする |
| merge | **未実施。Owner の最終承認と実機 HV の結果待ち**（HV の PASS/FAIL は Owner の言葉で記録する） |

推奨モデル: 実装・テスト・Final Gate の確認は **Claude Sonnet**（本 PR はこれで足りた）。Opus が要るのは、Phase-2 matrix の例外（BLOCKED_EVIDENCE の 3 件）や ladder 規則の変更のような仕様衝突を**再判断する場合**に限る。

## 10. Preview と iPhone での確認手順
Preview URL: **https://perusonao.github.io/teto-pizza-game-preview/**（画面隅の PREVIEW バッジに `#686` と短縮 SHA `84ce914` が出ていれば対象のビルド）。Production（`/teto-pizza-game/`）・main・Firebase には影響しない（別リポジトリ、別 save キー `teto-pizza-preview-save-v1`、Firebase 設定なしのビルド）。**Preview の save は使い捨て**（全 Preview ビルドで同じキーを共有するため、他 PR のビルドの save を読みうる）。

**最短の確認手順（5 レシピ）** — Preview の save は新規なので、ladder 57〜61 まで進める必要があります。Preview 限定の **State Editor**（URL の末尾に `?dev=state`、または設定画面のリンク）を使います: プリセット「**All Ingredients**」（全材料 OWNED、在庫 10）を適用 → ゲームに戻る。これで 5 レシピすべてが材料そろいの状態になります（cuban だけなら「**Last Step Ready**」: 最後の ladder step に到達し、その step の材料がショップで NEW・未購入）。通常プレイで進める場合は、図鑑を 56 件相当まで進めると step 57 が解禁されます。確認:
1. **step 57 カレーケチャップ → カレーピザ**: ショップで NEW「カレーケチャップ」（初回 120）を購入 → 図鑑の「？？？ピザ（カレーケチャップ）」→ ソース: カレーケチャップを塗る → チーズ: モッツァレラ 2 → 具材: チキン 3・たまねぎ 3 → 焼く → NEW DISCOVERY「カレーピザ」。
2. **step 58 牛肉 → ルンダンピザ**: 牛肉を購入 → ソース: カレーケチャップ → モッツァレラ 2・牛肉 3・たまねぎ 3。
3. **step 59 パニール → タンドリーパニールピザ**: カレーケチャップ → モッツァレラ 2・パニール 2・ピーマン 2・たまねぎ 2。
4. **step 60 パプリカパウダー + ヴルステル → カリーヴルストピザ**: カレーケチャップ → モッツァレラ 2・ヴルステル 4・パプリカパウダー 2。
5. **step 61 マスタード + ピクルス + スイスチーズ → キューバンピザ**: マスタード → スイスチーズ 2 → 豚肉 3・ハム 2・ピクルス 1。ソースのトレイは 2 ページ目にマスタードがある。
（All Ingredients で始めると Shop の NEW 表示は出ません。Shop の NEW・購入は「Last Step Ready」で cuban の 3 材料を確認できます。）各レシピで見るのは: 図鑑のラベルが解禁材料名のみ（レシピ名が出ない）、新ソースが塗れる、NEW DISCOVERY、図鑑の総数（74）。

## 11. 未確定の見た目・材料（Owner 判断が要るもの）
1. **色**: カレーケチャップ `#d9892b`（承認済み、実機で確定）とマスタード `#d4b020`（暫定）は同じ黄褐色系（ΔE≈27）。塗布後・焼成後（特にこんがり色の生地の上: ΔE≈17.5）の見分けを実機で確認してほしい。
2. **字形**: 新 8 材料はすべて emoji fallback（専用 SVG なし）。ピクルス 🍈（メロン）・パプリカ 🟧・ヴルステル 🌯・マスタード 🟡 は意味が合わない暫定の字形。実機での見え方と、専用 SVG にするかの判断。
3. **名称**: 牛肉・ヴルステル・パプリカパウダー・パニール・マスタード・ピクルス・スイスチーズ（`カレーケチャップ` 以外は暫定）。
4. **family**: beef / wurstel = meat、paprika-powder = spice（監査の参考案を暫定採用。Owner の承認項目外）。
5. **レシピの仮定**: `rendang` / `tandoori-paneer` の基底が curry-ketchup（D-B3）、個数・焼成窓 58–78、吹き出し文言。原典未確認。
6. **トレイの操作性**: sauce が 10 種になり、トレイが 2 ページに分かれる（新しいソースが 2 ページ目）。実機での探しやすさ。
