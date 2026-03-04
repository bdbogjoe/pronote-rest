import { Router, Request, Response, NextFunction } from "express";
import * as pronote from "@niicojs/pawnote";
import { config } from "../config";
import { children } from "../state";
import { serialize } from "../utils/serialize";
import { sortByField } from "../utils/sort";
import { logger } from "../logger";
import { triggerReloginIfStale } from "../utils/session";

const router = Router();

async function getSurveys(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const child: string | undefined = req.params.child;
    const type: string | undefined = req.params.type; // "unread" or undefined

    if (type !== undefined && type !== "unread") {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const onlyUnread = type === "unread";
    const days = config.information_and_surveys.days;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    logger.debug(`Loading information_and_surveys type=${type ?? "all"} for ${child ?? "all"}`);
    const out: Record<string, unknown> = {};

    for (const [key, session] of children) {
      if (child !== undefined && !key.includes(child)) continue;
      try {
        const newsResult = await pronote.news(session);
        let items: unknown[] = [...newsResult.items];

        // Filter by date (within configured days)
        items = items.filter((item) => {
          const obj = item as Record<string, unknown>;
          const d = obj.creationDate ?? obj.startDate;
          if (d instanceof Date) return d >= cutoff;
          if (typeof d === "string") return new Date(d) >= cutoff;
          return true;
        });

        if (onlyUnread) {
          items = items.filter((item) => {
            const obj = item as Record<string, unknown>;
            return obj.read === false;
          });
        }

        out[key] = serialize(sortByField(items));
      } catch (err) {
        if (err instanceof pronote.AccessDeniedError || err instanceof pronote.SessionExpiredError) {
          logger.warn(`Surveys access denied for ${key}: ${err}`);
          triggerReloginIfStale();
          out[key] = [];
        } else {
          throw err;
        }
      }
    }

    logger.debug(`Loaded information_and_surveys for ${child ?? "all"}`);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

router.get("/information_and_surveys", getSurveys);
router.get("/information_and_surveys/:child", getSurveys);
router.get("/information_and_surveys-:type", getSurveys);
router.get("/information_and_surveys-:type/:child", getSurveys);

export default router;
