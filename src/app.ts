import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

// Logging
const httpLogger = (pinoHttp as any)({
  logger,
  serializers: {
    req(req: any) {
      return {
        id: req.id,
        method: req.method,
        url: req.url?.split("?")[0],
      };
    },
    res(res: any) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});
app.use(httpLogger);

// CORS - allow credentials for session cookies
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:5174"];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session management
const isProduction = process.env.NODE_ENV === "production";
const useSecureCookies = process.env.SECURE_COOKIES === "true"; // Only enable with HTTPS

app.use(session({
  secret: process.env.SESSION_SECRET || "interview-secret-key-change-in-prod",
  resave: false,
  saveUninitialized: false,
  proxy: true, // Trust the reverse proxy
  cookie: {
    secure: useSecureCookies,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: useSecureCookies ? "none" : "lax",
  },
}));

// API routes
app.use("/api", router);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
