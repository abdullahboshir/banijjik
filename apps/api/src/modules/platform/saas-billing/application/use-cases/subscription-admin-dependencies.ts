import type { PlatformAuditRecorder } from "../../../../../kernel/audit/index.js";
import type { ConfigVersionBumper } from "../../../../../kernel/tenancy/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type {
  PackageKindLookup,
  SubscriptionAdminRepository,
  SubscriptionUnitOfWork,
} from "../ports/subscription-admin-ports.js";

export interface SubscriptionAdminDependencies {
  readonly subscriptions: SubscriptionAdminRepository;
  readonly packages: PackageKindLookup;
  /** Every write moves `configVersion` in the same transaction, so the next request resolves the change. */
  readonly configVersion: ConfigVersionBumper;
  readonly unitOfWork: SubscriptionUnitOfWork;
  readonly platformAudit: PlatformAuditRecorder;
  readonly clock: Clock;
}
