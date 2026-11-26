import { logger } from "@/lib/logger";
import { closeDb, ensureSchema } from "./index";

ensureSchema();
closeDb();
logger.info("[tracelab] Database schema migrated successfully.");
