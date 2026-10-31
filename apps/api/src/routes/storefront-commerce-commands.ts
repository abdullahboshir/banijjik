import type { ModuleManifest } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import type {
  PublicBookingCommands,
  PublicEnrollmentCommands,
  PublicOrderCommands,
} from "@banijjik/contracts/website";
import type { RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { MongoUnitOfWork } from "../kernel/db/index.js";
import { kernelEventPublisher } from "../kernel/events/index.js";
import type { Clock } from "../kernel/time/index.js";
import {
  MongoBookingRepository,
  MongoEventSessionRepository,
  MongoResourceRepository,
  MongoResourceSlotUsageRepository,
  MongoResourceTimeOffRepository,
  buildBookingOfferingReader,
  buildBookingSettingsReader,
  buildOrganizationTimezoneReader,
  buildStorefrontBookingCommands,
} from "../modules/commerce/booking/index.js";
import { buildEnrollmentRuntime } from "./enrollment-tenant-router.js";
import { buildStorefrontEnrollmentCommands } from "../modules/commerce/enrollment/index.js";
import {
  buildSalesDependencies,
  buildStorefrontOrderCommands,
} from "../modules/commerce/sales/index.js";
import { buildSalesTenantPorts, type SalesRouterInput } from "./sales-tenant-router.js";
import { buildBookingTenantPorts, type BookingRouterInput } from "./booking-tenant-router.js";
import type {
  CatalogQuoteReaderPort,
  OrgStorefrontConfigReader,
  RequestStatusReaderPort,
} from "../modules/commerce/website/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import { buildStorefrontCatalogQuoter } from "./storefront-price-adapter.js";
import { buildStorefrontRequestStatusReaderAdapter } from "./storefront-request-status-adapter.js";

export interface StorefrontCommerceInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly orgConfigReader: OrgStorefrontConfigReader;
}

export interface StorefrontCommerceCommands {
  readonly publicOrders: PublicOrderCommands;
  readonly publicBookings: PublicBookingCommands;
  readonly publicEnrollments: PublicEnrollmentCommands;
  readonly catalogQuoter: CatalogQuoteReaderPort;
  readonly requestStatusReader: RequestStatusReaderPort;
}

/** The storefront has no staff request pipeline, so the guards the commands never read are inert. */
const unusedGuard: RequestHandler = (_request, _response, next) => next();
const unusedPermissionGuard: PermissionMiddlewareFactory = () => unusedGuard;
const everyLocation: BookingRouterInput["permissions"] = {
  locationsWith: async () => "ALL",
};

function kindsOf(orgConfig: OrgConfigService) {
  return {
    effectiveKinds: async (organizationId: OrganizationId) =>
      (await orgConfig.forOrganization(organizationId)).config.kinds,
  };
}

/**
 * The real module commands behind the public checkout routes (card 4.3 A5A). A guest checkout
 * creates a real order, booking or enrollment through the same use cases the staff API uses, so
 * numbering, stock reservation, holds and payment summaries are never simulated.
 */
export function buildStorefrontCommerceCommands(
  input: StorefrontCommerceInput,
): StorefrontCommerceCommands {
  const tenant: SalesRouterInput & BookingRouterInput = {
    clock: input.clock,
    audit: input.audit,
    orgConfig: input.orgConfig,
    manifests: input.manifests,
    permission: unusedPermissionGuard,
    idempotency: unusedGuard,
    permissions: everyLocation,
  };

  const publicOrders = buildStorefrontOrderCommands(
    buildSalesDependencies(buildSalesTenantPorts(tenant)),
  );

  const bookingPorts = buildBookingTenantPorts(tenant);
  const timeOffRepository = new MongoResourceTimeOffRepository();
  const publicBookings = buildStorefrontBookingCommands({
    bookings: new MongoBookingRepository(),
    resources: new MongoResourceRepository(),
    slots: new MongoResourceSlotUsageRepository(),
    sessions: new MongoEventSessionRepository(),
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    audit: input.audit,
    clock: input.clock,
    offerings: buildBookingOfferingReader(),
    settings: buildBookingSettingsReader({
      orgConfig: input.orgConfig,
      manifests: input.manifests,
    }),
    quoter: bookingPorts.quoter,
    contacts: bookingPorts.contacts,
    timeZone: buildOrganizationTimezoneReader(),
    timeOff: {
      listOverlapping: (resourceId, from, to) =>
        timeOffRepository.listOverlapping({ resourceId, from, to }),
    },
    kinds: kindsOf(input.orgConfig),
    depositCheck: bookingPorts.depositCheck,
  });

  const publicEnrollments = buildStorefrontEnrollmentCommands({
    ...buildEnrollmentRuntime(tenant),
    kinds: kindsOf(input.orgConfig),
  });

  return {
    publicOrders,
    publicBookings,
    publicEnrollments,
    catalogQuoter: buildStorefrontCatalogQuoter(input),
    requestStatusReader: buildStorefrontRequestStatusReaderAdapter(),
  };
}
