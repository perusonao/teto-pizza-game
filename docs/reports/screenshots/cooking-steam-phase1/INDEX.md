# Cooking Steam Phase 1 S3 — HV 証跡（画像）

Chromium（Playwright、実ポインター入力）で撮影。**WebKit・実機 iPhone Safari では未撮影**（Owner の実機 HV が必要）。動画（MP4/H.264、390×844 と 360×800、約 41 秒）は repo に commit せず Owner へ直接提出する。
入口: `?cookSteamHv=1`（Preview/DEV 限定）。`&cookSteamVariant=lid|shake` で片方に絞る。

| ファイル | 内容 |
|---|---|
| `before-iphone-*-00-clam-selected-no-steam.png` | before: あさりを選択中（蒸しの入口なし = 従来）。炙りの HV 入口で撮影 |
| `iphone-*-hv-00-entry.png` | after: `?cookSteamHv=1` — 「♨ 蒸す」ピルが帯に出る |
| `iphone-*-hv-01-sausage-keeps-sear-pill.png` | ソーセージ選択時は炙りピルのまま（蒸しピルは出ない） |
| `iphone-*-A-00-screen-idle.png` … `A-04-on-pizza.png` | 案 A（ふた）: 待機 → 蒸し中 → 殻が開く → 結果の語 → ピザ上 |
| `iphone-*-B-00-screen-idle.png` … `B-03-on-pizza.png` | 案 B（ゆすり）: 待機 → ゆすった後 → 再度ゆすって確定 → ピザ上 |
| `iphone-*-both-00-switch.png` / `both-01-mussel.png` | 両案の画面内切替（蒸し中は固定）／ムール貝の殻の色 |
| `iphone-*-bake-00-steamed-in-bake.png` / `bake-01-result.png` | 蒸し済みのまま焼成 → RESULT（焼成の filter と蒸しの filter が共存） |
| `pieces-compare-390x844-plain-*.png` | 左から 蒸さない／ちょっと開いた／ぱっくり／くたっと（3× 拡大、ピザ上のあさり） |
| `pieces-compare-390x844-bake-*.png` | 同じ 4 つを焼成中（needle ~1.7 秒）に撮影 |
