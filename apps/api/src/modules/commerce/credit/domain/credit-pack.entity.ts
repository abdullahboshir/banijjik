import type { CreditPack as CreditPackContract } from "@banijjik/contracts/credit";
import type { OrganizationId } from "@banijjik/ids";
import type { Money } from "@banijjik/contracts/pricing";

export type CreditPack = CreditPackContract;

export class CreditPackEntity {
  constructor(
    readonly creditPackId: string,
    readonly organizationId: OrganizationId,
    readonly name: { readonly bn: string; readonly en: string },
    readonly credits: number,
    readonly price: Money,
    readonly validityDays: number | null,
    readonly status: "ACTIVE" | "ARCHIVED",
    readonly sortOrder: number,
    readonly version: number,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  toResponse(): CreditPack {
    return {
      creditPackId: this.creditPackId,
      name: this.name,
      credits: this.credits,
      price: this.price,
      validityDays: this.validityDays,
      status: this.status,
      sortOrder: this.sortOrder,
      version: this.version,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static create(input: {
    creditPackId: string;
    organizationId: OrganizationId;
    name: { readonly bn: string; readonly en: string };
    credits: number;
    price: Money;
    validityDays: number | null;
    sortOrder: number;
  }): CreditPackEntity {
    const now = new Date();
    return new CreditPackEntity(
      input.creditPackId,
      input.organizationId,
      input.name,
      input.credits,
      input.price,
      input.validityDays,
      "ACTIVE",
      input.sortOrder,
      1,
      now,
      now,
    );
  }

  update(input: {
    name: { readonly bn: string; readonly en: string };
    credits: number;
    price: Money;
    validityDays: number | null;
    sortOrder: number;
  }): CreditPackEntity {
    return new CreditPackEntity(
      this.creditPackId,
      this.organizationId,
      input.name,
      input.credits,
      input.price,
      input.validityDays,
      this.status,
      input.sortOrder,
      this.version + 1,
      this.updatedAt,
      new Date(),
    );
  }

  archive(): CreditPackEntity {
    return new CreditPackEntity(
      this.creditPackId,
      this.organizationId,
      this.name,
      this.credits,
      this.price,
      this.validityDays,
      "ARCHIVED",
      this.sortOrder,
      this.version + 1,
      this.updatedAt,
      new Date(),
    );
  }
}
