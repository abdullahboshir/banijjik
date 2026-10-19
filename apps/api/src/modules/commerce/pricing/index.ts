import type { RequestHandler, Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type {
  CatalogQuoteReader,
  LocationReachChecker,
  OrganizationPricingContext,
  PricingSettingsReader,
} from "./application/ports/pricing-context-ports.js";
import {
  ArchivePromotionUseCase,
  CreatePromotionUseCase,
  GetPromotionUseCase,
  ListPromotionsUseCase,
  UpdatePromotionUseCase,
} from "./application/use-cases/promotion.use-cases.js";
import { QuoteUseCase, type QuoteUseCaseInput } from "./application/use-cases/quote.use-case.js";
import {
  ArchiveTaxClassUseCase,
  CreateTaxClassUseCase,
  GetTaxClassUseCase,
  ListTaxClassesUseCase,
  UpdateTaxClassUseCase,
} from "./application/use-cases/tax-class.use-cases.js";
import {
  MongoPromotionRepository,
  MongoTaxClassRepository,
} from "./infrastructure/mongo-pricing.repositories.js";
import {
  PromotionController,
  QuoteController,
  TaxClassController,
} from "./presentation/pricing.controllers.js";
import { buildPricingTenantRouter } from "./presentation/pricing-tenant.router.js";

export { pricingManifest } from "./module.manifest.js";
export { registerPricingModels } from "./infrastructure/register-pricing-models.js";
export type {
  CatalogQuoteReader,
  LocationReachChecker,
  OrganizationPricingContext,
  PricingSettingsReader,
};

export interface PricingTenantDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
  readonly organization: OrganizationPricingContext;
  readonly settings: PricingSettingsReader;
  readonly catalog: CatalogQuoteReader;
  readonly locationReach: LocationReachChecker;
}

/** Other modules ask for a quote through this port (adapted in routes). */
export interface PriceQuoter {
  quote(input: QuoteUseCaseInput): Promise<Awaited<ReturnType<QuoteUseCase["execute"]>>>;
}

export function buildPriceQuoter(dependencies: PricingTenantDependencies): PriceQuoter {
  const quote = new QuoteUseCase({
    catalog: dependencies.catalog,
    taxClasses: new MongoTaxClassRepository(),
    promotions: new MongoPromotionRepository(),
    organization: dependencies.organization,
    settings: dependencies.settings,
    locationReach: dependencies.locationReach,
    clock: dependencies.clock,
  });
  return { quote: (input) => quote.execute(input) };
}

/** Composition root: repositories, use cases and router are wired here and nowhere else. */
export function buildPricingRouter(dependencies: PricingTenantDependencies): Router {
  const unitOfWork = new MongoUnitOfWork();
  const taxClasses = new MongoTaxClassRepository();
  const promotions = new MongoPromotionRepository();
  const write = {
    taxClasses,
    promotions,
    unitOfWork,
    audit: dependencies.audit,
    events: kernelEventPublisher,
    clock: dependencies.clock,
    organization: dependencies.organization,
  };
  const quote = new QuoteUseCase({
    catalog: dependencies.catalog,
    taxClasses,
    promotions,
    organization: dependencies.organization,
    settings: dependencies.settings,
    locationReach: dependencies.locationReach,
    clock: dependencies.clock,
  });
  return buildPricingTenantRouter({
    taxClasses: new TaxClassController({
      list: new ListTaxClassesUseCase(taxClasses),
      get: new GetTaxClassUseCase(taxClasses),
      create: new CreateTaxClassUseCase(write),
      update: new UpdateTaxClassUseCase(write),
      archive: new ArchiveTaxClassUseCase(write),
    }),
    promotions: new PromotionController({
      list: new ListPromotionsUseCase(promotions),
      get: new GetPromotionUseCase(promotions),
      create: new CreatePromotionUseCase(write),
      update: new UpdatePromotionUseCase(write),
      archive: new ArchivePromotionUseCase(write),
    }),
    quotes: new QuoteController(quote),
    permission: dependencies.permission,
    idempotency: dependencies.idempotency,
  });
}
