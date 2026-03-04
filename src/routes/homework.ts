import { Router, Request, Response, NextFunction } from "express";
import * as pronote from "@niicojs/pawnote";
import { config } from "../config";
import { children } from "../state";
import { serialize } from "../utils/serialize";
import { sortByField } from "../utils/sort";
import { logger } from "../logger";
import { triggerReloginIfStale } from "../utils/session";

const router = Router();

/**
 * Returns the next working day (Mon–Fri) on or after the given date.
 */
function nextWorkingDay(from: Date): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  // 0=Sun, 6=Sat
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

async function getHomework(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const child: string | undefined = req.params.child;
    const type: string | undefined = req.params.type; // "todo" or undefined
    const daysParam = req.query.days;

    const isTodo = type === "todo";

    let start = new Date();
    start.setHours(0, 0, 0, 0);

    let days: number;
    if (isTodo) {
      // Start from next working day
      const tomorrow = new Date(start);
      tomorrow.setDate(tomorrow.getDate() + 1);
      start = nextWorkingDay(tomorrow);
      days = daysParam !== undefined ? parseInt(daysParam as string) : 0;
    } else {
      days = daysParam !== undefined ? parseInt(daysParam as string) : config.homework.days;
    }

    const end = nextWorkingDay(new Date(start.getTime() + days * 24 * 60 * 60 * 1000));

    logger.debug(`Loading homework type=${type ?? "all"} for ${child ?? "all"}`);
    const out: Record<string, unknown> = {};

    for (const [key, session] of children) {
      if (child !== undefined && !key.includes(child)) continue;
      try {
        let work = await pronote.assignmentsFromIntervals(session, start, end);
        work = sortByField(work) as typeof work;
        if (isTodo) {
          work = work.filter((w) => !w.done);
        }
        out[key] = serialize(work);
      } catch (err) {
        if (err instanceof pronote.AccessDeniedError || err instanceof pronote.SessionExpiredError) {
          logger.warn(`Homework access denied for ${key}: ${err}`);
          triggerReloginIfStale();
          out[key] = [];
        } else {
          throw err;
        }
      }
    }

    logger.debug(`Loaded homework for ${child ?? "all"}`);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

router.get("/homework", getHomework);
router.get("/homework/:child", getHomework);
router.get("/homework-:type", getHomework);
router.get("/homework-:type/:child", getHomework);

export default router;
