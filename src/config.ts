import { readFile } from "fs/promises";
import { resolve } from "path";

export interface LLMOptions {
  temperature?: number;
  num_ctx?: number;
  max_tokens?: number;
}

export interface LLMConfig {
  provider: string;
  model?: string;
  options?: LLMOptions;
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey?: string;
  model?: string;
  options?: LLMOptions;
}

export interface SandboxConfig {
  maxSubCalls: number;
  turnTimeoutMs: number;
  memoryLimitMb: number;
}

export interface RLMConfig {
  maxTurns: number;
}

export interface Config {
  llm: LLMConfig;
  providers: Record<string, ProviderConfig>;
  sandbox: SandboxConfig;
  rlm: RLMConfig;
}

const DEFAULT_CONFIG: Config = {
  llm: {
    provider: "ollama",
  },
  providers: {
    ollama: {
      baseUrl: "http://localhost:11434",
      model: "qwen3-coder:30b",
      options: {
        temperature: 0.2,
        num_ctx: 8192,
      },
    },
  },
  sandbox: {
    maxSubCalls: 10,
    turnTimeoutMs: 30000,
    memoryLimitMb: 128,
  },
  rlm: {
    maxTurns: 10,
  },
};

export async function loadConfig(configPath?: string): Promise<Config> {
  const path = configPath || resolve(process.cwd(), "config.json");

  try {
    const content = await readFile(path, "utf-8");
    const userConfig = JSON.parse(content) as Partial<Config>;

    // Deep merge with defaults
    return {
      llm: { ...DEFAULT_CONFIG.llm, ...userConfig.llm },
      providers: { ...DEFAULT_CONFIG.providers, ...userConfig.providers },
      sandbox: { ...DEFAULT_CONFIG.sandbox, ...userConfig.sandbox },
      rlm: { ...DEFAULT_CONFIG.rlm, ...userConfig.rlm },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // Config file not found, use defaults
      return DEFAULT_CONFIG;
    }
    throw error;
  }
}

export function resolveEnvVars(value: string): string {
  // Match ${VAR_NAME} pattern
  const envVarPattern = /\$\{([^}]+)\}/g;
  return value.replace(envVarPattern, (_, varName) => {
    const envValue = process.env[varName];
    if (!envValue) {
      throw new Error(`Environment variable ${varName} not set`);
    }
    return envValue;
  });
}
