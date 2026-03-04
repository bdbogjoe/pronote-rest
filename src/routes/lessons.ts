import { Router, Request, Response, NextFunction } from "express";
import * as pronote from "@niicojs/pawnote";
import { config } from "../config";
import { children } from "../state";
import { serialize } from "../utils/serialize";
import { sortByField } from "../utils/sort";
import { hasTab } from "../utils/tabs";
import { logger } from "../logger";

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
      if (!hasTab(session, pronote.TabLocation.Timetable)) {
        out[key] = [];
        continue;
      }

      const timetable = await pronote.timetableFromIntervals(session, start, end);
      pronote.parseTimetable(session, timetable, {
        withSuperposedCanceledClasses: false,
        withCanceledClasses: true,
        withPlannedClasses: true,
      });
      out[key] = serialize(sortByField(timetable.classes));
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
