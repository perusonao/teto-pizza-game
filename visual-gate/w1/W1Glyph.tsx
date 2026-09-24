/**
 * W1 Visual Gate slice 2 -- PREVIEW-ONLY dedicated piece visuals.
 *
 * `vite.config.ts`'s `w1GlyphTransform` rewrites every production `{ingredient.emoji}` render
 * site (piece, tray chip, drag preview, RESULT list, thumbnail, Inventory, Shop, Dex) to
 * `<W1Glyph ingredient={ingredient} />` in the preview bundle only. For every ingredient
 * without an active dedicated visual this renders exactly the emoji text it replaced, so
 * production ingredients look and measure the same as before. The SVGs are sized `1em`, so each
 * site's own font-size (28px piece, 26px chip, thumbnail scale) and the bake `filter` on the
 * wrapping span apply unchanged.
 *
 * Shape-first designs (each must stay identifiable in grayscale):
 * - fresh-tomato: a flat cross-section slice -- dark skin ring, pale core and 4 pale seed
 *   chambers ("wheel"), no calyx. cherry-tomato keeps the whole 🍅 (glossy, green calyx);
 *   tomato-sauce is a spread (only its tray chip / RESULT list use 🍅).
 * - capers: an irregular cluster of 3 small pointed buds of different sizes -- never a single
 *   disc like ⚫ black-olive / 🔴 pepperoni.
 * - clam: one closed asari valve seen from above -- wide rounded-triangle outline with a hinge
 *   bump and horizontal growth bands; no pearl/open meat (oyster), no spiral (sea snail), bands
 *   run across (garlic's ribs run lengthwise).
 */
import { useContext } from "react";
import type { Ingredient } from "../../src/data/ingredients";
import { activeDedicatedVisuals, type DedicatedVisualKey } from "./candidates";
import { W1VisualOverride, type VisualMap } from "./visualOverride";

const ACTIVE: VisualMap = activeDedicatedVisuals(typeof window === "undefined" ? "" : window.location.search);

export function W1Glyph({ ingredient }: { ingredient: Ingredient }) {
  const override = useContext(W1VisualOverride);
  const key = ingredient.id in override ? override[ingredient.id] : ACTIVE[ingredient.id];
  if (!key) return <>{ingredient.emoji}</>;
  return <DedicatedGlyph visual={key} />;
}

export function DedicatedGlyph({ visual }: { visual: DedicatedVisualKey }) {
  return (
    <svg
      className={`w1-glyph w1-glyph--${visual}`}
      data-w1-visual={visual}
      viewBox="0 0 32 32"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
    >
      {visual === "tomato-slice" && <TomatoSlice />}
      {visual === "caper-cluster" && <CaperCluster />}
      {visual === "asari-valve" && <AsariValve />}
    </svg>
  );
}

function TomatoSlice() {
  const chambers = [45, 135, 225, 315];
  return (
    <g>
      <circle cx="16" cy="16" r="14.2" fill="#b8231a" stroke="#4f0f0a" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="11.6" fill="#e2493a" />
      {chambers.map((angle) => (
        <g key={angle} transform={`rotate(${angle} 16 16)`}>
          <ellipse cx="16" cy="8.6" rx="3.9" ry="3" fill="#ffb48f" />
          <ellipse cx="15" cy="8.5" rx="0.9" ry="0.6" fill="#f2d15a" stroke="#9c7420" strokeWidth="0.3" />
          <ellipse cx="17.1" cy="8.9" rx="0.9" ry="0.6" fill="#f2d15a" stroke="#9c7420" strokeWidth="0.3" />
        </g>
      ))}
      <circle cx="16" cy="16" r="3.3" fill="#ffd2b8" />
      <path d="M8.5 8.8 A10.6 10.6 0 0 1 13 6" stroke="#ffe7dc" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.8" />
    </g>
  );
}

const CAPER_BUDS = [
  { cx: 10.8, cy: 19.5, rx: 6.1, ry: 6.8, rot: -24 },
  { cx: 21.4, cy: 21.2, rx: 5.2, ry: 5.8, rot: 28 },
  { cx: 17.2, cy: 10.2, rx: 4.6, ry: 5.2, rot: 8 },
];

function CaperCluster() {
  return (
    <g>
      {CAPER_BUDS.map((bud, index) => (
        <g key={index} transform={`rotate(${bud.rot} ${bud.cx} ${bud.cy})`}>
          {/* a slightly pointed bud: an ellipse with a small tip on top */}
          <path
            d={`M${bud.cx} ${bud.cy - bud.ry - 1.4}
                C ${bud.cx + bud.rx * 0.55} ${bud.cy - bud.ry}, ${bud.cx + bud.rx} ${bud.cy - bud.ry * 0.35}, ${bud.cx + bud.rx} ${bud.cy + bud.ry * 0.1}
                C ${bud.cx + bud.rx} ${bud.cy + bud.ry * 0.75}, ${bud.cx + bud.rx * 0.5} ${bud.cy + bud.ry}, ${bud.cx} ${bud.cy + bud.ry}
                C ${bud.cx - bud.rx * 0.5} ${bud.cy + bud.ry}, ${bud.cx - bud.rx} ${bud.cy + bud.ry * 0.75}, ${bud.cx - bud.rx} ${bud.cy + bud.ry * 0.1}
                C ${bud.cx - bud.rx} ${bud.cy - bud.ry * 0.35}, ${bud.cx - bud.rx * 0.55} ${bud.cy - bud.ry}, ${bud.cx} ${bud.cy - bud.ry - 1.4} Z`}
            fill="#7f9139"
            stroke="#34401a"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          {/* bud scale lines + highlight: texture that survives grayscale */}
          <path
            d={`M${bud.cx - bud.rx * 0.55} ${bud.cy + bud.ry * 0.05} Q ${bud.cx} ${bud.cy - bud.ry * 0.55} ${bud.cx + bud.rx * 0.55} ${bud.cy + bud.ry * 0.05}`}
            stroke="#4b5a21"
            strokeWidth="0.9"
            fill="none"
          />
          <ellipse cx={bud.cx - bud.rx * 0.35} cy={bud.cy - bud.ry * 0.35} rx={bud.rx * 0.28} ry={bud.ry * 0.2} fill="#c8d58a" />
        </g>
      ))}
    </g>
  );
}

function AsariValve() {
  return (
    <g>
      <path
        d="M16 4.6 C 10.5 5.2, 3.4 11.4, 2.8 19.6 C 2.5 25, 8.6 28.4, 16 28.4 C 23.4 28.4, 29.5 25, 29.2 19.6 C 28.6 11.4, 21.5 5.2, 16 4.6 Z"
        fill="#d8c6a2"
        stroke="#3f2f1e"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* growth bands (concentric, across the shell) */}
      <path d="M4.6 21.2 C 7.5 26.4, 24.5 26.4, 27.4 21.2 L 27.9 23.6 C 24.5 28, 7.5 28, 4.1 23.6 Z" fill="#7a5c3e" />
      <path d="M6.2 15.4 C 9.5 19.8, 22.5 19.8, 25.8 15.4" stroke="#8d6d4b" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M9.6 10.6 C 12 13.3, 20 13.3, 22.4 10.6" stroke="#8d6d4b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* asari zig-zag markings */}
      <path d="M8.5 18.6 l1.6 -1.9 l1.6 1.9 l1.6 -1.9 M18.8 18.6 l1.6 -1.9 l1.6 1.9 l1.6 -1.9" stroke="#4d3924" strokeWidth="0.9" fill="none" strokeLinejoin="round" />
      {/* hinge / umbo */}
      <path d="M12.6 5.9 C 14 3.6, 18 3.6, 19.4 5.9 C 18 7.2, 14 7.2, 12.6 5.9 Z" fill="#6e5236" stroke="#3f2f1e" strokeWidth="0.8" />
    </g>
  );
}
