import { Router, Request, Response, NextFunction } from "express";
import * as pronote from "@niicojs/pawnote";
import { children } from "../state";
import { serialize } from "../utils/serialize";
import { hasTab } from "../utils/tabs";
import { logger } from "../logger";

const router = Router();

async function getDiscussions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const child: string | undefined = req.params.child;
    logger.debug(`Loading discussions for ${child ?? "all"}`);
    const out: Record<string, unknown> = {};

    for (const [key, session] of children) {
      if (child !== undefined && !key.includes(child)) continue;
      if (!hasTab(session, pronote.TabLocation.Discussions)) {
        out[key] = [];
        continue;
      }

      const result = await pronote.discussions(session);
      out[key] = serialize(result.items);
    }

    logger.debug(`Loaded discussions for ${child ?? "all"}`);
    res.json(out);
  } catch (err) {
    next(err);
  }
}

router.get("/discussions", getDiscussions);
router.get("/discussions/:child", getDiscussions);

export default router;
