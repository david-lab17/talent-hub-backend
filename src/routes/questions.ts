import { Router, type IRouter } from "express";
import { db, questionsTable, testCasesTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";

const router: IRouter = Router();

// Language configuration schema
const languageConfigSchema = z.object({
  language: z.string(),
  starterCode: z.string(),
});

const createQuestionSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  points: z.number().min(1).default(100),
  starterCode: z.string().optional(), // Legacy field
  allowedLanguages: z.array(languageConfigSchema).optional(),
});

const updateQuestionSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  points: z.number().min(1).optional(),
  starterCode: z.string().optional(),
  orderIndex: z.number().optional(),
  allowedLanguages: z.array(languageConfigSchema).optional(),
});

const createTestCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  isHidden: z.boolean().default(false),
  label: z.string().optional(),
});

const updateTestCaseSchema = z.object({
  input: z.string().optional(),
  expectedOutput: z.string().optional(),
  isHidden: z.boolean().optional(),
  label: z.string().optional(),
});

// Question routes
router.get("/assessments/:id/questions", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid assessment ID" });
    return;
  }
  const questions = await db.select().from(questionsTable).where(eq(questionsTable.assessmentId, id)).orderBy(questionsTable.orderIndex);
  res.json(questions);
});

router.post("/assessments/:id/questions", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid assessment ID" });
    return;
  }

  const parsed = createQuestionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existingQuestions = await db.select().from(questionsTable).where(eq(questionsTable.assessmentId, id));
  const orderIndex = existingQuestions.length;

  const [question] = await db.insert(questionsTable).values({
    ...parsed.data,
    assessmentId: id,
    orderIndex,
  }).returning();

  res.status(201).json(question);
});

router.get("/questions/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid question ID" });
    return;
  }

  const [question] = await db.select().from(questionsTable).where(eq(questionsTable.id, id));
  if (!question) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  const testCases = await db.select().from(testCasesTable).where(eq(testCasesTable.questionId, id));
  res.json({ ...question, testCases });
});

router.patch("/questions/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid question ID" });
    return;
  }

  const parsed = updateQuestionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [question] = await db.update(questionsTable).set(parsed.data).where(eq(questionsTable.id, id)).returning();
  if (!question) {
    res.status(404).json({ error: "Question not found" });
    return;
  }
  res.json(question);
});

router.delete("/questions/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid question ID" });
    return;
  }
  const [deleted] = await db.delete(questionsTable).where(eq(questionsTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Question not found" });
    return;
  }
  res.sendStatus(204);
});

// Test case routes
router.get("/questions/:id/testcases", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid question ID" });
    return;
  }
  const testCases = await db.select().from(testCasesTable).where(eq(testCasesTable.questionId, id));
  res.json(testCases);
});

router.post("/questions/:id/testcases", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid question ID" });
    return;
  }

  const parsed = createTestCaseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tc] = await db.insert(testCasesTable).values({ ...parsed.data, questionId: id }).returning();
  res.status(201).json(tc);
});

router.patch("/testcases/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid test case ID" });
    return;
  }

  const parsed = updateTestCaseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tc] = await db.update(testCasesTable).set(parsed.data).where(eq(testCasesTable.id, id)).returning();
  if (!tc) {
    res.status(404).json({ error: "Test case not found" });
    return;
  }
  res.json(tc);
});

router.delete("/testcases/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid test case ID" });
    return;
  }
  const [deleted] = await db.delete(testCasesTable).where(eq(testCasesTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Test case not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
