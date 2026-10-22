import type { ModuleManifest } from "@banijjik/contracts";
import type { RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { OrgConfigService } from "../../platform/entitlement/index.js";
import type { ContactCreator, PriceQuoterPort } from "./application/ports/booking-context-ports.js";
import type { DepositCheckPort, PaymentStatusReader } from "./application/ports/payment-ports.js";

export interface BookingTenantDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly quoter: PriceQuoterPort;
  readonly contacts: ContactCreator;
  readonly depositCheck: DepositCheckPort;
  readonly paymentStatusReader?: PaymentStatusReader;
}
