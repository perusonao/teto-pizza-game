import type { DedicatedIngredientVisual } from "../data/ingredients";

export type PilotIconVisual = Extract<
  DedicatedIngredientVisual,
  "tomato-sauce-bowl" | "mozzarella-ball" | "basil-leaves" | "bacon-rashers" | "button-mushrooms" | "olive-oil-bottle"
>;

export function PilotIngredientIcon({ visual }: { visual: PilotIconVisual }) {
  if (visual === "tomato-sauce-bowl") return <TomatoSauceBowl />;
  if (visual === "mozzarella-ball") return <MozzarellaBall />;
  if (visual === "basil-leaves") return <BasilLeaves />;
  if (visual === "bacon-rashers") return <BaconRashers />;
  if (visual === "button-mushrooms") return <ButtonMushrooms />;
  return <OliveOilBottle />;
}

function GroundShadow({ rx = 22 }: { rx?: number }) {
  return <ellipse cx="32" cy="57" rx={rx} ry="3.2" fill="#000" opacity=".14" />;
}

function TomatoSauceBowl() {
  return <g>
    <GroundShadow />
    <path d="M8 29h48l-5 19c-1 5-6 8-11 8H24c-5 0-10-3-11-8z" fill="#f3dfb7" stroke="#6f4b2d" strokeWidth="2.4" strokeLinejoin="round" />
    <ellipse cx="32" cy="29" rx="24" ry="10" fill="#f7ead0" stroke="#6f4b2d" strokeWidth="2.4" />
    <ellipse cx="32" cy="29" rx="19" ry="6.7" fill="#d9362b" stroke="#8b1f19" strokeWidth="2" />
    <path d="M20 28c6-3 15-3 22 0" stroke="#f46c52" strokeWidth="2.8" strokeLinecap="round" fill="none" />
    <path d="M45 13l4 2-12 20-5-3z" fill="#c6d0d2" stroke="#586467" strokeWidth="2.2" strokeLinejoin="round" />
    <ellipse cx="34" cy="34" rx="5" ry="3" fill="#bfc9cb" stroke="#586467" strokeWidth="2" transform="rotate(25 34 34)" />
  </g>;
}

function MozzarellaBall() {
  return <g>
    <GroundShadow rx={18} />
    <circle cx="32" cy="36" r="19" fill="#fbf7ee" stroke="#7d7464" strokeWidth="2.4" />
    <path d="M23 26c3-5 8-7 13-6" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    <path d="M45 43c-3 6-9 9-15 8" stroke="#e4dccb" strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M26 17c1-5 4-8 6-10 2 2 3 6 2 10M34 17c2-4 5-6 8-7-1 4-3 7-7 9" fill="#fbf7ee" stroke="#7d7464" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M27 18c3 2 7 2 10 0" stroke="#7d7464" strokeWidth="2.2" strokeLinecap="round" />
  </g>;
}

function BasilLeaves() {
  return <g>
    <GroundShadow rx={20} />
    <path d="M31 50C13 52 8 38 13 19c17 1 26 11 18 31z" fill="#4f9a4b" stroke="#245b2a" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M31 50C29 33 23 26 14 20M25 38l-9-4M27 31l-6-7" stroke="#b4d98b" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M32 48c-5-16 3-29 20-35 7 17 0 32-20 35z" fill="#3f873f" stroke="#245b2a" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M32 48c7-16 12-24 20-34M40 34l10-4M43 27l3-8" stroke="#a8d37f" strokeWidth="2" strokeLinecap="round" fill="none" />
  </g>;
}

function BaconRashers() {
  const rasher = (y: number) => <g transform={`translate(0 ${y})`}>
    <path d="M6 4c9-8 17 8 27 0s19-8 25 0v13c-7-8-16-8-25 0S15 9 6 17z" fill="#d94d4f" stroke="#5b1a1c" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M7 11c9-8 17 8 26 0s18-8 24 0" stroke="#f7ddca" strokeWidth="3.7" strokeLinecap="round" fill="none" />
  </g>;
  return <g><GroundShadow rx={24} />{rasher(10)}{rasher(31)}</g>;
}

function ButtonMushrooms() {
  return <g>
    <GroundShadow rx={23} />
    <g transform="translate(4 6)">
      <path d="M6 27C7 13 18 7 30 12c7 3 11 9 11 17z" fill="#b9895f" stroke="#513a29" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M14 28h19c-1 5-5 8-10 8s-8-3-9-8z" fill="#ead7b8" stroke="#6f5238" strokeWidth="2.2" />
      <path d="M19 35h9l3 17H16z" fill="#f0dfc3" stroke="#6f5238" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M11 26c7-4 16-5 25 0" stroke="#f0d7b4" strokeWidth="2" strokeLinecap="round" fill="none" />
    </g>
    <g transform="translate(30 20) scale(.7)">
      <path d="M5 25C7 12 17 7 28 11c7 3 11 8 11 16z" fill="#d2aa7e" stroke="#513a29" strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M13 26h19c-1 5-5 8-10 8s-8-3-9-8z" fill="#f1dfc1" stroke="#6f5238" strokeWidth="2.8" />
      <path d="M18 33h9l2 18H16z" fill="#f4e6ce" stroke="#6f5238" strokeWidth="3" strokeLinejoin="round" />
    </g>
  </g>;
}

function OliveOilBottle() {
  return <g>
    <GroundShadow rx={17} />
    <path d="M25 8h14v10l5 7v25c0 4-3 6-7 6H27c-4 0-7-2-7-6V25l5-7z" fill="#eff2cd" stroke="#52622d" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M22 34h20v16c0 3-2 4-5 4H27c-3 0-5-1-5-4z" fill="#d6b832" />
    <path d="M25 8h14v8H25z" fill="#6e873b" stroke="#405124" strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M27 4h10v5H27z" fill="#d3c49b" stroke="#5c5136" strokeWidth="2" strokeLinejoin="round" />
    <path d="M26 26c3-3 7-4 11-2" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" opacity=".8" />
    <path d="M32 38c4 5 5 7 5 10a5 5 0 0 1-10 0c0-3 1-5 5-10z" fill="#f5d94c" stroke="#8d7417" strokeWidth="1.8" />
  </g>;
}
