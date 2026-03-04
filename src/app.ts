import express, { Request, Response, NextFunction } from "express";
import path from "path";
import rateLimit from "express-rate-limit";
import * as pronote from "@niicojs/pawnote";
import { logger } from "./logger";
import { children } from "./state";
import { login, loginAll } from "./auth/login";
import { setForceLogin, errorCount, setErrorCount, lastLoginTime } from "./state";

import lessonsRouter from "./routes/lessons";
import homeworkRouter from "./routes/homework";
import discussionsRouter from "./routes/discussions";
import menusRouter from "./routes/menus";
import surveysRouter from "./routes/surveys";
import periodsRouter from "./routes/periods";
import dataperiodRouter from "./routes/dataperiod";

export const app = express();

// Rate limiting: 2 requests/second per IP
const limiter = rateLimit({
  windowMs: 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Static files
app.use("/static", express.static(path.join(process.cwd(), "static")));

// Home page
app.get("/", (_req: Request, res: Response) => {
  const childNames = [...children.keys()];
  let html = "";
  try {
    const fs = require("fs") as typeof import("fs");
    let template = fs.readFileSync(
      path.join(process.cwd(), "templates", "home.html"),
      "utf-8"
    );
    // Replace Jinja2 for loop with child names
    template = template.replace(
      /\{%\s*for child in children\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g,
      (_match, body: string) =>
        childNames.map((name) => body.replace(/\{\{\s*child\s*\}\}/g, name)).join("")
    );
    html = template;
  } catch {
    html = `<html><body><h2>Welcome to pronote for ${childNames.join(", ")}</h2></body></html>`;
  }
  res.send(html);
});

// Favicon
app.get("/favicon.ico", (_req: Request, res: Response) => {
  res.redirect("/static/favicon.ico");
});

// Login endpoint
app.get("/login", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await loginAll(true); // force browser flow for all accounts
    res.send("OK");
  } catch (err) {
    next(err);
  }
});

// Data routes (order matters: specific before generic)
app.use(lessonsRouter);
app.use(homeworkRouter);
app.use(discussionsRouter);
app.use(menusRouter);
app.use(surveysRouter);
app.use(periodsRouter);
app.use(dataperiodRouter); // catch-all /:type route must be last

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof pronote.AccessDeniedError) {
    logger.warn(`Access denied: ${err.message}`);
  } else {
    logger.error(`Error: ${err.message}`);
    logger.error(err.stack ?? "");
  }

  // On session expired or access denied: re-login to resync session sequence counter.
  // Debounce: skip if last login was within the past 60 seconds.
  const isSessionError =
    err instanceof pronote.SessionExpiredError || err instanceof pronote.AccessDeniedError;
  if (isSessionError && Date.now() - lastLoginTime > 60_000) {
    setForceLogin(true);
    login().catch((e: unknown) => {
      logger.warn(`Auto re-login failed: ${e}`);
      setErrorCount(errorCount + 1);
    });
  }

  const statusCode = err instanceof pronote.AccessDeniedError
    ? 403
    : (err as NodeJS.ErrnoException & { statusCode?: number }).statusCode ?? 500;

  res.status(statusCode).json({
    success: false,
    error: {
      code: statusCode,
      type: err.constructor.name,
      message: err.message,
    },
  });
});
