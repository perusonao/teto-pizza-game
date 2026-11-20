# D-ING-1 R1 — rider 登録簿（`riderRegistry`）のテスト設計（#780、docs-only・設計のみ）

2026-11-09 / 基準 `origin/main` = `719428e0`。**テスト設計であり、R1 の実装承認ではない。** コード・テスト・golden・HOT ファイルは変更していない。Owner は 2026-11-09 に「R1 のテスト設計を docs-only で開始する」ことだけを承認した。D-ING-1a（案 D で進めるか）と rider 上限（D-ING-1b）の正式な決定、および R1 の実装は未承認。

親設計: `docs/design/TETO_DING1_INGREDIENT-FIRST_DESIGN_2026-11-08.md`（§3.4 の R1 = 「`riderRegistry.ts`（空）＋型＋検証緩和＋免除テスト。**挙動不変**」）。凡例: 【実測】コードの読取り、【設計案】本書の提案、【未確認】測っていない。

---

## 1. R1 が守るべき不変条件【設計案】

| ID | 不変条件 | 意味 |
|---|---|---|
| INV-0 | **registry が空のとき、出荷される挙動は現行と完全に同一** | R1 の合格条件の本体。型・検証が増えても、ラダー・Shop・保存・Research・Hint の出力が 1 文字も変わらない |
| INV-1 | rider の免除は `UNUSED_MATERIAL` だけ | `validateDiscoveryLadder`・`validateLadderProgression` の他の規則（`KEY_RECIPE`・`SOFTLOCK`・`UNREACHABLE`・`STARTER_IN_LADDER`・重複解放）は緩めない |
| INV-2 | 既存 step は凍結（LAD-1） | `validateAppendOnlyExtension` が rider を含む同一比較で、固定 step の変更・削除・並べ替えを検出する |
| INV-3 | 宿主が出荷されたら registry から自動で外れる | 掃除忘れが CI で落ちる（親設計 §3.1-3） |
| INV-4 | 保存は読む側が壊れない | 未知の id・未来の id は落とされても、保存領域には残る（ロールバック保護） |

## 2. 検証ケース（Owner 指定の 4 領域）

実測した既存の仕組みを土台にする: ラダー検証 `validateDiscoveryLadder`（重複解放の検出）、`validateAppendOnlyExtension`（固定 step の比較）、`validateLadderProgression`（`UNUSED_MATERIAL` ほか）【実測: `src/logic/discoveryLadder.ts`】、保存の整形 `sanitizeOwnedIngredientIds`（既知 id だけを残し、先頭に starter を置く）・`sanitizeUnlockedForShopIngredientIds`（未知 id は返さないが保存領域には残る）【実測: `src/state/persistence.ts`】、入手可能な食材 `obtainableIngredientIds`【実測: `src/state/materialEntitlement.ts`】。

### 2.1 保存互換性（SAVE）
| ID | ケース | 期待 | 置き場所（案） |
|---|---|---|---|
| SAVE-1 | registry が空で、現行の保存（schema v2）を読む | 読み出しの結果が現行実装と一致（`ownedIngredientIds` の順序・`unlockedForShopIngredientIds`・Dex が不変） | 新規 `src/state/riderSaveCompat.test.ts` |
| SAVE-2 | rider id を含む保存を、registry が空（rider を知らない）の状態で読む | rider id は整形後の配列から消えるが、**保存領域には残る**（`extractForwardCompatExtras` → `writeSave` で書き戻しても失われない） | 同上 |
| SAVE-3 | SAVE-2 の保存を書き戻し、rider を知っている状態で読み直す | 元の所持順序が完全に復元される（`mergeOwnedOrder` は id を前にも後ろにも動かさない） | 同上 |
| SAVE-4 | schema バージョンの据え置き | R1 では `CURRENT_SCHEMA_VERSION`（現状 2）を上げない。上げる必要が出たら停止 | 同上（定数の固定） |
| SAVE-5 | starter 集合は増えない | `STARTER_INGREDIENT_IDS` が rider によって増えないこと（新 starter は時刻 0 から所持扱いになる） | 同上 |
| SAVE-6 | Deduction Hint の「各目標が作れるようになった時点の所持」の復元 | rider が所持順に入っても、`makeablePrefix`（`deductionGuard.ts`）の結果が rider なしの保存と矛盾しない【未確認: 実際の rider 入り所持順で測る必要がある】 | 新規（R2 の測定とあわせる） |

### 2.2 登録重複（DUP）
| ID | ケース | 期待 |
|---|---|---|
| DUP-1 | 同じ食材が registry に 2 回 | 検証エラー（登録の重複） |
| DUP-2 | rider が他の step の `ingredientIds` にも載っている | 既存の「同じ食材は 1 つの step にだけ」規則（`validateDiscoveryLadder`）で落ちる。免除はこの規則を緩めない（INV-1） |
| DUP-3 | rider の食材 id が出荷済みカタログ（本番レシピが使う食材）に既に在る | 検証エラー（rider は未出荷の宿主のための食材。出荷済みは registry に載せない） |
| DUP-4 | 同じ step に載せる rider が上限を超える | 検証エラー（上限は D-ING-1b の決定値。案は 4。決定まではテストのパラメータにしてハードコードしない） |
| DUP-5 | `hostRecipeId` が出荷済みレシピ | 検証エラー（INV-3 の自動掃除。外し忘れの検出） |
| DUP-6 | `hostRecipeId` が staged に存在しない | 検証エラー |
| DUP-7 | 1 つのレシピを宿主とする rider が、そのレシピの材料と無関係 | 検証エラー（宿主の材料に含まれない食材は rider にできない）【設計案: 親設計に明記は無いので、Owner 判断の候補】 |

### 2.3 ラダー整合性（LAD）
| ID | ケース | 期待 |
|---|---|---|
| LAD-1 | registry が空のとき、本番ラダー全体の構造（step 番号・種別・材料・key レシピ・星ゲート）を固定のスナップショットと比較 | 完全一致（INV-0）。スナップショットは R1 の PR 内で生成し、`appendLadderSteps` 経由でも同一になること |
| LAD-2 | 固定 step に rider を後付けする | `FIXED_STEP_CHANGED`（`validateAppendOnlyExtension`。`sameStep` が rider を含めて比較すること） |
| LAD-3 | rider を載せても `KEY_RECIPE` は変わらない | key レシピは宿主のまま、その step で新たに完成する（`before` に無く `after` に在る） |
| LAD-4 | rider を載せても `SOFTLOCK` を起こさない | step *s* の時点で作れるレシピが *s* 以上（rider はレシピを増やさないので、同じ数のまま） |
| LAD-5 | スラック | クレジット済みレシピ数 − step 数 − 直接ゲート済み 2 が `ACCEPTED_MIN_SLACK`（1）以上のまま。rider は step を増やさないので不変であること【実測: `ladderReachability.starGate.test.ts` の最小値】 |
| LAD-6 | rider は `ingredientIds` の key 材料より前に置く | コホートキー（step の最後の材料）が rider で変わらない。**Research ラベルの文字が動かないこと**は R2 の what-if で実測【未確認】 |
| LAD-7 | late step に rider を載せる場合 | `LATE_ENTITLEMENT_FLOORS` に固定値が要る（親設計 C8）。R1 では late への rider を**認めない**（登録簿の `addedInStepKey` が通常 step のみ）【設計案】 |
| LAD-8 | `UNUSED_MATERIAL` の免除範囲 | registry に載る食材だけが免除され、載らない未使用食材は従来どおり落ちる（INV-1 の核心。変異検査 M-1・M-2 とセット） |
| LAD-9 | 「入手可能な食材 = 本番レシピが使う食材」の不変条件の改定 | `ingredientCollectionCount.test.ts` の "parity" を「+ registry の rider」に改定してもなお、rider でない食材の過不足は検出できること |

### 2.4 旧データ移行（MIG）
| ID | ケース | 期待 |
|---|---|---|
| MIG-1 | v1 の保存 → v2 への移行（`migrateV1toV2`）→ R1 の読み出し | 既存の移行結果と一致（R1 は移行を変えない） |
| MIG-2 | R1 以前に書かれた v2 の保存（rider なし）を、R1 のビルドで読み、そのまま書き戻す | バイト単位で同一の保存になる（不要な再整形をしない） |
| MIG-3 | R1 の保存を、R1 以前のビルドで読む（ロールバック） | 既知の id だけが残り、未知の id は保存領域に残る。Dex は raw を保持（PR #674 の保護）【実測: 親設計 §3.2 の記述。実際のテストで固定する】 |
| MIG-4 | 宿主が出荷された後、その rider を所持している保存 | rider は通常の食材として所持扱いのまま。所持順序・Shop の購入済み判定・在庫が変わらない |
| MIG-5 | rider を `unlockedForShopIngredientIds` に持つ保存で、step 到達前に宿主の出荷で registry が外れる | 解放の記録は食材 id 単位なので影響しない（step 番号に依存しないこと）【未確認: 該当コードで step 番号を保存していないかを確認する】 |

## 3. 変異検査（テストが本当に守っているかの確認）【設計案】
実装後に、次の変異を 1 つずつ入れて、対応するテストが**必ず落ちる**ことを確認する（DRIZZLE D1 の 6 種と同じ方式）。
- M-1: 免除を全食材に広げる（`UNUSED_MATERIAL` を無効化）→ LAD-8 が落ちる
- M-2: registry の照合を `ingredientId` でなく `hostRecipeId` で行う → DUP-1・LAD-8 が落ちる
- M-3: `sameStep` から rider の比較を外す → LAD-2 が落ちる
- M-4: 宿主出荷後の自動掃除を外す → DUP-5 が落ちる
- M-5: rider を key 材料の後ろに置けるようにする → LAD-6 が落ちる
- M-6: rider 上限の判定を `>=` と `>` で取り違える → DUP-4 が落ちる
- M-7: 保存の整形で未知 id を保存領域からも消す → SAVE-2・MIG-3 が落ちる

## 4. 「本番が変わらない」ことの確認方法【設計案】
1. **ラダーのスナップショット**（LAD-1）: R1 の PR で、変更前の main から生成した固定値と比較する。
2. **本番バンドルの比較**: `dist` のハッシュを R1 の前後で比較し、registry が空の間は rider の名前が本番バンドルに現れないこと（0 件）を確認する（#776 D1 の「本番バンドルに D1 の名前なし」と同じ方式）。
3. **全 Vitest・型検査・build・Chromium／WebKit E2E** は通常どおり。HV は不要の見込み（UI を変えない。HV Policy §2 の判定は PR で確認）。

## 5. 実施順序と HOT 競合の回避【設計案】
- R1 が触る HOT は `src/data/discoveryLadder.ts`・`src/logic/discoveryLadder.ts` の 2 つ。**B22 の HOT 編集（同じ `discoveryLadder.ts` を触る）と競合する**ため、B22 の merge 後に R1 を始める（直列）。
- 本書（設計）と、新規テストファイルの下書き（`src/state/riderSaveCompat.test.ts` など、registry が空なら現行と同一であることを固定するテスト）は並行できる。ただし本書の段階では**テストファイルを作らない**（実装承認前）。
- 他の open PR との重なりは本書の範囲では無い（docs のみ）。

## 6. 未確認・Owner 判断の候補
| 項目 | 内容 |
|---|---|
| D-ING-1a・1b | 案 D で進めるか／rider 上限（推奨 4）。R1 の実装はこの決定の後 |
| DUP-7 | rider は宿主の材料に含まれる食材に限るか（親設計に明記なし） |
| LAD-7 | R1 では late への rider を認めない扱いで良いか |
| SAVE-6・MIG-5 | rider 入りの所持順での Deduction Hint の復元、解放記録が step 番号に依存しないこと（実コードで測定する） |
| R2 の測定 | LAD-6（Research ラベル）・Hint 5.0・DH4・経済は staged の what-if ハーネス（`whatIfSupport.ts`）で rider 付きを実測してから判断 |

---

## 7. Owner 決定の反映と Gate の確定（2026-11-10）【設計案：Gate の合否基準】

**決定の反映**: D-ING-1a（案 D、R1 まで）・D-ING-1b（上限 4）・DUP-7（宿主の材料に限る）・LAD-7（late への rider は R1 では認めない）は承認済み（`TETO_DING1_DECISION-PROPOSAL_2026-11-10.md` §4）。これにより上の §2 は次のとおり確定する:
- **DUP-4**: 上限は定数 `RIDER_MAX_PER_STEP = 4`（1 か所）。テストは定数に追従し、`>=`／`>` の取り違え（M-6）を境界値（4 と 5）で検出する。
- **DUP-7**: 「rider の食材が宿主レシピの `requiredIngredients` に含まれない」は**検証エラー**（必須ケース、設計案の候補ではなくなった）。
- **LAD-7**: `addedInStepKey` は通常 step のみ。late step への登録は**検証エラー**（必須ケース）。late への rider は R3 以降で別途承認。
- **基準の更新**: LAD-1（ladder のスナップショット）は B22 後の main（通常 73・全 86 step）から生成する。B23 が先に merge されるなら B23 後の main から（HOT の直列）。

### Gate 1 — 保存互換（R1 の merge 条件。全部 PASS）
| Gate | 合格基準（測定方法） |
|---|---|
| G1-1 | registry が空のとき、現行の保存（schema v2）の読み出しが現行実装と**バイト単位で一致**（SAVE-1・MIG-2）。保存の再書き込みも同一 |
| G1-2 | 未知の rider id を含む保存を、registry を知らない状態で読むと、整形後の配列からは消えるが**保存領域には残る**（SAVE-2・MIG-3。`extractForwardCompatExtras`→`writeSave` の往復） |
| G1-3 | G1-2 の保存を、rider を知っている状態で読み直すと**所持順序が完全に復元**（SAVE-3） |
| G1-4 | `CURRENT_SCHEMA_VERSION` は 2 のまま（SAVE-4）。上げる必要が出たら**停止して報告** |
| G1-5 | `STARTER_INGREDIENT_IDS` は rider で増えない（SAVE-5） |
| G1-6 | 宿主が出荷された後、その rider を所持している保存は通常の食材として扱われ、所持順序・購入済み判定・在庫が不変（MIG-4・MIG-5。解放の記録が step 番号に依存しないこと） |
| G1-7 | SAVE-6（rider 入りの所持順での Deduction Hint の復元）は **R1 では実測不要**（registry が空）。R2 の what-if で実測し、矛盾があれば R3 を止める |

### Gate 2 — Research への影響（R2 の合格条件。R1 は registry 空で影響 0 を確認するだけ）
| Gate | 合格基準 |
|---|---|
| G2-1（R1） | registry が空のとき、全レシピの Research ラベル（全 prefix・正準順、既定の 40 本の seeded random 順）が**現行と完全に同一**（変化 0。`researchLetterChangesAcrossOrders`） |
| G2-2（R2） | rider を載せた what-if（`whatIfSupport.ts`）で、**正準順（ladder の順）で文字が変わる出荷済みレシピが 0**（LAD-6：rider は key 材料より前に置くので cohort キーは動かないはず）。1 件でも出れば**停止** |
| G2-3（R2） | 非正準順で文字が変わる出荷済みレシピは、**ID 別に before→after を提示し、Owner の個別承認**を得る（B21・B22・B23 と同じ方式。承認前は merge しない） |
| G2-4（R2） | Hint 5.0（key-free ladder、family 分布）・DH4・経済シミュレーションの既存項目が動かない（golden は挿入のみ）。動く場合は停止 |

**停止条件（追加）**: G1-4 が破れる／G2-2 が 1 件でも出る／registry の自動掃除（INV-3）のテストが組めない場合は、実装を止めて報告する。

