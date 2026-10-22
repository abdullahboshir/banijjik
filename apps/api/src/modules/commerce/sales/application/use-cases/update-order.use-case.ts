import { AUDIT_ACTION } from "@banijjik/contracts";
import type { ManualDiscount } from "@banijjik/contracts/pricing";
import {
  ORDER_STATUS,
  SALES_EVENT_TYPE,
  type OrderApproval,
  type OrderResponse,
} from "@banijjik/contracts/sales";
import { asId, type ContactId, type OrderId } from "@banijjik/ids";
import { recordNotFound } from "../../domain/errors.js";
import { Order } from "../../domain/order.entity.js";
import type { OrderContentChanges } from "../../domain/order-types.js";
import { emptyTotalsOf, lineInputsOf, type OrderWriteInput } from "./create-order.use-case.js";
import { resolveApproval } from "../sales-approval.js";
import type { SalesDependencies } from "../sales-dependencies.js";
import type { OrderLineInput, PreparedLines } from "../sales-line-preparation.js";
import { quoteAndPrepare } from "../sales-quote-lines.js";
import {
  assertLocationAllowed,
  orderOrderingKey,
  stockInputOf,
} from "../sales-transition-shared.js";
import { toOrderResponse } from "../sales-views.js";

/** What the order content becomes when the seller cleared every line. */
type ClearedContent = Pick<OrderContentChanges, "lines" | "totals" | "hasStockLines"> & {
  readonly approval: null;
};

interface UpdateBody {
  readonly version: number;
  readonly contactId?: string | null;
  readonly lines?: readonly OrderLineInput[];
  readonly orderDiscount?: ManualDiscount | null;
  readonly approvalToken?: string;
  readonly note?: string | null;
  readonly customFields?: Readonly<Record<string, unknown>>;
}

interface UpdateInput extends OrderWriteInput {
  readonly orderId: OrderId;
  readonly body: UpdateBody;
}

/** The bundle passed to both approval and change-resolution helpers. */
interface EditArgs {
  readonly existing: Order;
  readonly input: UpdateInput;
  readonly prepared: PreparedLines | undefined;
  readonly ownerExemptBySetting: boolean;
}

/** PATCH: drafts edit freely; PLACED and CONFIRMED re-quote, release and re-reserve in one go. */
export class UpdateOrderUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(input: UpdateInput): Promise<OrderResponse> {
    const existing = await this.dependencies.orders.findById(input.orderId);
    if (existing === undefined) throw recordNotFound();
    assertLocationAllowed(existing.locationId, input.allowedLocationIds);
    existing.assertEditable();
    const contactId = await this.contactChange(input.body.contactId);
    const quoteChanged = input.body.lines !== undefined || input.body.orderDiscount !== undefined;
    const settings = await this.dependencies.settings.read(input.organizationId);
    const prepared = await this.requote(existing, input, quoteChanged);
    const args: EditArgs = {
      existing,
      input,
      prepared,
      ownerExemptBySetting: settings.discountOwnerWithoutApproval,
    };
    const approval = await this.approvalOf(args);
    const clearedContent = await this.clearedContentOf(args);
    const edited = existing.applyEdit(
      this.changesOf(args, { contactId, approval, clearedContent }),
      { actorUserId: input.actorUserId, now: this.dependencies.clock.now() },
    );
    await this.dependencies.unitOfWork.run(async () => {
      if (existing.status !== ORDER_STATUS.DRAFT && quoteChanged) {
        await this.restock(existing, prepared, settings.allowNegativeStock);
      }
      const persisted = await this.dependencies.orders.update(edited, input.body.version);
      await this.dependencies.events.publish(
        SALES_EVENT_TYPE.ORDER_UPDATED,
        { orderId: persisted.orderId },
        { orderingKey: orderOrderingKey(persisted.orderId) },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.ORDER_UPDATED,
        entityType: "order",
        entityId: persisted.orderId,
        changes: {},
      });
    });
    return toOrderResponse(edited, await this.dependencies.payments.read(edited.orderId));
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

  private async requote(
    existing: Order,
    input: {
      readonly organizationId: Order["organizationId"];
      readonly body: {
        readonly lines?: readonly OrderLineInput[];
        readonly orderDiscount?: ManualDiscount | null;
      };
    },
    quoteChanged: boolean,
  ): Promise<PreparedLines | undefined> {
    if (!quoteChanged) return undefined;
    const lines = input.body.lines ?? lineInputsOf(existing);
    const orderDiscount =
      input.body.orderDiscount === undefined ? existing.orderDiscount : input.body.orderDiscount;
    if (lines.length === 0) return undefined;
    return quoteAndPrepare(this.dependencies, {
      organizationId: input.organizationId,
      locationId: existing.locationId,
      lines,
      orderDiscount: orderDiscount ?? undefined,
    });
  }

  private async approvalOf(args: EditArgs): Promise<OrderApproval | null | undefined> {
    const { prepared, existing, input, ownerExemptBySetting } = args;
    if (prepared === undefined) return undefined;
    return resolveApproval({
      approvalsRequired: prepared.approvalsRequired,
      orderId: existing.orderId,
      instant: false,
      ownerExempt: ownerExemptBySetting && (await this.dependencies.owner.isOwner()),
      approvalToken: input.body.approvalToken,
      approvals: this.dependencies.approvals,
    });
  }

  /** Lines cleared by the edit: the quote ran but returned nothing, so the order must zero out. */
  private async clearedContentOf(args: EditArgs): Promise<ClearedContent | undefined> {
    const { prepared, input } = args;
    const quoteChanged = input.body.lines !== undefined || input.body.orderDiscount !== undefined;
    if (!quoteChanged || prepared !== undefined) return undefined;
    return {
      lines: [],
      totals: emptyTotalsOf(await this.dependencies.currency.read(input.organizationId)),
      hasStockLines: false,
      approval: null,
    };
  }

  private changesOf(
    args: EditArgs,
    resolved: {
      readonly contactId: ContactId | null | undefined;
      readonly approval: OrderApproval | null | undefined;
      readonly clearedContent: ClearedContent | undefined;
    },
  ): OrderContentChanges & { readonly approval?: OrderApproval | null } {
    const { prepared, input } = args;
    const { contactId, approval, clearedContent } = resolved;
    return {
      ...(contactId === undefined ? {} : { contactId }),
      ...(prepared === undefined
        ? (clearedContent ?? {})
        : {
            lines: prepared.lines,
            totals: prepared.totals,
            hasStockLines: prepared.trackedLines.length > 0,
          }),
      ...(input.body.orderDiscount === undefined
        ? {}
        : { orderDiscount: input.body.orderDiscount }),
      ...(input.body.note === undefined ? {} : { note: input.body.note }),
      ...(input.body.customFields === undefined ? {} : { customFields: input.body.customFields }),
      ...(approval === undefined ? {} : { approval }),
    };
  }

  /** Release the old reservation and reserve the new lines; both join the edit transaction. */
  private async restock(
    existing: Order,
    prepared: PreparedLines | undefined,
    allowNegativeStock: boolean,
  ): Promise<void> {
    if (existing.hasStockLines) {
      await this.dependencies.stock.release(
        stockInputOf({
          organizationId: existing.organizationId,
          locationId: existing.locationId,
          actorUserId: null,
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
          actorUserId: null,
          orderId: existing.orderId,
          lines: prepared.trackedLines,
          allowNegativeStock,
        }),
      );
    }
  }
}
