# Recursive Exploration: A Demonstration

This document explains the `scattered-data.txt` test case and how it illustrates the core advantage of the Recursive Language Model (RLM) approach.

## The Problem with Traditional LLMs

When you ask a traditional LLM to analyze a document, you typically:

1. Paste the entire document into the prompt
2. Ask your question
3. Get a single response

This approach has significant limitations:

- **Context window limits**: Large documents may not fit
- **Attention degradation**: Information in the middle of long contexts is often missed
- **Hallucination risk**: The model may fabricate plausible-sounding data rather than accurately extracting it
- **No verification**: There's no way to confirm the model actually found the data

## The Test Case

Our test uses `scattered-data.txt`, a ~4,700 character sales report with data deliberately scattered throughout:

```
## North Region Performance
...lots of text...
SALES_DATA_NORTH: $2,340,000
...more text...

## South Region Performance
...lots of text...
SALES_DATA_SOUTH: $3,120,000
...more text...

(and so on for East, West, Central regions)
```

**Query**: "What is the total sales amount across all regions? List each region's sales and calculate the sum."

## What Happens Without RLM

When we initially tested with a standard prompt, the model:

1. Attempted to answer immediately (Turn 1)
2. **Hallucinated completely wrong numbers**:
   - Claimed North: $125,430 (actual: $2,340,000)
   - Claimed South: $98,750 (actual: $3,120,000)
   - Claimed Total: $480,490 (actual: $13,000,000)

The model invented plausible-looking data rather than actually finding it.

## What Happens With RLM

With the recursive approach, the model must execute code to access the document:

### Turn 1: Initial Exploration
```javascript
const stats = text_stats();
console.log("Document statistics:", stats);
const salesMatches = fuzzy_search("sales", 10);
```

The model learns the document structure and finds sales-related lines.

### Turn 2-3: Targeted Search
```javascript
const salesSearch = fuzzy_search("SALES_DATA", 10);
salesSearch.forEach((match) => {
    console.log(`Line ${match.lineNum}: ${match.line}`);
});
```

Output reveals the actual data:
```
Line 20: SALES_DATA_NORTH: $2,340,000
Line 45: SALES_DATA_SOUTH: $3,120,000
Line 65: SALES_DATA_EAST: $2,890,000
Line 85: SALES_DATA_WEST: $2,670,000
Line 108: SALES_DATA_CENTRAL: $1,980,000
```

### Turn 4-5: Verification and Answer

The model sees the actual execution results and provides the correct answer:

```
Total Sales: $13,000,000

- NORTH: $2,340,000
- SOUTH: $3,120,000
- EAST: $2,890,000
- WEST: $2,670,000
- CENTRAL: $1,980,000
```

## Why This Matters

```
┌─────────────────────────────────────────────────────────────┐
│                    Traditional LLM                          │
├─────────────────────────────────────────────────────────────┤
│  Document ──────────────► LLM ──────────────► Answer        │
│                           │                                 │
│                     (single pass,                           │
│                      may hallucinate)                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Recursive LLM                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Document ◄───► Sandbox ◄───► LLM                           │
│                    │           │                            │
│              (code exec)  (multiple turns)                  │
│                    │           │                            │
│                    └─────┬─────┘                            │
│                          ▼                                  │
│                   Verified Answer                           │
└─────────────────────────────────────────────────────────────┘
```

### Key Advantages

| Aspect | Traditional | Recursive |
|--------|-------------|-----------|
| Data Access | Hope model remembers | Explicit code execution |
| Verification | None | See actual search results |
| Hallucination | High risk | Mitigated by execution feedback |
| Large Documents | Context limits | Iterative exploration |
| Transparency | Black box | Visible reasoning steps |

## Running the Test

```bash
# Run with verbose output to see the exploration process
npx tsx src/index.ts \
  "What is the total sales amount across all regions?" \
  ./test-fixtures/scattered-data.txt \
  --verbose
```

## Conclusion

The recursive approach forces the model to:

1. **Explore before answering** - No shortcuts or guessing
2. **Show its work** - Each code execution is visible
3. **Ground answers in data** - Results come from actual document content
4. **Self-correct** - Errors in code execution provide feedback for retry

This transforms the LLM from a pattern-matching oracle into a reasoning agent that must verify its claims against actual data.
