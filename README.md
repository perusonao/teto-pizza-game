# テトのピザ屋さん（仮）

黒いポメラニアン「テト」がピザ職人となり、注文されたピザを自分の手で作るスマートフォン向けミニゲーム。
経営要素の拡張ではなく、「1枚のピザを作るだけで楽しい（First Fun Pizza）」体験を最優先に開発している。

- 設計ドキュメント: [`docs/design/`](docs/design/PIZZA_GAME_SSOT.md)（SSOT / MVP仕様 / データモデル / UI仕様）
- Phase 1 実装結果: [`docs/reports/PIZZA_GAME_Phase1_Result.md`](docs/reports/PIZZA_GAME_Phase1_Result.md)

## 開発

```bash
npm install
npm run dev      # http://localhost:5173 で起動
npm run build    # 本番ビルド (tsc -b && vite build)
npm run lint      # oxlint
```

スマートフォン縦画面（基準幅390px）を想定しているが、Webブラウザでもマウス操作でプレイできる。

## 技術スタック

- Vite + React + TypeScript
- 状態管理: `useReducer` によるゲーム状態機械（`src/state/gameReducer.ts`）
- レシピ・食材・セリフなどのゲームデータは `src/data/` にUIから分離して定義
- バックエンド・永続化ストレージなし（ローカル完結）
