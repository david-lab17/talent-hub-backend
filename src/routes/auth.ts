import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, adminUsersTable } from "../db/index.js";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth.js";
import { z } from "zod";

const router: IRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  req.session.adminUserId = user.id;
  req.session.adminEmail = user.email;
  req.session.adminName = user.name;

  // Explicitly save session before responding to ensure cookie is set
  req.session.save((err) => {
    if (err) {
      console.log("Session save error:", err);
      res.status(500).json({ error: "Session error" });
      return;
    }
    console.log("=== Login success ===");
    console.log("Session ID created:", req.session.id);
    console.log("Set-Cookie will be sent");
    res.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

router.get("/auth/me", (req, res, next) => {
  // Debug logging - remove after fixing
  console.log("=== /auth/me debug ===");
  console.log("Session ID:", req.session?.id);
  console.log("Session data:", req.session?.adminUserId ? "has user" : "empty");
  console.log("Cookies received:", req.headers.cookie ? "yes" : "no");
  console.log("Origin:", req.headers.origin);
  next();
}, requireAdmin, async (req, res): Promise<void> => {
  res.json({
    id: req.session.adminUserId,
    email: req.session.adminEmail,
    name: req.session.adminName,
  });
});

export default router;
