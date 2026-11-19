import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SteamGameLab } from "./SteamGameLab";
import v3Src from "./SteamGameLabV3.tsx?raw";
import { readFileSync } from "node:fs";
import path from "node:path";
import facadeSrc from "./steamGameLabGraded.ts?raw";

const v3Css = readFileSync(path.join(__dirname, "steamGameLabV3.css"), "utf8");
import { STEAM_V3_BATCHES, STEAM_V3_PROGRESS_PER_SECOND, STEAM_V3_TELL, steamV3Spots } from "../logic/steam/steamGameV3";

let t = 10_000;
const clock = () => t;
const advance = (ms: number) => {
  t += ms;
  act(() => vi.advanceTimersByTime(ms));
};
const button = (name: string) => screen.getByRole("button", { name });
const shell = (i: number) => screen.getByTestId(`sgl-v3-shell-${i}`);
const scene = () => screen.getByTestId("sgl-v3-scene");
const msg = () => document.querySelector(".sglv3__msg")!.textContent;
/** Spot of the shell with the given opening rank (1-based) in a layout. */
const spotOf = (rank: number, layout = 0, batch: "clam" | "mussel" = "clam") =>
  steamV3Spots(batch, layout).findIndex((s) => s === STEAM_V3_BATCHES[batch].shells[rank - 1]);
const openMs = (rank: number, heat: "low" | "high", batch: "clam" | "mussel" = "clam") =>
  Math.ceil((STEAM_V3_BATCHES[batch].shells[rank - 1].opensAt / STEAM_V3_PROGRESS_PER_SECOND[heat]) * 1000) + 5;

beforeEach(() => {
  t = 10_000;
  window.history.replaceState(null, "", "/?steamGameLab=on&steamGameMode=v3");
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Steam Gameplay Lab V3 #755: routing (V1 and V2 untouched)", () => {
  it.each([
    ["/?steamGameLab=on", "sgl-scene"],
    ["/?steamGameLab=on&steamGameMode=v2", "sgl-v2-scene"],
    ["/?steamGameLab=on&steamGameMode=v3", "sgl-v3-scene"],
    ["/?steamGameLab=on&steamGameMode=v3&steamGameMode=v3", "sgl-scene"],
  ])("%s -> %s", (url, testId) => {
    window.history.replaceState(null, "", url);
    render(<SteamGameLab clock={clock} />);
    expect(screen.getByTestId(testId)).toBeTruthy();
    for (const other of ["sgl-scene", "sgl-v2-scene", "sgl-v3-scene"].filter((x) => x !== testId)) expect(screen.queryByTestId(other)).toBeNull();
  });
});

describe("Steam Gameplay Lab V3 #755: play", () => {
  it("before a round: the goal is said once, sizes are visible, the start heat can be chosen", () => {
    render(<SteamGameLab clock={clock} />);
    expect(screen.getByText("蒸しミニゲーム V3")).toBeTruthy();
    expect(msg()).toBe("小さい貝から開くよ｜★3は7.0秒以内");
    expect([0, 1, 2, 3, 4].map((i) => shell(i).getAttribute("data-shell-size"))).toEqual(["medium", "large", "small", "medium", "small"]);
    expect(button("弱火")).toHaveProperty("disabled", false);
    fireEvent.click(button("強火"));
    expect(button("強火").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button("ふたをして蒸す"));
    expect(screen.getByTestId("sgl-v3-lid").getAttribute("data-heat")).toBe("high");
  });

  it("no countdown while cooking: the badge counts shells only, the time appears with the result", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("ふたをして蒸す"));
    advance(1500);
    expect(screen.getByTestId("sgl-v3-badge").textContent).toBe("ふっくら回収 0/5");
    expect(document.body.textContent).not.toMatch(/\d+\.\d秒/);
    fireEvent.click(button("ふたを開ける"));
    expect(screen.getByTestId("sgl-v3-badge").textContent).toBe("× 1.5秒・0/5");
  });

  it("a fast strong-heat 5/5 is 名人; the result shows grade, time and count", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("強火"));
    fireEvent.click(button("ふたをして蒸す"));
    let at = 0;
    for (let rank = 1; rank <= 5; rank++) {
      advance(openMs(rank, "high") - at);
      at = openMs(rank, "high");
      fireEvent.click(shell(spotOf(rank)));
    }
    expect(scene().getAttribute("data-rescued")).toBe("5");
    advance(100);
    fireEvent.click(button("ふたを開ける"));
    expect(scene().getAttribute("data-grade")).toBe("master");
    expect(screen.getByTestId("sgl-v3-badge").textContent).toMatch(/^名人 ★★★ 3\.\d秒・5\/5$/);
    expect(msg()).toContain("名人");
  });

  it("a low-only 5/5 is ★★ and the advice suggests strong heat", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("ふたをして蒸す"));
    let at = 0;
    for (let rank = 1; rank <= 5; rank++) {
      advance(openMs(rank, "low") - at);
      at = openMs(rank, "low");
      fireEvent.click(shell(spotOf(rank)));
    }
    fireEvent.click(button("ふたを開ける"));
    expect(scene().getAttribute("data-grade")).toBe("two");
    expect(msg()).toContain("強火も使ってみよう");
  });

  it("feedback for a closed, wobbling and shrunk shell; the notice clears after ~1.2 s", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("ふたをして蒸す")); // low heat: rank 1 tells at ~1.83 s and opens at ~2.5 s
    fireEvent.click(shell(spotOf(5)));
    expect(msg()).toBe("まだ閉じているよ。小さい貝から開く");
    advance(1300);
    expect(msg()).toBe("貝の大きさを見て火加減を調整");
    const tellMs = ((STEAM_V3_BATCHES.clam.shells[0].opensAt - STEAM_V3_TELL) / STEAM_V3_PROGRESS_PER_SECOND.low) * 1000;
    advance(Math.ceil(tellMs) + 50 - 1300);
    expect(shell(spotOf(1)).getAttribute("data-shell-state")).toBe("tell");
    fireEvent.click(shell(spotOf(1)));
    expect(msg()).toBe("もうすぐ開くよ。開いたらタップ！");
    expect(shell(spotOf(1)).getAttribute("data-shell-state")).toBe("tell");
    // Strong heat now, and leave rank 1 until it shrinks (strong-heat window ~0.70 s).
    fireEvent.click(button("強火"));
    advance(2000);
    expect(shell(spotOf(1)).getAttribute("data-shell-state")).toBe("over");
    fireEvent.click(shell(spotOf(1)));
    expect(msg()).toBe("縮んでしまった…次の貝を見よう");
    advance(1300);
    expect(msg()).not.toBe("縮んでしまった…次の貝を見よう");
  });

  it("over and missed look different in the result", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("強火"));
    fireEvent.click(button("ふたをして蒸す"));
    advance(2500); // the small pair shrank, the medium pair is open
    fireEvent.click(button("ふたを開ける"));
    const states = [0, 1, 2, 3, 4].map((i) => shell(i).getAttribute("data-shell-state"));
    expect(states.filter((s) => s === "over")).toHaveLength(2);
    expect(states.filter((s) => s === "missed").length).toBeGreaterThanOrEqual(1);
    const over = shell(states.indexOf("over")).innerHTML;
    const missed = shell(states.indexOf("missed")).innerHTML;
    expect(missed).toContain("stroke-dasharray");
    expect(missed).toContain("?");
    expect(over).not.toContain("stroke-dasharray");
  });

  it("もう一度蒸す moves to the next layout; やり直す keeps it", () => {
    render(<SteamGameLab clock={clock} />);
    expect(scene().getAttribute("data-layout")).toBe("0");
    fireEvent.click(button("ふたをして蒸す"));
    fireEvent.click(button("やり直す"));
    expect(scene().getAttribute("data-layout")).toBe("0");
    fireEvent.click(button("ふたをして蒸す"));
    advance(500);
    fireEvent.click(button("ふたを開ける"));
    advance(500);
    fireEvent.click(button("もう一度蒸す"));
    expect(scene().getAttribute("data-layout")).toBe("1");
  });
});

describe("Steam Gameplay Lab V3 #755: focus and keyboard", () => {
  it("a pointer press on a shell is prevented from moving focus; the keyboard still focuses and picks it", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("ふたをして蒸す"));
    const target = shell(spotOf(1));
    expect(target.getAttribute("tabindex")).toBe("0");
    expect(fireEvent.pointerDown(target)).toBe(false); // default prevented
    expect(fireEvent.mouseDown(target)).toBe(false);
    advance(openMs(1, "low"));
    target.focus();
    expect(document.activeElement).toBe(target);
    fireEvent.keyDown(target, { key: "Enter" });
    expect(target.getAttribute("data-shell-state")).toBe("rescued");
    const second = shell(spotOf(2));
    advance(openMs(2, "low") - openMs(1, "low"));
    second.focus();
    fireEvent.keyDown(second, { key: " " });
    expect(second.getAttribute("data-shell-state")).toBe("rescued");
    expect(shell(spotOf(1)).getAttribute("tabindex")).toBe("-1"); // a rescued shell leaves the tab order
  });

  it("the focus ring is drawn only for :focus-visible (keyboard), never with plain :focus", () => {
    expect(v3Css).toMatch(/\.sglv3__shell-button:focus-visible > \.sglv3__hit/);
    expect(v3Css).not.toMatch(/\.sglv3__shell-button:focus[^-]/);
    expect(v3Src).toMatch(/onPointerDown=\{noPointerFocus\}/);
  });

  it("reduced motion removes the wobble but keeps a visible tell", () => {
    expect(v3Css).toMatch(/prefers-reduced-motion: reduce[\s\S]*data-state="tell"\] \{ animation: none; filter: drop-shadow/);
  });
});

describe("Steam Gameplay Lab V3 #755: isolation", () => {
  it("the screen reaches the model only through the facade, and none of them store or score anything", () => {
    expect(v3Src).toMatch(/from "\.\/steamGameLabGraded"/);
    expect(v3Src).not.toMatch(/logic\/steam/);
    for (const src of [v3Src, facadeSrc]) expect(src).not.toMatch(/localStorage|sessionStorage|indexedDB|persist|firebase|dispatch\(\{ type: "(FINISH|SCORE)/i);
  });
  it("the provisional window shows in the title", () => {
    window.history.replaceState(null, "", "/?steamGameLab=on&steamGameMode=v3&steamV3Window=loose");
    render(<SteamGameLab clock={clock} />);
    expect(screen.getByText("蒸しミニゲーム V3・強火ゆるめ")).toBeTruthy();
    expect(document.querySelector(".sglv3")!.getAttribute("data-window")).toBe("loose");
  });
});
