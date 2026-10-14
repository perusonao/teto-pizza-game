# Cooking Steps 2.0 CS-4a — 工程タブ T3（圧縮チップ）Result

Issue #294 / #465（Cooking Steps 2.0）。base: `main` `f780c4e`（D1b #497）。READ-ONLY 監査（CS-4）の Owner 承認後の最小実装。

## Owner Decision の反映

| # | Decision | 実装 |
|---|---|---|
| 1 | T3（圧縮チップ）採用 | `MakingStepTabs` が工程の状態（active / next / completed / locked）で表示を変える |
| 2 | 完了済みは短縮ラベル＋✓、幅不足時のみ✓単独 | 完了タブ = `✓ ` + `STEP_SHORT_LABEL`。タブ内ボックスの container query（`.making-step-tab__inner`）で、幅 49px 以下のときだけ✓単独へ縮退 |
| 3 | 現在・次はフルラベル維持 | active / next は常に `STEP_LABEL`（locked は短縮ラベル）。active は `flex-grow: 1.15` で僅かに広く取る |
| 4 | aria-label は常に正式名 | 全タブ `aria-label={STEP_LABEL[step]}`（視覚の圧縮に依存しない）。完了タブには `aria-description="完了"` を付け、これまで名前の ✓ が担っていた完了の通知を維持 |
| 5 | 最大タブ数ゲートは 6 のまま | `MAX_VISIBLE_COOKING_TABS` / `cookingProfiles.tabGate.test.ts` は無変更。`makingStepLabels.test.ts` でも 6 を再確認 |
| 6 | 7 タブは dev/test fixture のみ | `e2e/harness/cs4-tabs.html`（実 `MakingStepTabs` を URL の工程列で描画）。本番レシピ・本番 profile は無変更 |
| 7 | 本番 RECIPES への FINISH 追加禁止 | 追加なし（`RECIPES` / `cookingProfiles.ts` 無変更） |
| 8 | UD-B / UD-I 保留 | FREE・Dinner の仕様は無変更 |

## 変更

- `src/components/MakingStepTabs.tsx` — 状態別ラベル、`aria-label` / `aria-description`、✓ とラベルを別 span に分離（`TabLabel` を実タブと BAKE インジケータで共用）
- `src/data/makingStepLabels.ts` — `STEP_SHORT_LABEL`（全角 3 文字以内。現行の本番工程は `STEP_LABEL` と同一で、未出荷の FOLD（折りたたみ→折る）/ EDGE_FILL（ふちづめ→ふち）のみ短縮。SEAL は元から とじる）
- `src/App.css` — FINISH のタブ色（`#7b4f9d`）、active の `flex-grow`、`.making-step-tab__inner`（container）、縮退規則。完了時の「焼く」だけ 11px（下記）
- テスト: `MakingStepTabs.test.tsx`（既存の期待を新 DOM に合わせ、7 タブ fixture を追加）、`makingStepLabels.test.ts`（新規）、`e2e/making-step-tabs-cs4a.spec.ts`（新規）、`e2e/harness/cs4-tabs.{html,tsx}`（新規・dev 専用）
- 既存テストの更新: 完了タブの accessible name が「✓ ソース」→「ソース」（aria-label）になったため、名前の照合を `name: "ソース"` + `toHaveTextContent("✓ ソース")` に変更。BAKE インジケータは内側 span にテキストがあるため `.making-step-tab--bake` を直接取得（`MakingStepTabs.test.tsx` / `GameScreen.makingStepNav.test.tsx`）。期待する挙動は変えていない

タップ可否・dispatch・工程遷移ロジックは無変更（押せるのは直後の工程のみ。BAKE は押せない）。

## 実測（Chromium、ハーネス/実アプリ。タブ幅 px）

| 構成 | viewport | 完了タブ（内幅） | active | 完了タブの表示 |
|---|---|---|---|---|
| 6 タブ（TOPPING 中・CUT 対象） | 360 | 55（51.5） | 63 | ✓ + 短縮ラベル |
| 6 タブ | 390 | 61（56.6） | 69 | ✓ + 短縮ラベル |
| 7 タブ（FINISH+CUT fixture） | 360 | 47（42.9） | 53 | ✓ 単独 |
| 7 タブ | 390 | 51（47.3） | 58 | ✓ 単独（下記 注意） |
| 7 タブ | 414 | —（50.8） | — | ✓ + 短縮ラベル |

- 「✓ チーズ」「✓ ソース」の描画幅は約 45.8px（11px bold、この環境のフォント）。しきい値 49px はそれに実機フォント差の余裕を足した値。
- 完了時の「焼く」は 11px で約 35px。しきい値 35px で、6 タブ（360: 36.0 / 390: 39.6）では文字を保ち、7 タブ（360: 30.1 / 390: 33.1）では✓単独。
- 7 タブでも active / next / locked のラベルは全 viewport で省略なし。次へタブは 360 でも幅 47px 以上・高さ 40px 以上。
- 変更前の 7 タブ（参考）: 360 で「✓ ソ…」「✓ チ…」と省略されていた。

### 6 タブ以下の既存レシピ（退行確認）

before/after を `docs/reports/screenshots/cs4a-tabs/` に保存（実アプリ Capricciosa = 6 タブ、DOUGH / SAUCE / TOPPING / CUT）。

- 完了タブは「✓ 生地 / ✓ ソース / ✓ チーズ / ✓ 具材」のまま表示。幅は active の拡大分だけ約 2px 狭い。
- 完了時の「焼く」だけ 13px → 11px に縮小（✓ 焼く は 360 / 390 とも残る。変更前の 360 は一部が切れていた）。
- 視認性の悪化は無いと判断し、T3 をそのまま適用した。

### 注意 / Owner（HV 後）判断

- **390 の 7 タブでは完了タブが✓単独**になる。Chromium 計測では「✓ チーズ」45.8px が内幅 47.3px に収まるが、余裕が約 1.5px のため、実機（Hiragino）で省略されない保証が無く、保守的にしている。iPhone 実機 HV でラベルが収まると分かれば、`App.css` のしきい値 `49px` を `46px` 前後へ下げられる（定数 1 つ）。7 タブ上限の解禁判断（Owner Decision 10）と合わせて判断を。
- container query は WebKit でも対応（iOS 16+）だが、本セッションには WebKit が無く、WebKit での検証は CI（`e2e-webkit.yml`）が根拠になる。新 e2e は「ラベルが切れない」を実測で確認するため、WebKit のフォントが広い場合は CI で落ちる可能性があり、その場合はしきい値を見直す（実機でも同じ切れが起きうるという実信号でもある）。
- 完了時「焼く」のしきい値（35px）は 6 タブ・360 で約 1px の余裕しかない。実機フォントがさらに広いと「✓ 焼…」のように省略される（変更前も 360 では一部が切れていた）。HV で確認し、必要なら 11px をさらに小さくするか、しきい値を上げて✓単独にする。

## テスト結果（ローカル）

- `npx tsc -b` / `npm run lint`: エラーなし（既存警告のみ、新規警告なし）
- `npx vitest run`: 401 files passed / 7286 tests passed（2 skipped は既存）
- e2e（Chromium `iphone-390x844` / `iphone-360x800` / `layout-chromium`）: `making-step-tabs-cs4a`（新規 20）、`dynamic-cooking-steps`、`making-ui-1screen`、`layout-contract`、`lunch-rush-material-shortage`、`timing-transparency`、`undo-placement-449`、`pizza-cutting-phase4b`、`cut-home-leave-confirm`、`free-cooking-phase3-2` ほか
- 新規 e2e の検出力: container query を無効化すると 7 タブのテストが失敗することを確認済み
- 既存の不安定要因（変更と無関係）: `discovery-hint-sheet.spec.ts` の 2 件（390）が 30 秒タイムアウトで落ちることがある。変更を退避した `main` でも同じ 2 件が落ちることを確認（今回の変更とは無関係）
- レビュー: Codex は本セッションに無いため未実施。代替として `code-review`（high）を差分に実施し、実在した指摘（完了の a11y 通知、コメント 2 件の誤り、重複マークアップ）を修正済み。残る指摘はしきい値の余裕（下記）で、仕様上のトレードオフとして記載
- GitHub CI（lint / vitest / build / WebKit e2e）: PR 作成後に確認する。WebKit e2e が container query とラベル幅の唯一の根拠になる

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `cs4a-tabs-390x844.mp4`（H.264） | 390×844 | 43.6 s | 483 KB（494,580 B） | PASS |

Download: セッション内直接提出（動画は repository に commit しない。policy §6）

Video Verification: PASS（ファイルあり・サイズ > 0・最後まで再生可能・viewport 全体・対象操作が映る。ffprobe: h264 / 390×844 / 43.56 s。フレームを抜き出して内容も確認）

この動画で確認すること:
1. 実アプリの Capricciosa（6 タブ）を DOUGH から RESULT まで通し、**次のタブをタップして**工程を進める（生地→ソース→チーズ→具材）。完了タブは「✓ 短縮ラベル」のまま読める。
2. BAKE 中は「焼く」が赤、完了タブが並び、BAKE 後に「カット」が青で active になる。
3. 7 タブ fixture（dev 専用ページ。本番レシピには FINISH は無い）で、生地→ソース→チーズ→具材 → 焼く → **仕上げ（紫）** → カットの順にタップで進める。active / next は常にフルラベル、完了タブは✓、はみ出し・省略なし。
4. 後半の fixture 画面の「bake / post」ボタンは検証用の dev ボタン（製品 UI ではない）。

Screenshots: `docs/reports/screenshots/cs4a-tabs/`（`before-*` / `after-*`、360 と 390。実アプリ 6 タブの全画面（DOUGH / SAUCE / TOPPING / CUT）と、帯のみの 6 タブ・7 タブ）。

## 未実施・保留

- iPhone 実機 HV（Owner Decision 9）: Owner が実施。
- 7 タブ上限の解禁（Owner Decision 10）: HV 成功後に別途判断。`MAX_VISIBLE_COOKING_TABS` は 6 のまま。
- D2 / FREE 仕上げ（UD-B）/ Dinner の FINISH（UD-I）/ 本番 FINISH 有効化: 未着手。
- merge / deploy / 共有 Preview 変更: 行っていない。
