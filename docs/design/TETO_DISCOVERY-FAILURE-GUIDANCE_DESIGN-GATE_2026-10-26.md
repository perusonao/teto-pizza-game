# 発見失敗後の案内 — 設計 Gate（Issue #676、docs-only）

Status: **監査と設計のみ。** `src/**`・`e2e/**`・CSS・テスト・golden・データ・workflow・本番スイッチ・共有 Preview・Production・Firebase は無変更。merge・deploy・CI 再実行・Monitor 作成なし。
基準 `main` = `28f04f4`（2026-10-26）。関連: #358（Contract 2.0 時代の UX。PR #359 は closed）、#360、#544、#472（Research FAILED 文言・実装済み）。
**「推奨」は助言であり Owner Decision ではない。未回答を承認済みとみなさない。**
守る契約: `docs/decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md`（INV-D1〜D7、OD-RB-1〜19）。count / distance / similarity / Near・Far の禁止、× の永続化禁止、ORIGINAL 3 outcome の byte 同一、INV-D7（直接の「なし」を出さない）、INV-D5（実行の失敗を ○× に混ぜない）は**全て維持**する。

## Owner 方針（2026-10-26 反映）

Owner は本 Gate を受けて次を決めた（Issue #676 に記録）。**実装は含まない。** 以降の §3〜§5 の候補分析は判断材料として残し、採否は §5 の表に反映した。

| 候補 | 採否 | 備考 |
|---|---|---|
| **C1** FAILED 画面に「💡 ヒントを見る」 | **採用** | 受け入れ条件は §7 |
| **C3** 標的なし ORIGINAL の注記を次の行動を指す固定文に | **採用** | 文言は §6.3（C2 を見送るので、試作ノートに触れない案 b を作業案とする。Owner 確認が残る） |
| C2 標的なし ORIGINAL にノート直接導線 | 見送り | |
| C4 FAILED の汎用焼き助言 | 見送り | OD-D3-23 を再検討しない |
| C5 標的なし → 図鑑の橋渡し | 見送り | OD-RB-1 更新を維持 |
| C6 連続 ORIGINAL の声かけ | 見送り | |

追加の指示: **標的なし Free Cook のヒント内容を先に設計する**（§6）。Anti-Oracle、Contract 2.1、INV-D7 は維持。390×844 / 360×800 と privacy テストの受け入れ条件を確定する（§7）。

### 訂正（本調査で見つけた誤り）

初版の §0〜§1 は、標的なし Free Cook を**テスト用フック**（`startTargetlessFreeCook`）で開始し、Research Entry が 1 件ある保存で撮った。本番の HOME「レシピ発見」は cookable な Research Entry が 1 件以上あるとそれを研究として開始する（OD-RB-1 更新）ので、**本番の標的なしは Research Entry が 0 件の段階（新規・初期）に限られる**。したがって:

- RESULT 画面の**構成**（見出し・ボタン・○× の有無）は同じ `ResultPanel` なので有効。
- 初版で示した「標的なしのヒントシートに Hint 5.0 の梯子（ヒント1: ソース 10 Pitz）が出る」は**本番で標的なしから見える内容ではない**（フック環境の再現）。本番で到達できる状態は §6.1 で撮り直した。

## Owner 判断（2026-10-27 反映）

- **C1 と C3 を実装候補として確定**（実装の開始ではない）。**C3 の文言は確定:** 「ヒントを見ながら、次に試す材料を考えてみよう。」（§6.3 の案 b。現行の注記は置き換える）。OD-DF-3 は解決。
- 標的なし Free Cook でヒントシートが使えること、表示条件、レイアウト予算は **実装前 Gate**（`TETO_DISCOVERY-FAILURE-GUIDANCE_C1-C3_PRE-IMPLEMENTATION-GATE_2026-10-27.md`）で確認・設計した。
- `handleRetryWithHint` を優先して使い、Contract 2.1、INV-D7、AC-P1〜P6 を維持。C2・C4〜C6 は見送りのまま。
- 未確認の状態では runtime を実装しない（Gate §5）。

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

## 5. Owner 決定事項（2026-10-26 更新）

| ID | 決定 | 状態 |
|---|---|---|
| OD-DF-1 | C1 FAILED に「💡 ヒントを見る」 | **採用** |
| OD-DF-2 | C2 標的なし ORIGINAL にノート導線 | **見送り** |
| OD-DF-3 | C3 標的なし ORIGINAL の注記 | **確定（Owner 2026-10-27）: 「ヒントを見ながら、次に試す材料を考えてみよう。」。現行の注記は置き換える** |
| OD-DF-4 | C4 焼き助言 | **見送り** |
| OD-DF-5 | C5 図鑑への橋渡し | **見送り** |
| OD-DF-6 | C6 連続 ORIGINAL の声かけ | **見送り** |
| OD-DF-7 | `HINT_EXISTENCE_TEXT`「今の材料で、まだ見つけていないピザが作れそう！」の扱い | **未回答（残る）。本 Issue では変更しない** |
| OD-DF-8 | HV の範囲 | 実装 PR で 390×844 動画 + 4 画面の前後スクリーンショット（ポリシーどおり）。§7.4 |

## 6. 標的なし Free Cook のヒント内容（先に設計）

### 6.1 C1 が開くシートは何か（コードで確認）

FAILED / ORIGINAL の「💡 ヒントを見る」は、シートを直接開くのではなく **`handleRetryWithHint`（`App.tsx`）= `RETRY_SAME_RECIPE` + `SHOW_HINT`**（新しい Free Cook ラウンドを始め、PREPARE でヒントシートを開く）。シートの対象は「今日の対象」（`hintTarget`: プールの状態で決まる）で、**直前の試作の結果（ORIGINAL / FAILED の種別、使った材料）を読まない**。Research の場合は研究対象が `carryOf` で引き継がれる。つまり C1 は、FAILED でも ORIGINAL と**同じ入力から同じシート**を出す。`SHOW_HINT` は PREPARE の Free Cook でしか効かない（`gameReducer.ts`）ため、RESULT で直接シートを開く経路は無い。

### 6.2 本番で到達できる標的なしの状態と、シートの内容（実画面で撮り直し、390×844）

`docs/reports/screenshots/discovery-failure-guidance/prodstates-390x844.json`（HOME「レシピ発見」→ ヒント。テストフックなし）と `hintstates-*.json`。

| 状態（本番での入り方） | シートの内容（固定文。対象・件数・材料名を含まない） | 取得 |
|---|---|---|
| 新規保存（図鑑 0/68、Dex 0 の onboarding） | 「今の材料で、まだ見つけていないピザが作れそう！」/「次のヒントを見る」/「✨ はじめてのピザはヒント無料！」/「自分で見つけたいときは、閉じてね。」 | 実画面 |
| 図鑑にマルゲリータだけ、ショップに新材料あり（SHOP_NEW） | 「🏪 ショップに入荷した材料で、新しいピザが作れそう！」/「ホームのショップで、新しい材料をチェックしてみよう。」 | 実画面 |
| 材料の在庫なし（REFILL） | 「📦 材料が足りないみたい。」/「ホームのショップで、持っている材料を補充しよう。」 | コードの文言（`HintSheet.tsx` `EMPTY_COPY`）。実画面は SHOP_NEW が先に出て再現できず |
| 発見できるピザが複数あり、研究対象なし（OPEN_POOL） | 「🎨 まだ発見できるピザがあるよ！」/「いろいろな材料の組み合わせで、レシピ発見を試してみよう。」+「📓 これまでの試作は、上の「試作ノートを見る」で見返せるよ。」 | コードの文言。実画面は未取得（Research Entry が 2 件以上ある保存では CHOOSE_RESEARCH が出るため） |
| 図鑑コンプリート（COMPLETE） | 「🏆 図鑑コンプリート！」/「ぜんぶのピザを見つけたよ。好きなピザを作ろう！」 | 実画面 |
| （参考）Research Entry 2 件以上 | 「🔎 研究するピザを選ぼう」/ 図鑑から選ぶ案内 /「🔎 研究するピザを選ぶ」 | 実画面（標的なしからは通常来ない） |

どの状態も、ヘッダーに「📓 試作ノートを見る」「閉じる」がある。

### 6.3 設計判断（作業案。Owner 確認が残るもの）

1. **シートの内容は変えない。** C1 は入口を足すだけで、上表の固定文をそのまま使う。新しい文言は C3 の 1 文だけ。
2. **C1 の位置と動作:** FAILED カードに既存の `hintRow(null, true)`（`.result-near-miss`、ボタン文言「💡 ヒントを見る」）を ORIGINAL と同じ位置関係で置く。クリックは既存の `onShowHint`（= `handleRetryWithHint`）で、**新しい action・reducer 変更なし**。FAILED には「もう一度試す」もあり、ヒント付きの再開が 2 つ並ぶことになるが、ORIGINAL でも同じ構成なので揃える。
3. **C3 の文言（Owner 確定 2026-10-27）:** 「ヒントを見ながら、次に試す材料を考えてみよう。」
   - C2 を見送るので、RESULT から試作ノートへの直接導線は無い。案 a（「ヒントや試作ノートを見て…」）は、画面に無い導線を指すため採らない。
   - 標的なしでは ○× が出ないため、「判定がわかる」と読める語を避けた（「見ながら考える」は手がかりにする表現）。
   - 現行の注記「図鑑のピザと同じ組み合わせで作ると「発見」＆Pitzがもらえるよ。」は**置き換える**（1 行のまま。高さを増やさない）。2 行併記は縦に伸びるため採らない。**Owner が「現行文を残す」「2 行併記」を選ぶ場合は §7.1 の余白で再確認する。**
   - Research の注記（`resultNote`）は変更しない。
4. **対象範囲:** C3 は標的なし ORIGINAL（ORDINARY / AMBIGUOUS / INCOMPLETE_MATCH を含む）のみ。FAILED、ALREADY_DISCOVERED、NEW_DISCOVERY、Dinner / Lunch Rush は不変。

## 7. 受け入れ条件（確定）

### 7.1 レイアウト（390×844 と 360×800、Chromium。WebKit は CI）

現行の余白（実測、RESULT のコンテンツ末尾からボタン列の上端まで、`capture.spec.ts`）:

| 画面 | 390×844 | 360×800 |
|---|---|---|
| Research ORIGINAL | 138px | 94px |
| Research FAILED（最も詰まる） | **117.8px** | **73.8px** |
| 標的なし ORIGINAL | 278px | 234px |
| 標的なし FAILED | 295px | 251px |

追加する行（ヒントボタン 36px + 行間）は約 48px 以下。基準:

- **AC-L1** どの画面も、ページの縦スクロールが増えない（`scrollHeight == innerHeight`）、横オーバーフローなし。
- **AC-L2** 追加後も、**Research FAILED 360×800 で、コンテンツ末尾とボタン列の間が 16px 以上**残る（現行 73.8px − 約 48px ≒ 25px の見込み。割る場合は設計の見直し）。
- **AC-L3** 新しい行のボタンは高さ 36px 以上（ORIGINAL と同一クラス `.result-near-miss__cta`）で、ボタン列と重ならず、タップ領域が隣のボタンと重ならない。
- **AC-L4** C3 の文言は 1 行（390）〜 2 行（360）に収まり、既存の注記と同じ高さ予算を超えない。

### 7.2 privacy テスト（Anti-Oracle / Contract 2.1 / INV-D7）

既存の検証が**無変更で通る**こと: `researchResultRows.test.ts`、`gameReducer.techniques.privacy.test.ts`、`gameReducer.failedResearch.test.ts`、`ResultPanel.researchFailed.test.tsx`、`ResultPanel.research.test.tsx`、`originalResultCopy.test.ts`、e2e `discovery3-oracle-neutralization` / `research-failed-trial` / `discovery-near-miss-result`。加えて新規に:

- **AC-P1（C1 の入力非依存）** FAILED から「ヒント」を開いた直後の状態（`hintSession` / `hintSheetView` / 開いたシートの DOM）が、**同じ保存・同じ対象で ORIGINAL から開いた場合と同一**であること（reducer テスト + e2e）。
- **AC-P2（FAILED カードの不漏えい）** 新しい行を含む FAILED カードの text / DOM / aria に、レシピ名・id、使っていない材料名、件数、% が出ない（`research-failed-trial` の走査を、行の追加後も維持）。`data-kind|outcome|candidate|target|recipe` 属性が無い。
- **AC-P3（C3 の固定性）** C3 の文字列は定数 1 つで、ORDINARY / AMBIGUOUS / INCOMPLETE_MATCH の標的なし ORIGINAL で **DOM が byte 同一**（`originalResultCopy.test.ts` の既存比較に含める）。文字列に数字・材料名・ファミリー名を含まず、禁止語 `あと|おしい|近い|遠い|惜|合って|できて|ほぼ|\d+(種|個|件|%)` を含まない（テストで固定）。
- **AC-P4（INV-D7）** 新しい文言・DOM に「…なし」「…不要」等の直接の「なし」表現がない。FAILED に ○× が出ない標的なしで、○× の欠如を説明する文を足さない。
- **AC-P5（見送り候補の非実装）** 標的なし ORIGINAL に「📓 試作ノート」ボタンが**無い**、FAILED に焼き助言文が**無い**、標的なし RESULT に図鑑への橋渡しボタンが**無い**ことを、否定テストで固定する（C2・C4・C5 の再導入を検知）。
- **AC-P6（不変）** Research ORIGINAL、ALREADY_DISCOVERED、NEW_DISCOVERY、Dinner / Lunch Rush の RESULT の DOM が byte 同一（本番 DOM golden の再基準化を要しない範囲。要する場合は理由を実装 PR に明記）。

### 7.3 動作

- **AC-B1** FAILED の「ヒントを見る」は `handleRetryWithHint` と同一の動作（新ラウンド + シート）。Research FAILED では研究対象が維持され、シートに研究文脈が出る。標的なしでは §6.2 の状態に応じた固定文が出る。
- **AC-B2** 在庫・Pitz・保存・Dex・Notebook・採点に変更がない（新しい dispatch・保存項目なし）。ヒントの購入は従来どおりシート内の操作でのみ発生する。

### 7.4 Human Verification（`TETO_HUMAN-VERIFICATION-POLICY.md`）

実装 PR で 390×844 の動画（直接提出、repo に含めない）と、前後スクリーンショット（`docs/reports/screenshots/<task>/`、390×844 と 360×800 の 4 画面: Research FAILED、標的なし FAILED、標的なし ORIGINAL、Research ORIGINAL（不変の確認））。動画の流れ: FAILED → 「ヒントを見る」→ シートが開く → 閉じる → もう一度試す。

## 8. 実装時の影響（参考。本 Gate では触れない）

- 変更予定: `src/components/ResultPanel.tsx`、`src/components/researchUxCopy.ts`、`src/state/originalResultCopy.ts`（C3 の場合）、`src/screens/GameScreen.tsx`（HOT、C2 の配線）、テスト（上の G8）。
- #673（`IngredientGlyph.tsx`・`lateCatalog.ts`・`ingredients.ts`・goldens）、#674（`persistence.ts`）とはファイルが重ならない。`deductionGuard.gate.test.ts` 系の件数 pin は本件で動かない。
- 同じ `ResultPanel.tsx` を触る他の進行中 PR は、確認した範囲では無い（open PR の変更ファイルは全件は確認していない）。
