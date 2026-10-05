import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode } from "react";
import { SAVE_STORAGE_KEY } from "../state/persistence";
import { backupKey, makeBackupEntry, writeBackup } from "./backup";
import { DEV_STATE_EDITOR_MARK, DEV_STATE_EDITOR_TITLE } from "./marks";
import { StateEditorShell } from "./StateEditorShell";

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StateEditorShell (the entry component, localStorage)", () => {
  it("is a labelled main landmark with the title, the mode badge, the save key, six tabs and the game link", () => {
    render(<StateEditorShell />);
    const main = screen.getByRole("main", { name: DEV_STATE_EDITOR_TITLE });
    expect(main).toHaveAttribute("data-dev-state-editor", DEV_STATE_EDITOR_MARK);
    expect(within(main).getByRole("heading", { level: 1, name: DEV_STATE_EDITOR_TITLE })).toBeInTheDocument();
    expect(main).toHaveTextContent(SAVE_STORAGE_KEY);
    expect(main).toHaveTextContent("DEV");
    expect(within(main).getAllByRole("tab").map((t) => t.textContent)).toEqual(["状態", "プリセット", "材料", "Pitz・Hint", "適用", "バックアップ"]);
    expect(within(main).getByRole("link", { name: "ゲームへ戻る" })).toHaveAttribute("href", import.meta.env.BASE_URL);
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
    fireEvent.click(screen.getByRole("tab", { name: "バックアップ" }));
    expect(screen.getByText(/2026-10-05T00:00:00.000Z/)).toBeInTheDocument();
    expect(document.querySelector('[data-backup-slot="previous"]')).toHaveTextContent("なし");
    expect(window.localStorage.getItem(backupKey("original"))).not.toBeNull();
  });

  it("never writes or removes anything on open or while browsing, also under StrictMode double effects", () => {
    const raw = JSON.stringify({ schemaVersion: 2, dex: [], keep: true });
    window.localStorage.setItem(SAVE_STORAGE_KEY, raw);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    const clear = vi.spyOn(Storage.prototype, "clear");
    render(
      <StrictMode>
        <StateEditorShell />
      </StrictMode>,
    );
    for (const name of ["プリセット", "材料", "Pitz・Hint", "適用", "バックアップ", "状態"]) fireEvent.click(screen.getByRole("tab", { name }));
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(raw);
  });

  it("an unavailable localStorage still renders (storage error), without throwing", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("denied");
    });
    render(<StateEditorShell />);
    expect(document.body.textContent).toMatch(/storage を読めない/);
  });
});
