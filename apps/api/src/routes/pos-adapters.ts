import {
  ERROR_CODE,
  SYSTEM_REASON,
  type ModuleManifest,
  type PermissionKey,
} from "@banijjik/contracts";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import {
  POS_ALLOW_CREDIT_SALE_DEFAULT,
  POS_ALLOW_CREDIT_SALE_SETTING_KEY,
  POS_PAIRING_RULES,
  POS_RECEIPT_FOOTER_DEFAULT,
  POS_RECEIPT_FOOTER_SETTING_KEY,
  POS_REQUIRE_SHIFT_DEFAULT,
  POS_REQUIRE_SHIFT_SETTING_KEY,
} from "@banijjik/contracts/pos";
import { asId, type MemberId, type OrganizationId, type PaymentId } from "@banijjik/ids";
import type { RequestHandler, Router } from "express";
import type { PermissionGate, PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { asSystemPort } from "../kernel/context/index.js";
import { MongoUnitOfWork } from "../kernel/db/index.js";
import { kernelEventPublisher } from "../kernel/events/index.js";
import { AppError, forbidden } from "../kernel/http/index.js";
import type { RateLimiter } from "../kernel/rate-limit/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildPosSnapshotReader } from "../modules/commerce/catalog/index.js";
import {
  buildPaymentSessionReader,
  MongoContactStoreCreditAdapter,
  MongoPaymentRepository,
  MongoPaymentSummaryRepository,
  MongoStoreCreditRepository,
  ReceivePaymentUseCase,
} from "../modules/commerce/payment/index.js";
import {
  buildPosRouter,
  type PosCaller,
  type PosPaymentPort,
  type PosRateLimit,
  type PosSettingsReader,
  type PosSoldOrdersReader,
} from "../modules/commerce/pos/index.js";
import { buildInstantSale, buildOrderTotalsReader } from "../modules/commerce/sales/index.js";
import {
  buildLocationLookup,
  buildMembershipDirectory,
  buildOrganizationCurrencyReader,
  buildOrganizationTimezoneReader,
} from "../modules/core/organization/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import { buildPaymentRequestReaders } from "./payment-request-readers.js";
import { buildSalesTenantPorts } from "./sales-tenant-router.js";

export interface PosRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly permissions: Pick<PermissionGate, "locationsWith">;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly rateLimiter: RateLimiter;
  /** Keys the pairing-code HMAC (`OTP_SECRET`) and decides the cookie flag; read from the config in routes/v1.ts. */
  readonly pos: { readonly pairingSecret: string; readonly isSecureCookies: boolean };
}

const PAIRING_BUCKET = "pos.pair.member";
const SECONDS_PER_HOUR = 3_600;

function missingTenantContext(): AppError {
  return new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.missing_tenant_context" });
}

function callerOf(input: PosRouterInput): PosCaller {
  const directory = asSystemPort(SYSTEM_REASON.AUTH_LOOKUP, buildMembershipDirectory());
  return {
    async memberIdOf(userId, organizationId) {
      const membership = await directory.findActiveMembership(userId, organizationId);
      if (membership === undefined) throw forbidden();
      return asId<MemberId>(membership.memberId);
    },
    async holdsAt(permissionKey: PermissionKey, locationId) {
      const locations = await input.permissions.locationsWith(permissionKey);
      return locations === "ALL" || locations.includes(locationId);
    },
  };
}

function settingsOf(input: PosRouterInput): PosSettingsReader {
  const resolver = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });
  return {
    async read(organizationId, locationId) {
      const resolved = await resolver.resolve(organizationId, {
        keys: [
          POS_REQUIRE_SHIFT_SETTING_KEY,
          POS_ALLOW_CREDIT_SALE_SETTING_KEY,
          POS_RECEIPT_FOOTER_SETTING_KEY,
        ],
        locationId,
      });
      const footer = resolved.get(POS_RECEIPT_FOOTER_SETTING_KEY)?.value;
      const requireShift = resolved.get(POS_REQUIRE_SHIFT_SETTING_KEY)?.value;
      const allowCredit = resolved.get(POS_ALLOW_CREDIT_SALE_SETTING_KEY)?.value;
      return {
        requireShift: typeof requireShift === "boolean" ? requireShift : POS_REQUIRE_SHIFT_DEFAULT,
        allowCreditSale:
          typeof allowCredit === "boolean" ? allowCredit : POS_ALLOW_CREDIT_SALE_DEFAULT,
        receiptFooter: typeof footer === "string" ? footer : POS_RECEIPT_FOOTER_DEFAULT,
      };
    },
  };
}

function paymentsOf(input: PosRouterInput): PosPaymentPort {
  const timezones = buildOrganizationTimezoneReader();
  const receive = new ReceivePaymentUseCase({
    payments: new MongoPaymentRepository(),
    storeCredit: new MongoStoreCreditRepository(),
    summaries: new MongoPaymentSummaryRepository(),
    contactStoreCredit: new MongoContactStoreCreditAdapter(),
    requestReaders: buildPaymentRequestReaders(),
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    audit: input.audit,
    clock: input.clock,
    timeZone: {
      read: async (organizationId: OrganizationId) => {
        const timezone = await timezones.read(organizationId);
        if (timezone === undefined) throw missingTenantContext();
        return timezone;
      },
    },
    orgConfig: input.orgConfig,
  });
  const sessions = buildPaymentSessionReader();
  return {
    async receive(payment) {
      const response = await receive.execute({
        organizationId: payment.organizationId,
        locationId: payment.locationId,
        method: payment.method,
        amount: payment.amount,
        externalReference: payment.externalReference,
        allocations: [
          {
            requestType: PAYMENT_REQUEST_TYPE.ORDER,
            requestId: payment.orderId,
            amount: payment.amount,
          },
        ],
        contactId: payment.contactId,
        receivedByMemberId: payment.receivedByMemberId,
        actorUserId: payment.actorUserId,
        posSessionId: payment.posSessionId,
      });
      return {
        paymentId: asId<PaymentId>(response.paymentId),
        paymentNumber: response.paymentNumber,
        method: response.method,
        amount: response.amount,
      };
    },
    methodTotals: (query) => sessions.methodTotals(query),
    orderAllocations: (query) => sessions.orderAllocations(query),
  };
}

function soldOrdersOf(): PosSoldOrdersReader {
  const reader = buildOrderTotalsReader();
  return {
    async readMany(orderIds) {
      const rows = await reader.readMany(orderIds);
      return rows.map((row) => ({
        orderId: row.orderId,
        subtotalMinor: row.totals.subtotal.amount,
        discountMinor: row.totals.discountTotal.amount,
        taxMinor: row.totals.taxTotal.amount,
        grandTotalMinor: row.totals.grandTotal.amount,
      }));
    },
  };
}

function rateLimitOf(limiter: RateLimiter): PosRateLimit {
  return {
    async consumePairingAttempt(memberKey) {
      const decision = await limiter.consume({
        bucket: PAIRING_BUCKET,
        key: memberKey,
        limit: POS_PAIRING_RULES.attemptsPerMemberPerHour,
        windowSeconds: SECONDS_PER_HOUR,
      });
      if (decision.allowed) return;
      throw new AppError({
        code: ERROR_CODE.RATE_LIMITED,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    },
  };
}

/** The POS API on the tenant pipeline (card 3.9): every port the module cannot build itself. */
export function buildPosTenantRouter(input: PosRouterInput): Router {
  const currencies = buildOrganizationCurrencyReader();
  return buildPosRouter({
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    idempotency: input.idempotency,
    caller: callerOf(input),
    locations: buildLocationLookup(),
    currency: {
      read: async (organizationId) => {
        const currency = await currencies.read(organizationId);
        if (currency === undefined) throw missingTenantContext();
        return currency;
      },
    },
    settings: settingsOf(input),
    sales: buildInstantSale(buildSalesTenantPorts(input)),
    payments: paymentsOf(input),
    soldOrders: soldOrdersOf(),
    catalog: buildPosSnapshotReader(),
    rateLimit: rateLimitOf(input.rateLimiter),
    pairingSecret: input.pos.pairingSecret,
    isSecureCookies: input.pos.isSecureCookies,
  });
}
