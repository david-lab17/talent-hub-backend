import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

// Admin Users table - for company admins who create assessments
export const adminUsersTable = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Assessments table - coding tests created by admins
export const assessmentsTable = pgTable("assessments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  timeLimitMinutes: integer("time_limit_minutes").notNull().default(60),
  status: text("status").notNull().default("draft"), // draft, published, archived
  passThreshold: integer("pass_threshold").notNull().default(70), // percentage to pass
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Language configuration type for questions
// Format: [{ language: "javascript", starterCode: "..." }, { language: "python", starterCode: "..." }]
export type LanguageConfig = {
  language: string;
  starterCode: string;
};

// Questions table - coding problems within an assessment
export const questionsTable = pgTable("questions", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull().references(() => assessmentsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  difficulty: text("difficulty").notNull().default("medium"), // easy, medium, hard
  points: integer("points").notNull().default(100),
  orderIndex: integer("order_index").notNull().default(0),
  starterCode: text("starter_code"), // Legacy: default starter code
  allowedLanguages: jsonb("allowed_languages").$type<LanguageConfig[]>(), // Array of {language, starterCode}
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Test Cases table - input/output pairs for evaluating code
export const testCasesTable = pgTable("test_cases", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull().references(() => questionsTable.id, { onDelete: "cascade" }),
  input: text("input").notNull(),
  expectedOutput: text("expected_output").notNull(),
  isHidden: boolean("is_hidden").notNull().default(false), // hidden test cases not shown to candidates
  label: text("label"),
});

// Invitations table - links sent to candidates
export const invitationsTable = pgTable("invitations", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull().references(() => assessmentsTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  candidateEmail: text("candidate_email"),
  candidateName: text("candidate_name"),
  status: text("status").notNull().default("pending"), // pending, started, completed, expired
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Candidates table - people taking assessments
export const candidatesTable = pgTable("candidates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Submissions table - candidate assessment attempts
export const submissionsTable = pgTable("submissions", {
  id: serial("id").primaryKey(),
  invitationId: integer("invitation_id").notNull().references(() => invitationsTable.id),
  assessmentId: integer("assessment_id").notNull().references(() => assessmentsTable.id),
  candidateId: integer("candidate_id").notNull().references(() => candidatesTable.id),
  candidateToken: text("candidate_token").notNull().unique(),
  totalScore: integer("total_score"),
  maxScore: integer("max_score"),
  percentage: integer("percentage"),
  status: text("status"), // passed, failed, review
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
});

// Submission Answers table - code written by candidates for each question
export const submissionAnswersTable = pgTable("submission_answers", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => submissionsTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => questionsTable.id),
  code: text("code"),
  language: text("language"), // javascript, python
});

// Evaluation Results table - test results for each question
export const evaluationResultsTable = pgTable("evaluation_results", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => submissionsTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => questionsTable.id),
  score: integer("score").notNull().default(0),
  maxScore: integer("max_score").notNull().default(100),
  passedTestCases: integer("passed_test_cases").notNull().default(0),
  totalTestCases: integer("total_test_cases").notNull().default(0),
  status: text("status").notNull().default("failed"), // passed, partial, failed
});

// Type exports
export type AdminUser = typeof adminUsersTable.$inferSelect;
export type InsertAdminUser = typeof adminUsersTable.$inferInsert;

export type Assessment = typeof assessmentsTable.$inferSelect;
export type InsertAssessment = typeof assessmentsTable.$inferInsert;

export type Question = typeof questionsTable.$inferSelect;
export type InsertQuestion = typeof questionsTable.$inferInsert;

export type TestCase = typeof testCasesTable.$inferSelect;
export type InsertTestCase = typeof testCasesTable.$inferInsert;

export type Invitation = typeof invitationsTable.$inferSelect;
export type InsertInvitation = typeof invitationsTable.$inferInsert;

export type Candidate = typeof candidatesTable.$inferSelect;
export type InsertCandidate = typeof candidatesTable.$inferInsert;

export type Submission = typeof submissionsTable.$inferSelect;
export type InsertSubmission = typeof submissionsTable.$inferInsert;

export type SubmissionAnswer = typeof submissionAnswersTable.$inferSelect;
export type InsertSubmissionAnswer = typeof submissionAnswersTable.$inferInsert;

export type EvaluationResult = typeof evaluationResultsTable.$inferSelect;
export type InsertEvaluationResult = typeof evaluationResultsTable.$inferInsert;
