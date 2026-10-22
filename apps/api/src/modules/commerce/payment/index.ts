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
} from "./application/ports/payment-repositories.js";
import {
  RequestReaderRegistry,
  type RequestReader,
  type RequestReadSnapshot,
} from "./application/ports/request-reader.js";
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
import { MongoContactStoreCreditAdapter } from "./infrastructure/contact-store-credit.adapter.js";
import { MongoPaymentRepository } from "./infrastructure/mongo-payment.repository.js";
import { MongoPaymentSummaryRepository } from "./infrastructure/mongo-payment-summary.repository.js";
import { MongoStoreCreditRepository } from "./infrastructure/mongo-store-credit.repository.js";
import { registerPaymentModels } from "./infrastructure/register-payment-models.js";
import { paymentManifest } from "./module.manifest.js";
import { PaymentController } from "./presentation/payment.controller.js";
import { buildPaymentTenantRouter } from "./presentation/payment-tenant.router.js";

export {
  paymentManifest,
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
  MongoPaymentRepository,
  MongoStoreCreditRepository,
  MongoPaymentSummaryRepository,
  MongoContactStoreCreditAdapter,
  toPaymentResponse,
  type RequestReader,
  type RequestReadSnapshot,
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
  readonly orgConfig?: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly approvals: Pick<ApprovalVerifier, "consume">;
  readonly requestReaders: RequestReaderRegistry;
  readonly isManagerOrOwner: (
    userId: import("@banijjik/ids").UserId,
    organizationId: import("@banijjik/ids").OrganizationId,
  ) => Promise<boolean>;
  readonly getMemberId: (
    userId: import("@banijjik/ids").UserId,
    organizationId: import("@banijjik/ids").OrganizationId,
  ) => Promise<string>;
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
  const payments = repos?.payments ?? new MongoPaymentRepository();
  const storeCredit = repos?.storeCredit ?? new MongoStoreCreditRepository();
  const summaries = repos?.summaries ?? new MongoPaymentSummaryRepository();
  const contactStoreCredit = repos?.contactStoreCredit ?? new MongoContactStoreCreditAdapter();
  const unitOfWork = new MongoUnitOfWork();

  const useCaseDeps = {
    payments,
    storeCredit,
    summaries,
    contactStoreCredit,
    requestReaders: deps.requestReaders,
    unitOfWork,
    events: kernelEventPublisher,
    audit: deps.audit,
    clock: deps.clock,
    ...(deps.orgConfig ? { orgConfig: deps.orgConfig } : {}),
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
      events: kernelEventPublisher,
      audit: deps.audit,
      clock: deps.clock,
    }),
    listStoreCredit: new ListStoreCreditEntriesUseCase({
      storeCredit,
      contactStoreCredit,
    }),
    isManagerOrOwner: deps.isManagerOrOwner,
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
