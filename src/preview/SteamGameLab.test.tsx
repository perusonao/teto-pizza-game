import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SteamGameLab } from "./SteamGameLab";
import { STEAM_GAME_LAB_LABEL, STEAM_GAME_LAB_MARK, STEAM_GAME_RESULT_COPY } from "./steamGameLab";
import labSrc from "./SteamGameLab.tsx?raw";
import modelSrc from "./steamGameLab.ts?raw";

let t = 1000;
const clock = () => t;
const advance = (ms: number) => {
  t += ms;
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};
const btn = (name: string) => screen.getByRole("button", { name });
const scene = () => screen.getByTestId("sgl-scene");

let setItem: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  t = 1000;
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
  setItem = vi.spyOn(Storage.prototype, "setItem");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("SteamGameLab", () => {
  it("shows the label and the mark, idle with a single start button; fire buttons disabled", () => {
    const { container } = render(<SteamGameLab clock={clock} />);
    expect(screen.getByRole("note").textContent).toBe(STEAM_GAME_LAB_LABEL);
    expect(container.querySelector(`[data-lab="${STEAM_GAME_LAB_MARK}"]`)).not.toBeNull();
    expect(btn("弱火")).toBeDisabled();
    expect(btn("強火")).toBeDisabled();
    expect(btn("やり直す")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "ふたを開ける" })).toBeNull();
    expect(scene().getAttribute("data-open-count")).toBe("0");
  });

  it("high fire then lifting at the right time: shells open, 'ちょうどいい' result", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(btn("ふたをして蒸す"));
    fireEvent.click(btn("強火"));
    expect(btn("強火").getAttribute("aria-pressed")).toBe("true");
    advance(4000);
    expect(scene().getAttribute("data-open-count")).toBe("5");
    fireEvent.click(btn("ふたを開ける"));
    expect(scene().getAttribute("data-outcome")).toBe("justRight");
    expect(screen.getByRole("status").textContent).toBe(STEAM_GAME_RESULT_COPY.justRight);
  });

  it("lifting too early and staying too long give different results", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(btn("ふたをして蒸す"));
    fireEvent.click(btn("強火"));
    advance(1500);
    fireEvent.click(btn("ふたを開ける"));
    expect(scene().getAttribute("data-outcome")).toBe("tooEarly");
    advance(500); // past the retry guard
    fireEvent.click(btn("もう一度蒸す"));
    fireEvent.click(btn("強火"));
    advance(6500);
    fireEvent.click(btn("ふたを開ける"));
    expect(scene().getAttribute("data-outcome")).toBe("overcooked");
    expect(screen.getByRole("status").textContent).toBe(STEAM_GAME_RESULT_COPY.overcooked);
  });

  it("a double tap on 「ふたを開ける」 does not instantly restart (retry guard), later it does", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(btn("ふたをして蒸す"));
    advance(1000);
    fireEvent.click(btn("ふたを開ける"));
    fireEvent.click(btn("もう一度蒸す")); // same instant: ignored
    expect(scene().getAttribute("data-outcome")).toBe("tooEarly");
    advance(450);
    fireEvent.click(btn("もう一度蒸す"));
    expect(scene().getAttribute("data-outcome")).toBe("none");
    expect(screen.getByRole("button", { name: "ふたを開ける" })).toBeTruthy();
  });

  it("やり直す cancels a cook and clears a result, instantly and repeatedly", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(btn("ふたをして蒸す"));
    advance(2000);
    fireEvent.click(btn("やり直す"));
    expect(screen.getByRole("button", { name: "ふたをして蒸す" })).toBeTruthy();
    fireEvent.click(btn("ふたをして蒸す"));
    fireEvent.click(btn("ふたを開ける"));
    fireEvent.click(btn("やり直す"));
    expect(screen.getByRole("button", { name: "ふたをして蒸す" })).toBeTruthy();
    expect(scene().getAttribute("data-open-count")).toBe("0");
  });

  it("hiding the page discards a cook in progress", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(btn("ふたをして蒸す"));
    advance(1000);
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    expect(screen.getByRole("button", { name: "ふたをして蒸す" })).toBeTruthy();
  });

  it("never writes to storage; the source has no storage / game-state tokens", () => {
    render(<SteamGameLab clock={clock} />);
    fireEvent.click(btn("ふたをして蒸す"));
    advance(5000);
    fireEvent.click(btn("ふたを開ける"));
    expect(setItem).not.toHaveBeenCalled();
    const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const src of [labSrc, modelSrc].map(code)) {
      expect(src).not.toMatch(/localStorage|sessionStorage|indexedDB|persist|dispatchGame|gameReducer|inventory|scoring|pendingRound/);
    }
    expect(labSrc).not.toMatch(/from ["']\.\.\//);
  });
});
