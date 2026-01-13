import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSandbox, Sandbox, createTextStats, generateDocumentOutline } from "../src/sandbox.js";

describe("TypeScript Sandbox", () => {
  const testContext = `Line 1
Line 2
Line 3
Line 4
Line 5
Line 6
Line 7
Line 8
Line 9
Line 10`;

  let sandbox: Sandbox;
  const mockLLM = async (prompt: string) => `Mock response for: ${prompt}`;

  beforeEach(async () => {
    sandbox = await createSandbox(testContext, mockLLM);
  });

  afterEach(() => {
    sandbox.dispose();
  });

  describe("createSandbox", () => {
    it("should create a sandbox with context variable", async () => {
      const result = await sandbox.execute("context.length");
      expect(result.result).toBe(testContext.length);
      expect(result.error).toBeUndefined();
    });

    it("should expose context as string", async () => {
      const result = await sandbox.execute("typeof context");
      expect(result.result).toBe("string");
    });

    it("should expose memory array", async () => {
      const result = await sandbox.execute(`
        memory.push({ test: 1 });
        memory.push({ test: 2 });
        memory.length;
      `);
      expect(result.result).toBe(2);
    });

    it("should persist memory across executions", async () => {
      await sandbox.execute('memory.push("first")');
      await sandbox.execute('memory.push("second")');
      const result = await sandbox.execute("memory");
      expect(result.result).toEqual(["first", "second"]);
    });

    it("should allow reading memory via getMemory()", async () => {
      await sandbox.execute('memory.push({ key: "value" })');
      const mem = sandbox.getMemory();
      expect(mem).toEqual([{ key: "value" }]);
    });
  });

  describe("console.log capture", () => {
    it("should capture console.log output", async () => {
      const result = await sandbox.execute(`
        console.log('Hello');
        console.log('World');
        42;
      `);
      expect(result.logs).toEqual(["Hello", "World"]);
      expect(result.result).toBe(42);
    });

    it("should handle multiple arguments", async () => {
      const result = await sandbox.execute('console.log("a", "b", "c")');
      expect(result.logs).toEqual(["a b c"]);
    });

    it("should capture console.error", async () => {
      const result = await sandbox.execute('console.error("error message")');
      expect(result.logs).toEqual(["[ERROR] error message"]);
    });

    it("should capture console.warn", async () => {
      const result = await sandbox.execute('console.warn("warning")');
      expect(result.logs).toEqual(["[WARN] warning"]);
    });
  });

  describe("text_stats", () => {
    it("should return document metadata without reading full content", async () => {
      const result = await sandbox.execute("text_stats()");
      const stats = result.result as {
        length: number;
        lineCount: number;
        sample: { start: string; middle: string; end: string };
      };

      expect(stats.length).toBe(testContext.length);
      expect(stats.lineCount).toBe(10);
      expect(stats.sample.start).toContain("Line 1");
      expect(stats.sample.end).toContain("Line 10");
    });

    it("should provide middle sample", async () => {
      const result = await sandbox.execute("text_stats().sample.middle");
      expect(result.result).toContain("Line 5");
    });

    it("should return a copy (not modifiable)", async () => {
      await sandbox.execute(`
        const s = text_stats();
        s.length = 999;
      `);
      const result = await sandbox.execute("text_stats().length");
      expect(result.result).toBe(testContext.length);
    });
  });

  describe("fuzzy_search", () => {
    it("should find exact matches", async () => {
      const result = await sandbox.execute('fuzzy_search("Line 5")');
      const matches = result.result as Array<{
        line: string;
        lineNum: number;
        score: number;
      }>;
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].line).toBe("Line 5");
      expect(matches[0].score).toBe(0); // Exact match
    });

    it("should find approximate matches", async () => {
      const result = await sandbox.execute('fuzzy_search("Lin 5")'); // Typo
      const matches = result.result as Array<{ line: string }>;
      expect(matches.length).toBeGreaterThan(0);
      // Should still find Line 5
      expect(matches.some((m) => m.line === "Line 5")).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const result = await sandbox.execute('fuzzy_search("Line", 3)');
      const matches = result.result as Array<{ line: string }>;
      expect(matches.length).toBeLessThanOrEqual(3);
    });

    it("should include line numbers and scores", async () => {
      const result = await sandbox.execute('fuzzy_search("Line 1")[0]');
      const match = result.result as {
        line: string;
        lineNum: number;
        score: number;
      };
      expect(match).toHaveProperty("lineNum");
      expect(match).toHaveProperty("score");
      expect(match.lineNum).toBe(1);
    });

    it("should return empty array for no matches", async () => {
      const result = await sandbox.execute('fuzzy_search("ZZZZZZZZZ")');
      const matches = result.result as Array<unknown>;
      expect(matches).toEqual([]);
    });
  });

  describe("llm_query", () => {
    it("should call the provided LLM function", async () => {
      const result = await sandbox.execute(
        'await llm_query("test prompt")'
      );
      expect(result.result).toBe("Mock response for: test prompt");
    });

    it("should be async", async () => {
      const result = await sandbox.execute(`
        const response = await llm_query("hello");
        response.includes("Mock") ? "success" : "fail";
      `);
      expect(result.result).toBe("success");
    });

    it("should work in loops", async () => {
      const result = await sandbox.execute(`
        const results = [];
        for (let i = 0; i < 3; i++) {
          results.push(await llm_query("call " + i));
        }
        results.length;
      `);
      expect(result.result).toBe(3);
    });

    it("should support format option for JSON mode", async () => {
      const capturedCalls: Array<{ prompt: string; options?: { format?: string } }> = [];
      const trackingLLM = async (prompt: string, options?: { format?: string }) => {
        capturedCalls.push({ prompt, options });
        return options?.format === "json" ? '{"key": "value"}' : "text response";
      };

      const sandboxWithTracking = await createSandbox(testContext, trackingLLM);

      const result = await sandboxWithTracking.execute(`
        await llm_query("get data", { format: "json" });
      `);

      sandboxWithTracking.dispose();

      expect(capturedCalls[0].options?.format).toBe("json");
      expect(result.result).toBe('{"key": "value"}');
    });

    it("should default to text format when no options provided", async () => {
      const capturedCalls: Array<{ prompt: string; options?: { format?: string } }> = [];
      const trackingLLM = async (prompt: string, options?: { format?: string }) => {
        capturedCalls.push({ prompt, options });
        return "text response";
      };

      const sandboxWithTracking = await createSandbox(testContext, trackingLLM);

      await sandboxWithTracking.execute(`
        await llm_query("get data");
      `);

      sandboxWithTracking.dispose();

      expect(capturedCalls[0].options).toBeUndefined();
    });
  });

  describe("batch_llm_query", () => {
    it("should execute multiple queries in parallel", async () => {
      const callOrder: string[] = [];
      const parallelLLM = async (prompt: string) => {
        callOrder.push(`start:${prompt}`);
        // Simulate async work
        await new Promise((r) => setTimeout(r, 10));
        callOrder.push(`end:${prompt}`);
        return `Response for: ${prompt}`;
      };

      const sandboxWithParallel = await createSandbox(testContext, parallelLLM);

      const result = await sandboxWithParallel.execute(`
        const results = await batch_llm_query(["query1", "query2", "query3"]);
        results;
      `);

      sandboxWithParallel.dispose();

      const results = result.result as string[];
      expect(results).toHaveLength(3);
      expect(results[0]).toBe("Response for: query1");
      expect(results[1]).toBe("Response for: query2");
      expect(results[2]).toBe("Response for: query3");
    });

    it("should return results in the same order as prompts", async () => {
      const delays = [30, 10, 20]; // Different delays to test ordering
      let callIndex = 0;

      const variableDelayLLM = async (prompt: string) => {
        const idx = callIndex++;
        await new Promise((r) => setTimeout(r, delays[idx]));
        return `Response ${idx}`;
      };

      const sandboxWithDelay = await createSandbox(testContext, variableDelayLLM);

      const result = await sandboxWithDelay.execute(`
        const results = await batch_llm_query(["first", "second", "third"]);
        results;
      `);

      sandboxWithDelay.dispose();

      const results = result.result as string[];
      // Results should be in order of prompts, not completion order
      expect(results[0]).toBe("Response 0");
      expect(results[1]).toBe("Response 1");
      expect(results[2]).toBe("Response 2");
    });

    it("should respect maxSubCalls limit across batch", async () => {
      let callCount = 0;
      const countingLLM = async () => {
        callCount++;
        return "ok";
      };

      const sandboxWithLimit = await createSandbox(testContext, countingLLM, {
        maxSubCalls: 3,
      });

      const result = await sandboxWithLimit.execute(`
        await batch_llm_query(["q1", "q2", "q3", "q4", "q5"]);
      `);

      sandboxWithLimit.dispose();

      // Should error because 5 > 3 limit
      expect(result.error).toMatch(/max.*calls|limit.*exceeded/i);
    });

    it("should handle empty array", async () => {
      const result = await sandbox.execute(`
        const results = await batch_llm_query([]);
        results;
      `);

      expect(result.result).toEqual([]);
    });

    it("should support options in batch queries", async () => {
      const capturedOptions: Array<{ format?: string } | undefined> = [];
      const trackingLLM = async (prompt: string, options?: { format?: string }) => {
        capturedOptions.push(options);
        return options?.format === "json" ? '{"data": true}' : "text";
      };

      const sandboxWithTracking = await createSandbox(testContext, trackingLLM);

      await sandboxWithTracking.execute(`
        await batch_llm_query(
          ["get json", "get more json"],
          { format: "json" }
        );
      `);

      sandboxWithTracking.dispose();

      expect(capturedOptions[0]?.format).toBe("json");
      expect(capturedOptions[1]?.format).toBe("json");
    });
  });

  describe("timeout protection", () => {
    it("should terminate infinite loops", async () => {
      const result = await sandbox.execute("while(true) {}", 100);
      expect(result.error).toMatch(/timed? out/i);
    });

    it("should allow configurable timeout", async () => {
      const start = Date.now();
      await sandbox.execute("while(true) {}", 200);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000);
      expect(elapsed).toBeGreaterThanOrEqual(150); // Allow some variance
    });

    it("should complete fast code without timeout", async () => {
      const result = await sandbox.execute("1 + 1", 100);
      expect(result.result).toBe(2);
      expect(result.error).toBeUndefined();
    });
  });

  describe("security isolation", () => {
    it("should not have access to require", async () => {
      const result = await sandbox.execute("typeof require");
      expect(result.result).toBe("undefined");
    });

    it("should not have access to process", async () => {
      const result = await sandbox.execute("typeof process");
      expect(result.result).toBe("undefined");
    });

    it("should not have access to global", async () => {
      const result = await sandbox.execute("typeof global");
      expect(result.result).toBe("undefined");
    });

    it("should not have access to __dirname", async () => {
      const result = await sandbox.execute("typeof __dirname");
      expect(result.result).toBe("undefined");
    });

    it("should not have access to import", async () => {
      // Dynamic import in vm context throws an error
      const result = await sandbox.execute(`
        typeof import
      `);
      // 'import' is a keyword, not accessible as a value
      expect(result.error).toBeDefined();
    });

    it("should have access to safe built-ins", async () => {
      const result = await sandbox.execute(`
        const checks = [
          typeof JSON,
          typeof Math,
          typeof Array,
          typeof Object,
          typeof Promise,
          typeof Map,
          typeof Set
        ];
        checks.every(t => t !== 'undefined');
      `);
      expect(result.result).toBe(true);
    });
  });

  describe("context leaking protection", () => {
    it("should NOT pass parent history to llm_query", async () => {
      const capturedPrompts: string[] = [];
      const trackingLLM = async (prompt: string) => {
        capturedPrompts.push(prompt);
        return "Sub-LLM response";
      };

      const sandboxWithTracking = await createSandbox(testContext, trackingLLM);

      await sandboxWithTracking.execute(`
        await llm_query("Summarize this chunk: some text here");
      `);

      sandboxWithTracking.dispose();

      // The sub-LLM prompt should ONLY contain what the sandbox code passed
      expect(capturedPrompts[0]).toBe("Summarize this chunk: some text here");
      expect(capturedPrompts[0]).not.toContain(
        "You are a Recursive Language Model"
      );
    });

    it("should isolate sub-LLM calls from parent context variable", async () => {
      const capturedPrompts: string[] = [];
      const trackingLLM = async (prompt: string) => {
        capturedPrompts.push(prompt);
        return "response";
      };

      const sandboxWithTracking = await createSandbox(testContext, trackingLLM);

      await sandboxWithTracking.execute(`
        await llm_query("Process: " + context.slice(0, 20));
      `);

      sandboxWithTracking.dispose();

      // The sub-LLM sees only what was explicitly passed (first 20 chars)
      expect(capturedPrompts[0]).toContain("Process: ");
      expect(capturedPrompts[0].length).toBeLessThan(50);
      // Should NOT contain the full context
      expect(capturedPrompts[0]).not.toContain("Line 10");
    });
  });

  describe("sub-call limiting", () => {
    it("should track number of llm_query calls per sandbox", async () => {
      let callCount = 0;
      const countingLLM = async (prompt: string) => {
        callCount++;
        return `Response ${callCount}`;
      };

      const sandboxWithCounting = await createSandbox(
        testContext,
        countingLLM
      );

      await sandboxWithCounting.execute(`
        for (let i = 0; i < 3; i++) {
          await llm_query("Call " + i);
        }
      `);

      sandboxWithCounting.dispose();
      expect(callCount).toBe(3);
    });

    it("should enforce maxSubCalls limit", async () => {
      let callCount = 0;
      const countingLLM = async () => {
        callCount++;
        return `Response ${callCount}`;
      };

      const sandboxWithLimit = await createSandbox(testContext, countingLLM, {
        maxSubCalls: 5,
      });

      const result = await sandboxWithLimit.execute(`
        const results = [];
        for (let i = 0; i < 100; i++) {
          results.push(await llm_query("Call " + i));
        }
        results.length;
      `);

      sandboxWithLimit.dispose();

      // Should stop at 5 calls, not 100
      // The 6th call increments counter then throws, so callCount is 6
      // but only 5 successful responses
      expect(callCount).toBeLessThanOrEqual(6);
      expect(result.error).toMatch(/max.*calls|limit.*exceeded/i);
    });

    it("should accumulate sub-calls across executions", async () => {
      let callCount = 0;
      const countingLLM = async () => {
        callCount++;
        return "ok";
      };

      const sandboxWithLimit = await createSandbox(testContext, countingLLM, {
        maxSubCalls: 5,
      });

      // First execution: 3 calls
      await sandboxWithLimit.execute(`
        for (let i = 0; i < 3; i++) {
          await llm_query("Call " + i);
        }
      `);

      // Second execution: 3 more calls (should hit limit at 6th call)
      const result = await sandboxWithLimit.execute(`
        for (let i = 0; i < 3; i++) {
          await llm_query("Call " + i);
        }
      `);

      sandboxWithLimit.dispose();

      expect(result.error).toMatch(/max.*calls|limit.*exceeded/i);
    });
  });

  describe("dispose", () => {
    it("should prevent further execution after dispose", async () => {
      sandbox.dispose();
      const result = await sandbox.execute("1 + 1");
      expect(result.error).toContain("disposed");
    });

    it("should prevent llm_query after dispose", async () => {
      // Execute once successfully
      await sandbox.execute('await llm_query("test")');

      // Dispose
      sandbox.dispose();

      // Try to execute again
      const result = await sandbox.execute('await llm_query("test2")');
      expect(result.error).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should catch syntax errors", async () => {
      const result = await sandbox.execute("const x = {");
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/unexpected|syntax/i);
    });

    it("should catch runtime errors", async () => {
      const result = await sandbox.execute("undefinedVariable.foo()");
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/not defined|undefined/i);
    });

    it("should catch thrown errors", async () => {
      const result = await sandbox.execute('throw new Error("custom error")');
      expect(result.error).toContain("custom error");
    });

    it("should still return logs on error", async () => {
      const result = await sandbox.execute(`
        console.log("before error");
        throw new Error("fail");
      `);
      expect(result.logs).toEqual(["before error"]);
      expect(result.error).toContain("fail");
    });
  });

  describe("complex operations", () => {
    it("should handle array operations", async () => {
      const result = await sandbox.execute(`
        const lines = context.split("\\n");
        lines.filter(l => l.includes("5")).length;
      `);
      expect(result.result).toBe(1);
    });

    it("should handle regex operations", async () => {
      const result = await sandbox.execute(`
        const matches = context.match(/Line \\d+/g);
        matches.length;
      `);
      expect(result.result).toBe(10);
    });

    it("should handle JSON operations", async () => {
      const result = await sandbox.execute(`
        const data = { key: "value", num: 42 };
        memory.push(data);
        JSON.stringify(memory[memory.length - 1]);
      `);
      expect(result.result).toBe('{"key":"value","num":42}');
    });

    it("should handle async/await patterns", async () => {
      const result = await sandbox.execute(`
        const results = await Promise.all([
          llm_query("query 1"),
          llm_query("query 2")
        ]);
        results.length;
      `);
      expect(result.result).toBe(2);
    });
  });

  describe("grep (native regex search)", () => {
    it("should find all regex matches with line numbers", async () => {
      const result = await sandbox.execute('grep("Line \\\\d+")');
      const matches = result.result as Array<{
        match: string;
        lineNum: number;
        index: number;
      }>;
      expect(matches.length).toBe(10);
      expect(matches[0].match).toBe("Line 1");
      expect(matches[0].lineNum).toBe(1);
    });

    it("should support regex flags", async () => {
      const result = await sandbox.execute('grep("line", "i")');
      const matches = result.result as Array<{ match: string }>;
      expect(matches.length).toBe(10); // Case insensitive
    });

    it("should return empty array for no matches", async () => {
      const result = await sandbox.execute('grep("ZZZZZ")');
      expect(result.result).toEqual([]);
    });

    it("should include character index in results", async () => {
      const result = await sandbox.execute('grep("Line 1$")');
      const matches = result.result as Array<{ index: number }>;
      expect(matches.length).toBe(1);
      expect(matches[0].index).toBe(0);
    });

    it("should handle capture groups", async () => {
      const result = await sandbox.execute('grep("Line (\\\\d+)")');
      const matches = result.result as Array<{
        match: string;
        groups: string[];
      }>;
      expect(matches[0].groups).toContain("1");
    });
  });

  describe("count_tokens (token estimation)", () => {
    it("should estimate token count for context by default", async () => {
      const result = await sandbox.execute("count_tokens()");
      const count = result.result as number;
      // Rough estimate: ~4 chars per token
      expect(count).toBeGreaterThan(10);
      expect(count).toBeLessThan(100);
    });

    it("should estimate token count for provided text", async () => {
      const result = await sandbox.execute('count_tokens("hello world")');
      const count = result.result as number;
      expect(count).toBe(2); // "hello" and "world" are ~2 tokens
    });

    it("should handle empty string", async () => {
      const result = await sandbox.execute('count_tokens("")');
      expect(result.result).toBe(0);
    });

    it("should provide reasonable estimates for code", async () => {
      const result = await sandbox.execute(
        'count_tokens("function foo() { return 42; }")'
      );
      const count = result.result as number;
      // Code typically has more tokens per word
      expect(count).toBeGreaterThan(5);
      expect(count).toBeLessThan(20);
    });
  });

  describe("locate_line (line-based extraction)", () => {
    it("should extract a single line by number", async () => {
      const result = await sandbox.execute("locate_line(5)");
      expect(result.result).toBe("Line 5");
    });

    it("should extract a range of lines", async () => {
      const result = await sandbox.execute("locate_line(1, 3)");
      expect(result.result).toBe("Line 1\nLine 2\nLine 3");
    });

    it("should handle out of bounds gracefully", async () => {
      const result = await sandbox.execute("locate_line(100)");
      expect(result.result).toBe(""); // Or could be null
    });

    it("should handle negative indices from end", async () => {
      const result = await sandbox.execute("locate_line(-1)");
      expect(result.result).toBe("Line 10"); // Last line
    });

    it("should handle range with negative end", async () => {
      const result = await sandbox.execute("locate_line(8, -1)");
      expect(result.result).toBe("Line 8\nLine 9\nLine 10");
    });

    it("should use 1-based line numbers", async () => {
      const result = await sandbox.execute("locate_line(1)");
      expect(result.result).toBe("Line 1"); // First line is 1, not 0
    });
  });
});

describe("createTextStats", () => {
  it("should create stats for a document", () => {
    const context = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5";
    const stats = createTextStats(context);

    expect(stats.length).toBe(context.length);
    expect(stats.lineCount).toBe(5);
    expect(stats.sample.start).toContain("Line 1");
  });

  it("should handle empty document", () => {
    const stats = createTextStats("");
    expect(stats.length).toBe(0);
    expect(stats.lineCount).toBe(1); // Empty string splits into [""]
  });

  it("should handle single line", () => {
    const stats = createTextStats("Single line document");
    expect(stats.lineCount).toBe(1);
    expect(stats.sample.start).toBe("Single line document");
  });
});

describe("generateDocumentOutline", () => {
  it("should detect markdown headers", () => {
    const doc = `# Title
Some intro text
## Section 1
Content here
### Subsection 1.1
More content
## Section 2
Final content`;

    const outline = generateDocumentOutline(doc);

    expect(outline.sections).toHaveLength(4);
    expect(outline.sections[0].title).toBe("Title");
    expect(outline.sections[0].level).toBe(1);
    expect(outline.sections[1].title).toBe("Section 1");
    expect(outline.sections[1].level).toBe(2);
  });

  it("should detect common patterns like DATE:, ERROR:, etc.", () => {
    const doc = `2024-01-01 INFO: Starting
2024-01-01 ERROR: Something failed
2024-01-01 WARN: Low memory
2024-01-02 INFO: Recovered`;

    const outline = generateDocumentOutline(doc);

    expect(outline.patterns).toBeDefined();
    expect(outline.patterns.some(p => p.pattern.includes("ERROR"))).toBe(true);
  });

  it("should provide document summary", () => {
    const doc = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10";

    const outline = generateDocumentOutline(doc);

    expect(outline.summary.totalLines).toBe(10);
    expect(outline.summary.totalChars).toBe(doc.length);
  });

  it("should detect JSON/structured data", () => {
    const doc = `{"users": [{"name": "John"}, {"name": "Jane"}]}`;

    const outline = generateDocumentOutline(doc);

    expect(outline.format).toBe("json");
  });

  it("should detect CSV format", () => {
    const doc = `name,age,city
John,30,NYC
Jane,25,LA`;

    const outline = generateDocumentOutline(doc);

    expect(outline.format).toBe("csv");
  });

  it("should handle plain text documents", () => {
    const doc = `This is a plain text document.
It has multiple paragraphs.

Each paragraph has some content.
The document discusses various topics.`;

    const outline = generateDocumentOutline(doc);

    expect(outline.format).toBe("text");
    expect(outline.summary.totalLines).toBeGreaterThan(0);
  });
});
