import { Router, Request, Response, NextFunction } from "express";
import * as pronote from "@niicojs/pawnote";
import { children } from "../state";
import { serialize } from "../utils/serialize";
import { hasTab } from "../utils/tabs";
import { logger } from "../logger";

const router = Router();

async function getMenus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const child: string | undefined = req.params.child;
    logger.debug(`Loading menus for ${child ?? "all"}`);
    const out: Record<string, unknown> = {};

    for (const [key, session] of children) {
      if (child !== undefined && !key.includes(child)) continue;
      if (!hasTab(session, pronote.TabLocation.Menus)) {
        out[key] = [];
        continue;
      }

      const weekMenu = await pronote.menus(session, new Date());
      out[key] = serialize(weekMenu.days);
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
