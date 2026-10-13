import type { Clock } from "../../../../../kernel/time/index.js";
import type {
  OwnerIdentifierReader,
  TenantDirectory,
  TenantLifecycle,
  TenantOverrideReader,
  TenantSubscriptionReader,
} from "../ports/tenant-admin-ports.js";

export interface TenantAdminDependencies {
  readonly directory: TenantDirectory;
  readonly subscriptions: TenantSubscriptionReader;
  readonly overrides: TenantOverrideReader;
  readonly identifiers: OwnerIdentifierReader;
  readonly lifecycle: TenantLifecycle;
  readonly clock: Clock;
}
