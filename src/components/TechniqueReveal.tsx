import { TECHNIQUES, type TechniqueId } from "../data/techniques";

/**
 * Cooking Techniques 1.0 TQ-1D: the RESULT's technique stage (SSOT P5: ① Technique, then ② Recipe).
 * It names a technique only because the technique was just discovered from the finished pizza itself;
 * the caller passes the round's just-discovered ids, which are set only by REGISTER_TO_DEX (never from a
 * target) and only in a Free Cooking round. No ★ and no Pitz (OD-TQ-7).
 */
export function TechniqueReveal({ techniqueIds }: { techniqueIds: readonly TechniqueId[] | null }) {
  const techniques = TECHNIQUES.filter((t) => techniqueIds?.includes(t.id));
  if (techniques.length === 0) return null;
  return (
    <div className="technique-reveal" role="status" aria-live="polite" data-technique-reveal="">
      <p className="technique-reveal__stamp">{"\u{1F373}"} 新しい調理法を発見！</p>
      {techniques.map((t) => (
        <p key={t.id} className="technique-reveal__name" data-technique-id={t.id}>
          「{t.nameJa}」
        </p>
      ))}
    </div>
  );
}
