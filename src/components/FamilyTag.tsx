import { ingredientFamilyDisplay } from "../data/familyDisplay";

/**
 * The family line on a 具材 card (Pantry tile / Inventory card / Shop item): the class symbol + the family label,
 * both from the `familyDisplay` authority (the same strings Hint 5.0 shows). Always shown for a topping that has a
 * family, whatever filter is active (OD-3). A sauce, a cheese, an unclassified topping or an unknown id renders
 * nothing (`ingredientFamilyDisplay` is null). The symbol is decorative (`aria-hidden`); the label is read.
 */
export function FamilyTag({ ingredientId, className }: { ingredientId: string; className?: string }) {
  const family = ingredientFamilyDisplay(ingredientId);
  if (!family) return null;
  return (
    <span className={`family-tag${className ? ` ${className}` : ""}`} data-family={family.id}>
      <span className="family-tag__symbol" aria-hidden="true">
        {family.symbol}
      </span>
      <span className="family-tag__label">{family.labelJa}</span>
    </span>
  );
}
