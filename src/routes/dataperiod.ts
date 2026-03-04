import { Router, Request, Response, NextFunction } from "express";
import * as pronote from "@niicojs/pawnote";
import { children } from "../state";
import { serialize } from "../utils/serialize";
import { sortByFieldDesc } from "../utils/sort";
import { logger } from "../logger";
import { getGradePeriods, getCurrentPeriod } from "./periods";
import { hasTab } from "../utils/tabs";
import { triggerReloginIfStale } from "../utils/session";

const router = Router();

// Map a URL type to the pawnote TabLocation used for period listing
function tabForType(type: string): pronote.TabLocation | undefined {
  switch (type) {
    case "grades":
    case "averages":
    case "overall_average":
      return pronote.TabLocation.Grades;
    case "evaluations":
      return pronote.TabLocation.Evaluations;
    case "absences":
    case "delays":
    case "punishments":
    case "observations":
      return pronote.TabLocation.Notebook;
    default:
      return undefined;
  }
}

function getPeriodsForTab(
  session: pronote.SessionHandle,
  tabLocation: pronote.TabLocation
): pronote.Period[] {
  const tab = session.userResource.tabs.get(tabLocation);
  if (tab === undefined) return [];
  const all = [...(tab.periods ?? [])];
  // Sort by startDate ascending
  return all.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

function getCurrentForTab(
  session: pronote.SessionHandle,
  tabLocation: pronote.TabLocation
): pronote.Period | undefined {
  const tab = session.userResource.tabs.get(tabLocation);
  if (tab?.defaultPeriod !== undefined) return tab.defaultPeriod;
  const now = new Date();
  const periods = getPeriodsForTab(session, tabLocation);
  return periods.find((p) => p.startDate <= now && now <= p.endDate) ?? periods[0];
}

/**
 * Fetch data for a specific type+period.
 * Returns { kind: "list", data } or { kind: "map", data }.
 */
async function fetchForPeriod(
  session: pronote.SessionHandle,
  type: string,
  period: pronote.Period
): Promise<{ kind: "list"; data: unknown[] } | { kind: "map"; data: unknown }> {
  switch (type) {
    case "grades": {
      const overview = await pronote.gradesOverview(session, period);
      return { kind: "list", data: overview.grades };
    }
    case "evaluations": {
      const evals = await pronote.evaluations(session, period);
      return { kind: "list", data: evals };
    }
    case "absences": {
      const nb = await pronote.notebook(session, period);
      return { kind: "list", data: nb.absences };
    }
    case "delays": {
      const nb = await pronote.notebook(session, period);
      return { kind: "list", data: nb.delays };
    }
    case "punishments": {
      const nb = await pronote.notebook(session, period);
      return { kind: "list", data: nb.punishments };
    }
    case "observations": {
      const nb = await pronote.notebook(session, period);
      return { kind: "list", data: nb.observations };
    }
    case "averages": {
      const overview = await pronote.gradesOverview(session, period);
      return { kind: "map", data: overview.subjectsAverages };
    }
    case "overall_average": {
      const overview = await pronote.gradesOverview(session, period);
      return { kind: "map", data: overview.overallAverage ?? null };
    }
    default:
      throw Object.assign(new Error(`Unknown type: ${type}`), { statusCode: 404 });
  }
}

async function getDataPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
  const type = req.params.type;
  const child: string | undefined = req.params.child;

  // Skip static files
  if (type === "static") {
    next();
    return;
  }

  const tabLocation = tabForType(type);
  if (tabLocation === undefined) {
    next();
    return;
  }

  try {
    const nbPeriodParam = req.query.period;
    const nbPeriod =
      nbPeriodParam !== undefined ? parseInt(nbPeriodParam as string) : null;

    logger.debug(`Loading ${type} for ${child ?? "all"} (period=${nbPeriod ?? "all"})`);
    const out: Record<string, unknown> = {};

    for (const [key, session] of children) {
      if (child !== undefined && !key.includes(child)) continue;
      if (!hasTab(session, tabLocation)) {
        out[key] = [];
        continue;
      }

      const allPeriods = getPeriodsForTab(session, tabLocation);
      if (allPeriods.length === 0) {
        out[key] = [];
        continue;
      }

      const currentPeriod = getCurrentForTab(session, tabLocation);

      // Filter periods based on nbPeriod param
      const periodsToFetch = allPeriods.filter((p, idx) => {
        if (nbPeriod === null) return true;                              // all
        if (nbPeriod === 0) return currentPeriod?.id === p.id;          // current
        return idx + 1 === nbPeriod;                                    // 1-based index
      });

      if (periodsToFetch.length === 0) {
        res.status(404).json({ error: `No period found for type ${type}` });
        return;
      }

      let listData: unknown[] | null = null;
      const mapData: Record<string, unknown> = {};
      let denied = false;

      for (const period of periodsToFetch) {
        let result: { kind: "list"; data: unknown[] } | { kind: "map"; data: unknown };
        try {
          result = await fetchForPeriod(session, type, period);
        } catch (err) {
          if (err instanceof pronote.SessionExpiredError) {
            logger.warn(`${type} session expired for ${key}: ${err}`);
            denied = true;
            break;
          }
          throw err;
        }

        if (result.kind === "list") {
          if (listData === null) {
            listData = result.data;
          } else {
            listData = [...listData, ...result.data];
          }
        } else {
          mapData[period.name] = serialize(result.data);
        }
      }

      if (denied) {
        triggerReloginIfStale();
        out[key] = [];
        continue;
      }

      if (listData !== null) {
        out[key] = serialize(sortByFieldDesc(listData));
      } else {
        // Remove periods with no data
        out[key] = Object.fromEntries(
          Object.entries(mapData).filter(([, v]) => {
            if (v === null || v === undefined) return false;
            if (Array.isArray(v)) return v.length > 0;
            if (typeof v === "object" && "points" in (v as object)) {
              const points = (v as Record<string, unknown>).points;
              return points !== null && !Number.isNaN(points);
            }
            return true;
          })
        );
      }
    }

    logger.debug(`Loaded ${type} for ${child ?? "all"}`);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

// These routes must be registered AFTER specific routes (lessons, homework, etc.)
router.get("/:type", getDataPeriod);
router.get("/:type/:child", getDataPeriod);

export default router;
