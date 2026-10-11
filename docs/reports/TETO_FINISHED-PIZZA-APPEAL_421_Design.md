# Issue #421 — Finished Pizza Appetite Appeal: read-only audit + design proposal

Status: **Investigation + design only. No production code changed. No PR, no Preview deploy.**
Base: `origin/main` `8cb5d72`. Branch: `claude/issue-421-finished-pizza-appeal` (independent of PR #466).

## 1. Duplicate check

| Item | State | Relation |
|---|---|---|
| #186 / PR #187 Finished Pizza Visual 2.0 | closed / merged | Introduced `toppingVisualFrame`, kept `cheeseVisualFrame` and dough colour as-is, closed the POST_BAKE continuity gap. **Reused, not redone.** |
| PR #68 M3A Bake Judgment | merged | Made dough / cheese / char continuous via `bakeHeat`. Reused. |
| #419 / PR #466 Bake Human Feel | open (HV pending) | Gauge speed only; touches `BakeOverlay`, `bakeProgress.ts`, `App.css` gauge rules. No overlap with the pizza body. |
| #418 / PR #425 CUT Human Feel | closed | Pieces are rendered as per-piece copies of the pizza body (dough + sauce + toppings + bake look) — bake look therefore carries into CUT/RESULT automatically. |
| #467 | open, low priority, on hold | Piece rendering on Android LINE browser. Anything I add inside the piece copies must not add filters to `.pizza-pieces` (see §5). |

No open issue or PR targets the finished look. No duplicate.

## 2. Why the cheese does not read as melted today

All from `src/logic/bakeVisual.ts` (`CHEESE_FRAMES`) and `src/App.css` (`.pizza-cheese*`):

1. **Melt is only `scale(1 → 1.16)`.** The shape stays the same 28×23 oval at 1.16×. A scaled oval is a bigger mozzarella, not a melted one.
2. **The outline never softens.** Every cheese keeps `box-shadow: 0 0 0 1.5px rgba(255,255,255,.8)` (a crisp white ring) plus a hard drop shadow, in raw and baked alike. A melted edge is the opposite of a ring.
3. **The raw highlight survives baking.** Mozzarella's `radial-gradient(circle at 35% 30%, #fffdf5 …)` and `inset 0 -3px 4px white` are static; heat only applies `brightness/saturate/sepia`. At perfect (heat 1) that is `brightness 1.06, sepia .14` — about a 6% change.
4. **No browning pattern.** `.pizza-char-spots` / `--char` overlays are pizza-wide and only rise past the perfect window; nothing puts local golden spots *on* the cheese.
5. **Pieces never overlap or merge.** Each cheese is an isolated glyph; even at 1.16× neighbours stay separate, so the pizza never reads as a continuous melted layer.

The earlier #186 audit treated the cheese curve as "already good". The numbers above say it is accurate but too small to be seen at 390 px.

## 3. Design proposal (Pilot: mozzarella, sauce, crust)

Principle: **keep `bakeHeat` as the single authority** (no second raw/baked state), drive everything from one scalar, change CSS/SVG only.

### 3.1 Mozzarella (the Owner's explicit ask)
- Add `meltAmount = smoothstep(0.35, 1.0, bakeHeat)` derived in `bakeVisual.ts` (pure, unit-tested next to `cheeseVisualFrame`).
- Replace the `scale` look with a **shape change**: animate `border-radius` toward an irregular blob and add a second, offset pseudo-element (`::before`) "spread skirt" — same cheese colour, lower alpha, blurred edge — whose scale/opacity follow `meltAmount`. Raw has no skirt (round white lump); perfect has a soft irregular pool.
- Fade out the white ring and inset highlight with `meltAmount` (`--cheese-ring-alpha`); replace with a faint warm gloss highlight.
- Local browning: 2–3 radial-gradient golden spots inside the cheese background, alpha driven by `max(0, bakeHeat − 0.8)`; keeps char for heat > 1.6 as is.
- Per-cheese opt-in: only `mozzarella` in the Pilot; other cheeses keep today's frame (Issue's "段階拡張").

### 3.2 Tomato sauce
- Add a `sauce-bake` tint layer over the existing heatmap canvas: `mix-blend-mode: multiply` deep-red wash with alpha from `bakeHeat`, plus a low-frequency "bubble/uneven" mask (static SVG noise or 2 radial gradients), plus a faint highlight (gloss) that peaks at perfect. No change to `sauceField` data or scoring.

### 3.3 Crust
- `doughVisualColors` already gives golden → dark. Add a crust-only ring: an inner `radial-gradient` at the dough rim with a lighter "puffed" band and 3–4 darker blotches (seeded from existing stable hash, not random per render), alpha from `bakeHeat`.

### 3.4 CUT / RESULT
Pieces already receive a copy of the pizza body, so the new layers must live **inside** the body subtree (not on `.pizza-pieces`) and use only CSS gradients / blend modes — the Android issue (#467) is unresolved, so **no new SVG filters, no new `clip-path`s**.

## 4. Impact scope

| Area | Change |
|---|---|
| `src/logic/bakeVisual.ts` (+ test) | add `meltAmount` / sauce / crust frames; `CHEESE_FRAMES` kept for non-pilot cheeses |
| `src/App.css` | `.pizza-cheese--mozzarella` melt rules, sauce tint layer, crust ring |
| `src/components/PizzaStage.tsx` | pass new CSS custom properties; one extra overlay div |
| `src/components/PizzaThumbnail`, Reference views | **unchanged** (they never set bake vars; `--bake-melt-scale` default 1 keeps them identical) — to be proven by the existing Reference/thumbnail tests |
| scoring, bake judgement, recipes, save, economy, progression, Hint, Research | **none** |
| DOM Production goldens | possibly one extra div → check `Production DOM golden`; avoid by using `::before/::after` only |

Risks: (a) 6 mozzarella pieces × pseudo-element blur on low-end devices → measure paint time on the CUT screen, fall back to opaque skirt if needed; (b) WebKit/Chromium blend-mode differences → covered by existing WebKit CI shards; (c) Android LINE (#467) — keep out of piece filters.

## 5. Plan and gates

1. **(this report)** Owner review of the design.
2. After approval: implement on this branch from current `main` (rebase onto main if #466 lands first; no shared files except `App.css`, different sections).
3. Focused tests: `bakeVisual` unit tests (monotonic, clamped, heat 0 identical to today), `PizzaStage.bakeVisual.test`, one representative E2E (BAKE → CUT → RESULT on margherita, 390×844 & 360×800).
4. UI/UX change → follow `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`: before/after screenshots under `docs/reports/screenshots/finished-pizza-appeal-421/`, 390×844 HV video delivered to the Owner (not committed), Preview deploy **only after Owner approval and not while #466's Preview is awaiting HV**.
5. Owner iPhone HV → PR / Final Gate → merge only with Owner approval.

## 6. Open questions for the Owner
1. Mozzarella-only Pilot OK, or include cheddar/goat cheese now?
2. Is a "pooled" melted look (cheese edges touching) acceptable at the cost of looking less like the Reference thumbnails?
3. Preview slot: wait for #466 HV, or use a second preview path?
