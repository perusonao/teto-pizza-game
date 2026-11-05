# Ingredient Icons 2.0 — #733（牛肉・ピーマン）/ #739（梅肉・しらす）調査とデザイン比較 Result Report

Status: **調査とデザイン比較のみ（docs と画像）。** `src`・CSS・テスト・保存・レシピ・採点は変えていない。共有 Preview と Production は更新していない。merge はしない。
Base: `main` `d85b957`（2026-11-05）。Branch: `claude/teto-pizza-ingredient-icons-q7c1je`。Parent: #417。Steam V2 #757 と並行して進めた（#757 のファイルには触れていない）。

## 0. 先に結論

| 食材 | 状態（main） | 推奨 | 理由 |
|---|---|---|---|
| 牛肉 `beef`（#733） | `beef-slices`（赤茶の帯＋白い脂の線、仮採用のまま） | **B 角切り＋断面**（次点: C 細切り＋焼き目） | 帯＋白線はベーコン 🥓 と同じ語彙。形を変えるのが一番効く。B は 20〜26px でもベーコン（帯）・サラミ／ペパロニ（円）・ソーセージ類（輪切り）と形で分かれる |
| ピーマン `green-pepper`（#733） | `green-pepper-strips`（GP-A2、緑の弧 3 本。2026-11-01 の iPhone HV は合格） | **R1 輪切り×2** | 弧 3 本はさやいんげん・オクラ・ズッキーニに近い。4 つのふくらみがある輪切りは「ピザのピーマン」の定番の形。青ねぎ（小さい丸 3 つ）とは大きさと形で分かれる |
| 梅肉 `umeboshi-paste`（#739） | `umeboshi-paste-dab`（#740 で導入、ペースト＋梅の花） | **現行のまま。** iPhone で花が小さい場合だけ U2（花を拡大） | 「桃に見える」問題は #740 で解決済み。U3（梅干しの実）はチェリートマトやトマトに近くなるので推奨しない |
| しらす `whitebait`（#739） | `whitebait-school`（#740 案 D: 1.5 倍・濃い輪郭・1.35em） | **現行のまま。** iPhone HV の後に判断 | 案 D で、トレイ・生地・梅肉ソース・トマトソース・焼成後のどこでも魚と読める。W2 / W3 の改善は小さい |

**#739 の主な指摘（梅肉 🍑・しらすの小ささ）は PR #740（main `d927878`）で実装済み。** 残るのは iPhone Safari 実機での確認と、大葉の扱い（§6 の OD-5）。今回の新しい提案は #733 の 2 食材が中心。

## 1. 確認したもの

- `CLAUDE.md`、`docs/PROJECT_HANDOFF.md`（Ingredient Icon 2.0 節、startup checklist）、`TETO_HUMAN-VERIFICATION-POLICY.md`、`TETO_SESSION-OPERATIONS_1.0.md`（§1 claim、§8）
- `TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md`（§2 共通仕様、§3 サイズ補正、§6 テスト、§11 Pilot E と GP-A2 の確定）、`TETO_INGREDIENT-ICON-2.0_PILOT-E_IMPLEMENTATION-PLAN.md`
- Issue #733 / #739 / #417（とコメント）、PR #740 と `docs/reports/TETO_ISSUE-739_ICONS_Result.md`
- open PR 30 件の変更ファイル（§5）、有効な claim（§5）
- `src/components/IngredientGlyph.tsx`（`BeefSlices` / `GreenPepperStrips` / `UmeboshiPasteDab` / `WhitebaitSchool`）、`src/App.css` の個別サイズ規則、`src/data/ingredients.ts`（読むだけ）、`src/data/toppingSizeClass.ts`、`IngredientGlyph.test.tsx`

## 2. 現在の描画（トレイと生地の上）

撮影: 既存の `e2e/b15.spec.ts`（nigerian-suya-pizza: 牛肉 3・ピーマン 1・たまねぎ 2）と `e2e/b16.spec.ts`（ume-shiso-pizza: 梅肉ソース、しらす 4・大葉 2）を Chromium の 390×844 / 360×800 で実行した。どちらも main で 8/8 passed。

| 食材 | トレイ chip（26px の箱） | 生地の上 | 焼成後（RESULT） |
|---|---|---|---|
| 牛肉 | 赤茶の帯 2 本に白い線。**ラム・豚肉など他の肉の chip と並ぶと、ベーコン 🥓 に近い** | 帯 2 本（1.2em、size class `m`） | 焼成フィルタで暗くなり、帯は「ベーコンかハム」に見える |
| ピーマン | 緑の弧 3 本（1.45em） | 3 本の束。**さやいんげん・オクラ・ズッキーニに見える**（#733 の指摘を再現した） | 黄緑に濁り、束のまま |
| 梅肉 | ペーストに梅の花（1.5em）。26px で花はぎりぎり見える | ソースの塗り色 `#b8405a`（canvas。アイコンではない） | — |
| しらす | 白い魚 3 匹に濃い輪郭（1.35em） | 梅肉ソースの上でも輪郭で魚と分かる（#740 の効果） | 輪郭で読める |

## 3. 判別しにくさの整理

| 食材 | 似ている相手 | 原因 | 分け方 |
|---|---|---|---|
| 牛肉 | ベーコン 🥓、ハム 🍖、（焼成後は）ヴルステル | 「赤茶の帯＋白い脂の線」がベーコンの絵文字と同じ語彙。形も色も近い | **形を変える**（角切り）か、**脂の線をやめて焼き目にする**（色と模様） |
| 牛肉（参考） | サラミ 🟤・ペパロニ 🔴 | 形（円）が違うので現行は区別できる。**丸い案（A）にすると近づく** | 丸い形を避ける |
| ピーマン | さやいんげん、オクラ、ズッキーニ 🥒、ピクルス | 緑の細長い弧は「さや」の形。ピーマンだと分かる手がかりがない | **輪切り**（ふくらみのある輪、中が空いている） |
| ピーマン（輪切りの場合） | 青ねぎ（`green-onion-slices`、小さい丸 3 つ） | どちらも緑の輪 | 大きさ（輪切りは 1 枚が大きい）・ふくらみの角・濃い緑で分かれる。グレースケールでも形で分かれる（シート参照） |
| 梅肉 | 桃 🍑（解決済み）、トマトソース 🍅、豆板醤 | ピンクと赤の色が近い | 梅の花が唯一の手がかり。20px で花が潰れないかが残る |
| しらす | フェタ・にんにく・モッツァレラ（白い食材） | 白い色 | 魚の形と黒い目で分かれる。#740 で解決済み |

## 4. 改善案の比較

比較シート（20 / 24 / 32 / 48px、chip の白・生地・焼成後・焼成フィルタ近似・グレースケール、隣の食材との並び）:
`docs/reports/screenshots/ingredient-icons-733-739/sheet-{beef,green-pepper,umeboshi,whitebait}.png`
候補 SVG: `docs/design/candidates/ingredient-icons-2.0-733-739/svg/`（README あり）

### 4.1 牛肉（3 案）

| 案 | 見え方（実画面の仮合成） | ベーコン・ハムとの差 | 他の肉との差 | 評価 |
|---|---|---|---|---|
| 現行 | 赤茶の帯 | ✕ 近い | ○ | 基準 |
| A 霜降りの薄切り | 丸い赤い塊に白い網目 | ○ | **✕ サラミ・ペパロニ・ハンバーグに近い**（丸い）。網目は 26px 以下で潰れる | 不採用推奨 |
| **B 角切り＋断面** | 焼けた角切り 3 個と赤い断面 | **◎ 形が別** | ◎（円とも帯とも違う）。グレースケールでも角で分かれる | **推奨。** 20px では 3 個がやや細かいが、系統（肉）は読める（Style Lock §2 の 20px 基準を満たす）。ルンダン（煮込みの角切り）にも合う |
| C 細切り＋焼き目 | 茶色の帯に網目と黒こしょう | ○ 色と模様で分かれる | △ 帯の形は残る | 次点。現行に近いので変化は小さい。スヤ（薄切りの串焼き）に近い |

### 4.2 ピーマン（3 案：現行を含む）

| 案 | 見え方 | さや・ズッキーニとの差 | 青ねぎとの差 | 評価 |
|---|---|---|---|---|
| 現行 GP-A2 | 緑の弧 3 本 | ✕ | ◎ | 基準。Owner の iPhone HV（2026-11-01）は合格済み |
| **R1 輪切り×2** | 輪切り 2 枚が重なる | **◎** | ○ 大きさと角のあるふくらみで分かれる | **推奨。** 焼成後も輪の形が残る。中が空いているので生地が見え、ピザの上で自然 |
| R2 輪切り＋細切り | 輪切り 1 枚と細切り 1 本 | ○ | ○ | 輪が大きく見えて読みやすいが、細切りが残るので「さや」の印象が少し戻る |

### 4.3 梅肉（3 案：現行を含む）

| 案 | 26px の chip | 評価 |
|---|---|---|
| **現行（#740）** | ペーストと花は読める。花は小さめ | **推奨（現行のまま）** |
| U2 梅の花を拡大 | 花がはっきりする。ペーストの面積は減る | iPhone で花が読めなかったときの予備案 |
| U3 梅干し一粒＋ペースト | 「赤い丸い実」になり、**チェリートマト・トマト・りんごに近い** | 不採用推奨 |

### 4.4 しらす（3 案：現行を含む）

| 案 | 評価 |
|---|---|
| **現行（#740 案 D）** | 全背景で魚と読める。**推奨（現行のまま）** |
| W2 背の線を濃く | 差は小さい。トマトソースの上で背の線が少し目立つ |
| W3 4 匹 | 群れらしさは増えるが、1 匹が小さくなる。生地の上では読みやすさが下がる |

## 5. 変更対象ファイルと競合リスク（推奨案を実装する場合の想定。今回は変更していない）

**ポイント: 牛肉・ピーマンはどちらも既に専用 visual（`beef-slices` / `green-pepper-strips`）を持っている。絵だけを差し替え、visual 名を変えなければ `ingredients.ts` には触れない。** そのため Batch 18（#748）の claim とは重ならない。

| ファイル | 変更（想定） | 競合 |
|---|---|---|
| `src/components/IngredientGlyph.tsx` | `BeefSlices()` と `GreenPepperStrips()` の中身（`<g>` 内）だけを差し替える。コメントを更新する | open PR で触れているものはない。#748（Batch 18、PR 未作成）は新しい visual を末尾に足す可能性がある → **関数の中身だけの変更なので、末尾への追加とは衝突しにくい（低）** |
| `src/components/IngredientGlyph.test.tsx` | 必要なら識別テスト（「肉の隣と markup が違う」）に bacon などを追加する。既存のテストは構造（viewBox・`aria-hidden`・`id`/`url(#` なし）だけを見ているので、絵の差し替えでは壊れない | 低 |
| `src/App.css`（**HOT**） | **原則として変更しない。** 候補は現行と同じ 64 箱・同じ補正（牛肉 1.2em / ピーマン 1.45em）で作った。HV で大きさの調整が要る場合だけ、独立ブロックを 1 つ追記する | #468（HOLD）が `.pizza-cheese--mozzarella` に触れている（別の規則） |
| `docs/design/references/ingredient-icons-2.0/green-pepper.svg`（＋新規 `beef.svg`） | 採用案に昇格する | **#753 が同じディレクトリの `README.md` を変更中** → README の更新は #753 の merge 後に行う |
| `docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md` | 採用の記録（§11 の GP-A2 の更新、beef の追記） | **#753 が変更中（§12 eggplant）** → #753 の merge 後に、docs-only で別に行う（§11.8 / SL-8） |
| `e2e/pilot-e-ingredient-icons.spec.ts` | 変更不要（セレクタは `svg.ingredient-glyph--green-pepper-strips`。visual 名を変えなければ通る） | — |
| `src/data/ingredients.ts`、`lateCatalog.offSurface.json`（golden） | **変更しない**（visual 名を変えない場合） | visual 名を `green-pepper-rings` に変える場合は両方に触れる → #748 の claim（2026-11-18 まで）と衝突。golden の再生成も要る |

**触れない（今回も実装時も）:** `ingredients.ts`（#748 claim）、`recipes.ts`・`discoveryLadder.ts` ほか #748 の claim ファイル、#757 / #756 のファイル（`src/preview/steamGameLab*`、`src/logic/steam/**`、`src/main.tsx`、`e2e/steam-game-lab*.spec.ts`）、#738 の `PizzaStage.tsx`、#749 の fry 関連、保存・採点・レシピ・Research。

有効な claim（2026-11-05 時点）: #748（`session_013m8Cb66Bu5f1XXHC2xCiLL`、`ingredients.ts` ほか、期限 11-18）、#749（fry 関連、期限 11-18）。#417 / #733 / #739 に claim はない。今回は調査のみなので claim は投稿していない。実装に進む場合の claim 案:

```
<!-- teto-claim:v1 {"session":"<実装セッション>","issue":733,"pr":null,"branch":"<実装ブランチ>",
  "files":["src/components/IngredientGlyph.tsx","src/components/IngredientGlyph.test.tsx","docs/design/references/ingredient-icons-2.0/beef.svg","docs/design/references/ingredient-icons-2.0/green-pepper.svg","docs/reports/TETO_ISSUE-733_*","docs/reports/screenshots/issue-733-icons/**"],
  "dependsOn":[],"expires":"<+72h>"} -->
```

## 6. Owner 判断（まとめて）

| # | 判断 | 推奨 |
|---|---|---|
| OD-1 | 牛肉の案 | **B 角切り＋断面**（次点 C） |
| OD-2 | ピーマンを、iPhone HV に合格済みの GP-A2 から R1 輪切りに変えるか | **R1 に変える**（#733 の「さやいんげん・オクラに見える」が Chromium で再現した）。Style Lock §11 で確定した GP-A2 の変更なので、Owner の明示承認が必要 |
| OD-3 | R1 を採用する場合、visual 名 `green-pepper-strips` を残すか | **残す**（`ingredients.ts`・golden・e2e に触れず、#748 と衝突しない）。名前を `-rings` に直したい場合は #748 の merge 後に別 PR |
| OD-4 | 梅肉・しらす | **現行（#740）のまま。** 次の iPhone Safari 実機 HV で花の読みやすさ（梅肉）と輪郭の強さ（しらす）を確認し、梅肉で花が読めなければ U2 |
| OD-5 | 大葉（生地の上で約 23px、#739 の関連観察） | 本件の範囲外。必要なら別 Issue（1.2em → 1.35em の補正は `App.css` の HOT ブロックに触れる） |
| OD-6 | #417 Phase 2（Discrimination Test）に beef / green-pepper を加えるか | **加える**（牛肉↔ベーコン・ハム、ピーマン↔青ねぎ・ズッキーニ・ハラペーニョ） |
| OD-7 | 実装の着手時期 | #757 と並行して可能（ファイルが重ならない）。Style Lock と references の README の更新は #753 の merge 後 |

## 7. 検証

| 項目 | 結果 |
|---|---|
| main の B15 / B16 E2E（Chromium 390×844 / 360×800、撮影用） | 8/8 passed |
| 仮合成の撮影（同じ spec の一時コピーで、DOM 内の SVG の中身だけを差し替えて撮影。一時ファイルは削除済み。コミットしていない） | 8/8 passed |
| 候補 SVG の規約（`id` / gradient / `<defs>` / `url(#` なし、viewBox 64） | 13 ファイルとも適合 |
| `src` の差分 | なし（`git diff --stat origin/main -- src e2e` は空） |
| WebKit / iPhone Safari 実機 | **未実施**（Chromium のみ。Apple の絵文字は Noto と違うので、隣の絵文字の見え方は実機で変わる） |

## 8. Human Verification（HV Policy との関係）

今回は調査とデザイン比較だけで、見た目が変わる実装はない（HV Policy §2 の「原則不要」、HANDOFF の「Audit-only tasks are exempt」）。**動画は作っていない。** スクリーンショット（before = 現行 main、after = 候補の仮合成）は次の場所にコミットした。

`docs/reports/screenshots/ingredient-icons-733-739/`

| ファイル | 内容 |
|---|---|
| `01-suya-topped-{390x844,360x800}.png` | 牛肉・ピーマン、生地の上（現行・A・B・C・R1・R2） |
| `02-suya-baked-result-*.png` | 同じく焼成後（NEW PIZZA） |
| `03-ume-topped-whitebait-*.png` | しらす、梅肉ソースの上（現行・W2・W3） |
| `04-ume-tray-beef-chip-*.png` | トレイ chip（牛肉 A/B/C と、しらす・大葉・青ねぎ・ラム） |
| `05-ume-tray-sauce-*.png` | 梅肉のソーストレイ chip（現行・U2・U3） |
| `06-umeboshi-shop-*.png` | ショップ NEW の梅肉 |
| `07-ume-baked-result-*.png` | しらす、焼成後 |
| `sheet-{beef,green-pepper,umeboshi,whitebait}.png` | サイズ・背景・グレースケール・隣の食材との比較シート |

実装に進む場合は、HV Policy に従って 390×844 の動画（Owner へ直接、リポジトリには入れない）と、実装ビルドの before / after を撮る。
