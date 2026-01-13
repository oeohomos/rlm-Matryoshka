/**
 * Barliman-Style Synthesis Coordinator
 *
 * Implements the OUTER LOOP of the Barliman architecture:
 * 1. LLM explores data and understands query
 * 2. LLM provides constraints (examples, patterns)
 * 3. Synthesis engine generates candidate programs
 * 4. Coordinator tests programs on data
 * 5. Results shown to LLM for evaluation/refinement
 *
 * This replaces the old approach where LLM wrote code directly.
 */

import {
  SynthesisEngine,
  createSynthesisEngine,
  type Constraint,
  type ExtractionConstraint,
  type SynthesisEngineResult,
  analyzeExamples,
} from "./engine.js";
import { type Example, exprToCode } from "./interpreter.js";

/**
 * Data exploration result from grep/search
 */
export interface ExplorationResult {
  query: string;
  matches: Array<{
    line: string;
    lineNum: number;
    match: string;
  }>;
}

/**
 * LLM-provided constraint specification
 */
export interface ConstraintSpec {
  description: string;
  examples: Example[];
  patternHint?: string;
}

/**
 * Synthesis session state
 */
interface SynthesisSession {
  explorations: ExplorationResult[];
  constraints: Constraint[];
  synthesizedPrograms: SynthesisEngineResult[];
  currentProgram?: SynthesisEngineResult;
}

/**
 * Coordinator result for feedback to LLM
 */
export interface CoordinatorFeedback {
  type: "need_exploration" | "need_constraints" | "synthesis_success" | "synthesis_failed" | "refinement_needed";
  message: string;
  synthesizedCode?: string;
  testResults?: {
    total: number;
    passed: number;
    failed: number;
    failedExamples?: Example[];
  };
  suggestedNextStep?: string;
}

/**
 * The Synthesis Coordinator
 *
 * Manages the interaction between LLM constraint generation
 * and the miniKanren synthesis engine.
 */
export class BarlimanCoordinator {
  private engine: SynthesisEngine;
  private session: SynthesisSession;
  private verbose: boolean;

  constructor(verbose: boolean = false) {
    this.engine = createSynthesisEngine();
    this.session = {
      explorations: [],
      constraints: [],
      synthesizedPrograms: [],
    };
    this.verbose = verbose;
  }

  /**
   * Process exploration results from LLM's grep/search
   *
   * This is called after the LLM runs grep() and gets results.
   * The coordinator analyzes the results and prepares for synthesis.
   */
  processExploration(result: ExplorationResult): CoordinatorFeedback {
    this.session.explorations.push(result);

    if (this.verbose) {
      console.log(`[Coordinator] Received ${result.matches.length} matches from exploration`);
    }

    // Analyze the matches to detect patterns
    const patterns = this.detectPatterns(result.matches);

    if (patterns.length === 0) {
      return {
        type: "need_exploration",
        message: "No clear patterns detected. Try different search terms.",
        suggestedNextStep: "grep() with more specific keywords",
      };
    }

    // Auto-generate examples from detected patterns
    const examples = this.generateExamplesFromPatterns(result.matches, patterns);

    if (examples.length < 2) {
      return {
        type: "need_constraints",
        message: "Found patterns but need more examples. Please provide input/output pairs.",
        suggestedNextStep: "Provide at least 2 examples of how to extract data",
      };
    }

    // We have enough examples - attempt synthesis
    return this.synthesizeFromExamples(examples, patterns[0]);
  }

  /**
   * Process constraints provided by LLM
   *
   * The LLM provides examples of desired input/output behavior.
   * The coordinator uses these to drive synthesis.
   */
  processConstraints(spec: ConstraintSpec): CoordinatorFeedback {
    if (this.verbose) {
      console.log(`[Coordinator] Received ${spec.examples.length} examples for synthesis`);
    }

    if (spec.examples.length < 2) {
      return {
        type: "need_constraints",
        message: "Need at least 2 input/output examples for synthesis.",
        suggestedNextStep: "Add more examples",
      };
    }

    return this.synthesizeFromExamples(spec.examples, spec.patternHint);
  }

  /**
   * Core synthesis function
   *
   * Uses the synthesis engine to find programs satisfying the examples.
   */
  private synthesizeFromExamples(
    examples: Example[],
    patternHint?: string
  ): CoordinatorFeedback {
    const constraint: ExtractionConstraint = {
      type: "extraction",
      description: "Data extraction",
      examples,
      pattern: patternHint,
    };

    this.session.constraints.push(constraint);

    if (this.verbose) {
      console.log(`[Coordinator] Synthesizing from ${examples.length} examples...`);
    }

    // Run synthesis
    const result = this.engine.synthesize(constraint);
    this.session.synthesizedPrograms.push(result);

    if (result.success && result.code) {
      this.session.currentProgram = result;

      if (this.verbose) {
        console.log(`[Coordinator] Synthesis successful!`);
        console.log(`[Coordinator] Generated code: ${result.code}`);
      }

      return {
        type: "synthesis_success",
        message: `Synthesized extraction code from ${examples.length} examples.`,
        synthesizedCode: result.code,
        testResults: {
          total: result.testedExamples,
          passed: result.passedExamples,
          failed: result.testedExamples - result.passedExamples,
        },
        suggestedNextStep: "Apply synthesized code to all data",
      };
    } else {
      if (this.verbose) {
        console.log(`[Coordinator] Synthesis failed: ${result.error}`);
      }

      return {
        type: "synthesis_failed",
        message: result.error || "Could not synthesize a program",
        testResults: {
          total: result.testedExamples,
          passed: result.passedExamples,
          failed: result.testedExamples - result.passedExamples,
          failedExamples: result.failedExamples,
        },
        suggestedNextStep: "Provide different or additional examples",
      };
    }
  }

  /**
   * Request refinement with additional examples
   *
   * Called when LLM determines the synthesized code is incorrect
   * and provides more examples.
   */
  refine(additionalExamples: Example[]): CoordinatorFeedback {
    if (!this.session.currentProgram) {
      return {
        type: "need_constraints",
        message: "No previous synthesis to refine. Provide initial examples.",
      };
    }

    const result = this.engine.refine(this.session.currentProgram, additionalExamples);

    if (result.success && result.code) {
      this.session.currentProgram = result;
      return {
        type: "synthesis_success",
        message: "Refined extraction code with additional examples.",
        synthesizedCode: result.code,
        testResults: {
          total: result.testedExamples,
          passed: result.passedExamples,
          failed: result.testedExamples - result.passedExamples,
        },
      };
    }

    return {
      type: "refinement_needed",
      message: "Refinement failed. Need different approach or more examples.",
      testResults: {
        total: result.testedExamples,
        passed: result.passedExamples,
        failed: result.testedExamples - result.passedExamples,
        failedExamples: result.failedExamples,
      },
    };
  }

  /**
   * Get the current synthesized code
   */
  getSynthesizedCode(): string | null {
    return this.session.currentProgram?.code || null;
  }

  /**
   * Generate a complete extraction function
   *
   * Given grep results and synthesized extraction code,
   * generate a complete function that processes all matches.
   */
  generateCompleteCode(variableName: string = "hits"): string | null {
    const extractCode = this.getSynthesizedCode();
    if (!extractCode) return null;

    // Generate code that applies extraction to each grep result
    return `// Synthesized extraction code
let total = 0;
for (const hit of ${variableName}) {
  const input = hit.line;
  const extracted = ${extractCode.replace(/input/g, "input")};
  if (extracted !== null && !isNaN(extracted)) {
    total += extracted;
    console.log(hit.line, "->", extracted);
  }
}
console.log("Total:", total);`;
  }

  /**
   * Detect patterns in grep matches
   */
  private detectPatterns(
    matches: Array<{ line: string; match: string; lineNum: number }>
  ): string[] {
    const patterns: string[] = [];

    // Check for currency pattern
    const currencyMatches = matches.filter((m) => /\$[\d,]+/.test(m.line));
    if (currencyMatches.length >= 2) {
      patterns.push("\\$([\\d,]+)");
    }

    // Check for key:value pattern
    const kvMatches = matches.filter((m) => /\w+:\s*[\d,]+/.test(m.line));
    if (kvMatches.length >= 2) {
      patterns.push(":\\s*([\\d,]+)");
    }

    // Check for percentage pattern
    const pctMatches = matches.filter((m) => /\d+%/.test(m.line));
    if (pctMatches.length >= 2) {
      patterns.push("(\\d+)%");
    }

    return patterns;
  }

  /**
   * Generate input/output examples from pattern matches
   */
  private generateExamplesFromPatterns(
    matches: Array<{ line: string; match: string; lineNum: number }>,
    patterns: string[]
  ): Example[] {
    const examples: Example[] = [];

    for (const pattern of patterns) {
      const regex = new RegExp(pattern);

      for (const m of matches) {
        const match = m.line.match(regex);
        if (match && match[1]) {
          // Try to infer the output (parsed number)
          const rawValue = match[1].replace(/,/g, "");
          const numValue = parseFloat(rawValue);

          if (!isNaN(numValue)) {
            // The input is the matched currency string with $
            const currencyMatch = m.line.match(/\$[\d,]+/);
            if (currencyMatch) {
              examples.push({
                input: currencyMatch[0],
                output: numValue,
              });
            }
          }
        }
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    return examples.filter((e) => {
      const key = `${e.input}:${e.output}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Reset session state
   */
  reset(): void {
    this.session = {
      explorations: [],
      constraints: [],
      synthesizedPrograms: [],
    };
  }
}

/**
 * Create a Barliman-style synthesis coordinator
 */
export function createBarlimanCoordinator(verbose: boolean = false): BarlimanCoordinator {
  return new BarlimanCoordinator(verbose);
}
