/**
 * Human Verification hub (preview-only): one page an iPhone reviewer opens to reach every W1
 * visual check in a single session. Links seed the gate's isolated save (never production's).
 */
declare const __W1_GATE_SHA__: string;

const LINKS = [
  { href: "./game.html?seed=all", label: "① ゲーム：全材料・あさり A 🦪", note: "フリークッキングで7材料＋比較対象を自由に配置 → 焼く → RESULT" },
  { href: "./game.html?seed=all&clam=dedicated", label: "② ゲーム：全材料・あさり B（専用絵）", note: "①と同じ条件で、あさりだけ専用絵" },
  { href: "./board.html", label: "③ 比較ボード", note: "焼く前/焼いた後・16px・色覚シミュレーションを1ページで比較" },
  { href: "./game.html?seed=all&w1visual=emoji", label: "（参考）前回版：トマト🍅・ケッパー🟢", note: "専用絵の前の状態" },
];

const CHECKS = [
  "トマト（専用・輪切り）とチェリートマト🍅を、トレイ / ピザ上 / 焼いた後 / RESULTで見分けられるか",
  "トマトソース（塗り）とトマト（輪切り）を取り違えないか",
  "ケッパー（小さな蕾の塊）を、ブラックオリーブ⚫・ペパロニ🔴と形で見分けられるか",
  "あさり A 🦪 と B（専用絵）：貝として読めるか / 牡蠣に見えすぎないか / にんにく・パルミジャーノと混同しないか",
  "ナス🍆がトマトソースの上・焼いた後に沈まないか",
  "コーン🌽・パイナップル🍍・じゃがいも🥔がチーズの上・焼いた後に読めるか",
  "材料が多い状態（トレイ3ページ）でも画面が崩れず、RESULTまで行けるか",
];

export function Hub() {
  return (
    <main style={{ font: "15px/1.5 system-ui, sans-serif", padding: "16px", maxWidth: 480, margin: "0 auto", color: "#3a2616", background: "#fbf5ea", minHeight: "100vh", boxSizing: "border-box" }}>
      <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>W1 材料ビジュアル確認（Preview）</h1>
      <p style={{ fontSize: 11, margin: "0 0 12px", color: "#7a0078", wordBreak: "break-all" }} data-testid="w1-hub-sha">
        source: {__W1_GATE_SHA__} · 本番のセーブとは別保存
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px" }}>
        {LINKS.map((link) => (
          <li key={link.href} style={{ margin: "0 0 10px" }}>
            <a href={link.href} style={{ display: "block", padding: "12px", borderRadius: 12, background: "#fff", color: "#6b4226", textDecoration: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}>
              <strong>{link.label}</strong>
              <span style={{ display: "block", fontSize: 12, color: "#8a6a4a" }}>{link.note}</span>
            </a>
          </li>
        ))}
      </ul>
      <h2 style={{ fontSize: 15, margin: "0 0 6px" }}>確認すること</h2>
      <ol style={{ paddingLeft: 20, margin: 0, fontSize: 13 }}>
        {CHECKS.map((check) => (
          <li key={check} style={{ margin: "0 0 6px" }}>{check}</li>
        ))}
      </ol>
    </main>
  );
}
