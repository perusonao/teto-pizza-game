# Ingredient Visual Phase 1A — Style Lock Fresh Gate（着手順の確定）

Status: **調査と docs-only の記録のみ。`src/`・CSS・e2e・設定・SVG 資産は変更していない。Issue / PR の作成、merge、deploy、Preview 変更、Monitor 作成なし。他セッションのブランチ・進行中 PR は変更していない。** 本書は Gate の**判定記録**であり、実装の承認ではない。Pilot の着手・順序・割当は Owner の判断。
Base: `main` `3bc4ba63da4f7d38ea45ae1b477db18ab40f2b1f`（PR #697 の squash merge、2026-10-29 21:36 JST）。調査日: 2026-10-29。
入力（食材ビジュアル Fresh Audit）: ブランチ `claude/teto-ingredient-visual-audit-a401jy` の commit `8ad3e0d`（`docs/reports/TETO_INGREDIENT-VISUAL_Fresh-Visual-Audit_2026-10-29.md` と `…_scores.csv`）。**この資料はまだ main に入っていない**（取り込みは Owner 判断）。
更新した資料: `docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md`（§11 追加、冒頭に注記 1 つ。決定の変更なし）、`docs/design/references/ingredient-icons-2.0/README.md`（日付付き注記 1 つ）。

## 0. 結論

| 候補 | Gate | 一言 |
|---|---|---|
| **Pilot D**（salmon / cream-cheese、#623） | **YELLOW** | #584 / #621 の技術的な前提は満たされたように見える。着手前に Owner の判断・claim・最新 Owner Gate・`App.css` 重複確認が要る。**実装は開始しない** |
| **Pilot B**（grana-padano / parmigiano / gorgonzola） | **RED（HOLD）** | #438 の Owner HV 結果が記録されていない |
| **肉 4 種**（pepperoni / salami / prosciutto-crudo / pork） | **RED（未割当）** | Style Lock で形は確定済みだが、Pilot 割当が未決。Pilot D と同じファイルのため直列 |
| **魚介 4 種**（sardine / salt-cod / tuna / anchovy） | **RED（未割当）** | 同上。既存の専用 SVG との重複はない |

- **Gate の定義:** GREEN = 全条件を一次情報（コード・GitHub の現状）で確認でき、Owner の承認があれば即着手できる。YELLOW = 技術的前提は満たされたように見えるが、Owner 判断または着手時の確認が残る。RED = 前提が未達、または Owner の割当・記録が無い。**過去の報告だけで GREEN にしていない。** 前回の Fresh Audit が「満たされたように見える」とした点も、下記のとおり一次情報で再確認した。
- **Phase 1 の推奨順序:** ① Pilot D（Owner の着手判断後）→ ② Owner が #438 の HV を記録 → ③ 肉 4 種（Pilot E 案）→ ④ 魚介 4 種（Pilot F 案）→ ⑤ Pilot B（HV 記録後）。同一ファイルを触るため**直列**（§6）。割当と順序は Owner 判断（§9）。

## 1. Fresh State

| 項目 | 結果 |
|---|---|
| `origin/main` | `3bc4ba6`。**前回の Audit 時の `ffff081` から進んだ**（`#697` merge）。#697 の変更（50 ファイル）に `ingredients.ts` / `IngredientGlyph.tsx` / `.test.tsx` / `App.css` / `IngredientPieceVisual.tsx` / `toppingSizeClass.ts` は**含まれない**（`PizzaStage.tsx` は +5 行、`CookingPrep*`・`prep/*`・`gameReducer.ts`・`GameScreen.tsx`・`App.tsx` が主） |
| `CLAUDE.md` / HV Policy | UI/UX の変更は HV 必須。本件は docs-only のため HV・Preview の対象外 |
| `docs/PROJECT_HANDOFF.md` | 冒頭が 2026-09-18 のまま。**HOT file のため触れない**（Style Lock §10.8 のとおり）。GitHub の現状を authoritative とした |
| open PR | #697 は merge 済みで open ではない。open は #651 / #650 / #620 / #612 / #587（docs）、#581（Square Dough UX）、#540（HOLD・Draft）、#478（Draft）、#468、#391、#321、#296 ほか |
| Style Lock v2 | §0〜§10（2026-10-22）。現行との食い違いを §11 に記録（本 Gate） |
| #623 / #584 / #621 / #627 / #438 | §2 |
| 食材ビジュアル Fresh Audit | commit `8ad3e0d`（上記）。数値は `ffff081` の実画面測定。**#697 は Pilot 対象のファイルに触れていないため、`3bc4ba6` でも結論は変わらない**（`git diff ffff081 3bc4ba6 --stat` で確認） |

## 2. 関連 Issue / PR の最新状態（一次情報）

| 対象 | 状態 | 根拠 |
|---|---|---|
| **#584**（Batch 8c） | **closed・merge されていない**（2026-10-23 01:56Z）。head `e2ac301`。ikura-salmon-pizza の正規経路は #627 に置換 | PR の状態。証跡保全は #632（`docs(archive): PR #584 (Batch 8c) の証跡を保全 — #627 で置換`） |
| **#621**（FIN-E4b-ikura） | **open**。実装は #627 で完了。残りは E5 の公開ゲート G-1〜G-5（AC-8 の再測定・動画、Q-5、late step 番号、検証環境、実機 HV）で、**Pilot D の前提ではない** | Issue コメント（2026-10-23 の 3 件）。最後の記録は G-1 / G-5 とも「未実施」。以降の更新は未確認 |
| **#627**（実装） | **merged**（2026-10-23 00:41Z、`db6e360`）。salmon-roe の SVG（`salmon-roe-grains`）を main に追加。本番スイッチは当時 OFF | PR |
| **#654**（E5） | **merged**（2026-10-24 12:54Z）。`LATE_CATALOG_PRODUCTION = true` / `FREE_COOK_FINISH_PRODUCTION = true` | PR と main のコード（`src/data/lateCatalog.ts:33`、`src/data/freeCookFinishGate.ts:13`）。**本番デプロイの有無は未確認** |
| **#623**（Pilot D） | **open**。本文・唯一のコメント（2026-10-22）とも**未更新**（「着手は #621 の merge 後」「#584 は HOLD」のまま）。`teto-claim` ブロックなし | Issue |
| **#438**（Pilot A） | **open**。コメントは 2026-10-22 のセッションによる確認 1 件のみ。**Owner の HV 結果（PASS / FAIL / waived）の記録なし**。#417 のコメントは 0 件 | Issue |
| PR #503（Pilot A 実装） | merged。HV 相当の記録としては、Style Lock §0-6 の「2026-10-17 の実機 HV で feta / ricotta がピザ上で同じ白丸になる」という**指摘**（改訂の原因）が残るだけで、改訂後の判定の語はない | Style Lock §0-6、`COMPARISON-NOTES_hotdog-sausage.md`（「判定は未記録」） |
| Owner Gate（dry-run） | **最後の実行は 2026-10-22**（run 39786435641、head `aecf867`）。以降の実行は見当たらない。**本セッションは実行しない**（Actions の起動は書き込み操作） | Actions の workflow_dispatch 履歴 |

## 3. Gate 判定

### 3.1 Pilot D（salmon / cream-cheese、#623）— **YELLOW**

#623 本文の着手条件と、一次情報の突き合わせ:

| 条件（#623 / Style Lock §10.3） | 現状 | 判定 |
|---|---|---|
| #584 の扱い（HOLD 継続 / close）が決まっている | **close（未 merge）**、#632 で証跡保全 | ✔ |
| #621 の merge 順が決まっている | **#627 が merge 済み**（`db6e360`）。Pilot D は最新 main から始める前提で、salmon-roe の追加（`App.css` の 1.2em ルール、`IngredientGlyph.tsx`）は main に取り込まれている | ✔ |
| 重なる PR との整合 | **#468 は `src/App.css`（HOT）と `PizzaStage.tsx` を触る**（古い base `41efe27` のまま open、2026-10-12 以降更新なし。`git diff` で確認）。#478 は `IngredientTray.tsx` / `GameScreen.tsx`、#540（HOLD）は Pilot 対象ファイルに触れない | **要確認**（`App.css` の局所追加と #468 の関係。#621 の claim コメントは「#468 は後から最新 main に追従」としていた） |
| 最新 Owner Gate レポートの確認 | 最後の実行が 10-22 で古い | **未達**（Owner が再実行） |
| claim の投稿（#623 に `teto-claim`） | なし | **未達**（着手時） |
| Owner が「満たした」と判断 | #623 本文は「Owner が満たしたと判断した時点」。記録なし | **未達（Owner 判断）** |
| Pilot D の完了条件: iPhone Safari 実機 HV | 実装後 | 着手後の条件（Style Lock §10.3-5。延期の対象外） |

- **変更ファイル（#623 の 4 ファイル）:** `src/data/ingredients.ts`（`DedicatedIngredientVisual` に 2 値 + `pieceVisual` 各 1 行）、`src/components/IngredientGlyph.tsx`（`VISUAL_VIEWBOX` 2 行、visual 2 つ、分岐 2 行。`cream-cheese.svg` の無描画 path は移植しない）、`IngredientGlyph.test.tsx`（dedicated 集合 + 描画・viewBox・id 非依存）、`src/App.css`（HOT、個別 1.2em ルール）。`toppingSizeClass.ts` は変更不要（salmon = l、cream-cheese = l）。`pieceVisual` 名は案: `salmon-fillet` / `cream-cheese-block`（#623 で確定）。
- **本番への影響（現状）:** E5（#654）が merge 済みのため、**salmon（絵文字 🍣）・cream-cheese（汎用 CSS 円）と roe・shiso（SVG）の混在は本番コード上の `ikura-salmon-pizza` にある**。salmon は 3 レシピ、cream-cheese は 4 レシピで使う（`RECIPES` を実行して集計）。Style Lock §10.3-6 は「E5 前までに解消するかは決めていない」で、E5 が merge された現在は**解消時期が Owner の判断待ち**（§7）。
- **後乗せ層の測定（参考）:** 前回の Audit（Chromium、固定配置）では、FINISH 層の salmon-roe の輪郭 ΔE は 3.4（橙の生地・ソースの上）。#621 の AC-8（3 状態の再測定と動画）の代わりにはならない。

### 3.2 Pilot B（grana-padano / parmigiano / gorgonzola）— **RED（HOLD）**

- Gate は **#438 の Owner HV 結果の記録**（Style Lock §0-7(e)、§5）。記録は #438 / #417 / 既存の Pilot A 資料のどこにも無い（§2）。**PASS 扱いにしない。**
- 既存方式（`pieceVisual`、`.pizza-cheese--glyph` ラッパー内の SVG、§0-6 / §4.4）を使う。**暫定の CSS 円（形の手がかり）は追加しない**（Style Lock §2: 未移行チーズの CSS は変更しない）。
- 変更ファイル: Pilot D と同じ 4 ファイル。参照 SVG 3 点（grana-padano 板、parmigiano 砕けた塊、gorgonzola くさび）は §2 に適合（`id` / gradient / `<defs>` なし）。grana ↔ parmigiano の形の区別は Pilot A の HV で判定する想定だった（§5）。
- Owner が結果を記録すれば、Gate は YELLOW（Pilot D の後・同一ファイルの直列）になる。

### 3.3 肉 4 種（pepperoni / salami / prosciutto-crudo / pork）— **RED（未割当）**

| 観点 | 結果 |
|---|---|
| デザイン | **確定済み**（§1b: pepperoni = A、salami = B、prosciutto-crudo = B、pork = B）。参照 SVG 4 点あり、§2 適合（確認済み）。`pieceVisual` 名の案: `pepperoni-slices` / `salami-log` / `prosciutto-ribbon` / `porchetta-roll`（§4.1。実装 Issue で確定） |
| 現在の描画 | pepperoni 🔴 / salami 🟤（単色の丸絵文字）、prosciutto-crudo 🍥、pork 🐖（動物）。いずれも `pieceVisual` なし。Fresh Audit の実測では pepperoni がソース上の輪郭 ΔE 3.0 で全食材中最小 |
| Pilot 割当 | **なし**。Style Lock §5: 残り 17 種の割当は「Owner が A〜C の HV 後に決める」。Pilot A の HV は未記録（§2） |
| 既知リスク（Lock §1c） | salami B の 20px 識別（ログ + スライスが潰れないか。pepperoni A・sausage・hot-dog と並べて、グレースケールでも）。不足なら Owner にデザイン再相談（形・色の変更は Owner 承認） |
| 変更ファイル | Pilot D と同じ 4 ファイル。`toppingSizeClass.ts` は変更不要（pepperoni = m、salami = m、prosciutto-crudo = xl、pork = m。**prosciutto は xl の箱に 1.2em を足すか、HV で判断**） |
| 使用レシピ数 | pepperoni 2、salami 1、prosciutto-crudo 4、pork 2（`RECIPES` 80 件から集計） |
| 依存 | Pilot D とファイルが重なるため**直列**。#697 とは無関係（§5）。#468 と `App.css`（HOT） |

### 3.4 魚介 4 種（sardine / salt-cod / tuna / anchovy）— **RED（未割当）**

- **対象の特定:** 前回の Fresh Audit が「Style Lock 済みで未実装・描画が意味に合わない」とした魚介は、**sardine（🎏 鯉のぼり）/ salt-cod（🐡 フグ）/ tuna（🐠 熱帯魚）/ anchovy（🐟）の 4 種**。salmon は Pilot D、shrimp / clam は実装済み。Lock の魚介 7 種（anchovy / sardine / tuna / shrimp / salmon / salt-cod / clam）の残り未実装 5 種から salmon を除いた数に一致。
- **既存の専用 SVG との重複:** なし（`pieceVisual` を持つ魚介は shrimp-curl / whitebait-school / clam-valve / mussel-shell / salmon-roe-grains / cod-roe-mass）。`DedicatedIngredientVisual` に sardine / salt-cod / tuna / anchovy 用の値は無い。**近接**: whitebait（白い小魚 3 匹）と sardine / anchovy、cod-roe と salmon-roe、shrimp と salmon（橙〜桃色）。形で区別する設計（Lock §1 の識別の要点）。
- デザイン: 確定済み（anchovy = A、sardine = B、tuna = A、salt-cod = B）。参照 SVG 4 点は §2 適合。`pieceVisual` 名の案: `anchovy-fillets` / `sardine-fish` / `tuna-block` / `salt-cod-fillet`。
- 既知リスク（Lock §1c）: **salt-cod B とチーズ類（feta / cream-cheese / mozzarella / ricotta）の 20〜24px・淡色／赤背景での混同**、anchovy ↔ bacon のグレースケール近似。
- 使用レシピ数: sardine 1、salt-cod 1、tuna 3、anchovy 2。
- Pilot 割当なし、Pilot D と直列、#697 と無関係（Pilot 肉 4 種と同じ）。

## 4. 既存 Owner 判断との整合

| Owner 判断（出典） | 本 Gate での扱い |
|---|---|
| Pilot D を優先（§0-7(c)、2026-10-22） | 最優先。Gate は YELLOW |
| Pilot B は #438 の HV 記録まで HOLD（§0-7(e)） | RED のまま。**PASS 扱いにしない** |
| Pilot 順は D → B → C（§5 追記） | 維持。E / F（肉・魚介）の位置は**Owner が決める**ため、本書は「案」として提示（§6） |
| 暫定の CSS 円を足さない（Lock §2、本指示） | 追加しない |
| 🍃（oregano / spinach）・🌱（rosemary / artichoke）の重複は対象外（§9.6、HV 通過済み） | **再審議しない**。本 Gate の対象外 |
| #468 / #478 保留、Candidate C は Preview 限定（§0-7(f)） | 触れない |
| sausage の暗さは現状維持（§1） | 肉 4 種の判断には含めない（salami / pepperoni との並びだけ HV で確認） |
| shrimp = むきエビ（§1d）、pickles / wurstel / paprika-powder（§1e） | 実装済みのまま。Lock 未記載の 11 種は**追認しない**（§11.1 に記録のみ） |

**不整合は見つからなかった。** ただし #623 の本文・Style Lock の旧記述は現状と食い違う（§11.2 に記録）。

## 5. PR #697 との干渉

- **#697 は merge 済み**（`3bc4ba6`）。本 Gate は #697 のコード・調理状態表現に触れていない。
- Pilot 対象ファイル（`ingredients.ts` / `IngredientGlyph.tsx` / `.test.tsx` / `App.css` / `toppingSizeClass.ts`）は #697 の変更に含まれない。`PizzaStage.tsx` は +5 行のみで、Pilot は触らない。
- **干渉の可能性があるもの:** 牛肉の SVG（`BeefSlices`）と `.ingredient-piece--prepared` の CSS 変数による色の切り替え（`preparedPieceVisual` は `beef` のみ）。Pilot D / E / F / B は牛肉を触らず、**既存 SVG の色や `fill` 指定を変えない**ため干渉しない。**調理状態の汎用化（Fresh Audit の P2）は別件**で、本 Phase 1 に含めない。
- 設計原則「#697 の調理状態表現と干渉させない」: Pilot の SVG は `fill` / `stroke` を属性で持ち（Lock §2）、調理状態は CSS 変数で上書きする方式と**両立**する。ただし新しい食材 SVG に調理状態を足す作業は Phase 1 の範囲外。

## 6. Phase 1 の着手順（案。確定は Owner）

| 順 | 内容 | 前提 | ファイル | 備考 |
|--:|---|---|---|---|
| 1 | **Pilot D**（salmon / cream-cheese） | Owner の着手判断、claim、最新 Owner Gate、#468 の `App.css` 確認 | 4 ファイル | 本番の混在（E5 済み）を解消。salmon 3 / cream-cheese 4 レシピ |
| 2 | **Owner が #438 の HV 結果を記録** | Owner のみ | なし | Pilot B の Gate、および E / F の割当の前提（§5） |
| 3 | **肉 4 種（Pilot E 案）** | Owner の割当 + 1 の merge 後 | 4 ファイル | 最小の輪郭 ΔE（pepperoni）と意味のズレを解消。salami の 20px HV が肝 |
| 4 | **魚介 4 種（Pilot F 案）** | Owner の割当 + 3 の merge 後 | 4 ファイル | salt-cod とチーズの混同 HV |
| 5 | **Pilot B**（チーズ 3 種） | #438 の HV 記録 | 4 ファイル | E / F と順序を入れ替えるかは Owner |

- **直列の理由:** 全 Pilot が `ingredients.ts` / `IngredientGlyph.tsx` / `.test.tsx` / `App.css`（HOT）を共有する。並行すると同じ行で競合する（#621 の claim コメントでも同じ扱い）。各 Pilot は**最新 main から**始める。
- **各 Pilot の共通の完了条件（Style Lock §6、HV Policy）:** focused unit（`IngredientGlyph.test.tsx` / `ingredients.test.ts`）+ typecheck / lint / build、390×844 と 360×800 の before/after、**iPhone Safari の実機 HV**、保存 schema・採点・レシピ判定・在庫・Dex に差分なし、既存 25 種と未移行食材の表示が不変、未移行チーズが絵文字へ退行しない。
- **E / F は Owner の追加決定が要る:** 4 種ずつの Pilot にするか、割当の順序、`pieceVisual` 名、1.2em 補正の要否（HV で判断）。

## 7. 本番の描画品質への影響（現状）

- 食材の描画が**実際に変わる変更は今回していない**（docs-only）。
- 現状の本番コード（`3bc4ba6`）: 専用 SVG 25 / 全 92 材料、絵文字ピース 43、汎用 CSS 円のチーズ 10（`INGREDIENTS` を実行して集計）。**E5 により ikura-salmon-pizza が本番コード上で有効**で、salmon・cream-cheese が未移行のまま同じ画面に並ぶ。
- 本番デプロイの有無、E5 の実機 HV（#621 G-5）、AC-8 の証跡は**未確認**（#621 の最後の記録は 2026-10-23）。

## 8. 検証（本書の主張）

- `INGREDIENTS` と `RECIPES` を vite の SSR で実行して、`pieceVisual` 25 種・92 材料・レシピ 80 件・使用レシピ数を再計算した（前回の測定時と材料集合は同一、差 0）。
- Lock 26 種の照合: 実装 6 + 未実装 20 = 26。26 種の外の実装済み 19（= 25 − 6）の内訳 2 + 6 + 11 を `ingredients.ts` と Style Lock の本文検索（`grep`）で確認。
- 参照 SVG 13 点（Pilot D / E / F / B の候補）が 64×64・`id` / gradient / `<defs>` / `url(#` なしであることを確認。未実装 20 種すべてに参照 SVG があることをファイル一覧で確認。
- 他 PR のファイル重なり: #468 / #478 / #540 は PR の head を `git fetch`（読み取り）して、merge-base との差分で確認。#581 は GitHub のファイル一覧（Square Dough 系のみ）。docs PR（#651 / #650 / #620 / #612 / #587）は `src/` を含まない（タイトルと範囲）。
- **未確認（推測で PASS にしていない）:** 本番デプロイの状態、#621 の 2026-10-23 以降の更新、Owner による HV の口頭・別所の記録、Owner Gate の最新結果、iPhone 実機での描画。

## 9. Owner 追加判断事項

1. **#623（Pilot D）に着手してよいか。** 着手するなら、#623 本文（「#584 は HOLD」等）の更新、claim の投稿、最新 Owner Gate の実行、#468 の `App.css` 取り扱い（#468 は先にマージ／後追従／close のどれか）。
2. **#438 の HV 結果を記録するか**（PASS / FAIL / waived、日付、対象 head SHA）。Pilot B と E / F の割当の前提。記録がない場合、E / F を先に進めてよいか（Style Lock §5 の「A〜C の HV 後に決める」を緩めるか）。
3. **肉 4 種（Pilot E）・魚介 4 種（Pilot F）の Pilot 化と順序**（D → E → F → B 案でよいか、B を E より前にするか）。1 Pilot = 4 種でよいか。
4. **E5 merge 済みの本番で、salmon・cream-cheese の混在を Pilot D まで許容するか**（§3.1）。
5. **Style Lock 未記載の実装済み 11 種**（arugula / green-onion / white-sesame / pomegranate / cilantro / beef / wasabi / cod-roe / nori / porcini / mussel）を、Style Lock に登録するか（登録するなら別の docs-only 追記。本書は追認していない）。
6. **#621 の公開ゲート（AC-8 の salmon-roe 再測定・動画、G-1〜G-5）の現況**を記録するか。後乗せ層の見た目は Pilot D の HV（roe との識別）と関係する。
7. **食材ビジュアル Fresh Audit（commit `8ad3e0d`）を docs-only PR で main に取り込むか。** 本書と Style Lock §11 はこの Audit を参照している。
8. **Style Lock のヘッダ・§10.1 を直接書き換えるか。** 本 Gate は旧記述を履歴として残し §11 に現行を足した（機械的な書き換えをしていない）。直接修正が必要なら Owner の指示で。`PROJECT_HANDOFF.md`（HOT）の更新は別の docs-only PR。
