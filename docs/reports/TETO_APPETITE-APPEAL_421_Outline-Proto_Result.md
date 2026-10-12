# Issue #421 — モッツァレラ輪郭の作り直し試作（Fresh Audit 案A）Result

- ブランチ: `claude/issue-421-mozzarella-outline-proto`（PR #468 の M1 `d1ff57f` + 現 main `279ed48` を土台に独立して作成。#468 ブランチ・共有 Preview は未変更）
- 状態: **試作。Owner の比較・採否判断待ち**（PASS ではありません）。PR 作成・Ready 化・merge・deploy・Preview 切替はしていません。

## 1. 比較基準
- 基準 = 同じ土台（M1 + main）から本試作の変更だけを除いたコミット `2b8bc1f`。同一の撮影スペック（`e2e/mozzarella-outline-proto-capture.spec.ts`）を、M1 ビルドと試作ビルドに同条件（Chromium・DPR 3・Margherita・同じ配置・同じ針位置）で実行。

## 2. 実物写真の調査（制約あり）
- **写真は取得できませんでした。** この環境の outbound proxy が写真ホスト（Wikimedia / Unsplash）へ 403 を返します。Web 検索で得たのは文章情報のみです。
- 文章から整理した特徴（出典: KQED / MPR「Science crowns mozzarella the king of pizza cheese」、Auckland 大学 B. James らの研究の紹介）:
  - **輪郭**: 水分が蒸気になり、伸びるチーズが大きな気泡を作る。輪郭は円ではなく、不規則に広がる。
  - **薄い膜**: 表面の油が気泡で押しのけられ、薄い膜の部分と厚い部分ができる。
  - **焼き色**: 焦げは全面ではなく、油が退いた部分（気泡の頂点など）に斑に出る。
- **未確認**: 写真との直接比較は未完了。実物写真は Owner に 1〜2 枚ご用意いただくのが確実です。

## 3. 試作の内容（モッツァレラの描画のみ）
- 輪郭: 本体の輪郭の「ずれたコピー」6 枚（`box-shadow`、ぼかし 0.8px、アルファ最大 0.62）の和集合。遠くへ伸びる舌状 3 枚（最大約 5px × 個体差）と近い 3 枚（約 1.8px）。向き・距離・広がり・強さは `ingredientId:x:y` の決定的ハッシュでピースごとに異なる（`Math.random` 不使用）。色は焼成に追従（クリーム→金→茶）。
- 本体: 縁の不透明度を 0.7 → 0.94（M1 の縁の薄いピンクの透け対策）。
- M1 の 5 ローブ（ぼかし 1px の雲）と `--bake-cheese-spread` は置換。
- 変更ファイル: `src/logic/bakeVisual.ts`、`src/App.css`（`.pizza-cheese--mozzarella` の `box-shadow` のみ）、`src/logic/bakeVisual.test.ts`、`e2e/mozzarella-melt-421.spec.ts`（層数 10→11）、撮影スペック（`PROTO_SHOTS_DIR` 未設定ならスキップ）、本 docs / 画像。
- **変更していないもの**: 採点・`classifyBake`、焼成時間、CUT、保存、経済、`PizzaStage.tsx`、DOM、生（melt 0）の見た目。

## 4. 見た目（Chromium のみ・実機/WebKit 未確認）
比較画像: `docs/reports/screenshots/mozzarella-outline-proto-421/compare-<viewport>-<段階>-closeup.png`（左 M1 / 右 試作）、`compare-*-6-cut-stage.png`、`compare-*-7-result-stage.png`。390×844 と 360×800 の両方。
- 良くなった点: 輪郭が楕円ではなくなり、ピースごとに違う広がり方（片側に伸びる舌状）になった。膜の薄い部分と厚い本体の差が出て、M1 より「溶けて広がった」感がある。焼き過ぎでも輪郭の広がりが暗いソース上で自然に沈む。
- 弱い点（正直な評価）:
  1. 半透明のコピーの縁が見え、**「重ねたシート」「ゴースト」のように見える**箇所がある（特に溶け始め〜適正）。滑らかな有機的な縁にはまだ遠い。
  2. 本体の内側の楕円の縁線が残り、「黄身と白身」風に見える恐れ。
  3. 隣のピースやバジルに近い配置では、舌状の広がりが接触・重なって見える（RESULT で顕著）。
  4. 焦げは従来の斑点のまま（気泡の頂点に出る、という特徴は未反映）。
- 実機での判断が必要。

## 5. 検証
| 項目 | 結果 |
|---|---|
| `tsc -b` / `npm run build` | 通過（既存のチャンクサイズ警告のみ） |
| oxlint | 本変更ファイルの指摘なし（既存ファイルの warning 3 件のみ） |
| Vitest 全件 | 390 files / 7165 passed / 1 skipped |
| e2e `mozzarella-melt-421`（Chromium 390×844 / 360×800） | 4 passed |
| 関連 e2e（finished-pizza-visual-2.0 / pizza-cutting-phase4b / cut-regions-427 / result-1screen-2.0 / cut-skip-failed-bake、両 viewport） | 47 passed / 1 skipped |
| WebKit | ローカルに無く未実行（push 後の CI 待ち） |
| 描画コスト | 未計測（`box-shadow` が 5→6 層の増加。既存と同程度の見込みだが計測していない） |

## 6. 技術的な注意
- 半透明の `box-shadow` は重なる部分でアルファが累積するため、舌状が重なる箇所は濃く見える（設計上の濃淡）。
- 古い WebView（#467）は未検証。
- Human Verification（390×844 の動画）は未実施です。ポリシー上、採用判断前に Owner の実機 HV が必要です（動画はリポジトリに含めません）。

## 7. Owner の判断材料
- 採用 / 追加調整 / 見送り。追加調整するなら: (a) コピーの縁をさらにぼかす or 数を増やして「シート感」を消す、(b) 焦げを舌状の先端・気泡頂点へ寄せる、(c) 動き（案B）。
