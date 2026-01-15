# Setting Up Nucleus for Claude Code

Nucleus is a stateful document analysis tool that saves 80%+ tokens compared to reading files directly. This guide explains how to make it available to Claude Code.

## Option 1: MCP Server (Recommended)

MCP servers run as persistent subprocesses, so they **do maintain state** between calls.

### Installation

```bash
# Install globally
npm install -g matryoshka-rlm

# Or use npx (no install needed)
npx matryoshka-rlm
```

### Configure Claude Code

Add to your Claude Code settings (per-project or global):

**Per-project** (`.claude/settings.json` in your project):
```json
{
  "mcpServers": {
    "nucleus": {
      "command": "npx",
      "args": ["matryoshka-rlm", "nucleus-mcp"]
    }
  }
}
```

**Global** (`~/.claude/settings.json`):
```json
{
  "mcpServers": {
    "nucleus": {
      "command": "nucleus-mcp",
      "args": []
    }
  }
}
```

### Available Tools

Once configured, Claude Code will see these tools:

| Tool | Purpose |
|------|---------|
| `nucleus_load` | Load a document for analysis |
| `nucleus_query` | Execute S-expression queries |
| `nucleus_bindings` | Show current variable state |
| `nucleus_reset` | Clear bindings |
| `nucleus_stats` | Get document statistics |
| `nucleus_help` | Command reference |

## Option 2: HTTP Server

Run Nucleus as a REST API server that Claude can call via curl/fetch.

```bash
# Start the server
npx matryoshka-rlm nucleus-http --port 3456

# Or with global install
nucleus-http --port 3456
```

Then add to your project's CLAUDE.md:

```markdown
## Document Analysis Tool

For large files (>500 lines), use the Nucleus HTTP server instead of reading directly:

```bash
# Load document
curl -X POST http://localhost:3456/load \
  -H "Content-Type: application/json" \
  -d '{"filePath": "./path/to/file.txt"}'

# Query
curl -X POST http://localhost:3456/query \
  -H "Content-Type: application/json" \
  -d '{"command": "(grep \"pattern\")"}'
```
```

## Option 3: Project Instructions (CLAUDE.md)

Add instructions to your project's CLAUDE.md to tell Claude when to use the tool:

```markdown
## Large File Analysis

When analyzing files larger than 500 lines, use the Nucleus tool instead of reading the file directly. This saves ~80% of tokens.

### Quick Start
```typescript
import { PipeAdapter } from "matryoshka-rlm/tool";

const nucleus = new PipeAdapter();
await nucleus.executeCommand({ type: "load", filePath: "./large-file.txt" });

// Search
const result = await nucleus.executeCommand({
  type: "query",
  command: '(grep "pattern")'
});

// Results persist - chain operations
await nucleus.executeCommand({ type: "query", command: "(count RESULTS)" });
```

### When to Use
- Files >500 lines
- Multiple searches on same file
- Extracting/aggregating structured data
- Exploratory analysis

### When NOT to Use
- Small files (<100 lines)
- Single search
- Need full document context
```

## Why Nucleus Saves Tokens

| Operation | Traditional | Nucleus | Savings |
|-----------|-------------|---------|---------|
| Read 1000-line file | ~10,000 tokens | 0 | - |
| Search for pattern | 0 | ~50 tokens | - |
| View 10 results | 0 | ~200 tokens | - |
| **Total** | ~10,000 | ~250 | **97%** |

The document is loaded into Nucleus's memory (not the LLM context), so you only pay for the query and results, not the entire file.

## Query Language Quick Reference

```scheme
; Search
(grep "pattern")              ; Regex search
(lines 10 20)                 ; Get line range
(fuzzy_search "query" 10)     ; Fuzzy match

; Aggregate
(count RESULTS)               ; Count matches
(sum RESULTS)                 ; Sum numeric values

; Transform
(map RESULTS (lambda x (match x "regex" 1)))
(filter RESULTS (lambda x (match x "pattern" 0)))

; Parse
(parseInt str)                ; Parse integer
(parseCurrency "$1,234")      ; Parse money → 1234
```

## Troubleshooting

### "No document loaded"
Call `nucleus_load` before `nucleus_query`.

### State lost between calls
MCP servers maintain state. If using HTTP, ensure you're hitting the same server instance.

### Tool not appearing in Claude Code
1. Check MCP server config syntax
2. Restart Claude Code
3. Verify the command works: `npx matryoshka-rlm nucleus-mcp`
