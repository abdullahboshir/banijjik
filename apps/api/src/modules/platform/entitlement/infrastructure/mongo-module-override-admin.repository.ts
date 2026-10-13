import type { UserId } from "@banijjik/ids";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
} from "../../../../kernel/db/index.js";
import type {
  ModuleOverrideAdminRepository,
  ModuleOverrideView,
} from "../application/ports/override-admin-ports.js";
import { DuplicateOverrideError } from "../domain/override-errors.js";
import {
  MODULE_OVERRIDE_MODEL_NAME,
  type ModuleOverrideDocument,
} from "./module-override.schema.js";

function toView(document: ModuleOverrideDocument): ModuleOverrideView {
  return {
    moduleOverrideId: document.moduleOverrideId,
    organizationId: document.organizationId,
    moduleKey: document.moduleKey,
    effect: document.effect,
    reason: document.reason,
    expiresAt: document.expiresAt,
    createdAt: document.createdAt,
  };
}

/** Overrides are tenant-scoped rows in the platform database; the platform use cases read them as system access. */
export class MongoModuleOverrideAdminRepository implements ModuleOverrideAdminRepository {
  async insert(row: ModuleOverrideView, actorUserId: UserId): Promise<void> {
    try {
      await this.model().create(
        [
          {
            moduleOverrideId: row.moduleOverrideId,
            organizationId: row.organizationId,
            moduleKey: row.moduleKey,
            effect: row.effect,
            reason: row.reason,
            expiresAt: row.expiresAt,
            version: 1,
            createdAt: row.createdAt,
            createdByUserId: actorUserId,
            updatedByUserId: null,
          },
        ],
        sessionOption(getActiveSession()),
      );
    } catch (error) {
      throw isDuplicateKeyError(error) ? new DuplicateOverrideError() : error;
    }
  }

  async list(organizationId: string): Promise<readonly ModuleOverrideView[]> {
    const rows = await this.model()
      .find({ organizationId }, null, sessionOption(getActiveSession()))
      .sort({ createdAt: 1, moduleOverrideId: 1 })
      .lean<ModuleOverrideDocument[]>();
    return rows.map(toView);
  }

  async findById(
    organizationId: string,
    moduleOverrideId: string,
  ): Promise<ModuleOverrideView | undefined> {
    const row = await this.model()
      .findOne({ organizationId, moduleOverrideId }, null, sessionOption(getActiveSession()))
      .lean<ModuleOverrideDocument>();
    return row === null ? undefined : toView(row);
  }

  async delete(organizationId: string, moduleOverrideId: string): Promise<void> {
    await this.model().deleteOne(
      { organizationId, moduleOverrideId },
      sessionOption(getActiveSession()),
    );
  }

  private model() {
    return models({}).get<ModuleOverrideDocument>(MODULE_OVERRIDE_MODEL_NAME);
  }
}
