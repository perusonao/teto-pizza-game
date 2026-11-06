# 新工程 第一候補 — DOUGH_VARIANT（生地の種類）設計・検証計画（#773 / #577、docs-only）

2026-11-06、main `ed159e9`。**Owner 方針: 第一候補として採用、#577 の G5〜G8 は条件を満たすまで HOLD、現時点は設計・検証のみ GO。** 実装・`src/` 変更はしていない。#577 の設計 Gate（`docs/design/TETO_PIADINA-577_DESIGN-GATE_2026-10-26.md`）を置き換えず、その上に「3 値目以降の一般化」を整理する。

## 0. S6（Rev 3）の訂正 — 「9 行」は 1 つの生地では解放されない

S6 で「DOUGH_VARIANT で 9 行」と書いたが、9 行の生地は **7 種類に分かれる**（マトリクスの `dough.variant`）。**3 値目（piadina）1 つで解放されるのは 1 行**。

| 生地（matrix variant） | レシピ | 状態 | 新食材 |
|---|---|---|---|
| `flatbread-unleavened`（無発酵の平焼き） | piadina-romagnola | **READY** | 0 |
| `roman`（ローマ風） | pizza-carciofi-salad・pizza-cicoria-limone・pizza-puntarelle | BLOCKED（後乗せ解釈・未解決語） | 1〜2 |
| `flatbread-pita-soft` | manakish | READY | 2（halloumi・zaatar） |
| `thick`（厚め） | poutine-pizza | READY | 3 |
| `fluffy`・舟形 | turkish-pide | BLOCKED（ひき肉・チーズ） | 0（形状も要る） |
| `flatbread-ultra-thin-crisp` | lahmacun | BLOCKED | 0 |
| `material-cookie` | fruit-dessert | BLOCKED | 3 |

**含意:** 価値は「3 値目」ではなく **「生地の種類を N 値に一般化する仕組み」**。1 値ごとの追加コストを下げる設計にすれば、READY の piadina（新食材 0）→ manakish → poutine の順に積める。ただし各値ごとにレシピ・識別・Anti-Oracle の検証が要る。

## 1. 現状（実コード）

- `DoughKind = "standard" | "material-multigrain-long-ferment"`（`src/logic/dough/doughKind.ts:12`）。2 値をリテラルで比較。
- 生地チップ（`DoughKindSwitch.tsx`／`doughSwitch.ts`）は「ふつうの生地／ほかの生地」の 2 択で、Pinsa の技法 affordance 1 つから表示条件を導出。
- `pendingRound.ts` は `dough` を `isDoughKind` で検証し、未知値は「処理不能」。

## 2. G5〜G8 — HOLD を解く条件（#577 Gate を引用し、一般化の観点を追加）

| Gate | 論点 | 解除の条件（提案） | 検証方法 |
|---|---|---|---|
| **G5 Anti-Oracle** | 3 値以上で、チップの数・開く時期・ラベルが「他の生地がある」「どのレシピか」を漏らす | Owner が D-P1（A：常時表示／B：「ほかの生地」1 個→開いて選ぶ／C：発見済みのみ名前）を選ぶ。**一般化の観点では B が最も安全**（値が増えてもチップは 2 個のまま）。開く条件は「いずれかの生地技法の affordance」に統一 | DH4 の掃引（`GATE_STATES`）に生地 3 値を加えて再実行。DOM の `data-dough-choice` が順序・種類を漏らさないことの構造テスト |
| **G6 保存互換** | 旧ビルドで `pendingRound.dough` の未知値が処理不能 | Owner が D-P4 を選ぶ。**一般化するなら (c)「未知の生地値は保持し、旧ビルドは standard とみなして中断ラウンドを捨てずに扱う」**が必要（値が増えるたびに旧ビルド問題が再発するため）。`pendingRound.ts` は HOT＝別 Issue | 旧版の保存の往復テスト（persistence の既存方式） |
| **G7 工程** | 投入時機（焼成前のみ／後乗せ） | piadina は原典に時機の記載なし。**案 P（全て焼成前）なら late と独立**に進められる。案 F は late（第 2 候補）の完成待ち | Owner の選択（D-P3） |
| **G8 原典** | 比較表のみ。個別ページ未確認 | B16〜B19 と同じく「暫定・原典未確認」を Owner が承認すれば解除 | Owner 判断 |

## 3. 設計・検証として今できること（Owner の GO の範囲）

| タスク | 範囲 | ファイル |
|---|---|---|
| V1 N 値化の設計書 | `DoughKind` を値の表（id・表示名・技法 id・公開ゲート）に一般化する案。リテラル比較の箇所の洗い出し | docs のみ |
| V2 漏えい面の洗い出し | `DoughKindSwitch.tsx`・`doughSwitch.ts`・`detection.ts`・Hint 経済シミュレータ（`discoveryHintEconomySim`／`hint5EconomySim`／`researchAttemptSim`）の生地の扱いを一覧 | docs のみ |
| V3 保存互換の試験計画 | (a)/(b)/(c) の比較、旧ビルドの往復テスト案 | docs のみ |
| V4 未配線プロトタイプ（任意・別承認） | `src/logic/dough/` に新規ファイルで N 値の表と純粋関数（未配線） | 新規のみ（#577 の claim 確認後） |

V1〜V3 は本ブランチの新規 docs（`TETO_NEW-PROCESS_*`、#773 の claim 範囲）で進める。V4 は Owner の別 GO。

## 4. 他の作業との独立性

`doughKind.ts`・`DoughKindSwitch.tsx`・`pendingRound.ts`・`detection.ts` を触る open PR は**無い**（open PR 一覧で確認）。STEAM（#738）・FRY（#749）・late の HOT（`PizzaStage.tsx`・`GameScreen.tsx`・`gameReducer.ts`）と重ならない。カタログ（`recipes.ts`）は各レシピ PR で S1 の lane に入る。

## 5. 計上

Owner 方針により、**DOUGH_VARIANT は「追加調理方法」とは別管理**（新工程として、通常プレイで使えるようになった生地の数を数える）。
