import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SteamGameLab } from "./SteamGameLab";
import v3Src from "./SteamGameLabV3.tsx?raw";
import logicSrc from "../logic/steam/steamGameV3.ts?raw";
import facadeSrc from "./steamGameLabStars.ts?raw";
import { readFileSync } from "node:fs";
import path from "node:path";

const cssSrc = readFileSync(path.join(__dirname, "steamGameLabV3.css"), "utf8");

let t = 10_000;
const clock = () => t;
const advance = (ms: number) => {
  t += ms;
  act(() => vi.advanceTimersByTime(ms));
};
const button = (name: string) => screen.getByRole("button", { name });
const shell = (i: number) => screen.getByTestId(`sgl-v3-shell-${i}`);
const scene = () => screen.getByTestId("sgl-v3-scene");
const msg = () => screen.getByTestId("sgl-v3-msg").textContent ?? "";
const lab = () => document.querySelector(".sglv3") as HTMLElement;

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

describe("Steam Gameplay Lab V3 #755 — routing", () => {
  it.each([
    ["?steamGameLab=on", "sgl-scene"],
    ["?steamGameLab=on&steamGameMode=v2", "sgl-v2-scene"],
    ["?steamGameLab=on&steamGameMode=v3", "sgl-v3-scene"],
    ["?steamGameLab=on&steamGameMode=V3", "sgl-scene"],
    ["?steamGameLab=on&steamGameMode=v3&steamGameMode=v3", "sgl-scene"],
  ])("%s opens %s (V1 and V2 stay reachable; v3 needs the exact flag once)", (q, id) => {
    window.history.replaceState(null, "", `/${q}`);
    render(<SteamGameLab clock={clock} />);
    expect(screen.getByTestId(id)).toBeTruthy();
  });
});

describe("Steam Gameplay Lab V3 #755 — play", () => {
  it("idle: the rule is shown, shells are labelled by size, layout 0 is not the reading order, heat can be chosen before starting (U6)", () => {
    render(<SteamGameLab clock={clock} />);
    expect(screen.getByText("蒸しミニゲーム V3")).toBeTruthy();
    expect(msg()).toContain("小さい貝から開くよ");
    expect([0, 1, 2, 3, 4].map((i) => shell(i).getAttribute("data-shell-size")).join("")).toBe("小中中中大");
    expect([0, 1, 2, 3, 4].map((i) => shell(i).getAttribute("data-spot"))).not.toEqual(["0", "1", "2", "3", "4"]);
    expect(button("強火")).not.toBeDisabled();
    fireEvent.click(button("強火"));
    expect(button("強火").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button("ふたをして蒸す"));
    expect(screen.getByTestId("sgl-v3-lid").getAttribute("data-heat")).toBe("high");
  });

  it("shells wobble before they open; the trio wobbles together and the hint says so", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("強火"));
    fireEvent.click(button("ふたをして蒸す"));
    advance(950); // small shell: wobble from (0.26-0.06)/0.22 = 0.91 s, opens at 1.18 s
    expect(shell(0).getAttribute("data-wobble")).toBe("true");
    expect(shell(0).getAttribute("data-shell-state")).toBe("closed");
    advance(300);
    expect(shell(0).getAttribute("data-shell-state")).toBe("ready");
    fireEvent.click(shell(0));
    advance(850); // 2.10 s: all three of the trio wobble (the last from (0.52-0.06)/0.22 = 2.09 s); they open at 2.27 s
    expect([1, 2, 3].map((i) => shell(i).getAttribute("data-wobble"))).toEqual(["true", "true", "true"]);
    expect(msg()).toContain("いくつも揺れてる");
  });

  it("planned switching wins ★★★ and shows the time only on the result", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("強火"));
    fireEvent.click(button("ふたをして蒸す"));
    expect(screen.getByTestId("sgl-v3-count").textContent).toBe("ふっくら回収 0/5");
    advance(1300);
    fireEvent.click(shell(0));
    advance(700); // 2.0 s: the trio is about to open → low
    fireEvent.click(button("弱火"));
    advance(1300); // 3.3 s on low: the trio opened at 2.50 / 2.58 / 2.67 s (low window 3.28 s)
    for (const i of [1, 2, 3]) {
      fireEvent.click(shell(i));
      advance(300);
    }
    fireEvent.click(button("強火")); // 4.2 s, progress 0.704: the large shell opens at ~4.64 s
    advance(1000);
    expect(shell(4).getAttribute("data-shell-state")).toBe("ready");
    fireEvent.click(shell(4));
    advance(200);
    fireEvent.click(button("ふたを開ける"));
    expect(scene().getAttribute("data-stars")).toBe("3");
    expect(scene().getAttribute("data-verdict")).toBe("master");
    expect(screen.getByTestId("sgl-v3-count").textContent).toMatch(/★★★ \d\.\d秒/);
    expect(screen.getByTestId("sgl-v3-summary").textContent).toContain("ふっくら5・蒸しすぎ0・取り忘れ0");
    expect(msg()).toContain("名人");
  });

  it("low heat only: 5/5 is ★★ with advice to use high heat while shells are closed", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("ふたをして蒸す"));
    advance(2300);
    fireEvent.click(shell(0));
    advance(2200);
    for (const i of [1, 2, 3]) {
      fireEvent.click(shell(i));
      advance(300);
    }
    advance(1800);
    fireEvent.click(shell(4));
    fireEvent.click(button("ふたを開ける"));
    expect(scene().getAttribute("data-stars")).toBe("2");
    expect(msg()).toContain("閉じている間は強火");
  });

  it("U1 + U2: tapping an overcooked shell answers with a message that clears by itself after 1.6 s", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("強火"));
    fireEvent.click(button("ふたをして蒸す"));
    advance(2000); // small opened at 1.18 s, window 0.71 s → over by 1.9 s
    expect(shell(0).getAttribute("data-shell-state")).toBe("over");
    expect(shell(0).getAttribute("aria-disabled")).toBe("false");
    fireEvent.click(shell(0));
    expect(msg()).toContain("縮んじゃった");
    expect(shell(0).getAttribute("data-shell-state")).toBe("over");
    advance(1700);
    expect(msg()).not.toContain("縮んじゃった");
  });

  it("U2: a notice also gives way as soon as another shell turns ready", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("強火"));
    fireEvent.click(button("ふたをして蒸す"));
    advance(1250);
    fireEvent.click(shell(0));
    expect(msg()).toContain("取り出した");
    advance(1100); // 2.35 s: the trio is opening, well within 1.6 s of the notice
    expect(Number(scene().getAttribute("data-ready"))).toBeGreaterThan(0);
    expect(msg()).toContain("橙色の貝をタップ");
  });

  it("U5: the result tells rescued / overcooked / missed apart in colour, shape and words", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("強火"));
    fireEvent.click(button("ふたをして蒸す"));
    advance(1300);
    fireEvent.click(shell(0));
    advance(2400); // 3.7 s: trio overcooked, large just opened (3.64 s)
    fireEvent.click(button("ふたを開ける"));
    expect([0, 1, 4].map((i) => shell(i).getAttribute("data-shell-state"))).toEqual(["rescued", "over", "missed"]);
    expect(shell(1).querySelector("text")?.textContent).toBe("×");
    expect(shell(4).querySelector("rect[stroke-dasharray]")).not.toBeNull();
    expect(shell(1).getAttribute("aria-label")).toContain("蒸しすぎ");
    expect(shell(4).getAttribute("aria-label")).toContain("取り忘れ");
    expect(screen.getByTestId("sgl-v3-summary").textContent).toContain("ふっくら1・蒸しすぎ3・取り忘れ1");
    expect(msg()).toContain("同じ大きさの貝が揺れたら弱火");
  });

  it("U3: pointer input never draws the focus ring; keyboard input does and Enter still rescues", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("強火"));
    fireEvent.click(button("ふたをして蒸す"));
    fireEvent.pointerDown(shell(0));
    expect(lab().getAttribute("data-input")).toBe("pointer");
    advance(1250);
    fireEvent.keyDown(shell(0), { key: "Enter" });
    expect(lab().getAttribute("data-input")).toBe("keyboard");
    expect(shell(0).getAttribute("data-shell-state")).toBe("rescued");
    expect(cssSrc).toMatch(/\.sglv3\[data-input="keyboard"\] \.sglv3__shell-button:focus-visible/);
    expect(cssSrc).toMatch(/\.sglv3__shell-button:focus \{ outline: none; \}/);
  });

  it("U4: shell-type buttons are 48px; the round layout rotates on もう一度蒸す", () => {
    expect(cssSrc).toMatch(/\.sglv3__batch button \{ min-height: 48px;/);
    render(<SteamGameLab clock={clock} />);
    expect(lab().getAttribute("data-layout")).toBe("0");
    fireEvent.click(button("ふたをして蒸す"));
    advance(500);
    fireEvent.click(button("ふたを開ける"));
    advance(500);
    fireEvent.click(button("もう一度蒸す"));
    expect(lab().getAttribute("data-layout")).toBe("1");
    fireEvent.click(button("やり直す"));
    expect(lab().getAttribute("data-layout")).toBe("1");
  });

  it("stores nothing and does not import the game's state, scoring or storage", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("ふたをして蒸す"));
    advance(4000);
    fireEvent.click(button("ふたを開ける"));
    expect(setItem).not.toHaveBeenCalled();
    const withoutComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const src of [v3Src, logicSrc, facadeSrc].map(withoutComments)) {
      expect(src).not.toMatch(/localStorage|sessionStorage|indexedDB|persistProgress|gameReducer|scoringV2|pendingRound|firebase/i);
    }
  });
});
