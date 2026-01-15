/**
 * Version utility - reads version from package.json
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let cachedVersion: string | null = null;

/**
 * Get the package version from package.json
 */
export function getVersion(): string {
  if (cachedVersion !== null) {
    return cachedVersion;
  }

  try {
    // Get the directory of this file
    const __dirname = dirname(fileURLToPath(import.meta.url));
    // Go up from dist/ or src/ to find package.json
    const packagePath = join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
    cachedVersion = packageJson.version || "unknown";
  } catch {
    cachedVersion = "unknown";
  }

  return cachedVersion as string;
}
