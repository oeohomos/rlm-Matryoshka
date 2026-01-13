import { describe, it, expect } from "vitest";
import {
  createToolRegistry,
  getToolInterfaces,
  getTool,
  validateRegistry,
  ToolRegistry,
} from "../src/tools.js";

describe("UTCP Tool Registration", () => {
  describe("createToolRegistry", () => {
    it("should create a registry with RLM tools", () => {
      const registry = createToolRegistry();
      expect(registry.tools.length).toBe(9);
      expect(registry.name).toBe("rlm");
      expect(registry.version).toBe("1.0.0");
    });

    it("should include llm_query tool", () => {
      const registry = createToolRegistry();
      const tool = registry.tools.find((t) => t.name === "llm_query");
      expect(tool).toBeDefined();
      expect(tool?.description).toContain("sub-LLM");
      expect(tool?.parameters.required).toContain("prompt");
    });

    it("should include text_stats tool", () => {
      const registry = createToolRegistry();
      const tool = registry.tools.find((t) => t.name === "text_stats");
      expect(tool).toBeDefined();
      expect(tool?.description).toContain("metadata");
      expect(tool?.parameters.required).toEqual([]);
    });

    it("should include fuzzy_search tool", () => {
      const registry = createToolRegistry();
      const tool = registry.tools.find((t) => t.name === "fuzzy_search");
      expect(tool).toBeDefined();
      expect(tool?.parameters.properties).toHaveProperty("query");
      expect(tool?.parameters.properties).toHaveProperty("limit");
      expect(tool?.parameters.required).toContain("query");
      expect(tool?.parameters.required).not.toContain("limit");
    });

    it("should include context.slice tool", () => {
      const registry = createToolRegistry();
      const tool = registry.tools.find((t) => t.name === "context.slice");
      expect(tool).toBeDefined();
      expect(tool?.parameters.properties).toHaveProperty("start");
      expect(tool?.parameters.properties).toHaveProperty("end");
    });

    it("should include context.match tool", () => {
      const registry = createToolRegistry();
      const tool = registry.tools.find((t) => t.name === "context.match");
      expect(tool).toBeDefined();
      expect(tool?.parameters.properties).toHaveProperty("pattern");
    });
  });

  describe("getToolInterfaces", () => {
    it("should generate TypeScript interface string", () => {
      const registry = createToolRegistry();
      const interfaces = getToolInterfaces(registry);

      expect(interfaces).toContain("llm_query");
      expect(interfaces).toContain("text_stats");
      expect(interfaces).toContain("fuzzy_search");
    });

    it("should include parameter types", () => {
      const registry = createToolRegistry();
      const interfaces = getToolInterfaces(registry);

      expect(interfaces).toContain("prompt: string");
      expect(interfaces).toContain("query: string");
      expect(interfaces).toContain("limit?: number");
    });

    it("should include return type hints", () => {
      const registry = createToolRegistry();
      const interfaces = getToolInterfaces(registry);

      expect(interfaces).toContain("Promise<string>"); // llm_query
      expect(interfaces).toContain("lineCount: number"); // text_stats
    });

    it("should include JSDoc comments", () => {
      const registry = createToolRegistry();
      const interfaces = getToolInterfaces(registry);

      expect(interfaces).toContain("/**");
      expect(interfaces).toContain("@param");
      expect(interfaces).toContain("@returns");
    });

    it("should include built-in variables", () => {
      const registry = createToolRegistry();
      const interfaces = getToolInterfaces(registry);

      expect(interfaces).toContain("declare const context: string");
      expect(interfaces).toContain("declare let memory: unknown[]");
      expect(interfaces).toContain("declare const console");
    });

    it("should generate valid declare statements", () => {
      const registry = createToolRegistry();
      const interfaces = getToolInterfaces(registry);

      expect(interfaces).toContain("declare function llm_query");
      expect(interfaces).toContain("declare function text_stats");
      expect(interfaces).toContain("declare function fuzzy_search");
    });
  });

  describe("tool schemas", () => {
    it("should have valid JSON Schema for each tool", () => {
      const registry = createToolRegistry();

      for (const tool of registry.tools) {
        expect(tool.parameters).toHaveProperty("type", "object");
        expect(tool.parameters).toHaveProperty("properties");
        expect(tool.parameters).toHaveProperty("required");
        expect(Array.isArray(tool.parameters.required)).toBe(true);
      }
    });

    it("should mark required parameters correctly", () => {
      const registry = createToolRegistry();
      const fuzzySearch = registry.tools.find(
        (t) => t.name === "fuzzy_search"
      );

      expect(fuzzySearch?.parameters.required).toContain("query");
      expect(fuzzySearch?.parameters.required).not.toContain("limit");
    });

    it("should mark optional parameters with optional flag", () => {
      const registry = createToolRegistry();
      const fuzzySearch = registry.tools.find(
        (t) => t.name === "fuzzy_search"
      );

      expect(fuzzySearch?.parameters.properties.limit.optional).toBe(true);
      expect(
        fuzzySearch?.parameters.properties.query.optional
      ).toBeUndefined();
    });

    it("should have return types for all tools", () => {
      const registry = createToolRegistry();

      for (const tool of registry.tools) {
        expect(tool.returns).toBeDefined();
        expect(tool.returns?.type).toBeDefined();
        expect(tool.returns?.description).toBeDefined();
      }
    });
  });

  describe("getTool", () => {
    it("should find tool by name", () => {
      const registry = createToolRegistry();
      const tool = getTool(registry, "llm_query");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("llm_query");
    });

    it("should return undefined for unknown tool", () => {
      const registry = createToolRegistry();
      const tool = getTool(registry, "unknown_tool");

      expect(tool).toBeUndefined();
    });

    it("should find tools with dot notation names", () => {
      const registry = createToolRegistry();
      const tool = getTool(registry, "context.slice");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("context.slice");
    });
  });

  describe("validateRegistry", () => {
    it("should validate a complete registry", () => {
      const registry = createToolRegistry();
      const result = validateRegistry(registry);

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it("should detect missing tools", () => {
      const incompleteRegistry: ToolRegistry = {
        name: "test",
        version: "1.0.0",
        tools: [
          {
            name: "llm_query",
            description: "test",
            parameters: { type: "object", properties: {}, required: [] },
          },
        ],
      };

      const result = validateRegistry(incompleteRegistry);

      expect(result.valid).toBe(false);
      expect(result.missing).toContain("text_stats");
      expect(result.missing).toContain("fuzzy_search");
      expect(result.missing).toContain("context.slice");
      expect(result.missing).toContain("context.match");
    });

    it("should return valid for registry with all required tools", () => {
      const registry = createToolRegistry();
      const { valid } = validateRegistry(registry);

      expect(valid).toBe(true);
    });
  });

  describe("tool descriptions", () => {
    it("should have meaningful descriptions for all tools", () => {
      const registry = createToolRegistry();

      for (const tool of registry.tools) {
        expect(tool.description.length).toBeGreaterThan(20);
      }
    });

    it("should warn about expensive operations in llm_query", () => {
      const registry = createToolRegistry();
      const tool = getTool(registry, "llm_query");

      expect(tool?.description.toLowerCase()).toMatch(/expensive|batch|minimize/);
    });

    it("should recommend text_stats for exploration", () => {
      const registry = createToolRegistry();
      const tool = getTool(registry, "text_stats");

      expect(tool?.description.toLowerCase()).toMatch(/first|without|metadata/);
    });

    it("should describe fuzzy matching capability", () => {
      const registry = createToolRegistry();
      const tool = getTool(registry, "fuzzy_search");

      expect(tool?.description.toLowerCase()).toMatch(/fuzzy|approximate/);
    });
  });

  describe("parameter descriptions", () => {
    it("should have descriptions for all parameters", () => {
      const registry = createToolRegistry();

      for (const tool of registry.tools) {
        for (const [paramName, param] of Object.entries(
          tool.parameters.properties
        )) {
          expect(param.description).toBeDefined();
          expect(param.description.length).toBeGreaterThan(5);
        }
      }
    });

    it("should have valid types for all parameters", () => {
      const registry = createToolRegistry();
      const validTypes = ["string", "number", "boolean", "object", "array"];

      for (const tool of registry.tools) {
        for (const param of Object.values(tool.parameters.properties)) {
          expect(validTypes).toContain(param.type);
        }
      }
    });
  });
});
