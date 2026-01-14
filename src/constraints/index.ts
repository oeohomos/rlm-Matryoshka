/**
 * Constraints Module
 *
 * Provides constraint specification and verification for
 * Barliman-style constraint-first synthesis.
 */

export type {
  OutputConstraint,
  SynthesisConstraint,
  VerificationResult,
} from "./types.js";

export { parseSimpleType, parseConstraintJSON } from "./types.js";

export { verifyResult, verifyInvariant } from "./verifier.js";
