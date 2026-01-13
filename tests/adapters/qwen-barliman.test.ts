/**
 * Tests for the Qwen Barliman adapter
 * Verifies Barliman-style constraint-based synthesis prompting
 */

import { describe, it, expect } from "vitest";
import { createQwenBarlimanAdapter } from "../../src/adapters/qwen-barliman.js";
import { getAdapter, resolveAdapter } from "../../src/adapters/index.js";

describe("Qwen Barliman Adapter", () => {
  const adapter = createQwenBarlimanAdapter();

  describe("adapter properties", () => {
    it("should have name 'qwen-barliman'", () => {
      expect(adapter.name).toBe("qwen-barliman");
    });

    it("should be registered in the adapter registry", () => {
      const registered = getAdapter("qwen-barliman");
      expect(registered).toBeDefined();
      expect(registered?.name).toBe("qwen-barliman");
    });

    it("should be the default for qwen models", () => {
      const resolved = resolveAdapter("qwen2.5-coder:7b");
      expect(resolved.name).toBe("qwen-barliman");
    });
  });

  describe("buildSystemPrompt", () => {
    const prompt = adapter.buildSystemPrompt(10000, "");

    it("should emphasize constraint-based synthesis", () => {
      expect(prompt).toContain("CONSTRAINT PROVIDER");
      expect(prompt).toContain("input/output");
    });

    it("should explain the synthesis engine", () => {
      expect(prompt).toContain("synthesizer");
      expect(prompt).toContain("miniKanren");
    });

    it("should explain grep API correctly - single argument", () => {
      expect(prompt).toContain("ONE argument");
    });

    it("should explain grep returns objects", () => {
      expect(prompt).toContain("hit.line");
    });

    it("should include document length", () => {
      expect(prompt).toContain("10,000");
    });

    it("should warn about floating objects", () => {
      expect(prompt).toContain("NO floating objects");
    });

    it("should be generic - not domain specific", () => {
      // Should use generic terms like "keyword" not specific like "SALES_DATA"
      expect(prompt).toContain("keyword");
      // Should not hardcode specific domains
      expect(prompt).not.toContain("SALES_DATA");
      expect(prompt).not.toContain("$1,000");
    });
  });

  describe("extractCode", () => {
    it("should extract javascript code blocks", () => {
      const response = "```javascript\nconst hits = grep('test');\n```";
      expect(adapter.extractCode(response)).toBe("const hits = grep('test');");
    });

    it("should return null for no code block", () => {
      expect(adapter.extractCode("Just text")).toBeNull();
    });
  });

  describe("extractFinalAnswer", () => {
    it("should extract FINAL delimited answer", () => {
      const response = "<<<FINAL>>>\nThe answer is 42\n<<<END>>>";
      expect(adapter.extractFinalAnswer(response)).toBe("The answer is 42");
    });
  });

  describe("getErrorFeedback", () => {
    it("should detect floating object literal errors", () => {
      const code = `{ input: "a", output: 1 }
{ input: "b", output: 2 }`;
      const feedback = adapter.getErrorFeedback("Unexpected token ':'", code);

      expect(feedback).toContain("Floating object literals");
      expect(feedback).toContain("inside an array");
    });

    it("should provide helpful feedback for grep misuse", () => {
      const feedback = adapter.getErrorFeedback(
        "Invalid flags supplied to RegExp constructor 'regionm'"
      );

      expect(feedback).toContain("ONE argument");
    });

    it("should provide helpful feedback for string method on object", () => {
      const feedback = adapter.getErrorFeedback("match is not a function");

      expect(feedback).toContain(".line");
    });
  });

  describe("getNoCodeFeedback", () => {
    const feedback = adapter.getNoCodeFeedback();

    it("should show generic example", () => {
      expect(feedback).toContain("grep");
      expect(feedback).toContain("keyword");
    });
  });
});

describe("Generic Prompting", () => {
  const adapter = createQwenBarlimanAdapter();
  const prompt = adapter.buildSystemPrompt(5000, "");

  it("should use generic placeholders", () => {
    expect(prompt).toContain("keyword");
    expect(prompt).toContain("pattern");
  });

  it("should explain to FIRST search, THEN synthesize", () => {
    expect(prompt).toContain("FIRST search");
    expect(prompt).toContain("THEN");
  });

  it("should emphasize looking at output", () => {
    expect(prompt).toContain("LOOK");
    expect(prompt).toContain("output");
  });
});
