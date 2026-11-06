import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, OFFERING_KIND } from "@banijjik/contracts";
import {
  FULFILLMENT_METHOD,
  ORDER_STATUS,
  SALES_EVENT_TYPE,
  type FulfillmentMethod,
  type OrderApproval,
  type OrderResponse,
} from "@banijjik/contracts/sales";
import type { DeliveryAddress } from "@banijjik/contracts/sales/delivery";
import { asId, type ContactId } from "@banijjik/ids";
import { recordNotFound } from "../../domain/errors.js";
import { Order } from "../../domain/order.entity.js";
import type { OrderContentChanges } from "../../domain/order-types.js";
import { emptyTotalsOf, lineInputsOf } from "./create-order.use-case.js";
import { resolveApproval } from "../sales-approval.js";
import type { SalesDependencies } from "../sales-dependencies.js";
import type { PreparedLines } from "../sales-line-preparation.js";
import { quoteAndPrepare, repriceStoredLines } from "../sales-quote-lines.js";
import {
  assertLocationAllowed,
  orderOrderingKey,
  resolveFulfillmentMethod,
  stockInputOf,
} from "../sales-transition-shared.js";
import { toOrderResponse } from "../sales-views.js";
import {
  assertContentOfPlacedOrder,
  assertDeliveryEdit,
  linesChangedOf,
  nextDeliveryAddressOf,
  priceInputsChangedOf,
} from "./update-order-delivery.js";
import type {
  ClearedContent,
  EditArgs,
  PricedDelivery,
  UpdateBody,
  UpdateInput,
} from "./update-order-types.js";

export type { UpdateBody, UpdateInput };

/** PATCH: drafts edit freely; PLACED and CONFIRMED re-quote, release and re-reserve in one go. */
export class UpdateOrderUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(input: UpdateInput): Promise<OrderResponse> {
    const existing = await this.dependencies.orders.findById(input.orderId);
    if (existing === undefined) throw recordNotFound();
    assertLocationAllowed(existing.locationId, input.allowedLocationIds);
    existing.assertEditable();
    assertDeliveryEdit(existing, input.body);
    const contactId = await this.contactChange(input.body.contactId);
    const settings = await this.dependencies.settings.read(input.organizationId);
    const priced = await this.priceEdit(existing, input);
    const args: EditArgs = {
      existing,
      input,
      prepared: priced.prepared,
      repriced: priced.repriced,
      ownerExemptBySetting: settings.discountOwnerWithoutApproval,
    };
    await assertContentOfPlacedOrder(this.dependencies, args, contactId);
    const clearedContent = await this.clearedContentOf(args);
    const actor = { actorUserId: input.actorUserId, now: this.dependencies.clock.now() };
    const persisted = await this.persistEdit(args, {
      contactId,
      clearedContent,
      actor,
      allowNegativeStock: settings.allowNegativeStock,
    });
    return toOrderResponse(
      persisted,
      await this.dependencies.payments.readTotals(persisted.orderId),
    );
  }

  private async persistEdit(
    args: EditArgs,
    resolved: {
      readonly contactId: ContactId | null | undefined;
      readonly clearedContent: ClearedContent | undefined;
      readonly actor: { readonly actorUserId: UpdateInput["actorUserId"]; readonly now: Date };
      readonly allowNegativeStock: boolean;
    },
  ): Promise<Order> {
    return this.dependencies.unitOfWork.run(async () => {
      // ADR-121: the token is consumed inside the transaction, so a refused version leaves it
      // usable for the corrected call. Address/method-only edits never run approval.
      const approval = await this.approvalOf(args);
      const edited = args.existing.applyEdit(
        this.changesOf(args, {
          contactId: resolved.contactId,
          approval,
          clearedContent: resolved.clearedContent,
        }),
        resolved.actor,
      );
      if (args.existing.status !== ORDER_STATUS.DRAFT && linesChangedOf(args.input.body)) {
        await this.restock(args, resolved.allowNegativeStock);
      }
      await this.updatePaymentSummary(args.existing, edited, resolved.actor.now);
      const saved = await this.dependencies.orders.update(edited, args.input.body.version);
      await this.dependencies.events.publish(
        SALES_EVENT_TYPE.ORDER_UPDATED,
        { orderId: saved.orderId },
        { orderingKey: orderOrderingKey(saved.orderId) },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.ORDER_UPDATED,
        entityType: AUDIT_ENTITY_TYPE.order,
        entityId: saved.orderId,
        changes: {},
      });
      return saved;
    });
  }

  private async updatePaymentSummary(existing: Order, edited: Order, now: Date): Promise<void> {
    if (existing.status === ORDER_STATUS.DRAFT) return;
    const input = { organizationId: edited.organizationId, orderId: edited.orderId, now };
    if (edited.contactId !== existing.contactId) {
      await this.dependencies.payments.updateContact({ ...input, contactId: edited.contactId });
    }
    await this.dependencies.payments.updateTotal({ ...input, total: edited.totals.grandTotal });
  }

  private async contactChange(
    contactId: string | null | undefined,
  ): Promise<ContactId | null | undefined> {
    if (contactId === undefined) return undefined;
    const next = contactId === null ? null : asId<ContactId>(contactId);
    if (next !== null) {
      const contact = await this.dependencies.contacts.findActive(next);
      if (contact === undefined) throw recordNotFound();
    }
    return next;
  }

  private async priceEdit(
    existing: Order,
    input: UpdateInput,
  ): Promise<{ prepared: PreparedLines | undefined; repriced: PricedDelivery | undefined }> {
    if (linesChangedOf(input.body)) {
      return { prepared: await this.requote(existing, input), repriced: undefined };
    }
    if (!priceInputsChangedOf(input.body)) {
      return { prepared: undefined, repriced: undefined };
    }
    return { prepared: undefined, repriced: await this.repriceDelivery(existing, input) };
  }

  private nextDeliveryOf(
    existing: Order,
    body: UpdateBody,
  ): { readonly method: FulfillmentMethod; readonly address: DeliveryAddress | null } {
    const method =
      body.fulfillmentMethod === undefined
        ? existing.fulfillment.method
        : resolveFulfillmentMethod(body.fulfillmentMethod, FULFILLMENT_METHOD.PICKUP);
    return { method, address: nextDeliveryAddressOf(existing, body, method) };
  }

  private async requote(existing: Order, input: UpdateInput): Promise<PreparedLines | undefined> {
    const lines = input.body.lines ?? lineInputsOf(existing);
    const orderDiscount =
      input.body.orderDiscount === undefined ? existing.orderDiscount : input.body.orderDiscount;
    if (lines.length === 0) return undefined;
    const delivery = this.nextDeliveryOf(existing, input.body);
    return quoteAndPrepare(this.dependencies, {
      allowedKinds: [OFFERING_KIND.PRODUCT],
      organizationId: input.organizationId,
      locationId: existing.locationId,
      lines,
      orderDiscount: orderDiscount ?? undefined,
      delivery: { method: delivery.method, address: delivery.address },
    });
  }

  private async repriceDelivery(
    existing: Order,
    input: UpdateInput,
  ): Promise<PricedDelivery | undefined> {
    const lines = lineInputsOf(existing);
    if (lines.length === 0) return undefined;
    const delivery = this.nextDeliveryOf(existing, input.body);
    return repriceStoredLines(this.dependencies, {
      allowedKinds: [OFFERING_KIND.PRODUCT],
      organizationId: input.organizationId,
      locationId: existing.locationId,
      lines,
      orderDiscount: existing.orderDiscount ?? undefined,
      delivery: { method: delivery.method, address: delivery.address },
    });
  }

  private async approvalOf(args: EditArgs): Promise<OrderApproval | null | undefined> {
    const { prepared, existing, input, ownerExemptBySetting } = args;
    if (!linesChangedOf(input.body) || prepared === undefined) return undefined;
    return resolveApproval({
      approvalsRequired: prepared.approvalsRequired,
      orderId: existing.orderId,
      instant: false,
      ownerExempt: ownerExemptBySetting && (await this.dependencies.owner.isOwner()),
      approvalToken: input.body.approvalToken,
      amount: prepared.manualDiscountTotal,
      approvals: this.dependencies.approvals,
    });
  }

  /** Lines cleared by the edit: the quote ran but returned nothing, so the order must zero out. */
  private async clearedContentOf(args: EditArgs): Promise<ClearedContent | undefined> {
    const { prepared, input } = args;
    if (prepared !== undefined || !linesChangedOf(input.body)) return undefined;
    return {
      lines: [],
      totals: emptyTotalsOf(await this.dependencies.currency.read(input.organizationId)),
      hasStockLines: false,
      deliveryZoneId: null,
      approval: null,
    };
  }

  private pricedContentOf(
    args: EditArgs,
    clearedContent: ClearedContent | undefined,
  ): Partial<Pick<OrderContentChanges, "lines" | "totals" | "hasStockLines" | "deliveryZoneId">> {
    const { prepared, repriced } = args;
    if (prepared !== undefined) {
      return {
        lines: prepared.lines,
        totals: prepared.totals,
        hasStockLines: prepared.trackedLines.length > 0,
        deliveryZoneId: prepared.deliveryZoneId,
      };
    }
    if (clearedContent !== undefined) return clearedContent;
    if (repriced === undefined) return {};
    return { totals: repriced.totals, deliveryZoneId: repriced.deliveryZoneId };
  }

  private changesOf(
    args: EditArgs,
    resolved: {
      readonly contactId: ContactId | null | undefined;
      readonly approval: OrderApproval | null | undefined;
      readonly clearedContent: ClearedContent | undefined;
    },
  ): OrderContentChanges & { readonly approval?: OrderApproval | null } {
    const { input } = args;
    const { contactId, approval, clearedContent } = resolved;
    const body = input.body;
    return {
      ...(contactId === undefined ? {} : { contactId }),
      ...this.pricedContentOf(args, clearedContent),
      ...(body.orderDiscount === undefined ? {} : { orderDiscount: body.orderDiscount }),
      ...(body.fulfillmentMethod === undefined ? {} : { fulfillment: { method: body.fulfillmentMethod } }),
      ...(body.deliveryAddress === undefined ? {} : { deliveryAddress: body.deliveryAddress }),
      ...(body.note === undefined ? {} : { note: body.note }),
      ...(body.customFields === undefined ? {} : { customFields: body.customFields }),
      ...(approval === undefined ? {} : { approval }),
    };
  }

  /** Release the old reservation and reserve the new lines; both join the edit transaction. */
  private async restock(args: EditArgs, allowNegativeStock: boolean): Promise<void> {
    const { existing, prepared } = args;
    const actorUserId = args.input.actorUserId;
    if (existing.hasStockLines) {
      await this.dependencies.stock.release(
        stockInputOf({
          organizationId: existing.organizationId,
          locationId: existing.locationId,
          actorUserId,
          orderId: existing.orderId,
          lines: [],
          allowNegativeStock,
        }),
      );
    }
    if (prepared !== undefined && prepared.trackedLines.length > 0) {
      await this.dependencies.stock.reserve(
        stockInputOf({
          organizationId: existing.organizationId,
          locationId: existing.locationId,
          actorUserId,
          orderId: existing.orderId,
          lines: prepared.trackedLines,
          allowNegativeStock,
        }),
      );
    }
  }
}
