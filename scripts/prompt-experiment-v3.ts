/**
 * Test hybrid approach: direct answer for small docs, multi-turn for large
 */

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

// Small document - model can see all data
const smallDoc = `# Sales Report
SALES_DATA_NORTH: $2,340,000
SALES_DATA_SOUTH: $3,120,000
SALES_DATA_EAST: $2,890,000`;

// Simulated large document - can only search
const largeDocSample = `[Document: 50,000 characters - too large to show in full]
Sample matches for "SALES":
  Line 234: SALES_DATA_NORTH: $2,340,000
  Line 567: SALES_DATA_SOUTH: $3,120,000
  Line 891: SALES_DATA_EAST: $2,890,000
[End of search results]`;

// Hybrid system prompt
const hybridSystem = `You analyze documents.

For SMALL documents (you can see all data):
- Answer directly: <<<FINAL>>>answer<<<END>>>

For LARGE documents (must search):
- Search: (grep "keyword")
- Filter: (filter RESULTS (lambda x (match x "pattern" 0)))
- Extract numbers: (map RESULTS (lambda x (match x "[0-9]+" 0)))
- Sum: (sum RESULTS)

Output ONE thing per turn.`;

// Test with different scenarios
async function testScenario(name: string, userMessage: string) {
  console.log("\n" + "=".repeat(60));
  console.log(`TEST: ${name}`);
  console.log("=".repeat(60));

  const response = await queryOllama(userMessage, hybridSystem);
  console.log("\nResponse:");
  console.log(response.slice(0, 400));

  // Analyze
  const hasFinal = response.includes("<<<FINAL>>>");
  const hasSexp = response.includes("(grep") || response.includes("(filter") || response.includes("(sum");

  console.log("\nAnalysis:");
  console.log(`  Direct answer: ${hasFinal}`);
  console.log(`  S-expression: ${hasSexp}`);

  if (hasFinal) {
    const match = response.match(/<<<FINAL>>>([\s\S]*?)<<<END>>>/);
    if (match) {
      console.log(`  Extracted: ${match[1].trim()}`);
    }
  }
}

// Test with various queries
async function main() {
  console.log("Hybrid Approach Testing\n");

  // Test 1: Small doc, simple sum query
  await testScenario(
    "Small doc - sum query",
    `Document (200 chars):\n${smallDoc}\n\nQuery: What is the total of all sales?`
  );

  await new Promise(r => setTimeout(r, 1000));

  // Test 2: Small doc, count query
  await testScenario(
    "Small doc - count query",
    `Document (200 chars):\n${smallDoc}\n\nQuery: How many sales entries are there?`
  );

  await new Promise(r => setTimeout(r, 1000));

  // Test 3: Small doc, filter query
  await testScenario(
    "Small doc - filter query",
    `Document (200 chars):\n${smallDoc}\n\nQuery: What is the NORTH region sales value?`
  );

  await new Promise(r => setTimeout(r, 1000));

  // Test 4: Large doc indicator - should use search
  await testScenario(
    "Large doc indicator - should search",
    `Document (50,000 chars - showing sample only):
[First 500 chars]: # Company Report Q1 2024...
[Query must use grep to find specific data]

Query: What is the total of all SALES_DATA values?`
  );

  await new Promise(r => setTimeout(r, 1000));

  // Test 5: Multi-turn simulation for large doc
  console.log("\n" + "=".repeat(60));
  console.log("TEST: Large doc multi-turn simulation");
  console.log("=".repeat(60));

  let messages = `Document (50,000 chars):
[Showing sample - use grep to search]

Query: What is the total of all SALES_DATA values?`;

  const r1 = await queryOllama(messages, hybridSystem);
  console.log("\nTurn 1:", r1.slice(0, 150));

  messages += `\n\nAssistant: ${r1}\n\nSystem: grep found 3 matches. RESULTS:
- SALES_DATA_NORTH: $2,340,000
- SALES_DATA_SOUTH: $3,120,000
- SALES_DATA_EAST: $2,890,000

Next:`;

  const r2 = await queryOllama(messages, hybridSystem);
  console.log("Turn 2:", r2.slice(0, 150));

  messages += `\n\nAssistant: ${r2}\n\nSystem: Extracted numbers. RESULTS = [2340000, 3120000, 2890000]

Next:`;

  const r3 = await queryOllama(messages, hybridSystem);
  console.log("Turn 3:", r3.slice(0, 150));

  messages += `\n\nAssistant: ${r3}\n\nSystem: Sum = 8350000

Next:`;

  const r4 = await queryOllama(messages, hybridSystem);
  console.log("Turn 4:", r4.slice(0, 150));
}

main().catch(console.error);
