import { overrideNotFound } from "../../domain/override-errors.js";
import type { ModuleOverrideAdminDependencies } from "./module-override-admin-dependencies.js";

export abstract class OverrideSupport {
  constructor(protected readonly dependencies: ModuleOverrideAdminDependencies) {}

  /** An unknown organization is a 404 before any tenant data is touched. */
  protected async requireOrganization(organizationId: string): Promise<void> {
    if (!(await this.dependencies.organizations.exists(organizationId))) throw overrideNotFound();
  }
}
