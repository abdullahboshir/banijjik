import type {
  CreditEntry as CreditEntryContract,
  CreditSourceType,
} from "@banijjik/contracts/credit";
import type { CustomerAccountId } from "@banijjik/ids";

export type CreditEntry = CreditEntryContract;

export class CreditEntryEntity {
  constructor(
    readonly creditEntryId: string,
    readonly customerAccountId: CustomerAccountId,
    readonly type: "PURCHASE" | "SPEND" | "REFUND" | "EXPIRE" | "ADJUST",
    readonly credits: number,
    readonly expiresOn: Date | null,
    readonly source: { readonly sourceType: CreditSourceType; readonly sourceId: string },
    readonly fromPurchaseEntryId: string | null,
    readonly reason: string | null,
    readonly createdByUserId: string | null,
    readonly occurredAt: Date,
    readonly businessDate: string,
    readonly createdAt: Date,
  ) {}

  toResponse(): CreditEntry {
    return {
      creditEntryId: this.creditEntryId,
      customerAccountId: this.customerAccountId,
      type: this.type,
      credits: this.credits,
      expiresOn: this.expiresOn?.toISOString() ?? null,
      source: this.source,
      fromPurchaseEntryId: this.fromPurchaseEntryId,
      reason: this.reason,
      createdByUserId: this.createdByUserId,
      occurredAt: this.occurredAt.toISOString(),
      businessDate: this.businessDate,
      createdAt: this.createdAt.toISOString(),
    };
  }

  static create(input: {
    creditEntryId: string;
    customerAccountId: CustomerAccountId;
    type: "PURCHASE" | "SPEND" | "REFUND" | "EXPIRE" | "ADJUST";
    credits: number;
    expiresOn: Date | null;
    source: { readonly sourceType: CreditSourceType; readonly sourceId: string };
    fromPurchaseEntryId: string | null;
    reason: string | null;
    createdByUserId: string | null;
    occurredAt: Date;
    businessDate: string;
  }): CreditEntryEntity {
    return new CreditEntryEntity(
      input.creditEntryId,
      input.customerAccountId,
      input.type,
      input.credits,
      input.expiresOn,
      input.source,
      input.fromPurchaseEntryId,
      input.reason,
      input.createdByUserId,
      input.occurredAt,
      input.businessDate,
      new Date(),
    );
  }
}
