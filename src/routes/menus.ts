import { Router, Request, Response, NextFunction } from "express";
import * as pronote from "@niicojs/pawnote";
import { children } from "../state";
import { serialize } from "../utils/serialize";
import { logger } from "../logger";
import { triggerReloginIfStale } from "../utils/session";

const router = Router();

async function getMenus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const child: string | undefined = req.params.child;
    logger.debug(`Loading menus for ${child ?? "all"}`);
    const out: Record<string, unknown> = {};

    for (const [key, session] of children) {
      if (child !== undefined && !key.includes(child)) continue;

      try {
        const weekMenu = await pronote.menus(session, new Date());
        out[key] = serialize(weekMenu.days);
      } catch (err) {
        if (err instanceof pronote.AccessDeniedError || err instanceof pronote.SessionExpiredError) {
          logger.warn(`Menus access denied for ${key}: ${err}`);
          triggerReloginIfStale();
          out[key] = [];
        } else {
          throw err;
        }
      }
    }

    logger.debug(`Loaded menus for ${child ?? "all"}`);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

router.get("/menus", getMenus);
router.get("/menus/:child", getMenus);

export default router;
