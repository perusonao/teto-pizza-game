# #422 — Dex / Shop 全件表示 UI デザインモック（比較案）

Status: **DESIGN ONLY / 未承認の UI 案**。`src` / CSS / runtime / tests は一切変更していない。UI Style Lock はしていない。
Issue: #422（OD-DISPLAY-1 / OD-DISPLAY-2）、#420（OD-420-1）。#418 には触れていない。PR / merge / deploy / CI / E2E は未実施。
Branch: `claude/dex-shop-full-display-mock-xceyao`（docs 専用）

参照した既存成果物（監査のやり直しはしていない）:
`docs/reports/TETO_DEX-SHOP-FULL-DISPLAY_Implementation-Plan.md`（branch `claude/dex-shop-display-plan-jete4i`、main 未収録）／ Issue #422・#420 本文／ `docs/PROJECT_HANDOFF.md`。

## 0. 成果物

| ファイル | 内容 |
|---|---|
| `dex-comparison.png` | Dex の A/B × 390×844 / 360×800。初期(3/53)・章またぎ・中盤(22/53) |
| `shop-comparison.png` | Shop の A/B × 390×844 / 360×800。初期・LOCKED節・カテゴリ選択中・ヒント2行同時・完全解禁 |
| `mock/pages/*.html` | 静的モック 14 ページ（A/B × 状態）。`mock/mock.css` 共通 |
| `mock/build.mjs` `capture.mjs` `compose.mjs` `audit.mjs` | 生成・撮影・合成・Anti-Oracle 監査（docs 用ツール。`src` からは import されない） |
| `mock/metrics.json` `mock/audit.txt` | 実測値（§3）と匿名性監査（§5） |

再生成: `node mock/build.mjs && node mock/capture.mjs && node mock/compose.mjs`（Playwright / Chromium 使用。個別スクショ `mock/shots/` は再生成物のため commit しない）。

## 1. 既存 Owner Decision と未承認 UI 案の区別

**Owner 承認済み（変更しない・モックでも前提）**

| ID | 内容 |
|---|---|
| OD-DISPLAY-1 | Dex は全 53 枠・未発見枠に全種共通の汎用シルエット。Shop は NEW → OWNED → LOCKED、LOCKED はカテゴリタブと分離した末尾セクション。LOCKED 行は 🔒・？？？・共通シルエットのみ。個別残数は出さず集約「あとNつ発見」を維持。共通化はロック枠の表示部品のみ |
| OD-DISPLAY-2 | 「あとNつ発見」と「⭐あとN個」の 2 行を**同時表示**。⭐行は対象 Step 到達済みかつ累計⭐不足の場合のみ。複数対象は最小不足数を集約 |
| OD-420-1 | goat-cheese = Step50 AND ⭐120 / spinach = Step51 AND ⭐130（モックはこの数値自体を扱わない） |
| 実装ゲート | #418 D2 Pilot の Owner HV PASS まで実装禁止 |

**未承認（このモックが初めて可視化した案。すべて Owner 判断待ち）**
シルエットの意匠 / LOCKED 枠の列数・サイズ・密度 / LOCKED セクション見出し文言 / ヒント 2 行の位置・色・並び / Dex 未発見タイルの列数 / Shop 行の密度 / aria 文言 / 案A・案B のどちらか。
注: 実装計画 §10 O-6 は「複数列は Owner 未承認、暫定は 1 列」だった。今回の指示（LOCKED は 2 列）に従ってモック化したが、**2 列も依然として未承認**。

## 2. 2 案の定義

| | 案A 情報密度優先 | 案B 操作性・視認性優先 |
|---|---|---|
| Dex 未発見 | 3 列タイル（シルエット 30px / No. / 🔒？？？）、タグ文言「まだ見ぬピザ」は省略 | 2 列タイル（シルエット 48px / No. / 🔒？？？ / 「まだ見ぬピザ」） |
| Dex 発見済み | 1 行 44px（名前＋★） | カード 72px（名前＋★＋ベスト点） |
| Dex CTA（ヒントを見る） | 高さ 32px | 高さ 44px |
| Shop NEW/OWNED 行 | 2 行構成・約 70px、ボタン 36px | 現行同等の縦積み、ボタン 44px |
| Shop LOCKED | 2 列・44px 高・シルエット 26px | 2 列・64px 高・シルエット 40px |
| ヒント 2 行 | 12px / 余白小 | 13px / 余白大 |

共通: LOCKED 全枠は同一マークアップ。ヒントは LOCKED セクション見出し直下に配置（位置自体は Owner 判断 O-b）。

## 3. 実測値（`mock/metrics.json`、本文領域の画面数 = scrollHeight / 表示高）

| 画面・状態 | A 390 | B 390 | A 360 | B 360 |
|---|---:|---:|---:|---:|
| Dex 初期 3/53（全体長） | 2.7 | 5.6 | 2.9 | 5.9 |
| Dex 中盤 22/53（全体長） | 3.3 | 5.9 | 3.5 | 6.2 |
| Shop 初期 NEW1/OWNED2/LOCKED51 | 2.3 | 3.4 | 2.4 | 3.6 |
| Shop 中盤 NEW1/OWNED11/LOCKED42 | 2.9 | 4.7 | 3.0 | 4.9 |
| Shop 完全解禁 54 行 | 5.7 | 10.7 | 6.1 | 11.4 |
| 最小タップ高（操作要素） | 36px | 44px | 36px | 44px |
| Shop LOCKED 枠の高さ | 44px | 64px | 44px | 64px |

- 横スクロールは全ページ・両 viewport で発生なし。
- LOCKED 枠は全ページで outerHTML が 1 種類（Dex は No. 以外同一）。
- カテゴリを「すべて」→「具材」に切替えても LOCKED 件数は 42 のまま（`shop-*-mid` と `shop-*-mid-topping` の計測一致）。
- 360×800 は 390×844 より約 5〜6% 長くなるだけで、どちらの案も崩れない。

## 4. メリット / デメリット

### 案A
- ＋ 一覧性が高い。Dex 初期は B の約半分のスクロール量。LOCKED セクションが 1.7 画面で全件見渡せ、Shop 初期は先頭画面にヒントと LOCKED 枠が入る。
- ＋ LOCKED 51 件でも縦長になりにくく、「全件表示」の意図（全体像の把握）に合う。
- － 操作要素が小さい（Shop 購入/補充 36px、Dex ヒント CTA 32px）。iOS の 44pt 目安を下回り、誤タップの懸念。
- － Dex 3 列は 360px 幅で 1 タイルが約 100px。タグ文言を省略しており、既存の「まだ見ぬピザ」文言から変わる（Owner 判断 O-c）。
- － 密度が高く、🔒／？？？／シルエットの 3 要素が小さく窮屈。

### 案B
- ＋ すべての操作要素が 44px 以上で余白もあり、iPhone で押しやすく読みやすい。シルエットが大きく「ピザ」と認識しやすい。
- ＋ 既存の Dex 文言（まだ見ぬピザ）や Shop 行構成を保てる。
- － 縦に長い。Dex 初期 5.6 画面、Shop 中盤で LOCKED 節に到達するまでのスクロールが長く、ヒントが初期画面の下に隠れる。
- － LOCKED は非操作要素なのに 64px/タイルを占有し、大きさが操作性に寄与しない。

## 5. Anti-Oracle 適合の確認（`mock/audit.mjs` → `mock/audit.txt`）

- LOCKED 領域（Shop セクション・Dex 未発見タイル、168 領域）に対し、実カタログ（recipes / ingredients の id・nameJa・emoji、計 262 語）＋価格・パック量・購入ボタン文言・NEW・在庫を禁止語として照合 → **違反 0**。
- 属性は `class` / `aria-hidden` / `focusable` / SVG 幾何属性のみ。Shop セクションは固定の `aria-label="未解禁の材料"` と値なしの `data-shop-locked-section` のみ。Dex は既存仕様どおり `data-dex-state`。`data-ingredient-id` / `data-shop-state` / `data-family` / `data-stock-state` は無し。
- LOCKED 枠はボタン・リンク・tabindex なし。件数以外の差分なし（順序に意味が載らない）。
- カテゴリ選択は LOCKED を絞り込まない。ヒント 2 行は集約数のみ（名前・ID・family・価格・Step 番号なし）。⭐行は到達済み Step がある状態（終盤）にのみ表示し、初期・中盤には出さない。
- 注意（既存仕様・モックは追加しない）: Dex の枠位置（章・No.）は現行 main で既に公開済み。LOCKED の**件数**は残数を示すが、Owner 決定で accepted（実装計画 §9 リスク 1）。

## 6. 推奨案と理由

**推奨: 案Bをベースに、非操作要素（LOCKED 枠）だけ案Aの密度へ寄せる併用（案B'）。**

理由:
1. 押す要素（購入/補充/ヒント CTA）は金銭・進行に関わるため 44px を下回らせない（案Bの領域）。
2. LOCKED 枠はタップできないので、大きくしても操作性は上がらず縦長になるだけ。案Aの 2 列 44〜52px（Dex は 3 列）が合理的。
3. 全件表示の目的は「まだ先がある」と見せることで、51 枠でも 2 画面前後に収まる案Aの密度が向く。
4. ヒントは 13px・余白ありの案B仕様のまま、LOCKED 節見出し直下に置く（読めなければ意味がないため）。

※ 案B' は**今回レンダリングしていない**（指示の A/B 比較までで停止）。Owner が案B' を希望する場合のみ追加でモック化する。単純に A か B を選ぶ場合は、**操作性を優先して案B**を推す。

## 7. Owner 判断が必要な事項

| ID | 判断 | 本モックの暫定 |
|---|---|---|
| O-a | 案A / 案B / 案B'（併用）のどれにするか | 案B' を推奨 |
| O-b | ヒント 2 行の位置: LOCKED 節見出し直下 か 画面上部固定（初期は B で画面外に出る） | 節見出し直下 |
| O-c | Dex 未発見タイルの「まだ見ぬピザ」タグ文言を維持するか（案A は省略） | 維持（案B） |
| O-d | シルエット意匠（円形ピザ＋放射 6 分割の無彩色 1 種、Dex・Shop 共通でよいか） | 実装計画 O-4 の暫定どおり |
| O-e | LOCKED 節の見出し有無・文言（「🔒 まだ入荷していない材料」）、折りたたみなし | 見出しあり・件数なし・常時展開 |
| O-f | LOCKED 2 列表示の採用（計画 O-6 の 1 列暫定からの変更）。奇数件時の最終行半端表示の許容 | 2 列を許容 |
| O-g | aria: セクション単位の固定ラベル「未解禁の材料」（計画 O-8） | 固定ラベル 1 つ |
| O-h | Dex 技法（調理法）riddle カードにシルエットを付けるか（計画 O-3） | 付けない（モック対象外） |

## 8. モックの前提と限界

- NEW/OWNED 行・Dex 発見済みカードの名前は**表示用プレースホルダ**（解禁済み側のみ。LOCKED 側の実体は一切含まない）。Shop の終盤・完全解禁はスクロール量のため 12 種の名前を循環使用しており、実際の解禁順ではない。価格・パック量・★/点数も仮値。
- 「終盤」の LOCKED 4 件・ヒント「⭐あと20個」は計画書 §5 の検算例に基づく説明用の数値。#420 Batch 6 の starGate は main 未実装で、実装値ではない。
- 静的 HTML のため購入・遷移・アニメーション・初期スクロール位置は検証していない。実機の Safe Area・スクロール性能は実装 PR の Owner HV で確認する。
- Human Verification Policy: 本件は docs 専用のデザインモック（Policy §2「docs-only」）であり、動画は作成していない。実装 PR（PR-A/B/C）では 390×844 動画・before/after スクショ・Owner HV が必須（CLAUDE.md / Policy §12）。
- UI Style Lock は Owner 承認後に別タスクで行う。本モックは Lock しない。
