# Matryoshka vs Official RLM Implementation

This document compares Matryoshka with the [official RLM implementation](https://github.com/alexzhang13/rlm) by Alex Zhang et al. from MIT OASYS lab.

## Overview

| Aspect | Official RLM | Matryoshka |
|--------|-------------|------------|
| **Language** | Python | TypeScript |
| **Code Execution** | Arbitrary Python via `exec` | Nucleus DSL (constrained S-expressions) |
| **Sandbox** | Local/Docker/Modal/Prime | Built-in safe interpreter |
| **Complexity** | ~2000 lines core | ~15000+ lines |
| **Primary Use Case** | General-purpose | Document analysis |

## Core Architecture Differences

### 1. Code Execution Model

**Official RLM**: LLM generates arbitrary Python code

```python
# LLM output in official RLM
```repl
chunk = context[:10000]
answer = llm_query(f"What is the magic number? {chunk}")
```

**Matryoshka**: LLM outputs constrained Nucleus DSL

```scheme
(grep "pattern")
(filter RESULTS (lambda x (match x "regex" 0)))
(count RESULTS)
```

**Why this matters**:
- Nucleus has lower entropy, stricter grammar → small models (7B) generate correct code more easily
- Fail-fast validation: parser rejects malformed commands before execution
- Safer: only known operations, no arbitrary code execution

### 2. Token Efficiency

**Official RLM**: Returns full data directly to LLM

```python
# LLM sees full array
results = [line1, line2, ..., line1000]  # 15000 tokens
```

**Matryoshka**: Handle-based storage (97% token savings)

```
$res1: Array(1000) [preview of first 3 items...]  # 50 tokens
```

LLM only sees compact stubs; server-side executes filter/map/count/sum operations.

### 3. Program Synthesis

**Official RLM**: No synthesis capability, LLM must write complete code

**Matryoshka**: Barliman-style synthesis
- LLM provides constraints (input/output examples), not code
- miniKanren relational interpreter automatically builds programs
- Auto-synthesizes extractors from grep results

```typescript
// LLM only needs to provide examples
synthesize_extractor([
  { input: "$1,234.56", output: 1234.56 },
  { input: "€999", output: 999 }
])
// System automatically generates extraction function
```

### 4. grep Dependency

A key architectural difference: **Matryoshka is grep-centric**.

| | Official RLM | Matryoshka |
|---|-------------|------------|
| grep role | Optional Python tool | **Core entry operation** |
| Search methods | Any Python code | Must use `(grep)` |
| Design philosophy | Give LLM full freedom | Constrain LLM to specific path |

In Matryoshka, almost all analysis starts with `(grep "pattern")`, then operates on `RESULTS`:

```
grep → RESULTS → filter/map/count/sum → FINAL
```

grep appears **211 times** across Matryoshka's codebase vs **0 times** in official RLM's prompts.

## Feature Comparison

| Feature | Official RLM | Matryoshka |
|---------|-------------|------------|
| miniKanren logic programming | No | Yes |
| Tree-sitter code analysis | No | Yes (20+ languages) |
| FTS5 full-text search | No | Yes |
| Handle-based storage | No | Yes |
| Program synthesis | No | Yes |
| RAG + self-correction | No | Yes |
| MCP server integration | No | Yes |
| Cloud sandboxes (Modal/Prime) | Yes | No |
| Visualization tool | Yes | No |
| Batched LLM queries | Yes | Yes |

## Precision Trade-offs

### grep Limitations (affects both, but Matryoshka more)

```
User asks: "Who is the company leader?"
Document says: "Zhang San serves as Chief Executive Officer"

grep("leader") → not found
grep("CEO") → not found
```

### Official RLM's Approach

```python
# Can directly do semantic search
answer = llm_query(f"Who is the company leader? Document: {context[:50000]}")
```

### Matryoshka's Approach

```scheme
;; Option 1: fuzzy_search (fuzzy matching)
(fuzzy_search "leader" 10)

;; Option 2: Also supports llm_query (in JS sandbox mode)
llm_query("Who is the company leader?" + chunk)
```

### Precision Impact by Task Type

**Matryoshka may be weaker for**:
- Pure semantic queries ("What is the article's theme?")
- Synonym/near-synonym matching
- Questions requiring context understanding

**Matryoshka may be stronger for**:
- Structured data extraction (logs, CSV, JSON)
- Exact pattern matching
- Large-scale data aggregation (count/sum)
- Token-constrained environments (97% savings)

## Design Philosophy

**Official RLM**:
- "Plug-and-play" inference library
- Minimal design, easy to understand and extend
- Relies on LLM's Python programming ability
- Supports multiple cloud sandbox environments

**Matryoshka**:
- Complete solution focused on large document analysis
- Reduces LLM errors through DSL constraints
- Optimizes token usage through Handle system
- Reduces LLM coding burden through synthesis

## When to Use Which

| Scenario | Recommended |
|----------|-------------|
| General-purpose tasks | Official RLM |
| Semantic Q&A | Official RLM |
| Log analysis | Matryoshka |
| Structured data extraction | Matryoshka |
| Token-constrained environment | Matryoshka |
| Small model (7B) | Matryoshka |
| Cloud sandbox needed | Official RLM |
| Code-aware analysis | Matryoshka |

## Summary

Official RLM is a **general-purpose, minimal framework** that lets LLM execute arbitrary Python code in a REPL.

Matryoshka is a **specialized document analysis system** optimized through:
1. Constrained DSL to reduce LLM error rate
2. Handle system to save 97% tokens
3. Program synthesis to reduce LLM coding burden
4. miniKanren for logical reasoning
5. Tree-sitter for code-aware analysis

In simple terms: Official RLM is "give LLM a Python REPL", Matryoshka is "give LLM a purpose-built query language + intelligent backend".

## References

- [Official RLM Repository](https://github.com/alexzhang13/rlm)
- [RLM Paper (arXiv)](https://arxiv.org/abs/2512.24601)
- [RLM Blogpost](https://alexzhang13.github.io/blog/2025/rlm/)
