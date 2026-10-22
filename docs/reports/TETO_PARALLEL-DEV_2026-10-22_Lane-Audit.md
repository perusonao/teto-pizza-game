# 並行開発 開始監査（2026-10-22、調査・設計のみ / docs-only）

基準: `main` `d70bd20`（#619）。runtime 変更・PR 作成・merge・デプロイ・共有 Preview / 本番 FINISH への操作は一切なし。
既存担当者の branch（#615 `claude/late-catalog-foundation-1jvnee` ほか）には触れていない。

## 0. 依頼文の前提とのずれ（先に確認）

| 依頼文 | 実際（fresh GitHub / main） |
|---|---|
| Square-Pan #534 closed、#535 以降が次の候補 | #534 closed は正しい。**#535 (B) は #545 (B1) / #546 (B2) で実装・マージ済み、#536 (C) は #558 でマージ済み**。D1a/D1b/D2a2/D2b1/D2b2/F1〜F4b も `docs/reports/` に Result あり。Issue #535 / #533 / #536 / #537 / #538 は **open のまま**（クローズ漏れの可能性）。 |
| Ingredient Icons #417・#438 は open | open は正しい。ただし **Pilot A (#438) の実装 PR #503 は 2026-10-17 にマージ済み**（hot-dog / sausage / feta / ricotta）。#438 が open なのは Owner HV PASS 待ち、または close 漏れ。 |
| RESULT 縮尺 #514 closed | 正しい（PR #515、本番 ×0.75）。 |
| 独立 Preview Phase 1B Fresh Audit 完了 | **リポジトリ内 docs / Issue / PR に該当文書を見つけられなかった**（`Cloudflare`・`Phase 1B` 検索で Preview 関連 docs は SESSION-OPERATIONS §5 のみ）。ChatGPT 側成果物の可能性。内容は未確認として扱う。 |

## 作業A: 食材ビジュアル

### A-1 実装済み範囲（最新 main）
- #503 Pilot A: `ricotta-mound` / `feta-cubes` / `sausage-slices` / `hot-dog-slices`（64×64）。チーズは `pieceVisual` ありのみ SVG、ピザ上・drag preview・サムネ・Reference も SVG（Style Lock v2 §0-6、2026-10-17 改訂）。
- #580 Batch 8b: `shiso-leaf` / `whitebait-school`（新規食材の専用 SVG）。
- 既存 32×32: `tomato-slice` / `caper-cluster` / `clam-valve`。
- #514 / #515: RESULT 食材縮尺 ×0.75 が本番既定、`?resultScale=` は Preview 限定。
- #421 / #485: Canvas モッツァレラは Preview/DEV のみ（`?cheese=c64|c96`）、本番既定は M1。#486 は本番採用 Gate の設計待ち（open）。
- #479: Topping Size Classes は子 1 件完了、親は open（Owner Decision Gate 待ち）。

### A-2 SVG 棚卸し（`src/data/ingredients.ts` 66 材料）
| 区分 | 数 | 材料 |
|---|---|---|
| 実装済み `pieceVisual` | 9 | sausage, hot-dog, feta, ricotta, capers, clam, fresh-tomato, shiso, whitebait |
| 参照 SVG あり・**未実装** | 21 | mozzarella, gorgonzola, parmigiano, grana-padano, fontina, cream-cheese, cashew-cheese, catupiry, pepperoni, salami, bacon, ham, prosciutto-crudo, pork, chicken, anchovy, sardine, tuna, salmon, salt-cod, shrimp |
| 参照 SVG なし・未実装（絵文字） | 36 | 野菜・ハーブ・ソース等（tomato-sauce, olive-oil, pesto, basil, mushroom, pineapple, …）。Style Lock v2 の 26 種対象外 |

注: Style Lock の 26 種のうち実装済みは hot-dog / sausage / feta / ricotta / clam (既存) の 5 種。**残 21 種**（goat-cheese は 27 種目で未デザイン）。open PR #584 は `salmon-roe.svg`（いくら）を追加予定で、これは 26 種の外。

### A-3 Style Lock v2 整合
- Pilot B = grana-padano / parmigiano / gorgonzola（形で区別する組を実機確認）、Pilot C = mozzarella（Canvas / M1 を維持する扱いを別途確認）。順序は §5 で固定、変更不可。
- 残り 17 種の Pilot 割当は Owner が A〜C の HV 後に決める（§5）。
- 守る不変条件: 未移行チーズを 🧀 に退行させない／save・economy・Research authority に差分なし／Style Lock 自体は変更しない。
- Pilot B は Pilot A の HV PASS が Gate（#438 受入条件）。**PASS の記録を確認できていない**ため Owner 確認が必要。

### A-4 最初の差し替え実装 PR のスコープ案
**Pilot B（grana-padano / parmigiano / gorgonzola）— visual 追加のみ**
- 変更: `DedicatedIngredientVisual` に 3 値、`VISUAL_VIEWBOX`（64）、visual コンポーネント 3、`ingredients.ts` に `pieceVisual` 3 行、`IngredientGlyph.test.tsx` の dedicated 集合更新。
- 触らない: mozzarella、`.pizza-cheese*` CSS（SVG は既存ラッパー内側）、Canvas、save、recipes。
- 受入条件: grana ↔ parmigiano が 20〜48px で判別可、gorgonzola が他チーズと取り違えにくい、未移行チーズの CSS 表示が不変、ピザ上・drag preview・サムネで SVG が melt/size/RESULT×0.75 に追従、390×844 動画 + before/after + 360×800。
- **HOT 競合**: `src/data/ingredients.ts` / `IngredientGlyph.tsx` / `App.css` / `recipes.ts` / `PROJECT_HANDOFF.md` を #584 が変更中、`ingredients.ts` / `recipes.ts` を #615 が変更中。→ **#584 と #615 の merge 後に着手**（Pilot A と同じ運用）。それまでは reference SVG の監査・実装計画のみ。

## 作業B: 四角いピザ

### B-1 #533 / #534 の状態と成果
- #534 (A): closed。`panShape` と四角モデル（新規モジュール、丸い挙動は byte-identical）。Result: `TETO_SQUARE-DOUGH_A_Shape-Foundation_Result.md`。
- #533 (Q0): Issue は open だが、Design Lock addendum（`TETO_SQUARE-DOUGH_Design-Lock-Addendum.md`）は main に存在し、後続 (A〜F) はこれを前提に着地済み。残りは未チェックの「CI / Codex / Owner 承認」項目で、**close 漏れの可能性**。

### B-2 #535 の実装前監査 → 結論: 実装済みで監査対象なし
- B1 #545（ロジック・`COMMIT_SQUARE_DOUGH`・Preview スイッチ）、B2 #546（コンポーネント・なめらか度・STEP 1/2）。Result: `..._B1_Spread-Logic_Result.md` / `..._B2_Component_Result.md` / `..._B2_Visual-Feedback_Result.md`。
- E2E: `e2e/square-dough-b.spec.ts` / `square-dough-touch.spec.ts`（タップ・長押し・WebKit 相当のタッチ）が存在。
- 受入条件の `touch-action` / `-webkit-touch-callout` の WebKit 実証、360×800 の確認が Result に記録されているかは **本監査では未精査**（要: 次セッションで Result とテストを突合）。

### B-3 競合・HOT
- #474: 丸い DOUGH 側（A-0/A-1 は #477）。四角は `panShape === "square"` 分岐で分離済み。#535 は丸い定数を変更していないので競合なし。
- #518: 後乗せ piece の焼成 filter 分離は F-2 (#596) / F-3 (#599) / D2-2b (#591) で対応済みの流れ。Issue は open のまま（close 判断は Owner）。
- 現在の open: **#581**（Square Dough UX AB-min、#536 / Epic #532、Preview 限定）が `SquareDoughLayer.tsx` / `SquareDoughGuide.tsx` / `squareDoughGaps.ts` を変更中 → 四角 DOUGH UI の追加作業は #581 と直列。#540（グランマ S3）は HOLD 草稿で Square A〜D・F 完了待ち。
- HOT file: `App.css` / `GameScreen.tsx` / `gameReducer.ts` / `persistence.ts` / `recipes.ts` は四角作業が触りやすい。

### B-4 独立実装の可否
- 「#535 の最小スコープ」は不要。残りの候補は **#537 (D)**: D1a/D1b/D2a2/D2b1/D2b2 の Result が存在し部分着地済み。D の残差分（Issue 受入条件との突合）の洗い出しが先。
- #538 (F): F1〜F4b が着地済み。残差分は F5 以降（解放条件）か、Owner 判断。

## 作業C: 独立 Preview

### C-1 Phase 1B Fresh Audit
リポジトリ内に見つからず（上記）。**Owner がこの監査文書（またはリンク）を共有するまで、以下は暫定設計**。

### C-2 現状資産
- 共有 Preview: `perusonao/teto-pizza-game-preview`（GitHub Pages、`site/` を `deploy-from-source.yml` で丸ごと置換）。
- 同 repo の **open PR #2**: `pr/<slug>/` に PR 別ページを公開する GitHub Pages 方式（セーブキーをビルド後置換、`workflow_dispatch` のみ、48 テスト）。**未 merge・Actions 未実行**。
- 課題: github.io は同一オリジンのため localStorage 共有 → キー置換で擬似分離。Firebase は未無効化（`teto.dev.*` も分離されない）。

### C-3 Cloudflare Pages Direct Upload の最小 workflow 案（案のみ・未作成）
1. トリガー: `workflow_dispatch`（入力: PR 番号、40 桁 SHA）。自動実行しない。
2. job `build`（`contents: read`、secrets なし）: 入力検証（open・同一 repo・SHA が PR の現 HEAD）→ checkout → `npm ci` → `VITE_PREVIEW_MODE=1` 等 + **ビルド時**に `VITE_SAVE_NAMESPACE=<slug>` と `VITE_FIREBASE_DISABLED=1`（※本体側の小変更が要る。現状は後置換のみ）→ `dist/` を artifact。
3. job `deploy`（`environment: preview`、`CLOUDFLARE_API_TOKEN` / `ACCOUNT_ID` はここだけ）: PR コードを実行せず `wrangler pages deploy dist --project-name=teto-preview --branch=pr-<N>`。
4. 結果: 固定 URL `pr-<N>.teto-preview.pages.dev`（PR 別）＋ deployment 別 URL `<hash>.teto-preview.pages.dev`。
5. 削除: 別 workflow（`remove`）。共有 Preview・本番 Pages には一切触れない。

### C-4 検証方法
| 項目 | 方法 |
|---|---|
| PR 別 URL | PR A / B を別 branch alias に deploy し、それぞれ別の SHA バッジ（`PREVIEW · PR#N · sha`）になること |
| デプロイ別 URL | 同 PR を 2 回 deploy し、`<hash>` URL が別でどちらも到達可・alias は最新を指す |
| セーブ隔離 | Cloudflare は `*.pages.dev` がオリジン別（localStorage 自然分離）。Playwright で A にセーブ → B / 共有 Preview / 本番で読めないこと、ビルド成果物に本番キー `teto-pizza-save-v1` が 0 件であること |
| Firebase 無効化 | 成果物に Firebase 初期化・API キーが 0 件、ネットワークに `firestore.googleapis.com` 等への通信が 0 件、ランキング UI が非表示/無効 |
| 共有 Preview 不変 | deploy 前後で `teto-pizza-game-preview` の `site/` ハッシュが同一 |

### C-5 Owner 側で必要な操作
1. Phase 1B Fresh Audit 文書の共有。
2. Cloudflare アカウント / Pages プロジェクト作成、API Token（Pages 編集権限のみ）の発行。
3. GitHub に `preview` environment と secrets（`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`）を設定、environment の承認者を Owner に設定。
4. 本体側のビルド時変数化（セーブ名前空間・Firebase 無効化）の実装承認（`persistence.ts` は HOT）。
5. preview repo の PR #2 の扱い（Cloudflare 案に統合 / 並行 / 破棄）を決定。
6. 初回 deploy の実行承認。

## レーン別一覧

| レーン | 完了済み | 未実装 | ブロッカー | 次の実装 PR | 並行着手 |
|---|---|---|---|---|---|
| A 食材 | Pilot A (#503)、shiso/whitebait (#580)、RESULT ×0.75 (#515)、Canvas mozzarella Preview (#485) | 21 種（参照 SVG あり）＋ goat-cheese 未デザイン | #584 / #615 が `ingredients.ts` 等を変更中。Pilot A の Owner HV PASS 記録未確認 | Pilot B（3 種、visual 追加のみ） | #584/#615 merge 後に可。それまで docs/監査のみ |
| B 四角 | A, B1, B2, C, D1a/b, D2a2, D2b1, D2b2, F1〜F4b | #581（AB-min、open）、D/F の残差分、#540 グランマ | #581 と同ファイル。#540 は HOLD | なし（#535 は完了）。まず #537 / #538 の残差分監査（docs-only） | 監査は可。UI 実装は #581 の後 |
| C Preview | PR #2 に GitHub Pages 版設計（未 merge） | Cloudflare workflow、ビルド時変数化 | Phase 1B 監査が repo に無い、Owner の Cloudflare 操作 | 設計 docs → workflow（Owner 承認後） | docs は可。実行は不可 |

## Owner 判断が必要な事項
1. Phase 1B Fresh Audit の所在（共有してほしい）。
2. #438 / #417 の Pilot A HV は PASS か（Pilot B の Gate）。
3. #535 / #533 / #536 / #518 を close してよいか（実装は着地済み）。
4. Pilot B を #584 / #615 の merge 後に着手する順序でよいか。
5. Preview は Cloudflare を採用し、preview repo の PR #2 を置き換えるか。
6. 本体側のビルド時セーブ名前空間・Firebase 無効化（`persistence.ts` を触る）を承認するか。
