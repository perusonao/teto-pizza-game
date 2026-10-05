import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadSave, SAVE_STORAGE_KEY, type StorageLike } from "../state/persistence";
import { backupKey } from "./backup";
import { productionCatalog } from "./editorCatalog";
import { ingredientName } from "./editorModel";
import { createMemoryStorage } from "./memoryStorage";
import { buildPreset } from "./presets";
import { StateEditor } from "./StateEditor";
import { editableFromSave } from "./stateModel";

const catalog = productionCatalog();
const finite = catalog.ingredients.filter((i) => i.unlockCondition !== undefined).map((i) => i.id);
const KEY = SAVE_STORAGE_KEY;
const NOW = () => new Date("2026-10-05T00:00:00.000Z");

/** A storage that counts and can fail writes; `writes` lists every setItem / removeItem key. */
function spyStorage(seed: Record<string, string> = {}, failSet: (key: string) => boolean = () => false) {
  const inner = createMemoryStorage(seed);
  const writes: string[] = [];
  const storage: StorageLike & { inner: StorageLike; writes: string[] } = {
    inner,
    writes,
    getItem: (k) => inner.getItem(k),
    setItem: (k, v) => {
      if (failSet(k)) throw new Error("quota");
      writes.push(`set:${k}`);
      inner.setItem(k, v);
    },
    removeItem: (k) => {
      writes.push(`remove:${k}`);
      inner.removeItem(k);
    },
  };
  return storage;
}

const FUTURE_RAW = JSON.stringify({
  schemaVersion: 2,
  dex: [{ recipeId: "future-recipe", discovered: true, bestScore: 80, bestStars: 4, timesMade: 2 }],
  pitzBalance: 5,
  ownedIngredientIds: [...catalog.starterIds, "future-ingredient"],
  missionBest: { "lunch-rush": 700 },
  inventory: { "future-ingredient": 3 },
  futureTopLevel: { a: [1] },
  dinnerMissionRecords: { d: { x: 1 } },
  discoveryHintFacts: { margherita: ["ing:basil"] },
  discoveryHintPurchases: { margherita: 1 },
});

afterEach(cleanup);

const tab = (name: string) => screen.getByRole("tab", { name });
async function openTab(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(tab(name));
}
const diffIds = () => Array.from(document.querySelectorAll("[data-diff-id]")).map((el) => el.getAttribute("data-diff-id"));

describe("opening and browsing never writes (Owner Contract 7)", () => {
  it("mount, every tab, preset load, edits and search: zero storage writes", async () => {
    const storage = spyStorage({ [KEY]: FUTURE_RAW });
    const user = userEvent.setup();
    render(<StateEditor storage={storage} now={NOW} />);
    for (const name of ["状態", "プリセット", "材料", "Pitz・Hint", "適用", "バックアップ"]) await openTab(user, name);
    await openTab(user, "プリセット");
    await user.click(screen.getByRole("button", { name: /All Ingredients/ }));
    await openTab(user, "材料");
    await user.type(screen.getByRole("searchbox", { name: /材料を検索/ }), "a");
    await user.click(screen.getAllByRole("switch")[0]);
    expect(storage.writes).toEqual([]);
    expect(storage.inner.getItem(KEY)).toBe(FUTURE_RAW);
  });
});

describe("presets", () => {
  it("a preset only replaces the DRAFT: the status shows it and storage is untouched", async () => {
    const storage = spyStorage();
    const user = userEvent.setup();
    render(<StateEditor storage={storage} now={NOW} />);
    await openTab(user, "プリセット");
    const bPreset = document.querySelector('[data-preset-id="step12-b-discovered"]') as HTMLButtonElement;
    expect(bPreset).toBeEnabled(); // #402 is merged: the preset is wired
    await user.click(screen.getByRole("button", { name: /Step 12 A\/B\/C undiscovered/ }));
    expect(screen.getByRole("status")).toHaveTextContent("まだ適用されていません");
    await openTab(user, "状態");
    const entries = document.querySelector("[data-research-entries]")!;
    expect(entries.getAttribute("data-research-entries")).toBe("3");
    expect(entries).toHaveTextContent(ingredientName(catalog, catalog.ladder.steps[11].ingredientIds[0]));
    expect(screen.getByText(/変更: [1-9]\d* 件/)).toBeInTheDocument();
    expect(storage.writes).toEqual([]);
  });
});

describe("Step 12 B discovered", () => {
  it("loads into the draft: 2 Research Entries (A and C), the Dex gains one recipe, nothing is written", async () => {
    const storage = spyStorage();
    const user = userEvent.setup();
    render(<StateEditor storage={storage} now={NOW} />);
    await openTab(user, "プリセット");
    await user.click(screen.getByRole("button", { name: /Step 12 B discovered/ }));
    await openTab(user, "状態");
    expect(document.querySelector("[data-research-entries]")!.getAttribute("data-research-entries")).toBe("2");
    await openTab(user, "適用");
    expect(document.querySelector('[data-diff-id="dex"]')).toHaveTextContent(`Dex: 0 → ${buildPreset("step12-abc-undiscovered").dex.length + 1}`);
    expect(storage.writes).toEqual([]);
  });
});

describe("ingredients: search, OWNED, stock, acquisition order", () => {
  it("searches by name, toggles OWNED, edits stock, and reorders with ↑↓ (draft only)", async () => {
    const storage = spyStorage();
    const user = userEvent.setup();
    render(<StateEditor storage={storage} now={NOW} />);
    await openTab(user, "材料");
    const [a, b] = finite;
    const nameA = ingredientName(catalog, a);
    await user.type(screen.getByRole("searchbox", { name: /材料を検索/ }), nameA);
    const rowA = document.querySelector(`[data-ingredient-id="${a}"]`) as HTMLElement;
    expect(rowA).not.toBeNull();
    expect(document.querySelector(`[data-ingredient-id="${b}"]`)).toBeNull();
    await user.click(within(rowA).getByRole("switch", { name: `${nameA} OWNED` }));
    expect(within(rowA).getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(within(rowA).getByLabelText(`${nameA} の在庫`)).toHaveValue("10");
    await user.click(within(rowA).getByRole("button", { name: `${nameA} の在庫を 1 減らす` }));
    expect(within(rowA).getByLabelText(`${nameA} の在庫`)).toHaveValue("9");
    const field = within(rowA).getByLabelText(`${nameA} の在庫`);
    await user.clear(field);
    await user.type(field, "42");
    expect(field).toHaveValue("42");
    await user.clear(field);
    await user.type(field, "x");
    expect(field).toHaveAttribute("aria-invalid", "true");
    await user.tab();
    expect(field).toHaveValue("42"); // an invalid text is not committed; blur restores the committed value

    // a second material, then ↑ moves it before the first
    await user.clear(screen.getByRole("searchbox", { name: /材料を検索/ }));
    const nameB = ingredientName(catalog, b);
    await user.click(within(document.querySelector(`[data-ingredient-id="${b}"]`) as HTMLElement).getByRole("switch", { name: `${nameB} OWNED` }));
    const badge = (id: string) => within(document.querySelector(`[data-ingredient-id="${id}"]`) as HTMLElement).getByLabelText(/取得順 \d+ 番目/).getAttribute("aria-label");
    expect([badge(a), badge(b)]).toEqual(["取得順 1 番目", "取得順 2 番目"]);
    await user.click(within(document.querySelector(`[data-ingredient-id="${b}"]`) as HTMLElement).getByRole("button", { name: `${nameB} を取得順で 1 つ前へ` }));
    expect([badge(a), badge(b)]).toEqual(["取得順 2 番目", "取得順 1 番目"]);
    expect(within(document.querySelector(`[data-ingredient-id="${b}"]`) as HTMLElement).getByRole("button", { name: `${nameB} を取得順で 1 つ前へ` })).toBeDisabled();
    expect(storage.writes).toEqual([]);

    // the OWNED filter and the starters (fixed: no switch)
    await user.click(screen.getByRole("button", { name: "OWNED" }));
    const starterRow = document.querySelector(`[data-ingredient-id="${catalog.starterIds[0]}"]`) as HTMLElement;
    expect(within(starterRow).queryByRole("switch")).toBeNull();
    expect(starterRow).toHaveTextContent("starter 固定");
  });
});

describe("Pitz and Hint", () => {
  it("commits a valid Pitz, ignores an invalid one, and the Hint reset clears the draft's hints", async () => {
    const storage = spyStorage({ [KEY]: FUTURE_RAW });
    const user = userEvent.setup();
    render(<StateEditor storage={storage} now={NOW} />);
    await openTab(user, "Pitz・Hint");
    const pitz = screen.getByLabelText("Pitz 残高");
    expect(pitz).toHaveValue("5");
    await user.clear(pitz);
    await user.type(pitz, "300");
    await openTab(user, "状態");
    expect(screen.getByText("Pitz: 300")).toBeInTheDocument();
    await openTab(user, "Pitz・Hint");
    expect(screen.getByText(/facts 1 レシピ/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Hint を初期化/ }));
    expect(screen.getByText(/facts 0 レシピ（0 facts）／ 購入履歴 0 レシピ/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hint を初期化/ })).toBeDisabled();
    await openTab(user, "適用");
    expect(diffIds()).toEqual(expect.arrayContaining(["pitz", "hint-facts", "hint-purchases"]));
    expect(storage.writes).toEqual([]);
  });
});

describe("review and the explicit apply", () => {
  it("shows the diff and the order warning; apply needs the confirmation; then writes, verifies, backs up, and the editor reloads it", async () => {
    const storage = spyStorage({ [KEY]: FUTURE_RAW });
    const user = userEvent.setup();
    const { unmount } = render(<StateEditor storage={storage} now={NOW} />);
    await openTab(user, "プリセット");
    await user.click(screen.getByRole("button", { name: /Step 12 A\/B\/C undiscovered/ }));
    await openTab(user, "適用");
    expect(screen.getByRole("heading", { name: /適用前の確認/ })).toBeInTheDocument();
    expect(diffIds()).toEqual(expect.arrayContaining(["pitz", "owned-added", "dex", "last-acquired"]));
    expect(screen.getByText(/取得順を変えると/)).toBeInTheDocument();
    for (const box of screen.getAllByRole("checkbox").slice(0, 3)) expect(box).toBeChecked(); // OD-3: everything is kept by default
    const apply = screen.getByRole("button", { name: "適用する" });
    expect(apply).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /変更内容と backup を確認/ }));
    expect(apply).toBeEnabled();
    expect(storage.writes).toEqual([]);
    await user.click(apply);

    expect(screen.getByRole("status")).toHaveTextContent("適用しました（本物の loader で検証済み）");
    expect(screen.getByRole("link", { name: "ゲームを開く" })).toBeInTheDocument();
    // backups were written BEFORE the save
    const firstSave = storage.writes.indexOf(`set:${KEY}`);
    expect(storage.writes.indexOf(`set:${backupKey("original")}`)).toBeGreaterThanOrEqual(0);
    expect(storage.writes.indexOf(`set:${backupKey("original")}`)).toBeLessThan(firstSave);
    expect(storage.writes.indexOf(`set:${backupKey("previous")}`)).toBeLessThan(firstSave);
    const stored = JSON.parse(storage.inner.getItem(KEY)!) as Record<string, unknown>;
    expect(stored.futureTopLevel).toEqual({ a: [1] });
    expect(stored.missionBest).toEqual({ "lunch-rush": 700 });
    expect(stored.dinnerMissionRecords).toEqual({ d: { x: 1 } });
    expect(stored.ownedIngredientIds).toContain("future-ingredient");
    expect(editableFromSave(loadSave(storage))).toEqual(buildPreset("step12-abc-undiscovered"));

    // after a reload (a fresh mount) the editor shows what is stored, with no pending change
    unmount();
    render(<StateEditor storage={storage} now={NOW} />);
    expect(screen.getByText(/変更: 0 件/)).toBeInTheDocument();
    expect(document.querySelector("[data-research-entries]")!.getAttribute("data-research-entries")).toBe("3");
  });

  it("with no change there is nothing to apply", async () => {
    const user = userEvent.setup();
    render(<StateEditor storage={spyStorage()} now={NOW} />);
    await openTab(user, "適用");
    expect(screen.getByText(/変更はありません/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "適用する" })).toBeDisabled();
  });

  it("turning a preservation off reaches the stored save", async () => {
    const storage = spyStorage({ [KEY]: FUTURE_RAW });
    const user = userEvent.setup();
    render(<StateEditor storage={storage} now={NOW} />);
    await openTab(user, "プリセット");
    await user.click(screen.getByRole("button", { name: /All Recipes/ }));
    await openTab(user, "適用");
    await user.click(screen.getByRole("checkbox", { name: /missionBest/ }));
    await user.click(screen.getByRole("checkbox", { name: /未知のキー/ }));
    await user.click(screen.getByRole("checkbox", { name: /変更内容と backup を確認/ }));
    await user.click(screen.getByRole("button", { name: "適用する" }));
    const stored = JSON.parse(storage.inner.getItem(KEY)!) as Record<string, unknown>;
    expect(stored.missionBest).toEqual({});
    expect(stored).not.toHaveProperty("futureTopLevel");
    expect(stored.dinnerMissionRecords).toEqual({ d: { x: 1 } });
  });

  it("a backup that cannot be written means nothing is applied, and the error says so", async () => {
    const storage = spyStorage({ [KEY]: FUTURE_RAW }, (k) => k.includes(".dev-backup-v1."));
    const user = userEvent.setup();
    render(<StateEditor storage={storage} now={NOW} />);
    await openTab(user, "プリセット");
    await user.click(screen.getByRole("button", { name: /All Recipes/ }));
    await openTab(user, "適用");
    await user.click(screen.getByRole("checkbox", { name: /変更内容と backup を確認/ }));
    await user.click(screen.getByRole("button", { name: "適用する" }));
    expect(screen.getByRole("status")).toHaveTextContent("backup を作れなかったため、何も適用していません");
    expect(storage.inner.getItem(KEY)).toBe(FUTURE_RAW);
    expect(storage.writes).toEqual([]);
  });

  it("a corrupt or unknown-schema save needs its own acknowledgement; its raw text is backed up and restorable", async () => {
    for (const raw of ["{broken", JSON.stringify({ schemaVersion: 9, dex: [] })]) {
      cleanup();
      const storage = spyStorage({ [KEY]: raw });
      const user = userEvent.setup();
      render(<StateEditor storage={storage} now={NOW} />);
      await openTab(user, "プリセット");
      await user.click(screen.getByRole("button", { name: /All Recipes/ }));
      await openTab(user, "適用");
      expect(screen.getAllByText(/現在の save は/).length).toBeGreaterThan(0);
      await user.click(screen.getByRole("checkbox", { name: /変更内容と backup を確認/ }));
      expect(screen.getByRole("button", { name: "適用する" })).toBeDisabled();
      await user.click(screen.getByRole("checkbox", { name: /読めない save を上書きする/ }));
      await user.click(screen.getByRole("button", { name: "適用する" }));
      expect(screen.getByRole("status")).toHaveTextContent("適用しました");
      expect(storage.inner.getItem(KEY)).not.toBe(raw);
      await openTab(user, "バックアップ");
      await user.click(within(document.querySelector('[data-backup-slot="original"]') as HTMLElement).getByRole("button", { name: /この backup に戻す/ }));
      await user.click(screen.getByRole("button", { name: "復元する" }));
      expect(storage.inner.getItem(KEY)).toBe(raw);
    }
  });
});

describe("an unreadable save can be cleared to a fresh one through the editor (Codex P2)", () => {
  it("Fresh Start has an empty diff over a corrupt save, yet Apply works after the acknowledgement; the raw text stays restorable", async () => {
    for (const raw of ["{broken", JSON.stringify({ schemaVersion: 9, dex: [] })]) {
      cleanup();
      const storage = spyStorage({ [KEY]: raw });
      const user = userEvent.setup();
      render(<StateEditor storage={storage} now={NOW} />);
      await openTab(user, "プリセット");
      await user.click(screen.getByRole("button", { name: /Fresh Start/ }));
      await openTab(user, "適用");
      expect(diffIds()).toEqual([]);
      expect(screen.getByRole("checkbox", { name: /変更内容と backup を確認/ })).toBeEnabled();
      await user.click(screen.getByRole("checkbox", { name: /変更内容と backup を確認/ }));
      expect(screen.getByRole("button", { name: "適用する" })).toBeDisabled(); // still needs the acknowledgement
      await user.click(screen.getByRole("checkbox", { name: /読めない save を上書きする/ }));
      await user.click(screen.getByRole("button", { name: "適用する" }));
      expect(screen.getByRole("status")).toHaveTextContent("適用しました");
      expect(storage.inner.getItem(KEY)).toBeNull(); // a brand-new save has no key
      expect(storage.inner.getItem(backupKey("original"))).not.toBeNull();
      await openTab(user, "バックアップ");
      await user.click(within(document.querySelector('[data-backup-slot="original"]') as HTMLElement).getByRole("button", { name: /この backup に戻す/ }));
      await user.click(screen.getByRole("button", { name: "復元する" }));
      expect(storage.inner.getItem(KEY)).toBe(raw);
    }
  });

  it("a readable save with no change still has nothing to apply", async () => {
    const user = userEvent.setup();
    render(<StateEditor storage={spyStorage({ [KEY]: FUTURE_RAW })} now={NOW} />);
    await openTab(user, "適用");
    expect(screen.getByRole("checkbox", { name: /変更内容と backup を確認/ })).toBeDisabled();
  });
});

describe("backup / restore", () => {
  it("restore asks twice, puts the raw text back byte for byte, and the editor shows the restored save", async () => {
    const storage = spyStorage({ [KEY]: FUTURE_RAW });
    const user = userEvent.setup();
    render(<StateEditor storage={storage} now={NOW} />);
    await openTab(user, "プリセット");
    await user.click(screen.getByRole("button", { name: /Everything Unlocked/ }));
    await openTab(user, "適用");
    await user.click(screen.getByRole("checkbox", { name: /変更内容と backup を確認/ }));
    await user.click(screen.getByRole("button", { name: "適用する" }));
    expect(storage.inner.getItem(KEY)).not.toBe(FUTURE_RAW);

    await openTab(user, "バックアップ");
    const original = document.querySelector('[data-backup-slot="original"]') as HTMLElement;
    expect(original).toHaveTextContent("save あり");
    await user.click(within(original).getByRole("button", { name: /この backup に戻す/ }));
    expect(storage.inner.getItem(KEY)).not.toBe(FUTURE_RAW); // nothing yet: it asks first
    await user.click(within(original).getByRole("button", { name: "やめる" }));
    expect(storage.inner.getItem(KEY)).not.toBe(FUTURE_RAW);
    await user.click(within(original).getByRole("button", { name: /この backup に戻す/ }));
    await user.click(within(original).getByRole("button", { name: "復元する" }));
    expect(storage.inner.getItem(KEY)).toBe(FUTURE_RAW);
    expect(screen.getAllByRole("status").some((el) => /復元しました/.test(el.textContent ?? ""))).toBe(true);
    expect(document.querySelector('[data-backup-slot="original"]')).toHaveTextContent("なし"); // the original slot is spent
    await openTab(user, "状態");
    expect(screen.getByText(/変更: 0 件/)).toBeInTheDocument();
    expect(screen.getByText(/Pitz: 5$/)).toBeInTheDocument();
  });

  it("discarding the original backup asks first", async () => {
    const storage = spyStorage({ [KEY]: FUTURE_RAW });
    const user = userEvent.setup();
    render(<StateEditor storage={storage} now={NOW} />);
    await openTab(user, "プリセット");
    await user.click(screen.getByRole("button", { name: /All Ingredients/ }));
    await openTab(user, "適用");
    await user.click(screen.getByRole("checkbox", { name: /変更内容と backup を確認/ }));
    await user.click(screen.getByRole("button", { name: "適用する" }));
    await openTab(user, "バックアップ");
    const original = document.querySelector('[data-backup-slot="original"]') as HTMLElement;
    await user.click(within(original).getByRole("button", { name: /original を破棄/ }));
    expect(storage.inner.getItem(backupKey("original"))).not.toBeNull();
    await user.click(within(original).getByRole("button", { name: "破棄する" }));
    expect(storage.inner.getItem(backupKey("original"))).toBeNull();
    expect(storage.inner.getItem(backupKey("previous"))).not.toBeNull();
  });

  it("restoring a missing / broken backup reports it and writes nothing to the save", async () => {
    const storage = spyStorage({ [KEY]: FUTURE_RAW, [backupKey("previous")]: "{}" });
    const user = userEvent.setup();
    render(<StateEditor storage={storage} now={NOW} />);
    await openTab(user, "バックアップ");
    expect(document.querySelector('[data-backup-slot="previous"]')).toHaveTextContent("読めない");
    expect(within(document.querySelector('[data-backup-slot="previous"]') as HTMLElement).queryByRole("button", { name: /この backup に戻す/ })).toBeNull();
    expect(storage.writes).toEqual([]);
    vi.restoreAllMocks();
  });
});
