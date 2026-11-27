/**
 * B案再構成 Phase 3d (Issue #901, shop model only): the research point hint board -- what is known of one recipe, the 「？」 slots,
 * and the items for sale with their price. Rendered by the hint sheet (the session target) and the Dex (every open-stage recipe).
 * `ShopHintStrip` is the cooking screen's compact line: revealed items only, nothing for sale.
 *
 * It never names the recipe: an undeveloped recipe's board sits on its anonymous Dex slot / the hint sheet, like every hint.
 */
import { getIngredient } from "../data/ingredients";
import type { ShopHintBoardView, ShopHintItemKind } from "../logic/progression/shopHints";
import { IngredientGlyph } from "./IngredientGlyph";
import { RESEARCH_POINTS_COPY } from "./ResearchPointsNote";

export const SHOP_HINT_COPY = {
  title: "わかっていること",
  shape: "生地の形",
  method: "調理法",
  sauce: "ソース",
  slots: "チーズ・トッピング",
  unknown: "？",
  shapeRound: "まるい生地",
  shapeSquare: "四角い天板",
  methodPlain: "ふつうに焼く",
  // A special dough is named only by the technique registry (doughPrivacy.test.tsx): the board says only that it is special.
  methodSpecialDough: "特別な生地で焼く",
  late: "後乗せ",
  sauceNone: "なし",
  carriedOver: "手がかり",
  free: "はじめてのピザはヒント無料！",
  complete: "ぜんぶわかった！あとは作ってみよう。",
  short: "研究ポイントが足りません",
  shortMore: "試作すると、研究ポイントがたまります。",
  buy: {
    INGREDIENT: "材料を1つ見る",
    SAUCE: "ソースを見る",
    SHAPE: "生地の形を見る",
    METHOD: "調理法を見る",
    COUNT: "個数の目安を見る",
  } satisfies Record<ShopHintItemKind, string>,
} as const;

const ingredientName = (id: string) => getIngredient(id)?.nameJa ?? "";

function shapeText(board: ShopHintBoardView): string {
  if (board.shape === null) return SHOP_HINT_COPY.unknown;
  return board.shape === "square" ? SHOP_HINT_COPY.shapeSquare : SHOP_HINT_COPY.shapeRound;
}

function methodText(board: ShopHintBoardView): string {
  if (board.method === null) return SHOP_HINT_COPY.unknown;
  const base = board.method.dough === "standard" ? SHOP_HINT_COPY.methodPlain : SHOP_HINT_COPY.methodSpecialDough;
  return board.method.lateCount > 0 ? `${base}＋${SHOP_HINT_COPY.late}（焼いたあとにのせる材料 ${board.method.lateCount}種）` : base;
}

function sauceText(board: ShopHintBoardView): string {
  if (board.sauceIds === null) return SHOP_HINT_COPY.unknown;
  return board.sauceIds.length === 0 ? SHOP_HINT_COPY.sauceNone : board.sauceIds.map(ingredientName).join("＋");
}

/** One cheese / topping slot: the ingredient (or 「？」), its count once known, 後乗せ once known. */
function Slot({ slot }: { slot: ShopHintBoardView["slots"][number] }) {
  const ingredient = slot.ingredientId ? getIngredient(slot.ingredientId) : undefined;
  return (
    <li className={`shop-hint__slot${ingredient ? "" : " shop-hint__slot--unknown"}`} data-shop-hint-slot={ingredient ? "known" : "unknown"}>
      {ingredient ? (
        <>
          <span aria-hidden="true">
            <IngredientGlyph ingredient={ingredient} />
          </span>{" "}
          {ingredient.nameJa}
        </>
      ) : (
        SHOP_HINT_COPY.unknown
      )}
      {slot.count !== null && <span className="shop-hint__count">×{slot.count}</span>}
      {slot.late && <span className="shop-hint__tag">{SHOP_HINT_COPY.late}</span>}
      {slot.carriedOver && <span className="shop-hint__tag shop-hint__tag--carried">{SHOP_HINT_COPY.carriedOver}</span>}
    </li>
  );
}

export function ShopHintBoard({
  board,
  onBuy,
  headingLevel = "h3",
}: {
  board: ShopHintBoardView;
  /** Buy `kind` at the price shown (the reducer's PURCHASE_SHOP_HINT re-checks everything). Absent: a read-only board. */
  onBuy?: (kind: ShopHintItemKind, expectedPrice: number) => void;
  headingLevel?: "h3" | "h4";
}) {
  // A second tap before the new board arrives echoes the old price, which the reducer refuses as stale (the price rises after
  // every purchase), so a double tap never buys twice.
  const Heading = headingLevel;
  return (
    <div className="shop-hint" data-testid="shop-hint-board" data-shop-hint-recipe-stage={board.stage}>
      <Heading className="shop-hint__title">
        {RESEARCH_POINTS_COPY.icon} {SHOP_HINT_COPY.title}
      </Heading>
      <dl className="shop-hint__rows">
        <div className="shop-hint__row" data-shop-hint-row="SHAPE">
          <dt>{SHOP_HINT_COPY.shape}</dt>
          <dd>{shapeText(board)}</dd>
        </div>
        <div className="shop-hint__row" data-shop-hint-row="METHOD">
          <dt>{SHOP_HINT_COPY.method}</dt>
          <dd>{methodText(board)}</dd>
        </div>
        <div className="shop-hint__row" data-shop-hint-row="SAUCE">
          <dt>{SHOP_HINT_COPY.sauce}</dt>
          <dd>{sauceText(board)}</dd>
        </div>
        <div className="shop-hint__row shop-hint__row--slots" data-shop-hint-row="INGREDIENT">
          <dt>
            {SHOP_HINT_COPY.slots}（{board.slots.length}種）
          </dt>
          <dd>
            <ul className="shop-hint__slots">
              {board.slots.map((slot, i) => (
                <Slot key={i} slot={slot} />
              ))}
            </ul>
          </dd>
        </div>
      </dl>
      {board.totalKinds !== null && <p className="shop-hint__total">ソースを入れて、全部で {board.totalKinds} 種類の材料を使う</p>}
      {onBuy &&
        (board.complete ? (
          <p className="shop-hint__done">{SHOP_HINT_COPY.complete}</p>
        ) : (
          <div className="shop-hint__shop">
            <p className="shop-hint__wallet" data-testid="shop-hint-wallet">
              {RESEARCH_POINTS_COPY.icon} {RESEARCH_POINTS_COPY.label} <strong>{board.balance}</strong>
              <span className="shop-hint__price-note">（次のヒント {board.free ? "無料" : `${board.price}点`}）</span>
            </p>
            {board.free && <p className="shop-hint__free">{"✨"} {SHOP_HINT_COPY.free}</p>}
            <div className="shop-hint__buttons">
              {board.forSale.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className="shop-hint__buy"
                  data-shop-hint-buy={kind}
                  disabled={!board.affordable}
                  onClick={() => onBuy(kind, board.price)}
                >
                  {SHOP_HINT_COPY.buy[kind]}
                  <span className="shop-hint__buy-price">{board.free ? "無料" : `${RESEARCH_POINTS_COPY.icon}${board.price}`}</span>
                </button>
              ))}
            </div>
            {!board.affordable && (
              <p className="shop-hint__short" role="status" data-testid="shop-hint-short">
                {SHOP_HINT_COPY.short}（あと {board.price - board.balance}点）。{SHOP_HINT_COPY.shortMore}
              </p>
            )}
          </div>
        ))}
    </div>
  );
}

/** The cooking screen's compact line: only what is revealed (never a 「？」 or anything for sale). */
export function ShopHintStrip({ board }: { board: ShopHintBoardView }) {
  if (!board.anyRevealed) return null;
  const items: string[] = [];
  if (board.shape !== null) items.push(shapeText(board));
  if (board.method !== null) items.push(methodText(board));
  if (board.sauceIds !== null) items.push(`${SHOP_HINT_COPY.sauce}：${sauceText(board)}`);
  for (const slot of board.slots) {
    if (slot.ingredientId === null) continue;
    items.push(`${ingredientName(slot.ingredientId)}${slot.count !== null ? `×${slot.count}` : ""}${slot.late ? `（${SHOP_HINT_COPY.late}）` : ""}`);
  }
  if (board.countRevealed && board.slots.some((s) => s.ingredientId === null)) {
    items.push(`？×${board.slots.filter((s) => s.ingredientId === null).map((s) => s.count).join("・")}`);
  }
  return (
    <div className="shop-hint-strip" data-testid="shop-hint-strip" aria-label={`${SHOP_HINT_COPY.title}：${items.join("、")}`}>
      <span className="shop-hint-strip__icon" aria-hidden="true">
        {RESEARCH_POINTS_COPY.icon}
      </span>
      <ul className="shop-hint-strip__items" aria-hidden="true">
        {items.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>
    </div>
  );
}
