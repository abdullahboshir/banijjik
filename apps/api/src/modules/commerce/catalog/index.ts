import type { RequestHandler, Router } from "express";
import type { LimitGuard, PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { CatalogDependencies } from "./application/catalog-dependencies.js";
import type {
  CatalogCustomFieldReader,
  DefaultUnitReader,
  LocationLookup,
  OfferingImageChecker,
  OrganizationCatalogContext,
  SensitiveValueAccess,
} from "./application/ports/catalog-context-ports.js";
import {
  ArchiveCategoryUseCase,
  CreateCategoryUseCase,
  GetCategoryUseCase,
  ListCategoriesUseCase,
  UpdateCategoryUseCase,
} from "./application/use-cases/category.use-cases.js";
import { CreateOfferingUseCase } from "./application/use-cases/create-offering.use-case.js";
import { GetOfferingUseCase } from "./application/use-cases/get-offering.use-case.js";
import { ListOfferingsUseCase } from "./application/use-cases/list-offerings.use-case.js";
import {
  ArchiveModifierGroupUseCase,
  CreateModifierGroupUseCase,
  GetModifierGroupUseCase,
  ListModifierGroupsUseCase,
  UpdateModifierGroupUseCase,
} from "./application/use-cases/modifier-group.use-cases.js";
import {
  ClearOfferingLocationUseCase,
  SetOfferingLocationUseCase,
} from "./application/use-cases/offering-location.use-cases.js";
import {
  ArchiveOfferingUseCase,
  PublishOfferingUseCase,
} from "./application/use-cases/offering-transitions.use-cases.js";
import {
  GetSynonymsUseCase,
  UpdateSynonymsUseCase,
} from "./application/use-cases/synonym.use-cases.js";
import { UpdateOfferingUseCase } from "./application/use-cases/update-offering.use-case.js";
import { MongoCategoryRepository } from "./infrastructure/mongo-category.repository.js";
import { MongoOfferingRepository } from "./infrastructure/mongo-offering.repository.js";
import {
  MongoModifierGroupRepository,
  MongoOfferingCounter,
  MongoOfferingLocationRepository,
  MongoSynonymRepository,
} from "./infrastructure/mongo-record.repositories.js";
import { OfferingController } from "./presentation/offering.controller.js";
import { buildCatalogTenantRouter } from "./presentation/catalog-tenant.router.js";
import {
  CategoryController,
  ModifierGroupController,
  SynonymController,
} from "./presentation/record.controllers.js";

export { catalogManifest } from "./module.manifest.js";
export { registerCatalogModels } from "./infrastructure/register-catalog-models.js";
export type {
  CatalogCustomFieldReader,
  DefaultUnitReader,
  LocationLookup,
  OfferingImageChecker,
  OrganizationCatalogContext,
  SensitiveValueAccess,
};

export interface CatalogTenantDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  /** The `Idempotency-Key` middleware, built once by routes/v1.ts. */
  readonly idempotency: RequestHandler;
  readonly limits: LimitGuard;
  /** Adapters over other modules (organization, custom-field, file, settings), supplied by routes. */
  readonly organization: OrganizationCatalogContext;
  readonly customFields: CatalogCustomFieldReader;
  readonly sensitiveAccess: SensitiveValueAccess;
  readonly images: OfferingImageChecker;
  readonly locationLookup: LocationLookup;
  readonly defaultUnits: DefaultUnitReader;
}

function writeDependencies(dependencies: CatalogTenantDependencies): CatalogDependencies {
  return {
    offerings: new MongoOfferingRepository(),
    categories: new MongoCategoryRepository(),
    modifierGroups: new MongoModifierGroupRepository(),
    locationRows: new MongoOfferingLocationRepository(),
    synonyms: new MongoSynonymRepository(),
    counter: new MongoOfferingCounter(),
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    audit: dependencies.audit,
    clock: dependencies.clock,
    limits: dependencies.limits,
    organization: dependencies.organization,
    customFields: dependencies.customFields,
    sensitiveAccess: dependencies.sensitiveAccess,
    images: dependencies.images,
    locationLookup: dependencies.locationLookup,
    defaultUnits: dependencies.defaultUnits,
  };
}

/** Composition root: repositories, use cases and router are wired here and nowhere else. */
export function buildCatalogRouter(dependencies: CatalogTenantDependencies): Router {
  const write = writeDependencies(dependencies);
  const offerings = new OfferingController({
    listOfferings: new ListOfferingsUseCase(write),
    getOffering: new GetOfferingUseCase(write),
    createOffering: new CreateOfferingUseCase(write),
    updateOffering: new UpdateOfferingUseCase(write),
    publishOffering: new PublishOfferingUseCase(write),
    archiveOffering: new ArchiveOfferingUseCase(write),
    setLocation: new SetOfferingLocationUseCase(write),
    clearLocation: new ClearOfferingLocationUseCase(write),
  });
  const categories = new CategoryController({
    listCategories: new ListCategoriesUseCase(write),
    getCategory: new GetCategoryUseCase(write),
    createCategory: new CreateCategoryUseCase(write),
    updateCategory: new UpdateCategoryUseCase(write),
    archiveCategory: new ArchiveCategoryUseCase(write),
  });
  const modifierGroups = new ModifierGroupController({
    listGroups: new ListModifierGroupsUseCase(write.modifierGroups),
    getGroup: new GetModifierGroupUseCase(write.modifierGroups),
    createGroup: new CreateModifierGroupUseCase(write),
    updateGroup: new UpdateModifierGroupUseCase(write),
    archiveGroup: new ArchiveModifierGroupUseCase(write),
  });
  const synonyms = new SynonymController({
    getSynonyms: new GetSynonymsUseCase(write.synonyms),
    updateSynonyms: new UpdateSynonymsUseCase(write),
  });
  return buildCatalogTenantRouter({
    offerings,
    categories,
    modifierGroups,
    synonyms,
    permission: dependencies.permission,
    idempotency: dependencies.idempotency,
  });
}
