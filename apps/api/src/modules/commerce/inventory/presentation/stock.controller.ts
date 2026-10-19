import type { CurrencyCode } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/catalog";
import type { StockAdjustmentReason } from "@banijjik/contracts/inventory";
import { asId, type InventoryItemId, type OfferingId } from "@banijjik/ids";
import type {
  InventoryLevelsRebuildBody,
  StockAdjustmentBody,
  StockLevelsQuery,
  StockMovementsQuery,
  StockReceiptBody,
  StockTransferBody,
} from "@banijjik/validation/inventory";
import type { RequestHandler, Response } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type {
  AdjustStockUseCase,
  GetOfferingAvailabilityUseCase,
  ListStockLevelsUseCase,
  ListStockMovementsUseCase,
  ReceiveStockUseCase,
  RebuildInventoryLevelsUseCase,
  TransferStockUseCase,
} from "../application/use-cases/stock.use-cases.js";

function asMoney(value: { amount: number; currency: string }): Money {
  return { amount: value.amount, currency: value.currency as CurrencyCode };
}

const HTTP_CREATED = 201;

export interface StockControllerDependencies {
  readonly receiveStock: ReceiveStockUseCase;
  readonly adjustStock: AdjustStockUseCase;
  readonly transferStock: TransferStockUseCase;
  readonly listLevels: ListStockLevelsUseCase;
  readonly listMovements: ListStockMovementsUseCase;
  readonly offeringAvailability: GetOfferingAvailabilityUseCase;
  readonly rebuildLevels: RebuildInventoryLevelsUseCase;
}

function readBody<T>(response: Response): T {
  return response.locals["validated"].body as T;
}

function readQuery<T>(response: Response): T {
  return response.locals["validated"].query as T;
}

export class StockController {
  constructor(private readonly dependencies: StockControllerDependencies) {}

  readonly receive: RequestHandler = async (_request, response) => {
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    const body = readBody<StockReceiptBody>(response);
    const result = await this.dependencies.receiveStock.execute({
      organizationId,
      actorUserId,
      allowedLocationIds,
      locationId: body.locationId,
      ...(body.supplierNote === undefined ? {} : { supplierNote: body.supplierNote }),
      lines: body.lines.map((line) => ({
        inventoryItemId: asId<InventoryItemId>(line.inventoryItemId),
        quantity: line.quantity,
        unitCost: asMoney(line.unitCost),
      })),
    });
    sendData(response, result, { status: HTTP_CREATED });
  };

  readonly adjust: RequestHandler = async (_request, response) => {
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    const body = readBody<StockAdjustmentBody>(response);
    const result = await this.dependencies.adjustStock.execute({
      organizationId,
      actorUserId,
      allowedLocationIds,
      locationId: body.locationId,
      ...(body.approvalToken === undefined ? {} : { approvalToken: body.approvalToken }),
      lines: body.lines.map((line) => ({
        inventoryItemId: asId<InventoryItemId>(line.inventoryItemId),
        quantityDelta: line.quantityDelta,
        reason: line.reason as StockAdjustmentReason,
        ...(line.note === undefined ? {} : { note: line.note }),
      })),
    });
    sendData(response, result, { status: HTTP_CREATED });
  };

  readonly transfer: RequestHandler = async (_request, response) => {
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    const body = readBody<StockTransferBody>(response);
    const result = await this.dependencies.transferStock.execute({
      organizationId,
      actorUserId,
      allowedLocationIds,
      fromLocationId: body.fromLocationId,
      toLocationId: body.toLocationId,
      lines: body.lines.map((line) => ({
        inventoryItemId: asId<InventoryItemId>(line.inventoryItemId),
        quantity: line.quantity,
      })),
    });
    sendData(response, result, { status: HTTP_CREATED });
  };

  readonly levels: RequestHandler = async (_request, response) => {
    const { organizationId, allowedLocationIds } = readTenantCaller();
    const query = readQuery<StockLevelsQuery>(response);
    const result = await this.dependencies.listLevels.execute({
      organizationId,
      allowedLocationIds,
      locationId: query.locationId,
      page: query.page,
      limit: query.limit,
      ...(query.q === undefined ? {} : { q: query.q }),
      ...(query.lowOnly === undefined ? {} : { lowOnly: query.lowOnly }),
    });
    sendData(response, result.items, {
      meta: { page: query.page, limit: query.limit, hasNext: result.hasNext },
    });
  };

  readonly movements: RequestHandler = async (_request, response) => {
    const { organizationId } = readTenantCaller();
    const query = readQuery<StockMovementsQuery>(response);
    const result = await this.dependencies.listMovements.execute({
      organizationId,
      page: query.page,
      limit: query.limit,
      ...(query.inventoryItemId === undefined ? {} : { inventoryItemId: query.inventoryItemId }),
      ...(query.locationId === undefined ? {} : { locationId: query.locationId }),
      ...(query.from === undefined ? {} : { from: new Date(query.from) }),
      ...(query.to === undefined ? {} : { to: new Date(query.to) }),
    });
    sendData(response, result.items, {
      meta: { page: query.page, limit: query.limit, hasNext: result.hasNext },
    });
  };

  readonly availability: RequestHandler = async (request, response) => {
    const { organizationId, allowedLocationIds } = readTenantCaller();
    const { locationId } = readQuery<{ locationId: string }>(response);
    const availability = await this.dependencies.offeringAvailability.execute({
      organizationId,
      allowedLocationIds,
      offeringId: asId<OfferingId>(String(request.params["offeringId"])),
      locationId,
    });
    sendData(response, availability);
  };

  readonly rebuild: RequestHandler = async (_request, response) => {
    const { organizationId, actorUserId } = readTenantCaller();
    const body = readBody<InventoryLevelsRebuildBody>(response);
    const report = await this.dependencies.rebuildLevels.execute({
      organizationId,
      actorUserId,
      fix: body.fix,
      ...(body.locationId === undefined ? {} : { locationId: body.locationId }),
    });
    sendData(response, report);
  };
}
