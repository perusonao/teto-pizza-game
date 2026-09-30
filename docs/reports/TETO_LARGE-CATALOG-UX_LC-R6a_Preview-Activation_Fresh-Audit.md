# Large Catalog UX — LC-R6-a Fresh Audit（Preview Activation Architecture）

Docs / probe only。**production implementation なし・`HAND_ENFORCEMENT_ENABLED` は `false` のまま・capacity 9 / 12 は決めない・P3 系に触れない・PR なし・merge なし。**

目的: Large Catalog の Hand / Pin を **Preview でだけ** 安全に ON にし、実機 Human Verification（HV）できる activation architecture を確定する。authority は OD-R5e-4（Preview-only・production fail-closed）。current main の実装を authority とし、推測した箇所は明記する。

---

## 1. Audited main SHA

| 項目 | 値 |
|---|---|
| audited main | **`22263bddf8a80a6c6e1c3c2ab90a43b1cb44a6d7`**（fresh fetch 済み。R5-e-h 完了時と同じ。main は進んでいない） |
| branch | `claude/lc-r5-e-fresh-audit-ay8yrj`（R5-e / R5-e-h と同じ branch。未 PR） |
| branch HEAD（本監査開始時） | `809308a` |
| probe（本監査で追加、CI 外） | `tools/large-catalog-ux/r6a-bundle-probe.test.ts`（`npx vitest run --config tools/large-catalog-ux/vitest.r6a-probe.config.ts`）→ `docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R6a_BUNDLE-PROBE.json` |

## 2. R5-e dependency state

| 項目 | 状態 |
|---|---|
| R5-e Fresh Audit / R5-e-h hardening | branch 上で完了（判定 A）。**main 未 merge（PR 未作成）** |
| R6 が依存するもの | `vitest.config.ts` の `hand-on-9` / `hand-on-12` project（real `handPolicy.ts` を ON で compile する test 専用 transform）、`*.handOn` suite、H-1〜H-8 test、mutation tooling（M1〜M114、E1〜E12） |
| transform の前提 | `handPolicy.ts` に `export const HAND_ENFORCEMENT_ENABLED = (false|true);` と `export const DEFAULT_HAND_CAPACITY_CANDIDATE: HandCapacityCandidate = (9|12);` がそれぞれ 1 行ずつ存在すること（無ければ fail closed で throw）。R6-b で flag を「解決式」に変える場合も、**production default の literal 行を残す**か transform を同時に更新する必要がある |
| R6 での扱い（推奨） | **R5-e branch（test / tooling / docs、production src 0）を先に PR → merge**（OD-R6a-6）。R6-b 以降はその main から新 branch で開始する。R6-a report（本書）もこの branch に載る |

## 3. Current flag architecture（current code）

| 要素 | 事実（根拠） |
|---|---|
| `HAND_ENFORCEMENT_ENABLED` | `src/logic/catalog/handPolicy.ts:14` の module 定数 `false`。読む production site は 3 つ: `handCapacityFor`（`:22`）、`resolveTrayHandIds` の第 1 文（`handTray.ts:38`）、`GameScreen` の `handEditing={HAND_ENFORCEMENT_ENABLED}`（`GameScreen.tsx:893`） |
| `handCapacityFor` | flag ON なら candidate、OFF なら `max(1, owned)`（常に inactive） |
| `DEFAULT_HAND_CAPACITY_CANDIDATE` | `handPolicy.ts:32` = 12（design candidate）。App が `trayHandInput.candidateCapacity` に渡す唯一の値 |
| runtime switch | **なし**。URL / storage / window から flag や capacity を読む code は存在しない（grep） |
| test 用の ON | R5-e-h の Vitest transform のみ（build には無関係: `vite.config.ts` は plugin に触れない） |

## 4. Current Preview architecture（current code + 記録）

| 要素 | 事実 |
|---|---|
| Preview の配信 | 別 repo **`perusonao/teto-pizza-game-preview`**（`deploy-from-source.yml` + `pages.yml`、URL `https://perusonao.github.io/teto-pizza-game-preview/`）。本 repo の workflow ではない |
| Preview の build | 記録（`docs/reports/TETO_ISSUE-39_PS1-PS2_Preview-Gate.md` §2、以後の Preview 運用も同一）: 本 repo を **指定 SHA で checkout** し、`VITE_PREVIEW_MODE=1 VITE_PREVIEW_PR=<n> VITE_PREVIEW_SHA=<sha> vite build --base=/teto-pizza-game-preview/`、manifest の `start_url` / `scope` を Preview path に patch、`noindex` を注入、`site/` に push |
| **監査の制約** | 本 session では Preview repo への read access が許可されなかった（add_repo が denied）。上記は in-repo の記録に基づく。**Owner 確認事項**: 現行 `deploy-from-source.yml` が今も (a) 任意 SHA を build でき、(b) `VITE_PREVIEW_*` 3 変数以外の `VITE_*` を渡していないこと |
| Preview-only の compile-time gate | `import.meta.env.VITE_PREVIEW_MODE`（Vite が静的置換）。利用箇所: `main.tsx:10`（`?hv=` seed）、`PreviewBadge.tsx`（`PREVIEW · PR#n · sha`）、`persistence.ts:75`（Preview 専用 save key `teto-pizza-preview-save-v1`）、`hint5Flag.ts:48`（Hint 5 Preview opt-in）、`App.tsx:105`（`DINNER_PREVIEW_ALLOWED`）、debug panel 群 |
| 既存の Preview activation 前例 | **Hint 5.0 H5-5**: Preview / DEV でだけ `?hint5=1|0` を読み、Preview 専用 key に記憶（`src/preview/hint5PreviewOptIn.ts`）。production は `VITE_PREVIEW_MODE` 不在で静的に除去 |
| 既存の fail-closed 証明 | `src/preview/previewIsolation.gate.test.ts`: **実 `vite build` を production / Preview の 2 回**（in-memory）行い、production bundle に Preview helper の marker・opt-in key・seed id・Preview save key が **無い**こと、Preview bundle には **ある**こと（scan が機能している証明）を assert。`e2e/hint5-preview.spec.ts`: 2 build を静的 server で配信し、production で `?hint5` / key が無効であることを behaviour で確認 |

## 5. Current Production architecture

| 要素 | 事実 |
|---|---|
| workflow | `.github/workflows/deploy.yml`: `push: main` / `workflow_dispatch`（input なし）→ `npm ci` → `npm run build`（= `tsc -b && vite build`）→ Pages。env は Firebase の 4 変数のみ（secrets）。**`VITE_PREVIEW_MODE` を設定しない** |
| CI | `ci.yml`（PR → main）: WebKit scripts test、lint、`npm test`（= 全 Vitest project、hand-on 含む）、build |
| `.env*` | commit されているのは `.env.example`（Firebase 4 変数のみ）。`.env.local` / `*.local` は ignore |
| production 判定 | `import.meta.env.DEV`（dev server のみ true）/ `VITE_PREVIEW_MODE`（Preview pipeline のみ）。production build はどちらも false / undefined |

## 6. Preview / Production separation（現状の保証）

1. production workflow は `VITE_PREVIEW_MODE` を設定しない（workflow file に存在しない）。
2. Preview-only code は `if (!import.meta.env.VITE_PREVIEW_MODE)` 等の静的条件の後ろにあり、production build で dead code として除去される（`previewIsolation.gate.test.ts` P1 が bundle scan で証明）。
3. Preview は別 origin path・別 save key・`noindex`。production save を汚さない。

**Probe 結果（本監査、`BUNDLE-PROBE.json`）**

| marker | production JS | Preview JS |
|---|---|---|
| hand / pin UI 文字列（`おまかせに戻す` / `選択中の材料` / `を外す` / `ざいこなし` / `pantry-tile__toggle` / `pantry-sheet__pins` / `pantry-tile__pin-badge`） | **7 / 7 あり**（CSS にも class あり） | 7 / 7 あり |
| 既存 Preview-only（`h5-preview-helper-v1` / `teto-pizza-preview-hint5-optin` / `teto-pizza-preview-save-v1`） | **0 / 3**（正しく除去） | 3 / 3 |
| control（`食材庫` / `材料を検索`） | あり | あり |
| JS size | 1,096,009 B | 1,105,819 B |

→ **Finding R6a-F1**: dormant な pin UI は **既に production bundle に含まれている**（R5-c 以降）。到達不能にしているのは `HAND_ENFORCEMENT_ENABLED = false`（literal）と、それが prop / 条件として読まれる 3 site だけ。これは R5-c の設計どおり（dormant code を ship し、flag で閉じる）で、**現状 production から ON にする経路は無い**。R6 で守るべき fail-closed 境界は「production artifact に、この flag / capacity を変える **reader**（URL / storage / global / env）が存在しないこと」であり、UI code の有無ではない。

## 7. Activation alternatives

| 案 | 仕組み | Preview repo 変更 | production から override 経路 | Preview 内の runtime reader | 9 vs 12 | standalone / PWA | 実装量 |
|---|---|---|---|---|---|---|---|
| **A1** Preview build-time env | 新 `VITE_LC_HAND=9|12` を Preview pipeline が渡す。`handPolicy` は `VITE_PREVIEW_MODE && VITE_LC_HAND` のときだけ ON | **必要**（`deploy-from-source.yml` に input 追加） | なし（2 重 guard） | なし | 2 回 deploy（同一 URL を順に上書き） | build 固定なので問題なし | 小（本 repo）+ 別 repo 変更 |
| **A2** Preview-only committed variant（**推奨**） | `src/preview/lcHandPreview.ts` に `LC_HAND_PREVIEW_CAPACITY: 9 | 12 | null`（main では **null**）。`handPolicy` は `import.meta.env.VITE_PREVIEW_MODE` のときだけそれを読む。HV 用には PR head から **使い捨て commit**（値 9 / 12）を作り、既存 pipeline で exact SHA を deploy | **不要**（既存の SHA 指定 build のまま） | なし（`VITE_PREVIEW_MODE` 不在で読み込み自体が除去） | なし | variant ごとに exact SHA 2 つ（ABBA で順に deploy） | build 固定なので問題なし | 小 |
| **B** Preview 専用 build config / entry | `vite.preview.config.ts`（`define` / `resolve.alias` で `handPolicy` を Preview 版に差し替え） | **必要**（`--config` 指定） | なし | なし | 2 回 deploy | 問題なし | 中。alias による差し替えは監査しにくく、hand-on transform と二重化 |
| **C** Preview-runtime opt-in（H5-5 前例） | Preview / DEV でだけ `?lcHand=9|12|0` を読み Preview 専用 key に記憶。production は静的除去 | 不要 | なし（scan で証明） | **あり**（Preview artifact 内に URL / storage reader） | 同一 SHA・同一 deploy で URL 切替 | **要実機確認**（iOS の Home Screen 起動は manifest の `start_url` で開き query を持たない。standalone の storage が Safari と共有されるかも要確認） | 小〜中 |

評価軸（OD-R5e-4）: 「production build そのものが Preview activation を受け付けない構造」「production artifact から override path を実質的に除去」を最優先。A1 / A2 / B / C はいずれも production から override できないが、**A1 / A2 / B は Preview artifact にすら runtime reader が無い**。うち A2 だけが別 repo 変更なしで実現できる。

## 8. Recommended activation design（A2）

```
// src/preview/lcHandPreview.ts  (Preview-only; main では null)
export const LC_HAND_PREVIEW_MARK = "lc-hand-preview-v1";
export const LC_HAND_PREVIEW_CAPACITY: 9 | 12 | null = null;

// src/logic/catalog/handPolicy.ts  (R6-b; 概念)
export const HAND_ENFORCEMENT_PRODUCTION = false;              // literal: production の唯一の switch（R6-e で true）
export const DEFAULT_HAND_CAPACITY_PRODUCTION: HandCapacityCandidate = 12;  // literal（R6-e で確定値）
const preview = import.meta.env.VITE_PREVIEW_MODE ? LC_HAND_PREVIEW_CAPACITY : null;  // production: 静的に null
export const HAND_ENFORCEMENT_ENABLED = HAND_ENFORCEMENT_PRODUCTION || preview !== null;
export const DEFAULT_HAND_CAPACITY_CANDIDATE = preview ?? DEFAULT_HAND_CAPACITY_PRODUCTION;
```

- production build: `import.meta.env.VITE_PREVIEW_MODE` は `undefined` に静的置換 → `preview = null` → `HAND_ENFORCEMENT_ENABLED = false`、`lcHandPreview.ts` は tree-shake。**使い捨て commit（値 12）を production build しても OFF**（§9 の P-4 で証明）。
- Preview build（main / PR head）: 値 `null` → OFF（他 PR の Preview HV に影響しない）。
- Preview build（HV 用使い捨て commit、値 9 または 12）: ON、capacity = その値。`PreviewBadge` に `HAND 9` / `HAND 12` を併記（Preview-only、video で variant を識別）。
- 3 site（`handCapacityFor` / `resolveTrayHandIds` / `handEditing`）は `HAND_ENFORCEMENT_ENABLED` を読むだけなので **呼び出し側の変更は不要**。
- hand-on Vitest transform: `HAND_ENFORCEMENT_PRODUCTION` / `DEFAULT_HAND_CAPACITY_PRODUCTION` の literal 行を対象に更新（fail-closed のまま）。
- 使い捨て commit の運用: PR head から `hv/lc-hand-9-<sha>` / `hv/lc-hand-12-<sha>` の 1 commit branch（`LC_HAND_PREVIEW_CAPACITY` 1 行だけの差分）を作り、pipeline に exact SHA を渡す。**PR にはしない・merge しない**。PR head は常に `null` で CI green。

## 9. Fail-closed proof strategy（R6-b で追加する gate）

| # | gate | 層 | 内容 |
|---|---|---|---|
| P-1 | production bundle scan | Vitest（`previewIsolation.gate.test.ts` を拡張） | production bundle に `lc-hand-preview-v1`（marker）が **無い**、Preview bundle には **ある**（scan が見えている証明） |
| P-2 | source gate | Vitest | main の `LC_HAND_PREVIEW_CAPACITY` は `null`。`lcHandPreview.ts` を import するのは `handPolicy.ts` のみ、かつ `VITE_PREVIEW_MODE` 条件の後ろ。URL / storage / `window` / `globalThis` から flag / capacity を読む code が catalog / App / GameScreen に **無い**（`location` / `localStorage` / `sessionStorage` / `URLSearchParams` の出現 0） |
| P-3 | workflow gate | Vitest（YAML text scan） | `deploy.yml` / `ci.yml` / `firebase-production-deploy.yml` に `VITE_PREVIEW_MODE` / `LC_HAND` が無い。commit 済み `.env*`（`.env.example` 以外）が無い |
| P-4 | **variant-in-production e2e** | Playwright（`hint5-preview.spec.ts` の 2 build 方式） | 値を 12 にした一時 source で **production build** → 22 topping FREE で tray は 4 page・pin UI なし・`HAND` badge なし。同じ source の Preview build → 2 page・pin UI あり。production に `?lcHand=12` や任意の storage key を与えても不変 |
| P-5 | OFF golden | Playwright（production build） | §21 の DOM golden が R5-d baseline と同一 |
| P-6 | 既存 | Vitest | `handTray.off.test.ts`（shipped production flag false ⇒ `null`）、`App.handTray.off.test.tsx`、R5-e-h の hand-on suite（9 / 12） |

console からの切替: production の flag は minify 後 literal（`!1` 相当）に畳まれ、global に公開されない。devtools で JS を書き換える行為（local override）はどの web app でも防げず、その端末だけに影響するので脅威モデル外とする（Owner が「簡単に変更できる runtime switch」を禁止した趣旨は満たす）。

## 10. Production bundle leakage analysis

| 対象 | 現状 | A2 導入後 |
|---|---|---|
| dormant hand / pin UI code | production に含まれる（R6a-F1、到達不能） | 同じ（R6-e まで到達不能） |
| override reader（URL / storage / env） | 無い | **無い**（P-1〜P-4 で証明） |
| Preview marker / variant 値 | — | production に無い（P-1）。variant 値は Preview build のみ |
| Preview save key / hint5 key | production に無い | 変化なし |
| bundle size 差 | production 1,096,009 B | `lcHandPreview.ts` は production で除去されるので実質 0（`handPolicy` の数行のみ）。R6-b で probe を再実行して記録 |

## 11. Capacity 9 / 12 comparison mechanism

- **2 つの使い捨て variant SHA**（`hv/lc-hand-9-*` / `hv/lc-hand-12-*`、同じ PR head から 1 行差分）を既存 pipeline で順に deploy。Preview URL は 1 つなので **同時比較ではなく順番に**比較する（R5-e §16 の ABBA protocol と整合）。badge に `HAND 9` / `HAND 12`。
- 同一条件: 同じ PR head、同じ `?hv=` seed（R6-b で Large Catalog 用 seed を `hvSeeds.ts` に追加: topping 22 所持、在庫固定、3 種 ×0、1 種 stock 1）、pins 0 から開始、各 run 前に reload（pins は session-only）。
- 比較項目: page 1 / page 2 の内容、探しやすさ、手元の情報量、pin した食材の見つけやすさ、auto-fill displacement（pin で押し出される自動枠）、360×640 / 390×664 / 360×800 / 390×844（Chromium 計測）、real iPhone Safari、standalone / PWA。
- 既知の geometry（R5-e §8.1）: 9 と 12 で stage / dock は **完全同一**（どちらも 2 page）。差は page 2 の 3 件 vs 6 件と hand の幅のみ。
- **決定しない**。R6-d で Owner が決める。

## 12. Hand activation boundary（OD-R5e-1 の前提）

- eligible = `roundKind === "FREE_COOK"` ∧ `dinner === null`（`freeEligibility.ts`）。guided / Lunch Rush / Dinner は不可（R5-e-h H-6 で App-level 固定済み）。
- active = eligible ∧ PREPARE ∧ SAUCE / CHEESE / TOPPING ∧ owned(category) > capacity。
- current catalog（`src/data/ingredients.ts`）: sauce 3 種、cheese 4 種、topping 22 種 → **sauce / cheese はどちらの capacity でも active にならない（再確認）**。topping は 12 で owned ≥ 13、9 で owned ≥ 10 のとき active。

## 13. Pin UI boundary（OD-R5e-1）

- R6-c で `handEditing = HAND_ENFORCEMENT_ENABLED && trayHand.ids !== null`（App が既に計算している active hand の有無。新しい判定を作らない）。
- 結果: sauce / cheese step、topping ≤ capacity、非 eligible round では pantry は R5-b の read-only のまま（効果の無い pin UI は出ない）。
- 既存 test の更新: R5-e E11 が「inactive でも pin UI」という現 spec を固定しているので、R6-c で意図的に反転（inactive category で toggle / strip が **無い** ことを 9 / 12 で assert）。
- pins の保持: session-only のまま。hand が inactive の category では pin を作れないが、ownership は round 中に増えず減らない（R5-e-h H-5）ので、既存 pin が「効かない pin」になる経路は無い。

## 14. Inventory 0（OD-R5e-2、実装済み・R6 は表示確認のみ）

| 状況 | tray | pantry |
|---|---|---|
| unpinned ×0 | 除外（capacity 件まで在庫ありで補充） | ×0 表示、`aria-disabled`、新規 pin 不可（「ざいこなし」） |
| existing pinned ×0 | ×0 で残る、disabled（placement 不可） | pinned（📌、`aria-pressed=true`）、unpin 可能 |
| unpin 後 | 除外 | ×0 のまま |

R5-e-h H-6 で App-level に固定済み。R6-c の HV で見え方（×0 chip が tray に残ることの違和感）を確認する（HV-13）。

## 15. Rejection UX（OD-R5e-3、R6-a では実装しない → HV 計画）

- 文言（数字なし）: 「手元がいっぱいです。使わない食材のピンを外してね」。
- 発生条件: hand active ∧ 未 pin ∧ 在庫あり ∧ Model C で hand に入らない tile を tap（`togglePin` の `rejected-capacity`）。
- 表示位置の候補（HV で比較、R6-c で両方を試せる実装にはしない。第一候補を実装し HV で判定）:
  1. **第一候補**: sheet 下端の overlay toast（layout を押さない。keyboard fit 中は visual viewport 下端に追従）。list の可視行を減らさない。
  2. 代替: 「選択中」strip の位置に inline 表示（normal のみ。keyboard 中は strip が隠れるので toast に fallback）。
- 表示時間: **3 秒**、次の tap / close で即消去。同じ tile の連続 tap で再表示（timer reset）。
- a11y: sheet 内に常設の `role="status"`（`aria-live="polite"`）領域に同文言を入れる（visual toast と同期）。tile は `aria-disabled` にしない（押せるが拒否される: 理由を聞けることが重要）。
- HV 観察: 気づくか、読めるか、何を外せばよいか分かるか、list / strip を隠さないか、keyboard 中に見えるか、VoiceOver で読まれるか。

## 16. #197

- authority（R5-d / R5-e）: 実際の可視 hand 変化 → page 0 → 新 page 0 に `selectedIngredientId` があれば保持、無ければ clear。membership 同一 / priority-only reorder は hand change ではない。
- R5-e-h で App-level の安全条件（非可視 selection は **置けない**）を side effect で固定、E6 KILLED、E2 は key-guard gate。
- R6 HV 項目: (a) pin → selection clear → unpin で selection が戻らない（H-7 で固定した現仕様）の違和感、(b) pin 編集で page 0 に戻ることが pantry を閉じた後に分かるか、(c) placement 後に tray が動かないこと。

## 17. Keyboard / IME（real iPhone 計画、OD-R5c-5 は R6 で判断）

| # | 確認 | 期待 / 判断材料 |
|---|---|---|
| K-1 | search focus 中に tile を tap して pin | **OD-R5c-5**: (i) keyboard 維持（tile の `pointerdown` で `preventDefault`、検索の ✕ と同じ方式）vs (ii) blur（keyboard が閉じ、fit 解除で list が伸びる）。R6-c は **(i) を既定**で実装し HV で判定（OD-R6a-5） |
| K-2 | keyboard 表示中の strip auto-hide | strip が消え、tile 📌 / `aria-pressed` / 再 tap unpin は残る（方式 D） |
| K-3 | list の可視行 | 360×640 相当 K≈338 で ≈87px（1 行）。rejection toast が行を隠さないこと |
| K-4 | 日本語 IME | 変換中に list が動かない、確定で適用、変換確定の Enter で blur しない（R5-b contract の再確認） |
| K-5 | Escape（desktop） | sheet を閉じ、focus は食材庫 entry に戻る |
| K-6 | standalone / PWA | keyboard fit、safe-area、start_url が Preview path（pipeline の manifest patch） |

## 18. Accessibility（R6-c の要件）

- 44px target（tile / strip pin / おまかせに戻す / close / search は既に `min-height: 44px`）。
- tile: `aria-pressed`、accessible name に状態語を足す（例「トマト、ピン留め中」）か現状（内容 + `aria-pressed`）で十分かを VoiceOver HV で判定（P-2）。
- inventory0: `aria-disabled` + 可視「ざいこなし」（R5-c）。
- rejection: `role="status"` polite（§15）。
- pin / unpin の announce: 同じ status 領域に「〇〇を手元に追加」「〇〇を外しました」（polite、短く）。
- #197 で selection が clear された時の announce: 候補（「選択を解除しました」）。過剰かどうか HV で判断（任意）。
- keyboard navigation / Escape / focus return / IME: R5-b / R5-c のまま（M35〜M38、M68〜M72）。

## 19. Mobile geometry

- tray: 9 / 12 で 4 viewport とも stage / dock 同一（R5-e §8.1、`HAND-CAPACITY-COMPARISON.json`）。R6-c 後に `hand-capacity.measure.spec.ts` を Preview-equivalent（hand ON）で再測し、差が 0 であることを回帰確認。
- pantry: normal 7 / 7 / 5 / 5 行、keyboard（K=338 simulated）3 / 3 / 1 / 1 行。strip は keyboard 中 hide（方式 D）。rejection toast は overlay で行数を減らさない。
- K=380 級の大きい keyboard では 390×664 / 360×640 で list 0 行（R5-b 由来の既知事項、R5-e F-5）。実機で確認し、問題なら R6 の別 slice。

## 20. Real-device HV script（R6-c / R6-d、Preview exact SHA、390×844 video + before/after screenshot）

**前準備**: Preview（variant SHA）を開き、badge `PREVIEW · PR#n · sha · HAND 12`（または 9）を確認。`?hv=lc-22`（R6-b で追加する seed）で開始。

**主シナリオ（一続き）**
1. HOME → フリークッキング → 生地 → ソース → チーズ → **トッピング**（tray は 2 page、catalog 順、HAND ON）。
2. 食材庫を開く → 検索（日本語 IME）/ shelf で絞る → hand に無い topping を **pin**（📌、strip に出る）。
3. 閉じる → tray が page 1 に戻り、pin した topping が手元に出ている。
4. その topping を選択 → pizza に配置。
5. 食材庫を再度開く → **unpin**（tile 再 tap または strip の「〜を外す」）→ 閉じる（配置済みの食材は手元に残る: placed protection）。

**追加シナリオ**
- capacity full: 手元が埋まるまで pin → もう 1 つ tap → **rejection**（文言・位置・時間・VoiceOver）。
- stock 1→0: stock 1 の topping を置いて焼く → もう一度じゆうに作る → unpinned は tray から消える、pinned は ×0 で残る → ×0 を unpin。
- HOME → FREE 再開、次の FREE round: pins 維持、page 1、選択なし。
- guided（ピザを作る → マルゲリータ）、Lunch Rush、Dinner（`?dinnerDuration=`）: 食材庫・pin UI・hand なし。
- keyboard K-1〜K-6、#197 の (a)〜(c)。
- 360×640 相当（あれば実機、無ければ Chromium 計測で代替）。

**記録**: R5-e §15 の M-1〜M-9（数値）と HV-1〜HV-13（主観）を variant ごとに。

## 21. OFF regression strategy

1. **production DOM golden（新規、R6-b）**: production build（`VITE_PREVIEW_MODE` なし）を Playwright で開き、R5-d の 14 snapshot 相当（FREE 22 / FREE ≤12 / FREE 6 topping × SAUCE / CHEESE / TOPPING page 1・2、pantry 開閉、Dinner / guided / Lunch Rush）の normalized DOM を JSON で commit。baseline は **main `22263bd`**（R6-b の最初の commit で採取）。以後の R6 PR はこの golden と byte 同一であることが CI 条件（production 側に一切の見た目・挙動変化がない証明）。
2. **ON-inactive ≡ OFF**: hand-on project で、inactive（topping ≤ capacity、sauce / cheese、非 eligible）の tray DOM が OFF と同一（R5-e §10.2-2）。R6-c で pin UI も inactive では無くなるので pantry も同一。
3. **variant-in-production = OFF**（P-4）。
4. 既存の OFF test（`handTray.off.test.ts`、`App.handTray.off.test.tsx`）は R6-e まで維持。R6-e で「shipped production flag is false」を「non-eligible / inactive は flag に依らず `null`」へ置換（削除しない）。

## 22. Tests / mutation strategy

| slice | 追加 test | 追加 mutant（kill 必須） |
|---|---|---|
| R6-b | P-1〜P-5、Preview variant の unit（`VITE_PREVIEW_MODE` あり / なし × `null` / 9 / 12）、badge | V1: production でも variant を読む（`VITE_PREVIEW_MODE` guard 削除）、V2: main の値が null でない、V3: URL / storage reader を追加、V4: `deploy.yml` に `VITE_PREVIEW_MODE`、V5: transform の対象行を消す（fail closed の確認） |
| R6-c | OD-R5e-1（inactive に pin UI なし、9 / 12）、rejection（文言に数字なし・status 領域・3 秒・次 tap で消去）、OD-R5c-5 既定、a11y name、ON-inactive ≡ OFF | U1: inactive でも pin UI（E11 反転）、U2: rejection に数字、U3: rejection が無音（status 空）、U4: toast が layout を押す（list 高さ変化）、U5: keyboard 中に strip 表示（M95 維持） |
| R6-d | なし（計測 tooling のみ） | — |
| R6-e | production ON の golden（新 baseline）、OFF test の置換 | 既存 M1〜M114、E1〜E12、V / U 全 kill（E4 / E5 の扱いは R5-e-h のとおり） |

mutation の実行は 1 本ずつ（R5-e-h で同時実行が CPU 競合で落ちることを確認済み）、2 時間上限を超える場合は分割実行。

## 23. R6 slices

| slice | production behavior change | Preview behavior change | required tests | required HV | merge dependency |
|---|---|---|---|---|---|
| **R6-a** Fresh Audit（本書） | なし | なし | probe のみ | 不要 | — |
| **R6-b** Preview activation infrastructure（A2） | **なし**（DOM golden 同一、bundle に reader なし） | main / PR head: なし（variant `null`）。variant SHA: hand ON（R5-d までの UI のまま = 未完成の rejection / 全 category pin UI が見える） | P-1〜P-5、V1〜V5、hvSeed、badge | variant SHA の smoke（ON / OFF 判別、badge）のみ。本格 HV は R6-c | **R5-e branch merge 後** |
| **R6-c** Preview Hand/Pin UI activation（production では dormant） | **なし**（flag false、golden 同一） | variant SHA で production-equivalent UI: OD-R5e-1、OD-R5e-3 rejection、OD-R5c-5 既定、a11y | U1〜U5、ON-inactive ≡ OFF、hand-on 9 / 12 | **必須**（capacity 12 variant で §20 主シナリオ + 追加、390×844 video + screenshot） | R6-b |
| **R6-d** 9 vs 12 real-device comparison | なし | variant SHA 9 / 12（使い捨て） | 計測 tooling（`hand-capacity.measure.spec.ts` 再実行） | **必須**（R5-e §16 ABBA、M-1〜M-9 / HV-1〜HV-13） | R6-c |
| **R6-e** Owner capacity decision + production activation gate | **あり**: `HAND_ENFORCEMENT_PRODUCTION = true`、`DEFAULT_HAND_CAPACITY_PRODUCTION = <決定値>` | Preview 既定も ON になる（variant 機構は残すか撤去かを決める） | production ON golden、OFF test 置換、全 mutation | **必須**（production-equivalent build の最終 HV + post-merge production 確認） | R6-d + Owner capacity decision |

R6-a の結論として、R6-c と R6-d を分ける理由: R6-c の HV で UI 自体に修正が出た場合、9 / 12 比較をやり直さずに済む（比較は確定 UI で 1 回だけ行う）。

## 24. Blockers

| # | blocker | 解消 |
|---|---|---|
| BL-1 | R5-e branch（hand-on project / H-1〜H-8 / mutation tooling）が main 未 merge | Owner: PR → merge（OD-R6a-6） |
| BL-2 | Preview repo の現行 workflow を本 session で直接確認できない（access denied） | Owner 確認: 任意 SHA の build が可能で、`VITE_PREVIEW_*` 以外を渡していないこと。A2 は Preview repo 変更を必要としないので、確認だけで足りる |
| BL-3 | 方式の選択 | OD-R6a-1 |

（C を選ぶ場合のみ追加 blocker: iOS standalone の start_url / storage 挙動の実機確認。）

## 25. Owner Decisions（**CONFIRMED** — 下表は提示時の問いと推奨。確定内容は §26）

| # | 質問 | 推奨 |
|---|---|---|
| **OD-R6a-1** | Preview activation mechanism | **A2**（Preview-only committed variant、`VITE_PREVIEW_MODE` の後ろでのみ読む、main は `null`、HV は使い捨て variant SHA）。代替: A1（Preview repo に input 追加）、C（H5-5 型の Preview URL opt-in） |
| **OD-R6a-2** | variant `null`（main / PR head）の Preview は hand OFF でよいか | **はい**（他 PR の Preview HV に影響させない） |
| **OD-R6a-3** | 9 vs 12 は同一 URL に順番に deploy する比較（同時比較なし、ABBA）でよいか | **はい**（同時比較が必須なら C が必要） |
| **OD-R6a-4** | rejection の第一候補（sheet 下端 overlay toast、3 秒、`role="status"` polite、数字なし）で R6-c を実装し HV で判定してよいか | **はい** |
| **OD-R6a-5** | OD-R5c-5 の R6-c 既定: search focus 中の tile tap で keyboard を **維持**（`pointerdown` で `preventDefault`）し、HV で最終判断 | **はい** |
| **OD-R6a-6** | merge 順: R5-e branch を先に PR / merge、R6-b は新 branch | **はい** |
| **OD-R6a-7** | R6 slice（§23: R6-b infra → R6-c UI → R6-d 9 vs 12 → R6-e decision + production） | 承認 |

## 26. Owner Decisions — CONFIRMED

| # | 決定 |
|---|---|
| **OD-R6a-1** | **APPROVED A2**。Preview 専用 committed variant。main では `LC_HAND_PREVIEW_CAPACITY = null`、HV 専用の使い捨て commit だけ `9` / `12`。variant commit は PR に merge しない。production は `VITE_PREVIEW_MODE` が成立しない限りこの値を読まない fail-closed 構造。query / localStorage / sessionStorage 等による production runtime activation は禁止 |
| **OD-R6a-2** | **APPROVED**。通常の main / PR head Preview は `null` = Hand OFF。他機能の Preview に Large Catalog Hand を混入させない |
| **OD-R6a-3** | **APPROVED**。9 / 12 は同一 Preview URL に variant SHA を順番に deploy して比較（ABBA）。badge に `HAND 9` / `HAND 12`。capacity の最終決定は R6-d 実機 HV 後 |
| **OD-R6a-4** | **APPROVED AS R6-c INITIAL UX**。rejection = 数字なし、sheet 下端 overlay toast、3 秒、`role="status"`、polite、copy「手元がいっぱいです。使わない食材のピンを外してね」。最終 UX ではなく R6-c HV で評価 |
| **OD-R6a-5** | **APPROVED AS R6-c INITIAL BEHAVIOR**。検索 input focus 中の pin で keyboard を維持。real iPhone Safari / standalone / 日本語 IME の R6-c HV で評価し、使いにくければ Owner Decision に戻す |
| **OD-R6a-6** | **APPROVED**。R5-e hardening branch を R6 実装より先に単独 PR → merge。R6-b は merged main から開始 |
| **OD-R6a-7** | **APPROVED**。R6-b Preview activation infrastructure → R6-c Preview Hand / Pin UI → R6-d capacity 9 vs 12 real-device comparison → R6-e Owner capacity decision + Production activation |

## 27. BL-2 — Preview repo verification

**RESOLVED — 実物で検証済み**（2026-09-30）。`perusonao/teto-pizza-game-preview` は public repository。session の git proxy 経由で匿名 clone（`--depth 1`、HEAD `04f481e` "Deploy preview: 8c436909… (8c43690)"）し、workflow file を直接読んだ（過去 report には依存していない）。

| 確認項目 | 実物の内容（`.github/workflows/deploy-from-source.yml` / `pages.yml`） | 判定 |
|---|---|---|
| trigger | `deploy-from-source.yml`: `workflow_dispatch` のみ。input は `ref`（required、default `main`、"Branch, tag or commit SHA on perusonao/teto-pizza-game to build"）と `pr_number`（optional、badge 表示用）。`pages.yml`: `push: main` / `workflow_dispatch` | ✅ |
| arbitrary source SHA | `actions/checkout@v4` に `repository: perusonao/teto-pizza-game`、`ref: ${{ inputs.ref }}`、`path: source`。branch / tag / commit SHA のいずれも指定可能 | ✅ variant SHA を deploy 可能（**前提: その commit が GitHub 上の `perusonao/teto-pizza-game` に push 済みであること**。下の運用注記） |
| checkout 方法 | token なし（source repo は public）。`npm ci` → short SHA 解決 | ✅ |
| build env | `VITE_PREVIEW_MODE: "1"`、`VITE_PREVIEW_PR: ${{ inputs.pr_number }}`、`VITE_PREVIEW_SHA: <short sha>` の **3 つだけ**。build は `npx vite build --base=/teto-pizza-game-preview/ --outDir dist-preview`（`tsc -b` は走らない）。Firebase の `VITE_*` は渡さない（Preview は Firebase 未設定） | ✅ `VITE_PREVIEW_MODE=1` は現在も設定される。A2 に追加の env は不要 |
| 後処理 | manifest の `start_url` / `scope` を `sed` で `/teto-pizza-game-preview/` に置換、`index.html` に `noindex` を注入。**current main の `public/manifest.webmanifest`（`"start_url": "/teto-pizza-game/"` / `"scope": "/teto-pizza-game/"`）と `index.html`（`<meta charset="UTF-8" />`）は sed の pattern と一致**。live `site/manifest.webmanifest` は preview path、`site/index.html` に `noindex` 1 件 | ✅ standalone / PWA は Preview path で起動する |
| runtime query / storage activation | workflow 側には無い（build して静的配信するだけ）。runtime の Preview 機能（`?hv=`、`?hint5=`）は app 側で `VITE_PREVIEW_MODE` の後ろにある既存のもの。A2 は新しい runtime reader を追加しない | ✅ |
| Preview badge | `VITE_PREVIEW_PR`（任意）と `VITE_PREVIEW_SHA`（短 SHA）→ `PreviewBadge`。live bundle に `PREVIEW` と `· 8c43690` を確認。A2 の `HAND 9 / 12` は app 側（committed variant）から badge に足すので workflow 変更は不要 | ✅ |
| Preview の live 証跡 | live `site/assets/index-*.js` に `teto-pizza-preview-save-v1`（Preview save key）あり = `VITE_PREVIEW_MODE` build。`lcHand` / `LC_HAND` は 0（当然、未実装） | ✅ |
| production への逆流 | source は read-only checkout（token なし）。push 先は **この Preview repo の `main`**（`GITHUB_TOKEN`、`contents: write` はこの repo のみ）。`pages.yml` は `site/` をこの repo の Pages に配信。production repo の `deploy.yml` とは repository・Pages・concurrency group（repo 単位）とも別。README も "not connected to teto-pizza-game's production GitHub Pages, main branch, or Actions in any way" | ✅ 逆流なし |

**運用注記（blocker ではない）**
- variant SHA は `perusonao/teto-pizza-game` に push された commit でなければ checkout できない。本 session の push 権限は指定 branch のみなので、R6-c / R6-d で `hv/lc-hand-9-*` / `hv/lc-hand-12-*` を push するには、その時点で Owner の明示許可（または Owner による push / 指定 branch の割当て）が必要。
- pipeline は Node **20**、production `deploy.yml` / CI は Node **22**。既存の Preview 運用（R5-b 実機 HV 等）はこの差で問題なく動いている。R6-b の Preview smoke で build 成功を確認する（非 blocking）。
- pipeline は `npx vite build`（`tsc -b` なし）。型検査は source repo の CI が担う。
- `workflow_dispatch` の `ref` / `pr_number` は Actions を実行できる人だけが指定できる。Preview は `noindex`。


## Final Verdict（更新: Owner Decisions CONFIRMED + BL-2 RESOLVED）

**A. R6 ACTIVATION PLAN READY**

- OD-R6a-1〜7 CONFIRMED（§26）。A2 を採用。
- BL-2 を実物の workflow で検証（§27）: 任意 SHA の build、`VITE_PREVIEW_MODE=1` + `VITE_PREVIEW_PR` / `VITE_PREVIEW_SHA` のみ、manifest / noindex patch は current main と一致、production への逆流なし。A2 は Preview repo の変更を必要としない。
- BL-1（R5-e branch を先に merge）は OD-R6a-6 に従い次の作業（R5-e 単独 PR の merge gate）で解消する。
- R6-b 以降の実装は開始していない。

（以下は Owner Decision 前の判定。履歴として残す。）

## Final Verdict

**B. OWNER DECISION REQUIRED**

- architecture は確定可能: current main には `VITE_PREVIEW_MODE` による compile-time Preview gate、Preview-only code の production 除去、それを証明する実 build の bundle scan gate（H5-5）が既にあり、Large Catalog はそれに乗せるだけで fail-closed を満たせる（推奨 A2 は Preview repo 変更も runtime reader も不要）。
- production から hand を ON にする経路は現状 0（probe: dormant UI は ship されているが、override reader は無く、既存 Preview-only 文字列も production に 0）。
- ただし方式（OD-R6a-1）、Preview 既定（-2）、9 / 12 比較の形（-3）、rejection / keyboard の R6-c 既定（-4 / -5）、merge 順（-6、BL-1）、slice（-7）は Owner の決定が必要。BL-2 は Owner 確認のみ。

R6 implementation は開始していない。STOP.
