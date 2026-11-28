import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SteamGameLab } from "./SteamGameLab";
import v2Src from "./SteamGameLabV2.tsx?raw";
import logicSrc from "../logic/steam/steamGameV2.ts?raw";
import facadeSrc from "./steamGameLabRescue.ts?raw";

let t = 10_000;
const clock = () => t;
const advance = (ms: number) => {
  t += ms;
  act(() => vi.advanceTimersByTime(ms));
};
const button = (name: string) => screen.getByRole("button", { name });
const shell = (i: number) => screen.getByTestId(`sgl-v2-shell-${i}`);
const scene = () => screen.getByTestId("sgl-v2-scene");

beforeEach(() => {
  t = 10_000;
  window.history.replaceState(null, "", "/?steamGameLab=on&steamGameMode=v2");
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Steam Gameplay Lab V2 #755", () => {
  it("keeps V1 untouched unless mode=v2 is explicitly selected", () => {
    window.history.replaceState(null, "", "/?steamGameLab=on");
    render(<SteamGameLab clock={clock} />);
    expect(screen.getByTestId("sgl-scene")).toBeTruthy();
    expect(screen.queryByTestId("sgl-v2-scene")).toBeNull();
  });

  it("shows a single-screen 5-shell pot with two visible batch choices", () => {
    render(<SteamGameLab clock={clock} />);
    expect(screen.getByText("蒸しミニゲーム V2")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toContain("保存されません");
    expect(scene().getAttribute("data-rescued")).toBe("0");
    for (let i = 0; i < 5; i++) expect(shell(i).getAttribute("data-shell-state")).toBe("closed");
    expect(button("強火")).toBeDisabled();
    expect(button("ムール貝・大粒")).not.toBeDisabled();
  });

  it("one open shell is rescued with a tap and keeps its green tick", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("ふたをして蒸す"));
    fireEvent.click(button("強火"));
    advance(1350);
    expect(shell(0).getAttribute("data-shell-state")).toBe("ready");
    expect(shell(4).getAttribute("data-shell-state")).toBe("closed");
    fireEvent.click(shell(0));
    expect(shell(0).getAttribute("data-shell-state")).toBe("rescued");
    expect(scene().getAttribute("data-rescued")).toBe("1");
    advance(3500);
    expect(shell(0).getAttribute("data-shell-state")).toBe("rescued");
  });

  it("a premature tap leaves that shell playable for its later opening", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("ふたをして蒸す"));
    fireEvent.click(button("強火"));
    advance(1500);
    fireEvent.click(shell(4));
    expect(shell(4).getAttribute("data-shell-state")).toBe("closed");
    expect(screen.getByText(/まだ閉じているよ/)).toBeTruthy();
    advance(2400);
    expect(shell(4).getAttribute("data-shell-state")).toBe("ready");
    fireEvent.click(shell(4));
    expect(shell(4).getAttribute("data-shell-state")).toBe("rescued");
  });

  it("without rescuing shells, merely waiting and opening the lid scores zero", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("ふたをして蒸す"));
    fireEvent.click(button("強火"));
    advance(4200);
    expect(Number(scene().getAttribute("data-over"))).toBeGreaterThan(0);
    fireEvent.click(button("ふたを開ける"));
    expect(scene().getAttribute("data-verdict")).toBe("missed");
    expect(scene().getAttribute("data-rescued")).toBe("0");
    expect(screen.getByText(/0\/5個ふっくら/)).toBeTruthy();
  });

  it("a well timed high-to-low run rescues every shell", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("ふたをして蒸す"));
    fireEvent.click(button("強火"));
    advance(2000);
    fireEvent.click(button("弱火"));
    advance(100);
    fireEvent.click(shell(0));
    advance(200);
    fireEvent.click(shell(1));
    advance(800);
    fireEvent.click(shell(2));
    advance(1100);
    fireEvent.click(shell(3));
    advance(1100);
    fireEvent.click(shell(4));
    expect(scene().getAttribute("data-rescued")).toBe("5");
    fireEvent.click(button("ふたを開ける"));
    expect(scene().getAttribute("data-verdict")).toBe("perfect");
    expect(screen.getByText(/大成功！5個とも/)).toBeTruthy();
  });

  it("larger mussels need different timing, while the old session remains untouched", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("ムール貝・大粒"));
    expect(screen.getByText("ムール貝・大粒").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button("ふたをして蒸す"));
    fireEvent.click(button("強火"));
    advance(3900);
    expect(shell(4).getAttribute("data-shell-state")).toBe("closed");
    fireEvent.click(button("ふたを開ける"));
    expect(shell(4).getAttribute("data-shell-state")).toBe("closed");
  });

  it("stops on pagehide, and can restart immediately with やり直す", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("ふたをして蒸す"));
    advance(1500);
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(scene().getAttribute("data-rescued")).toBe("0");
    expect(button("ふたをして蒸す")).toBeTruthy();
    fireEvent.click(button("ふたをして蒸す"));
    fireEvent.click(button("やり直す"));
    expect(button("ふたをして蒸す")).toBeTruthy();
  });

  it("suppresses a ghost double tap right after ending a run", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("ふたをして蒸す"));
    advance(1000);
    fireEvent.click(button("ふたを開ける"));
    fireEvent.click(button("もう一度蒸す"));
    expect(scene().getAttribute("data-verdict")).toBe("missed");
    advance(450);
    fireEvent.click(button("もう一度蒸す"));
    expect(scene().getAttribute("data-verdict")).toBe("none");
  });

  it("V2 neither stores progress nor imports the game's scoring/state code", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(button("ふたをして蒸す"));
    advance(4000);
    fireEvent.click(button("ふたを開ける"));
    expect(setItem).not.toHaveBeenCalled();
    const withoutComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const src of [v2Src, logicSrc, facadeSrc].map(withoutComments)) {
      expect(src).not.toMatch(/localStorage|sessionStorage|indexedDB|persistProgress|gameReducer|scoringV2|pendingRound/);
    }
  });
});
