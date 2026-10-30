import {
  ERROR_CODE,
  PERMISSION_KEY,
  SYSTEM_REASON,
  type ModuleManifest,
} from "@banijjik/contracts";
import { type OrganizationId, type UserId } from "@banijjik/ids";
import type { RequestHandler, Router } from "express";
import type { PermissionGate, PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { asSystemPort } from "../kernel/context/index.js";
import { AppError, forbidden } from "../kernel/http/index.js";
import type { Clock } from "../kernel/time/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import {
  buildPaymentController,
  buildPaymentTenantRouter,
} from "../modules/commerce/payment/index.js";
import { buildApprovalVerifier } from "../modules/core/iam/index.js";
import {
  buildMembershipDirectory,
  buildOrganizationTimezoneReader,
} from "../modules/core/organization/index.js";
import {
  buildPaymentRequestLifecycles,
  buildPaymentRequestReaders,
} from "./payment-request-readers.js";

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
  const requestReaders = buildPaymentRequestReaders();
  const lifecycles = buildPaymentRequestLifecycles({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
    clock: input.clock,
    audit: input.audit,
  });

  const directory = asSystemPort(SYSTEM_REASON.AUTH_LOOKUP, buildMembershipDirectory());
  const timezones = buildOrganizationTimezoneReader();

  const controller = buildPaymentController({
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    idempotency: input.idempotency,
    orgConfig: input.orgConfig,
    manifests: input.manifests,
    lifecycles,
    timeZone: {
      read: async (organizationId: OrganizationId) => {
        const tz = await timezones.read(organizationId);
        if (tz === undefined) {
          throw new AppError({
            code: ERROR_CODE.INTERNAL,
            messageKey: "errors.missing_tenant_context",
          });
        }
        return tz;
      },
    },
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
