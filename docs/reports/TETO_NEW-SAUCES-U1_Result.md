# New Sauces Phase B U1 — 柚子えびピザ + 柚子胡椒（late catalog 方式）Result Report

Issue #578（claim 投稿済み）。ブランチ `claude/u1-yuzu-shrimp-late`、基準 `main` `578a61b`。**未 merge・共有 Preview 未更新・本番変更なし。** merge は late catalog が本番 ON のため**即公開**になる。Owner の iPhone HV と最終承認までは merge しない。
Authority: Owner 承認（2026-10-25）「監査の構成 A」。U2（田楽）・U3（タヒニ）・Pinsa（#659 を含む）には触れていない。

## 1. 何を出したか

| 項目 | 値 |
|---|---|
| レシピ | `yuzu-shrimp-pizza`（柚子えびピザ）、late catalog、第 4 章、図鑑 No.30（第 4 章 30/30） |
| 構成（**暫定**、原典未確定） | 柚子胡椒 1（焼成前 PAINT）/ モッツァレラ 2（通常 CHEESE）/ エビ 3（焼成前・事前加熱なし）/ 大葉 1（**焼成後 FINISH、POST_BAKE**） |
| 焼成窓・CUT | 58–78（Free Cooking の汎用窓と同じ）/ CUT なし |
| 新素材 | `yuzu-kosho`（柚子胡椒）: late 専用のソース（`category: "sauce"`, `placement: "spread"`）、色 `#b5c56a`（暫定）、emoji は トレイ／ショップのチップ用の代替のみ（G18 の分類記号と衝突しない 🍃）。topping family・size class なし |
| ladder | late step（roe step の次）。番号は**導出**（通常 step 数 + 2、現在 58）で、固定値は埋め込んでいない。星ゲートなし、credited あり（検証上 `ladderCredit:false` は late 専用材料を持てないため必然）、key-free ヒント、`lunchRush:false` |
| 価格・補充 | T4 規則（初回 120 Pitz = 10 回分、補充 60） |
| 互換下限 | `LATE_ENTITLEMENT_FLOORS` に `yuzu-kosho: 58` を追加、`salmon-roe: 57` は維持（#660 / OD-U0-7c） |
| 表への追加 | `lateCatalog.ts`（レシピ・注文・探索ターゲット・材料・ladder step）、`recipeSauceProfiles`（union + PAINT 行）、`recipeHintRoles`（key-free）、`referencePizza`（6 ピース: モッツァレラ 2 / エビ 3 / 大葉 1 のリング配置） |
| 触れていないもの | 採点・経済・保存形式（schema v2）・エンジン（reducer / FINISH / ladder 純粋層）・DH4 gate の assertion・golden の既存行・`PINSA_PRODUCTION` |

**エンジンのコード変更はない**（データ表の追記、テストの pin 更新、テスト支援の許可リスト 1 件）。

## 2. 暫定値（原典に記録なし。PR 本文にも明記）

- **原典**（Owner 中継、独立再取得なし）: 薄めの生地、エビ（殻と背わたを除去）・柚子胡椒（少量ずつ使用）・モッツァレラ・大葉、ソース欄 Other、大葉は仕上げの追加を推奨。
- **原典で未確定**（ゲーム独自の暫定仕様で補完）: 柚子胡椒の塗布方法・投入タイミング（→ 焼成前 PAINT と仮定）、エビの事前加熱・投入タイミング（→ 焼成前・事前加熱なしと仮定、殻・背わた除去は非モデル化）。
- **GAMEPLAY CALIBRATION**: 個数（柚子胡椒 1 / モッツァレラ 2 / エビ 3 / 大葉 1）、焼成窓 58–78、柚子胡椒の色 `#b5c56a`（実機 HV で確定。赤はトマトと同色で不可）、モッツァレラは標準チーズ層。
- 説明文は時機を名指ししない（図鑑未発見の状態で表示されるため、Anti-Oracle）。

## 3. 既存セーブ・Dex・Research・ladder への影響（検証済みの範囲）

| 観点 | 結果 |
|---|---|
| 既存セーブの解禁 | 台帳は縮まない。`yuzu-kosho` と `salmon-roe` に互換下限（58 / 57）。E5 後に未起動で count ≥ 58 のセーブも、通常 step が増えた後でも両方を得る（`materialEntitlement.lateFloor.test.ts`、E2E で起動経路を確認） |
| Dex / 保存 | Dex 項目・未知 ID は保持（既存 forward-compat テスト通過）。schema v2 のまま |
| 図鑑の章 | 第 4 章は 29→30（導出表示）。章クリアの印は後退しない（late recipe は印に不要。`recipeChapters.test.ts` K2） |
| Research | 柚子えびのコホートは単独（文字なし）。既存レシピの文字は動かない（`lateCatalog.yuzu.test.ts` で全体の文字写像を前後比較） |
| ladder / ★ | 1–56 凍結、roe の step 番号は不変（57）。クレジット対象 60→61。★2 の到達性は 61/61（spinach の ★130 ゲートを超える。ゲート値は不変、★1 では従来どおり california / spinach が閉じる） |
| ヒント | 永久 key-free。Hint 5.0 golden は**追記のみ**（`hint5.ladders55.json` +203 / −0、`hint5.alphaFamilyOnly.json` +1 キー） |
| 在庫・経済 | T4 規則。Pitz・採点は不変 |
| Lunch Rush / Dinner | FINISH 除外のため対象外（`lunchRush:false`） |

## 4. DH4 / privacy（gate は緩和していない）

- 実データ構造での事前測定: `deductionProduction.gate` privacy 系 13 件・`deductionGuard.gate` 16 件通過（件数 pin 123 のまま）。本 PR 後のフル実行でも通過。
- **許可リストへの追記（Owner 承認済み、privacy assertion は不変）**: 技法要求レシピの許可リスト（`TECHNIQUE_REQUIRING_RECIPE_IDS`、DH4 / Hint 5.0 の 2 gate が共有）に、明示 id `yuzu-shrimp-pizza` を `src/logic/testSupport/techniqueAllowlists.ts` の `LATE_ADDITION_RECIPE_IDS` として追加。**データから自動導出せず明示**にしたので、次の late recipe は許可リストへの追記と再実行なしでは gate が落ちる。検査テストを追加（`techniqueAllowlists.test.ts`）。
- DH4 監査 JSON（`TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json`）の変更は 1 行（sauce カテゴリの候補数 5→6）のみ。

## 5. pin の更新（assertion は弱めていない）

件数・exact-set の期待値を実データに合わせて更新した: `catalogLedger`（recipes 66 / credited 61 / ingredients 71 / ladder 58 / chapter 4 = 30）、sauce 5→6（shelf・fixtures）、`lateCatalog.*` / `pinsaGate` / `e5.ikuraProduction`（late の recipe・材料・step を ikura のみ→ikura + yuzu の exact-set、Pinsa は引き続き最後）、`materialShop`（yuzu-kosho の step・T4 行と最終 step）、`ladderReachability.starGate`（★2 baseline が [] へ改善。ratchet の許される方向）、`referencePizza`（sauce 集合）、`hint5Ladder.baseCompat`（key-free 41・sauce + cheese 16）、`lateAxis`、`recipeChapters`、`recipeBatchManifest`（Pinsa の `afterRecipeId` を yuzu に、yuzu 用 manifest を追加）、技法 4 テスト（許可リスト）、`sauceKindFixtures`（`finishedPizza` が POST_BAKE 要件を `stage: "post"` として置くようにした。通常レシピは POST_BAKE を持たないため不変）。

## 6. 検証

| 項目 | 結果 |
|---|---|
| 新規テスト | `lateCatalog.yuzu.test.ts` 16 件（OFF で無痕跡、データ・表・identity の一意性、Shop T4、Research、manifest、**実 reducer の Free Cooking**: NEW_DISCOVERY / 後乗せ記録 / 大葉を焼成前・柚子胡椒なし・後乗せなし・具材欠落は ORIGINAL、**Guided 再プレイ**: PASS・在庫消費・Dex）、`materialEntitlement.lateFloor.test.ts`（roe 4 + yuzu 3 + 既存）、許可リスト 2 件 |
| フル Vitest（ローカル、隔離コピー） | **9684 passed**、4 skipped、4 todo。失敗 2 件はサンドボックス限定: `lcHandPreview.gate`（コピーが git リポジトリでない）と DH4 監査スナップショット（本 PR でスナップショットを更新済み、更新後に通過） |
| 型・lint・build | `tsc -b` 通過、`oxlint` エラーなし（既存 warning のみ）。CI の `build` が最終 |
| E2E（Chromium、390×844、本 PR の新規 spec `e2e/new-sauces-u1.spec.ts`） | 2/2 通過: ① Shop NEW → 購入 → Research（識別漏れなし）→ 柚子胡椒を塗る → CHEESE → エビ → 焼成 → **FINISH で大葉** → NEW DISCOVERY → 図鑑（第 4 章 30/30）、② 未起動セーブが roe と柚子胡椒を起動で得て、Dex を開いても何も書き換えない。360×800 は CI の projects で確認 |
| 注記 | このサンドボックスでは既存の `new-sauces-a.spec.ts` も console の `404` 1 件（外部アセット）で失敗する（環境起因、CI では出ない前提）。HV 動画の撮影ではローカルに限りその 1 件の console メッセージを除外して撮影した |

## 7. Human Verification（`TETO_HUMAN-VERIFICATION-POLICY.md`）

- スクリーンショット（committed）: `docs/reports/screenshots/new-sauces-u1/`（390×844、9 枚: Shop NEW / Research エントリ / トレイ（ソース選択）/ ソース塗布後 / 具材後 / FINISH / FINISH 大葉 / NEW RECIPE / 図鑑）。Before 比較は、レシピ・ソース・章の枠が新規のため存在しない。
- 動画（**repository に commit しない**。セッション内で Owner へ直接提出）:

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `yuzu-u1-390x844.webm` | 390×844 | 35.3 s | 1.4 MB | PASS |

  コーデック VP8（WebM）。Playwright 同梱の ffmpeg は MP4 / H.264 を出力できないため WebM で提出（Policy §5 の例外）。**Video Verification: PASS**（ファイル存在・サイズ > 0・最後まで再生可能・全画面記録・Shop → Research → 塗布 → 具材 → 焼成 → FINISH → 発見 → 図鑑を保持時間つきで収録）。
- **この動画で確認すること**: 柚子胡椒の新しい色（`#b5c56a`）が生地・既存ソース（特にジェノベーゼ）と見分けられるか、塗布後の見た目（焼成前・焼き上がり）、エビの置き方、**大葉を焼成後に置く操作**（FINISH のトレイは 6 個ずつのページ送りで、大葉は後ろのページ）、NEW RECIPE と図鑑の表示。
- **Owner の実機（iPhone Safari）HV は未実施**。色、塗布の見た目、FINISH の操作感、ピースの配置は実機で確定する。

### Preview で HV する手順（共有 Preview の更新は Owner の承認が必要。本セッションは実施していない）
1. Owner が承認のうえ、Preview 用ワークフロー（`Build & deploy a source PR/branch`）で本ブランチを Preview へデプロイ。
2. Preview の `?dev=state` で DEV State Editor を開き、プリセット **Last Step Ready**（最後の ladder step に到達、その材料は Shop に解放済み・未購入、その材料を使うピザだけが未発見）を適用。プリセットはカタログから導出されるため、柚子えびの状態が自動的に作られる。
3. ショップで柚子胡椒を購入 → 図鑑の Research から研究、または Free Cooking。Preview のセーブは使い捨て（本番とは別キー）。

## 8. リスクと注意

1. **merge = 即公開**: late catalog は本番 ON。公開ゲートは新設していない（Owner 指示）。HV 前の merge は禁止。
2. **原典が確定していない**: 柚子胡椒が焼成後にかけるもの、エビを事前加熱する、が後から確認された場合は、構成の再分類（ソース後乗せ／下ごしらえ工程）が必要で、現行の実装は使えない。
3. **色**: `#b5c56a` はジェノベーゼ（緑）に近い可能性。実機で薄塗り・重ね塗りを確認する。
4. **#659（Pinsa 本番化）との重なり**: `src/data/pinsaGate.test.ts` と、late recipe の件数・集合 pin を扱うテストで、触る行が重なり得る。後から入る方が追従する（Pinsa は引き続き最後の late recipe として配置）。
5. late step 番号は通常 batch のたびに +1 される（導出）。互換下限 58 / 57 で既存セーブは保護される。
6. 柚子えびは late のため、Late Catalog を OFF にすると消える（OFF ビルドで痕跡がないことをテスト済み）。

## 9. Owner 判断事項

1. 実機 HV（色・塗布・FINISH の操作・配置）と最終承認。HV 後に merge。
2. Preview へのデプロイ承認（HV 用）。
3. 暫定値（個数・焼成窓・色）の確定、または原典確認後の再設計。
4. #659 と本 PR の merge 順序。
