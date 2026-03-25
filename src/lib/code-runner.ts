/**
 * Code Runner using Piston API
 *
 * Piston is a secure code execution engine that supports 50+ languages.
 * Run Piston locally with Docker:
 *   docker run -d --name piston -p 2000:2000 ghcr.io/engineer-man/piston
 *
 * Or use the public API (rate limited):
 *   https://emkc.org/api/v2/piston
 */

export interface TestCaseRunResult {
  testCaseId: number;
  input: string;
  expectedOutput: string;
  actualOutput: string | null;
  passed: boolean;
  error: string | null;
  label: string | null;
}

export interface RunResult {
  results: TestCaseRunResult[];
  stdout: string | null;
  stderr: string | null;
}

export interface TestCaseInput {
  id: number;
  input: string;
  expectedOutput: string;
  label: string | null;
}

// Piston API configuration
const PISTON_API_URL = process.env.PISTON_API_URL || "http://localhost:2000/api/v2";
const PISTON_PUBLIC_API = "https://emkc.org/api/v2/piston";

// Language mappings for Piston
const LANGUAGE_CONFIG: Record<string, { language: string; version: string; filename: string }> = {
  javascript: { language: "javascript", version: "18.15.0", filename: "solution.js" },
  python: { language: "python", version: "3.10.0", filename: "solution.py" },
  java: { language: "java", version: "15.0.2", filename: "Solution.java" },
  c: { language: "c", version: "10.2.0", filename: "solution.c" },
  cpp: { language: "c++", version: "10.2.0", filename: "solution.cpp" },
  go: { language: "go", version: "1.16.2", filename: "solution.go" },
  rust: { language: "rust", version: "1.68.2", filename: "solution.rs" },
  typescript: { language: "typescript", version: "5.0.3", filename: "solution.ts" },
  ruby: { language: "ruby", version: "3.0.1", filename: "solution.rb" },
  php: { language: "php", version: "8.2.3", filename: "solution.php" },
  swift: { language: "swift", version: "5.3.3", filename: "solution.swift" },
  kotlin: { language: "kotlin", version: "1.8.20", filename: "solution.kt" },
  csharp: { language: "csharp", version: "6.12.0", filename: "Solution.cs" },
};

function normalizeOutput(output: string): string {
  return output.trim().replace(/\r\n/g, "\n");
}

interface PistonExecuteResponse {
  language: string;
  version: string;
  run: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
  compile?: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
}

async function executeWithPiston(
  code: string,
  language: string,
  stdin: string
): Promise<{ output: string; error: string | null }> {
  const config = LANGUAGE_CONFIG[language];

  if (!config) {
    return { output: "", error: `Unsupported language: ${language}` };
  }

  // Try local Piston first, fallback to public API
  const apiUrls = [PISTON_API_URL, PISTON_PUBLIC_API];

  for (const baseUrl of apiUrls) {
    try {
      const response = await fetch(`${baseUrl}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: config.language,
          version: config.version,
          files: [
            {
              name: config.filename,
              content: code,
            },
          ],
          stdin: stdin,
          compile_timeout: 10000,
          run_timeout: 5000,
          compile_memory_limit: -1,
          run_memory_limit: -1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Piston API error (${baseUrl}):`, errorText);
        continue; // Try next API
      }

      const result: PistonExecuteResponse = await response.json();

      // Check for compilation errors
      if (result.compile && result.compile.code !== 0) {
        return {
          output: "",
          error: result.compile.stderr || result.compile.output || "Compilation error",
        };
      }

      // Check for runtime errors
      if (result.run.code !== 0 || result.run.signal) {
        const errorMsg = result.run.stderr || result.run.output || "Runtime error";
        return {
          output: result.run.stdout || "",
          error: errorMsg.substring(0, 500),
        };
      }

      return {
        output: normalizeOutput(result.run.stdout || result.run.output || ""),
        error: result.run.stderr ? result.run.stderr.substring(0, 500) : null,
      };
    } catch (err: any) {
      console.error(`Failed to connect to Piston at ${baseUrl}:`, err.message);
      continue; // Try next API
    }
  }

  return {
    output: "",
    error: "Code execution service unavailable. Please try again later.",
  };
}

export async function runCode(
  code: string,
  language: string,
  testCases: TestCaseInput[]
): Promise<RunResult> {
  const results: TestCaseRunResult[] = [];
  const allStdout: string[] = [];
  const allStderr: string[] = [];

  for (const tc of testCases) {
    const runResult = await executeWithPiston(code, language, tc.input);

    const actualOutput = runResult.output;
    const passed = runResult.error === null && normalizeOutput(actualOutput) === normalizeOutput(tc.expectedOutput);

    if (actualOutput) allStdout.push(actualOutput);
    if (runResult.error) allStderr.push(runResult.error);

    results.push({
      testCaseId: tc.id,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      actualOutput: runResult.error ? null : actualOutput,
      passed,
      error: runResult.error,
      label: tc.label,
    });
  }

  return {
    results,
    stdout: allStdout.length > 0 ? allStdout.join("\n---\n") : null,
    stderr: allStderr.length > 0 ? allStderr.join("\n---\n") : null,
  };
}

// Supported languages list
export const SUPPORTED_LANGUAGES = [
  { id: "javascript", name: "JavaScript", extension: "js" },
  { id: "typescript", name: "TypeScript", extension: "ts" },
  { id: "python", name: "Python", extension: "py" },
  { id: "java", name: "Java", extension: "java" },
  { id: "c", name: "C", extension: "c" },
  { id: "cpp", name: "C++", extension: "cpp" },
  { id: "csharp", name: "C#", extension: "cs" },
  { id: "go", name: "Go", extension: "go" },
  { id: "rust", name: "Rust", extension: "rs" },
  { id: "ruby", name: "Ruby", extension: "rb" },
  { id: "php", name: "PHP", extension: "php" },
  { id: "swift", name: "Swift", extension: "swift" },
  { id: "kotlin", name: "Kotlin", extension: "kt" },
];

// Get available runtimes from Piston
export async function getAvailableRuntimes(): Promise<string[]> {
  try {
    const response = await fetch(`${PISTON_API_URL}/runtimes`);
    if (!response.ok) {
      // Try public API
      const publicResponse = await fetch(`${PISTON_PUBLIC_API}/runtimes`);
      if (!publicResponse.ok) return [];
      const runtimes = await publicResponse.json();
      return runtimes.map((r: any) => r.language);
    }
    const runtimes = await response.json();
    return runtimes.map((r: any) => r.language);
  } catch {
    return [];
  }
}
