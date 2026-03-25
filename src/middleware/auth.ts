import { type Request, type Response, type NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    adminUserId: number;
    adminEmail: string;
    adminName: string;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.adminUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
