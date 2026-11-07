import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import { kernelEventPublisher } from "../../../../kernel/events/index.js";
import type { CollectionClaimRepository } from "../application/ports/collection-claim.repository.js";
import type {
  PaymentRepository,
  PaymentSummaryRepository,
  TimezoneReader,
} from "../application/ports/payment-repositories.js";
import { MongoPaymentRepository } from "./mongo-payment.repository.js";
import { MongoPaymentSummaryRepository } from "./mongo-payment-summary.repository.js";
import { MongoCollectionClaimRepository } from "./mongo-collection-claim.repository.js";
import { CollectCodUseCase } from "../application/use-cases/collect-cod.use-case.js";
import { ClaimCollectionsUseCase } from "../application/use-cases/claim-collections.use-case.js";
import { ReleaseCollectionsUseCase } from "../application/use-cases/release-collections.use-case.js";

export function buildCollectCodUseCase(input: {
  readonly audit: AuditRecorder;
  readonly timeZone: TimezoneReader;
  readonly repos?: {
    payments?: PaymentRepository;
    summaries?: PaymentSummaryRepository;
    collectionClaims?: CollectionClaimRepository;
  };
}): CollectCodUseCase {
  const r = input.repos ?? {};
  return new CollectCodUseCase({
    payments: r.payments ?? new MongoPaymentRepository(),
    summaries: r.summaries ?? new MongoPaymentSummaryRepository(),
    collectionClaims: r.collectionClaims ?? new MongoCollectionClaimRepository(),
    events: kernelEventPublisher,
    audit: input.audit,
    timeZone: input.timeZone,
  });
}

export function buildClaimCollectionsUseCase(
  collectionClaims?: CollectionClaimRepository,
): ClaimCollectionsUseCase {
  return new ClaimCollectionsUseCase(collectionClaims ?? new MongoCollectionClaimRepository());
}

export function buildReleaseCollectionsUseCase(
  collectionClaims?: CollectionClaimRepository,
): ReleaseCollectionsUseCase {
  return new ReleaseCollectionsUseCase(collectionClaims ?? new MongoCollectionClaimRepository());
}
