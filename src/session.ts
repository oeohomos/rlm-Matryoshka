/**
 * Session Manager for Persistent Sandbox State
 *
 * Keeps sandbox instances alive between queries for faster follow-ups.
 * NOTE: This is for standalone mode only, NOT for MCP!
 */

import { createSandbox, Sandbox, SandboxOptions } from "./sandbox.js";

interface LLMQueryOptions {
  format?: "json" | "text";
}

type LLMQueryFn = (prompt: string, options?: LLMQueryOptions) => Promise<string>;

interface Session {
  sandbox: Sandbox;
  filePath: string;
  createdAt: Date;
}

/**
 * Session Manager interface
 */
export interface SessionManager {
  /**
   * Get existing sandbox or create new one for the given file path
   */
  getOrCreate(
    filePath: string,
    content: string,
    llmFn: LLMQueryFn,
    options?: SandboxOptions
  ): Promise<Sandbox>;

  /**
   * Get existing sandbox for path (undefined if not found)
   */
  get(filePath: string): Sandbox | undefined;

  /**
   * Clear a specific session
   */
  clear(filePath: string): void;

  /**
   * Clear all sessions
   */
  clearAll(): void;

  /**
   * List all active session paths
   */
  listSessions(): string[];
}

/**
 * Create a new session manager
 *
 * @example
 * const sessionManager = createSessionManager();
 *
 * // First query - creates new sandbox
 * const sandbox = await sessionManager.getOrCreate('/path/to/doc.txt', content, llmFn);
 * await sandbox.execute('memory.push("found something")');
 *
 * // Follow-up query - reuses same sandbox with preserved memory
 * const sameSandbox = await sessionManager.getOrCreate('/path/to/doc.txt', content, llmFn);
 * const result = await sameSandbox.execute('memory'); // Still has previous data
 */
export function createSessionManager(): SessionManager {
  const sessions = new Map<string, Session>();

  return {
    async getOrCreate(
      filePath: string,
      content: string,
      llmFn: LLMQueryFn,
      options?: SandboxOptions
    ): Promise<Sandbox> {
      // Check for existing session
      const existing = sessions.get(filePath);
      if (existing) {
        return existing.sandbox;
      }

      // Create new sandbox
      const sandbox = await createSandbox(content, llmFn, options);

      // Store session
      sessions.set(filePath, {
        sandbox,
        filePath,
        createdAt: new Date(),
      });

      return sandbox;
    },

    get(filePath: string): Sandbox | undefined {
      return sessions.get(filePath)?.sandbox;
    },

    clear(filePath: string): void {
      const session = sessions.get(filePath);
      if (session) {
        session.sandbox.dispose();
        sessions.delete(filePath);
      }
    },

    clearAll(): void {
      for (const session of sessions.values()) {
        session.sandbox.dispose();
      }
      sessions.clear();
    },

    listSessions(): string[] {
      return Array.from(sessions.keys());
    },
  };
}
