import {
  type SalesReturnListItem,
  type SalesReturnPreviewResponse,
  type SalesReturnResponse,
} from "@banijjik/contracts/sales";
import type { OrderId, OrganizationId, SalesReturnId } from "@banijjik/ids";
import type { SalesReturnRequestBody } from "@banijjik/validation/sales";
import { recordNotFound } from "../../domain/errors.js";
import type { SalesReturnListFilter, SalesReturnPage } from "../ports/sales-return-ports.js";
import { writeSalesReturn } from "../sales-return-create.js";
import type { SalesReturnDependencies } from "../sales-return-dependencies.js";
import {
  prepareSalesReturn,
  requireActor,
  type SalesReturnCallerInput,
} from "../sales-return-prepare.js";
import {
  toSalesReturnListItem,
  toSalesReturnPreview,
  toSalesReturnResponse,
} from "../sales-return-views.js";
import { assertLocationAllowed } from "../sales-transition-shared.js";

export type SalesReturnWriteInput = SalesReturnCallerInput & {
  readonly orderId: OrderId;
  readonly body: SalesReturnRequestBody;
  readonly posSessionId?: string | null;
};

export class PreviewSalesReturnUseCase {
  constructor(private readonly dependencies: SalesReturnDependencies) {}

  async execute(input: SalesReturnWriteInput): Promise<SalesReturnPreviewResponse> {
    return toSalesReturnPreview(await prepareSalesReturn(this.dependencies, input));
  }
}

export class CreateSalesReturnUseCase {
  constructor(private readonly dependencies: SalesReturnDependencies) {}

  async execute(input: SalesReturnWriteInput): Promise<SalesReturnResponse> {
    const actorUserId = requireActor(input.actorUserId);
    return this.dependencies.unitOfWork.run(async () => {
      const prepared = await prepareSalesReturn(this.dependencies, input);
      const record = await writeSalesReturn({
        deps: this.dependencies,
        input,
        prepared,
        actorUserId,
        exchangeOrderId: null,
      });
      return toSalesReturnResponse(record);
    });
  }
}

export interface SalesReturnListInput {
  readonly organizationId: OrganizationId;
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly locationId?: string | undefined;
  readonly orderId?: OrderId | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly page: number;
  readonly limit: number;
}

export class ListSalesReturnsUseCase {
  constructor(private readonly dependencies: SalesReturnDependencies) {}

  async execute(
    input: SalesReturnListInput,
  ): Promise<{ readonly items: readonly SalesReturnListItem[]; readonly hasNext: boolean }> {
    if (input.locationId !== undefined) {
      assertLocationAllowed(input.locationId, input.allowedLocationIds);
    }
    const filter: SalesReturnListFilter = {
      locationIds: input.locationId === undefined ? input.allowedLocationIds : [input.locationId],
      ...(input.orderId === undefined ? {} : { orderId: input.orderId }),
      ...(input.from === undefined ? {} : { from: input.from }),
      ...(input.to === undefined ? {} : { to: input.to }),
      page: input.page,
      limit: input.limit,
    };
    const page: SalesReturnPage = await this.dependencies.returns.list(filter);
    return { items: page.items.map(toSalesReturnListItem), hasNext: page.hasNext };
  }
}

export class GetSalesReturnUseCase {
  constructor(private readonly dependencies: SalesReturnDependencies) {}

  async execute(input: {
    readonly salesReturnId: SalesReturnId;
    readonly allowedLocationIds: readonly string[] | "ALL";
  }): Promise<SalesReturnResponse> {
    const record = await this.dependencies.returns.findById(input.salesReturnId);
    if (record === undefined) throw recordNotFound();
    assertLocationAllowed(record.locationId, input.allowedLocationIds);
    return toSalesReturnResponse(record);
  }
}
