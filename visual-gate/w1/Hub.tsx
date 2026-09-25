/**
 * Human Verification hub (preview-only): one page an iPhone reviewer opens to reach every W1
 * visual check in a single session. Links seed the gate's isolated save (never production's).
 */
declare const __W1_GATE_SHA__: string;

/** Slice 3: only fresh-tomato is still open. clam B / capers / eggplant / corn / pineapple /
 *  potato are Human PASS (clam Owner Decision = DEDICATED_CLAM_B), so every link uses clam B. */
const LINKS = [
  { href: "./game.html?seed=all&clam=dedicated", label: "① ゲーム：トマト B（Final候補）", note: "フリークッキングでトマト・チェリートマト・ペパロニ・トマトソースを同じピザに → 焼く → RESULT" },
  { href: "./game.html?seed=all&clam=dedicated&tomato=a", label: "② ゲーム：トマト A（前回候補）", note: "①と同じ条件で、トマトだけ前回の絵（サラミ風に見えた方）" },
  { href: "./board.html", label: "③ 比較ボード（トマト A / B）", note: "トレイ・焼く前/焼いた後/深焼き・16px・グレースケール・色覚シミュレーション" },
];

const CHECKS = [
  "トマト B が「トマトの輪切り」に見えるか（サラミ・ペパロニに見えないか）",
  "トマト B とペパロニ🔴を、ピザ上で形で見分けられるか",
  "トマト B とチェリートマト🍅を、トレイ / ピザ上 / 焼いた後 / RESULTで見分けられるか",
  "トマトソース（塗り）とトマト B を取り違えないか",
  "焼いた後・深く焼いた後・小さい表示（RESULTの材料リスト）でも読めるか",
  "iOSのカラーフィルタ（グレイスケール）でもトマト B とペパロニを見分けられるか",
  "A と B を見比べて、B の方が良いか",
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
