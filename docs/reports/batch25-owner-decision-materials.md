# Batch 25 — Owner 判断資料（M-2／B-1／B-2）と M-1 の実装結果

HEAD: 本文書の commit。基準ブランチ `claude/teto-batch-25-continuation-mcuqyq`。#856・#857・#858 は Draft／HOLD。**この文書の項目は、承認なしにはどれも実装していません。**
根拠にした Owner 記録: `docs/reports/TETO_T25-R2C_OWNER-DECISION-TABLE_2026-11-15.md`（`origin/codex/t25-preflight-ledger`、以下「決定表」）と `docs/reports/TETO_T24-T26_OwnerDecisions-Followup_2026-11-10.md`（以下「追加判断書」）。

## M-1（承認済み・実装済み）: HintSheet の誤検知の最小修正
- 原因: 画面の「サワークリーム（購入済み）」と隣の見出し「チーズ」が `surface()` で区切りなしに連結され、「クリームチーズ」が偶然一致していた。ヒントの漏れではない。
- 修正: `src/components/testSupport/leakCheck.ts` の `leakedOccurrences`。未購入の名前の出現が、**購入済みの名前の内側から始まる場合に限って**許容し、それ以外（単独、要素をまたぐ、購入済み名の外から始まる）は全て漏れとして検出する。判定の対象や網羅性は変えていない。
- 回帰テスト: `leakCheck.test.ts`（許容の 1 ケースと、漏れとして報告し続ける 4 ケース）。`HintSheet.hint5.test.tsx` 15 件が PASS。

## M-2: Phase-2 BLOCKED 行 5 target と既存承認の対応表（**BLOCKED 解除は未承認。`SHIPPED_KEEP` への自動変更はしていない**）
前提（実測）: `phase2RowClassification()` で、T25 の 6 target のうち **5 つが BLOCKED**。残る pizza-salad（`pizza-salad-pizzadb-p7`）は `EVIDENCE_READY_TARGET` で、この問題の対象外。
現状の失敗: `matcher.test.ts:278`（5 行が「ownerApproved」に載っていない）と `discoveryCatalog.test.ts:80`（buffalo-cauliflower が Phase-2 の SHIPPED_KEEP 表にない）。どちらも**期待値を変えず失敗のまま**にしてある。

| target（evidenceId） | Phase-2 の分類とブロック理由 | 実装の解決方法（出荷コード） | 既存の Owner 承認（決定表） | **承認されていない部分（ギャップ）** |
|---|---|---|---|---|
| swedish-kebab-pizza（…-p4） | BLOCKED_EVIDENCE: BASE_SAUCE_UNSPECIFIED + UNRESOLVED_INGREDIENT（未解決トークン: 「肉」） | `sauceBase: [kebab-sauce]`、新 sauce kebab-sauce。**出荷レシピは kebab-sauce 1・mozzarella 3・lettuce 2 で、肉の材料を含まない**（未解決の「肉」は省略されている） | I-4（kebab-sauce `#d86a35`・既存 PAINT）承認。L-2（step 97）再承認。追加判断書 §G4 は「推奨: 承認」 | 「ベースソース未特定の行を kebab-sauce で解決して出荷する」ことを明示した Owner 文言はない（I-4 は色と PAINT の承認）。**未解決トークン「肉」を、肉なしで出荷してよいかの明示承認も見つからない**（決定表・追加判断書とも、該当の記載なし） |
| banh-mi-pizza（…-p6） | BLOCKED_EVIDENCE: BASE_SAUCE_UNSPECIFIED | `sauceBase: []`（NO_SAUCE）、late で POST_BAKE なし | L-1（banh-mi のみ late 例外・架空 FINISH 禁止）承認。L-3（step で daikon + liver-pate 同時）承認。I-3（daikon）・I-6（liver-pate＝topping／meat）承認 | **NO_SAUCE にすること自体は決定表に承認行がない**。追加判断書 §承認表は「25-2 banh-mi の NO_SAUCE は**未承認**（原典調査後に再判断）」。決定表 §5 は「SAUCE を持つのは将来別途承認されたベースを選ぶ場合のみ」とだけ記載 |
| buffalo-cauliflower-pizza（…-p6） | BLOCKED_EVIDENCE: BASE_SAUCE_UNSPECIFIED | `sauceBase: [buffalo-sauce]` | D-2（buffalo-chicken との重複例外。専用 floret SVG と差別化が条件）承認。I-1/I-2（cauliflower）承認。追加判断書 §G4 25-1「buffalo-sauce を下地」は「推奨: 承認」 | buffalo-sauce を下地とする点は、決定表では D-2 の説明文（「same buffalo sauce」）に現れるのみで、BLOCKED（ベース未特定）の解除としての承認行はない |
| mexican-elote-pizza（…-p13） | BLOCKED_EVIDENCE: BASE_SAUCE_UNSPECIFIED | `sauceBase: [sour-cream]` | I-5（lime）承認、L-2 承認 | elote の下地を sour-cream とすること、および late・POST_BAKE の扱いについて、決定表に承認行がない。追加判断書 §承認表は「25-3 elote の NO_SAUCE は未承認」。後続の R1 パケットで sour-cream 下地が提示されたが、確定承認の記録は見つかっていない |
| pizza-asparagi-limone（…-p8） | BLOCKED_MECHANIC_INTERPRETATION | `sauceBase: [olive-oil]`、late、POST_BAKE の asparagus・lemon | D-3（quattro-formaggi との重複例外）承認。I-1（asparagus）承認 | ブロック種別は MECHANIC_INTERPRETATION（台帳には種別名のみで、解釈の中身の記載は確認できていない）。この種別を解く承認行がない。D-3 は重複 Gate の例外で、BLOCKED 解除の承認ではない |

- B24 の先例: matcher の ownerApproved には「T24-R1 承認パケット §7 の承認」と**節番号つきで根拠**が書かれていた。T25 にはそれに当たる「BLOCKED 行の出荷承認」節がない。
- 判断をお願いしたい点（各行 1 回答）: ① 上の「ギャップ」を、決定表の承認（I-/D-/L-）が包含していると認めて ownerApproved に記録してよいか。② banh-mi・elote の下地（NO_SAUCE／sour-cream）を、別途の明示承認事項として扱うか。③ asparagi の MECHANIC_INTERPRETATION の中身の確認と扱い、および swedish-kebab の「肉」を省略した出荷の可否。
- 承認が出た場合に行う変更（案、未実施）: `matcher.test.ts` の ownerApproved に該当行を根拠コメントつきで追加し、`discoveryCatalog.test.ts` に「Phase-2 SHIPPED_KEEP 表にない T25 の ordinary 1 件（buffalo-cauliflower-pizza）」の定数を B24 と同形式で追加。承認が出ない場合は、この 2 件を失敗のまま HOLD に残す。

## B-1: kebab-sauce `#d86a35`（Owner 承認済みの色）の ΔE 違反と、当該ペア限定の例外案
**事実（実測、CIE76。`expansionBatch22.test.ts` と同じ式）**
- 失敗の中身: `buffalo-sauce`（`#ec5a12`）対 `kebab-sauce`（`#d86a35`）= **20.45**（基準 25 未満）。B22 のテストは「buffalo-sauce が、**その時点で存在する全ての他の sauce** と ΔE 25 以上」を要求する。kebab-sauce が後から入ったため、このテストが後続バッチの色まで拾っている。
- 同じ ΔE 25 の考え方で見ると、kebab-sauce の近傍は tomato-sauce 20.44、buffalo-sauce 20.45、curry-ketchup 20.70、peanut-sauce 24.04。**現在の自動テストで拾われているのは buffalo のペアだけ**（tomato／curry-ketchup に対する kebab のテストはない）。
- 実際の共起（実測）: kebab-sauce を使う recipe は swedish-kebab-pizza のみ（kebab-sauce・mozzarella・lettuce）。buffalo-sauce を使う recipe は buffalo-chicken と buffalo-cauliflower-pizza、curry-ketchup は 5 recipe で、いずれも kebab-sauce とは同じレシピに現れない。tomato／buffalo／curry-ketchup と同じ皿に載るのは、プレイヤーが自由に混ぜた場合だけ。
- 決定表 I-4 の根拠は「既存 PAINT で、tomato／buffalo より薄く、クリーム寄りの橙」。**ΔE 基準との照合は決定表では行われていない**（実測では上記のとおり基準未満）。
- ΔE 25 を満たしたまま色を変える場合の暖色候補は 2 色のみ（`#bd7470` 25.1、`#ff1413` 25.2）。比較画像: `docs/reports/screenshots/b25-kebab-sauce-color/kebab-sauce-color-options.png`。**色の変更は Owner の承認済みの色を変えることになるため、提案しない**（資料のみ）。

**例外が必要な理由と、承認済み事項との整合**
- 色は Owner が明示承認済み（I-4）。基準 25 は B22 以来の「新 sauce の識別性」の基準。両方を満たす暖色が事実上存在しない（上記 2 色のみ）ため、**承認済みの色を維持する限り、このペアは基準を満たせない**。
- したがって例外は「基準の緩和」ではなく、「承認済みの色と基準が衝突した 1 ペアの記録」として扱える。基準 25 は他の全ペアで維持する。

**例外案（未実装・承認待ち）**: `expansionBatch22.test.ts` の ΔE テストに、次の形で**ペア限定**の例外を追加する。
```ts
// Batch 25 (Owner I-4: kebab-sauce #d86a35 approved). The one pair below is below 25; every other pair still needs >= 25.
const APPROVED_DELTA_E_EXCEPTIONS: ReadonlyArray<{ a: string; b: string; measured: number }> = [
  { a: "buffalo-sauce", b: "kebab-sauce", measured: 20.4495 },
];
// for every pair: >= 25, unless the pair is listed; a listed pair must measure EXACTLY the pinned value (±0.01),
// so any change to either colour re-opens the decision.
```
- 範囲の選択肢（Owner 判断）: (a) buffalo↔kebab の 1 ペアだけ（現在の失敗に対応）。(b) tomato↔kebab（20.44）と curry-ketchup↔kebab（20.70）も、同じ理由で明示的に列挙して記録（現在テストはないが、同じ基準の趣旨に反するため、後で別テストが追加されたときに備える）。

## B-2: D-2（buffalo-cauliflower vs buffalo-chicken）の例外 — 条件の実装・検証状況と、対象ペア限定の例外案
**D-2 の承認文言（決定表）**: 「カリフラワー専用 floret SVG とチキンとの差別化を必須条件とする例外」。Jaccard 0.6（ONE_DIFF）は提示済み。

**条件の確認（実測・実コード）**
| 条件 | 状況 | 根拠 |
|---|---|---|
| 専用 floret SVG | **実装済み** | `cauliflower` の `pieceVisual = "cauliflower-floret"`（`StagedGlyphs.tsx`、`IngredientGlyph.tsx` に配線）。選択用と配置用の 2 つの描画は別（`expansionBatch25.test.tsx` が両者の markup が異なることを検証） |
| チキンとの差別化（見た目） | **実装・目視確認済み／ただし自動検証は弱い** | チキンは SVG なしで絵文字 🍗、cauliflower は緑の茎つきの乳白色の房。比較画像 `docs/reports/screenshots/b25-d2-cauliflower-vs-chicken/cauliflower-vs-chicken.png`。**自動テスト `getIngredient("cauliflower").pieceVisual !== getIngredient("chicken").pieceVisual` は、チキンの `pieceVisual` が `undefined` のため実質空**（常に真） |
| トレイ・ピザ上での実表示 | **検証済み** | 生成 E2E（`e2e/t25.spec.ts`）が、トレイのチップとピザ上の両方で `svg[data-ingredient-visual="cauliflower-floret"]` を検証（390×844・360×800、10 件 PASS） |
| 落下形状（決定表 §3 の推奨文「different landing silhouette」） | **未差別化** | 両者とも `HEAVY_SQUASH`、配置も同じ 2 か所 `(25,36)`,`(50,52)`。ただし**Owner の承認文言の「必須条件」には落下形状は含まれていない**（推奨文のみ） |
| 実機（iPhone）での見た目の判断 | **未実施** | HV Policy の対象。動画は Owner に直接渡す規定 |

**例外案（未実装・承認待ち）**: `expansionBatch22.test.ts` の重複 Gate テストに、**対象ペア限定**の例外を追加し、基準 0.4・差分 2 以上・部分集合不可は他の全ペアで維持する。
```ts
// Batch 25 (Owner D-2): the ONE approved pair; the conditions of the approval are asserted, not assumed.
const APPROVED_DUPLICATE_EXCEPTIONS = { "buffalo-chicken": ["buffalo-cauliflower-pizza"] } as const; // exact pair, both directions
// for the listed pair: jaccard === 0.6 and symDiff === 2 are pinned exactly (a recipe change re-opens the decision), and
//   getIngredient("cauliflower").pieceVisual === "cauliflower-floret" and chicken has no pieceVisual (or a different one)
//   and the cauliflower tray chip + placed art markup differs from the chicken's (non-vacuous), plus the existing E2E SVG checks.
```
- 同時に直す弱い検証（承認が出たとき）: 上の「`pieceVisual` の不一致」の空テストを、描画 markup の不一致の断言に置き換える。
- 構成を変える選択肢（参考・実測は `batch25-vitest-triage.md` の B-2）: gorgonzola を feta／ricotta／fontina など 9 種のいずれかに替えると、最大 Jaccard 0.333・違反なし。ただし Research の承認済み 42 ID と「D-2 条件付き」の行（pesto-noci／quattro-formaggi／buffalo-chicken）の再測定・再承認が必要。

## 判断が必要な事項のまとめ
1. M-2: 5 行それぞれの「ギャップ」を、決定表の承認が包含すると認めるか／別途承認か。特に banh-mi・elote の下地（追加判断書で「未承認」とされた経緯）。
2. B-1: 例外の範囲（buffalo↔kebab のみ、または tomato／curry-ketchup も列挙）。
3. B-2: 対象ペア限定の例外（D-2）の実装と、空テストの置換の承認。落下形状の差別化を必須とするか（現状は未差別化）。iPhone HV の実施。
