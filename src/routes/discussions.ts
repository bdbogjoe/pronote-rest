import { Router, Request, Response, NextFunction } from "express";
import * as pronote from "@niicojs/pawnote";
import { children } from "../state";
import { serialize } from "../utils/serialize";
import { logger } from "../logger";
import { triggerReloginIfStale } from "../utils/session";

const router = Router();

async function getDiscussions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const child: string | undefined = req.params.child;
    logger.debug(`Loading discussions for ${child ?? "all"}`);
    const out: Record<string, unknown> = {};

    for (const [key, session] of children) {
      if (child !== undefined && !key.includes(child)) continue;

      try {
        const result = await pronote.discussions(session);
        out[key] = serialize(result.items);
      } catch (err) {
        if (err instanceof pronote.AccessDeniedError || err instanceof pronote.SessionExpiredError) {
          logger.warn(`Discussions access denied for ${key}: ${err}`);
          triggerReloginIfStale();
          out[key] = [];
        } else {
          throw err;
        }
      }
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
