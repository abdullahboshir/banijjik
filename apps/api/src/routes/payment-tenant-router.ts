import { PERMISSION_KEY, SYSTEM_REASON, type ModuleManifest } from "@banijjik/contracts";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { type OrganizationId, type UserId } from "@banijjik/ids";
import type { RequestHandler, Router } from "express";
import type { PermissionGate, PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { asSystemPort } from "../kernel/context/index.js";
import { forbidden } from "../kernel/http/index.js";
import type { Clock } from "../kernel/time/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import {
  buildPaymentController,
  buildPaymentTenantRouter,
  RequestReaderRegistry,
} from "../modules/commerce/payment/index.js";
import { buildApprovalVerifier } from "../modules/core/iam/index.js";
import { buildMembershipDirectory } from "../modules/core/organization/index.js";
import { buildBookingRequestReader } from "./booking-request-reader.js";

export interface PaymentRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly permissions: Pick<PermissionGate, "locationsWith">;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}

export function buildPaymentTenantRouterFor(input: PaymentRouterInput): Router {
  const requestReaders = new RequestReaderRegistry();
  requestReaders.register(PAYMENT_REQUEST_TYPE.BOOKING, buildBookingRequestReader());

  const directory = asSystemPort(SYSTEM_REASON.AUTH_LOOKUP, buildMembershipDirectory());

  const controller = buildPaymentController({
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    idempotency: input.idempotency,
    orgConfig: input.orgConfig,
    manifests: input.manifests,
    approvals: buildApprovalVerifier({ audit: input.audit, clock: input.clock }),
    requestReaders,
    hasRefundWithoutApprovalPermission: async (
      _userId: UserId,
      _organizationId: OrganizationId,
      locationId: string,
    ) => {
      const locations = await input.permissions.locationsWith(
        PERMISSION_KEY.PAYMENT_PAYMENT_REFUND_WITHOUT_APPROVAL,
      );
      return locations === "ALL" || locations.includes(locationId);
    },
    getMemberId: async (userId: UserId, organizationId: OrganizationId) => {
      const membership = await directory.findActiveMembership(userId, organizationId);
      if (!membership) throw forbidden();
      return membership.memberId;
    },
  });

  return buildPaymentTenantRouter({
    controller,
    permission: input.permission,
    idempotency: input.idempotency,
  });
}
