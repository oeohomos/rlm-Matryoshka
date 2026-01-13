/**
 * UTCP Tool Registration for RLM
 *
 * Defines the tools available in the sandbox and generates
 * TypeScript interfaces for the LLM to understand.
 */

export interface ToolParameter {
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  optional?: boolean;
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, ToolParameter>;
    required: string[];
  };
  returns?: {
    type: string;
    description: string;
  };
}

export interface ToolRegistry {
  name: string;
  version: string;
  tools: Tool[];
}

/**
 * Create the RLM tool registry with all available tools
 */
export function createToolRegistry(): ToolRegistry {
  return {
    name: "rlm",
    version: "1.0.0",
    tools: [
      {
        name: "llm_query",
        description:
          "Query a sub-LLM to process a chunk of text. Expensive operation - batch related information when possible to minimize calls. Use format: 'json' for structured data extraction.",
        parameters: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The prompt to send to the sub-LLM for processing",
            },
            options: {
              type: "object",
              description: "Optional settings: { format: 'json' | 'text' }. Use 'json' to force structured JSON output.",
              optional: true,
            },
          },
          required: ["prompt"],
        },
        returns: {
          type: "Promise<string>",
          description: "The sub-LLM's response text (or JSON string if format: 'json')",
        },
      },
      {
        name: "batch_llm_query",
        description:
          "Execute multiple LLM queries in parallel. Much faster than sequential llm_query calls when you need to process multiple chunks or sections. All prompts are sent simultaneously.",
        parameters: {
          type: "object",
          properties: {
            prompts: {
              type: "array",
              description: "Array of prompt strings to execute in parallel",
            },
            options: {
              type: "object",
              description: "Optional settings: { format: 'json' | 'text' }. Applied to all prompts.",
              optional: true,
            },
          },
          required: ["prompts"],
        },
        returns: {
          type: "Promise<string[]>",
          description: "Array of responses in the same order as the input prompts",
        },
      },
      {
        name: "text_stats",
        description:
          "Get document metadata WITHOUT reading tokens: length, line count, and 5-line samples from start/middle/end. Use this first to understand document structure.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
        returns: {
          type: "{ length: number; lineCount: number; sample: { start: string; middle: string; end: string } }",
          description: "Document statistics and preview samples",
        },
      },
      {
        name: "fuzzy_search",
        description:
          "Find approximate keyword matches using fuzzy string matching. Returns matching lines with line numbers and match scores (lower score = better match).",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search term (supports approximate/fuzzy matching)",
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return",
              optional: true,
            },
          },
          required: ["query"],
        },
        returns: {
          type: "Array<{ line: string; lineNum: number; score: number }>",
          description:
            "Matching lines with line numbers and match scores (0 = exact match)",
        },
      },
      {
        name: "context.slice",
        description:
          "Get a portion of the context by character indices. Use sparingly - prefer fuzzy_search to find relevant sections first.",
        parameters: {
          type: "object",
          properties: {
            start: {
              type: "number",
              description: "Start character index (0-based)",
            },
            end: {
              type: "number",
              description: "End character index (exclusive)",
            },
          },
          required: ["start", "end"],
        },
        returns: {
          type: "string",
          description: "The substring of context between start and end",
        },
      },
      {
        name: "context.match",
        description:
          "Search context with a regular expression. Returns all matches.",
        parameters: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description:
                'Regex pattern as string (e.g., "keyword" or "\\\\d+" for digits)',
            },
            flags: {
              type: "string",
              description: 'Regex flags (e.g., "gi" for global case-insensitive)',
              optional: true,
            },
          },
          required: ["pattern"],
        },
        returns: {
          type: "string[] | null",
          description: "Array of matches or null if no matches",
        },
      },
      {
        name: "grep",
        description:
          "Fast regex search with line numbers. More efficient than context.match for finding specific patterns. Returns matches with line numbers and character indices.",
        parameters: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "Regex pattern to search for",
            },
            flags: {
              type: "string",
              description:
                'Regex flags (g and m are included by default for global multiline search)',
              optional: true,
            },
          },
          required: ["pattern"],
        },
        returns: {
          type: "Array<{ match: string; lineNum: number; index: number; groups: string[] }>",
          description:
            "Matches with line numbers (1-based), character index, and capture groups",
        },
      },
      {
        name: "count_tokens",
        description:
          "Estimate the token count of text. Useful for checking if a section will fit in an LLM call. Uses word-based heuristics (most words = 1 token).",
        parameters: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "Text to count tokens for (defaults to full context if omitted)",
              optional: true,
            },
          },
          required: [],
        },
        returns: {
          type: "number",
          description: "Estimated token count",
        },
      },
      {
        name: "locate_line",
        description:
          "Extract lines by line number (1-based). More precise than slice() for line-based navigation. Supports negative indices to count from end.",
        parameters: {
          type: "object",
          properties: {
            start: {
              type: "number",
              description: "Start line number (1-based, or negative to count from end)",
            },
            end: {
              type: "number",
              description: "End line number (inclusive, defaults to start for single line)",
              optional: true,
            },
          },
          required: ["start"],
        },
        returns: {
          type: "string",
          description: "The extracted lines joined with newlines",
        },
      },
    ],
  };
}

/**
 * Generate TypeScript interface definitions for all tools
 * This is injected into the system prompt so the LLM knows what's available
 */
export function getToolInterfaces(registry: ToolRegistry): string {
  const lines: string[] = [
    "// Available Tools in Sandbox",
    "// These are pre-defined and available globally",
    "",
  ];

  for (const tool of registry.tools) {
    // Generate JSDoc comment
    lines.push(`/**`);
    lines.push(` * ${tool.description}`);

    // Add parameter descriptions
    for (const [paramName, param] of Object.entries(
      tool.parameters.properties
    )) {
      const optional = param.optional ? " (optional)" : "";
      lines.push(` * @param ${paramName} - ${param.description}${optional}`);
    }

    if (tool.returns) {
      lines.push(` * @returns ${tool.returns.description}`);
    }

    lines.push(` */`);

    // Generate function signature
    const params = Object.entries(tool.parameters.properties)
      .map(([name, param]) => {
        const optional = param.optional ? "?" : "";
        return `${name}${optional}: ${mapTypeToTS(param.type)}`;
      })
      .join(", ");

    const returnType = tool.returns?.type || "void";
    const funcName = tool.name.replaceAll(".", "_"); // context.slice -> context_slice for valid TS

    if (tool.name.startsWith("context.")) {
      // These are methods on the context string
      lines.push(`// Use as: context.${tool.name.split(".")[1]}(...)`);
    }

    lines.push(`declare function ${funcName}(${params}): ${returnType};`);
    lines.push("");
  }

  // Add built-in variables
  lines.push("// Built-in Variables");
  lines.push("/** The full document text (read-only) */");
  lines.push("declare const context: string;");
  lines.push("");
  lines.push("/** Persistent memory buffer - use to accumulate findings */");
  lines.push("declare let memory: unknown[];");
  lines.push("");
  lines.push("/** Standard console for logging (captured in output) */");
  lines.push(
    "declare const console: { log: (...args: unknown[]) => void; error: (...args: unknown[]) => void; warn: (...args: unknown[]) => void };"
  );

  return lines.join("\n");
}

/**
 * Map JSON Schema types to TypeScript types
 */
function mapTypeToTS(type: string): string {
  switch (type) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "object";
    case "array":
      return "unknown[]";
    default:
      return "unknown";
  }
}

/**
 * Get a tool by name from the registry
 */
export function getTool(
  registry: ToolRegistry,
  toolName: string
): Tool | undefined {
  return registry.tools.find((t) => t.name === toolName);
}

/**
 * Validate that all required tools are present
 */
export function validateRegistry(registry: ToolRegistry): {
  valid: boolean;
  missing: string[];
} {
  const requiredTools = [
    "llm_query",
    "text_stats",
    "fuzzy_search",
    "context.slice",
    "context.match",
  ];

  const missing = requiredTools.filter(
    (name) => !registry.tools.some((t) => t.name === name)
  );

  return {
    valid: missing.length === 0,
    missing,
  };
}
