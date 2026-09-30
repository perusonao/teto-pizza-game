import { describe, expect, it } from "vitest";
import { createEmptyPizza, type PizzaState, type PlacedTopping } from "../../state/pizzaState";
import { matchDiscovery, type DiscoveryTarget } from "./matcher";
import {
  DEFAULT_IDENTITY_DIMENSIONS,
  IDENTITY_DIMENSION_KEYS,
  signatureOfPizza,
  type RuntimeSignature,
} from "./signature";
import {
  ATTEMPT_FINGERPRINT_VERSION,
  attemptFingerprintOfPizza,
  attemptFingerprintOfSignature,
  attemptFingerprintVersion,
  isAttemptFingerprint,
  isSameAttempt,
  parseAttemptFingerprint,
} from "./attemptFingerprint";

function piece(ingredientId: string, i: number): PlacedTopping {
  return { id: `p-${ingredientId}-${i}`, ingredientId, x: 20 + i * 3, y: 30 + i * 2 };
}

function pizzaOf(sauceIds: string[], pieces: string[], bakeResult = 70): PizzaState {
  return { ...createEmptyPizza(), sauceIds, toppings: pieces.map(piece), bakeResult };
}

const fp = (sauces: string[], pieces: string[]) => attemptFingerprintOfPizza(pizzaOf(sauces, pieces));

/** The matcher is the SSOT: two pizzas are the "same combination" iff a catalog target built from
 *  the first one matches the second (ELIGIBLE, default dimensions, no capabilities). */
function matcherSaysSame(a: PizzaState, b: PizzaState): boolean {
  const sa = signatureOfPizza(a);
  const target: DiscoveryTarget = {
    targetId: "oracle",
    items: sa.ingredientSet.value,
    sauceBase: sa.sauceBase.value,
    capabilities: [],
    identityDimensions: DEFAULT_IDENTITY_DIMENSIONS,
    eligibility: { status: "ELIGIBLE" },
  };
  return matchDiscovery(signatureOfPizza(b), [target]).kind === "UNIQUE_MATCH";
}

describe("Attempt Fingerprint v1 — contract", () => {
  it("is versioned, serializable JSON with the documented shape", () => {
    expect(ATTEMPT_FINGERPRINT_VERSION).toBe(1);
    expect(fp(["tomato-sauce"], ["mozzarella", "basil"])).toBe(
      'fp1:[["tomato-sauce"],["basil","mozzarella","tomato-sauce"]]',
    );
  });

  it("same sauce + same set in a different placement order => same fingerprint", () => {
    expect(fp(["tomato-sauce"], ["mozzarella", "basil", "onion"])).toBe(
      fp(["tomato-sauce"], ["onion", "mozzarella", "basil"]),
    );
  });

  it("duplicates follow the matcher contract: presence-only, quantity is not identity", () => {
    const one = fp(["tomato-sauce"], ["mozzarella", "basil"]);
    expect(fp(["tomato-sauce"], ["mozzarella", "mozzarella", "mozzarella", "basil", "basil"])).toBe(one);
    expect(fp(["tomato-sauce", "tomato-sauce"], ["mozzarella", "basil"])).toBe(one);
  });

  it("placement, timing and bake value are not identity", () => {
    const a = pizzaOf(["tomato-sauce"], ["mozzarella", "basil"], 10);
    const b = {
      ...pizzaOf(["tomato-sauce"], ["mozzarella", "basil"], 95),
      toppings: [
        { id: "z1", ingredientId: "basil", x: 88, y: 12 },
        { id: "z2", ingredientId: "mozzarella", x: 5, y: 77 },
      ],
    };
    expect(attemptFingerprintOfPizza(a)).toBe(attemptFingerprintOfPizza(b));
  });

  it("a different ingredient => a different fingerprint", () => {
    expect(fp(["tomato-sauce"], ["mozzarella", "basil"])).not.toBe(fp(["tomato-sauce"], ["mozzarella", "oregano"]));
    expect(fp(["tomato-sauce"], ["mozzarella"])).not.toBe(fp(["tomato-sauce"], ["mozzarella", "basil"]));
  });

  it("a different sauce => a different fingerprint", () => {
    expect(fp(["tomato-sauce"], ["mozzarella"])).not.toBe(fp(["pesto"], ["mozzarella"]));
  });

  it("the same ingredient in a different ROLE is a different attempt (sauce vs piece)", () => {
    // matcher rule: base must be the expected one, not just the same ids
    const asBase = fp(["tomato-sauce"], ["mozzarella"]);
    const asPiece = fp([], ["mozzarella", "tomato-sauce"]);
    expect(asBase).not.toBe(asPiece);
    expect(matcherSaysSame(pizzaOf(["tomato-sauce"], ["mozzarella"]), pizzaOf([], ["mozzarella", "tomato-sauce"]))).toBe(false);
  });

  it("no sauce is its own attempt, distinct from any sauce", () => {
    const none = fp([], ["mozzarella", "basil"]);
    expect(none).toBe('fp1:[[],["basil","mozzarella"]]');
    expect(none).not.toBe(fp(["tomato-sauce"], ["mozzarella", "basil"]));
  });

  it("empty and minimal sets are well defined and distinct", () => {
    expect(attemptFingerprintOfPizza(createEmptyPizza())).toBe("fp1:[[],[]]");
    expect(fp(["pesto"], [])).toBe('fp1:[["pesto"],["pesto"]]');
    expect(fp([], ["basil"])).toBe('fp1:[[],["basil"]]');
    expect(new Set([fp([], []), fp(["pesto"], []), fp([], ["basil"])]).size).toBe(3);
  });

  it("malformed input is normalised exactly like the signature (never throws)", () => {
    const malformed = {
      ...createEmptyPizza(),
      sauceIds: ["tomato-sauce", 42, null] as unknown as string[],
      toppings: [null, { id: "x", ingredientId: "basil", x: Number.NaN, y: 1 }, piece("mozzarella", 0)] as unknown as PlacedTopping[],
    };
    expect(attemptFingerprintOfPizza(malformed)).toBe(fp(["tomato-sauce"], ["mozzarella"]));
  });

  it("ids containing delimiters or JSON syntax cannot collide (injective encoding)", () => {
    const a = fp([], ['a","b']);
    const b = fp([], ["a", "b"]);
    const c = fp([], ["a,b"]);
    expect(new Set([a, b, c]).size).toBe(3);
    for (const f of [a, b, c]) expect(parseAttemptFingerprint(f)).not.toBeNull();
  });

  it("serialization is deterministic: repeated calls and structurally equal inputs give identical strings", () => {
    const p = pizzaOf(["tomato-sauce"], ["basil", "mozzarella"]);
    const first = attemptFingerprintOfPizza(p);
    for (let i = 0; i < 5; i++) expect(attemptFingerprintOfPizza(structuredClone(p))).toBe(first);
    expect(JSON.stringify(parseAttemptFingerprint(first))).toBe(JSON.stringify(parseAttemptFingerprint(first)));
  });

  it("canonicalises even a hand-built signature whose lists are unsorted or duplicated (defensive)", () => {
    const sig = signatureOfPizza(pizzaOf(["tomato-sauce"], ["mozzarella"]));
    const messy: RuntimeSignature = {
      ...sig,
      sauceBase: { status: "OBSERVED", value: ["tomato-sauce", "tomato-sauce"] },
      ingredientSet: { status: "OBSERVED", value: ["tomato-sauce", "mozzarella", "tomato-sauce"] },
    };
    expect(attemptFingerprintOfSignature(messy)).toBe(attemptFingerprintOfSignature(sig));
  });

  it("isSameAttempt is the fingerprint equality, over signatures", () => {
    const a = signatureOfPizza(pizzaOf(["tomato-sauce"], ["mozzarella", "basil"]));
    const b = signatureOfPizza(pizzaOf(["tomato-sauce"], ["basil", "mozzarella", "mozzarella"]));
    const c = signatureOfPizza(pizzaOf(["pesto"], ["basil", "mozzarella"]));
    expect(isSameAttempt(a, b)).toBe(true);
    expect(isSameAttempt(a, c)).toBe(false);
  });
});

describe("Attempt Fingerprint v1 — matcher identity is the SSOT", () => {
  const POOL = ["tomato-sauce", "pesto", "olive-oil", "mozzarella", "gorgonzola", "basil", "oregano", "garlic", "onion", "mushroom", "pepperoni"];
  const SAUCES = ["tomato-sauce", "pesto", "olive-oil"];

  /** Tiny seeded PRNG (mulberry32): property-style tests without a new dependency. */
  function rng(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomPizza(r: () => number): PizzaState {
    const sauces = r() < 0.2 ? [] : [SAUCES[Math.floor(r() * SAUCES.length)]];
    const pieces = Array.from({ length: Math.floor(r() * 7) }, () => POOL[Math.floor(r() * POOL.length)]);
    return pizzaOf(sauces, pieces, Math.floor(r() * 100));
  }

  function shuffled<T>(items: T[], r: () => number): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  it("property: fingerprint equality <=> matcher identity equality (3000 random pairs)", () => {
    const r = rng(20260930);
    let equalPairs = 0;
    for (let i = 0; i < 3000; i++) {
      const a = randomPizza(r);
      // half the pairs are deliberately related so equal fingerprints actually occur
      const b =
        r() < 0.5
          ? { ...a, toppings: shuffled([...a.toppings, ...a.toppings.slice(0, 2).map((t, k) => ({ ...t, id: `dup${k}`, x: t.x + 1 }))], r) }
          : randomPizza(r);
      const same = attemptFingerprintOfPizza(a) === attemptFingerprintOfPizza(b);
      if (same) equalPairs++;
      expect(same).toBe(matcherSaysSame(a, b));
    }
    expect(equalPairs).toBeGreaterThan(1000);
  });

  it("property: shuffling / duplicating pieces never changes the fingerprint; adding or removing a kind always does", () => {
    const r = rng(7);
    for (let i = 0; i < 1000; i++) {
      const p = randomPizza(r);
      const base = attemptFingerprintOfPizza(p);
      expect(attemptFingerprintOfPizza({ ...p, toppings: shuffled(p.toppings, r) })).toBe(base);
      expect(attemptFingerprintOfPizza({ ...p, toppings: [...p.toppings, ...p.toppings.map((t) => ({ ...t, id: `d-${t.id}` }))] })).toBe(base);
      const present = new Set(p.toppings.map((t) => t.ingredientId));
      const absent = POOL.filter((id) => !present.has(id) && !SAUCES.includes(id));
      const extra = absent[Math.floor(r() * absent.length)];
      expect(attemptFingerprintOfPizza({ ...p, toppings: [...p.toppings, piece(extra, 99)] })).not.toBe(base);
      // a piece that duplicates the base sauce id would leave the set unchanged, so pick another
      const kind = p.toppings.map((t) => t.ingredientId).find((id) => !p.sauceIds.includes(id));
      if (kind !== undefined) {
        const without = p.toppings.filter((t) => t.ingredientId !== kind);
        expect(attemptFingerprintOfPizza({ ...p, toppings: without })).not.toBe(base);
      }
    }
  });

  it("property: every generated fingerprint parses back to a canonical, identical string", () => {
    const r = rng(99);
    for (let i = 0; i < 1000; i++) {
      const f = attemptFingerprintOfPizza(randomPizza(r));
      const parts = parseAttemptFingerprint(f);
      expect(parts).not.toBeNull();
      expect(parts!.sauceBase.every((id) => parts!.ingredientSet.includes(id))).toBe(true);
      expect(isAttemptFingerprint(f)).toBe(true);
    }
  });
});

describe("Attempt Fingerprint v1 — versioning and extension", () => {
  it("today no identity dimension is OBSERVED, so the extension is always empty", () => {
    // Canary: if an axis becomes OBSERVED this test fails on purpose so the contract is re-reviewed
    // (the fingerprint would start carrying it in `ext` automatically).
    const sig = signatureOfPizza(pizzaOf(["tomato-sauce"], ["mozzarella"]));
    for (const key of IDENTITY_DIMENSION_KEYS) expect(sig.dimensions[key].status).not.toBe("OBSERVED");
    // FIXED_BY_FLOW axes are compared by the matcher too, so they must hold exactly their defaults
    for (const key of IDENTITY_DIMENSION_KEYS) {
      if (sig.dimensions[key].status === "FIXED_BY_FLOW") expect(sig.dimensions[key].value).toEqual(DEFAULT_IDENTITY_DIMENSIONS[key]);
    }
    expect(parseAttemptFingerprint(attemptFingerprintOfSignature(sig))!.ext).toEqual({});
  });

  function withAxis(sig: RuntimeSignature, key: keyof RuntimeSignature["dimensions"], status: "OBSERVED" | "FIXED_BY_FLOW" | "UNAVAILABLE", value: unknown): RuntimeSignature {
    return { ...sig, dimensions: { ...sig.dimensions, [key]: { status, value } } } as RuntimeSignature;
  }
  const base = () => signatureOfPizza(pizzaOf(["tomato-sauce"], ["mozzarella"]));

  it("a future OBSERVED non-default dimension is added sparsely and distinguishes attempts", () => {
    const plain = attemptFingerprintOfSignature(base());
    const withLate = attemptFingerprintOfSignature(withAxis(base(), "late", "OBSERVED", [["post_bake", ["basil"]]]));
    expect(withLate).not.toBe(plain);
    expect(withLate.startsWith("fp1:")).toBe(true);
    expect(parseAttemptFingerprint(withLate)!.ext).toEqual({ late: [["post_bake", ["basil"]]] });
    // the default-dimension attempt keeps its exact pre-extension string
    expect(plain).toBe('fp1:[["tomato-sauce"],["mozzarella","tomato-sauce"]]');
  });

  it("an OBSERVED axis at its default value adds nothing (old fingerprints stay comparable)", () => {
    const plain = attemptFingerprintOfSignature(base());
    expect(attemptFingerprintOfSignature(withAxis(base(), "cook", "OBSERVED", DEFAULT_IDENTITY_DIMENSIONS.cook))).toBe(plain);
    expect(attemptFingerprintOfSignature(withAxis(base(), "late", "OBSERVED", []))).toBe(plain);
  });

  it("an UNAVAILABLE axis is never identity (the matcher assumes its default), whatever its value", () => {
    const plain = attemptFingerprintOfSignature(base());
    expect(attemptFingerprintOfSignature(withAxis(base(), "shape", "UNAVAILABLE", "square"))).toBe(plain);
    expect(attemptFingerprintOfSignature(withAxis(base(), "zones", "UNAVAILABLE", [["x"]]))).toBe(plain);
  });

  it("a FIXED_BY_FLOW axis is compared by value by the matcher, so a non-default value is identity (Codex P2)", () => {
    const plain = attemptFingerprintOfSignature(base());
    const fry = attemptFingerprintOfSignature(withAxis(base(), "cook", "FIXED_BY_FLOW", "fry"));
    expect(fry).not.toBe(plain);
    expect(parseAttemptFingerprint(fry)!.ext).toEqual({ cook: "fry" });
    // at its default it adds nothing, so every fingerprint made today is unchanged
    expect(attemptFingerprintOfSignature(withAxis(base(), "cook", "FIXED_BY_FLOW", DEFAULT_IDENTITY_DIMENSIONS.cook))).toBe(plain);
    // and it agrees with the matcher: a target built from the default signature does not match it
    const target: DiscoveryTarget = {
      targetId: "t",
      items: base().ingredientSet.value,
      sauceBase: base().sauceBase.value,
      capabilities: [],
      identityDimensions: DEFAULT_IDENTITY_DIMENSIONS,
      eligibility: { status: "ELIGIBLE" },
    };
    expect(matchDiscovery(withAxis(base(), "cook", "FIXED_BY_FLOW", "fry"), [target]).kind).toBe("NO_MATCH");
    expect(matchDiscovery(base(), [target]).kind).toBe("UNIQUE_MATCH");
  });

  it("extension order is fixed (IDENTITY_DIMENSION_KEYS), independent of how the signature was built", () => {
    const s1 = withAxis(withAxis(base(), "shape", "OBSERVED", "square"), "dough", "OBSERVED", "thin");
    const s2 = withAxis(withAxis(base(), "dough", "OBSERVED", "thin"), "shape", "OBSERVED", "square");
    expect(attemptFingerprintOfSignature(s1)).toBe(attemptFingerprintOfSignature(s2));
    expect(Object.keys(parseAttemptFingerprint(attemptFingerprintOfSignature(s1))!.ext)).toEqual(["dough", "shape"]);
  });

  it("version stability: the v1 string of a fixed input is frozen", () => {
    expect(fp(["tomato-sauce"], ["mozzarella", "basil"])).toBe(
      'fp1:[["tomato-sauce"],["basil","mozzarella","tomato-sauce"]]',
    );
    expect(fp([], [])).toBe("fp1:[[],[]]");
  });

  it("an unknown version is reported, never coerced to v1", () => {
    expect(attemptFingerprintVersion("fp1:[[],[]]")).toBe(1);
    expect(attemptFingerprintVersion("fp2:anything")).toBe(2);
    expect(attemptFingerprintVersion("fp0:[[],[]]")).toBeNull();
    expect(attemptFingerprintVersion("nope")).toBeNull();
    expect(attemptFingerprintVersion(42)).toBeNull();
    expect(parseAttemptFingerprint("fp2:[[],[]]")).toBeNull();
    expect(isAttemptFingerprint("fp2:[[],[]]")).toBe(false);
  });

  it("the parser rejects every non-canonical or hostile string", () => {
    const bad: unknown[] = [
      "", "fp1:", "fp1:{}", "fp1:[]", "fp1:[[]]", "fp1:[[],[],[],[]]", "fp1:not json",
      'fp1:[[],["b","a"]]', // unsorted
      'fp1:[[],["a","a"]]', // duplicated
      'fp1:[["s"],["a"]]', // sauce missing from the set
      'fp1:[[],[1]]', // non-string id
      'fp1:[[],["a"],[]]', // ext must be an object
      'fp1:[[],["a"],{}]', // empty ext must be omitted
      'fp1:[[],["a"],{"cook":"bake"}]', // default-valued ext
      'fp1:[[],["a"],{"bogus":1}]', // unknown dimension
      'fp1:[[],["a"],{"__proto__":1}]',
      'fp1:[[],["a"],{"shape":"square","dough":"thin"}]', // wrong ext key order
      ' fp1:[[],[]]', 'fp1:[[],[]] ',
      null, undefined, 7, {}, [],
    ];
    for (const raw of bad) expect(parseAttemptFingerprint(raw), String(raw)).toBeNull();
  });
});

describe("Attempt Fingerprint v1 — attempt identity, not recipe identity", () => {
  it("one fingerprint can belong to several recipe targets; the fingerprint does not resolve that", () => {
    // Two catalog targets with the exact same identity (a Phase-0 collision). The matcher says
    // AMBIGUOUS; the fingerprint of the pizza is still one single string, computed without them.
    const pizza = pizzaOf(["tomato-sauce"], ["mozzarella"]);
    const sig = signatureOfPizza(pizza);
    const mk = (id: string): DiscoveryTarget => ({
      targetId: id,
      items: ["mozzarella", "tomato-sauce"],
      sauceBase: ["tomato-sauce"],
      capabilities: [],
      identityDimensions: DEFAULT_IDENTITY_DIMENSIONS,
      eligibility: { status: "ELIGIBLE" },
    });
    expect(matchDiscovery(sig, [mk("recipe-a"), mk("recipe-b")]).kind).toBe("AMBIGUOUS");
    const f = attemptFingerprintOfSignature(sig);
    expect(f).not.toContain("recipe-a");
    expect(f).not.toContain("recipe-b");
    expect(f).toBe(attemptFingerprintOfSignature(sig));
  });

  it("is not derivable to a recipe: the encoded data is exactly sauceBase + ingredientSet (+ ext)", () => {
    const parts = parseAttemptFingerprint(fp(["tomato-sauce"], ["mozzarella", "basil"]))!;
    expect(Object.keys(parts).sort()).toEqual(["ext", "ingredientSet", "sauceBase", "version"]);
  });
});

describe("Attempt Fingerprint v1 — privacy", () => {
  it("contains only the player's own ingredient ids: a pizza equal to a recipe identity leaks nothing extra", () => {
    const f = fp(["tomato-sauce"], ["mozzarella", "basil"]); // this composition IS Margherita
    expect(f.toLowerCase()).not.toContain("margherita");
    expect(f).not.toMatch(/recipe|dex|hint|near|distance|discover|score|★/i);
    expect(parseAttemptFingerprint(f)!.ingredientSet).toEqual(["basil", "mozzarella", "tomato-sauce"]);
  });

  it("depends on nothing but the signature: no Dex / catalog / discovered state can change it", () => {
    const sig = signatureOfPizza(pizzaOf(["tomato-sauce"], ["mozzarella", "basil"]));
    expect(attemptFingerprintOfSignature.length).toBe(1);
    expect(attemptFingerprintOfSignature(sig)).toBe(attemptFingerprintOfSignature(structuredClone(sig)));
  });
});
