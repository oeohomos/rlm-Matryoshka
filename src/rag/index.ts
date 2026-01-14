/**
 * RAG Module - Few-Shot Synthesis Support
 *
 * Provides retrieval-augmented generation to help smaller models
 * succeed by retrieving relevant code patterns and avoiding pitfalls.
 */

// Types
export type {
  ExpertExample,
  FailureExample,
  TaskCategory,
} from "./knowledge-base.js";

export type {
  Hint,
  FailureRecord,
} from "./manager.js";

// Knowledge Base
export {
  EXPERT_EXAMPLES,
  FAILURE_EXAMPLES,
  getExamplesByCategory,
  getAllKeywords,
} from "./knowledge-base.js";

// Similarity
export {
  tokenize,
  cosineSimilarity,
  keywordMatchScore,
  buildSearchIndex,
  searchIndex,
  type SearchIndex,
} from "./similarity.js";

// Manager
export {
  RAGManager,
  getRAGManager,
  createRAGManager,
} from "./manager.js";
