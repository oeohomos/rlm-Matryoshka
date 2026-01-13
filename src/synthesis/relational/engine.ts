/**
 * Barliman-Style Synthesis Engine
 *
 * Implements the core synthesis loop:
 * 1. Accept constraints (input/output examples) from LLM
 * 2. Use miniKanren to search for programs satisfying constraints
 * 3. Test candidates on actual data
 * 4. Return successful programs or request more constraints
 *
 * This is the INNER loop of the Barliman architecture.
 */

import { synthesizeProgram, testProgram, exprToCode, type Expr, type Example } from "./interpreter.js";

/**
 * Constraint types that LLM can provide
 */
export interface ExtractionConstraint {
  type: "extraction";
  description: string;
  examples: Example[];
  pattern?: string; // Optional regex hint
}

export interface TransformConstraint {
  type: "transform";
  description: string;
  examples: Example[];
}

export interface FilterConstraint {
  type: "filter";
  description: string;
  examples: Array<{ input: unknown; shouldMatch: boolean }>;
}

export type Constraint = ExtractionConstraint | TransformConstraint | FilterConstraint;

/**
 * Synthesis result
 */
export interface SynthesisEngineResult {
  success: boolean;
  program?: Expr;
  code?: string;
  testedExamples: number;
  passedExamples: number;
  failedExamples?: Example[];
  error?: string;
  candidatesExplored: number;
  synthesisTimeMs: number;
}

/**
 * Configuration for synthesis
 */
export interface SynthesisConfig {
  maxCandidates: number;
  timeoutMs: number;
  minExamples: number;
}

const DEFAULT_CONFIG: SynthesisConfig = {
  maxCandidates: 100,
  timeoutMs: 5000,
  minExamples: 2,
};

/**
 * The Synthesis Engine
 *
 * Coordinates the miniKanren-based program search with
 * testing and refinement.
 */
export class SynthesisEngine {
  private config: SynthesisConfig;
  private candidateCache: Map<string, Expr[]> = new Map();

  constructor(config: Partial<SynthesisConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main synthesis function
   *
   * This is the INNER LOOP of Barliman:
   * 1. Parse constraints from LLM
   * 2. Generate candidate programs with miniKanren
   * 3. Test candidates against examples
   * 4. Return best program or failure
   */
  synthesize(constraint: Constraint): SynthesisEngineResult {
    const startTime = Date.now();

    // Validate we have enough examples
    if (constraint.examples.length < this.config.minExamples) {
      return {
        success: false,
        error: `Need at least ${this.config.minExamples} examples, got ${constraint.examples.length}`,
        testedExamples: 0,
        passedExamples: 0,
        candidatesExplored: 0,
        synthesisTimeMs: Date.now() - startTime,
      };
    }

    try {
      // First, try template-based synthesis (faster)
      const templateResult = this.synthesizeFromTemplates(constraint);
      if (templateResult.success) {
        return {
          ...templateResult,
          synthesisTimeMs: Date.now() - startTime,
        };
      }

      // Fall back to miniKanren-based synthesis
      const mkResult = this.synthesizeWithMiniKanren(constraint);
      return {
        ...mkResult,
        synthesisTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        testedExamples: constraint.examples.length,
        passedExamples: 0,
        candidatesExplored: 0,
        synthesisTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Template-based synthesis
   *
   * Uses pre-defined templates for common patterns.
   * This is faster than full miniKanren search for common cases.
   */
  private synthesizeFromTemplates(constraint: Constraint): SynthesisEngineResult {
    const templates = this.getTemplatesForConstraint(constraint);
    let candidatesExplored = 0;

    for (const template of templates) {
      candidatesExplored++;

      // Try to instantiate the template with the examples
      const result = this.instantiateTemplate(template, constraint.examples);

      if (result) {
        // Test on all examples
        const { passed, failed } = this.testOnExamples(result, constraint.examples);

        if (failed.length === 0) {
          return {
            success: true,
            program: result,
            code: exprToCode(result),
            testedExamples: constraint.examples.length,
            passedExamples: passed.length,
            candidatesExplored,
            synthesisTimeMs: 0,
          };
        }
      }
    }

    return {
      success: false,
      testedExamples: 0,
      passedExamples: 0,
      candidatesExplored,
      synthesisTimeMs: 0,
    };
  }

  /**
   * miniKanren-based synthesis
   *
   * Uses the relational interpreter to search for programs.
   */
  private synthesizeWithMiniKanren(constraint: Constraint): Omit<SynthesisEngineResult, "synthesisTimeMs"> {
    // Use miniKanren to find candidate programs
    const candidates = synthesizeProgram(constraint.examples, this.config.maxCandidates);

    let candidatesExplored = 0;
    for (const candidate of candidates) {
      candidatesExplored++;

      // Test the candidate on all examples
      if (testProgram(candidate, constraint.examples)) {
        return {
          success: true,
          program: candidate,
          code: exprToCode(candidate),
          testedExamples: constraint.examples.length,
          passedExamples: constraint.examples.length,
          candidatesExplored,
        };
      }
    }

    return {
      success: false,
      error: `No program found satisfying all ${constraint.examples.length} examples`,
      testedExamples: constraint.examples.length,
      passedExamples: 0,
      candidatesExplored,
    };
  }

  /**
   * Get templates appropriate for the constraint type
   */
  private getTemplatesForConstraint(constraint: Constraint): ExprTemplate[] {
    switch (constraint.type) {
      case "extraction":
        return [
          // Currency extraction: $1,000 -> 1000
          {
            template: (pattern: string) => ({
              type: "parseFloat" as const,
              str: {
                type: "replace" as const,
                str: {
                  type: "match" as const,
                  str: { type: "var" as const, name: "input" },
                  pattern: pattern,
                  group: 1,
                },
                pattern: ",",
                replacement: "",
              },
            }),
            patterns: [
              "\\$([\\d,]+)",
              "\\$([\\d,\\.]+)",
              "([\\d,]+)",
            ],
          },
          // Direct regex match
          {
            template: (pattern: string) => ({
              type: "match" as const,
              str: { type: "var" as const, name: "input" },
              pattern: pattern,
              group: 0,
            }),
            patterns: [".*"],
          },
        ];

      case "transform":
        return [
          // String replace
          {
            template: (pattern: string, replacement: string) => ({
              type: "replace" as const,
              str: { type: "var" as const, name: "input" },
              pattern: pattern,
              replacement: replacement,
            }),
            patterns: [],
          },
          // parseInt
          {
            template: () => ({
              type: "parseInt" as const,
              str: { type: "var" as const, name: "input" },
            }),
            patterns: [],
          },
        ];

      default:
        return [];
    }
  }

  /**
   * Try to instantiate a template with examples
   */
  private instantiateTemplate(
    template: ExprTemplate,
    examples: Example[]
  ): Expr | null {
    // Try each pattern variant
    for (const pattern of template.patterns) {
      try {
        const expr = template.template(pattern);

        // Test on first example
        if (examples.length > 0) {
          const { input, output } = examples[0];
          const code = exprToCode(expr);
          const fn = new Function("input", `return ${code}`);
          const result = fn(input);

          if (result === output) {
            return expr;
          }
        }
      } catch {
        // Pattern doesn't work, try next
      }
    }

    return null;
  }

  /**
   * Test a program on examples
   */
  private testOnExamples(
    program: Expr,
    examples: Example[]
  ): { passed: Example[]; failed: Example[] } {
    const passed: Example[] = [];
    const failed: Example[] = [];

    try {
      const code = exprToCode(program);
      const fn = new Function("input", `return ${code}`);

      for (const example of examples) {
        try {
          const result = fn(example.input);
          if (result === example.output) {
            passed.push(example);
          } else {
            failed.push(example);
          }
        } catch {
          failed.push(example);
        }
      }
    } catch {
      // All failed
      return { passed: [], failed: examples };
    }

    return { passed, failed };
  }

  /**
   * Refine synthesis with additional constraints
   *
   * This is called when initial synthesis fails or produces wrong results.
   * Part of the outer loop interaction with LLM.
   */
  refine(
    previousResult: SynthesisEngineResult,
    additionalExamples: Example[]
  ): SynthesisEngineResult {
    // Merge examples
    const allExamples = [
      ...(previousResult.failedExamples || []),
      ...additionalExamples,
    ];

    // Create new constraint with all examples
    const constraint: ExtractionConstraint = {
      type: "extraction",
      description: "Refined extraction",
      examples: allExamples,
    };

    return this.synthesize(constraint);
  }
}

/**
 * Template definition
 */
interface ExprTemplate {
  template: (...args: string[]) => Expr;
  patterns: string[];
}

/**
 * Analyze input/output examples to infer the type of extraction needed
 */
export function analyzeExamples(examples: Example[]): {
  inputType: "string" | "number" | "unknown";
  outputType: "string" | "number" | "unknown";
  patterns: string[];
} {
  if (examples.length === 0) {
    return { inputType: "unknown", outputType: "unknown", patterns: [] };
  }

  const inputType = typeof examples[0].input === "string" ? "string" :
    typeof examples[0].input === "number" ? "number" : "unknown";

  const outputType = typeof examples[0].output === "string" ? "string" :
    typeof examples[0].output === "number" ? "number" : "unknown";

  // Detect common patterns in string inputs
  const patterns: string[] = [];
  if (inputType === "string") {
    const inputs = examples.map(e => e.input as string);

    // Check for currency
    if (inputs.every(s => /\$[\d,]+/.test(s))) {
      patterns.push("\\$([\\d,]+)");
    }

    // Check for percentage
    if (inputs.every(s => /\d+%/.test(s))) {
      patterns.push("(\\d+)%");
    }

    // Check for key:value
    if (inputs.every(s => /\w+:\s*.+/.test(s))) {
      patterns.push("\\w+:\\s*(.+)");
    }
  }

  return { inputType, outputType, patterns };
}

/**
 * Create a synthesis engine with default configuration
 */
export function createSynthesisEngine(
  config?: Partial<SynthesisConfig>
): SynthesisEngine {
  return new SynthesisEngine(config);
}
