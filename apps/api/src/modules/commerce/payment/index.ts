import type { ModuleManifest } from "@banijjik/contracts";
import type { RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import { registerScheduledJob } from "../../../kernel/jobs/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { OrgConfigService } from "../../platform/entitlement/index.js";
import type { ApprovalVerifier } from "../../core/iam/index.js";
import { buildPaymentPostingSource } from "./infrastructure/payment-posting-source.adapter.js";
import { buildExpireStoreCreditJob } from "./application/jobs/expire-store-credit.job.js";
import type {
  ContactStoreCreditPort,
  PaymentRepository,
  PaymentSummaryRepository,
  StoreCreditRepository,
  TimezoneReader,
} from "./application/ports/payment-repositories.js";
import {
  RequestReaderRegistry,
  type RequestReader,
  type RequestReadSnapshot,
} from "./application/ports/request-reader.js";
import {
  RequestPaymentLifecycleRegistry,
  type RequestPaymentLifecycle,
} from "./application/ports/request-payment-lifecycle.js";
import { DefaultRequestPaymentLifecycle } from "./application/lifecycle/default-request-payment-lifecycle.js";
import type { RequestAdvanceReader } from "./application/ports/request-advance-reader.js";
import { AdjustStoreCreditUseCase } from "./application/use-cases/adjust-store-credit.use-case.js";
import {
  GetPaymentUseCase,
  ListPaymentsUseCase,
} from "./application/use-cases/get-payment.use-case.js";
import { GetDuesUseCase } from "./application/use-cases/get-dues.use-case.js";
import { ListStoreCreditEntriesUseCase } from "./application/use-cases/list-store-credit-entries.use-case.js";
import {
  ReceivePaymentUseCase,
  toPaymentResponse,
} from "./application/use-cases/receive-payment.use-case.js";
import { RefundPaymentUseCase } from "./application/use-cases/refund-payment.use-case.js";
import { ReversePaymentUseCase } from "./application/use-cases/reverse-payment.use-case.js";
import { settleBookingTermination } from "./application/use-cases/settle-booking-deposit.js";
import { MongoContactStoreCreditAdapter } from "./infrastructure/contact-store-credit.adapter.js";
import { MongoPaymentRepository } from "./infrastructure/mongo-payment.repository.js";
import { MongoPaymentSummaryRepository } from "./infrastructure/mongo-payment-summary.repository.js";
import { MongoStoreCreditRepository } from "./infrastructure/mongo-store-credit.repository.js";
import { buildRequestAdvanceReader } from "./infrastructure/request-advance.reader.js";
import { registerPaymentModels } from "./infrastructure/register-payment-models.js";
export { paymentManifest } from "./module.manifest.js";
import { PaymentController } from "./presentation/payment.controller.js";
import { buildPaymentTenantRouter } from "./presentation/payment-tenant.router.js";

export {
  registerPaymentModels,
  buildPaymentPostingSource,
  buildExpireStoreCreditJob,
  buildPaymentTenantRouter,
  PaymentController,
  ReceivePaymentUseCase,
  RefundPaymentUseCase,
  ReversePaymentUseCase,
  GetPaymentUseCase,
  ListPaymentsUseCase,
  GetDuesUseCase,
  AdjustStoreCreditUseCase,
  ListStoreCreditEntriesUseCase,
  RequestReaderRegistry,
  RequestPaymentLifecycleRegistry,
  DefaultRequestPaymentLifecycle,
  MongoPaymentRepository,
  MongoStoreCreditRepository,
  MongoPaymentSummaryRepository,
  MongoContactStoreCreditAdapter,
  buildRequestAdvanceReader,
  settleBookingTermination,
  toPaymentResponse,
  type RequestReader,
  type RequestReadSnapshot,
  type RequestPaymentLifecycle,
  type RequestAdvanceReader,
  type PaymentRepository,
  type StoreCreditRepository,
  type PaymentSummaryRepository,
  type ContactStoreCreditPort,
};

export interface PaymentTenantDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly approvals: Pick<ApprovalVerifier, "consume">;
  readonly requestReaders: RequestReaderRegistry;
  readonly lifecycles?: RequestPaymentLifecycleRegistry | undefined;
  readonly hasRefundWithoutApprovalPermission: (
    userId: import("@banijjik/ids").UserId,
    organizationId: import("@banijjik/ids").OrganizationId,
    locationId: string,
  ) => Promise<boolean>;
  readonly getMemberId: (
    userId: import("@banijjik/ids").UserId,
    organizationId: import("@banijjik/ids").OrganizationId,
  ) => Promise<string>;
  readonly timeZone: import("./application/ports/payment-repositories.js").TimezoneReader;
}

function resolvePaymentRepos(repos?: {
  payments?: PaymentRepository;
  storeCredit?: StoreCreditRepository;
  summaries?: PaymentSummaryRepository;
  contactStoreCredit?: ContactStoreCreditPort;
}) {
  return {
    payments: repos?.payments ?? new MongoPaymentRepository(),
    storeCredit: repos?.storeCredit ?? new MongoStoreCreditRepository(),
    summaries: repos?.summaries ?? new MongoPaymentSummaryRepository(),
    contactStoreCredit: repos?.contactStoreCredit ?? new MongoContactStoreCreditAdapter(),
  };
}

export function buildPaymentController(
  deps: PaymentTenantDependencies,
  repos?: {
    payments?: PaymentRepository;
    storeCredit?: StoreCreditRepository;
    summaries?: PaymentSummaryRepository;
    contactStoreCredit?: ContactStoreCreditPort;
  },
): PaymentController {
  const { payments, storeCredit, summaries, contactStoreCredit } = resolvePaymentRepos(repos);
  const unitOfWork = new MongoUnitOfWork();

  const useCaseDeps = {
    payments,
    storeCredit,
    summaries,
    contactStoreCredit,
    requestReaders: deps.requestReaders,
    lifecycles: deps.lifecycles,
    unitOfWork,
    events: kernelEventPublisher,
    audit: deps.audit,
    clock: deps.clock,
    timeZone: deps.timeZone,
    orgConfig: deps.orgConfig,
  };

  return new PaymentController({
    receivePayment: new ReceivePaymentUseCase(useCaseDeps),
    refundPayment: new RefundPaymentUseCase({
      ...useCaseDeps,
      approvals: deps.approvals,
    }),
    reversePayment: new ReversePaymentUseCase({
      ...useCaseDeps,
      approvals: deps.approvals,
    }),
    getPayment: new GetPaymentUseCase(payments),
    listPayments: new ListPaymentsUseCase(payments),
    getDues: new GetDuesUseCase(summaries),
    adjustStoreCredit: new AdjustStoreCreditUseCase({
      storeCredit,
      contactStoreCredit,
      unitOfWork,
      approvals: deps.approvals,
      orgConfig: deps.orgConfig,
      events: kernelEventPublisher,
      audit: deps.audit,
      clock: deps.clock,
    }),
    listStoreCredit: new ListStoreCreditEntriesUseCase({
      storeCredit,
      contactStoreCredit,
    }),
    hasRefundWithoutApprovalPermission: deps.hasRefundWithoutApprovalPermission,
    getMemberId: deps.getMemberId,
  });
}

export function registerPaymentScheduledJobs(input: {
  readonly clock: Clock;
  readonly orgConfig: OrgConfigService;
  readonly repos?: {
    storeCredit?: StoreCreditRepository;
    contactStoreCredit?: ContactStoreCreditPort;
  };
}): void {
  const storeCredit = input.repos?.storeCredit ?? new MongoStoreCreditRepository();
  const contactStoreCredit =
    input.repos?.contactStoreCredit ?? new MongoContactStoreCreditAdapter();
  const unitOfWork = new MongoUnitOfWork();

  registerScheduledJob(
    buildExpireStoreCreditJob({
      storeCredit,
      contactStoreCredit,
      unitOfWork,
      events: kernelEventPublisher,
      orgConfig: input.orgConfig,
      clock: input.clock,
    }),
  );
}

export function buildPaymentPostingSourceAdapter(
  requestReaders: RequestReaderRegistry,
): import("../accounting/index.js").PaymentPostingSource {
  return buildPaymentPostingSource({ requestReaders });
}

export { settleRequestTermination } from "./application/use-cases/settle-request-termination.js";

export { isApprovalRequired } from "./application/use-cases/refund-payment-helpers.js";
export { findStoreCreditEntryIdOfPayment } from "./infrastructure/store-credit-entry-of-payment.js";

/**
 * The refund use case for a caller that already holds a transaction (a sales return, plan 3.5b
 * decision 5). It joins the caller's session, so the refund and the caller's writes commit together.
 */
export function buildRefundPaymentUseCase(input: {
  readonly requestReaders: RequestReaderRegistry;
  readonly approvals: Pick<ApprovalVerifier, "consume">;
  readonly orgConfig: OrgConfigService;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly timeZone: import("./application/ports/payment-repositories.js").TimezoneReader;
}): RefundPaymentUseCase {
  return new RefundPaymentUseCase({
    payments: new MongoPaymentRepository(),
    storeCredit: new MongoStoreCreditRepository(),
    summaries: new MongoPaymentSummaryRepository(),
    contactStoreCredit: new MongoContactStoreCreditAdapter(),
    requestReaders: input.requestReaders,
    unitOfWork: new MongoUnitOfWork(),
    approvals: input.approvals,
    events: kernelEventPublisher,
    audit: input.audit,
    clock: input.clock,
    timeZone: input.timeZone,
    orgConfig: input.orgConfig,
  });
}
export {
  buildPaymentSessionReader,
  type PaymentSessionReader,
  type SessionMethodTotal,
  type SessionOrderAllocation,
} from "./infrastructure/mongo-payment-session.reader.js";

export function buildReceivePaymentUseCase(input: {
  readonly requestReaders: RequestReaderRegistry;
  readonly orgConfig: OrgConfigService;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly timeZone: TimezoneReader;
}): ReceivePaymentUseCase {
  return new ReceivePaymentUseCase({
    payments: new MongoPaymentRepository(),
    storeCredit: new MongoStoreCreditRepository(),
    summaries: new MongoPaymentSummaryRepository(),
    contactStoreCredit: new MongoContactStoreCreditAdapter(),
    requestReaders: input.requestReaders,
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    audit: input.audit,
    clock: input.clock,
    timeZone: input.timeZone,
    orgConfig: input.orgConfig,
  });
}
