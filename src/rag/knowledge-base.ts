/**
 * Knowledge Base for Few-Shot Synthesis RAG
 *
 * Contains "Golden" code snippets that work well in the Matryoshka sandbox.
 * These examples help smaller models (like Qwen 7B) succeed by providing
 * patterns to copy rather than requiring invention.
 */

/**
 * A single expert example with metadata for retrieval
 */
export interface ExpertExample {
  /** Unique identifier */
  id: string;

  /** Task category for filtering */
  category: TaskCategory;

  /** Keywords for similarity matching */
  keywords: string[];

  /** Natural language description of what this example does */
  description: string;

  /** The actual code pattern (JavaScript) */
  code: string;

  /** Explanation of why this approach works */
  rationale: string;

  /** Common mistakes to avoid */
  pitfalls?: string[];
}

/**
 * Task categories for organizing examples
 */
export type TaskCategory =
  | "aggregation"      // Sum, count, average
  | "extraction"       // Pull specific data from text
  | "search"          // Find patterns in documents
  | "transformation"  // Convert data formats
  | "analysis"        // Statistical analysis
  | "table"           // Table/CSV parsing
  | "currency"        // Money value extraction
  | "date"            // Date parsing
  | "list"            // Extract lists/enumerations
  | "summary"         // Summarization tasks
  | "comparison";     // Compare values

/**
 * A failed attempt that should be avoided
 */
export interface FailureExample {
  /** What the model tried to do */
  intent: string;

  /** The problematic code */
  badCode: string;

  /** What went wrong */
  error: string;

  /** The correct approach */
  fix: string;
}

/**
 * Expert examples organized by category
 */
export const EXPERT_EXAMPLES: ExpertExample[] = [
  // ============================================
  // AGGREGATION PATTERNS
  // ============================================
  {
    id: "agg-currency-sum",
    category: "aggregation",
    keywords: ["total", "sum", "sales", "revenue", "money", "dollar", "$", "add up"],
    description: "Sum all currency values matching a pattern",
    code: `// Step 1: Find all lines with the target data
const hits = grep("SALES_DATA");

// Step 2: Extract and sum the values
let total = 0;
for (const hit of hits) {
  // Look for currency pattern like $1,234,567
  const match = hit.line.match(/\\$(\\d{1,3}(?:,\\d{3})*)/);
  if (match) {
    // Remove commas and parse as number
    const value = parseInt(match[1].replace(/,/g, ""), 10);
    total += value;
    console.log(hit.line, "->", value);
  }
}
console.log("Total:", total);`,
    rationale: "grep() finds relevant lines first, then regex extracts the numeric value. Always remove commas before parseInt.",
    pitfalls: [
      "Don't forget to remove commas from numbers like 1,234,567",
      "Use parseInt with radix 10 for currency (no decimals in cents)",
      "Always log intermediate values to verify extraction"
    ]
  },
  {
    id: "agg-count-matches",
    category: "aggregation",
    keywords: ["count", "how many", "number of", "occurrences", "instances"],
    description: "Count occurrences of a pattern",
    code: `// Find all matching lines
const hits = grep("ERROR");
console.log("Count:", hits.length);

// Or count with additional filtering
let count = 0;
for (const hit of hits) {
  if (hit.line.includes("critical")) {
    count++;
  }
}
console.log("Critical errors:", count);`,
    rationale: "grep() returns an array, so .length gives the count. For filtered counts, iterate and increment.",
    pitfalls: [
      "grep() already returns matches - don't re-filter unless needed",
      "Be careful with case sensitivity in includes()"
    ]
  },
  {
    id: "agg-average",
    category: "aggregation",
    keywords: ["average", "mean", "avg"],
    description: "Calculate average of numeric values",
    code: `const hits = grep("temperature");
let sum = 0;
let count = 0;

for (const hit of hits) {
  const match = hit.line.match(/(\\d+\\.?\\d*)\\s*degrees/);
  if (match) {
    sum += parseFloat(match[1]);
    count++;
  }
}

const average = count > 0 ? sum / count : 0;
console.log("Average:", average.toFixed(2));`,
    rationale: "Track both sum and count, then divide. Handle the zero-count case to avoid NaN.",
    pitfalls: [
      "Always check count > 0 before dividing",
      "Use parseFloat for decimals, parseInt for integers"
    ]
  },

  // ============================================
  // SEARCH PATTERNS
  // ============================================
  {
    id: "search-basic-grep",
    category: "search",
    keywords: ["find", "search", "look for", "locate", "where"],
    description: "Basic pattern search in document",
    code: `// Simple keyword search
const hits = grep("keyword");
console.log("Found", hits.length, "matches");

// Show context around matches
for (const hit of hits) {
  console.log(\`Line \${hit.lineNum}: \${hit.line}\`);
}`,
    rationale: "grep() is the primary search tool. It returns line numbers and content.",
    pitfalls: [
      "grep() is case-sensitive by default",
      "Use 'gi' flags for case-insensitive: grep('pattern', 'gi')"
    ]
  },
  {
    id: "search-fuzzy",
    category: "search",
    keywords: ["similar", "like", "approximate", "fuzzy", "near"],
    description: "Fuzzy search when exact match fails",
    code: `// First try exact match
let hits = grep("QUARTERLY_REPORT");

// If no results, try fuzzy search
if (hits.length === 0) {
  const fuzzyHits = fuzzy_search("quarterly report", 5);
  console.log("Fuzzy matches:");
  for (const fh of fuzzyHits) {
    console.log(\`Score \${fh.score.toFixed(2)}: \${fh.line}\`);
  }
}`,
    rationale: "fuzzy_search() finds approximate matches when exact grep fails. Returns scored results.",
    pitfalls: [
      "fuzzy_search is slower than grep - use grep first",
      "The second parameter is max results (not threshold)"
    ]
  },
  {
    id: "search-regex",
    category: "search",
    keywords: ["pattern", "regex", "regular expression", "match"],
    description: "Regex pattern search",
    code: `// Search for date patterns (YYYY-MM-DD)
const hits = grep("\\\\d{4}-\\\\d{2}-\\\\d{2}");

// Or search for email patterns
const emailHits = grep("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+");

for (const hit of hits) {
  console.log(hit.line);
}`,
    rationale: "grep() accepts regex patterns. Double-escape backslashes in JavaScript strings.",
    pitfalls: [
      "Remember to double-escape: \\d becomes \\\\d in JS strings",
      "Test regex on a few lines first before processing all"
    ]
  },

  // ============================================
  // EXTRACTION PATTERNS
  // ============================================
  {
    id: "extract-key-value",
    category: "extraction",
    keywords: ["extract", "get value", "parse", "key:", "field"],
    description: "Extract values from key: value pairs",
    code: `const hits = grep("Status:");

for (const hit of hits) {
  // Pattern: "Key: Value"
  const match = hit.line.match(/Status:\\s*(.+)/);
  if (match) {
    const value = match[1].trim();
    console.log("Status:", value);
  }
}`,
    rationale: "Use capture groups to extract the value part. Always trim() the result.",
    pitfalls: [
      "\\s* handles variable spacing after the colon",
      "Use .trim() to remove trailing whitespace"
    ]
  },
  {
    id: "extract-between-markers",
    category: "extraction",
    keywords: ["between", "from...to", "section", "block"],
    description: "Extract text between start and end markers",
    code: `const hits = grep("===");
let inSection = false;
const sectionContent = [];

for (const hit of hits) {
  if (hit.line.includes("=== START ===")) {
    inSection = true;
    continue;
  }
  if (hit.line.includes("=== END ===")) {
    inSection = false;
    continue;
  }
  if (inSection) {
    sectionContent.push(hit.line);
  }
}
console.log("Section content:", sectionContent.join("\\n"));`,
    rationale: "Use a state flag to track when we're inside the section.",
    pitfalls: [
      "This works line-by-line; for multi-line patterns use slice()"
    ]
  },

  // ============================================
  // CURRENCY PATTERNS
  // ============================================
  {
    id: "currency-parse",
    category: "currency",
    keywords: ["$", "dollar", "price", "cost", "amount", "money", "currency"],
    description: "Parse currency values with various formats",
    code: `const hits = grep("\\\\$");

for (const hit of hits) {
  // Match: $1,234.56 or $1234 or $1,234,567
  const match = hit.line.match(/\\$(\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?)/);
  if (match) {
    const rawValue = match[1];
    const numericValue = parseFloat(rawValue.replace(/,/g, ""));
    console.log(rawValue, "->", numericValue);
  }
}`,
    rationale: "Currency regex handles commas and optional decimals. Always remove commas before parsing.",
    pitfalls: [
      "Different locales use different formats (1.234,56 vs 1,234.56)",
      "Some currencies don't use $ symbol"
    ]
  },
  {
    id: "currency-synthesize",
    category: "currency",
    keywords: ["synthesize", "extractor", "automatic"],
    description: "Use synthesize_extractor for complex patterns",
    code: `// If you have examples of input->output, use synthesis
const extractMoney = synthesize_extractor([
  { input: "$1,234,567", output: 1234567 },
  { input: "$500,000", output: 500000 }
]);

// Now use the synthesized function
const hits = grep("\\\\$");
let total = 0;
for (const hit of hits) {
  const match = hit.line.match(/\\$[\\d,]+/);
  if (match) {
    const value = extractMoney(match[0]);
    if (typeof value === "number") {
      total += value;
    }
  }
}
console.log("Total:", total);`,
    rationale: "synthesize_extractor() learns from examples - useful for complex extraction patterns.",
    pitfalls: [
      "Need at least 2 examples for synthesis",
      "Examples must have consistent pattern"
    ]
  },

  // ============================================
  // TABLE PATTERNS
  // ============================================
  {
    id: "table-csv-parse",
    category: "table",
    keywords: ["table", "csv", "column", "row", "comma separated"],
    description: "Parse CSV-style table data",
    code: `const hits = grep(",");  // Lines with commas

for (const hit of hits) {
  // Split by comma (simple CSV)
  const columns = hit.line.split(",").map(c => c.trim());

  // Access specific columns (0-indexed)
  const name = columns[0];
  const value = columns[1];
  console.log(\`Name: \${name}, Value: \${value}\`);
}`,
    rationale: "For simple CSV, split by comma and trim. For complex CSV with quoted values, use proper parsing.",
    pitfalls: [
      "This simple approach fails if values contain commas",
      "Watch out for header rows - skip if needed"
    ]
  },
  {
    id: "table-fixed-width",
    category: "table",
    keywords: ["fixed width", "columns", "positions", "aligned"],
    description: "Parse fixed-width table columns",
    code: `const hits = grep("DATA_");

for (const hit of hits) {
  const line = hit.line;
  // Extract fixed positions (adjust based on your data)
  const field1 = line.substring(0, 20).trim();
  const field2 = line.substring(20, 35).trim();
  const field3 = line.substring(35).trim();
  console.log(field1, "|", field2, "|", field3);
}`,
    rationale: "For fixed-width tables, use substring with known column positions.",
    pitfalls: [
      "Column positions may vary - check the actual data first",
      "Account for variable-length content within fixed columns"
    ]
  },

  // ============================================
  // DATE PATTERNS
  // ============================================
  {
    id: "date-parse-iso",
    category: "date",
    keywords: ["date", "time", "timestamp", "YYYY-MM-DD", "ISO"],
    description: "Parse ISO date format (YYYY-MM-DD)",
    code: `const hits = grep("\\\\d{4}-\\\\d{2}-\\\\d{2}");

for (const hit of hits) {
  const match = hit.line.match(/(\\d{4})-(\\d{2})-(\\d{2})/);
  if (match) {
    const [_, year, month, day] = match;
    console.log(\`Year: \${year}, Month: \${month}, Day: \${day}\`);

    // Parse to Date object
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    console.log("Date:", date.toLocaleDateString());
  }
}`,
    rationale: "ISO dates are easy to parse. Remember months are 0-indexed in JavaScript Date.",
    pitfalls: [
      "JavaScript months are 0-indexed (January = 0)",
      "Timezone handling can be tricky"
    ]
  },

  // ============================================
  // ANALYSIS PATTERNS
  // ============================================
  {
    id: "analysis-stats",
    category: "analysis",
    keywords: ["statistics", "stats", "min", "max", "range"],
    description: "Calculate basic statistics",
    code: `// First check document size
const stats = text_stats();
console.log("Document has", stats.totalLines, "lines");

// Extract numeric values
const hits = grep("value:");
const values = [];

for (const hit of hits) {
  const match = hit.line.match(/value:\\s*(\\d+)/);
  if (match) {
    values.push(parseInt(match[1], 10));
  }
}

if (values.length > 0) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;

  console.log("Min:", min);
  console.log("Max:", max);
  console.log("Sum:", sum);
  console.log("Avg:", avg.toFixed(2));
  console.log("Count:", values.length);
}`,
    rationale: "text_stats() gives document overview. Collect values into array for statistical operations.",
    pitfalls: [
      "Check values.length > 0 before computing stats",
      "Math.min/max with spread only works for reasonable array sizes"
    ]
  },

  // ============================================
  // LIST PATTERNS
  // ============================================
  {
    id: "list-extract-items",
    category: "list",
    keywords: ["list", "items", "enumerate", "bullet", "numbered"],
    description: "Extract list items (bulleted or numbered)",
    code: `// For numbered lists: 1. Item, 2. Item
const numberedHits = grep("^\\\\d+\\\\.");
for (const hit of numberedHits) {
  const match = hit.line.match(/^\\d+\\.\\s*(.+)/);
  if (match) {
    console.log("Item:", match[1].trim());
  }
}

// For bulleted lists: - Item or * Item
const bulletHits = grep("^[\\\\-\\\\*]\\\\s");
for (const hit of bulletHits) {
  const match = hit.line.match(/^[\\-\\*]\\s+(.+)/);
  if (match) {
    console.log("Item:", match[1].trim());
  }
}`,
    rationale: "Use ^ anchor to match list markers at start of line.",
    pitfalls: [
      "Lists might be indented - adjust regex accordingly",
      "Some lists use different markers (>, +, etc.)"
    ]
  }
];

/**
 * Common failure patterns to avoid
 */
export const FAILURE_EXAMPLES: FailureExample[] = [
  {
    intent: "Read a file from disk",
    badCode: `const fs = require('fs');
const data = fs.readFileSync('file.txt');`,
    error: "ReferenceError: require is not defined",
    fix: "The document content is already available. Use grep(), slice(), or fuzzy_search() to access it."
  },
  {
    intent: "Make an HTTP request",
    badCode: `const response = await fetch('https://api.example.com/data');`,
    error: "ReferenceError: fetch is not defined",
    fix: "External network access is not available. Work only with the provided document content."
  },
  {
    intent: "Use console.log without output",
    badCode: `const result = grep("pattern");
// forgot to log the result`,
    error: "No output produced - the model can't see results",
    fix: "Always use console.log() to output results. The model only sees what's logged."
  },
  {
    intent: "Parse number with commas",
    badCode: `const value = parseInt("1,234,567");
// Returns 1, not 1234567`,
    error: "parseInt stops at first non-digit character (the comma)",
    fix: "Remove commas first: parseInt(str.replace(/,/g, ''), 10)"
  },
  {
    intent: "Loop through large document",
    badCode: `for (let i = 0; i < 1000000; i++) {
  const line = document[i];
  // process each line
}`,
    error: "Timeout or memory issues",
    fix: "Use grep() to filter relevant lines first, then iterate only over matches."
  },
  {
    intent: "Return a value",
    badCode: `return total;`,
    error: "Return statement not allowed in sandbox",
    fix: "Use console.log() to output values. The model reads stdout, not return values."
  }
];

/**
 * Get examples for a specific category
 */
export function getExamplesByCategory(category: TaskCategory): ExpertExample[] {
  return EXPERT_EXAMPLES.filter(ex => ex.category === category);
}

/**
 * Get all keywords for similarity matching
 */
export function getAllKeywords(): Map<string, ExpertExample[]> {
  const keywordMap = new Map<string, ExpertExample[]>();

  for (const example of EXPERT_EXAMPLES) {
    for (const keyword of example.keywords) {
      const lower = keyword.toLowerCase();
      const existing = keywordMap.get(lower) || [];
      existing.push(example);
      keywordMap.set(lower, existing);
    }
  }

  return keywordMap;
}
