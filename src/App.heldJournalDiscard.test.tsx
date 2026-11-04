import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY } from "./state/persistence";
import { heldJournalQuarantineKey } from "./state/heldJournalDiscard";
import { quarantineKey, readQuarantine } from "./state/saveQuarantine";

/**
 * Save P1-1 (Issue #664): the HOME notice's discard button and its confirmation dialog, through the real App and the jsdom
 * localStorage of this test environment only.
 */

const QKEY = heldJournalQuarantineKey();
const FIRST = quarantineKey("first", QKEY);

function seed(journal: unknown): string {
  const raw = JSON.stringify({ schemaVersion: 2, dex: [], pitzBalance: 40, ownedIngredientIds: ["onion"], missionBest: {}, inventory: { onion: 20 }, pendingRound: journal });
  window.localStorage.setItem(SAVE_STORAGE_KEY, raw);
  return raw;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const notice = () => document.querySelector<HTMLElement>('[data-round-notice="held"]');

describe("HOME: a kept journal offers the discard", () => {
  it("no kept journal -> no button", () => {
    render(<App />);
    expect(notice()).toBeNull();
    expect(document.querySelector("[data-held-discard-open]")).toBeNull();
  });

  it("the dialog opens on キャンセル focus, the button stays disabled until every check is ticked, cancel changes nothing", async () => {
    const user = userEvent.setup();
    seed({ v: 2, id: "future-1", status: "pending" });
    render(<App />);
    const after = window.localStorage.getItem(SAVE_STORAGE_KEY);
    await user.click(screen.getByRole("button", { name: "この記録を退避して破棄…" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    // a journal a matching build could complete: strong warning and the second check
    expect(document.querySelector("[data-held-discard-warning]")).not.toBeNull();
    expect(document.querySelectorAll("[data-held-discard-check]")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "キャンセル" })).toHaveFocus();
    const confirm = document.querySelector<HTMLButtonElement>("[data-held-discard-confirm]")!;
    expect(confirm).toBeDisabled();
    const checks = [...document.querySelectorAll<HTMLInputElement>("[data-held-discard-check]")];
    await user.click(checks[0]!);
    expect(confirm).toBeDisabled();
    await user.click(checks[1]!);
    expect(confirm).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(after);
    expect(window.localStorage.getItem(FIRST)).toBeNull();
    expect(notice()).not.toBeNull();
  });

  it("corrupt: one check and no strong warning; confirming copies the save, removes only the journal and clears the notice", async () => {
    const user = userEvent.setup();
    seed({ v: 1, id: 5 });
    render(<App />);
    const started = window.localStorage.getItem(SAVE_STORAGE_KEY)!;
    await user.click(screen.getByRole("button", { name: "この記録を退避して破棄…" }));
    expect(document.querySelector("[data-held-discard-warning]")).toBeNull();
    const [check] = [...document.querySelectorAll<HTMLInputElement>("[data-held-discard-check]")];
    await user.click(check!);
    await user.click(document.querySelector<HTMLButtonElement>("[data-held-discard-confirm]")!);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(notice()).toBeNull();
    const copy = readQuarantine(window.localStorage, "first", QKEY);
    expect(copy.kind === "ok" && copy.entry.raw).toBe(started);
    const saved = JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY)!) as Record<string, unknown>;
    expect(saved).not.toHaveProperty("pendingRound");
    expect(saved.pitzBalance).toBe(40);
    expect(screen.getByText("調理の記録を破棄しました")).toBeInTheDocument();
  });

  it("a copy that cannot be stored: the failure is shown in the dialog and nothing is removed", async () => {
    const user = userEvent.setup();
    seed({ v: 1, id: 5 });
    render(<App />);
    const started = window.localStorage.getItem(SAVE_STORAGE_KEY);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      if (key.startsWith(QKEY)) throw new DOMException("full", "QuotaExceededError");
      original.call(this, key, value);
    };
    try {
      await user.click(screen.getByRole("button", { name: "この記録を退避して破棄…" }));
      await user.click(document.querySelector<HTMLInputElement>("[data-held-discard-check]")!);
      await user.click(document.querySelector<HTMLButtonElement>("[data-held-discard-confirm]")!);
    } finally {
      Storage.prototype.setItem = original;
    }
    expect(document.querySelector("[data-held-discard-failure]")).toHaveTextContent("何も破棄していません");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(window.localStorage.getItem(SAVE_STORAGE_KEY)).toBe(started);
    expect(notice()).not.toBeNull();
  });
});
