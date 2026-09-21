# Human Verification Policy (Teto Pizza Game)

Status: **SSOT** — durable, cross-session policy.
Path: `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`
Referenced from: root `CLAUDE.md`, `docs/PROJECT_HANDOFF.md`.

## 0. 位置づけ（既存運用との関係）

`docs/PROJECT_HANDOFF.md` の「Preferred workflow」「Standard completion rule」節は、既に

```
Fresh Audit/design → implementation → focused/full tests → typecheck/lint/build →
commit/push → PR → CI → dedicated Preview deployment → Preview smoke test →
targeted 390×844 Review Playthrough → MP4 video output → Human Feel review → merge
```

という完了フローと「390×844を主viewportに、MP4で撮る」「大容量動画はrepositoryへcommitしない
（`artifacts/`・`artifacts/review/`はgitignore済み、動画はユーザーへ直接提出する）」というルールを
既に定めている。本Policyはこの既存運用を**上書きせず**、UI/UX/gameplay変更全般に対して以下を
補完・詳細化するSSOTである。

- 適用対象/適用除外の明確化（§2）
- authority/secondary viewportの明確化（§3、既存の390×844主viewport運用と整合）
- 動画の内容要件・検証要件の明確化（§4, §8 — 既存運用にはなかった具体基準）
- Screenshotとの役割分担（§9）
- Result Reportへの標準セクション（§10）
- Definition of Doneへの統合（§12）

矛盾する場合は、**動画をrepositoryへcommitしない**という既存ルール（`docs/PROJECT_HANDOFF.md`
「Preferred workflow」節）を優先する。本Policyの§6はそれを前提に書かれている。

## 1. 目的

UI・UX・ゲームプレイ変更は、automated tests（unit/e2e）だけで完了判定しない。実装後の状態を
人間が実際に確認できる Human Verification 成果物（screenshot + video）を必ず残す。

## 2. 適用対象

**原則必須**（対象画面・変更のいずれかに該当する場合）:

- UI変更 / レイアウト変更 / viewport変更 / scroll変更 / gesture変更 / animation変更
- ゲームプレイ変更全般（DOUGH / SAUCE / CHEESE / TOPPING / BAKE / CUT / Lunch Rush）
- RESULT / Recipe Select / Shop / Inventory / Dex / Ranking・modal
- その他、人間の操作感や見た目がAcceptance Criteriaになる変更

**原則不要**:

- docs-only の変更
- 内部refactorのみ（見た目/操作が変化しない）
- 見た目/操作が変化しないunit test追加のみ
- Firebase backendのみの変更（UI上の挙動確認がAcceptance Criteriaでない場合）
- CI/workflowのみの変更

backend変更でも、UI上の挙動確認がAcceptance Criteriaに含まれる場合は動画対象とする。

`docs/PROJECT_HANDOFF.md` に既にある「Audit-only tasks are exempt from Preview deployment and
video capture」は本Policyでも継続する（読み取り専用のFresh Auditはdeployするものがない）。

## 3. Authority Viewport

- **Authority（原則必須）: 390×844** — `docs/PROJECT_HANDOFF.md` の既存運用（iPhone Human Feel /
  Review Playthrough）と同一。
- **Secondary: 360×800** — 360×800固有の問題を修正した場合に追加で撮る。

## 4. Video Requirement

実装後、Acceptance Criteriaを実ブラウザ（Preview環境、原則）で操作した動画を残す。

動画には、今回の変更に応じて次を含める（該当するもののみ）:

- 対象画面への到達
- 修正対象の操作（tap / drag / swipe / scroll）
- CTA操作、modal open/close、screen transition
- RESULT到達
- 既存機能のregression確認

単に対象画面を数秒表示するだけの動画は不可。**「この動画を見るだけで、ユーザーが今回の変更を
確認できる」ことを完了条件とする。** 自動テスト用の極端な高速操作ではなく、人間が確認できる速度
（各画面/状態で1〜3秒保持する、`docs/PROJECT_HANDOFF.md`既存運用と同じ目安）で操作する。

Review Playthroughは固定の台本ではなく、その変更が「何を変えたか」「何が壊れうるか」「ユーザーが
実際に見るべきもの」に応じて毎回設計する。

## 5. 保存形式

- 推奨最終形式: **MP4 / H.264**
- 基本解像度: **390×844**
- PlaywrightがWebMを生成する場合は、可能ならffmpeg等でMP4/H.264へ変換する。
- MP4化できない環境ではWebMでも可。その場合はResult Reportに理由を明記する。
- 長さの目安: 1シナリオ30秒〜2分程度。必要以上に長くしない。

## 6. 保存/提出場所

**既存の `docs/PROJECT_HANDOFF.md` 運用をそのまま踏襲する（変更しない）:**

- **動画はrepositoryへcommitしない。** `artifacts/`（`artifacts/review/`含む）は
  gitignore済みであり、動画は常にユーザーへ直接提出する（セッション内でのファイル送付）。
- インタラクティブセッション内で直接提出できない場合（例: GitHub Actions上の自動実行など、
  対話セッションが存在しない文脈）に限り、GitHub Actions Artifactとしてアップロードし、
  それを取得できるActions run URLをDownload手段として報告する。
- 大容量動画を無条件でrepositoryへ入れてrepositoryを肥大化させることはしない（この点は
  「動画は常にcommitしない」という既存ルールの方がより厳格なので、そのまま適用される）。

**Screenshot（静的画像）は既存どおりrepositoryへcommitする:**

- 保存先: `docs/reports/screenshots/<task-name>/`（既存の命名慣習を継続）

## 7. Download Requirement

動画を作成するだけでは完了ではない。ユーザーが実際に取得できるDownload手段まで提供する。
最終報告（Result Report）には必ず次を記載する:

- filename
- 提出方法（セッション内直接提出 / GitHub Actions Artifact）とその参照（Artifactの場合はActions
  run URL）
- viewport
- duration
- file size
- codec
- 何を確認できる動画か

「ローカルPCのpathだけ」を最終成果物にしない。

## 8. Video Validation

作成後、動画自体を検証する。最低限:

- ファイルが存在する
- file size > 0
- 最後まで再生可能
- viewport全体が記録されている
- 対象操作が映っている
- Acceptance Criteriaを人間が判断可能

可能なら `ffprobe` 等で codec / resolution / duration / file size を確認する。

Result Reportへ次の形式で記録する:

```
Video Verification: PASS / FAIL
```

## 9. Screenshots

既存のbefore/after screenshot運用は継続する。役割分担:

| 成果物 | 役割 |
|---|---|
| Screenshot | 静的レイアウト・before/after比較 |
| Video | 操作感・gesture・scroll・transition・一連のゲームプレイ確認 |

UI/UX変更では原則両方を残す。

## 10. Result Report標準

UI/UX/Gameplay実装のResult Reportには、必ず次のsectionを追加する:

```markdown
## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| ... | 390×844 | ... | ... | PASS |

Download: <セッション内直接提出 / Actions run URL>

Video Verification: PASS
```

さらに、「この動画で何を確認すればよいか」を箇条書きで記載する。

## 11. Claude Code / AI agentへの恒久ルール

新しいセッションでも本Policyが確実に参照されるよう、root `CLAUDE.md` に本SSOTへの短い参照のみ
を置く（全文はCLAUDE.mdへ複製しない）。`docs/PROJECT_HANDOFF.md` の「Preferred workflow」節にも
本SSOTへの参照を1行追加する。同じルールを複数ファイルへコピーして将来内容が乖離する構造には
しない。

## 12. Definition of Done

UI/UX/gameplay変更のDefinition of Doneは次のとおり（`docs/PROJECT_HANDOFF.md` の既存
「Standard completion rule」を補完するチェックリスト。本Policyが唯一の定義元であり、別途DoD
ファイルは作らない）:

- [ ] Automated tests PASS
- [ ] Human Verification screenshots
- [ ] Human Verification video
- [ ] Video validation PASS
- [ ] Download link available
- [ ] Result Report updated

## 13. 今後のプロンプト運用

Claude CodeへUI/UX/gameplay実装を依頼するタスクプロンプトには、今回の変更に特化した Human
Verification Scenario を明示する。ただしPolicy全文を毎回コピーする必要はない。代わりに:

```
Follow TETO_HUMAN-VERIFICATION-POLICY (docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md).
```

を必須句とし、今回撮影する具体的シナリオだけをタスクプロンプトへ書く。これによりセッションが
変わっても運用を維持する。

## 14. Changelog

- 2026-09-21: Initial version. `docs/PROJECT_HANDOFF.md` の既存video運用（390×844主viewport /
  MP4 / repositoryへcommitしない）を継承しつつ、適用対象・検証基準・Result Report標準・DoDを
  正式化。
