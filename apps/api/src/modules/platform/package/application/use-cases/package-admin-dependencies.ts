import type { PlatformAuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type {
  ManifestCatalog,
  PackageAdminRepository,
  PackageUsage,
} from "../ports/package-repository.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface PackageAdminDependencies {
  readonly packages: PackageAdminRepository;
  readonly manifests: ManifestCatalog;
  readonly usage: PackageUsage;
  readonly unitOfWork: UnitOfWork;
  readonly platformAudit: PlatformAuditRecorder;
  readonly clock: Clock;
}
