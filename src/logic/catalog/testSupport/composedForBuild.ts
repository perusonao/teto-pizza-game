/**
 * R-1: the composed expectation (see ./composedCatalog.ts) for the running build -- Pinsa gate open or closed, read from the one gate module.
 * Historical batch tests import `COMPOSED` instead of pinning a count / step number / floor map that every landing train used to edit.
 */
import { pinsaEnabled } from "../../../data/pinsaGate";
import { composedFor } from "./composedCatalog";

export const COMPOSED = composedFor(pinsaEnabled());
