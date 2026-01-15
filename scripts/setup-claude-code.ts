#!/usr/bin/env node
/**
 * Setup script for Claude Code integration
 *
 * Run this to get configuration instructions for your environment.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");

console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                    Nucleus - Claude Code Setup                     ║
╚═══════════════════════════════════════════════════════════════════╝

Nucleus is a stateful document analysis tool that saves 80%+ tokens
when analyzing large files.

`);

// Check if running from global install or local
const isGlobalInstall = !process.argv[1]?.includes("node_modules");

if (isGlobalInstall) {
  console.log("✓ Running from global installation\n");
} else {
  console.log("Running from local installation\n");
  console.log("For global access, run: npm install -g matryoshka-rlm\n");
}

console.log("═══════════════════════════════════════════════════════════════════");
console.log("OPTION 1: MCP Server Configuration (Recommended)");
console.log("═══════════════════════════════════════════════════════════════════\n");

console.log("Add to your Claude Code settings:\n");

const mcpConfig = {
  mcpServers: {
    nucleus: {
      command: "nucleus-mcp",
      args: []
    }
  }
};

console.log("For ~/.claude/settings.json (global):");
console.log("```json");
console.log(JSON.stringify(mcpConfig, null, 2));
console.log("```\n");

console.log("Or for .claude/settings.json in your project (per-project):");
console.log("```json");
console.log(JSON.stringify(mcpConfig, null, 2));
console.log("```\n");

// Check if settings file exists
if (fs.existsSync(CLAUDE_SETTINGS_PATH)) {
  console.log(`Found existing settings at: ${CLAUDE_SETTINGS_PATH}`);
  console.log("You can manually add the mcpServers configuration above.\n");
}

console.log("═══════════════════════════════════════════════════════════════════");
console.log("OPTION 2: HTTP Server");
console.log("═══════════════════════════════════════════════════════════════════\n");

console.log("Start the HTTP server:");
console.log("  nucleus-http --port 3456\n");

console.log("Then use from any HTTP client:");
console.log(`  curl -X POST http://localhost:3456/load \\
    -H "Content-Type: application/json" \\
    -d '{"filePath": "./your-file.txt"}'

  curl -X POST http://localhost:3456/query \\
    -H "Content-Type: application/json" \\
    -d '{"command": "(grep \\"pattern\\")"}'
`);

console.log("═══════════════════════════════════════════════════════════════════");
console.log("OPTION 3: Project Instructions (CLAUDE.md)");
console.log("═══════════════════════════════════════════════════════════════════\n");

console.log("Add to your project's CLAUDE.md:\n");

console.log(`\`\`\`markdown
## Large File Analysis

For files >500 lines, use the Nucleus tool to save tokens:

\\\`\\\`\\\`typescript
import { PipeAdapter } from "matryoshka-rlm/tool";

const nucleus = new PipeAdapter();
await nucleus.executeCommand({ type: "load", filePath: "./file.txt" });
const result = await nucleus.executeCommand({
  type: "query",
  command: '(grep "pattern")'
});
\\\`\\\`\\\`

Common queries:
- (grep "pattern") - Search for regex
- (count RESULTS) - Count matches
- (sum RESULTS) - Sum numeric values
- (map RESULTS (lambda x (match x "regex" 1))) - Extract data
\`\`\`
`);

console.log("═══════════════════════════════════════════════════════════════════");
console.log("QUICK TEST");
console.log("═══════════════════════════════════════════════════════════════════\n");

console.log("Test the installation:");
console.log("  nucleus-mcp    # Should start MCP server (Ctrl+C to exit)");
console.log("  nucleus-http   # Should start HTTP server");
console.log("  nucleus-repl   # Interactive REPL\n");

console.log("═══════════════════════════════════════════════════════════════════");
console.log("AVAILABLE COMMANDS");
console.log("═══════════════════════════════════════════════════════════════════\n");

console.log("  nucleus-mcp    - MCP server for Claude Code integration");
console.log("  nucleus-http   - HTTP REST API server");
console.log("  nucleus-pipe   - Pipe-based subprocess control");
console.log("  nucleus-repl   - Interactive command-line REPL\n");

console.log("For more information, see:");
console.log("  https://github.com/yogthos/Matryoshka#nucleus-tool\n");
