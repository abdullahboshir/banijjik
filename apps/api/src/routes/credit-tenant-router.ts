import type { RequestHandler, Router } from "express";
import { SEQUENCE_KEY } from "@banijjik/contracts";
import { asId, type OrganizationId, type RoleId, type UserId } from "@banijjik/ids";
import { getRequestContext } from "../kernel/context/index.js";
import { nextSequenceValue } from "../kernel/sequence/index.js";
import type { PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import type { Clock } from "../kernel/time/index.js";
import {
  AdjustCreditsUseCase,
  ArchiveCreditPackUseCase,
  CreateCreditPackUseCase,
  GetCreditPurchaseStaffUseCase,
  GetMyCreditsUseCase,
  ListCreditPacksUseCase,
  ListCreditPurchasesStaffUseCase,
  MongoCreditPackRepository,
  MongoCreditPurchaseRepository,
  MongoCreditRepository,
  MongoListingUnlockRepository,
  RejectCreditPurchaseUseCase,
  UpdateCreditPackUseCase,
  VerifyCreditPurchaseUseCase,
  buildCreditTenantRouter as buildCreditTenantRouterFromModule,
  type CreditDependencies,
} from "../modules/commerce/credit/index.js";
import { MongoUnitOfWork } from "../kernel/db/index.js";
import { kernelEventPublisher } from "../kernel/events/index.js";
import {
  directorySettingsFromResolver,
  listingFieldsFromEffectiveReader,
  type ListingRepository,
  MongoListingRepository,
} from "../modules/commerce/directory/index.js";
import {
  buildContactLookup,
  buildCustomerAccountLookup,
} from "../modules/commerce/contact/index.js";
import { buildEffectiveCustomFieldReader } from "../modules/core/custom-field/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import {
  buildApprovalVerifier,
  buildTenantRoleReader,
  buildUserIdentifierReader,
  memberIsOwner,
} from "../modules/core/iam/index.js";
import {
  buildApprovalMemberStore,
  buildOrganizationCurrencyReader,
} from "../modules/core/organization/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";

export interface CreditModuleDepsInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly import("@banijjik/contracts").ModuleManifest[];
}

export interface CreditRouterInput extends CreditModuleDepsInput {
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
}

/** OWNER membership in the request's organization, without an approval token (M.4 decision 6). */
function buildOwnerCheck(): (userId: UserId) => Promise<boolean> {
  const members = buildApprovalMemberStore();
  const roles = buildTenantRoleReader();
  return async (userId) => {
    const member = await members.findByUserId(userId);
    if (member === undefined) return false;
    const roleIds = member.assignments.map((assignment) => asId<RoleId>(assignment.roleId));
    const loaded = await roles.findByIds(roleIds);
    const roleKeys = new Map(loaded.map((role) => [role.roleId, role.roleKey]));
    return memberIsOwner(member, roleKeys);
  };
}

export function buildCreditModuleDeps(input: CreditModuleDepsInput): CreditDependencies {
  const settingsResolver = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });

  return {
    credit: new MongoCreditRepository(),
    packs: new MongoCreditPackRepository(),
    unlocks: new MongoListingUnlockRepository(),
    purchases: new MongoCreditPurchaseRepository(),
    listings: new MongoListingRepository() as ListingRepository,
    fields: listingFieldsFromEffectiveReader(buildEffectiveCustomFieldReader()),
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
      settingsResolver.resolve(oid as OrganizationId, { keys }),
    approvals: buildApprovalVerifier({ audit: input.audit, clock: input.clock }),
    accounts: buildCustomerAccountLookup(),
    contacts: buildContactLookup(),
    users: buildUserIdentifierReader(),
    sequences: {
      async nextPurchaseNumber(): Promise<string> {
        const organizationId = asId<OrganizationId>(String(getRequestContext().organizationId));
        const n = await nextSequenceValue({
          organizationId,
          sequenceKey: SEQUENCE_KEY.CREDIT_PURCHASE,
        });
        return `CP-${n}`;
      },
    },
    currency: buildOrganizationCurrencyReader(),
  };
}

/** Credit read/write API, mounted on the tenant pipeline (card M.4). */
export function buildCreditTenantRouter(input: CreditRouterInput): Router {
  const creditDeps = buildCreditModuleDeps(input);

  return buildCreditTenantRouterFromModule({
    permission: input.permission,
    idempotency: input.idempotency,
    adjustCredits: new AdjustCreditsUseCase(creditDeps),
    getAccount: new GetMyCreditsUseCase(creditDeps),
    listPacks: new ListCreditPacksUseCase(creditDeps),
    createPack: new CreateCreditPackUseCase(creditDeps),
    updatePack: new UpdateCreditPackUseCase(creditDeps),
    archivePack: new ArchiveCreditPackUseCase(creditDeps),
    listPurchases: new ListCreditPurchasesStaffUseCase(creditDeps),
    getPurchase: new GetCreditPurchaseStaffUseCase(creditDeps),
    verifyPurchase: new VerifyCreditPurchaseUseCase(creditDeps),
    rejectPurchase: new RejectCreditPurchaseUseCase(creditDeps),
    isOwner: buildOwnerCheck(),
  });
}
