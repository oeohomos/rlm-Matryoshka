/**
 * Qwen Barliman Adapter
 *
 * Implements Barliman-style constraint-based program synthesis.
 * The LLM provides CONSTRAINTS (input/output examples), NOT code.
 * A miniKanren-based synthesizer generates programs automatically.
 *
 * IMPORTANT: This adapter is GENERIC - not specific to any domain.
 * It can handle logs, financial data, scientific data, etc.
 */

import type { ModelAdapter, FinalVarMarker } from "./types.js";
import { createQwenAdapter } from "./qwen.js";
import { analyzeError, formatErrorFeedback } from "../feedback/error-analyzer.js";

/**
 * Build system prompt explaining Barliman-style synthesis
 */
function buildSystemPrompt(
  contextLength: number,
  toolInterfaces: string
): string {
  const formattedLength = contextLength.toLocaleString();

  return `You are a CONSTRAINT PROVIDER for a program synthesizer. You do NOT write code implementations.
Instead, you provide INPUT/OUTPUT EXAMPLES, and a synthesis engine automatically builds programs.

## YOUR ROLE: Provide Constraints, Not Code

You are driving a **miniKanren-based program synthesizer** (like Barliman).
- YOU provide: input/output examples (constraints)
- SYNTHESIZER builds: working programs that satisfy your constraints
- If synthesis fails: you get feedback and refine your constraints

## HOW IT WORKS

A document is loaded (${formattedLength} chars). You search it with grep(), then provide examples to the synthesizer.

### Step 1: Search the document to DISCOVER the data format
\`\`\`javascript
// First, search to SEE what format the data is in
const hits = grep("keyword");  // Use a keyword from the query
console.log("Found:", hits.length, "results");
console.log(JSON.stringify(hits.slice(0, 3), null, 2));
// LOOK at the output to understand the ACTUAL format
\`\`\`

### Step 2: Extract values from the lines, THEN synthesize
\`\`\`javascript
// Based on what you SAW in Step 1, extract the values
// Example: if lines look like "LABEL: $1,234" extract "$1,234"
const values = hits.map(h => {
  const match = h.line.match(/pattern_you_saw/);  // Use the ACTUAL pattern
  return match ? match[0] : null;
}).filter(v => v !== null);

console.log("Extracted values:", values);

// Synthesize from the EXTRACTED values
const extractor = synthesize_extractor([
  { input: values[0], output: /* converted value */ },
  { input: values[1], output: /* converted value */ }
]);
\`\`\`

### Step 3: Apply and compute
\`\`\`javascript
let result = 0;
for (const v of values) {
  result += extractor(v);
}
console.log("Result:", result);
\`\`\`

## SYNTHESIS TOOLS

### synthesize_extractor(examples)
Builds a function from input/output pairs.
\`\`\`javascript
const extractor = synthesize_extractor([
  { input: "extracted_string_1", output: converted_value_1 },
  { input: "extracted_string_2", output: converted_value_2 }
]);
const result = extractor("new_string");  // Returns converted value
\`\`\`

### synthesize_regex(positives, negatives?)
Builds a regex pattern from example strings.

### grep(pattern)
Searches the document. Returns array of { match, line, lineNum }.
**NOTE: grep takes ONE argument.** Use | for OR: grep("a|b")

## CRITICAL RULES

1. **JavaScript ONLY** - Use \`\`\`javascript blocks.
2. **NO floating objects** - Object literals must be inside arrays or function calls.
3. **grep() takes ONE argument** - grep("a|b") NOT grep("a", "b")
4. **grep() returns objects** - Use hit.line to get the string.
5. **FIRST search, THEN look at output, THEN synthesize based on what you see.**

## FINAL ANSWER
When you have the answer:
\`\`\`javascript
console.log("done");
\`\`\`
<<<FINAL>>>
Your answer here.
<<<END>>>

## BEGIN

Search with grep(), look at the output, then provide constraints.
Output \`\`\`javascript code blocks ONLY.`;
}

/**
 * Error feedback emphasizing constraint refinement
 */
function getErrorFeedback(error: string, code?: string): string {
  const analysis = analyzeError(error, code);
  const feedback = formatErrorFeedback(analysis);

  // Check for floating object literal error
  if (error.includes("Unexpected token ':'") && code) {
    // Check if code has floating object literals
    const hasFloatingObjects = /^\s*\{\s*input:/m.test(code);
    if (hasFloatingObjects) {
      return `**SYNTAX ERROR: Floating object literals**

You wrote object literals outside of an array:
\`\`\`javascript
// WRONG - causes "Unexpected token ':'"
{ input: "a", output: 1 }
{ input: "b", output: 2 }

// RIGHT - objects must be inside an array
const extractor = synthesize_extractor([
  { input: "a", output: 1 },
  { input: "b", output: 2 }
]);
\`\`\`

Fix: Put all objects inside the array argument to synthesize_extractor().`;
    }
  }

  let codeExample = "";

  switch (analysis.errorType) {
    case "invalid_regex_flags":
      codeExample = `
**FIX: grep() takes ONE argument**
\`\`\`javascript
// Use | for OR pattern
const hits = grep("pattern1|pattern2");
\`\`\``;
      break;

    case "undefined_variable":
      codeExample = `
**FIX: Define variables in the same code block**
\`\`\`javascript
const hits = grep("pattern");
// Use hits in the SAME block
\`\`\``;
      break;

    case "string_method_on_object":
      codeExample = `
**FIX: grep() returns objects, use .line for string**
\`\`\`javascript
for (const hit of hits) {
  const text = hit.line;  // .line is the string
}
\`\`\``;
      break;

    default:
      codeExample = `
**Try this approach:**
\`\`\`javascript
// 1. Search
const hits = grep("keyword");
console.log(JSON.stringify(hits.slice(0, 3), null, 2));

// 2. Look at output, extract values based on what you see
// 3. Synthesize from extracted values
\`\`\``;
  }

  return `${feedback}
${codeExample}

Provide \`\`\`javascript with the fix:`;
}

/**
 * No code feedback
 */
function getNoCodeFeedback(): string {
  return `ERROR: No JavaScript code detected.

Output \`\`\`javascript code blocks:
\`\`\`javascript
const hits = grep("keyword");
console.log(JSON.stringify(hits.slice(0, 3), null, 2));
\`\`\``;
}

/**
 * Success feedback
 */
function getSuccessFeedback(): string {
  return `Variables persist. If you found the answer, output the FINAL markers (see prompt).`;
}

/**
 * Repeated code feedback
 */
function getRepeatedCodeFeedback(): string {
  return `ERROR: Repeated code. Try DIFFERENT approach.

\`\`\`javascript
// Search for different pattern
const hits = grep("different_keyword");
console.log(JSON.stringify(hits.slice(0, 3), null, 2));
\`\`\``;
}

/**
 * Create the Qwen Barliman adapter
 */
export function createQwenBarlimanAdapter(): ModelAdapter {
  const base = createQwenAdapter();

  return {
    ...base,
    name: "qwen-barliman",
    buildSystemPrompt,
    getErrorFeedback,
    getNoCodeFeedback,
    getSuccessFeedback,
    getRepeatedCodeFeedback,
  };
}
