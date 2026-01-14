/**
 * Standalone experiment to find what prompting works best with the 7B model
 */

import Anthropic from "@anthropic-ai/sdk";

// Simple Ollama client
async function queryOllama(prompt: string, system: string): Promise<string> {
  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen2.5-coder:7b",
      prompt,
      system,
      stream: false,
      options: { temperature: 0.1 },
    }),
  });
  const data = await response.json();
  return data.response;
}

// Test data
const testDoc = `# Sales Report
SALES_DATA_NORTH: $2,340,000
Some notes here
SALES_DATA_SOUTH: $3,120,000
More text
SALES_DATA_EAST: $2,890,000`;

const testQuery = "What is the total of all sales values?";

// Different prompting approaches to test
const approaches: Record<string, { system: string; userTemplate: (doc: string, query: string) => string }> = {

  // Approach 1: Minimal with examples
  minimal: {
    system: `Output commands or answers. Nothing else.

Commands:
(grep "word")
(filter RESULTS (lambda x (match x "word" 0)))
(sum RESULTS)

Answer format:
<<<FINAL>>>answer<<<END>>>`,
    userTemplate: (doc, query) => `Document:\n${doc}\n\nQuery: ${query}`,
  },

  // Approach 2: JSON-friendly (since model likes JSON)
  jsonStyle: {
    system: `You process documents. Respond with JSON only.

For searching: {"cmd": "grep", "pattern": "word"}
For filtering: {"cmd": "filter", "pattern": "word"}
For summing: {"cmd": "sum"}
For final answer: {"answer": "your answer"}`,
    userTemplate: (doc, query) => `Document:\n${doc}\n\nQuery: ${query}\n\nRespond with JSON:`,
  },

  // Approach 3: Step-by-step with examples
  fewShot: {
    system: `You analyze documents step by step.

Example:
Query: "count errors"
Step 1: (grep "error")
[System shows 5 results]
Step 2: (count RESULTS)
[System shows 5]
Step 3: <<<FINAL>>>There are 5 errors<<<END>>>

Output ONE step at a time. Just the command, nothing else.`,
    userTemplate: (doc, query) => `Document:\n${doc}\n\nQuery: ${query}\n\nStep 1:`,
  },

  // Approach 4: Code block style
  codeBlock: {
    system: `You are a document analyzer. Output commands in code blocks.

Available commands:
\`\`\`
(grep "pattern")
(filter RESULTS (lambda x (match x "pattern" 0)))
(sum RESULTS)
\`\`\`

For final answer:
\`\`\`
<<<FINAL>>>
your answer
<<<END>>>
\`\`\``,
    userTemplate: (doc, query) => `Document:\n${doc}\n\nQuery: ${query}\n\n\`\`\``,
  },

  // Approach 5: Fill in the blank
  fillBlank: {
    system: `Complete the command. Output ONLY the missing part.`,
    userTemplate: (doc, query) => `Document contains sales data. Query: "${query}"

To find sales lines, complete this command:
(grep "`,
  },

  // Approach 6: Very structured role
  structuredRole: {
    system: `ROLE: Document Query Engine
INPUT: Document + Query
OUTPUT: Exactly one S-expression per turn

SYNTAX:
- Search: (grep "keyword")
- Filter: (filter VAR (lambda x (match x "pattern" 0)))
- Sum: (sum VAR)
- Done: <<<FINAL>>>answer<<<END>>>

RULES:
1. Output ONLY the S-expression
2. No explanations
3. No JSON
4. No markdown`,
    userTemplate: (doc, query) => `DOCUMENT:
${doc}

QUERY: ${query}

OUTPUT:`,
  },

  // Approach 7: Lisp-native
  lispNative: {
    system: `; Lisp document analyzer
; Available functions:
;   (grep pattern) -> list of matches
;   (filter list pred) -> filtered list
;   (sum list) -> number
;   (lambda (x) body) -> function
;   (match str pattern group) -> matched string or nil

; Output one s-expression. No comments.`,
    userTemplate: (doc, query) => `; Document: "${doc.slice(0, 200)}..."
; Query: ${query}
; Expression:
(`,
  },

  // Approach 8: Action-based
  actionBased: {
    system: `ACTION: search | filter | extract | sum | answer

search: grep "keyword"
filter: filter by "pattern"
extract: map to get values
sum: add numbers
answer: final result

Output format: ACTION: details`,
    userTemplate: (doc, query) => `Document has sales data with dollar amounts.
Query: ${query}

First action:`,
  },
};

async function testApproach(name: string, approach: typeof approaches[string]) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log("=".repeat(60));
  console.log("\nSystem prompt:");
  console.log(approach.system);
  console.log("\nUser message:");
  const userMsg = approach.userTemplate(testDoc, testQuery);
  console.log(userMsg.slice(0, 300) + (userMsg.length > 300 ? "..." : ""));

  try {
    const response = await queryOllama(userMsg, approach.system);
    console.log("\nModel response:");
    console.log(response.slice(0, 500));

    // Analyze response
    const hasParens = response.includes("(") && response.includes(")");
    const hasGrep = response.toLowerCase().includes("grep");
    const hasJSON = response.includes("{") && response.includes("}");
    const hasFinal = response.includes("<<<FINAL>>>");

    console.log("\nAnalysis:");
    console.log(`  Has S-expression: ${hasParens}`);
    console.log(`  Has grep: ${hasGrep}`);
    console.log(`  Has JSON: ${hasJSON}`);
    console.log(`  Has FINAL: ${hasFinal}`);

    return { name, response, hasParens, hasGrep, hasJSON, hasFinal };
  } catch (error) {
    console.log(`\nError: ${error}`);
    return { name, error: String(error) };
  }
}

async function main() {
  console.log("Prompt Experimentation Script");
  console.log("Testing different prompting approaches with qwen2.5-coder:7b\n");

  const results = [];

  for (const [name, approach] of Object.entries(approaches)) {
    const result = await testApproach(name, approach);
    results.push(result);

    // Small delay between tests
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));

  for (const r of results) {
    if ("error" in r) {
      console.log(`${r.name}: ERROR`);
    } else {
      const score = (r.hasParens ? 1 : 0) + (r.hasGrep ? 1 : 0) + (!r.hasJSON ? 1 : 0);
      console.log(`${r.name}: score=${score}/3 (parens:${r.hasParens}, grep:${r.hasGrep}, noJSON:${!r.hasJSON})`);
    }
  }
}

main().catch(console.error);
