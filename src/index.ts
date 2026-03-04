import { loadConfig, config } from "./config";
import { logger } from "./logger";
import { loginAll } from "./auth/login";
import { cronRefresh } from "./auth/login";
import { app } from "./app";
import cron from "node-cron";

async function main(): Promise<void> {
  // Load configuration
  loadConfig();

  const debug = process.env.DEBUG === "true";
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;

  logger.info("Starting pronote-rest (TypeScript/Express)");

  // Initial login: try token refresh first; fall back to full browser flow if needed
  try {
    await loginAll();
  } catch (err) {
    // Stale jeton or expired token: retry with forced browser flow
    logger.warn(`Initial login failed (${err}), retrying with full EduConnect browser flow...`);
    try {
      await loginAll(true);
    } catch (err2) {
      logger.error(`Initial login failed after retry: ${err2}`);
      process.exit(1);
    }
  }

  // Schedule periodic refresh if configured
  const refreshSeconds = config.refresh_login;
  if (refreshSeconds !== undefined && refreshSeconds > 0) {
    logger.info(`Adding cron job to refresh login every ${refreshSeconds}s`);
    // node-cron uses cron syntax; convert seconds to cron expression
    // For intervals < 60s use setInterval, otherwise use cron
    if (refreshSeconds < 60) {
      setInterval(() => {
        cronRefresh().catch((e: unknown) => logger.error(`Cron error: ${e}`));
      }, refreshSeconds * 1000);
    } else {
      // Build a cron expression: every N seconds approximated via minutes
      const minutes = Math.round(refreshSeconds / 60);
      const cronExpr = `*/${Math.max(1, minutes)} * * * *`;
      logger.info(`Cron expression: ${cronExpr}`);
      cron.schedule(cronExpr, () => {
        cronRefresh().catch((e: unknown) => logger.error(`Cron error: ${e}`));
      });
    }
  }

  app.listen(port, "0.0.0.0", () => {
    logger.info(`Server listening on port ${port} (debug=${debug})`);
  });
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
