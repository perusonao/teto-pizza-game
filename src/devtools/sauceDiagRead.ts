/**
 * Sauce diagnostic (Issue #524 Owner HV), the READ side. Preview / DEV only (./SauceDiag.tsx is its one caller, behind a static env gate).
 *
 * Strictly read-only: it reads the sauce canvases of the first `.pizza-dough` (their pixels through `getImageData`, their computed style), whether a dot
 * fallback is on screen, and a plain snapshot of the pizza's sauce data it is handed. It never draws, never writes a canvas / storage / cookie, never
 * touches the network and never calls the game's dispatch. Every read is guarded: a failure becomes an `ERR:` token in that line, never an exception.
 */
export interface SauceDiagFacts {
  /** `pizza.sauceIds`: the kinds committed so far, first-use order. */
  sauceIds: readonly string[];
  /** `pizza.sauceDeposits`, reduced to what the report needs. `ingredientId` is absent on a one-kind pizza. */
  deposits: readonly { amount: number; ingredientId?: string }[];
}

const errName = (e: unknown): string => String((e as { name?: string } | null)?.name ?? e).slice(0, 18);
const pad = (n: number) => (n < 10 ? "0" : "") + n;

/** Data side: how many deposits (and how much amount) each sauce kind has in the pizza's own log. */
export function dataLine(facts: SauceDiagFacts): string {
  const per = new Map<string, { n: number; amount: number }>();
  const only = facts.sauceIds.length === 1 ? facts.sauceIds[0] : "?";
  for (const d of facts.deposits) {
    const key = d.ingredientId ?? only;
    const cur = per.get(key) ?? { n: 0, amount: 0 };
    cur.n += 1;
    cur.amount += Number.isFinite(d.amount) ? d.amount : 0;
    per.set(key, cur);
  }
  const parts = Array.from(per, ([k, v]) => `${k.slice(0, 7)}=${v.n}/${v.amount.toFixed(1)}`);
  return `DATA ids=[${facts.sauceIds.map((s) => s.slice(0, 7)).join(",")}] dep(n/amt) ${parts.join(" ") || "-"}`;
}

/** Screen side: one line per canvas inside the first `.pizza-dough` (px = pixels with alpha > 8), plus a header line. Never throws. */
export function screenLines(doc: Document, win: Window, seq: number, now: Date): string[] {
  const out: string[] = [];
  let canvases: HTMLCanvasElement[] = [];
  let fallback = -1;
  let ios = "?";
  try {
    const m = /OS (\d+[_\d]*)/.exec(win.navigator.userAgent || "");
    if (m) ios = m[1];
  } catch {
    ios = "ERR";
  }
  try {
    const dough = doc.querySelector(".pizza-dough");
    canvases = dough ? Array.from(dough.querySelectorAll("canvas")) : [];
    fallback = doc.querySelectorAll("[data-sauce-fallback]").length;
  } catch {
    canvases = [];
  }
  let area = 0;
  const lines = canvases.map((c, i) => {
    let s = `c${i} `;
    try {
      const st = win.getComputedStyle(c);
      const kind = /kind-([a-z-]+)/.exec(c.className)?.[1] ?? "1";
      let px: string | number = "?";
      try {
        const ctx = c.getContext("2d");
        if (ctx) {
          const a = ctx.getImageData(0, 0, c.width, c.height).data;
          let n = 0;
          for (let j = 3; j < a.length; j += 4) if (a[j] > 8) n += 1;
          px = n;
        } else px = "noctx";
      } catch (e) {
        px = `ERR:${errName(e)}`;
      }
      area += c.width * c.height;
      s += `${kind.slice(0, 6)}${c.className.includes("--oil") ? "*" : ""} px=${px} v=${st.visibility.charAt(0)} o=${st.opacity} d=${st.display.slice(0, 3)} f=${st.filter === "none" ? "-" : st.filter.slice(0, 9)}`;
    } catch (e) {
      s += `ERR:${errName(e)}`;
    }
    return s;
  });
  out.push(`#${seq} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ios=${ios} dpr=${win.devicePixelRatio} h=${win.innerHeight} fb=${fallback} n=${canvases.length} area=${area}`);
  for (const l of lines) out.push(` ${l}`);
  return out;
}

/** The whole report for one tap: screen header, data line, one line per canvas. */
export function buildSauceDiagReport(doc: Document, win: Window, seq: number, now: Date, facts: SauceDiagFacts): string[] {
  const [head, ...canvasLines] = screenLines(doc, win, seq, now);
  let data: string;
  try {
    data = dataLine(facts);
  } catch (e) {
    data = `DATA ERR:${errName(e)}`;
  }
  return [head, ` ${data}`, ...canvasLines];
}
