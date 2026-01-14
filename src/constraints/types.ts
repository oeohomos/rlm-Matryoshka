/**
 * Constraint Types for Output Verification
 *
 * Defines the schema for specifying expected output constraints.
 * These constraints enable Barliman-style constraint-first synthesis
 * where the LLM must produce results that satisfy formal requirements.
 */

/**
 * Base constraint for output values.
 * Supports JSON Schema-like type specifications.
 */
export interface OutputConstraint {
  /** Expected type of the output */
  type: "number" | "string" | "boolean" | "array" | "object" | "null";

  // Numeric constraints
  /** Minimum value (inclusive) */
  min?: number;
  /** Maximum value (inclusive) */
  max?: number;
  /** Must be an integer (no decimal) */
  integer?: boolean;

  // String constraints
  /** Regex pattern the string must match */
  pattern?: string;
  /** Minimum string length */
  minLength?: number;
  /** Maximum string length */
  maxLength?: number;

  // Array constraints
  /** Constraint for array items */
  items?: OutputConstraint;
  /** Minimum number of items */
  minItems?: number;
  /** Maximum number of items */
  maxItems?: number;

  // Object constraints
  /** Constraints for object properties */
  properties?: Record<string, OutputConstraint>;
  /** Required property names */
  required?: string[];
}

/**
 * Full synthesis constraint specification.
 * Combines output constraints with optional examples and invariants.
 */
export interface SynthesisConstraint {
  /** The output constraint specification */
  output: OutputConstraint;

  /** Example input/output pairs for verification */
  examples?: Array<{
    input: string;
    output: unknown;
  }>;

  /** Invariant expressions that must hold (e.g., "result > 0") */
  invariants?: string[];
}

/**
 * Result of constraint verification.
 */
export interface VerificationResult {
  /** Whether all constraints were satisfied */
  valid: boolean;

  /** List of constraint violations */
  errors: string[];

  /** Warnings (non-fatal issues) */
  warnings?: string[];
}

/**
 * Parse a simple type string into an OutputConstraint.
 *
 * @param typeStr - Simple type like "number", "string", "array"
 * @returns OutputConstraint with just the type set
 */
export function parseSimpleType(typeStr: string): OutputConstraint | null {
  const validTypes = ["number", "string", "boolean", "array", "object", "null"];
  const normalized = typeStr.toLowerCase().trim();

  if (validTypes.includes(normalized)) {
    return { type: normalized as OutputConstraint["type"] };
  }

  return null;
}

/**
 * Parse a JSON constraint specification.
 *
 * @param json - JSON string representing constraints
 * @returns SynthesisConstraint or null if invalid
 */
export function parseConstraintJSON(json: string): SynthesisConstraint | null {
  try {
    const parsed = JSON.parse(json);

    // If it's just a type constraint, wrap it
    if (parsed.type && !parsed.output) {
      return { output: parsed as OutputConstraint };
    }

    // If it has an output field, use as-is
    if (parsed.output) {
      return parsed as SynthesisConstraint;
    }

    return null;
  } catch {
    return null;
  }
}
