# B案 Phase 4b ステップ3 — Dinner と判明の精算

ステップ2の #924 が入った `main` の `d00755a5` を基点に、設計 §4 を実装した。[設計 §4](../design/TETO_SHOP-GROWTH_PHASE4_SWITCH_DESIGN_2026-11-28.md#4-特別注文の二つの精算)

shop の Dinner 結果は、クリア記録・Pitz・評判の書き戻しを確認してから表示する。保存先が容量超過などで書き込めない場合は、制限時間内に最後の確認をやり直せる。Dinner 記録が破損している場合は既存のクリア時の報酬停止を使う。

HOME 到達時に保存済みの評判と未払いの判明レシピを読み、`settleAwaitingMenu` で精算する。連鎖後の評判から入荷を導き、Pitz・評判・支払済み ID とともに保存する。保存が確定したときに HOME の案内を表示する。

## 390×844 の画面比較

| 画面 | 変更前 | 変更後 |
| --- | --- | --- |
| Dinner 結果 | [GOLD、+250 Pitz・評判 +5](screenshots/b-phase-4b-dinner-settlement/before/08-dinner-result.png) | [同じ Dinner 報酬](screenshots/b-phase-4b-dinner-settlement/after/08-dinner-result.png) |
| HOME | [残高 750 Pitz、評判 44](screenshots/b-phase-4b-dinner-settlement/before/09-home-menu-entry.png) | [専用案内、残高 800 Pitz、評判 47](screenshots/b-phase-4b-dinner-settlement/after/09-home-menu-entry.png) |

## Human Verification Videos

| 動画 | Viewport | 時間 | サイズ | Codec | Video Verification |
| --- | --- | --- | --- | --- | --- |
| `teto-phase-4b-dinner-390x844.mp4` | 390×844 | 1:47.48 | 1,622,351 bytes | H.264 | PASS |

ダウンロードはセッションの動画リンクを参照。録画はローカル Chromium で行い、画面全体と最終フレームまでのデコードを確認した。

- Dinner を選び、4品を調理して、結果で GOLD・+250 Pitz・評判 +5 を確認できる。
- 結果から HOME に戻ると、トンノ・エ・チポッラのメニュー入り案内に +50 Pitz・評判 +3 が表示され、評判 47 と残高 800 Pitz に更新される。

Video Verification: PASS

Owner の実機判定は未実施。
