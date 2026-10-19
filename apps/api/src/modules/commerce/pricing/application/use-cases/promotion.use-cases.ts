import { AUDIT_ACTION } from "@banijjik/contracts";
import type {
  Money,
  PromotionBenefit,
  PromotionResponse,
  PromotionStatus,
  PromotionTarget,
} from "@banijjik/contracts/pricing";
import type { OrganizationId, PromotionId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { MongoUnitOfWork } from "../../../../../kernel/db/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { kernelEventPublisher } from "../../../../../kernel/events/index.js";
import { Promotion, type PromotionChanges } from "../../domain/promotion.entity.js";
import { currencyMismatch, recordNotFound } from "../../domain/errors.js";
import type { PromotionRepository } from "../ports/pricing-repositories.js";
import type { OrganizationPricingContext } from "../ports/pricing-context-ports.js";
import { recordPromotion, viewPromotion } from "../pricing-views.js";

interface Actor {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
}

export interface PromotionWriteDependencies {
  readonly promotions: PromotionRepository;
  readonly unitOfWork: MongoUnitOfWork;
  readonly audit: AuditRecorder;
  readonly events: typeof kernelEventPublisher;
  readonly clock: Clock;
  readonly organization: OrganizationPricingContext;
}

export interface UpdatePromotionInput extends Actor {
  readonly promotionId: PromotionId;
  readonly version: number;
  readonly name?: string;
  readonly priority?: number;
  readonly startsAt?: string | null;
  readonly endsAt?: string | null;
  readonly locationIds?: readonly string[];
  readonly target?: PromotionTarget;
  readonly benefit?: PromotionBenefit;
  readonly minQuantity?: number | null;
  readonly isStackable?: boolean;
  readonly maxDiscountPerLine?: Money | null;
  readonly status?: "DRAFT" | "ACTIVE";
}

function assertBenefitCurrency(benefit: PromotionBenefit, currency: string, path: string): void {
  if (typeof benefit.value === "number") return;
  if (benefit.value.currency !== currency) throw currencyMismatch(path);
}

function assertMoneyCurrency(money: Money | undefined, currency: string, path: string): void {
  if (money !== undefined && money.currency !== currency) throw currencyMismatch(path);
}

function optionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}

function definedField<Key extends string, Value>(
  key: Key,
  value: Value | undefined,
): Partial<Record<Key, Value>> {
  return value === undefined ? {} : ({ [key]: value } as Partial<Record<Key, Value>>);
}

function toPromotionChanges(input: UpdatePromotionInput): PromotionChanges {
  return {
    ...definedField("name", input.name),
    ...definedField("priority", input.priority),
    ...definedField("startsAt", optionalDate(input.startsAt)),
    ...definedField("endsAt", optionalDate(input.endsAt)),
    ...definedField("locationIds", input.locationIds),
    ...definedField("target", input.target),
    ...definedField("benefit", input.benefit),
    ...definedField("minQuantity", input.minQuantity),
    ...definedField("isStackable", input.isStackable),
    ...definedField("maxDiscountPerLine", input.maxDiscountPerLine),
    ...definedField("status", input.status),
  };
}

export class CreatePromotionUseCase {
  constructor(private readonly dependencies: PromotionWriteDependencies) {}

  async execute(
    input: Actor & {
      name: string;
      priority: number;
      startsAt?: string;
      endsAt?: string;
      locationIds: readonly string[];
      target: PromotionTarget;
      benefit: PromotionBenefit;
      minQuantity?: number;
      isStackable: boolean;
      maxDiscountPerLine?: Money;
    },
  ): Promise<PromotionResponse> {
    const { currency } = await this.dependencies.organization.read(input.organizationId);
    assertBenefitCurrency(input.benefit, currency, "benefit.value");
    assertMoneyCurrency(input.maxDiscountPerLine, currency, "maxDiscountPerLine");
    const saved = await this.dependencies.unitOfWork.run(async () => {
      const promotion = Promotion.create({
        organizationId: input.organizationId,
        name: input.name,
        priority: input.priority,
        startsAt: input.startsAt === undefined ? undefined : new Date(input.startsAt),
        endsAt: input.endsAt === undefined ? undefined : new Date(input.endsAt),
        locationIds: input.locationIds,
        target: input.target,
        benefit: input.benefit,
        minQuantity: input.minQuantity,
        isStackable: input.isStackable,
        maxDiscountPerLine: input.maxDiscountPerLine,
        createdByUserId: input.actorUserId,
        now: this.dependencies.clock.now(),
      });
      await this.dependencies.promotions.insert(promotion);
      await recordPromotion(this.dependencies, {
        action: AUDIT_ACTION.PROMOTION_CREATED,
        before: undefined,
        after: promotion,
      });
      return promotion;
    });
    return viewPromotion(saved);
  }
}

export class UpdatePromotionUseCase {
  constructor(private readonly dependencies: PromotionWriteDependencies) {}

  async execute(input: UpdatePromotionInput): Promise<PromotionResponse> {
    const { currency } = await this.dependencies.organization.read(input.organizationId);
    if (input.benefit !== undefined)
      assertBenefitCurrency(input.benefit, currency, "benefit.value");
    if (input.maxDiscountPerLine !== undefined && input.maxDiscountPerLine !== null) {
      assertMoneyCurrency(input.maxDiscountPerLine, currency, "maxDiscountPerLine");
    }
    const changes = toPromotionChanges(input);
    const saved = await this.dependencies.unitOfWork.run(async () => {
      const existing = await this.dependencies.promotions.findById(input.promotionId);
      if (existing === undefined) throw recordNotFound();
      const edited = existing.withChanges(changes, this.dependencies.clock.now());
      const updated = await this.dependencies.promotions.update(
        edited,
        input.version,
        input.actorUserId,
      );
      await recordPromotion(this.dependencies, {
        action: AUDIT_ACTION.PROMOTION_UPDATED,
        before: existing,
        after: updated,
      });
      return updated;
    });
    return viewPromotion(saved);
  }
}

export class ArchivePromotionUseCase {
  constructor(private readonly dependencies: PromotionWriteDependencies) {}

  async execute(
    input: Actor & { promotionId: PromotionId; version: number },
  ): Promise<PromotionResponse> {
    const saved = await this.dependencies.unitOfWork.run(async () => {
      const existing = await this.dependencies.promotions.findById(input.promotionId);
      if (existing === undefined) throw recordNotFound();
      const archived = existing.archive(this.dependencies.clock.now());
      const updated = await this.dependencies.promotions.update(
        archived,
        input.version,
        input.actorUserId,
      );
      await recordPromotion(this.dependencies, {
        action: AUDIT_ACTION.PROMOTION_ARCHIVED,
        before: existing,
        after: updated,
      });
      return updated;
    });
    return viewPromotion(saved);
  }
}

export class ListPromotionsUseCase {
  constructor(private readonly promotions: PromotionRepository) {}

  async execute(input: {
    organizationId: OrganizationId;
    page: number;
    limit: number;
    status?: PromotionStatus;
  }): Promise<{ items: PromotionResponse[]; hasNext: boolean }> {
    const result = await this.promotions.list({
      page: input.page,
      limit: input.limit,
      status: input.status,
    });
    return { items: result.items.map(viewPromotion), hasNext: result.hasNext };
  }
}

export class GetPromotionUseCase {
  constructor(private readonly promotions: PromotionRepository) {}

  async execute(input: {
    organizationId: OrganizationId;
    promotionId: PromotionId;
  }): Promise<PromotionResponse> {
    const promotion = await this.promotions.findById(input.promotionId);
    if (promotion === undefined) throw recordNotFound();
    return viewPromotion(promotion);
  }
}
