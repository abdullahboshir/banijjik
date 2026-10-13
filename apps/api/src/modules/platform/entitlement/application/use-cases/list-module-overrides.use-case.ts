import { SYSTEM_REASON } from "@banijjik/contracts";
import { runAsSystem } from "../../../../../kernel/context/index.js";
import type { ModuleOverrideView } from "../ports/override-admin-ports.js";
import { OverrideSupport } from "./override-support.js";

export class ListModuleOverridesUseCase extends OverrideSupport {
  async execute(input: {
    readonly organizationId: string;
  }): Promise<readonly ModuleOverrideView[]> {
    await this.requireOrganization(input.organizationId);
    // The read leaves only the system_access log line (plan 1.8a decision 5).
    return runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, () =>
      this.dependencies.overrides.list(input.organizationId),
    );
  }
}
