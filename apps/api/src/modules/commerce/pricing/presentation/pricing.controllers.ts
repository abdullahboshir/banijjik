import { asId, type PromotionId, type TaxClassId } from "@banijjik/ids";
import type { VersionedTransitionBody } from "@banijjik/validation";
import type {
  PromotionCreateBody,
  PromotionListQuery,
  PromotionUpdateBody,
  QuoteBody,
  TaxClassCreateBody,
  TaxClassListQuery,
  TaxClassUpdateBody,
} from "@banijjik/validation/pricing";
import type { RequestHandler, Response } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type {
  ArchivePromotionUseCase,
  CreatePromotionUseCase,
  GetPromotionUseCase,
  ListPromotionsUseCase,
  UpdatePromotionUseCase,
} from "../application/use-cases/promotion.use-cases.js";
import type { QuoteUseCase } from "../application/use-cases/quote.use-case.js";
import type {
  ArchiveTaxClassUseCase,
  CreateTaxClassUseCase,
  GetTaxClassUseCase,
  ListTaxClassesUseCase,
  UpdateTaxClassUseCase,
} from "../application/use-cases/tax-class.use-cases.js";

const HTTP_CREATED = 201;

function readQuery<Query>(response: Response): Query {
  return response.locals["validated"].query as Query;
}

/** Keep optional keys absent (exactOptionalPropertyTypes). */
function definedField<Key extends string, Value>(
  key: Key,
  value: Value | undefined,
): Partial<Record<Key, Value>> {
  return value === undefined ? {} : ({ [key]: value } as Partial<Record<Key, Value>>);
}

function quoteLineOf(line: QuoteBody["lines"][number]) {
  return {
    offeringId: line.offeringId,
    variantId: line.variantId,
    quantity: line.quantity,
    modifierOptionIds: line.modifierOptionIds,
    ...definedField("manualDiscount", line.manualDiscount),
    ...definedField("unitPriceOverride", line.unitPriceOverride),
  };
}

export class TaxClassController {
  constructor(
    private readonly dependencies: {
      readonly list: ListTaxClassesUseCase;
      readonly get: GetTaxClassUseCase;
      readonly create: CreateTaxClassUseCase;
      readonly update: UpdateTaxClassUseCase;
      readonly archive: ArchiveTaxClassUseCase;
    },
  ) {}

  readonly list: RequestHandler = async (_request, response) => {
    const { organizationId } = readTenantCaller();
    const { page, limit, status } = readQuery<TaxClassListQuery>(response);
    const result = await this.dependencies.list.execute({
      organizationId,
      page,
      limit,
      ...(status === undefined ? {} : { status }),
    });
    sendData(response, result.items, { meta: { page, limit, hasNext: result.hasNext } });
  };

  readonly get: RequestHandler = async (request, response) => {
    const { organizationId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.get.execute({
        organizationId,
        taxClassId: asId<TaxClassId>(String(request.params["taxClassId"])),
      }),
    );
  };

  readonly create: RequestHandler = async (request, response) => {
    const body: TaxClassCreateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.create.execute({ organizationId, actorUserId, ...body }),
      { status: HTTP_CREATED },
    );
  };

  readonly update: RequestHandler = async (request, response) => {
    const body: TaxClassUpdateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.update.execute({
        organizationId,
        actorUserId,
        taxClassId: asId<TaxClassId>(String(request.params["taxClassId"])),
        version: body.version,
        ...definedField("name", body.name),
        ...definedField("rateBasisPoints", body.rateBasisPoints),
      }),
    );
  };

  readonly archive: RequestHandler = async (request, response) => {
    const body: VersionedTransitionBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.archive.execute({
        organizationId,
        actorUserId,
        taxClassId: asId<TaxClassId>(String(request.params["taxClassId"])),
        version: body.version,
      }),
    );
  };
}

export class PromotionController {
  constructor(
    private readonly dependencies: {
      readonly list: ListPromotionsUseCase;
      readonly get: GetPromotionUseCase;
      readonly create: CreatePromotionUseCase;
      readonly update: UpdatePromotionUseCase;
      readonly archive: ArchivePromotionUseCase;
    },
  ) {}

  readonly list: RequestHandler = async (_request, response) => {
    const { organizationId } = readTenantCaller();
    const { page, limit, status } = readQuery<PromotionListQuery>(response);
    const result = await this.dependencies.list.execute({
      organizationId,
      page,
      limit,
      ...(status === undefined ? {} : { status }),
    });
    sendData(response, result.items, { meta: { page, limit, hasNext: result.hasNext } });
  };

  readonly get: RequestHandler = async (request, response) => {
    const { organizationId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.get.execute({
        organizationId,
        promotionId: asId<PromotionId>(String(request.params["promotionId"])),
      }),
    );
  };

  readonly create: RequestHandler = async (request, response) => {
    const body: PromotionCreateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.create.execute({
        organizationId,
        actorUserId,
        name: body.name,
        priority: body.priority,
        locationIds: body.locationIds,
        target: body.target,
        benefit: body.benefit,
        isStackable: body.isStackable,
        ...definedField("startsAt", body.startsAt),
        ...definedField("endsAt", body.endsAt),
        ...definedField("minQuantity", body.minQuantity),
        ...definedField("maxDiscountPerLine", body.maxDiscountPerLine),
      }),
      { status: HTTP_CREATED },
    );
  };

  readonly update: RequestHandler = async (request, response) => {
    const body: PromotionUpdateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.update.execute({
        organizationId,
        actorUserId,
        promotionId: asId<PromotionId>(String(request.params["promotionId"])),
        version: body.version,
        ...definedField("name", body.name),
        ...definedField("priority", body.priority),
        ...definedField("startsAt", body.startsAt),
        ...definedField("endsAt", body.endsAt),
        ...definedField("locationIds", body.locationIds),
        ...definedField("target", body.target),
        ...definedField("benefit", body.benefit),
        ...definedField("minQuantity", body.minQuantity),
        ...definedField("isStackable", body.isStackable),
        ...definedField("maxDiscountPerLine", body.maxDiscountPerLine),
        ...definedField("status", body.status),
      }),
    );
  };

  readonly archive: RequestHandler = async (request, response) => {
    const body: VersionedTransitionBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.archive.execute({
        organizationId,
        actorUserId,
        promotionId: asId<PromotionId>(String(request.params["promotionId"])),
        version: body.version,
      }),
    );
  };
}

export class QuoteController {
  constructor(private readonly quote: QuoteUseCase) {}

  readonly create: RequestHandler = async (request, response) => {
    const body: QuoteBody = request.body;
    const { organizationId } = readTenantCaller();
    sendData(
      response,
      await this.quote.execute({
        organizationId,
        locationId: body.locationId,
        ...definedField("at", body.at),
        lines: body.lines.map(quoteLineOf),
        ...definedField("orderDiscount", body.orderDiscount),
        ...definedField("paymentIsCash", body.paymentIsCash),
      }),
    );
  };
}
