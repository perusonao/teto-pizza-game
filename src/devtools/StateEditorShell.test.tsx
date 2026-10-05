import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { SAVE_STORAGE_KEY } from "../state/persistence";
import { backupKey, makeBackupEntry, writeBackup } from "./backup";
import { DEV_STATE_EDITOR_MARK, DEV_STATE_EDITOR_TITLE } from "./marks";
import { PENDING_PRESETS, PRESETS } from "./presets";
import { StateEditorShell } from "./StateEditorShell";

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StateEditorShell (S3: read-only)", () => {
  it("is a labelled main landmark with the title, the mode badge, the save key and the game link", () => {
    render(<StateEditorShell />);
    const main = screen.getByRole("main", { name: DEV_STATE_EDITOR_TITLE });
    expect(main).toHaveAttribute("data-dev-state-editor", DEV_STATE_EDITOR_MARK);
    expect(within(main).getByRole("heading", { level: 1, name: DEV_STATE_EDITOR_TITLE })).toBeInTheDocument();
    expect(main).toHaveTextContent(SAVE_STORAGE_KEY);
    expect(main).toHaveTextContent("DEV");
    expect(within(main).getByRole("link", { name: "ゲームへ戻る" })).toHaveAttribute("href", import.meta.env.BASE_URL);
  });

  it("lists every preset, and the #402-dependent one as not wired", () => {
    render(<StateEditorShell />);
    for (const p of PRESETS) expect(screen.getByText(p.labelJa)).toBeInTheDocument();
    for (const p of PENDING_PRESETS) {
      const item = screen.getByText(p.labelJa).closest("li")!;
      expect(item).toHaveTextContent("#402");
      expect(within(item).queryByRole("button")).toBeNull();
    }
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("describes the stored save: none / readable / corrupt / unknown schema", () => {
    const text = () => document.body.textContent ?? "";
    const show = () => {
      cleanup();
      render(<StateEditorShell />);
    };
    show();
    expect(text()).toMatch(/セーブなし/);
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ schemaVersion: 2, dex: [], pitzBalance: 42 }));
    show();
    expect(text()).toMatch(/読み取り可.*Pitz 42/);
    window.localStorage.setItem(SAVE_STORAGE_KEY, "{bad");
    show();
    expect(text()).toMatch(/壊れている/);
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ schemaVersion: 9, dex: [] }));
    show();
    expect(text()).toMatch(/未知の schema/);
  });

  it("shows whether a backup exists, without touching it", () => {
    writeBackup(window.localStorage, makeBackupEntry("original", null, "2026-10-05T00:00:00.000Z"));
    render(<StateEditorShell />);
    expect(screen.getByText(/backup original: あり（2026-10-05T00:00:00.000Z）/)).toBeInTheDocument();
    expect(screen.getByText(/backup previous: なし/)).toBeInTheDocument();
    expect(window.localStorage.getItem(backupKey("original"))).not.toBeNull();
  });

  it("never writes or removes anything, also under StrictMode double effects", async () => {
    const { StrictMode } = await import("react");
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ schemaVersion: 2, dex: [], keep: true }));
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    const clear = vi.spyOn(Storage.prototype, "clear");
    render(
      <StrictMode>
        <StateEditorShell />
      </StrictMode>,
    );
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(JSON.stringify({ schemaVersion: 2, dex: [], keep: true }));
  });

  it("an unavailable localStorage still renders (storage error), without throwing", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("denied");
    });
    render(<StateEditorShell />);
    expect(document.body.textContent).toMatch(/storage を読めない/);
  });
});
