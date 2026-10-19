import type { PromotionId, TaxClassId, UserId } from "@banijjik/ids";
import type { PromotionStatus, TaxClassStatus } from "@banijjik/contracts/pricing";
import type { Promotion } from "../../domain/promotion.entity.js";
import type { TaxClass } from "../../domain/tax-class.entity.js";

export interface Page<Item> {
  readonly items: readonly Item[];
  readonly hasNext: boolean;
}

export interface TaxClassListRequest {
  readonly status: TaxClassStatus | undefined;
  readonly page: number;
  readonly limit: number;
}

export interface TaxClassRepository {
  insert(taxClass: TaxClass): Promise<void>;
  findById(taxClassId: TaxClassId): Promise<TaxClass | undefined>;
  findByKey(taxClassKey: string): Promise<TaxClass | undefined>;
  findActiveByKeys(keys: readonly string[]): Promise<readonly TaxClass[]>;
  update(taxClass: TaxClass, expectedVersion: number, actorUserId: UserId): Promise<TaxClass>;
  list(request: TaxClassListRequest): Promise<Page<TaxClass>>;
}

export interface PromotionListRequest {
  readonly status: PromotionStatus | undefined;
  readonly page: number;
  readonly limit: number;
}

export interface PromotionRepository {
  insert(promotion: Promotion): Promise<void>;
  findById(promotionId: PromotionId): Promise<Promotion | undefined>;
  listActiveForQuote(): Promise<readonly Promotion[]>;
  update(promotion: Promotion, expectedVersion: number, actorUserId: UserId): Promise<Promotion>;
  list(request: PromotionListRequest): Promise<Page<Promotion>>;
}
