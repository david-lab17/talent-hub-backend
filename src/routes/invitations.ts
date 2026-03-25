import { Router, type IRouter } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, invitationsTable, assessmentsTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";

const router: IRouter = Router();

const createInvitationSchema = z.object({
  candidateEmail: z.string().email().optional(),
  candidateName: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

router.post("/assessments/:id/invitations", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid assessment ID" });
    return;
  }

  const parsed = createInvitationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [assessment] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, id));
  if (!assessment) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }

  const token = uuidv4();
  const [invitation] = await db.insert(invitationsTable).values({
    assessmentId: id,
    token,
    candidateEmail: parsed.data.candidateEmail ?? null,
    candidateName: parsed.data.candidateName ?? null,
    status: "pending",
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
  }).returning();

  res.status(201).json(invitation);
});

router.get("/assessments/:id/invitations", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid assessment ID" });
    return;
  }

  const invitations = await db.select().from(invitationsTable)
    .where(eq(invitationsTable.assessmentId, id))
    .orderBy(invitationsTable.createdAt);

  res.json(invitations);
});

export default router;
