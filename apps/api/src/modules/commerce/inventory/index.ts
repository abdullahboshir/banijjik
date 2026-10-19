import type { ModuleManifest } from "@banijjik/contracts";
import { SEQUENCE_KEY } from "@banijjik/contracts";
import type { RequestHandler, Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import { nextSequenceValue } from "../../../kernel/sequence/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { OrgConfigService } from "../../platform/entitlement/index.js";
import { buildApprovalVerifier } from "../../core/iam/index.js";
import { ERROR_CODE } from "@banijjik/contracts";
import { AppError } from "../../../kernel/http/index.js";
import {
  buildOrganizationCurrencyReader,
  buildLocationLookup,
} from "../../core/organization/index.js";
import type { InventoryDependencies } from "./application/inventory-dependencies.js";
import type { InventoryEventPublisher } from "./application/ports/inventory-context-ports.js";
import { buildInventorySettingsReader } from "./application/inventory-settings-reader.js";
import { StockLedgerService } from "./application/stock-ledger.service.js";
import { StockLedger } from "./application/stock-ledger.port.js";
import {
  ArchiveInventoryItemUseCase,
  CreateInventoryItemUseCase,
  GetInventoryItemUseCase,
  ListInventoryItemsUseCase,
  UpdateInventoryItemUseCase,
} from "./application/use-cases/inventory-item.use-cases.js";
import {
  AdjustStockUseCase,
  GetOfferingAvailabilityUseCase,
  ListStockLevelsUseCase,
  ListStockMovementsUseCase,
  ReceiveStockUseCase,
  RebuildInventoryLevelsUseCase,
  TransferStockUseCase,
} from "./application/use-cases/stock.use-cases.js";
import { MongoCatalogOfferingReader } from "./infrastructure/mongo-catalog-offering.reader.js";
import { MongoInventoryItemRepository } from "./infrastructure/mongo-inventory-item.repository.js";
import {
  MongoInventoryLevelRepository,
  MongoStockMovementRepository,
  MongoStockReservationRepository,
} from "./infrastructure/mongo-stock.repository.js";
import { InventoryItemController } from "./presentation/inventory-item.controller.js";
import { buildInventoryTenantRouter } from "./presentation/inventory-tenant.router.js";
import { StockController } from "./presentation/stock.controller.js";

export { inventoryManifest } from "./module.manifest.js";
export { registerInventoryModels } from "./infrastructure/register-inventory-models.js";
export { buildInventoryCatalogPorts } from "./infrastructure/catalog-inventory.adapters.js";
export { StockLedger } from "./application/stock-ledger.port.js";

export interface InventoryTenantDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly rebuildRateLimit: RequestHandler;
}

function inventoryEventPublisher(): InventoryEventPublisher {
  return {
    publish: (type, payload, options) => kernelEventPublisher.publish(type, payload, options),
  };
}

function writeDependencies(input: InventoryTenantDependencies): InventoryDependencies {
  const settingsReader = buildInventorySettingsReader({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });
  const events = inventoryEventPublisher();
  const movements = new MongoStockMovementRepository();
  const levels = new MongoInventoryLevelRepository();
  const stockLedger = new StockLedgerService({
    clock: input.clock,
    events,
    movements,
    levels,
  });
  const deps: InventoryDependencies = {
    items: new MongoInventoryItemRepository(),
    movements,
    levels,
    reservations: new MongoStockReservationRepository(),
    unitOfWork: new MongoUnitOfWork(),
    events,
    audit: input.audit,
    clock: input.clock,
    settings: settingsReader,
    currency: {
      read: async (organizationId) => {
        const value = await buildOrganizationCurrencyReader().read(organizationId);
        if (value === undefined) {
          throw new AppError({
            code: ERROR_CODE.INTERNAL,
            messageKey: "errors.missing_tenant_context",
          });
        }
        return value;
      },
    },
    locations: buildLocationLookup(),
    sequences: {
      nextTransferNumber: async (organizationId) =>
        String(
          await nextSequenceValue({
            organizationId,
            sequenceKey: SEQUENCE_KEY.TRANSFER,
          }),
        ),
    },
    offerings: new MongoCatalogOfferingReader(),
    approvals: buildApprovalVerifier({ audit: input.audit, clock: input.clock }),
    stockLedger,
  };
  return { ...deps, stockLedger };
}

export function buildInventoryRouter(dependencies: InventoryTenantDependencies): Router {
  const write = writeDependencies(dependencies);
  const items = new InventoryItemController({
    listItems: new ListInventoryItemsUseCase(write),
    getItem: new GetInventoryItemUseCase(write),
    createItem: new CreateInventoryItemUseCase(write),
    updateItem: new UpdateInventoryItemUseCase(write),
    archiveItem: new ArchiveInventoryItemUseCase(write),
  });
  const stock = new StockController({
    receiveStock: new ReceiveStockUseCase(write),
    adjustStock: new AdjustStockUseCase(write),
    transferStock: new TransferStockUseCase(write),
    listLevels: new ListStockLevelsUseCase(write),
    listMovements: new ListStockMovementsUseCase(write),
    offeringAvailability: new GetOfferingAvailabilityUseCase(write),
    rebuildLevels: new RebuildInventoryLevelsUseCase(write),
  });
  return buildInventoryTenantRouter({
    items,
    stock,
    permission: dependencies.permission,
    idempotency: dependencies.idempotency,
    rebuildRateLimit: dependencies.rebuildRateLimit,
  });
}

/** Builds the StockLedger port for sales modules (card 3.5). */
export function buildStockLedger(input: InventoryTenantDependencies): StockLedger {
  return new StockLedger(writeDependencies(input));
}
