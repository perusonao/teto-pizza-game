# Phase 4 UI 見直し P2 — 呼び方の統一・英語見出しの日本語化（Result Report）

- 日付: 2026-11-28
- 正本: PR #927 `docs/design/TETO_PHASE4_UI-REVIEW_INVENTORY-AND-SCOPE_2026-11-28.md` §5.4 P2（Must M5）、Owner 決定 Q4・Q11(a)
- base: `main` `0c755d02`（P1 = PR #928 とは独立。#928 には触れない）
- 範囲: **表示文字列だけ**。内部の識別子・コード上の名前・セーブ形式・ロジックは変えない。legacy 用の分岐は増やさない（Q11(a): 共通コンポーネントの文言は legacy にもそのまま及ぶ）

## 決定済みの語彙（Q4）

| 対象 | 統一後 |
|---|---|
| 発見済みレシピの集合 | メニュー |
| 図鑑 | ピザ図鑑 |
| 注文の入口 | 注文を受ける（現行どおり。変更なし） |
| ディナーミッション | 特別注文 |
| SHOP（Q5） | お店 |

## 対応表（変更前 → 変更後）

状態: ✅ = 実装済み / — = 変更しない（理由つき）

### 1. ホーム（`src/screens/HomeScreen.tsx`）

| # | 箇所 | 変更前 | 変更後 | 状態 |
|---|---|---|---|---|
| H1 | ヘッダーのチップ | 👑 レシピ n/60 | 👑 メニュー n/60 | ✅ |
| H2 | ヘッダーのチップ aria-label | レシピ図鑑 開発数 n / 60（legacy: 発見数） | ピザ図鑑 メニュー n / 60（legacy: 発見数 のまま） | ✅ |
| H3 | 図鑑カードの副題（shop） | 開発 n/60 | メニュー n/60 | ✅ |
| H4 | 特別注文カードの見出し | ディナーミッション | 特別注文 | ✅ |
| H5 | ショップカードの見出し | ショップ | お店 | ✅ |

### 2. ピザ図鑑（`src/components/DexOverlay.tsx` ほか）

| # | 箇所 | 変更前 | 変更後 | 状態 |
|---|---|---|---|---|
| D1 | シートの見出し | レシピ図鑑 | ピザ図鑑 | ✅ |
| D2 | 進捗の行（shop） | 🍕 開発 n / 60 | 🍕 メニュー n / 60 | ✅ |
| D3 | 結果画面のボタン（`ResultPanel.tsx`、`postDiscoveryPrimary.ts`） | 📖 図鑑を見る | 📖 ピザ図鑑を見る | ✅ |
| D4 | 閉じるボタンの aria-label | 図鑑を閉じる | ピザ図鑑を閉じる | ✅ |
| D5 | ヒントシートの完了見出し（`HintSheet.tsx`） | 🏆 図鑑コンプリート！ | 🏆 ピザ図鑑コンプリート！ | ✅ |
| D6 | 文中の「図鑑」（`openPoolCopy.ts`、`ResearchPointsNote.tsx`、`ResultPanel.tsx` の説明文、`App.tsx` の確認文、`roundNoticeCopy.ts`、`originalResultCopy.ts`） | 図鑑… | ピザ図鑑… | ✅ |
| — | 更新情報（`src/data/changelog.ts`） | 図鑑 | 変更しない（過去の更新の記録） | — |

### 3. 特別注文まわり（旧ディナーミッション）

| # | 箇所 | 変更前 | 変更後 | 状態 |
|---|---|---|---|---|
| S1 | 専用画面の見出し（`DinnerMissionScreen.tsx`） | 🌙 ディナーミッション | 🌙 特別注文 | ✅ |
| S2 | ミッション名（`dinnerMission.ts` の `display.titleJa`、表示専用） | ディナーミッション 1 / 2 | 特別注文 1 / 2 | ✅ |
| S3 | 工程画面の名前の既定値（`GameScreen.tsx`） | ディナーミッション | 特別注文 | ✅ |
| S4 | HUD のラベル（`DinnerGameUi.tsx`） | 🌙 DINNER | 🌙 特別注文 | ✅ |
| S5 | 結果の見出し | 🎉 DINNER CLEAR! | 🎉 特別注文クリア！ | ✅ |
| S6 | 結果の aria-label | ディナーミッション結果 | 特別注文の結果 | ✅ |
| S7 | 中断の確認 | ディナーミッションをやめますか？ | 特別注文をやめますか？ | ✅ |
| S8 | ターゲット一覧の aria-label | ディナーのターゲット | 特別注文のピザ | ✅ |
| S9 | 保存失敗のお知らせ（`roundNoticeCopy.ts`） | ディナーの報酬を保存できませんでした | 特別注文の報酬を保存できませんでした | ✅ |

### 4. その他の見出し

| # | 箇所 | 変更前 | 変更後 | 状態 |
|---|---|---|---|---|
| O1 | ショップの見出し（`ShopOverlay.tsx`） | 🛒 SHOP | 🛒 お店 | ✅ |
| O2 | ランチラッシュの開始モーダル（`MissionIntroOverlay.tsx`） | ⏱ LUNCH RUSH | ⏱ ランチラッシュ | ✅ |
| O3 | 画面内の「ショップ」（ボタン「ショップへ」「ショップを見る」「ショップで補充する」、吹き出し、ヒント、案内文。計 18 箇所） | ショップ… | お店… | ✅ |
| O4 | 練習（メニューから選ぶ）画面の章の数（`PizzaSelectScreen.tsx`、shop） | 開発 n/12 | メニュー n/12 | ✅ |

### 変更しないもの（判断）

| 文言 | 理由 |
|---|---|
| NEW / NEW n（バッジ）、🌟 NEW BEST! | 日本語のゲームでも一般的な短い記号として使われる表示で、見出しではない。M5 の「英語見出し」に当たらないと判断 |
| Pitz | 通貨の固有名 |
| STEP 2（`SquareDoughGuide.tsx`） | 工程画面の指示（#882 / 4d-1 の範囲） |
| 「レシピを選んで作る」「レシピ発見」等の legacy 専用文言、`shopCopy` の legacy 側 | legacy 専用の表示（範囲外） |
| 開発用ツール（`src/dev/`、`src/devtools/`、`src/preview/`） | 本番に出ない |
| 調理の中の「レシピ」（「レシピどおりの材料」「このレシピの〜」など） | 料理の手順としてのレシピで、「集めたメニュー」の意味ではない |

## 判断に迷って自分で決めた箇所

1. **「ショップ」を画面内すべて「お店」にした**（O3）。依頼の明示は SHOP 見出しだけだったが、見出しが「お店」でホームのカードやボタンが「ショップ」のままだと M5 の表記ゆれがかえって増えるため、表示文字列の「ショップ」をすべて揃えた。コメント・識別子（`ShopOverlay`、`SHOP_*` など）は変えていない。
2. **文中の「図鑑」も「ピザ図鑑」にした**（D6）。見出しやボタンだけでなく、説明文・お知らせの「図鑑」も揃えた。更新情報（changelog）は過去の記録なので変えていない。
3. **ヘッダーのチップ（H1）は legacy でも「メニュー n/60」になる**。このチップはもともと分岐のない共通表示で、Q11(a) に従い分岐を足していない。一方、すでに `shopCopy` で分かれていた箇所（図鑑カード・図鑑の進捗・練習画面の章の数・チップの aria-label）は、legacy 側の文言（発見）をそのまま残した。
4. **チップの aria-label** は「ピザ図鑑 メニュー n / 60」とした（読み上げで、図鑑を開くチップだと分かるように「ピザ図鑑」を残した）。
5. **HUD の「🌙 DINNER」は「🌙 特別注文」**、結果の「DINNER CLEAR!」は「特別注文クリア！」とした。ターゲット一覧の aria-label「ディナーのターゲット」は、画面の言葉に合わせて「特別注文のピザ」とした。
6. **「NEW」「NEW BEST!」は英語のまま**残した（見出しではなく短いバッジのため。上の「変更しないもの」）。必要なら P8 などで「新入荷」「自己ベスト」等へ変えられる。
7. **ランチラッシュの結果見出し**はもともと「ランチラッシュ結果」（日本語）で、変更していない。

## 完了した範囲／未完了の範囲

- **完了**: 対応表の全行（ホーム → ピザ図鑑 → 特別注文 → その他の見出し）。
- **未完了**: なし（範囲内）。範囲外のもの（レイアウト・配色・入口整理・アイコン）は触っていない。
- 内部の識別子・セーブ形式・ロジックの変更: なし（`missionId`、`titleJa` 以外の表示データ、`progression` の分岐は不変）。

## テスト

- 型チェック（`tsc -p tsconfig.app.json --noEmit`）: PASS
- lint（`npm run lint` = oxlint）: エラーなし（既存の warning のみ）
- Vitest（変更の影響を受けるファイル。components / screens / App.* / dinner / shopModelUi など、計 2,600 件超）: PASS。フル Vitest は CI で判定
- e2e（`iphone-390x844`、ローカル）: dinner-mission / shop-dinner-3e / dinner-settlement-dm4-3（22 件）、changelog / shop-catalog-3a / ingredient-shelf-shop / shop-service-orders-2a / progression2-discovery-ladder / discovery3-pool2-production / ingredient-shelf-inventory / shop-locked-422 / discovery-hint-sheet（40 件）: PASS。残りの e2e は CI で判定
- テストの変更は文言の追随だけ（削除・緩和なし）。ホームでヘッダーのチップと図鑑カードが同じ「メニュー 1/60」になったため、`shopModelUi.phase3a/2b` の 2 か所はどちらの要素かを正規表現の先頭・末尾で特定するようにした（確認する内容は同じ）。

## Human Verification Screenshots

`docs/reports/screenshots/phase4-ui-p2-wording/`（390×844、DEV サーバー `?progression=shop`、マルゲリータ開発済みのセーブ）

| 画面 | Before | After |
|---|---|---|
| ホーム | `before/01-home.png` | `after/01-home.png` |
| ピザ図鑑 | `before/02-dex.png` | `after/02-dex.png` |
| お店 | `before/03-shop.png` | `after/03-shop.png` |
| 特別注文 | `before/04-special-order.png` | `after/04-special-order.png` |
| ランチラッシュの開始 | `before/05-lunch-rush-intro.png` | `after/05-lunch-rush-intro.png` |

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `TETO_P2-wording_HV_390x844.mp4`（H.264） | 390×844 | 21.9 s | 499 KB | PASS |

Download: セッション内で直接提出（リポジトリにはコミットしない）

Video Verification: PASS（ファイルあり、サイズ > 0、ffmpeg で最後までデコード可）

この動画で確認すること:

- ホーム: ヘッダーのチップ「👑 メニュー 1/60」とピザ図鑑カード「メニュー 1/60」が同じ言葉で数えている／「特別注文」カード／「お店」カード／吹き出し「お店に新しい材料が入ったよ！」
- ピザ図鑑: 見出し「ピザ図鑑」、進捗「🍕 メニュー 1 / 60」
- お店: 見出し「🛒 お店」
- 特別注文: 見出し「🌙 特別注文」、カード「特別注文 1 / 2」
- ランチラッシュ: 開始モーダルの見出し「⏱ ランチラッシュ」

撮影はローカルの DEV サーバーで行った（Preview 公開は Owner 承認事項のため行っていない）。結果画面の「ピザ図鑑を見る」・特別注文の HUD／結果／中断確認は、調理を通す必要があるため動画には含めず、Vitest と e2e（dinner-mission / shop-dinner-3e / dinner-settlement-dm4-3 / discovery3-pool2-production）で確認した。
