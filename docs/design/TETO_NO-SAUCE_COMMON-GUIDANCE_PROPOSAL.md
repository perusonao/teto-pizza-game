# NO_SAUCE 共通案内 — N-A の条件付き採用と追加検証計画（docs-only、実装なし）

Status: **Owner 決定（2026-10-31）: N-A「塗らずに 次へ 進んでもOK」を条件付き採用。INV-D4 / INV-D7 の追加検証が必要。** 本書は検証計画と未決事項の整理で、**実装はしない**。実装 Issue は Owner が起票する。
Refs: Issue #712、Anti-Oracle Contract 2.1（[`TETO_ANTI-ORACLE-CONTRACT_2.1.md`](../decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md) §13.1 ほか）、Fresh Audit E-5。Base: `main` `d044719`。

## 1. 守る契約
- **INV-D7（直接の「なし」を出さない）**: パネル・aria・Notebook・保存のどこにも「ソースなし」「ソース不要」「ソース：なし」に相当する表現を置かない。Notebook の試作にも適用（OD-TQ1D-4）。技法名「ソースなし」は**発見後にだけ**（RESULT の技法段と Dex の「調理法」）。
- **INV-D4（target 非依存）**: 表示は対象レシピに依存しない。NO_SAUCE のレシピにだけ出る／消える案内は hidden property の漏洩。
- count・distance・similarity・Near / Far の禁止、× の永続化の禁止。技法の謎かけ（`techniques.ts`: 「いつもの“ぬるもの”がなくても…？」）の答えの先取りの禁止。

## 2. 文言の確認（本番テストの禁止表現に当てた結果）
禁止表現: `gameReducer.techniques.privacy.test.ts` の `ABSENCE` = `/ソースなし|ソース不要|ソースを使わ|ソースがない|ソース[:：]\s*なし|sauce-?less|no-sauce|NO_SAUCE|調理法|ぬるもの/i`、および `TechniqueUi.test.tsx` 等の `/ソース\s*[:：]\s*なし|ソースなし|ソース不要/`。

| 文言 | ABSENCE | 技法の表現 | 扱い |
|---|---|---|---|
| **N-A** 塗らずに 次へ 進んでもOK | 該当せず | 該当せず | **条件付き採用** |
| N-B ソースは 塗らなくても 次へ すすめるよ | 該当せず | 該当せず | 語は通るが意味が「ソース不要」に近い。不採用寄り |
| N-C ピザによっては、使わない材料もあるよ | 該当せず | 該当せず | 一般的。SAUCE 工程に結びつきにくい |
| N-D この工程は、何も置かずに 次へ 進んでもOK | 該当せず | 該当せず | **全工程共通版**（より中立。UI の変更範囲は広い）。N-A が契約の解釈で通らない場合の代替 |
| 「ぬるものは お好みで」「ソースを使わないピザもあるよ」「ソースなしで進みます」「調理法はひみつ」 | 該当 | — | 不採用 |

## 3. 条件付きの条件（Owner 確認が必要な事項）
1. **INV-D7 の解釈**: N-A は禁止語を含まず、対象のレシピ・組成にも触れない一般的な許可。ただし契約は「『ソースなし』『ソース不要』に**相当する表現**」を禁じており、「ソースを使わない選択肢の明示」という意味では**趣旨に触れうる**。Owner が「操作の許可は相当する表現に当たらない」と解釈するか、N-D（全工程共通）にするかを決める。
2. **漏れる情報の量**: 案内が与える新しい情報は「SAUCE 工程を塗らずに進める」というメタ情報のみ（「次へ」は現状でも押せる）。技法の謎かけ（Dex の「調理法」）が既に存在を示唆している。
3. **表示場面**: Free Cooking と Research の SAUCE 工程（モードはプレイヤーの選択で、レシピに依存しない）。Guided（レシピ指定）では案内しない案を第一とする。

## 4. 追加検証の計画（実装時に固定するテスト）

| # | 検証 | 契約 | 方法 |
|---|---|---|---|
| T1 | 案内の DOM（テキスト・属性・aria）が、`RECIPES` の**全 target で同一** | INV-D4 | Free Cooking / Research の SAUCE 工程を、全 recipe を target にして描画し、案内ノードの `outerHTML` を比較（`researchResultRows.test.ts` の Gate A と同じ型） |
| T2 | 技法の発見状況・Dex・Hint・Research の進行で**出し分けない** | INV-D4 | `no-sauce` 発見前後、Dex 空 / 全発見、Hint 購入前後で同一 DOM |
| T3 | 案内の文字列と、SAUCE 工程の画面全体（aria-label を含む）が `ABSENCE` と技法の語（`TECHNIQUES` の id・nameJa・riddleJa）に**該当しない** | INV-D7 | 文字列テスト（`privacy.test.ts` と同じ正規表現を共有化） |
| T4 | 案内が、行・Notebook・保存された facts・Research エントリ・Hint 5.0 ビューに**出ない**（`JSON.stringify` の走査） | INV-D7 | 既存の `gameReducer.techniques.privacy.test.ts` の surfaces 走査を、案内文言を加えて実行 |
| T5 | 既存の契約テストが通る | — | `researchResultRows.test.ts`、`gameReducer.techniques.privacy.test.ts`、`deductionProduction.gate.test.ts`、`hint5Production.gate.test.ts`、`TechniqueUi.test.tsx`、`TrialNotebookSheet.test.tsx` |
| T6 | 案内が aria の live region にならず、フォーカス順を変えない | a11y | 通常のテキストノード |
| T7 | 390×844 / 360×800 でレイアウトが崩れない（折り返し・下部ボタンとの距離） | HV Policy | Chromium E2E＋WebKit CI＋実機 |

注: 既存の走査は、行・Notebook・保存・Research エントリ・Hint ビューが対象で、SAUCE 工程の画面テキストは対象外。したがって T1〜T3・T6 が新規の追加検証になる。

## 5. 影響ファイル（想定）と調整
- `src/screens/GameScreen.tsx`、`src/App.css`（**いずれも HOT**）。claim を投稿する。
- **#489（ソース残量ゲージ）が同じ SAUCE 工程の UI を扱う**ため、置き場所（トレイの下／「次へ」の上）を調整する。
- Pilot E（アイコン）とは独立。実装順序は Owner が決める。

## 6. 実装前の Owner 判断事項
1. INV-D7 の解釈（N-A のまま／N-D に変更）。
2. 表示場面（Free Cooking と Research の両方か）。
3. 文言の最終形（句読点・「OK」の表記）。
4. #489 との置き場所の調整。
