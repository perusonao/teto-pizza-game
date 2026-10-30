# 表示・操作確認の標準ワークフロー（Owner方針・2026-10-30）

Status: **Owner-requested working guideline (proposed for merge)**.
This guide supplements, and does not override, `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` and `docs/decisions/TETO_SESSION-OPERATIONS_1.0.md`. If they conflict, the existing SSOTs prevail until separately revised with Owner approval. In particular, automated captures are not automatically an iPhone Safari HV PASS.

## 原則
- 開発と確認は **iPhone + Claude Code Cloud** を基本とする。PCの準備やローカルサーバ起動を前提にしない。
- 表示・デザイン・レイアウト・画面遷移・操作の確認は、まず **実画面のスクリーンショットと操作動画** を撮影してOwner/ChatGPTが視覚評価できる形で提出する。
- 操作が必要な確認は、**必要なレシピ、食材、在庫、解禁状態、工程** が事前に揃った専用の検証入口を用意し、iPhone SafariのPreviewで短い手順で試せるようにする。準備のためにゲームを最初から進めさせない。
- 画像・動画の評価と実機Safari固有の確認を分け、未確認をPASSとしない。HVの正式なPASS/FAIL/waivedはOwnerが判断し、セッションが代筆しない。

## Claude Codeへの標準指示（UI/UX/gameplay変更）
1. 対象PRの**exact HEAD SHA**、最新の規則、既存の撮影成果物を確認する。既存素材を再利用し、必要な差分のみ追加撮影する。
2. Playwright **ChromiumとWebKit** で、原則 **390×844** と **360×800** の実ゲーム画面を撮影する。WebKitが使えない場合は理由と未確認範囲を明記する。
3. Before/After、実寸/拡大、通常/失敗/境界、重なり、暗い背景など、変更に関連する条件を比較する。操作変更は食材選択から工程・RESULTまでの人間が読める速度の動画を含める。
4. スクリーンショットは `docs/reports/screenshots/<task-name>/` に保存。動画はrepoにcommitせず、直接提出または既存HVポリシーが認めるActions Artifactで提供する。ファイル情報と取得方法をResult Reportに記す。
5. 視覚判定を **PASS / 要改善 / FAIL / 未確認** として根拠画像に対応づける。ChatGPTに共有しやすい比較シートを作成する。
6. 操作確認が必要なら、対象レシピ・材料・在庫・解禁・工程を満たす**使い捨ての検証データ**と入口を用意する。既存セーブや本番Firebaseを読み書きしないことをテスト・確認する。検証用パラメータとURLを明示する。
7. 共有Previewを利用する場合、現在の公開SHA/PR、実行中workflow、利用競合の可能性、復旧SHAと手順を記録し、**更新ごとにOwnerの明示承認**を得る。承認後に対象HEADを公開し、バッジ/URL/データ/操作開始地点を確認する。Previewを上書きすることはこのガイドだけでは許可されない。
8. CI・Codex・レビュー・mergeabilityを確認する。HVの正式な判定とmerge/production deployはOwner承認まで実行しない。

## Result Reportに必ず書くこと
- exact HEAD、使用したPreview URLと公開SHA（未使用ならその旨）
- 撮影ブラウザ、viewport、画像/動画の提出先、撮影できなかった条件
- 検証用データ（レシピ/食材/在庫/解禁/工程）とセーブ隔離方式
- 項目別のPASS/要改善/FAIL/未確認と証拠
- Chromium/WebKit自動撮影とiPhone Safari実機HVの区別
- CI/Codex/Owner Gateの結果と、Owner判断待ちの事項

## 運用上の注意
- Previewは共有資源。利用予定はリポジトリから完全には分からないため、無断で上書きしない。
- `?hv=` 等の既存セーブを書き換える入口は、隔離が確認できない限り使わない。
- 画面や動画が良好でも、現行HVポリシーが要求する実機確認を自動的に免除しない。必要なら別途Policy改定を提案する。
- デザインのStyle Lock、claim、Duplicate Gate、#468などの既存HOLDを維持する。
