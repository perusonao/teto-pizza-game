import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ChangelogOverlay } from "./ChangelogOverlay";
import { CHANGELOG } from "../data/changelog";
import { HomeScreen } from "../screens/HomeScreen";
import { EMPTY_DEX } from "../state/dex";

afterEach(cleanup);

// PR/Issue numbers, SHAs, phase names, internal terms must never reach the player.
const INTERNAL = /#\d|\bPR\b|\bIssue\b|\bSHA\b|\b[0-9a-f]{7,40}\b|\bS[0-4]\b|\bCI\b|WebKit|matcher|schema|Codex|state|RESEARCHING|PROVISIONAL|DISCOVERABLE/i;

function renderHome(onOpenChangelog?: () => void) {
  const noop = vi.fn();
  render(
    <HomeScreen
      pitzBalance={0}
      dex={EMPTY_DEX}
      ownedIngredientCount={0}
      totalIngredientCount={0}
      onStartFreePlay={noop}
      onStartFreeCook={noop}
      onStartLunchRush={noop}
      onOpenDex={noop}
      onOpenShop={noop}
      onOpenInventory={noop}
      onOpenSettings={noop}
      onOpenRanking={noop}
      onOpenChangelog={onOpenChangelog}
    />,
  );
}

describe("ChangelogOverlay", () => {
  it("shows the Research Recipe entry in player-facing copy", () => {
    render(<ChangelogOverlay onClose={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "レシピ発見アップデート" })).toBeInTheDocument();
    expect(screen.getByText("発見したピザは図鑑に登録されます")).toBeInTheDocument();
  });

  it("closes via 閉じる", async () => {
    const onClose = vi.fn();
    render(<ChangelogOverlay onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders no internal terms (real data)", () => {
    const { container } = render(<ChangelogOverlay onClose={vi.fn()} />);
    expect(container.textContent).not.toMatch(INTERNAL);
    for (const e of CHANGELOG) expect(JSON.stringify(e)).not.toMatch(INTERNAL);
  });

  it("renders multiple entries in the given (newest-first) order; version/date only when present", () => {
    const { container } = render(
      <ChangelogOverlay
        onClose={vi.fn()}
        entries={[
          { version: "1.1", date: "2026年11月1日", title: "新しい更新", changes: ["B"] },
          { title: "古い更新", changes: ["A"] },
        ]}
      />,
    );
    const titles = [...container.querySelectorAll(".changelog-entry__title")].map((n) => n.textContent);
    expect(titles).toEqual(["新しい更新", "古い更新"]);
    const metas = container.querySelectorAll(".changelog-entry__meta");
    expect(metas).toHaveLength(1);
    expect(metas[0]).toHaveTextContent("1.1 ・ 2026年11月1日");
  });

  it("real data has the Research Recipe entry first and does not invent version/date", () => {
    expect(CHANGELOG[0].title).toBe("レシピ発見アップデート");
    expect(CHANGELOG[0].version).toBeUndefined();
    expect(CHANGELOG[0].date).toBeUndefined();
  });
});

describe("HOME 更新情報 entry", () => {
  it("opens the changelog and leaves the primary CTAs and navigation in place", async () => {
    const onOpenChangelog = vi.fn();
    renderHome(onOpenChangelog);
    await userEvent.click(screen.getByRole("button", { name: /更新情報/ }));
    expect(onOpenChangelog).toHaveBeenCalledTimes(1);
    for (const name of [/ピザを作る/, /レシピ発見/, /ランチラッシュ/, /ピザ図鑑/, /ショップ/, /材料/, /ランキング/, "設定"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("renders no entry when not wired", () => {
    renderHome();
    expect(screen.queryByRole("button", { name: /更新情報/ })).toBeNull();
  });
});
