import { Router, type IRouter } from "express";
import { db, testCasesTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { runCode, SUPPORTED_LANGUAGES } from "../lib/code-runner.js";

const router: IRouter = Router();

// Get supported language IDs
const supportedLanguageIds = SUPPORTED_LANGUAGES.map(l => l.id) as [string, ...string[]];

const executeCodeSchema = z.object({
  questionId: z.number(),
  code: z.string(),
  language: z.enum(supportedLanguageIds),
});

router.post("/execute", async (req, res): Promise<void> => {
  const parsed = executeCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { questionId, code, language } = parsed.data;

  const testCases = await db.select().from(testCasesTable)
    .where(eq(testCasesTable.questionId, questionId));

  // Only run sample (non-hidden) test cases during practice
  const sampleTestCases = testCases.filter(tc => !tc.isHidden);

  if (sampleTestCases.length === 0) {
    res.json({ results: [], stdout: null, stderr: "No sample test cases found" });
    return;
  }

  try {
    const result = await runCode(code, language, sampleTestCases.map(tc => ({
      id: tc.id,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      label: tc.label,
    })));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      error: "Code execution failed",
      results: [],
      stdout: null,
      stderr: error.message || "Unknown error",
    });
  }
});

// Endpoint to get supported languages
router.get("/languages", (_req, res): void => {
  res.json(SUPPORTED_LANGUAGES);
});

export default router;
