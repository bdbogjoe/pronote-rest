import { Router, Request, Response, NextFunction } from "express";
import * as pronote from "@niicojs/pawnote";
import { children } from "../state";
import { serialize } from "../utils/serialize";
import { sortByField } from "../utils/sort";
import { hasTab } from "../utils/tabs";
import { logger } from "../logger";

const router = Router();

/**
 * Get the periods available for the Grades tab for the current resource.
 */
function getGradePeriods(session: pronote.SessionHandle): pronote.Period[] {
  const tab = session.userResource.tabs.get(pronote.TabLocation.Grades);
  const periods = tab?.periods ?? [];
  return sortByField(periods) as pronote.Period[];
}

/**
 * Determine the current period (default period for grades, or first valid one by date).
 */
function getCurrentPeriod(session: pronote.SessionHandle): pronote.Period | undefined {
  const tab = session.userResource.tabs.get(pronote.TabLocation.Grades);
  if (tab?.defaultPeriod !== undefined) return tab.defaultPeriod;

  // Fall back: find a period whose date range contains today
  const now = new Date();
  const periods = getGradePeriods(session);
  return periods.find((p) => p.startDate <= now && now <= p.endDate) ?? periods[0];
}

function buildPeriod(period: pronote.Period): Record<string, unknown> {
  const out = serialize(period) as Record<string, unknown>;
  out.overall_average = null;
  return out;
}

// GET /period  and  GET /period/:child
async function getPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const child: string | undefined = req.params.child;
    logger.debug(`Loading period for ${child ?? "all"}`);
    const out: Record<string, unknown> = {};

    for (const [key, session] of children) {
      if (child !== undefined && !key.includes(child)) continue;
      if (!hasTab(session, pronote.TabLocation.Grades)) {
        out[key] = null;
        continue;
      }

      const current = getCurrentPeriod(session);
      if (current === undefined) {
        out[key] = null;
      } else {
        out[key] = buildPeriod(current);
      }
    }

    logger.debug(`Loaded period for ${child ?? "all"}`);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

// GET /periods  and  GET /periods/:child
async function getAllPeriods(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const child: string | undefined = req.params.child;
    logger.debug(`Loading periods for ${child ?? "all"}`);
    const out: Record<string, unknown> = {};

    for (const [key, session] of children) {
      if (child !== undefined && !key.includes(child)) continue;
      if (!hasTab(session, pronote.TabLocation.Grades)) {
        out[key] = {};
        continue;
      }

      const periods = getGradePeriods(session);
      const data: Record<string, unknown> = {};
      for (const p of periods) {
        data[p.name] = buildPeriod(p);
      }
      out[key] = data;
    }

    logger.debug(`Loaded periods for ${child ?? "all"}`);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

router.get("/period", getPeriod);
router.get("/period/:child", getPeriod);
router.get("/periods", getAllPeriods);
router.get("/periods/:child", getAllPeriods);

export { getGradePeriods, getCurrentPeriod };
export default router;
