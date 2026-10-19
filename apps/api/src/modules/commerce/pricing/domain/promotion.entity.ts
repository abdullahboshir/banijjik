import {
  PROMOTION_STATUS,
  type Money,
  type PromotionBenefit,
  type PromotionStatus,
  type PromotionTarget,
} from "@banijjik/contracts/pricing";
import { newId, type OrganizationId, type PromotionId, type UserId } from "@banijjik/ids";
import { invalidTransition } from "./errors.js";

export interface PromotionProps {
  readonly promotionId: PromotionId;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly status: PromotionStatus;
  readonly priority: number;
  readonly startsAt: Date | undefined;
  readonly endsAt: Date | undefined;
  readonly locationIds: readonly string[];
  readonly target: PromotionTarget;
  readonly benefit: PromotionBenefit;
  readonly minQuantity: number | undefined;
  readonly isStackable: boolean;
  readonly maxDiscountPerLine: Money | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;
}

export interface NewPromotionInput {
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly priority: number;
  readonly startsAt?: Date | undefined;
  readonly endsAt?: Date | undefined;
  readonly locationIds: readonly string[];
  readonly target: PromotionTarget;
  readonly benefit: PromotionBenefit;
  readonly minQuantity?: number | undefined;
  readonly isStackable: boolean;
  readonly maxDiscountPerLine?: Money | undefined;
  readonly createdByUserId: UserId;
  readonly now: Date;
}

export interface PromotionChanges {
  readonly name?: string;
  readonly priority?: number;
  readonly startsAt?: Date | null;
  readonly endsAt?: Date | null;
  readonly locationIds?: readonly string[];
  readonly target?: PromotionTarget;
  readonly benefit?: PromotionBenefit;
  readonly minQuantity?: number | null;
  readonly isStackable?: boolean;
  readonly maxDiscountPerLine?: Money | null;
  readonly status?: typeof PROMOTION_STATUS.DRAFT | typeof PROMOTION_STATUS.ACTIVE;
}

const INITIAL_VERSION = 1;

function clearableDate(
  change: Date | null | undefined,
  current: Date | undefined,
): Date | undefined {
  if (change === undefined) return current;
  return change === null ? undefined : change;
}

function clearableNumber(
  change: number | null | undefined,
  current: number | undefined,
): number | undefined {
  if (change === undefined) return current;
  return change === null ? undefined : change;
}

function clearableMoney(
  change: Money | null | undefined,
  current: Money | undefined,
): Money | undefined {
  if (change === undefined) return current;
  return change === null ? undefined : change;
}

export class Promotion implements PromotionProps {
  readonly promotionId: PromotionId;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly status: PromotionStatus;
  readonly priority: number;
  readonly startsAt: Date | undefined;
  readonly endsAt: Date | undefined;
  readonly locationIds: readonly string[];
  readonly target: PromotionTarget;
  readonly benefit: PromotionBenefit;
  readonly minQuantity: number | undefined;
  readonly isStackable: boolean;
  readonly maxDiscountPerLine: Money | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId | null;

  private constructor(props: PromotionProps) {
    this.promotionId = props.promotionId;
    this.organizationId = props.organizationId;
    this.name = props.name;
    this.status = props.status;
    this.priority = props.priority;
    this.startsAt = props.startsAt;
    this.endsAt = props.endsAt;
    this.locationIds = props.locationIds;
    this.target = props.target;
    this.benefit = props.benefit;
    this.minQuantity = props.minQuantity;
    this.isStackable = props.isStackable;
    this.maxDiscountPerLine = props.maxDiscountPerLine;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
  }

  static create(input: NewPromotionInput): Promotion {
    return new Promotion({
      promotionId: newId() as PromotionId,
      organizationId: input.organizationId,
      name: input.name,
      status: PROMOTION_STATUS.DRAFT,
      priority: input.priority,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      locationIds: input.locationIds,
      target: input.target,
      benefit: input.benefit,
      minQuantity: input.minQuantity,
      isStackable: input.isStackable,
      maxDiscountPerLine: input.maxDiscountPerLine,
      version: INITIAL_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.createdByUserId,
    });
  }

  static restore(props: PromotionProps): Promotion {
    return new Promotion(props);
  }

  withChanges(changes: PromotionChanges, now: Date): Promotion {
    if (this.status === PROMOTION_STATUS.ARCHIVED) throw invalidTransition(this.status);
    return new Promotion({
      ...this,
      name: changes.name ?? this.name,
      priority: changes.priority ?? this.priority,
      startsAt: clearableDate(changes.startsAt, this.startsAt),
      endsAt: clearableDate(changes.endsAt, this.endsAt),
      locationIds: changes.locationIds ?? this.locationIds,
      target: changes.target ?? this.target,
      benefit: changes.benefit ?? this.benefit,
      minQuantity: clearableNumber(changes.minQuantity, this.minQuantity),
      isStackable: changes.isStackable ?? this.isStackable,
      maxDiscountPerLine: clearableMoney(changes.maxDiscountPerLine, this.maxDiscountPerLine),
      status: changes.status ?? this.status,
      updatedAt: now,
    });
  }

  archive(now: Date): Promotion {
    if (this.status === PROMOTION_STATUS.ARCHIVED) throw invalidTransition(this.status);
    return new Promotion({ ...this, status: PROMOTION_STATUS.ARCHIVED, updatedAt: now });
  }
}
