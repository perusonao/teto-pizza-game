/**
 * Issue #755 Steam Gameplay V3 (Preview / DEV Lab only), from the docs-only design `docs/reports/TETO_STEAM-GAME-V3_755_Design.md`
 * (commit 866e437) and the Owner prototype direction (Issue #755 comment 6656643875).
 *
 * What changes from V2 (./steamGameV2.ts):
 * - one readable rule: SMALL shells open first, and shells of the SAME size open together (a pair / a trio, 0.01 progress apart);
 * - where each shell sits is one of three fixed layouts, rotated round by round (no randomness), so positions cannot be memorised;
 * - a shell wobbles shortly before it opens (`STEAM_V3_WOBBLE_LEAD` progress early);
 * - time counts: 5/5 within the batch's star time is ★★★, 5/5 slower is ★★, 3–4 shells ★, fewer none (fewer shells never match 5/5);
 * - exposure speeds are the INITIAL tuning only (high 1.2, low 0.32 per second); progress speeds are V2's.
 *
 * Pure and deterministic: every time is an injected timestamp (ms). Nothing is stored; no score, save, reducer of the game or Dex.
 */
export type SteamV3Heat = "low" | "high";
export type SteamV3Batch = "clam" | "mussel";
export type SteamV3SizeClass = "small" | "medium" | "large";
/** While cooking. `closed` shells may also be wobbling (see `wobbling` in the snapshot). */
export type SteamV3ShellStatus = "closed" | "ready" | "over" | "rescued";
/** After the lid is lifted: an open shell nobody took is `missed`; one that never opened stays `closed`. */
export type SteamV3ResultShell = "rescued" | "over" | "missed" | "closed";
export type SteamV3Stars = 0 | 1 | 2 | 3;
export type SteamV3Advice = "master" | "faster" | "over" | "missed" | "closed";

export interface SteamV3Shell {
  readonly sizeClass: SteamV3SizeClass;
  /** drawing scale */
  readonly size: number;
  /** progress (0..1.5) at which it opens */
  readonly opensAt: number;
  /** exposure it survives after opening */
  readonly tolerance: number;
}

const S = (sizeClass: SteamV3SizeClass, size: number, opensAt: number, tolerance: number): SteamV3Shell => ({ sizeClass, size, opensAt, tolerance });

/** Shells in opening order. Same size = same opening moment (0.01 apart so the order stays defined). */
export const STEAM_V3_BATCHES: Record<SteamV3Batch, { label: string; starTimeMs: number; shells: readonly SteamV3Shell[] }> = {
  clam: {
    label: "あさり",
    starTimeMs: 6000,
    shells: [
      S("small", 0.8, 0.26, 0.85),
      S("medium", 1.04, 0.5, 1.05),
      S("medium", 1.04, 0.51, 1.05),
      S("medium", 1.04, 0.52, 1.05),
      S("large", 1.28, 0.8, 1.4),
    ],
  },
  mussel: {
    label: "ムール貝",
    starTimeMs: 6800,
    shells: [
      S("small", 0.86, 0.3, 0.85),
      S("small", 0.86, 0.31, 0.85),
      S("medium", 1.08, 0.55, 1.05),
      S("large", 1.3, 0.85, 1.4),
      S("large", 1.3, 0.86, 1.4),
    ],
  },
};

/**
 * Which shell (opening-order index) sits on each of the 5 spots (top-left, top-centre, top-right, bottom-left, bottom-right).
 * None reads 0→4 left-to-right / top-to-bottom, and the first shell sits on a different spot in each.
 */
export const STEAM_V3_LAYOUTS: readonly (readonly number[])[] = [
  [2, 4, 0, 3, 1],
  [3, 0, 4, 1, 2],
  [4, 1, 3, 2, 0],
];

export const STEAM_V3_PROGRESS_PER_SECOND = { low: 0.12, high: 0.22 } as const;
/** Initial tuning (Owner: not locked). V2 was low 0.29 / high 1.0. */
export const STEAM_V3_EXPOSURE_PER_SECOND = { low: 0.32, high: 1.2 } as const;
/** A closed shell wobbles once progress is within this of its opening (≈0.27 s ahead on high, ≈0.5 s on low). */
export const STEAM_V3_WOBBLE_LEAD = 0.06;
const PROGRESS_CAP = 1.5;
const TOTAL = 5;

export interface SteamV3Cooking {
  status: "cooking";
  batch: SteamV3Batch;
  layout: number;
  startedAt: number;
  lastAt: number;
  heat: SteamV3Heat;
  progress: number;
  exposure: number[];
  rescued: boolean[];
}

export interface SteamV3Result {
  batch: SteamV3Batch;
  layout: number;
  shells: SteamV3ResultShell[];
  rescuedCount: number;
  overCount: number;
  missedCount: number;
  closedCount: number;
  elapsedMs: number;
  starTimeMs: number;
  stars: SteamV3Stars;
  advice: SteamV3Advice;
}

export type SteamV3State = { status: "idle" } | SteamV3Cooking | { status: "released"; result: SteamV3Result };

export type SteamV3Action =
  | { type: "START"; now: number; batch: SteamV3Batch; layout: number; heat?: SteamV3Heat }
  | { type: "SET_HEAT"; now: number; heat: SteamV3Heat }
  | { type: "PICK"; now: number; index: number }
  | { type: "OPEN"; now: number }
  | { type: "INTERRUPT" }
  | { type: "RESET" };

export const STEAM_V3_IDLE: SteamV3State = { status: "idle" };

const validTime = (now: number, lastAt: number): boolean => Number.isFinite(now) && now >= lastAt;
const validBatch = (b: unknown): b is SteamV3Batch => b === "clam" || b === "mussel";
const validHeat = (h: unknown): h is SteamV3Heat => h === "low" || h === "high";

/** The layout used for round `round` (0-based): 0, 1, 2, 0, … */
export function steamV3LayoutForRound(round: number): number {
  const n = STEAM_V3_LAYOUTS.length;
  return Number.isInteger(round) && round >= 0 ? round % n : 0;
}

/** Integrate only the part of the interval AFTER each shell opens (same scheme as V2). */
export function steamV3Advance(s: SteamV3Cooking, now: number): SteamV3Cooking {
  if (!validTime(now, s.lastAt) || now === s.lastAt) return s;
  const elapsed = (now - s.lastAt) / 1000;
  const speed = STEAM_V3_PROGRESS_PER_SECOND[s.heat];
  const exposureSpeed = STEAM_V3_EXPOSURE_PER_SECOND[s.heat];
  const shells = STEAM_V3_BATCHES[s.batch].shells;
  return {
    ...s,
    lastAt: now,
    progress: Math.min(PROGRESS_CAP, s.progress + elapsed * speed),
    exposure: shells.map((shell, i) => {
      if (s.rescued[i]) return s.exposure[i];
      const crossingIn = Math.max(0, (shell.opensAt - s.progress) / speed);
      return s.exposure[i] + Math.max(0, elapsed - crossingIn) * exposureSpeed;
    }),
  };
}

function shellStatus(s: SteamV3Cooking, i: number): SteamV3ShellStatus {
  if (s.rescued[i]) return "rescued";
  const shell = STEAM_V3_BATCHES[s.batch].shells[i];
  if (s.progress < shell.opensAt - 1e-8) return "closed";
  return s.exposure[i] < shell.tolerance ? "ready" : "over";
}

/** ★★★ = 5/5 within the star time, ★★ = 5/5, ★ = 3–4, none = 0–2. Fewer shells never reach 5/5's grade. */
export function steamV3Stars(rescuedCount: number, elapsedMs: number, starTimeMs: number): SteamV3Stars {
  if (rescuedCount >= TOTAL) return elapsedMs <= starTimeMs ? 3 : 2;
  return rescuedCount >= 3 ? 1 : 0;
}

function adviceFor(stars: SteamV3Stars, over: number, missed: number, closed: number): SteamV3Advice {
  if (stars === 3) return "master";
  if (stars === 2) return "faster";
  if (over >= missed && over >= closed && over > 0) return "over";
  if (missed >= closed && missed > 0) return "missed";
  return "closed";
}

export interface SteamV3Snapshot {
  status: SteamV3State["status"];
  batch: SteamV3Batch | null;
  layout: number | null;
  heat: SteamV3Heat | null;
  shells: readonly (SteamV3ShellStatus | SteamV3ResultShell)[];
  /** closed shells that are about to open */
  wobbling: readonly boolean[];
  readyCount: number;
  rescuedCount: number;
  overCount: number;
  wobbleCount: number;
  result: SteamV3Result | null;
}

const NONE5 = [false, false, false, false, false] as const;

export function steamV3Snapshot(state: SteamV3State, now: number): SteamV3Snapshot {
  if (state.status === "idle") {
    return { status: "idle", batch: null, layout: null, heat: null, shells: ["closed", "closed", "closed", "closed", "closed"], wobbling: NONE5, readyCount: 0, rescuedCount: 0, overCount: 0, wobbleCount: 0, result: null };
  }
  if (state.status === "released") {
    const r = state.result;
    return { status: "released", batch: r.batch, layout: r.layout, heat: null, shells: r.shells, wobbling: NONE5, readyCount: 0, rescuedCount: r.rescuedCount, overCount: r.overCount, wobbleCount: 0, result: r };
  }
  const s = steamV3Advance(state, now);
  const specs = STEAM_V3_BATCHES[s.batch].shells;
  const shells = specs.map((_, i) => shellStatus(s, i));
  const wobbling = specs.map((spec, i) => shells[i] === "closed" && s.progress >= spec.opensAt - STEAM_V3_WOBBLE_LEAD);
  return {
    status: "cooking",
    batch: s.batch,
    layout: s.layout,
    heat: s.heat,
    shells,
    wobbling,
    readyCount: shells.filter((x) => x === "ready").length,
    rescuedCount: shells.filter((x) => x === "rescued").length,
    overCount: shells.filter((x) => x === "over").length,
    wobbleCount: wobbling.filter(Boolean).length,
    result: null,
  };
}

export function steamV3Reducer(state: SteamV3State, action: SteamV3Action): SteamV3State {
  switch (action.type) {
    case "START": {
      if (state.status !== "idle" || !validBatch(action.batch) || !Number.isFinite(action.now)) return state;
      const layout = Number.isInteger(action.layout) && action.layout >= 0 && action.layout < STEAM_V3_LAYOUTS.length ? action.layout : 0;
      return {
        status: "cooking",
        batch: action.batch,
        layout,
        startedAt: action.now,
        lastAt: action.now,
        heat: validHeat(action.heat) ? action.heat : "low",
        progress: 0,
        exposure: Array(TOTAL).fill(0) as number[],
        rescued: Array(TOTAL).fill(false) as boolean[],
      };
    }
    case "SET_HEAT":
      if (state.status !== "cooking" || !validTime(action.now, state.lastAt) || !validHeat(action.heat)) return state;
      return { ...steamV3Advance(state, action.now), heat: action.heat };
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
      const shells: SteamV3ResultShell[] = STEAM_V3_BATCHES[s.batch].shells.map((_, i) => {
        const st = shellStatus(s, i);
        return st === "ready" ? "missed" : st;
      });
      const count = (k: SteamV3ResultShell) => shells.filter((x) => x === k).length;
      const rescuedCount = count("rescued");
      const elapsedMs = action.now - s.startedAt;
      const starTimeMs = STEAM_V3_BATCHES[s.batch].starTimeMs;
      const stars = steamV3Stars(rescuedCount, elapsedMs, starTimeMs);
      return {
        status: "released",
        result: {
          batch: s.batch,
          layout: s.layout,
          shells,
          rescuedCount,
          overCount: count("over"),
          missedCount: count("missed"),
          closedCount: count("closed"),
          elapsedMs,
          starTimeMs,
          stars,
          advice: adviceFor(stars, count("over"), count("missed"), count("closed")),
        },
      };
    }
    case "INTERRUPT":
      return state.status === "cooking" ? STEAM_V3_IDLE : state;
    case "RESET":
      return STEAM_V3_IDLE;
  }
}
