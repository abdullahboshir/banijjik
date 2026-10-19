import type { UnitKey } from "@banijjik/contracts/catalog";
import { asId, type InventoryItemId } from "@banijjik/ids";
import type { PaginationQuery, VersionedTransitionBody } from "@banijjik/validation";
import type {
  InventoryItemCreateBody,
  InventoryItemUpdateBody,
} from "@banijjik/validation/inventory";
import type { RequestHandler, Response } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type {
  ArchiveInventoryItemUseCase,
  CreateInventoryItemUseCase,
  GetInventoryItemUseCase,
  ListInventoryItemsUseCase,
  UpdateInventoryItemUseCase,
} from "../application/use-cases/inventory-item.use-cases.js";

const HTTP_CREATED = 201;

export interface InventoryItemControllerDependencies {
  readonly listItems: ListInventoryItemsUseCase;
  readonly getItem: GetInventoryItemUseCase;
  readonly createItem: CreateInventoryItemUseCase;
  readonly updateItem: UpdateInventoryItemUseCase;
  readonly archiveItem: ArchiveInventoryItemUseCase;
}

function readItemId(inventoryItemId: string): InventoryItemId {
  return asId<InventoryItemId>(inventoryItemId);
}

function readListQuery(response: Response): PaginationQuery & { q?: string; status?: string } {
  return response.locals["validated"].query as PaginationQuery & { q?: string; status?: string };
}

export class InventoryItemController {
  constructor(private readonly dependencies: InventoryItemControllerDependencies) {}

  readonly list: RequestHandler = async (_request, response) => {
    const { organizationId } = readTenantCaller();
    const { page, limit, ...filters } = readListQuery(response);
    const result = await this.dependencies.listItems.execute({
      organizationId,
      page,
      limit,
      ...filters,
    });
    sendData(response, result.items, { meta: { page, limit, hasNext: result.hasNext } });
  };

  readonly get: RequestHandler = async (request, response) => {
    const { organizationId } = readTenantCaller();
    const item = await this.dependencies.getItem.execute({
      organizationId,
      inventoryItemId: readItemId(String(request.params["inventoryItemId"])),
    });
    sendData(response, item);
  };

  readonly create: RequestHandler = async (_request, response) => {
    const { organizationId, actorUserId } = readTenantCaller();
    const body = response.locals["validated"].body as InventoryItemCreateBody;
    const item = await this.dependencies.createItem.execute({
      organizationId,
      actorUserId,
      name: body.name,
      ...(body.sku === undefined ? {} : { sku: body.sku }),
      baseUnitKey: body.baseUnitKey as UnitKey,
      ...(body.lowStockThreshold === undefined
        ? {}
        : { lowStockThreshold: body.lowStockThreshold }),
    });
    sendData(response, item, { status: HTTP_CREATED });
  };

  readonly update: RequestHandler = async (request, response) => {
    const { organizationId, actorUserId } = readTenantCaller();
    const body = response.locals["validated"].body as InventoryItemUpdateBody;
    const item = await this.dependencies.updateItem.execute({
      organizationId,
      actorUserId,
      inventoryItemId: readItemId(String(request.params["inventoryItemId"])),
      version: body.version,
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.sku === undefined ? {} : { sku: body.sku }),
      ...(body.lowStockThreshold === undefined
        ? {}
        : { lowStockThreshold: body.lowStockThreshold }),
    });
    sendData(response, item);
  };

  readonly archive: RequestHandler = async (request, response) => {
    const { organizationId, actorUserId } = readTenantCaller();
    const body = response.locals["validated"].body as VersionedTransitionBody;
    const item = await this.dependencies.archiveItem.execute({
      organizationId,
      actorUserId,
      inventoryItemId: readItemId(String(request.params["inventoryItemId"])),
      version: body.version,
    });
    sendData(response, item);
  };
}
