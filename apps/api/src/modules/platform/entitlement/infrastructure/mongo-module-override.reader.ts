import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { ModuleOverrideReader } from "../application/ports/entitlement-ports.js";
import type { ModuleOverrideRecord } from "../domain/module-override.js";
import {
  MODULE_OVERRIDE_MODEL_NAME,
  type ModuleOverrideDocument,
} from "./module-override.schema.js";

type OverrideRow = Pick<ModuleOverrideDocument, "moduleKey" | "effect" | "expiresAt">;

/** Overrides are tenant-scoped rows in the platform database: the tenant plugin filters by organization. */
export class MongoModuleOverrideReader implements ModuleOverrideReader {
  async findAll(organizationId: string): Promise<readonly ModuleOverrideRecord[]> {
    const rows = await models({})
      .get<ModuleOverrideDocument>(MODULE_OVERRIDE_MODEL_NAME)
      .find(
        { organizationId },
        { moduleKey: 1, effect: 1, expiresAt: 1, _id: 0 },
        sessionOption(getActiveSession()),
      )
      .lean<OverrideRow[]>();
    return rows.map(({ moduleKey, effect, expiresAt }) => ({ moduleKey, effect, expiresAt }));
  }
}
