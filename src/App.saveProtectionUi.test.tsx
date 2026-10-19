import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY } from "./state/persistence";
import { quarantineKey, readQuarantine } from "./state/saveQuarantine";

/**
 * Save Protection PR-2 (Issue #560): HOME notice + Settings / Reset dialogs through the real App and real (jsdom)
 * localStorage. Seeds only this test environment's own storage.
 */

const FUTURE = JSON.stringify({ schemaVersion: 3, dex: [], pitzBalance: 777, futureField: { keep: "me" } });
const BROKEN = "{not json";
const FIRST = quarantineKey("first", SAVE_STORAGE_KEY);

function mockReload() {
  const reload = vi.fn();
  Object.defineProperty(window, "location", { value: { ...window.location, reload }, writable: true });
  return reload;
}

function seedBackup(kind: "corrupt" | "unknown-schema", raw: string, acknowledged: boolean) {
  window.localStorage.setItem(
    FIRST,
    JSON.stringify({
      v: 1,
      slot: "first",
      createdAt: "2026-10-19T00:00:00.000Z",
      sourceKey: SAVE_STORAGE_KEY,
      kind,
      rawLength: raw.length,
      raw,
      acknowledged,
    }),
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  window.localStorage.clear();
});

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "設定" }));
  return document.querySelector<HTMLElement>(".dex-overlay")!;
}

describe("HOME save notice", () => {
  it("a healthy first launch shows no notice", () => {
    render(<App />);
    expect(document.querySelector("[data-save-notice]")).toBeNull();
  });

  it("future version: blocking alert, the stored bytes stay untouched while playing", () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, FUTURE);
    render(<App />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-save-notice", "future-version");
    expect(alert).toHaveTextContent("新しいバージョンの保存データがあります");
    // Owner wording decision: not saved here, and what is played now can be lost on a reload.
    expect(alert).toHaveTextContent("このバージョンでは保存されません");
    expect(alert).toHaveTextContent("再読み込みすると失われる可能性があります");
    expect(within(alert).queryByRole("button", { name: "了解" })).toBeNull();
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(FUTURE);
  });

  it("corrupt data: its own notice (not the future-version one), and it is not yet destroyed", () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, BROKEN);
    render(<App />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-save-notice", "corrupt");
    expect(alert).toHaveTextContent("保存データを読み込めませんでした");
    // Owner wording decision: a backup is not a restore; the earlier progress was not restored.
    expect(alert).toHaveTextContent("以前の進行は復元されていません");
    expect(alert).toHaveTextContent("復元ではありません");
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(BROKEN);
  });

  it("unreadable storage: reported as storage-unavailable", () => {
    const real = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (key === SAVE_STORAGE_KEY) throw new Error("denied");
      return real.call(this, key);
    });
    render(<App />);
    expect(screen.getByRole("alert")).toHaveAttribute("data-save-notice", "storage-unavailable");
  });

  it("an informational backup notice can be acknowledged; the backup itself stays", async () => {
    seedBackup("corrupt", BROKEN, false);
    const user = userEvent.setup();
    render(<App />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("data-save-notice", "backup-kept");
    await user.click(within(status).getByRole("button", { name: "了解" }));
    expect(document.querySelector("[data-save-notice]")).toBeNull();
    const kept = readQuarantine(window.localStorage, "first", SAVE_STORAGE_KEY);
    expect(kept.kind === "ok" && kept.entry.raw).toBe(BROKEN);
  });

  it("the notice's button opens Settings", async () => {
    window.localStorage.setItem(SAVE_STORAGE_KEY, FUTURE);
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole("alert")).getByRole("button", { name: "設定を開く" }));
    expect(screen.getByRole("heading", { name: /設定/ })).toBeInTheDocument();
  });
});

describe("Reset dialog and backup deletion", () => {
  it("future version: the dialog says the data is kept; confirming moves it to the backup, never deletes it", async () => {
    const reload = mockReload();
    window.localStorage.setItem(SAVE_STORAGE_KEY, FUTURE);
    const user = userEvent.setup();
    render(<App />);
    const settings = await openSettings(user);
    await user.click(within(settings).getByRole("button", { name: "ゲームデータをリセット" }));
    const dialog = document.querySelector<HTMLElement>(".settings-reset-confirm__panel")!;
    expect(dialog).toHaveTextContent("削除されず端末内に退避");
    await user.click(within(dialog).getByRole("button", { name: "最初からやり直す" }));
    expect(reload).toHaveBeenCalled();
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBeNull();
    const kept = readQuarantine(window.localStorage, "first", SAVE_STORAGE_KEY);
    expect(kept.kind === "ok" && kept.entry.raw).toBe(FUTURE);
  });

  it("a Reset that cannot back the data up refuses, keeps the save, and says why", async () => {
    const reload = mockReload();
    window.localStorage.setItem(SAVE_STORAGE_KEY, FUTURE);
    const realSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k: string, v: string) {
      if (k.includes("quarantine")) throw new DOMException("quota", "QuotaExceededError");
      return realSet.call(this, k, v);
    });
    const user = userEvent.setup();
    render(<App />);
    const settings = await openSettings(user);
    await user.click(within(settings).getByRole("button", { name: "ゲームデータをリセット" }));
    const dialog = document.querySelector<HTMLElement>(".settings-reset-confirm__panel")!;
    await user.click(within(dialog).getByRole("button", { name: "最初からやり直す" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("退避できなかったため");
    expect(reload).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(FUTURE);
  });

  it("Reset keeps an existing backup; deleting it needs the separate dialog AND the acknowledgement", async () => {
    mockReload();
    seedBackup("unknown-schema", FUTURE, true);
    const user = userEvent.setup();
    render(<App />);
    const settings = await openSettings(user);

    await user.click(within(settings).getByRole("button", { name: "ゲームデータをリセット" }));
    const resetDialog = document.querySelector<HTMLElement>(".settings-reset-confirm__panel")!;
    expect(resetDialog).toHaveTextContent("退避データは、リセットしても削除されません");
    await user.click(within(resetDialog).getByRole("button", { name: "キャンセル" }));
    expect(window.localStorage.getItem(FIRST)).not.toBeNull();

    await user.click(within(settings).getByRole("button", { name: "退避データを削除…" }));
    const dialog = document.querySelector<HTMLElement>(".settings-reset-confirm__panel")!;
    const confirm = within(dialog).getByRole("button", { name: "削除する" });
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(window.localStorage.getItem(FIRST)).not.toBeNull();

    await user.click(within(dialog).getByRole("button", { name: "キャンセル" }));
    expect(window.localStorage.getItem(FIRST)).not.toBeNull();

    await user.click(within(settings).getByRole("button", { name: "退避データを削除…" }));
    const again = document.querySelector<HTMLElement>(".settings-reset-confirm__panel")!;
    await user.click(within(again).getByRole("checkbox"));
    await user.click(within(again).getByRole("button", { name: "削除する" }));
    expect(window.localStorage.getItem(FIRST)).toBeNull();
    expect(within(settings).getByText("退避データを削除しました。")).toBeInTheDocument();
  });
});
