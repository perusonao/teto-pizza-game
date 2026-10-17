import { describe, expect, it } from "vitest";
import { bakeProgressForPiece, partitionPiecesByBakeClass, pieceBakeClass } from "./pieceBakeClass";
import { finishedPizza, piece } from "./testSupport/finishFixture";

describe("pieceBakeClass (FINISH D2-0)", () => {
  it("a piece with no stage or stage 'pre' is PRE_BAKE; only stage 'post' is POST_BAKE", () => {
    expect(pieceBakeClass({})).toBe("PRE_BAKE");
    expect(pieceBakeClass({ stage: "pre" })).toBe("PRE_BAKE");
    expect(pieceBakeClass({ stage: "post" })).toBe("POST_BAKE");
  });

  it("partitions by class and keeps placement order on both sides", () => {
    const a = piece("mozzarella");
    const b = piece("parsley", "post");
    const c = piece("chicken", "pre");
    const d = piece("parsley", "post");
    const { preBake, postBake } = partitionPiecesByBakeClass([a, b, c, d]);
    expect(preBake).toEqual([a, c]);
    expect(postBake).toEqual([b, d]);
  });

  it("an all-pre-bake list (every shipped pizza) partitions to itself with no post pieces", () => {
    const pieces = [piece("mozzarella"), piece("chicken")];
    const { preBake, postBake } = partitionPiecesByBakeClass(pieces);
    expect(preBake).toEqual(pieces);
    expect(postBake).toEqual([]);
  });

  it("does not mutate its input", () => {
    const pieces = finishedPizza(2).toppings;
    const copy = [...pieces];
    partitionPiecesByBakeClass(pieces);
    expect(pieces).toEqual(copy);
  });
});

describe("bakeProgressForPiece (FINISH D2-0)", () => {
  it("a pre-bake piece takes the pizza's bake progress unchanged, including null", () => {
    for (const progress of [null, 0, 40, 70, 100]) {
      expect(bakeProgressForPiece(piece("mozzarella"), progress)).toBe(progress);
      expect(bakeProgressForPiece(piece("mozzarella", "pre"), progress)).toBe(progress);
    }
  });

  it("a post-bake piece is never tinted by the bake", () => {
    for (const progress of [null, 0, 40, 70, 100]) expect(bakeProgressForPiece(piece("parsley", "post"), progress)).toBeNull();
  });
});
