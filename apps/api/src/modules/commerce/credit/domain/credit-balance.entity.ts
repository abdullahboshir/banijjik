import type { CreditBalance as CreditBalanceContract } from "@banijjik/contracts/credit";
import type { CustomerAccountId } from "@banijjik/ids";

export type CreditBalance = CreditBalanceContract;

export class CreditBalanceEntity {
  constructor(
    readonly customerAccountId: CustomerAccountId,
    readonly balance: number,
    readonly version: number,
    readonly updatedAt: Date,
  ) {}

  toResponse(): CreditBalance {
    return {
      customerAccountId: this.customerAccountId,
      balance: this.balance,
      version: this.version,
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static create(customerAccountId: CustomerAccountId): CreditBalanceEntity {
    return new CreditBalanceEntity(customerAccountId, 0, 1, new Date());
  }

  applyDelta(delta: number, expectedVersion: number): CreditBalanceEntity {
    if (this.version !== expectedVersion) {
      throw new Error("Balance version mismatch");
    }
    const newBalance = this.balance + delta;
    if (newBalance < 0) {
      throw new Error("Balance cannot go negative");
    }
    return new CreditBalanceEntity(
      this.customerAccountId,
      newBalance,
      this.version + 1,
      new Date(),
    );
  }
}
