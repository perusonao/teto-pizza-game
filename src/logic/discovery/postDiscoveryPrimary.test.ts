import { describe, expect, it } from "vitest";
import { POST_DISCOVERY_LABEL_JA, postDiscoveryPrimary } from "./postDiscoveryPrimary";

describe("postDiscoveryPrimary (OD-RX-4)", () => {
  it.each([
    { entries: ["a"], material: false, kind: "RESEARCH_NEXT", direct: "a" },
    { entries: ["a"], material: true, kind: "RESEARCH_NEXT", direct: "a" }, // research outranks the shop
    { entries: ["a", "b"], material: false, kind: "RESEARCH_NEXT", direct: null },
    { entries: ["a", "b", "c"], material: true, kind: "RESEARCH_NEXT", direct: null },
    { entries: [], material: true, kind: "SHOP_NEW_MATERIAL", direct: null },
    { entries: [], material: false, kind: "DEX", direct: null },
  ])("entries=$entries material=$material -> $kind", ({ entries, material, kind, direct }) => {
    const p = postDiscoveryPrimary({ researchableEntryIds: entries, newMaterialAvailable: material });
    expect(p.kind).toBe(kind);
    expect(p.directResearchId).toBe(direct);
    const key = p.kind === "RESEARCH_NEXT" && direct === null ? "RESEARCH_NEXT_CHOOSE" : p.kind;
    expect(p.labelJa).toBe(POST_DISCOVERY_LABEL_JA[key]);
  });

  it("2+ researchable entries read 「次のピザを選んで研究する」; exactly one keeps 「次のピザを研究する」", () => {
    expect(postDiscoveryPrimary({ researchableEntryIds: ["a", "b"], newMaterialAvailable: false }).labelJa).toBe("🔎 次のピザを選んで研究する");
    expect(postDiscoveryPrimary({ researchableEntryIds: ["a"], newMaterialAvailable: false }).labelJa).toBe("🔎 次のピザを研究する");
  });

  it("the labels carry no count, remaining or completion wording", () => {
    for (const label of Object.values(POST_DISCOVERY_LABEL_JA)) {
      expect(label).not.toMatch(/[0-9０-９]|残り|あと|全部|すべて|\/|%|％/);
    }
  });

  it("the result has no count field", () => {
    expect(Object.keys(postDiscoveryPrimary({ researchableEntryIds: ["a", "b"], newMaterialAvailable: false })).sort()).toEqual([
      "directResearchId",
      "kind",
      "labelJa",
    ]);
  });
});
