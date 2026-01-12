import type { LLMProvider, LLMConfig, ProviderConfig, LLMQueryFn } from "./types.js";
import { createOllamaProvider } from "./ollama.js";
import { createDeepSeekProvider } from "./deepseek.js";

export type { LLMProvider, LLMConfig, ProviderConfig, LLMQueryFn } from "./types.js";

type ProviderFactory = (config: ProviderConfig) => LLMProvider;

const providerFactories: Record<string, ProviderFactory> = {
  ollama: createOllamaProvider,
  deepseek: createDeepSeekProvider,
};

/**
 * Register a custom LLM provider
 */
export function registerProvider(name: string, factory: ProviderFactory): void {
  providerFactories[name] = factory;
}

/**
 * Get list of available provider names
 */
export function getAvailableProviders(): string[] {
  return Object.keys(providerFactories);
}

/**
 * Resolve environment variables in a string
 * e.g., "${API_KEY}" -> actual value from process.env.API_KEY
 */
function resolveEnvVar(value: string | undefined): string | undefined {
  if (!value) return value;

  if (value.startsWith("${") && value.endsWith("}")) {
    const envVar = value.slice(2, -1);
    const resolved = process.env[envVar];
    if (!resolved) {
      throw new Error(
        `Environment variable ${envVar} not set`
      );
    }
    return resolved;
  }
  return value;
}

/**
 * Create an LLM query function from configuration
 *
 * @param providerName - Name of the provider (ollama, deepseek, etc.)
 * @param providerConfig - Provider-specific configuration (baseUrl, apiKey, model, options)
 * @param overrides - Optional overrides for model/options
 * @returns A function that takes a prompt and returns a response
 */
export function createLLMClient(
  providerName: string,
  providerConfig: ProviderConfig,
  overrides?: { model?: string; options?: Record<string, unknown> }
): LLMQueryFn {
  const factory = providerFactories[providerName];
  if (!factory) {
    throw new Error(
      `Unknown LLM provider: ${providerName}. Available: ${Object.keys(providerFactories).join(", ")}`
    );
  }

  // Resolve environment variables in apiKey
  const resolvedConfig: ProviderConfig = {
    ...providerConfig,
    apiKey: resolveEnvVar(providerConfig.apiKey),
  };

  const provider = factory(resolvedConfig);

  // Build LLMConfig from provider config + overrides
  const llmConfig: LLMConfig = {
    provider: providerName,
    model: overrides?.model || providerConfig.model || "default",
    options: { ...providerConfig.options, ...overrides?.options },
  };

  // Return a simple query function bound to this config
  return (prompt: string) => provider.query(prompt, llmConfig);
}

export { createOllamaProvider } from "./ollama.js";
export { createDeepSeekProvider } from "./deepseek.js";
