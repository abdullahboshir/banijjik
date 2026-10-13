import type { TenantStatusChange } from "../ports/tenant-admin-ports.js";
import type { TenantAdminDependencies } from "./tenant-admin-dependencies.js";
import type { TenantStatusResult } from "./tenant-status-result.js";

export class SuspendTenantUseCase {
  constructor(private readonly dependencies: TenantAdminDependencies) {}

  execute(input: TenantStatusChange): Promise<TenantStatusResult> {
    return this.dependencies.lifecycle.suspend(input);
  }
}
