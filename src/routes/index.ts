import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import assessmentsRouter from "./assessments.js";
import questionsRouter from "./questions.js";
import invitationsRouter from "./invitations.js";
import candidatesRouter from "./candidates.js";
import executeRouter from "./execute.js";
import adminRouter from "./admin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(assessmentsRouter);
router.use(questionsRouter);
router.use(invitationsRouter);
router.use(candidatesRouter);
router.use(executeRouter);
router.use(adminRouter);

export default router;
