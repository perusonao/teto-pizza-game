# HOME / App Icon Fresh Audit（READ-ONLY・docs-only）

Audited: `origin/main` = `d70bd20`（#619）· 2026-10-22 · Branch `claude/home-screen-app-icon-audit-uqkqke`
Scope: 調査と報告のみ。runtime / 画像 / CSS / manifest は未変更。共有 Preview・本番は未操作。PR 未作成（Owner 承認待ち）。
計測: 作業コピー（リポジトリ外）で `vite build` → `vite preview`、Chromium（モバイルエミュレーション DPR2）。**実機 iPhone Safari ではない**（§7）。

## 1. 現状

### 1.1 Issue #24 / 関連 PR の状況
- Issue #24（HOME-1）は **open のまま**だが、受け入れ条件の実装は完了済み。PR #25 が merge 済み、その後 #41（PS3 見た目）・#96（材料）・#127/#147（ランキング）・#158・#197（レシピ発見）・#568（保存通知）等で HOME は継続発展。コメント・claim なし。
- 未達はチェックリスト上の「iPhone 実機確認」のみ（`PIZZA_GAME_HOME-1_Result.md` は実機未確認）。**#24 を閉じる/更新するかは Owner 判断**。
- HOME は `src/screens/HomeScreen.tsx`（278 行）+ `src/App.css` L3825-4170。アイコンは `scripts/generate-icons.cjs` が `teto.webp` から生成（`public/icons/` 11 枚）。

### 1.2 PWA / メタ（`index.html`, `public/manifest.webmanifest`）
| 項目 | 現状 | 判定 |
|---|---|---|
| favicon 16/32 | `/icons/icon-{16,32}.png`（Vite が base を付与し `/teto-pizza-game/icons/…` に解決、200 確認） | OK |
| apple-touch-icon | 180px、**全ピクセル不透明**（alpha=255） | OK（iOS の黒塗り問題なし） |
| manifest | name「テトのピザ屋さん」/ short「テトのピザ屋」/ standalone / portrait / start_url・scope = `/teto-pizza-game/` / 192・512 any + 512 maskable | 概ね OK。`id` 未指定 |
| iOS ホーム名 | `apple-mobile-web-app-title`=「テトのピザ屋」 | OK |
| 起動画面 | `apple-touch-startup-image` なし。iOS は manifest の `background_color` を起動画面に使わない。`body` 背景 `#d9c9a8`（CSS は JS/CSS 読込後に適用）、`index.html` にインライン背景なし | **要改善**（起動時の白/ベージュのちらつき） |
| status bar | `black-translucent` + `viewport-fit=cover`、header に `safe-area-inset-top` 済み | OK |
| `theme-color` | `#6b4226`。HOME の看板ヘッダーは `#7a4d2c→#5c3419` | 軽微な不一致（Safari 通常表示のみ影響） |

### 1.3 アイコン画像（目視、`icon-512.png` / `-maskable` / `-180`）
- 構図は **テト全身（座り姿）+ 暗褐色の放射グラデ**。Issue #24 が求めた「Teto の顔/上半身 + pizza」の **pizza がない**。
- 毛並みが黒〜濃灰（実測 RGB ≈ 33,27,22〜53,41,34）で、背景の暗褐色（≈ 51,29,16〜106,65,38）と **明度が近く輪郭が沈む**。
- 全身を収めるため顔は枠の約 1/4。16/32/58/60px では顔が判別しにくい（最も見られるのはホーム画面の 60〜180px）。
- 切り抜き由来の淡い縁取り（ハロ）が毛先に残る。maskable 版はキャラ 62% で安全域内だが、通常版と同じ「小さい全身」で印象が弱い。

### 1.4 HOME 画面（計測値、`d70bd20`、初回ロード = 未発見の新規 save）
| 指標 | 390×844 | 360×800 |
|---|---|---|
| 横オーバーフロー | なし（scrollWidth 390） | なし（360） |
| 縦 | 1 画面に収まる（scrollH = clientH） | 同左 |
| 主要 CTA 高さ / 幅 | 54px / 175px×2 | 54px / 160px×2 |
| ピザを作る / ランチラッシュ | 307〜361px（ファーストビュー内） | 同左 |
| メニューカード | 84px、2×2 | 84px、2×2（幅 160px） |
| 最小文字サイズ | **9.5px**（`.home-menu__sub`） | 同左 |
| 末尾の空き | メニュー下端 700px〜フッター間に約 100px の空白 | 同左 |

スクリーンショット: `docs/reports/screenshots/home-app-icon-audit/before-home-390x844.png` / `before-home-360x800.png`

## 2. 問題点（優先度順）

| # | 優先 | 問題 | 根拠 |
|---|---|---|---|
| P1-1 | **P1** | **ホーム画面アイコンの識別性が低い**：pizza なし・暗背景に暗い毛並み・小サイズで顔が潰れる・Issue #24 仕様（顔/上半身+pizza）と不一致 | §1.3 |
| P1-2 | **P1** | **360×800 でヒーローの脇役（ミト/ブルー）が左右で欠ける**：cast 幅 = 84+6+176+6+84 = 356px に対しヒーロー内幅 328px、`overflow:hidden` で約 14px ずつ切れる（スクショで確認） | §1.4, `.home-hero__*` |
| P2-1 | P2 | **吹き出しの改行が不自然**：390 で「最/初の1枚」、360 で「最/初の1枚」と語の途中で折れ、吹き出しがテトの頭部に被る。`max-width:80%` + `word-break` 未調整 | スクショ |
| P2-2 | P2 | **起動画面**：スプラッシュ画像なし、`index.html` に背景色のインラインなし → standalone 起動時に白/ベージュのちらつき | §1.2 |
| P2-3 | P2 | **補助文字が小さい**：`.home-menu__sub` 9.5px、`.cta-button__sub`/footer 11〜11.5px（iOS の可読目安 11px 未満） | §1.4 |
| P3-1 | P3 | メニュー下に約 100px の空白、フッターが画面底に貼り付き。ファーストビューは主要 CTA が全部見えており機能問題ではないが、縦に余裕がある分を文字/カード拡大に回せる | §1.4 |
| P3-2 | P3 | manifest に `id` なし（将来 start_url を変えた時に別アプリ扱いになる）、`theme-color` と看板色の不一致 | §1.2 |
| P3-3 | P3 | Preview と本番で同じアイコン/名称（共有 origin）。ホーム画面に両方追加すると区別できない | Session Ops §5 |

**問題なし（維持）**: 初回ロードで HOME 表示、390/360 とも横スクロールなし、CTA 54px、メニュー 84px のタップ領域、安全領域（上下）対応、apple-touch-icon の不透明性、favicon/manifest の base 解決。

既存デザインとの統一感: HOME は木・レンガ・オーブン光の配色（`#6b4226` / `#f7ecd4`）で一貫しており、アイコンの暖色グラデも同系統。統一感そのものは良好で、問題は「アイコン構図」と「360 幅での崩れ」に集中している。

## 3. 競合・HOT file claim
- Open PR 26 件を確認。HOME / `index.html` / manifest / `public/icons` / `HomeScreen.tsx` / `App.test.tsx` を触る PR は **なし**。
- HOT file `src/App.css`・`docs/PROJECT_HANDOFF.md` を触るのは **#584**（Batch 8c、レシピ追加）のみ。HOME の CSS 範囲（L3825-4170）とは別領域だが、同一ファイルのため rebase 順序を claim に明記する必要あり。
- `teto-claim:v1` のコメントは Issue #24 に **ない**（コメント 0 件）。他セッションの HOME / アイコン claim は確認できず。
- #540（HOLD）・#581・#468 等は HOME 領域に差分なし。

## 4. 改善案（優先順位付き）

| 順 | 案 | 種別 | 触るファイル | HOT | HV |
|---|---|---|---|---|---|
| 1 | **アイコン再構図**：テトの顔〜上半身を大きく + ピザ（既存の公式ピザ素材/絵文字ではなく既存アセットの合成）、明るめのオーブン光背景で毛並みとの明度差を確保、ハロ除去。文字は入れない。`generate-icons.cjs` を更新して再生成 | 画像 | `scripts/generate-icons.cjs`, `public/icons/*` | なし | 要（iPhone ホーム画面の実機/最小 Preview） |
| 2 | **360 ヒーロー崩れ修正**：脇役サイズ/gap を幅に応じて縮小（または cast 幅 ≤ 内幅に制約） | CSS | `src/App.css`（HOME hero 範囲のみ） | **HOT** | 要（390/360 動画 + before/after） |
| 3 | **吹き出し**：`word-break: auto-phrase`（非対応 Safari 向けに `<wbr>`/最大幅調整）、テトの顔に被らない位置 | CSS（+必要なら文言は不変） | `src/App.css` | **HOT** | 要 |
| 4 | **起動画面**：`index.html` に `<style>html,body{background:#2a170d}</style>`（または apple-touch-startup-image を主要端末分）、manifest に `id` | HTML/manifest | `index.html`, `public/manifest.webmanifest` | なし | 要（実機でのみ確認可） |
| 5 | **補助文字を ≥11px**、空白を使ってカード/文字を拡大（レイアウト契約 L-O を壊さない範囲） | CSS | `src/App.css` | **HOT** | 要 |
| 6 | Preview ビルドだけアイコン/名称を区別（`VITE_PREVIEW_MODE`） | build | `vite.config.ts` 等 | — | Owner 判断（共有 Preview に触れるため別承認） |

## 5. 受け入れ条件（実装 PR 用）

**アイコン（案 1）**
- 512px で顔とピザが一目で判別でき、背景との明度差がある（目視 + 16/32/60/180px の縮小プレビューをレポートに添付）。
- 全 PNG が不透明（apple-touch / 192 / 512）。maskable はキャラ・ピザとも中心 80% 円内。
- 公式 Teto 素材のみ使用、AI による別個体生成なし、文字・細かい背景なし。
- `manifest` / `index.html` の参照パスは不変（ファイル名維持）。

**HOME レイアウト（案 2・3・5）**
- 390×844・360×800 とも横スクロールなし、縦 1 画面（`scrollH = clientH`）、主要 CTA（ピザを作る/ランチラッシュ/レシピ発見）がファーストビュー。
- ミト/ブルー/テトの 3 体が **全域表示**（切れなし）。吹き出しが語の途中で折れず、テトの顔に被らない。
- 補助文字 ≥ 11px、CTA ≥ 54px / カード ≥ 84px のタップ領域を維持。
- HOME 固有の既存 unit/E2E（`HomeScreen.*.test.tsx`, CTA layout contract L-O）が無改変で green。文言・導線・save は不変。

**起動画面（案 4）**
- standalone 起動で白フラッシュなし（実機確認）。manifest に `id` 追加後も start_url / scope 不変。

**共通**: Human Verification Policy に従い 390×844 動画（Owner へ直接提出、repo には commit しない）+ before/after スクリーンショット（`docs/reports/screenshots/<task>/`）、typecheck/lint/build/test green。

## 6. 実装順序と最初の最小 PR

1. **PR-1（最小・推奨）: アイコン再生成のみ**（案 1）。画像 + `generate-icons.cjs` のみ。**HOT file なし**・runtime/CSS/manifest 不変・#584 と無競合で独立に進められ、第一印象（ホーム画面）への効果が最大。HV = 縮小プレビュー + iPhone でのホーム画面追加確認。
2. PR-2: 360 ヒーロー崩れ + 吹き出し改行（案 2・3、`App.css` HOME 範囲のみ）。#584 の merge 状況を確認し、claim に「merge 順 / rebase 先」を明記。
3. PR-3: 起動画面 + manifest `id`（案 4）。
4. PR-4: 補助文字サイズ・余白の再配分（案 5）。PR-2 の後（同じ CSS 範囲）。
5. 案 6 は Owner 判断後。

## 7. 未確認・制約
- 実機 iPhone Safari / ホーム画面追加後の実際のアイコン表示・起動画面は未確認（クラウド環境では不可）。iOS 固有のフォントブースト・`word-break` 挙動は PR-2 の HV で実機確認が必要。
- 計測は fresh save（未発見）状態のみ。発見済み状態（`lunchRushLocked=false`、NEW バッジ、通知バナー表示時）の縦余白は未計測 — バナー表示時に 1 画面を超える可能性は PR-2/4 で確認する。
- Issue #24 のコメント/ラベル更新は行っていない。
