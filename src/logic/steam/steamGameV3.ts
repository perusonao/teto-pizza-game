/**
 * Steam Gameplay V3 (design: docs/reports/TETO_STEAM-V3_DESIGN.md). A Preview / DEV Lab model only: no game reducer, score,
 * recipe, storage, inventory, Dex or production Steam dependency. The caller owns the clock; nothing here is random.
 *
 * What changes against V2 (./steamGameV2.ts, kept as is for comparison):
 * - the result is graded by the rescued count FIRST and, for 5/5 only, by the time (START to OPEN), so a slow 5/5 on low heat is
 *   safe but never the top grade, and no 5/5 ever grades below a 4/5;
 * - shells come in three clearly different sizes and the smaller ones open first; the five spots use one of four fixed layouts,
 *   none of them the 1-to-5 spot order;
 * - a shell "tells" (wobbles) shortly before it opens;
 * - strong heat cooks faster and shrinks an open shell much faster. Its rescue window is PROVISIONAL and has three presets
 *   (STEAM_V3_WINDOWS) so it can be tuned on a real phone without changing the low-heat path or the goal times.
 */
export type SteamV3Heat = "low" | "high";
export type SteamV3Batch = "clam" | "mussel";
export type SteamV3Size = "small" | "medium" | "large";
export type SteamV3Window = "standard" | "loose" | "tight";
export type SteamV3ShellStatus = "closed" | "tell" | "ready" | "over" | "rescued" | "missed";
export type SteamV3Grade = "none" | "one" | "two" | "three" | "master";

export interface SteamV3ShellSpec {
  readonly size: SteamV3Size;
  /** Heat-progress level at which the shell is fully open. */
  readonly opensAt: number;
  /** Exposure limit after opening; exposure grows by STEAM_V3_WINDOWS[window][heat] per second. */
  readonly tolerance: number;
}

/** Shells in OPENING order (rank 1 first). The size alone tells the order class: small, then medium, then large. */
export const STEAM_V3_BATCHES: Record<SteamV3Batch, { label: string; shells: readonly SteamV3ShellSpec[] }> = {
  clam: {
    label: "あさり",
    shells: [
      { size: "small", opensAt: 0.30, tolerance: 0.95 },
      { size: "small", opensAt: 0.36, tolerance: 1.00 },
      { size: "medium", opensAt: 0.55, tolerance: 1.10 },
      { size: "medium", opensAt: 0.61, tolerance: 1.15 },
      { size: "large", opensAt: 0.86, tolerance: 1.30 },
    ],
  },
  mussel: {
    label: "ムール貝",
    shells: [
      { size: "small", opensAt: 0.36, tolerance: 0.90 },
      { size: "medium", opensAt: 0.58, tolerance: 1.00 },
      { size: "medium", opensAt: 0.64, tolerance: 1.05 },
      { size: "large", opensAt: 0.86, tolerance: 1.20 },
      { size: "large", opensAt: 0.92, tolerance: 1.25 },
    ],
  },
};

/** Spot (top-left, top-middle, top-right, bottom-left, bottom-right) -> opening rank (1-based). Used in turn, never randomly. */
export const STEAM_V3_LAYOUTS: readonly (readonly number[])[] = [
  [3, 5, 1, 4, 2],
  [2, 4, 5, 1, 3],
  [5, 1, 3, 2, 4],
  [4, 2, 3, 5, 1],
];

export const STEAM_V3_SIZE_SCALE: Record<SteamV3Size, number> = { small: 0.85, medium: 1.05, large: 1.25 };
export const STEAM_V3_PROGRESS_PER_SECOND = { low: 0.12, high: 0.26 } as const;
/** Shrink speed of an open shell. Low heat is the same in every preset; only the strong-heat window is provisional. */
export const STEAM_V3_WINDOWS: Record<SteamV3Window, { readonly low: number; readonly high: number }> = {
  standard: { low: 0.35, high: 1.35 },
  loose: { low: 0.35, high: 1.15 },
  tight: { low: 0.35, high: 1.6 },
};
/** A shell wobbles from (opensAt - STEAM_V3_TELL) until it opens: ~0.31 s on strong heat, ~0.67 s on low heat. */
export const STEAM_V3_TELL = 0.08;
/** Goal times in ms from START to OPEN, for 5/5 only. */
export const STEAM_V3_GOALS: Record<SteamV3Batch, { master: number; three: number }> = {
  clam: { master: 5000, three: 7000 },
  mussel: { master: 5400, three: 7400 },
};
export const STEAM_V3_GRADE_RANK: Record<SteamV3Grade, number> = { none: 0, one: 1, two: 2, three: 3, master: 4 };
const TOTAL = 5;

function isBatch(batch: unknown): batch is SteamV3Batch {
  return batch === "clam" || batch === "mussel";
}
function isWindow(w: unknown): w is SteamV3Window {
  return w === "standard" || w === "loose" || w === "tight";
}

/** Count first; the time only separates 5/5 results. Invalid input is graded "none". */
export function steamV3Grade({ batch, rescuedCount, elapsedMs }: { batch: SteamV3Batch; rescuedCount: number; elapsedMs: number }): SteamV3Grade {
  if (!isBatch(batch) || !Number.isInteger(rescuedCount) || rescuedCount < 0 || rescuedCount > TOTAL) return "none";
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "none";
  if (rescuedCount === TOTAL) {
    const goal = STEAM_V3_GOALS[batch];
    return elapsedMs <= goal.master ? "master" : elapsedMs <= goal.three ? "three" : "two";
  }
  return rescuedCount >= 2 ? "one" : "none";
}

/** `?steamV3Window=loose|tight` (exactly once) picks a provisional strong-heat window; anything else is the standard one. */
export function steamV3WindowFromQuery(search: string): SteamV3Window {
  const all = new URLSearchParams(search).getAll("steamV3Window");
  return all.length === 1 && (all[0] === "loose" || all[0] === "tight") ? all[0] : "standard";
}

/** The shell spec at each of the five spots for a layout index (wrapped, so any integer round counter works). */
export function steamV3Spots(batch: SteamV3Batch, layout: number): SteamV3ShellSpec[] {
  const l = STEAM_V3_LAYOUTS[((Math.trunc(layout) % STEAM_V3_LAYOUTS.length) + STEAM_V3_LAYOUTS.length) % STEAM_V3_LAYOUTS.length];
  return l.map((r) => STEAM_V3_BATCHES[batch].shells[r - 1]);
}

export interface SteamV3Cooking {
  status: "cooking";
  batch: SteamV3Batch;
  layout: number;
  window: SteamV3Window;
  startedAt: number;
  lastAt: number;
  heat: SteamV3Heat;
  usedHigh: boolean;
  progress: number;
  exposure: readonly number[];
  rescued: readonly boolean[];
  /** The heat during which each shell shrank (null while it has not). */
  overHeat: readonly (SteamV3Heat | null)[];
}

export interface SteamV3Result {
  batch: SteamV3Batch;
  layout: number;
  window: SteamV3Window;
  shells: readonly SteamV3ShellStatus[];
  rescuedCount: number;
  elapsedMs: number;
  grade: SteamV3Grade;
  usedHigh: boolean;
  overOnHigh: number;
  overOnLow: number;
}

export type SteamV3State = { status: "idle" } | SteamV3Cooking | { status: "released"; result: SteamV3Result };

export type SteamV3Action =
  | { type: "START"; now: number; batch: SteamV3Batch; layout: number; heat: SteamV3Heat; window: SteamV3Window }
  | { type: "SET_HEAT"; heat: SteamV3Heat; now: number }
  | { type: "PICK"; index: number; now: number }
  | { type: "OPEN"; now: number }
  | { type: "INTERRUPT" }
  | { type: "RESET" };

export const STEAM_V3_IDLE: SteamV3State = { status: "idle" };

function validTime(now: number, lastAt: number): boolean {
  return Number.isFinite(now) && now >= lastAt;
}

/** Integrate only the part of the interval AFTER each shell opens (the heat is constant within an interval). */
export function steamV3Advance(s: SteamV3Cooking, now: number): SteamV3Cooking {
  if (!validTime(now, s.lastAt) || now === s.lastAt) return s;
  const elapsed = (now - s.lastAt) / 1000;
  const speed = STEAM_V3_PROGRESS_PER_SECOND[s.heat];
  const shrink = STEAM_V3_WINDOWS[s.window][s.heat];
  const spots = steamV3Spots(s.batch, s.layout);
  const exposure = spots.map((shell, i) => {
    if (s.rescued[i]) return s.exposure[i];
    const crossingIn = Math.max(0, (shell.opensAt - s.progress) / speed);
    return s.exposure[i] + Math.max(0, elapsed - crossingIn) * shrink;
  });
  return {
    ...s,
    lastAt: now,
    progress: Math.min(1.5, s.progress + elapsed * speed),
    exposure,
    overHeat: spots.map((shell, i) => s.overHeat[i] ?? (exposure[i] >= shell.tolerance ? s.heat : null)),
  };
}

function shellStatus(s: SteamV3Cooking, index: number): SteamV3ShellStatus {
  if (s.rescued[index]) return "rescued";
  const shell = steamV3Spots(s.batch, s.layout)[index];
  if (s.progress < shell.opensAt - 1e-8) return s.progress >= shell.opensAt - STEAM_V3_TELL ? "tell" : "closed";
  return s.exposure[index] < shell.tolerance ? "ready" : "over";
}

export interface SteamV3Snapshot {
  status: SteamV3State["status"];
  heat: SteamV3Heat | null;
  shells: readonly SteamV3ShellStatus[];
  readyCount: number;
  rescuedCount: number;
  overCount: number;
  elapsedMs: number;
  result: SteamV3Result | null;
}

export function steamV3Snapshot(state: SteamV3State, now: number): SteamV3Snapshot {
  if (state.status === "idle") {
    return { status: "idle", heat: null, shells: Array(TOTAL).fill("closed"), readyCount: 0, rescuedCount: 0, overCount: 0, elapsedMs: 0, result: null };
  }
  if (state.status === "released") {
    const r = state.result;
    return { status: "released", heat: null, shells: r.shells, readyCount: 0, rescuedCount: r.rescuedCount, overCount: r.shells.filter((x) => x === "over").length, elapsedMs: r.elapsedMs, result: r };
  }
  const s = steamV3Advance(state, now);
  const shells = s.rescued.map((_, i) => shellStatus(s, i));
  return {
    status: "cooking",
    heat: s.heat,
    shells,
    readyCount: shells.filter((x) => x === "ready").length,
    rescuedCount: shells.filter((x) => x === "rescued").length,
    overCount: shells.filter((x) => x === "over").length,
    elapsedMs: Math.max(0, s.lastAt - s.startedAt),
    result: null,
  };
}

export function steamV3Reducer(state: SteamV3State, action: SteamV3Action): SteamV3State {
  switch (action.type) {
    case "START": {
      if (state.status !== "idle" || !isBatch(action.batch) || !isWindow(action.window) || !Number.isFinite(action.now)) return state;
      if ((action.heat !== "low" && action.heat !== "high") || !Number.isInteger(action.layout)) return state;
      return {
        status: "cooking",
        batch: action.batch,
        layout: ((action.layout % STEAM_V3_LAYOUTS.length) + STEAM_V3_LAYOUTS.length) % STEAM_V3_LAYOUTS.length,
        window: action.window,
        startedAt: action.now,
        lastAt: action.now,
        heat: action.heat,
        usedHigh: action.heat === "high",
        progress: 0,
        exposure: Array(TOTAL).fill(0),
        rescued: Array(TOTAL).fill(false),
        overHeat: Array(TOTAL).fill(null),
      };
    }
    case "SET_HEAT":
      if (state.status !== "cooking" || !validTime(action.now, state.lastAt)) return state;
      if (action.heat !== "low" && action.heat !== "high") return state;
      return { ...steamV3Advance(state, action.now), heat: action.heat, usedHigh: state.usedHigh || action.heat === "high" };
    case "PICK": {
      if (state.status !== "cooking" || !validTime(action.now, state.lastAt)) return state;
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= TOTAL) return state;
      const s = steamV3Advance(state, action.now);
      if (shellStatus(s, action.index) !== "ready") return s;
      return { ...s, rescued: s.rescued.map((saved, i) => (i === action.index ? true : saved)) };
    }
    case "OPEN": {
      if (state.status !== "cooking" || !validTime(action.now, state.lastAt)) return state;
      const s = steamV3Advance(state, action.now);
      const shells = s.rescued.map((_, i) => {
        const st = shellStatus(s, i);
        // An open, uncollected shell is missed; a shell that had not opened (even if wobbling) stays closed.
        return st === "ready" ? "missed" : st === "tell" ? "closed" : st;
      }) as SteamV3ShellStatus[];
      const rescuedCount = shells.filter((x) => x === "rescued").length;
      const elapsedMs = action.now - s.startedAt;
      return {
        status: "released",
        result: {
          batch: s.batch,
          layout: s.layout,
          window: s.window,
          shells,
          rescuedCount,
          elapsedMs,
          grade: steamV3Grade({ batch: s.batch, rescuedCount, elapsedMs }),
          usedHigh: s.usedHigh,
          overOnHigh: s.overHeat.filter((h, i) => h === "high" && shells[i] === "over").length,
          overOnLow: s.overHeat.filter((h, i) => h === "low" && shells[i] === "over").length,
        },
      };
    }
    case "INTERRUPT":
      return state.status === "cooking" ? STEAM_V3_IDLE : state;
    case "RESET":
      return STEAM_V3_IDLE;
  }
}

const fmt = (ms: number) => (Math.max(0, ms) / 1000).toFixed(1);

/** One short, specific line of advice for the result (the grade itself is shown separately). */
export function steamV3Advice(r: SteamV3Result): string {
  const goal = STEAM_V3_GOALS[r.batch];
  if (r.grade === "master") return "名人！強火で攻めきった";
  if (r.grade === "three") return `名人まであと${fmt(r.elapsedMs - goal.master)}秒！強火の時間を増やそう`;
  if (r.grade === "two") {
    return r.usedHigh
      ? `★3まであと${fmt(r.elapsedMs - goal.three)}秒。何も開いていない間は強火`
      : "強火も使ってみよう。何も開いていない間は強火が速い";
  }
  if (r.overOnHigh > 0) return "強火で縮んだ。2個続けて開きそうなら弱火に";
  if (r.overOnLow > 0) return "開いたらすぐタップ。橙色の貝から取ろう";
  if (r.shells.includes("missed")) return "開いた貝を取ってから、ふたを開けよう";
  if (r.shells.includes("closed")) return "小さい貝から開くよ。全部開くまで待とう";
  return "開いた貝をタップして取り出そう";
}

/** The goal line shown once before a round (no countdown is shown while cooking). */
export function steamV3GoalLine(batch: SteamV3Batch): string {
  return `小さい貝から開くよ｜★3は${fmt(STEAM_V3_GOALS[batch].three)}秒以内`;
}

export const STEAM_V3_GRADE_LABEL: Record<SteamV3Grade, string> = {
  master: "名人 ★★★",
  three: "★★★",
  two: "★★",
  one: "★",
  none: "×",
};
export const STEAM_V3_SECONDS = fmt;
