import type { OrderListItem, OrderResponse } from "@banijjik/contracts/sales";
import type { OrderId } from "@banijjik/ids";
import { recordNotFound } from "../../domain/errors.js";
import type { Order } from "../../domain/order.entity.js";
import type { SalesDependencies } from "../sales-dependencies.js";
import type { OrderListFilter } from "../ports/sales-ports.js";
import { assertLocationAllowed } from "../sales-transition-shared.js";
import { toOrderListItem, toOrderResponse } from "../sales-views.js";
import type { OrderWriteInput } from "./create-order.use-case.js";

export interface OrderListQuery {
  readonly locationId?: string | undefined;
  readonly status?: OrderListFilter["status"];
  readonly contactId?: string | undefined;
  readonly q?: string | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly page: number;
  readonly limit: number;
}

export class GetOrderUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(
    input: OrderWriteInput & { readonly orderId: OrderId },
  ): Promise<OrderResponse & { readonly contactName: string | null }> {
    const order = await this.dependencies.orders.findById(input.orderId);
    if (order === undefined) throw recordNotFound();
    assertLocationAllowed(order.locationId, input.allowedLocationIds);
    const paymentStatus = await this.dependencies.payments.read(order.orderId);
    return {
      ...toOrderResponse(order, paymentStatus),
      contactName: await this.contactNameOf(order),
    };
  }

  private async contactNameOf(order: Order): Promise<string | null> {
    if (order.contactId === null) return null;
    const names = await this.dependencies.contacts.findNames([order.contactId]);
    return names.get(order.contactId) ?? null;
  }
}

export class ListOrdersUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(
    input: OrderWriteInput & { readonly query: OrderListQuery },
  ): Promise<{ readonly items: readonly OrderListItem[]; readonly hasNext: boolean }> {
    const page = await this.dependencies.orders.list(
      await this.filterOf(input.allowedLocationIds, input.query),
    );
    const contactIds = [
      ...new Set(page.items.flatMap((row) => (row.contactId === null ? [] : [row.contactId]))),
    ];
    const names = await this.dependencies.contacts.findNames(contactIds);
    return {
      items: await Promise.all(
        page.items.map(async (row) =>
          toOrderListItem({
            row,
            contactName: row.contactId === null ? null : (names.get(row.contactId) ?? null),
            paymentTotals: await this.dependencies.payments.read(row.orderId),
          }),
        ),
      ),
      hasNext: page.hasNext,
    };
  }

  private async filterOf(
    allowedLocationIds: readonly string[] | "ALL",
    query: OrderListQuery,
  ): Promise<OrderListFilter> {
    const locationIds = intersectLocations(allowedLocationIds, query.locationId);
    const term = query.q?.trim();
    const contactIds = query.contactId === undefined ? undefined : [query.contactId];
    return {
      locationIds,
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(contactIds === undefined ? {} : { contactIds }),
      ...(term === undefined || term === ""
        ? {}
        : {
            search: {
              orderNumber: term,
              contactIds: await this.dependencies.contacts.searchActiveIds(term),
            },
          }),
      ...(query.from === undefined ? {} : { from: new Date(query.from) }),
      ...(query.to === undefined ? {} : { to: new Date(query.to) }),
      page: query.page,
      limit: query.limit,
    };
  }
}

/** The query location wins when the caller reaches it; an unreachable location asks for nothing. */
function intersectLocations(
  allowedLocationIds: readonly string[] | "ALL",
  queryLocationId: string | undefined,
): OrderListFilter["locationIds"] {
  if (allowedLocationIds === "ALL")
    return queryLocationId === undefined ? "ALL" : [queryLocationId];
  if (queryLocationId === undefined) return allowedLocationIds;
  return allowedLocationIds.includes(queryLocationId) ? [queryLocationId] : [];
}
