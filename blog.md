# Nucleus: A Stateful Document Analysis Tool for LLM Agents

When working with LLM agents like Claude, one of the biggest challenges is efficient document analysis. Reading a 1000-line source file consumes roughly 10,000 tokens of context—and if you need to search for multiple patterns, you're either re-reading the entire file each time or trying to hold everything in memory.

This post introduces **Nucleus**, a stateful document analysis tool that dramatically reduces token consumption while enabling interactive, exploratory document analysis.

## The Problem: Token-Hungry Document Analysis

Consider a typical code analysis task: "Find all error handling patterns in this codebase."

**Traditional approach:**
1. Read the entire file into context (~10,000 tokens for a 1000-line file)
2. Ask the LLM to find patterns
3. For follow-up questions, either re-read the file or hope it's still in context

**With a 40,000 character source file, this costs ~10,000 tokens just for loading.**

Worse, if you're exploring—not quite sure what you're looking for—you might need several passes through the same document, multiplying the token cost.

## The Solution: Stateful, Incremental Queries

Nucleus takes a different approach:

1. **Load once**: The document is loaded into the tool's memory (outside the LLM context)
2. **Query incrementally**: Each search returns only matching lines with line numbers
3. **Chain operations**: Results persist across queries via automatic variable binding
4. **Pay only for what you need**: A grep returning 4 matches costs ~100 tokens, not 10,000

Here's what this looks like in practice:

```javascript
// Load document (happens once, outside LLM context)
await tool.execute({ type: "load", filePath: "./src/rlm.ts" });
// → "Loaded rlm.ts: 1,089 lines, 40,272 chars"

// Find error handling patterns
await tool.execute({ type: "query", command: '(grep "catch")' });
// → Found 4 results (bound to RESULTS)
//   Line 246: } catch {
//   Line 263: } catch {
//   Line 454: } catch {
//   Line 569: } catch (err) {

// Count them
await tool.execute({ type: "query", command: "(count RESULTS)" });
// → Result: 4

// Search for something else - RESULTS updates automatically
await tool.execute({ type: "query", command: '(grep "throw")' });
// → Found 0 results (bound to RESULTS)
```

## Measured Token Savings

We benchmarked Nucleus against traditional file reading for a common task: finding all error handling patterns in a 1089-line TypeScript file.

| Approach | Tokens Required | Savings |
|----------|----------------|---------|
| Traditional (read full file) | ~10,068 | — |
| Nucleus (targeted queries) | ~1,745 | **83%** |

The savings come from:
- **Selective retrieval**: Only matching lines are returned
- **No re-reading**: Document stays loaded across queries
- **Compact results**: Line numbers + content, not full file structure

## Verification: Results Are Accurate

A tool is only useful if it's correct. We verified Nucleus against traditional Unix grep:

```
Test 1: Count 'catch' in src/rlm.ts
  grep -ci: 4
  Nucleus: 4
  ✓ MATCH

Test 2: Count '^import' (case-insensitive)
  grep -ci: 17
  Nucleus: 17
  ✓ MATCH

Test 3: Line number accuracy
  First match at line 246: "} catch {"
  Actual line 246: "} catch {"
  ✓ Content matches
```

Note: Nucleus uses case-insensitive matching by default (like most document analysis tools), so `grep "import"` will match both "import" and "IMPORTANT".

## The Query Language: S-Expressions

Nucleus uses a simple S-expression syntax for queries. This might seem unusual, but it has advantages:

1. **Unambiguous parsing**: No escaping issues with nested quotes
2. **Composable**: Operations chain naturally
3. **Familiar**: Anyone who's used Lisp or Clojure will feel at home

Core operations:

```scheme
; Search
(grep "pattern")              ; Regex search, returns matches with line numbers
(fuzzy_search "query" 10)     ; Fuzzy search, top N matches by score
(lines 10 20)                 ; Get lines in range (1-indexed)

; Collection operations
(count RESULTS)               ; Count items
(sum RESULTS)                 ; Sum numeric values
(filter RESULTS predicate)    ; Keep items matching predicate
(map RESULTS transform)       ; Transform each item
(reduce RESULTS init fn)      ; Generic reduce/fold

; Predicates & Lambdas
(lambda x (match x "pat" 0))  ; Regex match predicate
(classify "ex1" true "ex2" false)  ; Build classifier from examples

; String operations
(match str "pattern" group)   ; Extract regex group
(replace str "from" "to")     ; Replace pattern
(split str "delim" index)     ; Split and get part

; Type coercion
(parseInt str)                ; Parse to integer
(parseFloat str)              ; Parse to float
(parseCurrency str)           ; "$1,250.00" → 1250.00
(parseDate str)               ; Parse date to ISO format
```

## Beyond Simple Search: Complex Analysis

The real power of Nucleus comes from chaining operations. Here's a log analysis example:

```scheme
; Load server logs
(load "./server.log")

; 1. Find all errors and extract the error types
(grep "ERROR")
(map RESULTS (lambda x (match x "(\\w+)$" 1)))
; → ["db_timeout", "service_unavailable", "payment_failed"]

; 2. Count requests per endpoint
(grep "/api/users")
(count RESULTS)  ; → 3

(grep "/api/orders")
(count RESULTS)  ; → 2

; 3. Extract and analyze response times
(grep "\\d+ms")
(map RESULTS (lambda x (parseInt (match x "(\\d+)ms" 1))))
; → [45, 1250, 23, 890, 156, 2100, 12, 950, 3500, 34]

; 4. Parse currency values and sum them
(grep "\\$[0-9,]+")
(map RESULTS (lambda x (parseCurrency (match x "\\$([0-9,\\.]+)" 0))))
; → [1250, 89.99, 2500]
(sum RESULTS)  ; → 3839.99

; 5. Filter using lambda predicates
(grep "action=")
(filter RESULTS (lambda x (match x "shipped" 0)))
; → Only lines containing "shipped"
```

### Real-World Log Analysis

Here's what a complete log analysis session looks like:

```
Input: 10 log lines from a web server

Query                                    Result
─────────────────────────────────────────────────────────────
(grep "ERROR")                          → 3 errors found
(map RESULTS (lambda x (match x         → ["db_timeout",
  "(\\w+)$" 1)))                           "service_unavailable",
                                           "payment_failed"]

(grep " 200 ")                          → 6 successful requests
(grep " 500 ")                          → 2 server errors
(grep " 503 ")                          → 1 service unavailable

(grep "web-1")                          → 4 requests to web-1
(grep "web-2")                          → 3 requests to web-2
(grep "web-3")                          → 3 requests to web-3

(grep "\\d+ms")
(map RESULTS (lambda x (parseInt        → [45, 1250, 23, 890,
  (match x "(\\d+)ms" 1))))                156, 2100, 12, 950,
                                           3500, 34]
```

This analysis required **~20 queries** but consumed only **~2000 tokens** total. Reading the full logs into context would have cost significantly more, and wouldn't have provided the structured extraction capabilities.

## Three Ways to Integrate

Nucleus provides three adapters for different integration scenarios:

### 1. Pipe Adapter (Subprocess Control)

Best for scripted automation or REPL-style interaction:

```bash
# JSON mode - structured input/output
echo '{"type":"load","filePath":"./data.txt"}' | nucleus-pipe
echo '{"type":"query","command":"(grep \"error\")"}' | nucleus-pipe

# Interactive mode - human-friendly
nucleus-pipe -i
> :load ./logs.txt
> (grep "ERROR")
> (count RESULTS)
> :quit
```

### 2. HTTP Adapter (REST API)

Best for multi-client scenarios or long-running analysis sessions:

```bash
# Start server
nucleus-http --port 8080

# Use from any HTTP client
curl -X POST http://localhost:8080/load \
  -H "Content-Type: application/json" \
  -d '{"filePath": "./data.txt"}'

curl -X POST http://localhost:8080/query \
  -H "Content-Type: application/json" \
  -d '{"command": "(grep \"pattern\")"}'

curl http://localhost:8080/bindings  # See current state
```

### 3. Claude Code Adapter (MCP Tools)

Best for direct integration with Claude Code:

```typescript
import { ClaudeCodeAdapter } from "matryoshka-rlm/tool";

const adapter = new ClaudeCodeAdapter();

// Returns MCP-compatible tool definitions
const tools = adapter.getToolDefinitions();
// → nucleus_load, nucleus_query, nucleus_bindings,
//   nucleus_reset, nucleus_stats, nucleus_help

// Handle tool calls
const result = await adapter.callTool("nucleus_query", {
  command: '(grep "TODO")'
});
```

## Real-World Example: Code Investigation

Here's how an LLM agent might use Nucleus to investigate a codebase:

```
Question: "How does the RLM handle model adapters?"

Step 1: Load the main file
> (load "./src/rlm.ts")
→ Loaded: 1,089 lines

Step 2: Find adapter references
> (grep "adapter")
→ 31 matches

Step 3: Find the type definition
> (grep "ModelAdapter")
→ Line 15: import type { ModelAdapter...
→ Line 312: adapter?: ModelAdapter;

Step 4: Find where it's used
> (grep "adapter\\(")
→ Line 529: adapter = createNucleusAdapter(),

Step 5: Find the actual LLM invocation
> (grep "await llm")
→ Line 694: const response = await llmClient(prompt);
```

**Total tokens consumed: ~500** (queries + results)
**Traditional approach: ~10,000** (reading entire file)

The agent discovered the answer through incremental exploration, paying only for the information it actually needed.

## When to Use Nucleus

Nucleus excels at:

- **Large documents**: Logs, data files, lengthy source code
- **Exploratory analysis**: When you don't know exactly what you're looking for
- **Multi-step investigations**: Each query builds on previous results
- **Repeated queries**: Load once, query many times

It's less useful for:

- **Small files**: If a file fits comfortably in context, just read it
- **Full-text analysis**: When you need to understand overall structure, not find specific patterns
- **One-shot queries**: If you'll only query once, the loading overhead isn't worth it

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Adapters                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │   Pipe   │  │   HTTP   │  │   Claude Code    │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │             │                  │            │
│       └─────────────┴──────────────────┘            │
│                      │                               │
│              ┌───────┴───────┐                      │
│              │  NucleusTool  │                      │
│              │  (Stateful)   │                      │
│              └───────┬───────┘                      │
│                      │                               │
│              ┌───────┴───────┐                      │
│              │ NucleusEngine │                      │
│              │   (Parser +   │                      │
│              │    Solver)    │                      │
│              └───────────────┘                      │
└─────────────────────────────────────────────────────┘
```

The `NucleusTool` layer maintains state:
- Currently loaded document
- Variable bindings (RESULTS, _1, _2, etc.)
- Turn counter for history

The `NucleusEngine` handles parsing and execution of S-expression queries.

## Getting Started

Install from npm:

```bash
npm install matryoshka-rlm
```

Use programmatically:

```typescript
import { PipeAdapter } from "matryoshka-rlm/tool";

const adapter = new PipeAdapter();
await adapter.executeCommand({
  type: "load",
  filePath: "./your-document.txt"
});

const result = await adapter.executeCommand({
  type: "query",
  command: '(grep "your-pattern")'
});

console.log(result.data); // Array of matches with line numbers
```

Or run as a server:

```bash
npx nucleus-http --port 3456
```

## The Power of Composability

What makes Nucleus particularly powerful for LLM agents is **composability**. Instead of writing one complex query, you build up analysis step by step:

```scheme
; Step 1: Find all relevant lines
(grep "transaction")

; Step 2: Extract specific values
(map RESULTS (lambda x (parseCurrency (match x "\\$([0-9,]+)" 0))))

; Step 3: Aggregate
(sum RESULTS)
```

Each step produces a result that feeds into the next. The LLM can inspect intermediate results, adjust the approach, and build understanding incrementally—exactly how a human analyst would work.

This is fundamentally different from trying to write a single perfect query upfront. Exploration becomes cheap, and mistakes are easy to recover from.

## Future Directions

The current implementation covers the most common analysis patterns, but several enhancements could make Nucleus even more powerful:

- **groupBy**: Group results by extracted key (e.g., group errors by service)
- **sort**: Order results by extracted value
- **distinct**: Get unique values from a field
- **Statistical functions**: avg, median, percentile for numeric analysis
- **Time-based filtering**: Filter by date ranges, aggregate by time buckets
- **Join operations**: Combine results from multiple queries

The S-expression foundation makes these extensions straightforward to add while maintaining the composable, incremental query model.

## Conclusion

Nucleus demonstrates a simple but powerful principle: **don't pay for what you don't need**. By maintaining document state outside the LLM context and returning only relevant results, it achieves 80%+ token savings for document analysis tasks.

More importantly, it enables a different way of working with documents—incremental, exploratory, building understanding query by query rather than trying to absorb everything at once. The combination of search, transformation, and aggregation operations provides a complete toolkit for document analysis without ever loading the full document into the LLM's context.

The tool is open source and available as part of the [Matryoshka RLM project](https://github.com/yogthos/Matryoshka).
