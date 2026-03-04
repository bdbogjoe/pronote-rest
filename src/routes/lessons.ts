import { Router, Request, Response, NextFunction } from "express";
import * as pronote from "@niicojs/pawnote";
import { config } from "../config";
import { children } from "../state";
import { serialize } from "../utils/serialize";
import { sortByField } from "../utils/sort";
import { logger } from "../logger";
import { triggerReloginIfStale } from "../utils/session";
import { toCompatLesson } from "../utils/compat";

const router = Router();

async function getLessons(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const child: string | undefined = req.params.child;
    const daysParam = req.query.days;
    const days =
      daysParam !== undefined ? parseInt(daysParam as string) : config.lessons.days;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + days);

    logger.debug(`Loading lessons for ${child ?? "all"}`);
    const out: Record<string, unknown> = {};

    for (const [key, session] of children) {
      if (child !== undefined && !key.includes(child)) continue;
      try {
        const timetable = await pronote.timetableFromIntervals(session, start, end);
        pronote.parseTimetable(session, timetable, {
          withSuperposedCanceledClasses: false,
          withCanceledClasses: true,
          withPlannedClasses: true,
        });
        out[key] = serialize(sortByField(timetable.classes.map(toCompatLesson)));
      } catch (err) {
        if (err instanceof pronote.AccessDeniedError || err instanceof pronote.SessionExpiredError) {
          logger.warn(`Lessons access denied for ${key}: ${err}`);
          triggerReloginIfStale();
          out[key] = [];
        } else {
          throw err;
        }
      }
    }

    logger.debug(`Loaded lessons for ${child ?? "all"}`);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

router.get("/lessons", getLessons);
router.get("/lessons/:child", getLessons);

export default router;
