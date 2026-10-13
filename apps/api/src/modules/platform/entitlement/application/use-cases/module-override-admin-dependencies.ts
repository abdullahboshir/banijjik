import type { PlatformAuditRecorder } from "../../../../../kernel/audit/index.js";
import type { ConfigVersionBumper } from "../../../../../kernel/tenancy/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type {
  ModuleOverrideAdminRepository,
  OrganizationExistence,
  OverrideManifestCatalog,
  OverrideUnitOfWork,
} from "../ports/override-admin-ports.js";

export interface ModuleOverrideAdminDependencies {
  readonly overrides: ModuleOverrideAdminRepository;
  readonly organizations: OrganizationExistence;
  readonly manifests: OverrideManifestCatalog;
  /** Every write moves `configVersion` in the same transaction, so the next request resolves the change. */
  readonly configVersion: ConfigVersionBumper;
  readonly unitOfWork: OverrideUnitOfWork;
  readonly platformAudit: PlatformAuditRecorder;
  readonly clock: Clock;
}
