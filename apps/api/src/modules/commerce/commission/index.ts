import type { CommissionPostingSource } from "../accounting/index.js";
import type { RequestHandler, Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher, registerEventHandler } from "../../../kernel/events/index.js";
import { getLogger } from "../../../kernel/logger/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { AccrualDependencies } from "./application/accrue-commission.js";
import { buildCommissionPostingSource } from "./application/commission-posting-source.js";
import { buildAccrueCommissionHandler } from "./application/handlers/accrue-commission.handler.js";
import type {
  CommissionMemberNameReader,
  CommissionMemberRoleReader,
  CommissionOfferingReader,
  CommissionPaymentReader,
  CommissionReferenceReader,
  CommissionSourceReader,
  CommissionTimezoneReader,
} from "./application/ports/commission-ports.js";
import {
  CreateCommissionPayoutUseCase,
  GetCommissionPayoutUseCase,
  ListCommissionPayoutsUseCase,
  PreviewCommissionPayoutUseCase,
} from "./application/use-cases/payout.use-cases.js";
import {
  GetCommissionSummaryUseCase,
  ListCommissionEntriesUseCase,
  ListMyCommissionEntriesUseCase,
} from "./application/use-cases/entry.use-cases.js";
import {
  ArchiveCommissionRuleUseCase,
  CreateCommissionRuleUseCase,
  ListCommissionRulesUseCase,
  UpdateCommissionRuleUseCase,
} from "./application/use-cases/rule.use-cases.js";
import { MongoCommissionEntryRepository } from "./infrastructure/mongo-commission-entry.repository.js";
import { MongoCommissionPayoutRepository } from "./infrastructure/mongo-commission-payout.repository.js";
import { MongoCommissionRuleRepository } from "./infrastructure/mongo-commission-rule.repository.js";
import { MongoCommissionSourceMarkRepository } from "./infrastructure/mongo-commission-source-mark.repository.js";
import { CommissionController } from "./presentation/commission.controller.js";
import { buildCommissionTenantRouter } from "./presentation/commission-tenant.router.js";

export { commissionManifest } from "./module.manifest.js";
export { registerCommissionModels } from "./infrastructure/register-commission-models.js";
export type {
  AccrualDependencies,
  CommissionMemberNameReader,
  CommissionMemberRoleReader,
  CommissionOfferingReader,
  CommissionPaymentReader,
  CommissionReferenceReader,
  CommissionSourceReader,
  CommissionTimezoneReader,
};

/** What the module cannot read itself: other modules' data, adapted in routes/commission-adapters.ts. */
export interface CommissionReaders {
  readonly bookings: CommissionSourceReader;
  readonly payments: CommissionPaymentReader;
  readonly offerings: CommissionOfferingReader;
  readonly memberRoles: CommissionMemberRoleReader;
  readonly timezones: CommissionTimezoneReader;
  readonly references: CommissionReferenceReader;
  readonly memberNames: CommissionMemberNameReader;
}

export interface CommissionTenantDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly readers: CommissionReaders;
  readonly idempotency: RequestHandler;
}

export function buildCommissionRouter(dependencies: CommissionTenantDependencies): Router {
  const rules = new MongoCommissionRuleRepository();
  const entries = new MongoCommissionEntryRepository();
  const payouts = new MongoCommissionPayoutRepository();
  const unitOfWork = new MongoUnitOfWork();
  const { readers } = dependencies;
  const ruleWrite = {
    rules,
    references: readers.references,
    unitOfWork,
    audit: dependencies.audit,
    clock: dependencies.clock,
  };
  const entryRead = {
    entries,
    memberNames: readers.memberNames,
    references: readers.references,
  };
  const controller = new CommissionController({
    listRules: new ListCommissionRulesUseCase(rules),
    createRule: new CreateCommissionRuleUseCase(ruleWrite),
    updateRule: new UpdateCommissionRuleUseCase(ruleWrite),
    archiveRule: new ArchiveCommissionRuleUseCase(ruleWrite),
    listEntries: new ListCommissionEntriesUseCase(entryRead),
    listMyEntries: new ListMyCommissionEntriesUseCase(entryRead),
    summary: new GetCommissionSummaryUseCase(entryRead),
    previewPayout: new PreviewCommissionPayoutUseCase({ entries, references: readers.references }),
    createPayout: new CreateCommissionPayoutUseCase({
      entries,
      payouts,
      references: readers.references,
      timezones: readers.timezones,
      events: kernelEventPublisher,
      unitOfWork,
      audit: dependencies.audit,
      clock: dependencies.clock,
    }),
    listPayouts: new ListCommissionPayoutsUseCase(payouts),
    getPayout: new GetCommissionPayoutUseCase(payouts),
  });
  return buildCommissionTenantRouter({
    controller,
    permission: dependencies.permission,
    idempotency: dependencies.idempotency,
  });
}

export function buildAccrualDependencies(input: {
  readonly clock: Clock;
  readonly readers: CommissionReaders;
}): AccrualDependencies {
  const { readers } = input;
  return {
    rules: new MongoCommissionRuleRepository(),
    entries: new MongoCommissionEntryRepository(),
    marks: new MongoCommissionSourceMarkRepository(),
    bookings: readers.bookings,
    payments: readers.payments,
    offerings: readers.offerings,
    memberRoles: readers.memberRoles,
    timezones: readers.timezones,
    events: kernelEventPublisher,
    unitOfWork: new MongoUnitOfWork(),
    clock: input.clock,
    logger: getLogger(),
  };
}

/** Registers `commission.accrue`; the handler runner skips it for an organization whose module is off. */
export function registerCommissionEventHandlers(input: {
  readonly clock: Clock;
  readonly readers: CommissionReaders;
}): void {
  registerEventHandler(buildAccrueCommissionHandler(buildAccrualDependencies(input)));
}

/** The adapter accounting posts commission journals from (plan 3.11 decision 8). */
export function buildCommissionPostingSourceAdapter(): CommissionPostingSource {
  return buildCommissionPostingSource({
    entries: new MongoCommissionEntryRepository(),
    payouts: new MongoCommissionPayoutRepository(),
  });
}
