import * as crypto from "crypto";
import * as pronote from "@niicojs/pawnote";
import { config, storeConfig, AccountConfig, StoredCredential } from "../config";
import { children, writeMutex, setForceLogin, setErrorCount, setLastLoginTime, forceLogin, errorCount } from "../state";
import { logger } from "../logger";
import { loginEduConnect } from "./educonnect";

function buildAccountForLog(account: AccountConfig): Record<string, unknown> {
  const tmp: Record<string, unknown> = { ...account };
  if (tmp.password) tmp.password = "<hidden>";
  if (tmp.jeton) tmp.jeton = "<hidden>";
  if (tmp.credential && typeof tmp.credential === "object") {
    const cred = { ...(tmp.credential as Record<string, unknown>) };
    if (cred.token) cred.token = "<hidden>";
    tmp.credential = cred;
  }
  return tmp;
}

/**
 * Create a pawnote session for an account + child index.
 * Handles QR code, token, and password authentication.
 * Updates account.credential with the latest RefreshInformation.
 */
async function createSessionForChild(
  url: string,
  account: AccountConfig,
  childIndex: number
): Promise<pronote.SessionHandle> {
  const session = pronote.createSessionHandle();
  const kind = account.parent ? pronote.AccountKind.PARENT : pronote.AccountKind.STUDENT;

  if (account.login !== undefined && account.jeton !== undefined) {
    // QR code login (login/jeton obtained from EduConnect browser flow)
    const deviceUUID = crypto.randomUUID();
    logger.info(`Using QR code login for ${account.prefix}`);
    // pawnote parses qr.url to extract base URL and account kind (parent/eleve.html)
    let refresh: pronote.RefreshInformation;
    try {
      refresh = await pronote.loginQrCode(session, {
        deviceUUID,
        pin: account.pin ?? "",
        qr: { url, login: account.login, jeton: account.jeton },
      });
    } catch (err) {
      // Jeton is stale (consumed by a previous run). Clear it so next loginAll re-runs EduConnect.
      logger.warn(`QR code login failed for ${account.prefix} (stale jeton?): ${err}`);
      delete account.login;
      delete account.jeton;
      throw err;
    }
    account.credential = buildStoredCredential(refresh, deviceUUID);
    delete account.login;
    delete account.jeton;
  } else if (account.credential !== undefined) {
    // Token login
    const cred = account.credential;
    logger.info(`Using token login for ${account.prefix}`);
    const refresh = await pronote.loginToken(session, {
      url: cred.url,
      username: cred.username,
      token: cred.token,
      deviceUUID: cred.deviceUUID,
      kind: cred.kind as pronote.AccountKind,
    });
    account.credential = buildStoredCredential(refresh, cred.deviceUUID);
  } else if (account.username !== undefined && account.password !== undefined) {
    // Direct credentials (no ENT)
    logger.info(`Using password login for ${account.prefix}`);
    await pronote.loginCredentials(session, {
      url,
      username: account.username,
      password: account.password,
      deviceUUID: crypto.randomUUID(),
      kind,
    });
  } else {
    throw new Error(`Missing auth info for account ${account.prefix}`);
  }

  pronote.use(session, childIndex);
  return session;
}

function buildStoredCredential(
  refresh: pronote.RefreshInformation,
  deviceUUID: string
): StoredCredential {
  return {
    url: refresh.url,
    token: refresh.token,
    username: refresh.username,
    kind: refresh.kind,
    navigatorIdentifier: refresh.navigatorIdentifier,
    deviceUUID,
  };
}

/**
 * Login all accounts. Creates one pawnote session per child.
 */
export async function login(): Promise<boolean> {
  return writeMutex.runExclusive(async () => {
    logger.info("Login process started");
    let storeCredentials = false;
    children.clear();

    for (const account of config.accounts) {
      logger.info(`Processing account: ${JSON.stringify(buildAccountForLog(account))}`);

      const mode = account.parent ? "parent" : "eleve";
      const url = `https://${account.prefix}.index-education.net/pronote/${mode}.html`;
      logger.info(`Using url to connect: ${url}`);

      try {
        if (account.parent) {
          // Create first session to discover children
          const firstSession = await createSessionForChild(url, account, 0);
          const resources = firstSession.user.resources;

          if (resources.length === 0) {
            logger.warn(`No resources found for account ${account.prefix}`);
            continue;
          }

          children.set(resources[0].name, firstSession);
          logger.info(`Added child: ${resources[0].name}`);

          // Create additional sessions for remaining children
          for (let i = 1; i < resources.length; i++) {
            const childSession = await createSessionForChild(url, account, i);
            children.set(resources[i].name, childSession);
            logger.info(`Added child: ${resources[i].name}`);
          }

          if (account.credential !== undefined) {
            storeCredentials = true;
          }
        } else {
          // Student account
          const session = await createSessionForChild(url, account, 0);
          const name = session.user.resources[0]?.name ?? account.username ?? account.prefix;
          children.set(name, session);
          logger.info(`Added student: ${name}`);
        }
      } catch (err) {
        logger.error(`Failed to login account ${account.prefix}: ${err}`);
        throw err;
      }
    }

    if (storeCredentials) {
      storeConfig();
    }

    logger.info(`Login done, found children: ${[...children.keys()].join(", ")}`);
    setErrorCount(0);
    setLastLoginTime(Date.now());
    return storeCredentials;
  });
}

/**
 * Full login: run EduConnect browser flow for accounts that need it, then call login().
 * Skips browser for accounts that already have a stored credential (use token refresh instead).
 * Force-runs browser for all when forceAll=true (e.g. called from /login endpoint).
 */
export async function loginAll(forceAll = false): Promise<boolean> {
  logger.info("Logging from EduConnect to get token for accounts");
  for (const account of config.accounts) {
    const needsBrowser =
      forceAll ||
      // No stored token credential AND has ENT credentials for browser flow.
      // Run even if stale login/jeton exist (they may be consumed from a previous run).
      (account.credential === undefined &&
        account.username !== undefined &&
        account.pin !== undefined);
    if (needsBrowser) {
      await loginEduConnect(account);
    } else {
      logger.info(`Skipping EduConnect for ${account.prefix} (credential or jeton already present)`);
    }
  }
  storeConfig();
  return login();
}

/**
 * Cron refresh: periodically re-login to keep sessions alive.
 */
export async function cronRefresh(): Promise<void> {
  logger.debug(`Cron refresh: forceLogin=${forceLogin}, errors=${errorCount}`);

  try {
    if (!forceLogin) {
      if (errorCount < 5) {
        // Re-login with stored tokens to keep sessions fresh
        await login();
        return;
      } else {
        logger.warn("Too many login errors, skipping token refresh");
        return;
      }
    }
    // force login: full browser flow
    setForceLogin(false);
    await loginAll();
  } catch (err) {
    logger.warn(`Unable to refresh login: ${err}`);
    setErrorCount(errorCount + 1);
  }
}
