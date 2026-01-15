#!/usr/bin/env node
/**
 * Nucleus MCP Server
 *
 * A stateful document analysis tool for LLM agents. Use this instead of reading
 * large files directly when you need to:
 * - Search for patterns in documents >500 lines
 * - Perform multiple searches on the same document
 * - Extract and aggregate structured data from text
 * - Explore a document iteratively without knowing what you're looking for
 *
 * TOKEN SAVINGS: This tool typically uses 80%+ fewer tokens than reading files
 * directly because it returns only matching lines, not the entire document.
 *
 * Usage:
 *   1. nucleus_load - Load a document (do this first)
 *   2. nucleus_query - Run queries using S-expression syntax
 *   3. Results persist in RESULTS variable for chaining
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { NucleusEngine } from "./engine/nucleus-engine.js";

// Single stateful engine instance (one document at a time)
let engine: NucleusEngine | null = null;
let currentDocument: string | null = null;

const TOOLS = [
  {
    name: "nucleus_load",
    description: `Load a document for analysis. Call this FIRST before querying.

USE THIS TOOL WHEN:
- Document is large (>500 lines) - saves 80%+ tokens vs reading directly
- You need to search for multiple patterns in the same document
- You're exploring and don't know exactly what you're looking for
- You need to extract/aggregate structured data (counts, sums, patterns)

DO NOT USE WHEN:
- Document is small (<100 lines) - just read it directly
- You only need one simple search
- You need to understand overall document structure

The document stays loaded until you load a different one.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description: "Path to the document to analyze",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "nucleus_query",
    description: `Execute a query on the loaded document using S-expression syntax.

COMMON PATTERNS:
- (grep "pattern") - Search for regex pattern, returns matching lines with line numbers
- (count RESULTS) - Count items from previous query
- (sum RESULTS) - Sum numeric values extracted from results
- (filter RESULTS (lambda x (match x "pattern" 0))) - Filter results
- (map RESULTS (lambda x (match x "regex" 1))) - Extract data from each result
- (lines 10 20) - Get specific line range

EXTRACTION EXAMPLES:
- Extract numbers: (map RESULTS (lambda x (parseInt (match x "(\\d+)" 1))))
- Extract currency: (map RESULTS (lambda x (parseCurrency (match x "\\$([\\d,]+)" 0))))
- Count by pattern: (grep "ERROR") then (count RESULTS)

Results are automatically bound to RESULTS for chaining queries.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: 'S-expression command, e.g., (grep "ERROR") or (count RESULTS)',
        },
      },
      required: ["command"],
    },
  },
  {
    name: "nucleus_bindings",
    description:
      "Show current variable bindings (RESULTS, _1, _2, etc). " +
      "Use this to see what data is available from previous queries.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "nucleus_reset",
    description:
      "Reset all variable bindings. Use this to start fresh analysis on the same document.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "nucleus_stats",
    description: "Get statistics about the currently loaded document (line count, size, etc).",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "nucleus_help",
    description:
      "Get complete reference documentation for all Nucleus commands and syntax.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

function formatResult(result: { success: boolean; value?: unknown; error?: string; logs: string[] }): string {
  if (!result.success) {
    return `Error: ${result.error}`;
  }

  const value = result.value;

  if (Array.isArray(value)) {
    const preview = value.slice(0, 20).map((item) => {
      if (typeof item === "object" && item !== null && "line" in item) {
        const gr = item as { line: string; lineNum: number };
        return `[${gr.lineNum}] ${gr.line.slice(0, 100)}`;
      }
      return JSON.stringify(item).slice(0, 100);
    });

    let text = `Found ${value.length} results:\n${preview.join("\n")}`;
    if (value.length > 20) {
      text += `\n... and ${value.length - 20} more`;
    }
    text += "\n\nResults bound to RESULTS. Chain with (filter RESULTS ...), (count RESULTS), (map RESULTS ...), etc.";
    return text;
  }

  if (typeof value === "number") {
    return `Result: ${value.toLocaleString()}`;
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  try {
    switch (name) {
      case "nucleus_load": {
        const filePath = args.filePath as string;
        if (!filePath) {
          return { content: [{ type: "text", text: "Error: filePath is required" }] };
        }

        engine = new NucleusEngine();
        await engine.loadFile(filePath);
        currentDocument = filePath;

        const stats = engine.getStats();
        return {
          content: [{
            type: "text",
            text: `Loaded ${filePath}:\n` +
              `  Lines: ${stats?.lineCount.toLocaleString()}\n` +
              `  Size: ${stats?.length.toLocaleString()} characters\n\n` +
              `Ready for queries. Try:\n` +
              `  (grep "pattern") - Search for pattern\n` +
              `  (text_stats) - Get document statistics\n` +
              `  (lines 1 10) - Get first 10 lines`,
          }],
        };
      }

      case "nucleus_query": {
        if (!engine || !engine.isLoaded()) {
          return {
            content: [{
              type: "text",
              text: "Error: No document loaded. Use nucleus_load first.",
            }],
          };
        }

        const command = args.command as string;
        if (!command) {
          return { content: [{ type: "text", text: "Error: command is required" }] };
        }

        const result = engine.execute(command);
        return { content: [{ type: "text", text: formatResult(result) }] };
      }

      case "nucleus_bindings": {
        if (!engine) {
          return { content: [{ type: "text", text: "No bindings (no document loaded)" }] };
        }

        const bindings = engine.getBindings();
        if (Object.keys(bindings).length === 0) {
          return { content: [{ type: "text", text: "No bindings yet. Run a query first." }] };
        }

        const lines = Object.entries(bindings).map(([k, v]) => `  ${k}: ${v}`);
        return {
          content: [{
            type: "text",
            text: `Current bindings:\n${lines.join("\n")}`,
          }],
        };
      }

      case "nucleus_reset": {
        if (engine) {
          engine.reset();
        }
        return { content: [{ type: "text", text: "Bindings reset. Document still loaded." }] };
      }

      case "nucleus_stats": {
        if (!engine || !engine.isLoaded()) {
          return { content: [{ type: "text", text: "No document loaded." }] };
        }

        const stats = engine.getStats();
        return {
          content: [{
            type: "text",
            text: `Document: ${currentDocument}\n` +
              `  Lines: ${stats?.lineCount.toLocaleString()}\n` +
              `  Size: ${stats?.length.toLocaleString()} characters`,
          }],
        };
      }

      case "nucleus_help": {
        return {
          content: [{ type: "text", text: NucleusEngine.getCommandReference() }],
        };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Error: ${message}` }] };
  }
}

async function main() {
  const server = new Server(
    {
      name: "nucleus",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, (args as Record<string, unknown>) || {});
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Nucleus MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
