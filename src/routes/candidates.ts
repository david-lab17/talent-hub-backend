import { Router, type IRouter } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, invitationsTable, assessmentsTable, questionsTable, testCasesTable, submissionsTable, candidatesTable, submissionAnswersTable, evaluationResultsTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { runCode } from "../lib/code-runner.js";

const router: IRouter = Router();

const startAssessmentSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const autosaveSchema = z.object({
  questionId: z.number(),
  code: z.string(),
  language: z.string(),
});

// Get invitation details (public)
router.get("/invite/:token", async (req, res): Promise<void> => {
  const { token } = req.params;

  const [invitation] = await db.select().from(invitationsTable).where(eq(invitationsTable.token, token));
  if (!invitation) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }

  const [assessment] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, invitation.assessmentId));
  if (!assessment) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }

  const questions = await db.select().from(questionsTable).where(eq(questionsTable.assessmentId, assessment.id));

  let scoreData: { totalScore: number; maxScore: number; percentage: number } | null = null;
  if (invitation.status === "completed") {
    const [sub] = await db.select().from(submissionsTable).where(eq(submissionsTable.invitationId, invitation.id));
    if (sub) {
      scoreData = {
        totalScore: sub.totalScore ?? 0,
        maxScore: sub.maxScore ?? 0,
        percentage: sub.percentage ?? 0,
      };
    }
  }

  res.json({
    token: invitation.token,
    assessmentTitle: assessment.title,
    assessmentDescription: assessment.description,
    timeLimitMinutes: assessment.timeLimitMinutes,
    questionCount: questions.length,
    status: invitation.status,
    candidateEmail: invitation.candidateEmail,
    candidateName: invitation.candidateName,
    score: scoreData,
    // Indicate if link is already in use (but hide the actual email for privacy)
    isInUse: invitation.status === "started" && !!invitation.candidateEmail,
  });
});

// Start assessment (public)
router.post("/invite/:token/start", async (req, res): Promise<void> => {
  const { token } = req.params;

  const parsed = startAssessmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [invitation] = await db.select().from(invitationsTable).where(eq(invitationsTable.token, token));
  if (!invitation) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }

  if (invitation.status === "completed") {
    res.status(400).json({ error: "This assessment has already been completed" });
    return;
  }

  if (invitation.expiresAt && new Date() > invitation.expiresAt) {
    await db.update(invitationsTable).set({ status: "expired" }).where(eq(invitationsTable.id, invitation.id));
    res.status(400).json({ error: "This invitation has expired" });
    return;
  }

  const [assessment] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, invitation.assessmentId));
  if (!assessment) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }

  // If already started, verify it's the same candidate trying to resume
  if (invitation.status === "started") {
    // Check if email matches the original candidate
    if (invitation.candidateEmail && invitation.candidateEmail.toLowerCase() !== parsed.data.email.toLowerCase()) {
      res.status(403).json({
        error: "This invitation link has already been used by another candidate. Each invitation can only be used once."
      });
      return;
    }

    const existingSub = await db.select().from(submissionsTable).where(eq(submissionsTable.invitationId, invitation.id));
    if (existingSub.length > 0) {
      const sub = existingSub[0];
      const questions = await db.select().from(questionsTable).where(eq(questionsTable.assessmentId, assessment.id)).orderBy(questionsTable.orderIndex);
      const questionsWithData = await Promise.all(questions.map(async (q) => {
        const tcs = await db.select().from(testCasesTable).where(eq(testCasesTable.questionId, q.id));
        const answers = await db.select().from(submissionAnswersTable)
          .where(eq(submissionAnswersTable.submissionId, sub.id));
        const answer = answers.find(a => a.questionId === q.id);
        return {
          ...q,
          sampleTestCases: tcs.filter(tc => !tc.isHidden),
          savedCode: answer?.code ?? null,
          savedLanguage: answer?.language ?? null,
        };
      }));

      res.json({
        submissionId: sub.id,
        candidateToken: sub.candidateToken,
        assessmentTitle: assessment.title,
        timeLimitMinutes: assessment.timeLimitMinutes,
        startedAt: sub.startedAt,
        questions: questionsWithData,
      });
      return;
    }
  }

  // Create new candidate and submission
  const [candidate] = await db.insert(candidatesTable).values({
    name: parsed.data.name,
    email: parsed.data.email,
  }).returning();

  const candidateToken = uuidv4();
  const [submission] = await db.insert(submissionsTable).values({
    invitationId: invitation.id,
    assessmentId: assessment.id,
    candidateId: candidate.id,
    candidateToken,
  }).returning();

  await db.update(invitationsTable).set({
    status: "started",
    candidateName: parsed.data.name,
    candidateEmail: parsed.data.email,
  }).where(eq(invitationsTable.id, invitation.id));

  const questions = await db.select().from(questionsTable).where(eq(questionsTable.assessmentId, assessment.id)).orderBy(questionsTable.orderIndex);
  const questionsWithTestCases = await Promise.all(questions.map(async (q) => {
    const tcs = await db.select().from(testCasesTable).where(eq(testCasesTable.questionId, q.id));
    return {
      ...q,
      sampleTestCases: tcs.filter(tc => !tc.isHidden),
      savedCode: null,
      savedLanguage: null,
    };
  }));

  res.json({
    submissionId: submission.id,
    candidateToken,
    assessmentTitle: assessment.title,
    timeLimitMinutes: assessment.timeLimitMinutes,
    startedAt: submission.startedAt,
    questions: questionsWithTestCases,
  });
});

// Resume session (public)
router.get("/session/:token", async (req, res): Promise<void> => {
  const { token } = req.params;

  const [invitation] = await db.select().from(invitationsTable).where(eq(invitationsTable.token, token));
  if (!invitation) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }

  if (invitation.status !== "started") {
    res.status(404).json({ error: "No active session for this token" });
    return;
  }

  const [sub] = await db.select().from(submissionsTable).where(eq(submissionsTable.invitationId, invitation.id));
  if (!sub) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const [assessment] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, invitation.assessmentId));
  if (!assessment) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }

  const questions = await db.select().from(questionsTable).where(eq(questionsTable.assessmentId, assessment.id)).orderBy(questionsTable.orderIndex);
  const questionsWithData = await Promise.all(questions.map(async (q) => {
    const tcs = await db.select().from(testCasesTable).where(eq(testCasesTable.questionId, q.id));
    const answers = await db.select().from(submissionAnswersTable)
      .where(eq(submissionAnswersTable.submissionId, sub.id));
    const answer = answers.find(a => a.questionId === q.id);
    return {
      ...q,
      sampleTestCases: tcs.filter(tc => !tc.isHidden),
      savedCode: answer?.code ?? null,
      savedLanguage: answer?.language ?? null,
    };
  }));

  res.json({
    submissionId: sub.id,
    candidateToken: sub.candidateToken,
    assessmentTitle: assessment.title,
    timeLimitMinutes: assessment.timeLimitMinutes,
    startedAt: sub.startedAt,
    questions: questionsWithData,
  });
});

// Autosave answer (public)
router.patch("/submissions/:id/autosave", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid submission ID" });
    return;
  }

  const parsed = autosaveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select().from(submissionAnswersTable)
    .where(eq(submissionAnswersTable.submissionId, id));
  const existingAnswer = existing.find(a => a.questionId === parsed.data.questionId);

  if (existingAnswer) {
    await db.update(submissionAnswersTable)
      .set({ code: parsed.data.code, language: parsed.data.language })
      .where(eq(submissionAnswersTable.id, existingAnswer.id));
  } else {
    await db.insert(submissionAnswersTable).values({
      submissionId: id,
      questionId: parsed.data.questionId,
      code: parsed.data.code,
      language: parsed.data.language,
    });
  }

  res.json({ message: "Saved" });
});

// Submit assessment (public)
router.post("/submissions/:id/submit", async (req, res): Promise<void> => {
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

  // If already submitted, return existing results
  if (submission.submittedAt) {
    res.json({
      submissionId: submission.id,
      totalScore: submission.totalScore,
      maxScore: submission.maxScore,
      percentage: submission.percentage,
      status: submission.status,
      submittedAt: submission.submittedAt,
    });
    return;
  }

  const questions = await db.select().from(questionsTable).where(eq(questionsTable.assessmentId, submission.assessmentId));
  const answers = await db.select().from(submissionAnswersTable).where(eq(submissionAnswersTable.submissionId, submission.id));

  let totalScore = 0;
  let maxScore = 0;

  for (const question of questions) {
    const answer = answers.find(a => a.questionId === question.id);
    const testCases = await db.select().from(testCasesTable).where(eq(testCasesTable.questionId, question.id));
    maxScore += question.points;

    if (!answer || !answer.code) continue;

    const runResult = await runCode(answer.code, answer.language || "javascript", testCases.map(tc => ({
      id: tc.id,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      label: tc.label,
    })));

    const passed = runResult.results.filter(r => r.passed).length;
    const total = testCases.length;
    const score = total > 0 ? Math.round((passed / total) * question.points) : 0;
    totalScore += score;

    const status = total === 0 ? "failed" : passed === total ? "passed" : passed > 0 ? "partial" : "failed";

    await db.insert(evaluationResultsTable).values({
      submissionId: submission.id,
      questionId: question.id,
      score,
      maxScore: question.points,
      passedTestCases: passed,
      totalTestCases: total,
      status,
    });
  }

  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  const [assessment] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, submission.assessmentId));
  const threshold = assessment?.passThreshold ?? 70;
  const finalStatus = percentage >= threshold ? "passed" : percentage >= threshold * 0.6 ? "review" : "rejected";

  const [updated] = await db.update(submissionsTable).set({
    totalScore,
    maxScore,
    percentage,
    status: finalStatus,
    submittedAt: new Date(),
  }).where(eq(submissionsTable.id, submission.id)).returning();

  await db.update(invitationsTable).set({ status: "completed" }).where(eq(invitationsTable.id, submission.invitationId));

  res.json({
    submissionId: submission.id,
    totalScore,
    maxScore,
    percentage,
    status: finalStatus,
    submittedAt: updated.submittedAt,
  });
});

export default router;
