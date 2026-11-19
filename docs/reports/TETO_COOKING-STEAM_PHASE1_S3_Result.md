# Cooking Steam Phase 1 — S3 Result（UI・描画・HV 入口、Issue #726）

状態: **S3 実装済み・ローカル検証済み。** `STEAM_EXPERIENCE_PRODUCTION = false`（本番は常に OFF）。Preview/DEV の `?cookSteam=on` / `?cookSteamHv=1` でのみ操作できる。merge・共有 Preview 更新・Production ON は未承認。
設計: `TETO_COOKING-STEAM_PHASE1_S3_Design.md`（Owner 承認 2026-11-03）。基準 main `49e2add`。ブランチ `claude/cooking-steam-s3-ui`（commit: 設計 → S3a → S3b → 不具合修正 → 本 Result）。

## 1. 変更
| 区分 | ファイル | 内容 |
|---|---|---|
| **S3a**（新規のみ・HOT に触れない） | `src/components/SteamLayer.tsx`、`Steam.css`、`SteamLayer.test.tsx` | ピル／蒸し済み印／蒸し画面。鍋・殻 5 枚（閉→開）・ふた・蒸気は**自前の inline SVG + CSS**（`IngredientGlyph.tsx` 不変）。案 A（ふた）・案 B（ゆすり＋タップ代替＋矢印キー）、`both` では画面内で切替（蒸し中は固定） |
| | `src/logic/steam/steamPillPlacement.ts` / `steamScreen.ts`（+test） | ピル位置（炙りの実機教訓を踏まえ、生地の円との距離を実測して帯／右下の隅を選ぶ。**複製**で独立）、画面の語・時間・ライブ表示（純関数） |
| **S3b**（HOT は追加のみ） | `PizzaStage.tsx`（+15 −2）、`GameScreen.tsx`（+22）、`App.tsx`（+3）、`main.tsx`（+3） | `steamedLook` / `steamOverlay` スロット、`onSteamIngredient` の配線、HV 入口の起動 |
| | `src/preview/cookSteamHv.ts` / `CookSteamHvStarter.tsx`（+test） | **Preview/DEV 限定の HV 入口 `?cookSteamHv=1`**: 使い捨てのメモリ保存（実機のセーブは読み書きしない）、あさり・ムール貝を所持・在庫あり、あさり選択済みで TOPPING から開始。他の HV 入口がある場合は譲る（`<html>` の印で判定、コードは共有しない） |
| | `src/preview/steamPreview.ts`（+`forceSteamOptInForHv`、各 reader を静的ガードのインラインに） | 本番ビルドに opt-in 名が残らないように |
| | `e2e/cooking-steam.spec.ts`、`PizzaStage.SteamLook.test.tsx`、`steam.gate.test.ts`、`steam.architecture.test.ts`（OWN を拡張） | E2E 9 本×2 viewport、実ビルドのゲート、合成の検証、独立性 |

合計 19 ファイル（+2,286 −14）。**変更していない:** 炙り・炒めのファイル、`IngredientGlyph.tsx`、`ingredients.ts`、`App.css`、`handPick.ts`、保存・採点・Dex・ladder・privacy gate。本番フラグは `false` のまま。

## 2. 検証
| 区分 | 結果 |
|---|---|
| `tsc -b` | エラーなし |
| oxlint（変更・新規ファイル） | 新規の警告 0（既存の `CheesePoolCanvas.tsx` / `GameScreen.tsx:557` の警告は従来から） |
| **全 Vitest（最終版）** | **610 files passed / 1 skipped、11,318 tests passed / 13 skipped / 2 todo、失敗 0** |
| `npm run build` | 成功 |
| **実ビルドのゲート**（`steam.gate.test.ts`） | 本番バンドルに `cookSteam` / `cookSteamVariant` / `cookSteamMs` / `teto:cookSteam` / `cookSteamHv` / HV の印が**無い**（蒸し本体は入っている）。Preview バンドルには全部ある |
| Chromium E2E（390×844・360×800） | 蒸し `cooking-steam.spec.ts` **18 / 18**、炙り `cooking-sear*` ＋ `dynamic-cooking-steps` ＋ `viewport-1screen` **71 passed（11 skipped は既存）**、炒め `cooking-prep` **50 passed（既存の skip 除く）**。失敗 0 |
| WebKit | ローカル不可（CI で確認）。**実機 iPhone Safari は未実施（Owner の HV が必要）** |
| 1 回目の全 Vitest | `App.lk8Backstop.test.tsx` が 5 秒タイムアウトで 1 件失敗（全体を並列実行中、実ビルド 2 本と同時）。単独実行は 3/3 pass、最終版の全 Vitest は 0 失敗。負荷起因と判断（既存の実ビルド系ゲートテストと同じ性質。CI で再発するなら記録して対応） |

### 検証した 3 点（Owner 指定）
1. **焼成 filter と蒸し filter の共存** — ラッパー（`.ingredient-piece-visual__emoji`）の**インライン焼成 filter は蒸しの有無で不変**（`PizzaStage.SteamLook.test.tsx`）、蒸し filter は内側 `.ingredient-glyph` の computed style にある。E2E は焼成中に「ラッパー inline = `brightness(…) saturate(…) sepia(…)`」と「glyph = `brightness(…)`」が**同時に成立**することを確認。`Steam.css` がラッパーに `filter` / `transform` を当てないことも CSS を読むテストで固定。
2. **炙りピルとの位置・操作の回帰** — あさり／ムール貝は蒸しピル、ソーセージは炙りピル（本番 ON）で互いに出ない（E2E）。蒸しピルは帯でも隅でも生地の円に重ならない（実測、両 viewport）。炙りの既存 E2E（71 件）は無修正で通る。
3. **`steamOverlay` スロット** — `{searOverlay}` の直後に描画（コンポーネントテスト）。フラグ OFF では DOM は従来どおり（`PizzaStage` のテスト）。

### 390×844 / 360×800 の表示・スクロール・重なり・タップ（E2E で実測）
全コントロールがステージ内、主ボタン高さ ≥ 56px、× は 44×44px 以上、タイトルの文字領域と × は重ならない、ページ横スクロールなし、ゆすり操作でページは動かない（`scrollX/Y` 不変）、タップ代替だけで完了できる、殻が開く間どの殻も鍋の外へ出ない（40ms 間隔で 3 秒サンプリング）。

## 3. HV 証跡
| 区分 | 内容 |
|---|---|
| 動画（repo に commit しない・Owner へ直接提出） | `cooking-steam-phase1-hv-390.mp4`（H.264、390×844、約 41 秒、Authority）と `…-360.mp4`（360×800、約 41 秒、Secondary）。指のリングと画面下の説明ラベル付き。入口 → あさり 3 個 → **案 A（ふた）**→ ムール貝 2 個 → 画面内切替 → **案 B（ゆすり: ドラッグ → 止めて蒸気が弱まる → ボタンのタップ → 確定）**→ 焼成。ffprobe: h264 / 390×844 / 41.5s、h264 / 360×800 / 41.1s |
| 画像（commit 済み） | `docs/reports/screenshots/cooking-steam-phase1/`（`INDEX.md` に一覧）。before（蒸しなし）／after（ピル・案 A・案 B・切替・ムール貝・焼成・RESULT、両 viewport）／ピースの比較シート（蒸さない・ちょっと・ぱっくり・くたっと、3×、ピザ上と焼成中） |
| 撮影環境 | Playwright Chromium（実ポインター入力）。**WebKit・実機 Safari では未撮影** |

### HV 録画で見つかった不具合（修正済み）
最初の録画で、殻が開く瞬間に**殻が一瞬だけ画面左上へ飛ぶ**ちらつきを発見。原因は、殻の位置を SVG の `transform` 属性（`translate`）で持つ `<g>` に、開閉の pop アニメーション（CSS の `transform`）を直接当てたため、位置が上書きされていたこと。アニメーションを内側の `<g>` に移して修正。**E2E は最初これを検出できなかった**ので、殻の箱が鍋の外に出ていないかを 40ms 間隔でサンプリングするテストと、CSS／DOM の構造テストを追加し、**旧 CSS に戻すと E2E が落ちる（はみ出し 36px）ことを確認**した上で修正版で通した。

## 4. 案 A / 案 B — 実装して見えた利点・問題点（見込みを含む。実機未確認）
| | 案 A（ふたをタップ） | 案 B（鍋を左右にゆする） |
|---|---|---|
| 操作 | 「ふたをする」→ 蒸気が溜まり殻が順に開く → 「ふたを開ける」 | 鍋の上を左右になぞる（または「ゆする」ボタンをタップ）→ 止めると蒸気が弱まる → 「ふたを開ける」 |
| 利点 | 最も簡単。片手・疲れない・誤爆が少ない。ふたが降りる／上がる絵で意味が伝わる。結果が時間だけで決まり**予測できる**。殻が開く「出来事」が読みやすい | 能動的で、**炒め（タップ判定）・炙り（長押し）と手触りが違う**（H3 が最大の論点）。止めると弱まるので手が止まると進まず、見て調整する余地がある。タップ代替・矢印キーあり |
| 問題点 | 待つだけで、**炒めの「時機を押す」に近い**と感じられる恐れ（H3）。ガラスのふたが殻に少し被る | **疲労**（全殻に約 12 往復、約 6〜8 秒の想定）と iOS での**誤爆**（スクロール・長押しメニュー）は実機でしか分からない。ボタン 2 つで画面がやや忙しい。ドラッグの精度に依存（幅の 18% 以上の往復で 1 ストローク） |
| ローカルで確認できたこと | E2E 通過。2.6 秒で 2〜3 枚、4.5 秒で全開、約 7.5 秒保持で「くたっと」 | E2E 通過（14 往復で 2 枚以上が開く、止めて 5 秒で減る、**タップだけ 8 回で全開**、ページはスクロールしない） |
| 実機で見るべきこと | H1・H3・H4・H5・H9 | H1・H3・H4・H5・**H6（疲労）・H7（誤爆）**・H8（タップ代替） |

比較用 URL: `?cookSteamHv=1`（both、画面内切替）／`&cookSteamVariant=lid|shake`／`&cookSteamMs=3000|4500|6000`（A の全開時間）。

### ピース自体の見た目（CSS のみ・Owner 決定）
蒸した後のあさりは **ほんの少し明るく・クリーム寄り**、くたっとは**灰色寄り**になる（比較シート参照）。ただし**ピザ上の 1 個は約 24px で差は控えめ**で、殻が「開く」表現はピース側では出ない（開閉は蒸し画面だけ。SVG 変更は Owner 決定で対象外）。「蒸した／蒸さない」の区別が足りるかは H11 として実機で判断してほしい。

## 5. 未実施・残課題
1. **実機 iPhone Safari での HV**（Owner）— 特に B のドラッグ（スクロール／メニュー）と疲労、ピル位置。
2. **WebKit CI**（PR 作成後に確認）。`handPick.ts` の check-then-act 競合（#394 に記録済み）で 360×800 が間欠失敗しうる。修正は別対応（本 PR に含めない）。
3. 全 Vitest を並列実行すると `App.lk8Backstop` が 5 秒枠で落ちうる（上記）。
4. **共有 Preview の更新は未承認**（行っていない）。
5. 蒸す Production ON は HOLD。S4（Owner の HV 判断・採否）は別途。
6. 殻の開き（開閉）をピース側にも出すか、ピースの差をもう少し強めるか — HV 後の判断。

## 7. 追補: ghost click 修正（タッチでピルを開くと案 A が即 steaming になる不具合）

**発見:** 提出用の A/B 比較（タッチ入力）で判明。マウスの E2E・動画では出ない種類の不具合。

**原因（イベント順序をページ読み込み時から記録して特定）:** `pointerdown`(ピル) → `touchstart` → `pointerup`(ピル。React がここで蒸し画面を**同期的に開き**ピルが消える) → 約 30ms 後にブラウザが同じタッチの互換イベント `mousedown` → `mouseup` → `click`（`detail=1`、**新しい `pointerdown` を伴わない**）を、**今その指の下にある要素**＝蒸し画面の大きな下ボタンへ送る。案 A の「ふたをする」は `click` で受けるため、**画面が開いた瞬間にふたが閉まり蒸し始める**。案 B は click が 2 つのボタンの隙間に落ち無害（レイアウト次第の偶然）。炙りは長押しを `pointerdown` で受けるので影響なし。

**採用した対策（最小・同じ入力由来の click だけを 1 回抑止）:** `src/components/steamGhostClick.ts`。ピルを pointer で開いた時だけ武装し、(1) **新しい `pointerdown` が来たら解除**（意図的な 2 回目のタップは必ず自分の `pointerdown` から始まる）、(2) `detail === 0`（キーボードの Enter / Space）の click は素通しで武装を消費しない、(3) click が来なければ 600ms で解除、(4) アンマウントで解除。**開いた直後に一律の無効時間（450ms 等）は設けない**。キーボードでピルを開いた場合は武装しない。

**検証:**
| 区分 | 結果 |
|---|---|
| 再現（修正前） | 390×844 / 360×800、タッチ: 案 A = 開いた直後 `steaming`、案 B = `idle`（click は `controls` の隙間） |
| 修正後 | 案 A・B とも開いた直後は `idle`。**120ms 後の次の明示的なタップで即 `steaming`**（390×844・360×800・短い画面 390×664 / 360×640 の計 8 パターン、E2E） |
| 検出力の確認 | 修正を外すと、新しい単体テスト 3 件と E2E（案 A）が、イベント順序つきのメッセージで落ちる |
| 単体 | `steamGhostClick.test.ts`（7）＋ `SteamLayer.test.tsx` の 6（案 A・B・キーボード開始・指が外れた場合・アンマウント）。素早い 2 回目のタップ（60ms 後）が効くことも固定 |
| 追加 E2E（タッチ） | 6 本 × 2 viewport = 12 件（`hasTouch`）。CDP のタッチ入力で、鍋のドラッグでページがスクロールしない・文字選択なし・長押しで画面が保たれることも確認（Chromium のみ） |
| 全 Vitest | **611 files / 11,331 tests passed、失敗 0**（13 skipped・2 todo は既存） |
| tsc / oxlint / build | エラー・新規警告なし／成功 |
| 関連 E2E（Chromium 両 viewport） | 蒸し・炙り関連 **66 passed**、`dynamic-cooking-steps`・`viewport-1screen`・炒め **85 passed**、失敗 0（skip は既存） |

注意: WebKit では Playwright のタッチ入力が Chromium と同じ互換イベントを出すとは限らない（CI で確認）。実機 iPhone Safari での確認は Owner の HV。

## 6. 禁止事項の遵守
`STEAM_EXPERIENCE_PRODUCTION = false` 維持／共有 Preview・Production 設定は未変更／炙り・炒め・`IngredientGlyph.tsx` 未変更／保存・採点・Dex・ladder・privacy gate 未変更／`handPick.ts` 未変更／CI の再実行・Monitor なし／merge しない。
