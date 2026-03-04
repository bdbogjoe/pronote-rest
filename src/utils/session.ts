import { login } from "../auth/login";
import { lastLoginTime } from "../state";
import { logger } from "../logger";

const RELOGIN_DEBOUNCE_MS = 60_000;

/**
 * Trigger a background token-refresh login if sessions haven't been refreshed
 * in the last 60 seconds. Safe to call from per-session error catch blocks.
 */
export function triggerReloginIfStale(): void {
  if (Date.now() - lastLoginTime > RELOGIN_DEBOUNCE_MS) {
    logger.info("Scheduling background re-login to resync session sequence counters");
    login().catch((e: unknown) => logger.warn(`Background re-login failed: ${e}`));
  }
}
