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
  type CreditDependencies,
} from "./application/index.js";
import { CreditListingUnlockReader } from "./application/adapters/index.js";
import { registerScheduledJob } from "../../../kernel/jobs/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";

export { creditManifest } from "./module.manifest.js";

export function registerCreditScheduledJobs(input: {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
}): void {
  const purchases = new MongoCreditPurchaseRepository();
  const unitOfWork = new MongoUnitOfWork();
  registerScheduledJob(
    buildCancelExpiredPurchasesJob({
      cancelExpiredPurchases: new CancelExpiredPurchasesUseCase({
        purchases,
        unitOfWork,
        audit: input.audit,
        events: {
          publish: async (
            type: string,
            payload: unknown,
            options?: { version?: number; orderingKey?: string },
          ) => {
            await (
              kernelEventPublisher as unknown as {
                publish: (t: string, p: unknown, o?: unknown) => Promise<void>;
              }
            ).publish(type, payload, options);
          },
        },
        clock: input.clock,
      } as unknown as import("./application/ports/credit-dependencies.js").CreditDependencies),
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
  CreditListingUnlockReader,
  type CreditDependencies,
};
