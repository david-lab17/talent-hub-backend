import { Router, type IRouter } from "express";
import { db, assessmentsTable, questionsTable, testCasesTable, submissionsTable } from "../db/index.js";
import { eq, count } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";

const router: IRouter = Router();

const createAssessmentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  timeLimitMinutes: z.number().min(1).default(60),
  passThreshold: z.number().min(0).max(100).default(70),
});

const updateAssessmentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  timeLimitMinutes: z.number().min(1).optional(),
  passThreshold: z.number().min(0).max(100).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

router.get("/assessments", requireAdmin, async (req, res): Promise<void> => {
  const assessments = await db.select().from(assessmentsTable).orderBy(assessmentsTable.createdAt);

  const result = await Promise.all(
    assessments.map(async (a) => {
      const [qCount] = await db.select({ count: count() }).from(questionsTable).where(eq(questionsTable.assessmentId, a.id));
      const [sCount] = await db.select({ count: count() }).from(submissionsTable).where(eq(submissionsTable.assessmentId, a.id));
      return {
        ...a,
        questionCount: Number(qCount?.count ?? 0),
        submissionCount: Number(sCount?.count ?? 0),
      };
    })
  );

  res.json(result);
});

router.post("/assessments", requireAdmin, async (req, res): Promise<void> => {
  const parsed = createAssessmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [assessment] = await db.insert(assessmentsTable).values(parsed.data).returning();
  res.status(201).json(assessment);
});

router.get("/assessments/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid assessment ID" });
    return;
  }

  const [assessment] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, id));
  if (!assessment) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }

  const questions = await db.select().from(questionsTable).where(eq(questionsTable.assessmentId, id)).orderBy(questionsTable.orderIndex);
  const questionsWithTestCases = await Promise.all(
    questions.map(async (q) => {
      const tcs = await db.select().from(testCasesTable).where(eq(testCasesTable.questionId, q.id));
      return { ...q, testCases: tcs };
    })
  );

  res.json({ ...assessment, questions: questionsWithTestCases });
});

router.patch("/assessments/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid assessment ID" });
    return;
  }

  const parsed = updateAssessmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [assessment] = await db.update(assessmentsTable).set(parsed.data).where(eq(assessmentsTable.id, id)).returning();
  if (!assessment) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }
  res.json(assessment);
});

router.delete("/assessments/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid assessment ID" });
    return;
  }

  const [deleted] = await db.delete(assessmentsTable).where(eq(assessmentsTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/assessments/:id/publish", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid assessment ID" });
    return;
  }

  const [assessment] = await db.update(assessmentsTable)
    .set({ status: "published" })
    .where(eq(assessmentsTable.id, id))
    .returning();

  if (!assessment) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }
  res.json(assessment);
});

export default router;
