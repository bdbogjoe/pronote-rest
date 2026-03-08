import puppeteer from "puppeteer";
import { logger } from "../logger";
import { AccountConfig } from "../config";

export interface QrCodeData {
  login: string;
  jeton: string;
}

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

export async function loginEduConnect(account: AccountConfig): Promise<void> {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--allow-running-insecure-content",
      "--disable-blink-features=AutomationControlled",
      "--ignore-certificate-errors",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();

  let resolveQr: (data: QrCodeData) => void;
  let rejectQr: (err: Error) => void;
  const qrPromise = new Promise<QrCodeData>((res, rej) => {
    resolveQr = res;
    rejectQr = rej;
  });

  // Intercept XHR responses containing the QR token
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("appelfonction")) return;
    const ct = response.headers()["content-type"] ?? "";
    if (!ct.includes("json")) return;
    try {
      const body = await response.json();
      const login: string | undefined = body?.dataSec?.data?.login;
      const jeton: string | undefined = body?.dataSec?.data?.jeton;
      if (login && jeton) {
        resolveQr!({ login, jeton });
      }
    } catch {
      // ignore parse errors for non-matching responses
    }
  });

  try {
    const mode = account.parent ? "parent" : "eleve";
    const url = `https://${account.prefix}.index-education.net/pronote/${mode}.html`;
    logger.info(`Using url ${url}`);

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await page.screenshot({ path: "screenshot/screenshot-0.png" });

    // Wait for the button-submit element
    await page.waitForSelector("#button-submit", { timeout: 10000 });

    const labels = await page.$$(".form__label");

    if (account.idp) {
      // Click the specific identity provider label
      for (const label of labels) {
        const forAttr: string = await label.evaluate((el) => el.getAttribute("for") ?? "");
        if (forAttr.includes(account.idp)) {
          // Navigate up 4 levels to find the button
          await label.evaluate((el) => {
            let parent: Element | null = el;
            for (let i = 0; i < 4; i++) {
              parent = parent?.parentElement ?? null;
            }
            const btn = parent?.querySelector("button");
            if (btn) (btn as HTMLButtonElement).click();
          });
          await label.click();
          break;
        }
      }
    } else {
      // Click "Elève ou parent" label
      for (const label of labels) {
        const text: string = await label.evaluate((el) => el.textContent?.trim() ?? "");
        if (text === "Elève ou parent") {
          await label.click();
          break;
        }
      }
    }

    await page.click("#button-submit");
    await page.screenshot({ path: "screenshot/screenshot-1.png" });

    // Wait for responsable button (EduConnect page)
    await page.waitForSelector("#bouton_responsable", { timeout: 15000 });
    await page.screenshot({ path: "screenshot/screenshot-1b.png" });
    await page.click("#bouton_responsable");

    // Fill username and password
    await page.waitForSelector("#username", { timeout: 10000 });
    await page.type("#username", account.username ?? "");
    await page.type("#password", account.password ?? "");
    await page.screenshot({ path: "screenshot/screenshot-2.png" });
    await page.click("#bouton_valider");

    // Handle optional birthday confirmation
    try {
      await page.waitForFunction(
        (text: string) => (document.body?.innerText ?? "").includes(text),
        { timeout: 5000 },
        "Confirmation de l'identité"
      );
      logger.info("Identity verification needed...");
      await page.type("#jour", account.birthday_day ?? "");
      await page.type("#mois", account.birthday_month ?? "");
      await page.type("#annee", account.birthday_year ?? "");
      await page.screenshot({ path: "screenshot/screenshot-confirmation.png" });
      await page.click("#submit-button");
    } catch {
      // No confirmation required
    }

    // Click QR code button
    await page.waitForSelector(".ibe_iconebtn.ibe_actif", { timeout: 15000 });
    await page.screenshot({ path: "screenshot/screenshot-3.png" });

    // Fill PIN (give the modal/overlay more time to appear)
    const MAX_RETRIES = 3;
    let attempt = 0;
    let success = false;

    while (attempt < MAX_RETRIES && !success) {
      try {
        await page.click(".ibe_iconebtn.ibe_actif");
        await page.waitForSelector("input[type='password']", { timeout: 15000 });
        success = true;
      } catch (err) {
        attempt++;
        logger.warn(`Tentative Getting QR Code ${attempt}/${MAX_RETRIES} échouée`);
    
        if (attempt >= MAX_RETRIES) {
          logger.error("Échec après", MAX_RETRIES, "tentatives.");
          throw err;
        } else {
          await page.waitForTimeout(2000); // Pause de 2s avant de réessayer
        }
      }
    }

    await page.type("input[type='password']", account.pin ?? "");
    await page.click("button");
    await page.screenshot({ path: "screenshot/screenshot-4.png" });

    // Wait for the appelfonction XHR response
    const qrData = await Promise.race([
      qrPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout waiting for QR data")), 30000)
      ),
    ]);

    account.login = qrData.login;
    account.jeton = qrData.jeton;
    if (account.credential !== undefined) {
      delete account.credential;
    }
    logger.info(`Login successful for: ${JSON.stringify(buildAccountForLog(account))}`);
  } catch (err) {
    logger.error(`Unable to login for: ${JSON.stringify(buildAccountForLog(account))}`);
    logger.error(String(err));
  } finally {
    try {
      await page.screenshot({ path: "screenshot/screenshot-end.png" });
    } catch {
      // ignore screenshot errors
    }
    await browser.close();
  }
}
