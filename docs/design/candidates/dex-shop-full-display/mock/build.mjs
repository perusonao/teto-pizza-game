// Generates static mock pages (pages/*.html). Design mock only -- not imported by src/.
// Locked slots are produced by ONE function with NO per-item input, so every locked slot is
// byte-identical and the pages cannot contain a locked identity. Only "discovered / entitled"
// placeholder rows carry names (those are visible in the real game too).
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";

const SIL = `<svg class="sil" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="22" fill="#e6d8b8" stroke="#c4ae82" stroke-width="2"/><circle cx="24" cy="24" r="16" fill="#f1e7cf"/><path d="M24 8v32M10.1 16l27.8 16M10.1 32l27.8-16" stroke="#c4ae82" stroke-width="1.5" fill="none"/></svg>`;

const lockedDex = (n) => `<div class="lock lock--dex" data-dex-state="UNKNOWN">${SIL}<span class="no">No.${String(n).padStart(2, "0")}</span><span class="q">🔒 ？？？</span><span class="tagline" hidden></span></div>`;
// B shows the existing tag line "まだ見ぬピザ"; A omits it (density) -- see README deviation note.
const lockedDexB = (n) => `<div class="lock lock--dex" data-dex-state="UNKNOWN">${SIL}<span class="no">No.${String(n).padStart(2, "0")}</span><span class="q">🔒 ？？？</span><span class="tagline">まだ見ぬピザ</span></div>`;
const lockedShop = () => `<li class="lock lock--shop">${SIL}<span class="lbl"><span>🔒</span><span class="q">？？？</span></span></li>`;

const recipes = [...readFileSync(new URL("../../../../../src/data/recipes.ts", import.meta.url), "utf8").matchAll(/^\s{4}nameJa: "([^"]+)"/gm)].map((m) => m[1]);
const CHAPTERS = [6, 11, 16, 20]; // production chapter sizes (53 recipes)

function dex(v, per) {
  const found = per.reduce((a, b) => a + b, 0);
  let nameIdx = 0;
  const lock = v === "a" ? lockedDex : lockedDexB;
  const secs = CHAPTERS.map((size, ci) => {
    const d = per[ci];
    // Early discoveries sit at the low (earlier-declared) slots of a chapter; one earlier slot stays
    // undiscovered so the mix is realistic. Slot position is fixed in the real Dex (No. = position).
    const foundAt = new Set(d >= 3 && d < size ? [0, ...Array.from({ length: d - 1 }, (_, k) => k + 2)] : Array.from({ length: d }, (_, k) => k));
    let tagDone = false;
    const cells = [];
    for (let i = 0; i < size; i++) {
      const no = i + 1;
      if (foundAt.has(i)) {
        const stars = 1 + ((nameIdx + i) % 3);
        cells.push(v === "a"
          ? `<div class="card card--found"><h3>${recipes[nameIdx++]}</h3><span class="meta"><span class="stars">${"★".repeat(stars)}</span></span></div>`
          : `<div class="card card--found"><h3>${recipes[nameIdx++]}</h3><span class="meta"><span class="stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</span> <span class="best">ベスト ${80 + ((no * 7) % 20)}点</span></span></div>`);
      } else if (found > 10 && ci === 1 && !tagDone) {
        tagDone = true; // mid state: one single DISCOVERABLE slot (existing 🎨 tag + 💡 CTA), full row
        cells.push(`<div class="card tag-card" data-dex-state="DISCOVERABLE">${SIL}<div class="t"><span class="lbl">No.${String(no).padStart(2, "0")} ？？？</span><span class="hint">🎨 今の材料で作れるかも</span><button class="cta">💡 ヒントを見る</button></div></div>`);
      } else cells.push(lock(no));
    }
    return `<section class="chapter"><h3 class="chapter__title"><span>第${ci + 1}章</span><span class="chapter__count">${d}/${size}${d === size ? " ✓" : ""}</span></h3>
<div class="dex-grid">${cells.join("")}</div></section>`;
  }).join("\n");
  const total = 53;
  return `<div class="progress"><div class="progress__row"><p class="progress__count">🍕 発見 ${found} / ${total}</p><p class="progress__sub">あと${total - found}種類！</p></div><p class="progress__stars">⭐ 合計★ ${found * 2}</p></div>\n${secs}`;
}

const OWN = [["🥓", "ベーコン", "肉系"], ["🧅", "たまねぎ", "野菜・きのこ系"], ["🥚", "たまご", "ちょっと変わった材料"], ["☘️", "パセリ", "ハーブ・香味系"], ["🫑", "ピーマン", "野菜・きのこ系"], ["🥒", "ズッキーニ", "野菜・きのこ系"], ["🥜", "アーモンド", "ちょっと変わった材料"], ["🍄", "マッシュルーム", "野菜・きのこ系"], ["🌽", "コーン", "野菜・きのこ系"], ["🍍", "パイナップル", "果物系"], ["🧄", "ガーリック", "ハーブ・香味系"], ["🌶️", "ハラペーニョ", "スパイス・薬味系"]];
const row = (v, e, state, i) => {
  const [g, n, f] = e;
  const isNew = state === "NEW";
  const btn = isNew ? `<button class="buy">仕入れる</button>` : `<button class="buy buy--restock">補充する</button>`;
  const price = `${isNew ? "初回" : "補充"} 🪙 ${isNew ? 100 : 50} Pitz`;
  const stock = isNew ? "" : `<span class="fam">在庫 ${3 + (i % 7)}</span>`;
  if (v === "a")
    return `<div class="item${isNew ? " item--new" : ""}"><div class="row"><span class="name">${g} ${n}${isNew ? ' <span class="badge">NEW 入荷</span>' : ""} <span class="fam">${f}</span></span>${stock}</div><div class="row"><span class="pack">🍕 20ピザ分 · <span class="price">${price}</span></span>${btn}</div></div>`;
  return `<div class="item${isNew ? " item--new" : ""}"><div class="row"><span class="name">${g} ${n}${isNew ? ' <span class="badge">NEW 入荷</span>' : ""}</span>${stock}</div><span class="fam">${f}</span><div class="row"><span class="pack">${isNew ? "" : "+"}🍕 20ピザ分</span><span class="price">${price}</span></div>${btn.replace("<button", '<button style="align-self:flex-end"')}</div>`;
};

function shop(v, { newN, ownedN, lockedN, hints, tab = "すべて", balance }) {
  const ent = [];
  for (let i = 0; i < newN + ownedN; i++) ent.push(OWN[i % OWN.length]);
  const rows = ent.map((e, i) => row(v, e, i < newN ? "NEW" : "OWNED", i)).join("");
  const tabs = ["すべて", "ソース", "チーズ", "具材"].map((t) => `<button class="chip" role="tab" aria-selected="${t === tab}">${t}</button>`).join("");
  const locked = lockedN > 0 ? `<section class="locked" aria-label="未解禁の材料" data-shop-locked-section>
<h3>🔒 まだ入荷していない材料</h3>
<div class="hints">${hints.map((h) => `<p class="hint-box">${h}</p>`).join("")}</div>
<ul class="locked-grid">${Array.from({ length: lockedN }, lockedShop).join("")}</ul></section>` : "";
  return `<div class="balance">🪙 ${balance} Pitz</div>
<div class="chips" role="tablist">${tabs}</div>
<div class="shop-list">${rows}</div>
${locked}`;
}

const D = (n) => `🔜 あと${n}つ発見で新しい材料が入荷`;
const S = (n) => `⭐あと${n}個で新しい材料が入荷`;
const SHOP_STATES = {
  initial: { newN: 1, ownedN: 2, lockedN: 51, hints: [D(1)], balance: "300" },
  mid: { newN: 1, ownedN: 11, lockedN: 42, hints: [D(2)], balance: "1,240" },
  "mid-topping": { newN: 1, ownedN: 11, lockedN: 42, hints: [D(2)], tab: "具材", balance: "1,240" },
  late: { newN: 0, ownedN: 50, lockedN: 4, hints: [D(1), S(20)], balance: "5,800" },
  full: { newN: 0, ownedN: 54, lockedN: 0, hints: [], balance: "9,999" },
};

const page = (screen, v, state, title, inner) => `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>#422 mock ${screen}-${v}-${state}</title><link rel="stylesheet" href="../mock.css"></head>
<body class="v-${v}"><div class="backdrop"><div class="panel"><div class="panel__header"><h2>${title}</h2><button class="close">閉じる</button></div>
<div class="body">${inner}</div></div></div></body></html>`;

mkdirSync(new URL("./pages/", import.meta.url), { recursive: true });
for (const v of ["a", "b"]) {
  for (const [state, found] of [["initial", [3, 0, 0, 0]], ["mid", [6, 8, 8, 0]]])
    writeFileSync(new URL(`./pages/dex-${v}-${state}.html`, import.meta.url), page("dex", v, state, "レシピ図鑑", dex(v, found)));
  for (const [state, cfg] of Object.entries(SHOP_STATES))
    writeFileSync(new URL(`./pages/shop-${v}-${state}.html`, import.meta.url), page("shop", v, state, "食材ショップ", shop(v, cfg)));
}
console.log("ok");
