export interface LLMOptions {
  temperature?: number;
  num_ctx?: number;
  max_tokens?: number;
}

export interface LLMConfig {
  provider: string;
  model: string;
  options?: LLMOptions;
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey?: string;
  model?: string;
  options?: LLMOptions;
}

export interface LLMProvider {
  name: string;
  query(prompt: string, config: LLMConfig): Promise<string>;
  stream?(
    prompt: string,
    config: LLMConfig,
    onChunk: (chunk: string) => void
  ): Promise<string>;
}

export type LLMQueryFn = (prompt: string) => Promise<string>;
