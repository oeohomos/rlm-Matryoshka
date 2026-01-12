/**
 * Lightweight code fixer for common LLM-generated syntax errors
 * Attempts to fix issues before sandbox execution to minimize retries
 */

import vm from "node:vm";

export interface FixResult {
  code: string;
  fixed: boolean;
  fixes: string[];
}

/**
 * Check if code has valid syntax
 */
export function checkSyntax(code: string): { valid: boolean; error?: string } {
  try {
    // Wrap in async IIFE like sandbox does
    const wrapped = `(async () => { ${code} })()`;
    new vm.Script(wrapped);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}

/**
 * Apply common fixes to code
 */
export function fixCode(code: string): FixResult {
  const fixes: string[] = [];
  let fixedCode = code;

  // ALWAYS remove imports/requires/exports first - they will fail at runtime in sandbox
  // Do this even for syntactically valid code

  // Remove import statements
  const beforeImport = fixedCode;
  fixedCode = fixedCode.replace(/^import\s+.*?from\s+['"].*?['"];?\s*\n?/gm, "");
  if (fixedCode !== beforeImport) {
    fixes.push("Removed import statements");
  }

  const beforeRequire = fixedCode;
  fixedCode = fixedCode.replace(/^const\s+\w+\s*=\s*require\s*\(['"].*?['"]\);?\s*\n?/gm, "");
  if (fixedCode !== beforeRequire) {
    fixes.push("Removed require statements");
  }

  // Remove export statements
  const beforeExport = fixedCode;
  fixedCode = fixedCode.replace(/^export\s+(default\s+)?/gm, "");
  if (fixedCode !== beforeExport) {
    fixes.push("Removed export statements");
  }

  // If we made changes for runtime compatibility, check if code is now valid
  if (fixes.length > 0) {
    const afterRuntimeFixes = checkSyntax(fixedCode);
    if (afterRuntimeFixes.valid) {
      return { code: fixedCode, fixed: true, fixes };
    }
  }

  // Check if original code (after runtime fixes) is already syntactically valid
  const initial = checkSyntax(fixedCode);
  if (initial.valid) {
    // No further fixes needed
    if (fixes.length > 0) {
      return { code: fixedCode, fixed: true, fixes };
    }
    return { code: fixedCode, fixed: false, fixes: [] };
  }

  // Code has syntax errors - apply additional fixes

  // Fix: Fix common template literal issues (unescaped backticks)
  // This is tricky - skip for now

  // Fix: Remove TypeScript type annotations that might cause issues
  // Simple cases: `: string`, `: number`, `: any`, etc.
  const beforeTypes = fixedCode;
  fixedCode = fixedCode.replace(/:\s*(string|number|boolean|any|void|unknown|object|never)(\[\])?\s*([=,)\]}]|$)/g, "$3");
  if (fixedCode !== beforeTypes) {
    fixes.push("Removed TypeScript type annotations");
  }

  // Fix 5: Fix interface/type declarations (not valid JS)
  const beforeInterface = fixedCode;
  fixedCode = fixedCode.replace(/^(interface|type)\s+\w+\s*\{[^}]*\}\s*\n?/gm, "");
  fixedCode = fixedCode.replace(/^type\s+\w+\s*=\s*[^;]+;\s*\n?/gm, "");
  if (fixedCode !== beforeInterface) {
    fixes.push("Removed TypeScript interface/type declarations");
  }

  // Fix 6: Add missing semicolons after common patterns
  // After closing braces that aren't part of control flow
  fixedCode = fixedCode.replace(/\}(\s*)(const|let|var|function|class|if|for|while|switch|return|throw|console|memory|await)/g, "};\n$2");

  // Fix 7: Remove trailing commas in function calls (less common issue)
  fixedCode = fixedCode.replace(/,(\s*)\)/g, "$1)");
  fixedCode = fixedCode.replace(/,(\s*)\]/g, "$1]");

  // Check if fixes helped
  const afterFixes = checkSyntax(fixedCode);
  if (afterFixes.valid) {
    if (fixes.length === 0) fixes.push("Applied automatic syntax fixes");
    return { code: fixedCode, fixed: true, fixes };
  }

  // If still invalid, try more aggressive fixes

  // Fix 8: Balance brackets/braces
  const openBraces = (fixedCode.match(/\{/g) || []).length;
  const closeBraces = (fixedCode.match(/\}/g) || []).length;
  if (openBraces > closeBraces) {
    fixedCode += "\n" + "}".repeat(openBraces - closeBraces);
    fixes.push(`Added ${openBraces - closeBraces} missing closing brace(s)`);
  }

  const openParens = (fixedCode.match(/\(/g) || []).length;
  const closeParens = (fixedCode.match(/\)/g) || []).length;
  if (openParens > closeParens) {
    fixedCode += ")".repeat(openParens - closeParens);
    fixes.push(`Added ${openParens - closeParens} missing closing paren(s)`);
  }

  const openBrackets = (fixedCode.match(/\[/g) || []).length;
  const closeBrackets = (fixedCode.match(/\]/g) || []).length;
  if (openBrackets > closeBrackets) {
    fixedCode += "]".repeat(openBrackets - closeBrackets);
    fixes.push(`Added ${openBrackets - closeBrackets} missing closing bracket(s)`);
  }

  // Final check
  const finalCheck = checkSyntax(fixedCode);
  return {
    code: fixedCode,
    fixed: finalCheck.valid && fixes.length > 0,
    fixes: finalCheck.valid ? fixes : [],
  };
}

/**
 * Attempt to fix code and return result
 * Returns original code if fixes don't help
 */
export function tryFixCode(code: string): FixResult {
  const result = fixCode(code);

  // If fixes didn't make it valid, return original
  if (!result.fixed && !checkSyntax(code).valid && !checkSyntax(result.code).valid) {
    return { code, fixed: false, fixes: [] };
  }

  return result;
}
