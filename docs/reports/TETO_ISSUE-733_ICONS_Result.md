# Issue #733 — 牛肉（角切り）・ピーマン（輪切り）の SVG 差し替え Result Report

Status: **実装、自動検証、Chromium での HV 証跡（390×844 / 360×800）、390×844 の動画まで完了。** iPhone Safari 実機 HV は未実施で、Owner が行う。Owner の承認前は merge しない。共有 Preview・Production は更新していない。
Branch `claude/issue-733-beef-green-pepper-icons`、基準 `main` `d85b957`。
Owner 決定: Issue #733 comment 6650361079（2026-11-05）。OD-1 牛肉 = B 角切り＋断面、OD-2 ピーマン = R1 輪切り×2（GP-A2 からの改訂を明示承認）、OD-3 visual ID は据え置き、OD-4 梅肉・しらすは変更しない、OD-5 大葉は #758、OD-6 識別テストを追加。
調査: 調査ブランチ `claude/teto-pizza-ingredient-icons-q7c1je` の `be64b35`（比較レポート、比較シート、仮合成）。

## 1. 変更（描画のみ）

| ファイル | 変更 |
|---|---|
| `src/components/IngredientGlyph.tsx` | `BeefSlices()` を角切り 3 個（焼けた外側、赤い断面、淡い芯）に、`GreenPepperStrips()` を 4 つのふくらみがある輪切り 2 枚（中は空洞、淡い内壁）に差し替えた。描画結果は候補 SVG（`beef-b-seared-chunks.svg` / `green-pepper-r1-rings.svg`）と一致することを確認した（パスと属性を比較）。輪の形は同じ式でモジュール読み込み時に 1 回だけ計算する（決定的）。`id`・gradient・`<defs>` は使わない |
| `src/components/IngredientGlyph.test.tsx` | 識別テストを 7 件追加した（§3） |
| `src/logic/prep/beefDoneness.ts`、`src/components/CookingPrep.css`、`src/logic/prep/beefDoneness.test.tsx`、`e2e/cooking-prep.spec.ts` | **下ごしらえ「炒める」（#696、Preview/DEV 限定、`PREP_EXPERIENCE_PRODUCTION = false`）の追従。** §2 を参照 |
| `e2e/issue-733-icons.spec.ts`（新規） | HV 用の代表 E2E。スヤピザを NEW DISCOVERY まで通すものと、隣の食材と並べるもの（トレイの絞り込み、生地の上、グレースケール、焼成後） |
| `docs/design/candidates/ingredient-icons-2.0-733-739/` | 調査ブランチの候補 SVG 13 点と README を取り込んだ（採用した 2 点を README に記録） |

**変更していないもの:** visual ID（`beef-slices` / `green-pepper-strips`）、`ingredients.ts`（#748 の claim）、golden、`App.css`（HOT。サイズ補正の 1.2em / 1.45em はそのまま。Pilot E の接地影を隠す規則も、新しいピーマンの最初の楕円に引き続き効く）、`toppingSizeClass.ts`、保存、採点、レシピ、Research、梅肉・しらす・大葉、Steam #756 / #757 のファイル、`src/main.tsx`、Style Lock V2、references の README（#753 の merge 後に別途行う）。

## 2. 下ごしらえ「炒める」との依存（実装中に見つけたもの）

炒めの画面は、牛肉のアイコンの色を CSS で上書きして焼き加減を見せている（`.ingredient-piece--prepared .ingredient-glyph--beef-slices path:nth-of-type(n)`）。生の色（`BEEF_RAW_COLORS`）は旧アイコンの色に固定されていた。絵を角切りにすると `<path>` がなくなるので、Preview の炒めの色変化が効かなくなる。実際に `beefDoneness.test.tsx` 1 件と `e2e/cooking-prep.spec.ts` 12 件が失敗した（main では 50/50 passed）。

最小限の追従を行った（Production には影響しない）。

- CSS のセレクタを、角切りの `<rect>`（外側 = `--beef-lean-2` / `--beef-edge`、断面 = `--beef-lean`、芯 = `--beef-fat`）に向けた。
- 生の色を新しい絵の色に変えた（`lean #c4473f` / `lean2 #6a3220` / `fat`・`fat2 #e57d74` / `edge #3a160e`）。「焼き加減 0 = 出荷中のアイコンと同じ」という不変条件は保たれる（テストで、実際の SVG から色を読んで固定している）。
- 炒め済みの目標色のうち、断面と外側（`lean #7a4226` / `lean2 #5f331f`）は従来の暫定値のまま。芯（旧: 脂の筋 `#d9b48a`）と輪郭（旧: `#3d2314`）は、生から炒め済みへ向かって全部位が暗くなる（既存テストの単調性）ように、`#9a5a3c` と `#2e1a10` に再設定した。焦げの色は変えていない。**→ この炒め済みの目標色は、後に OD-A で B′ に置き換えた（§2a）。**
- `e2e/cooking-prep.spec.ts` は、赤身の色を断面の `<rect>` から読むように変え、生の色の期待値を `rgb(196, 71, 63)` にした。このときは、炒め済み `rgb(122, 66, 38)` と焦げ `rgb(58, 34, 24)` の期待値は変えていない（炒め済みは、OD-A で `rgb(138, 71, 41)` に更新した。§2a）。
- #696 の claim は 2026-10-29 に解放済みで、これらのファイルに触れている open PR もない。#733 の claim を更新した（comment 6650986065）。
- **Owner 判断（OD-A）:** 決定済み。B′ を採用した（§2a）。

## 2a. OD-A: 炒め済みの牛肉の色を B′ に変更（Owner 決定 2026-11-05、Issue #733 comment 6657038390）

経緯:
- 視覚検証（`claude/pr-760-visual-verification-c3o4ol`、`docs/reports/TETO_PR-760_VISUAL-VERIFICATION_Result.md`）で、旧い暫定色が 20〜28px で黒に近く見えること、明るい芯がツヤやハイライトに見えることが分かった。
- Owner の方針（comment 6656697974）に従って A/B 比較をした（同じブランチの `docs/reports/TETO_PR-760_COOKED-BEEF-AB_Result.md`）。B は既存の単調性テスト 2 件に違反したので、それを満たす B′ が採用された。

| 部位（キー） | 旧暫定（A） | **採用（B′）** |
|---|---|---|
| 断面 `lean` | `#7a4226` | `#8a4729` |
| 外側 `lean2` | `#5f331f` | `#66361e` |
| 芯 `fat` / `fat2` | `#9a5a3c` | `#7f4628` |
| 輪郭 `edge` | `#2e1a10` | `#34190e` |

- 変更したのは、`src/logic/prep/beefDoneness.ts` の `BEEF_COOKED_COLORS` 1 行（とその直前のコメント）と、`e2e/cooking-prep.spec.ts` の炒め済みの断面の期待値 2 か所（`rgb(122, 66, 38)` → `rgb(138, 71, 41)`）だけ。
- `BEEF_RAW_COLORS`・`BEEF_BURNT_COLORS`、牛肉・ピーマンの絵、`App.css`、`CookingPrep.css`、食材、保存、採点、Research、本番フラグは変えていない。既存のテストも緩めていない（単調性テスト 2 件はそのまま pass する）。
- 検証（この変更を入れた HEAD）:
  - 関連 Vitest（`beefDoneness` / `PizzaStage.CookingPrep` / `CookingPrepLayer`）: 56/56
  - `e2e/cooking-prep.spec.ts`（Chromium 390×844 / 360×800）: 50/50
  - `tsc -b` / `oxlint` / `npm run build`: exit 0 / exit 0（既存の warning のみ） / 成功
  - CI（WebKit shard を含む）と Codex 再レビューは、PR の最新 HEAD で確認する（PR 本文・コメントに記録）
- HV: スクリーンショット `09`〜`12`（§5）と動画 `pr760-bprime-final-390x844.mp4`（§5）。
- iPhone Safari 実機 HV と最終的な色の承認は、まだ HOLD。

## 3. 識別テスト（OD-6）

`IngredientGlyph.test.tsx` の「Issue #733: beef chunks / green-pepper rings」（7 件）:

1. visual ID が据え置きであること（`beef-slices` / `green-pepper-strips`）
2. 両食材とも、アイコンとピザ上のピースで同じ絵（64 箱）であること。絵文字・`id=`・`url(#`・`<defs>` がないこと
3. 牛肉: `<rect>` 9 個（角切り 3 × 外側・断面・芯）。`<path>` がないこと（帯でない）。旧い脂の筋の色がないこと（ベーコンの描き方でない）
4. 牛肉: 他の肉（ソーセージ、ホットドッグ、ヴルステル、ベーコン、ハム、サラミ、ペパロニ、豚肉、ラム、生ハム、チキン）が、牛肉と同じ markup でも、角切りの外側の色でもないこと。ベーコン・ハム・サラミ・ペパロニは絵文字のまま
5. ピーマン: 空洞の輪（even-odd）2 枚と淡い内壁。細切りの丸い線端・旧い緑・`<circle>` がないこと
6. ピーマン: 他の緑の食材（青ねぎ、ハラペーニョ、ズッキーニ、ピクルス、パクチー、大葉、ルッコラ、バジル、パプリカ）が、同じ markup でも空洞の輪（even-odd）でもないこと
7. 輪の形が決定的で、64 箱の中に収まること

実画面での識別の証跡は、トレイ 26px（肉系・野菜系の絞り込み）、生地の上、焼成後、グレースケール、390×844 / 360×800（§5）。オクラはゲームに食材がないので、比較対象は形の近いズッキーニ・青ねぎとした（調査の比較シートでは、さやの参考絵文字 🫛 と並べている）。

## 4. 検証

| 検証 | 結果 |
|---|---|
| 全 Vitest（Pinsa ON） | §4a |
| focused（`IngredientGlyph.test.tsx`、`src/logic/prep/**`、`PizzaStage.CookingPrep.test.tsx`、`CookingPrepLayer.test.tsx`） | 12 files / 393 passed |
| `tsc -b` / `oxlint` / `npm run build` | exit 0 / exit 0（既存の warning のみ） / 成功 |
| Chromium E2E `e2e/issue-733-icons.spec.ts`（390×844 / 360×800） | 4/4 passed（main で同じシナリオを構造 assertion なしで実行すると 4/4） |
| Chromium E2E `e2e/cooking-prep.spec.ts` | 追従前 38 passed / 12 failed → 追従後 **50/50 passed**（main 50/50） |
| Chromium E2E `pilot-e-ingredient-icons` / `late4` / `b15` / `b12` | 14/14 passed |
| WebKit E2E・CI・Codex | PR の CI と、新しい HEAD への Codex レビューで確認する |
| iPhone 実機 Safari | **未実施**（Owner の HV） |

注: この環境は Playwright 既定の chromium と版が合わない。そのため、一時 config（`executablePath: /opt/pw-browsers/chromium`。コミットしていない）で実行した。

### 4a. 全 Vitest

（PR 本文に記録。§7 も参照）

## 5. Human Verification

### スクリーンショット（コミット済み）: `docs/reports/screenshots/issue-733-icons/`

すべて、main `d85b957`（before）と本ブランチ（after）で同じシナリオを並べたもの。各ファイルに 390×844 と 360×800 がある。

| ファイル | 内容 |
|---|---|
| `01-suya-tray-beef-*` | トレイ chip の牛肉（しらす・青ねぎ・大葉・ラムと同じ頁） |
| `02-suya-topped-*` | スヤピザの生地の上（牛肉 3・ピーマン 1・たまねぎ 2） |
| `03-suya-baked-result-*` | 焼成後の NEW DISCOVERY |
| `04-tray-meat-filter-*` | 肉系の絞り込み（牛肉・サラミ・豚肉・ホットドッグ・ラム） |
| `05-tray-vegetable-filter-*` | 野菜・きのこ系の絞り込み（ピーマン） |
| `06-lineup-topped-*` / `07-…-grayscale-*` | 牛肉・ベーコン・ハムと、ピーマン・青ねぎ・ズッキーニの並び（カラー / グレースケール） |
| `08-lineup-baked-result-*` | 同じ並びの焼成後 |
| `zoom-*.png` | 02 / 03 / 06 / 08 のピザ部分の拡大（before・after × 2 viewport） |
| `09-cooked-beef-stages-*` | OD-A。炒め済みの牛肉の流れ（生 → フライパン 0.1 s / 2.3 s / 2.7 s / 3.15 s → 生地上 → 焼成後）。before（旧暫定色 `b0535b0`）と after（B′） |
| `10-cooked-beef-actual-size-*` | OD-A。DPR 1 相当の実寸（生地上 約 28px、焼成後 約 20px）を画素 4 倍に拡大 |
| `11-cooked-beef-dough-*` / `12-cooked-beef-full-*` | OD-A。生地全体（生 / 炒め済み / 焼成後）と全画面（炒め済みの生地 / 焼成後の結果） |

### 動画（Owner へ直接提出。リポジトリには入れていない）

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `issue-733-icons-390x844.mp4` | 390×844 | 54.5 s | 1.23 MB（1,225,899 B） | PASS |
| `pr760-bprime-final-390x844.mp4`（OD-A B′） | 390×844 | 20.2 s | 0.49 MB（486,370 B） | PASS（h264 High / yuv420p / 30fps / 606 frames、全フレームをデコードできた、空白フレームなし） |

Download: セッション内で直接提出した（`artifacts/review/` は gitignore 済み）。Codec H.264（yuv420p、30fps、1634 frames）。

Video Verification: PASS。ffprobe で h264 / 390×844 / 54.5 s を確認し、全フレームを最後までデコードできた。1 秒ごとに見て空白フレームがないことも確認した（各テストの読み込み中の白画面は切り詰めた）。

`pr760-bprime-final-390x844.mp4` で確認すること: `?cookPrep=on`（Preview/DEV 限定）で牛肉 3 個を置く → 🍳 炒める → 実時間で約 3.1 s（best の中央）に取り出す → ✓ 炒め済み（B′ の色）→ 焼成 → 結果。

`issue-733-icons-390x844.mp4` で確認すること:
- 図鑑から研究に入り、具材ステップのトレイで牛肉 chip が角切りになっている
- 牛肉 3・ピーマン 1・たまねぎ 2 を置くと、生地の上で角切りと輪切りになる
- 焼成して NEW DISCOVERY（スヤピザ）になる。レシピと発見は変わらない
- 肉系・野菜系の絞り込みで、牛肉とピーマンが隣の食材と区別できる
- 牛肉・ベーコン・ハム・ピーマン・青ねぎ・ズッキーニを並べた生地（カラーとグレースケール）と、その焼成後

## 6. 残る Owner 判断

| # | 判断 | 推奨 |
|---|---|---|
| OD-A | **決定済み（2026-11-05、comment 6657038390）:** 炒め済みの色を B′（`#8a4729` / `#66361e` / `#7f4628` / `#34190e`）にした（§2a） | 最終的な色の承認は iPhone HV で行う |
| OD-B | iPhone Safari 実機 HV（20〜26px の角切りが肉と読めるか、輪切りと青ねぎの区別、焼成後） | Owner が実施する |
| OD-C | Style Lock V2（§11 の GP-A2 → R1 の改訂履歴、牛肉の採用記録）と、references（`beef.svg` を新規、`green-pepper.svg` を更新）・README の更新 | #753 の merge 後に docs-only で行う |
| OD-D | visual ID と形の不一致（`beef-slices` は角切り、`green-pepper-strips` は輪切り）。技術的負債として記録する | 改名は #748 の claim が終わった後に、別の Gate で扱う |

## 7. 技術的負債・注意

- visual ID が形を表していない（OD-D）。コードのコメントにも明記した。
- `docs/design/TETO_COOKING-PREP_PHASE1_SPEC_2026-10-28.md` の §18.3 の色の表は、旧いリボンの値のままである。spec の改訂は炒めの担当範囲として、本 PR では触れていない。
