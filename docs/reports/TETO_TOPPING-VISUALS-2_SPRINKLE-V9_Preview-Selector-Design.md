# V9-2 Preview 専用切り替え（`?sprinkle=`）の設計と安全性の調査（docs-only、PR #875）

状態: **設計と安全性の調査のみ。実装はしていない（Owner V9-2: 設計・安全性の調査のみ承認、実装は HOLD）。** #875 の head（`100cfe0`）・Preview・試験ブランチのコードは、この資料のために変更していない。
目的: F1／F2／F3（と V8-1）を、**1 回の iPhone HV で切り替えて比較できる**ようにし、各案ごとの「head 更新 → Preview 作り直し → HV」の往復を減らす。

## 0. 先に結論
- **安全に作れる前例が既にある**: `?cheese=`（`src/preview/cheeseRenderMode.ts`）は、呼び出し側が `allowed = import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE`（**ビルド時に静的置換**）を渡し、本番ビルドではクエリを一切読まない。**本番バンドルに文字列が入らないことを、実際の `vite build`（本番／Preview の 2 回）で検査するゲートテスト**（`cheeseCanvasProduction.gate.test.ts`）が付いている。同じ型で作れる。
- **ただし #875 の head への反映が必要**: PR 専用 Preview の workflow は、head 以外の追加コミット（`source_sha`）では **`src/preview/` と `docs/` の変更しか許さない**。切り替えは、レイアウト関数（`placedVisuals/**`）がバリアントを受け取る必要があり、そこは `src/preview/` ではない。したがって、**比較用のプリセット（f1／f2／f3）を #875 の head に入れることが前提**（既定は V8-1 のまま、Preview 以外では切り替えられない）。
- **推奨**: 実装を承認するなら、下の「最小の設計」で作る。往復は 約 8〜9 → 約 5〜6 に減る見込み（`TETO_TOPPING-VISUALS-2_SPRINKLE-V9_Shape-Trials_Result.md` §7）。**承認しない場合は、案ごとに head を更新する現行の手順を続ける。**

## 1. 既存の仕組み（調査結果）
| 仕組み | 内容 | 今回への含意 |
|---|---|---|
| `VITE_PREVIEW_MODE` | Preview ビルドだけが設定。`PreviewBadge`・各種デバッグパネルが `import.meta.env.VITE_PREVIEW_MODE` で**静的に**ゲート（本番ビルドでは `false` に置換され、デッドコードとして除去される） | 同じゲートを使える |
| `?cheese=` | `resolveCheeseRenderMode(search, allowed)` — `allowed` が偽ならクエリを読まず既定を返す。**実ビルドの本番／Preview バンドル検査**あり | **最も近い前例**。型・テスト・検査をそのまま踏襲できる |
| `?hv=`（HV の初期データ） | `src/preview/*HvSeeds.ts` + ゲートテスト（`cookPrepHv.gate.test.ts` など） | 同じゲートテストの型 |
| PR 専用ページのビルド（`pr-page.yml`／`patch-build.sh`） | CSP（`connect-src 'self'`、worker／frame なし）、保存キーを `<key>--<slug>` に改名、`teto-`／`teto.` の未知の文字列で失敗、本番の基底パスを含むと失敗 | **新しい保存キーを作らない**（作ると `patch-storage-keys.py` の既知リストの更新が要る）。クエリだけで切り替え、保存しない |
| `source_sha`（head 以外の追加コミット） | `src/preview/` と `docs/` だけ変更可 | 切り替えのプリセット／配線は head に入れる必要がある（上記） |

## 2. 最小の設計（実装する場合）
1. **入口**: `resolveSprinkleVariant(search, allowed)`（`src/preview/` に置く、`cheese` と同じ型）。`allowed` が偽なら**クエリを読まず** `null`（既定）。真のときだけ `?sprinkle=` を**許可リスト**（`v81`｜`f1`｜`f2`｜`f3`）で解釈し、未知の値は既定。**保存しない**（毎回 URL で決まる。localStorage の新しいキーを作らない）。
2. **配線**: `ParmigianoSprinkle` が `resolveSprinkleVariant(window.location.search, import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE)` を 1 回読み、`sprinkleLayout(id, variant)` と `look` に渡す（`null` なら既存の既定＝V8-1）。**呼び出しはゲートの内側だけ**にし、本番ビルドでは分岐ごと除去される形にする。
3. **見えるラベル**: Preview バッジに、切り替えが有効なとき `sprinkle=f2` を出す（`PreviewBadge` に「どのバリアントで撮ったか」を出す前例あり）。HV の画像・動画で、どの案を見ているかが分かる。
4. **本番に入れないための構造**: プリセット（f1／f2／f3）と URL の解釈は `src/preview/` の別モジュールに置き、`placedVisuals` の既定の経路は**バリアントを受け取る引数**だけを持つ（既定の出力は V8-1 のまま、ハッシュで固定）。
5. **ゲートテスト（実ビルド）**: 本番バンドルに `?sprinkle=` の解釈の文字列・`f1`／`f2`／`f3` のプリセット名が**含まれない**こと、Preview バンドルには含まれること（`cheeseCanvasProduction.gate.test.ts` と同じ方法）。

## 3. 安全性の評価
| リスク | 評価・対策 |
|---|---|
| **本番で切り替えが効く／URL を読む** | 静的ゲート＋**実ビルドの検査**で、本番バンドルに文字列が入らないことを固定（前例と同じ）。許可リスト以外は無視 |
| **保存データ・採点・在庫・Undo への影響** | **なし**（描画のみ。配置の記録 4 フィールド・在庫・採点は不変）。新しい保存キーを作らない（PR 専用ページの保存キーの改名規則に触れない） |
| **PR 専用ページのビルドの安全チェック** | クエリ解釈と SVG の描画のみで、新しいファイル種別・worker・外部通信なし。`patch-build.sh` の検査（文字列・型・基底パス）に影響しない（実装時に Preview 用ビルドで確認） |
| **既存ピースの描き直し** | バリアントは**描画時**に決まる。配置したピースの id と位置は不変なので、URL を変えて再読み込みすれば**同じ配置を別の案で見られる**（**未検証**: 再読み込み後に調理中の配置が復元されるかは確認していない。`pendingRound` が同じ 4 フィールドを保存・復元する設計だが、実装前に実ブラウザで確認が必要） |
| **どの案を見ているか分からなくなる** | Preview バッジにラベルを出す（§2-3） |
| **バンドルサイズ・保守** | 小さい（プリセットの定数とクエリの解釈のみ）。比較が終わったらプリセットを削除する（1 コミットで戻せる） |
| **#875 の head にプリセットが入る** | **最大の論点**。既定は V8-1 のまま（ハッシュで固定）、Preview 以外では選べない。不要になれば revert。Owner の承認が要る |

## 4. 実装する場合の手順と往復
1. Owner が実装と #875 の head への反映を承認 → 2. 試験ブランチで実装（ゲートテスト・E2E・全 Vitest・WebKit・独立レビュー）→ 3. #875 の head へ非 force で反映 → 4. PR 専用 Preview を 1 回公開 → 5. Owner の HV（`?sprinkle=f2`／`f1`／`f3`／`v81` を切り替えて比較）。**約 2〜3 往復**（実装・検証 1、反映・Preview 1、HV の判断 1）。
- 実装前に確認すること: ① 再読み込み後の配置の復元（上記）② `import.meta.env` のゲートで `f1`／`f2`／`f3` の文字列が本番バンドルから消えること（ゲートテストで固定）③ Preview のビルド（`patch-build.sh` の検査）が通ること。

## 5. 判断と未確認
- **Owner 判断**: 実装を承認するか（推奨: 承認。往復を減らせる）。承認する場合は、#875 の head へプリセットを入れてよいか（別承認）。
- **未確認**: 実装していないため、本番バンドルからの除去・Preview のビルド・再読み込み後の復元は**実測していない**（前例に基づく設計）。

merge・Draft 解除・Production ON・共有 Preview 更新・force push・実装・#875 の head への push・Preview 更新は行っていません。
