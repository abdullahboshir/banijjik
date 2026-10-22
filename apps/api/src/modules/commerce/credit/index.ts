import { registerCreditModels } from "./infrastructure/register-credit-models.js";
import { buildCreditStorefrontRouter } from "./presentation/credit-storefront.router.js";
import { buildCreditTenantRouter } from "./presentation/credit-tenant.router.js";
import {
  MongoCreditRepository,
  MongoCreditPackRepository,
  MongoListingUnlockRepository,
} from "./infrastructure/index.js";
import { MongoCreditPurchaseRepository } from "./infrastructure/mongo-credit-purchase.repository.js";
import {
  UnlockListingUseCase,
  GetMyCreditsUseCase,
  GetMyUnlocksUseCase,
  ListCreditPacksUseCase,
  ListActiveCreditPacksUseCase,
  CreateCreditPackUseCase,
  UpdateCreditPackUseCase,
  ArchiveCreditPackUseCase,
  AdjustCreditsUseCase,
  ExpireCreditsUseCase,
  GetCreditPaymentInfoUseCase,
  SubmitCreditPurchaseUseCase,
  ListMyCreditPurchasesUseCase,
  CancelCreditPurchaseUseCase,
  ListCreditPurchasesStaffUseCase,
  GetCreditPurchaseStaffUseCase,
  VerifyCreditPurchaseUseCase,
  RejectCreditPurchaseUseCase,
  CancelExpiredPurchasesUseCase,
  buildCancelExpiredPurchasesJob,
  type CancelExpiredPurchasesDependencies,
  type CreditDependencies,
} from "./application/index.js";
import { CreditListingUnlockReader } from "./application/adapters/index.js";
import { registerScheduledJob } from "../../../kernel/jobs/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { buildCreditEventPublisher } from "./infrastructure/credit-event-publisher.js";

export { creditManifest } from "./module.manifest.js";

export function registerCreditScheduledJobs(input: {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
}): void {
  const dependencies: CancelExpiredPurchasesDependencies = {
    purchases: new MongoCreditPurchaseRepository(),
    unitOfWork: new MongoUnitOfWork(),
    audit: input.audit,
    events: buildCreditEventPublisher(),
  };
  registerScheduledJob(
    buildCancelExpiredPurchasesJob({
      cancelExpiredPurchases: new CancelExpiredPurchasesUseCase(dependencies),
    }),
  );
}

export {
  registerCreditModels,
  buildCreditStorefrontRouter,
  buildCreditTenantRouter,
  MongoCreditRepository,
  MongoCreditPackRepository,
  MongoListingUnlockRepository,
  MongoCreditPurchaseRepository,
  UnlockListingUseCase,
  GetMyCreditsUseCase,
  GetMyUnlocksUseCase,
  ListCreditPacksUseCase,
  ListActiveCreditPacksUseCase,
  CreateCreditPackUseCase,
  UpdateCreditPackUseCase,
  ArchiveCreditPackUseCase,
  AdjustCreditsUseCase,
  ExpireCreditsUseCase,
  GetCreditPaymentInfoUseCase,
  SubmitCreditPurchaseUseCase,
  ListMyCreditPurchasesUseCase,
  CancelCreditPurchaseUseCase,
  ListCreditPurchasesStaffUseCase,
  GetCreditPurchaseStaffUseCase,
  VerifyCreditPurchaseUseCase,
  RejectCreditPurchaseUseCase,
  CancelExpiredPurchasesUseCase,
  buildCancelExpiredPurchasesJob,
  buildCreditEventPublisher,
  CreditListingUnlockReader,
  type CancelExpiredPurchasesDependencies,
  type CreditDependencies,
};
