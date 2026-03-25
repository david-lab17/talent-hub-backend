import { Router, type IRouter } from "express";
import { db, submissionsTable, assessmentsTable, candidatesTable, evaluationResultsTable, questionsTable, submissionAnswersTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth.js";

const router: IRouter = Router();

// Dashboard stats
router.get("/admin/dashboard", requireAdmin, async (req, res): Promise<void> => {
  const allAssessments = await db.select().from(assessmentsTable);
  const totalAssessments = allAssessments.length;
  const activeAssessments = allAssessments.filter(a => a.status === "published").length;

  const allSubmissions = await db.select().from(submissionsTable);
  const totalSubmissions = allSubmissions.length;
  const pendingReview = allSubmissions.filter(s => s.status === "review").length;
  const completedSubs = allSubmissions.filter(s => s.status === "passed" || s.status === "rejected" || s.status === "review");
  const passedSubs = allSubmissions.filter(s => s.status === "passed");
  const passRate = completedSubs.length > 0 ? Math.round((passedSubs.length / completedSubs.length) * 100) : 0;

  const recent = await db.select().from(submissionsTable)
    .orderBy(submissionsTable.startedAt)
    .limit(10);

  const recentWithDetails = await Promise.all(recent.map(async (s) => {
    const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, s.candidateId));
    const [assessment] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, s.assessmentId));
    return {
      id: s.id,
      candidateName: candidate?.name ?? null,
      candidateEmail: candidate?.email ?? null,
      assessmentTitle: assessment?.title ?? "Unknown",
      assessmentId: s.assessmentId,
      totalScore: s.totalScore,
      maxScore: s.maxScore,
      percentage: s.percentage,
      status: s.status,
      submittedAt: s.submittedAt,
      startedAt: s.startedAt,
    };
  }));

  res.json({
    totalAssessments,
    activeAssessments,
    totalSubmissions,
    pendingReview,
    passRate,
    recentSubmissions: recentWithDetails,
  });
});

// List all submissions
router.get("/admin/submissions", requireAdmin, async (req, res): Promise<void> => {
  const submissions = await db.select().from(submissionsTable).orderBy(submissionsTable.startedAt);
  const result = await Promise.all(submissions.map(async (s) => {
    const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, s.candidateId));
    const [assessment] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, s.assessmentId));
    return {
      id: s.id,
      candidateName: candidate?.name ?? null,
      candidateEmail: candidate?.email ?? null,
      assessmentTitle: assessment?.title ?? "Unknown",
      assessmentId: s.assessmentId,
      totalScore: s.totalScore,
      maxScore: s.maxScore,
      percentage: s.percentage,
      status: s.status,
      submittedAt: s.submittedAt,
      startedAt: s.startedAt,
    };
  }));
  res.json(result);
});

// Get submission detail
router.get("/admin/submissions/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid submission ID" });
    return;
  }

  const [submission] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, id));
  if (!submission) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, submission.candidateId));
  const [assessment] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, submission.assessmentId));
  const answers = await db.select().from(submissionAnswersTable).where(eq(submissionAnswersTable.submissionId, submission.id));
  const evalResults = await db.select().from(evaluationResultsTable).where(eq(evaluationResultsTable.submissionId, submission.id));
  const questions = await db.select().from(questionsTable).where(eq(questionsTable.assessmentId, submission.assessmentId));

  const answerDetails = questions.map(q => {
    const answer = answers.find(a => a.questionId === q.id);
    const evalResult = evalResults.find(e => e.questionId === q.id);
    return {
      questionId: q.id,
      questionTitle: q.title,
      questionDifficulty: q.difficulty,
      code: answer?.code ?? null,
      language: answer?.language ?? null,
      score: evalResult?.score ?? null,
      maxScore: q.points,
      passedTestCases: evalResult?.passedTestCases ?? null,
      totalTestCases: evalResult?.totalTestCases ?? null,
      status: evalResult?.status ?? null,
    };
  });

  res.json({
    id: submission.id,
    candidateName: candidate?.name ?? null,
    candidateEmail: candidate?.email ?? null,
    assessmentTitle: assessment?.title ?? "Unknown",
    assessmentId: submission.assessmentId,
    totalScore: submission.totalScore,
    maxScore: submission.maxScore,
    percentage: submission.percentage,
    status: submission.status,
    submittedAt: submission.submittedAt,
    startedAt: submission.startedAt,
    answers: answerDetails,
  });
});

// Update submission status
router.patch("/admin/submissions/:id/status", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid submission ID" });
    return;
  }

  const { status } = req.body as { status: string };
  const allowed = ["passed", "rejected", "review"];
  if (!allowed.includes(status)) {
    res.status(400).json({ error: `Status must be one of: ${allowed.join(", ")}` });
    return;
  }

  const [submission] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, id));
  if (!submission) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  const [updated] = await db.update(submissionsTable)
    .set({ status })
    .where(eq(submissionsTable.id, id))
    .returning();

  res.json({ id: updated.id, status: updated.status });
});

export default router;
