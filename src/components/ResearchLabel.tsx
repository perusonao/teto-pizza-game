import { RESEARCH_UX_COPY } from "./researchUxCopy";

/**
 * Research 2.0 Phase 1: the shared presentation of the stable Research label (`researchEntryLabel`, e.g. 「？？？ピザ B（たまねぎ）」).
 * The text is the label byte for byte -- this only keeps it from breaking inside a word on a narrow card: the letter part and the
 * unlock-ingredient part are each unbreakable, so a long label wraps between them (「？？？ピザ B」 / 「（たまねぎ）」) instead of
 * inside 「たまねぎ」. It adds no text, attribute or id (INV-B7).
 */
export function ResearchLabel({ labelJa }: { labelJa: string }) {
  const at = labelJa.indexOf("（");
  if (at <= 0) return <>{labelJa}</>;
  return (
    <>
      <span className="research-label__part">{labelJa.slice(0, at)}</span>
      <span className="research-label__part">{labelJa.slice(at)}</span>
    </>
  );
}

/** 「🔎 研究中 <label>」: the one context line of the PREPARE card and the Hint sheet, with the label kept unbreakable per part. */
export function ResearchContextLine({ labelJa }: { labelJa: string }) {
  // Same text as `RESEARCH_UX_COPY.contextLine(labelJa)`: the copy owns the prefix, this owns the label's wrapping.
  const prefix = RESEARCH_UX_COPY.contextLine("").trimEnd();
  return (
    <>
      {prefix} <ResearchLabel labelJa={labelJa} />
    </>
  );
}
