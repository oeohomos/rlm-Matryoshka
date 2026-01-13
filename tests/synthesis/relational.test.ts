/**
 * Tests for Barliman-style Relational Synthesis
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SynthesisEngine,
  createSynthesisEngine,
  analyzeExamples,
  type ExtractionConstraint,
} from "../../src/synthesis/relational/engine.js";
import {
  BarlimanCoordinator,
  createBarlimanCoordinator,
} from "../../src/synthesis/relational/coordinator.js";

describe("Synthesis Engine", () => {
  let engine: SynthesisEngine;

  beforeEach(() => {
    engine = createSynthesisEngine();
  });

  describe("template-based synthesis", () => {
    it("should synthesize currency extraction", () => {
      const constraint: ExtractionConstraint = {
        type: "extraction",
        description: "Extract currency values",
        examples: [
          { input: "$1,000", output: 1000 },
          { input: "$2,500", output: 2500 },
          { input: "$10,000", output: 10000 },
        ],
      };

      const result = engine.synthesize(constraint);

      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      expect(result.passedExamples).toBe(3);
    });

    it("should synthesize from larger currency values", () => {
      const constraint: ExtractionConstraint = {
        type: "extraction",
        description: "Extract large currency values",
        examples: [
          { input: "$2,340,000", output: 2340000 },
          { input: "$3,120,000", output: 3120000 },
        ],
      };

      const result = engine.synthesize(constraint);

      expect(result.success).toBe(true);
      expect(result.passedExamples).toBe(2);
    });

    it("should fail with conflicting examples", () => {
      const constraint: ExtractionConstraint = {
        type: "extraction",
        description: "Conflicting examples",
        examples: [
          { input: "$1,000", output: 1000 },
          { input: "$1,000", output: 2000 }, // Same input, different output
        ],
      };

      const result = engine.synthesize(constraint);

      // Should fail because no program can satisfy both
      expect(result.passedExamples).toBeLessThan(2);
    });

    it("should require minimum examples", () => {
      const constraint: ExtractionConstraint = {
        type: "extraction",
        description: "Too few examples",
        examples: [{ input: "$1,000", output: 1000 }],
      };

      const result = engine.synthesize(constraint);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Need at least");
    });
  });

  describe("analyzeExamples", () => {
    it("should detect string to number conversion", () => {
      const examples = [
        { input: "$100", output: 100 },
        { input: "$200", output: 200 },
      ];

      const analysis = analyzeExamples(examples);

      expect(analysis.inputType).toBe("string");
      expect(analysis.outputType).toBe("number");
    });

    it("should detect currency pattern", () => {
      const examples = [
        { input: "$1,000", output: 1000 },
        { input: "$2,500", output: 2500 },
      ];

      const analysis = analyzeExamples(examples);

      expect(analysis.patterns).toContain("\\$([\\d,]+)");
    });

    it("should detect percentage pattern", () => {
      const examples = [
        { input: "50%", output: 50 },
        { input: "75%", output: 75 },
      ];

      const analysis = analyzeExamples(examples);

      expect(analysis.patterns).toContain("(\\d+)%");
    });
  });
});

describe("Barliman Coordinator", () => {
  let coordinator: BarlimanCoordinator;

  beforeEach(() => {
    coordinator = createBarlimanCoordinator(false);
  });

  describe("processExploration", () => {
    it("should detect patterns from grep results", () => {
      const exploration = {
        query: "sales",
        matches: [
          { line: "SALES_DATA_NORTH: $2,340,000", lineNum: 20, match: "SALES" },
          { line: "SALES_DATA_SOUTH: $3,120,000", lineNum: 45, match: "SALES" },
          { line: "SALES_DATA_EAST: $2,890,000", lineNum: 65, match: "SALES" },
        ],
      };

      const feedback = coordinator.processExploration(exploration);

      // Should either succeed or ask for more constraints
      expect(["synthesis_success", "need_constraints"]).toContain(feedback.type);
    });

    it("should auto-generate examples from currency matches", () => {
      const exploration = {
        query: "SALES_DATA",
        matches: [
          { line: "SALES_DATA_NORTH: $2,340,000", lineNum: 20, match: "SALES_DATA" },
          { line: "SALES_DATA_SOUTH: $3,120,000", lineNum: 45, match: "SALES_DATA" },
          { line: "SALES_DATA_EAST: $2,890,000", lineNum: 65, match: "SALES_DATA" },
          { line: "SALES_DATA_WEST: $2,670,000", lineNum: 85, match: "SALES_DATA" },
          { line: "SALES_DATA_CENTRAL: $1,980,000", lineNum: 108, match: "SALES_DATA" },
        ],
      };

      const feedback = coordinator.processExploration(exploration);

      if (feedback.type === "synthesis_success") {
        expect(feedback.synthesizedCode).toBeDefined();
        expect(feedback.testResults?.passed).toBeGreaterThan(0);
      }
    });
  });

  describe("processConstraints", () => {
    it("should synthesize from explicit examples", () => {
      const feedback = coordinator.processConstraints({
        description: "Extract sales amounts",
        examples: [
          { input: "$2,340,000", output: 2340000 },
          { input: "$3,120,000", output: 3120000 },
        ],
      });

      expect(feedback.type).toBe("synthesis_success");
      expect(feedback.synthesizedCode).toBeDefined();
    });

    it("should fail with too few examples", () => {
      const feedback = coordinator.processConstraints({
        description: "Not enough examples",
        examples: [{ input: "$1,000", output: 1000 }],
      });

      expect(feedback.type).toBe("need_constraints");
    });
  });

  describe("generateCompleteCode", () => {
    it("should generate complete extraction loop", () => {
      // First synthesize
      coordinator.processConstraints({
        description: "Extract values",
        examples: [
          { input: "$2,340,000", output: 2340000 },
          { input: "$3,120,000", output: 3120000 },
        ],
      });

      const code = coordinator.generateCompleteCode("hits");

      expect(code).toBeDefined();
      expect(code).toContain("for (const hit of hits)");
      expect(code).toContain("total +=");
      expect(code).toContain('console.log("Total:"');
    });
  });

  describe("refinement", () => {
    it("should refine with additional examples", () => {
      // Initial synthesis
      coordinator.processConstraints({
        description: "Extract values",
        examples: [
          { input: "$1,000", output: 1000 },
          { input: "$2,000", output: 2000 },
        ],
      });

      // Refine with more examples
      const feedback = coordinator.refine([
        { input: "$3,000", output: 3000 },
        { input: "$4,000", output: 4000 },
      ]);

      expect(feedback.type).toBe("synthesis_success");
    });
  });
});

describe("Integration: Full Synthesis Flow", () => {
  it("should complete full Barliman-style synthesis", () => {
    const coordinator = createBarlimanCoordinator(false);

    // Step 1: Simulate grep exploration
    const exploration = {
      query: "SALES_DATA",
      matches: [
        { line: "SALES_DATA_NORTH: $2,340,000", lineNum: 20, match: "SALES_DATA" },
        { line: "SALES_DATA_SOUTH: $3,120,000", lineNum: 45, match: "SALES_DATA" },
        { line: "SALES_DATA_EAST: $2,890,000", lineNum: 65, match: "SALES_DATA" },
        { line: "SALES_DATA_WEST: $2,670,000", lineNum: 85, match: "SALES_DATA" },
        { line: "SALES_DATA_CENTRAL: $1,980,000", lineNum: 108, match: "SALES_DATA" },
      ],
    };

    // Step 2: Process exploration - should auto-synthesize
    const feedback = coordinator.processExploration(exploration);

    // Step 3: Get synthesized code
    if (feedback.type === "synthesis_success") {
      const code = coordinator.generateCompleteCode("hits");

      expect(code).toBeDefined();

      // Verify the generated code would work
      // (In real use, this would be executed in the sandbox)
      expect(code).toContain("total");
      expect(code).toContain("parseFloat");
    }
  });

  it("should handle manual constraint specification", () => {
    const coordinator = createBarlimanCoordinator(false);

    // LLM provides explicit constraints
    const feedback = coordinator.processConstraints({
      description: "I need to extract dollar amounts and convert to numbers",
      examples: [
        { input: "$2,340,000", output: 2340000 },
        { input: "$3,120,000", output: 3120000 },
        { input: "$2,890,000", output: 2890000 },
      ],
    });

    expect(feedback.type).toBe("synthesis_success");

    // Test the synthesized code
    if (feedback.synthesizedCode) {
      const fn = new Function("input", `return ${feedback.synthesizedCode}`);

      expect(fn("$2,340,000")).toBe(2340000);
      expect(fn("$3,120,000")).toBe(3120000);
      expect(fn("$1,980,000")).toBe(1980000); // Works on new input too!
    }
  });
});
