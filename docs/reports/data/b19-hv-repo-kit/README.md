# teto-pizza-game-preview-b19 — Batch 19（PR #783）iPhone Safari 実機 HV 専用サイト

Owner 判断（Issue #774 / #783）に基づく、**検証専用・一時的**な GitHub Pages サイトです。Production（`/teto-pizza-game/`）と共有 Preview（`/teto-pizza-game-preview/`）の URL・内容・保存には触れません。

- 配信元: `perusonao/teto-pizza-game` の **固定コミット `8137dc3ba61d636d777b05596b8866f5a74a9d03`**（B19 シード入りブランチ。PR #783 の `abb3da5a1021b160b2ee75acbe5a00866a8a0eaf` の上に Preview 専用シードを足したもの）。
- ソースへの追加差分は `patches/b19-save-key.patch` の 1 つだけ（ビルド時に保存キーを `teto-pizza-b19-hv-save-v1` へ分離。Preview ビルドでのみ有効）。
- URL（デプロイ後）:
  - `https://perusonao.github.io/teto-pizza-game-preview-b19/?hv=b19-pesto-burrata`
  - `https://perusonao.github.io/teto-pizza-game-preview-b19/?hv=b19-crudaiola`

## iPhone だけでの手順（Owner）
1. 公開前: Settings → Pages → Source を **GitHub Actions** にする。可能なら Settings → Environments → `github-pages` に **Required reviewers（自分）** を設定（使えなければ未設定でよい。その場合、手動実行そのものが Gate）。
2. Actions → **Deploy B19 HV site** → Run workflow → `confirm` に `DEPLOY` と入力 → 実行。build ジョブが `verify-site.sh` で自動検査し、通った場合だけ deploy へ進む（Reviewer を設定していれば承認を求められる）。
3. **Safari のプライベートタブ**で上の URL を開く（通常タブでは開かない: 同じ `perusonao.github.io` の origin で、本番の保存と同じ保管領域に並ぶため）。
4. 画面のバッジが `PREVIEW · PR#783 · 8137dc3` であることを確認。違う／出ないときは中止。`/preview-info.json` の `sourceSha` も 40 桁で確認できる。
5. 確認項目は PR #783 の Result Report §9（Shop の NEW、Research 名、2 層ソース、チーズ区別、焼成〜図鑑、ヒント）。390×844 の画面録画は Owner が保管（repo に入れない）。判定は Owner が記録。
6. 注意: URL を新しく開くと再シードされ、reload・戻る操作では再シードされない。進行をやり直すにはタブを閉じて開き直す。

## 終了（公開停止）
- Actions → **Stop B19 HV site** → Run workflow → `confirm` に `STOP`。サイトが「終了しました」の静的ページに置き換わる（アプリ・保存へのアクセスは無くなる）。
- 完全に止める: Settings → Pages で公開を止める、またはリポジトリを削除（Settings → General → 最下部）。
- Safari のプライベートタブは閉じれば保存が消える。

## 安全性の評価（公開 URL）
- 誰でも URL を知れば開ける。`noindex` は検索対策で、アクセス制限ではない。
- 中身は公開リポジトリのゲーム本体と Preview 専用のシードのみ。秘密情報・Firebase の値・トークンはサイトにもビルドにも含まれない（`verify-site.sh` が API キー形式の文字列と本番／共有 Preview の保存キー文字列の混入を検査）。サーバー側の状態はなく、保存は閲覧者の端末の中だけ。
- 実行時の外部通信は 0 件（ローカル検証で全リクエストを記録）。ランキング等の本番サービスへの書き込み経路はない。
- 残る性質: origin は他の Pages サイトと共通（`perusonao.github.io`）。このサイトのコードは本番と同じソースで、本番・共有 Preview の保存キーを読み書きしないことをテストしているが、origin 共有そのものは変えられないため、**プライベートタブでの使用を必須**とする。
- 期限: HV 終了後すぐ停止する。長期に残さない。

## 検査（ビルドごとに自動実行）
`scripts/verify-site.sh`: index.html の参照が base 配下で実在／noindex／manifest の start_url・scope／本番パスの残存なし／保存キー文字列（B19 のみ存在、本番・共有 Preview は不在）／API キー形式なし／preview-info.json の SHA／シード ID の存在。
