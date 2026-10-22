import { ORDER_STATUS } from "@banijjik/contracts/sales";
import type { OrderId } from "@banijjik/ids";
import { invalidTransition, recordNotFound } from "../../domain/errors.js";
import { assertLocationAllowed } from "../sales-transition-shared.js";
import type { SalesDependencies } from "../sales-dependencies.js";

/** The only delete in the module: a DRAFT that never had a number (plan decision 4). */
export class DeleteDraftUseCase {
  constructor(private readonly dependencies: Pick<SalesDependencies, "orders" | "unitOfWork">) {}

  async execute(input: {
    readonly orderId: OrderId;
    readonly version: number;
    readonly allowedLocationIds: readonly string[] | "ALL";
  }): Promise<void> {
    const existing = await this.dependencies.orders.findById(input.orderId);
    if (existing === undefined) throw recordNotFound();
    assertLocationAllowed(existing.locationId, input.allowedLocationIds);
    if (existing.status !== ORDER_STATUS.DRAFT) throw invalidTransition(existing.status);
    await this.dependencies.unitOfWork.run(async () => {
      await this.dependencies.orders.deleteDraft(input.orderId, input.version);
    });
  }
}
