import type { Router } from "express";
import type { PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import type { Clock } from "../kernel/time/index.js";
import type { RateLimiter } from "../kernel/rate-limit/index.js";
import {
  buildCreditTenantRouter as buildCreditTenantRouterFromModule,
  AdjustCreditsUseCase,
  GetMyCreditsUseCase,
  MongoCreditRepository,
  MongoCreditPackRepository,
  MongoListingUnlockRepository,
} from "../modules/commerce/credit/index.js";
import { MongoUnitOfWork } from "../kernel/db/index.js";
import { kernelEventPublisher } from "../kernel/events/index.js";
import { directorySettingsFromResolver } from "../modules/commerce/directory/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import {
  MongoListingRepository,
  type ListingRepository,
} from "../modules/commerce/directory/index.js";

export interface CreditRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly rateLimiter: RateLimiter;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly import("@banijjik/contracts").ModuleManifest[];
}

/** Credit read/write API, mounted on the tenant pipeline (card M.4). */
export function buildCreditTenantRouter(input: CreditRouterInput): Router {
  const settingsResolver = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });

  const creditDeps = {
    credit: new MongoCreditRepository(),
    packs: new MongoCreditPackRepository(),
    unlocks: new MongoListingUnlockRepository(),
    listings: new MongoListingRepository() as ListingRepository,
    unitOfWork: new MongoUnitOfWork(),
    events: {
      publish: async (
        type: string,
        payload: unknown,
        options?: { version?: number; orderingKey?: string },
      ) => {
        await kernelEventPublisher.publish(
          type as import("@banijjik/contracts").EventType,
          payload as import("@banijjik/contracts").EventPayloadMap[import("@banijjik/contracts").EventType],
          options,
        );
      },
    },
    audit: input.audit,
    clock: input.clock,
    directorySettings: directorySettingsFromResolver(settingsResolver),
    resolveSettings: (oid: string, keys: readonly string[]) =>
      settingsResolver.resolve(oid as import("@banijjik/ids").OrganizationId, { keys }),
  };

  const adjustCredits = new AdjustCreditsUseCase(creditDeps);
  const getMyCredits = new GetMyCreditsUseCase(creditDeps);

  return buildCreditTenantRouterFromModule({
    permission: input.permission,
    adjustCredits,
    getAccount: getMyCredits,
  });
}
