# 発見失敗後の案内 — 設計 Gate（Issue #676、docs-only）

Status: **監査と設計のみ。** `src/**`・`e2e/**`・CSS・テスト・golden・データ・workflow・本番スイッチ・共有 Preview・Production・Firebase は無変更。merge・deploy・CI 再実行・Monitor 作成なし。
基準 `main` = `28f04f4`（2026-10-26）。関連: #358（Contract 2.0 時代の UX。PR #359 は closed）、#360、#544、#472（Research FAILED 文言・実装済み）。
**「推奨」は助言であり Owner Decision ではない。未回答を承認済みとみなさない。**
守る契約: `docs/decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md`（INV-D1〜D7、OD-RB-1〜19）。count / distance / similarity / Near・Far の禁止、× の永続化禁止、ORIGINAL 3 outcome の byte 同一、INV-D7（直接の「なし」を出さない）、INV-D5（実行の失敗を ○× に混ぜない）は**全て維持**する。

## 0. 方法と限界

- 実画面: Chromium（Playwright、事前インストール版）、390×844 / 360×800。`tools/discovery-failure-guidance-audit/capture.spec.ts` が 4 画面（Research ORIGINAL / Research FAILED / 標的なし Free ORIGINAL / 標的なし Free FAILED）を実際に操作して RESULT まで進め、表示文言・ボタン・出口（ヒントシート、試作ノート）を `docs/reports/screenshots/discovery-failure-guidance/*.json` と PNG に記録した。観測のみで製品への assertion はない。
- 保存は Dex 25 ラダーの検証用保存（研究対象 1 件、`research-failed-trial.spec.ts` と同じ）。素の初回プレイの保存ではない。
- **未実施:** WebKit・実機、PREPARE 画面の文言（取得に失敗したため、文言は `researchUxCopy.ts` から引用）、Dinner / Lunch Rush、複数の研究対象、4 種以上のトッピングの over-cap 表示、スクリーンリーダー。
- 1 回ずつの観測。表示文言は決定的だが、プレイヤーがどこで詰まるかは**実プレイの観測ではなく構造からの推定**である。

## 1. 現状監査（実画面で確認した事実）

RESULT 画面（390×844。360×800 も同じ構成。縦スクロールなし）:

| 画面 | 見出し・本文 | ○× | 出口（ボタン） |
|---|---|---|---|
| **Research ORIGINAL** | 🧪 オリジナルピザ / 🔎 研究中 ？？？ピザ（…）/ 「まだ新しいレシピは見つかっていません」/ 使った材料 / 焼き加減 / 「試作結果とノートを見て、次に試す材料を考えてみよう。」 | **あり**（使った材料ごと） | 💡 ヒントを見る / もう一度試す / 📓 試作ノート / レシピを選んで作る |
| **Research FAILED** | 失敗 / 研究中 / 「生焼けで提供できません」/ ○× / 「使った材料の○×は残ったよ」/ 焼き加減 / +0 Pitz / 「今回は料理として成立しなかったため、提供できませんでした。」 | **あり**（残る） | もう一度試す / 📓 試作ノート / レシピを選んで作る（**💡 なし**） |
| **標的なし Free ORIGINAL** | 🧪 オリジナルピザ / 「まだ新しいレシピは見つかっていません」/ 使った材料 / 焼き加減 / 「図鑑のピザと同じ組み合わせで作ると「発見」＆Pitzがもらえるよ。」 | なし（OD-RB-1） | 💡 ヒントを見る / もう一度試す / レシピを選んで作る（**📓 なし**） |
| **標的なし Free FAILED** | 失敗 / 「生焼けで提供できません」/ 焼き加減 / +0 Pitz / 同上の注記 | なし | もう一度試す / レシピを選んで作る（**💡 も 📓 もなし**） |

ヒントシート（ORIGINAL から開いた場合、両方）: 「今の材料で、まだ見つけていないピザが作れそう！」（`HINT_EXISTENCE_TEXT`）、Hint 5.0 の最初の段（ソース、10 Pitz）、「📓 試作ノートを見る」。Research ではさらに「わかっていること：✓ …」。

### 構造上の所見

| # | 所見 | 根拠 |
|---|---|---|
| F1 | **標的なし FAILED は出口が「もう一度」「レシピを選ぶ」の 2 つだけ**。ヒントにもノートにも行けない。画面下半分は空白（390×844 で約 290px） | `ResultPanel.tsx` の FAILED 分岐に `hintRow` が無い（`hintRow` は ORIGINAL 分岐 L433 と ALREADY_DISCOVERED のみ） |
| F2 | **Research FAILED にも 💡 が無い**（ノートはある） | 同上 |
| F3 | 標的なし ORIGINAL の注記は説明だけで、次の行動（ヒント / ノート）を指さない。Research の注記（`resultNote`）は指す | `researchUxCopy.ts` と `ResultPanel.tsx` の `original-pizza__note` |
| F4 | 標的なし ORIGINAL から**ノートへ直接行けない**（ヒントシート経由のみ） | 画面の出口一覧 |
| F5 | FAILED の理由は固定 3 文のみ（生焼け / 焦げ / 材料なし）。実行の失敗で、レシピ依存の文言は構造上出ない（Free Cook は recipe-free sentinel で判定される。#472 Result） | `gameReducer.failedResearch.test.ts` の固定化 |
| F6 | 標的なし Free Cook に入るのは「cookable な Research Entry が 0 件」のとき（HOME「レシピ発見」、OD-RB-1 更新）。Pizza Select「レシピ発見へ」も同じ分岐。つまり**標的なしの失敗画面を見るのは、研究できるピザがまだ無い段階の人が中心** | `TETO_ANTI-ORACLE-CONTRACT_2.1.md` OD-RB-1 更新 |
| F7 | `executionAdvice` は「ソースが少なめかも」のみで、焼きの助言は意図的に無い（recipe の焼き窓を使うと漏れるため）。FAILED の生焼け / 焦げは**汎用の状態**で、recipe の焼き窓を使わない | `executionAdvice.ts` の冒頭、#472 |

## 2. 設計の制約（Gate 条件）

どの候補も次を満たす。実装 PR でテストに固定する。

- G1 文言・DOM・aria・data 属性は、同じ pizza・同じ既知情報で **ORIGINAL 3 outcome（ORDINARY / AMBIGUOUS / INCOMPLETE_MATCH）が byte 同一**（INV-D3）。
- G2 レシピ名・id・候補数・残数・n/m・%・近い/遠い・「あと少し」・「おしい」を出さない。「できている」「合っている」と読める文言を出さない。
- G3 × を永続化しない。新しい保存項目・schema 変更を作らない。
- G4 INV-D7: 「ソースなし」等の直接の「なし」を出さない。
- G5 INV-D5: 量・焼き・配置の失敗を ○× に混ぜない。「× = 足りない」と読める文言を作らない。
- G6 新しい文言は**対象・outcome・プール規模によらず同一**（`RESEARCH_UX_COPY` の規約）。
- G7 新しい判定入力を作らない。表示条件は「プレイヤー自身の入力・結果（bake 状態、使った材料、既存の Research Target の有無）」だけで決める。
- G8 既存の privacy 検証（`researchResultRows.test.ts`、`gameReducer.techniques.privacy.test.ts`、`gameReducer.failedResearch.test.ts`、`ResultPanel.researchFailed.test.tsx`、`originalResultCopy.test.ts`、e2e `discovery3-oracle-neutralization` / `research-failed-trial`）が**無変更で通る**こと。新 UI にも同種の走査を足す。
- G9 OD-P2-5: ORIGINAL の「リード文」は次の行動を含めない（行動は下の行に置く）。

## 3. 候補（文言・導線）と漏えい面の確認

### C1 FAILED 画面に「💡 ヒントを見る」を出す（Research / 標的なし両方）

- 既存の `hintRow(null, true)` と既存文言「💡 ヒントを見る」を再利用する。新しい文言なし。
- 漏えい面: 表示条件は「FAILED であること」だけ。FAILED は bake / 材料なしの汎用理由（F5）で、レシピ identity に依存しない。ヒントシートの中身は ORIGINAL から開いた場合と同じ既存の仕組み。**実装時に、FAILED と ORIGINAL のヒントシートが同じ入力から同じ内容を出すことをテストで確認する**（要検証）。
- 効果: F1 / F2 の「行き止まり」を解消。画面下の空白に収まる（高さの追加コストは実測上ほぼゼロ）。
- 規模: S（`ResultPanel.tsx` の FAILED 分岐に 1 行 + テスト）。

### C2 標的なし ORIGINAL にも「📓 試作ノート」を出す

- 既存の `onOpenAttemptLog` を標的なしにも出す。ヒントシートの「📓 試作ノートを見る」と同じノート。
- 漏えい面: ノートはプレイヤー自身の試作記録と既知情報のみ（セッション限定）。標的なしでは ○× が無いので内容は「作った材料の記録」。新情報なし。
- 注意: 標的なしのノートに何が入るかの現状（空になる場合の見え方）は**未確認**。実装前に確認が要る。
- 規模: S〜M（`GameScreen` の配線 + ノートの空状態の確認）。

### C3 標的なし ORIGINAL の注記を、次の行動を指す固定文にする

- 候補文言（Research の `resultNote` と同じ形式。全 outcome・全プレイヤー同一）:
  - 候補 a: 「ヒントや試作ノートを見て、次に試す材料を考えてみよう。」
  - 候補 b: 「ヒントを見ながら、次に試す材料を考えてみよう。」（C2 を採らない場合）
  - 現行: 「図鑑のピザと同じ組み合わせで作ると「発見」＆Pitzがもらえるよ。」（発見の仕組みの説明。残す選択肢もある: 両方を 2 行にすると画面が伸びる）
- 漏えい面: 固定文で、材料・件数・近さを含まない。ただし「次に試す材料を考えよう」は ○× が出ない画面では**約束**に見えうる（標的なしでは判定が出ないため）。「見ながら考える」はヒント・ノートを手がかりにする表現で、判定の約束ではない。
- 規模: XS（文言 + 既存テスト `originalResultCopy.test.ts` / `ResultPanel.test.tsx` の更新）。

### C4 FAILED 画面の汎用の焼き助言（固定文）

- 例: 生焼け →「もう少し長く焼いてみよう」、焦げ →「焼きすぎに気をつけよう」。同じ汎用状態から出す固定文（`executionAdvice` の焼き版）。
- 漏えい面: FAILED の生焼け / 焦げは汎用の状態（F7）で、レシピの焼き窓を使わない。**だが** `executionAdvice.ts` は「焼き助言は意図的に出さない」と明記しており、これは過去の Owner 決定（OD-D3-23）の再検討になる。Free Cook の汎用焼き窓と recipe の窓が一致しない場合、「ちょうど良い」と読める助言が recipe 固有の合否と食い違い、**間接的に**窓の情報を与えうる。実装前に OD-D3-23 の根拠の再確認が必須。
- 規模: S〜M。**推奨度は低い**（C1〜C3 を先に）。

### C5 標的なし → Research への橋渡し CTA（「ピザ図鑑で研究する」）

- 研究できるピザが（cookable ≥ 1）存在するときだけ、標的なし ORIGINAL / FAILED に図鑑への導線を出す。
- 漏えい面: **存在の有無を伝える**（件数ではない）。ただし F6 のとおり、HOME は cookable ≥ 1 なら標的なしを開始しないので、標的なしの画面に来る人は通常 0 件で、この CTA は出ない。出るのは Pizza Select 経由など限られた経路で、効果が小さく、OD-RB-1 更新が「標的なしの逃げ道を設けない」とした方針と衝突する。
- 規模: M。**非推奨**（Owner が方針を変える場合のみ）。

### C6 連続して ORIGINAL が続いたときのやさしい声かけ（セッション内のみ）

- 例: 同じ画面で ORIGINAL が数回続いたら「ヒントを見てみよう」を前面に出す。
- 漏えい面: 判定入力はプレイヤー自身の試作回数のみで、レシピに依存しない。ただし**回数を保存する**と G3 に触れる。セッション限定（既存の Trial Notebook のセッション記録を使う）が条件。「N 回目」を表示しない。
- 規模: M。しきい値は Owner 決定。優先度は低い。

### 採用しない（禁止）案

- 「あと少し」「おしい」「近い」「遠い」「N 個合っている」「あと N 種類」: Contract 2.1 / OD-D3-20 で禁止。
- 失敗の「原因」を材料で示す（「チーズが足りない」等）: INV-D5 / INV-D7。
- 発見済みレシピを使った助言（「〇〇に似ているね」）: 類似度。

## 4. 推奨（助言）

1. **C1 + C3 を最優先**（どちらも既存の文言・部品を再利用し、漏えい面が小さく、画面高さのコストがほぼ無い）。
2. **C2 は C3 とセット**（注記がノートを指すなら出口が必要）。標的なしノートの空状態を先に確認する。
3. C4 は OD-D3-23 の再確認後、C5・C6 は Owner の方針が変わる場合のみ。
4. 実装は 1 PR（C1〜C3）にまとめても、C1 と C3 を別 PR にしてもよい。いずれも `ResultPanel.tsx`・`researchUxCopy.ts`・`originalResultCopy.ts` を触る（`App.css` は FAILED の行間調整が要る場合のみ。HOT）。

## 5. Owner 決定事項

| ID | 決定 | 選択肢 |
|---|---|---|
| OD-DF-1 | FAILED 画面（Research / 標的なし）に「💡 ヒントを見る」を出すか（C1） | 出す（推奨）/ 出さない（FAILED は「作り直す」に集中させる） |
| OD-DF-2 | 標的なし ORIGINAL にノートへの直接導線を出すか（C2） | 出す / 出さない（ヒントシート経由のまま） |
| OD-DF-3 | 標的なし ORIGINAL の注記（C3） | 現行維持 / 候補 a / 候補 b / 現行 + 新文の 2 行 |
| OD-DF-4 | FAILED の汎用焼き助言（C4）を検討するか | 検討しない（推奨）/ OD-D3-23 を再確認してから |
| OD-DF-5 | 標的なし → 図鑑の橋渡し（C5）を許すか | 許さない（推奨。OD-RB-1 更新を維持）/ 許す |
| OD-DF-6 | 連続 ORIGINAL の声かけ（C6）をやるか。やる場合のしきい値 | やらない（推奨）/ やる（セッション限定、N = Owner 指定） |
| OD-DF-7 | `HINT_EXISTENCE_TEXT`「今の材料で、まだ見つけていないピザが作れそう！」の扱い | 現状維持 / 別 Issue で再監査（所持材料から導出される既存文言で、本 Issue では変更しない。Contract 2.1 以前からの仕様のため注記のみ） |
| OD-DF-8 | HV の範囲 | 実装 PR で 390×844 動画 + 4 画面の前後スクリーンショット（ポリシーどおり） |

## 6. 実装時の影響（参考。本 Gate では触れない）

- 変更予定: `src/components/ResultPanel.tsx`、`src/components/researchUxCopy.ts`、`src/state/originalResultCopy.ts`（C3 の場合）、`src/screens/GameScreen.tsx`（HOT、C2 の配線）、テスト（上の G8）。
- #673（`IngredientGlyph.tsx`・`lateCatalog.ts`・`ingredients.ts`・goldens）、#674（`persistence.ts`）とはファイルが重ならない。`deductionGuard.gate.test.ts` 系の件数 pin は本件で動かない。
- 同じ `ResultPanel.tsx` を触る他の進行中 PR は、確認した範囲では無い（open PR の変更ファイルは全件は確認していない）。
