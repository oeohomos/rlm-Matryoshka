/**
 * Follow-up experiment: Test multi-turn behavior with best approaches
 */

async function queryOllama(messages: Array<{role: string, content: string}>, system: string): Promise<string> {
  // Build prompt from messages
  let prompt = "";
  for (const msg of messages) {
    if (msg.role === "user") {
      prompt += `USER: ${msg.content}\n\n`;
    } else {
      prompt += `ASSISTANT: ${msg.content}\n\n`;
    }
  }

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

const testDoc = `# Sales Report
SALES_DATA_NORTH: $2,340,000
Some notes here
SALES_DATA_SOUTH: $3,120,000
More text
SALES_DATA_EAST: $2,890,000`;

const testQuery = "What is the total of all sales values?";

// Test: Lisp-native multi-turn
async function testLispNativeMultiTurn() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST: Lisp-native multi-turn");
  console.log("=".repeat(60));

  const system = `; Lisp document analyzer
; Functions: (grep "pattern"), (filter list pred), (map list fn), (sum list), (count list)
; Variables: RESULTS (last result), _1, _2, etc (previous results)
; Final answer: <<<FINAL>>>answer<<<END>>>
; Output ONE s-expression per turn. No comments.`;

  const messages: Array<{role: string, content: string}> = [];

  // Turn 1
  messages.push({ role: "user", content: `Document:\n${testDoc}\n\nQuery: ${testQuery}\n\nTurn 1:` });
  const r1 = await queryOllama(messages, system);
  console.log("\nTurn 1 response:", r1.slice(0, 200));
  messages.push({ role: "assistant", content: r1 });

  // Simulate result
  messages.push({ role: "user", content: `Result: 3 matches found. RESULTS = [
  {line: "SALES_DATA_NORTH: $2,340,000"},
  {line: "SALES_DATA_SOUTH: $3,120,000"},
  {line: "SALES_DATA_EAST: $2,890,000"}
]

Turn 2:` });
  const r2 = await queryOllama(messages, system);
  console.log("Turn 2 response:", r2.slice(0, 200));
  messages.push({ role: "assistant", content: r2 });

  // Simulate result
  messages.push({ role: "user", content: `Result: RESULTS = [2340000, 3120000, 2890000]

Turn 3:` });
  const r3 = await queryOllama(messages, system);
  console.log("Turn 3 response:", r3.slice(0, 200));
}

// Test: Code block style multi-turn
async function testCodeBlockMultiTurn() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST: Code block multi-turn");
  console.log("=".repeat(60));

  const system = `Document analyzer. Output one command per turn in a code block.

Commands:
\`\`\`
(grep "pattern")
(filter RESULTS (lambda x (match x "pattern" 0)))
(map RESULTS (lambda x (match x "[0-9]+" 0)))
(sum RESULTS)
\`\`\`

Final answer:
\`\`\`
<<<FINAL>>>answer<<<END>>>
\`\`\``;

  const messages: Array<{role: string, content: string}> = [];

  // Turn 1
  messages.push({ role: "user", content: `Document:\n${testDoc}\n\nQuery: ${testQuery}` });
  const r1 = await queryOllama(messages, system);
  console.log("\nTurn 1 response:", r1.slice(0, 200));
  messages.push({ role: "assistant", content: r1 });

  // Simulate result
  messages.push({ role: "user", content: `Executed. RESULTS has 3 items:
- SALES_DATA_NORTH: $2,340,000
- SALES_DATA_SOUTH: $3,120,000
- SALES_DATA_EAST: $2,890,000

Next command:` });
  const r2 = await queryOllama(messages, system);
  console.log("Turn 2 response:", r2.slice(0, 200));
  messages.push({ role: "assistant", content: r2 });

  // Simulate result
  messages.push({ role: "user", content: `Executed. RESULTS = [2340000, 3120000, 2890000]

Next command:` });
  const r3 = await queryOllama(messages, system);
  console.log("Turn 3 response:", r3.slice(0, 200));
}

// Test: Ultra minimal
async function testUltraMinimal() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST: Ultra minimal");
  console.log("=".repeat(60));

  const system = `(grep "x") (filter R f) (map R f) (sum R) <<<FINAL>>>x<<<END>>>`;

  const messages: Array<{role: string, content: string}> = [];

  messages.push({ role: "user", content: `${testDoc}\n\n${testQuery}` });
  const r1 = await queryOllama(messages, system);
  console.log("\nTurn 1:", r1.slice(0, 200));
  messages.push({ role: "assistant", content: r1 });

  messages.push({ role: "user", content: `RESULTS=[{line:"SALES_DATA_NORTH: $2,340,000"},{line:"SALES_DATA_SOUTH: $3,120,000"},{line:"SALES_DATA_EAST: $2,890,000"}]` });
  const r2 = await queryOllama(messages, system);
  console.log("Turn 2:", r2.slice(0, 200));
  messages.push({ role: "assistant", content: r2 });

  messages.push({ role: "user", content: `RESULTS=[2340000,3120000,2890000]` });
  const r3 = await queryOllama(messages, system);
  console.log("Turn 3:", r3.slice(0, 200));
}

// Test: Direct answer allowed
async function testDirectAnswer() {
  console.log("\n" + "=".repeat(60));
  console.log("TEST: Direct answer allowed");
  console.log("=".repeat(60));

  const system = `Analyze document. If you can answer directly, output:
<<<FINAL>>>answer<<<END>>>

If you need to search first:
(grep "keyword")

Then process results:
(sum RESULTS)`;

  const messages: Array<{role: string, content: string}> = [];

  messages.push({ role: "user", content: `Document:\n${testDoc}\n\nQuery: ${testQuery}` });
  const r1 = await queryOllama(messages, system);
  console.log("\nResponse:", r1.slice(0, 300));

  // Check if it gave a direct answer
  if (r1.includes("<<<FINAL>>>")) {
    // Extract and validate the answer
    const match = r1.match(/<<<FINAL>>>([\s\S]*?)<<<END>>>/);
    if (match) {
      console.log("\nExtracted answer:", match[1].trim());
      // Check if the number is close to correct (8,350,000)
      const numMatch = match[1].match(/[\d,]+/);
      if (numMatch) {
        const num = parseInt(numMatch[0].replace(/,/g, ""));
        console.log("Parsed number:", num);
        console.log("Expected: 8350000");
        console.log("Correct:", Math.abs(num - 8350000) < 100000 ? "YES!" : "NO");
      }
    }
  }
}

async function main() {
  console.log("Multi-turn Prompt Experimentation\n");

  await testLispNativeMultiTurn();
  await new Promise(r => setTimeout(r, 1000));

  await testCodeBlockMultiTurn();
  await new Promise(r => setTimeout(r, 1000));

  await testUltraMinimal();
  await new Promise(r => setTimeout(r, 1000));

  await testDirectAnswer();
}

main().catch(console.error);
