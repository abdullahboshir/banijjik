import { ALL_LOCATIONS, ERROR_CODE } from "@banijjik/contracts";
import {
  asId,
  type BookingId,
  type CategoryId,
  type OfferingId,
  type OrderId,
  type OrganizationId,
  type PaymentId,
  type RoleId,
} from "@banijjik/ids";
import type { RequestHandler, Router } from "express";
import type { PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { getRequestContext } from "../kernel/context/index.js";
import { AppError } from "../kernel/http/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildBookingReader } from "../modules/commerce/booking/index.js";
import {
  MongoCategoryRepository,
  MongoOfferingRepository,
} from "../modules/commerce/catalog/index.js";
import {
  buildCommissionRouter,
  registerCommissionEventHandlers,
  type CommissionReaders,
} from "../modules/commerce/commission/index.js";
import { buildOrderRepository } from "../modules/commerce/sales/index.js";
import {
  MongoPaymentRepository,
  MongoPaymentSummaryRepository,
} from "../modules/commerce/payment/index.js";
import { buildTenantRoleReader } from "../modules/core/iam/index.js";
import {
  buildMemberAccessReader,
  buildMemberNameReader,
  buildOrganizationCurrencyReader,
  buildOrganizationTimezoneReader,
} from "../modules/core/organization/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";

function requireOrganizationId(): string {
  const { organizationId } = getRequestContext();
  if (organizationId === undefined) {
    throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.missing_tenant_context" });
  }
  return organizationId;
}

function buildSourceReader(): CommissionReaders["bookings"] {
  const bookings = buildBookingReader();
  return {
    async readBooking(bookingId) {
      const booking = await bookings.findById(asId<BookingId>(bookingId));
      if (booking === undefined) return undefined;
      return {
        bookingId: booking.bookingId,
        bookingNumber: booking.bookingNumber,
        locationId: booking.locationId,
        providerMemberId: booking.providerMemberId,
        offeringId: booking.offeringId,
        quantity: booking.quantity,
        status: booking.status,
        price: booking.price,
      };
    },
  };
}

function buildOrderSourceReader(): CommissionReaders["orders"] {
  const orders = buildOrderRepository();
  return {
    async readOrder(orderId) {
      const order = await orders.findById(asId<OrderId>(orderId));
      if (order === undefined) return undefined;
      return {
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        locationId: order.locationId,
        status: order.status,
        grandTotal: order.totals.grandTotal,
        lines: order.lines.map((line) => ({
          orderLineId: line.orderLineId,
          offeringId: line.offeringId,
          quantity: line.quantity,
          lineNetTotal: line.lineNetTotal,
          lineTax: line.lineTax,
          performedByMemberId: line.performedByMemberId,
        })),
      };
    },
  };
}

function buildPaymentReader(): CommissionReaders["payments"] {
  const payments = new MongoPaymentRepository();
  const summaries = new MongoPaymentSummaryRepository();
  return {
    async readAllocations(paymentId) {
      const organizationId = asId<OrganizationId>(requireOrganizationId());
      const payment = await payments.findById(organizationId, asId<PaymentId>(paymentId));
      return payment === undefined ? [] : payment.allocations;
    },
    async readRefunded(requestType, requestId) {
      const organizationId = asId<OrganizationId>(requireOrganizationId());
      const summary = await summaries.findByRequest(organizationId, requestType, requestId);
      return summary?.refunded;
    },
  };
}

function buildOfferingReader(): CommissionReaders["offerings"] {
  const offerings = new MongoOfferingRepository();
  return {
    async readOffering(offeringId) {
      const offering = await offerings.findById(asId<OfferingId>(offeringId));
      if (offering === undefined) return undefined;
      return { kind: offering.kind, categoryIds: offering.categoryIds };
    },
  };
}

function buildMemberRoleReader(): CommissionReaders["memberRoles"] {
  const access = buildMemberAccessReader();
  return {
    async roleIdsAt(memberId, locationId) {
      const assignments = await access.findAssignments(memberId);
      return assignments
        .filter(
          (assignment) =>
            assignment.locationId === ALL_LOCATIONS || assignment.locationId === locationId,
        )
        .map((assignment) => assignment.roleId);
    },
  };
}

function buildTimezoneReader(): CommissionReaders["timezones"] {
  const timezones = buildOrganizationTimezoneReader();
  return {
    async read(organizationId) {
      const timeZone = await timezones.read(organizationId);
      if (timeZone === undefined) {
        throw new AppError({ code: ERROR_CODE.NOT_FOUND, messageKey: "errors.not_found" });
      }
      return timeZone;
    },
  };
}

function buildReferenceReader(orgConfig: OrgConfigService): CommissionReaders["references"] {
  const names = buildMemberNameReader();
  const roles = buildTenantRoleReader();
  const categories = new MongoCategoryRepository();
  const offerings = new MongoOfferingRepository();
  const currencies = buildOrganizationCurrencyReader();
  return {
    memberExists: async (memberId) => (await names.readNames([memberId])).has(memberId),
    roleExists: async (roleId) => (await roles.findByIds([asId<RoleId>(roleId)])).length > 0,
    categoryExists: async (categoryId) =>
      (await categories.findById(asId<CategoryId>(categoryId))) !== undefined,
    offeringExists: async (offeringId) =>
      (await offerings.findById(asId<OfferingId>(offeringId))) !== undefined,
    enabledKinds: async () => (await orgConfig.current()).config.kinds,
    async organizationCurrency(organizationId) {
      const currency = await currencies.read(organizationId);
      if (currency === undefined) {
        throw new AppError({ code: ERROR_CODE.NOT_FOUND, messageKey: "errors.not_found" });
      }
      return currency;
    },
  };
}

/** The other modules' data the commission module reads, adapted to its own ports (ADR-023). */
export function buildCommissionReaders(orgConfig: OrgConfigService): CommissionReaders {
  return {
    bookings: buildSourceReader(),
    orders: buildOrderSourceReader(),
    payments: buildPaymentReader(),
    offerings: buildOfferingReader(),
    memberRoles: buildMemberRoleReader(),
    timezones: buildTimezoneReader(),
    references: buildReferenceReader(orgConfig),
    memberNames: buildMemberNameReader(),
  };
}

export interface CommissionRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly orgConfig: OrgConfigService;
  readonly idempotency: RequestHandler;
}

/** Commission rules and ledger API, mounted on the tenant pipeline (card 3.11). */
export function buildCommissionTenantRouter(input: CommissionRouterInput): Router {
  return buildCommissionRouter({
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    idempotency: input.idempotency,
    readers: buildCommissionReaders(input.orgConfig),
  });
}

/** Registers the commission event handlers for the worker role. */
export function registerCommissionHandlers(clock: Clock, orgConfig: OrgConfigService): void {
  registerCommissionEventHandlers({ clock, readers: buildCommissionReaders(orgConfig) });
}
