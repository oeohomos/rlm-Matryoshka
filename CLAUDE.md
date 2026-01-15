# Claude Code Guidelines for recursive-language-model

## CRITICAL: No Hardcoding

**DO NOT hardcode specific use cases into the prompts or code.**

This is a GENERAL-PURPOSE document analysis tool. It can be used for:
- Log analysis
- Financial documents
- Scientific data
- Weather reports
- Any structured or semi-structured text

When writing prompts or examples:
- Use GENERIC patterns, not domain-specific ones
- Say "data" not "sales data"
- Say "values" not "currency values"
- Say "pattern" not "$1,000"
- Let the LLM discover the actual data format from the document

**Bad examples (too specific):**
```javascript
const hits = grep("SALES_DATA");
const extractor = synthesize_extractor([
  { input: "$1,000", output: 1000 }
]);
```

**Good examples (generic):**
```javascript
const hits = grep("YOUR_PATTERN");
const extractor = synthesize_extractor([
  { input: examples[0], output: expectedOutput0 }
]);
```

## Architecture Overview

- **RLM Loop** (`src/rlm.ts`): Main execution loop
- **Adapters** (`src/adapters/`): Model-specific prompting
- **Synthesis** (`src/synthesis/`): miniKanren-based program synthesis
- **Sandbox** (`src/synthesis/sandbox-tools.ts`): Safe code execution

## Key Principle: Barliman-Style Synthesis

The LLM provides CONSTRAINTS (input/output examples), NOT code implementations.
The synthesizer builds programs automatically from examples.

## Using Nucleus for Large File Analysis

When you need to analyze files larger than ~500 lines, use the Nucleus tool instead of reading files directly. This saves 80%+ tokens.

### When to Use Nucleus
- File is >500 lines
- You need multiple searches on the same file
- You're extracting or aggregating structured data
- Exploratory analysis (don't know what you're looking for)

### When NOT to Use
- File is <100 lines (just read it)
- You only need one search
- You need full document context/structure

### Quick Start (Programmatic)
```typescript
import { PipeAdapter } from "./src/tool/adapters/pipe.ts";

const nucleus = new PipeAdapter();
await nucleus.executeCommand({ type: "load", filePath: "./large-file.txt" });

// Search - returns only matching lines
const result = await nucleus.executeCommand({
  type: "query",
  command: '(grep "pattern")'
});

// Chain operations - RESULTS persists
await nucleus.executeCommand({ type: "query", command: "(count RESULTS)" });
await nucleus.executeCommand({ type: "query", command: "(sum RESULTS)" });
```

### Common Queries
```scheme
(grep "pattern")                    ; Search for regex pattern
(count RESULTS)                     ; Count matches
(sum RESULTS)                       ; Sum numeric values
(map RESULTS (lambda x (match x "regex" 1)))  ; Extract data
(filter RESULTS (lambda x (match x "pat" 0))) ; Filter results
(lines 10 20)                       ; Get specific line range
```

### HTTP Server Option
```bash
# Start server
npx tsx src/tool/adapters/http.ts --port 3456

# Load document
curl -X POST http://localhost:3456/load -d '{"filePath":"./file.txt"}'

# Query
curl -X POST http://localhost:3456/query -d '{"command":"(grep \"ERROR\")"}'
```
