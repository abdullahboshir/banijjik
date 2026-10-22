import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { SYSTEM_REASON, SYSTEM_ROLE_KEY, type ModuleManifest } from "@banijjik/contracts";
import { asId, type BookingId, type OrganizationId, type RoleId, type UserId } from "@banijjik/ids";
import type { RequestHandler, Router } from "express";
import type { PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { asSystemPort } from "../kernel/context/index.js";
import type { Clock } from "../kernel/time/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import {
  buildPaymentController,
  buildPaymentTenantRouter,
  RequestReaderRegistry,
} from "../modules/commerce/payment/index.js";
import { buildApprovalVerifier, buildRoleKeyReader } from "../modules/core/iam/index.js";
import { buildMembershipDirectory } from "../modules/core/organization/index.js";
import { MongoBookingRepository } from "../modules/commerce/booking/index.js";

export interface PaymentRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}

export function buildPaymentTenantRouterFor(input: PaymentRouterInput): Router {
  const requestReaders = new RequestReaderRegistry();
  const bookings = new MongoBookingRepository();

  requestReaders.register(PAYMENT_REQUEST_TYPE.BOOKING, {
    async read(organizationId: OrganizationId, requestId: string) {
      const booking = await bookings.findById(asId<BookingId>(requestId));
      if (!booking || booking.organizationId !== organizationId) return undefined;
      return {
        requestId: booking.bookingId,
        requestType: PAYMENT_REQUEST_TYPE.BOOKING,
        total: booking.price.total,
        revenueState: booking.status === "COMPLETED" ? "AFTER_REVENUE" : "BEFORE_REVENUE",
        contactId: booking.contactId,
        locationId: booking.locationId,
      };
    },
  });

  const directory = asSystemPort(SYSTEM_REASON.AUTH_LOOKUP, buildMembershipDirectory());
  const roleKeysReader = asSystemPort(SYSTEM_REASON.AUTH_LOOKUP, buildRoleKeyReader());

  const controller = buildPaymentController({
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    idempotency: input.idempotency,
    orgConfig: input.orgConfig,
    manifests: input.manifests,
    approvals: buildApprovalVerifier({ audit: input.audit, clock: input.clock }),
    requestReaders,
    isManagerOrOwner: async (userId: UserId, organizationId: OrganizationId) => {
      const membership = await directory.findActiveMembership(userId, organizationId);
      if (!membership) return false;
      const roleIds = membership.assignments.map((a: { roleId: string }) => asId<RoleId>(a.roleId));
      const roleKeys = await roleKeysReader.findRoleKeysByIds([organizationId], roleIds);
      return Array.from(roleKeys.values()).some(
        (key) => key === SYSTEM_ROLE_KEY.OWNER || key === SYSTEM_ROLE_KEY.MANAGER,
      );
    },
    getMemberId: async (userId: UserId, organizationId: OrganizationId) => {
      const membership = await directory.findActiveMembership(userId, organizationId);
      return membership?.memberId ?? userId;
    },
  });

  return buildPaymentTenantRouter({
    controller,
    permission: input.permission,
    idempotency: input.idempotency,
  });
}
