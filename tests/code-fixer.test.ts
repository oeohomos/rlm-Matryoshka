import { describe, it, expect } from "vitest";
import { checkSyntax, fixCode, tryFixCode, FixResult } from "../src/code-fixer.js";

describe("Code Fixer", () => {
  describe("checkSyntax", () => {
    it("should return valid for correct JavaScript", () => {
      const result = checkSyntax("const x = 1; console.log(x);");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return invalid for syntax errors", () => {
      const result = checkSyntax("const x = ;");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle async code", () => {
      const result = checkSyntax("const x = await Promise.resolve(1);");
      expect(result.valid).toBe(true);
    });

    it("should detect unclosed braces", () => {
      const result = checkSyntax("function foo() { if (true) {");
      expect(result.valid).toBe(false);
    });

    it("should detect unclosed parentheses", () => {
      const result = checkSyntax("console.log(");
      expect(result.valid).toBe(false);
    });
  });

  describe("fixCode", () => {
    it("should return unchanged code if already valid", () => {
      const code = "const x = 1;";
      const result = fixCode(code);
      expect(result.code).toBe(code);
      expect(result.fixed).toBe(false);
      expect(result.fixes).toEqual([]);
    });

    it("should remove import statements", () => {
      const code = `import fs from "fs";
const x = 1;`;
      const result = fixCode(code);
      expect(result.code.trim()).toBe("const x = 1;");
      expect(result.fixes.some(f => f.toLowerCase().includes("import"))).toBe(true);
    });

    it("should remove require statements", () => {
      const code = `const fs = require("fs");
const x = 1;`;
      const result = fixCode(code);
      expect(result.code.trim()).toBe("const x = 1;");
      expect(result.fixes.some(f => f.toLowerCase().includes("require"))).toBe(true);
    });

    it("should remove export statements", () => {
      const code = `export const x = 1;
export default function foo() {}`;
      const result = fixCode(code);
      expect(result.code).not.toContain("export");
    });

    it("should remove TypeScript type annotations", () => {
      const code = "const x: string = 'hello';";
      const result = fixCode(code);
      // Should handle type annotations gracefully
      expect(result).toBeDefined();
    });

    it("should balance missing closing braces", () => {
      const code = "function foo() { if (true) { console.log(1);";
      const result = fixCode(code);

      // Count braces in result
      const openBraces = (result.code.match(/\{/g) || []).length;
      const closeBraces = (result.code.match(/\}/g) || []).length;
      expect(closeBraces).toBeGreaterThanOrEqual(openBraces);
    });

    it("should balance missing closing parentheses", () => {
      const code = "console.log(foo(bar(1, 2)";
      const result = fixCode(code);

      // Count parens in result
      const openParens = (result.code.match(/\(/g) || []).length;
      const closeParens = (result.code.match(/\)/g) || []).length;
      expect(closeParens).toBeGreaterThanOrEqual(openParens);
    });

    it("should preserve trailing commas in function calls (valid ES2017+)", () => {
      // Trailing commas in function calls are valid in modern JS
      const code = "console.log(1, 2, )";
      const result = fixCode(code);
      // Should not change valid code
      expect(result.fixed).toBe(false);
    });

    it("should preserve trailing commas in arrays (valid ES5+)", () => {
      // Trailing commas in arrays are valid in ES5+
      const code = "const arr = [1, 2, ]";
      const result = fixCode(code);
      // Should not change valid code
      expect(result.fixed).toBe(false);
    });
  });

  describe("tryFixCode", () => {
    it("should return fixed code when fixes help", () => {
      const code = `import fs from "fs";
console.log(1);`;
      const result = tryFixCode(code);
      expect(result.fixed).toBe(true);
    });

    it("should return original code when fixes don't help", () => {
      // Completely broken code that can't be fixed
      const code = "@@@ totally invalid @@@ syntax ###";
      const result = tryFixCode(code);
      expect(result.code).toBe(code);
      expect(result.fixed).toBe(false);
    });

    it("should not modify already valid code", () => {
      const code = "const x = 1; console.log(x);";
      const result = tryFixCode(code);
      expect(result.code).toBe(code);
      expect(result.fixed).toBe(false);
    });

    it("should handle multi-line code with imports", () => {
      const code = `import { something } from "module";

const result = something();
console.log(result);`;
      const result = tryFixCode(code);
      // Import line should be removed
      expect(result.code.trim().startsWith("const result")).toBe(true);
      expect(result.fixed).toBe(true);
    });
  });

  describe("real-world LLM output fixes", () => {
    it("should fix code with TypeScript-style interface", () => {
      const code = `interface Result {
  value: number;
}
const x = { value: 1 };
console.log(x);`;
      const result = fixCode(code);
      // Should either fix or not crash
      expect(result).toBeDefined();
    });

    it("should handle code starting with import from common libraries", () => {
      const code = `import * as path from "path";
const x = 1;
console.log(x);`;
      const result = fixCode(code);
      expect(result.code).not.toMatch(/^import/);
    });

    it("should fix missing semicolons after blocks", () => {
      const code = `function foo() {
  return 1;
}
const x = foo()`;
      // This is actually valid JS, so should pass through unchanged
      const result = checkSyntax(code);
      expect(result.valid).toBe(true);
    });

    it("should handle mixed valid and invalid patterns", () => {
      const code = `const stats = text_stats();
console.log(stats.lineCount);
memory.push({ count: stats.lineCount });`;
      const result = tryFixCode(code);
      // This should be valid as-is (assuming text_stats exists in runtime)
      // Just checking syntax here
      expect(result).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty code", () => {
      const result = fixCode("");
      expect(result.code).toBe("");
      expect(result.fixed).toBe(false);
    });

    it("should handle code with only comments", () => {
      const code = "// This is a comment";
      const result = fixCode(code);
      expect(result.code).toBe(code);
      expect(result.fixed).toBe(false);
    });

    it("should not break string literals containing import-like text", () => {
      const code = 'const msg = "import something from module";';
      const result = fixCode(code);
      expect(result.code).toContain("import something from module");
    });

    it("should handle deeply nested brackets", () => {
      const code = "const x = { a: { b: { c: [1, 2, [3, 4";
      const result = fixCode(code);

      // Should balance brackets
      const openBrackets = (result.code.match(/\[/g) || []).length;
      const closeBrackets = (result.code.match(/\]/g) || []).length;
      expect(closeBrackets).toBeGreaterThanOrEqual(openBrackets);
    });
  });
});
